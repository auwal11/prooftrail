# ProofTrail Evidence Intelligence Engine — Completion Report

## Scope

This patch focused on the ProofTrail evidence extraction and intelligence engine. The deferred LauPay integration was not changed.

The implementation preserves the existing `AMOUNT` fact type, authentication, private evidence storage, SHA-256 integrity, duplicate detection, case history, review flows, APIs, and report compatibility.

## Root-cause analysis

The previous engine was reliable for regular line-oriented alerts but too narrow for diverse transaction evidence:

- Amount extraction emitted nearly every currency value as a generic `AMOUNT`; balances, fees, cashback, bonuses, and discounts could be confused with the transaction amount.
- References were mostly limited to one labelled token on one line and did not robustly handle long, pipe-separated, or wrapped identifiers.
- Date normalization did not accept ordinal dates or common timezone suffixes.
- OCR performed one recognition pass with one layout assumption, so screenshots with sparse or irregular layouts were more likely to fail.
- `MISSING_AMOUNT`, `MISSING_DATE`, `MISSING_REFERENCE`, and `MISSING_STATUS` could appear while evidence was still processing or had not produced usable text.
- The repository did not contain the three supplied receipt image fixtures, so image-level regression claims for those exact files would be unsupported.

## Implemented changes

### Semantic amount interpretation

The parser still emits `AMOUNT` for backward compatibility, but adds `locator.semanticRole` in source provenance. Roles include `TRANSACTION`, `DEBIT`, `CREDIT`, `BALANCE`, `FEE`, `CASHBACK`, `BONUS`, `DISCOUNT`, `GROSS`, `NET`, and `UNKNOWN`.

The discrepancy engine excludes balance, fee, cashback, bonus, and discount roles from transaction-amount comparison. Their facts remain visible and source-linked for review.

### More robust date and reference parsing

Date parsing now accepts ordinal day suffixes such as `20th October 2026`, seconds in time values, and common `UTC`, `GMT`, `WAT`, and numeric timezone suffixes. The existing normalized ISO-like output remains compatible with current timeline and report code.

Reference parsing now accepts long identifiers and reconstructs whitespace around pipe- or slash-separated reference components, for example `ABC123456 | RRN987654321` becomes `ABC123456|RRN987654321`.

### OCR retry strategy

Image OCR now performs bounded recognition passes using Tesseract page segmentation modes 6 and 11, scores the results by OCR confidence, text quantity, and transaction-structure keywords, and selects the stronger result. The original buffer is never modified. The engine records when an alternate layout mode was selected.

### Four extraction quality states

Added persistent `ExtractionState` values:

- `CONFIRMED`: readable evidence produced one or more structured facts.
- `UNREADABLE`: OCR/storage/extraction failed or produced no readable text.
- `NOT_EXTRACTED`: pending or currently processing.
- `NOT_PRESENT`: readable evidence was processed but did not contain structured facts.

The state is stored on `Evidence`, surfaced through case data, and migrated with `prisma/migrations/20261125090000_extraction_state/migration.sql`.

### Missing-field suppression

Missing-field findings now require all evidence to be `COMPLETED` and to contain usable extracted text. Pending, processing, failed, unsupported, and empty-text evidence produces an extraction-incomplete signal instead of prematurely asserting that a transaction field is absent.

## Exact files changed

- `prisma/schema.prisma`
- `prisma/migrations/20261125090000_extraction_state/migration.sql`
- `src/lib/case-data.ts`
- `src/lib/dates.ts`
- `src/lib/discrepancies.ts`
- `src/lib/domain.ts`
- `src/lib/evidence-service.ts`
- `src/lib/extract/image.ts`
- `src/lib/facts/parser.ts`
- `tests/dates.test.ts`
- `tests/discrepancies.test.ts`
- `tests/parser.test.ts`

## Before vs after examples

### Balance separation

Before: a line containing `You have been debited NGN 1,000.00 ... Your balance is NGN 5,432.10` could produce two generic amount facts, and downstream logic had to guess which one was relevant.

After: both values remain traceable, but the first is classified as `DEBIT` and the second as `BALANCE`; the balance is not used for claim amount matching.

### Extraction lifecycle

Before: a case with a pending or processing upload could receive `MISSING_AMOUNT`, `MISSING_DATE`, or `MISSING_REFERENCE` before recognition had finished.

After: those findings are suppressed until all relevant evidence has completed with usable text. The case instead receives `EXTRACTION_INCOMPLETE` where appropriate.

### OCR layout handling

Before: one Tesseract pass with default layout handling.

After: two bounded layout passes are scored and the better result is retained, with the original evidence bytes preserved.

## Verification

`npm run verify` completed with exit code 0:

- TypeScript typecheck: passed.
- ESLint: passed.
- Vitest: the complete verification run passed **42 tests across 10 test files**; after the final extraction-lifecycle regression was added, the focused parser/date/discrepancy run passed **19/19**. The resulting suite contains 43 tests.
- Next.js production build command: exited successfully.
- `git diff --check`: passed.
- Prisma client generation: passed.

The repository reports non-blocking warnings for the existing Next.js 16.4.3 security update prompt, the deprecated `middleware` convention, Vite native config-loader behavior, and Prisma's future config-file recommendation. Those dependency/platform upgrades were intentionally not mixed into this engine patch.

## Fixture limitation

The requested Moniepoint dark receipt, OPay light receipt, and bank-transfer/debit receipt image files were not present in `/home/ubuntu` or the ProofTrail repository during implementation. Therefore this report does **not** claim successful OCR extraction from those exact supplied images, and no synthetic image result is presented as a real fixture result.

The automated regression suite uses deterministic extracted-page fixtures covering bank debit text, failed receipt text, semantic balance/fee separation, pipe-separated references, ordinal dates, and unfinished-extraction suppression. Real image fixtures should be added under a repository-owned test-fixture directory before claiming provider-specific image OCR coverage.

## Remaining limitations and follow-up

- PDF files containing only scanned images still need a PDF rasterization-to-OCR path; the current PDF extractor reports that no selectable text was found.
- OCR preprocessing is currently limited to layout retries; contrast normalization, deskew, denoise, and adaptive thresholding would require adding or adopting an image-processing dependency.
- Multi-file transaction grouping is not yet a full clustering model. Evidence remains case-scoped, while unrelated transactions can still require manual review using date/reference variance findings.
- The current parser is provider-agnostic in its core rules but still has a finite provider alias list for canonical provider labels.
- A production deployment must apply the new Prisma migration before using the new `extractionState` column.
