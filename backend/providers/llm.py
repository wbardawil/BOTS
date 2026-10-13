"""LLM provider behind one small interface.

The rest of the backend only calls `complete_json` (schema-constrained) and `complete_text`.
Swapping providers is a one-file change here. Selection (env):
  BOTS_LLM_PROVIDER = anthropic | fake | none   (default: anthropic when ANTHROPIC_API_KEY is set, else none)
  ANTHROPIC_API_KEY                               (the owner's own key; never logged)
  BOTS_LLM_MODEL    = model id                    (default: claude-opus-5-5)
  BOTS_LLM_CONCURRENCY = max parallel calls       (default: 3)
The SDK is imported lazily so the server starts without it when the provider is fake or none.
"""
import asyncio
import inspect
import json
import os
import re
from typing import Optional

DEFAULT_MODEL = "claude-opus-5-5"


class LLMError(Exception):
    """kind: not_configured | refusal | truncated | invalid_json | provider"""

    def __init__(self, kind: str, message: str):
        self.kind = kind
        super().__init__(message)


def parse_json_object(text: str) -> dict:
    """Tolerant JSON extraction: strips code fences and leading/trailing prose."""
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.S)
    try:
        v = json.loads(t)
    except json.JSONDecodeError:
        a, b = t.find("{"), t.rfind("}")
        if a < 0 or b <= a:
            raise LLMError("invalid_json", "The model did not return a JSON object")
        try:
            v = json.loads(t[a:b + 1])
        except json.JSONDecodeError as e:
            raise LLMError("invalid_json", f"Invalid JSON from the model: {e.msg}")
    if not isinstance(v, dict):
        raise LLMError("invalid_json", "The model returned JSON that is not an object")
    return v


class BaseLLM:
    name = "none"
    model: Optional[str] = None
    enabled = False

    async def complete_json(self, *, system: str, user: str, schema: dict, max_tokens: int = 4096) -> dict:
        raise LLMError("not_configured", "No AI provider configured")

    async def complete_text(self, *, system: str, user: str, max_tokens: int = 1024) -> str:
        raise LLMError("not_configured", "No AI provider configured")


class AnthropicLLM(BaseLLM):
    name = "anthropic"
    enabled = True

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL, max_concurrency: int = 3):
        from anthropic import AsyncAnthropic  # lazy: optional dependency
        # 600 s: a 16k-token extraction over a long transcript must finish in one call rather than turn into a 502
        self._client = AsyncAnthropic(api_key=api_key, max_retries=2, timeout=600.0)
        self.model = model
        self._sem = asyncio.Semaphore(max(1, max_concurrency))
        self._structured = "output_config" in inspect.signature(self._client.messages.create).parameters

    async def _create(self, **kw):
        async with self._sem:
            try:
                return await self._client.messages.create(**kw)
            except Exception as e:  # SDK errors carry status and message; never the key
                raise LLMError("provider", f"{type(e).__name__}: {str(e)[:300]}")

    @staticmethod
    def _text(resp) -> str:
        return "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text")

    @staticmethod
    def _check_stop(resp):
        sr = getattr(resp, "stop_reason", None)
        if sr == "refusal":
            raise LLMError("refusal", "The model declined this request")
        if sr in ("max_tokens", "model_context_window_exceeded"):
            raise LLMError("truncated", "The answer was cut off; shorten the input or split it")

    async def complete_json(self, *, system: str, user: str, schema: dict, max_tokens: int = 4096) -> dict:
        kw = dict(model=self.model, max_tokens=max_tokens, system=system,
                  messages=[{"role": "user", "content": user}])
        if self._structured:
            resp = await self._create(**kw, output_config={"format": {"type": "json_schema", "schema": schema}})
        else:  # older SDK: ask for JSON in the prompt and parse
            kw["messages"] = [{"role": "user", "content": f"{user}\n\nRespond with ONLY a JSON object that matches this JSON schema:\n{json.dumps(schema)}"}]
            resp = await self._create(**kw)
        self._check_stop(resp)
        return parse_json_object(self._text(resp))

    async def complete_text(self, *, system: str, user: str, max_tokens: int = 1024) -> str:
        resp = await self._create(model=self.model, max_tokens=max_tokens, system=system,
                                  messages=[{"role": "user", "content": user}])
        self._check_stop(resp)
        return self._text(resp)


class FakeLLM(BaseLLM):
    """Deterministic stand-in for tests and demo instances. Builds plausible output from the input only."""
    name = "fake"
    model = "fake-1"
    enabled = True

    _SLOW = re.compile(r"\b(tarda|lento|lenta|horas|hours|slow|takes|days|días|semana|week|manual)\b", re.I)
    _PAIN = re.compile(r"\b(problema|problem|error|errores|duele|pain|frustra|retraso|delay|queja|complain)\b", re.I)

    async def complete_json(self, *, system: str, user: str, schema: dict, max_tokens: int = 4096) -> dict:
        title = schema.get("title", "")
        if title == "IntakeExtract":
            return {"items": self._intake_items(user)}
        if title == "FeasibilityOut":
            return self._feasibility(user)
        return {}

    async def complete_text(self, *, system: str, user: str, max_tokens: int = 1024) -> str:
        task = user.rsplit("Task:", 1)[-1].strip()[:160]
        return f"[fake provider] Draft for: {task}\n- Assumption: based only on the supplied context.\n- Next step: review with the owner."

    @staticmethod
    def _existing_names(user: str) -> dict:
        """The 'Existing intake records (name only): a, b' line of the prompt header -> {lower: exact}."""
        head = user.split("<<<", 1)[0]
        m = re.search(r"^Existing intake records \(name only\): (.*)$", head, re.M)
        if not m or m.group(1).strip().startswith("("):
            return {}
        return {n.strip().lower(): n.strip() for n in m.group(1).split(", ") if n.strip()}

    def _intake_items(self, user: str) -> list:
        body = user.split("<<<", 1)[-1].split(">>>", 1)[0] if "<<<" in user else user
        existing = self._existing_names(user)
        # one item per paragraph or speaker turn ("CEO: ..."), never per sentence
        chunks = [c.strip() for c in re.split(r"\n\s*\n|\n(?=[A-ZÁÉÍÓÚÑ][\w .]{0,30}:)|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ][\w .]{0,30}:)", body) if len(c.strip()) >= 40]
        items = []
        for c in chunks[:60]:
            kind = "slow_task" if self._SLOW.search(c) else "pain_point" if self._PAIN.search(c) else "initiative"
            hours = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:h\b|horas|hours)", c, re.I)
            people = re.search(r"(\d+)\s*(?:personas|people|persons)", c, re.I)
            freq = "monthly" if re.search(r"\b(mes|mensual|month)", c, re.I) else "weekly" if re.search(r"\b(semana|weekly|week)", c, re.I) else "daily" if re.search(r"\b(diario|daily|every day|cada día)", c, re.I) else ""
            name = re.sub(r"^[A-Za-zÁÉÍÓÚÑ ]{2,20}:\s*", "", c).split(".")[0][:80]
            items.append({"name": name, "intake_kind": kind, "area": "", "raised_by": "", "raised_by_role": "",
                          "duplicate_of": existing.get(name.strip().lower(), ""),
                          "business_problem": c[:300], "intended_outcome": "", "current_process": "",
                          "frequency": freq, "time_per_occurrence_hours": float(hours.group(1).replace(",", ".")) if hours else 0,
                          "people_involved": int(people.group(1)) if people else 0, "systems_involved": [],
                          "urgency": "high" if kind != "initiative" else "medium", "impact": "medium", "evidence_quote": c[:200]})
        return items

    def _feasibility(self, user: str) -> dict:
        u = user.lower()
        cls = ("configure" if re.search(r"excel|spreadsheet|hoja|crm|erp|report", u) else
               "current_stack" if re.search(r"already|ya tenemos|existing", u) else
               "not_tech" if re.search(r"policy|política|training|capacitación|hiring", u) else
               "build" if re.search(r"custom|propio|integra", u) else "buy")
        return {"classification": cls, "confidence": "low", "rationale": "[fake provider] keyword heuristic for tests only.",
                "systems_used": [], "what_to_do": "Review with the owner.", "prerequisites": [], "risks": [],
                "estimated_effort": "S", "quick_win": cls in ("current_stack", "configure"), "suggested_phase": 1, "open_questions": []}


_llm: Optional[BaseLLM] = None


def get_llm() -> BaseLLM:
    global _llm
    if _llm is None:
        provider = (os.environ.get("BOTS_LLM_PROVIDER") or ("anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "none")).lower()
        model = os.environ.get("BOTS_LLM_MODEL") or DEFAULT_MODEL
        conc = int(os.environ.get("BOTS_LLM_CONCURRENCY") or 3)
        if provider == "anthropic" and os.environ.get("ANTHROPIC_API_KEY"):
            _llm = AnthropicLLM(os.environ["ANTHROPIC_API_KEY"], model, conc)
        elif provider == "fake":
            _llm = FakeLLM()
        else:
            _llm = BaseLLM()
    return _llm


def llm_status() -> dict:
    llm = get_llm()
    return {"enabled": llm.enabled, "provider": llm.name if llm.enabled else None, "model": llm.model if llm.enabled else None}
