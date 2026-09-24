/**
 * The far-bank locality (exp-south2) — the camera south of the rope bridge: the bridge's last
 * 1.2 m, the far bank's path, the hollow log and the cleft past it, at play-camera height. Every
 * village structure is 40 m and more from anywhere in it (the structures' audit
 * `farBank.nearestVillageM`, measured on the built meshes) and shows, where it shows at all, through
 * the haze in the gaps between the south giants' boles and the log's mouth — yet a look-back's
 * frustum takes all of it in (the far-bank look-back: 818 draws / 9.30 M on cc02a9cf against the
 * 700 / 9.0 M budget). Hiding the village there is not an option: zone-probe finds it on screen
 * from every pose tried. While the camera is inside, the structures system stops the village's
 * shadow casting and draws none of its tuft buckets — a shadow and detail distance for this zone
 * alone. At the look-back that saves 51 draws / 0.63 M (shadows) and 2 draws / 0.37 M (tufts), and
 * changes at most 959 pixels of 518,400 by more than 6 levels (max 24): a shadow 40 m off in haze.
 *
 * Moving the bridge or the log voids the measurements, so `farBankLocality.test.mjs` pins the box
 * to the layout and a move fails the test.
 */
import type { Box3 } from 'three';

/** x / z bounds (m, exclusive) and the camera height it stops at (m, absolute) */
export const FAR_BANK_ZONE = { x0: -2, x1: 11, z0: 42.5, z1: 62, yMax: 4 } as const;

/** true while a camera at (x, y, z) is inside `FAR_BANK_ZONE` */
export function inFarBankZone(x: number, y: number, z: number): boolean {
  const Z = FAR_BANK_ZONE;
  return x > Z.x0 && x < Z.x1 && z > Z.z0 && z < Z.z1 && y < Z.yMax;
}

/** horizontal distance (m) from `FAR_BANK_ZONE` to a world box; 0 where they overlap */
export function farBankDistance(box: Box3): number {
  const Z = FAR_BANK_ZONE;
  const dx = Math.max(0, box.min.x - Z.x1, Z.x0 - box.max.x);
  const dz = Math.max(0, box.min.z - Z.z1, Z.z0 - box.max.z);
  return Math.hypot(dx, dz);
}
