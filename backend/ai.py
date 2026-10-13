"""AI assistance on the configured provider. Produces LABELED drafts only; nothing is auto-published."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from access import require_read, require_write
from db import db, clean
from providers.llm import get_llm, llm_status, LLMError
from fields import FIELD_ENUMS

ai_router = APIRouter(prefix="/api/ai")

AREA_KEYS = list(FIELD_ENUMS["initiative"]["area"])
AREA_LABELS = {
    "strategy": "Strategy & Leadership", "product": "Product / Service Management", "operations": "Operations & Supply Chain",
    "marketing": "Marketing & Growth", "sales": "Sales", "customer": "Customer & Admin", "data": "Data & Analytics",
    "tech": "Tech, AI & Automations", "finance": "Finance", "hr": "Human Resources", "legal": "Legal, Risk & Compliance",
}
MAX_TRANSCRIPT_CHARS = 60000
MAX_ITEMS = 60


def _now():
    return datetime.now(timezone.utc).isoformat()


def _lang(org: Optional[dict]) -> str:
    loc = ((org or {}).get("locale") or "es-MX").lower()
    return "Spanish" if loc.startswith("es") else "English"


def _http(e: LLMError):
    code = {"not_configured": 503, "refusal": 422, "truncated": 422, "invalid_json": 502, "provider": 502}.get(e.kind, 502)
    return HTTPException(status_code=code, detail=f"AI {e.kind}: {e}")


def envelope(kind: str, content, *, model: Optional[str], prompt_version: str, assumptions: str, **extra) -> dict:
    return {"label": "AI_DRAFT", "kind": kind, "content": content, "assumptions": assumptions,
            "generated_at": _now(), "accepted": False, "model": model, "prompt_version": prompt_version, **extra}


@ai_router.get("/status")
async def ai_status(user: dict = Depends(get_current_user)):
    return llm_status()


# ---- free-text suggestions (drawer) -----------------------------------------------------------
class SuggestIn(BaseModel):
    organization_id: str
    kind: str  # opportunity | agent_spec | workflow | prerequisites | executive_update | blockers
    context: str = ""


PROMPTS = {
    "opportunity": "Suggest ONE concrete AI/automation opportunity. Return: business problem, intended outcome, proposed workflow change, candidate phase (1/2/3), key risk.",
    "agent_spec": "Draft a bounded agent specification: role-based name, purpose, trigger, inputs, outputs, allowed actions, prohibited actions, approval requirements. Avoid vague labels.",
    "workflow": "Draft an ordered human/agent/system workflow (steps with actor, input, action, output, handoff, approval).",
    "prerequisites": "List likely missing prerequisites (knowledge sources, integrations, ownership, evaluation) for this change.",
    "executive_update": "Write a concise executive update summarizing transformation status, blockers and next steps.",
    "blockers": "Summarize the key blockers and dependencies for this company's transformation.",
}


@ai_router.post("/suggest")
async def suggest(body: SuggestIn, user: dict = Depends(get_current_user)):
    await require_read(user, body.organization_id)
    llm = get_llm()
    if not llm.enabled:
        raise HTTPException(status_code=503, detail="No AI provider configured")
    if body.kind not in PROMPTS:
        raise HTTPException(status_code=400, detail="Unknown suggestion kind")
    org = clean(await db.organizations.find_one({"id": body.organization_id}))
    system = ("You are an enterprise transformation assistant for the BOTS platform. "
              "Use ONLY the supplied context. State assumptions explicitly. "
              f"Answer in {_lang(org)}. This is a DRAFT requiring human review; never claim deployment or certainty.")
    user_msg = (f"Company: {org['name'] if org else 'Unknown'}\n"
                f"Context from authorized records:\n{body.context[:6000]}\n\nTask: {PROMPTS[body.kind]}")
    try:
        text = await llm.complete_text(system=system, user=user_msg, max_tokens=1200)
    except LLMError as e:
        raise _http(e)
    return envelope(body.kind, text, model=llm.model, prompt_version="suggest-v2",
                    assumptions="Generated from authorized context only. Requires human acceptance.")


# ---- transcript -> intake items (nothing saved; the client imports the chosen rows) --------------
class ExtractIn(BaseModel):
    organization_id: str
    text: str
    raised_by: Optional[str] = None
    raised_by_role: Optional[str] = None


_S = {"type": "string"}
INTAKE_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "name": _S,
        "intake_kind": {"type": "string", "enum": ["initiative", "pain_point", "slow_task"]},
        "area": {"type": "string", "enum": AREA_KEYS + [""]},
        "raised_by": _S, "raised_by_role": _S,
        "business_problem": _S, "intended_outcome": _S, "current_process": _S,
        "frequency": {"type": "string", "enum": ["daily", "weekly", "monthly", "quarterly", "ad_hoc", ""]},
        "time_per_occurrence_hours": {"type": "number"},
        "people_involved": {"type": "integer"},
        "systems_involved": {"type": "array", "items": _S},
        "urgency": {"type": "string", "enum": ["low", "medium", "high", ""]},
        "impact": {"type": "string", "enum": ["low", "medium", "high", ""]},
        "evidence_quote": _S,
        "duplicate_of": _S,  # exact name of an existing record or an earlier row it restates; "" when none
    },
    "required": ["name", "intake_kind", "area", "raised_by", "raised_by_role", "business_problem", "intended_outcome",
                 "current_process", "frequency", "time_per_occurrence_hours", "people_involved", "systems_involved",
                 "urgency", "impact", "evidence_quote", "duplicate_of"],
    "additionalProperties": False,
}
INTAKE_SCHEMA = {"type": "object", "title": "IntakeExtract",
                 "properties": {"items": {"type": "array", "items": INTAKE_ITEM_SCHEMA}},
                 "required": ["items"], "additionalProperties": False}

INTAKE_PROMPT_VERSION = "intake-v2"  # v2: duplicate_of against the org's existing intake records
MAX_EXISTING_NAMES = 200
EXTRACT_MAX_TOKENS = 16384  # a long leadership transcript (60 rows with quotes) must finish in one answer


def _intake_system(lang: str) -> str:
    return (
        "You help a consultant capture what a company's leadership team wants to change. From the conversation text, "
        "extract every distinct INITIATIVE (something they want to start or achieve), PAIN POINT (something that hurts today) "
        "and SLOW TASK (recurring work that takes too long).\n"
        "Rules:\n"
        "- One row per distinct item; merge repeats of the same item.\n"
        "- Never invent facts. Leave a field empty (\"\" or 0) when the text does not say.\n"
        "- evidence_quote is a verbatim sentence from the text that supports the row.\n"
        "- area is one of the listed keys, or empty when unclear.\n"
        "- systems_involved only uses names from the inventory list given; otherwise leave it empty.\n"
        "- duplicate_of: when the item restates an existing record or an earlier row in this transcript, put that record's "
        "exact name (or the earlier row's name); otherwise empty.\n"
        "- Numbers (hours per occurrence, people involved) only when stated or clearly implied.\n"
        f"- name is short (max 80 characters) and written in {lang}; business_problem summarises the item in {lang}.\n"
        f"- At most {MAX_ITEMS} rows. This is a draft a human will review."
    )


@ai_router.post("/extract-intake")
async def extract_intake(body: ExtractIn, user: dict = Depends(get_current_user)):
    await require_write(user, body.organization_id)
    text = (body.text or "").strip()
    if len(text) < 40:
        raise HTTPException(status_code=400, detail="Paste at least a few sentences")
    if len(text) > MAX_TRANSCRIPT_CHARS:
        raise HTTPException(status_code=400, detail=f"Transcript over {MAX_TRANSCRIPT_CHARS} characters; split it")
    llm = get_llm()
    if not llm.enabled:
        raise HTTPException(status_code=503, detail="No AI provider configured")
    org = clean(await db.organizations.find_one({"id": body.organization_id}))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    systems = [clean(s) for s in await db.entities.find(
        {"organization_id": body.organization_id, "etype": "system", "archived": False}, {"data.name": 1}).to_list(500)]
    known = sorted({(s.get("data") or {}).get("name", "") for s in systems} - {""})
    existing = await _existing_intake_names(body.organization_id)
    lang = _lang(org)
    user_msg = (f"Company: {org['name']}\n"
                f"Known systems (inventory): {', '.join(known) if known else '(none recorded yet)'}\n"
                f"Existing intake records (name only): {', '.join(existing) if existing else '(none recorded yet)'}\n"
                f"Areas: {'; '.join(f'{k} = {AREA_LABELS.get(k, k)}' for k in AREA_KEYS)}\n"
                f"Default raised_by: {body.raised_by or '(unknown)'} · role: {body.raised_by_role or '(unknown)'}\n\n"
                f"Transcript:\n<<<\n{text}\n>>>")
    try:
        out = await llm.complete_json(system=_intake_system(lang), user=user_msg, schema=INTAKE_SCHEMA, max_tokens=EXTRACT_MAX_TOKENS)
    except LLMError as e:
        raise _http(e)
    items = _clean_items(out.get("items") or [], known, body.raised_by, body.raised_by_role, existing)
    return envelope("intake_extract", {"items": items}, model=llm.model, prompt_version=INTAKE_PROMPT_VERSION,
                    assumptions=f"Drafted from the pasted text only ({len(text):,} characters). Every row needs a human decision before it becomes a record.",
                    counts={"items": len(items), "chars": len(text)})


async def _existing_intake_names(org_id: str) -> List[str]:
    """Names of the org's live intake records (alphabetical, capped) so the model can flag rows that restate one."""
    docs = await db.entities.find(
        {"organization_id": org_id, "etype": "initiative", "archived": False, "data.intake_kind": {"$exists": True, "$ne": ""}},
        {"data.name": 1}).sort("data.name", 1).to_list(MAX_EXISTING_NAMES)
    return sorted({str((d.get("data") or {}).get("name") or "").strip() for d in docs} - {""})


def _clean_items(raw: list, known: List[str], raised_by: Optional[str], raised_by_role: Optional[str],
                 existing: Optional[List[str]] = None) -> list:
    known_map = {k.lower(): k for k in known}
    # duplicate_of may only point at an existing record or at an earlier kept row (added as rows are kept)
    dup_map = {n.lower(): n for n in (existing or [])}
    out = []
    for it in raw[:MAX_ITEMS]:
        if not isinstance(it, dict):
            continue
        name = str(it.get("name") or "").strip()[:80]
        if not name:
            continue
        row = {"name": name, "intake_kind": it.get("intake_kind") if it.get("intake_kind") in ("initiative", "pain_point", "slow_task") else "initiative"}
        for k in ("area", "raised_by", "raised_by_role", "business_problem", "intended_outcome", "current_process",
                  "frequency", "urgency", "impact", "evidence_quote"):
            v = str(it.get(k) or "").strip()
            if v:
                row[k] = v
        for k in ("time_per_occurrence_hours", "people_involved"):
            v = it.get(k)
            if isinstance(v, (int, float)) and v > 0:
                row[k] = v
        sys_names = [known_map[s.strip().lower()] for s in (it.get("systems_involved") or []) if isinstance(s, str) and s.strip().lower() in known_map]
        if sys_names:
            row["systems_involved"] = sorted(set(sys_names))
        if raised_by and not row.get("raised_by"):
            row["raised_by"] = raised_by
        if raised_by_role and not row.get("raised_by_role"):
            row["raised_by_role"] = raised_by_role
        target = dup_map.get(str(it.get("duplicate_of") or "").strip().lower())
        if target:
            row["duplicate_of"] = target
        out.append(row)
        dup_map.setdefault(name.lower(), name)
    return out
