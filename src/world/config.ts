/**
 * Global world constants. Values here are derived from the reference footage
 * (reference/ANALYSIS.md). Change deliberately; note changes in your .agents log.
 *
 * Units: metres. +Y up. Link (child) is ~1.25 m tall; camera eye height ~1.6–1.9 m.
 */
export const WORLD = {
  // 2026-09-16 owner-directed clearer daylight: sun/sky values below supersede the
  // historical foggy-reference calibration comments. Geometry and exposure stay fixed.
  seed: 'kokiri-forest-phase1',

  /** Radius of the fully detailed, explorable area around the plaza. */
  detailRadius: 45,
  /** Radius where vegetation/trees are still placed (lower LOD). */
  midRadius: 110,
  /** Terrain mesh extent (half-size). Distant hills live beyond this as separate meshes. */
  terrainHalfSize: 220,

  // Sun: the reference shows late-morning light from behind-left of the stairs shot,
  // strong shafts entering high from the upper-left of the frame, soft long shadows.
  // Measured on the reference plaza (percentiles of the foreground flagstones): sunlit stone
  // ≈ 0.62–0.66 luminance, shaded stone ≈ 0.33–0.40 (a display ratio of only ≈ 1.8) — a warm
  // key over a generous, near-neutral fill; the deep darks (0.16–0.23) are shaded vegetation.
  // With the lantern crown's sun corridors open (trees 99b6c2b) the plaza's sunlit slabs measured
  // 0.70–0.80 at intensity 5.0, so the key is a notch lower to land them on the reference's band.
  // 3.1 against a fill of 0.95 (was 3.0 / 1.0): the reference is sun-dominated — its canopy-shaded
  // path keeps ≈ 0.35 of a lit slab in linear light and Link's shadow ≈ 0.29, so the fill is ≈ 0.38
  // of a lit horizontal surface here (0.40 before) with the lit slabs unchanged.
  sun: {
    azimuthDeg: -128, // measured from +Z toward +X; negative = light coming from the west-north-west
    elevationDeg: 38,
    color: 0xffe9c4,
    intensity: 3.7,
    shadowMapSize: 4096,
    shadowRadius: 60,
  },

  sky: {
    zenith: 0xcfd3c8,
    horizon: 0xe2dfd0,
    hemiSky: 0xb8d1e0,
    /**
     * ground bounce: a warm khaki rather than dark olive — the clearing floor is sunlit beige
     * flagstone and khaki grass, so limb and leaf undersides (the lantern limb at 10 m in shot A)
     * receive a visible fill from below instead of reading near-black.
     * Round 8: 2× in linear light (0x7d7860 → 0xaba687). The surfaces that only this term lights
     * (downward faces: the limb underside at 4–7 m filling B's top band, the canopy undersides at
     * 10–18 m in A's top-left) measured 0.31 / 0.36 against the reference's 0.43 / 0.49 with the
     * sun contributing nothing there (sun off = unchanged), and a sunlit khaki floor radiates
     * ≈ 0.4 albedo × 3.1 × sin 38° ≈ 0.75 linear where the old bounce stood for 0.2. Measured on
     * A/B/D: SSIM +0.001 / +0.004 / 0, luminance error down in all three, B box (a) 0.308 → 0.346,
     * A top-left 0.434 → 0.442; 3× reached 0.381 / 0.448 but lifted B's forest-band darkest decile
     * to 0.361 against the reference's 0.289 (2×: 0.336), so the bounce stays at the floor's value.
     * Round 31 (tone attribution, D + B captures with the hemisphere's ground colour alone
     * overridden): the 2× bounce is what lifts the darkest decile of the canopy / trunk bands —
     * back at the old value the top band's p10 drops 0.029 (D) / 0.035 (B) and the left forest
     * band's 0.029 / 0.029, the medians move ≤ 0.008, the bottom band (the plaza it was raised
     * for) ≤ 0.004: it never carried the plaza. The reference's top bands sit at p10 0.29 / 0.30
     * against our 0.33 / 0.34, its B forest band at 0.277 against 0.343; the rest of that lift is
     * the shade floors (materials/shadeFloor.ts: −0.18 / −0.21 on the same bands when off) and is
     * reported to their owner. SSIM −0.002 / −0.004 alone, paid for by the haze blur (postfx).
     * Round 38 (tone): back to the 2× khaki (0xaba687) as the coloured shade floor of F's mid band
     * — the shaded bank right of the stairs and the risers' shaded faces read 0.12–0.18 where the
     * frame's shade is a lifted grey-green 0.3–0.4, and the hemisphere's ground half is the fill
     * that reaches those faces. Measured with the AO at 0.2 (six views, runtime override): the
     * 2× bounce adds A +0.0001, B +0.0015, C +0.0018, D +0.0005, E +0.0004, F +0.0010 on top of
     * the AO change (F mid band pixels < 0.2: 19.5 → 18.1 %, mean 0.289 → 0.293); a greener
     * 0x8f9a72 measured the same within 0.0007 per view, so the khaki (the sunlit floor's own
     * colour) stays. The IBL's lower half follows (sky.ts uGround), so vertical faces gain a hair
     * of fill from below as well.
     */
    hemiGround: 0xaba687,
    /**
     * hemisphere fill (near-neutral tint, see lighting/index.ts). Generous but no longer carrying
     * the plaza alone: since the lantern crown lets dappled sun onto the plaza, its shaded slabs
     * measured 0.50–0.60 luminance at 1.2 against the reference's 0.30–0.50 band. Measured on the
     * open path of shots B/E (lit slabs 0.60, shaded 0.38–0.42 against the reference's 0.60–0.66
     * and 0.33–0.40): 1.15 over-lit the shaded slabs by 0.05, 0.95–1.0 lands them. 0.95 (with the
     * IBL at 0.57) once the canopy shade darkened: shots B/D's paths measured 0.05 over the reference
     * at 1.0 / 0.6 with the sun at 3.0 — see sun.intensity for the balance.
     */
    hemiIntensity: 0.82,
  },

  fog: {
    /** Measured reference haze (reference/palette.json): warm grey, ~56 % at 30 m. NOT for hiding unfinished terrain (GAUNTLET.md). */
    color: 0x95968b,
    near: 28,
    far: 190,
    /** Ground mist cap height above terrain (the reference pools are 0.5–2 m thick, never a wall). */
    mistHeight: 2.2,
  },

  renderer: {
    // 0.94 was set when the frame means read 0.01–0.09 above the reference; with the sparse god-ray
    // mask (no broad airlight wash) every view measured 0.02–0.035 under it, so back to unity
    exposure: 1.0,
    maxPixelRatio: 1.5,
  },

  /**
   * Material palette. Reference hero frames measure olive/khaki and low-key (hue 47–51°, sat
   * 0.16–0.19, lum 0.35–0.39 — see reference/palette.json); these albedos sit halfway between the
   * first-pass greens and those measured (post-haze) values so the final graded frame lands on them.
   */
  palette: {
    // Grass/moss/fern are olive-khaki, not lime: measured on quality-high captures, the old tints
    // rendered lit grass at ≈ 0.50 luminance (reference 0.34–0.37) and shaded banks at ≈ 0.40
    // (reference ≈ 0.24) with the stone already matching, so the fix is albedo — ≈ 0.6× in linear
    // light at the same 70–90° hue band (the grade warms it to the reference's ≈ 60°), with
    // saturation raised so the haze does not grey it out.
    // Round 4b, under the sun-dominant lighting (sun 3.1 / fill 0.95, canopy leak 0.1) that
    // renders the shaded stone on the reference's band: shaded foliage measured ≈ 0.6× too dark
    // and 1.6× too saturated (shot F's shaded bank 0.278 / HSV sat 0.43 against 0.311 / 0.27, D's
    // west verge 0.256 against 0.357) while the sunlit banks already matched (A's right bank 0.309
    // against 0.315). Every green is therefore lifted ≈ 1.18× in linear light with its HSV
    // saturation × 0.7 and the hue 6° greener (the warm key and grade pull it ≈ 25° toward orange
    // in the frame), which the sunlit boxes' 0.03 headroom just covers. Measured on the same tree,
    // the lift moves shaded foliage only ≈ +0.015 display (14–28 % of those pixels is haze at
    // 10–19 m, the boxes are a third trunk/log/stone, and the ACES toe) — the rest of the shade
    // deficit is the foliage's own sun/shade ratio (vegetation/materials.ts uShadeFill on the
    // flagged bank blades already closes it on shot F's bank; D's verge ferns have no such path).
    grassLight: 0x7b8d4d,
    // shaded blades warmer than lit ones (hue 76°/83° vs 77°/93°): the reference's shaded
    // vegetation band reads ≈ 51–56° after grade
    grassMid: 0x5b6838,
    grassDeep: 0x3c4927,
    mossBright: 0x898d62,
    mossDeep: 0x585e40,
    // olive-brown, not orange-brown: the reference's dark ground pixels sit at hue 52–57°
    // (joints (62,59,40), shade (108,102,78)); the old 0x6b5a3e / 0x453827 were 34–37°
    soil: 0x69613c,
    soilDark: 0x423b26,
    flagstone: 0xa79b7e,
    flagstoneDark: 0x797261,
    barkWhite: 0xc8c3b5,
    barkGrey: 0x847f74,
    barkDark: 0x4a4136,
    // crown leaves follow the grass (round 4b): 1.16× linear, saturation × 0.75, 3° greener — shot
    // F's crown band measured 0.359 / sat 0.21 against the reference's 0.377 / 0.17
    leafCanopy: 0x5e764a,
    leafSun: 0xa1b46d,
    lanternGlow: 0xffb13b,
    fairyGlow: 0xdfffff,
    // ferns grow almost only in canopy shade (shot D's west verge, F's bank slope), so they carry
    // a further 1.3× linear on top of the shared lift (same hue/saturation): the shaded foliage of
    // D's verge measured 0.278 against the reference's 0.338 with the grass lift alone, and a
    // uniform shade lift (uAmbientBoost) that closed it would over-lift the sunlit lawns of B/E
    fernGreen: 0x697642,
    flowerPurple: 0x8255a0,
  },
} as const;

export type WorldConfig = typeof WORLD;
