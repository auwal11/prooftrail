"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CaseNoteView } from "@/lib/domain";

export function CaseNotes({ caseId, notes }: { caseId: string; notes: CaseNoteView[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  async function addNote() {
    if (!body.trim()) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/cases/${caseId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "Could not save the note."); return; }
      setBody(""); router.refresh();
    } catch { setError("Network error. Try again."); } finally { setBusy(false); }
  }

  async function saveEdit(id: string) {
    if (!editingBody.trim()) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/notes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: editingBody }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "Could not update the note."); return; }
      setEditingId(null); setEditingBody(""); router.refresh();
    } catch { setError("Network error. Try again."); } finally { setBusy(false); }
  }

  async function removeNote(id: string) {
    if (!window.confirm("Delete this private note?")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "Could not delete the note."); return; }
      router.refresh();
    } catch { setError("Network error. Try again."); } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="text-[11.5px] leading-relaxed text-muted">Private to your account. Notes are not included in reports.</p>
      <div className="mt-3 flex flex-col gap-2">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} className="input min-h-20 resize-y" placeholder="Add a private reminder or follow-up detail…" maxLength={2000} />
        <button type="button" className="btn btn-primary btn-sm self-start" disabled={busy || !body.trim()} onClick={addNote}>{busy ? "Saving…" : "Add private note"}</button>
      </div>
      {error ? <p className="mt-2 text-[11.5px] text-danger">{error}</p> : null}
      {notes.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-line bg-[#fbfaf5] p-3">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea className="input min-h-20 resize-y" value={editingBody} onChange={(event) => setEditingBody(event.target.value)} maxLength={2000} />
                  <div className="flex gap-2"><button type="button" className="btn btn-primary btn-sm" disabled={busy || !editingBody.trim()} onClick={() => saveEdit(note.id)}>Save</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancel</button></div>
                </div>
              ) : <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-body">{note.body}</p>}
              <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-muted">
                <span>{note.authorName} · {new Date(note.createdAt).toLocaleString()}</span>
                <span className="flex gap-2"><button type="button" className="font-semibold text-brand hover:underline" disabled={busy} onClick={() => { setEditingId(note.id); setEditingBody(note.body); }}>Edit</button><button type="button" className="font-semibold text-danger hover:underline" disabled={busy} onClick={() => removeNote(note.id)}>Delete</button></span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
