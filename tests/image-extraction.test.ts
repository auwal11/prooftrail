import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractImage } from "@/lib/extract/image";
import { extractFactsFromPages } from "@/lib/facts/parser";

async function factsFor(name: string) {
  const fixture = path.join(process.cwd(), "tests/fixtures/receipts", name);
  const extraction = await extractImage(await readFile(fixture));
  return { extraction, facts: extractFactsFromPages(extraction.pages) };
}

function values(facts: Awaited<ReturnType<typeof factsFor>>["facts"], type: string) {
  return facts.filter((fact) => fact.type === type).map((fact) => fact.normalizedValue);
}

describe("supplied receipt image regressions", () => {
  it("extracts an OPay/MTN receipt with distinct cashback and bonus roles", async () => {
    const { extraction, facts } = await factsFor("opay-mtn-airtime.jpg");
    expect(extraction.text).toMatch(/MTN/i);
    expect(values(facts, "AMOUNT")).toEqual(expect.arrayContaining(["NGN 156.00", "NGN 154.20", "NGN 1.80", "NGN 41.40"]));
    expect(values(facts, "STATUS")).toContain("successful");
    expect(values(facts, "SERVICE_TYPE")).toContain("AIRTIME");
    expect(values(facts, "PHONE")).toContain("+2348032600058");
    expect(values(facts, "DATE")).toContain("2026-11-22T11:29");
    expect(values(facts, "REFERENCE")).toContain("261122100100935520972531");
    const amounts = facts.filter((fact) => fact.type === "AMOUNT");
    expect(amounts.find((fact) => fact.normalizedValue === "NGN 1.80")?.locator.semanticRole).toBe("CASHBACK");
    expect(amounts.find((fact) => fact.normalizedValue === "NGN 41.40")?.locator.semanticRole).toBe("BONUS");
  }, 120_000);

  it("extracts a dark Moniepoint receipt with balances and a wrapped reference", async () => {
    const { extraction, facts } = await factsFor("moniepoint-airtime-dark.jpg");
    expect(extraction.text).toMatch(/Transaction Details/i);
    expect(values(facts, "AMOUNT")).toEqual(expect.arrayContaining(["NGN 100.00", "NGN 378.66", "NGN 278.66"]));
    expect(values(facts, "STATUS")).toContain("successful");
    expect(values(facts, "SERVICE_TYPE")).toContain("AIRTIME");
    expect(values(facts, "DATE")).toContain("2026-11-19T13:16");
    expect(values(facts, "REFERENCE")).toContain("ATP|2MPT208YZ|2123389903303208960");
    const amounts = facts.filter((fact) => fact.type === "AMOUNT");
    expect(amounts.filter((fact) => fact.locator.semanticRole === "BALANCE").map((fact) => fact.normalizedValue)).toEqual(
      expect.arrayContaining(["NGN 378.66", "NGN 278.66"]),
    );
  }, 120_000);

  it("extracts a bank/debit receipt amount and phone without inventing absent status", async () => {
    const { extraction, facts } = await factsFor("interswitch-debit-airtime.jpg");
    expect(extraction.text).toMatch(/Transaction Details/i);
    expect(values(facts, "AMOUNT")).toContain("NGN 200.00");
    expect(values(facts, "PHONE")).toContain("+2349011887318");
    expect(values(facts, "DATE")).toEqual(expect.arrayContaining(["2026-11-20T20:57"]));
    expect(values(facts, "REFERENCE")).toContain("000118159468/000118159468");
    expect(values(facts, "STATUS")).toHaveLength(0);
  }, 120_000);
});
