import { cn } from "@/lib/utils";
import { STATUS_COLORS, PHASE_META } from "@/lib/constants";

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
  const m = PHASE_META[phase] || { hex: "#6b7280", dashed: false };
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border bg-white"
      style={{ color: m.hex, borderColor: m.hex, borderStyle: m.dashed ? "dashed" : "solid" }}>
      Phase {phase}
    </span>
  );
}

export function DemoTag() {
  return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">DEMO</span>;
}

export function AiTag() {
  return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground border border-primary">AI DRAFT</span>;
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
