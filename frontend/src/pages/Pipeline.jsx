import { useEffect, useState, useCallback } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { PIPELINE_ETYPES, ETYPE, AREA_BY_KEY, CANON_AREAS } from "@/lib/constants";
import { StatusBadge, DemoTag, PhasePill } from "@/components/shared";
import { Columns3, GripVertical, Lock } from "lucide-react";
import { toast } from "sonner";

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function timeInStage(r) {
  const h = r.data.stage_history;
  if (!h || !h.length) return null;
  return daysSince(h[h.length - 1].at);
}

export default function Pipeline() {
  const { orgId, currentOrg, setSelectedId, reloadToken, bumpReload, stages, stageLabel } = useScope();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [areaFilter, setAreaFilter] = useState("");
  const gatedKeys = new Set(stages.filter((s) => s.gated).map((s) => s.key));
  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all(PIPELINE_ETYPES.map((t) => api.get("/entities", { organization_id: orgId, etype: t })))
      .then((res) => setRows(res.flat()))
      .finally(() => setLoading(false));
  }, [orgId]);
  useEffect(load, [load, reloadToken]);

  const moveStage = async (r, stage) => {
    const cur = r.data.stage || stages[0]?.key;
    if (cur === stage) return;
    try {
      const upd = await api.post(`/entities/${r.id}/stage`, { stage, version: r.version });
      setRows((rs) => rs.map((x) => x.id === r.id ? upd : x));
      bumpReload();
      toast.success(`${r.data.name} → ${stageLabel[stage] || stage}`);
    } catch (e) {
      if (e.response?.status === 409) { toast.error("Record changed — refreshing."); load(); }
      else toast.error(apiErr(e.response?.data?.detail));
    }
  };

  const visible = areaFilter ? rows.filter((r) => r.data.area === areaFilter) : rows;
  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading pipeline…</div>;

  return (
    <div className="p-6 fade-up">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Columns3 className="h-5 w-5" /> Lifecycle Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {currentOrg?.name} · initiatives & opportunities, colored by function-family area · Phase shows AI ambition.
            {!canWrite && <span className="inline-flex items-center gap-1 ml-2 text-amber-600"><Lock className="h-3 w-3" /> read-only</span>}
          </p>
        </div>
        <select data-testid="pipeline-area-filter" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-white px-2 text-xs">
          <option value="">All areas</option>
          {CANON_AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" data-testid="pipeline-board">
        {stages.map((s) => {
          const cards = visible.filter((r) => (r.data.stage || stages[0]?.key) === s.key);
          return (
            <div key={s.key} data-testid={`pipeline-col-${s.key}`}
              onDragOver={(e) => { if (canWrite && dragId) e.preventDefault(); }}
              onDrop={() => { if (canWrite && dragId) { const r = rows.find((x) => x.id === dragId); if (r) moveStage(r, s.key); setDragId(null); } }}
              className="shrink-0 w-64 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/80">{s.label}{s.gated && <span title="Gated — needs an owner" className="text-amber-500 ml-1">⬥</span>}</span>
                <span className="text-[11px] mono text-muted-foreground">{cards.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {cards.map((r) => {
                  const tis = timeInStage(r);
                  const meta = ETYPE[r.etype];
                  const area = AREA_BY_KEY[r.data.area];
                  return (
                    <div key={r.id} data-testid={`pipeline-card-${r.id}`}
                      draggable={canWrite} onDragStart={() => setDragId(r.id)} onDragEnd={() => setDragId(null)}
                      onClick={() => setSelectedId(r.id)}
                      style={{ boxShadow: area ? `inset 3px 0 0 ${area.color}` : undefined }}
                      className="card-surface rounded-lg p-2.5 cursor-pointer hover:border-gray-300 transition-colors">
                      <div className="flex items-start gap-1.5">
                        {canWrite && <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-tight line-clamp-2">{r.data.name} {r.is_demo && <DemoTag />}</div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta?.label}</span>
                            {area && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ background: area.color }} />{area.label}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <StatusBadge status={r.status} />
                            <PhasePill phase={r.data.phase} />
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{r.data.owner || r.data.human_owner || <span className="text-amber-600">⚠ no owner</span>}</span>
                            {tis != null && <span className="text-[10px] mono text-muted-foreground">{tis}d in stage</span>}
                          </div>
                          {canWrite && (
                            <select data-testid={`pipeline-move-${r.id}`} value={r.data.stage || stages[0]?.key} onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { e.stopPropagation(); moveStage(r, e.target.value); }}
                              className="mt-2 w-full rounded border border-border bg-white px-1.5 py-1 text-[11px]">
                              {stages.map((st) => <option key={st.key} value={st.key}>{st.label}{gatedKeys.has(st.key) ? " ⬥" : ""}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && <div className="text-[11px] text-muted-foreground text-center py-4">—</div>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">⬥ Gated stages need an accountable owner. Left stripe = function-family area; the Phase pill is the AI ambition level (Phase 1 to 3) from the roadmap.</p>
    </div>
  );
}
