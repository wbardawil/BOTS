# SERVICE-flagship: engagement blueprint and BOTS build backlog

2026-10-12. Sources: service-brief.md, PRD.md, AUDIT-conducting-ai.md, DESIGN.md, code at HEAD 3100ac9. Every day, hour and peso figure is an estimate until logged on client 1. Credential values are never copied here; only their locations.

## 0. The offer

"Mapa Vivo de Transformación": one legal entity's leadership team gets, in 10 working days inside about four calendar weeks from signature (two-week data window, then the 10 days), a technology inventory (XLSX with owner, cost in MXN, API/MCP facts), an A1 poster of its operating map, and a signed verdict table placing every captured initiative, pain point and slow task in one of five buckets (ya lo tienes / configurar / comprar / construir / no es tecnología) with owner and cost band. All captured items (target 40, contract cap 60) get a consultant bucket on Day 8; the 12-15 that leadership ranks highest are validated live in a 3-hour session and leave with owner, stage `approved` and `target_date`; the rest stay at stage `assessing`, flagged "pendiente de validación" in the XLSX. Everything is frozen as a published BOTS snapshot. Fixed fee MXN 240,000 plus IVA (estimate; MXN 150,000 founding price for clients 1-3 against a named case study). Proof metric: cobertura de decisión, the share of the validated-live set (denominator: the 12-15, not the 40) leaving the session with bucket, owner, stage and target date; target 100%. Brief bullets 4-5 become inventory data and consultant-signed, AI-assisted verdicts, never connectors or autonomous agents.

## 1. Engagement plan

### 1.0 Calendar from today to client 1 (dates are targets, estimate)

| Date | What | Who |
|---|---|---|
| Mon 12 Oct - Fri 16 Oct | Backlog items 0, 14, 15, 16 (developer, about 2 days); items 1, 2, 6, 7 (AI builder); abogado/contador drafts the mutual NDA and the aviso de privacidad (3-5 working days, MXN 8,000-15,000 one-off, estimate); founder writes a target list of 10 companies | developer, AI builder, founder |
| Mon 19 Oct - Fri 23 Oct | Items 3, 4, 5, 8, 9, 10, 11, 12, 13; item 17 (deploy client-1 instance); proposals 1-3 sent (Appendix A) | AI builder, developer, founder |
| Mon 26 Oct | Dry run on Arkiva's own data, end to end: new_client.py, load_csv.py, Section F, print, export_xlsx.py (item 18, 1 day) | founder, developer |
| Tue 27 Oct - Fri 30 Oct | Fix list from the dry run; proposals 4-6 if no yes yet | developer, founder |
| by Fri 6 Nov | Day 0: signature client 1; first invoice, 50% (MXN 75,000 plus IVA at founding price); NDA, aviso and access checklist signed; `new_client.py` run | founder |
| Fri 20 Nov | Data cut-off (Mon 16 Nov is a statutory holiday inside the window) | client |
| Mon 23 Nov - Fri 27 Nov | Days 1-5, remote | consultant |
| Mon 30 Nov - Tue 1 Dec | Days 6-7, on-site | consultant |
| Wed 2 Dec | Day 8, classification | consultant, IT lead |
| Thu 3 Dec | Day 9, 3-hour session | leadership |
| Fri 4 Dec | Day 10, hand-off; second invoice | consultant |
| Mon 4 Jan 2027 | Day 40: `new_client.py --revoke` (viewer memberships deleted) | consultant |
| Thu 4 Mar 2027 | Day 100: `new_client.py --purge` (client DB dropped) unless a retainer is signed | consultant |

Sales motion: founder-led direct, from Arkiva's own network in the industry it already serves (verify; not a client fact). Target profile: revenue above about MXN 300M (estimate, §9.5), one legal entity, CEO or COO reachable, 6+ area heads. Six proposals, one signature expected (close rate about 1 in 6, estimate). Arkiva as client 0 is the dry run, not a case study.

### 1.1 Per-engagement calendar

Signature (Day 0) → access checklist sent the same day (§2) → data cut-off 10 working days later → Day 1 is the next Monday. Days 1-3 build the sheet from a ledger already received; no engagement starts without the Tier A inputs in hand. Elapsed time: about four calendar weeks; billed scope: 10 working days.

Consultant effort on client 1: 7 days (estimate): half days 1, 2, 3, 4, 5 and 10; full days 6, 7, 8 and 9 (Day 9 is the 3-hour session plus preparation and notes). Clients 2-3: 6 days (days 3 and 5 shrink). From client 4: 5. Contested: the mentor wants a 60-min readout plus artefacts, the engagement lens a 3-hour working session; 3 hours wins because the signed verdict table needs the room's decisions.

| Day | Consultant does | Client provides | BOTS screen / artefact |
|---|---|---|---|
| 0 | Entry criteria signed (Day 9 slot with 6+ area heads, Tier A data by the cut-off, NDA, aviso, one legal entity); sends the access checklist (§2); runs `new_client.py` (org, memberships, capabilities, roles, Spanish stage labels) | Signature; IT counterpart; 50% invoice paid | Org, memberships, capabilities, roles by script (no org CRUD, server.py:62-81) |
| 1-3 remote | DNS scan; alias list; systems sheet from the AP ledger and card statements (Appendix C1) | Already delivered at cut-off: licence list, 12 months of AP and card statements, org chart, IdP export | Systems sheet v0 |
| 4-5 remote | `load_csv.py` loads systems and roles (area validated client-side); bulk Tag area for strays (Inventory.jsx:116) | Pre-ranked top 15 initiatives (template) | Inventory filtered to `system` |
| 6 on-site | 90-min leadership interview (Appendix B1); 45 min each with IT lead and controller | CEO/COO, IT lead, controller | Paper grid |
| 7 on-site | Six to nine 45-min area-head interviews (Appendix B2); evening load by script (Appendix C2) | Area heads | Pipeline Discovery column |
| 8 | Classifies every record (section 5); Assessment, Unknown kept unknown (server.py:449-483); Arrange + Save; verdict check with the IT lead | IT lead, 60 min | Feasibility tab; Section F; Assessment |
| 9 on-site | 3-hour session: A1 walk, assessment, 12-15 verdicts validated live (rest parked at `assessing`), owners + stage `approved` + `target_date`, 1-3 metrics | Leadership, 6+ heads | Framework Canvas, Mapa de viabilidad, Executive Overview, Pipeline |
| 10 remote | Publish (server.py:358-380; flips drafts to published); `export_xlsx.py`; print-to-PDF; memo; hand-off; viewer memberships by script | Email confirmation | Snapshot, PDF, XLSX, memo |
| 40 / 100 | `--revoke` viewer memberships / `--purge` the client DB unless retainer (retention stated in the aviso; LFPDPPP deletion duty is an inference, not legal advice) | | |

Rejected: a 5-day on-site week (its own schedule had 3 on-site days; no classification prompt exists, ai.py:28-35); "edit live or it degrades to a slide deck" (the record typed that evening is identical).

## 2. Deliverables

| Artefact | Produced by | Today |
|---|---|---|
| Propuesta / SOW (Spanish, one page) | Appendix A | written here |
| Checklist de accesos (Day 0) | table below, sent with the signature | written here |
| Inventario tecnológico, registros and tabla de veredictos (XLSX) | `scripts/export_xlsx.py` over the admin JSON export (server.py:564-574), column orders of Appendix C | missing: script is item 13 |
| Mapa visual A1, board A-D | Framework Canvas, browser print-to-PDF (~88 dpi at A1; caps raised in item 12) | partial: no `@media print`, no image export |
| Iniciativas por área y fase | Section C and Roadmap table after item 11 (today both load only `initiative` and `agent`, FrameworkCanvas.jsx:362, Roadmap.jsx:24-25); the poster shows the top 3 per cell with "+n más", the full list is Section F | partial |
| Matriz de viabilidad | Section F page (section 6) | missing: item 9 |
| Costo del plan | Executive Overview cost card (ExecutiveOverview.jsx:99-132); counts agents and workflows only (:31), so it reads empty on client 1; stack cost lives in the XLSX | partial: USD (:152), item 4 |
| Diagnóstico, decisiones, métricas | Assessment; stage `approved` (owner-gated, server.py:687-697); metric records | exist |
| Memo ejecutivo (Spanish) | consultant; `/ai/suggest` executive_update as draft | partial (needs the item 16 key) |
| Snapshot + 30 days viewer access | Publish; memberships by script; `--revoke` on Day 40 | partial: no membership UI |

Checklist de accesos (sent on Day 0; fecha de corte = 10 working days after signature):

| Insumo | Formato | Responsable | Fecha límite | Tier |
|---|---|---|---|---|
| Auxiliar de cuentas por pagar, 12 meses (proveedor, concepto, monto, fecha, área que solicita) | XLSX o CSV | Controller | corte | A |
| Estados de cuenta de tarjetas corporativas, 12 meses | CSV o PDF | Controller | corte | A |
| Lista de licencias y contratos de software vigentes (proveedor, plan, usuarios, costo, vencimiento) | XLSX | TI | corte | A |
| Organigrama con nombre del responsable de cada área | PDF o XLSX | RH o Dirección | corte | A |
| Exportación de aplicaciones del IdP (Google Workspace, Microsoft 365 u Okta), 1-2 h con el consultor | CSV | TI | corte | A |
| 15 iniciativas pre-rankeadas por Dirección (plantilla Arkiva) | XLSX | CEO/COO | día 5 | A |
| Agenda: día 6 (CEO/COO 90 min, TI 45, controller 45), día 7 (6-9 responsables, 45 min cada uno), día 9 (3 h, 6+ responsables) | calendario | Asistente de Dirección | firma + 5 días | A |
| Exportaciones de consolas de administración: usuarios y módulos del ERP, objetos e integraciones del CRM, reportes de uso de Microsoft 365 o Google, inventario de automatizaciones (Zapier, Make, Power Automate) | CSV | TI con el consultor, 2 días adicionales | corte | B (+40,000) |

## 3. Technology inventory and MCP/API capture

Sources, ranked for a CEO who reads money first: AP ledger and card statements (12 months, delivered at the data cut-off, §1.1); area-head interviews, 8 fixed questions (Appendix B2, the only source for Excel, WhatsApp, on-prem ERP, owners, shadow tools); IdP app export with the admin, 1-2 h; DNS and website scan, 15 min. Rejected: three sources in one day (own budget 8-12 h); a 40-key schema; a 60-vendor table in 5 h.

Expected volume on client 1: 25-45 `system` records (estimate: 20-40 SaaS tools for a mid-size company plus the ERP, the spreadsheets and the messaging channels recorded as systems). That exceeds the Section A strip cap of 12 (FrameworkCanvas.jsx:242) and the per-branch cap of 3 (:302) on the first client; item 12 raises them.

Sheet headers are the data keys (Appendix C1). "Name and `area` required, `area` in CANON_KEYS (seed.py:25-26)" is a loader rule: `load_csv.py` rejects the row; the server validates only the etype (POST /entities, server.py:116-137) and bulk Tag area writes any string (server.py:739-740), so stray areas would show as extra rows on Section F.

`system` fields to add (today only `{name, type, verified_integration}`, seed.py:176-178; the create dialog has name and type, EntityTable.jsx:21): `vendor`, `system_kind` (not `type`: SELECT_FIELDS is global), `category`, `area`, `owner`, `usage_status`, `criticality`, `cost_estimate`, `cost_period`, `currency`, `api_available` (yes | no | partner_only | unknown), `auth_type`, `mcp_status`, `api_docs_url`, `mcp_url`, `data_domains`, `data_sensitivity`, `last_verified_at`, `verified_by` (positive API/MCP values need a URL and `last_verified_at`). The loader writes every key on every row, empty when unknown, because the drawer edits only keys already present (DetailDrawer.jsx:167, :191); an Integration tab with an explicit key list is mandatory. System costs roll up nowhere (server.py:888; ExecutiveOverview.jsx:31); stack cost lives in the XLSX.

Automated in week one: scan, alias merge, loader (auth.py:96 login, server.py:116). Manual: interviews, owners, criticality, docs-URL checks. No live connection to client systems is possible (PRD.md:124-125).

## 4. Leadership intake

Protocol: 90-min leadership interview (Day 6, Appendix B1), then 45 min per area head (Appendix B2) timeboxed 5 frame / 8 systems (the 8 fixed questions) / 12 initiatives / 10 pain points / 7 slow tasks / 3 ranking, one `urgency = now` per executive; 5-10 items per head (estimate). Mandatory: name, area, raised_by; owner optional at discovery (ungated, server.py:590), since "nobody owns this" is a finding; blanks stay blank. Recordings are opt-in (employee names are personal data under LFPDPPP; inference, not legal advice), processed outside the app, and stay out of BOTS until storage leaves Emergent (storage.py:5).

Fields (one data key each): `kind` {initiative, pain_point, slow_task}, `raised_by`, `area`, `owner`, `intended_outcome`, `current_approach`, `systems_touched` (comma text, linked to systems by script), `blockers`, `effort_today_hours`, `effort_period`, `frequency`, `urgency`, `data_involved`, `data_sensitivity`, `source`, `source_ref`, `captured_at`, `quote`. Landing record: `opportunity`, `stage: "discovery"`, `candidate_phase` (1-3, the consultant's first read, needed for Section C), `stage_history` in the server.py:690-691 shape ({stage, at, by, note}); `initiative` only when already running with owner and budget, and then with "how it is working" (brief bullet 3) in four keys: `health` {on_track, at_risk, blocked} as leadership states it, `percent_complete`, `started_at`, `last_milestone`. Stage stays the delivery signal; health is leadership's own read, captured verbatim.

Additions (S, 40-50 lines): CREATE_FIELDS.opportunity (EntityTable.jsx:16) gains owner, area and the keys above; CREATE_FIELDS.initiative (:24) gains the four health keys; enums into SELECT_FIELDS and `effort_today_hours`, `percent_complete` into NUMERIC_FIELDS (constants.js:139-147); `stage_history`, `feasibility_draft`, `cadence` into HIDE_KEYS (DetailDrawer.jsx:158; `fmt` at :736-740 stringifies objects, so a dict renders as "[object Object]"); `opportunity` in the Sourcing & Risk gate (DetailDrawer.jsx:37); RoadmapTab candidates (:451) widened to system, process, capability. Deferred: bulk intake endpoint, Intake page (M). Rejected: "sensitivity exists on opportunities today" (hidden, :37, :193); "six executives in one day, no tooling" (roles need a script).

## 5. The classification agents

Rubric, in order, first pass wins:

| Bucket | Observable test |
|---|---|
| not_tech | persists if the tool were free tomorrow: owner, decision rights, policy, sequencing |
| existing | an active system already does it; gap is training or permission |
| configure | an active or licensed system reaches it by module, rule, template, native AI feature or a no-code connector over `api_available: yes` or MCP |
| buy | no inventory system covers it; a vendor category does, cheaper than building |
| build | needs a repository and a developer, or the data sits behind `api_available: no` |

Output fields: `feasibility_draft` (class, enabling_system_ids from the inventory only, missing_capability, effort_band {days, weeks, months}, cost_band, confidence, rationale, questions, prompt_version, input_hash, accepted: false); on acceptance the same keys top-level plus `licence_tier`, `evidence`, `feasibility_source` {ai_accepted, ai_edited, human}, `feasibility_reviewed_by`, `feasibility_reviewed_at`. `cost_band` is a band, not a number: {none, under_50k, 50k_250k, 250k_1m, over_1m, unknown}, MXN, first 12 months, licences plus implementation (estimate). It is never summed; Section F counts per band (§6). Contested: extend SOURCING with `existing`/`configure`, or keep feasibility separate since the cost card counts only agents and workflows (ExecutiveOverview.jsx:31) and `buy` already means configure (constants.js:125); separate wins.

Provider for client 1 (item 16): OpenAI through its official SDK with a key Arkiva holds, model gpt-4o-mini, the model ai.py:55 already pins, so the six prompts are untouched; `_provider_ready()` reads the new env key and `/ai/status` returns `provider: "openai"` (ai.py:13-19; the drawer reads only `enabled`, DetailDrawer.jsx:345). Tokens per classification (estimate): about 2,500 input (35 systems as one line each, the record, the rubric) and 300 output; 40 records with two reruns each is about 340k input and 36k output per engagement; cost under MXN 50 at that model's list price and under MXN 200 at any frontier-tier price (estimate; verify on the provider's price page the week of the swap). The call sits behind one function so a later provider change is one file.

Batch: client 1 has no endpoint; the consultant classifies in the drawer with `/ai/suggest` as second opinion (ai.py:25 has no context cap; DetailDrawer.jsx:352's 1,500-character slice is UI-only and does not carry the inventory). Client 2 gets `POST /api/ai/classify` (M): `require_write`, 422 without API-tagged systems, inventory plus records in one prompt, validated JSON, idempotent by `input_hash`, writes only `feasibility_draft` and an audit row.

Review on Day 8, lowest confidence first: Accept / Edit / Reject via `PUT /entities/{id}` with `version`; no verdict without a named covering system or a named reason none exists. Containment: drafts never touch top-level fields; unsigned classes render dashed BORRADOR IA, never solid on a snapshot; the IT lead checks every verdict before leadership sees it; agreement is logged on client 1, no percentage quoted before. Rejected: "70% agreement" (nothing to measure); "prompt-only S" (ai.py:43-44 rejects unknown kinds, no write-back); a 50% `business_problem` gate (16 of 19 Northwind records lack it, seed.py:346-347).

## 6. The visual deliverable

Reuse: Framework Canvas A-D with Arrange + Save, Section C's area-row recipe (FrameworkCanvas.jsx:361-386), Roadmap table, Pipeline, Inventory, Assessment.

Section A row mapping for client 1 (ROW_LABELS FrameworkCanvas.jsx:17; cells :256-313), a client with zero agents:

| Row today | Client 1 label | Source after item 3 |
|---|---|---|
| Team | Área | FUNCTION_BRANCHES, 9 fixed (constants.js:109-119) |
| Head of team | Responsable | `role` type human_head per area, from the org chart (item 1) |
| AI team brain | Base de conocimiento | `knowledge_source` per area only when an interview names one (manuals, SharePoint, drive); else ghost "sin base documentada" |
| Phases | Fases | counts of `opportunity` + `initiative` by `candidate_phase` / `phase` (today agents only, :290) |
| Individual agents | Iniciativas y dolores | `opportunity` + `initiative` sorted by phase, top 5 plus "+n más" (today agents only, :260, :296) |
| Agent tools | Sistemas | `system` per area, top 5 plus "+n más" (today 3, :302) |
| Employees | Otros roles | other `role` records, 2 (:307) |
| Accountable | Responsable ejecutivo | lead.accountable_owner (:312) |

Executives strip (:213) shows `role` type human_executive; the "Chief agent" slot (:218-222) renders a Bot avatar even with no record, so item 3 hides it unless a coordination_agent exists. Legend (:233) and the phase boxes (:197-207) take the renamed phases.

Add for client 1: `@media print` (paper at scale 1, A1 page size), S; Section C and the Roadmap table include `opportunity` by `candidate_phase` (:362; Roadmap.jsx:24-25), cap 3 per cell kept with a "+n más" line because RECTS.C is 560 px tall (:14) and growing rows would run into D, S; caps raised (item 12): strip 12 → 24 plus "+n más", branch systems 3 → 5 plus "+n", Section B Opportunities group 4 → 6 (:497), S; a full-width "Mapa de viabilidad" page via MAIN_TABS (constants.js:46-56) and one Shell branch (Shell.jsx:40 pattern): Section F, rows the 11 areas plus "Sin área" (only loader-validated areas reach it, §3), columns the five buckets plus "Sin clasificar", chips with stage and a BORRADOR IA tag while unsigned, rows grow, no caps, footer with counts per `cost_band` and a "sin banda" count (no MXN sum: `cost_band` is a band and intake records carry neither `cost_estimate` nor `budget`, so server.py:915 would read 0 with "40 uncosted"), S-M. Before client 2: Section T inventory map (reachability bands derived from `api_available`, `mcp_status`, `verified_integration`), PNG export, Letter one-pager, Present mode. Deferred: poster composition inside the 2640×2060 paper, server-side export, density switch, Published view.

Export for client 1: browser print-to-PDF; A1 is legible (fit is limited by the short side: 594 mm / 2060 px = 0.288 mm per px, so 10 px is about 2.9 mm and the board prints at about 88 dpi), Letter is not. Rejected: a second composition on fixed RECTS (no export path); "~110 dpi at A1" (~88); dashed borders for closed systems (DESIGN.md:52-53).

## 7. Build backlog, ordered for engagement 1

AI builder: S items, no new route. Developer: routes, vendor swaps, credentials, hosting.

| # | Item | Size | #1 | Who |
|---|---|---|---|---|
| 0 | Credentials and control sweep, AUDIT §8 step 1. Done at HEAD 3100ac9: reseed guard (server.py:582-583 ALLOW_DEMO_RESEED; seed.py:84-86 deletes only `is_demo: true`), seed_admin fails closed (seed.py:50-56), index.html title "BOTS" with no third-party script or telemetry. Open: backend/tests/test_iteration6.py:14-16 and test_iteration7.py:14-15 embed the platform-admin email and password and demo passwords; test_iteration7.py:17 embeds a cron secret literal (server.py:1112 reads it from env); rotate all and read from env as backend_test.py:9-12 does; backend_test.py:6 and test_phase1_lifecycle.py:7 default BASE_URL to a *.preview.emergentagent.com host, default to localhost; vendor test ids (frontend/src/constants/testIds/auth.js:12, home.js:5); .emergent/crons.yml schedule moves to Arkiva's scheduler, the endpoint stays (server.py:1197). Before any client data | S | yes | developer |
| 1 | `scripts/new_client.py`: org (`currency: "MXN"`, `industry`), memberships, capabilities, one `role` per executive, Spanish stage labels via PUT /organizations/{id}/stages (server.py:640); `--revoke` deletes viewer memberships (seed.py:111-113 shape; access.py:26-31 reads them); `--purge` drops the client DB | S | yes | AI builder |
| 2 | `scripts/load_csv.py`: login, POST /entities per row writing every key, POST /relationships from `systems_touched`; rejects rows without name or with `area` outside CANON_KEYS (seed.py:25-26) | S | yes | AI builder |
| 3 | Rename + Spanish strings + client-1 row mapping (§6 table; hide the chief slot): phases (constants.js:81-89, seed.py:17-21, Roadmap.jsx:11), nav labels (constants.js:46-56), board titles, rows, legend, ghosts and page header (FrameworkCanvas.jsx:17, 160-165, 194-240, 284-312, 339-346, 358-359, 404-439, 447), Executive Overview strings (ExecutiveOverview.jsx:54-55, 58-59, 64-67, 71-74, 78-79, 87, 101-107, 118, 131), AI tag text (shared.jsx:40 → "BORRADOR IA"), `<html lang="es-MX">` (index.html:2). Pipeline column labels come from the org's `pipeline_stages` (item 1); other Pipeline.jsx chrome: verify, not read. Stays English on client 1: drawer tab names and stage toasts (DetailDrawer.jsx:19-20, 36-38, 581, 624; the consultant drives the drawer, it is not projected), Metrics & Evidence page (metrics are presented in the memo) | S | yes | AI builder |
| 4 | Currency in `money()` from the org, no mixed sums (ExecutiveOverview.jsx:148-152) | S | yes | AI builder |
| 5 | Print stylesheet + stamp strip (company, Draft/Published, date) | S | yes | AI builder |
| 6 | `system` keys, SELECT/NUMERIC/CREATE_FIELDS, Integration tab | S | yes | AI builder |
| 7 | Intake keys, `candidate_phase`, health keys, enums, HIDE_KEYS (`stage_history`, `feasibility_draft`, `cadence`), Sourcing & Risk gate, RoadmapTab candidates | S | yes | AI builder |
| 8 | FEASIBILITY vocab and `cost_band` enum, label cases, Feasibility tab with Accept / Edit / Reject | S | yes | AI builder |
| 9 | Section F page with band-count footer | S-M | yes | AI builder |
| 10 | `lfpdppp` in REGULATORY_FLAGS (constants.js:137) | S | yes | AI builder |
| 11 | Section C and Roadmap table include `opportunity` by `candidate_phase`, "+n más" line per cell (FrameworkCanvas.jsx:362, 372; Roadmap.jsx:24-25) | S | yes | AI builder |
| 12 | Raise caps: strip 12 → 24 (:242), branch systems 3 → 5 (:302), Section B Opportunities group 4 → 6 (:497), each with "+n más" | S | yes | AI builder |
| 13 | `scripts/export_xlsx.py`: login as company_admin, GET /organizations/{id}/export (server.py:564-574), sheets Sistemas, Registros, Veredictos in the Appendix C column orders plus Resumen (counts per bucket, band and area); pandas is in requirements (requirements.txt:23), openpyxl is the script's own dependency | S | yes | AI builder |
| 14 | `SEED_DEMO=false` guard at startup (server.py:1245): call `seed_admin()` unconditionally (today it runs only inside `seed_demo`, seed.py:79), then `seed_demo()` only when SEED_DEMO is true; without it a fresh per-client DB receives the Northwind, Atlas and Meridian workspaces on first boot (seed.py:80-82 checks only the marker) | S | yes | developer |
| 15 | Remove @emergentbase plugins (package.json:89-90; vite.config.mjs:6, 25, 50) | S-M | yes | developer |
| 16 | LLM swap: emergentintegrations (ai.py:52-55, requirements.txt:28) to the official OpenAI SDK with Arkiva's key, same model (§5); `/ai/status` provider string | S-M | yes | developer |
| 17 | Deploy the client-1 instance: one backend process per client (db.py:5 reads one DB_NAME per process); target (estimate, decide before Oct 23): one small VM or container at a provider with a Mexico or US region, MongoDB Atlas M10 with daily backup (or a Mongo container with a nightly dump to object storage), TLS through the host's managed certificate or a reverse proxy, env holds ADMIN_EMAIL, ADMIN_PASSWORD, SEED_DEMO=false, the LLM key, WEBHOOK_CRON_SECRET; cost MXN 1,500-3,500 per month per instance (estimate). Data residency in Mexico is not required by LFPDPPP as read (inference, not legal advice); the aviso names the region | S-M | yes | developer |
| 18 | Dry run on Arkiva: items 1-13 end to end (new_client.py → load_csv.py → Section F → print → export_xlsx.py), 1 day | 1 day | yes | founder, developer |
| 19 | `POST /api/ai/classify`, gate, review queue, gold set; CSV import/export routes | M; S-M | no | developer |
| 20 | Section T, PNG export, one-pager, Present mode | S-M | no | AI builder |
| 21 | Storage and email off Emergent (storage.py:5, email_util.py); bulk intake + Intake page; density switch + Published view; org CRUD + membership UI | M each | no (gated) | developer |

Items 0-17: about 5 developer days (estimate), plus the 1-day dry run. Freeze the product during each engagement.

## 8. Pricing and packaging

Estimates to verify locally. Fixed fee plus IVA, 50% at signature, 50% at hand-off; invoice as persona moral if possible (a persona física invoicing a company triggers ISR and IVA withholding; confirm with a contador).

| Line | Price (MXN) | Scope |
|---|---|---|
| Mapa Vivo | 240,000 | 10 working days inside about 4 calendar weeks, one legal entity, up to 9 area heads, 40 items captured (cap 60), 12-15 validated live, poster + XLSX + memo + snapshot, 30 days viewer access |
| Founding price, clients 1-3 | 150,000 | same, for a named case study |
| Grupo | from 350,000 + 90,000 per extra company | 2-4 companies, portfolio oversight |
| Acceso Tier B | +40,000 (+2 days) | admin-console exports loaded by the consultant |
| Acompañamiento | 60,000-90,000 per month, 3-6 months | 2 days per week, phase gates with evidence; where BOTS earns |
| Refresco trimestral | 45,000 per quarter | re-interview, re-classify, republish, diff as proof |
| Hosting beyond 30 days | 6,000 per month per company | cost recovery at 2-4x the item 17 estimate, never SaaS |

Effective rate at list: MXN 34,000-40,000 per consultant day (7 to 6 days), inside the senior-independent range; founding price: MXN 21,000-25,000 per day (estimate). Cost side (estimate): developer MXN 10,000 per day (senior freelance, Mexico; verify) × 5 days = 50,000 one-off, spread over clients 1-3 ≈ 17,000 per client; hosting 2 months ≈ 5,000; NDA and aviso one-off 8,000-15,000 spread ≈ 4,000; LLM under 200; A1 print about 500. Clients 1-3: direct cost about 27,000, contribution about 123,000, about MXN 17,500 per consultant day. From client 4 at list: direct cost about 6,000, contribution about 234,000, about MXN 39,000 per day. Out of scope, in writing: implementation, vendor negotiation, connecting BOTS to client systems, autonomous agents, legal advice, process redesign, training, a second legal entity, extra seats.

## 9. Challenged assumptions

1. Shortest time and flagship coexist. Only if bullets 4-5 become data and signed verdicts. Decision: 3-hour session plus three artefacts, 10 working days in about 4 calendar weeks, one person; nothing promised that needs unwritten code.
2. Clients grant IdP, finance and API access in week one. Often not (inference), and BOTS cannot hold it. Decision: Tier A default, Tier B priced, the Day 0 checklist (§2) names format, owner and deadline; NDA and aviso de privacidad produced once by Arkiva's abogado/contador (MXN 8,000-15,000, 3-5 working days, estimate) and signed before Day 0; both are pre-engagement documents, not product features.
3. "Run agents" is a feature. Six prose prompts, no write-back (ai.py:28-67). Decision: "asistida por IA, firmada por el consultor"; `feasibility` keys now, endpoint after client 1.
4. The platform is the differentiator. Client 1 buys a decision; BOTS is engine, retainer record and group wedge. Decision: deliver files; present from a company_admin login on a client instance with SEED_DEMO=false (platform_admin sees every organization, access.py:23-24; demo workspaces exist only where the startup seed runs, server.py:1245); fix only what a reader sees (item 3 lists the strings; the drawer stays English).
5. Two weeks is priceable in Mexico. Above roughly MXN 300M revenue, yes (estimate); below, expect 60,000-120,000. Decision: fixed scope, 50% upfront, retainer on every proposal, tested on six proposals (§1.0).
6. It repeats across industries. The frame repeats; verdict knowledge does not; areas and branches are hardcoded. Decision: one industry for clients 1-3 (the one Arkiva serves, verify); `industry` on the org; a verdict library only if research dominates logged hours.
7. One person sells, delivers and keeps the product still. One engagement per month (estimate), and the build still depends on Emergent. Decision: freeze per engagement; plugins out, key swapped, client instance deployed and dry-run before Day 0; buy a developer's hours (about 5 days).

KEEP: `system` records from interviews and invoices; the A-D board at A1; `initiative`/`opportunity` records and the two interview scripts (Appendix B) as the IP; consultant-signed `feasibility`; fixed fee with caps; engagement-led, leadership buyer, exported board + BOTS as engine; Spanish client-facing strings; audit step 1 before client 1 (item 0).

CUT: "MCP/API integrated in one platform" as a connector promise; autonomous agents; seats beyond 30-day viewers; demo workspaces in front of a client; industry library, quarterly refresh, "N workflows × M industries"; full i18n, LFPDPPP control templates inside the product (the NDA and aviso are pre-engagement documents, §9.2), risk-review UI; agent counts as a headline (8 of 11 Northwind agents are placeholders, seed.py:343); org CRUD before client 3; the density switch and the Published view (the three system caps and the opportunity group cap are raised now, item 12, because client 1 hits them, §3).

## 10. Open decisions

- Own `feasibility` key or extend SOURCING? Own key; `cost_band` as a band, counted, never summed.
- Swap the LLM key before client 1? Yes; official OpenAI SDK, same model, Arkiva's key; otherwise the drawer shows "No provider" (DetailDrawer.jsx:363).
- `decision` records or stage moves? Stage `approved` + `target_date`; decisions only when linked by script.
- Per-client DB_NAME? Yes for client 1 (memberships already isolate reads, access.py:21-32), one process per client, SEED_DEMO=false on every client instance.
- Section C shows opportunities? Yes, top 3 per cell by `candidate_phase` with "+n más"; Section F is the full list.
- Founding price for three case studies? Yes, MXN 150,000, case study in the contract (Appendix A).
- Industry for clients 1-3? The one Arkiva serves (verify; not a client fact).
- Calendar? Two-week data window after signature, then 10 working days; first invoice on signature, target Fri 6 Nov 2026 (estimate).

## Appendix A. Propuesta (una página, español)

**Mapa Vivo de Transformación: propuesta de servicio**

Arkiva para [Cliente], [fecha]. Vigencia de la propuesta: 15 días naturales.

**Objeto.** En 10 días hábiles, dentro de unas cuatro semanas calendario a partir de la firma, el equipo directivo de [Cliente] (una sola entidad legal) recibe: (1) el inventario tecnológico de la empresa en XLSX, con responsable, costo anual en MXN y datos de API/MCP por sistema; (2) un mapa visual A1 de la operación (áreas, responsables, sistemas, iniciativas por fase); (3) una tabla de veredictos firmada por el consultor que ubica cada iniciativa, dolor y tarea lenta capturada en una de cinco categorías: ya lo tienes, configurar, comprar, construir, no es tecnología, con responsable y banda de costo; (4) una sesión de trabajo de 3 horas con Dirección donde se validan en vivo las 12-15 prioridades, cada una con responsable, etapa aprobada y fecha objetivo; (5) un memo ejecutivo y una fotografía inmutable del mapa en la plataforma BOTS, con acceso de lectura 30 días.

**Método.** Semana 0 (desde la firma): [Cliente] entrega los insumos del checklist de accesos (auxiliar de cuentas por pagar y estados de cuenta de 12 meses, lista de licencias, organigrama, exportación del directorio de aplicaciones) con fecha de corte a los 10 días hábiles. Días 1-5 remotos: inventario y carga. Días 6-7 en sitio: entrevista de 90 minutos con Dirección, 45 minutos con TI y con el controller, y 45 minutos con cada responsable de área (6 a 9). Día 8: clasificación asistida por IA y firmada por el consultor, revisada con TI. Día 9 en sitio: sesión de 3 horas. Día 10: entrega.

**Criterios de entrada.** Una entidad legal; 6 o más responsables de área en la sesión del día 9; insumos Tier A entregados en la fecha de corte; un contacto de TI asignado; NDA mutuo y aviso de privacidad firmados antes de la firma.

**Exclusiones.** Implementación, negociación con proveedores, conexión de BOTS a sistemas de [Cliente], agentes autónomos, asesoría legal, rediseño de procesos, capacitación, una segunda entidad legal, usuarios adicionales. Hasta 60 registros capturados y 15 validados en vivo; lo que exceda se cotiza aparte.

**Honorarios.** MXN 150,000 más IVA, precio fundador (lista: MXN 240,000 más IVA) a cambio de la cláusula de caso de estudio. 50% a la firma contra CFDI, 50% a la entrega del día 10. Opcional Tier B (exportaciones de consolas de administración, 2 días adicionales): MXN 40,000 más IVA. Hosting posterior a los 30 días: MXN 6,000 más IVA por mes. Acompañamiento mensual disponible por separado.

**Caso de estudio.** [Cliente] autoriza a Arkiva a publicar el nombre de la empresa, el sector y una descripción del resultado sin cifras financieras ni datos personales, previa aprobación escrita del texto por [Cliente] en un plazo de 10 días hábiles desde su recepción.

**Confidencialidad y datos personales.** Toda la información se trata bajo NDA mutuo. Los nombres de empleados y las citas de entrevistas son datos personales (LFPDPPP); se recaban bajo aviso de privacidad, se almacenan en una instancia dedicada de BOTS para [Cliente] en [región], se eliminan a los 90 días de la entrega salvo contrato de acompañamiento, y las grabaciones solo se hacen con consentimiento expreso. Este documento no es asesoría legal.

**Propiedad.** Los archivos entregados (XLSX, PDF, memo) son de [Cliente]. La metodología, los guiones de entrevista, la rúbrica de veredictos y la plataforma BOTS son de Arkiva.

Firma Arkiva: ____________ Firma [Cliente]: ____________

## Appendix B. Interview scripts (Spanish, client-facing)

### B1. Entrevista de liderazgo, 90 min (día 6; CEO/COO, con TI y controller invitados a los bloques 4 y 5)

Bloque 1, marco (0-10 min). Objetivo del mapa; regla: nada se promete, todo se registra con fuente y nombre de quien lo dijo (`raised_by`); aviso de privacidad y grabación opcional; qué pasa el día 9.

Bloque 2, iniciativas (10-35 min), sobre la lista pre-rankeada de 15: para cada una, ¿qué resultado medible busca? (`intended_outcome`) ¿quién es el dueño? (`owner`) ¿ya está corriendo, con presupuesto? (`initiative` vs `opportunity`) ¿en qué etapa va? (`stage`) ¿cómo va: en tiempo, en riesgo o detenida, y qué porcentaje lleva? (`health`, `percent_complete`) ¿cuándo arrancó y cuál fue el último hito? (`started_at`, `last_milestone`) ¿qué la frena? (`blockers`) ¿cómo sabrán que funcionó? (métrica).

Bloque 3, dolores (35-55 min): ¿qué decisión se toma tarde o con datos que no confían? ¿qué proceso se rompe cuando sube el volumen? ¿qué depende de una sola persona? ¿qué reclama más el cliente? ¿qué reporte se arma a mano cada mes? Para cada uno: ¿cómo se resuelve hoy? (`current_approach`) ¿en qué sistema vive? (`systems_touched`) ¿qué datos toca y qué tan sensibles? (`data_involved`, `data_sensitivity`).

Bloque 4, tareas lentas (55-70 min): ¿qué tarea recurrente consume más horas de gente cara? ¿cuántas horas por semana o mes? (`effort_today_hours`, `effort_period`, `frequency`) ¿quién la hace? ¿qué sistema abre para hacerla?

Bloque 5, tecnología (70-80 min): ¿qué sistema "manda" (ERP, CRM, otro)? ¿qué licencias se pagan y nadie usa? ¿quién puede aprobar un conector o un acceso de API? ¿qué datos no pueden salir de la empresa? ¿hay algo que TI no sabe que las áreas usan?

Bloque 6, ranking (80-90 min): cada ejecutivo marca una sola urgencia "ahora" (`urgency = now`), tres "este trimestre"; confirmar asistentes del día 9 y la hora.

### B2. Entrevista con responsable de área, 45 min (día 7)

Marco (0-5 min): objetivo, regla de fuente y nombre, grabación opcional, los tres tipos de registro (iniciativa, dolor, tarea lenta).

Sistemas, las 8 preguntas fijas (5-13 min, una por minuto; respuestas a la hoja C1):
1. ¿Qué sistemas abres cada día y para qué? (`name`, `category`, `usage_status: active`)
2. ¿Qué vive en Excel o Google Sheets que debería vivir en un sistema? (`system_kind: spreadsheet`)
3. ¿Qué se coordina por WhatsApp o correo que un sistema debería registrar? (`system_kind: messaging`)
4. ¿Quién da los accesos y quién paga cada sistema? (`owner`, fuente para cruzar con el ledger)
5. ¿Cuál se cae, se duplica o se re-captura a mano? (`criticality`, dolor candidato)
6. ¿Cuál está conectado con otro sistema y cómo? ¿cuál no? (`api_available`, `verified_integration`)
7. ¿Qué pagan y nadie usa? ¿Qué usa el área que TI no sabe? (`usage_status: licensed_unused | shadow`)
8. ¿Qué dato de aquí es sensible: clientes, nómina, salud, tarjetas? (`data_sensitivity`, `data_domains`)

Iniciativas (13-25 min): ¿qué está intentando cambiar el área este año? Por cada una: resultado buscado, dueño, etapa, qué la frena, sistemas que toca.

Dolores (25-35 min): ¿qué te hace perder tiempo o clientes cada semana? ¿cómo lo resuelves hoy? ¿en qué sistema? ¿qué datos toca?

Tareas lentas (35-42 min): ¿cuál es la tarea repetitiva más cara del área? ¿horas por semana? ¿quién? ¿sistema? ¿con qué frecuencia?

Ranking (42-45 min): el responsable marca una urgencia "ahora" y ordena sus 5-10 registros; cita textual de cierre (`quote`) con permiso.

## Appendix C. Sheet templates (column order = XLSX export order)

### C1. Sistemas (`systems.csv`, loader rule: `name` and `area` required, `area` in CANON_KEYS)

name, vendor, system_kind {saas, on_prem, custom, spreadsheet, messaging, device}, category, area, owner, usage_status {active, licensed_unused, retired, shadow}, criticality {core, supporting, peripheral}, cost_estimate (MXN number), cost_period {monthly, one_off, per_use}, currency, api_available {yes, no, partner_only, unknown}, auth_type {oauth2, api_key, basic, sso_only, none, unknown}, mcp_status {official, community, none, unknown}, api_docs_url, mcp_url, data_domains, data_sensitivity {public, internal, confidential, personal_data}, last_verified_at, verified_by, source {ledger, card, idp, dns, interview}, source_ref, notes.

### C2. Registros (`intake.csv`, one row per initiative, pain point or slow task; etype `opportunity`, or `initiative` when running with owner and budget)

name, kind {initiative, pain_point, slow_task}, area, raised_by, owner, intended_outcome, current_approach, systems_touched (comma-separated system names, linked by the loader), blockers, effort_today_hours (number), effort_period {week, month}, frequency {daily, weekly, monthly, ad_hoc}, urgency {now, quarter, year}, data_involved, data_sensitivity, source {leadership, area_head, it, controller}, source_ref, captured_at, quote, stage (discovery), candidate_phase (1-3), health {on_track, at_risk, blocked}, percent_complete, started_at, last_milestone, budget, currency.

### C3. Veredictos (sheet written by `export_xlsx.py` from the top-level feasibility keys)

name, kind, area, owner, stage, target_date, feasibility {existing, configure, buy, build, not_tech}, enabling_systems (names resolved from enabling_system_ids), missing_capability, effort_band, cost_band, licence_tier, confidence, rationale, evidence, feasibility_source, feasibility_reviewed_by, feasibility_reviewed_at, validated_live (yes when stage is approved with owner and target_date).
