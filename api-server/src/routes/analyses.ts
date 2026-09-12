import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import {
  CreateAnalysisBody,
  CreateAnalysisResponse,
  DeleteAnalysisParams,
  GetAnalysisParams,
  GetAnalysisResponse,
  GetDashboardSummaryResponse,
  ListAnalysesResponse,
  ReanalyzeVideoParams,
  ReanalyzeVideoResponse,
  SetManualVerdictBody,
  SetManualVerdictParams,
  SetManualVerdictResponse,
} from "@workspace/api-zod";
import {
  aiAnalysisTable,
  costLogTable,
  db,
  rawAnalysisTable,
  videosTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, ne, sum } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { ObjectStorageService } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { serializeEvidence } from "../lib/evidence";
import {
  AiAnalysisError,
  PROMPT_VERSION,
  hasSufficientEvidence,
  normalizeInterpret,
  normalizeVerifier,
  runDualAiAnalysis,
  type AgentCompletion,
} from "../lib/aiAnalysis";
import { buildProviderStatus } from "../lib/providerStatus";
import { runImageForensics } from "../lib/imageForensics";
import { ANALYSIS_STEPS, runVideoForensics } from "../lib/videoForensics";
import {
  finishAnalysisProgress,
  getAnalysisProgress,
  startAnalysisProgress,
  updateAnalysisProgress,
} from "../lib/analysisProgress";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
const storage = new ObjectStorageService();
const previewJobs = new Map<number, Promise<string>>();
const IMAGE_ANALYSIS_STEPS = ["metadata", "ela", "copy_move", "noise"] as const;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv"]);

function classifyMediaType(filename: string, contentType: string): "image" | "video" {
  const extension = path.extname(filename).slice(1).toLowerCase();
  const mime = contentType.trim().toLowerCase().split(";", 1)[0];
  if (IMAGE_EXTENSIONS.has(extension) && (mime.startsWith("image/") || mime === "application/octet-stream")) return "image";
  if (VIDEO_EXTENSIONS.has(extension) && (mime.startsWith("video/") || mime === "application/octet-stream")) return "video";
  // The upload endpoint validates this combination; retain a safe fallback for
  // old clients and records created before extension validation was added.
  return mime.startsWith("image/") ? "image" : "video";
}

function mimeForFilename(filename: string): string {
  switch (path.extname(filename).slice(1).toLowerCase()) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type RawRow = typeof rawAnalysisTable.$inferSelect;
type AiRow = typeof aiAnalysisTable.$inferSelect;
type VideoRow = typeof videosTable.$inferSelect;
type ReportInterpret = {
  verdict?: string;
  confidence?: number;
  typ_manipulace?: string[];
  casove_useky?: string[];
  podezrele_oblasti?: string[];
  zduvodneni?: string;
  nejasnosti?: string;
};
type ReportVerifier = {
  shoda_s_analytikem?: boolean;
  upravena_jistota_procenta?: number;
  rozpory?: string[];
  potvrzena_zjisteni?: string[];
  finalni_status?: string;
  komentar?: string;
};

function emptyMetadata() {
  return {
    container: "neuvedeno",
    codec: "neuvedeno",
    duration: 0,
    createdAt: null,
    modifiedAt: null,
    encoder: null,
    bitrate: null,
    frameRate: null,
    resolution: null,
    editingSoftware: {
      detected: false,
      name: null,
      source: "tag_absent",
      rawEncoder: null,
      confidence: null,
      evidence: null,
    },
    allMetadata: {},
  };
}

async function inspectImage(video: VideoRow, tempPath: string) {
  const rows: Array<{ videoId: number; stepName: string; stepStatus: string; resultJson: Record<string, unknown> | null; errorMessage: string | null }> = [];
  let metadata: Record<string, unknown> = {
    container: "obrazek", codec: "neuvedeno", duration: 0, createdAt: null, modifiedAt: null,
    encoder: null, bitrate: null, frameRate: null, resolution: null,
    editingSoftware: { detected: false, name: null, source: "tag_absent", rawEncoder: null, confidence: null, evidence: null },
    allMetadata: {},
  };
  try {
    const { stdout } = await execFileAsync("exiftool", ["-j", tempPath], { maxBuffer: 8 * 1024 * 1024 });
    const parsed = JSON.parse(stdout) as Array<Record<string, unknown>>;
    const exif = parsed[0] ?? {};
    const width = exif.ImageWidth ?? exif.ExifImageWidth;
    const height = exif.ImageHeight ?? exif.ExifImageHeight;
    metadata = {
      ...metadata,
      container: exif.FileTypeExtension ?? exif.FileType ?? "obrazek",
      createdAt: exif.DateTimeOriginal ?? exif.CreateDate ?? null,
      modifiedAt: exif.FileModifyDate ?? null,
      encoder: exif.Software ?? null,
      resolution: width && height ? `${width}×${height}` : null,
      allMetadata: exif,
      title: "EXIF metadata načtena",
      detail: "exiftool načetl dostupná metadata včetně EXIF/GPS polí.",
      severity: "low",
    };
    rows.push({ videoId: video.id, stepName: "metadata", stepStatus: "OK", resultJson: metadata, errorMessage: null });
  } catch (error) {
    rows.push({ videoId: video.id, stepName: "metadata", stepStatus: "NEDOSTUPNE", resultJson: null, errorMessage: `exiftool není dostupný nebo metadata nelze načíst: ${error instanceof Error ? error.message : "neznámá chyba"}` });
  }
  try {
    const recompressed = `${tempPath}.recompressed.jpg`;
    try {
      await execFileAsync("convert", [tempPath, "-quality", "90", recompressed], { maxBuffer: 2 * 1024 * 1024 });
      let stdout = "";
      let stderr = "";
      try {
        ({ stdout, stderr } = await execFileAsync("compare", ["-metric", "MAE", tempPath, recompressed, "null:"], { maxBuffer: 2 * 1024 * 1024 }));
      } catch (error) {
        // ImageMagick compare deliberately exits with status 1 when images
        // differ. That is a valid ELA result, not a failed analysis.
        const exitCode = (error as { code?: number }).code;
        if (exitCode !== 1) throw error;
        stdout = String((error as { stdout?: string }).stdout ?? "");
        stderr = String((error as { stderr?: string }).stderr ?? "");
      }
      rows.push({ videoId: video.id, stepName: "ela", stepStatus: "OK", resultJson: {
        title: "ELA dokončena", detail: `Rozdíl oproti JPEG re-kompresi (MAE): ${(stdout || stderr).trim()}. Hodnota sama o sobě není důkaz manipulace.`, severity: "low",
      }, errorMessage: null });
    } finally {
      await fs.rm(recompressed, { force: true });
    }
  } catch (error) {
    rows.push({ videoId: video.id, stepName: "ela", stepStatus: "NEDOSTUPNE", resultJson: null, errorMessage: `ELA nástroj není dostupný: ${error instanceof Error ? error.message : "neznámá chyba"}` });
  }
  try {
    const regionalRows = await runImageForensics(tempPath);
    rows.push(...regionalRows.map((row) => ({ videoId: video.id, ...row })));
  } catch (error) {
    // A worker bootstrap failure is isolated from metadata/ELA and represented
    // independently for both regional methods.
    for (const stepName of ["copy_move", "noise"] as const) {
      rows.push({ videoId: video.id, stepName, stepStatus: "CHYBA", resultJson: null,
        errorMessage: `Regionální obrazová analýza selhala: ${error instanceof Error ? error.message : "neznámá chyba"}` });
    }
  }
  return { rows, metadata };
}

function deriveVerdict(ai: AiRow | undefined) {
  if (ai?.manualniVerdikt === "ORIGINAL") return "ORIGINÁL" as const;
  if (ai?.manualniVerdikt === "UPRAVENO") return "UPRAVENO" as const;
  if (ai?.manualniVerdikt === "UPRAVENO_AI") return "UPRAVENO_AI" as const;
  if (ai?.manualniVerdikt === "CELE_AI") return "CELE_AI" as const;
  if (ai?.manualniVerdikt === "NEJISTE") return "NEURČENO" as const;
  if (ai?.finalniStatus !== "POTVRZENO") return "NEURČENO" as const;
  const interpret = ai?.interpretResultJson as { verdict?: string; confidence?: number } | null;
  if (interpret?.verdict === "ORIGINAL") return "ORIGINÁL" as const;
  if (interpret?.verdict === "UPRAVENO") return "UPRAVENO" as const;
  if (interpret?.verdict === "UPRAVENO_AI") return "UPRAVENO_AI" as const;
  if (interpret?.verdict === "CELE_AI") return "CELE_AI" as const;
  return "NEURČENO" as const;
}

function reportList(items: string[] | undefined, emptyMessage: string) {
  if (!items?.length) return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function buildReport(
  video: VideoRow,
  metadata: ReturnType<typeof emptyMetadata>,
  evidence: Array<{ title: string; detail: string }>,
  verdict: string,
  finalStatus: string | null,
  interpret: ReportInterpret | null,
  verifier: ReportVerifier | null,
  apiError: string | null,
) {
  const evidenceRows = evidence
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.detail)}</li>`)
    .join("");
  const mediaLabel = video.mediaType === "image" ? "obrázku" : "videa";
  const incompleteAi = finalStatus === "CHYBA_API";
  const verifierStatus = incompleteAi ? "CHYBA_API — NEÚPLNÁ AI KONTROLA" : (verifier?.finalni_status ?? finalStatus ?? "NEJISTE");
  const agreement = verifier?.shoda_s_analytikem == null
    ? "Neuvedeno"
    : verifier.shoda_s_analytikem ? "Shoda" : "Neshoda";
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forenzní report</title><style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:850px;margin:40px auto;padding:0 24px;color:#18201b;line-height:1.5;overflow-wrap:anywhere}h1{border-bottom:3px solid #9dd315;padding-bottom:12px}h2{margin-top:32px;border-bottom:1px solid #cad2cc;padding-bottom:8px}h3{margin-bottom:8px}.result{border:2px solid #18201b;padding:18px;margin:24px 0}.result strong{display:block;font-size:1.35rem}.warning{border:2px solid #b42318;background:#fff1f0;color:#7a271a;padding:16px;margin:20px 0}.agent{border:1px solid #cad2cc;padding:18px;margin:18px 0}.label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#56615a}.empty{color:#66736b;font-style:italic}code{word-break:break-all}.agent li{margin:10px 0}.agent pre,pre{max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#f4f6f4;padding:14px;box-sizing:border-box}small{color:#56615a}@media print{@page{size:auto;margin:16mm 14mm}body{max-width:none;margin:0;padding:0;font-size:10.5pt;color:#000;line-height:1.4;overflow-wrap:anywhere}h1,h2,h3{break-after:avoid-page}h1{border-color:#000}h2{border-color:#777}h2+*,h3+*{break-before:avoid-page}p,li{orphans:3;widows:3}.agent{border-color:#777;break-inside:auto}.agent li{break-inside:avoid-page}.result,.warning{break-inside:avoid-page;border-color:#000;color:#000;background:#fff}.result strong{font-size:1.25rem}.warning strong{font-size:1.1rem}.label,.empty,small{color:#222}pre{break-inside:auto;background:#fff;border:1px solid #777}a{color:inherit}}
</style></head><body><h1>Forenzní report ${mediaLabel}</h1>
<div class="result"><span class="label">Hlavní výsledek — finální status Verifiera</span><strong>${escapeHtml(verifierStatus)}</strong><div>Forenzní verdikt: ${escapeHtml(verdict)}</div></div>
${incompleteAi ? `<div class="warning"><strong>AI kontrola je neúplná.</strong><br>Verifier nemohl dokončit nezávislou kontrolu. Report proto nesmí být vykládán jako potvrzený AI závěr.${apiError ? `<br><span class="label">Technická informace</span><br>${escapeHtml(apiError)}` : ""}</div>` : ""}
<p><strong>Soubor:</strong> ${escapeHtml(video.filename)}</p><p><strong>SHA-256:</strong> <code>${escapeHtml(video.fileHash)}</code></p>
<h2>Interpret</h2><section class="agent"><p><span class="label">Navržený verdikt</span><br><strong>${escapeHtml(interpret?.verdict ?? "Výsledek není dostupný")}</strong>${interpret?.confidence != null ? ` (${escapeHtml(interpret.confidence)} %)` : ""}</p><h3>Zdůvodnění</h3><p>${escapeHtml(interpret?.zduvodneni ?? "Interpret neposkytl zdůvodnění.")}</p><h3>Nejasnosti</h3><p>${escapeHtml(interpret?.nejasnosti ?? "Interpret neuvedl nejasnosti.")}</p><h3>Typy manipulace</h3>${reportList(interpret?.typ_manipulace, "Nebyl uveden žádný typ manipulace.")}<h3>Časové úseky nebo podezřelé oblasti</h3>${reportList(interpret?.casove_useky ?? interpret?.podezrele_oblasti, "Nebyly uvedeny žádné úseky ani oblasti.")}</section>
<h2>Verifier</h2><section class="agent"><p><span class="label">Finální status</span><br><strong>${escapeHtml(verifierStatus)}</strong></p><p><span class="label">Shoda s Interpretem</span><br>${escapeHtml(agreement)}${verifier?.upravena_jistota_procenta != null ? ` · upravená jistota ${escapeHtml(verifier.upravena_jistota_procenta)} %` : ""}</p><h3>Potvrzená zjištění</h3>${reportList(verifier?.potvrzena_zjisteni, incompleteAi ? "Verifier kontrolu nedokončil." : "Verifier nepotvrdil žádná jednotlivá zjištění.")}<h3>Rozpory</h3>${reportList(verifier?.rozpory, incompleteAi ? "Rozpory nelze vyhodnotit, protože kontrola nebyla dokončena." : "Verifier neuvedl žádné rozpory.")}<h3>Komentář Verifiera</h3><p>${escapeHtml(verifier?.komentar ?? (incompleteAi ? "Komentář není kvůli neúplné AI kontrole dostupný." : "Verifier neposkytl komentář."))}</p></section>
<h2>Metadata</h2><pre>${escapeHtml(JSON.stringify(metadata, null, 2))}</pre><h2>Technické nálezy</h2><ul>${evidenceRows || "<li>Žádné nálezy nejsou dostupné.</li>"}</ul><p><small>Automatický výsledek je technická indicie, nikoliv právní znalecký posudek.</small></p></body></html>`;
}

function toAnalysis(video: VideoRow, raw: RawRow[], ai?: AiRow) {
  const metadataRow = raw.find((row) => row.stepName === "metadata" && row.stepStatus === "OK");
  const metadata = metadataRow?.resultJson
    ? { ...emptyMetadata(), ...(metadataRow.resultJson as object) }
    : emptyMetadata();
  const requiredAnalysisFailed = !metadataRow;
  const evidence = raw
    .filter((row) => row.stepStatus !== "OK" || row.resultJson)
    .map(serializeEvidence);
  const interpret = ai?.interpretResultJson as ReportInterpret | null;
  const verifier = ai?.verifierResultJson as ReportVerifier | null;
  const effectiveFinalStatus = ai?.apiError ? "CHYBA_API" : ai?.finalniStatus ?? null;
  const verifiedConfidence = effectiveFinalStatus === "POTVRZENO"
    ? (verifier?.upravena_jistota_procenta ?? interpret?.confidence ?? 0)
    : 0;
  const estimatedCostUsd = Number(ai?.interpretCostUsd ?? 0) + Number(ai?.verifierCostUsd ?? 0);
  const verdict = deriveVerdict(ai);
  const steps = ANALYSIS_STEPS.map((stepName) => {
    const row = raw.find((item) => item.stepName === stepName);
    return {
      stepName,
      stepStatus: row?.stepStatus ?? "NEDOSTUPNE",
      resultJson: row?.resultJson ?? null,
      errorMessage: row?.errorMessage ?? (row ? null : "Analytický krok nebyl uložen."),
    };
  });
  const progress = getAnalysisProgress(video.id);
  const terminal = video.status === "HOTOVO" || video.status === "CHYBA";
  const progressPercent = terminal ? 100 : (progress?.percent ?? 0);
  return {
    id: video.id,
    name: video.filename,
    status:
      video.status === "ZPRACOVAVA_SE"
        ? "analyzing"
        : video.status === "CHYBA" || requiredAnalysisFailed || effectiveFinalStatus === "CHYBA_API"
          ? "failed"
          : video.status === "HOTOVO"
            ? "complete"
            : "queued",
    verdict,
    confidence: Math.max(0, Math.min(100, verifiedConfidence)),
    createdAt: video.uploadTimestamp.toISOString(),
    updatedAt: (ai?.createdAt ?? video.uploadTimestamp).toISOString(),
    evidenceCount: evidence.length,
    metadata,
    mediaType: video.mediaType,
    evidence,
    pipelineSteps: steps,
    objectPath: video.originalPath,
    reportHtml: video.status === "HOTOVO" && !requiredAnalysisFailed
      ? buildReport(video, metadata, evidence, verdict, effectiveFinalStatus, interpret, verifier, ai?.apiError ?? null)
      : null,
    fileHash: video.fileHash,
    finalStatus: effectiveFinalStatus,
    interpretResult: ai?.interpretResultJson ?? null,
    verifierResult: ai?.verifierResultJson ?? null,
    apiError: ai?.apiError ?? null,
    manualVerdict: ai?.manualniVerdikt ?? null,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    aiUsage: {
      interpretInputTokens: ai?.interpretInputTokens ?? null,
      interpretOutputTokens: ai?.interpretOutputTokens ?? null,
      interpretCostUsd: ai?.interpretCostUsd ?? null,
      verifierInputTokens: ai?.verifierInputTokens ?? null,
      verifierOutputTokens: ai?.verifierOutputTokens ?? null,
      verifierCostUsd: ai?.verifierCostUsd ?? null,
    },
    progressPercent,
    progressPhase: terminal ? "finalization" : (progress?.phase ?? null),
    progressPhaseLabel: terminal ? "Finalizace reportu" : (progress?.phaseLabel ?? null),
    analysisStartedAt: progress ? new Date(progress.startedAt).toISOString() : null,
    elapsedSeconds: progress
      ? Math.max(0, Math.round((Date.now() - progress.startedAt) / 1000))
      : 0,
    etaSeconds: terminal ? null : (progress?.etaSeconds ?? null),
    progressEstimated: progress?.estimated ?? false,
  };
}

async function loadAnalyses(videos: VideoRow[]) {
  if (videos.length === 0) return [];
  const ids = videos.map((video) => video.id);
  const [rawRows, aiRows] = await Promise.all([
    db.select().from(rawAnalysisTable).where(inArray(rawAnalysisTable.videoId, ids)),
    db.select().from(aiAnalysisTable).where(inArray(aiAnalysisTable.videoId, ids))
      .orderBy(desc(aiAnalysisTable.createdAt), desc(aiAnalysisTable.id)),
  ]);
  return videos.map((video) =>
    toAnalysis(
      video,
      rawRows.filter((row) => row.videoId === video.id),
      aiRows.find((row) => row.videoId === video.id),
    ),
  );
}

async function inspectVideo(video: VideoRow, alreadyClaimed = false) {
  const tempPath = path.join("/tmp", `video-forensics-${video.id}${path.extname(video.filename)}`);
  try {
    if (!alreadyClaimed) {
      const claimed = await db.update(videosTable)
        .set({ status: "ZPRACOVAVA_SE" })
        .where(and(eq(videosTable.id, video.id), ne(videosTable.status, "ZPRACOVAVA_SE")))
        .returning({ id: videosTable.id });
      if (!claimed.length) return;
    }
    startAnalysisProgress(video.id);
    updateAnalysisProgress(video.id, "preparation", 8);
    const objectFile = await storage.getObjectEntityFile(video.originalPath ?? "");
    const sourceStream = objectFile.createReadStream();
    await pipeline(sourceStream, createWriteStream(tempPath));
    updateAnalysisProgress(video.id, "technical", 12, { etaSeconds: 45 });
    if (video.mediaType === "image") {
      const { rows, metadata } = await inspectImage(video, tempPath);
      updateAnalysisProgress(video.id, "technical", 55);
      await db.delete(rawAnalysisTable).where(eq(rawAnalysisTable.videoId, video.id));
      await db.insert(rawAnalysisTable).values(rows);
      updateAnalysisProgress(video.id, "evidence", 62);
      if (!hasSufficientEvidence(rows)) {
        await db.insert(aiAnalysisTable).values({
          videoId: video.id, promptVersion: PROMPT_VERSION,
          interpretResultJson: { verdict: "NEJASNE", confidence: 0, zduvodneni: "Nedostatek dostupných obrazových dat.", typ_manipulace: [], casove_useky: [], podezrele_oblasti: [], nejasnosti: "Analytické nástroje nejsou dostupné." },
          finalniStatus: "NEJISTE", retryCount: 0, apiError: null,
        });
      } else {
        const rawFindings = Object.fromEntries(rows.map((row) => [row.stepName, { status: row.stepStatus, result: row.resultJson, error: row.errorMessage }]));
        try {
          const ai = await runDualAiAnalysis(rawFindings, "obrazek", (agent) => {
            updateAnalysisProgress(video.id, agent === "INTERPRET" ? "interpret" : "verifier", agent === "INTERPRET" ? 70 : 84);
          });
          const interpret = normalizeInterpret(ai.interpret.result);
          const verifier = normalizeVerifier(ai.verifier.result);
          await db.insert(aiAnalysisTable).values({
            videoId: video.id, promptVersion: ai.promptVersion, interpretResultJson: interpret,
            interpretInputTokens: ai.interpret.usage.inputTokens, interpretOutputTokens: ai.interpret.usage.outputTokens, interpretCostUsd: ai.interpret.usage.costUsd,
            verifierResultJson: verifier, verifierInputTokens: ai.verifier.usage.inputTokens, verifierOutputTokens: ai.verifier.usage.outputTokens, verifierCostUsd: ai.verifier.usage.costUsd,
            finalniStatus: verifier.finalni_status, retryCount: ai.interpret.retries + ai.verifier.retries, apiError: null,
          });
        } catch (error) {
          // Keep a completed interpretation as evidence when the verifier/API
          // is unavailable. This is a terminal inconclusive case, not a
          // successful AI verdict; the original API error remains diagnostic.
          const completed = error instanceof AiAnalysisError ? error.completedInterpret : undefined;
          await db.insert(aiAnalysisTable).values({
            videoId: video.id,
            promptVersion: PROMPT_VERSION,
            interpretResultJson: completed?.result ?? null,
            interpretInputTokens: completed?.usage.inputTokens,
            interpretOutputTokens: completed?.usage.outputTokens,
            interpretCostUsd: completed?.usage.costUsd,
            finalniStatus: "CHYBA_API",
            retryCount: error instanceof AiAnalysisError ? error.retries : 0,
            apiError: error instanceof Error ? error.message : "Neznámá chyba AI API.",
          });
        }
      }
      updateAnalysisProgress(video.id, "finalization", 96);
      await db.update(videosTable).set({ status: "HOTOVO" }).where(eq(videosTable.id, video.id));
      return;
    }
    const workerRows = await runVideoForensics(tempPath);
    const rows = workerRows.map((row) => ({ videoId: video.id, ...row }));
    updateAnalysisProgress(video.id, "technical", 55);
    await db.delete(rawAnalysisTable).where(eq(rawAnalysisTable.videoId, video.id));
    await db.insert(rawAnalysisTable).values(rows);
    updateAnalysisProgress(video.id, "evidence", 62);
    if (!hasSufficientEvidence(rows)) {
      await db.insert(aiAnalysisTable).values({
        videoId: video.id,
        promptVersion: PROMPT_VERSION,
        interpretResultJson: {
          verdikt: "NEJASNE",
          jistota_procenta: 0,
          typ_manipulace: [],
          casove_useky: [],
          zduvodneni: "Více než polovina analytických kroků neposkytla použitelná data.",
          nejasnosti: "Pro spolehlivý závěr chybí dostatek nezávislých technických nálezů.",
          verdict: "NEJASNE",
          confidence: 0,
        },
        finalniStatus: "NEJISTE",
        retryCount: 0,
        apiError: null,
      });
      updateAnalysisProgress(video.id, "finalization", 96);
      await db.update(videosTable).set({ status: "HOTOVO" }).where(eq(videosTable.id, video.id));
      return;
    }
    const rawFindings = Object.fromEntries(rows.map((row) => [
      row.stepName,
      { status: row.stepStatus, result: row.resultJson, error: row.errorMessage },
    ]));
    let completedInterpret: AgentCompletion | undefined;
    let completedVerifier: AgentCompletion | undefined;
    try {
      const ai = await runDualAiAnalysis(rawFindings, "video", (agent) => {
        updateAnalysisProgress(video.id, agent === "INTERPRET" ? "interpret" : "verifier", agent === "INTERPRET" ? 70 : 84);
      });
      const interpret = normalizeInterpret(ai.interpret.result);
      const verifier = normalizeVerifier(ai.verifier.result);
      completedInterpret = ai.interpret;
      completedVerifier = ai.verifier;
      await db.transaction(async (tx) => {
        const [saved] = await tx.insert(aiAnalysisTable).values({
          videoId: video.id,
          promptVersion: ai.promptVersion,
          interpretResultJson: interpret,
          interpretInputTokens: ai.interpret.usage.inputTokens,
          interpretOutputTokens: ai.interpret.usage.outputTokens,
          interpretCostUsd: ai.interpret.usage.costUsd,
          verifierResultJson: verifier,
          verifierInputTokens: ai.verifier.usage.inputTokens,
          verifierOutputTokens: ai.verifier.usage.outputTokens,
          verifierCostUsd: ai.verifier.usage.costUsd,
          finalniStatus: verifier.finalni_status,
          retryCount: ai.interpret.retries + ai.verifier.retries,
          apiError: null,
        }).returning({ id: aiAnalysisTable.id });
        await tx.insert(costLogTable).values([
          {
            aiAnalysisId: saved.id,
            agentType: "INTERPRET",
            inputTokens: ai.interpret.usage.inputTokens,
            outputTokens: ai.interpret.usage.outputTokens,
            costUsd: ai.interpret.usage.costUsd,
          },
          {
            aiAnalysisId: saved.id,
            agentType: "VERIFIER",
            inputTokens: ai.verifier.usage.inputTokens,
            outputTokens: ai.verifier.usage.outputTokens,
            costUsd: ai.verifier.usage.costUsd,
          },
        ]);
      });
    } catch (error) {
      if (error instanceof AiAnalysisError) {
        completedInterpret = error.completedInterpret;
        completedVerifier = error.completedVerifier;
      }
      await db.transaction(async (tx) => {
        const [failed] = await tx.insert(aiAnalysisTable).values({
          videoId: video.id,
          promptVersion: PROMPT_VERSION,
          interpretResultJson: completedInterpret?.result ?? null,
          interpretInputTokens: completedInterpret?.usage.inputTokens,
          interpretOutputTokens: completedInterpret?.usage.outputTokens,
          interpretCostUsd: completedInterpret?.usage.costUsd,
          verifierResultJson: completedVerifier?.result ?? null,
          verifierInputTokens: completedVerifier?.usage.inputTokens,
          verifierOutputTokens: completedVerifier?.usage.outputTokens,
          verifierCostUsd: completedVerifier?.usage.costUsd,
          // Preserve any completed response for review, but distinguish an API
          // failure from a verifier determination.
          finalniStatus: "CHYBA_API",
          retryCount: error instanceof AiAnalysisError
            ? (error.agent === "INTERPRET" ? error.retries : (completedInterpret?.retries ?? 0) + error.retries)
            : (completedInterpret?.retries ?? 0) + (completedVerifier?.retries ?? 0),
          apiError: error instanceof Error ? error.message : "Neznámá chyba AI API.",
        }).returning({ id: aiAnalysisTable.id });
        const costs = [
          completedInterpret && {
            aiAnalysisId: failed.id,
            agentType: "INTERPRET",
            inputTokens: completedInterpret.usage.inputTokens,
            outputTokens: completedInterpret.usage.outputTokens,
            costUsd: completedInterpret.usage.costUsd,
          },
          completedVerifier && {
            aiAnalysisId: failed.id,
            agentType: "VERIFIER",
            inputTokens: completedVerifier.usage.inputTokens,
            outputTokens: completedVerifier.usage.outputTokens,
            costUsd: completedVerifier.usage.costUsd,
          },
        ].filter((item): item is NonNullable<typeof item> => Boolean(item));
        if (costs.length) {
          await tx.insert(costLogTable).values(costs);
        }
      });
      logger.error({ err: error, videoId: video.id }, "Dual AI analysis failed");
    }
    updateAnalysisProgress(video.id, "finalization", 96);
    await db.update(videosTable).set({ status: "HOTOVO" }).where(eq(videosTable.id, video.id));
  } catch (error) {
    logger.error({ err: error, videoId: video.id }, "Video analysis failed");
    const existingRaw = await db.select({ id: rawAnalysisTable.id })
      .from(rawAnalysisTable)
      .where(eq(rawAnalysisTable.videoId, video.id))
      .limit(1);
    if (!existingRaw.length) {
      await db.insert(rawAnalysisTable).values(
        (video.mediaType === "image" ? IMAGE_ANALYSIS_STEPS : ANALYSIS_STEPS).map((stepName) => ({
          videoId: video.id,
          stepName,
          stepStatus: "CHYBA",
          resultJson: null,
          errorMessage: error instanceof Error ? error.message : "Neznámá chyba",
        })),
      );
    }
    await db.update(videosTable).set({ status: "CHYBA" }).where(eq(videosTable.id, video.id));
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    finishAnalysisProgress(video.id);
  }
}

export const analysisRuntime = {
  inspectVideo,
};

router.get("/analyses", async (_req, res): Promise<void> => {
  const videos = await db.select().from(videosTable).orderBy(desc(videosTable.uploadTimestamp));
  res.json(ListAnalysesResponse.parse(await loadAnalyses(videos)));
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const videos = await db.select().from(videosTable).orderBy(desc(videosTable.uploadTimestamp));
  const analyses = await loadAnalyses(videos);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [monthlyCost] = await db
    .select({ total: sum(costLogTable.costUsd) })
    .from(costLogTable)
    .where(gte(costLogTable.createdAt, monthStart));
  const complete = analyses.filter((item) => item.status === "complete");
  res.json(GetDashboardSummaryResponse.parse({
    total: analyses.length,
    originals: analyses.filter((item) => item.verdict === "ORIGINÁL").length,
     edited: analyses.filter((item) => item.verdict === "UPRAVENO" || item.verdict === "UPRAVENO_AI" || item.verdict === "CELE_AI").length,
    analyzing: analyses.filter((item) => item.status === "analyzing" || item.status === "queued").length,
    needsReview: analyses.filter((item) => item.finalStatus === "SPORNE" || item.finalStatus === "NEJISTE").length,
    averageConfidence: complete.length ? Math.round(complete.reduce((sum, item) => sum + item.confidence, 0) / complete.length) : 0,
    monthlyCostUsd: Number(Number(monthlyCost?.total ?? 0).toFixed(6)),
    recent: analyses.slice(0, 5),
  }));
});

router.get("/dashboard/ai-status", async (_req, res): Promise<void> => {
  // This endpoint is deliberately observational: it never probes a provider.
  // A small recent window keeps dashboard polling inexpensive.
  const rows = await db.select({
    createdAt: aiAnalysisTable.createdAt,
    apiError: aiAnalysisTable.apiError,
    interpretInputTokens: aiAnalysisTable.interpretInputTokens,
    interpretOutputTokens: aiAnalysisTable.interpretOutputTokens,
    interpretCostUsd: aiAnalysisTable.interpretCostUsd,
    verifierInputTokens: aiAnalysisTable.verifierInputTokens,
    verifierOutputTokens: aiAnalysisTable.verifierOutputTokens,
    verifierCostUsd: aiAnalysisTable.verifierCostUsd,
    verifierResultJson: aiAnalysisTable.verifierResultJson,
  }).from(aiAnalysisTable)
    .orderBy(desc(aiAnalysisTable.createdAt), desc(aiAnalysisTable.id))
    .limit(50);
  res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
  res.json((await import("@workspace/api-zod")).GetAiProviderStatusResponse.parse(buildProviderStatus(rows)));
});

router.post("/analyses", async (req, res): Promise<void> => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const normalizedHash = parsed.data.fileHash.toLowerCase();
  try {
    const uploaded = await storage.getObjectEntityFile(parsed.data.objectPath);
    const [metadata] = await uploaded.getMetadata();
    const storedSize = Number(metadata.size ?? 0);
    if (storedSize !== parsed.data.size) {
      res.status(400).json({ error: "Nahrávání souboru ještě není dokončeno nebo nesouhlasí jeho velikost." });
      return;
    }
  } catch (error) {
    req.log.warn({ err: error, objectPath: parsed.data.objectPath }, "Analysis rejected before durable upload was confirmed");
    res.status(400).json({ error: "Nahraný soubor zatím není dostupný v trvalém úložišti." });
    return;
  }
  const [cached] = await db.select().from(videosTable).where(eq(videosTable.fileHash, normalizedHash)).limit(1);
  if (cached) {
    const [analysis] = await loadAnalyses([cached]);
    res.json(CreateAnalysisResponse.parse(analysis));
    return;
  }
  const [video] = await db.insert(videosTable).values({
    filename: parsed.data.name,
    fileHash: normalizedHash,
    fileSizeBytes: parsed.data.size,
    originalPath: parsed.data.objectPath,
    mediaType: classifyMediaType(parsed.data.name, parsed.data.contentType),
    status: "NAHRANO",
  }).returning();
  res.status(201).json(CreateAnalysisResponse.parse(toAnalysis(video, [])));
  void inspectVideo(video);
});

router.get("/analyses/:id", async (req, res): Promise<void> => {
  const params = SetManualVerdictParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id)).limit(1);
  if (!video) {
    res.status(404).json({ error: "Analýza nebyla nalezena." });
    return;
  }
  const [analysis] = await loadAnalyses([video]);
  res.json(GetAnalysisResponse.parse(analysis));
});

router.get("/analyses/:id/preview", async (req, res): Promise<void> => {
  const params = SetManualVerdictParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id)).limit(1);
  if (!video?.originalPath) {
    res.status(404).json({ error: "Zdrojové video nebylo nalezeno." });
    return;
  }
  if (video.mediaType === "image") {
    try {
    const objectFile = await storage.getObjectEntityFile(video.originalPath);
      const [metadata] = await objectFile.getMetadata();
      const contentType = metadata.contentType && metadata.contentType !== "application/octet-stream"
        ? metadata.contentType
        : mimeForFilename(video.filename);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      objectFile.createReadStream().pipe(res);
    } catch (error) {
      logger.error({ err: error, videoId: video.id }, "Image preview streaming failed");
      if (!res.headersSent) res.status(500).json({ error: "Náhled obrázku se nepodařilo odeslat." });
    }
    return;
  }
  const outputPath = path.join("/tmp", `video-preview-${video.id}.webm`);
  try {
    const cached = await fs.stat(outputPath).then((stat) => stat.size > 0).catch(() => false);
    if (!cached) {
      let job = previewJobs.get(video.id);
      if (!job) {
        job = (async () => {
          const requestId = randomUUID();
          const inputPath = path.join("/tmp", `video-preview-input-${video.id}-${requestId}${path.extname(video.filename)}`);
          const partialPath = `${outputPath}.${requestId}.partial`;
          try {
            const objectFile = await storage.getObjectEntityFile(video.originalPath!);
            await pipeline(objectFile.createReadStream(), createWriteStream(inputPath));
            await execFileAsync("ffmpeg", [
              "-y", "-i", inputPath,
              "-map", "0:v:0", "-map", "0:a:0?",
              "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8",
              "-crf", "38", "-b:v", "0", "-c:a", "libopus",
              "-f", "webm",
              partialPath,
            ], { maxBuffer: 8 * 1024 * 1024 });
            await fs.rename(partialPath, outputPath);
            return outputPath;
          } finally {
            await Promise.all([
              fs.rm(inputPath, { force: true }),
              fs.rm(partialPath, { force: true }),
            ]);
          }
        })();
        previewJobs.set(video.id, job);
        void job.finally(() => previewJobs.delete(video.id)).catch(() => undefined);
      }
      await job;
    }
    res.type("video/webm");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(outputPath, (error) => {
      if (error && !res.headersSent) {
        res.status(500).json({ error: "Náhled videa se nepodařilo odeslat." });
      }
    });
  } catch (error) {
    logger.error({ err: error, videoId: video.id }, "Video preview generation failed");
    await fs.rm(outputPath, { force: true });
    if (!res.headersSent) {
      res.status(500).json({ error: "Náhled videa se nepodařilo vytvořit." });
    }
  }
});

router.get("/analyses/:id/stream", async (req, res): Promise<void> => {
  const params = SetManualVerdictParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id)).limit(1);
  if (!video?.originalPath || video.mediaType !== "video") {
    res.status(404).json({ error: "Zdrojové video nebylo nalezeno." });
    return;
  }
  try {
    const objectFile = await storage.getObjectEntityFile(video.originalPath);
    const [metadata] = await objectFile.getMetadata();
    const size = Number(metadata.size ?? video.fileSizeBytes);
    const contentType = metadata.contentType && metadata.contentType !== "application/octet-stream"
      ? metadata.contentType
      : mimeForFilename(video.filename);
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
        res.setHeader("Content-Range", `bytes */${size}`);
        res.sendStatus(416);
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      objectFile.createReadStream({ start, end }).pipe(res);
      return;
    }
    res.setHeader("Content-Length", String(size));
    objectFile.createReadStream().pipe(res);
  } catch (error) {
    req.log.error({ err: error, videoId: video.id }, "Durable video source streaming failed");
    if (!res.headersSent) res.status(500).json({ error: "Zdrojové video se nepodařilo streamovat." });
  }
});

router.delete("/analyses/:id", async (req, res): Promise<void> => {
  const params = SetManualVerdictParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await db.delete(videosTable).where(eq(videosTable.id, params.data.id)).returning({ id: videosTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Analýza nebyla nalezena." });
    return;
  }
  finishAnalysisProgress(params.data.id);
  res.sendStatus(204);
});

router.post("/analyses/:id/reanalyze", async (req, res): Promise<void> => {
  const params = SetManualVerdictParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id)).limit(1);
  if (!video) {
    res.status(404).json({ error: "Analýza nebyla nalezena." });
    return;
  }
  const claimed = await db.update(videosTable)
    .set({ status: "ZPRACOVAVA_SE" })
    .where(and(eq(videosTable.id, video.id), ne(videosTable.status, "ZPRACOVAVA_SE")))
    .returning({ id: videosTable.id });
  if (claimed.length) {
    void analysisRuntime.inspectVideo({ ...video, status: "ZPRACOVAVA_SE" }, true);
  }
  const rawRows = await db.select()
    .from(rawAnalysisTable)
    .where(eq(rawAnalysisTable.videoId, video.id));
  res.json(ReanalyzeVideoResponse.parse({
    ...toAnalysis({ ...video, status: "ZPRACOVAVA_SE" }, rawRows),
    status: "analyzing",
  }));
});

router.patch("/analyses/:id/verdict", async (req, res): Promise<void> => {
  const params = SetManualVerdictParams.safeParse(req.params);
  const body = SetManualVerdictBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Neplatný ruční verdikt." });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id)).limit(1);
  if (!video) {
    res.status(404).json({ error: "Analýza nebyla nalezena." });
    return;
  }
  const [latest] = await db.select().from(aiAnalysisTable)
    .where(eq(aiAnalysisTable.videoId, video.id))
    .orderBy(desc(aiAnalysisTable.createdAt), desc(aiAnalysisTable.id))
    .limit(1);
  if (latest) {
    await db.update(aiAnalysisTable)
      .set({
        manualniVerdikt: body.data.verdict,
      })
      .where(and(eq(aiAnalysisTable.id, latest.id), eq(aiAnalysisTable.videoId, video.id)));
  } else {
    await db.insert(aiAnalysisTable).values({
      videoId: video.id,
      promptVersion: PROMPT_VERSION,
      manualniVerdikt: body.data.verdict,
    });
  }
  const [analysis] = await loadAnalyses([video]);
  res.json(SetManualVerdictResponse.parse(analysis));
});

export default router;
