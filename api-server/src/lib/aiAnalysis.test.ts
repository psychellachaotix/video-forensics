import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  AiAnalysisError,
  AI_MODEL_CONFIGS,
  deriveVerifiedAiVerdict,
  getPricingFreshness,
  hasSufficientEvidence,
  runDualAiAnalysis,
} from "./aiAnalysis.ts";

test("cenová konfigurace uvádí datum ověření a veřejný zdroj", () => {
  for (const providerConfigs of Object.values(AI_MODEL_CONFIGS)) {
    for (const config of Object.values(providerConfigs)) {
      assert.match(config.pricingVerifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(config.pricingSource, /^https:\/\//);
    }
  }
});

test("kontrola ceny překročí limit až po celém zvoleném stáří", () => {
  const config = AI_MODEL_CONFIGS.OpenAI["gpt-5-mini"];
  assert.equal(getPricingFreshness(config, new Date("2026-12-10T23:59:59Z"), 90).stale, false);
  const stale = getPricingFreshness(config, new Date("2026-12-11T00:00:00Z"), 90);
  assert.equal(stale.stale, true);
  assert.equal(stale.ageDays, 91);
  assert.equal(stale.source, config.pricingSource);
});

test("finální AI verdikt vyžaduje potvrzení Verifieru", () => {
  const base = {
    promptVersion: "test",
    interpret: { result: { verdikt: "UPRAVENO_AI", jistota_procenta: 84 }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 }, retries: 0 },
    verifier: { result: { finalni_status: "SPORNE", upravena_jistota_procenta: 41 }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 }, retries: 0 },
  };
  assert.deepEqual(deriveVerifiedAiVerdict(base), { verdict: "NEJASNE", confidence: 0 });
  base.verifier.result.finalni_status = "NEJISTE";
  assert.deepEqual(deriveVerifiedAiVerdict(base), { verdict: "NEJASNE", confidence: 0 });
  base.verifier.result.finalni_status = "POTVRZENO";
  assert.deepEqual(deriveVerifiedAiVerdict(base), { verdict: "UPRAVENO_AI", confidence: 41 });
});

const originalFetch = globalThis.fetch;
const originalKey = process.env.ANTHROPIC_API_KEY;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalAnthropicIntegrationKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const originalAnthropicBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const originalAnthropicModel = process.env.ANTHROPIC_MODEL;
const originalOpenAiModel = process.env.OPENAI_MODEL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
  if (originalAnthropicIntegrationKey === undefined) delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  else process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = originalAnthropicIntegrationKey;
  if (originalAnthropicBaseUrl === undefined) delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  else process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = originalAnthropicBaseUrl;
  if (originalAnthropicModel === undefined) delete process.env.ANTHROPIC_MODEL;
  else process.env.ANTHROPIC_MODEL = originalAnthropicModel;
  if (originalOpenAiModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = originalOpenAiModel;
});

function response(result: Record<string, unknown>, input = 100, output = 20) {
  return new Response(JSON.stringify({
    content: [{ type: "text", text: JSON.stringify(result) }],
    usage: { input_tokens: input, output_tokens: output },
  }), { status: 200 });
}

function openAiResponse(result: Record<string, unknown>, input = 100, output = 20) {
  return new Response(JSON.stringify({
    choices: [{ message: { role: "assistant", content: JSON.stringify(result) } }],
    usage: { prompt_tokens: input, completion_tokens: output },
  }), { status: 200 });
}

const interpret = {
  verdikt: "ORIGINAL",
  jistota_procenta: 75,
  typ_manipulace: [],
  casove_useky: [],
  zduvodneni: "Nálezy se shodují.",
  nejasnosti: "",
};

const verifier = {
  shoda_s_analytikem: true,
  upravena_jistota_procenta: 72,
  rozpory: [],
  potvrzena_zjisteni: ["Metadata"],
  finalni_status: "POTVRZENO",
  komentar: "Závěr je podložen.",
};

test("použije OpenAI chat completions s JSON režimem a načte usage", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  process.env.OPENAI_API_KEY = "openai-test";
  const requests: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init: init ?? {} });
    return requests.length === 1
      ? openAiResponse(interpret, 111, 21)
      : openAiResponse(verifier, 122, 22);
  };

  const result = await runDualAiAnalysis({ metadata: { status: "OK" } });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal((requests[0].init.headers as Record<string, string>).authorization, "Bearer openai-test");
  const body = JSON.parse(String(requests[0].init.body)) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    response_format: { type: string };
  };
  assert.equal(body.model, "gpt-5-mini");
  assert.deepEqual(body.messages.map((message) => message.role), ["system", "user"]);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(result.interpret.usage.inputTokens, 111);
  assert.equal(result.verifier.usage.outputTokens, 22);
});

test("spustí Interpret a Verifier odděleně a vrátí usage obou", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  const calls: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { system: string };
    calls.push(body.system);
    return calls.length === 1 ? response(interpret) : response(verifier, 120, 25);
  };
  const result = await runDualAiAnalysis({ metadata: { status: "OK" } });
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0], calls[1]);
  assert.equal(result.interpret.usage.inputTokens, 100);
  assert.equal(result.verifier.usage.inputTokens, 120);
  assert.equal(result.verifier.result.finalni_status, "POTVRZENO");
  assert.equal(result.interpret.usage.costUsd, 0.0006);
});

test("odmítne neznámý Anthropic model před voláním API", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  process.env.ANTHROPIC_MODEL = "claude-neznamy";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response(interpret);
  };

  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError &&
      /nemá ověřenou konfiguraci cen/.test(error.message),
  );
  assert.equal(calls, 0);
});

test("odmítne neznámý OpenAI model před voláním API", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  process.env.OPENAI_API_KEY = "openai-test";
  process.env.OPENAI_MODEL = "gpt-neznamy";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return openAiResponse(interpret);
  };

  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError &&
      /nemá ověřenou konfiguraci cen/.test(error.message),
  );
  assert.equal(calls, 0);
});

test("přijme všechny čtyři klasifikační třídy videa", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  const verdicts = ["ORIGINAL", "UPRAVENO", "UPRAVENO_AI", "CELE_AI"] as const;
  for (const verdikt of verdicts) {
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
      calls += 1;
      const system = String((JSON.parse(String(init?.body)) as { system: string }).system);
      assert.match(system, /UPRAVENO_AI/);
      return calls === 1
        ? response({ ...interpret, verdikt })
        : response(verifier);
    };
    const result = await runDualAiAnalysis({ metadata: { status: "OK" } });
    assert.equal(result.interpret.result.verdict, verdikt);
  }
});

test("video prompt obsahuje rozlišovací rubriku a limity AI důkazů", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  const systems: string[] = [];
  globalThis.fetch = async (_input, init) => {
    systems.push(String((JSON.parse(String(init?.body)) as { system: string }).system));
    return systems.length === 1 ? response(interpret) : response(verifier);
  };
  await runDualAiAnalysis({ metadata: { status: "OK" } });
  assert.match(systems[0], /NLE/);
  assert.match(systems[0], /Forenzní analyzátor videí/);
  assert.match(systems[0], /NEDOSTUPNE výsledky nejsou důkazem/);
  assert.match(systems[0], /inpainting/);
  assert.match(systems[0], /re-export.*není důkaz AI/s);
  assert.match(systems[0], /více nezávislých konvergentních signálů/s);
  assert.match(systems[1], /audituj vybranou třídu proti alternativám/);
  assert.match(systems[1], /Forenzní ověřovatel videí/);
  assert.match(systems[1], /Neprováděj vlastní novou analýzu od nuly/);
  assert.match(systems[1], /podezřelé časové úseky/);
  assert.match(systems[1], /materiálně odporují/);
});

test("pro obrázek používá obrazové prompty a přijímá podezřelé oblasti", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  const systems: string[] = [];
  globalThis.fetch = async (_input, init) => {
    systems.push((JSON.parse(String(init?.body)) as { system: string }).system);
    return systems.length === 1
      ? response({ ...interpret, casove_useky: undefined, podezrele_oblasti: ["střed: ELA"] })
      : response(verifier);
  };
  const result = await runDualAiAnalysis({ ela: { status: "OK" } }, "obrazek");
  assert.match(systems[0], /statických obrázků/);
  assert.match(systems[1], /statických obrázků/);
  assert.deepEqual(result.interpret.result.podezrele_oblasti, ["střed: ELA"]);
});

test("rate limit vyčerpá právě dva retry pokusy", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("rate limited", { status: 429 });
  };
  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError && error.retries === 2,
  );
  assert.equal(calls, 3);
});

test("selhání Verifieru zachová dokončený Interpret a jeho usage", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1 ? response(interpret, 101, 21) : new Response("bad gateway", { status: 502 });
  };
  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError &&
      error.completedInterpret?.usage.inputTokens === 101 &&
      error.completedVerifier === undefined,
  );
  assert.equal(calls, 4);
});

test("neplatný status Verifieru zachová usage obou účtovaných volání", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? response(interpret, 102, 22)
      : response({ ...verifier, finalni_status: "NEPLATNY" }, 202, 42);
  };
  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError &&
      error.completedInterpret?.usage.inputTokens === 102 &&
      error.completedVerifier?.usage.inputTokens === 202,
  );
  assert.equal(calls, 2);
});

test("Verifier nemůže potvrdit výsledek, pokud hlásí neshodu", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? response(interpret, 103, 23)
      : response({
          ...verifier,
          shoda_s_analytikem: false,
          rozpory: ["Závěr není podložen."],
          finalni_status: "POTVRZENO",
        }, 203, 43);
  };
  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError &&
      error.completedVerifier?.usage.inputTokens === 203 &&
      /navzdory neshodě/.test(error.message),
  );
  assert.equal(calls, 2);
});

test("Verifier s textovou jistotou skončí kontrolovanou chybou a zachová usage", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? response(interpret, 104, 24)
      : response({ ...verifier, upravena_jistota_procenta: "72" }, 204, 44);
  };
  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError &&
      error.completedInterpret?.usage.inputTokens === 104 &&
      error.completedVerifier?.usage.inputTokens === 204 &&
      /neúplný nebo neplatný/.test(error.message),
  );
  assert.equal(calls, 2);
});

test("Interpret vyžaduje všechna pole svého JSON kontraktu", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  globalThis.fetch = async () => response({
    verdikt: "ORIGINAL",
    jistota_procenta: 50,
  }, 105, 25);
  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError &&
      error.completedInterpret?.usage.inputTokens === 105 &&
      /neúplný nebo neplatný/.test(error.message),
  );
});

test("desetinná jistota je odmítnuta před uložením výsledku", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  globalThis.fetch = async () => response({
    ...interpret,
    jistota_procenta: 72.5,
  }, 106, 26);
  await assert.rejects(
    runDualAiAnalysis({}),
    (error: unknown) => error instanceof AiAnalysisError &&
      error.completedInterpret?.usage.inputTokens === 106 &&
      /neplatnou jistotu/.test(error.message),
  );
});

test("více než polovina nedostupných kroků není dostatek pro placenou AI", () => {
  assert.equal(hasSufficientEvidence([
    { stepStatus: "OK" },
    { stepStatus: "OK" },
    { stepStatus: "NEDOSTUPNE" },
    { stepStatus: "NEDOSTUPNE" },
    { stepStatus: "NEDOSTUPNE" },
    { stepStatus: "NEDOSTUPNE" },
  ]), false);
  assert.equal(hasSufficientEvidence([
    { stepStatus: "OK" },
    { stepStatus: "OK" },
    { stepStatus: "OK" },
    { stepStatus: "NEDOSTUPNE" },
    { stepStatus: "NEDOSTUPNE" },
    { stepStatus: "NEDOSTUPNE" },
  ]), true);
});