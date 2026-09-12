import assert from "node:assert/strict";
import test from "node:test";
import { serializeEvidence } from "./evidence.ts";

test("serializuje textový i číselný čas nálezu", () => {
  const evidence = serializeEvidence({
    stepName: "strihy",
    stepStatus: "OK",
    resultJson: {
      title: "Náhlý střih",
      detail: "Změna histogramu.",
      severity: "medium",
      timestamp: "00:42",
      timestampSeconds: 42.25,
    },
    errorMessage: null,
  });

  assert.equal(evidence.timestamp, "00:42");
  assert.equal(evidence.timestampSeconds, 42.25);
});

test("odmítne neplatný číselný čas", () => {
  const evidence = serializeEvidence({
    stepName: "audio",
    stepStatus: "OK",
    resultJson: { timestamp: "00:00", timestampSeconds: -1 },
    errorMessage: null,
  });

  assert.equal(evidence.timestampSeconds, null);
});