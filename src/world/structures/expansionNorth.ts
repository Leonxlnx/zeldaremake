/**
 * 2026-09-24 (expansion-north; owner 06:07: "more structures along the path further down"): the
 * built things of the GROVE above the ledge terrace (layout.ts `EXPANSION_NORTH`, terrain/north.ts)
 * — a second hamlet on a shelf cut into the hillside 80–110 m north of the plaza:
 *  - the trunk house (house.ts, the upper house's settings) and its yard: a woodpile, a chopping
 *    block, pots, baskets, a bench and a washing line;
 *  - the STILT HOUSE over the falling east slope: a `distantHouse` hut on a cut stump and four log
 *    stilts on stone pads, a plank veranda round its wall inside a railing, reached from the shelf
 *    by a cleated plank gangway on a trestle; a wooden ladder down its south side (decorative);
 *  - the TREE HUT high on its own bark column, joined to the stilt house's veranda by a short
 *    rope walkway; a rope ladder, a hoist, and a lookout nest on the column over its cap;
 *  - two pod-lantern posts and the signpost at the flight's foot;
 *  - use and repair: worn sill planks at both huts' doors, the veranda's boards trodden pale before
 *    the door and one replaced in fresh wood, the gangway's rails rubbed pale and one cleat lost, a
 *    rope-walk plank snapped in half and a hand rope spliced, a sapling in the stilt house's cap.
 *
 * No light joins the scene: every glow is emissive (the pods, the huts' lamps and lit rooms); the
 * trunk house's and the posts' point lights are taken out of their groups (a light that joins or
 * leaves the scene with the group's visibility would recompile every lit program). The character
 * walks the gangway, the veranda, the walkways and the rope walk (walk surfaces and spans) and the
 * railings and deck sides keep him on them (walk edges); the huts' doors are shut (the play camera
 * never goes into a room). structures/index.ts consolidates the group on its own and hides it
 * beyond GROVE_VISIBLE_M of the grove or when the frustum meets none of its spheres.
 *
 * Own rng fork, appended after every existing stream: nothing built before moves.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  LineCurve3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Camera,
  type Curve,
  type Material,
} from 'three';
import { EXPANSION_NORTH, northGangway, northRopeWalkEnds } from '../layout';
import type { CameraWall, WalkEdge, WalkSpan, WalkSurface, WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { applyShadeFloor, type ShadeFloor } from '../materials/shadeFloor';
import { GANGWAY_TRESTLE_T, STILT_R, STILT_STUMP, VERANDA_R, gangwayTrestleFeet } from '../terrain/north';
import { GROVE_VISIBLE_M, groveSpheres, groveVisible } from '../util/groveLocality';
import { sunVector } from '../util/expansionLocality';
import { WALL_MAX_FACTOR, buildDistantHouses, type DistantHouseDef } from './distantHouse';
import { ropeTube } from './fence';
import { FoliageBuilder } from './foliage';
import { TAU, basisMatrix, gridSurface, merge, setColorAttribute, sweepTube } from './geometry';
import { buildHouse, type HouseSharedMaterials } from './house';
import { buildLantern, lanternHanger, type LanternRig } from './lantern';
import { buildLanternPost } from './lanternPost';
import { Noise3D, type StructureMaterials } from './materials';
import { buildMossTufts, type MossTuftSpec } from './mossTufts';
import { buildSignpost } from './signpost';
import { checkedCap, endFrame, footMoss } from './woodGrain';

export { GROVE_VISIBLE_M };

type RGB = [number, number, number];
type P3 = [number, number, number];

const N = EXPANSION_NORTH;
const SH = N.stilt;
const TH = N.hut;
const COL = N.column;
const GW = northGangway();
const RW = northRopeWalkEnds();
const DEG = Math.PI / 180;

/** azimuth (deg, from +Z toward +X: the layout's convention) as a unit vector */
const az = (deg: number) => new Vector3(Math.sin(deg * DEG), 0, Math.cos(deg * DEG));
/** a horizontal direction's angle (rad, from +x toward +z: the walk surfaces' convention) */
const angleOf = (d: Vector3) => Math.atan2(d.z, d.x);
const dirAt = (a: number) => new Vector3(Math.cos(a), 0, Math.sin(a));
const p3 = (p: Vector3): P3 => [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)];
const scaleRGB = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const tri = (g: BufferGeometry) => Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);

/** the huts' plank tints (distantHouse.ts PLANK / PLANK_DARK): the veranda and gangway match the platforms */
const PLANK: RGB = [0.42, 0.35, 0.27];
const PLANK_DARK: RGB = [0.26, 0.21, 0.16];
const ROPE_TINT: RGB = [0.9, 0.84, 0.72];
const MOSS: RGB = [0.32, 0.44, 0.09];
/** fresh-cut wood of a repair: paler and yellower than the weathered planks */
const FRESH_PLANK: RGB = [0.6, 0.47, 0.31];
/** the replaced veranda board's angle from the door (rad): on the south side the walk goes round by */
const PATCH_FROM_DOOR = -1.1;
/** veranda boards within this angle of the door (rad) are trodden pale */
const TRODDEN_HALF = 0.34;
/** the gangway's lost cleat (0 at the foot): 2.4 m up the run, just past the trestle */
const LOST_CLEAT = 6;
/** the rope walk's broken plank (0 at the stilt house's stub): half of it gone, past the middle */
const BROKEN_PLANK = 6;
/** wood worn by feet or hands (w 0 … 1): greyer and paler */
const trodden = (c: RGB, w: number): RGB => {
  const l = (c[0] + c[1] + c[2]) / 3;
  const k = 1 + 0.18 * w;
  return [lerp(c[0], l, 0.32 * w) * k, lerp(c[1], l, 0.32 * w) * k, lerp(c[2], l, 0.32 * w) * k];
};
/** planks map (weathered_planks): nine vertical boards per tile, seams at x = 62 + 113.9 k px of 1024 */
const BOARD_U0 = 62 / 1024;
const BOARD_W = 113.9 / 1024;
const BOARD_INSET = 7 / 1024;
/** rail height over a deck (m): the huts' railings (distantHouse RAIL_H 0.86 + the post caps) */
const RAIL_H = 0.92;
/** walk edges' half width (m): a railing blocks this far either side of its line */
const EDGE_HW = 0.13;
/** Link's centre stays this far off a hut wall's widest bulge (m): his shoulder's half width */
const WALL_CLEAR = 0.16;

/** the homespun cloth on the washing line: mostly its own colour in the shade */
const CLOTH_FLOOR: ShadeFloor = { lift: 3.0, texture: 0.9, canopy: 1, albedo: 0.22, chroma: 1 };

/** the stilt house and the tree hut as `distantHouse` defs (no published seat: both resolve to the constants) */
export const GROVE_HUTS: DistantHouseDef[] = [
  {
    id: 'grove-stilt',
    host: { x: SH.host[0], z: SH.host[1], source: 'layout EXPANSION_NORTH.stilt (cut stump + four stilts, structures/expansionNorth.ts)' },
    offset: [0, 0],
    floor: 3,
    floorAbsolute: SH.floorY,
    radius: SH.radius,
    wall: SH.wall,
    doorSize: [0.76, 1.55],
    capHeight: SH.capHeight,
    capOverhang: SH.capOverhang,
    facingDeg: SH.facingDeg,
    doorDeg: SH.doorAbsDeg - SH.facingDeg,
    // the walkway leaves the veranda's rim (not the platform's) toward the tree hut
    walkway: { deg: 0, length: 1, end: [...RW.stilt] as P3, from: VERANDA_R },
    pods: 2,
    dressing: { doorBough: { length: 2.2, pods: 2 }, interior: true, fringe: true },
    // herbs drying under the east eave over the veranda's work corner; a brow over the window, flowers on its ledge
    character: { awning: true, flowerBox: true, herbs: { deg: 150 } },
  },
  {
    id: 'grove-tree-hut',
    host: { x: TH.host[0], z: TH.host[1], source: 'layout EXPANSION_NORTH.hut (bark column, structures/expansionNorth.ts)' },
    offset: [0, 0],
    floor: 4.3,
    floorAbsolute: TH.floorY,
    radius: TH.radius,
    wall: TH.wall,
    doorSize: [0.72, 1.5],
    capHeight: TH.capHeight,
    capOverhang: TH.capOverhang,
    facingDeg: TH.facingDeg,
    doorDeg: TH.doorAbsDeg - TH.facingDeg,
    walkway: { deg: 0, length: 1, end: [...RW.hut] as P3 },
    pods: 3,
    dressing: { doorBough: { length: 2.0, pods: 2 }, interior: true, fringe: true },
    // the high hut: a railing round its platform, a rope ladder to the ground (decorative) and a hoist
    character: { ladder: { deg: TH.ladderAbsDeg - TH.facingDeg }, railing: true, hoist: { deg: TH.hoistAbsDeg - TH.facingDeg, drop: 2.8 } },
  },
];

export interface GroveAudit {
  house: { id: string; lanterns: number; lightsRemoved: number };
  huts: { id: string; hostSource: string; centre: P3; floorY: number; radius: number; door: P3; pods: number; boughPods: number; character: unknown }[];
  veranda: { radius: number; boards: number; railingPosts: number; stilts: P3[]; stump: { top: number; foot: number; ground: number } };
  gangway: { foot: P3; head: P3; slopeDeg: number; treads: number; cleats: number; trestle: P3[] };
  ropeWalk: { from: P3; to: P3; planks: number; sag: number };
  column: { foot: P3; top: P3; radiusAtFloor: number; limbs: number; roots: number };
  nest: { floorY: number; radius: number; boards: number; rungs: number };
  props: { pots: number; baskets: number; woodpileLogs: number; cloths: number; blockers: number };
  pods: P3[];
  walk: { surfaces: number; spans: number; edges: number };
  triangles: { house: number; huts: number; built: number; foliage: number; tufts: number };
  leaves: number;
  pointLights: 0;
}

export interface GroveBuild {
  group: Group;
  lanterns: LanternRig[];
  walkSurfaces: WalkSurface[];
  /** the two huts' walls as exact solids for the play camera (the veranda's walk runs its line along the stilt house's) */
  cameraWalls: CameraWall[];
  walkSpans: WalkSpan[];
  walkEdges: WalkEdge[];
  bases: P3[];
  /** everything standing on the grove's ground the vegetation keeps off (`ctx.shared.builtFootprints`): the props, woodpiles, ladder feet, the hoist's basket at rest, the posts and the sign */
  footprints: { x: number; z: number; r: number }[];
  /** materials this build created (structures/index.ts disposes them; the textures are the library's) */
  owned: { dispose(): void }[];
  /** the group's visibility for this camera (util/groveLocality.ts `groveVisible`) */
  visible(camera: Camera): boolean;
  audit: GroveAudit;
}

// ---------------------------------------------------------------------------------------------
// geometry helpers

/** a round rod from a (radius r) to b (radius r2), capped: posts, rungs, rails, pegs */
function rod(a: Vector3, b: Vector3, r: number, color: RGB, sides = 7, r2 = r): BufferGeometry {
  const dir = b.clone().sub(a);
  const geo = new CylinderGeometry(r2, r, dir.length(), sides, 1, false);
  geo.rotateX(Math.PI / 2);
  geo.applyMatrix4(basisMatrix(a.clone().lerp(b, 0.5), dir));
  return setColorAttribute(geo, color);
}

/** a square-section beam from a to b, `t` wide and `t2` deep */
function bar(a: Vector3, b: Vector3, t: number, color: RGB, t2 = t): BufferGeometry {
  const dir = b.clone().sub(a);
  const geo = new BoxGeometry(t, t2, dir.length());
  geo.applyMatrix4(basisMatrix(a.clone().lerp(b, 0.5), dir));
  return setColorAttribute(geo, color);
}

/**
 * A board: the centre line of its TOP face from `a` to `b`, `w` wide across `across`, `t` thick
 * under the top, bowed down `bow` m mid-length; uv on one board of the planks map (the grain
 * along it); the sides and underside darker than the top, a little grain in the tone.
 */
function board(a: Vector3, b: Vector3, across: Vector3, w: number, t: number, tint: RGB, idx: number, noise: Noise2D, seed: number, bow = 0): BufferGeometry {
  const along = b.clone().sub(a);
  const len = along.length();
  along.divideScalar(len);
  const side = across.clone().addScaledVector(along, -across.dot(along)).normalize();
  const up = new Vector3().crossVectors(along, side);
  if (up.y < 0) {
    side.negate();
    up.negate();
  }
  const g = new BoxGeometry(w, t, len, 2, 1, Math.max(1, Math.round(len / 0.22)));
  g.translate(0, -t / 2, 0);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const u0 = BOARD_U0 + (idx % 9) * BOARD_W + BOARD_INSET;
  const uW = BOARD_W - 2 * BOARD_INSET;
  const v0 = (seed * 0.137) % 1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const zu = clamp((2 * z) / len, -1, 1);
    pos.setY(i, pos.getY(i) - bow * (1 - zu * zu));
    uv.setXY(i, u0 + (x / w + 0.5) * uW, v0 + z * 0.41);
    const ny = nrm.getY(i);
    const face = ny > 0.5 ? 1 : ny < -0.5 ? 0.5 : 0.72;
    const grain = 0.9 + 0.16 * noise.noise(seed * 1.7 + x * 3, z * 2.3);
    const ends = 1 - 0.16 * smoothstep(0.75, 1, Math.abs(zu));
    const k = face * grain * ends;
    col[i * 3] = tint[0] * k;
    col[i * 3 + 1] = tint[1] * k;
    col[i * 3 + 2] = tint[2] * k;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.applyMatrix4(new Matrix4().makeBasis(side, up, along).setPosition(a.clone().lerp(b, 0.5)));
  return g;
}

/**
 * A veranda board: a wedge round `c` from radius r0 to r1 over the angles a0 … a1 (rad, from +x
 * toward +z), its top at `top`, `t` thick; cupped a hair, the outer end weathered darker.
 */
function wedgeBoard(c: Vector3, r0: number, r1: number, a0: number, a1: number, top: number, t: number, tint: RGB, idx: number, noise: Noise2D, seed: number): BufferGeometry {
  const g = new BoxGeometry(1, 1, 1, 2, 1, 4);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const u0 = BOARD_U0 + (idx % 9) * BOARD_W + BOARD_INSET;
  const uW = BOARD_W - 2 * BOARD_INSET;
  const v0 = (seed * 0.137) % 1;
  const lift = 0.004 * noise.noise(seed * 2.1, 0.5);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i) + 0.5;
    const ly = pos.getY(i) + 0.5;
    const lz = pos.getZ(i) + 0.5;
    const ny = nrm.getY(i);
    const r = lerp(r0, r1, lz);
    const a = lerp(a0, a1, lx);
    const cup = 0.003 * (4 * (lx - 0.5) ** 2 - 0.33) * ly;
    pos.setXYZ(i, c.x + Math.cos(a) * r, top - t * (1 - ly) + cup + lift, c.z + Math.sin(a) * r);
    uv.setXY(i, u0 + lx * uW, v0 + lz * (r1 - r0) * 0.41);
    const face = ny > 0.5 ? 1 : ny < -0.5 ? 0.5 : 0.74;
    const grain = 0.9 + 0.16 * noise.noise(seed * 3.1 + lx * 2, lz * 5);
    const weather = 1 - 0.2 * smoothstep(0.7, 1, lz);
    const k = face * grain * weather;
    col[i * 3] = tint[0] * k;
    col[i * 3 + 1] = tint[1] * k;
    col[i * 3 + 2] = tint[2] * k;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** a barked log swept along `curve`: ridged bark as a radial wobble, lit a touch paler on its crown */
function logTube(curve: Curve<Vector3>, radius: (t: number) => number, noise: Noise2D, seed: number, tone: number, ts = 10, rs = 10, capEnd = false): BufferGeometry {
  return sweepTube(curve, {
    radius,
    tubularSegments: ts,
    radialSegments: rs,
    uvMetres: 0.9,
    capEnd,
    displace: (t, ang) => (noise.ridged(ang * 1.4 + seed, t * 3 + seed * 0.7, 2) - 0.5) * 0.018 * Math.min(1, radius(t) * 8),
    color: (t, ang, up) => {
      const ridge = noise.ridged(ang * 1.4 + seed, t * 3 + seed * 0.7, 2);
      const d = tone * (0.72 + 0.4 * ridge) * (0.82 + 0.2 * Math.max(0, up));
      return [d, d * 0.93, d * 0.84];
    },
  });
}

/** `turns` rope turns round a (nearly straight) member at `centre(s)` (s: metres along it about the middle) */
function lashing(centre: (s: number) => Vector3, r: number, turns: number, rise: number, ropeR: number, tint: RGB, noise: Noise2D, seed: number, a0: number, axis: Vector3 = new Vector3(0, 1, 0)): BufferGeometry {
  const ax = axis.clone().normalize();
  const e1 = Math.abs(ax.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const u = new Vector3().crossVectors(ax, e1).normalize();
  const v = new Vector3().crossVectors(ax, u).normalize();
  const pts: Vector3[] = [];
  const n = Math.ceil(turns * 12);
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    const ang = a0 + s * turns * TAU;
    const c = centre((s - 0.5) * turns * rise);
    pts.push(c.clone().addScaledVector(u, Math.cos(ang) * r).addScaledVector(v, Math.sin(ang) * r));
  }
  return ropeTube(new CatmullRomCurve3(pts), ropeR, seed, tint, noise, seed * 3.1);
}

/** a straight cord (net cords, pegs' ties): a thin tube with a flat tint */
function cord(a: Vector3, b: Vector3, r: number, tint: RGB): BufferGeometry {
  return sweepTube(new LineCurve3(a, b), { radius: () => r, tubularSegments: 2, radialSegments: 5, uvMetres: 0.2, color: () => tint });
}

/** a flat field stone half sunk at `p` (the stilts' pads, the woodpile's footing) */
function padStone(p: Vector3, rx: number, ry: number, rz: number, yaw: number, noise: Noise2D, seed: number, tone: number): BufferGeometry {
  const g = new SphereGeometry(1, 12, 7);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + 0.16 * noise.noise(x * 1.7 + seed, z * 1.7 + y + seed * 0.3);
    const flat = y > 0 ? 0.55 : 1;
    pos.setXYZ(i, x * rx * k, y * ry * k * flat, z * rz * k);
    const d = tone * (0.72 + 0.28 * Math.max(0, y)) * (0.92 + 0.16 * noise.noise(x * 5 + seed, z * 5));
    col[i * 3] = d;
    col[i * 3 + 1] = d * 0.97;
    col[i * 3 + 2] = d * 0.92;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.rotateY(yaw);
  g.translate(p.x, p.y, p.z);
  return g;
}

/** a clay pot standing at `base`: belly, shoulder, neck and a rolled lip (LatheGeometry), a damp foot, a paler lip */
function clayPot(base: Vector3, h: number, r: number, tint: RGB, noise: Noise2D, seed: number): BufferGeometry {
  const prof: [number, number][] = [
    [0.001, 0],
    [0.62, 0],
    [0.7, 0.04],
    [0.95, 0.3],
    [1.0, 0.48],
    [0.9, 0.7],
    [0.66, 0.84],
    [0.6, 0.9],
    [0.7, 0.96],
    [0.72, 1.0],
    [0.62, 1.0],
    [0.55, 0.92],
    [0.52, 0.86],
  ];
  const pts = prof.map(([x, y]) => new Vector2(x * r, y * h));
  const g = new LatheGeometry(pts, 16);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const v = y / h;
    const a = Math.atan2(z, x);
    const damp = lerp(0.62, 1, smoothstep(0, 0.35, v));
    const lip = v > 0.9 ? 1.12 : 1;
    const mottle = 0.9 + 0.2 * noise.noise(a * 1.5 + seed, v * 3 + seed);
    const k = damp * lip * mottle;
    col[i * 3] = tint[0] * k;
    col[i * 3 + 1] = tint[1] * k;
    col[i * 3 + 2] = tint[2] * k;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.translate(base.x, base.y - 0.01, base.z);
  return g;
}

/** a woven basket at `base`: slightly flared, an over-under weave in the tone, a rolled rim (rope material) */
function basket(base: Vector3, h: number, r: number, tint: RGB, seed: number): BufferGeometry {
  const prof: [number, number][] = [
    [0.001, 0],
    [0.8, 0],
    [0.9, 0.08],
    [0.98, 0.5],
    [1.04, 0.94],
    [1.06, 1.0],
    [0.98, 1.0],
    [0.95, 0.9],
    [0.86, 0.4],
    [0.001, 0.06],
  ];
  const g = new LatheGeometry(
    prof.map(([x, y]) => new Vector2(x * r, y * h)),
    22,
  );
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const row = Math.floor((y / h) * 9 + seed);
    const weave = Math.sin(a * 11 + (row % 2) * Math.PI) > 0 ? 1.08 : 0.84;
    const k = weave * (0.75 + 0.25 * smoothstep(0, 0.3, y / h));
    col[i * 3] = tint[0] * k;
    col[i * 3 + 1] = tint[1] * k;
    col[i * 3 + 2] = tint[2] * k;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const rim = new TorusGeometry(r * 1.03, 0.014, 5, 22);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, h, 0);
  setColorAttribute(rim, scaleRGB(tint, 0.9));
  const out = merge([g, rim]);
  out.translate(base.x, base.y - 0.005, base.z);
  return out;
}

/** a cloth pegged on the line from p0 to p1 (the line's sag in their heights), `drop` m long, a soft billow and folds */
function cloth(p0: Vector3, p1: Vector3, drop: number, tint: RGB, noise: Noise2D, seed: number): BufferGeometry {
  const d = p1.clone().sub(p0).setY(0).normalize();
  const nrm = new Vector3(-d.z, 0, d.x);
  return gridSurface(
    (u, v, out) => {
      const top = p0.clone().lerp(p1, u);
      const billow = 0.035 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.8) + 0.012 * noise.noise(u * 4 + seed, v * 3);
      const hem = drop * (1 - 0.05 * Math.sin(u * TAU * 1.3 + seed));
      out.position.copy(top).addScaledVector(nrm, billow).setY(top.y - 0.01 - v * hem);
      out.uv = [u, v];
      const fold = 0.84 + 0.16 * Math.sin(u * 19 + seed + v * 2);
      const k = fold * (0.9 + 0.1 * (1 - v));
      out.color = [tint[0] * k, tint[1] * k, tint[2] * k];
    },
    { cols: 9, rows: 6 },
  );
}

// ---------------------------------------------------------------------------------------------

export function buildExpansionNorth(ctx: WorldContext, mats: StructureMaterials, rng: Rng, rope: Material, sharedHouseMats: HouseSharedMaterials): GroveBuild {
  const group = new Group();
  group.name = 'structures-grove';
  const T = ctx.terrain;
  const seed = `${ctx.config.seed}/structures/grove`;
  const noise = new Noise2D(`${seed}/wood`);
  const barkN = new Noise2D(`${seed}/bark`);
  const lanterns: LanternRig[] = [];
  const bases: P3[] = [];
  const owned: { dispose(): void }[] = [];
  const walkSurfaces: WalkSurface[] = [];
  const walkSpans: WalkSpan[] = [];
  const walkEdges: WalkEdge[] = [];
  const pods: Vector3[] = [];
  /** mats.wood, SOLID for the play camera: veranda boards, gangway treads, joists, the nest's deck */
  const deckParts: BufferGeometry[] = [];
  /** mats.wood, SLIM: posts, rails, rungs, ladders, pegs, cleats */
  const railParts: BufferGeometry[] = [];
  /** mats.bark, SOLID: the stump, the column */
  const columnParts: BufferGeometry[] = [];
  /** mats.bark, SLIM: stilts, the ring beam, braces, the trestle, limbs, firewood */
  const frameParts: BufferGeometry[] = [];
  const ropeParts: BufferGeometry[] = [];
  const endParts: BufferGeometry[] = [];
  const stoneParts: BufferGeometry[] = [];
  const basketParts: BufferGeometry[] = [];
  const clothParts: BufferGeometry[] = [];
  const hangers: BufferGeometry[] = [];
  const tuftSpecs: MossTuftSpec[] = [];
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${seed}/foliage`);
  /** round props standing on walk surfaces or paths: each becomes a one-point walk edge */
  const blockers: { id: string; x: number; z: number; r: number }[] = [];
  /** ground footprints that are not walk blockers (out of reach, or decorative) */
  const footprints: { x: number; z: number; r: number }[] = [];
  const ropeTint = (r: Rng): RGB => scaleRGB(ROPE_TINT, 0.84 + r() * 0.26);
  const groundAt = (p: Vector3) => p.clone().setY(T.height(p.x, p.z));

  // ================= the trunk house =================
  const house = buildHouse(N.house, ctx, mats, rng.fork('house'), sharedHouseMats);
  for (const l of house.lights) l.removeFromParent();
  group.add(house.group);
  lanterns.push(...house.lanterns);
  for (const b of house.bases) bases.push(b);
  owned.push(...house.materials);
  for (const l of house.lanterns) pods.push(l.pod.clone());

  // ================= the two huts (one distant-house pass: one glow mesh, one soffit) =================
  const hutCtx: WorldContext = { ...ctx, shared: { ...ctx.shared, trunkSeats: [] } };
  const huts = buildDistantHouses(hutCtx, mats, rng.fork('huts'), GROVE_HUTS);
  for (const m of [...huts.group.children]) group.add(m);
  group.add(huts.glow);
  if (huts.soffit) group.add(huts.soffit);
  lanterns.push(...huts.lanterns);
  for (const a of huts.audit) for (const p of a.pods) pods.push(new Vector3(p[0], p[1], p[2]));
  for (const a of huts.audit) {
    const ch = a.character;
    if (ch?.ladder) footprints.push({ x: ch.ladder.foot[0], z: ch.ladder.foot[2], r: 0.45 });
    if (ch?.hoist && ch.hoist.basket[1] - T.height(ch.hoist.basket[0], ch.hoist.basket[2]) < 0.6) footprints.push({ x: ch.hoist.basket[0], z: ch.hoist.basket[2], r: 0.35 });
  }
  const stiltWalk = huts.walk.find((w) => w.id === 'grove-stilt')!;
  const hutWalk = huts.walk.find((w) => w.id === 'grove-tree-hut')!;
  // The doors are shut: the wall ring has no gap (the play camera never enters a room). Its outer
  // edge clears the wall's widest bulge: ±0.2 m round the eave's radius let Link's shoulder 0.16 m
  // into the stilt house's wall where the wobble swells, and trail the play camera through it.
  const shut = (w: WalkSurface, radius: number): WalkSurface['wall'] => {
    const inner = w.wall.r - w.wall.half;
    const outer = radius * WALL_MAX_FACTOR + WALL_CLEAR;
    return { r: (inner + outer) / 2, half: (outer - inner) / 2, gap: [w.wall.gap[0], w.wall.gap[0]] };
  };
  walkSurfaces.push({ id: 'grove-stilt', disc: { ...stiltWalk.disc, r: VERANDA_R }, deck: stiltWalk.deck, wall: shut(stiltWalk, SH.radius) });
  walkSurfaces.push({ id: 'grove-tree-hut', disc: hutWalk.disc, deck: hutWalk.deck, wall: shut(hutWalk, TH.radius) });
  // worn thresholds: a sill plank across each hut's door on the platform, dished and trodden pale
  for (const a of huts.audit) {
    const def = GROVE_HUTS.find((d) => d.id === a.id);
    if (!def?.doorSize) continue;
    const out = new Vector3(a.door[0] - a.centre[0], 0, a.door[2] - a.centre[2]);
    const rDoor = out.length();
    out.divideScalar(rDoor);
    const across = new Vector3(-out.z, 0, out.x);
    const half = def.doorSize[0] / 2 + 0.04;
    const c = new Vector3(a.centre[0], a.floorY + 0.045, a.centre[2]).addScaledVector(out, rDoor + 0.05);
    deckParts.push(board(c.clone().addScaledVector(across, -half), c.clone().addScaledVector(across, half), out, 0.16, 0.05, trodden(PLANK, 1), 5, noise, 310 + a.floorY, 0.01));
  }

  // ================= the stilt house: stump, stilts, ring beam, veranda, railing, ladder =================
  const sr = rng.fork('stilt-frame');
  const sc = new Vector3(SH.host[0], SH.floorY, SH.host[1]);
  const fy = SH.floorY;
  const platR = SH.radius + 0.22;
  const vR = VERANDA_R;
  const railR = vR - 0.07;
  const doorDir = az(SH.doorAbsDeg);
  const aDoor = angleOf(doorDir);
  const wDirS = new Vector3(RW.stilt[0] - sc.x, 0, RW.stilt[2] - sc.z).normalize();
  const aWalkS = angleOf(wDirS);
  const aLadder = angleOf(az(SH.ladderAbsDeg));
  const gapGang = (N.gangway.halfWidth + 0.06) / railR;
  const gapWalk = 0.5 / railR;
  const gapLadder = 0.34 / railR;
  const stumpGround = T.height(sc.x, sc.z);
  let stiltTops: Vector3[] = [];
  {
    // the cut stump: flared into five root lobes at the ground, bark ridges, its top under the platform's joists
    const y0 = stumpGround - 0.4;
    const y1 = fy - 0.26;
    const phase = sr.range(0, TAU);
    columnParts.push(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          const y = lerp(y0, y1, v);
          const hAbove = y - stumpGround;
          const r0 = STILT_STUMP.top + (STILT_STUMP.foot - STILT_STUMP.top) * (1 - smoothstep(0, 1.5, hAbove));
          const lobes = 0.3 * Math.max(0, Math.cos(5 * a + phase)) ** 3 * (1 - smoothstep(-0.1, 0.9, hAbove));
          const ridge = 0.035 * (barkN.ridged(a * 2.2 + phase, y * 0.9, 2) - 0.5) + 0.012 * Math.sin(a * 23 + y * 3);
          const r = (r0 + lobes) * (1 + ridge);
          out.position.set(sc.x + Math.cos(a) * r, y, sc.z + Math.sin(a) * r);
          out.uv = [(a * r0) / 1.6, y / 1.6];
          const shade = (0.62 + 0.3 * barkN.ridged(a * 2.2 + phase, y * 0.9, 2)) * lerp(0.7, 1, smoothstep(-0.2, 1.2, hAbove)) * (0.85 + 0.15 * Math.cos(a - 2.4));
          out.color = [shade, shade * 0.95, shade * 0.87];
        },
        { cols: 30, rows: 18, closedU: true },
      ),
    );
    bases.push([sc.x, stumpGround, sc.z]);
    tuftSpecs.push(...footMoss(ctx, new Vector3(sc.x, stumpGround, sc.z), sr.fork('stump-moss'), { postRadius: STILT_STUMP.foot + 0.1, count: 40, size: [0.03, 0.07], color: MOSS, favour: [-0.4, -0.9] }));

    // the four stilts on stone pads, raked in a little, each strutted to the stump and lashed
    SH.stiltAbsDeg.forEach((deg, i) => {
      const d = az(deg);
      const fx = sc.x + d.x * STILT_R.foot;
      const fz = sc.z + d.z * STILT_R.foot;
      const gy = T.height(fx, fz);
      const foot = new Vector3(fx, gy, fz);
      const top = sc.clone().addScaledVector(d, STILT_R.top).setY(fy - 0.34);
      const len = foot.distanceTo(top);
      const below = foot.clone().lerp(top, -0.28 / len);
      const mid = foot.clone().lerp(top, 0.5).add(new Vector3(sr.range(-0.03, 0.03), 0, sr.range(-0.03, 0.03)));
      const curve = new CatmullRomCurve3([below, foot, mid, top]);
      const radius = (t: number) => (0.13 - 0.025 * t) * (1 + 0.05 * Math.sin(t * 9 + i));
      frameParts.push(logTube(curve, radius, barkN, 11 + i * 3.3, 0.78, 14, 12));
      frameParts.push(...[checkedCap(endFrame(curve, 14), sr.fork(`stilt-cap/${i}`), noise, { radius: radius(1), segments: 12, color: [0.5, 0.44, 0.36], checks: 2, depth: [0.008, 0.016], dome: 0.004, uvMetres: 0.8 })].map((g) => g));
      stoneParts.push(padStone(new Vector3(fx, gy - 0.03, fz), 0.3, 0.11, 0.26, sr.range(0, TAU), noise, i * 7.7, 0.7));
      bases.push([fx, gy, fz]);
      stiltTops.push(top);
      tuftSpecs.push(...footMoss(ctx, foot, sr.fork(`stilt-moss/${i}`), { postRadius: 0.2, count: 14, size: [0.02, 0.05], color: MOSS }));
      // the strut from low on the stilt up to the stump
      const s0 = foot.clone().lerp(top, 0.3);
      const s1 = sc.clone().addScaledVector(d, STILT_STUMP.top - 0.06).setY(fy - 1.05);
      frameParts.push(logTube(new LineCurve3(s0, s1), (t) => 0.07 - 0.01 * t, barkN, 31 + i * 2.1, 0.74, 4, 8));
      const axis = top.clone().sub(foot).normalize();
      ropeParts.push(lashing((s) => s0.clone().addScaledVector(axis, s), 0.14, 2.5, 0.03, 0.012, ropeTint(sr), noise, i * 2.3 + 1, sr.range(0, TAU), axis));
      ropeParts.push(lashing((s) => top.clone().addScaledVector(axis, s - 0.12), 0.13, 2, 0.03, 0.012, ropeTint(sr), noise, i * 3.1 + 5, sr.range(0, TAU), axis));
      // ivy up two of them
      if (i % 2 === 0) {
        const pts: Vector3[] = [];
        const nrms: Vector3[] = [];
        const a0 = sr.range(0, TAU);
        for (let k = 0; k <= 10; k++) {
          const f = k / 10;
          const c = foot.clone().lerp(top, f * 0.8);
          const ang = a0 + f * 1.6;
          const side = new Vector3(Math.cos(ang), 0, Math.sin(ang));
          pts.push(c.clone().addScaledVector(side, radius(f * 0.8) + 0.012));
          nrms.push(side);
        }
        foliage.addSurfaceVine(pts, nrms, { leafSize: 0.07, thickness: 0.01 });
      }
    });

    // the ring beam the veranda's outer joists rest on
    const ringPts: Vector3[] = [];
    const rp = sr.range(0, TAU);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU;
      ringPts.push(sc.clone().addScaledVector(dirAt(a), STILT_R.top + 0.012 * Math.sin(a * 3 + rp)).setY(fy - 0.24 + 0.008 * Math.sin(a * 2 + rp)));
    }
    frameParts.push(logTube(new CatmullRomCurve3(ringPts, true, 'catmullrom', 0.5), () => 0.1, barkN, 51, 0.74, 96, 8));

    // the veranda's joists (radial, from the platform's rim band to the fascia) and the fascia band
    const jp = sr.range(0, TAU);
    for (let j = 0; j < 16; j++) {
      const a = jp + (j / 16) * TAU;
      const d = dirAt(a);
      deckParts.push(bar(sc.clone().addScaledVector(d, platR - 0.12).setY(fy - 0.1), sc.clone().addScaledVector(d, vR - 0.04).setY(fy - 0.1), 0.07, PLANK_DARK, 0.12));
    }
    deckParts.push(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          out.position.set(sc.x + Math.cos(a) * vR, lerp(fy - 0.15, fy + 0.012, v), sc.z + Math.sin(a) * vR);
          out.uv = [(a * vR) / 1.6, v * 0.2];
          out.color = scaleRGB(PLANK, 0.78 + 0.08 * Math.sin(a * 13 + jp));
        },
        { cols: 64, rows: 2, closedU: true },
      ),
    );
  }

  // the veranda's boards: 64 wedges from the platform's rim to the fascia; the few before the door
  // trodden pale, and one past the work corner replaced in fresh wood where the old one gave way
  const nBoards = 64;
  const patchedBoard = Math.round(((((aDoor + PATCH_FROM_DOOR) / TAU) % 1) + 1) % 1 * nBoards) % nBoards;
  {
    const br = sr.fork('boards');
    for (let k = 0; k < nBoards; k++) {
      const a0 = ((k + 0.04) / nBoards) * TAU;
      const a1 = ((k + 0.96) / nBoards) * TAU;
      const tone = br.range(0.82, 1.14);
      const age = br() < 0.14 ? br.range(0.55, 0.8) : 1;
      let tint: RGB = [PLANK[0] * tone * lerp(1.05, 1, age), PLANK[1] * tone, PLANK[2] * tone * lerp(0.85, 1, age)];
      const offDoor = Math.abs(Math.atan2(Math.sin((a0 + a1) / 2 - aDoor), Math.cos((a0 + a1) / 2 - aDoor)));
      if (k === patchedBoard) tint = scaleRGB(FRESH_PLANK, 0.94 + 0.12 * (tone - 0.82) / 0.32);
      else if (offDoor < TRODDEN_HALF) tint = trodden(tint, 1 - offDoor / TRODDEN_HALF);
      deckParts.push(wedgeBoard(sc, platR - 0.03, vR + 0.015, a0, a1, fy + 0.016, 0.05, tint, Math.floor(br() * 9), noise, k * 1.37 + 0.5));
    }
  }

  // ---- railing (posts, bent-pole rail, rope midrail) round an arc set: shared by the veranda and the nest ----
  /** the arcs [a0, a1] (a1 > a0) of a circle left by removing the angular gaps [centre, half] */
  const arcsBetween = (gaps: [number, number][]): [number, number][] => {
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
    return merged.map((g, i) => [g[1], i + 1 < merged.length ? merged[i + 1][0] : merged[0][0] + TAU] as [number, number]);
  };
  let railingPosts = 0;
  const railing = (c: Vector3, r: number, y: number, arcs: [number, number][], h: number, rr: Rng, spacing = 0.72, postR = 0.036) => {
    const tops: Vector3[][] = [];
    for (const [a0, a1] of arcs) {
      if (a1 - a0 < 0.3 / r) continue;
      const spans = Math.max(1, Math.round(((a1 - a0) * r) / spacing));
      const row: Vector3[] = [];
      for (let k = 0; k <= spans; k++) {
        const a = lerp(a0, a1, k / spans);
        const base = c.clone().addScaledVector(dirAt(a), r).setY(y);
        const top = base.clone().setY(y + h + 0.04 + rr.range(-0.02, 0.02));
        railParts.push(rod(base.clone().setY(y - 0.1), top, postR, scaleRGB(PLANK_DARK, rr.range(0.9, 1.2)), 7, postR * 0.85));
        row.push(top);
        railingPosts++;
      }
      const n = Math.max(3, Math.ceil(((a1 - a0) * r) / 0.25));
      const wob = rr.range(0, TAU);
      const pts: Vector3[] = [];
      for (let k = 0; k <= n; k++) {
        const a = lerp(a0, a1, k / n);
        pts.push(c.clone().addScaledVector(dirAt(a), r + 0.012 * Math.sin(k * 1.7 + wob)).setY(y + h + 0.012 * Math.sin(k * 2.3 + wob)));
      }
      const tone = scaleRGB(PLANK, rr.range(0.95, 1.12));
      railParts.push(
        sweepTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), {
          radius: (t) => 0.03 * (1 - 0.12 * t),
          tubularSegments: n * 2,
          radialSegments: 7,
          uvMetres: 1.6,
          color: (_t, _a, up) => scaleRGB(tone, 0.85 + 0.3 * Math.max(0, up)),
          capStart: true,
          capEnd: true,
        }),
      );
      for (let k = 0; k + 1 < row.length; k++) {
        const a = row[k].clone().setY(y + h * 0.48);
        const b = row[k + 1].clone().setY(y + h * 0.48);
        const m = a.clone().lerp(b, 0.5);
        m.y -= 0.035;
        ropeParts.push(ropeTube(new CatmullRomCurve3([a, m, b]), 0.011, rr() * 10, ropeTint(rr), noise, k * 1.3));
      }
      tops.push(row);
    }
    return tops;
  };
  const verandaArcs = arcsBetween([
    [aDoor, gapGang],
    [aWalkS, gapWalk],
    [aLadder, gapLadder],
  ]);
  railing(sc, railR, fy + 0.016, verandaArcs, RAIL_H, sr.fork('railing'));
  // a vine or two hanging off the veranda's rim
  {
    const vr = sr.fork('rim-vines');
    for (let k = 0; k < 7; k++) {
      const a = vr.range(0, TAU);
      if (Math.abs(Math.atan2(Math.sin(a - aDoor), Math.cos(a - aDoor))) < 0.4) continue;
      foliage.addHangingVine(sc.clone().addScaledVector(dirAt(a), vR + 0.02).setY(fy - 0.12), vr.range(0.4, 1.3), { leafSize: 0.065, thickness: 0.007, amount: 0.12 });
    }
  }

  // the south ladder: two poles from the slope up past the veranda's rim, a rung every 0.3 m (decorative:
  // the veranda's railing has a gap there but the walk edge runs on across it)
  {
    const lr = sr.fork('ladder');
    const out = dirAt(aLadder);
    const side = new Vector3(-out.z, 0, out.x);
    const topC = sc.clone().addScaledVector(out, vR + 0.06).setY(fy + 0.9);
    const footC0 = sc.clone().addScaledVector(out, vR + 1.05);
    const footC = groundAt(footC0);
    const rungs: Vector3[] = [];
    for (const s of [-1, 1]) {
      const a = footC.clone().addScaledVector(side, s * 0.24).setY(footC.y - 0.1);
      const b = topC.clone().addScaledVector(side, s * 0.22);
      railParts.push(rod(a, b, 0.042, scaleRGB(PLANK, lr.range(0.85, 1.0)), 7, 0.036));
      ropeParts.push(lashing((q) => a.clone().lerp(b, clamp(0.78 + q / a.distanceTo(b), 0, 1)), 0.055, 2, 0.028, 0.01, ropeTint(lr), noise, s * 4.1 + 2, lr.range(0, TAU), b.clone().sub(a)));
      tuftSpecs.push(...footMoss(ctx, groundAt(a), lr.fork(`moss/${s}`), { postRadius: 0.05, count: 6, size: [0.014, 0.03], color: MOSS }));
    }
    const lenL = footC.distanceTo(topC);
    for (let y = 0.32; y < lenL - 0.95; y += 0.3) {
      const f = y / lenL;
      const c = footC.clone().lerp(topC, f);
      rungs.push(c);
      railParts.push(rod(c.clone().addScaledVector(side, -0.26), c.clone().addScaledVector(side, 0.26), 0.02, scaleRGB(PLANK, lr.range(0.85, 1.15) * (y < 1.3 ? 1.1 : 1)), 6));
    }
    bases.push(p3(footC));
    footprints.push({ x: footC.x, z: footC.z, r: 0.45 });
  }

  // ================= the gangway: cleated treads on two stringers, a trestle, a sill, hand rails =================
  const gr = rng.fork('gangway');
  const gFoot = new Vector3(GW.foot[0], GW.foot[1], GW.foot[2]);
  const gHead = new Vector3(GW.head[0], GW.head[1], GW.head[2]);
  const dH = new Vector3(GW.dir[0], 0, GW.dir[1]).normalize();
  const gSide = new Vector3(-dH.z, 0, dH.x);
  const yFoot = N.shelf.y + 0.1;
  const yHead = fy + 0.016;
  const gTop = (s: number) => new Vector3(lerp(gFoot.x, gHead.x, s), lerp(yFoot, yHead, s), lerp(gFoot.z, gHead.z, s));
  const gLen = gTop(0).distanceTo(gTop(1));
  const gAlong = gTop(1).sub(gTop(0)).normalize();
  const gUp = new Vector3().crossVectors(gSide, gAlong).normalize();
  if (gUp.y < 0) gUp.negate();
  const slopeDeg = Math.atan2(yHead - yFoot, gFoot.distanceTo(gHead.clone().setY(gFoot.y))) / DEG;
  let treads = 0;
  let cleats = 0;
  const trestleFeet: Vector3[] = [];
  {
    // treads: across the stringers, laid on the slope
    let d = 0.03;
    while (d < gLen - 0.12) {
      const w = gr.range(0.18, 0.23);
      const s = (d + w / 2) / gLen;
      const c = gTop(s);
      const jit = gr.range(-0.012, 0.012);
      const tone = gr.range(0.82, 1.15);
      deckParts.push(board(c.clone().addScaledVector(gSide, -0.405 + jit), c.clone().addScaledVector(gSide, 0.405 + jit), gAlong, w, 0.045, scaleRGB(PLANK, tone), Math.floor(gr() * 9), noise, treads * 2.3 + 7, 0.004));
      treads++;
      d += w + gr.range(0.012, 0.022);
    }
    // cleats every `cleat` m of run: battens across the treads for the climb; one is lost, its two
    // pegs left standing in the tread
    const run = gFoot.distanceTo(gHead.clone().setY(gFoot.y));
    let cleatSlot = 0;
    for (let x = N.gangway.cleat * 0.6; x < run - 0.15; x += N.gangway.cleat) {
      const s = x / run;
      const c = gTop(s).addScaledVector(gUp, 0.024);
      const tint = scaleRGB(PLANK_DARK, gr.range(1.1, 1.4));
      if (cleatSlot++ === LOST_CLEAT) {
        for (const e of [-0.26, 0.26]) {
          const peg = gTop(s).addScaledVector(gSide, e);
          railParts.push(rod(peg.clone().addScaledVector(gUp, -0.02), peg.clone().addScaledVector(gUp, 0.014), 0.009, scaleRGB(PLANK_DARK, 0.85), 6));
        }
        continue;
      }
      railParts.push(board(c.clone().addScaledVector(gSide, -0.34), c.clone().addScaledVector(gSide, 0.34), gAlong, 0.04, 0.026, tint, 4, noise, cleats * 3.1 + 1));
      cleats++;
    }
    // the stringers under the treads' ends, running on 0.1 m under the veranda's boards to bear on the ring beam
    for (const s of [-1, 1]) {
      const a = gTop(-0.02).addScaledVector(gSide, s * 0.33).addScaledVector(gUp, -0.045);
      const b = gTop(1).addScaledVector(dH, 0.12).setY(yHead - 0.045).addScaledVector(gSide, s * 0.33);
      deckParts.push(board(a, b, gSide, 0.08, 0.16, scaleRGB(PLANK_DARK, 1.15), 2, noise, 90 + s));
    }
    // the sill log across the foot, half sunk in the pad
    const sillC = gTop(0).setY(N.shelf.y - 0.03);
    const sillCurve = new CatmullRomCurve3([sillC.clone().addScaledVector(gSide, -0.66), sillC.clone().add(new Vector3(0, 0.01, 0)), sillC.clone().addScaledVector(gSide, 0.66)]);
    frameParts.push(logTube(sillCurve, () => 0.12, barkN, 71, 0.72, 8, 10));
    for (const atStart of [true, false]) endParts.push(checkedCap(endFrame(sillCurve, 8, atStart), gr.fork(`sill-cap/${atStart}`), noise, { radius: 0.12, segments: 10, color: [0.6, 0.5, 0.4], checks: 3, depth: [0.01, 0.02], dome: -0.005, uvMetres: 0.9 }));
    bases.push(p3(groundAt(sillC)));

    // the trestle: two legs from the slope up past the deck as the mid posts, a ledger under the stringers, a brace
    const tTop = gTop(GANGWAY_TRESTLE_T);
    const feet = gangwayTrestleFeet();
    const legTops: Vector3[] = [];
    feet.forEach(([x, z], i) => {
      const gy = T.height(x, z);
      const foot = new Vector3(x, gy, z);
      const top = new Vector3(x, tTop.y + RAIL_H + 0.04, z);
      const curve = new CatmullRomCurve3([foot.clone().setY(gy - 0.3), foot, top]);
      frameParts.push(logTube(curve, (t) => 0.075 - 0.012 * t, barkN, 81 + i, 0.8, 8, 10));
      frameParts.push(checkedCap(endFrame(curve, 8), gr.fork(`leg-cap/${i}`), noise, { radius: 0.063, segments: 10, color: [0.55, 0.48, 0.4], checks: 2, depth: [0.006, 0.012], dome: 0.004, uvMetres: 0.8 }));
      stoneParts.push(padStone(new Vector3(x, gy - 0.02, z), 0.2, 0.08, 0.17, gr.range(0, TAU), noise, 40 + i, 0.72));
      bases.push([x, gy, z]);
      trestleFeet.push(foot);
      legTops.push(top);
      tuftSpecs.push(...footMoss(ctx, foot, gr.fork(`leg-moss/${i}`), { postRadius: 0.12, count: 10, size: [0.018, 0.04], color: MOSS }));
    });
    const ledgerY = tTop.y - 0.045 - 0.16 - 0.06;
    const lA = new Vector3(feet[0][0], ledgerY, feet[0][1]).addScaledVector(gSide, -0.12 * Math.sign(gSide.dot(new Vector3(feet[0][0] - tTop.x, 0, feet[0][1] - tTop.z))));
    const lB = new Vector3(feet[1][0], ledgerY, feet[1][1]).addScaledVector(gSide, -0.12 * Math.sign(gSide.dot(new Vector3(feet[1][0] - tTop.x, 0, feet[1][1] - tTop.z))));
    const ledgerA = lA.clone().addScaledVector(lA.clone().sub(lB).normalize(), 0.2);
    const ledgerB = lB.clone().addScaledVector(lB.clone().sub(lA).normalize(), 0.2);
    frameParts.push(logTube(new LineCurve3(ledgerA, ledgerB), () => 0.065, barkN, 91, 0.76, 4, 8));
    const braceA = trestleFeet[0].clone().setY(trestleFeet[0].y + 0.18);
    const braceB = new Vector3(feet[1][0], ledgerY - 0.02, feet[1][1]);
    frameParts.push(logTube(new LineCurve3(braceA, braceB), () => 0.05, barkN, 97, 0.74, 4, 8));
    for (const [i, foot] of trestleFeet.entries()) {
      const up = new Vector3(0, 1, 0);
      ropeParts.push(lashing((q) => new Vector3(foot.x, ledgerY + q, foot.z), 0.1, 2.5, 0.03, 0.012, ropeTint(gr), noise, 7 + i, gr.range(0, TAU), up));
    }

    // hand rails: the foot posts, the trestle legs, the veranda's gap-end posts; a bent pole and a rope midrail
    const headPost = (s: number) => sc.clone().addScaledVector(dirAt(aDoor - s * gapGang), railR).setY(fy + 0.016 + RAIL_H);
    for (const s of [-1, 1]) {
      const fb = gTop(0.04).addScaledVector(gSide, s * 0.47);
      const footTop = fb.clone().setY(fb.y + RAIL_H + 0.04);
      railParts.push(rod(fb.clone().setY(N.shelf.y - 0.25), footTop, 0.045, scaleRGB(PLANK_DARK, gr.range(1.0, 1.2)), 7, 0.038));
      tuftSpecs.push(...footMoss(ctx, groundAt(fb), gr.fork(`post-moss/${s}`), { postRadius: 0.05, count: 8, size: [0.015, 0.035], color: MOSS }));
      bases.push(p3(groundAt(fb)));
      const legTop = legTops[gSide.dot(new Vector3(feet[0][0] - tTop.x, 0, feet[0][1] - tTop.z)) * s > 0 ? 0 : 1];
      const head = headPost(s);
      const pts = [footTop.clone().setY(footTop.y - 0.04), legTop.clone().setY(legTop.y - 0.04), head];
      // the hand rails' tops rubbed pale by hands
      railParts.push(sweepTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.3), { radius: () => 0.03, tubularSegments: 24, radialSegments: 7, uvMetres: 1.6, capStart: true, capEnd: true, color: (_t, _a, up) => trodden(scaleRGB(PLANK, 0.9 + 0.25 * Math.max(0, up)), Math.max(0, up) ** 2) }));
      const mids = pts.map((p) => p.clone().setY(p.y - RAIL_H * 0.52));
      ropeParts.push(ropeTube(new CatmullRomCurve3([mids[0], mids[0].clone().lerp(mids[1], 0.5).add(new Vector3(0, -0.04, 0)), mids[1], mids[1].clone().lerp(mids[2], 0.5).add(new Vector3(0, -0.04, 0)), mids[2]]), 0.012, gr() * 10, ropeTint(gr), noise, s * 3.3));
    }
    // a pod on an arm off the east trestle leg's head, over the treads
    {
      const li = gSide.dot(new Vector3(feet[1][0] - tTop.x, 0, feet[1][1] - tTop.z)) > 0 ? 1 : 0;
      const legTop = legTops[li];
      const inward = new Vector3(tTop.x - legTop.x, 0, tTop.z - legTop.z).normalize();
      const armFrom = legTop.clone().add(new Vector3(0, -0.1, 0));
      const armTip = armFrom.clone().addScaledVector(inward, 0.32).addScaledVector(dH, -0.1).add(new Vector3(0, 0.1, 0));
      railParts.push(sweepTube(new CatmullRomCurve3([armFrom.clone().addScaledVector(inward, -0.04), armFrom.clone().lerp(armTip, 0.5).add(new Vector3(0, -0.01, 0)), armTip]), { radius: (t) => 0.035 - 0.012 * t, tubularSegments: 6, radialSegments: 8, uvMetres: 0.5, capEnd: true, color: (t) => scaleRGB(PLANK, 1 + 0.1 * t) }));
      const hook = armTip.clone().add(new Vector3(0, -0.035, 0));
      hangers.push(lanternHanger(hook, inward, 0.9));
      const rig = buildLantern(hook, 0.16, mats, gr.fork('pod'), 0.9, 'lime');
      group.add(rig.pivot);
      lanterns.push(rig);
      pods.push(rig.pod.clone());
      foliage.addLeafCluster(legTop.clone().add(new Vector3(0, 0.02, 0)), 0.12, 8, { size: 0.08, droop: 0.4, flatten: 0.5 });
    }
    // vines hanging under the treads
    for (let k = 0; k < 4; k++) {
      const s = gr.range(0.3, 0.9);
      foliage.addHangingVine(gTop(s).addScaledVector(gSide, gr.range(-0.3, 0.3)).setY(gTop(s).y - 0.25), gr.range(0.3, 0.9), { leafSize: 0.06, thickness: 0.007, amount: 0.12 });
    }
  }

  // ================= the rope walk: planks on two floor ropes between the walkway stubs, hand ropes from their end posts =================
  const rr = rng.fork('rope-walk');
  const rwA = new Vector3(RW.stilt[0], RW.stilt[1], RW.stilt[2]);
  const rwB = new Vector3(RW.hut[0], RW.hut[1], RW.hut[2]);
  const rDir = rwB.clone().sub(rwA).setY(0).normalize();
  const rSide = new Vector3(-rDir.z, 0, rDir.x);
  const rLen = Math.hypot(rwB.x - rwA.x, rwB.z - rwA.z);
  const rDeckY = (s: number) => lerp(rwA.y, rwB.y, s) - N.ropeWalk.sag * 4 * s * (1 - s);
  const rwAt = (s: number, c: number, dy = 0) => new Vector3(rwA.x + (rwB.x - rwA.x) * s + rSide.x * c, rDeckY(s) + dy, rwA.z + (rwB.z - rwA.z) * s + rSide.z * c);
  let ropePlanks = 0;
  {
    let d = 0.05;
    while (d < rLen - 0.12) {
      const w = rr.range(0.16, 0.2);
      const s = (d + w / 2) / rLen;
      const c = rwAt(s, rr.range(-0.02, 0.02));
      const yaw = rr.range(-0.05, 0.05);
      const across = rSide.clone().applyAxisAngle(new Vector3(0, 1, 0), yaw);
      const along = rDir.clone().applyAxisAngle(new Vector3(0, 1, 0), yaw);
      const slope = (rDeckY(Math.min(1, s + 0.02)) - rDeckY(Math.max(0, s - 0.02))) / (0.04 * rLen);
      along.y = slope;
      along.normalize();
      const tint = scaleRGB(PLANK, rr.range(0.8, 1.15));
      const idx = Math.floor(rr() * 9);
      const broken = ropePlanks === BROKEN_PLANK;
      const reach = broken ? 0.02 : 0.45;
      deckParts.push(board(c.clone().addScaledVector(across, -0.45), c.clone().addScaledVector(across, reach), along, w, 0.04, tint, idx, noise, 200 + ropePlanks * 1.9, 0.005));
      if (broken) {
        // the snapped end: splinters of the lost half standing out of the break
        const sp = rng.fork('rope-walk-break');
        const end = c.clone().addScaledVector(across, reach);
        for (let k = 0; k < 4; k++) {
          const at = end.clone().addScaledVector(along, lerp(-0.38, 0.38, (k + sp.range(0.2, 0.8)) / 4) * w).addScaledVector(across, -0.01);
          const tip = at.clone().addScaledVector(across, sp.range(0.03, 0.09)).addScaledVector(along, sp.range(-0.015, 0.015)).add(new Vector3(0, sp.range(-0.012, 0.004), 0));
          railParts.push(bar(at.clone().add(new Vector3(0, -0.02, 0)), tip.add(new Vector3(0, -0.02, 0)), sp.range(0.012, 0.022), scaleRGB(FRESH_PLANK, 0.9), 0.012));
        }
      }
      ropePlanks++;
      d += w + rr.range(0.035, 0.06);
    }
    // the floor ropes under the planks, tied round the stubs' end beams
    for (const s of [-1, 1]) {
      const c = s * 0.36;
      const pts: Vector3[] = [rwAt(-0.06, c, -0.14), rwAt(-0.02, c, -0.06)];
      for (let k = 1; k < 6; k++) pts.push(rwAt(k / 6, c, -0.05));
      pts.push(rwAt(1.02, c, -0.06), rwAt(1.06, c, -0.14));
      ropeParts.push(ropeTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.4), 0.02, rr() * 10, ropeTint(rr), noise, s * 5.3));
    }
    // the hand ropes: from the stilt stub's end posts to the hut stub's (distantHouse posts: ±0.42 off the deck's line, 1.05 m tall)
    for (const s of [-1, 1]) {
      const pa = rwA.clone().addScaledVector(rSide, s * 0.42).setY(rwA.y - 0.06 + 1.0);
      const pb = rwB.clone().addScaledVector(rSide, s * 0.42).setY(rwB.y - 0.06 + 1.0);
      const handPts = [pa, rwAt(0.33, s * 0.46, 0.94), rwAt(0.67, s * 0.46, 0.94), pb];
      const handRope = new CatmullRomCurve3(handPts, false, 'catmullrom', 0.5);
      ropeParts.push(ropeTube(handRope, 0.02, rr() * 10, ropeTint(rr), noise, s * 7.1));
      if (s > 0) {
        // a splice where the hand rope parted: a whipping of newer, paler cord round the join
        const at = handRope.getPointAt(0.56);
        const tan = handRope.getTangentAt(0.56);
        ropeParts.push(lashing((q) => at.clone().addScaledVector(tan, q), 0.029, 5, 0.018, 0.0075, scaleRGB(ROPE_TINT, 1.08), noise, 13.7, 0.4, tan));
      }
      for (const p of [pa, pb]) ropeParts.push(lashing((q) => p.clone().add(new Vector3(0, q, 0)), 0.06, 2.5, 0.028, 0.011, ropeTint(rr), noise, s * 2.1 + p.x, rr.range(0, TAU)));
      // the zig-zag net from the hand rope down to the floor rope
      let prev: Vector3 | null = null;
      let k = 0;
      for (let q = 0.1; q <= 0.9 + 1e-6; q += 0.1, k++) {
        const up = k % 2 === 0;
        const p = up ? rwAt(q, s * 0.455, 0.9 + 0.04 * (1 - 4 * (q - 0.5) ** 2) * 0) : rwAt(q, s * 0.37, -0.05);
        if (prev) ropeParts.push(cord(prev, p, 0.007, scaleRGB(ROPE_TINT, 0.78)));
        prev = p;
      }
      for (let v = 0; v < 2; v++) foliage.addHangingVine(rwAt(rr.range(0.2, 0.8), s * 0.4, -0.06), rr.range(0.4, 1.2), { leafSize: 0.06, thickness: 0.007, amount: 0.14 });
    }
  }

  // ================= the tree hut's column: flared bole, buttress roots, limbs into a crown, ivy =================
  const cr = rng.fork('column');
  const hc = new Vector3(TH.host[0], TH.floorY, TH.host[1]);
  const colGround = T.height(hc.x, hc.z);
  const colR = (h: number) => lerp(COL.baseRadius, COL.topRadius, clamp(h / COL.height, 0, 1));
  const colTop = new Vector3(hc.x, colGround + COL.height, hc.z);
  let limbs = 0;
  let roots = 0;
  const rootAngles: number[] = [];
  {
    const phase = cr.range(0, TAU);
    const y0 = colGround - 0.4;
    columnParts.push(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          const h = lerp(-0.4, COL.height, v);
          const flare = 1 + 0.45 * Math.pow(Math.max(0, 1 - h / 1.6), 2);
          const lobes = 0.22 * Math.max(0, Math.cos(5 * a + phase)) ** 3 * Math.max(0, 1 - h / 1.3);
          const ridges = 1 + 0.05 * Math.sin(a * 9 + phase + h * 0.35) + 0.035 * barkN.fbm(Math.cos(a) * 2 + h * 0.3, Math.sin(a) * 2 - h * 0.3, 2);
          const r0 = colR(Math.max(0, h));
          const r = (r0 * flare + lobes) * ridges;
          out.position.set(hc.x + Math.cos(a) * r, colGround + h, hc.z + Math.sin(a) * r);
          out.uv = [(a * r0) / 1.6, h / 1.6];
          const shade = (0.58 + 0.34 * (0.5 + 0.5 * Math.cos(a - 2.2))) * lerp(0.72, 1, smoothstep(0, 2.5, h)) * (0.9 + 0.1 * Math.sin(a * 9 + phase + h * 0.35));
          out.color = [shade, shade * 0.95, shade * 0.88];
        },
        { cols: 30, rows: 64, closedU: true },
      ),
    );
    void y0;
    bases.push([hc.x, colGround, hc.z]);
    tuftSpecs.push(...footMoss(ctx, new Vector3(hc.x, colGround, hc.z), cr.fork('foot-moss'), { postRadius: COL.baseRadius * 1.3, count: 46, size: [0.03, 0.07], color: MOSS, favour: [-0.5, -0.85] }));
    // buttress roots: five, from the bole's flare out along the ground
    for (let i = 0; i < 5; i++) {
      const a = phase + (i / 5) * TAU + cr.range(-0.25, 0.25);
      const d = dirAt(a);
      const reach = cr.range(1.5, 2.3);
      const pts: Vector3[] = [];
      for (let k = 0; k <= 5; k++) {
        const f = k / 5;
        const p = hc.clone().addScaledVector(d, lerp(COL.baseRadius * 0.9, COL.baseRadius + reach, f));
        const gy = T.height(p.x, p.z);
        p.y = lerp(colGround + 1.3, gy - 0.05, Math.pow(f, 0.55));
        pts.push(p);
      }
      const curve = new CatmullRomCurve3(pts);
      frameParts.push(logTube(curve, (t) => lerp(0.3, 0.05, Math.pow(t, 0.8)), barkN, 120 + i * 4.4, 0.7, 12, 10, true));
      rootAngles.push(a);
      roots++;
    }
    // limbs from the crown height, forking once, leaf clusters at their tips; a cluster crowns the top
    const nL = 5;
    for (let i = 0; i < nL; i++) {
      const a = phase * 1.3 + (i / nL) * TAU + cr.range(-0.3, 0.3);
      const y = COL.crownY + (i / nL) * 4.5 + cr.range(-0.4, 0.4);
      const h = y - colGround;
      const from = new Vector3(hc.x, y, hc.z).addScaledVector(dirAt(a), colR(h) * 0.5);
      const dir = new Vector3(Math.cos(a), cr.range(0.45, 0.8), Math.sin(a)).normalize();
      const len = cr.range(3.2, 4.6) * (1 - (i / nL) * 0.35);
      const mid = from.clone().addScaledVector(dir, len * 0.5).add(new Vector3(0, -0.15, 0));
      const tip = from.clone().addScaledVector(dir, len);
      const curve = new CatmullRomCurve3([from, mid, tip]);
      const r0 = colR(h) * 0.42;
      frameParts.push(logTube(curve, (t) => r0 * (1 - 0.72 * t), barkN, 160 + i * 3.1, 0.74, 12, 9, true));
      limbs++;
      foliage.addLeafCluster(tip, cr.range(0.9, 1.3), 46, { size: 0.24, droop: 0.35, amount: 0.12, tintSpread: 0.22, flatten: 0.55 });
      const forkP = curve.getPointAt(0.55);
      const fdir = dir.clone().applyAxisAngle(new Vector3(0, 1, 0), cr.range(0.6, 1.0) * (i % 2 ? 1 : -1)).add(new Vector3(0, 0.25, 0)).normalize();
      const flen = len * cr.range(0.45, 0.6);
      const ftip = forkP.clone().addScaledVector(fdir, flen);
      frameParts.push(logTube(new CatmullRomCurve3([forkP, forkP.clone().lerp(ftip, 0.5).add(new Vector3(0, -0.08, 0)), ftip]), (t) => r0 * 0.5 * (1 - 0.75 * t), barkN, 180 + i * 2.7, 0.76, 8, 7, true));
      limbs++;
      foliage.addLeafCluster(ftip, cr.range(0.7, 1.0), 30, { size: 0.22, droop: 0.35, amount: 0.12, tintSpread: 0.22, flatten: 0.55 });
      foliage.addLeafCluster(curve.getPointAt(0.8), 0.6, 16, { size: 0.2, droop: 0.4, amount: 0.1, flatten: 0.5 });
    }
    foliage.addLeafCluster(colTop.clone().add(new Vector3(0, 0.3, 0)), 1.5, 70, { size: 0.26, droop: 0.3, amount: 0.12, tintSpread: 0.22, flatten: 0.45 });
    foliage.addLeafCluster(colTop.clone().add(new Vector3(0.6, -1.2, -0.4)), 1.1, 40, { size: 0.24, droop: 0.3, amount: 0.12, flatten: 0.5 });
    // ivy climbing the bole (two strands, spiralling up to the hut's platform)
    for (let s = 0; s < 2; s++) {
      const pts: Vector3[] = [];
      const nrms: Vector3[] = [];
      const a0 = phase + s * Math.PI + 0.6;
      for (let k = 0; k <= 22; k++) {
        const f = k / 22;
        const h = lerp(0.1, TH.floorY - colGround - 0.5, f);
        const ang = a0 + f * 2.4;
        const d = dirAt(ang);
        pts.push(new Vector3(hc.x, colGround + h, hc.z).addScaledVector(d, colR(h) * (1 + 0.45 * Math.max(0, 1 - h / 1.6) ** 2) + 0.02));
        nrms.push(d);
      }
      foliage.addSurfaceVine(pts, nrms, { leafSize: 0.08, thickness: 0.012 });
    }
  }

  // ================= the lookout nest on the column over the hut's cap =================
  const nr = rng.fork('nest');
  const ny = N.nest.floorY;
  const nestR = N.nest.radius;
  const nestColR = colR(ny - colGround) + 0.01;
  let nestBoards = 0;
  let nestRungs = 0;
  {
    const nb = 28;
    for (let k = 0; k < nb; k++) {
      const a0 = ((k + 0.05) / nb) * TAU;
      const a1 = ((k + 0.95) / nb) * TAU;
      deckParts.push(wedgeBoard(hc.clone().setY(ny), nestColR - 0.02, nestR + 0.02, a0, a1, ny + 0.02, 0.045, scaleRGB(PLANK, nr.range(0.82, 1.12)), Math.floor(nr() * 9), noise, 300 + k));
      nestBoards++;
    }
    deckParts.push(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          out.position.set(hc.x + Math.cos(a) * nestR, lerp(ny - 0.12, ny + 0.02, v), hc.z + Math.sin(a) * nestR);
          out.uv = [(a * nestR) / 1.6, v * 0.2];
          out.color = scaleRGB(PLANK, 0.8);
        },
        { cols: 32, rows: 2, closedU: true },
      ),
    );
    deckParts.push(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          const r = lerp(nestColR, nestR, v);
          out.position.set(hc.x + Math.cos(a) * r, ny - 0.03, hc.z + Math.sin(a) * r);
          out.uv = [Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5];
          out.color = scaleRGB(PLANK_DARK, 1.2);
        },
        { cols: 32, rows: 2, closedU: true, flip: true },
      ),
    );
    // knee braces from the bole up to the deck's rim
    const kp = nr.range(0, TAU);
    for (let k = 0; k < 6; k++) {
      const a = kp + (k / 6) * TAU;
      const d = dirAt(a);
      const foot = hc.clone().addScaledVector(d, colR(ny - 1.15 - colGround) - 0.02).setY(ny - 1.15);
      const head = hc.clone().addScaledVector(d, nestR - 0.12).setY(ny - 0.06);
      frameParts.push(logTube(new LineCurve3(foot, head), () => 0.045, barkN, 330 + k, 0.76, 3, 7));
    }
    // the nest's railing (open toward the rungs), a pod on an arm toward the shelf
    const aRungs = angleOf(new Vector3(N.shelf.cx - hc.x, 0, N.shelf.cz - hc.z).normalize());
    const nestArcs = arcsBetween([[aRungs, 0.36 / (nestR - 0.06)]]);
    const tops = railing(hc.clone().setY(ny), nestR - 0.06, ny + 0.02, nestArcs, 0.78, nr.fork('rail'), 0.55, 0.03);
    // rungs pegged into the bole from the cap up to the nest's opening
    for (let y = TH.floorY + TH.wall + TH.capHeight - 0.2; y < ny - 0.1; y += 0.34) {
      const h = y - colGround;
      const d = dirAt(aRungs + (nestRungs % 2 ? 0.12 : -0.12));
      const c = hc.clone().addScaledVector(d, colR(h) + 0.1).setY(y);
      const t = new Vector3(-d.z, 0, d.x);
      railParts.push(rod(c.clone().addScaledVector(t, -0.2).addScaledVector(d, -0.1), c.clone().addScaledVector(t, 0.2).addScaledVector(d, -0.1), 0.022, scaleRGB(PLANK, nr.range(0.9, 1.15)), 6));
      railParts.push(rod(hc.clone().addScaledVector(d, colR(h) - 0.05).setY(y).addScaledVector(t, -0.16), c.clone().addScaledVector(t, -0.16), 0.02, PLANK_DARK, 5));
      railParts.push(rod(hc.clone().addScaledVector(d, colR(h) - 0.05).setY(y).addScaledVector(t, 0.16), c.clone().addScaledVector(t, 0.16), 0.02, PLANK_DARK, 5));
      nestRungs++;
    }
    // the pod: on an arm from the post nearest the shelf-facing side
    const flat = tops.flat();
    if (flat.length) {
      const toShelf = new Vector3(N.shelf.cx - hc.x, 0, N.shelf.cz - hc.z).normalize();
      let best = flat[0];
      let bestD = -Infinity;
      for (const p of flat) {
        const d = new Vector3(p.x - hc.x, 0, p.z - hc.z).normalize();
        const s = d.dot(toShelf.clone().applyAxisAngle(new Vector3(0, 1, 0), 0.9));
        if (s > bestD) {
          bestD = s;
          best = p;
        }
      }
      const out = new Vector3(best.x - hc.x, 0, best.z - hc.z).normalize();
      const armTip = best.clone().addScaledVector(out, 0.34).add(new Vector3(0, 0.08, 0));
      railParts.push(sweepTube(new CatmullRomCurve3([best.clone().add(new Vector3(0, -0.06, 0)), best.clone().lerp(armTip, 0.5).add(new Vector3(0, 0.02, 0)), armTip]), { radius: (t) => 0.03 - 0.01 * t, tubularSegments: 6, radialSegments: 7, uvMetres: 0.5, capEnd: true, color: () => PLANK }));
      const hook = armTip.clone().add(new Vector3(0, -0.03, 0));
      hangers.push(lanternHanger(hook, new Vector3(-out.z, 0, out.x), 0.9));
      const rig = buildLantern(hook, 0.2, mats, nr.fork('pod'), 0.95, 'orange');
      group.add(rig.pivot);
      lanterns.push(rig);
      pods.push(rig.pod.clone());
    }
    foliage.addHangingVine(hc.clone().addScaledVector(dirAt(kp + 1), nestR).setY(ny - 0.1), 0.9, { leafSize: 0.065, thickness: 0.008, amount: 0.12 });
    foliage.addHangingVine(hc.clone().addScaledVector(dirAt(kp + 3.2), nestR).setY(ny - 0.1), 1.4, { leafSize: 0.065, thickness: 0.008, amount: 0.12 });
  }

  // ================= lantern posts and the sign (their point lights are taken out) =================
  let postLights = 0;
  for (const p of N.lanternPosts) {
    const pb = buildLanternPost(p, ctx, mats, rng.fork(`post/${p.id}`), rope);
    for (const l of pb.lights) {
      l.removeFromParent();
      postLights++;
    }
    group.add(pb.group);
    lanterns.push(...pb.lanterns);
    for (const l of pb.lanterns) pods.push(l.pod.clone());
    bases.push(pb.base);
    footprints.push({ x: pb.base[0], z: pb.base[2], r: 0.35 });
  }
  const sign = buildSignpost(N.signpost, ctx, mats, rng.fork('sign'));
  group.add(sign.group);
  bases.push(sign.base);
  footprints.push({ x: sign.base[0], z: sign.base[2], r: 0.3 });

  // ================= signs of life =================
  const pr = rng.fork('props');
  let pots = 0;
  let baskets = 0;
  let woodLogs = 0;
  let cloths = 0;
  const TERRACOTTA: RGB[] = [
    [1.6, 0.86, 0.52],
    [1.45, 0.8, 0.52],
    [1.2, 0.95, 0.72],
  ];
  const potAt = (id: string, p: Vector3, h: number, r: number, plant: boolean) => {
    const g = groundAt(p);
    stoneParts.push(clayPot(g, h, r, TERRACOTTA[pots % TERRACOTTA.length], noise, 400 + pots * 3.7));
    if (plant) {
      const top = g.clone().setY(g.y + h * 0.95);
      foliage.addLeafCluster(top.clone().add(new Vector3(0, 0.1, 0)), r * 0.9, 14, { size: 0.08, droop: 0.2, amount: 0.06, flatten: 0.3 });
      for (let k = 0; k < 3; k++) foliage.addFlower(top.clone().add(new Vector3(pr.range(-0.5, 0.5) * r, 0.16, pr.range(-0.5, 0.5) * r)), new Vector3(0, 1, 0), 0.05, 0.03, 0.04);
    }
    blockers.push({ id, x: g.x, z: g.z, r: r + 0.05 });
    bases.push(p3(g));
    pots++;
  };
  const basketAt = (id: string, p: Vector3, h: number, r: number, fill: 'logs' | 'leaves' | 'empty') => {
    const g = groundAt(p);
    basketParts.push(basket(g, h, r, [1.05, 0.92, 0.66], pr() * 5));
    if (fill === 'logs') {
      for (let k = 0; k < 4; k++) {
        const a = pr.range(0, TAU);
        const c = g.clone().add(new Vector3(Math.cos(a) * r * 0.35, h * 0.9, Math.sin(a) * r * 0.35));
        const d = new Vector3(Math.cos(a + 1.3), pr.range(0.3, 0.7), Math.sin(a + 1.3)).normalize();
        const curve = new LineCurve3(c.clone().addScaledVector(d, -r * 0.8), c.clone().addScaledVector(d, r * 0.8));
        frameParts.push(logTube(curve, () => 0.035, barkN, 500 + k + baskets * 7, 0.8, 2, 7));
        for (const atStart of [true, false]) endParts.push(checkedCap(endFrame(curve, 2, atStart), pr.fork(`bl/${baskets}/${k}/${atStart}`), noise, { radius: 0.035, segments: 7, color: [0.66, 0.54, 0.4], checks: 1, depth: [0.003, 0.006], dome: 0, uvMetres: 0.6 }));
      }
    } else if (fill === 'leaves') {
      foliage.addLeafCluster(g.clone().setY(g.y + h + 0.03), r * 0.8, 12, { size: 0.07, droop: 0.1, amount: 0.04, flatten: 0.8, tint: [0.6, 0.7, 0.3] });
    }
    blockers.push({ id, x: g.x, z: g.z, r: r + 0.05 });
    bases.push(p3(g));
    baskets++;
  };
  /** a stack of split rounds, ends facing out along `face`, `rows` high, between two stakes */
  const woodpile = (id: string, centre: Vector3, face: Vector3, width: number, rows: number, depth: number, block = true) => {
    const side = new Vector3(-face.z, 0, face.x);
    const g = groundAt(centre);
    for (let row = 0; row < rows; row++) {
      const n = Math.max(1, Math.floor(width / 0.19) - (row % 2));
      for (let k = 0; k < n; k++) {
        const lr = pr.range(0.075, 0.1);
        const x = ((k + 0.5) / n - 0.5) * (width - 0.08) + (row % 2 ? 0.05 : 0);
        const c = g.clone().addScaledVector(side, x).add(new Vector3(0, 0.05 + lr + row * 0.17 + pr.range(-0.01, 0.01), 0));
        c.y = T.height(c.x, c.z) + 0.05 + lr + row * 0.17;
        const len = depth + pr.range(-0.06, 0.06);
        const push = pr.range(-0.05, 0.05);
        const a = c.clone().addScaledVector(face, -len / 2 + push);
        const b = c.clone().addScaledVector(face, len / 2 + push);
        const curve = new LineCurve3(a, b);
        frameParts.push(logTube(curve, () => lr, barkN, 600 + woodLogs * 1.3, pr.range(0.72, 0.9), 2, 8));
        for (const atStart of [true, false]) endParts.push(checkedCap(endFrame(curve, 2, atStart), pr.fork(`wp/${id}/${woodLogs}/${atStart}`), noise, { radius: lr, segments: 8, color: [0.7, 0.57, 0.42], checks: 2, depth: [0.004, 0.01], dome: 0.002, uvMetres: 0.6 }));
        woodLogs++;
      }
    }
    for (const s of [-1, 1]) {
      const st = g.clone().addScaledVector(side, s * (width / 2 + 0.06));
      const sg = T.height(st.x, st.z);
      railParts.push(rod(st.clone().setY(sg - 0.2), st.clone().setY(sg + rows * 0.17 + 0.2), 0.035, scaleRGB(PLANK_DARK, 1.1), 6, 0.028));
    }
    stoneParts.push(padStone(g.clone().setY(g.y - 0.06), width * 0.55, 0.08, depth * 0.6, Math.atan2(face.x, face.z), noise, 700 + woodLogs, 0.6));
    if (block) blockers.push({ id, x: g.x, z: g.z, r: Math.max(width, depth) * 0.6 });
    else footprints.push({ x: g.x, z: g.z, r: Math.max(width, depth) * 0.6 });
  };

  // the trunk house's yard: pots by the door, a basket of kindling, the woodpile, a chopping block, a bench
  const doorN = new Vector3(N.house.facing[0], 0, N.house.facing[1]).normalize();
  const doorT = new Vector3(-doorN.z, 0, doorN.x);
  const hp = new Vector3(N.house.position[0], N.shelf.y, N.house.position[2]);
  const doorP = hp.clone().addScaledVector(doorN, N.house.trunkRadius + 0.95);
  potAt('grove-house-pot-1', doorP.clone().addScaledVector(doorT, 1.15).addScaledVector(doorN, -0.15), 0.42, 0.2, true);
  potAt('grove-house-pot-2', doorP.clone().addScaledVector(doorT, 1.5).addScaledVector(doorN, -0.35), 0.3, 0.15, false);
  potAt('grove-house-pot-3', doorP.clone().addScaledVector(doorT, -1.25).addScaledVector(doorN, -0.2), 0.36, 0.18, true);
  basketAt('grove-house-basket', doorP.clone().addScaledVector(doorT, -1.62).addScaledVector(doorN, 0.05), 0.26, 0.2, 'logs');
  woodpile('grove-house-woodpile', hp.clone().addScaledVector(doorT, -(N.house.trunkRadius + 0.9)).addScaledVector(doorN, 0.6), doorT.clone().negate(), 1.3, 4, 0.5);
  {
    // chopping block with split pieces round it
    const cb = hp.clone().addScaledVector(doorN, N.house.trunkRadius + 2.2).addScaledVector(doorT, -2.4);
    const g = groundAt(cb);
    const curve = new LineCurve3(g.clone().setY(g.y - 0.08), g.clone().setY(g.y + 0.44));
    frameParts.push(logTube(curve, () => 0.26, barkN, 777, 0.74, 3, 14));
    endParts.push(checkedCap(endFrame(curve, 3), pr.fork('block-cap'), noise, { radius: 0.26, segments: 14, color: [0.72, 0.6, 0.45], checks: 4, depth: [0.008, 0.018], dome: 0.004, uvMetres: 0.7 }));
    for (let k = 0; k < 4; k++) {
      const a = pr.range(0, TAU);
      const c = g.clone().add(new Vector3(Math.cos(a) * pr.range(0.45, 0.8), 0, Math.sin(a) * pr.range(0.45, 0.8)));
      c.y = T.height(c.x, c.z) + 0.05;
      const d = new Vector3(Math.cos(a + pr.range(-1, 1)), 0.05, Math.sin(a + pr.range(-1, 1))).normalize();
      const lc = new LineCurve3(c.clone().addScaledVector(d, -0.2), c.clone().addScaledVector(d, 0.2));
      frameParts.push(logTube(lc, () => 0.05, barkN, 790 + k, 0.8, 2, 6));
      for (const atStart of [true, false]) endParts.push(checkedCap(endFrame(lc, 2, atStart), pr.fork(`chip/${k}/${atStart}`), noise, { radius: 0.05, segments: 6, color: [0.74, 0.6, 0.44], checks: 1, depth: [0.003, 0.006], dome: 0, uvMetres: 0.6 }));
    }
    blockers.push({ id: 'grove-chopping-block', x: g.x, z: g.z, r: 0.34 });
    bases.push(p3(g));
  }
  {
    // the bench: a thick plank on two log stools, against the trunk right of the door
    const bc = hp.clone().addScaledVector(doorN, N.house.trunkRadius + 0.75).addScaledVector(doorT, 2.1);
    const along = doorT.clone().applyAxisAngle(new Vector3(0, 1, 0), -0.35);
    const across = new Vector3(-along.z, 0, along.x);
    const legs: Vector3[] = [];
    for (const s of [-1, 1]) {
      const lp = groundAt(bc.clone().addScaledVector(along, s * 0.52));
      const curve = new LineCurve3(lp.clone().setY(lp.y - 0.06), lp.clone().setY(lp.y + 0.36));
      frameParts.push(logTube(curve, () => 0.11, barkN, 800 + s, 0.76, 2, 10));
      endParts.push(checkedCap(endFrame(curve, 2), pr.fork(`stool/${s}`), noise, { radius: 0.11, segments: 10, color: [0.66, 0.55, 0.42], checks: 2, depth: [0.004, 0.01], dome: 0, uvMetres: 0.6 }));
      legs.push(lp);
      bases.push(p3(lp));
    }
    const top = Math.max(legs[0].y, legs[1].y) + 0.43;
    const a = bc.clone().addScaledVector(along, -0.78).setY(top);
    const b = bc.clone().addScaledVector(along, 0.78).setY(top);
    deckParts.push(board(a, b, across, 0.3, 0.07, scaleRGB(PLANK, 1.1), 3, noise, 811, 0.006));
    blockers.push({ id: 'grove-bench-a', x: legs[0].x, z: legs[0].z, r: 0.35 }, { id: 'grove-bench-b', x: legs[1].x, z: legs[1].z, r: 0.35 });
  }
  {
    // the washing line: two forked poles across the yard's back, a sagging line, cloths pegged on it
    const wa = new Vector3(0.9, 0, -102.7);
    const wb = new Vector3(4.5, 0, -101.3);
    const poleTops: Vector3[] = [];
    for (const [i, w] of [wa, wb].entries()) {
      const g = groundAt(w);
      const top = g.clone().add(new Vector3(pr.range(-0.04, 0.04), 1.95, pr.range(-0.04, 0.04)));
      frameParts.push(logTube(new CatmullRomCurve3([g.clone().setY(g.y - 0.3), g, g.clone().lerp(top, 0.5), top]), (t) => 0.055 - 0.012 * t, barkN, 820 + i, 0.8, 8, 8));
      const alongL = wb.clone().sub(wa).setY(0).normalize();
      for (const s of [-1, 1]) {
        const prong = top.clone().addScaledVector(alongL.clone().applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 2), s * 0.12).add(new Vector3(0, 0.2, 0));
        frameParts.push(logTube(new LineCurve3(top.clone().add(new Vector3(0, -0.08, 0)), prong), (t) => 0.035 - 0.012 * t, barkN, 830 + i * 2 + s, 0.8, 2, 6, true));
      }
      tuftSpecs.push(...footMoss(ctx, g, pr.fork(`pole-moss/${i}`), { postRadius: 0.06, count: 8, size: [0.015, 0.035], color: MOSS }));
      poleTops.push(top.clone().add(new Vector3(0, 0.02, 0)));
      blockers.push({ id: `grove-washing-pole-${i}`, x: g.x, z: g.z, r: 0.14 });
      bases.push(p3(g));
    }
    const sag = 0.2;
    const lineAt = (u: number) => poleTops[0].clone().lerp(poleTops[1], u).add(new Vector3(0, -sag * 4 * u * (1 - u), 0));
    const linePts: Vector3[] = [];
    for (let k = 0; k <= 8; k++) linePts.push(lineAt(k / 8));
    ropeParts.push(ropeTube(new CatmullRomCurve3(linePts), 0.007, 3.3, ROPE_TINT, noise, 41));
    const CLOTHS: RGB[] = [
      [0.78, 0.72, 0.58],
      [0.36, 0.48, 0.24],
      [0.72, 0.52, 0.24],
      [0.56, 0.3, 0.2],
      [0.66, 0.66, 0.54],
    ];
    let u = 0.08;
    while (u < 0.9) {
      const w = pr.range(0.1, 0.17);
      if (u + w > 0.94) break;
      const tint = CLOTHS[cloths % CLOTHS.length];
      const p0 = lineAt(u);
      const p1 = lineAt(u + w);
      clothParts.push(cloth(p0, p1, pr.range(0.38, 0.68), tint, noise, 900 + cloths * 3.1));
      for (const p of [p0, p1]) railParts.push(rod(p.clone().add(new Vector3(0, 0.035, 0)), p.clone().add(new Vector3(0, -0.035, 0)), 0.008, [0.55, 0.45, 0.32], 5));
      cloths++;
      u += w + pr.range(0.03, 0.08);
    }
  }

  // the stilt house: pots and a herb basket in the veranda's east corner, a woodpile against the stump
  {
    const vp = (a: number, r: number) => sc.clone().addScaledVector(dirAt(a), r).setY(fy + 0.016);
    const onDeck = (id: string, a: number, r: number, h: number, pr0: number, plant: boolean) => {
      const g = vp(a, r);
      stoneParts.push(clayPot(g, h, pr0, TERRACOTTA[pots % TERRACOTTA.length], noise, 450 + pots * 3.7));
      if (plant) {
        const top = g.clone().setY(g.y + h * 0.95);
        foliage.addLeafCluster(top.clone().add(new Vector3(0, 0.1, 0)), pr0 * 0.9, 14, { size: 0.08, droop: 0.2, amount: 0.06, flatten: 0.3 });
        for (let k = 0; k < 3; k++) foliage.addFlower(top.clone().add(new Vector3(pr.range(-0.5, 0.5) * pr0, 0.16, pr.range(-0.5, 0.5) * pr0)), new Vector3(0, 1, 0), 0.05, 0.03, 0.04, [1, 0.85, 0.7]);
      }
      blockers.push({ id, x: g.x, z: g.z, r: pr0 + 0.05 });
      pots++;
    };
    onDeck('grove-stilt-pot-1', -0.55, railR - 0.24, 0.4, 0.19, true);
    onDeck('grove-stilt-pot-2', -0.33, railR - 0.2, 0.28, 0.14, false);
    const bp = vp(-0.1, railR - 0.26);
    basketParts.push(basket(bp, 0.24, 0.2, [1.05, 0.92, 0.66], 2.2));
    foliage.addLeafCluster(bp.clone().setY(bp.y + 0.26), 0.15, 12, { size: 0.07, droop: 0.1, amount: 0.04, flatten: 0.8, tint: [0.55, 0.68, 0.3] });
    blockers.push({ id: 'grove-stilt-basket', x: bp.x, z: bp.z, r: 0.25 });
    baskets++;
    // under the house (the slope under the floor is out of reach): the winter's wood against the stump
    const wp = sc.clone().addScaledVector(dirAt(angleOf(az(130))), STILT_STUMP.foot + 0.5);
    woodpile('grove-stilt-woodpile', wp, dirAt(angleOf(az(130))), 1.1, 5, 0.5, false);
  }
  // the tree hut: kindling against the column's foot in the roots' gap nearest its west face, a basket
  // by the ladder's stakes. A prop's blocker holds at every height (character/ground.ts), so the pile
  // keeps off the walkway stub's bearing and the rope ladder's.
  {
    const off = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const aStub = angleOf(new Vector3(RW.hut[0] - hc.x, 0, RW.hut[2] - hc.z));
    const aLadder = angleOf(az(TH.ladderAbsDeg));
    const gaps = rootAngles.map((a, i) => (a + rootAngles[(i + 1) % rootAngles.length] + (i + 1 === rootAngles.length ? TAU : 0)) / 2);
    const aPile = gaps.filter((a) => off(a, aStub) > 0.8 && off(a, aLadder) > 0.7).sort((p, q) => off(p, Math.PI) - off(q, Math.PI))[0] ?? aStub + Math.PI;
    const wp = hc.clone().addScaledVector(dirAt(aPile), COL.baseRadius + 0.95);
    woodpile('grove-hut-woodpile', wp, dirAt(aPile), 1.0, 3, 0.45);
    basketAt('grove-hut-basket', hc.clone().addScaledVector(az(TH.ladderAbsDeg + 22), TH.radius + 1.4), 0.3, 0.22, 'leaves');
  }

  // a sapling seeded in the stilt house's moss cap, rooted in its crown and leaning out toward the
  // open shelf (its leaves last: the foliage stream of everything above is unchanged)
  {
    const yr = rng.fork('stilt-sapling');
    const apexY = SH.floorY + SH.wall + SH.capHeight;
    const toShelf = new Vector3(N.shelf.cx - sc.x, 0, N.shelf.cz - sc.z).normalize();
    const base = sc.clone().addScaledVector(toShelf, -0.3).setY(apexY - 0.3);
    const tip = base.clone().addScaledVector(toShelf, 0.4).add(new Vector3(0, 1.5, 0));
    const mid = base.clone().lerp(tip, 0.5).add(new Vector3(yr.range(-0.08, 0.08), 0, yr.range(-0.08, 0.08)));
    const stem = new CatmullRomCurve3([base, mid, tip]);
    frameParts.push(logTube(stem, (t) => 0.045 - 0.028 * t, barkN, 131, 0.8, 8, 6, true));
    for (const [t, side, len] of [
      [0.55, 1, 0.45],
      [0.74, -1, 0.34],
    ] as const) {
      const p = stem.getPointAt(t);
      const out = new Vector3().crossVectors(stem.getTangentAt(t), new Vector3(0, 1, 0)).normalize().multiplyScalar(side);
      const end = p.clone().addScaledVector(out, len).add(new Vector3(0, len * 0.55, 0));
      frameParts.push(logTube(new LineCurve3(p, end), (u) => 0.018 - 0.01 * u, barkN, 137 + t, 0.8, 3, 5, true));
      foliage.addLeafCluster(end, 0.2, 14, { size: 0.09, droop: 0.3, flatten: 0.45 });
    }
    foliage.addLeafCluster(tip, 0.26, 18, { size: 0.1, droop: 0.25, flatten: 0.4 });
  }

  // ================= meshes =================
  const add = (geo: BufferGeometry, mat: Material, name: string, cast = true, receive = true) => {
    const m = new Mesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
    return m;
  };
  const builtGeos: BufferGeometry[] = [];
  const addParts = (parts: BufferGeometry[], mat: Material, name: string, cast = true) => {
    if (!parts.length) return;
    const g = merge(parts);
    builtGeos.push(g);
    add(g, mat, name, cast, true);
  };
  addParts(deckParts, mats.wood, 'grove-deck');
  addParts(railParts, mats.wood, 'grove-rails');
  addParts(columnParts, mats.bark, 'grove-column');
  addParts(frameParts, mats.bark, 'grove-frame');
  addParts(ropeParts, rope, 'grove-rope');
  addParts(endParts, mats.endGrain, 'grove-ends');
  addParts(stoneParts, mats.stone, 'grove-stone');
  addParts(basketParts, rope, 'grove-basket-rope');
  addParts(hangers, mats.woodDark, 'lantern-hanger');
  if (clothParts.length) {
    const clothMat = applyShadeFloor(new MeshStandardMaterial({ color: new Color(1, 1, 1), roughness: 0.95, vertexColors: true, side: DoubleSide }), CLOTH_FLOOR);
    owned.push(clothMat);
    addParts(clothParts, clothMat, 'grove-cloth');
  }
  const foliageMeshes = foliage.build(mats, 'grove');
  for (const m of foliageMeshes) group.add(m);
  const tufts = buildMossTufts(tuftSpecs, new Noise3D(rng.fork('moss-noise')), { topGain: 1.4, rimGain: 0.5, topTint: [1.0, 1.05, 0.8] });
  if (tufts.count > 0) add(tufts.geometry, mats.capMoss, 'grove-foot-moss', false, true);

  // ================= walk spans and edges =================
  const r4 = (v: number) => +v.toFixed(4);
  const pt = (p: Vector3): P3 => [r4(p.x), r4(p.y), r4(p.z)];
  {
    const lead = gFoot.clone().addScaledVector(dH, -0.35).setY(N.shelf.y + 0.03);
    const pts: P3[] = [pt(lead)];
    for (const s of [0, 0.2, 0.4, 0.6, 0.8, 1]) pts.push(pt(gTop(s).add(new Vector3(0, 0.012, 0))));
    walkSpans.push({ id: 'grove-gangway', pts, hw: 0.42 });
    const rpts: P3[] = [];
    for (let k = 0; k <= 6; k++) rpts.push(pt(rwAt(k / 6, 0, 0.004)));
    walkSpans.push({ id: 'grove-rope-walk', pts: rpts, hw: 0.42 });
  }
  const arcPts = (c: Vector3, r: number, a0: number, a1: number, y: number): P3[] => {
    const n = Math.max(2, Math.ceil(((a1 - a0) * r) / 0.3));
    const out: P3[] = [];
    for (let k = 0; k <= n; k++) out.push(pt(c.clone().addScaledVector(dirAt(lerp(a0, a1, k / n)), r).setY(y)));
    return out;
  };
  // the veranda's railing: everywhere but the gangway's head and the walkway (the ladder's gap is the railing's only)
  for (const [i, [a0, a1]] of arcsBetween([
    [aDoor, gapGang],
    [aWalkS, gapWalk],
  ]).entries())
    walkEdges.push({ id: `grove-veranda-rail-${i}`, pts: arcPts(sc, railR, a0, a1, fy + 0.016), hw: EDGE_HW });
  // the gangway's sides, joined to the veranda railing's gap ends
  for (const s of [-1, 1]) {
    const gapEnd = sc.clone().addScaledVector(dirAt(aDoor - s * gapGang), railR).setY(fy);
    walkEdges.push({ id: `grove-gangway-side-${s}`, pts: [pt(gTop(0).addScaledVector(gSide, s * 0.47)), pt(gTop(0.5).addScaledVector(gSide, s * 0.47)), pt(gTop(1).addScaledVector(gSide, s * 0.47)), pt(gapEnd)], hw: EDGE_HW });
  }
  // the walkways' and the rope walk's sides: veranda gap end → stilt stub → rope walk → hut stub → the hut railing's gap end
  const hutPlatR = TH.radius + 0.22;
  const hutRailR = hutPlatR - 0.07;
  const wDirH = new Vector3(RW.hut[0] - hc.x, 0, RW.hut[2] - hc.z).normalize();
  const aWalkH = angleOf(wDirH);
  const gapHut = (0.95 / 2 + 0.12) / hutRailR;
  for (const s of [-1, 1]) {
    const pts: P3[] = [
      pt(sc.clone().addScaledVector(dirAt(aWalkS + s * gapWalk), railR).setY(fy)),
      pt(sc.clone().addScaledVector(wDirS, vR).addScaledVector(rSide, s * 0.47).setY(fy)),
      pt(rwA.clone().addScaledVector(rSide, s * 0.47)),
      pt(rwAt(0.5, s * 0.46)),
      pt(rwB.clone().addScaledVector(rSide, s * 0.47)),
      pt(hc.clone().addScaledVector(wDirH, hutPlatR).addScaledVector(rSide, s * 0.47)),
      pt(hc.clone().addScaledVector(dirAt(aWalkH - s * gapHut), hutRailR)),
    ];
    walkEdges.push({ id: `grove-rope-walk-side-${s}`, pts, hw: EDGE_HW });
  }
  // the tree hut's platform railing, all round but the walkway (its rope ladder is decorative)
  walkEdges.push({ id: 'grove-hut-rail', pts: arcPts(hc, hutRailR, aWalkH + gapHut, aWalkH - gapHut + TAU, TH.floorY), hw: EDGE_HW });
  for (const b of blockers) walkEdges.push({ id: b.id, pts: [[r4(b.x), r4(T.height(b.x, b.z)), r4(b.z)], [r4(b.x), r4(T.height(b.x, b.z)), r4(b.z)]], hw: b.r });

  // ================= locality =================
  const sunToward = ctx.sun ? ctx.sun.position.clone().sub(ctx.sun.target.position).normalize() : sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
  const spheres = groveSpheres((x, z) => T.height(x, z), sunToward);
  const visible = (camera: Camera) => groveVisible(camera, spheres);

  const houseTris = (() => {
    let n = 0;
    house.group.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) n += tri(m.geometry);
    });
    return n;
  })();
  const foliageTris = foliageMeshes.reduce((n, m) => n + tri(m.geometry), 0);
  const trestle = gangwayTrestleFeet().map(([x, z]) => [+x.toFixed(2), +T.height(x, z).toFixed(2), +z.toFixed(2)] as P3);
  return {
    group,
    lanterns,
    walkSurfaces,
    cameraWalls: huts.cameraWalls,
    walkSpans,
    walkEdges,
    bases,
    footprints: [...blockers.map(({ x, z, r }) => ({ x: r4(x), z: r4(z), r })), ...footprints.map(({ x, z, r }) => ({ x: r4(x), z: r4(z), r }))],
    owned,
    visible,
    audit: {
      house: { id: N.house.id, lanterns: house.lanterns.length, lightsRemoved: house.lights.length + postLights },
      huts: huts.audit.map((a) => ({ id: a.id, hostSource: a.hostSource, centre: a.centre, floorY: a.floorY, radius: a.radius, door: a.door, pods: a.pods.length, boughPods: a.dressing?.boughPods.length ?? 0, character: a.character })),
      veranda: { radius: vR, boards: nBoards, railingPosts, stilts: stiltTops.map(p3), stump: { top: +STILT_STUMP.top.toFixed(3), foot: +STILT_STUMP.foot.toFixed(3), ground: +stumpGround.toFixed(3) } },
      gangway: { foot: p3(gTop(0)), head: p3(gTop(1)), slopeDeg: +slopeDeg.toFixed(1), treads, cleats, trestle },
      ropeWalk: { from: p3(rwA), to: p3(rwB), planks: ropePlanks, sag: N.ropeWalk.sag },
      column: { foot: p3(new Vector3(hc.x, colGround, hc.z)), top: p3(colTop), radiusAtFloor: +colR(TH.floorY - colGround).toFixed(3), limbs, roots },
      nest: { floorY: ny, radius: nestR, boards: nestBoards, rungs: nestRungs },
      props: { pots, baskets, woodpileLogs: woodLogs, cloths, blockers: blockers.length },
      pods: pods.map(p3),
      walk: { surfaces: walkSurfaces.length, spans: walkSpans.length, edges: walkEdges.length },
      triangles: { house: houseTris, huts: huts.triangles, built: builtGeos.reduce((n, g) => n + tri(g), 0), foliage: foliageTris, tufts: tufts.triangles },
      leaves: foliage.leafCount,
      pointLights: 0,
    },
  };
}
