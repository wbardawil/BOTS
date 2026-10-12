import { useState } from "react";
import { api, apiErr } from "@/lib/api";
import { ETYPE, NUMERIC_FIELDS } from "@/lib/constants";
import { fieldsFor } from "@/lib/fields";
import FieldGrid from "@/components/FieldGrid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

/** Record types that can be created from the UI: every etype with at least one `create` field in the manifest. */
export const creatableTypes = (etypes) => etypes.filter((t) => fieldsFor(t, (r) => r.create).length > 0);

export function CreateDialog({ open, setOpen, etype, orgId, onDone, keys, extra, title }) {
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const all = fieldsFor(etype);
  const rows = keys ? keys.map((k) => all.find((r) => r.key === k)).filter(Boolean) : all.filter((r) => r.create);

  const submit = async () => {
    const missing = rows.filter((r) => r.required && !data[r.key]);
    if (missing.length) { toast.error(`${missing.map((r) => r.en).join(", ")} required`); return; }
    setBusy(true);
    const payload = { ...(extra || {}), ...data };
    NUMERIC_FIELDS.forEach((k) => { if (payload[k] != null && payload[k] !== "") { const n = Number(payload[k]); if (!Number.isNaN(n)) payload[k] = n; } });
    Object.keys(payload).forEach((k) => { if (payload[k] === "") delete payload[k]; });
    try {
      await api.post("/entities", { etype, organization_id: orgId, data: payload, status: "draft" });
      toast.success(`${ETYPE[etype]?.label} created (draft)`);
      setOpen(false); setData({}); onDone();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title || `New ${ETYPE[etype]?.label}`}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <FieldGrid etype={etype} rows={rows} data={{}} form={data} setForm={setData} edit testPrefix="field" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="entity-save-btn" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Create draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
