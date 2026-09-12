import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

export const ANALYSIS_STEPS = [
  "metadata",
  "komprese",
  "strihy",
  "snimky",
  "audio",
  "barvy",
] as const;

export type AnalysisStep = {
  stepName: (typeof ANALYSIS_STEPS)[number];
  stepStatus: "OK" | "NEDOSTUPNE" | "CHYBA";
  resultJson: Record<string, unknown> | null;
  errorMessage: string | null;
};

export async function runVideoForensics(sourcePath: string): Promise<AnalysisStep[]> {
  const workerPath = path.resolve(process.cwd(), "python/video_forensics.py");
  const startedAt = Date.now();
  logger.info({ workerPath }, "Video forensic worker started");
  const { stdout, stderr } = await execFileAsync("uv", ["run", "python3", workerPath, sourcePath], {
    maxBuffer: 16 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
  });
  for (const line of stderr.split("\n").filter(Boolean)) {
    try {
      logger.info({ worker: JSON.parse(line) }, "Video forensic step event");
    } catch {
      logger.info({ workerMessage: line.slice(0, 500) }, "Video forensic worker diagnostic");
    }
  }
  const parsed = JSON.parse(stdout) as { steps?: AnalysisStep[] };
  const returned = new Map(parsed.steps?.map((step) => [step.stepName, step]));
  const result: AnalysisStep[] = ANALYSIS_STEPS.map((stepName): AnalysisStep => returned.get(stepName) ?? {
    stepName,
    stepStatus: "NEDOSTUPNE",
    resultJson: null,
    errorMessage: "Python worker nevrátil výsledek tohoto kroku.",
  });
  logger.info({
    durationMs: Date.now() - startedAt,
    steps: result.map(({ stepName, stepStatus, errorMessage }) => ({ stepName, stepStatus, errorMessage })),
  }, "Video forensic worker finished");
  return result;
}