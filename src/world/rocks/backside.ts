/**
 * The plaza's backside (round 49, expansion-2): rocks at the fence-topped south bank — the
 * footage's motif at every bank foot (`reference/ANALYSIS_VIDEO2.md` V20, `d_087`): **pale rounded
 * boulders** and **a low stone step running along the bank's foot**, and scree at the bank's flight.
 *
 *  - a PALE BOULDER PAIR at the toe west of the flight — a rounded loaf and a smaller companion,
 *    half-buried, moss-capped, the pale weathered stone of `d_087` (l 0.41)
 *  - a LOW STONE STEP: flat slabs half-buried in a broken line along the toe either side of the
 *    flight, lying with the lip
 *  - SCREE at the south-bank flight's flanks, in the band beyond the hardscape's edging cheeks
 *
 * WHERE comes from the layout's `EXPANSION.southBank` lip frame and `EXPANSION_STAIRS` 'south-bank';
 * every piece is seated on the LIVE terrain (the rocks system otherwise builds against the legacy
 * view — the bank does not exist there) and stays off the treads, the discs and the pads. One merged
 * geometry, one draw, toggled with expansion-2's own `expansionVisible()` (frustum + shadow-sweep
 * spheres), so camera C — whose right edge the bank runs along, 1–4 m outside it — never draws it
 * or its shadow. Own stream (`backside`).
 */
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { EXPANSION, EXPANSION_STAIRS, southBankFrameVectors, southBankPoint } from '../layout';
import { getTerrain, type Terrain } from '../terrain/heightfield';
import type { Rng } from '../util/prng';
import type { Caster } from '../util/expansionLocality';
import { buildRock } from './rockgen';
import { mergeRockParts } from './dressing';

export interface BacksideBuild {
  geometry: BufferGeometry;
  stats: { boulders: number; stepStones: number; scree: number; triangles: number };
  /** seat points (x, y, z) */
  contacts: [number, number, number][];
  /** casters for the locality's visibility test — one tight caster per piece (a group sphere reached across camera C's edge: +1 draw / +31 K tris in C for nothing) */
  casters: Caster[];
}

const _up = new Vector3(0, 1, 0);
const _n = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);

function free(T: Terrain, x: number, z: number, maxSlope: number): boolean {
  const m = T.mask(x, z);
  return m.path < 0.05 && m.stairs < 0.2 && m.structure < 0.3 && T.slope(x, z) < maxSlope;
}

function pose(T: Terrain, x: number, y: number, z: number, yaw: number, lean: number): Matrix4 {
  T.normal(x, z, _n);
  _q.setFromUnitVectors(_up, _n.lerp(_up, 1 - lean).normalize());
  _q2.setFromAxisAngle(_up, yaw);
  _q.multiply(_q2);
  _p.set(x, y, z);
  return new Matrix4().compose(_p, _q, _s);
}

export function buildBacksideRocks(rng: Rng, seed: string, shadeDir: [number, number]): BacksideBuild | null {
  const T = getTerrain();
  const flight = EXPANSION_STAIRS.find((s) => s.id === 'south-bank');
  if (!flight) return null;
  const B = EXPANSION.southBank;
  const { lip } = southBankFrameVectors();
  const lipYaw = Math.atan2(lip[0], lip[1]);
  const parts: { geometry: BufferGeometry; matrix: Matrix4 }[] = [];
  const contacts: [number, number, number][] = [];
  const casters: Caster[] = [];
  const stats = { boulders: 0, stepStones: 0, scree: 0, triangles: 0 };
  const toLocal = (yaw: number): [number, number] => [shadeDir[0] * Math.cos(yaw) - shadeDir[1] * Math.sin(yaw), shadeDir[0] * Math.sin(yaw) + shadeDir[1] * Math.cos(yaw)];
  // the flight's span along the lip (its centre u 0.3, width 1.6, plus the hardscape's kerbs)
  const flightU = 0.3;
  const flightHalf = flight.width / 2 + 0.45;
  const toeV = B.face + 0.35; // just past the face's foot on the plain

  // --- the pale boulder pair, west of the flight at the toe --------------------------------------
  {
    const bRng = rng.fork('bank-pair');
    const loaf = (id: string, r: number, squash: number, sinkFrac: number, x: number, z: number, yaw: number, cuts: number) => {
      const g = buildRock(bRng.fork(id), `${seed}/backside-${id}`, {
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
        moss: 0.85,
        mossThickness: Math.min(0.12, 0.1 / r),
        mossLumpy: 0.9,
        mossSide: 0.5,
        mossShade: toLocal(yaw),
        facetBare: 0.5,
        dirt: 0.75,
        collarBand: [0.1, 0.55],
        tint: new Color(0.76, 0.75, 0.68),
        lichen: 0.35,
        freq: 0.9,
      });
      let gs = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        gs += T.height(x + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5);
      }
      const ground = gs / 8;
      const cy = ground + r * squash * 0.62 - sinkFrac * 2 * r * squash;
      parts.push({ geometry: g, matrix: pose(T, x, cy, z, yaw, 0.35) });
      contacts.push([x, ground, z]);
      casters.push({ x, z, r: r * squash + 0.15, y0: ground - 0.05, y1: cy + r * squash + 0.05, shadow: true });
      stats.boulders++;
    };
    // the loaf at u ≈ −1.5 (west of the flight's kerb), 0.6 m out on the plain; the companion along
    // the toe toward the flight; both must stand on free ground
    for (let k = 0; k < 12; k++) {
      const u = -1.35 - bRng.range(0, 0.5);
      const v = toeV + bRng.range(0.3, 0.8);
      const [x, z] = southBankPoint(u, v);
      if (!free(T, x, z, 0.5)) continue;
      const rA = 0.5;
      loaf('loaf', rA, 0.7, 0.3, x, z, bRng.range(0, Math.PI * 2), 2);
      const rB = 0.3;
      const [bx, bz] = southBankPoint(u + (rA + rB) * 0.88, v + bRng.range(-0.2, 0.2));
      if (free(T, bx, bz, 0.6)) loaf('companion', rB, 0.68, 0.36, bx, bz, bRng.range(0, Math.PI * 2), 3);
      break;
    }
  }

  // --- the low stone step along the toe, either side of the flight ------------------------------
  {
    const sRng = rng.fork('toe-step');
    const slabAt = (u: number, k: number) => {
      const [x, z] = southBankPoint(u, toeV + sRng.range(-0.15, 0.15));
      if (!free(T, x, z, 0.7)) return;
      const sc = sRng.range(0.34, 0.5);
      const yaw = lipYaw + sRng.range(-0.2, 0.2);
      const slab = buildRock(sRng.fork(`slab-${k}`), `${seed}/backside-slab-${k}`, {
        radius: sc,
        detail: 9,
        ridge: 0.15,
        lump: 0.25,
        cuts: 3,
        cutUp: [-0.2, 0.9],
        cutDepth: [0.8, 0.93],
        squashY: 0.32,
        creaseDeg: 55,
        cracks: 0.25,
        crackDepth: 0.015,
        micro: 0.03,
        chip: 0.012,
        rimRound: 0.14,
        moss: 0.5,
        mossThickness: 0.06,
        mossLumpy: 0.7,
        mossSide: 0.3,
        mossShade: toLocal(yaw),
        facetBare: 0.4,
        dirt: 0.75,
        collarBand: [0.05, 0.6],
        tint: new Color(0.7, 0.7, 0.63),
        freq: 1,
      });
      const ground = T.height(x, z);
      // half-buried: the flat slab's underside 0.4 of its thickness in the plain
      parts.push({ geometry: slab, matrix: pose(T, x, ground - sc * 0.32 * 0.4, z, yaw, 0.7) });
      contacts.push([x, ground, z]);
      casters.push({ x, z, r: sc + 0.1, y0: ground - 0.05, y1: ground + sc * 0.32 * 1.2, shadow: true });
      stats.stepStones++;
    };
    // west run: from the pair toward the flight's kerb; east run: past the kerb to the lip's end
    let k = 0;
    for (let u = -0.85 - flightHalf + 0.5; u > -B.halfLength - 0.6; u -= sRng.range(0.85, 1.15)) slabAt(u, k++);
    for (let u = flightU + flightHalf + 0.5; u < B.halfLength + 0.6; u += sRng.range(0.85, 1.15)) slabAt(u, k++);
  }

  // --- scree at the flight's flanks ------------------------------------------------------------
  {
    const cRng = rng.fork('scree');
    const dir = new Vector3(flight.dir[0], 0, flight.dir[1]).normalize();
    const side = new Vector3(-dir.z, 0, dir.x);
    const run = flight.steps * flight.tread;
    for (const sign of [-1, 1]) {
      const n = 7 + cRng.int(0, 3);
      const target = stats.scree + n;
      for (let k = 0; k < n * 3 && k < 50; k++) {
        const t = Math.pow(cRng(), 1.5) * 0.95 + 0.02;
        // beyond the hardscape's edging cheeks (the first 0.6 m), denser at the foot
        const off = flight.width / 2 + 0.6 + cRng.range(0, 0.6) * (0.6 + 0.4 * (1 - t));
        const x = flight.base[0] + dir.x * (t * run - 0.2 * (1 - t)) + side.x * off * sign;
        const z = flight.base[2] + dir.z * (t * run - 0.2 * (1 - t)) + side.z * off * sign;
        if (!free(T, x, z, 0.95)) continue;
        const sc = (k < 2 ? cRng.range(0.2, 0.3) : cRng.range(0.08, 0.2)) * (1 - 0.3 * t);
        const yaw = cRng.range(0, Math.PI * 2);
        const shard = buildRock(cRng.fork(`shard-${sign}-${k}`), `${seed}/backside-shard-${sign}-${k}`, {
          radius: sc,
          detail: sc > 0.2 ? 6 : 5,
          ridge: 0.25,
          lump: 0.3,
          cuts: 3 + cRng.int(0, 2),
          cutUp: [-0.4, 0.9],
          cutDepth: [0.6, 0.82],
          squashY: cRng.range(0.55, 0.8),
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
          dirt: 0.85,
          collarBand: [0.05, 0.62],
          tint: new Color(0.62, 0.61, 0.56),
          freq: 1,
        });
        const ground = T.height(x, z);
        parts.push({ geometry: shard, matrix: pose(T, x, ground - sc * 0.28, z, yaw, 0.6) });
        contacts.push([x, ground, z]);
        casters.push({ x, z, r: sc + 0.08, y0: ground - 0.05, y1: ground + sc * 1.4, shadow: true });
        stats.scree++;
        if (stats.scree >= target) break;
      }
    }
  }

  if (!parts.length) return null;
  const empty = new BufferGeometry();
  empty.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3));
  const geometry = mergeRockParts(empty, parts);
  for (const p of parts) p.geometry.dispose();
  stats.triangles = geometry.attributes.position.count / 3;
  return { geometry, stats, contacts, casters };
}
