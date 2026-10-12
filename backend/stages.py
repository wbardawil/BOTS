"""Lifecycle pipeline helpers (shared by the engine, bulk actions, imports and jobs)."""
from db import db, clean


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
STAGES = DEFAULT_STAGES  # global default; companies may customize
PIPELINE_ETYPES = {"initiative", "opportunity"}


async def get_org_stages(org_id):
    org = clean(await db.organizations.find_one({"id": org_id}))
    st = (org or {}).get("pipeline_stages")
    return st or DEFAULT_STAGES


def _stage_maps(stages):
    keys = [s["key"] for s in stages]
    labels = {s["key"]: s["label"] for s in stages}
    gated = {s["key"] for s in stages if s.get("gated")}
    return keys, labels, gated


def _owner_of(data):
    return data.get("owner") or data.get("human_owner") or data.get("assignee")


def _blocked_reason(data, stage, labels, gated):
    """Clear reason a stage move is blocked, or None if allowed."""
    if stage in gated and not _owner_of(data):
        return f"Assign an owner before moving to “{labels[stage]}”. Gated stages need an accountable owner."
    return None
