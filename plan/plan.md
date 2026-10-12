# BOTS — Framework Canvas: Saved Layouts, Inline Roadmap Authoring, and Beyond

A set of upgrades that make the Living Framework canvas arrangeable, editable in place, and
shareable — so a company's whole business board can be shaped, published, printed, and compared.

## Who it's for
- Operators and transformation leads who arrange and maintain their company's framework board.
- Company admins and editors who author roadmap detail directly on the board.
- Executives who want a clean one-page poster of the framework to share or present.
- Holding-group and portfolio overseers comparing the same areas across authorized companies.

## Core features and experience

### Phase 1 (built now)

**1. Saved Layouts — drag-to-arrange, shared per company**
- The framework canvas keeps its current reference composition as the default. Users can drag the
  movable pieces into a custom arrangement; anything not moved stays exactly where it is today
  ("keep as much as possible the original layout").
- What can be moved: the four sections (A Operating/Agent Organization, B Business Reference Model,
  C Roadmap, D Value Chain) as whole blocks, and the repositionable cards inside them (functional
  branches in A, the 11 area panels in B, value-chain stage cards in D). Fixed structural scaffolding
  (row labels, section frames, the phase columns of the roadmap matrix) stays put so the board never
  collapses into chaos.
- A visible "layout changed — Save / Reset to default" control appears once anything is moved.
  Saving stores the arrangement for the company; everyone who can edit that company sees the same
  saved board. "Reset to default" restores the reference composition.
- Edit vs read-only is respected: viewers can pan/zoom and open records but cannot move or save;
  only editors/admins can rearrange and save.
- Switching companies loads that company's own saved arrangement (or the default if none saved).
- Snapshots: when a version is published, the layout in effect at that moment is captured with it,
  so a published version keeps its arrangement even if the draft board is later rearranged. The live
  draft layout remains independently editable.

**2. Inline Roadmap Authoring — edit a roadmap cell on the board**
- Clicking a roadmap item (an initiative or agent in a Phase 1/2/3 cell of section C) still opens the
  detail drawer, but the drawer gains a focused "Roadmap" editing area for that item covering:
  - Dependencies: links to other records (initiatives or agents) chosen from a searchable picker, shown
    as removable chips; each links through to that record. No free-text dependencies.
  - Acceptance criteria: an editable checklist (add / edit / check / remove items).
  - Adoption checklist: an editable checklist of adoption tasks tied to the item, each with a state
    (e.g. assigned → in progress → submitted → reviewed → accepted). The board marks items whose
    adoption is incomplete, and keeps "adoption done" visibly separate from "operationally ready".
  - Owner, status, deliverable, and dates remain editable alongside these.
- Edits persist and reflect anywhere that item appears (roadmap cell, org chart, value chain).
- A lightweight "add roadmap item to this area + phase" action lets an editor create a new initiative
  directly into a specific cell without leaving the board.

### Phase 2 (planned, not built now)

**3. Poster Export — one-page printable PDF of the full framework**
- Export the entire board (all four sections, current arrangement) to a single-page, fit-to-page PDF
  suitable for printing or sharing, with the company name, the current/target and draft/published
  context, an "exported on" date, and clear DEMO labeling when demo data is present.
- Honors the same authorization as the existing export (admin-level), and reflects the saved layout
  so the poster matches what people see on screen.

### Phase 3 (planned, not built now)

**4. Group Roll-up — compare the 11 canonical areas across a portfolio**
- A new dedicated comparison view, reached from Group Oversight, that places authorized companies in a
  portfolio side by side against the same 11 canonical areas, showing per-area signals (e.g. agent
  count, phase spread, ownership gaps, assessment coverage).
- Respects existing rules: overlapping portfolio membership is deduplicated, restricted companies are
  withheld (names and counts not leaked), currencies and incompatible metric definitions are kept
  separate, and reporting periods / missing data are shown rather than invented.

## User flow
1. Open a company — it lands on the framework canvas with its saved arrangement (or the default).
2. Drag sections and cards to taste; a "Save / Reset to default" control appears; save to share the
   arrangement with everyone editing that company.
3. Click a roadmap item to open its drawer; add dependency links from a picker, edit acceptance and
   adoption checklists, set owner/status/dates; changes persist and show across the board.
4. Toggle current/target and draft/published as today; publishing freezes the current layout with the
   snapshot while the draft stays editable.
5. (Phase 2) Export the board as a one-page PDF poster.
6. (Phase 3) From Group Oversight, open the roll-up to compare the 11 areas across the portfolio.

## UI/UX feel
- The board keeps the reference's restrained style — white canvas, thin neutral borders, compact cards,
  consistent per-function colors, minimal shadows — with the surrounding BOTS shell staying dark.
- Dragging feels deliberate: pieces snap to a light grid, the rest of the composition holds its place,
  and unsaved changes are obvious with an always-visible Save / Reset control.
- Checklists and dependency chips are compact and in-place; nothing forces a full-screen modal.
- Original BOTS branding throughout; no vendor logo or proprietary text reproduced; demo content stays
  clearly labeled.

## Implementation phases
- **Phase 1 (build now):** Saved Layouts (shared per company, default-preserving, snapshot-aware,
  read-only respected) and Inline Roadmap Authoring (dependency links via picker, acceptance checklist,
  adoption checklist with states, add-item-to-cell).
- **Phase 2 (later):** Poster Export — one-page fit-to-page PDF of the full board.
- **Phase 3 (later):** Group Roll-up — dedicated portfolio comparison of the 11 canonical areas.

## Assumptions
- Saved layouts are shared per company (not per user) and are also captured into published snapshots;
  the live draft layout stays independently editable after a publish.
- The default reference composition is never overwritten — "Reset to default" always returns to it, and
  only pieces a user actually moves are stored as overrides.
- Movable pieces are the four sections and their repositionable cards; structural scaffolding (row
  labels, frames, roadmap phase columns) is intentionally not draggable to protect readability.
- Roadmap dependencies are links to existing initiatives/agents chosen from a picker; free-text
  dependencies are not offered.
- Acceptance criteria and adoption tasks are editable checklists; adoption completion is shown as
  distinct from operational readiness.
- Inline authoring and layout saving require editor/admin access; viewers get pan/zoom and read-only
  record access only.
- Poster Export produces a single-page, fit-to-page PDF (not PNG) and uses the same admin-level
  authorization as the existing export.
- Group Roll-up is a new comparison view entered from Group Oversight, not merged into it and not placed
  inside the Framework Canvas.
- No live agent execution is introduced; agents and workflows continue to be represented and managed only.
- Branding stays "BOTS"; the reference image is used as structural inspiration only.
