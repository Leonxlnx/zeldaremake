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
 *   fork, and lands on the upper plateau at ≈ (26, 5.4, −8) — screen (0.53, 0.32) in F. The left
 *   column's own line ends on Saria's roof 1.6 m down-sun of its air point (1.4 m from the house
 *   axis); it is open above the roof.
 */
export const SHAFT_COLUMNS: ShaftColumn[] = [
  { point: [1.3, 6.6, -9.4], radius: 2.6 },
  { point: [-3.0, 8.0, -14.5], radius: 2.6 },
  { point: [5.0, 7.0, -17.0], radius: 2.6 },
  { point: [10.4, 8.0, -11.4], radius: 1.3, carve: 1.7 },
  { point: [9.6, 6.9, -6.6], radius: 1.3, carve: 1.7 },
  { point: [20.4, 11.2, -12.8], radius: 1.3, carve: 1.7 },
];
