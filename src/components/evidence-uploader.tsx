"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type UploadState = {
  phase: "idle" | "uploading" | "extracting" | "done" | "error";
  message: string | null;
  fileName: string | null;
  progress: number;
};

type UploadResult = {
  error?: string;
  factCount?: number;
  extractionOk?: boolean;
  extractionError?: string | null;
};

function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (percent: number) => void,
): Promise<{ status: number; data: UploadResult }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.upload.onload = () => onProgress(100);
    xhr.onload = () => {
      const data = (xhr.response ?? {}) as UploadResult;
      if (!data.error && xhr.status >= 400) data.error = "Upload failed.";
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onabort = () => reject(new Error("abort"));
    xhr.send(form);
  });
}

export function EvidenceUploader({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({
    phase: "idle",
    message: null,
    fileName: null,
    progress: 0,
  });
  const [dragging, setDragging] = useState(false);
  const busy = state.phase === "uploading" || state.phase === "extracting";

  async function upload(file: File) {
    setState({
      phase: "uploading",
      message: "Uploading…",
      fileName: file.name,
      progress: 0,
    });

    const form = new FormData();
    form.append("file", file);
    let extractionTimer: number | undefined;

    try {
      const { status, data } = await uploadWithProgress(
        `/api/cases/${caseId}/evidence`,
        form,
        (progress) => {
          setState((current) =>
            current.phase === "uploading" ? { ...current, progress } : current,
          );
          if (progress >= 100 && !extractionTimer) {
            extractionTimer = window.setTimeout(() => {
              setState((current) =>
                current.phase === "uploading" || current.phase === "extracting"
                  ? {
                      ...current,
                      phase: "extracting",
                      message: "Upload complete. Reading text and extracting facts…",
                    }
                  : current,
              );
            }, 250);
          }
        },
      );

      if (status >= 400) {
        setState({
          phase: "error",
          message: data.error ?? "Upload failed.",
          fileName: file.name,
          progress: 0,
        });
        return;
      }

      if (data.extractionOk) {
        setState({
          phase: "done",
          message: `Added ${file.name}. Extracted ${data.factCount ?? 0} fact(s).`,
          fileName: file.name,
          progress: 100,
        });
      } else {
        setState({
          phase: "error",
          message: `The file was saved, but text extraction failed: ${
            data.extractionError ?? "unknown error"
          }. You can retry from the file card.`,
          fileName: file.name,
          progress: 100,
        });
      }

      router.refresh();
    } catch (error) {
      setState({
        phase: "error",
        message:
          error instanceof Error && error.message === "timeout"
            ? "The upload timed out. The file may have been saved; refresh before retrying."
            : "Network error while uploading. Check your connection and try again.",
        fileName: file.name,
        progress: 0,
      });
    } finally {
      if (extractionTimer) window.clearTimeout(extractionTimer);
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
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
          if (file && !busy) void upload(file);
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
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />

        <input
          ref={cameraRef}
          id="evidence-camera"
          type="file"
          className="sr-only"
          accept="image/*"
          capture="environment"
          disabled={busy}
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
          {state.phase === "uploading"
            ? `Uploading${state.progress > 0 ? ` ${state.progress}%` : "…"}`
            : state.phase === "extracting"
              ? "Reading text and extracting facts…"
              : "Drop a file here, or choose one"}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          PNG, JPEG, WebP, PDF, or plain text · maximum 10 MB
        </p>

        {busy && state.phase === "uploading" ? (
          <div
            className="mx-auto mt-3 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[#e7e0d2]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.progress}
            aria-label="Upload progress"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-200"
              style={{ width: `${Math.max(4, state.progress)}%` }}
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Working…" : "Choose file"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm sm:hidden"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            Take photo
          </button>
        </div>
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
