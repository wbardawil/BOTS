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

## Implemented (2026-10-12) — engagement engine M1: field manifest, drawer, validation, seed
- `frontend/src/lib/fields.js`: ONE field manifest per record type with `{es, en}` labels, types and
  vocabularies (system kind, API/MCP facts, intake fields, feasibility classes). It drives the drawer
  (`components/FieldGrid.jsx`, hoisted so inputs keep focus), the create dialog and, next, CSV import/export.
- Drawer tabs from the manifest: Integration (systems), Intake and Feasibility (initiatives; read-only
  draft/final view until the review endpoint lands). Overview shows manifest fields first and legacy keys
  under "Other fields". Lifecycle tab uses the company's custom stages.
- Backend `fields.py` validates the new enumerated and numeric fields on create/update (legacy keys
  untouched; server-only keys such as `feasibility` are rejected on plain writes). Initiatives and
  opportunities get their first lifecycle stage on creation. `entities_util.py` holds `new_entity_doc`
  and the compare-and-set `cas_update` for background writers.
- Seed v3: seven Northwind systems (one per kind, with API/MCP facts) and one classified pain point
  (`init-nw-intake-1`) so the Tech Inventory, Intake and Feasibility screens have real content.

## Implemented (2026-10-12) — engagement engine M3: technology inventory, CSV import/export
- `pages/TechInventory.jsx` (nav "Technology Inventory"): every `system` record with API / MCP / verified
  facts. Table mode groups by kind with kind/area/API/MCP/verified filters, bulk area and owner; map mode
  is the kind × area matrix of chips (stripe = area hue, outlined tag = API, ◆ = MCP, ✓ = verified), sized
  to fit the viewport so it exports as one image later (M7).
- CSV in and out: `lib/csv.js` (RFC 4180 quoting, BOM, `;` detection for es-MX Excel, replacement-character
  warning) and `components/ImportDialog.jsx` (file → column mapping pre-matched to manifest keys or labels
  in either language → dry run → commit, with a per-row report). Export writes the manifest's csv keys.
- `POST /api/organizations/{id}/import` (`routes_engagement.py`): system and initiative rows, max 500,
  validated with `fields.py`, numbers coerced ("2,400" → 2400), de-duplicated by `import_key` or
  case-insensitive name, `on_conflict` skip or update (update bumps `version`), initiatives get the
  company's first stage. Report: `{created, updated, skipped[{row,name,reason}], errors[{row,field,reason}], counts}`.
- Shared table primitives moved to `components/tables.jsx` (Inventory and Tech Inventory use the same
  `Th`, `Sel`, `BulkMenu`, `BulkOwner`). `server.py` lost its stage helpers to `stages.py` and the audit
  helper to `auditlog.py` so new routers import them without a cycle.
- `backend/tests/test_flagship.py`: validation (enum, numeric, protected key, legacy keys, stage init) and
  import (403 viewer, bad etype / on_conflict / row cap, dry run, create, idempotent re-import,
  case-insensitive match, update, error rows, initiative stage, protected key).

## Implemented (2026-10-12) — engagement engine M4: LLM provider, leadership intake, local Docker stack
- `backend/providers/llm.py`: one provider interface (`complete_json` with a JSON schema, `complete_text`).
  `AnthropicLLM` uses the owner's key through the official SDK with schema-constrained output (GA
  `output_config`, with a prompt-and-parse fallback for older SDKs); refusals and truncation surface as typed
  errors, never as silent empty drafts. `FakeLLM` is a deterministic stand-in (tests, demo instances).
  Selection by `BOTS_LLM_PROVIDER` / `ANTHROPIC_API_KEY` / `BOTS_LLM_MODEL`. The vendor LLM SDK is gone.
- `ai.py` on the provider: `/ai/status` (provider + model), `/ai/suggest` (same AI_DRAFT envelope, now with
  `model` and `prompt_version`), new `POST /ai/extract-intake`: transcript text (≤60k chars) → draft rows
  (name, kind, area, raised_by, process, frequency, hours, people, urgency, impact, verbatim evidence quote,
  systems only from the inventory). Nothing is saved; the client imports the rows it keeps (`source: transcript`).
- `pages/Intake.jsx` (nav "Leadership Intake"): items grouped by who raised them, kind/area filters, hours per
  month at stake (hours × occurrences × people), verdict column (final pill, dashed draft, or pending), form
  from the manifest (`CreateDialog` with `keys`/`extra`/`title`), and `components/TranscriptDialog.jsx`
  (paste or .txt → extract → tick rows → import → report).
- Local stack: `docker-compose.yml` (mongo + API + nginx-served frontend proxying `/api`), `backend/Dockerfile`,
  `frontend/Dockerfile`, `.env.example`, `scripts/test_local.sh`. Written here without a Docker daemon; first
  run is the owner's. Attachments still depend on the hosted storage integration (M8).
- Tests: `test_flagship.py::TestAI` (status, suggest envelope, bad kind, viewer 403, short text 400, extraction
  shape + importability); skips unless the server has a provider (`BOTS_LLM_PROVIDER=fake` for CI).

## Backlog / Next Stage (deferred per MVP scope)
- P1: richer playbook editor; initiative workstreams per company; invitations/revocation UI;
  per-request membership caching (N+1); split server.py into routers.
- P2: private object storage for evidence attachments; risk-review workflow UI; CSV/PDF export;
  deeper change-impact prompts; production hardening (explicit CORS origin, transactional
  advance-phase). Deferred (explicitly out of MVP): agent execution, production RAG, live
  external sync, multiplayer editing, freehand drawing, full LMS, community, billing.
