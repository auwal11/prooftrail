import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CaseActions } from "@/components/case-actions";
import { EvidenceActions } from "@/components/evidence-actions";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { FactReview } from "@/components/fact-review";
import { ReportPanel } from "@/components/report-panel";
import {
  EmptyState,
  SectionHeading,
  SeverityBadge,
  SiteFooter,
  SiteHeader,
  StatusBadge,
} from "@/components/ui";
import { getCaseDetail } from "@/lib/case-data";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatBytes } from "@/lib/files";
import { formatMoney } from "@/lib/money";
import { getSessionUser } from "@/lib/session";
import type { EvidenceView, Finding } from "@/lib/domain";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const user = await getSessionUser();
  if (!user) return { title: "Case" };
  const { id } = await params;
  const detail = await getCaseDetail(user.id, id);
  return { title: detail?.title ?? "Case" };
}

const EXTRACTION_STYLE: Record<string, string> = {
  COMPLETED: "badge-brand",
  FAILED: "badge-danger",
  PROCESSING: "badge-blue",
  PENDING: "badge-neutral",
  UNSUPPORTED: "badge-amber",
};

const SERVICE_LABEL: Record<string, string> = {
  AIRTIME: "Airtime",
  DATA: "Data",
  OTHER: "Other service",
};

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function EvidenceCard({ evidence, kindLabel }: { evidence: EvidenceView; kindLabel: string }) {
  const canRetry = evidence.extractionStatus === "FAILED" || evidence.extractionStatus === "UNSUPPORTED";

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {evidence.kind === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/evidence/${evidence.id}/file`}
              alt={`Preview of ${evidence.originalName}`}
              className="h-14 w-14 flex-none rounded-lg border border-line object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-lg border border-line bg-[#f6f4ee] text-[10px] font-semibold text-muted">
              {kindLabel}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="max-w-full truncate text-[13.5px] font-semibold" title={evidence.originalName}>
                {evidence.originalName}
              </p>
              <span className={`badge ${EXTRACTION_STYLE[evidence.extractionStatus] ?? "badge-neutral"}`}>
                {evidence.extractionStatus.toLowerCase()}
              </span>
              {evidence.duplicateOf.length > 0 ? (
                <span className="badge badge-amber">Duplicate</span>
              ) : null}
            </div>

            <p className="mt-1 text-[11px] text-muted">
              {formatBytes(evidence.sizeBytes)} · uploaded {formatDate(evidence.createdAt)} ·{" "}
              {evidence.factCount} {evidence.factCount === 1 ? "fact" : "facts"}
              {evidence.pageCount && evidence.pageCount > 1 ? ` · ${evidence.pageCount} pages` : ""}
            </p>

            <p className="mt-1.5 font-mono text-[10px] text-muted" title={evidence.sha256}>
              SHA-256 {shortHash(evidence.sha256)}
            </p>

            {evidence.extractionError ? (
              <p className="mt-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-[11px] leading-relaxed text-danger">
                {evidence.extractionError}
              </p>
            ) : null}

            {evidence.extractionNotes ? (
              <p className="mt-2 rounded-md bg-amber-soft px-2.5 py-1.5 text-[11px] leading-relaxed text-[#8a5a22]">
                {evidence.extractionNotes}
              </p>
            ) : null}

            {evidence.duplicateOf.length > 0 ? (
              <p className="mt-2 text-[11px] text-muted">
                This file is byte-for-byte identical to another file in the case. It is
                listed so the duplication is visible, not treated as new evidence.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-none flex-col items-start gap-2 sm:items-end">
          <a
            href={`/api/evidence/${evidence.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
          >
            Open file
          </a>
          <EvidenceActions evidenceId={evidence.id} canRetry={canRetry} />
        </div>
      </div>
    </div>
  );
}

export default async function CasePage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const detail = await getCaseDetail(user.id, id);
  if (!detail) notFound();

  const severityCounts = {
    high: detail.discrepancies.filter((finding) => finding.severity === "high").length,
    medium: detail.discrepancies.filter((finding) => finding.severity === "medium").length,
    low: detail.discrepancies.filter((finding) => finding.severity === "low").length,
    info: detail.discrepancies.filter((finding) => finding.severity === "info").length,
  };

  const evidenceNames = new Map(detail.evidence.map((item) => [item.id, item.originalName]));
  const caseFacts = detail.facts;

  function findingSources(finding: Finding): string {
    const labels = new Set<string>();
    for (const evidenceId of finding.evidenceIds) {
      const name = evidenceNames.get(evidenceId);
      if (name) labels.add(name);
    }
    for (const factId of finding.factIds.slice(0, 4)) {
      const fact = caseFacts.find((item) => item.id === factId);
      if (fact) labels.add(fact.locator?.page ? `${fact.evidenceName} p.${fact.locator.page}` : fact.evidenceName);
    }
    return [...labels].slice(0, 4).join(" · ");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />

      <main className="page-shell py-8">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <Link href="/cases" className="hover:text-ink">
            Cases
          </Link>
          <span>/</span>
          <span className="mono">PT-{detail.id.slice(-6).toUpperCase()}</span>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <span className="badge badge-neutral">{SERVICE_LABEL[detail.serviceType] ?? detail.serviceType}</span>
              {detail.provider ? <span className="badge badge-neutral">{detail.provider}</span> : null}
            </div>
            <h1 className="mt-3 max-w-3xl font-display text-[34px] leading-[1.12] tracking-[-0.01em]">
              {detail.title}
            </h1>
            <p className="mt-2 text-[12.5px] text-muted">
              Opened {formatDate(detail.createdAt)} · Incident {formatDate(detail.incidentDate)} ·
              Claimed {formatMoney(detail.claimedAmount, detail.currency)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="#evidence" className="btn btn-outline btn-sm">
              Evidence
            </a>
            <a href="#findings" className="btn btn-outline btn-sm">
              Findings {detail.discrepancies.length > 0 ? `(${detail.discrepancies.length})` : ""}
            </a>
            <a href="#facts" className="btn btn-outline btn-sm">
              Review facts
            </a>
            <a href="#report" className="btn btn-primary btn-sm">
              Report
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <section id="evidence" className="card card-pad scroll-mt-24">
              <SectionHeading
                eyebrow="Step 1"
                title="Evidence"
                action={
                  <span className="text-[11.5px] text-muted">
                    {detail.evidence.length} file{detail.evidence.length === 1 ? "" : "s"}
                  </span>
                }
              />

              <EvidenceUploader caseId={detail.id} />

              {detail.evidence.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {detail.evidence.map((evidence) => (
                    <EvidenceCard
                      key={evidence.id}
                      evidence={evidence}
                      kindLabel={evidence.kind === "PDF" ? "PDF" : evidence.kind === "TEXT" ? "TXT" : "IMG"}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5">
                  <p className="text-[12.5px] text-muted">
                    Start with the debit alert. Then add the provider message, receipt, or any
                    delivery confirmation you have.
                  </p>
                </div>
              )}
            </section>

            <section id="findings" className="card card-pad scroll-mt-24">
              <SectionHeading
                eyebrow="Step 2"
                title="Discrepancies and missing information"
                action={
                  detail.discrepancies.length > 0 ? (
                    <div className="flex gap-1.5">
                      {severityCounts.high > 0 ? <span className="badge badge-danger">{severityCounts.high} high</span> : null}
                      {severityCounts.medium > 0 ? <span className="badge badge-amber">{severityCounts.medium} medium</span> : null}
                      {severityCounts.low > 0 ? <span className="badge badge-blue">{severityCounts.low} low</span> : null}
                    </div>
                  ) : null
                }
              />

              <p className="rounded-lg border border-[#eee4cf] bg-[#fdf9f1] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#7a5a2a]">
                A discrepancy is an investigative lead, not proof of fraud. Rules compare
                extracted facts deterministically; they do not decide who is right.
              </p>

              {detail.discrepancies.length === 0 ? (
                <div className="mt-4">
                  <p className="rounded-lg border border-line bg-[#fbfaf5] px-4 py-4 text-[12.5px] leading-relaxed text-muted">
                    No deterministic discrepancies were detected in the current evidence.
                    This does not confirm the transaction was valid or that the service was
                    delivered — it only means the available text did not trigger a rule.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.discrepancies.map((finding) => (
                    <article key={finding.id} className={`sev-${finding.severity} rounded-lg border border-line bg-card p-4`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={finding.severity} />
                        <span className="font-mono text-[9.5px] uppercase tracking-wide text-muted">
                          {finding.code}
                        </span>
                      </div>
                      <h3 className="mt-2 text-[14.5px] font-semibold">{finding.title}</h3>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-body">{finding.explanation}</p>
                      <p className="mt-2 text-[12px] leading-relaxed text-ink">
                        <span className="font-semibold">Next step:</span> {finding.recommendation}
                      </p>
                      {findingSources(finding) ? (
                        <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted">
                          Sources: {findingSources(finding)}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section id="facts" className="card card-pad scroll-mt-24">
              <SectionHeading
                eyebrow="Step 3"
                title="Review extracted facts"
                action={
                  <span className="text-[11.5px] text-muted">
                    {detail.facts.filter((fact) => fact.status !== "rejected").length} active of{" "}
                    {detail.facts.length}
                  </span>
                }
              />
              <FactReview facts={detail.facts} />
            </section>

            <section id="timeline" className="card card-pad scroll-mt-24">
              <SectionHeading eyebrow="Step 4" title="Evidence timeline" />
              {detail.timeline.length === 0 ? (
                <EmptyState
                  title="Nothing to place on a timeline yet"
                  body="Upload a dated receipt or alert, and the dates extracted from it will appear here."
                />
              ) : (
                <ol className="relative ml-1 space-y-5 border-l border-line pl-5">
                  {detail.timeline.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span
                        className={`absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ring-4 ring-[#fffefb] ${
                          entry.kind === "correction"
                            ? "bg-amber"
                            : entry.kind === "report"
                              ? "bg-brand"
                              : entry.kind === "evidence"
                                ? "bg-blue"
                                : "bg-[#9a9485]"
                        }`}
                      />
                      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                        {entry.at ? formatDateTime(entry.at) : "Undated"}
                      </p>
                      <p className="mt-0.5 text-[13px] font-semibold">{entry.label}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{entry.detail}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <aside className="min-w-0 space-y-5 lg:sticky lg:top-6 lg:self-start">
            <section id="report" className="card card-pad scroll-mt-24">
              <SectionHeading eyebrow="Step 5" title="Case report" />
              <ReportPanel
                caseId={detail.id}
                reports={detail.reports}
                findingCount={detail.discrepancies.length}
                factCount={detail.facts.length}
              />
            </section>

            <section className="card card-pad">
              <h2 className="text-[13.5px] font-semibold">Case details</h2>
              <dl className="mt-3 space-y-2.5 text-[12px]">
                {[
                  { label: "Claimed amount", value: formatMoney(detail.claimedAmount, detail.currency) },
                  { label: "Service", value: SERVICE_LABEL[detail.serviceType] ?? detail.serviceType },
                  { label: "Provider", value: detail.provider || "Not recorded" },
                  { label: "Incident date", value: formatDate(detail.incidentDate) },
                  { label: "Reference", value: detail.transactionReference || "Not recorded" },
                  { label: "Phone", value: detail.customerPhone || "Not recorded" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4">
                    <dt className="text-muted">{item.label}</dt>
                    <dd className="text-right font-medium text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {detail.description ? (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Description
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-body">
                    {detail.description}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 border-t border-line pt-3">
                <CaseActions caseId={detail.id} status={detail.status} />
              </div>
            </section>

            <section className="card card-pad">
              <details>
                <summary className="cursor-pointer text-[13.5px] font-semibold">
                  Activity log ({detail.events.length})
                </summary>
                <ol className="mt-3 space-y-3">
                  {detail.events.map((event) => (
                    <li key={event.id} className="border-l border-line pl-3">
                      <p className="text-[11.5px] leading-relaxed">{event.summary}</p>
                      <p className="mt-0.5 text-[10.5px] text-muted">
                        {formatDateTime(event.createdAt)}
                        {event.actorName ? ` · ${event.actorName}` : ""}
                        {" · "}
                        <span className="mono">{event.type}</span>
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
            </section>

            <div className="rounded-xl border border-line bg-[#fbfaf5] p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                Privacy
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Evidence is served only through authenticated routes tied to your account.
                Public storage URLs are not used. Removal deletes the stored file.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
