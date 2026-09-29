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
 * The drawing half is a per-instance drop fraction (`index.ts` `fillFamily`) and a screen-door discard
 * in the colour programs (`materials.ts` `injectLodDrop`). With the flag off `lodSlots` returns exactly
 * what the single-bucket rule returned before this module existed — one slot, full weight — so nothing
 * in a build with the flag off can differ.
 *
 * ON since 2026-09-29, when the proposal's four checks came back (`../../../art/environment/
 * squad2-2026-09-23/gatesweep/README.md`), measured by sweeping the live gate past a standing camera
 * rather than walking the camera past the gate:
 *
 *   1. the five distinct fixed frames: C_lookback and F_canopy byte-identical, A / B / D move
 *      0.138 / 0.498 / 0.600 % of their pixels at SSIM 0.9989 / 0.9964 / 0.9963;
 *   2. no stipple — the working crown's Laplacian energy spans 0.00465–0.00493 against the undithered
 *      build's 0.00468–0.00477, at most +3.4 %;
 *   3. the budget: +1…+3 draws and +8 K…+98 K triangles, worst case A_stairs 561 / 8.725 M — 139 draws
 *      and 0.275 M triangles under W38;
 *   4. it reads: the worst single metre of approach at the owner's north pose falls from 0.811 % of the
 *      frame to 0.239 %, and from 28.0 % of the cell the swap lands in to 6.8 %. The hard cut's
 *      signature — two metres that change nothing and then one that changes everything — becomes six
 *      small even steps.
 */

/** on since 2026-09-29: the drawing half is in and the proposal's four checks passed (gatesweep/) */
export const TREE_LOD_DITHER = true;
/**
 * Width of the transition band (m), centred on a gate: a tree within half of it is drawn in both rungs.
 *
 * 2.5 m is a couple of walking paces. It was first chosen as "the ceiling the budget allows" — wrong
 * reason, right value, and both halves of that reason have since failed:
 *
 *   • the budget does not bind. Hero A reads 8.72 M with the band on against W38's 9.0 M, and the cost
 *     SATURATES: 2.5 → 5 m adds 139 K triangles, 5 → 8 m only 16 K, 8 → 12 m only 26 K, because the
 *     trees near a gate are clustered rather than spread. Even a 12 m band leaves 94 K spare.
 *   • wider is not better either. Against `reference/frames/`, the frame moves monotonically FURTHER
 *     from its reference as the band widens — hero A −0.0004 / −0.0007 / −0.0016 / −0.0023 at
 *     2.5 / 5 / 8 / 12 m, and D_log −0.0019 / −0.0050 / −0.0055 at 2.5 / 5 / 8 — against a run-to-run
 *     noise floor of 0.0000 at hero A. PR #198's reading that a 12 m band was *closer* to the reference
 *     than 2.5 m does not reproduce; the direction is the other way.
 *
 * So the width stays 2.5 m because it is the cheapest point on a monotone curve, not because a ceiling
 * forces it. `art/environment/squad2-2026-09-23/bandwidth/` has the sweep.
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
