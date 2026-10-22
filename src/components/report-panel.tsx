"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReportView } from "@/lib/domain";

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
}: {
  caseId: string;
  reports: ReportView[];
  findingCount: number;
  factCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <p className="text-[12px] leading-relaxed text-muted">
        The PDF includes the case summary, evidence hashes, source-linked facts, open
        discrepancies, a timeline, the correction log, and stated limitations.
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
        <span className="badge badge-neutral">{factCount} facts</span>
        <span className="badge badge-neutral">{findingCount} findings</span>
        <span className="badge badge-neutral">PDF · A4</span>
      </div>

      <button
        type="button"
        className="btn btn-primary mt-4 w-full"
        onClick={generate}
        disabled={loading}
      >
        {loading ? "Building PDF…" : reports.length > 0 ? "Generate updated report" : "Generate case report"}
      </button>

      {error ? (
        <p className="mt-2 text-[11.5px] leading-relaxed text-danger">{error}</p>
      ) : null}

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
                  <a
                    href={`/api/reports/${report.id}`}
                    className="text-[11.5px] font-semibold text-brand hover:underline"
                  >
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
