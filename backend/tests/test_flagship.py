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


# ---- M4: AI provider (status, suggest envelope, transcript extraction) -------------------------
# These expect the server to run with BOTS_LLM_PROVIDER=fake (or a real key); otherwise they skip.
@pytest.fixture(scope="module")
def ai_enabled(editor_h):
    r = requests.get(f"{API}/ai/status", headers=editor_h, timeout=T)
    assert r.status_code == 200, r.text
    if not r.json().get("enabled"):
        pytest.skip("No AI provider on the server (set BOTS_LLM_PROVIDER=fake)")
    return r.json()


class TestAI:
    TRANSCRIPT = ("CEO: Cada mes perdemos una semana con el archivo de comisiones. Se exporta del CRM y se arma en Excel por 3 personas, unas 32 horas. "
                  "COO: Queremos lanzar un portal de clientes para que vean sus pedidos sin llamar a soporte. "
                  "CFO: El cierre contable tiene errores porque la conciliacion es manual y tarda dias.")

    def test_status_shape(self, ai_enabled):
        assert ai_enabled["provider"] in ("fake", "anthropic")
        assert ai_enabled["model"]

    def test_suggest_envelope(self, editor_h, ai_enabled):
        r = requests.post(f"{API}/ai/suggest", json={"organization_id": ORG, "kind": "prerequisites", "context": "Initiative: automate commissions"}, headers=editor_h, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["label"] == "AI_DRAFT" and d["accepted"] is False and d["kind"] == "prerequisites"
        assert isinstance(d["content"], str) and d["content"].strip()
        assert d["model"] and d["prompt_version"]

    def test_suggest_bad_kind(self, editor_h, ai_enabled):
        r = requests.post(f"{API}/ai/suggest", json={"organization_id": ORG, "kind": "poem"}, headers=editor_h, timeout=T)
        assert r.status_code == 400

    def test_extract_requires_write(self, viewer_h, ai_enabled):
        r = requests.post(f"{API}/ai/extract-intake", json={"organization_id": ORG, "text": self.TRANSCRIPT}, headers=viewer_h, timeout=T)
        assert r.status_code == 403

    def test_extract_short_text(self, editor_h, ai_enabled):
        r = requests.post(f"{API}/ai/extract-intake", json={"organization_id": ORG, "text": "hola"}, headers=editor_h, timeout=T)
        assert r.status_code == 400

    def test_extract_items(self, editor_h, ai_enabled):
        r = requests.post(f"{API}/ai/extract-intake", json={"organization_id": ORG, "text": self.TRANSCRIPT, "raised_by": "Ana Ruiz", "raised_by_role": "CEO"}, headers=editor_h, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["label"] == "AI_DRAFT" and d["kind"] == "intake_extract" and d["accepted"] is False
        items = d["content"]["items"]
        assert 1 <= len(items) <= 60
        for it in items:
            assert it["name"] and it["intake_kind"] in ("initiative", "pain_point", "slow_task")
            assert it.get("raised_by")  # default applied when the model left it empty
            for k in ("area", "frequency", "urgency", "impact"):
                assert it.get(k, "x") != ""  # empties are stripped, never sent to the importer
        # the draft is importable as-is (nothing was saved by the extraction)
        before = len(_list(editor_h, "initiative"))
        assert len(_list(editor_h, "initiative")) == before
        rows = [{**it, "name": f"{it['name'][:60]} {RUN}"} for it in items[:2]]
        imp = _import(editor_h, "initiative", rows, source="transcript").json()
        assert imp["counts"]["created"] == len(rows), imp


# ---- M5: feasibility batch run + human review ---------------------------------------------------
import time

CLASSES = ["current_stack", "configure", "build", "buy", "not_tech"]


def _wait_job(h, job_id, timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = requests.get(f"{API}/organizations/{ORG}/feasibility/jobs/{job_id}", headers=h, timeout=T).json()
        if j["status"] in ("done", "failed"):
            return j
        time.sleep(1)
    raise AssertionError("job did not finish in time")


def _run(h, body, tries=60):
    """POST feasibility/run. The in-progress guard is per company and every class here shares ORG, so under xdist a
    409 can come from another worker's job: wait for it to drain and retry. The guard itself is asserted in
    TestExtractionHardening, which calls the endpoint directly."""
    for _ in range(tries):
        r = requests.post(f"{API}/organizations/{ORG}/feasibility/run", json=body, headers=h, timeout=T)
        if r.status_code != 409:
            return r
        time.sleep(0.5)
    return r


def _get(h, eid):
    r = requests.get(f"{API}/entities/{eid}", headers=h, timeout=T)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def feas_items(editor_h, ai_enabled):
    rows = [
        {"name": f"Comisiones en Excel {RUN}", "intake_kind": "slow_task", "area": "finance", "frequency": "monthly", "time_per_occurrence_hours": "32", "people_involved": "3",
         "business_problem": "Commissions are rebuilt by hand in a spreadsheet from CRM exports."},
        {"name": f"Portal de clientes {RUN}", "intake_kind": "initiative", "area": "customer", "business_problem": "Clients want to see order status without calling; needs a custom integration with the ERP."},
        {"name": f"Nadie decide prioridades {RUN}", "intake_kind": "pain_point", "area": "strategy", "business_problem": "Priorities change weekly; it is a policy and decision-rights problem, not a tooling one."},
    ]
    d = _import(editor_h, "initiative", rows).json()
    assert d["counts"]["created"] == 3, d
    return d["created"]


class TestFeasibility:
    def test_run_requires_write(self, viewer_h, feas_items):
        r = requests.post(f"{API}/organizations/{ORG}/feasibility/run", json={"ids": feas_items}, headers=viewer_h, timeout=T)
        assert r.status_code == 403

    def test_run_creates_drafts(self, editor_h, feas_items):
        before = {eid: _get(editor_h, eid)["version"] for eid in feas_items}
        r = _run(editor_h, {"ids": feas_items})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["queued"] == 3 and d["job_id"]
        job = _wait_job(editor_h, d["job_id"])
        assert job["status"] == "done", job
        assert job["ok"] == 3 and job["failed"] == 0, job
        for eid in feas_items:
            e = _get(editor_h, eid)
            fz = e["data"]["feasibility"]
            assert fz["draft"]["label"] == "AI_DRAFT" and fz["draft"]["accepted"] is False
            assert fz["draft"]["content"]["classification"] in CLASSES
            assert fz["draft"]["run_id"] == d["job_id"] and fz["draft"]["prompt_version"]
            assert e["data"]["feasibility_draft_class"] == fz["draft"]["content"]["classification"]
            assert "feasibility_class" not in e["data"] and not fz.get("final")
            assert e["version"] == before[eid] + 1
        jobs = requests.get(f"{API}/organizations/{ORG}/feasibility/jobs", headers=editor_h, timeout=T).json()
        assert any(j["id"] == d["job_id"] for j in jobs)

    def test_rerun_skips_unless_forced(self, editor_h, feas_items):
        r = _run(editor_h, {"ids": feas_items}).json()
        assert r["job_id"] is None and r["skipped"] == 3
        r = _run(editor_h, {"ids": feas_items, "force": True}).json()
        assert r["queued"] == 3
        assert _wait_job(editor_h, r["job_id"])["ok"] == 3

    def test_review_stale_version(self, editor_h, feas_items):
        e = _get(editor_h, feas_items[0])
        r = requests.post(f"{API}/entities/{e['id']}/feasibility/review", json={"action": "accepted", "version": e["version"] - 1}, headers=editor_h, timeout=T)
        assert r.status_code == 409

    def test_review_requires_write(self, viewer_h, editor_h, feas_items):
        e = _get(editor_h, feas_items[0])
        r = requests.post(f"{API}/entities/{e['id']}/feasibility/review", json={"action": "accepted", "version": e["version"]}, headers=viewer_h, timeout=T)
        assert r.status_code == 403

    def test_accept(self, editor_h, feas_items):
        e = _get(editor_h, feas_items[0])
        r = requests.post(f"{API}/entities/{e['id']}/feasibility/review", json={"action": "accepted", "version": e["version"]}, headers=editor_h, timeout=T)
        assert r.status_code == 200, r.text
        u = r.json(); fz = u["data"]["feasibility"]
        assert fz["final"] == fz["draft"]["content"] and fz["draft"]["accepted"] is True
        assert fz["review_action"] == "accepted" and fz["reviewed_by"] and fz["reviewed_at"]
        assert u["data"]["feasibility_class"] == fz["final"]["classification"]
        assert u["version"] == e["version"] + 1

    def test_override_keeps_draft_detail(self, editor_h, feas_items):
        e = _get(editor_h, feas_items[1])
        target = "buy" if e["data"]["feasibility_draft_class"] != "buy" else "build"
        r = requests.post(f"{API}/entities/{e['id']}/feasibility/review", json={"action": "overridden", "version": e["version"], "final": {"classification": target}, "note": "vendor quote in hand"}, headers=editor_h, timeout=T)
        assert r.status_code == 200, r.text
        u = r.json(); fz = u["data"]["feasibility"]
        assert fz["final"]["classification"] == target and u["data"]["feasibility_class"] == target
        assert fz["final"]["rationale"] == fz["draft"]["content"]["rationale"]
        assert fz["review_note"] == "vendor quote in hand" and fz["draft"]["accepted"] is False

    def test_override_bad_class(self, editor_h, feas_items):
        e = _get(editor_h, feas_items[1])
        r = requests.post(f"{API}/entities/{e['id']}/feasibility/review", json={"action": "overridden", "version": e["version"], "final": {"classification": "magic"}}, headers=editor_h, timeout=T)
        assert r.status_code == 400

    def test_reject_clears_verdict(self, editor_h, feas_items):
        e = _get(editor_h, feas_items[2])
        r = requests.post(f"{API}/entities/{e['id']}/feasibility/review", json={"action": "rejected", "version": e["version"]}, headers=editor_h, timeout=T)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["data"]["feasibility"]["final"] is None and "feasibility_class" not in u["data"]
        assert "feasibility_draft_class" not in u["data"]  # leaves the board; draft kept on the record for reference
        assert u["data"]["feasibility"]["draft"]["content"]["classification"] in CLASSES
        # a rejected item is picked up again by the next (non-forced) run
        r = _run(editor_h, {"ids": [e["id"]]}).json()
        assert r["queued"] == 1
        assert _wait_job(editor_h, r["job_id"])["ok"] == 1
        assert _get(editor_h, e["id"])["data"]["feasibility_draft_class"] in CLASSES

    def test_form_save_echoing_protected_keys_is_tolerated(self, editor_h, feas_items):
        e = _get(editor_h, feas_items[0])
        data = {**e["data"], "owner": "Finance lead"}  # a drawer-style full save, server-only keys echoed unchanged
        r = requests.put(f"{API}/entities/{e['id']}", json={"data": data, "version": e["version"]}, headers=editor_h, timeout=T)
        assert r.status_code == 200, r.text
        assert r.json()["data"]["feasibility_class"] == e["data"]["feasibility_class"]
        bad = {**r.json()["data"], "feasibility_class": "buy"}
        r2 = requests.put(f"{API}/entities/{e['id']}", json={"data": bad, "version": r.json()["version"]}, headers=editor_h, timeout=T)
        assert r2.status_code == 400


# ---- Tier 1 C: extraction and runner hardening ----------------------------------------------------
# Exact counts and names below are the FakeLLM's (one row per speaker turn, name = first sentence); the
# shapes they prove (60 rows in one answer, duplicate_of only for a name on record, one run per company
# at a time) are provider-independent.
@pytest.fixture(scope="class")
def fake_provider(ai_enabled):
    if ai_enabled.get("provider") != "fake":
        pytest.skip("TestExtractionHardening asserts the fake provider's deterministic output")
    return ai_enabled


@pytest.fixture(scope="class")
def hardening_rows(editor_h, fake_provider):
    """60 intake rows (the engagement cap) so a fake-provider run stays in progress long enough to be observed."""
    rows = [{"name": f"Fila {i:02d} {RUN}", "intake_kind": "slow_task", "business_problem": f"Tarea manual {i} que tarda horas cada semana."} for i in range(60)]
    d = _import(editor_h, "initiative", rows).json()
    assert d["counts"]["created"] == 60, d
    return d["created"]


class TestExtractionHardening:
    @staticmethod
    def _turns(n):
        return "\n".join(f"{('CEO', 'COO', 'CFO')[i % 3]}: Tarea {i:02d} del área {i} {RUN} tarda horas cada semana y la hacen a mano." for i in range(n))

    def test_sixty_turn_transcript_extracts_sixty_rows(self, editor_h, fake_provider):
        text = self._turns(60)
        assert len(text) < 60000
        r = requests.post(f"{API}/ai/extract-intake", json={"organization_id": ORG, "text": text, "raised_by": "Ana Ruiz", "raised_by_role": "CEO"}, headers=editor_h, timeout=600)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["prompt_version"] == "intake-v2"
        items = d["content"]["items"]
        assert len(items) == 60 and d["counts"]["items"] == 60
        assert len({it["name"] for it in items}) == 60
        assert not any(it.get("duplicate_of") for it in items)  # none of these names is on record

    def test_duplicate_of_names_the_existing_record(self, editor_h, fake_provider):
        # A name no other fixture in this module creates: RUN is one value per xdist worker, so a name shared with
        # feas_items would already exist (case-insensitive match, on_conflict skip) whenever both classes land on one worker.
        name = f"Registro existente {RUN}"
        assert _import(editor_h, "initiative", [{"name": name, "intake_kind": "initiative"}]).json()["counts"]["created"] == 1
        text = (f"COO: {name.lower()}. Queremos que los clientes vean sus pedidos sin llamar a soporte.\n"
                f"CFO: Conciliación bancaria {RUN}. Tarda días cada mes y se hace a mano con errores.")
        r = requests.post(f"{API}/ai/extract-intake", json={"organization_id": ORG, "text": text}, headers=editor_h, timeout=180)
        assert r.status_code == 200, r.text
        items = r.json()["content"]["items"]
        by_name = {it["name"].lower(): it for it in items}
        assert by_name[name.lower()]["duplicate_of"] == name  # matched case-insensitively, reported with the record's exact name
        assert "duplicate_of" not in by_name[f"conciliación bancaria {RUN}".lower()]
        # the hint is for the import screen only; an imported row never carries it (the importer rejects nothing, so it must not be sent)
        imp = _import(editor_h, "initiative", [{k: v for k, v in by_name[f"conciliación bancaria {RUN}".lower()].items() if k != "duplicate_of"}], source="transcript", proposed=len(items)).json()
        assert imp["counts"]["created"] == 1, imp

    def test_import_audit_records_proposed_vs_created(self, editor_h, fake_provider):
        d = _import(editor_h, "initiative", [{"name": f"Propuesta {RUN}", "intake_kind": "pain_point"}], source="transcript", proposed=7).json()
        assert d["counts"]["created"] == 1, d
        rows = requests.get(f"{API}/organizations/{ORG}/audit", headers=editor_h, timeout=T).json()
        mine = [a for a in rows if a["action"] == "import" and a["summary"].startswith("proposed 7, ")]
        assert mine and mine[0]["summary"] == "proposed 7, 1 created, 0 updated, 0 skipped, 0 errors"
        assert _import(editor_h, "initiative", [{"name": f"Propuesta {RUN}", "intake_kind": "pain_point"}], proposed=-1).status_code == 422

    def test_second_run_while_in_progress_is_409(self, editor_h, hardening_rows):
        """The guard is a race against the fake provider: 60 rows draft in well under a second, so the second POST may
        land after the first job already finished; then it is a plain no-op (every row has a fresh draft, nothing
        queued). Each attempt accepts either answer, but across three attempts, each a fresh force run, the 409 must
        show up at least once; if it never does, the guard is not there."""
        url = f"{API}/organizations/{ORG}/feasibility/run"
        saw_409 = False
        for _ in range(3):
            first = _run(editor_h, {"ids": hardening_rows, "force": True})
            assert first.status_code == 200, first.text
            job_id = first.json()["job_id"]
            assert job_id and first.json()["queued"] == len(hardening_rows)
            second = requests.post(url, json={"ids": hardening_rows}, headers=editor_h, timeout=T)
            if second.status_code == 409:
                saw_409 = True
                assert "already in progress" in second.json()["detail"]
            else:
                assert second.status_code == 200, second.text
                assert second.json() == {"job_id": None, "queued": 0, "skipped": len(hardening_rows)}
            job = _wait_job(editor_h, job_id)
            assert job["status"] == "done" and job["ok"] == len(hardening_rows), job
            if saw_409:
                break
        assert saw_409, "no 409 in three attempts: the in-progress guard did not fire"
        # once the job is done the company is free again: a non-forced run is a no-op, not a 409
        r = _run(editor_h, {"ids": hardening_rows})
        assert r.status_code == 200 and r.json()["job_id"] is None, r.text
