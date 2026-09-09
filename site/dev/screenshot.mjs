#!/usr/bin/env node
/**
 * Headless-Chrome screenshots of the Director's Monitor for visual QA.
 *
 *   node site/dev/screenshot.mjs [--url http://127.0.0.1:8787] [--out /tmp/site-shots] [--empty-dist /tmp/site-dist-empty]
 *
 * Captures 1440×900 shots of every main state, logs console errors / page errors, and exits
 * non-zero if any JS error occurred. The empty state is served from a `site/build.mjs` output
 * built with a nonexistent data dir (pass --empty-dist to point at it, or it is built here).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchBrowser, serveStatic } from '../../gauntlet/scripts/lib/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const args = parseArgs(process.argv.slice(2));
const URL_BASE = (args.url || 'http://127.0.0.1:8787').replace(/\/$/, '');
const OUT = path.resolve(args.out || '/tmp/site-shots');
const EMPTY_DIST = path.resolve(args['empty-dist'] || '/tmp/site-dist-empty');
const W = 1440, H = 900;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    }
  }
  return out;
}

const errors = [];
async function openPage(browser, url, { width = W, height = H } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  // Probing reference/frames/timeline/ without an index.json legitimately ends in one 404.
  const EXPECTED_404 = /\/data\/reference\/frames\/timeline\/(t_\d+\.jpg|index\.json)(\?|$)/;
  page.on('console', (m) => {
    const loc = m.location()?.url || '';
    if (m.type() === 'error') {
      if (/Failed to load resource/.test(m.text()) && EXPECTED_404.test(loc)) { console.log(`  (expected probe 404) ${loc}`); return; }
      errors.push(`[console.error] ${url} :: ${m.text()} ${loc}`);
      console.error(`  [console.error] ${m.text()} ${loc}`);
    } else if (m.type() === 'warning') console.warn(`  [console.warn] ${m.text()}`);
  });
  page.on('pageerror', (e) => { errors.push(`[pageerror] ${url} :: ${e.message}`); console.error(`  [pageerror] ${e.message}`); });
  page.on('requestfailed', (r) => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(f)) console.warn(`  [requestfailed] ${r.url()} ${f}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !/timeline\/(t_\d+\.jpg|index\.json)/.test(r.url())) console.warn(`  [http ${r.status()}] ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
  await page.waitForSelector('#slate-fields .sf', { timeout: 20_000 });
  await settle(page);
  return page;
}
async function settle(page, ms = 350) {
  // poll until every <img> is complete (or 6 s), then let layout/leader lines settle
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const pending = await page.evaluate(() => Array.from(document.images).filter((i) => !i.complete && i.getAttribute('src')).length);
    if (!pending) break;
    await new Promise((r) => setTimeout(r, 60));
  }
  await new Promise((r) => setTimeout(r, ms));
}
async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, ...opts });
  console.log(`  ✓ ${path.relative(process.cwd(), file)}`);
  return file;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launchBrowser({ width: W, height: H });
  try {
    // --- populated site -------------------------------------------------------------------
    console.log(`monitor @ ${URL_BASE}`);
    let page = await openPage(browser, `${URL_BASE}/#take-0013/A_stairs/before`);
    // move the wipe a bit so both halves are visible in the still
    await page.evaluate(() => {
      const st = document.querySelector('#stage .pane.is-wipe');
      const r = st.getBoundingClientRect();
      st.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width * 0.42, clientY: r.top + r.height / 2, bubbles: true, pointerId: 1 }));
      st.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    });
    await settle(page, 400);
    await shot(page, '01_monitor_before_after');

    await page.evaluate(() => { location.hash = '#take-0013/A_stairs/reference'; });
    await settle(page, 500);
    await shot(page, '02_monitor_reference');

    await page.evaluate(() => { location.hash = '#take-0013/D_log/onion'; });
    await settle(page, 500);
    await shot(page, '03_monitor_onion');

    await page.evaluate(() => { location.hash = '#take-0013/B_house/side'; });
    await settle(page, 500);
    await shot(page, '04_monitor_side_by_side');

    // struck take
    await page.evaluate(() => { location.hash = '#take-0008/B_house/before'; });
    await settle(page, 500);
    await shot(page, '05_monitor_struck_take');

    // rubric board (scroll into view)
    await page.evaluate(() => { location.hash = '#take-0013/A_stairs/before'; });
    await settle(page, 400);
    await page.evaluate(() => document.querySelector('#rubric').scrollIntoView({ block: 'start' }));
    await settle(page, 400);
    await shot(page, '06_rubric_board');
    await page.evaluate(() => { document.querySelector('[data-filter="flipped"]').click(); document.querySelector('#rubric').scrollIntoView({ block: 'start' }); });
    await settle(page, 300);
    await shot(page, '07_rubric_flipped_filter');

    // reel view
    await page.evaluate(() => { document.querySelector('[data-filter="all"]').click(); window.scrollTo(0, 0); });
    await page.evaluate(() => { location.hash = '#take-0013/A_stairs/before/reel'; });
    await settle(page, 900);
    await shot(page, '08_reel_view');
    await page.evaluate(() => document.querySelector('[data-reel-play]').click());
    await new Promise((r) => setTimeout(r, 1300));
    const playing = await page.evaluate(() => document.querySelector('[data-reel-pos]').textContent);
    console.log(`  reel playing → ${playing}`);
    await page.evaluate(() => document.querySelector('[data-reel-play]').click());
    await page.evaluate(() => document.querySelectorAll('#view-reel .panel')[2]?.scrollIntoView({ block: 'end' }));
    await settle(page, 400);
    await shot(page, '09_reel_reference_reel');

    // keyboard: ArrowLeft steps takes in the monitor
    await page.evaluate(() => { location.hash = '#take-0013/A_stairs/before'; });
    await settle(page, 300);
    await page.keyboard.press('ArrowLeft');
    await settle(page, 200);
    const hashAfterKey = await page.evaluate(() => location.hash);
    console.log(`  ArrowLeft → ${hashAfterKey}`);
    if (!hashAfterKey.startsWith('#take-0012/')) errors.push(`keyboard step failed: ${hashAfterKey}`);

    // mobile width
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.evaluate(() => { location.hash = '#take-0013/A_stairs/before'; window.scrollTo(0, 0); });
    await settle(page, 500);
    await shot(page, '10_mobile_390', { fullPage: false });
    await page.close();

    // --- empty state (built with a nonexistent data dir) ----------------------------------
    console.log(`empty state ← ${EMPTY_DIST}`);
    if (!fs.existsSync(path.join(EMPTY_DIST, 'index.html'))) {
      execFileSync(process.execPath, [path.join(ROOT, 'site/build.mjs'), '--data', '/nonexistent', '--out', EMPTY_DIST], { stdio: 'inherit' });
    }
    const srv = await serveStatic(EMPTY_DIST, { spaFallback: false });
    try {
      page = await openPage(browser, `${srv.url}/`);
      await shot(page, '11_empty_state');
      await page.evaluate(() => { location.hash = '#A_stairs/before/reel'; });
      await settle(page, 900);
      await shot(page, '12_empty_state_reel');
      await page.close();
    } finally {
      await srv.close();
    }
  } finally {
    await browser.close();
  }
  if (errors.length) {
    console.error(`\n${errors.length} error(s):\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
  console.log('\nno console/page errors');
}

main().catch((e) => { console.error(e); process.exit(1); });
