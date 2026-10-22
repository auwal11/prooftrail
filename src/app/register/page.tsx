import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { Brand } from "@/components/brand";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/cases");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-2xl border border-line bg-card shadow-xl lg:grid-cols-[0.95fr_1fr]">
        <aside className="grid-hero relative hidden flex-col justify-between bg-[#0c2723] p-8 text-white lg:flex">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#8fc0b2]">
              Evidence intelligence
            </p>
            <h2 className="mt-3 font-display text-[28px] leading-tight">
              A clear record of what your evidence says.
            </h2>
            <ul className="mt-6 space-y-3 text-[12.5px] leading-relaxed text-[#b9d0c8]">
              <li>Private case workspace with ownership checks.</li>
              <li>Facts traced to a file, page, and excerpt.</li>
              <li>Deterministic checks for amounts, dates, and references.</li>
              <li>Professional PDF export with limitations stated.</li>
            </ul>
          </div>
          <p className="text-[11px] leading-relaxed text-[#93aca4]">
            ProofTrail is a documentation tool. It does not resolve disputes or determine
            that fraud occurred.
          </p>
        </aside>

        <div className="p-8 sm:p-10">
          <Brand />
          <h1 className="mt-8 font-display text-[32px] leading-tight">Create your account.</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Free for the competition demo. One case at a time is enough to start.
          </p>
          <div className="mt-7">
            <RegisterForm />
          </div>
        </div>
      </div>
    </main>
  );
}
