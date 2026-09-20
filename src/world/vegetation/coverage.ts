/**
 * Turf coverage audit (round 47 — the owner's review of 2026-09-19, item 12: "there are patches
 * in the grass where it's not full"). The lawn is sampled on a COVERAGE_CELL grid over the ground a
 * walker can stand on or see from the paths, and every cell the masks call lawn is tested against
 * what actually stands on it: the carpet's turf mats (a mat's alpha rim closes ≈ MAT_FOOT of its
 * width around the root), the clump cards (a fan seen from eye height closes the ground behind it
 * out to ≈ CLUMP_FOOT of its width) and the blade tiles (BLADE_MIN roots inside BLADE_REACH of the
 * cell centre). A cell none of the three reaches is a bare patch. The audit reports the uncovered
 * share of the lawn, split by the zone that rules the cell — the frame-matched cuts (the C-foot
 * earth, the dark bank masses, D's shoulders, the trodden strip) against the open lawn and the
 * slopes — and the worst 8 m tiles, so a fill pass can be aimed and measured. Read by the audit
 * (index.ts `coverage`), the contracts (coverage.test.mjs) and the survey tooling.
 */
import type { GrassTile } from './grass';
import { VegField, newSample } from './field';
import type { LodInstancedSet } from './lodset';

/** the audit grid pitch (m) */
export const COVERAGE_CELL = 0.25;
/** a mat's closed footprint: the atlas rim sits at ≈ 0.86 × 0.47 of the tile, so ≈ 0.4 × its width from the root */
export const MAT_FOOT = 0.4;
/** a standing clump card's ground closure from eye height, as a share of its width */
export const CLUMP_FOOT = 0.42;
/** blade roots this close to a cell centre count toward its blade cover … */
export const BLADE_REACH = 0.2;
/** … and this many of them close the cell (≈ 24 blades / m² at the reach) */
export const BLADE_MIN = 3;
/** ground steeper than this (slope = 1 − ny, ≈ 66°) is a cliff face, not lawn a walker sees turf on */
export const COVERAGE_MAX_SLOPE = 0.6;

export type CoverageZone = 'lawn' | 'slope' | 'bank' | 'foot' | 'trodden' | 'shoulder' | 'hollow' | 'north' | 'low';

export interface CoverageZoneRow {
  cells: number;
  uncovered: number;
  /** uncovered share, 0..1 */
  share: number;
}

export interface CoverageReport {
  cellM: number;
  /** lawn cells sampled (the masks allow turf, inside the reach, under the slope cap) */
  cells: number;
  /** cells with no mat, no card and too few blades */
  uncovered: number;
  /** uncovered / cells, 0..1 */
  share: number;
  /** m² of lawn sampled */
  lawnM2: number;
  byZone: Record<CoverageZone, CoverageZoneRow>;
  /** the worst 8 m tiles: [cx, cz, cells, uncovered] sorted by uncovered count */
  worstTiles: [number, number, number, number][];
  /** sample of uncovered cell centres [x, z] (≤ 400, evenly spread) */
  samples: [number, number][];
}

interface Footprints {
  cell: number;
  map: Map<number, number[]>;
}

const key = (gx: number, gz: number) => gx * 65536 + gz;

/** bucket points (x, z, radius) into cells of `cell` m; each entry lists the point indices whose disc may reach the cell */
function bucket(points: Float64Array, n: number, cell: number): Footprints {
  const map = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const x = points[i * 3];
    const z = points[i * 3 + 1];
    const r = points[i * 3 + 2];
    const gx0 = Math.floor((x - r) / cell);
    const gx1 = Math.floor((x + r) / cell);
    const gz0 = Math.floor((z - r) / cell);
    const gz1 = Math.floor((z + r) / cell);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const k = key(gx, gz);
        let arr = map.get(k);
        if (!arr) map.set(k, (arr = []));
        arr.push(i);
      }
    }
  }
  return { cell, map };
}

/** true when any bucketed disc contains (x, z) */
function covered(points: Float64Array, f: Footprints, x: number, z: number): boolean {
  const arr = f.map.get(key(Math.floor(x / f.cell), Math.floor(z / f.cell)));
  if (!arr) return false;
  for (const i of arr) {
    const dx = x - points[i * 3];
    const dz = z - points[i * 3 + 1];
    const r = points[i * 3 + 2];
    if (dx * dx + dz * dz <= r * r) return true;
  }
  return false;
}

/** blade roots within `reach` of (x, z), from the blade grid (cell = reach, so the 3 × 3 neighbourhood holds them all) */
function bladesNear(roots: Float64Array, grid: Map<number, number[]>, cell: number, x: number, z: number, reach: number): number {
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  const r2 = reach * reach;
  let n = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const arr = grid.get(key(gx + dx, gz + dz));
      if (!arr) continue;
      for (const i of arr) {
        const ddx = x - roots[i * 2];
        const ddz = z - roots[i * 2 + 1];
        if (ddx * ddx + ddz * ddz <= r2) n++;
      }
    }
  }
  return n;
}

/** which zone rules a lawn cell, for the report's split */
export function coverageZone(field: VegField, x: number, z: number, slope: number, h: number): CoverageZone {
  if (field.cFoot(x, z) > 0.5) return 'foot';
  if (field.bankDark(x, z) > 0.5) return 'bank';
  if (field.dShoulder(x, z) > 0.5) return 'shoulder';
  if (field.troddenZone(x, z, true) > 0.5) return 'trodden';
  if (field.dHollow(x, h, z) > 0.5) return 'hollow';
  if (field.northFloor(x, z) > 0.5) return 'north';
  if (slope > 0.35) return 'slope';
  if (field.lowZone(x, z) > 0.5) return 'low';
  return 'lawn';
}

/** the instance scale along the local x axis (the card / mat width) */
const scaleX = (m: Float32Array) => Math.hypot(m[0], m[1], m[2]);

/**
 * Sample the lawn and report its coverage. `radius` bounds the sampled ground (reach ≤ radius,
 * field.ts `reach`: the detail disc and the north corridor).
 */
export function auditCoverage(field: VegField, tiles: readonly GrassTile[], clumps: readonly LodInstancedSet[], mats: LodInstancedSet | readonly LodInstancedSet[], radius: number): CoverageReport {
  const cell = COVERAGE_CELL;
  // round 48: the mats come in sets like the cards (carpet.ts `mats` and `northMats`)
  const matSets = Array.isArray(mats) ? (mats as readonly LodInstancedSet[]) : [mats as LodInstancedSet];
  // mats and cards as discs (x, z, r)
  let n = 0;
  for (const c of clumps) n += c.count;
  const cards = new Float64Array(n * 3);
  let k = 0;
  for (const c of clumps) {
    for (const it of c.items) {
      cards[k * 3] = it.x;
      cards[k * 3 + 1] = it.z;
      cards[k * 3 + 2] = scaleX(it.matrix) * CLUMP_FOOT;
      k++;
    }
  }
  let nm = 0;
  for (const m of matSets) nm += m.count;
  const matPts = new Float64Array(nm * 3);
  k = 0;
  for (const m of matSets) {
    for (const it of m.items) {
      matPts[k * 3] = it.x;
      matPts[k * 3 + 1] = it.z;
      matPts[k * 3 + 2] = scaleX(it.matrix) * MAT_FOOT;
      k++;
    }
  }
  const cardF = bucket(cards, n, 0.5);
  const matF = bucket(matPts, nm, 0.5);
  // blade roots from the tile matrices (translation columns)
  let blades = 0;
  for (const t of tiles) blades += t.count;
  const roots = new Float64Array(blades * 2);
  const bladeGrid = new Map<number, number[]>();
  k = 0;
  for (const t of tiles) {
    const m = t.mesh.instanceMatrix.array;
    for (let i = 0; i < t.count; i++) {
      const x = m[i * 16 + 12];
      const z = m[i * 16 + 14];
      roots[k * 2] = x;
      roots[k * 2 + 1] = z;
      const kk = key(Math.floor(x / BLADE_REACH), Math.floor(z / BLADE_REACH));
      let arr = bladeGrid.get(kk);
      if (!arr) bladeGrid.set(kk, (arr = []));
      arr.push(k);
      k++;
    }
  }

  const zones: CoverageZone[] = ['lawn', 'slope', 'bank', 'foot', 'trodden', 'shoulder', 'hollow', 'north', 'low'];
  const byZone = Object.fromEntries(zones.map((z) => [z, { cells: 0, uncovered: 0, share: 0 }])) as Record<CoverageZone, CoverageZoneRow>;
  const tileRows = new Map<number, [number, number, number, number]>();
  const s = newSample();
  let cells = 0;
  let uncovered = 0;
  const samples: [number, number][] = [];
  const ext = field.extent;
  const northExt = field.northExtent;
  for (let z = -northExt + cell / 2; z < ext; z += cell) {
    for (let x = -ext + cell / 2; x < ext; x += cell) {
      if (field.reach(x, z) > radius) continue;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s, true)) continue;
      if (s.slope > COVERAGE_MAX_SLOPE) continue;
      if (field.insideGiantTrunk(x, z)) continue;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder) continue;
      // the paved rim's first band is real blades only by design (carpet.ts CLUMP_RIM_CLEAR)
      cells++;
      const zone = coverageZone(field, x, z, s.slope, s.h);
      byZone[zone].cells++;
      const tx = Math.floor(x / 8);
      const tz = Math.floor(z / 8);
      const tk = key(tx, tz);
      let row = tileRows.get(tk);
      if (!row) tileRows.set(tk, (row = [tx, tz, 0, 0]));
      row[2]++;
      if (covered(matPts, matF, x, z) || covered(cards, cardF, x, z)) continue;
      if (bladesNear(roots, bladeGrid, BLADE_REACH, x, z, BLADE_REACH) >= BLADE_MIN) continue;
      uncovered++;
      byZone[zone].uncovered++;
      row[3]++;
      samples.push([Math.round(x * 100) / 100, Math.round(z * 100) / 100]);
    }
  }
  for (const zone of zones) byZone[zone].share = byZone[zone].cells ? byZone[zone].uncovered / byZone[zone].cells : 0;
  while (samples.length > 400) samples.splice(Math.floor(samples.length / 2) % samples.length, 1);
  const worstTiles = [...tileRows.values()].sort((a, b) => b[3] - a[3]).slice(0, 12);
  return { cellM: cell, cells, uncovered, share: cells ? uncovered / cells : 0, lawnM2: cells * cell * cell, byZone, worstTiles, samples };
}
