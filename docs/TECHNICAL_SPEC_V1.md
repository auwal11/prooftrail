# ProofTrail — Technical Specification v1.0

Status: implemented MVP for the Devcenter Hacktober 2026 competition.

## 1. Purpose

ProofTrail helps a customer reconstruct a Nigerian airtime or data dispute from their own evidence. It converts uploaded files into source-linked facts, identifies missing or conflicting information with deterministic rules, allows attributable corrections, and produces a PDF report.

The system is an evidence organiser, not an adjudicator. It does not verify claims with a bank, telecom operator, payment provider, or regulator, and it does not assert fraud.

## 2. Actors

| Actor | Capabilities |
| --- | --- |
| Visitor | Register, sign in, read the public landing page. |
| Customer (authenticated user) | Create and edit cases, upload evidence, review facts, generate and download reports, close or delete cases. |
| Demo reviewer | A seeded customer account used for evaluation. |

There is no administrator role in v1.

## 3. Primary user journey

1. Sign in or register.
2. Create a case with title, service type, provider, claimed amount, incident date, reference, phone, and description.
3. Upload the debit alert, operator receipt, and any delivery confirmation.
4. The server validates, hashes, stores, and extracts each file. Facts appear with page/line/character locators and excerpts.
5. The rule engine recalculates findings over active facts after every change.
6. The reviewer corrects or rejects facts that were misread. Each change creates an immutable revision.
7. The reviewer generates a PDF report containing the current state, evidence hashes, correction log, and limitations.
8. The reviewer may close or delete the case. Deletion removes stored files and dependent records.

## 4. Functional requirements

### 4.1 Authentication

- Email/password registration with a minimum password length of 10 characters.
- Email is normalised to lowercase and unique.
- Passwords are hashed with `scrypt` (N=16384, r=8, p=1, 64-byte key) and a random 16-byte salt.
- Successful login creates a random 32-byte session token. Only its SHA-256 hash is stored.
- The raw token is set in the `pt_session` cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/`, seven-day expiry.
- Sessions extend after two days of use and expire after seven days.
- Logout deletes the session row and clears the cookie.

### 4.2 Case management

- A case belongs to exactly one user.
- Required: title (3–140 chars), service type (`AIRTIME`, `DATA`, `OTHER`).
- Optional: provider (max 80), claimed amount (positive, max 1,000,000,000 NGN), incident date, transaction reference (max 80), customer phone, description (max 2,000).
- Statuses: `DRAFT`, `EVIDENCE_REVIEW`, `READY`, `CLOSED`.
- Creating evidence moves a `DRAFT` case to `EVIDENCE_REVIEW`; generating a report moves it to `READY` unless closed.
- Closing and reopening are explicit actions.
- All reads and writes are scoped by `userId`; a mismatched ID returns 404.

### 4.3 Evidence upload

- Accepted content: PDF, PNG, JPEG, WebP, UTF-8 text.
- Maximum size from `MAX_UPLOAD_BYTES` (default 10 MiB).
- Validation uses magic bytes plus declared MIME type and extension sanity checks; the browser MIME alone is never trusted.
- The file is stored under `STORAGE_DIR/evidence/` with a generated name. Original names are sanitised for display.
- SHA-256 is computed over the stored bytes and recorded.
- A case may contain many files; identical hashes are surfaced, not silently deduplicated.
- Deletion removes the database row and the stored file.

### 4.4 Extraction

- PDF: `unpdf` text extraction with per-page text and word boxes.
- Image: `tesseract.js` OCR using `OCR_LANG_PATH`; default bundled `assets/tessdata`.
- Text: UTF-8 decode with a character-unit page.
- Extraction status per file: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `UNSUPPORTED`.
- A failed extraction is visible and actionable; the case is not blocked.
- An in-flight lock prevents duplicate concurrent processing of the same evidence.
- Facts are capped at 300 per file to bound cost.
- Every fact stores: type, raw value, normalised value, confidence, locator, excerpt, extractor name/version, and timestamps.

### 4.5 Fact types and normalisation

| Type | Normalisation |
| --- | --- |
| `AMOUNT` | `NGN 1,000.00`; minor units internally for comparisons. |
| `DATE` | `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`; day-first numeric input. |
| `REFERENCE` | Trimmed, uppercased. |
| `PHONE` | `+234` followed by ten digits. |
| `STATUS` | Lowercase canonical status. |
| `SERVICE_TYPE` | Canonical label (`AIRTIME`, `DATA`). |
| `PROVIDER` | Canonical provider name. |
| `ACCOUNT_MASK` | Masked account value. |
| `DESCRIPTION` / `RECIPIENT` | Trimmed text. |

### 4.6 Review and corrections

- Actions: `CORRECT` (requires a changed value), `REJECT`, `RESTORE`.
- Revisions are append-only and record actor, timestamp, previous effective value, new value, and optional note.
- The effective value is computed from the ordered revisions; the original row is never mutated.
- Rejected facts are excluded from active comparisons but remain visible.
- Corrections and rejections create case audit events.

### 4.7 Findings

Twenty deterministic rules run over active facts and case metadata. Each finding has:

- stable ID derived from code + sorted fact/evidence IDs,
- code, title, severity (`high`, `medium`, `low`, `info`),
- category, explanation, recommended next step,
- referenced evidence IDs and fact IDs,
- source filenames and page references in the report.

Findings are sorted by severity, then title. They are leads, not conclusions.

### 4.8 Timeline

The timeline merges:

- case creation,
- evidence uploads and extraction status,
- distinct transaction dates (grouped across duplicate files),
- fact corrections/rejections/restores,
- report generation.

Extracted dates are zone-less wall-clock values. They are interpreted as UTC for display so the printed time is not shifted by server timezone.

### 4.9 PDF report

A4, server-generated with `pdf-lib`. Sections:

1. Cover band, case label (`PT-` plus last six characters of the case ID), title, prepared-for, generated timestamp, key case fields.
2. "What this report is, and what it is not" limitations callout.
3. Case summary and counts.
4. Evidence inventory with type, size, upload date, extraction status, and fact count.
5. Source-linked facts table with value, source, original/corrected state, and confidence.
6. Source excerpts (bounded).
7. Findings ordered by severity, with next steps and referenced files/pages.
8. Timeline.
9. Review and correction log.
10. Evidence integrity table with full SHA-256 values.
11. Method and limitations.
12. Footer with case label, confidentiality, page number, and generation time.

Every report generation creates a new `Report` row and file with its own SHA-256. Old reports remain downloadable.

## 5. Data model

```text
User 1─* Case 1─* Evidence 1─* Fact 1─* FactRevision
             │                    │
             ├─* CaseEvent       └─* (actor User)
             └─* Report
User 1─* Session
```

Key constraints:

- `User.email` unique.
- `Session.tokenHash` unique, `expiresAt` indexed.
- `Case.userId` indexed; `Case.status` indexed.
- `Evidence.caseId` cascade delete; `sha256` indexed.
- `Fact.evidenceId` cascade delete; `(evidenceId, type)` indexed.
- `FactRevision.factId` cascade delete; actor retained as a user reference.
- `Report.caseId` cascade delete.
- Money is stored as integer minor units where comparison matters; display uses `NGN` formatting.

## 6. API surface

All endpoints return JSON except file/report downloads. Errors use `{ "error": "...", "code": "..." }` with appropriate status codes.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account and session. |
| POST | `/api/auth/login` | Authenticate and create session. |
| POST | `/api/auth/logout` | Destroy session. |
| GET/POST | `/api/cases` | List or create cases. |
| PATCH/DELETE | `/api/cases/[id]` | Update metadata/status or delete. |
| POST | `/api/cases/[id]/evidence` | Multipart upload + extraction. |
| POST | `/api/cases/[id]/report` | Generate report. |
| GET | `/api/evidence/[id]/file` | Authenticated download. |
| DELETE | `/api/evidence/[id]` | Delete evidence and file. |
| POST | `/api/evidence/[id]/extract` | Retry extraction. |
| POST | `/api/facts/[id]/revisions` | Correct, reject, or restore. |
| GET | `/api/reports/[id]` | Authenticated report download. |

State-changing requests require a same-origin `Origin`/`Referer` when present.

## 7. Security model

- Authorisation is enforced server-side on every case, evidence, fact, and report operation.
- Object IDs are unguessable CUIDs, but authorisation never relies on unguessability.
- Evidence and reports are never written under `public/`.
- Filenames are generated; user-supplied names are sanitised and escaped in UI.
- No user content is rendered as raw HTML. React escapes text by default.
- Passwords and session tokens are never logged.
- Uploads are bounded in size, type, and extraction time.
- OCR and PDF parsing are treated as untrusted input: failures are contained per file.
- PDF output sanitises non-Latin-1 characters and uses embedded standard fonts.
- SHA-256 is presented as an integrity aid, not a tamper-proof guarantee.

### Out of scope

- Multi-tenant organisations, roles, and sharing.
- Email verification, password reset, MFA.
- Antivirus scanning of uploads.
- Provider/regulator integrations or complaint submission.
- Blockchain anchoring or "immutable" claims.
- Mobile applications.

## 8. Non-functional requirements

- Responsive layout for mobile and desktop.
- No public storage URLs.
- Deterministic rule output for the same facts and metadata.
- Extraction failures degrade gracefully and remain visible.
- Report generation completes in a few seconds for a normal case.
- Build, typecheck, lint, and tests pass in CI-equivalent local runs.

## 9. Acceptance criteria

- A new user can register, create a case, upload a PDF, see facts and findings, correct a fact, generate a report, download it, and delete the case.
- Evidence from another user cannot be read, modified, or deleted.
- A duplicate upload is detected by hash.
- A debit alert and a failed receipt produce `STATUS_CONFLICT` and `MISSING_DELIVERY_PROOF`.
- A correction changes the effective value and appears in the audit trail and report without altering the original extraction.
- Extracted wall-clock times render without a server-timezone shift.
- The report is a valid PDF and contains the required sections.
- `npm run verify` passes.

## 10. Known risks

| Risk | Mitigation |
| --- | --- |
| OCR misreads digits | Show confidence, excerpt, and locator; require human review; allow correction. |
| Users upload unrelated transactions | Findings flag reference/date/amount variance and recommend separate cases. |
| Evidence contains sensitive data | Private storage, authenticated access, demo-only public account, no third-party analytics. |
| Report interpreted as a legal determination | Prominent limitations in the UI and PDF; wording avoids fraud conclusions. |
| Hash presented as proof of authenticity | Explicit text that hashes detect changes but do not prove origin or truth. |
| Large PDFs or images exhaust resources | Size limit, 300-fact cap, OCR timeout, per-file failure isolation. |

## 11. Deployment

- Node.js runtime required (PDF and OCR libraries are not edge-compatible).
- PostgreSQL with migrations applied via `prisma migrate deploy`.
- Persistent volume for `STORAGE_DIR`.
- `assets/tessdata/eng.traineddata.gz` must ship with the app.
- Set `APP_URL` to the HTTPS origin and terminate TLS at the platform.
- Do not expose the storage directory or the database publicly.

## 12. Future work

- More Nigerian bank/operator formats and a rule-version registry.
- Optional email verification and password reset.
- Side-by-side evidence viewer with highlighted locators.
- Case export bundle (PDF + original files).
- Organisation accounts with explicit reviewer roles.
- Structured complaint letter templates that remain clearly customer-authored.
