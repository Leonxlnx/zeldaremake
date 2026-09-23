#!/usr/bin/env node
/**
 * normal-run.mjs — open the game the way a player does (no capture or test flags: its own frame
 * loop, play mode, the HUD) from a running server (`npm run dev` / `npm run preview`), wait for the
 * loading overlay to clear, walk forward for a few seconds, and save a screenshot + the console.
 *
 *   node gauntlet/scripts/normal-run.mjs --url http://127.0.0.1:4173/ --out /tmp/normal-run [--size 960x540] [--seconds 20]
 *
 * `navigator.webdriver` is masked (the game treats a webdriver page as a headless capture).
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, READY_TIMEOUT_MS } from './lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const url = String(args.url || 'http://127.0.0.1:4173/');
const out = path.resolve(args.out || '/tmp/normal-run');
const [width, height] = String(args.size || '960x540').split('x').map(Number);
const seconds = Number(args.seconds || 20);
fs.mkdirSync(out, { recursive: true });

const browser = await launchBrowser({ width, height });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const lines = [];
  page.on('console', (m) => lines.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));
  await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => {
    const l = document.getElementById('loading');
    return l && l.classList.contains('done') && getComputedStyle(l).opacity === '0';
  }, { timeout: READY_TIMEOUT_MS, polling: 1000 });
  const readyS = (Date.now() - t0) / 1000;
  await page.screenshot({ path: path.join(out, 'normal-run-ready.jpg'), type: 'jpeg', quality: 88 });
  await page.keyboard.down('KeyW');
  await new Promise((r) => setTimeout(r, seconds * 1000));
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: path.join(out, 'normal-run-walked.jpg'), type: 'jpeg', quality: 88 });
  const state = await page.evaluate(() => ({
    playMode: !!document.querySelector('canvas'),
    hud: !!document.querySelector('.zr-hud'),
    title: document.title,
    frames: window.__ZR__?.stats?.() ?? null,
  }));
  const report = { url, readySeconds: readyS, walkedSeconds: seconds, state, errors: lines.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]')), console: lines.slice(-40) };
  fs.writeFileSync(path.join(out, 'normal-run.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ readySeconds: readyS, errors: report.errors, stats: state.frames }, null, 1));
} finally {
  await browser.close();
}
