import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { ApiError, assertSameOrigin, jsonError, readJson, requireUser } from "@/lib/http";
import { listCases } from "@/lib/case-data";
import { caseCreateSchema, normalizePhone, normalizeReference } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const cases = await listCases(user.id);
    return NextResponse.json({ cases });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const parsed = caseCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Check the case details.",
        "invalid_input",
      );
    }

    const data = parsed.data;
    const created = await db.case.create({
      data: {
        userId: user.id,
        title: data.title,
        serviceType: data.serviceType,
        provider: data.provider ?? null,
        claimedAmount:
          data.claimedAmount === undefined
            ? null
            : new Prisma.Decimal(data.claimedAmount.toFixed(2)),
        incidentDate: data.incidentDate
          ? new Date(`${data.incidentDate}T00:00:00.000Z`)
          : null,
        transactionReference: normalizeReference(data.transactionReference) ?? null,
        customerPhone: normalizePhone(data.customerPhone) ?? null,
        description: data.description ?? null,
      },
      select: { id: true },
    });

    await logCaseEvent({
      caseId: created.id,
      actorId: user.id,
      type: "CASE_CREATED",
      summary: `Case "${data.title}" created.`,
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
