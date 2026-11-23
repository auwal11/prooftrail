import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCaseEvent } from "@/lib/audit";
import { authenticateIntegration } from "@/lib/integration-auth";
import { idempotentResponse, queueIntegrationEvent, saveIdempotentResponse } from "@/lib/integration";
import { ApiError, jsonError } from "@/lib/http";
import { integrationDisputeSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const partner = await authenticateIntegration(request, "disputes:create", rawBody);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) throw new ApiError(400, "Idempotency-Key is required.", "idempotency_required");
    const prior = await idempotentResponse(partner.id, "dispute.create", idempotencyKey, rawBody);
    if (prior?.conflict) throw new ApiError(409, "This idempotency key was already used for a different request.", "idempotency_conflict");
    if (prior) return NextResponse.json(prior.responseJson, { status: prior.statusCode });

    let input: unknown;
    try { input = JSON.parse(rawBody); } catch { throw new ApiError(400, "Request body could not be parsed.", "invalid_body"); }
    const parsed = integrationDisputeSchema.safeParse(input);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Check the dispute details.", "invalid_input");
    const data = parsed.data;
    const serviceType = data.transaction.type === "airtime" ? "AIRTIME" : data.transaction.type === "data" ? "DATA" : "OTHER";
    const title = `LauPay dispute: ${data.externalTransactionId}`.slice(0, 140);

    const created = await db.case.create({
      data: {
        userId: partner.ownerUserId,
        title,
        serviceType,
        provider: data.transaction.provider || null,
        claimedAmount: new Prisma.Decimal(data.transaction.amount),
        currency: data.transaction.currency,
        incidentDate: data.transaction.transactionDate ? new Date(data.transaction.transactionDate) : null,
        transactionReference: data.transaction.transactionReference?.toUpperCase() || null,
        description: `${data.dispute.reason}${data.dispute.description ? `\n\n${data.dispute.description}` : ""}`,
        lifecycleStatus: "COLLECTING_EVIDENCE",
        status: "DRAFT",
        integrationPartnerId: partner.id,
        externalTransactionId: data.externalTransactionId,
        externalDisputeId: data.externalDisputeId || null,
        integrationRequestId: idempotencyKey,
        sourceSystem: "LAUPAY_REPORTED",
      },
      select: { id: true, createdAt: true, lifecycleStatus: true },
    });

    await db.caseStatusHistory.create({ data: { caseId: created.id, actorId: partner.ownerUserId, from: "DRAFT", to: "COLLECTING_EVIDENCE", note: "Created by authorized LauPay integration." } });
    await logCaseEvent({ caseId: created.id, actorId: partner.ownerUserId, type: "INTEGRATION_DISPUTE_CREATED", summary: "Dispute created by an authorized integration.", metadata: { partner: partner.slug, externalTransactionId: data.externalTransactionId, source: "LAUPAY_REPORTED" } });
    const response = { success: true, data: { caseId: created.id, externalTransactionId: data.externalTransactionId, status: created.lifecycleStatus.toLowerCase(), createdAt: created.createdAt.toISOString() } };
    await saveIdempotentResponse({ partnerId: partner.id, operation: "dispute.create", key: idempotencyKey, rawBody, responseJson: response, statusCode: 201 });
    await queueIntegrationEvent({ partnerId: partner.id, caseId: created.id, event: "dispute.created", payload: { event: "dispute.created", caseId: created.id, externalTransactionId: data.externalTransactionId, status: created.lifecycleStatus.toLowerCase(), source: "LAUPAY_REPORTED" } });
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError(new ApiError(409, "A dispute already exists for this integration transaction.", "duplicate_dispute"));
    return jsonError(error);
  }
}
