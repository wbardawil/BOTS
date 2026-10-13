"""Concurrency: two writes that carry the same version must not both win.

Runs against a live server (same env-driven skip as test_flagship.py). update_entity and move_stage check
the version they were given but write with filter {id} only, so two windows of one login that both loaded
version N both get a 200 and the second silently overwrites the first. Both tests are xfail(strict=True)
until the wave-2 fix moves the write filter to {id, version} (plan Part 2, item A); strict means they
turn red the day the fix lands, which is the signal to drop the marker.

Each test fires the pair ROUNDS times (fresh version each round) and demands exactly one 200 and one 409
every time: with the fix that is deterministic, without it at least one round yields two 200s.
"""
import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

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

ORG = "o-northwind"
RUN = uuid.uuid4().hex[:8]
T = 20
ROUNDS = 3
LOST_UPDATE = pytest.mark.xfail(strict=True, reason="lost-update fix lands in wave 2 (plan Part 2, item A)")


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=T)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin_h():
    return _login(ADMIN)


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_h):
    """Archive everything this run created (name contains the run suffix)."""
    yield
    r = requests.get(f"{API}/entities", params={"organization_id": ORG, "etype": "initiative"}, headers=admin_h, timeout=T)
    for e in r.json() if r.status_code == 200 else []:
        if RUN in str(e.get("data", {}).get("name", "")):
            requests.post(f"{API}/entities/{e['id']}/archive", params={"confirm": "true"}, headers=admin_h, timeout=T)


def _create(h, name):
    body = {"organization_id": ORG, "etype": "initiative", "data": {"name": name, "intake_kind": "initiative"}}
    r = requests.post(f"{API}/entities", json=body, headers=h, timeout=T)
    assert r.status_code == 200, r.text
    return r.json()


def _current(h, eid):
    r = requests.get(f"{API}/entities/{eid}", headers=h, timeout=T)
    assert r.status_code == 200, r.text
    return r.json()


def _race(send_a, send_b):
    """Release two requests at the same instant; return their status codes."""
    gate = threading.Barrier(2)

    def go(send):
        gate.wait(timeout=T)
        return send().status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        return [f.result() for f in (pool.submit(go, send_a), pool.submit(go, send_b))]


def _assert_one_winner(codes, what):
    assert all(c in (200, 409) for c in codes), f"{what}: unexpected status codes {codes}"
    assert sorted(codes) == [200, 409], f"{what}: both writes won with the same version: {codes}"


@LOST_UPDATE
def test_put_with_the_same_version_has_exactly_one_winner(admin_h):
    e = _create(admin_h, f"race-put-{RUN}")
    for rnd in range(ROUNDS):
        version = _current(admin_h, e["id"])["version"]

        def send(tag):
            body = {"version": version, "data": {"business_problem": f"window {tag} round {rnd}"}}
            return requests.put(f"{API}/entities/{e['id']}", json=body, headers=admin_h, timeout=T)

        _assert_one_winner(_race(lambda: send("A"), lambda: send("B")), f"PUT round {rnd}")


@LOST_UPDATE
def test_stage_move_with_the_same_version_has_exactly_one_winner(admin_h):
    e = _create(admin_h, f"race-stage-{RUN}")
    for rnd in range(ROUNDS):
        cur = _current(admin_h, e["id"])
        version = cur["version"]
        target = "assessing" if cur["data"].get("stage") != "assessing" else "discovery"  # both non-gated

        def send(tag):
            body = {"stage": target, "note": f"window {tag} round {rnd}", "version": version}
            return requests.post(f"{API}/entities/{e['id']}/stage", json=body, headers=admin_h, timeout=T)

        _assert_one_winner(_race(lambda: send("A"), lambda: send("B")), f"stage round {rnd}")
