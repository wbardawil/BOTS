import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { CANON_AREAS, AREA_BY_KEY, LINE } from "@/lib/constants";
import { VOCAB, labelFor } from "@/lib/fields";
import { hoursPerMonth } from "@/pages/Intake";
import { AiTag, DemoTag } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Scale, Sparkles, GripVertical, Lock, LayoutGrid, Table2, Star } from "lucide-react";
import { toast } from "sonner";

const CLASSES = VOCAB.feasibility_class.map((o) => o.key);
const COLS = [{ key: "", label: "Unclassified" }, ...VOCAB.feasibility_class.map((o) => ({ key: o.key, label: o.en }))];
const POLL_MS = 1500;

/** Where a record sits: its final class (solid), else its AI draft class (dashed), else unclassified. */
export const placement = (d) => d.feasibility_class ? { col: d.feasibility_class, draft: false }
  : d.feasibility_draft_class ? { col: d.feasibility_draft_class, draft: true } : { col: "", draft: false };

/**
 * Feasibility map: every intake item classified as current stack / configure / build / buy / not tech.
 * Board mode: drag a card into a class to review it (accept the AI draft, override it, or reject it back to
 * Unclassified). Matrix mode: areas × classes, the third export target.
 */
export default function Feasibility() {
  const { orgId, currentOrg, setSelectedId, reloadToken, bumpReload } = useScope();
  const locale = "en";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("board");
  const [areaFilter, setAreaFilter] = useState("");
  const [dragId, setDragId] = useState(null);
  const [job, setJob] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const pollRef = useRef(null);
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
  useEffect(() => () => clearInterval(pollRef.current), []);

  const visible = useMemo(() => rows.filter((r) => !areaFilter || r.data.area === areaFilter), [rows, areaFilter]);
  const stats = useMemo(() => ({
    total: rows.length,
    final: rows.filter((r) => r.data.feasibility_class).length,
    draft: rows.filter((r) => !r.data.feasibility_class && r.data.feasibility_draft_class).length,
    none: rows.filter((r) => !r.data.feasibility_class && !r.data.feasibility_draft_class).length,
    quick: rows.filter((r) => r.data.feasibility?.final?.quick_win).length,
  }), [rows]);

  // ---- batch run with polling -----------------------------------------------------------------
  const poll = (jobId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const j = await api.get(`/organizations/${orgId}/feasibility/jobs/${jobId}`);
        setJob(j);
        if (j.status === "done" || j.status === "failed") {
          clearInterval(pollRef.current);
          if (j.status === "done") toast.success(`${j.ok} drafted, ${j.failed} failed`); else toast.error(`Run failed: ${j.error || "unknown error"}`);
          load(); bumpReload();
        }
      } catch { clearInterval(pollRef.current); }
    }, POLL_MS);
  };
  const run = async (force) => {
    try {
      const res = await api.post(`/organizations/${orgId}/feasibility/run`, { force });
      if (!res.job_id) { toast.message(`Nothing to classify (${res.skipped} already have a draft or verdict)`); return; }
      setJob({ id: res.job_id, status: "queued", total: res.queued, done: 0, ok: 0, failed: 0 });
      poll(res.job_id);
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  const running = job && (job.status === "queued" || job.status === "running");

  // ---- review by drag ------------------------------------------------------------------------
  const review = async (r, target) => {
    const p = placement(r.data);
    if (p.col === target && !p.draft) return;
    const draftClass = r.data.feasibility?.draft?.content?.classification;
    let body;
    if (!target) { if (!p.col) return; body = { action: "rejected", version: r.version }; }
    else if (draftClass === target && !r.data.feasibility_class) body = { action: "accepted", version: r.version };
    else body = { action: "overridden", version: r.version, final: { classification: target }, note: "set on the feasibility board" };
    try {
      const upd = await api.post(`/entities/${r.id}/feasibility/review`, body);
      setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, ...upd } : x)));
      bumpReload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); if (e.response?.status === 409) load(); }
  };

  return (
    <div className="p-4 md:p-6" data-testid="feasibility-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Scale className="h-6 w-6" /> Feasibility Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentOrg?.name} · what the current stack already covers, what to configure, build or buy, and what is not a technology problem.
            {!canWrite && <span className="inline-flex items-center gap-1 ml-2 text-amber-600"><Lock className="h-3 w-3" /> read-only</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/40">
            {[["board", LayoutGrid, "Board"], ["matrix", Table2, "Matrix"]].map(([m, Icon, l]) => (
              <button key={m} data-testid={`feas-mode-${m}`} onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" /> {l}
              </button>
            ))}
          </div>
          {canWrite && (
            <Button size="sm" data-testid="feas-run-btn" disabled={!aiEnabled || running || stats.none === 0} onClick={() => run(false)}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {!aiEnabled ? "No AI provider" : running ? `Classifying ${job.done} / ${job.total}…` : `Classify ${stats.none} pending`}
            </Button>
          )}
          {canWrite && aiEnabled && !running && stats.total > 0 && (
            <button data-testid="feas-rerun-btn" onClick={() => run(true)} className="text-xs text-muted-foreground hover:text-foreground underline" title="Replaces every AI draft; final verdicts stay">re-run all</button>
          )}
        </div>
      </div>

      {running && (
        <div data-testid="feas-job-progress" className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs flex items-center gap-3">
          <span className="mono">{job.done} / {job.total}</span>
          <div className="flex-1 h-1.5 rounded bg-gray-100 overflow-hidden"><div className="h-full bg-gray-900 transition-all" style={{ width: `${job.total ? (100 * job.done) / job.total : 0}%` }} /></div>
          <span className="text-muted-foreground">{job.failed ? `${job.failed} failed` : "drafting…"}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[["feas-stat-total", stats.total, "intake items"], ["feas-stat-final", stats.final, "with a verdict"], ["feas-stat-draft", stats.draft, "AI drafts awaiting review"],
          ["feas-stat-none", stats.none, "not yet classified"], ["feas-stat-quick", stats.quick, "quick wins"]].map(([t, v, l]) => (
          <div key={t} data-testid={t} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-2xl font-bold mono leading-none">{v}</div>
            <div className="text-[11px] text-muted-foreground mt-1.5">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <select data-testid="feas-area-filter" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs">
          <option value="">All areas</option>
          {CANON_AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{visible.length} of {rows.length}</span>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        : rows.length === 0 ? <div className="py-20 text-center text-sm text-muted-foreground" data-testid="feas-empty">No intake items yet. Capture them on the Leadership Intake page first.</div>
        : mode === "board" ? (
          <div className="flex gap-3 overflow-x-auto pb-4" data-testid="feas-board">
            {COLS.map((c) => {
              const cards = visible.filter((r) => placement(r.data).col === c.key);
              return (
                <div key={c.key || "none"} data-testid={`feas-col-${c.key || "unclassified"}`}
                  onDragOver={(e) => { if (canWrite && dragId) e.preventDefault(); }}
                  onDrop={() => { if (canWrite && dragId) { const r = rows.find((x) => x.id === dragId); if (r) review(r, c.key); setDragId(null); } }}
                  className={`flex-1 basis-0 min-w-[190px] rounded-xl border bg-muted/30 ${c.key ? "border-border" : "border-dashed border-gray-300"}`}>
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground/80">{c.label}</span>
                    <span className="text-[11px] mono text-muted-foreground">{cards.length}</span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {cards.map((r) => <Card key={r.id} r={r} canWrite={canWrite} locale={locale} onDrag={setDragId} onOpen={setSelectedId} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <Matrix rows={visible} locale={locale} onOpen={setSelectedId} />}
      <p className="text-[11px] text-muted-foreground mt-2">Solid card = reviewed verdict. Dashed card = AI draft awaiting a human decision. Drag a card into a class to accept or override; drag it to Unclassified to reject.</p>
    </div>
  );
}

function Card({ r, canWrite, locale, onDrag, onOpen }) {
  const d = r.data; const p = placement(d); const area = AREA_BY_KEY[d.area];
  const c = d.feasibility_class ? d.feasibility?.final : d.feasibility?.draft?.content;
  const hpm = Math.round(hoursPerMonth(d));
  return (
    <div data-testid={`feas-card-${r.id}`} draggable={canWrite} onDragStart={() => onDrag(r.id)} onDragEnd={() => onDrag(null)} onClick={() => onOpen(r.id)}
      style={{ boxShadow: area ? `inset 3px 0 0 ${area.color}` : undefined, borderStyle: p.draft ? "dashed" : "solid" }}
      className={`rounded-lg border bg-white p-2.5 cursor-pointer hover:border-gray-400 transition-colors ${p.draft ? "border-gray-400" : "border-gray-200"}`}>
      <div className="flex items-start gap-1.5">
        {canWrite && <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-tight line-clamp-2">{d.name} {r.is_demo && <DemoTag />}</div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{labelFor("initiative", "intake_kind", d.intake_kind, locale)}</span>
            {area && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ background: area.color }} />{area.label}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px] mono text-muted-foreground">
            {p.draft && <AiTag />}
            {c?.estimated_effort && <span className="rounded border border-gray-300 px-1">effort {c.estimated_effort}</span>}
            {c?.confidence && <span>conf. {c.confidence}</span>}
            {c?.quick_win && <span className="inline-flex items-center gap-0.5 text-gray-900"><Star className="h-3 w-3" /> quick win</span>}
            {hpm > 0 && <span className="ml-auto">{hpm.toLocaleString()} h/mo</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Matrix({ rows, locale, onOpen }) {
  const areas = [...CANON_AREAS, { key: "", label: "No area", color: "#9ca3af" }].filter((a) => rows.some((r) => (AREA_BY_KEY[r.data.area] ? r.data.area : "") === a.key));
  const cols = [...VOCAB.feasibility_class.map((o) => ({ key: o.key, label: o[locale] || o.en })), { key: "", label: "Unclassified" }];
  const cell = (a, c) => rows.filter((r) => (AREA_BY_KEY[r.data.area] ? r.data.area : "") === a.key && placement(r.data).col === c.key);
  return (
    <div className="overflow-x-auto" data-testid="feas-matrix">
      <div className="min-w-[1000px] rounded-xl border border-gray-200 bg-white">
        <div className="grid" style={{ gridTemplateColumns: `180px repeat(${cols.length}, minmax(0, 1fr))` }}>
          <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-200">Area \ Verdict</div>
          {cols.map((c) => (
            <div key={c.key || "none"} className={`px-2 py-2 border-b border-l border-gray-200 text-[11px] font-bold ${c.key ? "text-gray-900" : "text-gray-500"}`}>
              {c.label} <span className="font-normal mono text-gray-400">· {rows.filter((r) => placement(r.data).col === c.key).length}</span>
            </div>
          ))}
          {areas.map((a) => (
            <RowCells key={a.key || "none"} a={a} cols={cols} cell={cell} onOpen={onOpen} />
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Chip stripe = area hue. Dashed chip = AI draft awaiting review. ★ = quick win.</p>
    </div>
  );
}

function RowCells({ a, cols, cell, onOpen }) {
  return (
    <>
      <div className="px-3 py-2 border-b border-gray-200 text-[11px] font-semibold text-gray-700 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: a.color }} />{a.label}</div>
      {cols.map((c) => {
        const items = cell(a, c);
        return (
          <div key={c.key || "none"} className="px-1.5 py-1.5 border-b border-l border-gray-100 space-y-1 min-h-[36px]" data-testid={`feas-cell-${a.key || "none"}-${c.key || "none"}`}>
            {items.map((r) => {
              const p = placement(r.data); const fin = r.data.feasibility?.final;
              return (
                <button key={r.id} data-testid={`feas-chip-${r.id}`} onClick={() => onOpen(r.id)} title={r.data.name}
                  style={{ borderColor: p.draft ? "#9ca3af" : LINE, borderStyle: p.draft ? "dashed" : "solid", boxShadow: `inset 3px 0 0 ${a.color}` }}
                  className="flex w-full items-center gap-1 rounded-md border bg-white hover:bg-gray-50 pl-2.5 pr-1.5 py-[3px] text-[11px] text-gray-700 text-left">
                  <span className="truncate">{r.data.name}</span>
                  {fin?.quick_win && <Star className="h-3 w-3 shrink-0 ml-auto text-gray-900" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
