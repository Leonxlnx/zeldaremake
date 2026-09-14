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

/**
 * The screen-anchored shaft fan (reference/ANALYSIS.md § 3 / § 7: the footage's beams enter from
 * the upper-left with the same screen geometry in every heading — SSW, SW, N, WNW, SE — so they are
 * a screen-space light-shaft pass, not the shadow sun, whose screen position swings from
 * (−2.7, −4.1) in shot A to (−0.5, −1.1) in shot D and behind the camera in C/F).
 *
 * The composer multiplies this fan into the marched in-scatter (postfx/shaders.ts RAY_BLUR_FRAG):
 * the march still decides how much lit air a pixel looks through (phase toward the sun, haze
 * density, the shadow map, the depth of the surface behind it), the fan decides where in that air
 * the beams are. Between the beams the air keeps `floor` of its in-scatter.
 *
 * Geometry measured on frames A (1 s) and D (56 s) at 320×180, luminance averaged along lines
 * leaning 25° down-right from the top edge (x intercept `u`), ±0.02 of the frame across:
 *   frame D, y 0–0.15: u 0.26–0.30 → 0.60–0.63 against 0.50–0.53 at u 0.14–0.18 (+0.10, the hero
 *   beam), a second lit band at u 0.33–0.40 (0.54–0.58) and a faint one at 0.44–0.50 (0.52–0.55);
 *   frame A, y 0.05–0.15: u 0.24–0.30 → 0.49–0.53 against 0.44–0.47 at u 0.12 and 0.40–0.43 at
 *   u 0.34–0.40 (+0.05), a soft band at u 0.15–0.22. Both frames read the same lines at the same
 *   lean (guide overlays at 20 / 25 / 30°: the D hero beam's edges run parallel to 25–27°), so one
 *   fan serves every heading; the D beams are brighter only because D looks 58° off the sun
 *   through the hollow's mist where A looks 76° off through thinner air — which is what the march
 *   already gives them.
 * Widths are half widths perpendicular to the beam in frame heights: the D hero beam is 0.06 of
 * the frame wide at the top edge (0.24–0.30) → 0.06 × 1280 × cos 25° ≈ 70 px → 0.049 frame heights
 * either side of its axis. The beams dissolve by y ≈ 0.5–0.55 in both frames (the surfaces there
 * are near; the march's short columns already carry little in-scatter), so the fan blends back to
 * 1 over `fadeY`.
 */
export interface FanBeam {
  /** x (uv) where the beam axis meets the top edge of the frame */
  u: number;
  /** extent of the beam's soft bump either side of its axis, in frame heights (half-max at half of it) */
  halfWidth: number;
  /** in-scatter multiplier added on the beam's axis (the beam's air reads floor + gain) */
  gain: number;
}

export const SCREEN_FAN = {
  /** lean of the beams from vertical, down-right, in degrees (measured on screen, not in uv) */
  leanDeg: 26,
  /** share of the marched in-scatter the air under the fan keeps (the beams are added on top) */
  floor: 0.75,
  /** in-scatter added on the hero beam's axis (fully marched column, view 90° from the sun) — see ComposerSettings.fanAmp */
  amp: 0.06,
  /** frame y (0 = top) where the fan starts fading out / where it has no effect */
  fadeY: [0.35, 0.6] as [number, number],
  beams: [
    { u: 0.175, halfWidth: 0.08, gain: 0.55 },
    { u: 0.27, halfWidth: 0.095, gain: 1.0 },
    { u: 0.365, halfWidth: 0.08, gain: 0.6 },
    { u: 0.465, halfWidth: 0.07, gain: 0.3 },
  ] as FanBeam[],
};
