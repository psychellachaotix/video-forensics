import type { CaseRecord, MediaKind } from "./types.js";

const RESULT_CLASSES = ["ORIGINAL", "UPRAVENO", "UPRAVENO_AI", "CELE_AI", "NEURCENO"] as const;

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

export function mediaKindForName(name: string): MediaKind | null {
  const ext = extensionOf(name);
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return null;
}

export function isSupportedMediaName(name: string): boolean {
  return mediaKindForName(name) !== null;
}

export function validateCase(value: unknown): value is CaseRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CaseRecord>;
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string"
    && Array.isArray(candidate.assets)
    && Array.isArray(candidate.analyses);
}

export function validateResultClass(value: unknown): boolean {
  return typeof value === "string" && RESULT_CLASSES.includes(value as never);
}

export function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\.+$/, "").slice(0, 180) || "evidence";
}