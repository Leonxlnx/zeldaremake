import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as T from 'three';
const source = 'bb11762b1b3d8545e9692234e8120d66533b63e3';
const here = path.dirname(fileURLToPath(import.meta.url));
const patch = fs.readFileSync(path.join(here, 'paving-caps.patch'), 'utf8');
const digest = s => createHash('sha256').update(s).digest('hex');
const baselineSources = Object.fromEntries(['geometry', 'flagstones'].map(name => [name, execFileSync('git', ['show', source + ':src/world/hardscape/' + name + '.ts'], { encoding: 'utf8' })]));
// Context-checked patch application in memory; no production source or index mutations.
function applyPatch(original, patch) { const lines = original.split('\n'), changes = patch.split('\n'), out = []; let cursor = 0, hunk = false; for (const line of changes) {
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
    if (!hunk || !line)
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
const sections = patch.split(/(?=^--- a\/)/m).filter(Boolean);
const candidateSources = Object.fromEntries(sections.map(section => { const name = section.match(/^--- a\/src\/world\/hardscape\/(\w+)\.ts/)[1]; return [name, applyPatch(baselineSources[name], section)]; }));
const expectedHashes = { 'geometry': { 'baseline': '792d2093f6f5171a6cf682d930ee61fa2d3368e51e9c1992cb45e6fdf94aee39', 'candidate': '1de36e8eb2ee8d324de65e07ce75b8dc1ea2d432840fa29d2968d3d5eee2b086' }, 'flagstones': { 'baseline': 'f0eab65e99a5db299603d29d03d5501b1218680be497a57fbba21f20a29d9224', 'candidate': '1531e7eb2cdda4153b29bb60f1259d9b98e1ae01c7685801e412ebed49b7ae84' }, 'patch': '36fc803e79a9de00cfac74cc95d1aebb547746437c8eeea326712422c3dc2f90' };
for (const name of ['geometry', 'flagstones']) {
    if (digest(baselineSources[name]) !== expectedHashes[name].baseline || digest(candidateSources[name]) !== expectedHashes[name].candidate)
        throw new Error('Unexpected ' + name + ' source hash');
}
if (digest(patch) !== expectedHashes.patch)
    throw new Error('Unexpected patch hash');
function loader(candidate) { const cache = new Map(), records = []; let record = true; function load(f) { f = path.posix.normalize(f); if (cache.has(f))
    return cache.get(f).exports; const m = { exports: {} }; cache.set(f, m); let s = execFileSync('git', ['show', source + ':' + f], { encoding: 'utf8' }); if (candidate && f === 'src/world/hardscape/geometry.ts')
    s = candidateSources.geometry; if (candidate && f === 'src/world/hardscape/flagstones.ts')
    s = candidateSources.flagstones; new Function('require', 'module', 'exports', ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(id => id === 'three' ? T : load(path.posix.join(path.posix.dirname(f), id + '.ts')), m, m.exports); if (f === 'src/world/hardscape/geometry.ts') {
    const original = m.exports.buildSlab;
    m.exports.buildSlab = (mb, outline, o) => { const start = mb.vertexCount, n = outline.length; original(mb, outline, o); if (!record)
        return; const top = o.topRing ?? m.exports.inset(outline, Math.min(o.bevel, o.thickness * .6)), r = { start, end: mb.vertexCount, outline, top, thickness: o.thickness, crown: -(o.dip ?? 0), buffers: {}, downward: 0, zeroArea: 0, area: 0, topOutside: 0 }; for (const [k, b] of Object.entries({ position: mb.pos, normal: mb.nrm, uv: mb.uv, color: mb.col, aMoss: mb.moss, aStain: mb.stain })) {
        const size = k === 'uv' ? 2 : k === 'aMoss' || k === 'aStain' ? 1 : 3;
        r.buffers[k] = b.slice(start * size, mb.vertexCount * size);
    } const pos = r.buffers.position; for (let i = 4 * n * 9; i < pos.length; i += 9) {
        const a = pos.slice(i, i + 3), b = pos.slice(i + 3, i + 6), c = pos.slice(i + 6, i + 9), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        if (ny < -1e-10)
            r.downward++;
        if (Math.abs(ny) < 1e-12)
            r.zeroArea++;
        r.area += ny / 2;
        for (const w of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) {
            const x = a[0] * w[0] + b[0] * w[1] + c[0] * w[2], z = a[2] * w[0] + b[2] * w[1] + c[2] * w[2];
            if (!m.exports.pointInPolygon(top, x, z) && m.exports.distToPolygon(top, x, z) > 1e-8)
                r.topOutside++;
        }
    } r.areaError = Math.abs(r.area - Math.abs(m.exports.polygonArea(top))); records.push(r); };
} return m.exports; } return { read: n => load('src/world/' + n + '.ts'), records, stop: () => { record = false; } }; }
const geometryHash = g => { const h = createHash('sha256'); for (const k of Object.keys(g.attributes).sort())
    h.update(Buffer.from(g.attributes[k].array.buffer)); return h.digest('hex'); };
function fallbackCheck() { const l = loader(true), geo = l.read('hardscape/geometry'); l.stop(); const shape = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }, { x: 2, z: 3 }, { x: 2, z: 1 }, { x: 1, z: 1 }, { x: 1, z: 3 }, { x: 0, z: 3 }], mb = new geo.MeshBuilder(); geo.buildSlab(mb, shape, { thickness: .1, bevel: .01, topRing: shape, notchedTop: true }); let area = 0, bad = 0; for (let i = 4 * shape.length * 9; i < mb.pos.length; i += 9) {
    const p = mb.pos, ny = (p[i + 5] - p[i + 2]) * (p[i + 6] - p[i]) - (p[i + 3] - p[i]) * (p[i + 8] - p[i + 2]);
    if (ny <= 0)
        bad++;
    area += ny / 2;
} if (bad || Math.abs(area - 7) > 1e-8)
    throw new Error('Non-star cap fallback failure'); return { shape: 'U-shaped cap with empty visibility kernel', positiveTopArea: area, nonPositiveTriangles: bad }; }
function build(candidate) {
    const l = loader(candidate), read = l.read, { WORLD } = read('config'), { LAYOUT, houseSteppingStones } = read('layout'), terrain = read('terrain/heightfield').createTerrain(), rng = read('util/prng').createRng(WORLD.seed).fork('hardscape');
    const bbox = { x0: -7.5, x1: 7.5, z0: -7.5, z1: 7.5 };
    for (const p of [...LAYOUT.pathSpine, ...LAYOUT.pathToStairs, ...LAYOUT.pathToHouse]) {
        bbox.x0 = Math.min(bbox.x0, p[0] - 3.2);
        bbox.x1 = Math.max(bbox.x1, p[0] + 3.2);
        bbox.z0 = Math.min(bbox.z0, p[2] - 3.2);
        bbox.z1 = Math.max(bbox.z1, p[2] + 3.2);
    }
    const pc = { terrain, frames: LAYOUT.stairs.map(s => read('hardscape/stairs').stairFrame(s)), rng: rng.fork('paving'), seed: WORLD.seed, bbox, density: 1, steppingStones: houseSteppingStones() };
    const paving = read('hardscape/flagstones').placeFlagstones(pc, new T.MeshBasicMaterial());
    l.stop();
    const stairs = LAYOUT.stairs.map(d => { const b = read('hardscape/stairs').buildStairway(d, terrain, rng.fork(`stairs-${d.id}`), WORLD.seed); return { id: d.id, hash: geometryHash(b.geometry), triangles: b.triangles }; });
    const positions = paving.mesh.geometry.attributes.position;
    for (let i = 0; i < l.records.length; i++) {
        const r = l.records[i];
        r.worldPositions = Array.from(positions.array.slice(r.start * 3, r.end * 3));
        r.worldDownward = 0;
        r.worldZeroArea = 0;
        for (let j = r.start * 3 + 4 * r.outline.length * 9; j < r.end * 3; j += 9) {
            const p = positions.array, ny = (p[j + 5] - p[j + 2]) * (p[j + 6] - p[j]) - (p[j + 3] - p[j]) * (p[j + 8] - p[j + 2]);
            if (ny < -1e-10)
                r.worldDownward++;
            if (Math.abs(ny) < 1e-12)
                r.worldZeroArea++;
        }
        r.minTopClearance = Infinity;
        r.minRimClearance = Infinity;
        for (let j = r.start; j < r.end; j++) {
            const x = positions.getX(j), y = positions.getY(j), z = positions.getZ(j), gap = y - terrain.height(x, z);
            if (j - r.start >= 4 * r.outline.length * 3)
                r.minTopClearance = Math.min(r.minTopClearance, gap);
            else
                r.minRimClearance = Math.min(r.minRimClearance, gap);
        }
    }
    return { paving, records: l.records, stairs, meshHash: geometryHash(paving.mesh.geometry) };
}
const a = build(false), b = build(true), c = build(true);
const assert = (ok, msg) => { if (!ok)
    throw new Error(msg); };
assert(a.paving.stones.length === 619 && b.paving.stones.length === 619, 'Slab count changes');
assert(JSON.stringify(a.paving.stones) === JSON.stringify(b.paving.stones), 'Placement/footprint/profile metadata changes');
assert(JSON.stringify(a.paving.stats) === JSON.stringify(b.paving.stats), 'Seeded stone stats change');
assert(JSON.stringify(a.stairs) === JSON.stringify(b.stairs), 'Stair geometry changes');
assert(b.meshHash === c.meshHash, 'Candidate nondeterministic');
const changed = [], sum = { beforeDownward: 0, afterDownward: 0, beforeOutside: 0, afterOutside: 0, afterZeroArea: 0, afterWorldDownward: 0, afterWorldZeroArea: 0, maxAreaError: 0, minInteriorClearance: Infinity, worstInteriorClearanceDelta: 0 };
for (let i = 0; i < a.records.length; i++) {
    const ar = a.records[i], br = b.records[i];
    sum.beforeDownward += ar.downward;
    sum.afterDownward += br.downward;
    sum.beforeOutside += ar.topOutside;
    sum.afterOutside += br.topOutside;
    sum.afterZeroArea += br.zeroArea;
    sum.afterWorldDownward += br.worldDownward;
    sum.afterWorldZeroArea += br.worldZeroArea;
    assert(ar.minRimClearance === br.minRimClearance, 'Rim terrain contact changed');
    sum.maxAreaError = Math.max(sum.maxAreaError, br.areaError);
    sum.minInteriorClearance = Math.min(sum.minInteriorClearance, br.minTopClearance);
    sum.worstInteriorClearanceDelta = Math.min(sum.worstInteriorClearanceDelta, br.minTopClearance - ar.minTopClearance);
    const ah = digest(JSON.stringify(ar.buffers)), bh = digest(JSON.stringify(br.buffers));
    if (ah !== bh) {
        const n = ar.outline.length;
        for (const key of Object.keys(ar.buffers).filter(k => k !== 'normal')) {
            const size = key === 'uv' ? 2 : key === 'aMoss' || key === 'aStain' ? 1 : 3;
            assert(JSON.stringify(ar.buffers[key].slice(0, 4 * n * 3 * size)) === JSON.stringify(br.buffers[key].slice(0, 4 * n * 3 * size)), `${key} side/shoulder changed for${i}`);
        }
        const newCentre = br.buffers.position.slice(-3), oldCentre = ar.buffers.position.slice(-3);
        changed.push({ ordinal: i, position: [a.paving.stones[i].x, a.paving.stones[i].z], notches: a.paving.stones[i].notches, beforeDownward: ar.downward, afterDownward: br.downward, centreShift: Math.hypot(newCentre[0] - oldCentre[0], newCentre[2] - oldCentre[2]), beforeMinTopClearance: ar.minTopClearance, afterMinTopClearance: br.minTopClearance });
    }
}
assert(sum.afterDownward === 0 && sum.afterZeroArea === 0 && sum.afterWorldDownward === 0 && sum.afterWorldZeroArea === 0, 'Candidate inverted or degenerate cap');
assert(sum.worstInteriorClearanceDelta >= -1e-6, 'Interior terrain intersection worsened');
assert(sum.afterOutside === 0, 'Candidate cap extends outside outline');
assert(sum.maxAreaError < 1e-8, 'Cap area does not cover original outline');
assert(changed.every(s => s.beforeDownward > 0), 'Unbroken valid slab changed');
const stepping = a.paving.steppingStones.map(d => a.paving.stones.findIndex(s => Math.hypot(s.x - d.x, s.z - d.z) < d.r * .6));
assert(stepping.length === 8 && stepping.every(i => i >= 0 && JSON.stringify(a.records[i].buffers) === JSON.stringify(b.records[i].buffers)), 'Stepping slab geometry changed');
const out = { fallback: fallbackCheck(), steppingStoneMeshesIdentical: stepping.length, source, scope: 'CPU source geometry; no textures/GPU appearance claim', counts: { before: a.paving.stones.length, after: b.paving.stones.length, changedCaps: changed.length, unchangedCaps: 619 - changed.length, trianglesBefore: a.paving.triangles, trianglesAfter: b.paving.triangles }, checks: sum, allStoneMetadataIdentical: true, stairsIdentical: true, deterministic: true, meshHashes: { before: a.meshHash, after: b.meshHash }, changed, stairs: a.stairs, status: 'proposed; not integrated; no GPU verdict', hashes: expectedHashes };
const oi = process.argv.indexOf('--output'), output = oi >= 0 ? process.argv[oi + 1] : 'gauntlet/tmp/astra-paving-caps-evidence.json';
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, output, counts: out.counts, checks: out.checks, steppingStoneMeshesIdentical: out.steppingStoneMeshesIdentical, deterministic: out.deterministic, hashes: out.hashes }, null, 2));
