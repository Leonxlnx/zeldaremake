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
const AIM_AIR = 0.35;
/** look smoothing (s) and the collision's ease back out (s) */
const LOOK_TAU = 0.05;
const RELEASE_TAU = 0.3;
/** while Link moves with no look input for RECENTRE_AFTER s, the pitch eases back to rest */
const RECENTRE_AFTER = 1.5;
const RECENTRE_TAU = 0.9;
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
  /** the collision's kept fraction of the line (eased back out) */
  let keep = 1;
  let lastHit: string | null = null;
  let lastLift = 0;
  let lastLowered = 0;
  let lastPush = 0;
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
    pitch = pitchTarget = PITCH_REST;
    const p = player.position;
    baseX = p.x;
    baseZ = p.z;
    baseY = ground(p.x, p.z);
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
    baseY += (g - baseY) * bY;
    const po = Math.min(pitch, ORBIT_UP);
    const dist = pitch > 0 ? MathUtils.lerp(DIST_REST, DIST_UP, smooth01(0, 0.9, pitch)) : DIST_REST;
    dirOf(yaw, po, dirPos);
    dirOf(yaw, pitch, dirView);
    pivotCam.set(baseX, baseY + FOLLOW.aimHeight, baseZ);
    aimP.set(p.x, g + FOLLOW.aimHeight + player.airHeight() * AIM_AIR, p.z);
    desired.copy(pivotCam).addScaledVector(dirPos, -dist);
    // what the orbit camera looks at along the view direction at the orbit radius: the aim itself
    // while the camera orbits (pitch ≤ ORBIT_UP), a point above it once the camera tilts in place
    aimPoint.copy(aimP).addScaledVector(dirView, dist).addScaledVector(dirPos, -dist);
    const c = colliderFor();
    lastLift = c.lift(aimP, desired);
    const r = c.resolve(aimP, desired);
    desired.y -= r.lowered;
    lastLowered = r.lowered;
    lastHit = r.hit;
    const len = aimP.distanceTo(desired);
    const minT = len > 1e-6 ? Math.min(1, MIN_DISTANCE / len) : 1;
    const t = Math.max(minT, r.t);
    keep = instant || t < keep ? t : keep + (t - keep) * (1 - Math.exp(-dt / RELEASE_TAU));
    pos.copy(aimP).lerp(desired, keep);
    lastPush = c.slimPush(aimP, pos);
    const floor = ground(pos.x, pos.z) + CLEARANCE;
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
      if (l > 0 && !dragging && document.pointerLockElement !== host && !stickLook) {
        let d = player.heading() - yawTarget;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yawTarget += d * Math.min(1, dt * 1.6);
        if (sinceLook > RECENTRE_AFTER) pitchTarget += (PITCH_REST - pitchTarget) * (1 - Math.exp(-dt / RECENTRE_TAU));
      }
      const bLook = 1 - Math.exp(-dt / LOOK_TAU);
      yaw += (yawTarget - yaw) * bLook;
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
      hit: lastHit,
    }),
    setView(y, p) {
      yaw = yawTarget = y;
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
