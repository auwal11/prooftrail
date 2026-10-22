# ProofTrail

**Evidence intelligence for Nigerian airtime and data transaction disputes.**

ProofTrail turns a messy folder of bank alerts, operator receipts, and screenshots into a structured, source-linked case file. It extracts facts from each file, keeps a pointer to the exact page and text that supports every fact, compares those facts deterministically, and produces a professional PDF report that separates what the evidence says from what it cannot prove.

Built for the Devcenter Hacktober 2026 competition.

> ProofTrail does not adjudicate disputes, contact providers, or confirm that a complaint was filed. A discrepancy is an investigative lead, not proof of fraud. The original files remain the authoritative record.

## Why it exists

Airtime and data disputes usually start with fragmented evidence: a debit alert from a bank, a receipt or SMS from a telecom operator, and a screenshot of a support conversation. The details do not always agree. A customer may have been debited while the operator records a failed recharge, or a reference may be copied incorrectly. Reconstructing that timeline by hand is slow, and the resulting complaint often lacks traceable references.

ProofTrail does five things:

1. Stores evidence privately and records its SHA-256 hash at upload.
2. Extracts candidate facts with page, line, character offsets, and a short excerpt.
3. Compares facts using explicit, deterministic rules.
4. Lets the reviewer correct or reject extracted facts without overwriting the original.
5. Generates a source-linked PDF report with findings, timeline, hashes, and stated limitations.

## Feature set

- Account registration, sign-in, hashed session cookies, and per-user case isolation.
- Case intake for airtime, data, or other transactions, with claimed amount, provider, incident date, reference, and phone.
- Private evidence upload (`PDF`, `PNG`, `JPEG`, `WebP`, `TXT`) with magic-byte validation, size limits, safe filenames, and SHA-256 hashing.
- PDF text extraction through `unpdf`/PDF.js, including page and character locators.
- OCR for images through `tesseract.js` with a bundled English language model (no runtime download).
- Deterministic fact extraction for amounts, dates, references, phones, statuses, service types, providers, account masks, descriptions, and recipients.
- Duplicate-file detection by content hash.
- Twenty discrepancy rules covering missing evidence, missing or conflicting fields, amount/date/reference/phone variances, future dates, provider/service mismatches, and missing delivery proof.
- Fact review with append-only corrections, rejections, and restores. Original extraction values are never overwritten.
- Case timeline that merges transaction dates, case events, evidence uploads, corrections, and report generation.
- Professional A4 PDF report with cover summary, evidence inventory, every source-linked fact, source excerpts, finding cards, timeline, correction log, full SHA-256 values, and method/limitations.
- Demo account and seeded case with a deliberate debit-versus-failed-recharge inconsistency.
- Vitest coverage for date parsing, money parsing, fact extraction, revision resolution, discrepancies, and timeline construction.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 18, Prisma 6 |
| PDF input | `unpdf` (PDF.js text layer) |
| OCR | `tesseract.js` with local `eng.traineddata` |
| PDF output | `pdf-lib` |
| Validation | `zod` |
| Tests | Vitest |

## Getting started

### 1. Requirements

- Node.js 20+
- PostgreSQL 14+
- npm

### 2. Install

```bash
npm install
```

`postinstall` runs `prisma generate`.

### 3. Configure

```bash
cp .env.example .env
```

Set `DATABASE_URL` to your PostgreSQL instance. Keep `STORAGE_DIR` outside `public/` because evidence must never be publicly served.

### 4. Create the database

```bash
npx prisma migrate deploy
```

### 5. Seed the demo case

```bash
npm run db:seed
```

This creates `demo@prooftrail.app` / `ProofTrailDemo2026` with a sample airtime case, three generated PDF files, extracted facts, a duplicate-file signal, and a PDF report.

### 6. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with the demo account.

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm start            # production server
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run verify       # typecheck + lint + test + build
npm run db:seed      # seed demo data
npm run db:migrate   # create/apply a development migration
npm run db:deploy    # apply committed migrations
```

## How extraction works

1. **Upload validation.** The server sniffs magic bytes, enforces the configured size limit, computes SHA-256, and stores the file under a generated name inside the private storage directory.
2. **Text acquisition.**
   - PDFs: text layer plus word bounding boxes and page dimensions.
   - Images: OCR with Tesseract, using locally bundled language data.
   - Text: UTF-8 with character units.
3. **Rule extraction.** `src/lib/facts/parser.ts` applies versioned patterns. Each fact carries the extractor name/version, confidence, page, line, character range, and a bounded excerpt.
4. **Effective values.** `src/lib/facts/effective.ts` resolves append-only revisions. A corrected fact displays the reviewer's value while retaining the original.
5. **Comparison.** `src/lib/discrepancies.ts` compares active facts and case metadata. Each finding lists the evidence and facts it depends on.
6. **Report.** `src/lib/report/pdf.ts` renders the case with `pdf-lib`.

### Extraction rules (v1.0.0)

- Amounts accept `NGN`, `₦`, `N`, commas, and one or two decimal places. Values near "balance" are excluded.
- Dates accept ISO, day-first numeric (Nigerian convention), month names, and optional 12-hour times. Two-digit years resolve against the current year.
- References require a labelled context (`Transaction Ref`, `Reference`, `RRN`, `Session ID`, etc.) and at least one digit.
- Nigerian phone numbers accept `0XXXXXXXXXX` and `+234XXXXXXXXXX`.
- Statuses are normalised to `debited`, `successful`, `failed`, `pending`, `processing`, `reversed`, `refunded`, `credited`, or `completed`.

## Discrepancy rules

| Code | Severity | What it surfaces |
| --- | --- | --- |
| `NO_EVIDENCE` | medium | The case has no files. |
| `EXTRACTION_INCOMPLETE` | medium | One or more files could not be read. |
| `DUPLICATE_EVIDENCE` | low | Two files share the same SHA-256 hash. |
| `MISSING_AMOUNT` | medium | No amount could be extracted. |
| `CLAIM_AMOUNT_MISMATCH` | high | The claimed amount does not match extracted amounts. |
| `AMOUNT_VARIANCE` | low | Multiple different amounts appear. |
| `MISSING_DATE` | medium | No transaction date could be extracted. |
| `DATE_MISMATCH` | medium | Evidence dates are more than a day from the incident date. |
| `DATE_VARIANCE` | low | Evidence contains calendar dates days apart. |
| `FUTURE_DATE` | medium | A date more than 24 hours ahead was extracted. |
| `MISSING_INCIDENT_DATE` | low | The case has no incident date. |
| `MISSING_REFERENCE` | medium | No transaction reference could be extracted. |
| `REFERENCE_MISMATCH` | medium | The case reference does not appear in evidence. |
| `REFERENCE_VARIANCE` | low | Multiple different references appear. |
| `STATUS_CONFLICT` | high | One source says failed while another says successful/completed. |
| `MISSING_STATUS` | low | No transaction status could be extracted. |
| `SERVICE_MISMATCH` | medium | Extracted service type conflicts with the case. |
| `PROVIDER_MISMATCH` | medium | Extracted providers conflict with the case. |
| `PHONE_MISMATCH` | low | The case phone does not appear in evidence. |
| `MISSING_DELIVERY_PROOF` | high | A debit is present but no delivery confirmation is present. |

Rules deliberately report "missing information" and "variance" rather than asserting wrongdoing.

## Data and security model

- Every case query is scoped to the signed-in user. Unauthorised IDs return 404.
- Evidence files are served only through an authenticated route that checks case ownership.
- Files are stored outside `public/` with generated names; original names are metadata only.
- Uploads are validated by magic bytes, not just the browser-supplied MIME type.
- Passwords use `scrypt` with a random salt.
- Session tokens are stored as SHA-256 hashes; the raw token lives only in an HTTP-only cookie.
- State-changing requests use same-origin checks.
- Report PDFs are generated on the server and access-checked on download.
- SHA-256 detects changes to a stored file. It is **not** a blockchain proof, a tamper-proof audit log, or evidence of who created a file.
- OCR and extraction errors are expected. The UI keeps the original excerpt and supports reviewer corrections.

## Project structure

```text
prisma/
  schema.prisma          data model
  migrations/            committed SQL migrations
  seed.ts                demo user, case, files, facts, report
src/
  app/
    api/                 auth, cases, evidence, facts, reports
    cases/               list, new, detail, edit
    login/, register/    auth pages
  components/            server and client UI
  lib/
    extract/             PDF, image, and text extraction
    facts/               deterministic parser and revision resolution
    report/              PDF layout
    discrepancies.ts     rule engine
    timeline.ts          merged chronology
    case-data.ts         case detail assembly
    evidence-service.ts  upload processing pipeline
    storage.ts           private file storage
    http.ts              auth, origin, error helpers
    validation.ts        zod schemas
tests/                   Vitest suites
assets/tessdata/         bundled OCR language data
```

## Testing

```bash
npm run test
```

The suite covers:

- Day-first and named-month date parsing, two-digit years, invalid dates, and noon/midnight.
- Money parsing, formatting, rounding limits, and tolerance.
- Fact extraction from bank debit alerts and failed operator receipts.
- Append-only correction, rejection, and restore semantics.
- Discrepancy severity and code generation.
- Timeline timezone handling, duplicate grouping, and rejected-fact exclusion.

## Deployment notes

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Run `npm run db:deploy`.
3. Set `APP_URL` to the public HTTPS origin.
4. Mount persistent private storage for `STORAGE_DIR`.
5. Ensure `assets/tessdata/` is included in the deployment bundle.
6. Run `npm run build` then `npm start`.

Do not enable public access to `var/` or any storage directory.

## Known limitations

- OCR accuracy depends on image quality and can misread digits.
- The rule engine is intentionally conservative and does not understand every Nigerian bank or operator format.
- There is no multi-user collaboration or organisation tenancy.
- Reports are point-in-time snapshots; regenerating produces a new hash.
- The product does not submit complaints to banks, operators, or regulators.

## License

Competition submission. All rights reserved by the author unless a separate license is added.
