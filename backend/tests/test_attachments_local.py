"""Attachments through the local-disk storage provider (M8). Runs against a live API, env-driven like the
other API suites; the storage checks apply only when GET /api/attachments/provider reports "local"."""
import io
import os
import secrets

import pytest
import requests

BASE_URL = (os.environ.get("BOTS_TEST_BASE_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

_ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL") or ""
_ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or ""

ENTITY = "init-nw-1"  # Northwind seed initiative, same record the phase-1 attachment test uses


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def owner_tok():
    if not (_ADMIN_EMAIL and _ADMIN_PASSWORD):
        pytest.skip("Set ADMIN_EMAIL and ADMIN_PASSWORD to run the API tests.")
    r = requests.post(f"{API}/auth/login", json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def provider(owner_tok):
    r = requests.get(f"{API}/attachments/provider", headers=H(owner_tok), timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    assert set(j) >= {"provider", "ready"}, j
    if j["provider"] != "local":
        pytest.skip(f"storage provider is {j['provider']!r}; set BOTS_STORAGE_PROVIDER=local to run this suite")
    assert j["ready"] is True, f"local storage did not initialise: {j}"
    return j


class TestAttachmentsLocal:
    @pytest.mark.usefixtures("owner_tok")  # only so the suite skips, like the others, when no API is configured
    def test_provider_endpoint_requires_login(self):
        r = requests.get(f"{API}/attachments/provider", timeout=10)
        assert r.status_code in (401, 403), r.text

    def test_status_has_no_paths_or_secrets(self, provider):
        assert provider == {"provider": "local", "ready": True}

    def test_binary_round_trip_byte_exact(self, owner_tok, provider):
        data = b"\x89PNG\r\n\x1a\n" + secrets.token_bytes(4096) + b"\x00" * 16
        files = {"file": (f"TEST_{secrets.token_hex(3)}.png", io.BytesIO(data), "image/png")}
        r = requests.post(f"{API}/entities/{ENTITY}/attachments", headers=H(owner_tok), files=files, timeout=30)
        assert r.status_code == 200, r.text
        att = r.json()
        assert att["provider"] == "local"
        assert att["size"] == len(data)
        assert att["content_type"] == "image/png"
        key = att["storage_path"]
        assert key.startswith(f"bots/o-northwind/{ENTITY}/") and key.endswith(".png"), key
        assert ".." not in key and not key.startswith("/") and "\\" not in key
        dr = requests.get(f"{API}/attachments/{att['id']}/download", headers=H(owner_tok), timeout=15)
        assert dr.status_code == 200, dr.text
        assert dr.content == data, "bytes must come back exactly as uploaded"
        assert dr.headers.get("content-type", "").startswith("image/png")
        assert att["original_filename"] in dr.headers.get("content-disposition", "")
        xr = requests.delete(f"{API}/attachments/{att['id']}", headers=H(owner_tok), timeout=10)
        assert xr.status_code == 200, xr.text
        lr = requests.get(f"{API}/entities/{ENTITY}/attachments", headers=H(owner_tok), timeout=10)
        assert lr.status_code == 200 and all(a["id"] != att["id"] for a in lr.json())
        dr2 = requests.get(f"{API}/attachments/{att['id']}/download", headers=H(owner_tok), timeout=15)
        assert dr2.status_code == 404, "soft-deleted attachments are not downloadable"

    def test_two_uploads_get_distinct_keys_and_list_newest_first(self, owner_tok, provider):
        ids = []
        for i in range(2):
            files = {"file": (f"TEST_{i}.txt", io.BytesIO(f"doc {i}".encode()), "text/plain")}
            r = requests.post(f"{API}/entities/{ENTITY}/attachments", headers=H(owner_tok), files=files, timeout=30)
            assert r.status_code == 200, r.text
            ids.append((r.json()["id"], r.json()["storage_path"]))
        assert ids[0][1] != ids[1][1]
        lr = requests.get(f"{API}/entities/{ENTITY}/attachments", headers=H(owner_tok), timeout=10)
        listed = [a["id"] for a in lr.json()]
        assert listed.index(ids[1][0]) < listed.index(ids[0][0])
        for i, (aid, _) in enumerate(ids):
            d = requests.get(f"{API}/attachments/{aid}/download", headers=H(owner_tok), timeout=15)
            assert d.status_code == 200 and d.content == f"doc {i}".encode()
            assert requests.delete(f"{API}/attachments/{aid}", headers=H(owner_tok), timeout=10).status_code == 200
        for aid, _ in ids:
            assert requests.get(f"{API}/attachments/{aid}/download", headers=H(owner_tok), timeout=15).status_code == 404
