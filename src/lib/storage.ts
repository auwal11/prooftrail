import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { storageDir } from "@/lib/env";

const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

export type StorageArea = "evidence" | "reports";

function areaDir(area: StorageArea): string {
  return path.join(storageDir(), area);
}

export async function ensureStorage(): Promise<void> {
  await mkdir(areaDir("evidence"), { recursive: true, mode: 0o700 });
  await mkdir(areaDir("reports"), { recursive: true, mode: 0o700 });
}

function assertStoredName(name: string): void {
  if (!SAFE_NAME.test(name) || name.includes("..")) {
    throw new Error("Invalid stored file name.");
  }
}

export async function saveFile(
  area: StorageArea,
  extension: string,
  data: Buffer,
): Promise<string> {
  await ensureStorage();
  const storedName = `${randomUUID()}${extension}`;
  const target = path.join(areaDir(area), storedName);
  await writeFile(target, data, { mode: 0o600, flag: "wx" });
  return storedName;
}

export async function readStoredFile(area: StorageArea, storedName: string): Promise<Buffer> {
  assertStoredName(storedName);
  return readFile(path.join(areaDir(area), storedName));
}

export async function deleteStoredFile(area: StorageArea, storedName: string): Promise<void> {
  assertStoredName(storedName);
  await rm(path.join(areaDir(area), storedName), { force: true });
}

export function ocrCacheDir(): string {
  return path.join(storageDir(), "ocr-cache");
}
