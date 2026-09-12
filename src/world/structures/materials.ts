/**
 * Materials for the structures system. PBR sets come from Poly Haven (CC0) via the shared
 * texture library; small detail textures (heart leaves, grass tufts, carved runes, lantern
 * glow gradient) are generated on a canvas so nothing external is needed for them.
 */
import {
  BackSide,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector2,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { WorldContext } from '../system';
import { type ShadeFloor, applyShadeFloor } from '../materials/shadeFloor';
import { WIND_GLSL } from '../wind/wind';

const GRAD3: [number, number, number][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Seeded 3D gradient noise in about [-1, 1] (round 15). The house cap's colour and relief
 * terms had been 2D fields in (x, z): on the dome's near-vertical front face such a field is
 * constant along y, so every term drew VERTICAL STREAKS (B: the detrended column-mean /
 * row-mean luminance profile sd ratio was 2.8 against the reference's 0.96). Sampling a 3D
 * field at the vertex's object-space position is isotropic on any face. Deterministic through
 * the permutation drawn from `rng`.
 */
export class Noise3D {
  private perm = new Uint8Array(512);

  constructor(rng: () => number) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise(x: number, y: number, z: number): number {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const xf = x - X, yf = y - Y, zf = z - Z;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const p = this.perm;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const A = p[xi] + yi, AA = p[A] + zi, AB = p[A + 1] + zi;
    const B = p[xi + 1] + yi, BA = p[B] + zi, BB = p[B + 1] + zi;
    const g = (h: number, dx: number, dy: number, dz: number) => {
      const gr = GRAD3[h % 12];
      return gr[0] * dx + gr[1] * dy + gr[2] * dz;
    };
    const n = mix(
      mix(mix(g(p[AA], xf, yf, zf), g(p[BA], xf - 1, yf, zf), u), mix(g(p[AB], xf, yf - 1, zf), g(p[BB], xf - 1, yf - 1, zf), u), v),
      mix(mix(g(p[AA + 1], xf, yf, zf - 1), g(p[BA + 1], xf - 1, yf, zf - 1), u), mix(g(p[AB + 1], xf, yf - 1, zf - 1), g(p[BB + 1], xf - 1, yf - 1, zf - 1), u), v),
      w,
    );
    // the gradient set's extreme is ≈ ±0.87; scaled so the range matches the 2D simplex's
    return n * 1.15;
  }

  /** fractal sum, same conventions as `Noise2D.fbm` */
  fbm(x: number, y: number, z: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

/**
 * Shade floors for the structures' bark (round 11). The giants' preset (lift 7, flat, leaf-
 * filtered, half desaturated) is calibrated for trunks 10–30 m away, seen through the haze as
 * smooth grey-green columns. Saria's house stands 5–8 m from camera B and its bark is the
 * reference's warm dark brown: the door-frame lips measure rgb(109,94,74) / rgb(112,88,67) —
 * lum 0.36–0.38, hue 27–34°, sat 0.32–0.40 — and the shadow band under the moss overhang
 * rgb(87,73,54), lum 0.29, hue 35°. Under the giants' floor those read lum 0.34–0.38 but hue
 * 47–57° at sat 0.26 (pale grey-green concrete), because the floor's light is leaf-filtered and
 * 75 % of its albedo is a flat grey. So the house keeps a luminance floor but takes its hue from
 * the bark: `texture` 0.4 lets the bark map and the vertex shading (dark bough, dark soffit)
 * through, `canopy` 1 with `HOUSE_BARK_TINT` as the "leaf" colour tints the floor's light
 * toward the measured lip bark instead of the leaf sun, `chroma` 1 keeps that tint, and the
 * lift (6.3) is set so the door-frame lips land on the reference luminance (probes: lift 4 /
 * texture 0.6 hit the hue, 35°, but read 0.09 too dark; 5.2 / 0.5 read 0.31 on the left lip,
 * 0.065 under; 6 / 0.4 read 0.33 / 33° there; 7 / 0.3 read 0.35 / 31° but lifted the shadow
 * band under the moss to 0.36 against the reference's 0.31 — the darker `texture` share is what
 * keeps the bough and roll dark under the floor. The shaded right pillar is lit by the ambient,
 * not the floor, so its warmth comes from its vertex tint in house.ts).
 */
export const HOUSE_BARK_FLOOR: ShadeFloor = { lift: 6.3, texture: 0.4, canopy: 1, albedo: 0.08, chroma: 1 };
/** warmer than the reference B lip bark rgb(109,94,74) (hue 34°; the right lip rgb(112,88,67),
 *  27°): the pillars in the eave's shade pick up the bark map's yellow, so the floor leans past
 *  the target (hue 27°) to land between the two lips */
export const HOUSE_BARK_TINT = 0x70553f;
/**
 * The lantern limb's sleeve: the reference bough (A top-left, 0.04–0.20 × 0.335–0.385) is hazed
 * grey-olive bark, rgb(90,88,75) — lum 0.34, hue 52°, sat 0.17 — darker and browner than the
 * giants' floor made ours (lum 0.43, hue 62°), and in B's top band the reference limb is hazed
 * grey-olive, rgb(109,110,96) — hue 62°, sat 0.13. So: mostly flat albedo (`texture` 0.3, the
 * sleeve's own vertex shading is dark), a grey-olive tint and half chroma, with the lift set so
 * the dark sleeve bark lands near the giants' limb brightness (probes: lift 3 / texture 0.55 /
 * tint 40° read lum 0.16, hue 35°; lift 6.5 / 0.5 / 54° read 0.23, 42° — the warm bark map
 * pulls the hue ~10° below the tint).
 */
export const LIMB_BARK_FLOOR: ShadeFloor = { lift: 9, texture: 0.3, canopy: 1, albedo: 0.08, chroma: 0.6 };
/** grey-olive, hue ≈ 63°: the sleeve's bark map and moss pull the result down toward the
 *  reference bough's 52° */
export const LIMB_BARK_TINT = 0x6c6e48;
/**
 * The house's recess (round 12): the porch cut into the trunk, its soffit and the wall band under
 * the cap's overhang. Reference B's cavity between the moss edge and the door arch sits at the
 * haze floor — rgb(92,80,52), p50 0.26; the shadow band under the moss rgb(87,73,54), 0.29 —
 * while under HOUSE_BARK_FLOOR (set so the door-frame lips land at 0.36–0.38) every shaded face
 * is pinned to the floor's flat term: the round-12 probe halved the porch's vertex tints and the
 * band did not move (p50 0.38 → 0.38). Light inside a cavity under an overhang is a fraction of
 * the leaf-filtered light under the open roof, so the recess takes the same warm, textured floor
 * at a fifth of the lift.
 */
export const RECESS_BARK_FLOOR: ShadeFloor = { ...HOUSE_BARK_FLOOR, lift: 1.2 };

export interface StructureMaterials {
  /** house trunk + roots (bark_brown_02, warm tint) */
  bark: MeshStandardMaterial;
  /** pale living branches over the roofs (bark_willow_02) */
  barkPale: MeshStandardMaterial;
  /** log arch outer bark (bark_brown_02, dark weathered grey-brown; vertex tint carries ridge/furrow shading + moss) */
  logBark: MeshStandardMaterial;
  /** the lantern limb's bark sleeve: `bark` with its own (olive-brown, lower) shade floor */
  sleeveBark: MeshStandardMaterial;
  /** the house's porch recess, soffit and the wall band under the overhang: `bark` with RECESS_BARK_FLOOR */
  recessBark: MeshStandardMaterial;
  /** house interiors seen through the door: near-black warm wood so the opening reads dark */
  interior: MeshStandardMaterial;
  /** the log arch's hollow: near-black damp wood so the opening reads dark through the haze */
  logInterior: MeshStandardMaterial;
  /** thatch + moss dome (vertex colours drive the moss gradient) */
  roof: MeshStandardMaterial;
  /** weathered planks: signpost, door frames, thresholds */
  wood: MeshStandardMaterial;
  /** fence posts + rails: dark, silvered weathered wood that silhouettes against the haze */
  fenceWood: MeshStandardMaterial;
  /** darker wood for door frames / lantern hooks */
  woodDark: MeshStandardMaterial;
  /** the small warm lamp glint just inside the doorway */
  hearth: MeshBasicMaterial;
  /** dim embers on the back wall, a faint far glow that gives the interior depth */
  ember: MeshBasicMaterial;
  /** warm window glow disc */
  windowGlow: MeshBasicMaterial;
  /**
   * Round 16 / 18: the distant houses' window and door lamps, the openings' rims and the pods (one
   * mesh; white × 2.2, the vertex tints carry the hue at peak 1.0). Peak 2.2 linear: above the
   * height fog's far-shade exemption (heightfog.ts, 2.0) so the lit points 30–47 m out keep their
   * radiance under the veil like the pod lanterns do (the rims are tinted 0.8 → 1.76, lit not lamps).
   */
  distantGlow: MeshBasicMaterial;
  /**
   * Pod lantern (body + cap + stem + cord in one draw): emissive gradient texture, brighter at
   * the bottom; UV v ≥ LANTERN_DARK_V is black so caps and cords do not glow. Vertex colours tint.
   */
  lantern: MeshStandardMaterial;
  /** the same pod with a lime-yellow glow (reference B: two of Saria's three pods are lime) */
  lanternLime: MeshStandardMaterial;
  /** heart-shaped leaf cards, wind-animated (aPhase/aAmount attributes) */
  leaf: MeshStandardMaterial;
  /** vine stems, wind-animated */
  vine: MeshStandardMaterial;
  /** grass tufts + fern fronds on roofs and the log, wind-animated */
  tuft: MeshStandardMaterial;
  /** moss cushions (vertex colours) */
  moss: MeshStandardMaterial;
  /** the house cap's moss: vertex-colour albedo under a procedural mossy normal map (no stalks) */
  capMoss: MeshStandardMaterial;
  /** small white flower cards on the cap, wind-animated */
  flower: MeshStandardMaterial;
  /** carved rune decal for the signpost plank */
  runes: MeshStandardMaterial;
  /** dark splintered end-grain */
  endGrain: MeshStandardMaterial;
  /** number of materials that ended up with real texture files */
  texturedSets: string[];
  /**
   * Round 17: the canvas textures this system generated itself (moss albedo / normal, straw,
   * ember glow, the two lantern gradients, leaf / tuft / flower cards, the rune decal) — the
   * TextureLibrary's bark / plank / thatch maps are borrowed and NOT in here. `structures.dispose()`
   * releases each of these exactly once; `material.dispose()` never disposes a material's maps.
   */
  ownedTextures: Texture[];
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function finishTexture(tex: Texture, srgb: boolean, name: string): Texture {
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.name = name;
  tex.needsUpdate = true;
  return tex;
}

/** Heart-shaped leaf with a pale central vein; stem notch at the top (v = 1), tip at the bottom. */
export function heartLeafTexture(): Texture {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.clearRect(0, 0, S, S);
  const cx = S / 2;
  // heart outline: two lobes at the top, point at the bottom
  g.beginPath();
  g.moveTo(cx, S * 0.16);
  g.bezierCurveTo(cx + S * 0.05, S * 0.02, cx + S * 0.5, S * 0.02, cx + S * 0.47, S * 0.34);
  g.bezierCurveTo(cx + S * 0.45, S * 0.62, cx + S * 0.12, S * 0.82, cx, S * 0.985);
  g.bezierCurveTo(cx - S * 0.12, S * 0.82, cx - S * 0.45, S * 0.62, cx - S * 0.47, S * 0.34);
  g.bezierCurveTo(cx - S * 0.5, S * 0.02, cx - S * 0.05, S * 0.02, cx, S * 0.16);
  g.closePath();
  const grad = g.createRadialGradient(cx, S * 0.4, S * 0.05, cx, S * 0.45, S * 0.55);
  grad.addColorStop(0, '#b4e06c');
  grad.addColorStop(0.55, '#86bb4a');
  grad.addColorStop(1, '#5c9236');
  g.fillStyle = grad;
  g.fill();
  g.save();
  g.clip();
  // veins
  g.strokeStyle = 'rgba(214, 236, 160, 0.75)';
  g.lineWidth = S * 0.02;
  g.beginPath();
  g.moveTo(cx, S * 0.16);
  g.lineTo(cx, S * 0.97);
  g.stroke();
  g.lineWidth = S * 0.011;
  g.strokeStyle = 'rgba(214, 236, 160, 0.5)';
  for (let i = 0; i < 5; i++) {
    const y = S * (0.28 + i * 0.13);
    g.beginPath();
    g.moveTo(cx, y);
    g.quadraticCurveTo(cx + S * 0.2, y + S * 0.06, cx + S * 0.4, y + S * 0.16 - i * S * 0.03);
    g.moveTo(cx, y);
    g.quadraticCurveTo(cx - S * 0.2, y + S * 0.06, cx - S * 0.4, y + S * 0.16 - i * S * 0.03);
    g.stroke();
  }
  // slight darker edge
  g.restore();
  g.lineWidth = S * 0.012;
  g.strokeStyle = 'rgba(40, 70, 25, 0.6)';
  g.stroke();
  return finishTexture(new CanvasTexture(c), true, 'structures:heart-leaf');
}

/** Atlas: left half grass tuft, right half fern frond. Alpha in the shape. */
export function tuftTexture(): Texture {
  const W = 512;
  const H = 256;
  const { c, g } = canvas(W, H);
  g.clearRect(0, 0, W, H);
  // grass tuft
  const bx = W * 0.25;
  const by = H * 0.98;
  for (let i = 0; i < 15; i++) {
    const a = ((i / 14 - 0.5) * 1.5 + (Math.sin(i * 12.9) * 0.08)) as number;
    const len = H * (0.62 + 0.3 * Math.abs(Math.sin(i * 3.3)));
    const tipx = bx + Math.sin(a) * len;
    const tipy = by - Math.cos(a) * len;
    const w = W * 0.014;
    const shade = 0.75 + 0.25 * Math.sin(i * 1.7);
    g.fillStyle = `rgb(${Math.round(120 * shade)}, ${Math.round(165 * shade)}, ${Math.round(70 * shade)})`;
    g.beginPath();
    g.moveTo(bx - w, by);
    g.quadraticCurveTo(bx + Math.sin(a) * len * 0.5 - w * 0.5, by - Math.cos(a) * len * 0.5 - H * 0.05, tipx, tipy);
    g.quadraticCurveTo(bx + Math.sin(a) * len * 0.5 + w * 0.5, by - Math.cos(a) * len * 0.5 - H * 0.02, bx + w, by);
    g.closePath();
    g.fill();
  }
  // fern frond: central stem + paired leaflets, base at the bottom centre of the right half
  const fx = W * 0.75;
  const fy = H * 0.98;
  const fl = H * 0.9;
  g.strokeStyle = '#5a7a34';
  g.lineWidth = W * 0.008;
  g.beginPath();
  g.moveTo(fx, fy);
  g.quadraticCurveTo(fx + W * 0.03, fy - fl * 0.5, fx + W * 0.06, fy - fl);
  g.stroke();
  const pairs = 13;
  for (let i = 0; i < pairs; i++) {
    const t = 0.08 + (i / pairs) * 0.9;
    const sx = fx + W * 0.03 * 2 * t * (1 - t) + W * 0.06 * t * t;
    const sy = fy - fl * t;
    const len = W * 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + W * 0.02;
    for (const side of [-1, 1]) {
      const shade = 0.8 + 0.2 * Math.sin(i * 2.1 + side);
      g.fillStyle = `rgb(${Math.round(92 * shade)}, ${Math.round(150 * shade)}, ${Math.round(66 * shade)})`;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + side * len * 0.5, sy - len * 0.35, sx + side * len, sy - len * 0.25);
      g.quadraticCurveTo(sx + side * len * 0.5, sy + len * 0.05, sx, sy + len * 0.06);
      g.closePath();
      g.fill();
      // serration
      g.strokeStyle = 'rgba(30, 60, 20, 0.35)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  return finishTexture(new CanvasTexture(c), true, 'structures:tuft-fern');
}

/**
 * Straw colour map for the moss/thatch roofs: fine slightly-curved stalks with brightness
 * variation around a light neutral mean, so the vertex colours (moss ↔ straw gradient) set the
 * hue while the Poly Haven thatch normal map supplies the fibre relief. Deterministic.
 */
export function strawTexture(seedRng: () => number): Texture {
  const S = 512;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#b9ae94';
  g.fillRect(0, 0, S, S);
  g.lineCap = 'round';
  // long stalks
  for (let i = 0; i < 1400; i++) {
    const x = seedRng() * S;
    const y = seedRng() * S;
    const len = S * (0.08 + seedRng() * 0.22);
    const lean = (seedRng() - 0.5) * 0.5;
    const shade = 0.62 + seedRng() * 0.55;
    const v = Math.round(190 * shade);
    g.strokeStyle = `rgba(${Math.min(255, v + 12)}, ${Math.min(255, v + 4)}, ${Math.round(v * 0.82)}, ${0.35 + seedRng() * 0.4})`;
    g.lineWidth = 1 + seedRng() * 2.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean * len * 0.5 + (seedRng() - 0.5) * 6, y + len * 0.5, x + lean * len, y + len);
    g.stroke();
    // wrap vertically so the tile repeats cleanly
    if (y + len > S) {
      g.beginPath();
      g.moveTo(x, y - S);
      g.quadraticCurveTo(x + lean * len * 0.5, y - S + len * 0.5, x + lean * len, y - S + len);
      g.stroke();
    }
  }
  // dark gaps + small bright flecks
  for (let i = 0; i < 900; i++) {
    const x = seedRng() * S;
    const y = seedRng() * S;
    const dark = seedRng() < 0.6;
    g.fillStyle = dark ? `rgba(60, 50, 30, ${0.15 + seedRng() * 0.25})` : `rgba(255, 245, 210, ${0.15 + seedRng() * 0.25})`;
    g.beginPath();
    g.ellipse(x, y, 1 + seedRng() * 2.5, 3 + seedRng() * 9, (seedRng() - 0.5) * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  return finishTexture(new CanvasTexture(c), true, 'structures:straw');
}

const MOSS_S = 512;
/**
 * The moss albedo map's peak (linear): the map is stored divided by it — an 8-bit colour map
 * clips at 1.0, so a map whose mid tone is 1.0 can only darken (probes 3–4: the lit crests
 * never appeared) — and the cap's vertex tint is multiplied by it in house.ts, so the mid tone
 * renders the same and the crests carry the light.
 */
export const MOSS_ALBEDO_PEAK = 2.0;

/**
 * The house cap's moss maps. The tangent-space normal map (round 13): the cap had been sharing
 * the plain moss material, whose relief is the thatch_roof_angled normal map at half strength —
 * so the "moss" carried straw-stalk relief (the reviewer's source read). This is a moss surface:
 * soft cushions (10–25 cm), a dense layer of clumps 3–6 cm across, and a fine grain at the
 * texel pitch — one tile is 1.6 m on the cap (the cap's UV scale), so 3.1 mm per texel. The
 * height field (`mossField`) is periodic (bumps wrap, the grain lattice repeats) and is
 * differenced into normals here, so nothing is loaded. Deterministic through `seedRng`.
 *
 * Round 15 adds an albedo map from the SAME height field, so the darkening sits in the relief's
 * hollows and the crests carry the light ("lit edges"). The reference mound is a fine
 * dark-speckled moss: dark points 3–5 cm across over a
 * lighter ground (B, 2× crop: dots of 3–4 px at 1280 wide = 3.5–4.5 cm), which no vertex colour
 * can carry at the cap's 9 cm vertex pitch. The map: crests up to +100 % / hollows −30 % of the
 * cushion field (the coarse component, which survives the mip level B sees), a sparse layer of
 * small dark specks (radius 2–3.5 cm, ≈ 27 % coverage, ×0.4, near-neutral), and the full
 * field as a ±6 % grain — all stored over `MOSS_ALBEDO_PEAK`. Mean ≈ 0.9 of the mid
 * tone: the vertex albedo is the mid tone, the map spreads the surface to the reference's
 * tertiles (luminance 0.37 / 0.49 / 0.62 against take-0065's 0.38 / 0.57 / 0.62: the same
 * range, ours skewed to the light; probe 3 with a ±12 % relief and ×0.45 specks landed
 * 0.38 / 0.48 / 0.53 — the darks and mids right, the lit crests missing, clipped in the
 * texture). Same rng draws as the normal map alone (the specks draw after the field), so the
 * relief is unchanged.
 */
export function mossTextures(seedRng: () => number): { normal: Texture; albedo: Texture } {
  const S = MOSS_S;
  const { h, coarse } = mossField(seedRng);
  const wrap = (i: number) => ((i % S) + S) % S;
  // central differences → tangent-space normal (+u right, +v up: canvas rows run downward and
  // the CanvasTexture is flipped on upload, so canvas −y is +v)
  const { c, g } = canvas(S, S);
  const img = g.createImageData(S, S);
  const K = 2.6;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (h[y * S + wrap(x + 1)] - h[y * S + wrap(x - 1)]) * K;
      const dy = (h[wrap(y + 1) * S + x] - h[wrap(y - 1) * S + x]) * K;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * S + x) * 4;
      img.data[i] = Math.round((0.5 - 0.5 * dx * inv) * 255);
      img.data[i + 1] = Math.round((0.5 + 0.5 * dy * inv) * 255);
      // tangent-space RGB: z is encoded 0.5 + 0.5·nz like x and y (encoding nz directly decoded as
      // nz < 0 wherever the slope passed 45°; Astra, 12:58)
      img.data[i + 2] = Math.round((0.5 + 0.5 * inv) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const normal = finishTexture(new CanvasTexture(c), false, 'structures:moss-normal');

  // albedo: the fields normalised (mean 0, sd 1). The lit crests come from the COARSE field
  // (the 10–25 cm cushions alone): B sees the cap at ≈ 3.6 texels per pixel, mip level ~2,
  // where the full field's variance — mostly the 3–6 cm clumps — averages away (probes 4–5:
  // the crest term on the full field moved the light tertile by nothing); the full field only
  // adds a fine grain.
  const normalise = (f: Float32Array) => {
    let mean = 0;
    for (let i = 0; i < f.length; i++) mean += f[i];
    mean /= f.length;
    let varSum = 0;
    for (let i = 0; i < f.length; i++) varSum += (f[i] - mean) ** 2;
    const inv = 1 / Math.sqrt(varSum / f.length);
    return (i: number) => Math.max(-2, Math.min(2, (f[i] - mean) * inv));
  };
  const tCoarse = normalise(coarse);
  const tFine = normalise(h);
  // dark specks: sparse, small and crisp (the reference's dots are 3–4 px wide at 1280 = 4 cm;
  // 200 of radius 2–3.5 cm cover ≈ 27 % of the tile), overlaps saturate through the exp below
  const speck = new Float32Array(S * S);
  for (let n = 0; n < 200; n++) {
    const cx = Math.floor(seedRng() * S);
    const cy = Math.floor(seedRng() * S);
    const r = 6 + seedRng() * 5;
    const amp = 0.8 + seedRng() * 0.5;
    const ri = Math.ceil(r * 1.4);
    const invR = 1 / (r * r);
    for (let dy = -ri; dy <= ri; dy++) {
      const row = wrap(cy + dy) * S;
      for (let dx = -ri; dx <= ri; dx++) {
        const d2 = (dx * dx + dy * dy) * invR;
        if (d2 > 1.96) continue;
        speck[row + wrap(cx + dx)] += amp * Math.exp(-d2 * 2.2);
      }
    }
  }
  const toSRGB = (v: number) => {
    const c = Math.min(1, Math.max(0, v));
    return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
  };
  const { c: ca, g: ga } = canvas(S, S);
  const imgA = ga.createImageData(S, S);
  for (let i = 0; i < h.length; i++) {
    const tc = tCoarse(i);
    // crests carry the light (up to ×2), hollows fall (×0.7): the reference mound's light
    // tertile is 1.6× its mid in linear light, ours (vertex grain alone) 1.25×; at ×1.64
    // (probe 7) the light tertile stopped at 0.53 on the reference's 0.61 with the mid matched
    const relief = (tc > 0 ? 1 + 0.5 * tc : 1 + 0.15 * tc) * (1 + 0.06 * tFine(i));
    // speck darkening saturates at ×0.4, near-neutral (the reference's dark tertile keeps the
    // mound's own hue: rgb(104,97,59) under (166,160,99)); a touch less blue so the dots read
    // as moss shadow, not soil
    const s = 1 - Math.exp(-speck[i] * 1.6);
    const dark = 1 - 0.6 * s;
    const base = (relief * dark) / MOSS_ALBEDO_PEAK;
    const r = base * (1 - 0.02 * s);
    const gr = base;
    const b = base * (1 - 0.08 * s);
    const j = i * 4;
    imgA.data[j] = toSRGB(r);
    imgA.data[j + 1] = toSRGB(gr);
    imgA.data[j + 2] = toSRGB(b);
    imgA.data[j + 3] = 255;
  }
  ga.putImageData(imgA, 0, 0);
  const albedo = finishTexture(new CanvasTexture(ca), true, 'structures:moss-albedo');
  return { normal, albedo };
}

/**
 * The moss relief as a periodic height field (see `mossTextures`): `h` the full field, `coarse`
 * its cushion component alone (the albedo map's lit crests)
 */
function mossField(seedRng: () => number): { h: Float32Array; coarse: Float32Array } {
  const S = MOSS_S;
  const h = new Float32Array(S * S);
  const coarse = new Float32Array(S * S);
  const wrap = (i: number) => ((i % S) + S) % S;
  const bump = (cx: number, cy: number, r: number, amp: number, into: Float32Array[]) => {
    const ri = Math.ceil(r * 1.6);
    const inv = 1 / (r * r);
    for (let dy = -ri; dy <= ri; dy++) {
      const row = wrap(cy + dy) * S;
      for (let dx = -ri; dx <= ri; dx++) {
        const d2 = (dx * dx + dy * dy) * inv;
        if (d2 > 2.56) continue;
        const v = amp * Math.exp(-d2 * 1.7);
        for (const f of into) f[row + wrap(cx + dx)] += v;
      }
    }
  };
  // cushions: 10–25 cm across, gentle
  for (let i = 0; i < 140; i++) bump(Math.floor(seedRng() * S), Math.floor(seedRng() * S), 16 + seedRng() * 24, 0.5 + seedRng() * 0.5, [h, coarse]);
  // clumps: 3–6 cm across (radius 5–10 texels), dense enough to tile the surface
  for (let i = 0; i < 3400; i++) bump(Math.floor(seedRng() * S), Math.floor(seedRng() * S), 5 + seedRng() * 5, 0.55 + seedRng() * 0.45, [h]);
  // fine grain: two octaves of periodic value noise (2.5 cm and 1.2 cm lattices)
  const lattice = (cells: number, amp: number) => {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = seedRng();
    const step = S / cells;
    for (let y = 0; y < S; y++) {
      const fy = y / step;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % cells) * cells;
      const yb = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < S; x++) {
        const fx = x / step;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % cells;
        const xb = (x0 + 1) % cells;
        const top = g[ya + xa] + (g[ya + xb] - g[ya + xa]) * sx;
        const bot = g[yb + xa] + (g[yb + xb] - g[yb + xa]) * sx;
        h[y * S + x] += amp * (top + (bot - top) * sy);
      }
    }
  };
  lattice(64, 0.45);
  lattice(128, 0.25);
  return { h, coarse };
}

/**
 * Small five-petal white flower on transparent (round 13, board 03 "moss-covered roof with
 * plants": white flowers scattered over the cap's moss). Petals shade to a faint grey-green at
 * the centre round a yellow eye; alpha carries the shape.
 */
export function flowerTexture(): Texture {
  const S = 128;
  const { c, g } = canvas(S, S);
  g.clearRect(0, 0, S, S);
  const cx = S / 2;
  const cy = S / 2;
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(ang) * S * 0.24;
    const py = cy + Math.sin(ang) * S * 0.24;
    const grad = g.createRadialGradient(px, py, S * 0.02, px, py, S * 0.24);
    grad.addColorStop(0, '#fffdf6');
    grad.addColorStop(0.7, '#f4f1e6');
    grad.addColorStop(1, '#cfd2c0');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(px, py, S * 0.23, S * 0.16, ang, 0, Math.PI * 2);
    g.fill();
  }
  const eye = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.11);
  eye.addColorStop(0, '#ffd25a');
  eye.addColorStop(0.6, '#e8b53a');
  eye.addColorStop(1, '#b08a2a');
  g.fillStyle = eye;
  g.beginPath();
  g.arc(cx, cy, S * 0.11, 0, Math.PI * 2);
  g.fill();
  const tex = finishTexture(new CanvasTexture(c), true, 'structures:flower');
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  return tex;
}

/** UV v above this row of the lantern gradient is black (caps, stems, cords). */
export const LANTERN_DARK_V = 0.86;

/**
 * Emissive gradient for pod lanterns: bright at the bottom (v = 0), deeper toward the cap, faint
 * ribs. `topMul` scales the base colour near the cap (default: deeper orange).
 */
export function lanternGradientTexture(glow: number, topMul: [number, number, number] = [0.86, 0.5, 0.35]): Texture {
  const W = 64;
  const H = 128;
  const { c, g } = canvas(W, H);
  // the palette value is treated as the sRGB hue of the pod: bottom = brighter, yellower;
  // toward the cap = deeper
  const base = new Color(glow);
  const bottom = [Math.min(1, base.r * 1.02), Math.min(1, base.g * 1.12), Math.min(1, base.b * 1.3)];
  const top = [base.r * topMul[0], base.g * topMul[1], base.b * topMul[2]];
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = 1 - y / (H - 1); // canvas y grows downward; texture v = 0 is the bottom row
    const i0 = y * W * 4;
    if (v >= LANTERN_DARK_V - 0.01) {
      for (let x = 0; x < W; x++) {
        img.data[i0 + x * 4 + 3] = 255;
      }
      continue;
    }
    const body = v / (LANTERN_DARK_V - 0.01);
    const heat = Math.pow(1 - body, 1.4);
    for (let x = 0; x < W; x++) {
      const rib = 0.9 + 0.1 * Math.sin((x / W) * Math.PI * 2 * 9);
      const r = (top[0] + (bottom[0] - top[0]) * heat) * rib;
      const gg = (top[1] + (bottom[1] - top[1]) * heat) * rib;
      const b = (top[2] + (bottom[2] - top[2]) * heat) * rib;
      const i = i0 + x * 4;
      img.data[i] = Math.min(255, r * 255);
      img.data[i + 1] = Math.min(255, gg * 255);
      img.data[i + 2] = Math.min(255, b * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = finishTexture(new CanvasTexture(c), true, 'structures:lantern-gradient');
  tex.wrapS = RepeatWrapping;
  return tex;
}

/** Soft radial glow (opaque centre → transparent edge) for small emissive patches. */
function glowTexture(): Texture {
  const S = 64;
  const { c, g } = canvas(S, S);
  g.clearRect(0, 0, S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = finishTexture(new CanvasTexture(c), true, 'structures:glow');
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  return tex;
}

/** Carved rune-like marks, dark strokes on transparent; two rows. Deterministic (no Math.random). */
export function runeTexture(seedRng: () => number): Texture {
  const W = 512;
  const H = 192;
  const { c, g } = canvas(W, H);
  g.clearRect(0, 0, W, H);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const rows = 2;
  const cols = 11;
  const cellW = (W * 0.86) / cols;
  const cellH = (H * 0.72) / rows;
  const x0 = W * 0.07;
  const y0 = H * 0.14;
  for (let r = 0; r < rows; r++) {
    const n = r === 0 ? cols : cols - 3;
    for (let k = 0; k < n; k++) {
      const cx = x0 + (k + 0.5) * cellW + (r === 1 ? cellW * 1.5 : 0);
      const cy = y0 + (r + 0.5) * cellH;
      const strokes = 2 + Math.floor(seedRng() * 3);
      for (let s = 0; s < strokes; s++) {
        const kind = seedRng();
        // deep carved marks: near-black brown, thick, fully opaque so they read from 10 m
        g.strokeStyle = `rgba(${28 + Math.floor(seedRng() * 14)}, ${18 + Math.floor(seedRng() * 8)}, 10, ${0.92 + seedRng() * 0.08})`;
        g.lineWidth = 8 + seedRng() * 4;
        g.beginPath();
        const hw = cellW * 0.32;
        const hh = cellH * 0.36;
        if (kind < 0.35) {
          const ox = (seedRng() - 0.5) * hw;
          g.moveTo(cx + ox, cy - hh);
          g.lineTo(cx + ox + (seedRng() - 0.5) * hw * 0.4, cy + hh);
        } else if (kind < 0.6) {
          const oy = (seedRng() - 0.5) * hh * 1.2;
          g.moveTo(cx - hw, cy + oy);
          g.lineTo(cx + hw, cy + oy + (seedRng() - 0.5) * hh * 0.3);
        } else if (kind < 0.85) {
          const dir = seedRng() < 0.5 ? 1 : -1;
          g.moveTo(cx - hw * 0.8, cy - hh * dir);
          g.lineTo(cx + hw * 0.8, cy + hh * dir);
        } else {
          g.arc(cx + (seedRng() - 0.5) * hw, cy + (seedRng() - 0.5) * hh, hh * 0.45, 0, Math.PI * (1 + seedRng()));
        }
        g.stroke();
      }
    }
  }
  return finishTexture(new CanvasTexture(c), true, 'structures:runes');
}

/** Inject the shared wind model into a MeshStandardMaterial; uses aPhase/aAmount vertex attributes. */
export function windLeafMaterial<T extends MeshStandardMaterial>(mat: T, ctx: WorldContext, key: string): T {
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nattribute float aPhase;\nattribute float aAmount;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
          transformed += windLeaf(wp, aPhase, aAmount);
          transformed += windBranch(wp, 1.0, 0.75) * aAmount * 6.0;
        }`,
      );
  };
  mat.customProgramCacheKey = () => key;
  ctx.wind.bind(mat);
  return mat;
}

export async function loadMaterials(ctx: WorldContext, rng: () => number): Promise<StructureMaterials> {
  const T = ctx.textures;
  const [barkC, barkN, barkR, willowC, willowN, willowR, thatchN, thatchR, plankC, plankN, plankR] = await Promise.all([
    T.load('bark_brown_02', 'color'),
    T.load('bark_brown_02', 'normal'),
    T.load('bark_brown_02', 'roughness'),
    T.load('bark_willow_02', 'color'),
    T.load('bark_willow_02', 'normal'),
    T.load('bark_willow_02', 'roughness'),
    T.load('thatch_roof_angled', 'normal'),
    T.load('thatch_roof_angled', 'roughness'),
    T.load('weathered_planks', 'color'),
    T.load('weathered_planks', 'normal'),
    T.load('weathered_planks', 'roughness'),
  ]);
  const P = ctx.config.palette;
  /** every canvas texture built below goes through here (round 17: the owned-textures list) */
  const ownedTextures: Texture[] = [];
  const own = <T extends Texture>(tex: T): T => {
    ownedTextures.push(tex);
    return tex;
  };

  const bark = new MeshStandardMaterial({
    map: barkC,
    normalMap: barkN,
    normalScale: new Vector2(1.5, 1.5),
    roughnessMap: barkR,
    roughness: 1,
    color: new Color(0xdcb086),
    vertexColors: true,
  });
  const barkPale = new MeshStandardMaterial({
    map: willowC,
    normalMap: willowN,
    normalScale: new Vector2(1.1, 1.1),
    roughnessMap: willowR,
    roughness: 1,
    color: new Color(0xc4ae8e),
    vertexColors: true,
  });
  // the fallen trunk is old, damp and weathered: the dark brown bark set, cooled toward grey,
  // with a strong normal map so the fissures read at 30 m through the haze
  const logBark = new MeshStandardMaterial({
    map: barkC,
    normalMap: barkN,
    normalScale: new Vector2(2.2, 2.2),
    roughnessMap: barkR,
    roughness: 1,
    color: new Color(0x7e7268),
    vertexColors: true,
  });
  // near-black so neither sun through the doorway nor the sky fill can turn the opening into a
  // lit pocket; the door lamp alone shapes what little is seen inside
  const interior = new MeshStandardMaterial({
    map: barkC,
    normalMap: barkN,
    normalScale: new Vector2(0.8, 0.8),
    roughness: 1,
    color: new Color(0x54402e),
    side: BackSide,
  });
  const logInterior = new MeshStandardMaterial({
    map: barkC,
    normalMap: barkN,
    normalScale: new Vector2(1.5, 1.5),
    roughness: 1,
    color: new Color(0x2a221a),
    side: BackSide,
  });
  const roof = new MeshStandardMaterial({
    map: own(strawTexture(rng)),
    normalMap: thatchN,
    normalScale: new Vector2(0.9, 0.9),
    roughnessMap: thatchR,
    roughness: 1,
    color: new Color(0xffffff),
    vertexColors: true,
  });
  const wood = new MeshStandardMaterial({
    map: plankC,
    normalMap: plankN,
    roughnessMap: plankR,
    roughness: 1,
    color: new Color(0xf0d6a8),
    vertexColors: true,
  });
  const woodDark = new MeshStandardMaterial({
    map: plankC,
    normalMap: plankN,
    roughnessMap: plankR,
    roughness: 1,
    color: new Color(0x9a7650),
  });
  const fenceWood = new MeshStandardMaterial({
    map: plankC,
    normalMap: plankN,
    normalScale: new Vector2(1.2, 1.2),
    roughnessMap: plankR,
    roughness: 1,
    color: new Color(0x8e8272),
    vertexColors: true,
  });
  // kept below the tone-mapper's shoulder so the glow stays orange instead of clipping to cream
  const hearth = new MeshBasicMaterial({ color: new Color(0xffa040).multiplyScalar(1.4), toneMapped: true });
  const ember = new MeshBasicMaterial({ color: new Color(0x8a4014), map: own(glowTexture()), transparent: true, depthWrite: false, toneMapped: true });
  const windowGlow = new MeshBasicMaterial({ color: new Color(0xffb04a).multiplyScalar(1.3), toneMapped: true });
  // white × 2.2 — the hue lives in the vertex tints (distantHouse.ts: deep orange 0xff9a2a for the
  // lamps, the near lanterns' lime for the lime pods, 0.8 × orange for the openings' rims), each
  // scaled so its peak channel is 1.0, so every lamp / pod peaks at 2.2 linear. Round 16 carried
  // the orange in the material and the lime pods' [0.72, 1, 0.36] tint on top of it peaked at
  // 1.58 — below the height fog's 2.0 far-shade exemption, and orange rather than lime.
  const distantGlow = new MeshBasicMaterial({ color: new Color(1, 1, 1).multiplyScalar(2.2), vertexColors: true, side: DoubleSide, toneMapped: true });

  const lanternBase = {
    color: new Color(0xffffff),
    vertexColors: true,
    emissive: new Color(0xffffff),
    emissiveIntensity: 2.0,
    roughness: 0.6,
    metalness: 0,
  };
  const lantern = new MeshStandardMaterial({ ...lanternBase, emissiveMap: own(lanternGradientTexture(P.lanternGlow)) });
  // lime pod: yellow-green bottom, deeper green toward the cap
  const lanternLime = new MeshStandardMaterial({ ...lanternBase, emissiveMap: own(lanternGradientTexture(0xd2ee48, [0.5, 0.78, 0.3])) });

  const leaf = windLeafMaterial(
    new MeshStandardMaterial({
      map: own(heartLeafTexture()),
      alphaTest: 0.45,
      side: DoubleSide,
      roughness: 0.75,
      vertexColors: true,
      color: new Color(0xffffff),
    }),
    ctx,
    'structures-leaf',
  );
  const vine = windLeafMaterial(new MeshStandardMaterial({ color: new Color(0x4c5a2c), roughness: 1 }), ctx, 'structures-vine');
  const tuft = windLeafMaterial(
    new MeshStandardMaterial({
      map: own(tuftTexture()),
      alphaTest: 0.4,
      side: DoubleSide,
      roughness: 0.85,
      vertexColors: true,
      color: new Color(0xffffff),
    }),
    ctx,
    'structures-tuft',
  );
  const moss = new MeshStandardMaterial({ color: new Color(0xffffff), vertexColors: true, roughness: 1, normalMap: thatchN, normalScale: new Vector2(0.5, 0.5) });
  const runes = new MeshStandardMaterial({ map: own(runeTexture(rng)), alphaTest: 0.4, transparent: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const endGrain = new MeshStandardMaterial({ color: new Color(0x5a4636), roughness: 1, map: willowC, vertexColors: true });
  // the cap's moss (round 13): the shared `moss` binds the thatch normal map at 0.5, which put
  // straw-stalk relief on the cap's majority moss; this one takes the procedural mossy normals
  // (clumps + grain) and a slightly lower roughness so the lit tufts keep a soft sheen. Built
  // after the straw and rune canvases so their draws from the shared canvas rng are unchanged.
  // Round 14: normal scale 0.85 → 0.55 — under the low sun the full-strength clump normals
  // streaked the lit front face; the reference dome is a soft, near-uniform mossy olive.
  // Round 15: the moss albedo map (`mossTextures`) under the vertex tint — the reference's
  // fine dark-speckled texture at a scale the vertex grid cannot carry.
  const mossMaps = mossTextures(rng);
  const capMoss = new MeshStandardMaterial({ color: new Color(0xffffff), vertexColors: true, roughness: 0.9, map: own(mossMaps.albedo), normalMap: own(mossMaps.normal), normalScale: new Vector2(0.55, 0.55) });
  const flower = windLeafMaterial(
    new MeshStandardMaterial({
      map: own(flowerTexture()),
      alphaTest: 0.5,
      side: DoubleSide,
      roughness: 0.8,
      vertexColors: true,
      color: new Color(0xffffff),
    }),
    ctx,
    'structures-flower',
  );

  // Shade floors (materials/shadeFloor.ts) on every bark that stands in the roof's shade, where
  // a Lambert response to the hemisphere alone leaves it near-black orange-brown: the house
  // trunk / roots / porch / eave roll / support boughs, the lantern posts and rope-fence posts
  // (all `bark`), the pale draped limbs and the log arch take the house preset (warm, textured,
  // lift 4 — see HOUSE_BARK_FLOOR); the lantern limb's sleeve is a clone of `bark` with its own
  // olive-brown, lower floor (a clone does not carry compile hooks, so it gets its own call).
  // The floors only lift faces below them, so the sunlit rims are untouched. Applied last: these
  // materials have no other compile hooks, and `applyShadeFloor` chains onto whatever hook a
  // material already carries.
  const sleeveBark = bark.clone();
  sleeveBark.name = 'structures:sleeve-bark';
  // the house's recess: the same bark under a much lower floor (same program — the floor's
  // values are uniforms — one more draw per house)
  const recessBark = bark.clone();
  recessBark.name = 'structures:recess-bark';
  for (const m of [bark, barkPale, logBark]) applyShadeFloor(m, HOUSE_BARK_FLOOR, new Color(HOUSE_BARK_TINT));
  applyShadeFloor(sleeveBark, LIMB_BARK_FLOOR, new Color(LIMB_BARK_TINT));
  applyShadeFloor(recessBark, RECESS_BARK_FLOOR, new Color(HOUSE_BARK_TINT));

  const texturedSets = T.loaded().filter((s) => ['bark_brown_02', 'bark_willow_02', 'thatch_roof_angled', 'weathered_planks'].includes(s));
  return { bark, barkPale, logBark, sleeveBark, recessBark, interior, logInterior, roof, wood, woodDark, fenceWood, hearth, ember, windowGlow, distantGlow, lantern, lanternLime, leaf, vine, tuft, moss, capMoss, flower, runes, endGrain, texturedSets, ownedTextures };
}
