// Headless check of the realtime viewer chrome: loading panel, transport bar, seek / pause / restart /
// frame step, auto-hide, the error panel on WebGL context loss, and no chrome at all under ?capture=1.
// Every step waits for the bar to show the new state (a software-GL frame can take seconds here).
import path from 'node:path';
import { serveStatic, launchBrowser } from '../../gauntlet/scripts/lib/browser.mjs';

// usage: node legosw/scripts/test-viewer.mjs <dist dir | http(s) base url> <screenshot dir>
const dist = process.argv[2];
const out = process.argv[3];
const server = dist.startsWith('http') ? { url: dist.replace(/\/$/, ''), close() {} } : await serveStatic(path.resolve(dist));
const browser = await launchBrowser({ width: 1280, height: 720 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (ok, what, detail) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  ${detail}` : ''}`);
};
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(`${server.url}/?msaa=1&t=40.6`, { waitUntil: 'domcontentloaded', timeout: 600000 });
  // the film build then holds the main thread, so read the panel straight away
  const panel = await page.evaluate(() => document.querySelector('.lsw-panel')?.textContent.trim() ?? '');
  check(panel.startsWith('Building the fleet'), 'loading panel shown while the film builds', `"${panel}"`);
  await page.waitForFunction(() => !document.querySelector('.lsw-panel') && document.querySelector('.lsw-controls')?.dataset.t, { timeout: 600000 });
  const st = () => page.evaluate(() => {
    const c = document.querySelector('.lsw-controls');
    return { t: Number(c.dataset.t), time: c.querySelector('.time').textContent, shot: c.querySelector('.shot').textContent, play: c.querySelector('button:nth-child(2)').textContent, hidden: c.classList.contains('hidden') };
  });
  const until = (fn, what, ms = 60000) => page.waitForFunction(fn, { timeout: ms, polling: 200 }).then(() => true, () => (console.log(`  (timed out waiting for ${what})`), false));
  let s = await st();
  check(s.t >= 40.6 && s.shot === 'anakin-cockpit' && s.play === '❚❚', 'first frame at ?t=40.6, playing, panel gone', JSON.stringify(s));
  await page.mouse.move(640, 300);
  await until(() => !document.querySelector('.lsw-controls').classList.contains('hidden'), 'bar visible on pointer move');
  await page.screenshot({ path: `${out}/viewer-2-controls.png` });
  const box = await page.$eval('.lsw-controls .track', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.8, box.y + box.h / 2);
  await until(() => Number(document.querySelector('.lsw-controls').dataset.t) > 70, 'seek to 80%');
  s = await st();
  check(Math.abs(s.t - 0.8 * 97.3) < 1.5 && s.shot === 'hangar-approach', 'click on the scrubber at 80% seeks there', JSON.stringify(s));
  await page.keyboard.press('Space');
  await until(() => document.querySelector('.lsw-controls button:nth-child(2)').textContent === '▶', 'pause icon');
  const a = await st();
  await sleep(3000);
  const b = await st();
  check(a.play === '▶' && a.t === b.t, 'Space pauses: time holds for 3 s', `${a.t} → ${b.t}`);
  await page.screenshot({ path: `${out}/viewer-3-seek-paused.png` });
  await page.keyboard.press('Period');
  await page.waitForFunction((t0) => Math.abs(Number(document.querySelector('.lsw-controls').dataset.t) - t0 - 1 / 24) < 0.002, { timeout: 60000, polling: 200 }, b.t).then(() => {}, () => {});
  s = await st();
  check(Math.abs(s.t - b.t - 1 / 24) < 0.002 && s.play === '▶', '"." steps one frame (1/24 s) and stays paused', `${b.t} → ${s.t}`);
  await page.keyboard.press('Home');
  await until(() => Number(document.querySelector('.lsw-controls').dataset.t) < 2 && document.querySelector('.lsw-controls button:nth-child(2)').textContent === '❚❚', 'restart');
  s = await st();
  check(s.t < 2 && s.play === '❚❚' && s.shot === 'farfar', 'Home restarts from 0:00 and plays', JSON.stringify(s));
  await page.mouse.move(700, 200);
  const hid = await until(() => document.querySelector('.lsw-controls').classList.contains('hidden'), 'auto-hide', 60000);
  check(hid, 'bar hides itself after 2.5 s idle while playing');
  await page.keyboard.press('Space');
  const back = await until(() => !document.querySelector('.lsw-controls').classList.contains('hidden'), 'bar back when paused');
  check(back, 'bar comes back when paused (key press)');
  await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  const err = await until(() => !!document.querySelector('.lsw-panel .err'), 'error panel', 30000);
  const errText = err ? await page.$eval('.lsw-panel', (e) => e.textContent.trim()) : '';
  check(err && errText.includes('graphics context was lost') && errText.includes('Reload'), 'context loss → error panel with Reload', `"${errText}"`);
  await page.screenshot({ path: `${out}/viewer-4-error.png` });
  const cap = await browser.newPage();
  await cap.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await cap.goto(`${server.url}/?capture=1&msaa=1`, { waitUntil: 'load', timeout: 600000 });
  await cap.waitForFunction(() => !!window.__LSW__, { timeout: 600000 });
  await cap.evaluate(() => window.__LSW__.ready);
  const chrome = await cap.evaluate(() => ({ controls: !!document.querySelector('.lsw-controls'), panel: !!document.querySelector('.lsw-panel') }));
  check(!chrome.controls && !chrome.panel, 'capture mode (exports) has no viewer chrome', JSON.stringify(chrome));
} finally {
  await browser.close();
  server.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
