#!/usr/bin/env python3
"""Create a client company for an engagement in one command (replaces the deferred onboarding wizard).

Run on the server host (or inside the backend container), with the backend's environment loaded:

    python scripts/new_client.py --name "Cliente SA de CV" --champion-email ana@cliente.com --champion-name "Ana Ruiz" \
        [--currency MXN] [--locale es-MX] [--industry Retail] [--workspace-name "Cliente SA"] [--reset-password] [--dry-run]

What it does, idempotently (safe to re-run):
  1. workspace  ws-<slug>   (created if missing)
  2. organization o-<slug>  (created if missing; locale / currency / industry / engagement stamp set)
  3. champion user          (created with a one-time temporary password printed ONCE on this terminal;
                             an existing user is reused and its password untouched unless --reset-password)
     + membership company_editor on the organization (the one client editor seat)
  4. the 11 canonical capabilities (published) and the Operating Map / Roadmap views, if absent

Nothing is printed anywhere else; never paste the password into chat or a ticket.
"""
import argparse
import asyncio
import os
import re
import secrets
import sys
import unicodedata
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

for var in ("MONGO_URL", "DB_NAME", "JWT_SECRET"):
    if not os.environ.get(var):
        sys.exit(f"{var} is not set; load the backend environment first (e.g. `set -a; . ./.env; set +a`).")

from db import db  # noqa: E402
from auth import hash_password  # noqa: E402
from entities_util import new_entity_doc  # noqa: E402
from seed import CAPABILITY_LIBRARY, CANON_KEYS  # noqa: E402

WS_KIND = "standalone"


def now():
    return datetime.now(timezone.utc).isoformat()


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "client"


async def main(a):
    sl = slug(a.name)
    ws_id, org_id = f"ws-{sl}", f"o-{sl}"
    report = []

    ws = await db.workspaces.find_one({"id": ws_id})
    if not ws:
        ws = {"id": ws_id, "name": a.workspace_name or a.name, "kind": WS_KIND, "is_demo": False, "created_at": now()}
        if not a.dry_run:
            await db.workspaces.insert_one(dict(ws))
        report.append(f"workspace     {ws_id}  created")
    else:
        report.append(f"workspace     {ws_id}  exists")

    org = await db.organizations.find_one({"id": org_id})
    stamp = {"locale": a.locale, "currency": a.currency, "industry": a.industry or None,
             "engagement": {"template": "tech-initiative-map", "created_at": now(), "created_by": "scripts/new_client.py"}}
    if not org:
        org = {"id": org_id, "workspace_id": ws_id, "name": a.name, "org_kind": "operating_company", "parent_id": None,
               "config": "compact", "is_demo": False, "created_at": now(), **stamp}
        if not a.dry_run:
            await db.organizations.insert_one(dict(org))
        report.append(f"organization  {org_id}  created ({a.currency}, {a.locale})")
    else:
        if not a.dry_run:
            await db.organizations.update_one({"id": org_id}, {"$set": {k: v for k, v in stamp.items() if k != "engagement"}})
        report.append(f"organization  {org_id}  exists (locale/currency/industry refreshed)")

    temp_password = None
    email = a.champion_email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        temp_password = secrets.token_urlsafe(9)
        uid = f"u-{sl}-{secrets.token_hex(3)}"
        user = {"id": uid, "email": email, "name": a.champion_name or email.split("@")[0], "password_hash": hash_password(temp_password),
                "global_role": "company_viewer", "created_at": now()}
        if not a.dry_run:
            await db.users.insert_one(dict(user))
        report.append(f"champion      {email}  created")
    else:
        if a.reset_password:
            temp_password = secrets.token_urlsafe(9)
            if not a.dry_run:
                await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(temp_password)}})
            report.append(f"champion      {email}  exists, password reset")
        else:
            report.append(f"champion      {email}  exists, password untouched")
    mem_id = f"m-{user['id']}-{org_id}-company_editor"
    if not await db.memberships.find_one({"id": mem_id}):
        if not a.dry_run:
            await db.memberships.insert_one({"id": mem_id, "user_id": user["id"], "scope_type": "organization",
                                             "scope_id": org_id, "role": "company_editor", "is_demo": False})
        report.append(f"membership    company_editor on {org_id}  created")
    else:
        report.append(f"membership    company_editor on {org_id}  exists")

    have_caps = await db.entities.count_documents({"organization_id": org_id, "etype": "capability", "archived": False})
    if have_caps == 0:
        docs = []
        for i, name in enumerate(CAPABILITY_LIBRARY):
            d = new_entity_doc(org, "capability", {"name": name, "area": CANON_KEYS[i], "area_no": i + 1,
                                                    "current_state": "", "target_state": "", "applicable": True}, status="published")
            d["id"] = f"cap-{sl}-{i}"
            docs.append(d)
        if not a.dry_run:
            await db.entities.insert_many(docs)
        report.append(f"capabilities  {len(docs)} created")
    else:
        report.append(f"capabilities  {have_caps} exist")

    for kind, name in (("operating_map", "Operating Map"), ("roadmap", "Transformation Roadmap")):
        vid = f"v-{sl}-{kind}"
        if not await db.views.find_one({"organization_id": org_id, "kind": kind}):
            if not a.dry_run:
                await db.views.insert_one({"id": vid, "organization_id": org_id, "workspace_id": ws_id, "kind": kind, "name": name,
                                           "placements": {}, "is_demo": False, "updated_at": now()})
            report.append(f"view          {kind}  created")
        else:
            report.append(f"view          {kind}  exists")

    print(("DRY RUN — nothing written\n" if a.dry_run else "") + "\n".join(report))
    if temp_password:
        print(f"\nTemporary password for {email} (shown once, give it to the champion in person):\n  {temp_password}")
    print(f"\nNext: log in as the champion, open the company, import the systems CSV on Technology Inventory.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True, help="company name as the client writes it")
    ap.add_argument("--champion-email", required=True)
    ap.add_argument("--champion-name", default="")
    ap.add_argument("--workspace-name", default="")
    ap.add_argument("--currency", default="MXN")
    ap.add_argument("--locale", default="es-MX")
    ap.add_argument("--industry", default="")
    ap.add_argument("--reset-password", action="store_true", help="set a new temporary password for an existing champion")
    ap.add_argument("--dry-run", action="store_true")
    asyncio.run(main(ap.parse_args()))
