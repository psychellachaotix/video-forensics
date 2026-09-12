import { randomUUID } from "node:crypto";
import type { MediaAsset } from "./types.js";

export function makeDuplicateReference(asset: MediaAsset, ownerCaseId: string, ownerAssetId: string): MediaAsset {
  return { ...asset, id: randomUUID(), importedAt: new Date().toISOString(), duplicateOf: `${ownerCaseId}:${ownerAssetId}` };
}