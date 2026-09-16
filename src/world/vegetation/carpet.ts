/**
 * The turf carpet (round 39). The owner's brief: the lawn must read as a closed carpet — "I
 * shouldn't be able to see each individual blade" — at walking eye height (1.45 m) and from the
 * six fixed cameras, for fewer triangles than the blade tiles alone submit. Frames 21 / 25 / 29 s
 * of the reference: a closed mid-green turf of clumped tufts, no bare ground between the blades,
 * individual blades only at the very edge of the paving.
 *
 * Two alpha-tested instanced sets (lodset.ts), both textured from the seeded clump atlas
 * (clump-atlas.ts) and shaded by the blade tiles' colour pipeline (materials.ts, kind `card`):
 *
 *  - **clump cards**: a fan of three crossed planes (each tilted a little off vertical, two rows
 *    for the wind bend; 12 triangles, 6 at the far LOD) carrying one of six clump tiles — some
 *    200 fine blades over a dense root mass — seated on a jittered CLUMP_CELL grid wherever the
 *    blade tiles grow turf. Wind from `windGrass` with the blades' phase / stiffness encoding.
 *  - **turf mats**: flat cards hugging the ground (tilted to the terrain normal, MAT_LIFT above
 *    it) carrying one of four mat tiles — a ragged blob of short blade dabs — so the ground under
 *    and between the clumps is turf, not the terrain's soil. Static, front faces only.
 *
 * Both follow the blade tiles' zone rules (grass.ts): the paved rims keep a bare band of real
 * blades (the frames' edges), the trodden strip and the stones' walk corridor stay low, camera
 * C's grass box and D's shoulders / hollow are cut like the blades, the giant trunks' litter
 * floors and the NPC clearings thin out, the dark bank masses take the bank darkening. Neither
 * casts shadows (the blade tiles never did); both receive them. Every stream is its own fork
 * (`carpet/…`), so the blade tiles' streams stay bit for bit where they were.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Sphere, Uint16BufferAttribute, Vector3, type Material } from 'three';
import type { WorldContext } from '../system';
import { clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { CLUMP_GRID, MAT_GRID, createClumpAtlas, type ClumpAtlas } from './clump-atlas';
import { VegField, composeMatrix, newSample } from './field';
import { LodInstancedSet } from './lodset';
import { createVegMaterial } from './materials';

/** jittered grid pitch (m) of the clump cards and of the mats */
export const CLUMP_CELL = 0.42;
export const MAT_CELL = 0.55;
/** clump card footprint (m): width range, height range; the atlas tile is 2 : 1 so a card keeps ≈ that aspect */
const CLUMP_WIDTH: readonly [number, number] = [0.42, 0.62];
const CLUMP_HEIGHT: readonly [number, number] = [0.19, 0.32];
/** the tallest a clump card may stand (camera C's stair-foot rule caps standing plants at 0.35 m) */
const CLUMP_MAX_H = 0.32;
/** the card root sinks this far under the turf so the atlas' root mass, not a cut edge, meets the ground */
const CLUMP_SINK = 0.03;
/** the lawn band along the paving (m) that keeps real blades only (frames: single blades at the slab edge) */
const CLUMP_RIM_CLEAR = 0.14;
const MAT_RIM_CLEAR = 0.1;
/** mat footprint (m) */
const MAT_WIDTH: readonly [number, number] = [0.62, 0.86];
/** mats float this far above the terrain (the alpha rim hides the seam; the blades stand through it) */
const MAT_LIFT = 0.018;
/** LOD ranges (m): near clump cards (two rows, three planes) out to this, the far card beyond */
const CLUMP_LOD_NEAR = 12;
/** cards / mats steeper than this lose density (the flanks keep their blade turf, which follows the face) */
const SLOPE_THIN: readonly [number, number] = [0.42, 0.68];
const MAT_SLOPE_THIN: readonly [number, number] = [0.3, 0.5];
/** bank darkening and its flattening of the blade-to-blade contrasts — the blades' constants (grass.ts) */
const BANK_DARKEN = 0.6;
const BANK_FLAT = 0.7;
/** the house flight's south flank cap (grass.ts HOUSE_FLANK_MAX_H_SOUTH) */
const HOUSE_SOUTH_MAX_H = 0.12;

export interface CarpetResult {
  clumps: LodInstancedSet;
  mats: LodInstancedSet;
  all: LodInstancedSet[];
  materials: Material[];
  atlas: ClumpAtlas;
  /** metres² of ground the clump cells were offered over (inside the detail disc), for the audit's density */
  lawnCellsM2: number;
  samples: { clumps: number[][]; mats: number[][] };
}

/**
 * Unit clump card: `planes` quads crossed about the y axis (1 wide, 1 tall, x ∈ ±0.5, y ∈ 0..1),
 * `rows` vertical segments, each plane tilted ±`tilt` rad off vertical about its base line
 * (alternating) so the fan has volume from above. uv.x across, uv.y root → tip.
 */
export function clumpCardGeometry(planes: number, rows: number, tilt: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (let p = 0; p < planes; p++) {
    const yaw = (p * Math.PI) / planes;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    // the plane spans its local x along (cy, 0, -sy); its facing is (sy, 0, cy); the tilt leans
    // the top along the facing
    const lean = Math.sin(tilt) * (p % 2 === 0 ? 1 : -1);
    const rise = Math.cos(tilt);
    const base = pos.length / 3;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      for (const side of [-0.5, 0.5]) {
        pos.push(side * cy + sy * lean * t, t * rise, -side * sy + cy * lean * t);
        uv.push(side + 0.5, t);
        nrm.push(sy * rise, -lean, cy * rise);
      }
    }
    for (let j = 0; j < rows; j++) {
      const a = base + j * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setIndex(new Uint16BufferAttribute(idx, 1));
  g.computeBoundingBox();
  g.boundingSphere = new Sphere(new Vector3(0, 0.5, 0), Math.hypot(0.5, 0.5) + 0.05);
  return g;
}

/** Unit turf mat: one quad in the xz plane (x, z ∈ ±0.5), facing +y, uv over the quad. */
export function turfMatGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex(new Uint16BufferAttribute([0, 2, 1, 1, 2, 3], 1));
  g.computeBoundingBox();
  g.boundingSphere = new Sphere(new Vector3(0, 0, 0), Math.hypot(0.5, 0.5) + 0.02);
  return g;
}

/** the blades' tint-slot encoding (grass.ts): integer palette index, fraction = shade lift or bank darkening */
const tintSlot = (tintIndex: number, shade: number, darken: number) => (tintIndex + (darken > 0.01 ? 0.25 - 0.25 * darken : 0.25 + 0.5 * shade)) / 4;

export function buildCarpet(ctx: WorldContext, field: VegField, parent: Group): CarpetResult {
  const T = ctx.terrain;
  const R = ctx.config.detailRadius;
  const q = ctx.quality;
  const atlas = createClumpAtlas(ctx.rng);
  const materials: Material[] = [];

  const clumpMaterial = createVegMaterial(ctx, 'card', {
    name: 'veg-grass-clumps',
    card: { atlas: atlas.texture, atlasSize: atlas.size, grid: CLUMP_GRID, mode: 0, upMix: 0.8, lum: [0.5, 0.65], alphaBoost: 0.22 },
  });
  const matMaterial = createVegMaterial(ctx, 'card', {
    name: 'veg-turf-mats',
    singleSided: true,
    transmission: 0,
    card: { atlas: atlas.texture, atlasSize: atlas.size, grid: MAT_GRID, mode: 1, upMix: 1, lum: [0.62, 0.55], alphaBoost: 0.12 },
  });
  materials.push(clumpMaterial, matMaterial);

  const clumps = new LodInstancedSet({
    name: 'grass-clumps',
    variants: [[clumpCardGeometry(3, 2, 0.2), clumpCardGeometry(3, 1, 0.2)]],
    material: clumpMaterial,
    lodDistances: [CLUMP_LOD_NEAR * q.distance],
    castShadowLods: 0,
    receiveShadow: true,
    instanceData: { attribute: 'aData', size: 4 },
    cullPad: 0.8,
  });
  const mats = new LodInstancedSet({
    name: 'turf-mats',
    variants: [[turfMatGeometry()]],
    material: matMaterial,
    lodDistances: [],
    castShadowLods: 0,
    receiveShadow: true,
    instanceData: { attribute: 'aData', size: 4 },
    cullPad: 0.7,
  });

  const s = newSample();
  const M = new Float32Array(16);
  const data = new Float32Array(4);
  const white: [number, number, number] = [1, 1, 1];
  const clumpSamples: number[][] = [];
  const matSamples: number[][] = [];
  let lawnCellsM2 = 0;

  /**
   * The turf rules of one ground point, shared by both sets — the blade tiles' zone logic
   * (grass.ts `blade`) without its random draws: where turf grows at all, how tall it stands,
   * and its palette. Returns null where no card belongs.
   */
  const turfAt = (x: number, z: number, rim: number) => {
    if (Math.hypot(x, z) > R + 1) return null;
    field.sample(x, z, s);
    if (!field.allowed(x, z, s, true)) return null;
    if (field.insideGiantTrunk(x, z)) return null;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder) return null;
    const edge = field.lawnEdgeDistance(x, z, true);
    if (edge < rim) return null;
    const low = field.lowZone(x, z);
    const trim = field.trimZone(x, z);
    const shade = field.shadeZone(x, z);
    const band = field.lawnBand(x, z);
    const trod = field.troddenZone(x, z, true);
    const bare = trod * smoothstep(0.25, 0.7, field.dry(x, z));
    const house = field.houseFlankZone(x, z);
    const houseLocal = house > 0 ? field.houseFlightLocal(x, z) : null;
    const houseNorth = houseLocal !== null && houseLocal.v < 0 ? house : 0;
    const houseSouth = houseLocal !== null && houseLocal.v > 0 ? house : 0;
    const sight = houseNorth > 0.5 ? 0 : field.sightlineC(x, z, 0.5);
    const hollow = field.dHollow(x, s.h, z);
    const foot = field.cFoot(x, z);
    const shoulder = field.dShoulder(x, z);
    const giant = field.giantProximity(x, z);
    const cluster = field.cluster(x, z);
    const bank = field.bankDark(x, z);
    const stone = field.stoneDistance(x, z);
    // height factor: every cut the blades take
    let hk = (1 - 0.4 * low) * (1 - 0.2 * sight) * (1 - 0.35 * trim) * (1 - 0.62 * trod) * (1 - 0.3 * band) * (1 - 0.45 * hollow) * (1 - 0.55 * foot) * (1 - 0.35 * clr.npc) * (1 - 0.3 * giant) * (1 - 0.5 * shoulder);
    if (edge < 0.3) hk *= 0.72;
    // palette: the blades' tint drift and zone biases
    let tn = field.tint(x, z) - 0.45 * giant + (edge < 1.5 ? 0.12 : 0) + 0.35 * shade - 0.25 * trim + 0.2 * trod + 0.7 * foot;
    if (s.slope > 0.35) tn -= 0.15 * (1 - shade) * (1 - foot);
    if (houseNorth > 0) tn -= 0.6 * houseNorth;
    const dryP = (field.dry(x, z) * (0.35 + 0.65 * s.plateau) + 0.35 * trod + 0.55 * foot) * (1 - 0.5 * shade) * (1 - BANK_FLAT * bank);
    const darken = clamp(BANK_DARKEN * bank, 0, 0.96);
    return { edge, low, trim, shade, band, trod, bare, houseSouth, sight, hollow, foot, shoulder, giant, cluster, bank, stone, npc: clr.npc, hk, tn, dryP, darken };
  };

  const half = Math.ceil((R + 2) / 8);
  const seatClump = (x: number, z: number, rng: Rng) => {
    const t = turfAt(x, z, CLUMP_RIM_CLEAR);
    if (!t) return;
    if (t.stone < 0.22) return;
    // density: the carpet closes over the lawns; it thins where the blades thin — the trodden
    // strip's bare patches, D's shoulders, the litter floor under the giants, the NPC clearings,
    // the steep faces (the blade tiles keep those), the far disc
    const slopeK = 1 - smoothstep(SLOPE_THIN[0], SLOPE_THIN[1], s.slope);
    const density = field.falloff(x, z) * (0.82 + 0.18 * t.cluster) * (1 - 0.75 * t.giant) * (1 - 0.5 * t.npc) * (1 - 0.35 * t.trod - 0.5 * t.bare) * (1 - 0.85 * t.shoulder) * (1 - 0.3 * t.hollow) * (1 - 0.4 * t.foot) * slopeK * (1 - s.cliff) * q.density;
    if (rng() > density) return;
    const clusterVar = 0.85 + 0.3 * t.cluster;
    let w = (CLUMP_WIDTH[0] + (CLUMP_WIDTH[1] - CLUMP_WIDTH[0]) * rng()) * clusterVar;
    let h = (CLUMP_HEIGHT[0] + (CLUMP_HEIGHT[1] - CLUMP_HEIGHT[0]) * Math.pow(rng(), 1.3)) * clusterVar * (t.edge < 2.5 ? 1.08 : 1);
    h = Math.min(h, CLUMP_MAX_H) * t.hk;
    if (t.houseSouth > 0) h = Math.min(h, h + (HOUSE_SOUTH_MAX_H - h) * t.houseSouth);
    // the stones' walk corridor and the NPC spots: nothing over the herb layer
    if (t.stone < 0.5) h = Math.min(h, 0.2);
    if (t.npc > 0) h = Math.min(h, 0.26);
    // a cut card keeps its blade proportions: the width follows the height cut (softly)
    w *= 0.55 + 0.45 * Math.sqrt(h / (CLUMP_HEIGHT[1] * clusterVar));
    // the card must not overhang the paving
    w = Math.min(w, (t.edge - 0.02) * 2);
    if (w < 0.2 || h < 0.06) return;
    const tint = t.tn + rng.gauss() * 0.18 * (1 - BANK_FLAT * t.bank);
    const tintIndex = tint < -0.28 ? 0 : tint < 0.12 ? 1 : tint < 0.48 ? 2 : 3;
    const dry = clamp(t.dryP * (0.3 + 0.7 * rng()), 0, 0.95);
    const tile = rng.int(0, atlas.clumpTiles);
    const yaw = rng() * Math.PI * 2;
    const y = T.height(x, z) - CLUMP_SINK * (h / CLUMP_HEIGHT[1]);
    composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 0.5, yaw, w, h, w);
    data[0] = rng();
    data[1] = clamp(1 - h * (0.75 + 0.35 * rng()), 0.05, 0.95);
    data[2] = tintSlot(tintIndex, t.shade, t.darken);
    data[3] = tile + dry;
    clumps.add(M, 0, white, data);
    if (clumps.count % 61 === 0) clumpSamples.push([Math.round(x * 1000) / 1000, Math.round(y * 10000) / 10000, Math.round(z * 1000) / 1000]);
  };

  const seatMat = (x: number, z: number, rng: Rng) => {
    const t = turfAt(x, z, MAT_RIM_CLEAR);
    if (!t) return;
    if (t.stone < 0.12) return;
    // the mats close the ground everywhere the turf grows, bar the frames' bare earth: the
    // trodden strip's dirt patches, D's soil shoulders, camera C's trodden foreground, the
    // litter under the giants; steep faces take smaller mats and none past the thin band
    const slopeK = 1 - smoothstep(MAT_SLOPE_THIN[0], MAT_SLOPE_THIN[1], s.slope);
    const density = field.falloff(x, z) * (1 - 0.85 * t.giant) * (1 - 0.6 * t.npc) * (1 - 0.7 * t.bare) * (1 - 0.9 * t.shoulder) * (1 - 0.6 * t.foot) * slopeK * (1 - s.cliff) * q.density;
    if (rng() > density) return;
    let w = (MAT_WIDTH[0] + (MAT_WIDTH[1] - MAT_WIDTH[0]) * rng()) * (1 - 0.4 * smoothstep(MAT_SLOPE_THIN[0] * 0.6, MAT_SLOPE_THIN[1], s.slope));
    // never over the paving or a stepping stone
    w = Math.min(w, (t.edge - 0.02) * 2, (t.stone + 0.04) * 2);
    if (w < 0.25) return;
    const tint = t.tn + rng.gauss() * 0.12 * (1 - BANK_FLAT * t.bank);
    const tintIndex = tint < -0.28 ? 0 : tint < 0.12 ? 1 : tint < 0.48 ? 2 : 3;
    const dry = clamp(t.dryP * (0.3 + 0.7 * rng()), 0, 0.95);
    const tile = rng.int(0, atlas.matTiles);
    const yaw = rng() * Math.PI * 2;
    const y = T.height(x, z) + MAT_LIFT;
    composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 1, yaw, w, 1, w);
    data[0] = 0;
    data[1] = 1;
    data[2] = tintSlot(tintIndex, t.shade, t.darken);
    data[3] = tile + dry;
    mats.add(M, 0, white, data);
    if (mats.count % 53 === 0) matSamples.push([Math.round(x * 1000) / 1000, Math.round(y * 10000) / 10000, Math.round(z * 1000) / 1000]);
  };

  // jittered grids per 8 m tile, each tile its own stream (the blade tiles' pattern), so a rule
  // change in one zone re-seats nothing elsewhere
  for (let cz = -half; cz < half; cz++) {
    for (let cx = -half; cx < half; cx++) {
      const x0 = cx * 8;
      const z0 = cz * 8;
      if (Math.hypot(x0 + 4, z0 + 4) > R + 8 * 0.71) continue;
      const cRng = ctx.rng.fork(`carpet/clumps/${cx}/${cz}`);
      const nc = Math.round(8 / CLUMP_CELL);
      for (let j = 0; j < nc; j++) {
        for (let i = 0; i < nc; i++) {
          const x = Math.round((x0 + (i + cRng()) * CLUMP_CELL) * 1000) / 1000;
          const z = Math.round((z0 + (j + cRng()) * CLUMP_CELL) * 1000) / 1000;
          if (Math.hypot(x, z) <= R) lawnCellsM2 += CLUMP_CELL * CLUMP_CELL;
          seatClump(x, z, cRng);
        }
      }
      const mRng = ctx.rng.fork(`carpet/mats/${cx}/${cz}`);
      const nm = Math.round(8 / MAT_CELL);
      for (let j = 0; j < nm; j++) {
        for (let i = 0; i < nm; i++) {
          const x = Math.round((x0 + (i + mRng()) * MAT_CELL) * 1000) / 1000;
          const z = Math.round((z0 + (j + mRng()) * MAT_CELL) * 1000) / 1000;
          seatMat(x, z, mRng);
        }
      }
    }
  }

  // mats under the clumps: three draws the mats before the cards inside the shared render list
  // by material / depth order; the cards' alpha test needs no ordering
  parent.add(mats.build());
  parent.add(clumps.build());

  return {
    clumps,
    mats,
    all: [mats, clumps],
    materials,
    atlas,
    lawnCellsM2,
    samples: { clumps: clumpSamples, mats: matSamples },
  };
}
