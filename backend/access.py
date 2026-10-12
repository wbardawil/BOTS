"""Scoped authorization helpers. Access is derived from explicit memberships only."""
from db import db, clean

# Roles that can write business records for a company
WRITE_ROLES = {"company_admin", "company_editor", "workspace_admin"}


async def _memberships(user_id):
    return [clean(m) for m in await db.memberships.find({"user_id": user_id}).to_list(1000)]


async def _orgs_in_workspace(ws_id):
    return [clean(o)["id"] for o in await db.organizations.find({"workspace_id": ws_id}).to_list(1000)]


async def _orgs_in_portfolio(pf_id):
    pf = await db.portfolios.find_one({"id": pf_id})
    return clean(pf)["organization_ids"] if pf else []


async def accessible_org_ids(user):
    """Set of org ids whose business data this user may READ (explicit scope only)."""
    if user.get("global_role") == "platform_admin":
        return {clean(o)["id"] for o in await db.organizations.find({}).to_list(2000)}
    ids = set()
    for m in await _memberships(user["id"]):
        st, sid, role = m["scope_type"], m["scope_id"], m["role"]
        if st == "organization":
            ids.add(sid)
        elif st == "workspace" and role == "workspace_admin":
            ids.update(await _orgs_in_workspace(sid))
    return ids


async def accessible_workspace_ids(user):
    if user.get("global_role") == "platform_admin":
        return {clean(w)["id"] for w in await db.workspaces.find({}).to_list(1000)}
    ids = set()
    # workspaces where user has any membership, or that own an org the user can access
    for m in await _memberships(user["id"]):
        if m["scope_type"] == "workspace":
            ids.add(m["scope_id"])
    for oid in await accessible_org_ids(user):
        o = await db.organizations.find_one({"id": oid})
        if o:
            ids.add(clean(o)["workspace_id"])
    return ids


async def org_role(user, org_id):
    """Highest effective role the user holds for an organization, or None."""
    if user.get("global_role") == "platform_admin":
        return "platform_admin"
    best = None
    rank = {"company_viewer": 1, "external_reviewer": 1, "company_editor": 2,
            "company_admin": 3, "workspace_admin": 4}
    for m in await _memberships(user["id"]):
        r = None
        if m["scope_type"] == "organization" and m["scope_id"] == org_id:
            r = m["role"]
        elif m["scope_type"] == "workspace" and m["role"] == "workspace_admin":
            if org_id in await _orgs_in_workspace(m["scope_id"]):
                r = "workspace_admin"
        if r and (best is None or rank.get(r, 0) > rank.get(best, 0)):
            best = r
    return best


async def require_read(user, org_id):
    from fastapi import HTTPException
    if org_id not in await accessible_org_ids(user):
        raise HTTPException(status_code=403, detail="Not authorized for this company")


async def require_write(user, org_id):
    from fastapi import HTTPException
    role = await org_role(user, org_id)
    if role == "platform_admin" or role in WRITE_ROLES:
        return
    raise HTTPException(status_code=403, detail="Write access denied for this company")
