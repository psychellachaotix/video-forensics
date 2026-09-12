export type EvidenceSource = {
  stepName: string;
  stepStatus: string;
  resultJson: unknown;
  errorMessage: string | null;
};

export function serializeEvidence(row: EvidenceSource) {
  const result = (row.resultJson ?? {}) as {
    title?: string;
    detail?: string;
    severity?: "low" | "medium" | "high";
    timestamp?: string | null;
    timestampSeconds?: number | null;
    score?: number;
    regions?: Array<{ x: number; y: number; width: number; height: number; score: number; label: string }>;
  };
  const timestampSeconds = typeof result.timestampSeconds === "number"
    && Number.isFinite(result.timestampSeconds)
    && result.timestampSeconds >= 0
    ? result.timestampSeconds
    : null;
  return {
    category: row.stepName,
    title: result.title ?? (row.stepStatus === "OK" ? "Analytický krok dokončen" : "Data nejsou dostupná"),
    detail: result.detail ?? row.errorMessage ?? "Krok neposkytl žádná další data.",
    severity: result.severity ?? (row.stepStatus === "CHYBA" ? "high" : row.stepStatus === "NEDOSTUPNE" ? "medium" : "low"),
    timestamp: result.timestamp ?? null,
    timestampSeconds,
    score: typeof result.score === "number" && Number.isFinite(result.score) ? result.score : undefined,
    regions: Array.isArray(result.regions) ? result.regions : undefined,
  };
}