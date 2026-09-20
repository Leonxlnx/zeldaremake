/**
 * The expansion locality (round 49) — the west tree-house, the fence-topped south bank with its
 * flight, and the stepping discs west / south-west of the plaza (layout `EXPANSION`). Like the
 * north locality it is built into its own meshes and toggled from `update()` / `onCameraMove()`,
 * but a distance rule alone is not enough here: the content is 8–25 m from every plaza camera,
 * inside the sun's 46 m shadow window, so it rode into every fixed frame's SHADOW pass (+9 draws,
 * +40 k triangles in camera A, which looks the other way). `expansionVisible()` therefore also
 * asks whether any of the content's spheres — each caster as a stack of spheres, plus the same
 * spheres swept along the sun direction onto the ground (its shadow footprint), so a caster whose
 * shadow lies in frame stays drawn — meets the camera's frustum. Spheres, not boxes: the content
 * runs diagonally along camera C's right edge, 1–2 m outside it, and an axis-aligned box's empty
 * corner reached across the edge. Both the structures' near group and the hardscape's expansion
 * group use it, so the house and its stair appear and vanish together.
 */
import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three';
import { EXPANSION, EXPANSION_BOX, EXPANSION_ROPE_FENCES, EXPANSION_STAIRS, expansionSteppingStones } from '../layout';

/** beyond this distance from the box the content is hidden regardless of the frustum (haze) */
export const EXPANSION_VISIBLE_M = 60;

/**
 * A vertical caster: a circle on the ground (`x, z, r`), its ground height `y0`, its top `y1`
 * (absolute), and whether it throws a shadow worth following (`shadow` — the 5 cm discs do not)
 */
export interface Caster {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
  shadow: boolean;
}

/**
 * The locality's casters: the house (bole to cap over the ledge), the bank's six fence posts,
 * each flight (three circles along its run), every stepping disc
 */
export function expansionCasters(): Caster[] {
  const W = EXPANSION.westHouse;
  // (the ledge under the bole is 1.85 m; the cap's overhang is 0.55 m — camera C's edge passes
  // 3° beyond the cap's shadow tip, so the paddings here stay small)
  const out: Caster[] = [{ x: W.host[0], z: W.host[1], r: W.radius + 0.9, y0: 1.85, y1: W.floorY + W.wall + W.capHeight + 0.3, shadow: true }];
  // the fence posts (structures/fence.ts: 1.1 m × 0.92–1.10, sunk in the turf) — one thin
  // sphere each: the rope sags below the post tops, so the posts' shadow tips are the fences' reach
  const B = EXPANSION.southBank;
  for (const f of EXPANSION_ROPE_FENCES) for (const p of f.points) out.push({ x: p[0], z: p[2], r: 0.45, y0: B.height - 0.15, y1: B.height + 1.22, shadow: true });
  for (const s of EXPANSION_STAIRS) {
    const l = Math.hypot(s.dir[0], s.dir[1]);
    const run = s.steps * s.tread + 1.7;
    const rise = s.steps * s.rise;
    const r = Math.max(s.width * 0.7, run * 0.2);
    for (const t of [0.2, 0.5, 0.8]) {
      // the treads climb along the run: each sphere spans its own stretch of the flight (+ kerbs)
      const yMid = s.base[1] + rise * Math.min(1, t * 1.25);
      out.push({ x: s.base[0] + (s.dir[0] / l) * run * t, z: s.base[2] + (s.dir[1] / l) * run * t, r, y0: yMid - rise * 0.2 - 0.25, y1: yMid + rise * 0.2 + 0.35, shadow: true });
    }
  }
  for (const d of expansionSteppingStones()) out.push({ x: d.x, z: d.z, r: d.r + 0.15, y0: -0.6, y1: 2.5, shadow: false });
  return out;
}

/** the unit vector toward the sun from the config's azimuth (from +Z toward +X) and elevation — lighting/sun.ts's convention */
export function sunVector(azimuthDeg: number, elevationDeg: number): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}

/**
 * The caster as spheres: a vertical stack covering `y0` … `y1`, and — for shadow casters — the
 * ground footprint of its shadow for `sunDir` (the unit vector toward the sun): a point `h` up
 * casts to `p − sunDir · h / sunDir.y`, so the footprint is the base circle swept along that
 * offset, sampled every ≤ 0.8 r (radius + 0.2 for the penumbra), at the caster's ground height.
 */
export function casterSpheres(c: Caster, sunDir: Vector3): Sphere[] {
  const out: Sphere[] = [];
  for (let y = c.y0; y < c.y1 + c.r; y += Math.max(c.r, 0.5)) out.push(new Sphere(new Vector3(c.x, Math.min(y, c.y1), c.z), c.r));
  if (c.shadow) {
    const k = (c.y1 - c.y0) / Math.max(sunDir.y, 0.05);
    const sx = -sunDir.x * k;
    const sz = -sunDir.z * k;
    const len = Math.hypot(sx, sz);
    const steps = Math.max(1, Math.ceil(len / (c.r * 0.8)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      out.push(new Sphere(new Vector3(c.x + sx * t, c.y0, c.z + sz * t), c.r + 0.2));
    }
  }
  return out;
}

const _m = new Matrix4();
const _f = new Frustum();
const _p = new Vector3();

/**
 * True when the camera is within EXPANSION_VISIBLE_M of the locality's box AND its frustum meets
 * one of `spheres` (`casterSpheres(caster, sunDir)` each). The camera's world matrix is refreshed
 * first: `update()` runs before the renderer's own update, and a pose set this frame would
 * otherwise be tested against last frame's matrices.
 */
export function expansionVisible(camera: Camera, spheres: Sphere[]): boolean {
  camera.updateMatrixWorld();
  camera.getWorldPosition(_p);
  const box = EXPANSION_BOX;
  const dx = Math.max(box.x0 - _p.x, 0, _p.x - box.x1);
  const dz = Math.max(box.z0 - _p.z, 0, _p.z - box.z1);
  if (Math.hypot(dx, dz) >= EXPANSION_VISIBLE_M) return false;
  return frustumMeets(camera, spheres);
}

/** true when the camera's frustum meets one of `spheres` (world matrix refreshed first, see above) */
export function frustumMeets(camera: Camera, spheres: Sphere[]): boolean {
  camera.updateMatrixWorld();
  _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _f.setFromProjectionMatrix(_m);
  for (const s of spheres) if (_f.intersectsSphere(s)) return true;
  return false;
}
