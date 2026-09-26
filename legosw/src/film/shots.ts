import { Box3, Color, Euler, Matrix4, Object3D, Quaternion, Vector3, type Mesh } from 'three';
import { DEFAULT_LENS, type Lens } from '../render/pipeline';
import { Rng, noise1 } from '../core/rng';
import type { FaceState, Mouth } from '../assets/prints';
import type { Minifig } from '../assets/minifig';
import type { BuzzDroid, Eta2 } from '../assets/types';
import type { LaserColor } from '../fx/fx';
import { World, SUN_DIR, VICTIM_POSE } from './world';
import { HAND_POS, HAND_YAW, LONG_T0, poseSwarms, scheduleCapitalFire, scheduleDogfights, vFrame } from './battle';
import { JUMP_OUT } from './choreo';
import { basisQuat, clamp, flight, keyed, lerp, local, place, shake, smooth, smoother, v3, type FlightState, type Key } from './motion';

/**
 * The shot list — the Battle over Coruscant, beat for beat. Each shot poses the whole world as a
 * pure function of time and returns the camera; `schedule` registers its time-pure effects.
 */

export interface Cam {
  pos: Vector3;
  target: Vector3;
  fov: number;
  roll?: number;
  lens?: Partial<Lens>;
  near?: number;
}

export interface Line {
  t0: number;
  t1: number;
  who: string;
  text: string;
}

export interface Shot {
  name: string;
  dur: number;
  start?: number;
  /** full-frame card: skip 3D rendering */
  card?: boolean;
  /** minimum motion-blur sub-frames when the render asks for motion blur at all (very fast shots) */
  blur?: number;
  /** shutter as a fraction of the frame (default: the render's, 0.5) */
  shutter?: number;
  /** background bolts nearer the camera than this are hidden so crossing traffic cannot bury the featured attacks */
  laserClear?: number;
  /** shot-relative times of cuts inside the shot (a second camera setup): motion-blur samples never cross them */
  cuts?: number[];
  lines?: Line[];
  schedule?(w: World, T0: number): void;
  pose(w: World, t: number, T: number): Cam;
}

/* ------------------------------------------------------------------ shared helpers */

/** Talking mouth: cycles open shapes while a line is being spoken. */
export function talk(t: number, t0: number, t1: number, rest: Mouth, open: Mouth[] = ['talk', 'open', 'talk', 'o']): Mouth {
  if (t < t0 || t > t1) return rest;
  const k = Math.floor((t - t0) * 9.5 + noise1(t * 3, 7) * 1.5);
  if (k % 3 === 2) return rest;
  return open[((k % open.length) + open.length) % open.length];
}

export function blinkAt(t: number, seed: number): number {
  const period = 2.6 + (seed % 3) * 0.7;
  const ph = (t + seed * 0.37) % period;
  return ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI) : 0;
}

function face(fig: Minifig, s: Partial<FaceState>, t: number, seed: number): void {
  fig.setFace({ mouth: 'flat', brows: 0, lookX: 0, lookY: 0, squint: 0, ...s, blink: s.blink ?? blinkAt(t, seed) });
}

/** Place a fighter on a flight path (world) with its pilot and droid seated. */
function fly(w: World, ship: Eta2, st: FlightState, foils: number, engine = 1): void {
  ship.group.visible = true;
  place(ship.group, st);
  ship.setFoils(foils);
  ship.setEngine(engine);
  const fig = ship === w.anakinShip ? w.anakin : w.obiwan;
  w.seat(fig, ship);
}

function anchorWorld(o: Object3D): Vector3 {
  o.updateWorldMatrix(true, false);
  return new Vector3().setFromMatrixPosition(o.matrixWorld);
}

let swarms: ((T: number) => void) | null = null;
/** the tracking shot's frigate is gone for good once it blows up */
const victimDeath = () => track.start! + 4.0;

/** Background battle shared by all space shots: the fleet, and the fighter duels around it. */
function battle(w: World, T: number, o: { swarms?: boolean; fleet?: boolean; hero?: boolean } = {}): void {
  w.venator.group.visible = (o.fleet ?? true) && (o.hero ?? false);
  w.venator.group.position.copy(vFrame(T));
  w.venator.group.rotation.set(0, 0, 0);
  for (const f of w.fleet) f.root.visible = o.fleet ?? true;
  w.munis[0].group.visible = (o.fleet ?? true) && T < victimDeath();
  if (o.swarms ?? true) {
    (swarms ??= poseSwarms(w))(T);
    w.vultureSwarm.group.visible = true;
    w.arcSwarm.group.visible = true;
    w.triSwarm.group.visible = true;
  }
}

/** Every bolt in the background has a target: fighter duels with kills, turbolasers onto real hulls. */
export function scheduleBattle(w: World, T0: number, T1: number): void {
  scheduleDogfights(w, T0, T1);
  scheduleCapitalFire(w, T0, T1, { heroUntil: anakinCockpit.start!, victimDeath: victimDeath() });
}

/* ------------------------------------------------------------------ the shots */

const farfar: Shot = { name: 'farfar', dur: 4.5, card: true, pose: () => ({ pos: v3(0, 0, 0), target: v3(0, 0, 1), fov: 30 }) };

/** Camera pose at the start of the long take (also holds the crawl). */
const C0 = v3(-120, 1150, -2950);
const C0_UP_TARGET = v3(-120, 1150 + 1000 * Math.tan((64 * Math.PI) / 180), -2950 + 1000);

const crawl: Shot = {
  name: 'crawl',
  dur: 15,
  pose(w, t, T) {
    battle(w, T, { swarms: false, hero: true });
    w.crawl.group.visible = true;
    // the crawl lives in camera space: tipped back, sliding away up its own plane
    const cam = C0.clone();
    const fwd = C0_UP_TARGET.clone().sub(C0).normalize();
    const q = basisQuat(fwd.clone().negate(), v3(0, 1, 0));
    const tilt = new Quaternion().setFromAxisAngle(v3(1, 0, 0), (-70 * Math.PI) / 180);
    const plane = w.crawl.group;
    plane.quaternion.copy(q).multiply(tilt);
    const s = 30;
    plane.scale.setScalar(s);
    const slide = -22 + t * 3.1;
    const pos = cam.clone().add(fwd.clone().multiplyScalar(48)).add(v3(0, -16, 0));
    const along = v3(0, 1, 0).applyQuaternion(plane.quaternion);
    plane.position.copy(pos).add(along.multiplyScalar(slide));
    w.crawl.mat.opacity = smooth(0, 1.2, t) * (1 - smooth(12.5, 15, t));
    return { pos: cam, target: C0_UP_TARGET, fov: 38, lens: { bloom: 0.5, vignette: 0.3 } };
  },
};

/** Long-take flight keys in the Venator frame (V-frame, units; hull: deck 30–130 high, towers z −1472…−1120, gap 160). */
const LT_ANAKIN: Key[] = [
  [2.5, 90, 1520, -3480],
  [3.5, 20, 1190, -2990],
  [4.5, 0, 700, -2200],
  [5.6, 0, 335, -1330],
  [6.5, 0, 274, -930],
  [7.3, 0, 232, -560],
  [8.2, 0, 112, -200],
  [9.2, 0, 92, 200],
  [10.3, 10, 74, 600],
  [11.2, 70, 64, 900],
  [12.0, 190, 38, 1090],
  [12.8, 300, -60, 1270],
  [13.7, 380, -260, 1510],
  [14.8, 420, -520, 1910],
  [16.5, 430, -760, 2700],
];
const LT_OBI_OFFSET = v3(-30, 5, -14);

function ltPath(T: number, who: 'anakin' | 'obiwan') {
  return (tt: number) => {
    const t = tt - LONG_T0;
    const p = keyed(LT_ANAKIN, who === 'anakin' ? t : t - 0.18);
    if (who === 'obiwan') p.add(LT_OBI_OFFSET.clone().multiplyScalar(1 - 0.35 * smooth(11, 13, t)));
    return p.add(vFrame(tt));
  };
}

/** heading basis with the pitch damped, so a chase camera does not stare at the planet in a dive */
function flatBasis(fwd: Vector3, damp = 0.35): Quaternion {
  const f = v3(fwd.x, fwd.y * damp, fwd.z).normalize();
  return basisQuat(f, v3(0, 1, 0));
}

/** the long take's key spline is only C1: its fighters (and the camera riding them) steer by a heading low-passed over ±0.3 s */
const LT_HEAD = 0.3;
function ltHeading(T: number, who: 'anakin' | 'obiwan' = 'anakin'): Vector3 {
  return flight(ltPath(T, who), T, { headWindow: LT_HEAD }).fwd;
}

/* --- attack pairs the audience can follow: shooter and target in the same frame, bolts that end on the
   target, a brick break-up, and debris the camera flies through */

const DROID_BITS = ['tan', 'darkTan', 'reddishBrown', 'dbg', 'black'] as const;

/** Bolts from a moving gun that lead a moving target and end on it; early bolts walk in, none flies off into space. */
function burstOnto(w: World, gun: (T: number, n: number) => Vector3, target: (T: number) => Vector3, arrivals: number[], o: { speed: number; length: number; width: number; color: LaserColor; spread: number; seed: number }): void {
  const rng = new Rng(o.seed);
  arrivals.forEach((ta, n) => {
    let tf = ta - 0.3;
    for (let i = 0; i < 4; i++) tf = ta - gun(tf, n).distanceTo(target(ta)) / o.speed;
    const from = gun(tf, n);
    const walk = Math.max(0, arrivals.length - 2 - n) / Math.max(1, arrivals.length - 2);
    const aim = target(ta).add(v3(rng.gauss(), rng.gauss(), rng.gauss()).multiplyScalar(o.spread * walk));
    const dist = from.distanceTo(aim);
    w.fx.laser({ t0: tf, from, dir: aim.clone().sub(from), speed: o.speed, life: dist / o.speed, length: o.length, width: o.width, color: o.color, hero: true });
  });
}

/** The target comes apart into bricks, carrying some of its speed so the wreckage drifts through the shot. */
function breakUp(w: World, T: number, path: (T: number) => Vector3, size: number, seed: number, carry = 0.55): void {
  const st = flight(path, T);
  w.fx.explosion(T, st.pos, { size, pieces: 80, brickScale: 1.8, sparks: 50, smoke: 8, flashes: 2, colors: [...DROID_BITS], seed, inherit: st.vel.clone().multiplyScalar(carry) });
}

const LT_KILL_A = 8.3, LT_KILL_B = 10.5, LT_KILL_C = 14.3;
function ltBasis(T: number): { pos: Vector3; quat: Quaternion } {
  const st = flight(ltPath(T, 'anakin'), T, { bank: 1.3, headWindow: LT_HEAD });
  return { pos: st.pos, quat: flatBasis(st.fwd) };
}
/** A: a vulture flees ahead of the pair across the hull; Anakin runs it down */
function ltVultureA(T: number): Vector3 {
  const t = T - LONG_T0;
  const k = smooth(6.0, LT_KILL_A, t);
  return local(ltBasis(T), lerp(70, 24, k) + Math.sin(t * 2.3) * 6, lerp(44, 22, k) + Math.cos(t * 1.9) * 4, lerp(330, 90, k));
}
/** B: a vulture dives on the hull from starboard; a dorsal point-defence turret takes it */
function ltVultureB(T: number): Vector3 {
  const t = T - LONG_T0;
  const k = smooth(8.8, LT_KILL_B, t);
  return local(ltBasis(T), lerp(-260, -46, k), lerp(170, 40, k), lerp(520, 115, k));
}
/** C: in the dive a vulture crosses below the pair with an ARC-170 on its tail */
function ltVultureC(T: number): Vector3 {
  const t = T - LONG_T0;
  const k = smooth(12.0, LT_KILL_C, t);
  return local(ltBasis(T), lerp(-260, 34, k), lerp(-4, -12, k), lerp(330, 85, k));
}
const ltArcC = (T: number) => ltVultureC(T - 0.2).add(v3(0, 8, 0));

function scheduleLongTakeKills(w: World, T0: number): void {
  const gunA = (T: number, n: number) => {
    const st = flight(ltPath(T, 'anakin'), T, { bank: 1.3, headWindow: LT_HEAD });
    const mz = w.loc.muzzlesA[n % w.loc.muzzlesA.length];
    return local(st, mz.x, mz.y, mz.z + 0.6);
  };
  burstOnto(w, gunA, ltVultureA, [7.5, 7.66, 7.82, 7.98, 8.14, 8.3].map((t) => T0 + t), { speed: 1700, length: 18, width: 1.5, color: 'red', spread: 16, seed: 71 });
  breakUp(w, T0 + LT_KILL_A, ltVultureA, 30, 701);
  // B: the nearest dorsal turret ahead of the pair (turret offsets ride with the moving Venator)
  const kB = T0 + LT_KILL_B;
  const g = w.venator.group;
  g.position.copy(vFrame(kB));
  g.rotation.set(0, 0, 0);
  g.updateMatrixWorld(true);
  const near = local(ltBasis(kB), 60, -60, 200);
  let off = new Vector3(), bd = Infinity;
  for (const a of w.venator.turrets) {
    const p = a.getWorldPosition(new Vector3());
    if (p.distanceTo(near) < bd) {
      bd = p.distanceTo(near);
      off = p.sub(g.position);
    }
  }
  burstOnto(w, (T) => vFrame(T).add(off).add(v3(0, 5, 0)), ltVultureB, [9.7, 9.86, 10.02, 10.18, 10.34, 10.5].map((t) => T0 + t), { speed: 2600, length: 44, width: 3.4, color: 'blue', spread: 24, seed: 72 });
  breakUp(w, kB, ltVultureB, 32, 702, 0.7);
  burstOnto(w, (T) => ltArcC(T), ltVultureC, [13.5, 13.66, 13.82, 13.98, 14.14, 14.3].map((t) => T0 + t), { speed: 1800, length: 16, width: 1.4, color: 'red', spread: 12, seed: 73 });
  // the wreck keeps the droid's speed: the camera closes on the pair at dive speed and flew through the fireball
  breakUp(w, T0 + LT_KILL_C, ltVultureC, 30, 703, 0.95);
}

function poseLongTakeKills(w: World, T: number): void {
  const t = T - LONG_T0;
  const put = (v: World['vultures'][number], path: (T: number) => Vector3, from: number, kill: number) => {
    v.group.visible = t >= from && t < kill;
    if (!v.group.visible) return;
    place(v.group, flight(path, T, { bank: 1.4 }));
    v.setMode(0);
    v.animate?.(T);
  };
  put(w.vultures[6], ltVultureA, 5.8, LT_KILL_A);
  put(w.vultures[7], ltVultureB, 8.6, LT_KILL_B);
  put(w.vultures[5], ltVultureC, 11.8, LT_KILL_C);
  const arc = w.arcs[0];
  arc.group.visible = t >= 11.8 && t < 15.4;
  if (arc.group.visible) place(arc.group, flight(ltArcC, T, { bank: 1.4 }));
}

const longTake: Shot = {
  name: 'longtake',
  // the camera threads the bridge towers at ~450 u/s: a shorter shutter and more samples keep the blur
  // a smear instead of stepped ghost copies
  blur: 6,
  shutter: 0.32,
  laserClear: 900,
  dur: 16,
  schedule(w, T0) {
    scheduleLongTakeKills(w, T0);
    // a little flak once the dive reveals the battle (kept sparse so the three kills read)
    const rng = new Rng(31);
    for (let t = 11.8; t < 16; t += rng.range(0.4, 0.7)) {
      const st = flight(ltPath(T0 + t, 'anakin'), T0 + t, { headWindow: LT_HEAD });
      const p = local({ pos: st.pos, quat: flatBasis(st.fwd) }, rng.range(-300, 300), rng.range(-140, 160), rng.range(450, 950));
      w.fx.explosion(T0 + t, p, { size: rng.range(12, 24), pieces: 14, sparks: 16, smoke: 3, colors: ['dbg', 'lbg', 'black'], seed: Math.floor(t * 97) });
    }
  },
  pose(w, t, T) {
    battle(w, T, { hero: true });
    poseLongTakeKills(w, T);
    const a = flight(ltPath(T, 'anakin'), T, { bank: 1.3, headWindow: LT_HEAD });
    const o = flight(ltPath(T, 'obiwan'), T, { bank: 1.3, headWindow: LT_HEAD });
    if (t > 2.3) {
      fly(w, w.anakinShip, a, 0, 1);
      fly(w, w.obiwanShip, o, 0, 1);
      face(w.anakin, { mouth: 'smirk', brows: -0.3 }, t, 1);
      face(w.obiwan, { mouth: 'flat', brows: 0.3 }, t, 2);
    }
    const V = vFrame(T);
    // hold C0 while tilting down from the stars
    const tilt = smoother(0.0, 4.2, t);
    const lookDown = v3(0, 120, -900).add(vFrame(LONG_T0 + 4.2));
    let pos = C0.clone();
    let target = C0_UP_TARGET.clone().lerp(lookDown, tilt);
    // then chase the pair over the hull
    const follow = smoother(4.2, 6.2, t);
    if (follow > 0) {
      const lagT = T - 0.12;
      const lag = flight(ltPath(lagT, 'anakin'), lagT, { headWindow: LT_HEAD });
      const lagO = flight(ltPath(lagT, 'obiwan'), lagT, { headWindow: LT_HEAD });
      const behind = local({ pos: lag.pos.clone().lerp(lagO.pos, 0.5), quat: flatBasis(ltHeading(lagT)) }, 0, 30, -104);
      pos = pos.lerp(behind, follow);
      const mid = a.pos.clone().lerp(o.pos, 0.35);
      const ahead = mid.clone().add(v3(0, 0, 1).applyQuaternion(flatBasis(ltHeading(T))).multiplyScalar(90));
      target = target.lerp(ahead, follow);
    }
    // over the port edge: swing out to port, keep the horizon and the battle in frame
    const dive = smoother(11.0, 13.4, t);
    if (dive > 0) {
      const q = flatBasis(ltHeading(T), 0.25);
      const d = local({ pos: a.pos.clone().lerp(o.pos, 0.4), quat: q }, 44, 34, -88);
      pos = pos.lerp(d, dive);
      const look = a.pos.clone().add(v3(0, 0, 1).applyQuaternion(q).multiplyScalar(340)).add(v3(0, -30, 0));
      target = target.lerp(look, dive);
    }
    pos.add(shake(t, follow * 0.35, 1.3, 3));
    // shadows: one box fixed to the whole hull while the pair skims the Venator (no pop, no crawl); once
    // they have dropped below the port edge it eases down onto the fighters for their self-shadows
    const handover = smoother(13.0, 13.8, t);
    w.aimShadow(V.clone().add(v3(0, 150, 60)).lerp(a.pos, handover), Math.exp(lerp(Math.log(1700), Math.log(90), handover)));
    return { pos, target, fov: lerp(34, 38, follow) + dive * 4, roll: -0.1 * dive * (1 - smooth(14, 16, t)), lens: { exposure: 1.0 } };
  },
};

/* --- shot 3: tracking alongside through the flak, a frigate dies behind them */

const T3 = { start: v3(640, -1080, 4250), speed: 330 };
function trackPath(who: 'anakin' | 'obiwan', T0: number) {
  return (tt: number) => {
    const t = tt - T0;
    const p = T3.start.clone().add(v3(Math.sin(t * 0.9) * 14, Math.sin(t * 0.6) * 10 - t * 12, t * T3.speed));
    if (who === 'obiwan') p.add(v3(-22 + Math.sin(t * 1.1 + 1) * 5, 7, -30));
    return p;
  };
}

/** the shooter Venator keeps station with the pair, upper left of the tracking frame */
const TRACK_SHOOTER = v3(3999, -471, -1050);
const trackShooter = (T0: number) => (T: number) => trackPath('anakin', T0)(T).add(TRACK_SHOOTER);

const track: Shot = {
  name: 'track',
  dur: 5,
  laserClear: 900,
  schedule(w, T0) {
    const victim = w.munis[0];
    victim.group.updateMatrixWorld(true);
    const hits = Object.entries(victim.anchors)
      .filter(([k]) => k.startsWith('hit'))
      .map(([, a]) => ({ p: anchorWorld(a), n: v3(0, 0, 1).applyQuaternion(a.getWorldQuaternion(new Quaternion())) }));
    // the Republic ship doing the killing: the hero Venator cruising alongside the pair in the upper left
    // of frame, its salvos crossing the sky above the fighters onto the frigate, which enters from the right at t≈1.9
    const g = w.venator.group;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const offs = w.venator.turrets.map((m) => anchorWorld(m));
    const shooterAt = trackShooter(T0);
    const rng = new Rng(5);
    const times = [2.1, 2.45, 2.8, 3.1, 3.4, 3.65];
    times.forEach((h, i) => {
      const hit = hits[i % hits.length];
      const p = hit.p.clone().add(hit.n.clone().multiplyScalar(20));
      // a salvo that arrives on the hit
      for (let k = 0; k < 3; k++) {
        const off = offs[(i * 5 + k * 7) % offs.length];
        const ta = T0 + h - k * 0.06;
        let tf = ta - 0.6;
        for (let it = 0; it < 3; it++) tf = ta - shooterAt(tf).add(off).distanceTo(p) / 3200;
        const from = shooterAt(tf).add(off);
        const dist = from.distanceTo(p);
        w.fx.laser({ t0: tf, from, dir: p.clone().sub(from), speed: 3200, life: dist / 3200, length: 260, width: 20, color: 'blue', hero: true });
      }
      w.fx.explosion(T0 + h, p, { size: 150 + i * 30, pieces: 26, brickScale: 7, sparks: 20, smoke: 5, colors: ['tan', 'darkTan', 'lbg', 'reddishBrown'], seed: 300 + i, flashes: 2 });
    });
    w.fx.explosion(T0 + 3.9, VICTIM_POSE.pos.clone().add(v3(0, 50, 0)), { size: 520, pieces: 90, brickScale: 8, sparks: 60, smoke: 10, colors: ['tan', 'darkTan', 'lbg', 'reddishBrown', 'dbg'], seed: 399, flashes: 3 });
    // flak bursting around the pair
    for (let t = 0.2; t < 5; t += rng.range(0.6, 1.0)) {
      const st = flight(trackPath('anakin', T0), T0 + t);
      const p = local(st, rng.range(-200, 200), rng.range(-120, 140), rng.range(-60, 500));
      w.fx.explosion(T0 + t, p, { size: rng.range(10, 22), pieces: 10, sparks: 14, smoke: 2, colors: ['dbg', 'black', 'lbg'], seed: Math.floor(t * 131) });
    }
  },
  pose(w, t, T) {
    battle(w, T, { hero: true });
    const T0 = T - t;
    w.venator.group.position.copy(trackShooter(T0)(T));
    w.venator.group.rotation.set(0, 0, 0);
    const a = flight(trackPath('anakin', T0), T, { bank: 1 });
    const o = flight(trackPath('obiwan', T0), T, { bank: 1 });
    const foils = smooth(0.2, 1.1, t);
    fly(w, w.anakinShip, a, foils);
    fly(w, w.obiwanShip, o, foils);
    face(w.anakin, { mouth: 'smirk', brows: -0.5 }, t, 1);
    face(w.obiwan, { mouth: 'flat', brows: 0.5 }, t, 2);
    const mid = a.pos.clone().lerp(o.pos, 0.5);
    const pos = local({ pos: mid, quat: basisQuat(a.fwd, v3(0, 1, 0)) }, -34 + t * 2, 7, 14 - t * 3.5).add(shake(t, 0.35, 1.1, 9));
    w.aimShadow(mid, 60);
    return { pos, target: mid.clone().add(v3(0, -2, 6)), fov: 30, lens: { exposure: 1.05 } };
  },
};

/* --- cockpit close-ups */

type L3 = [number, number, number];

/**
 * Cockpit close-up. The camera is inside the canopy, in the nose ahead of the pilot, so no strut
 * crosses the face; it pushes in slowly between two ship-space positions. `aim` offsets the look
 * point from the head joint to put the head on a third with room on the side the pilot looks to, and
 * the key lights the far side of the face (short lighting) under a reduced ambient fill.
 */
function cockpitShot(o: {
  name: string;
  dur: number;
  who: 'anakin' | 'obiwan';
  lines?: Line[];
  faceAt: (t: number) => Partial<FaceState>;
  headAt?: (t: number) => { yaw: number; pitch: number };
  cam: [L3, L3];
  fov: [number, number];
  aim: L3;
  key: L3;
  /** key colour and intensity, ambient fill (environment intensity): each beat gets its own mood */
  keyColor?: number;
  keyI?: number;
  fill?: number;
  schedule?: Shot['schedule'];
}): Shot {
  return {
    name: o.name,
    dur: o.dur,
    lines: o.lines,
    schedule: o.schedule,
    pose(w, t, T) {
      battle(w, T);
      const ship = o.who === 'anakin' ? w.anakinShip : w.obiwanShip;
      const fig = o.who === 'anakin' ? w.anakin : w.obiwan;
      const path = cockpitPath(o.who);
      const st = flight(path, T, { bank: 1.2 });
      // cockpit vibration
      st.pos.add(shake(t, 0.12, 3.5, o.who === 'anakin' ? 21 : 22));
      fly(w, ship, st, 1);
      const other = o.who === 'anakin' ? w.obiwanShip : w.anakinShip;
      const ost = flight((tt) => path(tt).add(v3(o.who === 'anakin' ? -40 : 40, 12, -70)), T);
      fly(w, other, ost, 1);
      face(fig, o.faceAt(t), t, o.who === 'anakin' ? 1 : 2);
      const hd = o.headAt?.(t) ?? { yaw: 0, pitch: 0 };
      fig.pose({ legL: Math.PI / 2, legR: Math.PI / 2, armL: 0.95, armR: 0.95, splayL: 0.08, splayR: 0.08, headYaw: hd.yaw, headPitch: hd.pitch });
      const rot = (p: L3) => v3(p[0], p[1], p[2]).applyQuaternion(st.quat);
      const neck = anchorWorld(ship.cockpitAnchor).add(rot([0, 1.9, 0]));
      const faceC = neck.clone().add(rot([0, 0.5, 0]));
      const k = smooth(0, o.dur, t);
      const [c0, c1] = o.cam;
      const cam = local(st, lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k));
      w.aimShadow(faceC, 8);
      w.keyLight(faceC, rot(o.key), o.keyI ?? 3.4, o.keyColor);
      w.scene.environmentIntensity = o.fill ?? 0.6;
      w.hemi.intensity = 0.5 * (o.fill ?? 0.6);
      return {
        pos: cam,
        target: neck.add(rot(o.aim)),
        fov: lerp(o.fov[0], o.fov[1], k),
        near: 0.05,
        lens: { focus: cam.distanceTo(faceC), aperture: 7, exposure: 1.0, bloom: 0.85 },
      };
    },
  };
}

function cockpitPath(who: 'anakin' | 'obiwan') {
  const x0 = who === 'anakin' ? 300 : 200;
  return (tt: number) => v3(x0 + Math.sin(tt * 0.7) * 20, -1400 + Math.sin(tt * 0.5) * 12, 9000 + tt * 290);
}

/** droids on the hero's tail: bolts aimed at the fighter that zip past the canopy, plus flak ahead */
function cockpitLasers(who: 'anakin' | 'obiwan', seedBase: number): Shot['schedule'] {
  return (w, T0) => {
    const rng = new Rng(seedBase);
    const ship = cockpitPath(who);
    for (let t = 0; t < 5; t += rng.range(0.14, 0.3)) {
      const tf = T0 + t;
      const from = ship(tf).add(v3(rng.range(-240, 240), rng.range(-90, 140), -rng.range(450, 850)));
      let ta = tf + from.distanceTo(ship(tf)) / 1000;
      ta = tf + from.distanceTo(ship(ta)) / 1000;
      const aim = ship(ta).add(v3(rng.gauss(), rng.gauss() * 0.6, 0).normalize().multiplyScalar(rng.range(7, 22)));
      w.fx.laser({ t0: tf, from, dir: aim.clone().sub(from), speed: 1000, life: (from.distanceTo(aim) + 400) / 1000, length: 20, width: 1.3, color: rng.chance(0.6) ? 'red' : 'green' });
    }
    for (let t = 0.3; t < 5; t += rng.range(0.7, 1.3)) {
      const p = ship(T0 + t).add(v3(rng.range(-320, 320), rng.range(-120, 180), rng.range(250, 800)));
      w.fx.explosion(T0 + t, p, { size: rng.range(18, 36), pieces: 8, sparks: 10, smoke: 2, colors: ['dbg', 'black', 'lbg'], seed: Math.floor(t * 71 + seedBase) });
    }
  };
}

// camera from the port side of the nose; Anakin looks ahead-starboard (screen left) at the droids
const anakinCockpit = cockpitShot({
  name: 'anakin-cockpit',
  dur: 4,
  who: 'anakin',
  lines: [{ t0: 1.0, t1: 3.4, who: 'Anakin Skywalker', text: 'This is where the fun begins.' }],
  faceAt: (t) => ({ mouth: talk(t, 1.05, 2.3, 'smirk'), brows: -0.35, squint: 0.1, lookX: -0.02 }),
  headAt: (t) => ({ yaw: -0.05 - smooth(0.4, 1.0, t) * 0.22, pitch: 0.16 - smooth(0.3, 0.9, t) * 0.2 }),
  cam: [[1.4, 2.85, 4.0], [1.3, 2.9, 3.88]],
  fov: [36, 32.5],
  aim: [-0.6, 0.63, 0],
  key: [-0.65, 0.45, 0.6],
  schedule: cockpitLasers('anakin', 41),
});

/* --- shot 5: the vulture droids swarm in; Anakin opens fire */

const VULTURE_KILLS: [number, number][] = [
  [0, 1.45],
  [2, 2.1],
  [4, 2.72],
];
const vultureDead = (k: number, t: number) => VULTURE_KILLS.some(([kk, tk]) => kk === k && t > tk);

const vultures: Shot = {
  name: 'vultures',
  dur: 5,
  laserClear: 1200,
  schedule(w, T0) {
    const pathA = vPath(T0);
    const rng = new Rng(55);
    const SPEED = 1500;
    const muzzle = (T: number, k: number) => {
      const st = flight(pathA, T);
      const mz = w.loc.muzzlesA[k % w.loc.muzzlesA.length];
      return local(st, mz.x, mz.y, mz.z + 0.6);
    };
    // Anakin's cannons: each burst walks onto a doomed vulture close enough to read, the last bolts land
    // on the kill frame and it comes apart into bricks that fly back past the camera
    for (const [k, tk] of VULTURE_KILLS) {
      const target = (T: number) => vulturePos(k, T, T0);
      burstOnto(w, (T, n) => muzzle(T, n), target, [0.55, 0.44, 0.33, 0.22, 0.11, 0].map((d) => T0 + tk - d), { speed: SPEED, length: 16, width: 1.4, color: 'red', spread: 10, seed: 510 + k });
      breakUp(w, T0 + tk, target, 26, 500 + k, 0.45);
    }
    // droid return fire from droids in frame, passing close around Anakin
    for (let t = 0.3; t < 3.2; t += rng.range(0.12, 0.2)) {
      const k = rng.int(0, 5);
      if (vultureDead(k, t)) continue;
      const p = vulturePos(k, T0 + t, T0);
      const target = flight(pathA, T0 + t + 0.3).pos.clone().add(v3(rng.range(-22, 22), rng.range(-12, 16), rng.range(-20, 20)));
      w.fx.laser({ t0: T0 + t, from: p, dir: target.sub(p), speed: 1300, life: 0.9, length: 12, width: 1.1, color: 'red', hero: true });
    }
  },
  pose(w, t, T) {
    battle(w, T);
    const T0 = T - t;
    const pathA = vPath(T0);
    const roll = t > 2.9 && t < 4.7 ? smoother(2.9, 4.7, t) * Math.PI * 2 : 0;
    const a = flight(pathA, T, { bank: 1.2, extraRoll: roll });
    fly(w, w.anakinShip, a, 1);
    const o = flight((tt) => pathA(tt).add(v3(-38, 14, -60)), T, { bank: 1.2 });
    fly(w, w.obiwanShip, o, 1);
    face(w.anakin, { mouth: 'grin', brows: -0.6 }, t, 1);
    for (let k = 0; k < 6; k++) {
      const v = w.vultures[k];
      const dead = vultureDead(k, t);
      v.group.visible = !dead;
      if (dead) continue;
      const st = flight((tt) => vulturePos(k, tt, T0), T, { bank: 1.5 });
      place(v.group, st);
      v.setMode(0);
      v.animate?.(T);
    }
    // ARC-170s cross behind at t≈3
    for (let k = 0; k < 4; k++) {
      const arc = w.arcs[k];
      arc.group.visible = t > 2.2;
      const p0 = a.pos.clone().add(v3(700 - k * 30, 60 + k * 18, 500 + k * 40));
      const st = flight((tt) => p0.clone().add(v3(-(tt - T0 - 2.2) * 520, 0, (tt - T0) * 180)), T);
      place(arc.group, st);
    }
    const cam = local({ pos: a.pos, quat: basisQuat(a.fwd, v3(0, 1, 0)) }, -9, 6.5, -36).add(shake(t, 0.35, 1.6, 12));
    w.aimShadow(a.pos, 40);
    return { pos: cam, target: a.pos.clone().add(a.fwd.clone().multiplyScalar(120)).add(v3(0, 2, 0)), fov: 32, lens: { exposure: 1.05 } };
  },
};

function vPath(T0: number) {
  const base = v3(-400, -900, 12000);
  return (tt: number) => {
    const t = tt - T0;
    return base.clone().add(v3(Math.sin(t * 0.8) * 25, Math.sin(t * 0.6) * 15, t * 300));
  };
}

/** where each doomed vulture is (Anakin-relative x, y) when it is hit: inside the frame, clear of his fighter */
const VULTURE_KILL_AT: Record<number, [number, number]> = { 0: [62, 30], 2: [-64, 18], 4: [30, 24] };

function vulturePos(k: number, T: number, T0: number): Vector3 {
  const t = T - T0;
  const a = vPath(T0)(T);
  const rng = new Rng(900 + k);
  let spreadX = rng.range(-140, 140);
  const spreadY = rng.range(-70, 90);
  // the swarm closes head-on; the kills happen 170/120/80 units ahead so they read on screen, and a doomed
  // droid checks its closing speed for its last second so it is recognisable before the hit
  let z = 924 - t * 520 + k * 143;
  const kill = VULTURE_KILL_AT[k];
  const tk = VULTURE_KILLS.find(([kk]) => kk === k)?.[1];
  if (tk !== undefined) {
    const zk = 924 - tk * 520 + k * 143, dt = tk - t;
    z = dt > 1 ? zk + 140 + (dt - 1) * 520 : zk + dt * 140;
  }
  if (kill) return a.clone().add(v3(kill[0] * (0.7 + 0.3 * smooth(0, 2.7, t)) + Math.sin(t * 2 + k) * 8, kill[1] + Math.cos(t * 1.7 + k) * 6, z));
  // survivors break wide of the fighter and the camera as they pass
  spreadX = Math.sign(spreadX || 1) * Math.max(70, Math.abs(spreadX));
  return a.clone().add(v3(spreadX * (0.4 + t * 0.25) + Math.sin(t * 2 + k) * 20, spreadY * (0.4 + t * 0.2) + Math.cos(t * 1.7 + k) * 14, z));
}

/* --- shot 6: the Invisible Hand, crawling with vulture droids */

function poseHand(w: World): void {
  const h = w.hand.group;
  h.visible = true;
  h.position.copy(HAND_POS);
  h.rotation.set(0, HAND_YAW, 0);
  w.hand.setBayProxy(true);
}

function crawlerPoses(w: World, T: number): void {
  const h = w.hand.group;
  h.updateMatrixWorld(true);
  const anchors = Object.entries(w.hand.anchors)
    .filter(([k]) => k.startsWith('crawl'))
    .map(([, a]) => a);
  const q = new Quaternion();
  w.crawlers.forEach((c, i) => {
    const a = anchors[i % Math.max(1, anchors.length)];
    if (!a) return;
    c.group.visible = true;
    a.getWorldQuaternion(q);
    // second lap of anchors: offset along the hull so two droids never overlap
    const extra = i >= anchors.length ? v3(70, 0, -55).applyQuaternion(q) : v3(0, 0, 0);
    c.group.position.copy(anchorWorld(a)).add(extra);
    c.group.quaternion.copy(q).multiply(new Quaternion().setFromAxisAngle(v3(0, 1, 0), (i * 2.39) % (Math.PI * 2)));
    c.group.scale.setScalar(2);
    c.setMode(1);
    c.setGait(T * 5 + i);
  });
}

const handReveal: Shot = {
  name: 'hand-reveal',
  blur: 2,
  dur: 4.5,
  lines: [{ t0: 0.4, t1: 4.3, who: 'Anakin Skywalker', text: "The General's command ship is dead ahead — the one crawling with vulture droids." }],
  pose(w, t, T) {
    battle(w, T);
    poseHand(w);
    crawlerPoses(w, T);
    const T0 = T - t;
    const start = HAND_POS.clone().add(v3(-1250, 560, -2350));
    const dir = v3(0.28, -0.07, 1).normalize();
    const path = (tt: number) => start.clone().add(dir.clone().multiplyScalar((tt - T0) * 210));
    const a = flight(path, T, { bank: 1 });
    const o = flight((tt) => path(tt).add(v3(-30, 8, -26)), T, { bank: 1 });
    fly(w, w.anakinShip, a, 1);
    fly(w, w.obiwanShip, o, 1);
    face(w.anakin, { mouth: 'smirk', brows: -0.3 }, t, 1);
    const mid = a.pos.clone().lerp(o.pos, 0.5);
    // the reveal: from tight behind the pair (the command ship dead ahead beyond them) the camera cranes up and
    // out to starboard while the lens tightens, and the aim slides from the bow to the hull the droids crawl on
    const u = smoother(0, 4.5, t);
    const cam = local({ pos: mid, quat: basisQuat(a.fwd, v3(0, 1, 0)) }, lerp(8, 30, u), lerp(11, 27, u), lerp(-44, -76, u)).add(shake(t, 0.2, 1, 14));
    const bow = HAND_POS.clone().add(v3(-420, 110, -520)), hull = HAND_POS.clone().add(v3(-120, 150, -280));
    const look = bow.lerp(hull, smoother(1.8, 4.3, t)).lerp(mid, lerp(0.3, 0.2, u));
    w.aimShadow(mid, 60);
    return { pos: cam, target: look, fov: lerp(34, 29, u), roll: lerp(0.02, 0.06, u), lens: { exposure: 1.05 } };
  },
};

const obiCockpit = cockpitShot({
  name: 'obiwan-cockpit',
  dur: 3.5,
  who: 'obiwan',
  lines: [{ t0: 0.5, t1: 3.2, who: 'Obi-Wan Kenobi', text: 'Oh, I have a bad feeling about this.' }],
  // worried, not amused: brows up at the inner ends, the mouth pulled down between words, a nervous glance aside
  faceAt: (t) => ({ mouth: talk(t, 0.55, 2.9, 'frown', ['worry', 'frown', 'worry', 'o']), brows: 1, lookX: t < 1.2 ? 0.02 : t < 1.75 ? -0.018 : 0.012, lookY: 0.005 }),
  headAt: (t) => ({ yaw: 0.3 - smooth(1.6, 2.4, t) * 0.16, pitch: 0.04 }),
  cam: [[-1.4, 2.85, 4.0], [-1.3, 2.9, 3.8]],
  fov: [34, 31],
  aim: [0.6, 0.74, 0],
  key: [0.65, 0.45, 0.6],
  keyColor: 0xd8e4ff,
  keyI: 2.3,
  fill: 0.5,
  schedule: cockpitLasers('obiwan', 42),
});

/* --- shot 8: missiles → buzz droids */

function obiPath8(T0: number) {
  const base = v3(1200, -1200, 22000);
  return (tt: number) => {
    const t = tt - T0;
    return base.clone().add(v3(Math.sin(t * 0.9) * 12, Math.sin(t * 0.7) * 8, t * 240));
  };
}
function missilePath(k: number, T0: number) {
  return (tt: number) => {
    const t = tt - T0;
    const ship = obiPath8(T0)(tt);
    const start = ship.clone().add(v3(k ? 260 : 190, k ? 60 : -40, 900));
    const end = ship.clone().add(v3(k ? 12 : -8, k ? 7 : 3, 26));
    const f = smoother(0, 1.9, t);
    return start.lerp(end, f);
  };
}
/** buzz droid perches on Obi-Wan's fighter (local coords) */
// surface heights: wing/stub tops 0.98, deck 1.6, open upper foil 0.8 + 0.384·(|x| − 5.5) (+0.18 studs)
const BUZZ_LIFT = 1.15;
const foilTop = (x: number) => (Math.abs(x) > 5.5 ? 0.98 + 0.384 * (Math.abs(x) - 5.5) : 0.98);
const PERCH: [number, number, number][] = [
  [5.8, foilTop(5.8) + BUZZ_LIFT, 2.4],
  [8.2, foilTop(8.2) + BUZZ_LIFT, -3],
  [-6.2, foilTop(-6.2) + BUZZ_LIFT, 1],
  [-8.6, foilTop(-8.6) + BUZZ_LIFT, -4],
  [2.2, 1.6 + BUZZ_LIFT, 6.2],
  [4.9, 0.98 + BUZZ_LIFT, -7],
];

/** missile beat: droid i leaves its payload bay at DEPLOY0 + i·DEPLOY_STEP, the casings pop at CASING_POP */
const DEPLOY0 = 1.72;
const DEPLOY_STEP = 0.1;
const CASING_POP = 2.3;
const buzzRelease = (i: number) => DEPLOY0 + i * DEPLOY_STEP;

const missiles: Shot = {
  name: 'missiles',
  blur: 2,
  dur: 4,
  lines: [{ t0: 2.3, t1: 3.9, who: 'Obi-Wan Kenobi', text: 'Buzz droids!' }],
  schedule(w, T0) {
    const ship = obiPath8(T0);
    for (let k = 0; k < 2; k++) {
      const path = missilePath(k, T0);
      // exhaust streaks, carried along with the fighter's frame, so the missiles read on the way in
      w.fx.sparkStream(
        T0,
        T0 + CASING_POP,
        (T) => {
          const st = flight(path, T);
          return st.pos.clone().sub(st.fwd.clone().multiplyScalar(4.8));
        },
        (T) => flight(path, T).fwd.clone().negate(),
        80,
        810 + k,
        6,
        (T) => flight(ship, T).vel,
      );
      // once the payload is out the empty casing pops: a small flash, sparks and panels, no fireball
      // or smoke to hide the droids on their way to the hull
      const st = flight(path, T0 + CASING_POP);
      w.fx.explosion(T0 + CASING_POP, st.pos, { size: 2.2, pieces: 5, sparks: 26, smoke: 0, colors: ['gunmetal', 'dbg'], seed: 800 + k, inherit: flight(ship, T0 + CASING_POP).vel });
    }
  },
  pose(w, t, T) {
    battle(w, T);
    const T0 = T - t;
    const o = flight(obiPath8(T0), T, { bank: 1 });
    fly(w, w.obiwanShip, o, 1);
    const a = flight((tt) => obiPath8(T0)(tt).add(v3(-45, 16, -80)), T);
    fly(w, w.anakinShip, a, 1);
    face(w.obiwan, { mouth: talk(t, 2.35, 3.5, 'o', ['shout', 'open']), brows: 0.9, lookX: 0.02 }, t, 2);
    for (let k = 0; k < 2; k++) {
      const m = w.missiles[k];
      m.group.visible = t < CASING_POP;
      const st = flight(missilePath(k, T0), T);
      place(m.group, st);
      m.setOpen(smooth(1.45, 1.8, t));
      // payload slot j of missile k carries buzz droid j * 2 + k
      m.payloadAnchors.forEach((pa, j) => (pa.visible = t <= buzzRelease(j * 2 + k)));
    }
    // buzz droids pop out of the payload bays one after another, then hop in an arc onto their
    // perches, unfolding and growing to full size on the way
    const up = v3(0, 1, 0).applyQuaternion(o.quat);
    w.buzz.forEach((b, i) => {
      const k = i % 2;
      const m = w.missiles[k];
      const tr = buzzRelease(i);
      b.group.visible = t > tr;
      if (t <= tr) return;
      const slot = m.payloadAnchors[Math.floor(i / 2) % Math.max(1, m.payloadAnchors.length)];
      const rel = slot ? payloadLocal(m.group, slot) : v3(0, 0, 0);
      const from = local(flight(missilePath(k, T0), T), rel.x, rel.y, rel.z);
      const c = crawlLocal(i, T);
      const perch = local(o, c.p.x, c.p.y, c.p.z);
      const f = smoother(tr, tr + 0.85, t);
      b.group.position.copy(from.lerp(perch, f)).add(up.clone().multiplyScalar(4 * f * (1 - f) * 3.2));
      b.group.quaternion.copy(o.quat).slerp(o.quat.clone().multiply(c.q), f);
      const ps = (m.group.userData.payloadScale as number | undefined) ?? 0.28;
      b.group.scale.setScalar(lerp(ps, 1, smoother(tr, tr + 0.6, t)));
      b.setDeploy(smooth(tr + 0.35, tr + 0.85, t));
      b.animate(T + i);
    });
    const cam = local({ pos: o.pos, quat: basisQuat(o.fwd, v3(0, 1, 0)) }, -16, 6, -30).add(shake(t, 0.25, 1.4, 17));
    w.aimShadow(o.pos, 30);
    return { pos: cam, target: o.pos.clone().add(o.fwd.clone().multiplyScalar(25)), fov: 30, lens: { exposure: 1.05 } };
  },
};

/** a payload slot's position in its missile's frame (scaled like the missile), cached: the slots never move */
function payloadLocal(missile: Object3D, slot: Object3D): Vector3 {
  const cached = slot.userData.missileLocal as Vector3 | undefined;
  if (cached) return cached;
  missile.updateMatrixWorld(true);
  const v = missile.worldToLocal(slot.getWorldPosition(new Vector3())).multiply(missile.scale);
  slot.userData.missileLocal = v;
  return v;
}

/** each droid's patch of Obi-Wan's fighter (ship-local x/z ranges); the foils slope up outboard */
const CRAWL: { x: [number, number]; z: [number, number] }[] = [
  { x: [5.9, 8.9], z: [-0.5, 3.0] },
  { x: [6.3, 9.2], z: [-4.4, -1.0] },
  { x: [-8.9, -6.0], z: [-0.8, 2.8] },
  { x: [-9.2, -6.4], z: [-4.6, -1.2] },
  { x: [1.6, 2.8], z: [5.6, 6.8] },
  { x: [4.3, 5.2], z: [-7.6, -6.2] },
];
/** A buzz droid wandering over its patch (ship-local), feet on the surface, facing where it walks. */
function crawlLocal(i: number, T: number): { p: Vector3; q: Quaternion } {
  const c = CRAWL[i];
  const ph = i * 1.93, ph2 = i * 2.71 + 0.6;
  const x = lerp(c.x[0], c.x[1], 0.5 + 0.5 * Math.sin(T * 0.52 + ph));
  const z = lerp(c.z[0], c.z[1], 0.5 + 0.5 * Math.sin(T * 0.37 + ph2));
  const dx = (c.x[1] - c.x[0]) * 0.26 * Math.cos(T * 0.52 + ph);
  const dz = (c.z[1] - c.z[0]) * 0.185 * Math.cos(T * 0.37 + ph2);
  const surf = i === 4 ? 1.6 : i === 5 ? 0.98 : foilTop(x);
  const slope = i < 4 && Math.abs(x) > 5.5 ? 0.384 * Math.sign(x) : 0;
  const p = v3(x, surf + BUZZ_LIFT + Math.abs(Math.sin(T * 6.5 + i * 1.3)) * 0.08, z);
  const up = v3(-slope, 1, 0).normalize();
  const heading = v3(dx, 0, dz);
  if (heading.lengthSq() < 1e-6) heading.set(0, 0, 1);
  heading.normalize();
  const fwd = heading.sub(up.clone().multiplyScalar(heading.dot(up))).normalize();
  return { p, q: basisQuat(fwd, up) };
}
function crawlOn(ship: FlightState, i: number, T: number, b: BuzzDroid): void {
  const c = crawlLocal(i, T);
  b.group.position.copy(local(ship, c.p.x, c.p.y, c.p.z));
  b.group.quaternion.copy(ship.quat).multiply(c.q);
}

/** where droid #0 ends up after slicing R4's dome (ship-local, beside the socket), and how it faces */
const R4_CUTTER = v3(1.6, 0.6, 0.4);
function cutterAtSocket(w: World, ship: FlightState, T: number): void {
  const b = w.buzz[0];
  const k = w.loc.socketO;
  b.group.visible = true;
  b.group.position.copy(local(ship, k.x + R4_CUTTER.x, k.y + R4_CUTTER.y, k.z + R4_CUTTER.z));
  b.group.quaternion.copy(ship.quat).multiply(new Quaternion().setFromAxisAngle(v3(0, 1, 0), Math.PI * 0.5));
  b.setDeploy(1);
  b.animate(T * 1.6);
}

/** the buzz droids still on Obi-Wan's fighter after the rescue (#3 was blasted, #4 jumped ship and was zapped) */
function survivorsOn(w: World, ship: FlightState, T: number): void {
  cutterAtSocket(w, ship, T);
  [1, 2, 5].forEach((i, n) => {
    const b = w.buzz[i];
    b.group.visible = true;
    crawlOn(ship, i, T, b);
    b.setDeploy(1);
    b.animate(T * 1.6 + n);
  });
}

/* --- shot 9: buzz droids at work; R4 loses her head */

const R4_POP = 2.55;
const buzzClose: Shot = {
  name: 'buzz-close',
  dur: 4.5,
  schedule(w, T0) {
    // cutting sparks from each droid's saw, and R4's dome popping: both travel with the fighter (200 u/s)
    const shipVel = (T: number) => flight(obiPath9(T0), T).vel;
    for (const i of [0, 1, 5]) {
      w.fx.sparkStream(T0 + 0.1, T0 + 4.4, (T) => buzzWorld(w, i, T, T0), () => v3(0, 1, 0), 60, 70 + i, 6, shipVel);
    }
    w.fx.explosion(T0 + R4_POP, r4World(w, T0 + R4_POP, T0), { size: 1.6, pieces: 6, sparks: 50, smoke: 2, colors: ['red', 'flatSilver', 'white'], seed: 901, inherit: shipVel(T0 + R4_POP).clone().multiplyScalar(0.95) });
  },
  pose(w, t, T) {
    battle(w, T);
    const T0 = T - t;
    const o = flight(obiPath9(T0), T, { bank: 0.6 });
    o.pos.add(shake(t, 0.1, 3, 31));
    fly(w, w.obiwanShip, o, 1);
    face(w.obiwan, { mouth: t > R4_POP ? 'o' : 'frown', brows: 0.9, lookX: 0.03, lookY: -0.01 }, t, 2);
    w.obiwan.pose({ legL: Math.PI / 2, legR: Math.PI / 2, armL: 0.95, armR: 0.95, splayL: 0.08, splayR: 0.08, headYaw: 0.45, headPitch: 0.1 });
    w.buzz.forEach((b, i) => {
      b.group.visible = i === 0 || i === 1 || i === 5;
      crawlOn(o, i, T, b);
      b.setDeploy(1);
      b.animate(T * 1.6 + i);
    });
    // droid 0 walks to the socket and slices R4's dome
    const r4 = w.r4;
    const sock = anchorWorld(w.obiwanShip.astromechAnchor);
    const b0 = w.buzz[0];
    const walk = smoother(0.2, 1.8, t);
    const c0 = crawlLocal(0, T);
    b0.group.position.copy(local(o, c0.p.x, c0.p.y, c0.p.z).lerp(sock.clone().add(R4_CUTTER.clone().applyQuaternion(o.quat)), walk));
    b0.group.quaternion.copy(o.quat).multiply(c0.q).slerp(o.quat.clone().multiply(new Quaternion().setFromAxisAngle(v3(0, 1, 0), Math.PI * 0.5)), walk);
    const pop = t - R4_POP;
    if (pop > 0) {
      // the dome flies off, tumbling (it is re-attached by the next shots' reset)
      r4.head.position.set(0.4 * pop * 3, 1 + pop * 6 - pop * pop * 2, -pop * 9);
      r4.head.rotation.set(pop * 7, pop * 3, pop * 5);
    } else {
      r4.head.position.set(0, r4.head.userData.baseY ?? r4.head.position.y, 0);
      r4.head.userData.baseY ??= r4.head.position.y;
      r4.head.rotation.set(0, Math.sin(T * 6) * 0.4, 0);
    }
    const cam = local(o, 12, 5.5, 9);
    w.aimShadow(o.pos, 16);
    return { pos: cam, target: sock.clone().add(v3(-1.2, 1.2, 0).applyQuaternion(o.quat)), fov: 28, near: 0.05, lens: { focus: cam.distanceTo(sock), aperture: 7 } };
  },
};

function obiPath9(T0: number) {
  const base = v3(1300, -1150, 23500);
  return (tt: number) => base.clone().add(v3(Math.sin((tt - T0) * 0.8) * 6, Math.sin((tt - T0) * 0.6) * 4, (tt - T0) * 200));
}
function r4World(w: World, T: number, T0: number): Vector3 {
  const st = flight(obiPath9(T0), T);
  const k = w.loc.socketO;
  return local(st, k.x, k.y + 0.9, k.z);
}
function buzzWorld(w: World, i: number, T: number, T0: number): Vector3 {
  const st = flight(obiPath9(T0), T);
  const c = crawlLocal(i, T);
  return local(st, c.p.x, c.p.y + 0.3, c.p.z).add(v3(0, 0, 0.8).applyQuaternion(st.quat.clone().multiply(c.q)));
}

const obiCockpit2 = cockpitShot({
  name: 'obiwan-cockpit-2',
  dur: 2.6,
  who: 'obiwan',
  // the natural urgent read runs ~3.4 s against a 2.6 s shot: it starts over the end of buzz-close
  lines: [{ t0: -0.95, t1: 2.5, who: 'Obi-Wan Kenobi', text: "Get out of here, Anakin! There's nothing more you can do." }],
  // urgent, pleading: brows up at the inner ends, a tense squint, every open shape with its corners dragged down
  // the recording breathes between 'Anakin!' and 'There's nothing more…' (0.64-0.93 s)
  faceAt: (t) => ({ mouth: t > 0.66 && t < 0.92 ? 'frown' : talk(t, 0.0, 2.4, 'frown', ['yell', 'worry', 'yell', 'o', 'worry']), brows: 0.8, squint: 0.18, lookX: -0.03 }),
  // Anakin flies off his starboard side: from the port camera Obi-Wan looks screen left, Anakin's
  // reverse (below) looks screen right, so the two singles face each other across the cut
  headAt: () => ({ yaw: -0.5, pitch: 0.02 }),
  cam: [[1.35, 2.9, 3.95], [1.25, 2.9, 3.8]],
  fov: [33, 31],
  aim: [-0.6, 0.73, 0],
  key: [-0.6, 0.45, 0.65],
  keyColor: 0xffb48c,
  keyI: 2.8,
  fill: 0.45,
});

const anakinCockpit2 = cockpitShot({
  name: 'anakin-cockpit-2',
  dur: 2.6,
  who: 'anakin',
  lines: [{ t0: 0.2, t1: 2.5, who: 'Anakin Skywalker', text: "I'm not leaving without you, Master." }],
  faceAt: (t) => ({ mouth: talk(t, 0.24, 1.82, 'grit'), brows: -0.9, squint: 0.2, lookX: 0.03 }),
  headAt: () => ({ yaw: 0.45, pitch: 0 }),
  cam: [[-1.35, 2.85, 3.95], [-1.25, 2.9, 3.8]],
  fov: [34, 32],
  aim: [0.6, 0.66, 0],
  key: [0.6, 0.45, 0.65],
  keyI: 3.0,
  fill: 0.5,
});

/* --- shot 11: Anakin blasts one droid off; R2 zaps another */

/** droid #4's leap from Obi-Wan's fighter to Anakin's, seconds into the rescue */
const RESCUE_LEAP = [1.35, 1.85] as const;
/**
 * Where droid #4 lands on Anakin's port S-foil: outboard of R2 and level with him, facing him, so the
 * camera (ahead of the fighters) sees R2 in front of the droid and the zap crossing open wing between them.
 */
const ZAP_SPOT = (() => {
  const x = 6.6, z = 0.4;
  const up = v3(-0.384, 1, 0).normalize();
  const h = v3(-1, 0, 0);
  const fwd = h.sub(up.clone().multiplyScalar(h.dot(up))).normalize();
  return { p: v3(x, foilTop(x) + BUZZ_LIFT, z), q: basisQuat(fwd, up) };
})();

function pair11(T0: number) {
  const base = v3(1500, -1100, 24500);
  return (tt: number) => base.clone().add(v3(Math.sin((tt - T0) * 0.7) * 5, 0, (tt - T0) * 210));
}
/** Anakin in the rescue: off Obi-Wan's port quarter, closing in over 1.0-2.3 s. Effects and pose share it, so zaps land on R2. */
function anakin11(T0: number) {
  return (tt: number) => {
    // C2 ease: with smoothstep the heading's turn rate snapped from 26 to 0 deg/s as the close-in ended
    const s = smoother(1.0, 2.3, tt - T0);
    return pair11(T0)(tt).add(v3(-30 + s * 12, 6 - s * 3, -26 + s * 16));
  };
}
const rescue: Shot = {
  name: 'rescue',
  blur: 2,
  dur: 4,
  schedule(w, T0) {
    const pa = anakin11(T0);
    const ok = flight(pair11(T0), T0 + 0.85, { bank: 0.6 });
    const c3 = crawlLocal(3, T0 + 0.85);
    const pk = local(ok, c3.p.x, c3.p.y, c3.p.z);
    for (let t = 0.45; t < 0.8; t += 0.1) {
      const st = flight(pa, T0 + t, { bank: 0.6 });
      for (const mz of w.loc.muzzlesA) {
        const from = local(st, mz.x, mz.y, mz.z + 0.6);
        w.fx.laser({ t0: T0 + t, from, dir: pk.clone().sub(from), speed: 900, life: pk.distanceTo(from) / 900, length: 5, width: 0.6, color: 'red' });
      }
    }
    w.fx.explosion(T0 + 0.85, pk, { size: 5, pieces: 26, sparks: 40, smoke: 3, colors: ['flatSilver', 'dbg', 'lbg'], seed: 1101, inherit: ok.vel.clone().multiplyScalar(0.9) });
    // R2's zap lands on the droid that jumped ship (the arc itself is posed per frame): hit sparks, then its head pops
    const droidAt = (T: number) => local(flight(pa, T, { bank: 0.6 }), ZAP_SPOT.p.x, ZAP_SPOT.p.y + 0.6, ZAP_SPOT.p.z);
    w.fx.sparkStream(T0 + 2.0, T0 + 2.7, droidAt, () => v3(0.3, 0.8, -0.2), 220, 1102, 7, (T) => flight(pa, T).vel);
    w.fx.explosion(T0 + 2.65, droidAt(T0 + 2.65).add(v3(0, 0.5, 0)), { size: 1.4, pieces: 5, sparks: 30, smoke: 1, colors: ['flatSilver', 'dbg'], seed: 1103, inherit: flight(pa, T0 + 2.65).vel.clone().multiplyScalar(0.9) });
  },
  pose(w, t, T) {
    battle(w, T);
    const T0 = T - t;
    const o = flight(pair11(T0), T, { bank: 0.6 });
    const a = flight(anakin11(T0), T, { bank: 0.6 });
    fly(w, w.obiwanShip, o, 1);
    fly(w, w.anakinShip, a, 1);
    w.r4.head.visible = false;
    face(w.anakin, { mouth: t < 2 ? 'grit' : 'smirk', brows: -0.7 }, t, 1);
    face(w.obiwan, { mouth: 'frown', brows: 0.6 }, t, 2);
    // droids on Obi-Wan's wings; #3 is blasted, #0 keeps working at R4's socket
    [1, 2, 3, 5].forEach((i, n) => {
      const b = w.buzz[i];
      const gone = i === 3 && t > 0.85;
      b.group.visible = !gone;
      crawlOn(o, i, T, b);
      b.setDeploy(1);
      b.animate(T * 1.6 + n);
    });
    cutterAtSocket(w, o, T);
    // #4 leaps from Obi-Wan's fuselage to Anakin's wing as the fighters close up, and R2 zaps it there
    const b4 = w.buzz[4];
    b4.group.visible = true;
    const leap = smoother(RESCUE_LEAP[0], RESCUE_LEAP[1], t);
    const onA = local(a, ZAP_SPOT.p.x, ZAP_SPOT.p.y, ZAP_SPOT.p.z);
    const qA = a.quat.clone().multiply(ZAP_SPOT.q);
    if (leap <= 0) crawlOn(o, 4, T, b4);
    else {
      const c4 = crawlLocal(4, T0 + RESCUE_LEAP[0]);
      const from = local(o, c4.p.x, c4.p.y, c4.p.z);
      b4.group.position.copy(from.lerp(onA, leap)).add(v3(0, 4 * leap * (1 - leap) * 3.5, 0));
      b4.group.quaternion.copy(o.quat).multiply(c4.q).slerp(qA, leap);
    }
    b4.setDeploy(1);
    b4.animate(T);
    // R2's zap: a crackling arc from his dome into the droid
    if (t >= 2.0 && t <= 2.72) {
      const k = Math.floor(T * 48);
      if ((k * 7919) % 10 !== 4) w.zapArc(local(a, w.loc.zapA.x, w.loc.zapA.y, w.loc.zapA.z), b4.group.position.clone().add(v3(0, 0.6, 0)), k);
    }
    // headless after the zap, it lets go and tumbles away behind the fighter
    const fall = t - 2.8;
    if (fall > 0) {
      b4.group.position.add(a.fwd.clone().multiplyScalar(-fall * fall * 45)).add(v3(0, -fall * 7, 0));
      b4.group.quaternion.multiply(new Quaternion().setFromAxisAngle(v3(1, 0.3, 0.2).normalize(), fall * 7));
    }
    const hp = t - 2.65;
    b4.head.visible = true;
    if (hp > 0) {
      b4.head.position.set(hp * 2, 0.6 + hp * 5 - hp * hp * 3, -hp * 8);
      b4.head.rotation.set(hp * 9, hp * 4, 0);
    } else {
      b4.head.position.set(0, b4.head.userData.baseY ?? b4.head.position.y, 0);
      b4.head.userData.baseY ??= b4.head.position.y;
      b4.head.rotation.set(0, 0, 0);
    }
    w.r2.setHeadYaw(t > 1.8 ? Math.sin(T * 9) * 0.6 : 0);
    const mid = o.pos.clone().lerp(a.pos, 0.5);
    const zapFocus = local(a, w.loc.zapA.x, w.loc.zapA.y, w.loc.zapA.z);
    const look = mid.clone().lerp(zapFocus, smooth(1.4, 2.2, t) * 0.8);
    const cam = local({ pos: mid, quat: basisQuat(o.fwd, v3(0, 1, 0)) }, lerp(-24, -12, smooth(1.4, 2.2, t)), lerp(10, 6, smooth(1.4, 2.2, t)), lerp(30, 16, smooth(1.4, 2.2, t))).add(shake(t, 0.2, 1.2, 19));
    w.aimShadow(mid, 30);
    return { pos: cam, target: look, fov: 30, lens: { exposure: 1.05 } };
  },
};

/* --- shot 12: into the hangar */

/** a smooth max(x, 0) with a knee `k` wide */
const softplus = (x: number, k: number) => (x > 30 * k ? x : k * Math.log1p(Math.exp(x / k)));

/**
 * Obi-Wan's line into the open bay, as (out of the mouth, toward pad B, up) from the centre of the
 * outer lip, `t` seconds into the shot: braking hard from 900 out, 32 out as the ray shield dies
 * (2.45 s), across the lip at 2.84 s and still moving (≈50/s) over the forward deck at 4 s, where the
 * landing picks him up coming through the mouth. Anakin trails 24 back, 24 toward his own pad and 5 up.
 */
function approachLine(t: number): [number, number, number] {
  const v1 = 45, k = 1.25, d0 = 900, d4 = -70;
  const v0 = v1 + ((d0 - v1 * 4 - d4) * k) / (1 - Math.exp(-4 * k));
  const u = t / 4;
  return [d0 - v1 * t - ((v0 - v1) * (1 - Math.exp(-k * t))) / k, lerp(36, -12, smoother(0, 0.72, u)), lerp(62, -9, smoother(0, 0.66, u))];
}
const ANA_TRAIL: [number, number, number] = [24, 24, 5];

const hangarApproach: Shot = {
  name: 'hangar-approach',
  blur: 2,
  dur: 4,
  pose(w, t, T) {
    battle(w, T, { swarms: true });
    poseHand(w);
    crawlerPoses(w, T);
    const mouthA = w.hand.anchors['hangar'];
    const mouth = mouthA ? anchorWorld(mouthA) : HAND_POS.clone().add(v3(0, 0, -300));
    const out = mouthA ? v3(0, 0, 1).applyQuaternion(mouthA.getWorldQuaternion(new Quaternion())) : v3(0, 0, -1);
    const side = v3(0, 1, 0).cross(out).normalize();
    const up = v3(0, 1, 0);
    const at = (l: [number, number, number]) => mouth.clone().addScaledVector(out, l[0]).addScaledVector(side, l[1]).addScaledVector(up, l[2]);
    // the real hangar set, fitted behind the mouth: the fighters fly into the bay the landing plays in
    const bayA = w.hand.anchors['bay'];
    if (bayA) {
      w.hand.setBayProxy(false);
      w.hangar.group.visible = true;
      w.placeHangar(anchorWorld(bayA), bayA.getWorldQuaternion(new Quaternion()));
      w.hangar.setShield(0);
      w.hangarLights.visible = true;
    }
    const shield = t < 2.0 ? 1 : t < 2.45 ? (Math.sin(t * 90) > 0 ? 0.7 : 0.12) : 0;
    w.hand.setShield(shield);
    const T0 = T - t;
    const obiL = (tt: number) => approachLine(tt - T0);
    const anaL = (tt: number): [number, number, number] => {
      const l = obiL(tt);
      return [l[0] + ANA_TRAIL[0], l[1] + ANA_TRAIL[1], l[2] + ANA_TRAIL[2]];
    };
    const o = flight((tt) => at(obiL(tt)), T, { bank: 0.8 });
    const a = flight((tt) => at(anaL(tt)), T, { bank: 0.8 });
    fly(w, w.obiwanShip, o, 0.3);
    fly(w, w.anakinShip, a, 0.3);
    w.r4.head.visible = false;
    survivorsOn(w, o, T);
    const u = t / 4;
    const al = anaL(T);
    // chase Anakin 52 back, easing to a stop 44 out from the lip; settle on the mouth's axis a little above the fighters
    const camOut = 44 + softplus(al[0] + 52 - 44, 14);
    const camSide = lerp(50, 4, smoother(0.05, 0.85, u));
    const camUp = lerp(al[2] + 13, 3, smoother(0.5, 0.9, u));
    const camPos = at([camOut, camSide, camUp]).add(shake(t, 0.2 * (1 - 0.6 * smooth(2.8, 3.6, t)), 1.2, 23));
    const mid = a.pos.clone().lerp(o.pos, 0.5);
    const look = mid.clone().addScaledVector(out, -160).addScaledVector(up, 2).lerp(at([-110, -2, -7]), smooth(0.5, 0.92, u));
    // warm spill from the open bay onto the fighters as they close on it, steep enough that the glossy deck never mirrors it into the lens
    w.keyLight(mid, out.clone().multiplyScalar(-0.35).add(up), 2.2 * smooth(0.3, 0.72, u), 0xffc48a);
    // as the bay fills the frame, the fill turns from starlight to the bay's own warm light (the landing's interior values)
    const inBay = smooth(2.3, 3.4, t);
    w.hemi.color.lerp(new Color(0x6d6258), inBay);
    w.hemi.groundColor.lerp(new Color(0x2a2622), inBay);
    w.hemi.intensity = lerp(w.hemi.intensity, 0.4, inBay);
    w.scene.environmentIntensity = lerp(1, 0.6, inBay);
    // one frustum around the fighters and the whole bay (whose ceiling keeps the sun off the deck), tightening as they close
    const bayC = at([-72, 0, 2]);
    const rb = 135;
    const dF = mid.distanceTo(bayC);
    const r = Math.max(rb, (dF + rb + 16) / 2);
    w.aimShadow(dF > 1e-3 ? bayC.clone().lerp(mid, (r - rb) / dF) : bayC, r);
    return { pos: camPos, target: look, fov: 36, lens: { exposure: 1.05 } };
  },
};

/* --- hangar interior: crash landing, then the droids */

function hangarSpots(w: World) {
  w.hangar.group.visible = true;
  w.placeHangar();
  const A = w.hangar.anchors['landingA'] ? anchorWorld(w.hangar.anchors['landingA']) : v3(-30, 0, 0);
  const B = w.hangar.anchors['landingB'] ? anchorWorld(w.hangar.anchors['landingB']) : v3(30, 0, 0);
  const M = w.hangar.anchors['mouth'] ? anchorWorld(w.hangar.anchors['mouth']) : v3(0, 18, 70);
  const D = w.hangar.anchors['droidLine'] ? anchorWorld(w.hangar.anchors['droidLine']) : v3(0, 0, -40);
  const Dq = w.hangar.anchors['droidLine'] ? w.hangar.anchors['droidLine'].getWorldQuaternion(new Quaternion()) : new Quaternion().setFromAxisAngle(v3(0, 1, 0), 0);
  return { A, B, M, D, Dq };
}

interface Handoff { p: Vector3; v: Vector3; q: Quaternion }
const handoffs = new WeakMap<World, { obi: Handoff; ana: Handoff }>();
/**
 * Where the approach leaves each fighter at its last instant (4.0 s: position, velocity, attitude), in the
 * hangar set's frame, through the same fit of the set into the ship that the approach uses. The landing
 * picks both fighters up there, so the entry is one continuous move across the cut.
 */
function approachHandoff(w: World): { obi: Handoff; ana: Handoff } {
  let h = handoffs.get(w);
  if (h) return h;
  const vis = w.hand.group.visible;
  poseHand(w);
  w.hand.group.updateMatrixWorld(true);
  const mouthA = w.hand.anchors['hangar'], bayA = w.hand.anchors['bay'];
  const mouth = anchorWorld(mouthA);
  const out = v3(0, 0, 1).applyQuaternion(mouthA.getWorldQuaternion(new Quaternion()));
  const side = v3(0, 1, 0).cross(out).normalize();
  const at = (l: [number, number, number]) => mouth.clone().addScaledVector(out, l[0]).addScaledVector(side, l[1]).addScaledVector(v3(0, 1, 0), l[2]);
  const pBay = anchorWorld(bayA), qInv = bayA.getWorldQuaternion(new Quaternion()).invert();
  const state = (l: (t: number) => [number, number, number]): Handoff => {
    const st = flight((tt) => at(l(tt)), 4.0, { bank: 0.8 });
    return { p: st.pos.clone().sub(pBay).applyQuaternion(qInv), v: st.vel.clone().applyQuaternion(qInv), q: qInv.clone().multiply(st.quat) };
  };
  h = { obi: state(approachLine), ana: state((t) => { const l = approachLine(t); return [l[0] + ANA_TRAIL[0], l[1] + ANA_TRAIL[1], l[2] + ANA_TRAIL[2]]; }) };
  w.hand.group.visible = vis;
  handoffs.set(w, h);
  return h;
}

/** Lift or lower a part along world Y (through its parent's frame) until its lowest point is on the deck; `liftOnly` never lowers. */
function onDeck(p: Object3D, deckY: number, liftOnly: boolean): void {
  p.updateMatrixWorld(true);
  const dy = deckY - new Box3().setFromObject(p, true).min.y;
  if (liftOnly && dy <= 0) return;
  const q = p.parent ? p.parent.getWorldQuaternion(new Quaternion()).invert() : new Quaternion();
  const s = p.parent ? p.parent.getWorldScale(new Vector3()) : v3(1, 1, 1);
  p.position.add(v3(0, dy, 0).applyQuaternion(q).divide(s));
}

const lowCache = new WeakMap<Eta2, { pts: Float32Array; part: Int16Array }>();
/**
 * A fighter's underside vertices in its own frame with the S-foils closed (how it skids and rests),
 * tagged with the breakable part they belong to (−1 = hull). `foils` is the frame's own foil setting, restored after.
 */
function undersides(ship: Eta2, foils: number): { pts: Float32Array; part: Int16Array } {
  let c = lowCache.get(ship);
  if (c) return c;
  ship.setFoils(0);
  ship.group.updateMatrixWorld(true);
  const inv = ship.group.matrixWorld.clone().invert();
  const m = new Matrix4(), v = new Vector3();
  const partOf = new Map<Object3D, number>();
  ship.breakables.forEach((p, i) => p.traverse((o) => partOf.set(o, i)));
  const all: number[] = [], tag: number[] = [];
  let minY = Infinity;
  ship.group.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = (o as Mesh).geometry.getAttribute('position');
    const i = partOf.get(o) ?? -1;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(m);
      all.push(v.x, v.y, v.z);
      tag.push(i);
      minY = Math.min(minY, v.y);
    }
  });
  // a 3-stud band above the lowest point covers every tilt the wreck goes through
  const pts: number[] = [], part: number[] = [];
  for (let k = 0; k < tag.length; k++) {
    if (all[k * 3 + 1] < minY + 3) {
      pts.push(all[k * 3], all[k * 3 + 1], all[k * 3 + 2]);
      part.push(tag[k]);
    }
  }
  c = { pts: new Float32Array(pts), part: new Int16Array(part) };
  lowCache.set(ship, c);
  ship.setFoils(foils);
  return c;
}

/** Set a fighter's lowest point (ignoring parts it has shed) onto the deck; `liftOnly` just stops it passing through. */
function hullOnDeck(ship: Eta2, deckY: number, foils: number, shed: (i: number) => boolean, liftOnly: boolean): void {
  const { pts, part } = undersides(ship, foils);
  ship.group.updateMatrixWorld(true);
  const e = ship.group.matrixWorld.elements;
  let low = Infinity;
  for (let k = 0; k < part.length; k++) {
    if (part[k] >= 0 && shed(part[k])) continue;
    const x = pts[k * 3], y = pts[k * 3 + 1], z = pts[k * 3 + 2];
    low = Math.min(low, e[1] * x + e[5] * y + e[9] * z + e[13]);
  }
  const dy = deckY - low;
  if (liftOnly && dy <= 0) return;
  ship.group.position.y += dy;
  ship.group.updateMatrixWorld(true);
}

const LANDING_DUR = 5;
/** when each of Obi-Wan's first three breakable wing parts tears off, seconds into the landing shot */
const wreckBreak = (i: number) => 1.05 + i * 0.18;

/**
 * A wing part shed on impact, `dt` seconds after it tore off: it hops, slides to a stop against the
 * deck's friction and tumbles to rest, never sinking through the deck and never left hovering.
 * The landing and every later hangar shot pose the parts through this, so they carry across the cuts.
 */
function wreckPose(ship: Eta2, i: number, dt: number, deckY: number): void {
  const p = ship.breakables[i];
  const hm = p.userData.home as { pos: Vector3; quat: Quaternion };
  if (dt <= 0) {
    p.position.copy(hm.pos);
    p.quaternion.copy(hm.quat);
    return;
  }
  const rng = new Rng(1400 + i);
  const dx = rng.range(-1, 1), dz = rng.range(0.2, 1);
  const axis = v3(rng.range(-1, 1), 1, rng.range(-1, 1)).normalize();
  const spin = rng.range(5, 9);
  const k = 1.4;
  const s = (1 - Math.exp(-dt * k)) / k;
  ship.group.updateMatrixWorld(true);
  p.quaternion.copy(hm.quat).multiply(new Quaternion().setFromAxisAngle(axis, spin * s));
  p.position.set(hm.pos.x + dx * 14 * s, hm.pos.y, hm.pos.z + dz * 10 * s);
  const attachedY = p.position.clone();
  onDeck(p, deckY, false);
  // leave the wing smoothly, then rest on the deck with a hop on top
  p.position.lerpVectors(attachedY, p.position, smoother(0, 0.35, dt));
  const hop = Math.max(0, dt * 6 - dt * dt * 9);
  if (hop > 0) {
    const q = ship.group.getWorldQuaternion(new Quaternion()).invert();
    p.position.add(v3(0, hop, 0).applyQuaternion(q));
  }
  onDeck(p, deckY, true);
}

/** Obi-Wan's wreck, sliding (`t` into the landing) or at rest: the same frame either way so the cut into the jump-out is seamless */
function obiWreckQuat(s: { A: Vector3; M: Vector3 }, t: number): Quaternion {
  const bump = t > 1.0 ? Math.max(0, Math.sin((t - 1.0) * 9) * Math.exp(-(t - 1.0) * 3)) * 0.8 : 0;
  const dir = s.A.clone().sub(s.M).setY(0).normalize();
  return basisQuat(dir, v3(0, 1, 0)).multiply(new Quaternion().setFromEuler(new Euler(0.05 - bump * 0.2, smooth(1.0, 2.6, t) * 0.5, smooth(1.0, 1.6, t) * 0.12 - bump * 0.1)));
}

const landing: Shot = {
  name: 'landing',
  blur: 2,
  dur: LANDING_DUR,
  schedule(w, T0) {
    const s = hangarSpots(w);
    const rng = new Rng(1301);
    w.fx.sparkStream(T0 + 1.0, T0 + 2.6, (T) => obiSlide(s, T - T0).add(v3(0, 0.2, 0)), () => v3(0, 0.7, 0.7), 160, 1302, 7);
    w.fx.explosion(T0 + 1.05, obiSlide(s, 1.05), { size: 7, pieces: 40, sparks: 50, smoke: 5, colors: ['red', 'white', 'lbg', 'dbg'], seed: 1303 });
    w.fx.explosion(T0 + 1.7, obiSlide(s, 1.7).add(v3(4, 1, 0)), { size: 5, pieces: 30, sparks: 30, smoke: 4, colors: ['red', 'white', 'lbg'], seed: 1304 });
    void rng;
  },
  pose(w, t, T) {
    w.interior();
    hangarSpots(w);
    const s = hangarSpots(w);
    w.hangar.setShield(0);
    // Obi-Wan: picks up where the approach left him inside the mouth, slams down, skids, sheds wings
    const h = approachHandoff(w);
    const op = obiSlide(s, t, h.obi);
    const oq = t < 1 ? h.obi.q.clone().slerp(obiWreckQuat(s, t), smoother(0, 0.7, t)) : obiWreckQuat(s, t);
    fly(w, w.obiwanShip, { pos: op, quat: oq } as FlightState, t < 1 ? 0.3 : 0, t < 2.6 ? 1 - smooth(1.8, 2.6, t) : 0);
    // from the slam-down on, the belly rides the deck (it pivots on its lowest point as it bucks)
    hullOnDeck(w.obiwanShip, s.A.y, t < 1 ? 0.3 : 0, (i) => i < 3 && t > wreckBreak(i), t < 1.0);
    w.r4.head.visible = false;
    // the last buzz droids ride the fighter in until the slam-down blast takes them
    if (t < 1.05) survivorsOn(w, { pos: w.obiwanShip.group.position.clone(), quat: w.obiwanShip.group.quaternion.clone() } as FlightState, T);
    // the first three wing parts tear off on impact and tumble to rest on the deck
    for (let i = 0; i < 3; i++) wreckPose(w.obiwanShip, i, t - wreckBreak(i), s.A.y);
    face(w.obiwan, { mouth: t < 1.0 ? 'shout' : 'o', brows: 0.9 }, t, 2);
    // Anakin: carries on from where the approach left him behind Obi-Wan, brakes (critically damped, no
    // overshoot), flares and is on his pad by 4.4 s exactly as before
    const bdir = s.B.clone().sub(s.M).setY(0).normalize();
    const u = smoother(0, 4.4, t);
    const pad = s.B.clone().add(v3(0, 1.8, 0));
    // brake into a hover 5 over the pad, then set down between 3.0 and 4.4 s
    const hover = pad.clone().add(v3(0, 5, 0));
    const k = 2.0;
    const c1 = h.ana.p.clone().sub(hover), c2 = h.ana.v.clone().addScaledVector(c1, k);
    const brake = c1.addScaledVector(c2, t).multiplyScalar(Math.exp(-k * t) * (1 - smoother(3.4, 4.4, t)));
    const ap = hover.clone().add(brake).add(v3(0, -5 * smoother(3.0, 4.4, t), 0));
    const aq = h.ana.q.clone().slerp(basisQuat(bdir, v3(0, 1, 0)), smoother(0, 3.0, t));
    fly(w, w.anakinShip, { pos: ap, quat: aq } as FlightState, 0.3 * (1 - u), 1 - u * 0.8);
    face(w.anakin, { mouth: 'smirk', brows: -0.2 }, t, 1);
    // camera: floor level, watching the skid come toward us
    const camPos = s.A.clone().add(v3(-26, 3.2, -30));
    const look = op.clone().lerp(s.A, 0.3).add(v3(0, 2, 0));
    w.aimShadow(s.A, 70, v3(0.2, 1, 0.3).normalize());
    // the slam-down shake eases in on impact and dies away over the skid instead of switching on and off
    return { pos: camPos.add(shake(t, 0.05 + 0.3 * smooth(0.96, 1.06, t) * (1 - smooth(1.5, 2.3, t)), 3, 41)), target: look, fov: 34, near: 0.1, lens: { exposure: 1.1, bloom: 1.1 } };
  },
};

/** Obi-Wan's landing, `t` into the shot; in the air (t < 1) from the approach's hand-off when given (with its velocity), otherwise from the mouth */
function obiSlide(s: ReturnType<typeof hangarSpots>, t: number, from?: Handoff): Vector3 {
  const u = smoother(0, 1, t / 1.0);
  const touch = s.A.clone().add(s.A.clone().sub(s.M).setY(0).normalize().multiplyScalar(-34));
  if (t < 1.0 && from) {
    const x = Math.max(0, t);
    const h00 = 2 * x ** 3 - 3 * x * x + 1, h10 = x ** 3 - 2 * x * x + x, h01 = -2 * x ** 3 + 3 * x * x;
    return from.p.clone().multiplyScalar(h00).addScaledVector(from.v, h10).addScaledVector(touch, h01);
  }
  const air = s.M.clone().lerp(touch, u);
  if (t < 1.0) return air.add(v3(0, 3 * (1 - u), 0));
  const skid = smoother(0, 1, (t - 1.0) / 1.6);
  const p0 = s.A.clone().add(s.A.clone().sub(s.M).setY(0).normalize().multiplyScalar(-34));
  return p0.lerp(s.A, skid).setY(s.A.y + 1.5);
}

/** where the Jedi stand to face the droids: the jump-out lands them here, the droids shot starts here */
function jediMarks(s: ReturnType<typeof hangarSpots>) {
  const mid = s.A.clone().lerp(s.B, 0.5);
  const toDroids = s.D.clone().sub(mid).setY(0).normalize();
  const yaw = Math.atan2(toDroids.x, toDroids.z);
  const side = v3(toDroids.z, 0, -toDroids.x);
  const obiPos = mid.clone().add(side.clone().multiplyScalar(3.5)).add(toDroids.clone().multiplyScalar(4));
  const anaPos = mid.clone().add(side.clone().multiplyScalar(-3.5)).add(toDroids.clone().multiplyScalar(4));
  return { mid, toDroids, yaw, side, obiPos, anaPos };
}

/**
 * Both fighters parked after the landing (Obi-Wan's wrecked, its broken parts on the deck), canopies
 * 0..1 open; `since` = seconds since the landing shot ended, so the wreck parts carry on from its last frame.
 */
function parkFighters(w: World, s: ReturnType<typeof hangarSpots>, canopy: number, since: number): void {
  fly(w, w.obiwanShip, { pos: s.A.clone().setY(s.A.y + 1.5), quat: obiWreckQuat(s, LANDING_DUR + since) } as FlightState, 0, 0);
  hullOnDeck(w.obiwanShip, s.A.y, 0, (i) => i < 3, false);
  for (let i = 0; i < 3; i++) wreckPose(w.obiwanShip, i, LANDING_DUR + since - wreckBreak(i), s.A.y);
  w.r4.head.visible = false;
  fly(w, w.anakinShip, { pos: s.B.clone().setY(s.B.y + 1.8), quat: basisQuat(s.B.clone().sub(s.M).setY(0).normalize(), v3(0, 1, 0)) } as FlightState, 0, 0);
  w.obiwanShip.canopy.rotation.x = -1.05 * canopy;
  w.anakinShip.canopy.rotation.x = -0.9 * canopy;
}

const FLIP_DUR = JUMP_OUT.flip;
const JUMP_OBI = JUMP_OUT.obi, JUMP_ANA = JUMP_OUT.ana;
/**
 * A pilot vaulting out of the cockpit: a ballistic arc from the seat to `land` with one tucked front
 * flip (about the torso, not the hips), a little squash on touchdown, then turning to `yawEnd`.
 * `tj` is the time since take-off; before it the pilot is still seated, winding up.
 */
function flipOut(w: World, fig: Minifig, ship: Eta2, land: Vector3, yawEnd: number, tj: number): void {
  if (tj <= 0) {
    const wind = smooth(-0.3, 0, tj);
    fig.pose({ legL: Math.PI / 2, legR: Math.PI / 2, armL: 0.95 + wind * 1.2, armR: 0.95 + wind * 1.2, splayL: 0.08 + wind * 0.3, splayR: 0.08 + wind * 0.3, headPitch: -0.15 * wind });
    return;
  }
  const hip0 = anchorWorld(ship.cockpitAnchor);
  const hip1 = land.clone().add(v3(0, 1.25, 0));
  const travel = hip1.clone().sub(hip0).setY(0);
  const yawTravel = Math.atan2(travel.x, travel.z);
  if (tj < FLIP_DUR) {
    const u = tj / FLIP_DUR;
    const h = Math.max(hip0.y, hip1.y) + 5.5 - (hip0.y + hip1.y) / 2;
    const pos = hip0.clone().lerp(hip1, u);
    pos.y = lerp(hip0.y, hip1.y, u) + 4 * h * u * (1 - u);
    const q = new Quaternion().setFromAxisAngle(v3(0, 1, 0), yawTravel).multiply(new Quaternion().setFromAxisAngle(v3(1, 0, 0), smoother(0.06, 0.9, u) * Math.PI * 2));
    const pivot = v3(0, 0.8, 0);
    w.stand(fig, v3(0, 0, 0), 0);
    fig.group.quaternion.copy(q);
    fig.group.position.copy(pos).add(pivot).sub(pivot.clone().applyQuaternion(q));
    const tuck = Math.pow(Math.sin(Math.PI * u), 0.7);
    fig.pose({ legL: tuck * 1.35, legR: tuck * 1.35, armL: 0.4 + tuck * 1.9, armR: 0.4 + tuck * 1.9, splayL: 0.25 * tuck, splayR: 0.25 * tuck, headPitch: 0.25 * tuck });
    return;
  }
  const tl = tj - FLIP_DUR;
  let dy = yawEnd - yawTravel;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  // feet planted from the first touchdown frame; the impact is sold by the arms, not by sinking into the deck
  w.stand(fig, land, yawTravel + dy * smooth(0.1, 0.55, tl));
  const settle = smooth(0, 0.3, tl);
  fig.pose({ armL: lerp(1.4, 0.15, settle), armR: lerp(1.4, 0.25, settle), splayL: lerp(0.5, 0.1, settle), splayR: lerp(0.5, 0.05, settle) });
}

const jumpOut: Shot = {
  name: 'jump-out',
  dur: 3.4,
  schedule(w, T0) {
    const J = jediMarks(hangarSpots(w));
    w.fx.dust(T0 + JUMP_OBI + FLIP_DUR, J.obiPos, { size: 2.2, seed: 1601 });
    w.fx.dust(T0 + JUMP_ANA + FLIP_DUR, J.anaPos, { size: 2.2, seed: 1602 });
  },
  pose(w, t) {
    w.interior();
    const s = hangarSpots(w);
    w.hangar.setShield(0);
    parkFighters(w, s, smooth(0, 0.4, t), t);
    const J = jediMarks(s);
    flipOut(w, w.obiwan, w.obiwanShip, J.obiPos, J.yaw - 0.9, t - JUMP_OBI);
    flipOut(w, w.anakin, w.anakinShip, J.anaPos, J.yaw + 0.6, t - JUMP_ANA);
    face(w.obiwan, { mouth: t < 1.3 ? 'o' : 'smile', brows: t < 1.3 ? 0.6 : 0.2 }, t, 2);
    face(w.anakin, { mouth: 'grin', brows: -0.3 }, t, 1);
    // wide three-quarter from the droids' side: both flips read in profile against the hangar mouth
    const camPos = J.mid.clone().add(J.toDroids.clone().multiplyScalar(lerp(24, 22, smooth(0, 3.4, t)))).add(v3(0, 6.2, 0)).add(J.side.clone().multiplyScalar(-3));
    const look = J.mid.clone().add(J.toDroids.clone().multiplyScalar(-1.5)).add(v3(0, 4.2, 0));
    w.aimShadow(J.mid, 40, v3(0.2, 1, 0.3).normalize());
    return { pos: camPos.add(shake(t, 0.04, 1, 47)), target: look, fov: 40, near: 0.1, lens: { exposure: 1.1 } };
  },
};

const droids: Shot = {
  name: 'droids',
  cuts: [2.4],
  dur: 5.2,
  lines: [
    { t0: 0.3, t1: 2.2, who: 'Obi-Wan Kenobi', text: 'Flying is for droids.' },
    { t0: 3.7, t1: 5.0, who: 'Battle Droid', text: 'Uh oh.' },
  ],
  pose(w, t, T) {
    w.interior();
    const s = hangarSpots(w);
    w.hangar.setShield(0);
    parkFighters(w, s, 1, jumpOut.dur + t);
    // the Jedi stand where they landed, between the fighters and the droids
    const { mid, toDroids, yaw, side, obiPos, anaPos } = jediMarks(s);
    w.stand(w.obiwan, obiPos, yaw + (t < 2.4 ? -0.9 : 0));
    w.stand(w.anakin, anaPos, yaw + (t < 2.4 ? 0.6 : 0));
    const ign = smooth(2.9, 3.25, t);
    const raise = smooth(2.5, 3.0, t);
    // ready stance: blades up and angled forward over the droids, so they stay in frame
    w.obiwan.pose({ armR: 0.2 + raise * 1.0, armL: 0.1 + raise * 0.3, splayL: 0.1, wristR: raise * (Math.PI / 2 + 0.5), headYaw: t < 2.4 ? 0.3 : 0, headPitch: 0 });
    w.anakin.pose({ armR: 0.25 + raise * 1.15, armL: 0.15, splayL: 0.1, wristR: raise * (Math.PI / 2 - 0.5), headYaw: t < 2.4 ? -0.5 : 0 });
    face(w.obiwan, { mouth: talk(t, 0.35, 2.0, t < 2.4 ? 'smile' : 'smirk'), brows: t < 2.4 ? 0.2 : -0.4, lookX: t < 2.4 ? -0.03 : 0 }, t, 2);
    face(w.anakin, { mouth: t < 2.4 ? 'grin' : 'smirk', brows: -0.4 }, t, 1);
    w.sabers.forEach((sb, i) => {
      const fig = i === 0 ? w.obiwan : w.anakin;
      sb.group.visible = t > 2.5;
      if (sb.group.parent !== fig.gripR) fig.gripR.add(sb.group);
      sb.group.position.set(0, 0, 0);
      sb.group.rotation.set(0, 0, -Math.PI / 2);
      sb.setIgnite(i === 0 ? ign : smooth(3.0, 3.35, t), Math.sin(T * 70 + i) * 0.5);
    });
    // droid line
    // two staggered ranks a few metres in front of the Jedi (the anchor marks the back line)
    const front = mid.clone().add(toDroids.clone().multiplyScalar(17));
    const facing = new Quaternion().setFromAxisAngle(v3(0, 1, 0), yaw + Math.PI);
    const perRow = Math.ceil(w.droids.length / 2);
    w.droids.forEach((d, i) => {
      d.group.visible = true;
      const row = i < perRow ? 0 : 1;
      const k = row === 0 ? i : i - perRow;
      const off = (k - (perRow - 1) / 2) * 3.4 + row * 1.7;
      d.group.position.copy(front).add(side.clone().multiplyScalar(off)).add(toDroids.clone().multiplyScalar(row * 3.4));
      d.group.quaternion.copy(facing);
      const aim = smooth(1.2 + i * 0.08, 1.8 + i * 0.08, t);
      d.pose({ aim, headTilt: t > 3.5 ? Math.sin(t * 6 + i) * 0.15 : 0, lookYaw: t > 3.4 && i === 0 ? -0.4 : 0 });
    });
    // two setups: Obi-Wan's line, then the wide reverse on the droids
    let camPos: Vector3, look: Vector3, fov: number;
    if (t < 2.4) {
      const head = obiPos.clone().add(v3(0, 3.9, 0));
      camPos = head.clone().add(toDroids.clone().multiplyScalar(7.5)).add(side.clone().multiplyScalar(2.2)).add(v3(0, -0.6, 0));
      look = head.clone().add(v3(0, -0.4, 0));
      fov = 26;
      w.aimShadow(obiPos, 20, v3(0.2, 1, 0.3).normalize());
      return { pos: camPos, target: look, fov, near: 0.05, lens: { focus: camPos.distanceTo(head), aperture: 7, exposure: 1.12 } };
    }
    camPos = mid.clone().sub(toDroids.clone().multiplyScalar(lerp(6.2, 5.2, smooth(2.4, 5.2, t)))).add(v3(0, 3.4, 0)).add(side.clone().multiplyScalar(0.8));
    look = front.clone().lerp(mid, 0.3).add(v3(0, 2.5, 0));
    fov = 38;
    w.aimShadow(mid, 40, v3(0.2, 1, 0.3).normalize());
    return { pos: camPos.add(shake(t, 0.05, 1, 43)), target: look, fov, near: 0.05, lens: { focus: camPos.distanceTo(front), aperture: 2.5, exposure: 1.12 } };
  },
};

const endCard: Shot = { name: 'endcard', dur: 4.5, card: true, pose: () => ({ pos: v3(0, 0, 0), target: v3(0, 0, 1), fov: 30 }) };

export const SHOTS: Shot[] = [farfar, crawl, longTake, track, anakinCockpit, vultures, handReveal, obiCockpit, missiles, buzzClose, obiCockpit2, anakinCockpit2, rescue, hangarApproach, landing, jumpOut, droids, endCard];

let acc = 0;
for (const s of SHOTS) {
  s.start = acc;
  acc += s.dur;
}
export const FILM_DURATION = acc;

export function shotAt(T: number): { shot: Shot; t: number; index: number } {
  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    if (T < s.start! + s.dur || i === SHOTS.length - 1) return { shot: s, t: Math.max(0, T - s.start!), index: i };
  }
  return { shot: SHOTS[0], t: 0, index: 0 };
}

export { SUN_DIR, DEFAULT_LENS, clamp, Matrix4 };
