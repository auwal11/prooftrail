import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader, StatusBadge } from "@/components/ui";
import { SampleCaseButton } from "@/components/sample-case-button";
import { listCases } from "@/lib/case-data";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Cases" };

const SERVICE_LABEL: Record<string, string> = {
  AIRTIME: "Airtime",
  DATA: "Data",
  OTHER: "Other service",
};

export default async function CasesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const cases = await listCases(user.id);
  const evidenceCount = cases.reduce((sum, item) => sum + item.evidenceCount, 0);
  const factCount = cases.reduce((sum, item) => sum + item.factCount, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />

      <main className="page-shell py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
              Workspace
            </p>
            <h1 className="mt-2 font-display text-[36px] leading-tight tracking-[-0.01em]">
              Your cases
            </h1>
            <p className="mt-2 text-[13.5px] text-muted">
              Each case should cover one disputed transaction. Evidence and facts stay
              private to your account.
            </p>
          </div>
          <Link href="/cases/new" className="btn btn-primary">
            + New case
          </Link>
        </div>

        {cases.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[520px]">
            {[
              { label: "Cases", value: cases.length },
              { label: "Evidence files", value: evidenceCount },
              { label: "Extracted facts", value: factCount },
            ].map((item) => (
              <div key={item.label} className="card px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {item.label}
                </p>
                <p className="mt-1 font-display text-[24px] leading-none">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-10">
          {cases.length === 0 ? (
            <div className="card card-pad mx-auto max-w-2xl">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand-dark">
                Your first case
              </p>
              <h2 className="mt-2 font-display text-[26px] leading-tight">No cases yet</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                Start with the transaction you are disputing. You can add the debit alert,
                provider messages, and receipts as you go.
              </p>

              <ol className="mt-5 space-y-3">
                {[
                  {
                    title: "Create the case",
                    body: "Record the service, provider, amount, incident date, and phone number.",
                  },
                  {
                    title: "Upload what you already have",
                    body: "Debit alerts, provider SMS or email, receipts, and screenshots. Text is extracted; hashes are recorded.",
                  },
                  {
                    title: "Review the gaps and generate a report",
                    body: "Check the extracted facts, then produce a source-linked PDF for the provider's support channel.",
                  },
                ].map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-brand/30 bg-brand-soft text-[11px] font-semibold text-brand-dark">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[12.5px] font-semibold">{step.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
                <Link href="/cases/new" className="btn btn-primary">
                  Create your first case
                </Link>
                <SampleCaseButton />
              </div>
              <p className="mt-2 text-[11px] text-muted">
                The sample is copied into your account. It uses synthetic documents and does
                not contact any provider.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {cases.map((item) => (
                <Link
                  key={item.id}
                  href={`/cases/${item.id}`}
                  className="card card-pad group transition hover:border-[#cfc9ba] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                        {SERVICE_LABEL[item.serviceType] ?? item.serviceType}
                        {item.provider ? ` · ${item.provider}` : ""}
                      </p>
                      <h2 className="mt-1.5 text-[16.5px] font-semibold leading-snug group-hover:text-brand">
                        {item.title}
                      </h2>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
                    <span className="font-medium text-ink">
                      {formatMoney(item.claimedAmount, item.currency)}
                    </span>
                    <span>
                      {item.evidenceCount} {item.evidenceCount === 1 ? "file" : "files"}
                    </span>
                    <span>
                      {item.factCount} {item.factCount === 1 ? "fact" : "facts"}
                    </span>
                    <span>Updated {formatDate(item.updatedAt)}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11.5px] text-muted">
                    <span className="mono">PT-{item.id.slice(-6).toUpperCase()}</span>
                    <span className="font-semibold text-brand">Open case →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
