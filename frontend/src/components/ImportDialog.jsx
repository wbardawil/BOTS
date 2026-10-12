import { useRef, useState } from "react";
import { api, apiErr } from "@/lib/api";
import { fieldsFor, fieldLabel } from "@/lib/fields";
import { parseCsv, toCsv, downloadText, matchHeader } from "@/lib/csv";
import { ETYPE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UploadCloud, FileDown } from "lucide-react";
import { toast } from "sonner";

/**
 * CSV import: file -> preview -> column mapping (pre-matched to the manifest) -> dry run -> commit.
 * The server (POST /organizations/{id}/import) validates, de-duplicates on name and reports per row.
 */
export default function ImportDialog({ open, setOpen, etype, orgId, onDone, locale = "en" }) {
  const rows = fieldsFor(etype, (r) => r.csv && r.type !== "readonly" && r.type !== "json" && r.section !== "hidden");
  const inputRef = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [onConflict, setOnConflict] = useState("skip");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => { setParsed(null); setMapping({}); setReport(null); setFileName(""); if (inputRef.current) inputRef.current.value = ""; };

  const onFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const p = parseCsv(text);
    if (!p.headers.length) { toast.error("The file has no header row"); return; }
    const m = {}; p.headers.forEach((h) => { m[h] = matchHeader(h, rows); });
    setParsed(p); setMapping(m); setReport(null); setFileName(file.name);
    if (p.replacementChars) toast.message("Some characters could not be decoded; save the file as UTF-8 for accents.");
  };

  const payloadRows = () => (parsed?.rows || []).map((r) => {
    const out = {};
    Object.entries(mapping).forEach(([h, k]) => { if (k && r[h] !== undefined && r[h] !== "") out[k] = r[h]; });
    return out;
  });

  const run = async (dry) => {
    setBusy(true);
    try {
      const res = await api.post(`/organizations/${orgId}/import`, { etype, rows: payloadRows(), dry_run: dry, on_conflict: onConflict, source: "csv_import" });
      setReport(res);
      if (!dry) { toast.success(`${res.counts.created} created, ${res.counts.updated} updated`); onDone && onDone(); }
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const template = () => downloadText(`${etype}-template.csv`, toCsv(rows.map((r) => r.key), [rows.reduce((o, r) => ({ ...o, [r.key]: "" }), {})]));
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const nameMapped = Object.values(mapping).includes("name");

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Import {ETYPE[etype]?.label.toLowerCase()} records from CSV</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1" data-testid="import-dialog">
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" data-testid="import-file" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button size="sm" variant="outline" data-testid="import-pick-btn" onClick={() => inputRef.current?.click()}><UploadCloud className="h-3.5 w-3.5 mr-1.5" /> Choose CSV</Button>
            <Button size="sm" variant="ghost" data-testid="import-template-btn" onClick={template}><FileDown className="h-3.5 w-3.5 mr-1.5" /> Download template</Button>
            {fileName && <span className="text-xs text-muted-foreground">{fileName} · {parsed?.rows.length} rows · delimiter "{parsed?.delimiter === "\t" ? "tab" : parsed?.delimiter}"</span>}
          </div>
          <p className="text-[11px] text-muted-foreground">Column headers are matched to fields by key or label (Spanish or English). Unmapped columns are ignored. Rows are matched to existing records by name; choose whether to skip or update them.</p>

          {parsed && (
            <>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground"><tr><th className="text-left px-3 py-2">CSV column</th><th className="text-left px-3 py-2">Maps to</th><th className="text-left px-3 py-2">First values</th></tr></thead>
                  <tbody>
                    {parsed.headers.map((h, i) => (
                      <tr key={h} className="border-t border-border">
                        <td className="px-3 py-1.5 font-medium">{h}</td>
                        <td className="px-3 py-1.5">
                          <select data-testid={`import-map-${i}`} value={mapping[h] || ""} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                            className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs">
                            <option value="">— ignore —</option>
                            {rows.map((r) => <option key={r.key} value={r.key}>{fieldLabel(r, locale)} ({r.key})</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[260px]">{parsed.rows.slice(0, 3).map((r) => r[h]).filter(Boolean).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs text-muted-foreground flex items-center gap-2">Existing records
                  <select data-testid="import-on-conflict" value={onConflict} onChange={(e) => setOnConflict(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs">
                    <option value="skip">skip</option><option value="update">update with these values</option>
                  </select>
                </label>
                <span className="text-xs text-muted-foreground">{mappedCount} of {parsed.headers.length} columns mapped{!nameMapped ? " · map a column to name" : ""}</span>
              </div>
            </>
          )}

          {report && (
            <div className="rounded-lg border border-gray-200 p-3 text-sm space-y-2" data-testid="import-report">
              <div className="flex items-center gap-4 text-xs">
                <span data-testid="import-report-created"><b>{report.counts.created}</b> {report.dry_run ? "would be created" : "created"}</span>
                <span data-testid="import-report-updated"><b>{report.counts.updated}</b> {report.dry_run ? "would be updated" : "updated"}</span>
                <span data-testid="import-report-skipped"><b>{report.counts.skipped}</b> skipped</span>
                <span data-testid="import-report-errors" className={report.counts.errors ? "text-red-600" : ""}><b>{report.counts.errors}</b> errors</span>
              </div>
              {report.errors.slice(0, 20).map((e, i) => <div key={i} className="text-xs text-red-700">Row {e.row}: {e.reason}</div>)}
              {report.skipped.slice(0, 20).map((e, i) => <div key={i} className="text-xs text-muted-foreground">Row {e.row} "{e.name}": {e.reason}</div>)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" data-testid="import-close" onClick={() => { setOpen(false); reset(); }}>Close</Button>
          <Button variant="outline" data-testid="import-dry-run-btn" disabled={!parsed || !nameMapped || busy} onClick={() => run(true)}>Dry run</Button>
          <Button data-testid="import-commit-btn" disabled={!parsed || !nameMapped || busy} onClick={() => run(false)}>{busy ? "Working…" : "Import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
