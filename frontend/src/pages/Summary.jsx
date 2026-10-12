import { useEffect, useMemo, useState } from "react";
import { useScope } from "@/context/ScopeContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { CANON_AREAS, AREA_BY_KEY } from "@/lib/constants";
import { VOCAB, labelFor } from "@/lib/fields";
import { hoursPerMonth } from "@/pages/Intake";
import { placement } from "@/pages/Feasibility";
import { costRollup } from "@/views/ExecutiveOverview";
import { Button } from "@/components/ui/button";
import { FileText, Printer } from "lucide-react";

/**
 * One-page executive summary in Spanish (the client deliverable). Printing it (browser print / save as PDF)
 * yields one A4 page: index.css carries the @media print rules.
 */
export default function Summary() {
  const { orgId, currentOrg, version } = useScope();
  const { user } = useAuth();
  const [data, setData] = useState({ system: [], initiative: [], agent: [], workflow: [] });
  const [loading, setLoading] = useState(true);
  const loc = "es";
  const cur = currentOrg?.currency || "USD";

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all(["system", "initiative", "agent", "workflow"].map((t) => api.get("/entities", { organization_id: orgId, etype: t }).catch(() => [])))
      .then(([system, initiative, agent, workflow]) => setData({ system, initiative: initiative.filter((e) => e.data?.intake_kind), agent, workflow }))
      .finally(() => setLoading(false));
  }, [orgId]);

  const s = useMemo(() => {
    const { system, initiative, agent, workflow } = data;
    const kinds = VOCAB.system_kind.map((k) => ({ ...k, n: system.filter((x) => x.data.kind === k.key).length }));
    const monthly = system.reduce((a, x) => a + (x.data.cost_period === "monthly" ? Number(x.data.cost_estimate) || 0 : 0), 0);
    const classes = VOCAB.feasibility_class.map((c) => ({ ...c, items: initiative.filter((x) => x.data.feasibility_class === c.key) }));
    const drafts = initiative.filter((x) => placement(x.data).draft);
    const none = initiative.filter((x) => placement(x.data).col === "");
    const quick = initiative.filter((x) => x.data.feasibility?.final?.quick_win);
    const cost = costRollup([...agent, ...workflow].filter((x) => x.data.cost_estimate));
    return {
      systems: system.length, kinds, api: system.filter((x) => x.data.api_available === "yes").length, mcp: system.filter((x) => x.data.mcp_available === "yes").length,
      verified: system.filter((x) => x.data.verified_integration).length, noKind: system.filter((x) => !x.data.kind).length, noOwner: system.filter((x) => !x.data.owner).length, monthly,
      items: initiative.length, byKind: VOCAB.intake_kind.map((k) => ({ ...k, n: initiative.filter((x) => x.data.intake_kind === k.key).length })),
      hours: Math.round(initiative.reduce((a, x) => a + hoursPerMonth(x.data), 0)),
      classes, drafts: drafts.length, none: none.length, quick, cost,
      people: new Set(initiative.map((x) => x.data.raised_by).filter(Boolean)).size,
    };
  }, [data]);

  const money = (n) => (n ? `${cur} ${Math.round(n).toLocaleString("es-MX")}` : "—");
  const date = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-4 md:p-6" data-testid="summary-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 no-print">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><FileText className="h-6 w-6" /> Executive Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">One A4 page in Spanish for the client. Print or save as PDF; the screen chrome is left out.</p>
        </div>
        <Button size="sm" data-testid="summary-print-btn" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1.5" /> Print / PDF</Button>
      </div>

      <article data-testid="summary-sheet" className="print-sheet mx-auto bg-white border border-gray-200 rounded-xl p-8 max-w-[210mm] text-[12px] leading-snug text-gray-900">
        <header className="flex items-start justify-between border-b border-gray-900 pb-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Mapa de tecnología e iniciativas</div>
            <h2 className="text-xl font-bold font-display mt-0.5">{currentOrg?.name}</h2>
          </div>
          <div className="text-right text-[11px] text-gray-500">
            <div>{date}</div>
            <div>{version === "published" ? "Versión publicada" : "Borrador de trabajo"}</div>
            {user?.name && <div>Preparado por {user.name}</div>}
          </div>
        </header>

        {loading ? <p className="text-gray-500">Cargando…</p> : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Section title="1 · Inventario tecnológico" testid="summary-inventory">
              <Big n={s.systems} label="sistemas registrados" />
              <ul className="mt-1.5 space-y-0.5">
                {s.kinds.filter((k) => k.n).map((k) => <li key={k.key} className="flex justify-between"><span>{k[loc]}</span><span className="mono">{k.n}</span></li>)}
              </ul>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Mini n={s.api} label="con API" /><Mini n={s.mcp} label="con MCP" /><Mini n={s.verified} label="conexiones verificadas" />
              </div>
              <p className="mt-2 text-gray-600">Gasto mensual registrado: <b className="mono">{money(s.monthly)}</b></p>
            </Section>

            <Section title="2 · Lo que pidió el liderazgo" testid="summary-intake">
              <Big n={s.items} label={`temas capturados de ${s.people} persona${s.people === 1 ? "" : "s"}`} />
              <ul className="mt-1.5 space-y-0.5">
                {s.byKind.map((k) => <li key={k.key} className="flex justify-between"><span>{k[loc]}</span><span className="mono">{k.n}</span></li>)}
              </ul>
              <p className="mt-2 text-gray-600">Horas al mes en juego (tareas recurrentes): <b className="mono">{s.hours.toLocaleString("es-MX")}</b></p>
            </Section>

            <Section title="3 · Veredicto de factibilidad" testid="summary-verdicts" wide>
              <table className="w-full">
                <tbody>
                  {s.classes.map((c) => (
                    <tr key={c.key} className="border-t border-gray-200 align-top">
                      <td className="py-1 pr-2 whitespace-nowrap font-semibold w-[150px]">{c[loc]}</td>
                      <td className="py-1 pr-2 mono w-8 text-right">{c.items.length}</td>
                      <td className="py-1 text-gray-600">{c.items.slice(0, 4).map((x) => x.data.name).join(" · ")}{c.items.length > 4 ? ` · +${c.items.length - 4} más` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1.5 text-gray-600">{s.drafts} borradores de IA pendientes de revisión · {s.none} sin clasificar</p>
            </Section>

            <Section title="4 · Victorias rápidas" testid="summary-quick">
              {s.quick.length === 0 ? <p className="text-gray-500">Ninguna confirmada todavía.</p> : (
                <ol className="space-y-1 list-decimal pl-4">
                  {s.quick.slice(0, 6).map((x) => (
                    <li key={x.id}><b>{x.data.name}</b>{AREA_BY_KEY[x.data.area] ? <span className="text-gray-500"> · {AREA_BY_KEY[x.data.area].label}</span> : null}
                      {x.data.feasibility?.final?.what_to_do && <div className="text-gray-600">{String(x.data.feasibility.final.what_to_do).slice(0, 140)}</div>}</li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title="5 · Costo del plan" testid="summary-cost">
              <ul className="space-y-0.5">
                <li className="flex justify-between"><span>Agentes y flujos, mensual</span><span className="mono">{money(s.cost.monthly)}</span></li>
                <li className="flex justify-between"><span>Construcción única</span><span className="mono">{money(s.cost.oneOff)}</span></li>
                <li className="flex justify-between"><span>Sistemas actuales, mensual</span><span className="mono">{money(s.monthly)}</span></li>
                <li className="flex justify-between border-t border-gray-900 mt-1 pt-1 font-semibold"><span>Anualizado</span><span className="mono">{money((s.cost.monthly + s.monthly) * 12 + s.cost.oneOff)}</span></li>
              </ul>
              <p className="mt-1.5 text-gray-500">Montos capturados en los registros; sin estimaciones adicionales.</p>
            </Section>

            <Section title="6 · Pendientes" testid="summary-pending" wide>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                <li className="flex justify-between"><span>Borradores de IA por revisar</span><span className="mono">{s.drafts}</span></li>
                <li className="flex justify-between"><span>Temas sin clasificar</span><span className="mono">{s.none}</span></li>
                <li className="flex justify-between"><span>Sistemas sin tipo</span><span className="mono">{s.noKind}</span></li>
                <li className="flex justify-between"><span>Sistemas sin responsable</span><span className="mono">{s.noOwner}</span></li>
              </ul>
            </Section>
          </div>
        )}
        <footer className="mt-4 pt-2 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between">
          <span>{currentOrg?.name} · {CANON_AREAS.length} áreas · {labelFor("initiative", "feasibility_class", "current_stack", loc)} / {labelFor("initiative", "feasibility_class", "configure", loc)} / {labelFor("initiative", "feasibility_class", "build", loc)} / {labelFor("initiative", "feasibility_class", "buy", loc)} / {labelFor("initiative", "feasibility_class", "not_tech", loc)}</span>
          <span>Los veredictos de IA son borradores hasta que una persona los confirma.</span>
        </footer>
      </article>
    </div>
  );
}

function Section({ title, children, testid, wide }) {
  return (
    <section data-testid={testid} className={wide ? "col-span-2" : ""}>
      <h3 className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1.5">{title}</h3>
      {children}
    </section>
  );
}
const Big = ({ n, label }) => <div className="flex items-baseline gap-2"><span className="text-2xl font-bold mono leading-none">{n}</span><span className="text-gray-600">{label}</span></div>;
const Mini = ({ n, label }) => <div className="rounded border border-gray-200 py-1"><div className="font-bold mono">{n}</div><div className="text-[10px] text-gray-500">{label}</div></div>;
