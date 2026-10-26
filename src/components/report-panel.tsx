"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReportView, Severity } from "@/lib/domain";
import { buildComplaintDraft, type ComplaintCaseInfo } from "@/lib/complaint-draft";

const SEVERITY_LABEL: Record<Severity, string> = {
  high: "Blocker",
  medium: "Important",
  low: "Info",
  info: "Info",
};

function formatWhen(value: string): string {
  return new Date(value).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportPanel({
  caseId,
  reports,
  findingCount,
  factCount,
  caseInfo,
}: {
  caseId: string;
  reports: ReportView[];
  findingCount: number;
  factCount: number;
  caseInfo: ComplaintCaseInfo;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cases/${caseId}/report`, { method: "POST" });
      const data = (await response.json()) as { reportId?: string; error?: string };
      if (!response.ok || !data.reportId) {
        setError(data.error ?? "Could not generate the report.");
        return;
      }
      router.refresh();
      const link = document.createElement("a");
      link.href = `/api/reports/${data.reportId}`;
      link.rel = "noopener";
      link.click();
    } catch {
      setError("Network error while generating the report. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft() {
    setCopyError(null);
    const text = buildComplaintDraft(caseInfo);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (!ok) throw new Error("Copy failed");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError("Could not copy automatically. Select the draft text and copy it manually.");
    }
  }

  return (
    <div>
      <p className="text-[12px] leading-relaxed text-muted">
        The PDF includes the case summary, evidence hashes, source-linked facts, open
        discrepancies, a timeline, the correction log, a how-to-use note, and stated
        limitations.
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
        <span className="badge badge-neutral">{factCount} facts</span>
        <span className="badge badge-neutral">{findingCount} findings</span>
        <span className="badge badge-neutral">PDF · A4</span>
      </div>

      <div className="mt-4 rounded-lg border border-[#eee4cf] bg-[#fdf9f1] px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#7a5a2a]">
            Open gaps
          </p>
          <span className="badge badge-neutral">
            {caseInfo.openFindings.length} blocker / important
          </span>
        </div>
        {caseInfo.openFindings.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {caseInfo.openFindings.slice(0, 4).map((finding) => (
              <li key={finding.code} className="text-[11.5px] leading-relaxed text-[#7a5a2a]">
                <span className="font-semibold">{SEVERITY_LABEL[finding.severity]}:</span>{" "}
                {finding.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#7a5a2a]">
            No blocker or important gaps were detected in the current evidence. This is
            not a confirmation that the transaction was valid.
          </p>
        )}
        {caseInfo.openFindings.length > 4 ? (
          <p className="mt-1.5 text-[10.5px] text-[#7a5a2a]">
            +{caseInfo.openFindings.length - 4} more in the PDF report.
          </p>
        ) : null}
      </div>

      <button type="button" className="btn btn-primary mt-4 w-full" onClick={generate} disabled={loading}>
        {loading ? "Building PDF…" : reports.length > 0 ? "Generate updated report" : "Generate case report"}
      </button>

      {error ? <p className="mt-2 text-[11.5px] leading-relaxed text-danger">{error}</p> : null}

      <button type="button" className="btn btn-outline mt-2 w-full" onClick={copyDraft}>
        {copied ? "Draft copied" : "Copy neutral complaint draft"}
      </button>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
        Plain text for the provider&apos;s official support channel. It states the facts
        and open gaps, does not claim fraud, and is never sent automatically.
      </p>
      {copyError ? <p className="mt-1.5 text-[11.5px] leading-relaxed text-danger">{copyError}</p> : null}

      {reports.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Previous reports
          </p>
          <ul className="mt-2 space-y-2.5">
            {reports.map((report) => (
              <li key={report.id} className="rounded-lg border border-line bg-[#fbfaf5] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-medium">{formatWhen(report.createdAt)}</span>
                  <a href={`/api/reports/${report.id}`} className="text-[11.5px] font-semibold text-brand hover:underline">
                    Download
                  </a>
                </div>
                <p className="mt-1 truncate font-mono text-[9.5px] text-muted" title={report.sha256}>
                  SHA-256 {report.sha256}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
            The hash identifies the generated file. Keep the downloaded copy; regenerating
            produces a new report and a new hash.
          </p>
        </div>
      ) : null}
    </div>
  );
}
