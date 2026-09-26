/**
 * The far-bank locality (exp-south2) — the camera south of the rope bridge's north sill: over the
 * bridge head and the bridge, round the keeper's hut, the far bank's path, the hollow log and the
 * cleft past it, at play-camera height, and in the corner west of the path's last straight where
 * it swings as Link turns onto the waystation's steps. Looking north from there the frustum takes
 * in the whole village, which shows, where it shows at all, through the haze beyond the gorge and
 * in the gaps between the south
 * giants' boles (the far-bank look-back: 818 draws / 9.30 M on cc02a9cf against the 700 / 9.0 M
 * budget; walking back over the bridge and off it, 700–725 draws / 9.8–10.4 M without this LOD).
 * Hiding the village there is not an option: zone-probe finds it on screen from every pose tried.
 * While the camera is inside, the structures
 * system stops the village's shadow casting, draws none of its tuft buckets or its
 * centimetre-scale dressing and folds its pods at rest, and the composer applies
 * `farBankShadowRules` and `farBankDrawRule` — shadow and draw distances for this zone alone, and on
 * the far bank itself a shadow reach. The village's shadows and tufts alone saved 51 draws / 0.63 M
 * and 2 draws / 0.37 M at the look-back and changed at most 959 pixels of 518,400 by more than 6
 * levels (max 24).
 *
 * Moving the bridge, the log, the path's last straight or the dwellings voids the measurements, so
 * `farBankLocality.test.mjs` pins the boxes to the layout and a move fails the test.
 */
import type { Box3 } from 'three';

/**
 * x / z bounds (m, exclusive) and the camera height it stops at (m, absolute). `z0` is the bridge's
 * north sill. The follow camera stands 4.3 m behind Link's aim (camera/follow.ts), 4.04 m or more in
 * plan at up to 20° of pitch, so walking back it stays inside while Link crosses the bridge, steps
 * off the sill and walks the path's last straight to its bend, all the while facing the village
 * (just off the sill 703 draws / 10.08 M, at the bridge head 718 / 10.15 M, without the LOD). At the
 * bend the path turns him north-west, the camera swings round behind him and soon leaves the zone as
 * the village swings out of the frustum (turned at the bend: 583 / 7.73 M, the camera at z 30.2).
 * East it runs past the keeper's hut: walking off the gallery's east end and back west, the camera
 * trails 11.6–12.1 m east with the village in the frame (648–673 draws / 9.13–9.47 M there while
 * the zone stopped at x 11, 8.4–8.7 M a stride either side inside it), and with Link at the east
 * step's end facing back west it stands 14 m east.
 */
export const FAR_BANK_ZONE = { x0: -2, x1: 15, z0: 30.45, z1: 62, yMax: 4 } as const;

/**
 * The zone's corner west of the path's last straight (plan bounds, north of the zone, under its
 * cap): turning off the path onto the waystation's steps Link faces north-east and the camera swings
 * round south-west of him, out of the zone while the village is still in the frame — from z 30.1 to
 * 28.7, x 2.4 to 1.3, heading 155° to 126° (at (2.2, 29.7) 613 draws / 9.47 M). The path's nodes
 * (x 3.3–3.7 there) and the waystation stay outside it.
 */
export const FAR_BANK_BEND = { x0: FAR_BANK_ZONE.x0, x1: 3.2, z0: 28.5, z1: FAR_BANK_ZONE.z0 } as const;

/** the zone from the bridge's last 1.2 m on, over the far path's x band: the far bank itself, where `FAR_BANK_SHADOW_REACH` applies */
export const FAR_BANK_SOUTH = { x0: FAR_BANK_ZONE.x0, x1: 11, z0: 42.5, z1: FAR_BANK_ZONE.z1 } as const;

/** true while a camera at (x, y, z) is inside `FAR_BANK_SOUTH` (under the zone's cap) */
export function inFarBankSouth(x: number, y: number, z: number): boolean {
  const Z = FAR_BANK_SOUTH;
  return x > Z.x0 && x < Z.x1 && z > Z.z0 && z < Z.z1 && y < FAR_BANK_ZONE.yMax;
}

/** true while a camera at (x, y, z) is inside `FAR_BANK_ZONE` or its corner `FAR_BANK_BEND` */
export function inFarBankZone(x: number, y: number, z: number): boolean {
  const Z = FAR_BANK_ZONE;
  const B = FAR_BANK_BEND;
  if (y >= Z.yMax) return false;
  return (x > Z.x0 && x < Z.x1 && z > Z.z0 && z < Z.z1) || (x > B.x0 && x < B.x1 && z > B.z0 && z <= B.z1);
}

declare global {
  /**
   * set to `true` (devtools, or a harness through `page.evaluate`) to switch the zone's LOD off from
   * the next frame — A/B captures of exactly what it changes; unset as shipped
   */
  // eslint-disable-next-line no-var
  var __KF_FARBANK_OFF__: boolean | undefined;
}

/** true while the zone's LOD applies to a camera at `p`: inside the zone, unless `__KF_FARBANK_OFF__` */
export function farBankLodAt(p: { x: number; y: number; z: number }): boolean {
  return globalThis.__KF_FARBANK_OFF__ !== true && inFarBankZone(p.x, p.y, p.z);
}

/**
 * The zone's shadow distance for small casters (postfx/shadowcull.ts ShadowDistanceRule): a caster
 * whose bounding sphere has a radius of at most 1.5 m and lies more than 25 m off casts nothing
 * while the camera is inside — from the zone that is the village's children and props and whatever
 * the capture leaves standing in the plaza, each still grounded by its contact-shadow decal. Beside
 * the camera (the player, 3–6 m off in play) nothing changes.
 */
export const FAR_BANK_SMALL_SHADOWS = { maxRadiusM: 1.5, minDistanceM: 25 } as const;

/**
 * The far bank's shadow reach (postfx/shadowcull.ts ShadowDistanceRule with a box): while the camera
 * is in `FAR_BANK_SOUTH`, a caster whose bounding sphere lies wholly more than 20 m outside it in
 * plan casts nothing, whatever its size — from there the giants of the village's north and east
 * sectors (their merged sector meshes), the village's far terrain chunks and rocks. The sun stands
 * in the north-west, so their shadows fall east and south-east of them, 30 m and more from the far
 * bank, in the haze. It is measured from the box, not the camera, so the same casters are off from
 * anywhere on the far bank and nothing switches as the camera moves there.
 */
export const FAR_BANK_SHADOW_REACH = { box: FAR_BANK_SOUTH, minDistanceM: 20 } as const;

const BRIDGE_SHADOW_RULES = [FAR_BANK_SMALL_SHADOWS] as const;
const SOUTH_SHADOW_RULES = [FAR_BANK_SMALL_SHADOWS, FAR_BANK_SHADOW_REACH] as const;

/** the shadow distance rules for a camera at `p`: `FAR_BANK_SMALL_SHADOWS` inside the zone, with `FAR_BANK_SHADOW_REACH` in its south part; none outside */
export function farBankShadowRules(p: { x: number; y: number; z: number }): readonly (typeof FAR_BANK_SMALL_SHADOWS | typeof FAR_BANK_SHADOW_REACH)[] | undefined {
  if (!farBankLodAt(p)) return undefined;
  return inFarBankSouth(p.x, p.y, p.z) ? SOUTH_SHADOW_RULES : BRIDGE_SHADOW_RULES;
}

/**
 * The zone's draw distance for small things (postfx/shadowcull.ts hideSmallFar): a drawable whose
 * bounding sphere has a radius of at most 1 m and lies more than 110 m off is not drawn while the
 * camera is inside — from the zone, the child on the upper ledge 120 m north, whole (a kid's skinned
 * parts carry a 0.35 m reach margin, character/skin.ts: 0.37–0.95 m spheres, her fairy and contact
 * decal less), 6 px tall in the haze where the giants' boles let her through at all. Such a sphere
 * spans at most 12 px of 540 rows at fov 46; nothing nearer is touched.
 */
export const FAR_BANK_SMALL_DRAWS = { maxRadiusM: 1, minDistanceM: 110 } as const;

/** the draw distance rule for a camera at `p`: `FAR_BANK_SMALL_DRAWS` inside the zone, else none */
export function farBankDrawRule(p: { x: number; y: number; z: number }): typeof FAR_BANK_SMALL_DRAWS | undefined {
  return farBankLodAt(p) ? FAR_BANK_SMALL_DRAWS : undefined;
}

/** horizontal distance (m) from the zone (`FAR_BANK_ZONE` or `FAR_BANK_BEND`, the nearer) to a world box; 0 where they overlap */
export function farBankDistance(box: Box3): number {
  const gap = (Z: { x0: number; x1: number; z0: number; z1: number }) =>
    Math.hypot(Math.max(0, box.min.x - Z.x1, Z.x0 - box.max.x), Math.max(0, box.min.z - Z.z1, Z.z0 - box.max.z));
  return Math.min(gap(FAR_BANK_ZONE), gap(FAR_BANK_BEND));
}
