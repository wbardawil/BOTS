import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FIELDS, fieldLabel, optionsFor, labelFor } from "@/lib/fields";

/**
 * Manifest-driven field grid. Module-level component (never declared inside another component),
 * so inputs keep focus while typing. Pass either `rows` (manifest rows) or `keys` (resolved against
 * FIELDS[etype]; unknown keys render as plain text fields).
 * testPrefix: "edit" in the drawer, "field" in the create dialog (keeps existing data-testids).
 */
export default function FieldGrid({ etype, rows, keys, data = {}, form = {}, setForm, edit = false, locale = "en", testPrefix = "edit", showEmpty }) {
  const manifest = FIELDS[etype] || [];
  const list = rows || (keys || []).map((k) => manifest.find((r) => r.key === k) || { key: k, en: k.replace(/_/g, " "), es: k.replace(/_/g, " "), type: guessType(k, data[k]) });
  const visible = list.filter((r) => r.section !== "hidden" && (edit || showEmpty || r.key in data));
  if (!visible.length) return <p className="text-sm text-muted-foreground">—</p>;
  const set = (k, v) => setForm && setForm({ ...form, [k]: v });
  return (
    <div className="grid gap-3">
      {visible.map((r) => {
        const k = r.key; const v = form[k]; const cur = data[k];
        const label = fieldLabel(r, locale);
        const canEdit = edit && r.type !== "readonly" && r.type !== "json";
        return (
          <div key={k} className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}{r.required && edit ? " *" : ""}</Label>
            {canEdit ? (
              r.type === "select" ? (
                <select data-testid={`${testPrefix}-${k}`} value={v ?? ""} onChange={(e) => set(k, e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                  <option value="">—</option>
                  {optionsFor(r, locale).map((op) => <option key={op.key} value={op.key}>{op.label}</option>)}
                </select>
              ) : r.type === "textarea" ? (
                <Textarea data-testid={`${testPrefix}-${k}`} value={v ?? ""} onChange={(e) => set(k, e.target.value)} />
              ) : r.type === "bool" ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox data-testid={`${testPrefix}-${k}`} checked={!!v} onCheckedChange={(c) => set(k, !!c)} /> {label}
                </label>
              ) : (
                <Input data-testid={`${testPrefix}-${k}`} type={r.type === "number" ? "number" : r.type === "date" ? "date" : "text"}
                  value={v ?? ""} onChange={(e) => set(k, e.target.value)} />
              )
            ) : (
              <div className="text-sm text-foreground/90" data-testid={`${testPrefix}-${k}-value`}>{display(r, etype, cur, locale)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function guessType(k, v) {
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return "number";
  if (v && typeof v === "object") return "json";
  if (typeof v === "string" && (v.length > 40 || ["purpose", "rationale", "content", "business_problem", "proposed_workflow", "description"].includes(k))) return "textarea";
  return "text";
}

export function display(r, etype, v, locale = "en") {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground italic">{locale === "es" ? "desconocido" : "unknown"}</span>;
  if (r.type === "select") return labelFor(etype, r.key, v, locale);
  if (r.type === "json") return <pre className="text-[11px] bg-gray-50 border border-gray-200 rounded-md p-2 overflow-auto max-h-48 whitespace-pre-wrap">{JSON.stringify(v, null, 1)}</pre>;
  if (typeof v === "boolean") return v ? (locale === "es" ? "Sí" : "Yes") : "No";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? x.name || x.id || JSON.stringify(x) : String(x))).join(", ") || <span className="text-muted-foreground italic">none</span>;
  if (typeof v === "object") return <pre className="text-[11px] bg-gray-50 border border-gray-200 rounded-md p-2 overflow-auto max-h-48">{JSON.stringify(v, null, 1)}</pre>;
  return String(v);
}
