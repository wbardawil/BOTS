import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { CANON_AREAS, FUNCTION_BRANCHES, PHASES, INK, LINE, MUTED, tint } from "@/lib/constants";
import { Maximize2, Plus, Minus, Crosshair, Info, Move, Save, RotateCcw, GripVertical, User, Bot, Database } from "lucide-react";
import { toast } from "sonner";

// Board geometry (poster coordinates). Visual language: memory/DESIGN.md
const CW = 2640, CH = 2060;
const RECTS = {
  all: { x: -20, y: -20, w: CW + 40, h: CH + 40 },
  A: { x: 0, y: 0, w: 2640, h: 780 },
  B: { x: 0, y: 810, w: 1540, h: 1240 },
  C: { x: 1570, y: 810, w: 1070, h: 560 },
  D: { x: 1570, y: 1400, w: 1070, h: 650 },
};
const ROW_LABELS = ["Team", "Head of team", "AI team brain", "Phases", "Individual agents", "Agent tools", "Employees", "Accountable"];
const ROW_Y = [0, 22, 100, 128, 152, 262, 306, 352];
const COL_W = 262, COL_STEP = 274, COL_X0 = 158;
const VALUE_STAGES = [
  { label: "Strategic Planning & Leadership", areas: ["strategy"] },
  { label: "Product & Operations", areas: ["product", "operations"] },
  { label: "Marketing & Sales", areas: ["marketing", "sales"] },
  { label: "Delivery & Customer Support", areas: ["customer"] },
];
const HEAD_TYPES = ["human_head", "human_executive", "coordination_agent"];
const snap = (n) => Math.round(n / 8) * 8;
const initials = (s = "") => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "•";

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
  // "Information sharing" between two areas: any shares_info / coordinates relationship crossing them
  const sharesBetween = useCallback((a, b) => rels.some((r) => ["shares_info", "coordinates"].includes(r.rel_type) &&
    ((areaOf[r.from_id] === a && areaOf[r.to_id] === b) || (areaOf[r.from_id] === b && areaOf[r.to_id] === a))), [rels, areaOf]);
  const lastUpdated = useMemo(() => entities.reduce((m, e) => (e.updated_at && e.updated_at > m ? e.updated_at : m), ""), [entities]);
  const phaseOf = (e) => e.data.phase || 1;
  const phaseMeta = (n) => PHASES.find((p) => p.n === n) || PHASES[0];

  if (!orgId) return <div className="p-10 text-muted-foreground">Select a company.</div>;

  // ---- board primitives ------------------------------------------------------------------
  const Chip = ({ e, color = LINE, code, phase }) => e ? (
    <button data-testid={`fc-rec-${e.id}`} onClick={open(e.id)} title={e.data.name}
      style={{ borderColor: LINE, boxShadow: `inset 3px 0 0 ${phase ? phaseMeta(phase).color : color}`, opacity: matches(e) ? 0.3 : 1 }}
      className="flex w-full items-center gap-1 rounded-md border bg-white hover:bg-gray-50 pl-2.5 pr-1.5 py-[3px] text-[11px] text-gray-700 text-left transition-colors">
      {code && <span className="mono text-[9px] text-gray-400 shrink-0">{code}</span>}
      {phase && <span className="text-[9px] font-semibold shrink-0" style={{ color: phaseMeta(phase).color }}>P{phase}</span>}
      {!e.data.human_owner && !e.data.owner && ["agent", "process"].includes(e.etype) && <span className="text-amber-500 shrink-0" title="no accountable owner">⚠</span>}
      {e.data.adoption_items?.some((a) => a.state !== "accepted") && <span className="text-blue-500 shrink-0" title="adoption incomplete">◷</span>}
      <span className="truncate">{e.data.name}</span>
    </button>
  ) : null;

  const Grip = ({ id, bx, by }) => arrange && canWrite ? (
    <button data-testid={`fc-drag-${id}`} onMouseDown={startDrag(id, bx, by)}
      className="absolute -left-1 -top-1 z-10 h-5 w-5 rounded bg-gray-900 text-white flex items-center justify-center cursor-move shadow-sm">
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
        <div className="mx-6 mb-2 flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm" data-testid="fc-layout-bar">
          <span className="text-gray-800">{dirty ? "Layout changed — unsaved" : "Arrange mode on — drag the ⠿ handles"}</span>
          <div className="flex-1" />
          <button data-testid="fc-save-layout" disabled={!dirty} onClick={saveLayout}
            className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-xs disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Save</button>
          <button data-testid="fc-reset-layout" onClick={resetLayout}
            className="flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Reset to default</button>
        </div>
      )}

      <div ref={wrapRef} data-testid="framework-canvas"
        onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        className="board flex-1 mx-4 mb-4 rounded-xl overflow-hidden border border-border relative cursor-grab active:cursor-grabbing">
        <div style={{ position: "absolute", width: CW, height: CH, transformOrigin: "0 0", transform: `translate(${view.tx}px,${view.ty}px) scale(${view.scale})` }}>
          <div className="absolute rounded-2xl bg-white border border-gray-200 shadow-sm" style={{ left: -16, top: -16, width: CW + 32, height: CH + 32 }} />

          {/* A — AI AGENT ORG CHART */}
          <Section id="sec-A" base={RECTS.A} ov={ov} title="AI agent org chart" grip={<Grip id="sec-A" bx={RECTS.A.x} by={RECTS.A.y} />}
            meta={lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleDateString()}` : null}>
            {/* high-level functionality: three phases, grayscale */}
            <div className="absolute" style={{ left: 16, top: 40, width: 560 }}>
              <div className="text-[12px] font-bold text-gray-900 mb-1.5">High-level functionality</div>
              <div className="flex gap-2">
                {PHASES.map((p) => (
                  <div key={p.n} className="flex-1 rounded-lg border bg-white p-2" style={{ borderColor: p.color, borderStyle: p.dashed ? "dashed" : "solid" }}>
                    <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: p.color }}>Phase {p.n}</div>
                    <div className="text-[12px] font-semibold text-gray-900 leading-tight">{p.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* executives → chief */}
            <div className="absolute" style={{ left: 600, top: 40, width: 1440 }}>
              <div className="text-center text-[11px] text-gray-500 mb-1">{currentOrg?.name} · <span className="capitalize">{currentOrg?.org_kind?.replace(/_/g, " ")}</span> · human executive team</div>
              <div className="flex justify-center gap-3">
                {entities.filter((e) => e.etype === "role" && e.data.type === "human_executive").map((r) => <ExecCard key={r.id} r={r} onClick={open(r.id)} />)}
              </div>
              <div className="mx-auto mt-1 h-3 w-px bg-gray-300" />
              <div className="flex flex-col items-center">
                {(() => {
                  const chief = entities.find((e) => e.etype === "role" && e.data.type === "coordination_agent");
                  return (
                    <button onClick={chief ? open(chief.id) : undefined} data-testid={chief ? `fc-rec-${chief.id}` : undefined} className="flex flex-col items-center gap-1">
                      <Avatar color={INK} size={56} icon={Bot} />
                      <NamePill>{chief?.data.name || "Chief agent"}</NamePill>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* legend + systems */}
            <div className="absolute rounded-lg border border-gray-200 bg-white p-2" style={{ left: 2064, top: 40, width: 560 }}>
              <div className="text-[11px] font-bold text-gray-900 mb-1">Legend</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {[["Human role", INK, User], ["AI agent / co-pilot", "#22c55e", Bot], ["Knowledge brain", "#f59e0b", Database]].map(([l, c, I]) => (
                  <span key={l} className="flex items-center gap-1 text-[10px] text-gray-600"><I className="h-3 w-3" style={{ color: c }} />{l}</span>
                ))}
                {PHASES.map((p) => (
                  <span key={p.n} className="flex items-center gap-1 text-[10px] text-gray-600"><span className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: p.color, borderStyle: p.dashed ? "dashed" : "solid" }} />Phase {p.n}</span>
                ))}
              </div>
              <div className="text-[11px] font-bold text-gray-900 mt-2 mb-1">Tools, integrations & software assets</div>
              <div className="flex flex-wrap gap-1">
                {entities.filter((e) => e.etype === "system").slice(0, 12).map((s) => (
                  <button key={s.id} onClick={open(s.id)} className="rounded-md border border-gray-200 bg-white px-1.5 py-[2px] text-[10px] text-gray-700 hover:bg-gray-50">{s.data.name}</button>
                ))}
                {entities.filter((e) => e.etype === "system").length === 0 && <span className="text-[10px] text-gray-400">none recorded</span>}
              </div>
            </div>

            {/* team band */}
            <div className="absolute" style={{ left: 8, top: 216, width: 2624, height: 556 }}>
              {ROW_LABELS.map((lbl, i) => (
                <div key={lbl} className="absolute text-[10px] font-semibold uppercase tracking-wide text-gray-400 text-right pr-2" style={{ left: 0, width: 150, top: ROW_Y[i] + (i === 1 ? 24 : 0) }}>{lbl}</div>
              ))}
              {FUNCTION_BRANCHES.map((b, ci) => {
                const bx = COL_X0 + ci * COL_STEP;
                const roles = recs(b.key, "role");
                const lead = roles.find((r) => r.data.type === "human_head") || roles[0];
                const staff = roles.filter((r) => r !== lead && !HEAD_TYPES.includes(r.data.type));
                const brain = recs(b.key, "knowledge_source")[0];
                const agents = [...recs(b.key, "agent")].sort((a, z) => phaseOf(a) - phaseOf(z));
                const systems = recs(b.key, "system");
                const next = FUNCTION_BRANCHES[ci + 1];
                const linked = next && sharesBetween(b.key, next.key);
                return (
                  <div key={b.key} className="absolute" style={{ ...ov(`brA-${b.key}`, bx, 0), width: COL_W }}>
                    <Grip id={`brA-${b.key}`} bx={bx} by={0} />
                    {/* team */}
                    <div className="absolute text-center text-[13px] font-bold text-gray-900" style={{ top: ROW_Y[0], width: COL_W }}>{b.label}</div>
                    {/* head of team */}
                    <div className="absolute flex flex-col items-center" style={{ top: ROW_Y[1], width: COL_W }}>
                      <button onClick={lead ? open(lead.id) : undefined} data-testid={lead ? `fc-rec-${lead.id}` : undefined} className="flex flex-col items-center gap-1" title={lead?.data.name}>
                        <Avatar color={b.color} size={44} label={initials(lead?.data.accountable_owner || lead?.data.name)} />
                        <NamePill>{lead?.data.accountable_owner || lead?.data.name || "unassigned"}</NamePill>
                      </button>
                    </div>
                    {linked && (
                      <>
                        <div className="absolute h-px bg-gray-300" style={{ top: ROW_Y[1] + 22, left: COL_W / 2 + 22, width: COL_STEP - 44 }} />
                        <div className="absolute rounded-full border border-gray-300 bg-white px-1.5 text-[8px] text-gray-500 whitespace-nowrap" style={{ top: ROW_Y[1] + 15, left: COL_W + 6 - 42 }}>Information sharing</div>
                      </>
                    )}
                    {/* brain */}
                    <BranchCell top={ROW_Y[2]}>
                      {brain ? <Chip e={brain} color="#f59e0b" /> : <Ghost>no knowledge brain</Ghost>}
                    </BranchCell>
                    {/* phases */}
                    <div className="absolute flex gap-1" style={{ top: ROW_Y[3], width: COL_W }}>
                      {PHASES.map((p) => (
                        <div key={p.n} className="flex-1 rounded border bg-white text-center text-[10px] py-[2px]" style={{ borderColor: p.color, color: p.color, borderStyle: p.dashed ? "dashed" : "solid" }}>
                          P{p.n} · {agents.filter((a) => phaseOf(a) === p.n).length}
                        </div>
                      ))}
                    </div>
                    {/* agents sorted by phase */}
                    <div className="absolute space-y-0.5" style={{ top: ROW_Y[4], width: COL_W }}>
                      {agents.slice(0, 5).map((a) => <Chip key={a.id} e={a} phase={phaseOf(a)} />)}
                      {agents.length > 5 && <div className="text-[10px] text-gray-400 pl-1">+{agents.length - 5} more</div>}
                      {agents.length === 0 && <Ghost>no agents</Ghost>}
                    </div>
                    {/* tools */}
                    <div className="absolute flex flex-wrap gap-0.5" style={{ top: ROW_Y[5], width: COL_W }}>
                      {systems.slice(0, 3).map((s) => <Chip key={s.id} e={s} color="#8b5cf6" />)}
                      {systems.length === 0 && <Ghost>no tools linked</Ghost>}
                    </div>
                    {/* employees */}
                    <div className="absolute space-y-0.5" style={{ top: ROW_Y[6], width: COL_W }}>
                      {staff.slice(0, 2).map((r) => <Chip key={r.id} e={r} color={INK} />)}
                      {staff.length === 0 && <Ghost>no other roles</Ghost>}
                    </div>
                    {/* accountable */}
                    <BranchCell top={ROW_Y[7]}>
                      <div className="text-[10px] text-gray-500 truncate">{lead?.data.accountable_owner || <span className="text-amber-600">⚠ unassigned</span>}</div>
                    </BranchCell>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* B — BUSINESS REFERENCE MODEL */}
          <Section id="sec-B" base={RECTS.B} ov={ov} title="Business reference model" grip={<Grip id="sec-B" bx={RECTS.B.x} by={RECTS.B.y} />}>
            {CANON_AREAS.map((a, idx) => {
              const row = idx < 4 ? 0 : idx < 8 ? 1 : 2;
              const col = idx < 4 ? idx : idx < 8 ? idx - 4 : idx - 8;
              const bx = 12 + col * 378, by = 44 + row * 392;
              const cap = capByArea[a.key];
              const roles = recs(a.key, "role");
              const lead = roles.find((r) => r.data.type === "human_head");
              const procs = recs(a.key, "process"), agents = recs(a.key, "agent"), opps = recs(a.key, "opportunity"), knows = recs(a.key, "knowledge_source");
              const stateVal = cap ? (state === "target" ? cap.data.target_state : cap.data.current_state) : null;
              return (
                <div key={a.key} className="absolute rounded-lg border border-gray-200 bg-white overflow-hidden" style={{ ...ov(`pnl-${a.key}`, bx, by), width: 366, height: 376 }}>
                  <Grip id={`pnl-${a.key}`} bx={bx} by={by} />
                  <button onClick={cap ? open(cap.id) : undefined} className="w-full flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 text-left hover:bg-gray-50">
                    <Avatar color={a.color} size={22} label={String(a.no)} />
                    <span className="text-[13px] font-bold text-gray-900 leading-tight truncate">{a.no}. {a.label}</span>
                  </button>
                  <div className="px-2 py-1 flex items-center justify-between border-b border-gray-100">
                    <span className="text-[10px] text-gray-500 truncate">Department lead: <b className="text-gray-800">{lead?.data.accountable_owner || lead?.data.name || "—"}</b></span>
                    <span className="text-[10px] text-gray-500 shrink-0"><b className="uppercase">{state}</b>: {stateVal || <i>unknown</i>}</span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    <PanelGroup code={`${a.no}.1`} title="Capabilities & roles" items={roles} color={INK} Chip={Chip} empty="—" />
                    <PanelGroup code={`${a.no}.2`} title="AI workflows & agents" items={agents} color={a.color} Chip={Chip} empty="no agents yet" />
                    <PanelGroup code={`${a.no}.3`} title="Opportunities & knowledge" items={[...opps, ...knows]} color="#f59e0b" Chip={Chip} empty="—" />
                    {procs.length > 0 && <PanelGroup code={`${a.no}.4`} title="Processes" items={procs} color="#3b82f6" Chip={Chip} />}
                    {cap?.data.applicable === false && <div className="text-[10px] text-gray-400 italic">Marked not applicable</div>}
                  </div>
                </div>
              );
            })}
          </Section>

          {/* C — AI DEVELOPMENT ROADMAP */}
          <Section id="sec-C" base={RECTS.C} ov={ov} title="AI development roadmap" grip={<Grip id="sec-C" bx={RECTS.C.x} by={RECTS.C.y} />}>
            <div className="absolute rounded-lg border border-gray-200 overflow-hidden" style={{ left: 12, top: 44, width: 1046 }}>
              <div className="flex bg-gray-100 text-[11px] font-bold text-gray-700">
                <div className="px-2 py-1" style={{ width: 170 }}>Business area</div>
                {PHASES.map((p) => <div key={p.n} className="flex-1 text-center py-1 border-l border-gray-200" style={{ color: p.color }}>Phase {p.n} · {p.name}</div>)}
              </div>
              {CANON_AREAS.map((a) => {
                const items = (ph) => [...recs(a.key, "initiative"), ...recs(a.key, "agent")].filter((i) => phaseOf(i) === ph);
                return (
                  <div key={a.key} className="flex items-stretch border-t border-gray-200 bg-white" style={{ minHeight: 42 }}>
                    <div style={{ width: 170, borderLeft: `4px solid ${a.color}` }} className="flex items-center gap-1.5 px-1.5 py-1">
                      <Avatar color={a.color} size={16} label={String(a.no)} />
                      <span className="text-[11px] text-gray-800 leading-tight truncate">{a.label}</span>
                    </div>
                    {PHASES.map((p) => (
                      <div key={p.n} className="group relative flex-1 border-l border-gray-200 p-1 space-y-0.5">
                        {canWrite && <button data-testid={`fc-add-${a.key}-${p.n}`} onClick={addItem(a.key, p.n)} className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 h-4 w-4 rounded border border-gray-300 bg-white text-gray-600 flex items-center justify-center text-[10px]">+</button>}
                        {items(p.n).slice(0, 3).map((i) => (
                          <button key={i.id} data-testid={`fc-rec-${i.id}`} onClick={open(i.id)}
                            style={{ borderColor: p.dashed ? "#9ca3af" : LINE, borderStyle: p.dashed ? "dashed" : "solid", boxShadow: `inset 3px 0 0 ${a.color}` }}
                            className="block w-full truncate rounded-md border bg-white pl-2.5 pr-1.5 py-[2px] text-left text-[10px] text-gray-700 hover:bg-gray-50">
                            {i.etype === "initiative" ? "◆ " : "● "}
                            {i.data.adoption_items?.some((x) => x.state !== "accepted") && <span className="text-blue-500">◷ </span>}
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
          <Section id="sec-D" base={RECTS.D} ov={ov} title="Business value chain" grip={<Grip id="sec-D" bx={RECTS.D.x} by={RECTS.D.y} />}>
            {VALUE_STAGES.map((st, i) => {
              const bx = 16 + i * 254;
              const items = st.areas.flatMap((k) => [...recs(k, "process"), ...recs(k, "agent")]).slice(0, 4);
              const leadArea = CANON_AREAS.find((x) => x.key === st.areas[0]);
              const lead = recs(st.areas[0], "role").find((r) => r.data.type === "human_head");
              return (
                <div key={st.label} className="absolute" style={{ ...ov(`stg-${i}`, bx, 46), width: 240 }}>
                  <Grip id={`stg-${i}`} bx={bx} by={46} />
                  {i < VALUE_STAGES.length - 1 && <div className="absolute -right-[11px] top-[6px] text-gray-400 text-[14px] font-bold">›</div>}
                  <div className="rounded-full bg-gray-900 text-white text-[11px] font-semibold text-center px-2 py-[5px] leading-tight truncate">{st.label}</div>
                  <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Avatar color={leadArea?.color || INK} size={18} label={initials(lead?.data.accountable_owner || lead?.data.name)} />
                      <span className="text-[10px] text-gray-500 truncate">Core business functions</span>
                    </div>
                    <div className="space-y-0.5">
                      {items.map((e) => <Chip key={e.id} e={e} color={leadArea?.color || "#3b82f6"} />)}
                      {items.length === 0 && <Ghost>—</Ghost>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="absolute border-t border-dashed border-gray-300" style={{ left: 16, top: 282, width: 1038 }} />
            <div className="absolute" style={{ left: 16, top: 292, width: 1038 }}>
              <div className="text-[11px] font-bold text-gray-500 mb-1">Enabling business functions</div>
              <div className="flex gap-2">
                {["tech", "data", "finance", "hr"].map((k) => {
                  const a = CANON_AREAS.find((x) => x.key === k); const cap = capByArea[k];
                  const items = [...recs(k, "process"), ...recs(k, "agent")].slice(0, 3);
                  return (
                    <div key={k} className="flex-1 rounded-lg border bg-white p-2" style={{ borderColor: a.color }}>
                      <button onClick={cap ? open(cap.id) : undefined} className="w-full flex items-center gap-1.5 text-left">
                        <Avatar color={a.color} size={18} label={String(a.no)} />
                        <span className="text-[11px] font-semibold text-gray-900 truncate">{a.label}</span>
                      </button>
                      <div className="mt-1 space-y-0.5">
                        {items.map((e) => <Chip key={e.id} e={e} color={a.color} />)}
                        {items.length === 0 && <div className="text-[10px] text-gray-400">{recs(k, "agent").length} agents</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 rounded-lg border border-dashed p-2" style={{ borderColor: MUTED }}>
                <div className="text-[11px] font-bold" style={{ color: MUTED }}>11. Legal, Risk & Compliance — cross-cutting governance</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {[...recs("legal", "agent"), ...recs("legal", "decision"), ...recs("legal", "risk_review")].slice(0, 6).map((e) => <Chip key={e.id} e={e} color={MUTED} />)}
                  {recs("legal", "agent").length === 0 && <span className="text-[10px] text-gray-400">governs every stage above</span>}
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[11px] text-gray-600 bg-white/90 border border-gray-200 rounded-md px-2 py-1">
          <Info className="h-3 w-3" /> Zoom {(view.scale * 100).toFixed(0)}% · live records — edits reflect everywhere
        </div>
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-gray-600 text-sm" data-testid="fc-loading">Loading framework…</div>}
      </div>
    </div>
  );
}

// ---- building blocks -----------------------------------------------------------------------
function Section({ id, base, ov, title, meta, grip, children }) {
  const pos = ov(id, base.x, base.y);
  return (
    <div className="absolute rounded-xl border border-gray-200 bg-white" style={{ left: pos.left, top: pos.top, width: base.w, height: base.h }}>
      {grip}
      <div className="absolute left-3 top-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</div>
      {meta && <div className="absolute right-3 top-2 rounded-md border border-gray-200 px-1.5 py-[1px] text-[10px] text-gray-500">{meta}</div>}
      {children}
    </div>
  );
}
function Avatar({ color, size = 44, label, icon: Icon }) {
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size, background: tint(color), border: `${size >= 40 ? 2 : 1.5}px solid ${color}`, color }}>
      {Icon ? <Icon style={{ width: size * 0.48, height: size * 0.48 }} /> : <span style={{ fontSize: Math.max(8, size * 0.36), fontWeight: 700, lineHeight: 1 }}>{label}</span>}
    </div>
  );
}
function NamePill({ children }) {
  return <span className="inline-block max-w-[150px] truncate rounded-full px-2 py-[2px] text-[10px] font-semibold text-white" style={{ background: INK }}>{children}</span>;
}
function Ghost({ children }) { return <div className="text-[10px] text-gray-300 italic pl-1">{children}</div>; }
function ExecCard({ r, onClick }) {
  return (
    <button onClick={onClick} data-testid={`fc-rec-${r.id}`} className="flex items-center gap-2 rounded-lg border border-gray-900 bg-white px-2 py-1.5 w-[190px] text-left hover:bg-gray-50">
      <Avatar color={INK} size={28} icon={User} />
      <div className="min-w-0">
        <div className="text-[12px] font-bold text-gray-900 leading-tight truncate">{r.data.accountable_owner || r.data.name}</div>
        <div className="text-[10px] text-gray-500 truncate">{r.data.accountable_owner ? r.data.name : "Human accountability"}</div>
      </div>
    </button>
  );
}
function BranchCell({ top, children }) { return <div className="absolute" style={{ top, width: COL_W }}>{children}</div>; }
function PanelGroup({ code, title, items, color, Chip, empty }) {
  if (!items.length && !empty) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500"><span className="mono text-gray-400">{code}</span>{title}</div>
      <div className="space-y-0.5 mt-0.5">
        {items.slice(0, 4).map((e) => <Chip key={e.id} e={e} color={color} />)}
        {items.length === 0 && empty && <Ghost>{empty}</Ghost>}
      </div>
    </div>
  );
}
function Ctrl({ onClick, icon: Icon, children, testid, active }) {
  return (
    <button onClick={onClick} data-testid={testid}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${active ? "border-gray-900 bg-gray-900 text-white" : "border-border bg-white text-gray-700 hover:bg-gray-50"}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}{children}
    </button>
  );
}
