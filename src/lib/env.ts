import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function databaseUrl(): string {
  return required("DATABASE_URL");
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function storageDir(): string {
  return path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "var/storage");
}

export function maxUploadBytes(): number {
  const parsed = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 1024 * 1024;
}

export function ocrLangPath(): string {
  return path.resolve(process.cwd(), process.env.OCR_LANG_PATH ?? "assets/tessdata");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
