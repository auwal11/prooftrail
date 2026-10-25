import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { processEvidence } from "@/lib/evidence-service";
import { maxUploadBytes } from "@/lib/env";
import { formatBytes, safeOriginalName, sha256, sniffFile } from "@/lib/files";
import { ApiError, assertSameOrigin, jsonError, requireUser } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { deleteStoredFile, saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const MIME_ALIASES: Record<string, string[]> = {
  "image/jpeg": ["image/jpeg", "image/jpg", "image/pjpeg"],
  "image/png": ["image/png"],
  "image/webp": ["image/webp"],
  "application/pdf": ["application/pdf"],
  "text/plain": ["text/plain", "text/csv"],
};

export async function POST(request: Request, context: RouteContext) {
  let storedName: string | null = null;
  let evidenceCreated = false;

  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;

    const caseRecord = await db.case.findFirst({
      where: { id, userId: user.id },
      select: { id: true, title: true },
    });
    if (!caseRecord) throw new ApiError(404, "Case not found.", "not_found");

    const limit = rateLimit(`upload:${user.id}`, 60, 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new ApiError(429, "Too many uploads. Try again later.", "rate_limited");
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new ApiError(415, "Upload must be sent as a file.", "unsupported_media_type");
    }

    const limitBytes = maxUploadBytes();
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > limitBytes + 512 * 1024) {
      throw new ApiError(
        413,
        `File is too large. The limit is ${formatBytes(limitBytes)}.`,
        "file_too_large",
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError(400, "The upload could not be read.", "invalid_upload");
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "Choose a file to upload.", "missing_file");
    }

    if (file.size === 0) {
      throw new ApiError(400, "The selected file is empty.", "empty_file");
    }
    if (file.size > limitBytes) {
      throw new ApiError(
        413,
        `File is too large. The limit is ${formatBytes(limitBytes)}.`,
        "file_too_large",
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > limitBytes) {
      throw new ApiError(
        413,
        `File is too large. The limit is ${formatBytes(limitBytes)}.`,
        "file_too_large",
      );
    }

    const sniffed = sniffFile(buffer);
    if (!sniffed) {
      throw new ApiError(
        415,
        "Unsupported file. Upload a PNG, JPEG, WebP, PDF, or plain text file.",
        "unsupported_type",
      );
    }

    const declared = (file.type || "").toLowerCase();
    const aliases = MIME_ALIASES[sniffed.mimeType] ?? [sniffed.mimeType];
    if (declared && declared !== "application/octet-stream" && !aliases.includes(declared)) {
      throw new ApiError(
        400,
        "The file content does not match its declared format. Upload the original file.",
        "content_type_mismatch",
      );
    }

    const hash = sha256(buffer);
    storedName = await saveFile("evidence", sniffed.extension, buffer);

    const evidence = await db.evidence.create({
      data: {
        caseId: caseRecord.id,
        uploadedById: user.id,
        originalName: safeOriginalName(file.name),
        storedName,
        mimeType: sniffed.mimeType,
        sizeBytes: buffer.byteLength,
        sha256: hash,
        kind: sniffed.kind,
        extractionStatus: "PENDING",
        data: new Uint8Array(buffer),
      },
      select: { id: true, originalName: true },
    });
    evidenceCreated = true;

    await logCaseEvent({
      caseId: caseRecord.id,
      actorId: user.id,
      type: "EVIDENCE_UPLOADED",
      summary: `Evidence "${evidence.originalName}" uploaded.`,
      metadata: {
        evidenceId: evidence.id,
        sha256: hash,
        sizeBytes: buffer.byteLength,
        mimeType: sniffed.mimeType,
      },
    });

    const result = await processEvidence(evidence.id);

    return NextResponse.json(
      {
        id: evidence.id,
        factCount: result.factCount,
        extractionOk: result.ok,
        extractionError: result.error ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (storedName && !evidenceCreated) {
      await deleteStoredFile("evidence", storedName).catch(() => undefined);
    }
    return jsonError(error);
  }
}
