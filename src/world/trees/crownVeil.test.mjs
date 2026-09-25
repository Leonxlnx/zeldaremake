/**
 * Run: node --test src/world/trees/crownVeil.test.mjs (Node 20+, no browser needed).
 *
 * The canopy's two depth veils and the rules behind them, which are measurements and not taste — the
 * owner's 23:00 job 6, fable-cursor's 05:30 review that reverted the first attempt, and fable-5's
 * 10:28 read (art/environment/squad2-2026-09-23/softedge, crowntone). They are easy to undo by
 * accident, because each is one number in a string of GLSL, so each is pinned here:
 *
 *   • the giants' leaf cards take the veil as the eye CLIMBS (the ground mist thins with height, so a
 *     leaf mass overhead keeps its whole local shade and reads as a dark card against the pale sky);
 *   • the crown cards take it on the LEVEL and not overhead (a crown seen on the level shows its
 *     upright cards, the mass the reference pales into the mist; from below it shows its floor cards,
 *     and paling those printed their quads and got the merge reverted);
 *   • neither can pass the reference's own relation between its foliage and its air (r_025:
 *     0.436 / 0.539 = 0.809), which is what the review asked for in words — "the tone moving toward
 *     the air only as much as the reference's r_025 band" — expressed as a per-fragment cap;
 *   • the crowns' near edge stays outside the walker's middle distance, which this lane's mid canopy
 *     filled and fable-5 credited.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'distant.ts'), 'utf8');

/** the constants and the GLSL builder, read out of distant.ts without its three.js dependencies */
function veilModule() {
  const pick = (name) => {
    const at = source.indexOf(`export const ${name}`);
    assert.notEqual(at, -1, `${name} is gone from distant.ts`);
    const end = source.indexOf('\n};', at) >= 0 && source.indexOf('\n};', at) < source.indexOf(';\n', at) ? source.indexOf('\n};', at) + 3 : source.indexOf(';\n', at) + 1;
    return source.slice(at, end);
  };
  const fn = source.slice(source.indexOf('export function canopyVeilGlsl'), source.indexOf('\n}', source.indexOf('export function canopyVeilGlsl')) + 2);
  const js = ts.transpileModule(`${pick('CROWN_VEIL')}\n${pick('CANOPY_DEPTH_VEIL')}\n${fn}\nexports.CROWN_VEIL = CROWN_VEIL; exports.CANOPY_DEPTH_VEIL = CANOPY_DEPTH_VEIL; exports.canopyVeilGlsl = canopyVeilGlsl;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', js)(module, module.exports);
  return module.exports;
}

const { CROWN_VEIL, CANOPY_DEPTH_VEIL, canopyVeilGlsl } = veilModule();

/** the smoothstep the GLSL emits, so a claim about "how much veil at 17 m" is the shader's own */
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

test("the giants' leaf cards take the veil as the eye climbs, the crown cards as it levels", () => {
  const giants = canopyVeilGlsl(CANOPY_DEPTH_VEIL);
  const crowns = canopyVeilGlsl(CROWN_VEIL);
  // a rising gate reads smoothstep(lo, hi, rayUp); a falling one is one minus it
  assert.match(giants, /float veilClimb = smoothstep\(/, "the giants' gate should rise with the view ray");
  assert.doesNotMatch(giants, /float veilClimb = 1\.0 - smoothstep\(/);
  assert.match(crowns, /float veilClimb = 1\.0 - smoothstep\(/, "the crowns' gate should fall with the view ray");
  // and the constants say the same thing, so a future edit cannot pass one and fail the other
  assert.ok(CANOPY_DEPTH_VEIL.ray[0] < CANOPY_DEPTH_VEIL.ray[1], 'CANOPY_DEPTH_VEIL.ray should be ascending (rising gate)');
  assert.ok(CROWN_VEIL.ray[0] > CROWN_VEIL.ray[1], 'CROWN_VEIL.ray should be descending (falling gate)');
});

test("a crown in the walker's middle distance keeps its own colour", () => {
  // 17 m is where the reference's trees are still dark and saturated, and where this lane's mid
  // canopy answered "the trees do not populate": no more than a twentieth of the veil may reach it
  const at17 = CROWN_VEIL.share * smoothstep(CROWN_VEIL.m[0], CROWN_VEIL.m[1], 17);
  assert.ok(at17 <= 0.05, `a crown 17 m off takes ${at17.toFixed(3)} of the veil; the measured near band holds below 0.05`);
  // and by 30 m — where a level view's crowns stand — it is most of the way on, which is the point
  const at30 = CROWN_VEIL.share * smoothstep(CROWN_VEIL.m[0], CROWN_VEIL.m[1], 30);
  assert.ok(at30 >= 0.75, `at 30 m the veil is only ${at30.toFixed(3)} on; the level view needs it there`);
});

test("no fragment is taken past the reference's own foliage-to-air relation", () => {
  // r_025: foliage 0.436 over air 0.539. Both veils fade out over `lift`, a share of the air's own
  // level, so the cap holds whatever the share and wherever the ramp reaches.
  const relation = 0.436 / 0.539;
  for (const [name, veil] of [
    ['CROWN_VEIL', CROWN_VEIL],
    ['CANOPY_DEPTH_VEIL', CANOPY_DEPTH_VEIL],
  ]) {
    assert.ok(veil.lift[1] <= 1.0, `${name}.lift must end at or below parity with the air`);
    assert.ok(veil.lift[0] < veil.lift[1], `${name}.lift must be ascending`);
    const leftAtRelation = 1 - smoothstep(veil.lift[0], veil.lift[1], relation);
    assert.ok(leftAtRelation < 0.5, `${name} still gives ${leftAtRelation.toFixed(2)} of its veil to a fragment already at the reference's relation`);
  }
  // the emitted GLSL divides by the air's own luminance, so the test lives in the material's space
  // and not the screen's (an absolute threshold read nothing: the god-ray in-scatter is a post pass)
  assert.match(canopyVeilGlsl(CROWN_VEIL), /dot\(gl_FragColor\.rgb, veilW\) \/ max\(1e-4, dot\(kfColor, veilW\)\)/);
});

test('the veil is laid after the fog chunk, on the air colour that chunk computed', () => {
  const glsl = canopyVeilGlsl(CROWN_VEIL);
  // kfColor (atmosphere/heightfog.ts) is the air of this fragment's own ray and distance; mixing
  // toward the plain fogColor uniform moved nothing, because <fog_fragment> runs after the encode
  assert.match(glsl, /mix\(gl_FragColor\.rgb, kfColor \* vec3\(/);
  assert.match(glsl, /#ifdef USE_FOG/);
});
