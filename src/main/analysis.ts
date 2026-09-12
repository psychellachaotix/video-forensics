import { randomUUID } from "node:crypto";
import type { BrowserWindow } from "electron";
import type { Analysis, CaseRecord, ForensicFinding, PipelineStep } from "../shared/types.js";
import { ProgressTracker } from "../shared/progress.js";
import { runInterpret, runVerifier } from "./anthropic.js";
import { resolveBinary, runBinary } from "./binaries.js";
import { SettingsStore } from "./settings.js";
import { CaseStorage } from "./storage.js";

const PHASES = ["import", "metadata", "technical-findings", "ffmpeg-check", "interpret", "verifier", "complete"];
type ProgressListener = (progress: Analysis["progress"]) => void;

function step(name: string): PipelineStep { return { stepName: name, stepStatus: "PENDING" }; }

export class AnalysisRunner {
  constructor(private readonly storage: CaseStorage, private readonly settings: SettingsStore) {}

  async start(caseId: string, assetId: string, window: BrowserWindow, onProgress: ProgressListener): Promise<Analysis> {
    const record = await this.storage.get(caseId);
    if (!record) throw new Error("Případ nebyl nalezen.");
    const asset = record.assets.find((item) => item.id === assetId);
    if (!asset) throw new Error("Důkazní soubor nebyl nalezen.");
    const analysis: Analysis = { id: randomUUID(), assetId, startedAt: new Date().toISOString(), progress: { caseId, percent: 0, phase: "import", etaSeconds: null, detail: "Příprava analýzy", updatedAt: new Date().toISOString() }, steps: [step("metadata"), step("technical-findings"), step("ffmpeg-check"), step("interpret"), step("verifier")], findings: [], metadata: {}, errors: [] };
    record.analyses.push(analysis);
    await this.storage.update(record);
    const tracker = new ProgressTracker(PHASES);
    const update = async (phase: string, detail: string) => {
      analysis.progress = { ...tracker.update(phase, detail), caseId };
      onProgress(analysis.progress);
      await this.storage.update(record);
      window.webContents.send("analysis:progress", analysis.progress);
    };
    await update("import", `Důkaz ${asset.originalName}`);

    await this.runIndependent(analysis, "metadata", async () => {
      const settings = await this.settings.read();
      const ffprobe = await resolveBinary("ffprobe", settings.binaries);
      const result = await runBinary(ffprobe, ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", asset.path]);
      const parsed = JSON.parse(result.stdout) as { format?: Record<string, unknown>; streams?: Array<Record<string, unknown>> };
      const stream = parsed.streams?.find((item) => item.codec_type === asset.kind) ?? parsed.streams?.[0] ?? {};
      analysis.metadata = {
        container: parsed.format?.format_name ?? asset.extension.slice(1).toUpperCase(),
        duration: Number(parsed.format?.duration ?? 0) || undefined,
        bitrate: parsed.format?.bit_rate,
        codec: stream.codec_name,
        codecLongName: stream.codec_long_name,
        width: stream.width,
        height: stream.height,
        resolution: stream.width && stream.height ? `${stream.width}×${stream.height}` : undefined,
        frameRate: stream.r_frame_rate,
        encoder: parsed.format?.tags && (parsed.format.tags as Record<string, unknown>).encoder,
        allMetadata: parsed,
        sha256: asset.sha256,
      };
    }, record, update);

    await update("technical-findings", "Vyhodnocuji lokální technické indikátory");
    await this.runIndependent(analysis, "technical-findings", async () => {
      const metadata = analysis.metadata;
      const findings: ForensicFinding[] = [];
      const duration = Number(metadata.duration ?? 0);
      if (duration > 0) findings.push({ id: randomUUID(), category: "metadata", title: "Metadata načtena", detail: `Délka ${duration.toFixed(2)} s; hash SHA-256 ${asset.sha256}.`, severity: "low" });
      if (asset.kind === "video" && !metadata.codec) findings.push({ id: randomUUID(), category: "codec", title: "Kodek nebyl rozpoznán", detail: "ffprobe neposkytl video stream; výsledek je neúplný.", severity: "medium" });
      if (metadata.encoder) findings.push({ id: randomUUID(), category: "metadata", title: "Encoder uveden v metadatech", detail: String(metadata.encoder), severity: "low" });
      analysis.findings = findings;
    }, record, update);

    await this.runIndependent(analysis, "ffmpeg-check", async () => {
      const ffmpeg = await resolveBinary("ffmpeg", (await this.settings.read()).binaries);
      const result = await runBinary(ffmpeg, ["-version"], 30_000);
      analysis.metadata.ffmpegVersion = result.stdout.split(/\r?\n/)[0] ?? "dostupný";
    }, record, update);

    const settings = await this.settings.read();
    if (!settings.hasAnthropicKey) {
      analysis.errors.push("Anthropic API klíč není nastaven; AI kroky nebyly spuštěny.");
      analysis.steps.find((item) => item.stepName === "interpret")!.stepStatus = "CHYBA";
      analysis.steps.find((item) => item.stepName === "interpret")!.detail = "API klíč není nastaven";
      analysis.steps.find((item) => item.stepName === "verifier")!.stepStatus = "CHYBA";
      analysis.steps.find((item) => item.stepName === "verifier")!.detail = "API klíč není nastaven";
      await update("interpret", "AI přeskočeno — klíč není nastaven");
    } else {
      await this.runIndependent(analysis, "interpret", async () => {
        const result = await runInterpret(await this.settings.getKey(), { asset: { name: asset.originalName, sha256: asset.sha256 }, metadata: analysis.metadata, findings: analysis.findings }, settings.apiModel);
        analysis.interpret = result.result;
        analysis.aiUsage = result.usage;
      }, record, update);
      if (analysis.interpret) {
        await this.runIndependent(analysis, "verifier", async () => {
          const result = await runVerifier(await this.settings.getKey(), { metadata: analysis.metadata, findings: analysis.findings }, analysis.interpret!, settings.apiModel);
          analysis.verifier = result.result;
          analysis.aiUsage = {
            inputTokens: (analysis.aiUsage?.inputTokens ?? 0) + result.usage.inputTokens,
            outputTokens: (analysis.aiUsage?.outputTokens ?? 0) + result.usage.outputTokens,
            estimatedCostUsd: analysis.aiUsage?.estimatedCostUsd === null || result.usage.estimatedCostUsd === null ? null : (analysis.aiUsage?.estimatedCostUsd ?? 0) + result.usage.estimatedCostUsd,
            model: result.usage.model,
          };
        }, record, update);
      } else {
        const verifierStep = analysis.steps.find((item) => item.stepName === "verifier");
        if (verifierStep) {
          verifierStep.stepStatus = "CHYBA";
          verifierStep.detail = "Interpret nedokončil; verifier nemá vstup.";
          analysis.errors.push("verifier: Interpret nedokončil; verifier nemá vstup.");
          await update("verifier", verifierStep.detail);
          await this.storage.update(record);
        }
      }
    }
    analysis.completedAt = new Date().toISOString();
    await update("complete", analysis.errors.length ? "Dokončeno s dílčími chybami" : "Analýza dokončena");
    return analysis;
  }

  private async runIndependent(analysis: Analysis, name: string, operation: () => Promise<void>, record: CaseRecord, update: ProgressListener | ((phase: string, detail: string) => Promise<void>)): Promise<void> {
    const pipelineStep = analysis.steps.find((item) => item.stepName === name);
    if (!pipelineStep) return;
    pipelineStep.stepStatus = "RUNNING"; pipelineStep.startedAt = new Date().toISOString();
    try {
      await operation();
      pipelineStep.stepStatus = "OK"; pipelineStep.detail = "Hotovo";
    } catch (error) {
      pipelineStep.stepStatus = "CHYBA"; pipelineStep.detail = error instanceof Error ? error.message : String(error);
      analysis.errors.push(`${name}: ${pipelineStep.detail}`);
    } finally {
      pipelineStep.finishedAt = new Date().toISOString();
      if (typeof update === "function" && update.length >= 2) await (update as (phase: string, detail: string) => Promise<void>)(name, pipelineStep.stepStatus === "OK" ? `${name} dokončeno` : `${name}: ${pipelineStep.detail}`);
      await this.storage.update(record);
    }
  }
}

export async function exportVideoEdit(storage: CaseStorage, caseId: string, edit: import("../shared/types.js").VideoEdit): Promise<string | null> {
  const record = await storage.get(caseId); if (!record) throw new Error("Případ nebyl nalezen.");
  const first = edit.clips[0]; if (!first) throw new Error("Přidejte alespoň jeden klip.");
  const asset = record.assets.find((item) => item.id === first.sourceAssetId);
  if (!asset || asset.kind !== "video") throw new Error("Klip odkazuje na neplatné video.");
  const settingsPath = await new SettingsStore().read(); const ffmpeg = await resolveBinary("ffmpeg", settingsPath.binaries);
  const destination = await (await import("electron")).dialog.showSaveDialog({ title: "Exportovat video", defaultPath: `${asset.originalName.replace(/\.[^.]+$/, "")}-edited.mp4`, filters: [{ name: "MP4", extensions: ["mp4"] }] });
  if (destination.canceled || !destination.filePath) return null;
  const clips = edit.clips.filter((clip) => clip.end > clip.start);
  if (!clips.length) throw new Error("Klip musí mít konec za začátkem.");
  const args = ["-y"];
  const filters: string[] = [];
  if (edit.filter === "grayscale") filters.push("hue=s=0");
  if (edit.filter === "sepia") filters.push("colorchannelmixer=.393:.769:.189:.349:.686:.168:.272:.534:.131");
  if (edit.filter === "brightness") filters.push("eq=brightness=0.08");
  if (edit.filter === "contrast") filters.push("eq=contrast=1.25");
  if (edit.text) {
    const safeText = edit.text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "\\%").replace(/[\r\n]/g, " ");
    filters.push(`drawtext=text='${safeText}':x=20:y=20:fontsize=28:fontcolor=white`);
  }
  const inputAssets = clips.map((clip) => record.assets.find((item) => item.id === clip.sourceAssetId)).filter((item): item is NonNullable<typeof item> => Boolean(item && item.kind === "video"));
  if (inputAssets.length !== clips.length) throw new Error("Některý klip odkazuje na neplatné video.");
  const settings = await new SettingsStore().read();
  const ffprobe = await resolveBinary("ffprobe", settings.binaries);
  const audioFlags: boolean[] = [];
  for (const clip of clips) {
    const clipAsset = record.assets.find((item) => item.id === clip.sourceAssetId)!;
    let hasAudio = false;
    try {
      const probe = JSON.parse((await runBinary(ffprobe, ["-v", "quiet", "-print_format", "json", "-show_streams", clipAsset.path], 30_000)).stdout) as { streams?: Array<{ codec_type?: string }> };
      hasAudio = Boolean(probe.streams?.some((stream) => stream.codec_type === "audio"));
    } catch { hasAudio = false; }
    audioFlags.push(hasAudio);
  }
  const videoIndexes: number[] = []; const audioIndexes: number[] = []; let inputIndex = 0;
  clips.forEach((clip, index) => {
    const duration = clip.end - clip.start; const source = record.assets.find((item) => item.id === clip.sourceAssetId)!;
    videoIndexes.push(inputIndex); args.push("-ss", String(clip.start), "-t", String(duration), "-i", source.path); inputIndex += 1;
    if (audioFlags[index]) audioIndexes.push(inputIndex);
    else { audioIndexes.push(inputIndex); args.push("-f", "lavfi", "-t", String(duration), "-i", "anullsrc=r=48000:cl=stereo"); }
    if (audioFlags[index]) inputIndex += 1;
    else inputIndex += 1;
  });
  const graph: string[] = [];
  clips.forEach((_clip, index) => {
    graph.push(`[${videoIndexes[index]}:v]setpts=PTS-STARTPTS,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p${filters.length ? `,${filters.join(",")}` : ""}[v${index}]`);
    graph.push(`[${audioIndexes[index]}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS,volume=${edit.muted ? 0 : Math.max(0, edit.volume)}[a${index}]`);
  });
  graph.push(clips.map((_clip, index) => `[v${index}][a${index}]`).join("") + `concat=n=${clips.length}:v=1:a=1[vout][aout]`);
  args.push("-filter_complex", graph.join(";"), "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-c:a", "aac", "-shortest", destination.filePath);
  await runBinary(ffmpeg, args, 20 * 60 * 1000);
  return destination.filePath;
}

export async function exportPhotoEdit(storage: CaseStorage, caseId: string, assetId: string, edit: import("../shared/types.js").PhotoEdit): Promise<string | null> {
  const record = await storage.get(caseId); if (!record) throw new Error("Případ nebyl nalezen.");
  const asset = record.assets.find((item) => item.id === assetId); if (!asset || asset.kind !== "image") throw new Error("Vybraný důkaz není obrázek.");
  const settingsPath = await new SettingsStore().read(); const ffmpeg = await resolveBinary("ffmpeg", settingsPath.binaries);
  let width = 0; let height = 0;
  try {
    const ffprobe = await resolveBinary("ffprobe", settingsPath.binaries);
    const metadata = JSON.parse((await runBinary(ffprobe, ["-v", "quiet", "-print_format", "json", "-show_streams", asset.path])).stdout) as { streams?: Array<{ codec_type?: string; width?: number; height?: number }> };
    const stream = metadata.streams?.find((item) => item.codec_type === "video") ?? metadata.streams?.[0];
    width = stream?.width ?? 0; height = stream?.height ?? 0;
  } catch { /* ffmpeg still gives a useful export; bounds are checked when dimensions are available */ }
  const destination = await (await import("electron")).dialog.showSaveDialog({ title: "Exportovat fotografii", defaultPath: `${asset.originalName.replace(/\.[^.]+$/, "")}-edited.${edit.format}`, filters: [{ name: edit.format.toUpperCase(), extensions: [edit.format] }] });
  if (destination.canceled || !destination.filePath) return null;
  const filters: string[] = [];
  if (edit.rotation === 90) filters.push("transpose=1"); if (edit.rotation === 180) filters.push("transpose=1,transpose=1"); if (edit.rotation === 270) filters.push("transpose=2");
  if (edit.flipX) filters.push("hflip"); if (edit.flipY) filters.push("vflip");
  filters.push(`eq=brightness=${(edit.brightness - 100) / 100}:contrast=${edit.contrast / 100}:saturation=${edit.grayscale ? 0 : edit.saturation / 100}`);
  if (edit.sepia) filters.push("colorchannelmixer=.393:.769:.189:.349:.686:.168:.272:.534:.131");
  if (edit.crop && edit.crop.width > 0 && edit.crop.height > 0) {
    const outputWidth = edit.rotation === 90 || edit.rotation === 270 ? height : width;
    const outputHeight = edit.rotation === 90 || edit.rotation === 270 ? width : height;
    if (outputWidth <= 0 || outputHeight <= 0) throw new Error("Crop nelze ověřit bez rozměrů obrázku z ffprobe.");
    if (edit.crop.x + edit.crop.width > outputWidth || edit.crop.y + edit.crop.height > outputHeight) throw new Error("Crop přesahuje rozměry fotografie.");
    filters.push(`crop=${Math.floor(edit.crop.width)}:${Math.floor(edit.crop.height)}:${Math.floor(edit.crop.x)}:${Math.floor(edit.crop.y)}`);
  }
  const args = ["-y", "-i", asset.path, "-vf", filters.join(","), "-frames:v", "1"];
  if (edit.format === "jpeg") args.push("-q:v", String(Math.max(2, Math.round(31 - edit.quality / 4))));
  args.push(destination.filePath);
  await runBinary(ffmpeg, args);
  return destination.filePath;
}