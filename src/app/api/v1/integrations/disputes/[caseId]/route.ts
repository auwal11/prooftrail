import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateIntegration } from "@/lib/integration-auth";
import { ApiError, jsonError } from "@/lib/http";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const partner = await authenticateIntegration(request, "disputes:read", "");
    const { caseId } = await context.params;
    const record = await db.case.findFirst({
      where: { id: caseId, integrationPartnerId: partner.id, userId: partner.ownerUserId },
      select: {
        id: true,
        externalTransactionId: true,
        lifecycleStatus: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { evidence: true, facts: true, reports: true } },
        reports: { orderBy: { createdAt: "desc" }, take: 1, select: { sha256: true, createdAt: true } },
      },
    });
    if (!record) throw new ApiError(404, "Dispute not found.", "not_found");
    return NextResponse.json({ success: true, data: {
      caseId: record.id,
      externalTransactionId: record.externalTransactionId,
      status: record.lifecycleStatus.toLowerCase(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      evidenceCount: record._count.evidence,
      findingsCount: record._count.facts,
      reportAvailable: record._count.reports > 0,
      report: record.reports[0] ? { version: record._count.reports, sha256: record.reports[0].sha256, createdAt: record.reports[0].createdAt.toISOString() } : null,
    } });
  } catch (error) {
    return jsonError(error);
  }
}
