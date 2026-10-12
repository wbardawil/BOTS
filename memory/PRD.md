# BOTS — Product Requirements & Architecture

## Original Problem Statement
Build "BOTS": a living, AI-native business transformation platform for individual companies,
holding groups and portfolios. Primary interface is an interactive business map that manages
transformation across four connected perspectives (operating structure, capability/reference
model, phased transformation roadmap, value chain). Persistent, connected records — not a static
visualization. Answers WHERE/WHAT/WHO/HOW/WHEN of transformation. No autonomous agent execution
in MVP.

## User Choices
- Name: **BOTS**
- Scope: full MVP
- Auth: JWT email/password with seeded scoped roles
- AI: Emergent Universal LLM key (labeled drafts, never auto-publish)
- Canvas: React Flow with list/table alternatives
- Build order: architecture + data model first, then a single end-to-end connected company journey.

## Architecture
- **Frontend**: Vite + React 19 + Tailwind v4 + shadcn/ui + React Flow. LIGHT whiteboard theme per `memory/DESIGN.md`
  (Inter only; white paper, hairline borders, function-family hues). Single app shell (`Shell.jsx`) with header
  (workspace switcher, scope selector, current/target, draft/published, search) + left nav.
  Contexts: `AuthContext`, `ScopeContext`. Detail drawer with 10 contextual tabs.
- **Backend**: FastAPI + MongoDB (motor). Modules: `auth.py` (JWT Bearer + bcrypt + brute-force),
  `access.py` (scoped authorization from explicit memberships only), `ai.py` (Emergent LLM),
  `seed.py` (idempotent demo), `server.py` (generic entity engine + views/snapshots/assessment/
  oversight/export/audit).
- **Data model**: business entities stored separately from presentation.
  - Structure: `workspaces`, `organizations` (parent_id, no cycles), `portfolios`
    (organization_ids, dedupe), `memberships` (scoped role assignments).
  - Business: single `entities` collection (etype: capability, process, role, system,
    knowledge_source, opportunity, agent, workflow, initiative, playbook, adoption_assignment,
    metric, evidence, decision, risk_review), with `version` (optimistic concurrency), `status`
    (draft/in_review/published/archived), `state` (current/target), `last_reviewed_at`, `is_demo`.
  - `relationships` collection: typed edges (reports_to, coordinates, supports, depends_on,
    shares_info, requires_approval, hands_to, shared_service, approves).
  - Presentation: `views` (operating_map/capability_model/value_chain/roadmap) with `placements`.
  - History: `snapshots` (immutable payload copy), `audit`.

## Permission Model (server-side, DB-scoped)
Roles: platform_admin, workspace_admin, company_admin, company_editor, company_viewer,
group_viewer, external_reviewer. Access derived ONLY from explicit memberships. Workspace/parent/
portfolio membership does NOT auto-grant company data access. Enforced on every entity read/write.

## Implemented (2026-06-12)
- JWT auth + 5 seeded scoped accounts; tenant & company isolation (verified via API tests).
- 4 demo workspaces: standalone (Northwind), holding group (Atlas + subsidiaries + shared services),
  investment firm (Meridian, two overlapping portfolios — Harbor in both, deduped), isolation tenant.
- Default framework: 11 capabilities, 9 functions, 3 methodology phases, value chain.
- Full connected journey in Northwind: capability → process → opportunity → agent → workflow →
  playbook → initiative + phase-gate decision → adoption assignment → metric + evidence.
- Four connected views (Operating Map canvas, Capability Model, Value Chain, Roadmap matrix/table)
  + Executive Overview. Secondary pages: Opportunities, Agents & Workflows, Systems & Knowledge,
  Playbooks, Initiatives, Assessments, Adoption, Metrics & Evidence, Decisions, Group Oversight,
  Settings.
- Detail drawer (10 tabs) with inline editing + optimistic concurrency (409 on stale version),
  dependency navigation, phase-gate advancement (requires owner + evidence + approver + criteria),
  mark-reviewed, AI assist (labeled drafts).
- Draft/published snapshots (immutable) + diff since publication; living-model flags (unassigned
  owners, never-reviewed, missing evidence); assessment with unknown-excluded scoring; group
  oversight with dedupe + restricted-data withholding; authorized JSON export; audit log.
- 31-case backend regression suite at `/app/backend/tests/backend_test.py` (100% pass).

## Acceptance Criteria — all covered
Connected journey; edit-once-reflect-everywhere (single record, live views); immutable snapshots;
current vs target; evidence+approver phase gates; phase ≠ deployment status; no duplicate portfolio
companies; tenant/company API enforcement; aggregation no-leak; unknown stays unknown; learning ≠
operational readiness; labeled AI + demo data; persistence; optimistic concurrency.

## Backlog / Next Stage (deferred per MVP scope)
- P1: richer playbook editor; initiative workstreams per company; invitations/revocation UI;
  per-request membership caching (N+1); split server.py into routers.
- P2: private object storage for evidence attachments; risk-review workflow UI; CSV/PDF export;
  deeper change-impact prompts; production hardening (explicit CORS origin, transactional
  advance-phase). Deferred (explicitly out of MVP): agent execution, production RAG, live
  external sync, multiplayer editing, freehand drawing, full LMS, community, billing.
