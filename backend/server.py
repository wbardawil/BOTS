from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import secrets
import hmac
import re
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, UploadFile, File, Header, BackgroundTasks
from fastapi.responses import JSONResponse, Response
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import db, clean
from auth import auth_router, get_current_user
from ai import ai_router
import access
from access import require_read, require_write, accessible_org_ids, accessible_workspace_ids, org_role
import seed as seed_module
import storage
from email_util import send_email

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bots")

app = FastAPI(title="BOTS API")
api = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# Business entity types managed by the generic record engine
ENTITY_TYPES = {
    "department", "capability", "process", "role", "system", "knowledge_source",
    "opportunity", "agent", "workflow", "initiative", "playbook",
    "adoption_assignment", "metric", "evidence", "decision", "risk_review",
}


async def audit(user, org_id, action, etype, eid, summary=""):
    await db.audit.insert_one({
        "id": secrets.token_hex(10), "organization_id": org_id, "user_id": user["id"],
        "user_name": user.get("name"), "action": action, "entity_type": etype,
        "entity_id": eid, "summary": summary, "at": now_iso(),
    })


# ---------------- Structure: workspaces / orgs / portfolios ----------------
@api.get("/workspaces")
async def list_workspaces(user: dict = Depends(get_current_user)):
    ws_ids = await accessible_workspace_ids(user)
    out = [clean(w) for w in await db.workspaces.find({"id": {"$in": list(ws_ids)}}).to_list(1000)]
    return out


@api.get("/organizations")
async def list_organizations(workspace_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    allowed = await accessible_org_ids(user)
    q = {"id": {"$in": list(allowed)}}
    if workspace_id:
        q["workspace_id"] = workspace_id
    orgs = [clean(o) for o in await db.organizations.find(q).to_list(2000)]
    for o in orgs:
        o["role"] = await org_role(user, o["id"])
    return orgs


@api.get("/organizations/{org_id}")
async def get_org(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    o = clean(await db.organizations.find_one({"id": org_id}))
    if not o:
        raise HTTPException(404, "Not found")
    o["role"] = await org_role(user, org_id)
    return o


@api.get("/portfolios")
async def list_portfolios(workspace_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    allowed = await accessible_org_ids(user)
    q = {}
    if workspace_id:
        q["workspace_id"] = workspace_id
    pfs = [clean(p) for p in await db.portfolios.find(q).to_list(1000)]
    # only expose portfolios in accessible workspaces
    ws_ids = await accessible_workspace_ids(user)
    pfs = [p for p in pfs if p["workspace_id"] in ws_ids]
    for p in pfs:
        p["accessible_member_ids"] = [x for x in p["organization_ids"] if x in allowed]
    return pfs


# ---------------- Generic entity engine ----------------
class EntityIn(BaseModel):
    etype: str
    organization_id: str
    data: dict = Field(default_factory=dict)
    status: str = "draft"
    state: Optional[str] = None  # current|target for model records
    relationships: List[dict] = Field(default_factory=list)


class EntityUpdate(BaseModel):
    data: Optional[dict] = None
    status: Optional[str] = None
    state: Optional[str] = None
    version: int  # optimistic concurrency


@api.post("/entities")
async def create_entity(body: EntityIn, user: dict = Depends(get_current_user)):
    if body.etype not in ENTITY_TYPES:
        raise HTTPException(400, f"Unknown entity type {body.etype}")
    await require_write(user, body.organization_id)
    org = await db.organizations.find_one({"id": body.organization_id})
    if not org:
        raise HTTPException(404, "Organization not found")
    doc = {
        "id": secrets.token_hex(12), "etype": body.etype,
        "organization_id": body.organization_id, "workspace_id": clean(org)["workspace_id"],
        "data": body.data, "status": body.status, "state": body.state,
        "version": 1, "is_demo": False, "archived": False,
        "created_at": now_iso(), "updated_at": now_iso(),
        "last_reviewed_at": None,
    }
    await db.entities.insert_one(doc)
    for r in body.relationships:
        await _add_rel(body.organization_id, doc["id"], body.etype, r)
    await audit(user, body.organization_id, "create", body.etype, doc["id"],
                body.data.get("name", ""))
    return clean(doc)


@api.get("/entities")
async def list_entities(organization_id: str, etype: Optional[str] = None,
                        state: Optional[str] = None, include_archived: bool = False,
                        user: dict = Depends(get_current_user)):
    await require_read(user, organization_id)
    q = {"organization_id": organization_id}
    if etype:
        q["etype"] = etype
    if state:
        q["state"] = state
    if not include_archived:
        q["archived"] = False
    return [clean(e) for e in await db.entities.find(q).to_list(5000)]


@api.get("/entities/{eid}")
async def get_entity(eid: str, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_read(user, e["organization_id"])
    rels = [clean(r) for r in await db.relationships.find(
        {"$or": [{"from_id": eid}, {"to_id": eid}]}).to_list(1000)]
    e["relationships"] = rels
    return e


@api.put("/entities/{eid}")
async def update_entity(eid: str, body: EntityUpdate, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_write(user, e["organization_id"])
    if body.version != e["version"]:
        raise HTTPException(409, "Record changed since you loaded it. Reload and retry.")
    upd = {"updated_at": now_iso(), "version": e["version"] + 1}
    if body.data is not None:
        upd["data"] = {**e["data"], **body.data}
    if body.status is not None:
        upd["status"] = body.status
    if body.state is not None:
        upd["state"] = body.state
    await db.entities.update_one({"id": eid}, {"$set": upd})
    await audit(user, e["organization_id"], "update", e["etype"], eid,
                (body.data or {}).get("name", e["data"].get("name", "")))
    return clean(await db.entities.find_one({"id": eid}))


@api.post("/entities/{eid}/review")
async def mark_reviewed(eid: str, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_write(user, e["organization_id"])
    await db.entities.update_one({"id": eid}, {"$set": {"last_reviewed_at": now_iso()}})
    await audit(user, e["organization_id"], "review", e["etype"], eid)
    return {"ok": True, "last_reviewed_at": now_iso()}


@api.get("/entities/{eid}/impact")
async def impact(eid: str, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_read(user, e["organization_id"])
    rels = [clean(r) for r in await db.relationships.find(
        {"$or": [{"from_id": eid}, {"to_id": eid}]}).to_list(1000)]
    affected = []
    for r in rels:
        other_id = r["to_id"] if r["from_id"] == eid else r["from_id"]
        other = clean(await db.entities.find_one({"id": other_id}))
        if other:
            affected.append({"id": other["id"], "etype": other["etype"],
                             "name": other["data"].get("name", ""), "rel_type": r["rel_type"]})
    return {"note": "Impact based on explicit relationships only — not exhaustive.",
            "affected": affected}


@api.post("/entities/{eid}/archive")
async def archive_entity(eid: str, confirm: bool = False, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_write(user, e["organization_id"])
    deps = await impact(eid, user)
    if not confirm:
        return {"requires_confirmation": True, "affected": deps["affected"],
                "message": "Archiving affects these references. Re-call with confirm=true."}
    await db.entities.update_one({"id": eid}, {"$set": {"archived": True, "status": "archived",
                                                        "updated_at": now_iso()}})
    await audit(user, e["organization_id"], "archive", e["etype"], eid)
    return {"ok": True, "archived": True}


class PhaseAdvanceIn(BaseModel):
    to_phase: int
    approver: str
    evidence_ids: List[str] = Field(default_factory=list)
    criteria_met: bool
    rationale: str
    version: int


@api.post("/entities/{eid}/advance-phase")
async def advance_phase(eid: str, body: PhaseAdvanceIn, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_write(user, e["organization_id"])
    if body.version != e["version"]:
        raise HTTPException(409, "Record changed since you loaded it. Reload and retry.")
    if e["etype"] == "agent" and body.to_phase >= 1:
        if not e["data"].get("human_owner"):
            raise HTTPException(400, "Human accountable owner required before advancing.")
    if not body.criteria_met:
        raise HTTPException(400, "Phase gate criteria not met.")
    if not body.evidence_ids:
        raise HTTPException(400, "Evidence is required for phase advancement.")
    if not body.approver.strip():
        raise HTTPException(400, "Named approver is required.")
    # record decision
    dec = {
        "id": secrets.token_hex(12), "etype": "decision",
        "organization_id": e["organization_id"], "workspace_id": e["workspace_id"],
        "data": {"name": f"Phase gate: {e['data'].get('name','')} → Phase {body.to_phase}",
                 "approver": body.approver, "rationale": body.rationale,
                 "evidence_ids": body.evidence_ids, "decided_at": now_iso(),
                 "target_entity": eid},
        "status": "published", "state": None, "version": 1, "is_demo": False,
        "archived": False, "created_at": now_iso(), "updated_at": now_iso(),
        "last_reviewed_at": now_iso(),
    }
    await db.entities.insert_one(dec)
    await _raw_rel(e["organization_id"], dec["id"], "decision", eid, e["etype"], "approves")
    await db.entities.update_one({"id": eid}, {"$set": {
        "data.phase": body.to_phase, "version": e["version"] + 1, "updated_at": now_iso()}})
    await audit(user, e["organization_id"], "advance_phase", e["etype"], eid,
                f"→ Phase {body.to_phase}")
    return {"ok": True, "phase": body.to_phase, "decision_id": dec["id"]}


# ---------------- Relationships ----------------
async def _raw_rel(org_id, from_id, from_type, to_id, to_type, rel_type):
    doc = {"id": secrets.token_hex(10), "organization_id": org_id, "from_id": from_id,
           "from_type": from_type, "to_id": to_id, "to_type": to_type, "rel_type": rel_type}
    await db.relationships.insert_one(doc)
    return clean(doc)


async def _add_rel(org_id, from_id, from_type, r):
    to = clean(await db.entities.find_one({"id": r["to_id"]}))
    to_type = to["etype"] if to else r.get("to_type", "unknown")
    return await _raw_rel(org_id, from_id, from_type, r["to_id"], to_type, r["rel_type"])


class RelIn(BaseModel):
    from_id: str
    to_id: str
    rel_type: str


@api.post("/relationships")
async def create_rel(body: RelIn, user: dict = Depends(get_current_user)):
    frm = clean(await db.entities.find_one({"id": body.from_id}))
    to = clean(await db.entities.find_one({"id": body.to_id}))
    if not frm or not to:
        raise HTTPException(404, "Entity not found")
    await require_write(user, frm["organization_id"])
    rel = await _raw_rel(frm["organization_id"], body.from_id, frm["etype"],
                         body.to_id, to["etype"], body.rel_type)
    return rel


@api.delete("/relationships/{rid}")
async def delete_rel(rid: str, user: dict = Depends(get_current_user)):
    r = clean(await db.relationships.find_one({"id": rid}))
    if not r:
        raise HTTPException(404, "Not found")
    await require_write(user, r["organization_id"])
    await db.relationships.delete_one({"id": rid})
    return {"ok": True}


@api.get("/relationships")
async def list_rels(organization_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, organization_id)
    return [clean(r) for r in await db.relationships.find(
        {"organization_id": organization_id}).to_list(5000)]


# ---------------- Views & placements ----------------
@api.get("/views")
async def list_views(organization_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, organization_id)
    views = [clean(v) for v in await db.views.find({"organization_id": organization_id}).to_list(100)]
    return views


class PlacementIn(BaseModel):
    placements: dict  # {entity_id: {x, y}}


@api.put("/views/{view_id}/placements")
async def save_placements(view_id: str, body: PlacementIn, user: dict = Depends(get_current_user)):
    v = clean(await db.views.find_one({"id": view_id}))
    if not v:
        raise HTTPException(404, "Not found")
    await require_write(user, v["organization_id"])
    merged = {**v.get("placements", {}), **body.placements}
    await db.views.update_one({"id": view_id}, {"$set": {"placements": merged, "updated_at": now_iso()}})
    return {"ok": True}


# ---------------- Publication / snapshots ----------------
class PublishIn(BaseModel):
    change_summary: str


@api.post("/organizations/{org_id}/publish")
async def publish(org_id: str, body: PublishIn, user: dict = Depends(get_current_user)):
    role = await org_role(user, org_id)
    if role not in ("company_admin", "workspace_admin", "platform_admin"):
        raise HTTPException(403, "Only company admins may publish")
    entities = [clean(e) for e in await db.entities.find(
        {"organization_id": org_id, "archived": False}).to_list(10000)]
    rels = [clean(r) for r in await db.relationships.find({"organization_id": org_id}).to_list(10000)]
    views = [clean(v) for v in await db.views.find({"organization_id": org_id}).to_list(100)]
    layout = clean(await db.layouts.find_one({"organization_id": org_id})) or {}
    snap = {
        "id": secrets.token_hex(12), "organization_id": org_id,
        "published_by": user["name"], "published_at": now_iso(),
        "change_summary": body.change_summary,
        "payload": {"entities": entities, "relationships": rels, "views": views,
                    "layout": layout.get("overrides", {})},
    }
    await db.snapshots.insert_one(snap)
    # mark draft entities as published state marker
    await db.entities.update_many({"organization_id": org_id, "status": "draft"},
                                  {"$set": {"status": "published"}})
    await audit(user, org_id, "publish", "snapshot", snap["id"], body.change_summary)
    return clean({k: v for k, v in snap.items() if k != "payload"})


@api.get("/organizations/{org_id}/snapshots")
async def list_snapshots(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    snaps = [clean(s) for s in await db.snapshots.find(
        {"organization_id": org_id}).sort("published_at", -1).to_list(200)]
    for s in snaps:
        s["entity_count"] = len(s["payload"]["entities"])
        s.pop("payload", None)
    return snaps


@api.get("/organizations/{org_id}/snapshots/{snap_id}")
async def get_snapshot(org_id: str, snap_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    s = clean(await db.snapshots.find_one({"id": snap_id, "organization_id": org_id}))
    if not s:
        raise HTTPException(404, "Not found")
    return s


@api.get("/organizations/{org_id}/diff")
async def diff(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    last = clean(await db.snapshots.find_one({"organization_id": org_id}, sort=[("published_at", -1)]))
    live = [clean(e) for e in await db.entities.find(
        {"organization_id": org_id, "archived": False}).to_list(10000)]
    if not last:
        return {"has_snapshot": False, "added": [e["id"] for e in live], "changed": [], "removed": []}
    snap_map = {e["id"]: e for e in last["payload"]["entities"]}
    live_map = {e["id"]: e for e in live}
    added = [live_map[i]["data"].get("name", i) for i in live_map if i not in snap_map]
    removed = [snap_map[i]["data"].get("name", i) for i in snap_map if i not in live_map]
    changed = []
    for i in live_map:
        if i in snap_map and live_map[i]["version"] != snap_map[i]["version"]:
            changed.append(live_map[i]["data"].get("name", i))
    return {"has_snapshot": True, "published_at": last["published_at"],
            "added": added, "changed": changed, "removed": removed}


# ---------------- Framework canvas saved layout (shared per company) ----------------
class LayoutIn(BaseModel):
    overrides: dict = Field(default_factory=dict)


@api.get("/organizations/{org_id}/framework-layout")
async def get_layout(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    l = clean(await db.layouts.find_one({"organization_id": org_id}))
    return {"overrides": (l or {}).get("overrides", {}),
            "updated_at": (l or {}).get("updated_at")}


@api.put("/organizations/{org_id}/framework-layout")
async def save_layout(org_id: str, body: LayoutIn, user: dict = Depends(get_current_user)):
    await require_write(user, org_id)
    await db.layouts.update_one(
        {"organization_id": org_id},
        {"$set": {"organization_id": org_id, "overrides": body.overrides, "updated_at": now_iso()}},
        upsert=True)
    await audit(user, org_id, "layout_save", "layout", org_id,
                "reset to default" if not body.overrides else f"{len(body.overrides)} overrides")
    return {"ok": True, "overrides": body.overrides}


# ---------------- Assessment ----------------
ASSESSMENT_DIMENSIONS = [
    "Business goals", "Process maturity", "Knowledge readiness", "Data readiness",
    "Integration readiness", "Human ownership", "Adoption readiness",
    "Risk and governance", "Measurement readiness",
]


@api.get("/organizations/{org_id}/assessment")
async def get_assessment(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    a = clean(await db.assessments.find_one({"organization_id": org_id}))
    if not a:
        a = {"organization_id": org_id, "answers": {}, "dimensions": ASSESSMENT_DIMENSIONS}
    else:
        a["dimensions"] = ASSESSMENT_DIMENSIONS
    a["score"] = _assessment_score(a.get("answers", {}))
    return a


def _assessment_score(answers):
    vals = []
    counted, unknown, na = 0, 0, 0
    for dim, ans in answers.items():
        if ans.get("unknown"):
            unknown += 1
            continue
        if ans.get("not_applicable"):
            na += 1
            continue
        if isinstance(ans.get("response"), (int, float)):
            vals.append(ans["response"])
            counted += 1
    avg = round(sum(vals) / len(vals), 2) if vals else None
    return {"average": avg, "counted": counted, "unknown": unknown, "not_applicable": na,
            "note": "Unknown values are excluded, never treated as zero."}


class AssessmentAnswerIn(BaseModel):
    dimension: str
    response: Optional[float] = None
    evidence: str = ""
    assessor: str = ""
    confidence: str = "medium"
    notes: str = ""
    unknown: bool = False
    not_applicable: bool = False


@api.put("/organizations/{org_id}/assessment")
async def save_assessment(org_id: str, body: AssessmentAnswerIn, user: dict = Depends(get_current_user)):
    await require_write(user, org_id)
    ans = body.model_dump()
    ans["date"] = now_iso()
    await db.assessments.update_one(
        {"organization_id": org_id},
        {"$set": {f"answers.{body.dimension}": ans, "organization_id": org_id}},
        upsert=True)
    await audit(user, org_id, "assess", "assessment", body.dimension)
    a = clean(await db.assessments.find_one({"organization_id": org_id}))
    a["score"] = _assessment_score(a.get("answers", {}))
    return a


# ---------------- Group / portfolio oversight ----------------
@api.get("/portfolios/{pf_id}/oversight")
async def oversight(pf_id: str, user: dict = Depends(get_current_user)):
    pf = clean(await db.portfolios.find_one({"id": pf_id}))
    if not pf:
        raise HTTPException(404, "Not found")
    ws_ids = await accessible_workspace_ids(user)
    if pf["workspace_id"] not in ws_ids:
        raise HTTPException(403, "Not authorized")
    allowed = await accessible_org_ids(user)
    member_ids = list(dict.fromkeys(pf["organization_ids"]))  # dedupe
    restricted = [m for m in member_ids if m not in allowed]
    visible = [m for m in member_ids if m in allowed]
    companies = []
    for oid in visible:
        o = clean(await db.organizations.find_one({"id": oid}))
        inits = [clean(e) for e in await db.entities.find(
            {"organization_id": oid, "etype": "initiative", "archived": False}).to_list(1000)]
        opps = await db.entities.count_documents(
            {"organization_id": oid, "etype": "opportunity", "archived": False})
        agents = [clean(e) for e in await db.entities.find(
            {"organization_id": oid, "etype": "agent", "archived": False}).to_list(1000)]
        a = clean(await db.assessments.find_one({"organization_id": oid}))
        companies.append({
            "id": oid, "name": o["name"], "currency": o.get("currency", "USD"),
            "initiatives": len(inits), "opportunities": opps, "agents": len(agents),
            "phases": {str(p): sum(1 for ag in agents if ag["data"].get("phase") == p)
                       for p in [1, 2, 3]},
            "assessment_coverage": (len(a.get("answers", {})) if a else 0),
            "assessment_total": len(ASSESSMENT_DIMENSIONS),
        })
    return {
        "portfolio": pf["name"],
        "companies": companies,
        "restricted_count": len(restricted),
        "aggregation_notes": [
            "Companies in multiple portfolios are counted once (deduplicated).",
            "Percentages are not summed across companies.",
            "Metric definitions are not mixed; currencies kept separate.",
            f"{len(restricted)} company/companies hidden due to access restrictions (names withheld).",
        ],
    }


# ---------------- Audit & export ----------------
@api.get("/organizations/{org_id}/audit")
async def get_audit(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    return [clean(a) for a in await db.audit.find({"organization_id": org_id})
            .sort("at", -1).to_list(500)]


@api.get("/organizations/{org_id}/export")
async def export_org(org_id: str, user: dict = Depends(get_current_user)):
    role = await org_role(user, org_id)
    if role not in ("company_admin", "workspace_admin", "platform_admin"):
        raise HTTPException(403, "Export requires admin access")
    entities = [clean(e) for e in await db.entities.find({"organization_id": org_id}).to_list(10000)]
    rels = [clean(r) for r in await db.relationships.find({"organization_id": org_id}).to_list(10000)]
    o = clean(await db.organizations.find_one({"id": org_id}))
    await audit(user, org_id, "export", "organization", org_id)
    return JSONResponse(content={"organization": o, "entities": entities, "relationships": rels,
                                 "exported_at": now_iso(), "exported_by": user["name"]})


# ---------------- Seed (idempotent, demo data) ----------------
@api.post("/admin/seed")
async def reseed(user: dict = Depends(get_current_user)):
    if user.get("global_role") != "platform_admin":
        raise HTTPException(403, "Platform admin only")
    if os.environ.get("ALLOW_DEMO_RESEED", "").lower() != "true":
        raise HTTPException(403, "Demo reseed is disabled. Set ALLOW_DEMO_RESEED=true to enable it on a demo instance.")
    await seed_module.seed_demo(force=True)
    return {"ok": True}


# ---------------- Lifecycle pipeline ----------------
DEFAULT_STAGES = [
    {"key": "discovery", "label": "Discovery", "gated": False},
    {"key": "assessing", "label": "Assessing", "gated": False},
    {"key": "alternatives", "label": "Alternatives", "gated": False},
    {"key": "offer", "label": "Offer", "gated": False},
    {"key": "approved", "label": "Approved", "gated": True},
    {"key": "in_progress", "label": "In progress", "gated": True},
    {"key": "live", "label": "Live", "gated": True},
    {"key": "realized", "label": "Realized", "gated": True},
]
STAGES = DEFAULT_STAGES  # global default; companies may customize
PIPELINE_ETYPES = {"initiative", "opportunity"}


async def get_org_stages(org_id):
    org = clean(await db.organizations.find_one({"id": org_id}))
    st = (org or {}).get("pipeline_stages")
    return st or DEFAULT_STAGES


def _stage_maps(stages):
    keys = [s["key"] for s in stages]
    labels = {s["key"]: s["label"] for s in stages}
    gated = {s["key"] for s in stages if s.get("gated")}
    return keys, labels, gated


def _owner_of(data):
    return data.get("owner") or data.get("human_owner") or data.get("assignee")


def _blocked_reason(data, stage, labels, gated):
    """Clear reason a stage move is blocked, or None if allowed."""
    if stage in gated and not _owner_of(data):
        return f"Assign an owner before moving to “{labels[stage]}”. Gated stages need an accountable owner."
    return None


class OrgStagesIn(BaseModel):
    stages: List[dict]


@api.get("/organizations/{org_id}/stages")
async def get_stages(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    stages = await get_org_stages(org_id)
    role = await org_role(user, org_id)
    return {"stages": stages, "is_custom": stages is not DEFAULT_STAGES,
            "can_edit": role in ("company_admin", "workspace_admin", "platform_admin")}


@api.put("/organizations/{org_id}/stages")
async def save_stages(org_id: str, body: OrgStagesIn, user: dict = Depends(get_current_user)):
    role = await org_role(user, org_id)
    if role not in ("company_admin", "workspace_admin", "platform_admin"):
        raise HTTPException(403, "Only company admins may edit pipeline stages")
    cleaned, seen = [], set()
    for s in body.stages:
        key = (s.get("key") or "").strip()
        label = (s.get("label") or "").strip()
        if not key or not label:
            raise HTTPException(400, "Each stage needs a key and a label.")
        if key in seen:
            raise HTTPException(400, f"Duplicate stage key: {key}")
        seen.add(key)
        cleaned.append({"key": key, "label": label, "gated": bool(s.get("gated"))})
    if not cleaned:
        raise HTTPException(400, "At least one stage is required.")
    # Protect stages that still hold records from being removed
    current = await get_org_stages(org_id)
    removed = [s["key"] for s in current if s["key"] not in seen]
    for key in removed:
        n = await db.entities.count_documents({"organization_id": org_id, "data.stage": key, "archived": False})
        if n:
            raise HTTPException(400, f"Cannot remove “{key}”: {n} record(s) are still in that stage. Move them first.")
    await db.organizations.update_one({"id": org_id}, {"$set": {"pipeline_stages": cleaned}})
    await audit(user, org_id, "stages_edit", "organization", org_id, f"{len(cleaned)} stages")
    return {"ok": True, "stages": cleaned}


class StageIn(BaseModel):
    stage: str
    note: str = ""
    version: int


@api.post("/entities/{eid}/stage")
async def move_stage(eid: str, body: StageIn, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_write(user, e["organization_id"])
    if body.version != e["version"]:
        raise HTTPException(409, "Record changed since you loaded it. Reload and retry.")
    stages = await get_org_stages(e["organization_id"])
    keys, labels, gated = _stage_maps(stages)
    if body.stage not in keys:
        raise HTTPException(400, f"Unknown stage {body.stage}")
    reason = _blocked_reason(e["data"], body.stage, labels, gated)
    if reason:
        raise HTTPException(400, reason)
    history = list(e["data"].get("stage_history", []))
    history.append({"stage": body.stage, "at": now_iso(), "by": user.get("name"), "note": body.note})
    upd = {"data.stage": body.stage, "data.stage_history": history,
           "version": e["version"] + 1, "updated_at": now_iso()}
    if body.stage == "live" and not e["data"].get("went_live_at"):
        upd["data.went_live_at"] = now_iso()
    await db.entities.update_one({"id": eid}, {"$set": upd})
    await audit(user, e["organization_id"], "stage_move", e["etype"], eid, f"→ {labels[body.stage]}")
    return clean(await db.entities.find_one({"id": eid}))


class BulkIn(BaseModel):
    ids: List[str]
    action: str  # stage | owner | area
    value: str


@api.post("/entities/bulk")
async def bulk_action(body: BulkIn, user: dict = Depends(get_current_user)):
    if body.action not in ("stage", "owner", "area"):
        raise HTTPException(400, "Unsupported bulk action")
    updated, skipped = [], []
    for eid in body.ids:
        e = clean(await db.entities.find_one({"id": eid}))
        if not e:
            skipped.append({"id": eid, "reason": "not found"})
            continue
        try:
            await require_write(user, e["organization_id"])
        except HTTPException:
            skipped.append({"id": eid, "reason": "no write access"})
            continue
        if body.action == "stage":
            stages = await get_org_stages(e["organization_id"])
            keys, labels, gated = _stage_maps(stages)
            if body.value not in keys:
                skipped.append({"id": eid, "reason": "unknown stage"})
                continue
            reason = _blocked_reason(e["data"], body.value, labels, gated)
            if reason:
                skipped.append({"id": eid, "reason": reason})
                continue
            history = list(e["data"].get("stage_history", []))
            history.append({"stage": body.value, "at": now_iso(), "by": user.get("name"), "note": "bulk"})
            upd = {"data.stage": body.value, "data.stage_history": history}
            if body.value == "live" and not e["data"].get("went_live_at"):
                upd["data.went_live_at"] = now_iso()
        elif body.action == "owner":
            upd = {"data.owner": body.value}
        else:
            upd = {"data.area": body.value}
        upd["version"] = e["version"] + 1
        upd["updated_at"] = now_iso()
        await db.entities.update_one({"id": eid}, {"$set": upd})
        await audit(user, e["organization_id"], f"bulk_{body.action}", e["etype"], eid, body.value)
        updated.append(eid)
    return {"updated": updated, "skipped": skipped}


# ---------------- Documentation attachments (private per company) ----------------
ALLOWED_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "csv", "txt",
               "png", "jpg", "jpeg", "gif", "webp", "ppt", "pptx"}
MAX_FILE_BYTES = 15 * 1024 * 1024


@api.post("/entities/{eid}/attachments")
async def upload_attachment(eid: str, file: UploadFile = File(...),
                            user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Record not found")
    await require_write(user, e["organization_id"])
    ext = (file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "")
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"File type .{ext or '?'} not allowed. Allowed: {', '.join(sorted(ALLOWED_EXT))}.")
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(400, "File exceeds the 15 MB limit.")
    if not data:
        raise HTTPException(400, "Empty file.")
    path = f"{storage.APP_NAME}/{e['organization_id']}/{eid}/{secrets.token_hex(10)}.{ext}"
    ctype = file.content_type or "application/octet-stream"
    try:
        result = storage.put_object(path, data, ctype)
    except Exception as ex:
        raise HTTPException(502, f"Upload failed: {ex}")
    doc = {
        "id": secrets.token_hex(12), "organization_id": e["organization_id"], "entity_id": eid,
        "storage_path": result["path"], "original_filename": file.filename,
        "content_type": ctype, "size": result.get("size", len(data)),
        "is_deleted": False, "uploaded_by": user.get("name"), "uploaded_by_id": user["id"],
        "uploaded_at": now_iso(),
    }
    await db.attachments.insert_one(doc)
    await audit(user, e["organization_id"], "attach", e["etype"], eid, file.filename)
    return clean(doc)


@api.get("/entities/{eid}/attachments")
async def list_attachments(eid: str, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_read(user, e["organization_id"])
    return [clean(a) for a in await db.attachments.find(
        {"entity_id": eid, "is_deleted": False}).sort("uploaded_at", -1).to_list(500)]


@api.get("/attachments/{aid}/download")
async def download_attachment(aid: str, user: dict = Depends(get_current_user)):
    a = clean(await db.attachments.find_one({"id": aid, "is_deleted": False}))
    if not a:
        raise HTTPException(404, "File not found")
    await require_read(user, a["organization_id"])
    try:
        content, ctype = storage.get_object(a["storage_path"])
    except Exception as ex:
        raise HTTPException(502, f"Download failed: {ex}")
    return Response(content=content, media_type=a.get("content_type", ctype),
                    headers={"Content-Disposition": f'inline; filename="{a["original_filename"]}"'})


@api.delete("/attachments/{aid}")
async def remove_attachment(aid: str, user: dict = Depends(get_current_user)):
    a = clean(await db.attachments.find_one({"id": aid}))
    if not a:
        raise HTTPException(404, "Not found")
    await require_write(user, a["organization_id"])
    await db.attachments.update_one({"id": aid}, {"$set": {"is_deleted": True}})
    await audit(user, a["organization_id"], "detach", "attachment", a["entity_id"], a["original_filename"])
    return {"ok": True}


# ---------------- Dashboards (adjustable, per user + company default) ----------------
DEFAULT_WIDGETS = [
    {"id": "w-roi", "type": "roi_rollup", "size": "md"},
    {"id": "w-throughput", "type": "lifecycle_throughput", "size": "md"},
    {"id": "w-area", "type": "roi_by_area", "size": "md"},
    {"id": "w-phase", "type": "phase_progress", "size": "md"},
    {"id": "w-timefreed", "type": "time_freed", "size": "sm"},
    {"id": "w-reminders", "type": "reminders", "size": "sm"},
    {"id": "w-cadence", "type": "measurement_cadence", "size": "md"},
    {"id": "w-health", "type": "inventory_health", "size": "sm"},
    {"id": "w-roitable", "type": "roi_by_initiative", "size": "lg"},
]


@api.get("/organizations/{org_id}/dashboard")
async def get_dashboard(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    personal = clean(await db.dashboards.find_one({"organization_id": org_id, "user_id": user["id"]}))
    default = clean(await db.dashboards.find_one({"organization_id": org_id, "user_id": "__default__"}))
    if personal:
        widgets = personal["widgets"]
    elif default:
        widgets = default["widgets"]
    else:
        widgets = DEFAULT_WIDGETS
    return {"widgets": widgets, "is_personal": bool(personal),
            "has_default": bool(default), "can_publish_default":
            (await org_role(user, org_id)) in ("company_admin", "workspace_admin", "platform_admin")}


class DashboardIn(BaseModel):
    widgets: List[dict]


@api.put("/organizations/{org_id}/dashboard")
async def save_dashboard(org_id: str, body: DashboardIn, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    await db.dashboards.update_one(
        {"organization_id": org_id, "user_id": user["id"]},
        {"$set": {"organization_id": org_id, "user_id": user["id"],
                  "widgets": body.widgets, "updated_at": now_iso()}}, upsert=True)
    return {"ok": True}


@api.post("/organizations/{org_id}/dashboard/reset")
async def reset_dashboard(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    await db.dashboards.delete_one({"organization_id": org_id, "user_id": user["id"]})
    return {"ok": True}


@api.put("/organizations/{org_id}/dashboard/default")
async def publish_default_dashboard(org_id: str, body: DashboardIn, user: dict = Depends(get_current_user)):
    role = await org_role(user, org_id)
    if role not in ("company_admin", "workspace_admin", "platform_admin"):
        raise HTTPException(403, "Only company admins may publish the default dashboard")
    await db.dashboards.update_one(
        {"organization_id": org_id, "user_id": "__default__"},
        {"$set": {"organization_id": org_id, "user_id": "__default__",
                  "widgets": body.widgets, "updated_at": now_iso()}}, upsert=True)
    await audit(user, org_id, "dashboard_default", "dashboard", org_id, f"{len(body.widgets)} widgets")
    return {"ok": True}


# ---------------- Analytics (live, honest about missing data) ----------------
ANALYTICS_ETYPES = ["initiative", "opportunity", "agent", "workflow"]


def _num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


@api.get("/organizations/{org_id}/analytics")
async def analytics(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    org = clean(await db.organizations.find_one({"id": org_id})) or {}
    all_ents = [clean(e) for e in await db.entities.find(
        {"organization_id": org_id, "archived": False}).to_list(10000)]
    records = []
    for e in all_ents:
        if e["etype"] not in ANALYTICS_ETYPES:
            continue
        d = e["data"]
        records.append({
            "id": e["id"], "etype": e["etype"], "name": d.get("name", ""),
            "area": d.get("area"), "stage": d.get("stage"), "phase": d.get("phase"),
            "owner": _owner_of(d), "status": e["status"],
            "cost": _num(d.get("cost_estimate")) if d.get("cost_estimate") not in (None, "") else _num(d.get("budget")),
            "cost_period": d.get("cost_period") or ("one_off" if d.get("budget") else None),
            "currency": d.get("currency") or org.get("currency", "USD"),
            "expected_benefit": _num(d.get("expected_benefit")),
            "realized_benefit": _num(d.get("realized_benefit")),
            "time_freed_hours": _num(d.get("time_freed_hours")),
            "hourly_rate": _num(d.get("hourly_rate")),
            "cadence": d.get("cadence") or {},
            "went_live_at": d.get("went_live_at"),
        })
    by_type, by_area = {}, {}
    missing_owner = never_reviewed = 0
    for e in all_ents:
        by_type[e["etype"]] = by_type.get(e["etype"], 0) + 1
        ar = e["data"].get("area")
        if ar:
            by_area[ar] = by_area.get(ar, 0) + 1
        if not _owner_of(e["data"]) and e["etype"] in ("agent", "process", "opportunity", "initiative"):
            missing_owner += 1
        if not e.get("last_reviewed_at"):
            never_reviewed += 1
    stages = await get_org_stages(org_id)
    keys, _labels, _gated = _stage_maps(stages)
    stage_counts = {k: 0 for k in keys}
    for r in records:
        if r["stage"] in stage_counts:
            stage_counts[r["stage"]] += 1
    phase_counts = {1: 0, 2: 0, 3: 0}
    for e in all_ents:
        p = e["data"].get("phase")
        if p in phase_counts:
            phase_counts[p] += 1
    return {
        "currency": org.get("currency", "USD"),
        "records": records,
        "stage_counts": stage_counts,
        "phase_counts": phase_counts,
        "stages": stages,
        "inventory": {"by_type": by_type, "by_area": by_area, "total": len(all_ents),
                      "missing_owner": missing_owner, "never_reviewed": never_reviewed},
    }


def _annual_cost(d):
    c = _num(d.get("cost_estimate")) if d.get("cost_estimate") not in (None, "") else _num(d.get("budget"))
    if c is None:
        return None
    p = d.get("cost_period") or ("one_off" if d.get("budget") else None)
    if p == "monthly":
        return c * 12
    if p == "per_use":
        return None
    return c


async def _org_rollup(org_id):
    org = clean(await db.organizations.find_one({"id": org_id})) or {}
    stages = await get_org_stages(org_id)
    keys, _labels, _gated = _stage_maps(stages)
    ents = [clean(e) for e in await db.entities.find(
        {"organization_id": org_id, "archived": False}).to_list(10000)]
    recs = [e for e in ents if e["etype"] in ANALYTICS_ETYPES]
    total_cost = sum(v for v in (_annual_cost(e["data"]) for e in recs) if v)
    expected = sum(v for v in (_num(e["data"].get("expected_benefit")) for e in recs) if v)
    realized = sum(v for v in (_num(e["data"].get("realized_benefit")) for e in recs) if v)
    cc = bb = complete = 0
    for e in recs:
        d = e["data"]
        c = _annual_cost(d)
        rb = _num(d.get("realized_benefit"))
        eb = _num(d.get("expected_benefit"))
        b = rb if rb is not None else eb
        if c is not None and b is not None:
            cc += c
            bb += b
            complete += 1
    roi = ((bb - cc) / cc * 100) if (complete and cc > 0) else None
    by_area = {}
    for e in recs:
        ar = e["data"].get("area")
        if ar:
            by_area[ar] = by_area.get(ar, 0) + 1
    stage_counts = {k: 0 for k in keys}
    for e in recs:
        s = e["data"].get("stage")
        if s in stage_counts:
            stage_counts[s] += 1
    return {"id": org_id, "name": org.get("name"), "currency": org.get("currency", "USD"),
            "cost": total_cost, "expected": expected, "realized": realized, "roi_pct": roi,
            "complete": complete, "total": len(recs), "by_area": by_area, "stage_counts": stage_counts}


@api.get("/portfolios/{pf_id}/analytics")
async def portfolio_analytics(pf_id: str, user: dict = Depends(get_current_user)):
    pf = clean(await db.portfolios.find_one({"id": pf_id}))
    if not pf:
        raise HTTPException(404, "Not found")
    ws_ids = await accessible_workspace_ids(user)
    if pf["workspace_id"] not in ws_ids:
        raise HTTPException(403, "Not authorized")
    allowed = await accessible_org_ids(user)
    members = list(dict.fromkeys(pf["organization_ids"]))  # dedupe
    visible = [m for m in members if m in allowed]
    restricted = len(members) - len(visible)
    companies = [await _org_rollup(oid) for oid in visible]
    return {"portfolio": pf["name"], "companies": companies, "restricted_count": restricted,
            "notes": ["Companies in multiple portfolios are counted once.",
                      "Currencies are kept separate — totals are not summed across currencies.",
                      f"{restricted} company/companies withheld due to access restrictions."]}


@api.get("/organizations/{org_id}/reminders")
async def measurement_reminders(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    ents = [clean(e) for e in await db.entities.find(
        {"organization_id": org_id, "archived": False,
         "etype": {"$in": ["initiative", "opportunity", "agent"]}}).to_list(10000)]
    now = datetime.now(timezone.utc)
    out = []
    for e in ents:
        wl = e["data"].get("went_live_at")
        if not wl:
            continue
        try:
            dt = datetime.fromisoformat(wl)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue
        days = (now - dt).days
        months = days / 30.44
        cad = e["data"].get("cadence") or {}
        for cp, m in (("m3", 3), ("m6", 6), ("m12", 12)):
            if months >= m and cad.get(cp) in (None, ""):
                out.append({"id": e["id"], "name": e["data"].get("name", ""),
                            "etype": e["etype"], "owner": _owner_of(e["data"]),
                            "checkpoint": cp, "month": m, "went_live_at": wl,
                            "overdue_days": int(days - m * 30.44)})
    out.sort(key=lambda r: r["overdue_days"], reverse=True)
    return {"reminders": out, "count": len(out)}


# ---------------- Roadmap templates (one-click Co-Pilot → Brain → Autonomous per area) ----------------
ROADMAP_STEPS = [
    {"phase": 1, "step": "AI Co-Pilot",
     "problem": "Manual, repetitive tasks are slow and vary in quality.",
     "deliverables": "Pilot a human-directed co-pilot on one high-volume task; revise the SOP."},
    {"phase": 2, "step": "AI Brain",
     "problem": "Team knowledge is scattered; the co-pilot lacks governed context.",
     "deliverables": "Organize the knowledge base into a governed brain supporting authorized workflows."},
    {"phase": 3, "step": "Autonomous Agents",
     "problem": "Selected workflows are ready to run within approved boundaries.",
     "deliverables": "Enable bounded autonomous execution with human escalation and audit."},
]


class RoadmapTemplateIn(BaseModel):
    areas: Optional[List[str]] = None


@api.post("/organizations/{org_id}/roadmap-template")
async def seed_roadmap_template(org_id: str, body: RoadmapTemplateIn, user: dict = Depends(get_current_user)):
    await require_write(user, org_id)
    org = clean(await db.organizations.find_one({"id": org_id}))
    if not org:
        raise HTTPException(404, "Organization not found")
    area_label = dict(zip(seed_module.CANON_KEYS, seed_module.CAPABILITY_LIBRARY))
    areas = body.areas or seed_module.CANON_KEYS
    created, skipped = 0, 0
    for ak in areas:
        label = area_label.get(ak, ak)
        for st in ROADMAP_STEPS:
            exists = await db.entities.find_one({
                "organization_id": org_id, "etype": "initiative", "archived": False,
                "data.template": True, "data.area": ak, "data.phase": st["phase"]})
            if exists:
                skipped += 1
                continue
            doc = {
                "id": secrets.token_hex(12), "etype": "initiative",
                "organization_id": org_id, "workspace_id": org["workspace_id"],
                "data": {"name": f"{label} — {st['step']}", "area": ak, "phase": st["phase"],
                         "stage": "discovery", "status": "planned", "template": True,
                         "business_problem": st["problem"], "deliverables": st["deliverables"],
                         "stage_history": [{"stage": "discovery", "at": now_iso(),
                                            "by": user.get("name"), "note": "roadmap template"}]},
                "status": "draft", "state": None, "version": 1, "is_demo": False,
                "archived": False, "created_at": now_iso(), "updated_at": now_iso(),
                "last_reviewed_at": None,
            }
            await db.entities.insert_one(doc)
            created += 1
    await audit(user, org_id, "roadmap_template", "initiative", org_id, f"{created} created")
    return {"ok": True, "created": created, "skipped": skipped}


# ---------------- Scheduled measurement-checkpoint nudges (email) ----------------
CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def _org_admin_emails(org_id, ws_id):
    emails = set()
    for u in await db.users.find({"global_role": "platform_admin"}).to_list(1000):
        if u.get("email"):
            emails.add(u["email"])
    q = {"$or": [{"scope_type": "organization", "scope_id": org_id, "role": "company_admin"},
                 {"scope_type": "workspace", "scope_id": ws_id, "role": "workspace_admin"}]}
    for m in await db.memberships.find(q).to_list(1000):
        u = await db.users.find_one({"id": m["user_id"]})
        if u and u.get("email"):
            emails.add(u["email"])
    return list(emails)


def _nudge_html(org_name, items):
    from html import escape
    rows = "".join(
        f'<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">{escape(e["data"].get("name",""))}</td>'
        f'<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">{m}-month checkpoint</td>'
        f'<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#b45309">{escape(str(e["data"].get("owner") or e["data"].get("human_owner") or "unassigned"))}</td></tr>'
        for (e, cp, m) in items)
    return (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#111827">'
            f'<p style="font-size:16px;font-weight:700">Measurement checkpoints due — {escape(org_name)}</p>'
            f'<p style="font-size:13px;color:#374151">These records went Live and a 3 / 6 / 12-month checkpoint is now due. '
            f'Open BOTS and record the realized benefit so ROI stays trustworthy.</p>'
            f'<table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="text-align:left;color:#6b7280">'
            f'<th style="padding:6px 10px">Record</th><th style="padding:6px 10px">Checkpoint</th><th style="padding:6px 10px">Owner</th></tr>'
            f'{rows}</table>'
            f'<p style="font-size:12px;color:#888;margin-top:16px">Sent by BOTS. We never ask for your password or payment details by email.</p>'
            f'</td></tr></table>')


async def _run_checkpoint_nudges():
    now = datetime.now(timezone.utc)
    sent = 0
    for org in await db.organizations.find({}).to_list(5000):
        org = clean(org)
        ents = [clean(e) for e in await db.entities.find(
            {"organization_id": org["id"], "archived": False,
             "etype": {"$in": ["initiative", "opportunity", "agent"]}}).to_list(10000)]
        fresh = []
        for e in ents:
            wl = e["data"].get("went_live_at")
            if not wl:
                continue
            try:
                dt = datetime.fromisoformat(wl)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                continue
            months = (now - dt).days / 30.44
            cad = e["data"].get("cadence") or {}
            for cp, m in (("m3", 3), ("m6", 6), ("m12", 12)):
                if months >= m and cad.get(cp) in (None, ""):
                    key = f"{e['id']}:{cp}"
                    if await db.reminder_sent.find_one({"key": key}):
                        continue
                    fresh.append((e, cp, m, key))
        if not fresh:
            continue
        admin_emails = await _org_admin_emails(org["id"], org.get("workspace_id"))
        buckets = {}
        for (e, cp, m, key) in fresh:
            oe = e["data"].get("owner_email")
            recips = [oe] if (oe and _EMAIL_RE.match(oe)) else admin_emails
            for r in recips:
                buckets.setdefault(r, []).append((e, cp, m))
        for email, items in buckets.items():
            try:
                await send_email(to=email, subject=f"{len(items)} measurement checkpoint(s) due — {org['name']}",
                                 html=_nudge_html(org["name"], items))
                sent += 1
            except Exception as ex:
                logger.warning(f"Nudge email to {email} failed: {ex}")
        for (e, cp, m, key) in fresh:
            await db.reminder_sent.update_one({"key": key}, {"$set": {"key": key, "at": now_iso()}}, upsert=True)
    logger.info(f"Checkpoint nudges: emailed {sent} recipient(s)")
    return sent


@api.post("/cron/checkpoint-nudges")
async def cron_checkpoint_nudges(background: BackgroundTasks, authorization: str = Header(None)):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if not CRON_SECRET or not hmac.compare_digest(token, CRON_SECRET):
        raise HTTPException(401, "Unauthorized")
    background.add_task(_run_checkpoint_nudges)
    return {"ok": True, "queued": True}


@api.get("/meta/framework")
async def framework_meta(user: dict = Depends(get_current_user)):
    return {
        "capabilities": seed_module.CAPABILITY_LIBRARY,
        "functions": seed_module.FUNCTIONS,
        "phases": seed_module.PHASES,
        "relationship_types": ["reports_to", "coordinates", "supports", "shares_info",
                               "depends_on", "shared_service", "requires_approval", "hands_to"],
        "value_chain": seed_module.VALUE_CHAIN,
        "stages": STAGES,
    }


app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.entities.create_index("organization_id")
    await db.entities.create_index("etype")
    await db.attachments.create_index("entity_id")
    try:
        storage.init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await seed_module.seed_demo()


@app.on_event("shutdown")
async def shutdown():
    pass
