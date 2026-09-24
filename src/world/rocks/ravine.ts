/**
 * The south ravine's rock (fable-2, rocks lane; the owner's 06:07 rubric for every new area — "the
 * outline is irregular and hand-built", "stone as stone", "weathering follows exposure"):
 * expansion-south's gorge (terrain/south.ts) is carved ground painted rock-and-moss by the splat, and
 * from the rims and the deck its walls read as smooth brown banks. This module puts stone INTO them:
 *
 *  - OUTCROPS on both walls: bedded shelves (rockgen `strata`) 1.2–2 m across, half-sunk into the
 *    wall mid-height, their long axis along the gorge, moss on the upper side, damp below — the
 *    strata the profile's sub-metre steps hint at, made solid every 4–5 m along each wall
 *  - FLOOR BOULDERS in the mist: rounded, moss-capped, half-buried on the channel's shoulders
 *
 * WHERE is the ravine's own analytic profile (`ravineProfile`, `bridgeLocal`): nothing stands within
 * the bridge's frame at the lips (the sills and the deck's approach), on the paving or on a structure.
 * Every piece is seated on the LIVE terrain (the gorge exists only there). One merged geometry, one
 * draw, toggled with expansion locality's frustum + shadow-sweep spheres exactly like the plaza's
 * backside, so the six hero cameras never draw it. Own stream (`ravine`).
 */
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import { getTerrain, type Terrain } from '../terrain/heightfield';
import { RAVINE_BOX, bridgeLocal, ravineProfile } from '../terrain/south';
import { hash2 } from '../util/prng';
import type { Rng } from '../util/prng';
import { casterSpheres, type Caster } from '../util/expansionLocality';
import { buildRock } from './rockgen';
import { mergeRockParts } from './dressing';

export interface RavineBuild {
  geometry: BufferGeometry;
  stats: { outcrops: number; floorBoulders: number; triangles: number };
  /** seat points (x, y, z): the wall / floor point each piece is sunk into */
  contacts: [number, number, number][];
  /** per piece: the wall depth fraction (0 lip … 1 floor) and the bridge-frame across distance */
  seats: { g: number; across: number; side: number }[];
  casters: Caster[];
  bodies: Sphere[];
  spheres(sunDir: Vector3): Sphere[];
}

/** along-gorge spacing of the outcrop buckets (m) and of the floor boulders */
export const OUTCROP_STEP_M = 4.4;
export const FLOOR_STEP_M = 6.5;
/** the wall band the outcrops sit in (depth fraction, 0 lip … 1 floor) */
export const OUTCROP_BAND: [number, number] = [0.26, 0.74];
/** no piece this close to the bridge axis where it could touch the sills / the deck's approach (m) */
export const BRIDGE_CLEAR_M = 2.6;
/** the gorge must be this deep for a wall to take an outcrop (its shallow ends stay soil) */
export const MIN_DEPTH_M = 3.5;

const _up = new Vector3(0, 1, 0);
const _n = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);

function casterOf(geometry: BufferGeometry, matrix: Matrix4, ground: number, shadow: boolean): { caster: Caster; body: Sphere } {
  geometry.computeBoundingSphere();
  const body = geometry.boundingSphere!.clone().applyMatrix4(matrix) as Sphere;
  body.radius += 0.02;
  return { caster: { x: body.center.x, z: body.center.z, r: body.radius, y0: Math.min(ground, body.center.y - body.radius), y1: body.center.y + body.radius, shadow }, body };
}

/** a pose on the wall: the piece's up leans `lean` of the way from world up to the terrain normal, then yaws about its own up */
function pose(T: Terrain, x: number, y: number, z: number, yaw: number, lean: number): Matrix4 {
  T.normal(x, z, _n);
  _q.setFromUnitVectors(_up, _up.clone().lerp(_n, lean).normalize());
  _q2.setFromAxisAngle(_up, yaw);
  _q.multiply(_q2);
  _p.set(x, y, z);
  return new Matrix4().compose(_p, _q, _s);
}

interface Candidate {
  x: number;
  z: number;
  g: number;
  s: number;
  side: number;
  D: number;
  across: number;
  fx: number;
  fz: number;
}

export function buildRavineRocks(rng: Rng, seed: string, shadeDir: [number, number]): RavineBuild | null {
  const T = getTerrain();
  const parts: { geometry: BufferGeometry; matrix: Matrix4 }[] = [];
  const contacts: [number, number, number][] = [];
  const seats: { g: number; across: number; side: number }[] = [];
  const casters: Caster[] = [];
  const bodies: Sphere[] = [];
  const stats = { outcrops: 0, floorBoulders: 0, triangles: 0 };
  const addCaster = (g: BufferGeometry, mtx: Matrix4, ground: number) => {
    const c = casterOf(g, mtx, ground, true);
    casters.push(c.caster);
    bodies.push(c.body);
  };
  const dirLocal = (d: [number, number], yaw: number): [number, number] => [d[0] * Math.cos(yaw) - d[1] * Math.sin(yaw), d[0] * Math.sin(yaw) + d[1] * Math.cos(yaw)];

  // --- candidates: the gorge sampled on a half-metre grid, read through its own profile ----------
  const wallBuckets = new Map<string, Candidate[]>();
  const floorBuckets = new Map<string, Candidate[]>();
  const step = 0.5;
  for (let x = RAVINE_BOX.x0; x <= RAVINE_BOX.x1; x += step) {
    for (let z = RAVINE_BOX.z0; z <= RAVINE_BOX.z1; z += step) {
      const prof = ravineProfile(x, z);
      if (!prof || prof.cut <= 0.05 || prof.hit.D < MIN_DEPTH_M) continue;
      // (`prof.hit` is the profile's shared scratch object — the terrain's own mask / height queries
      // run the profile again on their way, so every field is copied out before any other call)
      const c: Candidate = { x, z, g: prof.g, s: prof.hit.s, side: prof.hit.side, D: prof.hit.D, across: Math.abs(bridgeLocal(x, z).c), fx: prof.fx, fz: prof.fz };
      const m = T.mask(x, z);
      if (m.path > 0.05 || m.structure > 0.3 || m.stairs > 0.2) continue;
      if (c.g >= OUTCROP_BAND[0] && c.g <= OUTCROP_BAND[1]) {
        // the wall under the bridge is in view from the deck, but nothing stands where the sills' logs lie
        if (c.across < BRIDGE_CLEAR_M && c.g < 0.45) continue;
        const key = `${c.side}/${Math.floor(c.s / OUTCROP_STEP_M)}`;
        (wallBuckets.get(key) ?? wallBuckets.set(key, []).get(key)!).push(c);
      } else if (c.g >= 0.93 && c.across >= BRIDGE_CLEAR_M) {
        const key = `${Math.floor(c.s / FLOOR_STEP_M)}`;
        (floorBuckets.get(key) ?? floorBuckets.set(key, []).get(key)!).push(c);
      }
    }
  }

  // --- the outcrops --------------------------------------------------------------------------------
  const oRng = rng.fork('outcrops');
  const stoneTint = new Color(0.72, 0.7, 0.64);
  for (const [key, cands] of [...wallBuckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const [sideS, bucketS] = key.split('/');
    const bucket = Number(bucketS);
    const side = Number(sideS);
    // a bucket in four stays bare wall, so the shelves are not a row
    if (hash2(bucket, side * 7 + 3, 11) < 0.25) continue;
    const gTarget = OUTCROP_BAND[0] + (OUTCROP_BAND[1] - OUTCROP_BAND[0]) * hash2(bucket, side * 7 + 5, 11);
    const sTarget = (bucket + 0.2 + 0.6 * hash2(bucket, side * 7 + 9, 11)) * OUTCROP_STEP_M;
    let best: Candidate | null = null;
    let bestD = Infinity;
    for (const c of cands) {
      const d = Math.abs(c.g - gTarget) * 3 + Math.abs(c.s - sTarget) / OUTCROP_STEP_M;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) continue;
    const h = hash2(bucket, side * 7 + 13, 11);
    // 1.6–2.8 m across, a little bigger where the gorge is deep (the first cut's 1.2–2 m, half-sunk along
    // the wall's normal and toned like the splat, did not read from the deck at all)
    const r = 0.8 + 0.4 * h + 0.1 * Math.min(1, (best.D - MIN_DEPTH_M) / 6);
    // the long axis runs along the gorge: yaw the rock's local x onto the wall's strike
    const strike = Math.atan2(-best.fz, best.fx) + (hash2(bucket, side * 7 + 17, 11) - 0.5) * 0.5;
    const g = buildRock(oRng.fork(key), `${seed}/ravine-${key}`, {
      radius: r,
      detail: 12,
      ridge: 0.1,
      lump: 0.24,
      crown: 0.1,
      cuts: 2,
      cutUp: [-0.2, 0.5],
      cutDepth: [0.82, 0.94],
      // a thick bed: flattened on the world's vertical (the pose keeps the rock's up near world up),
      // long along the strike, protruding from the wall
      squashY: 0.5,
      creaseDeg: 34,
      strata: 0.16,
      strataCrown: 0.6,
      cracks: 0.4,
      crackDepth: 0.018,
      fineCracks: 0.35,
      fineCrackDepth: 0.007,
      micro: 0.02,
      chip: 0.012,
      rimRound: 0.12,
      // damp gorge stone: moss on the upper side toward the sky, the lower half wet and dark
      moss: 0.32,
      mossThickness: Math.min(0.1, 0.08 / r),
      mossLumpy: 0.8,
      mossSide: 0.3,
      mossShade: dirLocal(shadeDir, strike),
      dirt: 0.5,
      collarBand: [0.1, 0.45],
      tint: stoneTint,
      lichen: 0.12,
      freq: 0.95,
    });
    const ground = T.height(best.x, best.z);
    // sunk into the wall along its horizontal normal (the wall is ~75°): half the bed protrudes
    T.normal(best.x, best.z, _n);
    const hn = Math.hypot(_n.x, _n.z) || 1;
    const sink = 0.45 * r;
    const cx = best.x - (_n.x / hn) * sink;
    const cy = ground + 0.05 * r;
    const cz = best.z - (_n.z / hn) * sink;
    const mtx = pose(T, best.x, cy, best.z, strike, 0.2);
    mtx.setPosition(cx, cy, cz);
    parts.push({ geometry: g, matrix: mtx });
    contacts.push([best.x, ground, best.z]);
    seats.push({ g: best.g, across: best.across, side });
    addCaster(g, mtx, ground);
    stats.outcrops++;
  }

  // --- the floor boulders --------------------------------------------------------------------------
  const fRng = rng.fork('floor');
  const floorTint = new Color(0.78, 0.74, 0.66);
  for (const [key, cands] of [...floorBuckets.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const bucket = Number(key);
    if (hash2(bucket, 23, 11) < 0.3) continue;
    // toward one shoulder of the channel, not on the walk line down the middle
    const wantSide = hash2(bucket, 29, 11) < 0.5 ? -1 : 1;
    const sTarget = (bucket + 0.25 + 0.5 * hash2(bucket, 31, 11)) * FLOOR_STEP_M;
    let best: Candidate | null = null;
    let bestD = Infinity;
    for (const c of cands) {
      const d = Math.abs(c.s - sTarget) / FLOOR_STEP_M + (c.side === wantSide ? 0 : 0.6) + Math.abs(c.g - 0.96) * 4;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) continue;
    const r = 0.75 + 0.6 * hash2(bucket, 37, 11);
    const yaw = Math.PI * 2 * hash2(bucket, 41, 11);
    const g = buildRock(fRng.fork(key), `${seed}/ravine-floor-${key}`, {
      radius: r,
      detail: 12,
      ridge: 0.12,
      lump: 0.3,
      crown: 0.16,
      cuts: 2,
      cutUp: [-0.3, 0.4],
      cutDepth: [0.84, 0.95],
      squashY: 0.72,
      creaseDeg: 32,
      cracks: 0.4,
      crackDepth: 0.02,
      fineCracks: 0.4,
      fineCrackDepth: 0.008,
      micro: 0.02,
      chip: 0.015,
      rimRound: 0.1,
      moss: 0.7,
      mossThickness: Math.min(0.12, 0.1 / r),
      mossLumpy: 0.9,
      mossSide: 0.3,
      mossShade: dirLocal(shadeDir, yaw),
      dirt: 0.6,
      collarBand: [0.1, 0.45],
      tint: floorTint,
      lichen: 0.2,
      freq: 0.9,
    });
    let gs = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      gs += T.height(best.x + Math.cos(a) * r * 0.5, best.z + Math.sin(a) * r * 0.5);
    }
    const ground = gs / 8;
    const cy = ground + r * 0.72 * 0.62 - 0.3 * 2 * r * 0.72;
    const mtx = pose(T, best.x, cy, best.z, yaw, 0.3);
    parts.push({ geometry: g, matrix: mtx });
    contacts.push([best.x, T.height(best.x, best.z), best.z]);
    seats.push({ g: best.g, across: best.across, side: best.side });
    addCaster(g, mtx, ground);
    stats.floorBoulders++;
  }

  if (!parts.length) return null;
  const empty = new BufferGeometry();
  empty.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3));
  const geometry = mergeRockParts(empty, parts);
  stats.triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  return {
    geometry,
    stats,
    contacts,
    seats,
    casters,
    bodies,
    spheres(sunDir: Vector3) {
      return [...bodies, ...casters.flatMap((c) => casterSpheres(c, sunDir))];
    },
  };
}
