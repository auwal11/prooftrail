import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { deleteStoredFile } from "@/lib/storage";
import { ApiError, assertSameOrigin, jsonError, requireUser } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;

    const evidence = await db.evidence.findFirst({
      where: { id, case: { userId: user.id } },
      select: { id: true, caseId: true, storedName: true, originalName: true },
    });
    if (!evidence) throw new ApiError(404, "Evidence not found.", "not_found");

    await db.evidence.delete({ where: { id: evidence.id } });
    await deleteStoredFile("evidence", evidence.storedName).catch(() => undefined);

    await logCaseEvent({
      caseId: evidence.caseId,
      actorId: user.id,
      type: "EVIDENCE_DELETED",
      summary: `Evidence "${evidence.originalName}" removed.`,
      metadata: { evidenceId: evidence.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
