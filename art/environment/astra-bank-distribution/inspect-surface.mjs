import assert from 'node:assert/strict';
import * as T from 'three';

const vec = p => p.clone();
const arrayBytes = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
function run(gen) { let s = gen.next(); while (!s.done) s = gen.next(); return s.value; }
const boundsJSON = (b, origin) => ({ min: b.min.clone().add(origin).toArray(), max: b.max.clone().add(origin).toArray() });
function lineDistance(p, paths) {
  let best = Infinity;
  const q = new T.Vector3();
  for (const path of paths) for (let i = 1; i < path.length; i++) best = Math.min(best, new T.Line3(path[i - 1], path[i]).closestPointToPoint(p, true, q).distanceTo(p));
  return best;
}

export class LayeredAudit {
  active;
  contexts = new Map();
  wrapWriter(exports) {
    const original = exports.tube;
    exports.tube = (...args) => {
      if (this.active) this.active.calls.push({ writer: args[0], path: args[1].map(vec), radii: [...args[2]], leavesBefore: args[0].leafCount });
      return original(...args);
    };
  }
  wrapKit(exports) {
    const create = exports.createNearCanopyKit;
    exports.createNearCanopyKit = options => {
      const kit = create(options), original = kit.lobePart;
      kit.lobePart = (rng, rec, idx) => {
        if (options.id !== 'giant-stair-bank-giant' || ![24, 25, 26].includes(rec.group)) return original(rng, rec, idx);
        const context = { rng, rec, idx, original, calls: [] }, prior = this.active;
        this.active = context;
        const started = performance.now();
        try { return original(rng, rec, idx); }
        finally { context.initialBuildMs = performance.now() - started; this.active = prior; this.contexts.set(rec.group, context); }
      };
      return kit;
    };
  }
  inspect(asset, enabled, geometryRecord) {
    const g = asset.authoredLeaves, pos = g.attributes.position, roots = g.attributes.aRoot, uv = g.attributes.uv;
    const part24 = asset.nearCanopy.find(p => p.kind === 'lobe' && p.group === 24);
    const origin = new T.Vector3(10.6, 3.4 - part24.center.y, 9.15);
    const groups = [24, 25, 26].map(group => {
      const context = this.contexts.get(group), rec = context.rec;
      const partIndex = asset.nearCanopy.findIndex(p => p.kind === 'lobe' && p.group === group), part = asset.nearCanopy[partIndex];
      const coreIds = [], body = new T.Box3(), far = new T.Box3();
      for (let v = 0; v < pos.count; v++) if (roots.getW(v) >= 999 && Math.floor(roots.getW(v) - 1000 + 0.01) === group) {
        const p = new T.Vector3().fromBufferAttribute(pos, v); far.expandByPoint(p);
        if (uv.getX(v) === 0 && uv.getY(v) === 0) { coreIds.push(v); body.expandByPoint(p); }
      }
      assert.equal(coreIds.length, 493);
      const row = { group, partIndex, coreIds, initialBuildMs: context.initialBuildMs, centerLocal: rec.center.toArray(), centerWorld: rec.center.clone().add(origin).toArray(), coreWorldBounds: boundsJSON(body, origin), farWorldBounds: boundsJSON(far, origin), near: { leaves: part.leaves, triangles: part.triangles, woodTriangles: part.woodTriangles } };
      row.recordedWood = JSON.parse(JSON.stringify({ stem: rec.stem, stemRadii: rec.stemRadii, secondaries: rec.secondaries, twigs: rec.twigs, floorY: rec.floorY }));
      if (!enabled) return row;
      assert(rec.layeredCore && part.persistent && part.envelope);
      assert.equal(rec.twigs.length, 12, 'Recorded far parents remain untouched');
      assert.equal(rec.secondaries.length, 3);
      const near = part.geometry, p = near.attributes.position, w = near.attributes.aWind, r = near.attributes.aRoot;
      const coreFaces = [];
      for (let i = 0; i < 16; i++) for (let j = 0; j < 28; j++) {
        const a = coreIds[i * 29 + j], b = coreIds[(i + 1) * 29 + j];
        for (const ids of [[a,b,a+1],[b,b+1,a+1]]) coreFaces.push(ids.map(v => new T.Vector3().fromBufferAttribute(pos,v)));
      }
      const ray = new T.Ray(), hit = new T.Vector3();
      const surfaceDistance = point => {
        const radius = point.distanceTo(rec.center);
        ray.set(rec.center, point.clone().sub(rec.center).normalize());
        let nearest = Infinity;
        for (const face of coreFaces) if (ray.intersectTriangle(...face, false, hit)) nearest = Math.min(nearest, hit.distanceTo(rec.center));
        assert(Number.isFinite(nearest), 'Closed original core has a radial surface intersection');
        return radius - nearest;
      };
      let leafCentroidsOutsideCore = 0, leafRootsOutsideCore = 0, minCentroidClearance = Infinity, maxCentroidClearance = -Infinity;
      for (let v = 0; v < p.count;) {
        if (r.getW(v) < 0.5) { v++; continue; }
        const centroid = new T.Vector3();
        for (let k = 0; k < 8; k++) centroid.add(new T.Vector3().fromBufferAttribute(p,v+k));
        centroid.multiplyScalar(1/8);
        const clearance = surfaceDistance(centroid);
        leafCentroidsOutsideCore += Number(clearance > 1e-5);
        leafRootsOutsideCore += Number(surfaceDistance(new T.Vector3().fromBufferAttribute(p,v)) > 1e-5);
        minCentroidClearance = Math.min(minCentroidClearance,clearance); maxCentroidClearance = Math.max(maxCentroidClearance,clearance);
        v += 8;
      }
      row.surfaceCoverage = { leafCentroidsOutsideCore, leafRootsOutsideCore, fractionCentroidsOutside: leafCentroidsOutsideCore/part.leaves, minCentroidClearance, maxCentroidClearance, method: 'Rest-pose radial intersection with all896 original core triangles; exterior placement, not rendered coverage or visible pixels.' };
      assert.equal(near.index.array.constructor.name, 'Uint16Array');
      const expected = [2800, 2100, 2200][group - 24]; assert(part.leaves <= expected && part.leaves > 0);
      assert.equal(part.triangles, near.index.count / 3);
      assert.equal(part.woodTriangles, part.triangles - part.leaves * 8);
      const envelope = rec.layeredCore.bounds, staticBox = new T.Box3(), windBox = new T.Box3(), leafBox = new T.Box3(), woodBox = new T.Box3();
      const minMargin = new T.Vector3(Infinity, Infinity, Infinity), minWindMargin = minMargin.clone();
      const direction = new T.Vector2(0.72, -0.69).normalize();
      let maxExtra = 0, maxAll = 0, maxVertical = 0;
      // windField weights are positive and sum to1; gust factors <=1 for uGust in[0,1].
      for (let v = 0; v < p.count; v++) {
        const q = new T.Vector3().fromBufferAttribute(p, v), h = Math.max(0, q.y - r.getY(v));
        staticBox.expandByPoint(q);
        (r.getW(v) >= 0.5 ? leafBox : woodBox).expandByPoint(q);
        const whole = (1 - 0.97) * 0.85 * 0.06 * h;
        const flex = (1 - w.getX(v)) * 0.85 * 0.06 * h * 0.5 * 0.3;
        const flutter = Math.max(0, w.getZ(v)) * 0.85;
        const extra = new T.Vector3(Math.abs(direction.x) * flex + 0.6 * flutter, 0.4 * flutter, Math.abs(direction.y) * flex + 0.5 * flutter);
        const full = extra.clone().add(new T.Vector3(Math.abs(direction.x) * whole, 0, Math.abs(direction.y) * whole));
        maxExtra = Math.max(maxExtra, ...extra.toArray()); maxAll = Math.max(maxAll, ...full.toArray()); maxVertical = Math.max(maxVertical, full.y);
        const low = q.clone().sub(full), high = q.clone().add(full);
        windBox.expandByPoint(low); windBox.expandByPoint(high);
        for (const key of ['x', 'y', 'z']) {
          minMargin[key] = Math.min(minMargin[key], q[key] - envelope.min[key], envelope.max[key] - q[key]);
          minWindMargin[key] = Math.min(minWindMargin[key], low[key] - envelope.min[key], envelope.max[key] - high[key]);
        }
      }
      assert(Math.min(...minMargin.toArray()) >= 0.08 - 2e-6, 'Static8cm margin');
      assert(Math.min(...minWindMargin.toArray()) >= 0, 'Analytically contained for all phases at current strength');
      if (group === 26) {
        assert.equal(rec.floorY + origin.y, 4.75);
        assert(windBox.min.y + origin.y >= 4.75, 'Analytic vertical floor');
        assert(Math.abs(body.min.y + origin.y - 4.75) < 1e-6, 'Original opaque floor restored');
      }
      let leafTriangles = 0, minTriangleArea = Infinity;
      for (let i = 0; i < near.index.count; i += 3) {
        const ids = [0, 1, 2].map(k => near.index.getX(i + k));
        if (r.getW(ids[0]) >= 0.5) leafTriangles++;
        const tri = new T.Triangle(...ids.map(v => new T.Vector3().fromBufferAttribute(p, v)));
        minTriangleArea = Math.min(minTriangleArea, tri.getArea());
      }
      assert.equal(leafTriangles, part.leaves * 8);
      assert(minTriangleArea > 1e-12, 'Nondegenerate leaf and tube faces');
      const writers = new Map();
      for (const call of context.calls) { const list = writers.get(call.writer) || []; list.push(call); writers.set(call.writer, list); }
      const tubes = [...writers.values()].sort((a, b) => b.length - a.length)[0];
      assert.equal(tubes.reduce((n,t) => n + (t.path.length - 1) * 6 + 3, 0), part.woodTriangles, 'Only connected three-sided shoots');
      assert(tubes.length <= [40,32,32][group-24]);
      assert(tubes.every(t => t.path.length <= 14));
      const surfaceAreaM2 = coreFaces.reduce((n, points) => n + new T.Triangle(...points).getArea(), 0);
      const floorAreaM2 = coreFaces.filter(points => points.every(p => Math.abs(p.y - body.min.y) < 1e-6)).reduce((n, points) => n + new T.Triangle(...points).getArea(), 0);
      const shootLengthsM = tubes.map(t => t.path.slice(1).reduce((n,p,i,a) => n + (i ? p.distanceTo(a[i-1]) : 0),0));
      const seedSpacingM = tubes.map((t,i) => Math.min(...tubes.filter((_,j)=>j!==i).map(other => t.path[1].distanceTo(other.path[1]))));
      const connected = [...rec.stem ? [rec.stem] : [], ...rec.secondaries.map(t => t.path), ...rec.twigs.map(t => t.path)];
      let maxBranchAnchorGap = 0;
      for (const tube of tubes) { maxBranchAnchorGap = Math.max(maxBranchAnchorGap, lineDistance(tube.path[0], connected)); connected.push(tube.path); }
      assert(maxBranchAnchorGap < 1e-8, 'Every new branch origin attaches to recorded or earlier retained wood');
      let maxPetioleToPath = 0;
      for (let v = 0; v < p.count;) {
        if (r.getW(v) < 0.5) { v++; continue; }
        maxPetioleToPath = Math.max(maxPetioleToPath, lineDistance(new T.Vector3().fromBufferAttribute(p, v), connected)); v += 8;
      }
      assert(maxPetioleToPath < 0.012, 'Leaf bases stay within carrying twig radius scale');
      const rebuildStart = performance.now();
      const rebuilt = run(part.build()); row.rebuildMs = performance.now() - rebuildStart; assert.deepEqual(geometryRecord(rebuilt), geometryRecord(near), 'Chunked rebuild exact'); rebuilt.dispose();
      const untinted = context.original(context.rng, { ...rec, layeredCore: { ...rec.layeredCore, tone: 1 } }, context.idx);
      for (const name of ['position', 'normal', 'uv', 'aWind', 'aRoot']) assert(arrayBytes(near.attributes[name].array).equals(arrayBytes(untinted.geometry.attributes[name].array)), `Tone override only colours: ${name}`);
      let maxToneError = 0;
      for (let v = 0; v < p.count; v++) for (let c = 0; c < 3; c++) {
        const scale = r.getW(v) >= 0.5 ? rec.layeredCore.tone : 1;
        const error = Math.abs(near.attributes.color.array[v * 3 + c] - untinted.geometry.attributes.color.array[v * 3 + c] * scale);
        maxToneError = Math.max(maxToneError, error);
      }
      assert(maxToneError < 1e-7, 'Authored0.6/0.6/0.85 tone is local to leaf RGB'); untinted.geometry.dispose();
      return { ...row, surfaceAreaM2, floorAreaM2, shootLengthsM, seedSpacingM, floorLocal: rec.floorY ?? null, originY: origin.y, leafCap: expected, authoredEnvelopeWorld: boundsJSON(envelope, origin), physicalWorldBounds: boundsJSON(staticBox, origin), leafWorldBounds: boundsJSON(leafBox, origin), woodWorldBounds: boundsJSON(woodBox, origin), allCurrentFoliageWorldBounds: boundsJSON(far.clone().union(staticBox), origin), analyticWorldBounds: boundsJSON(windBox, origin), minStaticMargin: minMargin.toArray(), minAnalyticMargin: minWindMargin.toArray(), maxExtraWindPerAxis: maxExtra, maxFullWindPerAxis: maxAll, maxVerticalWind: maxVertical, floorWorld: rec.floorY === undefined ? null : rec.floorY + origin.y, maxBranchAnchorGap, maxPetioleToPath, minTriangleArea, maxToneError, retainedTubes: tubes.length, addedParents: tubes.filter(c => c.leavesBefore === 0).length, deterministicRebuild: true, near: { ...row.near, vertices: p.count, bytes: geometryRecord(near).bytes } };
    });
    return { groups, positionsBase64: arrayBytes(pos.array).toString('base64'), origin: origin.toArray() };
  }
}
