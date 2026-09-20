/**
 * Prop materials. Wood uses the credited CC0 `weathered_planks` set through `ctx.textures`
 * (the same maps the fences and the signpost use, so one plank vocabulary runs through the
 * village); clay and rope are ORIGINAL procedural maps generated here as `DataTexture`s in pure
 * JS — no canvas, so `geometry.test.mjs` builds them under Node and the same bytes come out on
 * every machine (the gauntlet's determinism gate, W41).
 *
 * All four materials take vertex colours: the geometry builders paint the terracotta / rim
 * bands, per-board stain, edge wear, contact grime and moss into the `color` attribute, and the
 * maps carry only the fine relief (wheel rings, grain, rope twist).
 */
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace, Texture, Vector2 } from 'three';
import type { WorldContext } from '../system';
import { Noise2D } from '../util/noise';
import { createRng } from '../util/prng';
import { applyShadeFloor, type ShadeFloor } from '../materials/shadeFloor';

export type MaterialKey = 'wood' | 'clay' | 'iron' | 'rope' | 'glow';

/**
 * The light strings' pods: the demo's small yellow-green lights along the banks (frame A at
 * (0.50–0.60, 0.55–0.62) and (0.90–0.95, 0.35–0.40), `d_011`, `d_087`). Emissive peak ≥ 2.0
 * linear, like the lantern pods, so the height fog's far-shade exemption keeps them lit; no halo
 * geometry (the lantern glow language stays with structures / atmosphere).
 */
export const GLOW_EMISSIVE = 0xb8e84a;
export const GLOW_INTENSITY = 2.3;

export interface PropMaterials {
  wood: MeshStandardMaterial;
  clay: MeshStandardMaterial;
  iron: MeshStandardMaterial;
  rope: MeshStandardMaterial;
  glow: MeshStandardMaterial;
  /** which texture sets came from disk (for the audit) */
  sets: string[];
  dispose(): void;
}

/** the plank set: 1024 px = ~2.0 m of wall, twelve boards across (see `boardColumn`) */
export const PLANK_SET = 'weathered_planks';
export const PLANK_METRES = 2.0;
export const PLANK_BOARDS = 12;

/** metres of pot height per repeat of the clay map (32 wheel rings → a ring every ~1.4 cm) */
export const CLAY_REPEAT_METRES = 0.45;
export const ROPE_REPEAT_METRES = 0.06;

/**
 * The plank map is dark: linear mean (0.082, 0.058, 0.044). The boards' vertex colour carries
 * the lift — the lever the signpost's board (×4.5, a sun-bleached tan) and the fences (×0.58, dark
 * weathered posts) both use on this map. Crates and barrels sit between the two: a warm medium
 * brown of ≈ (0.15, 0.08, 0.04) linear (sRGB ≈ #6b5238) before the per-board stain (0.88–1.1)
 * and the edge wear (+22 %). Measured: ×4.2 read as bleached driftwood in the plateau sun.
 */
export const WOOD_TINT: [number, number, number] = [1.85, 1.42, 0.92];
/** linear mean of the plank colour map (measured with sharp over the 1K file) */
export const PLANK_MEAN: [number, number, number] = [0.082, 0.058, 0.044];

/**
 * Shade floors (materials/shadeFloor.ts): what a face gets under the closed roof when the sun
 * does not reach it. The fences' wood runs lift 11 fully textured; the props stand lower and
 * closer to the ground bounce, so a little less. The clay keeps its own colour (texture 1) and a
 * warmer, less leaf-filtered light — a pot in the porch's shade should still read terracotta.
 */
export const WOOD_FLOOR: ShadeFloor = { lift: 9, texture: 1.0, canopy: 1, albedo: 0.1, chroma: 0.5 };
export const CLAY_FLOOR: ShadeFloor = { lift: 4, texture: 1.0, canopy: 0.6, albedo: 0.12, chroma: 0.8 };
export const ROPE_FLOOR: ShadeFloor = { lift: 6, texture: 1.0, canopy: 1, albedo: 0.1, chroma: 0.5 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function makeTexture(data: Uint8Array, size: number, colour: boolean): DataTexture {
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** tangent-space normal map from a periodic height field h(u, v) in [0, 1] (both axes wrap) */
function normalFromHeight(height: Float32Array, size: number, strength: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + ((x + size - 1) % size)];
      const r = height[y * size + ((x + 1) % size)];
      const d = height[((y + size - 1) % size) * size + x];
      const u = height[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (d - u) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz / len) * 0.5 * 255 + 127.5);
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Thrown terracotta: fine horizontal wheel rings (their pitch and depth wander the way a
 * potter's fingers do), a coarser mottle from uneven firing, sparse dark grit, and a few
 * shallow chips. Colour is near-white — the tint is vertex colour — so the same map serves the
 * ochre body and the dark rim band.
 */
export function buildClayMaps(seed: string, size = 512): { color: DataTexture; normal: DataTexture } {
  const rng = createRng(`${seed}/clay`);
  const mottle = new Noise2D(`${seed}/clay-mottle`);
  const grit = new Noise2D(`${seed}/clay-grit`);
  const height = new Float32Array(size * size);
  const colour = new Uint8Array(size * size * 4);
  const rings = 32;
  // per-ring depth / phase so the rings are not a perfect sine (the wheel wobbles)
  const ringDepth: number[] = [];
  const ringPhase: number[] = [];
  for (let i = 0; i < rings; i++) {
    ringDepth.push(0.55 + rng() * 0.45);
    ringPhase.push((rng() - 0.5) * 0.8);
  }
  // chips: (u, v, radius, depth) — tile-safe (kept inside the tile)
  const chips: number[][] = [];
  for (let i = 0; i < 7; i++) chips.push([0.08 + rng() * 0.84, 0.08 + rng() * 0.84, 0.012 + rng() * 0.02, 0.4 + rng() * 0.6]);
  // slip drips: dark runs down the wall from a bead — (u, v0 start, length, half width, strength);
  // v runs bottom → lip, so a drip occupies v0 − len … v0 and tapers toward its lower end
  const drips: number[][] = [];
  for (let i = 0; i < 5; i++) drips.push([rng(), 0.35 + rng() * 0.6, 0.12 + rng() * 0.3, 0.004 + rng() * 0.006, 0.35 + rng() * 0.3]);
  const tone = new Noise2D(`${seed}/clay-tone`);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const ring = v * rings;
    const k = Math.floor(ring) % rings;
    const f = ring - Math.floor(ring);
    // asymmetric ring profile: a slow rise, a sharper fall (the finger's trailing edge)
    const prof = f < 0.62 ? Math.sin((f / 0.62) * Math.PI * 0.5) : Math.cos(((f - 0.62) / 0.38) * Math.PI * 0.5);
    const bx = Math.cos(v * Math.PI * 2);
    const by = Math.sin(v * Math.PI * 2);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // the wheel rings drift slightly around the pot (periodic in u)
      const drift = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 + ringPhase[k]);
      let h = 0.5 + 0.22 * ringDepth[k] * (prof - 0.5) * (0.7 + 0.6 * drift);
      // coarse firing mottle + fine grit; both axes wrap (each embedded on a circle before sampling)
      const ax = Math.cos(u * Math.PI * 2);
      const ay = Math.sin(u * Math.PI * 2);
      const m = mottle.fbm(ax * 1.6 + by * 1.3 + 3.1, ay * 1.6 + bx * 1.3 + 7.7, 3);
      const g = grit.noise(ax * 9 + bx * 7 + 40, ay * 9 + by * 7 + 60);
      h += m * 0.04 + (g > 0.72 ? -0.18 * (g - 0.72) : 0);
      // chips
      for (const [cu, cv, cr, cd] of chips) {
        const du = u - cu;
        const dv = (v - cv) * 1.4;
        const d = Math.hypot(du, dv);
        if (d < cr) h -= cd * 0.35 * (1 - (d / cr) * (d / cr));
      }
      height[y * size + x] = clamp01(h);
      // albedo: near-white with the mottle and a hint of darker grit, lighter in the ring hollows
      const lit = 0.93 + 0.05 * m - 0.12 * (g > 0.72 ? (g - 0.72) * 3 : 0) + 0.04 * (prof - 0.5) * ringDepth[k];
      // firing tone: broad patches where the kiln ran hotter (paler, toward orange) or cooler
      // (darker, toward brown-red) — the second colour a fired pot reads at 1–5 m (fable-5:
      // "pot bodies still one tone"); periodic in both axes like the mottle
      const t = tone.fbm(ax * 0.9 + by * 0.7 + 11.3, ay * 0.9 + bx * 0.7 + 5.9, 2);
      let tr = 1 + 0.26 * t;
      let tg = 1 + 0.18 * t;
      let tb = 1 + 0.09 * t;
      // slip drips: a dark bead run, strongest at the top, thinning toward its lower end
      for (const [du0, v0, len, hw, str] of drips) {
        let du = u - du0;
        du -= Math.round(du);
        const along = (v0 - v) / len;
        if (along < 0 || along > 1) continue;
        const w = hw * (1.15 - 0.9 * along);
        const core = Math.max(0, 1 - Math.abs(du) / w);
        const d = str * core * (1 - along * 0.7);
        tr *= 1 - d * 0.55;
        tg *= 1 - d * 0.62;
        tb *= 1 - d * 0.6;
      }
      const i = (y * size + x) * 4;
      colour[i] = Math.round(clamp01(lit * tr) * 255);
      colour[i + 1] = Math.round(clamp01(lit * 0.985 * tg) * 255);
      colour[i + 2] = Math.round(clamp01(lit * 0.97 * tb) * 255);
      colour[i + 3] = 255;
    }
  }
  return { color: makeTexture(colour, size, true), normal: makeTexture(normalFromHeight(height, size, 3.2), size, false) };
}

/**
 * Three-strand laid rope, in `TubeGeometry`'s uv convention (u = along the tube, one repeat =
 * `ROPE_REPEAT_METRES` = one twist; v = around it): each strand a rounded spiral ridge with
 * fibre fuzz along it. Near-white albedo; the hemp tint is on the material.
 */
export function buildRopeMaps(seed: string, size = 128): { color: DataTexture; normal: DataTexture } {
  const fuzz = new Noise2D(`${seed}/rope-fuzz`);
  const height = new Float32Array(size * size);
  const colour = new Uint8Array(size * size * 4);
  const strands = 3;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // the strands spiral: the ridge phase advances once around per twist along
      const phase = (v * strands + u) % 1;
      const ridge = Math.sin(phase * Math.PI);
      // periodic in both axes: embed each on a circle before sampling the noise
      const ax = Math.cos(v * Math.PI * 2);
      const ay = Math.sin(v * Math.PI * 2);
      const f = fuzz.noise(ax * 3 + Math.cos(u * Math.PI * 2) * 4, ay * 3 + Math.sin(u * Math.PI * 2) * 4);
      const h = 0.5 + 0.38 * (ridge - 0.5) + 0.05 * f;
      height[y * size + x] = clamp01(h);
      const lit = 0.82 + 0.16 * ridge + 0.05 * f;
      const i = (y * size + x) * 4;
      colour[i] = Math.round(clamp01(lit) * 255);
      colour[i + 1] = Math.round(clamp01(lit * 0.96) * 255);
      colour[i + 2] = Math.round(clamp01(lit * 0.88) * 255);
      colour[i + 3] = 255;
    }
  }
  return { color: makeTexture(colour, size, true), normal: makeTexture(normalFromHeight(height, size, 2.2), size, false) };
}

export async function createPropMaterials(ctx: Pick<WorldContext, 'textures' | 'config'>): Promise<PropMaterials> {
  const T = ctx.textures;
  const [plankC, plankN, plankR] = await Promise.all([T.load(PLANK_SET, 'color'), T.load(PLANK_SET, 'normal'), T.load(PLANK_SET, 'roughness')]);
  const clay = buildClayMaps(`${ctx.config.seed}/props`);
  const rope = buildRopeMaps(`${ctx.config.seed}/props`);
  const owned: Texture[] = [clay.color, clay.normal, rope.color, rope.normal];
  const materials: Record<MaterialKey, MeshStandardMaterial> = {
    // the plank map's lift rides in the vertex colour (WOOD_TINT, per board); the material stays white
    wood: new MeshStandardMaterial({ map: plankC, normalMap: plankN, normalScale: new Vector2(1.1, 1.1), roughnessMap: plankR, roughness: 1, color: new Color(0xffffff), vertexColors: true }),
    clay: new MeshStandardMaterial({ map: clay.color, normalMap: clay.normal, normalScale: new Vector2(0.9, 0.9), roughness: 0.88, color: new Color(0xffffff), vertexColors: true }),
    // barely metallic: under the closed roof there is no bright environment for a metal to
    // reflect, and a hoop at metalness 0.55 rendered as a flat black band
    iron: new MeshStandardMaterial({ color: 0x6e6357, roughness: 0.62, metalness: 0.3, vertexColors: true }),
    rope: new MeshStandardMaterial({ map: rope.color, normalMap: rope.normal, normalScale: new Vector2(0.8, 0.8), roughness: 1, color: new Color(0x8f7a52), vertexColors: true }),
    glow: new MeshStandardMaterial({ color: new Color(0x3a3a1e), emissive: new Color(GLOW_EMISSIVE), emissiveIntensity: GLOW_INTENSITY, roughness: 0.5, metalness: 0, vertexColors: true }),
  };
  applyShadeFloor(materials.wood, WOOD_FLOOR, ctx.config.palette.leafSun);
  applyShadeFloor(materials.clay, CLAY_FLOOR, ctx.config.palette.leafSun);
  applyShadeFloor(materials.rope, ROPE_FLOOR, ctx.config.palette.leafSun);
  return {
    ...materials,
    sets: T.loaded().filter((s) => s === PLANK_SET),
    dispose() {
      for (const m of Object.values(materials)) m.dispose();
      for (const t of owned) t.dispose();
    },
  };
}
