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
/**
 * uv contract (round 40): a lamina's u runs 0..1 across the blade with the midrib at 0.5 and v
 * root → tip — the near-camera leaf detail (materials.ts LEAF_DETAIL_FRAGMENT) draws its midrib,
 * veins and gradient from them. Anything that is not a leaf blade (stems, caps, discs, domes,
 * grass blade strips) offsets u by this so the shader leaves it alone; the plant shaders read
 * only v otherwise (windLeaf's flutter grows toward v = 1).
 */
export const NOT_LAMINA = 2;
/**
 * Petal band (round 43): a petal's u runs PETAL_U … PETAL_U + 1 across the lamina (midrib at
 * PETAL_U + 0.5), v root → tip — materials.ts' petal detail (leafDetail: 'petal') gives it the fan
 * veins and the translucency of a petal instead of a leaf's midrib and lateral veins, and the leaf
 * block leaves it alone. Pass it as `uOffset` to the leaf builders.
 */
export const PETAL_U = 4;
/**
 * Broad-lamina band (round 43): the near LOD of a heart / ovate / round leaf runs its u over
 * BROADLEAF_U … BROADLEAF_U + 1 — the leaf block (materials.ts) draws it a hosta's venation at a
 * hosta's strength: a wide pale midrib, six arcing lateral pairs with faint veinlets between, a
 * cupped darker margin and the waxy lit edge, all stronger than the fern-pinna block at u < 1.5.
 */
export const BROADLEAF_U = 6;

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

/**
 * Tapered tube along a polyline with parallel-transported frames (no twist flips on arches).
 * `colorAt(t, up, facet)` (round 40) replaces the default faint root → tip lift with a caller's
 * per-vertex colour: `t` the lengthwise fraction, `up` the vertex's radial direction's local-y
 * component (−1 underside … +1 top) and `facet` its index around the ring — a stem that crosses
 * the lens needs a darker foot, a lit tip and a shaded underside to read as a stem.
 */
export function tube(mesh: MeshBuilder, points: Vector3[], rootRadius: number, tipRadius: number, color: RGB, sides = 4, caps = false, colorAt?: (t: number, up: number, facet: number) => RGB) {
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
    const ringColor = tone(color, 0.92 + t * 0.12);
    for (let k = 0; k < sides; k++) {
      const angle = (k * TAU) / sides;
      const c = Math.cos(angle), s = Math.sin(angle);
      const point = points[j].clone().addScaledVector(a, c * radius).addScaledVector(b, s * radius);
      ring.push(mesh.vertex(point, NOT_LAMINA + k / sides, t, colorAt ? colorAt(t, a.y * c + b.y * s, k) : ringColor));
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
      const center = mesh.vertex(points[end], NOT_LAMINA + 0.5, end ? 1 : 0, color);
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
  /** added to every lamina vertex's u (round 43: PETAL_U marks a petal for the material; default 0, a leaf) */
  uOffset?: number;
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
  const { curl = 0.15, twist = 0, ridge = 0.08, uOffset: u0 = 0 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  side.applyAxisAngle(axis, twist * 0.5);
  const middle = base.clone().addScaledVector(axis, length * 0.5).addScaledVector(normal, length * curl * 0.156 - width * (0.12 + ridge));
  const tip = base.clone().addScaledVector(axis, length).addScaledVector(normal, length * curl * Math.sin(Math.PI * 0.9));
  const a = mesh.vertex(base, u0 + 0.5, 0, color);
  const l = mesh.vertex(middle.clone().addScaledVector(side, -width * 0.5), u0, 0.5, tone(color, 0.96));
  const t = mesh.vertex(tip, u0 + 0.5, 1, options.tipColor ? blend(color, options.tipColor, 0.5) : tone(color, 1.06));
  const r = mesh.vertex(middle.clone().addScaledVector(side, width * 0.5), u0 + 1, 0.5, tone(color, 0.98));
  mesh.tri(a, l, t);
  mesh.tri(a, t, r);
}

/**
 * Four-triangle lamina: base, mid left/centre/right, tip. The centre vertex is raised (midrib),
 * edges droop, the tip curls. Cheap enough for litter and bush foliage at thousands of leaves.
 */
export function curvedLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions = {}) {
  const { curl = 0.15, twist = 0, ridge = 0.1, uOffset: u0 = 0 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const sideAt = side.clone().applyAxisAngle(axis, twist * 0.5);
  const midC = base.clone().addScaledVector(axis, length * 0.5).addScaledVector(normal, length * curl * 0.9);
  const tip = base.clone().addScaledVector(axis, length).addScaledVector(normal, length * curl * Math.sin(Math.PI * 0.9));
  const tipColor = options.tipColor ? blend(color, options.tipColor, 0.55) : tone(color, 1.05);
  const a = mesh.vertex(base, u0 + 0.5, 0, tone(color, 0.9));
  const l = mesh.vertex(midC.clone().addScaledVector(sideAt, -width * 0.5).addScaledVector(normal, -width * 0.1), u0, 0.5, tone(color, 0.95));
  const c = mesh.vertex(midC.clone().addScaledVector(normal, width * ridge), u0 + 0.5, 0.5, tone(color, 1.07));
  const r = mesh.vertex(midC.clone().addScaledVector(sideAt, width * 0.5).addScaledVector(normal, -width * 0.1), u0 + 1, 0.5, tone(color, 0.97));
  const t = mesh.vertex(tip, u0 + 0.5, 1, tipColor);
  mesh.tri(a, l, c);
  mesh.tri(a, c, r);
  mesh.tri(l, t, c);
  mesh.tri(c, t, r);
}

/**
 * Four-triangle obovate PETAL (round 46, W18): base, shoulders at 0.36 × length (the full width),
 * a second pair at 0.82 × length (0.84 × the width) and a blunt tip — six vertices, the card fills
 * ≈ ⅔ of its length × width box where the diamond laminae (`curvedLeaf`, `foldedLeaf`) fill half,
 * so a ring of these overlaps into a solid rosette. The card cups toward `normal` by `curl`
 * (quadratic, like a real petal's rise from the receptacle), its edges droop `ridge` × width below
 * the midline, and it twists about its own axis. The base vertex is emitted first (the LOD test
 * pins it). The base takes the darker throat tone, the tip the lit `tipColor`. `sections: 3` is
 * the far-LOD card: the same fill from five vertices — shoulders at 0.3, a blunt tip pair at 0.92.
 */
export function petalCard(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions = {}) {
  const { curl = 0.3, twist = 0, ridge = 0.06, uOffset: u0 = 0, sections = 4 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const sideAt = side.clone().applyAxisAngle(axis, twist * 0.5);
  const tipColor = options.tipColor ? blend(color, options.tipColor, 0.55) : tone(color, 1.05);
  const at = (t: number, s: number, w: number) => base.clone().addScaledVector(axis, length * t).addScaledVector(sideAt, width * w * s).addScaledVector(normal, length * curl * t * t - width * ridge * Math.abs(s));
  const a = mesh.vertex(base, u0 + 0.5, 0, tone(color, 0.9));
  if (sections <= 3) {
    const l1 = mesh.vertex(at(0.3, -1, 0.5), u0, 0.3, tone(color, 0.95));
    const r1 = mesh.vertex(at(0.3, 1, 0.5), u0 + 1, 0.3, tone(color, 0.97));
    const l2 = mesh.vertex(at(0.92, -1, 0.35), u0 + 0.15, 0.92, blend(tone(color, 0.98), tipColor, 0.8));
    const r2 = mesh.vertex(at(0.92, 1, 0.35), u0 + 0.85, 0.92, blend(color, tipColor, 0.8));
    mesh.tri(a, l1, r1);
    mesh.tri(l1, l2, r1);
    mesh.tri(r1, l2, r2);
    return;
  }
  const l1 = mesh.vertex(at(0.36, -1, 0.5), u0, 0.36, tone(color, 0.95));
  const r1 = mesh.vertex(at(0.36, 1, 0.5), u0 + 1, 0.36, tone(color, 0.97));
  const l2 = mesh.vertex(at(0.82, -1, 0.42), u0 + 0.08, 0.82, blend(tone(color, 0.98), tipColor, 0.6));
  const r2 = mesh.vertex(at(0.82, 1, 0.42), u0 + 0.92, 0.82, blend(color, tipColor, 0.6));
  const t = mesh.vertex(at(1, 0, 0), u0 + 0.5, 1, tipColor);
  mesh.tri(a, l1, r1);
  mesh.tri(l1, l2, r1);
  mesh.tri(r1, l2, r2);
  mesh.tri(l2, t, r2);
}

/** Tapered lamina with raised midrib, drooping edges and twisted tip (Verdant `lanceLeaf`). */
export function lanceLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions = {}) {
  const { sections = 4, curl = 0.15, twist = 0.0, serration = 0.0, ridge = 0.08, uOffset: u0 = 0 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const rows: number[][] = [];
  const fresh: RGB = options.tipColor ?? tone(color, 1.12);
  for (let j = 0; j <= sections; j++) {
    const t = j / sections;
    const center = base.clone().addScaledVector(axis, length * t).addScaledVector(normal, length * curl * Math.sin(t * Math.PI * 0.9));
    const w = width * 0.5 * Math.pow(Math.sin(t * Math.PI), 0.77) * (1 + serration * (j % 2 ? 1 : -1));
    const leafColor = blend(color, fresh, t * (options.tipColor ? 0.6 : 0.18));
    if (j === 0 || j === sections) {
      rows.push([mesh.vertex(center, u0 + 0.5, t, leafColor)]);
      continue;
    }
    const sideAt = side.clone().applyAxisAngle(axis, twist * t);
    rows.push(
      [-1, 0, 1].map((s) =>
        mesh.vertex(
          center.clone().addScaledVector(sideAt, s * w).addScaledVector(normal, s === 0 ? w * ridge : -w * 0.075),
          u0 + (s + 1) / 2,
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

/**
 * Bipinnate pinna (round 40, the hero crown's near LOD): the lance pinna's outline — same base,
 * direction, length, width, curl and twist, so a LOD switch keeps the frond's silhouette — filled
 * with a lighter midrib strip and `pairs` cupped pinnules either side of it (curvedLeaf: raised
 * centre, drooping edges, curled tip), each pinnule reaching the lance's half-width at its station
 * and swept a little toward the tip. 4 triangles a pinnule + 5 for the strip.
 */
export function pinnateLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions & { pairs?: number; rng: () => number }) {
  const { curl = 0.15, twist = 0.0, ridge = 0.08, pairs = 7, rng } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const fresh: RGB = options.tipColor ?? tone(color, 1.12);
  const centre = (t: number) => base.clone().addScaledVector(axis, length * t).addScaledVector(normal, length * curl * Math.sin(t * Math.PI * 0.9));
  const sideAt = (t: number) => side.clone().applyAxisAngle(axis, twist * t);
  // the midrib: a narrow strip standing proud of the pinnules by the ridge, lighter than the lamina
  const ribColor = tone(color, 1.14);
  const ribRows: number[][] = [];
  for (let j = 0; j < 3; j++) {
    const t = j / 3;
    const hw = width * 0.035 * (1 - 0.55 * t);
    const c = centre(t).addScaledVector(normal, width * ridge * 0.5);
    const s = sideAt(t);
    ribRows.push([mesh.vertex(c.clone().addScaledVector(s, -hw), NOT_LAMINA, t, ribColor), mesh.vertex(c.clone().addScaledVector(s, hw), NOT_LAMINA + 1, t, ribColor)]);
  }
  const ribTip = mesh.vertex(centre(1), NOT_LAMINA + 0.5, 1, blend(ribColor, fresh, 0.3));
  for (let j = 0; j < 2; j++) {
    mesh.tri(ribRows[j][0], ribRows[j][1], ribRows[j + 1][0]);
    mesh.tri(ribRows[j][1], ribRows[j + 1][1], ribRows[j + 1][0]);
  }
  mesh.tri(ribRows[2][0], ribRows[2][1], ribTip);
  // the pinnules: pairs along the rib from just above the base to the tip, their length the
  // lance outline's half-width at the station, their width the station spacing (they nearly touch)
  const spacing = (length * 0.9) / pairs;
  for (let p = 0; p < pairs; p++) {
    const t = 0.07 + (p / (pairs - 1)) * 0.86;
    const reach = width * 0.5 * Math.pow(Math.sin(t * Math.PI), 0.77) * 1.05;
    const stationColor = blend(color, fresh, t * 0.18);
    const s = sideAt(t);
    const c = centre(t);
    for (const sign of [-1, 1]) {
      const origin = c.clone().addScaledVector(s, sign * width * 0.03);
      const dir = s
        .clone()
        .multiplyScalar(sign)
        .addScaledVector(axis, 0.3 + rng() * 0.15)
        .addScaledVector(normal, 0.05 + rng() * 0.1);
      const len = reach * (0.92 + rng() * 0.14);
      curvedLeaf(mesh, origin, dir, len, spacing * (0.8 + rng() * 0.2), tone(stationColor, 0.94 + rng() * 0.12), { curl: 0.3 + rng() * 0.2, ridge: 0.28, twist: sign * (0.1 + rng() * 0.2), planeNormal: normal });
    }
  }
}

/**
 * Skeletonised leaf (round 43, the litter's near LOD): the lamina has rotted away and left the
 * midrib and `pairs` lateral veins — thin strips along the lance outline the whole leaf had (same
 * base, direction, length, width, curl and twist), so a leaf that skeletonises at the LOD swap
 * keeps its footprint. The veins leave the rib at ≈ 50° toward the tip and reach the outline's
 * half-width at their station, drooping a little. Strips carry u ≥ NOT_LAMINA (no lamina detail).
 * 2 triangles a rib segment + 1 at the tip, 2 a vein.
 */
export function skeletonLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions & { pairs?: number; shape?: LeafShape } = {}) {
  const { curl = 0.15, twist = 0, pairs = 6, shape = 'lance' } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const centre = (t: number) => base.clone().addScaledVector(axis, length * t).addScaledVector(normal, length * curl * Math.sin(t * Math.PI * 0.9));
  const sideAt = (t: number) => side.clone().applyAxisAngle(axis, twist * t);
  const tipColor = options.tipColor ?? tone(color, 1.1);
  const ribHalf = width * 0.035;
  const segments = 4;
  const rows: number[][] = [];
  for (let j = 0; j < segments; j++) {
    const t = j / segments;
    const c = centre(t);
    const s = sideAt(t);
    const hw = ribHalf * (1 - 0.5 * t);
    const rc = blend(color, tipColor, t);
    rows.push([mesh.vertex(c.clone().addScaledVector(s, -hw), NOT_LAMINA, t, rc), mesh.vertex(c.clone().addScaledVector(s, hw), NOT_LAMINA + 1, t, rc)]);
  }
  const ribTip = mesh.vertex(centre(1), NOT_LAMINA + 0.5, 1, tipColor);
  for (let j = 0; j < segments - 1; j++) {
    mesh.tri(rows[j][0], rows[j][1], rows[j + 1][0]);
    mesh.tri(rows[j][1], rows[j + 1][1], rows[j + 1][0]);
  }
  mesh.tri(rows[segments - 1][0], rows[segments - 1][1], ribTip);
  for (let p = 0; p < pairs; p++) {
    const t = 0.1 + (p / (pairs - 1)) * 0.75;
    const reach = width * 0.5 * leafOutline(shape, t + 0.08);
    const c = centre(t);
    const s = sideAt(t);
    for (const sign of [-1, 1]) {
      const dir = s.clone().multiplyScalar(sign).addScaledVector(axis, 0.75).addScaledVector(normal, -0.12).normalize();
      const foot = c.clone().addScaledVector(s, sign * ribHalf * 0.5);
      const tip = foot.clone().addScaledVector(dir, reach * 1.15);
      const across = new Vector3().crossVectors(dir, normal).normalize();
      const vc = blend(color, tipColor, t * 0.6);
      const a = mesh.vertex(foot.clone().addScaledVector(across, -ribHalf * 0.6), NOT_LAMINA, t, vc);
      const b = mesh.vertex(foot.clone().addScaledVector(across, ribHalf * 0.6), NOT_LAMINA + 1, t, vc);
      const e = mesh.vertex(tip, NOT_LAMINA + 0.5, Math.min(1, t + 0.15), tone(vc, 1.06));
      mesh.tri(a, b, e);
    }
  }
}

/**
 * Leaf outlines: the three concept-sheet laminae, plus (round 43, the near LODs) `lance` — the
 * lanceLeaf outline, so a litter leaf's ultra lamina keeps the high LOD's footprint —, `petal`
 * (obovate: widest two thirds up, a rounded tip) and `clover` (obcordate: widest three quarters up).
 */
export type LeafShape = 'heart' | 'ovate' | 'round' | 'lance' | 'petal' | 'clover';

export interface ShapedLeafOptions extends LeafOptions {
  shape: LeafShape;
  /** vertices across a row: 3 (far LOD), 5, or 7 (the round-43 ultra laminae) */
  across?: 3 | 5 | 7;
  /** midrib colour (default: a lighter, slightly yellower tone of the lamina) */
  ribColor?: RGB;
  /**
   * vein crease (5-across rows only): the half-way columns sink below the lamina by this fraction
   * of the half-width and darken a little, so the blade reads as two lobes either side of the
   * midrib with lateral veins (round 31: the frames' broad leaves show a crease, not a flat card)
   */
  crease?: number;
  /**
   * cupped margin (round 43): when set, the off-rib columns rise toward the margin by this fraction
   * of the half-width (× the column's squared offset) instead of drooping — a dry litter leaf curls
   * up at its edges, a petal cups toward the bloom's axis. Leaves the default droop / crease alone
   * when undefined.
   */
  cup?: number;
  /**
   * per-vertex colour hook (round 43): `(t, s, rowColor)` with t root → tip and s the column's
   * signed offset (−1 … 1, 0 the midrib); replaces the default rib / margin toning when given, so a
   * builder can bake veins, a chevron or a root → tip gradient into the lamina
   */
  colorAt?: (t: number, s: number, rowColor: RGB) => RGB;
  /** margin undulation (round 43): the odd columns' rows scale their half-width by 1 ± this, a wavy rim */
  wave?: number;
  /** curl profile exponent (round 43): 1 the default sine arc; > 1 keeps the root flat and rolls the tip up (dry litter) */
  curlPow?: number;
}

/** half-width fraction of a leaf outline at 0 ≤ t ≤ 1 along the axis (base → tip) */
export function leafOutline(shape: LeafShape, t: number): number {
  switch (shape) {
    case 'heart':
      // the lobes are already 0.6 wide at the petiole and the blade tapers to a drawn-out tip
      return Math.pow(Math.sin(Math.PI * (0.19 + 0.81 * t)), 0.85);
    case 'round':
      return Math.pow(Math.max(0, 1 - (2 * t - 1) ** 2), 0.55);
    case 'lance':
      return Math.pow(Math.sin(t * Math.PI), 0.77);
    case 'petal':
      return Math.pow(Math.sin(Math.PI * Math.pow(t, 1.6)), 0.6);
    case 'clover':
      return Math.pow(Math.sin(Math.PI * Math.pow(t, 1.9)), 0.5);
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
  const { shape, sections = 5, across = 5, curl = 0.12, twist = 0, ridge = 0.12, serration = 0, crease = 0, cup, colorAt, wave = 0, curlPow = 1, uOffset: u0 = 0 } = options;
  const { axis, side, normal } = leafFrame(direction, options.planeNormal);
  const rib: RGB = options.ribColor ?? [color[0] * 1.2 + 0.03, color[1] * 1.18 + 0.03, color[2] * 1.05];
  const tipColor: RGB = options.tipColor ?? tone(color, 1.06);
  const cols = across === 3 ? [-1, 0, 1] : across === 7 ? [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1] : [-1, -0.5, 0, 0.5, 1];
  const notch = shape === 'heart' ? 0.16 : 0;
  const rows: number[][] = [];
  for (let j = 0; j <= sections; j++) {
    const t = j / sections;
    // a serrated rim: alternate rows step in and out (the base and tip rows keep the outline)
    const tooth = j > 0 && j < sections ? 1 + serration * (j % 2 ? 1 : -1) : 1;
    const w = width * 0.5 * leafOutline(shape, t) * tooth;
    // curlPow > 1 holds the blade flat over its root and rolls the tip up (a dry leaf's curl)
    const centre = base.clone().addScaledVector(axis, length * t).addScaledVector(normal, length * curl * (curlPow === 1 ? Math.sin(t * Math.PI * 0.9) : Math.pow(t, curlPow)));
    const rowColor = blend(color, tipColor, t * 0.5);
    if (j === sections || (j === 0 && notch === 0)) {
      rows.push([mesh.vertex(centre, u0 + 0.5, t, colorAt ? colorAt(t, 0, rowColor) : rowColor)]);
      continue;
    }
    const sideAt = side.clone().applyAxisAngle(axis, twist * t);
    rows.push(
      cols.map((s) => {
        const a = Math.abs(s);
        // lobes sweep back behind the petiole; edges droop, the midrib stands proud, the
        // half-way columns sink into the vein crease (or the whole margin cups upward)
        const back = notch * length * Math.pow(1 - t, 3) * Math.sqrt(a);
        const lift = s === 0 ? w * ridge : cup !== undefined ? w * cup * a * a : a < 0.75 ? -w * (0.05 + crease) : -w * 0.14;
        // the wavy rim: the odd rows' margins step in, the even ones out (only where asked)
        const ripple = wave && a > 0.6 ? 1 + wave * (j % 2 ? -1 : 1) * (a - 0.6) / 0.4 : 1;
        const p = centre.clone().addScaledVector(sideAt, s * w * ripple).addScaledVector(axis, -back).addScaledVector(normal, lift);
        const c = colorAt ? colorAt(t, s, rowColor) : s === 0 ? blend(rowColor, rib, 0.75) : tone(rowColor, a < 0.75 ? 1.0 - crease * 0.6 : 0.94);
        return mesh.vertex(p, u0 + (s + 1) / 2, t, c);
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

/**
 * Grass blade as a ribbon along a polyline (root first): two side vertices per row, the width
 * tapering from `width` at the root to a point at the tip, a slight fold down the middle (the
 * sides drop below the spine) so the two faces shade differently. The blade's plane faces the
 * direction the polyline leans away from the tuft centre (`facing`), like the grass shader's
 * blades. 2 × (rows − 1) + 1 triangles.
 */
export function bladeStrip(mesh: MeshBuilder, points: Vector3[], width: number, facing: Vector3, color: RGB, tipColor: RGB = tone(color, 1.08), fold = 0.25) {
  const n = points.length;
  const rows: number[][] = [];
  for (let j = 0; j < n - 1; j++) {
    const t = j / (n - 1);
    const tangent = points[Math.min(j + 1, n - 1)].clone().sub(points[Math.max(j - 1, 0)]).normalize();
    let sideV = new Vector3().crossVectors(facing, tangent);
    if (sideV.lengthSq() < 1e-8) sideV = new Vector3().crossVectors(UP, tangent);
    sideV.normalize();
    const normal = new Vector3().crossVectors(tangent, sideV).normalize();
    const w = width * 0.5 * (1 - t * 0.85);
    const c = blend(color, tipColor, t);
    const drop = w * fold;
    rows.push([
      mesh.vertex(points[j].clone().addScaledVector(sideV, -w).addScaledVector(normal, -drop), NOT_LAMINA, t, tone(c, 0.94)),
      mesh.vertex(points[j].clone().addScaledVector(sideV, w).addScaledVector(normal, -drop), NOT_LAMINA + 1, t, tone(c, 0.98)),
    ]);
  }
  const tip = mesh.vertex(points[n - 1], NOT_LAMINA + 0.5, 1, tipColor);
  for (let j = 0; j < rows.length - 1; j++) {
    mesh.tri(rows[j][0], rows[j][1], rows[j + 1][0]);
    mesh.tri(rows[j][1], rows[j + 1][1], rows[j + 1][0]);
  }
  const last = rows[rows.length - 1];
  mesh.tri(last[0], last[1], tip);
}

/**
 * Revolved profile (round 43, the near LODs): `profile(t)` gives the radius and the height along
 * `dir` for t = 0 (foot) … 1 (top), `rings` + 1 rows of `sides` vertices around the axis, the two
 * ends closed with a centre vertex. Buds, teardrops, stamen bosses, acorns and seed pods are all
 * this with a different profile. `colorAt(t, facet)` bakes the per-vertex colour (default `color`).
 */
export function lathe(mesh: MeshBuilder, base: Vector3, dir: Vector3, profile: (t: number) => { r: number; y: number }, rings: number, sides: number, color: RGB, colorAt?: (t: number, facet: number) => RGB) {
  const axis = dir.clone().normalize();
  const [a, b] = frame(axis);
  const rows: number[][] = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const { r, y } = profile(t);
    const centre = base.clone().addScaledVector(axis, y);
    const row: number[] = [];
    for (let k = 0; k < sides; k++) {
      const ang = (k * TAU) / sides;
      row.push(mesh.vertex(centre.clone().addScaledVector(a, Math.cos(ang) * r).addScaledVector(b, Math.sin(ang) * r), NOT_LAMINA + k / sides, t, colorAt ? colorAt(t, k) : color));
    }
    rows.push(row);
  }
  for (let j = 0; j < rings; j++) {
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      mesh.tri(rows[j][k], rows[j][n], rows[j + 1][k]);
      mesh.tri(rows[j][n], rows[j + 1][n], rows[j + 1][k]);
    }
  }
  const foot = mesh.vertex(base.clone().addScaledVector(axis, profile(0).y), NOT_LAMINA + 0.5, 0, colorAt ? colorAt(0, 0) : color);
  const top = mesh.vertex(base.clone().addScaledVector(axis, profile(1).y), NOT_LAMINA + 0.5, 1, colorAt ? colorAt(1, 0) : color);
  for (let k = 0; k < sides; k++) {
    const n = (k + 1) % sides;
    mesh.tri(foot, rows[0][n], rows[0][k]);
    mesh.tri(top, rows[rings][k], rows[rings][n]);
  }
}

/**
 * Deterministic smooth value noise on a unit lattice, −1 … 1 (round 43: the moss cushions' lumpy
 * outline — implemented here rather than borrowed from the structures' tufts, per the system
 * boundary). A sine hash on the lattice corners, trilinear between them; the same numbers on
 * every run of the same engine, which is all a build-time geometry needs.
 */
export function valueNoise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const h = (i: number, j: number, k: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const v = lerp(
    lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), sx), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), sx), sy),
    lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), sx), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), sx), sy),
    sz,
  );
  return v * 2 - 1;
}

/** Simple radial fan (flower petal ring, seed head cap). */
export function disc(mesh: MeshBuilder, center: Vector3, normal: Vector3, radius: number, segments: number, color: RGB, edgeColor = color, lift = 0) {
  const [a, b] = frame(normal);
  const c = mesh.vertex(center.clone().addScaledVector(normal, lift), NOT_LAMINA + 0.5, 0.5, color);
  const ring: number[] = [];
  for (let k = 0; k < segments; k++) {
    const ang = (k * TAU) / segments;
    ring.push(mesh.vertex(center.clone().addScaledVector(a, Math.cos(ang) * radius).addScaledVector(b, Math.sin(ang) * radius), NOT_LAMINA + 0.5 + Math.cos(ang) * 0.5, 0.5 + Math.sin(ang) * 0.5, edgeColor));
  }
  for (let k = 0; k < segments; k++) mesh.tri(c, ring[(k + 1) % segments], ring[k]);
}

/** Bumpy low dome (moss tuft). rings × segments, y ∈ [0, height]. */
export function dome(mesh: MeshBuilder, radius: number, height: number, segments: number, rings: number, color: RGB, topColor: RGB, jitter: (i: number) => number) {
  const top = mesh.vertex(V(0, height, 0), NOT_LAMINA + 0.5, 1, topColor);
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
      level.push(mesh.vertex(V(Math.cos(ang) * rr, Math.max(0, y), Math.sin(ang) * rr), NOT_LAMINA + k / segments, 1 - t, blend(topColor, color, t * t)));
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
