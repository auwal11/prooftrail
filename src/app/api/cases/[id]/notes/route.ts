import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { ApiError, assertSameOrigin, jsonError, readJson, requireUser } from "@/lib/http";
import { noteSchema } from "@/lib/validation";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id: caseId } = await context.params;
    const owned = await db.case.findFirst({ where: { id: caseId, userId: user.id }, select: { id: true } });
    if (!owned) throw new ApiError(404, "Case not found.", "not_found");
    const parsed = noteSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Check the note.", "invalid_input");
    const note = await db.caseNote.create({
      data: { caseId, authorId: user.id, body: parsed.data.body },
      include: { author: { select: { name: true } } },
    });
    await logCaseEvent({ caseId, actorId: user.id, type: "NOTE_ADDED", summary: "Private case note added." });
    return NextResponse.json({ note: { id: note.id, body: note.body, authorName: note.author.name, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
