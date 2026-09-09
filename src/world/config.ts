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
  sun: {
    azimuthDeg: -128, // measured from +Z toward +X; negative = light coming from the west-north-west
    elevationDeg: 38,
    color: 0xffe9c4,
    intensity: 5.0,
    shadowMapSize: 4096,
    shadowRadius: 60,
  },

  sky: {
    zenith: 0xcfd3c8,
    horizon: 0xe2dfd0,
    hemiSky: 0xc9c8b4,
    hemiGround: 0x4a4a30,
    /**
     * hemisphere fill (near-neutral tint, see lighting/index.ts). Generous: the plaza in shot A
     * lies in the lantern tree's crown shadow under the pinned sun azimuth, so its shaded stone
     * has to carry the reference's ≈ 0.5 plaza luminance until that crown thins.
     */
    hemiIntensity: 1.2,
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
    grassLight: 0x73832e,
    grassMid: 0x4f6321,
    grassDeep: 0x304616,
    mossBright: 0x83834a,
    mossDeep: 0x53572f,
    soil: 0x6b5a3e,
    soilDark: 0x453827,
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
