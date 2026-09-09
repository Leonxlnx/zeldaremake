/** Read-only, one-plant CPU diagnostic; no browser/world build. */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const source = readFileSync(new URL('../../src/world/vegetation/lodset.ts', import.meta.url), 'utf8');
const module = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)((id) => { if (id === 'three') return THREE; throw Error(id); }, module, module.exports);
const { LodInstancedSet } = module.exports;
function make() {
  const set = new LodInstancedSet({ name: 'review', variants: [[new THREE.BoxGeometry(), new THREE.PlaneGeometry()]], material: new THREE.MeshStandardMaterial(), lodDistances: [11] });
  set.add(Float32Array.from(new THREE.Matrix4().elements), 0, [1, 1, 1]);
  set.build();
  return set;
}
const a = make(), b = make();
a.update(new THREE.Vector3(10.8, 0, 0));
a.update(new THREE.Vector3(11.2, 0, 0));
b.update(new THREE.Vector3(11.2, 0, 0));
const counts = set => set.group.children.map(mesh => mesh.count);
console.log(JSON.stringify({ finalCamera: [11.2, 0, 0], via108: counts(a), direct112: counts(b), note: 'Identical final camera, different geometry LOD. Not a pixel-based W41 result.' }, null, 2));
for (const set of [a, b]) for (const mesh of set.group.children) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); }
