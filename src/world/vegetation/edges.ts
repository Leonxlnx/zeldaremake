/**
 * Round 50 (vegetation-27) — the two edges fable-5's take-0121 review failed (.agents/reviews/
 * fable-5-take0121.md W05 / W06), both dressed with plants the disc sets already have:
 *
 *  **W06 — the grass → slab edge.** Footage 24 s / 46 s: the slabs sit in dark damp earth; the
 *  turf stops short of them in a ragged line, moss cushions and short blades lean over the lip and
 *  leaves lie in the angle. Ours ran the turf mats to 0.1 m of the paving (carpet.ts
 *  MAT_RIM_CLEAR) in a straight two-tone line. `rimBand*` works the paved rims E / D / B frame in
 *  their foreground — the spine's two edges from the plaza to the log (RIM_SPINE_Z) and the stair
 *  branch — over RIM_BAND m outside the edge (field.ts `lawnEdgeDistance`, the same line the
 *  carpet reads): the mats and cards are pruned back to a noisy line (RIM_CLEAR), SOIL mats — the
 *  carpet's mat cards flagged soil (materials.ts CARD_COLOR_VERTEX: the terrain palette's dark
 *  soil, no grass palette) — lie in the cleared band over the terrain's gravel verge, moss
 *  cushions come in patches, short tufts lean over the lip and leaves lie in the angle.
 *
 *  **W05 — the C embankment.** Camera C looks south at the stair's south bank: its north face off
 *  the plaza's rim (C_MOUND, x 6.3–9.5 / z 1–4.2, the 0.7 m rise A cannot see behind the crest —
 *  A's own right foreground is the face's WEST part, field.ts A_FACE_BOX, untouched here) and the
 *  plateau's south-west slope left of it (C_PLATEAU, x 11–18 / z 5–11.5, the 2 m fall). Footage
 *  46 s: a real bank — turf in steps, dark earth between, ferns and broad leaves at the toe. The
 *  vegetation lays the steps: tufts in rows along the contours (TERRACE_STEP apart, on the
 *  treads), moss at the foot, ferns and broad leaves at the toe, leaves on the risers; the
 *  terrain material darkens the risers between the rows to soil (terrain/material.ts
 *  C_TERRACES, the same constants — edges.test asserts they agree).
 *
 * Every pass here runs AFTER a builder's own passes and BEFORE its `build()`, on its own seeded
 * forks (`edges/…`), so nothing the six frames show re-rolls; the prunes are filters. The seats
 * read the terrain the builder was handed (the legacy view — outside the expansion the views
 * agree, and the expansion filter runs after anyway).
 */
import { Vector3 } from 'three';
import type { WorldContext } from '../system';
import { clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { VegField, composeMatrix, newSample } from './field';
import type { LodInstancedSet } from './lodset';

// ---------------------------------------------------------------------------------------------
// W06 — the rim band

/** the spine's rims worked: the polyline's points with z in this range (the plaza to the log) */
export const RIM_SPINE_Z: readonly [number, number] = [-20, 1.5];
/** the band outside the paving edge (m) the passes work over */
export const RIM_BAND = 0.42;
/** the turf's noisy clearance from the edge (m): min + span × a 0.7 m value noise */
export const RIM_CLEAR: readonly [number, number] = [0.13, 0.25];
/** soil mats: pitch along the edge (m), width range (m), lightness range (× the palette's dark soil, ½ = 1.0) */
export const SOIL_MAT_PITCH = 0.2;
export const SOIL_MAT_WIDTH: readonly [number, number] = [0.32, 0.5];
export const SOIL_MAT_LIGHT: readonly [number, number] = [0.28, 0.42];
const SOIL_MAT_LIFT = 0.012;
/** moss cushions per metre of rim (in patches), tufts per metre, leaves per metre */
export const RIM_MOSS_PER_M = 1.6;
export const RIM_TUFTS_PER_M = 1.4;
export const RIM_LEAVES_PER_M = 0.9;

/** 0..1 value noise at metre scale, seeded by position (no stream) */
function vnoise(x: number, z: number, scale: number, salt = 0): number {
  const fx = x / scale;
  const fz = z / scale;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const h = (i: number, j: number) => {
    let n = (Math.imul(i + salt * 131, 374761393) + Math.imul(j, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * sx;
  const b = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * sx;
  return a + (b - a) * sz;
}
const mm = (v: number) => Math.round(v * 1000) / 1000;

/** the turf's clearance from the paving edge at (x, z): RIM_CLEAR through a 0.7 m noise */
export function rimClear(x: number, z: number): number {
  return RIM_CLEAR[0] + RIM_CLEAR[1] * vnoise(x, z, 0.7, 3);
}

/** a rim cell: the seat, its outward normal (away from the paving) and its distance to the edge */
interface RimPoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
  d: number;
}

/** the plan boxes the rim band works: the spine's stretch (RIM_SPINE_Z, its half-width and the band) and the stair branch */
export const RIM_BOXES: readonly (readonly [number, number, number, number])[] = [
  [-3.6, RIM_SPINE_Z[0] - 0.5, 5.6, RIM_SPINE_Z[1] + 0.5],
  [-0.2, -2.9, 7.4, 2.3],
];
const RIM_GRID = 0.1;

/** true inside one of RIM_BOXES */
export function inRimRegion(x: number, z: number): boolean {
  for (const b of RIM_BOXES) if (x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]) return true;
  return false;
}

const rimCellCache = new WeakMap<VegField, RimPoint[]>();

/**
 * The band's cells: RIM_BOXES scanned at RIM_GRID, every cell −0.06…RIM_BAND m outside a paving
 * edge (field.ts `lawnEdgeDistance`, the line the carpet reads: the spine's and the branch's
 * flagstones, the stairs, the discs' mask rims) that the mask, the props and the boulders allow,
 * with the outward normal from the edge distance's gradient. Computed once per field; the passes
 * draw from it in scan order.
 */
function rimCells(field: VegField): RimPoint[] {
  const cached = rimCellCache.get(field);
  if (cached) return cached;
  const s = newSample();
  const out: RimPoint[] = [];
  for (const b of RIM_BOXES) {
    for (let z = b[1] + RIM_GRID / 2; z < b[3]; z += RIM_GRID) {
      for (let x = b[0] + RIM_GRID / 2; x < b[2]; x += RIM_GRID) {
        // the boxes overlap where the branch leaves the spine: the first box owns the cell
        if (b !== RIM_BOXES[0] && inBox(x, z, RIM_BOXES[0])) continue;
        const xm = mm(x);
        const zm = mm(z);
        const d = field.lawnEdgeDistance(xm, zm, true);
        if (!Number.isFinite(d) || d < -0.06 || d > RIM_BAND) continue;
        field.sample(xm, zm, s);
        if (!field.allowed(xm, zm, s, true) && d > 0.02) continue;
        if (s.stairs > 0.05 || s.structure > 0.05 || s.cliff > 0.5) continue;
        if (field.insideGiantTrunk(xm, zm) || field.insidePropFootprint(xm, zm, 0.05)) continue;
        if (field.clearing(xm, zm).insideBoulder) continue;
        const gx = field.lawnEdgeDistance(xm + 0.05, zm, true) - field.lawnEdgeDistance(xm - 0.05, zm, true);
        const gz = field.lawnEdgeDistance(xm, zm + 0.05, true) - field.lawnEdgeDistance(xm, zm - 0.05, true);
        const gl = Math.hypot(gx, gz) || 1;
        out.push({ x: xm, z: zm, nx: gx / gl, nz: gz / gl, d });
      }
    }
  }
  rimCellCache.set(field, out);
  return out;
}
const inBox = (x: number, z: number, b: readonly [number, number, number, number]) => x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3];

/**
 * Seats drawn from the band's cells: each cell is offered at `perM` seats per metre of rim over
 * the `dRange` slice of the band (the cells in the slice per metre of rim = slice width / grid²),
 * `weight(cell)` scaling the odds, one draw per cell from `rng` in scan order.
 */
function rimSeats(field: VegField, rng: Rng, perM: number, dRange: readonly [number, number], weight: (p: RimPoint) => number = () => 1): RimPoint[] {
  const cellsPerM = ((dRange[1] - dRange[0]) / RIM_GRID) * (1 / RIM_GRID);
  const p0 = perM / cellsPerM;
  const out: RimPoint[] = [];
  for (const c of rimCells(field)) {
    if (c.d < dRange[0] || c.d > dRange[1]) continue;
    const draw = rng();
    if (draw < p0 * weight(c)) out.push({ ...c, x: mm(c.x + (rng() - 0.5) * RIM_GRID), z: mm(c.z + (rng() - 0.5) * RIM_GRID) });
  }
  return out;
}

export interface RimCarpetResult {
  prunedMats: number;
  prunedClumps: number;
  soilMats: number;
}

/**
 * The carpet's side: prune the turf mats and clump cards back from the edge to the noisy
 * clearance, then lay the soil mats in the cleared band. `matTiles` is the atlas's mat tile
 * count; the soil mats take a mat tile's dabs for their mottle and its ragged rim.
 */
export function rimBandCarpet(ctx: WorldContext, field: VegField, mats: LodInstancedSet, clumps: LodInstancedSet, matTiles: number): RimCarpetResult {
  const T = ctx.terrain;
  const inBand = (x: number, z: number, pad: number) => {
    if (!inRimRegion(x, z)) return false;
    const d = field.lawnEdgeDistance(x, z, true);
    return d < rimClear(x, z) + pad;
  };
  const prunedMats = mats.prune((it) => inBand(it.x, it.z, 0));
  const prunedClumps = clumps.prune((it) => inBand(it.x, it.z, 0.06));

  const rng = ctx.rng.fork('edges/rim/soil');
  const M = new Float32Array(16);
  const data = new Float32Array(4);
  const n = new Vector3();
  const white: [number, number, number] = [1, 1, 1];
  let soilMats = 0;
  // one mat every SOIL_MAT_PITCH along the edge, its centre a third of the way out: the mat's
  // width covers the slab edge to the turf's line, its alpha rim feathering both ways
  const seats = rimSeats(field, rng, 1 / SOIL_MAT_PITCH, [0.02, 0.22]);
  for (const p of seats) {
    const clear = rimClear(p.x, p.z);
    const w = (SOIL_MAT_WIDTH[0] + (SOIL_MAT_WIDTH[1] - SOIL_MAT_WIDTH[0]) * rng()) * (0.8 + 0.5 * (clear - RIM_CLEAR[0]) / RIM_CLEAR[1]);
    const light = SOIL_MAT_LIGHT[0] + (SOIL_MAT_LIGHT[1] - SOIL_MAT_LIGHT[0]) * rng();
    const tile = rng.int(0, matTiles);
    const yaw = rng() * Math.PI * 2;
    T.normal(p.x, p.z, n);
    const y = T.height(p.x, p.z) + SOIL_MAT_LIFT;
    composeMatrix(M, 0, p.x, y, p.z, n.x, n.y, n.z, 1, yaw, w, 1, w);
    data[0] = 1;
    // < 0.5 flags the soil mat (materials.ts); the value is its lightness / 2
    data[1] = light;
    data[2] = 0.25 / 4;
    data[3] = tile + 0.1;
    mats.add(M, 0, white, data);
    soilMats++;
  }
  return { prunedMats, prunedClumps, soilMats };
}

export interface RimPlantSets {
  moss: LodInstancedSet;
  tufts: LodInstancedSet;
}

/**
 * The plants' side: moss cushions in patches over the band (the "moss gradient": densest at the
 * turf's line, thinning to the lip) and short tufts at the lip leaning over the slab.
 */
export function rimBandPlants(ctx: WorldContext, field: VegField, sets: RimPlantSets): { rimMoss: number; rimTufts: number } {
  const T = ctx.terrain;
  const M = new Float32Array(16);
  const n = new Vector3();
  let rimMoss = 0;
  let rimTufts = 0;
  {
    const rng = ctx.rng.fork('edges/rim/moss');
    // patches: a 1.1 m noise gates the cushions, denser toward the turf's line
    const seats = rimSeats(field, rng, RIM_MOSS_PER_M * 2.2, [0.06, 0.4], (p) => vnoise(p.x, p.z, 1.1, 11) * (0.35 + 0.65 * smoothstep(0.04, 0.3, p.d)));
    for (const p of seats) {
      const scale = 0.42 + rng() * 0.3;
      T.normal(p.x, p.z, n);
      composeMatrix(M, 0, p.x, T.height(p.x, p.z) - 0.008, p.z, n.x, n.y, n.z, 0.9, rng() * Math.PI * 2, scale * (0.8 + 0.4 * rng()), scale * 0.75, scale * (0.8 + 0.4 * rng()));
      sets.moss.add(M, rng.int(0, sets.moss.variantCount), [0.95 + rng() * 0.1, 1, 0.92 + rng() * 0.1]);
      rimMoss++;
    }
  }
  {
    const rng = ctx.rng.fork('edges/rim/tufts');
    const seats = rimSeats(field, rng, RIM_TUFTS_PER_M, [0.0, 0.2], (p) => 1.6 - 3 * p.d);
    for (const p of seats) {
      const scale = 0.32 + rng() * 0.26;
      // the blades lean over the lip: the up vector pushed toward the paving, more the nearer the edge
      const lean = (1 - smoothstep(0.02, 0.2, p.d)) * 0.55;
      T.normal(p.x, p.z, n);
      n.x -= p.nx * lean;
      n.z -= p.nz * lean;
      n.normalize();
      composeMatrix(M, 0, p.x, T.height(p.x, p.z) - 0.012, p.z, n.x, n.y, n.z, 0.85, rng() * Math.PI * 2, scale, scale, scale);
      sets.tufts.add(M, rng.int(0, sets.tufts.variantCount), [1 + (rng() - 0.5) * 0.14, 1 + (rng() - 0.5) * 0.1, 1 + (rng() - 0.5) * 0.16]);
      rimTufts++;
    }
  }
  return { rimMoss, rimTufts };
}

/** the litter's side: leaves in the angle between the slab lip and the turf */
export function rimBandLitter(ctx: WorldContext, field: VegField, leaves: LodInstancedSet, tints: readonly (readonly [number, number, number])[]): number {
  const T = ctx.terrain;
  const M = new Float32Array(16);
  const n = new Vector3();
  const rng = ctx.rng.fork('edges/rim/leaves');
  const seats = rimSeats(field, rng, RIM_LEAVES_PER_M, [-0.06, 0.2]);
  let count = 0;
  for (const p of seats) {
    const scale = 0.7 + rng() * 0.6;
    const tint = tints[rng.int(0, tints.length)];
    const k = 0.8 + rng() * 0.4;
    T.normal(p.x, p.z, n);
    composeMatrix(M, 0, p.x, T.height(p.x, p.z) + 0.006, p.z, n.x, n.y, n.z, 1, rng() * Math.PI * 2, scale, scale, scale);
    leaves.add(M, rng.int(0, leaves.variantCount), [tint[0] * k, tint[1] * k, tint[2] * k]);
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------------------------
// W05 — the C embankment's terraces

/**
 * A terraced face: the plan box it lies in, the height range of the steps, the step (tread to
 * tread, m), the downhill direction the face must have (unit xz; a seat's normal must lean that
 * way by `facing` or more) and the slope range. terrain/material.ts C_TERRACES carries the same
 * boxes / heights / steps for the riser darkening — edges.test asserts they agree.
 */
export interface TerraceFace {
  id: string;
  box: readonly [number, number, number, number];
  /** the lowest tread and the highest (m); risers lie TERRACE_RISER below each tread */
  treads: readonly [number, number];
  step: number;
  /** the face's downhill direction (unit xz) and the minimum of the normal's lean along it */
  downhill: readonly [number, number];
  facing: number;
  minSlope: number;
}

/** the riser: this much (m) below a tread's height, the band the material darkens and the rows stand over */
export const TERRACE_RISER = 0.14;

export const C_TERRACES: readonly TerraceFace[] = [
  // the stair's south bank's north face off the plaza's rim (the 0.7 m rise camera C looks at;
  // A's right foreground is the face's west part, x < 6.3, left alone)
  { id: 'c-mound', box: [6.3, 1.0, 9.5, 4.2], treads: [0.22, 0.7], step: 0.24, downhill: [-0.38, -0.92], facing: 0.15, minSlope: 0.3 },
  // the plateau's south-west slope left of it in C (the 2 m fall to the south lawn)
  { id: 'c-plateau', box: [11.0, 5.0, 18.0, 11.5], treads: [0.3, 1.74], step: 0.36, downhill: [-0.5, 0.87], facing: 0.1, minSlope: 0.25 },
];

/** tufts along a tread (per m of contour), moss cushions at a foot (per m), ferns at a toe (total), leaves on the risers (per m²) */
export const TERRACE_TUFTS_PER_M = 4.2;
export const TERRACE_FOOT_MOSS_PER_M = 1.2;
export const TERRACE_TOE_FERNS = { 'c-mound': 9, 'c-plateau': 10 } as Record<string, number>;
export const TERRACE_RISER_LEAVES_PER_M2 = 1.6;

export interface TerraceSets {
  tufts: LodInstancedSet;
  moss: LodInstancedSet;
  ferns: LodInstancedSet;
  weeds: LodInstancedSet;
}

/** the face's local test: inside the box, on the slope, facing downhill; returns the height or NaN */
function onFace(T: WorldContext['terrain'], f: TerraceFace, x: number, z: number, n: Vector3): number {
  if (x < f.box[0] || x > f.box[2] || z < f.box[1] || z > f.box[3]) return NaN;
  T.normal(x, z, n);
  if (1 - n.y < f.minSlope) return NaN;
  if (n.x * f.downhill[0] + n.z * f.downhill[1] < f.facing) return NaN;
  return T.height(x, z);
}

/**
 * The plants of the terraces: tuft rows on every tread (the contour at the tread height, thinned
 * to a spacing so the row reads as a line), moss at each face's foot, ferns and broad leaves at
 * the toe.
 */
export function terracePlants(ctx: WorldContext, field: VegField, sets: TerraceSets): Record<string, number> {
  const T = ctx.terrain;
  const s = newSample();
  const M = new Float32Array(16);
  const n = new Vector3();
  const out: Record<string, number> = {};
  const ok = (x: number, z: number) => {
    field.sample(x, z, s);
    if (!field.allowed(x, z, s, true)) return false;
    if (s.stairs > 0.05 || s.structure > 0.05) return false;
    if (field.insidePropFootprint(x, z, 0.08) || field.clearing(x, z).insideBoulder) return false;
    return true;
  };
  for (const f of C_TERRACES) {
    const rng = ctx.rng.fork(`edges/terrace/${f.id}`);
    let rowTufts = 0;
    let footMoss = 0;
    let toeFerns = 0;
    let toeWeeds = 0;
    // the rows: the box scanned at 0.1 m, a seat where the ground crosses a tread height, thinned
    // to a 1 / TERRACE_TUFTS_PER_M spacing along the contour by a cell hash
    const cell = 1 / TERRACE_TUFTS_PER_M;
    const taken = new Set<string>();
    const g = 0.1;
    for (let z = f.box[1] + g / 2; z < f.box[3]; z += g) {
      for (let x = f.box[0] + g / 2; x < f.box[2]; x += g) {
        const h = onFace(T, f, x, z, n);
        if (Number.isNaN(h)) continue;
        const k = Math.round((h - f.treads[0]) / f.step);
        if (k < 0 || f.treads[0] + k * f.step > f.treads[1] + 1e-6) continue;
        const tread = f.treads[0] + k * f.step;
        // the tread's blades stand on its outer half metre-ish: just above the riser's top
        if (h < tread - 0.02 || h > tread + 0.05) continue;
        const key = `${k}/${Math.floor(x / cell)}/${Math.floor(z / cell)}`;
        if (taken.has(key)) continue;
        taken.add(key);
        const px = mm(x + (rng() - 0.5) * g);
        const pz = mm(z + (rng() - 0.5) * g);
        const scale = 0.42 + rng() * 0.3;
        const c: [number, number, number] = [1 + (rng() - 0.5) * 0.16, 1 + (rng() - 0.5) * 0.1, 1 + (rng() - 0.5) * 0.18];
        if (!ok(px, pz)) continue;
        // the blades lean downhill a little (the face's drift)
        T.normal(px, pz, n);
        n.x += f.downhill[0] * 0.25;
        n.z += f.downhill[1] * 0.25;
        n.normalize();
        composeMatrix(M, 0, px, T.height(px, pz) - 0.012, pz, n.x, n.y, n.z, 0.8, rng() * Math.PI * 2, scale, scale, scale);
        sets.tufts.add(M, rng.int(0, sets.tufts.variantCount), c);
        rowTufts++;
      }
    }
    // the foot: moss cushions where the face meets the ground below its lowest riser
    const foot: [number, number][] = [];
    for (let z = f.box[1] + g / 2; z < f.box[3]; z += g) {
      for (let x = f.box[0] + g / 2; x < f.box[2]; x += g) {
        T.normal(x, z, n);
        const h = T.height(x, z);
        if (x < f.box[0] || x > f.box[2]) continue;
        if (n.x * f.downhill[0] + n.z * f.downhill[1] < f.facing * 0.5) continue;
        const low = f.treads[0] - TERRACE_RISER;
        if (h < low - 0.22 || h > low + 0.04) continue;
        foot.push([x, z]);
      }
    }
    const footLen = foot.length * g * g / 0.25;
    const nMoss = Math.round(footLen * TERRACE_FOOT_MOSS_PER_M);
    for (let i = 0; i < nMoss && foot.length; i++) {
      const [x0, z0] = foot[rng.int(0, foot.length)];
      const px = mm(x0 + (rng() - 0.5) * 0.12);
      const pz = mm(z0 + (rng() - 0.5) * 0.12);
      const scale = 0.5 + rng() * 0.4;
      const c: [number, number, number] = [0.95 + rng() * 0.1, 1, 0.9 + rng() * 0.1];
      if (!ok(px, pz) || field.lawnEdgeDistance(px, pz, true) < 0.04) continue;
      T.normal(px, pz, n);
      composeMatrix(M, 0, px, T.height(px, pz) - 0.01, pz, n.x, n.y, n.z, 0.9, rng() * Math.PI * 2, scale * (0.8 + 0.4 * rng()), scale * 0.8, scale * (0.8 + 0.4 * rng()));
      sets.moss.add(M, rng.int(0, sets.moss.variantCount), c);
      footMoss++;
    }
    // the toe: ferns and broad leaves on the lowest step and the foot (footage 46 s: the Kokiri's
    // feet stand among ferns and broad leaves), never inside the paving's clearance
    const want = TERRACE_TOE_FERNS[f.id] ?? 8;
    for (let i = 0; i < 400 && toeFerns < want; i++) {
      const px = mm(f.box[0] + rng() * (f.box[2] - f.box[0]));
      const pz = mm(f.box[1] + rng() * (f.box[3] - f.box[1]));
      const scale = 0.5 + rng() * 0.3;
      const c: [number, number, number] = [1 + (rng() - 0.5) * 0.2, 1 + (rng() - 0.5) * 0.14, 1 + (rng() - 0.5) * 0.24];
      const h = onFace(T, f, px, pz, n);
      if (Number.isNaN(h) || h > f.treads[0] + f.step * 0.6) continue;
      if (!ok(px, pz) || field.lawnEdgeDistance(px, pz, true) < 0.3) continue;
      if (sets.ferns.items.some((it) => Math.hypot(it.x - px, it.z - pz) < 0.5)) continue;
      T.normal(px, pz, n);
      composeMatrix(M, 0, px, T.height(px, pz) - 0.02, pz, n.x, n.y, n.z, 0.7, rng() * Math.PI * 2, scale, scale, scale);
      sets.ferns.add(M, rng.int(0, sets.ferns.variantCount), c);
      toeFerns++;
    }
    for (let i = 0; i < 300 && toeWeeds < want; i++) {
      const px = mm(f.box[0] + rng() * (f.box[2] - f.box[0]));
      const pz = mm(f.box[1] + rng() * (f.box[3] - f.box[1]));
      const scale = 0.55 + rng() * 0.4;
      const c: [number, number, number] = [1 + (rng() - 0.5) * 0.16, 1 + (rng() - 0.5) * 0.1, 1 + (rng() - 0.5) * 0.2];
      const h = onFace(T, f, px, pz, n);
      if (Number.isNaN(h) || h > f.treads[0] + f.step * 0.9) continue;
      if (!ok(px, pz) || field.lawnEdgeDistance(px, pz, true) < 0.12) continue;
      T.normal(px, pz, n);
      composeMatrix(M, 0, px, T.height(px, pz) - 0.01, pz, n.x, n.y, n.z, 0.7, rng() * Math.PI * 2, scale, scale, scale);
      sets.weeds.add(M, rng.int(0, sets.weeds.variantCount), c);
      toeWeeds++;
    }
    out[`${f.id}-row-tufts`] = rowTufts;
    out[`${f.id}-foot-moss`] = footMoss;
    out[`${f.id}-toe-ferns`] = toeFerns;
    out[`${f.id}-toe-weeds`] = toeWeeds;
  }
  return out;
}

/** the litter's side of the terraces: leaves on the risers (the dark bands between the rows) */
export function terraceLitter(ctx: WorldContext, field: VegField, leaves: LodInstancedSet, tints: readonly (readonly [number, number, number])[]): number {
  const T = ctx.terrain;
  const s = newSample();
  const M = new Float32Array(16);
  const n = new Vector3();
  let count = 0;
  for (const f of C_TERRACES) {
    const rng = ctx.rng.fork(`edges/terrace-litter/${f.id}`);
    const area = (f.box[2] - f.box[0]) * (f.box[3] - f.box[1]);
    const tries = Math.round(area * TERRACE_RISER_LEAVES_PER_M2 * 6);
    for (let i = 0; i < tries; i++) {
      const px = mm(f.box[0] + rng() * (f.box[2] - f.box[0]));
      const pz = mm(f.box[1] + rng() * (f.box[3] - f.box[1]));
      const scale = 0.7 + rng() * 0.6;
      const tint = tints[rng.int(0, tints.length)];
      const k = 0.8 + rng() * 0.4;
      const yaw = rng() * Math.PI * 2;
      const h = onFace(T, f, px, pz, n);
      if (Number.isNaN(h)) continue;
      const kk = Math.round((h - f.treads[0]) / f.step);
      const tread = f.treads[0] + kk * f.step;
      if (h > tread - 0.02 || h < tread - TERRACE_RISER - 0.03) continue;
      field.sample(px, pz, s);
      if (!field.allowed(px, pz, s, true) || s.stairs > 0.05 || s.structure > 0.05) continue;
      if (field.insidePropFootprint(px, pz, 0.05) || field.clearing(px, pz).insideBoulder) continue;
      T.normal(px, pz, n);
      composeMatrix(M, 0, px, T.height(px, pz) + 0.005, pz, n.x, n.y, n.z, 1, yaw, scale, scale, scale);
      leaves.add(M, rng.int(0, leaves.variantCount), [tint[0] * k, tint[1] * k, tint[2] * k]);
      count++;
    }
  }
  return count;
}

export { clamp };
