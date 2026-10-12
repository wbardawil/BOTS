"""Phase 1 regression: lifecycle stages, attachments, bulk, dashboards, analytics, isolation."""
import io
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

ORG = "o-northwind"
OTHER_ORG = "o-vertex"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_tok():
    return _login(_ADMIN_EMAIL, _ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def viewer_tok():
    return _login("viewer@bots.demo", _DEMO_PW)


@pytest.fixture(scope="module")
def editor_tok():
    return _login("editor@bots.demo", _DEMO_PW)


def H(t):
    return {"Authorization": f"Bearer {t}"}


def _get_entity(tok, eid):
    r = requests.get(f"{API}/entities/{eid}", headers=H(tok), timeout=10)
    assert r.status_code == 200, f"get {eid}: {r.status_code} {r.text}"
    return r.json()


# ------------------- Analytics -------------------
class TestAnalytics:
    def test_returns_payload(self, owner_tok):
        r = requests.get(f"{API}/organizations/{ORG}/analytics", headers=H(owner_tok), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "records" in j and isinstance(j["records"], list)
        assert len(j["records"]) > 0
        etypes = {r["etype"] for r in j["records"]}
        assert etypes & {"initiative", "opportunity", "agent"}, f"unexpected etypes: {etypes}"
        # stage_counts sums
        sc = j["stage_counts"]
        assert isinstance(sc, dict) and len(sc) == 8
        total_staged = sum(sc.values())
        # should not exceed total pipeline records
        pipeline = [x for x in j["records"] if x["etype"] in ("initiative", "opportunity")]
        assert total_staged <= len(pipeline)
        # inventory counts
        inv = j["inventory"]
        assert inv["total"] >= len(j["records"])
        assert "by_type" in inv and "by_area" in inv

    def test_viewer_cross_org_forbidden(self, viewer_tok):
        r = requests.get(f"{API}/organizations/{OTHER_ORG}/analytics", headers=H(viewer_tok), timeout=10)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"

    def test_viewer_own_org_ok(self, viewer_tok):
        r = requests.get(f"{API}/organizations/{ORG}/analytics", headers=H(viewer_tok), timeout=10)
        assert r.status_code == 200


# ------------------- Lifecycle stage move -------------------
class TestLifecycleStage:
    def test_move_with_owner_succeeds(self, owner_tok):
        e = _get_entity(owner_tok, "init-nw-1")
        original_version = e["version"]
        original_stage = e["data"].get("stage")
        # move to assessing (non-gated) then back
        target = "alternatives" if original_stage != "alternatives" else "assessing"
        r = requests.post(f"{API}/entities/init-nw-1/stage", headers=H(owner_tok),
                          json={"stage": target, "version": original_version, "note": "TEST_move"}, timeout=10)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["data"]["stage"] == target
        assert updated["version"] == original_version + 1
        hist = updated["data"]["stage_history"]
        assert hist[-1]["stage"] == target
        assert hist[-1]["at"]
        assert hist[-1]["by"]

    def test_gated_stage_without_owner_blocked(self, owner_tok):
        e = _get_entity(owner_tok, "opp-nw-2")
        # ensure no owner
        d = e["data"]
        has_owner = d.get("owner") or d.get("human_owner") or d.get("assignee")
        if has_owner:
            pytest.skip("opp-nw-2 has an owner in seed; cannot test block")
        r = requests.post(f"{API}/entities/opp-nw-2/stage", headers=H(owner_tok),
                          json={"stage": "approved", "version": e["version"]}, timeout=10)
        assert r.status_code == 400, f"expected 400 blocked, got {r.status_code}: {r.text}"
        msg = r.json().get("detail", "")
        assert "owner" in msg.lower(), f"reason should mention owner: {msg}"

    def test_stale_version_409(self, owner_tok):
        e = _get_entity(owner_tok, "init-nw-1")
        r = requests.post(f"{API}/entities/init-nw-1/stage", headers=H(owner_tok),
                          json={"stage": "discovery", "version": e["version"] - 999}, timeout=10)
        assert r.status_code == 409

    def test_viewer_stage_other_org_forbidden(self, viewer_tok, owner_tok):
        # find any vertex entity id via owner
        r = requests.get(f"{API}/entities", params={"organization_id": OTHER_ORG, "etype": "initiative"},
                         headers=H(owner_tok), timeout=10)
        if r.status_code != 200 or not r.json():
            pytest.skip("no vertex initiative to probe")
        vid = r.json()[0]["id"]
        v = r.json()[0]["version"]
        rr = requests.post(f"{API}/entities/{vid}/stage", headers=H(viewer_tok),
                           json={"stage": "discovery", "version": v}, timeout=10)
        assert rr.status_code in (403, 404), f"expected 403/404, got {rr.status_code}"


# ------------------- Attachments -------------------
class TestAttachments:
    def test_upload_list_download_delete(self, owner_tok):
        files = {"file": ("TEST_notes.txt", io.BytesIO(b"hello world"), "text/plain")}
        r = requests.post(f"{API}/entities/init-nw-1/attachments", headers=H(owner_tok),
                          files=files, timeout=30)
        assert r.status_code == 200, r.text
        att = r.json()
        aid = att["id"]
        assert att["original_filename"] == "TEST_notes.txt"
        # list
        lr = requests.get(f"{API}/entities/init-nw-1/attachments", headers=H(owner_tok), timeout=10)
        assert lr.status_code == 200
        assert any(a["id"] == aid for a in lr.json())
        # download
        dr = requests.get(f"{API}/attachments/{aid}/download", headers=H(owner_tok), timeout=15)
        assert dr.status_code == 200
        assert dr.content == b"hello world"
        # delete (soft)
        xr = requests.delete(f"{API}/attachments/{aid}", headers=H(owner_tok), timeout=10)
        assert xr.status_code == 200
        # not listed
        lr2 = requests.get(f"{API}/entities/init-nw-1/attachments", headers=H(owner_tok), timeout=10)
        assert all(a["id"] != aid for a in lr2.json())

    def test_disallowed_extension(self, owner_tok):
        files = {"file": ("evil.exe", io.BytesIO(b"MZ"), "application/octet-stream")}
        r = requests.post(f"{API}/entities/init-nw-1/attachments", headers=H(owner_tok),
                          files=files, timeout=15)
        assert r.status_code == 400
        assert "not allowed" in r.json().get("detail", "").lower()


# ------------------- Bulk actions -------------------
class TestBulk:
    def test_bulk_stage_mixed_with_blocked(self, owner_tok):
        # init-nw-1 (has owner) + opp-nw-2 (no owner) to approved → one updated, one skipped
        r = requests.post(f"{API}/entities/bulk", headers=H(owner_tok),
                          json={"ids": ["init-nw-1", "opp-nw-2"], "action": "stage", "value": "approved"},
                          timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "init-nw-1" in j["updated"]
        skipped_ids = [s["id"] for s in j["skipped"]]
        assert "opp-nw-2" in skipped_ids
        reason = next(s["reason"] for s in j["skipped"] if s["id"] == "opp-nw-2")
        assert "owner" in reason.lower()

    def test_bulk_area(self, owner_tok):
        r = requests.post(f"{API}/entities/bulk", headers=H(owner_tok),
                          json={"ids": ["init-nw-1"], "action": "area", "value": "TEST_Area"},
                          timeout=10)
        assert r.status_code == 200
        assert "init-nw-1" in r.json()["updated"]
        e = _get_entity(owner_tok, "init-nw-1")
        assert e["data"]["area"] == "TEST_Area"

    def test_bulk_owner(self, owner_tok):
        r = requests.post(f"{API}/entities/bulk", headers=H(owner_tok),
                          json={"ids": ["opp-nw-2"], "action": "owner", "value": "TEST_Owner"},
                          timeout=10)
        assert r.status_code == 200
        assert "opp-nw-2" in r.json()["updated"]
        e = _get_entity(owner_tok, "opp-nw-2")
        assert e["data"].get("owner") == "TEST_Owner"


# ------------------- Dashboard config -------------------
class TestDashboard:
    def test_get_dashboard_owner(self, owner_tok):
        r = requests.get(f"{API}/organizations/{ORG}/dashboard", headers=H(owner_tok), timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert "widgets" in j and isinstance(j["widgets"], list)
        assert j["can_publish_default"] is True

    def test_save_personal_and_reset(self, owner_tok):
        widgets = [{"id": "w-test", "type": "roi_rollup", "size": "sm"}]
        p = requests.put(f"{API}/organizations/{ORG}/dashboard", headers=H(owner_tok),
                         json={"widgets": widgets}, timeout=10)
        assert p.status_code == 200
        g = requests.get(f"{API}/organizations/{ORG}/dashboard", headers=H(owner_tok), timeout=10)
        assert g.json()["is_personal"] is True
        assert len(g.json()["widgets"]) == 1
        # reset
        rr = requests.post(f"{API}/organizations/{ORG}/dashboard/reset", headers=H(owner_tok), timeout=10)
        assert rr.status_code == 200
        g2 = requests.get(f"{API}/organizations/{ORG}/dashboard", headers=H(owner_tok), timeout=10)
        assert g2.json()["is_personal"] is False

    def test_viewer_cannot_publish_default(self, viewer_tok):
        g = requests.get(f"{API}/organizations/{ORG}/dashboard", headers=H(viewer_tok), timeout=10)
        assert g.status_code == 200
        assert g.json()["can_publish_default"] is False
        r = requests.put(f"{API}/organizations/{ORG}/dashboard/default", headers=H(viewer_tok),
                         json={"widgets": []}, timeout=10)
        assert r.status_code == 403

    def test_admin_publish_default(self, owner_tok):
        widgets = [{"id": "w-def", "type": "roi_rollup", "size": "md"}]
        r = requests.put(f"{API}/organizations/{ORG}/dashboard/default", headers=H(owner_tok),
                         json={"widgets": widgets}, timeout=10)
        assert r.status_code == 200

    def test_viewer_cross_org_dashboard_forbidden(self, viewer_tok):
        r = requests.get(f"{API}/organizations/{OTHER_ORG}/dashboard", headers=H(viewer_tok), timeout=10)
        assert r.status_code == 403
