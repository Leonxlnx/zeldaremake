/**
 * Third-person follow camera for the walkable build (Phase 2). Reference constants
 * (reference/ANALYSIS.md §1): 4.3 m behind the player at 1.75 m eye height, aimed ≈ 3° down.
 * WASD / arrows move Link relative to the camera, Shift runs, Space (gamepad A) jumps — round 47;
 * the left stick moves and the right stick orbits when a gamepad is connected — drag /
 * pointer-lock orbits. Toggled from main.ts (`?mode=play` or the P key); the default headless
 * behaviour is untouched.
 *
 * The camera's height follows the GROUND under the player (never the root: a jump does not
 * bounce it) with its own, slower time constant (Y_TAU) than its position (XZ_TAU), so a stair
 * climb reads as a glide rather than a stepped rise, while the aim keeps a fraction (AIM_AIR) of
 * the jump's height so Link stays framed at the apex.
 */
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { Terrain } from '../world/terrain/heightfield';
import type { PlayerHandle } from '../world/character/player';

export interface FollowCam {
  camera: PerspectiveCamera;
  enabled: boolean;
  update(dt: number): void;
  /** snap behind the player (called when play mode is entered) */
  snap(): void;
  dispose(): void;
}

export const FOLLOW = { distance: 4.3, eyeHeight: 1.75, aimHeight: 1.5, fov: 46 } as const;
/** position easing time constants (s): horizontal, and the slower vertical */
const XZ_TAU = 0.125;
const Y_TAU = 0.32;
const AIM_AIR = 0.35;
/** gamepad: stick dead zone, right-stick orbit rate (rad/s at full deflection) */
const STICK_DEAD = 0.18;
const STICK_ORBIT = 2.4;

export function createFollowCam(host: HTMLElement, terrain: Terrain, camera: PerspectiveCamera, player: PlayerHandle): FollowCam {
  const keys = new Set<string>();
  let yaw = 0;
  let pitchOffset = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const desired = new Vector3();
  const aim = new Vector3();
  const pos = new Vector3();
  let initialised = false;

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
      yaw -= e.movementX * 0.0022;
      pitchOffset -= e.movementY * 0.0015;
    } else if (dragging) {
      yaw -= (e.clientX - lastX) * 0.0032;
      pitchOffset -= (e.clientY - lastY) * 0.002;
      lastX = e.clientX;
      lastY = e.clientY;
    } else return;
    pitchOffset = MathUtils.clamp(pitchOffset, -0.5, 0.6);
  };
  host.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const snap = () => {
    yaw = player.heading();
    pitchOffset = 0;
    place(1, 1);
    initialised = true;
  };

  const place = (blendXZ: number, blendY: number) => {
    const p = player.position;
    const groundY = terrain.height(p.x, p.z);
    // camera sits behind the player along the follow yaw (forward = (sin yaw, 0, cos yaw))
    desired.set(p.x - Math.sin(yaw) * FOLLOW.distance, groundY + FOLLOW.eyeHeight + pitchOffset * 2.5, p.z - Math.cos(yaw) * FOLLOW.distance);
    const floor = terrain.height(desired.x, desired.z) + 0.4;
    if (desired.y < floor) desired.y = floor;
    pos.x += (desired.x - pos.x) * blendXZ;
    pos.z += (desired.z - pos.z) * blendXZ;
    pos.y += (desired.y - pos.y) * blendY;
    camera.position.copy(pos);
    aim.set(p.x, groundY + FOLLOW.aimHeight + player.airHeight() * AIM_AIR, p.z);
    camera.lookAt(aim);
  };

  const cam: FollowCam = {
    camera,
    enabled: false,
    snap,
    update(dt) {
      if (!cam.enabled) return;
      if (!initialised) snap();
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
      if (gp) {
        // left stick: forward is −y; right stick orbits
        mx += fx * -gp.ly + rx * gp.lx;
        mz += fz * -gp.ly + rz * gp.lx;
        run ||= gp.run;
        jump ||= gp.a;
        if (gp.rx !== 0 || gp.ry !== 0) {
          yaw -= gp.rx * STICK_ORBIT * dt;
          pitchOffset = MathUtils.clamp(pitchOffset - gp.ry * 1.2 * dt, -0.5, 0.6);
        }
      }
      const l = Math.hypot(mx, mz);
      if (l > 1) (mx /= l), (mz /= l);
      player.setInput({ moveX: mx, moveZ: mz, run, jump });
      // the camera eases behind the player's heading while he moves (drag / the right stick override)
      if (l > 0 && !dragging && document.pointerLockElement !== host && !(gp && (gp.rx !== 0 || gp.ry !== 0))) {
        let d = player.heading() - yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * Math.min(1, dt * 1.6);
      }
      place(1 - Math.exp(-dt / XZ_TAU), 1 - Math.exp(-dt / Y_TAU));
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
