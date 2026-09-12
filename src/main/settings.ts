import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isAbsolute, extname } from "node:path";
import type { AppSettings, BinarySettings } from "../shared/types.js";

export class SettingsStore {
  private readonly file = path.join(app.getPath("userData"), "settings.json");
  private readonly secretFile = path.join(app.getPath("userData"), "anthropic-key.bin");

  async read(): Promise<AppSettings> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, "utf8")) as Partial<AppSettings>;
      return { hasAnthropicKey: await this.hasKey(), binaries: parsed.binaries ?? {}, apiModel: parsed.apiModel ?? "claude-3-5-sonnet-20241022" };
    } catch {
      return { hasAnthropicKey: await this.hasKey(), binaries: {}, apiModel: "claude-3-5-sonnet-20241022" };
    }
  }

  async updateBinaries(binaries: BinarySettings, apiModel?: string): Promise<AppSettings> {
    for (const [label, value] of Object.entries(binaries)) {
      if (value !== undefined && value !== "") {
        if (!isAbsolute(value) || extname(value).toLowerCase() !== ".exe") throw new Error(`${label} musí být absolutní cesta k .exe.`);
        const stat = await fs.stat(value).catch(() => null);
        if (!stat?.isFile()) throw new Error(`${label} neexistuje nebo není soubor.`);
      }
    }
    const current = await this.read();
    await this.write({ binaries, apiModel: apiModel || current.apiModel });
    return this.read();
  }

  async setKey(key: string): Promise<AppSettings> {
    const normalized = key.trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(normalized)) throw new Error("Zadejte platný Anthropic API klíč začínající sk-ant-.");
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows secure storage není dostupné; klíč nebude uložen.");
    await fs.mkdir(path.dirname(this.secretFile), { recursive: true });
    await fs.writeFile(this.secretFile, safeStorage.encryptString(normalized));
    return this.read();
  }

  async deleteKey(): Promise<AppSettings> {
    await fs.rm(this.secretFile, { force: true });
    return this.read();
  }

  async getKey(): Promise<string> {
    if (!await this.hasKey()) throw new Error("Anthropic API klíč není nastaven.");
    const encrypted = await fs.readFile(this.secretFile);
    return safeStorage.decryptString(encrypted);
  }

  private async hasKey(): Promise<boolean> {
    try { await fs.access(this.secretFile); return safeStorage.isEncryptionAvailable(); } catch { return false; }
  }

  private async write(value: { binaries: BinarySettings; apiModel: string }): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(temporary, this.file);
  }
}