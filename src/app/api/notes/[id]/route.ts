import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { ApiError, assertSameOrigin, jsonError, readJson, requireUser } from "@/lib/http";
import { noteSchema } from "@/lib/validation";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const parsed = noteSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Check the note.", "invalid_input");
    const note = await db.caseNote.findFirst({ where: { id, authorId: user.id }, select: { id: true, caseId: true } });
    if (!note) throw new ApiError(404, "Note not found.", "not_found");
    await db.caseNote.update({ where: { id }, data: { body: parsed.data.body } });
    await logCaseEvent({ caseId: note.caseId, actorId: user.id, type: "NOTE_UPDATED", summary: "Private case note updated." });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const note = await db.caseNote.findFirst({ where: { id, authorId: user.id }, select: { id: true, caseId: true } });
    if (!note) throw new ApiError(404, "Note not found.", "not_found");
    await db.caseNote.delete({ where: { id } });
    await logCaseEvent({ caseId: note.caseId, actorId: user.id, type: "NOTE_DELETED", summary: "Private case note deleted." });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
