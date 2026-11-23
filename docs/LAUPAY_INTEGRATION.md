# LauPay integration guide

Base URL: `https://prooftrail.rumptycloud.app`

The integration API is intentionally separate from ProofTrail's browser session API. LauPay must use a provisioned partner credential and send only transaction/dispute data needed for the case. Never send passwords, OTPs, PINs, bank credentials, card credentials, or unrelated transaction history.

## Provisioning

Set `INTEGRATION_ENCRYPTION_KEY` to a stable 32-byte base64 key, apply migrations, then provision a partner against an existing ProofTrail owner account:

```bash
INTEGRATION_OWNER_EMAIL=owner@example.com \
INTEGRATION_SLUG=laupay \
INTEGRATION_NAME=LauPay \
npm run integration:partner
```

The command prints the API key and secret once. Store them in LauPay's secret manager; ProofTrail stores only a SHA-256 API-key lookup hash and an encrypted HMAC secret.

## Request authentication

Every request uses:

- `X-ProofTrail-Key`: provisioned API key.
- `X-ProofTrail-Timestamp`: Unix seconds; requests older than five minutes are rejected.
- `X-ProofTrail-Signature`: `sha256=` followed by the hex HMAC-SHA256 signature.
- `Idempotency-Key` on create and upload operations.

For JSON requests, sign `timestamp + "." + exact_request_body`. For multipart evidence uploads, sign `timestamp + "." + sha256(base64(raw_request_body))`; this avoids trusting a browser-provided URL and binds the complete upload body to the signed request.

The credential scopes are least-privilege: `disputes:create`, `disputes:read`, `evidence:upload`, and `reports:read`.

## Endpoints

### Create dispute

`POST /api/v1/integrations/disputes`

The JSON body accepts `externalTransactionId`, `transaction` (`amount`, `currency: NGN`, `type`, provider, status, reference, date), `customer.externalCustomerId`, and `dispute` (`reason`, optional description). The external customer ID is validated but not copied into the case as unnecessary personal data.

The response returns `caseId`, external transaction ID, lifecycle status, and creation time. The same idempotency key and identical body return the original response. Reusing a key with a different body returns `409`.

Transaction fields are labeled `LAUPAY_REPORTED`; they are not independently bank-verified by ProofTrail.

### Get dispute status

`GET /api/v1/integrations/disputes/{caseId}`

Returns tenant-scoped case ID, external transaction ID, lifecycle status, timestamps, evidence count, findings count, report availability, and the latest report version/hash metadata. It never returns notes, evidence contents, private storage URLs, or credentials.

### Upload evidence

`POST /api/v1/integrations/disputes/{caseId}/evidence`

Send a multipart form field named `file`. Supported formats and size limits are the same as the existing ProofTrail upload route. The server validates magic bytes, computes SHA-256, stores bytes privately, preserves the original file, detects duplicates, and invokes the existing extraction service. The evidence source is recorded as `LAUPAY_INTEGRATION`.

### Outbound webhooks

If a partner webhook URL is configured by an operator, ProofTrail queues events such as `dispute.created` and `dispute.status_changed` in `IntegrationDelivery`. Payloads contain case metadata only. Each delivery includes `X-ProofTrail-Event-Id`, `X-ProofTrail-Timestamp`, and an HMAC `X-ProofTrail-Signature` over `timestamp + "." + exact_body` using the configured webhook secret. Failed attempts use exponential backoff and are retained in the delivery log.

A scheduler must call the protected internal route `POST /api/internal/integrations/deliveries` with `Authorization: Bearer $INTEGRATION_DELIVERY_TOKEN` to process pending/retryable deliveries. This route is not a LauPay public API.

## Error codes

`integration_unauthorized`, `integration_signature_invalid`, `integration_timestamp_expired`, `integration_forbidden`, `idempotency_required`, `idempotency_conflict`, `duplicate_dispute`, `not_found`, `invalid_input`, `unsupported_type`, and `file_too_large` are stable categories. Responses use `{ "error": "...", "code": "..." }`.

## Deployment and verification

Apply the committed migration with `npm run db:deploy`, configure the two integration secrets, provision the partner, and run signed sandbox requests using synthetic data. Do not call the integration live until the partner credentials, LauPay transaction-verification boundary, webhook URL, and scheduler are configured and an authorized end-to-end smoke test passes.
