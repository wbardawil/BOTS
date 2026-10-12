import { useEffect, useState } from "react";
import { useScope } from "@/context/ScopeContext";
import { api } from "@/lib/api";
import { Empty } from "@/components/shared";
import { Boxes, Lock, Info } from "lucide-react";

export default function GroupOversight() {
  const { portfolios } = useScope();
  const [pfId, setPfId] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => { if (portfolios.length && !pfId) setPfId(portfolios[0].id); }, [portfolios]);
  useEffect(() => { if (pfId) api.get(`/portfolios/${pfId}/oversight`).then(setData).catch(() => setData(null)); }, [pfId]);

  if (portfolios.length === 0) return <Empty icon={Boxes} title="No portfolios in this workspace" hint="Group oversight aggregates authorized companies across a portfolio." />;

  return (
    <div className="p-6 max-w-[1400px] mx-auto fade-up">
      <h1 className="font-display text-2xl font-bold">Group Oversight</h1>
      <p className="text-sm text-muted-foreground mb-4">Aggregated across authorized companies. Overlapping membership deduplicated; restricted data withheld.</p>

      <div className="flex gap-2 mb-5">
        {portfolios.map((p) => (
          <button key={p.id} data-testid={`pf-${p.id}`} onClick={() => setPfId(p.id)}
            className={`px-3 py-1.5 rounded-md text-sm ${pfId === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {p.name} <span className="text-xs opacity-70">({p.organization_ids.length})</span>
          </button>
        ))}
      </div>

      {!data ? <p className="text-muted-foreground text-sm">Loading…</p> : (
        <>
          {data.restricted_count > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <Lock className="h-4 w-4" /> {data.restricted_count} company/companies hidden due to access restrictions — names and counts withheld.
            </div>
          )}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
            {data.companies.map((c) => (
              <div key={c.id} data-testid={`oversight-${c.id}`} className="card-surface rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold">{c.name}</h3>
                  <span className="text-[11px] text-muted-foreground mono">{c.currency}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <Mini n={c.initiatives} l="Initiatives" />
                  <Mini n={c.opportunities} l="Opportunities" />
                  <Mini n={c.agents} l="Agents" />
                </div>
                <div className="flex gap-1.5 mt-3">
                  {[1, 2, 3].map((p) => (
                    <span key={p} className="flex-1 text-center text-[11px] rounded py-1"
                      style={{ background: `hsl(${{1:"168 82% 45%",2:"199 89% 55%",3:"262 72% 66%"}[p]} / 0.12)`, color: `hsl(${{1:"168 82% 45%",2:"199 89% 55%",3:"262 72% 66%"}[p]})` }}>
                      P{p}: {c.phases[p] || 0}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Assessment coverage: {c.assessment_coverage}/{c.assessment_total}
                </div>
              </div>
            ))}
          </div>
          <div className="card-surface rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2"><Info className="h-4 w-4 text-primary" /> Aggregation methodology</div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
              {data.aggregation_notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
function Mini({ n, l }) {
  return <div><div className="text-xl font-display font-bold">{n}</div><div className="text-[10px] text-muted-foreground">{l}</div></div>;
}
