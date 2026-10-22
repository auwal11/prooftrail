"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EvidenceActions({
  evidenceId,
  canRetry,
}: {
  evidenceId: string;
  canRetry: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"retry" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy("retry");
    setError(null);
    try {
      const response = await fetch(`/api/evidence/${evidenceId}/extract`, { method: "POST" });
      const data = (await response.json()) as { error?: string; ok?: boolean; factCount?: number };
      if (!response.ok || data.ok === false) {
        setError(data.error ?? "Extraction failed again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this evidence file? Its extracted facts and revisions will also be removed.")) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const response = await fetch(`/api/evidence/${evidenceId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not remove the file.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {canRetry ? (
          <button type="button" className="btn btn-outline btn-sm" disabled={busy !== null} onClick={retry}>
            {busy === "retry" ? "Retrying…" : "Retry extraction"}
          </button>
        ) : null}
        <button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={remove}>
          {busy === "delete" ? "Removing…" : "Remove"}
        </button>
      </div>
      {error ? <p className="mt-2 text-[11.5px] text-danger">{error}</p> : null}
    </div>
  );
}
