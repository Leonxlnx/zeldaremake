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

export type MaterialKey = 'wood' | 'clay' | 'iron' | 'rope';

export interface PropMaterials {
  wood: MeshStandardMaterial;
  clay: MeshStandardMaterial;
  iron: MeshStandardMaterial;
  rope: MeshStandardMaterial;
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
      const i = (y * size + x) * 4;
      colour[i] = Math.round(clamp01(lit) * 255);
      colour[i + 1] = Math.round(clamp01(lit * 0.985) * 255);
      colour[i + 2] = Math.round(clamp01(lit * 0.97) * 255);
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
    // the plank map is a dark grey-brown (~0.35 linear); the tint lifts it toward the
    // reference's warm tan and the per-board vertex colour carries the rest
    wood: new MeshStandardMaterial({ map: plankC, normalMap: plankN, normalScale: new Vector2(1.1, 1.1), roughnessMap: plankR, roughness: 1, color: new Color(0xd8b48c), vertexColors: true }),
    clay: new MeshStandardMaterial({ map: clay.color, normalMap: clay.normal, normalScale: new Vector2(0.9, 0.9), roughness: 0.88, color: new Color(0xffffff), vertexColors: true }),
    iron: new MeshStandardMaterial({ color: 0x3a352c, roughness: 0.68, metalness: 0.6, vertexColors: true }),
    rope: new MeshStandardMaterial({ map: rope.color, normalMap: rope.normal, normalScale: new Vector2(0.8, 0.8), roughness: 1, color: new Color(0xa89468), vertexColors: true }),
  };
  return {
    ...materials,
    sets: T.loaded().filter((s) => s === PLANK_SET),
    dispose() {
      for (const m of Object.values(materials)) m.dispose();
      for (const t of owned) t.dispose();
    },
  };
}
