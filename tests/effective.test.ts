import { describe, expect, it } from "vitest";
import { resolveFact, type FactRecord } from "@/lib/facts/effective";

function record(overrides: Partial<FactRecord> = {}): FactRecord {
  return {
    id: "fact-1",
    evidenceId: "e1",
    type: "AMOUNT",
    rawValue: "NGN 1,000.00",
    normalizedValue: "NGN 1,000.00",
    confidence: 0.93,
    locator: { kind: "pdf", page: 1, charStart: 0, charEnd: 12, line: 0 },
    snippet: "You have been debited NGN 1,000.00",
    extractor: "prooftrail-ng-alert-rules",
    extractorVersion: "1.0.0",
    createdAt: new Date("2026-10-21T13:00:00Z"),
    revisions: [],
    ...overrides,
  };
}

const actor = { name: "Demo Reviewer" };

describe("resolveFact", () => {
  it("returns the original extraction when nothing was reviewed", () => {
    const resolved = resolveFact(record());
    expect(resolved.status).toBe("original");
    expect(resolved.displayValue).toBe("NGN 1,000.00");
    expect(resolved.normalizedValue).toBe("NGN 1,000.00");
  });

  it("applies the latest correction without overwriting the original", () => {
    const resolved = resolveFact(
      record({
        revisions: [
          {
            action: "CORRECT",
            previousValue: null,
            newValue: "NGN 1,200.00",
            note: "OCR misread",
            createdAt: new Date("2026-10-21T14:00:00Z"),
            actor,
          },
        ],
      }),
    );

    expect(resolved.status).toBe("corrected");
    expect(resolved.displayValue).toBe("NGN 1,200.00");
    expect(resolved.normalizedValue).toBe("NGN 1,200.00");
    expect(resolved.originalValue).toBe("NGN 1,000.00");
  });

  it("honours reject and restore in chronological order", () => {
    const resolved = resolveFact(
      record({
        revisions: [
          {
            action: "REJECT",
            previousValue: null,
            newValue: null,
            note: null,
            createdAt: new Date("2026-10-21T14:00:00Z"),
            actor,
          },
          {
            action: "RESTORE",
            previousValue: null,
            newValue: null,
            note: null,
            createdAt: new Date("2026-10-21T15:00:00Z"),
            actor,
          },
        ],
      }),
    );

    expect(resolved.status).toBe("original");
    expect(resolved.displayValue).toBe("NGN 1,000.00");
  });

  it("normalises a corrected date the same way as an extracted date", () => {
    const resolved = resolveFact(
      record({
        type: "DATE",
        rawValue: "20/10/2026 12:34 PM",
        normalizedValue: "2026-10-20T12:34",
        revisions: [
          {
            action: "CORRECT",
            previousValue: null,
            newValue: "21/10/2026 1:05 PM",
            note: null,
            createdAt: new Date("2026-10-21T14:00:00Z"),
            actor,
          },
        ],
      }),
    );

    expect(resolved.normalizedValue).toBe("2026-10-21T13:05");
  });
});
