/**
 * The north locality — everything built beyond the log arch (the north path, the second clearing,
 * the ledge terrace: z < −55) — draws only when the camera is within `NORTH_VISIBLE_M` of its
 * bounding box. From the plaza's cameras (A–F) the nearest of it is 60 m off and lost in the haze,
 * yet always-drawn meshes there rode into every fixed frame (W38: camera A over 9.0 M triangles
 * twice in rounds 47/48). Each system that builds north content keeps those meshes separate and
 * toggles `visible` from `update()`/`onCameraMove()` with `northVisible()`; the character ground
 * still reads their geometry (visibility is a render flag). The player approaching the arch sees
 * the north appear at 45 m — inside the haze's far-air veil, so there is no pop.
 */
import type { Layout } from '../layout';

export const NORTH_VISIBLE_M = 45;
/** the north locality's box begins at this z (the arch's north lip) */
export const NORTH_Z1 = -55;

export interface NorthBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** the north locality's XZ box from the layout (clearing + path + terrace, with a 3.2 m margin) */
export function northBox(layout: Layout): NorthBox {
  const NC = layout.northClearing;
  const box: NorthBox = { x0: NC.x - NC.radius - 3.2, x1: NC.x + NC.radius + 3.2, z0: NC.z - NC.radius - 3.2, z1: NORTH_Z1 };
  for (const p of layout.northPath) {
    box.x0 = Math.min(box.x0, p[0] - 3.2);
    box.x1 = Math.max(box.x1, p[0] + 3.2);
    box.z0 = Math.min(box.z0, p[1] - 3.2);
  }
  const T = layout.ledgeTerrace;
  box.x0 = Math.min(box.x0, T.x - T.halfLength - 3.2);
  box.x1 = Math.max(box.x1, T.x + T.halfLength + 3.2);
  box.z0 = Math.min(box.z0, T.z - T.halfDepth - 3.2);
  return box;
}

/** true when a camera at (cx, cz) is within NORTH_VISIBLE_M of the box */
export function northVisible(box: NorthBox, cx: number, cz: number): boolean {
  const dx = Math.max(box.x0 - cx, 0, cx - box.x1);
  const dz = Math.max(box.z0 - cz, 0, cz - box.z1);
  return Math.hypot(dx, dz) < NORTH_VISIBLE_M;
}

/** a prop / rock / structure at (x, z) belongs to the north locality */
export function inNorth(box: NorthBox, x: number, z: number): boolean {
  return z < box.z1 + 1 && x >= box.x0 - 1 && x <= box.x1 + 1;
}
