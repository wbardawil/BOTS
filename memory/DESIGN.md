# BOTS — Design System (source of truth)

A LIGHT whiteboard theme. Every screen obeys Section 1. Content colour comes ONLY
from the function-family palette in Section 2. Phases are grayscale (Phase 3 dashed).

## Section 1 — Global rules (apply to every screen)
- Background: pure white (#ffffff). No gradients. No glass / backdrop blur. No dark cards.
- Typography: **Inter only** (sans, headings, mono — all Inter).
- Borders: 1px solid #e5e7eb.
- Text: near-black #111827. Secondary text: #6b7280.
- Primary buttons: near-black #111827 background, white text.
- Surfaces/cards: white with a 1px #e5e7eb border and minimal/no shadow.
- Muted surfaces: #f9fafb / #f3f4f6. Accent/hover: #f3f4f6.
- Destructive: red is allowed for destructive actions only.

## Section 2 — Function-family palette (the ONLY content colours)
Used for the 11 canonical areas and the 9 functional branches.
- strategy   #6366f1
- product    #818cf8
- operations #06b6d4
- marketing  #0ea5e9
- sales      #14b8a6
- customer   #10b981
- data       #f59e0b
- tech       #8b5cf6
- finance    #ec4899
- hr         #65a30d
- legal      #ef4444

Everything that is NOT a function family (status, signals, diffs, relationship edges,
roadmap phases) is grayscale: #111827 / #6b7280 / #9ca3af / #e5e7eb.

## Section 3 — Phases
Grayscale only:
- Phase 1: #111827 (solid)
- Phase 2: #6b7280 (solid)
- Phase 3: #9ca3af and **dashed** border
Phase ≠ deployment status.

## Section 4 — Notes
- Keep every data-testid.
- Do not change backend, data model, or tests.
- Demo data stays clearly labeled.
