import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedMediaName, mediaKindForName, safeFileName, validateResultClass } from "./validation.ts";

test("accepts supported local evidence formats and rejects others", () => {
  assert.equal(mediaKindForName("sample.MP4"), "video");
  assert.equal(mediaKindForName("photo.webp"), "image");
  assert.equal(isSupportedMediaName("payload.exe"), false);
});

test("validates all five forensic result classes", () => {
  for (const value of ["ORIGINAL", "UPRAVENO", "UPRAVENO_AI", "CELE_AI", "NEURCENO"]) {
    assert.equal(validateResultClass(value), true);
  }
  assert.equal(validateResultClass("guess"), false);
});

test("sanitizes filenames without changing their extension semantics", () => {
  assert.equal(safeFileName("../evidence:01.mp4"), ".._evidence_01.mp4");
});