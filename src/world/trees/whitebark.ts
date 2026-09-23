/**
 * White-bark trees — the Verdant Forest birch, ported and grown up for Kokiri Forest.
 * Derived from Verdant Forest by Leonxlnx (github.com/Leonxlnx/verdant-forest, app/forest/trees.js).
 *
 * Improvements over the source: seeded per-variant architecture (age classes sapling → mature,
 * lean 2–8°, taper power, cross-section ridging, side-leader count, bough count, crown width,
 * pendulous twig droop), root flare + below-ground skirt for exact ground contact, grey lower
 * trunk via vertex colour, palette-driven leaf colours with per-leaf variation, and per-vertex
 * wind attributes (trunk / branch / leaf layers). Geometry-only: metres, +Y up, base at y = 0.
 */
import { BufferGeometry, Color, Mesh, Quaternion, Vector3, type Material } from 'three';
import { createRng, type Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { consumeTubeDraws } from './bole';
import { WHITE_BARK_TILE_M } from './bark-texture';
import {
  GeometryWriter,
  TAU,
  UP,
  addLeaf,
  between,
  clamp01,
  divergingLeaderPath,
  frame,
  growthPath,
  mergeParts,
  sample,
  stiffnessFor,
  tangent,
  taper,
  tube,
  type Detail,
} from './writer';

export type Age = 'sapling' | 'young' | 'mature';

export interface WhiteBarkParams {
  seed: string;
  age: Age;
  height: number;
  trunkRadius: number;
  leanDeg: number;
  leanAzimuth: number;
  taperPower: number;
  ridge: number;
  sideLeaders: number;
  boughs: number;
  /** crown radius as a fraction of height */
  crownWidth: number;
  /** 0 = upright twigs, 1 = strongly pendulous */
  droop: number;
  leafSize: [number, number];
  /** leaf population multiplier */
  leafDensity: number;
  lowerLimbs: number;
  roots: number;
}

export interface TreeAsset {
  /** wood + leaves merged (leaf vertices flagged in aRoot.w) */
  geometry: BufferGeometry;
  leafCount: number;
  woodTriangles: number;
  leafTriangles: number;
  height: number;
  radius: number;
}

export interface Palette {
  barkWhite: number;
  barkGrey: number;
  barkDark: number;
  leafCanopy: number;
  leafSun: number;
}

/** Deterministic architecture for variant `index` of `total` (ages spread from saplings to mature). */
export function whiteBarkParams(rng: Rng, index: number, total: number): WhiteBarkParams {
  const r = rng.fork(`variant-${index}`);
  const f = index / Math.max(1, total - 1);
  const age: Age = f < 0.2 ? 'sapling' : f < 0.5 ? 'young' : 'mature';
  const base =
    age === 'sapling'
      ? { height: [3.6, 5.4], radius: [0.06, 0.1], boughs: [3, 3], leaders: [0, 0], leaf: [0.1, 0.16], density: 0.5, roots: [3, 4] }
      : age === 'young'
        ? { height: [7, 10], radius: [0.13, 0.2], boughs: [3, 4], leaders: [1, 1], leaf: [0.12, 0.19], density: 0.55, roots: [4, 5] }
        : { height: [11, 15], radius: [0.22, 0.34], boughs: [4, 5], leaders: [1, 2], leaf: [0.13, 0.21], density: 0.62, roots: [4, 6] };
  return {
    seed: `wb-${index}-${r.int(0, 1e9)}`,
    age,
    height: r.range(base.height[0], base.height[1]),
    trunkRadius: r.range(base.radius[0], base.radius[1]),
    leanDeg: r.range(2, 8),
    leanAzimuth: r.range(0, TAU),
    taperPower: r.range(0.8, 1.25),
    ridge: r.range(0.04, 0.13),
    sideLeaders: r.int(base.leaders[0], base.leaders[1] + 1),
    boughs: r.int(base.boughs[0], base.boughs[1] + 1),
    crownWidth: r.range(0.17, 0.26),
    droop: r.range(0.15, 1),
    leafSize: [base.leaf[0], base.leaf[1]],
    leafDensity: base.density * r.range(0.9, 1.12),
    lowerLimbs: age === 'sapling' ? 0 : r.chance(0.35) ? 2 : 1,
    roots: r.int(base.roots[0], base.roots[1] + 1),
  };
}

/** a root toe of a variant: azimuth (tree space), reach from the axis and section at the axis (m, unscaled) */
export interface ToeSpec {
  angle: number;
  length: number;
  width: number;
  height: number;
  bend: number;
}

/**
 * The fork every round-47 base feature of a variant draws from — never the variant's own stream
 * (`createRng('whitebark/<seed>')`), which feeds the crown after the trunk: the crowns, and with
 * them the LOD-0 height and radius `placeWhiteBark` and the LOD bucketing read, stay the
 * round-46 geometry, so the 80 placements do not move.
 */
const _sway = new Vector3();
/** a low bough's lobe keeps its underside this high over the tree's ground (a walker's eye is 1.45 m) */
const WALKER_CLEARANCE_M = 1.9;
const baseRngFor = (p: WhiteBarkParams) => createRng(`whitebark/${p.seed}`).fork('base-47');

/**
 * The variant's root toes — 3–6 long, low surface roots leaving the fluted foot. A pure function
 * of the params, read by the instanced trunk (its fluting ridges sit over the toes) and by the
 * terrain-seated root mesh (`createWhiteBarkRoots`), so the two agree.
 */
export function whiteBarkToeSpecs(p: WhiteBarkParams): ToeSpec[] {
  const r = baseRngFor(p).fork('toes');
  const R = p.trunkRadius;
  const toes: ToeSpec[] = [];
  for (let i = 0; i < p.roots; i++) {
    // low and broad: a surface root is about twice as wide as it is tall
    toes.push({
      angle: (i / p.roots) * TAU + r.range(-0.3, 0.3),
      length: R * r.range(4.4, 6.2),
      width: R * r.range(0.5, 0.78),
      height: R * r.range(0.42, 0.66),
      bend: (r() - 0.5) * 0.38,
    });
  }
  return toes;
}

/** the variant's bark-tile mapping: along-stem stretch and offset, around-stem offset and spiral shear */
export function whiteBarkTileMapping(p: WhiteBarkParams) {
  const r = baseRngFor(p).fork('uv');
  return { vStretch: r.range(0.92, 1.08), vOffset: r.range(0, 1), uOffset: r.range(0, 1), uShear: r.range(0.1, 0.17) };
}

export function createWhiteBarkTree(p: WhiteBarkParams, palette: Palette, detail: Detail): TreeAsset {
  const rng = createRng(`whitebark/${p.seed}`);
  const bt = (a: number, b: number) => between(rng, a, b);
  const wood = new GeometryWriter(detail);
  const leaves = new GeometryWriter(detail);
  const H = p.height;
  const R = p.trunkRadius;
  /**
   * Round 52 (the owner's 09-23 markup: pale poles in grey haze). `barkWhite` × 1.12 put the stem
   * at ≈ 0.62 linear — brighter than the haze it stands in from 20 m out, so a white-bark read as
   * a lit stick rather than a tree. × 0.94 with a tenth drawn back toward the grey keeps the
   * species pale (it is still the palest bark in the world by a wide margin) without the glow;
   * the marks in `WHITE_BARK_COLOR` carry the reading that the brightness used to.
   */
  const white = new Color(palette.barkWhite).multiplyScalar(0.94).lerp(new Color(palette.barkGrey), 0.1);
  const grey = new Color(palette.barkGrey);
  const dark = new Color(palette.barkDark);
  const canopy = new Color(palette.leafCanopy);
  const sunny = new Color(palette.leafSun);
  const greyHeight = 0.9 + H * 0.12;

  const trunkColor = (pt: Vector3, _t: number) => {
    const w = smoothstep(0.15, greyHeight, pt.y);
    return grey.clone().lerp(white, w).lerp(dark, 0.25 * (1 - smoothstep(-0.2, 0.5, pt.y)));
  };
  const branchColor = (radius: number) => {
    // thick boughs stay pale, twigs go dark brown like real birch
    const w = smoothstep(0.004, 0.05, radius);
    return dark.clone().lerp(white.clone().multiplyScalar(0.94), w);
  };

  // ---------- trunk ----------
  const crownRadius = H * p.crownWidth;
  const stemHeight = H * 0.915;
  const lean = Math.tan((p.leanDeg * Math.PI) / 180) * stemHeight;
  const stemTarget = new Vector3(Math.cos(p.leanAzimuth) * lean, stemHeight, Math.sin(p.leanAzimuth) * lean);
  const skirt = 0.5;
  const trunk = growthPath(new Vector3(0, -skirt, 0), stemTarget, UP, rng, 26, 0.22);
  const tipRadius = 0.02;
  /**
   * Round 47 (survey-2 #31, `sn-whitebark-base`: "no root flare, painted tiling"). Every base
   * feature below draws from `baseRng`, never from `rng` (see baseRngFor); the trunk sweep takes
   * its draws up front, and the five draws a root the round-46 buttresses took are still taken
   * (and dropped) below, so the crown's stream is untouched.
   */
  const baseRng = baseRngFor(p);
  /** the stem's size class: the flare's heights scale with the girth (a sapling's foot is a hand tall) */
  const girth = Math.min(1.2, Math.max(0.35, R / 0.3));
  /**
   * Round 50 (W08 at C, fable-5 on take-0123: "the stem is still a straight-sided cylinder with no
   * taper and no irregularity"). `growthPath`'s bends are four draws that can land near zero — the
   * survey stem's did — so the lower stem carries its own bow or S: 0.3–0.55 R at the belly (a
   * birch's, seen from 20 m as an edge that is not a rule) in a per-stem direction, zero at the
   * foot (the flare, the toes and the seated-root mesh stand where they did) and zero again from
   * half height. The bow moves the SWEPT SURFACE only (`trunkDense`, below): every branch, limb and
   * shoot keeps sampling the unbent `trunk`, so the crown, the low boughs, their leaves and the
   * asset's bounds are byte-identical — `height` / `radius` feed the placement sampler, and a bend
   * the limbs followed re-rolled 18 placements. Their origins stay inside the stem (0.55 R of
   * offset against a shouldered radius ≥ 1.1 R there). Drawn from `baseRng`; the same at every LOD.
   */
  const sway = baseRng.fork('stem-sway-50');
  const swayAmp = R * sway.range(0.3, 0.55) * (p.age === 'sapling' ? 0.6 : 1);
  const swayWaves = sway.range(0.8, 1.3);
  const swayPhase = sway.range(0, TAU);
  const swayAz = sway.range(0, TAU);
  /** the bow's lateral offset at stem fraction `t` — applied to the sweep's polyline only (below) */
  const swayAt = (t: number) => smoothstep(0, 0.12, t) * (1 - smoothstep(0.36, 0.5, t)) * swayAmp * Math.sin(TAU * swayWaves * t + swayPhase);
  /**
   * The butt flare as a radius multiplier at height `h` above the ground: a sharp foot swell
   * (e-fold 14 cm on a mature stem) over a longer butt swell, +88 % at the ground line, +16 % at
   * 0.6 m, +4 % at 2 m — the same at every LOD so the three meshes keep one silhouette. The
   * old profile (+70 % at the ground fading over 2 m) was too gradual to read as a flare at 2 m.
   */
  /**
   * Round 50 (W08's "tapered" at C): the flare's terms are spent by 2 m, and above the flower line
   * — the only part of the survey stem camera C sees, 1–5 m — the stem was a 1.3 : 1 cone that reads
   * as a pole at 22 m. The butt taper of the reference's stems runs higher: a shoulder of +22–34 %
   * (per stem, `baseRng`) that rises from the toes' crest (0.35–1.1 m, so the foot, the toes and the
   * roots mesh keep their radius) and is gone by 0.36 H (4.6 m on the survey stem, 2.9 m on a young
   * one). Same at every LOD.
   */
  const shoulder = baseRng.fork('shoulder-50').range(0.22, 0.34);
  const shoulderTop = Math.max(2.2, H * 0.36);
  const flareAt = (h: number) => {
    const a = Math.max(0, h);
    const bump = smoothstep(0.35, 1.1, a) * (1 - smoothstep(1.4, shoulderTop, a));
    return 1 + 0.5 * Math.exp(-a / (0.14 * girth)) + 0.28 * Math.exp(-a / (0.5 * girth)) + 0.1 * Math.exp(-a / (1.8 * girth)) + shoulder * bump;
  };
  const taperAt = (t: number) => tipRadius + (R - tipRadius) * Math.pow(1 - t, p.taperPower);
  // the coarse radii (27 rings) keep feeding the epicormic shoots below, as before
  const trunkRadii = trunk.map((pt, i) => taperAt(i / (trunk.length - 1)) * flareAt(pt.y));
  /**
   * The sweep itself runs on a densified copy of the same polyline — points ON the coarse
   * segments, so the surface is the same shape and `sample(trunk, t)` for every branch is
   * untouched — with a ring every 18 cm below 3 m, 35 cm to 6 m, 60 cm above: the coarse 0.5 m
   * rings could not hold the flare's 14 cm foot swell, the toe fluting or a 10 cm dark band.
   */
  const trunkDense: Vector3[] = [];
  const trunkDenseT: number[] = [];
  for (let i = 0; i < trunk.length - 1; i++) {
    const a = trunk[i];
    const b = trunk[i + 1];
    const spacing = a.y < 3 ? 0.18 : a.y < 6 ? 0.35 : 0.6;
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / spacing));
    for (let k = 0; k < n; k++) {
      const t = (i + k / n) / (trunk.length - 1);
      const w = swayAt(t);
      trunkDense.push(a.clone().lerp(b, k / n).add(_sway.set(Math.cos(swayAz) * w, 0, Math.sin(swayAz) * w)));
      trunkDenseT.push(t);
    }
  }
  trunkDense.push(trunk[trunk.length - 1].clone());
  trunkDenseT.push(1);
  const trunkDenseRadii = trunkDense.map((pt, i) => taperAt(trunkDenseT[i]) * flareAt(pt.y));
  // the trunk's draws are taken for 12 sides at every LOD (the stream after them never moves);
  // the high mesh — the one drawn at 1–3 m — rounds the stem with 18 sides on the same grain and
  // peels the bark in shallow papery ledges (1.8 % of the radius, tilted a little around the
  // stem), the survey's "smooth 12-gon at 1.5 m"
  const trunkSides = 12;
  const highSides = detail === 'high' ? 18 : trunkSides;
  const trunkDraws = consumeTubeDraws(rng, trunkSides);
  if (highSides !== trunkSides) trunkDraws.grain = Array.from({ length: highSides }, (_, j) => trunkDraws.grain[Math.floor((j / highSides) * trunkSides)]);
  const plateBump = detail === 'high' ? (angle: number, distance: number, t: number) => 1 + 0.018 * (1 - t) * Math.sin(distance * 6.5 + 1.4 * Math.sin(angle * 2 + trunkDraws.phase)) : undefined;

  // the five draws a root the round-46 buttresses took (jitter, length, width, height, bend),
  // still taken so everything after them in the stream — the crown — is where it was; the toes
  // themselves are `whiteBarkToeSpecs` and are built per instance on the terrain
  // (createWhiteBarkRoots), not in this instanced geometry
  for (let i = 0; i < p.roots * 5; i++) rng();
  const toes = whiteBarkToeSpecs(p);
  /**
   * Fluting: each toe continues up the foot as a ridge (the ring angle of a world azimuth φ is
   * −φ in the sweep's base frame, u = +X, v = −Z), +21 % of the radius at its crest on the
   * ground line, the hollows between the toes −10 % (shaded by `creviceShade`), fading out by
   * ≈ 0.9 m on a mature stem.
   */
  const toeTheta = toes.map((t) => -t.angle);
  const fluteBump = (angle: number, distance: number) => {
    const h = distance - skirt;
    const A = 0.34 * Math.exp(-Math.max(0, h) / (0.3 * girth));
    if (A < 0.004) return 1;
    let lobes = 0;
    for (const th of toeTheta) {
      const c = Math.cos(angle - th);
      if (c > 0) lobes += Math.pow(c, 7);
    }
    return 1 + A * (Math.min(1.2, lobes) - 0.3);
  };
  const trunkBump = plateBump ? (angle: number, distance: number, t: number) => plateBump(angle, distance, t) * fluteBump(angle, distance) : (angle: number, distance: number) => fluteBump(angle, distance);
  const trunkRows = tube(wood, trunkDense, trunkDenseRadii, highSides, rng, {
    color: trunkColor,
    roughness: p.ridge,
    barkTile: 1.0,
    flatBase: true,
    isTrunk: true,
    structural: true,
    stiffness: () => 1,
    draws: trunkDraws,
    bump: trunkBump,
    creviceShade: 1.6,
  });

  // ---------- bark: break the tiling ----------
  // The sweep wrote v in metres along the stem (barkTile 1.0) — the survey's "~1 m vertical
  // repeat" was the bark tile itself. The trunk's v is rescaled to the taller tile
  // (WHITE_BARK_TILE_M) with a per-variant stretch and offset so no two variants show the same
  // scar at the same height, and the u is sheared into a slow spiral (0.1–0.17 wraps per metre)
  // so a mark never stacks above itself.
  const { vStretch, vOffset, uOffset, uShear } = whiteBarkTileMapping(p);
  const rescaleRows = (rows: number[][], stretch: number, offset: number, shear: number, uShift: number) => {
    for (const row of rows) {
      for (const idx of row) {
        const along = wood.uvs[idx * 2 + 1] * stretch;
        wood.uvs[idx * 2 + 1] = along / WHITE_BARK_TILE_M + offset;
        wood.uvs[idx * 2] += uShift + shear * along;
      }
    }
  };
  rescaleRows(trunkRows, vStretch, vOffset, uShear, uOffset);

  // ---------- bark: sooty foot and dark lenticel bands (per variant, per vertex) ----------
  // The ring colour the sweep wrote is one value a ring; the foot and the bands want a ragged
  // margin around the stem, so the trunk vertices are re-tinted here from their own height and
  // azimuth: a dark, rough foot (birch stems are near-black and fissured for the first
  // 0.5–0.9 m), and 2–4 dark bands between 0.5 and 4.2 m, each 6–14 cm tall, wandering ± 6 cm
  // around the stem — the vertex-colour octave under the tile's own bands.
  const bandRng = baseRng.fork('bands');
  const footNoise = new Noise2D(`${p.seed}/foot`);
  const footTop = (0.35 + bandRng() * 0.3) * girth;
  const bands = Array.from({ length: p.age === 'sapling' ? 1 : 2 + bandRng.int(0, 3) }, () => ({
    y: bandRng.range(0.5, Math.min(4.2, H * 0.5)),
    sigma: bandRng.range(0.06, 0.14),
    strength: bandRng.range(0.2, 0.45),
    wobble: bandRng.range(0.03, 0.07),
    phase: bandRng.range(0, 100),
  }));
  // Round 48's vertex-colour broad bands and chevrons (the range-48 fork) retired in round 49: the
  // tile carries the large marks at texel resolution now (bark-texture.ts), and fable-5's review
  // found stems showing both — a soft zone above a crisp band — and three bands plus two chevrons
  // on 6 m of stem busy against ref-04's one or two. The 6–14 cm bands and the foot stay.
  const tinted = new Color();
  for (let k = 0; k < trunkRows.length; k++) {
    const centre = trunkDense[Math.min(k, trunkDense.length - 1)];
    for (const idx of trunkRows[k]) {
      const x = wood.positions[idx * 3] - centre.x;
      const y = wood.positions[idx * 3 + 1];
      const z = wood.positions[idx * 3 + 2] - centre.z;
      const phi = Math.atan2(z, x);
      const cx = Math.cos(phi) * 1.5;
      const cz = Math.sin(phi) * 1.5;
      const rag = footNoise.noise(cx + y * 2.1, cz + 7) * 0.18 * girth;
      const foot = 1 - smoothstep(footTop * 0.3, footTop, y + rag);
      let soot = 0.5 * foot;
      for (const b of bands) {
        const wob = footNoise.noise(cx * 1.3 + b.phase, cz * 1.3) * b.wobble;
        const d = (y - b.y - wob) / b.sigma;
        soot += b.strength * Math.exp(-d * d * 0.5);
      }
      soot = Math.min(0.72, soot);
      if (soot < 0.01) continue;
      tinted.setRGB(wood.colors[idx * 3], wood.colors[idx * 3 + 1], wood.colors[idx * 3 + 2]);
      tinted.lerp(dark, soot * 0.75).multiplyScalar(1 - soot * 0.3);
      wood.colors[idx * 3] = tinted.r;
      wood.colors[idx * 3 + 1] = tinted.g;
      wood.colors[idx * 3 + 2] = tinted.b;
    }
  }

  // ---------- peeling paper curls (the near LOD, drawn within 20 m) ----------
  // Strips of the outer paper that have come loose along a seam and scrolled outward, 6–22 cm
  // along the stem's girth, at 0.9–4.2 m (most between 1 and 3 m, where a walker looks): the
  // pale outer face turning to the warm inner bark as the strip curls over, the free edge
  // quivering a little in the wind. Read off the finished rings so they sit on the bark exactly.
  if (detail === 'high') {
    const curlRng = baseRng.fork('curls');
    const curls = p.age === 'sapling' ? curlRng.int(1, 4) : p.age === 'young' ? curlRng.int(5, 10) : curlRng.int(10, 17);
    const innerBark = new Color(0xc9a070).lerp(dark, 0.12);
    for (let i = 0; i < curls; i++) {
      const y = 0.9 + Math.pow(curlRng(), 1.6) * 3.3;
      if (y > H * 0.45) continue;
      paperCurl(wood, trunkRows, trunkDense, y, curlRng() * TAU, innerBark, curlRng, trunkDraws.windPhase);
    }
  }

  // ---------- leaf sprays ----------
  /**
   * Round 50 (W08 at C, "a bough that shows"): true while a low bough's lobe is foliated. The crown's
   * distance meshes keep one leaf in 6 / 12 at 2.2 / 3.2 × — the right trade for a roof seen at
   * 20–44 m, but a low bough's lobe (≈ 150 laminae) thinned to 25 at 22 m read as a few flat cards
   * floating beside the survey stem. The low boughs — the part of the tree at a walker's eye and in
   * frame C — keep one in 2 / 4 at 1.3 / 2.0 × (the same covered area, scale² / every ≈ 0.85–1.0);
   * ≈ +100 laminae per mature medium instance. Retention is by leaf ordinal (writer.ts addLeaf), so
   * the stream and the high mesh are untouched.
   */
  let boughSpray = false;
  const leafOpts = (radius: number) => ({
    widthRatio: 0.69,
    wideFirst: 1,
    wideSecond: 0.54,
    stiffness: stiffnessFor(radius),
    flutter: 0.016,
    // round 49 (W38): the distance meshes keep one leaf in 6 / 12 (was 5 / 10) at the size that
    // holds the same covered area (scale² / every ≈ 0.8) — 4–10 px laminae at 20–44 m either way.
    // Round 51 (W38 again, A at 8.80 M with 200 K under the ceiling): one in 8 / 16 at 2.53 / 3.67 ×
    // (the same 0.8) — a quarter fewer distance laminae, 5–13 px at 20–44 m; the low boughs keep
    // their 2 / 4 (they are the part of the tree in frame C)
    mediumEvery: boughSpray ? 2 : 8,
    mediumScale: boughSpray ? 1.3 : 2.53,
    lowEvery: boughSpray ? 4 : 16,
    lowScale: boughSpray ? 2.0 : 3.67,
  });

  /** lobe context for interior shading: leaves deep inside a lobe are darker (self-shadowed) */
  let lobe: { center: Vector3; hR: number; vR: number } | null = null;
  /**
   * Round 47 (the onboarding block's crown item, pose `f4-crown-up`: a lobe seen from 3–10 m
   * below was one flat pale mass of same-toned laminae). Per-leaf tone variance beyond the
   * sun-share draw, from its own fork so the main stream — every leaf's position — is untouched.
   */
  const toneRng = baseRng.fork('leaf-tone');
  function leafSpray(path: Vector3[], pathRadius: number, count: number, vigor = 1, startT = 0.15) {
    count = Math.max(1, Math.round(count * p.leafDensity * 1.75));
    const phase = rng() * TAU;
    const opts = leafOpts(pathRadius);
    for (let j = 0; j < count; j++) {
      const t = startT + ((1 - startT) * (j + bt(0.15, 0.85))) / count;
      const base = sample(path, t);
      const axis = tangent(path, t);
      const [u, v] = frame(axis);
      const angle = phase + j * 2.399963229728653 + bt(-0.3, 0.3);
      const outward = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle));
      const direction = axis
        .clone()
        .multiplyScalar(bt(0.28, 0.67))
        .addScaledVector(outward, 1)
        .addScaledVector(UP, bt(-0.18, 0.42) - p.droop * 0.15)
        .normalize();
      // outer/upper leaves catch the sun: lerp toward the bright palette green
      const heightF = base.y / H;
      const outF = Math.hypot(base.x, base.z) / Math.max(0.5, crownRadius);
      const sun = Math.min(1, Math.max(0, (heightF - 0.5) * 1.2 + outF * 0.35)) * bt(0.35, 1);
      // layering (measured at `f4-crown-up`, the lobe seen from 7 m below). The vertex tone alone
      // cannot carry it — the leaf shade floor (materials.ts) keeps only 0.4 of the albedo's
      // variation on a shaded lamina (a 0.55–1.14 tone range moved the lobe's sd 21.2 → 21.5) —
      // so the share of the shade fill itself (transmission, ambient, floor) is written per leaf
      // through `leafShade` (writer.ts aRoot.w). A structured term alone (core and underside
      // darker) only lowered the level: from below one sees the lobe's bottom shell, whose leaves
      // all share it (sd unchanged at 21.2). What reads as layers is tone variation between
      // NEIGHBOURING visible leaves — a backlit thin lamina beside a stacked opaque one — so each
      // leaf's fill share is the structured term × a 0.75–1.25 per-leaf draw: the visible
      // underside spans 0.55–1.0 of the fill instead of one value. The lit rim/top leaves' tone
      // rises (× 1.12) against the shaded ones' fall so the crown's level holds where it is lit.
      let layer = 1;
      let shade = 1;
      let sunShare = 1;
      if (lobe) {
        const shell = smoothstep(0.2, 0.9, base.distanceTo(lobe.center) / Math.max(0.3, lobe.hR));
        const top = 0.5 + 0.5 * Math.max(-1, Math.min(1, (base.y - lobe.center.y) / Math.max(0.2, lobe.vR)));
        // Round 48 (GOAL_MODE fable-4 #2; fable-5 on the clearing stems: "crowns are lime cards
        // brighter than the haze"): the albedo carries the layering, since the shade fill only
        // keeps part of it — the lobe's core at 0.55 of the rim's tone, the underside of a
        // drooping lamina low in the lobe darker again, the sunlit palette reserved for the rim
        // and top (the lit edge against the sky); the round-47 × 1.12 boost is gone, so the crown's
        // level sits under the haze the way the reference's foliage does.
        const under = 0.5 - 0.5 * Math.max(-1, Math.min(1, direction.y / 0.7));
        layer = (0.55 + 0.45 * shell) * (0.86 + 0.14 * top) * (1 - 0.15 * under * (1 - top));
        sunShare = 0.3 + 0.7 * shell;
        const structured = 0.5 + 0.5 * (0.35 + 0.65 * shell) * (0.55 + 0.45 * top);
        shade = Math.min(1, Math.max(0.3, structured * toneRng.range(0.75, 1.25)));
        // What separates NEIGHBOURING laminae in a real crown seen from below is occlusion: near
        // half of them sit in the shadow of the leaves above (dark, little fill), a fifth hang
        // free against the sky (backlit, full fill). Measured at `f4-crown-up`: the structured
        // terms alone moved the crown's level, not its spread (sd 21 → 20), because the bottom
        // shell's leaves all share them — so the draw is per leaf and bimodal, not a ± 20 % blur
        // (35 % at 0.45 took the near lobe's sd 19.5 → 22.2; ref-04's foliage is dark against
        // the haze with few lit rims, so the share and the darkness were raised from there).
        const roll = toneRng();
        if (roll < 0.45) {
          layer *= 0.4;
          shade = Math.max(0.1, shade * 0.35);
        } else if (roll > 0.8) {
          layer *= 1.08;
          shade = 1;
        }
      }
      const color = canopy.clone().lerp(sunny, sun * sunShare).multiplyScalar(vigor * layer * toneRng.range(0.92, 1.08));
      const leafLength = bt(p.leafSize[0], p.leafSize[1]) * bt(0.91, 1.12);
      leaves.leafShade = shade;
      addLeaf(leaves, base, direction, leafLength, color, rng, opts);
      leaves.leafShade = 1;
    }
  }

  /** Volumetric leaf lobe: forks reach to its sides, back and interior; every leaf sits on a twig. */
  function foliateLobe(bough: Vector3[], center: Vector3, hR: number, vR: number, boughRadius: number, subCount = 3, twigCount = 5, sprigCount = 6) {
    lobe = { center, hR, vR };
    leafSpray(bough, boughRadius * 0.4, 10, 0.94, 0.78);
    const phase = rng() * TAU;
    for (let j = 0; j < subCount; j++) {
      const attachment = 0.4 + (j / subCount) * 0.48 + bt(-0.035, 0.035);
      const origin = sample(bough, attachment);
      const a = phase + j * 2.39996 + bt(-0.45, 0.45);
      const elevation = bt(-0.55, 0.8);
      const reach = hR * Math.sqrt(1 - elevation * elevation) * bt(0.58, 0.95);
      const target = center.clone().add(new Vector3(Math.cos(a) * reach, elevation * vR, Math.sin(a) * reach));
      const secondary = growthPath(origin, target, tangent(bough, attachment), rng, 6, 0.85);
      const secondaryRadius = Math.max(0.015, boughRadius * Math.pow(1 - attachment, 0.9) * 0.53);
      tube(wood, secondary, taper(secondary, secondaryRadius, 0.0038), 4, rng, { color: branchColor(secondaryRadius), roughness: 0.027 });
      leafSpray(secondary, secondaryRadius * 0.5, 8, bt(0.88, 1.03), 0.65);

      for (let k = 0; k < twigCount; k++) {
        const twigT = 0.18 + (k / twigCount) * 0.72 + bt(-0.025, 0.025);
        const twigOrigin = sample(secondary, twigT);
        const twigAngle = a - 1.08 + (k / Math.max(1, twigCount - 1)) * 2.16 + bt(-0.23, 0.23);
        const twigElevation = bt(-0.75, 0.82);
        const twigReach = hR * (k === 2 ? bt(0.16, 0.36) : bt(0.57, 1.04));
        const twigTarget = center.clone().add(new Vector3(Math.cos(twigAngle) * twigReach, twigElevation * vR, Math.sin(twigAngle) * twigReach));
        twigTarget.y -= p.droop * bt(0.1, 0.6);
        const twig = growthPath(twigOrigin, twigTarget, tangent(secondary, twigT), rng, 4, 0.64);
        const twigRadius = Math.max(0.005, secondaryRadius * (1 - twigT) * 0.39);
        // Round 49 (W38): a 5–20 mm twig is under a pixel beyond the 20 m swap — the medium mesh
        // takes the tube's draws (so every leaf stays where the high mesh puts it) and builds no
        // wood for it; the low mesh already skips it (writer.ts, < 12 mm). Its leaves are kept.
        if (detail === 'medium' && twigRadius < 0.012) consumeTubeDraws(rng, 3);
        else tube(wood, twig, taper(twig, twigRadius, 0.0016), 3, rng, { color: branchColor(twigRadius), roughness: 0.015 });
        leafSpray(twig, twigRadius * 0.6, 14, bt(0.9, 1.04), 0.3);

        const sprigPhase = rng() * TAU;
        for (let s = 0; s < sprigCount; s++) {
          const sprigT = 0.12 + s * (0.84 / sprigCount);
          const start = sample(twig, sprigT);
          const axis = tangent(twig, sprigT);
          const [u, v] = frame(axis);
          const angle = sprigPhase + s * 2.39996 + bt(-0.25, 0.25);
          const direction = u
            .clone()
            .multiplyScalar(Math.cos(angle))
            .addScaledVector(v, Math.sin(angle))
            .addScaledVector(axis, 0.36)
            .addScaledVector(UP, -0.05 - p.droop * 0.3)
            .normalize();
          const end = start.clone().addScaledVector(direction, bt(0.26, 0.5));
          const sprig = [start, end];
          tube(wood, sprig, [0.0036, 0.0011], 3, rng, { color: dark, roughness: 0 });
          leafSpray(sprig, 0.003, 12, bt(0.9, 1.04), 0.05);
        }
      }
    }
    lobe = null;
  }

  // ---------- scaffolds: central leader + diverging side leaders ----------
  interface Scaffold {
    path: Vector3[];
    radius: number;
    angle: number;
    attachMin: number;
    attachSpan: number;
    boughs: number;
    central?: boolean;
  }
  const scaffolds: Scaffold[] = [
    { path: trunk, radius: R * 0.44, angle: p.leanAzimuth, attachMin: 0.56, attachSpan: 0.37, boughs: p.boughs, central: true },
  ];
  for (let i = 0; i < p.sideLeaders; i++) {
    const t = 0.47 + i * 0.16 + bt(-0.035, 0.035);
    const origin = sample(trunk, t);
    const angle = p.leanAzimuth + 1.2 + i * 2.65 + bt(-0.6, 0.6);
    const reach = crownRadius * bt(0.42, 0.64);
    const target = new Vector3(Math.cos(angle) * reach, H * bt(0.8, 0.88), Math.sin(angle) * reach);
    const path = divergingLeaderPath(origin, target, rng, 16);
    const radius = R * Math.pow(1 - t, 0.8) * bt(0.53, 0.64);
    const leaderRows = tube(wood, path, taper(path, radius, 0.014), 8, rng, { color: trunkColor, roughness: p.ridge * 0.7, barkTile: 1.0 });
    // the leaders wear the same tile at the trunk's scale, each starting on a different scar
    rescaleRows(leaderRows, vStretch, vOffset + 0.37 + i * 0.29, 0, 0);
    scaffolds.push({ path, radius, angle, attachMin: 0.35, attachSpan: 0.55, boughs: Math.max(3, p.boughs - 1) });
  }

  const isSapling = p.age === 'sapling';
  for (const scaffold of scaffolds) {
    for (let j = 0; j < scaffold.boughs; j++) {
      const t = scaffold.attachMin + (j / Math.max(1, scaffold.boughs - 1)) * scaffold.attachSpan + bt(-0.025, 0.025);
      const origin = sample(scaffold.path, t);
      const inward = j >= 2 && !(scaffold.boughs === 5 && j === 3);
      const angle = scaffold.central
        ? scaffold.angle + j * 2.13 + bt(-0.6, 0.6)
        : scaffold.angle + (j === 0 ? -1.02 : j === 1 ? 0.96 : j === 2 ? 1.5 : j === 3 ? -0.06 : -0.7) + bt(-0.33, 0.33);
      const radial = crownRadius * (inward ? bt(0.17, 0.38) : bt(0.63, 0.84));
      const lobeY = H * (j === 0 ? bt(0.66, 0.75) : j === 1 ? bt(0.77, 0.85) : j === 2 ? bt(0.765, 0.82) : inward ? bt(0.86, 0.93) : bt(0.82, 0.88));
      const center = new Vector3(Math.cos(angle) * radial, lobeY, Math.sin(angle) * radial);
      const end = center.clone().add(new Vector3(bt(-0.22, 0.22), bt(-0.32, 0.04), bt(-0.22, 0.22)));
      const bough = growthPath(origin, end, tangent(scaffold.path, t), rng, 12, 0.66);
      const radius = Math.max(0.03, scaffold.radius * Math.pow(1 - t, 0.73) * bt(0.5, 0.72));
      tube(wood, bough, taper(bough, radius, 0.007, 1.03), 6, rng, { color: branchColor(radius), roughness: p.ridge * 0.5 });
      // lobes overlap into a continuous, broken crown rather than isolated tufts
      const hR = crownRadius * bt(inward ? 0.34 : 0.38, inward ? 0.44 : 0.5);
      const vR = H * bt(0.11, 0.15);
      if (isSapling) foliateLobe(bough, center, hR, vR, radius, 2, 4, 4);
      else foliateLobe(bough, center, hR, vR, radius);
    }
  }

  // ---------- low boughs ----------
  // Round 49 (fable-5's W08 at C: "a straight pale pole with a sprig" — camera C sees the survey
  // tree's lowest 6 m at 22.7 m, crown out of frame, and the old pruning-history limb's 1 m tuft
  // was the sprig). Every young and mature stem now carries one or two low boughs at 30–42 % of
  // its height — a limb thick enough to read, a lobe 1.7 m across and 1.8 m tall — the foliage in
  // a walker's eye line at 2–7 m. Built after the crown, so the crown's stream is untouched.
  for (let i = 0; i < p.lowerLimbs; i++) {
    const main = i === 0;
    // the main bough leaves a MATURE stem at 12–17 % of the height (1.55–2.2 m on the survey stem, its
    // lobe centred at 2.3–3.6 m): camera C's item HUD hides the stem above ≈ 5 m there and the giant's
    // lantern limb crosses it at 4–4.5 m, so at 22–34 % the lobe sat half under the HUD (fable-5 on
    // take-0123, "a bough that shows") and at 15–25 % behind the limb; below the limb it reads against
    // the haze. The lobe's underside stays ≥ 1.8 m over the ground. A young stem keeps 22–34 %
    // (1.5–3.4 m: lower and its leaves would brush a walker's head by the clearing's paths); the second,
    // where drawn, at 30–42 %. The same draw either way; the lobe's reach is unchanged.
    const t = main ? (p.age === 'mature' ? bt(0.12, 0.17) : bt(0.22, 0.34)) : bt(0.3, 0.42);
    const origin = sample(trunk, t);
    const angle = p.leanAzimuth + 1.9 + i * 2.5 + bt(-0.55, 0.55);
    const reach = crownRadius * (main ? bt(0.45, 0.7) : bt(0.35, 0.58));
    const rise = H * (main ? bt(0.06, 0.11) : bt(0.065, 0.12));
    // the main lobe flatter than round 49's (0.05 H, was 0.075): a drooping birch bough's spray, and at
    // camera C it keeps most of its laminae under the giant's lantern limb (which covers ≈ 3–4 m on
    // the survey stem) while the underside clears a walker
    const lobeVR = main ? H * 0.05 : H * 0.04;
    // the lobe's underside stays over a walker's head (WALKER_CLEARANCE_M): the main bough leaves a
    // mature stem at 1.55–2.2 m and rises to its lobe, and with a low rise the lobe's bottom laminae
    // reached 1.4 m — measured standing 3.5 m off the survey stem along the bough. The clamp lifts
    // the lobe's centre only where the draw would put it lower; the reach and the horizontal extent
    // (the asset's bounds) do not move.
    const centerY = main ? Math.max(origin.y + rise, WALKER_CLEARANCE_M + lobeVR + 0.1) : origin.y + rise;
    const center = new Vector3(origin.x + Math.cos(angle) * reach, centerY, origin.z + Math.sin(angle) * reach);
    const path = growthPath(origin, center, tangent(trunk, t).lerp(new Vector3(Math.cos(angle), 0.2, Math.sin(angle)), 0.62), rng, 8, 1.1);
    const radius = R * (main ? bt(0.15, 0.21) : bt(0.12, 0.18));
    tube(wood, path, taper(path, radius, 0.004), 6, rng, { color: branchColor(radius), roughness: p.ridge * 0.5 });
    // the main bough: a 1.7 m lobe in a few big tufts (W38: ≈ +2 K high-LOD triangles a stem);
    // the second, where drawn, the old small tuft
    boughSpray = true;
    if (main) foliateLobe(path, center, crownRadius * 0.34, lobeVR, radius, 2, 3, 4);
    else foliateLobe(path, center, crownRadius * 0.17, lobeVR, radius, 2, 3, 4);
    boughSpray = false;
  }

  // ---------- epicormic shoots through the trunk surface (detail near the eye) ----------
  if (p.age === 'mature') {
    const shoots = rng.int(0, 3);
    for (let i = 0; i < shoots; i++) {
      const t = 0.2 + (i / Math.max(1, shoots - 1)) * 0.3 + bt(-0.04, 0.04);
      // on the BENT axis (the sweep's, `swayAt`): a shoot seated on the unbent path and pointing into
      // the bow was swallowed by the moved surface (`sn-whitebark-base`, the stub at 1.6 m)
      const origin = sample(trunk, t).add(_sway.set(Math.cos(swayAz) * swayAt(t), 0, Math.sin(swayAz) * swayAt(t)));
      const angle = rng() * TAU;
      const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
      const ri = t * (trunkRadii.length - 1);
      const radius = trunkRadii[Math.floor(ri)];
      const shoulder = origin.clone().addScaledVector(outward, radius * 1.14).addScaledVector(UP, 0.04);
      const end = shoulder.clone().addScaledVector(outward, 0.2 + rng() * 0.3).addScaledVector(UP, 0.12 + rng() * 0.2);
      const shoot = [origin, shoulder, end];
      tube(wood, shoot, [0.009, 0.0045, 0.0012], 3, rng, { color: dark, roughness: 0.012 });
      leafSpray(shoot, 0.005, 6, 0.94, 0.68);
    }
  }

  const geometry = mergeParts(`whitebark-${p.seed}-${detail}`, [wood.finish('wood'), leaves.finish('leaves')]);
  let radius = 0;
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) radius = Math.max(radius, Math.hypot(positions.getX(i), positions.getZ(i)));
  const height = geometry.boundingBox!.max.y;
  return {
    geometry,
    leafCount: leaves.leafCount,
    woodTriangles: wood.triangles,
    leafTriangles: leaves.triangles,
    height,
    radius,
  };
}

/** where a placed tree stands: world origin of its base, yaw and uniform scale (the instance matrix) */
export interface TreeFrame {
  origin: Vector3;
  yaw: number;
  scale: number;
  /** world terrain height */
  groundAt: (x: number, z: number) => number;
}

/**
 * One surface root, in WORLD space: a half-elliptic ridge from the trunk axis outward (hidden
 * inside the flare until it leaves it as a knuckle), its bed on the terrain under every section
 * — settling 4 cm into the soil at the flare, 10 cm a metre out, diving at the very end — the
 * crest tapering to nothing, the flanks 3 cm under the ground so the join never opens on any
 * slope. It wanders and knuckles along its length. Vertex colour darkens toward the tip
 * (soil-stained). aRoot.xyz is the tree's origin (the merged-mesh convention, writer.ts), so the
 * tree shader's sway anchor and base moss ring read it.
 */
function rootToe(writer: GeometryWriter, toe: ToeSpec, frame: TreeFrame, color: Color, rng: Rng, segments = 12) {
  const arc = 8;
  // the instance matrix rotates about +Y by `yaw`: (cos φ, sin φ) → (cos(φ − yaw), sin(φ − yaw))
  const angle = toe.angle - frame.yaw;
  const s = frame.scale;
  const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const knee = rng.range(0.38, 0.5);
  const kneeLift = rng.range(0.1, 0.28);
  const settle = rng.range(0.05, 0.1);
  const twist = rng.range(-0.25, 0.25);
  // the wander: a slow bend and a quicker wiggle, both growing from the trunk out; the knuckles:
  // the root rises and settles along its length
  const wanderPhase = rng() * TAU;
  const wiggle = rng.range(0.03, 0.07);
  const knucklePhase = rng() * TAU;
  const knuckles = rng.range(4.5, 7);
  const gnarl = rng.range(0.05, 0.1);
  const gnarlPhase = rng() * TAU;
  // the bark tile is magnified four-fold across the toe: the lenticel dashes at the trunk's
  // scale read as planking on a root, a soft smudge of them reads as root bark. The slice stays
  // inside v 0.34–0.60, the zone the tile keeps clear of its broad bands and chevrons (round 48)
  const uSlice = rng.range(0, 0.85);
  const vSlice = rng.range(0.34, 0.54);
  const rows: number[][] = [];
  const p = new Vector3();
  const length = toe.length * s;
  for (let k = 0; k < segments; k++) {
    const t = k / (segments - 1);
    const d = length * t;
    const kneeBump = Math.exp(-Math.pow((t - knee) / 0.11, 2));
    const out = smoothstep(0.25, 0.8, t);
    const wander = Math.sin(t * 2.5) * toe.bend * 0.4 + twist * t * t * 0.15 + out * (0.11 * Math.sin(t * 3.1 + wanderPhase) * Math.sign(toe.bend + 0.01) + wiggle * Math.sin(t * 7.3 + wanderPhase * 1.7));
    const centre = frame.origin.clone().addScaledVector(forward, d).addScaledVector(side, wander * length);
    const knuckle = 1 + 0.22 * Math.pow(Math.sin(t * knuckles + knucklePhase), 2) * (1 - t) * out;
    // the section tapers slowly and the bed dives early (−10 cm at half length, −25 cm at three
    // quarters), so the root goes under the soil while it is still fat — a visible pointed tip
    // read as a spike
    const w = (toe.width * Math.pow(1 - t, 0.9) * (1 + 0.22 * kneeBump) + 0.012) * s;
    const h = (toe.height * (0.3 + 0.7 * Math.pow(1 - t, 0.9)) * (1 + kneeLift * kneeBump) * knuckle * (1 - Math.pow(t, 4)) + 0.004) * s;
    const plunge = (-0.04 - settle * t - 0.34 * Math.pow(t, 3.2) + 0.015 * Math.sin(t * knuckles * 0.7 + knucklePhase)) * s;
    const row: number[] = [];
    for (let j = 0; j <= arc; j++) {
      const theta = (j / arc) * Math.PI;
      // a rounder dome than the buttress ridge, with a gnarl of ± 5–10 % on its surface
      const bulge = 1 + gnarl * Math.sin(theta * 3.3 + t * 9.1 + gnarlPhase) * Math.sin(t * 5.7 + theta + gnarlPhase);
      p.copy(centre).addScaledVector(side, Math.cos(theta) * w * bulge);
      const bed = frame.groundAt(p.x, p.z) + plunge;
      p.y = j === 0 || j === arc ? bed - 0.03 : bed + Math.pow(Math.sin(theta), 1.15) * h * bulge;
      // darker flanks, darker (soil-stained) toward the tip, a little mottle along the root
      const shade = (0.74 + 0.24 * Math.sin(theta)) * (1 - 0.3 * t) * (0.94 + 0.06 * Math.sin(t * 13 + theta * 2 + gnarlPhase));
      const idx = writer.vertex(p, color.clone().multiplyScalar(shade), uSlice + 0.15 * (j / arc), vSlice + (0.06 * d) / WHITE_BARK_TILE_M, 1, 0, 0);
      writer.roots[idx * 4] = frame.origin.x;
      writer.roots[idx * 4 + 1] = frame.origin.y;
      writer.roots[idx * 4 + 2] = frame.origin.z;
      row.push(idx);
    }
    if (k) {
      for (let j = 0; j < arc; j++) {
        writer.triangle(rows[k - 1][j], row[j], rows[k - 1][j + 1]);
        writer.triangle(rows[k - 1][j + 1], row[j], row[j + 1]);
      }
    }
    rows.push(row);
  }
}

/**
 * Round 50 (W08 at C — fable-5 on take-0123: "the C stem is plumb"). The rubric judges the white-barks
 * at frame C, where one stem stands at the right edge: the mature variant 7 at (−7.39, 12.87), whose
 * own 2–8° lean happens to point at the camera and foreshortens to plumb. A lean in the geometry moves
 * every crown's bounds (`TreeAsset.radius` feeds the placement sampler: 18 seats re-rolled, reverted
 * on r49b), so the hero stem leans by its INSTANCE matrix instead — a world-space tilt about the ground
 * point, applied after the yaw; position, yaw, scale, the asset and every other tree are untouched.
 * `toward` is the horizontal direction the top moves (into C's frame: camera-left at that spot).
 * Matched by position (0.6 m), so a re-roll upstream leaves the table inert rather than wrong.
 */
export const HERO_WHITE_BARK_TILTS: { x: number; z: number; tiltDeg: number; toward: [number, number] }[] = [
  { x: -7.39, z: 12.87, tiltDeg: 5.5, toward: [0.9, 0.43] },
];
const _tiltAxis = new Vector3();
/** the instance tilt for a seated white-bark, or null — see HERO_WHITE_BARK_TILTS */
export function whiteBarkTilt(x: number, z: number): Quaternion | null {
  for (const t of HERO_WHITE_BARK_TILTS) {
    if (Math.hypot(x - t.x, z - t.z) > 0.6) continue;
    const l = Math.hypot(t.toward[0], t.toward[1]) || 1;
    // up × toward: rotating +y about this axis moves the top along `toward`
    _tiltAxis.set(t.toward[1] / l, 0, -t.toward[0] / l);
    return new Quaternion().setFromAxisAngle(_tiltAxis, (t.tiltDeg * Math.PI) / 180);
  }
  return null;
}

export interface RootPlacement {
  variant: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

/**
 * Authored white-barks beyond `placeWhiteBark`'s 12–60 m ring (round 47 handoff → GOAL_MODE
 * fable-4 #1): young stems on the north clearing's banks, either side of `LAYOUT.northPath` and
 * west of the `ledgeTerrace` — ref-04's leaning trunk beside the ledge. Positions from
 * expansion-1; the east one is moved 0.6 m off the paving (8.0 m from the spine's axis, 1.6 m
 * from the flagstone edge) so no toe can lie across the slabs. Probed: all four on
 * vegetation-allowed bank ground, no path / structure mask, tilt 2–14°; the eye-level sight line
 * from the clearing toward (−8, −88) passes 2.3 m from the west-bank trunk and under its crown.
 */
export const CLEARING_WHITE_BARKS: { x: number; z: number; age: Age }[] = [
  { x: -7.6, z: -66.0, age: 'young' },
  { x: 6.2, z: -71.5, age: 'young' },
  { x: -6.0, z: -75.5, age: 'young' },
  { x: 8.0, z: -64.8, age: 'young' },
];

/**
 * The authored trees as placements, seated on `terrain.height`, cycling the variants of the
 * wanted age (the young ones: three of the ten), yaw and scale from their own seeded stream.
 * Appended to `whitePlacements` in trees/index.ts before the columns are seated (so
 * `seatBlocked` keeps column seats 2.5 m clear of them) and before the root mesh is built.
 */
export function authoredWhiteBarks(variants: WhiteBarkParams[], terrain: { height(x: number, z: number): number }): RootPlacement[] {
  const rng = createRng('whitebark/authored-clearing');
  const byAge = new Map<Age, number[]>();
  variants.forEach((v, i) => byAge.set(v.age, [...(byAge.get(v.age) ?? []), i]));
  return CLEARING_WHITE_BARKS.map((spot, k) => {
    const pool = byAge.get(spot.age) ?? [];
    const variant = pool.length ? pool[k % pool.length] : 0;
    return { variant, x: spot.x, y: terrain.height(spot.x, spot.z), z: spot.z, yaw: rng() * TAU, scale: rng.range(0.92, 1.08) };
  });
}

/**
 * The white-barks' root toes, seated on the terrain: one merged mesh for every placed tree (the
 * variants are InstancedMeshes, so their geometry cannot know the ground under each instance —
 * the round-46 buttresses were flat and floated wherever the ground fell away: the terrain drops
 * more than 15 cm within a 1.6 m toe reach under 39 of the 80 trees). Each tree's toes are the
 * variant's `whiteBarkToeSpecs`, rotated and scaled by its instance, every section's bed read
 * from `terrain.height` under it. One draw (+ its shadow), ≈ 45 k triangles for 82 trees (saplings skipped); the
 * tree material's wind anchor and base moss ring work per tree through aRoot.xyz.
 */
export function createWhiteBarkRoots(
  variants: WhiteBarkParams[],
  placements: RootPlacement[],
  terrain: { height(x: number, z: number): number },
  palette: Palette,
  material: Material,
  depthMaterial: Material,
  castShadow: boolean,
): Mesh {
  const wood = new GeometryWriter('high');
  const grey = new Color(palette.barkGrey);
  const dark = new Color(palette.barkDark);
  const rootColor = grey.clone().lerp(dark, 0.5);
  const groundAt = (x: number, z: number) => terrain.height(x, z);
  placements.forEach((pl, i) => {
    const p = variants[pl.variant];
    if (!p) return;
    // a sapling's toes (R 0.06–0.1: 0.3–0.6 m long, 2–5 cm tall) lie under the grass — not
    // built; a young stem's 0.6–1.2 m toes take 8 sections, a mature stem's 12 (round 48: the
    // mesh is always submitted, so it pays for its triangles on every view)
    if (p.age === 'sapling') return;
    const segments = p.age === 'young' ? 8 : 12;
    const toes = whiteBarkToeSpecs(p);
    const rng = baseRngFor(p).fork(`toe-shape-${i}`);
    const frame: TreeFrame = { origin: new Vector3(pl.x, pl.y, pl.z), yaw: pl.yaw, scale: pl.scale, groundAt };
    for (const toe of toes) rootToe(wood, toe, frame, rootColor, rng, segments);
  });
  const geometry = wood.positions.length ? wood.finish('whitebark-roots') : new BufferGeometry();
  const mesh = new Mesh(geometry, material);
  mesh.name = 'whitebark-roots';
  mesh.customDepthMaterial = depthMaterial;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.userData.kind = 'whitebark-roots';
  return mesh;
}

/**
 * A loose strip of the outer paper scrolled away from the bark: read off the finished trunk
 * rings (`rows` from `tube`, their centres) at height `y` and azimuth `phi`, so the strip's
 * attached edge lies on the actual bark surface and carries the bark's own UVs (the strip shows
 * the lenticels it peeled from). The scroll turns about an axis along the girth: outward by
 * r(1 − cos ψ), along the stem by r sin ψ, ψ running 1.6–4 rad to the free edge, which is
 * ragged and quivers in the wind (a small flutter amount on the wood vertex). The outer face is
 * paper-pale; past a quarter turn the strip shows its warm inner bark.
 */
function paperCurl(writer: GeometryWriter, rows: number[][], centres: Vector3[], y: number, phi: number, inner: Color, rng: Rng, windPhase: number) {
  let k = 0;
  while (k < rows.length - 2 && centres[k + 1].y < y) k++;
  const c0 = centres[k];
  const c1 = centres[k + 1];
  if (!c1 || c1.y <= c0.y) return;
  const f = clamp01((y - c0.y) / (c1.y - c0.y));
  const sides = rows[k].length - 1;
  const pos = (idx: number) => new Vector3(writer.positions[idx * 3], writer.positions[idx * 3 + 1], writer.positions[idx * 3 + 2]);
  // the ring side nearest the wanted azimuth, from the ring's real vertices
  let best = 0;
  let bestErr = Infinity;
  for (let j = 0; j < sides; j++) {
    const q = pos(rows[k][j]);
    const a = Math.atan2(q.z - c0.z, q.x - c0.x);
    const e = Math.abs(Math.atan2(Math.sin(a - phi), Math.cos(a - phi)));
    if (e < bestErr) {
      bestErr = e;
      best = j;
    }
  }
  const ringRadius = pos(rows[k][best]).distanceTo(c0);
  const sideLen = (TAU * ringRadius) / sides;
  const arcLen = rng.range(0.06, 0.2);
  const span = Math.max(1, Math.min(Math.floor(sides / 3), Math.round(arcLen / sideLen)));
  const steps = span * 2;
  const curlR = rng.range(0.012, 0.035);
  const psiMax = Math.min(4.0, Math.max(1.6, rng.range(0.04, 0.12) / curlR));
  const dir = rng() < 0.65 ? -1 : 1; // −1: the free edge hangs down
  const flutter = rng.range(0.003, 0.007);
  const nq = 5;
  const axis = c1.clone().sub(c0).normalize();
  const centre = c0.clone().lerp(c1, f);
  const grid: number[][] = [];
  const b = new Vector3();
  const n = new Vector3();
  const pt = new Vector3();
  const col = new Color();
  for (let i = 0; i <= steps; i++) {
    const js = best + (i / steps) * span;
    const j0 = Math.floor(js) % sides;
    const j1 = (j0 + 1) % sides;
    const fj = js - Math.floor(js);
    // the attached edge: between rings k and k+1, between sides j0 and j1
    const p00 = pos(rows[k][j0]);
    const p01 = pos(rows[k][j1]);
    const p10 = pos(rows[k + 1][j0]);
    const p11 = pos(rows[k + 1][j1]);
    b.copy(p00.lerp(p01, fj)).lerp(p10.lerp(p11, fj), f);
    n.copy(b).sub(centre);
    n.addScaledVector(axis, -n.dot(axis)).normalize();
    const u = (writer.uvs[rows[k][j0] * 2] * (1 - fj) + writer.uvs[rows[k][j1] * 2] * fj) * (1 - f) + (writer.uvs[rows[k + 1][j0] * 2] * (1 - fj) + writer.uvs[rows[k + 1][j1] * 2] * fj) * f;
    const v = writer.uvs[rows[k][j0] * 2 + 1] * (1 - f) + writer.uvs[rows[k + 1][j0] * 2 + 1] * f;
    // the free edge is ragged: each section scrolls a little more or less
    const psiHere = psiMax * (0.85 + 0.3 * rng());
    // the strip's outer face is the bark it came off — the ring's own (tinted) vertex colour, a
    // hair lighter — not a fixed paper white: at 1–3 m the stem is still in its grey lower bark
    const ringIdx = rows[k][j0];
    const barkHere = new Color(writer.colors[ringIdx * 3], writer.colors[ringIdx * 3 + 1], writer.colors[ringIdx * 3 + 2]).multiplyScalar(1.06);
    const innerHere = inner.clone().lerp(barkHere, 0.3);
    const column: number[] = [];
    for (let q = 0; q < nq; q++) {
      const s = q / (nq - 1);
      const psi = s * psiHere;
      pt.copy(b)
        .addScaledVector(n, 0.003 + curlR * (1 - Math.cos(psi)) + 0.004 * s)
        .addScaledVector(axis, dir * curlR * Math.sin(psi));
      col.copy(barkHere).lerp(innerHere, smoothstep(0.9, 2.2, psi));
      column.push(writer.vertex(pt, col, u, v + (dir * curlR * Math.sin(psi)) / WHITE_BARK_TILE_M, 1, windPhase, flutter * s * s, 0));
    }
    if (i) {
      for (let q = 0; q < nq - 1; q++) {
        writer.triangle(grid[i - 1][q], column[q], grid[i - 1][q + 1]);
        writer.triangle(grid[i - 1][q + 1], column[q], column[q + 1]);
      }
    }
    grid.push(column);
  }
}
