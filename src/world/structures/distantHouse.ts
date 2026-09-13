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
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, LatheGeometry, Mesh, Vector2, Vector3 } from 'three';
import type { TrunkSeat, WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { basisMatrix, gridSurface, merge, setColorAttribute, TAU } from './geometry';
import { MOSS_ALBEDO_PEAK, type StructureMaterials } from './materials';

export interface DistantHouseDef {
  id: string;
  /** host trunk seat (world x, z) and where it is authored */
  host: { x: number; z: number; source: string };
  /** hut centre offset from the seat (m, world x/z): shifts the silhouette clear of hero elements */
  offset: [number, number];
  /** platform height above the seat's terrain (m) */
  floor: number;
  /**
   * hut wall radius (m): the hut's authored scale (door 0.7 m, window 0.24 R). Without a published
   * seat it must also cover the bole's radius + lean + wander over the hut's height band; with one
   * the wall grows to clear `radiusAt` + drift + BOLE_CLEARANCE when the bole needs more.
   */
  radius: number;
  /** wall height floor → eave (m) */
  wall: number;
  /** cap rise above the eave (m) */
  capHeight: number;
  /** azimuth (deg, from +Z toward +X) the round window faces — the mean direction to cameras A/B/D */
  facingDeg: number;
  /** door azimuth relative to the window (deg, + toward +X side = screen right) */
  doorDeg: number;
  /** walkway stub: azimuth relative to the window (deg) and length (m) */
  walkway: { deg: number; length: number };
  /** 2–3 pods: end post, eave, mid post */
  pods: number;
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
    capHeight: 1.25,
    facingDeg: -15,
    doorDeg: 38,
    walkway: { deg: -78, length: 3.2 },
    pods: 3,
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
    walkway: { deg: 80, length: 2.6 },
    pods: 2,
  },
];

/** a published seat counts as a hut's host when its base is within this of the constants (m) */
export const HOST_MATCH_M = 1.5;
/** wall clearance over the bole's radius (+ its axis drift) across the hut's height band (m) */
export const BOLE_CLEARANCE = 0.06;
/** the wall's radius factor at the eave (it tapers in a little) */
const WALL_TAPER = 0.96;
/** the wall's wobble amplitudes (fractions of the radius): 3 and 7 lobes */
const WOBBLE_3 = 0.045;
const WOBBLE_7 = 0.02;
/** the smallest factor the taper and the wobble ever apply to the nominal radius */
const WALL_MIN_FACTOR = WALL_TAPER * (1 - WOBBLE_3 - WOBBLE_7);
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
/** fine / coarse wall cell sizes (m): around the openings / elsewhere */
const FINE_CELL = { around: 0.07, up: 0.1 };
const COARSE_CELL = { around: 0.35, up: 0.4 };

export type HostSource = 'shared' | 'constants';

export interface DistantHouseBuild {
  group: Group;
  /** the one emissive mesh shared by all houses */
  glow: Mesh;
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
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
  const audit: DistantHouseBuild['audit'] = [];
  let tris = 0;
  let degenerate = 0;
  const _axis = new Vector3();

  for (const def of defs) {
    const r = rng.fork(def.id);
    const host = resolveHost(def, ctx);
    const floorY = host.base.y + def.floor;
    const eaveY = floorY + def.wall;
    // the hut sits on the bole's axis at floor height (plus the authored offset)
    const axisFloor = host.axisAt(def.floor, _axis).clone();
    const c = new Vector3(axisFloor.x + def.offset[0], floorY, axisFloor.z + def.offset[1]);

    // ---- wall radius: over the hut's height band (platform underside → soffit), the bole's radius
    // plus its axis drift from the hut centre, + BOLE_CLEARANCE, at the wall's tightest factor ----
    let R = def.radius;
    let radiusForBole: number | null = null;
    let boleClearance: number | null = null;
    if (host.seat) {
      const seat = host.seat;
      let need = 0;
      for (let h = def.floor - 0.3; h <= def.floor + def.wall + 0.15 + 1e-6; h += 0.1) {
        seat.axisAt(h, _axis);
        need = Math.max(need, seat.radiusAt(h) + Math.hypot(_axis.x - c.x, _axis.z - c.z));
      }
      // the authored radius is the hut's scale (door 0.7 m, window 0.24 R); the bole only ever
      // grows it — the west column's slim seat (bole 0.5 m at 6 m) would otherwise shrink that
      // hut to a 0.7 m barrel narrower than its door
      radiusForBole = (need + BOLE_CLEARANCE) / WALL_MIN_FACTOR;
      R = Math.max(def.radius, radiusForBole);
      boleClearance = Infinity;
      for (let h = def.floor - 0.3; h <= def.floor + def.wall + 0.15 + 1e-6; h += 0.1) {
        seat.axisAt(h, _axis);
        const taper = lerp(1, WALL_TAPER, clamp((h - def.floor) / def.wall, 0, 1));
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

    // ---- openings, in wall coordinates (angle a, height y) ----
    const aWin = Math.atan2(facing.z, facing.x);
    const winY = floorY + 1.35;
    const winR = R * 0.24;
    const doorDir = az(def.facingDeg + def.doorDeg);
    const aDoor = aWin + dAngle(Math.atan2(doorDir.z, doorDir.x), aWin);
    const doorW = 0.7;
    const doorH = 1.35;
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
    /** the wall's vertex shade at angle a and height fraction v (floor → eave) */
    const wallColor = (a: number, v: number): RGB => {
      const shade = lerp(0.72, 1, v) * (1 - 0.22 * Math.max(0, Math.sin(2 * a + wobble)));
      return [WALL[0] * shade, WALL[1] * shade, WALL[2] * shade];
    };
    const wallPatch = (a0: number, a1: number, cell: { around: number; up: number }, hole?: (a: number, y: number) => boolean) => {
      const cols = Math.max(2, Math.ceil(((a1 - a0) * R) / cell.around));
      const rows = Math.max(2, Math.round(def.wall / cell.up) + 1);
      return gridSurface(
        (u, v, out) => {
          const a = lerp(a0, a1, u);
          const y = lerp(floorY, eaveY, v);
          wallSurface(a, y, out.position);
          out.uv = [(a * R) / 1.6, (v * def.wall) / 1.6];
          out.color = wallColor(a, v);
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
    const eaveR = R + 0.45;
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
    const winTunnel = gridSurface(
      (u, v, out) => {
        const th = u * TAU;
        const rr = winRadius(v);
        wallSurface(aWin + (Math.cos(th) * rr) / R, winY + Math.sin(th) * rr, out.position, COLLAR_OUT * (1 - v)).addScaledVector(facing, -v * WINDOW_DEPTH);
        out.uv = [(th * winR) / 1.6, (v * WINDOW_DEPTH) / 1.6];
        // the splayed tunnel's inward normal: toward the axis, tilted out toward the mouth
        _rad.copy(winTangent).multiplyScalar(Math.cos(th));
        _rad.y += Math.sin(th);
        _n.copy(_rad).multiplyScalar(-1).addScaledVector(facing, winSplaySlope).normalize();
        out.color = revealTint(lampIrradiance(winLamp, out.position, _n), winGrain(th));
      },
      { cols: 20, rows: 4, closedU: true },
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
    glowParts.push(winTunnel, winBackDisc, doorTunnel, doorFloor, doorBack);

    const barkGeo = merge([...walls, soffit, winCollar, doorCollar]);
    const barkMesh = new Mesh(barkGeo, mats.bark);
    barkMesh.name = `distant-house-bark:${def.id}`;
    barkMesh.castShadow = barkMesh.receiveShadow = true;
    group.add(barkMesh);
    tris += triangles(barkGeo);
    degenerate += countDegenerate(barkGeo);

    // ---- cap moss: a low dome curling down at the rim, the trunk rising through its crown; the
    // pole row's collapsed triangles are dropped (round 18: 28 zero-area fans per cap before) ----
    const capPhase = r.range(0, TAU);
    const cap = dropDegenerate(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          const rim = 1 + 0.035 * Math.sin(5 * a + capPhase) + 0.02 * Math.sin(9 * a - capPhase);
          const rr = eaveR * rim * Math.pow(Math.cos((v * Math.PI) / 2), 0.9);
          const y = eaveY - 0.14 + (def.capHeight + 0.14) * Math.pow(Math.sin((v * Math.PI) / 2), 1.15);
          out.position.set(c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr);
          out.uv = [(Math.cos(a) * (rr + 0.3)) / 1.6, (Math.sin(a) * (rr + 0.3)) / 1.6];
          const mottle = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(11 * a + 6 * v + capPhase));
          const bright = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(7 * a - 4 * v + capPhase * 0.7));
          const under = v < 0.06 ? 0.45 : 1;
          const m = MOSS_ALBEDO_PEAK * lerp(0.9, 0.62, v) * mottle * under;
          out.color = mix(MOSS_DEEP, MOSS_SUN, bright, m);
        },
        { cols: 28, rows: 7, closedU: true },
      ),
    );
    const capMesh = new Mesh(cap, mats.capMoss);
    capMesh.name = `distant-house-cap:${def.id}`;
    capMesh.castShadow = capMesh.receiveShadow = true;
    group.add(capMesh);
    tris += triangles(cap);
    degenerate += countDegenerate(cap);

    // ---- planks: platform, walkway stub, window bars, pod hangers ----
    const plankParts: BufferGeometry[] = [];
    const platR = R + 0.22;
    plankParts.push(ring(c, 0.02, platR, floorY + 0.01, true, () => PLANK, 24, 3));
    plankParts.push(ring(c, 0.02, platR, floorY - 0.22, false, () => PLANK, 24, 3));
    plankParts.push(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          out.position.set(c.x + Math.cos(a) * platR, lerp(floorY - 0.22, floorY + 0.01, v), c.z + Math.sin(a) * platR);
          out.uv = [(a * platR) / 1.6, v * 0.2];
          out.color = PLANK;
        },
        { cols: 24, rows: 2, closedU: true },
      ),
    );

    // walkway: a plank deck leaving the platform rim, dropping 4°, with posts and a sagging rope rail
    const wDir = az(def.facingDeg + def.walkway.deg);
    const wSide = new Vector3(-wDir.z, 0, wDir.x);
    const L = def.walkway.length;
    const deckStart = c.clone().addScaledVector(wDir, platR - 0.15).setY(floorY - 0.06);
    const deckEnd = c.clone().addScaledVector(wDir, platR + L).setY(floorY - 0.06 - L * Math.tan(4 * DEG));
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
        .addScaledVector(wDir, R - 0.05)
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
    const endHook = endPostTop.clone().addScaledVector(wDir, 0.12).setY(endPostTop.y + 0.02);
    hang(endHook, 0.22, GLOW_AMBER, endPostTop.clone().setY(endPostTop.y + 0.02));
    if (def.pods >= 2) {
      const eaveDir = az(def.facingDeg + def.doorDeg * 0.5);
      const hook = c.clone().addScaledVector(eaveDir, eaveR - 0.1).setY(eaveY - 0.02);
      hang(hook, 0.45, def.pods >= 3 ? GLOW_LIME : GLOW_AMBER);
    }
    if (def.pods >= 3) {
      const midPostTop = postTops[0][0];
      const midHook = midPostTop.clone().addScaledVector(wSide, -0.12).setY(midPostTop.y + 0.02);
      hang(midHook, 0.2, GLOW_AMBER, midPostTop.clone().setY(midPostTop.y + 0.02));
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
    });
  }

  const glowGeo = dropDegenerate(merge(glowParts));
  const glow = new Mesh(glowGeo, mats.distantGlow);
  glow.name = 'distant-glow';
  glow.castShadow = glow.receiveShadow = false;
  group.add(glow);
  tris += triangles(glowGeo);
  degenerate += countDegenerate(glowGeo);

  const shared = audit.filter((a) => a.hostSource === 'shared').length;
  const peak = distantGlowPeak(mats);
  const constPeak = (t: RGB) => +(Math.max(t[0], t[1], t[2]) * peak).toFixed(2);
  return {
    group,
    glow,
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
