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
 * The composer lays this fan over the marched in-scatter (postfx/shaders.ts RAY_BLUR_FRAG): the
 * march still decides how much lit air a pixel looks through (phase toward the sun, haze density,
 * the shadow map, the depth of the surface behind it), the fan decides where in that air the beams
 * are — the air under the fan keeps `floor` of its in-scatter and each beam ADDS `amp × gain` (times
 * the view's facing gain, cut by near surfaces) on its axis, so the beams never saturate the
 * envelope and the between-beam haze is the envelope's own level.
 *
 * Geometry measured on frames A (1 s) and D (56 s) at 640×360: luminance averaged along lines
 * leaning 26° down-right (x intercept `u` at the top edge) over y 0.02–0.20, stepped 0.01 in u —
 * the profile ACROSS the beams (guide overlays at 20 / 25 / 30° put the D hero beam's edges at
 * 25–27°, the same lean in A, C and F):
 *   frame D: 0.36–0.48 at u 0.05–0.10 (the near trunk on the left edge), a flat 0.51–0.52 at
 *   0.11–0.19, the hero beam 0.59–0.62 over u 0.22–0.29 (edges ≈ 0.01 wide, +0.10 over the haze
 *   to its left), a dip to 0.57 at 0.30, a narrow second beam 0.61 at 0.32, then 0.58 → 0.53 over
 *   0.33–0.49 and 0.55–0.60 at 0.50–0.55 (the arch gap's glow, not a beam);
 *   frame A: 0.50 at u 0.05–0.07, 0.46 at 0.11–0.12, 0.48 at 0.14–0.20, 0.50–0.51 at 0.21–0.23,
 *   0.49 at 0.25–0.26, 0.51–0.52 at 0.27–0.30, 0.47 at 0.32, 0.45 at 0.35–0.41, 0.46–0.47 at
 *   0.42–0.55 — the same hero band (0.21–0.30) at a quarter of D's contrast (+0.03–0.05), nothing
 *   at 0.175 or 0.465 beyond +0.02. So: one hero beam centred at u 0.255, 0.08 of the frame width
 *   between its half-maxima (extent 0.12 frame heights either side of the axis), a broad second
 *   band centred at 0.35 for D's 0.55–0.58 shoulder (0.31–0.45), and a faint companion at 0.465.
 * Where the fan shows is a matter of FACING: D's view axis is 64° from the sun and carries the
 * +0.10 beam; A's is 81° and its +0.04 bump is already what the marched plaza columns give it
 * (control render +0.057 at u 0.285 with no fan); B (75°) has a +0.05–0.09 lighter band over
 * u 0.12–0.39; C and F (> 125°) have none (F's bright top-left is sky through the crowns). The
 * march's Henyey–Greenstein phase (g 0.6) would still give A 61 % of D's fan, so the composer
 * fades the fan in with the view's angle to the sun over `facingDeg` (85 → 60°: D 0.94, B 0.36,
 * A 0.08, C/F 0). The beams dissolve by y ≈ 0.5–0.55 in both frames (the surfaces there are near;
 * the march's short columns already carry little in-scatter), so the fan blends back to 1 over
 * `fadeY`.
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
  /** in-scatter added on the hero beam's axis (≥ 10 m of air, fully sun-facing view) — see ComposerSettings.fanAmp */
  amp: 0.23,
  /** view-axis angle from the sun (degrees) where the fan starts to appear / is fully on — see ComposerSettings.fanFacingDeg */
  facingDeg: [85, 60] as [number, number],
  /** frame y (0 = top) where the fan starts fading out / where it has no effect */
  fadeY: [0.35, 0.6] as [number, number],
  beams: [
    { u: 0.255, halfWidth: 0.12, gain: 1.0 },
    { u: 0.35, halfWidth: 0.13, gain: 0.45 },
    { u: 0.465, halfWidth: 0.07, gain: 0.15 },
  ] as FanBeam[],
};
