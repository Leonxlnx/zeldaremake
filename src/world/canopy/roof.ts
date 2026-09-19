/**
 * Canopy roof placement + geometry (owner-fable, 2026-09-19). Geometry only; the material and
 * the meshes live in `index.ts`.
 *
 * What it is: the upper canopy the reference forest has and the world lacks. From the plaza,
 * the stair and the spine the near lobes of the giants read well when the walker looks up, but
 * between the giants' crowns the sky is open — the giants' own crowns are 10–14 m across and
 * 13–30 m apart. The roof is a layer of leaf-mass clumps at the giants' upper-crown height
 * (20–34 m), dense over each giant's crown and thinning to gaps between distant ones, so that
 * from below the sky shows as hazy gaps between dark leaf masses (reference F / ref-04).
 *
 * What it must not touch (measured contracts of the fixed frames):
 * - it casts no shadow (the meshes in index.ts), so the dapple, the sun pools and the ray mask
 *   read what they read;
 * - it is carved along every god-ray column (`SHAFT_COLUMNS`) and every sun-pool sun line
 *   (`CANOPY_OPENINGS`) exactly as the giants' foliage is (data-only exports of
 *   `trees/corridors.ts`);
 * - any clump that would project inside one of the six hero frames within HERO_DROP_M is not
 *   built (the cameras are pitched 3–4° down: over the plaza a 20 m+ roof enters their frames
 *   only beyond ~65 m, in the haze). The frames keep their pixels; the walker looking up gets a
 *   roof.
 *
 * Deterministic: every draw comes from `rng` in grid order; the clump field is `Noise2D`.
 */
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { CANOPY_OPENINGS, SHAFT_COLUMNS } from '../trees/corridors';
import { ROOF_TILES, roofTileUv } from './atlas';

/** the roof's sampling grid (m) and its bounds (world x / z) — the detail zone plus a margin */
export const ROOF_GRID_M = 3.6;
export const ROOF_BOUNDS = { xMin: -46, xMax: 52, zMin: -70, zMax: 40 } as const;
/**
 * a giant's crown radius as a share of its height (trees/giant.ts: H × 0.44–0.5; the roof reads
 * the layout, not the built tree, so it takes the middle of that range)
 */
export const ROOF_CROWN_SHARE = 0.47;
/** the crown's centre height as a share of the giant's height, and the roof's band around it (m) */
export const ROOF_CROWN_Y_SHARE = 0.86;
export const ROOF_BAND_M: [number, number] = [-2.5, 3.5];
/** support falloff around a giant: full inside `inner` × crown radius, gone at `outer` × crown radius + `plus` m */
export const ROOF_SUPPORT = { inner: 0.85, outer: 2.0, plus: 9 } as const;
/** minimum height of a clump above the ground under it (m): never in a walker's face on the plateau */
export const ROOF_MIN_ABOVE_GROUND_M = 17;
/** clump count = grid cells × this share where the field says "roof"; the clumped field's threshold */
export const ROOF_FIELD_THRESHOLD = 0.22;
/** card size (m) of a clump's cards and how many cards a clump carries */
export const ROOF_CARD_M: [number, number] = [2.6, 4.4];
export const ROOF_CARDS_PER_CLUMP: [number, number] = [3, 5];
/** hero-frame exclusion: a clump whose cards project inside a hero frame nearer than this (m) is dropped */
export const HERO_DROP_M = 120;
/** frame margin (share of the frame) added around the hero frames for the exclusion */
export const HERO_MARGIN = 0.03;

export interface RoofClump {
  x: number;
  y: number;
  z: number;
  /** cards in this clump */
  cards: number;
}

export interface RoofSector {
  geometry: BufferGeometry;
  cards: number;
  triangles: number;
}

export interface RoofBuild {
  sectors: RoofSector[];
  clumps: RoofClump[];
  cards: number;
  triangles: number;
  /** candidates dropped per rule */
  dropped: { field: number; heroFrame: number; shaft: number; opening: number; lowGround: number };
  /** minimum clump height above the ground under it (m) */
  minAboveGround: number;
  /** the sampling grid's cell count */
  cells: number;
}

export interface RoofOptions {
  /** unit vector toward the sun (world) */
  sunDir: Vector3;
  /** 0..1 multiplier on the clump count (quality density) */
  density: number;
  /** number of sector meshes the cards are split into (frustum culling) */
  sectors?: number;
  /** centre of the sector split (world x, z) */
  sectorCentre?: [number, number];
}

/**
 * Pinhole projection matching three.js PerspectiveCamera (vertical fov, lookAt with +Y up) —
 * the same rule as trees/placement.ts viewProjector, duplicated here so this system imports
 * nothing but data from the trees directory.
 */
function projector(position: Vector3, target: Vector3, fov: number, aspect: number) {
  const forward = target.clone().sub(position).normalize();
  const right = new Vector3(-forward.z, 0, forward.x).normalize();
  const up = new Vector3().crossVectors(right, forward);
  const th = Math.tan((fov * Math.PI) / 360);
  const d = new Vector3();
  return (p: Vector3): [number, number, number] | null => {
    d.subVectors(p, position);
    const z = d.dot(forward);
    if (z <= 0.05) return null;
    return [0.5 + (0.5 * (d.dot(right) / z)) / (th * aspect), 0.5 - (0.5 * (d.dot(up) / z)) / th, z];
  };
}

export function buildRoof(ctx: WorldContext, rng: Rng, o: RoofOptions): RoofBuild {
  const r = rng.fork('roof-build');
  const field = new Noise2D('canopy-roof-field');
  const giants = ctx.layout.giantTrees.map((g) => ({
    x: g.position[0],
    z: g.position[2],
    crownR: g.height * ROOF_CROWN_SHARE,
    crownY: g.position[1] + g.height * ROOF_CROWN_Y_SHARE,
  }));
  const sunDir = o.sunDir.clone().normalize();
  const heroCams = ctx.layout.viewpoints.map((v) => ({
    project: projector(new Vector3(v.position[0], v.position[1], v.position[2]), new Vector3(v.target[0], v.target[1], v.target[2]), v.fov, 16 / 9),
    fov: v.fov,
  }));
  const dropped = { field: 0, heroFrame: 0, shaft: 0, opening: 0, lowGround: 0 };
  const clumps: RoofClump[] = [];
  const tmp = new Vector3();
  const p = new Vector3();

  /** perpendicular distance from `q` to the sun line through `a` */
  const sunLineDistance = (q: Vector3, a: Vector3): number => {
    tmp.subVectors(q, a);
    tmp.addScaledVector(sunDir, -tmp.dot(sunDir));
    return tmp.length();
  };
  const shafts = SHAFT_COLUMNS.map((c) => ({ point: new Vector3(c.point[0], c.point[1], c.point[2]), radius: c.carve ?? c.radius }));
  const openings = CANOPY_OPENINGS.map((c) => ({ point: new Vector3(c.point[0], ctx.terrain.height(c.point[0], c.point[1]), c.point[1]), radius: c.radius, yMin: c.band[0] }));

  const inHeroFrame = (q: Vector3, halfSize: number): boolean => {
    for (const cam of heroCams) {
      const s = cam.project(q);
      if (!s || s[2] > HERO_DROP_M) continue;
      const th = Math.tan((cam.fov * Math.PI) / 360);
      const dy = halfSize / (s[2] * 2 * th);
      const dx = dy / (16 / 9);
      if (s[0] + dx >= -HERO_MARGIN && s[0] - dx <= 1 + HERO_MARGIN && s[1] + dy >= -HERO_MARGIN && s[1] - dy <= 1 + HERO_MARGIN) return true;
    }
    return false;
  };

  const nx = Math.floor((ROOF_BOUNDS.xMax - ROOF_BOUNDS.xMin) / ROOF_GRID_M);
  const nz = Math.floor((ROOF_BOUNDS.zMax - ROOF_BOUNDS.zMin) / ROOF_GRID_M);
  let minAbove = Infinity;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      // every cell draws the same numbers whether or not it builds, so a rule change elsewhere
      // never re-rolls the clumps that stay
      const jx = r.range(-0.45, 0.45) * ROOF_GRID_M;
      const jz = r.range(-0.45, 0.45) * ROOF_GRID_M;
      const fieldDraw = r();
      const cards = r.int(ROOF_CARDS_PER_CLUMP[0], ROOF_CARDS_PER_CLUMP[1] + 1);
      const yJitter = r.range(ROOF_BAND_M[0], ROOF_BAND_M[1]);
      const x = ROOF_BOUNDS.xMin + (ix + 0.5) * ROOF_GRID_M + jx;
      const z = ROOF_BOUNDS.zMin + (iz + 0.5) * ROOF_GRID_M + jz;
      // support from the giants: full over a crown, fading to nothing well outside it; the
      // roof's height is the support-weighted crown height
      let support = 0;
      let ySum = 0;
      let wSum = 0;
      for (const g of giants) {
        const d = Math.hypot(x - g.x, z - g.z);
        const inner = g.crownR * ROOF_SUPPORT.inner;
        const outer = g.crownR * ROOF_SUPPORT.outer + ROOF_SUPPORT.plus;
        const s = 1 - smoothstep(inner, outer, d);
        if (s <= 0) continue;
        support = Math.max(support, s);
        ySum += g.crownY * s;
        wSum += s;
      }
      if (support <= 0.02) {
        dropped.field++;
        continue;
      }
      // the clumped field: noise (0.3 cells / m: 3–5 m masses) × support; a fixed threshold, so
      // over a crown the roof is dense and between crowns it opens into gaps
      const n = 0.5 + 0.5 * field.fbm(x * 0.09, z * 0.09, 3);
      const keep = n * (0.35 + 0.65 * support) * o.density;
      if (keep < ROOF_FIELD_THRESHOLD || fieldDraw > 0.35 + 0.65 * support) {
        dropped.field++;
        continue;
      }
      const ground = ctx.terrain.height(x, z);
      let y = ySum / wSum + yJitter;
      if (y < ground + ROOF_MIN_ABOVE_GROUND_M) {
        // the plateau: lift the clump rather than drop it (the roof must not thin over the walk)
        y = ground + ROOF_MIN_ABOVE_GROUND_M + Math.max(0, yJitter);
      }
      p.set(x, y, z);
      const halfSize = ROOF_CARD_M[1] * 0.75;
      if (inHeroFrame(p, halfSize)) {
        dropped.heroFrame++;
        continue;
      }
      let cut = false;
      for (const s of shafts) {
        if (sunLineDistance(p, s.point) < s.radius + halfSize * 0.6) {
          cut = true;
          break;
        }
      }
      if (cut) {
        dropped.shaft++;
        continue;
      }
      for (const op of openings) {
        if (y < op.yMin) continue;
        if (sunLineDistance(p, op.point) < op.radius + halfSize * 0.6) {
          cut = true;
          break;
        }
      }
      if (cut) {
        dropped.opening++;
        continue;
      }
      minAbove = Math.min(minAbove, y - ground);
      clumps.push({ x, y, z, cards });
    }
  }

  // ---- geometry: crossed cards per clump, split into sectors around the plaza for culling ----
  const sectorCount = Math.max(1, o.sectors ?? 6);
  const [scx, scz] = o.sectorCentre ?? [5, -12];
  const writers = Array.from({ length: sectorCount }, () => ({ pos: [] as number[], nor: [] as number[], uv: [] as number[], col: [] as number[], root: [] as number[], idx: [] as number[], cards: 0 }));
  const canopy = new Color(ctx.config.palette.leafCanopy);
  const cool = new Color(0x3a6a44);
  const warm = new Color(0x86a040);
  const cardR = rng.fork('roof-cards');
  const N = new Vector3();
  const U = new Vector3();
  const W = new Vector3();
  const UP = new Vector3(0, 1, 0);
  const X = new Vector3(1, 0, 0);
  let cardsTotal = 0;
  for (const c of clumps) {
    const ang = Math.atan2(c.z - scz, c.x - scx);
    const sector = ((Math.floor(((ang + Math.PI) / (2 * Math.PI)) * sectorCount) % sectorCount) + sectorCount) % sectorCount;
    const w = writers[sector];
    // one tint per clump (the mass reads as one tree's leaves), cards vary a little inside it
    const tint = canopy
      .clone()
      .lerp(cardR.chance(0.5) ? cool : warm, cardR.range(0, 0.3))
      .multiplyScalar(cardR.range(0.8, 1.08));
    for (let k = 0; k < c.cards; k++) {
      const size = cardR.range(ROOF_CARD_M[0], ROOF_CARD_M[1]);
      const tile = cardR.int(0, ROOF_TILES * ROOF_TILES);
      const [u0, v0, u1, v1] = roofTileUv(tile);
      // every card lies nearly flat (a canopy is layered horizontally): a standing card seen
      // from below at an angle read as a black cut-out in the first render (w22-stairs-u), and
      // the material fades a card edge-on anyway (index.ts ROOF_EDGE_FADE)
      const tilt = cardR.range(-0.5, 0.5);
      const spin = cardR.range(0, Math.PI * 2);
      const lift = (k - (c.cards - 1) * 0.5) * cardR.range(0.7, 1.3);
      const offX = cardR.range(-0.35, 0.35) * size;
      const offZ = cardR.range(-0.35, 0.35) * size;
      // normal: up, tilted by `tilt` toward a random azimuth `spin`
      N.set(Math.sin(tilt) * Math.cos(spin), Math.cos(tilt), Math.sin(tilt) * Math.sin(spin)).normalize();
      const ref = Math.abs(N.y) < 0.95 ? UP : X;
      U.crossVectors(N, ref).normalize();
      W.crossVectors(N, U).normalize();
      const roll = cardR.range(0, Math.PI * 2);
      const su = U.clone().multiplyScalar(Math.cos(roll)).addScaledVector(W, Math.sin(roll));
      const sw = W.clone().multiplyScalar(Math.cos(roll)).addScaledVector(U, -Math.sin(roll));
      const cx = c.x + offX;
      const cy = c.y + lift;
      const cz = c.z + offZ;
      const shade = cardR.range(0.88, 1.06);
      const col = tint.clone().multiplyScalar(shade);
      const base = w.pos.length / 3;
      const half = size * 0.5;
      const corners: [number, number, number, number][] = [
        [-1, -1, u0, v0],
        [1, -1, u1, v0],
        [1, 1, u1, v1],
        [-1, 1, u0, v1],
      ];
      for (const [du, dw, u, v] of corners) {
        w.pos.push(cx + su.x * du * half + sw.x * dw * half, cy + su.y * du * half + sw.y * dw * half, cz + su.z * du * half + sw.z * dw * half);
        w.nor.push(N.x, N.y, N.z);
        w.uv.push(u, v);
        w.col.push(col.r, col.g, col.b);
        w.root.push(c.x, c.y, c.z);
      }
      w.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      w.cards++;
      cardsTotal++;
    }
  }
  const sectors: RoofSector[] = writers
    .filter((w) => w.cards > 0)
    .map((w) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(w.pos), 3));
      g.setAttribute('normal', new BufferAttribute(new Float32Array(w.nor), 3));
      g.setAttribute('uv', new BufferAttribute(new Float32Array(w.uv), 2));
      g.setAttribute('color', new BufferAttribute(new Float32Array(w.col), 3));
      g.setAttribute('aRoot', new BufferAttribute(new Float32Array(w.root), 3));
      g.setIndex(w.idx);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return { geometry: g, cards: w.cards, triangles: w.cards * 2 };
    });
  return {
    sectors,
    clumps,
    cards: cardsTotal,
    triangles: cardsTotal * 2,
    dropped,
    minAboveGround: Number.isFinite(minAbove) ? minAbove : 0,
    cells: nx * nz,
  };
}
