import { useEffect, useState } from "react";
import { useScope } from "@/context/ScopeContext";
import { useAuth } from "@/context/AuthContext";
import { api, apiErr } from "@/lib/api";
import { Empty } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings as Cog, ShieldCheck, Columns3, Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import { toast } from "sonner";

const ROLE_RULES = [
  "Workspace membership does not grant all company access.",
  "Parent organization access does not imply subsidiary access.",
  "Portfolio membership does not imply company permission.",
  "Platform administration is not blanket authorization to read customer business data.",
];

export default function SettingsPage() {
  const { currentOrg, currentWs, framework } = useScope();
  const { user } = useAuth();
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    if (currentOrg) api.get(`/organizations/${currentOrg.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }, [currentOrg]);

  if (!currentOrg) return <Empty icon={Cog} title="Select a company" />;

  return (
    <div className="p-6 max-w-3xl mx-auto fade-up space-y-5">
      <h1 className="font-display text-2xl font-bold">Settings & Governance</h1>

      <div className="card-surface rounded-xl p-4">
        <h3 className="font-display font-semibold mb-2">Scope</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info l="Workspace" v={currentWs?.name} />
          <Info l="Workspace kind" v={currentWs?.kind?.replace("_", " ")} />
          <Info l="Organization" v={currentOrg.name} />
          <Info l="Org kind" v={currentOrg.org_kind?.replace("_", " ")} />
          <Info l="Your role here" v={currentOrg.role?.replace("_", " ")} />
          <Info l="Your global role" v={user?.global_role?.replace("_", " ")} />
          <Info l="Currency" v={currentOrg.currency} />
          <Info l="Config" v={currentOrg.config} />
        </div>
      </div>

      <div className="card-surface rounded-xl p-4">
        <div className="flex items-center gap-2 font-display font-semibold mb-2"><ShieldCheck className="h-4 w-4 text-primary" /> Authorization model</div>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
          {ROLE_RULES.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>

      {framework && (
        <div className="card-surface rounded-xl p-4">
          <h3 className="font-display font-semibold mb-2">Framework</h3>
          <div className="text-xs text-muted-foreground mb-1">Default capability library ({framework.capabilities.length})</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {framework.capabilities.map((c) => <span key={c} className="text-[11px] rounded px-2 py-0.5 bg-muted">{c}</span>)}
          </div>
          <div className="text-xs text-muted-foreground mb-1">Methodology phases</div>
          <div className="space-y-1">
            {framework.phases.map((p) => <div key={p.n} className="text-sm"><b>Phase {p.n} · {p.name}</b> <span className="text-muted-foreground">— {p.desc}</span></div>)}
          </div>
        </div>
      )}

      <StageEditor org={currentOrg} />

      <div className="card-surface rounded-xl p-4">
        <h3 className="font-display font-semibold mb-2">Recent audit events</h3>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {audit.length === 0 ? <p className="text-sm text-muted-foreground">No events.</p> : audit.slice(0, 30).map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs card-surface rounded-md px-3 py-1.5">
              <span className="capitalize font-medium">{a.action.replace("_", " ")}</span>
              <span className="text-muted-foreground">{a.entity_type}</span>
              <span className="text-muted-foreground">· {a.user_name}</span>
              <span className="ml-auto text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Info({ l, v }) {
  return <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div><div className="text-sm capitalize">{v || "—"}</div></div>;
}

const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "stage";

function StageEditor({ org }) {
  const { bumpReload } = useScope();
  const [stages, setStages] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org) return;
    api.get(`/organizations/${org.id}/stages`).then((d) => { setStages(d.stages); setCanEdit(d.can_edit); });
  }, [org]);

  const move = (i, dir) => setStages((s) => { const n = [...s]; const j = i + dir; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const rename = (i, label) => setStages((s) => s.map((x, k) => k === i ? { ...x, label } : x));
  const toggleGate = (i) => setStages((s) => s.map((x, k) => k === i ? { ...x, gated: !x.gated } : x));
  const remove = (i) => setStages((s) => s.filter((_, k) => k !== i));
  const add = () => {
    if (!newLabel.trim()) return;
    let key = slug(newLabel); const keys = new Set(stages.map((x) => x.key));
    while (keys.has(key)) key += "_x";
    setStages((s) => [...s, { key, label: newLabel.trim(), gated: false }]); setNewLabel("");
  };
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/organizations/${org.id}/stages`, { stages });
      toast.success("Pipeline stages saved. The board and inventory now use them.");
      bumpReload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="card-surface rounded-xl p-4" data-testid="stage-editor">
      <div className="flex items-center gap-2 font-display font-semibold mb-1"><Columns3 className="h-4 w-4 text-primary" /> Pipeline stages</div>
      <p className="text-xs text-muted-foreground mb-3">Rename, reorder, add or remove the lifecycle stages for {org?.name}. Gated stages (⬥) require an accountable owner before a record can enter them. Stages that still hold records can't be removed.</p>
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s.key} data-testid={`stage-row-${s.key}`} className="flex items-center gap-2">
            <span className="text-[10px] mono text-muted-foreground w-5 text-right">{i + 1}</span>
            <Input data-testid={`stage-label-${s.key}`} value={s.label} disabled={!canEdit} onChange={(e) => rename(i, e.target.value)} className="h-8 flex-1" />
            <button data-testid={`stage-gate-${s.key}`} disabled={!canEdit} onClick={() => toggleGate(i)}
              className={`text-[11px] rounded-full border px-2 py-1 ${s.gated ? "border-amber-300 bg-amber-50 text-amber-700" : "border-border text-muted-foreground"}`}>
              {s.gated ? "⬥ Gated" : "Open"}
            </button>
            {canEdit && <>
              <button data-testid={`stage-up-${s.key}`} onClick={() => move(i, -1)} className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-accent"><ChevronUp className="h-3.5 w-3.5" /></button>
              <button data-testid={`stage-down-${s.key}`} onClick={() => move(i, 1)} className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-accent"><ChevronDown className="h-3.5 w-3.5" /></button>
              <button data-testid={`stage-remove-${s.key}`} onClick={() => remove(i)} className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-accent text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </>}
          </div>
        ))}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2 mt-3">
          <Input data-testid="stage-new-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New stage name" className="h-8 w-48" />
          <Button size="sm" variant="outline" data-testid="stage-add" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
          <Button size="sm" data-testid="stage-save" onClick={save} disabled={busy} className="ml-auto"><Save className="h-3.5 w-3.5 mr-1" /> Save stages</Button>
        </div>
      ) : <p className="text-[11px] text-muted-foreground mt-2">Read-only — only company admins can edit stages.</p>}
    </div>
  );
}
