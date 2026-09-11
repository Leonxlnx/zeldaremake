/** Player simulation, independent of Three.js, the camera and procedural poses. */
import type { PlayerInput } from './player';

export interface WalkSurface {
  height(x: number, z: number): number;
  blocked(x: number, z: number): boolean;
  onStairs(x: number, z: number): boolean;
}

export const MOVE = {
  walkSpeed: 1.6, runSpeed: 3.9, stairSpeed: 1.1,
  /** Exponential response rates (1/s), isotropic and independent of render frame rate. */
  acceleration: 12, braking: 18, airAcceleration: 4,
  turnSpeed: 9, gravity: 15, jumpSpeed: 4.8,
  radius: 0.15, stepHeight: 0.28, snapDown: 0.28,
  maxSlope: Math.tan(50 * Math.PI / 180),
  fixedStep: 1 / 120, maxCatchUp: 0.2, coyoteTime: 0.10, jumpBuffer: 0.12,
} as const;

export interface MotionState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; speed: number; grounded: boolean;
  /** Continuous full-stride cycles; advanced by actual distance, never absolute scene time. */
  phase: number;
  moveWeight: number; runWeight: number; stairWeight: number; landing: number;
  jumps: number;
  time: number;
}

/** One complete left/right stride, sized to the 45.5 cm legs rather than adult gaits. */
export const strideLength = (run: number, stairs: number) => 0.9 + 0.45 * run - 0.15 * stairs;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const approach = (v: number, target: number, delta: number) => v + clamp(target - v, -delta, delta);
const blend = (v: number, target: number, rate: number, dt: number) => target + (v - target) * Math.exp(-rate * dt);

export function createLocomotion(surface: WalkSurface, x: number, z: number, yaw = Math.PI) {
  const state: MotionState = {
    x, y: surface.height(x, z), z, yaw, vx: 0, vy: 0, vz: 0, speed: 0,
    grounded: true, phase: 0.25, moveWeight: 0, runWeight: 0, stairWeight: 0, landing: 0, jumps: 0, time: 0,
  };
  let remainder = 0;
  let jumpHeld = false;
  let buffered = 0;
  let coyote = MOVE.coyoteTime as number;

  const clearInput = () => { buffered = 0; jumpHeld = false; };
  const reset = (px: number, pz: number, heading: number) => {
    Object.assign(state, { x: px, y: surface.height(px, pz), z: pz, yaw: heading,
      vx: 0, vy: 0, vz: 0, speed: 0, grounded: true, phase: 0.25,
      moveWeight: 0, runWeight: 0, stairWeight: 0, landing: 0, jumps: 0, time: 0 });
    remainder = 0; coyote = MOVE.coyoteTime; clearInput();
  };
  const offsets = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * MOVE.radius, Math.sin(i * Math.PI / 4) * MOVE.radius]);
  const blocked = (px: number, pz: number) => {
    if (surface.blocked(px, pz)) return true;
    for (const [ox, oz] of offsets) if (surface.blocked(px + ox, pz + oz)) return true;
    return false;
  };
  // Sweep the sampled footprint at <=4 mm spacing. Endpoint tests alone skip thin
  // structure masks at running speed. This is a sampled heightfield, not mesh collision.
  const pathBlocked = (nx: number, nz: number) => {
    const dx = nx - state.x, dz = nz - state.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.004));
    for (let i = 1; i <= steps; i++) if (blocked(state.x + dx * i / steps, state.z + dz * i / steps)) return true;
    return false;
  };
  const tick = (dt: number, input: PlayerInput) => {
    const s = state;
    s.time += dt;
    let mx = Number.isFinite(input.moveX) ? input.moveX : 0;
    let mz = Number.isFinite(input.moveZ) ? input.moveZ : 0;
    const length = Math.hypot(mx, mz);
    const magnitude = Math.min(1, length);
    if (length > 0) { mx /= length; mz /= length; }
    const moving = magnitude > 0.05;
    const stairs = surface.onStairs(s.x, s.z);
    const desiredSpeed = moving ? magnitude * (stairs && s.grounded ? MOVE.stairSpeed : input.run ? MOVE.runSpeed : MOVE.walkSpeed) : 0;
    if (moving) {
      const angle = Math.atan2(mx, mz) - s.yaw;
      s.yaw += clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -MOVE.turnSpeed * dt, MOVE.turnSpeed * dt);
    }
    const tx = mx * desiredSpeed, tz = mz * desiredSpeed;
    const dvx = tx - s.vx, dvz = tz - s.vz;
    const rate = !s.grounded ? MOVE.airAcceleration : desiredSpeed < s.speed ? MOVE.braking : MOVE.acceleration;
    const gain = 1 - Math.exp(-rate * dt);
    s.vx += dvx * gain; s.vz += dvz * gain;
    if (!moving && Math.hypot(s.vx, s.vz) < 0.005) s.vx = s.vz = 0;
    if (Math.abs(s.vx) < 0.005 && tx === 0) s.vx = 0;
    if (Math.abs(s.vz) < 0.005 && tz === 0) s.vz = 0;

    coyote = s.grounded ? MOVE.coyoteTime : Math.max(0, coyote - dt);
    if (buffered > 0 && coyote > 0) {
      s.vy = MOVE.jumpSpeed; s.grounded = false;
      buffered = 0; coyote = 0; s.landing = 0; s.jumps++;
    }
    buffered = Math.max(0, buffered - dt);
    const oldX = s.x, oldZ = s.z;
    const nextY = s.y + s.vy * dt - (s.grounded ? 0 : 0.5 * MOVE.gravity * dt * dt);
    const canMove = (nx: number, nz: number) => {
      if (pathBlocked(nx, nz)) return false;
      const h = surface.height(nx, nz);
      // Never snap an airborne body up a ledge; allow landing when its soles clear the top.
      if (!s.grounded) return h <= Math.max(s.y, nextY) + 0.015;
      if (h - s.y > MOVE.stepHeight) return false;
      if (surface.onStairs(nx, nz)) return true;
      const dx = nx - s.x, dz = nz - s.z, d = Math.hypot(dx, dz);
      if (!d) return true;
      const rx = dx / d * MOVE.radius, rz = dz / d * MOVE.radius;
      const rise = surface.height(nx + rx, nz + rz) - surface.height(nx - rx, nz - rz);
      return rise / (2 * MOVE.radius) <= MOVE.maxSlope;
    };
    const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
    if (canMove(nx, nz)) { s.x = nx; s.z = nz; }
    else {
      // Slide along the free axis, retaining the same sampled sweep on each axis.
      if (canMove(nx, s.z)) s.x = nx; else s.vx = 0;
      if (canMove(s.x, nz)) s.z = nz; else s.vz = 0;
    }
    const distance = Math.hypot(s.x - oldX, s.z - oldZ);
    s.speed = distance / dt;
    const floor = surface.height(s.x, s.z);
    if (s.grounded && s.y - floor <= MOVE.snapDown) {
      s.y = floor; s.vy = 0;
    } else {
      s.grounded = false;
      s.y = nextY;
      s.vy -= MOVE.gravity * dt;
      if (s.vy <= 0 && s.y <= floor) {
        s.landing = clamp(-s.vy / MOVE.jumpSpeed, 0, 1);
        s.y = floor; s.vy = 0; s.grounded = true;
      }
    }
    s.runWeight = blend(s.runWeight, clamp((s.speed - MOVE.walkSpeed) / (MOVE.runSpeed - MOVE.walkSpeed), 0, 1), 10, dt);
    s.stairWeight = blend(s.stairWeight, stairs && s.grounded && s.speed > 0.05 ? 1 : 0, 12, dt);
    s.moveWeight = blend(s.moveWeight, clamp(s.speed / 0.45, 0, 1), 14, dt);
    // Child-sized stride lengths; run uses a shorter stance interval and a flight interval.
    if (s.grounded) s.phase += distance / strideLength(s.runWeight, s.stairWeight);
    s.landing = approach(s.landing, 0, dt * 5);
  };

  return {
    state, reset, clearInput,
    update(dt: number, input: PlayerInput, onStep?: (state: MotionState, dt: number) => void) {
      if (!Number.isFinite(dt) || dt <= 0) return state;
      if (input.jump && !jumpHeld) buffered = MOVE.jumpBuffer;
      jumpHeld = !!input.jump;
      remainder += Math.min(dt, MOVE.maxCatchUp);
      while (remainder + 1e-10 >= MOVE.fixedStep) {
        tick(MOVE.fixedStep, input);
        onStep?.(state, MOVE.fixedStep);
        remainder = Math.max(0, remainder - MOVE.fixedStep);
      }
      return state;
    },
  };
}
