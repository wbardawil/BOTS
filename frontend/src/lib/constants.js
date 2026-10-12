import {
  Target, Layers, GitBranch, Workflow, Bot, Database, BookOpen, Rocket,
  ClipboardCheck, Users, LineChart, Gavel, Settings, Building2, Boxes, Cpu, FileText,
} from "lucide-react";

export const ETYPE = {
  capability: { label: "Capability", color: "168 82% 45%", icon: Layers },
  process: { label: "Process", color: "199 89% 55%", icon: Workflow },
  role: { label: "Role / Agent Role", color: "210 30% 70%", icon: Users },
  system: { label: "System", color: "262 72% 66%", icon: Cpu },
  knowledge_source: { label: "Knowledge Source", color: "190 70% 55%", icon: Database },
  opportunity: { label: "Opportunity", color: "38 92% 56%", icon: Target },
  agent: { label: "Agent", color: "168 82% 45%", icon: Bot },
  workflow: { label: "Workflow", color: "199 89% 55%", icon: Workflow },
  initiative: { label: "Initiative", color: "262 72% 66%", icon: Rocket },
  playbook: { label: "Playbook", color: "38 92% 56%", icon: BookOpen },
  adoption_assignment: { label: "Adoption", color: "340 75% 60%", icon: ClipboardCheck },
  metric: { label: "Metric", color: "199 89% 55%", icon: LineChart },
  evidence: { label: "Evidence", color: "150 60% 55%", icon: FileText },
  decision: { label: "Decision", color: "38 92% 56%", icon: Gavel },
  department: { label: "Department", color: "210 30% 70%", icon: Building2 },
  risk_review: { label: "Risk Review", color: "0 72% 60%", icon: Gavel },
};

export const MAIN_TABS = [
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

export const STATUS_COLORS = {
  draft: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  in_review: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  published: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  archived: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export const PHASE_META = {
  1: { label: "Phase 1 · AI Co-Pilots", color: "168 82% 45%" },
  2: { label: "Phase 2 · AI Brains", color: "199 89% 55%" },
  3: { label: "Phase 3 · Autonomous", color: "262 72% 66%" },
};
