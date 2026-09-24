/**
 * The far-bank locality (exp-south2) — the camera south of the rope bridge: the bridge's last
 * 1.2 m, the far bank's path, the hollow log and the cleft past it, at play-camera height. Every
 * village structure is 27 m and more from anywhere in it (27.7 m: the structures' audit
 * `farBank.nearestVillageM`, measured on the built meshes) and shows, where it shows at all, through
 * the haze in the gaps between the south giants' boles and the log's mouth — yet a look-back's
 * frustum takes all of it in (the far-bank look-back: 818 draws / 9.30 M on cc02a9cf against the
 * 700 / 9.0 M budget). Hiding the village there is not an option: zone-probe finds it on screen
 * from every pose tried. While the camera is inside, the structures system stops the village's
 * shadow casting, draws none of its tuft buckets or its centimetre-scale dressing and folds its
 * pods at rest, and the composer applies `FAR_BANK_SMALL_SHADOWS` — a shadow and detail distance
 * for this zone alone. The village's shadows and tufts alone saved 51 draws / 0.63 M and 2 draws /
 * 0.37 M at the look-back and changed at most 959 pixels of 518,400 by more than 6 levels (max 24).
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

/**
 * The zone's shadow distance for small casters (postfx/shadowcull.ts ShadowDistanceRule): a caster
 * whose bounding sphere has a radius of at most 1.5 m and lies more than 25 m off casts nothing
 * while the camera is inside — from every pose in the zone that is the village's children and
 * whatever the capture leaves standing in the plaza, 35 m and more away, each still grounded by
 * its contact-shadow decal. Beside the camera (the player, 3–6 m off in play) nothing changes.
 */
export const FAR_BANK_SMALL_SHADOWS = { maxRadiusM: 1.5, minDistanceM: 25 } as const;

/** the shadow distance rule for a camera at `p`: `FAR_BANK_SMALL_SHADOWS` inside the zone, else none */
export function farBankShadowRule(p: { x: number; y: number; z: number }): typeof FAR_BANK_SMALL_SHADOWS | undefined {
  return inFarBankZone(p.x, p.y, p.z) ? FAR_BANK_SMALL_SHADOWS : undefined;
}

/** horizontal distance (m) from `FAR_BANK_ZONE` to a world box; 0 where they overlap */
export function farBankDistance(box: Box3): number {
  const Z = FAR_BANK_ZONE;
  const dx = Math.max(0, box.min.x - Z.x1, Z.x0 - box.max.x);
  const dz = Math.max(0, box.min.z - Z.z1, Z.z0 - box.max.z);
  return Math.hypot(dx, dz);
}
