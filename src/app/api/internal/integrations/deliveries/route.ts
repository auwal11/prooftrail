import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deliverIntegrationDelivery } from "@/lib/integration-delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.INTEGRATION_DELIVERY_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided || provided !== expected) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const deliveries = await db.integrationDelivery.findMany({ where: { status: { in: ["PENDING", "RETRYING"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, orderBy: { createdAt: "asc" }, take: 20, select: { id: true } });
  const results = await Promise.all(deliveries.map((delivery) => deliverIntegrationDelivery(delivery.id)));
  return NextResponse.json({ processed: results.length, delivered: results.filter((item) => item.delivered).length });
}
