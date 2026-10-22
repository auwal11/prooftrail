import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { Brand } from "@/components/brand";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/cases");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="grid w-full max-w-[880px] overflow-hidden rounded-2xl border border-line bg-card shadow-xl lg:grid-cols-[1fr_0.9fr]">
        <div className="p-8 sm:p-10">
          <Brand />
          <h1 className="mt-8 font-display text-[32px] leading-tight">Welcome back.</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Sign in to review your cases, evidence, and reports.
          </p>
          <div className="mt-7">
            <LoginForm />
          </div>
        </div>

        <aside className="grid-hero relative hidden flex-col justify-between bg-[#0c2723] p-8 text-white lg:flex">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#8fc0b2]">
              Demo access
            </p>
            <h2 className="mt-3 font-display text-[26px] leading-tight">
              Explore a fully populated dispute case.
            </h2>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#b9d0c8]">
              The demo account contains a sample airtime case with a debit alert, a
              provider receipt, and a deliberate inconsistency to show how findings work.
            </p>

            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#8fc0b2]">Email</p>
              <p className="mt-1 font-mono text-[12.5px] text-white">demo@prooftrail.app</p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#8fc0b2]">Password</p>
              <p className="mt-1 font-mono text-[12.5px] text-white">ProofTrailDemo2026</p>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-[#93aca4]">
            Demo data only. Do not upload real customer evidence to the public demo
            account.
          </p>
        </aside>
      </div>

      <p className="absolute bottom-6 text-center text-[12px] text-muted">
        <Link href="/" className="hover:text-ink">
          ← Back to ProofTrail
        </Link>
      </p>
    </main>
  );
}
