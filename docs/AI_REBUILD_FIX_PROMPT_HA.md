# Prompt: Sake Gina ProofTrail Evidence Extraction & Intelligence Engine

Kai ne senior engineer da ke kula da ProofTrail Evidence Extraction & Intelligence Engine. Ka sake duba, gyara, kuma inganta engine ɗin domin ya karɓi legitimate transaction evidence daga screenshots, PDFs, da unknown receipt layouts ba tare da hardcoding provider guda ɗaya ba.

## Abubuwan da dole engine ya cika

1. Idan transaction information tana cikin evidence kuma OCR ya iya karantawa, a fitar da ita da source provenance, confidence, page, line/bounding box, da snippet.
2. Kada a ƙirƙiri field da ba ya cikin evidence. Idan field ba ya nan, a bambanta `NOT_PRESENT` da `UNREADABLE` ko `NOT_EXTRACTED`.
3. A ci gaba da amfani da existing `AMOUNT` fact type domin backward compatibility, amma a saka semantic amount role a provenance: `DEBIT`, `TRANSACTION`, `BALANCE`, `FEE`, `CASHBACK`, `BONUS`, `DISCOUNT`, `GROSS`, `NET`, `CREDIT`, ko `UNKNOWN`.
4. Kada balance, fee, cashback, bonus, discount, ko reward su zama transaction amount ta atomatik.
5. A goyi bayan transaction/reference IDs masu tsawo, pipe-separated, slash-separated, multiline/wrapped, da identifiers da ke cikin description.
6. A goyi bayan numeric dates na day-first da unambiguous month-first, ordinal dates, month-name dates, AM/PM, seconds, UTC/GMT/WAT, da numeric timezone suffixes.
7. A yi OCR retries masu iyaka tare da alternative layout modes; a iya amfani da preprocessing amma kada a canza original evidence buffer.
8. A yi deterministic validation da confidence scoring; duk fact ya kasance traceable zuwa original evidence.
9. A jinkirta `MISSING_AMOUNT`, `MISSING_DATE`, `MISSING_REFERENCE`, da `MISSING_STATUS` har sai duk relevant evidence ta gama processing da recognition retries. Idan extraction bai kammala ba, yi amfani da extraction-incomplete state/finding.
10. Multi-file evidence a ci gaba da ware transactions marasa alaƙa, kada a haɗa su saboda suna case ɗaya kawai.
11. Kada a karya authentication, authorization, private storage, SHA-256 hashes, duplicate detection, case history, audit trail, API compatibility, ko report compatibility.

## Real fixtures da dole regression tests su rufe

Yi amfani da repository-owned fixtures:

- `tests/fixtures/receipts/opay-mtn-airtime.jpg`
- `tests/fixtures/receipts/moniepoint-airtime-dark.jpg`
- `tests/fixtures/receipts/laupay-web-airtime.jpg`
- `tests/fixtures/receipts/interswitch-debit-airtime.jpg`

Acceptance criteria:

- **OPay/MTN:** extract `NGN 156.00`, `NGN 154.20`, `NGN 1.80` as `CASHBACK`, successful status, Airtime, recipient phone `+2348032600058`, date `2026-11-22T11:29`, da reference `261122100100935520972531`.
- **Moniepoint:** extract `NGN 100.00` as `DEBIT`, `NGN 378.66` da `NGN 278.66` as `BALANCE`, successful status, Airtime, date `2026-11-19T13:16`, da multiline reference `ATP|2MPT208YZ|2123389903303208960`.
- **Interswitch:** extract `NGN 200.00` as `DEBIT`, phone `+2349011887318`, transaction date `2026-11-20T20:57`, da reference `000118159468/000118159468`. Kada a ƙirƙiri status idan evidence ba ta nuna status ba.
- **OPay OCR limitation:** idan OCR ya karanta visible `₦1.40` a matsayin `41.40`, kada a silently canza shi zuwa `1.40` ba tare da defensible image/layout rule ba. A riƙe raw OCR value da lower confidence ko review signal.
- LauPay fixture a kasance cikin regression coverage, amma kada a yi claim fiye da abin da OCR ke tabbatarwa.

## Live demo verification

A gwada public demo da demo credentials da ke shafin:

1. Login.
2. Ƙirƙiri Airtime case na amount 100.
3. Upload receipts ɗaya bayan ɗaya.
4. Upload receipts gaba ɗaya.
5. Kwatanta extracted facts, findings, references, amount roles, extraction states, da reports.

Idan app bai tashi ba, kada a yi claim cewa workflow ya kammala. A rubuta a fili exact outage message, misali `This app did not start — RumptyCloud`, sannan a ware fixture-level verification daga live E2E verification.

## Required verification kafin merge

Gudanar da:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npx vitest run tests/image-extraction.test.ts`
- `npm run build` a CI/non-interactive mode
- `git diff --check`

A ƙarshe samar da completion report da ya ƙunshi root-cause analysis, exact files changed, before-vs-after behavior, real fixture results, test counts, live demo status, known OCR limitations, migration/deployment requirements, da commit hash.
