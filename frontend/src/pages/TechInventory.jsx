import { useEffect, useState, useCallback, useMemo } from "react";
import { useScope } from "@/context/ScopeContext";
import { exportNodeToPng, exportName, stampLine } from "@/lib/exportImage";
import { api, apiErr } from "@/lib/api";
import { CANON_AREAS, AREA_BY_KEY, LINE } from "@/lib/constants";
import { VOCAB, fieldsFor, labelFor } from "@/lib/fields";
import { toCsv, downloadText } from "@/lib/csv";
import { Th, Sel, BulkMenu, BulkOwner, areaCell, NeutralPill } from "@/components/tables";
import { DemoTag, Empty } from "@/components/shared";
import { CreateDialog } from "@/components/CreateDialog";
import ImportDialog from "@/components/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Cpu, Plus, Upload, Download, X, Table2, LayoutGrid, Inbox, CheckCircle2, ImageDown } from "lucide-react";
import { toast } from "sonner";

const KINDS = VOCAB.system_kind;
const kindLabel = (k, locale) => labelFor("system", "kind", k, locale) || "Unclassified";

export default function TechInventory() {
  const { orgId, currentOrg, setSelectedId, search, setSearch, reloadToken, bumpReload, version } = useScope();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("table");
  const [filters, setFilters] = useState({ kind: "", area: "", api: "", mcp: "", verified: "" });
  const [sort, setSort] = useState({ key: "name", dir: 1 });
  const [sel, setSel] = useState(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    api.get("/entities", { organization_id: orgId, etype: "system" }).then(setRows).finally(() => setLoading(false));
  }, [orgId]);
  useEffect(load, [load, reloadToken]);

  const filtered = useMemo(() => {
    let out = rows.filter((r) =>
      (!filters.kind || (r.data.kind || "") === filters.kind) &&
      (!filters.area || r.data.area === filters.area) &&
      (!filters.api || (r.data.api_available || "unknown") === filters.api) &&
      (!filters.mcp || (r.data.mcp_available || "unknown") === filters.mcp) &&
      (!filters.verified || (filters.verified === "yes") === !!r.data.verified_integration) &&
      (!search || JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase())));
    const g = (r) => {
      if (sort.key === "name") return (r.data.name || "").toLowerCase();
      if (sort.key === "kind") return r.data.kind || "~";
      if (sort.key === "vendor") return (r.data.vendor || "~").toLowerCase();
      if (sort.key === "area") return r.data.area || "~";
      if (sort.key === "owner") return (r.data.owner || "~").toLowerCase();
      if (sort.key === "cost") return Number(r.data.cost_estimate) || 0;
      return "";
    };
    return [...out].sort((a, b) => (g(a) < g(b) ? -sort.dir : g(a) > g(b) ? sort.dir : 0));
  }, [rows, filters, search, sort]);

  const grouped = useMemo(() => {
    const m = new Map();
    [...KINDS.map((k) => k.key), ""].forEach((k) => m.set(k, []));
    filtered.forEach((r) => { const k = KINDS.some((x) => x.key === r.data.kind) ? r.data.kind : ""; m.get(k).push(r); });
    return [...m.entries()].filter(([, v]) => v.length);
  }, [filtered]);

  const stats = useMemo(() => ({
    total: rows.length,
    api: rows.filter((r) => r.data.api_available === "yes").length,
    mcp: rows.filter((r) => r.data.mcp_available === "yes").length,
    verified: rows.filter((r) => r.data.verified_integration).length,
    unclassified: rows.filter((r) => !KINDS.some((x) => x.key === r.data.kind)).length,
    monthly: rows.reduce((s, r) => s + ((r.data.cost_period || "monthly") !== "one_off" ? Number(r.data.cost_estimate) || 0 : 0), 0),
  }), [rows]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulk = async (action, value) => {
    try {
      const res = await api.post("/entities/bulk", { ids: [...sel], action, value });
      toast.success(`${res.updated.length} updated${res.skipped.length ? `, ${res.skipped.length} skipped` : ""}`);
      setSel(new Set()); load(); bumpReload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  const exportCsv = () => {
    const cols = fieldsFor("system", (r) => r.csv).map((r) => r.key);
    downloadText(`${(currentOrg?.name || "company").replace(/\s+/g, "-").toLowerCase()}-technology-inventory.csv`,
      toCsv(cols, filtered.map((r) => Object.fromEntries(cols.map((k) => [k, r.data[k]])))));
  };
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const yn = (v) => <NeutralPill tone={v === "yes" ? "yes" : v === "no" ? "no" : "neutral"}>{v || "unknown"}</NeutralPill>;

  if (!orgId) return <Empty icon={Cpu} title="Select a company" />;

  return (
    <div className="p-6 max-w-[1500px] mx-auto fade-up" data-testid="tech-inventory">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Cpu className="h-5 w-5" /> Technology Inventory</h1>
          <p className="text-sm text-muted-foreground">{currentOrg?.name} · every system, database, spreadsheet, integration and device, with its API and MCP facts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border border-border p-0.5 bg-white">
            {[["table", Table2, "Table"], ["map", LayoutGrid, "Map"]].map(([m, I, l]) => (
              <button key={m} data-testid={`tech-mode-${m}`} onClick={() => setMode(m)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><I className="h-3.5 w-3.5" />{l}</button>
            ))}
          </div>
          {mode === "map" && <Button size="sm" variant="outline" data-testid="tech-export-png-btn" onClick={() => exportNodeToPng(document.querySelector('[data-testid="tech-map"] > div'), exportName(currentOrg, "tech-map"), { stamp: stampLine(currentOrg, version) }).then((r) => toast.success(`PNG exported (${r.width}×${r.height})`)).catch((e) => toast.error(`Export failed: ${e.message}`))}><ImageDown className="h-3.5 w-3.5 mr-1.5" /> PNG</Button>}
          <Button size="sm" variant="outline" data-testid="tech-export-btn" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5" /> CSV</Button>
          {canWrite && <Button size="sm" variant="outline" data-testid="tech-import-btn" onClick={() => setImportOpen(true)}><Upload className="h-3.5 w-3.5 mr-1.5" /> Import</Button>}
          {canWrite && <Button size="sm" data-testid="tech-new-btn" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> New system</Button>}
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
        {[["tech-stat-total", stats.total, "systems"], ["tech-stat-api", stats.api, "with an API"], ["tech-stat-mcp", stats.mcp, "with an MCP server"],
          ["tech-stat-verified", stats.verified, "verified connections"], ["tech-stat-unclassified", stats.unclassified, "without a kind"],
          ["tech-stat-monthly", stats.monthly ? stats.monthly.toLocaleString() : "—", "monthly run-rate (entered)"]].map(([t, v, l]) => (
          <div key={t} data-testid={t} className="card-surface rounded-lg px-3 py-2"><div className="text-xl font-bold leading-tight">{v}</div><div className="text-[11px] text-muted-foreground">{l}</div></div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input data-testid="tech-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search systems…" className="h-8 w-56 text-sm" />
        <Sel testid="tech-kind-filter" value={filters.kind} onChange={(v) => setFilters({ ...filters, kind: v })} placeholder="All kinds" options={KINDS.map((k) => [k.key, k.en])} />
        <Sel testid="tech-area-filter" value={filters.area} onChange={(v) => setFilters({ ...filters, area: v })} placeholder="All areas" options={CANON_AREAS.map((a) => [a.key, a.label])} />
        <Sel testid="tech-api-filter" value={filters.api} onChange={(v) => setFilters({ ...filters, api: v })} placeholder="API: any" options={[["yes", "API: yes"], ["no", "API: no"], ["unknown", "API: unknown"]]} />
        <Sel testid="tech-mcp-filter" value={filters.mcp} onChange={(v) => setFilters({ ...filters, mcp: v })} placeholder="MCP: any" options={[["yes", "MCP: yes"], ["no", "MCP: no"], ["unknown", "MCP: unknown"]]} />
        <Sel testid="tech-verified-filter" value={filters.verified} onChange={(v) => setFilters({ ...filters, verified: v })} placeholder="Verified: any" options={[["yes", "Verified"], ["no", "Not verified"]]} />
        {activeFilters > 0 && <button data-testid="tech-clear" onClick={() => setFilters({ kind: "", area: "", api: "", mcp: "", verified: "" })} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>

      {sel.size > 0 && (
        <div data-testid="tech-bulk-bar" className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
          <span className="text-sm font-medium px-1">{sel.size} selected</span>
          {canWrite ? (<>
            <BulkMenu label="Tag area" testid="tech-bulk-area" options={CANON_AREAS.map((a) => [a.key, a.label])} onPick={(v) => bulk("area", v)} />
            <BulkOwner testid="tech-bulk-owner" onPick={(v) => bulk("owner", v)} />
          </>) : <span className="text-xs text-amber-600">read-only</span>}
          <button data-testid="tech-bulk-clear" onClick={() => setSel(new Set())} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
        filtered.length === 0 ? <Empty icon={Inbox} title="No systems yet" hint="Import a CSV from the identity provider or finance export, or add systems one by one." /> :
        mode === "map" ? <MapMode rows={filtered} onOpen={setSelectedId} /> : (
        <div className="card-surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 w-8"><Checkbox data-testid="tech-select-all" checked={filtered.length > 0 && filtered.every((r) => sel.has(r.id))} onCheckedChange={() => setSel(filtered.every((r) => sel.has(r.id)) ? new Set() : new Set(filtered.map((r) => r.id)))} /></th>
                <Th label="Name" k="name" sort={sort} onSort={toggleSort} prefix="tech" />
                <Th label="Vendor" k="vendor" sort={sort} onSort={toggleSort} prefix="tech" />
                <Th label="Area" k="area" sort={sort} onSort={toggleSort} prefix="tech" />
                <Th label="Owner" k="owner" sort={sort} onSort={toggleSort} prefix="tech" />
                <th className="text-left px-4 py-2.5 font-medium">API</th>
                <th className="text-left px-4 py-2.5 font-medium">MCP</th>
                <th className="text-left px-4 py-2.5 font-medium">Verified</th>
                <Th label="Cost" k="cost" sort={sort} onSort={toggleSort} prefix="tech" />
              </tr>
            </thead>
            <tbody>
              {grouped.map(([kind, items]) => (
                <GroupRows key={kind || "none"} kind={kind} items={items} sel={sel} toggleSel={toggleSel} onOpen={setSelectedId} yn={yn} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDialog open={createOpen} setOpen={setCreateOpen} etype="system" orgId={orgId} onDone={() => { load(); bumpReload(); }} />
      <ImportDialog open={importOpen} setOpen={setImportOpen} etype="system" orgId={orgId} onDone={() => { load(); bumpReload(); }} />
    </div>
  );
}

function GroupRows({ kind, items, sel, toggleSel, onOpen, yn }) {
  return (
    <>
      <tr className="bg-gray-50 border-t border-border" data-testid={`tech-group-${kind || "unclassified"}`}>
        <td colSpan={9} className="px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{kindLabel(kind)} <span className="ml-1 normal-case font-normal" data-testid={`tech-count-${kind || "unclassified"}`}>· {items.length}</span></td>
      </tr>
      {items.map((r) => (
        <tr key={r.id} data-testid={`tech-row-${r.id}`} onClick={() => onOpen(r.id)} className="border-t border-border hover:bg-accent/50 cursor-pointer transition-colors">
          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><Checkbox data-testid={`tech-sel-${r.id}`} checked={sel.has(r.id)} onCheckedChange={() => toggleSel(r.id)} /></td>
          <td className="px-4 py-2.5 font-medium">{r.data.name} {r.is_demo && <DemoTag />}</td>
          <td className="px-4 py-2.5 text-foreground/75">{r.data.vendor || "—"}</td>
          <td className="px-4 py-2.5">{areaCell(r.data.area)}</td>
          <td className="px-4 py-2.5 text-foreground/75">{r.data.owner || <span className="text-amber-600">⚠ no owner</span>}</td>
          <td className="px-4 py-2.5">{yn(r.data.api_available)}</td>
          <td className="px-4 py-2.5">{yn(r.data.mcp_available)}</td>
          <td className="px-4 py-2.5">{r.data.verified_integration ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="text-muted-foreground text-xs">—</span>}</td>
          <td className="px-4 py-2.5 mono text-xs">{r.data.cost_estimate ? `${r.data.currency || ""} ${Number(r.data.cost_estimate).toLocaleString()}${r.data.cost_period === "one_off" ? "" : "/mo"}` : "—"}</td>
        </tr>
      ))}
    </>
  );
}

/** Map mode: the visual inventory. Columns = business areas, rows = kinds, cells = systems as chips. */
function MapMode({ rows, onOpen }) {
  const areas = CANON_AREAS.filter((a) => rows.some((r) => r.data.area === a.key));
  const noArea = rows.filter((r) => !AREA_BY_KEY[r.data.area]);
  const cols = [...areas, ...(noArea.length ? [{ key: "", label: "No area", color: "#9ca3af" }] : [])];
  const kinds = [...KINDS, { key: "", en: "Unclassified" }].filter((k) => rows.some((r) => (KINDS.some((x) => x.key === r.data.kind) ? r.data.kind : "") === k.key));
  return (
    <div className="overflow-x-auto" data-testid="tech-map">
      <div className="min-w-[1100px] rounded-xl border border-gray-200 bg-white">
        <div className="grid" style={{ gridTemplateColumns: `140px repeat(${cols.length}, minmax(0, 1fr))` }}>
          <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-200">Kind \ Area</div>
          {cols.map((a) => (
            <div key={a.key || "none"} className="px-2 py-2 border-b border-l border-gray-200 text-[11px] font-bold text-gray-900 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />{a.label}
            </div>
          ))}
          {kinds.map((k) => (
            <KindRow key={k.key || "none"} kind={k} cols={cols} rows={rows} onOpen={onOpen} />
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Chip stripe = area hue. Outlined tag = API available; ◆ = MCP server; ✓ = verified connection.</p>
    </div>
  );
}

function KindRow({ kind, cols, rows, onOpen }) {
  const inKind = rows.filter((r) => (KINDS.some((x) => x.key === r.data.kind) ? r.data.kind : "") === kind.key);
  return (
    <>
      <div className="px-3 py-2 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{kind.en}</div>
      {cols.map((a) => {
        const items = inKind.filter((r) => (AREA_BY_KEY[r.data.area] ? r.data.area : "") === a.key);
        return (
          <div key={a.key || "none"} className="px-1.5 py-1.5 border-b border-l border-gray-100 space-y-1 min-h-[36px]" data-testid={`tech-cell-${kind.key || "none"}-${a.key || "none"}`}>
            {items.map((r) => (
              <button key={r.id} data-testid={`tech-chip-${r.id}`} onClick={() => onOpen(r.id)} title={r.data.vendor || r.data.name}
                style={{ borderColor: LINE, boxShadow: `inset 3px 0 0 ${a.color}` }}
                className="flex w-full items-center gap-1 rounded-md border bg-white hover:bg-gray-50 pl-2.5 pr-1.5 py-[3px] text-[11px] text-gray-700 text-left">
                <span className="truncate">{r.data.name}</span>
                {r.data.api_available === "yes" && <span className="ml-auto mono text-[8px] uppercase tracking-wide text-gray-500 border border-gray-300 rounded px-1 shrink-0">api</span>}
                {r.data.mcp_available === "yes" && <span className="text-[9px] text-gray-700 shrink-0">◆</span>}
                {r.data.verified_integration && <span className="text-[10px] text-green-600 shrink-0">✓</span>}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}
