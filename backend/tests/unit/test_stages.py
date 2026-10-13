"""stages: _stage_maps, _owner_of, _blocked_reason."""
import pytest

from stages import DEFAULT_STAGES, _blocked_reason, _owner_of, _stage_maps

NON_GATED = ["discovery", "assessing", "alternatives", "offer"]
GATED = ["approved", "in_progress", "live", "realized"]


class TestStageMaps:
    def test_default_pipeline(self):
        keys, labels, gated = _stage_maps(DEFAULT_STAGES)
        assert keys == NON_GATED + GATED
        assert labels["in_progress"] == "In progress" and len(labels) == 8
        assert gated == set(GATED)

    def test_custom_stages_gate_only_when_the_flag_is_truthy(self):
        stages = [{"key": "a", "label": "A"}, {"key": "b", "label": "B", "gated": False},
                  {"key": "c", "label": "C", "gated": True}, {"key": "d", "label": "D", "gated": 0}]
        keys, labels, gated = _stage_maps(stages)
        assert keys == ["a", "b", "c", "d"] and gated == {"c"}
        assert labels == {"a": "A", "b": "B", "c": "C", "d": "D"}

    def test_empty(self):
        assert _stage_maps([]) == ([], {}, set())


class TestOwnerOf:
    def test_precedence_owner_then_human_owner_then_assignee(self):
        assert _owner_of({"owner": "Ana", "human_owner": "Luis", "assignee": "Eva"}) == "Ana"
        assert _owner_of({"human_owner": "Luis", "assignee": "Eva"}) == "Luis"
        assert _owner_of({"assignee": "Eva"}) == "Eva"

    @pytest.mark.parametrize("blank", ["", None])
    def test_blank_owner_falls_through(self, blank):
        assert _owner_of({"owner": blank, "human_owner": blank, "assignee": "Eva"}) == "Eva"

    def test_no_owner(self):
        assert not _owner_of({}) and not _owner_of({"owner": "", "name": "x"})


class TestBlockedReason:
    @pytest.fixture
    def maps(self):
        _, labels, gated = _stage_maps(DEFAULT_STAGES)
        return labels, gated

    def test_gated_stage_without_owner_is_blocked_and_names_the_label(self, maps):
        labels, gated = maps
        reason = _blocked_reason({"name": "x"}, "approved", labels, gated)
        assert reason and "Approved" in reason and "owner" in reason.lower()

    @pytest.mark.parametrize("stage", GATED)
    def test_every_gated_stage_blocks_without_owner(self, maps, stage):
        labels, gated = maps
        assert _blocked_reason({}, stage, labels, gated) is not None

    @pytest.mark.parametrize("field", ["owner", "human_owner", "assignee"])
    def test_any_owner_field_unblocks(self, maps, field):
        labels, gated = maps
        assert _blocked_reason({field: "Ana"}, "in_progress", labels, gated) is None

    @pytest.mark.parametrize("stage", NON_GATED)
    def test_non_gated_stages_never_block(self, maps, stage):
        labels, gated = maps
        assert _blocked_reason({}, stage, labels, gated) is None

    def test_uses_the_organisation_labels(self):
        labels, gated = {"en_sesion": "En sesión", "aprobado": "Aprobado"}, {"aprobado"}
        assert "Aprobado" in _blocked_reason({}, "aprobado", labels, gated)
        assert _blocked_reason({}, "en_sesion", labels, gated) is None
