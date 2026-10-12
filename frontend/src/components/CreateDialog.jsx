import { useState } from "react";
import { api, apiErr } from "@/lib/api";
import { ETYPE, SELECT_FIELDS, SOURCING, COST_PERIODS, RISK_LEVELS, DATA_SENSITIVITY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

// Minimal create fields per etype
export const CREATE_FIELDS = {
  opportunity: [["name", "Name"], ["business_problem", "Business problem", "area"], ["intended_outcome", "Intended outcome", "area"], ["candidate_phase", "Candidate phase (1-3)", "num"], ["priority", "Priority"]],
  agent: [["name", "Role-based name"], ["purpose", "Purpose", "area"], ["human_owner", "Human accountable owner"], ["allowed_actions", "Allowed actions", "area"], ["prohibited_actions", "Prohibited actions", "area"],
    ["sourcing", "Sourcing (buy / build / hybrid)", "select"], ["vendor", "Vendor or platform"], ["cost_estimate", "Cost estimate", "num"], ["cost_period", "Cost period", "select"], ["risk_level", "Risk level", "select"], ["data_sensitivity", "Data sensitivity", "select"]],
  workflow: [["name", "Name"], ["description", "Description", "area"],
    ["sourcing", "Sourcing (buy / build / hybrid)", "select"], ["vendor", "Vendor or platform"], ["cost_estimate", "Cost estimate", "num"], ["cost_period", "Cost period", "select"], ["risk_level", "Risk level", "select"]],
  system: [["name", "Name"], ["type", "Type"]],
  knowledge_source: [["name", "Name"], ["owner", "Owner"], ["freshness_rule", "Freshness rule"]],
  playbook: [["name", "Name"], ["business_problem", "Business problem", "area"], ["proposed_workflow", "Proposed workflow", "area"]],
  initiative: [["name", "Name"], ["business_problem", "Business problem", "area"], ["owner", "Owner"], ["budget", "Budget", "num"], ["currency", "Currency"]],
  metric: [["name", "Name"], ["unit", "Unit"], ["definition", "Definition", "area"], ["baseline", "Baseline", "num"], ["target", "Target", "num"]],
  evidence: [["name", "Name"], ["type", "Type"], ["content", "Content", "area"]],
  decision: [["name", "Decision"], ["approver", "Approver"], ["rationale", "Rationale", "area"]],
  capability: [["name", "Name"], ["current_state", "Current state"], ["target_state", "Target state"]],
  process: [["name", "Name"], ["owner", "Owner"], ["current_state", "Current state"], ["target_state", "Target state"]],
};

export function CreateDialog({ open, setOpen, etype, orgId, onDone }) {
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
              {type === "select" ? (
                <select data-testid={`field-${k}`} value={data[k] || ""} onChange={(e) => setData({ ...data, [k]: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                  <option value="">—</option>
                  {(SELECT_FIELDS[k] || []).map((o) => <option key={o} value={o}>{optLabel(k, o)}</option>)}
                </select>
              ) : type === "area" ? (
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

function optLabel(k, o) {
  if (k === "sourcing") return SOURCING[o]?.label || o;
  if (k === "cost_period") return COST_PERIODS[o] || o;
  if (k === "risk_level") return RISK_LEVELS[o]?.label || o;
  if (k === "data_sensitivity") return DATA_SENSITIVITY[o] || o;
  return String(o).replace(/_/g, " ");
}
