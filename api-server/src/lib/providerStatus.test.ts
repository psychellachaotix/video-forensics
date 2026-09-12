import assert from "node:assert/strict";
import test from "node:test";
import { buildProviderStatus, classifyAiError, estimateCosts } from "./providerStatus.ts";

test("classifies provider failures without exposing response bodies", () => {
  assert.equal(classifyAiError("provider returned insufficient_quota"), "insufficient_quota");
  assert.equal(classifyAiError("401 Unauthorized: secret body"), "authentication");
  assert.equal(classifyAiError("request timeout"), "timeout");
  assert.equal(classifyAiError("429 rate limit"), "rate_limit");
});

test("uses historical usage and configured pricing for estimates", () => {
  const estimate = estimateCosts([{
    createdAt: new Date(),
    apiError: null,
    interpretInputTokens: 1000,
    interpretOutputTokens: 100,
    interpretCostUsd: 0.0045,
    verifierInputTokens: 2000,
    verifierOutputTokens: 200,
    verifierCostUsd: 0.009,
    verifierResultJson: {},
  }]);
  assert.equal(estimate.basis, "historical");
  assert.equal(estimate.interpret.inputTokens.typical, 1000);
  assert.ok(estimate.total.usd.typical > 0);
});

test("no records produce a safe estimate and no provider probe", () => {
  const status = buildProviderStatus([]);
  assert.ok(["not_configured", "unknown"].includes(status.state));
  assert.equal(status.lastSuccess, null);
  assert.equal(status.costEstimate.basis, "default");
});