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

for (const name of ['cockpit', 'corridor', 'quarters', 'window']) {
  await page.evaluate((view) => window.debugAPI.setView(view), name);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

await page.evaluate(() => window.debugAPI.holdFades(true));
await page.evaluate(() => window.debugAPI.place('bed'));
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'prompt_bed.png') });
const bedFade = [];
await page.evaluate(() => { void window.debugAPI.perform('bed'); });
await page.waitForFunction(
  () => parseFloat(getComputedStyle(document.getElementById('fade')).opacity) > 0.92
    && (document.querySelector('#fade span').textContent || '').length > 2,
  null,
  { timeout: 8000 }
);
bedFade.push(await page.evaluate(() => ({
  opacity: getComputedStyle(document.getElementById('fade')).opacity,
  text: document.querySelector('#fade span').textContent,
})));
await page.screenshot({ path: path.join(outDir, 'fade_bed.png') });
await page.evaluate(() => window.debugAPI.releaseFade());
await page.waitForFunction(
  () => window.debugAPI.getCycle() > 0.6 && parseFloat(getComputedStyle(document.getElementById('fade')).opacity) < 0.08,
  null,
  { timeout: 8000 }
);
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(outDir, 'rest_cycle.png') });
await page.waitForFunction(() => (window.debugAPI.getStatus() || '').includes('Rested'), null, { timeout: 8000 });

await page.evaluate(() => window.debugAPI.place('galley'));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'prompt_galley.png') });
await page.evaluate(() => { void window.debugAPI.perform('galley'); });
await page.waitForFunction(() => (window.debugAPI.getStatus() || '').includes('Energy'), null, { timeout: 4000 });
await page.screenshot({ path: path.join(outDir, 'status_galley.png') });

await page.evaluate(() => window.debugAPI.place('bath'));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'prompt_bath.png') });
const bathFade = [];
await page.evaluate(() => { void window.debugAPI.perform('bathroom'); });
await page.waitForFunction(
  () => parseFloat(getComputedStyle(document.getElementById('fade')).opacity) > 0.92
    && (document.querySelector('#fade span').textContent || '').includes('efresh'),
  null,
  { timeout: 8000 }
);
bathFade.push(await page.evaluate(() => ({
  opacity: getComputedStyle(document.getElementById('fade')).opacity,
  text: document.querySelector('#fade span').textContent,
})));
await page.screenshot({ path: path.join(outDir, 'fade_bath.png') });
await page.evaluate(() => window.debugAPI.releaseFade());
await page.waitForFunction(() => (window.debugAPI.getStatus() || '').includes('Refreshed'), null, { timeout: 6000 });

await page.evaluate(() => window.debugAPI.release());
await page.click('canvas', { position: { x: 640, y: 360 } });
await page.waitForTimeout(250);
const pointer = await page.evaluate(() => ({
  locked: document.pointerLockElement === document.querySelector('canvas'),
  status: window.debugAPI.getStatus(),
  prompt: window.debugAPI.getPrompt(),
}));

await page.evaluate(() => window.debugAPI.setView('corridor'));
await page.waitForTimeout(700);
const perf = await page.evaluate(() => ({
  ...window.debugAPI.getPerf(),
  renderer: window.debugAPI.getRenderer(),
  pose: window.debugAPI.getPose(),
}));

const notes = {
  perf,
  pointer,
  bedFade,
  bathFade,
  errors: logs.filter((line) => /error|Error|warning/i.test(line)).slice(-40),
};
fs.writeFileSync(path.join(outDir, 'notes.json'), JSON.stringify(notes, null, 2));
console.log(JSON.stringify({ outDir, perf, pointer, errorCount: notes.errors.length, errors: notes.errors.slice(0, 12) }, null, 2));
await browser.close();
