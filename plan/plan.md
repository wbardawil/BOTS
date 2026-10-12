# BOTS — Reliable Content, Documentation, Lifecycle & Dashboards

A dependable workspace for managing every transformation record end to end: capture it, document it,
move it through its lifecycle, and watch its value through adjustable, live dashboards. The data stays
solid and auditable, and the dashboards on top are customizable, dynamic, and clean.

## Who it's for
- Operators and transformation leads who maintain the inventory of initiatives, opportunities, agents,
  systems, knowledge, playbooks, metrics, evidence and decisions, and keep it current.
- Company admins/editors who attach documentation, move work through stages, and record outcomes.
- Executives and portfolio overseers who want trustworthy status, cost, and realized value on dashboards
  they can arrange themselves — not guesses.

## Core features and experience

### 1. Reliable content & documentation management (the foundation)
- Every record type (initiatives, opportunities, agents, workflows, systems, knowledge, playbooks,
  metrics, evidence, decisions) is created and edited in place with a consistent editor.
- Inline validation with clear required vs optional fields; nothing saves in a broken state; unknown
  values stay explicitly unknown (never silently zero).
- Safe concurrent editing: if someone else changed a record since it was opened, the user is told and
  shown the current version instead of silently overwriting.
- Change history on every record: who changed what and when, readable in the record.
- Documentation as file attachments on any record: upload PDFs, Word/Excel, images and spreadsheets;
  list them with name, type, size and date; download is authorized (only users who can see the record's
  company can open its files); attachments are private per company. Files are soft-removed (hidden), not
  hard-deleted, so history stays intact. A sensible per-file size limit and allowed file types apply.
- A central Inventory screen across all record types: search, filter (by type, stage, owner, phase,
  area, company), sort, and open any record. Bulk actions on a selection: change stage, assign owner,
  tag area — with the same validation and history rules.

### 2. Initiative / Opportunity lifecycle pipeline
- A pipeline board where records move across fixed stages by drag or by dropdown:
  Discovery → Assessing → Alternatives (configure / build / buy) → Offer → Approved → In progress →
  Live → Realized (measure results).
- Each stage change is date-stamped and recorded, producing a lifecycle timeline on the record
  (entered-stage dates, who moved it, optional note). Time-in-stage is visible.
- The board respects edit vs read-only: viewers can see and open cards but cannot move them.
- Guardrails carried over from today where they already exist (e.g. approvals/evidence needed to pass
  certain gates) surface as a clear reason when a move is blocked, rather than failing silently.
- Stage set is the fixed list above for this release (configurable per company is a later phase).

### 3. Adjustable, dynamic dashboards (ROI & impact) — a headline of this release
- Dashboards are the primary way to watch the portfolio, and they are:
  - Adjustable: users add, remove, resize and rearrange widgets on a grid; pick what each widget shows
    (metric, record type, stage, area, owner, time window); and save their arrangement. A company can
    publish a default dashboard everyone starts from, and individuals can tweak their own copy.
  - Dynamic: every widget reflects live data and reacts to shared filters (company/portfolio, area,
    stage, owner, date range). Clicking a widget drills into the underlying records in the inventory.
  - Aesthetic: clean, light, whiteboard-consistent charts and tiles — generous spacing, hairline
    borders, function-family colors for areas, grayscale for stage/status, no clutter.
- Widget library for this release includes:
  - ROI & benefit: cost (one-off / monthly / per-use, already captured) vs expected and realized
    benefit; computed ROI % with a simple status (on track / below expectation / realized); per
    initiative and rolled up per company.
  - Time freed: hours released per period, optionally valued at a rate to express the freed time in
    money, contributing to benefit and ROI.
  - Measurement cadence: expected vs realized tracked at 3, 6 and 12 months after a record goes Live.
  - Lifecycle & throughput: counts by stage, time-in-stage, what's Live vs in flight.
  - Inventory health: records by type/area/owner, and what's missing data.
- Missing-data honesty: any widget that lacks inputs shows "not measured yet" / incomplete rather than
  inventing a zero, so ROI and impact numbers are trustworthy.

### Carried over, unchanged
- Current/target and draft/published toggles, the framework canvas and the four views, permissions and
  company isolation, the light whiteboard look, and clearly-labeled demo data all keep working.

## User flow
1. Open a company and land on either the dashboards or the inventory, with shared filters at the top.
2. Create or open any record; fill validated fields; attach documentation; save with confidence that
   concurrent edits won't be lost; see the change history build up.
3. Open the pipeline board; drag an initiative from Discovery toward Realized; each move is timestamped
   and added to the record's lifecycle timeline; blocked moves explain why.
4. Enter cost and benefit (including time freed) on the record; at 3/6/12 months after Live, record the
   realized numbers.
5. Open a dashboard, arrange the widgets you care about, apply filters, and watch ROI, time freed,
   realized vs expected, and lifecycle throughput update live; click any widget to drill into the
   records behind it.

## UI/UX feel
- The light whiteboard style continues: white surfaces, hairline borders, Inter, function-family colors
  for areas, grayscale for stages/status; compact cards; minimal shadows.
- Editing is in-place and forgiving: obvious required fields, inline errors, visible save/affected-by
  state, and no surprise overwrites.
- The pipeline reads like a calm board, not a noisy Kanban: fixed columns, draggable cards, time-in-stage
  and a clear "why blocked" message when a move isn't allowed.
- Dashboards feel like a tidy whiteboard of tiles: drag to rearrange, resize on a grid, quiet charts with
  units and periods labeled, and explicit "not measured yet" instead of invented figures.

## Implementation phases

### Phase 1 — MVP (built now)
- Reliable editing for all record types: inline validation, no-silent-overwrite handling, and visible
  change history.
- Documentation attachments on any record: upload, list, authorized private download, soft-remove.
- Central inventory screen with search, filter, sort and bulk stage/owner/area actions.
- Lifecycle pipeline board with the eight fixed stages, drag/dropdown moves, date-stamped stage history
  and a per-record lifecycle timeline.
- Adjustable, dynamic dashboards with the widget library above (ROI, time freed, 3/6/12-month cadence,
  lifecycle throughput, inventory health), shared filters, drill-down, saved layouts, and a
  company-default dashboard.

### Phase 2 — deeper measurement & roll-up
- Richer benefit modeling, portfolio/group side-by-side dashboards, more widget types, and more drill-down
  paths; measurement reminders when a 3/6/12-month checkpoint is due.

### Phase 3 — configurability & reporting
- Per-company configurable stage sets; shareable saved views; exportable dashboard/inventory reports and
  a printable one-page summary.

## Assumptions
- Dashboards are part of the MVP (not deferred) and are adjustable (add/remove/resize/rearrange widgets,
  choose each widget's data, save the layout), dynamic (live data + shared filters + drill-down), and
  aesthetic (light whiteboard charts). A company can publish a default; individuals keep their own copy.
- Documentation is stored as uploaded files in secure private storage with authorized download; there is
  no public access and no hard delete (hidden/soft-removed instead).
- The lifecycle stages are exactly: Discovery, Assessing, Alternatives (configure/build/buy), Offer,
  Approved, In progress, Live, Realized — fixed for all companies this release; per-company custom stages
  are Phase 3.
- The pipeline applies primarily to initiatives and opportunities; other record types remain managed in
  the inventory and their detail editors.
- ROI compares captured cost against expected and realized benefit; "time freed" can be entered as hours
  and optionally valued at a rate to express it in money; realized benefit is captured at 3, 6 and 12
  months after Live. Any missing value leaves ROI/impact marked incomplete, never zero.
- The inventory spans all record types; bulk actions are limited to stage, owner and area to stay safe.
- Existing permissions, company isolation, draft/published snapshots, the framework canvas/views and the
  light theme are preserved; demo content stays clearly labeled.
- No live agent execution is introduced; agents and workflows are represented and managed only.
