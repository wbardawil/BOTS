// Mock API for the e2e flows: a deterministic dataset at contract scale (45 systems across the 11 areas,
// 60 intake items) and a route table that answers every /api/** call the built frontend makes.
// No backend, no MongoDB, no LLM: the flows exercise the UI against these shapes only.
"use strict";

const ORG = "org1";
const CLASSES = ["current_stack", "configure", "build", "buy", "not_tech"];
const KINDS = ["saas", "custom", "database", "spreadsheet", "integration", "infrastructure", "device"];
const INTAKE_KINDS = ["initiative", "pain_point", "slow_task"];
const FREQ = ["daily", "weekly", "monthly", "quarterly", "ad_hoc"];
// Mirror of src/pages/Intake.jsx PER_MONTH / hoursPerMonth: the flows compute the expected stat the same way.
const PER_MONTH = { daily: 21, weekly: 4.33, monthly: 1, quarterly: 1 / 3, ad_hoc: 0 };
const hoursPerMonth = (d) => (Number(d.time_per_occurrence_hours) || 0) * (PER_MONTH[d.frequency] ?? 0) * (Number(d.people_involved) || 1);

// The 11 canonical areas (key, label, head of area), in reference-model order.
const AREAS = [
  ["strategy", "Strategy & Leadership", "Morgan Vale"], ["product", "Product / Service Management", "Quinn Ortega"],
  ["operations", "Operations & Supply Chain", "Riley Chen"], ["marketing", "Marketing & Growth", "Logan Reyes"],
  ["sales", "Sales", "Jordan Blake"], ["customer", "Customer & Admin", "Avery Kim"],
  ["data", "Data & Analytics", "Drew Patel"], ["tech", "Tech, AI & Automations", "Reese Okafor"],
  ["finance", "Finance", "Sam Novak"], ["hr", "Human Resources", "Casey Lund"], ["legal", "Legal, Risk & Compliance", "Dana Ruiz"],
];
const AGENTS = {
  sales: [["Proposal Research Agent", 1], ["Lead Scoring Co-Pilot", 1], ["Sales AI Brain", 2], ["Autonomous Outreach Agent", 3]],
  customer: [["Ticket Triage Co-Pilot", 1], ["Support AI Brain", 2], ["Autonomous Resolution Agent", 3]],
  marketing: [["Content Draft Co-Pilot", 1], ["Campaign Analysis Agent", 1], ["Marketing AI Brain", 2]],
  product: [["Spec Summary Co-Pilot", 1], ["Roadmap Insight Agent", 2]],
  operations: [["Demand Forecast Agent", 1], ["Supplier Risk Agent", 2], ["Autonomous Scheduling Agent", 3]],
  data: [["Data Quality Co-Pilot", 1], ["Dashboard Narrator", 2]],
  tech: [["Workflow Builder Co-Pilot", 1], ["Multi-Agent Orchestrator", 3]],
  finance: [["Invoice Matching Agent", 1], ["Forecast Co-Pilot", 2]],
  hr: [["Screening Co-Pilot", 1], ["Onboarding Agent", 2]],
  strategy: [["Board Brief Co-Pilot", 1]],
  legal: [["Compliance Report Agent", 1], ["Policy Review Agent", 2]],
};
// System pool per area: [name, kind, vendor]. An empty kind is an unclassified system (the table's last group).
// "HubSpot" must exist and "Salesforce" / "Almacén de datos" must not: fixtures/systems.csv expects 2 created, 1 skipped.
const SYSTEM_POOL = {
  strategy: [["Notion", "saas", "Notion Labs"], ["Google Workspace", "saas", "Google"], ["Miro", "saas", "Miro"], ["Slack", "saas", "Salesforce"]],
  product: [["Jira", "saas", "Atlassian"], ["Figma", "saas", "Figma"], ["Confluence", "saas", "Atlassian"], ["Productboard", "saas", "Productboard"]],
  operations: [["NetSuite", "saas", "Oracle"], ["SAP Business One", "custom", "SAP"], ["Odoo Inventory", "saas", "Odoo"], ["Fleet GPS tracker", "device", "Geotab"]],
  marketing: [["HubSpot", "saas", "HubSpot"], ["Canva", "saas", "Canva"], ["Meta Ads Manager", "saas", "Meta"], ["Mailchimp", "saas", "Intuit"]],
  sales: [["Gong", "saas", "Gong"], ["Pipedrive", "saas", "Pipedrive"], ["Cotizador (Excel)", "spreadsheet", "Microsoft"], ["WhatsApp Business", "", "Meta"]],
  customer: [["Zendesk", "saas", "Zendesk"], ["Intercom", "saas", "Intercom"], ["Portal de clientes", "custom", "In-house"], ["Encuestas NPS (Typeform)", "saas", "Typeform"]],
  data: [["Snowflake", "database", "Snowflake"], ["Looker", "saas", "Google"], ["Airbyte", "integration", "Airbyte"], ["Tablero KPI (Excel)", "", "Microsoft"]],
  tech: [["n8n", "integration", "n8n"], ["OpenAI API", "integration", "OpenAI"], ["GitHub", "saas", "GitHub"], ["AWS", "infrastructure", "Amazon"], ["Zapier", "integration", "Zapier"]],
  finance: [["QuickBooks", "saas", "Intuit"], ["CONTPAQi", "custom", "CONTPAQi"], ["Conciliación bancaria (Excel)", "spreadsheet", "Microsoft"], ["Stripe", "saas", "Stripe"]],
  hr: [["BambooHR", "saas", "BambooHR"], ["Nómina (Excel)", "spreadsheet", "Microsoft"], ["LinkedIn Recruiter", "saas", "LinkedIn"], ["Checador biométrico", "device", "ZKTeco"]],
  legal: [["DocuSign", "saas", "DocuSign"], ["Repositorio de contratos (SharePoint)", "infrastructure", "Microsoft"], ["Matriz de riesgos (Excel)", "spreadsheet", "Microsoft"], ["OneTrust", "saas", "OneTrust"]],
};
const PROCS = {
  strategy: ["Market Positioning", "Leadership Oversight", "Risk Planning"], product: ["Roadmap Planning", "Quality Assurance"],
  operations: ["Supplier Coordination", "Process Optimisation"], marketing: ["Brand Positioning", "Audience Engagement"], sales: ["Lead Nurturing", "Account Management"],
  customer: ["Feedback Collection", "Issue Resolution", "Customer Onboarding"], data: ["Data Management", "BI Reporting"], tech: ["AI Strategy & Governance", "Automation Build"],
  finance: ["Accounts Receivable", "Budgeting & Forecasting"], hr: ["Performance Tracking", "Learning & Development"], legal: ["Policy Review"],
};
// Who raised the intake items (name, role), in the order they cycle.
const PEOPLE = [
  ["Elena Marsh", "COO"], ["Avery Stone", "Head of Sales"], ["Morgan Vale", "CEO"], ["Sam Novak", "Head of Finance"],
  ["Riley Chen", "Head of Operations"], ["Avery Kim", "Head of Customer"], ["Logan Reyes", "Head of Marketing"], ["Casey Lund", "Head of HR"],
];
// 60 intake item names, grouped by area (about five or six per area).
const INTAKE_POOL = [
  ["finance", "Monthly commissions take four days"], ["finance", "Cierre contable con conciliación manual"], ["finance", "Facturas de proveedores capturadas a mano"],
  ["finance", "Flujo de caja se arma en Excel cada semana"], ["finance", "Cobranza sin recordatorios automáticos"], ["finance", "Presupuesto anual en 14 hojas distintas"],
  ["sales", "Cotizaciones tardan dos días en salir"], ["sales", "Seguimiento de leads por WhatsApp sin registro"], ["sales", "Pipeline duplicado entre Pipedrive y Excel"],
  ["sales", "Reporte semanal de ventas se arma a mano"], ["sales", "Scoring de leads para priorizar llamadas"], ["sales", "Contratos de venta sin plantilla"],
  ["customer", "Clientes llaman para saber el estado de su pedido"], ["customer", "Tickets sin clasificar por urgencia"], ["customer", "Encuesta NPS se envía por correo manual"],
  ["customer", "Onboarding de clientes nuevos sin checklist"], ["customer", "Respuestas repetidas a las mismas preguntas"], ["customer", "Base de conocimiento desactualizada"],
  ["operations", "Inventario físico vs sistema no cuadra"], ["operations", "Órdenes de compra aprobadas por correo"], ["operations", "Programación de rutas a mano cada mañana"],
  ["operations", "Proveedores sin evaluación de riesgo"], ["operations", "Mermas registradas en libreta"], ["operations", "Pronóstico de demanda por intuición"],
  ["marketing", "Contenido para redes se produce sin calendario"], ["marketing", "Campañas sin medición de retorno"], ["marketing", "Lista de correo con duplicados"],
  ["marketing", "Brief creativo se repite en cada campaña"], ["marketing", "Reporte de campañas consolidado a mano"],
  ["product", "Especificaciones en documentos dispersos"], ["product", "Priorización del roadmap sin datos de uso"], ["product", "Pruebas de calidad registradas en Excel"],
  ["product", "Feedback de clientes no llega a producto"], ["product", "Versiones del producto sin changelog"],
  ["data", "Tablero de KPI se actualiza a mano los lunes"], ["data", "Datos de ventas y finanzas no coinciden"], ["data", "Reportes a dirección piden la misma consulta"],
  ["data", "Calidad de datos de clientes sin dueño"], ["data", "Exportaciones manuales de Looker a Excel"],
  ["tech", "Automatizaciones en n8n sin documentación"], ["tech", "Accesos a sistemas sin revisión periódica"], ["tech", "Integración ERP-CRM caída cada semana"],
  ["tech", "Respaldo de datos sin verificación"], ["tech", "Solicitudes de TI por chat sin registro"],
  ["hr", "Reclutamiento revisa CV uno por uno"], ["hr", "Onboarding de empleados toma tres semanas"], ["hr", "Evaluaciones de desempeño en Word"],
  ["hr", "Nómina capturada dos veces"], ["hr", "Capacitación sin registro de asistencia"],
  ["strategy", "Informe mensual al consejo se arma en una semana"], ["strategy", "Decisiones de dirección sin acta"], ["strategy", "OKR seguidos en una presentación"],
  ["strategy", "Análisis de competencia una vez al año"],
  ["legal", "Contratos firmados sin repositorio central"], ["legal", "Vencimientos de contratos sin alerta"], ["legal", "Política de datos personales sin revisión"],
  ["legal", "Revisión legal de campañas tarda una semana"], ["legal", "Matriz de riesgos actualizada a mano"], ["legal", "Avisos de privacidad en versiones distintas"],
];

const ISO = "2026-10-11T18:20:00Z";
const pick = (arr, i) => arr[i % arr.length];

/** Build the dataset. `systems` and `intake` set the scale; the shapes mirror the backend's entity documents. */
function makeDataset({ systems = 45, intake = 60 } = {}) {
  let n = 0;
  const ents = [], rels = [];
  const ent = (etype, data, extra = {}) => {
    const e = { id: extra.id || `e${++n}`, etype, organization_id: ORG, workspace_id: "ws1", status: "published", state: "current", version: 1,
      is_demo: false, archived: false, created_at: ISO, updated_at: ISO, last_reviewed_at: "2026-10-01T00:00:00Z", data, ...extra };
    ents.push(e); return e;
  };
  ent("role", { name: "Chief Executive Officer", type: "human_executive", accountable_owner: "Morgan Vale" });
  ent("role", { name: "Chief Operating Officer", type: "human_executive", accountable_owner: "Elena Marsh" });
  ent("role", { name: "Chief Agent", type: "coordination_agent", accountable_owner: "Morgan Vale" });
  const heads = {}, headOf = {};
  AREAS.forEach(([k, label, who], i) => {
    headOf[k] = who;
    ent("capability", { name: label, area: k, area_no: i + 1, current_state: "Manual, ad-hoc", target_state: "AI-assisted, measured" });
    heads[k] = ent("role", { name: `Head of ${label}`, area: k, type: "human_head", accountable_owner: who });
    ent("role", { name: `${label} AI Lead`, area: k, type: "ai_lead", accountable_owner: "Sally Adams" });
    if (["sales", "marketing", "tech"].includes(k)) ent("role", { name: "AI Developer", area: k, type: "ai_developer", accountable_owner: "Noor Haddad" });
    ent("knowledge_source", { name: `${label} Knowledge Base`, area: k, owner: who, freshness_rule: "Review quarterly" });
    (AGENTS[k] || []).forEach(([name, ph], j) => ent("agent", { name, area: k, phase: ph, human_owner: j === 1 ? "" : who, purpose: "Support workflows with human review",
      sourcing: pick(["buy", "hybrid", "build"], j + ph), vendor: pick(["HubSpot Breeze", "n8n + OpenAI", "In-house service"], j + ph),
      cost_estimate: pick([120, 450, 9000], j + ph), cost_period: pick(["monthly", "monthly", "one_off"], j + ph), currency: "USD",
      risk_level: pick(["low", "medium", "high"], j + k.length), risk_category: pick(["accuracy", "privacy", "legal"], j + k.length),
      data_sensitivity: pick(["internal", "personal_data", "confidential"], j + k.length), regulatory_flags: pick(["", "gdpr, eu_ai_act", "soc2"], j + k.length),
      required_controls: "Human reviews every output before it leaves the team", risk_notes: "Illustrative only" }));
    (PROCS[k] || []).forEach((p) => ent("process", { name: p, area: k, owner: who }));
    ent("opportunity", { name: `Automate ${label.split(" ")[0].toLowerCase()} reporting`, area: k, candidate_phase: 1, priority: "high", owner: who });
    ent("initiative", { name: `${label.split(" /")[0]} AI Co-Pilot`, area: k, phase: 1, status: "in_progress", owner: who });
    ent("initiative", { name: `${label.split(" /")[0]} AI Brain`, area: k, phase: 2, status: "planned", owner: who });
    if (i % 2 === 0) ent("initiative", { name: `Autonomous ${label.split(" /")[0]} agents`, area: k, phase: 3, status: "planned", owner: "" });
  });

  // ---- systems: round-robin over the areas, cycling each pool (suffixed when a pool runs out) -----------
  const pools = AREAS.map(([k]) => ({ area: k, items: SYSTEM_POOL[k] || [], used: 0 }));
  const taken = new Set();
  const sysByArea = {};
  for (let i = 0; i < systems; i++) {
    const pool = pools[i % pools.length];
    const base = pool.items[pool.used % pool.items.length];
    const round = Math.floor(pool.used / pool.items.length);
    pool.used++;
    let [name, kind, vendor] = base;
    if (round > 0) name = `${name} (${round + 1})`;
    while (taken.has(name.toLowerCase())) name = `${name} ·`;
    taken.add(name.toLowerCase());
    const data = { name, area: pool.area, vendor, owner: i % 6 === 5 ? "" : headOf[pool.area],
      cost_estimate: ((i % 5) + 1) * 120, cost_period: i % 7 === 3 ? "one_off" : "monthly", currency: "USD",
      criticality: pick(["low", "medium", "high"], i), hosting: pick(["cloud", "cloud", "on_prem", "desktop"], i),
      system_status: i % 11 === 10 ? "retiring" : "active", data_sensitivity: pick(["internal", "personal_data", "confidential", "public"], i),
      api_available: pick(["yes", "no", "unknown"], i), api_type: pick(["rest", "graphql", "file_export"], i), auth_method: pick(["oauth2", "api_key", "sso"], i),
      mcp_available: pick(["unknown", "no", "yes"], i), integration_notes: "Contacts and deals reachable via REST.", verified_integration: i % 9 === 0, source: "manual",
      users_count: 5 + (i % 40), seats: 5 + (i % 40) };
    if (kind) data.kind = kind;
    const e = ent("system", data, { id: `sys${i + 1}` });
    (sysByArea[pool.area] = sysByArea[pool.area] || []).push(e);
  }

  // ---- intake items: kinds cycle 1:1:1, feasibility state cycles final / draft / none ------------------
  const draftFor = (cls, area, effort, i) => ({
    classification: cls, confidence: pick(["medium", "high", "low"], i),
    rationale: cls === "not_tech" ? "The root cause is a decision rule, not a missing system." : `${(sysByArea[area] || [])[0]?.data.name || "The current stack"} covers the core of this; the rest is configuration and a review step.`,
    systems_used: cls === "not_tech" || cls === "buy" ? [] : (sysByArea[area] || []).slice(0, 1 + (i % 2)).map((s) => s.data.name),
    what_to_do: "Model the rule in the system, schedule the report and keep a human review before anything leaves the team.",
    prerequisites: i % 3 ? ["Rules written down per case"] : [], risks: i % 4 ? ["Exceptions may not fit the rule"] : [],
    estimated_effort: effort, quick_win: effort === "S", suggested_phase: 1 + (i % 3), open_questions: i % 2 ? ["How many exceptions per month?"] : [],
  });
  const intakeIds = [];
  for (let i = 0; i < intake; i++) {
    const [area, baseName] = INTAKE_POOL[i % INTAKE_POOL.length];
    const name = i < INTAKE_POOL.length ? baseName : `${baseName} (${Math.floor(i / INTAKE_POOL.length) + 1})`;
    const [who, role] = PEOPLE[i % PEOPLE.length];
    const cls = CLASSES[Math.floor(i / 3) % CLASSES.length];
    const effort = pick(["S", "M", "L"], Math.floor(i / 3));
    const data = { name, intake_kind: INTAKE_KINDS[i % 3], area, raised_by: who, raised_by_role: role, owner: i % 4 === 0 ? headOf[area] : "",
      business_problem: `Today this is done by hand in ${area}; errors surface late and nobody owns the fix.`,
      current_process: "Export, paste into a spreadsheet, apply the rules, send for approval by email.",
      frequency: FREQ[i % 5], time_per_occurrence_hours: pick([0.5, 1, 2, 4, 8, 16, 32], i), people_involved: pick([1, 2, 3, 1, 2], i),
      urgency: pick(["high", "medium", "low"], i), impact: pick(["medium", "high", "low"], i + 1),
      systems_involved: (sysByArea[area] || []).slice(0, 1 + (i % 2)).map((s) => s.data.name),
      evidence_quote: `"${name.replace(/\s*\(\d+\)$/, "")}" fue la frase textual en la entrevista.`,
      source: i % 4 === 0 ? "transcript" : "form", stage: "discovery", stage_history: [{ stage: "discovery", at: ISO, by: "Wadi Bardawil", note: "form" }] };
    const state = i % 3; // 0 final, 1 draft, 2 none
    if (state === 0) {
      const content = draftFor(cls, area, effort, i);
      const overridden = i % 9 === 0;
      data.stage = "assessing";
      data.feasibility_draft_class = cls; data.feasibility_class = cls;
      data.feasibility = { draft: { label: "AI_DRAFT", kind: "feasibility", accepted: !overridden, model: "fake-1", prompt_version: "feas-v1", generated_at: ISO, content },
        final: overridden ? { ...content, rationale: "Reviewed: the rule is a plain percentage; no build needed." } : content,
        review_action: overridden ? "overridden" : "accepted", reviewed_by: "Wadi Bardawil", reviewed_at: "2026-10-11T18:00:00Z", review_note: overridden ? "Set in the review session" : "" };
    } else if (state === 1) {
      data.feasibility_draft_class = cls;
      data.feasibility = { draft: { label: "AI_DRAFT", kind: "feasibility", accepted: false, model: "fake-1", prompt_version: "feas-v1", generated_at: ISO, content: draftFor(cls, area, effort, i) } };
    }
    const e = ent("initiative", data, { id: `it${i + 1}` });
    intakeIds.push(e.id);
  }
  [["sales", "customer"], ["marketing", "product"], ["product", "operations"], ["data", "tech"], ["finance", "hr"]].forEach(([a, b], i) =>
    rels.push({ id: `r${i}`, organization_id: ORG, from_id: heads[a].id, to_id: heads[b].id, rel_type: "shares_info", from_type: "role", to_type: "role" }));

  const byId = (id) => ents.find((e) => e.id === id);
  const d = {
    org: { id: ORG, name: "Northwind Traders", org_kind: "standalone", role: "company_admin", currency: "USD", workspace_id: "ws1" },
    user: { id: "u1", name: "Wadi Bardawil", email: "wadi@example.com", global_role: "platform_admin" },
    ents, rels, byId, calls: [], jobs: {}, nextId: () => `n${++n}`,
    systems: () => ents.filter((e) => e.etype === "system"),
    intake: () => ents.filter((e) => e.etype === "initiative" && e.data.intake_kind),
    hoursPerMonth,
    /** Derived numbers the pages compute; each flow compares the UI against these. */
    expected() {
      const sys = this.systems(), items = this.intake();
      const kindOf = (s) => (KINDS.includes(s.data.kind) ? s.data.kind : "");
      const groups = {};
      [...KINDS, ""].forEach((k) => { const c = sys.filter((s) => kindOf(s) === k).length; if (c) groups[k || "unclassified"] = c; });
      return {
        systems: { total: sys.length, groups, api: sys.filter((s) => s.data.api_available === "yes").length, mcp: sys.filter((s) => s.data.mcp_available === "yes").length,
          verified: sys.filter((s) => s.data.verified_integration).length, unclassified: sys.filter((s) => !KINDS.includes(s.data.kind)).length,
          monthly: sys.reduce((a, s) => a + ((s.data.cost_period || "monthly") !== "one_off" ? Number(s.data.cost_estimate) || 0 : 0), 0) },
        intake: { total: items.length, initiative: items.filter((r) => r.data.intake_kind === "initiative").length,
          pain_point: items.filter((r) => r.data.intake_kind === "pain_point").length, slow_task: items.filter((r) => r.data.intake_kind === "slow_task").length,
          hours: Math.round(items.reduce((a, r) => a + hoursPerMonth(r.data), 0)), unclassified: items.filter((r) => !r.data.feasibility_class).length,
          groups: items.reduce((m, r) => { const w = (r.data.raised_by || "").trim() || "Not attributed"; m[w] = (m[w] || 0) + 1; return m; }, {}) },
        feasibility: { total: items.length, final: items.filter((r) => r.data.feasibility_class).length,
          draft: items.filter((r) => !r.data.feasibility_class && r.data.feasibility_draft_class).length,
          none: items.filter((r) => !r.data.feasibility_class && !r.data.feasibility_draft_class).length,
          quick: items.filter((r) => r.data.feasibility?.final?.quick_win).length },
      };
    },
  };
  return d;
}

// ---- route table ------------------------------------------------------------------------------------
const STAGES = [{ key: "discovery", label: "Discovery", gated: false }, { key: "assessing", label: "Assessing", gated: false },
  { key: "approved", label: "Approved", gated: true }, { key: "live", label: "Live", gated: true }];
const EXTRACTED_ITEMS = (raisedBy) => [
  { name: "Archivo de comisiones mensual", intake_kind: "slow_task", area: "finance", raised_by: raisedBy || "", frequency: "monthly", time_per_occurrence_hours: 32, people_involved: 3, urgency: "high", impact: "medium", evidence_quote: "Cada mes perdemos una semana con el archivo de comisiones.", systems_involved: ["HubSpot"] },
  { name: "Portal de clientes", intake_kind: "initiative", area: "customer", raised_by: "COO", evidence_quote: "Queremos lanzar un portal de clientes." },
  { name: "Errores en el cierre contable", intake_kind: "pain_point", area: "finance", frequency: "monthly", evidence_quote: "El cierre contable tiene errores." },
];

/** Install the mock on a Playwright BrowserContext. Every request is logged in `d.calls` ({method, path, body}). */
async function installRoutes(ctx, d) {
  await ctx.addInitScript(() => localStorage.setItem("bots_token", "mock"));
  await ctx.route("**/api/**", (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api/, "");
    const method = req.method();
    let body = null;
    if (["POST", "PUT", "PATCH"].includes(method)) { try { body = req.postDataJSON(); } catch { body = req.postData(); } }
    d.calls.push({ method, path: p, body });
    const json = (obj, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(obj) });
    const fail = (status, detail) => json({ detail }, status);
    const seg = p.split("/");
    const withRels = (e) => ({ ...e, relationships: d.rels.filter((r) => r.from_id === e.id || r.to_id === e.id) });

    // ---- import (CSV dialog and transcript import): mirrors routes_engagement.import_rows ------------------
    if (p.endsWith("/import") && method === "POST") {
      const rows = body.rows || [];
      const created = [], updated = [], skipped = [], errors = [];
      const seen = new Set();
      rows.forEach((r, idx) => {
        const i = idx + 1;
        const name = String(r.name || "").trim();
        if (!name) { errors.push({ row: i, field: "name", reason: "name is required" }); return; }
        if (body.etype === "system" && !r.kind) { errors.push({ row: i, field: "kind", reason: "kind is required" }); return; }
        const key = name.toLowerCase();
        if (seen.has(key)) { skipped.push({ row: i, name, reason: "duplicate row in this file" }); return; }
        seen.add(key);
        const existing = d.ents.find((e) => e.etype === body.etype && !e.archived && String(e.data.name || "").toLowerCase() === key);
        if (existing) {
          if (body.on_conflict === "update") { if (!body.dry_run) { Object.assign(existing.data, r); existing.version += 1; } updated.push(existing.id); }
          else skipped.push({ row: i, name, reason: "already exists", id: existing.id });
          return;
        }
        if (body.dry_run) { created.push(`row-${i}`); return; }
        const id = d.nextId();
        const data = { ...r, import_key: key, source: body.source || "csv_import" };
        if (body.etype === "initiative") { data.stage = "discovery"; data.stage_history = [{ stage: "discovery", at: ISO, by: d.user.name, note: body.source }]; }
        d.ents.push({ id, etype: body.etype, organization_id: ORG, workspace_id: "ws1", status: "draft", state: "current", version: 1, is_demo: false, archived: false,
          created_at: ISO, updated_at: ISO, last_reviewed_at: null, data });
        created.push(id);
      });
      return json({ etype: body.etype, dry_run: !!body.dry_run, created, updated, skipped, errors,
        counts: { created: created.length, updated: updated.length, skipped: skipped.length, errors: errors.length } });
    }

    // ---- feasibility: batch run (two-poll flip) and human review ------------------------------------------
    if (p.endsWith("/feasibility/run") && method === "POST") {
      const force = !!(body && body.force);
      const todo = [], skipped = [];
      d.intake().forEach((e) => {
        const fz = e.data.feasibility || {};
        if (!force && (fz.final || (fz.draft && fz.review_action !== "rejected"))) skipped.push(e.id); else todo.push(e.id);
      });
      if (!todo.length) return json({ job_id: null, queued: 0, skipped: skipped.length });
      const id = `job${Object.keys(d.jobs).length + 1}`;
      d.jobs[id] = { id, status: "queued", total: todo.length, done: 0, ok: 0, failed: 0, polls: 0, items: todo, force };
      return json({ job_id: id, queued: todo.length, skipped: skipped.length });
    }
    if (/\/feasibility\/jobs\/[^/]+$/.test(p) && method === "GET") {
      const job = d.jobs[seg[seg.length - 1]];
      if (!job) return fail(404, "Job not found");
      job.polls += 1;
      if (job.polls < 2) { job.status = "running"; return json({ id: job.id, status: "running", total: job.total, done: 0, ok: 0, failed: 0 }); }
      if (job.status !== "done") {
        job.items.forEach((eid, i) => {
          const e = d.byId(eid); if (!e) return;
          const cls = CLASSES[(i + 2) % CLASSES.length];
          const content = { classification: cls, confidence: pick(["medium", "high", "low"], i), rationale: "Drafted by the batch run: the rule fits the system already in use.",
            systems_used: cls === "not_tech" || cls === "buy" ? [] : (e.data.systems_involved || []).slice(0, 1), what_to_do: "Enable the native feature and schedule the report.",
            prerequisites: [], risks: [], estimated_effort: pick(["S", "M", "L"], i), quick_win: i % 3 === 0, suggested_phase: 1, open_questions: [] };
          e.data.feasibility = { ...(e.data.feasibility || {}), draft: { label: "AI_DRAFT", kind: "feasibility", accepted: false, model: "fake-1", prompt_version: "feas-v1", generated_at: ISO, run_id: job.id, content } };
          delete e.data.feasibility.review_action;
          e.data.feasibility_draft_class = cls; e.version += 1;
        });
        job.status = "done"; job.done = job.total; job.ok = job.total;
      }
      return json({ id: job.id, status: "done", total: job.total, done: job.total, ok: job.total, failed: 0 });
    }
    if (p.endsWith("/feasibility/review") && method === "POST") {
      const e = d.byId(seg[2]);
      if (!e) return fail(404, "Not found");
      if (!["accepted", "overridden", "rejected"].includes(body.action)) return fail(400, "action must be accepted, overridden or rejected");
      if (body.version !== e.version) return fail(409, "Record changed since you loaded it. Reload and retry.");
      const fz = e.data.feasibility || {};
      const draftContent = fz.draft?.content || null;
      let fin = null;
      if (body.action === "accepted") { if (!draftContent) return fail(400, "Nothing to accept: no AI draft on this record"); fin = draftContent; }
      else if (body.action === "overridden") {
        if (!body.final || !CLASSES.includes(body.final.classification)) return fail(400, `final.classification must be one of ${CLASSES.join(", ")}`);
        fin = { ...(draftContent || {}), ...body.final };
      }
      e.data.feasibility = { ...fz, final: fin, review_action: body.action, reviewed_by: d.user.name, reviewed_at: "2026-10-12T10:00:00Z", review_note: (body.note || "").slice(0, 1000) };
      if (fz.draft) e.data.feasibility.draft = { ...fz.draft, accepted: body.action === "accepted" };
      if (fin) e.data.feasibility_class = fin.classification;
      else { delete e.data.feasibility_class; delete e.data.feasibility_draft_class; }
      e.version += 1; e.updated_at = ISO;
      return json(withRels(e));
    }

    // ---- AI ------------------------------------------------------------------------------------------------
    if (p === "/ai/status") return json({ enabled: true, provider: "fake", model: "fake-1" });
    if (p === "/ai/extract-intake") return json({ label: "AI_DRAFT", kind: "intake_extract", accepted: false, model: "fake-1", prompt_version: "intake-v1",
      assumptions: "Drafted from the pasted text only.", content: { items: EXTRACTED_ITEMS(body && body.raised_by) } });
    if (p === "/ai/suggest") return json({ label: "AI_DRAFT", accepted: false, content: "Suggested next step (mock).", assumptions: "Mock provider." });

    // ---- scope ---------------------------------------------------------------------------------------------
    if (p === "/auth/me") return json(d.user);
    if (p === "/workspaces") return json([{ id: "ws1", name: "Arkiva Workspace" }]);
    if (p === "/organizations") return json([d.org]);
    if (p === "/portfolios") return json([]);
    if (p === "/meta/framework") return json({});
    if (p === "/views") return json([{ id: "v1", kind: "operating_map", placements: {} }]);
    if (p.endsWith("/framework-layout")) return json({ overrides: {} });
    if (p.endsWith("/stages")) return json({ stages: STAGES, is_custom: false, can_edit: true });
    if (p.endsWith("/dashboard")) return json({ widgets: [], is_personal: false, has_default: false, can_publish_default: true });
    if (p.endsWith("/analytics")) return json({ currency: "USD", records: [], stage_counts: {}, phase_counts: { 1: 0, 2: 0, 3: 0 }, stages: [], inventory: { by_type: {}, by_area: {}, total: 0, missing_owner: 0, never_reviewed: 0 } });
    if (p.endsWith("/reminders")) return json({ reminders: [], count: 0 });
    if (p.endsWith("/diff")) return json({ has_snapshot: false });
    if (p.endsWith("/snapshots")) return json([]);
    if (p.endsWith("/audit")) return json([]);
    if (p === "/relationships" && method === "GET") return json(d.rels);

    // ---- entities ------------------------------------------------------------------------------------------
    if (p === "/entities" && method === "GET") { const t = u.searchParams.get("etype"); return json(d.ents.filter((e) => !e.archived && (!t || e.etype === t))); }
    if (p === "/entities" && method === "POST") {
      const id = d.nextId();
      const e = { id, etype: body.etype, organization_id: ORG, workspace_id: "ws1", status: body.status || "draft", state: body.state || "current", version: 1,
        is_demo: false, archived: false, created_at: ISO, updated_at: ISO, last_reviewed_at: null, data: { ...(body.data || {}) } };
      if (["initiative", "opportunity"].includes(e.etype) && !e.data.stage) e.data.stage = "discovery";
      d.ents.push(e);
      return json(withRels(e));
    }
    if (p === "/entities/bulk" && method === "POST") return json({ updated: body.ids || [], skipped: [] });
    if (seg[1] === "entities" && seg[2]) {
      const e = d.byId(seg[2]);
      if (!e) return fail(404, "Not found");
      if (seg.length === 3 && method === "GET") return json(withRels(e));
      if (seg.length === 3 && method === "PUT") {
        if (body.version !== e.version) return fail(409, "Record changed since you loaded it. Reload and retry.");
        if (body.data) e.data = { ...e.data, ...body.data };
        if (body.status) e.status = body.status;
        e.version += 1; e.updated_at = ISO;
        return json(withRels(e));
      }
      if (seg[3] === "review" && method === "POST") { e.last_reviewed_at = ISO; return json({ ok: true, last_reviewed_at: ISO }); }
      if (seg[3] === "stage" && method === "POST") {
        if (body.version !== e.version) return fail(409, "Record changed since you loaded it. Reload and retry.");
        e.data.stage = body.stage; e.data.stage_history = [...(e.data.stage_history || []), { stage: body.stage, at: ISO, by: d.user.name, note: "" }]; e.version += 1;
        return json(withRels(e));
      }
      if (seg[3] === "attachments") return json([]);
      if (seg[3] === "impact") return json({ direct: [], indirect: [] });
    }
    return json([]);
  });
}

module.exports = { makeDataset, installRoutes, hoursPerMonth, CLASSES, KINDS, INTAKE_KINDS, AREAS, ORG };
