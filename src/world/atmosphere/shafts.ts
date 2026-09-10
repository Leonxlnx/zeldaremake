/**
 * God-ray shaft columns — owner: atmosphere/lighting agent.
 *
 * World air points whose sun line is a bold shaft: the composer's canopy-gap mask (postfx) is forced
 * open in a disc of `radius` around each column in the plane perpendicular to the sun, so the beam
 * is exactly where the trees system carved its shadow-map corridor rather than wherever the noise
 * field happens to open. The shadow map still decides whether the air is lit: a column with no
 * corridor through the canopy stays dark, so the F entries below are inert until the trees owner
 * opens the canopy on their sun lines.
 */
export interface ShaftColumn {
  /** a point in the air (m) on the column's axis; the axis runs along the sun direction */
  point: [number, number, number];
  /** disc radius (m) in the plane perpendicular to the sun */
  radius: number;
}

export const SHAFT_COLUMNS: ShaftColumn[] = [
  // mirrors SHAFT_AIR_POINTS / SHAFT_RADIUS in src/world/trees/index.ts (shots A/B, upper-left)
  { point: [1.3, 6.6, -9.4], radius: 2.6 },
  { point: [-3.0, 8.0, -14.5], radius: 2.6 },
  { point: [5.0, 7.0, -17.0], radius: 2.6 },
  // shot F (camera (-1.04, 1.7, 5.64) → (10.22, 0.95, -0.86), fov 46): the reference's shafts
  // enter at the top edge between x ≈ 0.15 and 0.35 and lean down-right to the stairs at mid-frame.
  // The view rays through (0.17, 0), (0.27, 0), (0.37, 0) at canopy height (6–8 m) give these axes;
  // their sun lines reach the ground at screen ≈ (0.5–0.65, 0.5). Requested corridors — see report.
  { point: [10.4, 8.0, -11.4], radius: 1.3 },
  { point: [7.7, 6.0, -4.4], radius: 1.3 },
  { point: [13.2, 8.0, -6.6], radius: 1.3 },
];
