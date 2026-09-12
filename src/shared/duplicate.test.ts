import test from "node:test";
import assert from "node:assert/strict";
import { makeDuplicateReference } from "./duplicate.ts";

test("duplicate import produces a destination asset reference with same hash", () => {
  const source = { id: "source", originalName: "x.mp4", storedName: "x.mp4", path: "owner/evidence/x.mp4", kind: "video" as const, extension: ".mp4", size: 4, sha256: "abc", importedAt: "2025-01-01" };
  const reference = makeDuplicateReference(source, "owner-case", "source");
  assert.notEqual(reference.id, source.id);
  assert.equal(reference.sha256, source.sha256);
  assert.equal(reference.duplicateOf, "owner-case:source");
});