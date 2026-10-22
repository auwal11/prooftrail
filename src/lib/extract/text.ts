import { ExtractionError, type ExtractedPage, type ExtractionResult } from "./types";

const MAX_CHARS = 400_000;

export function extractTextFile(buffer: Buffer): ExtractionResult {
  let decoded = buffer.toString("utf8").replace(/\r\n?/g, "\n");
  if (decoded.includes("\uFFFD")) {
    throw new ExtractionError(
      "text_encoding",
      "The text file is not valid UTF-8 and could not be read safely.",
    );
  }

  const truncated = decoded.length > MAX_CHARS;
  if (truncated) decoded = decoded.slice(0, MAX_CHARS);

  const page: ExtractedPage = {
    page: 1,
    text: decoded,
    words: [],
    units: "chars",
  };

  return {
    pages: [page],
    text: decoded,
    pageCount: 1,
    engine: "utf8-text",
    warnings: truncated ? ["Extraction stopped at the document text limit."] : [],
  };
}
