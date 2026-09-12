export type AnalysisProgressPhase =
  | "preparation"
  | "technical"
  | "evidence"
  | "interpret"
  | "verifier"
  | "finalization";

export type AnalysisProgress = {
  startedAt: number;
  phase: AnalysisProgressPhase;
  phaseLabel: string;
  percent: number;
  etaSeconds?: number;
  estimated: boolean;
  phaseStartedAt: number;
};

const progress = new Map<number, AnalysisProgress>();
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const labels: Record<AnalysisProgressPhase, string> = {
  preparation: "Příprava a stažení souboru",
  technical: "Technická analýza",
  evidence: "Vyhodnocení důkazů",
  interpret: "Interpret",
  verifier: "Verifier",
  finalization: "Finalizace reportu",
};

function prune(now = Date.now()) {
  for (const [id, item] of progress) {
    if (now - item.startedAt > MAX_AGE_MS) progress.delete(id);
  }
}

export function startAnalysisProgress(id: number) {
  const now = Date.now();
  prune(now);
  const item: AnalysisProgress = {
    startedAt: now,
    phase: "preparation",
    phaseLabel: labels.preparation,
    percent: 2,
    estimated: false,
    phaseStartedAt: now,
  };
  progress.set(id, item);
  return item;
}

export function updateAnalysisProgress(
  id: number,
  phase: AnalysisProgressPhase,
  percent: number,
  options: { etaSeconds?: number; estimated?: boolean } = {},
) {
  const existing = progress.get(id) ?? startAnalysisProgress(id);
  const now = Date.now();
  if (existing.phase !== phase) existing.phaseStartedAt = now;
  const next = {
    ...existing,
    phase,
    phaseLabel: labels[phase],
    percent: Math.max(existing.percent, Math.min(100, Math.round(percent))),
    etaSeconds: options.etaSeconds,
    estimated: options.estimated ?? false,
  };
  progress.set(id, next);
  return next;
}

export function getAnalysisProgress(id: number): AnalysisProgress | undefined {
  prune();
  const item = progress.get(id);
  if (!item) return undefined;
  // Technical analysis is the only long phase where a clock-based estimate is
  // useful. It never crosses the technical phase boundary and is labelled.
  if (item.phase === "technical" && item.percent < 55) {
    const elapsed = Math.max(0, (Date.now() - item.phaseStartedAt) / 1000);
    const estimatedPercent = Math.min(54, item.percent + Math.floor(elapsed / 20));
    const etaSeconds = Math.max(5, Math.round(45 - elapsed));
    return { ...item, percent: estimatedPercent, etaSeconds, estimated: true };
  }
  return item;
}

export function finishAnalysisProgress(id: number) {
  progress.delete(id);
}

export function clearAnalysisProgress(id: number) {
  progress.delete(id);
}
