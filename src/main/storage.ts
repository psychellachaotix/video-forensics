import { app } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CaseRecord, MediaAsset } from "../shared/types.js";
import { mediaKindForName, safeFileName, validateCase } from "../shared/validation.js";
import { serializeProject } from "../shared/project.js";
import { makeDuplicateReference } from "../shared/duplicate.js";

export class CaseStorage {
  readonly root: string;
  readonly casesRoot: string;
  private indexPath: string;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(root = app.getPath("userData")) {
    this.root = root;
    this.casesRoot = path.join(root, "cases");
    this.indexPath = path.join(this.casesRoot, "index.json");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.casesRoot, { recursive: true });
    try { await fs.access(this.indexPath); } catch { await this.atomicWrite(this.indexPath, "[]"); }
  }

  async list(): Promise<CaseRecord[]> {
    await this.init();
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.indexPath, "utf8"));
      if (!Array.isArray(parsed) || !parsed.every(validateCase)) throw new Error("Index případů má neplatný formát.");
      return parsed;
    } catch (error) {
      if (error instanceof Error && error.message === "Index případů má neplatný formát.") throw error;
      throw new Error(`Nelze načíst lokální index případů: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async get(id: string): Promise<CaseRecord | undefined> {
    return (await this.list()).find((item) => item.id === id);
  }

  async save(record: CaseRecord): Promise<void> {
    return this.enqueue(async () => this.saveUnsafe(record));
  }

  private async saveUnsafe(record: CaseRecord): Promise<void> {
    const all = await this.list();
    const next = all.some((item) => item.id === record.id)
      ? all.map((item) => item.id === record.id ? record : item)
      : [...all, record];
    await this.atomicWrite(path.join(this.casesRoot, record.id, "case.json"), serializeProject(record));
    await this.atomicWrite(this.indexPath, JSON.stringify(next, null, 2));
  }

  async create(name: string): Promise<CaseRecord> {
    let created!: CaseRecord;
    await this.enqueue(async () => {
      const now = new Date().toISOString();
      created = { id: randomUUID(), name: name.trim() || "Nový případ", createdAt: now, updatedAt: now, assets: [], analyses: [] };
      await fs.mkdir(path.join(this.casesRoot, created.id, "evidence"), { recursive: true });
      await fs.mkdir(path.join(this.casesRoot, created.id, "reports"), { recursive: true });
      await this.saveUnsafe(created);
    });
    return created;
  }

  async delete(id: string): Promise<void> {
    await this.enqueue(async () => {
      const all = await this.list();
      const record = all.find((item) => item.id === id);
      if (!record) throw new Error("Případ nebyl nalezen.");
      // Keep references alive when deleting the original owner. References are
      // re-homed into their case evidence folder before the owner is removed.
      for (const other of all.filter((item) => item.id !== id)) {
        let changed = false;
        for (const asset of other.assets) {
          const owned = record.assets.find((candidate) => candidate.path === asset.path);
          if (!owned) continue;
          const destination = path.join(this.casesRoot, other.id, "evidence", asset.storedName);
          await fs.copyFile(owned.path, destination);
          asset.path = destination; asset.duplicateOf = undefined; changed = true;
        }
        if (changed) await this.saveUnsafe(other);
      }
      await fs.rm(path.join(this.casesRoot, id), { recursive: true, force: true });
      await this.atomicWrite(this.indexPath, JSON.stringify((await this.list()).filter((item) => item.id !== id), null, 2));
    });
  }

  async importMedia(caseId: string, sourcePath: string): Promise<{ asset: MediaAsset; duplicate: boolean }> {
    let imported!: { asset: MediaAsset; duplicate: boolean };
    await this.enqueue(async () => {
      const record = (await this.list()).find((item) => item.id === caseId);
      if (!record) throw new Error("Případ nebyl nalezen.");
      const originalName = path.basename(sourcePath);
      const kind = mediaKindForName(originalName);
      if (!kind) throw new Error("Nepodporovaný formát. Použijte MP4, MOV, AVI, MKV, JPG, JPEG, PNG nebo WebP.");
      const stat = await fs.stat(sourcePath);
      if (!stat.isFile()) throw new Error("Vybraná položka není soubor.");
      const sha256 = await hashFile(sourcePath);
      const existing = (await this.list()).flatMap((item) => item.assets.map((asset) => ({ item, asset }))).find(({ asset }) => asset.sha256 === sha256);
      if (existing) {
        if (existing.item.id === caseId) { imported = { asset: existing.asset, duplicate: true }; return; }
        const reference: MediaAsset = makeDuplicateReference(existing.asset, existing.item.id, existing.asset.id);
        record.assets.push(reference); record.updatedAt = new Date().toISOString();
        await this.saveUnsafe(record); imported = { asset: reference, duplicate: true }; return;
      }
      const extension = path.extname(originalName).toLowerCase();
      const asset: MediaAsset = { id: randomUUID(), originalName, storedName: `${randomUUID()}-${safeFileName(originalName)}`, path: "", kind, extension, size: stat.size, sha256, importedAt: new Date().toISOString() };
      const destination = path.join(this.casesRoot, caseId, "evidence", asset.storedName);
      await fs.copyFile(sourcePath, destination); asset.path = destination;
      record.assets.push(asset); record.updatedAt = new Date().toISOString();
      await this.saveUnsafe(record); imported = { asset, duplicate: false };
    });
    return imported;
  }

  async update(record: CaseRecord): Promise<void> {
    record.updatedAt = new Date().toISOString();
    await this.save(record);
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.mutationQueue.then(operation, operation);
    this.mutationQueue = next.catch(() => undefined);
    return next;
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, content, "utf8");
    await fs.rename(temporary, filePath);
  }
}

export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(hash.digest("hex")));
  });
}