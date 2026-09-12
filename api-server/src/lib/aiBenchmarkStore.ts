import { aiBenchmarkSamplesTable, db } from "@workspace/db";
import { asc, inArray } from "drizzle-orm";
import { BENCHMARK_SAMPLES } from "./aiBenchmark";

export const CURRENT_BENCHMARK_SAMPLE_KEYS = BENCHMARK_SAMPLES.map((sample) => sample.sampleKey);

export async function syncAndLoadCurrentBenchmarkSamples() {
  for (const sample of BENCHMARK_SAMPLES) {
    await db.insert(aiBenchmarkSamplesTable).values(sample)
      .onConflictDoUpdate({ target: aiBenchmarkSamplesTable.sampleKey, set: sample });
  }
  return db.select().from(aiBenchmarkSamplesTable)
    .where(inArray(aiBenchmarkSamplesTable.sampleKey, CURRENT_BENCHMARK_SAMPLE_KEYS))
    .orderBy(asc(aiBenchmarkSamplesTable.id));
}