import type { LifecycleStatusValue } from "@/lib/domain";

export const LIFECYCLE_LABEL: Record<LifecycleStatusValue, string> = {
  DRAFT: "Draft",
  COLLECTING_EVIDENCE: "Collecting evidence",
  UNDER_REVIEW: "Under review",
  REPORT_READY: "Report ready",
  SUBMITTED_TO_PROVIDER: "Submitted to provider",
  AWAITING_RESPONSE: "Awaiting response",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const TRANSITIONS: Record<LifecycleStatusValue, LifecycleStatusValue[]> = {
  DRAFT: ["COLLECTING_EVIDENCE", "CLOSED"],
  COLLECTING_EVIDENCE: ["DRAFT", "UNDER_REVIEW", "CLOSED"],
  UNDER_REVIEW: ["COLLECTING_EVIDENCE", "REPORT_READY", "CLOSED"],
  REPORT_READY: ["UNDER_REVIEW", "SUBMITTED_TO_PROVIDER", "CLOSED"],
  SUBMITTED_TO_PROVIDER: ["AWAITING_RESPONSE", "RESOLVED", "CLOSED"],
  AWAITING_RESPONSE: ["SUBMITTED_TO_PROVIDER", "RESOLVED", "CLOSED"],
  RESOLVED: ["SUBMITTED_TO_PROVIDER", "CLOSED"],
  CLOSED: ["DRAFT", "COLLECTING_EVIDENCE", "UNDER_REVIEW", "REPORT_READY", "SUBMITTED_TO_PROVIDER", "AWAITING_RESPONSE", "RESOLVED"],
};

export function canTransition(from: LifecycleStatusValue, to: LifecycleStatusValue): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function lifecycleLabel(status: LifecycleStatusValue): string {
  return LIFECYCLE_LABEL[status];
}
