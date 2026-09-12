import ambiguousWa from "../../benchmark_fixtures/ambiguous-wa.json" with { type: "json" };
import ambiguousYt from "../../benchmark_fixtures/ambiguous-yt.json" with { type: "json" };
import fullAi from "../../benchmark_fixtures/full-ai.json" with { type: "json" };
import manualAudio from "../../benchmark_fixtures/manual-audio.json" with { type: "json" };
import manualCut from "../../benchmark_fixtures/manual-cut.json" with { type: "json" };
import partialAiD01 from "../../benchmark_fixtures/partial-ai-d01.json" with { type: "json" };
import partialAiD02 from "../../benchmark_fixtures/partial-ai-d02.json" with { type: "json" };
import visionD01 from "../../benchmark_fixtures/vision-d01.json" with { type: "json" };
import visionD02 from "../../benchmark_fixtures/vision-d02.json" with { type: "json" };

export const BENCHMARK_CLASSES = ["ORIGINAL", "UPRAVENO", "UPRAVENO_AI", "CELE_AI"] as const;
export const BENCHMARK_VERDICTS = [...BENCHMARK_CLASSES, "NEJASNE"] as const;
export type BenchmarkClass = (typeof BENCHMARK_CLASSES)[number];
export type BenchmarkVerdict = (typeof BENCHMARK_VERDICTS)[number];

export interface BenchmarkRun {
  sampleKey: string;
  expectedClass: BenchmarkVerdict;
  actualClass: BenchmarkVerdict;
  confidence: number;
  model: string;
  promptVersion: string;
}

export const DEFAULT_REGRESSION_THRESHOLDS = {
  minimumOverallAccuracy: 0.75,
  minimumMacroRecall: 0.7,
  minimumPerClassRecall: 0.5,
  maximumAiFalsePositiveRate: 0.1,
} as const;

type CapturedOutput = { steps: Array<{ stepName: string; stepStatus: string; resultJson: Record<string, unknown> | null; errorMessage: string | null }> };
const productionFindings = (capture: CapturedOutput) => Object.fromEntries(
  capture.steps.map((step) => [step.stepName, { status: step.stepStatus, result: step.resultJson, error: step.errorMessage }]),
);
const visionLicense = "VISION dataset, CC BY-SA 4.0; native/platform category verified by published dataset layout.";
const captureVersion = "video_forensics.py:2026-09-11";
const sample = (
  sampleKey: string, label: string, expectedClass: BenchmarkVerdict, sourceFamily: string,
  mediaSha256: string, provenanceUri: string, labelEvidence: string, capture: CapturedOutput,
  recipeJson: Record<string, unknown>, ambiguousCase = false,
) => ({ sampleKey, label, expectedClass, sourceFamily, mediaSha256, provenanceUri, labelEvidence, ambiguousCase, captureVersion, recipeJson, findingsJson: productionFindings(capture) });

export const BENCHMARK_SAMPLES = [
  sample("vision-d01-native", "Nativní kamera D01", "ORIGINAL", "VISION-D01",
    "0012bca66ed116737e81ab5fe0b4ed4f58a0e852bf5c7ed91ceeb9411a8232c3",
    "https://lesc.dinfo.unifi.it/VISION/dataset/D01_Samsung_GalaxyS3Mini/videos/flat/D01_V_flat_panrot_0001.mp4",
    visionLicense, visionD01 as CapturedOutput, { transformation: "none" }),
  sample("vision-d02-native", "Nativní kamera D02", "ORIGINAL", "VISION-D02",
    "cec7d24ebb2b7fde13a7171e6113a879f7b0013f6078e4cc48bed7caaa17abae",
    "https://lesc.dinfo.unifi.it/VISION/dataset/D02_Apple_iPhone4s/videos/indoor/D02_V_indoor_panrot_0001.mov",
    visionLicense, visionD02 as CapturedOutput, { transformation: "none" }),
  sample("manual-cut", "Ověřený ruční střih", "UPRAVENO", "FFmpeg-editor-recipe",
    "4cb6ef11c0aff9de9a6554b9cec21c13cc5ba57d8cf0dabcaf26c7557651861c",
    "/objects/uploads/05c5d885-fc64-4ba7-bd8b-afeb489b5e7d", "Deterministický trim, fade a re-encode z hashovaného nativního zdroje.",
    manualCut as CapturedOutput, { ffmpeg: "-ss 2 -t 8 -vf fade=t=out:st=6:d=1 -c:v libx264 -crf 24" }),
  sample("manual-audio", "Ověřený ruční zvukový překryv", "UPRAVENO", "FFmpeg-audio-recipe",
    "bfdd0fcf76b3c01d8a98a816582bdaa5e7e91351584b84cebfd2fb7c9e659012",
    "/objects/uploads/64cfcc13-efdb-46ae-ba21-4f14af2d21eb", "Deterministický zvukový overlay a re-encode z hashovaného nativního zdroje.",
    manualAudio as CapturedOutput, { ffmpeg: "sine=440Hz volume=0.08; libx264+aac" }),
  sample("partial-ai-d01", "Lokální AI vložka do kamery D01", "UPRAVENO_AI", "VISION-D01+generated-video",
    "7913879a7c2de754c63878bff2d4f1a1d1745890dd92ab1e4b36d464b28b6fdb",
    "/objects/uploads/a275602c-abfa-4956-a125-b4f6db10b007", "Deterministický overlay ověřeného AI klipu do hashovaného kamerového videa.",
    partialAiD01 as CapturedOutput, { ffmpeg: "AI overlay 384x216 at bottom-right" }),
  sample("partial-ai-d02", "Lokální AI vložka do kamery D02", "UPRAVENO_AI", "VISION-D02+generated-video",
    "248be7ddcd7de860bf6d7ab84882619d96ff6434665d4e1a463cdbf5601fcea6",
    "/objects/uploads/7fc990ca-49a9-4969-b175-4f7d1ddb4ccc", "Deterministický overlay ověřeného AI klipu do hashovaného kamerového videa.",
    partialAiD02 as CapturedOutput, { ffmpeg: "AI overlay 240x180 at top-left" }),
  sample("full-ai-01", "Plně AI generovaný klip", "CELE_AI", "Replit-video-generation",
    "15c34b4d9cd12e52e65b325a6fe28eb5ddff993f1bc14dc357449cf990d565f1",
    "/objects/uploads/84d08772-28a9-4098-93a4-34dd87778c2a", "Generační job vytvořil celý klip text-to-video bez vstupního obrazu.",
    fullAi as CapturedOutput, { generator: "text-to-video", resolution: "1080p", durationSeconds: 8 }),
  sample("vision-d01-youtube", "Platformový transcode D01", "UPRAVENO", "VISION-D01-YouTube",
    "7919084b2533af0b5e56750610abcd2c986f037444283307913606832c26ecaa",
    "https://lesc.dinfo.unifi.it/VISION/dataset/D01_Samsung_GalaxyS3Mini/videos/flatYT/D01_V_flatYT_panrot_0001.mp4",
    visionLicense, ambiguousYt as CapturedOutput, { transformation: "YouTube transcode" }, true),
  sample("vision-d02-whatsapp", "Platformový transcode D02", "UPRAVENO", "VISION-D02-WhatsApp",
    "3f0748788e92534c24a655bf407eec9a6e72cfecd536846bc7889a839f093e4f",
    "https://lesc.dinfo.unifi.it/VISION/dataset/D02_Apple_iPhone4s/videos/flatWA/D02_V_flatWA_panrot_0001.mp4",
    visionLicense, ambiguousWa as CapturedOutput, { transformation: "WhatsApp transcode" }, true),
] as const satisfies ReadonlyArray<{
  sampleKey: string;
  label: string;
  expectedClass: BenchmarkVerdict;
  sourceFamily: string;
  mediaSha256: string;
  provenanceUri: string;
  labelEvidence: string;
  ambiguousCase: boolean;
  captureVersion: string;
  recipeJson: Record<string, unknown>;
  findingsJson: Record<string, unknown>;
}>;

export function calculateBenchmarkReport(runs: BenchmarkRun[]) {
  const labels = BENCHMARK_VERDICTS;
  const confusionMatrix = Object.fromEntries(labels.map((expected) => [
    expected,
    Object.fromEntries(labels.map((actual) => [actual, 0])),
  ])) as Record<BenchmarkVerdict, Record<BenchmarkVerdict, number>>;

  for (const run of runs) confusionMatrix[run.expectedClass][run.actualClass] += 1;

  const scoredRuns = runs.filter((run) => run.expectedClass !== "NEJASNE");
  const perClass = Object.fromEntries(BENCHMARK_CLASSES.map((className) => {
    const expected = scoredRuns.filter((run) => run.expectedClass === className);
    const correct = expected.filter((run) => run.actualClass === className).length;
    return [className, {
      total: expected.length,
      correct,
      recall: expected.length ? correct / expected.length : 0,
    }];
  })) as Record<BenchmarkClass, { total: number; correct: number; recall: number }>;

  const correct = scoredRuns.filter((run) => run.expectedClass === run.actualClass).length;
  const nonAiRuns = scoredRuns.filter((run) => run.expectedClass === "ORIGINAL" || run.expectedClass === "UPRAVENO");
  const aiFalsePositives = nonAiRuns.filter((run) => run.actualClass === "UPRAVENO_AI" || run.actualClass === "CELE_AI");
  const unclearRuns = runs.filter((run) => run.expectedClass === "NEJASNE");
  return {
    totalRuns: runs.length,
    scoredRuns: scoredRuns.length,
    confusionMatrix,
    overallAccuracy: scoredRuns.length ? correct / scoredRuns.length : 0,
    macroRecall: BENCHMARK_CLASSES.reduce((sum, className) => sum + perClass[className].recall, 0) / BENCHMARK_CLASSES.length,
    perClass,
    aiFalsePositiveRate: nonAiRuns.length ? aiFalsePositives.length / nonAiRuns.length : 0,
    aiFalsePositives,
    unclearAccuracy: unclearRuns.length
      ? unclearRuns.filter((run) => run.actualClass === "NEJASNE").length / unclearRuns.length
      : 0,
  };
}

export function checkRegression(
  runs: BenchmarkRun[],
  thresholds: typeof DEFAULT_REGRESSION_THRESHOLDS = DEFAULT_REGRESSION_THRESHOLDS,
  expectedSampleKeys: readonly string[] = [],
) {
  const report = calculateBenchmarkReport(runs);
  const failures: string[] = [];
  const completedKeys = new Set(runs.map((run) => run.sampleKey));
  const missingSampleKeys = expectedSampleKeys.filter((sampleKey) => !completedKeys.has(sampleKey));
  if (missingSampleKeys.length) failures.push("incompleteSampleSet");
  if (report.overallAccuracy < thresholds.minimumOverallAccuracy) failures.push("overallAccuracy");
  if (report.macroRecall < thresholds.minimumMacroRecall) failures.push("macroRecall");
  for (const className of BENCHMARK_CLASSES) {
    if (report.perClass[className].recall < thresholds.minimumPerClassRecall) failures.push(`recall.${className}`);
  }
  if (report.aiFalsePositiveRate > thresholds.maximumAiFalsePositiveRate) failures.push("aiFalsePositiveRate");
  return { passed: failures.length === 0, failures, missingSampleKeys, thresholds, report };
}