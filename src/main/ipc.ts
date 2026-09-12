import { app, BrowserWindow, dialog, ipcMain, protocol } from "electron";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import { AnalysisRunner, exportPhotoEdit, exportVideoEdit } from "./analysis.js";
import { exportReport } from "./report.js";
import { SettingsStore } from "./settings.js";
import { CaseStorage } from "./storage.js";
import type { PhotoEdit, VideoEdit } from "../shared/types.js";
import { assertId, validatePhotoEdit, validateVideoEdit } from "../shared/payload.js";

export function registerIpc(storage: CaseStorage, settings: SettingsStore, window: BrowserWindow): void {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Neplatný IPC odesílatel.");
    const url = event.senderFrame.url;
    if (app.isPackaged ? !url.startsWith("file://") : !url.startsWith("http://localhost:5174")) throw new Error("Neplatný původ IPC.");
  };
  ipcMain.handle("cases:list", (event) => { trusted(event); return storage.list(); });
  ipcMain.handle("cases:get", (event, caseId: unknown) => { trusted(event); return storage.get(assertId(caseId, "ID případu")); });
  ipcMain.handle("cases:create", (event, name: unknown) => { trusted(event); if (typeof name !== "string" || !name.trim() || name.length > 160) throw new Error("Název případu je neplatný."); return storage.create(name.trim()); });
  ipcMain.handle("cases:delete", (event, caseId: unknown) => { trusted(event); return storage.delete(assertId(caseId, "ID případu")); });
  ipcMain.handle("media:import", async (event, caseId: unknown) => {
    trusted(event); const validCaseId = assertId(caseId, "ID případu");
    const result = await dialog.showOpenDialog(window, { title: "Přidat důkaz", properties: ["openFile"], filters: [{ name: "Média", extensions: ["mp4", "mov", "avi", "mkv", "jpg", "jpeg", "png", "webp"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    return storage.importMedia(validCaseId, result.filePaths[0]);
  });
  ipcMain.handle("analysis:start", async (event, caseId: unknown, assetId: unknown) => {
    trusted(event); const validCaseId = assertId(caseId, "ID případu"); const validAssetId = assertId(assetId, "ID důkazu");
    const runner = new AnalysisRunner(storage, settings);
    return runner.start(validCaseId, validAssetId, window, (progress) => window.webContents.send("analysis:progress", progress));
  });
  ipcMain.handle("settings:get", (event) => { trusted(event); return settings.read(); });
  ipcMain.handle("settings:set-key", (event, key: unknown) => { trusted(event); if (typeof key !== "string" || key.length > 300) throw new Error("Neplatný API klíč."); return settings.setKey(key); });
  ipcMain.handle("settings:delete-key", (event) => { trusted(event); return settings.deleteKey(); });
  ipcMain.handle("settings:binaries", (event, binaries: unknown, model?: unknown) => { trusted(event); if (!binaries || typeof binaries !== "object") throw new Error("Neplatné cesty binárek."); const value = binaries as { ffprobePath?: unknown; ffmpegPath?: unknown }; if ((value.ffprobePath !== undefined && typeof value.ffprobePath !== "string") || (value.ffmpegPath !== undefined && typeof value.ffmpegPath !== "string")) throw new Error("Neplatné cesty binárek."); return settings.updateBinaries({ ffprobePath: value.ffprobePath as string | undefined, ffmpegPath: value.ffmpegPath as string | undefined }, typeof model === "string" ? model.slice(0, 120) : undefined); });
  ipcMain.handle("report:export", async (event, caseId: unknown, analysisId: unknown) => {
    trusted(event); const validCaseId = assertId(caseId, "ID případu"); const validAnalysisId = assertId(analysisId, "ID analýzy");
    const record = await storage.get(validCaseId); const analysis = record?.analyses.find((item) => item.id === validAnalysisId);
    if (!record || !analysis) throw new Error("Analýza nebyla nalezena.");
    return exportReport(record, analysis);
  });
  ipcMain.handle("editor:video-export", (event, caseId: unknown, edit: unknown) => { trusted(event); const validCaseId = assertId(caseId, "ID případu"); validateVideoEdit(edit); return exportVideoEdit(storage, validCaseId, edit as VideoEdit); });
  ipcMain.handle("editor:photo-export", (event, caseId: unknown, assetId: unknown, edit: unknown) => { trusted(event); const validCaseId = assertId(caseId, "ID případu"); const validAssetId = assertId(assetId, "ID důkazu"); validatePhotoEdit(edit); return exportPhotoEdit(storage, validCaseId, validAssetId, edit as PhotoEdit); });
}

export function registerMediaProtocol(storage: CaseStorage): void {
  if (mediaProtocolRegistered) return;
  mediaProtocolRegistered = true;
  protocol.handle("media", async (request) => {
    try {
      const url = new URL(request.url);
      const [caseId, assetId] = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (!caseId || !assetId) return new Response("Not found", { status: 404 });
      const record = await storage.get(caseId);
      const asset = record?.assets.find((item) => item.id === assetId);
      if (!asset || !asset.path) return new Response("Not found", { status: 404 });
      await fs.access(asset.path);
      return (await import("electron")).net.fetch(pathToFileURL(asset.path).toString());
    } catch { return new Response("Not found", { status: 404 }); }
  });
}

let mediaProtocolRegistered = false;

export function setupApplication(): void {
  app.setAppUserModelId("cz.videoforensics.desktop");
}