import assert from "node:assert/strict";
import test from "node:test";
import {
  BENCHMARK_SAMPLES,
  calculateBenchmarkReport,
  checkRegression,
  type BenchmarkRun,
} from "./aiBenchmark.ts";

const model = "test-model";
const promptVersion = "test-prompt";

function run(sampleKey: string, expectedClass: BenchmarkRun["expectedClass"], actualClass = expectedClass): BenchmarkRun {
  return { sampleKey, expectedClass, actualClass, confidence: 80, model, promptVersion };
}

test("golden sada pokrývá čtyři třídy, nejasné případy a ověřitelnou provenienci", () => {
  assert.deepEqual(
    new Set(BENCHMARK_SAMPLES.map((sample) => sample.expectedClass)),
    new Set(["ORIGINAL", "UPRAVENO", "UPRAVENO_AI", "CELE_AI"]),
  );
  assert.ok(BENCHMARK_SAMPLES.filter((sample) => sample.ambiguousCase).length >= 2);
  assert.ok(new Set(BENCHMARK_SAMPLES.map((sample) => sample.sourceFamily)).size >= 6);
  assert.ok(BENCHMARK_SAMPLES.every((sample) => /^[a-f0-9]{64}$/.test(sample.mediaSha256)));
  assert.ok(BENCHMARK_SAMPLES.every((sample) => sample.labelEvidence.length > 20));
  assert.ok(BENCHMARK_SAMPLES.every((sample) => Object.values(sample.findingsJson).every((finding) =>
    finding && typeof finding === "object" && "status" in finding && "result" in finding && "error" in finding
  )));
  const aiVisibleFindings = JSON.stringify(BENCHMARK_SAMPLES.map((sample) => sample.findingsJson)).toLowerCase();
  assert.doesNotMatch(aiVisibleFindings, /verified|ground.?truth|ai insert|upraveno_ai|partial.?ai|localized ai/);
});

test("report počítá confusion matrix, recall a falešně pozitivní AI verdikty", () => {
  const runs = [
    run("o1", "ORIGINAL"),
    run("o2", "ORIGINAL", "CELE_AI"),
    run("m1", "UPRAVENO"),
    run("p1", "UPRAVENO_AI"),
    run("a1", "CELE_AI"),
    run("u1", "NEJASNE"),
  ];
  const report = calculateBenchmarkReport(runs);
  assert.equal(report.confusionMatrix.ORIGINAL.CELE_AI, 1);
  assert.equal(report.perClass.ORIGINAL.recall, 0.5);
  assert.equal(report.aiFalsePositiveRate, 1 / 3);
  assert.equal(report.aiFalsePositives[0].sampleKey, "o2");
  assert.equal(report.unclearAccuracy, 1);
});

test("regresní kontrola odmítne slabou třídu i při přijatelné celkové přesnosti", () => {
  const runs = [
    run("o1", "ORIGINAL"), run("o2", "ORIGINAL"),
    run("m1", "UPRAVENO"), run("m2", "UPRAVENO"),
    run("p1", "UPRAVENO_AI"), run("p2", "UPRAVENO_AI"),
    run("a1", "CELE_AI", "NEJASNE"), run("a2", "CELE_AI", "NEJASNE"),
  ];
  const result = checkRegression(runs);
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes("recall.CELE_AI"));
});

test("regresní kontrola odmítne neúplnou skupinu", () => {
  const runs = [run("o1", "ORIGINAL")];
  const result = checkRegression(runs, undefined, ["o1", "m1"]);
  assert.equal(result.passed, false);
  assert.deepEqual(result.missingSampleKeys, ["m1"]);
  assert.ok(result.failures.includes("incompleteSampleSet"));
});