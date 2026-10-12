import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, ShieldCheck, GitBranch, Layers } from "lucide-react";

const DEMO = [
  ["Owner (Platform Admin)", "wadi.bardawil@gmail.com", "Bots!Admin2026"],
  ["Company Editor", "editor@bots.demo", "Demo!Editor1"],
  ["Company Viewer (Northwind only)", "viewer@bots.demo", "Demo!Viewer1"],
  ["Group Viewer (Portfolio A)", "group@bots.demo", "Demo!Group1"],
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("wadi.bardawil@gmail.com");
  const [password, setPassword] = useState("Bots!Admin2026");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await login(email, password); nav("/"); }
    catch (ex) { setErr(apiErr(ex.response?.data?.detail) || ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden border-r border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">BOTS</span>
        </div>
        <div className="space-y-6 max-w-md fade-up">
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold leading-[1.05]">
            A living map of your business <span className="text-primary">transformation</span>.
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Model how your company operates today, design its target operating model, and
            manage the human + agent journey to get there — with connected, persistent records.
          </p>
          <div className="grid gap-3 pt-2">
            {[[GitBranch, "Four connected, navigable views"],
              [Layers, "Capabilities → processes → opportunities → agents"],
              [ShieldCheck, "Scoped permissions, drafts & published snapshots"]].map(([Icon, t], i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-foreground/85">
                <Icon className="h-4 w-4 text-primary" /> {t}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Demo data is fictional and clearly labeled.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 fade-up">
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">BOTS</span>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Access your transformation workspace.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" data-testid="login-email" value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" data-testid="login-password" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {err && <p data-testid="login-error" className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" data-testid="login-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="rounded-lg card-surface p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Demo accounts (click to fill)</p>
            {DEMO.map(([label, em, pw]) => (
              <button key={em} type="button"
                data-testid={`demo-${em}`}
                onClick={() => { setEmail(em); setPassword(pw); }}
                className="w-full text-left text-xs rounded-md px-2 py-1.5 hover:bg-accent transition-colors flex justify-between gap-2">
                <span className="text-foreground/80">{label}</span>
                <span className="mono text-muted-foreground">{em}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
