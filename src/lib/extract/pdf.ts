import { getDocumentProxy } from "unpdf";
import type { BBox } from "@/lib/domain";
import { ExtractionError, type ExtractedPage, type ExtractionResult, type ExtractedWord } from "./types";

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

const MAX_PAGES = 40;
const MAX_CHARS = 400_000;

export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch (error) {
    throw new ExtractionError(
      "pdf_unreadable",
      `The PDF could not be opened. It may be encrypted or damaged. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  }

  const pages: ExtractedPage[] = [];
  const warnings: string[] = [];
  const pageLimit = Math.min(pdf.numPages, MAX_PAGES);
  let totalChars = 0;
  let limitReached = false;

  if (pdf.numPages > MAX_PAGES) {
    warnings.push(`Only the first ${MAX_PAGES} of ${pdf.numPages} pages were processed.`);
  }

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    let text = "";
    const words: ExtractedWord[] = [];
    let previous: { x: number; width: number; height: number; hasEOL: boolean } | null = null;

    for (const rawItem of content.items) {
      const item = rawItem as PdfTextItem;
      const str = item.str ?? "";
      const transform = item.transform ?? [1, 0, 0, 1, 0, 0];
      const x = transform[4] ?? 0;
      const baseline = transform[5] ?? 0;
      const width = item.width ?? 0;
      const height = item.height ?? Math.abs(transform[3]) ?? 10;
      const hasEOL = Boolean(item.hasEOL);

      if (!str) {
        if (hasEOL && text && !text.endsWith("\n")) text += "\n";
        continue;
      }

      if (previous) {
        if (previous.hasEOL) {
          if (!text.endsWith("\n")) text += "\n";
        } else {
          const gap = x - (previous.x + previous.width);
          const threshold = Math.max(1.5, previous.height * 0.18);
          if (gap > threshold && !text.endsWith(" ") && !str.startsWith(" ")) {
            text += " ";
          }
        }
      }

      const start = text.length;
      text += str;
      const end = text.length;

      if (str.trim().length > 0) {
        const bbox: BBox = {
          x: Math.max(0, x),
          y: Math.max(0, viewport.height - (baseline + height)),
          w: Math.max(width, 1),
          h: Math.max(height, 1),
        };
        words.push({ text: str, start, end, bbox });
      }

      previous = { x, width, height, hasEOL };
    }

    const remaining = MAX_CHARS - totalChars;
    if (text.length > remaining) {
      warnings.push("Extraction stopped at the document text limit.");
      text = text.slice(0, Math.max(0, remaining));
      pages.push({
        page: pageNumber,
        text,
        words: words.filter((word) => word.end <= text.length),
        width: viewport.width,
        height: viewport.height,
        units: "pt",
      });
      limitReached = true;
      break;
    }

    totalChars += text.length;
    pages.push({
      page: pageNumber,
      text,
      words,
      width: viewport.width,
      height: viewport.height,
      units: "pt",
    });
  }

  if (limitReached) {
    warnings.push("The document is longer than the extraction limit.");
  }

  const combined = pages.map((page) => page.text).join("\n\n");

  if (combined.trim().length === 0) {
    warnings.push(
      "No selectable text was found. This PDF is likely a scan or photo; OCR for PDFs is not enabled in this version.",
    );
  }

  return {
    pages,
    text: combined,
    pageCount: pdf.numPages,
    engine: "pdfjs-text-layer",
    warnings,
  };
}
