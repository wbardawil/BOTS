"""Idempotent demo seed. All demo records are flagged is_demo=True and clearly labeled."""
import os
from datetime import datetime, timezone, timedelta
from db import db
from auth import hash_password, verify_password

CAPABILITY_LIBRARY = [
    "Strategy & Leadership", "Product & Service Management", "Operations & Supply Chain",
    "Marketing & Growth", "Sales", "Customer Operations & Administration",
    "Data & Analytics", "Technology, AI & Automation", "Finance",
    "People & HR", "Legal, Risk & Compliance",
]
FUNCTIONS = ["Sales", "Customer Operations & Administration", "Marketing & Growth",
             "Product & Service Management", "Operations & Supply Chain",
             "Data, Performance & Analytics", "Technology, AI & Automation",
             "Finance", "People & HR"]
PHASES = [
    {"n": 1, "name": "AI Co-Pilots", "desc": "Improve selected tasks with human direction and review."},
    {"n": 2, "name": "AI Brains", "desc": "Governed knowledge/context resource supporting authorized workflows."},
    {"n": 3, "name": "Autonomous Agents", "desc": "Selected workflows execute within approved boundaries."},
]
VALUE_CHAIN = ["Strategy & Planning", "Product / Service & Operations", "Marketing & Sales",
               "Delivery & Customer Success", "Feedback & Improvement"]
# Canonical business-area keys in library order (used to group records on the framework canvas)
CANON_KEYS = ["strategy", "product", "operations", "marketing", "sales", "customer",
              "data", "tech", "finance", "hr", "legal"]


def now():
    return datetime.now(timezone.utc).isoformat()


def ent(eid, etype, org_id, ws_id, data, status="draft", state=None, phase=None,
        reviewed=True, demo=True):
    if phase is not None:
        data["phase"] = phase
    return {
        "id": eid, "etype": etype, "organization_id": org_id, "workspace_id": ws_id,
        "data": data, "status": status, "state": state, "version": 1, "is_demo": demo,
        "archived": False, "created_at": now(), "updated_at": now(),
        "last_reviewed_at": now() if reviewed else None,
    }


def rel(from_id, ft, to_id, tt, rtype, org_id):
    return {"id": f"r-{from_id}-{to_id}-{rtype}", "organization_id": org_id, "from_id": from_id,
            "from_type": ft, "to_id": to_id, "to_type": tt, "rel_type": rtype, "is_demo": True}


async def seed_admin():
    """Fail closed: no default owner credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment."""
    email = (os.environ.get("ADMIN_EMAIL") or "").lower().strip()
    pw = os.environ.get("ADMIN_PASSWORD") or ""
    if not email or not pw:
        print("[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set; no platform admin created or updated.")
        return
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": "u-owner", "email": email, "password_hash": hash_password(pw),
            "name": "Wadi Bardawil", "global_role": "platform_admin", "created_at": now()})
    elif not verify_password(pw, existing["password_hash"]):
        await db.users.update_one({"email": email},
                                  {"$set": {"password_hash": hash_password(pw),
                                            "global_role": "platform_admin"}})


# Demo accounts share one password taken from DEMO_USERS_PASSWORD. If it is unset, no demo users are created.
DEMO_USERS = [
    ("u-editor", "editor@bots.demo", "Dana Editor"),
    ("u-viewer", "viewer@bots.demo", "Vic Viewer"),
    ("u-group", "group@bots.demo", "Gale Group"),
    ("u-isolated", "isolated@bots.demo", "Iris Isolated"),
]
DEMO_PASSWORD = os.environ.get("DEMO_USERS_PASSWORD") or ""


async def seed_demo(force=False):
    await seed_admin()
    marker = await db.meta.find_one({"id": "demo_seed_v3"})
    if marker and not force:
        return
    # Only demo rows are ever wiped. Client data (is_demo absent or False) must survive a reseed.
    for c in ["workspaces", "organizations", "portfolios", "memberships", "entities",
              "relationships", "views", "snapshots", "assessments", "audit"]:
        await db[c].delete_many({"is_demo": True})
    # demo users
    if not DEMO_PASSWORD:
        print("[seed] DEMO_USERS_PASSWORD not set; demo accounts skipped.")
    for uid, email, name in (DEMO_USERS if DEMO_PASSWORD else []):
        pw = DEMO_PASSWORD
        await db.users.update_one({"id": uid}, {"$set": {
            "id": uid, "email": email, "name": name, "password_hash": hash_password(pw),
            "global_role": "company_viewer", "created_at": now()}}, upsert=True)

    workspaces, orgs, portfolios, memberships = [], [], [], []
    entities, rels, views = [], [], []

    def ws(wid, name, kind):
        workspaces.append({"id": wid, "name": name, "kind": kind, "is_demo": True, "created_at": now()})

    def org(oid, wid, name, kind, parent=None, currency="USD"):
        orgs.append({"id": oid, "workspace_id": wid, "name": name, "org_kind": kind,
                     "parent_id": parent, "currency": currency, "is_demo": True,
                     "config": "compact", "created_at": now()})

    def pf(pid, wid, name, members):
        portfolios.append({"id": pid, "workspace_id": wid, "name": name,
                           "organization_ids": members, "is_demo": True, "created_at": now()})

    def mem(uid, st, sid, role):
        memberships.append({"id": f"m-{uid}-{sid}-{role}", "user_id": uid, "scope_type": st,
                            "scope_id": sid, "role": role, "is_demo": True})

    # ---- Workspace 1: Standalone ----
    ws("ws-northwind", "Northwind Standalone", "standalone")
    org("o-northwind", "ws-northwind", "Northwind Trading Co", "operating_company")
    # ---- Workspace 2: Holding group ----
    ws("ws-atlas", "Atlas Holdings Group", "holding_group")
    org("o-atlas", "ws-atlas", "Atlas Holdings", "holding_entity")
    org("o-retail", "ws-atlas", "Atlas Retail", "subsidiary", "o-atlas")
    org("o-logistics", "ws-atlas", "Atlas Logistics", "subsidiary", "o-atlas", "EUR")
    org("o-shared", "ws-atlas", "Atlas Shared Services", "business_unit", "o-atlas")
    # ---- Workspace 3: Investment firm ----
    ws("ws-meridian", "Meridian Capital", "investment_firm")
    org("o-vertex", "ws-meridian", "Vertex Software", "operating_company")
    org("o-harbor", "ws-meridian", "Harbor Foods", "operating_company")
    org("o-lumen", "ws-meridian", "Lumen Health", "operating_company", currency="GBP")
    pf("pf-a", "ws-meridian", "Portfolio A", ["o-vertex", "o-harbor"])
    pf("pf-b", "ws-meridian", "Portfolio B", ["o-harbor", "o-lumen"])  # Harbor in both -> dedupe
    # ---- Workspace 4: Isolation tenant ----
    ws("ws-iso", "Isolation Test Tenant", "standalone")
    org("o-conf", "ws-iso", "Confidential Corp", "operating_company")

    # memberships (explicit scoped)
    mem("u-editor", "organization", "o-northwind", "company_editor")
    mem("u-editor", "organization", "o-vertex", "company_editor")
    mem("u-viewer", "organization", "o-northwind", "company_viewer")  # Northwind ONLY
    mem("u-group", "portfolio", "pf-a", "group_viewer")
    mem("u-group", "organization", "o-vertex", "company_viewer")  # visible member of pf-a
    mem("u-isolated", "organization", "o-conf", "company_admin")  # different tenant only

    # ---------- Northwind: full connected journey ----------
    o, w = "o-northwind", "ws-northwind"
    # 11 capabilities
    cap_ids = {}
    for i, c in enumerate(CAPABILITY_LIBRARY):
        cid = f"cap-nw-{i}"
        cap_ids[c] = cid
        entities.append(ent(cid, "capability", o, w,
                            {"name": c, "area": CANON_KEYS[i], "area_no": i + 1,
                             "current_state": "Manual, email-driven",
                             "target_state": "AI co-piloted", "applicable": True,
                             "outcome_measure": "Cycle time"},
                            status="published", reviewed=(i % 3 != 0)))
    # human roles
    entities.append(ent("role-nw-ceo", "role", o, w,
                        {"name": "Chief Executive", "accountable_owner": "Jordan Blake",
                         "type": "human_executive"}, status="published"))
    entities.append(ent("role-nw-sales", "role", o, w,
                        {"name": "Head of Sales", "accountable_owner": "Avery Stone",
                         "type": "human_head"}, status="published"))
    entities.append(ent("role-nw-coord", "role", o, w,
                        {"name": "Sales Coordination Agent", "accountable_owner": None,
                         "type": "coordination_agent"}, status="published", reviewed=False))
    # process (part of Sales capability)
    entities.append(ent("proc-nw-leadqual", "process", o, w,
                        {"name": "Lead Qualification", "description": "Qualify inbound leads",
                         "current_state": "Manual triage in inbox",
                         "target_state": "Co-pilot scores & drafts replies",
                         "owner": "Avery Stone"}, status="published"))
    entities.append(ent("proc-nw-order", "process", o, w,
                        {"name": "Order Processing", "owner": None,  # unassigned owner flag
                         "current_state": "Manual entry"}, status="published", reviewed=False))
    # systems & knowledge
    # Technology inventory: one system per kind so the Tech Inventory view and the classifier have real shapes
    entities.append(ent("sys-nw-crm", "system", o, w,
                        {"name": "HubSpot CRM", "kind": "saas", "vendor": "HubSpot", "area": "sales", "owner": "Avery Stone",
                         "tech_owner": "Dana Editor", "users_count": 18, "seats": 20, "cost_estimate": 900, "cost_period": "monthly",
                         "currency": "USD", "criticality": "high", "hosting": "cloud", "system_status": "active",
                         "data_sensitivity": "personal_data", "api_available": "yes", "api_type": "rest",
                         "api_docs_url": "https://developers.hubspot.com/docs/api/overview", "auth_method": "oauth2",
                         "mcp_available": "unknown", "integration_notes": "Contacts, deals and tickets reachable via REST; webhooks on deal stage changes.",
                         "verified_integration": False, "source": "manual"}, status="published"))
    entities.append(ent("sys-nw-orders", "system", o, w,
                        {"name": "Order Desk (in-house)", "kind": "custom", "vendor": "Internal", "area": "operations", "owner": "Jordan Blake",
                         "tech_owner": "IT", "users_count": 9, "criticality": "high", "hosting": "on_prem", "system_status": "active",
                         "data_sensitivity": "confidential", "api_available": "no", "api_type": "none", "auth_method": "basic",
                         "mcp_available": "no", "integration_notes": "PHP app on a local server; data lives in MySQL; nightly CSV export to finance.",
                         "verified_integration": False, "source": "manual"}, status="published"))
    entities.append(ent("sys-nw-db", "system", o, w,
                        {"name": "Orders database (MySQL)", "kind": "database", "vendor": "MySQL", "area": "operations", "owner": "IT",
                         "criticality": "high", "hosting": "on_prem", "system_status": "active", "data_sensitivity": "confidential",
                         "api_available": "unknown", "auth_method": "basic", "mcp_available": "unknown", "source": "manual"}, status="published"))
    entities.append(ent("sys-nw-commissions", "system", o, w,
                        {"name": "Commissions workbook (Excel)", "kind": "spreadsheet", "vendor": "Microsoft Excel", "area": "finance", "owner": "Finance lead",
                         "users_count": 3, "criticality": "medium", "hosting": "desktop", "system_status": "active", "data_sensitivity": "confidential",
                         "api_available": "no", "api_type": "file_export", "mcp_available": "no",
                         "integration_notes": "Monthly manual consolidation of CRM exports; single owner; no version control.", "source": "manual"}, status="published"))
    entities.append(ent("sys-nw-zapier", "system", o, w,
                        {"name": "Zapier automations", "kind": "integration", "vendor": "Zapier", "area": "marketing", "owner": "Marketing lead",
                         "cost_estimate": 49, "cost_period": "monthly", "currency": "USD", "criticality": "low", "hosting": "cloud",
                         "system_status": "active", "api_available": "yes", "api_type": "webhook", "auth_method": "api_key", "mcp_available": "no",
                         "integration_notes": "Six zaps: form to CRM, CRM to Slack, invoice to sheet.", "source": "manual"}, status="published"))
    entities.append(ent("sys-nw-fileserver", "system", o, w,
                        {"name": "Office file server", "kind": "infrastructure", "vendor": "Windows Server", "area": "tech", "owner": "IT",
                         "criticality": "medium", "hosting": "on_prem", "system_status": "retiring", "data_sensitivity": "internal",
                         "api_available": "no", "mcp_available": "no", "source": "manual"}, status="published"))
    entities.append(ent("sys-nw-pos", "system", o, w,
                        {"name": "POS terminals (12)", "kind": "device", "vendor": "Clip", "area": "sales", "owner": "Store manager",
                         "users_count": 12, "criticality": "high", "hosting": "cloud", "system_status": "active", "data_sensitivity": "personal_data",
                         "api_available": "yes", "api_type": "rest", "auth_method": "api_key", "mcp_available": "unknown", "source": "manual"}, status="published"))
    # Leadership intake example (pain point captured in an interview, classified and reviewed)
    entities.append(ent("init-nw-intake-1", "initiative", o, w,
                        {"name": "Monthly commissions take four days", "intake_kind": "pain_point", "area": "finance",
                         "raised_by": "Avery Stone", "raised_by_role": "Head of Sales", "owner": "Finance lead",
                         "business_problem": "Commissions are consolidated by hand from CRM exports into one workbook every month; errors surface after payment.",
                         "intended_outcome": "Commissions computed from CRM deal data with a review step, in one day.",
                         "current_process": "Export deals from HubSpot, paste into Excel, apply rules per rep, email for approval.",
                         "frequency": "monthly", "time_per_occurrence_hours": 32, "people_involved": 3, "urgency": "high", "impact": "medium",
                         "systems_involved": ["sys-nw-crm", "sys-nw-commissions"],
                         "evidence_quote": "Every month we lose a week to the commissions file and someone still finds an error.",
                         "source": "form", "phase": 1,
                         "feasibility_draft_class": "configure", "feasibility_class": "configure",
                         "feasibility": {
                             "draft": {"label": "AI_DRAFT", "kind": "feasibility", "accepted": True, "model": "demo", "prompt_version": "feas-v1",
                                       "generated_at": now(), "assumptions": "Generated from the demo inventory only. Requires human acceptance.",
                                       "content": {"classification": "configure", "confidence": "medium",
                                                   "rationale": "HubSpot exposes deals via REST and its reporting can compute per-rep totals; the workbook only adds commission rules, which fit a HubSpot workflow or a scheduled export plus a reviewed sheet.",
                                                   "systems_used": ["sys-nw-crm"], "what_to_do": "Model commission rules as HubSpot calculated properties or a scheduled report; keep a one-page review before payout.",
                                                   "prerequisites": ["Commission rules written down per rep", "Deal close dates reliable in CRM"],
                                                   "risks": ["Rules with exceptions may not fit calculated properties"], "estimated_effort": "S",
                                                   "quick_win": True, "suggested_phase": 1, "open_questions": ["Are splits between reps common?"]}},
                             "final": {"classification": "configure", "confidence": "medium",
                                       "rationale": "Accepted as drafted; confirmed rules are simple percentages per rep.",
                                       "systems_used": ["sys-nw-crm"], "what_to_do": "Configure HubSpot calculated properties and a monthly report; review before payout.",
                                       "prerequisites": ["Commission rules written down per rep"], "risks": [], "estimated_effort": "S",
                                       "quick_win": True, "suggested_phase": 1, "open_questions": []},
                             "review_action": "accepted", "reviewed_by": "Wadi Bardawil", "reviewed_at": now(), "review_note": "Validated in the readout."}},
                        status="published", phase=1))
    entities.append(ent("know-nw-playbook", "knowledge_source", o, w,
                        {"name": "Sales Qualification Guide", "owner": "Avery Stone",
                         "freshness_rule": "Review quarterly", "access": "Sales team"},
                        status="published"))
    # opportunity
    entities.append(ent("opp-nw-1", "opportunity", o, w,
                        {"name": "Automate lead triage", "business_problem": "Slow manual triage",
                         "intended_outcome": "Faster response, higher conversion",
                         "proposed_change": "Co-pilot scores leads, drafts replies for review",
                         "candidate_phase": 1, "readiness": "medium", "effort": "medium",
                         "risk": "low", "priority": "high", "owner": "Avery Stone",
                         "decision": "Approved for pilot"}, status="published"))
    entities.append(ent("opp-nw-2", "opportunity", o, w,
                        {"name": "Order entry assistant", "business_problem": "Data entry errors",
                         "intended_outcome": "Fewer errors", "candidate_phase": 1,
                         "readiness": "unknown", "priority": "medium", "owner": None,
                         "decision": "Candidate"}, status="draft", reviewed=False))
    # agent (the record that appears in multiple views)
    entities.append(ent("agent-nw-leadqual", "agent", o, w,
                        {"name": "Lead Qualification Agent", "display_name": "Qualy",
                         "purpose": "Score inbound leads and draft qualification replies for human review",
                         "trigger": "New inbound lead in CRM",
                         "inputs": "Lead form, enrichment data",
                         "outputs": "Lead score, draft reply",
                         "human_owner": "Avery Stone", "operational_owner": "Dana Editor",
                         "allowed_actions": "Score leads; draft replies",
                         "prohibited_actions": "Send replies without approval; modify CRM records",
                         "approval_requirements": "Human approves all outbound replies",
                         "status": "Pilot",
                         "exceptions": "Low-confidence leads routed to human",
                         "escalation": "Head of Sales",
                         "sourcing": "hybrid", "vendor": "HubSpot Breeze + custom scoring prompt",
                         "cost_estimate": 450, "cost_period": "monthly", "currency": "USD",
                         "cost_notes": "Breeze add-on per seat plus LLM usage; no build cost beyond prompt tuning",
                         "risk_level": "medium", "risk_category": "privacy", "data_sensitivity": "personal_data",
                         "regulatory_flags": "gdpr, eu_ai_act",
                         "required_controls": "Human approves every outbound reply; lead data stays in CRM; monthly scoring bias review",
                         "risk_notes": "Scores influence who gets contacted first; monitor for proxy discrimination"},
                        status="published", phase=1))
    entities.append(ent("agent-nw-fcst", "agent", o, w,
                        {"name": "Demand Forecast Agent", "area": "operations", "purpose": "Draft demand forecasts",
                         "human_owner": "Jordan Blake", "status": "Under Assessment",
                         "allowed_actions": "Produce forecast drafts",
                         "prohibited_actions": "Change inventory",
                         "sourcing": "build", "vendor": "In-house (Python forecasting service + OpenAI for narrative)",
                         "cost_estimate": 12000, "cost_period": "one_off", "currency": "USD",
                         "cost_notes": "Two sprints of data engineering; ongoing model hosting under USD 100 per month",
                         "risk_level": "low", "risk_category": "accuracy", "data_sensitivity": "internal",
                         "regulatory_flags": "", "required_controls": "Forecast is a draft; planner signs off before purchase orders",
                         "risk_notes": "Wrong forecast costs stock, not compliance"},
                        status="published", phase=2))
    entities.append(ent("agent-nw-report", "agent", o, w,
                        {"name": "Compliance Report Agent", "area": "legal", "purpose": "Compile compliance reports",
                         "human_owner": None,  # missing owner -> cannot advance
                         "status": "Candidate",
                         "sourcing": "buy", "vendor": "Vanta (SOC 2 evidence collection)",
                         "cost_estimate": 1200, "cost_period": "monthly", "currency": "USD",
                         "risk_level": "high", "risk_category": "legal", "data_sensitivity": "confidential",
                         "regulatory_flags": "soc2, gdpr, industry",
                         "required_controls": "Legal reviews every generated report before filing; full audit trail retained",
                         "risk_notes": "A wrong statement in a compliance filing is a regulatory exposure, not a productivity issue"},
                        status="draft", phase=1, reviewed=False))
    # workflow
    entities.append(ent("wf-nw-leadqual", "workflow", o, w,
                        {"name": "Lead Qualification Workflow",
                         "steps": [
                             {"actor": "system", "input": "New lead", "action": "Capture lead", "output": "Lead record", "handoff": "agent"},
                             {"actor": "agent", "input": "Lead record", "action": "Score & draft reply", "output": "Score + draft", "handoff": "human", "approval": True},
                             {"actor": "human", "input": "Draft", "action": "Review & send", "output": "Qualified lead", "exception_route": "Reject → re-queue"},
                         ]}, status="published"))
    # playbook
    entities.append(ent("pb-nw-leadqual", "playbook", o, w,
                        {"name": "Lead Qualification Co-Pilot Playbook",
                         "source_type": "provider_authored",
                         "business_problem": "Manual lead triage is slow and inconsistent",
                         "applicability": "Inbound B2B sales",
                         "intended_outcome": "Faster, consistent qualification with human oversight",
                         "current_workflow": "Manual inbox triage",
                         "proposed_workflow": "Co-pilot scores and drafts; human approves",
                         "prerequisites": "CRM access, qualification guide, named owner",
                         "human_responsibilities": "Approve replies, handle exceptions",
                         "agent_responsibilities": "Score leads, draft replies",
                         "buy_build_hybrid": "Hybrid", "cost_categories": "Tooling, setup, training",
                         "implementation_steps": "1. Baseline  2. Pilot  3. Evaluate  4. Expand",
                         "testing": "Shadow mode comparison",
                         "acceptance_criteria": "Human-approved reply quality maintained",
                         "training": "Sales team onboarding", "sop_changes": "Updated triage SOP",
                         "measurement": "Response time, conversion", "fallback": "Revert to manual",
                         "version": "1.0", "review_date": now()}, status="published"))
    # initiative + phase gate
    entities.append(ent("init-nw-1", "initiative", o, w,
                        {"name": "Sales Co-Pilot Rollout", "sponsor_org": "o-northwind",
                         "participating_companies": ["o-northwind"],
                         "business_problem": "Slow lead handling",
                         "phase": 1, "status": "in_progress", "owner": "Avery Stone",
                         "contributors": ["Dana Editor"], "budget": 25000, "currency": "USD",
                         "start_date": "2026-02-01", "target_date": "2026-06-30",
                         "deliverables": "Pilot co-pilot, revised SOP",
                         "acceptance_criteria": "Pilot evaluation accepted",
                         "adoption_requirements": "Team trained on new SOP"},
                        status="published", phase=1))
    # adoption assignment
    entities.append(ent("adopt-nw-1", "adoption_assignment", o, w,
                        {"name": "Draft revised Lead Qualification SOP",
                         "assignee": "Dana Editor", "status": "in_progress",
                         "note": "Learning completion is not operational readiness"},
                        status="published"))
    entities.append(ent("adopt-nw-2", "adoption_assignment", o, w,
                        {"name": "Review agent boundaries", "assignee": "Avery Stone",
                         "status": "accepted"}, status="published"))
    # metrics + evidence
    entities.append(ent("metric-nw-1", "metric", o, w,
                        {"name": "Lead response time", "unit": "hours", "definition": "Time to first reply",
                         "calculation": "avg(reply_time - received_time)", "owner": "Avery Stone",
                         "source": "CRM (manual report)", "period": "2026-Q1",
                         "baseline": 12, "target": 3, "observation": 7,
                         "verification_status": "pilot_observation"}, status="published"))
    entities.append(ent("metric-nw-2", "metric", o, w,
                        {"name": "Qualification accuracy", "unit": "%", "definition": "Correctly qualified",
                         "owner": "Avery Stone", "baseline": None, "target": 90,
                         "observation": None, "verification_status": "expected_benefit"},
                        status="draft"))  # missing values stay missing
    entities.append(ent("ev-nw-1", "evidence", o, w,
                        {"name": "Pilot evaluation note", "type": "note",
                         "content": "Shadow-mode pilot showed faster replies with maintained quality.",
                         "recorded_by": "Dana Editor"}, status="published"))
    entities.append(ent("dec-nw-1", "decision", o, w,
                        {"name": "Approve Lead Qualification pilot", "approver": "Avery Stone",
                         "rationale": "Baseline and evaluation criteria met",
                         "evidence_ids": ["ev-nw-1"], "decided_at": now(),
                         "target_entity": "opp-nw-1"}, status="published"))

    # relationships (the connected chain)
    R = [
        ("cap-nw-4", "capability", "proc-nw-leadqual", "process", "supports"),  # Sales cap -> process
        ("proc-nw-leadqual", "process", "opp-nw-1", "opportunity", "supports"),
        ("opp-nw-1", "opportunity", "agent-nw-leadqual", "agent", "depends_on"),
        ("agent-nw-leadqual", "agent", "wf-nw-leadqual", "workflow", "supports"),
        ("agent-nw-leadqual", "agent", "pb-nw-leadqual", "playbook", "supports"),
        ("agent-nw-leadqual", "agent", "sys-nw-crm", "system", "depends_on"),
        ("agent-nw-leadqual", "agent", "know-nw-playbook", "knowledge_source", "depends_on"),
        ("init-nw-1", "initiative", "agent-nw-leadqual", "agent", "supports"),
        ("init-nw-1", "initiative", "adopt-nw-1", "adoption_assignment", "supports"),
        ("init-nw-1", "initiative", "metric-nw-1", "metric", "supports"),
        ("metric-nw-1", "metric", "ev-nw-1", "evidence", "supports"),
        ("dec-nw-1", "decision", "opp-nw-1", "opportunity", "approves"),
        ("role-nw-sales", "role", "proc-nw-leadqual", "process", "reports_to"),
        ("role-nw-ceo", "role", "role-nw-sales", "role", "coordinates"),
        ("agent-nw-leadqual", "agent", "role-nw-sales", "role", "reports_to"),
    ]
    for a, at, b, bt, rt in R:
        rels.append(rel(a, at, b, bt, rt, o))

    # Enrich each functional branch so the top band & reference model reach reference-like density
    BRANCHES = [("customer", "Customer & Admin", 1), ("marketing", "Marketing & Growth", 2),
                ("product", "Product / Service", 1), ("operations", "Operations & Supply Chain", 2),
                ("data", "Data & Analytics", 3), ("tech", "Tech, AI & Automations", 1),
                ("finance", "Finance", 2), ("hr", "Human Resources", 1)]
    for bk, blabel, ph in BRANCHES:
        capid = f"cap-nw-{CANON_KEYS.index(bk)}"
        lead, brain, ag, op, ini = f"role-nw-{bk}-lead", f"know-nw-{bk}", f"agent-nw-{bk}", f"opp-nw-{bk}", f"init-nw-{bk}"
        entities.append(ent(lead, "role", o, w, {"name": f"Head of {blabel}", "area": bk, "type": "human_head", "accountable_owner": "Named Owner"}, status="published"))
        entities.append(ent(brain, "knowledge_source", o, w, {"name": f"{blabel} Knowledge Base", "area": bk, "owner": "Named Owner", "freshness_rule": "Review quarterly"}, status="published"))
        entities.append(ent(ag, "agent", o, w, {"name": f"{blabel} Co-Pilot", "area": bk, "purpose": f"Support {blabel} workflows with human review", "human_owner": "Named Owner", "status": "Pilot" if ph == 1 else "Under Assessment" if ph == 1 else "candidate", "allowed_actions": "Draft & suggest", "prohibited_actions": "Act without approval",
                                              "sourcing": "buy" if ph == 1 else "hybrid", "vendor": "Vendor co-pilot in the team's existing tool" if ph == 1 else "Vendor platform + custom knowledge retrieval", "cost_estimate": 30 if ph == 1 else 400, "cost_period": "per_use" if ph == 1 else "monthly", "currency": "USD",
                                              "risk_level": "low" if ph == 1 else "medium", "risk_category": "accuracy", "data_sensitivity": "internal", "regulatory_flags": "", "required_controls": "Human reviews every output before it leaves the team"}, status="published", phase=ph))
        entities.append(ent(op, "opportunity", o, w, {"name": f"Automate {blabel} task", "area": bk, "candidate_phase": ph, "priority": "medium", "owner": "Named Owner"}, status="published"))
        entities.append(ent(ini, "initiative", o, w, {"name": f"{blabel} AI Rollout", "area": bk, "phase": ph, "status": "in_progress", "owner": "Named Owner", "budget": 10000, "currency": "USD"}, status="published", phase=ph))
        rels.append(rel(capid, "capability", ag, "agent", "supports", o))
        rels.append(rel(ag, "agent", lead, "role", "reports_to", o))
        rels.append(rel(ag, "agent", brain, "knowledge_source", "depends_on", o))
        rels.append(rel(capid, "capability", op, "opportunity", "supports", o))

    # views for Northwind
    def view(vid, kind, name, placements):
        views.append({"id": vid, "organization_id": o, "workspace_id": w, "kind": kind,
                      "name": name, "placements": placements, "is_demo": True, "updated_at": now()})

    view("v-nw-map", "operating_map", "Operating Map", {
        "role-nw-ceo": {"x": 400, "y": 20}, "role-nw-sales": {"x": 200, "y": 140},
        "role-nw-coord": {"x": 600, "y": 140}, "proc-nw-leadqual": {"x": 120, "y": 280},
        "agent-nw-leadqual": {"x": 320, "y": 280}, "agent-nw-fcst": {"x": 520, "y": 280},
        "sys-nw-crm": {"x": 220, "y": 420}, "know-nw-playbook": {"x": 440, "y": 420}})
    view("v-nw-cap", "capability_model", "Capability Model", {})
    view("v-nw-vc", "value_chain", "Value Chain",
         {"agent-nw-leadqual": {"x": 300, "y": 120}})
    view("v-nw-road", "roadmap", "Transformation Roadmap", {})

    # ---------- Lighter data for other companies (for oversight) ----------
    def mini(org_id, ws_id, prefix, agent_phases, currency="USD", with_init=True):
        for i, c in enumerate(CAPABILITY_LIBRARY[:5]):
            entities.append(ent(f"cap-{prefix}-{i}", "capability", org_id, ws_id,
                                {"name": c, "area": CANON_KEYS[i], "area_no": i + 1,
                                 "current_state": "Manual", "target_state": "Co-piloted",
                                 "applicable": True}, status="published"))
        for i, ph in enumerate(agent_phases):
            entities.append(ent(f"agent-{prefix}-{i}", "agent", org_id, ws_id,
                                {"name": f"{prefix.title()} Agent {i+1}", "area": CANON_KEYS[i],
                                 "purpose": "Support a bounded workflow",
                                 "human_owner": "Named Owner" if i == 0 else None,
                                 "status": "Pilot" if ph == 1 else "Candidate" if ph == 1 else "candidate"},
                                status="published", phase=ph))
            entities.append(ent(f"opp-{prefix}-{i}", "opportunity", org_id, ws_id,
                                {"name": f"Opportunity {i+1}", "area": CANON_KEYS[i], "priority": "medium",
                                 "candidate_phase": ph}, status="published"))
        if with_init:
            entities.append(ent(f"init-{prefix}-1", "initiative", org_id, ws_id,
                                {"name": f"{prefix.title()} Transformation", "phase": 1,
                                 "status": "in_progress", "owner": "Named Owner",
                                 "currency": currency, "budget": 10000}, status="published",
                                phase=1))
        views.append({"id": f"v-{prefix}-map", "organization_id": org_id, "workspace_id": ws_id,
                      "kind": "operating_map", "name": "Operating Map", "placements": {},
                      "is_demo": True, "updated_at": now()})

    mini("o-vertex", "ws-meridian", "vx", [1, 2, 3])
    mini("o-harbor", "ws-meridian", "hb", [1, 2])
    mini("o-lumen", "ws-meridian", "lm", [1], "GBP")
    mini("o-retail", "ws-atlas", "rt", [1, 2])
    mini("o-logistics", "ws-atlas", "lg", [1], "EUR")
    mini("o-conf", "ws-iso", "cf", [1], with_init=True)
    # shared-service group initiative
    entities.append(ent("init-atlas-shared", "initiative", "o-shared", "ws-atlas",
                        {"name": "Shared Services AI Desk (Group)", "phase": 1,
                         "status": "in_progress", "owner": "Group PMO",
                         "participating_companies": ["o-retail", "o-logistics"],
                         "budget": 40000, "currency": "USD",
                         "note": "Group initiative with company-specific workstreams"},
                        status="published", phase=1))

    # ---- Lifecycle + benefit enrichment for pipeline & dashboards ----
    STAGE_KEYS = ["discovery", "assessing", "alternatives", "offer", "approved",
                  "in_progress", "live", "realized"]
    def days_ago(n):
        return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()
    # Deterministic stage + ROI data so the pipeline and dashboards have honest, varied numbers.
    stage_plan = {
        "init-nw-1": ("live", {"expected_benefit": 60000, "realized_benefit": 38000,
                               "time_freed_hours": 320, "hourly_rate": 45,
                               "went_live_at": days_ago(220),
                               "cadence": {"m3": 12000, "m6": None, "m12": None}}),
        "init-nw-customer": ("realized", {"expected_benefit": 40000, "realized_benefit": 44000,
                                          "time_freed_hours": 200, "hourly_rate": 40,
                                          "went_live_at": days_ago(400),
                                          "cadence": {"m3": 15000, "m6": 30000, "m12": 44000}}),
        "init-nw-marketing": ("in_progress", {"expected_benefit": 30000, "time_freed_hours": 120, "hourly_rate": 35}),
        "init-nw-product": ("approved", {"expected_benefit": 50000}),
        "init-nw-operations": ("offer", {"expected_benefit": 80000, "time_freed_hours": 400, "hourly_rate": 50}),
        "init-nw-data": ("assessing", {}),
        "init-nw-tech": ("in_progress", {"expected_benefit": 25000}),
        "init-nw-finance": ("approved", {"expected_benefit": 35000, "time_freed_hours": 160, "hourly_rate": 55}),
        "init-nw-hr": ("discovery", {}),
        "opp-nw-1": ("approved", {"expected_benefit": 20000, "time_freed_hours": 90, "hourly_rate": 45}),
        "opp-nw-2": ("assessing", {}),
    }
    bk_stage = {"customer": "live", "marketing": "offer", "product": "assessing",
                "operations": "in_progress", "data": "discovery", "tech": "approved",
                "finance": "alternatives", "hr": "discovery"}
    for e in entities:
        if e["etype"] not in ("initiative", "opportunity"):
            continue
        eid = e["id"]
        if eid in stage_plan:
            stg, extra = stage_plan[eid]
            e["data"].update(extra)
        elif eid.startswith("opp-nw-") and e["data"].get("area") in bk_stage:
            stg = bk_stage[e["data"]["area"]]
        else:
            stg = "discovery"
        e["data"]["stage"] = stg
        idx = STAGE_KEYS.index(stg)
        e["data"]["stage_history"] = [
            {"stage": STAGE_KEYS[i], "at": now(), "by": "Wadi Bardawil", "note": "demo"}
            for i in range(idx + 1)
        ]
        if idx >= STAGE_KEYS.index("live"):
            e["data"].setdefault("went_live_at", now())

    # bulk insert
    await db.workspaces.insert_many(workspaces)
    await db.organizations.insert_many(orgs)
    await db.portfolios.insert_many(portfolios)
    await db.memberships.insert_many(memberships)
    for e in entities:
        e["is_demo"] = True
    await db.entities.insert_many(entities)
    await db.relationships.insert_many([{**r, "is_demo": True} for r in rels])
    await db.views.insert_many(views)

    # assessment for Northwind (with unknown + N/A examples)
    ans = {}
    scores = {"Business goals": 4, "Process maturity": 3, "Knowledge readiness": 2,
              "Data readiness": None, "Integration readiness": 2, "Human ownership": 4,
              "Adoption readiness": 3, "Risk and governance": 3, "Measurement readiness": 2}
    for dim, sc in scores.items():
        ans[dim] = {"dimension": dim, "response": sc, "evidence": "Demo baseline",
                    "assessor": "Avery Stone", "confidence": "medium", "notes": "",
                    "unknown": sc is None, "not_applicable": False, "date": now()}
    await db.assessments.insert_one({"organization_id": "o-northwind", "answers": ans,
                                     "is_demo": True})

    # publish one snapshot for Northwind
    nw_entities = [e for e in entities if e["organization_id"] == "o-northwind"]
    nw_rels = [r for r in rels if r["organization_id"] == "o-northwind"]
    nw_views = [v for v in views if v["organization_id"] == "o-northwind"]
    await db.snapshots.insert_one({
        "id": "snap-nw-1", "organization_id": "o-northwind", "published_by": "Wadi Bardawil",
        "published_at": now(), "change_summary": "Initial baseline publication (demo).",
        "payload": {"entities": nw_entities, "relationships": nw_rels, "views": nw_views},
        "is_demo": True})

    await db.meta.update_one({"id": "demo_seed_v3"}, {"$set": {"id": "demo_seed_v3", "at": now()}},
                             upsert=True)
