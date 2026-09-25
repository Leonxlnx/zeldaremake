#!/usr/bin/env node
/**
 * design.mjs — what a run is, as data, against what a walk is.
 *
 *   node art/audio/2026-09-25-gait/design.mjs
 *
 * `designStep` returns a step as plain data before any WebAudio touches it, which is the right
 * place to ask this question. The rendered version cannot answer it: at five steps a second a
 * running step's envelope has not finished when the next one starts, the onset detector
 * under-counts, and the run's own first half differs from its second half by **13.4 dB rms** of
 * spectral shape — four times the walk's 3.2 and three times the difference between a walk and a
 * run. A measurement whose noise floor is bigger than its effect is not a measurement.
 *
 * So: the same surface, the same strength, the same seeded stream, `running` false and then true,
 * over many seeds. Whatever comes out different IS the difference between a walk and a run, exactly
 * and with no noise in it at all.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} };
  modules.set(file, m);
  const src = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', src)(
    (n) => {
      if (!n.startsWith('.')) return nodeRequire(n);
      const t = path.resolve(path.dirname(file), n);
      for (const c of [t + '.ts', path.join(t, 'index.ts'), t]) if (existsSync(c)) return loadTs(c);
      throw Error(n);
    },
    m,
    m.exports,
  );
  return m.exports;
}

const here = path.dirname(new URL(import.meta.url).pathname);
const { designStep, strengthFor, WALK_SPEED, RUN_GROUND_SPEED } = loadTs(path.join(here, '../../../src/audio/footsteps.ts'));
const { createRng } = loadTs(path.join(here, '../../../src/world/util/prng.ts'));

const SURFACES = ['stone', 'stair', 'grass', 'dirt', 'wood', 'hollow', 'leaf', 'bridge'];
const N = 60;

/** every number a step is made of, so "what differs" is answered by comparison and not by reading */
const summarise = (d) => {
  const bodies = d.parts.filter((p) => p.kind === 'body');
  const noises = d.parts.filter((p) => p.kind === 'noise');
  const heel = bodies.filter((p) => p.at <= 0.004);
  const late = d.parts.filter((p) => p.at > 0.02);
  return {
    parts: d.parts.length,
    end: d.end,
    reverb: d.reverb,
    peak: Math.max(...d.parts.map((p) => p.peak)),
    heelPeak: heel.length ? Math.max(...heel.map((p) => p.peak)) : 0,
    heelAttack: heel.length ? Math.min(...heel.map((p) => p.attack)) : 0,
    heelF0: heel.length ? Math.max(...heel.map((p) => p.f0)) : 0,
    latest: Math.max(...d.parts.map((p) => p.at)),
    toePeak: Math.max(...d.parts.filter((p) => p.at > 0.02).map((p) => p.peak), 0),
    lateShare: late.length / d.parts.length,
    bodies: bodies.length,
    noises: noises.length,
    topHz: Math.max(...noises.map((p) => Math.max(p.freq, p.freqTo)), 0),
  };
};

const mean = (rows, k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;

console.log(`designStep at the same strength (${strengthFor(RUN_GROUND_SPEED).toFixed(2)}) and the same seeds, walking then running.`);
console.log(`(for reference strengthFor gives ${strengthFor(WALK_SPEED).toFixed(2)} at a walk and ${strengthFor(RUN_GROUND_SPEED).toFixed(2)} at a run — that part is level, and level is not in question)`);
console.log();
const keys = ['parts', 'heelPeak', 'heelAttack', 'heelF0', 'toePeak', 'latest', 'peak', 'end', 'reverb', 'topHz'];
console.log('surface'.padEnd(9) + keys.map((k) => k.padStart(11)).join(''));
const diffs = new Map(keys.map((k) => [k, 0]));
for (const s of SURFACES) {
  const w = Array.from({ length: N }, (_, i) => summarise(designStep(s, 0.8, false, createRng(`g/${s}/${i}`))));
  const r = Array.from({ length: N }, (_, i) => summarise(designStep(s, 0.8, true, createRng(`g/${s}/${i}`))));
  const cells = keys.map((k) => {
    const a = mean(w, k);
    const b = mean(r, k);
    const rel = a === 0 ? (b === 0 ? 0 : 1) : (b - a) / Math.abs(a);
    diffs.set(k, Math.max(diffs.get(k), Math.abs(rel)));
    return (Math.abs(rel) < 1e-9 ? '  =' : `${(rel * 100).toFixed(0)}%`).padStart(11);
  });
  console.log(`${s.padEnd(9)}` + cells.join(''));
}
console.log();
const moved = keys.filter((k) => diffs.get(k) > 1e-9);
console.log(`what running changes, on any surface: ${moved.length ? moved.join(', ') : 'NOTHING'}`);
console.log(`what it leaves identical:              ${keys.filter((k) => diffs.get(k) <= 1e-9).join(', ')}`);
