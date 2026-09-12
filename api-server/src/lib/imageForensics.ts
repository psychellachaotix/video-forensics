import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const IMAGE_REGIONAL_STEPS = ["copy_move", "noise"] as const;

export type ImageRegionalStep = {
  stepName: (typeof IMAGE_REGIONAL_STEPS)[number];
  stepStatus: "OK" | "NEDOSTUPNE" | "CHYBA";
  resultJson: Record<string, unknown> | null;
  errorMessage: string | null;
};

export async function runImageForensics(sourcePath: string): Promise<ImageRegionalStep[]> {
  const workerPath = path.resolve(process.cwd(), "python/image_forensics.py");
  const { stdout } = await execFileAsync("uv", ["run", "python3", workerPath, sourcePath], {
    maxBuffer: 16 * 1024 * 1024,
    timeout: 2 * 60 * 1000,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });
  const parsed = JSON.parse(stdout) as { steps?: ImageRegionalStep[] };
  const returned = new Map(parsed.steps?.map((step) => [step.stepName, step]));
  return IMAGE_REGIONAL_STEPS.map((stepName) => returned.get(stepName) ?? {
    stepName,
    stepStatus: "NEDOSTUPNE",
    resultJson: null,
    errorMessage: "Python worker nevrátil výsledek tohoto kroku.",
  });
}