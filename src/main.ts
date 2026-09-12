import { app, BrowserWindow, protocol, session } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CaseStorage } from "./main/storage.js";
import { SettingsStore } from "./main/settings.js";
import { registerIpc, registerMediaProtocol, setupApplication } from "./main/ipc.js";

protocol.registerSchemesAsPrivileged([{ scheme: "media", privileges: { secure: true, supportFetchAPI: true, stream: true } }]);
let mainWindow: BrowserWindow | undefined;
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

async function createWindow(): Promise<void> {
  setupApplication();
  const storage = new CaseStorage();
  await storage.init();
  const settings = new SettingsStore();
  registerMediaProtocol(storage);
  mainWindow = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1080, minHeight: 700, backgroundColor: "#0b1014",
    webPreferences: { preload: path.join(moduleDirectory, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  mainWindow.webContents.on("will-navigate", (event, destination) => {
    const appEntry = pathToFileURL(path.join(app.getAppPath(), "dist/renderer/index.html")).toString();
    const allowed = app.isPackaged ? destination === appEntry || destination.startsWith(`${appEntry}#`) || destination.startsWith(`${appEntry}?`) : destination.startsWith("http://localhost:5174/");
    if (!allowed) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived({ urls: ["*://*/*", "file://*/*"] }, (details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: media:; media-src 'self' media: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"] } });
    });
  }
  registerIpc(storage, settings, mainWindow);
  if (app.isPackaged) await mainWindow.loadFile(path.join(app.getAppPath(), "dist/renderer/index.html"));
  else await mainWindow.loadURL("http://localhost:5174");
  mainWindow.on("closed", () => { mainWindow = undefined; });
}

app.whenReady().then(createWindow).catch((error) => console.error("Video Forensics start failed", error));
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!mainWindow) void createWindow(); });