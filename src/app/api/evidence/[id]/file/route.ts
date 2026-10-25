import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, requireUser } from "@/lib/http";
import { readStoredBytes } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const evidence = await db.evidence.findFirst({
      where: { id, case: { userId: user.id } },
      select: {
        storedName: true,
        originalName: true,
        mimeType: true,
        kind: true,
        data: true,
      },
    });
    if (!evidence) throw new ApiError(404, "Evidence not found.", "not_found");

    const buffer = await readStoredBytes(evidence.data, "evidence", evidence.storedName);
    const disposition = evidence.kind === "IMAGE" ? "inline" : "attachment";
    const encodedName = encodeURIComponent(evidence.originalName);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": evidence.mimeType,
        "Content-Disposition": `${disposition}; filename="evidence"; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
