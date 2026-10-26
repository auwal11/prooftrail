import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { ApiError, assertSameOrigin, jsonError, readJson, requireUser } from "@/lib/http";
import { factReviewSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;

    const caseRecord = await db.case.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!caseRecord) throw new ApiError(404, "Case not found.", "not_found");

    const parsed = factReviewSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Select valid facts.",
        "invalid_input",
      );
    }

    const reviewedAt = new Date();
    const result = await db.fact.updateMany({
      where: { id: { in: parsed.data.factIds }, caseId: caseRecord.id, reviewedAt: null },
      data: { reviewedAt },
    });

    if (result.count > 0) {
      await logCaseEvent({
        caseId: caseRecord.id,
        actorId: user.id,
        type: "FACTS_REVIEWED",
        summary: `${result.count} extracted fact${result.count === 1 ? "" : "s"} marked as reviewed.`,
        metadata: { count: result.count, factIds: parsed.data.factIds },
      });
    }

    return NextResponse.json({ reviewed: result.count });
  } catch (error) {
    return jsonError(error);
  }
}
