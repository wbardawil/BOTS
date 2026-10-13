"""providers.llm: parse_json_object, the fake provider's output shapes, provider selection from env."""
import asyncio
import json

import pytest

import providers.llm as llm_module
from providers.llm import AnthropicLLM, BaseLLM, FakeLLM, LLMError, get_llm, llm_status, parse_json_object
from ai import INTAKE_SCHEMA
from routes_feasibility import FEAS_SCHEMA
from schema_tools import check_shape

DOC = {"classification": "buy", "n": 1, "nested": {"a": [1, 2]}}


class TestParseJsonObject:
    def test_plain_object(self):
        assert parse_json_object(json.dumps(DOC)) == DOC

    def test_whitespace_around(self):
        assert parse_json_object("  \n" + json.dumps(DOC) + "\n\n") == DOC

    @pytest.mark.parametrize("fence", ["```json", "```"])
    def test_code_fences_are_stripped(self, fence):
        assert parse_json_object(f"{fence}\n{json.dumps(DOC)}\n```") == DOC

    def test_prose_around_the_object_is_ignored(self):
        text = "Sure! Here is the verdict:\n" + json.dumps(DOC) + "\nLet me know if you need more."
        assert parse_json_object(text) == DOC

    def test_nested_braces_inside_prose_wrapper(self):
        inner = {"a": {"b": [1, {"c": "}"}]}}
        assert parse_json_object("prefix " + json.dumps(inner) + " suffix") == inner

    @pytest.mark.parametrize("text", ["", "   ", None, "no json here", "{not: json}", "[1, 2, 3]", "42", "\"str\"",
                                      "```json\n[1]\n```"])
    def test_invalid_raises_invalid_json(self, text):
        with pytest.raises(LLMError) as ei:
            parse_json_object(text)
        assert ei.value.kind == "invalid_json"


# ---- fake provider --------------------------------------------------------------------------------------
TRANSCRIPT = (
    "CEO: Queremos lanzar un portal de autoservicio para clientes este año, con seguimiento de pedidos en línea.\n\n"
    "CFO: El cierre mensual tarda 5 horas cada mes y participan 3 personas copiando datos entre Excel y el ERP.\n\n"
    "COO: Tenemos un problema serio con los retrasos de entrega y las quejas de clientes cada día.\n\n"
    "Corto.\n\n"
)


def _intake_user(text: str) -> str:
    return f"Company: X\nKnown systems (inventory): Excel, ERP\n\nTranscript:\n<<<\n{text}\n>>>"


def _run(coro):
    return asyncio.run(coro)


class TestFakeLLMIntake:
    @pytest.fixture
    def items(self):
        out = _run(FakeLLM().complete_json(system="", user=_intake_user(TRANSCRIPT), schema=INTAKE_SCHEMA))
        check_shape(INTAKE_SCHEMA, out)
        return out["items"]

    def test_one_row_per_speaker_turn_and_short_fragments_dropped(self, items):
        assert len(items) == 3

    def test_kind_numbers_and_frequency_from_keywords(self, items):
        ceo, cfo, coo = items
        assert ceo["intake_kind"] == "initiative" and ceo["urgency"] == "medium" and ceo["frequency"] == ""
        assert cfo["intake_kind"] == "slow_task" and cfo["urgency"] == "high"
        assert cfo["time_per_occurrence_hours"] == 5.0 and cfo["people_involved"] == 3 and cfo["frequency"] == "monthly"
        assert coo["intake_kind"] == "pain_point" and coo["frequency"] == "daily"
        assert ceo["time_per_occurrence_hours"] == 0 and ceo["people_involved"] == 0

    def test_speaker_prefix_stripped_from_name_and_name_capped(self, items):
        assert items[0]["name"].startswith("Queremos lanzar")
        assert all(len(it["name"]) <= 80 for it in items)

    def test_evidence_quote_is_verbatim(self, items):
        assert all(it["evidence_quote"] in TRANSCRIPT for it in items)

    def test_capped_at_sixty_rows(self):
        text = "\n\n".join(f"Tema {i}: necesitamos mejorar el proceso número {i} porque toma mucho tiempo." for i in range(80))
        out = _run(FakeLLM().complete_json(system="", user=_intake_user(text), schema=INTAKE_SCHEMA))
        assert len(out["items"]) == 60

    def test_without_markers_the_whole_message_is_the_transcript(self):
        out = _run(FakeLLM().complete_json(system="", user=TRANSCRIPT, schema=INTAKE_SCHEMA))
        assert len(out["items"]) == 3


class TestFakeLLMFeasibility:
    @pytest.mark.parametrize("text, cls", [
        ("Conciliar la hoja de ventas con el ERP", "configure"),
        ("Already covered by the tool we own", "current_stack"),
        ("Define a vacation policy for the team", "not_tech"),
        ("Build a custom integration with the carrier", "build"),
        ("Sentiment analysis of calls", "buy"),
    ])
    def test_class_from_keywords_with_a_schema_valid_shape(self, text, cls):
        out = _run(FakeLLM().complete_json(system="", user=text, schema=FEAS_SCHEMA))
        check_shape(FEAS_SCHEMA, out)
        assert out["classification"] == cls
        assert out["quick_win"] is (cls in ("current_stack", "configure"))
        assert out["confidence"] == "low" and out["systems_used"] == []

    def test_unknown_schema_title_yields_an_empty_object(self):
        assert _run(FakeLLM().complete_json(system="", user="x", schema={"title": "Other"})) == {}

    def test_complete_text_is_labelled_and_echoes_the_task(self):
        text = _run(FakeLLM().complete_text(system="", user="Context...\n\nTask: Write a memo"))
        assert text.startswith("[fake provider]") and "Write a memo" in text


# ---- provider selection ---------------------------------------------------------------------------------
@pytest.fixture
def fresh_env(monkeypatch):
    """No provider env and a reset module singleton; monkeypatch restores both afterwards."""
    for key in ("BOTS_LLM_PROVIDER", "ANTHROPIC_API_KEY", "BOTS_LLM_MODEL", "BOTS_LLM_CONCURRENCY"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(llm_module, "_llm", None)
    return monkeypatch


class TestGetLLM:
    def test_fake_provider(self, fresh_env):
        fresh_env.setenv("BOTS_LLM_PROVIDER", "fake")
        llm = get_llm()
        assert isinstance(llm, FakeLLM) and llm.enabled
        assert llm_status() == {"enabled": True, "provider": "fake", "model": "fake-1"}

    def test_provider_name_is_case_insensitive(self, fresh_env):
        fresh_env.setenv("BOTS_LLM_PROVIDER", "Fake")
        assert isinstance(get_llm(), FakeLLM)

    def test_none_provider_is_disabled(self, fresh_env):
        fresh_env.setenv("BOTS_LLM_PROVIDER", "none")
        llm = get_llm()
        assert type(llm) is BaseLLM and not llm.enabled
        assert llm_status() == {"enabled": False, "provider": None, "model": None}

    def test_default_without_a_key_is_disabled(self, fresh_env):
        assert type(get_llm()) is BaseLLM

    def test_anthropic_without_a_key_falls_back_to_disabled(self, fresh_env):
        fresh_env.setenv("BOTS_LLM_PROVIDER", "anthropic")
        assert type(get_llm()) is BaseLLM

    def test_a_key_alone_selects_anthropic_with_model_from_env(self, fresh_env):
        fresh_env.setenv("ANTHROPIC_API_KEY", "unit-test-placeholder")
        fresh_env.setenv("BOTS_LLM_MODEL", "model-under-test")
        fresh_env.setenv("BOTS_LLM_CONCURRENCY", "2")
        llm = get_llm()
        assert isinstance(llm, AnthropicLLM) and llm.enabled
        assert llm_status() == {"enabled": True, "provider": "anthropic", "model": "model-under-test"}

    def test_explicit_fake_wins_over_a_key(self, fresh_env):
        fresh_env.setenv("ANTHROPIC_API_KEY", "unit-test-placeholder")
        fresh_env.setenv("BOTS_LLM_PROVIDER", "fake")
        assert isinstance(get_llm(), FakeLLM)

    def test_singleton_is_cached_until_reset(self, fresh_env):
        fresh_env.setenv("BOTS_LLM_PROVIDER", "fake")
        first = get_llm()
        fresh_env.setenv("BOTS_LLM_PROVIDER", "none")
        assert get_llm() is first
        fresh_env.setattr(llm_module, "_llm", None)
        assert type(get_llm()) is BaseLLM

    def test_disabled_provider_refuses_calls(self, fresh_env):
        fresh_env.setenv("BOTS_LLM_PROVIDER", "none")
        with pytest.raises(LLMError) as ei:
            _run(get_llm().complete_json(system="", user="", schema={}))
        assert ei.value.kind == "not_configured"
