/**
 * Village props — WHERE the domestic details stand. Own authored positions (the shared
 * `src/world/layout.ts` is read, never written, for the houses / stairs / boulders / npc spots
 * the placement rules keep clear of). Every prop names a `cluster` (a place); clusters belong to
 * a merge locality (`localityOf`), and each locality is one mesh per material, so the whole
 * dressing costs a handful of draw calls.
 *
 * Placement (index.ts) seats each prop on `ctx.terrain.height`, probes its footprint against the
 * terrain masks and the layout's obstacles, and skips a prop rather than relocating it across the
 * village. Projections quoted below are pinhole into the six fixed cameras (1280×720).
 */
export type PropKind = 'pot' | 'crate' | 'barrel' | 'bucket' | 'ladder' | 'platform' | 'marker' | 'lightString';

/**
 * Merge localities: a cluster is a place (its props are placed and audited together); a locality
 * is what draws together — every cluster of one locality merges into ONE mesh per material and
 * is distance-culled as one. The village's seven clusters span ~30 m and every fixed camera holds
 * most of them, so per-cluster meshes bought no culling there, only draw calls (up to 16 meshes,
 * 32 draws with the shadow pass); the north clearing is 60–75 m away and draws on its own.
 */
const CLUSTER_LOCALITY: Record<string, string> = { 'north-clearing': 'clearing' };
export function localityOf(cluster: string): string {
  return CLUSTER_LOCALITY[cluster] ?? 'village';
}

export interface PropDef {
  id: string;
  kind: PropKind;
  /** authored foot position (y is sampled from the terrain) */
  x: number;
  z: number;
  /** pots / barrel / bucket / marker: height (m); crate: width (m); platform: unused (see `deck`) */
  size: number;
  yaw: number;
  cluster: string;
  /** pot profile: 0 classic belly, 1 tall neck, 2 squat wide mouth */
  variant?: number;
  /** may stand on the flagstone paving (`path` mask) — Kokiri pots beside a stair foot */
  paving?: boolean;
  /** may stand on a house pad (`structure` mask); the trunk itself still keeps its clearance */
  pad?: boolean;
  /** ladder: the house it leans on, the angle around the trunk (rad, 0 = the door, + = viewer's right) and the peg height */
  lean?: { house: string; angle: number; top: number };
  /**
   * platform: deck height above the ground (m), footprint, railing, ladder, block steps.
   * `dais: true` binds the platform to `LAYOUT.plateauLookout` (fable-cursor's hook): position,
   * yaw and width come from the hook, the depth from the `lookout` slab, and the wooden part
   * is a rope railing set into hardscape's stone dais — posts from the turf up through the
   * slab, ropes on its lip and short sides, a step block on the fence side — instead of a deck
   * of its own (the character ground learns the slab top, so wood over the stone would swallow
   * the player's feet).
   */
  platform?: { deck: number; width: number; depth: number; rail: boolean; ladder: boolean; steps?: number; dais?: boolean };
  /**
   * lightString: the peg line (x, z) in order — each peg seated on the terrain, the cord `lift` m
   * over the pegs' feet drooping `sag` mid-span, a glowing pod every `spacing` m. Authored lines
   * are placed as drawn (no footprint probe); `x`/`z` of the def are the first peg.
   */
  string?: { points: [number, number][]; lift: number; sag: number; spacing: number };
}

export const PROP_LAYOUT: readonly PropDef[] = [
  // ---- Saria's door: two pots on the pad, viewer's left of the porch mouth (the right side is a
  // 60° bank). Door space w ≈ −1.6 / −1.45, d ≈ 3.15 / 3.7 from the trunk centre: between the
  // left root lip (w ≈ −2.0) and the doorway (w ≥ −1.15), off the threshold slabs and 0.8 m
  // from the walk's last stone (9.6, −9.3). B/E (0.69, 0.53) at 15 m, A (0.51, 0.46) at 21 m.
  { id: 'door-pot-large', kind: 'pot', x: 9.15, z: -10.3, size: 0.8, yaw: 0.4, cluster: 'saria-door', variant: 0, pad: true },
  { id: 'door-pot-tall', kind: 'pot', x: 8.7, z: -9.75, size: 0.5, yaw: -1.1, cluster: 'saria-door', variant: 1, pad: true },

  // ---- the signpost (7.0, −9.3, facing (−0.6, 0.8)): a pot behind its post and a squat one on
  // its west side; the bucket and the crate stay by the walk to the door (B (0.69, 0.50) /
  // (0.76, 0.55)). The pots replace the round-31 pair at (8.0, −10.0) / (7.5, −9.5).
  { id: 'sign-pot', kind: 'pot', x: 7.65, z: -10.25, size: 0.62, yaw: 2.1, cluster: 'signpost', variant: 0 },
  { id: 'sign-pot-squat', kind: 'pot', x: 6.3, z: -9.85, size: 0.46, yaw: 0.7, cluster: 'signpost', variant: 2 },
  { id: 'saria-water-bucket', kind: 'bucket', x: 7.25, z: -8.0, size: 0.58, yaw: 0.5, cluster: 'signpost' },
  // round 31's (8.75, −8.0) is on the walk's stepping-stone mask and was being nudged onto the
  // 55° bank at (9.5, −7.25); now a smaller crate in the flat pocket right of the walk's end,
  // under the door's right root lip (the mirror of the pots on the left; B (0.76, 0.55))
  { id: 'saria-crate', kind: 'crate', x: 9.7, z: -7.95, size: 0.58, yaw: 0.6, cluster: 'signpost', pad: true },

  // ---- the hero stair's foot: two pots on the paved apron at the bottom riser's SOUTH corner
  // (0.45 m south of the tread ends, 0.5–1.1 m in front of the riser), between the stair, the
  // stair-foot boulder (9.1, 2.5) r 1.0 and the lantern post (9.3, 1.6). A (0.78–0.80, 0.61–0.62)
  // at the riser's right end, C (0.20–0.25, 0.56) just above the protected stair-foot box
  // (0.10–0.20 × 0.60–0.66), F (0.48, 0.59) behind Link.
  { id: 'stair-pot', kind: 'pot', x: 7.95, z: 1.8, size: 0.56, yaw: -0.3, cluster: 'stair-foot', variant: 0, paving: true },
  { id: 'stair-pot-squat', kind: 'pot', x: 7.55, z: 2.1, size: 0.42, yaw: 1.9, cluster: 'stair-foot', variant: 2, paving: true },

  // ---- the demo's strings of small lights along the banks at the hero flight (frame A itself:
  // a string from (0.50, 0.62) to (0.60, 0.55) — the paving's edge at (4.9, −1.7) up to the
  // flight's left foot — and one on the right bank behind the Kokiri boy at (0.90–0.95,
  // 0.35–0.40); `d_011` and `d_087` show the same motif). LEFT: from the plaza paving's edge along
  // the north rim of the lawn pocket left of the flight and up its bank beside the first treads:
  // A (0.50, 0.58) → (0.58, 0.50), F (0.14, 0.63) → (0.19, 0.50), B's right edge (0.88–0.96).
  // RIGHT: along the plateau bank right of the flight (tilt 24–39°, no masks), A (0.90–0.94,
  // 0.36–0.40), 1.6 → 3.0 m up. Pegs 0.45 m, cord sag 0.08, a pod every 0.3 m.
  { id: 'stair-left-lights', kind: 'lightString', x: 5.05, z: -2.3, size: 1, yaw: 0, cluster: 'stair-foot', string: { points: [[5.05, -2.3], [5.8, -2.55], [6.5, -2.8], [7.05, -3.1], [7.45, -3.4], [7.8, -3.75]], lift: 0.45, sag: 0.08, spacing: 0.3 } },
  { id: 'stair-right-lights', kind: 'lightString', x: 12.4, z: 0.9, size: 1, yaw: 0, cluster: 'stair-foot', string: { points: [[12.4, 0.9], [12.95, 0.3], [13.45, -0.35], [13.9, -1.0], [14.25, -1.7]], lift: 0.45, sag: 0.08, spacing: 0.3 } },

  // ---- the plateau's storage corner by the plateau-north fence (survey-2 w28-plateau-d looks
  // straight at it): crate (#32), bucket, a barrel and two pots. The storage pot that stood at
  // (16.4, −8.45) — on the stair bank, where the fern scatter is dense (#37) — joins this corner.
  { id: 'upper-crate', kind: 'crate', x: 19.4, z: -9.7, size: 0.72, yaw: -0.12, cluster: 'plateau' },
  { id: 'upper-barrel', kind: 'barrel', x: 18.55, z: -9.15, size: 0.8, yaw: 0.9, cluster: 'plateau' },
  { id: 'upper-bucket', kind: 'bucket', x: 19.3, z: -10.7, size: 0.51, yaw: -0.4, cluster: 'plateau' },
  { id: 'upper-storage-pot', kind: 'pot', x: 20.15, z: -10.35, size: 0.66, yaw: 0.8, cluster: 'plateau', variant: 1 },
  { id: 'upper-pot-squat', kind: 'pot', x: 19.85, z: -8.85, size: 0.44, yaw: -2.0, cluster: 'plateau', variant: 2 },

  // ---- a rope-and-plank ladder against the upper house's trunk, viewer's right of its door
  // (between the roots at a ≈ 0.8 and 1.97 rad), the crossbar pegged 3.4 m up
  { id: 'upper-ladder', kind: 'ladder', x: 0, z: 0, size: 0.44, yaw: 0, cluster: 'upper-house', lean: { house: 'upper', angle: 1.35, top: 3.4 } },

  // ---- the plateau lookout: the rope railing on hardscape's stone dais at LAYOUT.plateauLookout
  // (21.6, 2.2, yaw 124°, 2.2 × 1.6 m, top 0.35 m over the highest turf), 1.7 m past the last
  // post of the plateau-west fence, looking south-west over the stair bank and the plaza. x, z,
  // yaw, width, depth and the deck height are all taken from the hook at build time (the values
  // here are the fallback); the railing is the −z side (the plaza) and both short sides, open on
  // +z where one step block stands on the turf. Only camera F sees it — (0.58–0.63, 0.22) at
  // 23 m among the reference's fence posts on the wall top; A/B/C/D/E: outside.
  { id: 'lookout-railing', kind: 'platform', x: 21.6, z: 2.2, size: 1, yaw: (124 * Math.PI) / 180, cluster: 'plateau-lip', platform: { deck: 0.35, width: 2.2, depth: 1.6, rail: true, ladder: false, steps: 1, dais: true } },

  // ---- the west platform under the lantern tree (round 31): tall deck with its ladder, kept
  { id: 'west-tree-platform', kind: 'platform', x: -8.7, z: -10.0, size: 1, yaw: 0, cluster: 'west', platform: { deck: 1.28, width: 1.8, depth: 1.4, rail: true, ladder: true } },

  // ---- the north clearing's entrance (GOAL_MODE fable-3 #2): where the north path's band (half
  // width 2.2, from the arch at (5.8, −58) south-west) meets the paved disc at (−1.5, −69.8) r 4.6.
  // The mask's skirt is wide, so the two flank corners are (0.4, −64.4) — the walker's LEFT
  // entering from the arch, the disc's north-east rim — and (4.3, −67.7) on the right toward the
  // ledge flight. The waymarker stands on the left corner, its long board pointing into the
  // circle (yaw so +z → the centre), a pot pair at its foot; a second, low pair on the right
  // corner. Ground 4.16–4.34 m, tilt ≤ 11° (pots set level, the post vertical). Fixed frames: C/F
  // do not hold the direction; in D the left corner projects at x 0.43, inside the log's west
  // root mass (x 0.39–0.47, y 0.27–0.46) with the ground line at 0.47; A/B/E's rays to it pass
  // the log's west end at z −54 inside the bark (x ≈ 0.4, y ≈ 5.5). The tall post therefore
  // stands on that corner; the flight-side corner (D x 0.47, A's ray under the belly at x ≈ 3.8)
  // takes only pots below the far ground line — verified by the six-view capture, not the pinhole.
  { id: 'circle-marker', kind: 'marker', x: 0.4, z: -64.4, size: 1.75, yaw: -2.8, cluster: 'north-clearing' },
  { id: 'circle-pot-marker', kind: 'pot', x: -0.2, z: -64.9, size: 0.58, yaw: 2.4, cluster: 'north-clearing', variant: 1 },
  { id: 'circle-pot-marker-squat', kind: 'pot', x: 0.9, z: -64.15, size: 0.46, yaw: 0.3, cluster: 'north-clearing', variant: 2 },
  { id: 'circle-pot-flight', kind: 'pot', x: 4.75, z: -68.45, size: 0.66, yaw: 0.6, cluster: 'north-clearing', variant: 0 },
  { id: 'circle-pot-flight-squat', kind: 'pot', x: 4.15, z: -68.7, size: 0.44, yaw: -1.4, cluster: 'north-clearing', variant: 2 },
];
