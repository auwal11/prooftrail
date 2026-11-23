CREATE TABLE "IntegrationPartner" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "apiKeyHash" TEXT NOT NULL,
  "secretCiphertext" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "webhookUrl" TEXT,
  "webhookSecretCiphertext" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationIdempotency" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseJson" JSONB NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationDelivery" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "caseId" TEXT,
  "eventId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "responseStatus" INTEGER,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationDelivery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Case" ADD COLUMN "integrationPartnerId" TEXT;
ALTER TABLE "Case" ADD COLUMN "externalTransactionId" TEXT;
ALTER TABLE "Case" ADD COLUMN "externalDisputeId" TEXT;
ALTER TABLE "Case" ADD COLUMN "integrationRequestId" TEXT;
ALTER TABLE "Case" ADD COLUMN "sourceSystem" TEXT;
ALTER TABLE "Evidence" ADD COLUMN "sourceSystem" TEXT;
ALTER TABLE "Evidence" ADD COLUMN "integrationPartnerId" TEXT;

CREATE UNIQUE INDEX "IntegrationPartner_slug_key" ON "IntegrationPartner"("slug");
CREATE UNIQUE INDEX "IntegrationPartner_apiKeyHash_key" ON "IntegrationPartner"("apiKeyHash");
CREATE UNIQUE INDEX "IntegrationIdempotency_partnerId_operation_key_key" ON "IntegrationIdempotency"("partnerId", "operation", "key");
CREATE UNIQUE INDEX "IntegrationDelivery_eventId_key" ON "IntegrationDelivery"("eventId");
CREATE UNIQUE INDEX "Case_integrationPartnerId_externalTransactionId_key" ON "Case"("integrationPartnerId", "externalTransactionId");
CREATE INDEX "IntegrationIdempotency_createdAt_idx" ON "IntegrationIdempotency"("createdAt");
CREATE INDEX "IntegrationPartner_ownerUserId_idx" ON "IntegrationPartner"("ownerUserId");
CREATE INDEX "IntegrationDelivery_partnerId_status_nextAttemptAt_idx" ON "IntegrationDelivery"("partnerId", "status", "nextAttemptAt");
CREATE INDEX "IntegrationDelivery_caseId_createdAt_idx" ON "IntegrationDelivery"("caseId", "createdAt");
CREATE INDEX "Case_integrationPartnerId_externalTransactionId_idx" ON "Case"("integrationPartnerId", "externalTransactionId");
CREATE INDEX "Evidence_integrationPartnerId_createdAt_idx" ON "Evidence"("integrationPartnerId", "createdAt");

ALTER TABLE "Case" ADD CONSTRAINT "Case_integrationPartnerId_fkey" FOREIGN KEY ("integrationPartnerId") REFERENCES "IntegrationPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_integrationPartnerId_fkey" FOREIGN KEY ("integrationPartnerId") REFERENCES "IntegrationPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationPartner" ADD CONSTRAINT "IntegrationPartner_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationIdempotency" ADD CONSTRAINT "IntegrationIdempotency_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "IntegrationPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationDelivery" ADD CONSTRAINT "IntegrationDelivery_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "IntegrationPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationDelivery" ADD CONSTRAINT "IntegrationDelivery_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
