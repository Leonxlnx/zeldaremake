/**
 * Plant geometry variants (ferns, bushes, purple and white flowers, fiddleheads, broad-leaf
 * plants, seed-head stalks, clover, moss tufts, saplings). Each builder returns one geometry per
 * LOD, highest detail first. Derived from Verdant Forest by Leonxlnx (understory.js /
 * botanical-refinement.js); leaf, flower and bud shapes follow the owner's concept sheets
 * (reference/concepts/01, see reference/CONCEPTS.md — the sheets are never loaded at runtime).
 */
import { Vector3, type BufferGeometry } from 'three';
import { createRng, type Rng } from '../util/prng';
import { BROADLEAF_U, MeshBuilder, NOT_LAMINA, PETAL_U, TAU, V, bladeStrip, blend, clamp01, curvedLeaf, disc, dome, foldedLeaf, lanceLeaf, lathe, petalCard, pinnateLeaf, rgb, sampleCurve, shapedLeaf, tone, tube, valueNoise3, type LeafShape, type RGB } from './geometry';

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
/**
 * Round 46 (survey-2 check 28: the mid-tier cluster still read as smooth sphere clusters at 2–4 m):
 * the lobed ultra cushion runs out to 6 m (was 3), so the walk's near cushions are always the
 * ruffled, stretched lobes with blades through them, the cheaper mid cluster 6–8 m, the dome past.
 * Camera D frames the most cushions inside the ring (≈ 70 at 6 m against ≈ 20 at 3 m, ≈ 1.1 K
 * triangles each): ≈ +55 K triangles there, the other fixed cameras less.
 */
export const MOSS_ULTRA_M = 6;
/**
 * Round 44 (survey-1 crop 28: the cushions 3–8 m out were pale smooth spheres — the 45-triangle
 * dome was the only LOD past MOSS_ULTRA_M): inside this camera distance a cushion draws a cheaper
 * lobe cluster (mossGeometry 'high' — the ultra's body and every second lobe of its own spiral, at
 * fewer sides), the dome only past it, dark-rimmed like the lobes so the swap is a shape change alone.
 */
export const MOSS_MID_M = 8;
export const FLOWER_DETAILS: readonly Detail[] = ['ultra', 'high', 'mid', 'low'];
export const WHITE_FLOWER_DETAILS: readonly Detail[] = ['ultra', 'high', 'low'];
export const BROADLEAF_DETAILS: readonly Detail[] = ['ultra', 'high', 'low'];
export const MOSS_DETAILS: readonly Detail[] = ['ultra', 'high', 'low'];
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
    // round 44 (survey-1 #10): the round-9 blend targets sat at hue 260° and rendered ≈ 257° — an
    // electric blue at 2 m, and 78 % of shot D's purple pixels within 5° of the purple metric's
    // 255° floor. The targets move to the base violet's own hue (0x8255a0 is 276°): ≈ 275° in the
    // vertex colour, a violet, and the metric's band (255–320°) with a margin either side.
    purple: blend(rgb(p.flowerPurple), rgb(0x9042c8), 0.7),
    purpleLight: blend(rgb(p.flowerPurple), rgb(0xb87ce4), 0.7),
    purpleDeep: blend(rgb(p.flowerPurple), rgb(0x64288e), 0.7),
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

// ---------------------------------------------------------------- bushes and hedge crowns
/**
 * Round 47 (owner review 2026-09-19, item 10): the bush and hedge crowns are one layered-leaf-cluster
 * builder in shrub.ts — `shrubCrown` with a HEDGE / BUSH / BIG_LEAF style (irregular lobed
 * silhouette, opaque dark cores, 3–4 depth layers of shaped two-tone laminae, lit bunch rims, leaf
 * sprays, stems at the skirt). The exports plants.ts and the tests read keep their names here.
 */
export { BIG_LEAF_STYLE, BIG_LEAF_VARIANT, BIG_LEAF_VARIANTS, BUSH_DETAILS, BUSH_STYLE, BUSH_ULTRA_M, HEDGE_DETAILS, HEDGE_STYLE, HEDGE_ULTRA_M, SHRUB_TOP_ROUGHNESS, bushGeometry, hedgeGeometry, shrubCrown } from './shrub';
export type { ShrubStyle } from './shrub';

// ---------------------------------------------------------------- purple flowers
/**
 * Round 44 (survey-1 #10: the violet clumps were saturated flat blobs — every head the one blue,
 * the heads touching, no stem between them, no shadow under them). The heads' scale against
 * round 43's 3.4–5 cm radius; the per-head tone spread (× 1 ± this) and hue lean (the red channel
 * up and the blue down toward magenta, or the reverse toward blue, by this fraction) from a stream
 * forked per head, so no two heads of a clump are the one violet and the layout stream never
 * moves; the shade at a head's underside (its lowest ring, the bells under its equator, a spike's
 * lowest bells) against its lit crown; and the high / mid stems' radius (m) — 3-sided, graded
 * foot → tip like the ultra's, thick enough to read as a stem between the smaller heads at 3–9 m.
 */
export const FLOWER_HEAD_SCALE = 0.85;
export const FLOWER_TONE_SPREAD = 0.14;
export const FLOWER_HUE_LEAN = 0.1;
export const FLOWER_UNDERSIDE = 0.62;
export const FLOWER_STEM_RADIUS: readonly [number, number] = [0.0034, 0.0017];

/** one head's (one spike's) colour transform: tone × hue lean, from its own forked stream */
function headVariation(rng: Rng): (c: RGB) => RGB {
  const gain = 1 + FLOWER_TONE_SPREAD * (rng() * 2 - 1);
  const lean = FLOWER_HUE_LEAN * (rng() * 2 - 1);
  return (c) => [c[0] * gain * (1 + lean), c[1] * gain * (1 - 0.25 * Math.abs(lean)), c[2] * gain * (1 - 0.5 * lean)];
}

/** the shade of a floret `t` of the way from the crown (0) to the underside (1) */
const undersideShade = (t: number) => 1 - (1 - FLOWER_UNDERSIDE) * clamp01(t);

/**
 * Hydrangea / allium-like cluster bloom: a bumpy violet dome of florets with a few petals
 * flaring from its rim. Dense enough to read as a solid purple blob at distance.
 */
function clusterHead(m: MeshBuilder, center: Vector3, normal: Vector3, radius: number, rng: Rng, pal: PlantPalette, detail: Detail, vary: (c: RGB) => RGB = (c) => c) {
  const n = normal.clone().normalize();
  const side = new Vector3().crossVectors(Math.abs(n.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), n).normalize();
  const fwd = new Vector3().crossVectors(n, side).normalize();
  const high = detail === 'high';
  const low = detail === 'low';
  const rings = high ? 3 : 2;
  const segments = low ? 5 : high ? 8 : 6;
  const floret = () => vary(blend(blend(pal.purple, pal.purpleLight, rng() * 0.5), pal.purpleDeep, rng() * 0.4));
  const at = (u: number, v: number, h: number) => center.clone().addScaledVector(side, u).addScaledVector(fwd, v).addScaledVector(n, h);
  const top = m.vertex(at(0, 0, radius * 0.8), NOT_LAMINA + 0.5, 1, vary(blend(pal.purple, pal.purpleLight, 0.3)));
  const levels: number[][] = [];
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    const phi = t * Math.PI * 0.55;
    const level: number[] = [];
    // the lowest ring is the head's underside: shaded against the crown (round 44)
    const shade = undersideShade(Math.pow(t, 1.5));
    for (let k = 0; k < segments; k++) {
      const ang = (k * TAU) / segments + (r % 2) * (Math.PI / segments);
      const rr = radius * Math.sin(phi) * (0.85 + rng() * 0.3);
      const h = radius * 0.8 * Math.cos(phi) * (0.85 + rng() * 0.3);
      level.push(m.vertex(at(Math.cos(ang) * rr, Math.sin(ang) * rr, h), NOT_LAMINA + k / segments, 1 - t, tone(floret(), shade)));
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
  // rim petals for a fluffy silhouette (hanging off the rim: shaded like the underside)
  const petals = low ? 3 : high ? 6 : 4;
  const p0 = rng() * TAU;
  const rimShade = undersideShade(0.7);
  for (let p = 0; p < petals; p++) {
    const a = p0 + (p * TAU) / petals;
    const dir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(fwd, Math.sin(a)).addScaledVector(n, 0.25 + rng() * 0.3).normalize();
    const base = at(Math.cos(a) * radius * 0.75, Math.sin(a) * radius * 0.75, radius * 0.25);
    foldedLeaf(m, base, dir, radius * (0.55 + rng() * 0.3), radius * 0.5, tone(floret(), rimShade), { curl: 0.25, tipColor: tone(vary(pal.purpleLight), rimShade) });
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

/**
 * Round 46 (survey-2 #05, checks 21 / 22: "clusters of identical spheres, no petals" at 1–5 m —
 * the round-43 floret ball's 1 cm bells fall under a pixel past 2 m, so every head read as the
 * one violet sphere, the high dome likewise). The head at every LOD but the far blob is an OPEN
 * BLOOM: PETAL_HEAD_PETALS obovate petals round a pale centre, each PETAL_HEAD_REACH × the head
 * radius long (the bloom spans ≈ 2.7 × the radius: from the walk's oblique view its violet covers
 * about what the sphere's silhouette did — W18 reads shot D's purple share), cupped
 * PETAL_HEAD_CUP toward the axis, each petal with its own length, heading and tone jitter, a deep
 * throat grading to a lit tip, the whole bloom tilted off its stem by up to PETAL_HEAD_TILT rad.
 * The heads' radius jitter widens (PETAL_HEAD_SIZE_JITTER) so no two blooms of a clump match.
 */
export const PETAL_HEAD_PETALS: readonly [number, number] = [5, 6];
export const PETAL_HEAD_REACH = 1.6;
export const PETAL_HEAD_CUP = 0.38;
export const PETAL_HEAD_TILT = 0.18;
export const PETAL_HEAD_SIZE_JITTER = 0.2;
/** each petal's own hue lean about its head's violet (the head's FLOWER_HUE_LEAN scale) */
export const PETAL_HUE_LEAN = 0.06;
/**
 * W18 (cap-1 of round 46: shot D's purple share fell 0.374 % → 0.160 %, the floor is 0.3 %): the
 * first petal ring was diamond laminae 0.58–0.74 × their length wide — half their box each, gaps
 * between them, and from D's oblique view (the bloom's disc foreshortened ≈ ½) the ring covered
 * about half of what the sphere's silhouette had. The metric counts violet at 256 × 144, where a
 * petal gap averaged with the turf drops the pixel out of the saturation band, so the bloom has to
 * be SOLID: obovate `petalCard`s (⅔ of their box) PETAL_WIDTH × their length wide overlap into a
 * rosette, and an inner whorl of PETAL_HEAD_INNER shorter petals rising PETAL_INNER_CUP toward the
 * axis fills the eye and gives the bloom a body from the side — a double violet, not a saucer.
 */
export const PETAL_WIDTH: readonly [number, number] = [0.9, 1.04];
export const PETAL_HEAD_INNER = 5;
export const PETAL_INNER_REACH = 0.7;
export const PETAL_INNER_CUP = 0.7;

/** the petal head's centre tones: a pale yellow eye over a darker ring where the petals meet */
function petalCentreTones(pal: PlantPalette): { eye: RGB; ring: RGB } {
  const eye = blend(pal.yellow, [0.95, 0.9, 0.6], 0.5);
  return { eye, ring: tone(blend(eye, pal.purpleDeep, 0.55), 0.8) };
}

/**
 * One open bloom (round 46, see PETAL_HEAD_*). `centre` the stem tip, `normal` its lean, `radius`
 * the head radius the sphere had; every draw is the head's own forked stream (`rng`) at every
 * detail, so the LOD switch keeps every petal where it was. `ultra` (inside FLOWER_ULTRA_M): 4 × 5
 * shapedLeaf petals in the petal band (fan veins, translucency — materials.ts) with a baked throat →
 * tip gradient, a petalCard inner whorl and a stamen boss; `high`: petalCard ring and whorl and a
 * 6-segment eye disc; `mid`: the same cards untwisted and a 4-segment disc. ≈ 190 / 46 / 44
 * triangles a head (PETAL_HEAD_PETALS + PETAL_HEAD_INNER cards).
 */
function petalHead(m: MeshBuilder, centre: Vector3, normal: Vector3, radius: number, rng: Rng, pal: PlantPalette, detail: Detail, vary: (c: RGB) => RGB) {
  const ultra = detail === 'ultra';
  const mid = detail === 'mid';
  const up = normal.clone().normalize();
  // the bloom tilts off its stem
  const tiltA = rng() * TAU;
  const tilt = rng() * PETAL_HEAD_TILT;
  const s0 = new Vector3().crossVectors(Math.abs(up.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), up).normalize();
  const f0 = new Vector3().crossVectors(up, s0).normalize();
  const axis = up.clone().addScaledVector(s0, Math.cos(tiltA) * tilt).addScaledVector(f0, Math.sin(tiltA) * tilt).normalize();
  const side = new Vector3().crossVectors(Math.abs(axis.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), axis).normalize();
  const fwd = new Vector3().crossVectors(axis, side).normalize();
  const petals = PETAL_HEAD_PETALS[0] + rng.int(0, PETAL_HEAD_PETALS[1] - PETAL_HEAD_PETALS[0] + 1);
  const p0 = rng() * TAU;
  const bells = violetBellTones(pal);
  const headTone = vary(blend(pal.purple, pal.purpleLight, rng() * 0.5));
  const throat = vary(bells.throat);
  const tip = vary(bells.tip);
  const cup = PETAL_HEAD_CUP * (0.85 + rng() * 0.3);
  const reach = radius * PETAL_HEAD_REACH;
  // the receptacle sits a hair under the stem tip (the petals ring the stamens, the boss stands on it):
  // this also keeps the bloom inside the dome's envelope — the layout contracts measure the high LOD's height
  const base = centre.clone().addScaledVector(axis, -radius * 0.18);
  // the outer ring, then the inner whorl (PETAL_HEAD_INNER shorter petals between the outer ones,
  // rising PETAL_INNER_CUP toward the axis) — one loop so both draw from the head's stream in order
  for (let p = 0; p < petals + PETAL_HEAD_INNER; p++) {
    const inner = p >= petals;
    const k = inner ? p - petals : p;
    const ring = inner ? PETAL_HEAD_INNER : petals;
    const pa = p0 + (k * TAU) / ring + (inner ? TAU / (2 * petals) : 0) + (rng() - 0.5) * 0.3;
    const rise = inner ? PETAL_INNER_CUP * (0.9 + rng() * 0.2) : cup * (0.85 + rng() * 0.3);
    const dir = side.clone().multiplyScalar(Math.cos(pa)).addScaledVector(fwd, Math.sin(pa)).addScaledVector(axis, rise).normalize();
    const len = reach * (inner ? PETAL_INNER_REACH : 1) * (0.85 + rng() * 0.3);
    const width = len * (PETAL_WIDTH[0] + rng() * (PETAL_WIDTH[1] - PETAL_WIDTH[0]));
    // a petal turned from the crown sits in the bloom's own shadow; each petal leans a little
    // magenta or blue of the head's violet (PETAL_HUE_LEAN — the hue jitter survey-2 asked for);
    // the inner whorl sits in the throat's shade
    const lean = PETAL_HUE_LEAN * (rng() * 2 - 1);
    const shade = (0.9 + rng() * 0.2) * undersideShade(0.5 * Math.max(0, -dir.y)) * (inner ? 0.9 : 1);
    const color: RGB = [headTone[0] * shade * (1 + lean), headTone[1] * shade * (1 - 0.25 * Math.abs(lean)), headTone[2] * shade * (1 - 0.5 * lean)];
    const root = base.clone().addScaledVector(dir, radius * (inner ? 0.06 : 0.1));
    // the ultra petal's curl / twist: drawn at every detail so the stream (and the next petal) stays put
    const petalCurl = 0.22 + rng() * 0.16;
    const petalTwist = (rng() - 0.5) * 0.3;
    if (ultra && !inner) {
      shapedLeaf(m, root, dir, len, width, color, {
        shape: 'petal',
        sections: 4,
        across: 5,
        curl: petalCurl,
        cup: 0.16,
        ridge: -0.04,
        twist: petalTwist,
        planeNormal: axis,
        uOffset: PETAL_U,
        // the throat's deep violet runs out to the lit tip along the petal, the midline a hair lighter
        colorAt: (t, s, row) => tone(blend(blend(throat, row, Math.min(1, t * 2.4)), tip, t * 0.45), s === 0 ? 1.03 : 1 - 0.04 * Math.abs(s)),
      });
    } else {
      // the high / mid petal (and the ultra's inner whorl) is a solid obovate card; no petal band
      // at high (it fades out by LEAF_DETAIL_FAR anyway), the ultra whorl in it like the ring round it
      // the card's curl is the ultra petal's damped: its tip lift is what the verge height contract
      // (plants.test, D's right verge ≤ 0.55 m) measures at the high LOD
      petalCard(m, root, dir, len, width, color, { sections: mid ? 3 : 4, curl: inner ? 0.16 : petalCurl * 0.4, ridge: 0.05, twist: mid ? 0 : petalTwist, planeNormal: axis, tipColor: inner ? blend(color, tip, 0.4) : tip, uOffset: ultra ? PETAL_U : 0 });
    }
  }
  // the eye: a stamen boss at arm's length, a small disc further out
  const { eye, ring } = petalCentreTones(pal);
  const eyeR = radius * 0.24;
  if (ultra) lathe(m, base.clone().addScaledVector(axis, -radius * 0.02), axis, (u) => ({ r: eyeR * Math.pow(Math.sin(Math.PI * (0.25 + 0.75 * u)), 0.6), y: radius * 0.22 * u }), 2, 6, eye, (u) => blend(ring, tone(eye, 1.05), Math.pow(u, 0.7)));
  else disc(m, base.clone().addScaledVector(axis, radius * 0.02), axis, eyeR, mid ? 4 : 6, tone(eye, 1.02), ring, radius * 0.05);
}

export function flowerGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  // round 43: `ultra` is the high LOD's layout — the same stems, leaves and head centres from the
  // same stream, so the switch at FLOWER_ULTRA_M does not pop — with 5-sided graded stems
  // round 46: every LOD but the far blob draws the head as an open bloom (petalHead) from the
  // head's own forked stream; the clump carries 5–8 heads (was 6–9: survey-2 #05, "fewer heads")
  const ultra = detail === 'ultra';
  const low = detail === 'low';
  const stems = low ? 5 : 5 + rng.int(0, 4);
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
    // round 44: the high / mid stems are a little thicker and graded foot → tip like the ultra's
    // (the far LOD keeps the thin flat stem: 3 px there either way)
    if (ultra) tube(m, sampleCurve(curve, 6), FLOWER_STEM_RADIUS[0], FLOWER_STEM_RADIUS[1], pal.stem, 5, false, stemColorAt(stemTones.foot, stemTones.tip));
    else if (low) tube(m, sampleCurve(curve, 2), 0.0026, 0.0014, pal.stem, 3);
    else tube(m, sampleCurve(curve, 3), FLOWER_STEM_RADIUS[0], FLOWER_STEM_RADIUS[1], pal.stem, 3, false, stemColorAt(stemTones.foot, stemTones.tip));
    if (!low) {
      for (let j = 0; j < 2; j++) {
        for (const sign of [-1, 1]) {
          const dir = V(Math.cos(angle + j * 1.3) * sign, 0.3, Math.sin(angle + j * 1.3) * sign);
          // round 46: the mid LOD's stem leaves are 2-triangle folds (its head cards cost what the
          // high's do; the 5 cm leaves are a pixel at 9 m) — the same draws, so the stream holds
          (detail === 'mid' ? foldedLeaf : curvedLeaf)(m, curve(0.22 + j * 0.3), dir, 0.05 + rng() * 0.035, 0.02, tone(leafColor, 0.9 + rng() * 0.25), { curl: 0.12, twist: sign * 0.15 });
        }
      }
    }
    // head: the far LOD's dense cluster blob (~6–8 cm across; round 44: FLOWER_HEAD_SCALE of round
    // 43's); round 46: an open bloom at every nearer LOD, its radius jittered PETAL_HEAD_SIZE_JITTER
    const up = lean.clone().normalize().add(V((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3)).normalize();
    // Petal tessellation must not advance the layout stream and move the next stem.
    // Retain the existing cheap low LOD; only high/mid need matching silhouettes.
    const headRadius = (0.034 + rng() * 0.016) * FLOWER_HEAD_SCALE;
    if (low) clusterHead(m, curve(1), up, headRadius, rng, pal, detail);
    else {
      // the head's own tone / hue lean (round 44), from a forked stream: the layout stream stays
      const headRng = rng.fork(`head-${i}`);
      const vary = headVariation(rng.fork(`tone-${i}`));
      petalHead(m, curve(1), up, headRadius * (1 + PETAL_HEAD_SIZE_JITTER * (headRng() * 2 - 1)), headRng, pal, detail, vary);
    }
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
    // round 44: thicker graded stems at high / mid (see flowerGeometry), the far LOD's stay
    if (ultra) tube(m, sampleCurve(curve, 6), FLOWER_STEM_RADIUS[0], FLOWER_STEM_RADIUS[1], pal.stem, 5, false, stemColorAt(stemTones.foot, stemTones.tip));
    else if (low) tube(m, sampleCurve(curve, 2), 0.0026, 0.0014, pal.stem, 3);
    else tube(m, sampleCurve(curve, 3), FLOWER_STEM_RADIUS[0], FLOWER_STEM_RADIUS[1], pal.stem, 3, false, stemColorAt(stemTones.foot, stemTones.tip));
    if (!low) {
      for (const sign of [-1, 1]) {
        const dir = V(Math.cos(angle + 0.9) * sign, 0.35, Math.sin(angle + 0.9) * sign);
        curvedLeaf(m, curve(0.18), dir, 0.07 + rng() * 0.04, 0.022, tone(leafColor, 0.9 + rng() * 0.25), { curl: 0.15, twist: sign * 0.2 });
      }
    }
    // the spike's own tone / hue lean (round 44), from a forked stream: the layout stream stays
    const vary = low ? (c: RGB) => c : headVariation(rng.fork(`tone-${i}`));
    const spikeTones = { throat: vary(bellTones.throat), lobe: vary(bellTones.lobe), tip: vary(bellTones.tip) };
    const bells = low ? 5 : 7 + rng.int(0, 4);
    const bellR = 0.022 + rng() * 0.008;
    for (let b = 0; b < bells; b++) {
      const t = 0.45 + (b / (bells - 1)) * 0.55;
      const c = curve(t);
      const a0 = rng() * TAU;
      const petals = low ? 3 : 4;
      const scale = 1 - 0.35 * Math.max(0, (t - 0.85) / 0.15);
      // the lowest bells hang under the column in its own shadow, the top ones are lit (round 44)
      const shade = undersideShade(1 - Math.pow(b / (bells - 1), 0.7));
      // the high LOD's petal draws (heading, colour) are taken in the same order at every detail so
      // the layout stream never shifts; the ultra bell hangs from the first petal's heading
      const hangs: Vector3[] = [];
      for (let p = 0; p < petals; p++) {
        const a = a0 + (p * TAU) / petals;
        const dir = V(Math.cos(a), -0.35 + rng() * 0.3, Math.sin(a)).normalize();
        const color = tone(vary(blend(blend(pal.purple, pal.purpleLight, 0.2 + rng() * 0.5), pal.purpleDeep, rng() * 0.3)), shade);
        if (fine) {
          hangs.push(dir);
          continue;
        }
        // Mid-distance bells keep every floret but use a folded lamina instead of four triangles.
        if (low || detail === 'mid') foldedLeaf(m, c, dir, bellR * (low ? 1.6 : 1.7) * scale, bellR * 1.6 * scale, color, { curl: 0.2 });
        else curvedLeaf(m, c, dir, bellR * 1.7 * scale, bellR * 1.6 * scale, color, { curl: 0.3, ridge: -0.1, tipColor: tone(vary(pal.purpleLight), shade) });
      }
      if (fine) {
        // two bells a station, hanging off opposite sides of the stem like the high LOD's four
        // petals did, each a throat tube with 5–6 lobes and its mouth turned a little downward
        const tones = shade < 1 ? { throat: spikeTones.throat, lobe: tone(spikeTones.lobe, shade), tip: tone(spikeTones.tip, shade) } : spikeTones;
        for (const k of [0, 2]) {
          const hang = hangs[k].clone().add(V(0, -0.25, 0)).normalize();
          const r = bellR * 0.95 * scale * (0.9 + fine() * 0.2);
          bell(m, c.clone().addScaledVector(hang, bellR * 1.05 * scale), hang, r, 5 + fine.int(0, 2), fine, tones);
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
      lathe(m, curve(1).addScaledVector(tip, -budR * 0.35), tip, (u) => ({ r: budR * Math.pow(Math.sin(u * Math.PI), 0.7) * (1 - 0.35 * u), y: budR * 2.05 * u }), 4, 5, spikeTones.throat, (u) => blend(spikeTones.throat, tone(spikeTones.lobe, 0.9), u * 0.6));
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

/** 2026-09-24 — the coil's out-of-plane travel as a share of its ring radius: a progressive helix and a mid swell */
const COIL_HELIX = 0.34;
const COIL_SWELL = 0.16;

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
    // 2026-09-24: the coil was wound in one plane, its only out-of-plane travel a fixed 4 mm swell
    // — against a 26–40 mm ring radius that is a disc, and the shot-D stalks (twice the height,
    // so twice the ring, at 1.25 × the width) turned it into a washer at the 4 m the owner walks
    // past them. A crozier is a flattened HELIX: it uncoils out of its own plane as it tightens.
    // The offset is now proportional to the ring, so it reads as a coil at any scale and from any
    // angle, and the small buds — 0.26 m tall, a few pixels — are unchanged in projection.
    const out = V(-radial.z, 0, radial.x);
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const ang = u * turns * TAU;
      const r = R * (1 - 0.55 * u);
      coil.push(
        centre
          .clone()
          .addScaledVector(radial, Math.cos(ang) * r)
          .add(V(0, Math.sin(ang) * r, 0))
          .addScaledVector(out, R * (COIL_HELIX * u + COIL_SWELL * Math.sin(u * Math.PI))),
      );
    }
    // a rope-thick spiral (sheet 01: fat fuzzy coils), tapering toward the tip
    tube(m, coil, 0.0085, 0.0032, coilColor, ultra ? 8 : high ? 6 : 3, true);
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
export const MOSS_TOP_GAIN = 1.4;
export const MOSS_TOP_TINT: RGB = [1.0, 1.04, 0.86];
/** sub-cushions a lobed ultra cushion carries beside its crown lobe (min, max inclusive), and the body outline's noise amplitude (fraction of the radius) */
export const MOSS_ULTRA_LOBES: readonly [number, number] = [13, 18];
export const MOSS_ULTRA_RUFFLE = 0.2;
/**
 * the mid cushion (round 44, inside MOSS_MID_M): every `MOSS_MID_LOBE_STEP`-th lobe of the ultra
 * spiral (the same stream, so the switch at MOSS_ULTRA_M keeps every lobe where it was), grown
 * `MOSS_MID_LOBE_GROW` to close the gaps, at 5 sides × 2 rings on an 8 × 3 body — ≈ 290 triangles
 * against the ultra's ≈ 1 100 and the dome's 45 (camera D frames ≈ 125 cushions inside the ring)
 */
export const MOSS_MID_LOBE_STEP = 2;
export const MOSS_MID_LOBE_GROW = 1.28;
/**
 * Round 46 (survey-2 check 28 / #18: "smooth sphere clusters" — every lobe was a round cap of the
 * one proportion): a lobe stretches along its own tangent heading by up to MOSS_LOBE_STRETCH of
 * its radius (an ellipse, not a ball), its height runs MOSS_LOBE_HEIGHT × the radius (flat pads
 * beside tall knobs), its outline ruffles MOSS_LOBE_RUFFLE; and MOSS_BLADES[0..1] short grass
 * blades stand through the ultra cushion from its body — the rise over the crown ≤ MOSS_BLADE_RISE
 * × the cushion height, laid after the envelope fit so the body keeps the dome's height exactly.
 */
export const MOSS_LOBE_STRETCH = 0.75;
export const MOSS_LOBE_HEIGHT: readonly [number, number] = [0.45, 1.25];
export const MOSS_LOBE_RUFFLE = 0.34;
export const MOSS_BLADES: readonly [number, number] = [4, 8];
export const MOSS_BLADE_RISE = 0.55;
/**
 * The velvet (round 46, survey-2 check 28 after the first pass: the lobes were irregular but still
 * read as smooth pale caps at 2.5 m). Every ultra lobe — and the crown — carries MOSS_FUZZ_PER_LOBE
 * one-triangle hairs standing off its surface along the surface normal, MOSS_FUZZ_LENGTH × the
 * lobe's radius long (≈ 1–2 cm at the placed scales: 5–10 px at 2.5 m, a pixel wide), their tips
 * lit MOSS_FUZZ_TIP over the lobe's tone; laid before the envelope fit, so the cushion keeps the
 * dome's height with its hairs on. From the cushion's own forked stream (`/fuzz`): the lobe draws
 * the mid tier shares are untouched.
 */
export const MOSS_FUZZ_PER_LOBE = 14;
export const MOSS_FUZZ_LENGTH: readonly [number, number] = [0.35, 0.7];
export const MOSS_FUZZ_TIP = 1.08;

export function mossGeometry(seed: string, pal: PlantPalette, detail: Detail = 'high'): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const jitterTable = Array.from({ length: 512 }, () => rng());
  const height = 0.38 + rng() * 0.12;
  const deep = tone(pal.mossDeep, 0.85);
  const bright = tone(pal.mossBright, 0.9);
  const mid = blend(deep, bright, 0.5);
  const colorAt = (t: number, lit: number, lump: number): RGB => {
    // t: the vertex's height fraction over the whole cushion (0 rim … 1 crown), lit: its lobe's own
    // crest fraction; the gain runs from the dark damp rim to the lit crown, the lobes' crests catch
    // light on top of that, their hollows sink toward the rim tone (mid is the high dome's mean)
    const up = Math.pow(t, 0.8) * (0.55 + 0.45 * lit);
    const gain = (MOSS_RIM_GAIN + (MOSS_TOP_GAIN - MOSS_RIM_GAIN) * up) * (1 + 0.1 * lump);
    const c = blend(blend(deep, bright, Math.min(1, up + 0.2 * lump)), mid, 0.3);
    return [c[0] * gain * (1 + (MOSS_TOP_TINT[0] - 1) * up), c[1] * gain * (1 + (MOSS_TOP_TINT[1] - 1) * up), c[2] * gain * (1 + (MOSS_TOP_TINT[2] - 1) * up)];
  };
  if (detail === 'low' || detail === 'mid') {
    // the far dome (past MOSS_MID_M): the round-9 shape — the same jitter table, so its envelope is
    // the one every scale was chosen against — recoloured down its height like the lobed tiers
    // (round 44: the dome's own top-heavy blend read as a pale ball beside a dark-rimmed cluster)
    dome(m, 1, height, 9, 3, deep, bright, (i) => jitterTable[Math.abs(i) % 512]);
    for (let k = 0; k < m.p.length; k += 3) {
      const t = clamp01(m.p[k + 1] / height);
      const c = colorAt(t, t, 0.5 * (jitterTable[(k / 3) % 512] - 0.5));
      m.c[k] = c[0];
      m.c[k + 1] = c[1];
      m.c[k + 2] = c[2];
    }
    return m.finish();
  }
  // round 43: the ultra cushion is a CLUSTER — a squat lobed body carrying MOSS_ULTRA_LOBES
  // sub-cushions (the structures' roof tufts' recipe: fuller-than-spherical profile, value-noise
  // outline, lit top / dark rim in the vertex colour — implemented here, nothing imported): a
  // single dome with surface noise reads smooth at 0.8 m (vegetation-22's first pass), the lobes
  // — 3–7 cm across at the placed scales, no two cushions alike — do not. The envelope stays the
  // high dome's (its height exactly, its footprint or less) so the same instance scale seats it.
  // round 44: `high` (MOSS_ULTRA_M … MOSS_MID_M) is the same cluster from the same stream at a
  // third of the triangles — coarser body and crown, every MOSS_MID_LOBE_STEP-th lobe, grown
  const ultra = detail === 'ultra';
  const fine = createRng(`${seed}/ultra`);
  const off = fine() * 100;
  /** the fuller-than-spherical meridian (t: 0 base ring … 1 crown) */
  const profile = (t: number) => ({ r: Math.pow(Math.cos((t * Math.PI) / 2), 0.72), y: Math.pow(Math.sin((t * Math.PI) / 2), 0.85) });
  const bodyH = height * 0.74;
  /**
   * one cushion: centre `c`, up axis `n`, footprint radius `radius`, crown height `h` over the base
   * ring; the outline ruffles by value noise at `freq`, the base ring sinks `sink` under the seat
   * (hides the seam on the body); `tOf(y)` gives a vertex's whole-cushion height fraction
   */
  const cushion = (c: Vector3, n: Vector3, radius: number, h: number, segments: number, rings: number, ruffle: number, freq: number, sink: number, seedOff: number, toneMul = 1, stretch: { a: number; k: number } | null = null) => {
    const up = n.clone().normalize();
    const ref = Math.abs(up.y) > 0.92 ? V(1, 0, 0) : V(0, 1, 0);
    const a = new Vector3().crossVectors(ref, up).normalize();
    const b = new Vector3().crossVectors(up, a).normalize();
    const levels: number[][] = [];
    for (let r = 0; r <= rings; r++) {
      const t = r / (rings + 1);
      const { r: pr, y: py } = profile(t);
      const level: number[] = [];
      for (let k = 0; k < segments; k++) {
        const ang = (k * TAU) / segments + (r % 2) * (Math.PI / segments);
        const cx = Math.cos(ang);
        const sz = Math.sin(ang);
        // the outline's lobes (freq) and a finer surface grain a third as strong at three times the frequency
        const nz = valueNoise3(cx * freq + seedOff, t * freq * 0.8 + off, sz * freq - seedOff) + 0.35 * valueNoise3(cx * freq * 3 - seedOff, t * freq * 2.4 + off * 0.3, sz * freq * 3 + seedOff);
        // round 46: a stretched lobe — an ellipse about its own heading, not a round cap
        const ell = stretch ? 1 + stretch.k * Math.cos(ang - stretch.a) ** 2 : 1;
        const rr = radius * pr * (1 + ruffle * nz) * ell;
        const yy = r === 0 ? -sink : h * py * (1 + 0.12 * ruffle * nz) - sink * (1 - t);
        const p = c.clone().addScaledVector(a, cx * rr).addScaledVector(b, sz * rr).addScaledVector(up, yy);
        const gt = clamp01(p.y / height);
        level.push(m.vertex(p, NOT_LAMINA + k / segments, gt, tone(colorAt(gt, t, nz), toneMul)));
      }
      levels.push(level);
    }
    const crownP = c.clone().addScaledVector(up, h);
    const crown = m.vertex(crownP, NOT_LAMINA + 0.5, clamp01(crownP.y / height), tone(colorAt(clamp01(crownP.y / height), 1, 0.4), toneMul));
    for (let r = 0; r < rings; r++) {
      for (let k = 0; k < segments; k++) {
        const nk = (k + 1) % segments;
        m.tri(levels[r][k], levels[r][nk], levels[r + 1][k]);
        m.tri(levels[r][nk], levels[r + 1][nk], levels[r + 1][k]);
      }
    }
    for (let k = 0; k < segments; k++) m.tri(levels[rings][k], levels[rings][(k + 1) % segments], crown);
  };
  // the body: the high dome's footprint, three quarters of its height, a strongly lobed outline
  cushion(V(0, 0, 0), V(0, 1, 0), 1, bodyH, ultra ? 14 : 8, ultra ? 4 : 3, MOSS_ULTRA_RUFFLE, 1.7, 0, 0);
  // the lobes stand on the body's surface: azimuth and meridian fraction by the stream, the
  // surface normal from the profile's slope; a crown lobe takes the cushion to its full height
  const lobes = fine.int(MOSS_ULTRA_LOBES[0], MOSS_ULTRA_LOBES[1] + 1);
  const bodyPoint = (u: number, ang: number) => {
    const { r, y } = profile(u);
    const e = 1e-3;
    const p1 = profile(u + e);
    // the meridian tangent (dr, dy) → outward normal (dy, -dr), rotated into the azimuth
    const dr = (p1.r - r) / e;
    const dy = (p1.y * bodyH - y * bodyH) / e;
    const nr = dy;
    const ny = -dr;
    const nl = Math.hypot(nr, ny) || 1;
    return { p: V(Math.cos(ang) * r, y * bodyH, Math.sin(ang) * r), n: V((Math.cos(ang) * nr) / nl, ny / nl, (Math.sin(ang) * nr) / nl) };
  };
  const leanA = fine() * TAU;
  const lean = 0.1 * fine();
  const crownR = 0.42 + 0.1 * fine();
  const crownC = V(Math.cos(leanA) * lean, bodyH * 0.9, Math.sin(leanA) * lean);
  cushion(crownC, V(0, 1, 0), crownR, height - bodyH * 0.9, ultra ? 9 : 6, ultra ? 3 : 2, 0.16, 3.2, 0.05, 11);
  /** the ultra lobes (and the crown) for the velvet pass — MOSS_FUZZ_* */
  const pads: { c: Vector3; n: Vector3; r: number; h: number; stretch: { a: number; k: number } | null; toneMul: number }[] = [{ c: crownC, n: V(0, 1, 0), r: crownR, h: height - bodyH * 0.9, stretch: null, toneMul: 1 }];
  for (let i = 0; i < lobes; i++) {
    // a golden-angle spiral spreads the lobes round the body, the meridian fraction runs rim → shoulder;
    // 4–8 cm across at the placed scales (the structures' roof tufts' 4–12 cm), rounder than the body
    const ang = i * 2.399963 + fine() * 0.5;
    const u = 0.1 + 0.68 * ((i + 0.5) / lobes) + (fine() - 0.5) * 0.14;
    const { p, n } = bodyPoint(u, ang);
    const rl = 0.13 + 0.13 * fine();
    // round 46: flat pads beside tall knobs (was 0.7–1.15 × the radius), each lobe stretched
    // along its own heading (MOSS_LOBE_*) — no two lobes the one round cap
    const hl = rl * (MOSS_LOBE_HEIGHT[0] + (MOSS_LOBE_HEIGHT[1] - MOSS_LOBE_HEIGHT[0]) * fine());
    const stretch = { a: fine() * TAU, k: MOSS_LOBE_STRETCH * fine() };
    // ± 10 % tone a lobe (the structures' tufts' toneSpread): no two lobes the same green
    const toneMul = 0.9 + 0.2 * fine();
    // every draw above is taken at both tiers (the stream stays the ultra's); the mid tier builds
    // every MOSS_MID_LOBE_STEP-th lobe, grown to stand in for the ones between
    if (ultra) {
      cushion(p, n, rl, hl, 8, 3, MOSS_LOBE_RUFFLE, 6, rl * 0.15, 20 + i * 7, toneMul, stretch);
      pads.push({ c: p, n, r: rl, h: hl, stretch, toneMul });
    } else if (i % MOSS_MID_LOBE_STEP === 0) cushion(p, n, rl * MOSS_MID_LOBE_GROW, hl * MOSS_MID_LOBE_GROW, 5, 2, MOSS_LOBE_RUFFLE, 6, rl * 0.15, 20 + i * 7, toneMul, stretch);
  }
  // seat the base ring on y = 0 and hold the high dome's envelope: its height exactly (the lobes
  // that rise past it are pulled down with the whole), its footprint or less
  let maxY = 0;
  let maxR = 0;
  for (let k = 0; k < m.p.length; k += 3) {
    maxY = Math.max(maxY, m.p[k + 1]);
    maxR = Math.max(maxR, Math.abs(m.p[k]), Math.abs(m.p[k + 2]));
  }
  const scratch = new MeshBuilder();
  dome(scratch, 1, height, 9, 3, deep, bright, (i) => jitterTable[Math.abs(i) % 512]);
  let highSpan = 0;
  for (let k = 0; k < scratch.p.length; k += 3) highSpan = Math.max(highSpan, Math.abs(scratch.p[k]), Math.abs(scratch.p[k + 2]));
  const sy = height / maxY;
  const sxz = Math.min(1, highSpan / maxR);
  for (let k = 0; k < m.p.length; k += 3) {
    m.p[k] *= sxz;
    m.p[k + 1] = Math.max(0, m.p[k + 1]) * sy;
    m.p[k + 2] *= sxz;
  }
  // round 46: a few grass blades stand through the ultra cushion (survey-2 check 28: a cushion
  // with nothing growing through it is a ball). From the body's shoulder, leaning outward, their
  // tips MOSS_BLADE_RISE × the height over the crown at most; laid after the envelope fit so the
  // body itself keeps the dome's height (the blades alone stand above it). From the `fine` stream
  // after every lobe draw, so the lobes stay where the mid tier puts them.
  if (ultra) {
    const blades = MOSS_BLADES[0] + fine.int(0, MOSS_BLADES[1] - MOSS_BLADES[0] + 1);
    const bladeColor = blend(pal.grassLight, pal.mossBright, 0.35);
    const bladeTip = tone(blend(bladeColor, pal.straw, 0.3), 1.08);
    for (let i = 0; i < blades; i++) {
      const ang = fine() * TAU;
      const u = 0.25 + 0.55 * fine();
      const { p, n } = bodyPoint(u, ang);
      const foot = V(p.x * sxz, Math.max(0, p.y) * sy - 0.02, p.z * sxz);
      // outward and up, bowing over toward the tip; the tip's height is the one bound
      const out = V(n.x, 0, n.z).normalize();
      const dir = out.clone().multiplyScalar(0.35 + 0.5 * fine()).setY(1).normalize();
      const tipY = height * (1 + MOSS_BLADE_RISE * (0.3 + 0.7 * fine()));
      const len = (tipY - foot.y) / dir.y;
      const bow = out.clone().multiplyScalar(0.3 * len);
      const pts = [foot, foot.clone().addScaledVector(dir, len * 0.55), foot.clone().addScaledVector(dir, len).add(bow).setY(tipY - 0.08 * len)];
      const facing = V(-dir.z, 0, dir.x);
      bladeStrip(m, pts, 0.025 + 0.015 * fine(), facing, tone(bladeColor, 0.9 + 0.2 * fine()), bladeTip, 0.3);
    }
    // the velvet (MOSS_FUZZ_*): one-triangle hairs off every pad's upper half along its surface
    // normal, in the fitted frame like the blades; from the cushion's own forked stream
    const fuzz = createRng(`${seed}/fuzz`);
    for (const pad of pads) {
      const up = pad.n.clone().normalize();
      const ref = Math.abs(up.y) > 0.92 ? V(1, 0, 0) : V(0, 1, 0);
      const a = new Vector3().crossVectors(ref, up).normalize();
      const b = new Vector3().crossVectors(up, a).normalize();
      for (let k = 0; k < MOSS_FUZZ_PER_LOBE; k++) {
        const ang = fuzz() * TAU;
        const t = 0.45 + 0.5 * fuzz();
        const { r: pr, y: py } = profile(t);
        const ell = pad.stretch ? 1 + pad.stretch.k * Math.cos(ang - pad.stretch.a) ** 2 : 1;
        const radial = a.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
        // the foot a hair under the ruffled skin; the surface normal from the meridian slope
        const foot = pad.c.clone().addScaledVector(radial, pad.r * pr * ell * 0.96).addScaledVector(up, pad.h * py * 0.96);
        const p1 = profile(t + 1e-3);
        const dr = ((p1.r - pr) / 1e-3) * pad.r;
        const dy = ((p1.y - py) / 1e-3) * pad.h;
        const nl = Math.hypot(dy, dr) || 1;
        const dir = radial.clone().multiplyScalar(dy / nl).addScaledVector(up, -dr / nl).addScaledVector(a, (fuzz() - 0.5) * 0.6).addScaledVector(b, (fuzz() - 0.5) * 0.6).normalize();
        // a lobe's radius scales the hair (the crown is twice a lobe: its hairs are a lobe's)
        const hr = Math.min(pad.r, 0.22);
        const len = hr * (MOSS_FUZZ_LENGTH[0] + (MOSS_FUZZ_LENGTH[1] - MOSS_FUZZ_LENGTH[0]) * fuzz());
        const w = hr * (0.07 + 0.06 * fuzz());
        let side = new Vector3().crossVectors(dir, V(0, 1, 0));
        if (side.lengthSq() < 1e-6) side = a.clone();
        side.normalize();
        const fit = (p: Vector3) => V(p.x * sxz, Math.max(0, p.y) * sy, p.z * sxz);
        const f = fit(foot);
        const tipP = fit(foot.clone().addScaledVector(dir, len));
        // a rim lobe's hair leans out: its tip stays inside the high dome's footprint (the envelope contract)
        const tipR = Math.hypot(tipP.x, tipP.z);
        if (tipR > highSpan) {
          const fR = Math.hypot(f.x, f.z);
          const k = fR < highSpan ? (highSpan - fR) / (tipR - fR) : 0;
          tipP.x = f.x + (tipP.x - f.x) * k;
          tipP.z = f.z + (tipP.z - f.z) * k;
        }
        const gt = clamp01(f.y / height);
        // the root in the pile's shade, the tip at the lobe's lit tone × MOSS_FUZZ_TIP: the ultra's mean
        // luminance stays the far dome's (the no-pop contract at MOSS_MID_M)
        const base = tone(colorAt(gt, t, 0), pad.toneMul * 0.7);
        const tip = tone(colorAt(gt, 1, 0.4), pad.toneMul * MOSS_FUZZ_TIP);
        const v0 = m.vertex(f.clone().addScaledVector(side, -w / 2), NOT_LAMINA + 0.5, gt, base);
        const v1 = m.vertex(f.clone().addScaledVector(side, w / 2), NOT_LAMINA + 0.5, gt, base);
        const v2 = m.vertex(tipP, NOT_LAMINA + 0.5, clamp01(tipP.y / height), tip);
        m.tri(v0, v1, v2);
      }
    }
  }
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

/**
 * The mirror image of a geometry across x = 0 (round 44): positions and normals flipped in x,
 * every triangle's winding reversed so its faces still front the same way — a per-instance
 * negative scale would invert the double-sided shading instead. The uv / colour attributes are
 * shared, the bounds recomputed.
 */
export function mirrorX(g: BufferGeometry): BufferGeometry {
  const out = g.clone();
  const p = out.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
  p.needsUpdate = true;
  const n = out.getAttribute('normal');
  if (n) {
    for (let i = 0; i < n.count; i++) n.setX(i, -n.getX(i));
    n.needsUpdate = true;
  }
  const idx = out.getIndex();
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  }
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/**
 * `rows` interleaved with their mirror images — [v0, v0 mirrored, v1, v1 mirrored, …] — so a set
 * that draws `rng.int(0, variantCount)` keeps every instance's base variant (⌊k / 2⌋ of the doubled
 * index is ⌊u × n⌋ of the old) and flips half of them (round 44: the bush repetition)
 */
export function withMirrors(rows: BufferGeometry[][]): BufferGeometry[][] {
  const out: BufferGeometry[][] = [];
  for (const row of rows) out.push(row, row.map(mirrorX));
  return out;
}

export function maxHeight(geos: BufferGeometry[][]): number {
  let h = 0;
  for (const row of geos) for (const g of row) h = Math.max(h, g.boundingBox?.max.y ?? 1);
  return h;
}

export type { Rng };
