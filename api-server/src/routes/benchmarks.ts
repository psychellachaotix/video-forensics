import { aiBenchmarkRunsTable, aiBenchmarkSamplesTable, db } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  BENCHMARK_SAMPLES,
  DEFAULT_REGRESSION_THRESHOLDS,
  calculateBenchmarkReport,
  checkRegression,
  type BenchmarkRun,
  type BenchmarkVerdict,
} from "../lib/aiBenchmark";
import { syncAndLoadCurrentBenchmarkSamples } from "../lib/aiBenchmarkStore";

const router: IRouter = Router();

function serializeRun(row: {
  sampleKey: string;
  expectedClass: string;
  actualClass: string;
  confidence: number;
  model: string;
  promptVersion: string;
}): BenchmarkRun {
  return { ...row, expectedClass: row.expectedClass as BenchmarkVerdict, actualClass: row.actualClass as BenchmarkVerdict };
}

router.get("/benchmarks/samples", async (_req, res, next) => {
  try {
    res.json(await syncAndLoadCurrentBenchmarkSamples());
  } catch (error) {
    next(error);
  }
});

async function loadRuns(promptVersion: string, runGroup: string) {
  const condition = and(eq(aiBenchmarkRunsTable.promptVersion, promptVersion), eq(aiBenchmarkRunsTable.runGroup, runGroup));
  const selection = {
    sampleKey: aiBenchmarkSamplesTable.sampleKey,
    expectedClass: aiBenchmarkRunsTable.expectedClass,
    actualClass: aiBenchmarkRunsTable.actualClass,
    confidence: aiBenchmarkRunsTable.confidence,
    model: aiBenchmarkRunsTable.model,
    promptVersion: aiBenchmarkRunsTable.promptVersion,
  };
  const rows = await db.selectDistinctOn([aiBenchmarkRunsTable.sampleId], selection)
      .from(aiBenchmarkRunsTable)
      .innerJoin(aiBenchmarkSamplesTable, eq(aiBenchmarkRunsTable.sampleId, aiBenchmarkSamplesTable.id))
      .where(condition)
      .orderBy(aiBenchmarkRunsTable.sampleId, desc(aiBenchmarkRunsTable.createdAt));
  return rows.map(serializeRun);
}

router.get("/benchmarks/report", async (req, res, next) => {
  try {
    const promptVersion = typeof req.query.promptVersion === "string" ? req.query.promptVersion.trim() : "";
    if (!promptVersion) return void res.status(400).json({ error: "Query parametr promptVersion je povinný." });
    const runGroup = typeof req.query.runGroup === "string" ? req.query.runGroup.trim() : "";
    if (!runGroup) return void res.status(400).json({ error: "Query parametr runGroup je povinný." });
    res.json({ promptVersion, runGroup, ...calculateBenchmarkReport(await loadRuns(promptVersion, runGroup)) });
  } catch (error) {
    next(error);
  }
});

router.get("/benchmarks/regression", async (req, res, next) => {
  try {
    const promptVersion = typeof req.query.promptVersion === "string" ? req.query.promptVersion.trim() : "";
    if (!promptVersion) return void res.status(400).json({ error: "Query parametr promptVersion je povinný." });
    const runGroup = typeof req.query.runGroup === "string" ? req.query.runGroup.trim() : "";
    if (!runGroup) return void res.status(400).json({ error: "Query parametr runGroup je povinný." });
    const result = checkRegression(
      await loadRuns(promptVersion, runGroup),
      DEFAULT_REGRESSION_THRESHOLDS,
      BENCHMARK_SAMPLES.map((sample) => sample.sampleKey),
    );
    res.status(result.passed ? 200 : 422).json({ promptVersion, runGroup, ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/benchmarks/thresholds", (_req, res) => res.json(DEFAULT_REGRESSION_THRESHOLDS));

export default router;