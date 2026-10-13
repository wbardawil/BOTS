// Feasibility map: stat tiles, the batch run (progress then "N drafted"), review by drag (accept / override / reject)
// and the matrix whose column totals equal the board's column counts.
"use strict";

const COLS = [["current_stack", "Current stack"], ["configure", "Configure"], ["build", "Build"], ["buy", "Buy"], ["not_tech", "Not a technology problem"], ["unclassified", "Unclassified"]];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
  name: "feasibility",
  async run(t) {
    const { page, data, eq, expect, shot, num } = t;
    const stats = async () => ({ total: await num('[data-testid="feas-stat-total"]'), final: await num('[data-testid="feas-stat-final"]'),
      draft: await num('[data-testid="feas-stat-draft"]'), none: await num('[data-testid="feas-stat-none"]'), quick: await num('[data-testid="feas-stat-quick"]') });
    const colCounts = () => page.$$eval('[data-testid^="feas-col-"]', (els) =>
      Object.fromEntries(els.map((e) => [e.getAttribute("data-testid").replace("feas-col-", ""), e.querySelectorAll('[data-testid^="feas-card-"]').length])));
    const cardIn = (id, col) => page.$(`[data-testid="feas-col-${col}"] [data-testid="feas-card-${id}"]`);
    const lastReview = (after) => t.waitForCall((c) => c.method === "POST" && c.path.endsWith("/feasibility/review"), { after });

    await t.nav("feasibility", '[data-testid="feas-board"]');
    const exp = data.expected().feasibility;
    eq(await stats(), exp, "stat tiles match the dataset");
    expect(exp.final >= 15 && exp.draft >= 15 && exp.none >= 15, "contract-scale mix of finals, drafts and unclassified");
    await shot("board");

    // ---- batch run: progress, then "N drafted" ----------------------------------------------------------
    eq(await t.text('[data-testid="feas-run-btn"]'), `Classify ${exp.none} pending`, "run button counts the pending items");
    const beforeRun = data.calls.length;
    await page.click('[data-testid="feas-run-btn"]');
    await page.waitForSelector('[data-testid="feas-job-progress"]');
    const progressLabel = await t.text('[data-testid="feas-run-btn"]');
    expect(new RegExp(`^Classifying \\d+ / ${exp.none}…$`).test(progressLabel), `run button shows progress: "${progressLabel}"`);
    const { call: run } = await t.waitForCall((c) => c.path.endsWith("/feasibility/run"), { after: beforeRun });
    eq(run.body.force, false, "a normal run does not force re-drafts");
    await page.waitForSelector('[data-testid="feas-job-progress"]', { state: "detached", timeout: 20000 });
    await page.getByText(`${exp.none} drafted, 0 failed`).waitFor({ timeout: 5000 });
    expect(data.calls.filter((c) => /\/feasibility\/jobs\/[^/]+$/.test(c.path)).length >= 2, "the job was polled until it finished");
    await t.waitUntil(() => (document.querySelector('[data-testid="feas-stat-none"]')?.textContent || "").startsWith("0"));
    const afterRun = data.expected().feasibility;
    eq(await stats(), afterRun, "stat tiles after the run");
    eq(afterRun.none, 0, "every pending item got a draft");
    eq(afterRun.draft, exp.draft + exp.none, "drafts grew by the queued count");
    await shot("after-run");

    // ---- review by drag ---------------------------------------------------------------------------------
    const items = data.intake();
    const drafts = items.filter((r) => !r.data.feasibility_class && r.data.feasibility_draft_class);
    const a = drafts.find((r) => r.data.feasibility_draft_class === "build");
    const b = drafts.find((r) => r.data.feasibility_draft_class === "buy");
    const c = items.find((r) => r.data.feasibility_class === "configure");
    expect(a && b && c, "cards to review exist in every needed state");

    // a draft dragged to its own class → accepted
    let before = data.calls.length;
    const aVersion = data.byId(a.id).version;
    await t.drag(`[data-testid="feas-card-${a.id}"]`, '[data-testid="feas-col-build"]');
    let { call } = await lastReview(before);
    eq(call.path, `/entities/${a.id}/feasibility/review`, "review call targets the dragged card");
    eq(call.body.action, "accepted", "drag to its own class accepts the draft");
    eq(call.body.version, aVersion, "review sends the record version the board loaded");
    await page.waitForTimeout(400);
    expect(await cardIn(a.id, "build"), "accepted card stays in Build");
    eq(await page.$eval(`[data-testid="feas-card-${a.id}"]`, (e) => e.style.borderStyle), "solid", "accepted card is drawn solid");
    eq(data.byId(a.id).data.feasibility_class, "build", "mock recorded the final class");

    // a draft dragged to another class → overridden
    before = data.calls.length;
    await t.drag(`[data-testid="feas-card-${b.id}"]`, '[data-testid="feas-col-build"]');
    ({ call } = await lastReview(before));
    eq(call.body.action, "overridden", "drag to another class overrides the draft");
    eq(call.body.final, { classification: "build" }, "override carries the target class");
    expect(typeof call.body.note === "string" && call.body.note.length > 0, "override from the board carries a note");
    await page.waitForTimeout(400);
    expect(await cardIn(b.id, "build"), "overridden card lands in Build");
    expect(!(await cardIn(b.id, "buy")), "overridden card left Buy");

    // a classified card dragged to Unclassified → rejected
    before = data.calls.length;
    await t.drag(`[data-testid="feas-card-${c.id}"]`, '[data-testid="feas-col-unclassified"]');
    ({ call } = await lastReview(before));
    eq(call.body.action, "rejected", "drag to Unclassified rejects the verdict");
    await page.waitForTimeout(400);
    expect(await cardIn(c.id, "unclassified"), "rejected card lands in Unclassified");
    expect(!(await cardIn(c.id, "configure")), "rejected card left Configure");
    eq(await stats(), { ...afterRun, final: afterRun.final + 2 - 1, draft: afterRun.draft - 2, none: 1, quick: data.expected().feasibility.quick }, "stat tiles after the three reviews");
    await shot("reviewed");

    // ---- matrix column totals equal the board column counts ---------------------------------------------
    const boardCounts = await colCounts();
    eq(Object.values(boardCounts).reduce((x, y) => x + y, 0), afterRun.total, "board holds every item");
    await page.click('[data-testid="feas-mode-matrix"]');
    await page.waitForSelector('[data-testid="feas-matrix"]');
    await page.waitForTimeout(400);
    const matrixTotals = {};
    for (const [key, label] of COLS) {
      const header = page.locator('[data-testid="feas-matrix"] div').filter({ hasText: new RegExp(`^${esc(label)} · \\d+$`) }).first();
      matrixTotals[key] = Number((await header.textContent()).match(/(\d+)$/)[1]);
    }
    eq(matrixTotals, boardCounts, "matrix column totals equal the board column counts");
    const chipTotals = await page.$$eval('[data-testid^="feas-cell-"]', (cells) => {
      const out = {};
      cells.forEach((cell) => { const col = cell.getAttribute("data-testid").split("-").pop(); const k = col === "none" ? "unclassified" : col; out[k] = (out[k] || 0) + cell.querySelectorAll('[data-testid^="feas-chip-"]').length; });
      return out;
    });
    eq(chipTotals, boardCounts, "matrix chips per column equal the board column counts");
    await shot("matrix", { fullPage: true });
  },
};
