import { useEffect, useState, useCallback, useMemo } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import {
  WIDGET_LIBRARY, WIDGET_META, WIDGET_SPAN, WIDGET_SIZES, STAGES, STAGE_LABEL, CANON_AREAS,
} from "@/lib/constants";
import { roiOf, rollup, money, sum, ROI_STATUS } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Trash2, Maximize2, Save, RotateCcw, Share2, LayoutGrid, SlidersHorizontal, GripVertical, ArrowRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toast } from "sonner";

const uid = () => "w-" + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Math.random()).slice(2, 10));

export default function Dashboard() {
  const { orgId, currentOrg, setSelectedId, goInventory, reloadToken } = useScope();
  const [analytics, setAnalytics] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [cfg, setCfg] = useState({ is_personal: false, has_default: false, can_publish_default: false });
  const [editMode, setEditMode] = useState(false);
  const [filters, setFilters] = useState({ area: "", stage: "", owner: "", status: "" });
  const [dragIdx, setDragIdx] = useState(null);

  const load = useCallback(() => {
    if (!orgId) return;
    api.get(`/organizations/${orgId}/analytics`).then(setAnalytics).catch(() => setAnalytics(null));
    api.get(`/organizations/${orgId}/dashboard`).then((d) => {
      setWidgets(d.widgets);
      setCfg({ is_personal: d.is_personal, has_default: d.has_default, can_publish_default: d.can_publish_default });
    });
  }, [orgId]);
  useEffect(load, [load, reloadToken]);

  const records = analytics?.records || [];
  const owners = useMemo(() => [...new Set(records.map((r) => r.owner).filter(Boolean))].sort(), [records]);
  const filtered = useMemo(() => records.filter((r) =>
    (!filters.area || r.area === filters.area) &&
    (!filters.stage || r.stage === filters.stage) &&
    (!filters.owner || r.owner === filters.owner) &&
    (!filters.status || r.status === filters.status)), [records, filters]);

  const save = async () => {
    await api.put(`/organizations/${orgId}/dashboard`, { widgets });
    setCfg((c) => ({ ...c, is_personal: true }));
    setEditMode(false);
    toast.success("Your dashboard layout is saved.");
  };
  const publishDefault = async () => {
    try {
      await api.put(`/organizations/${orgId}/dashboard/default`, { widgets });
      toast.success("Published as the company default dashboard.");
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  const reset = async () => {
    await api.post(`/organizations/${orgId}/dashboard/reset`);
    toast.success("Reset to the company default.");
    load();
  };
  const addWidget = (type) => setWidgets((w) => [...w, { id: uid(), type, size: "md" }]);
  const removeWidget = (id) => setWidgets((w) => w.filter((x) => x.id !== id));
  const cycleSize = (id) => setWidgets((w) => w.map((x) => x.id === id
    ? { ...x, size: WIDGET_SIZES[(WIDGET_SIZES.indexOf(x.size) + 1) % WIDGET_SIZES.length] } : x));
  const move = (idx, dir) => setWidgets((w) => {
    const n = [...w]; const j = idx + dir; if (j < 0 || j >= n.length) return w;
    [n[idx], n[j]] = [n[j], n[idx]]; return n;
  });
  const onDrop = (idx) => { if (dragIdx == null || dragIdx === idx) return; setWidgets((w) => { const n = [...w]; const [m] = n.splice(dragIdx, 1); n.splice(idx, 0, m); return n; }); setDragIdx(null); };

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="p-6 max-w-[1500px] mx-auto fade-up">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> Dashboards</h1>
          <p className="text-sm text-muted-foreground">{currentOrg?.name} · live ROI & impact {cfg.is_personal && "· your layout"}</p>
        </div>
        <div className="flex items-center gap-2">
          {!editMode ? (
            <Button size="sm" variant="outline" data-testid="dash-edit-btn" onClick={() => setEditMode(true)}>
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Arrange
            </Button>
          ) : (
            <>
              <AddWidget onAdd={addWidget} />
              <Button size="sm" data-testid="dash-save-btn" onClick={save}><Save className="h-3.5 w-3.5 mr-1.5" /> Save layout</Button>
              {cfg.can_publish_default && <Button size="sm" variant="outline" data-testid="dash-publish-default" onClick={publishDefault}><Share2 className="h-3.5 w-3.5 mr-1.5" /> Publish default</Button>}
              <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); load(); }}>Done</Button>
            </>
          )}
          {cfg.is_personal && !editMode && (
            <Button size="sm" variant="ghost" data-testid="dash-reset-btn" onClick={reset}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset</Button>
          )}
        </div>
      </div>

      {/* Shared filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5 p-3 card-surface rounded-xl">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mr-1">Filters</span>
        <FilterSelect testid="filter-area" value={filters.area} onChange={(v) => setFilters({ ...filters, area: v })}
          placeholder="All areas" options={CANON_AREAS.map((a) => [a.key, a.label])} />
        <FilterSelect testid="filter-stage" value={filters.stage} onChange={(v) => setFilters({ ...filters, stage: v })}
          placeholder="All stages" options={STAGES.map((s) => [s.key, s.label])} />
        <FilterSelect testid="filter-owner" value={filters.owner} onChange={(v) => setFilters({ ...filters, owner: v })}
          placeholder="All owners" options={owners.map((o) => [o, o])} />
        <FilterSelect testid="filter-status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
          placeholder="Any status" options={[["draft", "Draft"], ["published", "Published"], ["archived", "Archived"]]} />
        {activeFilters > 0 && <button data-testid="filter-clear" onClick={() => setFilters({ area: "", stage: "", owner: "", status: "" })} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {records.length} records</span>
      </div>

      {!analytics ? <p className="text-muted-foreground text-sm">Loading…</p> : widgets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium text-foreground/80">No widgets yet</p>
          <p className="text-sm mt-1">Use Arrange → Add widget to build your dashboard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {widgets.map((w, idx) => (
            <div key={w.id} data-testid={`widget-${w.type}`}
              draggable={editMode} onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => editMode && e.preventDefault()} onDrop={() => onDrop(idx)}
              className={`${WIDGET_SPAN[w.size] || WIDGET_SPAN.md} card-surface rounded-xl p-4 ${editMode ? "ring-1 ring-primary/20" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  {editMode && <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab" />}
                  <h3 className="text-sm font-semibold truncate">{WIDGET_META[w.type]?.label || w.type}</h3>
                </div>
                {editMode && (
                  <div className="flex items-center gap-1 shrink-0">
                    <IconBtn testid={`widget-left-${w.id}`} onClick={() => move(idx, -1)} title="Move left">‹</IconBtn>
                    <IconBtn testid={`widget-right-${w.id}`} onClick={() => move(idx, 1)} title="Move right">›</IconBtn>
                    <IconBtn testid={`widget-size-${w.id}`} onClick={() => cycleSize(w.id)} title="Resize"><Maximize2 className="h-3 w-3" /></IconBtn>
                    <IconBtn testid={`widget-remove-${w.id}`} onClick={() => removeWidget(w.id)} title="Remove"><Trash2 className="h-3 w-3 text-destructive" /></IconBtn>
                  </div>
                )}
              </div>
              <Widget type={w.type} records={filtered} analytics={analytics}
                currency={analytics.currency} setSelectedId={setSelectedId} goInventory={goInventory} filters={filters} />
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-6">Numbers reflect live records. Widgets show “not measured yet” wherever inputs are missing — never an invented zero.</p>
    </div>
  );
}

const IconBtn = ({ children, onClick, testid, title }) => (
  <button data-testid={testid} title={title} onClick={onClick}
    className="h-6 w-6 flex items-center justify-center rounded border border-border hover:bg-accent text-xs">{children}</button>
);

function FilterSelect({ value, onChange, placeholder, options, testid }) {
  return (
    <select data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-white px-2 text-xs">
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function AddWidget({ onAdd }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" data-testid="dash-add-widget"><Plus className="h-3.5 w-3.5 mr-1.5" /> Add widget</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">Widget library</DropdownMenuLabel>
        {WIDGET_LIBRARY.map((w) => (
          <DropdownMenuItem key={w.type} data-testid={`add-widget-${w.type}`} onClick={() => onAdd(w.type)} className="flex flex-col items-start gap-0.5">
            <span className="text-sm font-medium">{w.label}</span>
            <span className="text-[11px] text-muted-foreground">{w.desc}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------- Widgets ----------------
function Widget({ type, records, analytics, currency, setSelectedId, goInventory, filters }) {
  if (type === "roi_rollup") return <RoiRollup records={records} currency={currency} />;
  if (type === "roi_by_initiative") return <RoiTable records={records} currency={currency} setSelectedId={setSelectedId} />;
  if (type === "time_freed") return <TimeFreed records={records} currency={currency} />;
  if (type === "measurement_cadence") return <Cadence records={records} currency={currency} />;
  if (type === "lifecycle_throughput") return <Throughput records={records} goInventory={goInventory} />;
  if (type === "inventory_health") return <InventoryHealth analytics={analytics} goInventory={goInventory} />;
  return null;
}

const Stat = ({ label, value, sub }) => (
  <div className="rounded-lg border border-border px-3 py-2">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-lg font-bold font-display leading-tight">{value}</div>
    {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
  </div>
);

function RoiRollup({ records, currency }) {
  const r = rollup(records);
  const data = [
    { k: "Cost", v: r.cost, c: "#9ca3af" },
    { k: "Expected", v: r.expected, c: "#3b82f6" },
    { k: "Realized", v: r.realized, c: "#22c55e" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label="Annualized cost" value={money(r.cost, currency)} />
        <Stat label="ROI" value={r.roiPct == null ? "—" : `${r.roiPct.toFixed(0)}%`} sub={r.roiPct == null ? "not measured yet" : undefined} />
        <Stat label="Expected benefit" value={money(r.expected, currency)} />
        <Stat label="Realized benefit" value={money(r.realized, currency)} />
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="k" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v) => money(v, currency)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Bar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((d, i) => <Cell key={i} fill={d.c} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{r.measured} of {r.total} records have cost or benefit captured.</p>
    </div>
  );
}

function RoiTable({ records, currency, setSelectedId }) {
  const rows = records.filter((r) => r.etype === "initiative" || r.etype === "opportunity");
  if (!rows.length) return <Empty>No initiatives or opportunities match the filters.</Empty>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground">
          <tr><th className="text-left py-1.5 px-1">Record</th><th className="text-left px-1">Stage</th><th className="text-right px-1">Cost</th><th className="text-right px-1">Benefit</th><th className="text-right px-1">ROI</th><th className="text-left px-1">Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = roiOf(r); const st = ROI_STATUS[v.status];
            return (
              <tr key={r.id} data-testid={`roi-row-${r.id}`} onClick={() => setSelectedId(r.id)}
                className="border-t border-border hover:bg-accent/50 cursor-pointer">
                <td className="py-2 px-1 font-medium max-w-[220px] truncate">{r.name}</td>
                <td className="px-1 text-muted-foreground">{STAGE_LABEL[r.stage] || "—"}</td>
                <td className="px-1 text-right mono">{v.cost == null ? "—" : money(v.cost, currency)}</td>
                <td className="px-1 text-right mono">{v.benefit == null ? "—" : money(v.benefit, currency)}</td>
                <td className="px-1 text-right mono">{v.roiPct == null ? "—" : `${v.roiPct.toFixed(0)}%`}</td>
                <td className="px-1"><span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${st.cls}`}>{st.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TimeFreed({ records, currency }) {
  const withHours = records.filter((r) => r.time_freed_hours != null);
  const totalHours = sum(withHours.map((r) => r.time_freed_hours));
  const valued = sum(withHours.filter((r) => r.hourly_rate != null).map((r) => r.time_freed_hours * r.hourly_rate));
  const unvalued = withHours.filter((r) => r.hourly_rate == null).length;
  if (!withHours.length) return <Empty>No time-freed hours captured yet.</Empty>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Stat label="Hours freed / period" value={totalHours.toLocaleString()} />
        <Stat label="Valued at rate" value={money(valued, currency)} sub={unvalued ? `${unvalued} without a rate` : undefined} />
      </div>
      <ul className="space-y-1 mt-1">
        {withHours.slice(0, 5).map((r) => (
          <li key={r.id} className="flex justify-between text-xs"><span className="truncate max-w-[200px]">{r.name}</span>
            <span className="mono text-muted-foreground">{r.time_freed_hours}h{r.hourly_rate != null ? ` · ${money(r.time_freed_hours * r.hourly_rate, currency)}` : " · no rate"}</span></li>
        ))}
      </ul>
    </div>
  );
}

function Cadence({ records, currency }) {
  const live = records.filter((r) => r.went_live_at || r.stage === "live" || r.stage === "realized");
  if (!live.length) return <Empty>Nothing is Live yet — cadence tracking starts once a record goes Live.</Empty>;
  const cell = (val) => val == null ? <span className="text-gray-400">not measured yet</span> : money(val, currency);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground">
          <tr><th className="text-left py-1.5 px-1">Record</th><th className="text-right px-1">Expected</th><th className="text-right px-1">3mo</th><th className="text-right px-1">6mo</th><th className="text-right px-1">12mo</th></tr>
        </thead>
        <tbody>
          {live.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 px-1 font-medium max-w-[180px] truncate">{r.name}</td>
              <td className="px-1 text-right mono">{cell(r.expected_benefit)}</td>
              <td className="px-1 text-right mono">{cell(r.cadence?.m3)}</td>
              <td className="px-1 text-right mono">{cell(r.cadence?.m6)}</td>
              <td className="px-1 text-right mono">{cell(r.cadence?.m12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Throughput({ records, goInventory }) {
  const data = STAGES.map((s) => ({ key: s.key, k: s.label, v: records.filter((r) => r.stage === s.key).length }));
  const live = records.filter((r) => r.stage === "live" || r.stage === "realized").length;
  const flight = records.filter((r) => r.stage && r.stage !== "live" && r.stage !== "realized").length;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Stat label="Live / realized" value={live} />
        <Stat label="In flight" value={flight} />
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="k" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={78} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Bar dataKey="v" radius={[0, 4, 4, 0]} maxBarSize={16} fill="#111827"
              onClick={(d) => d && goInventory({ stage: d.key })} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function InventoryHealth({ analytics, goInventory }) {
  const inv = analytics.inventory;
  const types = Object.entries(inv.by_type).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Total records" value={inv.total} />
        <Stat label="Missing owner" value={inv.missing_owner} />
        <Stat label="Never reviewed" value={inv.never_reviewed} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {types.map(([t, n]) => (
          <button key={t} data-testid={`health-type-${t}`} onClick={() => goInventory({ etype: t })}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2 py-0.5 text-[11px] hover:bg-accent">
            <span className="capitalize">{t.replace(/_/g, " ")}</span><span className="mono text-muted-foreground">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const Empty = ({ children }) => <p className="text-xs text-muted-foreground py-3">{children}</p>;
