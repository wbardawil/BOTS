import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { CANON_AREAS, FUNCTION_BRANCHES } from "@/lib/constants";
import { Maximize2, Plus, Minus, Crosshair, Info, Move, Save, RotateCcw, GripVertical } from "lucide-react";
import { toast } from "sonner";

const CW = 2640, CH = 2060;
const RECTS = {
  all: { x: -20, y: -20, w: CW + 40, h: CH + 40 },
  A: { x: 0, y: 0, w: 2640, h: 780 },
  B: { x: 0, y: 810, w: 1540, h: 1240 },
  C: { x: 1570, y: 810, w: 1070, h: 560 },
  D: { x: 1570, y: 1400, w: 1070, h: 650 },
};
const PHASES = [
  { n: 1, name: "AI Co-Pilots", color: "#111827" },
  { n: 2, name: "AI Brains", color: "#6b7280" },
  { n: 3, name: "Autonomous Agents", color: "#9ca3af" },
];
const ROW_LABELS = ["Function", "Lead", "Knowledge brain", "Phases", "Agents", "Systems / tools", "Accountable"];
const ROW_Y = [0, 34, 78, 112, 150, 262, 300];
const VALUE_STAGES = [
  { label: "Strategic Planning & Leadership", areas: ["strategy"] },
  { label: "Product & Operations", areas: ["product", "operations"] },
  { label: "Marketing & Sales", areas: ["marketing", "sales"] },
  { label: "Delivery & Customer Support", areas: ["customer"] },
];
const snap = (n) => Math.round(n / 8) * 8;

export default function FrameworkCanvas() {
  const { orgId, currentOrg, state, search, setSelectedId } = useScope();
  const [entities, setEntities] = useState([]);
  const [rels, setRels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState({});
  const [dirty, setDirty] = useState(false);
  const [arrange, setArrange] = useState(false);
  const wrapRef = useRef(null);
  const [view, setView] = useState({ scale: 0.35, tx: 0, ty: 0 });
  const pan = useRef(null);
  const dragPiece = useRef(null);
  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true); setDirty(false); setArrange(false);
    Promise.all([
      api.get("/entities", { organization_id: orgId }),
      api.get("/relationships", { organization_id: orgId }),
      api.get(`/organizations/${orgId}/framework-layout`),
    ]).then(([es, rs, lo]) => { setEntities(es); setRels(rs); setOverrides(lo.overrides || {}); })
      .finally(() => setLoading(false));
  }, [orgId]);
  useEffect(load, [load]);

  const fit = useCallback((rect) => {
    const el = wrapRef.current; if (!el) return;
    const vw = el.clientWidth, vh = el.clientHeight;
    const scale = Math.min(vw / rect.w, vh / rect.h) * 0.96;
    setView({ scale, tx: (vw - rect.w * scale) / 2 - rect.x * scale, ty: (vh - rect.h * scale) / 2 - rect.y * scale });
  }, []);
  useEffect(() => { const t = setTimeout(() => fit(RECTS.all), 60); return () => clearTimeout(t); }, [fit, orgId]);

  const onWheel = (e) => {
    e.preventDefault();
    const r = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setView((v) => {
      const s = Math.min(2.5, Math.max(0.12, v.scale * factor));
      return { scale: s, tx: mx - (mx - v.tx) * (s / v.scale), ty: my - (my - v.ty) * (s / v.scale) };
    });
  };
  const onDown = (e) => { if (e.button !== 0) return; pan.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }; };
  const onMove = (e) => {
    const dp = dragPiece.current;
    if (dp) {
      const dx = (e.clientX - dp.sx) / view.scale, dy = (e.clientY - dp.sy) / view.scale;
      setOverrides((o) => ({ ...o, [dp.id]: { x: snap(dp.ox + dx), y: snap(dp.oy + dy) } }));
      setDirty(true); return;
    }
    if (pan.current) setView((v) => ({ ...v, tx: pan.current.tx + (e.clientX - pan.current.x), ty: pan.current.ty + (e.clientY - pan.current.y) }));
  };
  const onUp = () => { pan.current = null; dragPiece.current = null; };

  const ov = (id, bx, by) => { const o = overrides[id]; return { left: o ? o.x : bx, top: o ? o.y : by }; };
  const startDrag = (id, bx, by) => (e) => {
    e.stopPropagation(); e.preventDefault();
    const cur = overrides[id] || { x: bx, y: by };
    dragPiece.current = { id, sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y };
  };

  const saveLayout = async () => {
    try { await api.put(`/organizations/${orgId}/framework-layout`, { overrides }); setDirty(false); toast.success("Layout saved for this company"); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  const resetLayout = async () => {
    try { await api.put(`/organizations/${orgId}/framework-layout`, { overrides: {} }); setOverrides({}); setDirty(false); toast.success("Reset to default composition"); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  const addItem = (area, phase) => async (e) => {
    e.stopPropagation();
    try {
      const r = await api.post("/entities", { etype: "initiative", organization_id: orgId, status: "draft",
        data: { name: "New initiative", area, phase, status: "in_progress", owner: "" } });
      toast.success("Initiative added to cell"); await load(); setSelectedId(r.id);
    } catch (ex) { toast.error(apiErr(ex.response?.data?.detail)); }
  };

  const caps = useMemo(() => entities.filter((e) => e.etype === "capability"), [entities]);
  const areaOf = useMemo(() => {
    const m = {};
    caps.forEach((c) => { if (c.data.area) m[c.id] = c.data.area; });
    for (let k = 0; k < 4; k++) rels.forEach((r) => {
      if (m[r.from_id] && !m[r.to_id]) m[r.to_id] = m[r.from_id];
      if (m[r.to_id] && !m[r.from_id]) m[r.from_id] = m[r.to_id];
    });
    entities.forEach((e) => { if (e.data.area) m[e.id] = e.data.area; });
    return m;
  }, [entities, rels, caps]);
  const capByArea = useMemo(() => { const m = {}; caps.forEach((c) => { if (c.data.area) m[c.data.area] = c; }); return m; }, [caps]);
  const recs = useCallback((area, type) => entities.filter((e) => e.etype === type && areaOf[e.id] === area), [entities, areaOf]);
  const matches = useCallback((e) => search && !JSON.stringify(e.data).toLowerCase().includes(search.toLowerCase()), [search]);
  const open = (id) => (ev) => { ev.stopPropagation(); if (!dragPiece.current) setSelectedId(id); };

  if (!orgId) return <div className="p-10 text-muted-foreground">Select a company.</div>;

  const Chip = ({ e, color }) => e ? (
    <button data-testid={`fc-rec-${e.id}`} onClick={open(e.id)} title={e.data.name}
      style={{ borderColor: color, opacity: matches(e) ? 0.3 : 1 }}
      className="block w-full text-left truncate rounded border bg-white hover:bg-slate-50 px-1.5 py-[3px] text-[11px] text-slate-700 transition-colors">
      {!e.data.human_owner && !e.data.owner && ["agent", "process"].includes(e.etype) && <span className="text-gray-500">⚠ </span>}
      {e.data.adoption_items?.some((a) => a.state !== "accepted") && <span className="text-gray-500" title="adoption incomplete">◷ </span>}
      {e.data.name}
    </button>
  ) : null;

  const Grip = ({ id, bx, by }) => arrange && canWrite ? (
    <button data-testid={`fc-drag-${id}`} onMouseDown={startDrag(id, bx, by)}
      className="absolute -left-1 -top-1 z-10 h-5 w-5 rounded bg-slate-800 text-white flex items-center justify-center cursor-move shadow">
      <GripVertical className="h-3 w-3" />
    </button>
  ) : null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-4 pb-2 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Living Framework</h1>
          <p className="text-sm text-muted-foreground">{currentOrg?.name} · drag to pan, scroll to zoom, click any record. {canWrite && "Turn on Arrange to move pieces."}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Ctrl onClick={() => fit(RECTS.all)} testid="fc-fit-all" icon={Maximize2}>Fit framework</Ctrl>
          {[["A", "Org chart"], ["B", "Reference model"], ["C", "Roadmap"], ["D", "Value chain"]].map(([k, l]) => (
            <Ctrl key={k} onClick={() => fit(RECTS[k])} testid={`fc-fit-${k}`} icon={Crosshair}>{l}</Ctrl>
          ))}
          <Ctrl onClick={() => setView((v) => ({ ...v, scale: Math.min(2.5, v.scale * 1.15) }))} testid="fc-zoom-in" icon={Plus} />
          <Ctrl onClick={() => setView((v) => ({ ...v, scale: Math.max(0.12, v.scale * 0.87) }))} testid="fc-zoom-out" icon={Minus} />
          {canWrite && (
            <Ctrl onClick={() => setArrange((a) => !a)} testid="fc-arrange-toggle" icon={Move} active={arrange}>Arrange</Ctrl>
          )}
        </div>
      </div>

      {canWrite && (dirty || arrange) && (
        <div className="mx-6 mb-2 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm" data-testid="fc-layout-bar">
          <span className="text-primary">{dirty ? "Layout changed — unsaved" : "Arrange mode on — drag the ⠿ handles"}</span>
          <div className="flex-1" />
          <button data-testid="fc-save-layout" disabled={!dirty} onClick={saveLayout}
            className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-xs disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Save</button>
          <button data-testid="fc-reset-layout" onClick={resetLayout}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Reset to default</button>
        </div>
      )}

      <div ref={wrapRef} data-testid="framework-canvas"
        onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        className="flex-1 mx-4 mb-4 rounded-xl overflow-hidden border border-border relative cursor-grab active:cursor-grabbing"
        style={{ background: "repeating-linear-gradient(0deg,#f3f4f6,#f3f4f6 1px,transparent 1px,transparent 24px),repeating-linear-gradient(90deg,#f3f4f6,#f3f4f6 1px,transparent 1px,transparent 24px),#ffffff" }}>
        <div style={{ position: "absolute", width: CW, height: CH, transformOrigin: "0 0", transform: `translate(${view.tx}px,${view.ty}px) scale(${view.scale})` }}>
          <div className="absolute rounded-2xl bg-white shadow-2xl" style={{ left: -16, top: -16, width: CW + 32, height: CH + 32 }} />

          {/* A — OPERATING / AGENT ORGANIZATION */}
          <Section id="sec-A" base={RECTS.A} ov={ov} title="A · Operating & Agent Organization" grip={<Grip id="sec-A" bx={RECTS.A.x} by={RECTS.A.y} />}>
            <div className="absolute flex gap-2" style={{ left: 16, top: 44, width: 560 }}>
              {PHASES.map((p) => (
                <div key={p.n} className="flex-1 rounded-lg border p-2" style={{ borderColor: p.color, borderStyle: p.n === 3 ? "dashed" : "solid" }}>
                  <div className="text-[11px] font-bold" style={{ color: p.color }}>Phase {p.n}</div>
                  <div className="text-[12px] font-semibold text-slate-800 leading-tight">{p.name}</div>
                </div>
              ))}
            </div>
            <div className="absolute" style={{ left: 600, top: 40, width: 1440 }}>
              <div className="mx-auto w-[320px] rounded-lg border-2 border-slate-800 bg-slate-50 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Company</div>
                <div className="text-[15px] font-bold text-slate-900">{currentOrg?.name}</div>
                <div className="text-[9px] text-slate-500 capitalize">{currentOrg?.org_kind?.replace(/_/g, " ")}</div>
              </div>
              <div className="flex justify-center gap-3 mt-3">
                {entities.filter((e) => e.etype === "role" && e.data.type === "human_executive").map((r) => <ExecCard key={r.id} r={r} onClick={open(r.id)} label="Human accountability" />)}
                {entities.filter((e) => e.etype === "role" && e.data.type === "coordination_agent").map((r) => <ExecCard key={r.id} r={r} onClick={open(r.id)} label="Coordination role" accent />)}
              </div>
            </div>
            <div className="absolute rounded-lg border border-slate-200 bg-slate-50 p-2" style={{ left: 2064, top: 40, width: 560 }}>
              <div className="text-[11px] font-bold text-slate-700 mb-1">Legend</div>
              <div className="flex flex-wrap gap-1.5">
                {[["Human role", "#334155"], ["Agent / Co-Pilot", "#14b8a6"], ["Knowledge brain", "#f59e0b"], ["System / tool", "#8b5cf6"], ["Governance lane", "#ef4444"]].map(([l, c]) => (
                  <span key={l} className="flex items-center gap-1 text-[10px] text-slate-600"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{l}</span>
                ))}
              </div>
              <div className="text-[11px] font-bold text-slate-700 mt-2 mb-1">Systems & integrations</div>
              <div className="flex flex-wrap gap-1">
                {entities.filter((e) => e.etype === "system").slice(0, 10).map((s) => (
                  <button key={s.id} onClick={open(s.id)} className="rounded border border-violet-300 bg-white px-1.5 py-[2px] text-[10px] text-slate-600 hover:bg-violet-50">{s.data.name}</button>
                ))}
                {entities.filter((e) => e.etype === "system").length === 0 && <span className="text-[10px] text-slate-400">none recorded</span>}
              </div>
            </div>

            <div className="absolute" style={{ left: 8, top: 196, width: 2624, height: 576 }}>
              {ROW_LABELS.map((lbl, i) => (
                <div key={lbl} className="absolute text-[10px] font-semibold uppercase tracking-wide text-slate-400 text-right pr-2" style={{ left: 0, width: 150, top: ROW_Y[i] }}>{lbl}</div>
              ))}
              {FUNCTION_BRANCHES.map((b, ci) => {
                const bx = 158 + ci * 274;
                const lead = recs(b.key, "role").find((r) => r.data.type === "human_head") || recs(b.key, "role")[0];
                const brain = recs(b.key, "knowledge_source")[0];
                const agents = recs(b.key, "agent");
                const systems = recs(b.key, "system");
                return (
                  <div key={b.key} className="absolute" style={{ ...ov(`brA-${b.key}`, bx, 0), width: 262 }}>
                    <Grip id={`brA-${b.key}`} bx={bx} by={0} />
                    <div className="rounded-md px-2 py-1 text-center text-[12px] font-bold text-white" style={{ top: ROW_Y[0], position: "absolute", width: 262, background: b.color }}>{b.label}</div>
                    <BranchCell top={ROW_Y[1]}><Chip e={lead} color="#334155" /></BranchCell>
                    <BranchCell top={ROW_Y[2]}><Chip e={brain} color="#f59e0b" /></BranchCell>
                    <div className="absolute flex gap-1" style={{ top: ROW_Y[3], width: 262 }}>
                      {PHASES.map((p) => <div key={p.n} className="flex-1 rounded border text-center text-[10px] py-[2px]" style={{ borderColor: p.color, color: p.color, borderStyle: p.n === 3 ? "dashed" : "solid" }}>P{p.n}·{agents.filter((a) => (a.data.phase || 1) === p.n).length}</div>)}
                    </div>
                    <div className="absolute space-y-0.5" style={{ top: ROW_Y[4], width: 262 }}>
                      {agents.slice(0, 4).map((a) => <Chip key={a.id} e={a} color={b.color} />)}
                      {agents.length === 0 && <div className="text-[10px] text-slate-300 italic">no agents</div>}
                    </div>
                    <div className="absolute flex flex-wrap gap-0.5" style={{ top: ROW_Y[5], width: 262 }}>
                      {systems.slice(0, 3).map((s) => <Chip key={s.id} e={s} color="#8b5cf6" />)}
                    </div>
                    <BranchCell top={ROW_Y[6]}><div className="text-[10px] text-slate-500 truncate">{lead?.data.accountable_owner || <span className="text-gray-500">⚠ unassigned</span>}</div></BranchCell>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* B — BUSINESS REFERENCE MODEL */}
          <Section id="sec-B" base={RECTS.B} ov={ov} title="B · Business Reference Model" grip={<Grip id="sec-B" bx={RECTS.B.x} by={RECTS.B.y} />}>
            {CANON_AREAS.map((a, idx) => {
              const row = idx < 4 ? 0 : idx < 8 ? 1 : 2;
              const col = idx < 4 ? idx : idx < 8 ? idx - 4 : idx - 8;
              const bx = 12 + col * 378, by = 44 + row * 392;
              const cap = capByArea[a.key];
              const procs = recs(a.key, "process"), agents = recs(a.key, "agent"), opps = recs(a.key, "opportunity"), knows = recs(a.key, "knowledge_source");
              const stateVal = cap ? (state === "target" ? cap.data.target_state : cap.data.current_state) : null;
              return (
                <div key={a.key} className="absolute rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden" style={{ ...ov(`pnl-${a.key}`, bx, by), width: 366, height: 376 }}>
                  <Grip id={`pnl-${a.key}`} bx={bx} by={by} />
                  <button onClick={cap ? open(cap.id) : undefined} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-white text-left" style={{ background: a.color }}>
                    <span className="h-5 w-5 shrink-0 rounded-full bg-white/25 flex items-center justify-center text-[11px] font-bold">{a.no}</span>
                    <span className="text-[13px] font-bold leading-tight">{a.label}</span>
                  </button>
                  <div className="p-2 space-y-1.5">
                    <div className="text-[10px] text-slate-500"><b className="uppercase">{state}</b>: {stateVal || <i>unknown</i>}</div>
                    <PanelGroup title="Capabilities & roles" items={recs(a.key, "role")} color="#334155" Chip={Chip} empty="—" />
                    <PanelGroup title="AI workflows & agents" items={agents} color={a.color} Chip={Chip} empty="no agents yet" />
                    <PanelGroup title="Opportunities & knowledge" items={[...opps, ...knows]} color="#f59e0b" Chip={Chip} empty="—" />
                    {procs.length > 0 && <PanelGroup title="Processes" items={procs} color="#0ea5e9" Chip={Chip} />}
                    {cap?.data.applicable === false && <div className="text-[10px] text-slate-400 italic">Marked not applicable</div>}
                  </div>
                </div>
              );
            })}
          </Section>

          {/* C — THREE-PHASE ROADMAP */}
          <Section id="sec-C" base={RECTS.C} ov={ov} title="C · Three-Phase Transformation Roadmap" grip={<Grip id="sec-C" bx={RECTS.C.x} by={RECTS.C.y} />}>
            <div className="absolute" style={{ left: 12, top: 44, width: 1046 }}>
              <div className="flex text-[11px] font-bold text-slate-600">
                <div style={{ width: 150 }}>Business area</div>
                {PHASES.map((p) => <div key={p.n} className="flex-1 text-center" style={{ color: p.color }}>Phase {p.n} · {p.name}</div>)}
              </div>
              {CANON_AREAS.map((a) => {
                const items = (ph) => [...recs(a.key, "initiative"), ...recs(a.key, "agent")].filter((i) => (i.data.phase || 1) === ph);
                return (
                  <div key={a.key} className="flex items-stretch border-t border-slate-200" style={{ minHeight: 42 }}>
                    <div style={{ width: 150 }} className="flex items-center gap-1 py-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.color }} />
                      <span className="text-[11px] text-slate-700 leading-tight">{a.no}. {a.label}</span>
                    </div>
                    {PHASES.map((p) => (
                      <div key={p.n} className="group relative flex-1 border-l border-slate-100 p-1 space-y-0.5">
                        {canWrite && <button data-testid={`fc-add-${a.key}-${p.n}`} onClick={addItem(a.key, p.n)} className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 h-4 w-4 rounded bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]">+</button>}
                        {items(p.n).slice(0, 3).map((i) => (
                          <button key={i.id} data-testid={`fc-rec-${i.id}`} onClick={open(i.id)} style={{ borderLeftColor: p.color, borderLeftStyle: p.n === 3 ? "dashed" : "solid" }} className="block w-full truncate rounded-sm border-l-2 bg-white px-1 py-[2px] text-left text-[10px] text-slate-600 hover:bg-slate-50">
                            {i.etype === "initiative" ? "◆ " : "● "}
                            {i.data.adoption_items?.some((x) => x.state !== "accepted") && <span className="text-gray-500">◷ </span>}
                            {i.data.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* D — BUSINESS VALUE CHAIN */}
          <Section id="sec-D" base={RECTS.D} ov={ov} title="D · Business Value Chain" grip={<Grip id="sec-D" bx={RECTS.D.x} by={RECTS.D.y} />}>
            {VALUE_STAGES.map((st, i) => {
              const bx = 16 + i * 254;
              const items = st.areas.flatMap((k) => [...recs(k, "process"), ...recs(k, "agent")]).slice(0, 4);
              return (
                <div key={st.label} className="absolute rounded-lg border border-slate-300 bg-slate-50 p-2" style={{ ...ov(`stg-${i}`, bx, 46), width: 240 }}>
                  <Grip id={`stg-${i}`} bx={bx} by={46} />
                  {i < VALUE_STAGES.length - 1 && <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">→</div>}
                  <div className="text-[12px] font-bold text-slate-800 leading-tight mb-1">{st.label}</div>
                  <div className="space-y-0.5">
                    {items.map((e) => <Chip key={e.id} e={e} color="#0ea5e9" />)}
                    {items.length === 0 && <div className="text-[10px] text-slate-400 italic">—</div>}
                  </div>
                </div>
              );
            })}
            <div className="absolute" style={{ left: 16, top: 300, width: 1038 }}>
              <div className="text-[11px] font-bold text-slate-500 mb-1">Supporting functions</div>
              <div className="flex gap-1">
                {["tech", "data", "finance", "hr"].map((k) => {
                  const a = CANON_AREAS.find((x) => x.key === k); const cap = capByArea[k];
                  return (
                    <button key={k} onClick={cap ? open(cap.id) : undefined} className="flex-1 rounded-lg border bg-white p-2 text-left hover:bg-slate-50" style={{ borderColor: a.color }}>
                      <div className="text-[11px] font-semibold text-slate-700">{a.label}</div>
                      <div className="text-[10px] text-slate-400">{recs(k, "agent").length} agents</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 rounded-lg border-2 border-dashed p-2" style={{ borderColor: "#ef4444" }}>
                <div className="text-[11px] font-bold" style={{ color: "#ef4444" }}>Legal, Risk & Compliance — cross-cutting governance</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {[...recs("legal", "agent"), ...recs("legal", "decision"), ...recs("legal", "risk_review")].slice(0, 6).map((e) => <Chip key={e.id} e={e} color="#ef4444" />)}
                  {recs("legal", "agent").length === 0 && <span className="text-[10px] text-slate-400">governs every stage above</span>}
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[11px] text-gray-500 bg-white/90 border border-gray-200 rounded px-2 py-1">
          <Info className="h-3 w-3" /> Zoom {(view.scale * 100).toFixed(0)}% · live records — edits reflect everywhere
        </div>
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-gray-600 text-sm" data-testid="fc-loading">Loading framework…</div>}
      </div>
    </div>
  );
}

function Section({ id, base, ov, title, grip, children }) {
  const pos = ov(id, base.x, base.y);
  return (
    <div className="absolute rounded-xl border border-slate-200 bg-white" style={{ left: pos.left, top: pos.top, width: base.w, height: base.h }}>
      {grip}
      <div className="absolute left-3 top-2 text-[13px] font-bold text-slate-400 tracking-wide">{title}</div>
      {children}
    </div>
  );
}
function ExecCard({ r, onClick, label, accent }) {
  return (
    <button onClick={onClick} data-testid={`fc-rec-${r.id}`} className="rounded-lg border-2 bg-white p-2 w-[180px] text-left hover:bg-slate-50" style={{ borderColor: accent ? "#14b8a6" : "#1e293b" }}>
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-[13px] font-bold text-slate-900 leading-tight">{r.data.name}</div>
      <div className="text-[10px] text-slate-500">{r.data.accountable_owner || "—"}</div>
    </button>
  );
}
function BranchCell({ top, children }) { return <div className="absolute" style={{ top, width: 262 }}>{children}</div>; }
function PanelGroup({ title, items, color, Chip, empty }) {
  if (!items.length && !empty) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-500">{title}</div>
      <div className="space-y-0.5 mt-0.5">
        {items.slice(0, 4).map((e) => <Chip key={e.id} e={e} color={color} />)}
        {items.length === 0 && empty && <div className="text-[10px] text-slate-300 italic">{empty}</div>}
      </div>
    </div>
  );
}
function Ctrl({ onClick, icon: Icon, children, testid, active }) {
  return (
    <button onClick={onClick} data-testid={testid}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${active ? "border-primary bg-primary/20 text-primary" : "border-border bg-muted/40 text-foreground/80 hover:bg-accent"}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}{children}
    </button>
  );
}
