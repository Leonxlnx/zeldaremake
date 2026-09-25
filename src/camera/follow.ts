/**
 * Third-person follow camera for the walkable build (Phase 2). Reference constants
 * (reference/ANALYSIS.md §1): 4.3 m behind the player at 1.75 m eye height, aimed ≈ 3° down.
 * WASD / arrows move Link relative to the camera, Shift runs, Space (gamepad A) jumps — round 47;
 * the left stick moves and the right stick looks when a gamepad is connected — drag /
 * pointer-lock looks. Toggled from main.ts (`?mode=play` or the P key); the default headless
 * behaviour is untouched.
 *
 * The camera orbits an aim point just over Link's head by yaw and PITCH (owner review 2026-09-23:
 * looking up was capped at ≈ 13° by a height-only "pitch" that always aimed at Link's chest, and the
 * drag was inverted). Dragging / the mouse / the right stick UP now looks up (`?invertY=1` flips
 * it): down to 35° below the horizon the camera orbits over Link; up to ORBIT_UP it orbits under
 * him; beyond that it stops descending (it would dive into the grass), draws closer and tilts in
 * place up to 60° — roofs, the lantern mounts, the canopy and the sky. The rest pose is exactly the
 * reference's. While Link moves without look input the view settles back behind him and to the rest
 * pitch.
 *
 * The camera's height follows the GROUND under the player (the walked surface: treads, decks —
 * never the root, so a jump does not bounce it) with its own, slower time constant (Y_TAU) than its
 * position (XZ_TAU), so a stair climb reads as a glide rather than a stepped rise, while the aim
 * keeps a fraction (AIM_AIR) of the jump's height so Link stays framed at the apex. Collision
 * (collision.ts): lifted over the ground and flights, kept in front of solid shells and big boles
 * (pulled in at once, eased back out), lowered under low ceilings, never inside a post or a pod.
 */
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { Terrain } from '../world/terrain/heightfield';
import type { PlayerHandle } from '../world/character/player';
import type { SharedGeometry } from '../world/system';
import { CLEARANCE, MIN_DISTANCE, createCameraCollider, type CameraCollider } from './collision';

export interface FollowCam {
  camera: PerspectiveCamera;
  enabled: boolean;
  update(dt: number): void;
  /** snap behind the player (called when play mode is entered) */
  snap(): void;
  /** the orbit's live state (play-test harness) */
  state?(): Record<string, number | string | null>;
  /** set the look (yaw rad, pitch rad; + looks up) immediately (play-test harness) */
  setView?(yaw: number, pitch: number): void;
  dispose(): void;
}

export interface FollowOptions {
  /** published world geometry for the collision (structures' solids, boles, props) */
  shared?: SharedGeometry;
  /** mouse / stick up looks down (the pre-2026-09-23 direction) */
  invertY?: boolean;
}

export const FOLLOW = { distance: 4.3, eyeHeight: 1.75, aimHeight: 1.5, fov: 46 } as const;
/** the reference rest pose as an orbit: 3.3° down at 4.31 m (4.3 m back, 0.25 m over the aim) */
export const PITCH_REST = -Math.atan2(FOLLOW.eyeHeight - FOLLOW.aimHeight, FOLLOW.distance);
const DIST_REST = Math.hypot(FOLLOW.distance, FOLLOW.eyeHeight - FOLLOW.aimHeight);
/** pitch limits (rad): 60° up, 35° down */
export const PITCH_UP = 1.05;
export const PITCH_DOWN = -0.62;
/** above this pitch the camera stops orbiting under the aim and tilts in place */
const ORBIT_UP = 0.1;
/** orbit radius at full look-up (m): nearer, so the tilted view stays over Link's own clear ground */
const DIST_UP = 2.9;
/** position easing time constants (s): horizontal, and the slower vertical */
const XZ_TAU = 0.125;
const Y_TAU = 0.32;
/**
 * 2026-09-23 (the owner, on the stairs: "whenever I walk up or down the stairs, it glitches the
 * frames up and forth every each step, which is annoying"). The walked surface is a STAIRCASE — it
 * jumps a whole riser at every nosing — and only the orbit pivot (`baseY`) was smoothed against it.
 * The AIM read the raw surface, so the view pitched a riser's worth on every tread, and the
 * camera's own floor clamp read it raw as well, so descending a flight the camera fell a full riser
 * in a single frame. Measured on a 22-step flight at run speed (art/environment/owner-2026-09-23/
 * pass5/stair-cam.mjs): climbing, 2.26° of pitch and 24 mm of height peak-to-peak PER FRAME;
 * descending, 4.62° and 237 mm. Both now have their own time constants.
 *
 * The floor stays a hard clamp — a smoothed one that lagged freely would let the camera sink into a
 * tread — but it may trail the true ground by at most FLOOR_SLACK, which is well inside CLEARANCE,
 * so the step it can still pass on is a riser less that slack (≈ 30 mm) instead of the whole riser.
 */
const AIM_TAU = 0.13;
const FLOOR_TAU = 0.16;
const FLOOR_SLACK = 0.14;
/**
 * The same for the collider's lift: it raises the camera so the LINE from Link clears the ground
 * between, and on a flight the ground between is the treads behind him — so the lift itself steps
 * once per tread. Eased on its own constant, and never allowed to trail the lift the line actually
 * needs by more than LIFT_SLACK (the line's own clearance over the ground is 0.2 m).
 */
const LIFT_TAU = 0.15;
const LIFT_SLACK = 0.12;
/**
 * The ceiling duck (collision.ts `resolve`) is quantised: it drops the camera in whole LOWER_STEP
 * (0.15 m) increments, and `desired.y -= r.lowered` applied that inside one frame. Descending the
 * main flight the camera passes under the lantern limb and the duck flips between steps, which the
 * play-test read as 48 m/s² of vertical acceleration after the staircase easing had taken the climb
 * down to 5. It now ramps in over LOWER_IN_TAU — about five frames for a step, so the camera is at
 * most a few centimetres high while it ducks — and releases on RELEASE_TAU like the pull-in does.
 */
const LOWER_IN_TAU = 0.08;
const AIM_AIR = 0.35;
/** look smoothing (s) and the collision's ease back out (s) */
const LOOK_TAU = 0.05;
const RELEASE_TAU = 0.3;
/**
 * how fast the camera moves in along its line when it would stand inside a slim part (s): a
 * crossing of the lantern limb or a house bough asked for 1.5 m in one frame, then 1.5 m back out
 */
const SLIM_IN_TAU = 0.12;
/**
 * The pull-in in front of a solid is instant (Link is never behind a wall), so a wall the line
 * SWINGS into cut the view by metres in one frame — in the north grove the trunk house's root arch
 * as Link turns from its door (1.9 m), the stilt house's wall as he turns down the gangway beside
 * it (2.8 m). So the line is also swept where it is going: at each LOOKAHEAD horizon, from the aim
 * carried on at Link's velocity (at most LOOKAHEAD_SPEED, and only as far as the collider lets it
 * go — walking up to a wall must not read as the wall cutting the line) to the camera swung on
 * toward the yaw it is easing to (behind the way Link walks), and the camera eases in to the
 * shortest free length ahead of time. Every eased move along the line — that one, the ease back
 * out, the slim push — is held to MAX_EASE m/s and MAX_EASE_ACCEL m/s² (a pop reads as a jump in
 * speed, not only in place). A warning outlasts a frame that reads clear (the free length it saw
 * comes back at SOON_RECOVER m/s): Link steered round the stilt house's veranda turns the look-ahead
 * on and off as his way changes. What no look-ahead saw coming still pulls in at once.
 *
 * While Link walks, the look-ahead is also swept without the swing and with the swing at HURRY ×
 * its pace, to ask whether swinging on behind him runs the line into a wall or clears it sooner.
 * Turning down the gangway beside the stilt house's wall, or about at the trunk house's door,
 * swinging runs the line into the wall or the root arch: the swing waits (down to HOLD_MIN) until
 * Link has walked clear. Turning hard beside a wall, he drags the line across it before the swing
 * catches up, and swinging faster clears it: the swing hurries. (Weighed against no swing only, a
 * hard turn read as a wash — both ran into the wall at the nearest horizon — and never hurried.)
 * SWING_MARGIN m of difference in free length starts either, SWING_SPAN m more is the whole of it;
 * the pace goes to a hurry or a hold over SWING_IN_TAU s — a hard turn leaves a few frames — and
 * comes back over SWING_TAU s.
 */
const LOOKAHEAD = [0.12, 0.3, 0.6] as const;
const LOOKAHEAD_SPEED = 8;
const ANTICIPATE_TAU = 0.12;
const MAX_EASE = 8;
const MAX_EASE_ACCEL = 50;
const SOON_RECOVER = 3;
const HURRY = 3;
const HOLD_MIN = 0.1;
const SWING_MARGIN = 0.3;
const SWING_SPAN = 1.5;
const SWING_TAU = 0.15;
const SWING_IN_TAU = 0.03;
/**
 * On the deck round a hut's round wall (collision.ts, given exactly — the stilt house's veranda) the
 * swing's goal is not straight behind Link: it trails him along the ring, turned RING_OUT outward,
 * and eases RING_PACE × faster. Running round the veranda Link circles the wall at 2.5 rad/s, and
 * the line from him must stay within 25° of his path to clear it: straight behind him, the swing's
 * lag put the camera on the inside of the curve, its line grazing the wall — pulled in to
 * MIN_DISTANCE in a frame (a 1.5–3.9 m pop). Full within RING_IN m of the wall's widest radius, gone
 * RING_FADE m further out, and only as much as Link moves along the ring rather than across it.
 */
const RING_IN = 0.9;
const RING_FADE = 0.6;
const RING_OUT = 0.5;
const RING_PACE = 3;
/**
 * While it follows Link the orbit's own turn is held like its moves along the line: to SWING_RATE
 * rad/s, and to SWING_ACCEL m/s² sideways at the camera, tracking the swing's goal at the goal's
 * own rate. Stepping off the gangway onto the veranda the goal swings round by a right angle in a
 * fifth of a second, and the turn after it jumped by 3 rad/s in a frame (0.5 m sideways at the lens).
 */
const SWING_RATE = 4;
const SWING_ACCEL = 75;
/** while Link moves with no look input for RECENTRE_AFTER s, the pitch eases back to rest */
const RECENTRE_AFTER = 1.5;
const RECENTRE_TAU = 0.9;
/** while Link moves, the yaw eases behind his heading with this time constant (s) */
const HEADING_TAU = 0.625;
/** look rates: drag (rad/px), pointer lock (rad/px), right stick (rad/s at full deflection) */
const DRAG_YAW = 0.0032;
const DRAG_PITCH = 0.0028;
const LOCK_YAW = 0.0022;
const LOCK_PITCH = 0.0022;
const STICK_DEAD = 0.18;
const STICK_ORBIT = 2.4;
const STICK_PITCH = 1.6;

const dirOf = (yaw: number, pitch: number, out: Vector3) => out.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
const smooth01 = (e0: number, e1: number, x: number) => {
  const t = MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createFollowCam(host: HTMLElement, terrain: Terrain, camera: PerspectiveCamera, player: PlayerHandle, options: FollowOptions = {}): FollowCam {
  const keys = new Set<string>();
  const ySign = options.invertY ? -1 : 1;
  let yaw = 0;
  let yawTarget = 0;
  let pitch = PITCH_REST;
  let pitchTarget = PITCH_REST;
  let sinceLook = Infinity;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let initialised = false;
  /** eased camera base: horizontal position and ground height under Link */
  let baseX = 0;
  let baseZ = 0;
  let baseY = 0;
  /** eased walked-surface height under Link for the AIM, and under the camera for its floor (see AIM_TAU) */
  let aimY = 0;
  let floorY = 0;
  /** eased collider lift (see LIFT_TAU) and ceiling duck (see LOWER_IN_TAU) */
  let liftY = 0;
  let lowerY = 0;
  /** the collision's kept fraction of the line (eased back out), and the ease's speed along the line (m/s) */
  let keep = 1;
  let keepRate = 0;
  /** the pace of the swing behind Link against the heading's own, as asked for and as eased (see HURRY) */
  let swingScale = 1;
  let swingPace = 1;
  /** the look-ahead's free length, coming back slowly once clear (m; see SOON_RECOVER) */
  let soonHeld = Infinity;
  /** whether the orbit follows Link (he moves, no look input), and how much a hut's ring steers it (see RING_IN) */
  let following = false;
  let ringWeight = 0;
  const walls = options.shared?.cameraSolids?.walls ?? [];
  /** the yaw the orbit is easing to — behind the way Link walks while he walks without look input, else the look's — and how fast (s) */
  let yawGoal = 0;
  let goalTau = LOOK_TAU;
  /** the orbit's turn rate (rad/s; see SWING_RATE) */
  let yawRate = 0;
  let lastHit: string | null = null;
  let lastLift = 0;
  let lastLowered = 0;
  let lastPush = 0;
  let lastSoon = 1;
  /** the eased slim push (m along the line toward the aim), and its speed (m/s) */
  let push = 0;
  let pushRate = 0;
  const ground = (x: number, z: number) => Math.max(player.groundHeight(x, z), terrain.height(x, z));
  let collider: CameraCollider | null = null;
  const colliderFor = () => (collider ??= createCameraCollider(ground, options.shared ?? {}));
  const aimP = new Vector3();
  const pivotCam = new Vector3();
  const dirPos = new Vector3();
  const dirView = new Vector3();
  const desired = new Vector3();
  const aimPoint = new Vector3();
  const pos = new Vector3();
  const probe = new Vector3();
  /** last frame's aim, and the line where it is going (see LOOKAHEAD) */
  const lastAim = new Vector3();
  const aimVel = new Vector3();
  const aimsAhead = LOOKAHEAD.map(() => new Vector3());
  const ahead = new Vector3();
  /**
   * the ring's goal for the swing (see RING_IN): the yaw that looks along the ring the way Link is
   * sent (mx, mz), turned in toward the wall, and how much it counts (0 off every ring)
   */
  const ringGoal = (mx: number, mz: number): { yaw: number; weight: number } => {
    const p = player.position;
    const l = Math.hypot(mx, mz);
    if (l < 1e-6) return { yaw: 0, weight: 0 };
    for (const w of walls) {
      if (Math.abs(p.y - w.y0) > 0.5) continue;
      const dx = p.x - w.x;
      const dz = p.z - w.z;
      const d = Math.hypot(dx, dz);
      const near = 1 - smooth01(w.rMax + RING_IN, w.rMax + RING_IN + RING_FADE, d);
      if (near <= 0 || d < 1e-6) continue;
      // the ring's tangent, and the way along it Link is sent
      const tx = -dz / d;
      const tz = dx / d;
      const along = (mx * tx + mz * tz) / l;
      const weight = near * smooth01(0.2, 0.6, Math.abs(along));
      if (weight <= 0) continue;
      const s = Math.sign(along);
      const cs = Math.cos(RING_OUT);
      const sn = Math.sin(RING_OUT);
      return { yaw: Math.atan2(s * tx * cs - (dx / d) * sn, s * tz * cs - (dz / d) * sn), weight };
    }
    return { yaw: 0, weight: 0 };
  };
  /** the shortest free length (m) of the line over the horizons, the camera's offset from the aim swung toward `turn` at `pace` × the yaw's */
  const freeAhead = (c: CameraCollider, turn: number, pace: number): number => {
    const ox = desired.x - aimP.x;
    const oy = desired.y - aimP.y;
    const oz = desired.z - aimP.z;
    let free = Infinity;
    LOOKAHEAD.forEach((h, i) => {
      const at = aimsAhead[i];
      const a = turn * (1 - Math.exp((-h * pace) / goalTau));
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      ahead.set(at.x + ox * cs + oz * sn, at.y + oy, at.z + oz * cs - ox * sn);
      const r = c.resolve(at, ahead);
      if (r.t < 0.999) {
        ahead.y -= r.lowered;
        free = Math.min(free, r.t * at.distanceTo(ahead));
      }
    });
    return free;
  };
  /**
   * `value` eased to `goal` at no more than MAX_EASE m/s and MAX_EASE_ACCEL m/s² — slowing in time
   * to stop there, and within `tau` s of it on the exponential; `rate` is its speed (m/s), in and out
   */
  const easeTo = (value: number, rate: number, goal: number, tau: number, dt: number): [number, number] => {
    const e = goal - value;
    const want = Math.sign(e) * Math.min(MAX_EASE, Math.sqrt(2 * MAX_EASE_ACCEL * Math.abs(e)), Math.abs(e) / tau);
    rate += MathUtils.clamp(want - rate, -MAX_EASE_ACCEL * dt, MAX_EASE_ACCEL * dt);
    const next = value + rate * dt;
    // never past the goal: it is where the ease stops
    return (next - goal) * e > 0 ? [goal, 0] : [next, rate];
  };

  /** the first connected gamepad's left stick (x, y), right stick and A button, or null */
  const readGamepad = (): { lx: number; ly: number; rx: number; ry: number; a: boolean; run: boolean } | null => {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return null;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const dz = (v: number) => (Math.abs(v) < STICK_DEAD ? 0 : (v - Math.sign(v) * STICK_DEAD) / (1 - STICK_DEAD));
      return {
        lx: dz(gp.axes[0] ?? 0),
        ly: dz(gp.axes[1] ?? 0),
        rx: dz(gp.axes[2] ?? 0),
        ry: dz(gp.axes[3] ?? 0),
        a: !!gp.buttons[0]?.pressed,
        // B (Zelda's roll / run button) or a left-stick push past ¾ runs
        run: !!gp.buttons[1]?.pressed || Math.hypot(dz(gp.axes[0] ?? 0), dz(gp.axes[1] ?? 0)) > 0.75,
      };
    }
    return null;
  };

  const look = (dYaw: number, dPitch: number) => {
    yawTarget += dYaw;
    pitchTarget = MathUtils.clamp(pitchTarget + dPitch, PITCH_DOWN, PITCH_UP);
    sinceLook = 0;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    keys.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerUp = () => (dragging = false);
  const onPointerMove = (e: PointerEvent) => {
    if (!cam.enabled) return;
    if (document.pointerLockElement === host) {
      look(-e.movementX * LOCK_YAW, -e.movementY * LOCK_PITCH * ySign);
    } else if (dragging) {
      look(-(e.clientX - lastX) * DRAG_YAW, -(e.clientY - lastY) * DRAG_PITCH * ySign);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };
  host.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const snap = () => {
    yaw = yawTarget = player.heading();
    yawRate = 0;
    pitch = pitchTarget = PITCH_REST;
    const p = player.position;
    baseX = p.x;
    baseZ = p.z;
    baseY = aimY = floorY = ground(p.x, p.z);
    liftY = 0;
    lowerY = 0;
    keep = 1;
    initialised = true;
    place(0, true);
  };

  const place = (dt: number, instant = false) => {
    const p = player.position;
    const g = ground(p.x, p.z);
    const bXZ = instant ? 1 : 1 - Math.exp(-dt / XZ_TAU);
    const bY = instant ? 1 : 1 - Math.exp(-dt / Y_TAU);
    baseX += (p.x - baseX) * bXZ;
    baseZ += (p.z - baseZ) * bXZ;
    // the aim rides the surface on its own, shorter constant: unsmoothed it pitched the view a
    // riser's worth on every tread (see AIM_TAU). The jump stays instant so Link keeps his frame.
    aimY = instant ? g : aimY + (g - aimY) * (1 - Math.exp(-dt / AIM_TAU));
    // and the orbit's height follows the AIM, not the raw surface: one lag on a staircase still
    // steps its RATE once per tread (the treads arrive three times faster than Y_TAU decays, so
    // the climb pulsed between a stand-still and twice its speed); two in series is a critically
    // damped climb, which is what a glide looks like.
    baseY += ((instant ? g : aimY) - baseY) * bY;
    const po = Math.min(pitch, ORBIT_UP);
    const dist = pitch > 0 ? MathUtils.lerp(DIST_REST, DIST_UP, smooth01(0, 0.9, pitch)) : DIST_REST;
    dirOf(yaw, po, dirPos);
    dirOf(yaw, pitch, dirView);
    pivotCam.set(baseX, baseY + FOLLOW.aimHeight, baseZ);
    aimP.set(p.x, aimY + FOLLOW.aimHeight + player.airHeight() * AIM_AIR, p.z);
    desired.copy(pivotCam).addScaledVector(dirPos, -dist);
    const c = colliderFor();
    // what the orbit camera looks at along the view direction at the orbit radius: the aim itself
    // while the camera orbits (pitch ≤ ORBIT_UP), a point above it once the camera tilts in place
    aimPoint.copy(aimP).addScaledVector(dirView, dist).addScaledVector(dirPos, -dist);
    const beforeLift = desired.y;
    const wantLift = c.lift(aimP, desired);
    liftY = instant ? wantLift : liftY + (wantLift - liftY) * (1 - Math.exp(-dt / LIFT_TAU));
    lastLift = Math.max(liftY, wantLift - LIFT_SLACK);
    desired.y = beforeLift + lastLift;
    const r = c.resolve(aimP, desired);
    lowerY = instant ? r.lowered : lowerY + (r.lowered - lowerY) * (1 - Math.exp(-dt / (r.lowered > lowerY ? LOWER_IN_TAU : RELEASE_TAU)));
    desired.y -= lowerY;
    lastLowered = lowerY;
    // the stance flips at once where the duck only eases: releasing it (the lower stance no longer
    // buys its 0.4 m) the camera still stands low, and its own line may run longer than the level one
    const own = Math.abs(lowerY - r.lowered) > 1e-3 ? c.sweep(aimP, desired) : null;
    const free = own && own.t > r.t ? own : r;
    lastHit = free.hit;
    const len = aimP.distanceTo(desired);
    const minT = len > 1e-6 ? Math.min(1, MIN_DISTANCE / len) : 1;
    const t = Math.max(minT, free.t);
    // the shortest free length of the line where it is going (see LOOKAHEAD)
    let soonD = Infinity;
    swingScale = 1;
    if (!instant && dt > 0 && len > 1e-6) {
      aimVel.subVectors(aimP, lastAim).divideScalar(dt);
      const v = aimVel.length();
      if (v > LOOKAHEAD_SPEED) aimVel.multiplyScalar(LOOKAHEAD_SPEED / v);
      LOOKAHEAD.forEach((h, i) => {
        const at = aimsAhead[i].copy(aimP).addScaledVector(aimVel, h);
        at.lerpVectors(aimP, at, c.sweep(aimP, at).t);
      });
      const turn = Math.atan2(Math.sin(yawGoal - yaw), Math.cos(yawGoal - yaw));
      const full = freeAhead(c, turn, 1);
      soonD = full;
      // does the swing behind Link clear the line or run it into a wall? (see HURRY)
      if (following && Math.abs(turn) > 0.02) {
        const on = Math.min(full, len);
        const still = Math.min(freeAhead(c, turn, 0), len);
        const fast = Math.min(freeAhead(c, turn, HURRY), len);
        if (still - on > SWING_MARGIN && still >= fast) swingScale = Math.max(HOLD_MIN, 1 - (still - on - SWING_MARGIN) / SWING_SPAN);
        else if (fast - on > SWING_MARGIN) swingScale = 1 + (HURRY - 1) * Math.min(1, (fast - on - SWING_MARGIN) / SWING_SPAN);
        soonD = swingScale === 1 ? Math.min(full, still) : freeAhead(c, turn, swingScale);
      }
    }
    lastAim.copy(aimP);
    soonHeld = instant ? Infinity : Math.min(soonD, soonHeld + SOON_RECOVER * dt);
    const soon = len > 1e-6 ? MathUtils.clamp(soonHeld / len, minT, 1) : 1;
    lastSoon = soon;
    if (instant || t < keep) {
      keep = t;
      keepRate = 0;
    } else {
      const goal = Math.min(t, soon);
      const [d, rate] = easeTo(keep * len, keepRate, goal * len, goal < keep ? ANTICIPATE_TAU : RELEASE_TAU, dt);
      keep = d / len;
      keepRate = rate;
    }
    pos.copy(aimP).lerp(desired, keep);
    // a slim part may pass between; the camera eases in along the line out of one, and back out
    probe.copy(pos);
    const need = c.slimPush(aimP, probe);
    if (instant) {
      push = need;
      pushRate = 0;
    } else [push, pushRate] = easeTo(push, pushRate, need, need > push ? SLIM_IN_TAU : RELEASE_TAU, dt);
    const lineLen = pos.distanceTo(aimP);
    if (push > 1e-4 && lineLen > MIN_DISTANCE) pos.lerp(aimP, Math.min(push, lineLen - MIN_DISTANCE) / lineLen);
    lastPush = push;
    // the camera's own floor: eased over the treads, but never more than FLOOR_SLACK under the
    // ground it actually stands over, so it glides down a flight instead of dropping a riser a frame
    const under = ground(pos.x, pos.z);
    floorY = instant ? under : floorY + (under - floorY) * (1 - Math.exp(-dt / FLOOR_TAU));
    const floor = Math.max(floorY, under - FLOOR_SLACK) + CLEARANCE;
    if (pos.y < floor) pos.y = floor;
    camera.position.copy(pos);
    camera.lookAt(aimPoint);
  };

  const cam: FollowCam = {
    camera,
    enabled: false,
    snap,
    update(dt) {
      if (!cam.enabled) return;
      if (!initialised) snap();
      sinceLook += dt;
      // move input relative to the camera's horizontal forward
      let mx = 0;
      let mz = 0;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = -fz;
      const rz = fx;
      if (keys.has('KeyW') || keys.has('ArrowUp')) (mx += fx), (mz += fz);
      if (keys.has('KeyS') || keys.has('ArrowDown')) (mx -= fx), (mz -= fz);
      if (keys.has('KeyD') || keys.has('ArrowRight')) (mx += rx), (mz += rz);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) (mx -= rx), (mz -= rz);
      let run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      let jump = keys.has('Space');
      const gp = readGamepad();
      const stickLook = !!gp && (gp.rx !== 0 || gp.ry !== 0);
      if (gp) {
        // left stick: forward is −y; right stick looks (up looks up)
        mx += fx * -gp.ly + rx * gp.lx;
        mz += fz * -gp.ly + rz * gp.lx;
        run ||= gp.run;
        jump ||= gp.a;
        if (stickLook) look(-gp.rx * STICK_ORBIT * dt, -gp.ry * STICK_PITCH * ySign * dt);
      }
      const l = Math.hypot(mx, mz);
      if (l > 1) (mx /= l), (mz /= l);
      player.setInput({ moveX: mx, moveZ: mz, run, jump });
      // the camera eases behind the player's heading while he moves (drag / the right stick override),
      // and after RECENTRE_AFTER s of walking without look input the pitch settles back to rest
      following = l > 0 && !dragging && document.pointerLockElement !== host && !stickLook;
      const targetWas = yawTarget;
      if (following) {
        // behind his heading — on a hut's ring, trailing him along it (see RING_IN)
        const ring = ringGoal(mx, mz);
        ringWeight = ring.weight;
        const toward = (from: number) => from + Math.atan2(Math.sin(ring.yaw - from), Math.cos(ring.yaw - from)) * ring.weight;
        goalTau = HEADING_TAU / (1 + (RING_PACE - 1) * ring.weight);
        let d = toward(player.heading()) - yawTarget;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        // hurried where swinging on clears the line, held where it runs the line into a wall (see HURRY)
        swingPace += (swingScale - swingPace) * (1 - Math.exp(-dt / (Math.abs(swingScale - 1) > Math.abs(swingPace - 1) ? SWING_IN_TAU : SWING_TAU)));
        yawTarget += d * (1 - Math.exp((-dt * swingPace) / goalTau));
        // Link turns to the way he is sent at once (9 rad/s), so that is where the swing is going
        yawGoal = toward(Math.atan2(mx, mz));
        // only the part of this frame past the threshold recentres, so the swing starts at the same instant at any frame rate
        const over = Math.min(dt, sinceLook - RECENTRE_AFTER);
        if (over > 0) pitchTarget += (PITCH_REST - pitchTarget) * (1 - Math.exp(-over / RECENTRE_TAU));
      } else {
        yawGoal = yawTarget;
        goalTau = LOOK_TAU;
        ringWeight = 0;
      }
      const bLook = 1 - Math.exp(-dt / LOOK_TAU);
      const yawWas = yaw;
      if (following && dt > 0) {
        // the goal's own rate carried, the rest braked in time (see SWING_RATE); in steps of at most
        // 1/120 s, so it turns alike at any frame rate
        const accel = SWING_ACCEL / DIST_REST;
        const n = Math.ceil(dt * 120 - 1e-9);
        const h = dt / n;
        const bSub = 1 - Math.exp(-h / LOOK_TAU);
        const step = (yawTarget - targetWas) / n;
        let goal = targetWas;
        for (let i = 0; i < n; i++) {
          goal += step;
          const e = goal - yaw;
          const want = step / h + Math.sign(e) * Math.min(Math.sqrt(2 * accel * Math.abs(e)), (Math.abs(e) * bSub) / h);
          yawRate += MathUtils.clamp(MathUtils.clamp(want, -SWING_RATE, SWING_RATE) - yawRate, -accel * h, accel * h);
          yaw += yawRate * h;
        }
      } else {
        yaw += (yawTarget - yaw) * bLook;
        yawRate = dt > 0 ? (yaw - yawWas) / dt : 0;
      }
      pitch += (pitchTarget - pitch) * bLook;
      place(dt);
    },
    state: () => ({
      yaw,
      pitch,
      pitchTarget,
      keep,
      distance: camera.position.distanceTo(aimP),
      lift: lastLift,
      lowered: lastLowered,
      slimPush: lastPush,
      lookahead: lastSoon,
      swing: swingPace,
      ring: ringWeight,
      hit: lastHit,
    }),
    setView(y, p) {
      yaw = yawTarget = y;
      yawRate = 0;
      pitch = pitchTarget = MathUtils.clamp(p, PITCH_DOWN, PITCH_UP);
      sinceLook = 0;
      place(0, true);
    },
    dispose() {
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
  return cam;
}
