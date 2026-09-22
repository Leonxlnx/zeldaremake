import * as THREE from 'three';

const EYE = 1.7;
const RADIUS = 0.28;

export function createPlayer(camera, dom, colliders) {
  const keys = Object.create(null);
  const state = {
    x: 0,
    z: 2.4,
    yaw: Math.PI,
    pitch: 0,
    debug: false,
    bob: 0,
    moving: false,
    eye: EYE,
  };

  function blocked(x, z) {
    const y0 = 0.15;
    const y1 = 1.62;
    const r2 = RADIUS * RADIUS;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (b.max.y < y0 || b.min.y > y1) continue;
      const cx = Math.max(b.min.x, Math.min(x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(z, b.max.z));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  }

  function onKeyDown(e) {
    keys[e.code] = true;
  }
  function onKeyUp(e) {
    keys[e.code] = false;
  }
  function onMouse(e) {
    if (state.debug) return;
    if (document.pointerLockElement !== dom) return;
    state.yaw -= e.movementX * 0.00215;
    state.pitch -= e.movementY * 0.00215;
    state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch));
  }
  function onClick() {
    if (state.debug) return;
    dom.requestPointerLock();
  }
  function onLock() {
    const lock = document.getElementById('lock');
    if (!lock) return;
    const locked = document.pointerLockElement === dom;
    lock.classList.toggle('hide', locked || state.debug);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouse);
  dom.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onLock);

  function update(dt) {
    if (state.debug) return;
    const speed = keys.ShiftLeft ? 4.2 : 2.45;
    const fx = -Math.sin(state.yaw);
    const fz = -Math.cos(state.yaw);
    const rx = -fz;
    const rz = fx;
    let mx = 0;
    let mz = 0;
    if (keys.KeyW) { mx += fx; mz += fz; }
    if (keys.KeyS) { mx -= fx; mz -= fz; }
    if (keys.KeyD) { mx += rx; mz += rz; }
    if (keys.KeyA) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    state.moving = len > 0.01;
    if (state.moving) {
      mx = (mx / len) * speed * dt;
      mz = (mz / len) * speed * dt;
      const nx = state.x + mx;
      const nz = state.z + mz;
      if (!blocked(nx, state.z)) state.x = nx;
      if (!blocked(state.x, nz)) state.z = nz;
      state.bob += dt * 9.5;
    } else {
      state.bob += dt * 1.4;
    }
    const bobAmp = state.moving ? Math.sin(state.bob) * 0.028 : Math.sin(state.bob) * 0.004;
    const roll = state.moving ? Math.cos(state.bob * 0.5) * 0.012 : 0;
    camera.rotation.order = 'YXZ';
    camera.position.set(state.x, EYE + bobAmp, state.z);
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
    camera.rotation.z = roll;
  }

  function setView(pos, look) {
    state.debug = true;
    state.x = pos[0];
    state.z = pos[2];
    state.eye = pos[1];
    camera.rotation.order = 'YXZ';
    camera.rotation.z = 0;
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
    state.yaw = camera.rotation.y;
    state.pitch = camera.rotation.x;
    const lock = document.getElementById('lock');
    if (lock) lock.classList.add('hide');
  }

  function release() {
    state.debug = false;
    onLock();
  }

  camera.rotation.order = 'YXZ';
  camera.position.set(state.x, EYE, state.z);
  camera.rotation.y = state.yaw;

  return { state, update, setView, release, blocked };
}
