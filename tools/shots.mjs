import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const iter = process.argv[2] || '1';
const base = process.argv[3] || 'http://127.0.0.1:5173';
const outDir = path.resolve(`shots/iter_${iter}`);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--use-gl=angle',
    '--use-angle=gl',
  ],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.debugAPI && window.debugAPI.ready, null, { timeout: 20000 });
await page.waitForFunction(() => window.debugAPI.frames > 8, null, { timeout: 20000 });

const views = ['cockpit', 'corridor', 'quarters', 'window'];
for (const name of views) {
  await page.evaluate((view) => window.debugAPI.setView(view), name);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

await page.evaluate(() => {
  window.debugAPI.setView('quarters');
  window.debugAPI.setSuppress(false);
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, 'prompt_bed.png') });

await page.evaluate(() => window.debugAPI.perform('bed'));
await page.waitForFunction(() => document.getElementById('fade').classList.contains('on'), null, { timeout: 4000 });
await page.screenshot({ path: path.join(outDir, 'fade_bed.png') });
await page.waitForFunction(() => window.debugAPI.getCycle() > 0.6 && !document.getElementById('fade').classList.contains('on'), null, { timeout: 8000 });
await page.screenshot({ path: path.join(outDir, 'rest_cycle.png') });
await page.waitForFunction(() => window.debugAPI.getStatus().includes('Rested'), null, { timeout: 8000 });

await page.evaluate(() => window.debugAPI.setView('corridor'));
await page.evaluate(() => {
  window.debugAPI.setSuppress(false);
});
await page.evaluate(() => window.debugAPI.perform('galley'));
await page.waitForFunction(() => window.debugAPI.getStatus().includes('Energy'), null, { timeout: 4000 });
await page.screenshot({ path: path.join(outDir, 'status_galley.png') });

await page.evaluate(() => window.debugAPI.perform('bathroom'));
await page.waitForFunction(() => document.getElementById('fade').classList.contains('on'), null, { timeout: 4000 });
await page.screenshot({ path: path.join(outDir, 'fade_bath.png') });
await page.waitForFunction(() => window.debugAPI.getStatus().includes('Refreshed'), null, { timeout: 6000 });

const pointer = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas');
  canvas.requestPointerLock();
  await new Promise((r) => setTimeout(r, 200));
  return {
    locked: document.pointerLockElement === canvas,
    status: window.debugAPI.getStatus(),
    prompt: window.debugAPI.getPrompt(),
  };
});

await page.evaluate(() => window.debugAPI.setView('corridor'));
await page.waitForTimeout(800);
const perf = await page.evaluate(() => window.debugAPI.getPerf());

const notes = { perf, pointer, logs: logs.slice(-80) };
fs.writeFileSync(path.join(outDir, 'notes.json'), JSON.stringify(notes, null, 2));
console.log(JSON.stringify({ outDir, perf, pointer, logCount: logs.length, errors: logs.filter((l) => l.includes('error') || l.includes('Error')).slice(0, 20) }, null, 2));

await browser.close();
