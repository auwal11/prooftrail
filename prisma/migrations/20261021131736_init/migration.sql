-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('AIRTIME', 'DATA', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'EVIDENCE_REVIEW', 'READY', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('IMAGE', 'PDF', 'TEXT');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "FactType" AS ENUM ('AMOUNT', 'DATE', 'REFERENCE', 'PHONE', 'STATUS', 'SERVICE_TYPE', 'PROVIDER', 'RECIPIENT', 'ACCOUNT_MASK', 'DESCRIPTION');

-- CreateEnum
CREATE TYPE "RevisionAction" AS ENUM ('CORRECT', 'REJECT', 'RESTORE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL DEFAULT 'AIRTIME',
    "provider" TEXT,
    "claimedAmount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "incidentDate" TIMESTAMP(3),
    "transactionReference" TEXT,
    "customerPhone" TEXT,
    "description" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extractionError" TEXT,
    "extractedText" TEXT,
    "pageCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fact" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "FactType" NOT NULL,
    "rawValue" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "locator" JSONB,
    "snippet" TEXT,
    "extractor" TEXT NOT NULL,
    "extractorVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactRevision" (
    "id" TEXT NOT NULL,
    "factId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "RevisionAction" NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Case_userId_createdAt_idx" ON "Case"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Evidence_caseId_createdAt_idx" ON "Evidence"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "Evidence_sha256_idx" ON "Evidence"("sha256");

-- CreateIndex
CREATE INDEX "Fact_caseId_type_idx" ON "Fact"("caseId", "type");

-- CreateIndex
CREATE INDEX "Fact_evidenceId_idx" ON "Fact"("evidenceId");

-- CreateIndex
CREATE INDEX "FactRevision_factId_createdAt_idx" ON "FactRevision"("factId", "createdAt");

-- CreateIndex
CREATE INDEX "FactRevision_caseId_createdAt_idx" ON "FactRevision"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseEvent_caseId_createdAt_idx" ON "CaseEvent"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_caseId_createdAt_idx" ON "Report"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactRevision" ADD CONSTRAINT "FactRevision_factId_fkey" FOREIGN KEY ("factId") REFERENCES "Fact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactRevision" ADD CONSTRAINT "FactRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
