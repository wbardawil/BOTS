"""Tests for new Phase-1 endpoints: framework-layout + roadmap inline authoring."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("BOTS_TEST_BASE_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

_OWNER = (os.environ.get("ADMIN_EMAIL") or "", os.environ.get("ADMIN_PASSWORD") or "")
_DEMO_PW = os.environ.get("DEMO_USERS_PASSWORD") or ""
if not (_OWNER[0] and _OWNER[1] and _DEMO_PW):
    pytest.skip("Set ADMIN_EMAIL, ADMIN_PASSWORD and DEMO_USERS_PASSWORD to run the API tests.", allow_module_level=True)
CREDS = {
    "owner": (_OWNER[0], _OWNER[1], "platform_admin"),
    "editor": ("editor@bots.demo", _DEMO_PW, None),
    "viewer": ("viewer@bots.demo", _DEMO_PW, None),
    "group": ("group@bots.demo", _DEMO_PW, None),
    "isolated": ("isolated@bots.demo", _DEMO_PW, None),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(v[0], v[1]) for k, v in CREDS.items()}  # CREDS rows carry a third, informational element


def H(t): return {"Authorization": f"Bearer {t}"}


# -------- framework-layout --------
class TestFrameworkLayout:
    def test_get_initial(self, tokens):
        r = requests.get(f"{API}/organizations/o-northwind/framework-layout",
                         headers=H(tokens["owner"]), timeout=10)
        assert r.status_code == 200, r.text
        assert "overrides" in r.json()

    def test_viewer_can_read(self, tokens):
        r = requests.get(f"{API}/organizations/o-northwind/framework-layout",
                         headers=H(tokens["viewer"]), timeout=10)
        assert r.status_code == 200

    def test_viewer_cannot_save(self, tokens):
        r = requests.put(f"{API}/organizations/o-northwind/framework-layout",
                         json={"overrides": {"sec-C": {"x": 10, "y": 20}}},
                         headers=H(tokens["viewer"]), timeout=10)
        assert r.status_code == 403

    def test_save_and_persist(self, tokens):
        payload = {"overrides": {"sec-C": {"x": 42, "y": 17}, "pnl-strategy": {"x": -5, "y": 8}}}
        r = requests.put(f"{API}/organizations/o-northwind/framework-layout",
                         json=payload, headers=H(tokens["owner"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["overrides"] == payload["overrides"]
        # GET to verify persistence
        r2 = requests.get(f"{API}/organizations/o-northwind/framework-layout",
                          headers=H(tokens["owner"]), timeout=10)
        assert r2.json()["overrides"] == payload["overrides"]

    def test_shared_per_company_editor_sees_owner_save(self, tokens):
        r = requests.get(f"{API}/organizations/o-northwind/framework-layout",
                         headers=H(tokens["editor"]), timeout=10)
        assert r.status_code == 200
        ov = r.json()["overrides"]
        assert ov.get("sec-C") == {"x": 42, "y": 17}

    def test_distinct_per_org(self, tokens):
        r = requests.get(f"{API}/organizations/o-vertex/framework-layout",
                         headers=H(tokens["owner"]), timeout=10)
        assert r.status_code == 200
        # Vertex should be empty / independent
        assert r.json()["overrides"].get("sec-C") != {"x": 42, "y": 17}

    def test_snapshot_captures_layout(self, tokens):
        r = requests.post(f"{API}/organizations/o-northwind/publish",
                         json={"change_summary": "TEST_layout snapshot"},
                         headers=H(tokens["owner"]), timeout=20)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        g = requests.get(f"{API}/organizations/o-northwind/snapshots/{sid}",
                         headers=H(tokens["owner"]), timeout=10)
        assert g.status_code == 200
        payload = g.json().get("payload", {})
        assert "layout" in payload, "payload.layout missing in snapshot"
        assert payload["layout"].get("sec-C") == {"x": 42, "y": 17}

    def test_reset_to_empty(self, tokens):
        r = requests.put(f"{API}/organizations/o-northwind/framework-layout",
                         json={"overrides": {}}, headers=H(tokens["owner"]), timeout=10)
        assert r.status_code == 200
        g = requests.get(f"{API}/organizations/o-northwind/framework-layout",
                         headers=H(tokens["owner"]), timeout=10)
        assert g.json()["overrides"] == {}


# -------- roadmap inline authoring --------
class TestRoadmapAuthoring:
    _init_id = None
    _rel_id = None

    def test_create_initiative_in_cell(self, tokens):
        payload = {
            "etype": "opportunity",
            "organization_id": "o-northwind",
            "data": {"name": "TEST_roadmap_init", "area": "sales", "phase": 1,
                     "acceptance_items": [], "adoption_items": []},
            "status": "draft",
        }
        r = requests.post(f"{API}/entities", json=payload,
                          headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["data"]["area"] == "sales"
        assert d["data"]["phase"] == 1
        TestRoadmapAuthoring._init_id = d["id"]

    def test_dependency_relationship(self, tokens):
        eid = TestRoadmapAuthoring._init_id
        r = requests.post(f"{API}/relationships",
                         json={"from_id": eid, "to_id": "agent-nw-leadqual",
                               "rel_type": "depends_on",
                               "organization_id": "o-northwind"},
                         headers=H(tokens["owner"]), timeout=10)
        assert r.status_code == 200, r.text
        TestRoadmapAuthoring._rel_id = r.json()["id"]

    def test_entity_shows_dependency(self, tokens):
        eid = TestRoadmapAuthoring._init_id
        r = requests.get(f"{API}/entities/{eid}", headers=H(tokens["owner"]), timeout=10)
        assert r.status_code == 200
        rels = r.json().get("relationships", [])
        assert any((x.get("rel_type") == "depends_on" or x.get("relation_type") == "depends_on")
                   and (x.get("to_id") == "agent-nw-leadqual" or x.get("to_entity") == "agent-nw-leadqual")
                   for x in rels)

    def test_delete_dependency(self, tokens):
        rid = TestRoadmapAuthoring._rel_id
        r = requests.delete(f"{API}/relationships/{rid}",
                            headers=H(tokens["owner"]), timeout=10)
        assert r.status_code in (200, 204)

    def test_acceptance_and_adoption_persist(self, tokens):
        eid = TestRoadmapAuthoring._init_id
        g = requests.get(f"{API}/entities/{eid}", headers=H(tokens["owner"]), timeout=10)
        v = g.json()["version"]
        new_data = {
            "acceptance_items": [{"id": "a1", "text": "Criterion A", "done": False},
                                 {"id": "a2", "text": "Criterion B", "done": True}],
            "adoption_items": [{"id": "d1", "text": "Train sales", "state": "in progress"}],
            "human_owner": "QA Owner",
            "status_label": "On track",
            "deliverable": "Doc v1",
            "target_date": "2026-06-30",
        }
        r = requests.put(f"{API}/entities/{eid}",
                        json={"data": new_data, "version": v},
                        headers=H(tokens["owner"]), timeout=10)
        assert r.status_code == 200, r.text
        g2 = requests.get(f"{API}/entities/{eid}", headers=H(tokens["owner"]), timeout=10)
        d = g2.json()["data"]
        assert len(d["acceptance_items"]) == 2
        assert d["acceptance_items"][1]["done"] is True
        assert d["adoption_items"][0]["state"] == "in progress"
        assert d["human_owner"] == "QA Owner"
        assert d["target_date"] == "2026-06-30"

    def test_cleanup(self, tokens):
        eid = TestRoadmapAuthoring._init_id
        requests.post(f"{API}/entities/{eid}/archive", params={"confirm": "true"}, headers=H(tokens["owner"]), timeout=10)
