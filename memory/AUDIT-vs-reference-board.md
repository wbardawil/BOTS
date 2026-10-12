> Superseded in part: section 0, section 7 and section 8 of this file are replaced by `memory/AUDIT-conducting-ai.md` (2026-10-12). Where the two disagree, that document wins.

# Audit — BOTS vs. the reference board (AI Agent Org Chart / Business Reference Model / AI Development Roadmap / Business Value Chain)

Scope and honesty note: this audit compares BOTS (code on 2026-10-12) with (a) the four-panel
board screenshot and (b) what conducting.ai's own pages say about the product, as summarised by
web search (the domain itself is blocked from the build sandbox, so nothing below was read on the
live site; verify before quoting externally).

## 0. What conducting.ai actually sells (per their pages, via search)
- Format: an editable **FigJam canvas / Figma template** ("AI-Native Company Design", General = beta;
  Ecommerce and Agency = "soon"). Not an interactive software product. The screenshot is that canvas.
- Content: every department (10), every named agent, Phase 1→3 sequencing; industry playbooks
  (Recruitment = 145 agent workflows across sourcing, delivery, BD, contract, compliance); a
  **risk overlay per workflow** (MIT AI risk taxonomy, EU AI Act Art. 22, GDPR, SOC 2, industry rules).
- Wrapper: playbook (~1,000 lessons), quick-wins module, quarterly content refreshes, education
  programmes (AI Champion, Marketing AI Leader; 2026), a marketplace of agencies/experts (beta).
- Price point seen: USD 99/month early access.

Implication for BOTS: their moat is **content and method** (use-case library, risk overlay, playbook),
not software. BOTS already has the software shape they do not (living records, multi-company,
permissions, snapshots). To "replicate what they offer under your name" the gap is: (1) a seeded
use-case/agent library per department, (2) a risk-overlay field set on agents/workflows, (3) the
three-level capability taxonomy below, (4) roadmap templates. The visual language is the easy part.

Legend: ✅ parity · 🟡 partial · ❌ missing · ➕ BOTS has it, board does not

## 1. Operating / agent org chart (board panel A)
| Board element | BOTS today | Gap / action |
|---|---|---|
| Human executive cards → Chief agent node | ✅ `role.type = human_executive / coordination_agent` rendered top-centre | Chief node now an avatar + black pill; add the 3 bullet "what the chief does" notes as `role.data.responsibilities` |
| 9 team columns with named Head of Team avatar | ✅ `FUNCTION_BRANCHES` × `role.type = human_head` | Avatar + name pill (done in restyle) |
| "Information Sharing" links between heads | 🟡 `shares_info` / `coordinates` relationships exist in the data model but the canvas never drew them | Canvas now draws a pill between adjacent heads when such a relationship exists between the two areas |
| AI Team Brains (knowledge base per team) | ✅ `knowledge_source` per area | — |
| Phase 1 / 2 / 3 boxes per team, agents listed PER PHASE | 🟡 BOTS showed a count per phase and an unordered list of 4 agents | Agents now sorted by phase, phase encoded on the chip (P3 dashed); still capped at 5 per column — add "+n more" drill-in |
| Agent tools icon row (SaaS logos) | 🟡 `system` records as text chips | ❌ No logo/icon on `system`. Add `system.data.icon` (simple-icons slug) and render 16px glyphs |
| Employees row (Sales AI Lead, AI Developer, AI Manager…) | 🟡 roles exist, canvas only showed the head | Canvas now lists non-head roles in the area as the Employees row |
| "Last updated" stamp | 🟡 every entity has `updated_at` | Canvas now shows max(updated_at) for the company |
| Legend, Tools grid, Navigation links | 🟡 legend only | Tools grid = systems with icons (above); nav links = jump-to-section controls already exist |

## 2. Business reference model (board panel B) — BIGGEST FUNCTIONAL GAP
| Board element | BOTS today | Gap / action |
|---|---|---|
| 11 numbered areas | ✅ `CANON_AREAS` | — |
| 3 capabilities per area with codes `1.1`, `1.2`, `1.3` | ❌ seed creates ONE `capability` per area | Add `capability.data.parent_id` + `code`; seed a default library of ~33 capabilities |
| 5–6 sub-capabilities per capability, codes `1.1.1 …` (~180 leaf items) | ❌ none | Same hierarchy, level 3. This is the taxonomy that opportunities, agents and playbooks should attach to. Without it the "reference model" is a label, not a model |
| Department Lead + AI Developer per area | 🟡 `role.type = human_head` only | Add `role.type = ai_developer`; show both under the panel header |
| Lead avatar in the area header | ✅ (restyle) | — |

## 3. AI development roadmap (board panel C)
| Board element | BOTS today | Gap / action |
|---|---|---|
| Phase columns | ✅ 3 phases | — |
| Sprint sub-columns (4 / 4 / 3) | ❌ | Add `initiative.data.sprint` (int) and render phase × sprint grid; keep phase-only as the collapsed view |
| Team rows with family colour band | ✅ rows = areas (restyled with family stripe) | — |
| Repeating pattern per team: Co-Pilot → Data organisation → AI Brain → Custom workflows → Training/testing/eval → Autonomous agents → Multi-agent architecture | ❌ seed has one initiative per area | Add a "roadmap template" generator: one click seeds the 7-step pattern per area as draft initiatives. This is the single most valuable feature of the board for a buyer |
| Phase 3 items dashed (future) | ✅ (restyle) | — |

## 4. Business value chain (board panel D)
| Board element | BOTS today | Gap / action |
|---|---|---|
| 4 primary stages | ✅ | — |
| Core functions per stage (4) → outcome node (2) with lead avatar | 🟡 stage shows processes + agents, no outcome nodes | Model outcome nodes as `process` with `data.kind = outcome`; show lead avatar per stage |
| Enabling layer: Tech/Data/Finance/HR, 4 functions + 2 outputs each | 🟡 4 cards with agent counts | Same `process` records attached to the enabling areas |
| Legal/Risk as cross-cutting dashed lane | ✅ | — |

## 5. What BOTS has that the board cannot (the moat if this is a product, not a template)
➕ persistent records with versions and optimistic concurrency · ➕ draft vs published snapshots and diff · ➕ current vs target state · ➕ scoped permissions, multi-company, holding groups, portfolios · ➕ assessments, evidence, phase gates, audit log · ➕ AI-drafted content (labelled) · ➕ JSON export.
None of this is visible on the board. If the pitch is "the board, alive", the UI must surface these on the board itself (e.g. a draft/published toggle that visibly changes the board, a "never reviewed" flag on a chip), otherwise the buyer sees a slower Figma.

## 6. UX / UI (visual language) — resolved by memory/DESIGN.md
Light paper, Inter, hairline borders, function-family hues, circular lead avatars with black name pills, numbered headers, grayscale phases with dashed Phase 3, dot-grid board. The remaining UX gap is density: the board is a 2600px poster; BOTS pages are 1440px screens. Keep the poster for overview/print and make each perspective a readable page.

## 7. Naming / IP flag (decide before launch)
The seed and UI reuse the board's exact phase names (AI Co-Pilots / AI Brains / Autonomous Agents), its 11-area list and its four-panel composition. Generic business-function taxonomies are not protectable; the specific naming, numbering scheme and composition of a published board can be. Rename the phases and the methodology, write your own area taxonomy text, and do not reuse their logo, avatars or name anywhere. (Not legal advice; ask counsel before a public launch.)

## 8. Priority order
1. Capability hierarchy + default library (panel B) — without it there is no "reference model".
2. Roadmap template generator + sprint column (panel C) — the thing a buyer pays for.
3. System icons + chief responsibilities + ai_developer role (panel A polish).
4. Outcome nodes on the value chain (panel D).
