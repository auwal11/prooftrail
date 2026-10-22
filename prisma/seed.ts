import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { processEvidence } from "../src/lib/evidence-service";
import { generateCaseReport } from "../src/lib/report/pdf";
import { getCaseDetail } from "../src/lib/case-data";
import { saveFile } from "../src/lib/storage";

try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional when variables are provided by the environment.
}

const db = new PrismaClient();

const DEMO_EMAIL = "demo@prooftrail.app";
const DEMO_PASSWORD = "ProofTrailDemo2026";
const CASE_TITLE = "Airtime not delivered after N1,000 debit";

async function makePdf(lines: Array<{ text: string; size?: number; bold?: boolean; gap?: number }>): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 420]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 370, width: 595, height: 50, color: rgb(0.06, 0.16, 0.14) });
  page.drawText("PROOFTRAIL DEMO EVIDENCE", {
    x: 40,
    y: 390,
    size: 12,
    font: bold,
    color: rgb(0.96, 0.79, 0.43),
  });

  let y = 330;
  for (const line of lines) {
    const font = line.bold ? bold : regular;
    page.drawText(line.text, {
      x: 40,
      y,
      size: line.size ?? 11,
      font,
      color: rgb(0.12, 0.15, 0.2),
    });
    y -= line.gap ?? 22;
  }

  page.drawText("Sample document generated for the ProofTrail competition demo. Not a real bank record.", {
    x: 40,
    y: 26,
    size: 8,
    font: regular,
    color: rgb(0.45, 0.47, 0.5),
  });

  return Buffer.from(await doc.save());
}

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo Reviewer", passwordHash },
    create: { email: DEMO_EMAIL, name: "Demo Reviewer", passwordHash },
  });

  const existing = await db.case.findFirst({
    where: { userId: user.id, title: CASE_TITLE },
    include: {
      evidence: { select: { storedName: true } },
      reports: { select: { storedName: true } },
    },
  });

  if (existing) {
    await db.case.delete({ where: { id: existing.id } });
    const { deleteStoredFile } = await import("../src/lib/storage");
    await Promise.allSettled([
      ...existing.evidence.map((item) => deleteStoredFile("evidence", item.storedName)),
      ...existing.reports.map((item) => deleteStoredFile("reports", item.storedName)),
    ]);
    console.log("Removed previous demo case.");
  }

  const caseRecord = await db.case.create({
    data: {
      userId: user.id,
      title: CASE_TITLE,
      serviceType: "AIRTIME",
      provider: "MTN",
      claimedAmount: "1000.00",
      currency: "NGN",
      incidentDate: new Date("2026-10-20T00:00:00.000Z"),
      transactionReference: "202610201234567890",
      customerPhone: "+2348031234567",
      description:
        "I bought N1,000 airtime on 20 October 2026. The bank alert says the debit was successful, but the recharge did not reach my line. The operator receipt says the transaction failed. I have not received a delivery confirmation.",
      status: "EVIDENCE_REVIEW",
    },
  });

  await db.caseEvent.create({
    data: {
      caseId: caseRecord.id,
      actorId: user.id,
      type: "CASE_CREATED",
      summary: `Case "${CASE_TITLE}" created (demo seed).`,
    },
  });

  const alertPdf = await makePdf([
    { text: "GTBank Instant Alert", size: 15, bold: true, gap: 30 },
    { text: "Account: ****4412", gap: 20 },
    { text: "You have been debited NGN 1,000.00 for MTN Airtime", gap: 20 },
    { text: "to 08031234567 on 20/10/2026 12:34 PM.", gap: 20 },
    { text: "Transaction Ref: 202610201234567890", gap: 20 },
    { text: "Status: Successful. Your balance is NGN 5,432.10", gap: 20 },
    { text: "This is a sample alert for demonstration purposes.", size: 9, gap: 18 },
  ]);

  const receiptPdf = await makePdf([
    { text: "MTN Airtime Receipt", size: 15, bold: true, gap: 30 },
    { text: "Amount: NGN 1,000.00", gap: 20 },
    { text: "Recipient: 08031234567", gap: 20 },
    { text: "Date: 20/10/2026 12:35 PM", gap: 20 },
    { text: "Reference: MTN-7741-2026", gap: 20 },
    { text: "Status: Failed", gap: 20 },
    { text: "The recharge was not completed. Please contact support.", size: 10, gap: 18 },
  ]);

  const documents = [
    { name: "gtbank-debit-alert.pdf", buffer: alertPdf },
    { name: "mtn-airtime-receipt.pdf", buffer: receiptPdf },
    { name: "gtbank-debit-alert-copy.pdf", buffer: alertPdf },
  ];

  for (const document of documents) {
    const storedName = await saveFile("evidence", ".pdf", document.buffer);
    const sha256 = createHash("sha256").update(document.buffer).digest("hex");

    const evidence = await db.evidence.create({
      data: {
        caseId: caseRecord.id,
        uploadedById: user.id,
        originalName: document.name,
        storedName,
        mimeType: "application/pdf",
        sizeBytes: document.buffer.byteLength,
        sha256,
        kind: "PDF",
        extractionStatus: "PENDING",
      },
    });

    await db.caseEvent.create({
      data: {
        caseId: caseRecord.id,
        actorId: user.id,
        type: "EVIDENCE_UPLOADED",
        summary: `Evidence "${document.name}" uploaded.`,
        metadata: { evidenceId: evidence.id, sha256, sizeBytes: document.buffer.byteLength },
      },
    });

    const result = await processEvidence(evidence.id);
    console.log(`Extracted ${result.factCount} facts from ${document.name}${result.ok ? "" : ` (failed: ${result.error})`}`);
  }

  const detail = await getCaseDetail(user.id, caseRecord.id);
  if (!detail) throw new Error("Demo case not found after seeding.");

  const bytes = await generateCaseReport(detail, { name: user.name, email: user.email });
  const buffer = Buffer.from(bytes);
  const reportHash = createHash("sha256").update(buffer).digest("hex");
  const reportStoredName = await saveFile("reports", ".pdf", buffer);

  await db.report.create({
    data: {
      caseId: caseRecord.id,
      createdById: user.id,
      storedName: reportStoredName,
      sha256: reportHash,
      sizeBytes: buffer.byteLength,
    },
  });

  await db.case.update({ where: { id: caseRecord.id }, data: { status: "READY" } });
  await db.caseEvent.create({
    data: {
      caseId: caseRecord.id,
      actorId: user.id,
      type: "REPORT_GENERATED",
      summary: "Source-linked PDF report generated (demo seed).",
      metadata: { sha256: reportHash, sizeBytes: buffer.byteLength },
    },
  });

  console.log("");
  console.log("Demo account ready");
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  case:     ${caseRecord.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
