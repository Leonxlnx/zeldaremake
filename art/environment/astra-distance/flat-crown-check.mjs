/**
 * CPU only: node art/environment/astra-distance/flat-crown-check.mjs [baseline-ref]
 * Uses the real authored trees, seed, terrain and C/F cameras. No browser, render override or
 * added dependency. Writes geometry-only projection masks and counts to gauntlet/tmp/.
 * These masks exclude world occlusion, wind, shading, fog and antialiasing; native review is
 * still required. The default published baseline already has the accepted 26/30 m swap.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const baselineRef = process.argv[2] ?? 'a9eccd15';
const files = ['src/world/trees/giant.ts', 'src/world/trees/nearCanopy.ts'];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const oldSource = Object.fromEntries(files.map((file) => [path.resolve(file), execFileSync('git', ['show', `${baselineRef}:${file}`], { encoding: 'utf8' })]));
function loader(overrides = {}) {
  const modules = new Map();
  function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const source = ts.transpileModule(overrides[file] ?? readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', source)((name) => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target + '.ts', path.join(target, 'index.ts')]) if (existsSync(candidate)) return load(candidate);
      }
      throw new Error(`Unexpected dependency ${name}`);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const before = loader(oldSource);
const after = loader();
const { createRng } = after('src/world/util/prng.ts');
const { createTerrain } = after('src/world/terrain/heightfield.ts');
const { LAYOUT } = after('src/world/layout.ts');
const { WORLD } = after('src/world/config.ts');
const constants = {};
const ast = ts.createSourceFile('index.ts', readFileSync('src/world/trees/index.ts', 'utf8'), ts.ScriptTarget.Latest, true);
for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const decl of statement.declarationList.declarations) {
  const name = decl.name.getText(ast);
  if (!['GIANT_PROFILES', 'CANOPY_BOUGHS', 'HOUSE_BOUGHS', 'EYE_DETAIL'].includes(name)) continue;
  const source = ts.transpileModule(`module.exports = ${decl.initializer.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module', source)(module);
  constants[name] = module.exports;
}
const v = (a) => new THREE.Vector3(...a);
const terrain = createTerrain();
const rng = createRng(WORLD.seed).fork('trees');
const sun = WORLD.sun;
const az = sun.azimuthDeg * Math.PI / 180, el = sun.elevationDeg * Math.PI / 180;
const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
const cameraFor = (view, margin = 0, aspect = 1280 / 720) => {
  const camera = new THREE.PerspectiveCamera(view.fov + margin, aspect, 0.1, 400);
  camera.position.copy(v(view.position)); camera.lookAt(v(view.target)); camera.updateMatrixWorld();
  return camera;
};
const heroFrusta = LAYOUT.viewpoints.map((view) => {
  const camera = cameraFor(view, 4, 1.85);
  return { position: camera.position, frustum: new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)) };
});
const hashGeometry = (geometry) => {
  const hash = createHash('sha256');
  for (const a of [geometry.index, ...Object.values(geometry.attributes)]) hash.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength));
  return hash.digest('hex');
};
const bytes = (geometry) => geometry.index.array.byteLength + Object.values(geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, 0);
const run = (generator) => { let next = generator.next(), yields = 0; while (!next.done) { yields++; next = generator.next(); } return { geometry: next.value, yields }; };

// Rasterize both sides of the actual leaf triangles at pixel centres. At 640 x 360 this is
// deliberately stricter than counting a pixel touched by even one subpixel triangle.
const width = 640, height = 360;
function project(mask, geometry, origin, camera, keep) {
  const pos = geometry.getAttribute('position'), roots = geometry.getAttribute('aRoot'), uv = geometry.getAttribute('uv');
  const coords = new Float64Array(pos.count * 3), point = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    point.fromBufferAttribute(pos, i).add(origin).project(camera);
    coords[3 * i] = (point.x + 1) * width / 2;
    coords[3 * i + 1] = (1 - point.y) * height / 2;
    coords[3 * i + 2] = point.z;
  }
  const index = geometry.index.array;
  let triangles = 0;
  for (let i = 0; i < index.length; i += 3) {
    const ids = [index[i], index[i + 1], index[i + 2]];
    if (!ids.every((id) => keep(roots.getW(id), uv.getX(id), uv.getY(id)))) continue;
    triangles++;
    const [a, b, c] = ids.map((id) => id * 3);
    if (ids.some((id) => coords[id * 3 + 2] < -1 || coords[id * 3 + 2] > 1)) continue;
    const ax = coords[a], ay = coords[a + 1], bx = coords[b], by = coords[b + 1], cx = coords[c], cy = coords[c + 1];
    const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5)), x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
    const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5)), y1 = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const e0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
      const e1 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
      const e2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
      if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) mask[y * width + x] = 1;
    }
  }
  return triangles;
}
const projections = Object.fromEntries(['C_lookback', 'F_canopy'].map((id) => [id, {
  camera: cameraFor(LAYOUT.viewpoints.find((view) => view.id === id)),
  core: new Uint8Array(width * height), before: new Uint8Array(width * height), after: new Uint8Array(width * height), dark: new Uint8Array(width * height),
}]));
const report = {
  baselineRef,
  sourceSha256: Object.fromEntries(files.map((file) => [file, sha(readFileSync(file))])),
  method: 'CPU actual authored geometry at 640x360, both triangle sides, no world occlusion/wind/shading/fog/AA. Sun and view corridors omitted in builder; authored flat lobes are corridor-exempt. Baseline overrides only giant.ts and nearCanopy.ts from the published ref; all other inputs are identical.',
  ordinaryPartsByteEqual: 0, farGeometriesByteEqual: 0, parts: [], projections: {},
};
for (const id of ['stair-bank-giant', 'east-giant']) {
  const def = LAYOUT.giantTrees.find((d) => d.id === id), [x, , z] = def.position, y = terrain.height(x, z);
  const origin = new THREE.Vector3(x, y, z);
  const authored = constants.CANOPY_BOUGHS.filter((b) => b.giant === id);
  const targets = authored.flatMap((b) => b.lobes.filter((l) => l.flat));
  const canopyBoughs = authored.map((b) => ({ ...b, to: v(b.to).sub(origin), fromHeight: b.fromY - y, lobes: b.lobes.map((l) => ({ ...l, center: v(l.center).sub(origin), floor: l.floor === undefined ? undefined : l.floor - y })) }));
  const boughs = constants.HOUSE_BOUGHS.filter((b) => b.giant === id).map((b) => ({ ...b, to: v(b.to).sub(origin) }));
  const farFade = 1 - 0.45 * Math.min(1, Math.max(0, (Math.hypot(x, z) - 26) / 16));
  const options = {
    groundAt: (lx, lz) => terrain.height(x + lx, z + lz) - y,
    palette: WORLD.palette, towardPlaza: new THREE.Vector3(-x, 0, -z).normalize(), leafDensity: 1.1 * farFade, cardDensity: 1 + (1 - farFade),
    boughs, canopyBoughs, profile: constants.GIANT_PROFILES[id], sunDir, eyeDetail: constants.EYE_DETAIL[id] ?? 0,
    pathAt: (lx, lz) => terrain.mask(x + lx, z + lz).path,
    nearCanopy: { heroDistance: (center, radius) => {
      const sphere = new THREE.Sphere(center.clone().add(origin), radius + 1.5);
      let nearest = Infinity;
      for (const hero of heroFrusta) { const d = hero.position.distanceTo(sphere.center); if (d <= 30.5 && d < nearest && hero.frustum.intersectsSphere(sphere)) nearest = d; }
      return nearest;
    } },
  };
  const old = before('src/world/trees/giant.ts').createGiantTree(def, rng, options);
  const candidate = after('src/world/trees/giant.ts').createGiantTree(def, rng, options);
  assert.equal(candidate.nearCanopy.length, old.nearCanopy.length, `${id}: new draw/part`);
  for (const key of ['geometry', 'authoredLeaves', 'cards', 'authoredCards', 'nearBase']) if (old[key]) {
    assert.equal(hashGeometry(candidate[key]), hashGeometry(old[key]), `${id}: changed far ${key}`);
    report.farGeometriesByteEqual++;
  }
  const groups = new Set();
  for (const [i, part] of candidate.nearCanopy.entries()) {
    const previous = old.nearCanopy[i];
    const target = targets.find((t) => part.kind === 'lobe' && part.center.clone().add(origin).distanceTo(v(t.center)) < 0.001);
    assert.equal(part.inM, previous.inM); assert.equal(part.outM, previous.outM);
    if (!target) {
      assert.equal(hashGeometry(part.geometry), hashGeometry(previous.geometry), `${id}/${i}: ordinary geometry changed`);
      report.ordinaryPartsByteEqual++;
      continue;
    }
    groups.add(part.group);
    assert.equal(part.inM, 26); assert.equal(part.outM, 30); assert.equal(part.fixedSwap, true);
    assert.equal(part.woodTriangles, previous.woodTriangles, 'backing must only add leaves');
    // Existing outer geometry stays byte-identical, including normals; the backing is appended.
    for (const [name, a] of Object.entries(previous.geometry.attributes)) assert.deepEqual(part.geometry.getAttribute(name).array.slice(0, a.array.length), a.array, `${id}/${i}: existing ${name} changed`);
    assert.deepEqual(Array.from(part.geometry.index.array.slice(0, previous.geometry.index.count)), Array.from(previous.geometry.index.array));
    const rebuild = run(part.build());
    assert.equal(hashGeometry(rebuild.geometry), hashGeometry(part.geometry), `${id}/${i}: rebuild is not deterministic`);
    rebuild.geometry.dispose();
    assert.ok(rebuild.yields >= Math.floor((part.leaves - previous.leaves) / 12), 'inner build must yield between clusters');
    const positions = part.geometry.getAttribute('position'), roots = part.geometry.getAttribute('aRoot');
    for (const attr of Object.values(part.geometry.attributes)) assert.ok(attr.array.every(Number.isFinite), `${id}/${i}: non-finite geometry`);
    let minAddedY = Infinity;
    for (let j = previous.geometry.getAttribute('position').count; j < positions.count; j++) {
      assert.ok(Math.abs(roots.getW(j) - (1.5 + 0.5 * target.shade)) < 1e-5, 'authored flat shade lost');
      minAddedY = Math.min(minAddedY, positions.getY(j) + origin.y);
    }
    if (target.floor !== undefined) assert.ok(minAddedY >= target.floor, `${id}/${i}: backing enters walk clearance`);
    report.parts.push({ tree: id, group: part.group, center: target.center, beforeTriangles: previous.triangles, afterTriangles: part.triangles, addedTriangles: part.triangles - previous.triangles, addedLeaves: part.leaves - previous.leaves, beforeBytes: bytes(previous.geometry), afterBytes: bytes(part.geometry), addedBytes: bytes(part.geometry) - bytes(previous.geometry), minAddedY, floor: target.floor ?? null, yields: rebuild.yields, geometrySha256: hashGeometry(part.geometry) });
    if (id === 'stair-bank-giant') for (const p of Object.values(projections)) {
      project(p.before, previous.geometry, origin, p.camera, (root) => root >= 0.5);
      project(p.after, part.geometry, origin, p.camera, (root) => root >= 0.5);
      project(p.dark, part.geometry, origin, p.camera, (root) => root >= 1.25 && root < 2.75);
    }
  }
  assert.equal(groups.size, targets.length, `${id}: missed flat lobe`);
  if (id === 'stair-bank-giant') for (const p of Object.values(projections)) {
    assert.equal(project(p.core, old.authoredLeaves, origin, p.camera, (root, u, v) => groups.has(Math.floor(root - 1000)) && u === 0 && v === 0), 5 * 28 * 16 * 2);
  }
  for (const asset of [old, candidate]) {
    for (const part of asset.nearCanopy) part.geometry.dispose();
    for (const key of ['geometry', 'authoredLeaves', 'cards', 'authoredCards', 'nearBase']) asset[key]?.dispose();
  }
  console.log(`${id}: unchanged far/ordinary geometry; deterministic flat parts`);
}
const sum = (parts, key) => parts.reduce((total, part) => total + part[key], 0);
const bank = report.parts.filter((part) => part.tree === 'stair-bank-giant');
assert.equal(bank.length, 5);
assert.ok(sum(bank, 'addedTriangles') <= 160000, 'all-five bank total exceeds parent budget');
report.totals = Object.fromEntries([['bankFive', bank], ['allSeven', report.parts]].map(([name, parts]) => [name, { addedTriangles: sum(parts, 'addedTriangles'), addedLeaves: sum(parts, 'addedLeaves'), addedBytes: sum(parts, 'addedBytes'), afterTriangles: sum(parts, 'afterTriangles'), afterBytes: sum(parts, 'afterBytes'), addedDraws: 0, addedShadowTriangles: 0 }]));
const out = 'gauntlet/tmp/astra-flat-crown'; mkdirSync(out, { recursive: true });
for (const [id, p] of Object.entries(projections)) {
  const crop = id === 'C_lookback' ? [0, 0, 0.4, 0.45] : [0.45, 0, 1, 0.4];
  const counts = { core: 0, before: 0, after: 0, dark: 0 };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x / width < crop[0] || x / width >= crop[2] || y / height < crop[1] || y / height >= crop[3]) continue;
    const i = y * width + x;
    if (!p.core[i]) continue;
    counts.core++;
    for (const key of ['before', 'after', 'dark']) counts[key] += p[key][i];
  }
  const coverage = Object.fromEntries(['before', 'after', 'dark'].map((key) => [key, counts[key] / counts.core]));
  report.projections[id] = { crop, pixels: counts, coverageWithinOldCore: coverage };
  assert.ok(coverage.after > coverage.before + 0.3, `${id}: insufficient mass recovery`);
  assert.ok(coverage.dark > 0.8, `${id}: dark backing still too porous`);
  const panels = ['core', 'before', 'after', 'dark'].map((key, column) => {
    const spans = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (p[key][y * width + x]) {
      const start = x;
      while (x + 1 < width && p[key][y * width + x + 1]) x++;
      spans.push(`M${start} ${y}h${x - start + 1}v1H${start}z`);
    }
    return `<g transform="translate(${column * width} 24)"><text y="-7" fill="white">${id}: ${key} (CPU geometry only)</text><path fill="#345631" d="${spans.join('')}"/></g>`;
  });
  writeFileSync(`${out}/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 4}" height="${height + 24}" viewBox="0 0 ${width * 4} ${height + 24}"><rect width="100%" height="100%" fill="#c2cdcf"/><rect width="100%" height="24" fill="#222"/>${panels.join('')}</svg>`);
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ totals: report.totals, projections: report.projections, ordinaryPartsByteEqual: report.ordinaryPartsByteEqual, farGeometriesByteEqual: report.farGeometriesByteEqual }, null, 2));
