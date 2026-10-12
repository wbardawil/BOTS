import { useEffect, useState, useCallback, useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, Handle, Position, useNodesState, useEdgesState } from "reactflow";
import { useScope } from "@/context/ScopeContext";
import { api } from "@/lib/api";
import { ETYPE } from "@/lib/constants";
import { Empty } from "@/components/shared";
import { GitBranch } from "lucide-react";

const REL_COLOR = {
  reports_to: "#9ca3af", coordinates: "#3b82f6", supports: "#22c55e",
  depends_on: "#8b5cf6", shares_info: "#60a5fa", requires_approval: "#f59e0b",
  hands_to: "#111827", shared_service: "#16a34a", approves: "#d97706",
};

function NodeCard({ data }) {
  const meta = ETYPE[data.etype] || {};
  const Icon = meta.icon;
  const unassigned = data.unassigned;
  return (
    <div data-testid={`map-node-${data.id}`} className="rf-node rounded-lg px-3 py-2 min-w-[150px]"
      style={{ background: "#ffffff", border: `1.5px solid hsl(${meta.color})`, boxShadow: "0 1px 2px rgb(0 0 0 / .05)" }}>
      <Handle type="target" position={Position.Top} style={{ background: `hsl(${meta.color})`, width: 6, height: 6 }} />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide" style={{ color: `hsl(${meta.color})` }}>
        {Icon && <Icon className="h-3 w-3" />} {meta.label}
      </div>
      <div className="text-sm font-medium text-foreground mt-0.5 leading-tight">{data.label}</div>
      <div className="flex items-center gap-1.5 mt-1">
        {data.phase && <span className="text-[9px] px-1 rounded" style={{ background: `hsl(${meta.color} / 0.2)`, color: `hsl(${meta.color})` }}>P{data.phase}</span>}
        {unassigned && <span className="text-[9px] text-amber-600">⚠ no owner</span>}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: `hsl(${meta.color})`, width: 6, height: 6 }} />
    </div>
  );
}
const nodeTypes = { card: NodeCard };

export default function OperatingMap() {
  const { orgId, currentOrg, setSelectedId, search } = useScope();
  const [view, setView] = useState(null);
  const [entities, setEntities] = useState([]);
  const [rels, setRels] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const canWrite = ["platform_admin", "workspace_admin", "company_admin", "company_editor"].includes(currentOrg?.role);

  const load = useCallback(() => {
    if (!orgId) return;
    Promise.all([
      api.get("/views", { organization_id: orgId }),
      api.get("/entities", { organization_id: orgId }),
      api.get("/relationships", { organization_id: orgId }),
    ]).then(([vs, es, rs]) => {
      setView(vs.find((v) => v.kind === "operating_map") || null);
      setEntities(es); setRels(rs);
    });
  }, [orgId]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!view) { setNodes([]); setEdges([]); return; }
    const placements = view.placements || {};
    const placed = entities.filter((e) => placements[e.id]);
    const ns = (placed.length ? placed : entities.slice(0, 8)).map((e, i) => {
      const p = placements[e.id] || { x: (i % 4) * 200 + 40, y: Math.floor(i / 4) * 150 + 40 };
      const owner = e.data.human_owner || e.data.owner;
      const dim = search && !JSON.stringify(e.data).toLowerCase().includes(search.toLowerCase());
      return {
        id: e.id, type: "card", position: { x: p.x, y: p.y },
        data: { id: e.id, label: e.data.name, etype: e.etype, phase: e.data.phase,
          unassigned: !owner && ["agent", "process"].includes(e.etype) },
        style: { opacity: dim ? 0.25 : 1 },
      };
    });
    const ids = new Set(ns.map((n) => n.id));
    const es = rels.filter((r) => ids.has(r.from_id) && ids.has(r.to_id)).map((r) => ({
      id: r.id, source: r.from_id, target: r.to_id, label: r.rel_type.replace(/_/g, " "),
      animated: ["hands_to", "requires_approval"].includes(r.rel_type),
      style: { stroke: REL_COLOR[r.rel_type] || "#9ca3af", strokeWidth: 1.5 },
      labelStyle: { fill: "#6b7280", fontSize: 9 }, labelBgStyle: { fill: "#ffffff" },
    }));
    setNodes(ns); setEdges(es);
  }, [view, entities, rels, search, setNodes, setEdges]);

  const onNodeClick = useCallback((_, n) => setSelectedId(n.id), [setSelectedId]);
  const onNodeDragStop = useCallback((_, n) => {
    if (!canWrite || !view) return;
    api.put(`/views/${view.id}/placements`, { placements: { [n.id]: { x: Math.round(n.position.x), y: Math.round(n.position.y) } } });
  }, [canWrite, view]);
  const legend = useMemo(() => [...new Set(rels.map((r) => r.rel_type))], [rels]);

  if (!orgId) return <Empty icon={GitBranch} title="Select a company" />;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Operating Map</h1>
          <p className="text-sm text-muted-foreground">Human accountability → coordination → teams → processes & agents → systems. Drag to arrange; click a node for detail.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {legend.map((l) => (
            <span key={l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-[3px] w-5 rounded-full" style={{ background: REL_COLOR[l] || "#9ca3af" }} /> {l.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
      <div className="flex-1 mx-4 mb-4 rounded-xl overflow-hidden border border-border" data-testid="operating-map-canvas">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick} onNodeDragStop={onNodeDragStop}
          fitView proOptions={{ hideAttribution: true }} minZoom={0.2}>
          <Background color="#d4d4d8" gap={24} />
          <Controls />
          <MiniMap pannable zoomable maskColor="rgba(244,244,245,0.8)" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}
            nodeColor={(n) => `hsl(${ETYPE[n.data.etype]?.color || "210 20% 50%"})`} />
        </ReactFlow>
      </div>
    </div>
  );
}
