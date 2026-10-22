import { describe, expect, it } from "vitest";
import { detectDiscrepancies, type DiscrepancyInput } from "@/lib/discrepancies";
import type { EffectiveFact } from "@/lib/facts/effective";
import type { FactTypeValue } from "@/lib/domain";

let sequence = 0;

function fact(
  type: FactTypeValue,
  normalizedValue: string,
  evidenceId = "e1",
): EffectiveFact {
  sequence += 1;
  return {
    id: `f${sequence}`,
    evidenceId,
    type,
    originalValue: normalizedValue,
    originalNormalizedValue: normalizedValue,
    displayValue: normalizedValue,
    normalizedValue,
    confidence: 0.9,
    locator: { kind: "pdf", page: 1, charStart: 0, charEnd: 10, line: 0 },
    snippet: normalizedValue,
    status: "original",
    revisions: [],
  };
}

const CASE: DiscrepancyInput["caseRecord"] = {
  serviceType: "AIRTIME",
  provider: "MTN",
  claimedAmountMinor: 100000,
  currency: "NGN",
  incidentDate: new Date("2026-10-20T00:00:00Z"),
  transactionReference: "202610201234567890",
  customerPhone: "+2348031234567",
  createdAt: new Date("2026-10-21T13:00:00Z"),
};

const EVIDENCE: DiscrepancyInput["evidence"] = [
  {
    id: "e1",
    originalName: "gtbank-debit-alert.pdf",
    sha256: "a".repeat(64),
    extractionStatus: "COMPLETED",
    extractedText: "You have been debited NGN 1,000.00 for MTN Airtime. Status: Successful.",
  },
  {
    id: "e2",
    originalName: "mtn-receipt.pdf",
    sha256: "b".repeat(64),
    extractionStatus: "COMPLETED",
    extractedText: "Status: Failed. The recharge was not completed.",
  },
];

function codes(input: Partial<DiscrepancyInput> = {}) {
  return detectDiscrepancies({
    caseRecord: CASE,
    evidence: EVIDENCE,
    facts: [
      fact("AMOUNT", "NGN 1,000.00", "e1"),
      fact("AMOUNT", "NGN 1,000.00", "e2"),
      fact("DATE", "2026-10-20T12:34", "e1"),
      fact("DATE", "2026-10-20T12:35", "e2"),
      fact("REFERENCE", "202610201234567890", "e1"),
      fact("REFERENCE", "MTN-7741-2026", "e2"),
      fact("STATUS", "debited", "e1"),
      fact("STATUS", "successful", "e1"),
      fact("STATUS", "failed", "e2"),
      fact("SERVICE_TYPE", "Airtime", "e1"),
      fact("PROVIDER", "MTN", "e1"),
      fact("PROVIDER", "GTBank", "e1"),
      fact("PHONE", "+2348031234567", "e1"),
    ],
    ...input,
  }).map((finding) => finding.code);
}

describe("detectDiscrepancies", () => {
  it("flags missing delivery proof and conflicting statuses without claiming fraud", () => {
    const findings = detectDiscrepancies({
      caseRecord: CASE,
      evidence: EVIDENCE,
      facts: [
        fact("AMOUNT", "NGN 1,000.00", "e1"),
        fact("STATUS", "debited", "e1"),
        fact("STATUS", "successful", "e1"),
        fact("STATUS", "failed", "e2"),
        fact("REFERENCE", "202610201234567890", "e1"),
        fact("REFERENCE", "MTN-7741-2026", "e2"),
      ],
    });

    const delivery = findings.find((finding) => finding.code === "MISSING_DELIVERY_PROOF");
    const status = findings.find((finding) => finding.code === "STATUS_CONFLICT");

    expect(delivery?.severity).toBe("high");
    expect(status?.severity).toBe("high");
    expect(delivery?.explanation).toMatch(/not proof/i);
    expect(status?.explanation).not.toMatch(/fraud/i);
  });

  it("reports amount, date, reference and phone variances when sources disagree", () => {
    const result = codes({
      caseRecord: { ...CASE, customerPhone: "+2348030000000" },
      facts: [
        fact("AMOUNT", "NGN 1,000.00", "e1"),
        fact("AMOUNT", "NGN 1,200.00", "e2"),
        fact("DATE", "2026-10-20T12:34", "e1"),
        fact("DATE", "2026-10-23T12:34", "e2"),
        fact("REFERENCE", "202610201234567890", "e1"),
        fact("REFERENCE", "MTN-7741-2026", "e2"),
        fact("PHONE", "+2348031234567", "e1"),
        fact("PHONE", "+2348099999999", "e2"),
        fact("STATUS", "debited", "e1"),
        fact("STATUS", "successful", "e1"),
      ],
    });

    expect(result).toEqual(
      expect.arrayContaining([
        "AMOUNT_VARIANCE",
        "DATE_VARIANCE",
        "REFERENCE_VARIANCE",
        "PHONE_MISMATCH",
        "MISSING_DELIVERY_PROOF",
      ]),
    );
  });

  it("flags identical evidence by hash", () => {
    const result = codes({
      evidence: [
        { ...EVIDENCE[0], id: "e1", originalName: "alert.pdf", sha256: "c".repeat(64) },
        { ...EVIDENCE[0], id: "e2", originalName: "alert-copy.pdf", sha256: "c".repeat(64) },
      ],
    });
    expect(result).toContain("DUPLICATE_EVIDENCE");
  });

  it("returns no evidence finding for an empty case", () => {
    const findings = detectDiscrepancies({
      caseRecord: CASE,
      evidence: [],
      facts: [],
    });
    expect(findings.map((finding) => finding.code)).toContain("NO_EVIDENCE");
  });

  it("reports a missing amount when the evidence has none", () => {
    const result = codes({
      facts: [
        fact("DATE", "2026-10-20T12:34", "e1"),
        fact("STATUS", "debited", "e1"),
      ],
    });
    expect(result).toContain("MISSING_AMOUNT");
  });
});
