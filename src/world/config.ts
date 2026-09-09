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
  sun: {
    azimuthDeg: -128, // measured from +Z toward +X; negative = light coming from the west-north-west
    elevationDeg: 38,
    color: 0xfff1d6,
    intensity: 4.6,
    shadowMapSize: 4096,
    shadowRadius: 60,
  },

  sky: {
    zenith: 0xbccccf,
    horizon: 0xe4e6d6,
    hemiSky: 0xc1ccc7,
    hemiGround: 0x525a37,
    hemiIntensity: 0.9,
  },

  fog: {
    /** Cool blue-grey mist that layers distance; NOT for hiding unfinished terrain (see GAUNTLET.md). */
    color: 0xc5d1cf,
    near: 28,
    far: 190,
    /** Ground mist cap height above terrain. */
    mistHeight: 3.5,
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
    grassLight: 0x94a25c,
    grassMid: 0x657e3a,
    grassDeep: 0x3c5726,
    mossBright: 0x88994a,
    mossDeep: 0x546236,
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
    fernGreen: 0x5c7434,
    flowerPurple: 0x8255a0,
  },
} as const;

export type WorldConfig = typeof WORLD;
