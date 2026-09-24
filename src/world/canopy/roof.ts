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
/**
 * minimum height of a clump above the ground under it (m): never in a walker's face on the
 * plateau, and above the near-canopy layer's reach (fable-cursor's condition: the roof stays
 * above 20 m so trees-30's near lobes and distant-1's far crowns never double up with it)
 */
export const ROOF_MIN_ABOVE_GROUND_M = 20;
/** clump count = grid cells × this share where the field says "roof"; the clumped field's threshold */
export const ROOF_FIELD_THRESHOLD = 0.22;
/** card size (m) of a clump's cards and how many cards a clump carries */
export const ROOF_CARD_M: [number, number] = [2.6, 4.4];
export const ROOF_CARDS_PER_CLUMP: [number, number] = [3, 5];
/** hero-frame exclusion: a clump whose cards project inside a hero frame nearer than this (m) is dropped */
export const HERO_DROP_M = 120;
/** frame margin (share of the frame) added around the hero frames for the exclusion */
export const HERO_MARGIN = 0.03;
/**
 * …except across the frames' top edge, which a roof is the only thing that can reach. The exclusion
 * as written drops every clump projecting anywhere inside a hero frame within 120 m, and since a roof
 * hangs 20–37 m up, "anywhere" is in practice the top band — so the airspace over the plaza's northern
 * approach (z ≈ −20…−52) had no roof at all, while the stand pass that would have covered it starts at
 * z ≤ −52 (ROOF_STAND_BOUNDS). Looking up from the open north therefore showed haze where the canopy
 * should close (lane 2's diagnosis, `art/environment/squad2-2026-09-23/upring`).
 *
 * A clump whose projected disc stays inside this share of a frame's height from its top edge is kept.
 * The hero frames already carry canopy along that edge — hero A's top third is foliage — and so does
 * the reference (r_025, r_026, d_108 all close over the top of the image), so this is the band where a
 * roof belongs rather than one it must be kept out of. Everything below it still drops.
 */
export const HERO_TOP_KEEP = 0.18;

/**
 * The north stand (round 52, GOAL_MODE owner-fable #3; opus-review #01 "no canopy over them",
 * the owner's "deep world through the arch"): the far forest beyond the log arch is fable-4's
 * depth bands of 26 m poles — flanks either side of the north clearing (|x| 12–34, z −82…−64),
 * a back stand behind the ledge terrace (|x| ≤ 12, z −90…−81) — and the two older rows at
 * z −61…−55 (trees/index.ts DEPTH_BANDS). Those poles carry a small crown 18 m+ up and nothing
 * closes over them or over the clearing; the roof's giants list does not reach there (the
 * nearest giant is north-east at (15, 2, −37)). These authored bands give the roof support over
 * the stand: a rectangle (world x / z), the height the roof hangs above the local ground
 * (22 m: a 26 m pole × 0.85–1.1 scale is 22–29 m tall with its small crown centred at ≈ 0.7 of
 * that, 15–20 m up — the roof is the layer OVER those crowns, as it is over the giants'), and a
 * feather (m) over which the support fades outside the rectangle — 20 m on the flanks and the
 * back stand: at the clearing's centre (10.5 m from the west flank) the support is 0.46, at its
 * east edge ≈ 0.25, so about half the cells over the clearing build and it closes with hazy
 * gaps rather than a solid lid or open sky (at 14 m — 0.16 at the centre — five clumps hung over
 * the clearing and its sky stayed mostly open; the six views paid nothing either way: measured
 * in the PR). Read only by the stand pass (buildRoof `stand`), which draws from its own stream
 * and writes its own sector mesh, so the plaza roof's clumps and cards are byte-identical with
 * or without it.
 */
export interface RoofStandBand {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  /** crown centre height above the local ground (m) */
  crownAbove: number;
  /** support fade outside the rectangle (m) */
  feather: number;
}
export const ROOF_STAND_BANDS: readonly RoofStandBand[] = [
  { xMin: -34, xMax: -12, zMin: -82, zMax: -64, crownAbove: 22, feather: 20 },
  { xMin: 12, xMax: 34, zMin: -82, zMax: -64, crownAbove: 22, feather: 20 },
  { xMin: -12, xMax: 12, zMin: -90, zMax: -81, crownAbove: 22, feather: 20 },
  { xMin: -34, xMax: 48, zMin: -61, zMax: -55, crownAbove: 21, feather: 10 },
  // 2026-09-24, the south exit (lane 5's expansion, the owner's "more of the video's world"): a
  // walker who crosses the rope bridge and looks up at the log's mouth sees the forest's crowns end
  // in a line with bare sky over it — the plaza grid stops at z 40 (ROOF_BOUNDS) and no giant reaches
  // there, so nothing closes over the far bank. Two bands: the far bank either side of the path, and
  // the mouth itself, both hanging at the height the south trees' crowns carry.
  { xMin: -16, xMax: 26, zMin: 41, zMax: 54, crownAbove: 22, feather: 16 },
  { xMin: -6, xMax: 16, zMin: 54, zMax: 62, crownAbove: 21, feather: 12 },
];
/**
 * the stand pass's own grid bounds (world x / z): from the back stand to 3 m south of the rows
 * band. It OVERLAPS the plaza grid (zMin −70) over z −70…−52: there the plaza pass builds only
 * where a giant supports it and the stand pass only where a band does, and a stand cell a giant
 * already covers (support > ROOF_STAND_GIANT_SKIP) is skipped, so the two passes never stack. A
 * first cut ended the stand grid at −70: the flanks' south third and the whole rows band were
 * never sampled and the roof stopped in a straight seam across the clearing (found by review).
 */
export const ROOF_STAND_BOUNDS = { xMin: -46, xMax: 52, zMin: -96, zMax: -52 } as const;
/**
 * …and the south bank's own grid, sampled AFTER the north's so every north clump draws exactly what it
 * drew before this existed. It covers the far side of the ravine and the log's mouth, the airspace the
 * south bands above support; the plaza grid ends at z 40 and the giants do not reach, so without this
 * the canopy simply stopped in a line over the new exit.
 */
export const ROOF_SOUTH_BOUNDS = { xMin: -20, xMax: 30, zMin: 40, zMax: 64 } as const;
/** the stand pass's grids, in the order it samples them */
export const ROOF_STAND_GRIDS = [ROOF_STAND_BOUNDS, ROOF_SOUTH_BOUNDS] as const;
/** a stand cell whose giant support exceeds this is the plaza pass's (skipped here) */
export const ROOF_STAND_GIANT_SKIP = 0.5;
/**
 * the stand's cards are this much larger than the plaza roof's and each clump carries one more:
 * the stand is seen from below at 20–30 m and from the arch at 50–80 m in the haze, and at the
 * plaza's card size a clump covered about a third of its 3.6 m cell — five clumps over the
 * clearing left its sky mostly open (feather 14 and 20 alike: the clump count there is the
 * noise field's, not the feather's). Read in the card loop for stand clumps only, after every
 * plaza card has drawn, so the plaza roof's cards are byte-identical.
 */
export const ROOF_STAND_CARD_SCALE = 1.35;
export const ROOF_STAND_EXTRA_CARDS = 1;
/**
 * hero-frame exclusion for the stand's clumps (m): the stand is what camera D looks at through
 * the arch (its nearest band point 54 m off; B / E 58 m; A 70 m), so the plaza roof's 120 m rule
 * would build nothing over it. A stand clump inside a hero frame nearer than this is dropped;
 * beyond it the clump stands in the frame's far haze. With the bands as authored the rows band's
 * south edge comes within 50 m of B / E / D, so at 50 this drops the handful of cells there
 * (`stand.dropped.heroFrame`) and the nearest in-frame stand clump sits at ≈ 50 m from B / E / D,
 * 55 from A, 61 from F, none from C (the audit's `stand.nearestHeroM`); the six-view measurement
 * in the PR is what holds the −0.003 budget, and the value moves up if it does not.
 */
export const HERO_DROP_STAND_M = 50;

export interface RoofClump {
  x: number;
  y: number;
  z: number;
  /** cards in this clump */
  cards: number;
  /** true for a clump of the north-stand pass (ROOF_STAND_BANDS); it draws into its own sector */
  stand?: boolean;
}

export interface RoofSector {
  geometry: BufferGeometry;
  cards: number;
  triangles: number;
  /** the north-stand pass's sector (one mesh of its own; the plaza sectors are unchanged by it) */
  stand: boolean;
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
  /** the north-stand pass (ROOF_STAND_BANDS): its own counts; zeros when the pass is off */
  stand: {
    clumps: number;
    cards: number;
    cells: number;
    dropped: { field: number; heroFrame: number; shaft: number; opening: number };
    minAboveGround: number;
    /** per hero viewpoint id: the nearest built stand clump inside that frame (view depth, m), or null when none is */
    nearestHeroM: Record<string, number | null>;
  };
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
  /** build the north-stand pass (default true); false = the plaza roof exactly as before the pass existed */
  stand?: boolean;
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

  /** the nearest built stand clump inside each hero frame (view depth), for the audit */
  const nearestHero: Record<string, number | null> = Object.fromEntries(ctx.layout.viewpoints.map((v) => [v.id, null]));
  const noteHeroDepth = (q: Vector3, halfSize: number) => {
    heroCams.forEach((cam, i) => {
      const s = cam.project(q);
      if (!s) return;
      const th = Math.tan((cam.fov * Math.PI) / 360);
      const dy = halfSize / (s[2] * 2 * th);
      const dx = dy / (16 / 9);
      if (s[0] + dx >= 0 && s[0] - dx <= 1 && s[1] + dy >= 0 && s[1] - dy <= 1) {
        const id = ctx.layout.viewpoints[i].id;
        nearestHero[id] = nearestHero[id] === null ? s[2] : Math.min(nearestHero[id] as number, s[2]);
      }
    });
  };
  const inHeroFrame = (q: Vector3, halfSize: number, dropM = HERO_DROP_M): boolean => {
    for (const cam of heroCams) {
      const s = cam.project(q);
      if (!s || s[2] > dropM) continue;
      const th = Math.tan((cam.fov * Math.PI) / 360);
      const dy = halfSize / (s[2] * 2 * th);
      const dx = dy / (16 / 9);
      // s[1] = 0 is the frame's top edge (see projector): a clump whose whole disc sits within
      // HERO_TOP_KEEP of it is the canopy closing over the frame, not an object in it
      if (s[1] + dy <= HERO_TOP_KEEP) continue;
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
  const plazaClumps = clumps.length;

  // ---- the north-stand pass (ROOF_STAND_BANDS): own stream, own grid, own sector ----
  const standDropped = { field: 0, heroFrame: 0, shaft: 0, opening: 0 };
  let standMinAbove = Infinity;
  if (o.stand ?? true) {
    const rs = rng.fork('roof-build-stand');
    /** support of a band at (x, z): 1 inside its rectangle, fading to 0 `feather` m outside it */
    const bandSupport = (b: RoofStandBand, x: number, z: number) => {
      const dx = Math.max(b.xMin - x, 0, x - b.xMax);
      const dz = Math.max(b.zMin - z, 0, z - b.zMax);
      return 1 - smoothstep(0, b.feather, Math.hypot(dx, dz));
    };
    // ROOF_STAND_GRIDS: the north's rectangle first, then the south bank's, so every north clump draws
    // exactly what it drew before the south existed
    for (const B of ROOF_STAND_GRIDS) {
      const snx = Math.floor((B.xMax - B.xMin) / ROOF_GRID_M);
      const snz = Math.floor((B.zMax - B.zMin) / ROOF_GRID_M);
      for (let iz = 0; iz < snz; iz++) {
        for (let ix = 0; ix < snx; ix++) {
        // the same draws per cell as the plaza pass, from the stand's own stream
        const jx = rs.range(-0.45, 0.45) * ROOF_GRID_M;
        const jz = rs.range(-0.45, 0.45) * ROOF_GRID_M;
        const fieldDraw = rs();
        const cards = rs.int(ROOF_CARDS_PER_CLUMP[0], ROOF_CARDS_PER_CLUMP[1] + 1);
        const yJitter = rs.range(ROOF_BAND_M[0], ROOF_BAND_M[1]);
        const x = B.xMin + (ix + 0.5) * ROOF_GRID_M + jx;
        const z = B.zMin + (iz + 0.5) * ROOF_GRID_M + jz;
        const ground = ctx.terrain.height(x, z);
        // support: the stand bands only; a cell a giant covers (the north-east giant reaches the
        // rows band's east end) belongs to the plaza pass and is skipped, so the passes never stack
        let giantSupport = 0;
        for (const g of giants) {
          const d = Math.hypot(x - g.x, z - g.z);
          giantSupport = Math.max(giantSupport, 1 - smoothstep(g.crownR * ROOF_SUPPORT.inner, g.crownR * ROOF_SUPPORT.outer + ROOF_SUPPORT.plus, d));
        }
        if (giantSupport > ROOF_STAND_GIANT_SKIP) {
          standDropped.field++;
          continue;
        }
        let support = 0;
        let ySum = 0;
        let wSum = 0;
        for (const b of ROOF_STAND_BANDS) {
          const s = bandSupport(b, x, z);
          if (s <= 0) continue;
          support = Math.max(support, s);
          ySum += (ground + b.crownAbove) * s;
          wSum += s;
        }
        if (support <= 0.02) {
          standDropped.field++;
          continue;
        }
        const n = 0.5 + 0.5 * field.fbm(x * 0.09, z * 0.09, 3);
        const keep = n * (0.35 + 0.65 * support) * o.density;
        if (keep < ROOF_FIELD_THRESHOLD || fieldDraw > 0.35 + 0.65 * support) {
          standDropped.field++;
          continue;
        }
        let y = ySum / wSum + yJitter;
        if (y < ground + ROOF_MIN_ABOVE_GROUND_M) y = ground + ROOF_MIN_ABOVE_GROUND_M + Math.max(0, yJitter);
        p.set(x, y, z);
        const halfSize = ROOF_CARD_M[1] * 0.75;
        if (inHeroFrame(p, halfSize, HERO_DROP_STAND_M)) {
          standDropped.heroFrame++;
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
          standDropped.shaft++;
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
          standDropped.opening++;
          continue;
        }
        standMinAbove = Math.min(standMinAbove, y - ground);
        noteHeroDepth(p, halfSize);
        clumps.push({ x, y, z, cards, stand: true });
        }
      }
    }
  }

  // ---- geometry: crossed cards per clump, split into sectors around the plaza for culling; the
  // stand's clumps write their own sector (index sectorCount) so the plaza sectors never change ----
  const sectorCount = Math.max(1, o.sectors ?? 6);
  const [scx, scz] = o.sectorCentre ?? [5, -12];
  const writers = Array.from({ length: sectorCount + 1 }, () => ({ pos: [] as number[], nor: [] as number[], uv: [] as number[], col: [] as number[], root: [] as number[], idx: [] as number[], cards: 0 }));
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
    const sector = c.stand ? sectorCount : ((Math.floor(((ang + Math.PI) / (2 * Math.PI)) * sectorCount) % sectorCount) + sectorCount) % sectorCount;
    const w = writers[sector];
    // one tint per clump (the mass reads as one tree's leaves), cards vary a little inside it
    const tint = canopy
      .clone()
      .lerp(cardR.chance(0.5) ? cool : warm, cardR.range(0, 0.3))
      .multiplyScalar(cardR.range(0.8, 1.08));
    // stand clumps: larger cards and one more each (ROOF_STAND_CARD_SCALE); the plaza clumps come
    // first in `clumps`, so their draws from `cardR` are what they were
    const cardCount = c.cards + (c.stand ? ROOF_STAND_EXTRA_CARDS : 0);
    const sizeScale = c.stand ? ROOF_STAND_CARD_SCALE : 1;
    for (let k = 0; k < cardCount; k++) {
      const size = cardR.range(ROOF_CARD_M[0], ROOF_CARD_M[1]) * sizeScale;
      const tile = cardR.int(0, ROOF_TILES * ROOF_TILES);
      const [u0, v0, u1, v1] = roofTileUv(tile);
      // every card lies nearly flat (a canopy is layered horizontally): a standing card seen
      // from below at an angle read as a black cut-out in the first render (w22-stairs-u), and
      // the material fades a card edge-on anyway (index.ts ROOF_EDGE_FADE)
      const tilt = cardR.range(-0.5, 0.5);
      const spin = cardR.range(0, Math.PI * 2);
      const lift = (k - (cardCount - 1) * 0.5) * cardR.range(0.7, 1.3);
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
    .map((w, i) => ({ w, stand: i === sectorCount }))
    .filter(({ w }) => w.cards > 0)
    .map(({ w, stand }) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(w.pos), 3));
      g.setAttribute('normal', new BufferAttribute(new Float32Array(w.nor), 3));
      g.setAttribute('uv', new BufferAttribute(new Float32Array(w.uv), 2));
      g.setAttribute('color', new BufferAttribute(new Float32Array(w.col), 3));
      g.setAttribute('aRoot', new BufferAttribute(new Float32Array(w.root), 3));
      g.setIndex(w.idx);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return { geometry: g, cards: w.cards, triangles: w.cards * 2, stand };
    });
  const standClumps = clumps.length - plazaClumps;
  const standCards = writers[sectorCount].cards;
  return {
    sectors,
    clumps,
    cards: cardsTotal,
    triangles: cardsTotal * 2,
    dropped,
    minAboveGround: Number.isFinite(minAbove) ? minAbove : 0,
    cells: nx * nz,
    stand: {
      clumps: standClumps,
      cards: standCards,
      cells: o.stand ?? true ? ROOF_STAND_GRIDS.reduce((n, B) => n + Math.floor((B.xMax - B.xMin) / ROOF_GRID_M) * Math.floor((B.zMax - B.zMin) / ROOF_GRID_M), 0) : 0,
      dropped: standDropped,
      minAboveGround: Number.isFinite(standMinAbove) ? standMinAbove : 0,
      nearestHeroM: nearestHero,
    },
  };
}
