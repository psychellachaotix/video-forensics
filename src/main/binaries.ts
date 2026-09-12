import { app } from "electron";
import { access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { BinarySettings } from "../shared/types.js";

async function executable(candidate: string | undefined, configured = false): Promise<string | undefined> {
  if (!candidate) return undefined;
  if (configured && (!path.isAbsolute(candidate) || path.extname(candidate).toLowerCase() !== ".exe")) return undefined;
  try { await access(candidate); return candidate; } catch { return undefined; }
}

export async function resolveBinary(name: "ffprobe" | "ffmpeg", settings: BinarySettings): Promise<string> {
  const configured = await executable(settings[`${name}Path`], true);
  if (configured) return configured;
  const binaryName = process.platform === "win32" ? `${name}.exe` : name;
  for (const candidate of [
    path.join(process.resourcesPath, "binaries", binaryName),
    ...(!app.isPackaged ? [path.join(app.getAppPath(), "resources", "binaries", binaryName)] : []),
  ]) {
    const bundled = await executable(candidate);
    if (bundled) return bundled;
  }
  return process.platform === "win32" ? `${name}.exe` : name;
}

export async function runBinary(binary: string, args: string[], timeoutMs = 120_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let stdout = ""; let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${binary} vypršel časový limit.`)); }, timeoutMs);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${binary} skončil s kódem ${code}: ${stderr.slice(-1000)}`));
    });
  });
}

export function bundledBinaryDirectory(): string {
  return app.isPackaged ? path.join(process.resourcesPath, "binaries") : path.join(app.getAppPath(), "resources", "binaries");
}