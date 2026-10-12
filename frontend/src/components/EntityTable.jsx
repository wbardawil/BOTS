import { useEffect, useState, useCallback } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { ETYPE } from "@/lib/constants";
import { StatusBadge, PhasePill, DemoTag, Empty } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Inbox } from "lucide-react";
import { toast } from "sonner";

// Minimal create fields per etype
const CREATE_FIELDS = {
  opportunity: [["name", "Name"], ["business_problem", "Business problem", "area"], ["intended_outcome", "Intended outcome", "area"], ["candidate_phase", "Candidate phase (1-3)", "num"], ["priority", "Priority"]],
  agent: [["name", "Role-based name"], ["purpose", "Purpose", "area"], ["human_owner", "Human accountable owner"], ["allowed_actions", "Allowed actions", "area"], ["prohibited_actions", "Prohibited actions", "area"]],
  workflow: [["name", "Name"], ["description", "Description", "area"]],
  system: [["name", "Name"], ["type", "Type"]],
  knowledge_source: [["name", "Name"], ["owner", "Owner"], ["freshness_rule", "Freshness rule"]],
  playbook: [["name", "Name"], ["business_problem", "Business problem", "area"], ["proposed_workflow", "Proposed workflow", "area"]],
  initiative: [["name", "Name"], ["business_problem", "Business problem", "area"], ["owner", "Owner"], ["budget", "Budget", "num"], ["currency", "Currency"]],
  adoption_assignment: [["name", "Assignment"], ["assignee", "Assignee"]],
  metric: [["name", "Name"], ["unit", "Unit"], ["definition", "Definition", "area"], ["baseline", "Baseline", "num"], ["target", "Target", "num"]],
  evidence: [["name", "Name"], ["type", "Type"], ["content", "Content", "area"]],
  decision: [["name", "Decision"], ["approver", "Approver"], ["rationale", "Rationale", "area"]],
  capability: [["name", "Name"], ["current_state", "Current state"], ["target_state", "Target state"]],
  process: [["name", "Name"], ["owner", "Owner"], ["current_state", "Current state"], ["target_state", "Target state"]],
};

export default function EntityTable({ etypes, title }) {
  const { orgId, currentOrg, setSelectedId, search } = useScope();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(etypes[0]);
  const [open, setOpen] = useState(false);

  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all(etypes.map((t) => api.get("/entities", { organization_id: orgId, etype: t })))
      .then((res) => setRows(res.flat()))
      .finally(() => setLoading(false));
  }, [orgId, etypes.join(",")]);

  useEffect(load, [load]);

  const filtered = rows.filter((r) => r.etype === tab &&
    (!search || JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="p-6 max-w-[1400px] mx-auto fade-up">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{currentOrg?.name} · live records</p>
        </div>
        {canWrite && CREATE_FIELDS[tab] && (
          <Button data-testid="entity-create-btn" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New {ETYPE[tab]?.label}
          </Button>
        )}
      </div>

      {etypes.length > 1 && (
        <div className="flex gap-2 mb-4">
          {etypes.map((t) => (
            <button key={t} data-testid={`etab-${t}`} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-sm ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {ETYPE[t]?.label}
            </button>
          ))}
        </div>
      )}

      {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
        filtered.length === 0 ? <Empty icon={Inbox} title={`No ${ETYPE[tab]?.label?.toLowerCase()} records`} hint="Create one to start building the living model." /> : (
        <div className="card-surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Owner / Assignee</th>
                <th className="text-left px-4 py-2.5 font-medium">Phase</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const owner = r.data.human_owner || r.data.owner || r.data.assignee || r.data.approver;
                const unassigned = !owner && ["agent", "process", "opportunity", "initiative"].includes(r.etype);
                return (
                  <tr key={r.id} data-testid={`row-${r.id}`} onClick={() => setSelectedId(r.id)}
                    className="border-t border-border hover:bg-accent/50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      {r.data.name || "(untitled)"} {r.is_demo && <DemoTag />}
                    </td>
                    <td className="px-4 py-3 text-foreground/75">
                      {owner || (unassigned ? <span className="text-amber-600">⚠ Unassigned</span> : <span className="text-muted-foreground">—</span>)}
                    </td>
                    <td className="px-4 py-3"><PhasePill phase={r.data.phase} /></td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.last_reviewed_at ? new Date(r.last_reviewed_at).toLocaleDateString() : <span className="text-amber-600">never</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateDialog open={open} setOpen={setOpen} etype={tab} orgId={orgId} onDone={load} />
    </div>
  );
}

function CreateDialog({ open, setOpen, etype, orgId, onDone }) {
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const fields = CREATE_FIELDS[etype] || [["name", "Name"]];

  const submit = async () => {
    if (!data.name) { toast.error("Name is required"); return; }
    setBusy(true);
    const payload = { ...data };
    fields.forEach(([k, , type]) => { if (type === "num" && payload[k] != null && payload[k] !== "") payload[k] = Number(payload[k]); });
    try {
      await api.post("/entities", { etype, organization_id: orgId, data: payload, status: "draft" });
      toast.success(`${ETYPE[etype]?.label} created (draft)`);
      setOpen(false); setData({}); onDone();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New {ETYPE[etype]?.label}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {fields.map(([k, label, type]) => (
            <div key={k} className="space-y-1.5">
              <Label>{label}</Label>
              {type === "area" ? (
                <Textarea data-testid={`field-${k}`} value={data[k] || ""} onChange={(e) => setData({ ...data, [k]: e.target.value })} />
              ) : (
                <Input data-testid={`field-${k}`} type={type === "num" ? "number" : "text"}
                  value={data[k] || ""} onChange={(e) => setData({ ...data, [k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="entity-save-btn" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Create draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
