/**
 * Third-person follow camera for the walkable build (Phase 2). Reference constants
 * (reference/ANALYSIS.md §1): 4.3 m behind the player at 1.75 m eye height, aimed ≈ 3° down.
 * WASD / arrows move Link relative to the camera, Shift runs, drag / pointer-lock orbits.
 * Toggled from main.ts (`?mode=play` or the P key); the default headless behaviour is untouched.
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
    place(1);
    initialised = true;
  };

  const place = (blend: number) => {
    const p = player.position;
    const groundY = terrain.height(p.x, p.z);
    // camera sits behind the player along the follow yaw (forward = (sin yaw, 0, cos yaw))
    desired.set(p.x - Math.sin(yaw) * FOLLOW.distance, groundY + FOLLOW.eyeHeight + pitchOffset * 2.5, p.z - Math.cos(yaw) * FOLLOW.distance);
    const floor = terrain.height(desired.x, desired.z) + 0.4;
    if (desired.y < floor) desired.y = floor;
    pos.lerp(desired, blend);
    camera.position.copy(pos);
    aim.set(p.x, groundY + FOLLOW.aimHeight, p.z);
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
      const l = Math.hypot(mx, mz);
      if (l > 1) (mx /= l), (mz /= l);
      player.setInput({ moveX: mx, moveZ: mz, run: keys.has('ShiftLeft') || keys.has('ShiftRight') });
      // the camera eases behind the player's heading while he moves (drag overrides)
      if (l > 0 && !dragging && document.pointerLockElement !== host) {
        let d = player.heading() - yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * Math.min(1, dt * 1.6);
      }
      place(1 - Math.exp(-dt * 8));
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
