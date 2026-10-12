import { useEffect, useState, useCallback } from "react";
import { useScope } from "@/context/ScopeContext";
import { api } from "@/lib/api";
import { PhasePill, Empty } from "@/components/shared";
import { Layers } from "lucide-react";

export default function CapabilityModel() {
  const { orgId, state, setSelectedId, search } = useScope();
  const [caps, setCaps] = useState([]);
  const [all, setAll] = useState([]);
  const [rels, setRels] = useState([]);

  const load = useCallback(() => {
    if (!orgId) return;
    Promise.all([
      api.get("/entities", { organization_id: orgId }),
      api.get("/relationships", { organization_id: orgId }),
    ]).then(([es, rs]) => {
      setAll(es); setRels(rs);
      setCaps(es.filter((e) => e.etype === "capability"));
    });
  }, [orgId]);
  useEffect(load, [load]);

  if (!orgId) return <Empty icon={Layers} title="Select a company" />;

  const linkedTo = (capId, type) => {
    const ids = rels.filter((r) => r.from_id === capId || r.to_id === capId)
      .map((r) => (r.from_id === capId ? r.to_id : r.from_id));
    return all.filter((e) => ids.includes(e.id) && e.etype === type);
  };

  const filtered = caps.filter((c) => !search || c.data.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-[1500px] mx-auto fade-up">
      <h1 className="font-display text-2xl font-bold">Capability Model</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Showing <b className="text-primary">{state}</b> state. A capability is not a department. Click a card for detail.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => {
          const procs = linkedTo(c.id, "process");
          const agents = linkedTo(c.id, "agent");
          const opps = linkedTo(c.id, "opportunity");
          const stateVal = state === "target" ? c.data.target_state : c.data.current_state;
          return (
            <div key={c.id} data-testid={`cap-card-${c.id}`} onClick={() => setSelectedId(c.id)}
              className="card-surface rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-start justify-between">
                <h3 className="font-display font-semibold">{c.data.name}</h3>
                {c.data.applicable === false && <span className="text-[10px] text-muted-foreground">N/A</span>}
              </div>
              <div className="mt-2 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide">{state} state</span>
                <p className="text-foreground/85 mt-0.5">{stateVal || <span className="italic text-muted-foreground">unknown</span>}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3 text-[11px]">
                <Chip n={procs.length} label="processes" color="199 89% 55%" />
                <Chip n={agents.length} label="agents" color="168 82% 45%" />
                <Chip n={opps.length} label="opportunities" color="38 92% 56%" />
              </div>
              {agents.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {agents.map((a) => <span key={a.id} className="text-[11px]"><PhasePill phase={a.data.phase} /></span>)}
                </div>
              )}
              {c.data.outcome_measure && <p className="text-[11px] text-muted-foreground mt-3">Outcome: {c.data.outcome_measure}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ n, label, color }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 border"
      style={{ color: `hsl(${color})`, borderColor: `hsl(${color} / 0.3)`, background: `hsl(${color} / 0.1)` }}>
      <b>{n}</b> {label}
    </span>
  );
}
