"""Engagement routes: bulk import of inventory and intake rows (CSV mapped on the client)."""
import re
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from db import db, clean
from auth import get_current_user
from access import require_write
from auditlog import audit, now_iso
from entities_util import new_entity_doc
from stages import get_org_stages, PIPELINE_ETYPES
import fields as field_rules

engagement_router = APIRouter(prefix="/api")

IMPORTABLE = {"system", "initiative"}
MAX_ROWS = 500


class ImportIn(BaseModel):
    etype: str
    rows: List[dict] = Field(default_factory=list)
    dry_run: bool = False
    on_conflict: str = "skip"  # skip | update
    source: str = "csv_import"  # csv_import | transcript | wizard


def _coerce(data: dict) -> dict:
    out = {}
    for k, v in data.items():
        if v is None or (isinstance(v, str) and v.strip() == ""):
            continue
        if isinstance(v, str):
            v = v.strip()
        if k in field_rules.NUMERIC_KEYS and isinstance(v, str):
            try:
                f = float(v.replace(",", ""))
                v = int(f) if f.is_integer() else f
            except ValueError:
                pass  # validate_data reports it
        out[k] = v
    return out


@engagement_router.post("/organizations/{org_id}/import")
async def import_rows(org_id: str, body: ImportIn, user: dict = Depends(get_current_user)):
    if body.etype not in IMPORTABLE:
        raise HTTPException(400, f"etype must be one of {', '.join(sorted(IMPORTABLE))}")
    if body.on_conflict not in ("skip", "update"):
        raise HTTPException(400, "on_conflict must be skip or update")
    if len(body.rows) > MAX_ROWS:
        raise HTTPException(400, f"At most {MAX_ROWS} rows per import")
    await require_write(user, org_id)
    org = clean(await db.organizations.find_one({"id": org_id}))
    if not org:
        raise HTTPException(404, "Organization not found")
    first_stage = (await get_org_stages(org_id))[0]["key"] if body.etype in PIPELINE_ETYPES else None

    created, updated, skipped, errors = [], [], [], []
    seen = set()
    for i, raw in enumerate(body.rows, start=1):
        if not isinstance(raw, dict):
            errors.append({"row": i, "field": "", "reason": "row is not an object"})
            continue
        data = _coerce(raw)
        name = str(data.get("name", "")).strip()
        if not name:
            errors.append({"row": i, "field": "name", "reason": "name is required"})
            continue
        if body.etype == "system" and not data.get("kind"):
            errors.append({"row": i, "field": "kind", "reason": "kind is required (saas, custom, database, spreadsheet, integration, infrastructure, device)"})
            continue
        problems = field_rules.validate_data(body.etype, data)
        if problems:
            errors.append({"row": i, "field": problems[0].split(":")[0], "reason": "; ".join(problems)})
            continue
        key = field_rules.import_key(body.etype, name)
        if key in seen:
            skipped.append({"row": i, "name": name, "reason": "duplicate row in this file"})
            continue
        seen.add(key)
        existing = await db.entities.find_one({
            "organization_id": org_id, "etype": body.etype, "archived": False,
            "$or": [{"data.import_key": key}, {"data.name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}],
        })
        if existing:
            if body.on_conflict == "update":
                if not body.dry_run:
                    sets = {f"data.{k}": v for k, v in data.items()}
                    sets["data.import_key"] = key
                    sets["data.source"] = body.source
                    sets["updated_at"] = now_iso()
                    await db.entities.update_one({"id": existing["id"]}, {"$set": sets, "$inc": {"version": 1}})
                    await audit(user, org_id, "import_update", body.etype, existing["id"], name)
                updated.append(existing["id"])
            else:
                skipped.append({"row": i, "name": name, "reason": "already exists", "id": existing["id"]})
            continue
        data["import_key"] = key
        data["source"] = body.source
        if first_stage and not data.get("stage"):
            data["stage"] = first_stage
            data["stage_history"] = [{"stage": first_stage, "at": now_iso(), "by": user.get("name"), "note": body.source}]
        doc = new_entity_doc(org, body.etype, data)
        if not body.dry_run:
            await db.entities.insert_one(doc)
            created.append(doc["id"])
        else:
            created.append(f"row-{i}")
    if not body.dry_run and (created or updated):
        await audit(user, org_id, "import", body.etype, org_id,
                    f"{len(created)} created, {len(updated)} updated, {len(skipped)} skipped, {len(errors)} errors")
    return {"etype": body.etype, "dry_run": body.dry_run, "created": created, "updated": updated,
            "skipped": skipped, "errors": errors,
            "counts": {"created": len(created), "updated": len(updated), "skipped": len(skipped), "errors": len(errors)}}
