import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { SiteFooter, SiteHeader } from "@/components/ui";

const STEPS = [
  {
    number: "01",
    title: "Create the case",
    body: "Record the service, provider, amount, date, and reference. One disputed transaction per case keeps the evidence clean.",
  },
  {
    number: "02",
    title: "Add the evidence",
    body: "Upload screenshots, receipts, alerts, PDFs, or text. Files are validated, hashed, and stored privately.",
  },
  {
    number: "03",
    title: "Review extracted facts",
    body: "Every amount, date, reference, and status keeps a link to its page and excerpt. Correct errors with an attributable trail.",
  },
  {
    number: "04",
    title: "Export the report",
    body: "Generate a professional PDF with source-linked facts, open discrepancies, a timeline, and stated limitations.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />

      <main>
        <section className="grid-hero relative overflow-hidden bg-[#0c2723] text-white">
          <div className="page-shell relative grid gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11.5px] font-medium tracking-wide text-[#cfe8df]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f4c95d]" />
                Built for Nigerian airtime and data disputes
              </span>

              <h1 className="mt-6 font-display text-[44px] leading-[1.04] tracking-[-0.02em] sm:text-[56px] lg:text-[62px]">
                Turn screenshots into a case that holds together.
              </h1>

              <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-[#c3d6d0]">
                You were debited, but the airtime or data never arrived. ProofTrail
                extracts the facts from your evidence, shows exactly where each one came
                from, and flags what is missing, duplicated, or inconsistent — before you
                send anything to a bank or provider.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href={user ? "/cases/new" : "/register"}
                  className="btn btn-primary !bg-[#f4c95d] !text-[#243024] !border-[#f4c95d] hover:!bg-[#eabf4e]"
                >
                  {user ? "Start a new case" : "Create your first case"}
                </Link>
                <Link
                  href={user ? "/cases" : "/login"}
                  className="btn border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  {user ? "Open dashboard" : "Sign in to a demo"}
                </Link>
              </div>

              <p className="mt-6 max-w-md text-[12px] leading-relaxed text-[#93aca4]">
                Your evidence stays private. ProofTrail does not contact banks or
                telecom operators, does not verify transactions, and does not claim that
                fraud occurred.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[420px] lg:mx-0">
              <div className="absolute -left-6 top-10 hidden w-[300px] rotate-[-5deg] rounded-xl border border-white/10 bg-[#13352e] p-4 text-[11px] text-[#a9c4bb] shadow-2xl sm:block">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#d8e8e2]">Evidence #2</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px]">
                    SHA-256
                  </span>
                </div>
                <p className="mt-3 font-mono text-[9.5px] leading-relaxed text-[#7fa296]">
                  9f2c4a71b8e0d3c5…7a6e21d9
                </p>
                <p className="mt-3">delivery_confirmation.png · 84 KB</p>
              </div>

              <div className="relative z-10 rounded-2xl border border-white/10 bg-[#fffdf8] p-5 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand">
                      PT
                    </span>
                    <div>
                      <p className="text-[12.5px] font-semibold">Airtime not delivered</p>
                      <p className="text-[10.5px] text-muted">Case PT-4F2A9C</p>
                    </div>
                  </div>
                  <span className="badge badge-blue">Evidence review</span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-line bg-[#fbfaf5] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                        Extracted amount
                      </p>
                      <span className="text-[10px] text-brand">94% confidence</span>
                    </div>
                    <p className="mt-1 font-display text-[26px] leading-none">NGN 1,000.00</p>
                    <p className="mt-2 text-[10.5px] text-muted">
                      Source: GTBank alert · page 1 · line 2
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1 rounded-lg border border-line p-3">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Reference</p>
                      <p className="mt-1 font-mono text-[10.5px]">202610201234567890</p>
                    </div>
                    <div className="flex-1 rounded-lg border border-line p-3">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Status</p>
                      <p className="mt-1 text-[11.5px] font-semibold">Successful</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#f0d9b5] bg-amber-soft p-3">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-amber">Missing</span>
                      <p className="text-[11.5px] font-semibold text-[#7a3e08]">
                        No delivery confirmation
                      </p>
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#8a5a22]">
                      Debit found. No file in this case confirms the bundle was delivered.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[10.5px] text-muted">
                  <span>3 evidence files · 9 facts</span>
                  <span className="font-semibold text-brand">Generate report →</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-shell py-20">
          <div className="max-w-2xl">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
              The problem
            </p>
            <h2 className="mt-3 font-display text-[34px] leading-tight tracking-[-0.01em] sm:text-[40px]">
              A dispute is rarely about one screenshot.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-body">
              A debit alert, a provider message, a receipt, and a chat screenshot each
              tell part of the story. Amounts drift, references differ, dates get
              mistyped. When the pieces are scattered, the real gaps are easy to miss.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Provenance, not guesswork",
                body: "Every extracted fact keeps its source file, page, character range, and excerpt. If it is not in the evidence, it is not presented as a fact.",
              },
              {
                title: "Deterministic comparisons",
                body: "Amounts, dates, references, statuses, and service details are compared with explicit rules — no generative guessing, no invented conclusions.",
              },
              {
                title: "Corrections stay visible",
                body: "The original extraction is never overwritten. Reviewers can correct or reject a fact, and every change is recorded against their account.",
              },
            ].map((item) => (
              <div key={item.title} className="card card-pad">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-[15px] font-semibold">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-[#fbfaf5]">
          <div className="page-shell py-20">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
                  The workflow
                </p>
                <h2 className="mt-3 font-display text-[34px] leading-tight tracking-[-0.01em] sm:text-[40px]">
                  From upload to a report you can defend.
                </h2>
              </div>
              <p className="max-w-sm text-[13px] leading-relaxed text-muted">
                Four steps, one case. No wallets, no blockchain, no complaint-submission
                system. Just evidence, provenance, and a clear record of what remains
                unresolved.
              </p>
            </div>

            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.number} className="bg-card p-6">
                  <p className="font-mono text-[11px] text-brand">{step.number}</p>
                  <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="page-shell grid gap-12 py-20 lg:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
              What you get
            </p>
            <h2 className="mt-3 font-display text-[34px] leading-tight tracking-[-0.01em]">
              An evidence record, not a verdict.
            </h2>
            <ul className="mt-7 space-y-4">
              {[
                "A private case workspace with ownership checks on every file and fact.",
                "Source-linked facts with page and excerpt so a reviewer can check the original.",
                "Deterministic findings for amount, date, reference, status, and delivery gaps.",
                "A full correction log showing who changed what, when, and why.",
                "A professional PDF with evidence hashes, a timeline, and explicit limitations.",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-body">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-soft text-brand">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="card-dark card-pad">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#8fc0b2]">
              Honest boundaries
            </p>
            <h3 className="mt-3 font-display text-[26px] leading-tight text-white">
              We tell you what the evidence says — and what it cannot say.
            </h3>
            <div className="mt-6 space-y-4 text-[13px] leading-relaxed text-[#b9d0c8]">
              <p>
                ProofTrail does not verify that a bank, telecom operator, payment
                provider, or regulator received a complaint or resolved it.
              </p>
              <p>
                Extracted text can be misread. A discrepancy is an investigative lead,
                not automatic proof of fraud or wrongdoing.
              </p>
              <p>
                File hashes help detect changes after upload. They are not a tamper-proof
                audit guarantee for the whole system.
              </p>
            </div>
            <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-[11.5px] leading-relaxed text-[#a9c4bb]">
                The original evidence files remain the authoritative record. Always check
                the report against them before sending it to an institution.
              </p>
            </div>
          </div>
        </section>

        <section className="page-shell pb-4">
          <div className="card flex flex-col items-start justify-between gap-6 overflow-hidden p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="font-display text-[30px] leading-tight">
                Ready to put your evidence in order?
              </h2>
              <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-muted">
                Start with one disputed airtime or data transaction. Upload what you have;
                ProofTrail will show you what is still missing.
              </p>
            </div>
            <Link href={user ? "/cases/new" : "/register"} className="btn btn-primary">
              {user ? "Start a new case" : "Create a free account"}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
