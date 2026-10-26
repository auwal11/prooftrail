import type { ServiceTypeValue, Severity } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export type ComplaintCaseInfo = {
  id: string;
  title: string;
  serviceType: ServiceTypeValue;
  provider: string | null;
  claimedAmount: number | null;
  currency: string;
  incidentDate: string | null;
  transactionReference: string | null;
  customerPhone: string | null;
  userName: string;
  evidenceNames: string[];
  openFindings: { code: string; title: string; severity: Severity }[];
};

const SERVICE_LABEL: Record<ServiceTypeValue, string> = {
  AIRTIME: "Airtime",
  DATA: "Data",
  OTHER: "Other service",
};

export function buildComplaintDraft(info: ComplaintCaseInfo): string {
  const code = `PT-${info.id.slice(-6).toUpperCase()}`;
  const evidence =
    info.evidenceNames.length > 0
      ? info.evidenceNames.slice(0, 6).join("; ")
      : "No evidence files were uploaded.";
  const gaps =
    info.openFindings.length > 0
      ? info.openFindings.map((finding) => `${finding.title} [${finding.code}]`).join("; ")
      : "None identified from the uploaded text.";

  return [
    `Subject: Request for review - ${SERVICE_LABEL[info.serviceType]} transaction ${code}`,
    "",
    info.provider ? `Hello ${info.provider} support,` : "Hello,",
    "",
    "I am requesting a review of the transaction below. I have attached the documents I hold and a ProofTrail case report that summarises what they show.",
    "",
    `Case ID: ${code}`,
    `Incident date: ${formatDate(info.incidentDate)}`,
    `Amount: ${formatMoney(info.claimedAmount, info.currency)}`,
    `Service: ${SERVICE_LABEL[info.serviceType]}`,
    `Provider: ${info.provider || "Not recorded"}`,
    `Transaction reference: ${info.transactionReference || "Not recorded"}`,
    `Phone number affected: ${info.customerPhone || "Not recorded"}`,
    "",
    `Documents included: ${evidence}`,
    `Open information gaps: ${gaps}`,
    "",
    "The attached report records what the uploaded documents state, with file hashes and source references. It does not determine fault, and ProofTrail has not contacted you on my behalf.",
    "",
    "Please review the transaction and let me know the outcome or what further information you need.",
    "",
    "Regards,",
    info.userName,
  ].join("\n");
}
