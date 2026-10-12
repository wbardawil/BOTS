import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

client.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("bots_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

client.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && !window.location.pathname.includes("login")) {
      localStorage.removeItem("bots_token");
      window.location.href = "/login";
    }
    return Promise.reject(e);
  }
);

export function apiErr(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export const api = {
  get: (u, p) => client.get(u, { params: p }).then((r) => r.data),
  post: (u, b) => client.post(u, b).then((r) => r.data),
  put: (u, b) => client.put(u, b).then((r) => r.data),
  del: (u) => client.delete(u).then((r) => r.data),
};

export default client;
