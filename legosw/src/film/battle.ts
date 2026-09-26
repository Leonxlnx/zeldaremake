import { Matrix4, Quaternion, Vector3 } from 'three';
import { Rng } from '../core/rng';
import type { ColorKey } from '../core/palette';
import type { CapitalShip } from '../assets/types';
import { makeDeepBattle } from '../world/deep-battle';
import { World, VENATOR_SPEED, VICTIM_POSE } from './world';
import { flight, lerp, local, smooth, v3 } from './motion';

/**
 * The battle around the heroes, as pure functions of time. Fighter duels: an ARC-170 runs down a
 * vulture or tri-fighter around a furball (with a droid on its own tail), walks its bursts onto the
 * target and blows it apart on the frame the last bolt lands; a new prey joins across the furball a
 * moment later. Capital ships fire from their real turret muzzles onto real hull points, where every
 * strike flashes. Bolts either hit something or are near misses at a real target.
 */

export const LONG_T0 = 19.5;
/** The hero Venator advances along +Z from the origin at the long take's start. */
export const vFrame = (T: number) => v3(0, 0, VENATOR_SPEED * (T - LONG_T0));
export const HAND_POS = v3(-900, -1700, 27500);
export const HAND_YAW = Math.PI / 2 + 0.45;

/* ------------------------------------------------------------------ fighter duels */

const FURBALLS = [
  v3(-1000, 700, 1500),
  v3(-2800, 400, 4000),
  v3(3200, 200, 6000),
  v3(900, -700, 9000),
  v3(-1800, -300, 13000),
  v3(2400, -1200, 17000),
  v3(-600, -1500, 21000),
  v3(2200, -500, 24000),
  v3(-2400, -900, 26000),
  v3(1400, 300, 28500),
];

interface Duel {
  id: number;
  c: Vector3;
  R: number;
  w0: number;
  ph: number;
  tilt: number;
  wob: number;
  period: number;
  t0: number;
  gap: number;
  prey: 'vulture' | 'tri';
}

/** ARC hunters are arcSwarm[0..23]; prey are vultureSwarm[0..15] and triSwarm[0..7]; the droids on the
 *  hunters' tails are vultureSwarm[16..39]; the rest of both swarms fly free. */
const N_DUELS = 24;
const DUELS: Duel[] = [];
{
  const r = new Rng(4040);
  for (let id = 0; id < N_DUELS; id++) {
    const R = r.range(150, 380);
    const speed = r.range(170, 250);
    DUELS.push({
      id,
      c: FURBALLS[id % FURBALLS.length].clone().add(v3(r.range(-500, 500), r.range(-250, 250), r.range(-600, 600))),
      R,
      w0: (speed / R) * (r.chance(0.5) ? 1 : -1),
      ph: r.range(0, Math.PI * 2),
      tilt: r.range(-0.5, 0.5),
      wob: r.range(0.1, 0.25),
      period: r.range(6.5, 9.5),
      t0: r.range(0, 9),
      gap: r.range(0.9, 1.5),
      prey: id < 16 ? 'vulture' : 'tri',
    });
  }
}

function orbit(d: Duel, a: number, T: number, dr: number, dy: number): Vector3 {
  const R = d.R + dr;
  return v3(
    d.c.x + Math.cos(a) * R,
    d.c.y + Math.sin(a) * R * d.tilt + Math.sin(a * 2 + d.ph) * R * d.wob + dy,
    d.c.z + Math.sin(a) * R + VENATOR_SPEED * 0.5 * T,
  );
}
const hunterAngle = (d: Duel, T: number) => d.ph + d.w0 * T;

function hunterPos(d: Duel, T: number): Vector3 {
  return orbit(d, hunterAngle(d, T), T, Math.sin(T * 1.3 + d.ph) * 8, Math.sin(T * 1.9 + d.id) * 5);
}
function chaserPos(d: Duel, T: number): Vector3 {
  return orbit(d, hunterAngle(d, T) - Math.sign(d.w0) * (0.32 + 0.06 * Math.sin(T * 0.9 + d.id)), T, Math.sin(T * 1.1 + 2) * 10, Math.sin(T * 1.6) * 6 + 4);
}
function lifeOf(d: Duel, T: number): number {
  return Math.floor((T - d.t0) / d.period);
}
const killTime = (d: Duel, j: number) => d.t0 + (j + 1) * d.period - d.gap;
/** prey of life j: starts across the furball, the hunter closes to a short range by the kill */
function preyPos(d: Duel, j: number, T: number): Vector3 {
  const tl = T - (d.t0 + j * d.period);
  const lead = lerp(Math.PI * 0.9, 0.2, Math.pow(smooth(0, d.period - d.gap, tl), 0.8));
  return orbit(d, hunterAngle(d, T) + Math.sign(d.w0) * lead, T, Math.sin(T * 2.6 + j * 1.7) * 16, Math.cos(T * 2.1 + j) * 10);
}

/** Free flyers (not in a duel) keep the old furball orbits. */
function freePath(i: number, seed: number, speed: number) {
  const r = new Rng(seed * 1000 + i);
  const c = FURBALLS[i % FURBALLS.length];
  const R = r.range(120, 520);
  const w0 = r.range(0.25, 0.6) * (r.chance(0.5) ? 1 : -1) * speed;
  const ph = r.range(0, Math.PI * 2);
  const tilt = r.range(-0.7, 0.7);
  return (t: number) => {
    const a = ph + w0 * t;
    return v3(c.x + Math.cos(a) * R, c.y + Math.sin(a * 1.3) * R * 0.35 + Math.sin(a) * R * tilt, c.z + Math.sin(a) * R + VENATOR_SPEED * 0.5 * t);
  };
}

const ONE = v3(1, 1, 1);
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

export function poseSwarms(w: World): (T: number) => void {
  // the battle beyond the fleet, 30-60 km out; an actor, so every frame that does not pose it has it hidden
  const deep = makeDeepBattle({ t0: 18, t1: 82 });
  w.scene.add(deep.group);
  w.actors.push(deep.group);
  return (T: number) => {
    deep.pose(T);
    const m = new Matrix4();
    const sc = new Vector3();
    for (const d of DUELS) {
      const h = flight((tt) => hunterPos(d, tt), T, { bank: 1.3 });
      w.arcSwarm.set(d.id, m.compose(h.pos, h.quat, ONE));
      const c = flight((tt) => chaserPos(d, tt), T, { bank: 1.3 });
      w.vultureSwarm.set(16 + d.id, m.compose(c.pos, c.quat, ONE));
      const j = lifeOf(d, T);
      const tl = T - (d.t0 + j * d.period);
      const sw = d.prey === 'vulture' ? w.vultureSwarm : w.triSwarm;
      const idx = d.prey === 'vulture' ? d.id : d.id - 16;
      if (T > killTime(d, j)) {
        sw.set(idx, HIDDEN);
      } else {
        const p = flight((tt) => preyPos(d, j, tt), T, { bank: 1.5 });
        const s = smooth(0, 0.35, tl);
        sw.set(idx, m.compose(p.pos, p.quat, sc.set(s, s, s)));
      }
    }
    for (let i = 40; i < 60; i++) {
      const st = flight(freePath(i, 11, 1), T, { bank: 1.4 });
      w.vultureSwarm.set(i, m.compose(st.pos, st.quat, ONE));
    }
    for (let i = 8; i < 16; i++) {
      const st = flight(freePath(i, 13, 1.2), T, { bank: 1.4 });
      w.triSwarm.set(i, m.compose(st.pos, st.quat, ONE));
    }
    w.vultureSwarm.commit(60);
    w.arcSwarm.commit(24);
    w.triSwarm.commit(16);
  };
}

/** time of arrival of a bolt fired at `tf` from `from` at a moving target */
function intercept(target: (T: number) => Vector3, from: Vector3, tf: number, speed: number): number {
  let ta = tf + target(tf).distanceTo(from) / speed;
  for (let k = 0; k < 3; k++) ta = tf + target(ta).distanceTo(from) / speed;
  return ta;
}

const PREY_COLORS: Record<Duel['prey'], ColorKey[]> = {
  vulture: ['tan', 'darkTan', 'reddishBrown', 'dbg'],
  tri: ['reddishBrown', 'lbg', 'dbg', 'black'],
};

export function scheduleDogfights(w: World, T0: number, T1: number): void {
  const SPEED = 1050;
  for (const d of DUELS) {
    const r = new Rng(7000 + d.id);
    const hunter = (T: number) => flight((tt) => hunterPos(d, tt), T);
    const muzzle = (T: number, k: number) => local(hunter(T), k % 2 ? 3.2 : -3.2, 0, 6);
    for (let j = lifeOf(d, T0) - 1; d.t0 + j * d.period < T1; j++) {
      const kill = killTime(d, j);
      if (kill < T0 - 1) continue;
      const prey = (T: number) => preyPos(d, j, T);
      // the last pair of bolts lands exactly on the kill frame; earlier bursts walk onto the target
      let tfLast = kill - 0.25;
      for (let k = 0; k < 3; k++) tfLast = kill - prey(kill).distanceTo(muzzle(tfLast, 0)) / SPEED;
      for (let k = 0; k < 10; k++) {
        const tf = tfLast - (9 - k) * 0.16 + (k % 2) * 0.03;
        const from = muzzle(tf, k);
        const ta = intercept(prey, from, tf, SPEED);
        const miss = Math.max(0, 1 - k / 7.5);
        const aim = prey(ta).add(v3(r.gauss(), r.gauss(), r.gauss()).multiplyScalar(22 * miss));
        const dist = aim.distanceTo(from);
        w.fx.laser({ t0: tf, from, dir: aim.clone().sub(from), speed: SPEED, life: miss > 0 ? (dist + 220) / SPEED : dist / SPEED, length: 11, width: 1.1, color: 'red' });
      }
      const st = flight(prey, kill);
      w.fx.explosion(kill, st.pos, {
        size: d.prey === 'vulture' ? 9 : 8,
        pieces: 22,
        sparks: 30,
        smoke: 3,
        colors: PREY_COLORS[d.prey],
        inherit: st.vel.clone().multiplyScalar(0.8),
        seed: 7100 + d.id * 97 + j,
      });
    }
    // the droid on the hunter's tail: bursts that rake past it, now and then a spark on its hull
    const chaser = (T: number) => flight((tt) => chaserPos(d, tt), T);
    const hunterAt = (T: number) => hunterPos(d, T);
    for (let T = T0 + r.range(0, 1.5); T < T1; T += r.range(1.1, 2.2)) {
      const hits = r.chance(0.3);
      for (let k = 0; k < 3; k++) {
        const tf = T + k * 0.12;
        const from = local(chaser(tf), k % 2 ? 2.2 : -2.2, 0, 4);
        const ta = intercept(hunterAt, from, tf, 900);
        const off = hits && k === 2 ? v3(0, 0, 0) : v3(r.gauss(), r.gauss(), r.gauss()).normalize().multiplyScalar(r.range(7, 18));
        const aim = hunterAt(ta).add(off);
        const dist = aim.distanceTo(from);
        w.fx.laser({ t0: tf, from, dir: aim.clone().sub(from), speed: 900, life: hits && k === 2 ? dist / 900 : (dist + 200) / 900, length: 10, width: 1.0, color: 'green' });
        if (hits && k === 2) w.fx.impact(ta, aim, { size: 3.5, inherit: hunter(ta).vel, seed: 7300 + d.id * 31 + Math.floor(T * 10) });
      }
    }
  }
}

/* ------------------------------------------------------------------ capital-ship fire */

interface CapUnit {
  side: 'rep' | 'sep';
  /** world transform at time T, or null when the ship is not in the battle (hidden / destroyed) */
  at: (T: number) => Matrix4 | null;
  vel: Vector3;
  muzzles: Vector3[];
  hull: { p: Vector3; n: Vector3 }[];
  size: number;
}

/** turret muzzles and hull points of a ship, in its local frame */
function capGeometry(ship: CapitalShip): { muzzles: Vector3[]; hull: { p: Vector3; n: Vector3 }[] } {
  ship.group.updateMatrixWorld(true);
  const inv = ship.group.matrixWorld.clone().invert();
  const q = new Quaternion();
  const muzzles = ship.turrets.map((a) => a.getWorldPosition(new Vector3()).applyMatrix4(inv));
  const hull: { p: Vector3; n: Vector3 }[] = muzzles.map((p) => ({ p, n: v3(p.x, p.y * 1.4, 0).normalize() }));
  for (const [name, a] of Object.entries(ship.anchors)) {
    if (!name.startsWith('hit')) continue;
    const p = a.getWorldPosition(new Vector3()).applyMatrix4(inv);
    const n = v3(0, 0, 1).applyQuaternion(a.getWorldQuaternion(q)).transformDirection(inv);
    hull.push({ p, n });
  }
  return { muzzles, hull };
}

export function scheduleCapitalFire(w: World, T0: number, T1: number, o: { heroUntil: number; victimDeath: number }): void {
  const rng = new Rng(2024);
  const units: CapUnit[] = [];
  const hero = capGeometry(w.venator);
  const hm = new Matrix4();
  units.push({ side: 'rep', at: (T) => (T < o.heroUntil ? hm.makeTranslation(vFrame(T)) : null), vel: v3(0, 0, VENATOR_SPEED), ...hero, size: 1 });
  for (const f of w.fleet) {
    const g = capGeometry(f.ship);
    const isVictim = f.ship === w.munis[0];
    const fixed = new Matrix4();
    if (isVictim) fixed.compose(VICTIM_POSE.pos, new Quaternion().setFromEuler(VICTIM_POSE.rot), ONE);
    else fixed.copy(f.root.matrixWorld);
    units.push({ side: f.kind === 'venator' ? 'rep' : 'sep', at: (T) => (isVictim && T > o.victimDeath ? null : fixed), vel: v3(0, 0, 0), ...g, size: f.kind === 'venator' ? 0.9 : 0.8 });
  }
  const world = (u: CapUnit, p: Vector3, T: number) => {
    const m = u.at(T);
    return m ? p.clone().applyMatrix4(m) : null;
  };
  for (let T = T0; T < T1; T += rng.range(0.07, 0.15)) {
    const live = units.filter((u) => u.at(T));
    const att = rng.pick(live);
    const center = world(att, v3(0, 0, 0), T)!;
    const foes = live.filter((u) => u.side !== att.side).sort((a, b) => world(a, v3(0, 0, 0), T)!.distanceTo(center) - world(b, v3(0, 0, 0), T)!.distanceTo(center));
    if (!foes.length) continue;
    const tgt = foes[Math.min(foes.length - 1, rng.int(0, 2))];
    const from = world(att, rng.pick(att.muzzles), T)!;
    const hp = rng.pick(tgt.hull);
    const SPEED = 3200;
    const hitAt = (t: number) => world(tgt, hp.p, t) ?? world(tgt, hp.p, T)!;
    const ta = intercept(hitAt, from, T, SPEED);
    if (!tgt.at(ta + 0.2)) continue;
    const aim = hitAt(ta);
    const dist = aim.distanceTo(from);
    const len = rng.range(120, 200), wid = rng.range(8, 13);
    const color = att.side === 'rep' ? 'blue' : 'red';
    if (rng.chance(0.84)) {
      w.fx.laser({ t0: T, from, dir: aim.clone().sub(from), speed: SPEED, life: dist / SPEED, length: len, width: wid, color });
      const m = tgt.at(ta)!;
      const n = hp.n.clone().transformDirection(m);
      const pos = aim.clone().add(n.clone().multiplyScalar(6));
      if (rng.chance(0.14)) {
        w.fx.explosion(ta, pos, { size: rng.range(60, 120) * tgt.size, pieces: 10, brickScale: 7, sparks: 12, smoke: 3, colors: tgt.side === 'rep' ? ['lbg', 'white', 'dbg', 'red'] : ['tan', 'darkTan', 'lbg', 'reddishBrown'], inherit: tgt.vel, seed: Math.floor(ta * 100) });
      } else {
        w.fx.impact(ta, pos, { size: rng.range(26, 50) * tgt.size, normal: n, inherit: tgt.vel });
      }
    } else {
      // near miss: skims past the hull and flies on
      const off = v3(rng.gauss(), rng.gauss(), rng.gauss()).normalize().multiplyScalar(rng.range(140, 360));
      const miss = aim.clone().add(off);
      w.fx.laser({ t0: T, from, dir: miss.sub(from), speed: SPEED, life: (dist + 1500) / SPEED, length: len, width: wid, color });
    }
  }
}
