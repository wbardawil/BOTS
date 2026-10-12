import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/constants";

export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
      STATUS_COLORS[status] || STATUS_COLORS.draft)}>
      {status.replace("_", " ")}
    </span>
  );
}

export function PhasePill({ phase }) {
  if (!phase) return <span className="text-xs text-muted-foreground">—</span>;
  const c = { 1: "#111827", 2: "#6b7280", 3: "#9ca3af" }[phase] || "#6b7280";
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border bg-white"
      style={{ color: c, borderColor: "#d1d5db", borderStyle: phase === 3 ? "dashed" : "solid" }}>
      Phase {phase}
    </span>
  );
}

export function DemoTag() {
  return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-300">DEMO</span>;
}

export function AiTag() {
  return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-white text-gray-900 border border-gray-900">AI DRAFT</span>;
}

export function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="text-sm text-foreground/90">{children ?? <span className="text-muted-foreground italic">unknown</span>}</div>
    </div>
  );
}

export function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
      {Icon && <Icon className="h-10 w-10 mb-3 opacity-40" />}
      <p className="font-medium text-foreground/80">{title}</p>
      {hint && <p className="text-sm mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}
