# ProofTrail — Implementation Plan

Status keys: **Done**, **In progress**, **Next**, **Blocked**.

## Phase 0 — Environment and foundation

| Item | Status | Notes |
| --- | --- | --- |
| Clone repository and establish git baseline | Done | `main`, clean remote URL. |
| Choose stack | Done | Next.js 16, React 19, TypeScript, Tailwind 4, Prisma 6, PostgreSQL. |
| Provision local PostgreSQL | Done | Dedicated cluster on port 5433 for development. |
| Environment template and gitignore | Done | `.env.example` committed; `.env` and `var/` ignored. |
| Database schema and migrations | Done | `init` and `extraction_notes` migrations applied. |
| Seed skeleton | Done | Demo user and case scaffold. |

## Phase 1 — Authentication and case intake

| Item | Status | Notes |
| --- | --- | --- |
| Registration, login, logout | Done | scrypt passwords, hashed session tokens, HTTP-only cookie. |
| Route protection | Done | Middleware redirects unauthenticated `/cases/*`. |
| Case list and metrics | Done | Files and fact counts per case. |
| Create/edit case | Done | Validation, money handling, day-first date input. |
| Case status and audit events | Done | Draft, review, ready, closed; event log. |
| Delete case | Done | Cascades records and removes stored files. |

## Phase 2 — Private evidence pipeline

| Item | Status | Notes |
| --- | --- | --- |
| Private storage abstraction | Done | Generated names, path traversal guards. |
| Upload validation | Done | Magic bytes, MIME, extension, size limit. |
| SHA-256 hashing and duplicate surfacing | Done | Content-identical files flagged, never merged silently. |
| PDF text extraction | Done | `unpdf`, page/word locators. |
| Image OCR | Done | `tesseract.js`, bundled language data, timeout. |
| Plain text extraction | Done | UTF-8 with character units. |
| Retry and failure handling | Done | Per-file status and retry endpoint. |
| In-flight processing lock | Done | Prevents duplicate concurrent extraction. |

## Phase 3 — Facts and findings

| Item | Status | Notes |
| --- | --- | --- |
| Deterministic fact parser | Done | Versioned rules `prooftrail-ng-alert-rules` v1.0.0. |
| Fact locators and excerpts | Done | Page, line, character range, bounding box when available. |
| Amount/date/reference/phone normalisation | Done | Day-first dates and `+234` phones. |
| Append-only revisions | Done | Correct, reject, restore. |
| Effective fact resolution | Done | Original values retained. |
| Discrepancy engine | Done | Twenty rules, severity ordered. |
| Duplicate detection | Done | Grouped by hash. |
| Timeline builder | Done | UTC wall-clock handling and duplicate grouping. |

## Phase 4 — Report and UI

| Item | Status | Notes |
| --- | --- | --- |
| Case workspace UI | Done | Evidence, findings, facts, timeline, report, details. |
| Evidence upload and actions | Done | Preview, open, retry, remove. |
| Fact review UI | Done | Filters, confidence, excerpt, correction history. |
| Report generation | Done | Server-side `pdf-lib`, stored and hashed. |
| Report download | Done | Authenticated route. |
| Professional visual design | Done | Responsive Tailwind theme, dark boundary panel. |
| Landing page and demo credentials | Done | Public overview and seeded demo access. |

## Phase 5 — Verification and quality

| Item | Status | Notes |
| --- | --- | --- |
| Typecheck | Done | `tsc --noEmit` clean. |
| Lint | Done | ESLint clean. |
| Production build | Done | Next.js build succeeds. |
| Unit tests | Done | 27 tests across six suites. |
| Manual browser QA | Done | Auth, create, edit, upload (OCR + PDF), duplicates, corrections, report, close/reopen, delete, logout, middleware. |
| Timezone regression fix | Done | Extracted times render as authored. |
| Report layout fixes | Done | Case label, grammar, source dedupe, action column, timeline dedupe. |
| Demo data reset | Done | Clean seed with 3 files, 30 facts, 4 findings. |
| Visual QA of landing dark panel | In progress | CSS fix in place; screenshot tooling intermittent. |
| Mobile viewport QA | Next | Check 390px and 768px layouts after final build. |

## Phase 6 — Documentation and delivery

| Item | Status | Notes |
| --- | --- | --- |
| README | Done | Setup, features, architecture, security, testing. |
| Technical specification | Done | `docs/TECHNICAL_SPEC_V1.md`. |
| Implementation plan | Done | This document. |
| Progress log | Done | `docs/PROGRESS.md`. |
| Git commits and push | Next | Commit in logical increments and push to `main`. |
| Deployment | Blocked | No platform credentials or provider identified yet. |
| Dockerfile / deployment recipe | Next | Add once the target platform is known. |

## Sequencing rationale

Authentication and case isolation come first because every later object depends on ownership. The evidence pipeline is next because facts are the product. Rules are implemented only after locators exist so every finding can point back to a source. Report generation is last because it consumes the stabilised case model. Tests follow each pure module to keep the rule engine deterministic.

## Risks to the plan

- Deployment credentials unknown; do not invent a platform.
- OCR is slow on large images; keep timeouts and per-file isolation.
- Report layout is dense; verify page breaks after content changes.
- Demo data can drift during QA; reseed before submission.
