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
  const [selectedId, setSelectedId] = useState(null); // detail drawer
  const [search, setSearch] = useState("");

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

  const refresh = useCallback(() => {
    if (wsId) api.get("/organizations", { workspace_id: wsId }).then(setOrgs);
  }, [wsId]);

  return (
    <ScopeCtx.Provider value={{
      workspaces, orgs, portfolios, wsId, setWsId, orgId, setOrgId,
      currentOrg, currentWs, state, setState, version, setVersion,
      framework, selectedId, setSelectedId, search, setSearch, refresh,
    }}>
      {children}
    </ScopeCtx.Provider>
  );
}
