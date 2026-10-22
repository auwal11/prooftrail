import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { CaseDetail, FactTypeValue, Finding, Severity } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatBytes } from "@/lib/files";
import { formatMoney } from "@/lib/money";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  ink: rgb(0.067, 0.094, 0.153),
  body: rgb(0.208, 0.255, 0.333),
  muted: rgb(0.42, 0.447, 0.502),
  border: rgb(0.898, 0.906, 0.922),
  paper: rgb(0.976, 0.98, 0.984),
  accent: rgb(0.059, 0.463, 0.431),
  accentSoft: rgb(0.925, 0.976, 0.965),
  high: rgb(0.725, 0.11, 0.11),
  medium: rgb(0.706, 0.325, 0.035),
  low: rgb(0.114, 0.306, 0.847),
  info: rgb(0.294, 0.333, 0.388),
  white: rgb(1, 1, 1),
};

const SEVERITY_COLOR: Record<Severity, RGB> = {
  high: COLORS.high,
  medium: COLORS.medium,
  low: COLORS.low,
  info: COLORS.info,
};

const FACT_LABEL: Record<FactTypeValue, string> = {
  AMOUNT: "Amount",
  DATE: "Date",
  REFERENCE: "Reference",
  PHONE: "Phone",
  STATUS: "Status",
  SERVICE_TYPE: "Service",
  PROVIDER: "Provider",
  RECIPIENT: "Recipient",
  ACCOUNT_MASK: "Account",
  DESCRIPTION: "Description",
};

function sanitize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/₦/g, "NGN ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0a\x20-\x7e£€]/g, "?");
}

function shortId(id: string): string {
  return `PT-${id.slice(-6).toUpperCase()}`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

type TextOptions = {
  size?: number;
  font?: PDFFont;
  color?: RGB;
  lineHeight?: number;
  x?: number;
  width?: number;
};

class ReportLayout {
  private doc: PDFDocument;
  private regular: PDFFont;
  private bold: PDFFont;
  private mono: PDFFont;
  private page: PDFPage;
  private y: number;
  private caseLabel: string;
  private generatedAt: Date;

  constructor(doc: PDFDocument, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont }, caseLabel: string, generatedAt: Date) {
    this.doc = doc;
    this.regular = fonts.regular;
    this.bold = fonts.bold;
    this.mono = fonts.mono;
    this.caseLabel = caseLabel;
    this.generatedAt = generatedAt;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  get currentPage(): PDFPage {
    return this.page;
  }

  newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN - 16;
  }

  space(height: number): void {
    if (this.y - height < BOTTOM) this.newPage();
  }

  moveDown(amount: number): void {
    this.y -= amount;
  }

  wrap(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
    const clean = sanitize(text);
    const paragraphs = clean.split("\n");
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        continue;
      }

      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          current = candidate;
          continue;
        }

        if (current) lines.push(current);

        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const char of word) {
            if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
              if (chunk) lines.push(chunk);
              chunk = char;
            } else {
              chunk += char;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
      if (current) lines.push(current);
    }

    return lines;
  }

  paragraph(text: string, options: TextOptions = {}): number {
    const size = options.size ?? 9.5;
    const font = options.font ?? this.regular;
    const color = options.color ?? COLORS.body;
    const lineHeight = options.lineHeight ?? size * 1.45;
    const x = options.x ?? MARGIN;
    const width = options.width ?? CONTENT_WIDTH;

    const lines = this.wrap(text, size, font, width);
    for (const line of lines) {
      this.space(lineHeight);
      this.page.drawText(line, { x, y: this.y - size, size, font, color });
      this.y -= lineHeight;
    }
    return lines.length;
  }

  sectionTitle(title: string): void {
    this.space(36);
    this.moveDown(6);
    this.page.drawText(sanitize(title).toUpperCase(), {
      x: MARGIN,
      y: this.y - 9,
      size: 9,
      font: this.bold,
      color: COLORS.accent,
    });
    this.y -= 14;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.8,
      color: COLORS.border,
    });
    this.y -= 10;
  }

  divider(): void {
    this.space(14);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.6,
      color: COLORS.border,
    });
    this.y -= 10;
  }

  callout(title: string, body: string): void {
    this.space(60);
    const startY = this.y;
    const titleSize = 9.5;
    const bodySize = 8.8;
    const innerWidth = CONTENT_WIDTH - 22;
    const bodyLines = this.wrap(body, bodySize, this.regular, innerWidth);
    const height = 22 + titleSize + 6 + bodyLines.length * bodySize * 1.4 + 8;

    this.page.drawRectangle({
      x: MARGIN,
      y: startY - height,
      width: CONTENT_WIDTH,
      height,
      color: COLORS.accentSoft,
      borderColor: rgb(0.78, 0.9, 0.86),
      borderWidth: 0.7,
    });
    this.page.drawRectangle({
      x: MARGIN,
      y: startY - height,
      width: 3,
      height,
      color: COLORS.accent,
    });

    let y = startY - 14;
    this.page.drawText(sanitize(title), {
      x: MARGIN + 12,
      y: y - titleSize,
      size: titleSize,
      font: this.bold,
      color: COLORS.ink,
    });
    y -= titleSize + 6;

    for (const line of bodyLines) {
      this.page.drawText(line, {
        x: MARGIN + 12,
        y: y - bodySize,
        size: bodySize,
        font: this.regular,
        color: COLORS.body,
      });
      y -= bodySize * 1.4;
    }

    this.y = startY - height - 12;
  }

  keyValueGrid(items: Array<{ label: string; value: string }>, columns = 2): void {
    const gap = 14;
    const cellWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    for (let index = 0; index < items.length; index += columns) {
      const row = items.slice(index, index + columns);
      const heights = row.map((item) => {
        const lines = this.wrap(item.value, 9, this.regular, cellWidth - 2);
        return 11 + Math.max(1, lines.length) * 13;
      });
      const rowHeight = Math.max(...heights);
      this.space(rowHeight + 4);

      row.forEach((item, columnIndex) => {
        const x = MARGIN + columnIndex * (cellWidth + gap);
        this.page.drawText(sanitize(item.label).toUpperCase(), {
          x,
          y: this.y - 7,
          size: 6.8,
          font: this.bold,
          color: COLORS.muted,
        });
        const lines = this.wrap(item.value, 9, this.regular, cellWidth - 2);
        lines.forEach((line, lineIndex) => {
          this.page.drawText(line, {
            x,
            y: this.y - 20 - lineIndex * 13,
            size: 9,
            font: this.regular,
            color: COLORS.ink,
          });
        });
      });

      this.y -= rowHeight + 4;
    }
  }

  table(options: {
    columns: Array<{ label: string; width: number; align?: "left" | "right" }>;
    rows: string[][];
    size?: number;
    monoColumns?: number[];
  }): void {
    const size = options.size ?? 8.3;
    const lineHeight = size * 1.35;
    const padding = 5;
    const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
    const scale = CONTENT_WIDTH / totalWidth;
    const widths = options.columns.map((column) => column.width * scale);

    const drawHeader = () => {
      this.space(lineHeight + padding * 2 + 2);
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - (lineHeight + padding * 2),
        width: CONTENT_WIDTH,
        height: lineHeight + padding * 2,
        color: rgb(0.949, 0.957, 0.969),
      });
      let x = MARGIN;
      options.columns.forEach((column, index) => {
        this.page.drawText(sanitize(column.label).toUpperCase(), {
          x: x + padding,
          y: this.y - padding - size,
          size: 6.8,
          font: this.bold,
          color: COLORS.muted,
        });
        x += widths[index];
      });
      this.y -= lineHeight + padding * 2;
    };

    drawHeader();

    for (const row of options.rows) {
      const cells = row.map((cell, index) => {
        const font = options.monoColumns?.includes(index) ? this.mono : this.regular;
        return this.wrap(cell, size, font, widths[index] - padding * 2);
      });
      const rowHeight = Math.max(...cells.map((cell) => Math.max(1, cell.length))) * lineHeight + padding * 2;

      if (this.y - rowHeight < BOTTOM) {
        this.newPage();
        drawHeader();
      }

      let x = MARGIN;
      cells.forEach((lines, index) => {
        const font = options.monoColumns?.includes(index) ? this.mono : this.regular;
        lines.forEach((line, lineIndex) => {
          this.page.drawText(line, {
            x: x + padding,
            y: this.y - padding - size - lineIndex * lineHeight,
            size,
            font,
            color: COLORS.body,
          });
        });
        x += widths[index];
      });

      this.page.drawLine({
        start: { x: MARGIN, y: this.y - rowHeight },
        end: { x: PAGE_WIDTH - MARGIN, y: this.y - rowHeight },
        thickness: 0.4,
        color: COLORS.border,
      });
      this.y -= rowHeight;
    }
  }

  severityBadge(severity: Severity, x: number, y: number): void {
    const label = severity.toUpperCase();
    const width = this.bold.widthOfTextAtSize(label, 6.6) + 12;
    this.page.drawRectangle({
      x,
      y: y - 10,
      width,
      height: 13,
      color: SEVERITY_COLOR[severity],
    });
    this.page.drawText(label, {
      x: x + 6,
      y: y - 6.6,
      size: 6.6,
      font: this.bold,
      color: COLORS.white,
    });
  }

  findingCard(finding: Finding, index: number, evidenceNames: Map<string, string>): void {
    this.space(110);

    const titleLines = this.wrap(`${index + 1}. ${finding.title}`, 10.2, this.bold, CONTENT_WIDTH - 80);
    const explanationLines = this.wrap(finding.explanation, 8.8, this.regular, CONTENT_WIDTH - 2);
    const recommendationLines = this.wrap(`Next step: ${finding.recommendation}`, 8.8, this.regular, CONTENT_WIDTH - 2);
    const sources = [
      ...new Set(
        finding.evidenceIds
          .map((id) => evidenceNames.get(id))
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const sourceLine = sources.length > 0 ? `Sources: ${sources.join(", ")}` : "Sources: case metadata";
    const sourceLines = this.wrap(sourceLine, 8, this.regular, CONTENT_WIDTH - 2);

    const height =
      10 + titleLines.length * 13 + 6 + explanationLines.length * 12 + 6 + recommendationLines.length * 12 + 6 + sourceLines.length * 11 + 12;

    if (this.y - height < BOTTOM) this.newPage();

    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: CONTENT_WIDTH,
      height,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 0.6,
    });
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: 2.5,
      height,
      color: SEVERITY_COLOR[finding.severity],
    });

    this.severityBadge(finding.severity, MARGIN + 10, top - 11);

    let y = top - 12;
    for (const line of titleLines) {
      this.page.drawText(line, {
        x: MARGIN + 10,
        y: y - 9,
        size: 10.2,
        font: this.bold,
        color: COLORS.ink,
      });
      y -= 13;
    }

    y -= 4;
    for (const line of explanationLines) {
      this.page.drawText(line, {
        x: MARGIN + 10,
        y: y - 8,
        size: 8.8,
        font: this.regular,
        color: COLORS.body,
      });
      y -= 12;
    }

    y -= 4;
    for (const line of recommendationLines) {
      this.page.drawText(line, {
        x: MARGIN + 10,
        y: y - 8,
        size: 8.8,
        font: this.regular,
        color: COLORS.ink,
      });
      y -= 12;
    }

    y -= 4;
    for (const line of sourceLines) {
      this.page.drawText(line, {
        x: MARGIN + 10,
        y: y - 7.5,
        size: 8,
        font: this.regular,
        color: COLORS.muted,
      });
      y -= 11;
    }

    this.y = top - height - 10;
  }

  finish(): void {
    const total = this.dom.getPages().length;
    this.dom.getPages().forEach((page, index) => {
      const number = index + 1;
      page.drawLine({
        start: { x: MARGIN, y: 40 },
        end: { x: PAGE_WIDTH - MARGIN, y: 40 },
        thickness: 0.5,
        color: COLORS.border,
      });
      page.drawText(`ProofTrail | Case ${this.caseLabel} | Confidential`, {
        x: MARGIN,
        y: 29,
        size: 6.8,
        font: this.regular,
        color: COLORS.muted,
      });
      const right = `Page ${number} of ${total}`;
      page.drawText(right, {
        x: PAGE_WIDTH - MARGIN - this.regular.widthOfTextAtSize(right, 6.8),
        y: 29,
        size: 6.8,
        font: this.regular,
        color: COLORS.muted,
      });
      page.drawText(`Generated ${formatDateTime(this.generatedAt)} UTC`, {
        x: MARGIN,
        y: 20,
        size: 6.4,
        font: this.regular,
        color: COLORS.muted,
      });
    });
  }

  get dom(): PDFDocument {
    return this.doc;
  }
}

function factSource(fact: CaseDetail["facts"][number]): string {
  const page = fact.locator?.page;
  const base = fact.evidenceName;
  return page && page > 1 ? `${base} (p.${page})` : base;
}

function sourcePages(finding: Finding, facts: CaseDetail["facts"]): string {
  const pages = new Set<string>();
  for (const factId of finding.factIds) {
    const fact = facts.find((item) => item.id === factId);
    if (fact?.locator?.page) {
      pages.add(`${fact.evidenceName} p.${fact.locator.page}`);
    }
  }
  return [...pages].slice(0, 4).join("; ");
}

export async function generateCaseReport(
  detail: CaseDetail,
  preparedFor: { name: string; email: string },
  generatedAt = new Date(),
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`ProofTrail evidence report - ${detail.title}`);
  doc.setAuthor("ProofTrail");
  doc.setSubject("Source-linked evidence and discrepancy report for a transaction dispute");
  doc.setCreator("ProofTrail");
  doc.setProducer("ProofTrail / pdf-lib");
  doc.setCreationDate(generatedAt);
  doc.setModificationDate(generatedAt);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const layout = new ReportLayout(doc, { regular, bold, mono }, shortId(detail.id), generatedAt);

  const page = layout.currentPage;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 104,
    width: PAGE_WIDTH,
    height: 104,
    color: COLORS.ink,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 104,
    width: 6,
    height: 104,
    color: COLORS.accent,
  });
  page.drawText("PROOFTRAIL", {
    x: MARGIN,
    y: PAGE_HEIGHT - 44,
    size: 17,
    font: bold,
    color: COLORS.white,
  });
  page.drawText("EVIDENCE INTELLIGENCE REPORT", {
    x: MARGIN,
    y: PAGE_HEIGHT - 60,
    size: 8,
    font: bold,
    color: rgb(0.72, 0.85, 0.82),
  });
  const confidential = "CONFIDENTIAL - PREPARED FOR DISPUTE REVIEW";
  page.drawText(confidential, {
    x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(confidential, 6.8),
    y: PAGE_HEIGHT - 44,
    size: 6.8,
    font: regular,
    color: rgb(0.72, 0.78, 0.8),
  });
  page.drawText(`Case ${shortId(detail.id)}`, {
    x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(`Case ${shortId(detail.id)}`, 6.8),
    y: PAGE_HEIGHT - 58,
    size: 6.8,
    font: regular,
    color: rgb(0.72, 0.78, 0.8),
  });

  layout.moveDown(104 + 28);
  layout.paragraph(detail.title, { size: 20, font: bold, color: COLORS.ink, lineHeight: 24 });
  layout.moveDown(4);
  layout.paragraph(
    `Source-linked reconstruction of ${article(detail.serviceType)} ${detail.serviceType.toLowerCase()} dispute${
      detail.provider ? ` involving ${detail.provider}` : ""
    }. This report records what the uploaded evidence states, where each statement came from, and which inconsistencies remain unresolved.`,
    { size: 9.8, color: COLORS.muted },
  );
  layout.moveDown(10);

  layout.keyValueGrid(
    [
      { label: "Prepared for", value: `${preparedFor.name} (${preparedFor.email})` },
      { label: "Generated", value: `${formatDateTime(generatedAt)} UTC` },
      { label: "Case opened", value: formatDate(detail.createdAt) },
      { label: "Incident date", value: formatDate(detail.incidentDate) },
      { label: "Service", value: detail.serviceType },
      { label: "Provider", value: detail.provider || "Not recorded" },
      { label: "Claimed amount", value: formatMoney(detail.claimedAmount, detail.currency) },
      { label: "Case status", value: detail.status.replace(/_/g, " ") },
    ],
    2,
  );

  layout.moveDown(8);
  layout.callout(
    "What this report is, and what it is not",
    "ProofTrail extracts facts from the evidence supplied by the customer and compares them with deterministic rules. It does not verify that a bank, telecom operator, payment provider, or regulator received or resolved a complaint. A discrepancy is an investigative lead, not proof of fraud or wrongdoing. Amounts, dates, and references may be misread by OCR or typed incorrectly; the original files remain the authoritative record. SHA-256 hashes help detect changes to files after upload, but they are not a tamper-proof audit guarantee for the whole system.",
  );

  layout.sectionTitle("Case summary");
  layout.paragraph(detail.description || "No case description was provided.", { size: 9.4 });
  layout.moveDown(6);

  const amounts = detail.facts
    .filter((fact) => fact.type === "AMOUNT" && fact.status !== "rejected")
    .map((fact) => fact.effectiveValue ?? fact.rawValue);
  const references = [
    ...new Set(
      detail.facts
        .filter((fact) => fact.type === "REFERENCE" && fact.status !== "rejected")
        .map((fact) => fact.effectiveValue ?? fact.rawValue),
    ),
  ];

  layout.keyValueGrid(
    [
      { label: "Claimed amount", value: formatMoney(detail.claimedAmount, detail.currency) },
      { label: "Case reference", value: detail.transactionReference || "Not recorded" },
      { label: "Amounts extracted", value: amounts.length > 0 ? [...new Set(amounts)].join(", ") : "None" },
      { label: "References extracted", value: references.length > 0 ? references.join(", ") : "None" },
      { label: "Evidence files", value: String(detail.evidence.length) },
      { label: "Source-linked facts", value: String(detail.facts.length) },
      { label: "Open discrepancies", value: String(detail.discrepancies.length) },
      { label: "Facts corrected", value: String(detail.facts.filter((fact) => fact.status === "corrected").length) },
    ],
    2,
  );

  layout.sectionTitle("Evidence inventory");
  if (detail.evidence.length === 0) {
    layout.paragraph("No evidence files were uploaded for this case.", { size: 9 });
  } else {
    layout.table({
      columns: [
        { label: "#", width: 18 },
        { label: "File", width: 150 },
        { label: "Type", width: 48 },
        { label: "Size", width: 48 },
        { label: "Uploaded", width: 72 },
        { label: "Extraction", width: 70 },
        { label: "Facts", width: 32 },
      ],
      rows: detail.evidence.map((evidence, index) => [
        String(index + 1),
        evidence.originalName,
        evidence.kind,
        formatBytes(evidence.sizeBytes),
        formatDate(evidence.createdAt),
        evidence.extractionStatus.toLowerCase(),
        String(evidence.factCount),
      ]),
      size: 8,
    });
    const failed = detail.evidence.filter((evidence) => evidence.extractionStatus === "FAILED");
    if (failed.length > 0) {
      layout.moveDown(8);
      layout.paragraph(
        `Note: ${failed.length} file(s) could not be processed. Their contents are not represented in the fact table below.`,
        { size: 8.6, color: COLORS.medium },
      );
    }
  }

  layout.sectionTitle("Source-linked facts");
  layout.paragraph(
    "Each fact below was extracted from a source file. Values marked as corrected were changed by a reviewer; the original extraction is retained in the audit log.",
    { size: 8.8, color: COLORS.muted },
  );
  layout.moveDown(4);

  if (detail.facts.length === 0) {
    layout.paragraph("No facts were extracted.", { size: 9 });
  } else {
    const activeFacts = detail.facts.filter((fact) => fact.status !== "rejected");
    layout.table({
      columns: [
        { label: "Fact", width: 76 },
        { label: "Value", width: 190 },
        { label: "Source", width: 150 },
        { label: "State", width: 60 },
        { label: "Conf.", width: 38 },
      ],
      rows: activeFacts.map((fact) => [
        FACT_LABEL[fact.type],
        fact.effectiveValue ?? fact.rawValue,
        factSource(fact),
        fact.status,
        `${Math.round(fact.confidence * 100)}%`,
      ]),
      size: 8,
    });

    const rejected = detail.facts.filter((fact) => fact.status === "rejected");
    if (rejected.length > 0) {
      layout.moveDown(6);
      layout.paragraph(
        `${rejected.length} extracted fact(s) were marked not applicable by a reviewer and are excluded from comparisons.`,
        { size: 8.2, color: COLORS.muted },
      );
    }
  }

  layout.sectionTitle("Source excerpts");
  const excerptFacts = detail.facts
    .filter(
      (fact) =>
        fact.status !== "rejected" &&
        Boolean(fact.snippet) &&
        ["AMOUNT", "DATE", "REFERENCE", "STATUS", "DESCRIPTION"].includes(fact.type),
    )
    .slice(0, 12);

  if (excerptFacts.length === 0) {
    layout.paragraph("No source excerpts are available.", { size: 9 });
  } else {
    for (const fact of excerptFacts) {
      layout.space(34);
      layout.paragraph(`${FACT_LABEL[fact.type]} - ${factSource(fact)}`, {
        size: 8.2,
        font: bold,
        color: COLORS.ink,
      });
      layout.paragraph(`"${fact.snippet ?? ""}"`, {
        size: 8.4,
        color: COLORS.muted,
        lineHeight: 11.5,
      });
      layout.moveDown(3);
    }
  }

  layout.sectionTitle("Discrepancies and missing information");
  if (detail.discrepancies.length === 0) {
    layout.paragraph(
      "No deterministic discrepancies were detected in the current evidence. This does not confirm that the transaction was valid or the service delivered; it only means the available text did not trigger a rule.",
      { size: 9 },
    );
  } else {
    layout.paragraph(
      "Findings are ordered by severity. Each one identifies the facts and files it depends on. None of them is a determination of fraud.",
      { size: 8.8, color: COLORS.muted },
    );
    layout.moveDown(4);
    const evidenceNames = new Map(detail.evidence.map((item) => [item.id, item.originalName]));
    detail.discrepancies.forEach((finding, index) => {
      layout.findingCard(finding, index, evidenceNames);
      const pages = sourcePages(finding, detail.facts);
      if (pages) {
        layout.paragraph(`Referenced locations: ${pages}`, {
          size: 7.8,
          color: COLORS.muted,
          x: MARGIN + 10,
        });
        layout.moveDown(2);
      }
    });
  }

  layout.sectionTitle("Evidence timeline");
  const timelineRows = detail.timeline
    .filter((entry) => entry.at)
    .slice(0, 40)
    .map((entry) => [
      formatDateTime(entry.at),
      entry.label,
      entry.detail,
    ]);

  if (timelineRows.length === 0) {
    layout.paragraph("No dated events are available.", { size: 9 });
  } else {
    layout.table({
      columns: [
        { label: "When", width: 92 },
        { label: "Event", width: 150 },
        { label: "Detail", width: 220 },
      ],
      rows: timelineRows,
      size: 7.9,
    });
  }

  layout.sectionTitle("Review and correction log");
  const revisionRows = detail.facts.flatMap((fact) =>
    fact.revisions.map((revision) => [
      formatDateTime(revision.createdAt),
      FACT_LABEL[fact.type],
      revision.action,
      revision.previousValue ?? fact.rawValue,
      revision.newValue ?? "-",
      revision.actorName,
      revision.note ?? "-",
    ]),
  );

  if (revisionRows.length === 0) {
    layout.paragraph(
      "No corrections have been made. All facts above are shown exactly as extracted by the rules engine.",
      { size: 9 },
    );
  } else {
    layout.table({
      columns: [
        { label: "When", width: 78 },
        { label: "Fact", width: 58 },
        { label: "Action", width: 62 },
        { label: "Before", width: 88 },
        { label: "After", width: 88 },
        { label: "Reviewer", width: 70 },
        { label: "Note", width: 84 },
      ],
      rows: revisionRows,
      size: 7.3,
    });
  }

  layout.sectionTitle("Evidence integrity");
  layout.paragraph(
    "SHA-256 identifies the exact bytes of each uploaded file. If a file is replaced or altered, the hash will no longer match the record below. A matching hash supports integrity comparison; it does not by itself prove who created the file or that its contents are true.",
    { size: 8.6, color: COLORS.muted },
  );
  layout.moveDown(4);

  if (detail.evidence.length > 0) {
    layout.table({
      columns: [
        { label: "File", width: 140 },
        { label: "SHA-256", width: 300 },
      ],
      rows: detail.evidence.map((evidence) => [evidence.originalName, evidence.sha256]),
      size: 7.2,
      monoColumns: [1],
    });
  }

  layout.sectionTitle("Method and limitations");
  const limitations = [
    "Facts are extracted by deterministic pattern rules from the text layer of PDFs, OCR of images, and plain text files. Rules can miss facts or misread formats.",
    "OCR quality depends on image clarity. Low-resolution, cropped, or heavily compressed screenshots may produce incorrect characters.",
    "The tool does not contact banks, telecom operators, payment providers, or regulators, and it cannot confirm that a complaint was filed or resolved.",
    "Corrections made by a reviewer are recorded as attributable audit events. Original extracted values are retained and are never overwritten.",
    "The absence of a discrepancy does not prove that a transaction was correct or that a service was delivered.",
    "Evidence hashes support file-integrity checks only. They are not a blockchain proof, not a tamper-proof audit log, and not a substitute for provider records.",
    "This report is a structured summary for the customer's own review. It should be checked against the original files before being sent to any institution.",
  ];
  limitations.forEach((item) => {
    layout.paragraph(`- ${item}`, { size: 8.7, lineHeight: 12.2 });
    layout.moveDown(2);
  });

  layout.moveDown(8);
  layout.divider();
  layout.paragraph(
    `Report generated by ProofTrail on ${formatDateTime(generatedAt)} UTC for ${preparedFor.name}. Case ${shortId(
      detail.id,
    )}. ${detail.evidence.length} evidence file(s), ${detail.facts.length} extracted fact(s), ${
      detail.discrepancies.length
    } finding(s).`,
    { size: 7.8, color: COLORS.muted },
  );

  layout.finish();
  return doc.save();
}
