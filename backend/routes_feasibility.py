"""Feasibility: batch AI classification (drafts) + human review (final verdict).

Only the job writes `data.feasibility.draft`; only the review endpoint writes `data.feasibility.final`
and the flat `feasibility_class`. Both use compare-and-set on the record version, so an open drawer
gets a 409 instead of a silent overwrite.
"""
import asyncio
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from db import db, clean
from auth import get_current_user
from access import require_read, require_write
from auditlog import audit, now_iso
from entities_util import cas_update
from providers.llm import get_llm, LLMError

feasibility_router = APIRouter(prefix="/api")

CLASSES = ["current_stack", "configure", "build", "buy", "not_tech"]
PROMPT_VERSION = "feas-v1"
MAX_PARALLEL = 3
ACTIVE_JOB_MINUTES = 15  # a queued/running job younger than this blocks a second run for the same company
STALE_JOB_MINUTES = 30  # at startup, a queued/running job older than this died with the previous process

_S = {"type": "string"}
_ARR = {"type": "array", "items": _S}
FEAS_SCHEMA = {
    "type": "object", "title": "FeasibilityOut",
    "properties": {
        "classification": {"type": "string", "enum": CLASSES},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "rationale": _S,
        "systems_used": _ARR,
        "what_to_do": _S,
        "prerequisites": _ARR,
        "risks": _ARR,
        "estimated_effort": {"type": "string", "enum": ["S", "M", "L"]},
        "quick_win": {"type": "boolean"},
        "suggested_phase": {"type": "integer"},
        "open_questions": _ARR,
    },
    "required": ["classification", "confidence", "rationale", "systems_used", "what_to_do", "prerequisites", "risks",
                 "estimated_effort", "quick_win", "suggested_phase", "open_questions"],
    "additionalProperties": False,
}

CLASS_RULES = (
    "Classify the item into exactly one class, preferring the cheapest option that genuinely solves it:\n"
    "- current_stack: the company already owns a system that does this; it is a matter of using it (training, a report, a setting that exists).\n"
    "- configure: achievable by configuring or connecting systems already in the inventory (workflows, calculated fields, native integrations, exports), no custom code beyond light scripting.\n"
    "- build: needs custom software, an integration that does not exist, or an AI agent built on the company's data.\n"
    "- buy: a product the company does not have solves it; licensing beats building.\n"
    "- not_tech: the root cause is process, people, policy or decision rights; technology would not fix it.\n"
    "Rules: never invent systems; systems_used only from the inventory given; quick_win is true only when estimated_effort is S and nothing listed in prerequisites blocks it; "
    "suggested_phase 1 = assistive (human runs it), 2 = system of knowledge, 3 = autonomous agent; rationale is 2-4 sentences a CFO would accept; "
    "open_questions are the facts you would need to raise confidence. This is a draft a consultant will review."
)


def _system_prompt(lang: str) -> str:
    return ("You help a consultant decide how a company should address each initiative, pain point or slow task raised by its leadership, "
            f"using the technology inventory recorded for that company. Answer in {lang}.\n" + CLASS_RULES)


def _lang(org: dict) -> str:
    return "Spanish" if ((org or {}).get("locale") or "es-MX").lower().startswith("es") else "English"


def _inventory_lines(systems: List[dict]) -> str:
    out = []
    for s in systems:
        d = s.get("data") or {}
        bits = [d.get("name", "?"), d.get("kind") or "", d.get("vendor") or "", f"area={d.get('area') or '-'}",
                f"api={d.get('api_available') or 'unknown'}{('/' + d['api_type']) if d.get('api_type') else ''}",
                f"mcp={d.get('mcp_available') or 'unknown'}", "verified" if d.get("verified_integration") else ""]
        if d.get("integration_notes"):
            bits.append(f"notes: {str(d['integration_notes'])[:140]}")
        out.append("- " + " · ".join(b for b in bits if b))
    return "\n".join(out) if out else "(no systems recorded yet)"


def _item_block(e: dict) -> str:
    d = e.get("data") or {}
    rows = [("Name", d.get("name")), ("Kind", d.get("intake_kind")), ("Area", d.get("area")), ("Raised by", f"{d.get('raised_by') or ''} {('(' + d['raised_by_role'] + ')') if d.get('raised_by_role') else ''}".strip()),
            ("Business problem", d.get("business_problem")), ("Intended outcome", d.get("intended_outcome")), ("Current process", d.get("current_process")),
            ("Frequency", d.get("frequency")), ("Hours per occurrence", d.get("time_per_occurrence_hours")), ("People involved", d.get("people_involved")),
            ("Systems involved", ", ".join(d.get("systems_involved") or []) if isinstance(d.get("systems_involved"), list) else d.get("systems_involved")),
            ("Urgency", d.get("urgency")), ("Impact", d.get("impact")), ("Evidence", d.get("evidence_quote"))]
    return "\n".join(f"{k}: {v}" for k, v in rows if v not in (None, "", [], 0))


def _normalise(out: dict, known: List[str]) -> dict:
    """Make a model answer safe to store: valid class, known systems only, phase in 1-3, lists of strings."""
    if not isinstance(out, dict) or out.get("classification") not in CLASSES:
        raise LLMError("invalid_json", "classification missing or not one of the five classes")
    km = {k.lower(): k for k in known}
    res = {
        "classification": out["classification"],
        "confidence": out.get("confidence") if out.get("confidence") in ("low", "medium", "high") else "low",
        "rationale": str(out.get("rationale") or "")[:2000],
        "systems_used": sorted({km[s.strip().lower()] for s in (out.get("systems_used") or []) if isinstance(s, str) and s.strip().lower() in km}),
        "what_to_do": str(out.get("what_to_do") or "")[:2000],
        "prerequisites": [str(x)[:300] for x in (out.get("prerequisites") or []) if str(x).strip()][:12],
        "risks": [str(x)[:300] for x in (out.get("risks") or []) if str(x).strip()][:12],
        "estimated_effort": out.get("estimated_effort") if out.get("estimated_effort") in ("S", "M", "L") else "M",
        "quick_win": bool(out.get("quick_win")),
        "suggested_phase": int(out["suggested_phase"]) if isinstance(out.get("suggested_phase"), (int, float)) and 1 <= int(out["suggested_phase"]) <= 3 else 1,
        "open_questions": [str(x)[:300] for x in (out.get("open_questions") or []) if str(x).strip()][:12],
    }
    if res["quick_win"] and (res["estimated_effort"] != "S" or res["prerequisites"]):
        res["quick_win"] = False
    return res


# ---- batch run ------------------------------------------------------------------------------------
def _started(job: dict) -> Optional[datetime]:
    """When the job started (or was created, while still queued); None when the stamp is missing or malformed."""
    raw = job.get("started_at") or job.get("created_at")
    try:
        t = datetime.fromisoformat(str(raw))
    except (TypeError, ValueError):
        return None
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


async def _active_job(org_id: str) -> Optional[dict]:
    """A queued/running feasibility job for the org that is still young enough to be alive."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ACTIVE_JOB_MINUTES)
    cur = db.jobs.find({"organization_id": org_id, "kind": "feasibility", "status": {"$in": ["queued", "running"]}}, {"items": 0})
    for j in await cur.sort("created_at", -1).to_list(20):
        t = _started(j)
        if t and t >= cutoff:
            return clean(j)
    return None


async def reap_stale_jobs() -> int:
    """Startup sweep: the background task of a queued/running job dies with its process, so a job still in that
    state after STALE_JOB_MINUTES will never finish. Mark it failed so the UI stops waiting and new runs are not
    blocked. Returns how many jobs were marked."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=STALE_JOB_MINUTES)).isoformat()
    res = await db.jobs.update_many(
        {"kind": "feasibility", "status": {"$in": ["queued", "running"]},
         "$or": [{"started_at": {"$lt": cutoff}}, {"started_at": None, "created_at": {"$lt": cutoff}}]},
        {"$set": {"status": "failed", "finished_at": now_iso(), "error": "interrupted by restart"}})
    return int(getattr(res, "modified_count", 0) or 0)


class RunIn(BaseModel):
    ids: Optional[List[str]] = None
    force: bool = False


@feasibility_router.post("/organizations/{org_id}/feasibility/run")
async def run_feasibility(org_id: str, body: RunIn, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    await require_write(user, org_id)
    llm = get_llm()
    if not llm.enabled:
        raise HTTPException(503, "No AI provider configured")
    org = clean(await db.organizations.find_one({"id": org_id}))
    if not org:
        raise HTTPException(404, "Organization not found")
    if await _active_job(org_id):
        raise HTTPException(409, "A classification run is already in progress for this company")
    q = {"organization_id": org_id, "etype": "initiative", "archived": False, "data.intake_kind": {"$exists": True, "$ne": ""}}
    if body.ids:
        q["id"] = {"$in": body.ids[:500]}
    cands = [clean(e) for e in await db.entities.find(q, {"id": 1, "version": 1, "data.name": 1, "data.feasibility": 1}).to_list(500)]
    todo, skipped = [], 0
    for e in cands:
        fz = (e.get("data") or {}).get("feasibility") or {}
        # skip finalised items and pending drafts; a rejected draft is drafted again (the inventory may have grown)
        if not body.force and (fz.get("final") or (fz.get("draft") and fz.get("review_action") != "rejected")):
            skipped += 1
            continue
        todo.append(e)
    if not todo:
        return {"job_id": None, "queued": 0, "skipped": skipped}
    job = {"id": secrets.token_hex(8), "organization_id": org_id, "kind": "feasibility", "status": "queued",
           "total": len(todo), "done": 0, "ok": 0, "failed": 0, "skipped": skipped,
           "items": [{"id": e["id"], "name": (e.get("data") or {}).get("name", ""), "status": "queued"} for e in todo],
           "created_by": user.get("name"), "created_at": now_iso(), "started_at": None, "finished_at": None,
           "model": llm.model, "prompt_version": PROMPT_VERSION, "force": body.force, "error": None}
    await db.jobs.insert_one(dict(job))
    background.add_task(_run_job, job["id"], user)
    return {"job_id": job["id"], "queued": len(todo), "skipped": skipped}


async def _run_job(job_id: str, user: dict):
    job = clean(await db.jobs.find_one({"id": job_id}))
    if not job:
        return
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "running", "started_at": now_iso()}})
    try:
        org = clean(await db.organizations.find_one({"id": job["organization_id"]})) or {}
        systems = [clean(s) for s in await db.entities.find(
            {"organization_id": job["organization_id"], "etype": "system", "archived": False}).to_list(500)]
        known = sorted({(s.get("data") or {}).get("name", "") for s in systems} - {""})
        inventory = _inventory_lines(systems)
        system_prompt = _system_prompt(_lang(org))
        llm = get_llm()
        sem = asyncio.Semaphore(MAX_PARALLEL)

        async def one(item):
            async with sem:
                await _classify_one(job, item["id"], org, inventory, known, system_prompt, llm)

        await asyncio.gather(*(one(it) for it in job["items"]))
        fresh = clean(await db.jobs.find_one({"id": job_id}))
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "done", "finished_at": now_iso()}})
        await audit(user, job["organization_id"], "feasibility_run", "initiative", job_id,
                    f"{fresh.get('ok', 0)} drafted, {fresh.get('failed', 0)} failed, {job.get('skipped', 0)} skipped")
    except Exception as e:  # the job must never leave a record half-written; per-item writes are atomic
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "failed", "finished_at": now_iso(), "error": str(e)[:300]}})


async def _classify_one(job: dict, eid: str, org: dict, inventory: str, known: List[str], system_prompt: str, llm):
    async def mark(status, **extra):
        sets = {"items.$.status": status, **{f"items.$.{k}": v for k, v in extra.items()}}
        inc = {"done": 1, "ok": 1 if status == "ok" else 0, "failed": 1 if status == "failed" else 0}
        await db.jobs.update_one({"id": job["id"], "items.id": eid}, {"$set": sets, "$inc": inc})

    try:
        e = clean(await db.entities.find_one({"id": eid}))
        if not e or e.get("archived"):
            return await mark("failed", error="record no longer available")
        user_msg = (f"Company: {org.get('name', '?')}\n\nTechnology inventory:\n{inventory}\n\nItem to classify:\n{_item_block(e)}")
        out = await llm.complete_json(system=system_prompt, user=user_msg, schema=FEAS_SCHEMA, max_tokens=4096)
        content = _normalise(out, known)
        draft = {"label": "AI_DRAFT", "kind": "feasibility", "content": content,
                 "assumptions": "Drafted from the recorded inventory and intake fields only. Requires human review.",
                 "generated_at": now_iso(), "accepted": False, "model": llm.model, "prompt_version": PROMPT_VERSION, "run_id": job["id"]}
        sets = {"data.feasibility.draft": draft, "data.feasibility_draft_class": content["classification"]}
        if not await cas_update(eid, e["version"], sets):
            e2 = clean(await db.entities.find_one({"id": eid}))  # one retry: someone edited the record meanwhile
            if not e2 or not await cas_update(eid, e2["version"], sets):
                return await mark("failed", error="record changed during the run")
        await mark("ok", **{"class": content["classification"], "confidence": content["confidence"]})
    except LLMError as ex:
        await mark("failed", error=f"{ex.kind}: {ex}"[:300])
    except Exception as ex:  # keep the batch going
        await mark("failed", error=f"{type(ex).__name__}: {ex}"[:300])


@feasibility_router.get("/organizations/{org_id}/feasibility/jobs")
async def list_jobs(org_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    jobs = await db.jobs.find({"organization_id": org_id, "kind": "feasibility"}, {"items": 0}).sort("created_at", -1).to_list(20)
    return [clean(j) for j in jobs]


@feasibility_router.get("/organizations/{org_id}/feasibility/jobs/{job_id}")
async def get_job(org_id: str, job_id: str, user: dict = Depends(get_current_user)):
    await require_read(user, org_id)
    j = clean(await db.jobs.find_one({"id": job_id, "organization_id": org_id}))
    if not j:
        raise HTTPException(404, "Job not found")
    return j


# ---- human review -----------------------------------------------------------------------------------
class ReviewIn(BaseModel):
    action: str  # accepted | overridden | rejected
    version: int
    final: Optional[dict] = None
    note: Optional[str] = None


@feasibility_router.post("/entities/{eid}/feasibility/review")
async def review_feasibility(eid: str, body: ReviewIn, user: dict = Depends(get_current_user)):
    e = clean(await db.entities.find_one({"id": eid}))
    if not e:
        raise HTTPException(404, "Not found")
    await require_write(user, e["organization_id"])
    if e["etype"] != "initiative":
        raise HTTPException(400, "Only initiatives carry a feasibility verdict")
    if body.action not in ("accepted", "overridden", "rejected"):
        raise HTTPException(400, "action must be accepted, overridden or rejected")
    if body.version != e["version"]:
        raise HTTPException(409, "Record changed since you loaded it. Reload and retry.")
    fz = (e.get("data") or {}).get("feasibility") or {}
    draft = fz.get("draft") or {}
    draft_content = draft.get("content") if isinstance(draft.get("content"), dict) else None

    if body.action == "accepted":
        if not draft_content:
            raise HTTPException(400, "Nothing to accept: no AI draft on this record")
        final = draft_content
    elif body.action == "overridden":
        if not body.final or body.final.get("classification") not in CLASSES:
            raise HTTPException(400, f"final.classification must be one of {', '.join(CLASSES)}")
        known = sorted({(s.get("data") or {}).get("name", "") for s in await db.entities.find(
            {"organization_id": e["organization_id"], "etype": "system", "archived": False}, {"data.name": 1}).to_list(500)} - {""})
        final = _normalise({**(draft_content or {}), **body.final}, known)
    else:
        final = None

    stamp = {"review_action": body.action, "reviewed_by": user.get("name"), "reviewed_at": now_iso(), "review_note": (body.note or "")[:1000]}
    sets = {"data.feasibility.final": final, **{f"data.feasibility.{k}": v for k, v in stamp.items()}}
    unset = {}
    if draft:
        sets["data.feasibility.draft.accepted"] = body.action == "accepted"
    if final:
        sets["data.feasibility_class"] = final["classification"]
    else:  # rejected: no verdict, and the AI suggestion leaves the board (the draft stays on the record for reference)
        unset["data.feasibility_class"] = ""
        unset["data.feasibility_draft_class"] = ""
    ops = {"$set": {**sets, "updated_at": now_iso()}, "$inc": {"version": 1}}
    if unset:
        ops["$unset"] = unset
    res = await db.entities.update_one({"id": eid, "version": body.version}, ops)
    if res.matched_count != 1:
        raise HTTPException(409, "Record changed since you loaded it. Reload and retry.")
    await audit(user, e["organization_id"], "feasibility_review", "initiative", eid,
                f"{body.action}" + (f" → {final['classification']}" if final else ""))
    return clean(await db.entities.find_one({"id": eid}))
