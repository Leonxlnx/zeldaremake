/** CPU only: node art/environment/astra-distance/root-profile-check.mjs [baseline-ref]
 * Builds all authored giants against the same terrain/seed. Only the collapsible far roots
 * may change; near bases, other wood/foliage, contacts and near-canopy parts must byte-match.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const baseline = process.argv[2] ?? '6f850599';
const files = ['src/world/trees/giant.ts', 'src/world/trees/bole.ts'];
const oldSource = Object.fromEntries(files.map((file) => [path.resolve(file), execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' })]));
const captured = [];
function loader(overrides = {}, capture = false) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const js = ts.transpileModule(overrides[file] ?? readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', js)((name) => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
      const target = path.resolve(path.dirname(file), name);
      for (const candidate of [target + '.ts', path.join(target, 'index.ts')]) if (existsSync(candidate)) return load(candidate);
      throw new Error(`Unexpected dependency ${name}`);
    }, module, module.exports);
    if (capture && file === path.resolve(files[1])) {
      const root = module.exports.buttressRoot;
      module.exports.buttressRoot = (writer, points, radii, options) => {
        const start = writer.positions.length;
        const result = root(writer, points, radii, options);
        captured.push({ coarse: !!options.coarse, positions: writer.positions.slice(start), result, groundAt: options.groundAt });
        return result;
      };
    }
    return module.exports;
  }
  return load;
}
const before = loader(oldSource), after = loader({}, true);
const { createRng } = after('src/world/util/prng.ts'), { createTerrain } = after('src/world/terrain/heightfield.ts');
const { LAYOUT } = after('src/world/layout.ts'), { WORLD } = after('src/world/config.ts');
const constants = {};
const ast = ts.createSourceFile('index.ts', readFileSync('src/world/trees/index.ts', 'utf8'), ts.ScriptTarget.Latest, true);
for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) {
  const name = d.name.getText(ast);
  if (!['GIANT_PROFILES', 'CANOPY_BOUGHS', 'HOUSE_BOUGHS', 'EYE_DETAIL'].includes(name)) continue;
  const module = { exports: {} };
  new Function('module', ts.transpileModule('module.exports = ' + d.initializer.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(module);
  constants[name] = module.exports;
}
const vector = (a) => new THREE.Vector3(...a);
const terrain = createTerrain(), rng = createRng(WORLD.seed).fork('trees');
const az = WORLD.sun.azimuthDeg * Math.PI / 180, el = WORLD.sun.elevationDeg * Math.PI / 180;
const sunDir = new THREE.Vector3(Math.sin(az)*Math.cos(el), Math.sin(el), Math.cos(az)*Math.cos(el));
const bytes = (g) => g.index.array.byteLength + Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0);
function fingerprint(g, omitRoots = false) {
  const hash = createHash('sha256'), root = g.getAttribute('aRoot');
  const ids = Array.from({ length: root.count }, (_, i) => i).filter((i) => !omitRoots || root.getW(i) !== -2);
  const remap = new Int32Array(root.count).fill(-1); ids.forEach((id, i) => { remap[id] = i; });
  for (const [name, a] of Object.entries(g.attributes)) {
    hash.update(name);
    const packed = new Float32Array(ids.length * a.itemSize);
    ids.forEach((id, i) => { for (let k=0;k<a.itemSize;k++) packed[i*a.itemSize+k] = a.array[id*a.itemSize+k]; });
    hash.update(Buffer.from(packed.buffer));
  }
  const indices = [];
  for (let i=0;i<g.index.count;i+=3) {
    const tri = Array.from(g.index.array.slice(i,i+3), (id) => remap[id]);
    if (tri.every((id) => id >= 0)) indices.push(...tri);
    else assert.ok(tri.every((id) => id === -1), 'root/non-root triangle crosses the replacement boundary');
  }
  hash.update(Buffer.from(new Uint32Array(indices).buffer));
  return hash.digest('hex');
}
const rootTriangles = (g) => {
  const a = g.attributes.aRoot; let n=0;
  for(let i=0;i<g.index.count;i+=3) if(a.getW(g.index.array[i]) === -2) n++;
  return n;
};
const rows = []; let sameGeometries=0, sameNearParts=0, commonFinVertices=0, toeContacts=0;
for (const def of LAYOUT.giantTrees) {
  const [x,,z] = def.position, y = terrain.height(x,z), origin = vector([x,y,z]);
  const farFade = 1 - .45*Math.min(1,Math.max(0,(Math.hypot(x,z)-26)/16));
  const options = {
    groundAt: (lx,lz) => terrain.height(x+lx,z+lz)-y, pathAt: (lx,lz) => terrain.mask(x+lx,z+lz).path,
    palette: WORLD.palette, towardPlaza: vector([-x,0,-z]).normalize(), profile: constants.GIANT_PROFILES[def.id], sunDir,
    leafDensity: 1.1*farFade, cardDensity: 1+(1-farFade), eyeDetail: constants.EYE_DETAIL[def.id] ?? 0,
    boughs: constants.HOUSE_BOUGHS.filter((b) => b.giant === def.id).map((b) => ({ ...b, to: vector(b.to).sub(origin) })),
    canopyBoughs: constants.CANOPY_BOUGHS.filter((b) => b.giant === def.id).map((b) => ({ ...b, to: vector(b.to).sub(origin), fromHeight: b.fromY-y,
      lobes: b.lobes.map((l) => ({ ...l, center: vector(l.center).sub(origin), floor: l.floor === undefined ? undefined : l.floor-y })) })),
    nearCanopy: { heroDistance: () => Infinity },
  };
  const old = before(files[0]).createGiantTree(def, rng, options);
  captured.length = 0;
  const current = after(files[0]).createGiantTree(def, rng, options);
  const rootFlags = current.geometry.attributes.aRoot;
  for (let i=0;i<rootFlags.count;i++) if (rootFlags.getW(i) === -2) {
    for (const a of Object.values(current.geometry.attributes)) for(let k=0;k<a.itemSize;k++) assert.ok(Number.isFinite(a.array[i*a.itemSize+k]), 'non-finite far-root attribute');
    const p = new THREE.Vector3().fromBufferAttribute(current.geometry.attributes.position,i);
    const n = new THREE.Vector3().fromBufferAttribute(current.geometry.attributes.normal,i);
    if (p.y > options.groundAt(p.x,p.z)+0.025) assert.ok(n.lengthSq()>1e-12, 'exposed far-root vertex has no normal');
  }
  assert.equal(fingerprint(current.geometry, true), fingerprint(old.geometry, true), `${def.id}: non-root wood/foliage changed`);
  for (const key of ['nearBase','cards','authoredCards','authoredLeaves']) {
    assert.equal(fingerprint(current[key]), fingerprint(old[key]), `${def.id}: ${key} changed`); sameGeometries++;
  }
  for (const key of ['trunkPath','trunkRadii','boleRings','contacts','roots','leafCount','cardCount','nearBaseAudit']) assert.deepEqual(current[key], old[key], `${def.id}: ${key} changed`);
  assert.equal(current.nearCanopy.length, old.nearCanopy.length);
  current.nearCanopy.forEach((part,i) => { assert.equal(fingerprint(part.geometry), fingerprint(old.nearCanopy[i].geometry), `${def.id}: near canopy ${i} changed`); sameNearParts++; });
  const coarse = captured.filter((r) => r.coarse), near = captured.filter((r) => !r.coarse);
  assert.equal(coarse.length, current.roots); assert.equal(near.length, current.roots);
  coarse.forEach((root,i) => {
    assert.equal(root.result.cushions, 0, 'far root added near cushions');
    assert.deepEqual(root.result.toeTips, near[i].result.toeTips, 'toe endpoints differ between LODs');
    for(const tip of root.result.toeTips) { assert.equal(tip.y, root.groundAt(tip.x,tip.z)); toeContacts++; }
    assert.ok(root.positions.every(Number.isFinite));
    // 7/14 longitudinal intervals and 12/30 sides share every second coarse angular sample.
    // Every such fin vertex must be identical, including terrain/paving projection.
    for(let k=0;k<=7;k++) for(let j=0;j<=12;j+=2) {
      const a=(k*13+j)*3, b=(k*2*31+j*2.5)*3;
      assert.deepEqual(root.positions.slice(a,a+3), near[i].positions.slice(b,b+3), 'shared fin sample moved'); commonFinVertices++;
    }
  });
  if (def.id === 'lantern-tree') {
    const generator = current.nearBaseBuild(); let step, yields=0;
    do { step=generator.next(); if(!step.done)yields++; } while(!step.done);
    assert.equal(fingerprint(step.value), fingerprint(current.nearBase), 'near-base pool rebuild differs');
    assert.ok(yields > current.roots, 'cooperative build yields lost'); step.value.dispose();
  }
  const oldRootTris=rootTriangles(old.geometry), newRootTris=rootTriangles(current.geometry);
  const triangleDelta=current.geometry.index.count/3-old.geometry.index.count/3;
  assert.equal(triangleDelta,newRootTris-oldRootTris,'non-root triangles changed');
  rows.push({ id:def.id, roots:current.roots, oldRootTris, newRootTris, triangleDelta, byteDelta:bytes(current.geometry)-bytes(old.geometry) });
  for(const asset of [old,current]) { for(const part of asset.nearCanopy)part.geometry.dispose(); for(const key of ['geometry','nearBase','cards','authoredCards','authoredLeaves'])asset[key].dispose(); }
  console.log(`${def.id}: only far roots changed (+${triangleDelta} triangles)`);
}
const total=(key)=>rows.reduce((n,row)=>n+row[key],0);
assert.equal(total('roots'),86); assert.equal(total('triangleDelta'),4844); assert.equal(total('newRootTris'),24624);
console.log(JSON.stringify({baseline,rows,totals:{roots:total('roots'),addedTriangles:total('triangleDelta'),addedBytes:total('byteDelta'),addedDraws:0},
  sameGeometries,sameNearParts,commonFinVertices,toeContacts,nativeBoundaryReviewRequired:true},null,2));
