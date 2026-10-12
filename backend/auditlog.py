"""Audit-log writer shared by the engine and the feature routers (avoids importing server.py)."""
import secrets
from datetime import datetime, timezone

from db import db


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def audit(user, org_id, action, etype, eid, summary=""):
    await db.audit.insert_one({
        "id": secrets.token_hex(10), "organization_id": org_id, "user_id": user["id"],
        "user_name": user.get("name"), "action": action, "entity_type": etype,
        "entity_id": eid, "summary": summary, "at": now_iso(),
    })
