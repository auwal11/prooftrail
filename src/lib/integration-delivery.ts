import { db } from "@/lib/db";
import { signedWebhook } from "@/lib/integration-auth";

export async function deliverIntegrationDelivery(deliveryId: string): Promise<{ delivered: boolean; status?: number }> {
  const delivery = await db.integrationDelivery.findUnique({ where: { id: deliveryId }, include: { partner: true } });
  if (!delivery || !delivery.partner.webhookUrl || !delivery.partner.webhookSecretCiphertext) return { delivered: false };
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(delivery.payload);
  const attempt = delivery.attemptCount + 1;
  try {
    const response = await fetch(delivery.partner.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json", "X-ProofTrail-Event-Id": delivery.eventId, "X-ProofTrail-Timestamp": String(timestamp), "X-ProofTrail-Signature": signedWebhook(delivery.partner.webhookSecretCiphertext, body, timestamp) }, body, signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      await db.integrationDelivery.update({ where: { id: delivery.id }, data: { status: "DELIVERED", attemptCount: attempt, responseStatus: response.status, lastError: null, nextAttemptAt: null } });
      return { delivered: true, status: response.status };
    }
    throw new Error(`Webhook returned HTTP ${response.status}.`);
  } catch (error) {
    const delaySeconds = Math.min(3600, 2 ** Math.min(attempt, 10));
    await db.integrationDelivery.update({ where: { id: delivery.id }, data: { status: attempt >= 8 ? "FAILED" : "RETRYING", attemptCount: attempt, responseStatus: null, lastError: error instanceof Error ? error.message.slice(0, 500) : "Webhook delivery failed.", nextAttemptAt: new Date(Date.now() + delaySeconds * 1000) } });
    return { delivered: false };
  }
}
