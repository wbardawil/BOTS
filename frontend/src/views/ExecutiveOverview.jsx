import { useEffect, useState, useCallback } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { StatusBadge, Empty, SourcingBadge } from "@/components/shared";
import { PHASE_META, SOURCING } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LineChart as LineIcon, AlertTriangle, Clock, UserX, UploadCloud, Download, History } from "lucide-react";
import { toast } from "sonner";

export default function ExecutiveOverview() {
  const { orgId, currentOrg, setSelectedId } = useScope();
  const [all, setAll] = useState([]);
  const [diff, setDiff] = useState(null);
  const [snaps, setSnaps] = useState([]);
  const [pubOpen, setPubOpen] = useState(false);
  const canPublish = ["platform_admin", "workspace_admin", "company_admin"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    api.get("/entities", { organization_id: orgId }).then(setAll);
    api.get(`/organizations/${orgId}/diff`).then(setDiff).catch(() => setDiff(null));
    api.get(`/organizations/${orgId}/snapshots`).then(setSnaps).catch(() => setSnaps([]));
  }, [orgId]);
  useEffect(load, [load]);
  if (!orgId) return <Empty icon={LineIcon} title="Select a company" />;

  const agents = all.filter((e) => e.etype === "agent");
  const inits = all.filter((e) => e.etype === "initiative");
  const costed = all.filter((e) => ["agent", "workflow"].includes(e.etype));
  const cost = costRollup(costed);
  const opps = all.filter((e) => e.etype === "opportunity");
  const unassigned = all.filter((e) => ["agent", "process", "opportunity", "initiative"].includes(e.etype) &&
    !(e.data.human_owner || e.data.owner));
  const overdue = all.filter((e) => !e.last_reviewed_at);
  const missingEvidence = agents.filter((a) => (a.data.phase || 1) >= 2 &&
    !all.some((ev) => ev.etype === "evidence"));

  const exportOrg = async () => {
    try {
      const data = await api.get(`/organizations/${orgId}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${currentOrg.name}-export.json`; a.click();
      toast.success("Export downloaded (authorized)");
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto fade-up">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Executive Overview</h1>
          <p className="text-sm text-muted-foreground">{currentOrg?.name} · living model health</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" data-testid="export-btn" onClick={exportOrg}><Download className="h-4 w-4 mr-1.5" /> Export</Button>
          {canPublish && <Button size="sm" data-testid="publish-btn" onClick={() => setPubOpen(true)}><UploadCloud className="h-4 w-4 mr-1.5" /> Publish snapshot</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Agents" value={agents.length} sub={`${agents.filter(a => (a.data.phase||1)===1).length} P1 · ${agents.filter(a => a.data.phase===2).length} P2 · ${agents.filter(a => a.data.phase===3).length} P3`} />
        <Stat label="Initiatives" value={inits.length} sub={`${inits.filter(i => (i.data.status||i.status)==="in_progress").length} in progress`} />
        <Stat label="Opportunities" value={opps.length} />
        <Stat label="Records" value={all.length} sub="persisted" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <FlagCard title="Living-model flags" icon={AlertTriangle}>
          <Flag icon={UserX} label="Unassigned owners" items={unassigned} setSel={setSelectedId} color="text-amber-600" />
          <Flag icon={Clock} label="Never reviewed" items={overdue} setSel={setSelectedId} color="text-blue-600" />
          <Flag icon={AlertTriangle} label="Phase ≥2 without evidence" items={missingEvidence} setSel={setSelectedId} color="text-red-600" />
        </FlagCard>

        <div className="card-surface rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 font-medium"><History className="h-4 w-4 text-primary" /> Changes since last publication</div>
          {!diff?.has_snapshot ? <p className="text-sm text-muted-foreground">No published snapshot yet. Published history is immutable once created.</p> : (
            <div className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">Last published {new Date(diff.published_at).toLocaleString()}</p>
              <DiffRow label="Added" items={diff.added} color="text-green-600" />
              <DiffRow label="Changed" items={diff.changed} color="text-amber-600" />
              <DiffRow label="Removed" items={diff.removed} color="text-red-600" />
            </div>
          )}
          <div className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Published snapshots</div>
          <div className="mt-2 space-y-1.5">
            {snaps.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : snaps.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm card-surface rounded-md px-3 py-2">
                <span>{s.change_summary}</span>
                <span className="text-xs text-muted-foreground">{s.entity_count} records · {new Date(s.published_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-surface rounded-xl p-4 mt-4" data-testid="cost-rollup">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="font-medium">Cost of the plan</div>
          <div className="text-xs text-muted-foreground">{cost.costed} of {cost.total} agents and workflows costed · {cost.uncosted > 0 ? `${cost.uncosted} without a number yet` : "all costed"}</div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="Monthly run-rate" value={money(cost.monthly)} sub="buy + hybrid + per-use, per month" />
          <Stat label="One-off build" value={money(cost.oneOff)} sub="custom builds and setup" />
          <Stat label="Annualised" value={money(cost.monthly * 12 + cost.oneOff)} sub="12 × monthly + one-off" />
          <div className="card-surface rounded-xl p-4">
            <div className="text-sm text-foreground/80 mb-2">By sourcing</div>
            <div className="space-y-1">
              {Object.keys(SOURCING).map((k) => (
                <div key={k} className="flex items-center justify-between text-xs"><SourcingBadge value={k} /><span className="text-muted-foreground">{cost.bySourcing[k] || 0}</span></div>
              ))}
            </div>
          </div>
        </div>
        <table className="w-full text-sm mt-4">
          <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-1.5">Phase</th><th className="text-right py-1.5">Items</th><th className="text-right py-1.5">Monthly</th><th className="text-right py-1.5">One-off</th><th className="text-right py-1.5">Uncosted</th></tr></thead>
          <tbody>
            {[1, 2, 3].map((p) => (
              <tr key={p} className="border-t border-border" data-testid={`cost-phase-${p}`}>
                <td className="py-1.5" style={{ color: PHASE_META[p].hex }}>{PHASE_META[p].label}</td>
                <td className="py-1.5 text-right">{cost.byPhase[p].n}</td>
                <td className="py-1.5 text-right mono">{money(cost.byPhase[p].monthly)}</td>
                <td className="py-1.5 text-right mono">{money(cost.byPhase[p].oneOff)}</td>
                <td className="py-1.5 text-right text-muted-foreground">{cost.byPhase[p].uncosted || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-muted-foreground mt-2">Estimates entered on each record's Sourcing & Risk tab. Per-use costs are counted as monthly. Missing values stay missing, never zero.</p>
      </div>

      {pubOpen && <PublishDialog orgId={orgId} open={pubOpen} setOpen={setPubOpen} onDone={load} />}
    </div>
  );
}

function costRollup(items) {
  const r = { total: items.length, costed: 0, uncosted: 0, monthly: 0, oneOff: 0, bySourcing: {},
    byPhase: { 1: { n: 0, monthly: 0, oneOff: 0, uncosted: 0 }, 2: { n: 0, monthly: 0, oneOff: 0, uncosted: 0 }, 3: { n: 0, monthly: 0, oneOff: 0, uncosted: 0 } } };
  items.forEach((e) => {
    const d = e.data || {}; const ph = r.byPhase[d.phase] ? d.phase : 1; const bp = r.byPhase[ph]; bp.n++;
    if (d.sourcing) r.bySourcing[d.sourcing] = (r.bySourcing[d.sourcing] || 0) + 1;
    const v = Number(d.cost_estimate);
    if (d.cost_estimate === "" || d.cost_estimate == null || Number.isNaN(v)) { r.uncosted++; bp.uncosted++; return; }
    r.costed++;
    if (d.cost_period === "one_off") { r.oneOff += v; bp.oneOff += v; } else { r.monthly += v; bp.monthly += v; }
  });
  return r;
}
function money(n) { return n ? `USD ${Math.round(n).toLocaleString()}` : "—"; }
function Stat({ label, value, sub }) {
  return (
    <div className="card-surface rounded-xl p-4">
      <div className="text-3xl font-display font-bold">{value}</div>
      <div className="text-sm text-foreground/80">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
function FlagCard({ title, icon: Icon, children }) {
  return <div className="card-surface rounded-xl p-4"><div className="flex items-center gap-2 mb-3 font-medium"><Icon className="h-4 w-4 text-amber-600" /> {title}</div><div className="space-y-3">{children}</div></div>;
}
function Flag({ icon: Icon, label, items, setSel, color }) {
  return (
    <div>
      <div className={`flex items-center gap-2 text-sm ${color}`}><Icon className="h-3.5 w-3.5" /> {label} <span className="ml-auto font-semibold">{items.length}</span></div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.slice(0, 6).map((e) => (
          <button key={e.id} data-testid={`flag-${e.id}`} onClick={() => setSel(e.id)}
            className="text-[11px] rounded px-2 py-0.5 bg-muted hover:bg-accent">{e.data.name}</button>
        ))}
        {items.length === 0 && <span className="text-[11px] text-muted-foreground">none</span>}
      </div>
    </div>
  );
}
function DiffRow({ label, items, color }) {
  return <div><span className={`text-xs ${color}`}>{label} ({items.length})</span> {items.length > 0 && <span className="text-xs text-muted-foreground">{items.slice(0, 5).join(", ")}</span>}</div>;
}
function PublishDialog({ orgId, open, setOpen, onDone }) {
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/organizations/${orgId}/publish`, { change_summary: summary || "Snapshot" });
      toast.success("Published. Snapshot is now immutable.");
      setOpen(false); onDone();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Publish snapshot</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Creates an immutable snapshot of current records, layout and playbook versions. New edits continue in draft without altering history.</p>
        <Input data-testid="publish-summary" placeholder="Change summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="publish-confirm" onClick={submit} disabled={busy}>Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
