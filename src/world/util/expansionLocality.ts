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
import { EXPANSION, EXPANSION_BOX, EXPANSION_ROPE_FENCES, EXPANSION_RUINS_BOXES, EXPANSION_SOUTH, EXPANSION_SOUTH_BOXES, EXPANSION_STAIRS, expansionSteppingStones, inExpansionRuins, southPathLine } from '../layout';

/** beyond this distance from the box the content is hidden regardless of the frustum (haze) */
export const EXPANSION_VISIBLE_M = 60;
/** round 56: the same for the south exit, measured to the nearest of `EXPANSION_SOUTH_BOXES` */
export const SOUTH_VISIBLE_M = 60;

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

/**
 * The far hut's casters (structures/expansion.ts `far` group): its bark column from `footY`
 * (the knoll under it) to `topY`, and the hut itself from a metre under its floor to over its
 * cap. The column's shadow footprint (1.28 m ESE per m of height) is what comes nearest camera
 * C's west edge — layout.ts `farHutTrunk` explains its height.
 */
export function farHutCasters(footY: number, topY: number): Caster[] {
  const F = EXPANSION.farHut;
  const T = EXPANSION.farHutTrunk;
  return [
    { x: F.host[0], z: F.host[1], r: T.baseRadius + 0.4, y0: footY, y1: topY, shadow: true },
    { x: F.host[0], z: F.host[1], r: F.radius + 1.6, y0: footY + F.floor - 1.2, y1: footY + F.floor + F.wall + F.capHeight + 0.6, shadow: true },
  ];
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

/**
 * Round 56 (expansion-south): true when the camera is within SOUTH_VISIBLE_M of one of
 * `EXPANSION_SOUTH_BOXES` AND its frustum meets one of `spheres` — the structures' bridge and
 * log (their casters and shadow footprints), the hardscape's south paving, the vegetation's
 * south dressing and the ravine's mist each pass their own.
 */
export function southVisible(camera: Camera, spheres: Sphere[]): boolean {
  camera.updateMatrixWorld();
  camera.getWorldPosition(_p);
  // round 57: from the waterfall ruins' site the ravine box's west end is 45–50 m off but the
  // content 55–80 m (the path ≥ 48 m from the site box, the bridge ≥ 55 m, through the village's
  // forest), so there the distance is measured to the content's own spheres
  const site = EXPANSION_RUINS_BOXES[1];
  if (_p.x >= site.x0 && _p.x <= site.x1 && _p.z >= site.z0 && _p.z <= site.z1) return frustumMeetsWithin(camera, spheres, SOUTH_VISIBLE_M);
  let near = false;
  for (const b of EXPANSION_SOUTH_BOXES) {
    const dx = Math.max(b.x0 - _p.x, 0, _p.x - b.x1);
    const dz = Math.max(b.z0 - _p.z, 0, _p.z - b.z1);
    if (Math.hypot(dx, dz) < SOUTH_VISIBLE_M) {
      near = true;
      break;
    }
  }
  return near && frustumMeets(camera, spheres);
}

/**
 * Round 56: the south paving as spheres (no shadow): along the path's line from the spine's end
 * to the north sill and along the far path to the log's mouth, every ≤ 1.2 m, each covering
 * the paved half width plus a margin, from under the slabs to a little over them. `yAt` gives
 * the ground there (the live terrain).
 */
export function southPathSpheres(yAt: (x: number, z: number) => number): Sphere[] {
  const out: Sphere[] = [];
  const line = southPathLine();
  for (let i = 0; i < line.length; i += 3) {
    const [x, , z] = line[i];
    out.push(new Sphere(new Vector3(x, yAt(x, z), z), EXPANSION_SOUTH.pathHalfWidth.start + 0.6));
  }
  const far: [number, number][] = [...EXPANSION_SOUTH.farPath.map((p) => [p[0], p[2]] as [number, number]), [EXPANSION_SOUTH.tunnel.mouth[0], EXPANSION_SOUTH.tunnel.mouth[1]]];
  for (let i = 0; i + 1 < far.length; i++) {
    const n = Math.max(1, Math.ceil(Math.hypot(far[i + 1][0] - far[i][0], far[i + 1][1] - far[i][1]) / 1.2));
    for (let k = 0; k <= n; k++) {
      const x = far[i][0] + ((far[i + 1][0] - far[i][0]) * k) / n;
      const z = far[i][1] + ((far[i + 1][1] - far[i][1]) * k) / n;
      out.push(new Sphere(new Vector3(x, yAt(x, z), z), EXPANSION_SOUTH.farPathHalfWidth + 0.8));
    }
  }
  return out;
}

/**
 * Round 57 (expansion-ruins): true when the camera is within RUINS_VISIBLE_M of the waterfall
 * ruins' site box (the trail to it carries no geometry of its own) AND its frustum meets one of
 * `spheres` — the ruins system's casters with their shadow footprints.
 */
export const RUINS_VISIBLE_M = 60;
export function ruinsVisible(camera: Camera, spheres: Sphere[]): boolean {
  camera.updateMatrixWorld();
  camera.getWorldPosition(_p);
  const b = EXPANSION_RUINS_BOXES[1];
  const dx = Math.max(b.x0 - _p.x, 0, _p.x - b.x1);
  const dz = Math.max(b.z0 - _p.z, 0, _p.z - b.z1);
  return Math.hypot(dx, dz) < RUINS_VISIBLE_M && frustumMeets(camera, spheres);
}

/**
 * 2026-09-25 (exp-ruins, the look-backs' budget): the village as seen from the waterfall ruins.
 * From the site and from the trail west of RUINS_VILLAGE_ZONE_X, at walking height, the plaza's
 * houses, posts, fences and kids lie 35–95 m east behind the west giant, the trail's white-barks
 * and the forest. Hidden by hand at the three look-backs and at six trail look-backs 3–7 m apart
 * (each camera turned on the village), none of them moved a pixel, yet all of them were drawn:
 * frustum culling passes the whole village from there, and the sun's 46 m shadow window, 18 m
 * ahead of a look-back, covers its west half. The eye limit keeps the rule to the play camera
 * (≤ 3.8 m over the ground under Link on the ruins' routes and swung views); a camera lifted
 * over the forest sees the village again.
 */
export const RUINS_VILLAGE_ZONE_X = -30;
export const RUINS_VILLAGE_ZONE_EYE_M = 5;
export function villageHiddenFromRuins(camera: Camera, groundAt: (x: number, z: number) => number): boolean {
  camera.updateMatrixWorld();
  camera.getWorldPosition(_p);
  if (_p.x >= RUINS_VILLAGE_ZONE_X || !inExpansionRuins(_p.x, _p.z)) return false;
  return _p.y - groundAt(_p.x, _p.z) < RUINS_VILLAGE_ZONE_EYE_M;
}

/** true when the camera's frustum meets one of `spheres` (world matrix refreshed first, see above) */
export function frustumMeets(camera: Camera, spheres: Sphere[]): boolean {
  camera.updateMatrixWorld();
  _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _f.setFromProjectionMatrix(_m);
  for (const s of spheres) if (_f.intersectsSphere(s)) return true;
  return false;
}

/** `frustumMeets` counting only the spheres within `m` of the camera */
function frustumMeetsWithin(camera: Camera, spheres: Sphere[], m: number): boolean {
  camera.updateMatrixWorld();
  camera.getWorldPosition(_p);
  _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _f.setFromProjectionMatrix(_m);
  for (const s of spheres) if (s.center.distanceTo(_p) - s.radius < m && _f.intersectsSphere(s)) return true;
  return false;
}
