import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const ScopeCtx = createContext(null);
export const useScope = () => useContext(ScopeCtx);

export function ScopeProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [wsId, setWsId] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [state, setState] = useState("current"); // current | target
  const [version, setVersion] = useState("draft"); // draft | published
  const [framework, setFramework] = useState(null);
  const [stages, setStages] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // detail drawer
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("dashboard"); // current main screen
  const [inventoryFilter, setInventoryFilter] = useState(null); // drill-down target
  const [reloadToken, setReloadToken] = useState(0);
  const bumpReload = useCallback(() => setReloadToken((t) => t + 1), []);

  const goInventory = useCallback((filter) => {
    setInventoryFilter(filter || null);
    setActive("inventory");
  }, []);

  useEffect(() => {
    api.get("/meta/framework").then(setFramework).catch(() => {});
    api.get("/workspaces").then((w) => {
      setWorkspaces(w);
      if (w.length) setWsId(w[0].id);
    });
  }, []);

  useEffect(() => {
    if (!wsId) return;
    api.get("/organizations", { workspace_id: wsId }).then((o) => {
      setOrgs(o);
      setOrgId(o.length ? o[0].id : null);
    });
    api.get("/portfolios", { workspace_id: wsId }).then(setPortfolios).catch(() => setPortfolios([]));
  }, [wsId]);

  const currentOrg = orgs.find((o) => o.id === orgId) || null;
  const currentWs = workspaces.find((w) => w.id === wsId) || null;

  useEffect(() => {
    if (!orgId) { setStages([]); return; }
    api.get(`/organizations/${orgId}/stages`).then((d) => setStages(d.stages)).catch(() => setStages([]));
  }, [orgId, reloadToken]);
  const stageLabel = Object.fromEntries(stages.map((s) => [s.key, s.label]));

  const refresh = useCallback(() => {
    if (wsId) api.get("/organizations", { workspace_id: wsId }).then(setOrgs);
  }, [wsId]);

  return (
    <ScopeCtx.Provider value={{
      workspaces, orgs, portfolios, wsId, setWsId, orgId, setOrgId,
      currentOrg, currentWs, state, setState, version, setVersion,
      framework, selectedId, setSelectedId, search, setSearch, refresh,
      active, setActive, inventoryFilter, setInventoryFilter, goInventory,
      reloadToken, bumpReload, stages, stageLabel,
    }}>
      {children}
    </ScopeCtx.Provider>
  );
}
