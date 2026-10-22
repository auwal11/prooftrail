import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditCaseForm } from "@/components/edit-case-form";
import { SiteFooter, SiteHeader } from "@/components/ui";
import { getCaseDetail } from "@/lib/case-data";
import { getSessionUser } from "@/lib/session";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit case" };

export default async function EditCasePage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const detail = await getCaseDetail(user.id, id);
  if (!detail) notFound();

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />
      <main className="page-shell max-w-[820px] py-10">
        <Link href={`/cases/${detail.id}`} className="text-[12.5px] text-muted hover:text-ink">
          ← Back to case
        </Link>
        <p className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
          Edit case
        </p>
        <h1 className="mt-2 font-display text-[34px] leading-tight tracking-[-0.01em]">
          Keep the record accurate.
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
          Changing case details does not alter extracted facts. If the evidence itself was
          read incorrectly, correct the specific fact instead so the original extraction
          stays visible.
        </p>

        <div className="mt-8">
          <EditCaseForm detail={detail} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
