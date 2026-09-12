import { AI_MODEL_CONFIGS, getSelectedProvider } from "./aiAnalysis.ts";

export type ProviderFailureCode =
  | "insufficient_quota"
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "invalid_response"
  | "not_configured"
  | "unknown";

export function classifyAiError(error: unknown): ProviderFailureCode {
  const text = String(error ?? "").toLowerCase();
  if (/insufficient_quota|credit_balance_exhausted|quota|billing|payment_required/.test(text)) return "insufficient_quota";
  if (/unauthori[sz]|invalid.*(api|key)|authentication|forbidden|401|403/.test(text)) return "authentication";
  if (/rate.?limit|429|too many requests/.test(text)) return "rate_limit";
  if (/timeout|timed out|abort|deadline/.test(text)) return "timeout";
  if (/invalid.*json|nevrátilo text|invalid response/.test(text)) return "invalid_response";
  if (/upstream|network|fetch|socket|connection|5\d\d/.test(text)) return "upstream";
  return "unknown";
}

type UsageRow = {
  createdAt: Date;
  apiError: string | null;
  verifierInputTokens: number | null;
  verifierOutputTokens: number | null;
  verifierCostUsd: number | null;
  interpretInputTokens: number | null;
  interpretOutputTokens: number | null;
  interpretCostUsd: number | null;
  verifierResultJson: unknown;
};

type TokenRange = { low: number; typical: number; high: number };
export type AgentEstimate = { inputTokens: TokenRange; outputTokens: TokenRange; usd: { low: number; typical: number; high: number } };

const DEFAULTS: Record<"INTERPRET" | "VERIFIER", { input: TokenRange; output: TokenRange }> = {
  INTERPRET: { input: { low: 2200, typical: 4500, high: 9000 }, output: { low: 300, typical: 900, high: 1800 } },
  VERIFIER: { input: { low: 3000, typical: 6000, high: 11000 }, output: { low: 180, typical: 500, high: 1200 } },
};

function rangeFrom(values: number[], fallback: TokenRange): TokenRange {
  if (!values.length) return fallback;
  const typical = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { low: Math.max(1, Math.round(typical * 0.75)), typical, high: Math.max(typical, Math.round(typical * 1.35)) };
}

function price(tokens: TokenRange, inputUsdPerMillion: number, outputUsdPerMillion: number, output: TokenRange) {
  return {
    low: Number(((tokens.low * inputUsdPerMillion + output.low * outputUsdPerMillion) / 1_000_000).toFixed(6)),
    typical: Number(((tokens.typical * inputUsdPerMillion + output.typical * outputUsdPerMillion) / 1_000_000).toFixed(6)),
    high: Number(((tokens.high * inputUsdPerMillion + output.high * outputUsdPerMillion) / 1_000_000).toFixed(6)),
  };
}

export function estimateCosts(rows: UsageRow[]) {
  const selected = getSelectedProvider();
  const config = (AI_MODEL_CONFIGS[selected.provider] as Record<string, typeof AI_MODEL_CONFIGS.Anthropic["claude-sonnet-4-6"]>)[selected.model];
  // Unknown models cannot be priced safely; return zeroed estimates rather than inventing a rate.
  const pricing = config ?? { inputUsdPerMillion: 0, outputUsdPerMillion: 0 };
  const i = rows.filter((r) => r.apiError == null && (r.interpretInputTokens ?? 0) > 0);
  const v = rows.filter((r) => r.apiError == null && (r.verifierInputTokens ?? 0) > 0);
  const interpret = {
    inputTokens: rangeFrom(i.map((r) => r.interpretInputTokens!), DEFAULTS.INTERPRET.input),
    outputTokens: rangeFrom(i.map((r) => r.interpretOutputTokens ?? 0), DEFAULTS.INTERPRET.output),
  };
  const verifier = {
    inputTokens: rangeFrom(v.map((r) => r.verifierInputTokens!), DEFAULTS.VERIFIER.input),
    outputTokens: rangeFrom(v.map((r) => r.verifierOutputTokens ?? 0), DEFAULTS.VERIFIER.output),
  };
  const interpretEstimate: AgentEstimate = { ...interpret, usd: price(interpret.inputTokens, pricing.inputUsdPerMillion, pricing.outputUsdPerMillion, interpret.outputTokens) };
  const verifierEstimate: AgentEstimate = { ...verifier, usd: price(verifier.inputTokens, pricing.inputUsdPerMillion, pricing.outputUsdPerMillion, verifier.outputTokens) };
  return {
    basis: i.length || v.length ? "historical" as const : "default" as const,
    disclaimer: "Estimate only; actual findings, tokenization, and provider billing may differ.",
    interpret: interpretEstimate,
    verifier: verifierEstimate,
    total: {
      inputTokens: { low: interpret.inputTokens.low + verifier.inputTokens.low, typical: interpret.inputTokens.typical + verifier.inputTokens.typical, high: interpret.inputTokens.high + verifier.inputTokens.high },
      outputTokens: { low: interpret.outputTokens.low + verifier.outputTokens.low, typical: interpret.outputTokens.typical + verifier.outputTokens.typical, high: interpret.outputTokens.high + verifier.outputTokens.high },
      usd: {
        low: Number((interpretEstimate.usd.low + verifierEstimate.usd.low).toFixed(6)),
        typical: Number((interpretEstimate.usd.typical + verifierEstimate.usd.typical).toFixed(6)),
        high: Number((interpretEstimate.usd.high + verifierEstimate.usd.high).toFixed(6)),
      },
    },
  };
}

export function buildProviderStatus(rows: UsageRow[]) {
  const selected = getSelectedProvider();
  const failures = rows.filter((r) => r.apiError).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const successes = rows.filter((r) => r.verifierResultJson != null && !r.apiError).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latestFailure = failures[0];
  const code = latestFailure ? classifyAiError(latestFailure.apiError) : undefined;
  const state = !selected.configured
    ? "not_configured"
    : code === "insufficient_quota" || code === "authentication"
      ? "blocked"
      : latestFailure && (!successes[0] || latestFailure.createdAt > successes[0].createdAt) ? "degraded"
        : successes.length ? "ready" : "unknown";
  return {
    provider: selected.provider,
    model: selected.model,
    configured: selected.configured,
    state,
    creditStatus: successes.length && (!latestFailure || successes[0].createdAt >= latestFailure.createdAt)
      ? "available"
      : code === "insufficient_quota" ? "exhausted" : "unknown",
    lastChecked: new Date().toISOString(),
    lastSuccess: successes[0]?.createdAt.toISOString() ?? null,
    lastFailure: latestFailure?.createdAt.toISOString() ?? null,
    failureCode: code ?? (selected.configured ? null : "not_configured"),
    costEstimate: estimateCosts(rows),
  };
}