/**
 * Near-canopy LOD (round 41, the owner: "Verdant Forest quality, especially when looking up").
 *
 * Eligible giant crowns at any height, and seated-column crowns below NEAR_CANOPY_MAX_Y,
 * retain their far foliage tagged with the lobe's index (writer.ts leafSwapGroup). A near
 * version uses its own forked stream — a third fork level of
 * twiglets (3-sided tapering wood off the recorded twigs, verdant-forest trees.js foliateLobe)
 * each carrying an overlapping spray of cupped laminae and a tip rosette, denser sprays on the
 * twigs and secondaries, a moss strip along the upper side of the lobe's stem — so the lobe
 * reads as wood forking into layered leaves. The trees system shows a near version only while
 * the live camera is within the part's in-distance of the crown envelope (out again past its
 * out-radius — hysteresis, like the near-base LOD), and the tree shaders drop that group's far
 * cards and laminae from the COLOUR pass meanwhile (materials.ts uNearCanopy; the depth pass
 * keeps them, so the dapple on the ground — measured by every hero frame — never changes, and
 * the near laminae cast nothing). Big limbs get a dressing part of their own (moss
 * strip, hanging vines, epicormic shoots) with nothing to replace.
 *
 * Geometry-only, local space, metres, +Y up. The builders here are shared by giant.ts and
 * column.ts. Ordinary giant lobes keep only records until the bounded pool requests their
 * chunked build. Far foliage remains visible until that build is resident.
 */
import { Box3, BufferGeometry, Color, Float32BufferAttribute, Sphere, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { GeometryWriter, TAU, UP, addLeaf, between, frame, growthPath, sample, stiffnessFor, tangent, taper, tube, type LeafOptions, type TubeDraws } from './writer';
import { reliefBoleSteps } from './bole';

/**
 * Swap distances from the authored crown envelope, in metres. The trees system caps these
 * by the selected memory tier (26 / 30 at 8 GB or more, 22 / 26 below it). Camera altitude and
 * fixed-view membership do not change admission; the same bounded pool serves every mode.
 */
export const NEAR_CANOPY_IN_M = 26;
export const NEAR_CANOPY_OUT_M = 30;
/**
 * Legacy exports retained for callers outside the giant path. Neither restricts admission.
 */
export const NEAR_CANOPY_HERO_MARGIN = 1.5;
export const NEAR_CANOPY_MIN_IN_M = 7;
/**
 * Round 45 (trees-28, item 6): the FLAT lobes' swap radii [in, out] when set — in place of the
 * hero cut, which holds the four bank-canopy flat lobes (10.5–14 m from A, 11–14 from B / E,
 * 12.6–15.7 from F) at 9–12.4 m in. Set to [14, 17] the hero cameras stand inside the swap and
 * render the lit, layered near versions in place of the even masses their frames are matched
 * to — measured (cap-6t on 44fe9b1): F −0.0131 and A −0.0025 against the same build with the
 * hero cut, for +3 pinned parts / +1.55 MB pinned in a pool that stays at its 64 MiB cap. The
 * walker pose that sees the far version at 11 m (w02-spine-r, (0.19, 1.45, 9.55)) stands where
 * camera A stands ((0.4, 1.8, 8.6)): no distance radius shows one the near version without the
 * other. null now uses the ordinary physical-camera distances.
 */
export const NEAR_CANOPY_FLAT_SWAP_M: [number, number] | null = null;
/**
 * The seated-column builder's current local-height limit. Giant crowns have no height limit:
 * the live camera can approach them at any altitude, with the same pool and distance limits.
 */
export const NEAR_CANOPY_MAX_Y = 25;
/**
 * laminae per near lobe: this × hR² (m²), clamped to NEAR_CANOPY_LEAVES. 240 / m² of lobe
 * section: a 2.4 m lobe carries ≈ 1400 laminae of 18–34 cm — the sprays overlap 2–3 deep along
 * the twigs at 10–20 m (the first pass at 170 read as single leaves along stems).
 */
export const NEAR_CANOPY_LEAF_DENSITY = 240;
export const NEAR_CANOPY_LEAVES: [number, number] = [600, 2400];

/** one near-canopy part of a tree (see NEAR_CANOPY_IN_M), local space */
export interface NearCanopyPart {
  /** Selected recessed-core foliage stays visible without folding its far core. */
  persistent?: boolean;
  envelope?: Box3;
  /** 'lobe': replaces the far foliage tagged with `group` while shown; 'limb': moss + vines dressing a big limb, nothing to replace */
  kind: 'lobe' | 'limb';
  /** the lobe's index in its tree = its swap group (writer.ts leafSwapGroup; a slot names root + group), −1 for a limb dressing */
  group: number;
  /** local centre the swap distance is measured to, and the part's reach (m) */
  center: Vector3;
  radius: number;
  /** this part's swap distances (m), capped by the trees system's memory tier */
  inM: number;
  outM: number;
  /**
   * The optional authored NEAR_CANOPY_FLAT_SWAP_M distances take precedence over the tier cap.
   */
  fixedSwap?: boolean;
  /**
   * wood + laminae, same attributes and material as the tree's `geometry` (leaf vertices flagged):
   * the first build, or empty bounds for a deferred part. The trees system keeps built buffers
   * only while the pool admits them and rebuilds through `build` after eviction (lodPool.ts).
   */
  geometry: BufferGeometry;
  /** No first geometry build yet; `geometry` holds only conservative bounds. */
  deferred?: boolean;
  /** Conservative uncompressed buffer bound until the first build supplies its actual bytes. */
  estimatedBytes?: number;
  /**
   * one more build of exactly this geometry, chunked: a generator yielding between the twigs (and
   * the vines / shoots of a limb dressing) so the trees system can spread it across frames. From
   * the part's own forked stream every time, so repeated builds are byte-identical.
   */
  build(): Generator<void, BufferGeometry>;
  leaves: number;
  triangles: number;
  woodTriangles: number;
  /** what the near version stands in for: the far laminae and cluster cards of the lobe */
  farLeaves: number;
  farCards: number;
}

/**
 * What the tree builder records about a far lobe while writing it (its wood is drawn at every
 * distance; the near part forks on from these paths), so the near version stands on the same
 * wood.
 */
export interface NearLobeRecord {
  /** Selected bank foliage; all ordinary records retain the existing kit settings. */
  layeredCore?: { leaves: number; twigs: number; bounds: Box3; tone: number };
  group: number;
  center: Vector3;
  hR: number;
  vR: number;
  stem: Vector3[];
  stemRadii: number[];
  secondaries: { path: Vector3[]; radius: number }[];
  twigs: { path: Vector3[]; radius: number }[];
  /** far laminae / cards written for the lobe (what the near version stands in for) */
  farLeaves: number;
  farCards: number;
  /** swap radii (see swapRadiiFor) */
  inM: number;
  outM: number;
  /** the distances are NEAR_CANOPY_FLAT_SWAP_M (NearCanopyPart.fixedSwap) */
  fixedSwap?: boolean;
  /** the lobe's walk-clearance floor (giant.ts CanopyLobe.floor, local y): no near lamina or twiglet below it */
  floorY?: number;
}

export interface NearLimbRecord {
  path: Vector3[];
  radii: number[];
  inM: number;
  outM: number;
  /**
   * round 44 (survey #5: "the giants' limbs are smooth pale tubes from below"): what the far
   * limb's `tube()` was built with — its draws (the ridge phase), gnarl bump and roughness — so
   * the dressing can lay a bark SLEEVE over it (bole.ts reliefBoleSteps replays the sweep's
   * frames and ridge exactly): cords and furrows 0.5–3 cm proud of the far surface everywhere,
   * never under it. Unset = the moss strip alone (the round-41 dressing).
   */
  sleeve?: { draws: TubeDraws; bump: (angle: number, distance: number, t: number) => number; roughness: number; barkTile: number };
}

/**
 * The trees system's view of the hero cameras: the distance (m) of the nearest fixed viewpoint
 * that frames the part's padded sphere from within the swap distance, or Infinity when none
 * does (local `center`; the tree builder's caller maps to world).
 */
export type HeroDistanceFn = (center: Vector3, radius: number) => number;

/**
 * Admission is independent of the fixed cameras. Keep the caller shape for the column kit,
 * while the live camera and bounded pool determine whether a registered part is shown.
 */
export function swapRadiiFor(_heroDistance: HeroDistanceFn | undefined, _center: Vector3, _radius: number, _tally: { kept: number; limited: number }): [number, number] {
  return [NEAR_CANOPY_IN_M, NEAR_CANOPY_OUT_M];
}

export interface NearCanopyKitOptions {
  /** the tree's id (noise seeds, geometry names) */
  id: string;
  /** the tree's bark colour rule (its twig wood: the near twiglets continue it) */
  barkColor: Color | ((point: Vector3, t: number) => Color);
  /** the tree's far leaf colour rule for a lamina at `base` in a lobe about `center` (stream g) */
  leafColor: (g: Rng, base: Vector3, center: Vector3, hR: number, vigor: number) => Color;
  /** the tree's canopy tone (the vine leaves lean toward it) */
  canopy: Color;
}

/**
 * The near-canopy builders for one tree. `lobePart` / `limbPart` build one part each from a
 * stream forked off `rng` by the part's index, so the parts of a tree are independent of each
 * other and of the far tree.
 */
export function createNearCanopyKit(o: NearCanopyKitOptions) {
  const ncNoise = new Noise2D(`near-canopy/${o.id}`);
  const mossDeep = new Color(0x1a2e0e);
  const mossLit = new Color(0x4d6b22);
  const vineLeaf = new Color(0x4b7a3a);
  const barkColor = o.barkColor;
  const pathLength = (path: Vector3[]) => path.reduce((s, p, i) => (i ? s + p.distanceTo(path[i - 1]) : 0), 0);
  const radiusAt = (radii: number[], t: number) => {
    const f = Math.max(0, Math.min(1, t)) * (radii.length - 1);
    const k = Math.min(radii.length - 2, Math.floor(f));
    return radii[k] + (radii[k + 1] - radii[k]) * (f - k);
  };
  // beech / oak obovate laminae, 8 triangles each, cupped and twisted (writer.ts addLeaf)
  const nearLeafOpts = (radius: number): LeafOptions => ({ widthRatio: 0.62, wideFirst: 0.7, wideSecond: 0.82, stiffness: stiffnessFor(radius), flutter: 0.035, detailOverride: 'high', tipColor: new Color('#8a9a4c') });
  const tubeFits = (path: Vector3[], radii: number[], bounds: Box3) => path.every((p, i) => {
    const pad = radii[i] * 1.04;
    return bounds.containsPoint(p.clone().addScalar(pad)) && bounds.containsPoint(p.clone().addScalar(-pad));
  });
  /** Extra parents grow from recorded secondary wood; they do not move the existing paths. */
  const layeredParents = (w: GeometryWriter, g: Rng, rec: NearLobeRecord, bounds: Box3) => {
    const added: NearLobeRecord['twigs'] = [];
    const count = rec.layeredCore!.twigs - rec.twigs.length;
    const phase = g() * TAU;
    for (let i = 0; i < count; i++) {
      const parent = rec.secondaries[i % rec.secondaries.length];
      const at = 0.32 + 0.5 * ((i * 0.61803398875) % 1);
      const origin = sample(parent.path, at);
      const az = phase + i * 2.3999632297;
      const level = [-0.4, 0.08, 0.7][i % 3];
      const reach = rec.hR * Math.sqrt(1 - level * level) * between(g, 0.72, 0.9);
      const target = rec.center.clone().add(new Vector3(Math.cos(az) * reach, level * rec.vR, Math.sin(az) * reach));
      if (rec.floorY !== undefined) target.y = Math.max(target.y, rec.floorY + 0.36);
      const path = growthPath(origin, target, tangent(parent.path, at), g, 4, 0.7);
      const radius = Math.max(0.007, Math.min(0.012, parent.radius * 0.25));
      const radii = taper(path, radius, 0.004);
      if (!tubeFits(path, radii, bounds)) continue;
      tube(w, path, radii, 3, g, { color: barkColor, roughness: 0.02 });
      added.push({ path, radius });
    }
    return added;
  };
  /** Keep whole natural laminae and spread the hard cap across every retained spray. */
  const boundLayeredLeaves = (source: GeometryWriter, bounds: Box3, limit: number, tone: number) => {
    const candidates: number[] = [];
    for (let v = 0; v < source.positions.length / 3;) {
      if (source.roots[v * 4 + 3] < 0.5) { v++; continue; }
      const points = Array.from({ length: 8 }, (_, i) => new Vector3().fromArray(source.positions, (v + i) * 3));
      if (points.every(p => bounds.containsPoint(p))) candidates.push(v);
      v += 8;
    }
    const count = Math.min(limit, candidates.length), keep = new Set<number>();
    for (let i = 0; i < count; i++) keep.add(candidates[Math.floor((i + 0.5) * candidates.length / count)]);
    const out = new GeometryWriter('high'), map = new Int32Array(source.positions.length / 3).fill(-1);
    const arrays = [['positions', 3], ['colors', 3], ['uvs', 2], ['winds', 3], ['roots', 4], ['normals', 3]] as const;
    for (let v = 0; v < map.length;) {
      const leaf = source.roots[v * 4 + 3] >= 0.5, n = leaf ? 8 : 1;
      if (!leaf || keep.has(v)) {
        for (let i = 0; i < n; i++) {
          const index = v + i;
          map[index] = out.positions.length / 3;
          for (const [name, size] of arrays) out[name].push(...source[name].slice(index * size, (index + 1) * size));
          if (leaf) for (let c = out.colors.length - 3; c < out.colors.length; c++) out.colors[c] *= tone;
        }
        if (leaf) out.leafCount++;
      }
      v += n;
    }
    for (let i = 0; i < source.indices.length; i += 3) {
      const [a, b, c] = source.indices.slice(i, i + 3).map(v => map[v]);
      if (a >= 0 && b >= 0 && c >= 0) out.triangle(a, b, c);
    }
    for (const [a, b] of source.seams) if (map[a] >= 0 && map[b] >= 0) out.seams.push([map[a], map[b]]);
    return out;
  };
  /**
   * A spray of laminae along the outer part of `path`: alternate pairs leaving the axis at
   * 50–80° with a little roll each, pitched up a touch, so neighbours overlap 2–3 deep along the
   * twig instead of radiating evenly (the far leafSpray's golden-angle scatter).
   */
  const nearSpray = (w: GeometryWriter, g: Rng, path: Vector3[], pathRadius: number, count: number, size: [number, number], center: Vector3, hR: number, vigor: number, startT = 0.3, floorY?: number) => {
    const gb = (a: number, b: number) => between(g, a, b);
    const opts = nearLeafOpts(pathRadius);
    let n = 0;
    for (let j = 0; j < count; j++) {
      const t = startT + ((1 - startT) * (j + gb(0.2, 0.8))) / count;
      const base = sample(path, t);
      const axis = tangent(path, t);
      const [u, v] = frame(axis);
      const side = j % 2 === 0 ? 1 : -1;
      const roll = gb(-0.4, 0.4);
      const outward = u.clone().multiplyScalar(side * Math.cos(roll)).addScaledVector(v, Math.sin(roll));
      const direction = axis.clone().multiplyScalar(gb(0.5, 0.9)).addScaledVector(outward, 1).addScaledVector(UP, gb(-0.1, 0.35)).normalize();
      // a floored lobe's laminae stop at its floor (the draws are made either way)
      if (addLeaf(w, base, direction, gb(size[0], size[1]), o.leafColor(g, base, center, hR, vigor), g, opts, floorY === undefined || base.y >= floorY + 0.2)) n++;
    }
    return n;
  };
  /** a rosette of laminae fanning from a twig tip: the layered end of every spray */
  const nearRosette = (w: GeometryWriter, g: Rng, tip: Vector3, axis: Vector3, count: number, size: [number, number], center: Vector3, hR: number, vigor: number, radius: number, floorY?: number) => {
    const gb = (a: number, b: number) => between(g, a, b);
    const opts = nearLeafOpts(radius);
    const [u, v] = frame(axis);
    const phase = g() * TAU;
    let n = 0;
    for (let j = 0; j < count; j++) {
      const a = phase + (j / count) * TAU + gb(-0.2, 0.2);
      const outward = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      const direction = axis.clone().multiplyScalar(gb(0.8, 1.3)).addScaledVector(outward, gb(0.5, 0.9)).addScaledVector(UP, gb(-0.05, 0.25)).normalize();
      const base = tip.clone().addScaledVector(outward, radius * 0.5);
      if (addLeaf(w, base, direction, gb(size[0], size[1]), o.leafColor(g, base, center, hR, vigor), g, opts, floorY === undefined || base.y >= floorY + 0.2)) n++;
    }
    return n;
  };
  /**
   * The third fork level: `count` twiglets off `parent` at 0.3–0.92 of its length — 3-sided
   * tapering wood (verdant-forest trees.js: every level thinner and shorter than its parent)
   * leaving at 30–60° and drooping toward the tip under its leaves — each with a spray and a
   * tip rosette. Returns the laminae built.
   */
  function* twiglets(w: GeometryWriter, g: Rng, parent: Vector3[], parentRadius: number, count: number, reach: number, center: Vector3, hR: number, vigor: number, size: [number, number], leafScale: number, floorY?: number, bounds?: Box3): Generator<void, number> {
    const gb = (a: number, b: number) => between(g, a, b);
    const phase = g() * TAU;
    let n = 0;
    for (let k = 0; k < count; k++) {
      const t = 0.3 + (k / count) * 0.62 + gb(-0.04, 0.04);
      const origin = sample(parent, t);
      const axis = tangent(parent, t);
      const [u, v] = frame(axis);
      const a = phase + k * 2.39996 + gb(-0.3, 0.3);
      const outward = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      const length = reach * gb(0.7, 1.15) * (1 - 0.3 * t);
      const dir = axis.clone().multiplyScalar(gb(0.7, 1.2)).addScaledVector(outward, 1).addScaledVector(UP, gb(0, 0.45)).normalize();
      const target = origin.clone().addScaledVector(dir, length);
      target.y -= length * gb(0.1, 0.3);
      if (floorY !== undefined) target.y = Math.max(target.y, floorY + 0.3);
      const path = growthPath(origin, target, axis, g, 4, 0.7);
      const radius = Math.max(0.005, parentRadius * (1 - t * 0.6) * 0.55);
      const radii = taper(path, radius, 0.0015);
      // An out-of-bounds branch and all its leaves are discarded together, with draws retained.
      const into = bounds && !tubeFits(path, radii, bounds) ? new GeometryWriter('high') : w;
      tube(into, path, radii, 3, g, { color: barkColor, roughness: 0.02 });
      const spray = nearSpray(into, g, path, radius, Math.max(3, Math.round(6 * leafScale)), size, center, hR, vigor, 0.25, floorY);
      const rosette = nearRosette(into, g, path[path.length - 1], tangent(path, 1), Math.max(3, Math.round(4 * leafScale)), size, center, hR, vigor, radius, floorY);
      if (into === w) n += spray + rosette;
      yield;
    }
    return n;
  }
  /**
   * A moss sheet along the upper side of a stem (writer.ts woodMoss: the tree shader lays the
   * cushions, flattens the bark normal and roughens the surface under them): a strip of
   * `sides` vertices across the top of each ring, a little proud of the bark, its angular
   * half-width breathing along the length with a metre-scale field so the sheet ends in
   * tongues, the cover full on the crest and thinning to the edges (the shader's cushion
   * threshold then leaves bark showing between the cushions there). A near-vertical stretch
   * has no upper side and breaks the strip. Returns the triangles built.
   */
  const mossStrip = (w: GeometryWriter, path: Vector3[], radii: number[], strength: number, spacing = 0.15) => {
    const total = pathLength(path);
    const n = Math.max(3, Math.round(total / spacing));
    const sides = 6;
    let prev: number[] | null = null;
    let tris = 0;
    const up = new Vector3();
    const sideV = new Vector3();
    const q = new Vector3();
    const c = new Color();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = sample(path, t);
      const rr = radiusAt(radii, t);
      const axis = tangent(path, t);
      up.copy(UP).addScaledVector(axis, -UP.dot(axis));
      if (up.lengthSq() < 0.05) {
        prev = null;
        continue;
      }
      up.normalize();
      sideV.crossVectors(axis, up).normalize();
      const field = 0.5 + 0.5 * ncNoise.fbm(p.x * 0.7 + p.y * 0.3, p.z * 0.7 - p.y * 0.2, 3);
      const halfAngle = (0.35 + 0.75 * field) * strength * (1 - smoothstep(0.85, 1, t));
      const row: number[] = [];
      for (let j = 0; j <= sides; j++) {
        const s = (j / sides) * 2 - 1;
        const ang = s * halfAngle;
        const cushion = 0.5 + 0.5 * ncNoise.noise(p.x * 9 + j * 1.7, p.z * 9 + p.y * 7);
        const lift = rr * (0.03 + 0.05 * cushion) + 0.01;
        q.copy(p).addScaledVector(up, Math.cos(ang) * (rr + lift)).addScaledVector(sideV, Math.sin(ang) * (rr + lift));
        const edge = 1 - Math.abs(s);
        const cover = Math.min(1, (0.45 + 0.7 * edge) * (0.6 + 0.6 * field)) * strength;
        c.copy(mossDeep).lerp(mossLit, cushion * 0.7 + 0.3 * edge);
        w.woodMoss = cover;
        row.push(w.vertex(q, c, j / sides, (t * total) / 0.4, stiffnessFor(rr), 0, 0));
        w.woodMoss = 0;
      }
      if (prev) {
        for (let j = 0; j < sides; j++) {
          w.triangle(prev[j], prev[j + 1], row[j]);
          w.triangle(prev[j + 1], row[j + 1], row[j]);
          tris += 2;
        }
      }
      prev = row;
    }
    return tris;
  };
  /**
   * A vine hanging from the underside of a limb at `from`: a drooping cord (3 sides, its own
   * low stiffness so it swings on the branch layer) with small paired leaves turned down and
   * out along it. Returns the laminae built.
   */
  const hangingVine = (w: GeometryWriter, g: Rng, from: Vector3) => {
    const gb = (a: number, b: number) => between(g, a, b);
    const drop = gb(1.6, 3.6);
    const swingAz = g() * TAU;
    const swing = gb(0.25, 0.7);
    const segs = 9;
    const path: Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const s = i / segs;
      const out = swing * Math.sin(s * Math.PI * 0.5);
      path.push(from.clone().add(new Vector3(Math.cos(swingAz) * out, -drop * s + 0.15 * Math.sin(s * 5.1 + swingAz) * s, Math.sin(swingAz) * out)));
    }
    const radius = 0.012 + 0.004 * drop;
    tube(w, path, taper(path, radius, 0.003, 0.8), 3, g, { color: barkColor, roughness: 0.02, stiffness: () => 0.18 });
    const opts: LeafOptions = { ...nearLeafOpts(0.01), stiffness: 0.18, flutter: 0.05 };
    const count = Math.round(drop * 5);
    let n = 0;
    for (let j = 0; j < count; j++) {
      const t = 0.12 + (0.86 * (j + gb(0.2, 0.8))) / count;
      const base = sample(path, t);
      const axis = tangent(path, t);
      const [u, v] = frame(axis);
      const a = j * 2.39996 + gb(-0.3, 0.3);
      const direction = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)).addScaledVector(UP, gb(-0.55, -0.15)).normalize();
      const color = vineLeaf.clone().multiplyScalar(gb(0.75, 1.05)).lerp(o.canopy, 0.3);
      if (addLeaf(w, base, direction, gb(0.07, 0.12), color, g, opts)) n++;
    }
    return n;
  };

  /**
   * The near version of a recorded lobe: sprays on its secondaries and twigs, 2–4 twiglets per
   * twig, a moss strip along its stem. The laminae budget is NEAR_CANOPY_LEAF_DENSITY × hR²
   * within NEAR_CANOPY_LEAVES, spread over the recorded wood (leafScale).
   */
  /** what one build of a part produced (identical every build) */
  interface Built {
    geometry: BufferGeometry;
    leaves: number;
    triangles: number;
  }
  /**
   * One build of a lobe's near version, chunked: yields after the secondaries' sprays, after
   * every twig's spray and every twiglet, after the moss strip and between the steps of `finish`
   * (a chunk is ≈ 0.3–1.5 ms). Every draw comes from the stream forked off `rng` by the part's
   * index, so the result is the same whenever it runs.
   */
  function* lobeSteps(rng: Rng, rec: NearLobeRecord, idx: number): Generator<void, Built> {
    const w = new GeometryWriter('high');
    const g = rng.fork(`near-canopy/lobe/${idx}`);
    const gb = (a: number, b: number) => between(g, a, b);
    // 8 cm contains the added flex/flutter at the current giant wind settings; the old core is rigid.
    const bounds = rec.layeredCore?.bounds.clone().expandByScalar(-0.08);
    const twigs = bounds ? [...rec.twigs, ...layeredParents(w, g.fork('layered-parents'), rec, bounds)] : rec.twigs;
    const target = rec.layeredCore ? rec.layeredCore.leaves * 1.3 : Math.max(NEAR_CANOPY_LEAVES[0], Math.min(NEAR_CANOPY_LEAVES[1], NEAR_CANOPY_LEAF_DENSITY * rec.hR * rec.hR));
    // what the twigs carry at scale 1: ≈ 7 on the twig + 2.5 twiglets × (6 spray + 4 rosette)
    const leafScale = Math.max(0.6, Math.min(2.4, target / (Math.max(1, twigs.length) * 32 + rec.secondaries.length * 8)));
    const high = smoothstep(4, 15, rec.center.y);
    const size: [number, number] = [0.17 + 0.05 * high, 0.27 + 0.09 * high];
    const vigor = 0.96;
    let leaves = 0;
    for (const sec of rec.secondaries) leaves += nearSpray(w, g, sec.path, sec.radius, Math.max(3, Math.round(8 * leafScale)), size, rec.center, rec.hR, vigor, 0.45, rec.floorY);
    yield;
    for (const twig of twigs) {
      leaves += nearSpray(w, g, twig.path, twig.radius, Math.max(3, Math.round(7 * leafScale)), size, rec.center, rec.hR, vigor, 0.3, rec.floorY);
      yield;
      leaves += yield* twiglets(w, g, twig.path, twig.radius, g.int(2, 4), rec.hR * gb(0.28, 0.42), rec.center, rec.hR, vigor, size, leafScale, rec.floorY, bounds);
    }
    // moss along the upper side of the stem the lobe hangs on (the plain sweep is bare)
    const stemR = rec.stemRadii[0];
    if (stemR >= 0.09 && !rec.layeredCore) mossStrip(w, rec.stem, rec.stemRadii, Math.min(1, 0.55 + stemR));
    yield;
    const out = rec.layeredCore ? boundLayeredLeaves(w, bounds!, rec.layeredCore.leaves, rec.layeredCore.tone) : w;
    if (rec.layeredCore) leaves = out.leafCount;
    return { geometry: yield* out.finishSteps(`near-canopy-${o.id}-lobe-${idx}`), leaves, triangles: out.triangles };
  }

  /**
   * The near version of a recorded lobe: sprays on its secondaries and twigs, 2–4 twiglets per
   * twig, a moss strip along its stem. The laminae budget is NEAR_CANOPY_LEAF_DENSITY × hR²
   * within NEAR_CANOPY_LEAVES, spread over the recorded wood (leafScale). Deferred parts keep
   * conservative bounds and a byte estimate until the first chunked build completes.
   */
  const lobePart = (rng: Rng, rec: NearLobeRecord, idx: number, defer = false): NearCanopyPart => {
    // Persistent recessed foliage keeps its existing first build. Ordinary giant lobes retain
    // their branch records and enter the same chunked builder only when the pool requests them.
    const first = defer && !rec.layeredCore ? null : runSteps(lobeSteps(rng, rec, idx));
    const geometry = first?.geometry ?? new BufferGeometry();
    if (!first) {
      geometry.name = `near-canopy-${o.id}-lobe-${idx}#deferred`;
      geometry.setAttribute('position', new Float32BufferAttribute([], 3));
      geometry.boundingBox = new Box3().setFromPoints([...rec.stem, ...rec.secondaries.flatMap(s => s.path), ...rec.twigs.flatMap(t => t.path)]).expandByScalar(rec.hR + 1);
      geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
    }
    // At leafScale <= 2.4: <=19 leaves/secondary, <=17 + 4*(14+10) leaves/twig.
    // Each leaf takes <=672 raw bytes; each 3-sided twiglet <=1836. The stem strip
    // takes <=648 bytes/row. Compaction can only lower this bound before installation.
    const estimatedBytes = (rec.secondaries.length * 19 + rec.twigs.length * 113) * 672
      + rec.twigs.length * 4 * 1836 + (Math.ceil(pathLength(rec.stem) / 0.15) + 4) * 648;
    const part: NearCanopyPart = {
      kind: 'lobe',
      ...(rec.layeredCore ? { persistent: true, envelope: rec.layeredCore.bounds.clone() } : {}),
      group: rec.group,
      center: rec.center.clone(),
      radius: rec.hR * 1.35 + 0.6,
      inM: rec.inM,
      outM: rec.outM,
      fixedSwap: rec.fixedSwap,
      geometry,
      deferred: !first,
      estimatedBytes,
      build: function* () {
        const built = yield* lobeSteps(rng, rec, idx);
        part.deferred = false;
        part.leaves = built.leaves;
        part.triangles = built.triangles;
        part.woodTriangles = built.triangles - built.leaves * 8;
        return built.geometry;
      },
      leaves: first?.leaves ?? 0,
      triangles: first?.triangles ?? 0,
      woodTriangles: first ? first.triangles - first.leaves * 8 : 0,
      farLeaves: rec.farLeaves,
      farCards: rec.farCards,
    };
    return part;
  };

  /**
   * A beard of hanging moss (round 44, survey #5 / the owner's frame-03 "hanging moss on the
   * limb"): a ribbon `length` m long hanging from `from`, 4–8 cm wide at the root and a
   * centimetre at the tip, swaying a little along its own bend, in two faces (the material is
   * double-sided). Full moss cover on every vertex (the tree shader lays the cushion texture);
   * stiffness 0.18 so it swings on the branch layer like the vines. 2 triangles a segment.
   */
  const beardDeep = new Color(0x22361a);
  const beardLit = new Color(0x6c8a3e);
  const mossBeard = (w: GeometryWriter, g: Rng, from: Vector3, length: number) => {
    const gb = (a: number, b: number) => between(g, a, b);
    const segs = 5;
    const az = g() * TAU;
    const sway = new Vector3(Math.cos(az), 0, Math.sin(az));
    const across = new Vector3(-sway.z, 0, sway.x);
    const bend = gb(0.08, 0.22) * length;
    const w0 = gb(0.04, 0.08);
    const phase = g();
    const wobble = g() * TAU;
    let prev: [number, number] | null = null;
    const q = new Vector3();
    const c = new Color();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      q.copy(from).addScaledVector(UP, -length * t).addScaledVector(sway, bend * t * t + 0.02 * Math.sin(t * 9 + wobble) * t);
      const half = 0.5 * (w0 * (1 - t) + 0.01 * t) * (1 + 0.25 * Math.sin(t * 13 + wobble));
      c.copy(beardDeep).lerp(beardLit, 0.35 + 0.5 * t + 0.15 * Math.sin(t * 7 + wobble));
      w.woodMoss = 1;
      const a = w.vertex(q.clone().addScaledVector(across, -half), c, 0, t * length / 0.3, 0.18, phase, 0, 0);
      const b = w.vertex(q.clone().addScaledVector(across, half), c, 1, t * length / 0.3, 0.18, phase, 0, 0);
      w.woodMoss = 0;
      if (prev) {
        w.triangle(prev[0], prev[1], a);
        w.triangle(prev[1], b, a);
      }
      prev = [a, b];
    }
    return segs * 2;
  };
  /**
   * The bark sleeve of a big limb (NearLimbRecord.sleeve): the far limb's sweep again (same
   * frames, ridge and gnarl), its nominal radius pushed out by the furrow depth plus 4 mm so the
   * relief — cords at the near bases' pitch, crevice shading, lichen on the crests — stands
   * 0.4–3 cm proud of the far tube everywhere and never under it; a moss sheet along the upper
   * side (mossExtra) that bulges and carries 3-D cushions (bole.ts). Returns the cushions built.
   */
  const sleeveLiftFor = (amplitude: number) => 0.75 * amplitude + 0.006;
  function* limbSleeve(w: GeometryWriter, g: Rng, limb: NearLimbRecord, idx: number): Generator<void, { cushions: number; amplitude: number }> {
    const sl = limb.sleeve!;
    const r0 = limb.radii[0];
    const amplitude = Math.max(0.018, Math.min(0.035, 0.08 * r0));
    // the far tube's ridge swings its radius ±15 %: at 0.75 A + 6 mm the furrow bottoms clear it by
    // ≥ 4 mm on the ridge's low side; the crests stand 1.1 A + 6 mm (≈ 4 cm on a 35 cm limb) proud
    const lift = sleeveLiftFor(amplitude);
    const color = typeof barkColor === 'function' ? barkColor : () => barkColor;
    const mossField = (p: Vector3) => 0.5 + 0.5 * ncNoise.fbm(p.x * 0.9 + p.y * 0.4, p.z * 0.9 - p.y * 0.3, 3);
    const built = yield* reliefBoleSteps(w, limb.path, limb.radii.map((r) => r + lift), {
      color,
      bump: sl.bump,
      creviceShade: 1.8,
      barkTile: sl.barkTile,
      roughness: sl.roughness,
      sides: Math.max(16, Math.min(44, Math.round((TAU * r0) / 0.06))),
      spacing: 0.12,
      denseUntilY: 1e9,
      amplitude,
      fadeY: [1e8, 1e9],
      farShare: 1,
      refRadius: r0,
      pitch: 0.16,
      noise: ncNoise,
      draws: sl.draws,
      stiffness: () => 1,
      // no height band on a limb: the moss is the upper-side sheet alone
      mossBand: [-1e9, -1e9 + 1],
      mossStrength: 1,
      mossExtra: (p, upness) => smoothstep(0.2, 0.7, upness) * smoothstep(0.38, 0.8, mossField(p)),
      lichen: { band: [3, 12], strength: 0.6 },
      mossBulge: 0.8,
      cushions: { rng: g.fork(`sleeve-cushions/${idx}`), density: 0.05, size: [0.04, 0.1], maxCount: 120, minY: -Infinity },
    });
    return { cushions: built.cushions, amplitude };
  }
  /** one build of a limb dressing, chunked: yields after the sleeve / moss strip, after every vine, beard row and shoot */
  function* limbSteps(rng: Rng, limb: NearLimbRecord, idx: number): Generator<void, Built> {
    const w = new GeometryWriter('high');
    const g = rng.fork(`near-canopy/limb/${idx}`);
    const gb = (a: number, b: number) => between(g, a, b);
    let leaves = 0;
    let sleeveLift = 0;
    if (limb.sleeve) {
      const built = yield* limbSleeve(w, g.fork('sleeve'), limb, idx);
      sleeveLift = sleeveLiftFor(built.amplitude) + built.amplitude * 0.35;
    } else {
      mossStrip(w, limb.path, limb.radii, 1, 0.22);
    }
    yield;
    const up = new Vector3();
    const side = new Vector3();
    if (limb.sleeve) {
      // hanging moss from the underside and flanks of the outer three quarters, denser where the
      // limb is thick; from its own stream so the vines and shoots below draw what they did
      const bg = g.fork('beards');
      const total = pathLength(limb.path);
      const beards = Math.max(6, Math.min(18, Math.round(total * 1.3)));
      for (let k = 0; k < beards; k++) {
        const t = 0.2 + (0.78 * (k + bg())) / beards;
        const p = sample(limb.path, t);
        const rr = radiusAt(limb.radii, t) + sleeveLift;
        const axis = tangent(limb.path, t);
        up.copy(UP).addScaledVector(axis, -UP.dot(axis)).normalize();
        side.crossVectors(axis, up).normalize();
        const a = between(bg, -1.1, 1.1);
        // 0.88 of the nominal sleeve radius: inside the sleeve where its ridge stands out (the
        // ribbon's top is hidden in the bark), at most a centimetre proud where the ridge dips
        const from = p.clone().addScaledVector(up, -rr * Math.cos(a) * 0.88).addScaledVector(side, rr * Math.sin(a) * 0.88);
        mossBeard(w, bg, from, between(bg, 0.25, 0.75) * (0.7 + 0.6 * Math.min(1, rr / 0.5)));
        if (k % 6 === 5) yield;
      }
    }
    const vines = g.int(2, 5);
    for (let k = 0; k < vines; k++) {
      const t = gb(0.3, 0.92);
      const p = sample(limb.path, t);
      const rr = radiusAt(limb.radii, t);
      const axis = tangent(limb.path, t);
      up.copy(UP).addScaledVector(axis, -UP.dot(axis)).normalize();
      side.crossVectors(axis, up).normalize();
      leaves += hangingVine(w, g, p.clone().addScaledVector(up, -rr * 0.85).addScaledVector(side, gb(-0.5, 0.5) * rr));
      yield;
    }
    const shoots = g.int(2, 4);
    for (let k = 0; k < shoots; k++) {
      const t = gb(0.25, 0.9);
      const p = sample(limb.path, t);
      const rr = radiusAt(limb.radii, t);
      const axis = tangent(limb.path, t);
      up.copy(UP).addScaledVector(axis, -UP.dot(axis)).normalize();
      side.crossVectors(axis, up).normalize();
      const a = gb(-0.9, 0.9);
      const origin = p.clone().addScaledVector(up, rr * Math.cos(a) * 0.95).addScaledVector(side, rr * Math.sin(a) * 0.95);
      const dir = up.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a)).addScaledVector(axis, gb(-0.3, 0.6)).normalize();
      const length = gb(0.7, 1.4);
      const path = growthPath(origin, origin.clone().addScaledVector(dir, length), dir, g, 4, 0.8);
      tube(w, path, taper(path, 0.02, 0.003), 3, g, { color: barkColor, roughness: 0.02 });
      const c = path[path.length - 1];
      leaves += nearSpray(w, g, path, 0.02, 7, [0.14, 0.22], c, 0.6, 0.95, 0.35);
      leaves += yield* twiglets(w, g, path, 0.02, 2, 0.45, c, 0.8, 0.95, [0.14, 0.22], 1);
    }
    return { geometry: yield* w.finishSteps(`near-canopy-${o.id}-limb-${idx}`), leaves, triangles: w.triangles };
  }

  /** the dressing of a big limb: a moss strip on top, vines from the underside of its outer two thirds, a few epicormic shoots */
  const limbPart = (rng: Rng, limb: NearLimbRecord, idx: number): NearCanopyPart => {
    const first = runSteps(limbSteps(rng, limb, idx));
    return {
      kind: 'limb',
      group: -1,
      center: sample(limb.path, 0.6),
      radius: 0.5 * pathLength(limb.path) + 3.8,
      inM: limb.inM,
      outM: limb.outM,
      geometry: first.geometry,
      build: function* () {
        return (yield* limbSteps(rng, limb, idx)).geometry;
      },
      leaves: first.leaves,
      triangles: first.triangles,
      woodTriangles: first.triangles - first.leaves * 8,
      farLeaves: 0,
      farCards: 0,
    };
  };

  return { lobePart, limbPart, pathLength };
}

/** run a chunked build to its end (the first build of a part, tests) */
export function runSteps<T>(gen: Generator<void, T>): T {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}
