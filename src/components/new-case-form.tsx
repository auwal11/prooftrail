"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SERVICE_OPTIONS = [
  { value: "AIRTIME", label: "Airtime", hint: "Recharge, top-up, or transfer to a phone" },
  { value: "DATA", label: "Data", hint: "Bundle or internet plan" },
  { value: "OTHER", label: "Other", hint: "A different transaction type" },
] as const;

const EVIDENCE_HINTS: Record<"AIRTIME" | "DATA" | "OTHER", string[]> = {
  AIRTIME: [
    "Debit alert or bank statement line showing the recharge",
    "Provider SMS or app confirmation, if any",
    "Recharge receipt or agent slip",
    "Screenshot of the failed or pending state",
  ],
  DATA: [
    "Debit alert or bank statement line showing the data purchase",
    "Data plan confirmation or failure message",
    "Provider app or USSD screenshot showing remaining data",
    "Any refund or reversal message",
  ],
  OTHER: [
    "Proof of payment (alert, statement, or receipt)",
    "Provider confirmation or failure message",
    "Screenshot of the affected account or service",
    "Any correspondence with support",
  ],
};

export function NewCaseForm() {
  const router = useRouter();
  const [serviceType, setServiceType] = useState<"AIRTIME" | "DATA" | "OTHER">("AIRTIME");
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

    const payload = {
      title: String(form.get("title") ?? "").trim(),
      serviceType,
      provider: String(form.get("provider") ?? "").trim() || undefined,
      claimedAmount: amount,
      incidentDate: String(form.get("incidentDate") ?? "").trim() || undefined,
      transactionReference: String(form.get("transactionReference") ?? "").trim() || undefined,
      customerPhone: String(form.get("customerPhone") ?? "").trim() || undefined,
      description: String(form.get("description") ?? "").trim() || undefined,
    };

    setLoading(true);
    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !data.id) {
        setError(data.error ?? "Could not create the case.");
        return;
      }

      router.push(`/cases/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[#f1c8c3] bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
        >
          {error}
        </div>
      ) : null}

      <section className="card card-pad">
        <h2 className="text-[15px] font-semibold">What are you disputing?</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Describe one debit. Keep unrelated transactions in separate cases.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="title">
              Case title <span className="text-danger">*</span>
            </label>
            <input
              id="title"
              name="title"
              className="input"
              required
              minLength={3}
              maxLength={140}
              placeholder="Airtime not delivered after N1,000 debit"
            />
          </div>

          <div>
            <span className="label">Service type</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {SERVICE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border p-3.5 transition ${
                    serviceType === option.value
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-[#fffefb] hover:border-[#cfc9ba]"
                  }`}
                >
                  <input
                    type="radio"
                    name="serviceType"
                    value={option.value}
                    className="sr-only"
                    checked={serviceType === option.value}
                    onChange={() => setServiceType(option.value)}
                  />
                  <span className="block text-[13.5px] font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                    {option.hint}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#e7e0d2] bg-[#fbfaf5] p-3.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              Suggested evidence for this service
            </p>
            <ul className="mt-2 space-y-1.5">
              {(EVIDENCE_HINTS[serviceType] ?? EVIDENCE_HINTS.OTHER).map((item) => (
                <li key={item} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
                  <span aria-hidden="true" className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[#b9b09b]" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              You can add more files after the case is created. Missing documents appear as
              gaps, not as failures.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="provider">
                Provider or bank
              </label>
              <input
                id="provider"
                name="provider"
                className="input"
                maxLength={80}
                placeholder="MTN, Airtel, Moniepoint…"
              />
            </div>
            <div>
              <label className="label" htmlFor="claimedAmount">
                Amount claimed (NGN)
              </label>
              <input
                id="claimedAmount"
                name="claimedAmount"
                className="input"
                inputMode="decimal"
                placeholder="1000.00"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="incidentDate">
                Incident date
              </label>
              <input id="incidentDate" name="incidentDate" className="input" type="date" lang="en-GB" />
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                Use the date shown in Nigeria (day/month/year), not the SMS timestamp in
                another timezone.
              </p>
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
                placeholder="From the receipt, if known"
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
              placeholder="0803 123 4567"
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
              placeholder="I was debited on 20 October for N1,000 airtime, but the recharge never reached my line. I have the debit alert and the provider's message."
            />
            <p className="hint mt-1.5">
              Stick to facts you can support with evidence. You can add files in the next
              step.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => router.push("/cases")}
          disabled={loading}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Creating case…" : "Create case and add evidence →"}
        </button>
      </div>
    </form>
  );
}
