// Raw source regression; optionally pass an explicit local candidate TS file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const file = process.argv[2] ?? 'src/world/character/glbLink.ts';
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const fn = tree.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'measureFootprint');
assert.equal(fn.length, 1);
const constants = tree.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d =>
  ['SOLE_BAND', 'FALLBACK_FOOTPRINT'].includes(d.name.getText(tree))));
assert.equal(constants.length, 2);
const js = ts.transpileModule([...constants, ...fn].map(n => n.getText(tree)).join('\n'), {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}
}).outputText;
const measure = new Function('Vector3', js + '\nreturn measureFootprint;')(THREE.Vector3);
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
const originalAnkleOnly = measure([mesh(8)], ankle, marker);
assert.equal(originalAnkleOnly.soleVertices, 8);
assert.ok(Math.abs(originalAnkleOnly.fp.toe-.1) < 1e-7);
assert.equal(measure([mesh(7)], ankle, marker).soleVertices, 7, 'Small-mesh fallback remains available');
console.log(JSON.stringify({pass: true, source: file, measured: result, ankleOnly: originalAnkleOnly}));
