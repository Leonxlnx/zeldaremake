/**
 * Round 57 (expansion-ruins): the ruins' masonry, as world-space geometry on the live ground.
 *
 * The terrace is a solid block of coursed ashlar (layout `EXPANSION_RUINS.terrace`): every exposed
 * face is built block by block in courses of 0.36–0.56 m, each block chamfered, a little proud or
 * sunk, settled at its corners, greyer toward its foot, over a dark mortar plane that fills the
 * joints; a projecting coping runs round the top. Its top is paving over a moss-and-soil bed —
 * slabs in rows, a few cracked or lost, the trodden line from the stair to the broken arch worn
 * cleaner than the edges. The worn stair is cut into its east front; the retaining wall holds it
 * over the pool and continues along the outcrop as the parapet (posts with basin finials, a blue
 * tile band and a carved interlace panel on both faces). On the terrace: the hero arch on twisted
 * columns (thirteen voussoirs and a keystone with a hanging pendant), the colonnade's lintel on two
 * fluted columns beside a broken stump, the half-fallen arch against the cliff, and the rubble.
 * Down the wall's pool face, from a break in the ruined parapet, the water stair: a landing, a
 * flight of tread stones and a quay along the wall's foot to a platform at the fall's foot.
 *
 * Returns the builders (stone, tile band, carving), the terrace's and the water stair's walk spans
 * (the character ground reads them through `ctx.shared.walkSpans`) and the fallen pieces' blockers.
 */
import { Vector3 } from 'three';
import { EXPANSION_RUINS } from '../layout';
import type { WalkSpan } from '../system';
import { STAIR_RUN, WATER_STAIR_LANDING_X, WATER_STAIR_WEST, inTerrace, stairLocal, waterStairFootprint } from '../terrain/ruins';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { MeshBuilder, block, lathe, type RGB } from './geom';
import { outcropSkin } from './rock';

const R = EXPANSION_RUINS;
const T = R.terrace;
const S = R.stairs;
const W = R.wall;
const A = R.arch;
const P = R.parapet;
const WS = R.waterStair;
const Qy = R.quay;

type Ground = (x: number, z: number) => number;
export interface Blocker {
  x: number;
  z: number;
  r: number;
  top: number;
}

export interface Masonry {
  stone: MeshBuilder;
  tiles: MeshBuilder;
  carving: MeshBuilder;
  spans: WalkSpan[];
  blockers: Blocker[];
  /** where growth can root in the paving as laid (`SharedGeometry.pavingSeats`) */
  seats: [number, number, number][];
  counts: Record<string, number>;
  /** the pieces lying loose on the paving or the ground: their vertex ranges in `stone` (ruins.test.mjs seats them) */
  loose: { kind: 'rubble' | 'drum' | 'lintel'; v0: number; v1: number; onTop: boolean }[];
  /** the lost slabs' beds (x0, x1, z0, z1): the paving's holes */
  lost: [number, number, number, number][];
}

/** the parapet's panel: its centre line (z), half thickness, the tile band's and the carving's heights */
export const PARAPET_Z = W.z + W.half - P.half - 0.02;
const PARAPET_BASE = R.platform.y - 0.02;
const TILE_Y: [number, number] = [PARAPET_BASE + 0.12, PARAPET_BASE + 0.33];
const CARVE_Y: [number, number] = [PARAPET_BASE + 0.39, PARAPET_BASE + 0.69];
const RAIL_Y = PARAPET_BASE + P.height - 0.16;
/** where the parapet's posts stand (the last one clear of the terrace's face) */
export const PARAPET_POSTS = P.posts.map((x) => Math.max(x, P.x1 + 0.25));
/** the hero arch's voussoir ring (the (z, y) plane at x = arch.x): its springing height, intrados and extrados radii, half depth */
export const ARCH_RING = { spring: T.y + A.columnH, r0: A.span / 2, r1: A.span / 2 + 0.5, half: 0.28 };
/** how far a coping stands proud of the face under it (unless a coping says otherwise): deep enough to throw a shade line */
export const COPING_PROUD = 0.12;

const mossNoise = new Noise2D('ruins-moss');
const up = new Vector3(0, 1, 0);

/** a stone's tint: ± 10 % value, a little warmer or cooler, `k` the grime factor */
function stoneCol(rng: Rng, k = 1): RGB {
  const v = k * rng.range(0.88, 1.08);
  const w = rng.range(-0.035, 0.035);
  return [v * (1 + w), v * (1 + w * 0.25), v * (1 - w)];
}

/** the tread top the stair's walker stands on at `u` up the flight (character/ground.ts `stairAt`) */
function treadTop(u: number): number {
  const i = clamp(Math.floor(u / S.tread), 0, S.steps - 1);
  return S.base[1] + (i + 1) * S.rise;
}

/** world (x, z) of the stair's local (u up the flight, v across) */
function stairWorld(u: number, v: number): [number, number] {
  const l = Math.hypot(S.dir[0], S.dir[1]);
  const dx = S.dir[0] / l;
  const dz = S.dir[1] / l;
  return [S.base[0] + u * dx - v * dz, S.base[2] + u * dz + v * dx];
}

export function buildMasonry(rng: Rng, ground: Ground, sun: Vector3): Masonry {
  const mb = new MeshBuilder();
  const tiles = new MeshBuilder();
  const carving = new MeshBuilder();
  const blockers: Blocker[] = [];
  const counts: Record<string, number> = { ashlar: 0, coping: 0, slabs: 0, treads: 0, voussoirs: 0, rubble: 0 };
  const loose: Masonry['loose'] = [];
  const lost: Masonry['lost'] = [];

  /**
   * Moss on a face: `amount` scaled up on the faces turned from the sun (the sun is in the north-west,
   * so the east and south faces are the shaded ones) and on anything facing up, broken into patches.
   */
  const moss = (p: Vector3, n: Vector3, amount: number): number => {
    const shade = 1 - smoothstep(-0.3, 0.5, n.dot(sun));
    const top = smoothstep(0.5, 0.9, n.y);
    const patch = 0.5 + 0.5 * mossNoise.fbm(p.x * 0.42 + p.y * 0.27, p.z * 0.42 - p.y * 0.27, 3);
    return clamp(amount * (0.45 + 0.75 * shade + 0.9 * top) * (0.25 + 1.2 * patch) - 0.06, 0, 1);
  };
  const wetUnder = (y: number) => (p: Vector3) => (p.y < y ? Math.min(1, (y - p.y) / 0.5) : 0);

  // ------------------------------------------------------------------------------------------
  // coursed ashlar faces
  // ------------------------------------------------------------------------------------------
  interface Face {
    a: [number, number];
    b: [number, number];
    /** outward unit normal (x, z) */
    out: [number, number];
    y1: number;
    y0?: number;
    ground?: Ground;
    depth?: number;
    course?: [number, number];
    moss?: number;
    wetBelow?: number;
  }
  const ashlar = (f: Face) => {
    const [ax, az] = f.a;
    const [bx, bz] = f.b;
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    const yaw = Math.atan2(dz, dx);
    const plusB = -dz * f.out[0] + dx * f.out[1] > 0;
    const depth = f.depth ?? 0.42;
    const g = f.ground ?? ground;
    const gAt = (t: number) => g(ax + dx * t + f.out[0] * 0.12, az + dz * t + f.out[1] * 0.12);
    let gMin = Infinity;
    for (let t = 0; t < len; t += 0.4) gMin = Math.min(gMin, gAt(t));
    gMin = Math.min(gMin, gAt(len));
    const y0 = f.y0 ?? gMin - 0.35;
    const [cmin, cmax] = f.course ?? [0.36, 0.52];
    const courses: [number, number][] = [];
    for (let y = f.y1; y > y0 + 0.04; ) {
      const h = rng.range(cmin, cmax);
      courses.push([Math.max(y - h, y0), y]);
      y -= h;
    }
    const out = new Vector3(f.out[0], 0, f.out[1]);
    const wet = f.wetBelow !== undefined ? wetUnder(f.wetBelow) : undefined;
    // the mortar behind the joints: a dark plane 3 cm behind the face
    const pb = (t: number, y: number) => new Vector3(ax + dx * t - f.out[0] * 0.03, y, az + dz * t - f.out[1] * 0.03);
    mb.poly([pb(0, y0), pb(len, y0), pb(len, f.y1), pb(0, f.y1)], out, [0.36, 0.34, 0.3], () => 0.55, wet);
    for (const [c0, c1] of courses) {
      let t = -rng.range(0, 0.8);
      while (t < len) {
        const L = rng.range(0.55, 1.3);
        const t0 = Math.max(t, 0);
        const t1 = Math.min(t + L, len);
        t += L;
        if (t1 - t0 < 0.12) continue;
        const tm = (t0 + t1) / 2;
        const gm = Math.min(gAt(t0), gAt(t1), gAt(tm));
        // a buried block's draws are made too, so a change in the ground re-rolls nothing after it
        const proud = rng.range(-0.012, 0.02);
        const above = (c0 + c1) / 2 - gm;
        const col = stoneCol(rng, 1 - 0.26 * (1 - smoothstep(0, 1.0, above)));
        const yawJ = rng.range(-0.01, 0.01);
        const bevel = rng.range(0.022, 0.05);
        const sag: [number, number, number, number] = [rng.range(-0.012, 0), rng.range(-0.012, 0), rng.range(-0.012, 0), rng.range(-0.012, 0)];
        if (c1 < gm - 0.06) continue;
        const base = (f.moss ?? 0.22) * (0.55 + 0.9 * (1 - smoothstep(0.1, 1.3, above)));
        block(mb, ax + dx * tm + f.out[0] * (proud - depth / 2), (c0 + c1) / 2, az + dz * tm + f.out[1] * (proud - depth / 2), (t1 - t0) / 2 - 0.008, (c1 - c0) / 2 - 0.007, depth / 2, yaw + yawJ, {
          bevel,
          color: col,
          skip: [plusB ? '-b' : '+b'],
          sag,
          mossFn: (p, n) => moss(p, n, base),
          wetFn: wet,
        });
        counts.ashlar++;
      }
    }
  };

  /** a projecting coping along a face's top (its top at `top`), `proud` of the face and `depth` front to back (by default its back 0.44 m behind the face) */
  const coping = (f: { a: [number, number]; b: [number, number]; out: [number, number]; top: number; depth?: number; proud?: number; h?: number; missing?: number; moss?: number }) => {
    const [ax, az] = f.a;
    const [bx, bz] = f.b;
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    const yaw = Math.atan2(dz, dx);
    const proud = f.proud ?? COPING_PROUD;
    const depth = f.depth ?? 0.44 + proud;
    const h = f.h ?? 0.22;
    // a coping that overhangs its face is seen from under it: its underside is closed
    const skip: ('-y')[] = proud > 0.05 ? [] : ['-y'];
    let t = -rng.range(0, 0.4);
    while (t < len) {
      const L = rng.range(0.6, 1.15);
      const t0 = Math.max(t, 0);
      const t1 = Math.min(t + L, len);
      t += L;
      if (t1 - t0 < 0.15) continue;
      if (rng.chance(f.missing ?? 0.04)) continue;
      const tm = (t0 + t1) / 2;
      const off = proud - depth / 2 + rng.range(-0.015, 0.015);
      const top = f.top + rng.range(-0.012, 0.004);
      block(mb, ax + dx * tm + f.out[0] * off, top - h / 2, az + dz * tm + f.out[1] * off, (t1 - t0) / 2 - 0.01, h / 2, depth / 2, yaw + rng.range(-0.02, 0.02), {
        bevel: rng.range(0.03, 0.055),
        color: stoneCol(rng, 1.02),
        skip,
        sag: [rng.range(-0.02, 0), rng.range(-0.02, 0), rng.range(-0.02, 0), rng.range(-0.02, 0)],
        mossFn: (p, n) => moss(p, n, f.moss ?? 0.34),
      });
      counts.coping++;
    }
  };

  const top = T.y;
  const yc = top - 0.22;
  const cutN = S.base[2] - S.width / 2;
  const cutS = S.base[2] + S.width / 2;
  const cutEnd = S.base[0] - STAIR_RUN;
  const wallIn = W.z - W.half;
  const wallOut = W.z + W.half;
  const x0 = T.x0 - 0.9;
  const faces: Face[] = [
    // the terrace's east front, either side of the stair's cut
    { a: [T.x1, wallOut + 0.06], b: [T.x1, cutS], out: [1, 0], y1: yc, y0: R.platform.y - 0.4 },
    { a: [T.x1, cutN], b: [T.x1, T.notchZ], out: [1, 0], y1: yc },
    // round the ivy rock's foot: the notch's return and its east face, then the north face
    { a: [T.x1, T.notchZ], b: [T.notchX, T.notchZ], out: [0, -1], y1: yc },
    { a: [T.notchX, T.notchZ], b: [T.notchX, T.z0], out: [1, 0], y1: yc },
    { a: [T.notchX, T.z0], b: [x0, T.z0], out: [0, -1], y1: yc, moss: 0.3 },
    // the retaining wall over the pool (the terrace's and the outcrop's sections) and its end
    { a: [x0, wallOut], b: [T.x1, wallOut], out: [0, 1], y1: yc, y0: -0.4, course: [0.4, 0.56], wetBelow: R.pool.water + 0.6, moss: 0.3 },
    { a: [T.x1, wallOut], b: [W.x1, wallOut], out: [0, 1], y1: PARAPET_BASE, y0: -0.4, course: [0.4, 0.56], wetBelow: R.pool.water + 0.6, moss: 0.3 },
    { a: [W.x1, wallOut], b: [W.x1, wallIn], out: [1, 0], y1: PARAPET_BASE },
    // the cut's sides: the treads fill the cut to their tops, so the blocks under them are skipped
    { a: [T.x1, cutN], b: [cutEnd, cutN], out: [0, 1], y1: yc, y0: S.base[1] - 0.15, ground: (x, z) => treadTop(stairLocal(x, z).u) },
    { a: [T.x1, cutS], b: [cutEnd, cutS], out: [0, -1], y1: yc, y0: S.base[1] - 0.15, ground: (x, z) => treadTop(stairLocal(x, z).u) },
  ];
  for (const f of faces) ashlar(f);
  // the copings (the wall's covers its whole top); at an outside corner one runs on by the other's overhang
  coping({ a: [T.x1, wallOut + COPING_PROUD], b: [T.x1, cutS], out: [1, 0], top });
  coping({ a: [T.x1, cutN], b: [T.x1, T.notchZ], out: [1, 0], top });
  coping({ a: [T.x1 + COPING_PROUD, T.notchZ], b: [T.notchX, T.notchZ], out: [0, -1], top });
  coping({ a: [T.notchX, T.notchZ], b: [T.notchX, T.z0 - COPING_PROUD], out: [1, 0], top });
  coping({ a: [T.notchX + COPING_PROUD, T.z0], b: [x0, T.z0], out: [0, -1], top, moss: 0.42 });
  coping({ a: [x0, wallOut], b: [T.x1 + COPING_PROUD, wallOut], out: [0, 1], top, depth: W.half * 2 + 0.02 + COPING_PROUD, missing: 0.02 });
  coping({ a: [T.x1, cutN], b: [cutEnd - 0.02, cutN], out: [0, 1], top, depth: 0.45, proud: 0.03 });
  coping({ a: [T.x1, cutS], b: [cutEnd - 0.02, cutS], out: [0, -1], top, depth: 0.45, proud: 0.03 });
  // the outcrop section's inner kerb (the parapet stands on the wall's outer half)
  coping({ a: [T.x1, wallIn], b: [W.x1, wallIn], out: [0, -1], top: R.platform.y + 0.03, depth: 0.32, proud: 0.02, h: 0.2, moss: 0.28 });

  // ------------------------------------------------------------------------------------------
  // the paving: a moss-and-soil bed, slabs in rows, the trodden line worn cleaner
  // ------------------------------------------------------------------------------------------
  const PM = 0.45;
  const paveable = (x: number, z: number): boolean => {
    const xc = Math.max(x, T.x0 + 0.5);
    if (!inTerrace(xc, z, 0)) return false;
    if (z < T.z0 + PM || z > wallIn - 0.03 || x > T.x1 - PM) return false;
    if (z < T.notchZ + PM && x > T.notchX - PM) return false;
    const { u, v } = stairLocal(x, z);
    return !(u > -PM && u < STAIR_RUN && Math.abs(v) < S.width / 2 + PM);
  };
  {
    const bedY = top - 0.075;
    const rects: [number, number, number, number][] = [
      [x0, cutEnd, T.z0, wallIn],
      [cutEnd, T.x1, cutS, wallIn],
      [cutEnd, T.x1, T.notchZ, cutN],
      [cutEnd, T.notchX, T.z0, T.notchZ],
    ];
    for (const [a0, a1, b0, b1] of rects) {
      mb.poly([new Vector3(a0, bedY, b0), new Vector3(a1, bedY, b0), new Vector3(a1, bedY, b1), new Vector3(a0, bedY, b1)], up, [0.24, 0.19, 0.135], () => 0.5, () => 0.25);
    }
  }
  const trodden = (x: number, z: number) => (1 - smoothstep(0.7, 2.2, Math.abs(z - S.base[2]))) * smoothstep(T.x0 + 0.5, T.x0 + 3.5, x);
  const slab = (sx0: number, sx1: number, sz0: number, sz1: number) => {
    const cx = (sx0 + sx1) / 2;
    const cz = (sz0 + sz1) / 2;
    const tr = trodden(cx, cz);
    const dy = rng.range(-0.012, 0.004) * (1 - 0.6 * tr);
    const amount = 0.1 + 0.34 * (1 - tr) + 0.3 * smoothstep(T.x0 + 3.5, T.x0 + 0.8, cx) + 0.15 * smoothstep(T.z0 + 2, T.z0 + 0.6, cz);
    const col = stoneCol(rng, 0.97 + 0.06 * tr);
    block(mb, cx, top - 0.06 + dy, cz, (sx1 - sx0) / 2, 0.06, (sz1 - sz0) / 2, rng.range(-0.012, 0.012), {
      bevel: rng.range(0.014, 0.03),
      color: col,
      skip: ['-y'],
      sag: [rng.range(-0.01, 0.002), rng.range(-0.01, 0.002), rng.range(-0.01, 0.002), rng.range(-0.01, 0.002)],
      mossFn: (p, n) => (n.y > 0.7 ? clamp(amount * (0.3 + 1.1 * (0.5 + 0.5 * mossNoise.fbm(p.x * 0.9, p.z * 0.9, 2))) - 0.08, 0, 1) : moss(p, n, amount + 0.25)),
    });
    counts.slabs++;
  };
  /** a lost slab's bed, grown over: moss cushions humped a little, bare dark soil between, damp at the rim */
  const hole = (sx0: number, sx1: number, sz0: number, sz1: number) => {
    const w = sx1 - sx0;
    const d = sz1 - sz0;
    const nu = Math.max(4, Math.round(w / 0.07));
    const nv = Math.max(4, Math.round(d / 0.07));
    const v0 = mb.vertexCount;
    const t0 = mb.idx.length;
    mb.grid(
      nu,
      nv,
      (u, v) => {
        const x = sx0 + w * u;
        const z = sz0 + d * v;
        const rim = Math.min(u * w, (1 - u) * w, v * d, (1 - v) * d);
        const cushion = smoothstep(-0.3, 0.2, mossNoise.fbm(x * 3.1 + 17, z * 3.1 - 5, 3)) * smoothstep(0.01, 0.08, rim);
        return { p: new Vector3(x, top - 0.071 + 0.024 * cushion, z), c: [0.24, 0.19, 0.135], moss: 0.12 + 0.85 * cushion, wet: 0.4 * (1 - smoothstep(0, 0.12, rim)) };
      },
      true,
    );
    mb.smoothNormals(v0, mb.vertexCount, t0);
  };
  // the colonnade's fallen pieces (the drums' x, z, yaw, radius and length; the lintel's middle, half
  // length, half width and yaw) and the offering: no slab under one of them is lost, so each lies on stone
  const DRUMS: [number, number, number, number, number][] = [
    [-68.1, -7.7, 0.35, 0.28, 0.85],
    [-70.2, -8.3, 1.9, 0.28, 0.7],
    [-67.2, -6.9, -0.6, 0.27, 0.5],
  ];
  const LINTEL = { x: -70.9, z: -7.35, ha: 1.05, hb: 0.27, yaw: 0.42 };
  const underPiece = (x0: number, x1: number, z0: number, z1: number): boolean => {
    const ex = (x1 - x0) / 2;
    const ez = (z1 - z0) / 2;
    /** does the rectangle about (cx, cz), ha along yaw and hb across it, overlap the slab? (separating axes) */
    const meets = (cx: number, cz: number, ha: number, hb: number, yaw: number) => {
      const c = Math.abs(Math.cos(yaw));
      const s = Math.abs(Math.sin(yaw));
      const dx = cx - (x0 + x1) / 2;
      const dz = cz - (z0 + z1) / 2;
      if (Math.abs(dx) > ex + ha * c + hb * s || Math.abs(dz) > ez + ha * s + hb * c) return false;
      return Math.abs(dx * Math.cos(yaw) + dz * Math.sin(yaw)) <= ha + ex * c + ez * s && Math.abs(-dx * Math.sin(yaw) + dz * Math.cos(yaw)) <= hb + ex * s + ez * c;
    };
    if (DRUMS.some(([x, z, yaw, r, len]) => meets(x, z, len / 2 + 0.05, r + 0.05, yaw))) return true;
    if (meets(LINTEL.x, LINTEL.z, LINTEL.ha + 0.05, LINTEL.hb + 0.05, LINTEL.yaw)) return true;
    const O = R.offering;
    return Math.hypot(Math.max(0, Math.abs(O.x - (x0 + x1) / 2) - ex), Math.max(0, Math.abs(O.z - (z0 + z1) / 2) - ez)) < 0.6;
  };
  const seats: [number, number, number][] = [];
  const seatRng = rng.fork('paving-seats');
  for (let z = wallIn - 0.04; z > T.z0 + 0.3; ) {
    const wz = rng.range(0.55, 0.85);
    const za = z - wz;
    const zb = z;
    const gz = rng.range(0.025, 0.04);
    z = za - gz;
    for (let x = x0 + rng.range(0, 0.5); x < T.x1; ) {
      const L = rng.range(0.7, 1.3);
      let sx0 = x;
      let sx1 = x + L;
      let sz0 = za;
      let sz1 = zb;
      const gx = rng.range(0.025, 0.04);
      x = sx1 + gx;
      // shrink to the paveable area
      for (let it = 0; it < 40; it++) {
        const b00 = !paveable(sx0, sz0);
        const b10 = !paveable(sx1, sz0);
        const b11 = !paveable(sx1, sz1);
        const b01 = !paveable(sx0, sz1);
        if (!b00 && !b10 && !b11 && !b01) break;
        if (b10 && b11) sx1 -= 0.05;
        else if (b00 && b01) sx0 += 0.05;
        else if (b01 && b11) sz1 -= 0.05;
        else if (b00 && b10) sz0 += 0.05;
        else if (b11) sz1 -= 0.05;
        else if (b10) sz0 += 0.05;
        else if (b01) sz1 -= 0.05;
        else sz0 += 0.05;
      }
      if (sx1 - sx0 < 0.28 || sz1 - sz0 < 0.25) continue;
      if (!paveable((sx0 + sx1) / 2, (sz0 + sz1) / 2)) continue;
      const r = rng();
      const at = (a: number, b: number, pad: number) => {
        const p = Math.min(pad, (b - a) / 2);
        return a + p + seatRng() * (b - a - 2 * p);
      };
      if (r < 0.06 && !underPiece(sx0, sx1, sz0, sz1)) {
        // lost: a couple of broken pieces left in the bed
        hole(sx0, sx1, sz0, sz1);
        lost.push([sx0, sx1, sz0, sz1]);
        const pieces: [number, number, number][] = [];
        for (let k = rng.int(1, 3); k > 0; k--) {
          const px = sx0 + rng.range(0.15, 0.85) * (sx1 - sx0);
          const pz = sz0 + rng.range(0.2, 0.8) * (sz1 - sz0);
          const s = rng.range(0.08, 0.16);
          block(mb, px, top - 0.07, pz, s, 0.035, s * rng.range(0.6, 1), rng.range(0, Math.PI), { bevel: 0.02, color: stoneCol(rng, 0.9), skip: ['-y'], mossFn: (p, n) => moss(p, n, 0.5) });
          pieces.push([px, pz, s * Math.SQRT2 + 0.05]);
        }
        for (let k = 0; k < 2; k++) {
          for (let tries = 0; tries < 8; tries++) {
            const bx = at(sx0, sx1, 0.1);
            const bz = at(sz0, sz1, 0.1);
            if (pieces.some(([px, pz, pr]) => Math.hypot(bx - px, bz - pz) < pr)) continue;
            seats.push([bx, bz, 1]);
            break;
          }
        }
      } else {
        if (r < 0.15 && sx1 - sx0 > 0.6) {
          // cracked across
          const cxk = sx0 + (sx1 - sx0) * rng.range(0.35, 0.65);
          slab(sx0, cxk - 0.007, sz0, sz1);
          slab(cxk + 0.007, sx1, sz0, sz1);
          seats.push([cxk, at(sz0, sz1, 0.18), 0]);
        } else slab(sx0, sx1, sz0, sz1);
        // its joints: the one on its +x side (running along z, the seat kept 0.18 m off the row's
        // ends so growth strung along it stays in the joint) and the one on its −z side (along x)
        seats.push([sx1 + gx / 2, at(sz0, sz1, 0.18), 0], [at(sx0, sx1, 0.1), sz0 - gz / 2, 2]);
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // the stair: two worn blocks a tread, their nosings rounded and dipped
  // ------------------------------------------------------------------------------------------
  const stairYaw = Math.atan2(S.dir[1], S.dir[0]);
  for (let i = 0; i < S.steps; i++) {
    const t = S.base[1] + (i + 1) * S.rise - 0.004;
    const u0 = i * S.tread - 0.01;
    const u1 = i === S.steps - 1 ? STAIR_RUN - 0.01 : (i + 1) * S.tread + 0.12;
    const split = rng.range(-0.25, 0.25);
    for (const [v0, v1] of [
      [-S.width / 2 + 0.005, split - 0.008],
      [split + 0.008, S.width / 2 - 0.005],
    ]) {
      const [x, z] = stairWorld((u0 + u1) / 2, (v0 + v1) / 2);
      const dip = rng.range(0.012, 0.028);
      const edge = (p: Vector3, n: Vector3) => {
        const { v } = stairLocal(p.x, p.z);
        return n.y > 0.7 ? clamp(0.05 + 0.6 * smoothstep(0.75, 1.2, Math.abs(v)), 0, 1) : moss(p, n, 0.35);
      };
      block(mb, x, t + rng.range(-0.006, 0.003) - 0.17, z, (u1 - u0) / 2, 0.17, (v1 - v0) / 2, stairYaw + rng.range(-0.012, 0.012), {
        bevel: rng.range(0.04, 0.06),
        color: stoneCol(rng, 1.0),
        skip: ['-y'],
        sag: [-dip, -dip * rng.range(0.6, 1.1), rng.range(-0.006, 0), rng.range(-0.006, 0)],
        mossFn: edge,
      });
      counts.treads++;
    }
  }

  // ------------------------------------------------------------------------------------------
  // the terrace section's ruined parapet on the wall top, broken where the water stair's landing
  // is reached (a block reaching more than 0.1 m into `quay.head` is gone; its draws are still made)
  // ------------------------------------------------------------------------------------------
  for (let x = x0 + 0.6; x < T.x1 - 0.4; ) {
    const L = rng.range(0.6, 1.15);
    const xm = x + L / 2;
    x += L + 0.015;
    if (rng.chance(0.3)) continue;
    const h = rng.range(0.32, 0.62);
    const bz = wallOut - 0.23 + rng.range(-0.03, 0.03);
    const yaw = rng.range(-0.04, 0.04);
    const bevel = rng.range(0.035, 0.06);
    const color = stoneCol(rng, 1.0);
    const sag: [number, number, number, number] = [rng.range(-0.05, 0), rng.range(-0.05, 0), rng.range(-0.05, 0), rng.range(-0.05, 0)];
    if (Math.min(xm + L / 2, Qy.head[1]) - Math.max(xm - L / 2, Qy.head[0]) > 0.1) continue;
    block(mb, xm, top + h / 2 - 0.01, bz, L / 2 - 0.01, h / 2, 0.21, yaw, { bevel, color, skip: ['-y'], sag, mossFn: (p, n) => moss(p, n, 0.4) });
  }

  // ------------------------------------------------------------------------------------------
  // the outcrop section's parapet: posts with basin finials, the panel with its tile band and carving, the rail
  // ------------------------------------------------------------------------------------------
  const pz = PARAPET_Z;
  for (const px of PARAPET_POSTS) {
    block(mb, px, PARAPET_BASE + 0.15, pz, 0.26, 0.17, 0.26, 0, { bevel: 0.04, color: stoneCol(rng, 0.94), skip: ['-y'], mossFn: (p, n) => moss(p, n, 0.4) });
    block(mb, px, (PARAPET_BASE + 0.32 + RAIL_Y) / 2, pz, 0.2, (RAIL_Y - PARAPET_BASE - 0.32) / 2, 0.2, rng.range(-0.02, 0.02), { bevel: 0.03, color: stoneCol(rng, 1.0), mossFn: (p, n) => moss(p, n, 0.25) });
    const capY = PARAPET_BASE + P.height;
    block(mb, px, capY - 0.06, pz, 0.27, 0.06, 0.27, rng.range(-0.03, 0.03), { bevel: 0.03, color: stoneCol(rng, 1.03), mossFn: (p, n) => moss(p, n, 0.35) });
    // the basin finial: a stem, a shallow bowl with a rolled lip, a knob in its middle
    const place = (x: number, y: number, z: number) => new Vector3(px + x, y, pz + z);
    const b = capY;
    lathe(
      mb,
      [
        [0.13, b],
        [0.11, b + 0.04],
        [0.075, b + 0.1],
        [0.085, b + 0.14],
        [0.16, b + 0.18],
        [0.25, b + 0.23],
        [0.3, b + 0.28],
        [0.315, b + 0.31],
        [0.3, b + 0.325],
        [0.27, b + 0.3],
        [0.18, b + 0.26],
        [0.0, b + 0.245],
      ],
      26,
      place,
      stoneCol(rng, 1.0),
      (y) => (y > b + 0.27 ? 0.5 : y < b + 0.05 ? 0.3 : 0.1),
      (th, _y, r) => r * (1 + 0.015 * Math.sin(th * 5 + px)),
    );
    lathe(
      mb,
      [
        [0.0, b + 0.24],
        [0.05, b + 0.25],
        [0.055, b + 0.29],
        [0.03, b + 0.32],
        [0.0, b + 0.325],
      ],
      12,
      place,
      stoneCol(rng, 1.0),
      () => 0.2,
    );
  }
  // the panel between the posts (0.36 m, on the wall's outer half) and the rail cap over it
  for (let k = 0; k + 1 < PARAPET_POSTS.length; k++) {
    const xa = Math.max(PARAPET_POSTS[k], PARAPET_POSTS[k + 1]) - 0.2;
    const xb = Math.min(PARAPET_POSTS[k], PARAPET_POSTS[k + 1]) + 0.2;
    for (let x = xa; x > xb + 0.1; ) {
      const L = Math.min(rng.range(0.7, 1.1), x - xb);
      block(mb, x - L / 2, (PARAPET_BASE + RAIL_Y) / 2, pz, L / 2 - 0.006, (RAIL_Y - PARAPET_BASE) / 2 - 0.004, 0.18, 0, { bevel: 0.02, color: stoneCol(rng, 0.98), mossFn: (p, n) => moss(p, n, 0.2) });
      x -= L;
    }
    for (let x = xa; x > xb + 0.1; ) {
      const L = Math.min(rng.range(0.8, 1.3), x - xb);
      block(mb, x - L / 2, RAIL_Y + 0.07, pz, L / 2 - 0.008, 0.07, 0.24, rng.range(-0.015, 0.015), {
        bevel: 0.035,
        color: stoneCol(rng, 1.03),
        sag: [rng.range(-0.015, 0), rng.range(-0.015, 0), rng.range(-0.015, 0), rng.range(-0.015, 0)],
        mossFn: (p, n) => moss(p, n, 0.38),
      });
      x -= L;
    }
    // the tile band and the carved panel, on both faces (u metres along, v across)
    for (const side of [-1, 1]) {
      const zf = pz + side * 0.184;
      const n = new Vector3(0, 0, side);
      const strip = (b: MeshBuilder, y0: number, y1: number, inset: number) => {
        const pts = [new Vector3(xb, y0, zf), new Vector3(xa, y0, zf), new Vector3(xa, y1, zf), new Vector3(xb, y1, zf)];
        b.poly(pts, n, [1, 1, 1], undefined, undefined, (p) => [p.x - xb + inset, (p.y - y0) / (y1 - y0)]);
      };
      strip(tiles, TILE_Y[0], TILE_Y[1], k * 3.1);
      strip(carving, CARVE_Y[0], CARVE_Y[1], k * 2.3);
    }
  }

  // ------------------------------------------------------------------------------------------
  // the hero arch: plinths, twisted shafts, capitals, voussoirs, the keystone and its pendant
  // ------------------------------------------------------------------------------------------
  const off = A.span / 2 + A.columnR;
  const spring = ARCH_RING.spring;
  const shaft0 = top + 0.64;
  const shaft1 = spring - 0.46;
  for (const zc of [A.z - off, A.z + off]) {
    const place = (x: number, y: number, z: number) => new Vector3(A.x + x, y, zc + z);
    block(mb, A.x, top + 0.2, zc, 0.34, 0.28, 0.34, 0, { bevel: 0.045, color: stoneCol(rng, 0.95), skip: ['-y'], mossFn: (p, n) => moss(p, n, 0.45) });
    lathe(
      mb,
      [
        [0.31, top + 0.47],
        [0.32, top + 0.52],
        [0.3, top + 0.58],
        [0.27, top + 0.61],
        [A.columnR, shaft0],
      ],
      28,
      place,
      stoneCol(rng, 0.97),
      () => 0.35,
    );
    const prof: [number, number][] = [];
    for (let k = 0; k <= 72; k++) prof.push([A.columnR, shaft0 + ((shaft1 - shaft0) * k) / 72]);
    // a three-strand barley twist: rounded ridges, sharp grooves, a turn every 0.85 m (the ridges' crest is the column's radius)
    const ridge = (th: number, y: number) => Math.sqrt(0.5 + 0.5 * Math.cos(3 * th - (2 * Math.PI * (y - shaft0)) / 0.85));
    const sv0 = mb.vertexCount;
    lathe(mb, prof, 36, place, stoneCol(rng, 1.0), (y) => 0.16 * (1 - smoothstep(shaft0, shaft0 + 0.8, y)) + 0.1 * smoothstep(shaft1 - 0.5, shaft1, y), (th, y, r) => r * (0.8 + 0.2 * ridge(th, y)));
    // the grooves hold grime: darker toward their floor, so the twist reads through the stone's texture
    for (let k = sv0; k < mb.vertexCount; k++) {
      const g = 0.7 + 0.3 * ridge(Math.atan2(mb.pos[k * 3 + 2] - zc, mb.pos[k * 3] - A.x), mb.pos[k * 3 + 1]);
      for (let j = 0; j < 3; j++) mb.col[k * 3 + j] *= g;
    }
    lathe(
      mb,
      [
        [A.columnR * 0.93, shaft1],
        [0.25, shaft1 + 0.05],
        [0.28, shaft1 + 0.12],
        [0.33, shaft1 + 0.22],
        [0.37, shaft1 + 0.3],
        [0.37, shaft1 + 0.32],
      ],
      28,
      place,
      stoneCol(rng, 1.02),
      (y) => (y > shaft1 + 0.2 ? 0.45 : 0.15),
    );
    block(mb, A.x, spring - 0.07, zc, 0.36, 0.07, 0.36, rng.range(-0.02, 0.02), { bevel: 0.03, color: stoneCol(rng, 1.02), mossFn: (p, n) => moss(p, n, 0.4) });
  }
  // the voussoir ring in the (z, y) plane at x = A.x
  {
    const N = 13;
    const { r0, r1, half: d } = ARCH_RING;
    for (let k = 0; k < N; k++) {
      const key = k === (N - 1) / 2;
      // tight joints (≈ 4 mm): wider ones let the sky through along the approach's line of sight
      const a0 = (k / N) * Math.PI + 0.001;
      const a1 = ((k + 1) / N) * Math.PI - 0.001;
      const ri = key ? r0 - 0.05 : r0 + rng.range(-0.01, 0.01);
      const ro = key ? r1 + 0.17 : r1 + rng.range(-0.02, 0.02);
      const dd = key ? d + 0.03 : d + rng.range(-0.015, 0.01);
      const sag = rng.range(-0.012, 0.004);
      const at = (a: number, r: number, x: number) => new Vector3(A.x + x, spring + r * Math.sin(a) + sag, A.z + r * Math.cos(a));
      const col = stoneCol(rng, key ? 1.04 : 1.0);
      const mossOf = (p: Vector3, n: Vector3) => moss(p, n, 0.3 + 0.25 * smoothstep(spring + 0.8, spring + 2.0, p.y));
      const am = (a0 + a1) / 2;
      // front and back
      for (const sx of [-1, 1]) {
        const ring = [at(a0, ri, sx * dd), at(a1, ri, sx * dd), at(a1, ro, sx * dd), at(a0, ro, sx * dd)];
        mb.poly(ring, new Vector3(sx, 0, 0), col, (p) => mossOf(p, new Vector3(sx, 0, 0)));
      }
      // intrados (two facets), extrados, the joints
      const am2 = [a0, am, a1];
      for (let s = 0; s < 2; s++) {
        const n = new Vector3(0, -Math.sin((am2[s] + am2[s + 1]) / 2), -Math.cos((am2[s] + am2[s + 1]) / 2));
        mb.poly([at(am2[s], ri, -dd), at(am2[s + 1], ri, -dd), at(am2[s + 1], ri, dd), at(am2[s], ri, dd)], n, col, (p) => mossOf(p, n));
        const no = n.clone().negate();
        mb.poly([at(am2[s], ro, -dd), at(am2[s + 1], ro, -dd), at(am2[s + 1], ro, dd), at(am2[s], ro, dd)], no, col, (p) => mossOf(p, no));
      }
      for (const [a, s] of [
        [a0, -1],
        [a1, 1],
      ] as [number, number][]) {
        const n = new Vector3(0, s * Math.cos(a), -s * Math.sin(a));
        mb.poly([at(a, ri, -dd), at(a, ro, -dd), at(a, ro, dd), at(a, ri, dd)], n, col, (p) => mossOf(p, n));
      }
      counts.voussoirs++;
    }
    // the pendant under the keystone: a carved boss hanging from the intrados
    const yk = spring + r0 - 0.05;
    lathe(
      mb,
      [
        [0.0, yk - 0.5],
        [0.05, yk - 0.46],
        [0.1, yk - 0.38],
        [0.16, yk - 0.26],
        [0.13, yk - 0.17],
        [0.16, yk - 0.08],
        [0.14, yk + 0.02],
      ],
      20,
      (x, y, z) => new Vector3(A.x + x, y, A.z + z),
      stoneCol(rng, 1.02),
      () => 0.08,
      (th, y, r) => r * (1 + 0.1 * Math.cos(th * 6) * smoothstep(yk - 0.4, yk - 0.2, y)),
    );
  }

  // ------------------------------------------------------------------------------------------
  // the colonnade: fluted columns carrying a lintel, a broken stump, the fallen pieces
  // ------------------------------------------------------------------------------------------
  const C = R.colonnade;
  const fluted = (x: number, z: number, h: number, broken: boolean) => {
    const place = (lx: number, y: number, lz: number) => new Vector3(x + lx, y, z + lz);
    block(mb, x, top + 0.135, z, 0.42, 0.215, 0.42, rng.range(-0.03, 0.03), { bevel: 0.04, color: stoneCol(rng, 0.94), skip: ['-y'], mossFn: (p, n) => moss(p, n, 0.5) });
    const s0 = top + 0.35;
    const s1 = top + (broken ? h : h - 0.42);
    const prof: [number, number][] = [
      [0.37, s0],
      [0.36, s0 + 0.08],
      [0.31, s0 + 0.14],
    ];
    for (let k = 1; k <= 14; k++) prof.push([0.3 - 0.03 * (k / 14), s0 + 0.14 + ((s1 - s0 - 0.14) * k) / 14]);
    const jag = rng.range(0, 6.28);
    // the break: the top rings lowered progressively (never folding: the drop's slope stays < 1)
    const drop = (th: number) => 0.18 * (0.5 + 0.5 * Math.sin(th * 2 + jag)) + 0.06 * (0.5 + 0.5 * Math.sin(th * 7));
    const flute = (th: number, y: number, r: number) => (y > s0 + 0.13 ? r * (1 - 0.045 * Math.pow(Math.max(0, Math.cos(th * 10)), 0.6)) : r);
    const col = stoneCol(rng, 1.0);
    lathe(
      mb,
      prof,
      32,
      place,
      col,
      (y) => 0.2 + 0.25 * (1 - smoothstep(s0, s0 + 1.0, y)) + (broken ? 0.5 * smoothstep(s1 - 0.3, s1, y) : 0),
      flute,
      broken ? (th, y) => y - drop(th) * smoothstep(s1 - 0.5, s1, y) : undefined,
    );
    if (broken) {
      lathe(mb, [prof[prof.length - 1], [0.0, s1 - 0.1]], 32, place, col, () => 0.75, flute, (th, y) => (y >= s1 - 1e-6 ? y - drop(th) : y));
      blockers.push({ x, z, r: 0.45, top: s1 });
      return;
    }
    lathe(
      mb,
      [
        [0.27, s1],
        [0.3, s1 + 0.1],
        [0.38, s1 + 0.2],
        [0.41, s1 + 0.26],
      ],
      32,
      place,
      stoneCol(rng, 1.02),
      () => 0.35,
    );
    block(mb, x, s1 + 0.34, z, 0.44, 0.08, 0.44, rng.range(-0.03, 0.03), { bevel: 0.03, color: stoneCol(rng, 1.0), mossFn: (p, n) => moss(p, n, 0.45) });
  };
  const standing = C.columns.filter((c) => c[1] > 0);
  for (const [x, h] of C.columns) fluted(x, C.z, Math.abs(h), h < 0);
  if (standing.length >= 2) {
    const xs = standing.map((c) => c[0]);
    const xa = Math.max(...xs) + 0.55;
    const xb = Math.min(...xs) - 0.55;
    const ly = top + standing[0][1] + 0.2;
    block(mb, (xa + xb) / 2, ly, C.z, (xa - xb) / 2, 0.21, 0.27, 0.008, {
      bevel: 0.05,
      color: stoneCol(rng, 1.0),
      sag: [-0.02, 0.01, -0.035, 0.0],
      mossFn: (p, n) => moss(p, n, 0.5),
    });
  }
  // the fallen: a broken lintel and three drums on the terrace, one drum tumbled off its north face
  const lyingDrum = (x: number, z: number, yaw: number, r: number, len: number, y0: number) => {
    const v0 = mb.vertexCount;
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const place = (lx: number, ly: number, lz: number) => {
      // local y runs along the drum's axis (horizontal, along yaw); local x, z round it (a proper rotation, det +1)
      const a = ly - len / 2;
      return new Vector3(x + a * cs + lz * sn, y0 + r + lx, z + a * sn - lz * cs);
    };
    lathe(
      mb,
      [
        [0.0, 0],
        [r * 0.97, 0],
        [r, 0.04],
        [r, len - 0.04],
        [r * 0.97, len],
        [0.0, len],
      ],
      24,
      place,
      stoneCol(rng, 0.97),
      () => 0.35,
      (th, _y, rr) => rr * (1 - 0.045 * Math.pow(Math.max(0, Math.cos(th * 10)), 0.6)),
    );
    loose.push({ kind: 'drum', v0, v1: mb.vertexCount, onTop: y0 > top - 0.1 });
    blockers.push({ x, z, r: Math.max(r, len / 2) * 0.9, top: y0 + 2 * r });
  };
  for (const [x, z, yaw, r, len] of DRUMS) lyingDrum(x, z, yaw, r, len, top - 0.03);
  {
    const { x, z } = LINTEL;
    const v0 = mb.vertexCount;
    block(mb, x, top + 0.19, z, LINTEL.ha, 0.21, LINTEL.hb, LINTEL.yaw, { bevel: 0.05, color: stoneCol(rng, 0.97), skip: ['-y'], sag: [0.02, -0.03, 0.0, -0.05], mossFn: (p, n) => moss(p, n, 0.55) });
    loose.push({ kind: 'lintel', v0, v1: mb.vertexCount, onTop: true });
    blockers.push({ x: x - 0.45, z: z - 0.2, r: 0.55, top: top + 0.4 });
    blockers.push({ x: x + 0.45, z: z + 0.2, r: 0.55, top: top + 0.4 });
  }

  // ------------------------------------------------------------------------------------------
  // the broken arch against the cliff: two piers in courses, a partial ring off the taller one
  // ------------------------------------------------------------------------------------------
  const Bk = R.brokenArch;
  {
    const [zA, zB] = Bk.z;
    const pier = (z: number, n: number) => {
      let y = top;
      for (let c = 0; c < n; c++) {
        const h = rng.range(0.48, 0.56);
        const last = c === n - 1;
        const two = c % 2 === 1;
        const parts = two ? [-0.225, 0.225] : [0];
        for (const pz of parts) {
          if (last && n < 5 && rng.chance(0.5) && parts.length > 1) continue;
          // the first course bedded to the paving's bed, so no lost slab beside it shows its foot
          const bed = c === 0 ? 0.09 : 0;
          block(mb, Bk.x + rng.range(-0.02, 0.02), y + h / 2 - bed / 2, z + pz, two ? 0.45 : 0.46, h / 2 - 0.006 + bed / 2, two ? 0.22 : 0.45, rng.range(-0.02, 0.02) + (last && n < 5 ? rng.range(-0.08, 0.08) : 0), {
            bevel: rng.range(0.03, 0.05),
            color: stoneCol(rng, 1.0 - 0.18 * (1 - smoothstep(0, 1, y - top))),
            skip: c === 0 ? ['-y'] : [],
            sag: last && n < 5 ? [rng.range(-0.12, 0), rng.range(-0.12, 0), rng.range(-0.12, 0), rng.range(-0.12, 0)] : undefined,
            mossFn: (p, nn) => moss(p, nn, 0.35 + (last ? 0.3 : 0)),
          });
        }
        y += h;
      }
      return y;
    };
    const yA = pier(zA, 5);
    pier(zB, 3);
    // the ring's surviving voussoirs, springing off the taller pier toward the gap
    const zc = (zA + zB) / 2;
    const r0 = Math.abs(zB - zA) / 2 - 0.45;
    const r1 = r0 + 0.45;
    const N = 11;
    for (let k = 0; k < 5; k++) {
      const a1 = Math.PI - (k / N) * Math.PI - 0.006;
      const a0 = Math.PI - ((k + 1) / N) * Math.PI + 0.006;
      const d = 0.26;
      const drop = k * 0.012;
      const at = (a: number, r: number, x: number) => new Vector3(Bk.x + x, yA + r * Math.sin(a) - drop, zc + r * Math.cos(a));
      const col = stoneCol(rng, 1.0);
      for (const sx of [-1, 1]) mb.poly([at(a0, r0, sx * d), at(a1, r0, sx * d), at(a1, r1, sx * d), at(a0, r1, sx * d)], new Vector3(sx, 0, 0), col, (p) => moss(p, new Vector3(sx, 0, 0), 0.4));
      const am = (a0 + a1) / 2;
      const ni = new Vector3(0, -Math.sin(am), -Math.cos(am));
      mb.poly([at(a0, r0, -d), at(a1, r0, -d), at(a1, r0, d), at(a0, r0, d)], ni, col, (p) => moss(p, ni, 0.3));
      const no = ni.clone().negate();
      mb.poly([at(a0, r1, -d), at(a1, r1, -d), at(a1, r1, d), at(a0, r1, d)], no, col, (p) => moss(p, no, 0.6));
      for (const [a, s] of [
        [a0, -1],
        [a1, 1],
      ] as [number, number][]) {
        const n = new Vector3(0, s * Math.cos(a), -s * Math.sin(a));
        mb.poly([at(a, r0, -d), at(a, r1, -d), at(a, r1, d), at(a, r0, d)], n, col, (p) => moss(p, n, k === 4 && s < 0 ? 0.6 : 0.3));
      }
      counts.voussoirs++;
    }
    blockers.push({ x: Bk.x + 0.2, z: zc + 0.3, r: 0.5, top: top + 0.5 });
  }

  // ------------------------------------------------------------------------------------------
  // rubble: fallen blocks at the terrace's foot, on the terrace by the broken arch, in the shallows
  // ------------------------------------------------------------------------------------------
  /** the ground as seen: the outcrop's pale skin where it covers the live ground */
  const land = (x: number, z: number) => {
    const h = ground(x, z);
    return Math.max(h, outcropSkin(x, z, h));
  };
  const rubble = (x: number, z: number, s: number, onTop: boolean) => {
    const g = onTop ? top : land(x, z);
    const ha = s * rng.range(0.8, 1.3);
    const hy = s * rng.range(0.45, 0.75);
    const hb = s * rng.range(0.6, 1.0);
    const yaw = rng.range(0, Math.PI);
    const bevel = rng.range(0.03, 0.07);
    const color = stoneCol(rng, 0.94);
    const sag: [number, number, number, number] = [rng.range(-0.12, 0.02), rng.range(-0.12, 0.02), rng.range(-0.12, 0.02), rng.range(-0.12, 0.02)];
    // none under the water stair (its draws are still made)
    if (waterStairFootprint(x, z, Math.hypot(ha, hb))) return;
    // the top where the stone's size and the ground (as seen) under its middle put it; the bottom reaches under
    // the lowest ground round its footprint (on the shelf's slope and the banks a block seated by its
    // middle alone left its downhill corners, and its open underside, over the ground), and on the
    // paving under the slabs' bed (a joint or a lost slab beside it shows the bed, not a gap)
    const yTop = g + hy * 2 - (onTop ? 0.02 : hy * 0.45);
    let yBot = onTop ? top - 0.08 : g - hy * 0.45;
    if (!onTop) {
      const cs = Math.cos(yaw);
      const sn = Math.sin(yaw);
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) yBot = Math.min(yBot, land(x + a * ha * cs - b * hb * sn, z + a * ha * sn + b * hb * cs) - 0.04);
    }
    const loose0 = mb.vertexCount;
    block(mb, x, (yTop + yBot) / 2, z, ha, (yTop - yBot) / 2, hb, yaw, {
      bevel,
      color,
      skip: ['-y'],
      sag,
      mossFn: (p, n) => moss(p, n, 0.55),
      wetFn: g < R.pool.water + 0.3 ? wetUnder(R.pool.water + 0.35) : undefined,
    });
    counts.rubble++;
    loose.push({ kind: 'rubble', v0: loose0, v1: mb.vertexCount, onTop });
    if (s > 0.2) blockers.push({ x, z, r: Math.max(ha, hb) * 0.85, top: g + hy * 1.5 });
    // nothing roots in the paving under a stone lying on it
    if (onTop) {
      const reach = Math.hypot(ha, hb) + 0.03;
      for (let i = seats.length - 1; i >= 0; i--) if (Math.hypot(seats[i][0] - x, seats[i][1] - z) < reach) seats.splice(i, 1);
    }
  };
  const rr = rng.fork('rubble');
  // by the broken arch and the colonnade's stump
  for (let k = 0; k < 7; k++) rubble(Bk.x + rr.range(0.6, 2.4), rr.range(-8.9, -3.3), rr.range(0.12, 0.26), true);
  for (let k = 0; k < 3; k++) rubble(C.columns[C.columns.length - 1][0] + rr.range(-1.2, 1.2), C.z + rr.range(0.5, 1.3), rr.range(0.1, 0.2), true);
  // along the north face's foot
  for (let k = 0; k < 9; k++) rubble(rr.range(-73.5, -64.5), T.z0 - rr.range(0.5, 1.8), rr.range(0.16, 0.34), false);
  // on the outcrop along the parapet's kerb (small: off the walk line, no blockers)
  for (let k = 0; k < 4; k++) rubble(rr.range(-59.8, -56.2), wallIn - rr.range(0.25, 0.5), rr.range(0.1, 0.18), false);
  // in the pool's shallows at the wall's foot (on the shelf's first 0.4 m, so they break the surface)
  for (let k = 0; k < 6; k++) rubble(rr.range(-73.0, -57.0), wallOut + rr.range(0.12, 0.4), rr.range(0.22, 0.36), false);

  // ------------------------------------------------------------------------------------------
  // the water stair down the wall's pool face (its own stream): coursed faces over the water —
  // the strip's south face stepping up under the flight, the platform's at the fall's foot, the
  // landing's east face — a tread stone the flight's full width per step (its end the step's end
  // in the face, standing on the course under it), slabs on the quay, the platform and the landing
  // ------------------------------------------------------------------------------------------
  const wsSpans: WalkSpan[] = [];
  {
    const ws = rng.fork('water-stair');
    const front = Qy.z1;
    const quayBed = Qy.y - 0.12;
    const landBed = top - 0.12;
    const xFoot = WS.base[0];
    const xLand = WATER_STAIR_LANDING_X;
    /** how far the treads and slabs stand proud of the faces under them */
    const oh = 0.04;
    const treadX = (i: number) => xFoot + i * WS.tread;
    const treadTop = (i: number) => WS.base[1] + (i + 1) * WS.rise;
    const n0 = counts.ashlar + counts.treads + counts.slabs;
    let gMin = Infinity;
    for (let x = WATER_STAIR_WEST; x <= Qy.east + 1e-6; x += 0.25) gMin = Math.min(gMin, ground(x, front + 0.12));
    for (let x = WATER_STAIR_WEST; x <= Qy.fallX + 1e-6; x += 0.25) gMin = Math.min(gMin, ground(x, Qy.fallZ + 0.12));
    const y0 = gMin - 0.35;
    // the courses: down from the quay's bed to the foundation, and up from it to the landing's bed in
    // courses of 0.4–0.56 m stretched to meet it exactly
    const courses: [number, number][] = [];
    for (let y = quayBed; y > y0 + 0.04; ) {
      const h = ws.range(0.4, 0.56);
      courses.push([Math.max(y - h, y0), y]);
      y -= h;
    }
    const upper = Array.from({ length: Math.round((landBed - quayBed) / 0.47) }, () => ws.range(0.4, 0.56));
    const upperSum = upper.reduce((a, b) => a + b, 0);
    let yc0 = quayBed;
    upper.forEach((h, k) => {
      const y1 = k === upper.length - 1 ? landBed : yc0 + (h * (landBed - quayBed)) / upperSum;
      courses.push([yc0, y1]);
      yc0 = y1;
    });
    const courseTops = courses.map((c) => c[1]).sort((a, b) => a - b);
    const bedUnder = (y: number) => courseTops.reduce((b, c) => (c <= y + 1e-9 ? c : b), -Infinity);
    // each tread stone stands on the highest course a quarter metre under its top, so the stone above
    // always reaches under the tread below it and the riser is one stone's face; the landing's edge
    // is the last such stone
    const treadBed = Array.from({ length: WS.steps }, (_, i) => bedUnder(treadTop(i) - 0.25));
    /** the landing's edge stone reaches this far east of its riser; the landing's slabs lie beyond it */
    const edgeRun = 0.5;
    /** where a course topping out at y begins along the strip (the flight climbs east) */
    const courseStart = (y: number) => {
      if (y <= quayBed + 1e-9) return -Infinity;
      for (let i = 0; i < WS.steps; i++) if (treadBed[i] >= y - 1e-9) return treadX(i);
      return xLand + edgeRun;
    };
    const plunge = [R.fall.x + 1.1, R.fall.z];
    const spray = (p: Vector3) => 0.85 * (1 - smoothstep(1.5, 5.5, Math.hypot(p.x - plunge[0], p.z - plunge[1])));
    const band = wetUnder(R.pool.water + 0.6);
    const wet = (p: Vector3) => Math.max(band(p), spray(p));
    const damp = (p: Vector3, n: Vector3, amount: number) => clamp(moss(p, n, amount) + 0.35 * spray(p), 0, 1);

    /** a coursed face along a → b (outward `out`), each course from where `from` (distance along) puts it for its top */
    const coursed = (a: [number, number], b: [number, number], out: [number, number], from: (y: number) => number) => {
      const [ax, az] = a;
      const [bx, bz] = b;
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      const yaw = Math.atan2(dz, dx);
      const plusB = -dz * out[0] + dx * out[1] > 0;
      const depth = 0.42;
      const gAt = (t: number) => ground(ax + dx * t + out[0] * 0.12, az + dz * t + out[1] * 0.12);
      const o = new Vector3(out[0], 0, out[1]);
      const pb = (t: number, y: number) => new Vector3(ax + dx * t - out[0] * 0.03, y, az + dz * t - out[1] * 0.03);
      for (const [c0, c1] of courses) {
        const s = Math.max(0, from(c1));
        if (s > len - 0.12) continue;
        mb.poly([pb(s, c0), pb(len, c0), pb(len, c1), pb(s, c1)], o, [0.36, 0.34, 0.3], () => 0.55, wet);
        let t = s - ws.range(0, 0.8);
        while (t < len) {
          const L = ws.range(0.55, 1.3);
          const t0 = Math.max(t, s);
          const t1 = Math.min(t + L, len);
          t += L;
          if (t1 - t0 < 0.12) continue;
          const tm = (t0 + t1) / 2;
          const gm = Math.min(gAt(t0), gAt(t1), gAt(tm));
          const proud = ws.range(-0.012, 0.02);
          const above = (c0 + c1) / 2 - Math.max(gm, R.pool.water);
          const col = stoneCol(ws, 1 - 0.26 * (1 - smoothstep(0, 1.0, above)));
          const yawJ = ws.range(-0.01, 0.01);
          const bevel = ws.range(0.022, 0.05);
          const sag: [number, number, number, number] = [ws.range(-0.012, 0), ws.range(-0.012, 0), ws.range(-0.012, 0), ws.range(-0.012, 0)];
          if (c1 < gm - 0.06) continue;
          const base = 0.3 * (0.55 + 0.9 * (1 - smoothstep(0.1, 1.3, above)));
          block(mb, ax + dx * tm + out[0] * (proud - depth / 2), (c0 + c1) / 2, az + dz * tm + out[1] * (proud - depth / 2), (t1 - t0) / 2 - 0.008, (c1 - c0) / 2 - 0.007, depth / 2, yaw + yawJ, {
            bevel,
            color: col,
            skip: [plusB ? '-b' : '+b'],
            sag,
            mossFn: (p, n) => damp(p, n, base),
            wetFn: wet,
          });
          counts.ashlar++;
        }
      }
    };
    // the platform's south face (its end block's end is the platform's east return), the strip's
    // south face stepping up under the flight, the landing's east face
    coursed([WATER_STAIR_WEST, Qy.fallZ], [Qy.fallX, Qy.fallZ], [0, 1], (y) => (y <= quayBed + 1e-9 ? 0 : Infinity));
    coursed([Qy.fallX, front], [Qy.east, front], [0, 1], (y) => courseStart(y) - Qy.fallX);
    coursed([Qy.east, front - 0.42], [Qy.east, Qy.z0], [1, 0], () => 0);

    // the tread stones: the flight's full width from the wall's face to past the south face, the
    // nosing dipped where feet wear it, moss along the edges, the lowest damp in the spray; the
    // landing's edge stone keeps off the wall's coping (level with it, proud of the face)
    for (let i = 0; i < WS.steps; i++) {
      const edge = i === WS.steps - 1;
      const ta = treadX(i) + 0.003;
      const tb = edge ? xLand + edgeRun - 0.003 : treadX(i + 1) - 0.003;
      const za = edge ? Qy.z0 + COPING_PROUD + 0.025 : Qy.z0 + 0.003;
      const zb = front + oh;
      const t1 = treadTop(i) + ws.range(-0.006, 0.002);
      const b0 = treadBed[i];
      const dip = ws.range(0.012, 0.028);
      block(mb, (ta + tb) / 2, (t1 + b0) / 2, (za + zb) / 2, (tb - ta) / 2, (t1 - b0) / 2, (zb - za) / 2, ws.range(-0.006, 0.006), {
        bevel: ws.range(0.035, 0.055),
        color: stoneCol(ws, 1.0),
        skip: edge ? ['-y'] : ['-y', '-b'],
        sag: [-dip * ws.range(0.5, 0.9), -dip, ws.range(-0.006, 0), ws.range(-0.006, 0)],
        mossFn: (p, n) => (n.y > 0.7 ? clamp(0.04 + 0.6 * smoothstep(0.34, 0.6, Math.abs(p.z - WS.base[2])) + 0.3 * spray(p), 0, 1) : damp(p, n, 0.36)),
        wetFn: wet,
      });
      counts.treads++;
    }

    /** slabs over x0…x1 × z0…z1, their tops at y: rows along x, two across, a few sunk or tilted */
    const slabs = (x0s: number, x1s: number, z0s: number, z1s: number, y: number) => {
      const split = z0s + (z1s - z0s) * ws.range(0.4, 0.6);
      for (const [za, zb] of [
        [z0s, split - 0.004],
        [split + 0.004, z1s],
      ]) {
        for (let x = x0s; x < x1s - 0.1; ) {
          const L = Math.min(ws.range(0.6, 1.1), x1s - x);
          const xa = x + 0.004;
          const xb = x + L - 0.004;
          x += L;
          const t = y + ws.range(-0.01, 0.003);
          block(mb, (xa + xb) / 2, t - 0.06, (za + zb) / 2, (xb - xa) / 2, 0.06, (zb - za) / 2, ws.range(-0.01, 0.01), {
            bevel: ws.range(0.018, 0.034),
            color: stoneCol(ws, 0.98),
            skip: ['-y'],
            sag: [ws.range(-0.012, 0.002), ws.range(-0.012, 0.002), ws.range(-0.012, 0.002), ws.range(-0.012, 0.002)],
            mossFn: (p, n) => (n.y > 0.7 ? clamp(0.1 + 0.5 * smoothstep(0.3, 0.6, Math.abs(p.z - WS.base[2])) * (0.5 + 0.5 * mossNoise.fbm(p.x * 0.9, p.z * 0.9, 2)) + 0.45 * spray(p), 0, 1) : damp(p, n, 0.4)),
            wetFn: wet,
          });
          counts.slabs++;
        }
      }
    };
    // the platform (to the cliff's foot, under its rock), the quay to the flight's foot, the landing
    slabs(WATER_STAIR_WEST, Qy.fallX + oh, Qy.z0 + 0.003, Qy.fallZ + oh, Qy.y);
    slabs(Qy.fallX + oh + 0.008, xFoot - 0.003, Qy.z0 + 0.003, front + oh, Qy.y);
    slabs(xLand + edgeRun + 0.003, Qy.east + oh, Qy.z0 + COPING_PROUD + 0.025, front + oh, top);
    counts.waterStair = counts.ashlar + counts.treads + counts.slabs - n0;

    // its walk spans: the platform and the quay (the flight and the landing are `stairAt`'s), and the
    // crossing from the terrace's paving over the wall's top through the parapet's break
    const zc = WS.base[2];
    wsSpans.push({ id: 'ruins-water-stair-platform', pts: [[WATER_STAIR_WEST, Qy.y, (Qy.z0 + Qy.fallZ) / 2], [Qy.fallX, Qy.y, (Qy.z0 + Qy.fallZ) / 2]], hw: (Qy.fallZ - Qy.z0) / 2 });
    wsSpans.push({ id: 'ruins-water-stair-quay', pts: [[WATER_STAIR_WEST, Qy.y, zc], [xFoot, Qy.y, zc]], hw: WS.width / 2 });
    const xc = (Qy.head[0] + Qy.head[1]) / 2;
    wsSpans.push({ id: 'ruins-water-stair-crossing', pts: [[xc, top, wallIn - 0.25], [xc, top, Qy.z0 + 0.5]], hw: (Qy.head[1] - Qy.head[0]) / 2 - 0.05 });
  }

  // ------------------------------------------------------------------------------------------
  // the terrace's walk spans (rows of polylines, their tops the paving's): the stair's cut is
  // left to the flight (`stairAt`), the strips beside it and the notch to their own rows
  // ------------------------------------------------------------------------------------------
  const spans: WalkSpan[] = [];
  const xWest = T.x0 + 0.3;
  const band = (id: string, z0: number, z1: number, xEast: number) => {
    const n = Math.max(1, Math.round((z1 - z0) / 0.84));
    const hw = (z1 - z0) / n / 2 + 0.01;
    for (let k = 0; k < n; k++) {
      const z = z0 + (k + 0.5) * ((z1 - z0) / n);
      const pts: [number, number, number][] = [];
      const m = Math.max(1, Math.ceil((xEast - xWest) / 1.5));
      for (let j = 0; j <= m; j++) pts.push([xWest + ((xEast - xWest) * j) / m, top, z]);
      spans.push({ id: `ruins-terrace-${id}-${k}`, pts, hw });
    }
  };
  // the south row runs on over the wall's coping to the ruined parapet's inner face: the wall rule
  // holds Link off it, but a boot reaching over it must find the coping, not the ground under the terrace
  band('south', cutS, wallOut - 0.44, T.x1 - 0.05);
  band('cut', cutN, cutS, cutEnd + 0.2);
  band('north', T.notchZ, cutN, T.x1 - 0.05);
  band('back', T.z0 + 0.05, T.notchZ, T.notchX - 0.05);
  spans.push(...wsSpans);

  return { stone: mb, tiles, carving, spans, blockers, seats, counts, loose, lost };
}
