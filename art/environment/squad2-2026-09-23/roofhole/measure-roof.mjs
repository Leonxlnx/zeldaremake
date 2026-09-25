#!/usr/bin/env node
/**
 * measure-roof.mjs — what HERO_TOP_KEEP adds to the roof, in Node and in seconds: the roof builds
 * headlessly (roof.test.mjs's loader), so the clumps, cards and triangles it gains can be read exactly
 * instead of inferred from a rounded pose count. Prints the build with the band kept against the same
 * build with the band excluded (HERO_TOP_KEEP = 0, the rule before this change).
 *
 *   node art/environment/squad2-2026-09-23/roofhole/measure-roof.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../../../src/world');

/** compile this file's TS dependency graph in memory, as the canopy test's loader does */
function loaderFor(topKeep) {
  const modules = new Map();
  const load = (file) => {
    file = path.resolve(file);
    const key = `${file}|${topKeep}`;
    if (modules.has(key)) return modules.get(key).exports;
    const module = { exports: {} };
    modules.set(key, module);
    let text = readFileSync(file, 'utf8');
    if (file.endsWith('canopy/roof.ts') && topKeep !== null) text = text.replace(/export const HERO_TOP_KEEP = [\d.]+;/, `export const HERO_TOP_KEEP = ${topKeep};`);
    const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', js)(
      (name) => {
        if (name === 'three') return THREE;
        const base = path.resolve(path.dirname(file), name);
        return load(base.endsWith('.ts') ? base : `${base}.ts`);
      },
      module,
      module.exports,
    );
    return module.exports;
  };
  return load;
}

function build(topKeep) {
  const load = loaderFor(topKeep);
  const { buildRoof } = load(path.join(src, 'canopy/roof.ts'));
  const { createRng } = load(path.join(src, 'util/prng.ts'));
  const { LAYOUT } = load(path.join(src, 'layout.ts'));
  const { WORLD } = load(path.join(src, 'config.ts'));
  const terrain = { height: (x, z) => (x > 14 && z < 2 && z > -30 ? 5.4 : 0), normal: () => new THREE.Vector3(0, 1, 0), mask: () => ({}) };
  const ctx = { layout: LAYOUT, terrain, config: WORLD, quality: { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1 } };
  const out = buildRoof(ctx, createRng('measure/canopy-roof'), { sunDir: new THREE.Vector3(-0.62, 0.62, 0.48).normalize(), density: 1, sectors: 6 });
  // the airspace the hole was over: the plaza's northern approach, z −20…−52 (the stand pass starts −52)
  const overApproach = out.clumps.filter((c) => c.z <= -20 && c.z >= -52).length;
  return { clumps: out.clumps.length, cards: out.cards, triangles: out.cards * 2, dropped: out.dropped.heroFrame, overApproach };
}

const off = build(0);
const on = build(null);
const row = (name, v) => `${name.padEnd(22)} clumps ${String(v.clumps).padStart(5)}  cards ${String(v.cards).padStart(6)}  triangles ${String(v.triangles).padStart(7)}  dropped by the frames ${String(v.dropped).padStart(4)}  over the approach ${String(v.overApproach).padStart(4)}`;
console.log(row('HERO_TOP_KEEP = 0', off));
console.log(row('as shipped', on));
console.log(
  `\ndelta: ${on.clumps - off.clumps} clumps, ${on.cards - off.cards} cards, ${on.triangles - off.triangles} triangles ` +
    `(${(((on.triangles - off.triangles) / 9e6) * 100).toFixed(4)} % of the 9 M cap), and ${on.overApproach - off.overApproach} more clumps over the northern approach`,
);
