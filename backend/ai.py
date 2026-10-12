"""Optional AI assistance. Produces LABELED drafts only. Never auto-publishes."""
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from auth import get_current_user
from access import require_read
from db import db, clean

ai_router = APIRouter(prefix="/api/ai")


def _provider_ready():
    return bool(os.environ.get("EMERGENT_LLM_KEY"))


@ai_router.get("/status")
async def ai_status(user: dict = Depends(get_current_user)):
    return {"enabled": _provider_ready(), "provider": "emergent-universal" if _provider_ready() else None}


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
    if not _provider_ready():
        raise HTTPException(status_code=503, detail="No AI provider configured")
    if body.kind not in PROMPTS:
        raise HTTPException(status_code=400, detail="Unknown suggestion kind")
    org = clean(await db.organizations.find_one({"id": body.organization_id}))
    system = ("You are an enterprise transformation assistant for the BOTS platform. "
              "Use ONLY the supplied context. State assumptions explicitly. "
              "This is a DRAFT requiring human review; never claim deployment or certainty.")
    user_msg = (f"Company: {org['name'] if org else 'Unknown'}\n"
                f"Context from authorized records:\n{body.context}\n\nTask: {PROMPTS[body.kind]}")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"],
                       session_id=f"ai-{body.organization_id}-{body.kind}",
                       system_message=system).with_model("openai", "gpt-4o-mini")
        text = await chat.send_message(UserMessage(text=user_msg))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")
    draft = {
        "label": "AI_DRAFT",
        "kind": body.kind,
        "content": text,
        "assumptions": "Generated from authorized context only. Requires human acceptance.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "accepted": False,
    }
    return draft
