import { Box3, Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { DEFAULT_LENS, type Lens } from '../render/pipeline';
import { Rng, noise1 } from '../core/rng';
import type { FaceState, Mouth } from '../assets/prints';
import type { Minifig } from '../assets/minifig';
import type { Eta2 } from '../assets/types';
import { World, SUN_DIR, VENATOR_SPEED } from './world';
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

/** Venator frame: the hero cruiser advances along +Z from the origin at the long take's start. */
const LONG_T0 = 19.5;
const vFrame = (T: number) => v3(0, 0, VENATOR_SPEED * (T - LONG_T0));

/** Background battle motion shared by all space shots (fleet drift, dogfight swarms). */
function battle(w: World, T: number, o: { swarms?: boolean; fleet?: boolean } = {}): void {
  w.venator.group.visible = o.fleet ?? true;
  w.venator.group.position.copy(vFrame(T));
  w.venator.group.rotation.set(0, 0, 0);
  for (const f of w.fleet) f.root.visible = o.fleet ?? true;
  if (o.swarms ?? true) {
    const m = new Matrix4();
    const rng = new Rng(77);
    const furballs = [v3(900, -700, 9000), v3(-1800, -300, 13000), v3(2400, -1200, 17000), v3(-600, -1500, 21000), v3(3200, 200, 6000), v3(-2800, 400, 4000)];
    const setSwarm = (sw: typeof w.vultureSwarm, n: number, seed: number, speed: number) => {
      sw.group.visible = true;
      const r2 = new Rng(seed);
      for (let i = 0; i < n; i++) {
        const c = furballs[i % furballs.length];
        const R = r2.range(120, 520);
        const w0 = r2.range(0.25, 0.6) * (r2.chance(0.5) ? 1 : -1) * speed;
        const ph = r2.range(0, Math.PI * 2);
        const tilt = r2.range(-0.7, 0.7);
        const path = (t: number) => {
          const a = ph + w0 * t;
          return v3(c.x + Math.cos(a) * R, c.y + Math.sin(a * 1.3) * R * 0.35 + Math.sin(a) * R * tilt, c.z + Math.sin(a) * R + VENATOR_SPEED * 0.5 * t);
        };
        const st = flight(path, T, { bank: 1.4 });
        m.compose(st.pos, st.quat, v3(1, 1, 1));
        sw.set(i, m);
      }
      sw.commit(n);
    };
    setSwarm(w.vultureSwarm, 60, 11, 1);
    setSwarm(w.arcSwarm, 24, 12, 0.8);
    setSwarm(w.triSwarm, 16, 13, 1.2);
    void rng;
  }
}

/** Schedule the capital-ship slugfest: turbolaser salvos and hull hits across the whole battle. */
export function scheduleBattle(w: World, T0: number, T1: number): void {
  const rng = new Rng(2024);
  const rep = [w.venator.group, ...w.fleet.filter((f) => f.kind === 'venator').map((f) => f.root)];
  const sep = [...w.fleet.filter((f) => f.kind === 'muni').map((f) => f.root), w.hand.group];
  const center = (o: Object3D, T: number) => {
    const p = o.position.clone();
    if (o === w.venator.group) p.copy(vFrame(T));
    return p;
  };
  for (let T = T0; T < T1; T += rng.range(0.02, 0.06)) {
    const fromRep = rng.chance(0.55);
    const a = fromRep ? rng.pick(rep) : rng.pick(sep);
    const b = fromRep ? rng.pick(sep) : rng.pick(rep);
    const pa = center(a, T).add(v3(rng.range(-600, 600), rng.range(-100, 250), rng.range(-1200, 1200)));
    const pb = center(b, T).add(v3(rng.range(-500, 500), rng.range(-200, 200), rng.range(-900, 900)));
    const dir = pb.clone().sub(pa);
    const dist = dir.length();
    const speed = 3200;
    w.fx.laser({ t0: T, from: pa, dir, speed, life: Math.min(dist / speed, 6), length: rng.range(120, 220), width: rng.range(9, 14), color: fromRep ? 'blue' : 'red' });
  }
  for (let T = T0; T < T1; T += rng.range(0.25, 0.6)) {
    const tgt = rng.chance(0.5) ? rng.pick(sep) : rng.pick(rep);
    const p = center(tgt, T).add(v3(rng.range(-500, 500), rng.range(-150, 150), rng.range(-1000, 1000)));
    w.fx.explosion(T, p, { size: rng.range(60, 140), pieces: 10, brickScale: 7, sparks: 10, smoke: 3, colors: ['lbg', 'dbg', 'white', 'tan'], seed: Math.floor(T * 100) });
  }
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
    battle(w, T, { swarms: false });
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

/** Long-take flight keys in the Venator frame (V-frame). */
const LT_ANAKIN: Key[] = [
  [2.6, 60, 1500, -3500],
  [3.6, 10, 1180, -2980],
  [4.4, -10, 780, -2250],
  [5.2, 0, 430, -1480],
  [6.1, 0, 205, -700],
  [7.2, 0, 150, 0],
  [8.3, 10, 150, 620],
  [9.2, 60, 142, 1050],
  [10.0, 220, 118, 1330],
  [10.7, 390, 60, 1520],
  [11.4, 520, -130, 1720],
  [12.3, 610, -470, 2020],
  [13.4, 660, -820, 2500],
  [14.6, 660, -1020, 3150],
  [16.5, 640, -1100, 4100],
];
const LT_OBI_OFFSET = v3(-26, 10, -34);

function ltPath(T: number, who: 'anakin' | 'obiwan') {
  return (tt: number) => {
    const t = tt - LONG_T0;
    const p = keyed(LT_ANAKIN, who === 'anakin' ? t : t - 0.22);
    if (who === 'obiwan') p.add(LT_OBI_OFFSET.clone().multiplyScalar(1 - 0.4 * smooth(9, 12, t)));
    return p.add(vFrame(tt));
  };
}

const longTake: Shot = {
  name: 'longtake',
  dur: 16,
  schedule(w, T0) {
    // flak and hits once the dive reveals the battle
    const rng = new Rng(31);
    for (let t = 10.5; t < 16; t += rng.range(0.15, 0.35)) {
      const st = flight(ltPath(T0 + t, 'anakin'), T0 + t);
      const p = local(st, rng.range(-260, 260), rng.range(-160, 120), rng.range(250, 900));
      w.fx.explosion(T0 + t, p, { size: rng.range(12, 28), pieces: 14, sparks: 16, smoke: 3, colors: ['dbg', 'lbg', 'black'], seed: Math.floor(t * 97) });
    }
  },
  pose(w, t, T) {
    battle(w, T);
    const a = flight(ltPath(T, 'anakin'), T, { bank: 1.3 });
    const o = flight(ltPath(T, 'obiwan'), T, { bank: 1.3 });
    const arrive = smooth(2.4, 3.2, t);
    if (arrive > 0) {
      fly(w, w.anakinShip, a, 0, 1);
      fly(w, w.obiwanShip, o, 0, 1);
      face(w.anakin, { mouth: 'smirk', brows: -0.3 }, t, 1);
      face(w.obiwan, { mouth: 'flat', brows: 0.3 }, t, 2);
    }
    const V = vFrame(T);
    // camera: hold C0 while tilting down from the stars, then chase the fighters over the hull
    const tilt = smoother(0.0, 4.2, t);
    const lookUp = C0_UP_TARGET.clone();
    const lookDown = v3(0, 80, -700).add(vFrame(LONG_T0 + 4.2));
    let pos = C0.clone();
    let target = lookUp.clone().lerp(lookDown, tilt);
    // follow phase
    const follow = smoother(4.0, 6.4, t);
    if (follow > 0) {
      const lag = flight(ltPath(T - 0.35, 'anakin'), T - 0.35);
      const behind = local({ pos: lag.pos, quat: basisQuat(lag.fwd, v3(0, 1, 0)) }, 12, 48, -150);
      pos = pos.lerp(behind, follow);
      const mid = a.pos.clone().lerp(o.pos, 0.4).add(a.fwd.clone().multiplyScalar(60));
      target = target.lerp(mid, follow);
    }
    // over the edge: swing wide to port so the dive reveals the battle below
    const dive = smoother(9.6, 12.5, t);
    if (dive > 0) {
      const d = local({ pos: a.pos, quat: basisQuat(a.fwd, v3(0, 1, 0)) }, 70, 55, -130);
      pos = pos.lerp(d, dive * 0.6);
      const look = a.pos.clone().add(a.fwd.clone().multiplyScalar(260)).add(v3(0, -120, 0));
      target = target.lerp(look, dive * 0.55);
    }
    pos.add(shake(t, follow * 1.2, 1.3, 3));
    w.aimShadow(follow > 0.5 ? a.pos : V.clone().add(v3(0, 150, -900)), follow > 0.5 ? 90 : 1800);
    return { pos, target, fov: lerp(34, 40, follow) - dive * 2, roll: -0.08 * dive, lens: { exposure: 1.0 } };
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

const track: Shot = {
  name: 'track',
  dur: 5,
  schedule(w, T0) {
    const victim = w.munis[0];
    const vpos = v3(3900, -1500, 7600);
    const rng = new Rng(5);
    const hits = [0.7, 1.3, 1.9, 2.4, 3.0, 3.4];
    hits.forEach((h, i) => {
      const p = vpos.clone().add(v3(rng.range(-250, 250), rng.range(-300, 350), rng.range(-700, 700)));
      w.fx.explosion(T0 + h, p, { size: 150 + i * 30, pieces: 26, brickScale: 7, sparks: 20, smoke: 5, colors: ['tan', 'darkTan', 'lbg', 'reddishBrown'], seed: 300 + i, flashes: 2 });
    });
    w.fx.explosion(T0 + 3.9, vpos.clone().add(v3(0, 50, 0)), { size: 520, pieces: 90, brickScale: 8, sparks: 60, smoke: 10, colors: ['tan', 'darkTan', 'lbg', 'reddishBrown', 'dbg'], seed: 399, flashes: 3 });
    void victim;
    for (let t = 0.2; t < 5; t += rng.range(0.18, 0.4)) {
      const st = flight(trackPath('anakin', T0), T0 + t);
      const p = local(st, rng.range(-200, 200), rng.range(-120, 140), rng.range(-60, 500));
      w.fx.explosion(T0 + t, p, { size: rng.range(10, 22), pieces: 10, sparks: 14, smoke: 2, colors: ['dbg', 'black', 'lbg'], seed: Math.floor(t * 131) });
    }
    for (let t = 0; t < 5; t += rng.range(0.05, 0.12)) {
      const st = flight(trackPath('anakin', T0), T0 + t);
      const from = local(st, rng.range(-900, 900), rng.range(-300, 300), rng.range(400, 1400));
      const dir = v3(rng.range(-1, 1), rng.range(-0.3, 0.3), rng.range(-1, 0.2));
      w.fx.laser({ t0: T0 + t, from, dir, speed: 1400, life: 1.2, length: 26, width: 1.8, color: rng.chance(0.5) ? 'red' : 'green' });
    }
  },
  pose(w, t, T) {
    battle(w, T);
    const T0 = T - t;
    const victim = w.munis[0];
    victim.group.visible = t < 4.05;
    victim.group.position.set(3900, -1500, 7600);
    victim.group.rotation.set(0.05, 2.6, 0.1);
    const a = flight(trackPath('anakin', T0), T, { bank: 1 });
    const o = flight(trackPath('obiwan', T0), T, { bank: 1 });
    const foils = smooth(0.2, 1.1, t);
    fly(w, w.anakinShip, a, foils);
    fly(w, w.obiwanShip, o, foils);
    face(w.anakin, { mouth: 'grit', brows: -0.7 }, t, 1);
    face(w.obiwan, { mouth: 'flat', brows: 0.5 }, t, 2);
    const mid = a.pos.clone().lerp(o.pos, 0.5);
    const pos = local({ pos: mid, quat: basisQuat(a.fwd, v3(0, 1, 0)) }, -58 + t * 3, 10, 18 - t * 4).add(shake(t, 1.2, 1.1, 9));
    w.aimShadow(mid, 60);
    return { pos, target: mid.clone().add(v3(0, -2, 6)), fov: 30, lens: { exposure: 1.05 } };
  },
};

/* --- cockpit close-ups */

function cockpitShot(o: {
  name: string;
  dur: number;
  who: 'anakin' | 'obiwan';
  lines?: Line[];
  faceAt: (t: number) => Partial<FaceState>;
  headAt?: (t: number) => { yaw: number; pitch: number };
  camLocal?: [number, number, number];
  schedule?: Shot['schedule'];
  fov?: number;
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
      const base = v3(o.who === 'anakin' ? 300 : 200, -1400, 9000 + T * 30);
      const path = (tt: number) => base.clone().add(v3(Math.sin(tt * 0.7) * 20, Math.sin(tt * 0.5) * 12, tt * 260));
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
      const head = anchorWorld(ship.cockpitAnchor).add(v3(0, 2.75, 0).applyQuaternion(st.quat));
      const cl = o.camLocal ?? [1.8, 3.4, 7.6];
      const cam = local(st, cl[0], cl[1], cl[2]);
      // live background: approaching fighters, laser fire
      w.aimShadow(head, 8);
      const dist = cam.distanceTo(head);
      return { pos: cam, target: head, fov: o.fov ?? 24, near: 0.05, lens: { focus: dist, aperture: 9, exposure: 1.0, bloom: 1.0 } };
    },
  };
}

function cockpitLasers(who: 'anakin' | 'obiwan', seedBase: number): Shot['schedule'] {
  return (w, T0) => {
    const rng = new Rng(seedBase);
    for (let t = 0; t < 5; t += rng.range(0.12, 0.3)) {
      const base = v3(who === 'anakin' ? 300 : 200, -1400, 9000 + (T0 + t) * 30);
      const p = base.add(v3(0, 0, (T0 + t) * 260));
      const from = p.clone().add(v3(rng.range(-300, 300), rng.range(-120, 160), rng.range(300, 900)));
      w.fx.laser({ t0: T0 + t, from, dir: v3(rng.range(-0.5, 0.5), rng.range(-0.2, 0.2), -1), speed: 900, life: 1.5, length: 22, width: 1.4, color: rng.chance(0.6) ? 'red' : 'green' });
      if (rng.chance(0.35)) w.fx.explosion(T0 + t, from.clone().add(v3(0, 0, 200)), { size: rng.range(18, 40), pieces: 8, sparks: 10, smoke: 2, seed: Math.floor(t * 71 + seedBase) });
    }
  };
}

const anakinCockpit = cockpitShot({
  name: 'anakin-cockpit',
  dur: 4,
  who: 'anakin',
  lines: [{ t0: 1.0, t1: 3.4, who: 'Anakin Skywalker', text: 'This is where the fun begins.' }],
  faceAt: (t) => ({ mouth: talk(t, 1.05, 2.9, t < 1 ? 'grit' : 'smirk'), brows: t < 1 ? -0.8 : -0.35, squint: t < 1 ? 0.25 : 0.1, lookX: t < 0.9 ? 0.02 : 0 }),
  headAt: (t) => ({ yaw: 0.25 - smooth(0.6, 1.3, t) * 0.35, pitch: -0.05 }),
  schedule: cockpitLasers('anakin', 41),
});

/* --- shot 5: the vulture droids swarm in; Anakin opens fire */

const vultures: Shot = {
  name: 'vultures',
  dur: 5,
  schedule(w, T0) {
    const pathA = vPath(T0);
    const rng = new Rng(55);
    // Anakin's cannons
    for (let t = 0.9; t < 2.6; t += 0.11) {
      const st = flight(pathA, T0 + t);
      for (const side of [1, -1]) {
        const from = local(st, side * 3.2, -0.2, 13);
        w.fx.laser({ t0: T0 + t + (side > 0 ? 0 : 0.05), from, dir: st.fwd.clone().add(v3(rng.range(-0.02, 0.02), rng.range(-0.02, 0.02), 0)), speed: 1500, life: 0.9, length: 9, width: 0.8, color: 'red' });
      }
    }
    // two kills
    for (const [k, tk] of [[0, 1.55], [2, 2.35]] as const) {
      const p = vulturePos(k, T0 + tk, T0);
      w.fx.explosion(T0 + tk, p, { size: 16, pieces: 45, sparks: 40, smoke: 5, colors: ['tan', 'darkTan', 'reddishBrown', 'dbg', 'black'], seed: 500 + k, inherit: v3(0, 0, -120) });
    }
    // droid return fire
    for (let t = 0.3; t < 3.5; t += rng.range(0.08, 0.16)) {
      const k = rng.int(0, 5);
      if ((k === 0 && t > 1.55) || (k === 2 && t > 2.35)) continue;
      const p = vulturePos(k, T0 + t, T0);
      const target = flight(pathA, T0 + t).pos.clone().add(v3(rng.range(-30, 30), rng.range(-20, 20), rng.range(-40, 40)));
      w.fx.laser({ t0: T0 + t, from: p, dir: target.sub(p), speed: 1300, life: 1.2, length: 9, width: 0.9, color: 'red' });
    }
  },
  pose(w, t, T) {
    battle(w, T);
    const T0 = T - t;
    const pathA = vPath(T0);
    const roll = smooth(2.8, 3.4, t) * (1 - smooth(3.6, 4.4, t)) * Math.PI * 2 * 0 + (t > 2.8 && t < 4.2 ? smoother(2.8, 4.2, t) * Math.PI * 2 : 0);
    const a = flight(pathA, T, { bank: 1.2, extraRoll: roll });
    fly(w, w.anakinShip, a, 1);
    const o = flight((tt) => pathA(tt).add(v3(-38, 14, -60)), T, { bank: 1.2 });
    fly(w, w.obiwanShip, o, 1);
    face(w.anakin, { mouth: 'grit', brows: -1 }, t, 1);
    for (let k = 0; k < 6; k++) {
      const v = w.vultures[k];
      const dead = (k === 0 && t > 1.55) || (k === 2 && t > 2.35);
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
    const cam = local({ pos: a.pos, quat: basisQuat(a.fwd, v3(0, 1, 0)) }, -9, 6.5, -36).add(shake(t, 0.8, 1.6, 12));
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

function vulturePos(k: number, T: number, T0: number): Vector3 {
  const t = T - T0;
  const a = vPath(T0)(T);
  const rng = new Rng(900 + k);
  const spreadX = rng.range(-140, 140), spreadY = rng.range(-70, 90);
  const z = 1500 - t * 520 + k * 60;
  return a.clone().add(v3(spreadX * (0.4 + t * 0.25) + Math.sin(t * 2 + k) * 20, spreadY * (0.4 + t * 0.2) + Math.cos(t * 1.7 + k) * 14, z));
}

/* --- shot 6: the Invisible Hand, crawling with vulture droids */

const HAND_POS = v3(-900, -1700, 27500);
function poseHand(w: World): void {
  const h = w.hand.group;
  h.visible = true;
  h.position.copy(HAND_POS);
  h.rotation.set(0, Math.PI / 2, 0);
}

function crawlerPoses(w: World, T: number): void {
  const h = w.hand.group;
  h.updateMatrixWorld(true);
  const box = new Box3().setFromObject(h);
  const size = box.getSize(v3(0, 0, 0));
  const anchors = Object.entries(w.hand.anchors).filter(([k]) => k.startsWith('crawl')).map(([, a]) => a);
  w.crawlers.forEach((c, i) => {
    c.group.visible = true;
    let p: Vector3;
    if (anchors[i]) p = anchorWorld(anchors[i]);
    else p = v3(box.min.x + size.x * (0.2 + 0.07 * i), box.max.y - 2, HAND_POS.z + size.z * 0.5 * (i % 2 ? 1 : 0.9));
    c.group.position.copy(p);
    c.group.quaternion.copy(h.quaternion);
    c.group.rotateY(i * 0.7);
    c.group.scale.setScalar(1);
    c.setMode(1);
    c.setGait(T * 5 + i);
  });
}

const handReveal: Shot = {
  name: 'hand-reveal',
  dur: 4.5,
  lines: [{ t0: 0.4, t1: 4.3, who: 'Anakin Skywalker', text: "The General's command ship is dead ahead — the one crawling with vulture droids." }],
  pose(w, t, T) {
    battle(w, T);
    poseHand(w);
    crawlerPoses(w, T);
    const T0 = T - t;
    const start = HAND_POS.clone().add(v3(700, 300, -4200));
    const path = (tt: number) => start.clone().add(v3(-(tt - T0) * 40, -(tt - T0) * 20, (tt - T0) * 380));
    const a = flight(path, T, { bank: 1 });
    const o = flight((tt) => path(tt).add(v3(-36, 10, -48)), T, { bank: 1 });
    fly(w, w.anakinShip, a, 1);
    fly(w, w.obiwanShip, o, 1);
    const cam = local({ pos: a.pos, quat: basisQuat(a.fwd, v3(0, 1, 0)) }, 18, 22, -90).add(shake(t, 0.6, 1, 14));
    w.aimShadow(a.pos, 60);
    return { pos: cam, target: HAND_POS.clone().add(v3(300, 250, -300)).lerp(a.pos, 0.35), fov: 30, lens: { exposure: 1.05 } };
  },
};

const obiCockpit = cockpitShot({
  name: 'obiwan-cockpit',
  dur: 3.5,
  who: 'obiwan',
  lines: [{ t0: 0.5, t1: 3.2, who: 'Obi-Wan Kenobi', text: 'Oh, I have a bad feeling about this.' }],
  faceAt: (t) => ({ mouth: talk(t, 0.55, 2.7, 'frown'), brows: 0.85, lookX: t < 1.8 ? -0.015 : 0.02, lookY: 0.005 }),
  headAt: (t) => ({ yaw: -0.2 + smooth(1.6, 2.4, t) * 0.35, pitch: 0.04 }),
  camLocal: [-1.9, 3.3, 7.4],
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
const PERCH: [number, number, number][] = [
  [5.5, 1.2, 2],
  [8, 0.9, -3],
  [-6, 1.1, 1],
  [-8.5, 0.8, -4],
  [2.6, 1.8, 6.5],
  [4.8, 1.6, -7],
];

const missiles: Shot = {
  name: 'missiles',
  dur: 4,
  lines: [{ t0: 2.3, t1: 3.9, who: 'Obi-Wan Kenobi', text: 'Buzz droids!' }],
  schedule(w, T0) {
    for (let k = 0; k < 2; k++) {
      const p = missilePath(k, T0)(T0 + 1.9);
      w.fx.explosion(T0 + 1.9, p, { size: 5, pieces: 6, sparks: 30, smoke: 2, colors: ['gunmetal', 'dbg'], seed: 800 + k });
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
      m.group.visible = t < 2.05;
      const st = flight(missilePath(k, T0), T);
      place(m.group, st);
      m.setOpen(smooth(1.55, 1.95, t));
    }
    // buzz droids fly from the missiles to their perches
    w.buzz.forEach((b, i) => {
      const k = i % 2;
      const tr = 1.9 + i * 0.07;
      b.group.visible = t > tr;
      if (t <= tr) return;
      const from = missilePath(k, T0)(T0 + tr);
      const perch = local(o, ...PERCH[i]);
      const f = smoother(tr, tr + 0.7, t);
      b.group.position.copy(from.lerp(perch, f));
      b.group.quaternion.copy(o.quat);
      b.group.scale.setScalar(1);
      b.setDeploy(smooth(tr + 0.4, tr + 0.9, t));
      b.animate(T + i);
    });
    const cam = local({ pos: o.pos, quat: basisQuat(o.fwd, v3(0, 1, 0)) }, -16, 6, -30).add(shake(t, 0.5, 1.4, 17));
    w.aimShadow(o.pos, 30);
    return { pos: cam, target: o.pos.clone().add(o.fwd.clone().multiplyScalar(25)), fov: 30, lens: { exposure: 1.05 } };
  },
};

/* --- shot 9: buzz droids at work; R4 loses her head */

const R4_POP = 2.55;
const buzzClose: Shot = {
  name: 'buzz-close',
  dur: 4.5,
  schedule(w, T0) {
    // cutting sparks from each droid's saw
    for (let i = 0; i < 4; i++) {
      w.fx.sparkStream(T0 + 0.1, T0 + 4.4, (T) => buzzWorld(w, i, T, T0), () => v3(0, 1, 0), 60, 70 + i, 6);
    }
    w.fx.explosion(T0 + R4_POP, r4World(T0 + R4_POP, T0), { size: 1.6, pieces: 6, sparks: 50, smoke: 2, colors: ['red', 'flatSilver', 'white'], seed: 901 });
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
      b.group.visible = i < 5;
      b.group.position.copy(local(o, ...PERCH[i]).add(v3(0, 0, 0)));
      b.group.quaternion.copy(o.quat);
      b.setDeploy(1);
      b.animate(T * 1.3 + i);
    });
    // droid 0 walks to the socket and slices R4's dome
    const r4 = w.r4;
    const sock = anchorWorld(w.obiwanShip.astromechAnchor);
    const b0 = w.buzz[0];
    const walk = smoother(0.2, 1.8, t);
    b0.group.position.copy(local(o, ...PERCH[0]).lerp(sock.clone().add(v3(1.6, 0.6, 0.4).applyQuaternion(o.quat)), walk));
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
function r4World(T: number, T0: number): Vector3 {
  const st = flight(obiPath9(T0), T);
  return local(st, 3.2, 2.2, 3.5);
}
function buzzWorld(w: World, i: number, T: number, T0: number): Vector3 {
  const st = flight(obiPath9(T0), T);
  return local(st, PERCH[i][0], PERCH[i][1] + 0.3, PERCH[i][2] + 0.8);
}

const obiCockpit2 = cockpitShot({
  name: 'obiwan-cockpit-2',
  dur: 2.6,
  who: 'obiwan',
  lines: [{ t0: 0.15, t1: 2.5, who: 'Obi-Wan Kenobi', text: "Get out of here, Anakin! There's nothing more you can do." }],
  faceAt: (t) => ({ mouth: talk(t, 0.2, 2.3, 'frown', ['shout', 'open', 'talk']), brows: -0.2, lookX: -0.03 }),
  headAt: () => ({ yaw: -0.5, pitch: 0.02 }),
  camLocal: [-2.2, 3.1, 7.2],
});

const anakinCockpit2 = cockpitShot({
  name: 'anakin-cockpit-2',
  dur: 2.6,
  who: 'anakin',
  lines: [{ t0: 0.2, t1: 2.5, who: 'Anakin Skywalker', text: "I'm not leaving without you, Master." }],
  faceAt: (t) => ({ mouth: talk(t, 0.25, 2.2, 'grit'), brows: -0.9, squint: 0.2, lookX: 0.03 }),
  headAt: () => ({ yaw: 0.45, pitch: 0 }),
  camLocal: [2.4, 3.2, 7.0],
});

/* --- shot 11: Anakin blasts one droid off; R2 zaps another */

function pair11(T0: number) {
  const base = v3(1500, -1100, 24500);
  return (tt: number) => base.clone().add(v3(Math.sin((tt - T0) * 0.7) * 5, 0, (tt - T0) * 210));
}
const rescue: Shot = {
  name: 'rescue',
  dur: 4,
  schedule(w, T0) {
    const pa = (tt: number) => pair11(T0)(tt).add(v3(-30, 6, -26));
    for (let t = 0.45; t < 0.8; t += 0.1) {
      const st = flight(pa, T0 + t);
      const target = local(flight(pair11(T0), T0 + 0.85), ...PERCH[3]);
      for (const side of [1, -1]) {
        const from = local(st, side * 3.2, -0.2, 13);
        w.fx.laser({ t0: T0 + t, from, dir: target.clone().sub(from), speed: 900, life: target.distanceTo(from) / 900, length: 5, width: 0.6, color: 'red' });
      }
    }
    const pk = local(flight(pair11(T0), T0 + 0.85), ...PERCH[3]);
    w.fx.explosion(T0 + 0.85, pk, { size: 5, pieces: 26, sparks: 40, smoke: 3, colors: ['flatSilver', 'dbg', 'lbg'], seed: 1101, inherit: v3(0, 0, 150) });
    // R2's zap: a crackling stream of blue sparks
    const r2At = (T: number) => local(flight((tt) => pair11(T0)(tt).add(v3(-30, 6, -26)), T), 3.2, 2.4, 4.2);
    w.fx.sparkStream(T0 + 2.0, T0 + 2.7, r2At, () => v3(0.4, 0.6, 0.2), 140, 1102, 4);
    w.fx.explosion(T0 + 2.65, r2At(T0 + 2.65).add(v3(1, 1, 0)), { size: 1.4, pieces: 5, sparks: 30, smoke: 1, colors: ['flatSilver', 'dbg'], seed: 1103 });
  },
  pose(w, t, T) {
    battle(w, T);
    const T0 = T - t;
    const o = flight(pair11(T0), T, { bank: 0.6 });
    const pa = (tt: number) => pair11(T0)(tt).add(v3(-30 + smooth(1.2, 2.0, tt - T0) * 12, 6 - smooth(1.2, 2.0, tt - T0) * 3, -26 + smooth(1.2, 2.0, tt - T0) * 16));
    const a = flight(pa, T, { bank: 0.6 });
    fly(w, w.obiwanShip, o, 1);
    fly(w, w.anakinShip, a, 1);
    w.r4.head.visible = false;
    face(w.anakin, { mouth: t < 2 ? 'grit' : 'smirk', brows: -0.7 }, t, 1);
    face(w.obiwan, { mouth: 'frown', brows: 0.6 }, t, 2);
    // remaining droids on Obi-Wan's wings; #3 is blasted, #4 hopped to Anakin's ship
    [1, 2, 3, 5].forEach((i, n) => {
      const b = w.buzz[i];
      const gone = i === 3 && t > 0.85;
      b.group.visible = !gone;
      b.group.position.copy(local(o, ...PERCH[i]));
      b.group.quaternion.copy(o.quat);
      b.setDeploy(1);
      b.animate(T + n);
    });
    const b4 = w.buzz[4];
    b4.group.visible = true;
    b4.group.position.copy(local(a, 4.6, 1.5, 4.5));
    b4.group.quaternion.copy(a.quat);
    b4.setDeploy(1);
    b4.animate(T);
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
    const cam = local({ pos: mid, quat: basisQuat(o.fwd, v3(0, 1, 0)) }, -40, 16, 44).add(shake(t, 0.5, 1.2, 19));
    w.aimShadow(mid, 40);
    return { pos: cam, target: mid, fov: 30 - smooth(1.6, 2.4, t) * 8, lens: { exposure: 1.05 } };
  },
};

/* --- shot 12: into the hangar */

const hangarApproach: Shot = {
  name: 'hangar-approach',
  dur: 4,
  pose(w, t, T) {
    battle(w, T, { swarms: true });
    poseHand(w);
    crawlerPoses(w, T);
    const mouthA = w.hand.anchors['hangar'];
    const mouth = mouthA ? anchorWorld(mouthA) : HAND_POS.clone().add(v3(0, 0, -300));
    const out = mouthA ? v3(0, 0, 1).applyQuaternion(mouthA.getWorldQuaternion(new Quaternion())) : v3(0, 0, -1);
    const shield = t < 1.9 ? 1 : t < 2.3 ? (Math.sin(t * 90) > 0 ? 0.7 : 0.15) : 0;
    w.hand.setShield(shield);
    const T0 = T - t;
    const path = (tt: number) => {
      const u = (tt - T0) / 4;
      return mouth.clone().add(out.clone().multiplyScalar(lerp(1500, -60, smoother(0, 1, u)))).add(v3(0, lerp(120, 0, smoother(0, 0.8, u)), 0));
    };
    const a = flight(path, T, { bank: 0.8 });
    const o = flight((tt) => path(tt - 0.35).add(v3(0, 6, 0)), T, { bank: 0.8 });
    fly(w, w.anakinShip, a, 0.3);
    fly(w, w.obiwanShip, o, 0.3);
    w.r4.head.visible = false;
    const camPos = path(T - 0.9).add(v3(18, 26, 0)).add(shake(t, 0.4, 1.2, 23));
    w.aimShadow(a.pos, 60);
    return { pos: camPos, target: mouth.clone().lerp(a.pos, 0.5), fov: 32, lens: { exposure: 1.05 } };
  },
};

/* --- hangar interior: crash landing, then the droids */

function hangarSpots(w: World) {
  const g = w.hangar.group;
  g.visible = true;
  g.position.set(0, 0, 0);
  g.rotation.set(0, 0, 0);
  const A = w.hangar.anchors['landingA'] ? anchorWorld(w.hangar.anchors['landingA']) : v3(-30, 0, 0);
  const B = w.hangar.anchors['landingB'] ? anchorWorld(w.hangar.anchors['landingB']) : v3(30, 0, 0);
  const M = w.hangar.anchors['mouth'] ? anchorWorld(w.hangar.anchors['mouth']) : v3(0, 18, 70);
  const D = w.hangar.anchors['droidLine'] ? anchorWorld(w.hangar.anchors['droidLine']) : v3(0, 0, -40);
  const Dq = w.hangar.anchors['droidLine'] ? w.hangar.anchors['droidLine'].getWorldQuaternion(new Quaternion()) : new Quaternion().setFromAxisAngle(v3(0, 1, 0), 0);
  return { A, B, M, D, Dq };
}

const landing: Shot = {
  name: 'landing',
  dur: 5,
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
    // Obi-Wan: comes in fast, slams down, skids, sheds wings
    const op = obiSlide(s, t);
    const odir = s.A.clone().sub(s.M).setY(0).normalize();
    const yawO = Math.atan2(odir.x, odir.z);
    const bump = t > 1.0 ? Math.max(0, Math.sin((t - 1.0) * 9) * Math.exp(-(t - 1.0) * 3)) * 0.8 : 0;
    const oq = new Quaternion().setFromEuler(new Euler(0.05 - bump * 0.2, yawO + smooth(1.0, 2.6, t) * 0.5, smooth(1.0, 1.6, t) * 0.12 - bump * 0.1));
    fly(w, w.obiwanShip, { pos: op, quat: oq } as FlightState, t < 1 ? 0.2 : 0, t < 2.6 ? 1 - smooth(1.8, 2.6, t) : 0);
    w.r4.head.visible = false;
    // breakables tumble away after impact
    w.obiwanShip.breakables.forEach((p, i) => {
      p.userData.home ??= { pos: p.position.clone(), quat: p.quaternion.clone() };
      const hm = p.userData.home as { pos: Vector3; quat: Quaternion };
      const tb = 1.05 + i * 0.18;
      if (t > tb && i < 3) {
        const dt = t - tb;
        const rng = new Rng(1400 + i);
        const dx = rng.range(-1, 1), dz = rng.range(0.2, 1);
        p.position.set(hm.pos.x + dx * dt * 14, hm.pos.y + Math.max(-hm.pos.y - 0.5, dt * 6 - dt * dt * 9), hm.pos.z + dz * dt * 10);
        p.quaternion.copy(hm.quat).multiply(new Quaternion().setFromAxisAngle(v3(rng.range(-1, 1), 1, rng.range(-1, 1)).normalize(), dt * rng.range(5, 9) * Math.exp(-dt * 0.8)));
      } else {
        p.position.copy(hm.pos);
        p.quaternion.copy(hm.quat);
      }
    });
    face(w.obiwan, { mouth: t < 1.0 ? 'shout' : 'o', brows: 0.9 }, t, 2);
    // Anakin: glides in, flares, sets down
    const bdir = s.B.clone().sub(s.M).setY(0).normalize();
    const u = smoother(2.2, 4.4, t);
    const ap = s.M.clone().lerp(s.B.clone().add(v3(0, 1.8, 0)), u).add(v3(0, Math.sin(u * Math.PI) * 6, 0));
    const aq = basisQuat(bdir.clone().add(v3(0, -0.15 * (1 - u), 0)).normalize(), v3(0, 1, 0));
    w.anakinShip.group.visible = t > 2.1;
    if (t > 2.1) fly(w, w.anakinShip, { pos: ap, quat: aq } as FlightState, 1 - u, 1 - u * 0.8);
    face(w.anakin, { mouth: 'smirk', brows: -0.2 }, t, 1);
    // camera: floor level, watching the skid come toward us
    const camPos = s.A.clone().add(v3(-26, 3.2, -30));
    const look = op.clone().lerp(s.A, 0.3).add(v3(0, 2, 0));
    w.aimShadow(s.A, 70, v3(0.2, 1, 0.3).normalize());
    return { pos: camPos.add(shake(t, t > 1 && t < 2 ? 0.35 : 0.06, 3, 41)), target: look, fov: 34, near: 0.1, lens: { exposure: 1.1, bloom: 1.1 } };
  },
};

function obiSlide(s: ReturnType<typeof hangarSpots>, t: number): Vector3 {
  const u = smoother(0, 1, t / 1.0);
  const air = s.M.clone().lerp(s.A.clone().add(s.A.clone().sub(s.M).setY(0).normalize().multiplyScalar(-34)), u);
  if (t < 1.0) return air.add(v3(0, 3 * (1 - u), 0));
  const skid = smoother(0, 1, (t - 1.0) / 1.6);
  const p0 = s.A.clone().add(s.A.clone().sub(s.M).setY(0).normalize().multiplyScalar(-34));
  return p0.lerp(s.A, skid).setY(s.A.y + 1.5);
}

const droids: Shot = {
  name: 'droids',
  dur: 5.2,
  lines: [
    { t0: 0.3, t1: 2.2, who: 'Obi-Wan Kenobi', text: 'Flying is for droids.' },
    { t0: 3.7, t1: 5.0, who: 'Battle Droid', text: 'Uh oh.' },
  ],
  pose(w, t, T) {
    w.interior();
    const s = hangarSpots(w);
    w.hangar.setShield(0);
    // parked fighters (Obi-Wan's is wrecked)
    fly(w, w.obiwanShip, { pos: s.A.clone().setY(s.A.y + 1.5), quat: basisQuat(s.A.clone().sub(s.M).setY(0).normalize(), v3(0, 1, 0)).multiply(new Quaternion().setFromEuler(new Euler(0.05, 0.5, 0.12))) } as FlightState, 0, 0);
    w.obiwanShip.breakables.forEach((p, i) => {
      const hm = p.userData.home as { pos: Vector3; quat: Quaternion } | undefined;
      if (!hm) return;
      if (i < 3) {
        const rng = new Rng(1400 + i);
        p.position.set(hm.pos.x + rng.range(-1, 1) * 14, -hm.pos.y * 0 - 1.2, hm.pos.z + rng.range(0.2, 1) * 12);
      }
    });
    w.r4.head.visible = false;
    fly(w, w.anakinShip, { pos: s.B.clone().setY(s.B.y + 1.8), quat: basisQuat(s.B.clone().sub(s.M).setY(0).normalize(), v3(0, 1, 0)) } as FlightState, 0, 0);
    // the Jedi stand between the fighters and the droids
    const mid = s.A.clone().lerp(s.B, 0.5);
    const toDroids = s.D.clone().sub(mid).setY(0).normalize();
    const yaw = Math.atan2(toDroids.x, toDroids.z);
    const side = v3(toDroids.z, 0, -toDroids.x);
    const obiPos = mid.clone().add(side.clone().multiplyScalar(3.5)).add(toDroids.clone().multiplyScalar(4));
    const anaPos = mid.clone().add(side.clone().multiplyScalar(-3.5)).add(toDroids.clone().multiplyScalar(4));
    w.stand(w.obiwan, obiPos, yaw + (t < 2.4 ? -0.9 : 0));
    w.stand(w.anakin, anaPos, yaw + (t < 2.4 ? 0.6 : 0));
    const ign = smooth(2.9, 3.25, t);
    const raise = smooth(2.5, 3.0, t);
    w.obiwan.pose({ armR: 0.2 + raise * 1.0, armL: 0.1 + raise * 0.3, splayL: 0.1, wristR: raise * Math.PI / 2, headYaw: t < 2.4 ? 0.3 : 0, headPitch: 0 });
    w.anakin.pose({ armR: 0.25 + raise * 1.15, armL: 0.15, splayL: 0.1, wristR: raise * Math.PI / 2, headYaw: t < 2.4 ? -0.5 : 0 });
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
    w.droids.forEach((d, i) => {
      d.group.visible = true;
      const n = w.droids.length;
      const off = (i - (n - 1) / 2) * 3.2;
      const dside = v3(1, 0, 0).applyQuaternion(s.Dq);
      d.group.position.copy(s.D).add(dside.multiplyScalar(off)).add(v3(0, 0, 0));
      d.group.quaternion.copy(s.Dq);
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
    camPos = mid.clone().sub(toDroids.clone().multiplyScalar(9)).add(v3(0, 5.5, 0)).add(side.clone().multiplyScalar(1.5));
    look = s.D.clone().lerp(mid, 0.55).add(v3(0, 2.4, 0));
    fov = 38;
    w.aimShadow(mid, 40, v3(0.2, 1, 0.3).normalize());
    return { pos: camPos.add(shake(t, 0.05, 1, 43)), target: look, fov, near: 0.05, lens: { focus: camPos.distanceTo(s.D), aperture: 3, exposure: 1.12 } };
  },
};

const endCard: Shot = { name: 'endcard', dur: 4.5, card: true, pose: () => ({ pos: v3(0, 0, 0), target: v3(0, 0, 1), fov: 30 }) };

export const SHOTS: Shot[] = [farfar, crawl, longTake, track, anakinCockpit, vultures, handReveal, obiCockpit, missiles, buzzClose, obiCockpit2, anakinCockpit2, rescue, hangarApproach, landing, droids, endCard];

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
