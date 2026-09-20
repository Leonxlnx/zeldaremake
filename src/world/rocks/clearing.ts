/**
 * The north clearing's rock dressing (round 47's handoff to the rocks lane, `docs/GOAL_MODE.md`
 * fable-2 #3; the demo's "pale boulder pairs and a low stone step at a bank's foot" motif,
 * `reference/ANALYSIS_VIDEO2.md` V20):
 *
 *  - a PALE BOULDER PAIR on the clearing's west bank — a rounded loaf and a smaller companion
 *    against its flank, half-buried in the bank, moss-capped, the pale weathered stone of
 *    `d_087`'s boulders (l 0.41)
 *  - SCREE at the `ledge` flight's flanks — angular shards the size of a fist to a head, sunk a
 *    third into the bank slope on both sides of the treads, denser at the foot
 *  - HALF-BURIED STRATA SLABS along the terrace face EAST of the flight, where the terrain step
 *    stands undressed (the `rockLedges` face runs west of the flight): bedded slabs lying with
 *    the slope, moss on their up-faces
 *
 * WHERE comes from the layout entries the expansion lane authored (`northClearing`, the `ledge`
 * flight in `stairs`, `ledgeTerrace`); every piece is seated on the heightfield, off the paving,
 * the treads and the structure pads, and the whole dressing is one merged geometry (one draw,
 * the hero material). Own stream: the ≤ 45 m scatters (strata / rubble / pebbles) never reach
 * z −70 and draw from their own forks, so they are what they were.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import type { Terrain } from '../terrain/heightfield';
import type { Rng } from '../util/prng';
import { buildRock } from './rockgen';
import { mergeRockParts } from './dressing';

export interface ClearingLayout {
  northClearing?: { x: number; z: number; y: number; radius: number };
  stairs: { id: string; base: [number, number, number]; dir: [number, number]; steps: number; rise: number; tread: number; width: number }[];
  ledgeTerrace?: { x: number; z: number; y: number; halfLength: number; halfDepth: number };
}

export interface ClearingBuild {
  geometry: BufferGeometry;
  stats: { boulders: number; scree: number; slabs: number; triangles: number };
  /** seat points (x, y, z): each piece's centre projected to the ground it stands in */
  contacts: [number, number, number][];
}

const _up = new Vector3(0, 1, 0);
const _n = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);

/** the ground is free for a stone: off the paving, the treads and the pads, not too steep */
function free(T: Terrain, x: number, z: number, maxSlope: number): boolean {
  const m = T.mask(x, z);
  return m.path < 0.05 && m.stairs < 0.2 && m.structure < 0.3 && T.slope(x, z) < maxSlope;
}

/** a pose: yaw about +Y, then the up axis tilted toward the terrain normal by `lean` (0 = level, 1 = flush) */
function pose(T: Terrain, x: number, y: number, z: number, yaw: number, lean: number): Matrix4 {
  T.normal(x, z, _n);
  _q.setFromUnitVectors(_up, _n.lerp(_up, 1 - lean).normalize());
  _q2.setFromAxisAngle(_up, yaw);
  _q.multiply(_q2);
  _p.set(x, y, z);
  return new Matrix4().compose(_p, _q, _s);
}

export function buildClearingRocks(layout: ClearingLayout, T: Terrain, rng: Rng, seed: string, shadeDir: [number, number]): ClearingBuild | null {
  const C = layout.northClearing;
  const flight = layout.stairs.find((s) => s.id === 'ledge');
  if (!C || !flight) return null;
  const parts: { geometry: BufferGeometry; matrix: Matrix4 }[] = [];
  const contacts: [number, number, number][] = [];
  const stats = { boulders: 0, scree: 0, slabs: 0, triangles: 0 };
  /** the sun's shade direction in a piece's local frame (its yaw) */
  const toLocal = (yaw: number): [number, number] => [shadeDir[0] * Math.cos(yaw) - shadeDir[1] * Math.sin(yaw), shadeDir[0] * Math.sin(yaw) + shadeDir[1] * Math.cos(yaw)];

  // --- the pale boulder pair on the west bank -------------------------------------------------
  {
    const bRng = rng.fork('bank-pair');
    // candidates on the west bearing (±20°) 0.5–1.3 m outside the paved disc — at the bank's
    // foot, as the demo's pairs sit — on ground not too steep for a loaf; the first free one wins
    let spot: { x: number; z: number; a: number } | null = null;
    for (let k = 0; k < 24 && !spot; k++) {
      const a = Math.PI + bRng.range(-0.35, 0.35);
      const d = C.radius + bRng.range(0.5, 1.3);
      const x = C.x + Math.cos(a) * d;
      const z = C.z + Math.sin(a) * d;
      if (free(T, x, z, 0.5)) spot = { x, z, a };
    }
    if (spot) {
      const loaf = (id: string, r: number, squash: number, sinkFrac: number, x: number, z: number, yaw: number, cuts: number) => {
        const g = buildRock(bRng.fork(id), `${seed}/clearing-${id}`, {
          radius: r,
          detail: r > 0.4 ? 18 : 14,
          ridge: 0.12,
          lump: 0.3,
          crown: 0.18,
          cuts,
          cutUp: [-0.3, 0.35],
          cutDepth: [0.84, 0.95],
          squashY: squash,
          creaseDeg: 32,
          cracks: 0.45,
          crackDepth: 0.02,
          fineCracks: 0.4,
          fineCrackDepth: 0.008,
          micro: 0.02,
          chip: 0.015,
          rimRound: 0.1,
          moss: 0.9,
          mossThickness: Math.min(0.12, 0.1 / r),
          mossLumpy: 0.9,
          mossSide: 0.6,
          mossShade: toLocal(yaw),
          facetBare: 0.5,
          dirt: 0.75,
          collarBand: [0.1, 0.55],
          // d_087's boulders: pale weathered grey-tan (#6c6e64, l 0.41) — paler than the plaza's
          // hero rocks, which sit in the giants' shade
          tint: new Color(0.76, 0.75, 0.68),
          lichen: 0.35,
          freq: 0.9,
        });
        // seat: the ground under the footprint, the flat-ish bottom (−0.62·r·squash) sunk `sinkFrac`
        // of the height into the bank
        let gs = 0;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          gs += T.height(x + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5);
        }
        const ground = gs / 8;
        const cy = ground + r * squash * 0.62 - sinkFrac * 2 * r * squash;
        parts.push({ geometry: g, matrix: pose(T, x, cy, z, yaw, 0.35) });
        contacts.push([x, ground, z]);
        stats.boulders++;
        return { cy, ground };
      };
      const yawA = bRng.range(0, Math.PI * 2);
      const rA = 0.52;
      loaf('loaf', rA, 0.72, 0.28, spot.x, spot.z, yawA, 2);
      // the companion: a third smaller, against the loaf's flank along the bank (perpendicular to
      // the bearing), sunk a little deeper — the pair reads as one group from the clearing
      const rB = 0.33;
      const along = spot.a + Math.PI / 2 + bRng.range(-0.3, 0.3);
      const d = (rA + rB) * 0.86;
      const bx = spot.x + Math.cos(along) * d;
      const bz = spot.z + Math.sin(along) * d;
      if (free(T, bx, bz, 0.6)) loaf('companion', rB, 0.7, 0.34, bx, bz, bRng.range(0, Math.PI * 2), 3);
    }
  }

  // --- scree at the flight's flanks -----------------------------------------------------------
  {
    const sRng = rng.fork('scree');
    const dir = new Vector3(flight.dir[0], 0, flight.dir[1]).normalize();
    const side = new Vector3(-dir.z, 0, dir.x); // across the treads
    const run = flight.steps * flight.tread;
    for (const sign of [-1, 1]) {
      // eleven to fourteen blocks per flank — fist to knee-sized, the biggest spilled at the foot
      // corners (the slope sheds them downhill), the small ones up the flank. The band lies
      // 0.6–1.4 m off the treads: the hardscape's edging stones ("cheeks") hold the first 0.6 m,
      // and a shard inside one is a shard nobody sees
      const n = 11 + sRng.int(0, 4);
      const target = stats.scree + n;
      for (let k = 0; k < n * 3 && k < 80; k++) {
        const u = Math.pow(sRng(), 1.5) * 0.95 + 0.02; // 0 at the foot … 1 at the top
        const off = flight.width / 2 + 0.6 + sRng.range(0, 0.8) * (0.6 + 0.4 * (1 - u));
        const x = flight.base[0] + dir.x * (u * run - 0.25 * (1 - u)) + side.x * off * sign;
        const z = flight.base[2] + dir.z * (u * run - 0.25 * (1 - u)) + side.z * off * sign;
        if (!free(T, x, z, 0.95)) continue;
        const sc = (k < 2 ? sRng.range(0.26, 0.38) : sRng.range(0.1, 0.24)) * (1 - 0.3 * u);
        const yaw = sRng.range(0, Math.PI * 2);
        const shard = buildRock(sRng.fork(`shard-${sign}-${k}`), `${seed}/clearing-shard-${sign}-${k}`, {
          radius: sc,
          detail: sc > 0.2 ? 6 : 5,
          ridge: 0.25,
          lump: 0.3,
          cuts: 3 + sRng.int(0, 2),
          cutUp: [-0.4, 0.9],
          cutDepth: [0.6, 0.82],
          squashY: sRng.range(0.55, 0.8),
          creaseDeg: 34,
          cracks: 0.2,
          crackDepth: 0.012,
          micro: 0.04,
          chip: 0.02,
          rimRound: 0.06,
          moss: 0.3,
          mossThickness: 0.06,
          mossLumpy: 0.7,
          mossSide: 0.3,
          mossShade: toLocal(yaw),
          facetBare: 0.7,
          dirt: 0.7,
          collarBand: [0.05, 0.5],
          tint: new Color(0.64, 0.63, 0.58),
          freq: 1,
        });
        const ground = T.height(x, z);
        parts.push({ geometry: shard, matrix: pose(T, x, ground - sc * 0.28, z, yaw, 0.6) });
        contacts.push([x, ground, z]);
        stats.scree++;
        if (stats.scree >= target) break;
      }
    }
  }

  // --- half-buried strata slabs along the terrace face east of the flight -------------------
  if (layout.ledgeTerrace) {
    const tRng = rng.fork('terrace-slabs');
    const lipZ = layout.ledgeTerrace.z + layout.ledgeTerrace.halfDepth; // the terrace's south lip
    const eastX = flight.base[0] + flight.width / 2 + 0.5;
    const westX = flight.base[0] - flight.width / 2 - 0.9;
    // six or seven on the east bank (the undressed step), three at the foot of the wall west of
    // the flight (litter under a rock face); the east bank is gentle — a slope of 0.06 is enough
    const n = 6 + tRng.int(0, 2);
    const nWest = 3;
    let placed = 0;
    for (let k = 0; k < (n + nWest) * 4 && placed < n + nWest; k++) {
      const west = placed >= n;
      const x = west ? westX - tRng.range(0, 2.6) : eastX + tRng.range(0, 1.9);
      const z = west ? lipZ + tRng.range(2.0, 2.6) : lipZ + tRng.range(0.3, 3.2); // down the bank toward the clearing
      const slope = T.slope(x, z);
      // (the wall's foot stands on the paved disc's soft skirt: a little path mask is allowed there)
      const m = T.mask(x, z);
      if ((!west && slope < 0.06) || m.stairs > 0.2 || m.structure > 0.3 || m.path > (west ? 0.2 : 0.05) || slope > 1.2) continue;
      const sc = west ? tRng.range(0.24, 0.4) : tRng.range(0.3, 0.56);
      // yaw along the face (the beds lie with the slope), ± 25°
      const yaw = Math.atan2(-1, 0) + tRng.range(-0.45, 0.45);
      const slab = buildRock(tRng.fork(`slab-${k}`), `${seed}/clearing-slab-${k}`, {
        radius: sc,
        detail: sc > 0.4 ? 9 : 8,
        ridge: 0.18,
        lump: 0.28,
        cuts: 3,
        cutUp: [-0.2, 0.9],
        cutDepth: [0.78, 0.92],
        squashY: 0.5,
        creaseDeg: 58,
        cracks: 0.25,
        crackDepth: 0.02,
        micro: 0.04,
        chip: 0.015,
        rimRound: 0.14,
        strata: 0.08,
        moss: 0.75,
        mossThickness: 0.1,
        mossLumpy: 0.8,
        mossSide: 0.45,
        mossShade: toLocal(yaw),
        facetBare: 0.4,
        dirt: 0.6,
        tint: new Color(0.42, 0.42, 0.4),
        freq: 1,
      });
      const ground = T.height(x, z);
      parts.push({ geometry: slab, matrix: pose(T, x, ground - sc * 0.5 * 0.3, z, yaw, 0.75) });
      contacts.push([x, ground, z]);
      stats.slabs++;
      placed++;
    }
  }

  if (!parts.length) return null;
  const empty = new BufferGeometry();
  empty.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3));
  const geometry = mergeRockParts(empty, parts);
  for (const p of parts) p.geometry.dispose();
  stats.triangles = geometry.attributes.position.count / 3;
  return { geometry, stats, contacts };
}
