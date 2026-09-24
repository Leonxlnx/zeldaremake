// node --test src/audio/surfaces.test.mjs — every built standing place has a built footstep sound.
//
// The owner, 2026-09-22: "his footsteps should correlate where he's walking — gentle stone, grass,
// etc." `surfaceAt()` answers that by re-deriving each built surface from `layout.ts` — the west
// house's platform, the log arch's bore, the rope bridge's planks, the plateau's dais. That is
// correct every time it is written and it goes stale silently: a builder adds a thing the character
// can stand on, the character ground learns to stand on it, and nothing tells the audio. The
// failure is specific and quiet — the player walks out onto a new structure and his boots say lawn,
// which is how the lookout dais went eight rounds sounding like turf.
//
// So this is a list, not a playthrough: every standing place the layout names, and what it must
// sound like. Adding one to the layout without adding it here is the thing being guarded against,
// so the list is also the place to add the next one.
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
const { surfaceAt } = loadTs(path.join(here, 'index.ts'));
const { LAYOUT, EXPANSION, EXPANSION_SOUTH, EXPANSION_NORTH, northGangway } = loadTs(path.join(here, '../world/layout.ts'));

/** rotate (u along, v across) in a thing's own frame into the world */
const inFrame = (x, z, yaw, u, v) => [x + Math.cos(yaw) * u - Math.sin(yaw) * v, z + Math.sin(yaw) * u + Math.cos(yaw) * v];

/** [what it is, x, z, the surface it must sound like] */
function standingPlaces() {
  const p = [];
  const wh = EXPANSION.westHouse;
  p.push(["the west house's platform", wh.host[0], wh.host[1], 'wood']);
  p.push(['its walkway deck', (wh.host[0] + wh.deckEnd[0]) / 2, (wh.host[1] + wh.deckEnd[2]) / 2, 'wood']);

  const b = EXPANSION_SOUTH.bridge;
  for (const t of [0.25, 0.5, 0.75]) p.push([`the rope bridge at ${t} of its span`, b.north[0] + (b.south[0] - b.north[0]) * t, b.north[1] + (b.south[1] - b.north[1]) * t, 'bridge']);

  const tn = EXPANSION_SOUTH.tunnel;
  const dl = Math.hypot(tn.dir[0], tn.dir[1]) || 1;
  for (const d of [1.5, 3]) p.push([`the far bank's log, ${d} m in`, tn.mouth[0] + (tn.dir[0] / dl) * d, tn.mouth[1] + (tn.dir[1] / dl) * d, 'hollow']);

  p.push(["the log arch's bore on the north path", 4.84, -55.4, 'hollow']);
  p.push(['the main stone flight', 9.2, -1.4, 'stone']);

  const c = LAYOUT.northClearing;
  p.push(["the stone circle's centre slab", c.x, c.z, 'stone']);
  p.push(['the north clearing, paved to its rim', c.x, c.z + c.radius * 0.85, 'stone']);

  // round 47: a slab on the east plateau's south-west lip that the player steps up onto. The
  // character ground stands on its top (hardscape merges it into the `flagstones` mesh); the props
  // lane's rope railing is set INTO it rather than decking it over, so the boots are on stone.
  const lk = LAYOUT.lookout;
  const lkYaw = (lk.yawDeg * Math.PI) / 180;
  p.push(['the plateau lookout dais', lk.x, lk.z, 'stone']);
  for (const [u, v] of [[lk.halfLength * 0.7, 0], [-lk.halfLength * 0.7, 0], [0, lk.halfDepth * 0.7]]) {
    const [x, z] = inFrame(lk.x, lk.z, lkYaw, u, v);
    p.push([`the dais at (${u.toFixed(1)}, ${v.toFixed(1)}) in its own frame`, x, z, 'stone']);
  }

  // The north grove, 11 m up two trees. Its decks are timber on joists; the walkway between them
  // hangs with a 0.12 m sag over nothing at all, which is the object the `bridge` surface exists
  // for — this lane split the two apart for the ravine and the reason is stronger here.
  const N = EXPANSION_NORTH;
  const g = northGangway();
  p.push(["the stilt house's veranda", N.stilt.host[0], N.stilt.host[1], 'wood']);
  p.push(["the tree hut's platform", N.hut.host[0], N.hut.host[1], 'wood']);
  p.push(['the gangway up to the door', (g.foot[0] + g.head[0]) / 2, (g.foot[2] + g.head[2]) / 2, 'wood']);
  {
    const dx = N.hut.host[0] - N.stilt.host[0];
    const dz = N.hut.host[1] - N.stilt.host[1];
    for (const t of [0.4, 0.5, 0.6]) p.push([`the rope walk at ${(t * 100).toFixed(0)} % of its span`, N.stilt.host[0] + dx * t, N.stilt.host[1] + dz * t, 'bridge']);
  }
  return p;
}

test('every built standing place in the layout sounds built', () => {
  const missed = [];
  for (const [what, x, z, want] of standingPlaces()) {
    const got = surfaceAt(x, z).surface;
    if (got !== want) missed.push(`${what} at (${x.toFixed(2)}, ${z.toFixed(2)}) sounds like ${got}, should be ${want}`);
  }
  assert.deepEqual(missed, [], `\n  ${missed.join('\n  ')}\n`);
});

test('the ground around them is still the ground', () => {
  // the mirror of the test above: a built footprint that has swollen past its own outline is as
  // wrong as one that was never added, and it is the easier mistake to make with a margin
  const lk = LAYOUT.lookout;
  const lkYaw = (lk.yawDeg * Math.PI) / 180;
  const [tx, tz] = inFrame(lk.x, lk.z, lkYaw, 0, lk.halfDepth + 1.2);
  assert.equal(surfaceAt(tx, tz).surface, 'grass', 'the plateau turf beside the dais');
  const [ex, ez] = inFrame(lk.x, lk.z, lkYaw, lk.halfLength + 1.2, 0);
  assert.equal(surfaceAt(ex, ez).surface, 'grass', 'the plateau turf off the dais\u2019 end');
  const c = LAYOUT.northClearing;
  assert.equal(surfaceAt(c.x, c.z + c.radius + 2).surface, 'leaf', 'the forest floor outside the clearing');
  const wh = EXPANSION.westHouse;
  assert.notEqual(surfaceAt(wh.host[0] + wh.radius + 1.5, wh.host[1]).surface, 'wood', 'the ground off the west house platform');
});

test('every surface the footstep designer knows is reachable somewhere in the world', () => {
  // the other direction: a surface nothing in the world returns is a voice nobody ever hears
  const heard = new Set();
  for (let x = -40; x <= 40; x += 0.5) for (let z = -90; z <= 60; z += 0.5) heard.add(surfaceAt(x, z).surface);
  for (const s of ['stone', 'grass', 'dirt', 'wood', 'hollow', 'leaf', 'bridge']) assert.ok(heard.has(s), `nowhere in the world sounds like ${s}`);
});
