import test from "node:test";
import assert from "node:assert/strict";
import { validatePhotoEdit, validateVideoEdit } from "./payload.ts";

const id = "00000000-0000-4000-8000-000000000001";
test("payload validators reject unsafe editor values", () => {
  assert.throws(() => validateVideoEdit({ clips: [{ id, sourceAssetId: id, start: 2, end: 1 }], filter: "none", volume: 1, muted: false }), /Rozsah/);
  assert.throws(() => validatePhotoEdit({ rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100, saturation: 100, grayscale: false, sepia: false, format: "png", crop: { x: 0, y: 0, width: 0, height: 10 } }), /kladné/);
});