# ProofTrail — Progress Log

Last updated: 2026-10-24 (WAT)

## Current status

The MVP is implemented end-to-end and runs locally against PostgreSQL. Registration, authentication, case management, private evidence upload, PDF/OCR/text extraction, source-linked facts, deterministic findings, fact review, timeline, PDF reporting, case closure, and deletion all work in the browser. Typecheck, lint, unit tests, and production build pass.

## Completed

### Foundation

- Cloned `auwal11/prooftrail` and established the `main` branch.
- Selected Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Prisma 6, and PostgreSQL.
- Provisioned a local PostgreSQL 18 cluster on port 5433 for development.
- Added `.env.example`, `.gitignore`, and private storage outside `public/`.
- Created the data model: User, Session, Case, Evidence, Fact, FactRevision, CaseEvent, Report.
- Applied migrations `20261021131736_init` and `20261021132839_extraction_notes`.

### Authentication and cases

- scrypt password hashing with per-password salts.
- Random session tokens, SHA-256-hashed at rest, HTTP-only `pt_session` cookie, seven-day expiry with rolling extension after two days.
- Registration, login, logout, and middleware protection for `/cases/*`.
- Case intake for airtime, data, and other transactions.
- Case list with file/fact counts and status badges.
- Edit, close, reopen, and permanent delete with stored-file cleanup.
- Case activity log for creation, evidence, reports, corrections, and deletion.

### Evidence pipeline

- Magic-byte validation for PDF, PNG, JPEG, WebP, and text; declared MIME and extension checks; 10 MiB limit.
- Private storage with generated filenames and SHA-256 recorded at upload.
- PDF text extraction with `unpdf`, including per-page word boxes.
- OCR with `tesseract.js` and a bundled 10.9 MB English model; 90-second timeout.
- UTF-8 text extraction.
- Per-file extraction status and retry endpoint.
- In-flight lock to prevent duplicate concurrent processing.
- Duplicate files detected by content hash and surfaced as a low-severity finding.

### Facts and findings

- Versioned deterministic parser (`prooftrail-ng-alert-rules` v1.0.0) for amounts, dates, references, phones, statuses, services, providers, account masks, descriptions, and recipients.
- Every fact stores page, line, character range, bounding box when available, confidence, and excerpt.
- Day-first Nigerian date parsing with 12-hour times and two-digit years.
- Append-only corrections, rejections, and restores. Original extracted values are never overwritten.
- Twenty discrepancy rules, including debit-without-delivery, status conflict, amount/date/reference/phone variance, missing fields, duplicate evidence, future dates, and service/provider mismatches.
- Timeline merges case events, evidence, distinct transaction dates, revisions, and reports.

### Report

- Server-side A4 PDF with `pdf-lib`.
- Cover, limitations, summary, evidence inventory, every source-linked fact, excerpts, finding cards, timeline, correction log, full hashes, and method/limitations.
- Case label standardised as `PT-` plus the last six characters of the case ID.
- Correct English article handling ("an airtime dispute").
- Duplicate source names removed.
- Finding cards place the severity badge above the title with a clear gap, and all body/source text is wrapped to the card inner width.
- Report files stored privately, hashed, and downloadable only by the owner.

### UI

- Landing page with product explanation, workflow, honesty boundaries, and demo credentials.
- Sign-in and registration pages.
- Cases dashboard.
- Case workspace with evidence uploader, evidence cards, findings, fact review with filters and history, timeline, report panel, case details, activity log, and destructive actions.
- Responsive styling with Tailwind v4.
- Fixed the dark "Honest boundaries" panel by replacing a conflicting `.card` class with `.card-dark`.
- Fixed 4 px horizontal overflow on the case workspace at narrow widths by adding `min-w-0` to the main content and sticky sidebar grid children.

### Verification

- `npx tsc --noEmit`: passed.
- `npx eslint .`: 0 errors.
- `npm run build`: passed; all routes compiled.
- `npx vitest run`: 27 tests in 6 files passed.
- Browser QA:
  - Demo login with a clean seeded case.
  - New case creation with data service, amount, incident date, reference, and phone.
  - Edit case title.
  - Upload a PDF and a PNG; OCR produced 9 facts.
  - Duplicate upload detected by hash.
  - Correction saved and displayed with original value retained.
  - Restore returned the fact to its original value.
  - Report generated and downloaded; text layer inspected page by page.
  - Case closed, reopened, and deleted.
  - Logout and middleware redirect confirmed.
  - Timeline order and wall-clock times verified after the timezone fix.
  - Mobile QA at 500 px: landing, dashboard, case summary, findings, facts, and report panel checked with no horizontal overflow.
  - Desktop QA at 1440 px: sticky sidebar and dense case workspace checked.
  - Report pages 4–5 checked in the PDF viewer; badge, title, body, source, timeline, correction-log, and hash-table layouts are all inside the page margins.
- Timezone bug fixed: naive extracted dates are interpreted as UTC so `12:34` renders as `12:34`, not `11:34`.
- Report issues fixed: case label, grammar, duplicate sources, action column wrapping, timeline grouping.
- Demo database reset to a clean state after QA: 1 case, 3 files, 30 facts, 4 findings.

## Tests added

- `tests/dates.test.ts` — day-first dates, named months, two-digit years, invalid dates, noon/midnight.
- `tests/money.test.ts` — parsing, formatting, limits, tolerance.
- `tests/parser.test.ts` — bank alert and failed receipt extraction, locators, no false positives.
- `tests/effective.test.ts` — correction, reject, restore, date normalisation.
- `tests/discrepancies.test.ts` — delivery/status findings, variances, duplicates, empty case, missing amount.
- `tests/timeline.test.ts` — UTC wall-clock handling, duplicate grouping, rejected facts.

## Blockers

- **Deployment platform and credentials are unknown.** No target platform, account, or deployment token has been provided. Local production build and run are verified; deployment remains pending.

## Next priorities

1. Add a Dockerfile and deployment recipe once the target platform is known.
2. Add a small end-to-end smoke test around the API if time allows.
3. Reseed and perform a final submission walkthrough before the deadline.
4. Re-run `npm run verify` after the final content changes and push the updated documentation.

## Submission checklist

- [x] Working product, not a mockup.
- [x] Real extraction and deterministic findings.
- [x] Private evidence and authenticated access.
- [x] Professional PDF output.
- [x] Seeded demo account.
- [x] README, technical spec, implementation plan, progress log.
- [x] Typecheck, lint, tests, build.
- [ ] Git history pushed to GitHub.
- [ ] Public deployment URL.
- [ ] Final visual pass at mobile and desktop.
