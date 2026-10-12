import { useEffect, useState, useCallback } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { Empty } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

export default function Assessment() {
  const { orgId, currentOrg } = useScope();
  const [a, setA] = useState(null);
  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    api.get(`/organizations/${orgId}/assessment`).then(setA);
  }, [orgId]);
  useEffect(load, [load]);
  if (!orgId) return <Empty icon={ClipboardCheck} title="Select a company" />;
  if (!a) return <p className="p-6 text-muted-foreground">Loading…</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto fade-up">
      <h1 className="font-display text-2xl font-bold">Assessment</h1>
      <p className="text-sm text-muted-foreground mb-4">Rate 1–5 per dimension. Unknown values are excluded from scoring — never treated as zero.</p>

      <div className="card-surface rounded-xl p-4 mb-5 flex items-center gap-6">
        <div>
          <div className="text-3xl font-display font-bold text-primary">{a.score?.average ?? "—"}</div>
          <div className="text-xs text-muted-foreground">avg of {a.score?.counted || 0} answered</div>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>Unknown: <b className="text-amber-600">{a.score?.unknown || 0}</b> (excluded)</div>
          <div>Not applicable: <b>{a.score?.not_applicable || 0}</b></div>
          <div className="italic">Readiness is separate from priority, progress and realized value.</div>
        </div>
      </div>

      <div className="space-y-3">
        {a.dimensions.map((dim) => (
          <DimRow key={dim} dim={dim} answer={a.answers?.[dim]} orgId={orgId} canWrite={canWrite} onSaved={setA} />
        ))}
      </div>
    </div>
  );
}

function DimRow({ dim, answer, orgId, canWrite, onSaved }) {
  const [resp, setResp] = useState(answer?.response ?? "");
  const [unknown, setUnknown] = useState(answer?.unknown ?? false);
  const [na, setNa] = useState(answer?.not_applicable ?? false);
  const [notes, setNotes] = useState(answer?.notes ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api.put(`/organizations/${orgId}/assessment`, {
        dimension: dim, response: unknown || na ? null : (resp === "" ? null : Number(resp)),
        unknown, not_applicable: na, notes, assessor: "You", confidence: "medium", evidence: "",
      });
      onSaved(updated); setOpen(false);
      toast.success(`Saved: ${dim}`);
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="card-surface rounded-xl p-4" data-testid={`assess-${dim}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">{dim}</div>
          <div className="text-xs text-muted-foreground">
            {answer ? (answer.unknown ? <span className="text-amber-600">Unknown</span> : answer.not_applicable ? "Not applicable" : `Score: ${answer.response}`) : "Not answered"}
          </div>
        </div>
        {canWrite && <Button size="sm" variant="outline" data-testid={`assess-edit-${dim}`} onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</Button>}
      </div>
      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="flex items-center gap-4">
            <Input type="number" min={1} max={5} disabled={unknown || na} data-testid={`assess-score-${dim}`}
              value={resp} onChange={(e) => setResp(e.target.value)} className="w-24" placeholder="1-5" />
            <label className="flex items-center gap-1.5 text-sm"><Checkbox checked={unknown} data-testid={`assess-unknown-${dim}`} onCheckedChange={setUnknown} /> Unknown</label>
            <label className="flex items-center gap-1.5 text-sm"><Checkbox checked={na} onCheckedChange={setNa} /> N/A</label>
          </div>
          <Textarea placeholder="Notes / evidence" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button size="sm" data-testid={`assess-save-${dim}`} onClick={save} disabled={busy}>Save</Button>
        </div>
      )}
    </div>
  );
}
