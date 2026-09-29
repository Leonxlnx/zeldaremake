/**
 * Run: node --test src/world/trees/lodFade.test.mjs (Node 20+, no browser needed).
 *
 * The rung transition band (art/environment/squad2-2026-09-23/dither/PROPOSAL.md, checked out in
 * gatesweep/). Two things have to hold or the feature is worse than the hard cut it replaces:
 *
 *   • with the band disabled, `lodSlots` must return exactly the old single-bucket answer — one rung,
 *     full weight — for every distance, including the gates themselves, so the flag remains a one-line
 *     way back to a build that cannot differ by a pixel;
 *   • with it on, a tree's weights must sum to 1 at every distance (a sum under 1 thins the tree into
 *     the background mid-swap, a sum over 1 draws it twice at full strength and doubles its cost), and
 *     the crossover must sit ON the gate, or the fade is off-centre and the swap still reads as a step.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'lodFade.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = {};
new Function('exports', js)(mod);
const { bandOverlaps, lodSlots, TREE_LOD_DITHER, TREE_LOD_DITHER_BAND_M } = mod;

const GATES = [32, 44];
/**
 * The gates as each quality tier resolves them: `TREE_LOD_NEAR_M` 32 and `TREE_LOD_MID_M` 44 scaled by
 * `quality.distance` (world/index.ts `qualityFor`). The gap is what limits the band, and it is tightest on
 * the WEAKEST tier — which is the one a band chosen at `quality=high` would silently break.
 */
const TIER_GATES = {
  low: [32 * 0.6, 44 * 0.6],
  medium: [32 * 0.8, 44 * 0.8],
  high: [32, 44],
  ultra: [32 * 1.25, 44 * 1.25],
};

test('with the flag off every distance gives one rung at full weight', () => {
  for (let d = -5; d <= 80; d += 0.25) {
    const slots = lodSlots(d, GATES, TREE_LOD_DITHER_BAND_M, false);
    assert.equal(slots.length, 1, `d=${d} split without the flag`);
    assert.equal(slots[0].weight, 1, `d=${d} came back at partial weight without the flag`);
    const expected = d < GATES[0] ? 0 : d < GATES[1] ? 1 : 2;
    assert.equal(slots[0].level, expected, `d=${d} picked rung ${slots[0].level}, the old rule says ${expected}`);
  }
});

test('with the flag on the weights always sum to 1', () => {
  for (let d = -5; d <= 80; d += 0.1) {
    const slots = lodSlots(d, GATES, 2.5, true);
    const sum = slots.reduce((n, s) => n + s.weight, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `d=${d} sums to ${sum}`);
    for (const s of slots) assert.ok(s.weight >= 0 && s.weight <= 1, `d=${d} weight ${s.weight} out of range`);
  }
});

test('the crossover sits on the gate, and only inside the band', () => {
  for (const [g, gate] of GATES.entries()) {
    const at = lodSlots(gate, GATES, 2.5, true);
    assert.equal(at.length, 2, `no pair at gate ${gate}`);
    assert.equal(at[0].level, g, `the near rung of the pair at ${gate} is wrong`);
    assert.equal(at[1].level, g + 1, `the far rung of the pair at ${gate} is wrong`);
    assert.ok(Math.abs(at[0].weight - 0.5) < 1e-9, `the gate itself is not the half-way point (${at[0].weight})`);

    const inside = lodSlots(gate - 1.0, GATES, 2.5, true);
    assert.equal(inside.length, 2, 'a metre inside the gate should still be a pair');
    assert.ok(inside[0].weight > 0.5, 'nearer than the gate must favour the nearer rung');

    for (const d of [gate - 1.26, gate + 1.26]) {
      assert.equal(lodSlots(d, GATES, 2.5, true).length, 1, `d=${d} is outside the band and must be a single rung`);
    }
  }
});

test('a tree the camera stands inside takes the nearest rung', () => {
  const slots = lodSlots(-3, GATES, 2.5, true);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].level, 0);
});

/**
 * The band's real ceiling, and the failure it prevents. `lodSlots` walks the gates in order and returns on
 * the first one whose band contains `d`, so two overlapping bands are not a glitch — the far gate's fade is
 * silently skipped and nothing in the frame says so. The gap between gates scales with `quality.distance`,
 * so the tightest case is `quality=low`, and a width validated only at high can be broken there.
 */
test('the shipped band fits between the gates on every quality tier', () => {
  for (const [tier, gates] of Object.entries(TIER_GATES)) {
    assert.equal(bandOverlaps(gates, TREE_LOD_DITHER_BAND_M), false, `the shipped band does not fit at quality=${tier} (gates ${gates[0]}–${gates[1]} m)`);
  }
  // low is the binding tier: 19.2 and 26.4 m, 7.2 m apart, against 12 m at high and 15 m at ultra
  const [lo, hi] = TIER_GATES.low;
  assert.ok(hi - lo < TIER_GATES.high[1] - TIER_GATES.high[0], 'low must be the tightest gap, or this test is checking the wrong tier');
  assert.equal(bandOverlaps(TIER_GATES.low, hi - lo - 0.01), false, 'a band just under the gap must still fit');
  assert.equal(bandOverlaps(TIER_GATES.low, hi - lo), true, 'a band equal to the gap must be rejected — the bands touch');
});

test('an overlapping band is why the predicate exists: trees in the overlap take the wrong rung', () => {
  const gates = TIER_GATES.low; // 19.2 and 26.4 m
  const wide = gates[1] - gates[0] + 2; // 9.2 m — inside what yesterday's 8 m and 12 m sweep variants used
  const half = wide / 2;
  // the region inside BOTH bands: past the near gate's far edge is where the far gate's band already began
  const overlapFrom = gates[1] - half;
  const overlapTo = gates[0] + half;
  assert.ok(overlapTo > overlapFrom, 'this width must actually overlap, or the test proves nothing');
  const d = (overlapFrom + overlapTo) / 2;

  // the hard cut puts this tree in rung 1: it is past the near gate and short of the far one
  assert.equal(lodSlots(d, gates, wide, false)[0].level, 1);
  // with overlapping bands the near gate wins the first-match loop, so it is drawn partly at rung 0 —
  // a rung MORE detailed than the hard cut would ever give it, and nowhere near the 1→2 fade it is in
  const slots = lodSlots(d, gates, wide, true);
  assert.deepEqual(
    slots.map((s) => s.level),
    [0, 1],
    'the near gate claims a tree that belongs to the 1→2 crossing',
  );

  // and the far gate itself is still fine, which is why this is silent rather than obvious
  const atFar = lodSlots(gates[1], gates, wide, true);
  assert.deepEqual(
    atFar.map((s) => s.level),
    [1, 2],
    'the far gate still crosses over correctly — only the overlap region is wrong',
  );
  assert.ok(Math.abs(atFar[0].weight - 0.5) < 1e-9);
});

test('a zero band is the hard cut, even with the flag on', () => {
  for (const d of [GATES[0], GATES[0] - 0.1, GATES[1]]) {
    const slots = lodSlots(d, GATES, 0, true);
    assert.equal(slots.length, 1, `d=${d} split with no band at all`);
  }
});

/**
 * The plumbing half, pinned at the source: the weight attribute must be written only while the flag is
 * on, must default to 1 for a tree with no recorded weight, and must stay out of the depth pass — the
 * white-barks' high bucket shares its geometry with the shadow proxy, which fills the same buffers in a
 * different instance order, so a weight read there would mask the wrong instances.
 */
const indexSource = readFileSync(path.join(here, 'index.ts'), 'utf8');

test('the weight attribute is written only behind the flag', () => {
  const at = indexSource.indexOf('const fillFamily');
  assert.notEqual(at, -1, 'fillFamily is gone');
  const body = indexSource.slice(at, indexSource.indexOf('\n  };', at));
  assert.match(body, /if \(TREE_LOD_DITHER\) \{/, 'the attribute write must be guarded by the flag');
  assert.match(body, /1 - \(w\.lodWeights\?\.get\(l \* w\.placements\.length \+ list\[k\]\) \?\? 1\)/, 'the attribute carries the DROP fraction, so an unrecorded tree writes 0 and draws whole');
});

test('the attribute is lazily attached and marked dynamic', () => {
  const at = indexSource.indexOf('const fadeAttribute');
  assert.notEqual(at, -1, 'fadeAttribute is gone');
  const body = indexSource.slice(at, indexSource.indexOf('\n  };', at));
  assert.match(body, /getAttribute\('aLodDrop'\)/, 'it must reuse an attribute it already attached');
  assert.match(body, /new Float32Array\(mesh\.instanceMatrix\.count\)(?!\.fill)/, 'a zeroed buffer is "draw whole" for every slot, which is also what WebGL feeds a mesh without the attribute');
  assert.match(body, /setUsage\(DynamicDrawUsage\)/, 'it is rewritten on every bucket change');
});

test('the shared-geometry constraint is recorded where the attribute is made', () => {
  const at = indexSource.indexOf('const fadeAttribute');
  const doc = indexSource.slice(Math.max(0, at - 1200), at);
  assert.match(doc, /shadow proxy/i, 'the proxy sharing the medium rung geometry must stay written down here');
  assert.match(doc, /colour pass/i, 'the discard being colour-pass only is the consequence to keep');
});

/**
 * The mask itself. Two things make it safe rather than clever: the attribute is a DROP fraction (a mesh
 * that never gets the attribute — the white-bark roots share this material — reads 0 and draws whole),
 * and the mask is injected only where a colour `extra` is passed, never into the depth materials, because
 * the white-barks' high bucket shares its geometry with the shadow proxy in a different instance order.
 */
const matSource = readFileSync(path.join(here, 'materials.ts'), 'utf8');

test('the mask discards against the drop fraction, hashed per pixel', () => {
  assert.match(matSource, /attribute float aLodDrop;/, 'the instance drop must reach the vertex stage');
  assert.match(matSource, /vLodDrop = aLodDrop;/, 'and travel to the fragment stage');
  assert.match(matSource, /if \(lodHash < vLodDrop\) discard;/, 'the kept share must be 1 − drop');
  assert.match(matSource, /gl_FragCoord\.xy/, 'a screen-space hash is what makes the kept fragments a stipple');
});

test('the mask is colour-pass only', () => {
  const at = matSource.indexOf('function injectWind');
  const body = matSource.slice(at, matSource.indexOf('\n}', at));
  assert.match(body, /if \(extra\) injectLodDrop\(shader\)/, 'the depth materials pass no extra: they must not get the mask');
  assert.match(matSource, /if \(!TREE_LOD_DITHER\) return;/, 'with the flag off the program must be untouched');
});

test('a flag flip cannot reuse a cached program', () => {
  assert.match(matSource, /trees-\$\{key\}-v8\$\{TREE_LOD_DITHER \? '-drop' : ''\}/, 'the cache key must carry the flag');
});

/**
 * The flag used to be pinned false here, because a weight that reaches no shader thins every banded tree
 * into the background. Both halves are in now and it is on, so the assertion that matters is the
 * conditional one: whichever way the flag is set, it must not be ON while either half is missing. The
 * tests above already pin the halves in detail; this one fails loudly if someone turns the flag on in a
 * tree where they have been deleted, or deletes one while it is on.
 */
test('the flag is never on without both halves of the drawing path', () => {
  assert.equal(typeof TREE_LOD_DITHER, 'boolean', 'the flag must stay a compile-time constant');
  if (!TREE_LOD_DITHER) return;
  assert.match(indexSource, /if \(TREE_LOD_DITHER\) \{\s*\n\s*const attr = fadeAttribute\(mesh\);/, 'the flag is on but fillFamily writes no drop fraction');
  assert.match(matSource, /if \(lodHash < vLodDrop\) discard;/, 'the flag is on but no colour program discards against the drop');
});
