// Raw source regression; optionally pass an explicit local candidate TS file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const file = process.argv[2] ?? 'src/world/character/glbLink.ts';
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['measureFootprint', 'hipContactHeight', 'footprintSupport', 'clearsHipFootprint'];
const fn = names.map(name => {
  const matches = tree.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.equal(matches.length, 1, name);
  return matches[0];
});
const constants = tree.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d =>
  ['SOLE_BAND', 'FALLBACK_FOOTPRINT', '_hipFootprint', '_hipLateral', '_hipForward', '_p'].includes(d.name.getText(tree))));
assert.equal(constants.length, 6);
// Execute the raw runtime initializer as well as its predicate; never apply a fix in this check.
const start = source.indexOf('            const count = leg.', source.indexOf('// The ankle pivot preserves'));
const end = source.indexOf('            let eps = flex - HIP_FLEX_MAX;', start);
assert(start > 0 && end > start, 'Final hip guard initializer not found');
const slackExpression = source.match(/const slack = ([^\r\n]+);/)?.[1];
assert(slackExpression, 'Final hip slack expression not found');
const resize = source.match(/  const hipContactCount = Math.max\(\.\.\.legs.map\(\(leg\) => leg.hipContactLocal.length\)\);\r?\n  if \(_hipFootprint.length < hipContactCount \* 4\) _hipFootprint = new Float64Array\(hipContactCount \* 4\);/)?.[0] ?? '';
const cell = fs.readFileSync('src/world/character/ground.ts', 'utf8').match(/export const STAIR_CELL = ([.\d]+);/);
assert(cell, 'Production stair cell size not found');
const code = [...constants, ...fn].map(n => n.getText(tree)).join('\n') + `
function initialize(leg, surface) {
  const legs = [leg], _q2 = leg.qTilt.clone().multiply(leg.qAnkle);
  ${resize}
  ${source.slice(start, end)}
  return {count, planeGap, slack: (${slackExpression})};
}
function allows(leg, surface, endpoint) {
  const {count, planeGap} = initialize(leg, surface);
  return clearsHipFootprint(surface, new Vector3(), endpoint, count, leg.fp, planeGap);
}
return {measure: measureFootprint, allows, slackAt: leg => initialize(leg, () => 0).slack};`;
const js = ts.transpileModule(code, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}
}).outputText;
const {measure, allows, slackAt} = new Function('Vector3', 'Quaternion', 'MathUtils', 'STAIR_CELL', js)(
  THREE.Vector3, THREE.Quaternion, THREE.MathUtils, Number(cell[1]));
const ankle = new THREE.Bone(), toe = new THREE.Bone(), other = new THREE.Bone();
ankle.add(toe);
ankle.updateMatrixWorld(true);
other.updateMatrixWorld(true);
const positions = [], indices = [], weights = [];
function point(x, y, z, joints, influence) {
  positions.push(x, y, z); indices.push(...joints); weights.push(...influence);
}
for (let i = 0; i < 8; i++) point(i % 2 ? .04 : -.04, .005, i % 4 < 2 ? -.1 : .1, [0, 0, 0, 0], [1, 0, 0, 0]);
for (let i = 0; i < 8; i++) point(i % 2 ? .04 : -.04, .006, i % 4 < 2 ? .2 : .3, [1, 0, 0, 0], [1, 0, 0, 0]);
// The combined foot family dominates even though neither individual foot joint does.
for (let i = 0; i < 2; i++) point(i ? .04 : -.04, .006, .35, [0, 1, 2, 0], [.3, .3, .4, 0]);
point(1, .005, 1, [2, 0, 0, 0], [1, 0, 0, 0]); // Other foot must never enlarge this footprint.
point(0, .1, 2, [1, 0, 0, 0], [1, 0, 0, 0]); // High toe geometry is outside the low sole band.
// A real raised heel extends 8 mm behind the sole; preserve its 3D height, not a flat extension.
point(0, .072, -.108, [0, 0, 0, 0], [.6, .4, 0, 0]); // Sum duplicate ankle influences.
point(0, .073, -.12, [1, 0, 0, 0], [1, 0, 0, 0]); // Toe-owned: cannot assume rigid ankle motion.
point(0, .074, -.13, [0, 1, 0, 0], [.99, .01, 0, 0]); // Mixed ankle/toe is not ankle-rigid.
point(0, .075, -.14, [0, 2, 0, 0], [.9, .1, 0, 0]); // Nor is ankle/leg blend geometry.
function mesh(count = positions.length / 3) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions.slice(0, count*3), 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices.slice(0, count*4), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights.slice(0, count*4), 4));
  return {geometry, skeleton: {bones: [ankle, toe, other]}, matrixWorld: new THREE.Matrix4()};
}
const marker = new THREE.Vector3();
const result = measure([mesh()], ankle, marker);
assert.equal(result.soleVertices, 18, 'Include the low toe and mixed ankle/toe skin, exclude the other foot/high toe');
assert.ok(Math.abs(result.fp.toe-.35) < 1e-7, 'Distal toe support missing');
assert.ok(Math.abs(result.fp.heel-.1) < 1e-7);
assert.ok(Math.abs(result.fp.latMin+.04) < 1e-7 && Math.abs(result.fp.latMax-.04) < 1e-7);
assert.deepEqual(result.heelLocal?.map(p => p.toArray()), [[0, Math.fround(.072), Math.fround(-.108)]],
  'Measure only the rigid raised heel, retaining its actual height');
const originalAnkleOnly = measure([mesh(8)], ankle, marker);
assert.equal(originalAnkleOnly.soleVertices, 8);
assert.ok(Math.abs(originalAnkleOnly.fp.toe-.1) < 1e-7);
assert.deepEqual(originalAnkleOnly.heelLocal, []);
assert.equal(measure([mesh(7)], ankle, marker).soleVertices, 7, 'Small-mesh fallback remains available');
assert.deepEqual(measure([mesh(7)], ankle, marker).heelLocal, []);

const fp = result.fp;
const fpLocal = [[fp.latMin, -fp.heel], [fp.latMax, -fp.heel], [fp.latMin, fp.toe],
  [fp.latMax, fp.toe], [(fp.latMin+fp.latMax)/2, -fp.heel], [(fp.latMin+fp.latMax)/2, fp.toe]]
  .map(([x, z]) => new THREE.Vector3(x, 0, z));
const target = new THREE.Vector3(0, .01, 0), endpoint = new THREE.Vector3(0, .01, -.02);
const planeOnly = {fp, fpLocal, sole: marker, target, hipContactLocal: [...fpLocal, marker],
  qTilt: new THREE.Quaternion(), qAnkle: new THREE.Quaternion(), g: 0, hold: 0, soleP: target.clone(), delta: 0};
const contour = {...planeOnly, hipContactLocal: [...fpLocal, ...result.heelLocal, marker]};
// The endpoint's flat sole and its half-cell probes remain in front of this raised edge.
// The real heel at y=.082 crosses it and penetrates by 18 mm.
const step = (x, z) => z < -.126 ? .1 : 0;
assert(allows(planeOnly, step, endpoint), 'Fixture must expose the old sole-only omission');
assert(allows(contour, step, target), 'Retain the originally clear endpoint');
assert(!allows(contour, step, endpoint), 'Reject a final hip turn that puts the raised heel into a step');
assert(allows(contour, () => 0, endpoint), 'Unobstructed flat-ground endpoint stays valid');
const lowStep = (x, z) => z < -.126 ? .06 : 0;
assert(allows(contour, lowStep, endpoint), 'A step below the real raised heel is safe; never flatten it');
// A root drop bends the legs but keeps the world ankle target and foot orientation fixed.
const sole = new THREE.Vector3(0, -.06, .08);
const qAnkle = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -.12);
const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), .05);
const offsetY = sole.clone().applyQuaternion(qTilt.clone().multiply(qAnkle)).y;
const droppedTarget = new THREE.Vector3(0, .05-offsetY, 0);
const points = fpLocal.map(p => p.clone().add(sole));
const dropped = {...planeOnly, sole, qAnkle, qTilt, target: droppedTarget,
  fpLocal: points, hipContactLocal: [...points, sole], soleP: new THREE.Vector3(0, .03, 0), delta: .02};
assert.ok(Math.abs(slackAt(dropped)-.05) < 1e-12, 'No-drop slack retains the existing value');
dropped.soleP.y -= .04; // Same scratch translation as extraDrop; target and delta stay fixed.
assert.ok(Math.abs(slackAt(dropped)-.05) < 1e-12, 'Root drop must not consume fixed-target foot clearance');
const safeEndpoint = droppedTarget.clone().add(new THREE.Vector3(0, -.02, 0));
assert(.02 <= slackAt(dropped), 'Do not falsely reject a safe 20 mm ankle lowering after root drop');
assert(allows(dropped, () => 0, safeEndpoint), 'The safe lowering must also clear the footprint');
const penetratingEndpoint = droppedTarget.clone().add(new THREE.Vector3(0, -.06, 0));
assert(!allows(dropped, () => 0, penetratingEndpoint), 'Real penetration still fails the footprint guard');
console.log(JSON.stringify({pass: true, source: file, measured: result, ankleOnly: originalAnkleOnly,
  guard: {soleOnlyAllowsCollision: true, contourRejectsCollision: true, initialAndFlatAndLowStepClear: true}}));
