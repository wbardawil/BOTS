import { useEffect, useState, useCallback } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { StatusBadge, Empty } from "@/components/shared";
import { PHASE_META } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Rocket, Wand2 } from "lucide-react";
import { toast } from "sonner";

const PHASES = [1, 2, 3];

export default function Roadmap() {
  const { orgId, currentOrg, setSelectedId, bumpReload } = useScope();
  const [mode, setMode] = useState("matrix");
  const [inits, setInits] = useState([]);
  const [agents, setAgents] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    Promise.all([
      api.get("/entities", { organization_id: orgId, etype: "initiative" }),
      api.get("/entities", { organization_id: orgId, etype: "agent" }),
    ]).then(([is, ag]) => { setInits(is); setAgents(ag); });
  }, [orgId]);
  useEffect(load, [load]);

  const seedTemplate = async () => {
    setSeeding(true);
    try {
      const r = await api.post(`/organizations/${orgId}/roadmap-template`, {});
      toast.success(r.created ? `Seeded ${r.created} draft initiatives (one per phase and area).` : "Template already seeded — nothing to add.");
      load(); bumpReload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setSeeding(false); }
  };

  if (!orgId) return <Empty icon={Rocket} title="Select a company" />;

  const items = [...inits.map((i) => ({ ...i, kind: "Initiative" })), ...agents.map((a) => ({ ...a, kind: "Agent" }))];

  return (
    <div className="p-6 max-w-[1500px] mx-auto fade-up">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Transformation Roadmap</h1>
          <p className="text-sm text-muted-foreground">Initiatives and workflows across phases. Phase ≠ deployment status.</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button size="sm" variant="outline" data-testid="roadmap-seed-template" onClick={seedTemplate} disabled={seeding}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" /> {seeding ? "Seeding…" : "Seed roadmap template"}
            </Button>
          )}
          <div className="flex gap-1 rounded-md border border-border p-0.5 bg-muted/40">
            {["matrix", "table"].map((m) => (
              <button key={m} data-testid={`roadmap-${m}`} onClick={() => setMode(m)}
                className={`px-3 py-1 rounded text-xs capitalize ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      {mode === "matrix" ? (
        <div className="grid md:grid-cols-3 gap-4">
          {PHASES.map((p) => (
            <div key={p} className="card-surface rounded-xl p-4">
              <h3 className="font-display font-semibold text-sm mb-3" style={{ color: PHASE_META[p].hex }}>{PHASE_META[p].label}</h3>
              <div className="space-y-2">
                {items.filter((i) => (i.data.phase || 1) === p).map((i) => (
                  <button key={i.id} data-testid={`road-item-${i.id}`} onClick={() => setSelectedId(i.id)}
                    className="w-full text-left card-surface rounded-lg px-3 py-2 hover:bg-accent transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{i.data.name}</span>
                      <span className="text-[10px] text-muted-foreground">{i.kind}</span>
                    </div>
                    <div className="mt-1"><StatusBadge status={i.data.status || i.status} /></div>
                  </button>
                ))}
                {items.filter((i) => (i.data.phase || 1) === p).length === 0 && <p className="text-xs text-muted-foreground">No items</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2.5">Item</th><th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Phase</th><th className="text-left px-4 py-2.5">Owner</th>
                <th className="text-left px-4 py-2.5">Status</th><th className="text-left px-4 py-2.5">Target date</th></tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} data-testid={`road-row-${i.id}`} onClick={() => setSelectedId(i.id)} className="border-t border-border hover:bg-accent/50 cursor-pointer">
                  <td className="px-4 py-3 font-medium">{i.data.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.kind}</td>
                  <td className="px-4 py-3">Phase {i.data.phase || 1}</td>
                  <td className="px-4 py-3">{i.data.owner || i.data.human_owner || <span className="text-amber-600">⚠</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={i.data.status || i.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i.data.target_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
