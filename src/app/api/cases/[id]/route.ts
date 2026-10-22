import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { deleteStoredFile } from "@/lib/storage";
import { ApiError, assertSameOrigin, jsonError, readJson, requireUser } from "@/lib/http";
import { caseUpdateSchema, normalizePhone, normalizeReference } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;

    const existing = await db.case.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new ApiError(404, "Case not found.", "not_found");

    const parsed = caseUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Check the case details.",
        "invalid_input",
      );
    }

    const data = parsed.data;
    const update: Prisma.CaseUpdateInput = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.serviceType !== undefined) update.serviceType = data.serviceType;
    if (data.provider !== undefined) update.provider = data.provider || null;
    if (data.claimedAmount !== undefined) {
      update.claimedAmount = new Prisma.Decimal(data.claimedAmount.toFixed(2));
    }
    if (data.incidentDate !== undefined) {
      update.incidentDate = data.incidentDate
        ? new Date(`${data.incidentDate}T00:00:00.000Z`)
        : null;
    }
    if (data.transactionReference !== undefined) {
      update.transactionReference = normalizeReference(data.transactionReference) ?? null;
    }
    if (data.customerPhone !== undefined) {
      update.customerPhone = normalizePhone(data.customerPhone) ?? null;
    }
    if (data.description !== undefined) update.description = data.description || null;
    if (data.status !== undefined) update.status = data.status;

    await db.case.update({ where: { id }, data: update });
    await logCaseEvent({
      caseId: id,
      actorId: user.id,
      type: "CASE_UPDATED",
      summary: "Case details updated.",
      metadata: { fields: Object.keys(update) },
    });

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

    const existing = await db.case.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        evidence: { select: { storedName: true } },
        reports: { select: { storedName: true } },
      },
    });
    if (!existing) throw new ApiError(404, "Case not found.", "not_found");

    await db.case.delete({ where: { id } });

    await Promise.allSettled([
      ...existing.evidence.map((item) => deleteStoredFile("evidence", item.storedName)),
      ...existing.reports.map((item) => deleteStoredFile("reports", item.storedName)),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
