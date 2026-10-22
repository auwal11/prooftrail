import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, requireUser } from "@/lib/http";
import { readStoredFile } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const report = await db.report.findFirst({
      where: { id, case: { userId: user.id } },
      select: {
        storedName: true,
        sha256: true,
        createdAt: true,
        case: { select: { id: true, title: true } },
      },
    });
    if (!report) throw new ApiError(404, "Report not found.", "not_found");

    const buffer = await readStoredFile("reports", report.storedName);
    const date = report.createdAt.toISOString().slice(0, 10);
    const safeTitle = report.case.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "case";
    const filename = `ProofTrail-${safeTitle}-${date}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Report-SHA256": report.sha256,
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
