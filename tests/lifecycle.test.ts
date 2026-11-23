import { describe, expect, it } from "vitest";
import { canTransition, lifecycleLabel } from "@/lib/lifecycle";

describe("case lifecycle", () => {
  it("allows evidence collection to move into review", () => {
    expect(canTransition("COLLECTING_EVIDENCE", "UNDER_REVIEW")).toBe(true);
  });

  it("does not allow a draft to claim a provider submission", () => {
    expect(canTransition("DRAFT", "SUBMITTED_TO_PROVIDER")).toBe(false);
  });

  it("uses explicit human-readable labels", () => {
    expect(lifecycleLabel("AWAITING_RESPONSE")).toBe("Awaiting response");
  });
});
