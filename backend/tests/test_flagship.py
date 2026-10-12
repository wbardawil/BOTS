"""Engagement engine (M1/M3): field validation, stage init on create, CSV import endpoint.

Runs against a live server. Set BOTS_TEST_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD and DEMO_USERS_PASSWORD;
without them the module skips. Every record it creates carries a unique suffix and is archived at the end.
"""
import os
import uuid

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
EDITOR = {"email": "editor@bots.demo", "password": _DEMO_PW}
VIEWER = {"email": "viewer@bots.demo", "password": _DEMO_PW}

ORG = "o-northwind"
RUN = uuid.uuid4().hex[:8]
T = 20


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=T)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin_h():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def editor_h():
    return _login(EDITOR)


@pytest.fixture(scope="module")
def viewer_h():
    return _login(VIEWER)


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_h):
    """Archive everything this run created (name contains the run suffix)."""
    yield
    for etype in ("system", "initiative", "opportunity"):
        r = requests.get(f"{API}/entities", params={"organization_id": ORG, "etype": etype}, headers=admin_h, timeout=T)
        for e in r.json() if r.status_code == 200 else []:
            if RUN in str(e.get("data", {}).get("name", "")):
                requests.post(f"{API}/entities/{e['id']}/archive", params={"confirm": "true"}, headers=admin_h, timeout=T)


def _list(h, etype):
    r = requests.get(f"{API}/entities", params={"organization_id": ORG, "etype": etype}, headers=h, timeout=T)
    assert r.status_code == 200, r.text
    return r.json()


def _by_name(h, etype, name):
    return [e for e in _list(h, etype) if e["data"].get("name") == name]


def _import(h, etype, rows, **kw):
    body = {"etype": etype, "rows": rows, "dry_run": False, "on_conflict": "skip", "source": "csv_import"}
    body.update(kw)
    return requests.post(f"{API}/organizations/{ORG}/import", json=body, headers=h, timeout=60)


# ---- M1: validation and stage initialisation ------------------------------------------------
class TestValidation:
    def test_enum_rejected_on_create(self, editor_h):
        r = requests.post(f"{API}/entities", json={"organization_id": ORG, "etype": "system",
                          "data": {"name": f"Bad kind {RUN}", "kind": "mainframe"}}, headers=editor_h, timeout=T)
        assert r.status_code == 400, r.text
        assert "kind" in str(r.json().get("detail"))

    def test_numeric_rejected_on_create(self, editor_h):
        r = requests.post(f"{API}/entities", json={"organization_id": ORG, "etype": "system",
                          "data": {"name": f"Bad cost {RUN}", "kind": "saas", "cost_estimate": "lots"}}, headers=editor_h, timeout=T)
        assert r.status_code == 400, r.text

    def test_protected_key_rejected(self, editor_h):
        r = requests.post(f"{API}/entities", json={"organization_id": ORG, "etype": "initiative",
                          "data": {"name": f"Protected {RUN}", "feasibility_class": "buy"}}, headers=editor_h, timeout=T)
        assert r.status_code == 400, r.text

    def test_opportunity_gets_first_stage(self, editor_h):
        stages = requests.get(f"{API}/organizations/{ORG}/stages", headers=editor_h, timeout=T).json()["stages"]
        r = requests.post(f"{API}/entities", json={"organization_id": ORG, "etype": "opportunity",
                          "data": {"name": f"Stage init {RUN}"}}, headers=editor_h, timeout=T)
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["data"]["stage"] == stages[0]["key"]
        assert e["data"]["stage_history"] and e["data"]["stage_history"][0]["stage"] == stages[0]["key"]

    def test_legacy_keys_untouched(self, editor_h):
        r = requests.post(f"{API}/entities", json={"organization_id": ORG, "etype": "system",
                          "data": {"name": f"Legacy {RUN}", "kind": "saas", "some_old_key": "free text"}}, headers=editor_h, timeout=T)
        assert r.status_code == 200, r.text
        assert r.json()["data"]["some_old_key"] == "free text"


# ---- M3: import endpoint --------------------------------------------------------------------
class TestImport:
    ROWS = [
        {"name": f"Salesforce {RUN}", "kind": "saas", "vendor": "Salesforce", "area": "sales", "api_available": "yes", "cost_estimate": "2,400", "cost_period": "monthly"},
        {"name": f"Almacén {RUN}", "kind": "database", "vendor": "Postgres", "area": "data", "api_available": "unknown"},
    ]

    def test_viewer_forbidden(self, viewer_h):
        assert _import(viewer_h, "system", self.ROWS).status_code == 403

    def test_bad_etype(self, editor_h):
        assert _import(editor_h, "agent", self.ROWS).status_code == 400

    def test_bad_on_conflict(self, editor_h):
        assert _import(editor_h, "system", self.ROWS, on_conflict="merge").status_code == 400

    def test_row_cap(self, editor_h):
        rows = [{"name": f"cap {i} {RUN}", "kind": "saas"} for i in range(501)]
        assert _import(editor_h, "system", rows).status_code == 400

    def test_dry_run_persists_nothing(self, editor_h):
        r = _import(editor_h, "system", self.ROWS, dry_run=True)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dry_run"] is True
        assert d["counts"] == {"created": 2, "updated": 0, "skipped": 0, "errors": 0}
        assert _by_name(editor_h, "system", self.ROWS[0]["name"]) == []

    def test_commit_creates(self, editor_h):
        r = _import(editor_h, "system", self.ROWS)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["counts"]["created"] == 2 and d["counts"]["errors"] == 0
        sf = _by_name(editor_h, "system", self.ROWS[0]["name"])
        assert len(sf) == 1
        data = sf[0]["data"]
        assert data["cost_estimate"] == 2400  # "2,400" coerced to a number
        assert data["source"] == "csv_import"
        assert data["import_key"].startswith("system:")
        assert data["api_available"] == "yes"

    def test_reimport_is_idempotent(self, editor_h):
        r = _import(editor_h, "system", self.ROWS)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["counts"]["created"] == 0 and d["counts"]["skipped"] == 2
        assert all(s["reason"] == "already exists" for s in d["skipped"])
        assert len(_by_name(editor_h, "system", self.ROWS[0]["name"])) == 1

    def test_name_match_is_case_insensitive(self, editor_h):
        rows = [{"name": self.ROWS[0]["name"].upper(), "kind": "saas"}]
        d = _import(editor_h, "system", rows).json()
        assert d["counts"]["skipped"] == 1 and d["counts"]["created"] == 0

    def test_update_on_conflict(self, editor_h):
        before = _by_name(editor_h, "system", self.ROWS[0]["name"])[0]
        rows = [{"name": self.ROWS[0]["name"], "kind": "saas", "owner": "Jordan Blake", "mcp_available": "yes"}]
        d = _import(editor_h, "system", rows, on_conflict="update").json()
        assert d["counts"]["updated"] == 1 and d["counts"]["created"] == 0
        after = _by_name(editor_h, "system", self.ROWS[0]["name"])[0]
        assert after["data"]["owner"] == "Jordan Blake"
        assert after["data"]["mcp_available"] == "yes"
        assert after["data"]["vendor"] == "Salesforce"  # untouched keys survive
        assert after["version"] == before["version"] + 1

    def test_error_rows_do_not_block_others(self, editor_h):
        rows = [
            {"name": f"Good {RUN}", "kind": "device"},
            {"name": f"No kind {RUN}"},
            {"name": f"Bad enum {RUN}", "kind": "saas", "hosting": "moon"},
            {"name": "", "kind": "saas"},
            {"name": f"Good {RUN}", "kind": "device"},  # duplicate inside the file
        ]
        d = _import(editor_h, "system", rows).json()
        assert d["counts"]["created"] == 1
        assert d["counts"]["errors"] == 3
        assert d["counts"]["skipped"] == 1 and d["skipped"][0]["reason"] == "duplicate row in this file"
        fields = {e["field"] for e in d["errors"]}
        assert fields == {"kind", "hosting", "name"}
        assert {e["row"] for e in d["errors"]} == {2, 3, 4}

    def test_initiative_import_gets_stage(self, editor_h):
        stages = requests.get(f"{API}/organizations/{ORG}/stages", headers=editor_h, timeout=T).json()["stages"]
        rows = [{"name": f"Commissions take days {RUN}", "intake_kind": "pain_point", "area": "finance",
                 "frequency": "monthly", "time_per_occurrence_hours": "32", "people_involved": "3"}]
        d = _import(editor_h, "initiative", rows, source="transcript").json()
        assert d["counts"]["created"] == 1, d
        e = _by_name(editor_h, "initiative", rows[0]["name"])[0]
        assert e["data"]["stage"] == stages[0]["key"]
        assert e["data"]["stage_history"][0]["note"] == "transcript"
        assert e["data"]["time_per_occurrence_hours"] == 32
        assert e["data"]["source"] == "transcript"

    def test_protected_key_in_row_is_an_error(self, editor_h):
        rows = [{"name": f"Sneaky {RUN}", "intake_kind": "initiative", "feasibility_class": "buy"}]
        d = _import(editor_h, "initiative", rows).json()
        assert d["counts"]["errors"] == 1 and d["errors"][0]["field"] == "feasibility_class"
