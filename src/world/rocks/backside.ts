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
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import { EXPANSION, EXPANSION_STAIRS, expansionSteppingStones, southBankFrameVectors, southBankPoint } from '../layout';
import { hash2, hashString } from '../util/prng';
import { getTerrain, type Terrain } from '../terrain/heightfield';
import type { Rng } from '../util/prng';
import { casterSpheres, type Caster } from '../util/expansionLocality';
import { buildRock } from './rockgen';
import { mergeRockParts } from './dressing';

export interface BacksideBuild {
  geometry: BufferGeometry;
  stats: { boulders: number; stepStones: number; scree: number; kerbStones: number; discPebbles: number; triangles: number };
  /** seat points (x, y, z) */
  contacts: [number, number, number][];
  /**
   * casters for the locality's visibility test — one per piece: a circle of the built vertices'
   * bounding-sphere radius from the ground to the body's top, so the shadow sweep follows the whole
   * piece; `spheres()` adds the exact body sphere, which the util's 0.5 m stack would otherwise miss
   * on pieces under half a metre (Astra's audit: 1 876 vertices escaped the first cut's spheres)
   */
  casters: Caster[];
  /** the exact body sphere of every piece (world), conservative by construction */
  bodies: Sphere[];
  /** every sphere the locality test needs: the exact bodies plus the casters' stacks and shadow sweeps */
  spheres(sunDir: Vector3): Sphere[];
}

const _up = new Vector3(0, 1, 0);
const _n = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);

/**
 * A conservative caster for a built piece: the bounding sphere of its vertices under `matrix` (so every
 * vertex lies inside the body sphere whatever the squash or the displacement — Astra's audit of the
 * first cut found 1 876 vertices escaping spheres whose radius had been scaled by squashY), as a
 * circle on the ground of that radius spanning the sphere's height.
 */
function casterOf(geometry: BufferGeometry, matrix: Matrix4, ground: number, shadow: boolean): { caster: Caster; body: Sphere } {
  geometry.computeBoundingSphere();
  const body = geometry.boundingSphere!.clone().applyMatrix4(matrix) as Sphere;
  body.radius += 0.02;
  return { caster: { x: body.center.x, z: body.center.z, r: body.radius, y0: Math.min(ground, body.center.y - body.radius), y1: body.center.y + body.radius, shadow }, body };
}

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
  const bodies: Sphere[] = [];
  const addCaster = (g: BufferGeometry, mtx: Matrix4, ground: number, shadow: boolean) => {
    const c = casterOf(g, mtx, ground, shadow);
    casters.push(c.caster);
    bodies.push(c.body);
  };
  const stats = { boulders: 0, stepStones: 0, scree: 0, kerbStones: 0, discPebbles: 0, triangles: 0 };
  const dirLocal = (d: [number, number], yaw: number): [number, number] => [d[0] * Math.cos(yaw) - d[1] * Math.sin(yaw), d[0] * Math.sin(yaw) + d[1] * Math.cos(yaw)];
  const toLocal = (yaw: number): [number, number] => dirLocal(shadeDir, yaw);
  // the side of the bank pair a walker sees: from the plain (+face) and from the flight (+lip)
  const { lip: lipDir, face: faceDir } = southBankFrameVectors();
  const seenFrom: [number, number] = (() => {
    const x = lipDir[0] + faceDir[0];
    const z = lipDir[1] + faceDir[1];
    const l = Math.hypot(x, z) || 1;
    return [x / l, z / l];
  })();
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
        // fable-5 (17:50, V20 at `x-southbank-toe`): the pair read moss-grey — l 0.29, hue 81°, sat 0.12 —
        // where the frame's is warm pale stone; the same note as the D loaf, the same answer: a warm
        // tan tint, the moss a cap (thinner, off the sides the walker sees), the lichen greys halved,
        // and the seen side bare and paled a quarter
        moss: 0.6,
        mossThickness: Math.min(0.12, 0.1 / r),
        mossLumpy: 0.9,
        mossSide: 0.25,
        mossShade: toLocal(yaw),
        bareToward: dirLocal(seenFrom, yaw),
        faceLift: { dir: dirLocal(seenFrom, yaw), amount: 0.25 },
        facetBare: 0.6,
        dirt: 0.6,
        collarBand: [0.08, 0.42],
        tint: new Color(0.92, 0.84, 0.64),
        lichen: 0.18,
        freq: 0.9,
      });
      let gs = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        gs += T.height(x + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5);
      }
      const ground = gs / 8;
      const cy = ground + r * squash * 0.62 - sinkFrac * 2 * r * squash;
      const mtx = pose(T, x, cy, z, yaw, 0.35);
      parts.push({ geometry: g, matrix: mtx });
      contacts.push([x, ground, z]);
      addCaster(g, mtx, ground, true);
      stats.boulders++;
    };
    // the loaf at u ≈ −1.5 (west of the flight's kerb), 0.6 m out on the plain; the companion along
    // the toe toward the flight; both must stand on free ground
    for (let k = 0; k < 12; k++) {
      const u = -1.35 - bRng.range(0, 0.5);
      const v = toeV + bRng.range(0.3, 0.8);
      const [x, z] = southBankPoint(u, v);
      if (!free(T, x, z, 0.5)) continue;
      // (fable-5 17:50: ≈ 0.6 m in the frame at 6–7 m against `d_087`'s ≈ 1 m — a size up, sunk less)
      const rA = 0.62;
      loaf('loaf', rA, 0.7, 0.22, x, z, bRng.range(0, Math.PI * 2), 2);
      const rB = 0.36;
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
      const mtx = pose(T, x, ground - sc * 0.32 * 0.4, z, yaw, 0.7);
      parts.push({ geometry: slab, matrix: mtx });
      contacts.push([x, ground, z]);
      addCaster(slab, mtx, ground, true);
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
        const mtx = pose(T, x, ground - sc * 0.28, z, yaw, 0.6);
        parts.push({ geometry: shard, matrix: mtx });
        contacts.push([x, ground, z]);
        addCaster(shard, mtx, ground, true);
        stats.scree++;
        if (stats.scree >= target) break;
      }
    }
  }

  // --- expansion-2's listed positions (docs/GOAL_MODE.md fable-2 item 0) ----------------------------
  // the boulder at the bank's west skirt, kerb stones at the flight's foot, scree under the west
  // house's braces, pebbles beside the west / south stepping discs
  {
    const eRng = rng.fork('listed');
    const small = (id: string, r: number, x: number, z: number, yaw: number, o: { cuts: number; squash: number; tint: Color; moss: number; sink: number; detail: number; crease: number; dirt: number }) => {
      const g = buildRock(eRng.fork(id), `${seed}/backside-${id}`, {
        radius: r,
        detail: o.detail,
        ridge: 0.18,
        lump: 0.3,
        cuts: o.cuts,
        cutUp: [-0.3, 0.9],
        cutDepth: [0.7, 0.9],
        squashY: o.squash,
        creaseDeg: o.crease,
        cracks: 0.3,
        crackDepth: 0.015,
        micro: 0.03,
        chip: 0.015,
        rimRound: 0.1,
        moss: o.moss,
        mossThickness: Math.min(0.08, 0.06 / Math.max(r, 0.2)),
        mossLumpy: 0.8,
        mossSide: 0.4,
        mossShade: toLocal(yaw),
        facetBare: 0.5,
        dirt: o.dirt,
        collarBand: [0.06, 0.6],
        tint: o.tint,
        freq: 1,
      });
      const ground = T.height(x, z);
      const cy = ground + r * o.squash * 0.62 - o.sink * 2 * r * o.squash;
      const mtx = pose(T, x, cy, z, yaw, 0.5);
      parts.push({ geometry: g, matrix: mtx });
      contacts.push([x, ground, z]);
      addCaster(g, mtx, ground, true);
    };
    // the west-skirt boulder: a half-buried loaf on the bank's NW skirt
    {
      const [x, z] = [-18.93, 13.92];
      if (free(T, x, z, 0.8)) {
        small('west-skirt', 0.45, x, z, eRng.range(0, Math.PI * 2), { cuts: 2, squash: 0.7, tint: new Color(0.74, 0.73, 0.66), moss: 0.85, sink: 0.32, detail: 16, crease: 32, dirt: 0.75 });
        stats.boulders++;
      }
    }
    // kerb stones at the flight's foot: three or four flat stones lining the foot, along the lip
    {
      const [fx, fz] = [-14.13, 15.75];
      const n = 3 + eRng.int(0, 2);
      for (let k = 0; k < n; k++) {
        const t = (k - (n - 1) / 2) * 0.55;
        const x = fx + lip[0] * t + eRng.range(-0.08, 0.08);
        const z = fz + lip[1] * t + eRng.range(-0.08, 0.08);
        if (!free(T, x, z, 0.8)) continue;
        small(`kerb-${k}`, eRng.range(0.2, 0.28), x, z, lipYaw + eRng.range(-0.25, 0.25), { cuts: 3, squash: 0.45, tint: new Color(0.68, 0.68, 0.62), moss: 0.4, sink: 0.35, detail: 8, crease: 50, dirt: 0.8 });
        stats.kerbStones++;
      }
    }
    // scree under the west house's braces: a fan of angular shards spilled downhill of the bole
    {
      const [cx, cz] = [-21.5, 12.5];
      const n = 7 + eRng.int(0, 3);
      for (let k = 0; k < n * 3 && stats.scree < 40; k++) {
        const a = eRng.range(0, Math.PI * 2);
        const d = Math.sqrt(eRng()) * 1.3;
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        if (!free(T, x, z, 0.95)) continue;
        small(`brace-${k}`, eRng.range(0.08, 0.2), x, z, eRng.range(0, Math.PI * 2), { cuts: 3 + eRng.int(0, 2), squash: eRng.range(0.55, 0.8), tint: new Color(0.62, 0.61, 0.56), moss: 0.3, sink: 0.28, detail: 5, crease: 34, dirt: 0.85 });
        stats.scree++;
        if (stats.scree >= n + 15) break; // (the flights' scree above counts toward stats.scree too)
      }
    }
    // pebbles beside the discs: three to five small stones on the ring 0.45–0.7 m out from each disc's
    // centre (off the stone itself), each from its own hash — no sequential draws, so a disc added
    // or moved changes only its own ring
    {
      const k0 = hashString(`${seed}/backside/disc-pebbles`);
      const discs = expansionSteppingStones();
      // camera C's right frustum edge on the ground (layout `cClip`): the first west discs lie 1.2 m
      // west of it — their rings would cross it, so discs within 1.6 m of the edge get no pebbles
      const C = EXPANSION.cClip;
      discs.forEach((d, i) => {
        const edgeX = C.x0 + C.dxdz * (d.z - C.z0);
        if (edgeX - d.x < 1.6) return;
        const n = 3 + Math.floor(hash2(i, 0, k0) * 3);
        for (let j = 0; j < n; j++) {
          const a = hash2(i, 10 + j, k0) * Math.PI * 2;
          const rr = d.r + 0.12 + hash2(i, 20 + j, k0) * 0.25;
          const x = d.x + Math.cos(a) * rr;
          const z = d.z + Math.sin(a) * rr;
          const m = T.mask(x, z);
          if (m.stairs > 0.2 || m.structure > 0.3 || T.slope(x, z) > 0.95) continue;
          const sc = 0.03 + 0.06 * hash2(i, 30 + j, k0);
          const g = buildRock(eRng.fork(`disc-${i}-${j}`), `${seed}/backside-disc-${i}-${j}`, { radius: sc, detail: 1, ridge: 0.15, lump: 0.3, cuts: 2, cutDepth: [0.6, 0.85], squashY: 0.6, creaseDeg: 40, cracks: 0, moss: 0.2, dirt: 0.4, tint: new Color(0.7, 0.69, 0.64), freq: 1 });
          const ground = T.height(x, z);
          const mtx = pose(T, x, ground - sc * 0.35, z, hash2(i, 40 + j, k0) * Math.PI * 2, 0.6);
          parts.push({ geometry: g, matrix: mtx });
          addCaster(g, mtx, ground, false); // (5 cm stones: no shadow worth following)
          stats.discPebbles++;
        }
      });
    }
  }

  if (!parts.length) return null;
  const empty = new BufferGeometry();
  empty.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3));
  const geometry = mergeRockParts(empty, parts);
  for (const p of parts) p.geometry.dispose();
  stats.triangles = geometry.attributes.position.count / 3;
  return {
    geometry,
    stats,
    contacts,
    casters,
    bodies,
    spheres: (sunDir: Vector3) => [...bodies, ...casters.flatMap((c) => casterSpheres(c, sunDir))],
  };
}
