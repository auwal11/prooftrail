-- Add independent external dispute lifecycle without changing the existing internal stepper status.
CREATE TYPE "LifecycleStatus" AS ENUM (
  'DRAFT',
  'COLLECTING_EVIDENCE',
  'UNDER_REVIEW',
  'REPORT_READY',
  'SUBMITTED_TO_PROVIDER',
  'AWAITING_RESPONSE',
  'RESOLVED',
  'CLOSED'
);

ALTER TABLE "Case" ADD COLUMN "lifecycleStatus" "LifecycleStatus" NOT NULL DEFAULT 'DRAFT';

CREATE TABLE "CaseStatusHistory" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "from" "LifecycleStatus",
  "to" "LifecycleStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseNote" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Case_userId_lifecycleStatus_updatedAt_idx" ON "Case"("userId", "lifecycleStatus", "updatedAt");
CREATE INDEX "CaseStatusHistory_caseId_createdAt_idx" ON "CaseStatusHistory"("caseId", "createdAt");
CREATE INDEX "CaseNote_caseId_createdAt_idx" ON "CaseNote"("caseId", "createdAt");

ALTER TABLE "CaseStatusHistory" ADD CONSTRAINT "CaseStatusHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseStatusHistory" ADD CONSTRAINT "CaseStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
