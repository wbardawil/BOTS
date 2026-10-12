// Table building blocks shared by the Inventory and the Technology Inventory (lifted from Inventory.jsx).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import { AREA_BY_KEY } from "@/lib/constants";

export function Th({ label, k, sort, onSort, prefix = "inv" }) {
  return (
    <th className="text-left px-4 py-2.5 font-medium">
      <button data-testid={`${prefix}-sort-${k}`} onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ArrowUpDown className={`h-3 w-3 ${sort.key === k ? "text-foreground" : "opacity-40"}`} />
      </button>
    </th>
  );
}

export function Sel({ value, onChange, placeholder, options, testid }) {
  return (
    <select data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-white px-2 text-xs">
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function BulkMenu({ label, options, onPick, testid }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" data-testid={testid} className="h-8">{label} <ChevronDown className="h-3 w-3 ml-1" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 overflow-y-auto">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        {options.map(([v, l]) => <DropdownMenuItem key={v} data-testid={`${testid}-${v}`} onClick={() => onPick(v)}>{l}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BulkOwner({ onPick, testid = "bulk-owner" }) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" data-testid={testid} className="h-8">Assign owner <ChevronDown className="h-3 w-3 ml-1" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="p-2 w-56">
        <Input data-testid={`${testid}-input`} value={val} onChange={(e) => setVal(e.target.value)} placeholder="Owner name" className="h-8 mb-2" />
        <Button size="sm" data-testid={`${testid}-apply`} className="w-full" disabled={!val.trim()} onClick={() => { onPick(val.trim()); setVal(""); setOpen(false); }}>Assign to {val.trim() ? `"${val.trim()}"` : "owner"}</Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function areaCell(key) {
  const a = AREA_BY_KEY[key];
  if (!a) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: a.color }} />{a.label}</span>;
}

/** Neutral outlined pill for enumerated values (yes / no / unknown etc.). Hue stays reserved for areas. */
export function NeutralPill({ children, tone = "neutral", testid }) {
  const cls = tone === "yes" ? "border-gray-900 text-gray-900" : tone === "no" ? "border-gray-200 text-gray-400" : "border-gray-300 text-gray-600";
  return <span data-testid={testid} className={`inline-flex items-center rounded border bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide mono ${cls}`}>{children}</span>;
}
