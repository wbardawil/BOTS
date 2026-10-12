// Honest ROI / impact math. Missing inputs stay missing — never silently zero.

export function annualCost(cost, period) {
  if (cost == null) return null;
  if (period === "monthly") return cost * 12;
  if (period === "per_use") return null; // can't annualize without volume — stays unknown
  return cost; // one_off or unspecified: treat captured figure as-is
}

export function timeFreedValue(hours, rate) {
  if (hours == null || rate == null) return null;
  return hours * rate;
}

// Returns a trustworthy ROI view for one record.
export function roiOf(r) {
  const cost = annualCost(r.cost, r.cost_period);
  const tfValue = timeFreedValue(r.time_freed_hours, r.hourly_rate);
  const hasRealized = r.realized_benefit != null;
  let benefit = hasRealized ? r.realized_benefit : r.expected_benefit;
  if (benefit == null && tfValue != null) benefit = tfValue;
  else if (benefit != null && tfValue != null && hasRealized) benefit = r.realized_benefit + 0; // keep realized authoritative
  const complete = cost != null && benefit != null;
  let roiPct = null;
  if (complete && cost > 0) roiPct = ((benefit - cost) / cost) * 100;
  let status = "incomplete";
  if (complete) {
    if (hasRealized) {
      status = r.expected_benefit != null && r.realized_benefit < r.expected_benefit * 0.9
        ? "below" : "realized";
    } else status = roiPct != null && roiPct >= 0 ? "on_track" : "below";
  }
  return { cost, benefit, tfValue, roiPct, status, complete, hasRealized };
}

export const ROI_STATUS = {
  realized: { label: "Realized", cls: "bg-green-50 text-green-700 border-green-200" },
  on_track: { label: "On track", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  below: { label: "Below expectation", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  incomplete: { label: "Not measured yet", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

export function sum(arr) {
  return arr.reduce((a, b) => a + (b || 0), 0);
}

export function money(v, currency = "USD") {
  if (v == null) return "—";
  return `${currency} ${Math.round(v).toLocaleString()}`;
}

export function rollup(records) {
  const views = records.map(roiOf);
  const cost = sum(views.map((v) => v.cost));
  const expected = sum(records.map((r) => r.expected_benefit));
  const realized = sum(records.map((r) => r.realized_benefit));
  const complete = views.filter((v) => v.complete);
  const measured = records.filter((r) => r.cost != null || r.expected_benefit != null || r.realized_benefit != null).length;
  const roiPct = cost > 0 ? ((sum(complete.map((v) => v.benefit)) - sum(complete.map((v) => v.cost))) / sum(complete.map((v) => v.cost)) * 100) : null;
  return { cost, expected, realized, roiPct: complete.length ? roiPct : null, measured, total: records.length };
}
