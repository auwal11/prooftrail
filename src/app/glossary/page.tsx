import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Glossary" };

const TERMS = [
  ["Confidence", "The system's confidence in extracting or interpreting a fact. It is not proof that the underlying real-world event happened."],
  ["Provenance", "The record of where a fact came from, including the evidence file and its page, line, or text location."],
  ["Evidence source", "The original file from which a fact or finding was derived. The original file remains the authoritative record."],
  ["SHA-256", "A content fingerprint used to detect whether a stored file's bytes match the file that was uploaded. It does not prove who created a file or that it is genuine."],
  ["Duplicate evidence", "Files with identical content hashes. ProofTrail keeps both visible rather than silently treating a copy as new evidence."],
  ["Finding", "A deterministic observation produced by comparing case details and extracted facts. It is a lead for review, not a fraud verdict."],
  ["Blocker", "A high-severity finding that may prevent a clear review until the missing or conflicting information is addressed."],
  ["Important finding", "A medium-severity finding that deserves attention but does not decide the outcome of a dispute."],
  ["Open gap", "A missing piece of information or evidence that the current case cannot resolve from the files available."],
];

export default async function GlossaryPage() {
  const user = await getSessionUser();
  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />
      <main className="page-shell py-10">
        <Link href={user ? "/cases" : "/"} className="text-[12px] text-muted hover:text-ink">← Back</Link>
        <p className="mt-6 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">Help and definitions</p>
        <h1 className="mt-2 max-w-2xl font-display text-[36px] leading-tight">Confidence, evidence, and findings</h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">Plain-language explanations for the terms used throughout ProofTrail. These definitions describe what the system can observe; they do not turn extracted information into independent verification.</p>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {TERMS.map(([term, definition]) => (
            <article key={term} className="card card-pad">
              <h2 className="text-[15px] font-semibold">{term}</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-body">{definition}</p>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
