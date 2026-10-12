"""Enumerated-field validation for the schemaless entity engine.

Mirrors the frontend manifest (frontend/src/lib/fields.js) for the NEW enumerated fields only. Legacy keys
and legacy records are untouched: validation checks only keys listed here, and None / "" are allowed (clear).
"""
import re
import unicodedata

AREA_KEYS = ["strategy", "product", "operations", "marketing", "sales", "customer", "data", "tech", "finance", "hr", "legal"]
YES_NO_UNKNOWN = ["yes", "no", "unknown"]
LEVEL = ["low", "medium", "high"]
SOURCING = ["buy", "build", "hybrid"]
COST_PERIOD = ["monthly", "one_off", "per_use"]
DATA_SENSITIVITY = ["public", "internal", "confidential", "personal_data"]
RISK_CATEGORY = ["privacy", "security", "accuracy", "bias", "human_agency", "operational", "financial", "legal"]
FEASIBILITY_CLASSES = ["current_stack", "configure", "build", "buy", "not_tech"]

_SOURCING_RISK = {"sourcing": SOURCING, "cost_period": COST_PERIOD, "risk_level": LEVEL,
                  "risk_category": RISK_CATEGORY, "data_sensitivity": DATA_SENSITIVITY}

FIELD_ENUMS = {
    "system": {
        "kind": ["saas", "custom", "database", "spreadsheet", "integration", "infrastructure", "device"],
        "area": AREA_KEYS,
        "cost_period": COST_PERIOD,
        "criticality": LEVEL,
        "hosting": ["cloud", "on_prem", "hybrid", "desktop"],
        "system_status": ["active", "planned", "retiring", "retired"],
        "data_sensitivity": DATA_SENSITIVITY,
        "api_available": YES_NO_UNKNOWN,
        "api_type": ["rest", "graphql", "soap", "sdk", "webhook", "file_export", "none"],
        "auth_method": ["api_key", "oauth2", "basic", "token", "sso", "none", "unknown"],
        "mcp_available": YES_NO_UNKNOWN,
    },
    "initiative": {
        "intake_kind": ["initiative", "pain_point", "slow_task"],
        "area": AREA_KEYS,
        "frequency": ["daily", "weekly", "monthly", "quarterly", "ad_hoc"],
        "urgency": LEVEL,
        "impact": LEVEL,
        "feasibility_class": FEASIBILITY_CLASSES,
    },
    "opportunity": {"area": AREA_KEYS},
    "agent": {"area": AREA_KEYS, **_SOURCING_RISK},
    "workflow": {"area": AREA_KEYS, **_SOURCING_RISK},
    "role": {"area": AREA_KEYS, "type": ["human_executive", "coordination_agent", "human_head", "ai_lead", "ai_developer", "employee", "note", "system"]},
    "capability": {"area": AREA_KEYS},
    "process": {"area": AREA_KEYS},
    "knowledge_source": {"area": AREA_KEYS},
    "playbook": {"area": AREA_KEYS},
}

NUMERIC_KEYS = {"cost_estimate", "budget", "baseline", "target", "candidate_phase", "expected_benefit", "realized_benefit",
                "time_freed_hours", "hourly_rate", "users_count", "seats", "time_per_occurrence_hours", "people_involved"}

# Keys only the server may write (jobs, probes, review endpoints). Rejected on plain create/update.
PROTECTED_KEYS = {"feasibility", "feasibility_class", "feasibility_draft_class", "verified_integration", "last_probe"}


def validate_data(etype: str, data: dict, *, allow_protected: bool = False) -> list:
    """Return a list of human-readable problems (empty when valid)."""
    problems = []
    if not isinstance(data, dict):
        return ["data must be an object"]
    enums = FIELD_ENUMS.get(etype, {})
    for key, allowed in enums.items():
        if key not in data:
            continue
        v = data[key]
        if v is None or v == "":
            continue
        if not isinstance(v, str) or v not in allowed:
            problems.append(f"{key}: {v!r} is not one of {', '.join(allowed)}")
    for key in NUMERIC_KEYS:
        if key in data and data[key] not in (None, ""):
            try:
                float(data[key])
            except (TypeError, ValueError):
                problems.append(f"{key}: {data[key]!r} is not a number")
    if not allow_protected:
        for key in PROTECTED_KEYS:
            if key in data:
                problems.append(f"{key}: set by the server only")
    return problems


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "untitled"


def import_key(etype: str, name: str) -> str:
    return f"{etype}:{slug(name)}"
