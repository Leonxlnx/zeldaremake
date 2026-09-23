/**
 * Round 48 (structures-31): the built things BEYOND THE ARCH — expansion-1's round-47 handoff
 * ("structures: pod posts at the clearing entrance and the flight's foot; a signpost at the arch's
 * north mouth"; the rope rail on the terrace's south lip). Everything here stands north of z −60,
 * 67 m or more from every fixed camera and inside camera D's blind wedge behind the log's west
 * root mass, so the six hero frames never draw it; `structures/index.ts` hides the whole group
 * beyond `NORTH_VISIBLE_M` of the clearing (its own toggle, keyed like hardscape's north paving)
 * and consolidates it apart from the hero buckets so no hero culling sphere stretches to z −77.
 *
 * Positions are authored HERE because layout.ts is not this lane's; they belong in
 * `LANTERN_POSTS` / `ROPE_FENCES` / `LAYOUT.signposts` when the integrator lands them. Two of
 * expansion-1's spots were checked against the terrain masks (gauntlet probe, this round):
 *  - the clearing-entrance post was asked for at (2.8, −66.6), which is the north path's own
 *    paving (mask.path 1, 0.4 m off the centreline) — it stands on the path's EAST verge instead,
 *    (3.9, −68.7): mask.path 0, level ground (4.21 m), the hook reaching back over the paving
 *    where the path meets the clearing's rim;
 *  - the terrace rail was asked for along x −3.1 … 1.7 at z −76.8, but x ≥ 0.3 is the `ledge`
 *    flight's landing (mask.stairs 1) — the rail runs x −3.1 … −0.1 and leaves the landing open,
 *    as the layout's own `rockLedges.north-terrace` face does.
 * The ledge-foot post (2.4, −73.0) and the signpost (8.0, −60.5) are as asked (both off the
 * paving, on the bank / the plateau mask).
 */
import type { FenceDef, LanternPostDef } from '../layout';

/** the group draws only within this distance (m) of `LAYOUT.northClearing` (hardscape's north paving uses 45 m of its box) */
export const NORTH_VISIBLE_M = 45;

export const NORTH_LANTERN_POSTS: LanternPostDef[] = [
  // east verge of the north path where it enters the clearing's disc (asked for at (2.8, −66.6), on the paving — see above)
  { id: 'clearing-entrance', position: [3.9, -68.7], facing: [-0.73, 0.68], height: 2.5, tint: 'orange' },
  // the ledge flight's foot: 0.3 m east of the bottom tread's end, the hook reaching over the first risers
  { id: 'ledge-foot', position: [2.4, -73.0], facing: [-0.92, -0.38], height: 2.35, tint: 'lime' },
];

export const NORTH_SIGNPOSTS: { id: string; position: [number, number, number]; facing: [number, number] }[] = [
  // the arch's north mouth: on the level ground east of the path as it leaves the tunnel, the
  // board turned to a walker coming out from under the log. Round 49 (structures-32): the
  // passage tube runs on to the north path's bend (mouth ≈ (4.8, −62.7), rim plates to −63.3),
  // so the sign moved from (8.0, −60.5) — inside the tube's bark shell — to a metre past the rim
  // and a metre clear of the shell's flank (tube frame a 8.5, e 4.3; 2 m off the paving's edge).
  { id: 'arch-north', position: [8.1, 4.48, -65.6], facing: [-0.74, 0.67] },
];

export const NORTH_ROPE_FENCES: FenceDef[] = [
  // the terrace's south lip over the clearing (ref-04's ledge), stopping short of the flight's landing
  { id: 'terrace-lip', style: 'rope', points: [[-3.1, 0, -76.8], [-1.6, 0, -76.8], [-0.1, 0, -76.8]] },
];
