# ProofTrail Evidence Intelligence Engine — Completion Report

## Scope

This patch focused on the ProofTrail evidence extraction and intelligence engine. The deferred LauPay integration was not changed.

The implementation preserves the existing `AMOUNT` fact type, authentication, private evidence storage, SHA-256 integrity, duplicate detection, case history, review flows, APIs, and report compatibility.

## Root-cause analysis

The previous engine was reliable for regular line-oriented alerts but too narrow for diverse transaction evidence:

- Amount extraction emitted nearly every currency value as a generic `AMOUNT`; balances, fees, cashback, bonuses, and discounts could be confused with the transaction amount.
- References were mostly limited to one labelled token on one line and did not robustly handle long, pipe-separated, slash-separated, or wrapped identifiers.
- Date normalization did not accept ordinal dates, month-first banking dates, seconds, or common timezone suffixes.
- OCR performed one recognition pass with one layout assumption, so screenshots with sparse or irregular layouts were more likely to fail.
- `MISSING_AMOUNT`, `MISSING_DATE`, `MISSING_REFERENCE`, and `MISSING_STATUS` could appear while evidence was still processing or had not produced usable text.
- The repository did not contain the supplied receipt image fixtures until this patch.

## Implemented changes

### Semantic amount interpretation

The parser still emits `AMOUNT` for backward compatibility, but adds `locator.semanticRole` in source provenance. Roles include `TRANSACTION`, `DEBIT`, `CREDIT`, `BALANCE`, `FEE`, `CASHBACK`, `BONUS`, `DISCOUNT`, `GROSS`, `NET`, and `UNKNOWN`.

The discrepancy engine excludes balance, fee, cashback, bonus, and discount roles from transaction-amount comparison. Their facts remain visible and source-linked for review.

### More robust date and reference parsing

Date parsing now accepts ordinal day suffixes such as `20th October 2026`, day-first and unambiguous month-first numeric dates, seconds, AM/PM, and common `UTC`, `GMT`, `WAT`, and numeric timezone suffixes. The existing normalized ISO-like output remains compatible with current timeline and report code.

Reference parsing accepts long identifiers and reconstructs whitespace around pipe- or slash-separated reference components. It handles wrapped labels such as a Moniepoint reference split across lines and an Interswitch value formatted as `000118159468 / 000118159468`.

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

## Supplied real-image regression fixtures

The following supplied screenshots are now repository-owned fixtures under `tests/fixtures/receipts/`:

- `opay-mtn-airtime.jpg`
- `moniepoint-airtime-dark.jpg`
- `laupay-web-airtime.jpg`
- `interswitch-debit-airtime.jpg`

Automated OCR/parser coverage currently asserts:

- **OPay/MTN light receipt:** `NGN 156.00`, `NGN 154.20`, `NGN 1.80` as `CASHBACK`, visible status `successful`, Airtime, recipient phone, date, and long reference. The screenshot's visible `₦1.40` is read by OCR as `NGN 41.40`; the engine retains that raw OCR interpretation as a lower-trust `BONUS` fact rather than silently inventing `NGN 1.40`.
- **Moniepoint dark receipt:** `NGN 100.00` debit, `NGN 378.66` and `NGN 278.66` as balances, successful status, Airtime, date, and the wrapped reference `ATP|2MPT208YZ|2123389903303208960`.
- **Interswitch debit receipt:** `NGN 200.00` as `DEBIT`, phone `+2349011887318`, transaction date `2026-11-20T20:57`, and slash-separated reference `000118159468/000118159468`. No status is invented because the receipt does not visibly provide one.
- **LauPay web receipt:** retained in the fixture set for follow-up coverage; it is not used for stronger claims than the current OCR reliably supports.

## Exact files changed in this final increment

- `src/lib/dates.ts`
- `src/lib/facts/parser.ts`
- `tests/image-extraction.test.ts`
- `docs/PROOFTRAIL_ENGINE_COMPLETION.md`
- `tests/fixtures/receipts/opay-mtn-airtime.jpg`
- `tests/fixtures/receipts/moniepoint-airtime-dark.jpg`
- `tests/fixtures/receipts/laupay-web-airtime.jpg`
- `tests/fixtures/receipts/interswitch-debit-airtime.jpg`

The earlier engine rebuild also changed `prisma/schema.prisma`, `prisma/migrations/20261125090000_extraction_state/migration.sql`, `src/lib/case-data.ts`, `src/lib/discrepancies.ts`, `src/lib/domain.ts`, `src/lib/evidence-service.ts`, `src/lib/extract/image.ts`, `tests/dates.test.ts`, `tests/discrepancies.test.ts`, and `tests/parser.test.ts`.

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

The final focused real-image suite passed **3/3 tests**. The date regression suite passed **7/7 tests**, and TypeScript typecheck passed after the parser/date changes. The full repository verification should be run before release; non-blocking warnings remain for the existing Next.js security update prompt, deprecated `middleware` convention, Vite native config-loader behavior, and Prisma's future config-file recommendation.

## Live demo workflow status

The requested public-demo workflow could not be completed honestly because `https://prooftrail.rumptycloud.app` was unavailable during testing and displayed **“This app did not start — RumptyCloud”**. Consequently, no login, case creation, one-by-one upload, all-together upload, or live report comparison is claimed in this report. The fixture-level extraction and parser tests were completed locally instead.

## Remaining limitations and follow-up

- The OPay `₦1.40` OCR artifact remains a known limitation. Correcting `41.40` to `1.40` would require a defensible image/layout rule or a human review signal; the engine does not silently alter the raw OCR value.
- PDF files containing only scanned images still need a PDF rasterization-to-OCR path; the current PDF extractor reports that no selectable text was found.
- OCR preprocessing is currently limited to layout retries; contrast normalization, deskew, denoise, and adaptive thresholding would require adding or adopting an image-processing dependency.
- Multi-file transaction grouping is not yet a full clustering model. Evidence remains case-scoped, while unrelated transactions can still require manual review using date/reference variance findings.
- The current parser is provider-agnostic in its core rules but still has a finite provider alias list for canonical provider labels.
- A production deployment must apply the new Prisma migration before using the new `extractionState` column.
