import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function logCaseEvent(input: {
  caseId: string;
  actorId?: string | null;
  type: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await db.caseEvent.create({
    data: {
      caseId: input.caseId,
      actorId: input.actorId ?? null,
      type: input.type,
      summary: input.summary,
      metadata: input.metadata,
    },
  });
}
