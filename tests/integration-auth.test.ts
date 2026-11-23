import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashApiKey, requestHash } from "@/lib/integration-auth";

afterEach(() => {
  delete process.env.INTEGRATION_ENCRYPTION_KEY;
});

describe("integration authentication primitives", () => {
  it("encrypts and decrypts HMAC secrets without returning plaintext storage", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("test-secret");
    expect(encrypted).not.toContain("test-secret");
    expect(decryptSecret(encrypted)).toBe("test-secret");
  });

  it("hashes API keys deterministically", () => {
    expect(hashApiKey("ptk_test")).toBe(hashApiKey("ptk_test"));
    expect(hashApiKey("ptk_test")).not.toBe(hashApiKey("ptk_other"));
  });

  it("binds multipart bodies to a stable digest", () => {
    expect(requestHash("same-body")).toBe(requestHash("same-body"));
    expect(requestHash("same-body")).not.toBe(requestHash("changed-body"));
  });
});
