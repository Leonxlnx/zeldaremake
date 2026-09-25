#!/usr/bin/env node
/**
 * rate.mjs — how often the whole wood was re-drawn on a journey a player actually makes.
 *
 *   node art/audio/2026-09-25-reseed/rate.mjs
 *
 * The rule this replaces: when the listener is more than PERCH_RESEED_M (25 m) from the spot the
 * wood was drawn at, draw the whole wood again around where he is now — six new bearings, six new
 * distances, all in the same instant. It is a pure function of the route, so this needs no browser,
 * no audio and no seed: given the path, the firings are exactly determined.
 *
 * The number to hold it against is the rate the wood calls at, which is about one call every 5.5 s
 * (`ambience.test.mjs`, 'moving the birds about does not add any': 7-13 a minute).
 */
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import ts from 'typescript';
const nodeRequire=createRequire(import.meta.url); const modules=new Map();
function loadTs(file){file=path.resolve(file); if(modules.has(file))return modules.get(file).exports;
 const m={exports:{}}; modules.set(file,m);
 const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',src)((n)=>{if(!n.startsWith('.'))return nodeRequire(n);const t=path.resolve(path.dirname(file),n);
  for(const c of [t+'.ts',path.join(t,'index.ts'),t]) if(fs.existsSync(c)) return loadTs(c); throw Error(n);},m,m.exports);
 return m.exports;}
const here = path.dirname(new URL(import.meta.url).pathname);
const AMB = loadTs(path.join(here, '../../../src/audio/ambience.ts'));
/** the constant this replaced; it is gone from the source, so the old rule is stated here */
const R = 25;
const CALL_EVERY = 5.5;
/**
 * The player's own legs, read out of footsteps.ts rather than copied. They were copied as 4.2 m/s
 * and went stale the moment PR #59 landed a new controller on 2026-09-25 — the game runs at 2.2 now.
 */
const FS = loadTs(path.join(here, '../../../src/audio/footsteps.ts'));
const RUN = FS.RUN_GROUND_SPEED;
const WALK = FS.WALK_SPEED;
/** the shipped rule: re-draw the whole wood when he is more than PERCH_RESEED_M from where it was drawn */
function reseeds(points) {
  let anchor = points[0], n = 0, at = [];
  for (const [i, p] of points.entries()) {
    if (Math.hypot(p[0] - anchor[0], p[1] - anchor[1]) > R) { anchor = p; n++; at.push(i); }
  }
  return { n, at };
}
const step = (a, b, speed, dt = 1/30) => {
  const len = Math.hypot(b[0]-a[0], b[1]-a[1]); const n = Math.max(1, Math.round(len / (speed*dt)));
  return Array.from({length: n+1}, (_, i) => [a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n]);
};
const pace = (a, b, speed, secs) => { const out=[]; const len=Math.hypot(b[0]-a[0],b[1]-a[1]); const dt=1/30;
  for (let t=0;t<secs;t+=dt){ const tr=(t*speed)/len; const leg=tr%2; const u=leg<=1?leg:2-leg;
    out.push([a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u]); } return out; };
console.log(`the old rule: re-draw all six whenever he is more than ${R} m from where they were drawn`);
console.log(`against a wood that calls about once every ${CALL_EVERY} s, and PERCH_DROP_M = ${AMB.PERCH_DROP_M.toFixed(1)} m now retires one at a time\n`);
const journeys = [
  ['plaza to the log arch (one way, run)', step([0.5,2],[4,-58],RUN)],
  ['plaza to the north grove (one way, run)', step([0.5,2],[-38,32],RUN)],
  ['pacing a 26 m line, 2 min at a run', pace([0,0],[26,0],RUN,120)],
  ['pacing a 26 m line, 2 min at a walk', pace([0,0],[26,0],WALK,120)],
  ['pacing a 21 m line, 2 min at a run', pace([0,0],[21,0],RUN,120)],
  ['pacing a 60 m line, 2 min at a run', pace([0,0],[60,0],RUN,120)],
  ['standing still, 2 min', pace([0,0],[26,0],0,120)],
];
for (const [name, pts] of journeys) {
  const { n } = reseeds(pts);
  const secs = pts.length / 30;
  console.log(`${name.padEnd(38)} ${secs.toFixed(0).padStart(4)} s  ${String(n).padStart(3)} re-seeds` + (n ? `  one every ${(secs/n).toFixed(1)} s  = ${(n * 6).toString().padStart(3)} birds moved, ${((n * CALL_EVERY) / secs).toFixed(2)} re-seeds per call` : ''));
}
