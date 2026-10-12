import {
  Target, Layers, GitBranch, Workflow, Bot, Database, BookOpen, Rocket,
  ClipboardCheck, Users, LineChart, Gavel, Settings, Building2, Boxes, Cpu, FileText, LayoutDashboard,
  LayoutGrid, Columns3, FolderSearch,
} from "lucide-react";

// ---- Design tokens (mirror of memory/DESIGN.md §2) ----------------------------------------
export const INK = "#111827";    // text, black pills, primary buttons
export const MUTED = "#6b7280";  // secondary text
export const LINE = "#e5e7eb";   // every border
export const PAPER = "#ffffff";
export const SURFACE2 = "#f3f4f6";

// Function families — the only content hues. Color encodes the family, not the department.
export const FAMILY = {
  leadership: "#111827",
  build: "#3b82f6",
  revenue: "#22c55e",
  intelligence: "#f59e0b",
  finance: "#9ca3af",
  people: "#8b5cf6",
  governance: "#6b7280",
};
export const tint = (hex, alpha = "1f") => `${hex}${alpha}`;

// Record-type accents (HSL triplets for hsl(var) usage); darkened for white backgrounds
export const ETYPE = {
  capability: { label: "Capability", color: "217 91% 50%", icon: Layers },
  process: { label: "Process", color: "217 91% 50%", icon: Workflow },
  role: { label: "Role / Agent Role", color: "220 9% 46%", icon: Users },
  system: { label: "System", color: "258 90% 60%", icon: Cpu },
  knowledge_source: { label: "Knowledge Source", color: "38 92% 42%", icon: Database },
  opportunity: { label: "Opportunity", color: "38 92% 42%", icon: Target },
  agent: { label: "Agent", color: "142 71% 38%", icon: Bot },
  workflow: { label: "Workflow", color: "142 71% 38%", icon: Workflow },
  initiative: { label: "Initiative", color: "222 47% 11%", icon: Rocket },
  playbook: { label: "Playbook", color: "38 92% 42%", icon: BookOpen },
  adoption_assignment: { label: "Adoption", color: "258 90% 60%", icon: ClipboardCheck },
  metric: { label: "Metric", color: "217 91% 50%", icon: LineChart },
  evidence: { label: "Evidence", color: "142 71% 38%", icon: FileText },
  decision: { label: "Decision", color: "220 9% 46%", icon: Gavel },
  department: { label: "Department", color: "220 9% 46%", icon: Building2 },
  risk_review: { label: "Risk Review", color: "0 72% 45%", icon: Gavel },
};

export const MAIN_TABS = [
  { id: "dashboard", label: "Dashboards", icon: LayoutGrid },
  { id: "inventory", label: "Inventory", icon: FolderSearch },
  { id: "pipeline", label: "Pipeline", icon: Columns3 },
  { id: "framework", label: "Framework Canvas", icon: LayoutDashboard },
  { id: "operating_map", label: "Operating Map", icon: GitBranch },
  { id: "capability_model", label: "Capability Model", icon: Layers },
  { id: "value_chain", label: "Value Chain", icon: Workflow },
  { id: "roadmap", label: "Transformation Roadmap", icon: Rocket },
  { id: "executive", label: "Executive Overview", icon: LineChart },
];

export const SECONDARY_NAV = [
  { id: "opportunity", label: "Opportunities", icon: Target, etypes: ["opportunity"] },
  { id: "agent", label: "Agents & Workflows", icon: Bot, etypes: ["agent", "workflow"] },
  { id: "systems", label: "Systems & Knowledge", icon: Cpu, etypes: ["system", "knowledge_source"] },
  { id: "playbook", label: "Playbooks", icon: BookOpen, etypes: ["playbook"] },
  { id: "initiative", label: "Initiatives", icon: Rocket, etypes: ["initiative"] },
  { id: "assessment", label: "Assessments", icon: ClipboardCheck, special: true },
  { id: "adoption_assignment", label: "Adoption", icon: ClipboardCheck, etypes: ["adoption_assignment"] },
  { id: "metric", label: "Metrics & Evidence", icon: LineChart, etypes: ["metric", "evidence"] },
  { id: "decision", label: "Decisions & Governance", icon: Gavel, etypes: ["decision", "risk_review"] },
  { id: "oversight", label: "Group Oversight", icon: Boxes, special: true },
  { id: "settings", label: "Settings", icon: Settings, special: true },
];

// Light-theme status badges
export const STATUS_COLORS = {
  draft: "bg-amber-50 text-amber-800 border-amber-200",
  in_review: "bg-blue-50 text-blue-700 border-blue-200",
  published: "bg-green-50 text-green-700 border-green-200",
  archived: "bg-gray-100 text-gray-600 border-gray-200",
};

// Phases are grayscale so hue stays reserved for function families. Phase 3 = dashed (not yet built).
export const PHASES = [
  { n: 1, name: "AI Co-Pilots", color: "#111827", dashed: false },
  { n: 2, name: "AI Brains", color: "#4b5563", dashed: false },
  { n: 3, name: "Autonomous Agents", color: "#9ca3af", dashed: true },
];
export const PHASE_META = {
  1: { label: "Phase 1 · AI Co-Pilots", color: "222 47% 11%", hex: "#111827", dashed: false },
  2: { label: "Phase 2 · AI Brains", color: "220 9% 31%", hex: "#4b5563", dashed: false },
  3: { label: "Phase 3 · Autonomous", color: "220 9% 61%", hex: "#9ca3af", dashed: true },
};

// 11 canonical business areas (fixed id, number and order). `color` = function-family hue.
export const CANON_AREAS = [
  { no: 1, key: "strategy", label: "Strategy & Leadership", family: "leadership", color: FAMILY.leadership },
  { no: 2, key: "product", label: "Product / Service Management", family: "build", color: FAMILY.build },
  { no: 3, key: "operations", label: "Operations & Supply Chain", family: "build", color: FAMILY.build },
  { no: 4, key: "marketing", label: "Marketing & Growth", family: "build", color: FAMILY.build },
  { no: 5, key: "sales", label: "Sales", family: "revenue", color: FAMILY.revenue },
  { no: 6, key: "customer", label: "Customer & Admin", family: "revenue", color: FAMILY.revenue },
  { no: 7, key: "data", label: "Data & Analytics", family: "intelligence", color: FAMILY.intelligence },
  { no: 8, key: "tech", label: "Tech, AI & Automations", family: "intelligence", color: FAMILY.intelligence },
  { no: 9, key: "finance", label: "Finance", family: "finance", color: FAMILY.finance },
  { no: 10, key: "hr", label: "Human Resources", family: "people", color: FAMILY.people },
  { no: 11, key: "legal", label: "Legal, Risk & Compliance", family: "governance", color: FAMILY.governance },
];
export const AREA_BY_KEY = Object.fromEntries(CANON_AREAS.map((a) => [a.key, a]));

// 9 functional branches of the operating/agent org chart (reference top band order)
export const FUNCTION_BRANCHES = [
  { key: "sales", label: "Sales", color: FAMILY.revenue },
  { key: "customer", label: "Customer & Admin", color: FAMILY.revenue },
  { key: "marketing", label: "Marketing & Growth", color: FAMILY.build },
  { key: "product", label: "Product / Service", color: FAMILY.build },
  { key: "operations", label: "Operations & Supply Chain", color: FAMILY.build },
  { key: "data", label: "Data & Analytics", color: FAMILY.intelligence },
  { key: "tech", label: "Tech, AI & Automations", color: FAMILY.intelligence },
  { key: "finance", label: "Finance", color: FAMILY.finance },
  { key: "hr", label: "Human Resources", color: FAMILY.people },
];

// ---- Sourcing decision and risk overlay (per agent / workflow) ------------------------------
// Mirrors the "buy, build or hybrid · vendor cost · risk and compliance notes" payload a buyer
// expects on every workflow. Stored in entity.data; no backend schema change (entity engine is schemaless).
export const SOURCING = {
  buy: { label: "Buy", hint: "Licensed vendor product; configure, do not code" },
  build: { label: "Build", hint: "Custom, in-house; owns the model/workflow code" },
  hybrid: { label: "Hybrid", hint: "Vendor platform plus custom workflow or data layer" },
};
export const COST_PERIODS = { monthly: "per month", one_off: "one-off", per_use: "per use / per seat" };
export const RISK_LEVELS = {
  low: { label: "Low", color: "#9ca3af" },
  medium: { label: "Medium", color: "#f59e0b" },
  high: { label: "High", color: "#dc2626" },
};
export const RISK_CATEGORIES = ["privacy", "security", "accuracy", "bias", "human_agency", "operational", "financial", "legal"];
export const DATA_SENSITIVITY = { public: "Public", internal: "Internal", confidential: "Confidential", personal_data: "Personal data" };
export const REGULATORY_FLAGS = ["eu_ai_act", "gdpr", "soc2", "hipaa", "pci", "industry"];
// Keys the detail drawer renders as a select instead of free text
export const SELECT_FIELDS = {
  sourcing: Object.keys(SOURCING),
  cost_period: Object.keys(COST_PERIODS),
  risk_level: Object.keys(RISK_LEVELS),
  risk_category: RISK_CATEGORIES,
  data_sensitivity: Object.keys(DATA_SENSITIVITY),
};
export const NUMERIC_FIELDS = ["cost_estimate", "budget", "baseline", "target", "candidate_phase",
  "expected_benefit", "realized_benefit", "time_freed_hours", "hourly_rate"];
export const SOURCING_RISK_KEYS = ["sourcing", "vendor", "cost_estimate", "cost_period", "currency", "cost_notes",
  "risk_level", "risk_category", "data_sensitivity", "regulatory_flags", "required_controls", "risk_notes"];

// ---- Lifecycle pipeline (fixed 8 stages for this release) ----------------------------------
export const STAGES = [
  { key: "discovery", label: "Discovery" },
  { key: "assessing", label: "Assessing" },
  { key: "alternatives", label: "Alternatives" },
  { key: "offer", label: "Offer" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In progress" },
  { key: "live", label: "Live" },
  { key: "realized", label: "Realized" },
];
export const STAGE_KEYS = STAGES.map((s) => s.key);
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
export const GATED_STAGES = new Set(["approved", "in_progress", "live", "realized"]);
export const PIPELINE_ETYPES = ["initiative", "opportunity"];

// Record types managed in the central inventory
export const INVENTORY_ETYPES = ["initiative", "opportunity", "agent", "workflow", "system",
  "knowledge_source", "playbook", "metric", "evidence", "decision", "adoption_assignment",
  "capability", "process", "role"];

// Keys the drawer renders as fields on the Lifecycle & Value tab
export const BENEFIT_KEYS = ["expected_benefit", "realized_benefit", "time_freed_hours",
  "hourly_rate", "went_live_at"];

// ---- Adjustable dashboard widget library -----------------------------------------------------
export const WIDGET_LIBRARY = [
  { type: "roi_rollup", label: "ROI rollup", desc: "Cost vs expected & realized benefit, company-wide" },
  { type: "roi_by_initiative", label: "ROI by initiative", desc: "Per-record cost, benefit, ROI % and status" },
  { type: "time_freed", label: "Time freed", desc: "Hours released, optionally valued at a rate" },
  { type: "measurement_cadence", label: "Measurement cadence", desc: "Expected vs realized at 3 / 6 / 12 months" },
  { type: "lifecycle_throughput", label: "Lifecycle throughput", desc: "Counts by stage — live vs in flight" },
  { type: "inventory_health", label: "Inventory health", desc: "Records by type and what is missing data" },
];
export const WIDGET_META = Object.fromEntries(WIDGET_LIBRARY.map((w) => [w.type, w]));
export const WIDGET_SPAN = { sm: "md:col-span-2", md: "md:col-span-3", lg: "md:col-span-6" };
export const WIDGET_SIZES = ["sm", "md", "lg"];
