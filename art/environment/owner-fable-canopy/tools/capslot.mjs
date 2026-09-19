#!/usr/bin/env node
/**
 * capslot.mjs — one heavy native capture at a time on the owner's laptop (owner-fable, 2026-09-19).
 *
 *   node capslot.mjs <agent-id> -- <command…>
 *
 * Takes an atomic lock (a directory under the user's temp folder, created with mkdir — atomic on
 * Windows and POSIX), runs the command, and releases the lock when it exits. If another agent
 * holds the lock the wrapper waits, printing who holds it and since when, up to CAPSLOT_WAIT_MIN
 * minutes (default 40). A lock older than CAPSLOT_STALE_MIN minutes (default 45) is treated as
 * abandoned (a crashed capture) and taken over — that is the only time this touches another
 * agent's lock, and it never touches another agent's processes.
 *
 * Why: with several agents capturing at once (44–52 headless Chromes were up at 19:40 UTC) the
 * captures die with puppeteer "Target closed" / "frame got detached" and page loads take 3 min
 * instead of 40 s. fable-cursor's VM serialises its captures through gauntlet/tmp/capslot.sh; this
 * is the laptop's equivalent, opt-in per agent.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const sep = args.indexOf('--');
if (sep < 1 || sep === args.length - 1) {
  console.error('usage: node capslot.mjs <agent-id> -- <command…>');
  process.exit(2);
}
const agent = args[0];
const cmd = args.slice(sep + 1);
const dir = path.join(os.tmpdir(), 'zeldaremake-capslot');
const lock = path.join(dir, 'lock');
const waitMin = Number(process.env.CAPSLOT_WAIT_MIN ?? 40);
const staleMin = Number(process.env.CAPSLOT_STALE_MIN ?? 45);
fs.mkdirSync(dir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const holder = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(lock, 'holder.json'), 'utf8'));
  } catch {
    return null;
  }
};
const t0 = Date.now();
let announced = false;
for (;;) {
  try {
    fs.mkdirSync(lock);
    break;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const h = holder();
    const ageMin = h ? (Date.now() - h.at) / 60_000 : Infinity;
    if (ageMin > staleMin) {
      console.error(`capslot: lock held by ${h?.agent ?? '?'} for ${ageMin.toFixed(0)} min — stale, taking over`);
      fs.rmSync(lock, { recursive: true, force: true });
      continue;
    }
    if (!announced) {
      console.error(`capslot: waiting for ${h?.agent ?? '?'} (held ${ageMin.toFixed(1)} min, "${h?.cmd ?? ''}")`);
      announced = true;
    }
    if (Date.now() - t0 > waitMin * 60_000) {
      console.error(`capslot: gave up after ${waitMin} min`);
      process.exit(3);
    }
    await sleep(5000);
  }
}
fs.writeFileSync(path.join(lock, 'holder.json'), JSON.stringify({ agent, at: Date.now(), pid: process.pid, cmd: cmd.join(' ') }));
const release = () => {
  try {
    const h = holder();
    if (h && h.pid === process.pid) fs.rmSync(lock, { recursive: true, force: true });
  } catch {}
};
process.on('exit', release);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
console.error(`capslot: ${agent} holds the capture slot`);
// a shell on Windows so `npm` / `npx` (.cmd shims) resolve; arguments with spaces are wrapped in
// double quotes — nested quotes inside an argument are not supported (put such scripts in a file)
const line = cmd.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a)).join(' ');
const child = spawn(line, { stdio: 'inherit', shell: true });
child.on('exit', (code) => {
  release();
  process.exit(code ?? 1);
});
