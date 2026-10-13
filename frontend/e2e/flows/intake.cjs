// Leadership intake: stat tiles (hours per month computed like src/pages/Intake.jsx), groups by who raised the item,
// transcript extraction with one row unticked, and the intake form's field order.
"use strict";

// Mirror of INTAKE_FORM_KEYS in src/pages/Intake.jsx: the create dialog must ask for exactly these, in this order.
const INTAKE_FORM_KEYS = ["name", "intake_kind", "area", "raised_by", "raised_by_role", "owner", "business_problem",
  "intended_outcome", "current_process", "frequency", "time_per_occurrence_hours", "people_involved", "urgency", "impact", "evidence_quote"];
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "none";
const TRANSCRIPT = "CEO: Cada mes perdemos una semana con el archivo de comisiones. Se exporta de HubSpot y se arma en Excel por 3 personas.\n\n"
  + "COO: Queremos lanzar un portal de clientes para que vean sus pedidos sin llamar.\n\nCFO: El cierre contable tiene errores cada mes.";

module.exports = {
  name: "intake",
  async run(t) {
    const { page, data, eq, expect, shot, num, count } = t;
    const exp = data.expected().intake;
    await t.nav("intake", '[data-testid="intake-page"]');

    // ---- stats: counts by kind, hours per month, unclassified -------------------------------------------
    eq(await num('[data-testid="intake-stat-total"]'), exp.total, "stat: items captured");
    eq(await num('[data-testid="intake-stat-initiative"]'), exp.initiative, "stat: initiatives");
    eq(await num('[data-testid="intake-stat-pain_point"]'), exp.pain_point, "stat: pain points");
    eq(await num('[data-testid="intake-stat-slow_task"]'), exp.slow_task, "stat: slow tasks");
    eq(await num('[data-testid="intake-stat-hours"]'), exp.hours, "stat: hours per month (sum of hoursPerMonth over the items)");
    expect(exp.hours > 0, "the dataset carries recurring hours");
    eq(await num('[data-testid="intake-stat-unclassified"]'), exp.unclassified, "stat: awaiting a verdict");

    // ---- groups by who raised the item ------------------------------------------------------------------
    const groups = await page.$$eval('[data-testid="intake-page"] tbody tr', (trs) => {
      const out = {}; let cur = null;
      trs.forEach((tr) => {
        const id = tr.getAttribute("data-testid") || "";
        if (id.startsWith("intake-group-")) { cur = id.replace("intake-group-", ""); out[cur] = 0; }
        else if (id.startsWith("intake-row-") && cur) out[cur] += 1;
      });
      return out;
    });
    eq(groups, Object.fromEntries(Object.entries(exp.groups).map(([who, n]) => [slug(who), n])), "rows grouped by who raised them");
    eq(await count('[data-testid^="intake-row-"]'), exp.total, "one row per item");
    await shot("intake", { fullPage: true });

    // ---- transcript: extract, untick one, import N-1 ----------------------------------------------------
    await page.click('[data-testid="intake-transcript-btn"]');
    await page.waitForSelector('[data-testid="transcript-dialog"]');
    await page.fill('[data-testid="transcript-raised-by"]', "Ana Ruiz");
    await page.fill('[data-testid="transcript-text"]', TRANSCRIPT);
    await shot("transcript-paste");
    const beforeExtract = data.calls.length;
    await page.click('[data-testid="transcript-extract-btn"]');
    await page.waitForSelector('[data-testid="transcript-items"]');
    await page.waitForTimeout(300);
    const { call: extract } = await t.waitForCall((c) => c.path === "/ai/extract-intake", { after: beforeExtract });
    eq(extract.body.raised_by, "Ana Ruiz", "raised_by travels with the transcript");
    eq(extract.body.text, TRANSCRIPT, "the pasted text is sent verbatim");
    const n = await count('[data-testid^="transcript-item-"]');
    eq(n, 3, "extracted rows shown");
    const shownNames = await page.$$eval('[data-testid^="transcript-name-"]', (els) => els.map((e) => e.value));
    eq(shownNames, ["Archivo de comisiones mensual", "Portal de clientes", "Errores en el cierre contable"], "rows are the mocked items");
    await page.click('[data-testid="transcript-check-1"]');
    await page.waitForTimeout(150);
    eq(await t.text('[data-testid="transcript-import-btn"]'), `Import ${n - 1} items`, "import button counts the ticked rows");
    await shot("transcript-items");
    const beforeImport = data.calls.length;
    await page.click('[data-testid="transcript-import-btn"]');
    await page.waitForSelector('[data-testid="transcript-report"]');
    const { call: imp } = await t.waitForCall((c) => c.method === "POST" && c.path.endsWith("/import"), { after: beforeImport });
    eq(imp.body.etype, "initiative", "transcript rows import as initiatives");
    eq(imp.body.source, "transcript", "import source");
    eq(imp.body.rows.map((r) => r.name), ["Archivo de comisiones mensual", "Errores en el cierre contable"], "the unticked row is left out");
    eq(imp.body.rows[0].raised_by, "Ana Ruiz", "raised_by default applied to the row");
    const report = await t.text('[data-testid="transcript-report"]');
    const m = report.match(/(\d+) created · (\d+) skipped \(already existed\) · (\d+) errors/);
    expect(m, `report shows the counts: ${report}`);
    eq(m.slice(1).map(Number), [n - 1, 0, 0], "report counts");
    await shot("transcript-report");
    await page.click('[data-testid="transcript-close"]');
    await page.waitForSelector('[data-testid="transcript-dialog"]', { state: "detached" });
    const after = data.expected().intake;
    eq(after.total, exp.total + n - 1, "the mock stored the imported rows");
    await t.waitUntil((want) => (document.querySelector('[data-testid="intake-stat-total"]')?.textContent || "").includes(String(want)), after.total);
    eq(await num('[data-testid="intake-stat-total"]'), after.total, "stat: items captured after the import");
    eq(await num('[data-testid="intake-stat-unclassified"]'), after.unclassified, "stat: awaiting a verdict after the import");

    // ---- intake form: the manifest keys, in order -------------------------------------------------------
    await page.click('[data-testid="intake-new-btn"]');
    await page.waitForSelector('[data-testid="field-name"]');
    await page.waitForTimeout(200);
    const keys = await page.$$eval('[data-testid^="field-"]', (els) => els.map((e) => e.getAttribute("data-testid").replace("field-", "")));
    eq(keys, INTAKE_FORM_KEYS, "intake form fields in manifest order");
    await shot("intake-form");
    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-testid="field-name"]', { state: "detached" });
  },
};
