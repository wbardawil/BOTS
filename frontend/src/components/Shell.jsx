import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useScope } from "@/context/ScopeContext";
import { MAIN_TABS, SECONDARY_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Bot, Search, LogOut, ChevronDown, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import DetailDrawer from "@/components/DetailDrawer";
import FrameworkCanvas from "@/views/FrameworkCanvas";
import OperatingMap from "@/views/OperatingMap";
import Roadmap from "@/views/Roadmap";
import ExecutiveOverview from "@/views/ExecutiveOverview";
import Assessment from "@/pages/Assessment";
import GroupOversight from "@/pages/GroupOversight";
import SettingsPage from "@/pages/Settings";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Pipeline from "@/pages/Pipeline";

export default function Shell() {
  const { user, logout } = useAuth();
  const scope = useScope();
  const { workspaces, orgs, currentOrg, currentWs, wsId, setWsId, orgId, setOrgId,
    state, setState, version, setVersion, search, setSearch, active, setActive } = scope;

  const sec = SECONDARY_NAV.find((s) => s.id === active);
  const mainTab = MAIN_TABS.find((t) => t.id === active);

  const renderContent = () => {
    if (active === "dashboard") return <Dashboard />;
    if (active === "inventory") return <Inventory />;
    if (active === "pipeline") return <Pipeline />;
    if (active === "framework") return <FrameworkCanvas />;
    if (active === "operating_map") return <OperatingMap />;
    if (active === "roadmap") return <Roadmap />;
    if (active === "executive") return <ExecutiveOverview />;
    if (active === "assessment") return <Assessment />;
    if (active === "oversight") return <GroupOversight />;
    if (active === "settings") return <SettingsPage />;
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="flex items-center gap-2 pr-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold hidden sm:block">BOTS</span>
          </div>

          {/* Workspace switcher */}
          <Switcher label="Workspace" value={currentWs?.name} testid="workspace-switcher">
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} data-testid={`ws-${w.id}`} onClick={() => setWsId(w.id)}
                className="flex items-center justify-between">
                <span>{w.name}</span>{w.id === wsId && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </Switcher>

          {/* Scope selector (org) */}
          <Switcher label="Company / Scope" value={currentOrg?.name} testid="scope-selector" icon={Building2}>
            <DropdownMenuLabel className="text-xs">Organizations in {currentWs?.name}</DropdownMenuLabel>
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} data-testid={`org-${o.id}`} onClick={() => setOrgId(o.id)}
                className="flex items-center justify-between">
                <span>{o.name} <span className="text-xs text-muted-foreground">· {o.org_kind?.replace("_", " ")}</span></span>
                {o.id === orgId && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </Switcher>

          <div className="flex-1" />

          {/* current/target toggle */}
          <Toggle value={state} onChange={setState} options={[["current", "Current"], ["target", "Target"]]} testid="state-toggle" />
          {/* draft/published toggle */}
          <Toggle value={version} onChange={setVersion} options={[["draft", "Draft"], ["published", "Published"]]} testid="version-toggle" />

          <div className="relative hidden md:block">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="global-search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records…" className="pl-8 h-9 w-48 bg-muted/40" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="user-menu" className="gap-2">
                <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">
                  {user?.name?.[0] || "U"}
                </div>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="text-sm">{user?.name}</div>
                <div className="text-xs text-muted-foreground font-normal">{user?.email}</div>
                <div className="text-[10px] text-primary mt-1 uppercase">{user?.global_role?.replace("_", " ")}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="logout-btn" onClick={logout}><LogOut className="h-4 w-4 mr-2" /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border p-3 hidden lg:flex flex-col gap-1 overflow-y-auto">
          <NavSection title="Views">
            {MAIN_TABS.map((t) => <NavItem key={t.id} item={t} active={active} onClick={() => setActive(t.id)} />)}
          </NavSection>
          <NavSection title="Manage">
            {SECONDARY_NAV.map((t) => <NavItem key={t.id} item={t} active={active} onClick={() => setActive(t.id)} />)}
          </NavSection>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* mobile tab bar for main views */}
          <div className="lg:hidden flex gap-1 p-2 overflow-x-auto border-b border-border">
            {MAIN_TABS.map((t) => (
              <button key={t.id} data-testid={`mtab-${t.id}`} onClick={() => setActive(t.id)}
                className={cn("px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                  active === t.id ? "bg-primary text-primary-foreground" : "bg-muted")}>{t.label}</button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      <DetailDrawer />
    </div>
  );
}

function Switcher({ label, value, children, testid, icon: Icon }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button data-testid={testid}
          className="flex flex-col items-start rounded-md px-2.5 py-1 hover:bg-accent transition-colors max-w-[180px]">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            {Icon && <Icon className="h-3 w-3" />}{label}
          </span>
          <span className="text-sm font-medium truncate max-w-[160px] flex items-center gap-1">
            {value || "—"} <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function Toggle({ value, onChange, options, testid }) {
  return (
    <div data-testid={testid} className="hidden md:flex items-center rounded-md border border-border p-0.5 bg-muted/40">
      {options.map(([v, l]) => (
        <button key={v} data-testid={`${testid}-${v}`} onClick={() => onChange(v)}
          className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors",
            value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function NavSection({ title, children }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">{title}</div>
      {children}
    </div>
  );
}

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button data-testid={`nav-${item.id}`} onClick={onClick}
      className={cn("w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors text-left",
        active === item.id ? "bg-primary/15 text-primary font-medium" : "text-foreground/75 hover:bg-accent")}>
      <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{item.label}</span>
    </button>
  );
}
