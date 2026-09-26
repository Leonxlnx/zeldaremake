import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from 'three';
import { Rng } from '../core/rng';
import { linearColor, type ColorKey } from '../core/palette';

/**
 * The battle beyond the fleet, 30-60 km out: engagements of capital-ship silhouettes trading turbolaser
 * volleys (every bolt leaves a hull point and ends on one: a strike flash, a fireball, or a near miss that
 * skims past its target), flak round the ships, fighter specks, and two frigates that break up on schedule.
 * A pure function of time: ships drift at constant velocity, and every bolt, flash, spark and puff is
 * scheduled once and evaluated on the GPU from its start time. Bolts and flashes keep a minimum screen size
 * with their brightness scaled by coverage, so at 40 km they neither vanish nor shimmer.
 */

export interface DeepBattle {
  group: Group;
  pose(T: number): void;
}

/** drift positions are given at this time */
const T_REF = 50;
const BOLT_SPEED = 4200;

type Side = 'rep' | 'sep';
type Kind = 'venator' | 'muni' | 'recusant' | 'lucre';

/* ------------------------------------------------------------------ silhouettes */

interface Tri {
  a: Vector3;
  b: Vector3;
  c: Vector3;
  area: number;
  half: number;
}

/** A low-poly hull in ship space (+Z nose, +Y dorsal), split in a front (0) and rear (1) half. */
class Hull {
  pos: number[][] = [[], []];
  col: number[][] = [[], []];
  tris: Tri[] = [];
  engines: { p: Vector3; r: number }[] = [];
  /** the break between the halves (ship space z) */
  breakZ = -1e9;
  private area = 0;
  constructor(private rng: Rng) {}

  tri(a: Vector3, b: Vector3, c: Vector3, key: ColorKey, shade = 1): void {
    const half = (a.z + b.z + c.z) / 3 > this.breakZ ? 0 : 1;
    const k = shade * (0.93 + 0.14 * this.rng.next());
    const col = linearColor(key).multiplyScalar(k);
    for (const p of [a, b, c]) {
      this.pos[half].push(p.x, p.y, p.z);
      this.col[half].push(col.r, col.g, col.b);
    }
    const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    this.area += area;
    this.tris.push({ a, b, c, area, half });
  }
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, key: ColorKey, shade = 1): void {
    this.tri(a, b, c, key, shade);
    this.tri(a, c, d, key, shade);
  }
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, key: ColorKey, shade = 1): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
    this.quad(v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1), key, shade);
    this.quad(v(x0, y0, z0), v(x0, y0, z1), v(x1, y0, z1), v(x1, y0, z0), key, shade * 0.8);
    this.quad(v(x0, y0, z1), v(x0, y1, z1), v(x1, y1, z1), v(x1, y0, z1), key, shade * 0.95);
    this.quad(v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0), key, shade * 0.9);
    this.quad(v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1), key, shade * 0.92);
    this.quad(v(x1, y0, z0), v(x1, y0, z1), v(x1, y1, z1), v(x1, y1, z0), key, shade * 0.92);
  }
  /** disc of radius r facing +Z at (cx, cy, cz), with a rim of depth d */
  dish(cx: number, cy: number, cz: number, r: number, d: number, key: ColorKey): void {
    const n = 10;
    const c = new Vector3(cx, cy, cz + d * 0.5);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = new Vector3(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cz);
      const p1 = new Vector3(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cz);
      this.tri(c, p0, p1, key, 1.05);
      this.quad(p0, p1, p1.clone().setZ(cz - d), p0.clone().setZ(cz - d), key, 0.8);
    }
  }
  /** a uniformly distributed point on the surface (ship space), and its half */
  sample(rng: Rng, keep?: (p: Vector3) => boolean): { p: Vector3; half: number } {
    for (let tries = 0; ; tries++) {
      let x = rng.next() * this.area;
      let t = this.tris[this.tris.length - 1];
      for (const q of this.tris) {
        x -= q.area;
        if (x <= 0) {
          t = q;
          break;
        }
      }
      let u = rng.next(), v = rng.next();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const p = t.a.clone().addScaledVector(t.b.clone().sub(t.a), u).addScaledVector(t.c.clone().sub(t.a), v);
      if (!keep || keep(p) || tries > 30) return { p, half: t.half };
    }
  }
  mesh(half: number, mat: MeshStandardMaterial): Mesh | null {
    if (!this.pos[half].length) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos[half], 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col[half], 3));
    g.computeBoundingSphere();
    return new Mesh(g, mat);
  }
}

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Venator: the dagger, its red dorsal bands, the superstructure and twin bridge towers, three main engines. */
function venatorHull(h: Hull, L: number): void {
  const N = V(0, 0.004 * L, 0.5 * L);
  const Wl = V(-0.245 * L, 0, -0.3 * L), Wr = V(0.245 * L, 0, -0.3 * L);
  const Sl = V(-0.17 * L, 0, -0.46 * L), Sr = V(0.17 * L, 0, -0.46 * L);
  const R = V(0, 0.075 * L, -0.3 * L), Rs = V(0, 0.07 * L, -0.46 * L);
  const Vt = V(0, -0.055 * L, -0.3 * L), Vs = V(0, -0.05 * L, -0.46 * L);
  const band = (a: Vector3, b: Vector3, k: number) => a.clone().lerp(b, k);
  for (const [W, S] of [[Wl, Sl], [Wr, Sr]]) {
    // dorsal: the flight-deck trench along the spine, a red band along the leading edge, grey plating between
    const Rt = band(R, W, 0.07);
    h.tri(N, Rt, R, 'dbg', 0.9);
    const Ni = band(N, Rt, 0.12), Wi = band(W, Rt, 0.12);
    const Nd = band(N, Rt, 0.45), Wd = band(W, Rt, 0.3);
    h.quad(N, W, Wi, Ni, 'red', 0.9);
    h.quad(Ni, Wi, Wd, Nd, 'white', 1);
    h.tri(Nd, Wd, Rt, 'lbg', 1.05);
    h.quad(W, S, Rs, R, 'lbg', 0.95);
    // ventral
    h.tri(N, Vt, W, 'lbg', 0.72);
    h.quad(W, Vt, Vs, S, 'dbg', 0.8);
  }
  h.quad(Sl, Rs, Sr, Vs, 'dbg', 0.7);
  // superstructure, towers, bridges
  h.box(0, 0.095 * L, -0.33 * L, 0.15 * L, 0.05 * L, 0.24 * L, 'lbg', 1);
  h.box(0, 0.125 * L, -0.37 * L, 0.09 * L, 0.02 * L, 0.12 * L, 'white', 1);
  for (const s of [-1, 1]) {
    h.box(s * 0.034 * L, 0.15 * L, -0.4 * L, 0.012 * L, 0.05 * L, 0.045 * L, 'lbg', 0.95);
    h.box(s * 0.034 * L, 0.178 * L, -0.4 * L, 0.055 * L, 0.012 * L, 0.03 * L, 'white', 1.05);
  }
  // engine block
  h.box(0, 0.012 * L, -0.475 * L, 0.24 * L, 0.08 * L, 0.04 * L, 'dbg', 0.75);
  for (const x of [-0.07, 0, 0.07]) h.engines.push({ p: V(x * L, 0.014 * L, -0.5 * L), r: 0.034 * L });
  for (const x of [-0.11, 0.11]) h.engines.push({ p: V(x * L, 0.0, -0.497 * L), r: 0.018 * L });
}

/** Munificent: a long spine, the tall crest up front with its comms dish, a heavy engine block. */
function muniHull(h: Hull, L: number): void {
  h.box(0, 0, -0.06 * L, 0.1 * L, 0.085 * L, 0.78 * L, 'tan', 1);
  h.box(0, 0.052 * L, -0.1 * L, 0.05 * L, 0.02 * L, 0.5 * L, 'darkTan', 1);
  for (const z of [-0.28, -0.12, 0.04]) h.box(0, 0, z * L, 0.15 * L, 0.12 * L, 0.035 * L, 'darkTan', 0.9);
  h.box(0, 0, 0.3 * L, 0.12 * L, 0.6 * L, 0.15 * L, 'tan', 1);
  for (const s of [-1, 1]) h.box(0, s * 0.3 * L, 0.29 * L, 0.2 * L, 0.07 * L, 0.2 * L, 'reddishBrown', 1);
  h.dish(0, 0.02 * L, 0.38 * L, 0.075 * L, 0.02 * L, 'lbg');
  h.box(0, 0, -0.44 * L, 0.2 * L, 0.15 * L, 0.12 * L, 'darkTan', 0.85);
  for (const x of [-0.05, 0.05]) h.engines.push({ p: V(x * L, 0, -0.505 * L), r: 0.05 * L });
}

/** Recusant: needle-thin, a spined bow, the raised midships and its tower, a stack of engines. */
function recusantHull(h: Hull, L: number): void {
  h.box(0, 0, -0.02 * L, 0.055 * L, 0.06 * L, 0.86 * L, 'tan', 1);
  h.tri(V(-0.0275 * L, 0.03 * L, 0.41 * L), V(0.0275 * L, 0.03 * L, 0.41 * L), V(0, 0, 0.5 * L), 'tan', 1.05);
  h.tri(V(0.0275 * L, -0.03 * L, 0.41 * L), V(-0.0275 * L, -0.03 * L, 0.41 * L), V(0, 0, 0.5 * L), 'darkTan', 0.8);
  h.tri(V(-0.0275 * L, 0.03 * L, 0.41 * L), V(0, 0, 0.5 * L), V(-0.0275 * L, -0.03 * L, 0.41 * L), 'tan', 0.9);
  h.tri(V(0.0275 * L, -0.03 * L, 0.41 * L), V(0, 0, 0.5 * L), V(0.0275 * L, 0.03 * L, 0.41 * L), 'tan', 0.9);
  h.box(0, 0.05 * L, -0.08 * L, 0.085 * L, 0.05 * L, 0.3 * L, 'darkTan', 1);
  h.box(0, 0.1 * L, -0.14 * L, 0.03 * L, 0.06 * L, 0.06 * L, 'darkTan', 0.95);
  h.box(0, 0.135 * L, -0.14 * L, 0.06 * L, 0.012 * L, 0.03 * L, 'lbg', 1);
  h.box(0, -0.045 * L, 0.1 * L, 0.02 * L, 0.04 * L, 0.36 * L, 'reddishBrown', 0.9);
  for (const z of [0.18, 0.26, 0.34]) h.box(0, 0, z * L, 0.08 * L, 0.02 * L, 0.02 * L, 'darkTan', 0.9);
  h.box(0, 0, -0.45 * L, 0.1 * L, 0.1 * L, 0.08 * L, 'dbg', 0.8);
  for (const [x, y] of [[-0.025, 0.025], [0.025, 0.025], [0, -0.025]]) h.engines.push({ p: V(x * L, y * L, -0.495 * L), r: 0.03 * L });
}

/** Lucrehulk: the broad ring open at the bow round its core sphere, docking arms at the gap. */
function lucreHull(h: Hull, L: number): void {
  const R = 0.36 * L, w = 0.075 * L, th = 0.035 * L, gap = 0.42, n = 26;
  const pt = (a: number, r: number, y: number) => V(Math.sin(a) * r, y, Math.cos(a) * r);
  for (let i = 0; i < n; i++) {
    const a0 = gap + ((Math.PI * 2 - 2 * gap) * i) / n, a1 = gap + ((Math.PI * 2 - 2 * gap) * (i + 1)) / n;
    // the ring's section: flat top and bottom, a sloped outer rim, the inner wall
    const o0 = pt(a0, R + w, 0), o1 = pt(a1, R + w, 0);
    const t0 = pt(a0, R + w * 0.55, th), t1 = pt(a1, R + w * 0.55, th), b0 = pt(a0, R + w * 0.55, -th), b1 = pt(a1, R + w * 0.55, -th);
    const it0 = pt(a0, R - w, th * 0.7), it1 = pt(a1, R - w, th * 0.7), ib0 = pt(a0, R - w, -th * 0.7), ib1 = pt(a1, R - w, -th * 0.7);
    h.quad(t0, t1, it1, it0, i % 5 === 2 ? 'darkTan' : 'tan', 1);
    h.quad(o0, o1, t1, t0, 'tan', 0.92);
    h.quad(b0, b1, o1, o0, 'darkTan', 0.8);
    h.quad(ib0, ib1, b1, b0, 'darkTan', 0.75);
    h.quad(it0, it1, ib1, ib0, 'dbg', 0.8);
  }
  for (const s of [-1, 1]) {
    const a = s * gap;
    h.quad(pt(a, R + w, 0), pt(a, R + w * 0.55, 0.035 * L), pt(a, R - w, 0.7 * th), pt(a, R - w, -0.7 * th), 'darkTan', 0.85);
    h.box(Math.sin(a) * R * 0.97, 0, Math.cos(a) * R * 0.97 + 0.03 * L, 0.05 * L, 0.03 * L, 0.08 * L, 'reddishBrown', 1);
  }
  // the core sphere, and the spar that ties it to the ring's stern
  const cr = 0.13 * L, nu = 12, nv = 7;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const q = (u: number, v: number) => {
        const th2 = (u / nu) * Math.PI * 2, ph = (v / nv) * Math.PI;
        return V(Math.sin(ph) * Math.cos(th2) * cr, Math.cos(ph) * cr * 0.85, Math.sin(ph) * Math.sin(th2) * cr);
      };
      h.quad(q(i, j), q(i + 1, j), q(i + 1, j + 1), q(i, j + 1), j === 3 ? 'reddishBrown' : 'tan', 1 - 0.05 * j);
    }
  }
  h.box(0, 0, -0.26 * L, 0.06 * L, 0.04 * L, 0.2 * L, 'darkTan', 0.9);
  for (const x of [-0.12, -0.04, 0.04, 0.12]) h.engines.push({ p: V(x * L, 0, -Math.sqrt((R + w) ** 2 - (x * L) ** 2) - 0.01 * L), r: 0.02 * L });
}

const LENGTH: Record<Kind, number> = { venator: 3100, muni: 2300, recusant: 3000, lucre: 8600 };

/* ------------------------------------------------------------------ ships and their motion */

interface Kill {
  T: number;
  /** ship-space break point (the halves turn about it) */
  B: Vector3;
  vel: [Vector3, Vector3];
  spin: [number, number];
  axis: [Vector3, Vector3];
}

interface DeepShip {
  side: Side;
  kind: Kind;
  L: number;
  p0: Vector3;
  vel: Vector3;
  q: Quaternion;
  hull: Hull;
  meshes: (Mesh | null)[];
  kill?: Kill;
}

const _m = new Matrix4(), _r = new Matrix4(), _t = new Matrix4();
const ONE = new Vector3(1, 1, 1);

function halfMatrix(s: DeepShip, half: number, T: number, out = new Matrix4()): Matrix4 {
  const p = s.p0.clone().addScaledVector(s.vel, T - T_REF);
  const k = s.kill;
  if (!k || T < k.T) return out.compose(p, s.q, ONE);
  const dt = T - k.T;
  p.addScaledVector(k.vel[half], dt);
  out.compose(p, s.q, ONE);
  _r.makeRotationAxis(k.axis[half], k.spin[half] * dt);
  _t.makeTranslation(k.B.x, k.B.y, k.B.z);
  out.multiply(_t).multiply(_r);
  _t.makeTranslation(-k.B.x, -k.B.y, -k.B.z);
  return out.multiply(_t);
}
const worldOf = (s: DeepShip, p: Vector3, half: number, T: number) => p.clone().applyMatrix4(halfMatrix(s, half, T, _m));
const aliveAt = (s: DeepShip, T: number) => !s.kill || T < s.kill.T;

/* ------------------------------------------------------------------ the engagements */

interface Engagement {
  /** centre of the engagement */
  c: Vector3;
  /** from the Republic line toward the Separatist line (horizontal) */
  axis: number;
  sep: number;
  rep: Kind[];
  cis: Kind[];
  seed: number;
  /** ship index (Separatist list) broken up at time T */
  kill?: { ship: number; T: number };
  /** Republic ships already burning */
  burning?: number[];
}

// Placed from the space shots' cameras. E1 ahead and a little above the fleet: over the hero Venator's nose in
// the long take, in the open sky of the vultures and missiles shots. E3 ahead to starboard and low, against the
// limb (the long take looking down, the hand reveal, the hangar approach). E2 off the pursuit's starboard bow,
// E4 and E5 behind the buzz-droid close-up and the rescue. All 17-50 km from every camera.
const ENGAGEMENTS: Engagement[] = [
  { c: V(-4000, 1500, 44000), axis: 0.3, sep: 6500, rep: ['venator', 'venator', 'venator'], cis: ['muni', 'recusant', 'muni', 'lucre'], seed: 11, kill: { ship: 0, T: 29.6 } },
  { c: V(38000, -7500, -1000), axis: -1.2, sep: 6000, rep: ['venator', 'venator'], cis: ['recusant', 'muni', 'recusant'], seed: 12, burning: [1] },
  { c: V(16000, -7000, 48000), axis: 2.2, sep: 7000, rep: ['venator', 'venator', 'venator'], cis: ['recusant', 'muni'], seed: 13, kill: { ship: 0, T: 52.4 } },
  { c: V(-30000, -6000, -2000), axis: 0.9, sep: 5500, rep: ['venator', 'venator'], cis: ['muni', 'recusant'], seed: 14 },
  { c: V(30000, -6000, -5000), axis: -0.4, sep: 6500, rep: ['venator', 'venator'], cis: ['muni', 'muni', 'recusant'], seed: 15, burning: [0] },
];

/* ------------------------------------------------------------------ scheduled effects */

interface Bolt {
  t0: number;
  from: Vector3;
  dir: Vector3;
  travel: number;
  len: number;
  col: Color;
  hw: number;
}
/** additive sprites: 0 strike flash, 1 fireball, 2 flak, 3 engine, 4 fighter, 5 hull fire, 6 spark */
interface Sprite {
  t0: number;
  dur: number;
  size: number;
  kind: number;
  pos: Vector3;
  vel: Vector3;
  col: Color;
  seed: number;
  orbit?: [number, number, number, number];
}
interface Puff {
  t0: number;
  dur: number;
  size: number;
  pos: Vector3;
  vel: Vector3;
  seed: number;
}

const BOLT_COL: Record<Side, Color> = { rep: new Color(0.25, 0.62, 2.0).multiplyScalar(6), sep: new Color(2.0, 0.28, 0.16).multiplyScalar(6) };

function intercept(target: (T: number) => Vector3, from: Vector3, tf: number, speed: number): number {
  let ta = tf + target(tf).distanceTo(from) / speed;
  for (let k = 0; k < 3; k++) ta = tf + target(ta).distanceTo(from) / speed;
  return ta;
}

class Schedule {
  bolts: Bolt[] = [];
  sprites: Sprite[] = [];
  puffs: Puff[] = [];
  constructor(private rng: Rng) {}

  bolt(t0: number, from: Vector3, to: Vector3, side: Side, over = 0): void {
    const d = to.clone().sub(from);
    const dist = d.length();
    this.bolts.push({ t0, from, dir: d.divideScalar(dist), travel: dist + over, len: this.rng.range(600, 950), col: BOLT_COL[side], hw: this.rng.range(34, 48) });
  }
  flash(t: number, p: Vector3, size: number, col: Color, vel: Vector3): void {
    this.sprites.push({ t0: t, dur: this.rng.range(0.22, 0.4), size, kind: 0, pos: p, vel, col, seed: this.rng.next() });
  }
  explosion(t: number, p: Vector3, size: number, vel: Vector3, sparks: number, smoke: number): void {
    const r = this.rng;
    this.sprites.push({ t0: t, dur: r.range(0.3, 0.45), size, kind: 0, pos: p, vel, col: new Color(2.2, 1.4, 0.7), seed: r.next() });
    for (let i = 0; i < 3; i++) {
      const o = V(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(size * 0.35);
      this.sprites.push({ t0: t + i * r.range(0.04, 0.12), dur: r.range(1.0, 1.8), size: size * r.range(0.7, 1.1), kind: 1, pos: p.clone().add(o), vel: vel.clone().addScaledVector(o, 0.3), col: new Color(1, 1, 1), seed: r.next() });
    }
    for (let i = 0; i < sparks; i++) {
      const d = V(r.gauss(), r.gauss(), r.gauss()).normalize().multiplyScalar(size * r.range(1.5, 4.5));
      this.sprites.push({ t0: t, dur: r.range(0.8, 2.2), size: size * r.range(0.06, 0.12), kind: 6, pos: p.clone(), vel: vel.clone().add(d), col: new Color(1, 1, 1), seed: r.next() });
    }
    for (let i = 0; i < smoke; i++) {
      const o = V(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(size * 0.4);
      this.puffs.push({ t0: t + r.range(0.15, 0.5), dur: r.range(3.5, 6), size: size * r.range(0.9, 1.5), pos: p.clone().add(o), vel: vel.clone().addScaledVector(o, 0.15), seed: r.next() });
    }
  }
}

/* ------------------------------------------------------------------ GPU layers */

const HIDE = 'gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return;';

const BOLT_VERT = /* glsl */ `
attribute vec3 aFrom; attribute vec3 aDir; attribute vec4 aP; attribute vec4 aC;
uniform float uTime; uniform vec2 uRes;
varying vec3 vCol; varying vec2 vUv; varying float vI;
void main() {
  float s = (uTime - aP.x) * aP.y;
  float head = min(s, aP.z), tail = max(s - aP.w, 0.0);
  if (s <= 0.0 || tail >= aP.z) { ${HIDE} }
  vec4 cH = projectionMatrix * viewMatrix * vec4(aFrom + aDir * head, 1.0);
  vec4 cT = projectionMatrix * viewMatrix * vec4(aFrom + aDir * tail, 1.0);
  if (cH.w <= 1.0 || cT.w <= 1.0) { ${HIDE} }
  vec2 sH = cH.xy / cH.w * 0.5 * uRes, sT = cT.xy / cT.w * 0.5 * uRes;
  vec2 d = sH - sT;
  float L = length(d);
  vec2 t = L > 1e-3 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(t.y, -t.x);
  float along = position.y + 0.5;
  vec4 c = mix(cT, cH, along);
  // half width in pixels, at least 0.8 px; below that the brightness follows the coverage
  float wPx = aC.w * projectionMatrix[1][1] * 0.5 * uRes.y / c.w;
  float hw = max(wPx, 0.8);
  c.xy += (n * position.x * 2.0 * hw + t * (along * 2.0 - 1.0) * hw) * 2.0 / uRes * c.w;
  vUv = vec2(position.x * 2.0, along);
  // a bolt that is only starting out (or all but gone) is shorter than its length: dim it with it
  vI = (wPx / hw) * clamp((head - tail) / aP.w * 1.5, 0.2, 1.0);
  vCol = aC.rgb;
  gl_Position = c;
}`;
const BOLT_FRAG = /* glsl */ `
varying vec3 vCol; varying vec2 vUv; varying float vI;
void main() {
  float x2 = vUv.x * vUv.x;
  float core = exp(-x2 * 9.0), glow = exp(-x2 * 2.5);
  float fade = 0.3 + 0.7 * vUv.y;
  vec3 c = (vec3(1.0, 0.95, 0.9) * core * 2.0 + vCol * glow) * fade * vI;
  gl_FragColor = vec4(c, 1.0);
}`;

const SPRITE_VERT = /* glsl */ `
attribute vec3 aPos; attribute vec3 aVel; attribute vec4 aP; attribute vec4 aC; attribute vec4 aX;
uniform float uTime; uniform vec2 uRes;
varying vec3 vCol; varying vec2 vUv; varying float vI; varying float vSoft;
void main() {
  float age = uTime - aP.x;
  if (age < 0.0 || age > aP.y) { ${HIDE} }
  float u = age / aP.y, k = aP.w, size = aP.z, I = 1.0, soft = 5.0;
  vec3 p = aPos + aVel * age;
  vec3 col = aC.rgb;
  if (k < 0.5) {
    // strike flash: white-hot, then the bolt's colour
    size *= 0.4 + 0.6 * smoothstep(0.0, 0.12, u);
    I = (1.0 - u) * (1.0 - u) * 1.6;
    col = mix(vec3(1.0, 0.92, 0.8), col, smoothstep(0.1, 0.7, u));
  } else if (k < 1.5) {
    // fireball: blooms, cools from yellow-white through orange to a dull red
    size *= 0.3 + 0.7 * sqrt(u);
    I = smoothstep(0.0, 0.04, u) * pow(1.0 - u, 1.6) * 1.2;
    col = mix(mix(vec3(2.6, 1.6, 0.6), vec3(1.6, 0.5, 0.1), smoothstep(0.0, 0.3, u)), vec3(0.45, 0.1, 0.03), smoothstep(0.3, 1.0, u));
    soft = 3.0;
  } else if (k < 2.5) {
    // flak: a sharp pop
    size *= 0.5 + 0.5 * smoothstep(0.0, 0.2, u);
    I = (1.0 - u) * 1.8;
  } else if (k < 3.5) {
    // engine glow, with a slow shimmer
    I = 0.9 + 0.1 * sin(uTime * 23.0 + aC.w * 40.0);
    soft = 3.5;
  } else if (k < 4.5) {
    // fighter: engine speck on an orbit
    float a = aX.z + aX.y * age;
    p += vec3(cos(a) * aX.x, sin(a * 1.7 + aC.w * 6.0) * aX.x * aX.w, sin(a) * aX.x);
    I = smoothstep(0.0, 0.3, age) * smoothstep(0.0, 0.15, aP.y - age);
  } else if (k < 5.5) {
    // fire on a wrecked hull: licks and flickers
    I = (0.55 + 0.45 * sin(uTime * 11.0 + aC.w * 30.0) * sin(uTime * 6.3 + aC.w * 17.0)) * smoothstep(0.0, 0.6, age);
    size *= 0.8 + 0.3 * sin(uTime * 8.0 + aC.w * 50.0);
    soft = 3.0;
  } else {
    // spark: flung out, slowing, cooling
    p = aPos + aVel * (1.0 - exp(-age * 1.2)) / 1.2;
    I = (1.0 - u) * 1.5;
    col = mix(vec3(3.0, 2.2, 1.2), vec3(1.4, 0.35, 0.06), u);
  }
  // pulled toward the camera so a flash on a hull is not half buried in it
  p += normalize(cameraPosition - p) * aP.z * 0.8;
  vec4 c = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (c.w <= 1.0) { ${HIDE} }
  float px = size * projectionMatrix[1][1] * 0.5 * uRes.y / c.w;
  float r = max(px, 1.1);
  I *= (px * px) / (r * r);
  c.xy += position.xy * 4.0 * r / uRes * c.w;
  vUv = position.xy * 2.0;
  vI = I;
  vCol = col;
  vSoft = soft;
  gl_Position = c;
}`;
const SPRITE_FRAG = /* glsl */ `
varying vec3 vCol; varying vec2 vUv; varying float vI; varying float vSoft;
void main() {
  float r2 = dot(vUv, vUv);
  float a = exp(-r2 * vSoft) + 0.12 * exp(-r2 * 1.4);
  gl_FragColor = vec4(vCol * vI * a * smoothstep(1.0, 0.8, r2), 1.0);
}`;

const PUFF_VERT = /* glsl */ `
attribute vec3 aPos; attribute vec3 aVel; attribute vec4 aP;
uniform float uTime; uniform vec2 uRes;
varying vec2 vUv; varying float vA; varying float vSeed;
void main() {
  float age = uTime - aP.x;
  if (age < 0.0 || age > aP.y) { ${HIDE} }
  float u = age / aP.y;
  vec3 p = aPos + aVel * age;
  float size = aP.z * (0.45 + 0.55 * sqrt(u));
  vec4 c = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (c.w <= 1.0) { ${HIDE} }
  float px = size * projectionMatrix[1][1] * 0.5 * uRes.y / c.w;
  float r = max(px, 1.5);
  vA = smoothstep(0.0, 0.12, u) * (1.0 - u) * (1.0 - u) * 0.55 * (px * px) / (r * r);
  c.xy += position.xy * 4.0 * r / uRes * c.w;
  vUv = position.xy * 2.0;
  vSeed = aP.w;
  gl_Position = c;
}`;
const PUFF_FRAG = /* glsl */ `
varying vec2 vUv; varying float vA; varying float vSeed;
void main() {
  float r2 = dot(vUv, vUv);
  float a = exp(-r2 * 3.0) * smoothstep(1.0, 0.7, r2);
  // a lumpy edge
  float ang = atan(vUv.y, vUv.x);
  a *= 0.75 + 0.25 * sin(ang * 5.0 + vSeed * 20.0);
  gl_FragColor = vec4(vec3(0.05, 0.048, 0.05), a * vA);
}`;

function instanced(n: number, attrs: Record<string, [Float32Array, number]>): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  const quad = new PlaneGeometry(1, 1);
  g.index = quad.index;
  g.setAttribute('position', quad.getAttribute('position'));
  for (const [name, [arr, size]] of Object.entries(attrs)) g.setAttribute(name, new InstancedBufferAttribute(arr, size));
  g.instanceCount = n;
  return g;
}

function layer(g: InstancedBufferGeometry, vert: string, frag: string, additive: boolean, order: number): { mesh: Mesh; mat: ShaderMaterial } {
  const mat = new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uTime: { value: 0 }, uRes: { value: new Vector2(1, 1) } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: additive ? AdditiveBlending : NormalBlending,
  });
  const mesh = new Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  const vp = new Vector4();
  mesh.onBeforeRender = (r: WebGLRenderer) => {
    r.getCurrentViewport(vp);
    mat.uniforms.uRes.value.set(vp.z, vp.w);
  };
  return { mesh, mat };
}

/* ------------------------------------------------------------------ build */

export function makeDeepBattle(o: { t0: number; t1: number }): DeepBattle {
  const group = new Group();
  group.name = 'deep-battle';
  const shipMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.12, flatShading: true, side: DoubleSide });
  // a little of the limb's blue over the farthest hulls, so they sit behind the fleet
  shipMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.05, 0.075, 0.13), 0.55 * (1.0 - exp(-length(vViewPosition) / 60000.0)));',
    );
  };

  const ships: DeepShip[] = [];
  const sch = new Schedule(new Rng(9090));
  const byEng: DeepShip[][] = [];
  for (const e of ENGAGEMENTS) {
    const r = new Rng(e.seed * 7919);
    const ax = V(Math.cos(e.axis), 0, Math.sin(e.axis));
    const along = V(-ax.z, 0, ax.x);
    // both lines sail the same way, broadside on
    const heading = along.clone().multiplyScalar(r.chance(0.5) ? 1 : -1);
    const vel = heading.clone().multiplyScalar(r.range(18, 30));
    const list: DeepShip[] = [];
    const place = (kinds: Kind[], side: Side) => {
      const line = kinds.filter((k) => k !== 'lucre').length;
      kinds.forEach((kind, i) => {
        const L = LENGTH[kind] * r.range(0.92, 1.08);
        const big = kind === 'lucre';
        // the battleship holds back behind its line, above it, tipped so its ring reads
        const off = big ? 0 : (i - (line - 1) / 2) * r.range(3600, 4600) + r.range(-600, 600);
        const p0 = e.c
          .clone()
          .addScaledVector(ax, (side === 'rep' ? -0.5 : 0.5) * e.sep + (big ? 7000 : r.range(-900, 900)))
          .addScaledVector(along, off)
          .add(V(0, big ? 2500 : r.range(-1200, 1200), 0));
        const yaw = Math.atan2(heading.x, heading.z) + r.range(-0.25, 0.25);
        const q = new Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
        q.multiply(new Quaternion().setFromAxisAngle(V(1, 0, 0), big ? -0.22 : r.range(-0.08, 0.08)));
        q.multiply(new Quaternion().setFromAxisAngle(V(0, 0, 1), r.range(-0.15, 0.15)));
        const hull = new Hull(new Rng(e.seed * 131 + i * 17 + (side === 'rep' ? 0 : 7)));
        const isVictim = side === 'sep' && e.kill?.ship === i;
        if (isVictim) hull.breakZ = 0.04 * L;
        ({ venator: venatorHull, muni: muniHull, recusant: recusantHull, lucre: lucreHull })[kind](hull, L);
        const s: DeepShip = { side, kind, L, p0, vel: vel.clone(), q, hull, meshes: [hull.mesh(0, shipMat), hull.mesh(1, shipMat)] };
        if (isVictim) {
          const side2 = V(r.gauss(), r.gauss() * 0.3, r.gauss()).normalize().multiplyScalar(22);
          s.kill = {
            T: e.kill!.T,
            B: V(0, 0, 0.04 * L),
            vel: [side2.clone().add(V(0, -14, 0)), side2.clone().negate().add(V(0, -9, 0))],
            spin: [0.05, -0.035],
            axis: [V(1, 0, 0.3).normalize(), V(0.4, 0, 1).normalize()],
          };
        }
        for (const m of s.meshes) if (m) group.add(m);
        list.push(s);
        ships.push(s);
      });
    };
    place(e.rep, 'rep');
    place(e.cis, 'sep');
    byEng.push(list);
    scheduleEngagement(e, list, sch, new Rng(e.seed * 104729), o.t0, o.t1);
  }

  // engines: glow while the ship lives
  for (const s of ships) {
    const end = s.kill ? s.kill.T : o.t1 + 10;
    for (const en of s.hull.engines) {
      sch.sprites.push({
        t0: o.t0 - 5,
        dur: end - (o.t0 - 5),
        size: en.r * 1.7,
        kind: 3,
        pos: worldOf(s, en.p, 1, o.t0 - 5),
        vel: s.vel.clone(),
        col: s.side === 'rep' ? new Color(0.9, 1.25, 2.4) : new Color(1.2, 1.0, 2.2),
        seed: sch.sprites.length * 0.137,
      });
    }
  }

  const bolts = sch.bolts, sprites = sch.sprites, puffs = sch.puffs;
  const bFrom = new Float32Array(bolts.length * 3), bDir = new Float32Array(bolts.length * 3), bP = new Float32Array(bolts.length * 4), bC = new Float32Array(bolts.length * 4);
  bolts.forEach((b, i) => {
    bFrom.set([b.from.x, b.from.y, b.from.z], i * 3);
    bDir.set([b.dir.x, b.dir.y, b.dir.z], i * 3);
    bP.set([b.t0, BOLT_SPEED, b.travel, b.len], i * 4);
    bC.set([b.col.r, b.col.g, b.col.b, b.hw], i * 4);
  });
  const boltL = layer(instanced(bolts.length, { aFrom: [bFrom, 3], aDir: [bDir, 3], aP: [bP, 4], aC: [bC, 4] }), BOLT_VERT, BOLT_FRAG, true, 7);
  const sPos = new Float32Array(sprites.length * 3), sVel = new Float32Array(sprites.length * 3), sP = new Float32Array(sprites.length * 4), sC = new Float32Array(sprites.length * 4), sX = new Float32Array(sprites.length * 4);
  sprites.forEach((s, i) => {
    sPos.set([s.pos.x, s.pos.y, s.pos.z], i * 3);
    sVel.set([s.vel.x, s.vel.y, s.vel.z], i * 3);
    sP.set([s.t0, s.dur, s.size, s.kind], i * 4);
    sC.set([s.col.r, s.col.g, s.col.b, s.seed], i * 4);
    sX.set(s.orbit ?? [0, 0, 0, 0], i * 4);
  });
  const spriteL = layer(instanced(sprites.length, { aPos: [sPos, 3], aVel: [sVel, 3], aP: [sP, 4], aC: [sC, 4], aX: [sX, 4] }), SPRITE_VERT, SPRITE_FRAG, true, 7);
  const pPos = new Float32Array(puffs.length * 3), pVel = new Float32Array(puffs.length * 3), pP = new Float32Array(puffs.length * 4);
  puffs.forEach((p, i) => {
    pPos.set([p.pos.x, p.pos.y, p.pos.z], i * 3);
    pVel.set([p.vel.x, p.vel.y, p.vel.z], i * 3);
    pP.set([p.t0, p.dur, p.size, p.seed], i * 4);
  });
  const puffL = layer(instanced(puffs.length, { aPos: [pPos, 3], aVel: [pVel, 3], aP: [pP, 4] }), PUFF_VERT, PUFF_FRAG, false, 6);
  group.add(puffL.mesh, boltL.mesh, spriteL.mesh);
  const mats = [boltL.mat, spriteL.mat, puffL.mat];

  return {
    group,
    pose(T: number) {
      group.visible = true;
      for (const m of mats) m.uniforms.uTime.value = T;
      for (const s of ships) {
        s.meshes.forEach((m, half) => {
          if (!m) return;
          halfMatrix(s, half, T, m.matrix);
          m.matrixAutoUpdate = false;
          m.matrixWorldNeedsUpdate = true;
        });
      }
    },
  };
}

/* ------------------------------------------------------------------ one engagement's schedule */

function scheduleEngagement(e: Engagement, ships: DeepShip[], sch: Schedule, r: Rng, T0: number, T1: number): void {
  const reps = ships.filter((s) => s.side === 'rep');
  const cis = ships.filter((s) => s.side === 'sep');
  const victim = e.kill ? cis[e.kill.ship] : undefined;
  const center = (s: DeepShip, T: number) => worldOf(s, V(0, 0, 0), 0, T);
  const fire = (att: DeepShip, tgt: DeepShip, T: number, hitP: number) => {
    const m = att.hull.sample(r, (p) => p.y > 0 || att.kind !== 'venator');
    const n = r.chance(0.55) ? 2 : 3;
    const hp = tgt.hull.sample(r);
    for (let k = 0; k < n; k++) {
      const tf = T + k * r.range(0.07, 0.11);
      const from = worldOf(att, m.p.clone().add(V(k * 18, 0, k * 25)), m.half, tf);
      const hit = (t: number) => worldOf(tgt, hp.p, hp.half, t);
      const ta = intercept(hit, from, tf, BOLT_SPEED);
      if (tgt.kill && ta > tgt.kill.T - 0.05) return;
      const aim = hit(ta);
      if (r.chance(hitP)) {
        sch.bolt(tf, from, aim, att.side);
        const v = tgt.vel.clone();
        if (r.chance(0.1)) sch.explosion(ta, aim, r.range(260, 420), v, 8, 1);
        else sch.flash(ta, aim, r.range(240, 420), att.side === 'rep' ? new Color(0.9, 1.3, 2.6) : new Color(2.6, 0.9, 0.5), v);
      } else {
        // near miss: skims past the hull and flies on into the dark
        const off = V(r.gauss(), r.gauss(), r.gauss()).normalize().multiplyScalar(r.range(0.12, 0.3) * tgt.L);
        sch.bolt(tf, from, aim.add(off), att.side, r.range(3000, 6000));
      }
    }
  };

  // the line of battle: volleys every ~0.1 s
  for (let T = T0 + r.range(0, 0.1); T < T1; T += r.range(0.06, 0.16)) {
    const live = ships.filter((s) => aliveAt(s, T + 0.5));
    const att = r.pick(live);
    let foes = live.filter((s) => s.side !== att.side);
    if (!foes.length) continue;
    if (victim && att.side === 'rep' && aliveAt(victim, T + 2) && T > victim.kill!.T - 5 && r.chance(0.6)) foes = [victim];
    const c = center(att, T);
    foes.sort((a, b) => center(a, T).distanceTo(c) - center(b, T).distanceTo(c));
    const tgt = foes[Math.min(foes.length - 1, r.chance(0.65) ? 0 : r.int(0, 2))];
    fire(att, tgt, T, 0.84);
  }

  // flak round every ship: point-defence bursts, more of them on the enemy's side
  for (const s of ships) {
    const rate = s.side === 'rep' ? 4.5 : 2.5;
    const foe = (s.side === 'rep' ? cis : reps)[0];
    for (let T = T0 + r.range(0, 0.4); T < T1; T += r.range(0.4, 1.6) / rate) {
      if (!aliveAt(s, T)) break;
      const c = center(s, T);
      const toFoe = foe ? center(foe, T).sub(c).normalize() : V(0, 0, 1);
      const d = V(r.gauss(), r.gauss() * 0.6, r.gauss()).normalize();
      if (d.dot(toFoe) < -0.2) d.addScaledVector(toFoe, 1.2).normalize();
      const p = c.addScaledVector(d, s.L * r.range(0.35, 0.8));
      sch.sprites.push({ t0: T, dur: r.range(0.22, 0.4), size: r.range(90, 170), kind: 2, pos: p, vel: s.vel.clone(), col: s.side === 'rep' ? new Color(2.4, 1.8, 1.0) : new Color(2.6, 1.1, 0.5), seed: r.next() });
    }
  }

  // fighters: hunters on the tails of prey that burst every few seconds, a new one joining across the orbit
  for (let i = 0; i < 16; i++) {
    const c = e.c.clone().add(V(r.range(-2500, 2500), r.range(-900, 900), r.range(-2500, 2500)));
    const R = r.range(260, 700);
    const w = (r.range(200, 290) / R) * (r.chance(0.5) ? 1 : -1);
    const ph = r.range(0, Math.PI * 2), tilt = r.range(-0.4, 0.4);
    const drift = ships[0].vel.clone();
    const warm = new Color(2.6, 1.3, 0.55), cool = new Color(0.9, 1.3, 2.6);
    const repHunts = r.chance(0.6);
    // an orbit's centre is c at T_REF and drifts with the ships; each sprite gives it (and the phase) at its own start
    const hub = (t: number) => c.clone().addScaledVector(drift, t - T_REF);
    sch.sprites.push({ t0: T0 - 5, dur: T1 - T0 + 15, size: 26, kind: 4, pos: hub(T0 - 5), vel: drift, col: repHunts ? warm : cool, seed: r.next(), orbit: [R, w, ph + w * (T0 - 5), tilt] });
    // prey lives one period at a time, a little ahead of its hunter
    for (let t = T0 - 5 + r.range(0, 4); t < T1 + 5; ) {
      const life = r.range(4, 8);
      const lead = Math.sign(w) * r.range(0.4, 0.7);
      const ph0 = ph + lead + w * t;
      const seed = r.next();
      sch.sprites.push({ t0: t, dur: life, size: 22, kind: 4, pos: hub(t), vel: drift, col: repHunts ? cool : warm, seed, orbit: [R, w, ph0, tilt] });
      const tk = t + life;
      const a = ph0 + w * life;
      const at = hub(tk).add(V(Math.cos(a) * R, Math.sin(a * 1.7 + seed * 6) * R * tilt, Math.sin(a) * R));
      sch.explosion(tk, at, r.range(70, 110), drift, 5, 0);
      t = tk + r.range(0.8, 1.6);
    }
  }

  // Republic ships already burning: fires on the hull, and now and then something inside goes up
  for (const i of e.burning ?? []) {
    const s = reps[i];
    for (let k = 0; k < 4; k++) {
      const hp = s.hull.sample(r, (p) => p.y > 0);
      sch.sprites.push({ t0: T0 - 5, dur: T1 - T0 + 15, size: r.range(70, 120), kind: 5, pos: worldOf(s, hp.p, hp.half, T0 - 5), vel: s.vel.clone(), col: new Color(1.9, 0.55, 0.12), seed: r.next() });
    }
    for (let T = T0 + r.range(0, 3); T < T1; T += r.range(2.5, 6)) {
      const hp = s.hull.sample(r);
      sch.explosion(T, worldOf(s, hp.p, hp.half, T), r.range(300, 480), s.vel.clone(), 10, 2);
    }
  }

  // the victim: explosions walk along its hull in its last seconds, it goes up, and its halves drift apart burning
  if (victim) {
    const k = victim.kill!;
    for (let j = 0; j < 9; j++) {
      const T = k.T - 3.2 + j * 0.36 + r.range(-0.08, 0.08);
      const hp = victim.hull.sample(r, (p) => p.z > k.B.z + (0.5 - j / 9) * victim.L * 0.6 - 0.2 * victim.L && p.z < k.B.z + (0.5 - j / 9) * victim.L * 0.6 + 0.2 * victim.L);
      sch.explosion(T, worldOf(victim, hp.p, hp.half, T), r.range(320, 520), victim.vel.clone(), 10, 1);
    }
    const B = worldOf(victim, k.B, 0, k.T);
    sch.explosion(k.T, B, 1300, victim.vel.clone(), 40, 6);
    for (let j = 0; j < 5; j++) {
      const o = V(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(500);
      sch.explosion(k.T + r.range(0.1, 0.6), B.clone().add(o), r.range(600, 900), victim.vel.clone().addScaledVector(o, 0.08), 10, 2);
    }
    for (const half of [0, 1]) {
      const v = victim.vel.clone().add(k.vel[half]);
      for (let j = 0; j < 3; j++) {
        const o = V(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(90);
        sch.sprites.push({ t0: k.T + 0.3, dur: T1 - k.T + 10, size: r.range(90, 150), kind: 5, pos: B.clone().add(o).addScaledVector(v, 0.3), vel: v, col: new Color(1.9, 0.55, 0.12), seed: r.next() });
      }
      for (let T = k.T + r.range(1.0, 2.5); T < T1; T += r.range(1.6, 4.0)) {
        const hp = victim.hull.sample(r, (p) => (half === 0 ? p.z > k.B.z : p.z < k.B.z));
        sch.explosion(T, worldOf(victim, hp.p, half, T), r.range(260, 460), v, 8, 1);
      }
    }
  }
}
