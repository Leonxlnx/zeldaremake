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
    elevationDeg: 34,
    color: 0xfff1d6,
    intensity: 4.6,
    shadowMapSize: 4096,
    shadowRadius: 60,
  },

  sky: {
    zenith: 0xa9c4d6,
    horizon: 0xe6ecdc,
    hemiSky: 0xb9cfd9,
    hemiGround: 0x5a6a3f,
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

  /** Color palette sampled from the reference (linear-ish hex values for materials). */
  palette: {
    grassLight: 0x9fb864,
    grassMid: 0x6f9a42,
    grassDeep: 0x3f6a2c,
    mossBright: 0x86a94c,
    mossDeep: 0x4e7332,
    soil: 0x6b5a3e,
    soilDark: 0x453827,
    flagstone: 0xa89f88,
    flagstoneDark: 0x7f7766,
    barkWhite: 0xd8d4c6,
    barkGrey: 0x8f8b80,
    barkDark: 0x4d443a,
    leafCanopy: 0x5c8a3a,
    leafSun: 0xa6c95a,
    lanternGlow: 0xffb13b,
    fairyGlow: 0xdfffff,
    fernGreen: 0x4f7f3a,
    flowerPurple: 0x8a5bb5,
  },
} as const;

export type WorldConfig = typeof WORLD;
