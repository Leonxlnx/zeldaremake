/**
 * AUTHORED WORLD LAYOUT — the single source of truth for WHERE things are.
 *
 * Coordinates: metres, +Y up, +X east, -Z north (into the scene from the default camera).
 * The plaza where Link stands in reference shot B (frame ~14 s) is the origin.
 *
 * Reference shots (see reference/ANALYSIS.md and reference/frames/):
 *   A "stairs"   ~0–8 s   : long stone stairway climbing right/east to an upper ledge with fences;
 *                           lantern branch hanging over the path on the left; mist + shafts behind.
 *   B "house"    ~13–25 s : Kokiri tree-trunk house with mossy dome roof + glowing pod lanterns on
 *                           the right, wooden signpost, path leading north to a mossy boulder terrace.
 *   C "lookback" ~45–50 s : stairs now on the LEFT; Kokiri NPC on grass; giant tree in the distance.
 *   D "log"      ~55–60 s : short stair on the right, huge hollow log arch ahead in the mist, purple
 *                           flowers + mossy boulder in the left foreground.
 *   E "hold"     ~24 s    : the B camera held ten seconds later (same pose).
 *   F "up"       ~8 s     : eye level on the plaza looking dead up the stair axis; canopy fills the
 *                           top half, fence posts along the plateau lip, the upper house top-left.
 *
 * Any agent may READ this file. Only change values here when a reference comparison demands it and
 * record the change in your .agents/<agent>.md log — several systems depend on these numbers.
 */
import { Vector3 } from 'three';

export interface StairDef {
  id: string;
  /** world position of the centre of the bottom riser at ground level */
  base: [number, number, number];
  /** horizontal direction of ascent (normalised in code) */
  dir: [number, number];
  steps: number;
  rise: number;
  tread: number;
  width: number;
}

export interface HouseDef {
  id: string;
  /** centre of the trunk at terrace ground level */
  position: [number, number, number];
  trunkRadius: number;
  /** horizontal facing direction of the door */
  facing: [number, number];
  roofHeight: number;
  lanterns: number;
}

export interface GiantTreeDef {
  id: string;
  position: [number, number, number];
  trunkRadius: number;
  height: number;
  /** optional big near-horizontal limb: direction + length (used for the lantern branch) */
  limb?: { dir: [number, number]; length: number; height: number };
}

export interface Viewpoint {
  id: string;
  /** which reference frame (seconds into the video) this shot matches */
  refSeconds: number;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  /**
   * Diagnostic cameras (ground close-up, canopy look-up) do not share framing with their reference
   * frame; the frame is a material/lighting reference only. Image-similarity metrics must not be
   * computed or displayed for them — only A–D are matched compositions.
   */
  diagnostic?: boolean;
}

export interface FenceDef {
  id: string;
  points: readonly (readonly [number, number, number])[];
  style?: 'rail' | 'rope';
}

export interface LanternPostDef {
  id: string;
  /** foot of the post (y is sampled from the terrain) */
  position: [number, number];
  /** horizontal direction the hook reaches toward (the path) */
  facing: [number, number];
  /** post height to the bend (metres) */
  height: number;
  tint?: 'orange' | 'lime';
}

/**
 * Rope fences off the paving (the layout's `fences` are the plateau-lip rails). Placed against the
 * fixed cameras (gauntlet/tmp/proj.mjs): the plaza-west run projects outside A/B/D/E/F and off C's
 * right edge (x ≥ 1.09); the stair-bank run sits outside A (x ≥ 1.08), in F at (0.74–0.82,
 * 0.54–0.67) right of the kid spot (0.72, 0.67), and in C at (0.22–0.31, 0.49–0.58) behind the
 * stair-foot rock — clear of the stair foot (C 0.10–0.20, 0.60–0.66). Both keep ≥ 1 m from the
 * npc spots (kokiri-b (−6.5, −2): the west run starts at z = −0.9; kokiri-a (9.0, 3.6): the bank
 * run starts 1.4 m away).
 */
export const ROPE_FENCES: FenceDef[] = [
  // foot of the west bank, ~0.5 m off the plaza rim (paving ends at x ≈ −6 at z = 0)
  { id: 'plaza-west', style: 'rope', points: [[-6.6, 0, -0.9], [-6.75, 0, 1.3], [-6.3, 0, 2.7], [-5.9, 0, 3.9]] },
  // stair-side bank south of the stair foot, east of the stair-foot rock
  { id: 'stair-bank', style: 'rope', points: [[8.2, 0, 3.4], [9.0, 0, 2.7], [9.7, 0, 2.1]] },
];

/**
 * Placed against the fixed cameras (gauntlet/tmp/proj.mjs). The stair-foot post stands on the
 * right of the bottom risers: its pod projects to A (0.80, 0.38) — the reference's lit pod right
 * of the stairs at (0.83, 0.36) — and F (0.53, 0.35) (reference 0.52, 0.35); in C it is a thin
 * post at x ≈ 0.09, left of the stair foot. The fork post marks the junction of the spine and the
 * house path from the WEST verge: at the fork's inner corner (3, −4.2) a 2.6 m post would stand
 * 7 m from camera B at (0.57, 0.35) over the signpost and 5 m from camera C beside Link — neither
 * is in the footage — so it sits across the path on the west verge, off the paving, with its
 * hook reaching north along the path edge: outside B/C/D/E/F (B's left edge is at x ≈ −0.02)
 * and just inside A's left edge (pod ≈ (0.03, 0.4)), where the reference has a pod on a bent
 * stick.
 */
export const LANTERN_POSTS: LanternPostDef[] = [
  { id: 'stair-foot', position: [9.3, 1.6], facing: [-0.75, -0.66], height: 2.55, tint: 'orange' },
  { id: 'fork-west', position: [-2.6, -4.6], facing: [0.3, -1], height: 2.4, tint: 'orange' },
];

export const LAYOUT = {
  /** Main flagstone spine: south approach → plaza → north terrace → log arch. */
  // North of the plaza the spine bears slightly EAST (reference B recedes at x ≈ 0.3–0.6, on the
  // D axis), runs level through a misty hollow (reference D: mist pool before the arch) and then
  // climbs to the arch. Round 32: the rise beyond z −36 flattened — 3.35 → 3.75 → 4.3 m (was
  // 3.35 → 4.3 → 5.6): frame 56 s keeps the far ground line at a constant y ≈ 0.46–0.47 from 33 m
  // out to the arch's feet (a ground that climbs exactly as fast as it recedes: 3.4 m at 33 m,
  // 3.8 at 39, 4.3 at 47), and the arch, which stands on this ground, was 1.3 m too high (its
  // bark top at y 0.22–0.24 against the frame's 0.27–0.30). The raised boulder bank
  // (terraces.northTerrace) is WEST of the hollow.
  pathSpine: [
    [1, 0, 16],
    [0, 0, 8],
    [0, 0, 0],
    [0.6, 0, -6],
    [1.5, 0, -12],
    [2.0, -0.1, -18],
    [1.8, -0.13, -24],
    [2.5, 1.7, -30],
    [3.5, 3.35, -36],
    [4.5, 3.75, -42],
    [5.2, 4.3, -50],
    [5.8, 4.5, -58],
  ] as [number, number, number][],
  pathHalfWidth: 2.4,

  /** Branch from the plaza east to the foot of the main stairs. */
  pathToStairs: [
    [0, 0, 0],
    [3.0, 0, -0.3],
    [5.2, 0, -0.5],
    [6.6, 0, -0.5],
  ] as [number, number, number][],

  /**
   * The walk to Saria's door: ONE route from the north path — the `house-west` flight climbs from
   * the path's east verge to a landing at 1.62 m, and from the landing's east end this polyline
   * crosses the terrace lawn to the door (0.7 m short of the threshold), the ground easing from
   * the landing's 1.56 m to the terrace's 1.05. Isolated round stepping stones on level turf
   * (`houseSteppingStones()`), no paving. Round 32: until round 31 this was the plaza → door
   * stepping-stone ramp ((0.5, −2) → (4, −6.5) → (6.6, −8.6) → (9.6, −9.3)); frame 56 s puts the
   * flight exactly on that ramp's lower half, and the frame-14 s "stones climbing a grassy slope"
   * right of Link are, at 10–12 m from camera B, the flight's own south flank seen face-on (its
   * tread ends and cheek stones in the turf) — so the ramp's lower stones go, and the flight is
   * the rise. The heightfield flattens only a narrow strip (0.4 × pathHalfWidth) to this line:
   * the signpost (7, −9.3) stands 1.7 m south of it on its own ground.
   */
  pathToHouse: [
    // two verge stones beside the north path's paved edge (frame 14 s: the stones right of Link's
    // feet), on the flat strip between the plaza's paving (x ≤ 3.3 at z −4.5) and the toe of the
    // flight's south bank (x ≥ 3.5 there; a disc needs < 0.28 m of ground span)
    [3.45, 0, -4.2],
    [3.0, 0, -5.2],
    // the paved apron in front of the first riser (0.27 m up from the path — a kerb the height of
    // one riser, so the apron is the flight's wide first tread: frame 56 s' pale flat stone at
    // y 0.72–0.80 under the lit nosings), then the flight's foot, head and landing end (layout
    // stairs 'house-west'; no stones over the apron / flight / landing: `skip`)
    [3.05, 0.22, -8.27],
    [3.8, 0.27, -8.0],
    [5.68, 1.62, -7.32],
    [6.48, 1.56, -7.03],
    // across the lawn to the door, the ground easing 0.5 m down to the terrace
    [8.3, 1.3, -7.6],
    [9.6, 1.05, -9.3],
  ] as [number, number, number][],
  /**
   * stepping stones along `pathToHouse`: first stone `from` metres in; none over `skip` (metres
   * along the line: from 1.9 m (a third verge stone would fall on the apron's south-west corner)
   * over the apron (front edge d 4.4), the flight and its landing slabs to the landing's end
   * (d 8.0) — the stones resume 0.2 m past the landing; 2 verge + 4 lawn stones)
   */
  // reference stones read 0.8-1.0 m across and nearly touching, with a trodden strip between
  // (hardscape 7c measured ours at 0.7-1.0 m with 1.3 m of grass between): larger, closer discs.
  // spacing x min jitter 0.88 = 0.88 m > 2 x 0.44 so neighbours never overlap.
  steppingStones: { from: 0.15, spacing: 1.0, radius: [0.4, 0.44] as [number, number], wobble: 0.22, skip: [1.9, 8.25] as [number, number] },

  stairs: [
    // The hero stairway of shot A — 18 wide, worn, moss-edged steps climbing to the east plateau.
    // In reference frame 1 the run reads almost radial from the camera (bottom centre x ≈ 0.71,
    // top ≈ 0.74, base ≈ 17 m away), so it runs at bearing ≈ 55° — only ~16° off camera A's
    // ray — rather than due east, and its base sits 13.7 m from the camera. The plateau ramp
    // follows this frame, so W04's probe at (18, -4) must stay on the 5.4 m top.
    // 20 × 0.27 m (was 18 × 0.30): the player controller's step guard is 0.28 m and Astra's whole-leg
    // study found shin/riser intersections above it, so the flight climbs the same 5.4 m in twenty
    // child-scale risers (W02 allows 16–20; the top moves 0.84 m along the run, A/F projections hold).
    // Re-laid to the nosing fit of frames 1 s and 8 s (20 risers, rms <= 0.6 px): the foot moves
    // ~2.5 m toward the plaza and the treads deepen to 0.54 m (slope 26.6 deg, was 32.7) so the flight
    // converges like the reference's (depth ratio 1.8 vs 1.5). Bearing 52 deg; the W04 probe at
    // (18, -4) sits 0.1 m past the top tread (run 10.8 m); the reference run is ~12.4 m, which the probe
    // forbids (RUBRIC_PROPOSALS 2026-09-12).
    { id: 'main', base: [7.3, 0, -0.1], dir: [1, -0.78], steps: 20, rise: 0.27, tread: 0.54, width: 3.0 },
    // Round 32: the `north` steps are gone — a 7 × 0.26 × 0.5 m flight at base (−0.9, 0, −16),
    // bearing 217°, climbing WEST off the north path onto the boulder bank. Its frame-14 s
    // justification ("steps at (0.20–0.25, 0.33–0.40)") does not survive a 3× crop (a far warm
    // lantern point and a door-like warm shape 15–20 m away, no risers), and in frame 56 s the
    // flight stood at D (0.34–0.46, 0.60–0.70) — 13–15 m away, three lit risers — where the frame
    // has the misty hollow's pale open ground (D (0.28–0.40, 0.48–0.62): frame lum p50 0.464,
    // edge energy 0.026; ours with the flight 0.310 / 0.046). The boulder bank (terraces
    // .northTerrace) stays as a grassy slope; its W04 probe (−11, 0) is the west ledge, untouched.
    // The flight of frame 56 s' right edge: worn slabs climbing from the north path's east verge to
    // Saria's lawn. Round 32 re-laid it to the frame — a numeric fit of the four lit nosing chains
    // the frame shows (ridge-tracked at 1280 wide: x 0.855–0.995, y 0.50–0.70, slopes 0.60 / 0.43
    // / 0.39 / 0.10 down to the right, their visible left ends on a 45° line (0.855, 0.62) →
    // (0.955, 0.50)) and the pale paved apron under them at y 0.70–0.79 (gauntlet/tmp/fit5,
    // fit12–fit15.mjs). What the fit says: (1) the run climbs ACROSS camera D's view at bearing
    // 110° — the nosings run within 30° of the view ray, so they recede steeply down to the
    // right (the frame's 0.60 on the lowest full chain; ours 0.55) and the riser faces look
    // WNW at the camera; bearings 60–80° run the landing into the signpost (7, −9.3), which
    // must stay ≥ 0.7 m off the treads, and bearings ≤ 95° flatten the nosings to 0.3 — a
    // flight whose ridges hit the frame's four y values at x 0.995 within 0.008 but at those
    // slopes scored 0.22 in D's lower-right 256×144 SSIM cell (8-px windows) against 0.41 for
    // this orientation with the ridges 0.01 low (gauntlet/tmp/ssimfine.mjs); every nosing's
    // near end leaves the frame right (k1 at x 0.99, k2 1.06, k3 1.13, k4 1.21); (2) 0.27 m
    // risers 5.0–5.3 m (z-depth) from the camera (0.21 m risers read 30–40 px against the
    // frame's 40–53); (3) the frame's lit ridges sit at y 0.703 / 0.626 / 0.560 / 0.504 at
    // x 0.995 (≈ 0.8 / 1.1 / 1.35 / 1.6 m above the path) and its pale flat apron at y 0.72–0.79
    // — so the apron is paved a full riser up (base y 0.27: the apron is the flight's wide first
    // tread, its kerb face at y 0.78–0.85 behind the minimap) and five 0.27 m risers reach a
    // 1.62 m landing: nosings 0.54 / 0.81 / 1.08 / 1.35 / 1.62 m. Cost: the 1.05 m terrace and
    // the sign's 0.67 m pad are 0.5–0.9 m below the landing — the lawn falls 0.5 m over 3.7 m to
    // the door and the north verge is a 50° earth face — and frames B / E get the landing's edge
    // at eye level (y 0.50). Foot 0.3–0.6 m off the paved edge 6.2 m from camera D at bearing
    // 36°, running ESE 2.0 m to the head (5.68, −7.32); one row of landing slabs to (6.48,
    // −7.03), where `pathToHouse` takes over across the lawn. Round-31 position for reference:
    // base (3.95, −10.85), bearing 82°, 5 × 0.21 × 0.55 — 8.2 m from D at x 0.67–0.94 with 23–32
    // px risers, and Saria's buttress root #5 (6.03, −11.27) on its fourth tread (now 2.7 m
    // beyond the north tread ends). Projections (fit15 describe): D nosings k0 (0.82, 0.695)–
    // (0.92, 0.78) — its lit tread is the frame's pale apron — k1 (0.865, 0.65)–(0.985, 0.71),
    // k2 (0.91, 0.60)–(1.06, 0.64), k3 (0.95, 0.555)–(1.13, 0.57), k4 (1.00, 0.506)–(1.21, 0.49);
    // slopes 0.55 / 0.27 / 0.06 / −0.09; far ends on the line (0.865, 0.65) → (1.00, 0.51)
    // (slope −1.0, frame −1.2). B/E x 0.51–0.71, y 0.50–0.67 at 9.8–12 m — the south flank
    // face-on, the risers edge-on, the landing's top edge at (0.65, 0.50) behind the signpost
    // (x 0.64); A (0.36–0.48, 0.46–0.55) at 16–19 m; behind C and F. The signpost stands at the
    // flight's local u 2.56 / v −2.32: 1.1 m beyond the NORTH tread ends beside the top step, on
    // the short north verge (heightfield HOUSE_WEST_BANK.northVerge). The paved apron laps the
    // first riser (frame 56 s: the pale slab under the flight); the south flank above that is
    // the grassy rise B / E look at.
    { id: 'house-west', base: [3.8, 0.27, -8.0], dir: [0.9397, 0.342], steps: 5, rise: 0.27, tread: 0.4, width: 2.4 },
  ] as StairDef[],

  /** Terraces / plateaus that the heightfield honours (soft-edged). */
  terraces: {
    eastPlateau: { height: 5.4 },
    westLedge: { height: 2.6 },
    // 1.05: reference B/E show the door threshold ~0.9 m above the plaza at the top of a grassy
    // stepping-stone slope; W04's probe at (9, -12.5) allows 1.2 ± 0.35 and the house pad plus
    // erosion read ~0.12 below the authored height there (0.9 measured 0.777), so 1.05 keeps the
    // probe at ≈ 0.93 (proposal filed for 0.4)
    houseTerrace: { height: 1.05 },
    /** the boulder bank west of the north path (a grassy slope since round 32; terrace-boulder sits on it) */
    northTerrace: { height: 2.6 },
  },

  houses: [
    { id: 'saria', position: [12.5, 1.05, -11.5], trunkRadius: 3.2, facing: [-0.7, 0.72], roofHeight: 6.5, lanterns: 3 },
    // On the plateau north of the fenced lip: reference F shows a second, smaller tree-house at the
    // top-left of the stairs (0.13–0.25, 0.13–0.20), ~24 m from camera F; projects to A (0.53, 0.18)
    // and the top-right corner of D, both hazed.
    { id: 'upper', position: [13.5, 5.4, -17.5], trunkRadius: 2.7, facing: [-0.7, 0.7], roofHeight: 5.0, lanterns: 2 },
  ] as HouseDef[],

  signposts: [
    // projects to x ≈ 0.58 in shot B, where the reference frame 14 has the sign left of the door
    { id: 'saria-sign', position: [7.0, 1.2, -9.3] as [number, number, number], facing: [-0.6, 0.8] as [number, number] },
  ],

  /** Wooden fence lines (post-and-rail) along the east plateau edge, as seen at the top of the stairs. */
  fences: [
    // Both runs follow the plateau lip (perpendicular to the stair run, ~0.5 m inside the top edge).
    { id: 'plateau-west', points: [[18.2, 5.4, -5.5], [21.6, 5.4, -0.6], [23.3, 5.4, 1.9]] as [number, number, number][] },
    { id: 'plateau-north', points: [[18.0, 5.4, -10.3], [18.8, 5.4, -12.8], [20.2, 5.4, -15.4]] as [number, number, number][] },
  ],

  /** Big branch hanging over the path with 3 glowing pod lanterns (left side of shot A). */
  lanternBranch: {
    // Projected into shot A this runs in from the left edge at y ≈ 0.15–0.3 and ends near
    // (0.26, 0.39) with pods hanging around (0.1, 0.45) — the reference bough — while staying in
    // the upper quarter of shot B (reference B has the giant's limb over the house there).
    // `from` marks where the visible, lantern-bearing part of the limb begins (the giant builder
    // grows the limb from the trunk to it); the midpoint must project inside shot A for W01.
    // The bough itself rides high (y ≈ 0.15–0.3 in A, mostly above shot B's frame); the pods
    // hang on long cords to the reference's y ≈ 0.45.
    // Round 37 (measured against frame 1 s, column scan of the dark band): the bough's top edge is
    // at y 0.31 (x 0–0.10) → 0.33 (x 0.22), underside ≈ 0.375, centre ≈ 0.345 → 0.36, ≈ 0.06 of
    // the frame thick at the left edge, gone by x ≈ 0.27–0.30; luminance 0.27–0.33 (ours read
    // 0.45–0.55 at 11–12 m). Its two pods are small — glow cores 0.005 wide, whole pods ≈ 0.013
    // (0.12–0.15 m at 6.5 m) — at (0.208, 0.405) and (0.255, 0.39), right under the bough. Frame
    // 14 s (shot B) has no pod and no pale limb in its upper-left: a pod on those A rays is inside
    // B's frame unless it is ≤ 6.7 m from camera A (within 0.8 m of camera B's eye along its axis,
    // 0.5 m above it), so the run sits on z = 1.5, level at 2.2 m, heading east, 5.8–6.9 m from A:
    // from → A (0.01, 0.345), to → A (0.28, 0.36); the limb leaves the giant's bole at
    // `limb.height` and droops onto `from` (trees/index.ts LANTERN_LIMB). Before: (−4, 4.25, −5) →
    // (1.5, 3.25, −2.6) at 11–12 m, A y 0.20–0.27, pods at (0.07 / 0.16 / 0.25, 0.36–0.38) and in
    // B at (0.03 / 0.21 / 0.40, 0.31–0.35) under the limb across B's top.
    from: [-1.25, 2.22, 1.5] as [number, number, number],
    to: [1.06, 2.21, 1.5] as [number, number, number],
    /** limb radius at `from` / at `to` (metres): 0.06 × 0.849 × 5.8 m ≈ 0.30 m thick at A's left edge */
    radius: 0.15,
    tipRadius: 0.07,
    lanterns: 3,
  },

  logArch: {
    /**
     * Giant hollow fallen log lying roughly east-west across the north path, the far landmark of
     * shot D. In frame 56 s it spans x 0.39–0.73 (luminance edge scan at 2× in the y 0.30–0.42
     * band) and y 0.27–0.45 with its feet ≈ 2 m above the camera, on ground ≈ 5.6 m above the
     * plaza (body ≈ 6 m thick, opening ≈ 4 m).
     * Layout round 6: the previous (5.6, −50) r 3.0 L 22 yaw 20 projected its bark to x 0.28–0.66
     * in D (visible 0.34–0.63 behind the terrace boulder); the frame's arch is centred right of
     * the path and its right mass is the big one. Solved by projecting the built bark mesh into
     * camera D over a grid of centre/length/yaw/radius: centre 4.5 m east of the path spine,
     * 4 m further, r 3.4 (W29's "radius ≈ 3.4 m"), east end swung toward the camera (yaw −16) so
     * the right end reads large: bark spans x 0.37–0.73 (0.37 is the splintered west lip; the
     * left edge cannot reach 0.39 without shortening the log until the path's underside clearance
     * drops below 1.9 m). Nearest bark 45.7 m (was 37.5), farthest 56.5 m. The path spine crosses
     * under the west half: centre line at lu −3.4 … −4.8 with 2.1–2.2 m under the bark ridges
     * (was 2.5–2.9 m at lu ≈ 0); over the paved width (±1.8 m) the lowest bark is 1.76 m at the
     * west edge and 2.43 m at the east edge, 1.68 m on the west verge (−2.4 m) where the west
     * third sinks toward its footing; the two west-end roots that pointed at the paving are left
     * out (logArch.ts). Visible in D the bark reads x 0.37–0.63: 0.63–0.73 is hidden by the
     * east plateau ramp at 19–22 m and the north-east giant / a white-bark at 25–37 m (terrain
     * and trees, not the arch).
     * Round 32: the ground under the log lowered 5.6 → 4.3 m (pathSpine z −42…−58 and the
     * heightfield's north rise; logArch.ts seats the axis on the terrain at its ends, so the
     * whole log, its roots and its lanterns follow). Pinhole projection into D, axis ± r plus
     * the moss crown: the body's centre line at the spine crossing moves from y 0.31 to 0.34
     * (frame 56 s: 0.335), the crown's top from 0.225 to 0.25, the belly from 0.385 to 0.42, the
     * far ground line stays at 0.47 (frame 0.46). What the ground cannot fix (structures): the
     * frame's log is a straight tapering trunk — 3.9 m thick at the west body (x 0.47–0.50,
     * y 0.29–0.375), 1.5 m at the east (x 0.60–0.62, y 0.33–0.35), a level axis at y 0.33–0.34,
     * a 4 m opening (y 0.375–0.46), the west root mass 3.7 × 8.8 m (x 0.39–0.47, y 0.27–0.46) —
     * where ours is a 6.8 m cylinder bowed 4.1 m up in the middle.
     */
    position: [9.75, 4.3, -54] as [number, number, number],
    radius: 3.4,
    length: 23,
    yawDeg: -16,
    lanterns: 2,
  },

  /**
   * Mossy boulders that are compositionally important (many smaller rocks are procedural).
   * `radius` is the rock the rocks system builds; `clearRadius` (default `radius`) is the radius
   * the vegetation's boulder rules read (field.ts `clearing` / `boulderDistance`, plants.ts ring
   * clusters), kept separate so a rock can be resized without re-drawing every plant scatter that
   * rejection-samples around it.
   */
  heroBoulders: [
    // on the boulder bank, clear of the north steps' landing (top of the 7 steps ≈ (−3.0, 1.8, −18.8)).
    // Layout round 6: moved 9.8 m west along the bank, from (−5.2, −20.2) where it filled shot D's
    // upper-left (x 0.09–0.34, y 0.25–0.46 at 13.7 m — frame 56 s has bright hazed canopy and
    // no rock there) and cut the left edges of A (x 0–0.13) and B/E (x 0–0.18), where the frames
    // have no rock either. At (−15, −20) its 2.9 m lumped envelope projects to D x ≤ −0.04,
    // A x ≤ −0.21, B/E x ≤ −0.23, behind C and F: in no hero view. Ground 2.76 m (bank 2.6 +
    // undulation); 12 m from the north steps' top tread; 11 m from the nearest giant trunk.
    { id: 'terrace-boulder', position: [-15, 2.6, -20] as [number, number, number], radius: 2.2 },
    // left-centre of shot D (reference 0.10–0.22, 0.66–0.75), just off the paved edge and clear of
    // the north-west-near giant's roots.
    // Layout round 6: r 0.9 → 0.6 (frame 56 s: a loaf ≈ 1.3 m wide, 0.09 of the frame tall at
    // 7 m; r 0.9 read 0.159 even squashed to 0.42). The vegetation keeps its 0.9 m exclusion
    // (`clearRadius`): at 0.6 the 'white-flowers-west-verge' scatter accepted candidates in the
    // 0.57–1.15 m ring that whiteGround() had rejected, its stream shifted, and a white clump
    // landed within 0.45 m of the lawn band's second authored "mossy stone" spot (−3.05, −8.7),
    // which then failed all 24 tries (plants.test.mjs: mossy stones 2 < 3).
    { id: 'shot-d-boulder', position: [-2.6, 0, -9.6] as [number, number, number], radius: 0.6, clearRadius: 0.9 },
    // right edge of shot A (≈ 0.9, 0.7): the mossy rock the Kokiri kid stands beside
    { id: 'stair-foot', position: [9.1, 0.2, 2.5] as [number, number, number], radius: 1.0 },
  ] as { id: string; position: [number, number, number]; radius: number; clearRadius?: number }[],

  /** Giant old trees. Canopies of these form the overhead cover (14–24 m). */
  giantTrees: [
    // limb: the lantern bough leaves the bole `height` m up (local) and droops onto
    // `lanternBranch.from`, 13.5 m to the ESE (`dir`/`length` are descriptive here; the run is
    // authored by `lanternBranch`, see trees/index.ts LANTERN_LIMB)
    { id: 'lantern-tree', position: [-11.5, 2.6, -7.2], trunkRadius: 1.7, height: 26, limb: { dir: [0.83, 0.56], length: 13.5, height: 2.6 } },
    { id: 'plateau-oak', position: [19, 5.4, -21], trunkRadius: 1.5, height: 24 },
    { id: 'southwest-giant', position: [-23, 2.6, 9], trunkRadius: 1.9, height: 28 },
    { id: 'east-giant', position: [27, 5.4, 5], trunkRadius: 1.4, height: 24 },
    { id: 'north-west', position: [-13, 1.9, -33], trunkRadius: 1.3, height: 22 },
    { id: 'north-east', position: [15, 2.0, -37], trunkRadius: 1.5, height: 24 },
    { id: 'far-plateau', position: [31, 5.4, -30], trunkRadius: 1.7, height: 26 },
    { id: 'south-giant', position: [12, 0, 22], trunkRadius: 1.4, height: 23 },
    { id: 'south-centre', position: [-4.5, 0, 27], trunkRadius: 1.8, height: 27 },
    // Reference C: a hazed giant trunk fills the centre-top (0.50–0.62, 0–0.35) ~30 m from the
    // camera with a Y-fork of spreading limbs (trees GIANT_PROFILES); projects to x ≈ 0.56 at
    // 30 m, behind every other camera, 4.5 m past the south end of the spine.
    { id: 'plaza-south', position: [4.4, 0, 20.5], trunkRadius: 2.2, height: 26 },
    // Reference B/D/A: a big dark trunk cuts the LEFT edge (B 0.0–0.10, D 0.0–0.12, A behind the
    // pods). Between the north path and the boulder bank, 6 m west of the spine.
    // Trees round 31: 1 m further west (was (−5.0, −12.8)). Camera D framed its bole at x
    // 0.02–0.12 (9 m) behind the emergent column at the frame's left edge; with the emergent
    // narrowed to x ≤ 0.09 the bole strip at 0.09–0.12 would have stood where frame 56 s shows
    // the hazed clearing and the D boulder. At (−6.0, −12.8) the bole projects to D x −0.08…0.07
    // (hidden behind the emergent), B −0.09, A −0.06; its authored shade lobes (trees
    // CANOPY_BOUGHS) are world points and do not move.
    { id: 'north-west-near', position: [-6.0, 0, -12.8], trunkRadius: 1.1, height: 24 },
    // Reference F: a big dark trunk cuts the RIGHT edge (0.9–1.0, top down to the bank at y ≈ 0.7)
    // 8–9 m from the camera at the south foot of the stair-side bank; 6.9 m off the paved east
    // lobe, behind B/D/E, beyond A's right edge, a hazed column at x ≈ 0.32 in C's background
    // (the reference C shows a trunk behind the kid there). Profile: trees GIANT_PROFILES.
    { id: 'stair-bank-giant', position: [10.6, 0, 9.15], trunkRadius: 1.1, height: 21 },
  ] as GiantTreeDef[],

  /** Where the Kokiri kids / Link will stand later (Phase 2). Used now only to keep clear ground. */
  npcSpots: [
    { id: 'link-spawn', position: [0, 0, 0.5] as [number, number, number] },
    // grass verge in front of the stair-foot rock: right edge of A at 8 m (the layout spot behind the
    // rock was hidden by it); the character system marches F's own spot
    { id: 'kokiri-a', position: [9.0, 0, 3.6] as [number, number, number] },
    // west lawn, out of A/C/D/F; the character system marches B/E's left-edge spot itself
    { id: 'kokiri-b', position: [-6.5, 0, -2] as [number, number, number] },
  ],

  viewpoints: [
    // Level aim at bearing 23.5° (the reference camera is not pitched): stair run at x ≈ 0.68–0.76,
    // base y ≈ 0.66, top y ≈ 0.29; pods around x ≈ 0.15–0.3, y ≈ 0.45.
    // Eye height 1.45 m: Link (1.25 m) spans y 0.56–0.88 at 4.6 m in the reference, which only a
    // camera at ≈ 1.45 m gives with his feet at 0.88; the stair foot/top move to 0.63 / 0.26.
    // Eye 1.8 m pitched 3.3 deg down: the only Link-consistent camera under which the 20 x 0.27 m
    // flight reproduces the reference foot (0.695, 0.612), top (0.755, 0.220) and mid-flight nosings
    // (<= 0.01 uv). A level 1.45 m eye would need a 7.5 m flight. Heading unchanged.
    { id: 'A_stairs', refSeconds: 1, label: 'The Stairs', position: [0.4, 1.8, 8.6], target: [6.7, 0.89, -5.8], fov: 46 },
    // Projected: house 0.68–0.88 with the door at (0.78, 0.48) ≈ reference (0.80, 0.50); sign 0.66; small steps 0.19.
    { id: 'B_house', refSeconds: 14, label: "Saria's House", position: [0, 1.5, 2.0], target: [5, 1.7, -12], fov: 46 },
    // Looking back SSE across the plaza with the stair foot cutting the left edge (0.12, 0.67;
    // reference 0.10–0.20, 0.60–0.66), the stair-foot rock at (0.28, 0.50) and the plaza-south
    // giant's trunk at x ≈ 0.58 in the haze (reference 0.50–0.62). Pitched ≈ 3.5° down.
    { id: 'C_lookback', refSeconds: 46, label: 'Look Back', position: [2.33, 1.45, -7.67], target: [4.03, 0.65, 5.23], fov: 46 },
    // Stands 2 m past the bough's tip so the pods stay behind the camera; the house stair then
    // sits at the right edge (x ≈ 0.9) as in the reference.
    // On the spine's axis so the flagstones fill the whole foreground as in the reference.
    { id: 'D_log', refSeconds: 56, label: 'The Log Arch', position: [0.2, 1.45, -3.0], target: [4.5, 2.75, -42], fov: 48 },
    // Frame 24 s is the same held camera as frame 14 s ten seconds later (Link has walked on):
    // identical pose so the two captures bracket the B composition.
    { id: 'E_ground', refSeconds: 24, label: "Saria's House (hold)", position: [0, 1.5, 2.0], target: [5, 1.7, -12], fov: 46 },
    // Frame 8 s: eye level on the plaza, dead along the stair axis 12.6 m before the bottom riser,
    // pitched 3.3° down — stair foot (0.42, 0.59) / top (0.42, 0.21) vs reference (0.42, 0.60) /
    // (0.42, 0.22); kid spot (0.66, 0.46); plateau-west fence posts along y ≈ 0.19; the upper house
    // roof at the top-left (0.14, 0.04–0.2). The canopy fills the top half.
    // Frame 8 s: the flight recedes 25 deg LEFT of the view axis (foot (0.365, 0.595), top (0.27, 0.213)),
    // not dead-on; eye 1.8 m, 3.9 deg down, heading 77 deg. Stair-bank giant at the right edge (x 0.97).
    { id: 'F_canopy', refSeconds: 8, label: 'Up the Stairs', position: [-1.96, 1.8, 4.0], target: [9.7, 0.98, 1.31], fov: 46 },
  ] as Viewpoint[],
} as const;

export type Layout = typeof LAYOUT;

export function v3(a: readonly [number, number, number]): Vector3 {
  return new Vector3(a[0], a[1], a[2]);
}

export function getViewpoint(id: string): Viewpoint | undefined {
  return LAYOUT.viewpoints.find((v) => v.id === id);
}

export interface SteppingStone {
  x: number;
  /** ground height of the path at the stone (the stone top sits a few cm above) */
  y: number;
  z: number;
  /** radius (m) */
  r: number;
}

/**
 * Deterministic stepping stones along `pathToHouse` (terrain paves exactly these discs; hardscape
 * builds a slab per disc; vegetation keeps grass off them). Stones start `from` metres along the
 * polyline, every `spacing` m (±12 %), zig-zagging ±`wobble` m across the line like the footage's
 * loosely laid slabs, and run to the polyline end (0.7 m short of the door). No stone falls in
 * the `skip` interval (the house-west flight and its paved apron / landing): a stone due there
 * is moved to 0.2 m past the interval's end and the spacing continues from it.
 */
export function houseSteppingStones(): SteppingStone[] {
  const pts = LAYOUT.pathToHouse;
  const { from, spacing, radius, wobble, skip } = LAYOUT.steppingStones;
  const segs: { ax: number; ay: number; az: number; dx: number; dy: number; dz: number; len: number }[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i];
    const [bx, by, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    segs.push({ ax, ay, az, dx: (bx - ax) / len, dy: (by - ay) / len, dz: (bz - az) / len, len });
    total += len;
  }
  const hash = (n: number) => {
    // small integer hash → [0, 1); keeps the layout free of the world PRNG
    let h = (n * 374761393 + 668265263) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const out: SteppingStone[] = [];
  let d = from;
  for (let i = 0; d < total - 0.2 && i < 64; i++) {
    if (d >= skip[0] && d < skip[1]) d = skip[1] + 0.2;
    let rem = d;
    let k = 0;
    while (k < segs.length - 1 && rem > segs[k].len) rem -= segs[k++].len;
    const sg = segs[k];
    const side = (i % 2 === 0 ? 1 : -1) * wobble * (0.6 + 0.4 * hash(i * 3 + 1));
    out.push({
      x: sg.ax + sg.dx * rem - sg.dz * side,
      y: sg.ay + sg.dy * rem,
      z: sg.az + sg.dz * rem + sg.dx * side,
      r: radius[0] + (radius[1] - radius[0]) * hash(i * 3 + 2),
    });
    d += spacing * (0.88 + 0.24 * hash(i * 3));
  }
  return out;
}
