"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CaseDetail } from "@/lib/domain";

export function EditCaseForm({ detail }: { detail: CaseDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const amountRaw = String(form.get("claimedAmount") ?? "").trim();
    const amount = amountRaw ? Number(amountRaw.replace(/,/g, "")) : undefined;

    if (amountRaw && (!Number.isFinite(amount) || Number(amount) <= 0)) {
      setError("Enter the claimed amount as a number, for example 1000.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/cases/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          serviceType: String(form.get("serviceType") ?? "AIRTIME"),
          provider: String(form.get("provider") ?? "").trim(),
          claimedAmount: amount,
          incidentDate: String(form.get("incidentDate") ?? "").trim() || undefined,
          transactionReference: String(form.get("transactionReference") ?? "").trim(),
          customerPhone: String(form.get("customerPhone") ?? "").trim(),
          description: String(form.get("description") ?? "").trim(),
          status: String(form.get("status") ?? detail.status),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save the case.");
        return;
      }
      router.push(`/cases/${detail.id}`);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-[#f1c8c3] bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      ) : null}

      <div className="card card-pad space-y-4">
        <div>
          <label className="label" htmlFor="title">
            Case title
          </label>
          <input
            id="title"
            name="title"
            className="input"
            required
            minLength={3}
            maxLength={140}
            defaultValue={detail.title}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="serviceType">
              Service type
            </label>
            <select id="serviceType" name="serviceType" className="select" defaultValue={detail.serviceType}>
              <option value="AIRTIME">Airtime</option>
              <option value="DATA">Data</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">
              Case status
            </label>
            <select id="status" name="status" className="select" defaultValue={detail.status}>
              <option value="DRAFT">Draft</option>
              <option value="EVIDENCE_REVIEW">Evidence review</option>
              <option value="READY">Report ready</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="provider">
              Provider or bank
            </label>
            <input id="provider" name="provider" className="input" maxLength={80} defaultValue={detail.provider ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="claimedAmount">
              Claimed amount (NGN)
            </label>
            <input
              id="claimedAmount"
              name="claimedAmount"
              className="input"
              inputMode="decimal"
              defaultValue={detail.claimedAmount ?? ""}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="incidentDate">
              Incident date
            </label>
            <input
              id="incidentDate"
              name="incidentDate"
              type="date"
              className="input"
              defaultValue={detail.incidentDate?.slice(0, 10) ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="transactionReference">
              Transaction reference
            </label>
            <input
              id="transactionReference"
              name="transactionReference"
              className="input mono"
              maxLength={80}
              defaultValue={detail.transactionReference ?? ""}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="customerPhone">
            Phone number affected
          </label>
          <input
            id="customerPhone"
            name="customerPhone"
            className="input"
            maxLength={30}
            defaultValue={detail.customerPhone ?? ""}
          />
        </div>

        <div>
          <label className="label" htmlFor="description">
            What happened?
          </label>
          <textarea
            id="description"
            name="description"
            className="textarea"
            maxLength={2000}
            defaultValue={detail.description ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => router.push(`/cases/${detail.id}`)}
          disabled={loading}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
