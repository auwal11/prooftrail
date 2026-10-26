import { createHash } from "node:crypto";
import type { Finding, ServiceTypeValue, Severity } from "@/lib/domain";
import { daysBetween, formatDate } from "@/lib/dates";
import { formatMinor } from "@/lib/money";
import type { EffectiveFact } from "@/lib/facts/effective";
import { activeFacts } from "@/lib/facts/effective";

export type DiscrepancyEvidence = {
  id: string;
  originalName: string;
  sha256: string;
  extractionStatus: string;
  extractedText: string | null;
};

export type DiscrepancyCase = {
  serviceType: ServiceTypeValue;
  provider: string | null;
  claimedAmountMinor: number | null;
  currency: string;
  incidentDate: Date | null;
  transactionReference: string | null;
  customerPhone: string | null;
  createdAt: Date;
};

export type DiscrepancyInput = {
  caseRecord: DiscrepancyCase;
  evidence: DiscrepancyEvidence[];
  facts: EffectiveFact[];
  now?: Date;
};

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };

function makeFinding(input: Omit<Finding, "id">): Finding {
  const id = createHash("sha1")
    .update(
      [
        input.code,
        ...[...input.factIds].sort(),
        ...[...input.evidenceIds].sort(),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 12);
  return { ...input, id };
}

function normalizeReference(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizePhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  if (/^0[789][01]\d{8}$/.test(digits)) return `+234${digits.slice(1)}`;
  return digits;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function detectDiscrepancies(input: DiscrepancyInput): Finding[] {
  const now = input.now ?? new Date();
  const findings: Finding[] = [];
  const facts = activeFacts(input.facts);
  const byType = (type: EffectiveFact["type"]) => facts.filter((fact) => fact.type === type);

  const amounts = byType("AMOUNT").filter((fact) => fact.normalizedValue);
  const dates = byType("DATE").filter((fact) => fact.normalizedValue);
  const references = byType("REFERENCE").filter((fact) => fact.normalizedValue);
  const statuses = byType("STATUS").filter((fact) => fact.normalizedValue);
  const services = byType("SERVICE_TYPE").filter((fact) => fact.normalizedValue);
  const providers = byType("PROVIDER").filter((fact) => fact.normalizedValue);
  const phones = byType("PHONE").filter((fact) => fact.normalizedValue);

  const amountMinorValues = uniqueValues(
    amounts.map((fact) => {
      const match = /(\d[\d,]*\.\d{2})/.exec(fact.normalizedValue ?? "");
      return match ? match[1] : (fact.normalizedValue ?? "");
    }),
  )
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.round(value * 100));

  const textCorpus = input.evidence
    .map((item) => item.extractedText ?? "")
    .join("\n")
    .toLowerCase();

  const statusValues = uniqueValues(statuses.map((fact) => fact.normalizedValue!));
  const debitDetected =
    statusValues.includes("debited") ||
    /\b(?:debited|charged|purchase|paid for)\b/i.test(textCorpus);

  const deliveryEvidence =
    /\bdelivered\b|\bdelivery confirmation\b|\bsuccessfully (?:sent|delivered)\b|\bbundle (?:activated|credited)\b|\bairtime (?:sent|delivered)\b/i.test(
      textCorpus,
    ) ||
    facts.some(
      (fact) =>
        fact.type === "DESCRIPTION" &&
        /deliver|activated|credited/i.test(`${fact.normalizedValue ?? ""} ${fact.displayValue}`),
    );

  if (input.evidence.length === 0) {
    findings.push(
      makeFinding({
        code: "NO_EVIDENCE",
        title: "No evidence has been uploaded",
        severity: "medium",
        category: "evidence",
        explanation:
          "This case currently contains no evidence files, so no facts can be traced to a source.",
        recommendation:
          "Upload the debit alert, transaction receipt, and any delivery confirmation or provider response.",
        evidenceIds: [],
        factIds: [],
      }),
    );
  }

  const incomplete = input.evidence.filter(
    (item) =>
      item.extractionStatus === "FAILED" ||
      item.extractionStatus === "UNSUPPORTED" ||
      (item.extractionStatus === "COMPLETED" &&
        (item.extractedText ?? "").trim().length === 0),
  );

  if (incomplete.length > 0) {
    findings.push(
      makeFinding({
        code: "EXTRACTION_INCOMPLETE",
        title: "Some evidence could not be read reliably",
        severity: "medium",
        category: "evidence",
        explanation: `${incomplete.length} file(s) produced no usable text or could not be processed: ${incomplete
          .map((item) => item.originalName)
          .join(", ")}. Any conclusion may be missing information contained in these files.`,
        recommendation:
          "Open each file, confirm it is legible, and retry extraction. If the file is a scan, upload a clearer image or the original PDF where possible.",
        evidenceIds: incomplete.map((item) => item.id),
        factIds: [],
      }),
    );
  }

  const duplicateGroups = new Map<string, DiscrepancyEvidence[]>();
  for (const item of input.evidence) {
    const group = duplicateGroups.get(item.sha256) ?? [];
    group.push(item);
    duplicateGroups.set(item.sha256, group);
  }

  for (const [hash, group] of duplicateGroups) {
    if (group.length < 2) continue;
    findings.push(
      makeFinding({
        code: "DUPLICATE_EVIDENCE",
        title: "Identical evidence files detected",
        severity: "medium",
        category: "evidence",
        explanation: `${group.length} files share the same SHA-256 hash (${hash.slice(
          0,
          16,
        )}…), which means their content is byte-for-byte identical: ${group
          .map((item) => item.originalName)
          .join(", ")}. This may be a deliberate copy or an accidental re-upload.`,
        recommendation:
          "Confirm whether the duplicates represent separate records. If not, remove the extra copies so the evidence list is unambiguous.",
        evidenceIds: group.map((item) => item.id),
        factIds: [],
      }),
    );
  }

  if (input.evidence.length > 0 && amounts.length === 0) {
    findings.push(
      makeFinding({
        code: "MISSING_AMOUNT",
        title: "No transaction amount was found",
        severity: "medium",
        category: "amount",
        explanation:
          "No amount could be extracted from the uploaded evidence. The disputed value therefore cannot be compared with the claim.",
        recommendation:
          "Upload a receipt or alert that clearly shows the amount, or correct the case's claimed amount if it was entered incorrectly.",
        evidenceIds: input.evidence.map((item) => item.id),
        factIds: [],
      }),
    );
  }

  const claimed = input.caseRecord.claimedAmountMinor;
  if (claimed && amounts.length > 0) {
    const matching = amountMinorValues.some((value) => Math.abs(value - claimed) <= 100);
    if (!matching) {
      findings.push(
        makeFinding({
          code: "CLAIM_AMOUNT_MISMATCH",
          title: "Claimed amount does not match any extracted amount",
          severity: "high",
          category: "amount",
          explanation: `The case claims ${input.caseRecord.currency} ${formatMinor(
            claimed,
          )}, but the amounts extracted from evidence are ${amountMinorValues
            .map((value) => `${input.caseRecord.currency} ${formatMinor(value)}`)
            .join(", ")}. This is a discrepancy to investigate, not proof of wrongdoing; fees or partial transactions can explain part of a difference.`,
          recommendation:
            "Check whether fees, cashback, or a partial delivery explain the difference, and confirm which amount the customer says was debited.",
          evidenceIds: uniqueValues(amounts.map((fact) => fact.evidenceId)),
          factIds: amounts.map((fact) => fact.id),
        }),
      );
    }
  }

  if (amountMinorValues.length > 1) {
    const spread = Math.max(...amountMinorValues) - Math.min(...amountMinorValues);
    if (spread > 100) {
      findings.push(
        makeFinding({
          code: "AMOUNT_VARIANCE",
          title: "Evidence reports more than one amount",
          severity: "low",
          category: "amount",
          explanation: `Different extracted amounts were found: ${amountMinorValues
            .map((value) => `${input.caseRecord.currency} ${formatMinor(value)}`)
            .join(", ")}. This can be legitimate when a fee or balance is printed alongside the transaction value.`,
          recommendation:
            "Identify which amount is the debit, which is a fee, and which is a running balance. Correct any fact that was misread.",
          evidenceIds: uniqueValues(amounts.map((fact) => fact.evidenceId)),
          factIds: amounts.map((fact) => fact.id),
        }),
      );
    }
  }

  if (input.evidence.length > 0 && dates.length === 0) {
    findings.push(
      makeFinding({
        code: "MISSING_DATE",
        title: "No transaction date was found",
        severity: "low",
        category: "date",
        explanation:
          "None of the uploaded evidence produced a readable date. Without a date, the transaction cannot be placed reliably on a timeline.",
        recommendation:
          "Upload a document that shows the transaction date and time, or add the date through fact review if the text was misread.",
        evidenceIds: input.evidence.map((item) => item.id),
        factIds: [],
      }),
    );
  }

  if (input.caseRecord.incidentDate && dates.length > 0) {
    const factDates = dates
      .map((fact) => new Date(fact.normalizedValue!))
      .filter((date) => !Number.isNaN(date.getTime()));

    const anyClose = factDates.some(
      (date) => daysBetween(date, input.caseRecord.incidentDate!) <= 1,
    );

    if (!anyClose) {
      findings.push(
        makeFinding({
          code: "DATE_MISMATCH",
          title: "Evidence dates differ from the reported incident date",
          severity: "medium",
          category: "date",
          explanation: `The case reports ${formatDate(
            input.caseRecord.incidentDate,
          )}, while the evidence contains ${uniqueValues(
            factDates.map((date) => formatDate(date)),
          ).join(", ")}.`,
          recommendation:
            "Confirm the correct date of the disputed transaction and check whether multiple transactions are being mixed in one case.",
          evidenceIds: uniqueValues(dates.map((fact) => fact.evidenceId)),
          factIds: dates.map((fact) => fact.id),
        }),
      );
    }
  }

  const distinctDays = uniqueValues(
    dates
      .map((fact) => fact.normalizedValue!.slice(0, 10))
      .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)),
  ).sort();
  if (distinctDays.length > 1) {
    const spread = daysBetween(
      new Date(`${distinctDays[0]}T00:00:00Z`),
      new Date(`${distinctDays[distinctDays.length - 1]}T00:00:00Z`),
    );
    if (spread > 1) {
      findings.push(
        makeFinding({
          code: "DATE_VARIANCE",
          title: "Evidence reports transaction dates that are days apart",
          severity: "low",
          category: "date",
          explanation: `Different calendar dates were extracted: ${distinctDays
            .map((day) => formatDate(`${day}T00:00:00Z`))
            .join(", ")}. This can mean multiple transactions are mixed together, or that a date was misread.`,
          recommendation:
            "Confirm which date belongs to the disputed transaction and separate unrelated transactions into their own case.",
          evidenceIds: uniqueValues(dates.map((fact) => fact.evidenceId)),
          factIds: dates.map((fact) => fact.id),
        }),
      );
    }
  }

  const futureCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const futureDates = dates.filter(
    (fact) => new Date(fact.normalizedValue!).getTime() > futureCutoff.getTime(),
  );
  if (futureDates.length > 0) {
    findings.push(
      makeFinding({
        code: "FUTURE_DATE",
        title: "A date in the future was extracted",
        severity: "medium",
        category: "date",
        explanation: `The evidence contains a date after today: ${futureDates
          .map((fact) => formatDate(fact.normalizedValue))
          .join(", ")}. The date may have been misread or the source may be unreliable.`,
        recommendation:
          "Verify the date against the original source and correct the extracted fact if necessary.",
        evidenceIds: uniqueValues(futureDates.map((fact) => fact.evidenceId)),
        factIds: futureDates.map((fact) => fact.id),
      }),
    );
  }

  if (!input.caseRecord.incidentDate) {
    findings.push(
      makeFinding({
        code: "MISSING_INCIDENT_DATE",
        title: "The case has no incident date",
        severity: "low",
        category: "date",
        explanation:
          "No incident date was recorded for this case, which weakens the timeline and any comparison with evidence dates.",
        recommendation: "Add the date the disputed transaction occurred.",
        evidenceIds: [],
        factIds: [],
      }),
    );
  }

  if (input.evidence.length > 0 && references.length === 0) {
    findings.push(
      makeFinding({
        code: "MISSING_REFERENCE",
        title: "No transaction reference was found",
        severity: "medium",
        category: "reference",
        explanation:
          "No transaction reference could be extracted from the evidence. References are typically required when a complaint is escalated to a bank or provider.",
        recommendation:
          "Upload a receipt or alert that includes the transaction reference, or capture it in the case details.",
        evidenceIds: input.evidence.map((item) => item.id),
        factIds: [],
      }),
    );
  }

  const referenceValues = uniqueValues(references.map((fact) => fact.normalizedValue!));

  if (input.caseRecord.transactionReference && referenceValues.length > 0) {
    const claimedReference = normalizeReference(input.caseRecord.transactionReference);
    const matched = referenceValues.some((value) => {
      const normalized = normalizeReference(value);
      return normalized === claimedReference || normalized.includes(claimedReference) || claimedReference.includes(normalized);
    });

    if (!matched) {
      findings.push(
        makeFinding({
          code: "REFERENCE_MISMATCH",
          title: "Case reference does not match the evidence",
          severity: "medium",
          category: "reference",
          explanation: `The case records reference "${input.caseRecord.transactionReference}", while the evidence contains ${referenceValues
            .map((value) => `"${value}"`)
            .join(", ")}.`,
          recommendation:
            "Check whether the case reference was typed incorrectly, or whether the uploaded evidence belongs to a different transaction.",
          evidenceIds: uniqueValues(references.map((fact) => fact.evidenceId)),
          factIds: references.map((fact) => fact.id),
        }),
      );
    }
  }

  if (referenceValues.length > 1) {
    findings.push(
      makeFinding({
        code: "REFERENCE_VARIANCE",
        title: "More than one transaction reference appears",
        severity: "medium",
        category: "reference",
        explanation: `The evidence contains different references: ${referenceValues
          .map((value) => `"${value}"`)
          .join(", ")}. This can mean multiple transactions are mixed together, or that a reference was misread.`,
        recommendation:
          "Confirm which reference belongs to the disputed debit and separate any unrelated transactions into their own case.",
        evidenceIds: uniqueValues(references.map((fact) => fact.evidenceId)),
        factIds: references.map((fact) => fact.id),
      }),
    );
  }

  const failedStatuses = statusValues.filter((value) => value === "failed");
  const successStatuses = statusValues.filter((value) =>
    ["successful", "completed", "credited"].includes(value),
  );
  if (failedStatuses.length > 0 && successStatuses.length > 0) {
    findings.push(
      makeFinding({
        code: "STATUS_CONFLICT",
        title: "Evidence contains conflicting transaction statuses",
        severity: "high",
        category: "status",
        explanation: `One source indicates the transaction failed, while another indicates it succeeded. Statuses found: ${statusValues.join(
          ", ",
        )}.`,
        recommendation:
          "Identify which source is authoritative and whether a retry or reversal occurred. Do not assume the service was delivered based on one message alone.",
        evidenceIds: uniqueValues(
          [...failedStatuses, ...successStatuses].flatMap((status) =>
            statuses
              .filter((fact) => fact.normalizedValue === status)
              .map((fact) => fact.evidenceId),
          ),
        ),
        factIds: statuses.map((fact) => fact.id),
      }),
    );
  }

  if (input.evidence.length > 0 && statuses.length === 0) {
    findings.push(
      makeFinding({
        code: "MISSING_STATUS",
        title: "No transaction status was found",
        severity: "low",
        category: "status",
        explanation:
          "The evidence does not clearly state whether the transaction succeeded, failed, or is pending.",
        recommendation:
          "Upload a message or receipt that shows the transaction status.",
        evidenceIds: input.evidence.map((item) => item.id),
        factIds: [],
      }),
    );
  }

  const serviceValues = uniqueValues(services.map((fact) => fact.normalizedValue!));
  if (input.caseRecord.serviceType === "AIRTIME" && serviceValues.includes("DATA") && !serviceValues.includes("AIRTIME")) {
    findings.push(
      makeFinding({
        code: "SERVICE_MISMATCH",
        title: "Evidence may describe a data purchase, not airtime",
        severity: "medium",
        category: "service",
        explanation:
          "This case is recorded as an airtime dispute, but the evidence mentions data or a bundle without mentioning airtime.",
        recommendation:
          "Confirm the service type on the original receipt. If the case is about data, update the case details.",
        evidenceIds: uniqueValues(services.map((fact) => fact.evidenceId)),
        factIds: services.map((fact) => fact.id),
      }),
    );
  } else if (
    input.caseRecord.serviceType === "DATA" &&
    serviceValues.includes("AIRTIME") &&
    !serviceValues.includes("DATA")
  ) {
    findings.push(
      makeFinding({
        code: "SERVICE_MISMATCH",
        title: "Evidence may describe an airtime purchase, not data",
        severity: "low",
        category: "service",
        explanation:
          "This case is recorded as a data dispute, but the evidence mentions airtime or recharge without mentioning data.",
        recommendation:
          "Confirm the service type on the original receipt and update the case if needed.",
        evidenceIds: uniqueValues(services.map((fact) => fact.evidenceId)),
        factIds: services.map((fact) => fact.id),
      }),
    );
  }

  if (input.caseRecord.provider) {
    const claimedProvider = input.caseRecord.provider.trim().toLowerCase();
    const providerValues = uniqueValues(providers.map((fact) => fact.normalizedValue!));
    if (
      providerValues.length > 0 &&
      !providerValues.some((value) => value.toLowerCase().includes(claimedProvider) || claimedProvider.includes(value.toLowerCase()))
    ) {
      findings.push(
        makeFinding({
          code: "PROVIDER_MISMATCH",
          title: "Provider in the case differs from the evidence",
          severity: "low",
          category: "service",
          explanation: `The case names "${input.caseRecord.provider}", while the evidence mentions ${providerValues
            .map((value) => `"${value}"`)
            .join(", ")}.`,
          recommendation:
            "Confirm the provider involved. A bank may appear in a debit alert while the telecom operator is the service provider.",
          evidenceIds: uniqueValues(providers.map((fact) => fact.evidenceId)),
          factIds: providers.map((fact) => fact.id),
        }),
      );
    }
  }

  if (input.caseRecord.customerPhone && phones.length > 0) {
    const claimedPhone = normalizePhone(input.caseRecord.customerPhone);
    const phoneValues = uniqueValues(phones.map((fact) => normalizePhone(fact.normalizedValue!)));
    if (!phoneValues.includes(claimedPhone)) {
      findings.push(
        makeFinding({
          code: "PHONE_MISMATCH",
          title: "Phone number in the case does not appear in the evidence",
          severity: "low",
          category: "identity",
          explanation: `The case records ${input.caseRecord.customerPhone}, while the evidence contains ${phoneValues
            .map((value) => value || "an unreadable number")
            .join(", ")}.`,
          recommendation:
            "Check that the number belongs to the affected line and that the evidence is for the correct account.",
          evidenceIds: uniqueValues(phones.map((fact) => fact.evidenceId)),
          factIds: phones.map((fact) => fact.id),
        }),
      );
    }
  }

  const debitWithoutDelivery =
    debitDetected && !deliveryEvidence && input.evidence.length > 0;
  if (debitWithoutDelivery) {
    findings.push(
      makeFinding({
        code: "MISSING_DELIVERY_PROOF",
        title: "Debit found, but no delivery confirmation",
        severity: "high",
        category: "evidence",
        explanation:
          "The evidence shows money leaving the customer's account, but no document in this case confirms that the airtime or data was delivered. This is missing information, not proof that the service failed.",
        recommendation:
          "Request the provider's delivery record or a confirmation message for the same transaction reference, and compare it with the debit alert.",
        evidenceIds: uniqueValues(amounts.map((fact) => fact.evidenceId)),
        factIds: [...amounts.map((fact) => fact.id), ...statuses.map((fact) => fact.id)],
      }),
    );
  }

  return findings
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.title.localeCompare(b.title));
}
