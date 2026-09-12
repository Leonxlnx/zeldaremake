import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as T from 'three';
const here = path.dirname(fileURLToPath(import.meta.url));
const sha = '141082bae8a2b0064ec826e3908aececdc5b9e44';
const baselineSource = execFileSync('git', ['show', sha + ':src/world/hardscape/joints.ts'], { encoding: 'utf8' });
const patch = fs.readFileSync(path.join(here, 'mask-only-joints.patch'), 'utf8');
// Apply the exact unified diff in memory. No worktree, index or source file is changed.
function applyPatch(original, patch) { const lines = original.split('\n'); const changes = patch.split('\n'); const out = []; let cursor = 0, hunk = false; for (const line of changes) {
    const header = line.match(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/);
    if (header) {
        const start = Number(header[1]) - 1;
        if (start < cursor)
            throw new Error('Overlapping patch hunks');
        out.push(...lines.slice(cursor, start));
        cursor = start;
        hunk = true;
        continue;
    }
    if (!hunk)
        continue;
    if (!line)
        continue;
    const kind = line[0], text = line.slice(1);
    if (kind === ' ' || kind === '-') {
        if (lines[cursor] !== text)
            throw new Error('Patch context mismatch at line ' + (cursor + 1));
        cursor++;
    }
    if (kind === ' ' || kind === '+')
        out.push(text);
} out.push(...lines.slice(cursor)); return out.join('\n'); }
const candidateSource = applyPatch(baselineSource, patch);
const digest = s => createHash('sha256').update(s).digest('hex');
const expectedHashes = { 'baseline-joints.ts': '1ceef0c1606547dde859d1cb85d436678eb4ce8d6240af25716a4541cde35df4', 'mask-only-joints.ts': '6cc3bac71e60a71086ca05c07e31848cf0e1b10deba32ce0acc46c24a9ea4beb', 'mask-only-joints.patch': '05def77fce660236aeb47f93e44b4f1093b69cc35998f559f5448f049e4363c5' };
for (const [name, content] of Object.entries({ 'baseline-joints.ts': baselineSource, 'mask-only-joints.ts': candidateSource, 'mask-only-joints.patch': patch }))
    if (digest(content) !== expectedHashes[name])
        throw new Error('Unexpected ' + name + ' hash');
const sourceFiles = new Map();
function loader(candidate = false) { const cache = new Map(); function load(f) { f = path.posix.normalize(f); if (cache.has(f))
    return cache.get(f).exports; const m = { exports: {} }; cache.set(f, m); let s = sourceFiles.get(f); if (s === undefined) {
    s = execFileSync('git', ['show', sha + ':' + f], { encoding: 'utf8' });
    sourceFiles.set(f, s);
} if (candidate && f === 'src/world/hardscape/joints.ts')
    s = candidateSource; new Function('require', 'module', 'exports', ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(id => id === 'three' ? T : load(path.posix.join(path.posix.dirname(f), id + '.ts')), m, m.exports); return m.exports; } return n => load('src/world/' + n + '.ts'); }
const read = loader(), { WORLD } = read('config'), { LAYOUT, houseSteppingStones } = read('layout');
const terrain = read('terrain/heightfield').createTerrain();
const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
const bbox = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
for (const p of [...LAYOUT.pathSpine, ...LAYOUT.pathToStairs, ...LAYOUT.pathToHouse]) {
    bbox.x0 = Math.min(bbox.x0, p[0] - 3.2);
    bbox.x1 = Math.max(bbox.x1, p[0] + 3.2);
    bbox.z0 = Math.min(bbox.z0, p[2] - 3.2);
    bbox.z1 = Math.max(bbox.z1, p[2] + 3.2);
}
bbox.x0 = Math.min(bbox.x0, -7.5);
bbox.x1 = Math.max(bbox.x1, 7.5);
bbox.z0 = Math.min(bbox.z0, -7.5);
bbox.z1 = Math.max(bbox.z1, 7.5);
const pc = { terrain, frames: LAYOUT.stairs.map(s => read('hardscape/stairs').stairFrame(s)), rng: read('util/prng').createRng(WORLD.seed).fork('hardscape').fork('paving'), seed: WORLD.seed, bbox, density: 1, steppingStones: houseSteppingStones() };
const fg = read('hardscape/flagstones'), paving = fg.placeFlagstones(pc, mat), discs = paving.steppingStones.filter(d => !d.atRim);
const paved = (x, z, t) => fg.isPaved(pc, x, z, t) && !fg.nearIsolatedDisc(discs, x, z, 1.4);
const base = await read('hardscape/joints').buildJointMesh(terrain, paved, bbox, { load: async () => null }, WORLD, WORLD.seed);
const candidate = await loader(true)('hardscape/joints').buildJointMesh(terrain, paved, bbox, { load: async () => null }, WORLD, WORLD.seed);
const ch = read('terrain/chunks'), wc = ch.createWeightContext(terrain, LAYOUT, WORLD.seed), sp = ch.layoutChunks(WORLD.terrainHalfSize).find(s => s.ring === 0 && s.x0 === 0 && s.z0 === 0);
const ground = new T.Mesh(ch.buildChunkGeometry(sp, wc).geometry, mat);
ground.name = 'terrain-chunk-r0-0-0';
for (const m of [ground, paving.mesh, base.mesh, candidate.mesh]) {
    m.updateMatrixWorld(true);
    m.material.side = T.DoubleSide;
}
const vp = LAYOUT.viewpoints.find(v => v.id === 'F_canopy'), camera = new T.PerspectiveCamera(vp.fov, 1280 / 720, .1, 500);
camera.position.fromArray(vp.position);
camera.lookAt(new T.Vector3().fromArray(vp.target));
camera.updateMatrixWorld();
const ray = new T.Raycaster(), pixels = [[929, 527], [963, 535], [1000, 542], [1036, 550], [1074, 557], [1113, 580]];
const witnesses = pixels.map(([x, y]) => { ray.setFromCamera(new T.Vector2((x + .5) / 1280 * 2 - 1, 1 - (y + .5) / 720 * 2), camera); const hit = m => { const h = ray.intersectObjects([m, ground, paving.mesh], false)[0]; return { mesh: h.object.name, face: h.faceIndex, world: h.point.toArray(), aboveTerrain: h.point.y - terrain.height(h.point.x, h.point.z) }; }; return { pixel: [x, y], before: hit(base.mesh), after: hit(candidate.mesh) }; });
const summary = (g) => {
    const p = g.attributes.position, index = g.index;
    let zeroArea = 0, wrongWinding = 0, maxBankContactError = 0, bankTriangles = 0, outsideBankSamples = 0, outsideNewBoundarySamples = 0;
    const outsideExamples = [];
    const edgeCounts = new Map();
    const v = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    let outsideSamples = 0;
    for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(p, ids[0]);
        b.fromBufferAttribute(p, ids[1]);
        c.fromBufferAttribute(p, ids[2]);
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        if (normal.lengthSq() < 1e-20)
            zeroArea++;
        else if (normal.y <= 0)
            wrongWinding++;
        for (let k = 0; k < 3; k++) {
            const x = ids[k], y = ids[(k + 1) % 3], key = x < y ? `${x}/${y}` : `${y}/${x}`;
            edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
        }
        const center = a.clone().add(b).add(c).multiplyScalar(1 / 3), bank = center.x > 2.5 && center.x < 5.5 && center.z > 4 && center.z < 6.7;
        if (bank)
            bankTriangles++;
        for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) {
            v.copy(a).multiplyScalar(weights[0]).addScaledVector(b, weights[1]).addScaledVector(c, weights[2]);
            if (bank)
                maxBankContactError = Math.max(maxBankContactError, Math.abs(v.y - terrain.height(v.x, v.z) - .008));
            if (!paved(v.x, v.z, .38)) {
                outsideSamples++;
                if (bank)
                    outsideBankSamples++;
                if (outsideExamples.length < 6)
                    outsideExamples.push({ face: i / 3, world: v.toArray(), bank, path: read('terrain/heightfield').surfaceMask(v.x, v.z).path });
            }
        }
    }
    const boundaryEdges = [...edgeCounts].filter(([, n]) => n === 1);
    const boundaryOnBank = boundaryEdges.filter(([k]) => { const ids = k.split('/').map(Number); v.fromBufferAttribute(p, ids[0]); a.fromBufferAttribute(p, ids[1]); return (v.x + a.x) / 2 > 2.5 && (v.x + a.x) / 2 < 5.5 && (v.z + a.z) / 2 > 4 && (v.z + a.z) / 2 < 6.7; });
    return { vertices: p.count, triangles: index.count / 3, zeroArea, wrongWinding, bankTriangles, maxBankContactError, boundaryEdges: boundaryEdges.length, bankBoundaryEdges: boundaryOnBank.length, outsideSamples, outsideBankSamples, outsideExamples };
};
const before = summary(base.mesh.geometry), after = summary(candidate.mesh.geometry);
// Prove the emitted triangles remain subsets of individual baseline terrain triangles.
// This also preserves baseline exclusions even where their old whole-cell admission had slivers.
const baseGeo = base.mesh.geometry, nextGeo = candidate.mesh.geometry;
const bp = baseGeo.attributes.position, np = nextGeo.attributes.position;
const baseFaces = new Map();
const originX = Math.floor(bbox.x0 / .2) * .2, originZ = Math.floor(bbox.z0 / .2) * .2;
const cell = (x, z) => [Math.floor((x - originX) / .2), Math.floor((z - originZ) / .2)];
const ids = (g, face) => [g.index.getX(face * 3), g.index.getX(face * 3 + 1), g.index.getX(face * 3 + 2)];
const xz = (p, id) => [p.getX(id), p.getZ(id)];
for (let f = 0; f < baseGeo.index.count / 3; f++) {
    const vs = ids(baseGeo, f), x = vs.reduce((s, i) => s + bp.getX(i), 0) / 3, z = vs.reduce((s, i) => s + bp.getZ(i), 0) / 3, k = cell(x, z).join('/');
    if (!baseFaces.has(k))
        baseFaces.set(k, []);
    baseFaces.get(k).push(f);
}
const bary = (x, z, vs) => { const [a, b, c] = vs.map(i => xz(bp, i)), d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]), u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d, v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d; return [u, v, 1 - u - v]; };
const subset = { triangles: nextGeo.index.count / 3, unmapped: 0, maxBaryOutside: 0, maxAttributeErrors: { position: 0, color: 0, uv: 0, aSoil: 0 }, maxAreaExpansion: 0 };
const area = (p, vs) => { const [a, b, c] = vs.map(i => xz(p, i)); return Math.abs((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])) / 2; };
const mappedAreas = new Map();
for (let f = 0; f < nextGeo.index.count / 3; f++) {
    const vs = ids(nextGeo, f), x = vs.reduce((s, i) => s + np.getX(i), 0) / 3, z = vs.reduce((s, i) => s + np.getZ(i), 0) / 3, [cx, cz] = cell(x, z);
    let best = null;
    for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++)
            for (const bf of baseFaces.get(`${cx + dx}/${cz + dz}`) || []) {
                const bvs = ids(baseGeo, bf), weights = vs.map(i => bary(np.getX(i), np.getZ(i), bvs)), outside = Math.max(0, ...weights.flat().map(v => Math.max(-v, v - 1)));
                if (!best || outside < best.outside)
                    best = { bf, bvs, weights, outside };
            }
    if (!best || best.outside > 3e-5) {
        subset.unmapped++;
        continue;
    }
    subset.maxBaryOutside = Math.max(subset.maxBaryOutside, best.outside);
    mappedAreas.set(best.bf, (mappedAreas.get(best.bf) || 0) + area(np, vs));
    for (const name of Object.keys(subset.maxAttributeErrors)) {
        const ba = baseGeo.attributes[name], na = nextGeo.attributes[name];
        for (let i = 0; i < 3; i++)
            for (let c = 0; c < ba.itemSize; c++) {
                const expected = best.bvs.reduce((s, v, k) => s + ba.array[v * ba.itemSize + c] * best.weights[i][k], 0), actual = na.array[vs[i] * na.itemSize + c];
                subset.maxAttributeErrors[name] = Math.max(subset.maxAttributeErrors[name], Math.abs(expected - actual));
            }
    }
}
for (const [f, a] of mappedAreas)
    subset.maxAreaExpansion = Math.max(subset.maxAreaExpansion, a - area(bp, ids(baseGeo, f)));
const classify = (g) => { const p = g.attributes.position, out = { tested: 0, path: 0, stairs: 0, structure: 0, isolatedDisc: 0, stairFootprint: 0, pathExamples: [] }; for (let f = 0; f < g.index.count / 3; f++) {
    const vs = ids(g, f);
    for (const w of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) {
        out.tested++;
        const x = vs.reduce((s, v, i) => s + p.getX(v) * w[i], 0), z = vs.reduce((s, v, i) => s + p.getZ(v) * w[i], 0), sm = read('terrain/heightfield').surfaceMask(x, z);
        if (sm.path < .38) {
            out.path++;
            if (out.pathExamples.length < 8)
                out.pathExamples.push({ face: f, x, z, mask: sm.path });
        }
        if (sm.stairs >= .5)
            out.stairs++;
        if (sm.structure >= .5)
            out.structure++;
        if (fg.nearIsolatedDisc(discs, x, z, 1.4))
            out.isolatedDisc++;
        if (pc.frames.some(f => read('hardscape/stairs').inStairFootprint(f, x, z)))
            out.stairFootprint++;
    }
} return out; };
const classifications = { before: classify(baseGeo), after: classify(nextGeo) };
const assert = (ok, message) => { if (!ok)
    throw new Error(message); };
assert(subset.unmapped === 0, 'Candidate triangle leaves baseline triangle');
assert(subset.maxAreaExpansion < 1e-6, 'Candidate expands a baseline triangle');
assert(subset.maxAttributeErrors.position < 1e-5, 'Candidate leaves baseline terrain plane');
assert(subset.maxAttributeErrors.color < 1e-5 && subset.maxAttributeErrors.uv < 1e-4 && subset.maxAttributeErrors.aSoil < 1e-5, 'Candidate attribute interpolation differs');
assert(after.zeroArea === 0 && after.wrongWinding === 0, 'New degenerate/downward face');
assert(after.outsideBankSamples === 0, 'Path overhang retained on target bank');
assert(after.maxBankContactError < 1e-6, 'Target-bank lift no longer matches terrain +8 mm');
assert(witnesses.every(w => w.before.mesh === 'flagstone-joints' && w.after.mesh === 'terrain-chunk-r0-0-0'), 'Recorded teeth not removed');
const trim = s => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'outsideExamples'));
const out = { status: 'proposed; not integrated; no GPU appearance verdict', source: sha, dependencyVersion: T.REVISION, scope: 'Actual CPU-built geometry and recorded F camera; null texture loaders. Preserves original whole-cell admission; clips path mask only.', bbox, parityOffset: (Math.floor(bbox.x0 / .2) + Math.floor(bbox.z0 / .2)) & 1, unchangedPavingCount: paving.stones.length, witnesses, before: trim(before), after: trim(after), subset, classifications, hashes: expectedHashes };
const outputArg = process.argv.indexOf('--output');
const output = outputArg >= 0 ? process.argv[outputArg + 1] : 'gauntlet/tmp/joint-boundary-mask-evidence.json';
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, output, teethRemoved: witnesses.length, zeroArea: after.zeroArea, wrongWinding: after.wrongWinding, bankOutsideSamples: after.outsideBankSamples, subset, hashes: expectedHashes }, null, 2));
