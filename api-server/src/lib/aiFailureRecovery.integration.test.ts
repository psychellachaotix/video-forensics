import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
  aiAnalysisTable,
  costLogTable,
  db,
  pool,
  rawAnalysisTable,
  videosTable,
} from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import app from "../app.ts";
import { analysisRuntime } from "../routes/analyses.ts";
import { AiAnalysisError, runDualAiAnalysis } from "./aiAnalysis.ts";

const originalFetch = globalThis.fetch;
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

const interpret = {
  verdikt: "UPRAVENO",
  jistota_procenta: 81,
  verdict: "UPRAVENO",
  confidence: 81,
  typ_manipulace: ["střih"],
  casove_useky: ["00:01–00:02"],
  zduvodneni: "Technické nálezy ukazují střih.",
  nejasnosti: "",
};

const verifier = {
  shoda_s_analytikem: true,
  upravena_jistota_procenta: 77,
  rozpory: [],
  potvrzena_zjisteni: ["Nespojitost snímků"],
  finalni_status: "POTVRZENO",
  komentar: "Závěr je potvrzen.",
};

function anthropicResponse(result: Record<string, unknown>) {
  return new Response(JSON.stringify({
    content: [{ type: "text", text: JSON.stringify(result) }],
    usage: { input_tokens: 100, output_tokens: 20 },
  }), { status: 200 });
}

async function expectAiFailure(failAgent: "INTERPRET" | "VERIFIER") {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (failAgent === "VERIFIER" && calls === 1) return anthropicResponse(interpret);
    return new Response("bad gateway", { status: 502 });
  };
  await assert.rejects(
    runDualAiAnalysis({ metadata: { status: "OK" } }),
    (error: unknown) => error instanceof AiAnalysisError && error.agent === failAgent,
  );
}

test("chyby AI zachovají technické nálezy při opakování a Verifier určuje úspěšný výsledek", async () => {
  process.env.ANTHROPIC_API_KEY = "integration-test";
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  let videoId: number | undefined;

  try {
    await expectAiFailure("INTERPRET");
    await expectAiFailure("VERIFIER");
    globalThis.fetch = originalFetch;

    const [video] = await db.insert(videosTable).values({
      filename: "ai-failure-recovery.mp4",
      fileHash: `ai-failure-recovery-${randomUUID()}`,
      status: "HOTOVO",
      originalPath: `/test/${randomUUID()}.mp4`,
      mediaType: "video",
    }).returning();
    videoId = video.id;

    await db.insert(rawAnalysisTable).values([
      {
        videoId,
        stepName: "metadata",
        stepStatus: "OK",
        resultJson: { title: "Metadata", detail: "Metadata byla zachována.", severity: "low" },
      },
      {
        videoId,
        stepName: "frame_analysis",
        stepStatus: "OK",
        resultJson: { title: "Nespojitost snímků", detail: "Nález před voláním AI.", severity: "medium" },
      },
    ]);
    const sharedCreatedAt = new Date("2026-01-02T03:04:05.000Z");
    await db.insert(aiAnalysisTable).values({
      videoId,
      promptVersion: "integration-test",
      finalniStatus: "CHYBA_API",
      apiError: "Interpret ani Verifier nedokončil analýzu.",
      retryCount: 2,
      createdAt: sharedCreatedAt,
    });

    const failedResponse = await fetch(`${baseUrl}/api/analyses/${videoId}`);
    assert.equal(failedResponse.status, 200);
    const failed = await failedResponse.json() as {
      status: string;
      finalStatus: string;
      evidence: Array<{ title: string }>;
    };
    assert.equal(failed.status, "failed");
    assert.equal(failed.finalStatus, "CHYBA_API");
    assert.ok(failed.evidence.some(({ title }) => title === "Nespojitost snímků"));

    const retryResponse = await fetch(`${baseUrl}/api/analyses/${videoId}/reanalyze`, { method: "POST" });
    assert.equal(retryResponse.status, 200);
    const retry = await retryResponse.json() as {
      status: string;
      evidence: Array<{ title: string }>;
    };
    assert.equal(retry.status, "analyzing");
    assert.ok(retry.evidence.some(({ title }) => title === "Nespojitost snímků"));

    await db.update(videosTable).set({ status: "HOTOVO" }).where(eq(videosTable.id, videoId));
    const [successfulAttempt] = await db.insert(aiAnalysisTable).values({
      videoId,
      promptVersion: "integration-test-success",
      interpretResultJson: interpret,
      verifierResultJson: verifier,
      finalniStatus: "POTVRZENO",
      retryCount: 0,
      apiError: null,
      createdAt: sharedCreatedAt,
    }).returning();
    const [latest] = await db.select().from(aiAnalysisTable)
      .where(eq(aiAnalysisTable.videoId, videoId))
      .orderBy(desc(aiAnalysisTable.createdAt), desc(aiAnalysisTable.id))
      .limit(1);
    assert.equal(latest.id, successfulAttempt.id);
    assert.equal(latest.verifierResultJson && (latest.verifierResultJson as typeof verifier).finalni_status, "POTVRZENO");

    const successfulResponse = await fetch(`${baseUrl}/api/analyses/${videoId}`);
    const successful = await successfulResponse.json() as {
      status: string;
      finalStatus: string;
      verdict: string;
      confidence: number;
    };
    assert.equal(successful.status, "complete");
    assert.equal(successful.finalStatus, "POTVRZENO");
    assert.equal(successful.verdict, "UPRAVENO");
    assert.equal(successful.confidence, 77);

    const listResponse = await fetch(`${baseUrl}/api/analyses`);
    assert.equal(listResponse.status, 200);
    const listed = await listResponse.json() as Array<{
      id: number;
      finalStatus: string;
      verdict: string;
    }>;
    const listedAnalysis = listed.find(({ id }) => id === videoId);
    assert.equal(listedAnalysis?.finalStatus, "POTVRZENO");
    assert.equal(listedAnalysis?.verdict, "UPRAVENO");

    const verdictResponse = await fetch(`${baseUrl}/api/analyses/${videoId}/verdict`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ verdict: "ORIGINAL" }),
    });
    assert.equal(verdictResponse.status, 200);
    const attempts = await db.select({
      id: aiAnalysisTable.id,
      manualVerdict: aiAnalysisTable.manualniVerdikt,
    }).from(aiAnalysisTable)
      .where(eq(aiAnalysisTable.videoId, videoId))
      .orderBy(desc(aiAnalysisTable.id));
    assert.equal(attempts[0]?.id, successfulAttempt.id);
    assert.equal(attempts[0]?.manualVerdict, "ORIGINAL");
    assert.equal(attempts[1]?.manualVerdict, null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    if (videoId !== undefined) {
      await db.delete(videosTable).where(eq(videosTable.id, videoId));
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("dva souběžné požadavky na opakování spustí a zaúčtují jen jednu AI analýzu", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const originalInspectVideo = analysisRuntime.inspectVideo;
  let videoId: number | undefined;
  let processingStarts = 0;
  let processingFinished: Promise<void> | undefined;

  try {
    const [video] = await db.insert(videosTable).values({
      filename: "concurrent-reanalysis.mp4",
      fileHash: `concurrent-reanalysis-${randomUUID()}`,
      status: "HOTOVO",
      originalPath: `/test/${randomUUID()}.mp4`,
      mediaType: "video",
    }).returning();
    videoId = video.id;
    await db.insert(rawAnalysisTable).values({
      videoId,
      stepName: "metadata",
      stepStatus: "OK",
      resultJson: { title: "Metadata", detail: "Zachovaný technický nález.", severity: "low" },
    });

    analysisRuntime.inspectVideo = async (claimedVideo) => {
      processingStarts += 1;
      processingFinished = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        await db.transaction(async (tx) => {
          const [saved] = await tx.insert(aiAnalysisTable).values({
            videoId: claimedVideo.id,
            promptVersion: "concurrent-reanalysis-test",
            interpretResultJson: interpret,
            interpretInputTokens: 100,
            interpretOutputTokens: 20,
            interpretCostUsd: 0.001,
            verifierResultJson: verifier,
            verifierInputTokens: 100,
            verifierOutputTokens: 20,
            verifierCostUsd: 0.002,
            finalniStatus: "POTVRZENO",
            retryCount: 0,
          }).returning({ id: aiAnalysisTable.id });
          await tx.insert(costLogTable).values([
            { aiAnalysisId: saved.id, agentType: "INTERPRET", inputTokens: 100, outputTokens: 20, costUsd: 0.001 },
            { aiAnalysisId: saved.id, agentType: "VERIFIER", inputTokens: 100, outputTokens: 20, costUsd: 0.002 },
          ]);
          await tx.update(videosTable).set({ status: "HOTOVO" }).where(eq(videosTable.id, claimedVideo.id));
        });
      })();
      await processingFinished;
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/analyses/${videoId}/reanalyze`, { method: "POST" }),
      fetch(`${baseUrl}/api/analyses/${videoId}/reanalyze`, { method: "POST" }),
    ]);
    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    const [first, second] = await Promise.all([
      firstResponse.json() as Promise<{ id: number; status: string; evidence: Array<{ title: string }> }>,
      secondResponse.json() as Promise<{ id: number; status: string; evidence: Array<{ title: string }> }>,
    ]);
    assert.deepEqual(first, second);
    assert.equal(first.id, videoId);
    assert.equal(first.status, "analyzing");
    assert.ok(first.evidence.some(({ title }) => title === "Metadata"));

    assert.equal(processingStarts, 1);
    await processingFinished;

    const newAnalyses = await db.select({ id: aiAnalysisTable.id })
      .from(aiAnalysisTable)
      .where(eq(aiAnalysisTable.videoId, videoId));
    assert.equal(newAnalyses.length, 1);
    const costs = await db.select()
      .from(costLogTable)
      .where(inArray(costLogTable.aiAnalysisId, newAnalyses.map(({ id }) => id)));
    assert.equal(costs.length, 2);
    assert.deepEqual(new Set(costs.map(({ agentType }) => agentType)), new Set(["INTERPRET", "VERIFIER"]));
  } finally {
    analysisRuntime.inspectVideo = originalInspectVideo;
    if (processingFinished) await processingFinished.catch(() => undefined);
    if (videoId !== undefined) {
      await db.delete(videosTable).where(eq(videosTable.id, videoId));
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test.after(async () => {
  await pool.end();
});