/**
 * Plant geometry variants (ferns, bushes, purple and white flowers, fiddleheads, broad-leaf
 * plants, seed-head stalks, clover, moss tufts, saplings). Each builder returns one geometry per
 * LOD, highest detail first. Derived from Verdant Forest by Leonxlnx (understory.js /
 * botanical-refinement.js); leaf, flower and bud shapes follow the owner's concept sheets
 * (reference/concepts/01, see reference/CONCEPTS.md — the sheets are never loaded at runtime).
 */
import { Vector3, type BufferGeometry } from 'three';
import { createRng, type Rng } from '../util/prng';
import { BROADLEAF_U, MeshBuilder, NOT_LAMINA, PETAL_U, TAU, V, bladeStrip, blend, curvedLeaf, disc, dome, foldedLeaf, lanceLeaf, lathe, pinnateLeaf, rgb, sampleCurve, shapedLeaf, tone, tube, valueNoise3, type LeafShape, type RGB } from './geometry';

/** `ultra` (round 40) is an extra near LOD a builder may offer above `high`; the default LOD list has none */
export type Detail = 'ultra' | 'high' | 'mid' | 'low';
const DETAILS: Detail[] = ['high', 'mid', 'low'];

/**
 * Round 43 — the close-scale herb layer. Inside these camera distances (m, XZ like every LOD
 * range) the flowers, broad leaves, clover, moss cushions and litter draw an `ultra` LOD built
 * from the high LOD's own layout stream (same stems, same blooms, same leaves — the switch does
 * not pop) with the detail the owner's sheets show at arm's length: five separate cupped petals
 * round a stamen boss, bells with a dark throat, closed buds, veined laminae on bent petioles,
 * lumpy cushions. The rings are sized against the six fixed cameras' budgets (vegetation-22's
 * per-view isolation: every ultra instance a fixed camera frames costs its ultra geometry × its
 * pack width): the flowers keep 4 m (shot D frames three clumps inside it, drawn one variant a
 * draw), the broad leaves and clover 2.5 m (A's verge held 21 rosettes at 3.5 m, ≈ 40 K), the
 * cushions 3 m — the player's eye is 1.6 m up, so 2.5 m on the ground is 3 m from the eye.
 */
export const FLOWER_ULTRA_M = 4;
export const BROADLEAF_ULTRA_M = 2.5;
export const MOSS_ULTRA_M = 3;
export const FLOWER_DETAILS: readonly Detail[] = ['ultra', 'high', 'mid', 'low'];
export const WHITE_FLOWER_DETAILS: readonly Detail[] = ['ultra', 'high', 'low'];
export const BROADLEAF_DETAILS: readonly Detail[] = ['ultra', 'high', 'low'];
export const MOSS_DETAILS: readonly Detail[] = ['ultra', 'high'];
/** the hero crown's four LODs (plants.ts): bipinnate fronds inside HERO_FERN_ULTRA_M, then the round-31 lances */
export const HERO_FERN_DETAILS: Detail[] = ['ultra', 'high', 'mid', 'low'];
/**
 * Camera distance (m) inside which a hero crown draws its bipinnate LOD. The tree-base audit
 * stood inside the shot-D crowns (their pinnae were 0.2 m single-colour lances filling the frame);
 * the six fixed cameras have no hero crown inside this range (plants.test), so their frames and
 * budgets are untouched and only the walking eye pays for it.
 */
export const HERO_FERN_ULTRA_M = 5;
/** the ultra stems' sides — the hero rachis and the fiddlehead stalk (a 5-sided tube read as a flat wedge from 10 cm) */
export const ULTRA_STEM_SIDES = 8;
/** the ultra stems' baked shading: underside tone, and the per-facet ridge amplitude (stemShade) */
export const STEM_UNDERSIDE = 0.72;
export const STEM_RIDGE = 0.06;
/** the ultra stems' lengthwise gradient exponent: the foot tone holds to mid-stem, the lit tip is the top third */
export const STEM_GRADIENT_POW = 1.4;

/**
 * The ultra stems' baked round-off (round 40 follow-up). Under the giant trees the stems see only
 * ambient light, so the 8-sided tube shaded as flat as the 5-sided wedge it replaced (the re-rendered
 * northwest-base tile: one tone, 113/117/52, across the whole crossing). Two yaw-invariant terms go
 * into the vertex colour instead: the facet's pitch tones a leaning stem's underside to
 * STEM_UNDERSIDE and its top to 1 (an upright stem's ring has `up` ≈ 0 all round, so it keeps a
 * level 0.86), and a fixed per-facet ridge (± STEM_RIDGE, golden-ratio spaced so no two of the eight
 * match) draws the lengthwise fibres of a stipe. Zero triangles; the shared vertices blend the ridges.
 */
export function stemShade(up: number, facet: number): number {
  const pitch = STEM_UNDERSIDE + (1 - STEM_UNDERSIDE) * (0.5 + 0.5 * up);
  const ridge = ((facet * 0.618034) % 1) * 2 - 1;
  return pitch * (1 + STEM_RIDGE * ridge);
}

/** an ultra stem's per-vertex colour: the foot → tip gradient under stemShade */
export function stemColorAt(foot: RGB, tip: RGB): (t: number, up: number, facet: number) => RGB {
  return (t, up, facet) => tone(blend(foot, tip, Math.pow(t, STEM_GRADIENT_POW)), stemShade(up, facet));
}
/**
 * Camera distance (m) inside which a fiddlehead draws its ultra LOD (round 40 follow-up). The
 * tree-base audit's "flat wedge" in the northwest-base tile was one of shot D's tall bud stalks
 * (plants.ts: ≈ 2 × scale, 1.7 × wider — a thumb-thick 5-sided tube) crossing the lens; inside
 * this range the stalk is an 8-sided tube with a lengthwise tone gradient (fiddleheadStalkTones).
 * 3.5 m: the walking eye inside a clump pays for it, no fixed camera has a bud that close (the
 * nearest are 3.6–5 m from A, C and F; plants.test), so the six views' budgets are untouched.
 */
export const FIDDLEHEAD_ULTRA_M = 3.5;
export const FIDDLEHEAD_DETAILS: readonly Detail[] = ['ultra', 'high', 'low'];

export interface PlantPalette {
  fern: RGB;
  leaf: RGB;
  leafSun: RGB;
  stem: RGB;
  bark: RGB;
  purple: RGB;
  purpleLight: RGB;
  purpleDeep: RGB;
  yellow: RGB;
  weed: RGB;
  straw: RGB;
  mossDeep: RGB;
  mossBright: RGB;
  grassLight: RGB;
}

export function makePalette(p: { fernGreen: number; leafCanopy: number; leafSun: number; barkDark: number; flowerPurple: number; mossDeep: number; mossBright: number; grassLight: number; grassMid: number }): PlantPalette {
  return {
    fern: rgb(p.fernGreen),
    // Understory foliage sits in the reference's olive band (shrubs #4c5537, sunlit leaves #8b8948):
    // pull the canopy tones (shared with the trees) toward it rather than rendering lime bushes.
    leaf: blend(rgb(p.leafCanopy), rgb(0x4c5537), 0.5),
    leafSun: blend(rgb(p.leafSun), rgb(0x8b8948), 0.6),
    stem: blend(rgb(p.grassMid), rgb(p.barkDark), 0.35),
    bark: rgb(p.barkDark),
    // The haze adds a grey pedestal to anything beyond a few metres, which kills saturation of dark
    // petals; a brighter, strongly saturated violet (same hue family as palette.flowerPurple) keeps
    // the blooms reading purple through the mist.
    purple: blend(rgb(p.flowerPurple), rgb(0x7a3fd8), 0.7),
    purpleLight: blend(rgb(p.flowerPurple), rgb(0x9d6ff0), 0.7),
    purpleDeep: blend(rgb(p.flowerPurple), rgb(0x5a2aa8), 0.7),
    yellow: rgb(0xf0d060),
    // broad-leaf weeds: a touch yellower than the grass, no brighter (the old lime blend read ≈ 0.6
    // luminance in the verges, well above the reference's brightest foliage)
    weed: blend(rgb(p.grassLight), rgb(0x7f8a3c), 0.5),
    straw: rgb(0xa89555),
    mossDeep: rgb(p.mossDeep),
    mossBright: rgb(p.mossBright),
    grassLight: rgb(p.grassLight),
  };
}

const arch = (radial: Vector3, lateral: Vector3, reach: number, sway: number, h: number, rise = 0.75) => (t: number) =>
  radial
    .clone()
    .multiplyScalar(0.02 + reach * Math.pow(t, 1.6))
    .addScaledVector(lateral, sway * t * t)
    .add(V(0, h * Math.sin(t * Math.PI * rise), 0));

// ---------------------------------------------------------------- ferns
/**
 * Understory fern clump. Round 31 (the owner's "really dense and very detailed"): 8–10 fronds
 * (was 6–8) on a tighter reach so the clump reads as one mass; the near LOD carries 13 pinna
 * pairs per frond as four-section lances whose rim steps in and out (a pinnule notch on each
 * side), the pinnae brighten from a dark heart to lit tips, every frond ends in a drooping tip,
 * and one or two fiddlehead coils rise from the crown centre (the frames' ferns show their buds).
 * ≈ 3.3 K / 1.0 K / 0.23 K triangles (high / mid / low; was 1.8 K / 0.7 K / 0.23 K). Height
 * range unchanged (0.5–0.82 m at unit scale) so every scatter's caps hold.
 */
export function fernGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const fronds = low ? 5 : 8 + rng.int(0, 3);
  const height = 0.5 + rng() * 0.32;
  const azimuth = rng() * TAU;
  const stemColor = blend(pal.stem, pal.fern, 0.5);
  for (let f = 0; f < fronds; f++) {
    const angle = azimuth + (f * TAU) / fronds + (rng() - 0.5) * 0.35;
    const radial = V(Math.cos(angle), 0, Math.sin(angle));
    const lateral = V(-Math.sin(angle), 0, Math.cos(angle));
    const h = height * (f === 0 ? 1 : 0.62 + rng() * 0.38);
    const reach = 0.5 + rng() * 0.32 + (1 - h / height) * 0.2;
    const curve = arch(radial, lateral, reach, (rng() - 0.5) * 0.18, h);
    const segs = high ? 8 : low ? 4 : 6;
    tube(m, sampleCurve(curve, segs), 0.0075, 0.001, stemColor, 3);
    const pairs = high ? 13 : low ? 5 : 9;
    const frondTone = 0.8 + rng() * 0.35;
    for (let p = 0; p < pairs; p++) {
      const t = 0.12 + (p / (pairs - 1)) * 0.84;
      const envelope = Math.pow(Math.sin(Math.PI * ((t - 0.05) / 0.95)), 0.8);
      const length = (0.19 + rng() * 0.05) * Math.max(0.1, envelope) * (1 - t * 0.3) * (low ? 1.25 : 1);
      for (const sign of [-1, 1]) {
        const origin = curve(Math.min(1, Math.max(0, t + sign * 0.005)));
        const dir = lateral
          .clone()
          .multiplyScalar(sign)
          .addScaledVector(radial, 0.25 + t * 0.3)
          .add(V(0, 0.1 - t * 0.32 + (rng() - 0.5) * 0.15, 0));
        // a dark heart under lit tips: the frame's clumps read as bright frond ends over shade
        const color = tone(pal.fern, frondTone * (0.82 + t * 0.3 + rng() * 0.12));
        const opts = { curl: 0.06 + rng() * 0.12, twist: sign * (0.05 + rng() * 0.2), ridge: 0.15, serration: high ? 0.16 : 0.05 };
        if (high) lanceLeaf(m, origin, dir, length * (0.92 + rng() * 0.16), length * (0.24 + rng() * 0.06), color, { ...opts, sections: 4 });
        else if (low) foldedLeaf(m, origin, dir, length, length * 0.3, color, opts);
        else curvedLeaf(m, origin, dir, length, length * 0.28, color, opts);
      }
    }
    const tipDir = radial.clone().add(V(0, -0.5, 0));
    if (low) foldedLeaf(m, curve(0.96), tipDir, 0.07, 0.02, tone(pal.fern, 1.08));
    else curvedLeaf(m, curve(0.96), tipDir, 0.075, 0.02, tone(pal.fern, 1.08), { curl: 0.25 });
  }
  if (high) {
    // fiddleheads at the crown centre: a short stalk and a coil curling back over itself
    const coils = 1 + rng.int(0, 2);
    const coilColor = tone(blend(pal.fern, pal.leafSun, 0.5), 1.1);
    for (let k = 0; k < coils; k++) {
      const a = azimuth + k * 2.4 + rng() * 0.8;
      const radial = V(Math.cos(a), 0, Math.sin(a));
      const root = radial.clone().multiplyScalar(0.02 + rng() * 0.03);
      const stalkH = height * (0.42 + rng() * 0.18);
      const stalk = (t: number) => root.clone().addScaledVector(radial, 0.05 * t * t).add(V(0, stalkH * t, 0));
      tube(m, sampleCurve(stalk, 4), 0.006, 0.0045, blend(pal.fern, pal.bark, 0.35), 3);
      const top = stalk(1);
      const R = 0.02 + rng() * 0.01;
      const centre = top.clone().addScaledVector(radial, -R);
      const spiral: Vector3[] = [];
      for (let j = 0; j <= 8; j++) {
        const u = j / 8;
        const ang = u * 1.3 * TAU;
        const r = R * (1 - 0.5 * u);
        spiral.push(centre.clone().addScaledVector(radial, Math.cos(ang) * r).add(V(0, Math.sin(ang) * r, 0)));
      }
      tube(m, spiral, 0.007, 0.003, coilColor, 4, true);
    }
  }
  return m.finish({ groundToZero: true });
}

/**
 * Hero fern (reference D 0.05–0.14 × 0.55–0.68, left of the shot-d boulder): a tree-fern-like
 * crown of 8–12 big arching fronds, 0.7–0.9 m tall, rising steeply from a short fibrous
 * rootstock and leaning out at the top; broad rounded pinnae and curled fiddlehead tips. Lit
 * yellow-olive (`#69692e` in the footage) rather than the deep shade green of the understory
 * ferns, so the clump reads as the bright mass the reference box measures (lum ≈ 0.36).
 */
/**
 * The ultra rachis gradient (round 40): a darker, slightly warmer foot (toward the bark, a touch
 * of red) rising to a lit green tip (toward the sunlit frond); the other LODs keep the flat stem tone.
 */
export function heroRachisTones(pal: PlantPalette): { foot: RGB; tip: RGB } {
  const frondColor = blend(pal.fern, pal.leafSun, 0.5);
  const stemColor = blend(pal.stem, frondColor, 0.4);
  return {
    foot: tone(blend(blend(stemColor, pal.bark, 0.45), [0.42, 0.3, 0.16], 0.18), 0.78),
    tip: tone(blend(stemColor, blend(frondColor, pal.leafSun, 0.4), 0.55), 1.1),
  };
}

export function heroFernGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  // round 40: `ultra` is the high LOD's frond layout — the same draws from the same stream, so the
  // arches, stems and fiddleheads coincide and a LOD switch at HERO_FERN_ULTRA_M does not pop —
  // with every lance pinna rebuilt as a bipinnate one (geometry.ts pinnateLeaf: midrib strip and
  // cupped pinnules) from its own forked stream; ≈ 7 × the high LOD's triangles
  const ultra = detail === 'ultra';
  const high = detail === 'high' || ultra;
  const low = detail === 'low';
  const pinnules = ultra ? createRng(`${seed}/pinnules`) : null;
  const fronds = low ? 6 : 8 + rng.int(0, 4);
  const height = 0.7 + rng() * 0.2;
  const azimuth = rng() * TAU;
  // the footage's fronds are a lit yellow-olive (`#69692e`), a full step lighter than the
  // understory fern green, and stay legible as separate arches against the dark bank
  const frondColor = blend(pal.fern, pal.leafSun, 0.5);
  const stemColor = blend(pal.stem, frondColor, 0.4);
  const { foot: rachisFoot, tip: rachisTip } = heroRachisTones(pal);
  // rootstock: a stubby fibrous trunk the fronds spring from
  tube(m, [V(0, -0.02, 0), V(0.01, 0.06, 0), V(0, 0.13, 0.01)], 0.055, 0.035, tone(pal.bark, 0.9), high ? 6 : 4, true);
  for (let f = 0; f < fronds; f++) {
    const angle = azimuth + (f * TAU) / fronds + (rng() - 0.5) * 0.3;
    const radial = V(Math.cos(angle), 0, Math.sin(angle));
    const lateral = V(-Math.sin(angle), 0, Math.cos(angle));
    // the odd fronds are the younger inner ring: steeper and shorter
    const inner = f % 2 === 1;
    const h = height * (inner ? 0.78 + rng() * 0.14 : 0.92 + rng() * 0.1);
    const reach = inner ? 0.42 + rng() * 0.16 : 0.62 + rng() * 0.24;
    const rise = inner ? 0.62 : 0.7 + rng() * 0.1;
    const curve = arch(radial, lateral, reach, (rng() - 0.5) * 0.14, h, rise);
    const segs = high ? 12 : low ? 5 : 7;
    // round 40: at the ultra LOD the rachis is what crosses the lens when the camera stands inside
    // the fern (the tree-base audit's "flat wedge" in northwest-base: a 5-sided 12 mm tube at 10 cm):
    // 8 sides, a lengthwise gradient — a darker, warmer foot rising to the frond's lit green — and
    // the baked underside / ridge shading (stemShade), so it reads as a stem; the other LODs keep
    // their 5 / 3 sides and flat tone (+72 triangles a frond)
    if (ultra) tube(m, sampleCurve(curve, segs), 0.012, 0.0025, stemColor, ULTRA_STEM_SIDES, false, stemColorAt(rachisFoot, rachisTip));
    else tube(m, sampleCurve(curve, segs), 0.012, 0.0025, stemColor, high ? 5 : 3);
    const pairs = high ? 12 : low ? 6 : 8;
    const frondTone = 0.86 + rng() * 0.34;
    for (let p = 0; p < pairs; p++) {
      const t = 0.14 + (p / (pairs - 1)) * 0.82;
      const envelope = Math.pow(Math.sin(Math.PI * ((t - 0.04) / 0.98)), 0.7);
      const length = (0.2 + rng() * 0.05) * Math.max(0.12, envelope) * (1 - t * 0.2) * (low ? 1.3 : 1);
      for (const sign of [-1, 1]) {
        const origin = curve(Math.min(1, Math.max(0, t + sign * 0.004)));
        const dir = lateral
          .clone()
          .multiplyScalar(sign)
          .addScaledVector(radial, 0.2 + t * 0.35)
          .add(V(0, 0.18 - t * 0.34 + (rng() - 0.5) * 0.12, 0));
        // pinnae brighten toward the sunlit tip of the frond
        const color = tone(frondColor, frondTone * (0.86 + t * 0.24 + rng() * 0.1));
        const opts = { curl: 0.08 + rng() * 0.1, twist: sign * (0.05 + rng() * 0.15), ridge: 0.18, serration: 0.04 };
        if (pinnules) pinnateLeaf(m, origin, dir, length * (0.94 + rng() * 0.12), length * (0.27 + rng() * 0.07), color, { ...opts, pairs: 7, rng: pinnules });
        else if (high) lanceLeaf(m, origin, dir, length * (0.94 + rng() * 0.12), length * (0.27 + rng() * 0.07), color, { ...opts, sections: 3 });
        else if (low) foldedLeaf(m, origin, dir, length, length * 0.32, color, opts);
        else curvedLeaf(m, origin, dir, length, length * 0.3, color, opts);
      }
    }
    // fiddlehead: the tip curls back over itself
    const tip = curve(1);
    const back = radial.clone().multiplyScalar(-1);
    if (high) {
      const spiral: Vector3[] = [];
      for (let k = 0; k <= 5; k++) {
        const a = (k / 5) * Math.PI * 1.35;
        const r = 0.035 * (1 - k / 9);
        spiral.push(tip.clone().addScaledVector(radial, 0.035 - Math.cos(a) * r).add(V(0, Math.sin(a) * r + k * 0.002, 0)));
      }
      tube(m, spiral, 0.007, 0.004, tone(frondColor, 1.15), 4, true);
    } else {
      curvedLeaf(m, tip, back.add(V(0, 0.6, 0)), 0.07, 0.03, tone(frondColor, 1.1), { curl: 0.5 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- bushes
export function bushGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const stems = 5 + rng.int(0, 3);
  const height = 0.95 + rng() * 0.55;
  const phase = rng() * TAU;
  for (let s = 0; s < stems; s++) {
    const angle = phase + (s * TAU) / stems + (rng() - 0.5) * 0.8;
    const radial = V(Math.cos(angle), 0, Math.sin(angle));
    const lateral = V(-Math.sin(angle), 0, Math.cos(angle));
    const bend = 0.32 + rng() * 0.4;
    const h = height * (0.65 + rng() * 0.35);
    const curve = (t: number) => radial.clone().multiplyScalar(0.05 + bend * t * t).addScaledVector(lateral, Math.sin(t * Math.PI) * 0.06).add(V(0, t * h, 0));
    tube(m, sampleCurve(curve, high ? 5 : 3), 0.012 + rng() * 0.005, 0.0025, pal.bark, high ? 4 : 3);
    const branches = high ? 5 : low ? 2 : 3;
    for (let b = 0; b < branches; b++) {
      const t = 0.2 + (b / Math.max(1, branches - 1)) * 0.72;
      const start = curve(t);
      const sign = b % 2 ? -1 : 1;
      const reach = (0.32 + rng() * 0.22) * (1.1 - t * 0.3);
      const branchDir = lateral.clone().multiplyScalar(sign * (0.7 + rng() * 0.35)).addScaledVector(radial, 0.45 + rng() * 0.4).normalize();
      const rise = 0.1 + rng() * 0.18;
      const twig = (u: number) => start.clone().addScaledVector(branchDir, reach * u).add(V(0, rise * u + Math.sin(u * Math.PI) * 0.04, 0));
      if (!low) tube(m, sampleCurve(twig, high ? 3 : 2), 0.005 * (1 - t * 0.4), 0.001, tone(pal.bark, 1.15), 3);
      const leafCount = high ? 9 : low ? 4 : 6;
      for (let l = 0; l < leafCount; l++) {
        const u = 0.1 + (l / (leafCount - 1)) * 0.9;
        const attach = twig(u);
        const leafSide = l % 2 ? -1 : 1;
        const cross = V(-branchDir.z, 0, branchDir.x);
        const dir = cross
          .multiplyScalar(leafSide * (0.6 + rng() * 0.45))
          .addScaledVector(branchDir, 0.4 + rng() * 0.35)
          .add(V(0, (rng() - 0.4) * 0.7, 0))
          .normalize();
        const len = (0.16 + rng() * 0.09) * (1.05 - u * 0.15) * (low ? 1.4 : 1);
        const sun = Math.min(1, (attach.y / height) * 0.7 + Math.hypot(attach.x, attach.z) * 0.5);
        const color = tone(blend(pal.leaf, pal.leafSun, sun * 0.7), 0.85 + rng() * 0.3);
        const opts = { curl: 0.1 + rng() * 0.12, twist: (rng() - 0.5) * 0.6, ridge: 0.12 };
        if (low) foldedLeaf(m, attach, dir, len, len * 0.6, color, opts);
        else curvedLeaf(m, attach, dir, len, len * (0.55 + rng() * 0.25), color, opts);
      }
    }
    for (let terminal = 0; terminal < 2; terminal++) {
      const dir = radial.clone().addScaledVector(lateral, terminal ? 0.55 : -0.55).add(V(0, 0.45, 0));
      const color = tone(pal.leafSun, 0.95 + rng() * 0.15);
      if (low) foldedLeaf(m, curve(0.98), dir, 0.12, 0.08, color);
      else curvedLeaf(m, curve(0.98), dir, terminal ? 0.1 : 0.13, terminal ? 0.06 : 0.085, color, { curl: 0.17, twist: 0.15, ridge: 0.11 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- hedge crowns
/**
 * Hedge crown (round 14, vegetation sub-agent): a clipped shrub that reads as one solid dark
 * mass of small leaves. Frame 1 s shows no light through the bank hedge behind the kid
 * (0.78–1.0 × 0.3–0.6) or the door row; the hedge set used bushGeometry at shrub scale — five to
 * seven open stems with 16–25 cm leaves — and the lit bank showed between its twigs. Here an
 * opaque ellipsoid core in the deep shade tone carries the mass, an inner shell of shade-toned
 * leaves fills the gaps, and an outer shell of 7–12 cm ovate leaves — sunlit toward the crown's
 * top, shaded at the skirt — gives it depth and the bright leaf rim; a few stems show at the
 * skirt. Proportions match bushGeometry (≈ 1.15–1.45 m tall, ≈ 1.3 m across), so every hedge
 * scatter's `top / hedgeHeight(variant)` scaling and the plants.test height caps hold unchanged.
 * Cost ≈ 2.1 K / 0.9 K / 0.25 K triangles (high / mid / low), like the bush variants it replaces.
 */
/** the hedge crown's per-leaf colour spread (round 35; round 31 had ± 0.3, depth 0.7, tip 1.15, sun 0.8) */
const HEDGE_SPREAD = 0.14;
const HEDGE_DEPTH = 0.45;
const HEDGE_TIP = 1.06;
const HEDGE_SUN = 0.6;

export function hedgeGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const height = 1.15 + rng() * 0.3;
  const rx = 0.6 + rng() * 0.12;
  const rz = 0.6 + rng() * 0.12;
  // the crown bulges at 45 % of its height and tucks in toward the ground
  const cy = height * 0.45;
  const ry = height - cy;
  const shade = tone(pal.leaf, 0.5);
  const skirt = tone(pal.leaf, 0.7);
  const bumps = Array.from({ length: 64 }, () => rng());
  const bump = (i: number) => bumps[((i % 64) + 64) % 64];
  // the crown's surface at polar angle `phi` (0 = top) and yaw `ang`, `r` times its radius
  const surface = (phi: number, ang: number, r: number) => {
    const sy = Math.cos(phi);
    const sr = Math.sin(phi);
    return V(Math.cos(ang) * sr * rx * r, cy + sy * (sy > 0 ? ry : cy * 0.92) * r, Math.sin(ang) * sr * rz * r);
  };

  // opaque core: an ellipsoid of the shade tone, its top in the leaf tone, at 0.8 of the crown
  {
    const seg = high ? 14 : low ? 8 : 10;
    const rings = high ? 7 : low ? 4 : 5;
    const top = m.vertex(surface(0, 0, 0.8), NOT_LAMINA + 0.5, 1, tone(pal.leaf, 0.8));
    const levels: number[][] = [];
    for (let r = 1; r <= rings; r++) {
      const phi = (r / rings) * Math.PI * 0.94;
      const level: number[] = [];
      for (let k = 0; k < seg; k++) {
        const ang = (k * TAU) / seg + (r % 2) * (Math.PI / seg);
        const wobble = 0.8 * (0.94 + 0.12 * bump(r * 17 + k * 3));
        const c = blend(tone(pal.leaf, 0.8), shade, Math.min(1, (r / rings) * 1.4));
        level.push(m.vertex(surface(phi, ang, wobble), NOT_LAMINA + k / seg, 1 - r / rings, c));
      }
      levels.push(level);
    }
    for (let k = 0; k < seg; k++) m.tri(top, levels[0][(k + 1) % seg], levels[0][k]);
    for (let r = 0; r < rings - 1; r++) {
      for (let k = 0; k < seg; k++) {
        const n = (k + 1) % seg;
        m.tri(levels[r][k], levels[r][n], levels[r + 1][k]);
        m.tri(levels[r][n], levels[r + 1][n], levels[r + 1][k]);
      }
    }
  }

  // a few stems from the ground into the crown, visible at the skirt
  if (!low) {
    const stems = high ? 5 : 3;
    for (let s = 0; s < stems; s++) {
      const ang = (s * TAU) / stems + (rng() - 0.5) * 0.6;
      const radial = V(Math.cos(ang), 0, Math.sin(ang));
      const lean = 0.35 + rng() * 0.25;
      const h = cy * (0.9 + rng() * 0.3);
      const curve = (t: number) => radial.clone().multiplyScalar(0.06 + lean * t * t).add(V(0, t * h, 0));
      tube(m, sampleCurve(curve, high ? 4 : 3), 0.014 + rng() * 0.006, 0.004, pal.bark, high ? 4 : 3);
    }
  }

  // leaf shells: `place` puts a leaf on the crown surface at radius `r`, facing outward with a
  // random tilt; the outer shell is lit by its height (leafSun toward the top, the skirt in
  // shade), the inner shell is all shade so the gaps between outer leaves stay dark.
  // Round 31: the outer shell grows in CLUSTERS — 20–30 leaf bunches on the crown, each a bump
  // whose core leaves stand proud and lit and whose fringe sinks toward the dark interior — with
  // a vertex shade gradient toward the core (the leaf base darker than its tip, the sunk fringe
  // darker than the bump top), like the trees' shade floor: the crown reads as overlapping leaf
  // clusters over a shaded heart instead of an even speckle on a blob.
  const place = (phi: number, ang: number, r: number, len: number, inner: boolean, depth: number) => {
    const p = surface(phi, ang, r);
    const outward = V(Math.cos(ang) * Math.sin(phi), Math.cos(phi) * 0.9 + 0.15, Math.sin(ang) * Math.sin(phi)).normalize();
    // the blade lies on the surface (its plane normal is the outward direction), pointing up the
    // crown with a random yaw and its tip flaring out
    const tangent = outward.y > 0.97 ? V(Math.cos(ang), 0, Math.sin(ang)) : V(0, 1, 0).addScaledVector(outward, -outward.y).normalize();
    const dir = tangent
      .applyAxisAngle(outward, (rng() - 0.5) * 2.4)
      .addScaledVector(outward, 0.35 + rng() * 0.4)
      .normalize();
    const base = p.clone().addScaledVector(dir, -len * 0.55);
    const sun = inner ? 0 : Math.min(1, Math.max(0, outward.y * 0.85 + 0.15));
    const lit = blend(inner ? shade : blend(skirt, pal.leaf, 0.6), pal.leafSun, sun * HEDGE_SUN);
    // the leaf-to-leaf spread: round 31 gave the outer shell ± 30 % with the bunch fringes sunk
    // 0.7 toward the shade tone ("dark with lit clusters"); round 35 measured the frames' hedge
    // masses (frame 1's right edge, frame 8's right, frame 14's door row) as flat blurs — local
    // sd 0.01–0.05 in 8 px windows at 256 × 144 against our 0.03–0.05 — and SSIM's structure
    // term there is our own local variance, so the spread narrows to ± HEDGE_SPREAD with the
    // fringe sunk HEDGE_DEPTH; `depth` (0 = bump top, 1 = sunk into the crown)
    const color = blend(tone(lit, inner ? 0.85 + rng() * 0.3 : 1 - HEDGE_SPREAD + rng() * 2 * HEDGE_SPREAD), shade, inner ? 0 : depth * HEDGE_DEPTH);
    const opts = { curl: 0.12 + rng() * 0.16, twist: (rng() - 0.5) * 0.7, ridge: 0.1, planeNormal: outward, tipColor: inner ? undefined : tone(lit, HEDGE_TIP) };
    if (low) foldedLeaf(m, base, dir, len, len * 0.7, color, opts);
    else curvedLeaf(m, base, dir, len, len * (0.6 + rng() * 0.2), color, opts);
  };
  // the visible half: more leaves toward the top, fewer under the bulge
  const randomPhi = () => Math.acos(1 - rng() * 1.55);
  const outer = high ? 470 : low ? 110 : 210;
  const innerCount = high ? 150 : low ? 0 : 70;
  for (let l = 0; l < innerCount; l++) place(randomPhi(), rng() * TAU, 0.86 + rng() * 0.06, 0.08 + rng() * 0.04, true, 0);
  const clusters = high ? 28 : low ? 12 : 18;
  const perCluster = Math.round(outer / clusters);
  for (let c = 0; c < clusters; c++) {
    const cPhi = randomPhi();
    const cAng = rng() * TAU;
    const spread = 0.16 + rng() * 0.1;
    for (let l = 0; l < perCluster; l++) {
      // gaussian-ish spread about the bunch centre; the bunch core stands out at r ≈ 1.06, the
      // fringe sinks to r ≈ 0.92 into the dark gaps between bunches
      const u = rng() + rng() - 1;
      const v = rng() + rng() - 1;
      const d = Math.min(1, Math.hypot(u, v) / 1.2);
      const phi = Math.min(Math.PI * 0.85, Math.max(0.05, cPhi + u * spread));
      const ang = cAng + (v * spread) / Math.max(0.3, Math.sin(phi));
      const r = 1.06 - 0.14 * d;
      place(phi, ang, r, (0.065 + rng() * 0.05) * (low ? 1.5 : 1), false, d);
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- purple flowers
/**
 * Hydrangea / allium-like cluster bloom: a bumpy violet dome of florets with a few petals
 * flaring from its rim. Dense enough to read as a solid purple blob at distance.
 */
function clusterHead(m: MeshBuilder, center: Vector3, normal: Vector3, radius: number, rng: Rng, pal: PlantPalette, detail: Detail) {
  const n = normal.clone().normalize();
  const side = new Vector3().crossVectors(Math.abs(n.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), n).normalize();
  const fwd = new Vector3().crossVectors(n, side).normalize();
  const high = detail === 'high';
  const low = detail === 'low';
  const rings = high ? 3 : 2;
  const segments = low ? 5 : high ? 8 : 6;
  const floret = () => blend(blend(pal.purple, pal.purpleLight, rng() * 0.5), pal.purpleDeep, rng() * 0.4);
  const at = (u: number, v: number, h: number) => center.clone().addScaledVector(side, u).addScaledVector(fwd, v).addScaledVector(n, h);
  const top = m.vertex(at(0, 0, radius * 0.8), NOT_LAMINA + 0.5, 1, blend(pal.purple, pal.purpleLight, 0.3));
  const levels: number[][] = [];
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    const phi = t * Math.PI * 0.55;
    const level: number[] = [];
    for (let k = 0; k < segments; k++) {
      const ang = (k * TAU) / segments + (r % 2) * (Math.PI / segments);
      const rr = radius * Math.sin(phi) * (0.85 + rng() * 0.3);
      const h = radius * 0.8 * Math.cos(phi) * (0.85 + rng() * 0.3);
      level.push(m.vertex(at(Math.cos(ang) * rr, Math.sin(ang) * rr, h), NOT_LAMINA + k / segments, 1 - t, floret()));
    }
    levels.push(level);
  }
  for (let k = 0; k < segments; k++) m.tri(top, levels[0][(k + 1) % segments], levels[0][k]);
  for (let r = 0; r < rings - 1; r++) {
    for (let k = 0; k < segments; k++) {
      const nx = (k + 1) % segments;
      m.tri(levels[r][k], levels[r][nx], levels[r + 1][k]);
      m.tri(levels[r][nx], levels[r + 1][nx], levels[r + 1][k]);
    }
  }
  // rim petals for a fluffy silhouette
  const petals = low ? 3 : high ? 6 : 4;
  const p0 = rng() * TAU;
  for (let p = 0; p < petals; p++) {
    const a = p0 + (p * TAU) / petals;
    const dir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(fwd, Math.sin(a)).addScaledVector(n, 0.25 + rng() * 0.3).normalize();
    const base = at(Math.cos(a) * radius * 0.75, Math.sin(a) * radius * 0.75, radius * 0.25);
    foldedLeaf(m, base, dir, radius * (0.55 + rng() * 0.3), radius * 0.5, floret(), { curl: 0.25, tipColor: pal.purpleLight });
  }
}

/** the violet ultra LOD's tones: a deep throat, the lobe, the lit tip (round 43) */
export function violetBellTones(pal: PlantPalette): { throat: RGB; lobe: RGB; tip: RGB } {
  return { throat: tone(blend(pal.purpleDeep, [0.12, 0.05, 0.22], 0.35), 0.8), lobe: blend(pal.purple, pal.purpleLight, 0.3), tip: tone(pal.purpleLight, 1.06) };
}

/** the violet ultra stems' gradient (round 43): a darker, browner foot rising to a fresher green under the heads */
export function flowerStemTones(pal: PlantPalette): { foot: RGB; tip: RGB } {
  return { foot: tone(blend(pal.stem, pal.bark, 0.3), 0.85), tip: tone(blend(pal.stem, pal.grassLight, 0.3), 1.05) };
}

/**
 * A small bell (round 43): a short throat tube along `dir` ending at `mouth`, and `petals` cupped
 * lobes flaring from its rim, the throat the deepest violet and each lobe running from it to the
 * lit tip — the baked gradient the petal material's near translucency lights from behind. The
 * sheet's purple forest flowers are spikes of these. 8 + 4 × petals triangles.
 */
function bell(m: MeshBuilder, mouth: Vector3, dir: Vector3, r: number, petals: number, rng: Rng, tones: { throat: RGB; lobe: RGB; tip: RGB }) {
  const d = dir.clone().normalize();
  const foot = mouth.clone().addScaledVector(d, -r * 0.9);
  tube(m, [foot, mouth], r * 0.28, r * 0.5, tones.throat, 4);
  const side = new Vector3().crossVectors(Math.abs(d.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), d).normalize();
  const fwd = new Vector3().crossVectors(d, side).normalize();
  const a0 = rng() * TAU;
  for (let p = 0; p < petals; p++) {
    const a = a0 + (p * TAU) / petals;
    const pdir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(fwd, Math.sin(a)).multiplyScalar(0.6 + rng() * 0.15).addScaledVector(d, 0.8).normalize();
    const lobe = blend(tones.throat, tones.lobe, 0.55 + rng() * 0.3);
    // the lobe flares away from the axis at its tip (negative curl about the bell's own axis)
    curvedLeaf(m, mouth.clone().addScaledVector(pdir, r * 0.05), pdir, r * (0.85 + rng() * 0.3), r * 0.55, lobe, { curl: -0.3, ridge: 0.15, twist: (rng() - 0.5) * 0.3, planeNormal: d, tipColor: tones.tip, uOffset: PETAL_U });
  }
}

/** the cluster head's ultra LOD: florets a head (before the buds are taken out of them) */
export const CLUSTER_ULTRA_FLORETS = 14;

/**
 * The cluster head's ultra LOD (round 43): a ball of open florets. A small dark core (the throat
 * tone — the shadowed depth between the florets) from the head's own stream, and 14–18 bells on a
 * golden-angle spiral over it from the `fine` stream, mouths outward, from the crown to a little
 * under the equator, each 0.3 × radius across so their lobes make the silhouette the high LOD's
 * dome and rim petals made a metre further out; two or three of the youngest near the crown are
 * still closed teardrop buds (sheet 05 "forest buds"). ≈ 500 triangles a head against 52 — the
 * hydrangea at arm's length reads as florets with dark throats, not a smooth violet dome.
 */
function clusterHeadUltra(m: MeshBuilder, center: Vector3, normal: Vector3, radius: number, headRng: Rng, fine: Rng, pal: PlantPalette) {
  const n = normal.clone().normalize();
  const side = new Vector3().crossVectors(Math.abs(n.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), n).normalize();
  const fwd = new Vector3().crossVectors(n, side).normalize();
  const tones = violetBellTones(pal);
  // the core: a squashed ball, 0.5 × radius across, from 0.25 × radius under the centre to 0.55 above
  const coreR = radius * 0.5;
  const coreJitter = Array.from({ length: 4 }, () => 0.9 + headRng() * 0.2);
  lathe(m, center.clone(), n, (t) => ({ r: coreR * Math.pow(Math.sin(t * Math.PI), 0.75) * coreJitter[Math.min(3, Math.floor(t * 4))], y: radius * (-0.25 + 0.8 * t) }), 3, 7, tones.throat, (t) => blend(tones.throat, pal.purpleDeep, t * 0.4));
  const florets = CLUSTER_ULTRA_FLORETS + fine.int(0, 5);
  const buds = 2 + (florets > 16 ? 1 : 0);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let b = 0; b < florets; b++) {
    // a spiral down the ball: cos φ from 1 (crown) to −0.3 (a little under the equator)
    const cosPhi = Math.min(1, Math.max(-0.35, 1 - ((b + 0.5) / florets) * 1.3 + (fine() - 0.5) * 0.12));
    const phi = Math.acos(cosPhi);
    const ang = b * golden + (fine() - 0.5) * 0.35;
    const lat = Math.sin(phi);
    // mouths on an ellipsoid 0.62 × radius across, its axis 0.12 … 0.62 × radius up the normal
    const mouth = center.clone().addScaledVector(side, Math.cos(ang) * lat * radius * 0.62).addScaledVector(fwd, Math.sin(ang) * lat * radius * 0.62).addScaledVector(n, radius * (0.12 + 0.5 * cosPhi));
    const out = side.clone().multiplyScalar(Math.cos(ang) * lat).addScaledVector(fwd, Math.sin(ang) * lat).addScaledVector(n, cosPhi * 1.1).normalize();
    const r = radius * 0.3 * (0.85 + fine() * 0.3);
    if (b < buds) {
      // the youngest florets at the crown: closed teardrops, throat-dark at the foot, lit toward the tip
      const budR = r * 0.55;
      lathe(m, mouth.clone().addScaledVector(out, -r * 0.45), out, (u) => ({ r: budR * Math.pow(Math.sin(u * Math.PI), 0.7) * (1 - 0.3 * u), y: r * 1.6 * u }), 4, 5, tones.throat, (u) => blend(tones.throat, tone(tones.lobe, 0.92), u * 0.65));
      continue;
    }
    bell(m, mouth, out, r, 5, fine, tones);
  }
}

export function flowerGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  // round 43: `ultra` is the high LOD's layout — the same stems, leaves and head centres from the
  // same stream, so the switch at FLOWER_ULTRA_M does not pop — with 5-sided graded stems and the
  // heads rebuilt as clusters of bells (clusterHeadUltra) from a forked stream
  const ultra = detail === 'ultra';
  const fine = ultra ? createRng(`${seed}/ultra`) : null;
  const low = detail === 'low';
  const stems = low ? 5 : 6 + rng.int(0, 4);
  const phase = rng() * TAU;
  const leafColor = blend(pal.leaf, pal.grassLight, 0.3);
  const stemTones = flowerStemTones(pal);
  for (let i = 0; i < stems; i++) {
    const angle = phase + (i * TAU) / stems + (rng() - 0.5) * 0.5;
    const radius = 0.03 + rng() * 0.11;
    const root = V(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const height = 0.22 + rng() * 0.2;
    const lean = V(Math.cos(angle) * height * 0.3, height, Math.sin(angle) * height * 0.3);
    const curve = (t: number) => root.clone().add(lean.clone().multiplyScalar(t)).add(V(Math.sin(angle + 0.8) * Math.sin(t * Math.PI) * 0.015, 0, Math.cos(angle + 0.8) * Math.sin(t * Math.PI) * 0.015));
    // High/mid share the skeleton, including the root tangent used to ground the mesh.
    // Most mid-LOD savings come from the head, not these six extra stem triangles.
    if (ultra) tube(m, sampleCurve(curve, 6), 0.0026, 0.0014, pal.stem, 5, false, stemColorAt(stemTones.foot, stemTones.tip));
    else tube(m, sampleCurve(curve, low ? 2 : 3), 0.0026, 0.0014, pal.stem, 3);
    if (!low) {
      for (let j = 0; j < 2; j++) {
        for (const sign of [-1, 1]) {
          const dir = V(Math.cos(angle + j * 1.3) * sign, 0.3, Math.sin(angle + j * 1.3) * sign);
          curvedLeaf(m, curve(0.22 + j * 0.3), dir, 0.05 + rng() * 0.035, 0.02, tone(leafColor, 0.9 + rng() * 0.25), { curl: 0.12, twist: sign * 0.15 });
        }
      }
    }
    // head: dense cluster bloom (~7–10 cm across)
    const up = lean.clone().normalize().add(V((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3)).normalize();
    // Petal tessellation must not advance the layout stream and move the next stem.
    // Retain the existing cheap low LOD; only high/mid need matching silhouettes.
    const headRadius = 0.034 + rng() * 0.016;
    if (fine) clusterHeadUltra(m, curve(1), up, headRadius, rng.fork(`head-${i}`), fine, pal);
    else clusterHead(m, curve(1), up, headRadius, low ? rng : rng.fork(`head-${i}`), pal, detail);
  }
  if (!low) {
    const rosette = 4 + rng.int(0, 3);
    for (let l = 0; l < rosette; l++) {
      const a = phase + (l * TAU) / rosette + rng() * 0.4;
      const dir = V(Math.cos(a), 0.55 + rng() * 0.3, Math.sin(a)).normalize();
      curvedLeaf(m, V(Math.cos(a) * 0.02, 0.005, Math.sin(a) * 0.02), dir, 0.07 + rng() * 0.05, 0.035, tone(leafColor, 0.85 + rng() * 0.2), { curl: 0.2, ridge: 0.12 });
    }
  }
  return m.finish({ groundToZero: true });
}

/** Purple flower spikes (hyacinth / lupin-like): a stem carrying a column of small bells. */
export function flowerSpikeGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  // round 43: `ultra` keeps the high LOD's stems, leaves and bell stations (same stream) and
  // rebuilds every bell as a hanging throat tube with five cupped lobes (bell) from a forked stream
  const ultra = detail === 'ultra';
  const fine = ultra ? createRng(`${seed}/ultra`) : null;
  const low = detail === 'low';
  const stems = low ? 4 : 5 + rng.int(0, 4);
  const phase = rng() * TAU;
  const leafColor = blend(pal.leaf, pal.grassLight, 0.35);
  const stemTones = flowerStemTones(pal);
  const bellTones = violetBellTones(pal);
  for (let i = 0; i < stems; i++) {
    const angle = phase + (i * TAU) / stems + (rng() - 0.5) * 0.5;
    const radius = 0.02 + rng() * 0.13;
    const root = V(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const height = 0.26 + rng() * 0.2;
    const lean = V(Math.cos(angle) * height * 0.22, height, Math.sin(angle) * height * 0.22);
    const curve = (t: number) => root.clone().add(lean.clone().multiplyScalar(t)).add(V(Math.sin(angle + 1.1) * Math.sin(t * Math.PI) * 0.012, 0, Math.cos(angle + 1.1) * Math.sin(t * Math.PI) * 0.012));
    if (ultra) tube(m, sampleCurve(curve, 6), 0.0026, 0.0014, pal.stem, 5, false, stemColorAt(stemTones.foot, stemTones.tip));
    else tube(m, sampleCurve(curve, low ? 2 : 3), 0.0026, 0.0014, pal.stem, 3);
    if (!low) {
      for (const sign of [-1, 1]) {
        const dir = V(Math.cos(angle + 0.9) * sign, 0.35, Math.sin(angle + 0.9) * sign);
        curvedLeaf(m, curve(0.18), dir, 0.07 + rng() * 0.04, 0.022, tone(leafColor, 0.9 + rng() * 0.25), { curl: 0.15, twist: sign * 0.2 });
      }
    }
    const bells = low ? 5 : 7 + rng.int(0, 4);
    const bellR = 0.022 + rng() * 0.008;
    for (let b = 0; b < bells; b++) {
      const t = 0.45 + (b / (bells - 1)) * 0.55;
      const c = curve(t);
      const a0 = rng() * TAU;
      const petals = low ? 3 : 4;
      const scale = 1 - 0.35 * Math.max(0, (t - 0.85) / 0.15);
      // the high LOD's petal draws (heading, colour) are taken in the same order at every detail so
      // the layout stream never shifts; the ultra bell hangs from the first petal's heading
      const hangs: Vector3[] = [];
      for (let p = 0; p < petals; p++) {
        const a = a0 + (p * TAU) / petals;
        const dir = V(Math.cos(a), -0.35 + rng() * 0.3, Math.sin(a)).normalize();
        const color = blend(blend(pal.purple, pal.purpleLight, 0.2 + rng() * 0.5), pal.purpleDeep, rng() * 0.3);
        if (fine) {
          hangs.push(dir);
          continue;
        }
        // Mid-distance bells keep every floret but use a folded lamina instead of four triangles.
        if (low || detail === 'mid') foldedLeaf(m, c, dir, bellR * (low ? 1.6 : 1.7) * scale, bellR * 1.6 * scale, color, { curl: 0.2 });
        else curvedLeaf(m, c, dir, bellR * 1.7 * scale, bellR * 1.6 * scale, color, { curl: 0.3, ridge: -0.1, tipColor: pal.purpleLight });
      }
      if (fine) {
        // two bells a station, hanging off opposite sides of the stem like the high LOD's four
        // petals did, each a throat tube with 5–6 lobes and its mouth turned a little downward
        for (const k of [0, 2]) {
          const hang = hangs[k].clone().add(V(0, -0.25, 0)).normalize();
          const r = bellR * 0.95 * scale * (0.9 + fine() * 0.2);
          bell(m, c.clone().addScaledVector(hang, bellR * 1.05 * scale), hang, r, 5 + fine.int(0, 2), fine, bellTones);
        }
      }
    }
    // terminal bud: the low-detail head draws from the main stream, so the ultra LOD runs it into
    // a scratch builder (the stream stays the high LOD's) and puts a closed teardrop bud there
    // instead (sheet 05 "forest buds", the throat tone)
    clusterHead(fine ? new MeshBuilder() : m, curve(1), lean.clone().normalize(), bellR * 1.1, rng, pal, 'low');
    if (fine) {
      const tip = lean.clone().normalize();
      // inside the low head's envelope (0.8 × 1.1 × bellR above the tip)
      const budR = bellR * 0.5;
      lathe(m, curve(1).addScaledVector(tip, -budR * 0.35), tip, (u) => ({ r: budR * Math.pow(Math.sin(u * Math.PI), 0.7) * (1 - 0.35 * u), y: budR * 2.05 * u }), 4, 5, bellTones.throat, (u) => blend(bellTones.throat, tone(bellTones.lobe, 0.9), u * 0.6));
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- broad-leaf plants
/** the three concept-sheet laminae, one per weed variant (sheet 01 “Leaves & plants”) */
export const BROADLEAF_SHAPES: readonly LeafShape[] = ['heart', 'ovate', 'round'];

/**
 * Broad-leaf ground plant: 3–6 waxy leaves on short petioles rising from a crown, 0.15–0.35 m
 * across at unit scale. Variant 0 grows the heart-shaped Kokiri leaf, 1 the broad ovate forest
 * leaf, 2 the round ground leaf; each lamina carries a raised, lighter midrib. The glossy upper
 * face comes from the material (`topRoughness`), the underside stays matte.
 */
/**
 * The broadleaf ultra LOD's per-leaf hue spread (round 43): each lamina leans toward an older
 * yellow-olive or a fresh blue-green by up to this much (multiplicative, per channel), from the
 * ultra stream — a rosette a metre out is no longer one green.
 */
export const BROADLEAF_HUE_SPREAD = 0.09;

export function weedGeometry(seed: string, pal: PlantPalette, detail: Detail, variant = 0): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  // round 43: `ultra` is the high LOD's rosette from the same stream — every leaf's heading,
  // length, rise and curl — with the petiole a bent 4-sided tube under a foot → knee gradient, the
  // lamina at 9 × 5 with a gently wavy rim, and a per-leaf hue shift from a forked stream; its u
  // sits in the broad-lamina band (BROADLEAF_U) so the material draws the midrib, the arcing
  // lateral veins, the cupped margin and the lit edge at a hosta's strength (materials.ts)
  const ultra = detail === 'ultra';
  const fine = ultra ? createRng(`${seed}/ultra`) : null;
  const high = detail === 'high' || ultra;
  const shape = BROADLEAF_SHAPES[variant % BROADLEAF_SHAPES.length];
  // round 31: 5–7 leaves per rosette (was 4–6), the near laminae with a serrated rim and a vein
  // crease either side of the midrib (the frames' broad leaves are not flat cards)
  const leaves = high ? 5 + rng.int(0, 3) : 3;
  const phase = rng() * TAU;
  // heart leaves are the fresh mid green, forest leaves the deep glossy green, ground leaves yellower
  const lamina = shape === 'ovate' ? blend(pal.weed, pal.leaf, 0.55) : shape === 'round' ? blend(pal.weed, pal.leafSun, 0.25) : blend(pal.weed, pal.leaf, 0.3);
  const petioleColor = blend(pal.stem, lamina, 0.5);
  const petioleFoot = tone(blend(petioleColor, pal.bark, 0.3), 0.85);
  const aspect = shape === 'round' ? 0.95 : shape === 'heart' ? 0.82 : 0.58;
  for (let l = 0; l < leaves; l++) {
    const a = phase + (l * TAU) / leaves + (rng() - 0.5) * 0.6;
    const radial = V(Math.cos(a), 0, Math.sin(a));
    const len = (0.075 + rng() * 0.055) * (high ? 1 : 1.15);
    const rise = 0.55 + rng() * 0.75;
    // petiole: from the crown up and out, the blade continuing flatter so its face turns to the sky
    const petiole = 0.03 + rng() * 0.05;
    const root = V(Math.cos(a) * 0.01, 0.003, Math.sin(a) * 0.01);
    const knee = root.clone().addScaledVector(radial, petiole * 0.8).add(V(0, petiole * rise, 0));
    if (fine) {
      // the bent petiole: sags a little under the blade's weight and bows sideways
      const lateral = V(-radial.z, 0, radial.x);
      const mid = root.clone().lerp(knee, 0.5).add(V(0, -petiole * 0.12 * (0.5 + fine()), 0)).addScaledVector(lateral, petiole * (fine() - 0.5) * 0.3);
      tube(m, [root, mid, knee], 0.0035, 0.0025, petioleColor, 4, false, stemColorAt(petioleFoot, tone(petioleColor, 1.04)));
    } else if (high) tube(m, [root, knee], 0.0035, 0.0025, petioleColor, 3);
    const dir = radial.clone().multiplyScalar(1).add(V(0, rise * 0.35 - 0.1 + (rng() - 0.5) * 0.2, 0)).normalize();
    let color = tone(lamina, 0.88 + rng() * 0.26);
    if (fine) {
      // older leaves lean yellow-olive, fresh ones blue-green
      const age = fine() * 2 - 1;
      const k = BROADLEAF_HUE_SPREAD * Math.abs(age);
      color = age > 0 ? [color[0] * (1 + k), color[1] * (1 + k * 0.4), color[2] * (1 - k)] : [color[0] * (1 - k), color[1] * (1 + k * 0.2), color[2] * (1 + k)];
    }
    shapedLeaf(m, knee, dir, len, len * aspect * (0.9 + rng() * 0.2), color, {
      shape,
      sections: fine ? 9 : high ? 6 : 3,
      across: fine ? 5 : high ? 5 : 3,
      curl: 0.1 + rng() * 0.14,
      twist: (rng() - 0.5) * 0.35,
      ridge: 0.13,
      serration: high ? (shape === 'round' ? 0.05 : 0.09) : 0,
      crease: high ? 0.14 : 0,
      wave: fine ? 0.05 + fine() * 0.05 : 0,
      uOffset: fine ? BROADLEAF_U : 0,
    });
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- white forest flowers
/**
 * White forest flowers (sheet 01 “Flower clumps”, 02 / 04): a clump of 8–15 small five-petal white
 * blooms with yellow centres on thin stems, 0.3–0.5 m across and ≤ 0.25 m tall at unit scale,
 * with a few heart-shaped leaves at its base.
 */
/** the white bloom's ultra tones (round 43): petal white / cream, the throat's faint yellow-green, the stamen yellow and its orange anther tips, the calyx green */
export function whiteBloomTones(pal: PlantPalette): { white: RGB; cream: RGB; throat: RGB; yellow: RGB; anther: RGB; calyx: RGB } {
  const white: RGB = [0.9, 0.9, 0.84];
  const cream: RGB = [0.96, 0.95, 0.88];
  const yellow: RGB = blend(pal.yellow, [1, 0.8, 0.2], 0.4);
  return { white, cream, throat: blend(cream, [0.92, 0.9, 0.55], 0.35), yellow, anther: blend(yellow, [1, 0.55, 0.1], 0.45), calyx: blend(pal.leaf, pal.grassLight, 0.45) };
}
/** share of the white blooms the ultra LOD shows as closed teardrop buds (sheet 05 "forest buds") */
export const WHITE_BUD_SHARE = 0.2;

export function whiteFlowerGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  // round 43: `ultra` keeps the high LOD's clump — every stem, bloom axis, petal heading and leaf
  // from the same stream — and rebuilds each bloom at arm's length from a forked stream: a green
  // calyx cup, 5–6 separate cupped petals (open or half-open, tilted a little) with a faint
  // yellow-green throat and a baked midline, a stamen boss with anther-tipped filaments; a fifth of
  // the blooms are closed teardrop buds. The heart leaves go to 6 × 5 with a bent petiole.
  const ultra = detail === 'ultra';
  const fine = ultra ? createRng(`${seed}/ultra`) : null;
  const high = detail === 'high' || ultra;
  const blooms = high ? 8 + rng.int(0, 8) : 8;
  // root radius; with the leaning stems and petals the clump reads 0.3–0.5 m across
  const clumpR = 0.1 + rng() * 0.07;
  const phase = rng() * TAU;
  const tones = whiteBloomTones(pal);
  const { white, cream, yellow } = tones;
  const stemColor = blend(pal.stem, pal.grassLight, 0.4);
  const leafColor = blend(pal.leaf, pal.grassLight, 0.3);
  for (let i = 0; i < blooms; i++) {
    const a = phase + (i * TAU) / blooms + (rng() - 0.5) * 0.8;
    const r = clumpR * (0.25 + 0.75 * Math.sqrt(rng()));
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.09 + rng() * 0.12;
    const lean = V(Math.cos(a) * h * 0.22, h, Math.sin(a) * h * 0.22);
    const top = root.clone().add(lean);
    const stemPoints = high ? [root, root.clone().addScaledVector(lean, 0.5).add(V(Math.sin(a) * 0.006, 0, Math.cos(a) * 0.006)), top] : [root, top];
    if (fine) tube(m, stemPoints, 0.002, 0.0012, stemColor, 4, false, stemColorAt(tone(blend(stemColor, pal.bark, 0.25), 0.85), tone(stemColor, 1.05)));
    else tube(m, stemPoints, 0.002, 0.0012, stemColor, 3);
    // the bloom faces up and a little outward
    const up = lean.clone().normalize().add(V((rng() - 0.5) * 0.4, 0.5, (rng() - 0.5) * 0.4)).normalize();
    const side = new Vector3().crossVectors(Math.abs(up.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), up).normalize();
    const fwd = new Vector3().crossVectors(up, side).normalize();
    const petalLen = 0.014 + rng() * 0.006;
    const p0 = rng() * TAU;
    const petals = high ? 5 : 4;
    // the far LOD (> 12 m, where a bloom is a pixel or two) grows its petals so the white dots
    // of frame 14 s survive the distance
    const far = high ? 1 : 2.4;
    // the high LOD's petal colours are drawn in the same order at every detail (the stream)
    const petalColors: RGB[] = [];
    for (let p = 0; p < petals; p++) {
      const pa = p0 + (p * TAU) / petals;
      const dir = side.clone().multiplyScalar(Math.cos(pa)).addScaledVector(fwd, Math.sin(pa)).addScaledVector(up, 0.12).normalize();
      const base = top.clone().addScaledVector(dir, 0.003);
      const color = blend(white, cream, rng() * 0.6);
      if (fine) {
        petalColors.push(color);
        continue;
      }
      // petals cup upward (positive curl toward `up`), the lamina plane pinned to the bloom's axis
      if (high) curvedLeaf(m, base, dir, petalLen, petalLen * 0.72, color, { curl: 0.28, ridge: -0.05, planeNormal: up, tipColor: cream });
      else foldedLeaf(m, base, dir, petalLen * far, petalLen * 0.9 * far, color, { curl: 0.25, ridge: -0.05, planeNormal: up });
    }
    if (fine) whiteBloomUltra(m, top, up, side, fwd, petalLen, p0, petalColors, fine, tones);
    else disc(m, top.clone().addScaledVector(up, 0.002), up, 0.0042 * far, high ? 6 : 3, yellow, tone(yellow, 0.85), 0.002);
  }
  if (high) {
    const leaves = 3 + rng.int(0, 3);
    for (let l = 0; l < leaves; l++) {
      const a = phase + (l * TAU) / leaves + rng() * 0.5;
      const radial = V(Math.cos(a), 0, Math.sin(a));
      const root = V(Math.cos(a) * 0.02, 0.003, Math.sin(a) * 0.02);
      const knee = root.clone().addScaledVector(radial, 0.03).add(V(0, 0.035, 0));
      if (fine) tube(m, [root, root.clone().lerp(knee, 0.5).add(V(0, -0.004 * fine(), 0)), knee], 0.0025, 0.0018, stemColor, 4, false, stemColorAt(tone(blend(stemColor, pal.bark, 0.25), 0.85), tone(stemColor, 1.04)));
      else tube(m, [root, knee], 0.0025, 0.0018, stemColor, 3);
      const len = 0.04 + rng() * 0.025;
      shapedLeaf(m, knee, radial.clone().add(V(0, 0.15, 0)), len, len * 0.85, tone(leafColor, 0.9 + rng() * 0.2), fine ? { shape: 'heart', sections: 6, across: 5, curl: 0.15, ridge: 0.12, crease: 0.1, serration: 0.05 } : { shape: 'heart', sections: 4, across: 5, curl: 0.15, ridge: 0.12 });
    }
  }
  return m.finish({ groundToZero: true });
}

/**
 * One white bloom at the ultra LOD (round 43). `top` is the stem's tip, `up` the bloom's axis
 * with `side` / `fwd` its frame, `p0` the high LOD's first petal heading and `petalColors` its
 * petal draws; everything else — open or half-open, 5 or 6 petals, the tilt, the bud share — is
 * the `fine` stream's. A closed bud replaces WHITE_BUD_SHARE of the blooms.
 */
function whiteBloomUltra(m: MeshBuilder, top: Vector3, up: Vector3, side: Vector3, fwd: Vector3, petalLen: number, p0: number, petalColors: RGB[], fine: Rng, tones: ReturnType<typeof whiteBloomTones>) {
  const { cream, throat, yellow, anther, calyx } = tones;
  // the calyx: a small green cup under the bloom
  lathe(m, top.clone().addScaledVector(up, -0.004), up, (u) => ({ r: 0.0012 + 0.0026 * Math.pow(u, 0.6), y: 0.0055 * u }), 2, 5, calyx, (u) => tone(calyx, 0.8 + 0.3 * u));
  if (fine() < WHITE_BUD_SHARE) {
    // a closed teardrop bud: cream petals furled round the stamens, greener toward the calyx
    const budR = petalLen * 0.3;
    lathe(m, top.clone().addScaledVector(up, 0.001), up, (u) => ({ r: budR * Math.pow(Math.sin(u * Math.PI), 0.65) * (1 - 0.3 * u), y: petalLen * 0.55 * u }), 4, 6, cream, (u) => blend(blend(calyx, cream, 0.5), cream, Math.min(1, u * 1.8)));
    return;
  }
  const open = fine() < 0.7;
  const count = fine() < 0.7 ? 5 : 6;
  // the whole bloom tilts a little off its stem's axis
  const tilt = fine() * 0.25;
  const tiltA = fine() * TAU;
  const axis = up.clone().addScaledVector(side, Math.cos(tiltA) * tilt).addScaledVector(fwd, Math.sin(tiltA) * tilt).normalize();
  const s2 = new Vector3().crossVectors(Math.abs(axis.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), axis).normalize();
  const f2 = new Vector3().crossVectors(axis, s2).normalize();
  const spread = open ? 0.12 + fine() * 0.08 : 0.36 + fine() * 0.14;
  const centre = top.clone().addScaledVector(axis, 0.001);
  for (let p = 0; p < count; p++) {
    const pa = p0 + (p * TAU) / count + (fine() - 0.5) * 0.12;
    const dir = s2.clone().multiplyScalar(Math.cos(pa)).addScaledVector(f2, Math.sin(pa)).addScaledVector(axis, spread).normalize();
    const color = petalColors[p % petalColors.length];
    // a half-open bloom's petals are still extending
    const len = petalLen * (open ? 0.92 + fine() * 0.16 : 0.78 + fine() * 0.12);
    // a separate obovate petal, cupped toward the axis, its throat a faint yellow-green and a
    // lighter midline running out to the cream tip (the vein gradient)
    shapedLeaf(m, centre.clone().addScaledVector(dir, 0.0015), dir, len, len * 0.62, color, {
      shape: 'petal',
      sections: 4,
      across: 5,
      curl: open ? 0.3 : 0.5,
      cup: 0.18,
      ridge: -0.04,
      twist: (fine() - 0.5) * 0.2,
      planeNormal: axis,
      uOffset: PETAL_U,
      colorAt: (t, s, row) => {
        const base = blend(blend(throat, color, Math.min(1, t * 2.2)), cream, t * 0.5);
        return tone(base, s === 0 ? 1.03 : 1 - 0.03 * Math.abs(s)) as RGB;
      },
    });
  }
  // the stamen boss: a yellow dome with anther-tipped filaments standing out of it
  lathe(m, centre, axis, (u) => ({ r: 0.0028 * Math.pow(1 - u * u, 0.5), y: 0.0022 * u }), 2, 6, yellow, (u) => tone(yellow, 0.82 + 0.28 * u));
  const filaments = 5 + fine.int(0, 3);
  for (let k = 0; k < filaments; k++) {
    const fa = fine() * TAU;
    const fd = s2.clone().multiplyScalar(Math.cos(fa)).addScaledVector(f2, Math.sin(fa)).multiplyScalar(0.5 + fine() * 0.35).addScaledVector(axis, 1).normalize();
    const foot = centre.clone().addScaledVector(axis, 0.0015).addScaledVector(fd, 0.0006);
    const tip = foot.clone().addScaledVector(fd, 0.0028 + fine() * 0.0014);
    tube(m, [foot, tip], 0.00035, 0.0007, blend(yellow, anther, 0.3), 3, true, (t) => blend(tone(yellow, 0.95), anther, t * t));
  }
}

// ---------------------------------------------------------------- fiddleheads (forest buds)
/**
 * Fiddleheads (sheet 01 “Forest buds (unopened)”, sheet 04): 2–4 spiral buds on stout stalks,
 * 0.25–0.45 m tall at unit scale, the coil curling back over itself toward the crown. Sits at
 * the centre of a fern crown.
 */
/**
 * The ultra fiddlehead stalk's gradient (round 40 follow-up): a darker, warmer foot (toward the
 * bark, a touch of red) rising to a lit tone toward the coil's yellow-green.
 */
export function fiddleheadStalkTones(pal: PlantPalette): { foot: RGB; tip: RGB } {
  const stalkColor = blend(pal.fern, pal.bark, 0.35);
  const coilColor = tone(blend(pal.fern, pal.leafSun, 0.55), 1.1);
  return {
    foot: tone(blend(blend(stalkColor, pal.bark, 0.4), [0.42, 0.3, 0.16], 0.18), 0.78),
    tip: tone(blend(stalkColor, coilColor, 0.5), 1.08),
  };
}

export function fiddleheadGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  // `ultra` (round 40 follow-up) is the high LOD's layout from the same stream — no pop at
  // FIDDLEHEAD_ULTRA_M — with the stalk an 8-sided tube under a lengthwise gradient and the
  // baked underside / ridge shading (stemShade)
  const ultra = detail === 'ultra';
  const high = detail === 'high' || ultra;
  const buds = high ? 2 + rng.int(0, 3) : 2;
  const phase = rng() * TAU;
  // dark fibrous stalks, the coil a lighter yellow-green (sheet 01: pale fuzzy spirals on dark stems)
  const stalkColor = blend(pal.fern, pal.bark, 0.35);
  const coilColor = tone(blend(pal.fern, pal.leafSun, 0.55), 1.1);
  const scaleColor = blend(pal.bark, pal.straw, 0.35);
  const { foot: stalkFoot, tip: stalkTip } = fiddleheadStalkTones(pal);
  for (let b = 0; b < buds; b++) {
    const a = phase + (b * TAU) / buds + (rng() - 0.5) * 0.7;
    const radial = V(Math.cos(a), 0, Math.sin(a));
    const root = radial.clone().multiplyScalar(0.02 + rng() * 0.04);
    // stalk + coil: 0.26–0.41 m at unit scale
    const h = 0.24 + rng() * 0.13;
    const lean = 0.05 + rng() * 0.09;
    const stalk = (t: number) => root.clone().addScaledVector(radial, lean * t * t).add(V(0, h * t, 0));
    const points = sampleCurve(stalk, high ? 5 : 3);
    if (ultra) tube(m, points, 0.0072, 0.0055, stalkColor, ULTRA_STEM_SIDES, false, stemColorAt(stalkFoot, stalkTip));
    else tube(m, points, 0.0072, 0.0055, stalkColor, high ? 5 : 3);
    // coil: tangent to the stalk at its top, curling inward (toward the crown) and over itself
    const top = stalk(1);
    const R = 0.026 + rng() * 0.014;
    const centre = top.clone().addScaledVector(radial, -R);
    const turns = 1.25 + rng() * 0.3;
    const n = high ? 12 : 6;
    const coil: Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const ang = u * turns * TAU;
      const r = R * (1 - 0.55 * u);
      coil.push(centre.clone().addScaledVector(radial, Math.cos(ang) * r).add(V(0, Math.sin(ang) * r, 0)).addScaledVector(V(-radial.z, 0, radial.x), Math.sin(u * Math.PI) * 0.004));
    }
    // a rope-thick spiral (sheet 01: fat fuzzy coils), tapering toward the tip
    tube(m, coil, 0.0085, 0.0032, coilColor, high ? 6 : 3, true);
    if (high) {
      // papery brown scales clinging to the stalk and the outer coil
      for (let s = 0; s < 3; s++) {
        const t = 0.3 + s * 0.25;
        const at = stalk(t);
        const dir = radial.clone().multiplyScalar(s % 2 ? 1 : -1).add(V(0, 0.9, 0)).normalize();
        foldedLeaf(m, at, dir, 0.014, 0.007, scaleColor, { curl: 0.3 });
      }
      foldedLeaf(m, coil[2], V(-radial.x, 0.4, -radial.z).normalize(), 0.012, 0.007, scaleColor, { curl: 0.3 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- tall seed-head stalks
export function seedheadGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const stalks = high ? 3 + rng.int(0, 3) : 3;
  const phase = rng() * TAU;
  const stalkColor = blend(pal.weed, pal.straw, 0.5);
  for (let s = 0; s < stalks; s++) {
    const a = phase + (s * TAU) / stalks + (rng() - 0.5) * 0.7;
    const r = 0.02 + rng() * 0.06;
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.42 + rng() * 0.33;
    const lean = 0.08 + rng() * 0.16;
    const curve = (t: number) => root.clone().add(V(Math.cos(a) * lean * t * t, h * t, Math.sin(a) * lean * t * t));
    tube(m, sampleCurve(curve, high ? 3 : 2), 0.0022, 0.0012, stalkColor, 3);
    // seed spike
    const top = curve(1);
    const tipDir = V(Math.cos(a) * lean * 2, h, Math.sin(a) * lean * 2).normalize();
    const spike = [top, top.clone().addScaledVector(tipDir, 0.035), top.clone().addScaledVector(tipDir, 0.075)];
    tube(m, spike, 0.006, 0.002, blend(pal.straw, pal.bark, 0.25), 3, true);
    if (high) foldedLeaf(m, curve(0.35), V(-Math.sin(a), 0.55, Math.cos(a)), 0.11, 0.012, tone(pal.weed, 0.95), { curl: 0.2 });
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- grass tufts
/** nominal heights of the three tuft classes (short verge tuft / mid / tall bank tuft), metres at unit scale */
export const TUFT_HEIGHTS: readonly [number, number, number] = [0.2, 0.32, 0.5];

/**
 * Grass tuft (round 31): 12–17 blades springing from one root, each a ribbon that leans away
 * from the tuft centre and bends over at the tip, so the clump reads as a fountain of bent
 * blades rather than the tile grass's straight spikes. Three height classes keyed off the
 * variant index (`variant % 3`: ≈ 0.2 / 0.32 / 0.5 m at unit scale, TUFT_HEIGHTS), blade heights
 * spread 0.6–1.05 × the class inside a tuft, a quarter of the blades straw-tipped; the whole
 * tuft tilts a little off vertical so neighbouring tufts lean different ways. Blade colour runs
 * from a deep root to a lit tip (the grass shader's gradient) so the tuft has a dark heart. The
 * far LOD keeps 6 wider blades. ≈ 130 / 30 triangles.
 */
export function tuftGeometry(seed: string, pal: PlantPalette, detail: Detail, variant = 0): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const cls = variant % 3;
  const H = TUFT_HEIGHTS[cls] * (0.9 + rng() * 0.2);
  const blades = high ? 12 + rng.int(0, 6) : 6;
  const rows = high ? 5 : 3;
  const phase = rng() * TAU;
  const root: RGB = blend(pal.leaf, pal.mossDeep, 0.35);
  const lit: RGB = blend(pal.grassLight, pal.leafSun, 0.3);
  const straw: RGB = blend(pal.straw, pal.grassLight, 0.35);
  const clumpLean = V((rng() - 0.5) * 0.24, 0, (rng() - 0.5) * 0.24);
  for (let b = 0; b < blades; b++) {
    const a = phase + (b * TAU) / blades + (rng() - 0.5) * 0.6;
    const radial = V(Math.cos(a), 0, Math.sin(a));
    const start = radial.clone().multiplyScalar(0.008 + rng() * 0.028);
    const h = H * (0.6 + rng() * 0.45);
    const lean = 0.2 + rng() * 0.45;
    const bend = 0.3 + rng() * 0.55;
    const points: Vector3[] = [];
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      // outward lean grows with height, the tip folds over and falls outward
      const out = h * (lean * t * t + bend * 0.35 * t * t * t);
      const y = h * (t - bend * 0.3 * t * t * t);
      points.push(start.clone().addScaledVector(radial, out).addScaledVector(clumpLean, h * t).add(V(0, y, 0)));
    }
    const width = (0.011 + rng() * 0.009) * (0.8 + cls * 0.25) * (high ? 1 : 1.6);
    // a deep root under a lit tip: the frames' tufts are bright blade ends over a dark heart
    const color = blend(root, lit, 0.08 + rng() * 0.32);
    const dry = rng() < 0.25;
    bladeStrip(m, points, width, radial, color, dry ? blend(lit, straw, 0.7) : tone(lit, 1.08 + rng() * 0.16), 0.3);
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- clover / sorrel ground cover
export function cloverGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  // round 43: `ultra` keeps the high LOD's stems and leaflet headings (same stream) and draws each
  // leaflet as an obcordate lamina (shapedLeaf 'clover', 3 × 5) with the pale chevron baked in,
  // on a bent 4-sided petiole; the material's lamina detail adds the midrib and the lit edge
  const ultra = detail === 'ultra';
  const fine = ultra ? createRng(`${seed}/ultra`) : null;
  const high = detail === 'high' || ultra;
  const stems = high ? 4 + rng.int(0, 3) : 3;
  const phase = rng() * TAU;
  const color = blend(pal.leaf, pal.grassLight, 0.45);
  const chevron: RGB = blend(color, [0.9, 0.95, 0.8], 0.45);
  const petioleFoot = tone(blend(pal.stem, pal.bark, 0.3), 0.85);
  for (let s = 0; s < stems; s++) {
    const a = phase + (s * TAU) / stems + (rng() - 0.5) * 0.6;
    const r = 0.015 + rng() * 0.05;
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.04 + rng() * 0.05;
    const top = root.clone().add(V(Math.cos(a) * h * 0.3, h, Math.sin(a) * h * 0.3));
    if (fine) {
      const mid = root.clone().lerp(top, 0.5).add(V(Math.sin(a) * 0.004 * (fine() - 0.5), 0.002 * fine(), Math.cos(a) * 0.004 * (fine() - 0.5)));
      tube(m, [root, mid, top], 0.0012, 0.0008, pal.stem, 4, false, stemColorAt(petioleFoot, tone(pal.stem, 1.05)));
    } else if (high) tube(m, [root, top], 0.0012, 0.0008, pal.stem, 3);
    const size = 0.022 + rng() * 0.014;
    for (let l = 0; l < 3; l++) {
      const la = a + (l * TAU) / 3 + rng() * 0.3;
      const dir = V(Math.cos(la), 0.2 + (rng() - 0.5) * 0.3, Math.sin(la)).normalize();
      const leafColor = tone(color, 0.9 + rng() * 0.3);
      if (fine) {
        const hue = 1 + (fine() - 0.5) * 0.1;
        const c: RGB = [leafColor[0] * hue, leafColor[1], leafColor[2] * (2 - hue)];
        shapedLeaf(m, top, dir, size, size * 0.95, c, {
          shape: 'clover',
          sections: 3,
          across: 5,
          curl: 0.1 + fine() * 0.05,
          ridge: 0.15,
          twist: (fine() - 0.5) * 0.3,
          // the pale chevron: a band across the leaflet a third of the way up, fading toward the rim
          colorAt: (t, s, row) => {
            const band = Math.max(0, 1 - Math.abs(t - 0.4) / 0.18) * (1 - 0.6 * Math.abs(s));
            return blend(tone(row, s === 0 ? 1.06 : 1 - 0.04 * Math.abs(s)), chevron, band * 0.8);
          },
        });
      } else foldedLeaf(m, top, dir, size, size * 0.85, leafColor, { curl: 0.12, ridge: 0.15 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- moss tufts
/** the moss cushion's ultra tint (round 43): the base ring's gain (dark damp rim) and the crown's (lit top) over the mid tone, with the sun-through-the-tips warmth on the crown */
export const MOSS_RIM_GAIN = 0.55;
export const MOSS_TOP_GAIN = 1.28;
export const MOSS_TOP_TINT: RGB = [1.0, 1.04, 0.86];

export function mossGeometry(seed: string, pal: PlantPalette, detail: Detail = 'high'): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const jitterTable = Array.from({ length: 512 }, () => rng());
  const height = 0.38 + rng() * 0.12;
  if (detail !== 'ultra') {
    dome(m, 1, height, 9, 3, tone(pal.mossDeep, 0.85), tone(pal.mossBright, 0.9), (i) => jitterTable[Math.abs(i) % 512]);
    return m.finish();
  }
  // round 43: the ultra cushion keeps the high dome's height and unit radius (the same instance
  // scale seats it) and rebuilds it at 16 × 6 with a lumpy value-noise outline and surface — no
  // two cushions alike, the lobes 3–6 cm across at the placed scales — under a baked lit-top /
  // dark-rim tint (MOSS_*_GAIN, the structures' cushion tufts' recipe, implemented here)
  const fine = createRng(`${seed}/ultra`);
  const off = fine() * 100;
  const segments = 16;
  const rings = 6;
  const deep = tone(pal.mossDeep, 0.85);
  const bright = tone(pal.mossBright, 0.9);
  const mid = blend(deep, bright, 0.5);
  const colorAt = (t: number, lump: number): RGB => {
    // t: 0 rim … 1 crown; the lumps' crests catch light, their hollows sink toward the rim tone;
    // the gain runs from the dark damp rim to the lit crown (the mid tone is the high dome's mean)
    const lit = Math.pow(t, 0.8);
    const gain = (MOSS_RIM_GAIN + (MOSS_TOP_GAIN - MOSS_RIM_GAIN) * lit) * (1 + 0.14 * lump);
    const c = blend(blend(deep, bright, Math.min(1, lit + 0.25 * lump)), mid, 0.3);
    return [c[0] * gain * (1 + (MOSS_TOP_TINT[0] - 1) * lit), c[1] * gain * (1 + (MOSS_TOP_TINT[1] - 1) * lit), c[2] * gain * (1 + (MOSS_TOP_TINT[2] - 1) * lit)];
  };
  const levels: number[][] = [];
  for (let r = 0; r <= rings; r++) {
    // r = 0 is the base ring on the seat (like the high dome's), the rest climb the profile
    const t = r === 0 ? 0 : r / (rings + 1);
    const phi = (Math.PI / 2) * (1 - t);
    const level: number[] = [];
    for (let k = 0; k < segments; k++) {
      const ang = (k * TAU) / segments + (r % 2) * (Math.PI / segments);
      const cx = Math.cos(ang);
      const sz = Math.sin(ang);
      // the lobed outline (low frequency) and the surface lumps (higher), both from one field
      const ruffle = 1 + 0.16 * valueNoise3(cx * 1.6 + off, t * 1.3, sz * 1.6 - off);
      const lump = valueNoise3(cx * 3.4 * Math.sin(phi) + off * 0.7, t * 3.1 + off, sz * 3.4 * Math.sin(phi));
      const rr = Math.sin(phi) * (0.92 + 0.08 * (1 - t)) * ruffle * (1 + 0.07 * lump);
      const y = r === 0 ? 0 : Math.min(height, height * Math.cos(phi) * (1 + 0.1 * lump) + height * 0.04);
      level.push(m.vertex(V(cx * rr, y, sz * rr), NOT_LAMINA + k / segments, t, colorAt(t, lump)));
    }
    levels.push(level);
  }
  // the crown, nudged off-centre so the cushion leans a little
  const leanA = fine() * TAU;
  const lean = 0.12 * fine();
  const crown = m.vertex(V(Math.cos(leanA) * lean, height, Math.sin(leanA) * lean), NOT_LAMINA + 0.5, 1, colorAt(1, 0.5));
  for (let r = 0; r < rings; r++) {
    for (let k = 0; k < segments; k++) {
      const n = (k + 1) % segments;
      m.tri(levels[r][k], levels[r][n], levels[r + 1][k]);
      m.tri(levels[r][n], levels[r + 1][n], levels[r + 1][k]);
    }
  }
  for (let k = 0; k < segments; k++) m.tri(levels[rings][k], levels[rings][(k + 1) % segments], crown);
  return m.finish();
}

// ---------------------------------------------------------------- saplings
export function saplingGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const height = 1.3 + rng() * 0.9;
  const lean = V((rng() - 0.5) * 0.25, 0, (rng() - 0.5) * 0.25);
  const trunk = (t: number) => lean.clone().multiplyScalar(t * t * height).add(V(0, t * height, 0));
  tube(m, sampleCurve(trunk, high ? 6 : 4), 0.022, 0.006, blend(pal.bark, [0.35, 0.33, 0.3], 0.35), high ? 5 : 3);
  const branches = high ? 5 : low ? 3 : 4;
  for (let b = 0; b < branches; b++) {
    const t = 0.45 + (b / branches) * 0.5;
    const a = rng() * TAU;
    const start = trunk(t);
    const dir = V(Math.cos(a), 0.35 + rng() * 0.3, Math.sin(a)).normalize();
    const reach = 0.3 + rng() * 0.25;
    const twig = (u: number) => start.clone().addScaledVector(dir, reach * u).add(V(0, Math.sin(u * Math.PI) * 0.03, 0));
    if (!low) tube(m, sampleCurve(twig, 3), 0.006, 0.0015, tone(pal.bark, 1.1), 3);
    const leaves = high ? 8 : low ? 4 : 6;
    for (let l = 0; l < leaves; l++) {
      const u = 0.15 + (l / (leaves - 1)) * 0.85;
      const side = l % 2 ? -1 : 1;
      const cross = V(-dir.z, 0, dir.x);
      const ld = cross.multiplyScalar(side * 0.7).addScaledVector(dir, 0.5).add(V(0, (rng() - 0.3) * 0.5, 0)).normalize();
      const len = (0.09 + rng() * 0.05) * (low ? 1.6 : 1);
      const color = tone(blend(pal.leaf, pal.leafSun, 0.3 + u * 0.4), 0.85 + rng() * 0.3);
      if (low) foldedLeaf(m, twig(u), ld, len, len * 0.6, color);
      else curvedLeaf(m, twig(u), ld, len, len * 0.6, color, { curl: 0.12, twist: (rng() - 0.5) * 0.5 });
    }
  }
  // crown tuft
  for (let l = 0; l < (low ? 3 : 5); l++) {
    const a = rng() * TAU;
    const ld = V(Math.cos(a), 0.6, Math.sin(a)).normalize();
    curvedLeaf(m, trunk(1), ld, 0.1, 0.06, tone(pal.leafSun, 0.95 + rng() * 0.1), { curl: 0.15 });
  }
  return m.finish({ groundToZero: true });
}

/** Build `count` variants × all LODs; builders may key their shape off the variant index. */
export function variants(count: number, seed: string, pal: PlantPalette, build: (seed: string, pal: PlantPalette, detail: Detail, variant: number) => BufferGeometry, lods: Detail[] = DETAILS): BufferGeometry[][] {
  const out: BufferGeometry[][] = [];
  for (let v = 0; v < count; v++) out.push(lods.map((d) => build(`${seed}/${v}`, pal, d, v)));
  return out;
}

export function maxHeight(geos: BufferGeometry[][]): number {
  let h = 0;
  for (const row of geos) for (const g of row) h = Math.max(h, g.boundingBox?.max.y ?? 1);
  return h;
}

export type { Rng };
