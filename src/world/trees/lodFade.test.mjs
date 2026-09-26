/**
 * Run: node --test src/world/trees/lodFade.test.mjs (Node 20+, no browser needed).
 *
 * The rung transition band (art/environment/squad2-2026-09-23/dither/PROPOSAL.md). Two things have to
 * hold or the feature is worse than the hard cut it replaces:
 *
 *   • with the flag off, `lodSlots` must return exactly the old single-bucket answer — one rung, full
 *     weight — for every distance, including the gates themselves, so a build with the flag off cannot
 *     differ by a pixel;
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
const { lodSlots, TREE_LOD_DITHER, TREE_LOD_DITHER_BAND_M } = mod;

const GATES = [32, 44];

test('the flag ships off until the drawing half lands', () => {
  assert.equal(TREE_LOD_DITHER, false, 'the band must not be on before a per-instance weight reaches the shader');
});

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

test('the attribute is attached with the mesh and exempt from the array release', () => {
  const at = indexSource.indexOf('if (TREE_LOD_DITHER) {', indexSource.indexOf('const familyMeshes'));
  assert.notEqual(at, -1, 'familyMeshes no longer attaches the drop attribute');
  const body = indexSource.slice(at, at + 700);
  assert.match(body, /new InstancedBufferAttribute\(new Float32Array\(n\), 1\)/, 'one float per instance slot, zeroed — every tree draws whole until a band says otherwise');
  assert.match(body, /setUsage\(DynamicDrawUsage\)/, 'it is rewritten on every bucket change');
  assert.match(body, /drop\.onUpload\(function \(\) \{\}\)/, "it must carry its own no-op onUpload: releaseAfterUpload's callback nulls the array after the first upload and the next write throws");
  assert.match(body, /setAttribute\('aLodDrop', drop\)/, 'and be attached to the rung geometry');
});

test('fillFamily refuses to write into a freed or missing array', () => {
  const at = indexSource.indexOf('const fadeAttribute');
  const body = indexSource.slice(at, indexSource.indexOf('\n  };', at));
  assert.match(body, /attr && attr\.array \? attr : null/, 'a null array is the crash this guard exists for');
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
