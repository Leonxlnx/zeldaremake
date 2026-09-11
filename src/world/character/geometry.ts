/**
 * Small procedural-geometry helpers for the character models. Everything here is generated
 * from numbers (no imported meshes): tapered sweeps along a curve (cap, straps, fringe), lathe
 * profiles with a ragged hem (tunic), and a bulged disc (shield).
 */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, LatheGeometry, Matrix4, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2 } from '../util/prng';

/**
 * Sweep a circle of varying radius along a (smoothed) polyline. `radii` is interpolated over the
 * curve parameter; the frame is parallel-transported so the tube never twists.
 */
export interface SweepOptions {
  segments?: number;
  radial?: number;
  closeTip?: boolean;
  closeStart?: boolean;
  smooth?: boolean;
  /** cross-section scale along the binormal (< 1 flattens the tube, e.g. a cap tail lying on the back) */
  flatten?: number;
  /** Keep a flattened section from the first ring (hair); the default preserves cap roots. */
  flattenFromRoot?: boolean;
  /** Preferred outward thickness direction at the root, for a ribbon following a surface. */
  surfaceNormal?: Vector3;
  /** depth (fraction of the radius) of a groove along the +binormal side (cloth crease) */
  crease?: number;
}

export function sweep(points: Vector3[], radii: number[], opts: SweepOptions = {}): BufferGeometry {
  const segments = opts.segments ?? 24;
  const radial = opts.radial ?? 10;
  const flatten = opts.flatten ?? 1;
  const crease = opts.crease ?? 0;
  const curve = new CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const centres: Vector3[] = [];
  const tangents: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    if (opts.smooth === false) {
      // linear along the polyline
      const f = u * (points.length - 1);
      const k = Math.min(points.length - 2, Math.floor(f));
      const s = f - k;
      centres.push(points[k].clone().lerp(points[k + 1], s));
      tangents.push(points[k + 1].clone().sub(points[k]).normalize());
    } else {
      centres.push(curve.getPoint(u));
      tangents.push(curve.getTangent(u).normalize());
    }
  }
  const radiusAt = (u: number) => {
    const f = u * (radii.length - 1);
    const k = Math.min(radii.length - 2, Math.floor(f));
    const s = f - k;
    return radii[k] * (1 - s) + radii[k + 1] * s;
  };
  // parallel transport frame
  let normal = new Vector3();
  const t0 = tangents[0];
  const helper = Math.abs(t0.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  normal.crossVectors(t0, helper).normalize();
  if (opts.surfaceNormal) {
    const surfaceWidth = new Vector3().crossVectors(opts.surfaceNormal, t0);
    if (surfaceWidth.lengthSq() > 1e-10) normal.copy(surfaceWidth).normalize();
  }
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const binormal = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const tan = tangents[i];
    if (i > 0) {
      // remove the tangent component so the normal stays perpendicular
      normal.addScaledVector(tan, -normal.dot(tan)).normalize();
    }
    binormal.crossVectors(tan, normal).normalize();
    const r = radiusAt(i / segments);
    const c = centres[i];
    // the flattening/crease fade in over the first 40 % of the tube so a tail that starts inside
    // a dome emerges with a plain round section (no groove edge poking through the shell)
    const ramp = opts.flattenFromRoot || (flatten === 1 && crease === 0) ? 1 : Math.min(1, i / segments / 0.4);
    const rampS = ramp * ramp * (3 - 2 * ramp);
    const creaseI = crease * rampS;
    const flattenI = 1 + (flatten - 1) * rampS;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rr = r * (1 - creaseI * Math.pow(Math.max(0, sa), 6));
      const rb = rr * flattenI;
      positions.push(c.x + normal.x * ca * rr + binormal.x * sa * rb, c.y + normal.y * ca * rr + binormal.y * sa * rb, c.z + normal.z * ca * rr + binormal.z * sa * rb);
      uvs.push(i / segments, j / radial);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      const b = a + ring;
      // binormal = tangent × normal, so radial → tangent winds outward.
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  if (opts.closeTip) {
    const c = centres[segments];
    const ci = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    uvs.push(1, 0.5);
    const base = segments * ring;
    for (let j = 0; j < radial; j++) indices.push(base + j, base + j + 1, ci);
  }
  if (opts.closeStart) {
    const c = centres[0];
    const ci = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radial; j++) indices.push(j, ci, j + 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Lathe a (radius, y) profile around Y, optionally scaling X/Z differently (oval torso) and
 * tearing the bottom ring into a ragged hem (deterministic notches).
 */
export interface LatheOptions {
  segments?: number;
  scaleX?: number;
  scaleZ?: number;
  raggedHem?: number;
  seed?: number;
  /** number of soft scallops around the hem (bottom ring lifted between the points) */
  scallops?: number;
  scallopDepth?: number;
  /** number of vertical fold ridges (radius modulation, strongest at the hem, fading upward) */
  folds?: number;
  foldDepth?: number;
}

export function ovalLathe(profile: [number, number][], opts: LatheOptions = {}): BufferGeometry {
  const segments = opts.segments ?? 20;
  const geo = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
  const pos = geo.attributes.position as Float32BufferAttribute;
  const sx = opts.scaleX ?? 1;
  const sz = opts.scaleZ ?? 1;
  const hemY = profile[0][1];
  const topY = profile[profile.length - 1][1];
  const rag = opts.raggedHem ?? 0;
  const seed = opts.seed ?? 7;
  const folds = opts.folds ?? 0;
  const foldDepth = opts.foldDepth ?? 0.04;
  const scallops = opts.scallops ?? 0;
  const scallopDepth = opts.scallopDepth ?? 0.03;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * sx;
    let y = pos.getY(i);
    let z = pos.getZ(i) * sz;
    const atHem = Math.abs(y - hemY) < 1e-5;
    if (folds > 0) {
      const a = Math.atan2(z, x);
      const w = Math.pow(Math.min(1, Math.max(0, (topY - y) / Math.max(1e-6, topY - hemY))), 1.5);
      const f = 1 + foldDepth * w * Math.cos(folds * a + 0.7);
      x *= f;
      z *= f;
    }
    if (scallops > 0 && atHem) {
      const a = Math.atan2(z, x);
      y += scallopDepth * (0.5 - 0.5 * Math.cos(scallops * a));
    }
    if (rag > 0 && atHem) {
      const a = Math.atan2(z, x);
      const k = Math.round(((a + Math.PI) / (Math.PI * 2)) * segments);
      const n = hash2(k, seed, 3);
      // notches: alternate long/short points around the hem
      y += rag * (0.25 + 0.75 * n) * ((k & 1) === 0 ? 1 : 0.15);
      x *= 1 + 0.03 * (n - 0.5);
      z *= 1 + 0.03 * (n - 0.5);
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Disc bulged into a shallow dome (shield face), radius `r`, bulge height `h`, oval scale (sx, sy). */
export function bulgedDisc(r: number, h: number, opts: { segments?: number; rings?: number; sx?: number; sy?: number } = {}): BufferGeometry {
  const segments = opts.segments ?? 28;
  const rings = opts.rings ?? 5;
  const sx = opts.sx ?? 1;
  const sy = opts.sy ?? 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  positions.push(0, 0, h);
  uvs.push(0.5, 0.5);
  for (let i = 1; i <= rings; i++) {
    const f = i / rings;
    const rr = r * f;
    const z = h * (1 - f * f);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * rr * sx, Math.sin(a) * rr * sy, z);
      uvs.push(0.5 + 0.5 * Math.cos(a) * f, 0.5 + 0.5 * Math.sin(a) * f);
    }
  }
  for (let j = 0; j < segments; j++) indices.push(0, 1 + j, 1 + ((j + 1) % segments));
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments;
    const b0 = 1 + i * segments;
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments;
      indices.push(a0 + j, b0 + j, b0 + j1, a0 + j, b0 + j1, a0 + j1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Apply a translation/rotation/scale to a geometry in place (convenience for assembling parts). */
export function place(geo: BufferGeometry, x: number, y: number, z: number, rot?: [number, number, number], scale?: number | [number, number, number]): BufferGeometry {
  const m = new Matrix4();
  if (scale !== undefined) {
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    geo.applyMatrix4(m.makeScale(s[0], s[1], s[2]));
  }
  if (rot) {
    geo.applyMatrix4(m.makeRotationX(rot[0]));
    geo.applyMatrix4(m.makeRotationY(rot[1]));
    geo.applyMatrix4(m.makeRotationZ(rot[2]));
  }
  geo.applyMatrix4(m.makeTranslation(x, y, z));
  return geo;
}

/** Merge same-material parts into one geometry (drops UVs if any part lacks them). */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  const hasUv = parts.every((p) => !!p.attributes.uv);
  if (!hasUv) for (const p of parts) p.deleteAttribute('uv');
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('character: merge failed');
  for (const p of parts) p.dispose();
  return merged;
}

/** Count triangles of a geometry the same way the capture audit does. */
export function triangleCount(geo: BufferGeometry): number {
  const n = geo.index ? geo.index.count : geo.attributes.position?.count ?? 0;
  return Math.floor(n / 3);
}
