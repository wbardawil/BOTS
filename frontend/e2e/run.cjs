#!/usr/bin/env node
// BOTS e2e runner: serves the built frontend with `vite preview` on 127.0.0.1:4173, answers every /api/** call
// from the mock in mock-api.cjs (no backend, no MongoDB, no LLM) and drives Chromium through the flows in
// flows/*.cjs, each in its own browser context with a fresh dataset at contract scale.
//
//   yarn e2e                 run every flow
//   yarn e2e feasibility     run one flow (name = file name without .cjs)
//   yarn e2e --build         rebuild frontend/build first (otherwise it is built only when missing)
//
// Env: BOTS_CHROMIUM = path to a Chromium binary (else Playwright's own download, `npx playwright install chromium`).
// Output: e2e/out/<flow>/ holds screenshots, exported PNGs and the summary PDF; e2e/out/results.json the verdicts.
// Exit code 1 when any flow fails; a page error (uncaught exception in the app) fails the flow it happened in.
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");
const { chromium } = require("playwright");
const { makeDataset, installRoutes } = require("./mock-api.cjs");

const E2E = __dirname;
const FRONTEND = path.resolve(E2E, "..");
const BUILD = path.join(FRONTEND, "build");
const OUT = path.join(E2E, "out");
const FLOWS = path.join(E2E, "flows");
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const VITE = path.join(FRONTEND, "node_modules", "vite", "bin", "vite.js");
const FLOW_TIMEOUT_MS = 240000;

const log = (...a) => console.log(`[e2e ${new Date().toISOString().slice(11, 19)}]`, ...a);
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

function listFlows() {
  return fs.readdirSync(FLOWS).filter((f) => f.endsWith(".cjs")).sort().map((f) => f.replace(/\.cjs$/, ""));
}

function ensureBuild(force) {
  if (!fs.existsSync(VITE)) throw new Error(`vite not installed at ${VITE}; run "yarn install" in ${FRONTEND} first`);
  if (!force && fs.existsSync(path.join(BUILD, "index.html"))) { log(`using existing build at ${BUILD}`); return; }
  log(`building the frontend into ${BUILD}`);
  const r = spawnSync(process.execPath, [VITE, "build"], { cwd: FRONTEND, stdio: "inherit",
    env: { ...process.env, DISABLE_EMERGENT_OVERLAY: "true", REACT_APP_BACKEND_URL: BASE } });
  if (r.status !== 0) throw new Error(`vite build exited with ${r.status}`);
}

function startPreview() {
  const proc = spawn(process.execPath, [VITE, "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"],
    { cwd: FRONTEND, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DISABLE_EMERGENT_OVERLAY: "true" } });
  let output = "";
  proc.stdout.on("data", (d) => { output += d; });
  proc.stderr.on("data", (d) => { output += d; });
  proc.exited = false;
  proc.on("exit", (code) => { proc.exited = true; proc.exitCode = code; });
  return { proc, output: () => output };
}

function waitForServer(preview, ms) {
  const until = Date.now() + ms;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (preview.proc.exited) return reject(new Error(`vite preview exited with ${preview.proc.exitCode}:\n${preview.output()}`));
      const req = http.get(`${BASE}/`, (res) => { res.resume(); if (res.statusCode === 200) resolve(); else retry(); });
      req.on("error", retry);
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };
    const retry = () => { if (Date.now() > until) reject(new Error(`vite preview did not answer on ${BASE} within ${ms} ms:\n${preview.output()}`)); else setTimeout(tick, 250); };
    tick();
  });
}

const pngDims = (buf) => {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("download is not a PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

/** Per-flow toolkit: assertions that count themselves, screenshots into the flow's folder, page helpers. */
function toolkit({ page, ctx, data, outDir, errors, name }) {
  let assertions = 0, shots = 0;
  const t = {
    page, ctx, data, outDir, name, BASE, pageErrors: errors,
    get assertions() { return assertions; },
    log: (...a) => log(`[${name}]`, ...a),
    expect(cond, msg) { assertions += 1; if (!cond) throw new Error(`assertion failed: ${msg}`); },
    eq(actual, expected, label) {
      assertions += 1;
      if (stable(actual) !== stable(expected)) throw new Error(`${label}: expected ${stable(expected)}, got ${stable(actual)}`);
    },
    async shot(label, opts = {}) {
      shots += 1;
      const file = path.join(outDir, `${String(shots).padStart(2, "0")}-${label}.png`);
      await page.screenshot({ path: file, ...opts });
      return file;
    },
    text: (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim()),
    /** First number in the element's text; "1,234" reads as 1234 ("—" reads as NaN). */
    num: async (sel) => { const m = (await t.text(sel)).match(/-?[\d,]+(\.\d+)?/); return m ? Number(m[0].replace(/,/g, "")) : NaN; },
    count: (sel) => page.$$eval(sel, (els) => els.length),
    async nav(id, waitSel, settle = 600) {
      await page.click(`[data-testid="nav-${id}"]`);
      if (waitSel) await page.waitForSelector(waitSel, { timeout: 20000 });
      if (settle) await page.waitForTimeout(settle);
    },
    async closeDrawer() {
      await page.keyboard.press("Escape");
      await page.waitForSelector('[data-testid="detail-drawer"]', { state: "detached", timeout: 10000 });
    },
    /** Click `sel`, wait for the browser download it triggers, keep a copy in the flow folder; returns PNG dimensions. */
    async download(sel, timeout = 90000) {
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), page.click(sel)]);
      const buf = fs.readFileSync(await dl.path());
      const file = path.join(outDir, `export-${dl.suggestedFilename()}`);
      fs.writeFileSync(file, buf);
      return { name: dl.suggestedFilename(), bytes: buf.length, file, ...pngDims(buf) };
    },
    /** Wait until the mock has logged a request matching `pred` at an index >= `after`. */
    async waitForCall(pred, { after = 0, timeout = 10000 } = {}) {
      const until = Date.now() + timeout;
      for (;;) {
        const i = data.calls.findIndex((c, idx) => idx >= after && pred(c));
        if (i >= 0) return { call: data.calls[i], index: i };
        if (Date.now() > until) throw new Error("timed out waiting for an API call");
        await page.waitForTimeout(100);
      }
    },
    /**
     * HTML5 drag of `srcSel` onto `dstSel` with raw mouse events. page.dragAndDrop scrolls the target into view between
     * the mousedown and the first move, so the drag can start on whichever element ends up under the pointer; here the
     * source is scrolled into view first and the drop lands inside the target's visible band, level with the source.
     */
    async drag(srcSel, dstSel) {
      await page.$eval(srcSel, (el) => { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center" }); });
      await page.waitForTimeout(150);
      const s = await page.$eval(srcSel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      const d = await page.$eval(dstSel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, top: r.top, bottom: r.bottom }; });
      const top = Math.max(d.top, 70) + 10, bottom = Math.min(d.bottom, page.viewportSize().height) - 10;
      if (bottom <= top) throw new Error(`drag target ${dstSel} is not visible alongside ${srcSel}`);
      const y = Math.min(Math.max(s.y, top), bottom);
      await page.mouse.move(s.x, s.y);
      await page.mouse.down();
      await page.mouse.move(s.x + 6, s.y + 6, { steps: 3 });
      await page.mouse.move(d.x, y, { steps: 12 });
      await page.mouse.up();
    },
    /** Poll until `fn` (sync, page-side) returns true. */
    waitUntil: (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }),
  };
  return t;
}

async function runFlow(browser, flowName) {
  const flow = require(path.join(FLOWS, `${flowName}.cjs`));
  const outDir = path.join(OUT, flowName);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const data = makeDataset({ systems: 45, intake: 60 });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5, locale: "en-US", acceptDownloads: true });
  await installRoutes(ctx, data);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [], consoleErrors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  const t = toolkit({ page, ctx, data, outDir, errors, name: flowName });
  const started = Date.now();
  const result = { flow: flowName, ok: false, assertions: 0, ms: 0, error: null, pageErrors: errors, consoleErrors };
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="nav-framework"]', { timeout: 30000 });
    let timer;
    await Promise.race([
      flow.run(t),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`flow exceeded ${FLOW_TIMEOUT_MS} ms`)), FLOW_TIMEOUT_MS); }),
    ]).finally(() => clearTimeout(timer));
    if (errors.length) throw new Error(`page error(s) during the flow: ${errors.join(" | ")}`);
    result.ok = true;
  } catch (e) {
    result.error = e.stack || String(e);
    try { await page.screenshot({ path: path.join(outDir, "FAILED.png") }); } catch { /* page may be gone */ }
  } finally {
    result.assertions = t.assertions;
    result.ms = Date.now() - started;
    await ctx.close().catch(() => {});
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const forceBuild = args.includes("--build");
  const wanted = args.filter((a) => !a.startsWith("--"));
  const available = listFlows();
  const unknown = wanted.filter((w) => !available.includes(w));
  if (unknown.length) throw new Error(`unknown flow(s) ${unknown.join(", ")}; available: ${available.join(", ")}`);
  const flows = wanted.length ? wanted : available;

  ensureBuild(forceBuild);
  fs.mkdirSync(OUT, { recursive: true });
  const preview = startPreview();
  const stop = () => { if (!preview.proc.exited) preview.proc.kill("SIGTERM"); };
  process.on("SIGINT", () => { stop(); process.exit(130); });
  process.on("SIGTERM", () => { stop(); process.exit(143); });
  let browser;
  const results = [];
  try {
    await waitForServer(preview, 30000);
    log(`preview up on ${BASE}`);
    browser = await chromium.launch({ executablePath: process.env.BOTS_CHROMIUM || undefined });
    for (const name of flows) {
      log(`flow ${name} …`);
      const r = await runFlow(browser, name);
      results.push(r);
      log(`flow ${name}: ${r.ok ? "PASS" : "FAIL"} · ${r.assertions} assertions · ${(r.ms / 1000).toFixed(1)} s${r.ok ? "" : `\n${r.error}`}`);
      if (r.consoleErrors.length) log(`  (${r.consoleErrors.length} console error(s), see results.json)`);
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop();
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  log(`${results.length - failed.length}/${results.length} flows passed · output in ${OUT}`);
  if (failed.length) { log(`FAILED: ${failed.map((r) => r.flow).join(", ")}`); process.exitCode = 1; }
}

main().catch((e) => { console.error(e.stack || String(e)); process.exit(1); });
