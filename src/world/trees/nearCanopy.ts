/**
 * Near-canopy LOD (round 41, the owner: "Verdant Forest quality, especially when looking up").
 *
 * From the plaza and the landing the giants' and columns' lower crowns read as hazy leaf-cluster
 * cards / sparse laminae with soft edges and no branch structure. Every eligible lower lobe of a
 * giant or a seated column (local centre ≤ NEAR_CANOPY_MAX_Y, an ordinary lobe — not flat, not a
 * toned / shaded clump, not a compact plug or an eye-detail curtain; a lobe a hero camera frames
 * within the swap distance swaps only closer than that camera stands, see `swapRadiiFor`) is
 * built twice: its far foliage as before, tagged with the lobe's index in its tree (writer.ts
 * leafSwapGroup), and a NEAR version from its own forked stream — a third fork level of
 * twiglets (3-sided tapering wood off the recorded twigs, verdant-forest trees.js foliateLobe)
 * each carrying an overlapping spray of cupped laminae and a tip rosette, denser sprays on the
 * twigs and secondaries, a moss strip along the upper side of the lobe's stem — so the lobe
 * reads as wood forking into layered leaves. The trees system shows a near version only while
 * the live camera is within the part's in-radius of the lobe centre (out again past its
 * out-radius — hysteresis, like the near-base LOD), and the tree shaders drop that group's far
 * cards and laminae from the COLOUR pass meanwhile (materials.ts uNearCanopy; the depth pass
 * keeps them, so the dapple on the ground — measured by every hero frame — never changes, and
 * the near laminae cast nothing). Big limbs below the cap get a dressing part of their own (moss
 * strip, hanging vines, epicormic shoots) with nothing to replace.
 *
 * Geometry-only, local space, metres, +Y up. The builders here are shared by giant.ts and
 * column.ts; every part is built after its whole far tree from a stream forked off the tree's
 * (`rng.fork`), so the far tree is exactly what it was with the LOD off (the near base's rule).
 */
import { BufferGeometry, Color, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { GeometryWriter, TAU, UP, addLeaf, between, frame, growthPath, sample, stiffnessFor, tangent, taper, tube, type LeafOptions, type TubeDraws } from './writer';
import { reliefBoleSteps } from './bole';

/**
 * Swap radii (m, 3D to the lobe centre — a lobe 15 m up is 15 m away from under it). 22 in / 26
 * out: from the plaza's eye height the overhead lobes of the near giants stand 17–24 m away, so
 * 20 m (the first pass) left the centre of the straight-up view as cards.
 */
export const NEAR_CANOPY_IN_M = 22;
export const NEAR_CANOPY_OUT_M = 26;
/**
 * A part some hero camera frames from `d` m swaps in at `d − margin` and out at `d − margin / 3`
 * (the camera itself never sees the swap); a part whose in-radius would fall under
 * NEAR_CANOPY_MIN_IN_M keeps its far foliage at every distance instead (a swap 5 m under a lobe
 * is a pop, not a LOD).
 */
export const NEAR_CANOPY_HERO_MARGIN = 1.5;
export const NEAR_CANOPY_MIN_IN_M = 7;
/**
 * Round 45 (trees-28, item 6): the FLAT lobes' swap radii [in, out] when set — in place of the
 * hero cut, which holds the four bank-canopy flat lobes (10.5–14 m from A, 11–14 from B / E,
 * 12.6–15.7 from F) at 9–12.4 m in. Set to [14, 17] the hero cameras stand inside the swap and
 * render the lit, layered near versions in place of the even masses their frames are matched
 * to; null = the hero cut (the measured setting — see the round-45 trees report).
 */
export const NEAR_CANOPY_FLAT_SWAP_M: [number, number] | null = null;
/**
 * local height (m) of the lobe centre above which a lobe keeps its far foliage at every distance
 * (a 21 m lobe is 19.5 m over a standing eye — the top of what NEAR_CANOPY_IN_M can reach)
 */
export const NEAR_CANOPY_MAX_Y = 21;
/**
 * laminae per near lobe: this × hR² (m²), clamped to NEAR_CANOPY_LEAVES. 240 / m² of lobe
 * section: a 2.4 m lobe carries ≈ 1400 laminae of 18–34 cm — the sprays overlap 2–3 deep along
 * the twigs at 10–20 m (the first pass at 170 read as single leaves along stems).
 */
export const NEAR_CANOPY_LEAF_DENSITY = 240;
export const NEAR_CANOPY_LEAVES: [number, number] = [600, 2400];

/** one near-canopy part of a tree (see NEAR_CANOPY_IN_M), local space */
export interface NearCanopyPart {
  /** 'lobe': replaces the far foliage tagged with `group` while shown; 'limb': moss + vines dressing a big limb, nothing to replace */
  kind: 'lobe' | 'limb';
  /** the lobe's index in its tree = its swap group (writer.ts leafSwapGroup; a slot names root + group), −1 for a limb dressing */
  group: number;
  /** local centre the swap distance is measured to, and the part's reach (m) */
  center: Vector3;
  radius: number;
  /** this part's swap radii (m): NEAR_CANOPY_IN_M / OUT_M, or less for a part a hero camera frames */
  inM: number;
  outM: number;
  /**
   * wood + laminae, same attributes and material as the tree's `geometry` (leaf vertices flagged):
   * the first build (the measurement: counts, cull sphere, bytes). The trees system keeps it only
   * while the part is near and rebuilds it through `build` when it comes near again (lodPool.ts).
   */
  geometry: BufferGeometry;
  /**
   * one more build of exactly this geometry, chunked: a generator yielding between the twigs (and
   * the vines / shoots of a limb dressing) so the trees system can spread it across frames. From
   * the part's own forked stream every time, so every build is byte-identical to `geometry`.
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
 * The swap radii for a part about `center` reaching `radius`: the defaults, or — when a hero
 * camera frames it from d m — d − NEAR_CANOPY_HERO_MARGIN in / d − margin / 3 out, so the
 * camera never sees the swap. Null when the in-radius would fall under NEAR_CANOPY_MIN_IN_M (the
 * part keeps its far foliage). `tally` counts the two outcomes for the audit. This is the
 * build-time pass on the lobe's own sphere (it decides the tagging); the trees system runs a
 * second pass on the BUILT mesh's cull sphere (index.ts nearCanopyHeroPass), since a part's
 * stem dressing and vines reach well past its lobe.
 */
export function swapRadiiFor(heroDistance: HeroDistanceFn | undefined, center: Vector3, radius: number, tally: { kept: number; limited: number }): [number, number] | null {
  const d = heroDistance ? heroDistance(center, radius) : Infinity;
  if (!Number.isFinite(d)) return [NEAR_CANOPY_IN_M, NEAR_CANOPY_OUT_M];
  const inM = Math.min(NEAR_CANOPY_IN_M, d - NEAR_CANOPY_HERO_MARGIN);
  const outM = Math.min(NEAR_CANOPY_OUT_M, d - NEAR_CANOPY_HERO_MARGIN / 3);
  if (inM < NEAR_CANOPY_MIN_IN_M) {
    tally.kept++;
    return null;
  }
  tally.limited++;
  return [inM, outM];
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
  function* twiglets(w: GeometryWriter, g: Rng, parent: Vector3[], parentRadius: number, count: number, reach: number, center: Vector3, hR: number, vigor: number, size: [number, number], leafScale: number, floorY?: number): Generator<void, number> {
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
      tube(w, path, taper(path, radius, 0.0015), 3, g, { color: barkColor, roughness: 0.02 });
      n += nearSpray(w, g, path, radius, Math.max(3, Math.round(6 * leafScale)), size, center, hR, vigor, 0.25, floorY);
      n += nearRosette(w, g, path[path.length - 1], tangent(path, 1), Math.max(3, Math.round(4 * leafScale)), size, center, hR, vigor, radius, floorY);
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
    const target = Math.max(NEAR_CANOPY_LEAVES[0], Math.min(NEAR_CANOPY_LEAVES[1], NEAR_CANOPY_LEAF_DENSITY * rec.hR * rec.hR));
    // what the twigs carry at scale 1: ≈ 7 on the twig + 2.5 twiglets × (6 spray + 4 rosette)
    const leafScale = Math.max(0.6, Math.min(2.4, target / (Math.max(1, rec.twigs.length) * 32 + rec.secondaries.length * 8)));
    const high = smoothstep(4, 15, rec.center.y);
    const size: [number, number] = [0.17 + 0.05 * high, 0.27 + 0.09 * high];
    const vigor = 0.96;
    let leaves = 0;
    for (const sec of rec.secondaries) leaves += nearSpray(w, g, sec.path, sec.radius, Math.max(3, Math.round(8 * leafScale)), size, rec.center, rec.hR, vigor, 0.45, rec.floorY);
    yield;
    for (const twig of rec.twigs) {
      leaves += nearSpray(w, g, twig.path, twig.radius, Math.max(3, Math.round(7 * leafScale)), size, rec.center, rec.hR, vigor, 0.3, rec.floorY);
      yield;
      leaves += yield* twiglets(w, g, twig.path, twig.radius, g.int(2, 4), rec.hR * gb(0.28, 0.42), rec.center, rec.hR, vigor, size, leafScale, rec.floorY);
    }
    // moss along the upper side of the stem the lobe hangs on (the plain sweep is bare)
    const stemR = rec.stemRadii[0];
    if (stemR >= 0.09) mossStrip(w, rec.stem, rec.stemRadii, Math.min(1, 0.55 + stemR));
    yield;
    return { geometry: yield* w.finishSteps(`near-canopy-${o.id}-lobe-${idx}`), leaves, triangles: w.triangles };
  }

  /**
   * The near version of a recorded lobe: sprays on its secondaries and twigs, 2–4 twiglets per
   * twig, a moss strip along its stem. The laminae budget is NEAR_CANOPY_LEAF_DENSITY × hR²
   * within NEAR_CANOPY_LEAVES, spread over the recorded wood (leafScale). Built once here (the
   * measurement); `build` is the same build again, chunked.
   */
  const lobePart = (rng: Rng, rec: NearLobeRecord, idx: number): NearCanopyPart => {
    const first = runSteps(lobeSteps(rng, rec, idx));
    return {
      kind: 'lobe',
      group: rec.group,
      center: rec.center.clone(),
      radius: rec.hR * 1.35 + 0.6,
      inM: rec.inM,
      outM: rec.outM,
      geometry: first.geometry,
      build: function* () {
        return (yield* lobeSteps(rng, rec, idx)).geometry;
      },
      leaves: first.leaves,
      triangles: first.triangles,
      woodTriangles: first.triangles - first.leaves * 8,
      farLeaves: rec.farLeaves,
      farCards: rec.farCards,
    };
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
