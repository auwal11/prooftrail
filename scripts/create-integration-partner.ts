import crypto from "node:crypto";
import { db } from "@/lib/db";
import { encryptSecret, hashApiKey } from "@/lib/integration-auth";

const ownerEmail = process.env.INTEGRATION_OWNER_EMAIL?.trim().toLowerCase();
const slug = process.env.INTEGRATION_SLUG?.trim() || "laupay";
const name = process.env.INTEGRATION_NAME?.trim() || "LauPay";
if (!ownerEmail) throw new Error("Set INTEGRATION_OWNER_EMAIL to an existing ProofTrail account.");

const owner = await db.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
if (!owner) throw new Error("Integration owner account was not found.");
const apiKey = `ptk_${crypto.randomBytes(24).toString("base64url")}`;
const apiSecret = `pts_${crypto.randomBytes(36).toString("base64url")}`;
await db.integrationPartner.create({ data: { ownerUserId: owner.id, slug, name, apiKeyHash: hashApiKey(apiKey), secretCiphertext: encryptSecret(apiSecret), scopes: ["disputes:create", "disputes:read", "evidence:upload", "reports:read"] } });
console.log(JSON.stringify({ slug, apiKey, apiSecret, warning: "Store these credentials in LauPay's secret manager. They cannot be recovered from ProofTrail." }, null, 2));
await db.$disconnect();
