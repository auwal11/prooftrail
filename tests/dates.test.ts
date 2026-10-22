import { describe, expect, it } from "vitest";
import { daysBetween, parseDateValue } from "@/lib/dates";

describe("parseDateValue", () => {
  it("parses day-first numeric dates with a 12-hour time", () => {
    const parsed = parseDateValue("20/10/2026 12:34 PM");
    expect(parsed?.iso).toBe("2026-10-20T12:34");
    expect(parsed?.hasTime).toBe(true);
    expect(parsed?.date.toISOString()).toBe("2026-10-20T12:34:00.000Z");
  });

  it("does not read a two-digit year prefix from a four-digit year", () => {
    expect(parseDateValue("20/10/2026 12:34 PM")?.iso).toBe("2026-10-20T12:34");
    expect(parseDateValue("20/10/2026 12:34 PM")?.iso).not.toContain("2020");
  });

  it("resolves two-digit years against the reference year", () => {
    expect(parseDateValue("20/10/26 12:34", 2026)?.iso).toBe("2026-10-20T12:34");
    expect(parseDateValue("20/10/25", 2026)?.iso).toBe("2025-10-20");
  });

  it("parses named months and date-only values", () => {
    expect(parseDateValue("20 October 2026")?.iso).toBe("2026-10-20");
    expect(parseDateValue("October 20, 2026")?.iso).toBe("2026-10-20");
  });

  it("rejects impossible and out-of-range dates", () => {
    expect(parseDateValue("31/02/2026")).toBeNull();
    expect(parseDateValue("20/13/2026")).toBeNull();
    expect(parseDateValue("20/10/1899")).toBeNull();
    expect(parseDateValue("not a date")).toBeNull();
  });

  it("converts midnight and noon correctly", () => {
    expect(parseDateValue("20/10/2026 12:00 AM")?.iso).toBe("2026-10-20T00:00");
    expect(parseDateValue("20/10/2026 12:00 PM")?.iso).toBe("2026-10-20T12:00");
  });
});

describe("daysBetween", () => {
  it("returns the absolute whole-day difference", () => {
    expect(
      daysBetween(new Date("2026-10-20T12:00:00Z"), new Date("2026-10-21T13:00:00Z")),
    ).toBe(1);
  });
});
