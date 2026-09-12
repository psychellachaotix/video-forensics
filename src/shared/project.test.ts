import test from "node:test";
import assert from "node:assert/strict";
import { latestAnalysisForAsset, parseProject, serializeProject } from "./project.ts";

const project = { id: "case-1", name: "Test", createdAt: "2025-01-01", updatedAt: "2025-01-01", assets: [], analyses: [] };

test("project round trip is deterministic JSON", () => {
  assert.deepEqual(parseProject(serializeProject(project)), project);
  assert.match(serializeProject(project), /"analyses": \[\]/);
});

test("corrupt project data is rejected instead of silently replaced", () => {
  assert.throws(() => parseProject("{\"id\":\"missing\"}"), /platný formát/);
  assert.throws(() => parseProject("not json"), /platný JSON/);
});

test("analysis lookup never crosses asset boundaries", () => {
  const value = { ...project, analyses: [
    { id: "a", assetId: "one", startedAt: "2025-01-01", progress: { caseId: "case-1", percent: 100, phase: "complete", etaSeconds: null, detail: "", updatedAt: "" }, steps: [], findings: [], metadata: {}, errors: [] },
    { id: "b", assetId: "two", startedAt: "2025-01-02", progress: { caseId: "case-1", percent: 100, phase: "complete", etaSeconds: null, detail: "", updatedAt: "" }, steps: [], findings: [], metadata: {}, errors: [] },
  ] };
  assert.equal(latestAnalysisForAsset(value, "one")?.id, "a");
  assert.equal(latestAnalysisForAsset(value, "missing"), undefined);
});