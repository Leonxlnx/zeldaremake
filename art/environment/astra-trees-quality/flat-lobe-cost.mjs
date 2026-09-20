import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createHash } from 'node:crypto';
const mode = process.argv[2] ?? 'wide';
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  let code = readFileSync(file, 'utf8');
  if (file.endsWith('nearCanopy.ts')) code = code.replace(/NEAR_CANOPY_FLAT_SWAP_M: \[number, number\] \| null = [^;]+/, `NEAR_CANOPY_FLAT_SWAP_M: [number, number] | null = ${mode === 'wide' ? '[26, 30]' : 'null'}`);
  const source = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === 'three') return THREE;
    if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
    if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), name); for (const f of [target, target + '.ts', path.join(target, 'index.ts')]) if (f.endsWith('.ts') && existsSync(f)) return loadTs(f); }
    throw new Error(`Unexpected dependency ${name}`);
  }, module, module.exports);
  return module.exports;
}
// Read the authored definitions, without executing the renderer/system create path.
const indexCode = readFileSync('src/world/trees/index.ts', 'utf8');
const ast = ts.createSourceFile('index.ts', indexCode, ts.ScriptTarget.Latest, true);
const constants = {};
for (const s of ast.statements) if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) {
  const name = d.name.getText(ast);
  if (['GIANT_PROFILES', 'CANOPY_BOUGHS', 'HOUSE_BOUGHS', 'EYE_DETAIL'].includes(name)) {
    const js = ts.transpileModule(`module.exports = ${d.initializer.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const m = { exports: {} }; new Function('module', js)(m); constants[name] = m.exports;
  }
}
const { createGiantTree } = loadTs('src/world/trees/giant.ts');
const { createRng } = loadTs('src/world/util/prng.ts');
const { createTerrain } = loadTs('src/world/terrain/heightfield.ts');
const { LAYOUT } = loadTs('src/world/layout.ts');
const { WORLD } = loadTs('src/world/config.ts');
const terrain = createTerrain();
const rng = createRng(WORLD.seed).fork('trees');
const v = (a) => new THREE.Vector3(...a);
const heroFrusta = LAYOUT.viewpoints.map((view) => {
  const cam = new THREE.PerspectiveCamera(view.fov + 4, 1.85, 0.1, 400); cam.position.copy(v(view.position)); cam.lookAt(v(view.target)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return { position: cam.position.clone(), frustum: new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)) };
});
const sun = WORLD.sun; const az = sun.azimuthDeg * Math.PI / 180, el = sun.elevationDeg * Math.PI / 180;
const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
const output = { mode, method: 'Actual giant builder, WORLD seed, authored profiles/boughs, terrain and hero frusta. Sun/view corridors omitted: flat authored lobes exempt. Submitted added cost is an upper bound before frustum/slot selection; collapsed far geometry remains submitted.', parts: [] };
const hashGeometry = (geo) => { const hash = createHash('sha256'); for (const a of [geo.index, ...Object.values(geo.attributes)]) hash.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength)); return hash.digest('hex'); };
for (const id of ['stair-bank-giant', 'east-giant']) {
  const def = LAYOUT.giantTrees.find((d) => d.id === id); const [x, , z] = def.position, y = terrain.height(x, z); const origin = new THREE.Vector3(x, y, z);
  const farFade = 1 - 0.45 * Math.min(1, Math.max(0, (Math.hypot(x, z) - 26) / 16));
  const authored = constants.CANOPY_BOUGHS.filter((b) => b.giant === id);
  const canopyBoughs = authored.map((b) => ({ ...b, to: v(b.to).sub(origin), fromHeight: b.fromY - y, lobes: b.lobes.map((l) => ({ ...l, center: v(l.center).sub(origin), floor: l.floor === undefined ? undefined : l.floor - y })) }));
  const boughs = constants.HOUSE_BOUGHS.filter((b) => b.giant === id).map((b) => ({ ...b, to: v(b.to).sub(origin) }));
  const start = performance.now();
  const asset = createGiantTree(def, rng, { groundAt: (lx, lz) => terrain.height(x + lx, z + lz) - y, palette: WORLD.palette, towardPlaza: new THREE.Vector3(-x, 0, -z).normalize(), leafDensity: 1.1 * farFade, cardDensity: 1 + (1 - farFade), boughs, canopyBoughs, profile: constants.GIANT_PROFILES[id], sunDir, eyeDetail: constants.EYE_DETAIL[id] ?? 0, pathAt: (lx, lz) => terrain.mask(x + lx, z + lz).path, nearCanopy: { heroDistance: (center, radius) => {
    const sphere = new THREE.Sphere(center.clone().add(origin), radius + 1.5); let nearest = Infinity;
    for (const h of heroFrusta) { const d = h.position.distanceTo(sphere.center); if (d <= 30.5 && d < nearest && h.frustum.intersectsSphere(sphere)) nearest = d; } return nearest;
  } } });
  const targets = authored.flatMap((b) => b.lobes.filter((l) => l.flat));
  for (const part of asset.nearCanopy) {
    const center = part.center.clone().add(origin);
    if (part.kind !== 'lobe' || !targets.some((t) => center.distanceTo(v(t.center)) < 0.001)) continue;
    const bytes = part.geometry.index.array.byteLength + Object.values(part.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0);
    output.parts.push({ tree: id, center: center.toArray(), group: part.group, fixedSwap: !!part.fixedSwap, inM: part.inM, outM: part.outM, triangles: part.triangles, leaves: part.leaves, bytes, geometrySha256: hashGeometry(part.geometry), distances: Object.fromEntries(LAYOUT.viewpoints.map((view) => [view.id, +center.distanceTo(v(view.position)).toFixed(3)])) });
  }
  console.error(`${id} ${mode}: ${Math.round(performance.now() - start)} ms; ${asset.nearCanopy.length} near parts`);
  for (const p of asset.nearCanopy) p.geometry.dispose();
  for (const key of ['geometry', 'authoredLeaves', 'cards', 'authoredCards', 'nearBase']) asset[key]?.dispose();
}
output.total = { triangles: output.parts.reduce((s, p) => s + p.triangles, 0), bytes: output.parts.reduce((s, p) => s + p.bytes, 0), leaves: output.parts.reduce((s, p) => s + p.leaves, 0), calls: output.parts.length };
output.heroUpperBounds = Object.fromEntries(LAYOUT.viewpoints.map((view) => { const selected = output.parts.filter((p) => p.distances[view.id] < p.inM); return [view.id, { calls: selected.length, triangles: selected.reduce((s,p) => s+p.triangles, 0), bytes: selected.reduce((s,p) => s+p.bytes, 0) }]; }));
writeFileSync(`gauntlet/tmp/astra-flat-cost-${mode}.json`, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
