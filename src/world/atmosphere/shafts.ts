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
 *
 * `gain` scales the in-scatter of the column's lit air. The narrow (≤ 1.5 m) columns are the four
 * shafts of shot F, seen 109° from the sun through 18–30 m of air at canopy height: the ray model
 * (back-scatter lobe 0.71×, phase 0.92 vs 1.44 for the sun-facing shot A, thinning aerosol above 8 m,
 * a single march step inside a 2.6 m disc) leaves them at ≈ 0.07 raw in-scatter against A's 0.12 —
 * invisible once the smear's contrast curve (pow 1.5) is applied — where the reference shows four
 * bold beams from the top edge down to the stairs. Measured in the ray buffer: ×2.6 only reached
 * A's faint level (cores ≈ 0.03 after the curve); ×7.5 gives cores ≈ 0.1, i.e. beams of the
 * reference's weight (F's top band 0.38 vs its 0.39 mean luminance). The wide plaza columns keep 1.
 */
import { Vector3, Vector4 } from 'three';
import type { SharedCanopyOpening } from '../system';
import { SHAFT_COLUMNS as TREE_SHAFT_COLUMNS } from '../trees/corridors';

export interface ShaftColumn {
  /** a point in the air (m) on the column's axis; the axis runs along the sun direction */
  point: [number, number, number];
  /** disc radius (m) in the plane perpendicular to the sun */
  radius: number;
  /** in-scatter multiplier of the lit air inside the disc (1 = a plain open column) */
  gain: number;
}

/** widest beam core (m); corridors carved wider than this still get a crisp central shaft */
const BEAM_RADIUS_MAX = 1.8;
/** columns narrower than this are the side-lit canopy-hole shafts of shot F */
const NARROW_RADIUS = 1.5;
const NARROW_GAIN = 7.5;

export const SHAFT_COLUMNS: ShaftColumn[] = TREE_SHAFT_COLUMNS.map((c) => ({
  point: [c.point[0], c.point[1], c.point[2]],
  radius: Math.min(c.radius, BEAM_RADIUS_MAX),
  gain: c.radius < NARROW_RADIUS ? NARROW_GAIN : 1,
}));

/** Stable uniform capacity; publication and diagnostic toggles never recompile the ray shader. */
export const CANOPY_BEAM_CAPACITY = 8;

/**
 * Only the upper flight currently needs a mask opening: its real sun corridor falls in the
 * noise field's 5% floor. The other published pools keep their existing air treatment. Gain is
 * local to this mask: it never enters the legacy column term that bypasses the lower-air fade.
 */
export function createCanopyOpeningMask(sunRight: Vector3, sunUp: Vector3) {
  const gaps = Array.from({ length: CANOPY_BEAM_CAPACITY }, () => new Vector4());
  const count = { value: 0 };
  let publishedCount = 0;
  let active: SharedCanopyOpening | undefined;
  return {
    gaps,
    count,
    update(openings: readonly SharedCanopyOpening[], enabled: boolean, gain: number) {
      publishedCount = openings.length;
      active = undefined;
      count.value = 0;
      for (const gap of gaps) gap.set(0, 0, 0, 0);
      const opening = enabled ? openings.find((o) => o.id === 'flight-top') : undefined;
      if (!opening || opening.radius <= 0 || !Number.isFinite(gain) || gain <= 0) return;
      const p = new Vector3(...opening.point);
      gaps[0].set(p.dot(sunRight), p.dot(sunUp), Math.min(1, opening.radius), gain);
      active = opening;
      count.value = 1;
    },
    audit() {
      return {
        publishedCount,
        capacity: CANOPY_BEAM_CAPACITY,
        activeCount: count.value,
        shadowGuard: 'inside-raw-shadow-map-and-lit',
        entries: active ? [{
          id: active.id, point: [...active.point], axis: [...active.axis],
          carveRadius: active.radius, carveBand: [...active.band],
          sunPlane: [gaps[0].x, gaps[0].y], radius: gaps[0].z, gain: gaps[0].w,
        }] : [],
      };
    },
  };
}
