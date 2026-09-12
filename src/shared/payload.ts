import type { PhotoEdit, VideoEdit } from "./types.js";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertId(value: unknown, label: string): string {
  if (typeof value !== "string" || !ID.test(value)) throw new Error(`${label} má neplatný formát.`);
  return value;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} musí být číslo.`);
  return value;
}
export function validateVideoEdit(value: unknown): asserts value is VideoEdit {
  if (!value || typeof value !== "object") throw new Error("Video editace má neplatný formát.");
  const edit = value as Partial<VideoEdit>;
  if (!Array.isArray(edit.clips) || edit.clips.length > 100) throw new Error("Video musí mít 1–100 klipů.");
  for (const clip of edit.clips) {
    assertId(clip?.id, "ID klipu"); assertId(clip?.sourceAssetId, "ID zdroje klipu");
    const start = finite(clip?.start, "Začátek klipu"); const end = finite(clip?.end, "Konec klipu");
    if (start < 0 || end <= start || end - start > 24 * 60 * 60) throw new Error("Rozsah klipu je neplatný.");
  }
  if (!["none", "grayscale", "sepia", "brightness", "contrast"].includes(edit.filter as string)) throw new Error("Neplatný video filtr.");
  if (typeof edit.volume !== "number" || !Number.isFinite(edit.volume) || edit.volume < 0 || edit.volume > 4) throw new Error("Neplatná hlasitost.");
  if (typeof edit.muted !== "boolean" || (edit.text !== undefined && (typeof edit.text !== "string" || edit.text.length > 500))) throw new Error("Neplatný text overlay.");
}
export function validatePhotoEdit(value: unknown): asserts value is PhotoEdit {
  if (!value || typeof value !== "object") throw new Error("Photo editace má neplatný formát.");
  const edit = value as Partial<PhotoEdit>;
  if (![0, 90, 180, 270].includes(edit.rotation as number) || typeof edit.flipX !== "boolean" || typeof edit.flipY !== "boolean") throw new Error("Neplatná geometrie fotografie.");
  for (const [name, item] of [["jas", edit.brightness], ["kontrast", edit.contrast], ["saturace", edit.saturation]]) {
    if (typeof item !== "number" || !Number.isFinite(item) || item < 0 || item > 300) throw new Error(`Neplatný parametr: ${name}.`);
  }
  if (typeof edit.grayscale !== "boolean" || typeof edit.sepia !== "boolean" || !["png", "jpeg", "webp"].includes(edit.format as string)) throw new Error("Neplatný photo formát.");
  if (edit.quality !== undefined && (typeof edit.quality !== "number" || !Number.isFinite(edit.quality) || edit.quality < 1 || edit.quality > 100)) throw new Error("Neplatná kvalita fotografie.");
  if (edit.crop !== undefined) {
    const crop = edit.crop;
    for (const value of [crop.x, crop.y, crop.width, crop.height]) finite(value, "Crop");
    if (![crop.x, crop.y, crop.width, crop.height].every(Number.isInteger) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0) throw new Error("Crop musí mít kladné celočíselné rozměry.");
  }
}