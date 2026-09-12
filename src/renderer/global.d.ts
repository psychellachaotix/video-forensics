import type { AppSettings, CaseRecord, Analysis, AnalysisProgress, PhotoEdit, VideoEdit } from "../shared/types";
declare global {
  interface Window {
    videoForensics: {
      cases: { list(): Promise<CaseRecord[]>; get(id: string): Promise<CaseRecord | undefined>; create(name: string): Promise<CaseRecord>; delete(id: string): Promise<void> };
      media: { import(caseId: string): Promise<{ asset: CaseRecord["assets"][number]; duplicate: boolean } | null>; url(caseId: string, assetId: string): string };
      analysis: { start(caseId: string, assetId: string): Promise<Analysis>; onProgress(listener: (value: AnalysisProgress) => void): () => void };
      settings: { get(): Promise<AppSettings>; setKey(key: string): Promise<AppSettings>; deleteKey(): Promise<AppSettings>; binaries(value: { ffprobePath?: string; ffmpegPath?: string }, model?: string): Promise<AppSettings> };
      report: { export(caseId: string, analysisId: string): Promise<string | null> };
      editor: { videoExport(caseId: string, edit: VideoEdit): Promise<string | null>; photoExport(caseId: string, assetId: string, edit: PhotoEdit): Promise<string | null> };
    };
  }
}
export {};