# BOTS — Living Enterprise Framework (Update Plan)

Turn the enterprise framework in the reference image into one living, editable canvas that is the
primary way a company is viewed and managed — all four sections visible together, every record
connected to the data already in the app.

## Who it's for
- Operators and transformation leads who want to see their whole business on one page and manage AI change from it.
- Executives and company admins reviewing current vs target state, phases, ownership, and evidence.
- Holding-group and portfolio overseers who switch between companies, each with its own framework.

## The current mismatch (why this update exists)
Today BOTS presents the framework as separate dark dashboard views (Operating Map, Capability Model,
Value Chain, Roadmap) reached through tabs. The reference image is instead a single dense composition
with four sections laid out together on a white canvas: a full-width operating/agent org chart on top,
an eleven-panel business reference model lower-left, a three-phase roadmap matrix upper-right, and a
value chain lower-right. This update rebuilds that integrated composition and makes it the default
company page, while keeping the existing focused views as readable close-ups.

## Core features and experience
1. **One integrated framework canvas** (the new default company page) showing all four sections at once:
   - **A — Operating / Agent Organization (full-width top band):** phase summaries (AI Co-Pilots / AI
     Brains / Autonomous) on the left; company identity, human executive accountability, and a central
     coordination role in the center; legend, systems/integration categories, and compact navigation on
     the right. Below, aligned functional branches for Sales, Customer & Admin, Marketing & Growth,
     Product / Service Management, Operations & Supply Chain, Data & Analytics, Tech/AI & Automations,
     Finance, and Human Resources — each branch repeating the same layers (functional heading, lead/
     coordinator, knowledge/context resource, three phase branches, specialized workflows/agents,
     systems/tools, human roles & accountable owner) with left-side row labels. Strategy & Leadership is
     represented through the executive/strategic layer; Legal, Risk & Compliance through a clearly
     labeled cross-cutting governance lane.
   - **B — Business Reference Model (large lower-left):** the eleven canonical areas in the exact 4 / 4 / 3
     arrangement with compact numbered ribbon/chevron headings; inside each panel, grouped content
     (capabilities & human responsibilities, AI-supported workflows, knowledge/context & agent
     opportunities).
   - **C — Three-Phase Roadmap (upper lower-right):** a matrix (not a Kanban) with Phase 1 / 2 / 3 columns
     and business-area rows (filterable, all eleven supported); each cell item references an initiative
     with owner, status, deliverables, dependencies, dates, acceptance criteria, adoption requirements,
     evidence, and approval decision.
   - **D — Business Value Chain (lower lower-right):** primary stages (Strategic Planning & Leadership →
     Product & Operations → Marketing & Sales → Delivery & Customer Support) with process cards and
     directional handoffs, plus supporting functions (Tech/AI, Data & Analytics, Finance, HR) and Legal,
     Risk & Compliance shown as a cross-cutting governance relationship.
2. **Canvas navigation:** pan and zoom, "Fit entire framework" (overall composition resembles the
   reference), and "Fit selected section" (that section's text and records become readable). Explicit
   default layout coordinates so the composition matches the image rather than relying on auto-layout.
3. **Eleven canonical business areas** with fixed IDs, numbering, and order (Strategy & Leadership;
   Product / Service Management; Operations & Supply Chain; Marketing & Growth; Sales; Customer & Admin;
   Data & Analytics; Tech, AI & Automations; Finance; Human Resources; Legal, Risk & Compliance). All
   eleven are first-class and support capabilities, ownership, assessments, current/target state,
   opportunities, agents/workflows, systems/knowledge, playbooks, initiatives, phases, adoption, metrics/
   evidence, risks/decisions, and history. An area can be marked "not applicable" with rationale but never
   silently disappears.
4. **Connected records, not a picture:** one agent or process can appear in several sections; editing its
   underlying record updates every live representation. Selecting any record opens a right-side detail
   drawer (Overview, Ownership, Workflow, Playbook, Initiative, Evidence, History) without navigating away
   or losing canvas position.
5. **State and mode controls:** current/target selector, draft/published selector, read-only vs edit mode,
   search, filters, highlight-related-records, and save indicators — carried over and wired into the canvas.
6. **Living-model signals on the canvas:** unassigned owners, missing prerequisites, and last-reviewed
   dates are visible in place.
7. **Per-company frameworks:** switching companies loads that company's own areas, records, saved layout,
   and progress — never one hard-coded framework for everyone. Holding/group and portfolio behavior
   (shared services, cross-company initiatives, deduplicated portfolio membership, authorized summaries)
   is preserved.
8. **Focused secondary views retained:** the existing Operating Map, Capability Model, Value Chain, and
   Roadmap remain available as close-ups of the same records.

## User flow
1. Sign in and pick a workspace and company (unchanged).
2. The company opens on the integrated framework canvas, fit to show the whole composition.
3. Zoom or use "Fit selected section" to read a section; search/filter/highlight to find related records.
4. Click any node, panel, or roadmap item to open the right-side drawer; review or edit in place.
5. Toggle current/target and draft/published; edits persist and reflect across every section they appear in.
6. Publish a snapshot to freeze a version; switch companies to see distinct frameworks.

## UI/UX feel
- The framework canvas uses the reference's restrained style: white canvas, thin neutral borders, compact
  cards, dark text, consistent per-function colors, orthogonal connectors, minimal shadows, minimal
  gradients, readable text when zoomed into a section.
- The surrounding app shell (header, workspace/scope switchers, left navigation) stays in the current dark
  BOTS theme, so the white framework reads as the focal "board" inside the product.
- Original BOTS branding throughout; no vendor logo, proprietary text, or invented unreadable screenshot
  content. Demo content is clearly labeled.

## Implementation phases

### Phase 1 — MVP (built now): visual reconstruction + live wiring
- The full four-section integrated canvas on white, matching the reference composition, as the default
  company page, with "Fit entire framework" and "Fit selected section".
- The eleven canonical areas migrated from existing records (content, owners, relationships, initiatives,
  and history preserved; ambiguous mappings flagged; customer department names not renamed).
- Northwind fully populated to resemble the reference density; other companies show the same structure
  with lighter demo content.
- Record selection → right-side drawer (Overview, Ownership, Workflow, Playbook, Initiative, Evidence,
  History); in-place editing that persists after reload and updates shared records across live views.
- Current/target, draft/published, read-only/edit, search, filters, highlight-related, and save
  indicators wired to the canvas; published snapshots remain unchanged; existing permissions and
  customer isolation preserved; company switching loads distinct data.
- Existing focused views kept as secondary close-ups.

### Phase 2 — richer authoring and fidelity
- Editable default layout templates per company size (compact / enterprise / group) and drag-to-arrange
  with saved coordinates per section.
- Deeper roadmap cell authoring (dependencies graph, acceptance criteria and adoption checklists inline),
  and governance-lane editing for Legal/Risk across functions.
- Printable / exportable "poster" of the full framework.

### Phase 3 — oversight and scale
- Group/portfolio framework roll-ups that compare the same canonical areas across authorized companies.
- Cross-company shared-service initiatives surfaced on each company's canvas.
- Optional full light-theme shell to match the reference everywhere (if desired after review).

## Assumptions
- Theme: the framework canvas renders light/white while the app shell stays dark (the recommended option);
  a full light-theme app is deferred to Phase 3 and can be pulled forward on request.
- The integrated canvas becomes the default company landing; the four existing views remain as secondary
  close-ups rather than being removed.
- Northwind is populated to reference-like density; all other companies get the same eleven-area structure
  with lighter, clearly-labeled demo content.
- Area migration maps existing records to the eleven canonical IDs and display names, preserving all
  content/owners/relationships/initiatives/history, flagging ambiguous cases rather than guessing, and not
  renaming any customer's own department names.
- Branding stays "BOTS"; the "Conducting AI" logo and any proprietary/unreadable text from the image are
  not reproduced — original starter content is used instead.
- No live agent execution is introduced in this update; agents/workflows are represented and managed only.
- Default layout uses explicit coordinates for the reference composition; auto-layout is not relied on to
  achieve the match.
- The nine functional branches in the top band follow the reference (Strategy via the executive layer,
  Legal/Risk via a governance lane); eleven equal department columns are intentionally not forced into the
  upper chart.
