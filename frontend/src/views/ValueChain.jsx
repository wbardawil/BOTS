import { useEffect, useState, useCallback } from "react";
import { useScope } from "@/context/ScopeContext";
import { api } from "@/lib/api";
import { Empty } from "@/components/shared";
import { Workflow, ArrowRight, Bot } from "lucide-react";

const STAGES = [
  { key: "Strategy & Planning", caps: ["Strategy & Leadership"] },
  { key: "Product / Service & Operations", caps: ["Product & Service Management", "Operations & Supply Chain"] },
  { key: "Marketing & Sales", caps: ["Marketing & Growth", "Sales"] },
  { key: "Delivery & Customer Success", caps: ["Customer Operations & Administration"] },
  { key: "Feedback & Improvement", caps: ["Data & Analytics"] },
];
const SUPPORT = ["Technology, AI & Automation", "Data & Analytics", "Finance", "People & HR", "Legal, Risk & Compliance"];

export default function ValueChain() {
  const { orgId, setSelectedId } = useScope();
  const [all, setAll] = useState([]);
  const load = useCallback(() => {
    if (!orgId) return;
    api.get("/entities", { organization_id: orgId }).then(setAll);
  }, [orgId]);
  useEffect(load, [load]);
  if (!orgId) return <Empty icon={Workflow} title="Select a company" />;

  const agents = all.filter((e) => e.etype === "agent");

  return (
    <div className="p-6 max-w-[1500px] mx-auto fade-up">
      <h1 className="font-display text-2xl font-bold">Value Chain</h1>
      <p className="text-sm text-muted-foreground mb-6">Primary flow with workflow handoffs. Supporting capabilities shown below. Approval points marked where defined.</p>

      <div className="flex items-stretch gap-2 overflow-x-auto pb-4">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex items-stretch">
            <div className="card-surface rounded-xl p-4 min-w-[220px] flex flex-col">
              <h3 className="font-display font-semibold text-sm mb-2">{s.key}</h3>
              <div className="space-y-1.5 flex-1">
                {s.caps.map((c) => {
                  const cap = all.find((e) => e.etype === "capability" && e.data.name === c);
                  return (
                    <button key={c} data-testid={`vc-cap-${c}`} onClick={() => cap && setSelectedId(cap.id)}
                      className="w-full text-left text-xs rounded-md px-2 py-1.5 bg-muted/40 hover:bg-accent transition-colors">
                      {c}
                    </button>
                  );
                })}
              </div>
              {i === 2 && agents.slice(0, 2).map((a) => (
                <button key={a.id} data-testid={`vc-agent-${a.id}`} onClick={() => setSelectedId(a.id)}
                  className="mt-2 flex items-center gap-1.5 text-[11px] rounded-md px-2 py-1.5 border border-primary/40 bg-primary/10 text-primary">
                  <Bot className="h-3 w-3" /> {a.data.name}
                </button>
              ))}
            </div>
            {i < STAGES.length - 1 && <div className="flex items-center px-1 text-muted-foreground"><ArrowRight className="h-5 w-5" /></div>}
          </div>
        ))}
      </div>

      <h2 className="font-display text-base font-semibold mt-6 mb-3 text-muted-foreground">Enabling capabilities</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {SUPPORT.map((c) => {
          const cap = all.find((e) => e.etype === "capability" && e.data.name === c);
          return (
            <button key={c} data-testid={`vc-support-${c}`} onClick={() => cap && setSelectedId(cap.id)}
              className="card-surface rounded-lg p-3 text-sm text-left hover:border-primary/40">{c}</button>
          );
        })}
      </div>
    </div>
  );
}
