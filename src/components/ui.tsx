import Link from "next/link";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import type { CaseStatusValue, Severity } from "@/lib/domain";

export function SiteHeader({
  user,
}: {
  user: { name: string; email: string } | null;
}) {
  return (
    <header className="border-b border-line bg-[#fffdf8]/90 backdrop-blur">
      <div className="page-shell flex h-16 items-center justify-between gap-4">
        <Brand />
        <nav className="flex items-center gap-1.5">
          {user ? (
            <>
              <Link href="/cases" className="nav-link">
                Cases
              </Link>
              <Link href="/cases/new" className="btn btn-outline btn-sm">
                New case
              </Link>
              <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
              <span className="hidden text-[12.5px] text-muted sm:block" title={user.email}>
                {user.name}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-20">
      <div className="page-shell flex flex-col gap-3 py-8 text-[12.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          ProofTrail · evidence intelligence for transaction disputes. Built for the
          Devcenter Hacktober 2026 competition.
        </p>
        <p className="max-w-md">
          ProofTrail does not adjudicate disputes, contact providers, or confirm that a
          complaint was filed. A discrepancy is a lead, not proof of fraud.
        </p>
      </div>
    </footer>
  );
}

const STATUS_STYLE: Record<CaseStatusValue, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "badge-neutral" },
  EVIDENCE_REVIEW: { label: "Evidence review", className: "badge-blue" },
  READY: { label: "Report ready", className: "badge-brand" },
  CLOSED: { label: "Closed", className: "badge-neutral" },
};

export function StatusBadge({ status }: { status: CaseStatusValue }) {
  const style = STATUS_STYLE[status];
  return <span className={`badge ${style.className}`}>{style.label}</span>;
}

const SEVERITY_STYLE: Record<Severity, { label: string; className: string }> = {
  high: { label: "Blocker", className: "badge-danger" },
  medium: { label: "Important", className: "badge-amber" },
  low: { label: "Info", className: "badge-blue" },
  info: { label: "Info", className: "badge-neutral" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLE[severity];
  return <span className={`badge ${style.className}`}>{style.label}</span>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-[#fbfaf5] px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
        <h2 className="mt-1 text-[19px] font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
