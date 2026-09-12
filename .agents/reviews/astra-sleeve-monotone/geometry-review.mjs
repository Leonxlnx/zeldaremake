import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as T from 'three';
import * as utilities from 'three/addons/utils/BufferGeometryUtils.js';

const out = 'gauntlet/tmp/monotone-sleeve-replay/static';
fs.mkdirSync(out, { recursive: true });
const J = .011418040841817856, L = .025;
const sha = x => createHash('sha256').update(x).digest('hex');
const sources = new Map(), report = { base: '579078ca77b7af846f4805c27fbfecf21c784d72', sides: [], limitations: ['Static sleeve and sewing geometry only; root separately checks actual posed arm/tunic contacts.', 'Sewn containment tests use all 100 actual endpoint centres and 50 middle-ring centres per side, in three ray directions; this is not a uniform proof over every thread surface point.', 'Smooth-field positivity and outward normals do not certify subjective appearance; an actual renderer comparison remains necessary.'] };
function loader(override) {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    let source = fs.readFileSync(file, 'utf8');
    if (override && file.endsWith('/sleeve-drape.ts')) source = override;
    sources.set(file + (override ? ':baseline' : ''), sha(source));
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', js)(id => id === 'three' ? T : id.endsWith('/BufferGeometryUtils.js') ? utilities : load(path.resolve(path.dirname(file), id + '.ts')), module, module.exports);
    return module.exports;
  };
}
assert.equal(sha(fs.readFileSync('src/world/character/sleeve-drape.ts')), 'a636053e4e8deadcef93a4918482955a3c69df38b225dd36e94cdfe584c889d0', 'check out the reviewed helper');
const current = loader(), original = loader(execFileSync('git', ['show', '579078ca77b7af846f4805c27fbfecf21c784d72:src/world/character/sleeve-drape.ts'], { encoding: 'utf8' }));
const { createLinkSleeve } = current('src/world/character/sleeve-geometry.ts');
const { createLinkSleeveStitches } = current('src/world/character/sleeve-stitches.ts');
const newDrape = current('src/world/character/sleeve-drape.ts'), oldDrape = original('src/world/character/sleeve-drape.ts');
const bytes = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const point = (a, i) => new T.Vector3().fromBufferAttribute(a, i);
function field(p, side) {
  const x = side * p.x;
  if (x <= J) return { point: p.clone(), q: 0, qx: 0, f: 0, fy: 0, determinant: 1 };
  const u = Math.min(1, (x - J) / L), t = Math.max(0, Math.min(1, (p.y + .09) / .105));
  const S = t => 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5;
  const q = u < 1 ? L * (2.5 * u ** 4 - 3 * u ** 5 + u ** 6) : x - J - L / 2;
  const qx = side * S(u), f = .25 - .57 * S(t);
  const fy = t > 0 && t < 1 ? -.57 / .105 * 30 * t ** 2 * (1 - t) ** 2 : 0;
  return { point: new T.Vector3(p.x, p.y + q * f, p.z), q, qx, f, fy, determinant: 1 + q * fy };
}
function expectedNormal(p, n, side) {
  const f = field(p, side); if (side * p.x <= J) return n.clone();
  const ny = n.y / f.determinant;
  return new T.Vector3(n.x - f.qx * f.f * ny, ny, n.z).normalize();
}
function geometryCheck(raw, shaped, baseline, side, name) {
  const p = shaped.attributes.position, n = shaped.attributes.normal, rp = raw.attributes.position, rn = raw.attributes.normal, ix = shaped.index;
  assert(bytes(ix.array).equals(bytes(raw.index.array)), name + ' original index exact');
  assert(bytes(shaped.attributes.uv.array).equals(bytes(raw.attributes.uv.array)), name + ' original UV exact');
  let protectedVertices = 0, maxPositionError = 0, maxNormalError = 0, maxNormalUnitError = 0, maxDisplacement = 0, minDeterminant = Infinity, maxOutward = 0;
  for (let i = 0; i < p.count; i++) {
    const before = point(rp, i), after = point(p, i), normal = point(n, i), F = field(before, side);
    assert(after.toArray().every(Number.isFinite) && normal.toArray().every(Number.isFinite), name + ' finite');
    if (side * before.x <= J) {
      protectedVertices++;
      for (const attr of ['position', 'normal']) for (let k = 0; k < 3; k++) {
        assert.equal(shaped.attributes[attr].array[i * 3 + k], raw.attributes[attr].array[i * 3 + k], name + ' protected raw ' + attr);
        assert.equal(shaped.attributes[attr].array[i * 3 + k], baseline.attributes[attr].array[i * 3 + k], name + ' protected baseline ' + attr);
      }
    }
    maxPositionError = Math.max(maxPositionError, after.distanceTo(F.point));
    maxNormalError = Math.max(maxNormalError, normal.distanceTo(expectedNormal(before, point(rn, i), side)));
    maxNormalUnitError = Math.max(maxNormalUnitError, Math.abs(normal.length() - 1));
    maxDisplacement = Math.max(maxDisplacement, before.distanceTo(after));
    minDeterminant = Math.min(minDeterminant, F.determinant); maxOutward = Math.max(maxOutward, side * before.x);
  }
  assert(maxPositionError < 8e-9, name + ' independently derived position');
  assert(maxNormalError < 9e-8, name + ' independently derived inverse transpose');
  assert(maxNormalUnitError < 1e-6, name + ' unit normals');
  const qMax = field(new T.Vector3(side * maxOutward, 0, 0), side).q;
  const continuousDeterminantLowerBound = 1 - qMax * .57 / .105 * 1.875;
  assert(continuousDeterminantLowerBound > 0, name + ' entire continuous domain orientation');
  const ids = [], keys = new Map();
  for (let i = 0; i < p.count; i++) {
    // Only resolve duplicate authored UV/cap seams, never merge nearby unrelated vertices.
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(x => Math.round(x / 1e-10)).join(',');
    if (!keys.has(key)) keys.set(key, keys.size); ids.push(keys.get(key));
  }
  const edges = new Map(); let volume = 0, minArea = Infinity, minTransportedFaceDot = Infinity;
  for (let i = 0; i < ix.count; i += 3) {
    const verts = [0, 1, 2].map(k => ix.getX(i + k)), [a, b, c] = verts.map(i => point(p, i));
    const cross = b.clone().sub(a).cross(c.clone().sub(a)), area = cross.length() / 2;
    assert(area > 1e-14, name + ' nondegenerate triangle ' + i / 3); minArea = Math.min(minArea, area);
    volume += a.dot(b.clone().cross(c)) / 6;
    const [ra, rb, rc] = verts.map(i => point(rp, i));
    const centre = ra.clone().add(rb).add(rc).multiplyScalar(1 / 3);
    const oldNormal = rb.sub(ra).cross(rc.sub(ra)).normalize();
    const dot = cross.normalize().dot(expectedNormal(centre, oldNormal, side));
    assert(dot > 0, name + ' preserved triangle orientation ' + i / 3); minTransportedFaceDot = Math.min(minTransportedFaceDot, dot);
    for (let k = 0; k < 3; k++) { const a = ids[verts[k]], b = ids[verts[(k + 1) % 3]], key = [Math.min(a, b), Math.max(a, b)].join(':'); const edge = edges.get(key) ?? { count: 0, balance: 0 }; edge.count++; edge.balance += a < b ? 1 : -1; edges.set(key, edge); }
  }
  const badEdges = [...edges.entries()].filter(([, x]) => x.count !== 2 || x.balance !== 0);
  assert.equal(badEdges.length, 0, name + ' welded closed oriented topology'); assert(volume > 0, name + ' positive volume');
  return { vertices: p.count, triangles: ix.count / 3, protectedVertices, maxPositionError, maxNormalError, maxNormalUnitError, maxDisplacement, minDeterminant, continuousDeterminantLowerBound, minArea, volume, minTransportedFaceDot, weldedVertices: keys.size, badEdges: badEdges.length };
}
function normalFinishCheck(before, finished, raw, side) {
  assert(bytes(before.attributes.position.array).equals(bytes(finished.attributes.position.array)), 'normal finish never moves thread');
  assert(bytes(before.index.array).equals(bytes(finished.index.array)), 'normal finish index exact');
  const p = finished.attributes.position, n = finished.attributes.normal, bn = before.attributes.normal, ix = finished.index;
  let changes = 0, minIncidentDot = Infinity;
  for (let i = 0; i < p.count; i++) {
    if (!point(n, i).equals(point(bn, i))) changes++;
    if (side * raw.attributes.position.getX(i) <= J) assert(point(n, i).equals(point(raw.attributes.normal, i)), 'finished protected normal exact');
  }
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [0, 1, 2].map(j => ix.getX(i + j)), [a, b, c] = ids.map(j => point(p, j));
    const face = b.sub(a).cross(c.sub(a)).normalize();
    for (const id of ids) { const dot = face.dot(point(n, id)); assert(dot > 0, 'finished thread incident corner ' + id); minIncidentDot = Math.min(minIncidentDot, dot); }
  }
  return { changedNormals: changes, minIncidentDot };
}
function sewingCheck(cloth, thread, side) {
  const mesh = new T.Mesh(cloth, new T.MeshBasicMaterial({ side: T.DoubleSide })), ray = new T.Raycaster();
  const p = thread.attributes.position, perStitch = 27; assert.equal(p.count % perStitch, 0);
  const count = p.count / perStitch, result = { stitches: count, endpointCentres: 0, middleCentres: 0, rays: 0, minimumEndpointInnerMargin: Infinity, minimumEndpointOuterMargin: Infinity, minimumMiddleOuterGap: Infinity };
  for (let stitch = 0; stitch < count; stitch++) {
    const base = stitch * perStitch;
    const centre = new T.Vector3(); for (let j = 0; j < 4; j++) centre.add(point(p, base + 10 + j)); centre.multiplyScalar(.25);
    for (const [label, location] of [['start', point(p, base + 26)], ['end', point(p, base + 25)], ['middle', centre]]) {
      if (label === 'middle') result.middleCentres++; else result.endpointCentres++;
      for (const ySlope of [0, -.2, .2]) {
        const radial = new T.Vector3(location.x, 0, location.z).normalize(), direction = radial.clone().setY(ySlope).normalize();
        ray.set(location.clone().addScaledVector(direction, .15), direction.clone().negate());
        const hits = ray.intersectObject(mesh, false).filter((hit, i, all) => i === 0 || Math.abs(hit.distance - all[i - 1].distance) > 1e-9);
        result.rays++; const crossingBefore = hits.filter(hit => hit.distance < .15).length;
        const witness = { side, stitch, label, ySlope, location: location.toArray(), distances: hits.map(x => x.distance) };
        if (label === 'middle') {
          if (!(hits.length > 0 && hits[0].distance > .15 && crossingBefore === 0)) throw Object.assign(new Error('Middle thread centre must remain above actual cloth'), { witness });
          result.minimumMiddleOuterGap = Math.min(result.minimumMiddleOuterGap, hits[0].distance - .15);
        } else {
          if (!(hits.length >= 2 && crossingBefore % 2 === 1 && hits[0].distance < .15 && hits[1].distance > .15)) throw Object.assign(new Error('Thread endpoint centre must be inside actual cloth'), { witness });
          result.minimumEndpointOuterMargin = Math.min(result.minimumEndpointOuterMargin, .15 - hits[0].distance);
          result.minimumEndpointInnerMargin = Math.min(result.minimumEndpointInnerMargin, hits[1].distance - .15);
        }
      }
    }
  }
  mesh.material.dispose(); return result;
}
try {
  for (const side of [1, -1]) {
    const rawCloth = createLinkSleeve(), rawThread = createLinkSleeveStitches(rawCloth);
    const cloth = rawCloth.clone(), thread = rawThread.clone(), baselineCloth = rawCloth.clone(), baselineThread = rawThread.clone();
    newDrape.shapeLinkSleeveDrape(cloth, side); newDrape.shapeLinkSleeveDrape(thread, side);
    oldDrape.shapeLinkSleeveDrape(baselineCloth, side); oldDrape.shapeLinkSleeveDrape(baselineThread, side);
    const sideReport = { side }; report.sides.push(sideReport);
    sideReport.cloth = geometryCheck(rawCloth, cloth, baselineCloth, side, 'cloth');
    sideReport.thread = geometryCheck(rawThread, thread, baselineThread, side, 'thread');
    const beforeFinish = thread.clone(); newDrape.finishLinkSleeveThreadNormals(thread, side);
    sideReport.finish = normalFinishCheck(beforeFinish, thread, rawThread, side);
    sideReport.baselineSewing = sewingCheck(baselineCloth, baselineThread, side);
    sideReport.sewing = sewingCheck(cloth, thread, side);
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = { message: error.message, stack: error.stack, witness: error.witness }; process.exitCode = 1;
} finally {
  report.sources = [...sources].map(([path, sha256]) => ({ path, sha256 }));
  fs.writeFileSync(out + '/result.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
