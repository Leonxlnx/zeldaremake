#!/usr/bin/env node
/**
 * where.mjs — what `surfaceAt` hands the bed at each of the six spots `pairs.mjs` stands on.
 *
 *   node art/audio/2026-09-24-indoors/where.mjs
 *
 * The renders are the proof that the change is audible; this is the proof that the six spots are
 * the six spots they are meant to be. It also answers the one odd thing in the measurement: the
 * stilt house's pair and the tree hut's pair come out equal to a tenth of a decibel. That is not a
 * broken render. The bed is one global source shaped by local terms, and those two rooms hand it
 * the same terms — same enclosure, same roof, same ground, both ~100 m from the only other thing
 * in earshot. Two rooms that are the same room to the bed sound the same, which is correct, and it
 * means the tree hut's take corroborates nothing the stilt house's take did not already say.
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
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) return nodeRequire(name);
      const target = path.resolve(path.dirname(file), name);
      for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const here = path.dirname(new URL(import.meta.url).pathname);
const { surfaceAt } = loadTs(path.join(here, '../../../src/audio/index.ts'));

const PAIRS = JSON.parse(readFileSync(path.join(here, 'spots.json'), 'utf8')).pairs;

console.log('spot            x        z      surface   enclosure  canopy   gorge');
for (const p of PAIRS) {
  const s = surfaceAt(p.at[0], p.at[1]);
  console.log(
    `${p.id.padEnd(15)} ${p.at[0].toFixed(1).padStart(6)} ${p.at[1].toFixed(1).padStart(8)}   ${s.surface.padEnd(8)} ` +
      `${s.enclosure.toFixed(2).padStart(7)} ${s.canopy.toFixed(2).padStart(8)} ${s.gorge.toFixed(2).padStart(7)}`,
  );
}
