/**
 * CPU only: node art/environment/astra-distance/moss-normal-domain-check.mjs [baseline-ref] [candidate-ref]
 * Reproduces the constant-V branch-cap frame from the native HDR probe, evaluates the actual
 * shader guard, and checks that valid frames retain their old normalization. No GPU required.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { ShaderChunk } from 'three';

const baseline = process.argv[2] ?? '6a694b66';
const file = 'src/world/trees/materials.ts';
const source = process.argv[3]
  ? execFileSync('git', ['show', `${process.argv[3]}:${file}`], { encoding: 'utf8' })
  : readFileSync(file, 'utf8');
const original = execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
const fragmentFunction = (text) => {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  return ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'treeFragment').getText(ast).replaceAll('\r\n', '\n');
};
const current = fragmentFunction(source);
const condition = current.match(/if \((barkMossCover > 0\.0[^\n]*)\) \{\n\s*vec3 tW = inverseTransformDirection/)[1];
const comment = '      // Constant-UV branch caps can have a zero tangent axis. The world-space transform\n' +
  '      // normalizes its input; keep the existing normal there instead of normalizing zero.\n';
assert.equal(current.replace(comment, '').replace(condition, 'barkMossCover > 0.0'), fragmentFunction(original),
  'The tree fragment hook must change only at the moss-normal guard');
const allow = new Function('barkMossCover', 'tbn', 'dot', `return ${condition};`);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, s) => a.map((v) => v * s);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize = (a) => mul(a, 1 / Math.sqrt(dot(a, a)));
// Match the installed Three tangent construction, including its shared scale. Constant V
// makes B zero even when T is valid; normalizing that B is the invalid source operation.
for (const line of ['T = q1perp * st0.x + q0perp * st1.x', 'B = q1perp * st0.y + q0perp * st1.y',
  'det = max( dot( T, T ), dot( B, B ) )', 'scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det )']) {
  assert.ok(ShaderChunk.normalmap_pars_fragment.includes(line), 'Three tangent construction changed');
}
function frame(uv, q0 = [1, 0, 0], q1 = [0, 1, 0]) {
  const n = normalize(cross(q0, q1)), q1p = cross(q1, n), q0p = cross(n, q0);
  const st0 = uv[1].map((v, i) => v - uv[0][i]), st1 = uv[2].map((v, i) => v - uv[0][i]);
  const t = add(mul(q1p, st0[0]), mul(q0p, st1[0]));
  const b = add(mul(q1p, st0[1]), mul(q0p, st1[1]));
  const det = Math.max(dot(t, t), dot(b, b)), scale = det === 0 ? 0 : 1 / Math.sqrt(det);
  return [mul(t, scale), mul(b, scale), n];
}
let normalizationCalls = 0;
const guardedAxes = (tbn, cover) => {
  if (!allow(cover, tbn, dot)) return null;
  normalizationCalls += 2;
  return [normalize(tbn[0]), normalize(tbn[1])];
};
// Actual near-canopy-giant-far-plateau-limb-1 cap vertices 4995, 4975, 4976 from the
// five-pixel HDR NaN probe. The test's screen-space triangle is an affine basis; constant V
// yields the same zero bitangent under any nondegenerate projected triangle or camera.
const capUv = [[0.5, 10.541932106018066], [1.704545497894287, 10.541932106018066], [1.7727272510528564, 10.541932106018066]];
const cap = frame(capUv);
assert.equal(dot(cap[1], cap[1]), 0);
assert.ok(normalize(cap[1]).some((v) => !Number.isFinite(v)), 'unguarded zero normalization must reproduce the invalid domain');
const degenerate = [cap, frame(capUv.map(([u, v]) => [v, u])), frame([[0, 0], [0, 0], [0, 0]]),
  frame([[0, 0], [1, 0], [0, 1e-6]]), frame([[0, 0], [1e-6, 0], [0, 1]])];
for (const tbn of degenerate) for (const cover of [0.01, 0.5, 1]) assert.equal(guardedAxes(tbn, cover), null);
assert.equal(normalizationCalls, 0, 'degenerate axes reached normalization');
let ordinaryCases = 0;
for (let i = 0; i < 128; i++) {
  const angle = i * Math.PI / 64, c = Math.cos(angle), s = Math.sin(angle);
  const uv = [[0, 0], [c * 0.5, s * 0.5], [-s * 2, c * 2]];
  const tbn = frame(uv, [1, 0.1, 0.15], [0.2, 1, -0.1]);
  assert.equal(guardedAxes(tbn, 0), null, 'bare bark entered moss perturbation');
  for (const cover of [0.01, 0.5, 1]) {
    const axes = guardedAxes(tbn, cover);
    assert.deepEqual(axes, [normalize(tbn[0]), normalize(tbn[1])], 'ordinary frame behavior changed');
    assert.ok(axes.flat().every(Number.isFinite));
    ordinaryCases++;
  }
}
console.log(JSON.stringify({ baseline, degenerateCases: degenerate.length * 3, ordinaryCases,
  contract: 'Only the moss normal guard changes. Degenerate axes never normalize; ordinary normalization is identical.', nativeRenderRequired: true }, null, 2));
