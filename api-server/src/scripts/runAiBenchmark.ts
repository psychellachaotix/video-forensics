import { aiBenchmarkRunsTable, aiBenchmarkSamplesTable, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { deriveVerifiedAiVerdict, getSelectedProvider, PROMPT_VERSION, runDualAiAnalysis } from "../lib/aiAnalysis";
import { BENCHMARK_SAMPLES } from "../lib/aiBenchmark";
import { assertCompatibleRunGroup, runBenchmarkFixtures } from "../lib/aiBenchmarkRunner";

const runGroup = process.argv.slice(2).find((argument) => argument !== "--");
if (!runGroup) throw new Error("Použití: pnpm run benchmark -- <run-group>");
const verifiedRunGroup: string = runGroup;
const existingGroupVersions = await db.selectDistinct({ promptVersion: aiBenchmarkRunsTable.promptVersion })
  .from(aiBenchmarkRunsTable)
  .where(eq(aiBenchmarkRunsTable.runGroup, verifiedRunGroup));
assertCompatibleRunGroup(existingGroupVersions.map((row) => row.promptVersion), PROMPT_VERSION);

await runBenchmarkFixtures({
  fixtures: BENCHMARK_SAMPLES,
  promptVersion: PROMPT_VERSION,
  runGroup: verifiedRunGroup,
  concurrency: 3,
  prepare: async (fixture) => {
    const [savedSample] = await db.insert(aiBenchmarkSamplesTable).values(fixture)
    .onConflictDoUpdate({
      target: aiBenchmarkSamplesTable.sampleKey,
      set: fixture,
    }).returning();
    return { fixture, savedSample };
  },
  hasResult: async ({ savedSample }, promptVersion, group) => Boolean((await db.select({ id: aiBenchmarkRunsTable.id })
    .from(aiBenchmarkRunsTable).where(and(
      eq(aiBenchmarkRunsTable.sampleId, savedSample.id),
      eq(aiBenchmarkRunsTable.promptVersion, promptVersion),
      eq(aiBenchmarkRunsTable.runGroup, group),
      eq(aiBenchmarkRunsTable.fixtureFingerprint, `${savedSample.mediaSha256}:${savedSample.captureVersion}`),
    )).limit(1))[0]),
  execute: async (fixture) => runDualAiAnalysis(fixture.findingsJson),
  save: async ({ fixture, savedSample }, ai, group) => {
    const selected = getSelectedProvider();
    const final = deriveVerifiedAiVerdict(ai);
    await db.insert(aiBenchmarkRunsTable).values({
      sampleId: savedSample.id,
      expectedClass: fixture.expectedClass,
      actualClass: final.verdict,
      confidence: final.confidence,
      model: `${selected.provider}:${selected.model}`,
      promptVersion: ai.promptVersion,
      runGroup: group,
      fixtureFingerprint: `${savedSample.mediaSha256}:${savedSample.captureVersion}`,
    }).onConflictDoNothing();
  },
  onSkip: (fixture) => console.log(`${fixture.sampleKey}: již uloženo`),
  onResult: (fixture, ai) => {
    const final = deriveVerifiedAiVerdict(ai);
    console.log(`${fixture.sampleKey}: ${final.verdict} (${final.confidence} %)`);
  },
});