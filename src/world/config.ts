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

  // Sun: the reference shows late-morning light from behind-left of the stairs shot,
  // strong shafts entering high from the upper-left of the frame, soft long shadows.
  // Measured on the reference plaza (percentiles of the foreground flagstones): sunlit stone
  // ≈ 0.62–0.66 luminance, shaded stone ≈ 0.33–0.40 (a display ratio of only ≈ 1.8) — a warm
  // key over a generous, near-neutral fill; the deep darks (0.16–0.23) are shaded vegetation.
  // With the lantern crown's sun corridors open (trees 99b6c2b) the plaza's sunlit slabs measured
  // 0.70–0.80 at intensity 5.0, so the key is a notch lower to land them on the reference's band.
  sun: {
    azimuthDeg: -128, // measured from +Z toward +X; negative = light coming from the west-north-west
    elevationDeg: 38,
    color: 0xffe9c4,
    intensity: 3.0,
    shadowMapSize: 4096,
    shadowRadius: 60,
  },

  sky: {
    zenith: 0xcfd3c8,
    horizon: 0xe2dfd0,
    hemiSky: 0xc9c8b4,
    /**
     * ground bounce: a warm khaki rather than dark olive — the clearing floor is sunlit beige
     * flagstone and khaki grass, so limb and leaf undersides (the lantern limb at 10 m in shot A)
     * receive a visible fill from below instead of reading near-black.
     */
    hemiGround: 0x7d7860,
    /**
     * hemisphere fill (near-neutral tint, see lighting/index.ts). Generous but no longer carrying
     * the plaza alone: since the lantern crown lets dappled sun onto the plaza, its shaded slabs
     * measured 0.50–0.60 luminance at 1.2 against the reference's 0.30–0.50 band.
     */
    hemiIntensity: 0.95,
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
    // frame means read 0.01–0.09 above the reference in every view (most in C/E/F)
    exposure: 0.94,
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
    grassLight: 0x73832e,
    grassMid: 0x4f6321,
    grassDeep: 0x304616,
    mossBright: 0x83834a,
    mossDeep: 0x53572f,
    // olive-brown, not orange-brown: the reference's dark ground pixels sit at hue 52–57°
    // (joints (62,59,40), shade (108,102,78)); the old 0x6b5a3e / 0x453827 were 34–37°
    soil: 0x69613c,
    soilDark: 0x423b26,
    flagstone: 0xa79b7e,
    flagstoneDark: 0x797261,
    barkWhite: 0xc8c3b5,
    barkGrey: 0x847f74,
    barkDark: 0x4a4136,
    leafCanopy: 0x546f38,
    leafSun: 0x96aa50,
    lanternGlow: 0xffb13b,
    fairyGlow: 0xdfffff,
    fernGreen: 0x586125,
    flowerPurple: 0x8255a0,
  },
} as const;

export type WorldConfig = typeof WORLD;
