import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { detectDiscrepancies } from "@/lib/discrepancies";
import type {
  CaseDetail,
  CaseSummary,
  EvidenceView,
  FactView,
  SourceLocator,
} from "@/lib/domain";
import { resolveFact, resolveFacts, type FactRecord } from "@/lib/facts/effective";
import { buildTimeline } from "@/lib/timeline";

const caseInclude = {
  evidence: {
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { facts: true } } },
  },
  facts: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      evidence: { select: { originalName: true } },
      revisions: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
  },
  events: {
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true } } },
  },
  reports: {
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  },
} satisfies Prisma.CaseInclude;

type CaseRecord = Prisma.CaseGetPayload<{ include: typeof caseInclude }>;

function duplicateMap(caseRecord: CaseRecord): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const evidence of caseRecord.evidence) {
    const group = groups.get(evidence.sha256) ?? [];
    group.push(evidence.id);
    groups.set(evidence.sha256, group);
  }

  const duplicates = new Map<string, string[]>();
  for (const [, ids] of groups) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      duplicates.set(
        id,
        ids.filter((other) => other !== id),
      );
    }
  }
  return duplicates;
}

function toEvidenceViews(caseRecord: CaseRecord): EvidenceView[] {
  const duplicates = duplicateMap(caseRecord);
  return caseRecord.evidence.map((evidence) => ({
    id: evidence.id,
    originalName: evidence.originalName,
    mimeType: evidence.mimeType,
    kind: evidence.kind,
    sizeBytes: evidence.sizeBytes,
    sha256: evidence.sha256,
    extractionStatus: evidence.extractionStatus,
    extractionError: evidence.extractionError,
    extractionNotes: evidence.extractionNotes,
    pageCount: evidence.pageCount,
    createdAt: evidence.createdAt.toISOString(),
    factCount: evidence._count.facts,
    duplicateOf: duplicates.get(evidence.id) ?? [],
  }));
}

function toFactViews(caseRecord: CaseRecord): FactView[] {
  return caseRecord.facts.map((fact) => {
    const record: FactRecord = {
      id: fact.id,
      evidenceId: fact.evidenceId,
      type: fact.type,
      rawValue: fact.rawValue,
      normalizedValue: fact.normalizedValue,
      confidence: fact.confidence,
      locator: (fact.locator as unknown as SourceLocator | null) ?? null,
      snippet: fact.snippet,
      extractor: fact.extractor,
      extractorVersion: fact.extractorVersion,
      createdAt: fact.createdAt,
      revisions: fact.revisions.map((revision) => ({
        action: revision.action,
        previousValue: revision.previousValue,
        newValue: revision.newValue,
        note: revision.note,
        createdAt: revision.createdAt,
        actor: revision.actor,
      })),
    };

    const effective = resolveFact(record);

    return {
      id: fact.id,
      evidenceId: fact.evidenceId,
      evidenceName: fact.evidence.originalName,
      type: fact.type,
      rawValue: fact.rawValue,
      normalizedValue: fact.normalizedValue,
      confidence: fact.confidence,
      locator: record.locator,
      snippet: fact.snippet,
      extractor: fact.extractor,
      extractorVersion: fact.extractorVersion,
      createdAt: fact.createdAt.toISOString(),
      status: effective.status,
      effectiveValue:
        effective.status === "rejected" ? null : effective.displayValue,
      revisions: fact.revisions.map((revision) => ({
        id: revision.id,
        action: revision.action,
        previousValue: revision.previousValue,
        newValue: revision.newValue,
        note: revision.note,
        actorName: revision.actor.name,
        createdAt: revision.createdAt.toISOString(),
      })),
    };
  });
}

function toSummary(caseRecord: CaseRecord): CaseSummary {
  return {
    id: caseRecord.id,
    title: caseRecord.title,
    serviceType: caseRecord.serviceType,
    provider: caseRecord.provider,
    claimedAmount:
      caseRecord.claimedAmount === null ? null : Number(caseRecord.claimedAmount),
    currency: caseRecord.currency,
    incidentDate: caseRecord.incidentDate?.toISOString() ?? null,
    transactionReference: caseRecord.transactionReference,
    customerPhone: caseRecord.customerPhone,
    description: caseRecord.description,
    status: caseRecord.status,
    createdAt: caseRecord.createdAt.toISOString(),
    updatedAt: caseRecord.updatedAt.toISOString(),
    evidenceCount: caseRecord.evidence.length,
    factCount: caseRecord.facts.length,
    findingCount: undefined,
  };
}

export async function getCaseDetail(userId: string, caseId: string): Promise<CaseDetail | null> {
  const caseRecord = await db.case.findFirst({
    where: { id: caseId, userId },
    include: caseInclude,
  });

  if (!caseRecord) return null;

  const evidence = toEvidenceViews(caseRecord);
  const facts = toFactViews(caseRecord);
  const effectiveFacts = resolveFacts(
    caseRecord.facts.map((fact) => ({
      id: fact.id,
      evidenceId: fact.evidenceId,
      type: fact.type,
      rawValue: fact.rawValue,
      normalizedValue: fact.normalizedValue,
      confidence: fact.confidence,
      locator: (fact.locator as unknown as SourceLocator | null) ?? null,
      snippet: fact.snippet,
      extractor: fact.extractor,
      extractorVersion: fact.extractorVersion,
      createdAt: fact.createdAt,
      revisions: fact.revisions.map((revision) => ({
        action: revision.action,
        previousValue: revision.previousValue,
        newValue: revision.newValue,
        note: revision.note,
        createdAt: revision.createdAt,
        actor: revision.actor,
      })),
    })),
  );

  const evidenceNames = new Map(caseRecord.evidence.map((item) => [item.id, item.originalName]));

  const discrepancies = detectDiscrepancies({
    caseRecord: {
      serviceType: caseRecord.serviceType,
      provider: caseRecord.provider,
      claimedAmountMinor:
        caseRecord.claimedAmount === null
          ? null
          : Math.round(Number(caseRecord.claimedAmount) * 100),
      currency: caseRecord.currency,
      incidentDate: caseRecord.incidentDate,
      transactionReference: caseRecord.transactionReference,
      customerPhone: caseRecord.customerPhone,
      createdAt: caseRecord.createdAt,
    },
    evidence: caseRecord.evidence.map((item) => ({
      id: item.id,
      originalName: item.originalName,
      sha256: item.sha256,
      extractionStatus: item.extractionStatus,
      extractedText: item.extractedText,
    })),
    facts: effectiveFacts,
  });

  const timeline = buildTimeline({
    caseCreatedAt: caseRecord.createdAt,
    caseTitle: caseRecord.title,
    evidence: caseRecord.evidence.map((item) => ({
      id: item.id,
      originalName: item.originalName,
      createdAt: item.createdAt,
      extractionStatus: item.extractionStatus,
    })),
    facts: effectiveFacts,
    evidenceNames,
    reports: caseRecord.reports.map((report) => ({
      id: report.id,
      createdAt: report.createdAt,
    })),
  });

  return {
    ...toSummary(caseRecord),
    evidence,
    facts,
    discrepancies,
    timeline,
    events: caseRecord.events.map((event) => ({
      id: event.id,
      type: event.type,
      summary: event.summary,
      actorName: event.actor?.name ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    reports: caseRecord.reports.map((report) => ({
      id: report.id,
      sha256: report.sha256,
      sizeBytes: report.sizeBytes,
      createdAt: report.createdAt.toISOString(),
      createdByName: report.createdBy.name,
    })),
    findingCount: discrepancies.length,
  };
}

export async function listCases(userId: string): Promise<CaseSummary[]> {
  const cases = await db.case.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      evidence: { select: { id: true } },
      facts: { select: { id: true } },
    },
  });

  return cases.map((item) => ({
    id: item.id,
    title: item.title,
    serviceType: item.serviceType,
    provider: item.provider,
    claimedAmount: item.claimedAmount === null ? null : Number(item.claimedAmount),
    currency: item.currency,
    incidentDate: item.incidentDate?.toISOString() ?? null,
    transactionReference: item.transactionReference,
    customerPhone: item.customerPhone,
    description: item.description,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    evidenceCount: item.evidence.length,
    factCount: item.facts.length,
  }));
}

export async function caseBelongsToUser(caseId: string, userId: string): Promise<boolean> {
  const found = await db.case.findFirst({
    where: { id: caseId, userId },
    select: { id: true },
  });
  return Boolean(found);
}
