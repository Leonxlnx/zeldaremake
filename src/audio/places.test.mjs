// node --test src/audio/places.test.mjs — the space a place has, as the bed hears it.
//
// `surfaceAt` returns three terms that are not about the boot at all: how closed the sky is
// (`canopy`), how much of the world around the listener is open ravine (`gorge`), and how far
// inside a bore he is (`enclosure`). They decide what the forest sounds like rather than what he is
// standing on, and they are derived from terrain fields that were authored for other purposes — so
// they go wrong quietly and in a way no footstep test can see.
//
// The one that did: `forestFloorZone` is the terrain's litter field, and litter lies in a clearing
// exactly as it lies under the trees, so the field read 1.00 at the centre of the north clearing
// and the bed put a closed roof over a paved disc the layout describes as having "banks rising on
// every side". Walking the corridor out into the clearing changed nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
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
    // the layout's path splines are real three curves, so bare imports resolve to the package
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
const { surfaceAt, skyOpening, CLEARING_OPEN_MAX } = loadTs(path.join(here, 'index.ts'));
const { LAYOUT } = loadTs(path.join(here, '../world/layout.ts'));

const canopyAt = (x, z) => surfaceAt(x, z).canopy;

test('the sky opens over the clearing and closes again in the corridor', () => {
  const c = LAYOUT.northClearing;
  assert.ok(canopyAt(c.x, c.z) < 0.25, `the clearing's centre is under ${canopyAt(c.x, c.z).toFixed(2)} of a roof; it is an opening`);
  assert.ok(canopyAt(c.x, c.z) > 0.02, 'a clearing nine metres across is ringed by trees that lean over it — it is not a field');
  // the corridor that leads to it is roofed, and that is the whole point: the arrival is a change
  assert.ok(canopyAt(12, -38) > 0.8, 'the north forest floor must stay roofed');
  assert.ok(canopyAt(5.8, -58) > 0.8, 'the north path at the arch end must stay roofed');
  assert.ok(canopyAt(c.x, c.z + c.radius * 3) > 0.8, 'three radii out is back under the crowns');
});

test('walking in, the roof lifts gradually — it is not a switch', () => {
  const c = LAYOUT.northClearing;
  const walk = [];
  for (let d = 16; d >= 0; d -= 1) walk.push(canopyAt(c.x, c.z - d));
  for (let i = 1; i < walk.length; i++) assert.ok(walk[i] <= walk[i - 1] + 1e-9, `the roof closes again at ${16 - i} m out (${walk[i - 1].toFixed(2)} → ${walk[i].toFixed(2)})`);
  const biggestStep = Math.max(...walk.slice(1).map((v, i) => walk[i] - v));
  assert.ok(biggestStep < 0.3, `the roof lifts by ${biggestStep.toFixed(2)} in one metre — a listener walks through that in half a second`);
  assert.ok(walk[0] - walk[walk.length - 1] > 0.6, 'walking in from sixteen metres out must be an audible change');
});

test('skyOpening only cuts holes, and only where the world has one', () => {
  assert.equal(skyOpening(LAYOUT.northClearing.x, LAYOUT.northClearing.z), CLEARING_OPEN_MAX, 'the centre is as open as an opening gets');
  for (const [x, z] of [[1.5, -6], [12, -38], [-6.5, 2], [3.9, 37], [21.6, 2.2], [-23, 9]]) {
    assert.equal(skyOpening(x, z), 0, `(${x}, ${z}) is not a clearing and must not be given a hole`);
  }
  assert.ok(CLEARING_OPEN_MAX > 0 && CLEARING_OPEN_MAX <= 1, 'the opening is a fraction of the roof, not a gain');
});

test('the places that carry their own space still do', () => {
  // the terms are independent, and the regression to guard is one of them eating another
  const bore = surfaceAt(4.84, -55.4);
  assert.equal(bore.surface, 'hollow');
  assert.ok(bore.enclosure > 0.9, "the log arch's bore must still close over the listener");
  assert.ok(bore.canopy > 0.8, 'the bore is under the forest as well as inside the wood');
  const span = surfaceAt(3.9, 37.08);
  assert.ok(span.gorge > 0.9, 'mid-span on the bridge must still be out over the ravine');
  assert.equal(span.canopy, 0, 'and there is no roof over a ravine');
  assert.equal(surfaceAt(1.5, -6).canopy, 0, 'the village plaza is open sky');
});
