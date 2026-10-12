"""Shared helpers for building and updating entity documents (used by the engine, imports and jobs)."""
import secrets
from datetime import datetime, timezone

from db import db


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_entity_doc(org: dict, etype: str, data: dict, *, status: str = "draft", state=None, is_demo: bool = False) -> dict:
    """The canonical entity document (same shape as create_entity and the roadmap template)."""
    return {
        "id": secrets.token_hex(12), "etype": etype,
        "organization_id": org["id"], "workspace_id": org.get("workspace_id"),
        "data": data, "status": status, "state": state,
        "version": 1, "is_demo": is_demo, "archived": False,
        "created_at": now_iso(), "updated_at": now_iso(), "last_reviewed_at": None,
    }


async def cas_update(eid: str, expected_version: int, set_fields: dict) -> bool:
    """Compare-and-set on the record version: writes dot-path fields only when the version is unchanged,
    bumping it so an open drawer gets a 409 instead of silently overwriting. Returns True when applied."""
    res = await db.entities.update_one(
        {"id": eid, "version": expected_version},
        {"$set": {**set_fields, "updated_at": now_iso()}, "$inc": {"version": 1}},
    )
    return res.matched_count == 1
