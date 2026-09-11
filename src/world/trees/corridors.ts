/**
 * Sun-corridor data shared with the atmosphere system. Data only (no three.js imports) so
 * `src/world/atmosphere/shafts.ts` can import the shaft columns and open its canopy-gap mask exactly
 * where the trees system carves the canopy, instead of mirroring the numbers.
 */
export interface ShaftColumn {
  /** a point in the air (m) on the column's axis; the axis runs along the sun direction */
  point: [number, number, number];
  /** disc radius (m) in the plane perpendicular to the sun: the god-ray column's width */
  radius: number;
  /**
   * foliage clearing radius (m) when it must be wider than the column (soft-shadow penumbra
   * margin, so the air inside `radius` is fully lit); defaults to `radius`
   */
  carve?: number;
  /**
   * share of giant laminae / cluster cards kept inside the carve (default none): a dappled
   * shaft, whose landing reads as sun-flecked ground rather than a lit disc
   */
  porosity?: number;
  cardPorosity?: number;
}

/**
 * God-ray shaft columns: world air points whose sun line is kept clear of giant foliage (porosity 0),
 * so the canopy shadow map carries a few bold holes among the fine dapple and the composer's god
 * rays get a lit column to scatter in.
 * - Shots A/B (upper-left): three columns over the north of the plaza.
 * - Shot F (camera (-1.04, 1.7, 5.64) → (10.22, 0.95, -0.86), fov 46): the reference's shafts enter
 *   at the top edge between x ≈ 0.15 and 0.35 and lean down-right to the stairs at mid-frame; these
 *   axes pass the view rays through (0.17, 0), (0.27, 0), (0.37, 0) at canopy height, and their sun
 *   lines reach the ground at screen ≈ (0.5–0.65, 0.5). Their occluders are the north-west-near
 *   giant's crown (14–22 m up-sun) and the plateau oak's house-bough lobes (P3, 4–5 m). Wood is
 *   never carved: the middle column was first placed at (7.7, 6.0, −4.4), whose sun line passes
 *   1.2 m from the north-west-near bole at 18 m (its fork and leaders: 38 % of the cone stayed
 *   blocked after carving), so it slid 3 m further out along its own view ray — same screen
 *   position (0.27, 0) — to pass 4 m from that axis. Saria's tree-house (structures) stands under the
 *   shafts' entry region — its crown projects to F (0.23, 0.07) — so the (0.37, 0) view ray runs into
 *   the house's own boughs and leaves between 12 and 22 m depth (the first right column, at
 *   (13.2, 8.0, −6.6), looked straight into them 4–5 m up-sun) and then along the plateau oak's second
 *   house bough, which is nearly parallel to the sun. 10 m further out along that ray the line
 *   clears the house by 5.9 m and the bough wood by 1.7 m, passes 5.6 m from the oak's axis below its
 *   fork, and lands on the upper plateau at ≈ (26, 5.4, −8) — screen (0.53, 0.32) in F.
 * - The left F column first sat at (10.4, 8.0, −11.4), whose line ended on Saria's roof 1.6 m
 *   down-sun of its air point: its beam crossed the dome in shots A/B/F (A crown box (0.53–0.65,
 *   0.1–0.24) 0.53 against the reference's 0.48; B house box (0.62–1, 0–0.35) 0.40 against 0.36),
 *   where the reference keeps the house in canopy shade (A house box hue 59°, sat 0.19 — a shaded
 *   grey-olive bank). Round 8 shades both houses with lobes 16–19 m up (trees CANOPY_BOUGHS) and
 *   slides this column out along its own view ray — same entry (0.20, 0) in F, still down the
 *   frame's left third — to 22 m depth, where its sun line passes the dome's east rim with 0.3–0.6 m
 *   to spare (line 4.8 m from the axis at 6 m, 5.9 m at 5 m; beam radius 1.3) and lands on the
 *   plateau lip at ≈ (17.9, 5.4, −11.0), by the plateau-north fence: A (0.72, 0.31), F (0.37, 0.27),
 *   B (0.95, 0.26). Measured (same tree state): A crown box 0.53 → 0.50 (ref 0.48), B house box
 *   0.40 → 0.38 (ref 0.36), F top-left strip (0.1–0.35, 0–0.2) 0.43 → 0.41. Sliding it to 26 m
 *   depth instead (line landing at (22.9, 5.4, −12.6) behind the stair top) matched B exactly
 *   (0.36) but left the beam at 8–12 m in the thin aerosol, so F's left shaft all but vanished
 *   (strip 0.39) and A's crown fell to 0.44. Its carve cuts the east end of the eastmost Saria lobe
 *   (which shades the dome's self-shaded south-east flank) and stays 3.9 m from the crown's own sun
 *   line and 2.6 m from the upper cap's, so the roof shade mostly holds (crown probe 26 % open,
 *   15 % without this carve; 93 % before the lobes).
 * - The middle F column's sun line lands on the upper run of the main stairs at ≈ (12.5, 4.2, −4.3)
 *   — shot A (0.74, 0.31). Reference A keeps those treads dappled (box (0.62–0.8, 0.3–0.4) p50
 *   0.38, p90 0.48) while a fully carved column lit them flat (p50 0.49, p90 0.60), so this one is
 *   porous: half the laminae and 40 % of the cards stay in its air, the beam itself is unchanged.
 */
export const SHAFT_COLUMNS: ShaftColumn[] = [
  { point: [1.3, 6.6, -9.4], radius: 2.6 },
  { point: [-3.0, 8.0, -14.5], radius: 2.6 },
  { point: [5.0, 7.0, -17.0], radius: 2.6 },
  { point: [13.3, 10.0, -14.6], radius: 1.3, carve: 1.7 },
  { point: [9.6, 6.9, -6.6], radius: 1.3, carve: 1.7, porosity: 0.5, cardPorosity: 0.4 },
  { point: [20.4, 11.2, -12.8], radius: 1.3, carve: 1.7 },
];
