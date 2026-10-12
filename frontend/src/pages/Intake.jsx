import { useCallback, useEffect, useMemo, useState } from "react";
import { useScope } from "@/context/ScopeContext";
import { api } from "@/lib/api";
import { CANON_AREAS, AREA_BY_KEY } from "@/lib/constants";
import { VOCAB, labelFor } from "@/lib/fields";
import { CreateDialog } from "@/components/CreateDialog";
import TranscriptDialog from "@/components/TranscriptDialog";
import { Sel, areaCell, NeutralPill } from "@/components/tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Plus, Sparkles, Inbox } from "lucide-react";

// Keys the intake form asks for, in order (all from the initiative manifest).
const INTAKE_FORM_KEYS = ["name", "intake_kind", "area", "raised_by", "raised_by_role", "owner", "business_problem",
  "intended_outcome", "current_process", "frequency", "time_per_occurrence_hours", "people_involved", "urgency", "impact", "evidence_quote"];
// Occurrences per month, to turn "hours per occurrence" into hours per month at stake.
const PER_MONTH = { daily: 21, weekly: 4.33, monthly: 1, quarterly: 1 / 3, ad_hoc: 0 };
export const hoursPerMonth = (d) => {
  const h = Number(d.time_per_occurrence_hours) || 0;
  const f = PER_MONTH[d.frequency] ?? 0;
  return h * f * (Number(d.people_involved) || 1);
};
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "none";

/**
 * Leadership intake: initiatives, pain points and slow tasks captured from the leadership team,
 * grouped by who raised them. Items are `initiative` records with an `intake_kind`.
 */
export default function Intake() {
  const { orgId, currentOrg, setSelectedId, reloadToken, bumpReload } = useScope();
  const locale = "en";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ kind: "", area: "" });
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    api.get("/entities", { organization_id: orgId, etype: "initiative" })
      .then((xs) => setRows(xs.filter((e) => e.data?.intake_kind)))
      .finally(() => setLoading(false));
  }, [orgId]);
  useEffect(load, [load, reloadToken]);
  useEffect(() => { api.get("/ai/status").then((s) => setAiEnabled(!!s.enabled)).catch(() => setAiEnabled(false)); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (!filters.kind || r.data.intake_kind === filters.kind) && (!filters.area || r.data.area === filters.area)
      && (!q || [r.data.name, r.data.raised_by, r.data.business_problem, r.data.evidence_quote].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [rows, filters, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    initiative: rows.filter((r) => r.data.intake_kind === "initiative").length,
    pain_point: rows.filter((r) => r.data.intake_kind === "pain_point").length,
    slow_task: rows.filter((r) => r.data.intake_kind === "slow_task").length,
    hours: Math.round(rows.reduce((a, r) => a + hoursPerMonth(r.data), 0)),
    unclassified: rows.filter((r) => !r.data.feasibility_class).length,
  }), [rows]);

  const groups = useMemo(() => {
    const m = new Map();
    filtered.forEach((r) => {
      const who = (r.data.raised_by || "").trim() || "Not attributed";
      if (!m.has(who)) m.set(who, { who, role: "", items: [] });
      const g = m.get(who);
      if (!g.role && r.data.raised_by_role) g.role = r.data.raised_by_role;
      g.items.push(r);
    });
    return [...m.values()].sort((a, b) => (a.who === "Not attributed") - (b.who === "Not attributed") || b.items.length - a.items.length || a.who.localeCompare(b.who));
  }, [filtered]);

  const activeFilters = Object.values(filters).filter(Boolean).length + (search ? 1 : 0);
  const onDone = () => { load(); bumpReload(); };

  return (
    <div className="p-4 md:p-6" data-testid="intake-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Leadership Intake</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{currentOrg?.name} · initiatives, pain points and slow tasks, in the words of the people who raised them</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && <Button size="sm" variant="outline" data-testid="intake-transcript-btn" onClick={() => setTranscriptOpen(true)}><Sparkles className="h-3.5 w-3.5 mr-1.5" /> From transcript</Button>}
          {canWrite && <Button size="sm" data-testid="intake-new-btn" onClick={() => setFormOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> New item</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {[["intake-stat-total", stats.total, "items captured"], ["intake-stat-initiative", stats.initiative, "initiatives"],
          ["intake-stat-pain_point", stats.pain_point, "pain points"], ["intake-stat-slow_task", stats.slow_task, "slow tasks"],
          ["intake-stat-hours", stats.hours.toLocaleString(), "hours / month at stake"], ["intake-stat-unclassified", stats.unclassified, "awaiting a feasibility verdict"]].map(([t, v, l]) => (
          <div key={t} data-testid={t} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-2xl font-bold mono leading-none">{v}</div>
            <div className="text-[11px] text-muted-foreground mt-1.5">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input data-testid="intake-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="h-8 w-56 text-sm" />
        <Sel testid="intake-kind-filter" value={filters.kind} onChange={(v) => setFilters({ ...filters, kind: v })} placeholder="All kinds" options={VOCAB.intake_kind.map((o) => [o.key, o[locale] || o.en])} />
        <Sel testid="intake-area-filter" value={filters.area} onChange={(v) => setFilters({ ...filters, area: v })} placeholder="All areas" options={CANON_AREAS.map((a) => [a.key, a.label])} />
        {activeFilters > 0 && <button data-testid="intake-clear" onClick={() => { setFilters({ kind: "", area: "" }); setSearch(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 text-muted-foreground" data-testid="intake-empty">
            <Inbox className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium text-foreground/80">Nothing captured yet</p>
            <p className="text-xs mt-1 max-w-sm">Add items from the leadership interviews by hand, or paste a transcript and let the AI draft the rows for you to approve.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No items match the filters.</div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Kind</th>
                  <th className="text-left px-4 py-2.5 font-medium">Item</th>
                  <th className="text-left px-4 py-2.5 font-medium">Area</th>
                  <th className="text-left px-4 py-2.5 font-medium">Frequency · hours · people</th>
                  <th className="text-right px-4 py-2.5 font-medium">h / month</th>
                  <th className="text-left px-4 py-2.5 font-medium">Urgency</th>
                  <th className="text-left px-4 py-2.5 font-medium">Impact</th>
                  <th className="text-left px-4 py-2.5 font-medium">Verdict</th>
                  <th className="text-left px-4 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g.who} group={g} locale={locale} onOpen={setSelectedId} />
                ))}
              </tbody>
            </table>
          </div>
        )}

      <CreateDialog open={formOpen} setOpen={setFormOpen} etype="initiative" orgId={orgId} onDone={onDone}
        keys={INTAKE_FORM_KEYS} extra={{ source: "form" }} title="New intake item" />
      <TranscriptDialog open={transcriptOpen} setOpen={setTranscriptOpen} orgId={orgId} onDone={onDone} locale={locale} aiEnabled={aiEnabled} />
    </div>
  );
}

function GroupRows({ group, locale, onOpen }) {
  const hours = Math.round(group.items.reduce((a, r) => a + hoursPerMonth(r.data), 0));
  return (
    <>
      <tr className="bg-gray-50 border-t border-border" data-testid={`intake-group-${slug(group.who)}`}>
        <td colSpan={9} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          {group.who}{group.role ? <span className="font-normal normal-case text-gray-500"> · {group.role}</span> : null}
          <span className="font-normal text-gray-400"> · {group.items.length}</span>
          {hours > 0 && <span className="float-right font-normal normal-case mono text-gray-500">{hours.toLocaleString()} h / month</span>}
        </td>
      </tr>
      {group.items.map((r) => {
        const d = r.data;
        const hpm = Math.round(hoursPerMonth(d));
        return (
          <tr key={r.id} data-testid={`intake-row-${r.id}`} onClick={() => onOpen(r.id)} className="border-t border-border hover:bg-accent/50 cursor-pointer transition-colors">
            <td className="px-4 py-2.5 whitespace-nowrap"><NeutralPill tone={d.intake_kind === "initiative" ? "neutral" : "yes"}>{labelFor("initiative", "intake_kind", d.intake_kind, locale)}</NeutralPill></td>
            <td className="px-4 py-2.5">
              <div className="font-medium">{d.name}</div>
              {d.evidence_quote && <div className="text-xs text-muted-foreground italic truncate max-w-md">“{d.evidence_quote}”</div>}
            </td>
            <td className="px-4 py-2.5">{areaCell(d.area)}</td>
            <td className="px-4 py-2.5 text-xs mono whitespace-nowrap text-gray-600">
              {[labelFor("initiative", "frequency", d.frequency, locale), d.time_per_occurrence_hours ? `${d.time_per_occurrence_hours} h` : null, d.people_involved ? `${d.people_involved} p` : null].filter(Boolean).join(" · ") || "—"}
            </td>
            <td className="px-4 py-2.5 text-right mono text-xs">{hpm ? hpm.toLocaleString() : "—"}</td>
            <td className="px-4 py-2.5 text-xs">{labelFor("initiative", "urgency", d.urgency, locale) || "—"}</td>
            <td className="px-4 py-2.5 text-xs">{labelFor("initiative", "impact", d.impact, locale) || "—"}</td>
            <td className="px-4 py-2.5 whitespace-nowrap">
              {d.feasibility_class ? <NeutralPill tone="yes" testid={`intake-verdict-${r.id}`}>{labelFor("initiative", "feasibility_class", d.feasibility_class, locale)}</NeutralPill>
                : d.feasibility_draft_class ? <span data-testid={`intake-verdict-${r.id}`} className="inline-flex items-center rounded border border-dashed border-gray-400 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide mono text-gray-500">draft · {labelFor("initiative", "feasibility_class", d.feasibility_draft_class, locale)}</span>
                : <span className="text-xs text-muted-foreground">—</span>}
            </td>
            <td className="px-4 py-2.5 text-[10px] mono uppercase text-gray-400">{d.source || "—"}</td>
          </tr>
        );
      })}
    </>
  );
}
