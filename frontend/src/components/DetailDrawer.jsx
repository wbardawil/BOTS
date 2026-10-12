import { useEffect, useState, useCallback } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { ETYPE, SELECT_FIELDS, NUMERIC_FIELDS, SOURCING_RISK_KEYS, SOURCING, COST_PERIODS, RISK_LEVELS, DATA_SENSITIVITY } from "@/lib/constants";
import { StatusBadge, PhasePill, DemoTag, AiTag, Field, SourcingBadge, RiskDot } from "@/components/shared";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pencil, Save, X, ArrowUpRight, Sparkles, CheckCircle2, ArrowRight, ShieldAlert, Clock, Link2, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";

const BASE_TABS = ["Overview", "Responsibilities", "Workflow", "Dependencies", "Playbook",
  "Implementation", "Adoption", "Metrics", "Decisions", "History"];

export default function DetailDrawer() {
  const { selectedId, setSelectedId, currentOrg } = useScope();
  const [ent, setEnt] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [audit, setAudit] = useState([]);
  const [phaseOpen, setPhaseOpen] = useState(false);

  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);
  const tabs = (() => {
    if (!ent) return BASE_TABS;
    const t = [...BASE_TABS];
    const after = (anchor, name) => t.splice(t.indexOf(anchor) + 1, 0, name);
    if (["agent", "workflow"].includes(ent.etype)) after("Implementation", "Sourcing & Risk");
    if (["initiative", "agent"].includes(ent.etype)) after(["agent", "workflow"].includes(ent.etype) ? "Sourcing & Risk" : "Implementation", "Roadmap");
    return t;
  })();

  const load = useCallback(() => {
    if (!selectedId) return;
    api.get(`/entities/${selectedId}`).then((e) => { setEnt(e); setForm(e.data); });
  }, [selectedId]);

  useEffect(() => { if (selectedId) { setTab("Overview"); setEdit(false); load(); } }, [selectedId, load]);
  useEffect(() => {
    if (ent && tab === "History" && currentOrg)
      api.get(`/organizations/${ent.organization_id}/audit`).then((a) =>
        setAudit(a.filter((x) => x.entity_id === ent.id))).catch(() => {});
  }, [tab, ent, currentOrg]);

  if (!selectedId) return null;
  const meta = ent ? ETYPE[ent.etype] : null;
  const Icon = meta?.icon;

  const save = async () => {
    try {
      const data = { ...form };
      NUMERIC_FIELDS.forEach((k) => { if (data[k] === "" || data[k] == null) return; const n = Number(data[k]); if (!Number.isNaN(n)) data[k] = n; });
      const upd = await api.put(`/entities/${ent.id}`, { data, version: ent.version });
      setEnt({ ...upd, relationships: ent.relationships }); setEdit(false);
      toast.success("Saved. Live views now reflect this change.");
    } catch (e) {
      toast.error(apiErr(e.response?.data?.detail));
      if (e.response?.status === 409) load();
    }
  };

  const review = async () => {
    await api.post(`/entities/${ent.id}/review`); load();
    toast.success("Marked reviewed");
  };

  return (
    <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col gap-0" data-testid="detail-drawer">
        <SheetTitle className="sr-only">Record detail</SheetTitle>
        {!ent ? <div className="p-6 text-muted-foreground">Loading…</div> : (
          <>
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `hsl(${meta.color} / 0.15)` }}>
                    {Icon && <Icon className="h-5 w-5" style={{ color: `hsl(${meta.color})` }} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                      {ent.is_demo && <DemoTag />}
                    </div>
                    {edit ? (
                      <Input className="mt-1 font-display font-bold" value={form.name || ""}
                        onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    ) : (
                      <h2 className="font-display text-xl font-bold leading-tight truncate" data-testid="drawer-title">{ent.data.name}</h2>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={ent.status} />
                      <PhasePill phase={ent.data.phase} />
                      <SourcingBadge value={ent.data.sourcing} />
                      <RiskDot level={ent.data.risk_level} label />
                      <span className="text-[11px] text-muted-foreground mono">v{ent.version}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              {canWrite && (
                <div className="flex gap-2 mt-4">
                  {!edit ? (
                    <Button size="sm" variant="outline" data-testid="drawer-edit-btn" onClick={() => setEdit(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" data-testid="drawer-save-btn" onClick={save}><Save className="h-3.5 w-3.5 mr-1.5" /> Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEdit(false); setForm(ent.data); }}>Cancel</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" data-testid="drawer-review-btn" onClick={review}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark reviewed
                  </Button>
                  {["agent", "initiative"].includes(ent.etype) && (
                    <Button size="sm" variant="outline" data-testid="phase-advance-btn" onClick={() => setPhaseOpen(true)}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Advance phase
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* tab bar */}
            <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
              {tabs.map((t) => (
                <button key={t} data-testid={`dtab-${t}`} onClick={() => setTab(t)}
                  className={`px-2.5 py-1 rounded text-xs whitespace-nowrap ${tab === t ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <TabBody tab={tab} ent={ent} form={form} setForm={setForm} edit={edit}
                audit={audit} reload={load} canWrite={canWrite} />
            </div>

            {phaseOpen && <PhaseDialog ent={ent} open={phaseOpen} setOpen={setPhaseOpen} onDone={load} />}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const HIDE_KEYS = ["name", "phase", "steps", "evidence_ids", "target_entity"];

function TabBody({ tab, ent, form, setForm, edit, audit, reload, canWrite }) {
  const { setSelectedId } = useScope();
  const d = ent.data;
  const rels = ent.relationships || [];

  const EditableFields = ({ keys }) => (
    <div className="grid gap-3">
      {keys.filter((k) => k in d || edit).map((k) => (
        <div key={k} className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, " ")}</Label>
          {edit ? (
            SELECT_FIELDS[k] ? (
              <select data-testid={`edit-${k}`} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                <option value="">—</option>
                {SELECT_FIELDS[k].map((o) => <option key={o} value={o}>{optionLabel(k, o)}</option>)}
              </select>
            ) : (typeof d[k] === "string" && d[k]?.length > 40) || ["purpose", "rationale", "content", "business_problem", "proposed_workflow", "cost_notes", "risk_notes", "required_controls"].includes(k) ? (
              <Textarea data-testid={`edit-${k}`} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            ) : (
              <Input data-testid={`edit-${k}`} type={NUMERIC_FIELDS.includes(k) ? "number" : "text"} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            )
          ) : (
            <div className="text-sm text-foreground/90">{SELECT_FIELDS[k] && d[k] ? optionLabel(k, d[k]) : fmt(d[k])}</div>
          )}
        </div>
      ))}
    </div>
  );

  if (tab === "Overview") {
    const keys = Object.keys(d).filter((k) => !HIDE_KEYS.includes(k) &&
      !["allowed_actions", "prohibited_actions", "human_owner", "operational_owner", "approval_requirements", "escalation"].includes(k) &&
      !SOURCING_RISK_KEYS.includes(k));
    return (
      <div className="space-y-5">
        <EditableFields keys={keys.length ? keys : ["description"]} />
        <AiAssist ent={ent} />
      </div>
    );
  }
  if (tab === "Responsibilities")
    return <EditableFields keys={["human_owner", "operational_owner", "owner", "assignee", "approver", "allowed_actions", "prohibited_actions", "approval_requirements", "escalation", "exceptions"]} />;
  if (tab === "Workflow") {
    const steps = d.steps;
    if (!steps) return <Muted>No workflow steps on this record. Open a Workflow record to see ordered steps.</Muted>;
    return (
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="card-surface rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold">{i + 1}</span>
              <span className="uppercase tracking-wide text-muted-foreground">{s.actor}</span>
              {s.approval && <span className="text-amber-600 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> approval</span>}
            </div>
            <div className="mt-2 text-sm"><b>{s.action}</b></div>
            <div className="text-xs text-muted-foreground mt-1">in: {s.input} · out: {s.output} {s.handoff && `· → ${s.handoff}`}</div>
            {s.exception_route && <div className="text-xs text-destructive mt-1">exception: {s.exception_route}</div>}
          </li>
        ))}
      </ol>
    );
  }
  if (tab === "Dependencies") {
    if (!rels.length) return <Muted>No explicit relationships. Impact analysis is based on explicit relationships only.</Muted>;
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">Directly linked records (click to navigate the connected model):</p>
        {rels.map((r) => {
          const otherId = r.from_id === ent.id ? r.to_id : r.from_id;
          const dir = r.from_id === ent.id ? "→" : "←";
          return (
            <button key={r.id} data-testid={`rel-${otherId}`} onClick={() => setSelectedId(otherId)}
              className="w-full flex items-center justify-between card-surface rounded-lg px-3 py-2.5 hover:bg-accent transition-colors text-left">
              <span className="flex items-center gap-2 text-sm">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                <span className="mono text-xs text-muted-foreground">{dir} {r.rel_type.replace(/_/g, " ")}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    );
  }
  if (tab === "Playbook") {
    if (ent.etype === "playbook") return <EditableFields keys={["source_type", "intended_outcome", "prerequisites", "proposed_workflow", "implementation_steps", "acceptance_criteria", "measurement", "fallback", "version"]} />;
    const pb = rels.find((r) => r.to_type === "playbook" || r.from_type === "playbook");
    return pb ? (
      <button data-testid="goto-playbook" onClick={() => setSelectedId(pb.from_type === "playbook" ? pb.from_id : pb.to_id)}
        className="card-surface rounded-lg p-3 w-full text-left hover:bg-accent">Open linked playbook →</button>
    ) : <Muted>No playbook linked to this record.</Muted>;
  }
  if (tab === "Implementation")
    return <EditableFields keys={["implementation_status", "status", "trigger", "inputs", "outputs", "deliverables", "start_date", "target_date", "budget", "currency"]} />;
  if (tab === "Sourcing & Risk")
    return (
      <div className="space-y-6" data-testid="sourcing-risk-tab">
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Sourcing decision</div>
            <div className="flex items-center gap-2"><SourcingBadge value={d.sourcing} />{d.cost_estimate != null && d.cost_estimate !== "" && <span className="text-xs text-gray-600 mono">{d.currency || "USD"} {Number(d.cost_estimate).toLocaleString()} {COST_PERIODS[d.cost_period] || ""}</span>}</div>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">Buy a vendor product, build it in-house, or run a hybrid. Record the vendor or platform and what it costs so the roadmap carries real numbers.</p>
          <EditableFields keys={["sourcing", "vendor", "cost_estimate", "cost_period", "currency", "cost_notes"]} />
        </section>
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Risk overlay</div>
            <RiskDot level={d.risk_level} label />
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">Risk, compliance and control notes live on the workflow, not in a separate exercise. Flags are illustrative, not legal advice.</p>
          <EditableFields keys={["risk_level", "risk_category", "data_sensitivity", "regulatory_flags", "required_controls", "risk_notes"]} />
        </section>
      </div>
    );
  if (tab === "Adoption") {
    const a = rels.filter((r) => r.to_type === "adoption_assignment" || r.from_type === "adoption_assignment");
    return a.length ? a.map((r) => {
      const id = r.from_type === "adoption_assignment" ? r.from_id : r.to_id;
      return <button key={r.id} onClick={() => setSelectedId(id)} className="card-surface rounded-lg p-3 w-full text-left hover:bg-accent mb-2">Open adoption assignment →</button>;
    }) : <Muted>No adoption assignments linked. Learning completion ≠ operational readiness.</Muted>;
  }
  if (tab === "Metrics") {
    if (ent.etype === "metric") return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Baseline">{fmt(d.baseline)}</Field><Field label="Target">{fmt(d.target)}</Field>
        <Field label="Observation">{fmt(d.observation)}</Field><Field label="Verification">{fmt(d.verification_status)}</Field>
        <Field label="Unit">{fmt(d.unit)}</Field><Field label="Period">{fmt(d.period)}</Field>
      </div>
    );
    const m = rels.filter((r) => r.to_type === "metric" || r.from_type === "metric");
    return m.length ? m.map((r) => {
      const id = r.from_type === "metric" ? r.from_id : r.to_id;
      return <button key={r.id} onClick={() => setSelectedId(id)} className="card-surface rounded-lg p-3 w-full text-left hover:bg-accent mb-2">Open linked metric →</button>;
    }) : <Muted>No metrics linked. Missing values remain missing — never zero.</Muted>;
  }
  if (tab === "Decisions") {
    const dec = rels.filter((r) => r.to_type === "decision" || r.from_type === "decision");
    return dec.length ? dec.map((r) => {
      const id = r.from_type === "decision" ? r.from_id : r.to_id;
      return <button key={r.id} onClick={() => setSelectedId(id)} className="card-surface rounded-lg p-3 w-full text-left hover:bg-accent mb-2">Open decision record →</button>;
    }) : <Muted>No decisions recorded for this record.</Muted>;
  }
  if (tab === "Roadmap")
    return <RoadmapTab ent={ent} reload={reload} canWrite={canWrite} setSel={setSelectedId} />;
  if (tab === "History")
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Version">v{ent.version} (optimistic concurrency)</Field>
          <Field label="Last reviewed">{ent.last_reviewed_at ? new Date(ent.last_reviewed_at).toLocaleString() : "never"}</Field>
          <Field label="Created">{new Date(ent.created_at).toLocaleString()}</Field>
          <Field label="Updated">{new Date(ent.updated_at).toLocaleString()}</Field>
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mt-4">Audit log</div>
        {audit.length === 0 ? <Muted>No audit events.</Muted> : audit.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm card-surface rounded-md px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="capitalize">{a.action.replace("_", " ")}</span>
            <span className="text-muted-foreground">by {a.user_name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  return null;
}

function optionLabel(k, o) {
  if (k === "sourcing") return SOURCING[o]?.label || o;
  if (k === "cost_period") return COST_PERIODS[o] || o;
  if (k === "risk_level") return RISK_LEVELS[o]?.label || o;
  if (k === "data_sensitivity") return DATA_SENSITIVITY[o] || o;
  return String(o).replace(/_/g, " ");
}

function AiAssist({ ent }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(null);
  useEffect(() => { api.get("/ai/status").then((s) => setEnabled(s.enabled)).catch(() => setEnabled(false)); }, []);
  const kind = ent.etype === "agent" ? "agent_spec" : ent.etype === "opportunity" ? "opportunity" : "prerequisites";
  const gen = async () => {
    setBusy(true);
    try {
      const d = await api.post("/ai/suggest", {
        organization_id: ent.organization_id, kind,
        context: JSON.stringify(ent.data).slice(0, 1500),
      });
      setDraft(d);
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <div className="card-surface rounded-lg p-3 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> AI assistance</div>
        <Button size="sm" variant="outline" data-testid="ai-suggest-btn" disabled={!enabled || busy} onClick={gen}>
          {enabled === false ? "No provider" : busy ? "Drafting…" : "Suggest"}
        </Button>
      </div>
      {enabled === false && <p className="text-xs text-muted-foreground mt-2">AI provider not configured — generation disabled.</p>}
      {draft && (
        <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-1.5"><AiTag /><span className="text-[11px] text-muted-foreground">Requires human acceptance · never auto-published</span></div>
          <p className="text-sm whitespace-pre-wrap text-foreground/85">{draft.content}</p>
          <p className="text-[11px] text-muted-foreground mt-2 italic">{draft.assumptions}</p>
        </div>
      )}
    </div>
  );
}

function PhaseDialog({ ent, open, setOpen, onDone }) {
  const [toPhase, setToPhase] = useState((ent.data.phase || 0) + 1);
  const [approver, setApprover] = useState("");
  const [rationale, setRationale] = useState("");
  const [criteria, setCriteria] = useState(false);
  const [evidence, setEvidence] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/entities", { organization_id: ent.organization_id, etype: "evidence" }).then(setEvidence);
  }, [ent]);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/entities/${ent.id}/advance-phase`, {
        to_phase: Number(toPhase), approver, evidence_ids: chosen,
        criteria_met: criteria, rationale, version: ent.version,
      });
      toast.success(`Advanced to Phase ${toPhase}. Decision + evidence recorded.`);
      setOpen(false); onDone();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Phase gate — advance "{ent.data.name}"</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Advancement requires criteria met, evidence, and a named approver. Methodology phase is separate from deployment status.</p>
          <div className="space-y-1.5"><Label>Target phase</Label>
            <Input type="number" min={1} max={3} data-testid="phase-target" value={toPhase} onChange={(e) => setToPhase(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Named approver</Label>
            <Input data-testid="phase-approver" value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="e.g. Avery Stone" /></div>
          <div className="space-y-1.5"><Label>Rationale</Label>
            <Textarea data-testid="phase-rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Evidence</Label>
            {evidence.length === 0 ? <p className="text-xs text-muted-foreground">No evidence records yet — create one in Metrics & Evidence first.</p> :
              evidence.map((ev) => (
                <label key={ev.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={chosen.includes(ev.id)} data-testid={`phase-ev-${ev.id}`}
                    onCheckedChange={(v) => setChosen(v ? [...chosen, ev.id] : chosen.filter((x) => x !== ev.id))} />
                  {ev.data.name}
                </label>
              ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={criteria} data-testid="phase-criteria" onCheckedChange={setCriteria} /> Phase gate criteria met
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="phase-submit" onClick={submit} disabled={busy}>Record decision & advance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Muted = ({ children }) => <p className="text-sm text-muted-foreground">{children}</p>;

const ADOPT_STATES = ["assigned", "in progress", "submitted", "reviewed", "accepted"];

function RoadmapTab({ ent, reload, canWrite, setSel }) {
  const d = ent.data;
  const [cands, setCands] = useState([]);
  const [names, setNames] = useState({});
  const [accText, setAccText] = useState("");
  const [adoptText, setAdoptText] = useState("");
  const [fields, setFields] = useState({ owner: d.owner || "", status: d.status || "", deliverable: d.deliverable || d.deliverables || "", target_date: d.target_date || "" });

  useEffect(() => {
    api.get("/entities", { organization_id: ent.organization_id }).then((es) => {
      setNames(Object.fromEntries(es.map((e) => [e.id, e.data.name])));
      setCands(es.filter((e) => ["initiative", "agent"].includes(e.etype) && e.id !== ent.id));
    });
  }, [ent]);

  const deps = (ent.relationships || []).filter((r) => r.rel_type === "depends_on" && r.from_id === ent.id);
  const acc = d.acceptance_items || [];
  const adopt = d.adoption_items || [];

  const saveData = async (partial) => {
    try { await api.put(`/entities/${ent.id}`, { data: partial, version: ent.version }); reload(); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); reload(); }
  };
  const addDep = async (toId) => {
    if (!toId) return;
    try { await api.post("/relationships", { from_id: ent.id, to_id: toId, rel_type: "depends_on" }); toast.success("Dependency linked"); reload(); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  const removeDep = async (rid) => { await api.del(`/relationships/${rid}`); reload(); };

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
  const addAcc = () => { if (!accText.trim()) return; saveData({ acceptance_items: [...acc, { id: uid(), text: accText.trim(), done: false }] }); setAccText(""); };
  const toggleAcc = (id) => saveData({ acceptance_items: acc.map((x) => x.id === id ? { ...x, done: !x.done } : x) });
  const rmAcc = (id) => saveData({ acceptance_items: acc.filter((x) => x.id !== id) });
  const addAdopt = () => { if (!adoptText.trim()) return; saveData({ adoption_items: [...adopt, { id: uid(), text: adoptText.trim(), state: "assigned" }] }); setAdoptText(""); };
  const cycleAdopt = (id) => saveData({ adoption_items: adopt.map((x) => x.id === id ? { ...x, state: ADOPT_STATES[(ADOPT_STATES.indexOf(x.state) + 1) % ADOPT_STATES.length] } : x) });
  const rmAdopt = (id) => saveData({ adoption_items: adopt.filter((x) => x.id !== id) });

  const linkedIds = new Set(deps.map((r) => r.to_id));

  return (
    <div className="space-y-5">
      {/* quick fields */}
      <div className="grid grid-cols-2 gap-2">
        {[["owner", "Owner"], ["status", "Status"], ["deliverable", "Deliverable"], ["target_date", "Target date"]].map(([k, l]) => (
          <div key={k} className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</Label>
            <Input data-testid={`rm-${k}`} disabled={!canWrite} value={fields[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      {canWrite && <Button size="sm" data-testid="rm-save-fields" onClick={() => saveData(fields)}>Save fields</Button>}

      {/* Dependencies */}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Dependencies</div>
        <div className="space-y-1.5">
          {deps.length === 0 && <Muted>No dependency links.</Muted>}
          {deps.map((r) => (
            <div key={r.id} className="flex items-center justify-between card-surface rounded-md px-2.5 py-1.5 text-sm">
              <button data-testid={`rm-dep-${r.to_id}`} onClick={() => setSel(r.to_id)} className="flex items-center gap-1.5 hover:text-primary"><Link2 className="h-3.5 w-3.5 text-primary" /> {names[r.to_id] || r.to_id}</button>
              {canWrite && <button data-testid={`rm-dep-rm-${r.id}`} onClick={() => removeDep(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
        </div>
        {canWrite && (
          <select data-testid="rm-dep-add" onChange={(e) => { addDep(e.target.value); e.target.value = ""; }}
            className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm">
            <option value="">+ Add dependency…</option>
            {cands.filter((c) => !linkedIds.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.data.name} ({c.etype})</option>)}
          </select>
        )}
      </div>

      {/* Acceptance criteria checklist */}
      <Checklist title="Acceptance criteria" items={acc} canWrite={canWrite} testid="acc"
        text={accText} setText={setAccText} onAdd={addAcc}
        renderItem={(x) => (
          <label className="flex items-center gap-2 text-sm flex-1">
            <Checkbox checked={x.done} data-testid={`rm-acc-${x.id}`} disabled={!canWrite} onCheckedChange={() => toggleAcc(x.id)} />
            <span className={x.done ? "line-through text-muted-foreground" : ""}>{x.text}</span>
          </label>
        )} onRemove={rmAcc} />

      {/* Adoption checklist */}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Adoption checklist <span className="text-[10px] normal-case italic">— completion ≠ operational readiness</span></div>
        <div className="space-y-1.5">
          {adopt.length === 0 && <Muted>No adoption tasks.</Muted>}
          {adopt.map((x) => (
            <div key={x.id} className="flex items-center gap-2 card-surface rounded-md px-2.5 py-1.5 text-sm">
              <span className="flex-1">{x.text}</span>
              <button data-testid={`rm-adopt-${x.id}`} disabled={!canWrite} onClick={() => cycleAdopt(x.id)}
                className={`rounded-full px-2 py-0.5 text-[11px] border capitalize ${x.state === "accepted" ? "border-green-200 text-green-700 bg-green-50" : "border-blue-200 text-blue-700 bg-blue-50"}`}>{x.state}</button>
              {canWrite && <button data-testid={`rm-adopt-rm-${x.id}`} onClick={() => rmAdopt(x.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
        </div>
        {canWrite && (
          <div className="flex gap-2 mt-2">
            <Input data-testid="rm-adopt-text" value={adoptText} onChange={(e) => setAdoptText(e.target.value)} placeholder="Add adoption task" />
            <Button size="sm" data-testid="rm-adopt-add" onClick={addAdopt}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Checklist({ title, items, canWrite, text, setText, onAdd, renderItem, onRemove, testid }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">{title}</div>
      <div className="space-y-1.5">
        {items.length === 0 && <Muted>None yet.</Muted>}
        {items.map((x) => (
          <div key={x.id} className="flex items-center gap-2 card-surface rounded-md px-2.5 py-1.5">
            {renderItem(x)}
            {canWrite && <button data-testid={`rm-${testid}-rm-${x.id}`} onClick={() => onRemove(x.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
      </div>
      {canWrite && (
        <div className="flex gap-2 mt-2">
          <Input data-testid={`rm-${testid}-text`} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Add ${title.toLowerCase()}`} />
          <Button size="sm" data-testid={`rm-${testid}-add`} onClick={onAdd}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
      )}
    </div>
  );
}

function fmt(v) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground italic">unknown</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ") || <span className="text-muted-foreground italic">none</span>;
  return String(v);
}
