from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import db, clean
from auth import auth_router, get_current_user
from ai import ai_router
import access
from access import require_read, require_write, accessible_org_ids, accessible_workspace_ids, org_role
import seed as seed_module

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


@api.get("/meta/framework")
async def framework_meta(user: dict = Depends(get_current_user)):
    return {
        "capabilities": seed_module.CAPABILITY_LIBRARY,
        "functions": seed_module.FUNCTIONS,
        "phases": seed_module.PHASES,
        "relationship_types": ["reports_to", "coordinates", "supports", "shares_info",
                               "depends_on", "shared_service", "requires_approval", "hands_to"],
        "value_chain": seed_module.VALUE_CHAIN,
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
    await seed_module.seed_demo()


@app.on_event("shutdown")
async def shutdown():
    pass
