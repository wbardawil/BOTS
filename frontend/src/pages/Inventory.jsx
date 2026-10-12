import { useEffect, useState, useCallback, useMemo } from "react";
import { useScope } from "@/context/ScopeContext";
import { api, apiErr } from "@/lib/api";
import { INVENTORY_ETYPES, ETYPE, CANON_AREAS } from "@/lib/constants";
import { StatusBadge, PhasePill, StagePill, DemoTag, Empty } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateDialog, creatableTypes } from "@/components/CreateDialog";
import { Th, Sel, BulkMenu, BulkOwner, areaCell } from "@/components/tables";
import { FolderSearch, X, Inbox, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Inventory() {
  const { orgId, currentOrg, setSelectedId, search, setSearch, reloadToken, bumpReload,
    inventoryFilter, setInventoryFilter, stages, stageLabel } = useScope();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ etype: "", stage: "", owner: "", area: "", status: "" });
  const [sort, setSort] = useState({ key: "name", dir: 1 });
  const [sel, setSel] = useState(new Set());
  const [createType, setCreateType] = useState("initiative");
  const [createOpen, setCreateOpen] = useState(false);

  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    api.get("/entities", { organization_id: orgId })
      .then((es) => setRows(es.filter((e) => INVENTORY_ETYPES.includes(e.etype))))
      .finally(() => setLoading(false));
  }, [orgId]);
  useEffect(load, [load, reloadToken]);

  // apply drill-down filter coming from the dashboard
  useEffect(() => {
    if (inventoryFilter) {
      setFilters((f) => ({ ...f, etype: inventoryFilter.etype || "", stage: inventoryFilter.stage || "",
        owner: inventoryFilter.owner || "", area: inventoryFilter.area || "" }));
      setInventoryFilter(null);
    }
  }, [inventoryFilter, setInventoryFilter]);

  const owners = useMemo(() => [...new Set(rows.map((r) => r.data.owner || r.data.human_owner || r.data.assignee).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    let out = rows.filter((r) =>
      (!filters.etype || r.etype === filters.etype) &&
      (!filters.stage || r.data.stage === filters.stage) &&
      (!filters.area || r.data.area === filters.area) &&
      (!filters.status || r.status === filters.status) &&
      (!filters.owner || (r.data.owner || r.data.human_owner || r.data.assignee) === filters.owner) &&
      (!search || JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase())));
    out = [...out].sort((a, b) => {
      const g = (r) => {
        if (sort.key === "name") return (r.data.name || "").toLowerCase();
        if (sort.key === "etype") return r.etype;
        if (sort.key === "stage") return r.data.stage || "";
        if (sort.key === "status") return r.status || "";
        if (sort.key === "owner") return (r.data.owner || r.data.human_owner || r.data.assignee || "").toLowerCase();
        return "";
      };
      return g(a) < g(b) ? -sort.dir : g(a) > g(b) ? sort.dir : 0;
    });
    return out;
  }, [rows, filters, search, sort]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const toggleSort = (key) => setSort((s) => s.key === key ? { key, dir: -s.dir } : { key, dir: 1 });
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allVisibleSelected ? new Set() : new Set(filtered.map((r) => r.id)));

  const bulk = async (action, value) => {
    try {
      const res = await api.post("/entities/bulk", { ids: [...sel], action, value });
      toast.success(`${res.updated.length} updated${res.skipped.length ? `, ${res.skipped.length} skipped` : ""}`);
      if (res.skipped.length) toast.message(res.skipped[0].reason);
      setSel(new Set()); load(); bumpReload();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto fade-up">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><FolderSearch className="h-5 w-5" /> Inventory</h1>
          <p className="text-sm text-muted-foreground">{currentOrg?.name} · every record, searchable & filterable</p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <select data-testid="inv-create-type" value={createType} onChange={(e) => setCreateType(e.target.value)}
              className="h-9 rounded-md border border-input bg-white px-2 text-sm">
              {creatableTypes(INVENTORY_ETYPES).map((t) => <option key={t} value={t}>{ETYPE[t]?.label || t}</option>)}
            </select>
            <Button data-testid="entity-create-btn" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New</Button>
          </div>
        )}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Input data-testid="inv-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records…" className="h-8 w-56 text-sm" />
        </div>
        <Sel testid="inv-type" value={filters.etype} onChange={(v) => setFilters({ ...filters, etype: v })} placeholder="All types"
          options={INVENTORY_ETYPES.map((t) => [t, ETYPE[t]?.label || t])} />
        <Sel testid="inv-stage" value={filters.stage} onChange={(v) => setFilters({ ...filters, stage: v })} placeholder="All stages"
          options={stages.map((s) => [s.key, s.label])} />
        <Sel testid="inv-area" value={filters.area} onChange={(v) => setFilters({ ...filters, area: v })} placeholder="All areas"
          options={CANON_AREAS.map((a) => [a.key, a.label])} />
        <Sel testid="inv-owner" value={filters.owner} onChange={(v) => setFilters({ ...filters, owner: v })} placeholder="All owners"
          options={owners.map((o) => [o, o])} />
        <Sel testid="inv-status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="Any status"
          options={[["draft", "Draft"], ["published", "Published"], ["archived", "Archived"]]} />
        {activeFilters > 0 && <button data-testid="inv-clear" onClick={() => setFilters({ etype: "", stage: "", owner: "", area: "", status: "" })} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} records</span>
      </div>

      {/* bulk action bar */}
      {sel.size > 0 && (
        <div data-testid="inv-bulk-bar" className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
          <span className="text-sm font-medium px-1">{sel.size} selected</span>
          {canWrite ? (
            <>
              <BulkMenu label="Change stage" testid="bulk-stage" options={stages.map((s) => [s.key, s.label])} onPick={(v) => bulk("stage", v)} />
              <BulkMenu label="Tag area" testid="bulk-area" options={CANON_AREAS.map((a) => [a.key, a.label])} onPick={(v) => bulk("area", v)} />
              <BulkOwner onPick={(v) => bulk("owner", v)} />
            </>
          ) : <span className="text-xs text-amber-600">read-only — bulk actions need edit access</span>}
          <button data-testid="bulk-clear" onClick={() => setSel(new Set())} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
        filtered.length === 0 ? <Empty icon={Inbox} title="No records match" hint="Adjust filters or search to see records." /> : (
        <div className="card-surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 w-8"><Checkbox data-testid="inv-select-all" checked={allVisibleSelected} onCheckedChange={toggleAll} /></th>
                <Th label="Name" k="name" sort={sort} onSort={toggleSort} />
                <Th label="Type" k="etype" sort={sort} onSort={toggleSort} />
                <Th label="Stage" k="stage" sort={sort} onSort={toggleSort} />
                <Th label="Owner" k="owner" sort={sort} onSort={toggleSort} />
                <th className="text-left px-4 py-2.5 font-medium">Area</th>
                <th className="text-left px-4 py-2.5 font-medium">Phase</th>
                <Th label="Status" k="status" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const owner = r.data.owner || r.data.human_owner || r.data.assignee;
                return (
                  <tr key={r.id} data-testid={`inv-row-${r.id}`}
                    className="border-t border-border hover:bg-accent/50 transition-colors">
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox data-testid={`inv-sel-${r.id}`} checked={sel.has(r.id)} onCheckedChange={() => toggleSel(r.id)} />
                    </td>
                    <td className="px-4 py-2.5 font-medium cursor-pointer" onClick={() => setSelectedId(r.id)}>
                      <span className="flex items-center gap-2">{r.data.name || "(untitled)"} {r.is_demo && <DemoTag />}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground cursor-pointer capitalize" onClick={() => setSelectedId(r.id)}>{ETYPE[r.etype]?.label || r.etype}</td>
                    <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelectedId(r.id)}>{r.data.stage ? <StagePill stage={r.data.stage} label={stageLabel[r.data.stage]} /> : <span className="text-muted-foreground text-xs">—</span>}</td>
                    <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelectedId(r.id)}>{owner || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelectedId(r.id)}>{areaCell(r.data.area)}</td>
                    <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelectedId(r.id)}><PhasePill phase={r.data.phase} /></td>
                    <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelectedId(r.id)}><StatusBadge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <CreateDialog open={createOpen} setOpen={setCreateOpen} etype={createType} orgId={orgId} onDone={() => { load(); bumpReload(); }} />
    </div>
  );
}
