import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewCaseForm } from "@/components/new-case-form";
import { SiteFooter, SiteHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "New case" };

export default async function NewCasePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />
      <main className="page-shell max-w-[820px] py-10">
        <Link href="/cases" className="text-[12.5px] text-muted hover:text-ink">
          ← Back to cases
        </Link>
        <p className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
          New case
        </p>
        <h1 className="mt-2 font-display text-[36px] leading-tight tracking-[-0.01em]">
          Set up the record.
        </h1>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted">
          Enter what you know now. ProofTrail will compare these details with the facts it
          extracts from your evidence, and will flag differences instead of assuming which
          version is correct.
        </p>

        <div className="mt-8">
          <NewCaseForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
