/**
 * Procedural geometry kit for the vegetation system.
 * Derived from Verdant Forest by Leonxlnx (app/forest/understory.js, botanical-refinement.js),
 * ported to TypeScript and trimmed for instanced triangle budgets.
 *
 * All colours are linear RGB (ready for a white `vertexColors` material). Leaf surfaces are
 * genuinely non-planar (raised midrib, drooping edges, curled tips) so they read as laminae
 * rather than cards even without textures.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';

export type RGB = [number, number, number];

export const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);

export const rgb = (hex: number): RGB => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};
export const blend = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const tone = (a: RGB, m: number): RGB => [a[0] * m, a[1] * m, a[2] * m];
export const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export class MeshBuilder {
  p: number[] = [];
  uv: number[] = [];
  c: number[] = [];
  i: number[] = [];

  vertex(p: Vector3, u: number, v: number, c: RGB): number {
    const index = this.p.length / 3;
    this.p.push(p.x, p.y, p.z);
    this.uv.push(u, v);
    this.c.push(c[0], c[1], c[2]);
    return index;
  }

  tri(a: number, b: number, c: number) {
    this.i.push(a, b, c);
  }

  get triangles() {
    return this.i.length / 3;
  }

  /** Lowest vertex becomes y = 0 when `groundToZero` so instances seat exactly on the terrain. */
  finish(opts: { groundToZero?: boolean; scale?: number } = {}): BufferGeometry {
    const scale = opts.scale ?? 1;
    let lowest = 0;
    if (opts.groundToZero) {
      lowest = Infinity;
      for (let k = 1; k < this.p.length; k += 3) lowest = Math.min(lowest, this.p[k]);
    }
    for (let k = 0; k < this.p.length; k += 3) {
      this.p[k] *= scale;
      this.p[k + 1] = (this.p[k + 1] - lowest) * scale;
      this.p[k + 2] *= scale;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

function frame(tangent: Vector3): [Vector3, Vector3] {
  const t = tangent.clone().normalize();
  const reference = Math.abs(t.y) > 0.92 ? V(1, 0, 0) : UP;
  const a = new Vector3().crossVectors(reference, t).normalize();
  const b = new Vector3().crossVectors(t, a).normalize();
  return [a, b];
}

export function sampleCurve(fn: (t: number) => Vector3, segments: number): Vector3[] {
  return Array.from({ length: segments + 1 }, (_, j) => fn(j / segments));
}

/** Tapered tube along a polyline with parallel-transported frames (no twist flips on arches). */
export function tube(mesh: MeshBuilder, points: Vector3[], rootRadius: number, tipRadius: number, color: RGB, sides = 4, caps = false) {
  const rings: number[][] = [];
  let previousA: Vector3 | undefined;
  for (let j = 0; j < points.length; j++) {
    const tangent = points[Math.min(j + 1, points.length - 1)].clone().sub(points[Math.max(j - 1, 0)]).normalize();
    let a = previousA ? previousA.clone().addScaledVector(tangent, -previousA.dot(tangent)) : frame(tangent)[0];
    if (a.lengthSq() < 1e-10) a = frame(tangent)[0];
    a.normalize();
    const b = new Vector3().crossVectors(tangent, a).normalize();
    previousA = a;
    const t = j / (points.length - 1);
    const radius = rootRadius + (tipRadius - rootRadius) * t;
    const ring: number[] = [];
    for (let k = 0; k < sides; k++) {
      const angle = (k * TAU) / sides;
      const point = points[j].clone().addScaledVector(a, Math.cos(angle) * radius).addScaledVector(b, Math.sin(angle) * radius);
      ring.push(mesh.vertex(point, k / sides, t, tone(color, 0.92 + t * 0.12)));
    }
    rings.push(ring);
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let k = 0; k < sides; k++) {
      const next = (k + 1) % sides;
      mesh.tri(rings[j][k], rings[j][next], rings[j + 1][k]);
      mesh.tri(rings[j][next], rings[j + 1][next], rings[j + 1][k]);
    }
  }
  if (caps) {
    for (const end of [0, rings.length - 1]) {
      const center = mesh.vertex(points[end], 0.5, end ? 1 : 0, color);
      const ring = rings[end];
      for (let k = 0; k < sides; k++) {
        const next = (k + 1) % sides;
        if (end === 0) mesh.tri(center, ring[next], ring[k]);
        else mesh.tri(center, ring[k], ring[next]);
      }
    }
  }
}

export interface LeafOptions {
  sections?: number;
  curl?: number;
  twist?: number;
  serration?: number;
  ridge?: number;
  tipColor?: RGB;
  planeNormal?: Vector3;
  /** 0..1 blend to a dry/brown tip colour */
  dry?: number;
}

function leafFrame(direction: Vector3, planeNormal?: Vector3) {
  const axis = direction.clone().normalize();
  let side = new Vector3().crossVectors(planeNormal || UP, axis).normalize();
  if (side.lengthSq() < 1e-8) side = V(1, 0, 0);
  const normal = new Vector3().crossVectors(axis, side).normalize();
  if (!planeNormal && normal.y < 0) {
    normal.negate();
    side.negate();
  }
  return { axis, side, normal };
}

/** Two-triangle lamina with a real central fold (its corners are non-coplanar) — far LOD leaf. */
export function foldedLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions = {}) {
  const { curl = 0.15, twist = 0, ridge = 0.08 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  side.applyAxisAngle(axis, twist * 0.5);
  const middle = base.clone().addScaledVector(axis, length * 0.5).addScaledVector(normal, length * curl * 0.156 - width * (0.12 + ridge));
  const tip = base.clone().addScaledVector(axis, length).addScaledVector(normal, length * curl * Math.sin(Math.PI * 0.9));
  const a = mesh.vertex(base, 0.5, 0, color);
  const l = mesh.vertex(middle.clone().addScaledVector(side, -width * 0.5), 0, 0.5, tone(color, 0.96));
  const t = mesh.vertex(tip, 0.5, 1, options.tipColor ? blend(color, options.tipColor, 0.5) : tone(color, 1.06));
  const r = mesh.vertex(middle.clone().addScaledVector(side, width * 0.5), 1, 0.5, tone(color, 0.98));
  mesh.tri(a, l, t);
  mesh.tri(a, t, r);
}

/**
 * Four-triangle lamina: base, mid left/centre/right, tip. The centre vertex is raised (midrib),
 * edges droop, the tip curls. Cheap enough for litter and bush foliage at thousands of leaves.
 */
export function curvedLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions = {}) {
  const { curl = 0.15, twist = 0, ridge = 0.1 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const sideAt = side.clone().applyAxisAngle(axis, twist * 0.5);
  const midC = base.clone().addScaledVector(axis, length * 0.5).addScaledVector(normal, length * curl * 0.9);
  const tip = base.clone().addScaledVector(axis, length).addScaledVector(normal, length * curl * Math.sin(Math.PI * 0.9));
  const tipColor = options.tipColor ? blend(color, options.tipColor, 0.55) : tone(color, 1.05);
  const a = mesh.vertex(base, 0.5, 0, tone(color, 0.9));
  const l = mesh.vertex(midC.clone().addScaledVector(sideAt, -width * 0.5).addScaledVector(normal, -width * 0.1), 0, 0.5, tone(color, 0.95));
  const c = mesh.vertex(midC.clone().addScaledVector(normal, width * ridge), 0.5, 0.5, tone(color, 1.07));
  const r = mesh.vertex(midC.clone().addScaledVector(sideAt, width * 0.5).addScaledVector(normal, -width * 0.1), 1, 0.5, tone(color, 0.97));
  const t = mesh.vertex(tip, 0.5, 1, tipColor);
  mesh.tri(a, l, c);
  mesh.tri(a, c, r);
  mesh.tri(l, t, c);
  mesh.tri(c, t, r);
}

/** Tapered lamina with raised midrib, drooping edges and twisted tip (Verdant `lanceLeaf`). */
export function lanceLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions = {}) {
  const { sections = 4, curl = 0.15, twist = 0.0, serration = 0.0, ridge = 0.08 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const rows: number[][] = [];
  const fresh: RGB = options.tipColor ?? tone(color, 1.12);
  for (let j = 0; j <= sections; j++) {
    const t = j / sections;
    const center = base.clone().addScaledVector(axis, length * t).addScaledVector(normal, length * curl * Math.sin(t * Math.PI * 0.9));
    const w = width * 0.5 * Math.pow(Math.sin(t * Math.PI), 0.77) * (1 + serration * (j % 2 ? 1 : -1));
    const leafColor = blend(color, fresh, t * (options.tipColor ? 0.6 : 0.18));
    if (j === 0 || j === sections) {
      rows.push([mesh.vertex(center, 0.5, t, leafColor)]);
      continue;
    }
    const sideAt = side.clone().applyAxisAngle(axis, twist * t);
    rows.push(
      [-1, 0, 1].map((s) =>
        mesh.vertex(
          center.clone().addScaledVector(sideAt, s * w).addScaledVector(normal, s === 0 ? w * ridge : -w * 0.075),
          (s + 1) / 2,
          t,
          tone(leafColor, s === 0 ? 1.065 : 0.96),
        ),
      ),
    );
  }
  mesh.tri(rows[0][0], rows[1][0], rows[1][1]);
  mesh.tri(rows[0][0], rows[1][1], rows[1][2]);
  for (let j = 1; j < sections - 1; j++) {
    for (let k = 0; k < 2; k++) {
      mesh.tri(rows[j][k], rows[j + 1][k], rows[j][k + 1]);
      mesh.tri(rows[j][k + 1], rows[j + 1][k], rows[j + 1][k + 1]);
    }
  }
  const last = rows[sections - 1];
  const tip = rows[sections][0];
  mesh.tri(last[0], tip, last[1]);
  mesh.tri(last[1], tip, last[2]);
}

export type LeafShape = 'heart' | 'ovate' | 'round';

export interface ShapedLeafOptions extends LeafOptions {
  shape: LeafShape;
  /** vertices across a row: 3 (far LOD) or 5 */
  across?: 3 | 5;
  /** midrib colour (default: a lighter, slightly yellower tone of the lamina) */
  ribColor?: RGB;
}

/** half-width fraction of a leaf outline at 0 ≤ t ≤ 1 along the axis (base → tip) */
function leafOutline(shape: LeafShape, t: number): number {
  switch (shape) {
    case 'heart':
      // the lobes are already 0.6 wide at the petiole and the blade tapers to a drawn-out tip
      return Math.pow(Math.sin(Math.PI * (0.19 + 0.81 * t)), 0.85);
    case 'round':
      return Math.pow(Math.max(0, 1 - (2 * t - 1) ** 2), 0.55);
    default:
      // ovate: widest a third of the way up, pointed tip
      return Math.pow(Math.sin(Math.PI * Math.pow(t, 0.82)), 0.72);
  }
}

/**
 * Concept-sheet lamina (reference/concepts/01 “Leaves & plants”): heart-shaped Kokiri leaf, broad
 * ovate forest leaf or round ground leaf. `sections` rows of `across` vertices, a raised and
 * lighter midrib down the centre column, drooping edges (waxy convexity), curl along the axis. A
 * heart's base row keeps its full width with the lobes swept back behind the petiole point. The
 * front faces are the upper side (`gl_FrontFacing` selects the glossy top in materials.ts).
 */
export function shapedLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: ShapedLeafOptions) {
  const { shape, sections = 5, across = 5, curl = 0.12, twist = 0, ridge = 0.12 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const rib: RGB = options.ribColor ?? [color[0] * 1.2 + 0.03, color[1] * 1.18 + 0.03, color[2] * 1.05];
  const tipColor: RGB = options.tipColor ?? tone(color, 1.06);
  const cols = across === 3 ? [-1, 0, 1] : [-1, -0.5, 0, 0.5, 1];
  const notch = shape === 'heart' ? 0.16 : 0;
  const rows: number[][] = [];
  for (let j = 0; j <= sections; j++) {
    const t = j / sections;
    const w = width * 0.5 * leafOutline(shape, t);
    const centre = base.clone().addScaledVector(axis, length * t).addScaledVector(normal, length * curl * Math.sin(t * Math.PI * 0.9));
    const rowColor = blend(color, tipColor, t * 0.5);
    if (j === sections || (j === 0 && notch === 0)) {
      rows.push([mesh.vertex(centre, 0.5, t, rowColor)]);
      continue;
    }
    const sideAt = side.clone().applyAxisAngle(axis, twist * t);
    rows.push(
      cols.map((s) => {
        const a = Math.abs(s);
        // lobes sweep back behind the petiole; edges droop, the midrib stands proud
        const back = notch * length * Math.pow(1 - t, 3) * Math.sqrt(a);
        const lift = s === 0 ? w * ridge : -w * (a < 0.75 ? 0.05 : 0.14);
        const p = centre.clone().addScaledVector(sideAt, s * w).addScaledVector(axis, -back).addScaledVector(normal, lift);
        const c = s === 0 ? blend(rowColor, rib, 0.75) : tone(rowColor, a < 0.75 ? 1.0 : 0.94);
        return mesh.vertex(p, (s + 1) / 2, t, c);
      }),
    );
  }
  const n = cols.length;
  let j0 = 0;
  if (rows[0].length === 1) {
    for (let k = 0; k < n - 1; k++) mesh.tri(rows[0][0], rows[1][k], rows[1][k + 1]);
    j0 = 1;
  }
  for (let j = j0; j < sections - 1; j++) {
    for (let k = 0; k < n - 1; k++) {
      mesh.tri(rows[j][k], rows[j + 1][k], rows[j][k + 1]);
      mesh.tri(rows[j][k + 1], rows[j + 1][k], rows[j + 1][k + 1]);
    }
  }
  const last = rows[sections - 1];
  const tip = rows[sections][0];
  for (let k = 0; k < n - 1; k++) mesh.tri(last[k], tip, last[k + 1]);
}

/** Simple radial fan (flower petal ring, seed head cap). */
export function disc(mesh: MeshBuilder, center: Vector3, normal: Vector3, radius: number, segments: number, color: RGB, edgeColor = color, lift = 0) {
  const [a, b] = frame(normal);
  const c = mesh.vertex(center.clone().addScaledVector(normal, lift), 0.5, 0.5, color);
  const ring: number[] = [];
  for (let k = 0; k < segments; k++) {
    const ang = (k * TAU) / segments;
    ring.push(mesh.vertex(center.clone().addScaledVector(a, Math.cos(ang) * radius).addScaledVector(b, Math.sin(ang) * radius), 0.5 + Math.cos(ang) * 0.5, 0.5 + Math.sin(ang) * 0.5, edgeColor));
  }
  for (let k = 0; k < segments; k++) mesh.tri(c, ring[(k + 1) % segments], ring[k]);
}

/** Bumpy low dome (moss tuft). rings × segments, y ∈ [0, height]. */
export function dome(mesh: MeshBuilder, radius: number, height: number, segments: number, rings: number, color: RGB, topColor: RGB, jitter: (i: number) => number) {
  const top = mesh.vertex(V(0, height, 0), 0.5, 1, topColor);
  const levels: number[][] = [];
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    const phi = (t * Math.PI) / 2;
    const level: number[] = [];
    for (let k = 0; k < segments; k++) {
      const ang = (k * TAU) / segments + (r % 2) * (Math.PI / segments);
      const j = 0.82 + 0.36 * jitter(r * 131 + k);
      const rr = radius * Math.sin(phi) * j;
      const y = height * Math.cos(phi) * (0.9 + 0.2 * jitter(r * 17 + k * 3));
      level.push(mesh.vertex(V(Math.cos(ang) * rr, Math.max(0, y), Math.sin(ang) * rr), k / segments, 1 - t, blend(topColor, color, t * t)));
    }
    levels.push(level);
  }
  for (let k = 0; k < segments; k++) mesh.tri(top, levels[0][(k + 1) % segments], levels[0][k]);
  for (let r = 0; r < rings - 1; r++) {
    for (let k = 0; k < segments; k++) {
      const n = (k + 1) % segments;
      mesh.tri(levels[r][k], levels[r][n], levels[r + 1][k]);
      mesh.tri(levels[r][n], levels[r + 1][n], levels[r + 1][k]);
    }
  }
}
