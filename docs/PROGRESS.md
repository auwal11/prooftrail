# ProofTrail — Progress Log

Last updated: 2026-10-25 (WAT)

## Current status

The MVP is implemented end-to-end, runs locally against PostgreSQL, and is deployed at <https://prooftrail.rumptycloud.app>. Registration, authentication, case management, private evidence upload, PDF/OCR/text extraction, source-linked facts, deterministic findings, fact review, timeline, PDF reporting, case closure, and deletion all work in the browser. Typecheck, lint, unit tests, and production build pass.

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
- Fixed production sign-in and registration: same-origin checks now accept the proxy-forwarded public host in addition to the request URL and `APP_URL`. Covered by `tests/origin.test.ts`.
- Upgraded Next.js to 16.4.3, image-size to 2.0.4, tsx to 4.23.15, and pinned patched transitive versions (`deepmerge-ts` 8.0.2, `esbuild` 0.28.1, `postcss-selector-parser` 7.1.7). `npm audit` reports 0 vulnerabilities; the production build log reports `found 0 vulnerabilities`.

### Case workflow and guidance

- Added a sticky four-step case stepper (Evidence, Findings, Review facts, Report) with live completion details and `aria-current`.
- Added explicit fact review state (`reviewedAt`), Unreviewed/All/Reviewed filters, and bulk "mark visible as reviewed" with an audit event.
- Replaced severity jargon with Blocker/Important/Info and raised duplicate-evidence and reference-variance findings to Important.
- Added an open-gaps summary and a copyable neutral complaint draft that never claims fraud or contacts a provider.
- Added report guidance: open-gaps summary, transaction reference and phone, a "How to use this report" section, and a clearer limitation statement.
- Added a three-step empty state with an "Explore sample case" action that copies the demo case into the user's account.
- Added service-specific suggested-evidence lists to case creation and a day-first date hint.
- Added XHR upload progress, an extracting state, and a mobile "Take photo" capture input.
- Added a route-level loading skeleton for the cases dashboard.

### Production durability

- Added `Evidence.data` and `Report.data` (`bytea`) via migration `20261025064551_blob_storage`.
- Evidence uploads, demo seeding, and report generation now persist bytes in PostgreSQL; download and extraction paths read the database first and fall back to private disk storage.
- Fixed live report and evidence downloads that previously returned 500 after redeploys because the seeded files only existed on a developer machine.
- Re-seeded the production demo with blobs, switched the deployment to the database provider's internal hostname, and verified login, case view, report download (16,723 bytes), and evidence download (1,461 bytes) after a fresh redeploy.
- Removed the temporary, token-gated production bootstrap endpoint after applying the migration and seed.

### Verification

- `npx tsc --noEmit`: passed.
- `npx eslint .`: 0 errors.
- `npm run build`: passed; all routes compiled.
- `npx vitest run`: 34 tests in 8 files passed.
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
- `tests/origin.test.ts` — same-origin checks for direct, proxy-forwarded, configured, rejected, and non-browser requests.
- `tests/complaint-draft.test.ts` — neutral complaint draft fields, gap inclusion, optional details, and no fraud claims.

## Blockers


## Next priorities

1. Keep the RumptyCloud deployment healthy and rerun the live smoke test after each push.
2. Add a small end-to-end smoke test around the API if time allows.
3. Reseed the production demo case and perform a final submission walkthrough before the deadline.
4. Re-run `npm run verify` after the final content changes and push the updated documentation.

## Submission checklist

- [x] Working product, not a mockup.
- [x] Real extraction and deterministic findings.
- [x] Private evidence and authenticated access.
- [x] Professional PDF output.
- [x] Seeded demo account.
- [x] README, technical spec, implementation plan, progress log.
- [x] Typecheck, lint, tests, build.
- [x] Git history pushed to GitHub.
- [x] Public deployment URL.
- [x] Final visual pass at mobile and desktop.
