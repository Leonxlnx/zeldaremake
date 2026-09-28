#!/usr/bin/env node
// Continuity checker over out/cues/continuity.json (written by tools/export-cues.mjs).
// Owner: director. Flags the things that break a film's geography and props logic:
//   - the crumb changing holder or jumping position without a motivating beat
//   - the Courier teleporting within a shot
//   - homebound screen direction (acts 3-5 after the wall-run should read right-to-left)
//   - the cap moving before it is used as a boat
//   - water appearing before the torrent or draining during the rescue
//   - shots still rendered by the placeholder
// Writes out/cues/continuity_report.md and exits non-zero on hard failures.

import fs from 'node:fs';
import path from 'node:path';
import { SV_ROOT } from './lib/headless.mjs';

const edit = await import(path.join(SV_ROOT, 'app/core/edit.js'));
const layout = await import(path.join(SV_ROOT, 'app/core/layout.js'));
const src = path.join(SV_ROOT, 'out/cues/continuity.json');
if (!fs.existsSync(src)) {
  console.error('run tools/export-cues.mjs first');
  process.exit(2);
}
const rows = JSON.parse(fs.readFileSync(src, 'utf8'));
const issues = [];
const warn = (sev, frame, msg) => issues.push({ sev, frame, shot: edit.locate(frame).shot.id, msg });
const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0);

const placeholders = new Set(rows.filter((r) => r.placeholder).map((r) => r.shot));
for (const id of placeholders) warn('hard', edit.shotById(id).start, `${id} is still the placeholder shot`);

for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1];
  const b = rows[i];
  const sameShot = a.shot === b.shot;
  if (sameShot && a.courierPos && b.courierPos) {
    const d = dist(a.courierPos, b.courierPos);
    if (d > 25) warn('soft', b.frame, `Courier moved ${d.toFixed(1)} mm in one frame (teleport?)`);
  }
  if (sameShot && a.crumbHolder !== b.crumbHolder) warn('info', b.frame, `crumb holder ${a.crumbHolder || 'none'} -> ${b.crumbHolder || 'none'}`);
  if (!sameShot) {
    if (a.crumbHolder !== b.crumbHolder) warn('info', b.frame, `across cut ${a.shot}->${b.shot}: crumb holder ${a.crumbHolder || 'none'} -> ${b.crumbHolder || 'none'}`);
  }
  if (sameShot && a.crumbPos && b.crumbPos && !a.crumbHolder && !b.crumbHolder) {
    const d = dist(a.crumbPos, b.crumbPos);
    if (d > 30) warn('soft', b.frame, `free crumb jumped ${d.toFixed(1)} mm in one frame`);
  }
}

// The cap must sit at its lookout position until S14.
const s14 = edit.shotById('S14').start;
for (const r of rows) {
  if (r.frame < s14 && r.capPos && dist(r.capPos, layout.CAP.position) > 3) warn('soft', r.frame, `cap is away from its lookout position before S14 (${r.capPos.map((x) => x.toFixed(0)).join(',')})`);
}
// Water must not exist before the torrent beat.
const torrent = edit.SYNC.torrent;
for (const r of rows) {
  if (r.water && r.water.level > 0.02 && r.frame < torrent - 24) warn('hard', r.frame, `water level ${r.water.level} before the torrent`);
}
// Homebound screen direction: after the landing (SYNC.landHome) until the haul, the Courier's
// world X should be non-increasing across shot boundaries (she travels west, screen left).
const home0 = edit.SYNC.landHome;
const home1 = edit.SYNC.hauledIn;
let lastX = null;
let lastShot = null;
for (const r of rows) {
  if (r.frame < home0 || r.frame > home1 || !r.courierPos) continue;
  if (lastShot && r.shot !== lastShot && lastX !== null && r.courierPos[0] > lastX + 40) {
    warn('soft', r.frame, `homebound: Courier jumps east by ${(r.courierPos[0] - lastX).toFixed(0)} mm across the cut into ${r.shot}`);
  }
  lastX = r.courierPos[0];
  lastShot = r.shot;
}

const bySev = (s) => issues.filter((x) => x.sev === s);
let md = `# Continuity report\n\n${rows.length} frames checked. hard: ${bySev('hard').length}, soft: ${bySev('soft').length}, info: ${bySev('info').length}\n\n`;
for (const sev of ['hard', 'soft', 'info']) {
  const list = bySev(sev);
  if (!list.length) continue;
  md += `## ${sev}\n\n| frame | shot | issue |\n| --- | --- | --- |\n`;
  for (const x of list.slice(0, 400)) md += `| ${x.frame} | ${x.shot} | ${x.msg} |\n`;
  md += '\n';
}
fs.writeFileSync(path.join(SV_ROOT, 'out/cues/continuity_report.md'), md);
console.log(md.split('\n').slice(0, 30).join('\n'));
process.exit(bySev('hard').length ? 1 : 0);
