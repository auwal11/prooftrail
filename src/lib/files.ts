import { createHash } from "node:crypto";

export type EvidenceKindValue = "IMAGE" | "PDF" | "TEXT";

export type SniffedType = {
  kind: EvidenceKindValue;
  mimeType: string;
  extension: string;
  label: string;
};

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_MAGIC = Buffer.from("RIFF", "ascii");
const WEBP_MAGIC = Buffer.from("WEBP", "ascii");

function startsWith(buffer: Buffer, magic: Buffer): boolean {
  return buffer.length >= magic.length && buffer.subarray(0, magic.length).equals(magic);
}

function isProbablyText(buffer: Buffer): boolean {
  if (buffer.includes(0x00)) return false;

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  let control = 0;
  for (const byte of sample) {
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) control += 1;
  }
  if (sample.length === 0) return false;
  if (control / sample.length > 0.02) return false;

  const decoded = buffer.toString("utf8");
  const replacementCount = (decoded.match(/\uFFFD/g) ?? []).length;
  return replacementCount / Math.max(decoded.length, 1) < 0.02;
}

export function sniffFile(buffer: Buffer): SniffedType | null {
  if (startsWith(buffer, PDF_MAGIC)) {
    return { kind: "PDF", mimeType: "application/pdf", extension: ".pdf", label: "PDF document" };
  }
  if (startsWith(buffer, PNG_MAGIC)) {
    return { kind: "IMAGE", mimeType: "image/png", extension: ".png", label: "PNG image" };
  }
  if (startsWith(buffer, JPEG_MAGIC)) {
    return { kind: "IMAGE", mimeType: "image/jpeg", extension: ".jpg", label: "JPEG image" };
  }
  if (startsWith(buffer, RIFF_MAGIC) && buffer.subarray(8, 12).equals(WEBP_MAGIC)) {
    return { kind: "IMAGE", mimeType: "image/webp", extension: ".webp", label: "WebP image" };
  }
  if (isProbablyText(buffer)) {
    return { kind: "TEXT", mimeType: "text/plain", extension: ".txt", label: "Plain text" };
  }
  return null;
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function safeOriginalName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "evidence";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim();
  return (cleaned || "evidence").slice(0, 120);
}
