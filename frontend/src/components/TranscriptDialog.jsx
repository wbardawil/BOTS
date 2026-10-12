import { useRef, useState } from "react";
import { api, apiErr } from "@/lib/api";
import { labelFor } from "@/lib/fields";
import { AREA_BY_KEY } from "@/lib/constants";
import { AiTag } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UploadCloud, Sparkles } from "lucide-react";
import { toast } from "sonner";

const MAX_CHARS = 60000;

/**
 * Transcript -> AI draft of intake items -> pick rows -> import as initiatives (source: transcript).
 * Nothing is saved until the consultant imports the selected rows; the draft itself is never stored.
 */
export default function TranscriptDialog({ open, setOpen, orgId, onDone, locale = "en", aiEnabled = true }) {
  const fileRef = useRef(null);
  const [text, setText] = useState("");
  const [raisedBy, setRaisedBy] = useState("");
  const [raisedByRole, setRaisedByRole] = useState("");
  const [draft, setDraft] = useState(null);
  const [items, setItems] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setText(""); setRaisedBy(""); setRaisedByRole(""); setDraft(null); setItems([]); setReport(null); if (fileRef.current) fileRef.current.value = ""; };

  const onFile = async (file) => {
    if (!file) return;
    const t = await file.text();
    setText(t.slice(0, MAX_CHARS));
    if (t.length > MAX_CHARS) toast.message(`Transcript trimmed to ${MAX_CHARS.toLocaleString()} characters`);
  };

  const extract = async () => {
    if (text.trim().length < 40) { toast.error("Paste at least a few sentences"); return; }
    setBusy(true);
    try {
      const d = await api.post("/ai/extract-intake", { organization_id: orgId, text, raised_by: raisedBy || undefined, raised_by_role: raisedByRole || undefined });
      setDraft(d);
      setItems((d.content?.items || []).map((it) => ({ ...it, _on: true })));
      if (!(d.content?.items || []).length) toast.message("No items found in this text");
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const chosen = items.filter((i) => i._on && i.name?.trim());

  const doImport = async () => {
    setBusy(true);
    try {
      const rows = chosen.map(({ _on, ...it }) => Object.fromEntries(Object.entries(it).filter(([, v]) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length))));
      const res = await api.post(`/organizations/${orgId}/import`, { etype: "initiative", rows, dry_run: false, on_conflict: "skip", source: "transcript" });
      setReport(res);
      toast.success(`${res.counts.created} created, ${res.counts.skipped} skipped`);
      onDone && onDone();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const setItem = (i, patch) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Capture from a transcript</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1" data-testid="transcript-dialog">
          {!draft && (
            <>
              <p className="text-xs text-muted-foreground">Paste the notes or transcript of a leadership conversation. The AI drafts one row per initiative, pain point or slow task it finds, with the sentence that supports it. You choose what to keep.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept=".txt,.md,.vtt,.srt,text/plain" className="hidden" data-testid="transcript-file" onChange={(e) => onFile(e.target.files?.[0])} />
                <Button size="sm" variant="outline" data-testid="transcript-pick-btn" onClick={() => fileRef.current?.click()}><UploadCloud className="h-3.5 w-3.5 mr-1.5" /> Load .txt</Button>
                <Input data-testid="transcript-raised-by" value={raisedBy} onChange={(e) => setRaisedBy(e.target.value)} placeholder="Raised by (default for every row)" className="h-8 w-56 text-sm" />
                <Input data-testid="transcript-raised-by-role" value={raisedByRole} onChange={(e) => setRaisedByRole(e.target.value)} placeholder="Their role" className="h-8 w-44 text-sm" />
                <span className="ml-auto text-[11px] text-muted-foreground mono">{text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
              </div>
              <textarea data-testid="transcript-text" value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))} rows={12}
                placeholder="CEO: Cada mes perdemos una semana con el archivo de comisiones…" className="w-full rounded-md border border-input bg-white p-2 text-sm font-mono leading-relaxed" />
            </>
          )}
          {draft && !report && (
            <>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><AiTag /> Draft from {draft.model || "the AI provider"} · {items.length} items · nothing is saved until you import</div>
              {draft.assumptions && <p className="text-[11px] text-muted-foreground italic">{draft.assumptions}</p>}
              <div className="rounded-lg border border-gray-200 overflow-hidden" data-testid="transcript-items">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                    <tr><th className="w-8 px-2 py-2"></th><th className="text-left px-2 py-2">Name</th><th className="text-left px-2 py-2">Kind</th><th className="text-left px-2 py-2">Area</th><th className="text-left px-2 py-2">Frequency · hours · people</th><th className="text-left px-2 py-2">Evidence</th></tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} data-testid={`transcript-item-${i}`} className={`border-t border-gray-100 ${it._on ? "" : "opacity-50"}`}>
                        <td className="px-2 py-1.5 align-top"><Checkbox data-testid={`transcript-check-${i}`} checked={!!it._on} onCheckedChange={(v) => setItem(i, { _on: !!v })} /></td>
                        <td className="px-2 py-1.5 align-top min-w-[200px]"><Input data-testid={`transcript-name-${i}`} value={it.name || ""} onChange={(e) => setItem(i, { name: e.target.value })} className="h-7 text-xs" /></td>
                        <td className="px-2 py-1.5 align-top whitespace-nowrap">{labelFor("initiative", "intake_kind", it.intake_kind, locale) || "—"}</td>
                        <td className="px-2 py-1.5 align-top whitespace-nowrap">{AREA_BY_KEY[it.area]?.label || "—"}</td>
                        <td className="px-2 py-1.5 align-top whitespace-nowrap mono">{[labelFor("initiative", "frequency", it.frequency, locale), it.time_per_occurrence_hours ? `${it.time_per_occurrence_hours} h` : null, it.people_involved ? `${it.people_involved} p` : null].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-2 py-1.5 align-top text-muted-foreground italic max-w-[280px]">{it.evidence_quote ? `“${it.evidence_quote}”` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {report && (
            <div className="rounded-lg border border-gray-200 p-3 text-sm space-y-1" data-testid="transcript-report">
              <div><b>{report.counts.created}</b> created · <b>{report.counts.skipped}</b> skipped (already existed) · <b>{report.counts.errors}</b> errors</div>
              {report.errors.map((e, i) => <div key={i} className="text-xs text-red-600">Row {e.row} · {e.field}: {e.reason}</div>)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" data-testid="transcript-close" onClick={() => { setOpen(false); reset(); }}>Close</Button>
          {!draft && <Button data-testid="transcript-extract-btn" disabled={busy || !aiEnabled || text.trim().length < 40} onClick={extract}><Sparkles className="h-3.5 w-3.5 mr-1.5" /> {busy ? "Reading…" : aiEnabled ? "Extract items" : "No AI provider"}</Button>}
          {draft && !report && <Button data-testid="transcript-import-btn" disabled={busy || !chosen.length} onClick={doImport}>{busy ? "Importing…" : `Import ${chosen.length} item${chosen.length === 1 ? "" : "s"}`}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
