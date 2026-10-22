import { describe, expect, it } from "vitest";
import { extractFactsFromPages } from "@/lib/facts/parser";
import type { ExtractedPage } from "@/lib/extract/types";

const GTB_TEXT = [
  "GTBank Instant Alert",
  "Account: ****4412",
  "You have been debited NGN 1,000.00 for MTN Airtime",
  "to 08031234567 on 20/10/2026 12:34 PM.",
  "Transaction Ref: 202610201234567890",
  "Status: Successful. Your balance is NGN 5,432.10",
].join("\n");

const MTN_TEXT = [
  "MTN Airtime Receipt",
  "Amount: NGN 1,000.00",
  "Recipient: 08031234567",
  "Date: 20/10/2026 12:35 PM",
  "Reference: MTN-7741-2026",
  "Status: Failed",
  "The recharge was not completed. Please contact support.",
].join("\n");

function page(text: string, pageNumber = 1): ExtractedPage {
  return { page: pageNumber, text, words: [], units: "chars" };
}

describe("extractFactsFromPages", () => {
  it("extracts source-linked facts from a bank debit alert", () => {
    const facts = extractFactsFromPages([page(GTB_TEXT)]);
    const values = (type: string) =>
      facts.filter((fact) => fact.type === type).map((fact) => fact.normalizedValue);

    expect(values("AMOUNT")).toContain("NGN 1,000.00");
    expect(values("AMOUNT")).not.toContain("NGN 5,432.10");
    expect(values("DATE")).toContain("2026-10-20T12:34");
    expect(values("REFERENCE")).toContain("202610201234567890");
    expect(values("PHONE")).toContain("+2348031234567");
    expect(values("PROVIDER")).toEqual(expect.arrayContaining(["GTBank", "MTN"]));
    expect(values("SERVICE_TYPE")).toContain("AIRTIME");
    expect(values("STATUS")).toEqual(expect.arrayContaining(["debited", "successful"]));
    expect(values("ACCOUNT_MASK")).toContain("****4412");
  });

  it("keeps the locator and snippet for every fact", () => {
    const facts = extractFactsFromPages([page(GTB_TEXT)]);
    for (const fact of facts) {
      expect(fact.locator.page).toBe(1);
      expect(fact.locator.line).toBeGreaterThanOrEqual(0);
      expect(fact.locator.charStart).toBeGreaterThanOrEqual(0);
      expect(fact.locator.charEnd).toBeGreaterThan(fact.locator.charStart);
      expect(fact.snippet.length).toBeGreaterThan(0);
      expect(fact.extractor).toBe("prooftrail-ng-alert-rules");
      expect(fact.extractorVersion).toBe("1.0.0");
    }
  });

  it("reads a contrasting failed receipt as its own set of facts", () => {
    const facts = extractFactsFromPages([page(MTN_TEXT)]);
    const values = (type: string) =>
      facts.filter((fact) => fact.type === type).map((fact) => fact.normalizedValue);

    expect(values("STATUS")).toEqual(expect.arrayContaining(["failed", "completed"]));
    expect(values("REFERENCE")).toContain("MTN-7741-2026");
    expect(values("DATE")).toContain("2026-10-20T12:35");
    expect(values("SERVICE_TYPE")).toContain("AIRTIME");
  });

  it("does not invent facts from unrelated text", () => {
    const facts = extractFactsFromPages([page("Hello, this is a plain note with no transaction.")]);
    expect(facts).toHaveLength(0);
  });
});
