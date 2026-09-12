import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { ExportEditedVideoBody } from "@workspace/api-zod";
import { db, videosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ObjectStorageService } from "../lib/objectStorage";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
const storage = new ObjectStorageService();

const videoFilters: Record<string, string> = {
  none: "null",
  grayscale: "hue=s=0",
  warm: "colorbalance=rs=.12:bs=-.08",
  cool: "colorbalance=rs=-.08:bs=.12",
  contrast: "eq=contrast=1.3:saturation=1.1",
};

function escapeDrawText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "\\%");
}

router.post("/editor/export", async (req, res): Promise<void> => {
  const parsed = ExportEditedVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Neplatný projekt editoru.", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.clips.some((clip) => !Number.isFinite(clip.start) || !Number.isFinite(clip.end) || clip.end <= clip.start)) {
    res.status(400).json({ error: "Každý klip musí mít kladný rozsah." });
    return;
  }

  const project = parsed.data;
  const [source] = await db.select().from(videosTable).where(eq(videosTable.id, project.analysisId)).limit(1);
  if (!source?.originalPath || source.mediaType !== "video") {
    res.status(404).json({ error: "Zdrojové video nebylo nalezeno." });
    return;
  }

  const requestId = randomUUID();
  const inputPath = path.join("/tmp", `editor-input-${requestId}${path.extname(source.filename) || ".mp4"}`);
  const outputPath = path.join("/tmp", `editor-output-${requestId}.mp4`);
  const filterPath = path.join("/tmp", `editor-filter-${requestId}.txt`);

  try {
    const objectFile = await storage.getObjectEntityFile(source.originalPath);
    await pipeline(objectFile.createReadStream(), createWriteStream(inputPath));
    const probe = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration:stream=index,codec_type", "-of", "json", inputPath,
    ]);
    const probeData = JSON.parse(probe.stdout) as { format?: { duration?: string }; streams?: Array<{ index: number; codec_type?: string }> };
    const sourceDuration = Number(probeData.format?.duration);
    if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
      await Promise.all([inputPath, outputPath, filterPath].map((file) => fs.rm(file, { force: true })));
      res.status(400).json({ error: "Délku zdrojového videa se nepodařilo zjistit." });
      return;
    }
    if (project.clips.some((clip) => clip.start < 0 || clip.end > sourceDuration + 0.1)) {
      await Promise.all([inputPath, outputPath, filterPath].map((file) => fs.rm(file, { force: true })));
      res.status(400).json({ error: "Rozsah klipu je mimo délku zdrojového videa." });
      return;
    }
    // Browser-compatible previews can differ from the original container by a
    // few frames. Clamp that harmless duration drift to the probed source.
    const normalizedClips = project.clips.map((clip) => ({
      ...clip,
      end: Math.min(clip.end, sourceDuration),
    }));
    const outputDuration = normalizedClips.reduce((sum, clip) => sum + clip.end - clip.start, 0);
    if (project.texts.some((text) => text.start < 0 || text.end <= text.start || text.end > outputDuration + 0.01)) {
      await Promise.all([inputPath, outputPath, filterPath].map((file) => fs.rm(file, { force: true })));
      res.status(400).json({ error: "Textový překryv je mimo výslednou časovou osu." });
      return;
    }
    const hasAudio = (probeData.streams ?? []).some((stream) => stream.codec_type === "audio");

    const graph: string[] = [];
    normalizedClips.forEach((clip, index) => {
      const duration = clip.end - clip.start;
      const fade = clip.transition === "fade" && duration > 0.5
        ? `,fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, duration - 0.25)}:d=0.25`
        : "";
      graph.push(`[0:v]trim=start=${clip.start}:end=${clip.end},setpts=PTS-STARTPTS,${videoFilters[project.filter]}${fade}[v${index}]`);
      if (hasAudio && !project.muted) {
        graph.push(`[0:a]atrim=start=${clip.start}:end=${clip.end},asetpts=PTS-STARTPTS,volume=${project.volume}[a${index}]`);
      }
    });

    const videoInputs = normalizedClips.map((_, index) => `[v${index}]`).join("");
    if (hasAudio && !project.muted) {
      const inputs = normalizedClips.map((_, index) => `[v${index}][a${index}]`).join("");
      graph.push(`${inputs}concat=n=${normalizedClips.length}:v=1:a=1[vbase][aout]`);
    } else {
      graph.push(`${videoInputs}concat=n=${normalizedClips.length}:v=1:a=0[vbase]`);
    }

    let current = "vbase";
    project.texts.forEach((text, index) => {
      const output = `vtext${index}`;
      graph.push(
        `[${current}]drawtext=text='${escapeDrawText(text.text)}':fontcolor=${text.color}:fontsize=${text.size}:x=(w-text_w)*${text.x / 100}:y=(h-text_h)*${text.y / 100}:` +
        `box=1:boxcolor=black@0.45:boxborderw=12:enable='between(t,${text.start},${text.end})'[${output}]`,
      );
      current = output;
    });
    graph.push(`[${current}]format=yuv420p[vout]`);
    await fs.writeFile(filterPath, graph.join(";\n"), "utf8");

    const args = [
      "-y", "-i", inputPath, "-filter_complex_script", filterPath,
      "-map", "[vout]", ...(hasAudio && !project.muted ? ["-map", "[aout]"] : ["-an"]),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
      ...(hasAudio && !project.muted ? ["-c:a", "aac", "-b:a", "192k"] : []),
      "-movflags", "+faststart", outputPath,
    ];
    await execFileAsync("ffmpeg", args, { maxBuffer: 16 * 1024 * 1024 });
    res.type("video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="video-forensics-edit-${source.id}.mp4"`);
    res.sendFile(outputPath, () => {
      void Promise.all([inputPath, outputPath, filterPath].map((file) => fs.rm(file, { force: true })));
    });
  } catch (error) {
    req.log.error({ err: error, analysisId: project.analysisId }, "Video editor export failed");
    await Promise.all([inputPath, outputPath, filterPath].map((file) => fs.rm(file, { force: true })));
    if (!res.headersSent) {
      const message = error instanceof Error && /No such file|Invalid data|ffprobe|ffmpeg/i.test(error.message)
        ? "Zdrojové video nelze zpracovat."
        : "Export videa se nepodařilo dokončit.";
      res.status(500).json({ error: message });
    }
  }
});

export default router;