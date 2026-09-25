/**
 * Run: node --test src/world/canopy/roofSky.test.mjs (Node 20+, no browser needed).
 *
 * The roof's underside light, which is a measurement and not taste (backlog item 4, "a dark flat
 * disc overhead"): looking up 60° from the open north the roof owned the frame's dark lower half and
 * 98.5 % of its own pixels there were under display level 30, with the frame's neighbour-to-neighbour
 * luminance difference at 1.75 against 5.0–5.3 in the leafy parts of the same frame
 * (art/environment/squad2-2026-09-23/roofsky).
 *
 * Two rules keep that from coming back, and each is one term in a string of GLSL:
 *
 *   • the underside takes sky light through the layer, scaled by the atlas' overlap-depth channel
 *     LINEARLY (`thin`), not squared and not gated by the sun's direction — `thin²·back` is the
 *     sun-through term, which a mass in shade never gets, and it was the only structure the
 *     underside had;
 *   • the flat ambient lift stays as it was (a mass with no fringe must not go black), so the sky
 *     term is an addition, not a replacement: raising the flat lift instead would pale the deep
 *     masses, which is what got a paling change reverted at 05:30.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'index.ts'), 'utf8');

const num = (name) => {
  const m = source.match(new RegExp(`export const ${name} = ([0-9.]+);`));
  assert.ok(m, `${name} is gone from canopy/index.ts`);
  return Number(m[1]);
};
/** the fragment body that runs after lights_fragment_end */
const body = () => {
  const at = source.indexOf('const ROOF_FRAGMENT_BODY');
  assert.notEqual(at, -1, 'ROOF_FRAGMENT_BODY is gone from canopy/index.ts');
  return source.slice(at, source.indexOf('`;', at));
};

test('the underside takes sky light through the layer, linearly in the depth channel', () => {
  const glsl = body();
  const line = glsl.split('\n').find((l) => l.includes('uRoofSkyThrough'));
  assert.ok(line, 'the sky-through term is gone: the underside is back to one flat number per texel');
  assert.match(line, /indirectDiffuse/, 'the sky term belongs in the indirect light, not the direct');
  assert.match(line, /uRoofSkyThrough \* thin(?! \* thin)/, 'the sky term must scale with `thin` linearly — squared, a mass in shade gets nothing again');
  assert.doesNotMatch(line, /back/, 'the sky term must not be gated by the sun direction (that is the sun-through term)');
  assert.match(line, /uRoofSkyColor/, "the transmitted sky keeps the air's own colour");
  assert.ok(num('ROOF_SKY_THROUGH') > 0, 'ROOF_SKY_THROUGH at 0 is the flat slab again');
});

test('the flat ambient lift is still there and still small', () => {
  const glsl = body();
  assert.match(glsl, /uRoofUnderLift \* diffuseColor\.rgb/, 'the flat lift is gone: a mass with no fringe reads black');
  const lift = num('ROOF_UNDER_LIFT');
  assert.ok(lift > 0 && lift <= 0.2, `ROOF_UNDER_LIFT ${lift} — a flat lift over 0.2 pales the deep masses instead of lighting the fringes`);
  assert.ok(num('ROOF_SKY_THROUGH') > lift, 'the structure (sky through the layer) should carry more than the flat lift, or the underside is flat again');
});

test('the sky colour is the air colour at unit scale, so the constant is the whole strength', () => {
  assert.match(source, /const skyTint = new Color\(ctx\.config\.fog\.color\)/, 'the transmitted sky must come from the air colour, not a literal');
  assert.match(source, /skyTint\.multiplyScalar\(1 \/ Math\.max\(1e-3, Math\.max\(skyTint\.r, skyTint\.g, skyTint\.b\)\)\)/, 'unit-scaling is what makes ROOF_SKY_THROUGH readable as a strength');
});

test('the program cache key moved with the shader', () => {
  const m = source.match(/customProgramCacheKey = \(\) => 'canopy-roof-v(\d+)'/);
  assert.ok(m, 'the roof material lost its program cache key');
  assert.ok(Number(m[1]) >= 2, 'the cache key still says v1 while the fragment shader has the sky term');
});
