import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { getCaseDetail } from "@/lib/case-data";
import { ApiError, assertSameOrigin, jsonError, requireUser } from "@/lib/http";
import { generateCaseReport } from "@/lib/report/pdf";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;

    const detail = await getCaseDetail(user.id, id);
    if (!detail) throw new ApiError(404, "Case not found.", "not_found");

    const generatedAt = new Date();
    const bytes = await generateCaseReport(detail, { name: user.name, email: user.email }, generatedAt);
    const buffer = Buffer.from(bytes);
    const hash = createHash("sha256").update(buffer).digest("hex");
    const storedName = await saveFile("reports", ".pdf", buffer);

    const report = await db.report.create({
      data: {
        caseId: id,
        createdById: user.id,
        storedName,
        sha256: hash,
        sizeBytes: buffer.byteLength,
      },
      select: { id: true, createdAt: true },
    });

    await db.case.updateMany({
      where: { id, status: { not: "CLOSED" } },
      data: { status: "READY" },
    });

    await logCaseEvent({
      caseId: id,
      actorId: user.id,
      type: "REPORT_GENERATED",
      summary: "Source-linked PDF report generated.",
      metadata: { reportId: report.id, sha256: hash, sizeBytes: buffer.byteLength },
    });

    return NextResponse.json({
      reportId: report.id,
      sha256: hash,
      sizeBytes: buffer.byteLength,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
