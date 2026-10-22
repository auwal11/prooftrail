import type { FactTypeValue, SourceLocator } from "@/lib/domain";
import { parseDateValue } from "@/lib/dates";
import { parseAmountToMinor } from "@/lib/money";
import type { ExtractedPage } from "@/lib/extract/types";

export const EXTRACTOR_NAME = "prooftrail-ng-alert-rules";
export const EXTRACTOR_VERSION = "1.0.0";

const MAX_FACTS = 300;
const MAX_SNIPPET = 280;

export type NewFact = {
  type: FactTypeValue;
  rawValue: string;
  normalizedValue: string | null;
  confidence: number;
  locator: SourceLocator;
  snippet: string;
  extractor: string;
  extractorVersion: string;
};

type Candidate = {
  type: FactTypeValue;
  rawValue: string;
  normalizedValue: string | null;
  confidence: number;
  start: number;
  end: number;
  page: number;
  line: number;
  lineText: string;
};

type Line = { text: string; start: number; index: number };

const PROVIDERS: Array<{ canonical: string; pattern: RegExp }> = [
  { canonical: "MTN", pattern: /\bMTN\b/i },
  { canonical: "Airtel", pattern: /\bAirtel\b/i },
  { canonical: "Glo", pattern: /\bGlobacom\b|\bGlo\b/i },
  { canonical: "9mobile", pattern: /\b9mobile\b|\bEtisalat\b/i },
  { canonical: "OPay", pattern: /\bOPay\b/i },
  { canonical: "PalmPay", pattern: /\bPalmPay\b/i },
  { canonical: "Moniepoint", pattern: /\bMoniepoint\b/i },
  { canonical: "Paga", pattern: /\bPaga\b/i },
  { canonical: "Kuda", pattern: /\bKuda\b/i },
  { canonical: "GTBank", pattern: /\bGTBank\b|\bGTB\b|\bGuaranty Trust\b/i },
  { canonical: "Access Bank", pattern: /\bAccess Bank\b/i },
  { canonical: "Zenith Bank", pattern: /\bZenith Bank\b|\bZenith\b/i },
  { canonical: "UBA", pattern: /\bUBA\b|\bUnited Bank for Africa\b/i },
  { canonical: "First Bank", pattern: /\bFirst Bank\b|\bFirstBank\b/i },
  { canonical: "Wema Bank", pattern: /\bWema Bank\b|\bWema\b|\bALAT\b/i },
  { canonical: "Sterling Bank", pattern: /\bSterling Bank\b|\bSterling\b/i },
  { canonical: "Stanbic IBTC", pattern: /\bStanbic\b/i },
  { canonical: "Fidelity Bank", pattern: /\bFidelity Bank\b|\bFidelity\b/i },
  { canonical: "Union Bank", pattern: /\bUnion Bank\b/i },
  { canonical: "Polaris Bank", pattern: /\bPolaris Bank\b|\bPolaris\b/i },
  { canonical: "FCMB", pattern: /\bFCMB\b/i },
  { canonical: "Paystack", pattern: /\bPaystack\b/i },
  { canonical: "Flutterwave", pattern: /\bFlutterwave\b/i },
  { canonical: "PiggyVest", pattern: /\bPiggyVest\b/i },
];

const STATUS_MAP: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bunsuccessful(?:ly)?\b/i, value: "failed" },
  { pattern: /\bsuccessfully\b/i, value: "successful" },
  { pattern: /\bsuccessful\b/i, value: "successful" },
  { pattern: /\bsuccess\b/i, value: "successful" },
  { pattern: /\bcompleted\b/i, value: "completed" },
  { pattern: /\bfailed\b/i, value: "failed" },
  { pattern: /\bdeclined\b/i, value: "failed" },
  { pattern: /\bpending\b/i, value: "pending" },
  { pattern: /\bprocessing\b/i, value: "processing" },
  { pattern: /\breversed\b/i, value: "reversed" },
  { pattern: /\breversal\b/i, value: "reversed" },
  { pattern: /\brefunded\b/i, value: "refunded" },
  { pattern: /\bdebited\b/i, value: "debited" },
  { pattern: /\bcharged\b/i, value: "debited" },
  { pattern: /\bcredited\b/i, value: "credited" },
];

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  let index = 0;

  while (start <= text.length) {
    const newline = text.indexOf("\n", start);
    const end = newline === -1 ? text.length : newline;
    lines.push({ text: text.slice(start, end), start, index });
    if (newline === -1) break;
    start = newline + 1;
    index += 1;
  }

  return lines;
}

function cleanSnippet(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_SNIPPET) return collapsed;
  return `${collapsed.slice(0, MAX_SNIPPET - 1)}…`;
}

function snippetAround(lineText: string, start: number, end: number): string {
  if (lineText.length <= MAX_SNIPPET) return cleanSnippet(lineText);
  const contextStart = Math.max(0, start - 90);
  const contextEnd = Math.min(lineText.length, end + 90);
  const prefix = contextStart > 0 ? "…" : "";
  const suffix = contextEnd < lineText.length ? "…" : "";
  return cleanSnippet(`${prefix}${lineText.slice(contextStart, contextEnd)}${suffix}`);
}

function overlaps(start: number, end: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart);
}

function detectAmounts(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const currency =
    /(?<![A-Za-z0-9])(?:NGN|₦|N)(?=\s?\d)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;

  const taken: Array<[number, number]> = [];

  for (const match of line.text.matchAll(currency)) {
    const index = match.index ?? 0;
    const raw = match[0];
    const before = line.text.slice(Math.max(0, index - 40), index);
    if (/\bbalance\b[^0-9]{0,25}$/i.test(before)) continue;

    const parsed = parseAmountToMinor(raw);
    if (!parsed) continue;

    const end = index + raw.length;
    taken.push([index, end]);

    const contextBoost = /\b(?:debited|debit|paid|payment|transfer|purchase|amount|airtime|data)\b/i.test(
      line.text,
    )
      ? 0.05
      : 0;

    candidates.push({
      type: "AMOUNT",
      rawValue: raw.trim(),
      normalizedValue: parsed.normalized,
      confidence: Math.min(0.98, 0.88 + contextBoost),
      start: line.start + index,
      end: line.start + end,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }

  const labelled = /(?:amount|debited(?:\s+with)?|paid|charged)\s*[:\-]?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2})/gi;
  for (const match of line.text.matchAll(labelled)) {
    const index = match.index ?? 0;
    const value = match[1];
    const valueStart = line.text.indexOf(value, index);
    if (valueStart === -1) continue;
    const valueEnd = valueStart + value.length;
    if (overlaps(valueStart, valueEnd, taken)) continue;

    const parsed = parseAmountToMinor(value);
    if (!parsed) continue;
    taken.push([valueStart, valueEnd]);

    candidates.push({
      type: "AMOUNT",
      rawValue: value,
      normalizedValue: parsed.normalized,
      confidence: 0.74,
      start: line.start + valueStart,
      end: line.start + valueEnd,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function detectDates(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const patterns = [
    /\b(?:\d{4}-\d{2}-\d{2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?\b/g,
    /\b(?:0?[1-9]|[12]\d|3[01])[\/\-.]\d{1,2}[\/\-.]\d{4}(?:[,\s]+\d{1,2}:\d{2}\s*(?:AM|PM)?)?/gi,
    /\b(?:0?[1-9]|[12]\d|3[01])[\/\-.]\d{1,2}[\/\-.]\d{2}(?!\d)(?:[,\s]+\d{1,2}:\d{2}\s*(?:AM|PM)?)?/gi,
    /\b(?:0?[1-9]|[12]\d|3[01])[\s-]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[,\s-]+\d{4}(?:[,\s]+\d{1,2}:\d{2}\s*(?:AM|PM)?)?/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[,\s]+\d{4}(?:[,\s]+\d{1,2}:\d{2}\s*(?:AM|PM)?)?/gi,
  ];

  const seen = new Set<string>();

  for (const pattern of patterns) {
    for (const match of line.text.matchAll(pattern)) {
      const raw = match[0];
      const parsed = parseDateValue(raw);
      if (!parsed) continue;
      if (seen.has(parsed.iso)) continue;
      seen.add(parsed.iso);

      const index = match.index ?? 0;
      candidates.push({
        type: "DATE",
        rawValue: raw.trim(),
        normalizedValue: parsed.iso,
        confidence: /\bdate\b/i.test(line.text) ? 0.95 : 0.84,
        start: line.start + index,
        end: line.start + index + raw.length,
        page: page.page,
        line: line.index,
        lineText: line.text,
      });
    }
  }
}

function detectReferences(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const pattern =
    /(?:transaction\s*(?:reference|ref|id|no\.?)|trx\s*(?:ref(?:erence)?|id|no\.?)?|txn\s*(?:ref(?:erence)?|id|no\.?)?|ref(?:erence)?(?:\s*(?:no\.?|number|id))?|session\s*id|rrn|order\s*(?:id|no\.?)|payment\s*(?:reference|ref)|approval\s*code|auth(?:orization)?\s*code)\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9._\/-]{4,40})/gi;

  for (const match of line.text.matchAll(pattern)) {
    const value = match[1].replace(/[.,;:]+$/, "");
    if (value.length < 6) continue;
    if (!/\d/.test(value)) continue;

    const index = match.index ?? 0;
    const valueStart = line.text.indexOf(match[1], index);
    if (valueStart === -1) continue;

    candidates.push({
      type: "REFERENCE",
      rawValue: value,
      normalizedValue: value.toUpperCase(),
      confidence: 0.9,
      start: line.start + valueStart,
      end: line.start + valueStart + value.length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function detectPhones(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const pattern = /(?<!\d)(?:\+?234|0)([789][01]\d{8})(?!\d)/g;

  for (const match of line.text.matchAll(pattern)) {
    const index = match.index ?? 0;
    candidates.push({
      type: "PHONE",
      rawValue: match[0],
      normalizedValue: `+234${match[1]}`,
      confidence: 0.86,
      start: line.start + index,
      end: line.start + index + match[0].length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function detectStatus(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const seen = new Set<string>();

  for (const status of STATUS_MAP) {
    const match = status.pattern.exec(line.text);
    if (!match) continue;
    if (seen.has(status.value)) continue;
    seen.add(status.value);

    const index = match.index;
    candidates.push({
      type: "STATUS",
      rawValue: match[0],
      normalizedValue: status.value,
      confidence: 0.7,
      start: line.start + index,
      end: line.start + index + match[0].length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function detectServiceTypes(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const checks: Array<{ pattern: RegExp; value: string }> = [
    { pattern: /\bairtime\b|\brecharge\b|\btop[\s-]?up\b|\btopup\b/i, value: "AIRTIME" },
    { pattern: /\bdata\b|\bbundle\b|\b\d+(?:\.\d+)?\s?(?:MB|GB)\b|\binternet\b/i, value: "DATA" },
  ];

  const seen = new Set<string>();
  for (const check of checks) {
    const match = check.pattern.exec(line.text);
    if (!match) continue;
    if (seen.has(check.value)) continue;
    seen.add(check.value);

    const index = match.index;
    candidates.push({
      type: "SERVICE_TYPE",
      rawValue: match[0],
      normalizedValue: check.value,
      confidence: 0.8,
      start: line.start + index,
      end: line.start + index + match[0].length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function detectProviders(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  for (const provider of PROVIDERS) {
    const match = provider.pattern.exec(line.text);
    if (!match) continue;

    const index = match.index;
    candidates.push({
      type: "PROVIDER",
      rawValue: match[0],
      normalizedValue: provider.canonical,
      confidence: 0.72,
      start: line.start + index,
      end: line.start + index + match[0].length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function detectAccountMask(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const pattern = /(?:\*{2,}|x{2,}|X{2,})\s?(\d{3,4})\b/g;
  for (const match of line.text.matchAll(pattern)) {
    const index = match.index ?? 0;
    candidates.push({
      type: "ACCOUNT_MASK",
      rawValue: match[0],
      normalizedValue: `****${match[1]}`,
      confidence: 0.78,
      start: line.start + index,
      end: line.start + index + match[0].length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function detectDescriptions(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const labelled = /(?:description|narration|details)\s*[:\-]\s*(.{3,200})/i.exec(line.text);
  if (labelled) {
    const index = labelled.index + labelled[0].indexOf(labelled[1]);
    candidates.push({
      type: "DESCRIPTION",
      rawValue: labelled[1].trim(),
      normalizedValue: cleanSnippet(labelled[1]).toLowerCase(),
      confidence: 0.8,
      start: line.start + index,
      end: line.start + index + labelled[1].length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }

  const delivery =
    /(?:delivered|delivery|successfully\s+(?:sent|delivered|credited|activated)|bundle\s+(?:activated|credited)|airtime\s+(?:sent|delivered))/i.exec(
      line.text,
    );
  if (delivery) {
    const index = delivery.index;
    candidates.push({
      type: "DESCRIPTION",
      rawValue: delivery[0],
      normalizedValue: "delivery confirmation",
      confidence: 0.68,
      start: line.start + index,
      end: line.start + index + delivery[0].length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function detectRecipients(page: ExtractedPage, line: Line, candidates: Candidate[]): void {
  const pattern = /(?:beneficiary|recipient)\s*[:\-]\s*([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,3})/gi;
  for (const match of line.text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const valueStart = line.text.indexOf(match[1], index);
    if (valueStart === -1) continue;
    candidates.push({
      type: "RECIPIENT",
      rawValue: match[1],
      normalizedValue: match[1].replace(/\s+/g, " ").trim(),
      confidence: 0.72,
      start: line.start + valueStart,
      end: line.start + valueStart + match[1].length,
      page: page.page,
      line: line.index,
      lineText: line.text,
    });
  }
}

function locatorFor(page: ExtractedPage, start: number, end: number, line: number): SourceLocator {
  const overlapping = page.words.filter(
    (word) => word.bbox && word.start < end && word.end > start,
  );

  let bbox: SourceLocator["bbox"];
  if (overlapping.length > 0) {
    const x = Math.min(...overlapping.map((word) => word.bbox!.x));
    const y = Math.min(...overlapping.map((word) => word.bbox!.y));
    const right = Math.max(...overlapping.map((word) => word.bbox!.x + word.bbox!.w));
    const bottom = Math.max(...overlapping.map((word) => word.bbox!.y + word.bbox!.h));
    bbox = { x, y, w: right - x, h: bottom - y };
  }

  return {
    kind: page.units === "pt" ? "pdf" : page.units === "px" ? "image" : "text",
    page: page.page,
    charStart: start,
    charEnd: end,
    line,
    bbox,
    units: page.units === "pt" ? "pt" : page.units === "px" ? "px" : "chars",
    pageWidth: page.width,
    pageHeight: page.height,
  };
}

export function extractFactsFromPages(pages: ExtractedPage[]): NewFact[] {
  const candidates: Candidate[] = [];

  for (const page of pages) {
    for (const line of splitLines(page.text)) {
      if (line.text.trim().length === 0) continue;
      detectAmounts(page, line, candidates);
      detectDates(page, line, candidates);
      detectReferences(page, line, candidates);
      detectPhones(page, line, candidates);
      detectStatus(page, line, candidates);
      detectServiceTypes(page, line, candidates);
      detectProviders(page, line, candidates);
      detectAccountMask(page, line, candidates);
      detectDescriptions(page, line, candidates);
      detectRecipients(page, line, candidates);

      if (candidates.length > MAX_FACTS * 3) break;
    }
    if (candidates.length > MAX_FACTS * 3) break;
  }

  const seen = new Set<string>();
  const facts: NewFact[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.type}|${candidate.normalizedValue ?? candidate.rawValue}|${candidate.page}|${candidate.start}`;
    if (seen.has(key)) continue;
    seen.add(key);

    facts.push({
      type: candidate.type,
      rawValue: candidate.rawValue.slice(0, 200),
      normalizedValue: candidate.normalizedValue?.slice(0, 200) ?? null,
      confidence: Math.round(candidate.confidence * 100) / 100,
      locator: locatorFor(
        pages.find((page) => page.page === candidate.page)!,
        candidate.start,
        candidate.end,
        candidate.line,
      ),
      snippet: snippetAround(candidate.lineText, candidate.start - lineStartFor(pages, candidate.page, candidate.line), candidate.end - lineStartFor(pages, candidate.page, candidate.line)),
      extractor: EXTRACTOR_NAME,
      extractorVersion: EXTRACTOR_VERSION,
    });

    if (facts.length >= MAX_FACTS) break;
  }

  return facts;
}

function lineStartFor(pages: ExtractedPage[], pageNumber: number, lineIndex: number): number {
  const page = pages.find((value) => value.page === pageNumber);
  if (!page) return 0;
  const lines = splitLines(page.text);
  return lines[lineIndex]?.start ?? 0;
}
