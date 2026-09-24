/**
 * Distant tree houses (round 16; round 18 seats, recessed openings, pods): the village behind the
 * clearing.
 *
 * The owner's boards 01 (village lighting) and 08 (gameplay composition) show Kokiri Forest as
 * several lit tree houses stacked at different depths in the misty background — round doors and
 * windows glowing warm amber, pod lanterns, moss caps, rope walkways between the trunks — all
 * softened by the haze. Reference frames 1 s and 14 s keep a hazy lit background with a far
 * lantern light. Ours had one house (Saria's, 23 m in A) and the upper house; the far wall was
 * trunks and haze. These three huts sit 4–8 m up existing trunks 30–47 m from the hero cameras, in
 * 55–70 % haze, so what counts is silhouette plus warm emissive points, not bark texture:
 *
 *   - one merged geometry per material per house, in the SAME materials (and shadow flags /
 *     vertex layout) as Saria's house — bark (walls, soffit, collars), planks, cap moss — so
 *     `consolidateStaticMeshes` folds each material into one draw. Round 20: index.ts consolidates
 *     the whole village apart from the hero structures (its own buckets, its own bounds), because
 *     a hut part merged into a hero bucket stretched that bucket's bounding sphere over 30–47 m
 *     and look-back cameras that see no hut drew the whole bucket;
 *   - every window lamp, door lamp, reveal, recess back and pod of every house in ONE emissive
 *     mesh (`distant-glow`, +1 draw) on `mats.distantGlow` — white × 2.2 linear, the hue in the
 *     vertex tints, so every lamp / pod tint peaks at 2.2 and clears the height fog's far-shade
 *     exemption (heightfog.ts: emissives above 2.0 keep their radiance) and the points still read
 *     through the veil the way the reference's far lantern does. The reveals are tinted by the
 *     lamp's fall-off (peak 0.99, see below) and the backs are near-black: lit wood and dark
 *     recesses, not lamps. No point lights.
 *
 * Openings (round 18): the boards (03 / 04 / 06) and frame 14 s show openings WITH DEPTH — a dark
 * recess behind a warm rim, a lamp inside — where round 16 pasted flat glowing discs on the wall.
 * The wall is now cut (gridSurface cell holes, fine cells around the openings) and each opening is
 * a 0.30 / 0.35 m recess with a small lamp disc at 65 % depth. Pods are the near lanterns' pod at
 * distant LOD — their teardrop lit body and dark cap profiles (lantern.ts), four dark sepal fins,
 * a stem — hung from a cord that is bracketed to its post (round 16's cords hung 0.12 m off the
 * post tops).
 *
 * Reveals (round 20). Round 18 ringed each opening with a continuous emissive band (0.14 m, peak
 * 1.76 linear on the glow material); in the takes those read as luminous graphic outlines — neon
 * circles and arches — not as wood lit from inside (Astra's review of take 71 / f56). The band is
 * gone. The reveal is now the recess itself, drawn on the glow material as WOOD RESPONDING TO THE
 * LAMP: each vertex of the tunnel (and the door's threshold) takes the lamp's irradiance on it —
 * cos / d² from the lamp disc's centre against the reveal's inward normal — through a tone curve
 * (`revealTint`: unlit wood 0.044 linear → lit wood 0.99 linear at a 0.2 m reference distance,
 * always under the fog's 2.0 exemption), times an angular grain (three lobes of hewn end-grain,
 * finer ripples, two or three dark knots) so no closed circle of one intensity exists. The lamp
 * hangs HIGH in the recess and a little to one side, so the head and the near jamb are bright and
 * the sill is dark; the tunnels are SPLAYED (hewn wider outside than in: the window's back radius
 * is 0.7 × the mouth's, the door's jambs and head step in 8 cm) — seen from the cameras 12–22°
 * below, a splayed head faces down and out and shows its lit inside, where a straight tunnel
 * showed only its sill at a grazing angle. The recess backs stay dark (behind the lamp disc); the
 * cut's ragged cell edge is covered by a bark collar in the wall's own shade (`mats.bark`, +0
 * draws), not by light. The lamp discs remain the only strongly emissive points (2.2 linear).
 *
 * Hosts: `ctx.shared.trunkSeats` when the trees system has published its column seats (matched
 * by the nearest base to the authored constants below; the hut wall then grows past its authored
 * radius whenever the seat's `radiusAt(h)` + axis drift + 6 cm over the hut's height band needs
 * more, and the hut sits on `axisAt(h)`), else the constants (layout giants + a copy of the trees'
 * COLUMN_SEATS). The hut
 * is centred near the trunk axis (a small authored offset shifts it clear of hero silhouettes) with
 * a radius that covers the bole's lean and wander at hut height, so the trunk rises through the
 * platform and the cap the way a tree house is built round its tree. Ground contact is not
 * needed: the floor height is measured from the seat's base (`ctx.terrain.height` there for the
 * constants), exactly where the trees system seats the trunk.
 *
 *   hollow-column  COLUMN_SEATS (8.8, −26.9) v3, hut 4.2 m up   → A (0.37, 0.11) 33 m, B (0.46, 0.13) 28 m, D (0.64, 0.08) 23 m
 *   north-east     giant 'north-east' (15, −37),  hut 8.0 m up  → A (0.45, 0.13) 45 m, B (0.53, 0.17) 40 m, D (0.72, 0.14) 33 m
 *   west-column    COLUMN_SEATS (−5.7, −31.9) v1, hut 6.0 m up  → A (0.08, 0.13) 33 m, B (0.13, 0.16) 29 m, D (0.30, 0.17) 27 m
 *
 * (frame fractions of the window centre; gauntlet/tmp/proj.mjs with the layout viewpoints). In A
 * the first two stand above Saria's cap fringe at different depths (33 / 45 m) — the boards'
 * stacked village; in B the west column is the lit point far left beyond the emergent and the
 * other two sit right of the receding path, left of Saria's cap; in D the west column is the lit
 * point left of the log arch (27 m — no authored trunk stands 45–60 m out on that side) and the
 * others sit right of the arch, above it (the arch's top projects at y ≥ 0.35, every lit point at
 * y ≤ 0.20). None is in front of the stair, Saria's house or the arch opening.
 */
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Float32BufferAttribute, Group, LatheGeometry, Mesh, PointLight, TorusGeometry, Vector2, Vector3 } from 'three';
import type { CameraWall, TrunkSeat, WalkSurface, WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { FoliageBuilder } from './foliage';
import { basisMatrix, ensureColor, faceTowards, gridSurface, merge, repeatsRound, seamUV, setColorAttribute, sweepTube, TAU } from './geometry';
import { buildLantern, type LanternRig } from './lantern';
import { MOSS_ALBEDO_PEAK, Noise3D, WOOD_ON_FENCE_WOOD, type StructureMaterials } from './materials';
import { buildMossTufts, type MossTuftSpec } from './mossTufts';

export interface DistantHouseDef {
  id: string;
  /** host trunk seat (world x, z) and where it is authored */
  host: { x: number; z: number; source: string };
  /** hut centre offset from the seat (m, world x/z): shifts the silhouette clear of hero elements */
  offset: [number, number];
  /** platform height above the seat's terrain (m) */
  floor: number;
  /**
   * Round 49 (expansion-2): the platform's ABSOLUTE world height (m) — the west house wraps a
   * giant on a mound whose ground under the platform runs over 3 m; `floor` is then derived from
   * the seat's base and ignored as authored.
   */
  floorAbsolute?: number;
  /**
   * hut wall radius (m): the hut's authored scale (door 0.7 m, window 0.24 R). Without a published
   * seat it must also cover the bole's radius + lean + wander over the hut's height band; with one
   * the wall grows to clear `radiusAt` + drift + BOLE_CLEARANCE when the bole needs more.
   */
  radius: number;
  /** wall height floor → eave (m) */
  wall: number;
  /** the round-topped door's width and height (m; default 0.7 × 1.35) — a hut Link walks up to takes his scale */
  doorSize?: [number, number];
  /**
   * 2026-09-24 (the north grove): the rings (window tunnel, cap skirt, eave roll, platform rim)
   * take a whole number of map repeats round and an extrapolated seam column (geometry.ts
   * `seamUV`), so the bark and plank maps meet themselves instead of running backwards through the
   * ring's last quad. Opt-in: the village's huts keep their uvs exactly.
   */
  seamlessRings?: boolean;
  /**
   * 2026-09-24 (the north grove): the walkway's post pods hang from brackets `POST_POD_OUTBOARD`
   * outboard of their posts (the end post's no longer past the deck's end), clear of a walker
   * hugging the rail — his centre 0.34 m off the walkway's line, his arms 0.19 m further. Opt-in:
   * the far huts and the expansion's houses keep theirs.
   */
  postPodsOutboard?: boolean;
  /** cap rise above the eave (m) */
  capHeight: number;
  /**
   * the cap's overhang past the wall radius (m; default CAP_OVERHANG). Round 32: the hollow
   * column's hut is the nearest hut to any hero camera (D 25 m against A 36 / B 30) and in
   * frame 56 s its place in D's upper band is hazed trunk; a tighter, lower cap shrinks the
   * D-facing silhouette (see `capHeight`) while the hut's lamps and body keep A/B's far village.
   */
  capOverhang?: number;
  /** azimuth (deg, from +Z toward +X) the round window faces — the mean direction to cameras A/B/D */
  facingDeg: number;
  /** door azimuth relative to the window (deg, + toward +X side = screen right) */
  doorDeg: number;
  /**
   * walkway stub: azimuth relative to the window (deg) and length (m). Round 49: `end` (world
   * x, y, z) instead lays the deck from the platform rim to exactly that point — the head of a
   * flight — and `deg` / `length` are derived and ignored as authored. 2026-09-24: `from` (m from
   * the hut's centre) starts the deck there instead of at the platform rim, the rails' inner ends
   * standing there instead of on the wall (the grove's stilt house: a veranda runs round the hut
   * out to that radius).
   */
  walkway: { deg: number; length: number; end?: [number, number, number]; from?: number };
  /** 2–3 pods: end post, eave, mid post */
  pods: number;
  /**
   * Round 50 (structures-33): the main house's standard on a hut the player walks up to (the
   * expansion's west house and far hut — never the three village huts, whose streams and
   * geometry this leaves exactly alone). Each part is opt-in:
   *  - `doorBough`: a gnarled eave bough growing out of the wall left of the door, arching over
   *    it, with `pods` pod lanterns clustered on its underside over the door (the demo's second
   *    house hangs its pods over the door); `length` m of reach across the door;
   *  - `buttresses`: two knotted bark buttress roots framing the doorway, feet on the platform;
   *  - `interior`: the door's dark back becomes a lit room glimpse — a warm lamp-lit back wall,
   *    a plank floor, a shelf and a second lamp deeper in, still under the fog's 2.0 exemption;
   *  - `fringe`: hanging moss beards and leaf clumps along the cap's lobed edge.
   */
  dressing?: { doorBough?: { length: number; pods: number }; buttresses?: boolean; interior?: boolean; fringe?: boolean };
  /**
   * 2026-09-23 (owner review: "repeated bungalows need purposeful variation"): what a village
   * hut's people built for their own use, beyond its size and pods. Placed from the hut's own
   * geometry, drawn from its own fork (no stream above re-rolls):
   *  - `ladder`: a rope ladder from the platform rim to the ground at `deg` (relative to the
   *    window, like `doorDeg`), staked at its foot, clear of the host bole;
   *  - `railing`: posts round the platform rim under a bent-pole rail, open at the walkway, the
   *    door and the ladder;
   *  - `hoist`: a davit pole leaning out over the rim at `deg`, its rope through a block to a
   *    basket `drop` m under the platform, the hauling end tied off on the wall;
   *  - `flowerBox`: a planter on the window ledge;
   *  - `sprout`: a sapling growing out of the moss cap;
   *  - `awning`: a mossy bark brow over the window;
   *  - `herbs`: bundles drying on a cord under the eave at `deg`.
   */
  character?: {
    ladder?: { deg: number };
    railing?: boolean;
    hoist?: { deg: number; drop: number };
    flowerBox?: boolean;
    sprout?: boolean;
    awning?: boolean;
    herbs?: { deg: number };
  };
}

/**
 * authored hosts: layout giants + the trees system's COLUMN_SEATS (see the header)
 *
 * These are the FALLBACK. When the trees system publishes `ctx.shared.trunkSeats`, each hut
 * takes the seat nearest its constants (within `HOST_MATCH_M`) and the constants only name it;
 * the copies stay so a hut still stands when a seat is not published (a giant, or the trees pass
 * not yet landed) — the audit's `hostSource` says which path built it.
 */
export const DISTANT_HOUSES: DistantHouseDef[] = [
  {
    id: 'hollow-column',
    host: { x: 8.8, z: -26.9, source: 'trees COLUMN_SEATS (8.8, -26.9) variant 3' },
    offset: [-0.6, 0.2],
    floor: 4.2,
    // round 18: 1.55 let the bole poke 2.7 cm through the wall's tightest wobble at y 11.5
    radius: 1.65,
    wall: 2.0,
    // round 32 (structures-22): 1.25 / 0.45 → 0.9 / 0.25 — at 25 m in D the sunlit cap was the
    // hut's brightest, most saturated part (a yellow-green dome at (0.60–0.66, 0.02–0.08) where
    // frame 56 s has hazed trunk); the lower, tighter cap shows a third less of it
    capHeight: 0.9,
    capOverhang: 0.25,
    facingDeg: -15,
    doorDeg: 38,
    // round 31 (trees): the walkway leaves on camera D's bearing (−19° absolute; was −93°, west)
    // so its end-post pod hangs under the window in shot D, D (0.62, 0.03) with the window at
    // (0.64, 0.07), inside the trees' one small clump 8 m from D (trees CANOPY_BOUGHS, plateau-oak
    // t 1.0) — the frame's upper band has no lamps but the arch's. Shots A and B see the pod in
    // front of the hut, B (0.44, 0.09) / A (0.34, 0.09), above the clump. Two pods, not three:
    // the mid-post pod would have hung beside the clump in B.
    walkway: { deg: -4, length: 3.2 },
    pods: 2,
    // the lowest hut: its ladder hangs on the side facing the north path (6 m west), flowers
    // on its window ledge
    character: { ladder: { deg: -72 }, flowerBox: true },
  },
  {
    id: 'north-east',
    host: { x: 15, z: -37, source: "layout giantTrees 'north-east'" },
    offset: [1.0, 0.3],
    floor: 8.0,
    radius: 2.4,
    wall: 2.4,
    capHeight: 1.8,
    facingDeg: -19,
    doorDeg: 40,
    walkway: { deg: -75, length: 3.6 },
    pods: 3,
    // the highest hut (8 m): a railing round its platform and a hoist to haul up what it needs
    character: { railing: true, hoist: { deg: -128, drop: 2.4 } },
  },
  {
    id: 'west-column',
    host: { x: -5.7, z: -31.9, source: 'trees COLUMN_SEATS (-5.7, -31.9) variant 1' },
    offset: [0, 0],
    floor: 6.0,
    radius: 1.7,
    wall: 2.1,
    capHeight: 1.3,
    facingDeg: 10,
    doorDeg: -36,
    // round 31 (trees): the walkway leaves on camera D's bearing (12° absolute; was 90°, east),
    // its end-post pod under the window in D — (0.29, 0.17) on the window's (0.28, 0.17) — inside
    // the lantern tree's hanging clump 9 m from D (trees CANOPY_BOUGHS, lantern-tree round 31);
    // before, the pod stood alone in the frame's haze at D (0.40, 0.24). B (0.12, 0.16) /
    // A (0.07, 0.14) see it in front of the hut, beside the clump.
    walkway: { deg: 2, length: 2.6 },
    pods: 2,
    // the grower's hut: a sapling rooted in its cap, a brow over its window, herbs drying on the
    // side toward the north path (8 m east)
    character: { sprout: true, awning: true, herbs: { deg: 72 } },
  },
];

/** a published seat counts as a hut's host when its base is within this of the constants (m) */
export const HOST_MATCH_M = 1.5;
/** `postPodsOutboard`: the bracket's reach beyond its post (m), the pod 0.70 m off the walkway's line */
const POST_POD_OUTBOARD = 0.28;
/** wall clearance over the bole's radius (+ its axis drift) across the hut's height band (m) */
export const BOLE_CLEARANCE = 0.06;
/** the wall's radius factor at the eave (it tapers in a little) */
const WALL_TAPER = 0.96;
/** the cap's overhang past the wall radius when a def does not set `capOverhang` (m) */
const CAP_OVERHANG = 0.45;
/**
 * Round 32 (structures-22): the huts' darkest side faces the hero cameras. A/B/D all see each hut
 * from within 7° of its `facingDeg` (hut → camera bearings −12 / −16 / −19° for the hollow column,
 * −19 / −22 / −25° north-east, 9 / 10 / 12° west column) and the sun stands 110° round from
 * there (azimuth −128°), so the camera-facing wall is floor-lit bark and the camera-facing cap
 * half is moss the sun only grazes — both were as pale as the rest and read as a lit hut against
 * frame 56 s's dark hazed trunks. The wall's two-lobe shade (`wallColor`) is now centred on the
 * facing (it used the random wobble's phase) and deepened; the cap's deep-moss share rises on the
 * camera half. Both are vertex tints: no new draws, no RNG stream change (the wobble is still drawn).
 */
const WALL_DARK_LOBE = 0.4;
const CAP_FACING_DARKEN = 0.45;
/** the wall's wobble amplitudes (fractions of the radius): 3 and 7 lobes */
const WOBBLE_3 = 0.045;
const WOBBLE_7 = 0.02;
/** the smallest factor the taper and the wobble ever apply to the nominal radius */
const WALL_MIN_FACTOR = WALL_TAPER * (1 - WOBBLE_3 - WOBBLE_7);
/** the largest (at the floor, where the wall has not tapered yet) */
export const WALL_MAX_FACTOR = 1 + WOBBLE_3 + WOBBLE_7;
/** the bark's stand-off over the wobbled barrel (m): the cords' 1 cm, the collars' 1.5 cm */
const WALL_RELIEF = 0.02;
/** recess depths (m): window tunnel, door tunnel */
const WINDOW_DEPTH = 0.3;
const DOOR_DEPTH = 0.35;
/** the lamp disc's depth into a recess (fraction) */
const LAMP_DEPTH = 0.65;
/**
 * The reveals are hewn wider outside than in (round 20): the window tunnel's radius at the back
 * over its mouth's, and the door reveal's inset at the back (m, each jamb and over the head).
 */
const WINDOW_SPLAY = 0.7;
const DOOR_SPLAY = 0.08;
/** the window lamp hangs high in its recess, a little toward the door: offset across / up (fractions of the window radius) */
const WINDOW_LAMP_OFFSET: [number, number] = [0.12, 0.3];
/** the door lamp: height (fraction of the door's height) and its lateral offset toward the window (m) */
const DOOR_LAMP_H = 0.76;
const DOOR_LAMP_X = 0.1;
/** the bark collar's width outside the opening (m) — it covers the cut's cell edge (was the emissive rim's width) */
const COLLAR_WIDTH = 0.14;
/** the collar's stand-off from the wall surface (m) */
const COLLAR_OUT = 0.015;
/**
 * The reveal's tone curve: irradiance from the lamp (1 / d² at `REVEAL_REF_DIST` m, normal-on) maps
 * to the lit-wood tint, compressed by `REVEAL_GAMMA`; the unlit wood is `REVEAL_DARK`.
 */
const REVEAL_REF_DIST = 0.2;
const REVEAL_GAMMA = 0.75;
/** the reveal's peak tint on the × 2.2 material (0.45 → 0.99 linear, under the fog's 1.3–2.0 exemption ramp) */
const REVEAL_PEAK = 0.45;
/** a reveal vertex above this (linear, on the material) counts as lit in the audit's mouth-row share (a 0.3 tint) */
const REVEAL_LIT_LINEAR = 0.66;
/** the reveal's angular grain: end-grain lobes and knots (fractions of the lit tint) */
const GRAIN_LOBES = 0.28;
const GRAIN_RIPPLE = 0.14;
const KNOT_DEPTH = 0.55;
const KNOT_WIDTH = 0.22;
/** wall cells whose centre is within this of an opening are cut (≥ the fine cells' half diagonal) */
const HOLE_MARGIN = 0.06;
/**
 * fine / coarse wall cell sizes (m): around the openings / elsewhere. Round 41: the coarse cells
 * drop from 0.35 × 0.4 to 0.08 × 0.14 so the bark cords (`cordField`) have vertices to displace.
 */
const FINE_CELL = { around: 0.07, up: 0.1 };
const COARSE_CELL = { around: 0.08, up: 0.14 };

export type HostSource = 'shared' | 'constants';

/** Round 49: a hut's walkable built surfaces for the character ground (ctx.shared.walkSurfaces) */
export type HutWalkSurface = WalkSurface;

/** 2026-09-23: a hut's `character` features as built (null / 0 where the hut has none) */
export interface CharacterAudit {
  ladder: { top: [number, number, number]; foot: [number, number, number]; rungs: number; reach: number } | null;
  railingPosts: number;
  hoist: { tip: [number, number, number]; basket: [number, number, number]; boleGap: number } | null;
  flowers: number;
  sprout: [number, number, number] | null;
  awning: boolean;
  herbs: number;
}

export interface DistantHouseBuild {
  group: Group;
  /** round 55: the dressed huts' crafted near lanterns (their pivots are in `group`) */
  lanterns: LanternRig[];
  /** round 55: the dressed huts' lantern lights, outside `group` (the caller adds them where nothing hides them) */
  lights: PointLight[];
  /** round 49: every hut's platform, deck and wall for the character ground */
  walk: HutWalkSurface[];
  /** every hut's wall as its exact solid, for a caller that gives the play camera it in place of the voxels */
  cameraWalls: CameraWall[];
  /** the one emissive mesh shared by all houses */
  glow: Mesh;
  /**
   * round 45 (details-1): the huts' boarded undersides, one mesh in the fences' material, NOT in
   * `group` — the caller adds it to the hero group so it folds into the fences' static bucket
   */
  soffit: Mesh | null;
  triangles: number;
  /** zero-area triangles left in the huts' geometry (round 18: none — the cap pole and the pod lathes' apexes are filtered) */
  degenerateTriangles: number;
  /** 'shared' when every hut found its seat in `ctx.shared.trunkSeats`, 'constants' when none did */
  hostSource: HostSource | 'mixed';
  /** peak linear channel of each vertex tint on the 2.2 glow material (lamps / pods ≥ 2.0 = fog-exempt) */
  glowTintPeaks: Record<string, number>;
  /** round 20: how the openings' reveals are drawn (no emissive rim; lamp-response tints, their peaks, the mouth rows' lit share) */
  reveal: {
    material: string;
    /** peak of any emissive band on the wall face outside the openings (linear; 0 — the rims are gone) */
    emissiveRimPeak: number;
    /** the reveal tints' peak as built (linear; must stay under the fog's 2.0 exemption) */
    peakLinear: number;
    /** the tunnels' mouth rows' peak (linear) — the outer edge of the reveal, meant to be dark */
    mouthPeakLinear: number;
    /** mean share of mouth-row vertices lit above `litThresholdLinear` (a closed ring would be 1) */
    mouthLitShare: number;
    litThresholdLinear: number;
    darkLinear: number;
    splay: { window: number; door: number };
    lampOffset: { window: [number, number]; door: [number, number] };
    collar: string;
  };
  audit: {
    id: string;
    host: string;
    hostSource: HostSource;
    /** the published seat's id when `hostSource` is 'shared' */
    seatId: string | null;
    centre: [number, number, number];
    floorY: number;
    /** nominal wall radius as built (m): max(authored, radiusForBole) */
    radius: number;
    /**
     * the smallest nominal radius that keeps the wall BOLE_CLEARANCE off the seat's bole (radius +
     * axis drift) over the hut's height band at the wall's tightest factor (m); null without a seat
     */
    radiusForBole: number | null;
    /**
     * smallest gap between the wall's tightest surface and the bole (radius + axis drift) over the
     * hut's height band (m; ≥ BOLE_CLEARANCE by construction); null without a published seat
     */
    boleClearance: number | null;
    window: [number, number, number];
    door: [number, number, number];
    /** the lamp discs inside the window / door recesses */
    lamps: [number, number, number][];
    pods: [number, number, number][];
    /** every emissive element (window lamp, door lamp, pods): world centres */
    litPoints: [number, number, number][];
    /** round 20: this hut's reveal tints — peak, mouth-row peak (linear) and the mouth rows' lit share */
    revealPeak: number;
    revealMouthPeak: number;
    revealMouthLitShare: number;
    /** round 50: the dressing as built (null on the undressed village huts) */
    dressing: { bough: [number, number, number][] | null; boughPods: [number, number, number][]; buttresses: number; fringe: number; room: { depth: number; shallow: boolean; lamp: [number, number, number] } | null } | null;
    /** 2026-09-23: the hut's own features (null without `character`) */
    character: CharacterAudit | null;
  }[];
}

type RGB = [number, number, number];
const DEG = Math.PI / 180;
/** cap moss tones: Saria's cap palette (house.ts domeVertex) */
const MOSS_DEEP: RGB = [0.266, 0.238, 0.052];
const MOSS_SUN: RGB = [0.8, 0.79, 0.17];
const PLANK: RGB = [0.42, 0.35, 0.27];
const PLANK_DARK: RGB = [0.26, 0.21, 0.16];
const WALL: RGB = [0.66, 0.62, 0.55];
const SOFFIT: RGB = [0.3, 0.27, 0.22];
/**
 * round 44: the platform's and deck's undersides were on the glow material at a fixed brown
 * ((0.025, 0.02, 0.0145) × 2.2 ≈ 0.05 linear, a bounce-lit soffit, never a lamp). The first cut,
 * twice that, rendered the deck's bottom at p50 0.30 sRGB from the hollow path (w13-spine-u) — a
 * flat pale panel over the 0.06 joists, since a single grid with alternating vertex tints
 * interpolates to a wave, not boards; so the boards are built as boards (see the soffit block).
 * round 45 (details-1): the boards are lit planks now — this is their vertex tint as set for
 * `wood`'s tint under a lift-8 floor (the planks map × the wood tint × this). Above 1 like the
 * signpost's board (the planks map is dark, ≈ 0.06 linear): the floor is lift × the hemisphere
 * mean × albedo / π, and this tint puts a board at ≈ 0.045 linear, the round-44 level — the
 * tint the floor reads through the map, not the lit deck's. The boards draw in `fenceWood`
 * (materials.ts: the fences' floor, lift 11, a darker tint), so the soffit block applies
 * WOOD_ON_FENCE_WOOD on top to land at that same level.
 */
const SOFFIT_BOARD: RGB = [1.55, 1.32, 1.05];
/** an sRGB hex as a linear tint scaled so its peak channel is `peak` (the glow material is white × 2.2) */
const tint = (hex: number, peak = 1): RGB => {
  const c = new Color(hex);
  const m = Math.max(c.r, c.g, c.b);
  return [(c.r / m) * peak, (c.g / m) * peak, (c.b / m) * peak];
};
/** deep orange (round 16's material hue): the veil mixes 50–65 % warm grey into it at 30–47 m, a paler base read as cream */
const GLOW_AMBER = tint(0xff9a2a);
/** the door lamp: a touch paler than the window's */
const GLOW_DOOR = tint(0xffb45a);
/** the lime pods (the near lanterns' 0xd2ee48) */
const GLOW_LIME = tint(0xd2ee48);
/** the reveal's lit wood (round 20): the lamp's orange on warm wood, peak REVEAL_PEAK on the material */
const REVEAL_WOOD = tint(0xffa244, REVEAL_PEAK);
/** the reveal's unlit wood and the recess backs: near-black warm (0.044 linear on the material) */
const REVEAL_DARK: RGB = [0.02, 0.016, 0.012];
/** dark, unlit parts riding in the glow mesh: pod caps and fins, stems */
const POD_CAP: RGB = [0.05, 0.075, 0.025];
const POD_STEM: RGB = [0.06, 0.045, 0.03];
/** round 55: the pods' bent-wood frame at distant LOD */
const POD_FRAME: RGB = [0.045, 0.032, 0.02];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number, m = 1): RGB => [lerp(a[0], b[0], t) * m, lerp(a[1], b[1], t) * m, lerp(a[2], b[2], t) * m];
const scaleRGB = (c: RGB, m: number): RGB => [c[0] * m, c[1] * m, c[2] * m];
const az = (deg: number) => new Vector3(Math.sin(deg * DEG), 0, Math.cos(deg * DEG));
/** signed angular difference a − a0 wrapped to (−π, π] */
const dAngle = (a: number, a0: number) => {
  let d = (a - a0) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
};

/** a box between two points (posts, rails, ropes, stems, bars) */
function bar(a: Vector3, b: Vector3, t: number, color: RGB, t2 = t): BufferGeometry {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new BoxGeometry(t, t2, len);
  geo.applyMatrix4(basisMatrix(a.clone().lerp(b, 0.5), dir));
  return setColorAttribute(geo, color);
}

/** a round rod from a (radius r) to b (radius r2): rungs, posts, pegs — seen from 2 m a box bar reads square */
function rod(a: Vector3, b: Vector3, r: number, color: RGB, sides = 6, r2 = r, open = true): BufferGeometry {
  const dir = b.clone().sub(a);
  const geo = new CylinderGeometry(r2, r, dir.length(), sides, 1, open);
  geo.rotateX(Math.PI / 2);
  geo.applyMatrix4(basisMatrix(a.clone().lerp(b, 0.5), dir));
  return setColorAttribute(geo, color);
}

/** a horizontal annulus (disc when r0 ≈ 0) at height y; faces down unless `up` */
function ring(c: Vector3, r0: number, r1: number, y: number, up: boolean, color: (v: number) => RGB, cols = 24, rows = 2): BufferGeometry {
  return gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const r = lerp(r0, r1, v);
      out.position.set(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r);
      out.uv = [Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5];
      out.color = color(v);
    },
    { cols, rows, closedU: true, flip: up },
  );
}

/** a filled arch (rectangle with a semicircular top) as a fan, on the plane through `c` facing `n` */
function archFan(c: Vector3, n: Vector3, w: number, h: number, color: RGB): BufferGeometry {
  // right × up = n, so the fan's front face is the outside of the wall
  const right = new Vector3(n.z, 0, -n.x).normalize();
  const up = new Vector3(0, 1, 0);
  const pts: [number, number][] = [];
  const r = w / 2;
  pts.push([-r, 0], [r, 0]);
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push([Math.cos(a) * r, h - r + Math.sin(a) * r]);
  }
  const positions: number[] = [c.x, c.y + h / 2, c.z];
  const normals: number[] = [n.x, n.y, n.z];
  const uvs: number[] = [0.5, 0.5];
  for (const [x, y] of pts) {
    positions.push(c.x + right.x * x + up.x * y, c.y + right.y * x + up.y * y, c.z + right.z * x + up.z * y);
    normals.push(n.x, n.y, n.z);
    uvs.push(0.5 + x / w, y / h);
  }
  const index: number[] = [];
  for (let i = 1; i < pts.length; i++) index.push(0, i, i + 1);
  index.push(0, pts.length, 1);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  return setColorAttribute(geo, color);
}

/** a disc facing `n` (lamps, recess backs) */
function facingDisc(c: Vector3, n: Vector3, r: number, color: RGB, segs = 20): BufferGeometry {
  const right = new Vector3(-n.z, 0, n.x).normalize();
  const up = new Vector3().crossVectors(n, right).normalize();
  if (up.y < 0) up.negate();
  return gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const rr = lerp(0.001, r, v);
      out.position.copy(c).addScaledVector(right, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * rr);
      out.uv = [0.5 + Math.cos(a) * v * 0.5, 0.5 + Math.sin(a) * v * 0.5];
      out.color = color;
    },
    { cols: segs, rows: 2, closedU: true, flip: right.clone().cross(up).dot(n) < 0 },
  );
}

/**
 * Make an indexed surface face `toward` (a point on its inner side): gridSurface orients by its
 * parameter order, so recess tunnels and floors are checked at a vertex and flipped when needed.
 */
function faceToward(geo: BufferGeometry, toward: Vector3): BufferGeometry {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const idx = geo.index;
  if (!idx || !nor) return geo;
  // the first non-degenerate triangle's geometric normal against the direction to `toward`
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  for (let t = 0; t + 2 < idx.count; t += 3) {
    a.fromBufferAttribute(pos, idx.getX(t));
    b.fromBufferAttribute(pos, idx.getX(t + 1));
    c.fromBufferAttribute(pos, idx.getX(t + 2));
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (n.lengthSq() < 1e-10) continue;
    const centroid = a.add(b).add(c).multiplyScalar(1 / 3);
    if (n.dot(toward.clone().sub(centroid)) >= 0) return geo;
    break;
  }
  const arr = idx.array as Uint16Array | Uint32Array;
  for (let t = 0; t + 2 < arr.length; t += 3) {
    const tmp = arr[t + 1];
    arr[t + 1] = arr[t + 2];
    arr[t + 2] = tmp;
  }
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
  return geo;
}

/** drop zero-area triangles (a collapsed pole row, a lathe's apex fan) from an indexed geometry */
function dropDegenerate(geo: BufferGeometry): BufferGeometry {
  const idx = geo.index;
  if (!idx) return geo;
  const pos = geo.attributes.position;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const kept: number[] = [];
  for (let t = 0; t + 2 < idx.count; t += 3) {
    const i0 = idx.getX(t);
    const i1 = idx.getX(t + 1);
    const i2 = idx.getX(t + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    b.sub(a);
    c.sub(a);
    if (b.cross(c).lengthSq() > 1e-14) kept.push(i0, i1, i2);
  }
  if (kept.length !== idx.count) geo.setIndex(kept);
  return geo;
}

/** zero-area triangles in an indexed geometry (the audit's check on `dropDegenerate`) */
function countDegenerate(geo: BufferGeometry): number {
  const idx = geo.index;
  if (!idx) return 0;
  const pos = geo.attributes.position;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let n = 0;
  for (let t = 0; t + 2 < idx.count; t += 3) {
    a.fromBufferAttribute(pos, idx.getX(t));
    b.fromBufferAttribute(pos, idx.getX(t + 1)).sub(a);
    c.fromBufferAttribute(pos, idx.getX(t + 2)).sub(a);
    if (b.cross(c).lengthSq() <= 1e-14) n++;
  }
  return n;
}

function triangles(g: BufferGeometry): number {
  return Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
}

/** irradiance from a point lamp at `lamp` on a surface at `p` with inward normal `n`: cos / d² (0 when facing away) */
function lampIrradiance(lamp: Vector3, p: Vector3, n: Vector3): number {
  const dx = lamp.x - p.x;
  const dy = lamp.y - p.y;
  const dz = lamp.z - p.z;
  const d2 = Math.max(dx * dx + dy * dy + dz * dz, 1e-4);
  const cos = (dx * n.x + dy * n.y + dz * n.z) / Math.sqrt(d2);
  return Math.max(0, cos) / d2;
}

/**
 * The reveal's wood under the lamp (round 20): irradiance → lit share through the tone curve, times
 * the local grain, between the unlit wood and the lit-wood tint. Never above REVEAL_WOOD.
 */
function revealTint(irradiance: number, grain: number): RGB {
  const lit = clamp(Math.pow(Math.min(1, irradiance * REVEAL_REF_DIST * REVEAL_REF_DIST), REVEAL_GAMMA) * grain, 0, 1);
  return mix(REVEAL_DARK, REVEAL_WOOD, lit);
}

/**
 * Angular grain of a hewn reveal, a function of the angle round the opening (or of the position
 * along the door's edge mapped onto 2π): three end-grain lobes, finer ripples, two or three dark
 * knots — so the lit band is uneven and broken, never one intensity all round. Draws from `rng`.
 */
function revealGrain(rng: Rng): (theta: number) => number {
  const phase = rng.range(0, TAU);
  const knots: number[] = [];
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) knots.push(rng.range(0, TAU));
  return (theta) => {
    let g = 0.78 + GRAIN_LOBES * Math.sin(3 * theta + phase) + GRAIN_RIPPLE * Math.sin(7 * theta - 2 * phase) + 0.08 * Math.sin(13 * theta + phase);
    for (const k of knots) {
      const d = dAngle(theta, k) / KNOT_WIDTH;
      g *= 1 - KNOT_DEPTH * Math.exp(-d * d);
    }
    return clamp(g, 0.3, 1.2);
  };
}

/**
 * The deku pod at distant LOD: the near lanterns' body and cap profiles (lantern.ts BODY_PROFILE /
 * CAP_PROFILE, x radius / y height at scale 1) — a teardrop lit body, widest at 0.2 and pointed
 * below, aspect 0.315 / 0.296 ≈ 1.06 for the lit part and 0.41 / 0.32 ≈ 1.3 with the dark cap —
 * so the far pods are the near ones' shape, not spheres.
 */
const POD_BODY: [number, number][] = [
  [0.012, 0.0],
  [0.055, 0.025],
  [0.1, 0.075],
  [0.135, 0.14],
  [0.148, 0.2],
  [0.14, 0.255],
  [0.115, 0.295],
  [0.08, 0.315],
];
/** the dark cap over the body's top */
const POD_CAP_PROFILE: [number, number][] = [
  [0.085, 0.3],
  [0.15, 0.285],
  [0.16, 0.315],
  [0.14, 0.35],
  [0.095, 0.385],
  [0.04, 0.405],
  [0.0, 0.41],
];
const POD_TOP = 0.41;
const POD_STEM_H = 0.07;
/** the lit body's widest height (the audit's pod centre) */
const POD_BODY_MID = 0.2;

/** the body's radius at height y (scale 1), for the fins to ride on */
function podBodyRadius(y: number): number {
  for (let i = 0; i + 1 < POD_BODY.length; i++) {
    const [r0, y0] = POD_BODY[i];
    const [r1, y1] = POD_BODY[i + 1];
    if (y <= y1) return lerp(r0, r1, clamp((y - y0) / (y1 - y0), 0, 1));
  }
  return POD_BODY[POD_BODY.length - 1][0];
}

/**
 * A leaf-wrapped pod hanging with its stem top at `top`: the near lanterns' teardrop lit body
 * (bottom brightest, like their gradient), dark cap, four dark sepal fins curling down the body,
 * a stem. One geometry on the glow material; `s` scales the unit profile (body radius 0.148 s).
 */
function distantPod(top: Vector3, s: number, body: RGB, rng: Rng): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const lathe = (profile: [number, number][], segs: number) => new LatheGeometry(profile.map(([x, y]) => new Vector2(x * s, y * s)), segs);
  const bodyGeo = lathe(POD_BODY, 10);
  {
    const pos = bodyGeo.attributes.position;
    setColorAttribute(bodyGeo, (i) => {
      const q = clamp(pos.getY(i) / (POD_BODY[POD_BODY.length - 1][1] * s), 0, 1);
      return scaleRGB(body, lerp(1, 0.45, q));
    });
    parts.push(bodyGeo);
  }
  parts.push(setColorAttribute(lathe(POD_CAP_PROFILE, 10), POD_CAP));
  const stem = new CylinderGeometry(0.012 * s, 0.018 * s, POD_STEM_H * s, 6);
  stem.translate(0, (POD_TOP + POD_STEM_H / 2) * s, 0);
  parts.push(setColorAttribute(stem, POD_STEM));
  // sepal fins: from under the cap's brim down past the belly to 25–35 % of the body, standing
  // 1.5 cm off it, tapering to a point; a little uneven in length and set
  const phase = rng.range(0, TAU);
  for (let f = 0; f < 4; f++) {
    const phi0 = phase + (f / 4) * TAU + rng.range(-0.15, 0.15);
    const yTop = 0.29;
    const yTip = rng.range(0.08, 0.11);
    const width = 0.09 * rng.range(0.85, 1.1);
    parts.push(
      gridSurface(
        (u, v, out) => {
          const y = lerp(yTop, yTip, u);
          const r = podBodyRadius(y) + 0.015;
          const w = width * Math.pow(1 - u, 0.7);
          const phi = phi0 + ((v - 0.5) * w) / Math.max(r, 0.02);
          out.position.set(Math.cos(phi) * r * s, y * s, Math.sin(phi) * r * s);
          out.uv = [v, u];
          out.color = POD_CAP;
        },
        { cols: 2, rows: 6 },
      ),
    );
  }
  // round 55: the crafted lantern's frame at distant LOD (lantern.ts lanternFrame) — six dark ribs
  // standing off the body between the fins and a hoop round its foot, so a hut's pod seen from
  // under its platform reads as a framed lantern rather than a bare glow (no draw from `rng`)
  for (let k = 0; k < 6; k++) {
    const phi = phase + ((k + 0.5) / 6) * TAU;
    parts.push(
      gridSurface(
        (u, v, out) => {
          const y = lerp(0.03, 0.3, u);
          const r = podBodyRadius(y) + 0.007;
          const phiV = phi + ((v - 0.5) * 0.012) / Math.max(r, 0.02);
          out.position.set(Math.cos(phiV) * r * s, y * s, Math.sin(phiV) * r * s);
          out.uv = [v, u];
          out.color = POD_FRAME;
        },
        { cols: 2, rows: 6 },
      ),
    );
  }
  const hoop = new TorusGeometry((podBodyRadius(0.035) + 0.005) * s, 0.008 * s, 3, 10);
  hoop.rotateX(Math.PI / 2);
  hoop.translate(0, 0.035 * s, 0);
  parts.push(setColorAttribute(hoop, POD_FRAME));
  const geo = dropDegenerate(merge(parts));
  geo.translate(top.x, top.y - (POD_TOP + POD_STEM_H) * s, top.z);
  return geo;
}

interface Host {
  source: HostSource;
  seat: TrunkSeat | null;
  /** base (terrain contact) of the bole */
  base: Vector3;
  /** bole axis at height h above the base (world x/z; y = base.y + h) */
  axisAt(h: number, out: Vector3): Vector3;
}

/** the hut's host: the nearest published seat within HOST_MATCH_M of the constants, else the constants */
function resolveHost(def: DistantHouseDef, ctx: WorldContext): Host {
  const seats = ctx.shared.trunkSeats;
  if (seats && seats.length > 0) {
    let best: TrunkSeat | null = null;
    let bestD = Infinity;
    for (const s of seats) {
      const d = Math.hypot(s.x - def.host.x, s.z - def.host.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best && bestD <= HOST_MATCH_M) {
      const seat = best;
      return {
        source: 'shared',
        seat,
        base: new Vector3(seat.x, seat.y, seat.z),
        axisAt: (h, out) => seat.axisAt(h, out),
      };
    }
  }
  const base = new Vector3(def.host.x, ctx.terrain.height(def.host.x, def.host.z), def.host.z);
  return { source: 'constants', seat: null, base, axisAt: (h, out) => out.set(base.x, base.y + h, base.z) };
}

/**
 * Build the distant houses. Returns one group holding, per house, a bark mesh (walls, soffit), a
 * recess-bark mesh (the openings' tunnels and backs), a plank mesh (platform, walkway, window
 * bars, hangers) and a cap-moss mesh — all on the shared house materials at the identity
 * transform so the system's consolidation pass folds them into the existing draws — plus one
 * emissive mesh for every house's lamps, rims and pods.
 */
export function buildDistantHouses(ctx: WorldContext, mats: StructureMaterials, rng: Rng, defs: DistantHouseDef[] = DISTANT_HOUSES): DistantHouseBuild {
  const group = new Group();
  group.name = 'distant-houses';
  const glowParts: BufferGeometry[] = [];
  /** round 55: the dressed huts' crafted lanterns (the near lanterns, swung by the structures system) */
  const lanterns: LanternRig[] = [];
  /** round 55: their lights — NOT in `group` (the caller keeps them in the scene whatever hides the hut, so the light count never changes) */
  const lights: PointLight[] = [];
  /** round 45 (details-1): the huts' soffit boards, one mesh in `mats.fenceWood` (see `soffit`) */
  const soffitParts: BufferGeometry[] = [];
  const audit: DistantHouseBuild['audit'] = [];
  const walk: HutWalkSurface[] = [];
  const cameraWalls: CameraWall[] = [];
  let tris = 0;
  let degenerate = 0;
  const _axis = new Vector3();
  /** round 40: the cushion lumps' outline noise (one field for the village) */
  const tuftNoise = new Noise3D(rng.fork('moss-tuft-noise'));

  for (const def of defs) {
    const r = rng.fork(def.id);
    const host = resolveHost(def, ctx);
    // round 49: an absolute floor (the west house) overrides the seat-relative one
    const floorH = def.floorAbsolute !== undefined ? def.floorAbsolute - host.base.y : def.floor;
    const floorY = host.base.y + floorH;
    const eaveY = floorY + def.wall;
    // the hut sits on the bole's axis at floor height (plus the authored offset)
    const axisFloor = host.axisAt(floorH, _axis).clone();
    const c = new Vector3(axisFloor.x + def.offset[0], floorY, axisFloor.z + def.offset[1]);
    /** a ring's uv u (`tile` m a repeat): whole repeats with `seamlessRings`, else angle × radius as the village's huts have it */
    const ringU = (u: number, radius: number, tile: number) => (def.seamlessRings ? u * repeatsRound(radius, tile) : (u * TAU * radius) / tile);
    const sealRing = (g: BufferGeometry, cols: number) => (def.seamlessRings ? seamUV(g, cols) : g);

    // ---- wall radius: over the hut's height band (platform underside → soffit), the bole's radius
    // plus its axis drift from the hut centre, + BOLE_CLEARANCE, at the wall's tightest factor ----
    let R = def.radius;
    let radiusForBole: number | null = null;
    let boleClearance: number | null = null;
    if (host.seat) {
      const seat = host.seat;
      let need = 0;
      for (let h = floorH - 0.3; h <= floorH + def.wall + 0.15 + 1e-6; h += 0.1) {
        seat.axisAt(h, _axis);
        need = Math.max(need, seat.radiusAt(h) + Math.hypot(_axis.x - c.x, _axis.z - c.z));
      }
      // the authored radius is the hut's scale (door 0.7 m, window 0.24 R); the bole only ever
      // grows it — the west column's slim seat (bole 0.5 m at 6 m) would otherwise shrink that
      // hut to a 0.7 m barrel narrower than its door
      radiusForBole = (need + BOLE_CLEARANCE) / WALL_MIN_FACTOR;
      R = Math.max(def.radius, radiusForBole);
      boleClearance = Infinity;
      for (let h = floorH - 0.3; h <= floorH + def.wall + 0.15 + 1e-6; h += 0.1) {
        seat.axisAt(h, _axis);
        const taper = lerp(1, WALL_TAPER, clamp((h - floorH) / def.wall, 0, 1));
        const wallMin = R * taper * (1 - WOBBLE_3 - WOBBLE_7);
        boleClearance = Math.min(boleClearance, wallMin - seat.radiusAt(h) - Math.hypot(_axis.x - c.x, _axis.z - c.z));
      }
    }
    const facing = az(def.facingDeg);
    const wobble = r.range(0, TAU);
    const wallR = (a: number) => R * (1 + WOBBLE_3 * Math.sin(3 * a + wobble) + WOBBLE_7 * Math.sin(7 * a - wobble));
    /** the wall surface at angle a (world xz, from +x toward +z) and height y, `out` metres outside it */
    const wallSurface = (a: number, y: number, out: Vector3, outside = 0) => {
      const rr = wallR(a) * lerp(1, WALL_TAPER, clamp((y - floorY) / def.wall, 0, 1)) + outside;
      return out.set(c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr);
    };
    const wallAt = (dir: Vector3, y: number, out: number) => wallSurface(Math.atan2(dir.z, dir.x), y, new Vector3(), out);
    cameraWalls.push({
      id: def.id,
      x: c.x,
      z: c.z,
      y0: floorY,
      y1: eaveY,
      rMax: R * WALL_MAX_FACTOR + WALL_RELIEF,
      radiusAt: (a, y) => wallR(a) * lerp(1, WALL_TAPER, clamp((y - floorY) / def.wall, 0, 1)) + WALL_RELIEF,
    });

    // ---- openings, in wall coordinates (angle a, height y) ----
    const aWin = Math.atan2(facing.z, facing.x);
    const winY = floorY + 1.35;
    const winR = R * 0.24;
    const doorDir = az(def.facingDeg + def.doorDeg);
    const aDoor = aWin + dAngle(Math.atan2(doorDir.z, doorDir.x), aWin);
    const doorW = def.doorSize?.[0] ?? 0.7;
    const doorH = def.doorSize?.[1] ?? 1.35;
    /** the arch's straight height (the semicircle sits above it) */
    const doorHs = doorH - doorW / 2;
    const inWindow = (a: number, y: number, margin: number) => Math.hypot(dAngle(a, aWin) * R, y - winY) < winR + margin;
    const inDoor = (a: number, y: number, margin: number) => {
      const x = dAngle(a, aDoor) * R;
      const yl = y - floorY;
      return (Math.abs(x) < doorW / 2 + margin && yl < doorHs) || Math.hypot(x, yl - doorHs) < doorW / 2 + margin;
    };

    // ---- bark: the wall in two patches — fine cells around the openings (cut where a cell's
    // centre is within HOLE_MARGIN of an opening), coarse cells round the rest — plus the eave
    // soffit and the collars that cover the cuts' ragged cell edges in the wall's own shade ----
    /** the wall's vertex shade at angle a and height fraction v (floor → eave): two dark lobes, the deeper one on the camera-facing side (see WALL_DARK_LOBE) */
    const wallColor = (a: number, v: number): RGB => {
      const toward = Math.cos(a - aWin);
      const lobe = Math.max(0, Math.cos(2 * (a - aWin))) * lerp(0.55, 1, 0.5 + 0.5 * toward);
      const shade = lerp(0.72, 1, v) * (1 - WALL_DARK_LOBE * lobe);
      return [WALL[0] * shade, WALL[1] * shade, WALL[2] * shade];
    };
    /**
     * Round 41 (structures-26): BARK CORDS on the wall. From the landing [16.24, 7.2, −7.07] the
     * huts stand 21–33 m out (45–70 px per metre) and their walls read as smooth barrels: the
     * coarse patch was 0.35 × 0.4 m cells on a wobbled cylinder with only the normal map for
     * relief. The wall is now cut by a periodic ridged cord field (`cordField`: 12–20 cm cords
     * running near-vertically with a slow lean, two octaves, sampled round a circle so the seam
     * matches) — furrows 3.5 cm IN, cords 1 cm OUT (under the collars' 1.5 cm stand-off), the
     * relief fading to nothing within the collar band round each opening so the collars still
     * cover the cut cells' edges — and the furrows carry grime (× 0.55) with a little moss tint
     * on the shaded lower third. The coarse patch's cells drop to `CORD_CELL` so the cords have
     * vertices to live on (≈ 4–6 k triangles per hut, was ≈ 0.5 k).
     */
    const cordRng = r.fork('bark-cords');
    const cordLean = cordRng.range(-0.35, 0.35);
    const cordNoise = new Noise3D(cordRng);
    const cordField = (a: number, y: number): number => {
      const yl = y - floorY;
      const sweep = a + cordLean * yl * 0.25;
      const s1 = R * 0.62;
      const s2 = R * 1.55;
      // two ridged octaves; the fine one is weighted down so the coarse cords carry the read
      const r1 = 1 - Math.abs(cordNoise.noise(Math.cos(sweep) * s1 * 4.2, yl * 0.9, Math.sin(sweep) * s1 * 4.2));
      const r2 = 1 - Math.abs(cordNoise.noise(Math.cos(sweep) * s2 * 4.2 + 7.3, yl * 2.4 + 2.1, Math.sin(sweep) * s2 * 4.2));
      return clamp(r1 * r1 * 0.75 + r2 * r2 * 0.35, 0, 1);
    };
    /** relief fade: 0 inside the openings' collar band (+5 cm), 1 elsewhere, 0 on the eave row */
    const cordFade = (a: number, y: number, v: number): number => {
      const band = COLLAR_WIDTH + HOLE_MARGIN + 0.05;
      const dw = Math.hypot(dAngle(a, aWin) * R, y - winY) - winR;
      const xd = dAngle(a, aDoor) * R;
      const yl = y - floorY;
      const dd = yl < doorHs ? Math.abs(xd) - doorW / 2 : Math.hypot(xd, yl - doorHs) - doorW / 2;
      const near = Math.min(dw, dd);
      return smoothstep(0, band, near) * (1 - smoothstep(0.9, 1, v));
    };
    const cordDepth = (a: number, y: number, v: number): number => {
      const c1 = cordField(a, y);
      return lerp(-0.035, 0.01, c1) * cordFade(a, y, v);
    };
    const wallPatch = (a0: number, a1: number, cell: { around: number; up: number }, hole?: (a: number, y: number) => boolean) => {
      const cols = Math.max(2, Math.ceil(((a1 - a0) * R) / cell.around));
      const rows = Math.max(2, Math.round(def.wall / cell.up) + 1);
      return gridSurface(
        (u, v, out) => {
          const a = lerp(a0, a1, u);
          const y = lerp(floorY, eaveY, v);
          wallSurface(a, y, out.position, cordDepth(a, y, v));
          out.uv = [(a * R) / 1.6, (v * def.wall) / 1.6];
          const base = wallColor(a, v);
          const cord = cordField(a, y);
          const fade = cordFade(a, y, v);
          // grime in the furrows; a moss tint low on the camera-facing (shaded) side
          const grime = lerp(1, lerp(0.55, 1.08, cord), fade);
          const shaded = Math.max(0, Math.cos(a - aWin));
          const mossy = (1 - cord) * fade * shaded * (1 - smoothstep(0.1, 0.45, v)) * 0.55;
          out.color = [
            lerp(base[0] * grime, MOSS_DEEP[0] * 1.4, mossy),
            lerp(base[1] * grime, MOSS_DEEP[1] * 1.7, mossy),
            lerp(base[2] * grime, MOSS_DEEP[2] * 1.4, mossy),
          ];
        },
        { cols, rows, hole: hole ? (u, v) => hole(lerp(a0, a1, u), lerp(floorY, eaveY, v)) : undefined },
      );
    };
    const spanWin = (winR + COLLAR_WIDTH + 0.1) / R;
    const spanDoor = (doorW / 2 + COLLAR_WIDTH + 0.1) / R;
    const aFine0 = Math.min(aWin - spanWin, aDoor - spanDoor);
    const aFine1 = Math.max(aWin + spanWin, aDoor + spanDoor);
    const walls = [
      wallPatch(aFine0, aFine1, FINE_CELL, (a, y) => inWindow(a, y, HOLE_MARGIN) || inDoor(a, y, HOLE_MARGIN)),
      wallPatch(aFine1, aFine0 + TAU, COARSE_CELL),
    ];
    const eaveR = R + (def.capOverhang ?? CAP_OVERHANG);
    const soffit = ring(c, R * 0.95, eaveR, eaveY, false, () => SOFFIT, 28, 2);

    // ---- the openings' reveals (round 20, see the header): splayed tunnels on the glow material,
    // each vertex tinted by the lamp's irradiance on it through `revealTint` and the hewn grain;
    // dark backs; bark collars over the cuts. The grain draws from its own stream so the hut's
    // wobble / cap / pod draws are unchanged. ----
    const winGrain = revealGrain(r.fork('reveal/window'));
    const doorGrain = revealGrain(r.fork('reveal/door'));
    const _n = new Vector3();
    const _rad = new Vector3();
    /** direction of increasing wall angle at the window / door (the reveals' lateral axes) */
    const winTangent = new Vector3(-Math.sin(aWin), 0, Math.cos(aWin));
    const doorTangent = new Vector3(-Math.sin(aDoor), 0, Math.cos(aDoor));
    /** +1 when the door lies at increasing wall angle from the window */
    const toDoor = Math.sign(dAngle(aDoor, aWin)) || 1;

    // window: the lamp hangs high and toward the door; the tunnel narrows to WINDOW_SPLAY at the back
    const winC = wallSurface(aWin, winY, new Vector3());
    const winLamp = winC
      .clone()
      .addScaledVector(winTangent, toDoor * WINDOW_LAMP_OFFSET[0] * winR)
      .addScaledVector(facing, -LAMP_DEPTH * WINDOW_DEPTH);
    winLamp.y += WINDOW_LAMP_OFFSET[1] * winR;
    const winRadius = (v: number) => winR * lerp(1, WINDOW_SPLAY, v);
    const winSplaySlope = ((1 - WINDOW_SPLAY) * winR) / WINDOW_DEPTH;
    const winTunnel = sealRing(
      gridSurface(
        (u, v, out) => {
          const th = u * TAU;
          const rr = winRadius(v);
          wallSurface(aWin + (Math.cos(th) * rr) / R, winY + Math.sin(th) * rr, out.position, COLLAR_OUT * (1 - v)).addScaledVector(facing, -v * WINDOW_DEPTH);
          out.uv = [ringU(u, winR, 1.6), (v * WINDOW_DEPTH) / 1.6];
          // the splayed tunnel's inward normal: toward the axis, tilted out toward the mouth
          _rad.copy(winTangent).multiplyScalar(Math.cos(th));
          _rad.y += Math.sin(th);
          _n.copy(_rad).multiplyScalar(-1).addScaledVector(facing, winSplaySlope).normalize();
          out.color = revealTint(lampIrradiance(winLamp, out.position, _n), winGrain(th));
        },
        { cols: 20, rows: 4, closedU: true },
      ),
      20,
    );
    const winBack = winC.clone().addScaledVector(facing, -WINDOW_DEPTH);
    const winBackDisc = facingDisc(winBack, facing, winRadius(1) + 0.01, REVEAL_DARK, 16);
    const winCollar = faceToward(
      gridSurface(
        (u, v, out) => {
          const th = u * TAU;
          const rr = lerp(winR - 0.01, winR + COLLAR_WIDTH, v);
          const a = aWin + (Math.cos(th) * rr) / R;
          const y = winY + Math.sin(th) * rr;
          wallSurface(a, y, out.position, COLLAR_OUT);
          out.uv = [(a * R) / 1.6, (y - floorY) / 1.6];
          out.color = wallColor(a, clamp((y - floorY) / def.wall, 0, 1));
        },
        { cols: 20, rows: 2, closedU: true },
      ),
      winC.clone().addScaledVector(facing, 1),
    );

    // door: jambs + arch head as one splayed tunnel, a threshold, a dark back; the lamp high under
    // the head, toward the window
    /** the door outline at s ∈ [0, 1] (left jamb up, over the arch, right jamb down) → local (x, y) and its outward normal */
    const doorEdge = (s: number): { x: number; y: number; nx: number; ny: number } => {
      if (s < 1 / 3) return { x: -doorW / 2, y: (s * 3) * doorHs, nx: -1, ny: 0 };
      if (s < 2 / 3) {
        const phi = Math.PI - (s * 3 - 1) * Math.PI;
        return { x: (Math.cos(phi) * doorW) / 2, y: doorHs + (Math.sin(phi) * doorW) / 2, nx: Math.cos(phi), ny: Math.sin(phi) };
      }
      return { x: doorW / 2, y: (1 - (s * 3 - 2)) * doorHs, nx: 1, ny: 0 };
    };
    const doorEdgeLen = 2 * doorHs + (Math.PI * doorW) / 2;
    const doorBase = wallSurface(aDoor, floorY + 0.02, new Vector3());
    const doorLamp = wallSurface(aDoor + (-toDoor * DOOR_LAMP_X) / R, floorY + DOOR_LAMP_H * doorH, new Vector3()).addScaledVector(doorDir, -LAMP_DEPTH * DOOR_DEPTH);
    const doorSplaySlope = DOOR_SPLAY / DOOR_DEPTH;
    const doorTunnel = gridSurface(
      (u, v, out) => {
        const e = doorEdge(u);
        const inset = DOOR_SPLAY * v;
        wallSurface(aDoor + (e.x - e.nx * inset) / R, floorY + Math.max(0, e.y - e.ny * inset), out.position, COLLAR_OUT * (1 - v)).addScaledVector(doorDir, -v * DOOR_DEPTH);
        out.uv = [(u * doorEdgeLen) / 1.6, (v * DOOR_DEPTH) / 1.6];
        _n.copy(doorTangent).multiplyScalar(-e.nx);
        _n.y -= e.ny;
        _n.addScaledVector(doorDir, doorSplaySlope).normalize();
        out.color = revealTint(lampIrradiance(doorLamp, out.position, _n), doorGrain(u * TAU));
      },
      { cols: 24, rows: 4 },
    );
    const doorFloor = gridSurface(
      (u, v, out) => {
        const half = doorW / 2 - DOOR_SPLAY * v;
        wallSurface(aDoor + lerp(-half, half, u) / R, floorY + 0.015, out.position).addScaledVector(doorDir, -v * DOOR_DEPTH);
        out.uv = [u * doorW, (v * DOOR_DEPTH) / 1.6];
        _n.set(0, 1, 0);
        out.color = revealTint(lampIrradiance(doorLamp, out.position, _n), 0.8);
      },
      { cols: 2, rows: 2 },
    );
    const doorBackW = doorW + 0.02 - 2 * DOOR_SPLAY;
    const doorBack = archFan(doorBase.clone().addScaledVector(doorDir, -DOOR_DEPTH), doorDir, doorBackW, doorHs + doorBackW / 2, REVEAL_DARK);
    const doorCollar = faceToward(
      gridSurface(
        (u, v, out) => {
          const e = doorEdge(u);
          const t = lerp(-0.01, COLLAR_WIDTH, v);
          const a = aDoor + (e.x + e.nx * t) / R;
          const y = floorY + Math.max(0, e.y + e.ny * t);
          wallSurface(a, y, out.position, COLLAR_OUT);
          out.uv = [(a * R) / 1.6, (y - floorY) / 1.6];
          out.color = wallColor(a, clamp((y - floorY) / def.wall, 0, 1));
        },
        { cols: 24, rows: 2 },
      ),
      doorBase.clone().setY(floorY + doorH / 2).addScaledVector(doorDir, 1),
    );
    // the reveal's tints as built (audit): its peak, the mouth row's peak and the share of the mouth
    // row that is lit above REVEAL_LIT_LINEAR — the in-scene proxy for a closed ring
    const glowPeak = distantGlowPeak(mats);
    const revealPeak = Math.max(tintPeak(winTunnel, glowPeak), tintPeak(doorTunnel, glowPeak));
    const mouthPeak = Math.max(tintPeak(winTunnel, glowPeak, 21), tintPeak(doorTunnel, glowPeak, 24));
    const mouthLit = (tintLitShare(winTunnel, glowPeak, 21, REVEAL_LIT_LINEAR) + tintLitShare(doorTunnel, glowPeak, 24, REVEAL_LIT_LINEAR)) / 2;
    /**
     * Round 50 (structures-33, `dressing.interior`): the LIT ROOM GLIMPSE. Behind the 0.35 m
     * reveal the door's dark back becomes a room ROOM_DEPTH deep — a back wall, two side walls,
     * a plank floor and a dark ceiling, all tinted by a second lamp hung inside (cos / d² with a
     * 0.6 m reference distance: the back wall 1 m off is ≈ half lit, the floor under the lamp
     * lit), a shelf with two pots against the back wall, and the lamp disc itself (the one
     * strongly emissive point of the room, 2.2 linear like the door lamp). Every surface tint
     * peaks at REVEAL_PEAK (0.99 linear) — lit wood, under the fog's 2.0 exemption — so from
     * the deck the doorway reads as the main house's warm room and not as a lamp.
     */
    const roomParts: BufferGeometry[] = [];
    let roomLamp: Vector3 | null = null;
    /**
     * How deep a room fits behind the door before the HOST BOLE. The wall clears the bole by
     * BOLE_CLEARANCE at its tightest, so a hut wrapping a bole has the bole ≈ 0.4 m behind its
     * door (the west house round the southwest giant: the door's 3 m view showed the giant's
     * mossy root flare filling the doorway through a 1.3 m room, and the flare — beyond the
     * seat's nominal `radiusAt` — already showed at the sill through take-0123's 0.35 m reveal).
     * The nominal gap over the door's height less 0.12 m, floored at the reveal's depth; a hut on
     * a plain column (no seat) takes the column as 0.55 R, as the ladder does. Below
     * DOOR_DEPTH + 0.08 the room is SHALLOW: the lit back wall and the lamp only, a hand behind
     * the reveal, no box.
     */
    let roomDepth = Math.min(1.3, Math.max(0.7, R - 1.1));
    {
      let gap = Infinity;
      for (let h = floorH; h <= floorH + doorH + 1e-6; h += 0.15) {
        const bole = host.seat ? host.seat.radiusAt(h) : R * 0.55;
        host.axisAt(h, _axis);
        const toward = (_axis.x - c.x) * Math.cos(aDoor) + (_axis.z - c.z) * Math.sin(aDoor);
        const taper = lerp(1, WALL_TAPER, clamp(h - floorH, 0, def.wall) / def.wall);
        gap = Math.min(gap, wallR(aDoor) * taper - bole - toward);
      }
      roomDepth = clamp(gap - 0.12, DOOR_DEPTH + 0.02, roomDepth);
    }
    const shallowRoom = roomDepth < DOOR_DEPTH + 0.08;
    if (def.dressing?.interior) {
      const ROOM_DEPTH = roomDepth;
      // the room is the reveal's back opening continued (+2 cm each way, so the reveal's back
      // edge overlaps it): wider and the wall's unlit inner face would show past the jambs
      const roomW = doorBackW + 0.04;
      const roomH = doorHs + doorBackW / 2 + 0.03;
      const roomRng = r.fork('room50');
      const lampT = roomRng.range(0.55, 0.75);
      const right = new Vector3(doorDir.z, 0, -doorDir.x).normalize();
      roomLamp = doorBase
        .clone()
        .addScaledVector(doorDir, shallowRoom ? -(ROOM_DEPTH - 0.06) : -ROOM_DEPTH * lampT)
        .addScaledVector(right, roomRng.range(-0.18, 0.18))
        .setY(floorY + roomH - 0.28);
      const roomLit = (p: Vector3, n: Vector3, grain: number): RGB => {
        const irr = lampIrradiance(roomLamp!, p, n);
        const lit = clamp(Math.pow(Math.min(1, irr * 0.36), 0.75) * grain, 0, 1);
        return mix(REVEAL_DARK, REVEAL_WOOD, lit);
      };
      /** a point of the room box: across x ∈ [−½, ½] of roomW, up y from the floor, depth d from the wall's face */
      const roomP = (x: number, y: number, d: number, out: Vector3) => out.copy(doorBase).addScaledVector(right, x * roomW).addScaledVector(doorDir, -d).setY(floorY + y);
      const plankGrain = (u: number) => 0.8 + 0.2 * Math.sin(u * 27 + 1.3) + 0.08 * Math.sin(u * 61);
      // the back wall: a fan of lit wood, plank grain across it
      const back = gridSurface(
        (u, v, out) => {
          roomP(u - 0.5, v * roomH, ROOM_DEPTH, out.position);
          out.uv = [u * roomW, v * roomH];
          out.color = roomLit(out.position, doorDir, plankGrain(v * 3.1));
        },
        { cols: 6, rows: 6 },
      );
      roomParts.push(faceToward(back, doorBase.clone().setY(floorY + roomH / 2)));
      if (!shallowRoom) {
      // the side walls (inward normals), from the reveal's back to the room's back
      for (const side of [-1, 1] as const) {
        const nIn = right.clone().multiplyScalar(-side);
        const wallSide = gridSurface(
          (u, v, out) => {
            roomP(side * 0.5, v * roomH, lerp(DOOR_DEPTH, ROOM_DEPTH, u), out.position);
            out.uv = [u * ROOM_DEPTH, v * roomH];
            out.color = roomLit(out.position, nIn, plankGrain(u * 2.3 + side));
          },
          { cols: 5, rows: 5 },
        );
        roomParts.push(faceToward(wallSide, doorBase.clone().addScaledVector(doorDir, -ROOM_DEPTH * 0.5).setY(floorY + roomH / 2)));
      }
      // the floor (planks, lit from above) and the ceiling (dark, the lamp's underside light only)
      const floor = gridSurface(
        (u, v, out) => {
          roomP(u - 0.5, 0.012, lerp(DOOR_DEPTH, ROOM_DEPTH, v), out.position);
          out.uv = [u * roomW, v * ROOM_DEPTH];
          const t = roomLit(out.position, new Vector3(0, 1, 0), plankGrain(u * 5.7));
          out.color = [t[0] * 0.85, t[1] * 0.8, t[2] * 0.75];
        },
        { cols: 5, rows: 5 },
      );
      roomParts.push(faceToward(floor, doorBase.clone().addScaledVector(doorDir, -ROOM_DEPTH * 0.5).setY(floorY + roomH / 2)));
      const ceiling = gridSurface(
        (u, v, out) => {
          roomP(u - 0.5, roomH, lerp(DOOR_DEPTH, ROOM_DEPTH, v), out.position);
          out.uv = [u * roomW, v * ROOM_DEPTH];
          const t = roomLit(out.position, new Vector3(0, -1, 0), 0.45);
          out.color = [t[0] * 0.6, t[1] * 0.55, t[2] * 0.5];
        },
        { cols: 3, rows: 3 },
      );
      roomParts.push(faceToward(ceiling, doorBase.clone().addScaledVector(doorDir, -ROOM_DEPTH * 0.5).setY(floorY + roomH / 2)));
      // a shelf on the back wall, two pots on it (dark shapes against the lit wood)
      const shelfY = 0.95;
      const shelfA = roomP(-0.46, shelfY, ROOM_DEPTH - 0.06, new Vector3());
      const shelfB = roomP(0.46, shelfY, ROOM_DEPTH - 0.06, new Vector3());
      const shelfTint = roomLit(shelfA.clone().lerp(shelfB, 0.5), new Vector3(0, 1, 0), 0.7);
      roomParts.push(bar(shelfA, shelfB, 0.05, [shelfTint[0] * 0.7, shelfTint[1] * 0.65, shelfTint[2] * 0.6], 0.16));
      for (const px of [-0.28, 0.18]) {
        const pot = new CylinderGeometry(0.06, 0.05, 0.16, 8);
        pot.translate(0, 0.08, 0);
        const at = roomP(px + roomRng.range(-0.04, 0.04), shelfY + 0.025, ROOM_DEPTH - 0.06, new Vector3());
        pot.translate(at.x, at.y, at.z);
        roomParts.push(setColorAttribute(pot, [0.045, 0.03, 0.02]));
      }
      }
      roomParts.push(facingDisc(roomLamp, doorDir, 0.06, GLOW_AMBER, 10));
    }
    glowParts.push(winTunnel, winBackDisc, doorTunnel, doorFloor, ...(roomParts.length ? roomParts : [doorBack]));

    const barkGeo = merge([...walls, soffit, winCollar, doorCollar]);
    const barkMesh = new Mesh(barkGeo, mats.bark);
    barkMesh.name = `distant-house-bark:${def.id}`;
    barkMesh.castShadow = barkMesh.receiveShadow = true;
    group.add(barkMesh);
    tris += triangles(barkGeo);
    degenerate += countDegenerate(barkGeo);

    // ---- cap moss: a low dome curling down at the rim, the trunk rising through its crown; the
    // pole row's collapsed triangles are dropped (round 18: 28 zero-area fans per cap before).
    // Round 40 (structures-25): the lighter version of Saria's close-scale moss — the sheet's
    // bottom edge is LOBED (`edgeV`: the moss ends 0–15 cm up the curl in five-and-nine-lobe
    // waves) over a BARK SKIRT that shows between the lobes, and ≈ 100 cushion lumps 10–18 cm
    // across stand on the sheet (mossTufts.ts), merged into the cap's own geometry. ----
    const capPhase = r.range(0, TAU);
    const capRim = (a: number) => 1 + 0.035 * Math.sin(5 * a + capPhase) + 0.02 * Math.sin(9 * a - capPhase);
    /** the moss sheet's lower edge on the curl (v), lobed */
    const edgeV = (a: number) => clamp(0.07 + 0.04 * Math.sin(5 * a + 1.3 + capPhase) + 0.02 * Math.sin(9 * a - 0.7 - capPhase * 1.3) + 0.01 * Math.sin(17 * a + capPhase), 0.002, 0.14);
    const capPoint = (a: number, v: number, out: Vector3) => {
      const rr = eaveR * capRim(a) * Math.pow(Math.cos((v * Math.PI) / 2), 0.9);
      const y = eaveY - 0.14 + (def.capHeight + 0.14) * Math.pow(Math.sin((v * Math.PI) / 2), 1.15);
      return out.set(c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr);
    };
    /**
     * round 40b: the cushion colonies (as on Saria's cap) — the tufts gather where it is high
     * and the sheet between them is a shaded floor (× 0.45 in the gaps, ≈ 30 % of the sheet; the
     * hearts × 1.08); on this 28 × 7 sheet the floor is a soft mottle at the huts' 24 m, which is
     * the lighter treatment
     */
    const colony = (p: Vector3) => smoothstep(0.416, 0.5, 0.5 + 0.5 * tuftNoise.noise(p.x * 2.2 + 1.7, p.y * 2.2, p.z * 2.2 + 4.1));
    const capColor = (a: number, v: number, p: Vector3): RGB => {
      const mottle = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(11 * a + 6 * v + capPhase));
      // the camera-facing half keeps the deep moss (CAP_FACING_DARKEN), the far half the sunlit mix
      const facingHalf = Math.max(0, Math.cos(a - aWin));
      const bright = (0.35 + 0.3 * (0.5 + 0.5 * Math.sin(7 * a - 4 * v + capPhase * 0.7))) * (1 - CAP_FACING_DARKEN * facingHalf);
      const m = MOSS_ALBEDO_PEAK * lerp(0.9, 0.62, v) * mottle * (1 - 0.5 * CAP_FACING_DARKEN * facingHalf);
      // the floor fades out on the under-curl (v < 0.12, no tufts there)
      const z = smoothstep(0.04, 0.14, v);
      const floor = lerp(lerp(1, 0.45, z), lerp(1, 1.08, z), colony(p));
      return mix(MOSS_DEEP, MOSS_SUN, bright, m * floor);
    };
    const _cp = new Vector3();
    const _cq = new Vector3();
    const capSheet = gridSurface(
      (u, v, out) => {
        const a = u * TAU;
        // the grid's v = 0 row is the lobed edge; the sheet's last 2 cm round under toward the bark
        const e = edgeV(a);
        const vm = e + v * (1 - e);
        capPoint(a, vm, out.position);
        const tuck = Math.max(0, 1 - v * 12);
        out.position.addScaledVector(_cq.set(out.position.x - c.x, 0, out.position.z - c.z).normalize(), -0.025 * tuck);
        const rr = Math.hypot(out.position.x - c.x, out.position.z - c.z);
        out.uv = [(Math.cos(a) * (rr + 0.3)) / 1.6, (Math.sin(a) * (rr + 0.3)) / 1.6];
        const under = lerp(0.45, 1, Math.min(1, v * 8));
        const col = capColor(a, vm, out.position);
        out.color = [col[0] * under, col[1] * under, col[2] * under];
      },
      { cols: 28, rows: 7, closedU: true },
    );
    // the bark skirt under the lobed edge: from the eave soffit's edge down and round the curl to
    // the moss edge's lowest reach, 2 cm inside the sheet (the huts' bark, merged into `barkGeo`)
    const capSkirt = sealRing(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          const vm = v * 0.17;
          capPoint(a, vm, out.position);
          out.position.addScaledVector(_cq.set(out.position.x - c.x, 0, out.position.z - c.z).normalize(), -0.02);
          out.uv = [ringU(u, eaveR, 1.6), vm * 2];
          const cord = 0.8 + 0.3 * (0.5 + 0.5 * Math.sin(23 * a + capPhase * 2)) * (0.5 + 0.5 * Math.sin(41 * a - capPhase));
          const d = lerp(0.9, 1.15, v) * cord;
          out.color = [SOFFIT[0] * d, SOFFIT[1] * d, SOFFIT[2] * d];
        },
        { cols: 28, rows: 3, closedU: true },
      ),
      28,
    );
    // cushion lumps on the sheet: 10–18 cm, area-uniform over the dome, none on the under-curl
    const tuftRng = r.fork('moss-tufts');
    const tuftSpecs: MossTuftSpec[] = [];
    const _tn = new Vector3();
    for (let i = 0; i < 200; i++) {
      const a = tuftRng() * TAU;
      const v = 0.12 + Math.sqrt(tuftRng()) * 0.8;
      const rad = 0.05 + tuftRng() * 0.04;
      capPoint(a, v, _cp);
      // round 40b: into the colonies, a few stragglers on the floor (≈ 130 of 200 land)
      if (tuftRng() > lerp(0.12, 1, colony(_cp))) continue;
      // the dome's outward normal from the meridian and ring tangents
      _tn.subVectors(capPoint(a, Math.min(0.999, v + 0.01), _cq), _cp);
      _cq.set(-Math.sin(a), 0, Math.cos(a));
      _tn.cross(_cq).normalize();
      if (_tn.y < 0) _tn.negate();
      const col = capColor(a, v, _cp);
      tuftSpecs.push({
        position: _cp.clone(),
        normal: _tn.clone(),
        rx: rad * (0.8 + tuftRng() * 0.4),
        rz: rad * (0.8 + tuftRng() * 0.4),
        h: rad * (0.5 + tuftRng() * 0.35),
        yaw: tuftRng() * TAU,
        color: col,
        uv: [(Math.cos(a) * (Math.hypot(_cp.x - c.x, _cp.z - c.z) + 0.3)) / 1.6, (Math.sin(a) * (Math.hypot(_cp.x - c.x, _cp.z - c.z) + 0.3)) / 1.6],
        sink: rad * 0.35,
        seed: 1 + Math.floor(tuftRng() * 1e6),
      });
    }
    const capTufts = buildMossTufts(tuftSpecs, tuftNoise, { segments: [6, 6], rings: [2, 2], topGain: 1.18, rimGain: 0.55 });
    const cap = dropDegenerate(merge([capSheet, capTufts.geometry]));
    const capMesh = new Mesh(cap, mats.capMoss);
    capMesh.name = `distant-house-cap:${def.id}`;
    capMesh.castShadow = capMesh.receiveShadow = true;
    group.add(capMesh);
    tris += triangles(cap);
    degenerate += countDegenerate(cap);
    const skirtMesh = new Mesh(capSkirt, mats.bark);
    skirtMesh.name = `distant-house-cap-skirt:${def.id}`;
    skirtMesh.castShadow = skirtMesh.receiveShadow = true;
    group.add(skirtMesh);
    tris += triangles(capSkirt);
    degenerate += countDegenerate(capSkirt);

    // ---- planks: platform, walkway stub, window bars, pod hangers ----
    const plankParts: BufferGeometry[] = [];
    const platR = R + 0.22;

    // ---- round 55 (owner review 2026-09-23: the side bungalows' "roof edges, trim, openings"): a
    // sill band round the wall's foot (broken at the door), a wall plate under the eave (broken where
    // the window reaches it), a ledge under the window, and a bark EAVE ROLL under the moss edge so
    // the roof ends in a thick lip instead of a sheet. Each hut its own trim tone; own fork. ----
    const eaveRoll: BufferGeometry[] = [];
    {
      const tr = r.fork('trim55');
      const tone = tr.range(0.85, 1.2);
      const trim: RGB = [PLANK_DARK[0] * tone * 1.2, PLANK_DARK[1] * tone * 1.15, PLANK_DARK[2] * tone * 1.1];
      const steps = Math.max(36, Math.round((TAU * R) / 0.3));
      const band = (yMid: number, height: number, skip: (a: number) => boolean) => {
        const _a = new Vector3();
        const _b = new Vector3();
        for (let k = 0; k < steps; k++) {
          const a0 = (k / steps) * TAU;
          const a1 = ((k + 1) / steps) * TAU;
          if (skip(a0) || skip(a1)) continue;
          wallSurface(a0, yMid, _a, 0.035);
          wallSurface(a1, yMid, _b, 0.035);
          // a hair of overlap so the segments join
          const d = _b.clone().sub(_a).multiplyScalar(0.04);
          plankParts.push(bar(_a.clone().sub(d), _b.clone().add(d), 0.055, [trim[0] * tr.range(0.92, 1.08), trim[1], trim[2]], height));
        }
      };
      const doorGap = (a: number) => Math.abs(dAngle(a, aDoor)) * R < doorW / 2 + 0.1;
      band(floorY + 0.07, 0.13, doorGap);
      const plateY = eaveY - 0.19;
      // a hut with a window brow (character.awning) stops its plate either side of the brow's crown
      const browSpan = def.character?.awning ? winR + COLLAR_WIDTH + 0.14 : 0;
      band(plateY, 0.1, (a) => inWindow(a, plateY, 0.06) || inDoor(a, plateY, 0.06) || Math.abs(dAngle(a, aWin)) * R < browSpan);
      // the ledge under the window
      const ledgeY = winY - winR - 0.035;
      const w = (winR + 0.1) / R;
      plankParts.push(bar(wallSurface(aWin - w, ledgeY, new Vector3(), 0.07), wallSurface(aWin + w, ledgeY, new Vector3(), 0.07), 0.12, [trim[0] * 1.1, trim[1] * 1.08, trim[2] * 1.05], 0.05));
      // the eave roll: a bark lip under the moss edge, following the cap rim's own wave
      const tube = def.dressing ? 0.095 : 0.07;
      const rollCols = Math.max(32, steps);
      const roll = sealRing(
        gridSurface(
          (u, v, out) => {
            const a = u * TAU;
            const ang = v * TAU;
            const rr = eaveR * capRim(a) - 0.055 + Math.cos(ang) * tube;
            const y = eaveY - 0.16 + Math.sin(ang) * tube * 0.8;
            out.position.set(c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr);
            out.uv = [ringU(u, eaveR, 1.2), v * 0.5];
            const cord = 0.82 + 0.28 * (0.5 + 0.5 * Math.sin(23 * a + capPhase * 2));
            const lit = lerp(0.75, 1.15, 0.5 + 0.5 * Math.sin(ang));
            out.color = [SOFFIT[0] * cord * lit * 1.3, SOFFIT[1] * cord * lit * 1.25, SOFFIT[2] * cord * lit * 1.2];
          },
          { cols: rollCols, rows: 6, closedU: true },
        ),
        rollCols,
      );
      // normals out from the tube's core circle
      faceTowards(roll, (p, o) => {
        const a = Math.atan2(p.z - c.z, p.x - c.x);
        const core = eaveR * capRim(a) - 0.055;
        return o.set(p.x + (p.x - (c.x + Math.cos(a) * core)), p.y + (p.y - (eaveY - 0.16)), p.z + (p.z - (c.z + Math.sin(a) * core)));
      });
      eaveRoll.push(roll);
    }
    // the roll rides in the cap skirt's bark mesh (no draw of its own)
    {
      const skirtWithRoll = merge([capSkirt, ...eaveRoll]);
      tris += triangles(skirtWithRoll) - triangles(capSkirt);
      skirtMesh.geometry = skirtWithRoll;
    }
    plankParts.push(ring(c, 0.02, platR, floorY + 0.01, true, () => PLANK, 24, 3));
    plankParts.push(ring(c, 0.02, platR, floorY - 0.22, false, () => PLANK, 24, 3));
    plankParts.push(
      sealRing(
        gridSurface(
          (u, v, out) => {
            const a = u * TAU;
            out.position.set(c.x + Math.cos(a) * platR, lerp(floorY - 0.22, floorY + 0.01, v), c.z + Math.sin(a) * platR);
            out.uv = [ringU(u, platR, 1.6), v * 0.2];
            out.color = PLANK;
          },
          { cols: 24, rows: 2, closedU: true },
        ),
        24,
      ),
    );

    // walkway: a plank deck leaving the platform rim, dropping 4°, with posts and a sagging rope rail
    // round 49: with `walkway.end` the deck runs from the rim to exactly that point (a flight's head)
    const wEnd = def.walkway.end ? new Vector3(def.walkway.end[0], def.walkway.end[1], def.walkway.end[2]) : null;
    const wDir = wEnd ? new Vector3(wEnd.x - c.x, 0, wEnd.z - c.z).normalize() : az(def.facingDeg + def.walkway.deg);
    const wSide = new Vector3(-wDir.z, 0, wDir.x);
    const wRim = def.walkway.from ?? platR;
    const L = wEnd ? Math.hypot(wEnd.x - c.x, wEnd.z - c.z) - wRim : def.walkway.length;
    const deckStart = c.clone().addScaledVector(wDir, wRim - 0.15).setY(floorY - 0.06);
    const deckEnd = wEnd ? wEnd.clone().setY(wEnd.y - 0.06) : c.clone().addScaledVector(wDir, wRim + L).setY(floorY - 0.06 - L * Math.tan(4 * DEG));
    walk.push({
      id: def.id,
      disc: { x: c.x, z: c.z, r: platR, y: floorY + 0.01 },
      deck: { a: [deckStart.x, deckStart.y + 0.06, deckStart.z], b: [deckEnd.x, deckEnd.y + 0.06, deckEnd.z], hw: 0.475 },
      wall: { r: R * WALL_TAPER, half: 0.2, gap: [aDoor - (doorW * 0.5 + 0.1) / R, aDoor + (doorW * 0.5 + 0.1) / R] },
    });
    const deck = new BoxGeometry(0.95, 0.12, L + 0.15);
    deck.applyMatrix4(basisMatrix(deckStart.clone().lerp(deckEnd, 0.5), deckEnd.clone().sub(deckStart)));
    plankParts.push(setColorAttribute(deck, PLANK));
    const postTops: Vector3[][] = [[], []];
    for (const s of [0.5, 1]) {
      const foot = deckStart.clone().lerp(deckEnd, s);
      for (const side of [-1, 1]) {
        const base = foot.clone().addScaledVector(wSide, side * 0.42);
        const top = base.clone().setY(base.y + 1.05);
        plankParts.push(bar(base, top, 0.09, PLANK_DARK));
        postTops[side < 0 ? 0 : 1].push(top);
      }
    }
    for (const side of [0, 1]) {
      const wallAnchor = c
        .clone()
        .addScaledVector(wDir, def.walkway.from ?? R - 0.05)
        .addScaledVector(wSide, (side === 0 ? -1 : 1) * 0.42)
        .setY(floorY + 1.0);
      const pts = [wallAnchor, ...postTops[side]];
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.09;
        plankParts.push(bar(a, mid, 0.035, PLANK_DARK));
        plankParts.push(bar(mid, b, 0.035, PLANK_DARK));
      }
    }

    // window: dark cross bars over the recess (in front of the rim), the lamp disc 65 % in and
    // the warm rim conforming to the wall over the cut's edge
    const winRight = new Vector3(-facing.z, 0, facing.x);
    const winFront = wallAt(facing, winY, 0.06);
    plankParts.push(bar(winFront.clone().addScaledVector(winRight, -winR), winFront.clone().addScaledVector(winRight, winR), 0.06, PLANK_DARK));
    plankParts.push(bar(winFront.clone().setY(winY - winR), winFront.clone().setY(winY + winR), 0.06, PLANK_DARK));
    // the lamp discs — the only strongly emissive points of the openings (2.2 linear, fog-exempt)
    glowParts.push(facingDisc(winLamp, facing, winR * 0.3, GLOW_AMBER, 12));
    glowParts.push(facingDisc(doorLamp, doorDir, 0.09, GLOW_DOOR, 10));

    // pods: on the walkway's end post, under the eave between window and door, on the mid post;
    // each cord is bracketed to its post top (round 16 hung them 0.12 m off the posts)
    const podR = R * 0.15;
    const pods: Vector3[] = [];
    const hang = (from: Vector3, drop: number, color: RGB, bracketFrom?: Vector3) => {
      if (bracketFrom) plankParts.push(bar(bracketFrom, from, 0.045, PLANK_DARK));
      if (def.dressing) {
        // round 55: a hut the player walks up to hangs the crafted near lantern (own fork per pod)
        const rig = buildLantern(from, drop, mats, r.fork(`lantern55/${pods.length}`), 1.1, color === GLOW_LIME ? 'lime' : 'orange');
        group.add(rig.pivot);
        lanterns.push(rig);
        pods.push(rig.pod.clone());
        return;
      }
      const podTop = from.clone().setY(from.y - drop);
      plankParts.push(bar(from, podTop, 0.03, PLANK_DARK));
      // body radius 0.148 s = 0.8 podR: the lit body about the size of round 16's sphere
      const s = (0.8 * podR) / 0.148;
      glowParts.push(distantPod(podTop, s, color, r.fork(`pod/${pods.length}`)));
      pods.push(podTop.clone().setY(podTop.y - (POD_STEM_H + POD_TOP - POD_BODY_MID) * s));
    };
    // the post pods hang short (0.22 / 0.2 m cords): the pod is 0.48 s tall against the sphere's
    // 2 podR, so a round-16 drop would have set its tip on the deck
    const endPostTop = postTops[1][1];
    const endHook = (def.postPodsOutboard ? endPostTop.clone().addScaledVector(wSide, POST_POD_OUTBOARD) : endPostTop.clone().addScaledVector(wDir, 0.12)).setY(endPostTop.y + 0.02);
    hang(endHook, 0.22, GLOW_AMBER, endPostTop.clone().setY(endPostTop.y + 0.02));
    if (def.pods >= 2) {
      const eaveDir = az(def.facingDeg + def.doorDeg * 0.5);
      const hook = c.clone().addScaledVector(eaveDir, eaveR - 0.1).setY(eaveY - 0.02);
      hang(hook, 0.45, def.pods >= 3 ? GLOW_LIME : GLOW_AMBER);
    }
    if (def.pods >= 3) {
      const midPostTop = postTops[0][0];
      const midHook = midPostTop.clone().addScaledVector(wSide, def.postPodsOutboard ? -POST_POD_OUTBOARD : -0.12).setY(midPostTop.y + 0.02);
      hang(midHook, 0.2, GLOW_AMBER, midPostTop.clone().setY(midPostTop.y + 0.02));
    }

    // ---- round 50 (structures-33): the DRESSING — the main house's standard on the huts the
    // player walks up to (`DistantHouseDef.dressing`; the three village huts have none and are
    // built exactly as before: every stream below is a fresh fork, every mesh a new one) ----
    const dressParts: BufferGeometry[] = [];
    let dressFoliage: FoliageBuilder | null = null;
    const dressAudit: { bough: [number, number, number][] | null; boughPods: [number, number, number][]; buttresses: number; fringe: number; room: { depth: number; shallow: boolean; lamp: [number, number, number] } | null } = { bough: null, boughPods: [], buttresses: 0, fringe: 0, room: null };
    if (def.dressing) {
      const dr = r.fork('dressing50');
      /** the wall's outward direction at angle a */
      const outAt = (a: number) => new Vector3(Math.cos(a), 0, Math.sin(a));
      /** the viewer's left when facing the door from outside is +doorTangent (increasing wall angle) */
      const aHalfDoor = (doorW / 2) / R;
      const barkShade = (a: number, y: number, k: number): RGB => {
        const w = wallColor(a, clamp((y - floorY) / def.wall, 0, 1));
        return [w[0] * k, w[1] * k * 0.97, w[2] * k * 0.92];
      };
      if (def.dressing.doorBough) {
        // ---- the EAVE BOUGH: a gnarled limb growing out of the wall left of the door head,
        // arching out over the door and across to the right, rising and tapering; a burl at
        // its root; knots along it; the pod cluster hangs from its underside over the door ----
        const B = def.dressing.doorBough;
        const yRoot = floorY + doorH + 0.5;
        const aRoot = aDoor + (aHalfDoor + 0.6 / R);
        const reach = B.length / R;
        // the limb climbs, but stays a hand under the soffit (eaveY) to its tip — the pods hang
        // from it, and a hook inside the cap would put a cord through the soffit
        const rise = clamp(eaveY - 0.16 - yRoot, 0.1, 0.55) / 0.55;
        const ctrl: Vector3[] = [
          wallSurface(aRoot, yRoot - 0.05, new Vector3(), -0.3),
          wallSurface(aRoot - 0.04 / R, yRoot + 0.02 * rise, new Vector3(), 0.32),
          wallSurface(aRoot - reach * 0.3, yRoot + 0.14 * rise, new Vector3(), 0.58),
          wallSurface(aRoot - reach * 0.62, yRoot + 0.3 * rise, new Vector3(), 0.5),
          wallSurface(aRoot - reach, yRoot + 0.55 * rise, new Vector3(), 0.28),
        ];
        const curve = new CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
        const knotPhase = dr.range(0, TAU);
        const boughR = (t: number) => (0.13 - 0.085 * t) * (1 + 0.16 * Math.max(0, Math.sin(t * 19 + knotPhase)) ** 2 + 0.35 * Math.max(0, 1 - t * 7));
        const bough = sweepTube(curve, {
          radius: boughR,
          tubularSegments: 18,
          radialSegments: 9,
          uvMetres: 1.6,
          displace: (t, ang) => 0.006 * Math.sin(ang * 5 + t * 23) + 0.004 * Math.sin(ang * 11 - t * 40 + knotPhase),
          color: (t, _ang, up) => barkShade(aRoot - reach * t, yRoot, (0.8 + 0.2 * Math.max(0, up)) * (0.9 + 0.1 * Math.cos(t * 31 + knotPhase))),
          capEnd: true,
        });
        dressParts.push(bough);
        dressAudit.bough = [ctrl[0], ctrl[2], ctrl[4]].map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] as [number, number, number]);
        // the pod cluster: `B.pods` pods on short cords from the bough's underside BESIDE the
        // door opening (the demo's second house: pods by the door). The door head is 0.85 m under
        // the eave and a 0.6 m pod on a cord cannot clear it, so the pods hang past the jambs —
        // their inner edge ≥ 0.12 m outside the opening, 0.1 m apart along the wall, the first
        // two on the far (left) side, the third by the root, more further left; a spot the limb
        // does not reach (t outside 0.1–0.94) is skipped and the audit shows the count
        const podS = R > 2.5 ? 1.25 : 1.0;
        const podRad = 0.148 * podS;
        const aClear = aHalfDoor + (podRad + 0.12) / R;
        const aStep = (2 * podRad + 0.1) / R;
        const spots: [number, number, RGB][] = [
          [aDoor - aClear, 0.1, GLOW_AMBER],
          [aDoor - aClear - aStep, 0.2, GLOW_LIME],
          [aDoor + aClear, 0.14, GLOW_AMBER],
          [aDoor - aClear - 2 * aStep, 0.12, GLOW_AMBER],
        ];
        const cluster: [number, number, RGB][] = [];
        for (const [a, drop, col] of spots) {
          const t = (aRoot - a) / reach;
          if (t >= 0.1 && t <= 0.94) cluster.push([t, drop, col]);
        }
        const _bp = new Vector3();
        for (let i = 0; i < Math.min(B.pods, cluster.length); i++) {
          const [t, drop, col] = cluster[i];
          curve.getPointAt(t, _bp);
          const hook = _bp.clone().setY(_bp.y - boughR(t) + 0.01);
          // round 55: the crafted near lantern, its cord tied round the limb with two turns
          const rig = buildLantern(hook, drop, mats, dr.fork(`bough-lantern55/${i}`), podS, col === GLOW_LIME ? 'lime' : 'orange');
          group.add(rig.pivot);
          lanterns.push(rig);
          const tangent = curve.getTangentAt(t, new Vector3());
          for (const off of [-0.018, 0.018]) {
            const turn = new TorusGeometry(boughR(t) + 0.012, 0.009, 5, 14);
            turn.lookAt(tangent);
            const at = _bp.clone().addScaledVector(tangent, off);
            turn.translate(at.x, at.y, at.z);
            ensureColor(turn, [0.42, 0.32, 0.22]);
            plankParts.push(turn);
          }
          const centre = rig.pod.clone();
          pods.push(centre);
          dressAudit.boughPods.push([+centre.x.toFixed(2), +centre.y.toFixed(2), +centre.z.toFixed(2)]);
        }
        // round 55: the cluster's own restrained light, like Saria's (house.ts): 0.9 m under the
        // pods and a little out from the wall, so it pools on the platform at the door and warms the
        // jambs, the bough's underside staying dark; 5 m of reach
        if (dressAudit.boughPods.length) {
          const cc = new Vector3();
          for (const p of dressAudit.boughPods) cc.add(new Vector3(p[0], p[1], p[2]));
          cc.divideScalar(dressAudit.boughPods.length);
          const out = new Vector3(cc.x - c.x, 0, cc.z - c.z).normalize();
          cc.addScaledVector(out, 0.3);
          cc.y -= 0.9;
          const light = new PointLight(new Color(0xffc070), 2.6, 5, 2);
          light.position.copy(cc);
          light.name = 'hut-lantern-light';
          lights.push(light);
        }
      }
      if (def.dressing.buttresses) {
        // ---- KNOTTED BARK BUTTRESSES framing the doorway: one each side, a root's foot on the
        // platform 0.4 m out from the jamb, leaning in to the wall as it climbs, merging into
        // the bark above the door head; knots as radius swells, a crevice tone on the wall side ----
        for (const side of [-1, 1] as const) {
          const a0 = aDoor + side * (aHalfDoor + 0.4 / R);
          const yTop = floorY + doorH + 0.32;
          const ctrl = [
            wallSurface(a0 + (side * 0.04) / R, floorY - 0.06, new Vector3(), 0.5),
            wallSurface(a0, floorY + 0.4, new Vector3(), 0.34),
            wallSurface(a0 - (side * 0.05) / R, floorY + 0.95, new Vector3(), 0.17),
            wallSurface(a0 - (side * 0.1) / R, yTop, new Vector3(), 0.0),
            wallSurface(a0 - (side * 0.14) / R, yTop + 0.3, new Vector3(), -0.2),
          ];
          const curve = new CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
          const kp = dr.range(0, TAU);
          const knots = [dr.range(0.25, 0.4), dr.range(0.55, 0.72)];
          const radius = (t: number) => {
            let k = 1;
            for (const q of knots) k += 0.32 * Math.exp(-(((t - q) / 0.06) ** 2));
            return (0.16 - 0.09 * t) * k * (1 + 0.05 * Math.sin(t * 29 + kp));
          };
          const buttress = sweepTube(curve, {
            radius,
            tubularSegments: 14,
            radialSegments: 9,
            uvMetres: 1.6,
            displace: (t, ang) => 0.008 * Math.sin(ang * 4 + t * 17 + kp) + 0.004 * Math.sin(ang * 9 - t * 31),
            // the crevice against the wall and under the knots is grimed, the outer flank the wall's shade
            color: (t, _ang, up) => barkShade(a0, floorY + t * doorH, (0.68 + 0.24 * Math.max(0, up)) * (1 - 0.15 * Math.max(0, Math.sin(t * 29 + kp))) * lerp(0.85, 1, t)),
            capStart: true,
          });
          dressParts.push(buttress);
          dressAudit.buttresses++;
        }
      }
      if (def.dressing.fringe) {
        // ---- the CAP'S MOSS FRINGE (the main house's round-11 rim skirt): drooping leaf clumps
        // and short hanging vines along the lobed moss edge, thinned and shortened over the door ----
        dressFoliage = new FoliageBuilder(dr.fork('fringe'), `${ctx.config.seed}/hut-fringe/${def.id}`);
        const fr = dr.fork('fringe-place');
        const n = 22;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + fr.range(-0.08, 0.08);
          const overDoor = smoothstep(0.55, 0.15, Math.abs(dAngle(a, aDoor)));
          if (fr() < 0.55 * overDoor) continue;
          const p = capPoint(a, edgeV(a) + 0.01, new Vector3());
          p.addScaledVector(outAt(a), 0.06);
          p.y -= 0.06 + fr() * 0.06;
          const radius = (0.16 + fr() * 0.1) * lerp(1, 0.7, overDoor);
          const tintF: [number, number, number] = fr() < 0.5 ? [1.2, 0.75, 0.9] : [1.8, 1.1, 1.3];
          dressFoliage.addLeafCluster(p, radius, 14, { size: 0.11, amount: 0.05, droop: 0.9, tint: tintF, tintSpread: 0.25, flatten: 0.4 });
          if (fr() < 0.5) {
            const hook = p.clone().add(new Vector3(fr.range(-0.05, 0.05), 0, fr.range(-0.05, 0.05)));
            dressFoliage.addHangingVine(hook, (0.25 + fr() * 0.35) * lerp(1, 0.5, overDoor), { amount: 0.08, leafSize: 0.08 });
          }
          dressAudit.fringe++;
        }
      }
      if (roomLamp) dressAudit.room = { depth: +roomDepth.toFixed(2), shallow: shallowRoom, lamp: [+roomLamp.x.toFixed(2), +roomLamp.y.toFixed(2), +roomLamp.z.toFixed(2)] };
      if (dressParts.length) {
        const dressGeo = merge(dressParts);
        const dressMesh = new Mesh(dressGeo, mats.bark);
        dressMesh.name = `distant-house-dressing:${def.id}`;
        dressMesh.castShadow = dressMesh.receiveShadow = true;
        group.add(dressMesh);
        tris += triangles(dressGeo);
        degenerate += countDegenerate(dressGeo);
      }
      if (dressFoliage) {
        for (const m of dressFoliage.build(mats, `hut-fringe:${def.id}`)) {
          group.add(m);
          if (m.geometry) tris += triangles(m.geometry as BufferGeometry);
        }
      }
    }

    // ---- 2026-09-23 (owner review: "repeated bungalows need purposeful variation"): the hut's
    // CHARACTER (`DistantHouseDef.character`). Own fork, after every stream above. The ladder is a
    // mesh of its own — the play camera may stand behind a rope ladder but is not walled off by
    // it (cameraSolids.ts SLIM) — in the planks' material, so it folds into the village's wood
    // bucket; the rest rides in the planks, one bark mesh and one foliage builder. ----
    const ladderParts: BufferGeometry[] = [];
    const charBark: BufferGeometry[] = [];
    const charLeaves: { builder: FoliageBuilder | null } = { builder: null };
    const charAudit: CharacterAudit = { ladder: null, railingPosts: 0, hoist: null, flowers: 0, sprout: null, awning: false, herbs: 0 };
    if (def.character) {
      const ch = r.fork('character56');
      const C = def.character;
      const UPV = new Vector3(0, 1, 0);
      const at3 = (p: Vector3): [number, number, number] => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
      const outAt = (a: number) => new Vector3(Math.cos(a), 0, Math.sin(a));
      const tanAt = (a: number) => new Vector3(-Math.sin(a), 0, Math.cos(a));
      /** wall angle of a direction given relative to the window (degrees, as `doorDeg`) */
      const angleOf = (relDeg: number) => {
        const d = az(def.facingDeg + relDeg);
        return Math.atan2(d.z, d.x);
      };
      const foliage = () => (charLeaves.builder ??= new FoliageBuilder(ch.fork('foliage'), `${ctx.config.seed}/hut-character/${def.id}`));
      /** how far world point p stands outside the host bole's nominal surface (m; the column fallback is 0.55 R) */
      const boleGap = (p: Vector3) => {
        const h = p.y - host.base.y;
        host.axisAt(h, _axis);
        const br = host.seat ? host.seat.radiusAt(Math.max(0, h)) : R * 0.55;
        return Math.hypot(p.x - _axis.x, p.z - _axis.z) - br;
      };
      const tone = (base: RGB, lo: number, hi: number): RGB => scaleRGB(base, ch.range(lo, hi));
      const ROPE: RGB = [0.4, 0.33, 0.23];

      if (C.ladder) {
        // ---- the ROPE LADDER: two side ropes tied round the rim beam, a round rung every 0.3 m,
        // the bottom rung at knee height and the ropes staked out on the ground; the foot steps out
        // from the rim until every rung clears the host bole by 0.2 m ----
        const aL = angleOf(C.ladder.deg);
        const out = outAt(aL);
        const side = tanAt(aL);
        const HALF = 0.21;
        const top = c.clone().addScaledVector(out, platR - 0.03).setY(floorY - 0.05);
        const footAt = (k: number) => {
          const f = c.clone().addScaledVector(out, platR + k);
          f.y = ctx.terrain.height(f.x, f.z);
          return f;
        };
        let reach = 0.28;
        let foot = footAt(reach);
        for (let it = 0; it < 14; it++) {
          let worst = Infinity;
          for (let s = 0; s <= 1.0001; s += 0.05) {
            const p = foot.clone().lerp(top, s);
            for (const k of [-1, 1]) worst = Math.min(worst, boleGap(p.clone().addScaledVector(side, k * HALF)));
          }
          if (worst >= 0.2) break;
          reach += 0.12;
          foot = footAt(reach);
        }
        const bottom = foot.clone().setY(foot.y + 0.42);
        const rungs = Math.max(3, Math.round(bottom.distanceTo(top) / 0.3));
        const railPts: [Vector3[], Vector3[]] = [[], []];
        for (let i = 0; i <= rungs; i++) {
          const p = bottom.clone().lerp(top, i / rungs);
          railPts[0].push(p.clone().addScaledVector(side, -HALF));
          railPts[1].push(p.clone().addScaledVector(side, HALF));
          // no rung at the rim: the ropes wrap the rim beam there
          if (i < rungs) {
            const k = ch.range(0.8, 1.15);
            const worn = i < 4 ? 1.12 : 1;
            ladderParts.push(rod(railPts[0][i].clone().addScaledVector(side, -0.035), railPts[1][i].clone().addScaledVector(side, 0.035), 0.021, scaleRGB(PLANK, k * worn), 6));
          }
        }
        for (const rail of railPts) {
          for (let i = 0; i + 1 < rail.length; i++) ladderParts.push(rod(rail[i], rail[i + 1], 0.012, ROPE, 5));
          // the wrap round the rim beam, and the rope's run from the bottom rung out to its stake
          const wrap = new TorusGeometry(0.05, 0.014, 5, 10);
          wrap.lookAt(side);
          const w = rail[rail.length - 1].clone().setY(floorY - 0.1);
          wrap.translate(w.x, w.y, w.z);
          ladderParts.push(ensureColor(wrap, ROPE));
          const stakeTop = rail[0].clone().addScaledVector(out, 0.32).setY(foot.y + 0.14);
          stakeTop.y = ctx.terrain.height(stakeTop.x, stakeTop.z) + 0.14;
          ladderParts.push(rod(rail[0], stakeTop, 0.011, ROPE, 5));
          ladderParts.push(rod(stakeTop.clone().addScaledVector(out, -0.05).setY(stakeTop.y - 0.3), stakeTop.clone().addScaledVector(out, 0.03).setY(stakeTop.y + 0.05), 0.026, tone(PLANK_DARK, 0.9, 1.1), 6, 0.022, false));
        }
        charAudit.ladder = { top: at3(top), foot: at3(foot), rungs, reach: +reach.toFixed(2) };
      }

      if (C.railing) {
        // ---- the RAILING: a post every ≈ 0.7 m round the rim under a bent-pole rail, a rope
        // midrail; open at the walkway, the door (and a ladder), each run ending on a post ----
        const railR = platR - 0.07;
        const aW = Math.atan2(wDir.z, wDir.x);
        const gaps: [number, number][] = [
          [aW, (0.95 / 2 + 0.12) / railR],
          [aDoor, (doorW / 2 + 0.22) / railR],
        ];
        if (C.ladder) gaps.push([angleOf(C.ladder.deg), 0.4 / railR]);
        const iv = gaps
          .map(([g, h]) => {
            const s = (((g - h) % TAU) + TAU) % TAU;
            return [s, s + 2 * h] as [number, number];
          })
          .sort((p, q) => p[0] - q[0]);
        const merged: [number, number][] = [];
        for (const g of iv) {
          const last = merged[merged.length - 1];
          if (last && g[0] <= last[1]) last[1] = Math.max(last[1], g[1]);
          else merged.push([g[0], g[1]]);
        }
        const arcs: [number, number][] = merged.map((g, i) => [g[1], i + 1 < merged.length ? merged[i + 1][0] : merged[0][0] + TAU]);
        const RAIL_H = 0.86;
        const poleTone = tone(PLANK, 0.95, 1.1);
        for (const [a0, a1] of arcs) {
          if (a1 - a0 < 0.3 / railR) continue;
          const spans = Math.max(1, Math.round(((a1 - a0) * railR) / 0.7));
          const tops: Vector3[] = [];
          for (let k = 0; k <= spans; k++) {
            const a = lerp(a0, a1, k / spans);
            const base = c.clone().addScaledVector(outAt(a), railR).setY(floorY + 0.01);
            const top = base.clone().setY(floorY + RAIL_H + 0.05 + ch.range(-0.02, 0.02));
            plankParts.push(rod(base, top, 0.034, tone(PLANK_DARK, 0.85, 1.15), 6, 0.03, false));
            tops.push(top);
            charAudit.railingPosts++;
          }
          // the pole: sampled along the arc (it follows the rim), riding 5 cm under the post tops
          const n = Math.max(3, Math.ceil(((a1 - a0) * railR) / 0.25));
          const wob = ch.range(0, TAU);
          const pts: Vector3[] = [];
          for (let k = 0; k <= n; k++) {
            const a = lerp(a0, a1, k / n);
            pts.push(c.clone().addScaledVector(outAt(a), railR + 0.012 * Math.sin(k * 1.7 + wob)).setY(floorY + RAIL_H + 0.012 * Math.sin(k * 2.3 + wob)));
          }
          plankParts.push(
            sweepTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), {
              radius: (t) => 0.027 * (1 - 0.15 * t),
              tubularSegments: n * 2,
              radialSegments: 6,
              uvMetres: 1.6,
              color: (_t, _a, up) => scaleRGB(poleTone, 0.85 + 0.3 * Math.max(0, up)),
              capStart: true,
              capEnd: true,
            }),
          );
          // the rope midrail, sagging a little between posts
          for (let k = 0; k + 1 < tops.length; k++) {
            const a = tops[k].clone().setY(floorY + 0.44);
            const b = tops[k + 1].clone().setY(floorY + 0.44);
            const mid = a.clone().lerp(b, 0.5);
            mid.y -= 0.035;
            plankParts.push(rod(a, mid, 0.01, ROPE, 4), rod(mid, b, 0.01, ROPE, 4));
          }
        }
      }

      if (C.hoist) {
        // ---- the HOIST: a davit pole lashed to the wall, leaning out over the rim; a block at
        // its head, the rope down to a basket of firewood, the hauling end tied off on a wall peg ----
        const aH = angleOf(C.hoist.deg);
        const out = outAt(aH);
        const side = tanAt(aH);
        let tipOut = platR + 0.5;
        let drop = C.hoist.drop;
        for (let it = 0; it < 8; it++) {
          const basket = c.clone().addScaledVector(out, tipOut).setY(floorY - drop);
          if (boleGap(basket) >= 0.35 && boleGap(basket.clone().setY(floorY - drop * 0.5)) >= 0.3) break;
          tipOut += 0.1;
        }
        const tip = c.clone().addScaledVector(out, tipOut).setY(floorY + 1.95);
        const ctrl = [
          wallSurface(aH, floorY + 0.01, new Vector3(), 0.08),
          wallSurface(aH, floorY + 1.05, new Vector3(), 0.1),
          c.clone().addScaledVector(out, R + 0.4).setY(floorY + 1.78),
          tip,
        ];
        const poleCurve = new CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
        const poleTone = tone(PLANK_DARK, 1.05, 1.25);
        plankParts.push(
          sweepTube(poleCurve, {
            radius: (t) => lerp(0.05, 0.032, t),
            tubularSegments: 14,
            radialSegments: 7,
            uvMetres: 1.6,
            displace: (t, ang) => 0.004 * Math.sin(ang * 3 + t * 17),
            color: (_t, _a, up) => scaleRGB(poleTone, 0.8 + 0.3 * Math.max(0, up)),
            capStart: true,
            capEnd: true,
          }),
        );
        // lashings where the pole meets the wall
        for (const t of [0.12, 0.33]) {
          const p = poleCurve.getPointAt(t);
          const lash = new TorusGeometry(0.058, 0.012, 5, 10);
          lash.lookAt(poleCurve.getTangentAt(t, new Vector3()));
          lash.translate(p.x, p.y, p.z);
          plankParts.push(ensureColor(lash, ROPE));
        }
        // the block under the head
        const block = new TorusGeometry(0.05, 0.02, 6, 12);
        block.lookAt(side);
        const blockC = tip.clone().setY(tip.y - 0.1);
        block.translate(blockC.x, blockC.y, blockC.z);
        plankParts.push(ensureColor(block, scaleRGB(PLANK_DARK, 0.8)));
        plankParts.push(rod(tip.clone().setY(tip.y - 0.03), blockC.clone().setY(blockC.y + 0.04), 0.012, ROPE, 4));
        // the basket: woven sides in bands, a rim, a bail to the rope, three sticks of firewood
        const bTop = floorY - drop + 0.3;
        const bC = tip.clone().setY(floorY - drop);
        const profile = [new Vector2(0.0001, 0), new Vector2(0.12, 0), new Vector2(0.155, 0.03), new Vector2(0.175, 0.15), new Vector2(0.19, 0.27), new Vector2(0.2, 0.3), new Vector2(0.182, 0.3), new Vector2(0.17, 0.26)];
        const basket = new LatheGeometry(profile, 12);
        basket.translate(bC.x, bC.y, bC.z);
        const bp = basket.attributes.position;
        setColorAttribute(basket, (i) => {
          const y = bp.getY(i) - bC.y;
          const band = 0.82 + 0.22 * (0.5 + 0.5 * Math.sin(y * 70));
          return [0.5 * band, 0.4 * band, 0.24 * band];
        });
        plankParts.push(basket);
        const bail = bC.clone().setY(bTop + 0.26);
        for (const k of [-1, 1]) plankParts.push(rod(bC.clone().addScaledVector(side, k * 0.19).setY(bTop), bail, 0.009, ROPE, 4));
        plankParts.push(rod(bail, blockC.clone().addScaledVector(out, 0.05).setY(blockC.y - 0.04), 0.011, ROPE, 4));
        // the hauling end: from the block back in to a peg on the wall beside the pole
        const peg = wallSurface(aH + 0.26 / R, floorY + 0.95, new Vector3(), 0.1);
        plankParts.push(rod(wallSurface(aH + 0.26 / R, floorY + 0.95, new Vector3(), -0.02), peg, 0.02, PLANK_DARK, 5, 0.018, false));
        plankParts.push(rod(blockC.clone().addScaledVector(out, -0.05).setY(blockC.y - 0.03), peg, 0.011, ROPE, 4));
        for (let s = 0; s < 3; s++) {
          const a = ch.range(0, TAU);
          const foot = bC.clone().add(new Vector3(Math.cos(a) * 0.06, 0.04, Math.sin(a) * 0.06));
          const head = foot.clone().add(new Vector3(Math.cos(a) * 0.12, 0.42 + ch.range(-0.05, 0.05), Math.sin(a) * 0.12));
          plankParts.push(rod(foot, head, 0.022, tone(PLANK_DARK, 0.9, 1.2), 5, 0.02, false));
        }
        charAudit.hoist = { tip: at3(tip), basket: at3(bC), boleGap: +boleGap(bC).toFixed(2) };
      }

      if (C.flowerBox) {
        // ---- the FLOWER BOX on the window ledge: a plank box, soil, a few heads and leaves ----
        const right = new Vector3(-facing.z, 0, facing.x);
        const ledgeY = winY - winR - 0.035;
        const boxY = ledgeY + 0.025 + 0.06;
        const half = winR + 0.06;
        const endA = wallSurface(aWin - half / R, boxY, new Vector3(), 0.1);
        const endB = wallSurface(aWin + half / R, boxY, new Vector3(), 0.1);
        plankParts.push(bar(endA, endB, 0.13, tone(PLANK, 0.85, 1.0), 0.12));
        plankParts.push(bar(endA.clone().setY(boxY + 0.05), endB.clone().setY(boxY + 0.05), 0.105, [0.09, 0.07, 0.05], 0.022));
        const f = foliage();
        const tints: [number, number, number][] = [
          [1.0, 0.72, 0.78],
          [1.0, 0.95, 0.62],
          [0.85, 0.75, 1.0],
          [1.0, 1.0, 0.95],
        ];
        const heads = 7;
        for (let i = 0; i < heads; i++) {
          const p = endA.clone().lerp(endB, (i + 0.5) / heads + ch.range(-0.04, 0.04)).setY(boxY + 0.07);
          const n = facing.clone().multiplyScalar(0.55).add(UPV).add(right.clone().multiplyScalar(ch.range(-0.3, 0.3))).normalize();
          f.addFlower(p, n, ch.range(0.055, 0.075), ch.range(0.05, 0.13), 0.03, tints[ch.int(0, tints.length)]);
          charAudit.flowers++;
        }
        // leaves spilling over the front edge (a cluster sphere would push half of them into the wall)
        for (let i = 0; i < 12; i++) {
          const p = endA.clone().lerp(endB, (i + 0.5) / 12 + ch.range(-0.03, 0.03)).setY(boxY + 0.06).addScaledVector(facing, ch.range(0, 0.05));
          const dir = facing.clone().multiplyScalar(ch.range(0.4, 1.0)).addScaledVector(UPV, ch.range(-0.25, 0.8)).addScaledVector(right, ch.range(-0.5, 0.5));
          f.addLeaf(p, dir, ch.range(0.06, 0.09), ch.range(0, TAU), 0.03, [0.95, 1.05, 0.8]);
        }
      }

      if (C.sprout) {
        // ---- the SPROUT: a sapling rooted in the cap's moss off the crown, leaning out a little;
        // a crown of fresh leaves and two pairs lower down ----
        const aS = ch.range(0, TAU);
        const rootP = capPoint(aS, 0.8, new Vector3());
        const lean = outAt(aS).multiplyScalar(0.14);
        const hS = ch.range(0.75, 0.95);
        const pts = [
          rootP.clone().setY(rootP.y - 0.05),
          rootP.clone().add(new Vector3(lean.x * 0.25, hS * 0.35, lean.z * 0.25)),
          rootP.clone().add(new Vector3(lean.x * 0.75 + ch.range(-0.04, 0.04), hS * 0.7, lean.z * 0.75 + ch.range(-0.04, 0.04))),
          rootP.clone().add(new Vector3(lean.x, hS, lean.z)),
        ];
        const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
        charBark.push(
          sweepTube(curve, {
            radius: (t) => lerp(0.026, 0.008, t),
            tubularSegments: 10,
            radialSegments: 6,
            uvMetres: 1.6,
            color: (t) => mix([0.34, 0.27, 0.17], [0.3, 0.34, 0.13], t),
            capEnd: true,
          }),
        );
        const f = foliage();
        const tip = pts[3];
        const crown = 6;
        for (let i = 0; i < crown; i++) {
          const a = (i / crown) * TAU + ch.range(-0.3, 0.3);
          f.addLeaf(tip, new Vector3(Math.cos(a), ch.range(0.15, 0.65), Math.sin(a)), ch.range(0.13, 0.19), ch.range(0, TAU), 0.07, [1.05, 1.15, 0.78]);
        }
        for (const t of [0.42, 0.62]) {
          const p = curve.getPointAt(t);
          for (const k of [-1, 1]) {
            const a = aS + (k * Math.PI) / 2 + ch.range(-0.4, 0.4);
            f.addLeaf(p, new Vector3(Math.cos(a), 0.3, Math.sin(a)), ch.range(0.09, 0.12), ch.range(0, TAU), 0.05, [1.0, 1.1, 0.8]);
          }
        }
        charAudit.sprout = at3(tip);
      }

      if (C.awning) {
        // ---- the WINDOW BROW: a bark roll over the window just outside its collar, standing
        // out most at the crown, mossed on top (the wall plate stops either side of it) ----
        const browR = winR + COLLAR_WIDTH + 0.02;
        const pts: Vector3[] = [];
        for (let i = 0; i <= 12; i++) {
          const th = lerp(0.12 * Math.PI, 0.88 * Math.PI, i / 12);
          pts.push(wallSurface(aWin + (Math.cos(th) * browR) / R, winY + Math.sin(th) * browR, new Vector3(), 0.05 + 0.11 * Math.sin(th)));
        }
        const bark = scaleRGB(wallColor(aWin, 0.8), 0.8);
        const moss: RGB = [MOSS_DEEP[0] * 1.6, MOSS_DEEP[1] * 1.8, MOSS_DEEP[2] * 1.5];
        charBark.push(
          sweepTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), {
            radius: (t) => lerp(0.035, 0.085, Math.sin(t * Math.PI)),
            tubularSegments: 20,
            radialSegments: 8,
            uvMetres: 1.6,
            displace: (t, ang) => 0.006 * Math.sin(ang * 5 + t * 21),
            color: (_t, _a, up) => mix(bark, moss, smoothstep(0.35, 0.85, up)),
            capStart: true,
            capEnd: true,
          }),
        );
        charAudit.awning = true;
      }

      if (C.herbs) {
        // ---- HERBS drying under the eave: a cord between two wall pegs, bundles hung head down ----
        const aHb = angleOf(C.herbs.deg);
        const yCord = eaveY - 0.34;
        const span = 0.95 / R;
        const pegs = [aHb - span / 2, aHb + span / 2].map((a) => {
          const tipP = wallSurface(a, yCord, new Vector3(), 0.13);
          plankParts.push(rod(wallSurface(a, yCord, new Vector3(), -0.02), tipP, 0.018, PLANK_DARK, 5, 0.015, false));
          return tipP;
        });
        const cord = (t: number) => pegs[0].clone().lerp(pegs[1], t).setY(yCord - 0.06 * 4 * t * (1 - t));
        for (let k = 0; k < 6; k++) plankParts.push(rod(cord(k / 6), cord((k + 1) / 6), 0.009, ROPE, 4));
        const f = foliage();
        // dried heads on the flower cards (pale straw, lavender, cream, rust) over a little dry leaf
        const heads: [number, number, number][] = [
          [1.0, 0.86, 0.5],
          [0.8, 0.66, 0.98],
          [1.0, 0.95, 0.78],
          [0.95, 0.6, 0.38],
          [0.9, 0.88, 0.55],
          [0.78, 0.64, 0.95],
        ];
        const out = outAt(aHb);
        for (let k = 0; k < 6; k++) {
          const at = cord((k + 0.5) / 6 + ch.range(-0.025, 0.025));
          const tie = at.clone().setY(at.y - ch.range(0.05, 0.08));
          plankParts.push(rod(at, tie, 0.007, ROPE, 4));
          // the stalks, bound at the tie and fanning down to the heads
          const len = ch.range(0.2, 0.28);
          plankParts.push(rod(tie.clone().setY(tie.y + 0.02), tie.clone().setY(tie.y - len), 0.014, [0.5, 0.44, 0.25], 5, 0.04));
          const bottom = tie.clone().setY(tie.y - len);
          for (let h = 0; h < 7; h++) {
            const a = ch.range(0, TAU);
            const p = bottom.clone().add(new Vector3(Math.cos(a) * 0.045, ch.range(-0.03, 0.04), Math.sin(a) * 0.045));
            f.addFlower(p, new Vector3(Math.cos(a) * 0.6, -1, Math.sin(a) * 0.6).addScaledVector(out, 0.5), ch.range(0.05, 0.07), 0.015, 0.015, heads[k]);
          }
          f.addLeafCluster(bottom.clone().setY(bottom.y + 0.06), 0.06, 5, { size: 0.07, amount: 0.015, droop: 1.3, tint: [0.85, 0.8, 0.5], tintSpread: 0.1, flatten: 1.4 });
          charAudit.herbs++;
        }
      }

      if (ladderParts.length) {
        const ladderGeo = merge(ladderParts);
        const ladderMesh = new Mesh(ladderGeo, mats.wood);
        ladderMesh.name = `distant-house-ladder:${def.id}`;
        ladderMesh.castShadow = ladderMesh.receiveShadow = true;
        group.add(ladderMesh);
        tris += triangles(ladderGeo);
        degenerate += countDegenerate(ladderGeo);
      }
      if (charBark.length) {
        const barkGeo = merge(charBark);
        const barkMesh = new Mesh(barkGeo, mats.bark);
        barkMesh.name = `distant-house-character:${def.id}`;
        barkMesh.castShadow = barkMesh.receiveShadow = true;
        group.add(barkMesh);
        tris += triangles(barkGeo);
        degenerate += countDegenerate(barkGeo);
      }
      if (charLeaves.builder) {
        for (const m of charLeaves.builder.build(mats, `hut-character:${def.id}`)) {
          group.add(m);
          if (m.geometry) tris += triangles(m.geometry as BufferGeometry);
        }
      }
    }

    // ---- round 44 (structures-28): the UNDERSIDE. Survey-1 crop 30: from the hollow path straight
    // up the hollow-column hut read as a black flat-shaded slab — the deck's and the platform's
    // bottoms are lit planks facing the ground, ≈ 0.02 in the canopy's shade. A soffit 8 m up in
    // a forest is bounce-lit, not black: the platform's underside and the deck's bottom are
    // boarded, and a JOIST FRAME shows under them in the planks' dark wood — radial joists from
    // the bole to the rim, three brace struts from the bole up to the rim, two bearers and three
    // cross joists under the deck — so the underside has structure and shadow instead of one face.
    // Round 45 (details-1): the boards were on the unlit glow material at a fixed brown
    // (≈ 0.05 linear, see SOFFIT_BOARD); they now go on `fenceWood` — the planks' maps under
    // the fences' shade floor (materials.ts FENCE_WOOD_FLOOR) — so they take the floor's light,
    // the grain and the fog like every other lit face, at the same level. The per-board tone
    // (SOFFIT_BOARD × 0.72–1.28, darker toward the bole, × WOOD_ON_FENCE_WOOD for the fence
    // tint and lift) is the vertex tint the floor reads through the map. One mesh for every hut,
    // handed to the caller (`soffit`) to fold into the fences' static bucket: no draw of its own. ----
    {
      const soffitTint = (k: number): RGB => [SOFFIT_BOARD[0] * WOOD_ON_FENCE_WOOD[0] * k, SOFFIT_BOARD[1] * WOOD_ON_FENCE_WOOD[1] * k, SOFFIT_BOARD[2] * WOOD_ON_FENCE_WOOD[2] * k];
      const sr = r.fork('soffit');
      // BOARDS, each its own quad strip with one tone (a board's tone is constant across it and
      // varies along it, with a dark gap between neighbours — from 8 m below, planks). The
      // platform's underside: 24 boards round the ring, radial; darker toward the bole (the
      // bounce comes in from the sides).
      const ringBoards = 24;
      const ringGap = 0.07;
      for (let b = 0; b < ringBoards; b++) {
        const tone = sr.range(0.72, 1.28);
        const gPhase = sr.range(0, TAU);
        const a0 = ((b + ringGap * 0.5) / ringBoards) * TAU;
        const a1 = ((b + 1 - ringGap * 0.5) / ringBoards) * TAU;
        const board = gridSurface(
          (u, v, out) => {
            const a = lerp(a0, a1, u);
            const rr = lerp(R * 0.86, platR + 0.004, v);
            out.position.set(c.x + Math.cos(a) * rr, floorY - 0.223, c.z + Math.sin(a) * rr);
            out.uv = [Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5];
            out.color = soffitTint(tone * lerp(0.7, 1, v) * (0.9 + 0.2 * Math.sin(v * 9 + gPhase)));
          },
          { cols: 2, rows: 5 },
        );
        soffitParts.push(faceToward(board, c.clone().setY(floorY - 10)));
      }
      // the deck's bottom: four boards along it, 1.5 mm under the box's lower face
      const deckM = basisMatrix(deckStart.clone().lerp(deckEnd, 0.5), deckEnd.clone().sub(deckStart));
      const deckLen = L + 0.15;
      const deckBoards = 4;
      const deckGap = 0.03;
      for (let b = 0; b < deckBoards; b++) {
        const tone = sr.range(0.72, 1.28);
        const gPhase = sr.range(0, TAU);
        const w0 = ((b + deckGap) / deckBoards - 0.5) * 0.93;
        const w1 = ((b + 1 - deckGap) / deckBoards - 0.5) * 0.93;
        const board = gridSurface(
          (u, v, out) => {
            out.position.set(lerp(w0, w1, u), -0.0615, (v - 0.5) * (deckLen - 0.02)).applyMatrix4(deckM);
            out.uv = [u * 0.93, v * deckLen];
            out.color = soffitTint(tone * (0.9 + 0.2 * Math.sin(v * 13 + gPhase)));
          },
          { cols: 2, rows: 7 },
        );
        soffitParts.push(faceToward(board, deckStart.clone().lerp(deckEnd, 0.5).setY(floorY - 10)));
      }
      // the joist frame under the platform: six radial joists and three brace struts from the bole
      const boleR = host.seat ? host.seat.radiusAt(floorH - 1.3) : R * 0.55;
      host.axisAt(floorH - 1.3, _axis);
      const boleFoot = _axis.clone();
      const jPhase = r.range(0, TAU);
      for (let j = 0; j < 6; j++) {
        const a = jPhase + (j / 6) * TAU;
        const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
        const from = c.clone().addScaledVector(dir, R * 0.5).setY(floorY - 0.275);
        const to = c.clone().addScaledVector(dir, platR - 0.03).setY(floorY - 0.275);
        plankParts.push(bar(from, to, 0.07, PLANK_DARK, 0.1));
        if (j % 2 === 0) {
          const foot = boleFoot.clone().addScaledVector(dir, boleR - 0.04);
          const head = c.clone().addScaledVector(dir, platR - 0.09).setY(floorY - 0.31);
          plankParts.push(bar(foot, head, 0.08, PLANK_DARK));
        }
      }
      // under the deck: two bearers along it, three cross joists
      for (const side of [-1, 1]) {
        const a = deckStart.clone().addScaledVector(wSide, side * 0.36).setY(deckStart.y - 0.1);
        const b = deckEnd.clone().addScaledVector(wSide, side * 0.36).setY(deckEnd.y - 0.1);
        plankParts.push(bar(a, b, 0.07, PLANK_DARK, 0.08));
      }
      for (const s of [0.12, 0.5, 0.88]) {
        const mid = deckStart.clone().lerp(deckEnd, s);
        mid.y -= 0.1;
        plankParts.push(bar(mid.clone().addScaledVector(wSide, -0.47), mid.clone().addScaledVector(wSide, 0.47), 0.08, PLANK_DARK, 0.08));
      }
    }

    const plankGeo = merge(plankParts);
    const plankMesh = new Mesh(plankGeo, mats.wood);
    plankMesh.name = `distant-house-planks:${def.id}`;
    plankMesh.castShadow = plankMesh.receiveShadow = true;
    group.add(plankMesh);
    tris += triangles(plankGeo);
    degenerate += countDegenerate(plankGeo);

    const doorC = doorBase.clone().setY(floorY + doorH / 2);
    const p3 = (p: Vector3): [number, number, number] => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
    audit.push({
      id: def.id,
      host: def.host.source,
      hostSource: host.source,
      seatId: host.seat?.id ?? null,
      centre: [+c.x.toFixed(2), +floorY.toFixed(2), +c.z.toFixed(2)],
      floorY: +floorY.toFixed(2),
      radius: +R.toFixed(3),
      radiusForBole: radiusForBole === null ? null : +radiusForBole.toFixed(3),
      boleClearance: boleClearance === null ? null : +boleClearance.toFixed(3),
      window: p3(winC),
      door: p3(doorC),
      lamps: [p3(winLamp), p3(doorLamp)],
      pods: pods.map(p3),
      litPoints: [winLamp, doorLamp, ...pods].map(p3),
      revealPeak: +revealPeak.toFixed(2),
      revealMouthPeak: +mouthPeak.toFixed(2),
      revealMouthLitShare: +mouthLit.toFixed(2),
      dressing: def.dressing ? dressAudit : null,
      character: def.character ? charAudit : null,
    });
  }

  const glowGeo = dropDegenerate(merge(glowParts));
  const glow = new Mesh(glowGeo, mats.distantGlow);
  glow.name = 'distant-glow';
  glow.castShadow = glow.receiveShadow = false;
  group.add(glow);
  tris += triangles(glowGeo);
  degenerate += countDegenerate(glowGeo);
  let soffit: Mesh | null = null;
  if (soffitParts.length) {
    const soffitGeo = dropDegenerate(merge(soffitParts));
    soffit = new Mesh(soffitGeo, mats.fenceWood);
    soffit.name = 'distant-soffit';
    // the fences' flags, so the mesh folds into their bucket (a thin board 1.5 mm under a plank
    // face has nothing to cast and the sun never reaches it — the flags cost nothing). It is NOT
    // added to `group`: the huts are consolidated apart from the hero structures (index.ts, round
    // 20), where this mesh would be a bucket of its own — a colour draw in every view that sees a
    // hut; the caller attaches it to the hero group before that group is merged.
    soffit.castShadow = soffit.receiveShadow = true;
    tris += triangles(soffitGeo);
    degenerate += countDegenerate(soffitGeo);
  }

  const shared = audit.filter((a) => a.hostSource === 'shared').length;
  const peak = distantGlowPeak(mats);
  const constPeak = (t: RGB) => +(Math.max(t[0], t[1], t[2]) * peak).toFixed(2);
  return {
    group,
    lanterns,
    lights,
    walk,
    cameraWalls,
    glow,
    soffit,
    triangles: tris,
    degenerateTriangles: degenerate,
    hostSource: shared === audit.length ? 'shared' : shared === 0 ? 'constants' : 'mixed',
    glowTintPeaks: { amber: constPeak(GLOW_AMBER), door: constPeak(GLOW_DOOR), lime: constPeak(GLOW_LIME), reveal: constPeak(REVEAL_WOOD), revealDark: constPeak(REVEAL_DARK) },
    reveal: {
      material: 'distant-glow (white × 2.2, lamp-response vertex tints)',
      emissiveRimPeak: 0,
      peakLinear: +Math.max(...audit.map((a) => a.revealPeak)).toFixed(2),
      mouthPeakLinear: +Math.max(...audit.map((a) => a.revealMouthPeak)).toFixed(2),
      mouthLitShare: +(audit.reduce((s, a) => s + a.revealMouthLitShare, 0) / Math.max(1, audit.length)).toFixed(2),
      litThresholdLinear: REVEAL_LIT_LINEAR,
      darkLinear: constPeak(REVEAL_DARK),
      splay: { window: WINDOW_SPLAY, door: DOOR_SPLAY },
      lampOffset: { window: WINDOW_LAMP_OFFSET, door: [DOOR_LAMP_X, DOOR_LAMP_H] },
      collar: 'bark (wall shade), +0 draws',
    },
    audit,
  };
}

/**
 * Peak linear channel of a glow part's vertex tints on the × `materialPeak` material, over every
 * vertex or over the first `count` (a gridSurface's first row: the tunnel's mouth).
 */
function tintPeak(geo: BufferGeometry, materialPeak: number, count?: number): number {
  const col = geo.attributes.color;
  if (!col) return 0;
  const n = count === undefined ? col.count : Math.min(count, col.count);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, col.getX(i), col.getY(i), col.getZ(i));
  return peak * materialPeak;
}

/** share of the first `count` vertices whose linear peak exceeds `threshold` (the mouth row's lit share) */
function tintLitShare(geo: BufferGeometry, materialPeak: number, count: number, threshold: number): number {
  const col = geo.attributes.color;
  if (!col) return 0;
  const n = Math.min(count, col.count);
  let lit = 0;
  for (let i = 0; i < n; i++) if (Math.max(col.getX(i), col.getY(i), col.getZ(i)) * materialPeak > threshold) lit++;
  return n ? lit / n : 0;
}

/** peak channel of the shared emissive (audit: it must clear the height fog's 2.0 far-shade exemption) */
export function distantGlowPeak(mats: StructureMaterials): number {
  const c = mats.distantGlow.color;
  return Math.max(c.r, c.g, c.b);
}
