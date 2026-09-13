/**
 * Procedural geometry helpers for the structures system: parametric grid surfaces with
 * analytic normals and cell-level holes (trunk walls with doorways, domes, logs), tapered
 * swept tubes along curves (roots, branches, cords, frames), a small merge wrapper and the
 * draw-call consolidation pass that folds a system's static meshes into one mesh per material.
 */
import { type BufferAttribute, BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, type Object3D, Vector3, type Curve } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SurfaceSample {
  position: Vector3;
  uv?: [number, number];
  /** optional per-vertex colour (linear rgb, may exceed 1) */
  color?: [number, number, number];
}

export interface GridSurfaceOptions {
  /** samples along u (around) */
  cols: number;
  /** samples along v (along) */
  rows: number;
  /** u wraps (cylinder/dome). The seam vertices are duplicated for clean UVs. */
  closedU?: boolean;
  /** cells whose centre satisfies this predicate are left open */
  hole?: (u: number, v: number) => boolean;
  /** flip winding / normals */
  flip?: boolean;
  /** finite-difference epsilon in parameter space (defaults to 1/4 cell) */
  eps?: number;
}

/**
 * Build an indexed surface P(u, v), u,v ∈ [0,1], with normals computed analytically from
 * finite differences of P (seam-safe when closedU). `fn` must be continuous in u and v.
 */
export function gridSurface(fn: (u: number, v: number, out: SurfaceSample) => void, opts: GridSurfaceOptions): BufferGeometry {
  const { cols, rows, closedU = false, hole, flip = false } = opts;
  const nu = closedU ? cols + 1 : cols;
  const nv = rows;
  const count = nu * nv;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  let colors: Float32Array | null = null;
  const sample: SurfaceSample = { position: new Vector3() };
  const su: SurfaceSample = { position: new Vector3() };
  const sv: SurfaceSample = { position: new Vector3() };
  const du = new Vector3();
  const dv = new Vector3();
  const n = new Vector3();
  const eu = opts.eps ?? 0.25 / cols;
  const ev = opts.eps ?? 0.25 / rows;
  const wrap = (u: number) => (closedU ? ((u % 1) + 1) % 1 : Math.min(1, Math.max(0, u)));

  for (let j = 0; j < nv; j++) {
    const v = j / (nv - 1);
    for (let i = 0; i < nu; i++) {
      const u = closedU ? i / cols : i / (nu - 1);
      const k = j * nu + i;
      sample.uv = undefined;
      sample.color = undefined;
      fn(wrap(u), v, sample);
      positions[k * 3] = sample.position.x;
      positions[k * 3 + 1] = sample.position.y;
      positions[k * 3 + 2] = sample.position.z;
      if (sample.uv) {
        uvs[k * 2] = sample.uv[0];
        uvs[k * 2 + 1] = sample.uv[1];
      } else {
        uvs[k * 2] = u;
        uvs[k * 2 + 1] = v;
      }
      if (sample.color) {
        if (!colors) colors = new Float32Array(count * 3).fill(1);
        colors[k * 3] = sample.color[0];
        colors[k * 3 + 1] = sample.color[1];
        colors[k * 3 + 2] = sample.color[2];
      }
      // analytic normal via central differences (one-sided at open edges)
      const u0 = closedU ? u - eu : Math.max(0, u - eu);
      const u1 = closedU ? u + eu : Math.min(1, u + eu);
      const v0 = Math.max(0, v - ev);
      const v1 = Math.min(1, v + ev);
      fn(wrap(u0), v, su);
      du.copy(su.position);
      fn(wrap(u1), v, su);
      du.subVectors(su.position, du);
      fn(u, v0, sv);
      dv.copy(sv.position);
      fn(u, v1, sv);
      dv.subVectors(sv.position, dv);
      n.crossVectors(dv, du);
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0);
      else n.normalize();
      if (flip) n.negate();
      normals[k * 3] = n.x;
      normals[k * 3 + 1] = n.y;
      normals[k * 3 + 2] = n.z;
    }
  }

  const index: number[] = [];
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      if (hole) {
        const uc = closedU ? (i + 0.5) / cols : (i + 0.5) / (nu - 1);
        const vc = (j + 0.5) / (nv - 1);
        if (hole(uc, vc)) continue;
      }
      const a = j * nu + i;
      const b = a + 1;
      const c = a + nu;
      const d = c + 1;
      if (flip) index.push(a, b, c, b, d, c);
      else index.push(a, c, b, b, c, d);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if (colors) geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  return geo;
}

export interface SweepOptions {
  /** radius along the curve, t ∈ [0,1] */
  radius: (t: number) => number;
  tubularSegments: number;
  radialSegments: number;
  /** radial displacement in metres, (t, angle 0..2π, world position) */
  displace?: (t: number, angle: number, pos: Vector3) => number;
  /** UV repeat: metres per texture tile along and around */
  uvMetres?: number;
  /** close the end with a fan (default: open) */
  capEnd?: boolean;
  capStart?: boolean;
  /** per-vertex colour */
  color?: (t: number, angle: number) => [number, number, number];
}

/** Tapered tube swept along a curve (roots, branches, cords, frames). */
export function sweepTube(curve: Curve<Vector3>, opts: SweepOptions): BufferGeometry {
  const { tubularSegments: ts, radialSegments: rs, radius, displace, uvMetres = 1 } = opts;
  const frames = curve.computeFrenetFrames(ts, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const p = new Vector3();
  const nrm = new Vector3();
  const pos = new Vector3();
  const length = curve.getLength();
  for (let i = 0; i <= ts; i++) {
    const t = i / ts;
    curve.getPointAt(t, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radius(t);
    for (let j = 0; j <= rs; j++) {
      const a = (j / rs) * Math.PI * 2;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      nrm.set(cx * N.x + sy * B.x, cx * N.y + sy * B.y, cx * N.z + sy * B.z);
      pos.copy(p).addScaledVector(nrm, r);
      const d = displace ? displace(t, a, pos) : 0;
      if (d) pos.addScaledVector(nrm, d);
      positions.push(pos.x, pos.y, pos.z);
      normals.push(nrm.x, nrm.y, nrm.z);
      uvs.push((a / (Math.PI * 2)) * ((2 * Math.PI * Math.max(r, 0.02)) / uvMetres), (t * length) / uvMetres);
      if (opts.color) colors.push(...opts.color(t, a));
    }
  }
  // winding matches the outward normal (N cos a + B sin a): (a+1 - a) × (b - a) = B × T = N
  for (let i = 0; i < ts; i++) {
    for (let j = 0; j < rs; j++) {
      const a = i * (rs + 1) + j;
      const b = a + rs + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if (opts.color) geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  if (displace) geo.computeVertexNormals();
  if (opts.capEnd || opts.capStart) {
    const caps: BufferGeometry[] = [geo];
    if (opts.capEnd) {
      const c = capFan(curve, 1, radius(1), rs, frames.tangents[ts], false);
      if (opts.color) setColorAttribute(c, opts.color(1, 0));
      caps.push(c);
    }
    if (opts.capStart) {
      const c = capFan(curve, 0, radius(0), rs, frames.tangents[0], true);
      if (opts.color) setColorAttribute(c, opts.color(0, 0));
      caps.push(c);
    }
    return merge(caps);
  }
  return geo;
}

/**
 * Flip a surface so its normals face `target` (majority vote). gridSurface orientation depends
 * on the parametrisation; this makes tunnels/soffits face the right way without guesswork.
 */
export function faceTowards(geo: BufferGeometry, target: (pos: Vector3, out: Vector3) => Vector3): BufferGeometry {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const p = new Vector3();
  const n = new Vector3();
  const t = new Vector3();
  let toward = 0;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    target(p, t).sub(p);
    if (n.dot(t) >= 0) toward++;
    else toward--;
  }
  if (toward < 0) {
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
    const idx = geo.index;
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, b);
      }
    }
  }
  return geo;
}

/** Matrix mapping local +Z to `axis` at `origin` (local +Y stays as "up" as possible). */
export function basisMatrix(origin: Vector3, axis: Vector3): Matrix4 {
  const z = axis.clone().normalize();
  const up = Math.abs(z.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const x = new Vector3().crossVectors(up, z).normalize();
  const y = new Vector3().crossVectors(z, x).normalize();
  return new Matrix4().makeBasis(x, y, z).setPosition(origin);
}

function capFan(curve: Curve<Vector3>, t: number, r: number, rs: number, tangent: Vector3, flip: boolean): BufferGeometry {
  const c = curve.getPointAt(t);
  const frames = curve.computeFrenetFrames(1, false);
  const N = t === 0 ? frames.normals[0] : frames.normals[1];
  const B = t === 0 ? frames.binormals[0] : frames.binormals[1];
  const positions: number[] = [c.x, c.y, c.z];
  const normals: number[] = [];
  const uvs: number[] = [0.5, 0.5];
  const nz = tangent.clone().multiplyScalar(flip ? -1 : 1);
  normals.push(nz.x, nz.y, nz.z);
  for (let j = 0; j <= rs; j++) {
    const a = (j / rs) * Math.PI * 2;
    const x = Math.cos(a);
    const y = Math.sin(a);
    positions.push(c.x + (x * N.x + y * B.x) * r, c.y + (x * N.y + y * B.y) * r, c.z + (x * N.z + y * B.z) * r);
    normals.push(nz.x, nz.y, nz.z);
    uvs.push(0.5 + x * 0.5, 0.5 + y * 0.5);
  }
  const index: number[] = [];
  for (let j = 1; j <= rs; j++) {
    if (flip) index.push(0, j + 1, j);
    else index.push(0, j, j + 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  return geo;
}

/** Merge geometries, tolerating heterogeneous attribute sets by dropping non-shared ones. */
export function merge(geos: BufferGeometry[]): BufferGeometry {
  const list = geos.filter((g) => g && g.attributes.position && g.attributes.position.count > 0);
  if (list.length === 0) return new BufferGeometry();
  if (list.length === 1) return list[0];
  const names = Object.keys(list[0].attributes).filter((n) => list.every((g) => g.attributes[n]));
  for (const g of list) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
  const allIndexed = list.every((g) => g.index);
  if (!allIndexed) for (const g of list) if (g.index) g.setIndex(null);
  const out = mergeGeometries(list, false);
  if (!out) throw new Error('structures: mergeGeometries failed');
  return out;
}

/**
 * Fold the static meshes under `root` into one mesh per (material, shadow flags, render flags,
 * vertex layout), so the system costs one draw call per material — in the colour pass and again
 * in the shadow pass — instead of one per part. The result renders identically: the same material
 * instances, the same vertex data concatenated in scene-graph order (which, for identity-transform
 * meshes sharing a material, is the order three.js drew them in), the same flags. Only meshes that
 * are at the identity transform, opaque, single-material and indexed qualify; positioned or
 * animated meshes (lantern pivots), transparent ones (their blend order hangs on the per-object
 * sort key) and anything the caller's `skip` names are left alone, as are singletons. Buckets whose
 * attribute layouts differ are never mixed, so no vertex ever gains or loses an attribute.
 */
export function consolidateStaticMeshes(root: Object3D, skip: (m: Mesh) => boolean = () => false): { before: number; after: number; merged: number } {
  root.updateMatrixWorld(true);
  const identity = new Matrix4();
  const buckets = new Map<string, Mesh[]>();
  let before = 0;
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    before++;
    if (skip(m)) return;
    const mat = m.material;
    if (Array.isArray(mat) || mat.transparent) return;
    if (!m.matrixWorld.equals(identity)) return;
    const g = m.geometry;
    if (!g.index || Object.keys(g.morphAttributes).length > 0) return;
    const layout = Object.keys(g.attributes)
      .sort()
      .map((n) => {
        const a = g.attributes[n] as BufferAttribute;
        return `${n}:${a.itemSize}:${a.array.constructor.name}:${a.normalized ? 1 : 0}`;
      })
      .join(',');
    const key = [mat.uuid, m.customDepthMaterial?.uuid, m.customDistanceMaterial?.uuid, m.castShadow, m.receiveShadow, m.renderOrder, m.layers.mask, m.visible, m.frustumCulled, layout].join('|');
    const list = buckets.get(key);
    if (list) list.push(m);
    else buckets.set(key, [m]);
  });
  let after = before;
  let merged = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geo = mergeGeometries(
      list.map((m) => m.geometry),
      false,
    );
    if (!geo) continue;
    const first = list[0];
    const mesh = new Mesh(geo, first.material);
    mesh.name = `merged:${first.name}`;
    mesh.customDepthMaterial = first.customDepthMaterial;
    mesh.customDistanceMaterial = first.customDistanceMaterial;
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.layers.mask = first.layers.mask;
    mesh.visible = first.visible;
    mesh.frustumCulled = first.frustumCulled;
    for (const m of list) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    root.add(mesh);
    after -= list.length - 1;
    merged++;
  }
  return { before, after, merged };
}

/** Apply a matrix to a geometry (positions + normals) in place and return it. */
export function transformed(geo: BufferGeometry, m: Matrix4): BufferGeometry {
  geo.applyMatrix4(m);
  return geo;
}

/** A quad (two triangles) in local xy plane, optional bend along x to give leaves some body. */
export function quad(w: number, h: number, opts: { bend?: number; segments?: number } = {}): BufferGeometry {
  const seg = opts.segments ?? 1;
  const bend = opts.bend ?? 0;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= 1; j++) {
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const x = (u - 0.5) * w;
      const y = j * h;
      const z = bend * (1 - (2 * u - 1) ** 2) * w * 0.5;
      positions.push(x, y, z);
      normals.push(0, 0, 1);
      uvs.push(u, j);
    }
  }
  for (let i = 0; i < seg; i++) index.push(i, i + 1, i + seg + 1, i + 1, i + seg + 2, i + seg + 1);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  if (bend) geo.computeVertexNormals();
  return geo;
}

/** Fill (or overwrite) a constant per-vertex float attribute. */
export function setFloatAttribute(geo: BufferGeometry, name: string, value: number | ((i: number) => number)): BufferGeometry {
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count);
  for (let i = 0; i < count; i++) arr[i] = typeof value === 'function' ? value(i) : value;
  geo.setAttribute(name, new Float32BufferAttribute(arr, 1));
  return geo;
}

/** Add a constant colour attribute only when the geometry has none (vertexColors materials read black otherwise). */
export function ensureColor(geo: BufferGeometry, rgb: [number, number, number] = [1, 1, 1]): BufferGeometry {
  if (!geo.attributes.color) setColorAttribute(geo, rgb);
  return geo;
}

/** Fill a per-vertex colour attribute: a constant, or a function of the vertex index. */
export function setColorAttribute(geo: BufferGeometry, rgb: [number, number, number] | ((i: number) => [number, number, number])): BufferGeometry {
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = typeof rgb === 'function' ? rgb(i) : rgb;
    arr[i * 3] = c[0];
    arr[i * 3 + 1] = c[1];
    arr[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return geo;
}

export const TAU = Math.PI * 2;

/**
 * Signed distance to a rectangle [x0,x1]×[y0,y1] with all four corners rounded by `rc`
 * (negative inside). Used for the openings cut into the house walls.
 */
export function rrectSD(x: number, y: number, x0: number, x1: number, y0: number, y1: number, rc: number): number {
  const r = Math.min(rc, (x1 - x0) / 2, (y1 - y0) / 2);
  const qx = Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - r);
  const qy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Move (x, y) by `e` along the gradient of `sd` (outward for e > 0). */
export function offsetAlongSD(sd: (x: number, y: number) => number, x: number, y: number, e: number): [number, number] {
  const h = 0.005;
  let gx = sd(x + h, y) - sd(x - h, y);
  let gy = sd(x, y + h) - sd(x, y - h);
  const l = Math.hypot(gx, gy);
  if (l < 1e-9) return [x, y];
  gx /= l;
  gy /= l;
  return [x + gx * e, y + gy * e];
}

export interface Outline {
  /** total length */
  length: number;
  /** point at arc-length fraction s ∈ [0,1] */
  at(s: number): [number, number];
}

/**
 * Open outline of an arch-like opening: up the left side from (x0, y0), round the two top
 * corners (radius `rc`), across the top and down the right side to (x1, y0). Arc-length
 * parametrised so a tube or tunnel swept along it has even segments.
 */
export function rrectOutline(x0: number, x1: number, y0: number, y1: number, rc: number): Outline {
  const r = Math.min(rc, (x1 - x0) / 2, y1 - y0);
  const side = y1 - r - y0;
  const top = x1 - x0 - 2 * r;
  const arc = (Math.PI / 2) * r;
  const length = 2 * side + 2 * arc + top;
  const at = (s: number): [number, number] => {
    let l = Math.max(0, Math.min(1, s)) * length;
    if (l <= side) return [x0, y0 + l];
    l -= side;
    if (l <= arc) {
      const ang = Math.PI - (l / arc) * (Math.PI / 2);
      return [x0 + r + Math.cos(ang) * r, y1 - r + Math.sin(ang) * r];
    }
    l -= arc;
    if (l <= top) return [x0 + r + l, y1];
    l -= top;
    if (l <= arc) {
      const ang = Math.PI / 2 - (l / arc) * (Math.PI / 2);
      return [x1 - r + Math.cos(ang) * r, y1 - r + Math.sin(ang) * r];
    }
    l -= arc;
    return [x1, y1 - r - Math.min(l, side)];
  };
  return { length, at };
}

/** signed shortest angular difference in (-π, π] */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}
