/**
 * The LOD rungs' transition band (lane 2, proposal in
 * art/environment/squad2-2026-09-23/dither/PROPOSAL.md).
 *
 * A white-bark or column crosses a rung gate as a hard cut today: measured against every tree forced
 * high (`?treelod=10`), the shipped rungs differ by 1.85 % of the frame at the owner's north pose and
 * 1.92 % at his west pose, essentially all of it the high→medium rung, and that share changes in one
 * step as a walker approaches. The rung distances cannot move further out — hero A has 30 K of triangle
 * headroom — so the remaining fix is to make the swap a fade.
 *
 * This module is the decision half: which rungs a tree belongs to at a distance, and with what weight.
 * The drawing half (a per-instance attribute and a screen-door discard) comes next, and until it lands
 * `TREE_LOD_DITHER` stays false, which makes `lodSlots` return exactly what the single-bucket rule
 * returned before it existed — one slot, full weight. Nothing in a build with the flag off can differ.
 */

/** off until the drawing half lands and the four checks in the proposal pass */
export const TREE_LOD_DITHER = false;
/**
 * width of the transition band (m), centred on a gate. 2.5 m is a couple of walking paces; wider costs
 * more (a tree inside the band is drawn twice, ~11 K triangles for a medium white-bark) and hero A has
 * 30 K of headroom, so this is the ceiling the budget allows rather than a taste choice.
 */
export const TREE_LOD_DITHER_BAND_M = 2.5;

/** a rung a tree draws in this frame, and how much of it shows (the weights of a tree's slots sum to 1) */
export interface LodSlot {
  level: 0 | 1 | 2;
  /** 1 = the whole tree, 0.5 = half its fragments kept by the screen-door mask */
  weight: number;
}

/**
 * The rungs a tree at `d` metres belongs to, given the two gate distances.
 *
 * `d` is the family's own measure (the placement's distance less half its crown radius, as
 * `bucketFamily` computes it), so it can be negative for a tree the camera stands inside.
 *
 * Without the band this is the rule the trees have always used: rung 0 inside the first gate, rung 1
 * inside the second, rung 2 beyond. With it, a tree within half a band of a gate takes both rungs, the
 * nearer one weighted by how far past the gate it still is, so the pair crosses over at the gate itself.
 */
export function lodSlots(d: number, gates: readonly [number, number], band = TREE_LOD_DITHER_BAND_M, dither = TREE_LOD_DITHER): LodSlot[] {
  const level = (d < gates[0] ? 0 : d < gates[1] ? 1 : 2) as 0 | 1 | 2;
  if (!dither || band <= 0) return [{ level, weight: 1 }];
  const half = band / 2;
  for (let g = 0; g < 2; g++) {
    const gate = gates[g];
    if (d <= gate - half || d >= gate + half) continue;
    // 1 at the near edge of the band, 0 at the far edge: the share the NEARER rung keeps
    const near = (gate + half - d) / band;
    const lo = g as 0 | 1;
    const hi = (g + 1) as 1 | 2;
    return [
      { level: lo, weight: near },
      { level: hi, weight: 1 - near },
    ];
  }
  return [{ level, weight: 1 }];
}
