import crypto from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

const MAX_SKEW_SECONDS = 300;

function encryptionKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new ApiError(503, "Integration authentication is not configured.", "integration_not_configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new ApiError(503, "Integration authentication is not configured.", "integration_not_configured");
  return key;
}

export function hashApiKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new ApiError(503, "Integration authentication is not configured.", "integration_not_configured");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function requestHash(rawBody: string): string {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function authenticateIntegration(request: Request, scope: string, rawBody: string) {
  const apiKey = request.headers.get("x-prooftrail-key");
  const timestamp = request.headers.get("x-prooftrail-timestamp");
  const signature = request.headers.get("x-prooftrail-signature");
  if (!apiKey || !timestamp || !signature) throw new ApiError(401, "Integration authentication headers are required.", "integration_unauthorized");
  const timestampNumber = Number(timestamp);
  if (!Number.isInteger(timestampNumber) || Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > MAX_SKEW_SECONDS) {
    throw new ApiError(401, "The integration request timestamp is expired.", "integration_timestamp_expired");
  }
  const partner = await db.integrationPartner.findFirst({ where: { apiKeyHash: hashApiKey(apiKey), active: true, revokedAt: null } });
  if (!partner) throw new ApiError(401, "Integration credentials are invalid.", "integration_unauthorized");
  if (!partner.scopes.includes(scope)) throw new ApiError(403, "The integration credential lacks the required scope.", "integration_forbidden");
  const expected = `sha256=${crypto.createHmac("sha256", decryptSecret(partner.secretCiphertext)).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  if (!safeEqual(expected, signature)) throw new ApiError(401, "The integration signature is invalid.", "integration_signature_invalid");
  return partner;
}

export function signedWebhook(secretCiphertext: string, payload: string, timestamp: number): string {
  return `sha256=${crypto.createHmac("sha256", decryptSecret(secretCiphertext)).update(`${timestamp}.${payload}`).digest("hex")}`;
}
