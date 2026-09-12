import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
  aiAnalysisTable,
  db,
  pool,
  rawAnalysisTable,
  videosTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import app from "../app.ts";
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
    await db.insert(aiAnalysisTable).values({
      videoId,
      promptVersion: "integration-test",
      finalniStatus: "CHYBA_API",
      apiError: "Interpret ani Verifier nedokončil analýzu.",
      retryCount: 2,
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
    await db.insert(aiAnalysisTable).values({
      videoId,
      promptVersion: "integration-test-success",
      interpretResultJson: interpret,
      verifierResultJson: verifier,
      finalniStatus: "POTVRZENO",
      retryCount: 0,
      apiError: null,
    });
    const [latest] = await db.select().from(aiAnalysisTable)
      .where(eq(aiAnalysisTable.videoId, videoId))
      .orderBy(desc(aiAnalysisTable.createdAt))
      .limit(1);
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

test.after(async () => {
  await pool.end();
});