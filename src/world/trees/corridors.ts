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

/**
 * A canopy opening: a cylinder of sun rays standing on a ground pool, cleared of giant foliage
 * within a world height band and ringed by a dense leaf collar (see CANOPY_OPENINGS).
 */
export interface CanopyOpening {
  /** ground centre of the sun pool (world x, z); the ground height is looked up */
  point: [number, number];
  /** cylinder radius (m) in the plane perpendicular to the sun — half the pool's width */
  radius: number;
  /** world height band [yMin, yMax] (m) of the cylinder that is cleared */
  band: [number, number];
  /** share of giant laminae / cluster cards kept inside (default none) */
  porosity?: number;
  cardPorosity?: number;
  /** width (m) of the dense collar around the cylinder (default CANOPY_OPENING_COLLAR) */
  collar?: number;
  /** extra card density in the collar, × the lobe's own (default CANOPY_OPENING_DENSIFY; 0 = none) */
  densify?: number;
  /** stable semantic id for cross-system consumers (atmosphere selects openings by id, not index) */
  id?: string;
  /**
   * also carves the corridor-exempt authored lobes (trees index.ts CanopyLobe `corridors: false`
   * — the plaza-shade clumps), which every other opening leaves whole. For an opening whose whole
   * point is to take an authored caster off the paving the frames light.
   */
  hard?: boolean;
}
export const CANOPY_OPENING_COLLAR = 1.8;
export const CANOPY_OPENING_DENSIFY = 2.5;

/**
 * Canopy openings (round 14, for the lighting owner): clustered gaps in the crowns over the plaza
 * and the hero flight, so the sun's shadow map paints a dapple of 1–3 m sun pools on the paving
 * (frame 1 s: pools ≈ 1–2 m across over ≈ 40 % of the plaza; board 02: ≈ 50 % lit in soft-edged
 * patches) instead of an even shade or an even sheet of light. Each entry is the GROUND pool: its
 * sun line (azimuth −128°, elevation 38° — a caster at height Y shades (x + 1.008 Y, z + 0.787 Y),
 * so the occluder of a pool at (x, z) stands at (x − 1.008 Y, z − 0.787 Y)) is cleared of giant
 * laminae and cluster cards between `band[0]` and `band[1]`, and the annulus `collar` wide around
 * it is packed with extra cards (giant.ts, GiantOptions.densify), so two neighbouring pools are
 * separated by solid leaf shade rather than a thin spot. The atmosphere's shafts may read the same
 * table (the openings are where the god rays can fall). Data only — no three.js imports.
 *
 * What stands on the sun rays (a top-down sun-on/off map of the paving, 10 cm cells, and 6° sun
 * probes off the round-14 control):
 * - plaza disc, east half (x ≥ 0, z ≥ 0): one lit sheet — shot A's plaza box 99.5 % sunlit, the
 *   few blockers 10–20 m up (the lantern tree's crown edge and the F-bank lines' survivors) — no
 *   canopy to cut a gap in. The casters are added first: the lantern tree's plaza-roof lobes
 *   (trees CANOPY_BOUGHS) at 12.5 m, whose shadows frame the box — the strip west of it (the
 *   reference's dark left edge of A) and the path mouth north of it (F's dark left edge) — while
 *   the box itself, lit in both reference frames, is listed here as the big pool so the lobes'
 *   rims facing it are packed by the collars.
 * - plaza disc, west third (x ≤ −1): 0–50 % open with the blockers 5–10 m up — the lantern limb's
 *   own lobes and the sheared bole, wood and hero foliage that stay. No opening there.
 * - the path north of the plaza (z −1 … −6.5): 35 % lit already, in 1–3 m pools between the
 *   lantern limb's shadow band ((0.3, −1.7) → (4.8, 0)) and the emergent column's bole stripe
 *   ((−2.7 + 1.008 h, −7.9 + 0.787 h)) — dapple from wood, left as it is; its biggest pool is
 *   listed so the shaft mask knows it.
 * - hero flight: the lower and middle run one 7.4 m sheet of sun, the top run dark; the blockers
 *   12–14 m above the treads are the round-7c stair-shade lobes of the north-west-near giant
 *   ((−0.6, 16.2, −13.7) and (2.6, 16.4, −14.4), hR 2.4, density 0.6). The top opening is cut
 *   through the second; the shade between the flight's three pools comes from two small dense
 *   lobes of a new north-west-near bough (CANOPY_BOUGHS "flight roof").
 * - east lobe of the plaza (x 6–8.5, z −2 … 2): 41 % lit in 0.7–1.4 m pools between the lantern
 *   limb's tail (≈ (6.5, 0.5)) and the emergent bole's stripe — wood dapple, left as it is; the
 *   stair-foot pool (5.7, 0.7) at its west edge is the one listed (59 % lit after the cut, the
 *   pool at (7.3, 0.7) 1.9 m).
 * Every band starts at 10 m or higher: the lantern limb's lobes 3–8 m over the plaza (the hero
 * foliage of shots A and F) and the lantern pods are never touched — except the two shot-B path
 * pools (round 18, below), whose r 0.6–0.8 lines pass through lobe A's core; measured against A and
 * F, the hole is not visible in either frame.
 *
 * Pool geometry. A cylinder of radius r lands as an ellipse 2 r across the sun and 2 r / sin 38°
 * = 3.25 r along it (ground direction (0.788, 0.615)). A lobe card is dropped when its centre is
 * within r + 0.7 s of the axis (giant.ts cardAllowed; s = its half-size ≈ 0.31 hR, 0.55–0.85 m
 * in the roof lobes) and the survivors reach ≈ 0.35 s back in, so the clear radius for cards is
 * ≈ r + 0.25 and the r 0.75–0.8 pools land ≈ 2 × 3.2 m; the first cut at r 1.0–1.1 carved 3.3 m
 * holes that merged two box pools into one 3.8 m patch and gutted the tip lobes (shot A's box 72 %
 * lit). Pools on the same sun line or within ≈ 2 m across it merge. The reference frames, read
 * cell by cell against the same-tree control (trees index.ts, "Plaza roof"), keep the whole box
 * lit — A rows 0.75–1.0 are bright from x 0.19 to 0.81 and F's brightest paving is its centre —
 * and put the leaf shade on the strip WEST of the box (x < −0.1) and the path mouth NORTH of it
 * (z < 0.5); a first cut that dappled the box itself with 2 m pools between hR 2 roof lobes cost
 * F 0.0044 and C 0.0016 SSIM and was dropped. So the plaza pools are the box's lit middle
 * ((2.7, 3.0) r 2.2, one 4.4 m gap — the brief's upper size), Link's own pool and the stair
 * foot. Link's pool is the closed r 1.5 ray from his head (LINK_SHADOW_RAYS), which culls the
 * roof's cards to ≈ 1.85 m — a 3 × 4.6 m pool centred on his shadow, what the reference shows
 * (Link's shadow lies on lit stone). Every axis passes ≥ 1.9 m from the roof bough's wood (whose
 * own shadow band runs (−2.6, 4.2) → (0.75, −2.5), west and north of the box). No densify on the
 * flight: its casters are the sparse dapple
 * lobes, which the collars packed into a dark canopy in the first cut (shot F's flight box
 * 66 → 79 % shade).
 *
 * Shot B's path (round 18). The reference's flagstones between Link and Saria's door (B x 0.45–0.95,
 * y 0.62–1.0) are dappled — 17.8 % / 20.8 % of the band's centre / right thirds above 0.58
 * luminance, p90 0.61 — where the control renders 5.5 % / 1.7 %, p90 0.56 / 0.48. Hidden one
 * family / giant / lobe at a time (rendered lit share of the centre third, control 5.2 %): every
 * giant 20.3 %, the lantern tree alone 19.3 %, its cluster cards alone 10.5 %, its three wild-limb
 * lobes (hR 3.4 at (−12.5, 12.2, −11.9), (−11.5, 12.2, −15.1), (−8.8, 12.1, −16.0), whose shadows
 * land on the path at (−0.2, −2.3), (0.8, −5.5), (3.5, −6.4)) 14.3 %, the plaza-roof lobe
 * (−10.2, 12.5, −10.6) 5.8 %, the lantern limb's own lobes 5.4 %, the house-bough wood 5.2 %, the
 * columns 7.5 %, the north-west-near giant +3.7 % Lambert sun, white-barks / vegetation / props 0.
 * The wild-limb lobes stack over the lantern-limb lobe A ((−2.5, 5.2, −5.5): 39 % of a 10° cone
 * from (2.5, −2.5) at 8–10 m), so either alone opens next to nothing and the bands below start at
 * 3 m, not 10 (the [10, 30] pools at (4.2, −5.2) / (6.3, −7.2) / (7.5, −5.2) moved the band 0.0 %:
 * those sun lines end in wood — the emergent's bole at 9–12 m and boughs at 12–24 m). Two pools
 * (r 0.8 and 0.6: 1.6 × 2.6 and 1.2 × 2 m ellipses, no collar cards) on the west half of the path:
 * centre third 13.9 % lit, p90 0.596 (frame 17.8 %, 0.610; control 5.5 %, 0.565). A third pool at
 * (2.9, −2.9) r 0.8 reached 16.0 % / 0.602, but the shadow filter's penumbra merges pools closer
 * than ≈ 2 m across the sun, so the three read as one soft 4 m sheet behind Link and cost B
 * 0.0060 SSIM against 0.0017 for these two (C −0.0076 / −0.0069: any pool on this ground sits
 * 4–6 m in front of C's camera, low right, where the reference has its own slab pattern). The
 * right third stays at the control's 1.7 %: the frame's minimap covers 40 % of that box, and its
 * ground lies under the lantern limb's wood-and-pod band ((0.3, −1.7) → (4.8, 0); 60 % of every
 * cone from (2–3.5, −0.5 … −1.5) is blocked at 4–6 m), the emergent bole's stripe (which runs
 * exactly through (3.1, −3.4) → (4.8, −1.9)) and Link's own shadow — with every giant hidden that
 * ground reaches 3.5 %. Shot F's left edge (x 0–0.15, y 0.3–0.8) looks straight down this path
 * (its x 0.02 column crosses (2.7, −1.3), (3.6, −2.4), (5.0, −3.9)), so pools on the path's east
 * half light it — one at (3.3, −2.6) put 44 % Lambert sun in F's (0.02, 0.675) cell (lit share
 * 0.8 → 1.0 % / 0.4 → 1.2 %); these two leave it at the control's 0.8 / 0.4 / 0.0 % (frame 0).
 * Shot A's plaza thirds 14.9 / 32.6 / 8.4 → 15.5 / 32.6 / 8.4 %, D's path band unchanged; 1425
 * giant laminae and 158 cluster cards fewer, no draw call moves.
 */
export const CANOPY_OPENINGS: CanopyOpening[] = [
  // ---- plaza disc (0, 0) r 6 — shot A's plaza box is world (0.3–5.3, 1.5–5.8), the near paving
  // Link's pool at A: the footprint of the closed r 1.5 sun ray from his head (trees index.ts
  // LINK_SHADOW_RAYS, which already clears it 3–40 m out); listed so the roof gets its collar and
  // the shaft mask its hole. Big enough to hold Link and his 2 m shadow, as the reference does.
  { point: [3.6, 5.6], radius: 1.5, band: [10, 30] },
  // the box's lit middle (x 0.5–4.9, z 0.8–5.2) north-west of Link's pool: the sheet of sun the
  // reference keeps between the shaded strip west of the box and the shaded path mouth
  { point: [2.7, 3.0], radius: 2.2, band: [10, 30] },
  // the stair foot, the bright spot of shot F's paving (its (0.375, 0.667) cell) under the flight's
  // first treads; the paving east of it ((6–7, 1.5–3)) is dark in both A and F and stays unlisted
  { point: [5.7, 0.7], radius: 0.8, band: [10, 30] },
  // Link's pool at D on the path north of the plaza: the D ray's footprint (no roof there, the
  // 2.9 m pool lies between the limb band and the emergent bole's stripe)
  { point: [2.2, -6.7], radius: 1.5, band: [10, 30], densify: 0 },
  // ---- hero flight: base (7.3, −0.1) bearing 52°, 20 × 0.54 m run to ≈ (15.8, −6.7); pools on
  // the lower run (already open), the middle run (through the first 7c lobe's remnants) and the top
  // run (through the second 7c lobe)
  { point: [8.3, -0.9], radius: 1.0, band: [10, 30], densify: 0 },
  { point: [12.0, -3.8], radius: 1.0, band: [12, 30], densify: 0 },
  { point: [14.9, -6.0], radius: 1.0, band: [13, 30], densify: 0, id: 'flight-top' },
  // ---- shot B's path: the flagstones between Link and Saria's door, west half only (F's left edge
  // looks down the east half); bands from 3 m so the lantern-limb lobe A and the wild-limb lobes
  // stacked on the same sun lines both open. (Round 34 measured them idle: with both removed the
  // sun's reach on B's left box (0.30–0.40, 0.64–0.99) read 66.9 % against 68.0 % with them — no
  // giant foliage stands on their lines any more; they stay as documented.)
  { point: [1.4, -1.6], radius: 0.8, band: [3, 30], densify: 0, id: 'b-path-near' },
  { point: [0.9, -3.4], radius: 0.6, band: [3, 30], densify: 0, id: 'b-path-west' },
  // ---- round 34 (trees): the frame's lit paving that the giants' high lobes still shaded, from a
  // sun-eye attribution (100 m sun-axis depth image; casters named by the lobe/limb record)
  // shot A's south-west plaza (frame (0.1–0.35, 0.85–0.99); frame 1 s 0.53–0.67 at x 0–2, z 3–5,
  // ours in the lantern tree's crown lobe (−17.5, 18.9, −8.7) hR 4: 8.3 % of A's paving pixels).
  // r 1.0 (an ellipse 2 × 3.2 m, x −0.4…2.4, z 3.3…5.9): a first cut at (0.7, 4.3) r 1.3 reached
  // (−1.0, 3.4) along the sun and lit the strip west of the plaza (x −1.5…−0.5, z 1.5–4), which
  // the frame keeps in shade (24–41) — that strip is the crown lobe's shade plus the two plaza-
  // roof lobes' (index.ts CANOPY_BOUGHS), and this pool's sun line now passes 1.9 m from it.
  { point: [1.0, 4.6], radius: 1.0, band: [10, 30], id: 'plaza-sw' },
  // the path mouth north of the plaza (x −1…1, z −3…0.5; frame 1 s 0.42–0.59 up to a straight
  // edge at x ≈ 1.5, ours 0.02–0.09 sun): a cylinder r 1.4 from 8.5 m on the mouth's sun line
  // (footprint x −1.0…1.3, z −2.5…0.4). What shaded the mouth was mostly wood, which a pool does
  // not carve — the plaza-roof bough's 0.5 m band ((−2.7, 4.4) → (0.7, −2.5); x 0–0.7 of z
  // −2.5…−1) and a plaza-shade clump's 3 m stem ((−1.6, −0.3) → (2.1, 0.9)), both gone (trees
  // index.ts CANOPY_BOUGHS, ghostWood / a short bough); the round-31 hut bough's 0.3–0.5 m band
  // ((−3.8, 2.9) → (6.9, −4.8), through (0, 0.2), (1, −0.55), (2, −1.3); 32 % of the mouth) and
  // the house bough's 1.5 m band ((−3.6, 3.2) → (15.1, −7.2), through (0, 1.2), (1, 0.6)), which
  // stay — ghosting them lit the mouth as the frame has it and measured A −0.0012 / −0.0010, B
  // −0.0005 / −0.0016; and the lantern limb's own arch, 4–5 m up at x −6…−4, whose band lies
  // across z −2.5…−1.5 (frame lit 0.50–0.57) and is the limb's. The pool keeps the line clear of
  // leaves 8.5 m up (the wild-limb lobe (−14.2, 10.8, −12.1) hR 3.2 with vR 1.8 hangs to 9 m;
  // nothing of the hero foliage, the lantern limb's lobes at 3–8 m, stands on it). The limb lobe
  // A's west edge (footprint x 0.7–4.8, z −3.2…0.4) is the mouth's other shade.
  { point: [0.1, -0.9], radius: 1.4, band: [8.5, 30], densify: 0, id: 'a-path-mouth' },
  // shot B's near path east half (frame 14 s: right of Link (0.60–0.76, 0.74–0.99) 86–95 % lit,
  // world x 2–3.3 at z −2 to x 3.5–5 at z −5; ours 0–0.08 sun): the north-west-near crown lobe
  // (−9.7, 14.5, −16.0) hR 3.4 (56 % of that box) and (−10.4, 17.2, −14.3) (8 %). A first cut at
  // (3.2, −3.0) r 1.8 (ellipse to (5.5, −1.2)) also lit the verge east of the path — B x ≥ 0.88,
  // y 0.6–1.0, the frame's dark ferns (0.30–0.36 against ours 0.33–0.39) — and opened a god-ray
  // column at the cylinder's east edge that crossed the house in B: −0.0035 SSIM in that corner.
  // r 1.0 here: footprint x 2.0–4.4, z −4.9…−2.9, its south-east end (4.4, −2.9) at B (0.76,
  // 0.83). What stays across it is wood: the emergent column's bole stripe ((−3.1 + 1.008 h,
  // −7.9 + 0.787 h), 5–7 m up: (2.3, −4) → (4.4, −2.4); 40 % of x 1.5–4, z −4…−1.5) and the limb
  // lobe A's dapple. Its south end stops at z −2.9: frame 1 s (shot A) has x 2–3.5, z −3…−2.5
  // in shade (0.34–0.35), and its north end reaches the frame's lit (2–4, −5…−4) (0.43–0.65).
  // The cylinder stays outside the first A/B shaft column ((1.3, 6.6, −9.4) r 2.6: 3.85 m
  // between the axes against 3.6 — a pool that overlaps a column's disc carves the column's
  // leaf ceiling and its beam runs on to the ground; the round-1 cut's 4.29 m against 4.4 did).
  // The north-west-near crown lobe's shade east of it (x 3.9–5.5, z −5.5…−3.5; frame lit) is
  // inside that column's disc and stays.
  { point: [3.2, -3.9], radius: 1.0, band: [10, 30], densify: 0, id: 'b-path-east' },
  // ---- round 40 (trees-24): the lantern tree's south-east crown off shots A's and F's foreground
  // stones. hardscape-29 measured the two frames' lower thirds at 0.454 / 0.459 luminance against
  // ours at 0.420 / 0.401, and with the lantern tree not casting ours read 0.452 / 0.442: the
  // ray bundle from those stones crosses its south-east side at 9–16 m, ≈ 6 m wide. The
  // sun-shadow attribution of this round (shadow map read per 25 cm ground cell, A's / F's
  // lower thirds) names the casters: the plaza-roof bough's lobes and the three plaza-shade clumps
  // at 12.5 m ((−13.6…−5.5, −10.6…−6.0); casters at (−10…−6, −11…−7, 13) over 40 % of the shaded
  // cells), the crown lobes at 15–18 m behind them, and — left alone — the house bough's 0.6 m
  // wood at 10 m (the path mouth's band, index.ts HOUSE_BOUGHS) and the emergent column's bole
  // stripe. Three hard pools (they carve the corridor-exempt clumps too) on the stones both
  // frames light, band 9–23 m so the lantern limb's own lobes 3–8 m up and the pods are never
  // touched, and no collars (a collar would pack the roof's rims back into a dark canopy).
  // Second cut (per-tree attribution, dist-a: each caster matched to the nearest merged-mesh
  // vertex and its aRoot): with 0.12–0.2 porosity and a 17 m ceiling the clumps' residue (805
  // laminae + cards) and the north-west-near crown lobes at 16–22 m still shaded 49 % of A's
  // and 59 % of F's lower-third cells (from 52 / 60), the north-west-near leaves alone 26 / 31 %
  // — so the pools are closed (no porosity), reach 23 m, and the mid / east ones are widened to
  // the cells those lobes shade (x 4–7.5, z −2…6). What no pool can take is wood: the house
  // bough's 0.6 m at 10 m over x −1…2, z 0…2 (16 % of A's shaded cells) and the north-west-near
  // limbs at 14–18 m (8 / 12 %) — that is the giant's authored composition (HOUSE_BOUGHS, kept
  // by round 34 for A/B), not the trees' corridors to cut.
  // Trade-off, on record: frame 1 s (shot A) keeps one shade patch on the plaza (x 1.2–4.5,
  // z −1.5…2.5, 4.7 % lit — round 34's three plaza-shade clumps), and frame 8 s (shot F) has the
  // same slabs lit. These pools take round 34's side for F: the mid pool clears that patch.
  { point: [0.5, -0.5], radius: 2.0, band: [9, 23], porosity: 0, cardPorosity: 0, densify: 0, hard: true, id: 'a-f-stones-west' },
  { point: [3.8, -0.2], radius: 2.2, band: [9, 23], porosity: 0, cardPorosity: 0, densify: 0, hard: true, id: 'a-f-stones-mid' },
  { point: [6.2, 2.6], radius: 2.4, band: [9, 23], porosity: 0, cardPorosity: 0, densify: 0, hard: true, id: 'a-f-stones-east' },
  // Not listed — Link's pool at B (feet at B (0.5, 0.91) = (1.6, −2.3)). The frame has his shadow
  // on lit slabs at his feet ((0.50–0.62, 0.85–0.95), 0.30 in 0.55–0.64); ours stands him in the
  // limb lobe A's shade (his head's sun line passes 0.2 m from its centre (−2.5, 5.2, −5.5)). A
  // (1.7, −2.4) r 0.9 pool from 3 m lit him and the slab right of his feet (x 2–3, z −3…−2.5,
  // sun 0.11–0.15) — but the slabs beyond it stay under the emergent column's bole stripe (its
  // 1.24 m bole 5–8 m up shades (1.9, −4) → (5, −1.6): 78 % of x 2.5–4, z −3.5…−2, the frame's
  // brightest paving), so the frame's lit-then-shadow order right of Link came out shadow-then-lit
  // and the cell (0.63–0.75, 0.83–1.0) lost 0.11 SSIM (−0.0024 of the frame). His own shadow fell
  // on the bottom edge ((2.9, −1.3) = B (0.77, 0.96)). Dropped; he stays in shade as in the control.
];
