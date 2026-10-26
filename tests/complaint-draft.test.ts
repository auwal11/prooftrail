import { describe, expect, it } from "vitest";
import { buildComplaintDraft } from "../src/lib/complaint-draft";

const base = {
  id: "cmvnh3w5q0002qx3nb5zzgatm",
  title: "Airtime not delivered",
  serviceType: "AIRTIME" as const,
  provider: "MTN",
  claimedAmount: 1000,
  currency: "NGN",
  incidentDate: "2026-10-20T00:00:00.000Z",
  transactionReference: "ABC123",
  customerPhone: "+2348031234567",
  userName: "Demo User",
  evidenceNames: ["debit-alert.pdf", "provider-sms.pdf"],
  openFindings: [
    { code: "MISSING_DELIVERY_PROOF", title: "Debit found, but no delivery confirmation", severity: "high" as const },
  ],
};

describe("buildComplaintDraft", () => {
  it("includes the case fields and open gaps", () => {
    const draft = buildComplaintDraft(base);
    expect(draft).toContain("PT-ZZGATM");
    expect(draft).toContain("MTN");
    expect(draft).toContain("NGN 1,000.00");
    expect(draft).toContain("20 Oct 2026");
    expect(draft).toContain("ABC123");
    expect(draft).toContain("+2348031234567");
    expect(draft).toContain("MISSING_DELIVERY_PROOF");
    expect(draft).toContain("Demo User");
  });

  it("stays neutral and does not claim fraud", () => {
    const draft = buildComplaintDraft(base);
    expect(draft).not.toMatch(/fraud|scam|criminal|stole/i);
    expect(draft).toContain("does not determine fault");
    expect(draft).toContain("has not contacted you");
  });

  it("handles missing optional details", () => {
    const draft = buildComplaintDraft({
      ...base,
      provider: null,
      transactionReference: null,
      customerPhone: null,
      evidenceNames: [],
      openFindings: [],
    });
    expect(draft).toContain("Not recorded");
    expect(draft).toContain("No evidence files were uploaded.");
    expect(draft).toContain("None identified from the uploaded text.");
  });
});
