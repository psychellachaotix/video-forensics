import https from "node:https";
import type { AiUsage, AgentResult, ResultClass, VerifierResult } from "../shared/types.js";

interface MessageResponse { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number }; model?: string; }

function request(key: string, prompt: string, system: string, model: string): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, max_tokens: 1800, temperature: 0, system, messages: [{ role: "user", content: prompt }] });
    const req = https.request({
      hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "content-length": Buffer.byteLength(body) },
    }, (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { raw += chunk; });
      response.once("end", () => {
        try {
          const parsed = JSON.parse(raw) as MessageResponse & { error?: { message?: string } };
          if ((response.statusCode ?? 500) >= 400) reject(new Error(parsed.error?.message || `Anthropic HTTP ${response.statusCode}`));
          else resolve(parsed);
        } catch { reject(new Error("Anthropic vrátil neplatnou odpověď.")); }
      });
    });
    req.once("error", reject);
    req.write(body);
    req.end();
  });
}

function textOf(response: MessageResponse): string {
  return response.content?.map((part) => part.text ?? "").join("") ?? "";
}

function jsonOf(text: string): Record<string, unknown> {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0; let quoted = false; let escaped = false;
    for (let cursor = start; cursor < text.length; cursor += 1) {
      const char = text[cursor];
      if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === "\"") quoted = false; continue; }
      if (char === "\"") quoted = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) {
        try {
          const value: unknown = JSON.parse(text.slice(start, cursor + 1));
          if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
        } catch { /* try the next balanced object */ }
        break;
      }
    }
  }
  throw new Error("AI odpověď neobsahuje validní JSON objekt.");
}

function asStrings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 30 || value.some((item) => typeof item !== "string" || item.length > 2000)) throw new Error(`AI pole ${label} je neplatné.`);
  return value as string[];
}

export async function runInterpret(key: string, evidence: unknown, model: string): Promise<{ result: AgentResult; usage: AiUsage }> {
  const response = await request(key, JSON.stringify(evidence), "Jsi forenzní analytik. Vrať pouze JSON s klíči verdict (ORIGINAL, UPRAVENO, UPRAVENO_AI, CELE_AI nebo NEURCENO), confidence (0-100), reasoning, uncertainties a manipulationTypes (pole). Rozlišuj důkaz od hypotézy.", model);
  const parsed = jsonOf(textOf(response));
  const inputTokens = response.usage?.input_tokens ?? 0; const outputTokens = response.usage?.output_tokens ?? 0;
  const verdict = parsed.verdict;
  const classes: ResultClass[] = ["ORIGINAL", "UPRAVENO", "UPRAVENO_AI", "CELE_AI", "NEURCENO"];
  if (!classes.includes(verdict as ResultClass) || typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) throw new Error("Interpret vrátil neplatný verdict nebo confidence (očekává se 0–1).");
  if (typeof parsed.reasoning !== "string" || parsed.reasoning.length > 10000 || typeof parsed.uncertainties !== "string" || parsed.uncertainties.length > 10000) throw new Error("Interpret vrátil neplatné textové pole.");
  return { result: { verdict: verdict as ResultClass, confidence: parsed.confidence, reasoning: parsed.reasoning, uncertainties: parsed.uncertainties, manipulationTypes: asStrings(parsed.manipulationTypes, "manipulationTypes"), raw: textOf(response) }, usage: usageFor(response, inputTokens, outputTokens) };
}

export async function runVerifier(key: string, evidence: unknown, interpretation: AgentResult, model: string): Promise<{ result: VerifierResult; usage: AiUsage }> {
  const response = await request(key, JSON.stringify({ evidence, interpretation }), "Jsi nezávislý verifier. Vrať pouze JSON s klíči finalStatus (POTVRZENO, SPORNE, NEURCENO nebo CHYBA_API), agreesWithInterpret, confirmedFindings, contradictions a comment. Buď konzervativní.", model);
  const parsed = jsonOf(textOf(response));
  const inputTokens = response.usage?.input_tokens ?? 0; const outputTokens = response.usage?.output_tokens ?? 0;
  if (!["POTVRZENO", "SPORNE", "NEURCENO", "CHYBA_API"].includes(parsed.finalStatus as string) || typeof parsed.agreesWithInterpret !== "boolean" || typeof parsed.comment !== "string" || parsed.comment.length > 10000) throw new Error("Verifier vrátil neplatný status, boolean nebo komentář.");
  return { result: { finalStatus: parsed.finalStatus as VerifierResult["finalStatus"], agreesWithInterpret: parsed.agreesWithInterpret, confirmedFindings: asStrings(parsed.confirmedFindings, "confirmedFindings"), contradictions: asStrings(parsed.contradictions, "contradictions"), comment: parsed.comment, raw: textOf(response) }, usage: usageFor(response, inputTokens, outputTokens) };
}

function usageFor(response: MessageResponse, inputTokens: number, outputTokens: number): AiUsage {
  const actualModel = response.model || "unknown";
  const prices: Record<string, [number, number]> = {
    "claude-3-5-sonnet-20241022": [0.000003, 0.000015],
    "claude-3-5-sonnet-20240620": [0.000003, 0.000015],
    "claude-3-5-haiku-20241022": [0.0000008, 0.000004],
    "claude-3-haiku-20240307": [0.00000025, 0.00000125],
  };
  const price = prices[actualModel];
  return { inputTokens, outputTokens, model: actualModel, estimatedCostUsd: price ? inputTokens * price[0] + outputTokens * price[1] : null };
}