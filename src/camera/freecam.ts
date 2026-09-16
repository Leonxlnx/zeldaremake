/**
 * Development free camera (Phase 1 only — not the gameplay camera).
 * Drag / pointer-lock to look, WASD to move, Q/E down/up, Shift faster, wheel dolly,
 * keys 1–6 jump to the saved reference viewpoints, R resets to viewpoint A.
 */
import { PerspectiveCamera, Vector3, MathUtils } from 'three';
import { LAYOUT, getViewpoint } from '../world/layout';
import type { Terrain } from '../world/terrain/heightfield';

export interface FreeCam {
  camera: PerspectiveCamera;
  update(dt: number): void;
  setViewpoint(id: string): boolean;
  setPose(position: [number, number, number], target: [number, number, number], fov?: number): void;
  dispose(): void;
  enabled: boolean;
}

export function createFreeCam(host: HTMLElement, terrain: Terrain, aspect: number): FreeCam {
  const camera = new PerspectiveCamera(46, aspect, 0.08, 900);
  let yaw = 0;
  let pitch = 0;
  const vel = new Vector3();
  const keys = new Set<string>();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let wheel = 0;

  const applyLook = () => {
    const dir = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(dir));
  };

  const setPose: FreeCam['setPose'] = (p, t, fov) => {
    camera.position.set(p[0], p[1], p[2]);
    const d = new Vector3(t[0] - p[0], t[1] - p[1], t[2] - p[2]).normalize();
    yaw = Math.atan2(d.x, d.z);
    pitch = Math.asin(MathUtils.clamp(d.y, -1, 1));
    if (fov) camera.fov = fov;
    camera.updateProjectionMatrix();
    applyLook();
  };

  const setViewpoint = (id: string) => {
    const vp = getViewpoint(id);
    if (!vp) return false;
    setPose(vp.position, vp.target, vp.fov);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    keys.add(e.code);
    const idx = parseInt(e.key, 10);
    if (idx >= 1 && idx <= LAYOUT.viewpoints.length) setViewpoint(LAYOUT.viewpoints[idx - 1].id);
    if (e.code === 'KeyR') setViewpoint('A_stairs');
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerUp = () => (dragging = false);
  const onPointerMove = (e: PointerEvent) => {
    if (document.pointerLockElement === host) {
      yaw -= e.movementX * 0.0022;
      pitch -= e.movementY * 0.0022;
    } else if (dragging) {
      yaw -= (e.clientX - lastX) * 0.0032;
      pitch -= (e.clientY - lastY) * 0.0032;
      lastX = e.clientX;
      lastY = e.clientY;
    } else return;
    pitch = MathUtils.clamp(pitch, -1.45, 1.45);
  };
  const onDblClick = () => host.requestPointerLock?.();
  const onWheel = (e: WheelEvent) => {
    wheel += e.deltaY;
  };

  host.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointermove', onPointerMove);
  host.addEventListener('dblclick', onDblClick);
  host.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const fwd = new Vector3();
  const right = new Vector3();
  const move = new Vector3();

  const cam: FreeCam = {
    camera,
    enabled: true,
    setViewpoint,
    setPose,
    update(dt) {
      if (!cam.enabled) return;
      fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
      right.set(fwd.z, 0, -fwd.x);
      move.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(fwd);
      if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(fwd);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
      if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
      if (keys.has('KeyE') || keys.has('Space')) move.y += 1;
      if (keys.has('KeyQ') || keys.has('KeyC')) move.y -= 1;
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 9 : 3.2;
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);
      if (wheel !== 0) {
        const look = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
        move.addScaledVector(look, -wheel * 0.02);
        wheel = 0;
      }
      vel.lerp(move, 1 - Math.exp(-dt * 10));
      camera.position.addScaledVector(vel, dt);
      // never sink below the ground
      const floor = terrain.height(camera.position.x, camera.position.z) + 0.35;
      if (camera.position.y < floor) camera.position.y = floor;
      applyLook();
    },
    dispose() {
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('dblclick', onDblClick);
      host.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
  setViewpoint('A_stairs');
  return cam;
}
