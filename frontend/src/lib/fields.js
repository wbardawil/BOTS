// ---------------------------------------------------------------------------------------------
// Field manifest: ONE definition per record type drives the drawer, the create dialog, the CSV
// import mapping/template and the CSV export. Labels carry {es, en}; the UI picks a locale.
// Backend mirror of the enumerated fields: backend/fields.py (validated on create/update/import).
// ---------------------------------------------------------------------------------------------
import { CANON_AREAS, SOURCING, COST_PERIODS, RISK_LEVELS, RISK_CATEGORIES, DATA_SENSITIVITY } from "@/lib/constants";

const o = (key, es, en) => ({ key, es, en });

export const VOCAB = {
  system_kind: [o("saas", "SaaS / aplicación de negocio", "SaaS / business app"), o("custom", "Software propio", "Custom software"),
    o("database", "Base de datos", "Database"), o("spreadsheet", "Hoja de cálculo que opera como sistema", "Spreadsheet acting as a system"),
    o("integration", "Integración / automatización", "Integration / automation"), o("infrastructure", "Infraestructura", "Infrastructure"),
    o("device", "Dispositivo", "Device")],
  yes_no_unknown: [o("yes", "Sí", "Yes"), o("no", "No", "No"), o("unknown", "Desconocido", "Unknown")],
  api_type: [o("rest", "REST", "REST"), o("graphql", "GraphQL", "GraphQL"), o("soap", "SOAP", "SOAP"), o("sdk", "SDK", "SDK"),
    o("webhook", "Webhook", "Webhook"), o("file_export", "Exportación de archivos", "File export"), o("none", "Ninguna", "None")],
  auth_method: [o("api_key", "API key", "API key"), o("oauth2", "OAuth 2", "OAuth 2"), o("basic", "Usuario y contraseña", "Basic"),
    o("token", "Token", "Token"), o("sso", "SSO", "SSO"), o("none", "Sin autenticación", "None"), o("unknown", "Desconocido", "Unknown")],
  hosting: [o("cloud", "Nube", "Cloud"), o("on_prem", "En sitio", "On-premises"), o("hybrid", "Híbrido", "Hybrid"), o("desktop", "Escritorio", "Desktop")],
  criticality: [o("low", "Baja", "Low"), o("medium", "Media", "Medium"), o("high", "Alta", "High")],
  system_status: [o("active", "Activo", "Active"), o("planned", "Planeado", "Planned"), o("retiring", "En retiro", "Retiring"), o("retired", "Retirado", "Retired")],
  intake_kind: [o("initiative", "Iniciativa", "Initiative"), o("pain_point", "Dolor", "Pain point"), o("slow_task", "Tarea lenta", "Slow task")],
  frequency: [o("daily", "Diario", "Daily"), o("weekly", "Semanal", "Weekly"), o("monthly", "Mensual", "Monthly"), o("quarterly", "Trimestral", "Quarterly"), o("ad_hoc", "Esporádico", "Ad hoc")],
  level: [o("low", "Baja", "Low"), o("medium", "Media", "Medium"), o("high", "Alta", "High")],
  feasibility_class: [o("current_stack", "Ya lo tienes", "Current stack"), o("configure", "Configurar", "Configure"),
    o("build", "Construir", "Build"), o("buy", "Comprar", "Buy"), o("not_tech", "No es tecnología", "Not a technology problem")],
  effort: [o("S", "S", "S"), o("M", "M", "M"), o("L", "L", "L")],
  role_type: [o("human_executive", "Ejecutivo", "Executive"), o("coordination_agent", "Agente coordinador", "Coordination agent"),
    o("human_head", "Responsable de área", "Head of area"), o("ai_lead", "Líder de IA", "AI lead"), o("ai_developer", "Desarrollador de IA", "AI developer"), o("employee", "Colaborador", "Employee")],
  area: CANON_AREAS.map((a) => o(a.key, a.label, a.label)),
  sourcing: Object.entries(SOURCING).map(([k, v]) => o(k, { buy: "Comprar", build: "Construir", hybrid: "Híbrido" }[k], v.label)),
  cost_period: Object.entries(COST_PERIODS).map(([k, v]) => o(k, { monthly: "mensual", one_off: "único", per_use: "por uso / por asiento" }[k], v)),
  risk_level: Object.entries(RISK_LEVELS).map(([k, v]) => o(k, { low: "Bajo", medium: "Medio", high: "Alto" }[k], v.label)),
  risk_category: RISK_CATEGORIES.map((k) => o(k, k.replace(/_/g, " "), k.replace(/_/g, " "))),
  data_sensitivity: Object.entries(DATA_SENSITIVITY).map(([k, v]) => o(k, { public: "Pública", internal: "Interna", confidential: "Confidencial", personal_data: "Datos personales" }[k], v)),
};

// row: { key, es, en, type, options?, section, create?, csv?, required?, readonly? }
// type: text | textarea | number | select | bool | date | readonly | json
const f = (key, es, en, type = "text", extra = {}) => ({ key, es, en, type, section: "overview", csv: true, ...extra });
const sel = (key, es, en, options, extra = {}) => f(key, es, en, "select", { options, ...extra });

const SOURCING_ROWS = [
  sel("sourcing", "Decisión de abastecimiento", "Sourcing decision", "sourcing", { section: "sourcing", create: true }),
  f("vendor", "Proveedor o plataforma", "Vendor or platform", "text", { section: "sourcing", create: true }),
  f("cost_estimate", "Costo estimado", "Cost estimate", "number", { section: "sourcing", create: true }),
  sel("cost_period", "Periodo del costo", "Cost period", "cost_period", { section: "sourcing", create: true }),
  f("currency", "Moneda", "Currency", "text", { section: "sourcing" }),
  f("cost_notes", "Notas de costo", "Cost notes", "textarea", { section: "sourcing" }),
];
const RISK_ROWS = [
  sel("risk_level", "Nivel de riesgo", "Risk level", "risk_level", { section: "risk", create: true }),
  sel("risk_category", "Categoría de riesgo", "Risk category", "risk_category", { section: "risk" }),
  sel("data_sensitivity", "Sensibilidad de datos", "Data sensitivity", "data_sensitivity", { section: "risk", create: true }),
  f("regulatory_flags", "Marcos regulatorios", "Regulatory flags", "text", { section: "risk" }),
  f("required_controls", "Controles requeridos", "Required controls", "textarea", { section: "risk" }),
  f("risk_notes", "Notas de riesgo", "Risk notes", "textarea", { section: "risk" }),
];

export const FIELDS = {
  system: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }),
    sel("kind", "Tipo", "Kind", "system_kind", { create: true, required: true }),
    f("vendor", "Proveedor", "Vendor", "text", { create: true }),
    f("version", "Versión", "Version"),
    sel("area", "Área", "Area", "area", { create: true }),
    f("owner", "Dueño de negocio", "Business owner", "text", { create: true }),
    f("tech_owner", "Dueño técnico", "Technical owner"),
    f("users_count", "Usuarios", "Users", "number"),
    f("seats", "Licencias", "Seats", "number"),
    f("cost_estimate", "Costo estimado", "Cost estimate", "number", { create: true }),
    sel("cost_period", "Periodo del costo", "Cost period", "cost_period", { create: true }),
    f("currency", "Moneda", "Currency"),
    sel("criticality", "Criticidad", "Criticality", "criticality"),
    sel("hosting", "Alojamiento", "Hosting", "hosting"),
    sel("system_status", "Estado del sistema", "System status", "system_status"),
    sel("data_sensitivity", "Sensibilidad de datos", "Data sensitivity", "data_sensitivity"),
    sel("api_available", "API disponible", "API available", "yes_no_unknown", { section: "integration", create: true }),
    sel("api_type", "Tipo de API", "API type", "api_type", { section: "integration" }),
    f("api_docs_url", "Documentación de la API (URL)", "API docs URL", "text", { section: "integration" }),
    sel("auth_method", "Método de autenticación", "Auth method", "auth_method", { section: "integration" }),
    sel("mcp_available", "Servidor MCP disponible", "MCP server available", "yes_no_unknown", { section: "integration", create: true }),
    f("mcp_server_url", "URL del servidor MCP", "MCP server URL", "text", { section: "integration" }),
    f("integration_notes", "Notas de integración", "Integration notes", "textarea", { section: "integration" }),
    f("verified_integration", "Integración verificada", "Verified integration", "readonly", { section: "integration", csv: false }),
    f("last_probe", "Última prueba de conexión", "Last probe", "json", { section: "integration", csv: false }),
    f("source", "Origen del registro", "Record source", "readonly", { section: "integration", csv: false }),
    f("import_key", "Clave de importación", "Import key", "readonly", { section: "hidden", csv: false }),
  ],
  initiative: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }),
    sel("intake_kind", "Tipo de captura", "Intake kind", "intake_kind", { section: "intake", create: true }),
    sel("area", "Área", "Area", "area", { create: true }),
    f("owner", "Responsable", "Owner", "text", { create: true }),
    f("business_problem", "Problema de negocio", "Business problem", "textarea", { create: true }),
    f("intended_outcome", "Resultado esperado", "Intended outcome", "textarea"),
    f("deliverables", "Entregables", "Deliverables", "textarea"),
    f("budget", "Presupuesto", "Budget", "number", { create: true }),
    f("currency", "Moneda", "Currency", "text", { create: true }),
    f("start_date", "Fecha de inicio", "Start date", "date"),
    f("target_date", "Fecha objetivo", "Target date", "date"),
    f("raised_by", "Planteada por", "Raised by", "text", { section: "intake", create: true }),
    f("raised_by_role", "Puesto de quien la plantea", "Raised by (role)", "text", { section: "intake" }),
    f("current_process", "Proceso actual", "Current process", "textarea", { section: "intake" }),
    sel("frequency", "Frecuencia", "Frequency", "frequency", { section: "intake" }),
    f("time_per_occurrence_hours", "Horas por ocurrencia", "Hours per occurrence", "number", { section: "intake" }),
    f("people_involved", "Personas involucradas", "People involved", "number", { section: "intake" }),
    f("systems_involved", "Sistemas involucrados", "Systems involved", "readonly", { section: "intake" }),
    sel("urgency", "Urgencia", "Urgency", "level", { section: "intake" }),
    sel("impact", "Impacto", "Impact", "level", { section: "intake" }),
    f("evidence_quote", "Cita textual", "Evidence quote", "textarea", { section: "intake" }),
    f("source", "Origen del registro", "Record source", "readonly", { section: "intake", csv: false }),
    f("feasibility_class", "Veredicto de factibilidad", "Feasibility verdict", "readonly", { section: "feasibility", csv: true }),
    f("feasibility", "Factibilidad (detalle)", "Feasibility (detail)", "json", { section: "feasibility", csv: false }),
    f("import_key", "Clave de importación", "Import key", "readonly", { section: "hidden", csv: false }),
  ],
  opportunity: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }),
    sel("area", "Área", "Area", "area", { create: true }),
    f("business_problem", "Problema de negocio", "Business problem", "textarea", { create: true }),
    f("intended_outcome", "Resultado esperado", "Intended outcome", "textarea", { create: true }),
    f("proposed_change", "Cambio propuesto", "Proposed change", "textarea"),
    f("candidate_phase", "Fase candidata (1-3)", "Candidate phase (1-3)", "number", { create: true }),
    f("readiness", "Preparación", "Readiness"), f("effort", "Esfuerzo", "Effort"), f("risk", "Riesgo", "Risk"),
    f("priority", "Prioridad", "Priority", "text", { create: true }), f("owner", "Responsable", "Owner"), f("decision", "Decisión", "Decision"),
  ],
  agent: [
    f("name", "Nombre (por rol)", "Role-based name", "text", { create: true, required: true }),
    f("display_name", "Nombre visible", "Display name"),
    f("purpose", "Propósito", "Purpose", "textarea", { create: true }),
    sel("area", "Área", "Area", "area"),
    f("trigger", "Disparador", "Trigger"), f("inputs", "Entradas", "Inputs"), f("outputs", "Salidas", "Outputs"),
    f("human_owner", "Responsable humano", "Human accountable owner", "text", { section: "responsibilities", create: true }),
    f("allowed_actions", "Acciones permitidas", "Allowed actions", "textarea", { section: "responsibilities", create: true }),
    f("prohibited_actions", "Acciones prohibidas", "Prohibited actions", "textarea", { section: "responsibilities", create: true }),
    ...SOURCING_ROWS, ...RISK_ROWS,
  ],
  workflow: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }),
    f("description", "Descripción", "Description", "textarea", { create: true }),
    sel("area", "Área", "Area", "area"),
    ...SOURCING_ROWS, ...RISK_ROWS,
  ],
  knowledge_source: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }), f("owner", "Dueño", "Owner", "text", { create: true }),
    f("freshness_rule", "Regla de vigencia", "Freshness rule", "text", { create: true }), f("access", "Acceso", "Access"), sel("area", "Área", "Area", "area"),
  ],
  playbook: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }),
    f("business_problem", "Problema de negocio", "Business problem", "textarea", { create: true }),
    f("proposed_workflow", "Flujo propuesto", "Proposed workflow", "textarea", { create: true }),
    sel("area", "Área", "Area", "area"),
  ],
  metric: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }), f("unit", "Unidad", "Unit", "text", { create: true }),
    f("definition", "Definición", "Definition", "textarea", { create: true }), f("baseline", "Línea base", "Baseline", "number", { create: true }),
    f("target", "Meta", "Target", "number", { create: true }), f("observation", "Observación", "Observation"),
    f("verification_status", "Estado de verificación", "Verification status"), f("period", "Periodo", "Period"),
  ],
  evidence: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }), f("type", "Tipo", "Type", "text", { create: true }),
    f("content", "Contenido", "Content", "textarea", { create: true }),
  ],
  decision: [
    f("name", "Decisión", "Decision", "text", { create: true, required: true }), f("approver", "Aprobador", "Approver", "text", { create: true }),
    f("rationale", "Justificación", "Rationale", "textarea", { create: true }),
  ],
  capability: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }), sel("area", "Área", "Area", "area", { create: true }),
    f("current_state", "Estado actual", "Current state", "text", { create: true }), f("target_state", "Estado objetivo", "Target state", "text", { create: true }),
    f("outcome_measure", "Medida de resultado", "Outcome measure"), f("applicable", "Aplica", "Applicable", "bool"),
  ],
  process: [
    f("name", "Nombre", "Name", "text", { create: true, required: true }), f("owner", "Dueño", "Owner", "text", { create: true }),
    sel("area", "Área", "Area", "area"), f("description", "Descripción", "Description", "textarea"),
    f("current_state", "Estado actual", "Current state", "text", { create: true }), f("target_state", "Estado objetivo", "Target state", "text", { create: true }),
  ],
  role: [
    f("name", "Nombre del rol", "Role name", "text", { create: true, required: true }), sel("type", "Tipo de rol", "Role type", "role_type", { create: true }),
    f("accountable_owner", "Persona responsable", "Accountable person", "text", { create: true }), sel("area", "Área", "Area", "area", { create: true }),
  ],
};

export const fieldsFor = (etype, pred) => (FIELDS[etype] || []).filter(pred || (() => true));
export const sectionKeys = (etype, section) => fieldsFor(etype, (r) => r.section === section).map((r) => r.key);
export const fieldLabel = (row, locale = "en") => (row && (row[locale] || row.en)) || "";
export const hasSection = (etype, section) => fieldsFor(etype, (r) => r.section === section).length > 0;

/** Label for an enumerated value, in the given locale; falls back to the raw value. */
export function labelFor(etype, key, value, locale = "en") {
  const row = fieldsFor(etype).find((r) => r.key === key);
  const opts = row && row.options ? VOCAB[row.options] : null;
  const hit = opts && opts.find((x) => x.key === value);
  if (hit) return hit[locale] || hit.en;
  // not in this etype's manifest: try any vocabulary that owns this key name
  const any = VOCAB[key] && VOCAB[key].find((x) => x.key === value);
  if (any) return any[locale] || any.en;
  return value == null ? "" : String(value).replace(/_/g, " ");
}

/** Options for a manifest row: [{key, label}] */
export const optionsFor = (row, locale = "en") => (row && row.options && VOCAB[row.options] ? VOCAB[row.options] : []).map((x) => ({ key: x.key, label: x[locale] || x.en }));
