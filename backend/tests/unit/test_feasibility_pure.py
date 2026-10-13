"""routes_feasibility pure helpers: _normalise, _inventory_lines, _item_block, and the FEAS_SCHEMA shape."""
import pytest

from providers.llm import LLMError
from routes_feasibility import CLASSES, FEAS_SCHEMA, _inventory_lines, _item_block, _normalise
from schema_tools import assert_closed_object_schema

KNOWN = ["SAP S/4HANA", "Excel", "HubSpot"]


def _out(**over):
    base = {"classification": "configure", "confidence": "high", "rationale": "r", "systems_used": ["excel"],
            "what_to_do": "w", "prerequisites": [], "risks": [], "estimated_effort": "S", "quick_win": True,
            "suggested_phase": 2, "open_questions": []}
    base.update(over)
    return base


class TestNormalise:
    def test_valid_answer_round_trips_with_canonical_system_names(self):
        assert _normalise(_out(), KNOWN) == {
            "classification": "configure", "confidence": "high", "rationale": "r", "systems_used": ["Excel"],
            "what_to_do": "w", "prerequisites": [], "risks": [], "estimated_effort": "S", "quick_win": True,
            "suggested_phase": 2, "open_questions": []}

    @pytest.mark.parametrize("bad", [None, "configure", [], {}, _out(classification="magic"),
                                     _out(classification=None), _out(classification="Build")])
    def test_missing_or_unknown_class_is_rejected(self, bad):
        with pytest.raises(LLMError) as ei:
            _normalise(bad, KNOWN)
        assert ei.value.kind == "invalid_json"

    @pytest.mark.parametrize("cls", CLASSES)
    def test_every_class_is_accepted(self, cls):
        assert _normalise(_out(classification=cls), KNOWN)["classification"] == cls

    def test_systems_filtered_to_inventory_case_insensitively(self):
        raw = ["sap s/4hana", " EXCEL ", "Excel", "Salesforce", 42, None, ""]
        res = _normalise(_out(systems_used=raw), KNOWN)
        assert res["systems_used"] == ["Excel", "SAP S/4HANA"]  # canonical names, deduped, sorted

    @pytest.mark.parametrize("raw", [None, []])
    def test_no_systems_gives_an_empty_list(self, raw):
        assert _normalise(_out(systems_used=raw), KNOWN)["systems_used"] == []

    def test_empty_inventory_keeps_no_system(self):
        assert _normalise(_out(systems_used=["Excel"]), [])["systems_used"] == []

    @pytest.mark.parametrize("raw, expected", [(1, 1), (2, 2), (3, 3), (0, 1), (4, 1), (-1, 1), (2.9, 2), (3.0, 3),
                                               ("2", 1), (None, 1)])
    def test_phase_clamped_to_1_3_with_1_as_fallback(self, raw, expected):
        assert _normalise(_out(suggested_phase=raw), KNOWN)["suggested_phase"] == expected

    @pytest.mark.parametrize("raw, expected", [("low", "low"), ("medium", "medium"), ("high", "high"),
                                               ("HIGH", "low"), ("", "low"), (None, "low"), (3, "low")])
    def test_confidence_defaults_to_low(self, raw, expected):
        assert _normalise(_out(confidence=raw), KNOWN)["confidence"] == expected

    @pytest.mark.parametrize("raw, expected", [("S", "S"), ("M", "M"), ("L", "L"), ("XL", "M"), ("s", "M"), (None, "M")])
    def test_effort_defaults_to_m(self, raw, expected):
        assert _normalise(_out(estimated_effort=raw, quick_win=False), KNOWN)["estimated_effort"] == expected

    @pytest.mark.parametrize("effort, prereqs, claimed, expected", [
        ("S", [], True, True),
        ("S", [], "yes", True),
        ("S", [], False, False),
        ("S", [], None, False),
        ("M", [], True, False),
        ("L", [], True, False),
        ("S", ["needs the API key"], True, False),
        ("XL", [], True, False),       # defaulted to M, so not a quick win
        ("S", ["", "  "], True, True),  # blank prerequisites are stripped first, so they do not block
    ])
    def test_quick_win_requires_s_and_no_prerequisites(self, effort, prereqs, claimed, expected):
        res = _normalise(_out(estimated_effort=effort, prerequisites=prereqs, quick_win=claimed), KNOWN)
        assert res["quick_win"] is expected

    @pytest.mark.parametrize("key", ["prerequisites", "risks", "open_questions"])
    def test_lists_capped_at_12_blanks_dropped_items_truncated(self, key):
        raw = ["", "  ", "x" * 500, 17] + [f"item {i}" for i in range(20)]
        res = _normalise(_out(quick_win=False, **{key: raw}), KNOWN)[key]
        assert len(res) == 12
        assert res[0] == "x" * 300 and res[1] == "17" and res[2] == "item 0" and res[-1] == "item 9"

    def test_lists_missing_become_empty(self):
        res = _normalise(_out(prerequisites=None, risks=None, open_questions=None), KNOWN)
        assert res["prerequisites"] == res["risks"] == res["open_questions"] == []

    def test_free_text_truncated_to_2000_and_none_becomes_empty(self):
        res = _normalise(_out(rationale="r" * 3000, what_to_do=None), KNOWN)
        assert len(res["rationale"]) == 2000 and res["what_to_do"] == ""

    def test_result_has_exactly_the_schema_keys(self):
        res = _normalise(_out(extra="dropped", cost_band="under_50k"), KNOWN)
        assert set(res) == set(FEAS_SCHEMA["properties"])


class TestInventoryLines:
    def test_empty_inventory_placeholder(self):
        assert _inventory_lines([]) == "(no systems recorded yet)"

    def test_full_line_with_notes_capped_at_140(self):
        s = {"data": {"name": "SAP S/4HANA", "kind": "saas", "vendor": "SAP", "area": "finance", "api_available": "yes",
                      "api_type": "rest", "mcp_available": "no", "verified_integration": True,
                      "integration_notes": "n" * 200}}
        line = _inventory_lines([s])
        assert line.startswith("- SAP S/4HANA · saas · SAP · area=finance · api=yes/rest · mcp=no · verified · notes: ")
        assert line.endswith("n" * 140) and "n" * 141 not in line

    def test_sparse_line_has_no_empty_fragments(self):
        assert _inventory_lines([{"data": {"name": "Excel"}}]) == "- Excel · area=- · api=unknown · mcp=unknown"

    def test_missing_name_and_missing_data(self):
        assert _inventory_lines([{}]) == "- ? · area=- · api=unknown · mcp=unknown"

    def test_one_line_per_system_in_the_given_order(self):
        lines = _inventory_lines([{"data": {"name": "B"}}, {"data": {"name": "A"}}]).splitlines()
        assert [ln.split(" · ")[0] for ln in lines] == ["- B", "- A"]


class TestItemBlock:
    def test_rows_in_order_with_empties_skipped(self):
        e = {"data": {"name": "Cierre mensual", "intake_kind": "slow_task", "area": "", "raised_by": "Ana",
                      "raised_by_role": "CFO", "business_problem": "Tarda", "intended_outcome": None,
                      "current_process": "", "frequency": "monthly", "time_per_occurrence_hours": 5,
                      "people_involved": 0, "systems_involved": ["Excel", "ERP"], "urgency": "high", "impact": "",
                      "evidence_quote": "cita"}}
        assert _item_block(e) == ("Name: Cierre mensual\nKind: slow_task\nRaised by: Ana (CFO)\nBusiness problem: Tarda\n"
                                  "Frequency: monthly\nHours per occurrence: 5\nSystems involved: Excel, ERP\n"
                                  "Urgency: high\nEvidence: cita")

    def test_raised_by_without_role_has_no_trailing_space(self):
        assert "Raised by: Ana\n" in _item_block({"data": {"name": "x", "raised_by": "Ana", "business_problem": "y"}})

    def test_role_without_name(self):
        assert "Raised by: (CFO)" in _item_block({"data": {"name": "x", "raised_by_role": "CFO"}})

    def test_systems_involved_as_free_text_passes_through(self):
        assert "Systems involved: Excel y ERP" in _item_block({"data": {"name": "x", "systems_involved": "Excel y ERP"}})

    def test_zero_hours_skipped_but_fractional_kept(self):
        assert "Hours" not in _item_block({"data": {"time_per_occurrence_hours": 0}})
        assert "Hours per occurrence: 0.5" in _item_block({"data": {"time_per_occurrence_hours": 0.5}})

    def test_no_data_is_an_empty_block(self):
        assert _item_block({}) == ""


class TestFeasSchema:
    def test_every_object_is_closed_and_required_matches_properties(self):
        assert_closed_object_schema(FEAS_SCHEMA)

    def test_title_and_class_enum(self):
        assert FEAS_SCHEMA["title"] == "FeasibilityOut"
        assert FEAS_SCHEMA["properties"]["classification"]["enum"] == CLASSES
