"""reap_stale_jobs: the startup sweep that fails feasibility jobs left queued/running by a dead process.

Pure unit test: the jobs collection is replaced by a fake that records update_many calls, so no Mongo is needed.
"""
import asyncio
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

# db.py builds the Motor client at import (lazily connected); any URL works for a test that never touches Mongo.
os.environ.setdefault("MONGO_URL", "mongodb://localhost:1")
os.environ.setdefault("DB_NAME", "bots_unit")
os.environ.setdefault("JWT_SECRET", "unit")

import routes_feasibility as rf  # noqa: E402


class FakeJobs:
    def __init__(self, modified=0):
        self.calls = []
        self.modified = modified

    async def update_many(self, flt, update):
        self.calls.append((flt, update))
        return SimpleNamespace(matched_count=self.modified, modified_count=self.modified)


def _reap(monkeypatch, modified):
    jobs = FakeJobs(modified)
    monkeypatch.setattr(rf, "db", SimpleNamespace(jobs=jobs))
    return asyncio.run(rf.reap_stale_jobs()), jobs


def test_returns_the_number_of_jobs_marked(monkeypatch):
    n, jobs = _reap(monkeypatch, modified=2)
    assert n == 2
    assert len(jobs.calls) == 1


def test_nothing_stale_returns_zero(monkeypatch):
    n, jobs = _reap(monkeypatch, modified=0)
    assert n == 0 and len(jobs.calls) == 1


def test_filter_targets_only_live_feasibility_jobs_older_than_the_window(monkeypatch):
    _, jobs = _reap(monkeypatch, modified=1)
    after = datetime.now(timezone.utc)  # the cutoff is stamped inside the call, so measure its age from here
    flt, _ = jobs.calls[0]
    assert flt["kind"] == "feasibility"
    assert set(flt["status"]["$in"]) == {"queued", "running"}
    # one branch for jobs that started, one for jobs still queued (started_at missing or null)
    started, queued = flt["$or"]
    assert set(queued) == {"started_at", "created_at"} and queued["started_at"] is None
    for cutoff in (started["started_at"]["$lt"], queued["created_at"]["$lt"]):
        age = after - datetime.fromisoformat(cutoff)
        assert timedelta(minutes=rf.STALE_JOB_MINUTES) <= age < timedelta(minutes=rf.STALE_JOB_MINUTES, seconds=5)
    assert rf.STALE_JOB_MINUTES == 30


def test_update_marks_failed_with_the_restart_reason_and_a_finish_stamp(monkeypatch):
    _, jobs = _reap(monkeypatch, modified=1)
    _, update = jobs.calls[0]
    sets = update["$set"]
    assert sets["status"] == "failed"
    assert sets["error"] == "interrupted by restart"
    assert datetime.fromisoformat(sets["finished_at"]).tzinfo is not None
    assert set(update) == {"$set"}  # nothing else is touched: items, counts and timestamps stay for the audit trail


def test_active_window_is_shorter_than_the_stale_window():
    # a job that no longer blocks a new run (15 min) is reaped at the next restart (30 min), never the other way round
    assert rf.ACTIVE_JOB_MINUTES < rf.STALE_JOB_MINUTES
