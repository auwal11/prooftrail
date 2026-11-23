import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { authenticateIntegration, requestHash } from "@/lib/integration-auth";
import { idempotentResponse, saveIdempotentResponse } from "@/lib/integration";
import { processEvidence } from "@/lib/evidence-service";
import { maxUploadBytes } from "@/lib/env";
import { formatBytes, safeOriginalName, sha256, sniffFile } from "@/lib/files";
import { ApiError, jsonError } from "@/lib/http";
import { deleteStoredFile, saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;
type RouteContext = { params: Promise<{ caseId: string }> };

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
    const body = Buffer.from(await request.arrayBuffer());
    const bodyHash = requestHash(body.toString("base64"));
    const partner = await authenticateIntegration(request, "evidence:upload", bodyHash);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) throw new ApiError(400, "Idempotency-Key is required.", "idempotency_required");
    const prior = await idempotentResponse(partner.id, "evidence.upload", idempotencyKey, bodyHash);
    if (prior?.conflict) throw new ApiError(409, "This idempotency key was already used for a different upload.", "idempotency_conflict");
    if (prior) return NextResponse.json(prior.responseJson, { status: prior.statusCode });

    const { caseId } = await context.params;
    const caseRecord = await db.case.findFirst({ where: { id: caseId, userId: partner.ownerUserId, integrationPartnerId: partner.id }, select: { id: true } });
    if (!caseRecord) throw new ApiError(404, "Dispute not found.", "not_found");
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) throw new ApiError(415, "Upload must be sent as multipart form data.", "unsupported_media_type");
    const form = await new Request(request.url, { method: "POST", headers: request.headers, body }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Choose a file to upload.", "missing_file");
    const limit = maxUploadBytes();
    if (file.size > limit) throw new ApiError(413, `File is too large. The limit is ${formatBytes(limit)}.`, "file_too_large");
    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffFile(buffer);
    if (!sniffed) throw new ApiError(415, "Unsupported file. Upload a PNG, JPEG, WebP, PDF, or plain text file.", "unsupported_type");
    const declared = (file.type || "").toLowerCase();
    if (declared && declared !== "application/octet-stream" && !(MIME_ALIASES[sniffed.mimeType] ?? []).includes(declared)) throw new ApiError(400, "The file content does not match its declared format.", "content_type_mismatch");
    const hash = sha256(buffer);
    storedName = await saveFile("evidence", sniffed.extension, buffer);
    const evidence = await db.evidence.create({ data: { caseId, uploadedById: partner.ownerUserId, originalName: safeOriginalName(file.name), storedName, mimeType: sniffed.mimeType, sizeBytes: buffer.byteLength, sha256: hash, kind: sniffed.kind, extractionStatus: "PENDING", data: new Uint8Array(buffer), sourceSystem: "LAUPAY_INTEGRATION", integrationPartnerId: partner.id }, select: { id: true, originalName: true } });
    evidenceCreated = true;
    await logCaseEvent({ caseId, actorId: partner.ownerUserId, type: "INTEGRATION_EVIDENCE_UPLOADED", summary: `Evidence "${evidence.originalName}" uploaded by an authorized integration.`, metadata: { evidenceId: evidence.id, source: "LAUPAY_INTEGRATION", sha256: hash } });
    const result = await processEvidence(evidence.id);
    const response = { success: true, data: { evidenceId: evidence.id, processingStatus: result.ok ? "completed" : "failed", extractionError: result.error ?? null } };
    await saveIdempotentResponse({ partnerId: partner.id, operation: "evidence.upload", key: idempotencyKey, rawBody: bodyHash, responseJson: response, statusCode: 201 });
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (storedName && !evidenceCreated) await deleteStoredFile("evidence", storedName).catch(() => undefined);
    return jsonError(error);
  }
}
