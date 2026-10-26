import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { getCaseDetail } from "@/lib/case-data";
import { ApiError, assertSameOrigin, jsonError, requireUser } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { generateCaseReport } from "@/lib/report/pdf";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEMO_EMAIL = "demo@prooftrail.app";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();

    const limit = rateLimit(`sample:${user.id}`, 3, 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new ApiError(429, "Too many sample cases. Try again later.", "rate_limited");
    }

    const demo = await db.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
    if (!demo) throw new ApiError(404, "The sample case is not available.", "not_found");

    const source = await db.case.findFirst({
      where: {
        userId: demo.id,
        NOT: { title: { startsWith: "Sample —" } },
      },
      orderBy: { createdAt: "desc" },
      include: { evidence: true, facts: true },
    });
    if (!source) throw new ApiError(404, "The sample case is not available.", "not_found");

    const created = await db.$transaction(async (tx) => {
      const sample = await tx.case.create({
        data: {
          userId: user.id,
          title: `Sample — ${source.title}`.slice(0, 140),
          serviceType: source.serviceType,
          provider: source.provider,
          claimedAmount: source.claimedAmount,
          currency: source.currency,
          incidentDate: source.incidentDate,
          transactionReference: source.transactionReference,
          customerPhone: source.customerPhone,
          description: source.description,
          status: "EVIDENCE_REVIEW",
        },
        select: { id: true },
      });

      const evidenceIds = new Map<string, string>();
      for (const evidence of source.evidence) {
        const copy = await tx.evidence.create({
          data: {
            caseId: sample.id,
            uploadedById: user.id,
            originalName: evidence.originalName,
            storedName: evidence.storedName,
            mimeType: evidence.mimeType,
            sizeBytes: evidence.sizeBytes,
            sha256: evidence.sha256,
            kind: evidence.kind,
            extractionStatus: evidence.extractionStatus,
            extractionError: evidence.extractionError,
            extractionNotes: evidence.extractionNotes,
            extractedText: evidence.extractedText,
            pageCount: evidence.pageCount,
            createdAt: evidence.createdAt,
            data: evidence.data,
          },
          select: { id: true },
        });
        evidenceIds.set(evidence.id, copy.id);
      }

      if (source.facts.length > 0) {
        await tx.fact.createMany({
          data: source.facts.map((fact) => ({
            evidenceId: evidenceIds.get(fact.evidenceId) ?? evidenceIds.values().next().value!,
            caseId: sample.id,
            type: fact.type,
            rawValue: fact.rawValue,
            normalizedValue: fact.normalizedValue,
            confidence: fact.confidence,
            locator: (fact.locator as Prisma.InputJsonValue | null) ?? undefined,
            snippet: fact.snippet,
            extractor: fact.extractor,
            extractorVersion: fact.extractorVersion,
            createdAt: fact.createdAt,
          })),
        });
      }

      await tx.caseEvent.create({
        data: {
          caseId: sample.id,
          actorId: user.id,
          type: "SAMPLE_CREATED",
          summary: "Sample case copied into your workspace for exploration.",
        },
      });

      return sample;
    });

    const detail = await getCaseDetail(user.id, created.id);
    if (!detail) throw new ApiError(500, "Could not load the sample case.", "internal");

    const bytes = await generateCaseReport(detail, { name: user.name, email: user.email });
    const buffer = Buffer.from(bytes);
    const reportHash = createHash("sha256").update(buffer).digest("hex");
    const storedName = await saveFile("reports", ".pdf", buffer);
    await db.report.create({
      data: {
        caseId: created.id,
        createdById: user.id,
        storedName,
        sha256: reportHash,
        sizeBytes: buffer.byteLength,
        data: new Uint8Array(buffer),
      },
    });
    await db.case.update({ where: { id: created.id }, data: { status: "READY" } });
    await logCaseEvent({
      caseId: created.id,
      actorId: user.id,
      type: "REPORT_GENERATED",
      summary: "Sample case report generated.",
      metadata: { sha256: reportHash, sizeBytes: buffer.byteLength },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
