// CPU-only integration regression. Default: raw production after Fable's data and this hook land.
// --candidate: explicit isolated ec79e4ed character patch + e9a9fcdb prop publisher snapshots.
// --before: explicit negative control, old character source + the same Fable publisher.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../../../..');
const candidate = process.argv.includes('--candidate'), before = process.argv.includes('--before');
assert.ok(!(candidate && before), 'Choose only one explicit source mode');
const mode = before ? 'before' : candidate ? 'candidate' : 'production';
const overrides = new Map();
if (candidate || before) {
  for (const name of ['ground', 'index']) overrides.set(path.join(root, 'src/world/character', name + '.ts'), readFileSync(path.join(dir, name + '.' + mode + '.ts'), 'utf8'));
  overrides.set(path.join(root, 'src/world/props/index.ts'), readFileSync(path.join(dir, 'props.fable.ts'), 'utf8'));
}
const sourceOf = file => overrides.get(path.resolve(file)) ?? readFileSync(file, 'utf8');
const modules = new Map();
// Same in-memory TS-loader pattern used by props/geometry.test.mjs; no browser or global hook.
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = {exports: {}}; modules.set(file, module);
  const compiled = ts.transpileModule(sourceOf(file), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'three') return THREE;
    if (name === 'three/addons/utils/BufferGeometryUtils.js') return geometryUtils;
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name);
      for (const p of [target, target + '.ts', path.join(target, 'index.ts')]) if (p.endsWith('.ts') && existsSync(p)) return loadTs(p);
    }
    throw Error('Unexpected CPU dependency ' + name + ' from ' + file);
  }, module, module.exports);
  return module.exports;
}
const from = file => loadTs(path.join(root, 'src/world', file));
const {createGround} = from('character/ground.ts');
const {createTerrain} = from('terrain/heightfield.ts');
const {LAYOUT, EXPANSION, EXPANSION_STAIRS} = from('layout.ts');
const {WORLD} = from('config.ts');
const {NPC_LOOP} = from('character/placement.ts');
const {PLAYER_SPEED, PLAYER_ACCEL, PLAYER_DECEL} = from('character/animation.ts');
const {create: createProps} = from('props/index.ts');
const {PROP_LAYOUT} = from('props/layout.ts');
const {landingLength} = from('hardscape/stairs.ts');
const live = createTerrain('live'), legacy = createTerrain('legacy');
const failures = [], checks = [];
function check(name, test) {
  try { test(); checks.push(name); } catch (error) { failures.push({name, message: error.message}); }
}

// Isolate platform precedence, player radius, and the existing 2D wall policy.
const flat = {...live, height: () => 0};
const platform = {id: 'test', disc: {x: 500, z: 500, r: 4, y: 3}, deck: {a: [500, 3, 500], b: [506, 3, 500], hw: .475}, wall: {r: 2.5, half: .2, gap: [0, .2]}};
const prop = {x: 500.8, z: 500, r: .3, top: 3.5};
const baseShared = {walkSurfaces: [platform]};
const clear = createGround(flat, LAYOUT, baseShared);
const blocked = createGround(flat, LAYOUT, {...baseShared, propBlockers: [prop]});
check('prop on raised platform blocks before builtTop return', () => {
  assert.equal(clear.blocked(prop.x, prop.z), false);
  assert.equal(blocked.blocked(prop.x, prop.z), true);
  assert.equal(blocked.height(prop.x, prop.z), 3);
});
check('expanded player radius is 0.12 m', () => {
  assert.equal(blocked.blocked(prop.x + prop.r + .12 - 1e-6, prop.z), true);
  assert.equal(blocked.blocked(prop.x + prop.r + .12 + 1e-6, prop.z), false);
});
check('2D policy does not bypass a prop because its published top is low', () => {
  const under = createGround(flat, LAYOUT, {...baseShared, propBlockers: [{...prop, top: 2.5}]});
  assert.equal(under.blocked(prop.x, prop.z), true);
});
check('existing wall and structure-pad behavior remains', () => {
  assert.equal(blocked.blocked(500, 502.5), true);
  const house = LAYOUT.houses[0].position;
  assert.equal(blocked.blocked(house[0], house[2]), true);
});

// Execute the actual moveRoot/stepPlayer closures without building a renderer or character rig.
// AST extraction keeps the player call-site behavior under test instead of reimplementing it.
const playerSource = sourceOf(path.join(root, 'src/world/character/index.ts'));
function declaration(source, name) {
  const tree = ts.createSourceFile('input.ts', source, ts.ScriptTarget.Latest, true);
  const matches = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) matches.push(node.getText(tree));
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.equal(matches.length, 1, 'Unique actual-source declaration: ' + name);
  return 'const ' + matches[0] + ';';
}
const movementSource = ['JUMP_G', 'JUMP_APEX_WALK_M', 'JUMP_APEX_RUN_M', 'moveRoot', 'stepPlayer'].map(name => declaration(playerSource, name)).join('\n');
function playerHarness(ground, jump = null) {
  const link = {pos: new THREE.Vector3(500.3, 0, 500), yaw: 0, gait: 'walk', puppet: {group: {position: new THREE.Vector3(0, 3, 0)}, advance() {}}};
  const env = {ground, link, loco: {jump}, velocity: new THREE.Vector3(), input: {moveX: 0, moveZ: 0, run: false, jump: false}, moveDir: new THREE.Vector3(1, 0, 0), naviAnchor: new THREE.Vector3(), MathUtils: THREE.MathUtils, PLAYER_SPEED, PLAYER_ACCEL, PLAYER_DECEL, setGait: (actor, gait) => {actor.gait = gait;}, JUMP_CROUCH_S: .12, JUMP_LAND_S: .22};
  const compiled = ts.transpileModule('const {' + Object.keys(env).join(',') + '} = env; let speed = 0, jumpHeld = false;\n' + movementSource + '\nreturn {moveRoot, stepPlayer};', {compilerOptions: {module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022}}).outputText;
  return {...env, ...new Function('env', compiled)(env)};
}
check('real grounded player step stops at the prop and still moves away', () => {
  const player = playerHarness(blocked);
  assert.equal(player.moveRoot(.4, 0, .1), 0);
  assert.equal(player.link.pos.x, 500.3);
  assert.ok(player.moveRoot(-.2, 0, .1) > 0);
});
check('real airborne step cannot enter a prop even above its top', () => {
  for (const y of [3.4, 3.5, 3.500001, 4.5]) {
    const jump = {phase: 'air', t0: 0, y0: y, y, v0: 2.6, vx: 4, vz: 0, vLand: 0, flightS: 1, air: 0};
    const player = playerHarness(blocked, jump);
    player.stepPlayer(.1, .1); // gravity makes v0 exactly zero, preserving this boundary height
    assert.equal(player.link.pos.x, 500.3, 'baseY=' + y);
    assert.equal(jump.vx, 0);
  }
});
let descentCounterexample;
check('airborne entry cannot end with landing inside a solid prop', () => {
  const jump = {phase: 'air', t0: 0, y0: 3.8, y: 3.8, v0: 2.6, vx: 1, vz: 0, vLand: 0, flightS: 1, air: 0};
  const player = playerHarness(blocked, jump); player.link.pos.x = 500.35;
  const frames = [];
  for (let i = 1; i <= 4; i++) {
    player.stepPlayer(.1, i * .1);
    frames.push({frame: i, x: player.link.pos.x, y: jump.y, phase: jump.phase, vx: jump.vx});
  }
  const bodyInside = Math.hypot(player.link.pos.x - prop.x, player.link.pos.z - prop.z) < prop.r;
  descentCounterexample = {frames, bodyInside, propTop: prop.top, landingGround: blocked.height(player.link.pos.x, player.link.pos.z)};
  assert.ok(!(bodyInside && jump.phase === 'land' && jump.y < prop.top), 'Actor landed below the prop top while still inside its body');
});

// The same published west-house deck formula used by props/geometry.test.mjs and distantHouse.ts.
const W = EXPANSION.westHouse, R = W.radius, platR = R + .22;
const length = Math.hypot(W.deckEnd[0] - W.host[0], W.deckEnd[2] - W.host[1]);
const dx = (W.deckEnd[0] - W.host[0]) / length, dz = (W.deckEnd[2] - W.host[1]) / length;
const westWalk = {id: 'west-house', disc: {x: W.host[0], z: W.host[1], r: platR, y: W.floorY + .01}, deck: {a: [W.host[0] + dx * (platR - .15), W.floorY, W.host[1] + dz * (platR - .15)], b: W.deckEnd, hw: .475}, wall: {r: R * .96, half: .2, gap: [0, 0]}};
const shared = {walkSurfaces: [westWalk]}, audits = [];
const textures = {tier: 'high', load: async () => new THREE.Texture(), fallback: () => new THREE.Texture(), loaded: () => [], missing: () => [], report: () => ({})};
await createProps({terrain: legacy, layout: LAYOUT, config: WORLD, quality: {shadows: true}, textures, shared, audit: (_name, fn) => audits.push(fn)});
assert.ok(shared.propBlockers?.length, 'Fable propBlockers publisher is required; import e9a9fcdb before a production run');
const published = audits[0](), discs = shared.propBlockers;
const realGround = createGround(live, LAYOUT, shared), noProps = createGround(live, LAYOUT, {walkSurfaces: [westWalk]});
const ownerOf = b => published.placed.find(p => p.x === b.x && p.z === b.z)?.id ?? 'lookout-railing';
const distanceToSegment = (b, a, c) => {
  const ux = c[0] - a[0], uz = c[2] - a[2], d2 = ux * ux + uz * uz;
  const t = d2 ? Math.max(0, Math.min(1, ((b.x - a[0]) * ux + (b.z - a[2]) * uz) / d2)) : 0;
  return Math.hypot(b.x - a[0] - t * ux, b.z - a[2] - t * uz);
};
const route = (name, points) => {
  let worst = {clearanceM: Infinity};
  for (const b of discs) for (let i = 1; i < points.length; i++) {
    const clearanceM = distanceToSegment(b, points[i - 1], points[i]) - b.r - .12;
    if (clearanceM < worst.clearanceM) worst = {clearanceM, blocker: ownerOf(b), x: b.x, z: b.z, segment: i - 1};
  }
  return {name, ...worst};
};
const routes = [
  ['pathSpine', LAYOUT.pathSpine], ['pathToStairs', LAYOUT.pathToStairs], ['pathToHouse', LAYOUT.pathToHouse],
  ['northPath', LAYOUT.northPath], ['pathWest', EXPANSION.pathWest], ['pathSouth', EXPANSION.pathSouth],
].map(([name, points]) => route(name, points));
const flights = [...LAYOUT.stairs, ...EXPANSION_STAIRS].map(s => {
  const len = Math.hypot(...s.dir), ux = s.dir[0] / len, uz = s.dir[1] / len, run = s.steps * s.tread, end = run + landingLength(s);
  const centre = route('stairs:' + s.id, [s.base, [s.base[0] + ux * end, 0, s.base[2] + uz * end]]);
  let edge = {clearanceM: Infinity};
  for (const b of discs) {
    const bx = b.x - s.base[0], bz = b.z - s.base[2], u = bx * ux + bz * uz, v = -bx * uz + bz * ux;
    const distance = Math.hypot(u - Math.max(-.05, Math.min(end, u)), v - Math.max(-s.width / 2, Math.min(s.width / 2, v)));
    const clearanceM = distance - b.r - .12;
    if (clearanceM < edge.clearanceM) edge = {clearanceM, blocker: ownerOf(b), x: b.x, z: b.z};
  }
  return {...centre, rectangle: edge};
});
check('expanded discs preserve path and flight centre routes', () => {
  for (const r of [...routes, ...flights]) assert.ok(r.clearanceM > 0, JSON.stringify(r));
  for (const r of flights) assert.ok(r.rectangle.clearanceM > 0, 'Expanded disc reaches full tread width/landing: ' + JSON.stringify(r));
});
const npcRoute = route('NPC_LOOP', [...NPC_LOOP, NPC_LOOP[0]].map(p => [p.x, 0, p.z]));
check('existing NPC default calls remain clear along the authored loop', () => {
  assert.ok(npcRoute.clearanceM > 0, JSON.stringify(npcRoute));
  for (let i = 0; i < NPC_LOOP.length; i++) {
    const a = NPC_LOOP[i], b = NPC_LOOP[(i + 1) % NPC_LOOP.length], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .25);
    for (let k = 0; k <= n; k++) {
      const x = a.x + (b.x - a.x) * k / n, z = a.z + (b.z - a.z) * k / n;
      assert.equal(realGround.blocked(x, z), noProps.blocked(x, z), 'NPC default at ' + x + ',' + z);
    }
  }
});
const deck = westWalk.deck, sideOffset = -.2;
const deckCentre = route('west-deck-centre', [deck.a, deck.b]);
const deckSidePoints = [deck.a, deck.b].map(p => [p[0] - dz * sideOffset, p[1], p[2] + dx * sideOffset]);
const deckSide = route('west-deck-opposite-side', deckSidePoints);
const deckEntry = route('west-deck-entry-turn', [deck.b, deckSidePoints[1]]);
let deckCorridorSamples = 0;
check('west deck pot blocks on the deck while a player-width corridor stays open', () => {
  const pot = discs.find(b => ownerOf(b) === 'west-door-pot'); assert.ok(pot);
  assert.equal(noProps.blocked(pot.x, pot.z), false);
  assert.equal(realGround.blocked(pot.x, pot.z), true);
  assert.ok(Math.abs(sideOffset) + .12 < deck.hw, 'Corridor stays inside the deck with player radius');
  assert.ok(deckSide.clearanceM > 0, JSON.stringify(deckSide));
  assert.ok(deckEntry.clearanceM > 0, JSON.stringify(deckEntry));
  const points = [deck.b, deckSidePoints[1], deckSidePoints[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / .02);
    for (let k = 0; k <= n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, z = a[2] + (b[2] - a[2]) * k / n;
      assert.equal(realGround.blocked(x, z), false, 'Actual deck corridor blocked at ' + x + ',' + z);
      deckCorridorSamples++;
    }
  }
});
const rimEncroachments = [];
for (const b of discs) {
  const owner = ownerOf(b), def = PROP_LAYOUT.find(p => p.id === owner);
  let path = 0, stairs = 0;
  for (let i = 0; i < 64; i++) {
    const a = i * Math.PI / 32, x = b.x + Math.cos(a) * (b.r + .12), z = b.z + Math.sin(a) * (b.r + .12), mask = live.mask(x, z);
    if (mask.path > .5) path++; if (mask.stairs > 0) stairs++;
  }
  if ((!def?.paving && path) || stairs) rimEncroachments.push({owner, x: b.x, z: b.z, expandedRadius: b.r + .12, pathRimSamples: path, stairRimSamples: stairs});
}
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const result = {mode, passed: !failures.length, checks, failures, descentCounterexample, blockers: discs.length, routes, flights, npcRoute, deckCentre, deckSide, deckEntry, deckCorridorSamples, rimEncroachments, sources: Object.fromEntries(['src/world/character/ground.ts', 'src/world/character/index.ts', 'src/world/props/index.ts'].map(file => [file, digest(sourceOf(path.join(root, file)))]))};
writeFileSync(path.join(dir, 'check-' + mode + '.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
assert.deepEqual(failures, [], 'Prop-contact integration checks failed');
console.log('PASS: grounded and airborne prop entry blocked; raised platforms and existing routes checked.');
