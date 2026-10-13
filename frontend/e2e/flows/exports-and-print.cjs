// Exports and print: the framework board at contract scale (11 reference-model cards, 11 roadmap rows, no page error),
// the three PNG exports with their expected dimensions, and the executive summary printing to one A4 page.
"use strict";
const fs = require("fs");
const path = require("path");

// Reference-model card headers "{n}. {label}" for the 11 canonical areas (src/lib/constants.js CANON_AREAS).
const CANON = ["Strategy & Leadership", "Product / Service Management", "Operations & Supply Chain", "Marketing & Growth", "Sales",
  "Customer & Admin", "Data & Analytics", "Tech, AI & Automations", "Finance", "Human Resources", "Legal, Risk & Compliance"];
const AREA_KEYS = ["strategy", "product", "operations", "marketing", "sales", "customer", "data", "tech", "finance", "hr", "legal"];
// src/views/FrameworkCanvas.jsx: board CW+40 × CH+40 at pixelRatio 1, plus the 30px stamp line under the image.
const FRAMEWORK_PNG = { width: 2680, height: 2130 };

/** Number of pages in a PDF: the /Count of the page tree, else the /Type /Page objects. */
function pdfPages(buf) {
  const s = buf.toString("latin1");
  const tree = s.match(/\/Type\s*\/Pages\b[\s\S]{0,400}?\/Count\s+(\d+)/);
  if (tree) return Number(tree[1]);
  return (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
}

module.exports = {
  name: "exports-and-print",
  async run(t) {
    const { page, data, eq, expect, shot, count } = t;

    // ---- framework canvas at contract scale --------------------------------------------------------------
    await t.nav("framework", '[data-testid="framework-canvas"]', 0);
    await page.waitForSelector('[data-testid="fc-loading"]', { state: "detached", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const canvas = page.locator('[data-testid="framework-canvas"]');
    for (let i = 0; i < CANON.length; i++) {
      eq(await canvas.getByText(`${i + 1}. ${CANON[i]}`, { exact: true }).count(), 1, `reference-model card ${i + 1}. ${CANON[i]}`);
    }
    for (const k of AREA_KEYS) expect(await page.$(`[data-testid="fc-add-${k}-1"]`), `roadmap row for ${k}`);
    eq(await count('[data-testid^="fc-add-"]'), AREA_KEYS.length * 3, "roadmap rows × phases");
    expect((await count('[data-testid^="fc-rec-"]')) >= 100, "the board draws the records as chips");
    eq(data.systems().length, 45, "dataset at contract scale: 45 systems");
    eq(data.intake().length, 60, "dataset at contract scale: 60 intake items");
    await shot("framework-all");
    for (const [k, label] of [["A", "org-chart"], ["B", "reference-model"], ["C", "roadmap"], ["D", "value-chain"]]) {
      await page.click(`[data-testid="fc-fit-${k}"]`);
      await page.waitForTimeout(300);
      await shot(`framework-${label}`);
    }
    eq(t.pageErrors.length, 0, `no page error while rendering the board (${t.pageErrors.join(" | ")})`);

    // ---- PNG exports -------------------------------------------------------------------------------------
    await page.click('[data-testid="fc-fit-all"]');
    await page.waitForTimeout(300);
    const fw = await t.download('[data-testid="fc-export-btn"]');
    eq({ width: fw.width, height: fw.height }, FRAMEWORK_PNG, `framework PNG dimensions (${fw.name})`);
    expect(/-framework-\d{4}-\d{2}-\d{2}\.png$/.test(fw.name), `framework export file name: ${fw.name}`);

    await t.nav("tech", '[data-testid="tech-inventory"]', 300);
    await page.click('[data-testid="tech-mode-map"]');
    await page.waitForSelector('[data-testid="tech-map"]');
    await page.waitForTimeout(300);
    const tm = await t.download('[data-testid="tech-export-png-btn"]');
    expect(tm.width > 2000, `tech map PNG is wider than 2000px (${tm.width}×${tm.height})`);
    expect(tm.height > 200, `tech map PNG has a body (${tm.width}×${tm.height})`);
    expect(/-tech-map-\d{4}-\d{2}-\d{2}\.png$/.test(tm.name), `tech map export file name: ${tm.name}`);

    await t.nav("feasibility", '[data-testid="feas-board"]', 300);
    await page.click('[data-testid="feas-mode-matrix"]');
    await page.waitForSelector('[data-testid="feas-matrix"]');
    await page.waitForTimeout(300);
    const mx = await t.download('[data-testid="feas-export-btn"]');
    expect(mx.width > 2000, `feasibility matrix PNG is wider than 2000px (${mx.width}×${mx.height})`);
    expect(mx.height > 200, `feasibility matrix PNG has a body (${mx.width}×${mx.height})`);
    expect(/-feasibility-matrix-\d{4}-\d{2}-\d{2}\.png$/.test(mx.name), `matrix export file name: ${mx.name}`);

    // ---- executive summary prints to one A4 page -------------------------------------------------------
    await t.nav("summary", '[data-testid="summary-sheet"]', 800);
    const sections = await page.$$eval('[data-testid^="summary-"] h3', (els) => els.map((e) => e.textContent.split(" · ")[0].trim()));
    eq(sections, ["1", "2", "3", "4", "5", "6"], "the six summary sections render");
    expect(new RegExp(`(^|\\D)${data.systems().length}\\s*sistemas registrados`).test(await t.text('[data-testid="summary-inventory"]')), "summary counts the systems");
    expect(new RegExp(`(^|\\D)${data.intake().length}\\s*temas capturados`).test(await t.text('[data-testid="summary-intake"]')), "summary counts the intake items");
    await shot("summary", { fullPage: true });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await page.emulateMedia({ media: "screen" });
    fs.writeFileSync(path.join(t.outDir, "summary.pdf"), pdf);
    eq(pdfPages(pdf), 1, `summary prints to exactly one A4 page (${pdf.length} bytes)`);
    eq(t.pageErrors.length, 0, `no page error during exports and print (${t.pageErrors.join(" | ")})`);
  },
};
