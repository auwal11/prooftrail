import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requestHash } from "@/lib/integration-auth";

export async function idempotentResponse(partnerId: string, operation: string, key: string, rawBody: string) {
  const existing = await db.integrationIdempotency.findUnique({ where: { partnerId_operation_key: { partnerId, operation, key } } });
  if (!existing) return null;
  if (existing.requestHash !== requestHash(rawBody)) return { conflict: true as const };
  return { conflict: false as const, responseJson: existing.responseJson, statusCode: existing.statusCode };
}

export async function saveIdempotentResponse(input: { partnerId: string; operation: string; key: string; rawBody: string; responseJson: Prisma.InputJsonValue; statusCode: number }) {
  return db.integrationIdempotency.create({ data: { partnerId: input.partnerId, operation: input.operation, key: input.key, requestHash: requestHash(input.rawBody), responseJson: input.responseJson, statusCode: input.statusCode } });
}

export async function queueIntegrationEvent(input: { partnerId: string; caseId: string; event: string; payload: Prisma.InputJsonValue }) {
  return db.integrationDelivery.create({ data: { partnerId: input.partnerId, caseId: input.caseId, eventId: crypto.randomUUID(), event: input.event, payload: input.payload } });
}
