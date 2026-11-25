-- CreateEnum
CREATE TYPE "ExtractionState" AS ENUM ('CONFIRMED', 'UNREADABLE', 'NOT_EXTRACTED', 'NOT_PRESENT');

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN "extractionState" "ExtractionState" NOT NULL DEFAULT 'NOT_EXTRACTED';
***
