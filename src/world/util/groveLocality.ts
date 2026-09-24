/**
 * The grove locality (2026-09-24, layout `EXPANSION_NORTH`): the flight up from the ledge terrace,
 * the trail, the shelf and its three houses. Each system builds its grove content into a group of
 * its own and toggles it from `update()` / `onCameraMove()` with `groveVisible()` — the south
 * exit's rule (util/expansionLocality.ts): within GROVE_VISIBLE_M of the grove's box AND the
 * frustum meets one of the locality's spheres (the casters, their sun-swept shadow footprints and
 * the paved ground). Every fixed camera stands 74 m or more from the box, so none draws any of it.
 */
import { Sphere, Vector3, type Camera } from 'three';
import { EXPANSION_NORTH, EXPANSION_NORTH_BOX, NORTH_STAIRS, northGangway, northRopeWalkEnds } from '../layout';
import { casterSpheres, frustumMeets, type Caster } from './expansionLocality';

/** beyond this distance from the grove's box its content is hidden regardless of the frustum (haze) */
export const GROVE_VISIBLE_M = 60;

const _p = new Vector3();

/** true when the camera is within GROVE_VISIBLE_M of `EXPANSION_NORTH_BOX` */
export function groveNear(camera: Camera): boolean {
  camera.updateMatrixWorld();
  camera.getWorldPosition(_p);
  const b = EXPANSION_NORTH_BOX;
  const dx = Math.max(b.x0 - _p.x, 0, _p.x - b.x1);
  const dz = Math.max(b.z0 - _p.z, 0, _p.z - b.z1);
  return Math.hypot(dx, dz) < GROVE_VISIBLE_M;
}

/** `groveNear` AND the frustum meets one of `spheres` (`groveSpheres`) */
export function groveVisible(camera: Camera, spheres: Sphere[]): boolean {
  return groveNear(camera) && frustumMeets(camera, spheres);
}

/**
 * The grove's casters: the trunk house (roots to crown), the stilt house and the tree hut (ground
 * to cap), the hut's column with its crown, the lookout nest, the gangway and rope walk, the
 * lantern posts and the sign. `yAt` gives the live ground.
 */
export function groveCasters(yAt: (x: number, z: number) => number): Caster[] {
  const N = EXPANSION_NORTH;
  const [hx, , hz] = N.house.position;
  const out: Caster[] = [{ x: hx, z: hz, r: N.house.trunkRadius * 1.6, y0: N.shelf.y - 0.5, y1: N.shelf.y + N.house.roofHeight * 1.6, shadow: true }];
  const S = N.stilt;
  out.push({ x: S.host[0], z: S.host[1], r: S.radius + S.veranda + 0.4, y0: yAt(S.host[0], S.host[1]) - 0.3, y1: S.floorY + S.wall + S.capHeight + 0.4, shadow: true });
  const H = N.hut;
  const C = N.column;
  const foot = yAt(H.host[0], H.host[1]);
  out.push({ x: H.host[0], z: H.host[1], r: C.baseRadius + 1.2, y0: foot - 0.3, y1: foot + C.height, shadow: true });
  out.push({ x: H.host[0], z: H.host[1], r: H.radius + H.capOverhang + 0.5, y0: H.floorY - 0.6, y1: H.floorY + H.wall + H.capHeight + 0.4, shadow: true });
  out.push({ x: H.host[0], z: H.host[1], r: 5.5, y0: C.crownY - 1, y1: foot + C.height + 2.5, shadow: true });
  const g = northGangway();
  const w = northRopeWalkEnds();
  for (const [a, b] of [[g.foot, g.head], [w.stilt, w.hut]] as [[number, number, number], [number, number, number]][]) {
    for (const t of [0.2, 0.5, 0.8]) {
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[2] + (b[2] - a[2]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      out.push({ x, z, r: 1.3, y0: Math.min(y - 0.4, yAt(x, z)), y1: y + 1.2, shadow: true });
    }
  }
  for (const p of N.lanternPosts) out.push({ x: p.position[0], z: p.position[1], r: 0.9, y0: yAt(p.position[0], p.position[1]), y1: yAt(p.position[0], p.position[1]) + p.height + 0.4, shadow: true });
  const sp = N.signpost.position;
  out.push({ x: sp[0], z: sp[2], r: 0.8, y0: sp[1], y1: sp[1] + 1.6, shadow: true });
  return out;
}

/**
 * The grove's ground as spheres (no shadow): the flight, the trail every ≤ 1.3 m and the shelf on
 * a 3.2 m grid — the paving, the verge dressing and anything standing low on them.
 */
export function groveGroundSpheres(yAt: (x: number, z: number) => number): Sphere[] {
  const N = EXPANSION_NORTH;
  const out: Sphere[] = [];
  for (const s of NORTH_STAIRS) {
    const l = Math.hypot(s.dir[0], s.dir[1]);
    const run = s.steps * s.tread;
    for (const t of [0, 0.35, 0.7, 1]) {
      const x = s.base[0] + (s.dir[0] / l) * run * t;
      const z = s.base[2] + (s.dir[1] / l) * run * t;
      out.push(new Sphere(new Vector3(x, s.base[1] + s.steps * s.rise * t, z), s.width + 1.2));
    }
  }
  for (let i = 0; i + 1 < N.trail.length; i++) {
    const a = N.trail[i];
    const b = N.trail[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.3));
    for (let k = 0; k <= n; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n;
      const z = a[2] + ((b[2] - a[2]) * k) / n;
      out.push(new Sphere(new Vector3(x, yAt(x, z) + 0.3, z), N.trailHalfWidth + 1.8));
    }
  }
  const S = N.shelf;
  for (let x = S.cx - S.hx; x <= S.cx + S.hx + 0.01; x += 3.2) {
    for (let z = S.cz - S.hz; z <= S.cz + S.hz + 0.01; z += 3.2) out.push(new Sphere(new Vector3(x, S.y + 0.5, z), 3.0));
  }
  return out;
}

/** every sphere of the locality: the casters (with their shadow footprints for `sunDir`, the unit vector toward the sun) and the ground */
export function groveSpheres(yAt: (x: number, z: number) => number, sunDir: Vector3): Sphere[] {
  return [...groveCasters(yAt).flatMap((c) => casterSpheres(c, sunDir)), ...groveGroundSpheres(yAt)];
}
