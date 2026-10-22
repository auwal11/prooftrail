import { readFile } from "node:fs/promises";
import { extractEvidence } from "../src/lib/extract";
import { extractFactsFromPages } from "../src/lib/facts/parser";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/inspect-extraction.ts <file>");
    process.exit(1);
  }

  const buffer = await readFile(file);
  const kind = file.endsWith(".pdf") ? "PDF" : file.endsWith(".txt") ? "TEXT" : "IMAGE";
  const extraction = await extractEvidence(kind, buffer);

  console.log("engine:", extraction.engine, "pages:", extraction.pageCount);
  console.log("warnings:", extraction.warnings);
  console.log("text:\n", extraction.text.slice(0, 2000));
  console.log("facts:");
  console.log(JSON.stringify(extractFactsFromPages(extraction.pages), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
