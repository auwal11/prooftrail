import type { TimelineEntry } from "@/lib/domain";
import type { EffectiveFact } from "@/lib/facts/effective";

// Extracted dates are authored in the customer's local time and stored without a
// zone marker. Treat them as UTC so the rendered wall-clock time is not shifted
// by the server's timezone.
function toUtcIso(value: string): string | null {
  const withZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00.000Z`
    : value.includes("T")
      ? value.endsWith("Z")
        ? value
        : `${value}Z`
      : `${value}T00:00:00.000Z`;

  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export type TimelineEvidence = {
  id: string;
  originalName: string;
  createdAt: Date;
  extractionStatus: string;
};

export type TimelineReport = {
  id: string;
  createdAt: Date;
};

export function buildTimeline(input: {
  caseCreatedAt: Date;
  caseTitle: string;
  evidence: TimelineEvidence[];
  facts: EffectiveFact[];
  evidenceNames: Map<string, string>;
  reports: TimelineReport[];
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      id: "case-created",
      at: input.caseCreatedAt.toISOString(),
      kind: "case",
      label: "Case opened",
      detail: input.caseTitle,
    },
  ];

  for (const item of input.evidence) {
    entries.push({
      id: `evidence-${item.id}`,
      at: item.createdAt.toISOString(),
      kind: "evidence",
      label: `Evidence added: ${item.originalName}`,
      detail: `Extraction status: ${item.extractionStatus.toLowerCase()}`,
      evidenceId: item.id,
    });
  }

  const dates = input.facts.filter(
    (fact) => fact.type === "DATE" && fact.normalizedValue && fact.status !== "rejected",
  );

  const dateGroups = new Map<
    string,
    { at: string; names: Set<string>; evidenceId: string; factId: string }
  >();
  for (const fact of dates) {
    const value = fact.normalizedValue!;
    const iso = toUtcIso(value);
    if (!iso) continue;

    const group = dateGroups.get(iso);
    if (group) {
      group.names.add(input.evidenceNames.get(fact.evidenceId) ?? "evidence");
      continue;
    }

    dateGroups.set(iso, {
      at: iso,
      names: new Set([input.evidenceNames.get(fact.evidenceId) ?? "evidence"]),
      evidenceId: fact.evidenceId,
      factId: fact.id,
    });
  }

  for (const group of dateGroups.values()) {
    entries.push({
      id: `fact-${group.factId}`,
      at: group.at,
      kind: "fact",
      label: "Transaction date",
      detail: `Reported in ${[...group.names].join(", ")}`,
      evidenceId: group.evidenceId,
      factId: group.factId,
    });
  }

  for (const fact of input.facts) {
    for (const revision of fact.revisions) {
      const description =
        revision.action === "REJECT"
          ? "Fact marked as not applicable"
          : revision.action === "RESTORE"
            ? "Fact restored to the original extraction"
            : "Fact corrected by reviewer";

      entries.push({
        id: `revision-${fact.id}-${revision.createdAt.getTime()}`,
        at: revision.createdAt.toISOString(),
        kind: "correction",
        label: description,
        detail: `${fact.type} in ${
          input.evidenceNames.get(fact.evidenceId) ?? "evidence"
        }${revision.newValue ? `: ${revision.newValue}` : ""} — ${revision.actor.name}`,
        evidenceId: fact.evidenceId,
        factId: fact.id,
      });
    }
  }

  for (const report of input.reports) {
    entries.push({
      id: `report-${report.id}`,
      at: report.createdAt.toISOString(),
      kind: "report",
      label: "Case report generated",
      detail: "A source-linked PDF report was produced for this case.",
    });
  }

  return entries.sort((a, b) => {
    if (!a.at && !b.at) return 0;
    if (!a.at) return 1;
    if (!b.at) return -1;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });
}
