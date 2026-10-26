export type ServiceTypeValue = "AIRTIME" | "DATA" | "OTHER";
export type CaseStatusValue = "DRAFT" | "EVIDENCE_REVIEW" | "READY" | "CLOSED";
export type EvidenceKindValue = "IMAGE" | "PDF" | "TEXT";
export type ExtractionStatusValue =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "UNSUPPORTED";
export type FactTypeValue =
  | "AMOUNT"
  | "DATE"
  | "REFERENCE"
  | "PHONE"
  | "STATUS"
  | "SERVICE_TYPE"
  | "PROVIDER"
  | "RECIPIENT"
  | "ACCOUNT_MASK"
  | "DESCRIPTION";
export type RevisionActionValue = "CORRECT" | "REJECT" | "RESTORE";

export type BBox = { x: number; y: number; w: number; h: number };

export type SourceLocator = {
  kind: "pdf" | "image" | "text";
  page: number;
  charStart: number;
  charEnd: number;
  line?: number;
  bbox?: BBox;
  units?: "pt" | "px" | "chars";
  pageWidth?: number;
  pageHeight?: number;
};

export type EvidenceView = {
  id: string;
  originalName: string;
  mimeType: string;
  kind: EvidenceKindValue;
  sizeBytes: number;
  sha256: string;
  extractionStatus: ExtractionStatusValue;
  extractionError: string | null;
  extractionNotes: string | null;
  pageCount: number | null;
  createdAt: string;
  factCount: number;
  duplicateOf: string[];
};

export type FactRevisionView = {
  id: string;
  action: RevisionActionValue;
  previousValue: string | null;
  newValue: string | null;
  note: string | null;
  actorName: string;
  createdAt: string;
};

export type FactView = {
  id: string;
  evidenceId: string;
  evidenceName: string;
  type: FactTypeValue;
  rawValue: string;
  normalizedValue: string | null;
  confidence: number;
  locator: SourceLocator | null;
  snippet: string | null;
  extractor: string;
  extractorVersion: string;
  reviewedAt: string | null;
  createdAt: string;
  status: "original" | "corrected" | "rejected";
  effectiveValue: string | null;
  revisions: FactRevisionView[];
};

export type CaseSummary = {
  id: string;
  title: string;
  serviceType: ServiceTypeValue;
  provider: string | null;
  claimedAmount: number | null;
  currency: string;
  incidentDate: string | null;
  transactionReference: string | null;
  customerPhone: string | null;
  description: string | null;
  status: CaseStatusValue;
  createdAt: string;
  updatedAt: string;
  evidenceCount: number;
  factCount: number;
  findingCount?: number;
};

export type Severity = "high" | "medium" | "low" | "info";

export type Finding = {
  id: string;
  code: string;
  title: string;
  severity: Severity;
  category: "amount" | "date" | "reference" | "evidence" | "status" | "service" | "identity";
  explanation: string;
  recommendation: string;
  evidenceIds: string[];
  factIds: string[];
};

export type TimelineEntry = {
  id: string;
  at: string | null;
  kind: "case" | "evidence" | "fact" | "correction" | "report";
  label: string;
  detail: string;
  evidenceId?: string;
  factId?: string;
};

export type CaseEventView = {
  id: string;
  type: string;
  summary: string;
  actorName: string | null;
  createdAt: string;
};

export type ReportView = {
  id: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
  createdByName: string;
};

export type CaseDetail = CaseSummary & {
  evidence: EvidenceView[];
  facts: FactView[];
  discrepancies: Finding[];
  timeline: TimelineEntry[];
  events: CaseEventView[];
  reports: ReportView[];
};
