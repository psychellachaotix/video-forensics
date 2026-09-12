import type { Analysis, CaseRecord } from "./types.js";

function isProject(value: unknown): value is CaseRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CaseRecord>;
  return typeof candidate.id === "string" && typeof candidate.name === "string"
    && typeof candidate.createdAt === "string" && typeof candidate.updatedAt === "string"
    && Array.isArray(candidate.assets) && Array.isArray(candidate.analyses);
}

/** The on-disk project boundary: reject corrupt JSON before it enters the UI. */
export function serializeProject(project: CaseRecord): string {
  if (!isProject(project)) throw new Error("Neplatný projekt.");
  return JSON.stringify(project, null, 2);
}

export function parseProject(json: string): CaseRecord {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error("Projekt není platný JSON."); }
  if (!isProject(parsed)) throw new Error("Projekt nemá platný formát.");
  return parsed;
}

export function latestAnalysisForAsset(project: CaseRecord, assetId: string): Analysis | undefined {
  return project.analyses.filter((analysis) => analysis.assetId === assetId).at(-1);
}