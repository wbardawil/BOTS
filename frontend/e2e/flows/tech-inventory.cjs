// Technology inventory: table groups and counts, kind filter, map chips, CSV import dry run with Spanish headers.
"use strict";
const path = require("path");

const FIXTURE = path.join(__dirname, "..", "fixtures", "systems.csv");
// fixtures/systems.csv headers, in order: Nombre;Tipo;Proveedor;Área;API disponible;Costo
const EXPECTED_MAPPING = ["name", "kind", "vendor", "area", "api_available", "cost_estimate"];

module.exports = {
  name: "tech-inventory",
  async run(t) {
    const { page, data, eq, expect, shot, num, count } = t;
    const exp = data.expected().systems;
    await t.nav("tech", '[data-testid="tech-inventory"]');

    // ---- stat tiles and table groups match the dataset ----------------------------------------------
    eq(await num('[data-testid="tech-stat-total"]'), exp.total, "stat: systems");
    eq(await num('[data-testid="tech-stat-api"]'), exp.api, "stat: with an API");
    eq(await num('[data-testid="tech-stat-mcp"]'), exp.mcp, "stat: with an MCP server");
    eq(await num('[data-testid="tech-stat-verified"]'), exp.verified, "stat: verified connections");
    eq(await num('[data-testid="tech-stat-unclassified"]'), exp.unclassified, "stat: without a kind");
    eq(await num('[data-testid="tech-stat-monthly"]'), exp.monthly, "stat: monthly run-rate");
    const groups = await page.$$eval('[data-testid^="tech-count-"]', (els) =>
      Object.fromEntries(els.map((e) => [e.getAttribute("data-testid").replace("tech-count-", ""), Number(e.textContent.replace(/\D/g, ""))])));
    eq(groups, exp.groups, "table groups and counts by kind");
    eq(await count('[data-testid^="tech-row-"]'), exp.total, "table rows");
    await shot("table", { fullPage: true });

    // ---- kind filter narrows the rows -------------------------------------------------------------------
    await page.selectOption('[data-testid="tech-kind-filter"]', "saas");
    await page.waitForTimeout(300);
    eq(await count('[data-testid^="tech-row-"]'), exp.groups.saas, "rows after the saas filter");
    expect(exp.groups.saas < exp.total, "the saas filter narrows the table");
    await page.click('[data-testid="tech-clear"]');
    await page.waitForTimeout(200);
    eq(await count('[data-testid^="tech-row-"]'), exp.total, "rows after clearing the filter");

    // ---- map mode: one chip per system -------------------------------------------------------------------
    await page.click('[data-testid="tech-mode-map"]');
    await page.waitForSelector('[data-testid="tech-map"]');
    await page.waitForTimeout(400);
    eq(await count('[data-testid^="tech-chip-"]'), exp.total, "map chips");
    await shot("map", { fullPage: true });
    await page.click('[data-testid="tech-mode-table"]');
    await page.waitForTimeout(300);

    // ---- CSV import: Spanish headers auto-matched, dry run reports 2 created / 1 skipped ---------------
    await page.click('[data-testid="tech-import-btn"]');
    await page.waitForSelector('[data-testid="import-dialog"]');
    await page.setInputFiles('[data-testid="import-file"]', FIXTURE);
    await page.waitForSelector('[data-testid="import-map-0"]');
    await page.waitForTimeout(300);
    const mapping = await page.$$eval('[data-testid^="import-map-"]', (els) => els.map((e) => e.value));
    eq(mapping, EXPECTED_MAPPING, "column mapping auto-matched from the Spanish headers");
    await shot("import-mapping");
    const before = data.calls.length;
    await page.click('[data-testid="import-dry-run-btn"]');
    await page.waitForSelector('[data-testid="import-report"]');
    await page.waitForTimeout(300);
    const { call } = await t.waitForCall((c) => c.method === "POST" && c.path.endsWith("/import"), { after: before });
    eq(call.body.dry_run, true, "dry run flag sent to the import endpoint");
    eq(call.body.etype, "system", "import etype");
    eq(call.body.rows.map((r) => r.name), ["Salesforce", "HubSpot", "Almacén de datos"], "imported row names");
    eq(call.body.rows[0], { name: "Salesforce", kind: "saas", vendor: "Salesforce", area: "sales", api_available: "yes", cost_estimate: "2400" }, "first row payload");
    eq(await num('[data-testid="import-report-created"]'), 2, "dry run: would be created");
    eq(await num('[data-testid="import-report-skipped"]'), 1, "dry run: skipped (HubSpot already exists)");
    eq(await num('[data-testid="import-report-errors"]'), 0, "dry run: errors");
    expect((await t.text('[data-testid="import-report"]')).includes('"HubSpot": already exists'), "report names the skipped row");
    await shot("import-report");
    await page.click('[data-testid="import-close"]');
    await page.waitForSelector('[data-testid="import-dialog"]', { state: "detached" });
    eq(await num('[data-testid="tech-stat-total"]'), exp.total, "a dry run creates nothing");
  },
};
