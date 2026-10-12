import { useEffect, useState } from "react";
import { useScope } from "@/context/ScopeContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Empty } from "@/components/shared";
import { Settings as Cog, ShieldCheck } from "lucide-react";

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
