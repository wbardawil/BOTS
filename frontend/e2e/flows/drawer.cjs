// Detail drawer: the Integration tab keeps focus while typing, a Feasibility override with a note shows the note after
// save, and a plain form save on a classified record never sends the server-only feasibility keys.
"use strict";

// Mirror of PROTECTED_KEYS in src/lib/fields.js that a form save must never send.
const PROTECTED = ["feasibility", "feasibility_class", "feasibility_draft_class"];
const NOTE = "SAP already matches invoices";

module.exports = {
  name: "drawer",
  async run(t) {
    const { page, data, eq, expect, shot } = t;
    const openDrawerFor = async (name) => {
      await page.waitForSelector('[data-testid="detail-drawer"]');
      await page.waitForSelector('[data-testid="drawer-title"]');
      eq(await t.text('[data-testid="drawer-title"]'), name, "drawer shows the clicked record");
    };

    // ---- 1. system Integration tab: focus survives typing (the FOCUS check) -----------------------------
    const sys = data.systems()[0];
    await t.nav("tech", '[data-testid="tech-inventory"]');
    await page.click(`[data-testid="tech-row-${sys.id}"]`);
    await openDrawerFor(sys.data.name);
    await page.click('[data-testid="dtab-Integration"]');
    await page.waitForSelector('[data-testid="integration-tab"]');
    await shot("integration-tab");
    await page.click('[data-testid="drawer-edit-btn"]');
    await page.click('[data-testid="edit-api_docs_url"]');
    await page.keyboard.type("abc", { delay: 40 });
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-testid"));
    eq(focused, "edit-api_docs_url", "FOCUS: the input keeps focus while typing");
    eq(await page.inputValue('[data-testid="edit-api_docs_url"]'), "abc", "every keystroke landed in the input");
    await shot("integration-edit");
    await t.closeDrawer();

    // ---- 2. initiative Feasibility tab: override with a note, note shown after save --------------------
    const draft = data.intake().find((r) => !r.data.feasibility_class && r.data.feasibility_draft_class === "buy");
    expect(draft, "a draft item classified buy exists");
    await t.nav("feasibility", '[data-testid="feas-board"]');
    await page.click(`[data-testid="feas-card-${draft.id}"]`);
    await openDrawerFor(draft.data.name);
    await page.click('[data-testid="dtab-Feasibility"]');
    await page.waitForSelector('[data-testid="feasibility-tab"]');
    expect((await t.text('[data-testid="feasibility-tab"]')).includes("AI draft"), "the AI draft block is shown");
    await page.click('[data-testid="feas-override"]');
    await page.selectOption('[data-testid="feas-override-class"]', "current_stack");
    await page.fill('[data-testid="feas-override-note"]', NOTE);
    await shot("drawer-override");
    const before = data.calls.length;
    const draftVersion = draft.version;
    await page.click('[data-testid="feas-override-save"]');
    const { call } = await t.waitForCall((c) => c.method === "POST" && c.path === `/entities/${draft.id}/feasibility/review`, { after: before });
    eq(call.body, { action: "overridden", final: { classification: "current_stack" }, note: NOTE, version: draftVersion }, "override payload (record version as loaded)");
    await page.locator('[data-testid="feasibility-tab"]').getByText(NOTE).waitFor({ timeout: 10000 });
    const tab = await t.text('[data-testid="feasibility-tab"]');
    expect(tab.includes(`“${NOTE}”`), "the note is shown next to the final verdict");
    expect(tab.includes("overridden by Wadi Bardawil"), "the review stamp is shown");
    expect(tab.includes("Final verdict") && tab.includes("Current stack"), "the final verdict shows the overriding class");
    eq(await page.locator('[data-testid="feasibility-tab"]').getByText("Change verdict").count(), 1, "review section now offers to change the verdict");
    await shot("drawer-after-override");
    await t.closeDrawer();

    // ---- 3. a form save on a classified record does not send protected keys -----------------------------
    const fin = data.intake().find((r) => r.data.feasibility_class && r.data.feasibility?.final && r.id !== draft.id);
    expect(fin, "a classified item exists");
    const versionBefore = fin.version;
    await page.click(`[data-testid="feas-card-${fin.id}"]`);
    await openDrawerFor(fin.data.name);
    await page.click('[data-testid="drawer-edit-btn"]');
    await page.waitForSelector('[data-testid="edit-owner"]');
    await page.fill('[data-testid="edit-owner"]', "Nuevo responsable");
    const beforeSave = data.calls.length;
    await page.click('[data-testid="drawer-save-btn"]');
    const { call: put } = await t.waitForCall((c) => c.method === "PUT" && c.path === `/entities/${fin.id}`, { after: beforeSave });
    const sent = Object.keys(put.body.data || {});
    const leaked = PROTECTED.filter((k) => sent.includes(k));
    eq(leaked, [], `PUT body carries no protected keys (sent: ${sent.join(", ")})`);
    eq(put.body.data.owner, "Nuevo responsable", "the edited field travels");
    eq(put.body.version, versionBefore, "optimistic concurrency version sent");
    await page.getByText("Saved. Live views now reflect this change.").waitFor({ timeout: 5000 });
    eq(data.byId(fin.id).data.feasibility_class, fin.data.feasibility_class, "the verdict survived the form save");
    eq(await t.text('[data-testid="edit-owner-value"]'), "Nuevo responsable", "drawer shows the saved value");
    await shot("drawer-saved");
    await t.closeDrawer();
  },
};
