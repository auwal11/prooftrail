"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CaseStatusValue } from "@/lib/domain";

export function CaseActions({
  caseId,
  status,
}: {
  caseId: string;
  status: CaseStatusValue;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: CaseStatusValue) {
    setBusy("status");
    setError(null);
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not update the case.");
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
    const confirmed = window.confirm(
      "Delete this case permanently? All evidence files, extracted facts, corrections, and reports will be removed. This cannot be undone.",
    );
    if (!confirmed) return;

    setBusy("delete");
    setError(null);
    try {
      const response = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not delete the case.");
        return;
      }
      router.replace("/cases");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a href={`/cases/${caseId}/edit`} className="btn btn-outline btn-sm">
          Edit details
        </a>
        {status === "CLOSED" ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy !== null}
            onClick={() => setStatus("READY")}
          >
            Reopen case
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy !== null}
            onClick={() => setStatus("CLOSED")}
          >
            Mark closed
          </button>
        )}
      </div>

      <button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={remove}>
        {busy === "delete" ? "Deleting…" : "Delete case"}
      </button>

      {error ? <p className="text-[11.5px] text-danger">{error}</p> : null}
      <p className="text-[10.5px] leading-relaxed text-muted">
        Deleting removes the stored files. Reports already downloaded are unaffected.
      </p>
    </div>
  );
}
