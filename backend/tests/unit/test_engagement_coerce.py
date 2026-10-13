"""routes_engagement._coerce: CSV cells into typed values."""
import pytest

from routes_engagement import _coerce


class TestCoerce:
    @pytest.mark.parametrize("raw, expected", [("1,200", 1200), ("12.5", 12.5), ("1,200.50", 1200.5), (" 3 ", 3),
                                               ("0", 0), ("-7", -7), ("1e3", 1000)])
    def test_numeric_strings_become_numbers(self, raw, expected):
        out = _coerce({"seats": raw})
        assert out["seats"] == expected and type(out["seats"]) is type(expected)

    def test_non_numeric_string_in_a_numeric_key_passes_through(self):
        assert _coerce({"seats": "ten"}) == {"seats": "ten"}  # validate_data reports it

    def test_numbers_already_typed_are_untouched(self):
        assert _coerce({"seats": 12, "budget": 1.5}) == {"seats": 12, "budget": 1.5}

    def test_strings_are_stripped(self):
        assert _coerce({"name": "  SAP  ", "notes": "\tok\n"}) == {"name": "SAP", "notes": "ok"}

    @pytest.mark.parametrize("value", [None, "", "   ", "\t\n"])
    def test_empty_cells_are_dropped(self, value):
        assert _coerce({"name": "x", "vendor": value}) == {"name": "x"}

    def test_commas_survive_in_text_keys(self):
        assert _coerce({"integration_notes": "a, b, c"}) == {"integration_notes": "a, b, c"}

    @pytest.mark.parametrize("value", [0, False, [], {}, ["a"]])
    def test_non_string_falsy_values_are_kept(self, value):
        assert _coerce({"k": value}) == {"k": value}

    def test_key_order_is_preserved(self):
        assert list(_coerce({"b": "1", "a": "2"})) == ["b", "a"]

    def test_empty_input(self):
        assert _coerce({}) == {}
