/**
 * Geometry writer + botanical primitives shared by every tree builder.
 * Derived from Verdant Forest by Leonxlnx (github.com/Leonxlnx/verdant-forest, app/forest/trees.js),
 * ported to TypeScript and extended with per-vertex wind attributes, ring colour callbacks,
 * radius displacement callbacks (gnarled bark) and a below-ground skirt.
 *
 * Contract: geometry-only, metres, +Y up, ground at y = 0 for the tree origin. Leaves are curved
 * laminae (2/4/8 triangles) — never cards or spheres. Vertex colours are linear.
 *
 * Extra attribute `aWind` (vec3): x = stiffness (1 = rigid trunk), y = phase (0..1 per branch/leaf),
 * z = leaf flutter amount (0 for wood, scaled along the leaf so the base stays attached).
 * Extra attribute `aRoot` (vec4): xyz = the tree's root in the geometry's own space (0 for instanced
 * variants, the tree origin for trees merged into one mesh), w = 1 for leaf vertices, 0 for wood —
 * so bark and leaves share one material and one draw call per variant/LOD.
 */
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const UP = new Vector3(0, 1, 0);
export type Detail = 'high' | 'medium' | 'low';
export type RandomFn = () => number;

export class GeometryWriter {
  positions: number[] = [];
  colors: number[] = [];
  uvs: number[] = [];
  winds: number[] = [];
  roots: number[] = [];
  /** authored normals (NaN = compute from faces); authored entries override the computed ones */
  normals: number[] = [];
  authoredNormals = 0;
  indices: number[] = [];
  seams: [number, number][] = [];
  leafOrdinal = 0;
  leafCount = 0;
  logicalMaxY = 0;
  /** ring vertex indices of the trunk surface (row-major) for surface sampling */
  trunkRows: number[][] = [];

  constructor(public detail: Detail = 'high') {}

  vertex(p: Vector3, color: Color, u = 0, v = 0, stiffness = 1, phase = 0, flutter = 0, leaf = 0): number {
    const i = this.positions.length / 3;
    this.positions.push(p.x, p.y, p.z);
    this.colors.push(color.r, color.g, color.b);
    this.uvs.push(u, v);
    this.winds.push(stiffness, phase, flutter);
    this.roots.push(0, 0, 0, leaf);
    this.normals.push(NaN, NaN, NaN);
    return i;
  }

  /** vertex with an authored normal (e.g. lobe-shaped shading for leaf-cluster cards) */
  vertexN(p: Vector3, normal: Vector3, color: Color, u: number, v: number, stiffness: number, phase: number, flutter: number, leaf: number): number {
    const i = this.vertex(p, color, u, v, stiffness, phase, flutter, leaf);
    this.normals[i * 3] = normal.x;
    this.normals[i * 3 + 1] = normal.y;
    this.normals[i * 3 + 2] = normal.z;
    this.authoredNormals++;
    return i;
  }

  triangle(a: number, b: number, c: number) {
    this.indices.push(a, b, c);
  }

  get triangles() {
    return this.indices.length / 3;
  }

  finish(name: string): BufferGeometry {
    const g = new BufferGeometry();
    g.name = name;
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('aWind', new Float32BufferAttribute(this.winds, 3));
    g.setAttribute('aRoot', new Float32BufferAttribute(this.roots, 4));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    const normals = g.getAttribute('normal');
    if (this.authoredNormals) {
      for (let i = 0; i < normals.count; i++) {
        const nx = this.normals[i * 3];
        if (nx === nx) normals.setXYZ(i, nx, this.normals[i * 3 + 1], this.normals[i * 3 + 2]);
      }
    }
    const n = new Vector3();
    for (const [a, b] of this.seams) {
      n.set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b), normals.getZ(a) + normals.getZ(b)).normalize();
      normals.setXYZ(a, n.x, n.y, n.z);
      normals.setXYZ(b, n.x, n.y, n.z);
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** Merge finished parts (wood + leaves) into one geometry; the parts are disposed. */
export function mergeParts(name: string, parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts.filter((p) => p.getAttribute('position').count > 0), false);
  if (!merged) throw new Error(`trees: nothing to merge for ${name}`);
  merged.name = name;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  for (const p of parts) p.dispose();
  return merged;
}

export function sample(points: Vector3[], t: number): Vector3 {
  const f = Math.max(0, Math.min(1, t)) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  return points[i].clone().lerp(points[i + 1], f - i);
}

export function tangent(points: Vector3[], t: number): Vector3 {
  return sample(points, Math.min(1, t + 0.02)).sub(sample(points, Math.max(0, t - 0.02))).normalize();
}

export function frame(axis: Vector3): [Vector3, Vector3] {
  const reference = Math.abs(axis.y) < 0.92 ? UP : new Vector3(0, 0, 1);
  const u = new Vector3().crossVectors(axis, reference).normalize();
  return [u, new Vector3().crossVectors(axis, u).normalize()];
}

/** stiffness for the branch wind layer from the local wood radius */
export function stiffnessFor(radius: number): number {
  return Math.min(1, Math.max(0.08, Math.sqrt(radius / 0.1)));
}

export interface TubeOptions {
  /** ring colour: constant or per-ring callback (point, t along path) */
  color: Color | ((point: Vector3, t: number) => Color);
  /** cross-section ridge roughness (0 = perfect circle) */
  roughness?: number;
  /** extra multiplicative radius displacement (angle, distanceAlong, t) — for gnarled trunks */
  bump?: (angle: number, distance: number, t: number) => number;
  /** metres of bark texture per tile (u wraps around the circumference in whole tiles) */
  barkTile?: number;
  /** stiffness override per ring (defaults from radius) */
  stiffness?: (radius: number, t: number) => number;
  /** wind phase for this branch */
  phase?: number;
  /** keep the first ring horizontal at its own y (ground ring / skirt ring) */
  flatBase?: boolean;
  /** record the rows as trunk surface rows for later surface sampling */
  isTrunk?: boolean;
  /** never drop at low LOD (used by the trunk and structural limbs) */
  structural?: boolean;
  /** darken the vertex colour inside bump crevices (multiplier on (bump - 1)); needs `bump` */
  creviceShade?: number;
}

/** Sweep a tapered ring mesh along `points`. Frame is transported to avoid angular seams. */
export function tube(writer: GeometryWriter, points: Vector3[], radii: number[], sidesIn: number, rng: RandomFn, opts: TubeOptions): number[][] {
  const roughness = opts.roughness ?? 0;
  for (let i = 0; i < points.length; i++) writer.logicalMaxY = Math.max(writer.logicalMaxY, points[i].y + radii[i] * 1.25);
  let u: Vector3 | undefined;
  let distance = 0;
  const rows: number[][] = [];
  const phase = rng() * TAU;
  const windPhase = opts.phase ?? rng();
  const originalSides = sidesIn;
  let sides = sidesIn;
  // Draw the same random values at every LOD so branch/leaf placement is stable.
  const grain = Array.from({ length: originalSides }, () => 0.9 + rng() * 0.2);
  if (!opts.structural) {
    // sub-pixel twigs do not merit wood triangles at the distance LODs (leaves on them are kept)
    if (writer.detail === 'low' && radii[0] < 0.012) return [];
    if (writer.detail === 'medium' && radii[0] < 0.004) return [];
  }
  if (writer.detail === 'medium') sides = Math.max(3, Math.ceil(sides * 0.72));
  if (writer.detail === 'low') sides = Math.max(3, Math.ceil(sides * 0.5));
  const step = writer.detail === 'high' || opts.structural ? 1 : 2;
  let previousRow: number[] | null = null;
  const circumference = TAU * radii[0];
  const tile = opts.barkTile ?? 0.7;
  const uTiles = Math.max(1, Math.round(circumference / tile));
  const v = new Vector3();
  const p = new Vector3();
  for (let k = 0; k < points.length; k++) {
    if (k) distance += points[k].distanceTo(points[k - 1]);
    if (k % step !== 0 && k !== points.length - 1) continue;
    const t = k / (points.length - 1);
    const axis = points[Math.min(points.length - 1, k + 1)].clone().sub(points[Math.max(0, k - 1)]).normalize();
    if (!u) u = frame(axis)[0];
    else {
      u.addScaledVector(axis, -u.dot(axis));
      if (u.lengthSq() < 0.01) u = frame(axis)[0];
      u.normalize();
    }
    v.crossVectors(axis, u).normalize();
    const row: number[] = [];
    const ringColor = typeof opts.color === 'function' ? opts.color(points[k], t) : opts.color;
    const stiffness = opts.stiffness ? opts.stiffness(radii[k], t) : stiffnessFor(radii[k]);
    for (let j = 0; j <= sides; j++) {
      const angle = ((j % sides) / sides) * TAU;
      let ridge = 1 + roughness * (0.6 * Math.sin(angle * 5 + phase) + 0.28 * Math.sin(angle * 9 - phase) + 0.12 * Math.sin(k * 1.3 + angle * 3));
      let crevice = 1;
      if (opts.bump) {
        const b = opts.bump(angle, distance, t);
        ridge *= b;
        if (opts.creviceShade) crevice = Math.max(0.55, Math.min(1.15, 1 + opts.creviceShade * (b - 1)));
      }
      const r = radii[k] * ridge;
      p.copy(points[k]).addScaledVector(u, Math.cos(angle) * r).addScaledVector(v, Math.sin(angle) * r);
      if (k === 0 && opts.flatBase) p.y = points[0].y;
      const shade = crevice * grain[Math.floor(((j % sides) / sides) * originalSides)] * (0.96 + 0.045 * Math.sin(k * 1.14 + phase));
      row.push(writer.vertex(p, ringColor.clone().multiplyScalar(shade), (j / sides) * uTiles, distance / tile, stiffness, windPhase, 0));
    }
    writer.seams.push([row[0], row[sides]]);
    if (previousRow) {
      for (let j = 0; j < sides; j++) {
        writer.triangle(previousRow[j], previousRow[j + 1], row[j]);
        writer.triangle(previousRow[j + 1], row[j + 1], row[j]);
      }
    }
    rows.push(row);
    previousRow = row;
  }
  // Tiny but nonzero tips are capped. The base is inside its parent branch.
  if (writer.detail === 'high' || radii[0] > 0.007) {
    const end = rows[rows.length - 1];
    const tipColor = typeof opts.color === 'function' ? opts.color(points[points.length - 1], 1) : opts.color;
    const stiffness = opts.stiffness ? opts.stiffness(radii[radii.length - 1], 1) : stiffnessFor(radii[radii.length - 1]);
    const cap = writer.vertex(points[points.length - 1], tipColor, 0.5, distance / tile, stiffness, windPhase, 0);
    for (let j = 0; j < sides; j++) writer.triangle(cap, end[j], end[j + 1]);
  }
  if (opts.isTrunk) writer.trunkRows = rows;
  return rows;
}

export function taper(points: Vector3[], radius: number, terminal = 0.004, power = 1.1): number[] {
  return points.map((_, i) => terminal + (radius - terminal) * Math.pow(1 - i / (points.length - 1), power));
}

/** A tortuous woody axis between two growth targets, continuing its parent. */
export function growthPath(origin: Vector3, target: Vector3, parentDirection: Vector3, rng: RandomFn, segments = 8, tortuosity = 1): Vector3[] {
  const displacement = target.clone().sub(origin);
  const length = displacement.length();
  const direction = displacement.clone().normalize();
  const [side, bend] = frame(direction);
  const outgoing = parentDirection.clone().normalize().lerp(direction, 0.42).normalize();
  const a = origin.clone().addScaledVector(outgoing, length * 0.19);
  const b = origin
    .clone()
    .lerp(target, 0.45)
    .addScaledVector(side, (rng() - 0.5) * length * 0.28 * tortuosity)
    .addScaledVector(bend, (rng() - 0.46) * length * 0.14 * tortuosity);
  const c = origin
    .clone()
    .lerp(target, 0.76)
    .addScaledVector(side, (rng() - 0.5) * length * 0.23 * tortuosity)
    .addScaledVector(bend, (rng() - 0.4) * length * 0.12 * tortuosity);
  const curve = new CatmullRomCurve3([origin.clone(), a, b, c, target.clone()], false, 'centripetal');
  const points = curve.getSpacedPoints(segments);
  points[0].copy(origin);
  points[points.length - 1].copy(target);
  return points;
}

/** Competing stems must diverge; tortuous boughs may branch from them later. */
export function divergingLeaderPath(origin: Vector3, target: Vector3, rng: RandomFn, segments = 20): Vector3[] {
  const horizontal = target.clone().sub(origin);
  horizontal.y = 0;
  const distance = horizontal.length();
  horizontal.normalize();
  const side = new Vector3(-horizontal.z, 0, horizontal.x);
  const initialOutward = 0.45 + rng() * 0.28;
  const verticalBow = (rng() - 0.5) * 0.03;
  const lateralBow = (rng() - 0.5) * 0.012;
  const upperBow = (rng() - 0.5) * 0.006;
  const points: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const radial = distance * (initialOutward * t + (1 - initialOutward) * t * t);
    const point = origin.clone().addScaledVector(horizontal, radial).addScaledVector(side, distance * lateralBow * Math.sin(t * Math.PI));
    point.y = origin.y + (target.y - origin.y) * (t + verticalBow * Math.sin(t * Math.PI) + upperBow * Math.sin(t * TAU));
    points.push(point);
  }
  points[0].copy(origin);
  points[points.length - 1].copy(target);
  return points;
}

/**
 * Broad buttress that sits on the ground and merges into the trunk flare. `groundAt` returns the
 * local ground height under a local (x, z) so the buttress follows sloping terrain exactly.
 */
export function rootButtress(
  writer: GeometryWriter,
  angle: number,
  length: number,
  width: number,
  height: number,
  color: Color,
  rng: RandomFn,
  groundAt: (x: number, z: number) => number = () => 0,
  origin = new Vector3(),
  segments = 7,
): Vector3 {
  const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const rows: number[][] = [];
  const bend = (rng() - 0.5) * 0.38;
  let tip = origin.clone();
  for (let k = 0; k < segments; k++) {
    const t = k / (segments - 1);
    const center = origin.clone().add(forward.clone().multiplyScalar(length * t)).addScaledVector(side, Math.sin(t * 2.5) * bend * length * 0.4);
    const w = width * Math.pow(1 - t, 1.35) + 0.008;
    const h = height * Math.pow(1 - t, 2.05) + 0.005;
    const row: number[] = [];
    for (let j = 0; j <= 6; j++) {
      const theta = (j / 6) * Math.PI;
      const p = center.clone().addScaledVector(side, Math.cos(theta) * w);
      const g = groundAt(p.x, p.z);
      // edges are sunk slightly below the ground so the join never shows a gap on rough terrain
      p.y = j === 0 || j === 6 ? g - 0.03 : g + Math.sin(theta) * h;
      row.push(writer.vertex(p, color.clone().multiplyScalar(0.81 + 0.16 * Math.sin(theta)), j / 6, (length * t) / 1.8, 1, 0, 0));
    }
    if (k) {
      for (let j = 0; j < 6; j++) {
        writer.triangle(rows[k - 1][j], row[j], rows[k - 1][j + 1]);
        writer.triangle(rows[k - 1][j + 1], row[j], row[j + 1]);
      }
    }
    rows.push(row);
    if (k === segments - 1) tip = center.clone().setY(groundAt(center.x, center.z));
  }
  return tip;
}

export interface LeafOptions {
  /** width / length */
  widthRatio: number;
  /** birch-like (widest near the base) vs oak-like */
  wideFirst: number;
  wideSecond: number;
  /** stiffness of the carrying twig (wind layer 2) */
  stiffness: number;
  /** flutter amplitude in metres at the tip */
  flutter: number;
  /** force a triangle budget per lamina ('high' = 8, 'medium' = 4, 'low' = 2) */
  detailOverride?: Detail;
  /** LOD retention: keep every Nth leaf at medium/low and enlarge (defaults 4/1.8, 8/2.6) */
  mediumEvery?: number;
  lowEvery?: number;
  mediumScale?: number;
  lowScale?: number;
  tipColor?: Color;
}

/**
 * One curved leaf lamina with a raised midrib, cup and twist. Distant LODs select stable subsets
 * of the seeded population and widen the retained laminae so crown coverage stays constant.
 */
export function addLeaf(writer: GeometryWriter, base: Vector3, direction: Vector3, sizeIn: number, color: Color, rng: RandomFn, o: LeafOptions, build = true): boolean {
  const ordinal = writer.leafOrdinal++;
  const mediumEvery = o.mediumEvery ?? 4;
  const lowEvery = o.lowEvery ?? 8;
  const retained = writer.detail === 'high' || (writer.detail === 'medium' ? ordinal % mediumEvery === 0 : ordinal % lowEvery === 0);
  // a 12 cm leaf is ~10 px at the nearest viewing distance: 8-triangle laminae only on every 4th leaf
  let leafDetail: Detail = writer.detail === 'high' ? (ordinal % 4 === 0 ? 'high' : 'medium') : writer.detail === 'medium' ? 'medium' : 'low';
  if (o.detailOverride) leafDetail = writer.detail === 'high' ? o.detailOverride : leafDetail;
  const size = sizeIn * (writer.detail === 'medium' ? o.mediumScale ?? 1.8 : writer.detail === 'low' ? o.lowScale ?? 2.6 : 1);
  const forward = direction.clone().normalize();
  // Most laminae face the sky, while the roll and pitch retain oblique leaves.
  const side = new Vector3().crossVectors(UP, forward);
  if (side.lengthSq() < 0.015) side.set(1, 0, 0);
  side.normalize().applyAxisAngle(forward, (rng() - 0.5) * 1.8);
  const normal = new Vector3().crossVectors(forward, side).normalize();
  const twist = (rng() - 0.5) * 0.42;
  const cup = size * (0.045 + rng() * 0.075);
  const curve = size * (rng() * 0.2 - 0.045);
  const width = size * o.widthRatio;
  const phase = rng();
  const localPoint = (s: number, t: number) =>
    base
      .clone()
      .addScaledVector(forward, size * t)
      .addScaledVector(side, s * width * 0.5)
      .addScaledVector(normal, curve * t * t + cup * (1 - Math.abs(s)) * Math.sin(t * Math.PI) + s * twist * size * t);
  const leafColor = color.clone().multiplyScalar(0.8 + rng() * 0.38);
  const tipColor = leafColor.clone().lerp(o.tipColor ?? new Color('#7d8f4a'), 0.08 + rng() * 0.14);
  // `build` false: the lamina was culled (sun corridor) after its draws, so the stream stays aligned
  if (!retained || !build) return false;
  writer.leafCount++;
  writer.logicalMaxY = Math.max(writer.logicalMaxY, base.y + size * 1.2);
  const st = o.stiffness;
  const fl = o.flutter;
  const V = (p: Vector3, c: Color, u: number, v: number) => writer.vertex(p, c, u, v, st, phase, fl * v, 1);
  if (leafDetail !== 'high') {
    const b = V(base, leafColor, 0.5, 0);
    const l = V(localPoint(-1, 0.43), leafColor, 0, 0.43);
    const r = V(localPoint(1, 0.43), leafColor, 1, 0.43);
    const tip = V(localPoint(0, 1), tipColor, 0.5, 1);
    if (leafDetail === 'medium') {
      const center = V(localPoint(0, 0.43), leafColor.clone().multiplyScalar(1.045), 0.5, 0.43);
      writer.triangle(b, l, center);
      writer.triangle(b, center, r);
      writer.triangle(l, tip, center);
      writer.triangle(center, tip, r);
    } else {
      writer.triangle(b, l, tip);
      writer.triangle(b, tip, r);
    }
    return true;
  }
  const b = V(base, leafColor, 0.5, 0);
  const l1 = V(localPoint(-o.wideFirst, 0.34), leafColor, 0, 0.34);
  const c1 = V(localPoint(0, 0.34), leafColor.clone().multiplyScalar(1.045), 0.5, 0.34);
  const r1 = V(localPoint(o.wideFirst, 0.34), leafColor, 1, 0.34);
  const l2 = V(localPoint(-o.wideSecond, 0.73), tipColor, 0.15, 0.73);
  const c2 = V(localPoint(0, 0.73), tipColor.clone().multiplyScalar(1.025), 0.5, 0.73);
  const r2 = V(localPoint(o.wideSecond, 0.73), tipColor, 0.85, 0.73);
  const tip = V(localPoint(0, 1), tipColor, 0.5, 1);
  writer.triangle(b, l1, c1);
  writer.triangle(b, c1, r1);
  writer.triangle(l1, l2, c1);
  writer.triangle(l2, c2, c1);
  writer.triangle(c1, c2, r1);
  writer.triangle(c2, r2, r1);
  writer.triangle(l2, tip, c2);
  writer.triangle(c2, tip, r2);
  return true;
}

export const between = (rng: RandomFn, a: number, b: number) => a + (b - a) * rng();
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
