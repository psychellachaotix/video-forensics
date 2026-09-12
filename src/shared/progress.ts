import type { AnalysisProgress } from "./types.js";

export class ProgressTracker {
  private readonly phases: string[];
  private started = Date.now();
  private completed = new Map<string, number>();
  constructor(phases: string[]) { this.phases = phases; }

  update(phase: string, detail: string): AnalysisProgress {
    const index = Math.max(0, this.phases.indexOf(phase));
    const percent = Math.min(100, Math.round((index / Math.max(1, this.phases.length - 1)) * 100));
    this.completed.set(phase, Date.now());
    const elapsed = Math.max(1, (Date.now() - this.started) / 1000);
    const etaSeconds = percent > 0 ? Math.max(0, Math.round((elapsed * (100 - percent)) / percent)) : null;
    return { caseId: "", percent, phase, etaSeconds, detail, updatedAt: new Date().toISOString() };
  }
}

export function clampProgress(percent: number): number {
  return Math.max(0, Math.min(100, Math.round(percent)));
}