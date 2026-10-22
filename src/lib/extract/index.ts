import { extractImage } from "./image";
import { extractPdf } from "./pdf";
import { extractTextFile } from "./text";
import type { ExtractionResult } from "./types";

export async function extractEvidence(
  kind: "IMAGE" | "PDF" | "TEXT",
  buffer: Buffer,
): Promise<ExtractionResult> {
  switch (kind) {
    case "PDF":
      return extractPdf(buffer);
    case "IMAGE":
      return extractImage(buffer);
    case "TEXT":
      return extractTextFile(buffer);
  }
}

export { ExtractionError } from "./types";
export type { ExtractionResult } from "./types";
