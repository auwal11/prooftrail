import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processEvidence } from "@/lib/evidence-service";
import { ApiError, assertSameOrigin, jsonError, requireUser } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;

    const evidence = await db.evidence.findFirst({
      where: { id, case: { userId: user.id } },
      select: { id: true },
    });
    if (!evidence) throw new ApiError(404, "Evidence not found.", "not_found");

    const result = await processEvidence(evidence.id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
