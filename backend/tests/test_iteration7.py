"""
Iteration 7: Roadmap Templates + Scheduled Nudges (cron) backend tests.

Tests use o-conf (isolated tenant) + 'legal' area so demo data stays clean,
and clean up template initiatives at the end of the class.
"""
import os
import pytest
import requests

BASE = (os.environ.get("BOTS_TEST_BASE_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"

_ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL") or ""
_ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or ""
_DEMO_PW = os.environ.get("DEMO_USERS_PASSWORD") or ""
if not (_ADMIN_EMAIL and _ADMIN_PASSWORD and _DEMO_PW):
    pytest.skip("Set ADMIN_EMAIL, ADMIN_PASSWORD and DEMO_USERS_PASSWORD to run the API tests.", allow_module_level=True)
ADMIN = {"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD}
VIEWER = {"email": "viewer@bots.demo", "password": _DEMO_PW}

CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET") or ""
if not CRON_SECRET:
    pytest.skip("Set WEBHOOK_CRON_SECRET to run the cron tests.", allow_module_level=True)


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def viewer_token():
    return _login(VIEWER)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def viewer_headers(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}", "Content-Type": "application/json"}


# -------------------- Roadmap Template --------------------
class TestRoadmapTemplate:
    ORG = "o-conf"
    AREAS = ["legal"]  # small throwaway slice -> 3 draft initiatives
    created_ids = []

    def test_01_viewer_forbidden_on_northwind(self, viewer_headers):
        r = requests.post(f"{API}/organizations/o-northwind/roadmap-template",
                          json={"areas": ["legal"]}, headers=viewer_headers, timeout=20)
        assert r.status_code == 403, f"Expected 403 got {r.status_code}: {r.text}"

    def test_02_seed_creates_three(self, admin_headers):
        r = requests.post(f"{API}/organizations/{self.ORG}/roadmap-template",
                          json={"areas": self.AREAS}, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        # Should be either 3 created (fresh) OR 0 created + 3 skipped (previously run).
        assert data["created"] + data["skipped"] == 3 * len(self.AREAS)
        # If created==0 the previous run already seeded; make it idempotent either way.

    def test_03_idempotent_rerun(self, admin_headers):
        r = requests.post(f"{API}/organizations/{self.ORG}/roadmap-template",
                          json={"areas": self.AREAS}, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 0
        assert data["skipped"] == 3 * len(self.AREAS)

    def test_04_entities_present_with_template_flag(self, admin_headers):
        r = requests.get(f"{API}/entities",
                         params={"organization_id": self.ORG, "etype": "initiative"},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        ents = r.json()
        templ = [e for e in ents if e.get("etype") == "initiative"
                 and e.get("data", {}).get("template") is True
                 and e.get("data", {}).get("area") == "legal"]
        assert len(templ) == 3, f"Expected 3 template initiatives, got {len(templ)}"
        phases = sorted(e["data"]["phase"] for e in templ)
        assert phases == [1, 2, 3]
        for e in templ:
            assert e["data"]["stage"] == "discovery"
            assert e["status"] == "draft"
            TestRoadmapTemplate.created_ids.append(e["id"])

    def test_99_cleanup(self, admin_headers):
        # Archive created template initiatives so o-conf stays clean.
        failed = []
        for eid in TestRoadmapTemplate.created_ids:
            r = requests.post(f"{API}/entities/{eid}/archive", params={"confirm": "true"}, headers=admin_headers, timeout=20)
            if r.status_code not in (200, 204):
                failed.append((eid, r.status_code, r.text[:120]))
        assert not failed, f"Cleanup failures: {failed}"


# -------------------- Scheduled Nudges Cron --------------------
class TestCronNudges:
    def test_no_auth_returns_401(self):
        r = requests.post(f"{API}/cron/checkpoint-nudges", timeout=20)
        assert r.status_code == 401

    def test_wrong_bearer_returns_401(self):
        r = requests.post(f"{API}/cron/checkpoint-nudges",
                          headers={"Authorization": "Bearer wrong"}, timeout=20)
        assert r.status_code == 401

    def test_correct_bearer_returns_200_queued(self):
        r = requests.post(f"{API}/cron/checkpoint-nudges",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("queued") is True


# -------------------- In-app reminders still show checkpoints --------------------
class TestReminders:
    def test_northwind_reminders_contains_sales_m6(self, admin_headers):
        r = requests.get(f"{API}/organizations/o-northwind/reminders",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        rems = data.get("reminders", [])
        found = any("Sales Co-Pilot" in (x.get("name") or "") and x.get("checkpoint") == "m6"
                    for x in rems)
        assert found, f"Expected Sales Co-Pilot m6 in reminders; got: {rems}"


# -------------------- owner_email field save --------------------
class TestOwnerEmail:
    def test_put_owner_email_persists(self, admin_headers):
        # Pick a northwind initiative
        r = requests.get(f"{API}/entities",
                         params={"organization_id": "o-northwind", "etype": "initiative"},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        ents = r.json()
        target = next((e for e in ents if e.get("etype") == "initiative"), None)
        assert target, "No initiative to update"
        eid = target["id"]
        version = target["version"]
        prev = target.get("data", {}).get("owner_email")
        r = requests.put(f"{API}/entities/{eid}",
                         json={"version": version,
                               "data": {"owner_email": "delivered@resend.dev"}},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        new_version = r.json()["version"]
        # Verify
        r2 = requests.get(f"{API}/entities/{eid}", headers=admin_headers, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["data"].get("owner_email") == "delivered@resend.dev"
        # Restore previous value (or clear)
        requests.put(f"{API}/entities/{eid}",
                     json={"version": new_version, "data": {"owner_email": prev or ""}},
                     headers=admin_headers, timeout=20)


# -------------------- Light regression --------------------
class TestRegression:
    def test_stages_default(self, admin_headers):
        r = requests.get(f"{API}/organizations/o-northwind/stages",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        stages = r.json().get("stages", [])
        assert len(stages) >= 6

    def test_portfolio_analytics(self, admin_headers):
        r = requests.get(f"{API}/portfolios/pf-a/analytics", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "orgs" in data or "rows" in data or isinstance(data, dict)

    def test_viewer_isolation(self, viewer_headers):
        r = requests.get(f"{API}/entities",
                         params={"organization_id": "o-conf"},
                         headers=viewer_headers, timeout=20)
        assert r.status_code == 403

    def test_dashboard_endpoint(self, admin_headers):
        r = requests.get(f"{API}/organizations/o-northwind/analytics",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
