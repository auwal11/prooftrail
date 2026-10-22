import { mkdir } from "node:fs/promises";
import { imageSize } from "image-size";
import { createWorker } from "tesseract.js";
import { ocrLangPath } from "@/lib/env";
import { ocrCacheDir } from "@/lib/storage";
import { ExtractionError, type ExtractedPage, type ExtractionResult, type ExtractedWord } from "./types";

const OCR_TIMEOUT_MS = 90_000;

type OcrWord = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type OcrLine = { words: OcrWord[] };

type OcrWorker = {
  recognize: (
    image: Buffer,
    options?: object,
    output?: object,
  ) => Promise<{ data: unknown }>;
  terminate: () => Promise<unknown>;
};

type OcrPage = {
  blocks: Array<{ paragraphs: Array<{ lines: OcrLine[] }> }> | null;
  text: string;
  confidence: number;
};

export async function extractImage(buffer: Buffer): Promise<ExtractionResult> {
  const cachePath = ocrCacheDir();
  await mkdir(cachePath, { recursive: true, mode: 0o700 });

  const holder: { worker: OcrWorker | null } = { worker: null };
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ExtractionError(
          "ocr_timeout",
          "Text recognition took too long. Try a clearer or smaller image.",
        ),
      );
    }, OCR_TIMEOUT_MS);
  });

  try {
    const run = (async () => {
      holder.worker = (await createWorker("eng", 1, {
        langPath: ocrLangPath(),
        cachePath,
        gzip: true,
        logger: () => undefined,
      })) as unknown as OcrWorker;
      const { data } = await holder.worker.recognize(buffer, {}, { text: true, blocks: true });
      return data as unknown as OcrPage;
    })();

    const data = await Promise.race([run, timeout]);
    const page = buildPage(data);

    try {
      const dimensions = imageSize(buffer);
      if (dimensions.width && dimensions.height) {
        page.width = dimensions.width;
        page.height = dimensions.height;
      }
    } catch {
      // Keep OCR-derived bounds if the image header cannot be parsed.
    }
    const warnings: string[] = [];

    if (!page.text.trim()) {
      warnings.push(
        "No readable text was recognised in this image. It may be blurry, cropped, or contain no text.",
      );
    }

    return {
      pages: [page],
      text: page.text,
      pageCount: 1,
      engine: "tesseract-ocr",
      warnings,
    };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      "ocr_failed",
      `Text recognition is currently unavailable for this image. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
  } finally {
    if (holder.worker) {
      await Promise.race([
        holder.worker.terminate(),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]).catch(() => undefined);
    }
    if (timer) clearTimeout(timer);
  }
}

function buildPage(data: OcrPage): ExtractedPage {
  let text = "";
  const words: ExtractedWord[] = [];
  let maxX = 0;
  let maxY = 0;

  const lines = data.blocks?.flatMap((block) => block.paragraphs.flatMap((p) => p.lines)) ?? [];

  for (const line of lines) {
    if (text.length > 0 && !text.endsWith("\n")) text += "\n";

    let firstWord = true;
    for (const word of line.words) {
      const value = word.text.trim();
      if (!value) continue;

      if (!firstWord) text += " ";
      const start = text.length;
      text += value;
      words.push({
        text: value,
        start,
        end: text.length,
        bbox: {
          x: word.bbox.x0,
          y: word.bbox.y0,
          w: Math.max(1, word.bbox.x1 - word.bbox.x0),
          h: Math.max(1, word.bbox.y1 - word.bbox.y0),
        },
      });
      maxX = Math.max(maxX, word.bbox.x1);
      maxY = Math.max(maxY, word.bbox.y1);
      firstWord = false;
    }
  }

  if (words.length === 0) {
    const fallback = (data.text ?? "").replace(/\r\n?/g, "\n").trim();
    return {
      page: 1,
      text: fallback,
      words: [],
      width: maxX || undefined,
      height: maxY || undefined,
      units: "px",
    };
  }

  return {
    page: 1,
    text: text.trimEnd(),
    words,
    width: maxX || undefined,
    height: maxY || undefined,
    units: "px",
  };
}
