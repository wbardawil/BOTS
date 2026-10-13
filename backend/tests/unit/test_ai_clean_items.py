"""ai._clean_items and the INTAKE schema invariants."""
import pytest

from ai import INTAKE_ITEM_SCHEMA, INTAKE_SCHEMA, MAX_ITEMS, _clean_items
from fields import FIELD_ENUMS, validate_data
from schema_tools import assert_closed_object_schema

KNOWN = ["Excel", "SAP S/4HANA"]


def _raw(**over):
    base = {"name": "Cierre mensual", "intake_kind": "slow_task", "area": "finance", "raised_by": "", "raised_by_role": "",
            "business_problem": "Tarda", "intended_outcome": "", "current_process": "", "frequency": "monthly",
            "time_per_occurrence_hours": 5, "people_involved": 3, "systems_involved": ["excel"], "urgency": "high",
            "impact": "", "evidence_quote": "cita"}
    base.update(over)
    return base


class TestCleanItems:
    def test_full_row(self):
        assert _clean_items([_raw()], KNOWN, "Ana", "CFO") == [{
            "name": "Cierre mensual", "intake_kind": "slow_task", "area": "finance", "business_problem": "Tarda",
            "frequency": "monthly", "urgency": "high", "evidence_quote": "cita", "time_per_occurrence_hours": 5,
            "people_involved": 3, "systems_involved": ["Excel"], "raised_by": "Ana", "raised_by_role": "CFO"}]

    @pytest.mark.parametrize("kind", [None, "", "bug", 3])
    def test_intake_kind_defaults_to_initiative(self, kind):
        assert _clean_items([_raw(intake_kind=kind)], KNOWN, None, None)[0]["intake_kind"] == "initiative"

    def test_empties_are_stripped_not_stored(self):
        row = _clean_items([_raw(area="", urgency="  ", impact=None, business_problem="  x  ")], KNOWN, None, None)[0]
        assert "area" not in row and "urgency" not in row and "impact" not in row
        assert row["business_problem"] == "x"

    @pytest.mark.parametrize("value", [0, -1, "3", None, 0.0])
    def test_non_positive_or_non_numeric_numbers_are_dropped(self, value):
        row = _clean_items([_raw(time_per_occurrence_hours=value, people_involved=value)], KNOWN, None, None)[0]
        assert "time_per_occurrence_hours" not in row and "people_involved" not in row

    def test_fractional_hours_kept(self):
        assert _clean_items([_raw(time_per_occurrence_hours=0.5)], KNOWN, None, None)[0]["time_per_occurrence_hours"] == 0.5

    def test_systems_filtered_to_inventory_case_insensitively(self):
        raw = ["EXCEL", "sap s/4hana", "Excel", "Salesforce", 5, ""]
        row = _clean_items([_raw(systems_involved=raw)], KNOWN, None, None)[0]
        assert row["systems_involved"] == ["Excel", "SAP S/4HANA"]

    @pytest.mark.parametrize("value", [[], ["Salesforce"], None])
    def test_no_known_system_means_no_key(self, value):
        assert "systems_involved" not in _clean_items([_raw(systems_involved=value)], KNOWN, None, None)[0]

    def test_raised_by_default_only_fills_blanks(self):
        rows = _clean_items([_raw(raised_by="Luis", raised_by_role=""), _raw(raised_by="", raised_by_role="COO")],
                            KNOWN, "Ana", "CFO")
        assert (rows[0]["raised_by"], rows[0]["raised_by_role"]) == ("Luis", "CFO")
        assert (rows[1]["raised_by"], rows[1]["raised_by_role"]) == ("Ana", "COO")

    def test_no_default_leaves_the_keys_out(self):
        row = _clean_items([_raw()], KNOWN, None, None)[0]
        assert "raised_by" not in row and "raised_by_role" not in row

    @pytest.mark.parametrize("name", ["", "   ", None])
    def test_rows_without_a_name_are_dropped(self, name):
        assert _clean_items([_raw(name=name)], KNOWN, None, None) == []

    def test_non_dict_rows_are_dropped(self):
        rows = _clean_items(["x", None, 3, _raw()], KNOWN, None, None)
        assert [r["name"] for r in rows] == ["Cierre mensual"]

    def test_name_trimmed_and_capped_at_80(self):
        row = _clean_items([_raw(name="  " + "n" * 100)], KNOWN, None, None)[0]
        assert row["name"] == "n" * 80

    def test_capped_at_max_items(self):
        rows = _clean_items([_raw(name=f"item {i}") for i in range(MAX_ITEMS + 15)], KNOWN, None, None)
        assert len(rows) == MAX_ITEMS == 60

    def test_cleaned_rows_pass_the_field_rules(self):
        rows = _clean_items([_raw(), _raw(intake_kind="zzz", area="finance", frequency="daily")], KNOWN, "Ana", "CFO")
        for row in rows:
            assert validate_data("initiative", row) == []


class TestIntakeSchema:
    def test_every_object_is_closed_and_required_matches_properties(self):
        assert_closed_object_schema(INTAKE_SCHEMA)

    def test_title_and_items(self):
        assert INTAKE_SCHEMA["title"] == "IntakeExtract"
        assert INTAKE_SCHEMA["properties"]["items"]["items"] is INTAKE_ITEM_SCHEMA

    def test_enums_match_the_field_rules_plus_blank(self):
        props, ini = INTAKE_ITEM_SCHEMA["properties"], FIELD_ENUMS["initiative"]
        assert props["intake_kind"]["enum"] == ini["intake_kind"]
        assert props["area"]["enum"] == ini["area"] + [""]
        assert props["frequency"]["enum"] == ini["frequency"] + [""]
        assert props["urgency"]["enum"] == ini["urgency"] + [""]
        assert props["impact"]["enum"] == ini["impact"] + [""]
