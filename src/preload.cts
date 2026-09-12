import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, CaseRecord, Analysis, AnalysisProgress, PhotoEdit, VideoEdit } from "./shared/types.js";

const api = {
  cases: {
    list: (): Promise<CaseRecord[]> => ipcRenderer.invoke("cases:list"),
    get: (caseId: string): Promise<CaseRecord | undefined> => ipcRenderer.invoke("cases:get", caseId),
    create: (name: string): Promise<CaseRecord> => ipcRenderer.invoke("cases:create", name),
    delete: (caseId: string): Promise<void> => ipcRenderer.invoke("cases:delete", caseId),
  },
  media: {
    import: (caseId: string) => ipcRenderer.invoke("media:import", caseId) as Promise<{ asset: CaseRecord["assets"][number]; duplicate: boolean } | null>,
    url: (caseId: string, assetId: string) => `media:///${encodeURIComponent(caseId)}/${encodeURIComponent(assetId)}`,
  },
  analysis: {
    start: (caseId: string, assetId: string): Promise<Analysis> => ipcRenderer.invoke("analysis:start", caseId, assetId),
    onProgress: (listener: (progress: AnalysisProgress) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, value: AnalysisProgress) => listener(value);
      ipcRenderer.on("analysis:progress", wrapped);
      return () => ipcRenderer.removeListener("analysis:progress", wrapped);
    },
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
    setKey: (key: string): Promise<AppSettings> => ipcRenderer.invoke("settings:set-key", key),
    deleteKey: (): Promise<AppSettings> => ipcRenderer.invoke("settings:delete-key"),
    binaries: (value: { ffprobePath?: string; ffmpegPath?: string }, model?: string): Promise<AppSettings> => ipcRenderer.invoke("settings:binaries", value, model),
  },
  report: { export: (caseId: string, analysisId: string): Promise<string | null> => ipcRenderer.invoke("report:export", caseId, analysisId) },
  editor: {
    videoExport: (caseId: string, edit: VideoEdit): Promise<string | null> => ipcRenderer.invoke("editor:video-export", caseId, edit),
    photoExport: (caseId: string, assetId: string, edit: PhotoEdit): Promise<string | null> => ipcRenderer.invoke("editor:photo-export", caseId, assetId, edit),
  },
} as const;

contextBridge.exposeInMainWorld("videoForensics", api);