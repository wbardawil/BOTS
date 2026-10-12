# AUDIT: conducting.ai vs BOTS (supersedes AUDIT-vs-reference-board.md §0, §7 and §8)

Date 2026-10-12. BOTS at HEAD cfb6209. Goal: "replicate, under my company's name and control, what conducting.ai offers."

Supersession: AUDIT §0 (what they sell) is replaced by §1-3 here. AUDIT §7 (naming) is replaced by §6. AUDIT §8's priority order (capability hierarchy, roadmap template generator, panel A polish, outcome nodes) is board-fidelity work; it is not sequenced ahead of rename, control and export, and folds into §8 step 3 (density) and step 4 (library tier). Where the two disagree, this document wins.

## 0. Sources and confidence

Read: conducting.ai homepage, about and strategy copy as pasted by the user (marketing; every number from it is "claimed"); BOTS backend and frontend source; memory/PRD.md, DESIGN.md, AUDIT-vs-reference-board.md. Line numbers re-checked today. Two commits this morning (8b9c586 sourcing + risk overlay, cfb6209 cost roll-up) made several analyst claims stale; those are marked rejected.

Not read: the live site (unreachable), the FigJam file, any Playbook lesson, their Terms. The reference board is known only through AUDIT:1 and DESIGN.md:4-7.

Method and tags: each section was drafted from one analyst lens (offer, business model, data model, gaps, UX, IP, mentor) and then challenged twice against source and code. Survives = held up; contested = analysts disagreed and this document picks a side; rejected = shown false against the copy or the code.

## 1. What they sell, component by component

| Component | Format | Shipped vs promised | Cadence | Seat |
|---|---|---|---|---|
| AI-Native Company Design | Editable FigJam file, instant download | Shipped per copy; all 6 cards EARLY ACCESS | Not stated for the file. The quarterly statements are about the Playbook/Strategy (lines 53, 110) and "quarterly content refreshes" (line 51); re-issue of the FigJam file is an inference | Single; file shareable in FigJam |
| Strategy Playbook | Logged-in platform; "11 modules", "3 phases", "10 departments", "~1,000 lessons" (claimed) | Shipped per copy: "Instant access to the full Playbook" (line 57); EARLY ACCESS | Quarterly (claimed, lines 53, 110) | Single |
| Quick Day-1 Wins | "the Quick Day-1 Wins module" (lines 51-52); described only by outcome | Included now; whether it is one of the "Eleven modules" or an extra one is not stated | n/a | Single |
| Risk overlay | Notes per workflow: MIT taxonomy, "EU AI Act Article 22", GDPR, SOC 2, industry; footer "illustrative only" | Part of Playbook | With Playbook (claimed) | n/a |
| Industry variants | 7 claimed; 6 with counts 128/142/130/160/144/145 (849 claimed); General has none | EARLY ACCESS | With Playbook (claimed) | n/a |
| Education Series, tutors, training | Audience: "CAIOs, AI Leads, Department Leads and AI Champions" (line 55). Format: tutors guiding teams "as they build a tailored portfolio of AI prompts, workflows, and examples" (line 80) | "late 2026"; tutors "Placeholder (Coming Soon!)" | n/a | n/a |
| Success Stories | Three quotes, no names | "Video Coming Soon" / "Read Story (Coming Soon)" (line 41) | n/a | n/a |
| Community | Bare nav label (line 7); no status in the copy. "Join Over 15,000+ Members" (line 59) is a separate claim | Unknown | n/a | n/a |

Contested, day-one target: one side says parity is the triad a buyer opens on day one (file, Playbook, Quick Wins); the other says the quarterly refresh is the fourth listed inclusion and the only reason this is a subscription. Take the second: triad plus a versioned refresh. Note this rests on the inference that the refresh reaches the FigJam file, which the copy does not say; if it refreshes only the Playbook, the refresh is a content-tier concern and the file is a one-off.

## 2. Business model and distribution

Price ladder: "$99/mo" early-access "Lifetime" ending 31 October, then "$299/mo USD" (claimed), single seat, anchored against "$200K to $500K" consulting roadmaps and "ROI within 60 days" (claimed, unmeasured).

Implied revenue, contested: "200+ In our Early Access" x $99 is at least ~$19.8K MRR, ~1.3% of "15,000+" downloads, ~6.7% of the "3,000+" waitlist (claimed, lines 72, 76); but "early access" does not say paying, the paid product plausibly dates from Nov 2025 (inference: line 78 names the designs and education, not a paid launch), and ratios of "+" floors are indeterminate. Read it as a thin content business.

The moat: per-industry content (849 claimed workflows with owner, phase, buy/build, cost, risk note) plus a founder channel bootstrapped on a known founder's audience ("150+ calls with CIOs", claimed). Rejected: "the moat is audience, the product is a file" (the $99 buys a logged-in platform plus refreshes; content is their stated differentiator). Rejected: "single seat contradicts board positioning" (the FigJam file is shareable; the seat binds only the Playbook login).

Distribution, what "audience first" would mean replicating: Instagram, LinkedIn, YouTube and a newsletter (line 61), fed by "employee-generated content" from inside a client company (line 76), at "150,000+ Following" and "12,000,000+ Views" (line 23, claimed). Arkiva has none of these channels at that scale (verify).

Weaknesses: everything EARLY ACCESS; placeholder tutors and stories; a refresh delivered as a new download cannot merge customer edits (inference); English-only and EU-centric compliance (inference from the copy; no language or regime list beyond MIT, EU AI Act, GDPR, SOC 2); no multi-user, roles or history (inference from "Single-seat subscription", line 51); price shock to $299; vendor-cost content ages on ship.

## 3. The content and data model their offer implies

| Entity | Fields implied | Volume per industry |
|---|---|---|
| Industry pack | industry, version (quarter), fixed 10-department frame | 7 claimed |
| Agent workflow | name, department, phase, rollout position, named owner, buy/build/hybrid, vendor + cost, risk note (4 regimes + industry), ROI note | 128-160 claimed |
| Module | 11 per Playbook, one phase each (inference from "Eleven modules across three phases", line 48); Quick Day-1 Wins is a module (line 51), whether one of the 11 or a twelfth is not stated (inference either way) | 11 claimed |
| Lesson | sectioned "by department and by phase" (line 54); the module dimension is inferred; audience role (CAIO, AI Lead, Department Lead, AI Champion) | "~1,000" claimed across 7 Playbooks. 849 claimed workflows across the 6 counted industries, General uncounted, is roughly one lesson per workflow (inference): a lesson is plausibly the per-workflow guidance page, the same unit as the Agent workflow row |
| Vendor | name, cost ("Vendor Costs Included", claimed) | 1-3 per workflow (inference) |

Minimum for one industry: ~140 workflow records with owner, phase, sourcing, cost band and risk note, grouped into phase-ordered modules. Playbook lessons are claimed shipped and plausibly the same unit as the workflow record, so the guidance page per workflow is the parity unit, not a separate build. The Education Series (training, tutors) is unshipped ("late 2026", lines 51, 55, 57) and not a parity blocker.

Module decision: treat a module as a phase-ordered grouping of BOTS playbooks, implemented as `module` (label) and `module_order` on playbook records, not a new entity. One industry at 11 modules x 3 phases is then a labelling pass over the content plan, size S, sequenced in §8 step 4.

Rejected: "BOTS has a matching playbook schema" (data is an unvalidated dict, server.py:96-99; the drawer edits 9 of the 21 keys on pb-nw-leadqual, DetailDrawer.jsx:242 vs seed.py:241-258; the one playbook has no area, phase or owner). Rejected as stated, "BOTS lacks buy/build, vendor, cost fields", but the correction is narrower than the morning commits suggest: the fields exist on 11 of 21 seeded agents and 0 of 1 workflows. Northwind's 3 named agents (seed.py:200-206, 214-220, 225-230) and 8 branch agents (seed.py:333-334) carry sourcing, vendor, cost and risk; the 10 agents seeded by mini() (seed.py:359-372, calls 386-391) for Vertex, Harbor, Lumen, Retail, Logistics and Conf carry none of those keys; wf-nw-leadqual (seed.py:233-239) has none. This contradicts PRD.md:72 "Every `agent` and `workflow` carries". Real gaps: rollout order within a phase, ROI note, vendor as a linkable `system` with price. Contested, library tier: survives that organizations have no industry attribute (seed.py:92-95), no library exists as data and there is no POST /organizations (server.py:51-80 is GET only); overstated that departments vary per industry (copy fixes "All 10 departments") and that anything is "instantiated" (it is a file copy).

## 4. BOTS gap map

| Component | Status | Evidence | Sketch | Size |
|---|---|---|---|---|
| Industry library | MISSING | no industry field; CAPABILITY_LIBRARY is 11 strings (seed.py:7); 8 of 11 demo agents are "{Area} Co-Pilot" owned by "Named Owner" (seed.py:333); reseed wipes non-entity collections (seed.py:77-79) | `library_items` outside the wipe, `organizations.industry`, org CRUD, apply endpoint stamping source id/version | L content, M code |
| One-image export | MISSING | JSON only, admin 403 (server.py:560-569); no rasteriser; P2 (PRD.md:84) | native 2640x2060 PNG/PDF, server-rendered, stored at publish | S-M |
| Full-density canvas | PARTIAL | 9 slice caps in FrameworkCanvas.jsx: :242 (section A systems strip, 12), :296 (agents, 5), :302 (systems, 3), :307 (staff, 2), :372 (roadmap items per phase, 3), :393 (4), :420 (3), :438 (legal, 6), :497 (panel group, 4); only :296 shows "+n" | density switch or layout pass | M |
| Seats, invites, share link | MISSING | zero membership routes (server.py routes span 51-582, none for memberships); seed.py:101-103 mem() seeds 7 memberships; register grants no company (auth.py:80-89) | membership API + invite UI, then read-only snapshot link | M |
| Playbook by department x phase, in modules | PARTIAL | flat table; playbook has no area, phase or module | area + phase + `module`/`module_order` on playbook, grouped page | S-M |
| Sourcing, vendor, cost | HAVE, Northwind only | 11 of 21 seeded agents (seed.py:200-202, 214-216, 225-227, 334), 0 of 1 workflows (seed.py:233-239); mini() agents (seed.py:359-372) have no sourcing keys; DetailDrawer.jsx:251-264; cost roll-up ExecutiveOverview.jsx:139-152 has nothing to roll up outside Northwind; contradicts PRD.md:72 | fix hardcoded USD (:152), per_use as monthly; link vendor to `system`; seed or require the keys on every agent and workflow | S |
| Risk overlay | PARTIAL | fields on 11 of 21 agents (seed.py:203-206, 334), 0 of 1 workflows; `risk_review` 0 records; no reviewer/date; advance_phase ignores risk (server.py:239-250) | reviewed_by/at, optional gate, LATAM regimes, missing-overlay glyph | S-M |
| Quick wins | MISSING | 0 hits; 1 opportunity with effort and readiness (seed.py:178), 1 with readiness only (seed.py:184) | derived filter with defaults | S |
| Quarterly refresh | MISSING | diff is live vs snapshot only (server.py:399-422); rests on the §1 inference that their refresh reaches the file | `library_version` + per-record template diff | M, after library |
| Draft/Published on board | PARTIAL, toggle ignored | toggle exists: ScopeContext.jsx:14 `version` draft/published, Shell.jsx:87 `version-toggle`; FrameworkCanvas.jsx:31 destructures state/search only, so the board never reads it | Published view from latest snapshot, "n changes" badge | S-M |
| Spanish-first UI + LFPDPPP | MISSING | index.html:2 `lang="en"`; zero i18n hits in frontend/src; labels hardcoded in constants.js:89-101, FrameworkCanvas.jsx:17, seed.py:7-23; REGULATORY_FLAGS constants.js:133 = eu_ai_act, gdpr, soc2, hipaa, pci, industry, no LFPDPPP | string table with es-MX default and locale per org; add `lfpdppp` flag and a `personal_data` control template | M (i18n), S (flag) |
| Playbook lessons | PARTIAL | claimed shipped (line 57); plausibly = per-workflow guidance page (§3 inference); BOTS playbook record is the same unit but unlinked to area/phase | covered by the content plan and the playbook row above; no separate build | 0 extra |
| Education Series | MISSING by design (PRD.md:87) | unshipped on their side ("late 2026") | do not build | 0 |

Rejected: the gaps-lens rows "risk overlay missing" and "buy/build partial"; both shipped in 8b9c586/cfb6209 for Northwind. Survives in narrowed form: neither is complete across the seed (rows above).

BOTS has what their copy never mentions: multi-company and portfolio oversight with restricted-data withholding, scoped roles (no API grants them; only the seed, seed.py:101-103), snapshots and diff, audit on every mutation, assessment with unknown not equal to zero, evidence-gated phase advancement with named approver, AI output labelled AI_DRAFT, 45 backend tests (31 in tests/backend_test.py, 14 in tests/test_layout_roadmap.py). Those tests are HTTP integration tests against a running server (backend_test.py:6-7, test_layout_roadmap.py:6-7); there are no frontend tests at all (frontend/package.json scripts: start, dev, build, preview). None of the above is visible on the board (AUDIT:67: "the buyer sees a slower Figma").

## 5. Product UX requirements

1. One-click PNG and PDF export at native size, full board and sections A-D, stamped with company, Draft/Published and date; open to viewers. Survives. S-M. §8 step 2.
2. Render every record, no silent truncation. Acceptance: 150 agents across 9 branches and 12+ systems per branch legible in the export; the section A systems strip (FrameworkCanvas.jsx:242) included. Survives. M. §8 step 3.
3. Membership and invitation UI first, then a revocable read-only share link from the latest published snapshot. Survives. M. §8 step 5.
4. Semantic drag: dropping a chip on another phase or area patches `data.phase/area` with undo and audit; their move is cosmetic (inference: a FigJam chip has no record behind it). Survives. M. Deferred until a client asks.
5. Published mode on the canvas with "Published {date}" and "n changes since publication". Survives. S-M. §8 step 3.
6. Department page per area with phase tabs and deep link `?org=&area=&phase=` as default navigation. Contested (overlaps the playbook grouping row). S-M. Deferred; revisit with step 4.
7. Per-workspace framework definition (area labels, phase names, rows) edited in Settings. Contested (conflicts with a fixed frame until the library exists). M. Deferred.
8. Present mode, shortcuts to fit A-D, pinch zoom, print stylesheet; export bundle plus import so "yours to keep" holds. Print stylesheet survives, S, folds into step 2 and is the first-client fallback (§8). The rest deferred.

## 6. IP, naming and control boundaries

Free to use: org charts, capability maps, phased rollout, value chains, buy/build/hybrid, public standards re-derived from source (MIT AI Risk Repository, EU AI Act text, GDPR, SOC 2, LFPDPPP), whiteboard styling, the generic words co-pilot and autonomous agent.

Rename before launch (all three findings survive):

| Today | Where | Rename to |
|---|---|---|
| "AI Co-Pilots / AI Brains / Autonomous Agents" | seed.py:18-20, constants.js:77-86, Roadmap.jsx:9 (delete) | Assisted Work, Governed Knowledge, Bounded Autonomy (or Asistir / Conocer / Delegar) |
| "AI agent org chart", "Business reference model", "AI development roadmap", "Business value chain" | FrameworkCanvas.jsx:194, 321, 355, 390 | Operating Map, Capability Model, Transformation Roadmap, Value Chain (constants.js:45-52) |
| ROW_LABELS, "AI team brain", "Knowledge brain"; circle avatar + black pill; quadrant default | FrameworkCanvas.jsx:17, 233, 467-476; DESIGN.md:4-7, 98-108 | rows around BOTS state (Owner / Knowledge base / Agents by phase / Systems / Open flags); new owner card; rewrite DESIGN.md so the reference is BOTS's spec |
| "{Area} Co-Pilot" record names | seed.py:242, 261, 333 | "{Area} Assistant" |
| 11-area list, two drifting label sets | seed.py:7-12 vs constants.js:89-101 | unify, rewrite in Arkiva's words, keep `key` ids |
| `<title>Emergent \| Fullstack App</title>` | frontend/index.html:11 | Arkiva BOTS |

Commit f51a29d renamed BOTS's own titles and rows to the board's wording; deliberate convergence, and the first thing a buyer who follows them sees. The pre-commit strings are the cheapest rename target (S option: revert them). Before f51a29d (git show f51a29d^:frontend/src/views/FrameworkCanvas.jsx:21, 185, 255, 284, 317) the titles were "A · Operating & Agent Organization", "B · Business Reference Model", "C · Three-Phase Transformation Roadmap", "D · Business Value Chain", and ROW_LABELS were Function / Lead / Knowledge brain / Phases / Agents / Systems / tools / Accountable. "Knowledge brain" and "Business Reference Model" still need new words. The commercial reason (price-anchoring to a $99 template) outweighs the legal one (layout copyright and passing-off are thin, inference).

Control sweep ("under my company's control" is under-audited; all verified today):

| Item | Where | Action |
|---|---|---|
| Third-party script on every page | frontend/index.html:13 loads https://assets.emergent.sh/scripts/emergent-main.js | remove |
| Telemetry to a third party | frontend/index.html:7 description "A product of emergent.sh"; index.html:81-82 PostHog to api_host ap.emergent.sh | remove or point at Arkiva's own project |
| Build dependencies from a third-party CDN | frontend/package.json:89-90 @emergentbase/overlay, @emergentbase/visual-edits from assets.emergent.sh; frontend/README.md:22 | remove the plugins |
| Test defaults to a third-party preview host | backend/tests/backend_test.py:6, test_layout_roadmap.py:6 default BASE_URL to *.preview.emergentagent.com | default to localhost, require env |
| Vendor-named test ids and docs | frontend/src/constants/testIds/auth.js:12, home.js:5; DESIGN.md:98 "Prompt to paste into Emergent" | rename |
| LLM key and SDK | backend/ai.py:14, 52-53 EMERGENT_LLM_KEY, emergentintegrations | replace with a provider key Arkiva holds |
| Object storage for attachments | backend/storage.py: integrations.emergentagent.com, authenticated with EMERGENT_LLM_KEY (added by Emergent on 2026-10-12, merged in 935afe2) | replace with S3-compatible storage Arkiva owns (boto3 is already in requirements); keep the same put/get interface |
| Transactional email for reminders | backend/email_util.py: integrations.emergentagent.com with EMERGENT_EMAIL_KEY; .emergent/crons.yml schedules POST /api/cron/checkpoint-nudges daily | replace with an SMTP or email API account Arkiva owns; move the schedule to Arkiva's scheduler when hosting moves |
| Hosting, domain, DB | db.py:4-5 reads MONGO_URL and DB_NAME; where Mongo and the app run, and who owns those accounts, is not in the repo | confirm Arkiva owns the accounts; move if not |

Never copy: "Conducting", conductor, orchestra or baton imagery; the names "AI-Native Company Design", "Transformation Playbook", "Quick Day-1 Wins", "Education Series"; any number or testimonial; their regime bullet verbatim ("EU AI Act Article 22" is plausibly a conflation with GDPR Article 22, inference, verify); any text from their FigJam file or lessons. Not legal advice; have counsel review before public launch.

## 7. Challenged assumptions (mentor)

1. Distribution. Their story is audience first, product second (channels in §2); BOTS has no landing page, no onboarding into a company, no billing. Decision: pick one channel (content-led self-serve, founder-led direct and partner sales, or BOTS as deliverable of paid engagements) and fund no parity feature until it shows pull. §8 applies this as gates.
2. Template vs software. For this buyer the poster is the product, and BOTS cannot produce it. Decision: exportable board as product with BOTS as engine, or commit to buyers who need a system of record (groups, portfolios, consultancies) and stop comparing to a $99 file.
3. Content volume. Eight of eleven Northwind agents are placeholders; credibility, not count, is the moat. Decision: author one industry deep, or sell a blank canvas to consultants who bring content. Never promise "140+ agents x N industries".
4. $99 economics. Their price is promotional, single-seat and near-zero marginal cost (inference: a logged-in content site plus a file download); BOTS carries hosting, LLM spend (ai.py depends on a vendor key) and support. Decision: per-company or per-portfolio pricing sold to organizations, or a cheap artifact subscription BOTS generates. Not a $99 multi-tenant app.
5. The buyer. Card, single seat, instant download say an individual AI lead buying a credibility artifact; BOTS's shape says a group executive with procurement. Decision: name one primary buyer and design pricing, onboarding and first screen for them.
6. "Replicate". A late copy with no audience, their vocabulary and legal exposure is the weakest position. Decision: reframe to a wedge they cannot follow, most plausibly the living record across a group or portfolio, in Spanish, with LATAM compliance (LFPDPPP); rename before anything is public.
7. First dollar. The parity backlog is months; the fastest dollar is a paid engagement with the current canvas as deliverable. Decision: set a date for the first invoice, build only what that client needs, defer billing and self-serve until three clients exist.

## 8. Recommended sequence

Each step is unconditional or gated. Gated steps wait for the trigger named; 7.1 and 7.7 forbid funding them earlier.

1. Rename, control and credentials sweep (S, unconditional, before any client data).
   - Rename: phases, titles, rows, Co-Pilot strings, avatar motif, DESIGN.md, index.html (§6 table); S option is reverting the f51a29d strings. Backend tests do not assert on these strings and there are no frontend tests, so "no test depends on the strings" is trivially true for the UI.
   - Control: the §6 control sweep (third-party script, telemetry, CDN packages, test hosts, LLM key, hosting/domain/DB ownership).
   - Credentials: backend/tests/backend_test.py:10 and test_layout_roadmap.py:9-13 embed the owner (platform_admin) email and password in source; seed.py:51-52 fall back to default ADMIN_EMAIL/ADMIN_PASSWORD when env is unset; DEMO_USERS passwords are in seed.py:64-68 and both test files. Rotate, move to env, fail closed when env is unset. Do not copy the values anywhere.
   - Reseed guard: POST /admin/seed (server.py:574-579) calls seed_demo(force=True), and seed.py:77-79 runs delete_many({}) on workspaces, organizations, portfolios, memberships, relationships, views, snapshots, assessments and audit; only `entities` is filtered by is_demo. A reseed after client data exists wipes the client's org, memberships, snapshots and audit. Filter every collection by is_demo or disable the endpoint before the first client. Then re-seed once, after the rename.
2. Board export (S-M, unconditional, but not a precondition for the first invoice). Native-size PNG/PDF per section, server-rendered, stored at publish, open to viewers. Until it ships, the deliverable is manual: a print stylesheet (req 8, S) plus browser print-to-PDF or a screenshot at native zoom, which inherits the slice caps in §4 Density. Ship step 2 for the second client at the latest.
3. Density and Published view (M). Density is gated on the first client's record count exceeding a cap (5 agents or 3 systems per branch, 12 systems in the strip, 3 roadmap items per phase); a 140-workflow engagement triggers it. Published view is gated on the first client asking to brief from a frozen board; the toggle already exists (ScopeContext.jsx:14, Shell.jsx:87) and FrameworkCanvas.jsx:31 must read it.
4. Library tier (M code). Gated on channel pull: a second client in the same industry, or the content plan funded. Org CRUD with `industry`, `library_items` exempt from the reseed wipe, apply endpoint stamping source id and version, module labels on playbooks, quick-wins filter on top.
5. Membership API and invite UI (M), then share link. Gated on a client asking for seats or on channel = self-serve. Billing stays deferred.

Content plan, 140 workflows for one industry: pick the industry Arkiva already serves (verify). Frame 11 areas x 3 phases, 4-5 workflows per cell; label each playbook with a phase-ordered module (11 modules, §3 decision). Record template: name, area, phase, module, rollout order, owner role, sourcing, vendor, cost band (MXN and USD), risk level/category/sensitivity/flags including LFPDPPP, required controls, ROI note, day-1 flag. Batch-generate drafts through ai.py into the library as AI_DRAFT; one practitioner per area reviews and signs each record; three outside practitioners flag anything generic. Log hours on the first 30 records to size the rest. Ship as version 2026-Q4 with a visible "last refreshed" stamp.

Refresh after 2026-Q4: the §2 weakness "vendor-cost content ages on ship" applies to Arkiva equally. Name one refresh owner (the §9 signer, or one practitioner per area with the signer as editor). Per-quarter scope: re-verify vendor and cost on every record, re-check regulatory flags, re-rank day-1 flags, bump `library_version`. Budget rule until measured: quarterly hours = (hours logged on the first 30 records / 30) x 140 x 0.25, reviewed after the first refresh. If no owner and budget are named, do not promise quarterly refreshes in the offer.

First-dollar path: book one paid "AI-native company design" workshop within 30 days using BOTS as is, priced against local consulting. Mechanics, because none exist in the product: there is no org or workspace UI and no POST /organizations (server.py:51-80 is GET only) and no membership route, so the client's workspace, organization and editor membership are created by the developer, by adding a block to seed.py or by direct Mongo inserts, before the reseed guard in step 1 is in place or with reseed disabled. Entities can then be entered through the UI (POST/PUT /entities, server.py:112, 163) by that editor. Deliverable: the printed or screenshotted canvas (step 2 fallback) plus the JSON export (server.py:560-569, admin only, so the developer runs it). That client becomes the first named case study, which their copy does not have.

## 9. Open decisions for the user

Each line carries the document's recommendation; accept or reject rather than re-decide.

- Channel: content-led self-serve, direct/partner sales, or engagement-led? Recommendation: engagement-led (7.7, §8), revisit at three clients.
- Primary buyer: individual AI lead, or group/portfolio executive? Recommendation: group/portfolio executive (7.5, 7.6).
- Product: exportable board with BOTS as engine, or system of record? Recommendation: exportable board as the sold artifact, BOTS as engine (7.2), with the record as the wedge.
- Pricing: per company, per portfolio, or per seat? Copy $99/$299? Recommendation: per company or per engagement, no per-seat, do not copy $99/$299 (7.4).
- First industry to author, and who at Arkiva signs each record? Recommendation: the industry Arkiva already serves; one named signer who also owns the quarterly refresh (§8).
- Keep 11 areas or mirror their 10-department framing? Recommendation: keep 11, rewritten in Arkiva's words (§6).
- Spanish-first UI and LFPDPPP compliance as the wedge? Recommendation: yes (7.6); sized in §4, sequenced with the first Spanish-speaking client.
- Risk review as hard phase gate, or advisory? Recommendation: advisory with reviewer and date now, hard gate optional per org (§4 Risk overlay).
- FigJam-editable SVG export, or stop at PNG/PDF? Recommendation: PNG/PDF first (§8 step 2); SVG only if a client asks.
- Education layer? Recommendation: Playbook lessons yes, as the per-workflow guidance page already in the content plan (§3); Education Series no (§4).
- Counsel review of names, composition and taxonomy before launch? Recommendation: yes, before anything public (§6).
