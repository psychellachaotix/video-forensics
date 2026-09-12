import test from "node:test";
import assert from "node:assert/strict";
import { ProgressTracker, clampProgress } from "./progress.ts";

test("progress is monotonic in the declared phase order", () => {
  const tracker = new ProgressTracker(["import", "metadata", "findings", "interpret", "verifier", "done"]);
  assert.equal(tracker.update("import", "copying").percent, 0);
  assert.equal(tracker.update("metadata", "ffprobe").percent, 20);
  assert.equal(tracker.update("done", "complete").percent, 100);
});

test("progress clamps invalid values", () => {
  assert.equal(clampProgress(-4), 0);
  assert.equal(clampProgress(101), 100);
});