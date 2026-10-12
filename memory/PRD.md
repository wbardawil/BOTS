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
- **Frontend**: Vite + React 19 + Tailwind v4 + shadcn/ui + React Flow. LIGHT whiteboard theme
  defined in `memory/DESIGN.md` (Inter only, white paper, hairline borders, function-family hues).
  Single app shell (`Shell.jsx`) with header
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

## Implemented (2026-10-12) — sourcing decision and risk overlay
- Every `agent` and `workflow` carries a sourcing decision (`sourcing`: buy | build | hybrid, `vendor`,
  `cost_estimate`, `cost_period`, `currency`, `cost_notes`) and a risk overlay (`risk_level`,
  `risk_category`, `data_sensitivity`, `regulatory_flags`, `required_controls`, `risk_notes`), all in
  `entity.data` (no backend schema change). Vocabularies live in `frontend/src/lib/constants.js`.
- UI: "Sourcing & Risk" tab in the detail drawer (selects for the enumerated fields, numeric coercion on
  save), fields on the create dialog, a "Sourcing · Risk" column on the Agents & Workflows table, a
  BUY/BUILD/HYBRID tag and a medium/high risk dot on board chips. Regulatory flags are illustrative,
  not legal advice.

## Implemented (2026-06-24) — content, documentation, lifecycle & dashboards (Phase 1)
- **Documentation attachments** (private per company, Emergent object storage): upload (PDF/Word/Excel/PPT/
  images/CSV/TXT, 15 MB cap), list, authorized blob download, soft-remove (`is_deleted`). Backend
  `storage.py`; endpoints `POST/GET /api/entities/{id}/attachments`, `GET /api/attachments/{id}/download`,
  `DELETE /api/attachments/{id}`. DB is source of truth (`db.attachments`). "Files" tab in the drawer.
- **Lifecycle pipeline** — eight fixed stages (Discovery→Assessing→Alternatives→Offer→Approved→In
  progress→Live→Realized) on initiatives/opportunities. `POST /api/entities/{id}/stage` date-stamps each
  move into `data.stage_history` (who/when/note), sets `went_live_at`. Owner-gated stages
  (approved+) return a clear blocked reason. `Pipeline.jsx` board: drag + dropdown moves, time-in-stage,
  read-only for viewers. Drawer "Lifecycle & Value" tab: stage grid, timeline, benefit inputs + 3/6/12 cadence.
- **Central inventory** (`Inventory.jsx`): all record types, search + filter (type/stage/owner/area/status)
  + sortable columns + selection with bulk actions (change stage / tag area / assign owner) via
  `POST /api/entities/bulk` (validated, audited, version-bumped, skips+reports blocked).
- **Adjustable dynamic dashboards** (`Dashboard.jsx`): add/remove/resize/reorder widgets on a 6-col grid,
  saved per user (`PUT /api/organizations/{id}/dashboard`), company default publish (admin) + reset.
  Widget library: ROI rollup, ROI by initiative, time freed, measurement cadence, lifecycle throughput,
  inventory health. Shared filters + drill-down (widget → drawer / inventory). `GET .../analytics` returns
  live records + aggregates; ROI math in `lib/analytics.js` keeps missing inputs "not measured yet", never zero.
- Seed enriched with stages, stage_history, and honest benefit/cadence numbers across Northwind.

## Implemented (2026-06-24b) — framework cohesion + group/config/reminders
- **Framework cohesion**: Dashboards/Inventory/Pipeline now speak the board's visual language — pipeline
  cards carry a function-family color left stripe + area label + the Phase pill (AI ambition from the
  roadmap); dashboards use family hues with new `roi_by_area` (11 canonical areas) and `phase_progress`
  (grayscale Phase 1/2/3) widgets; inventory gained an Area column with family dots. Documented the
  model: Phase = AI ambition (Co-Pilot→Brain→Autonomous); Stage = delivery progress; ROI = measurement.
- **Custom Stages** (per company): `pipeline_stages` on the organization; `GET/PUT /organizations/{id}/stages`
  (admin-only edit, duplicate-key + remove-with-records guards). Stage move / bulk / analytics / pipeline /
  inventory / dashboard all read the org's stages via ScopeContext. Settings has a rename/reorder/gate/
  add/remove editor.
- **Portfolio ROI dashboards**: `GET /portfolios/{id}/analytics` → per-company cost/expected/realized/ROI +
  by_area + stage_counts (isolation-aware, deduped). Group Oversight renders a side-by-side comparison with
  the family-area legend; currencies kept separate.
- **Measurement Reminders**: `GET /organizations/{id}/reminders` surfaces 3/6/12-month checkpoints due after
  a record goes Live with a missing realized value; shown as a Dashboard banner + a `reminders` widget.
  (In-app nudges; scheduled email is a later option.)
- Verified: /app/backend/tests/test_iteration6.py (17/17) + full frontend flows (testing agent, 100%).

## Implemented (2026-10-12) — engagement engine M0: control, scrub and noise removal
- Tests read credentials from the environment and skip when unset; no credential or preview-host literal
  remains in tests or `test_reports/`. Archive cleanups pass `confirm=true`.
- The Emergent Vite plugins are optional (dynamic import); `@emergentbase/*` dev dependencies removed; the
  build is vendor-free.
- `implementation_status` removed from seed and drawer: lifecycle `stage` is the only progress state;
  `phase` is the AI-ambition attribute. Phase names live only in `PHASE_NAMES` (frontend) and `seed.PHASES`
  (backend), placeholders pending the owner's rename.
- Navigation trimmed to Dashboards, Inventory, Pipeline, Framework Canvas, Operating Map, Roadmap,
  Executive Overview, Assessments, Group Oversight, Settings. The nine per-type pages, Capability Model
  and Value Chain pages, and the Adoption tab are gone; records are created from Inventory (type select +
  New). Adoption-assignment data is kept but no longer surfaced.
- `memory/SERVICE-flagship.md` holds the challenged engagement blueprint (day plan, deliverables, pricing).

## Backlog / Next Stage (deferred per MVP scope)
- P1: richer playbook editor; initiative workstreams per company; invitations/revocation UI;
  per-request membership caching (N+1); split server.py into routers.
- P2: private object storage for evidence attachments; risk-review workflow UI; CSV/PDF export;
  deeper change-impact prompts; production hardening (explicit CORS origin, transactional
  advance-phase). Deferred (explicitly out of MVP): agent execution, production RAG, live
  external sync, multiplayer editing, freehand drawing, full LMS, community, billing.
