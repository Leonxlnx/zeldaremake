/**
 * God-ray shaft columns — owner: atmosphere/lighting agent.
 *
 * World air points whose sun line is a bold shaft: the composer's canopy-gap mask (postfx) is forced
 * open in a disc of `radius` around each column in the plane perpendicular to the sun, so the beam
 * is exactly where the trees system carved its shadow-map corridor rather than wherever the noise
 * field happens to open. The shadow map still decides whether the air is lit: a column with no
 * corridor through the canopy stays dark.
 *
 * The column axes come from the trees system (`src/world/trees/corridors.ts`, data only) so the
 * beam discs and the carved canopy holes can never drift apart. The beam core is kept narrower than
 * the trees' 2.6 m A/B corridors (≤ 1.8 m): at the corridor width it reads as a slab, and those
 * columns stand in the centre of shot D where a wide disc washed the far band.
 */
import { SHAFT_COLUMNS as TREE_SHAFT_COLUMNS } from '../trees/corridors';

export interface ShaftColumn {
  /** a point in the air (m) on the column's axis; the axis runs along the sun direction */
  point: [number, number, number];
  /** disc radius (m) in the plane perpendicular to the sun */
  radius: number;
}

/** widest beam core (m); corridors carved wider than this still get a crisp central shaft */
const BEAM_RADIUS_MAX = 1.8;

export const SHAFT_COLUMNS: ShaftColumn[] = TREE_SHAFT_COLUMNS.map((c) => ({
  point: [c.point[0], c.point[1], c.point[2]],
  radius: Math.min(c.radius, BEAM_RADIUS_MAX),
}));
