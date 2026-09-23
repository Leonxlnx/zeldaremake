/**
 * Kokiri kids (~1.09 m) — an original procedural low-poly child on the shared rig, reworked for
 * the owner review of 2026-09-19 (items 7–8, until Astra's model lands) after the demo frames
 * d_023–d_036 and ref-01: child proportions (head ≈ ¼ of the height), a sleeveless deep-green
 * tunic with a leather belt, buckle and a scalloped skirt, bare arms with dark wristbands,
 * near-black boots with a khaki fold-over cuff, a maroon bob under a wide green headband.
 *
 * Round 48 (npc-2, opus-review #17 "flat-faced mannequins"): the girls' faces are MODELLED —
 * eye sockets recessed into the skull, textured eyeballs (sclera, dark iris, pupil, catch-light)
 * on the blink group, skin eyelid shells shaped to an almond with a heavy lash tube, brow tubes,
 * a nose bump, lips, pointed ears with a rim and a concha — over a skull whose skin is a canvas
 * texture (blush, socket shading) on a skin material with a warm terminator ramp (a two-tone,
 * subsurface-like tint injected after the lights). The hair is four overlapping shells (bob
 * body with a flared hem, crown volume above the band, a pointed fringe under it, side locks).
 * The skirt's FRONT is two flaps riding on the thigh joints, so it follows the legs — lying on
 * the thighs when she sits, swinging with the stride — while the hips carry the back / side panel
 * and the waist ring. All of that costs the same submissions as the decal face did (skull, eyes,
 * lash, hair, band on the head; two thigh flaps are the only new meshes).
 *
 * Lane 7 (2026-09-23, "the people need to be updated" — the girl by the signpost at the follow
 * camera's 4–8 m, ref-01 / d_023–d_036): the head joint is scaled ×1.14 (`HEAD_SCALE` — head and
 * hair a third of the height, the footage's proportions); the hair is a wider bob (r × 1.16, a
 * deeper hem flare, seven soft lobes breaking the outline into locks below the band, a fuller
 * crown, side locks framing the face at the bob's cut edge) in the footage's maroon under a canvas
 * of broad locks and fine strands on a glossier surface that takes a sheen from the sun
 * (`girlHair`); the tunic's upper carries four shallow fold ridges and the whole tunic wears a
 * drape canvas (fold valleys in step with the ridges, shade under the belt and along the hem, a
 * fine weave — `girlCloth`); the skin is the pale peach of the footage instead of the tan. Same
 * meshes, same submissions per kid.
 *
 * `variant` 0 = the girl who wanders the plaza (kokiri-a), 1 = the girl who sits on the steps
 * (kokiri-b, darker tunic and hair), 2 = the boy at Saria's door (the round-1 look), 3 = the
 * girl on the raised ledge (kokiri-ledge, ref-04), 4 = the girl on the south bank (round 50,
 * `NPC_SOUTH_BANK`). Every material is cached per look so the per-joint merge (consolidate.ts)
 * keeps a kid at ~23 meshes.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { hash2 } from '../util/prng';
import { merge, ovalLathe, place, sweep } from './geometry';
import { CHAR_COLORS, matte } from './palette';
import { beginTally, buildArms, buildFace, buildHair, buildLegs, buildNeck, endTally, part, type Character } from './link';
import { buildRig, type Proportions, type Rig } from './rig';

/**
 * A Kokiri child: 1.06 m to the skull top (1.09 with the hair), head 0.26 m across — a quarter of
 * the height — short legs, arms reaching the hips. Same rig conventions as rig.ts (root at the
 * sole, +Z forward).
 */
export const KOKIRI_CHILD_PROPORTIONS: Proportions = {
  height: 1.06,
  ankleY: 0.06,
  kneeY: 0.26,
  hipY: 0.47,
  hipHalfWidth: 0.058,
  chestY: 0.6,
  shoulderY: 0.77,
  shoulderHalfWidth: 0.118,
  upperArm: 0.145,
  forearm: 0.13,
  neckY: 0.8,
  headCentreY: 0.94,
  headRadius: 0.13,
  sole: [0, -0.06, 0.025],
};

/**
 * kid palette (albedo, ≈ 1.3× the hazed display values like palette.ts), read off demo d_024/d_033
 * and ref-01: the girls' deep forest-green tunic (display ≈ #2b4a2a), a brighter green headband,
 * near-black boots with khaki cuffs, maroon-red hair (display ≈ #5e2226), dark leather belt and
 * wristbands. Indexed by the girl look g (0 = kokiri-a, 1 = kokiri-b, 2 = the ledge girl, 3 = the
 * girl on the south bank — round 50, a slightly bluer tunic and a darker auburn bob); the boy keeps
 * the palette's kid colours. Lane 7 (2026-09-23): the skin is the pale peach of ref-01 / d_024 — the
 * tan of rounds 47–50 read orange against the footage at the follow camera's 5 m — and the hair the
 * footage's maroon (the 0x93412f brick, low in blue, rendered as an orange-brown).
 */
const KID = {
  tunic: [0x375f35, 0x2f522f, 0x3a5a2e, 0x335a3a],
  band: [0x4d7a3c, 0x44703a, 0x568a3e, 0x4a7c46],
  belt: 0x4a3322,
  buckle: 0xb8963f,
  boot: 0x352721,
  cuff: 0x8f7f5a,
  hair: [0x7e2f33, 0x6e2a2e, 0x86343a, 0x74282d],
  skin: [0xd3a98a, 0xcda385, 0xd6ad8e, 0xd0a687],
  iris: ['#4a2c1a', '#3d2818', '#3b4a24', '#46301c'],
  lash: 0x1c120e,
} as const;
/** the boy's skin (round 47's value; unchanged so B / E keep their pixels) */
const BOY_SKIN = 0xb28058;

/** the girl look index for a variant (the boy, variant 2, has none): 0 kokiri-a, 1 kokiri-b, 2 the ledge girl, 3 the south-bank girl */
const girlLook = (variant: number) => (variant === 3 ? 2 : variant === 4 ? 3 : variant % 2);

const mats = new Map<string, MeshStandardMaterial>();
function kidMat(key: string, color: number, roughness = 0.9): MeshStandardMaterial {
  const id = `${key}:${color}:${roughness}`;
  let m = mats.get(id);
  if (!m) {
    m = new MeshStandardMaterial({ color: new Color(color), roughness, metalness: 0 });
    m.name = `char-kid-${key}`;
    mats.set(id, m);
  }
  return m;
}

/** the round-1 variant tint helper (the boy keeps the palette's kid colours) */
function tinted(key: 'kidHair' | 'kidSkin' | 'kidHeadband' | 'kidTunic', variant: number, hueShift: number, lightScale: number): MeshStandardMaterial {
  const c = new Color(CHAR_COLORS[key]);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + hueShift + 1) % 1, hsl.s, Math.min(1, hsl.l * lightScale));
  return kidMat(`${key}-${variant}`, c.getHex());
}

// ---- skin: a warm terminator ramp (round 48) ----

/**
 * Two-tone skin: after the lights, the half-shadow band where the sun grazes the skin (N·L
 * around zero) is warmed toward red, and the shadow side keeps a faint warm floor — the
 * subsurface look of a stylised face without a scattering pass. Reads `directionalLights[0]`
 * (the sun); compiles to nothing without one. Chains onto any earlier hook and extends the
 * program cache key so the ramped skin never shares a program with a plain material.
 */
function applySkinRamp(m: MeshStandardMaterial): MeshStandardMaterial {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    prev?.call(m, shader, renderer);
    shader.uniforms.uSkinWarm = { value: new Color(0.26, 0.06, 0.02) };
    shader.uniforms.uSkinShade = { value: new Color(0.1, 0.03, 0.02) };
    shader.fragmentShader = `uniform vec3 uSkinWarm;\nuniform vec3 uSkinShade;\n${shader.fragmentShader}`.replace(
      '#include <lights_fragment_end>',
      /* glsl */ `#include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
  {
    float zrNdl = dot( geometryNormal, directionalLights[ 0 ].direction );
    float zrBand = smoothstep( -0.65, -0.12, zrNdl ) * ( 1.0 - smoothstep( 0.1, 0.5, zrNdl ) );
    float zrShade = 1.0 - smoothstep( -0.25, 0.35, zrNdl );
    reflectedLight.indirectDiffuse += diffuseColor.rgb * ( uSkinWarm * zrBand + uSkinShade * zrShade );
  }
  #endif`,
    );
  };
  const key = m.customProgramCacheKey;
  m.customProgramCacheKey = () => `${key ? key.call(m) : ''}|kid-skin-ramp`;
  return m;
}

function girlSkin(look: number): MeshStandardMaterial {
  const id = `skin-ramp:${look}`;
  let m = mats.get(id);
  if (!m) {
    m = applySkinRamp(new MeshStandardMaterial({ color: new Color(KID.skin[look]), roughness: 0.78, metalness: 0 }));
    m.name = `char-kid-skin-${look}`;
    mats.set(id, m);
  }
  return m;
}

// ---- canvas textures (drawn once per look, shared by the kids that use it) ----

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function canvasTex(c: HTMLCanvasElement, name: string): CanvasTexture {
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.name = name;
  return tex;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

const sstep = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---- hair and cloth canvases (lane 7): shading that reads at the follow camera's 4–8 m ----

/** a canvas painted per pixel as a lightness factor over one sRGB colour, wrapped in u and v (the hair and the tunic run once around) */
function shadedCanvas(W: number, H: number, color: number, name: string, factor: (u: number, v: number, x: number, y: number) => number): CanvasTexture {
  const [c, g] = canvas(W, H);
  const r8 = (color >> 16) & 255;
  const g8 = (color >> 8) & 255;
  const b8 = color & 255;
  const img = g.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = 1 - y / (H - 1);
    for (let x = 0; x < W; x++) {
      const k = factor(x / W, v, x, y);
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, Math.round(r8 * k));
      d[i + 1] = Math.min(255, Math.round(g8 * k));
      d[i + 2] = Math.min(255, Math.round(b8 * k));
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = canvasTex(c, name);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

const hairTexCache = new Map<number, MeshStandardMaterial>();

/**
 * The girls' hair: the look's colour under nine broad locks across u (a dark valley and a lighter
 * core each, widths uneven, so the bob reads as locks of hair rather than a helmet at 5 m), fine
 * strands in long runs down v for the closer views, a shade toward the hem (v → 0, the underside
 * of the bob) and a lift at the crown, on a glossier surface (roughness 0.58) so the sun leaves a
 * sheen where the crown turns. The bob and the crown are sphere-mapped (u once around, v top → hem);
 * the fringe and the clumps are laid onto the same canvas (`shell` grid UVs, `clumpUv`).
 */
function girlHair(look: number): MeshStandardMaterial {
  let m = hairTexCache.get(look);
  if (m) return m;
  const map = shadedCanvas(512, 256, KID.hair[look], `char-kid-hair-${look}`, (u, v, x, y) => {
    const shade = (1 - 0.16 * sstep(0.4, 0.05, v)) * (1 + 0.06 * sstep(0.7, 0.95, v));
    const phase = u * 9 + 0.09 * Math.sin(u * Math.PI * 2 * 3 + 1.1) + 0.05 * Math.sin(v * 5.2 + u * 6);
    const core = Math.cos(phase * Math.PI * 2);
    const lock = 1 + 0.15 * core + 0.08 * Math.max(0, core) ** 3;
    const col = Math.floor(x / 6);
    const run = Math.floor((y + 23 * hash2(col, 7, 5)) / 44);
    const strand = 1 + 0.08 * (hash2(col, run, 3) - 0.5) + 0.04 * (hash2(x, y >> 2, 9) - 0.5);
    return shade * lock * strand;
  });
  m = new MeshStandardMaterial({ map, roughness: 0.58, metalness: 0 });
  m.name = `char-kid-hair-${look}`;
  hairTexCache.set(look, m);
  return m;
}

const clothTexCache = new Map<number, MeshStandardMaterial>();

/**
 * The girls' tunic cloth: the look's green with four drape valleys around (u = azimuth / 2π — the
 * skirt panels and the lathed upper lay their UVs out that way — dark where the skirt's fold
 * ridges `cos(4a + 0.7)` dip), strongest toward the hem, a shade under the belt (v → 1) and along
 * the hem (v → 0), a fine two-texel weave and a soft mottle for the closer views. Matte (0.86).
 */
function girlCloth(look: number): MeshStandardMaterial {
  let m = clothTexCache.get(look);
  if (m) return m;
  const map = shadedCanvas(256, 128, KID.tunic[look], `char-kid-cloth-${look}`, (u, v, x, y) => {
    const hem = 1 - 0.16 * sstep(0.2, 0, v);
    const belt = 1 - 0.12 * sstep(0.82, 1, v);
    const w = 0.45 + 0.55 * (1 - v);
    const fold = Math.cos(8 * Math.PI * u + 0.7);
    const drape = 1 + 0.12 * w * fold - 0.08 * w * Math.max(0, -fold) ** 2;
    const weave = 1 + 0.035 * ((((x >> 1) + (y >> 1)) & 1) * 2 - 1);
    const mottle = 1 + 0.04 * (hash2(x >> 3, y >> 3, 11) - 0.5);
    return hem * belt * drape * weave * mottle;
  });
  m = new MeshStandardMaterial({ map, roughness: 0.86, metalness: 0 });
  m.name = `char-kid-cloth-${look}`;
  clothTexCache.set(look, m);
  return m;
}

/** UV corners of the skull texture that carry a flat colour for the merged features */
const SKULL_TEX_W = 512;
const SKULL_TEX_H = 256;
const UV_SKIN: [number, number] = [0.03, 0.03];
const UV_LIP: [number, number] = [0.965, 0.04];
const UV_EAR: [number, number] = [0.965, 0.16];

/** texture-space centre of a head-space direction on the (unscaled) skull sphere: three's sphere puts +Z at u 0.25, the top at v 1 */
function skullUv(x: number, y: number, z: number): [number, number] {
  const psi = Math.atan2(x, z);
  const th = Math.acos(Math.max(-1, Math.min(1, y / Math.hypot(x, y, z))));
  return [0.25 + psi / (Math.PI * 2), 1 - th / Math.PI];
}

const skullTexCache = new Map<number, MeshStandardMaterial>();

/**
 * The skull's skin (round 48): the look's skin tone with a soft cheek blush, warm shading in the
 * eye sockets and under the brow, a shadow under the lower lip, plus flat colour patches in the
 * corners the merged features (lips, inner ear, plain skin) point their UVs at. Same tone as the
 * body's plain skin material, on the same warm ramp.
 */
function skullMaterial(look: number): MeshStandardMaterial {
  let m = skullTexCache.get(look);
  if (m) return m;
  const W = SKULL_TEX_W;
  const H = SKULL_TEX_H;
  const [c, g] = canvas(W, H);
  const skin = new Color(KID.skin[look]);
  g.fillStyle = hex(skin.getHex());
  g.fillRect(0, 0, W, H);
  const blot = (uv: [number, number], rx: number, ry: number, color: string, alpha: number) => {
    const x = uv[0] * W;
    const y = (1 - uv[1]) * H;
    const grad = g.createRadialGradient(x, y, 0, x, y, 1);
    grad.addColorStop(0, color);
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.scale(rx, ry);
    g.translate(-x, -y);
    g.fillStyle = grad;
    g.fillRect(x - 1, y - 1, 2, 2);
    g.restore();
  };
  for (const s of [1, -1]) {
    // cheek blush, low and wide
    blot(skullUv(s * 0.052, -0.046, 0.115), 26, 17, 'rgba(214,112,96,1)', 0.42);
    // socket: a warm shade around the eye, deeper toward the inner corner and under the brow
    blot(skullUv(s * 0.04, -0.012, 0.121), 24, 20, 'rgba(150,78,58,1)', 0.38);
    blot(skullUv(s * 0.022, -0.004, 0.126), 9, 8, 'rgba(120,60,48,1)', 0.3);
  }
  // nose shadow and the crease under the lower lip
  blot(skullUv(0, -0.04, 0.122), 8, 6, 'rgba(150,84,64,1)', 0.35);
  blot(skullUv(0, -0.078, 0.104), 12, 5, 'rgba(140,76,60,1)', 0.35);
  // flat patches: lips (rosy), the ear's concha (deep warm), plain skin is the base fill
  const patch = (uv: [number, number], color: string) => {
    g.fillStyle = color;
    g.fillRect(uv[0] * W - 14, (1 - uv[1]) * H - 14, 28, 28);
  };
  patch(UV_LIP, '#a35a52');
  patch(UV_EAR, '#8f5a48');
  m = applySkinRamp(new MeshStandardMaterial({ map: canvasTex(c, `char-kid-skull-${look}`), color: 0xffffff, roughness: 0.74, metalness: 0 }));
  m.name = `char-kid-skull-${look}`;
  skullTexCache.set(look, m);
  return m;
}

const eyeTexCache = new Map<string, MeshStandardMaterial>();

/**
 * The eyeball texture (round 48): an equirect map for a sphere facing +Z (the iris at u 0.25,
 * v 0.5) — off-white sclera shaded toward the corners, a big dark iris with a darker rim and
 * radial fibres, a large pupil and a catch-light up and to her right. 256 × 128 covers the
 * 24 mm ball at ~50 px per 10 mm at the front.
 */
function eyeMaterial(iris: string): MeshStandardMaterial {
  let m = eyeTexCache.get(iris);
  if (m) return m;
  const W = 256;
  const H = 128;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#f2ede3';
  g.fillRect(0, 0, W, H);
  // sclera shading toward the top (under the lid) and the corners
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(120,90,80,0.55)');
  shade.addColorStop(0.32, 'rgba(120,90,80,0.0)');
  shade.addColorStop(1, 'rgba(120,90,80,0.0)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  const cx = W * 0.25;
  const cy = H * 0.5;
  // iris: angular radius ≈ 46° → 33 px in u and v alike at the equator (the big dark eyes of d_024: the
  // iris fills the lid opening top to bottom, sclera only at the corners)
  const ir = 33;
  const grad = g.createRadialGradient(cx, cy, ir * 0.2, cx, cy, ir);
  grad.addColorStop(0, iris);
  grad.addColorStop(0.7, iris);
  grad.addColorStop(0.9, '#17100a');
  grad.addColorStop(1, '#0d0906');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(cx, cy, ir, ir, 0, 0, Math.PI * 2);
  g.fill();
  // fibres
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 1;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * ir * 0.42, cy + Math.sin(a) * ir * 0.42);
    g.lineTo(cx + Math.cos(a) * ir * 0.9, cy + Math.sin(a) * ir * 0.9);
    g.stroke();
  }
  // pupil
  g.fillStyle = '#080605';
  g.beginPath();
  g.ellipse(cx, cy + 1, ir * 0.5, ir * 0.54, 0, 0, Math.PI * 2);
  g.fill();
  // catch-light: up and toward −X (her right, the viewer's left)
  g.fillStyle = 'rgba(255,255,255,0.96)';
  g.beginPath();
  g.ellipse(cx - ir * 0.36, cy - ir * 0.4, ir * 0.2, ir * 0.16, -0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.ellipse(cx + ir * 0.3, cy + ir * 0.34, ir * 0.09, ir * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  m = new MeshStandardMaterial({ map: canvasTex(c, `char-kid-eye-${iris}`), roughness: 0.32, metalness: 0 });
  m.name = 'char-kid-eyeball';
  eyeTexCache.set(iris, m);
  return m;
}

// ---- face geometry helpers (round 48) ----

/** overwrite a geometry's UVs with one texture point (a flat-colour corner of the skull texture) */
function flatUv(geo: BufferGeometry, uv: [number, number]): BufferGeometry {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    arr[i * 2] = uv[0];
    arr[i * 2 + 1] = uv[1];
  }
  geo.setAttribute('uv', new Float32BufferAttribute(arr, 2));
  return geo;
}

/**
 * A spherical shell around `centre` (radius R) over the azimuth range ±psiMax about +Z, whose
 * polar extent at each azimuth psi runs from thetaFrom(psi) to thetaTo(psi) — the eyelids (an
 * almond edge) and the fringe (a pointed hem). Normals radial; UVs flat (one texture point) or,
 * given a function of the grid position (ix / ws across, iy / hs down), laid out over the shell.
 */
function shell(centre: Vector3, R: number, psiMax: number, thetaFrom: (psi: number) => number, thetaTo: (psi: number) => number, ws: number, hs: number, uv: [number, number] | ((sx: number, sy: number) => [number, number])): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let ix = 0; ix <= ws; ix++) {
    const psi = -psiMax + (2 * psiMax * ix) / ws;
    const t0 = thetaFrom(psi);
    const t1 = thetaTo(psi);
    for (let iy = 0; iy <= hs; iy++) {
      const th = t0 + ((t1 - t0) * iy) / hs;
      const nx = Math.sin(th) * Math.sin(psi);
      const ny = Math.cos(th);
      const nz = Math.sin(th) * Math.cos(psi);
      positions.push(centre.x + R * nx, centre.y + R * ny, centre.z + R * nz);
      normals.push(nx, ny, nz);
      const p = typeof uv === 'function' ? uv(ix / ws, iy / hs) : uv;
      uvs.push(p[0], p[1]);
    }
  }
  const col = hs + 1;
  for (let ix = 0; ix < ws; ix++) {
    for (let iy = 0; iy < hs; iy++) {
      const a = ix * col + iy;
      const b = a + col;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/** the skull ellipsoid's radii (the sphere r under the [1, 1.02, 0.98] scale) */
const SKULL_SCALE: [number, number, number] = [1, 1.02, 0.98];
/** the z of the skull surface at head-space (x, y) (front half), `lift` metres proud of it */
function skullZ(r: number, x: number, y: number, lift = 0): number {
  const a = r * SKULL_SCALE[0];
  const b = r * SKULL_SCALE[1];
  const c = r * SKULL_SCALE[2];
  return c * Math.sqrt(Math.max(0, 1 - (x / a) ** 2 - (y / b) ** 2)) + lift;
}

/** eye geometry constants (head space, metres, for headRadius 0.13) */
const EYE_X = 0.04;
const EYE_Y = -0.012;
const EYE_R = 0.024;
/** how far the ball's centre sits inside the unrecessed skull surface */
const EYE_SINK = 0.0165;
/** the upper lid's edge height on the ball at the centre (× EYE_R) and how far it dives at the corners */
const LID_TOP = 0.56;
const LID_TOP_DIVE = 1.36;
const LID_LOW = -0.7;
const LID_LOW_RISE = 1.3;
const LID_PSI = 1.62;

const _m4 = new Matrix4();
const _v = new Vector3();

/**
 * The girl's head (round 48): a recessed-socket skull with jaw, nose, lips (lip colour), eyelid
 * shells and eared with a rim + concha, all one textured-skin mesh; the eyeballs (textured,
 * glossy) on the blink group whose pivot is the upper lid line, so the shared Y-squash blink
 * folds them up under the lid; lash tubes + the mouth line in one dark mesh.
 */
function buildGirlFace(rig: Rig, look: number): void {
  const r = rig.props.headRadius;
  const head = rig.head;
  const skinTex = skullMaterial(look);

  // -- skull with the sockets pressed in around each eye --
  const skull = new SphereGeometry(r, 36, 26);
  {
    const pos = skull.attributes.position;
    const eyeDirs = [1, -1].map((s) => new Vector3(s * EYE_X, EYE_Y, skullZ(r, EYE_X, EYE_Y) / SKULL_SCALE[2]).normalize());
    for (let i = 0; i < pos.count; i++) {
      _v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const n = _v.clone().normalize();
      let d = 0;
      for (const e of eyeDirs) {
        const ang = Math.acos(Math.max(-1, Math.min(1, n.dot(e))));
        const u = Math.max(0, 1 - ang / 0.34);
        d = Math.max(d, 0.0045 * u * u * (3 - 2 * u));
      }
      // a faint brow ridge just above the sockets
      const browY = 0.036;
      const ridge = Math.max(0, 1 - Math.abs(n.y * r - browY) / 0.03) * Math.max(0, n.z) * (Math.abs(n.x) < 0.6 ? 1 : 0);
      const k = 1 - d / r + 0.0015 * ridge / r;
      pos.setXYZ(i, _v.x * k, _v.y * k, _v.z * k);
    }
    pos.needsUpdate = true;
    skull.computeVertexNormals();
  }
  const parts: BufferGeometry[] = [place(skull, 0, 0, 0, undefined, SKULL_SCALE)];
  // chin: a small rounded boss under the mouth, 4 mm proud at its middle and carrying the lower face a
  // little below the sphere; kept narrow and clear of the lips so its seam is a short U under the lower lip
  parts.push(flatUv(place(new SphereGeometry(1, 16, 12), 0, -0.1, 0.026, undefined, [0.05, 0.032, 0.062]), UV_SKIN));
  // nose: a small bump with a soft bridge
  parts.push(flatUv(place(new SphereGeometry(0.0095, 10, 8), 0, -0.031, skullZ(r, 0, -0.031, -0.0025), undefined, [1, 1.15, 0.85]), UV_SKIN));
  parts.push(flatUv(place(new SphereGeometry(0.0055, 8, 6), 0, -0.016, skullZ(r, 0, -0.016, -0.001), undefined, [0.9, 1.6, 0.8]), UV_SKIN));
  // lips: upper and lower, in the lip colour
  parts.push(flatUv(place(new SphereGeometry(1, 12, 8), 0, -0.0585, skullZ(r, 0, -0.0585, -0.0035), undefined, [0.0165, 0.0042, 0.0062]), UV_LIP));
  parts.push(flatUv(place(new SphereGeometry(1, 12, 8), 0, -0.0665, skullZ(r, 0, -0.0665, -0.0045), undefined, [0.0135, 0.0052, 0.0072]), UV_LIP));

  // -- eyes: lids on the skull, balls on the blink group --
  const eyeCentre = (s: number) => new Vector3(s * EYE_X, EYE_Y, skullZ(r, EYE_X, EYE_Y, -EYE_SINK));
  const lidTop = (psi: number) => Math.acos(Math.max(-0.95, Math.min(0.95, LID_TOP - LID_TOP_DIVE * (psi / LID_PSI) ** 2)));
  const lidLow = (psi: number) => Math.acos(Math.max(-0.95, Math.min(0.95, LID_LOW + LID_LOW_RISE * (psi / LID_PSI) ** 2)));
  const lash: BufferGeometry[] = [];
  for (const s of [1, -1] as const) {
    const c = eyeCentre(s);
    // upper lid: from the top pole down to the almond edge; lower lid: from the edge to the bottom
    parts.push(shell(c, EYE_R + 0.0032, LID_PSI, () => 0, lidTop, 18, 6, UV_SKIN));
    parts.push(shell(c, EYE_R + 0.0022, LID_PSI, lidLow, () => Math.PI, 18, 5, UV_SKIN));
    // lash: a dark tube along the upper edge, thick toward the outer corner, with a flick past it
    const pts: Vector3[] = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      // inner corner → outer corner (outer = +X for her left eye, s = 1)
      const psi = s * (-1.15 + (2.45 * i) / n);
      const th = lidTop(psi);
      const R = EYE_R + 0.0042;
      pts.push(new Vector3(c.x + R * Math.sin(th) * Math.sin(psi), c.y + R * Math.cos(th), c.z + R * Math.sin(th) * Math.cos(psi)));
    }
    const last = pts[pts.length - 1];
    pts.push(new Vector3(last.x + s * 0.006, last.y + 0.005, last.z - 0.004));
    lash.push(sweep(pts, [0.0012, 0.0018, 0.0026, 0.003, 0.0026, 0.0012], { segments: 16, radial: 6, closeTip: true, closeStart: true }));
  }
  // mouth line: a thin dark curve between the lips, corners lifted (the small smile)
  lash.push(
    sweep(
      [new Vector3(-0.0135, -0.0605, skullZ(r, -0.0135, -0.0605, 0.0018)), new Vector3(0, -0.0632, skullZ(r, 0, -0.0632, 0.0022)), new Vector3(0.0135, -0.0605, skullZ(r, 0.0135, -0.0605, 0.0018))],
      [0.0009, 0.0013, 0.0009],
      { segments: 10, radial: 5, closeTip: true, closeStart: true },
    ),
  );

  // -- ears: a flattened leaf pointing out, up a little and swept back, a rim tube along its edges and a darker concha --
  for (const s of [1, -1] as const) {
    const dir = new Vector3(s * Math.cos(0.12) * Math.cos(0.55), Math.sin(0.12), -Math.cos(0.12) * Math.sin(0.55)).normalize();
    const up = new Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
    let nrm = new Vector3().crossVectors(dir, up).normalize();
    if (nrm.z < 0) nrm = nrm.negate();
    const base = new Vector3(s * r * 0.95, 0.006, -0.012);
    const L = 0.072;
    /** ear frame: local x = the thin axis (front), y = along the ear, z = its in-plane up */
    const frame = () => new Matrix4().makeBasis(nrm, dir, up).setPosition(base.x, base.y, base.z);
    const cone = new ConeGeometry(0.0215, L, 10);
    cone.applyMatrix4(_m4.makeScale(0.5, 1, 1));
    cone.applyMatrix4(_m4.makeTranslation(0, L / 2 - 0.008, 0));
    cone.applyMatrix4(frame());
    parts.push(flatUv(cone, UV_SKIN));
    const concha = new ConeGeometry(0.0145, L * 0.6, 8);
    concha.applyMatrix4(_m4.makeScale(0.5, 1, 1));
    concha.applyMatrix4(_m4.makeTranslation(0.0045, L * 0.3 - 0.004, -0.001));
    concha.applyMatrix4(frame());
    parts.push(flatUv(concha, UV_EAR));
    // rims: top edge (a thick helix) and bottom edge (thinner), in the ear's local frame (x thin, y along, z up)
    const rimTop = sweep([new Vector3(0, -0.004, 0.02), new Vector3(0, L * 0.45, 0.013), new Vector3(0, L - 0.009, 0.001)], [0.0034, 0.0028, 0.0013], { segments: 10, radial: 6, closeTip: true, closeStart: true });
    rimTop.applyMatrix4(frame());
    parts.push(flatUv(rimTop, UV_SKIN));
    const rimLow = sweep([new Vector3(0, -0.002, -0.019), new Vector3(0, L * 0.45, -0.012), new Vector3(0, L - 0.011, -0.001)], [0.0026, 0.0022, 0.001], { segments: 10, radial: 6, closeTip: true, closeStart: true });
    rimLow.applyMatrix4(frame());
    parts.push(flatUv(rimLow, UV_SKIN));
  }
  part(head, merge(parts), skinTex, 'skull');
  part(head, merge(lash), kidMat('lash', KID.lash, 0.7), 'lashes', false);

  // -- eyeballs on the blink group: the pivot at the upper lid line, so the Y-squash folds the balls up under the lid --
  const eyes = new Group();
  eyes.name = 'eye';
  const lidY = EYE_Y + LID_TOP * EYE_R;
  eyes.position.set(0, lidY, 0);
  head.add(eyes);
  const balls = [1, -1].map((s) => {
    const c = eyeCentre(s);
    return place(new SphereGeometry(EYE_R, 18, 12), c.x, c.y - lidY, c.z);
  });
  part(eyes, merge(balls), eyeMaterial(KID.iris[look]), 'eyeballs', false);
  rig.eyes.push(eyes);
}

/** re-lay a sweep's UVs for the hair canvas: the strands run along the tube (v), a lock's width of the canvas wraps around it (u) */
function clumpUv(geo: BufferGeometry): BufferGeometry {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const along = uv.getX(i);
    const around = uv.getY(i);
    uv.setXY(i, around * 0.16, 0.85 - 0.5 * along);
  }
  return geo;
}

/**
 * Hair (round 48, widened for lane 7): four overlapping shells in one mesh — the bob body (open
 * at the face, hem flared for volume and cut ragged, its outline below the band broken into
 * seven soft lobes), the crown volume above the headband, a pointed fringe hanging from under the
 * band to the brows, side locks framing the face at the bob's cut edge — plus the brow tubes
 * (same colour, same joint, so they ride in the same submission). Every part carries UVs onto the
 * hair canvas (`girlHair`): the spheres their own, the fringe a grid, the clumps `clumpUv`.
 */
function buildGirlHair(rig: Rig, hair: MeshStandardMaterial): void {
  const r = rig.props.headRadius;
  const k = r / 0.125;
  const clump = (from: [number, number, number], mid: [number, number, number], to: [number, number, number], r0: number, r1: number, tip = 0.004) =>
    clumpUv(sweep([new Vector3(...from).multiplyScalar(k), new Vector3(...mid).multiplyScalar(k), new Vector3(...to).multiplyScalar(k)], [r0 * k, r1 * k, tip * k], { segments: 8, radial: 7, closeTip: true, closeStart: true }));
  // bob body: back and sides down past the jaw, open at the face; the hem flares and is cut ragged;
  // below the band the radius carries seven soft lobes so the silhouette reads as locks, not a helmet
  const bobR = r * 1.16;
  const bob = new SphereGeometry(bobR, 28, 14, Math.PI / 2 + 0.78, Math.PI * 2 - 1.56, 0, Math.PI * 0.76);
  {
    const pos = bob.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const th = Math.acos(Math.max(-1, Math.min(1, y / bobR)));
      const a = Math.atan2(z, x);
      const hem = Math.max(0, (th - Math.PI * 0.5) / (Math.PI * 0.26));
      const flare = 1 + 0.2 * Math.pow(hem, 1.5);
      const lobes = 1 + 0.04 * Math.cos(7 * a + 0.4) * sstep(0.33, 0.6, th / Math.PI);
      let yy = y;
      if (th > Math.PI * 0.74) yy -= 0.01 * (0.5 + 0.5 * Math.sin(a * 7.0 + 1.3));
      pos.setXYZ(i, x * flare * lobes, yy, z * flare * lobes);
    }
    pos.needsUpdate = true;
    bob.computeVertexNormals();
  }
  const parts: BufferGeometry[] = [place(bob, 0, -0.004, -0.016, undefined, [1.04, 1, 1.02])];
  // crown: a fuller dome above the band (its edge hides inside the band: at the band's height the
  // dome is 0.14 m across against the band's 0.15, at the back too, where the band dips)
  parts.push(place(new SphereGeometry(r * 1.18, 26, 9, 0, Math.PI * 2, 0, Math.PI * 0.36), 0, 0.012, -0.008, undefined, [1.0, 0.95, 1.04]));
  // fringe: a shell over the forehead from under the band down to the brows, its hem cut into points
  const fringeC = new Vector3(0, 0.012, 0.004);
  const fringeR = r * 1.065;
  const points = 6;
  parts.push(
    shell(
      fringeC,
      fringeR,
      0.88,
      () => Math.PI * 0.29,
      // hem 3.7–4.8 cm above the eye line: the points reach the brows, the brows show between them
      (psi) => Math.PI * (0.415 + 0.028 * (0.5 - 0.5 * Math.cos((psi / 0.88) * Math.PI * points + 0.6))),
      24,
      8,
      // its 1.76 rad of the head's circumference onto the canvas (u = 0.28 of the locks), strands running down
      (sx, sy) => [0.36 + 0.28 * sx, 0.92 - 0.5 * sy],
    ),
  );
  // side locks: from under the band at the bob's cut edge (flush with the bob there), out past the
  // cheek — 5 mm clear of it — and down to the jaw, framing the face; two tufts at the nape under the bob
  parts.push(clump([0.088, 0.052, 0.077], [0.115, -0.03, 0.1], [0.112, -0.115, 0.096], 0.027, 0.026, 0.009));
  parts.push(clump([-0.088, 0.052, 0.077], [-0.115, -0.03, 0.1], [-0.112, -0.115, 0.096], 0.027, 0.026, 0.009));
  parts.push(clump([0.045, -0.06, -0.1], [0.052, -0.1, -0.096], [0.042, -0.135, -0.08], 0.024, 0.018));
  parts.push(clump([-0.045, -0.06, -0.1], [-0.052, -0.1, -0.096], [-0.042, -0.135, -0.08], 0.024, 0.018));
  // brows: arched tubes just proud of the skull, thicker at the inner end, 2–3 cm over the lid line
  // (under the fringe's points, visible between them)
  for (const s of [1, -1] as const) {
    const pts = [
      new Vector3(s * 0.017, 0.021, skullZ(r, 0.017, 0.021, 0.0022)),
      new Vector3(s * 0.04, 0.03, skullZ(r, 0.04, 0.03, 0.0024)),
      new Vector3(s * 0.064, 0.026, skullZ(r, 0.064, 0.026, 0.0022)),
    ];
    parts.push(sweep(pts, [0.0032, 0.0034, 0.0018], { segments: 8, radial: 6, closeTip: true, closeStart: true }));
  }
  part(rig.head, merge(parts), hair, 'hair');
}

/**
 * The wide green headband of the demo girl (d_024, ref-01): an open, slightly flared ring around
 * the head above the brows — the fringe hangs from under it, the maroon crown shows above it,
 * and it dips a little at the back. Rigid on the head (no `rig.cap` nudge — a band does not flop).
 */
function buildGirlHeadband(rig: Rig, bandMat: MeshStandardMaterial): void {
  const r = rig.props.headRadius;
  const k = r / 0.125;
  const R = r * 1.1 + 0.007;
  const band = new CylinderGeometry(R * 1.01, R * 1.035, 0.046 * k, 28, 1, true);
  // a thin rolled edge top and bottom so the band reads as cloth, not a painted stripe
  const geo = merge([
    band,
    place(new TorusGeometry(R * 1.01, 0.006, 6, 28), 0, 0.023 * k, 0, [Math.PI / 2, 0, 0]),
    place(new TorusGeometry(R * 1.035, 0.006, 6, 28), 0, -0.023 * k, 0, [Math.PI / 2, 0, 0]),
  ]);
  // no shadow pass: the band's shadow falls on the hair a centimetre under it (a submission saved per girl, like the belt's)
  part(rig.head, place(geo, 0, 0.073 * k, -0.005, [-0.1, 0, 0], [1, 1, 0.97]), bandMat, 'kid-headband', false);
}

/** dark leather wristbands on the bare forearms (both wrists, like the demo girl) */
function buildWristbands(rig: Rig, leather: MeshStandardMaterial): void {
  const p = rig.props;
  for (const elbow of [rig.elbowL, rig.elbowR]) part(elbow, place(new CylinderGeometry(0.037, 0.036, 0.024, 10), 0, -p.forearm + 0.016, 0), leather, 'wristband', false);
}

/**
 * An open skirt panel: the (radius, y) profile revolved over the angle range [a0, a1] (angle a
 * measured from +X toward +Z, so the front centre is π/2), oval in Z, with fold ridges and a
 * scalloped, ragged hem like `ovalLathe`. Rows hem→top; UVs (u = a / 2π, so the cloth canvas's
 * fold valleys land in the panel's own — whatever range the panel spans; v up).
 */
function skirtPanel(profile: [number, number][], a0: number, a1: number, segments: number, opts: { scaleZ: number; folds: number; foldDepth: number; scallops: number; scallopDepth: number; ragged: number; seed: number; radiusScale?: number }): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const hemY = profile[0][1];
  const topY = profile[profile.length - 1][1];
  const rs = opts.radiusScale ?? 1;
  for (let j = 0; j < profile.length; j++) {
    const [pr, y] = profile[j];
    const w = Math.pow(Math.min(1, Math.max(0, (topY - y) / Math.max(1e-6, topY - hemY))), 1.5);
    for (let i = 0; i <= segments; i++) {
      const a = a0 + ((a1 - a0) * i) / segments;
      const f = 1 + opts.foldDepth * w * Math.cos(opts.folds * a + 0.7);
      const rr = pr * rs * f;
      let yy = y;
      if (j === 0) {
        yy += opts.scallopDepth * (0.5 - 0.5 * Math.cos(opts.scallops * a));
        const h = Math.sin(a * 13.7 + opts.seed) * 0.5 + 0.5;
        yy += opts.ragged * h;
      }
      positions.push(Math.cos(a) * rr, yy, Math.sin(a) * rr * opts.scaleZ);
      uvs.push(a / (Math.PI * 2), j / (profile.length - 1));
    }
  }
  const col = segments + 1;
  for (let j = 0; j < profile.length - 1; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * col + i;
      const b = a + col;
      // a → a+1 runs toward +a (leftward seen from outside at the front), b is the row above: wind outward
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sleeveless deep-green tunic (bare arms from buildArms), a soft collar, a leather belt with a
 * buckle and the skirt (round 48): the waist ring and the back / side panel hang from the hips,
 * the two FRONT flaps ride on the thigh joints (each spans from the centre line past the hip,
 * overlapping the other at the centre) so they follow the legs — draped on the thighs when
 * seated, swinging with the stride, never poked through by a knee.
 */
function buildGirlTunic(rig: Rig, tunic: MeshStandardMaterial): void {
  const p = rig.props;
  const hl = (y: number) => y - p.hipY;
  const cl = (y: number) => y - p.chestY;
  // upper: waist → chest → shoulders → neck opening, a little barrel-chested like a child; four
  // shallow fold ridges rising from the waist (lane 7), with the lathe's UVs turned to the skirt
  // panels' convention (u = atan2(z, x) / 2π) so the cloth canvas's valleys fall in the lathe's own
  const upper = ovalLathe(
    [
      [0.096, cl(0.55)],
      [0.1, cl(0.62)],
      [0.108, cl(0.7)],
      [0.114, cl(0.76)],
      [0.106, cl(0.79)],
      [0.055, cl(0.805)],
    ],
    { segments: 22, scaleZ: 0.76, folds: 4, foldDepth: 0.04 },
  );
  {
    const uv = upper.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 0.25 - uv.getX(i));
  }
  part(
    rig.chest,
    merge([
      upper,
      // soft collar
      place(new TorusGeometry(0.066, 0.012, 8, 20), 0, cl(0.8), 0.004, [Math.PI / 2 - 0.2, 0, 0], [1, 1, 0.82]),
    ]),
    tunic,
    'kid-tunic-upper',
  );
  // skirt profile (radius, y above the hips joint): hem at mid-thigh, top under the belt (which hides the seam with the torso)
  const profile: [number, number][] = [
    [0.15, hl(0.33)],
    [0.128, hl(0.42)],
    [0.11, hl(0.47)],
    [0.1, hl(0.52)],
    [0.097, hl(0.575)],
  ];
  const opts = { scaleZ: 0.8, folds: 4, foldDepth: 0.06, scallops: 4, scallopDepth: 0.045, ragged: 0.012, seed: 31 };
  const front = Math.PI / 2;
  // hips: the back / side panel (everything but the front ±0.98 rad, a hair outside the flaps) plus the front of the waist ring above the hip joints
  const back = skirtPanel(profile, front + 0.98, front + Math.PI * 2 - 0.98, 22, { ...opts, radiusScale: 1.01 });
  const waist = skirtPanel([profile[2], profile[3], profile[4]], front - 1.1, front + 1.1, 12, { ...opts, scallopDepth: 0, ragged: 0, radiusScale: 0.99 });
  part(rig.hips, merge([back, waist]), tunic, 'kid-tunic-skirt');
  // thighs: the front flaps, from the hem up to just above the hip joint, one overlapping the other at the centre
  for (const side of [1, -1] as const) {
    const thigh = side > 0 ? rig.thighL : rig.thighR;
    const a0 = side > 0 ? front - 1.05 : front - 0.2;
    const a1 = side > 0 ? front + 0.2 : front + 1.05;
    const flap = skirtPanel([profile[0], profile[1], profile[2], [0.107, 0.012]], a0, a1, 10, { ...opts, radiusScale: side > 0 ? 1 : 0.985 });
    // hips space → thigh space (the thigh joint sits at ± hipHalfWidth on the hips)
    flap.applyMatrix4(_m4.makeTranslation(-side * p.hipHalfWidth, 0, 0));
    part(thigh, flap, tunic, 'kid-tunic-flap');
  }
  // leather belt at the waist with a small square buckle at the front
  const y = hl(0.555);
  part(rig.hips, place(new TorusGeometry(0.104, 0.015, 8, 26), 0, y, 0, [Math.PI / 2, 0, 0], [1, 1, 0.8]), kidMat('belt', KID.belt), 'kid-belt', false);
  part(rig.hips, merge([place(new BoxGeometry(0.036, 0.03, 0.008), 0, y, 0.088), place(new BoxGeometry(0.006, 0.03, 0.01), 0, y, 0.09)]), kidMat('buckle', KID.buckle, 0.6), 'kid-buckle', false);
}

/** the round-1 boy: near-black sleeveless tunic, rope belt, headband, bob, pouch, Deku Stick */
function buildBoy(rig: Rig, variant: number, skin: MeshStandardMaterial): void {
  const p = rig.props;
  const tunic = tinted('kidTunic', variant, 0.01 * (variant % 2), 1 + 0.12 * (variant % 2));
  const hair = tinted('kidHair', variant, -0.01 * (variant % 3), 1 - 0.1 * (variant % 2));
  buildArms(rig, { skin, sleeve: null });
  const hl = (y: number) => y - p.hipY;
  const cl = (y: number) => y - p.chestY;
  part(
    rig.hips,
    ovalLathe(
      [
        [0.13, hl(0.37)],
        [0.115, hl(0.46)],
        [0.102, hl(0.54)],
        [0.1, hl(0.6)],
      ],
      { segments: 22, scaleZ: 0.78, raggedHem: 0.025, seed: 21 + variant },
    ),
    tunic,
    'kid-tunic-skirt',
  );
  part(
    rig.chest,
    ovalLathe(
      [
        [0.098, cl(0.56)],
        [0.104, cl(0.65)],
        [0.115, cl(0.72)],
        [0.112, cl(0.77)],
        [0.07, cl(0.79)],
        [0.05, cl(0.805)],
      ],
      { segments: 22, scaleZ: 0.74 },
    ),
    tunic,
    'kid-tunic-upper',
  );
  const rope = merge([
    place(new TorusGeometry(0.106, 0.009, 6, 26), 0, hl(0.565), 0, [Math.PI / 2, 0, 0], [1, 1, 0.8]),
    place(new TorusGeometry(0.106, 0.007, 6, 26), 0, hl(0.58), 0, [Math.PI / 2, 0, 0], [1, 1, 0.8]),
    place(new CylinderGeometry(0.008, 0.008, 0.07, 6), 0.02, hl(0.535), 0.088, [0.2, 0, 0.15]),
    place(new CylinderGeometry(0.008, 0.008, 0.06, 6), -0.015, hl(0.54), 0.09, [0.2, 0, -0.1]),
  ]);
  part(rig.hips, rope, matte('kidRope'), 'kid-rope-belt', false);
  buildFace(rig, { skin, iris: matte('irisKid', { roughness: 0.3 }), earLength: 0.07 });
  buildHair(rig, hair, 'bob');
  const band = tinted('kidHeadband', variant, 0.03 * (variant % 3), 1);
  part(rig.head, place(new TorusGeometry(p.headRadius * 1.1, 0.011, 6, 26), 0, 0.032, 0.004, [Math.PI / 2 - 0.12, 0, 0], [1, 1, 0.98]), band, 'kid-headband', false);
  part(rig.hips, place(new BoxGeometry(0.05, 0.05, 0.03), -0.09, hl(0.52), 0.04, [0, 0.4, 0]), matte('leatherDark'), 'kid-pouch', false);
  // a Deku Stick held in the right hand like a staff (butt near the ground)
  const handY = -p.forearm - 0.02;
  const stick = merge([place(new CylinderGeometry(0.011, 0.014, 0.95, 7), 0, handY - 0.02, 0.03), place(new CylinderGeometry(0.017, 0.011, 0.05, 7), 0, handY + 0.44, 0.03)]);
  part(rig.elbowR, place(stick, 0, 0, 0, [0.1, 0, 0.05]), matte('stick'), 'deku-stick');
}

/**
 * The kids' heads are built at the rig's radius and the head joint (pivoted at the head centre)
 * is scaled up (lane 7): head + hair become a third of the height — the footage's chibi read
 * (ref-01: the girl's head and bob are 34 % of her) — with the face, hair and band tuned at
 * 0.13 m growing together. The skull's underside then meets the shoulder line, as in d_024
 * (the neck is inside it), and the collar tucks under the bob's hem.
 */
const HEAD_SCALE = 1.14;

export function createKokiri(variant: number): Character {
  beginTally();
  const rig = buildRig(KOKIRI_CHILD_PROPORTIONS, `kokiri-${variant}`);
  rig.head.scale.setScalar(HEAD_SCALE);
  const p = rig.props;
  const girl = variant !== 2;
  const look = girlLook(variant);
  const skin = girl ? girlSkin(look) : kidMat(`skin-${variant}`, BOY_SKIN);
  const boot = kidMat('boot', girl ? KID.boot : CHAR_COLORS.kidBoot);
  // boots to just under the knee; the girls' near-black boots have a khaki fold-over cuff
  buildLegs(rig, { skin, boot, cuff: girl ? kidMat('cuff', KID.cuff) : null, shaftTop: p.kneeY - p.ankleY - 0.03 });
  buildNeck(rig, skin);
  if (girl) {
    buildArms(rig, { skin, sleeve: null });
    buildWristbands(rig, kidMat('belt', KID.belt));
    buildGirlTunic(rig, girlCloth(look));
    buildGirlFace(rig, look);
    buildGirlHair(rig, girlHair(look));
    buildGirlHeadband(rig, kidMat(`band-${look}`, KID.band[look]));
  } else buildBoy(rig, variant, skin);
  // shadow pass (lane 7): the neck sits inside the scaled skull and a boot cuff's shadow falls on the
  // shaft two centimetres under it — neither can shadow a visible pixel; three submissions per kid
  rig.root.traverse((o) => {
    if ((o as Mesh).isMesh && (o.name === 'neck' || o.name === 'boot-cuff')) o.castShadow = false;
  });
  rig.root.userData.character = 'kokiri';
  // to the crown of the hair: skull top 1.06 + the scaled crown (girl: the dome reaches 0.158 · 1.14 over the head centre)
  return { kind: 'kokiri', rig, group: rig.root, triangles: endTally(), height: girl ? 1.12 : 1.13 };
}
