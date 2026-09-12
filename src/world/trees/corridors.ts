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
 * foliage of shots A and F) and the lantern pods are never touched.
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
 */
export const CANOPY_OPENINGS: CanopyOpening[] = [
  // ---- plaza disc (0, 0) r 6 — shot A's plaza box is world (0.3–5.3, 1.5–5.8), the near paving
  // Link's pool at A: the footprint of the closed r 1.5 sun ray from his head (trees index.ts
  // LINK_SHADOW_RAYS, which already clears it 3–40 m out); listed so the roof gets its collar and
  // the shaft mask its hole. Big enough to hold Link and his 2 m shadow, as the reference does.
  { point: [3.6, 5.6], radius: 1.5, band: [10, 30] },
  // the box's lit middle (x 0.5–4.9, z 0.8–5.2) north-west of Link's pool: the sheet of sun the
  // footage keeps between the shaded strip west of the box and the shaded path mouth. The
  // owner-board dapple study retains 35% of real foliage here; Link's separate pool stays clear.
  { point: [2.7, 3.0], radius: 2.2, band: [10, 30], porosity: 0.35, cardPorosity: 0.35 },
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
];
