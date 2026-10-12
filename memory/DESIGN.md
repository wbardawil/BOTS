# BOTS — Design System (source of truth for look & feel)

Any agent or developer touching `frontend/` MUST follow this file. If a change
would contradict it, update this file first, then the code. The reference is an
AI-agent org-chart board (whiteboard / Figma-board aesthetic): white paper,
hairline gray borders, near-black text, one accent hue per function family,
circular lead avatars with a black name pill, numbered capability cards.

## 1. Non-negotiables (anti-drift checklist)
- LIGHT theme only. No dark mode, no navy/charcoal backgrounds, no glow gradients,
  no glassmorphism, no neon teal/cyan accents. Page background is pure white.
- One typeface: **Inter** (400 / 500 / 600 / 700). No display font. Headings are
  Inter 700 with tight tracking. Codes/IDs use the system monospace stack.
- Borders are hairlines: `1px solid #e5e7eb`. Shadows are rare and soft
  (`0 1px 2px rgb(0 0 0 / .05)`). Cards never float with heavy drop shadows.
- Hue carries meaning. Only the *function-family* colors below are used for
  content. Everything else (chrome, buttons, nav, pills) is black / gray / white.
- Primary action color is **near-black** (`#111827`), not a brand color.
- Small type is normal on the board: 10–13px labels are expected, but never below
  10px at 100% zoom.
- Keep `data-testid` attributes exactly as they are when restyling.

## 2. Tokens
Colors (hex → shadcn HSL in `frontend/src/index.css`):

| Token | Value | Use |
|---|---|---|
| paper / background | `#ffffff` | page, cards, nodes |
| board | `#f4f4f5` + dot grid `#d4d4d8` @ 24px | canvas viewport behind the paper |
| ink / foreground / primary | `#111827` | text, black pills, primary buttons |
| muted-foreground | `#6b7280` | secondary text, row labels |
| line / border / input | `#e5e7eb` | all borders, dividers, table rules |
| surface-2 / muted / accent | `#f3f4f6` | hover, nav active, header bands |
| destructive | `#dc2626` | errors only |

Function-family colors (the ONLY content hues):

| Family | Hex | Areas |
|---|---|---|
| leadership | `#111827` | Strategy & Leadership, Chief / executives |
| build (blue) | `#3b82f6` | Product / Service, Operations & Supply Chain, Marketing & Growth |
| revenue (green) | `#22c55e` | Sales, Customer & Admin |
| intelligence (amber) | `#f59e0b` | Data & Analytics, Tech, AI & Automations |
| finance (gray) | `#9ca3af` | Finance |
| people (purple) | `#8b5cf6` | Human Resources |
| governance (slate) | `#6b7280` | Legal, Risk & Compliance |

Tints: fill = hex + `1f` alpha (12%), ring = hex at 100%. Never use the family
hue as text on white below 14px unless it is the darkened variant.

Phases are NEUTRAL (grayscale), so hue stays reserved for function family:
Phase 1 `#111827` solid, Phase 2 `#4b5563` solid, Phase 3 `#9ca3af` **dashed**
border (future / not yet built).

Status: draft = amber-800 on amber-50; in review = blue-700 on blue-50;
published = green-700 on green-50; archived = gray-600 on gray-100.

Radius: cards 10px, chips 6px, pills 999px. Spacing base 4px.

## 3. Component recipes
- **Lead avatar**: 44px circle, family tint fill, 2px family ring, initials or a
  Lucide icon in the family hue; **name pill** below: black `#111827` background,
  white 10px/600 text, fully rounded. Executives: black ring, `User` icon.
- **Function column** (org chart): function name 13px/700 black → lead avatar →
  "knowledge brain" card (amber dot) → three small phase boxes → agent chips →
  system chips → accountable owner (muted). Rows have a right-aligned 10px
  uppercase gray label on the far left of the band.
- **Capability panel** (reference model): header = small family avatar (22px) +
  `"{n}. {Area name}"` 13px/700 black on white, hairline bottom border. Body =
  groups with a code label `"{n}.{g} Group name"` 10px/600 gray, then white chips
  with hairline border; family hue only as the chip's left border.
- **Chip** (any record): white, 1px `#e5e7eb` border, a 3px inset stripe in the family hue on the left (`box-shadow: inset 3px 0 0`), 6px radius,
  11px text `#374151`, hover `#f9fafb`. Warnings are prefixed glyphs in amber.
- **Roadmap matrix**: gray-100 header band; each row has a 4px family stripe at
  the left and the family avatar dot; cells hold white hairline cards; Phase 3
  cards use a dashed border.
- **Value chain**: stage header is a black pill with white text; `›` chevrons
  between stages in `#9ca3af`; supporting functions as outlined cards with the
  family hue as border; governance row dashed slate.
- **Section** on the board: white, 1px `#e5e7eb`, 12px radius, 11px uppercase
  tracking-widest gray label at top-left (e.g. `AI AGENT ORG CHART`).
- **App chrome**: white header with hairline bottom border, black square logo
  mark, nav items 13px; active nav = `#f3f4f6` background + black text.
  Toggles are segmented controls: black active segment, white text.

## 4. Do / Don't
- DO render each of the four perspectives as a full-width readable page in this
  language. The 2640px "poster" canvas is for overview, export and print.
- DO keep hue count per screen low: black + gray + at most the families present.
- DON'T introduce gradients, blur, glow, neon, dark cards, or a second font.
- DON'T color phases with hues; phases are grayscale, areas are hued.
- DON'T invent third-level taxonomy codes (`1.1.1`) unless the data model has
  them; group codes (`1.1`, `1.2`) are the group ordinal inside an area.

## 5. Prompt to paste into Emergent (verbatim)
> Read `memory/DESIGN.md` and apply it to every screen under `frontend/src`.
> This is a LIGHT whiteboard theme: pure white background, Inter font only,
> 1px #e5e7eb borders, near-black #111827 text and primary buttons, no gradients,
> no glass, no dark cards. Content color comes only from the function-family
> palette in DESIGN.md §2 (green = Sales/Customer, blue = Product/Ops/Marketing,
> amber = Data/Tech, gray = Finance, purple = HR, black = Leadership, slate =
> Legal). Phases are grayscale with Phase 3 dashed. Team leads are 44px circular
> avatars with a black name pill. Capability panels have numbered headers
> "1. Strategy & Leadership" and group codes "1.1". Keep every data-testid.
> Do not change any backend, data model or test id while restyling.
