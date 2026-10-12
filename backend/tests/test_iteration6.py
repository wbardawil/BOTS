"""Iteration 6: Custom Stages, Portfolio ROI, Measurement Reminders, phase_counts, regression."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("BOTS_TEST_BASE_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

_ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL") or ""
_ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or ""
_DEMO_PW = os.environ.get("DEMO_USERS_PASSWORD") or ""
if not (_ADMIN_EMAIL and _ADMIN_PASSWORD and _DEMO_PW):
    pytest.skip("Set ADMIN_EMAIL, ADMIN_PASSWORD and DEMO_USERS_PASSWORD to run the API tests.", allow_module_level=True)
ADMIN = {"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD}
VIEWER = {"email": "viewer@bots.demo", "password": _DEMO_PW}
EDITOR = {"email": "editor@bots.demo", "password": _DEMO_PW}

ORG = "o-northwind"
DEFAULT_STAGES = [
    {"key": "discovery", "label": "Discovery", "gated": False},
    {"key": "assessing", "label": "Assessing", "gated": False},
    {"key": "alternatives", "label": "Alternatives", "gated": False},
    {"key": "offer", "label": "Offer", "gated": False},
    {"key": "approved", "label": "Approved", "gated": True},
    {"key": "in_progress", "label": "In progress", "gated": True},
    {"key": "live", "label": "Live", "gated": True},
    {"key": "realized", "label": "Realized", "gated": True},
]


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def viewer_h():
    return {"Authorization": f"Bearer {_login(VIEWER)}"}


@pytest.fixture(scope="module")
def editor_h():
    return {"Authorization": f"Bearer {_login(EDITOR)}"}


@pytest.fixture(scope="module", autouse=True)
def restore_stages(admin_h):
    yield
    # always restore the 8 defaults at module end
    requests.put(f"{API}/organizations/{ORG}/stages",
                 json={"stages": DEFAULT_STAGES}, headers=admin_h, timeout=20)


# ---- Custom Stages ----
class TestCustomStages:
    def test_get_default_stages(self, admin_h):
        r = requests.get(f"{API}/organizations/{ORG}/stages", headers=admin_h, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert len(d["stages"]) == 8
        assert d["can_edit"] is True
        keys = [s["key"] for s in d["stages"]]
        assert keys == [s["key"] for s in DEFAULT_STAGES]
        gated = {s["key"] for s in d["stages"] if s.get("gated")}
        assert gated == {"approved", "in_progress", "live", "realized"}

    def test_viewer_forbidden_put(self, viewer_h):
        r = requests.put(f"{API}/organizations/{ORG}/stages",
                         json={"stages": DEFAULT_STAGES}, headers=viewer_h, timeout=20)
        assert r.status_code == 403

    def test_put_rename_reorder_add(self, admin_h):
        new_stages = [
            {"key": "discovery", "label": "Discover (edit)", "gated": False},
            {"key": "assessing", "label": "Assessing", "gated": False},
            {"key": "alternatives", "label": "Alternatives", "gated": False},
            {"key": "offer", "label": "Offer", "gated": False},
            {"key": "approved", "label": "Approved", "gated": True},
            {"key": "in_progress", "label": "In progress", "gated": True},
            {"key": "live", "label": "Live", "gated": True},
            {"key": "realized", "label": "Realized", "gated": True},
            {"key": "retired", "label": "Retired", "gated": False},
        ]
        r = requests.put(f"{API}/organizations/{ORG}/stages",
                         json={"stages": new_stages}, headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        # verify persisted
        g = requests.get(f"{API}/organizations/{ORG}/stages", headers=admin_h, timeout=20).json()
        assert len(g["stages"]) == 9
        assert g["stages"][0]["label"] == "Discover (edit)"
        assert any(s["key"] == "retired" for s in g["stages"])
        # restore defaults
        rr = requests.put(f"{API}/organizations/{ORG}/stages",
                          json={"stages": DEFAULT_STAGES}, headers=admin_h, timeout=20)
        assert rr.status_code == 200

    def test_duplicate_key_rejected(self, admin_h):
        bad = DEFAULT_STAGES + [{"key": "discovery", "label": "Dup", "gated": False}]
        r = requests.put(f"{API}/organizations/{ORG}/stages",
                         json={"stages": bad}, headers=admin_h, timeout=20)
        assert r.status_code == 400
        assert "Duplicate" in r.text or "duplicate" in r.text

    def test_remove_stage_with_records_rejected(self, admin_h):
        # Remove 'discovery' which has records → should 400
        bad = [s for s in DEFAULT_STAGES if s["key"] != "discovery"]
        r = requests.put(f"{API}/organizations/{ORG}/stages",
                         json={"stages": bad}, headers=admin_h, timeout=20)
        assert r.status_code == 400
        assert "discovery" in r.text or "record" in r.text.lower()


# ---- Stage moves honor org stages & gating ----
class TestStageMove:
    def test_gated_blocked_no_owner(self, admin_h):
        e = requests.get(f"{API}/entities/opp-nw-2", headers=admin_h, timeout=20).json()
        # clear owner to make sure gated is blocked
        v = e["version"]
        if e["data"].get("owner"):
            requests.put(f"{API}/entities/opp-nw-2",
                         json={"data": {**e["data"], "owner": None}, "version": v},
                         headers=admin_h, timeout=20)
            e = requests.get(f"{API}/entities/opp-nw-2", headers=admin_h, timeout=20).json()
            v = e["version"]
        r = requests.post(f"{API}/entities/opp-nw-2/stage",
                          json={"stage": "approved", "note": "", "version": v},
                          headers=admin_h, timeout=20)
        assert r.status_code == 400
        assert "owner" in r.text.lower()

    def test_unknown_stage_rejected(self, admin_h):
        e = requests.get(f"{API}/entities/init-nw-1", headers=admin_h, timeout=20).json()
        r = requests.post(f"{API}/entities/init-nw-1/stage",
                          json={"stage": "nonexistent", "note": "", "version": e["version"]},
                          headers=admin_h, timeout=20)
        assert r.status_code == 400


# ---- Portfolio ROI ----
class TestPortfolioROI:
    def test_pf_a_analytics(self, admin_h):
        r = requests.get(f"{API}/portfolios/pf-a/analytics", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "companies" in d and isinstance(d["companies"], list)
        assert len(d["companies"]) >= 1
        c = d["companies"][0]
        for key in ("name", "currency", "cost", "expected", "realized",
                    "roi_pct", "by_area", "stage_counts"):
            assert key in c, f"missing {key}"
        assert "restricted_count" in d

    def test_pf_a_dedupe(self, admin_h):
        d = requests.get(f"{API}/portfolios/pf-a/analytics", headers=admin_h, timeout=20).json()
        ids = [c["id"] for c in d["companies"]]
        assert len(ids) == len(set(ids))

    def test_viewer_forbidden_meridian_portfolio(self, viewer_h):
        # viewer only has Northwind; pf-a is in Meridian workspace → 403
        r = requests.get(f"{API}/portfolios/pf-a/analytics", headers=viewer_h, timeout=20)
        assert r.status_code == 403


# ---- Measurement Reminders ----
class TestReminders:
    def test_reminders_present(self, admin_h):
        r = requests.get(f"{API}/organizations/{ORG}/reminders", headers=admin_h, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] == len(d["reminders"])
        assert d["count"] >= 1
        # Expect the m6 Sales Co-Pilot reminder to exist
        found = any(("Sales Co-Pilot" in r.get("name", "") and r.get("checkpoint") == "m6")
                    for r in d["reminders"])
        assert found, f"Expected Sales Co-Pilot m6 reminder; got {[(r['name'], r['checkpoint']) for r in d['reminders']]}"

    def test_viewer_forbidden_other_org_reminders(self, viewer_h):
        r = requests.get(f"{API}/organizations/o-vertex/reminders", headers=viewer_h, timeout=20)
        assert r.status_code == 403


# ---- Analytics phase_counts + stages ----
class TestAnalytics:
    def test_phase_counts_and_stages(self, admin_h):
        r = requests.get(f"{API}/organizations/{ORG}/analytics", headers=admin_h, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "phase_counts" in d
        assert set(d["phase_counts"].keys()) >= {"1", "2", "3"} or set(d["phase_counts"].keys()) >= {1, 2, 3}
        assert "stages" in d and len(d["stages"]) >= 8


# ---- Regression ----
class TestRegression:
    def test_dashboard_get(self, admin_h):
        r = requests.get(f"{API}/organizations/{ORG}/dashboard", headers=admin_h, timeout=20)
        assert r.status_code == 200
        assert "widgets" in r.json()

    def test_viewer_isolation_other_org_analytics(self, viewer_h):
        r = requests.get(f"{API}/organizations/o-vertex/analytics", headers=viewer_h, timeout=20)
        assert r.status_code == 403

    def test_viewer_isolation_other_org_stages(self, viewer_h):
        r = requests.get(f"{API}/organizations/o-vertex/stages", headers=viewer_h, timeout=20)
        assert r.status_code == 403

    def test_bulk_area_still_works(self, admin_h):
        r = requests.post(f"{API}/entities/bulk",
                          json={"ids": ["init-nw-1"], "action": "area", "value": "sales"},
                          headers=admin_h, timeout=20)
        assert r.status_code == 200
        assert r.json().get("updated")
