import type { FactTypeValue, RevisionActionValue, SourceLocator } from "@/lib/domain";
import { parseDateValue } from "@/lib/dates";
import { parseAmountToMinor } from "@/lib/money";

export type RevisionRecord = {
  action: RevisionActionValue;
  previousValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: Date;
  actor: { name: string };
};

export type FactRecord = {
  id: string;
  evidenceId: string;
  type: FactTypeValue;
  rawValue: string;
  normalizedValue: string | null;
  confidence: number;
  locator: SourceLocator | null;
  snippet: string | null;
  extractor: string;
  extractorVersion: string;
  createdAt: Date;
  revisions: RevisionRecord[];
};

export type EffectiveFact = {
  id: string;
  evidenceId: string;
  type: FactTypeValue;
  originalValue: string;
  originalNormalizedValue: string | null;
  displayValue: string;
  normalizedValue: string | null;
  confidence: number;
  locator: SourceLocator | null;
  snippet: string | null;
  status: "original" | "corrected" | "rejected";
  revisions: RevisionRecord[];
};

function normalizeForType(type: FactTypeValue, value: string): string | null {
  switch (type) {
    case "AMOUNT":
      return parseAmountToMinor(value)?.normalized ?? null;
    case "DATE":
      return parseDateValue(value)?.iso ?? null;
    case "REFERENCE":
      return value.trim().toUpperCase();
    case "PHONE": {
      const digits = value.replace(/[^\d+]/g, "");
      if (/^\+234\d{10}$/.test(digits)) return digits;
      if (/^0[789][01]\d{8}$/.test(digits)) return `+234${digits.slice(1)}`;
      return digits || null;
    }
    default:
      return value.trim() || null;
  }
}

export function resolveFact(fact: FactRecord): EffectiveFact {
  const ordered = [...fact.revisions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  let status: EffectiveFact["status"] = "original";
  let displayValue = fact.rawValue;

  for (const revision of ordered) {
    if (revision.action === "CORRECT" && revision.newValue) {
      displayValue = revision.newValue;
      status = "corrected";
    } else if (revision.action === "REJECT") {
      status = "rejected";
    } else if (revision.action === "RESTORE") {
      displayValue = fact.rawValue;
      status = "original";
    }
  }

  return {
    id: fact.id,
    evidenceId: fact.evidenceId,
    type: fact.type,
    originalValue: fact.rawValue,
    originalNormalizedValue: fact.normalizedValue,
    displayValue,
    normalizedValue:
      status === "original" ? fact.normalizedValue : normalizeForType(fact.type, displayValue),
    confidence: fact.confidence,
    locator: fact.locator,
    snippet: fact.snippet,
    status,
    revisions: ordered,
  };
}

export function resolveFacts(facts: FactRecord[]): EffectiveFact[] {
  return facts.map(resolveFact);
}

export function activeFacts(facts: EffectiveFact[]): EffectiveFact[] {
  return facts.filter((fact) => fact.status !== "rejected");
}
