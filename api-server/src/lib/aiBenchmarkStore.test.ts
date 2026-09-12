import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { aiBenchmarkSamplesTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { BENCHMARK_SAMPLES } from "./aiBenchmark";
import { syncAndLoadCurrentBenchmarkSamples } from "./aiBenchmarkStore";

test("katalog nezobrazuje zastaralé syntetické vzorky", async () => {
  const obsoleteKey = `obsolete-synthetic-${randomUUID()}`;
  await db.insert(aiBenchmarkSamplesTable).values({
    sampleKey: obsoleteKey,
    label: "obsolete",
    expectedClass: "NEJASNE",
    sourceFamily: "synthetic",
    mediaSha256: "0".repeat(64),
    provenanceUri: "legacy:unverified",
    labelEvidence: "Zastaralý testovací řádek bez platné evidence.",
    ambiguousCase: false,
    captureVersion: "legacy",
    recipeJson: {},
    findingsJson: {},
  });
  try {
    const samples = await syncAndLoadCurrentBenchmarkSamples();
    assert.equal(samples.length, BENCHMARK_SAMPLES.length);
    assert.deepEqual(
      new Set(samples.map((sample) => sample.sampleKey)),
      new Set(BENCHMARK_SAMPLES.map((sample) => sample.sampleKey)),
    );
    assert.equal(samples.some((sample) => sample.sampleKey === obsoleteKey), false);
  } finally {
    await db.delete(aiBenchmarkSamplesTable).where(eq(aiBenchmarkSamplesTable.sampleKey, obsoleteKey));
  }
});