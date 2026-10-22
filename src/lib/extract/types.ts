import type { BBox } from "@/lib/domain";

export type ExtractedWord = {
  text: string;
  start: number;
  end: number;
  bbox?: BBox;
};

export type ExtractedPage = {
  page: number;
  text: string;
  words: ExtractedWord[];
  width?: number;
  height?: number;
  units?: "pt" | "px" | "chars";
};

export type ExtractionResult = {
  pages: ExtractedPage[];
  text: string;
  pageCount: number;
  engine: string;
  warnings: string[];
};

export class ExtractionError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
