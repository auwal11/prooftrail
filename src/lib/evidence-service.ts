import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { extractEvidence } from "@/lib/extract";
import { extractFactsFromPages } from "@/lib/facts/parser";
import { readStoredFile } from "@/lib/storage";

const inFlight = new Set<string>();

export async function processEvidence(evidenceId: string): Promise<{
  ok: boolean;
  factCount: number;
  error?: string;
}> {
  if (inFlight.has(evidenceId)) {
    return { ok: false, factCount: 0, error: "Extraction is already running for this file." };
  }
  inFlight.add(evidenceId);

  try {
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        caseId: true,
        kind: true,
        storedName: true,
        originalName: true,
        extractionStatus: true,
      },
    });

    if (!evidence) {
      return { ok: false, factCount: 0, error: "Evidence not found." };
    }

    await db.evidence.update({
      where: { id: evidenceId },
      data: { extractionStatus: "PROCESSING", extractionError: null, extractionNotes: null },
    });

    let buffer: Buffer;
    try {
      buffer = await readStoredFile("evidence", evidence.storedName);
    } catch {
      const message = "The stored file could not be read. Upload it again.";
      await markFailed(evidenceId, message);
      return { ok: false, factCount: 0, error: message };
    }

    try {
      const extraction = await extractEvidence(evidence.kind, buffer);
      const facts = extractFactsFromPages(extraction.pages);
      const notes = extraction.warnings.join(" | ").slice(0, 1000) || null;

      await db.$transaction(async (tx) => {
        await tx.fact.deleteMany({ where: { evidenceId } });

        if (facts.length > 0) {
          await tx.fact.createMany({
            data: facts.map((fact) => ({
              evidenceId,
              caseId: evidence.caseId,
              type: fact.type,
              rawValue: fact.rawValue,
              normalizedValue: fact.normalizedValue,
              confidence: fact.confidence,
              locator: fact.locator as unknown as Prisma.InputJsonValue,
              snippet: fact.snippet,
              extractor: fact.extractor,
              extractorVersion: fact.extractorVersion,
            })),
          });
        }

        await tx.evidence.update({
          where: { id: evidenceId },
          data: {
            extractionStatus: "COMPLETED",
            extractionError: null,
            extractionNotes: notes,
            extractedText: extraction.text.slice(0, 500_000),
            pageCount: extraction.pageCount,
          },
        });
      });

      await logCaseEvent({
        caseId: evidence.caseId,
        type: "EVIDENCE_EXTRACTED",
        summary: `Extracted ${facts.length} fact(s) from ${evidence.originalName}.`,
        metadata: {
          evidenceId,
          engine: extraction.engine,
          pageCount: extraction.pageCount,
          warnings: extraction.warnings,
        },
      });

      await db.case.updateMany({
        where: { id: evidence.caseId, status: "DRAFT" },
        data: { status: "EVIDENCE_REVIEW" },
      });

      return { ok: true, factCount: facts.length };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Extraction failed for an unknown reason.";
      await markFailed(evidenceId, message);

      await logCaseEvent({
        caseId: evidence.caseId,
        type: "EVIDENCE_EXTRACTION_FAILED",
        summary: `Extraction failed for ${evidence.originalName}.`,
        metadata: { evidenceId, error: message.slice(0, 500) },
      });

      return { ok: false, factCount: 0, error: message };
    }
  } finally {
    inFlight.delete(evidenceId);
  }
}

async function markFailed(evidenceId: string, message: string): Promise<void> {
  await db.evidence
    .update({
      where: { id: evidenceId },
      data: {
        extractionStatus: "FAILED",
        extractionError: message.slice(0, 500),
      },
    })
    .catch(() => undefined);
}
