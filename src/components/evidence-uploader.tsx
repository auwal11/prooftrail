"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type UploadState = {
  phase: "idle" | "uploading" | "done" | "error";
  message: string | null;
  fileName: string | null;
};

export function EvidenceUploader({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle", message: null, fileName: null });
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setState({ phase: "uploading", message: "Validating and reading the file…", fileName: file.name });

    const form = new FormData();
    form.append("file", file);

    try {
      const response = await fetch(`/api/cases/${caseId}/evidence`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        error?: string;
        factCount?: number;
        extractionOk?: boolean;
        extractionError?: string | null;
      };

      if (!response.ok) {
        setState({ phase: "error", message: data.error ?? "Upload failed.", fileName: file.name });
        return;
      }

      if (data.extractionOk) {
        setState({
          phase: "done",
          message: `Added ${file.name}. Extracted ${data.factCount ?? 0} fact(s).`,
          fileName: file.name,
        });
      } else {
        setState({
          phase: "error",
          message: `The file was saved, but text extraction failed: ${
            data.extractionError ?? "unknown error"
          }. You can retry from the file card.`,
          fileName: file.name,
        });
      }

      router.refresh();
    } catch {
      setState({
        phase: "error",
        message: "Network error while uploading. Check your connection and try again.",
        fileName: file.name,
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file && state.phase !== "uploading") void upload(file);
        }}
        className={`rounded-xl border-2 border-dashed px-5 py-7 text-center transition ${
          dragging ? "border-brand bg-brand-soft" : "border-[#d9d4c6] bg-[#fbfaf5]"
        }`}
      >
        <input
          ref={inputRef}
          id="evidence-file"
          type="file"
          className="sr-only"
          accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,image/png,image/jpeg,image/webp,application/pdf,text/plain"
          disabled={state.phase === "uploading"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />

        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

        <p className="text-[13.5px] font-semibold">
          {state.phase === "uploading" ? "Reading evidence…" : "Drop a file here, or choose one"}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          PNG, JPEG, WebP, PDF, or plain text · maximum 10 MB
        </p>

        <button
          type="button"
          className="btn btn-outline btn-sm mt-4"
          disabled={state.phase === "uploading"}
          onClick={() => inputRef.current?.click()}
        >
          {state.phase === "uploading" ? "Working…" : "Choose file"}
        </button>
      </div>

      {state.message ? (
        <div
          role="status"
          className={`mt-3 rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
            state.phase === "error"
              ? "border-[#f1c8c3] bg-danger-soft text-danger"
              : "border-[#cfe6dc] bg-brand-soft text-brand-dark"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Files are stored privately and served only through an authenticated route. The
        SHA-256 hash is recorded at upload time so the original can be compared later.
      </p>
    </div>
  );
}
