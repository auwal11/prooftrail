import { describe, expect, it } from "vitest";
import { amountsWithinTolerance, formatMoney, parseAmountToMinor } from "@/lib/money";

describe("parseAmountToMinor", () => {
  it("parses NGN amounts with symbols, commas and spaces", () => {
    expect(parseAmountToMinor("NGN 1,000.00")?.minor).toBe(100000);
    expect(parseAmountToMinor("₦1,000.00")?.minor).toBe(100000);
    expect(parseAmountToMinor("N1,000")?.minor).toBe(100000);
    expect(parseAmountToMinor("1,234.5")?.minor).toBe(123450);
  });

  it("rejects zero, negative, malformed and unreasonably large amounts", () => {
    expect(parseAmountToMinor("0.00")).toBeNull();
    expect(parseAmountToMinor("-100.00")).toBeNull();
    expect(parseAmountToMinor("1.234")).toBeNull();
    expect(parseAmountToMinor("ten thousand")).toBeNull();
    expect(parseAmountToMinor("999999999999.00")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats minor units and major units consistently", () => {
    expect(formatMoney(1000)).toBe("NGN 1,000.00");
    expect(formatMoney("1000.5")).toBe("NGN 1,000.50");
    expect(formatMoney(null)).toBe("Not provided");
  });
});

describe("amountsWithinTolerance", () => {
  it("allows a one-kobo tolerance by default", () => {
    expect(amountsWithinTolerance(100000, 100001)).toBe(true);
    expect(amountsWithinTolerance(100000, 100002)).toBe(false);
  });
});
