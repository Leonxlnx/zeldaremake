/**
 * Global world constants. Values here are derived from the reference footage
 * (reference/ANALYSIS.md). Change deliberately; note changes in your .agents log.
 *
 * Units: metres. +Y up. Link (child) is ~1.25 m tall; camera eye height ~1.6–1.9 m.
 */
export const WORLD = {
  seed: 'kokiri-forest-phase1',

  /** Radius of the fully detailed, explorable area around the plaza. */
  detailRadius: 45,
  /** Radius where vegetation/trees are still placed (lower LOD). */
  midRadius: 110,
  /** Terrain mesh extent (half-size). Distant hills live beyond this as separate meshes. */
  terrainHalfSize: 220,

  // Keep the footage's sun direction. The owner concept pass uses a stronger golden key
  // against cooler canopy fill; actual six-camera review is archived in23ea37a.
  sun: {
    azimuthDeg: -128, // measured from +Z toward +X; negative = light coming from the west-north-west
    elevationDeg: 38,
    color: 0xffe9c4,
    intensity: 3.6,
    shadowMapSize: 4096,
    shadowRadius: 60,
  },

  sky: {
    zenith: 0xcfd3c8,
    horizon: 0xe2dfd0,
    // Explicit sRGB fill colours; lighting uses them without a hidden warm-white blend.
    hemiSky: 0xb8c8d2,
    hemiGround: 0x6d715a,
    hemiIntensity: 0.6,
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
