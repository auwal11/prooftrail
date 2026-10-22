import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { resolveFact, type FactRecord } from "@/lib/facts/effective";
import { ApiError, assertSameOrigin, jsonError, readJson, requireUser } from "@/lib/http";
import type { SourceLocator } from "@/lib/domain";
import { revisionSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;

    const fact = await db.fact.findFirst({
      where: { id, case: { userId: user.id } },
      include: {
        revisions: {
          orderBy: { createdAt: "asc" },
          include: { actor: { select: { name: true } } },
        },
        case: { select: { id: true } },
      },
    });
    if (!fact) throw new ApiError(404, "Fact not found.", "not_found");

    const parsed = revisionSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Check the revision details.",
        "invalid_input",
      );
    }

    const { action, note } = parsed.data;
    const newValue = parsed.data.newValue?.trim();

    const record: FactRecord = {
      id: fact.id,
      evidenceId: fact.evidenceId,
      type: fact.type,
      rawValue: fact.rawValue,
      normalizedValue: fact.normalizedValue,
      confidence: fact.confidence,
      locator: (fact.locator as unknown as SourceLocator | null) ?? null,
      snippet: fact.snippet,
      extractor: fact.extractor,
      extractorVersion: fact.extractorVersion,
      createdAt: fact.createdAt,
      revisions: fact.revisions,
    };

    const effective = resolveFact(record);

    if (action === "CORRECT") {
      if (!newValue) throw new ApiError(400, "Enter the corrected value.", "invalid_input");
      if (newValue === effective.displayValue) {
        throw new ApiError(400, "The corrected value is unchanged.", "invalid_input");
      }
    }

    if (action === "REJECT" && effective.status === "rejected") {
      throw new ApiError(400, "This fact is already marked not applicable.", "invalid_input");
    }

    if (action === "RESTORE" && fact.revisions.length === 0) {
      throw new ApiError(400, "This fact has no corrections to restore.", "invalid_input");
    }

    const revision = await db.factRevision.create({
      data: {
        factId: fact.id,
        caseId: fact.caseId,
        actorId: user.id,
        action,
        previousValue: effective.displayValue,
        newValue: action === "CORRECT" ? newValue : null,
        note: note || null,
      },
      select: { id: true, createdAt: true },
    });

    const actionLabel =
      action === "CORRECT" ? "corrected" : action === "REJECT" ? "marked not applicable" : "restored";

    await logCaseEvent({
      caseId: fact.caseId,
      actorId: user.id,
      type: "FACT_REVISED",
      summary: `${fact.type} fact ${actionLabel}.`,
      metadata: {
        factId: fact.id,
        revisionId: revision.id,
        action,
        previousValue: effective.displayValue,
        newValue: action === "CORRECT" ? newValue : null,
      },
    });

    return NextResponse.json({ id: revision.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
