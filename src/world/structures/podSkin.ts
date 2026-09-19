/**
 * Round 43 (structures-27): the pod lanterns' SKIN as pure, deterministic fields — the owner's
 * board 05 "Hanging Lanterns" pod is a plant pod with a segmented husk, a veined skin and a warm
 * glowing core, and at 1–3 m ours read as a smooth lathe with a vertical gradient. The fields
 * here are rasterised by materials.ts into the pods' albedo / normal / emissive maps (one shared
 * atlas for every pod); lantern.ts maps the geometry into the same layout, so the husk's ribs in
 * the mesh and the seams in the maps coincide. Kept free of canvas / three so `node --test` can
 * check the layout (podSkin.test.mjs).
 *
 * Atlas layout (v up):
 *   - `[0, POD_BODY_V)`          the lit husk: `POD_TEX_SEGMENTS` segments across u, each with a
 *                                 seam groove at its edges, a midrib and slanted side veins; a pod
 *                                 with n ribs maps its circumference to u ∈ [0, n / 6] (the texture
 *                                 repeats, so any n lands on a seam at the wrap);
 *   - `POD_CAP_BAND`              the calyx, sepals, stem and leaf collar: one small leaf per
 *                                 1/6 tile (midrib at the tile's centre, side veins), leathery;
 *   - `POD_CORD_BAND`             the cord: fibre lines round it.
 *   The emissive map is black from LANTERN_DARK_V up (materials.ts), so only the body glows.
 */
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';

/** husk segments across one texture width */
export const POD_TEX_SEGMENTS = 6;
/** the body's top row in the atlas (= materials.ts LANTERN_DARK_V − 0.06, the lathe's old remap) */
export const POD_BODY_V = 0.8;
/** the calyx / sepal / stem / collar band and its centre row */
export const POD_CAP_BAND: [number, number] = [0.855, 0.925];
export const POD_CAP_V = 0.89;
/** the cord band and its centre row */
export const POD_CORD_BAND: [number, number] = [0.93, 1.0];
export const POD_CORD_V = 0.965;

export interface PodBodySample {
  /** 1 on a segment seam (the rib groove between two husk segments) */
  seam: number;
  /** 0..1: the midrib and side veins */
  vein: number;
  /** relief, ≈ −1..1 (grooves negative, the bulge of a segment positive) */
  height: number;
  /** how much of the glowing core comes through the husk here, 0..1 (before the vertical envelope) */
  glow: number;
}

/** position across a segment: f ∈ [0, 1) from seam to seam, g ∈ [0, 1] from the midrib to the seam */
function across(u: number): { f: number; g: number; seg: number } {
  const seg = u * POD_TEX_SEGMENTS;
  const segI = Math.floor(seg);
  const f = seg - segI;
  return { f, g: Math.abs(f - 0.5) * 2, seg: segI };
}

/**
 * The husk body at atlas (u, v), v < POD_BODY_V. The segments narrow to the tip and to the calyx,
 * so the seam groove widens there; the veins are a midrib down each segment with side veins
 * leaving it at a slant toward the seams, rising toward the calyx; the transmission is highest
 * mid-segment (the husk is thinnest there), lowest on the ribs, with a hotter core low in the body.
 */
export function podBodyField(noise: Noise2D, u: number, v: number, out: PodBodySample = { seam: 0, vein: 0, height: 0, glow: 0 }): PodBodySample {
  const { f, g, seg } = across(u);
  const vb = clamp(v / POD_BODY_V, 0, 1);
  const taper = 1 + 1.6 * Math.pow(1 - vb, 3) + 0.7 * Math.pow(vb, 4);
  const seamW = 0.045 * taper;
  const ds = Math.min(f, 1 - f);
  const seam = Math.exp(-(ds * ds) / (seamW * seamW));
  // midrib: a fine ridge down the segment's centre, fading at the tip
  const midrib = Math.exp(-((f - 0.5) * (f - 0.5)) / (0.016 * 0.016)) * smoothstep(0, 0.12, vb) * smoothstep(1, 0.9, vb);
  // side veins: every ≈ 0.062 of the body, rising toward the seam at slope `slant`, wavering a little
  const slant = 0.3;
  const pitch = 0.062;
  const offset = 0.5 * noise.noise(seg * 3.1 + 0.5, 7.3);
  const waver = 0.006 * noise.noise(u * 21 + 3, v * 21);
  const t = (vb - slant * g * g + offset * pitch + waver) / pitch;
  const tf = t - Math.floor(t);
  const dv = Math.min(tf, 1 - tf) * pitch;
  const side = Math.exp(-(dv * dv) / (0.0055 * 0.0055)) * smoothstep(0.05, 0.16, g) * smoothstep(0.92, 0.7, g) * smoothstep(0.06, 0.2, vb) * smoothstep(1, 0.92, vb) * 0.7;
  // fine reticulation between the veins (a leaf's net), faint
  const net = smoothstep(0.62, 0.8, noise.ridged(u * 46 + 2, v * 46, 2)) * 0.22 * (1 - seam);
  const vein = clamp(Math.max(midrib, side) + net, 0, 1);
  // mottled grain of the skin
  const grain = 0.08 * noise.noise(u * 60 + 11, v * 60 + 5);
  const height = -seam * 1.0 - vein * 0.35 + 0.18 * (1 - g * g) * (1 - seam) + grain;
  const thin = 1 - 0.55 * g * g;
  const core = Math.exp(-((vb - 0.42) * (vb - 0.42)) / (0.22 * 0.22)) * (1 - g * g);
  const glow = clamp((0.36 + 0.64 * thin) * (1 - 0.78 * seam) * (1 - 0.32 * vein) + 0.3 * core * (1 - seam), 0, 1.3);
  out.seam = seam;
  out.vein = vein;
  out.height = height;
  out.glow = glow;
  return out;
}

/**
 * The vertical envelope of the glow, 0..1 over the body (vb = 0 tip … 1 calyx): hottest low in
 * the body where the core sits, still lit at the tip, dimming under the calyx.
 */
export function podGlowEnvelope(vb: number): number {
  return 0.4 + 0.6 * Math.exp(-((vb - 0.4) * (vb - 0.4)) / (0.3 * 0.3));
}

export interface PodBandSample {
  /** relief, ≈ −1..1 */
  height: number;
  /** albedo shade, ≈ 0.75..1.05 (the vertex tint carries the colour) */
  shade: number;
}

/** The calyx / sepal / collar band: one leathery leaf per tile — a midrib ridge, side-vein grooves, mottle. */
export function podCapField(noise: Noise2D, u: number, v: number, out: PodBandSample = { height: 0, shade: 1 }): PodBandSample {
  const { f, g } = across(u);
  const [b0, b1] = POD_CAP_BAND;
  const t = clamp((v - b0) / (b1 - b0), 0, 1);
  const midrib = Math.exp(-((f - 0.5) * (f - 0.5)) / (0.03 * 0.03));
  const pitch = 0.2;
  const k = (t - 0.35 * g) / pitch;
  const kf = k - Math.floor(k);
  const dv = Math.min(kf, 1 - kf) * pitch;
  const side = Math.exp(-(dv * dv) / (0.02 * 0.02)) * smoothstep(0.08, 0.2, g) * smoothstep(0.95, 0.75, g);
  const mottle = noise.noise(u * 40 + 17, v * 120 + 3);
  const edge = smoothstep(0.7, 1, g);
  const height = midrib * 0.5 - side * 0.3 + 0.12 * mottle - 0.3 * edge;
  const shade = 0.98 + 0.05 * midrib - 0.08 * side + 0.06 * mottle - 0.1 * edge;
  out.height = height;
  out.shade = shade;
  return out;
}

/** The cord band: fine fibre lines round the cord (12 a turn), a laid twist in their phase, a little fray. */
export function podCordField(noise: Noise2D, u: number, v: number, out: PodBandSample = { height: 0, shade: 1 }): PodBandSample {
  const [b0, b1] = POD_CORD_BAND;
  const t = clamp((v - b0) / (b1 - b0), 0, 1);
  const stripe = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 12 + t * 6);
  const fibre = noise.ridged(u * 36 + 5, t * 3 + 2, 2);
  const fray = 0.06 * noise.noise(u * 80, v * 400 + 9);
  const height = (stripe - 0.5) * 0.5 + (fibre - 0.5) * 0.3 + fray;
  const shade = 0.86 + 0.16 * stripe * lerp(0.7, 1, fibre) + fray;
  out.height = height;
  out.shade = shade;
  return out;
}

/** the atlas u for angle `phi` (rad) round a pod with `ribs` segments, seams at phi = k · 2π / ribs */
export function podU(phi: number, ribs: number): number {
  return (phi / (Math.PI * 2)) * (ribs / POD_TEX_SEGMENTS);
}

/**
 * The albedo maps' mean (linear) in every band: the maps only MODULATE the vertex tints, so the
 * tints in lantern.ts are divided by this and a pod's far (mip-averaged) colour is exactly its
 * round-21 tint — the far look and the bloom footprint hold.
 */
export const POD_MAP_MEAN = 0.82;
/** the emissive modulation's ceiling over its mean (the map is 8-bit: the old gradient's bottom row peaked at 1.0) */
export const POD_GLOW_CEIL = 1.15;
/** slope gain of the normal map (height units → tangent slope per texel) */
const NORMAL_GAIN = 2.4;

export interface PodSkinRaster {
  width: number;
  height: number;
  /** linear rgb per texel, every band normalised to mean POD_MAP_MEAN */
  albedo: Float32Array;
  /** tangent-space normal per texel, xyz in −1..1 */
  normal: Float32Array;
  /** the body's glow modulation (mean 1 over the body rows, ≤ POD_GLOW_CEIL), 0 in the dark bands */
  glow: Float32Array;
}

/**
 * Rasterise the fields into the atlas (canvas-free — materials.ts turns the arrays into textures,
 * podSkin.test.mjs checks the means). Rows run top-down like a canvas (row 0 = v 1); u wraps
 * (the pods' circumference repeats the atlas), v does not.
 */
export function rasterisePodSkin(seed: string | number, width = 512, height = 512): PodSkinRaster {
  const W = width;
  const H = height;
  const noise = new Noise2D(`${seed}/pod-skin`);
  const relief = new Float32Array(W * H);
  const albedo = new Float32Array(W * H * 3);
  const glow = new Float32Array(W * H);
  const band = new Uint8Array(W * H); // 0 neutral, 1 body, 2 cap, 3 cord
  const body: PodBodySample = { seam: 0, vein: 0, height: 0, glow: 0 };
  const leaf: PodBandSample = { height: 0, shade: 1 };
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const i = y * W + x;
      let r = 1;
      let g = 1;
      let b = 1;
      if (v < POD_BODY_V) {
        podBodyField(noise, u, v, body);
        band[i] = 1;
        relief[i] = body.height;
        // the veins and seams a little darker and warmer than the skin between them
        const s = 1 - 0.3 * body.seam - 0.2 * body.vein;
        r = s;
        g = s * (0.97 - 0.05 * body.seam);
        b = s * (0.92 - 0.1 * body.seam);
        glow[i] = body.glow * podGlowEnvelope(v / POD_BODY_V);
      } else if (v >= POD_CAP_BAND[0] && v < POD_CAP_BAND[1]) {
        podCapField(noise, u, v, leaf);
        band[i] = 2;
        relief[i] = leaf.height;
        r = leaf.shade;
        g = leaf.shade * 1.01;
        b = leaf.shade * 0.94;
      } else if (v >= POD_CORD_BAND[0]) {
        podCordField(noise, u, v, leaf);
        band[i] = 3;
        relief[i] = leaf.height;
        r = leaf.shade;
        g = leaf.shade * 0.95;
        b = leaf.shade * 0.86;
      }
      albedo[i * 3] = r;
      albedo[i * 3 + 1] = g;
      albedo[i * 3 + 2] = b;
    }
  }
  // every band to the same mean, so the vertex tints carry the far colour
  for (let k = 0; k <= 3; k++) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < W * H; i++) {
      if (band[i] !== k) continue;
      sum += albedo[i * 3] + albedo[i * 3 + 1] + albedo[i * 3 + 2];
      n += 3;
    }
    if (!n) continue;
    const scale = POD_MAP_MEAN / (sum / n);
    for (let i = 0; i < W * H; i++) {
      if (band[i] !== k) continue;
      albedo[i * 3] = Math.min(1, albedo[i * 3] * scale);
      albedo[i * 3 + 1] = Math.min(1, albedo[i * 3 + 1] * scale);
      albedo[i * 3 + 2] = Math.min(1, albedo[i * 3 + 2] * scale);
    }
  }
  // the glow modulation: mean 1 over the body, ceiling POD_GLOW_CEIL (then the mean restored, so
  // the map's body rows integrate to the old gradient's radiance)
  {
    let n = 0;
    for (let i = 0; i < W * H; i++) if (band[i] === 1) n++;
    // scale to mean 1, clamp, repeat: the clamp takes from the mean, the next pass gives it back
    // to the texels under the ceiling (converges in a few passes while any texel is under it)
    for (let pass = 0; pass < 16 && n; pass++) {
      let sum = 0;
      for (let i = 0; i < W * H; i++) if (band[i] === 1) sum += glow[i];
      const inv = n / sum;
      if (Math.abs(inv - 1) < 1e-4) break;
      for (let i = 0; i < W * H; i++) if (band[i] === 1) glow[i] = Math.min(POD_GLOW_CEIL, glow[i] * inv);
    }
  }
  // tangent-space normals from the relief: central differences, u wrapping, v clamped
  const normal = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 1) * W;
    const y1 = Math.min(H - 1, y + 1) * W;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = (relief[y * W + ((x + 1) % W)] - relief[y * W + ((x + W - 1) % W)]) * NORMAL_GAIN;
      const dy = (relief[y1 + x] - relief[y0 + x]) * NORMAL_GAIN;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      normal[i * 3] = -dx * inv;
      normal[i * 3 + 1] = dy * inv;
      normal[i * 3 + 2] = inv;
    }
  }
  return { width: W, height: H, albedo, normal, glow };
}

/**
 * The husk's segment bulge round a pod with `ribs` segments at angle `phi`: 0 on a seam (the
 * groove), 1 mid-segment; the groove is sharp, the segment round.
 */
export function podBulge(phi: number, ribs: number): number {
  return Math.pow(Math.abs(Math.sin((ribs * phi) / 2)), 0.55);
}
