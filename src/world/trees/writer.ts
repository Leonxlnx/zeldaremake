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
 * so bark and leaves share one material and one draw call per variant/LOD. A leaf vertex's w is
 * 0.5 + 0.5 × `leafShade` (1 = an ordinary leaf): the tree shaders read w >= 0.5 as "leaf" and
 * (w − 0.5) × 2 as the share of the shade fill (sky transmission, the flat shade floor) the leaf
 * gets, so an authored mass can be a dark clump against the haze the way the reference's low
 * foliage a few metres from the cameras is. While `leafFlat` is set the leaf's w is 1.5 + 0.5 ×
 * `leafShade` instead (w ≥ 1.25 = a "flat" leaf): the shaders drop the sun from it altogether —
 * the Lambert on its face, the transmission, the specular — and scale what is left by `uFlatLift`,
 * so a lobe of them reads as the reference's deep-shade canopy underside: opaque, dark, and even
 * at the 40 px scale the gauntlet's SSIM windows measure (round 38, materials.ts). While
 * `leafSwapGroup` ≥ 0 the leaf's w is 3 + group instead (w ≥ 2.75 = the far foliage of a
 * near-canopy lobe, giant.ts; the group is the lobe's index within its tree): an ordinary leaf
 * in every shading term that the colour pass drops while the lobe's near version is drawn
 * (round 41, materials.ts uNearCanopy).
 */
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const UP = new Vector3(0, 1, 0);
export type Detail = 'high' | 'medium' | 'low';
export type RandomFn = () => number;

/**
 * A 3-D moss cushion's aRoot.w window (`woodCushion`): (−0.5, −0.47) — under every wood code's
 * −0.45 × cover ≥ −0.45 and over the collapsible codes' ≤ −1, read as wood (< 0.5) everywhere.
 * Within it the anchor's height above the tree's origin (m) is encoded at CUSHION_ROOT_W_PER_M
 * per metre from CUSHION_ROOT_W[0] + a hair (float32 keeps ≈ 3 × 10⁻⁸ here: a 10⁻⁵ m height).
 * The shader (materials.ts CUSHION_ROOT_*) decodes the height for the whole-tree sway, so a
 * cushion whose root is its anchor still moves with the bark ring it sits on.
 */
export const CUSHION_ROOT_W: readonly [number, number] = [-0.5, -0.47];
export const CUSHION_ROOT_W_PER_M = 0.0035;
/** the max height (m) the window encodes: 0.028 / 0.0035 = 8 m (the near bases end at 5) */
export const CUSHION_ROOT_MAX_H = (CUSHION_ROOT_W[1] - CUSHION_ROOT_W[0] - 0.002) / CUSHION_ROOT_W_PER_M;
export const cushionRootW = (heightAboveOrigin: number) => CUSHION_ROOT_W[0] + 0.001 + CUSHION_ROOT_W_PER_M * Math.min(CUSHION_ROOT_MAX_H, Math.max(0, heightAboveOrigin));
export const isCushionRoot = (w: number) => w > CUSHION_ROOT_W[0] && w < CUSHION_ROOT_W[1];

/** floats copied into a packed attribute between two yields of `packSteps` */
export const PACK_FLOATS_PER_STEP = 8192;

/**
 * `new Float32BufferAttribute(values, itemSize)`'s work as a chunked copy. The same float32 conversion of
 * the same values in the same order — `array[k] = values[k]` is what the bulk constructor does per
 * element — so the bytes are identical.
 *
 * It is chunked for the same reason the normals are: measured on a walk, the long chunks left in the
 * builder clustered at the END of every near-canopy lobe's build (indices 56–64 of ~64, 2.5–3.5 ms),
 * which is `finishSteps` packing five attributes of 100–300 k floats in two chunks.
 */
function* packSteps(values: number[], itemSize: number): Generator<void, BufferAttribute> {
  const array = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += PACK_FLOATS_PER_STEP) {
    const end = Math.min(values.length, i + PACK_FLOATS_PER_STEP);
    for (let k = i; k < end; k++) array[k] = values[k];
    if (end < values.length) yield;
  }
  // as in `indexSteps`: `Float32BufferAttribute(array)` would copy the array a second time
  return new BufferAttribute(array, itemSize);
}

/**
 * `BufferGeometry.setIndex(number[])` as a chunked copy, and the last operation of `finishSteps` that
 * was still one call: three picks `Uint16` or `Uint32` by scanning for a value ≥ 65535 (backwards —
 * the largest is usually last, so it normally exits at once) and then copies the whole array.
 */
function* indexSteps(indices: number[]): Generator<void, BufferAttribute> {
  let needs32 = false;
  for (let i = indices.length - 1; i >= 0; i--) {
    if (indices[i] >= 65535) {
      needs32 = true;
      break;
    }
  }
  const array = needs32 ? new Uint32Array(indices.length) : new Uint16Array(indices.length);
  for (let i = 0; i < indices.length; i += PACK_FLOATS_PER_STEP) {
    const end = Math.min(indices.length, i + PACK_FLOATS_PER_STEP);
    for (let k = i; k < end; k++) array[k] = indices[k];
    if (end < indices.length) yield;
  }
  // `BufferAttribute` over the array just filled, rather than `Uint32BufferAttribute(array)` which
  // copies it again; three's own `mergeGeometries` hands back plain `BufferAttribute`s too, and the
  // renderer picks the GL type from `array.constructor`
  return new BufferAttribute(array, 1);
}

/**
 * Triangles accumulated, and vertices normalised, between two yields of `vertexNormalSteps`.
 * Sized so a chunk costs about what one of the relief bole's chunks does (its 4 rings ≈ 800
 * vertices), which is what the rest of a pooled part's build already yields at.
 */
export const VERTEX_NORMAL_FACES_PER_STEP = 1024;
export const VERTEX_NORMAL_VERTICES_PER_STEP = 4096;

/**
 * `BufferGeometry.computeVertexNormals` as a chunked build (lodPool.ts), bit-identical to three's.
 *
 * It is here because three's is ONE call, and `LodPool.work` always runs the first chunk of a
 * frame (its progress guarantee: a build whose chunks all exceed the budget must still advance, or
 * it starves into a synchronous build at its pin). So the longest unsplittable chunk is a floor
 * under the frame's pool time, and measured over 65 real pooled parts this was it — the longest
 * chunk of EVERY part (p50 0.81 ms, max 3.23 ms against the rest of a build's 0.1 ms median, ≈ 13 %
 * of the builder's whole time; `art/environment/squad2-2026-09-23/chunks/`).
 *
 * Identical, not equivalent: the same face loop in the same triangle order, the same `Vector3`
 * methods, and the same accumulate-through-the-Float32Array (read the running normal, add the face
 * normal, round back to float32 with `setXYZ`) three does — a faster float64 accumulator would
 * change the bytes. `writer.test.mjs` pins it against three's own call on real tree geometry.
 */
export function* vertexNormalSteps(geometry: BufferGeometry): Generator<void, void> {
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  if (!position) return;
  // the tree writer always indexes; anything else keeps three's own path rather than a second one
  if (!index) {
    geometry.computeVertexNormals();
    return;
  }
  let normal = geometry.getAttribute('normal') as BufferAttribute | undefined;
  if (normal === undefined || normal.count !== position.count) {
    normal = new BufferAttribute(new Float32Array(position.count * 3), 3);
    geometry.setAttribute('normal', normal);
  } else {
    for (let i = 0, il = normal.count; i < il; i++) normal.setXYZ(i, 0, 0, 0);
  }
  const pA = new Vector3();
  const pB = new Vector3();
  const pC = new Vector3();
  const nA = new Vector3();
  const nB = new Vector3();
  const nC = new Vector3();
  const cb = new Vector3();
  const ab = new Vector3();
  // the loops are plain functions, not the generator's own body: a generator's body is slower per
  // iteration, and this pass must not cost more in total than the one call it replaces
  const faces = (from: number, to: number) => {
    for (let i = from; i < to; i += 3) {
      const vA = index.getX(i + 0);
      const vB = index.getX(i + 1);
      const vC = index.getX(i + 2);
      pA.fromBufferAttribute(position, vA);
      pB.fromBufferAttribute(position, vB);
      pC.fromBufferAttribute(position, vC);
      cb.subVectors(pC, pB);
      ab.subVectors(pA, pB);
      cb.cross(ab);
      nA.fromBufferAttribute(normal!, vA);
      nB.fromBufferAttribute(normal!, vB);
      nC.fromBufferAttribute(normal!, vC);
      nA.add(cb);
      nB.add(cb);
      nC.add(cb);
      normal!.setXYZ(vA, nA.x, nA.y, nA.z);
      normal!.setXYZ(vB, nB.x, nB.y, nB.z);
      normal!.setXYZ(vC, nC.x, nC.y, nC.z);
    }
  };
  const v = new Vector3();
  const unit = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      v.fromBufferAttribute(normal!, i);
      v.normalize();
      normal!.setXYZ(i, v.x, v.y, v.z);
    }
  };
  const faceStep = VERTEX_NORMAL_FACES_PER_STEP * 3;
  for (let i = 0; i < index.count; i += faceStep) {
    faces(i, Math.min(index.count, i + faceStep));
    yield;
  }
  for (let i = 0; i < normal.count; i += VERTEX_NORMAL_VERTICES_PER_STEP) {
    unit(i, Math.min(normal.count, i + VERTEX_NORMAL_VERTICES_PER_STEP));
    if (i + VERTEX_NORMAL_VERTICES_PER_STEP < normal.count) yield;
  }
  normal.needsUpdate = true;
}

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
  /** shade-fill share written into the leaf vertices' aRoot.w while set (1 = ordinary leaves; see the header) */
  leafShade = 1;
  /** while set, leaf vertices are written as "flat" leaves (aRoot.w = 1.5 + 0.5 × leafShade; see the header) */
  leafFlat = false;
  /**
   * while ≥ 0, leaf vertices (laminae and cluster cards alike) are written with aRoot.w = 3 + this
   * value: the far foliage of a near-canopy lobe (giant.ts NearCanopyPart), which the tree shaders
   * collapse in the colour pass while the lobe's near version is drawn (materials.ts uNearCanopy:
   * a slot names the tree's root and this value, as uNearBole names a root). The value is the
   * lobe's index within its tree (< 500, exact in a float). Such a leaf keeps every ordinary
   * term (shade share 1, not flat): every decode reads w ≥ 2.75 as an ordinary leaf. −1 = off.
   * A FLAT leaf in a swap group (round 44, survey #12: the bank canopy's flat lobes at 5–8 m) is
   * written 1000 + group + 0.5 × leafShade instead: the shaders read w ≥ 999 as a flat leaf of
   * that shade share (1.5 + fract(w)) whose swap group is floor(w − 1000), so the far lobe shades
   * exactly as an untagged flat lobe and still folds while its near version is drawn.
   */
  leafSwapGroup = -1;
  /**
   * while set, wood vertices are written with aRoot.w = −1: the far lower bole and roots that the
   * near-bole LOD replaces (materials.ts `uNearBole`): the tree shader collapses them to a point
   * while the tree's near base is drawn, so the plain sweep and the relief bole never overlap.
   * Every decode of aRoot.w (leaf ≥ 0.5, flat ≥ 1.25) still reads −1 as wood.
   */
  woodCollapsible = false;
  /**
   * while set (with `woodCollapsible`), the wood is written with aRoot.w = −2 instead: the plain
   * roots, which a slot in "roots only" mode (uNearBole w < 0, the root-kit test) collapses while
   * the trunk rings (−1) stay. Every other reader treats −2 as −1.
   */
  woodIsRoot = false;
  /**
   * 0–1 moss cover written into a wood vertex's aRoot.w as −0.45 × cover: the tree shader
   * (materials.ts vBarkMoss) lays real moss over the bark there — the vertex colour alone cannot,
   * the dark bark map and the material tint swallow a tint. A COLLAPSIBLE trunk vertex (round 46:
   * a relief column's own lower rings, which its near base replaces at close range) carries the
   * cover as −1 − 0.45 × cover ∈ [−1.45, −1] instead, so the far bole keeps its moss while it is
   * drawn and still folds (< −0.5, and never read as a root: roots are −2 < −1.5). Every decode
   * still reads it as wood (leaf ≥ 0.5).
   */
  woodMoss = 0;
  /**
   * while set, wood vertices are a 3-D moss cushion's (bole.ts mossCushion): aRoot.w in the
   * cushion window (CUSHION_ROOT_W, encoding the anchor's height above the tree's origin — a full
   * moss cover every decode still reads as wood) and aRoot.xyz = this, the cushion's anchor on the
   * bark in local space instead of the tree's root — the tree shader shrinks the cushion onto its
   * anchor as the lens comes within CUSHION_FADE_M of it (materials.ts), so no cushion is ever a
   * polygon across the frame, and sways it by the encoded height so it stays on the bark it sits
   * on. Never collapsible, so nothing else reads the root. Never combined with `woodCollapsible`.
   * Parts translated to world space keep the anchor (index.ts rootsToWorld).
   */
  woodCushion: Vector3 | null = null;

  constructor(public detail: Detail = 'high') {}

  vertex(p: Vector3, color: Color, u = 0, v = 0, stiffness = 1, phase = 0, flutter = 0, leaf = 0): number {
    const i = this.positions.length / 3;
    this.positions.push(p.x, p.y, p.z);
    this.colors.push(color.r, color.g, color.b);
    this.uvs.push(u, v);
    this.winds.push(stiffness, phase, flutter);
    const anchor = leaf > 0 || this.woodCollapsible ? null : this.woodCushion;
    this.roots.push(
      anchor ? anchor.x : 0,
      anchor ? anchor.y : 0,
      anchor ? anchor.z : 0,
      leaf > 0
        ? this.leafSwapGroup >= 0
          ? this.leafFlat
            ? 1000 + this.leafSwapGroup + 0.5 * this.leafShade
            : 3 + this.leafSwapGroup
          : (this.leafFlat ? 1.5 : 0.5) + 0.5 * this.leafShade
        : this.woodCollapsible
          ? this.woodIsRoot
            ? -2
            : -1 - 0.45 * Math.min(1, Math.max(0, this.woodMoss))
          : this.woodCushion
            ? cushionRootW(this.woodCushion.y)
            : -0.45 * Math.min(1, Math.max(0, this.woodMoss)),
    );
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
    const gen = this.finishSteps(name);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
  }

  /**
   * `finish` as a chunked build (lodPool.ts): yields after the attributes are packed, between the
   * chunks of the vertex normals and again after them, so a runtime build's last few milliseconds
   * can straddle frames.
   */
  *finishSteps(name: string): Generator<void, BufferGeometry> {
    const g = new BufferGeometry();
    g.name = name;
    g.setAttribute('position', yield* packSteps(this.positions, 3));
    g.setAttribute('color', yield* packSteps(this.colors, 3));
    g.setAttribute('uv', yield* packSteps(this.uvs, 2));
    yield;
    g.setAttribute('aWind', yield* packSteps(this.winds, 3));
    g.setAttribute('aRoot', yield* packSteps(this.roots, 4));
    g.setIndex(yield* indexSteps(this.indices));
    yield;
    yield* vertexNormalSteps(g);
    yield;
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
export function mergeParts(name: string, parts: BufferGeometry[], useGroups = false): BufferGeometry {
  const merged = mergeGeometries(parts.filter((p) => p.getAttribute('position').count > 0), useGroups);
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
  /**
   * rings whose centre (and radius) this rejects are not built: the sweep breaks there and resumes
   * at the next accepted ring. Random draws are made up front, so a culled tube leaves every later
   * draw where it was.
   */
  cull?: (point: Vector3, radius: number) => boolean;
  /**
   * rings this accepts are written collapsible (GeometryWriter.woodCollapsible: the near-bole LOD
   * replaces them at close range). Bookkeeping only — no draw, no vertex moves.
   */
  collapsible?: (point: Vector3, t: number) => boolean;
  /**
   * the up-front random draws (ridge phase, wind phase, per-side grain) already taken from the
   * stream by `consumeTubeDraws` — the sweep then draws nothing itself. Lets a caller know the
   * ridge phase of a sweep whose ring a near-bole relief has to end on exactly.
   */
  draws?: TubeDraws;
}

/** the draws `tube()` makes up front, in stream order (see bole.ts consumeTubeDraws) */
export interface TubeDraws {
  phase: number;
  windPhase: number;
  grain: number[];
}

/**
 * The cross-section ridge `tube()` writes at ring `k` (its `roughness` fluting): exported so the
 * near-bole relief (bole.ts) can end on exactly the ring the plain sweep continues from.
 */
export const tubeRidge = (roughness: number, angle: number, phase: number, k: number) =>
  1 + roughness * (0.6 * Math.sin(angle * 5 + phase) + 0.28 * Math.sin(angle * 9 - phase) + 0.12 * Math.sin(k * 1.3 + angle * 3));

/** Sweep a tapered ring mesh along `points`. Frame is transported to avoid angular seams. */
export function tube(writer: GeometryWriter, points: Vector3[], radii: number[], sidesIn: number, rng: RandomFn, opts: TubeOptions): number[][] {
  const roughness = opts.roughness ?? 0;
  for (let i = 0; i < points.length; i++) writer.logicalMaxY = Math.max(writer.logicalMaxY, points[i].y + radii[i] * 1.25);
  let u: Vector3 | undefined;
  let distance = 0;
  const rows: number[][] = [];
  const phase = opts.draws ? opts.draws.phase : rng() * TAU;
  const windPhase = opts.phase ?? (opts.draws ? opts.draws.windPhase : rng());
  const originalSides = sidesIn;
  let sides = sidesIn;
  // Draw the same random values at every LOD so branch/leaf placement is stable.
  const grain = opts.draws ? opts.draws.grain : Array.from({ length: originalSides }, () => 0.9 + rng() * 0.2);
  if (!opts.structural) {
    // sub-pixel twigs do not merit wood triangles at the distance LODs (leaves on them are kept)
    if (writer.detail === 'low' && radii[0] < 0.012) return [];
    if (writer.detail === 'medium' && radii[0] < 0.004) return [];
  }
  if (writer.detail === 'medium') sides = Math.max(3, Math.ceil(sides * 0.72));
  if (writer.detail === 'low') sides = Math.max(3, Math.ceil(sides * 0.5));
  const step = writer.detail === 'high' || opts.structural ? 1 : 2;
  let previousRow: number[] | null = null;
  let tipBuilt = false;
  const circumference = TAU * radii[0];
  const tile = opts.barkTile ?? 0.7;
  const uTiles = Math.max(1, Math.round(circumference / tile));
  const v = new Vector3();
  const p = new Vector3();
  for (let k = 0; k < points.length; k++) {
    if (k) distance += points[k].distanceTo(points[k - 1]);
    if (k % step !== 0 && k !== points.length - 1) continue;
    if (opts.cull && opts.cull(points[k], radii[k])) {
      previousRow = null;
      continue;
    }
    tipBuilt = k === points.length - 1;
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
    const wasCollapsible = writer.woodCollapsible;
    if (opts.collapsible) writer.woodCollapsible = opts.collapsible(points[k], t);
    for (let j = 0; j <= sides; j++) {
      const angle = ((j % sides) / sides) * TAU;
      let ridge = tubeRidge(roughness, angle, phase, k);
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
    writer.woodCollapsible = wasCollapsible;
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
  if (tipBuilt && (writer.detail === 'high' || radii[0] > 0.007)) {
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
/**
 * `curve.getSpacedPoints(divisions)` without its allocations, arithmetic for arithmetic.
 *
 * three's version walks `getPointAt` → `getUtoTmapping` → `getLengths`, and `getLengths` samples the
 * curve `arcLengthDivisions` (200) times with no target vector: 201 throwaway `Vector3`s and a fresh
 * cache array **per call**, and `growthPath` is called once per stem, secondary, twig and twiglet —
 * thousands of times a tree. The allocation profile put `Curve.getPoint` and its `init` at **12.4 % of
 * everything the builders allocate** (`art/environment/squad2-2026-09-23/chunks/alloc-*.json`), and
 * garbage is what the frame budget actually trips over (chunks/README.md §6).
 *
 * This keeps three's algorithm exactly — the same 200-sample cumulative length cache summed in the same
 * order, the same binary search, the same segment interpolation, the same `getPoint` — and only reuses
 * the vectors and the array. The returned points are fresh, because the caller keeps them.
 */
const _arcLengths: number[] = [];
const _arcA = new Vector3();
const _arcB = new Vector3();

/**
 * One axis of a centripetal Catmull-Rom segment, evaluated in local variables.
 *
 * three's `CubicPoly` keeps its four coefficients in closure variables, and V8 boxes a double assigned
 * to a captured variable: `getPoint` allocated ~240 bytes a call — twelve coefficients and three
 * components — which over `growthPath`'s 206 samples is **49 KB of garbage per path**. The arithmetic
 * here is `initNonuniformCatmullRom` followed by `calc`, operation for operation in the same order, with
 * nothing captured, so the doubles stay in registers. The output is the same bits, which
 * `chunks/bitcheck.mjs` checks over 75 geometries and 741 103 triangles.
 */
function cubicAxis(x0: number, x1: number, x2: number, x3: number, dt0: number, dt1: number, dt2: number, w: number): number {
  let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
  let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
  t1 *= dt1;
  t2 *= dt1;
  const c0 = x1;
  const c1 = t1;
  const c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2;
  const c3 = 2 * x1 - 2 * x2 + t1 + t2;
  const w2 = w * w;
  const w3 = w2 * w;
  return c0 + c1 * w + c2 * w2 + c3 * w3;
}

/** the two extrapolated end points three's `getPoint` builds in its module scratch */
const _curveEndA = new Vector3();
const _curveEndB = new Vector3();

/**
 * `CatmullRomCurve3.getPoint(t, target)` for a non-closed centripetal curve, without the boxing.
 * Same branch structure as three's: the first and last control points extrapolated the same way, the
 * same `Math.pow(distanceToSquared, 0.25)` knot spacing, the same repeated-point safety checks.
 */
function curvePoint(points: Vector3[], t: number, target: Vector3): Vector3 {
  const l = points.length;
  const p = (l - 1) * t;
  let intPoint = Math.floor(p);
  let weight = p - intPoint;
  if (weight === 0 && intPoint === l - 1) {
    intPoint = l - 2;
    weight = 1;
  }
  let p0: Vector3;
  let p3: Vector3;
  if (intPoint > 0) p0 = points[(intPoint - 1) % l];
  else p0 = _curveEndB.subVectors(points[0], points[1]).add(points[0]);
  const p1 = points[intPoint % l];
  const p2 = points[(intPoint + 1) % l];
  if (intPoint + 2 < l) p3 = points[(intPoint + 2) % l];
  else p3 = _curveEndA.subVectors(points[l - 1], points[l - 2]).add(points[l - 1]);
  let dt0 = Math.pow(p0.distanceToSquared(p1), 0.25);
  let dt1 = Math.pow(p1.distanceToSquared(p2), 0.25);
  let dt2 = Math.pow(p2.distanceToSquared(p3), 0.25);
  if (dt1 < 1e-4) dt1 = 1.0;
  if (dt0 < 1e-4) dt0 = dt1;
  if (dt2 < 1e-4) dt2 = dt1;
  return target.set(
    cubicAxis(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2, weight),
    cubicAxis(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2, weight),
    cubicAxis(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2, weight),
  );
}

function spacedPoints(curve: CatmullRomCurve3, divisions: number): Vector3[] {
  const n = curve.arcLengthDivisions;
  const control = curve.points;
  _arcLengths.length = 0;
  _arcLengths.push(0);
  let last = curvePoint(control, 0, _arcA);
  let sum = 0;
  for (let p = 1; p <= n; p++) {
    const current = curvePoint(control, p / n, last === _arcA ? _arcB : _arcA);
    sum += current.distanceTo(last);
    _arcLengths.push(sum);
    last = current;
  }
  const il = _arcLengths.length;
  /** three's `getUtoTmapping` with the cache above */
  const uToT = (u: number) => {
    const targetArcLength = u * _arcLengths[il - 1];
    let i = 0;
    let low = 0;
    let high = il - 1;
    while (low <= high) {
      i = Math.floor(low + (high - low) / 2);
      const comparison = _arcLengths[i] - targetArcLength;
      if (comparison < 0) low = i + 1;
      else if (comparison > 0) high = i - 1;
      else {
        high = i;
        break;
      }
    }
    i = high;
    if (_arcLengths[i] === targetArcLength) return i / (il - 1);
    const lengthBefore = _arcLengths[i];
    const segmentFraction = (targetArcLength - lengthBefore) / (_arcLengths[i + 1] - lengthBefore);
    return (i + segmentFraction) / (il - 1);
  };
  const points: Vector3[] = [];
  for (let d = 0; d <= divisions; d++) points.push(curvePoint(control, uToT(d / divisions), new Vector3()));
  return points;
}

/** the curve `growthPath` samples, reused: five points copied in place instead of a new curve a call */
const _growthCurve = new CatmullRomCurve3([new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()], false, 'centripetal');

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
  _growthCurve.points[0].copy(origin);
  _growthCurve.points[1].copy(a);
  _growthCurve.points[2].copy(b);
  _growthCurve.points[3].copy(c);
  _growthCurve.points[4].copy(target);
  const points = spacedPoints(_growthCurve, segments);
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
 * Round 46 (survey-2 crop 03, pose w09-spine-l: a column's far-LOD buttress 14 m off read as a
 * faceted low-poly cone with a hard straight base — 6 arc steps of 30°, a semicircular section
 * meeting the ground at a corner): the section's arc sides and a fillet — the section's height
 * goes as sin(θ)^(1 + fillet), so the flanks steepen at the ridge and run out flat into the
 * ground, and the section spreads by (1 + 0.3 × fillet) at the foot. Unset = the round-45 shape
 * exactly (the whitebarks' roots).
 */
export interface RootButtressShape {
  arcSides: number;
  fillet: number;
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
  shape?: RootButtressShape,
): Vector3 {
  const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const rows: number[][] = [];
  const bend = (rng() - 0.5) * 0.38;
  const arc = shape?.arcSides ?? 6;
  const fillet = shape?.fillet ?? 0;
  const spread = 1 + 0.3 * fillet;
  let tip = origin.clone();
  for (let k = 0; k < segments; k++) {
    const t = k / (segments - 1);
    const center = origin.clone().add(forward.clone().multiplyScalar(length * t)).addScaledVector(side, Math.sin(t * 2.5) * bend * length * 0.4);
    const w = (width * Math.pow(1 - t, 1.35) + 0.008) * spread;
    const h = height * Math.pow(1 - t, 2.05) + 0.005;
    const row: number[] = [];
    for (let j = 0; j <= arc; j++) {
      const theta = (j / arc) * Math.PI;
      const p = center.clone().addScaledVector(side, Math.cos(theta) * w);
      const g = groundAt(p.x, p.z);
      // edges are sunk slightly below the ground so the join never shows a gap on rough terrain
      p.y = j === 0 || j === arc ? g - 0.03 : g + Math.pow(Math.sin(theta), 1 + fillet) * h;
      row.push(writer.vertex(p, color.clone().multiplyScalar(0.81 + 0.16 * Math.sin(theta)), j / arc, (length * t) / 1.8, 1, 0, 0));
    }
    if (k) {
      for (let j = 0; j < arc; j++) {
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
/**
 * `addLeaf`'s scratch. A lamina used to allocate ~15 short-lived objects (eight points, four colours,
 * three frame vectors) and a near-canopy lobe carries over a thousand laminae, so the leaf path was
 * the builder's allocator — and its garbage is what the frame budget actually trips over: measured
 * over 65 real parts, 251 collections cost 220 ms of pause against 2013 ms of building, and the
 * chunks a collection landed in read a median 1.08 ms against 0.05 ms for the rest
 * (`art/environment/squad2-2026-09-23/chunks/`). Every one of these is consumed before the next
 * statement — `writer.vertex` copies the components out — so none is ever held across a call.
 */
const _leafForward = new Vector3();
const _leafSide = new Vector3();
const _leafNormal = new Vector3();
const _leafPoint = new Vector3();
const _leafColor = new Color();
const _leafTip = new Color();
const _leafShade = new Color();
/** the default tip tint, parsed once instead of per lamina (`lerp` reads it, never writes) */
const LEAF_TIP_DEFAULT = new Color('#7d8f4a');

export function addLeaf(writer: GeometryWriter, base: Vector3, direction: Vector3, sizeIn: number, color: Color, rng: RandomFn, o: LeafOptions, build = true): boolean {
  const ordinal = writer.leafOrdinal++;
  const mediumEvery = o.mediumEvery ?? 4;
  const lowEvery = o.lowEvery ?? 8;
  const retained = writer.detail === 'high' || (writer.detail === 'medium' ? ordinal % mediumEvery === 0 : ordinal % lowEvery === 0);
  // a 12 cm leaf is ~10 px at the nearest viewing distance: 8-triangle laminae only on every 4th leaf
  let leafDetail: Detail = writer.detail === 'high' ? (ordinal % 4 === 0 ? 'high' : 'medium') : writer.detail === 'medium' ? 'medium' : 'low';
  if (o.detailOverride) leafDetail = writer.detail === 'high' ? o.detailOverride : leafDetail;
  const size = sizeIn * (writer.detail === 'medium' ? o.mediumScale ?? 1.8 : writer.detail === 'low' ? o.lowScale ?? 2.6 : 1);
  const forward = _leafForward.copy(direction).normalize();
  // Most laminae face the sky, while the roll and pitch retain oblique leaves.
  const side = _leafSide.crossVectors(UP, forward);
  if (side.lengthSq() < 0.015) side.set(1, 0, 0);
  side.normalize().applyAxisAngle(forward, (rng() - 0.5) * 1.8);
  const normal = _leafNormal.crossVectors(forward, side).normalize();
  const twist = (rng() - 0.5) * 0.42;
  const cup = size * (0.045 + rng() * 0.075);
  const curve = size * (rng() * 0.2 - 0.045);
  const width = size * o.widthRatio;
  const phase = rng();
  // each point is handed straight to `writer.vertex`, which copies its components out, so one
  // scratch vector serves every call (a lamina used to allocate eight of them)
  const localPoint = (s: number, t: number) =>
    _leafPoint
      .copy(base)
      .addScaledVector(forward, size * t)
      .addScaledVector(side, s * width * 0.5)
      .addScaledVector(normal, curve * t * t + cup * (1 - Math.abs(s)) * Math.sin(t * Math.PI) + s * twist * size * t);
  const leafColor = _leafColor.copy(color).multiplyScalar(0.8 + rng() * 0.38);
  const tipColor = _leafTip.copy(leafColor).lerp(o.tipColor ?? LEAF_TIP_DEFAULT, 0.08 + rng() * 0.14);
  /** a shade of one of the two colours, consumed by the next `V` call (never held) */
  const lift = (c: Color, by: number) => _leafShade.copy(c).multiplyScalar(by);
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
      const center = V(localPoint(0, 0.43), lift(leafColor, 1.045), 0.5, 0.43);
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
  const c1 = V(localPoint(0, 0.34), lift(leafColor, 1.045), 0.5, 0.34);
  const r1 = V(localPoint(o.wideFirst, 0.34), leafColor, 1, 0.34);
  const l2 = V(localPoint(-o.wideSecond, 0.73), tipColor, 0.15, 0.73);
  const c2 = V(localPoint(0, 0.73), lift(tipColor, 1.025), 0.5, 0.73);
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
