"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FactTypeValue, FactView } from "@/lib/domain";

const TYPE_LABEL: Record<FactTypeValue, string> = {
  AMOUNT: "Amount",
  DATE: "Date",
  REFERENCE: "Reference",
  PHONE: "Phone",
  STATUS: "Status",
  SERVICE_TYPE: "Service",
  PROVIDER: "Provider",
  RECIPIENT: "Recipient",
  ACCOUNT_MASK: "Account",
  DESCRIPTION: "Description",
};

function SourceBadge({ fact }: { fact: FactView }) {
  const page = fact.locator?.page;
  return (
    <span className="text-[11px] text-muted">
      {fact.evidenceName}
      {page ? ` · p.${page}` : ""}
      <span className="mx-1.5 text-[#c9c2b2]">·</span>
      <span
        className="cursor-help underline decoration-dotted decoration-[#c9c2b2] underline-offset-2"
        title="Extraction confidence estimates how reliably this value was read from the file. It is not a truthfulness score."
      >
        {Math.round(fact.confidence * 100)}% confidence
      </span>
    </span>
  );
}

function isReviewed(fact: FactView): boolean {
  return Boolean(fact.reviewedAt) || fact.status !== "original";
}

export function FactReview({ caseId, facts }: { caseId: string; facts: FactView[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | FactTypeValue>("ALL");
  const [statusFilter, setStatusFilter] = useState<"UNREVIEWED" | "ALL" | "REVIEWED">("UNREVIEWED");
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const types = useMemo(() => {
    const present = new Set(facts.map((fact) => fact.type));
    return (Object.keys(TYPE_LABEL) as FactTypeValue[]).filter((type) => present.has(type));
  }, [facts]);

  const counts = useMemo(() => {
    const reviewed = facts.filter(isReviewed).length;
    return { reviewed, unreviewed: facts.length - reviewed };
  }, [facts]);

  const filtered = useMemo(
    () =>
      facts.filter((fact) => {
        const matchesType = filter === "ALL" || fact.type === filter;
        const matchesStatus =
          statusFilter === "ALL" ||
          (statusFilter === "REVIEWED" ? isReviewed(fact) : !isReviewed(fact));
        return matchesType && matchesStatus;
      }),
    [facts, filter, statusFilter],
  );

  const visible = showAll ? filtered : filtered.slice(0, 40);
  const visibleUnreviewed = visible.filter((fact) => !isReviewed(fact));

  async function markVisibleReviewed() {
    const ids = visibleUnreviewed.map((fact) => fact.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setError(null);
    setBulkNotice(null);
    try {
      const response = await fetch(`/api/cases/${caseId}/facts/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factIds: ids }),
      });
      const data = (await response.json()) as { error?: string; reviewed?: number };
      if (!response.ok) {
        setError(data.error ?? "Could not update the review state.");
        return;
      }
      setBulkNotice(
        `${data.reviewed ?? ids.length} fact${(data.reviewed ?? ids.length) === 1 ? "" : "s"} marked as reviewed.`,
      );
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function revise(fact: FactView, action: "CORRECT" | "REJECT" | "RESTORE") {
    setBusy(fact.id);
    setError(null);

    try {
      const response = await fetch(`/api/facts/${fact.id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          newValue: action === "CORRECT" ? value.trim() : undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save the change.");
        return;
      }

      setEditing(null);
      setValue("");
      setNote("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (facts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-[#fbfaf5] px-4 py-5 text-[12.5px] text-muted">
        No facts were extracted yet. Upload evidence, or retry extraction if a file
        failed.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["UNREVIEWED", `Unreviewed ${counts.unreviewed}`],
            ["ALL", `All ${facts.length}`],
            ["REVIEWED", `Reviewed ${counts.reviewed}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatusFilter(value);
              setShowAll(false);
            }}
            className={`badge ${statusFilter === value ? "badge-brand" : "badge-neutral"} cursor-pointer`}
          >
            {label}
          </button>
        ))}
        {visibleUnreviewed.length > 0 ? (
          <>
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={bulkBusy}
              onClick={markVisibleReviewed}
            >
              {bulkBusy ? "Marking…" : `Mark visible as reviewed (${visibleUnreviewed.length})`}
            </button>
          </>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setFilter("ALL");
            setShowAll(false);
          }}
          className={`badge ${filter === "ALL" ? "badge-brand" : "badge-neutral"} cursor-pointer`}
        >
          All types
        </button>
        {types.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setFilter(type);
              setShowAll(false);
            }}
            className={`badge ${filter === type ? "badge-brand" : "badge-neutral"} cursor-pointer`}
          >
            {TYPE_LABEL[type]} {facts.filter((fact) => fact.type === type).length}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Corrections never overwrite the original extraction. Each change is saved as a
        separate audit event with your account and timestamp. Marking a fact reviewed
        records that you checked it; it does not change its value.
      </p>

      {bulkNotice ? (
        <p className="mt-2 text-[11.5px] text-brand-dark" role="status">
          {bulkNotice}
        </p>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-[#f1c8c3] bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {visible.length === 0 ? (
          <p className="px-4 py-5 text-[12.5px] text-muted">
            {statusFilter === "UNREVIEWED"
              ? "All matching facts have been reviewed. Switch to All or Reviewed to see them."
              : "No facts match the current filters."}
          </p>
        ) : null}
        {visible.map((fact) => {
          const rejected = fact.status === "rejected";
          const isEditing = editing === fact.id;

          return (
            <div key={fact.id} className={`px-4 py-3.5 ${rejected ? "bg-[#faf9f5]" : ""}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-neutral">{TYPE_LABEL[fact.type]}</span>
                    <span
                      className={`text-[13.5px] font-semibold ${
                        rejected ? "text-muted line-through" : "text-ink"
                      }`}
                    >
                      {rejected ? fact.rawValue : fact.effectiveValue ?? fact.rawValue}
                    </span>
                    {fact.status === "corrected" ? (
                      <span className="badge badge-amber">Corrected</span>
                    ) : null}
                    {rejected ? <span className="badge badge-neutral">Not applicable</span> : null}
                    {isReviewed(fact) && fact.status === "original" ? (
                      <span className="badge badge-brand">Reviewed</span>
                    ) : null}
                  </div>

                  <div className="mt-1.5">
                    <SourceBadge fact={fact} />
                  </div>

                  {fact.status === "corrected" ? (
                    <p className="mt-1.5 text-[11px] text-muted">
                      Original extraction: <span className="mono">{fact.rawValue}</span>
                    </p>
                  ) : null}

                  {fact.snippet ? (
                    <p className="mt-2 border-l-2 border-[#ded8c9] pl-2.5 text-[11.5px] italic leading-relaxed text-muted">
                      “{fact.snippet}”
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-none flex-wrap items-center gap-1.5">
                  {!rejected ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setEditing(isEditing ? null : fact.id);
                        setValue(fact.effectiveValue ?? fact.rawValue);
                        setNote("");
                        setError(null);
                      }}
                    >
                      {isEditing ? "Cancel" : "Correct"}
                    </button>
                  ) : null}

                  {!rejected ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy === fact.id}
                      onClick={() => revise(fact, "REJECT")}
                    >
                      Not applicable
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy === fact.id}
                      onClick={() => revise(fact, "RESTORE")}
                    >
                      Restore
                    </button>
                  )}

                  {fact.revisions.length > 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setHistory(history === fact.id ? null : fact.id)}
                    >
                      History ({fact.revisions.length})
                    </button>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div className="mt-3 rounded-lg border border-line bg-[#fbfaf5] p-3">
                  <label className="label" htmlFor={`value-${fact.id}`}>
                    Corrected value
                  </label>
                  <input
                    id={`value-${fact.id}`}
                    className="input"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    maxLength={200}
                  />
                  <label className="label mt-3" htmlFor={`note-${fact.id}`}>
                    Reason (optional)
                  </label>
                  <input
                    id={`note-${fact.id}`}
                    className="input"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. OCR read the reference as 0 instead of O"
                    maxLength={500}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy === fact.id || !value.trim()}
                      onClick={() => revise(fact, "CORRECT")}
                    >
                      {busy === fact.id ? "Saving…" : "Save correction"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {history === fact.id ? (
                <div className="mt-3 space-y-2 rounded-lg border border-line bg-[#fbfaf5] p-3">
                  {fact.revisions.map((revision) => (
                    <div key={revision.id} className="text-[11.5px] leading-relaxed">
                      <p className="font-medium text-body">
                        {revision.action === "CORRECT"
                          ? "Corrected"
                          : revision.action === "REJECT"
                            ? "Marked not applicable"
                            : "Restored to original"}{" "}
                        by {revision.actorName}
                      </p>
                      <p className="text-muted">
                        {new Date(revision.createdAt).toLocaleString("en-NG")}
                        {revision.newValue ? ` · new value: ${revision.newValue}` : ""}
                        {revision.note ? ` · note: ${revision.note}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {filtered.length > 40 && !showAll ? (
        <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => setShowAll(true)}>
          Show all {filtered.length} facts
        </button>
      ) : null}
    </div>
  );
}
