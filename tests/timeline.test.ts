import { describe, expect, it } from "vitest";
import { buildTimeline } from "@/lib/timeline";
import type { EffectiveFact } from "@/lib/facts/effective";

function dateFact(input: {
  id: string;
  evidenceId: string;
  normalizedValue: string;
  status?: EffectiveFact["status"];
  revisions?: EffectiveFact["revisions"];
}): EffectiveFact {
  return {
    id: input.id,
    evidenceId: input.evidenceId,
    type: "DATE",
    originalValue: "20/10/2026 12:34 PM",
    originalNormalizedValue: input.normalizedValue,
    displayValue: "20/10/2026 12:34 PM",
    normalizedValue: input.normalizedValue,
    confidence: 0.84,
    locator: { kind: "pdf", page: 1, charStart: 0, charEnd: 22, line: 0 },
    snippet: "on 20/10/2026 12:34 PM.",
    status: input.status ?? "original",
    revisions: input.revisions ?? [],
  };
}

describe("buildTimeline", () => {
  it("renders extracted wall-clock times without a server-timezone shift", () => {
    const entries = buildTimeline({
      caseCreatedAt: new Date("2026-10-21T13:00:00Z"),
      caseTitle: "Demo case",
      evidence: [{ id: "e1", originalName: "alert.pdf", createdAt: new Date("2026-10-21T13:00:00Z"), extractionStatus: "COMPLETED" }],
      facts: [dateFact({ id: "f1", evidenceId: "e1", normalizedValue: "2026-10-20T12:34" })],
      evidenceNames: new Map([["e1", "alert.pdf"]]),
      reports: [],
    });

    const factEntry = entries.find((entry) => entry.kind === "fact");
    expect(factEntry?.at).toBe("2026-10-20T12:34:00.000Z");
    expect(factEntry?.label).toBe("Transaction date");
    expect(factEntry?.detail).toBe("Reported in alert.pdf");
  });

  it("groups the same date across duplicate evidence files", () => {
    const entries = buildTimeline({
      caseCreatedAt: new Date("2026-10-21T13:00:00Z"),
      caseTitle: "Demo case",
      evidence: [],
      facts: [
        dateFact({ id: "f1", evidenceId: "e1", normalizedValue: "2026-10-20T12:34" }),
        dateFact({ id: "f2", evidenceId: "e2", normalizedValue: "2026-10-20T12:34" }),
      ],
      evidenceNames: new Map([
        ["e1", "alert.pdf"],
        ["e2", "alert-copy.pdf"],
      ]),
      reports: [],
    });

    const factEntries = entries.filter((entry) => entry.kind === "fact");
    expect(factEntries).toHaveLength(1);
    expect(factEntries[0].detail).toBe("Reported in alert.pdf, alert-copy.pdf");
  });

  it("omits rejected date facts and keeps case events", () => {
    const entries = buildTimeline({
      caseCreatedAt: new Date("2026-10-21T13:00:00Z"),
      caseTitle: "Demo case",
      evidence: [],
      facts: [
        dateFact({
          id: "f1",
          evidenceId: "e1",
          normalizedValue: "2026-10-20T12:34",
          status: "rejected",
        }),
      ],
      evidenceNames: new Map([["e1", "alert.pdf"]]),
      reports: [{ id: "r1", createdAt: new Date("2026-10-21T14:00:00Z") }],
    });

    expect(entries.some((entry) => entry.kind === "fact")).toBe(false);
    expect(entries.map((entry) => entry.kind)).toEqual(["case", "report"]);
    expect(entries[1].label).toBe("Case report generated");
  });
});
