"""fields.validate_data, slug and import_key."""
import pytest

from fields import FIELD_ENUMS, NUMERIC_KEYS, PROTECTED_KEYS, import_key, slug, validate_data


class TestValidateData:
    def test_valid_record_has_no_problems(self):
        data = {"name": "SAP", "kind": "saas", "criticality": "high", "seats": 12, "api_available": "yes"}
        assert validate_data("system", data) == []

    def test_enum_value_outside_the_list_is_rejected(self):
        problems = validate_data("system", {"kind": "mainframe"})
        assert len(problems) == 1
        assert problems[0].startswith("kind:") and "mainframe" in problems[0]
        assert "saas" in problems[0]  # the message names the allowed values

    @pytest.mark.parametrize("value", [None, ""])
    def test_clearing_an_enum_field_is_allowed(self, value):
        assert validate_data("initiative", {"urgency": value}) == []

    @pytest.mark.parametrize("value", [["high"], 3, {"v": "high"}])
    def test_non_string_enum_value_is_rejected(self, value):
        problems = validate_data("initiative", {"urgency": value})
        assert len(problems) == 1 and problems[0].startswith("urgency:")

    def test_every_etype_enum_accepts_its_own_values(self):
        # allow_protected because feasibility_class is both enumerated and server-only
        for etype, enums in FIELD_ENUMS.items():
            for key, allowed in enums.items():
                for value in allowed:
                    assert validate_data(etype, {key: value}, allow_protected=True) == [], (etype, key, value)

    def test_enum_check_is_per_etype(self):
        # "kind" is enumerated for systems only; a role's kind is free text, and unknown etypes have no enums
        assert validate_data("role", {"kind": "mainframe"}) == []
        assert validate_data("not-an-etype", {"kind": "mainframe"}) == []

    @pytest.mark.parametrize("value", ["ten", "12,5", [], {}])
    def test_numeric_key_rejects_non_numbers(self, value):
        problems = validate_data("initiative", {"seats": value})
        assert len(problems) == 1
        assert problems[0].startswith("seats:") and "not a number" in problems[0]

    @pytest.mark.parametrize("value", [12, 12.5, "12", "12.5", "-3", None, ""])
    def test_numeric_key_accepts_numbers_numeric_strings_and_blank(self, value):
        assert validate_data("system", {"cost_estimate": value}) == []

    def test_every_numeric_key_is_checked_for_every_etype(self):
        for key in NUMERIC_KEYS:
            assert validate_data("playbook", {key: "n/a"}) == [f"{key}: 'n/a' is not a number"]

    def test_protected_keys_are_rejected_on_plain_writes(self):
        for key in PROTECTED_KEYS:
            assert validate_data("initiative", {key: "build"}) == [f"{key}: set by the server only"], key

    def test_allow_protected_lets_the_server_write_them(self):
        data = {key: "build" for key in PROTECTED_KEYS}
        assert validate_data("initiative", data, allow_protected=True) == []

    def test_allow_protected_still_validates_the_enum(self):
        problems = validate_data("initiative", {"feasibility_class": "magic"}, allow_protected=True)
        assert len(problems) == 1 and problems[0].startswith("feasibility_class:")

    def test_legacy_and_unknown_keys_are_untouched(self):
        data = {"phase": "whatever", "owner": 42, "notes": ["free", "form"], "stage": "x", "status": None}
        assert validate_data("initiative", data) == []

    def test_problems_accumulate_across_keys(self):
        problems = validate_data("system", {"kind": "zzz", "seats": "many", "feasibility": {}})
        assert len(problems) == 3
        assert {p.split(":")[0] for p in problems} == {"kind", "seats", "feasibility"}

    @pytest.mark.parametrize("payload", [["not", "a", "dict"], "text", None, 7])
    def test_non_dict_payload(self, payload):
        assert validate_data("system", payload) == ["data must be an object"]


class TestSlug:
    @pytest.mark.parametrize("raw, expected", [
        ("SAP S/4HANA", "sap-s-4hana"),
        ("Señor Café ÑAndú", "senor-cafe-nandu"),
        ("  --Hello,  World!--  ", "hello-world"),
        ("Ya tenemos CRM (HubSpot)", "ya-tenemos-crm-hubspot"),
        ("plain", "plain"),
        (123, "123"),
    ])
    def test_slug(self, raw, expected):
        assert slug(raw) == expected

    @pytest.mark.parametrize("raw", ["", None, "   ", "!!!", "日本語"])
    def test_empty_or_unrepresentable_becomes_untitled(self, raw):
        assert slug(raw) == "untitled"

    def test_import_key_is_etype_colon_slug(self):
        assert import_key("system", "SAP S/4HANA") == "system:sap-s-4hana"
        assert import_key("initiative", "Cierre Mensual") == "initiative:cierre-mensual"

    def test_import_key_ignores_case_and_spacing(self):
        assert import_key("system", "sap  s/4hana") == import_key("system", "SAP S/4HANA")
