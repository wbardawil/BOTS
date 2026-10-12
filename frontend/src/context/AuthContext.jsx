import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=anon
  useEffect(() => {
    const t = localStorage.getItem("bots_token");
    if (!t) { setUser(false); return; }
    api.get("/auth/me").then(setUser).catch(() => { setUser(false); });
  }, []);

  const login = async (email, password) => {
    const d = await api.post("/auth/login", { email, password });
    localStorage.setItem("bots_token", d.token);
    setUser(d.user);
    return d.user;
  };
  const logout = () => {
    localStorage.removeItem("bots_token");
    setUser(false);
    window.location.href = "/login";
  };
  return <AuthCtx.Provider value={{ user, setUser, login, logout }}>{children}</AuthCtx.Provider>;
}
