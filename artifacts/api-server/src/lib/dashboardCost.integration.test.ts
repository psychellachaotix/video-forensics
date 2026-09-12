import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
  aiAnalysisTable,
  costLogTable,
  db,
  pool,
  videosTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import app from "../app.ts";
import { AI_MODEL_CONFIGS } from "./aiAnalysis.ts";

interface DashboardSummary {
  monthlyCostUsd: number;
}

async function getDashboardSummary(baseUrl: string): Promise<DashboardSummary> {
  const response = await fetch(`${baseUrl}/api/dashboard/summary`);
  assert.equal(response.status, 200);
  return await response.json() as DashboardSummary;
}

test("měsíční součet používá uložené ceny úspěšné i částečné AI analýzy", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const successfulHash = `cost-history-success-${randomUUID()}`;
  const partialHash = `cost-history-partial-${randomUUID()}`;
  const insertedVideoIds: number[] = [];
  const anthropicPricing = AI_MODEL_CONFIGS.Anthropic["claude-sonnet-4-6"] as {
    inputUsdPerMillion: number;
    outputUsdPerMillion: number;
  };
  const openAiPricing = AI_MODEL_CONFIGS.OpenAI["gpt-5-mini"] as {
    inputUsdPerMillion: number;
    outputUsdPerMillion: number;
  };
  const originalRates = {
    anthropicInput: anthropicPricing.inputUsdPerMillion,
    anthropicOutput: anthropicPricing.outputUsdPerMillion,
    openAiInput: openAiPricing.inputUsdPerMillion,
    openAiOutput: openAiPricing.outputUsdPerMillion,
  };

  try {
    const baseline = await getDashboardSummary(baseUrl);
    const videos = await db.insert(videosTable).values([
      {
        filename: "historical-success.mp4",
        fileHash: successfulHash,
        status: "HOTOVO",
      },
      {
        filename: "historical-partial.mp4",
        fileHash: partialHash,
        status: "HOTOVO",
      },
    ]).returning({ id: videosTable.id });
    insertedVideoIds.push(...videos.map(({ id }) => id));

    const [successfulAnalysis] = await db.insert(aiAnalysisTable).values({
      videoId: videos[0].id,
      promptVersion: "historical-price-test",
      finalniStatus: "POTVRZENO",
      retryCount: 0,
    }).returning({ id: aiAnalysisTable.id });
    const [partialAnalysis] = await db.insert(aiAnalysisTable).values({
      videoId: videos[1].id,
      promptVersion: "historical-price-test",
      finalniStatus: "CHYBA_API",
      retryCount: 0,
      apiError: "Verifier nedokončil analýzu.",
    }).returning({ id: aiAnalysisTable.id });

    const historicalCosts = [0.123456, 0.234567, 0.345678];
    await db.insert(costLogTable).values([
      {
        aiAnalysisId: successfulAnalysis.id,
        agentType: "INTERPRET",
        inputTokens: 1_000,
        outputTokens: 100,
        costUsd: historicalCosts[0],
      },
      {
        aiAnalysisId: successfulAnalysis.id,
        agentType: "VERIFIER",
        inputTokens: 2_000,
        outputTokens: 200,
        costUsd: historicalCosts[1],
      },
      {
        aiAnalysisId: partialAnalysis.id,
        agentType: "INTERPRET",
        inputTokens: 3_000,
        outputTokens: 300,
        costUsd: historicalCosts[2],
      },
    ]);

    const beforeRateChange = await getDashboardSummary(baseUrl);
    const expectedIncrease = Number(historicalCosts.reduce((sum, cost) => sum + cost, 0).toFixed(6));
    assert.equal(
      Number((beforeRateChange.monthlyCostUsd - baseline.monthlyCostUsd).toFixed(6)),
      expectedIncrease,
    );

    anthropicPricing.inputUsdPerMillion = 300;
    anthropicPricing.outputUsdPerMillion = 1_500;
    openAiPricing.inputUsdPerMillion = 25;
    openAiPricing.outputUsdPerMillion = 200;

    const afterRateChange = await getDashboardSummary(baseUrl);
    assert.equal(afterRateChange.monthlyCostUsd, beforeRateChange.monthlyCostUsd);
  } finally {
    anthropicPricing.inputUsdPerMillion = originalRates.anthropicInput;
    anthropicPricing.outputUsdPerMillion = originalRates.anthropicOutput;
    openAiPricing.inputUsdPerMillion = originalRates.openAiInput;
    openAiPricing.outputUsdPerMillion = originalRates.openAiOutput;
    if (insertedVideoIds.length) {
      await db.delete(videosTable).where(inArray(videosTable.id, insertedVideoIds));
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("měsíční součet přechází na nový měsíc přesně o půlnoci UTC", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const fileHash = `cost-month-boundary-${randomUUID()}`;
  let insertedVideoId: number | undefined;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const justBeforeMonthStart = new Date(monthStart.getTime() - 1);
  const previousMonthCost = 0.111111;
  const currentMonthCost = 0.222222;

  try {
    const baseline = await getDashboardSummary(baseUrl);
    const [video] = await db.insert(videosTable).values({
      filename: "month-boundary.mp4",
      fileHash,
      status: "HOTOVO",
    }).returning({ id: videosTable.id });
    insertedVideoId = video.id;

    const [analysis] = await db.insert(aiAnalysisTable).values({
      videoId: video.id,
      promptVersion: "month-boundary-test",
      finalniStatus: "POTVRZENO",
      retryCount: 0,
    }).returning({ id: aiAnalysisTable.id });

    await db.insert(costLogTable).values([
      {
        aiAnalysisId: analysis.id,
        agentType: "INTERPRET",
        inputTokens: 1,
        outputTokens: 1,
        costUsd: previousMonthCost,
        createdAt: justBeforeMonthStart,
      },
      {
        aiAnalysisId: analysis.id,
        agentType: "VERIFIER",
        inputTokens: 1,
        outputTokens: 1,
        costUsd: currentMonthCost,
        createdAt: monthStart,
      },
    ]);

    const summary = await getDashboardSummary(baseUrl);
    assert.equal(
      Number((summary.monthlyCostUsd - baseline.monthlyCostUsd).toFixed(6)),
      currentMonthCost,
    );
  } finally {
    if (insertedVideoId !== undefined) {
      await db.delete(videosTable).where(inArray(videosTable.id, [insertedVideoId]));
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test.after(async () => {
  await pool.end();
});