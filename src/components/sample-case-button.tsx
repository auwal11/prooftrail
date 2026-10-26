"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SampleCaseButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createSample() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cases/sample", { method: "POST" });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setError(data.error ?? "Could not create the sample case.");
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
    <div className="flex flex-col items-center gap-2">
      <button type="button" className="btn btn-outline" onClick={createSample} disabled={loading}>
        {loading ? "Building sample case…" : "Explore sample case"}
      </button>
      {error ? (
        <p className="max-w-xs text-center text-[11.5px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
