import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as T from 'three';
import * as U from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const dir = path.dirname(fileURLToPath(import.meta.url)), base = execFileSync('git', ['rev-parse', '0f9426c'], { encoding: 'utf8' }).trim(), candidate = execFileSync('git', ['rev-parse', '6128726'], { encoding: 'utf8' }).trim();
const hash = a => createHash('sha256').update(typeof a === 'string' ? a : Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
function loader(ref, capture) { const cache = new Map(); function load(f) { f = path.posix.normalize(f); if (cache.has(f))
    return cache.get(f).exports; const m = { exports: {} }; cache.set(f, m); let s = execFileSync('git', ['show', ref + ':' + f], { encoding: 'utf8' }); if (f === 'src/world/materials/sprouts.ts')
    s = s.replace('        im.setMatrixAt(i, m.compose(p, q, sc));', '        (globalThis as any).__reviewSpot?.(im, i, s);\n        im.setMatrixAt(i, m.compose(p, q, sc));'); new Function('require', 'module', 'exports', ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(id => id === 'three' ? T : id.endsWith('BufferGeometryUtils.js') ? U : load(path.posix.join(path.posix.dirname(f), id + '.ts')), m, m.exports); if (f === 'src/world/materials/sprouts.ts') {
    const original = m.exports.buildSproutMeshes;
    m.exports.buildSproutMeshes = (...args) => { capture.spots = args[0].map(s => ({ ...s })); return capture.sprouts = original(...args); };
} if (f === 'src/world/hardscape/flagstones.ts') {
    const original = m.exports.placeFlagstones;
    m.exports.placeFlagstones = (...args) => capture.paving = original(...args);
} if (f === 'src/world/hardscape/flowers.ts') {
    const original = m.exports.buildFlowerHeads;
    m.exports.buildFlowerHeads = (...args) => { capture.heads = args[0].map(s => ({ ...s })); return capture.flowers = original(...args); };
} return m.exports; } return n => load('src/world/' + n + '.ts'); }
async function build(ref) { const capture = { instances: [] }, read = loader(ref, capture), { WORLD } = read('config'), { LAYOUT } = read('layout'), tex = new Map(), audits = {}, ctx = { config: WORLD, layout: LAYOUT, rng: read('util/prng').createRng(WORLD.seed), terrain: read('terrain/heightfield').createTerrain(), quality: { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1 }, renderer: { capabilities: { getMaxAnisotropy: () => 8 } }, wind: read('wind/wind').createWind(), textures: { load: async (set, kind) => { const key = set + '/' + kind; if (!tex.has(key)) {
            const t = new T.DataTexture(new Uint8Array([127, 127, 255, 255]), 1, 1);
            t.name = key;
            tex.set(key, t);
        } return tex.get(key); } }, progress() { }, audit(n, fn) { audits[n] = fn; } }; globalThis.__reviewSpot = (mesh, i, s) => capture.instances.push({ mesh, i, spot: { ...s } }); const system = await read('hardscape/index').create(ctx); system.group.updateMatrixWorld(true); for (const a of capture.instances) {
    const m = new T.Matrix4(), c = new T.Color();
    a.mesh.getMatrixAt(a.i, m);
    a.mesh.getColorAt(a.i, c);
    a.matrix = m.toArray();
    a.color = c.toArray();
    a.variant = a.mesh.name + '/' + a.mesh.geometry.attributes.aSproutVariant.getX(a.i);
} return { ref, read, ctx, capture, system, audit: audits.hardscape() }; }
const before = await build(base), after = await build(candidate), zone = after.read('hardscape/zones'), key = s => [s.x, s.y, s.z, s.kind ?? 'tuft'].join('/'), oldMap = new Map(before.capture.instances.map(a => [key(a.spot), a]));
const oldOutside = { n: 0, missing: 0, spotChanged: 0, matrixChanged: 0, colorChanged: 0, variantChanged: 0, byKind: {}, examples: [] };
const added = [], oldInside = { n: 0, sizeChanged: 0 };
for (const a of after.capture.instances) {
    const old = oldMap.get(key(a.spot));
    if (!old) {
        added.push(a);
        continue;
    }
    if (zone.lawnPocket(old.spot.x, old.spot.z) > 0) {
        oldInside.n++;
        if (a.spot.size !== old.spot.size)
            oldInside.sizeChanged++;
        continue;
    }
    oldOutside.n++;
    const k = old.spot.kind ?? 'tuft', stats = oldOutside.byKind[k] ??= { n: 0, matrixChanged: 0, colorChanged: 0, spotChanged: 0 };
    stats.n++;
    const sm = JSON.stringify(a.spot) !== JSON.stringify(old.spot), mm = JSON.stringify(a.matrix) !== JSON.stringify(old.matrix), cm = JSON.stringify(a.color) !== JSON.stringify(old.color), vm = a.variant !== old.variant;
    if (sm) {
        oldOutside.spotChanged++;
        stats.spotChanged++;
    }
    if (mm) {
        oldOutside.matrixChanged++;
        stats.matrixChanged++;
    }
    if (cm) {
        oldOutside.colorChanged++;
        stats.colorChanged++;
    }
    if (vm)
        oldOutside.variantChanged++;
    if ((sm || mm || cm) && oldOutside.examples.length < 4)
        oldOutside.examples.push({ position: [a.spot.x, a.spot.y, a.spot.z], kind: k, spotChanged: sm, matrixChanged: mm, colorChanged: cm, oldColor: old.color, newColor: a.color });
}
const newKeys = new Set(after.capture.instances.map(a => key(a.spot)));
oldOutside.missing = before.capture.instances.filter(a => zone.lawnPocket(a.spot.x, a.spot.z) === 0 && !newKeys.has(key(a.spot))).length;
const arrayHash = g => Object.fromEntries([...Object.entries(g.attributes), ...(g.index ? [['index', g.index]] : [])].map(([k, a]) => [k, hash(a.array)]));
const invariants = {};
for (const a of before.system.group.children.filter(m => m.isMesh && !m.isInstancedMesh)) {
    const b = after.system.group.getObjectByName(a.name), ha = arrayHash(a.geometry), hb = arrayHash(b.geometry);
    invariants[a.name] = Object.fromEntries(Object.keys(ha).map(k => [k, ha[k] === hb[k]]));
}
const j0 = before.system.group.getObjectByName('flagstone-joints') ?? before.system.group.children.find(m => m.material?.name === 'flagstone-joints'), j1 = after.system.group.children.find(m => m.material?.name === 'flagstone-joints');
let changedFillOutside = 0, changedFillInside = 0;
for (let i = 0; i < j0.geometry.attributes.position.count; i++) {
    const p = j0.geometry.attributes.position, a = j0.geometry.attributes.color, b = j1.geometry.attributes.color;
    if (a.getX(i) !== b.getX(i) || a.getY(i) !== b.getY(i) || a.getZ(i) !== b.getZ(i)) {
        if (zone.lawnPocket(p.getX(i), p.getZ(i)) === 0)
            changedFillOutside++;
        else
            changedFillInside++;
    }
}
const geoStats = g => { let meshes = 0, tris = 0, casting = 0, finite = true; g.traverse(o => { if (!o.isMesh)
    return; meshes++; const n = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); tris += n; if (o.castShadow)
    casting += n; for (const a of Object.values(o.geometry.attributes))
    for (const v of a.array)
        if (!Number.isFinite(v))
            finite = false; }); return { meshes, submittedTriangles: tris, castingTriangles: casting, finite }; };
const flower = after.capture.flowers.mesh, fg = flower.geometry, headCount = after.capture.heads.length, pointsPer = fg.attributes.position.count / headCount;
let flowerContactMin = Infinity, flowerContactMax = -Infinity, minHeadSpacing = Infinity, maxHeadNormalErrorDeg = 0, stemNormalErrorMin = 180, stemNormalErrorMax = 0;
const fp = fg.attributes.position, fn = fg.attributes.normal;
for (let h = 0; h < headCount; h++) {
    const start = h * pointsPer, end = start + pointsPer;
    for (const i of [end - 6, end - 5]) {
        const gap = fp.getY(i) - after.ctx.terrain.height(fp.getX(i), fp.getZ(i));
        flowerContactMin = Math.min(flowerContactMin, gap);
        flowerContactMax = Math.max(flowerContactMax, gap);
    }
    for (let q = h + 1; q < headCount; q++) {
        const a = after.capture.heads[h], b = after.capture.heads[q];
        minHeadSpacing = Math.min(minHeadSpacing, Math.hypot(a.x - b.x, a.z - b.z));
    }
    for (let i = start; i < end - 6; i++) {
        const supplied = new T.Vector3().fromBufferAttribute(fn, i).normalize(), correct = new T.Vector3(supplied.x, supplied.y / .72, supplied.z).normalize();
        maxHeadNormalErrorDeg = Math.max(maxHeadNormalErrorDeg, supplied.angleTo(correct) * 180 / Math.PI);
    }
    const a = new T.Vector3().fromBufferAttribute(fp, end - 6), b = new T.Vector3().fromBufferAttribute(fp, end - 5), c = new T.Vector3().fromBufferAttribute(fp, end - 4), actual = b.sub(a).cross(c.sub(a)).normalize(), supplied = new T.Vector3().fromBufferAttribute(fn, end - 6).normalize(), error = actual.angleTo(supplied) * 180 / Math.PI;
    stemNormalErrorMin = Math.min(stemNormalErrorMin, error);
    stemNormalErrorMax = Math.max(stemNormalErrorMax, error);
}
const flowerProjection = [];
for (const id of ['B_house', 'E_ground']) {
    const vp = after.ctx.layout.viewpoints.find(v => v.id === id), cam = new T.PerspectiveCamera(vp.fov, 1280 / 720, .1, 300);
    cam.position.fromArray(vp.position);
    cam.lookAt(new T.Vector3().fromArray(vp.target));
    cam.updateMatrixWorld(true);
    const widths = [], heights = [];
    for (let h = 0; h < headCount; h++) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let i = h * pointsPer; i < (h + 1) * pointsPer - 6; i++) {
            const p = new T.Vector3().fromBufferAttribute(fp, i).project(cam);
            x0 = Math.min(x0, p.x);
            x1 = Math.max(x1, p.x);
            y0 = Math.min(y0, p.y);
            y1 = Math.max(y1, p.y);
        }
        widths.push((x1 - x0) * 640);
        heights.push((y1 - y0) * 360);
    }
    flowerProjection.push({ camera: id, widthPixels: [Math.min(...widths), Math.max(...widths)], heightPixels: [Math.min(...heights), Math.max(...heights)] });
}
const disposalEvents = { geometry: 0, material: 0 };
flower.geometry.addEventListener('dispose', () => disposalEvents.geometry++);
flower.material.addEventListener('dispose', () => disposalEvents.material++);
after.system.dispose?.();
assert.deepEqual(disposalEvents, { geometry: 0, material: 0 });
const pre = geoStats(before.system.group), post = geoStats(after.system.group), addedContact = { min: Infinity, max: -Infinity };
for (const a of added) {
    const gap = a.matrix[13] - after.ctx.terrain.height(a.spot.x, a.spot.z);
    addedContact.min = Math.min(addedContact.min, gap);
    addedContact.max = Math.max(addedContact.max, gap);
}
const unaffectedAudit = {};
for (const [k, v] of Object.entries(before.audit)) {
    if (/^(stair|totalSteps|tread|uniqueStep|flagstone|stepping|jointFill(?!Vertices)|jointGap|jointSoil|plaza|samplePositions|maxBottom)/.test(k))
        unaffectedAudit[k] = JSON.stringify(v) === JSON.stringify(after.audit[k]);
}
const result = { base, candidate, scope: 'Pinned source CPU geometry, RNG and scene resource review; no GPU verdict', sources: Object.fromEntries(['src/world/hardscape/index.ts', 'src/world/hardscape/joints.ts', 'src/world/hardscape/flowers.ts'].map(f => [f, hash(execFileSync('git', ['show', candidate + ':' + f]))])), before: pre, after: post, delta: { meshes: post.meshes - pre.meshes, submittedTriangles: post.submittedTriangles - pre.submittedTriangles, castingTriangles: post.castingTriangles - pre.castingTriangles }, protectedGeometry: invariants, protectedAudit: unaffectedAudit, fillColor: { changedInside: changedFillInside, changedOutside: changedFillOutside }, oldOutside, oldInside, newSpots: added.length, newContactOffsets: addedContact, flower: { count: headCount, triangles: after.capture.flowers.triangles, vertexBytes: Object.values(fg.attributes).reduce((n, a) => n + a.array.byteLength, 0), contactRange: [flowerContactMin, flowerContactMax], minSpacing: minHeadSpacing, maxHeadNormalErrorDeg, stemNormalErrorRange: [stemNormalErrorMin, stemNormalErrorMax], castShadow: flower.castShadow, receiveShadow: flower.receiveShadow, side: flower.material.side, hasWindAttribute: !!fg.attributes.aWind, hasSystemDispose: typeof after.system.dispose === 'function', disposalEventsAfterSystemDispose: disposalEvents, projectedHeadFootprints: flowerProjection }, auditLawn: after.audit.lawnPocket, sprouts: { before: { count: before.capture.sprouts.count, grit: before.capture.sprouts.grit, submitted: before.capture.sprouts.submittedTriangles }, after: { count: after.capture.sprouts.count, grit: after.capture.sprouts.grit, submitted: after.capture.sprouts.submittedTriangles } } };
assert.equal(post.finite, true);
assert.equal(changedFillOutside, 0);
assert.equal(oldOutside.spotChanged, 0);
assert.equal(oldOutside.missing, 0);
fs.writeFileSync(dir + '/evidence.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
