export type MediaKind = "video" | "image";
export type ResultClass = "ORIGINAL" | "UPRAVENO" | "UPRAVENO_AI" | "CELE_AI" | "NEURCENO";
export type FinalStatus = "POTVRZENO" | "SPORNE" | "NEURCENO" | "CHYBA_API";
export type StepStatus = "PENDING" | "RUNNING" | "OK" | "CHYBA";

export interface MediaAsset {
  id: string;
  originalName: string;
  storedName: string;
  path: string;
  kind: MediaKind;
  extension: string;
  size: number;
  sha256: string;
  importedAt: string;
  duplicateOf?: string;
}

export interface PipelineStep {
  stepName: string;
  stepStatus: StepStatus;
  detail?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ForensicFinding {
  id: string;
  category: string;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  timestamp?: number;
}

export interface AnalysisProgress {
  caseId: string;
  percent: number;
  phase: string;
  etaSeconds: number | null;
  detail: string;
  updatedAt: string;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  model: string;
}

export interface AgentResult {
  verdict?: ResultClass;
  confidence?: number;
  reasoning: string;
  uncertainties: string;
  manipulationTypes: string[];
  raw?: string;
}

export interface VerifierResult {
  finalStatus?: FinalStatus;
  agreesWithInterpret: boolean;
  confirmedFindings: string[];
  contradictions: string[];
  comment: string;
  raw?: string;
}

export interface Analysis {
  id: string;
  assetId: string;
  startedAt: string;
  completedAt?: string;
  progress: AnalysisProgress;
  steps: PipelineStep[];
  findings: ForensicFinding[];
  metadata: Record<string, unknown>;
  interpret?: AgentResult;
  verifier?: VerifierResult;
  aiUsage?: AiUsage;
  errors: string[];
}

export interface CaseRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assets: MediaAsset[];
  analyses: Analysis[];
}

export interface BinarySettings {
  ffprobePath?: string;
  ffmpegPath?: string;
}

export interface AppSettings {
  hasAnthropicKey: boolean;
  binaries: BinarySettings;
  apiModel: string;
}

export interface VideoClip {
  id: string;
  sourceAssetId: string;
  start: number;
  end: number;
}

export interface VideoEdit {
  clips: VideoClip[];
  filter: "none" | "grayscale" | "sepia" | "brightness" | "contrast";
  volume: number;
  muted: boolean;
  text?: string;
}

export interface PhotoEdit {
  crop?: { x: number; y: number; width: number; height: number };
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: boolean;
  sepia: boolean;
  format: "png" | "jpeg" | "webp";
  quality: number;
}

export const RESULT_CLASSES: ResultClass[] = [
  "ORIGINAL", "UPRAVENO", "UPRAVENO_AI", "CELE_AI", "NEURCENO",
];