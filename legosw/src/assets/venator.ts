import { Box3, Group, LOD, Matrix4, Mesh, Object3D, Quaternion, Vector3, type Camera } from 'three';
import { Builder, GAP, PLATE } from '../core/builder';
import { MeshAcc, cylinder, profile, sphere, tube, type MeshData, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import { Rng } from '../core/rng';
import { anchor } from './placeholder';
import type { CapitalShip } from './types';
import {
  RouteBuilder,
  TIER_BASE,
  TIER_MICRO,
  ccw,
  clipConvex,
  clipHalf,
  coneSolidMD,
  fine,
  frustumMD,
  grilleBarsMD,
  grilleBaseMD,
  h3,
  inConvex,
  insetConvex,
  makeFrame,
  micro,
  offsetEdges,
  packPanel,
  polyNormal,
  tileFace,
  tileMD,
  toLocal,
  toWorld,
  topMD,
  type Frame,
  type P2,
  type TStyle,
} from './b-kit';

/**
 * Venator-class Star Destroyer (Republic attack cruiser, Open Circle Fleet livery of the Revenge
 * of the Sith opening) as a macro-scale brick build: 400 hull studs long, every stud 8 units, so
 * the ship is 3200 units from bow tip to engine bells.
 *
 * The hull is the real "double wedge": one stern cross-section (flight deck, dorsal wings, rim,
 * side trench, lower side band, ventral wedge, keel) coned to the bow tip, so every hull face is a
 * planar triangle. Each face is tiled in its own frame by the b-kit packer (tiles, plates, grille
 * tiles, cropped wedge pieces along the angled edges) on top of a dark core. Livery: dark red
 * hangar doors from bow to superstructure, four red stripes on each aft wing, red nose, Open Circle
 * emblems amidships.
 *
 * LOD 0 is built in one routed pass: base parts go to a few spatial chunks (frustum culling), studs
 * and small greebles to near-only chunks, grille bars and hairline parts to closest-range chunks,
 * so the detail that would shimmer at a distance is simply not drawn there. Stacked parts never
 * share a top plane (every overlay sits on its own height), which keeps the hull free of z-fighting.
 */

const S = 8;
const ROT_Y_TO_Z = new Matrix4().makeRotationX(Math.PI / 2);
const ZT = 200;
const ZS = -186;
const TIP: V3 = [0, 0, ZT];

// stern cross-section, port half (x ≥ 0): [x, y] in studs
const D1: P2 = [18, 16];
const D0: P2 = [0, 16];
const R0: P2 = [96, 2];
const R1: P2 = [96, -3];
const T0: P2 = [90, -3];
const T1: P2 = [90, -10];
const L0: P2 = [93.5, -10];
const L1: P2 = [93.5, -14];
const K1: P2 = [20, -32];
const K0: P2 = [0, -32];
const PORT_SECTION: P2[] = [D1, R0, R1, T0, T1, L0, L1, K1];
const FULL_SECTION: P2[] = [...PORT_SECTION.map(([x, y]) => [-x, y] as P2), ...PORT_SECTION.slice().reverse()];

const st = (p: P2, sx = 1): V3 => [p[0] * sx, p[1], ZS];
const tz = (z: number) => (ZT - z) / (ZT - ZS);
/** point of the section edge line through p at station z */
const at = (p: P2, z: number, sx = 1): V3 => {
  const k = tz(z);
  return [p[0] * k * sx, TIP[1] + (p[1] - TIP[1]) * k, z];
};
const SLOPE = (D1[1] - R0[1]) / (R0[0] - D1[0]);
export function dorsalY(x: number, z: number): number {
  const k = tz(z);
  const ax = Math.abs(x);
  if (ax <= D1[0] * k) return D1[1] * k;
  return D1[1] * k - (ax - D1[0] * k) * SLOPE;
}

/** the red nose cap covers the hull forward of this station; tiles there are left out */
const NOSE_Z = ZT - 7;
const underNose = (z: number) => z > NOSE_Z + 0.3;

// superstructure footprint (level 1 bottom), CCW in [x, z]: a long wedge over the aft 35 %
const SUP_FRONT_Z = -50;
const SUP_FRONT_HW = 24;
const SUP_REAR_HW = 50;
const SUP_BOTTOM: P2[] = ccw([
  [SUP_FRONT_HW, SUP_FRONT_Z],
  [-SUP_FRONT_HW, SUP_FRONT_Z],
  [-SUP_REAR_HW, ZS],
  [SUP_REAR_HW, ZS],
]);
const SUP_Y0 = 7.6;
const SUP_Y1 = 25;
const SUP2_Y1 = 31;
const L2_FRONT_Z = -112;
const L2_BOTTOM: P2[] = ccw([
  [18, L2_FRONT_Z],
  [-18, L2_FRONT_Z],
  [-34, ZS],
  [34, ZS],
]);
const TOWER_Y1 = 52;
const BRIDGE_Y = [52, 54.2, 57.6, 59.2];
const TOWER_X = 14;
/** port tower footprint (starboard mirrored) */
const TOWER_FOOT: P2[] = [
  [TOWER_X - 4, -184],
  [TOWER_X + 4, -184],
  [TOWER_X + 4, -146],
  [TOWER_X + 1.8, -140],
  [TOWER_X - 1.8, -140],
  [TOWER_X - 4, -146],
];
/** command bridge plan on top of the port tower, pointed toward the bow */
const BRIDGE_PLAN: P2[] = ccw([
  [TOWER_X - 9.5, -180],
  [TOWER_X + 9.5, -180],
  [TOWER_X + 9.5, -158],
  [TOWER_X + 6.5, -150],
  [TOWER_X - 6.5, -150],
  [TOWER_X - 9.5, -158],
]);
const NECK: P2[] = ccw([
  [6.5, -184],
  [6.5, -152],
  [-6.5, -152],
  [-6.5, -184],
]);
const NECK_Y = SUP2_Y1 + 5;
const offL1 = (k: EdgeKind) => (k === 'front' ? 18 : k === 'rear' ? 0 : 8);
const offL2 = (k: EdgeKind) => (k === 'front' ? 7 : k === 'rear' ? 0 : 3);
const offNeck = (k: EdgeKind) => (k === 'front' ? 3 : k === 'rear' ? 0 : 1.2);
const offTower = (k: EdgeKind) => (k === 'rear' ? 1.4 : k === 'side' ? 1.2 : k === 'front' ? 9 : 6.5);
/** window-band rows (v in studs up each face) per level and face kind; shared by every LOD */
const BANDS_L1 = (k: EdgeKind) => (k === 'rear' ? [] : k === 'front' ? [8, 14, 20] : [7, 12]);
const BANDS_TOWER = (k: EdgeKind) => (k === 'rear' ? [6, 14] : [5, 11, 17]);

function inSuper(x: number, z: number, margin = 0): boolean {
  if (z > SUP_FRONT_Z - margin) return false;
  const k = (z - SUP_FRONT_Z) / (ZS - SUP_FRONT_Z);
  const half = SUP_FRONT_HW + (SUP_REAR_HW - SUP_FRONT_HW) * k - margin;
  return Math.abs(x) < half;
}

/** point-in-volume test for a footprint extruded from y0 to y1 with per-edge inward offsets (margin > 0 shrinks it) */
function volume(bottom: P2[], off: number[], y0: number, y1: number): (x: number, y: number, z: number, margin?: number) => boolean {
  const B = ccw(bottom);
  const n = B.length;
  const E = B.map((p, i) => {
    const q = B[(i + 1) % n];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const l = Math.hypot(dx, dz) || 1;
    const nx = dz / l, nz = -dx / l;
    return [nx, nz, nx * p[0] + nz * p[1], off[i]];
  });
  return (x, y, z, m = 0) => {
    if (y < y0 || y > y1) return false;
    const t = (y - y0) / (y1 - y0);
    for (const [nx, nz, c, o] of E) if (nx * x + nz * z > c - o * t - m) return false;
    return true;
  };
}
/** the level-1 superstructure volume (its raked front and battered flanks included) */
const inL1 = volume(SUP_BOTTOM, edgeKinds(SUP_BOTTOM).map(offL1), SUP_Y0, SUP_Y1);

// heavy turret placements (port side; starboard mirrored): four along each flank of the superstructure
const TURRETS: [number, number][] = [
  [-62, 0],
  [-90, 0],
  [-118, 0],
  [-146, 0],
].map(([z]) => [96 * tz(z) - 27, z]);

/** Open Circle emblem centre on each dorsal wing (x, z), clear of the deck-edge service trench */
const EMBLEM_XZ: [number, number] = [27, 2];

/** aft-wing livery stripe in the dorsal-wing frame: v0..v1 in from the rim, from u0 aft */
type Stripe = [v0: number, v1: number, u0: number];
/**
 * Lod 0 has four 2-stud stripes. At fleet range their 4-stud period drops under two pixels and turns
 * to moiré, so the fleet LOD merges them into two 4-stud stripes (the same amount of red) and the far
 * LOD into one band.
 */
const STRIPES_LOD0: Stripe[] = [0, 1, 2, 3].map((k) => [5 + 4 * k, 7 + 4 * k, 236 + 14 * k]);
const STRIPES_LOD1: Stripe[] = [
  [6, 10, 236],
  [14, 18, 264],
];
const STRIPES_LOD2: Stripe[] = [[7, 17, 236]];
const nearStripe = (stripes: Stripe[], u: number, v: number, g: number) => stripes.some(([v0, v1, u0]) => u >= u0 - g && v >= v0 - g && v < v1 + g);

// ─── frames ─────────────────────────────────────────────────────────────────────────────────────

function faceFrame(pts: V3[], outward: V3, uDir?: V3, vToward?: V3): Frame {
  const n = polyNormal(pts);
  const ud: V3 = uDir ?? [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
  let vt = vToward;
  if (!vt) {
    let x = 0, y = 0, z = 0;
    for (const p of pts) {
      x += p[0];
      y += p[1];
      z += p[2];
    }
    vt = [x / pts.length, y / pts.length, z / pts.length];
  }
  return makeFrame(pts[0], ud, n, outward, vt);
}

function inFrame(b: Builder, f: Frame, fn: () => void): void {
  b.push();
  b.apply(f.m);
  fn();
  b.pop();
}

const Z_DECK_END = SUP_FRONT_Z - 3.2;
/** flight-deck frame: u along the centreline from the bow tip aft, v across toward port, y up */
const DECK_FRAME = makeFrame(TIP, [0, D0[1] - TIP[1], ZS - ZT], [0, ZT - ZS, D0[1] - TIP[1]], [0, 1, 0], [10, 0, 0]);
const DECK_LEN = toLocal(DECK_FRAME, at(D0, Z_DECK_END))[0];
const DECK_HW = D1[0] * tz(Z_DECK_END);
const DECK_TAN = DECK_HW / DECK_LEN;
const DECK_COS = 1 / Math.hypot(1, DECK_TAN);
const DECK_DZ = (ZT - ZS) / Math.hypot(ZT - ZS, D0[1] - TIP[1]);
const deckEdgeV = (u: number) => u * DECK_TAN;
const deckZ = (u: number) => ZT - u * DECK_DZ;

/** dorsal wing frame: u along the port edge from the tip, v inward toward the deck edge */
const DORSAL_PTS: V3[] = [TIP, st(R0), st(D1)];
const FD = faceFrame(DORSAL_PTS, [0, 1, 0]);
/** deck-edge frame on the dorsal wing plane: u along the deck edge from the tip, v outward toward the rim */
const FE = makeFrame(TIP, [D1[0], D1[1] - TIP[1], ZS - ZT], [FD.n.x, FD.n.y, FD.n.z], [0, 1, 0], st(R0));
const BU: P2 = [FD.u.dot(FE.u), FD.v.dot(FE.u)];
const BV: P2 = [FD.u.dot(FE.v), FD.v.dot(FE.v)];
/** dorsal-wing (u, v) → deck-edge frame (along the edge, distance out from it) */
const toBand = (u: number, v: number): P2 => [u * BU[0] + v * BU[1], u * BV[0] + v * BV[1]];
/** service trench along each deck edge: from BAND_U0 aft into the superstructure's raked front */
const BAND_U0 = 50;
const BAND_W = 7;
const BAND_U1 = (() => {
  for (let u = 180; u < 330; u += 0.25) {
    const p = toWorld(FE, u, 0.6, 0.4);
    if (inL1(p.x, p.y, p.z)) return u + 0.8;
  }
  return 254;
})();
const EMB: P2 = toLocal(FD, [EMBLEM_XZ[0], dorsalY(EMBLEM_XZ[0], EMBLEM_XZ[1]), EMBLEM_XZ[1]]);
const TURRET_L: P2[] = TURRETS.map(([x, z]) => toLocal(FD, [x, dorsalY(x, z), z]));

// ─── styles ─────────────────────────────────────────────────────────────────────────────────────

interface Cfg {
  /** lod 0 detail (routed tiers, greebles) */
  D: boolean;
  seed: number;
}

function styleSet(D: boolean) {
  const F: P2[] = D
    ? [[6, 4], [8, 4], [4, 4], [6, 2], [8, 2], [4, 2], [3, 2], [2, 2], [4, 1], [3, 1], [2, 1], [1, 1]]
    : [[16, 8], [12, 8], [8, 8], [16, 4], [12, 4], [8, 4], [6, 4], [4, 4], [8, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]];
  const BIG: P2[] = D
    ? [[8, 6], [8, 4], [6, 4], [4, 4], [8, 2], [6, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]]
    : [[16, 16], [16, 8], [12, 8], [8, 8], [16, 4], [8, 4], [4, 4], [8, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]];
  const LONG: P2[] = D ? [[8, 1], [6, 1], [4, 1], [3, 1], [2, 1], [1, 1]] : [[16, 1], [12, 1], [8, 1], [4, 1], [2, 1], [1, 1]];
  const LONG2: P2[] = D ? [[8, 2], [6, 2], [4, 2], [8, 1], [6, 1], [4, 1], [2, 2], [2, 1], [1, 1]] : [[16, 2], [12, 2], [8, 2], [16, 1], [8, 1], [4, 2], [4, 1], [2, 1], [1, 1]];
  const CROSS: P2[] = D ? [[1, 8], [1, 6], [1, 4], [1, 3], [1, 2], [1, 1]] : [[1, 16], [1, 8], [1, 4], [1, 2], [1, 1]];
  const DOOR: P2[] = D
    ? [[8, 2], [6, 2], [4, 2], [3, 2], [2, 2], [8, 1], [6, 1], [4, 1], [3, 1], [2, 1], [1, 1]]
    : [[11, 8], [11, 4], [8, 8], [8, 4], [4, 4], [8, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]];
  const PL: P2[] = D ? [[4, 2], [2, 2], [6, 2], [3, 2], [2, 1], [1, 1]] : [[8, 4], [4, 4], [4, 2], [2, 2], [2, 1], [1, 1]];
  const LEAF: P2[] = [[5, 2], [5, 1], [4, 2], [3, 2], [2, 2], [4, 1], [3, 1], [2, 1], [1, 1]];
  const GR: P2[] = [[2, 1], [1, 1]];
  const s = (key: ColorKey, sizes: P2[], extra: Partial<TStyle> = {}): TStyle => ({ key, sizes, flat: !D, gap: D ? undefined : 0, ...extra });
  return {
    field: s('white', F),
    fieldL: s('lbg', F),
    panelL: s('lbg', F),
    panelW: s('white', F),
    panelD: s('dbg', F),
    raisedL: s('lbg', F, { kind: 'raised' }),
    raisedW: s('white', F, { kind: 'raised' }),
    raisedD: s('dbg', F, { kind: 'raised' }),
    tallW: s('white', F, { kind: 'tall' }),
    tallL: s('lbg', F, { kind: 'tall' }),
    plateL: s('lbg', PL, { kind: D ? 'plate' : 'tile' }),
    plateD: s('dbg', PL, { kind: D ? 'plate' : 'tile' }),
    plateW: s('white', PL, { kind: D ? 'plate' : 'tile' }),
    pad: s('dbg', PL),
    grilleD: s('dbg', GR, { kind: D ? 'grille' : 'tile' }),
    grilleL: s('lbg', GR, { kind: D ? 'grille' : 'tile' }),
    grilleDv: s('dbg', [[1, 2], [1, 1]], { kind: D ? 'grille' : 'tile' }),
    trim: s('lbg', LONG),
    trimW: s('white', LONG),
    trimD: s('dbg', LONG),
    seam: s('lbg', CROSS),
    seamD: s('dbg', CROSS),
    red: s('darkRed', LONG2),
    rail: s('dbg', LONG, { kind: 'raised' }),
    railTile: s('dbg', LONG),
    door: s('darkRed', DOOR),
    doorRib: s('darkRed', CROSS, { kind: D ? 'plate' : 'raised', hP: 2 }),
    black: s('black', LONG2),
    trench: s('dbg', BIG),
    trenchL: s('lbg', LONG2),
    ventral: s('lbg', BIG),
    ventralW: s('white', BIG),
    ventralD: s('dbg', BIG),
    // lod-0 detail: hangar-door leaves, window bands with sills and headers, pilasters, louvres
    lip: s('dbg', LONG),
    leaf: s('darkRed', LEAF, { kind: 'raised' }),
    leafFlush: s('darkRed', LEAF),
    leafSeam: s('black', CROSS),
    leafGrille: s('dbg', GR, { kind: 'grille' }),
    winBand: s('black', LONG, { lift: -0.25 }),
    header: s('dbg', LONG, { kind: 'raised' }),
    sill: s('lbg', LONG),
    pilaster: s('lbg', CROSS, { kind: 'raised' }),
    louvre: s('dbg', LONG, { kind: 'raised' }),
    louvreB: s('black', LONG),
  };
}
type Styles = ReturnType<typeof styleSet>;

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Structured "aztec" patchwork: one panel group per module×band cell, repeating every 5 modules. */
function aztec(u: number, v: number, seed: number, M: number, B: number, pick: (r: number) => TStyle | null): TStyle | null {
  const m = Math.floor(u / M), q = Math.floor(v / B);
  const mm = ((m % 5) + 5) % 5;
  if (h3(mm, q, seed) > 0.5) return null;
  const w = 3 + Math.floor(h3(mm, q, seed + 1) * 3) * 3;
  const hh = 2 + Math.floor(h3(mm, q, seed + 2) * Math.max(1, B - 2));
  const ou = Math.floor(h3(mm, q, seed + 3) * Math.max(1, M - w + 1));
  const ov = Math.floor(h3(mm, q, seed + 4) * Math.max(1, B - hh + 1));
  const lu = u - m * M, lv = v - q * B;
  if (lu >= ou && lu < ou + w && lv >= ov && lv < ov + hh) return pick(h3(mm, q, seed + 5));
  return null;
}

interface PlateSet {
  outer: (r: number) => TStyle;
  /** second tier inside a panel (null: the panel stays one piece) */
  inset: (r: number, raised: boolean) => TStyle | null;
}

/**
 * Two-tier hull plating: per module×band cell a panel group (4–10 × 2–B studs) whose inner part
 * carries a second, higher tier — the layered look of UCS hull plating. Repeats every 7 modules.
 */
function plating(u: number, v: number, seed: number, M: number, B: number, P: PlateSet, density = 0.62): TStyle | null {
  const m = Math.floor(u / M), q = Math.floor(v / B);
  const mm = mod(m, 7);
  if (h3(mm, q, seed) > density) return null;
  const w = Math.min(M, 4 + Math.floor(h3(mm, q, seed + 1) * 4) * 2);
  const hh = Math.min(B, 2 + Math.floor(h3(mm, q, seed + 2) * Math.max(1, B - 1)));
  const ou = Math.floor(h3(mm, q, seed + 3) * Math.max(1, M - w + 1));
  const ov = Math.floor(h3(mm, q, seed + 4) * Math.max(1, B - hh + 1));
  const lu = u - m * M - ou, lv = v - q * B - ov;
  if (lu < 0 || lu >= w || lv < 0 || lv >= hh) return null;
  const outer = P.outer(h3(mm, q, seed + 5));
  if (w >= 4 && hh >= 3 && lu >= 1 && lu < w - 1 && lv >= 1 && lv < hh - 1) {
    const s = P.inset(h3(mm, q, seed + 6), outer.kind === 'raised');
    if (s) return s;
  }
  return outer;
}

interface StrakeSet {
  /** plate tone for a hash (null: bare field) */
  tone: (r: number) => TStyle | null;
  /** second tier on a big plate (null: none) */
  inset: (r: number, outer: TStyle | null) => TStyle | null;
}

/**
 * Dense UCS-style hull plating: every module×band cell is cut along u into one to three plates of
 * their own tone and height (some a row short of the band); big plates carry a second, higher tier.
 * Plates are at least 4 studs long, so the patchwork never breaks up into single-tile sparkle.
 * Repeats every 7 modules. M ≥ 12.
 */
function strakes(u: number, v: number, seed: number, M: number, B: number, P: StrakeSet): TStyle | null {
  const m = Math.floor(u / M), q = Math.floor(v / B);
  const mm = mod(m, 7);
  const lu = u - m * M, lv = v - q * B;
  const n = 1 + Math.floor(h3(mm, q, seed) * 3);
  let c1 = M, c2 = M;
  if (n === 2) c1 = 4 + 2 * Math.floor(h3(mm, q, seed + 1) * ((M - 8) / 2 + 1));
  else if (n === 3) {
    c1 = 4 + 2 * Math.floor(h3(mm, q, seed + 1) * 2);
    c2 = M - 4 - 2 * Math.floor(h3(mm, q, seed + 7) * 2);
  }
  const p = lu < c1 ? 0 : lu < c2 ? 1 : 2;
  const a = p === 0 ? 0 : p === 1 ? c1 : c2;
  const e = p === 0 ? c1 : p === 1 ? c2 : M;
  const k = mm * 4 + p;
  let r0 = 0, r1 = B;
  if (B >= 4 && h3(k, q, seed + 3) < 0.35) {
    if (h3(k, q, seed + 4) < 0.5) r0 = 1;
    else r1 = B - 1;
  }
  if (lv < r0 || lv >= r1) return null;
  const tone = P.tone(h3(k, q, seed + 2));
  if (e - a >= 4 && r1 - r0 >= 3 && lu >= a + 1 && lu < e - 1 && lv >= r0 + 1 && lv < r1 - 1 && h3(k, q, seed + 5) < 0.45) {
    return P.inset(h3(k, q, seed + 6), tone) ?? tone;
  }
  return tone;
}

const wingStrakes = (L: Styles): StrakeSet => ({
  tone: (r) =>
    r < 0.14 ? null : r < 0.4 ? L.panelW : r < 0.6 ? L.panelL : r < 0.77 ? L.raisedW : r < 0.86 ? L.raisedL : r < 0.91 ? L.panelD : r < 0.97 ? L.plateL : L.grilleD,
  inset: (r, o) =>
    o === L.raisedW ? L.tallW : o === L.raisedL ? L.tallL : o === L.panelD ? L.raisedD : o === L.plateL || o === L.grilleD ? null : r < 0.55 ? L.raisedW : L.raisedL,
});
const facePlates = (L: Styles): PlateSet => ({
  outer: (r) => (r < 0.6 ? L.panelL : r < 0.8 ? L.raisedL : L.plateL),
  inset: (r, raised) => (raised ? (r < 0.4 ? L.tallL : null) : r < 0.35 ? L.raisedW : r < 0.55 ? L.panelD : null),
});
const roofPlates = (L: Styles): PlateSet => ({
  outer: (r) => (r < 0.45 ? L.panelW : r < 0.7 ? L.panelD : r < 0.85 ? L.plateL : L.raisedL),
  inset: (r, raised) => (raised ? (r < 0.4 ? L.tallW : null) : r < 0.3 ? L.grilleD : r < 0.55 ? L.raisedW : r < 0.7 ? L.raisedD : null),
});

// ─── small parts ────────────────────────────────────────────────────────────────────────────────

const T = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);

/** chamfered slab (a tile body without a bottom face): centre (x, z), bottom y0, footprint w × d, height h */
function slab(b: Builder, key: ColorKey, x: number, y0: number, z: number, w: number, d: number, h: number, c = 0.035): void {
  if (w <= 0.02 || d <= 0.02 || h <= 0.005) return;
  b.add(key, tileMD(w, d, h, Math.min(c, h * 0.4, w * 0.25, d * 0.25)), T(x, y0, z));
}

/** grille tile: the recessed body always, the bars only at the closest range */
function grille(b: Builder, key: ColorKey, x: number, y0: number, z: number, w: number, d: number, h = PLATE): void {
  const m = T(x, y0, z);
  b.add(key, grilleBaseMD(w, d, h, 0.03), m);
  micro(b, () => b.add(key, grilleBarsMD(w, d, h), m));
}

const _rq = new Quaternion();
const _rd = new Vector3();
const _Y = new Vector3(0, 1, 0);
/** round bar between two points */
function rod(b: Builder, key: ColorKey, a: V3, c: V3, r: number, radial = 8): void {
  _rd.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = _rd.length();
  if (len < 1e-4) return;
  _rq.setFromUnitVectors(_Y, _rd.divideScalar(len));
  const m = new Matrix4().makeRotationFromQuaternion(_rq).setPosition((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
  b.add(key, cylinder(r, len, Math.min(0.03, r * 0.2), radial), m);
}

function dome(b: Builder, key: ColorKey, x: number, y: number, z: number, r: number, h: number, radial = 16): void {
  b.lathe(key, profile([[0, h], [r * 0.55, h * 0.9], [r * 0.85, h * 0.6], [r, 0]], 50), { at: [x, y, z], radial, cacheKey: `vdome|${r}|${h}` });
}

function lamp(b: Builder, key: ColorKey, x: number, y: number, z: number, r: number, h: number): void {
  b.cyl(key, x, y + h / 2, z, r, h, { radial: 8 });
}

function sensorDome(b: Builder, x: number, y: number, z: number, r: number, h: number): void {
  b.cyl('dbg', x, y + 0.15, z, r + 0.2, 0.3, { radial: 20 });
  dome(b, 'white', x, y + 0.3, z, r, h, 20);
}

/** sensor mast (top ≈ y + h + 1.8): base block, pole with two yard-arms of emitters, lattice legs, beacon */
function mast(b: Builder, x: number, y: number, z: number, h: number): void {
  slab(b, 'dbg', x, y, z, 1.8, 1.8, 0.5);
  slab(b, 'lbg', x, y + 0.5, z, 1.1, 1.1, 0.35);
  const y1 = y + 0.85;
  b.cyl('lbg', x, y1 + h / 2, z, 0.24, h, { radial: 10 });
  b.cyl('dbg', x, y1 + h * 0.3, z, 0.38, 0.6, { radial: 10 });
  fine(b, () => {
    for (const [f, l] of [
      [0.62, 2.8],
      [0.88, 1.8],
    ]) {
      const ya = y1 + h * f;
      b.box('dbg', x, ya, z, l, 0.2, 0.2, { c: 0.02 });
      for (const s of [-1, 1]) b.box('lbg', x + (s * l) / 2, ya - 0.05, z, 0.3, 0.5, 0.3, { c: 0.03 });
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      rod(b, 'gunmetal', [x + Math.cos(a) * 0.72, y + 0.5, z + Math.sin(a) * 0.72], [x + Math.cos(a) * 0.26, y1 + h * 0.5, z + Math.sin(a) * 0.26], 0.07, 6);
    }
    b.cyl('flatSilver', x, y1 + h + 0.4, z, 0.09, 0.8, { radial: 8 });
  });
  micro(b, () => lamp(b, 'glowRed', x, y1 + h + 0.8, z, 0.12, 0.16));
}

// ─── greebles ───────────────────────────────────────────────────────────────────────────────────

type GKind = 'box' | 'stack' | 'vent' | 'dome' | 'hatch' | 'pipes' | 'antenna' | 'fins' | 'tank' | 'pd' | 'panel' | 'cap';
/** weighted mix: mostly low boxes, panels and vents; domes, masts and turrets stay rare accents */
const G_ALL: GKind[] = ['box', 'box', 'box', 'stack', 'stack', 'vent', 'vent', 'hatch', 'hatch', 'panel', 'panel', 'panel', 'cap', 'pipes', 'fins', 'tank', 'pd', 'dome', 'antenna'];

function gSize(kind: GKind, r: number): P2 {
  switch (kind) {
    case 'box':
      return [2 + Math.floor(r * 3), 2 + (Math.floor(r * 7) % 2)];
    case 'stack':
      return [3 + Math.floor(r * 2), 3];
    case 'vent':
      return [r < 0.5 ? 2 : 4, 2];
    case 'dome':
    case 'cap':
      return [2, 2];
    case 'panel':
      return [3 + Math.floor(r * 3), 2 + (Math.floor(r * 5) % 2)];
    case 'hatch':
      return [2 + Math.floor(r * 2), 2 + Math.floor(r * 2)];
    case 'pipes':
      return [4 + Math.floor(r * 3), 2];
    case 'fins':
      return [3 + Math.floor(r * 2), 2];
    case 'tank':
      return [4, 2];
    default:
      return [2, 2];
  }
}

/**
 * One greeble module centred on the origin, sitting on y = 0 (the tile tops), long side along x,
 * "forward" = −x. Stacked parts never share a top height, so nothing inside a module z-fights.
 */
function greeble(b: Builder, kind: GKind, w: number, d: number, r: number): void {
  const cA: ColorKey = r < 0.5 ? 'lbg' : 'dbg';
  const cB: ColorKey = r < 0.5 ? 'dbg' : 'lbg';
  const r2 = (r * 7.31) % 1;
  switch (kind) {
    case 'box': {
      slab(b, cA, 0, 0, 0, w - 0.1, d - 0.1, 0.55);
      const wu = Math.max(0.8, w - 1.4), du = Math.max(0.8, d - 0.9);
      const ou = (r2 - 0.5) * (w - wu - 0.3);
      slab(b, cB, ou, 0.55, 0, wu, du, 0.35 + 0.3 * r2);
      if (w - wu >= 1.1) fine(b, () => b.cyl('lbg', -(ou >= 0 ? 1 : -1) * (w / 2 - 0.55), 0.64, 0, 0.3, 0.18, { radial: 10 }));
      break;
    }
    case 'stack':
      slab(b, cA, 0, 0, 0, w - 0.1, d - 0.1, 0.35);
      slab(b, 'white', 0, 0.35, 0, w - 0.9, d - 0.9, 0.35);
      slab(b, cB, 0, 0.7, 0, w - 1.7, d - 1.7, 0.3);
      break;
    case 'vent':
      slab(b, 'dbg', 0, 0, 0, w - 0.1, d - 0.1, 0.3);
      grille(b, 'dbg', 0, 0.3, 0, w - 0.5, d - 0.5, 0.35);
      break;
    case 'dome':
      b.cyl('dbg', 0, 0.15, 0, 0.95, 0.3, { radial: 16 });
      dome(b, 'white', 0, 0.3, 0, 0.8, 0.62, 16);
      break;
    case 'cap':
      slab(b, cA, 0, 0, 0, 1.9, 1.9, 0.35);
      b.cyl(cB, 0, 0.35 + 0.11, 0, 0.88, 0.22, { radial: 16 });
      fine(b, () => b.cyl(cA, 0, 0.57 + 0.09, 0, 0.3, 0.18, { radial: 10 }));
      break;
    case 'panel': {
      // stepped cover plate with a vent strip at one end
      slab(b, cA, 0, 0, 0, w - 0.1, d - 0.1, 0.3);
      slab(b, r2 < 0.5 ? 'white' : 'lbg', 0.45, 0.3, 0, w - 1.3, d - 0.7, 0.22);
      grille(b, 'dbg', -(w / 2 - 0.55), 0.3, 0, 0.7, d - 0.5, 0.26);
      break;
    }
    case 'hatch':
      slab(b, 'lbg', 0, 0, 0, w - 0.1, d - 0.1, 0.3);
      slab(b, 'dbg', 0, 0.3, 0, w - 0.8, d - 0.8, 0.18);
      fine(b, () => {
        slab(b, 'gunmetal', 0, 0.48, 0, 0.7, 0.12, 0.14, 0.02);
        for (const s of [-1, 1]) slab(b, 'dbg', s * (w / 2 - 0.55), 0.3, -(d / 2 - 0.3), 0.3, 0.2, 0.3, 0.02);
      });
      break;
    case 'pipes':
      for (const s of [-1, 1]) slab(b, 'dbg', s * (w / 2 - 0.6), 0, 0, 0.5, d - 0.2, 0.6);
      for (const s of [-1, 1]) b.cyl('gunmetal', 0, 0.42, s * 0.45, 0.26, w - 0.2, { axis: 'x', radial: 10 });
      fine(b, () => b.cyl('flatSilver', (r2 - 0.5) * (w - 2.2), 0.78, 0.45, 0.16, 0.3, { radial: 8 }));
      break;
    case 'antenna':
      slab(b, 'dbg', 0, 0, 0, 1.9, 1.9, 0.45);
      b.cyl('lbg', 0, 0.6, 0, 0.45, 0.3, { radial: 12 });
      fine(b, () => {
        b.cyl('flatSilver', 0, 0.75 + 1.2, 0, 0.12, 2.4, { radial: 8 });
        b.box('dbg', 0, 2.1, 0, 1.2, 0.12, 0.12, { c: 0.02 });
      });
      micro(b, () => lamp(b, 'glowRed', 0, 3.15, 0, 0.13, 0.16));
      break;
    case 'fins':
      slab(b, 'dbg', 0, 0, 0, w - 0.1, d - 0.1, 0.3);
      fine(b, () => {
        const n = Math.max(2, Math.floor((w - 0.4) / 0.7));
        for (let k = 0; k < n; k++) slab(b, 'lbg', -((n - 1) * 0.7) / 2 + k * 0.7, 0.3, 0, 0.28, d - 0.5, 0.7, 0.02);
      });
      break;
    case 'tank':
      for (const s of [-1, 1]) slab(b, 'dbg', s * 1.2, 0, 0, 0.5, 1.8, 0.62);
      b.cyl('lbg', 0, 0.82, 0, 0.78, 3.6, { axis: 'x', radial: 14 });
      fine(b, () => {
        for (const s of [-1, 1]) b.cyl('dbg', s * 1.55, 0.82, 0, 0.84, 0.2, { axis: 'x', radial: 14 });
      });
      break;
    case 'pd':
      b.push();
      b.rotateY(-Math.PI / 2);
      pdTurret(b, true);
      b.pop();
      break;
  }
}

interface ScatterOpts {
  /** face polygon in the current frame (u, v); the tiles on it are on the integer stud grid */
  poly: P2[];
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  cell: number;
  /** placement probability for a cell */
  p: (u: number, v: number) => number;
  /** the face's tile style (a greeble only lands where every covered tile is a plain flush tile) */
  style: (u: number, v: number) => TStyle | null;
  mask: (u: number, v: number) => boolean;
  seed: number;
  kinds?: GKind[];
}

/** Scatter greeble modules over a tiled face: one candidate per cell, only on plain flush tiles. */
function scatter(b: Builder, o: ScatterOpts): void {
  const P = insetConvex(ccw(o.poly), 0.6);
  if (!P) return;
  const kinds = o.kinds ?? G_ALL;
  const C = o.cell;
  const clear = (cu: number, cv: number, w: number, d: number) => {
    for (let iu = Math.floor(cu - w / 2 - 0.15); iu <= Math.floor(cu + w / 2 + 0.15); iu++) {
      for (let iv = Math.floor(cv - d / 2 - 0.15); iv <= Math.floor(cv + d / 2 + 0.15); iv++) {
        const u = iu + 0.5, v = iv + 0.5;
        if (!inConvex(P, u, v) || o.mask(u, v)) return false;
        const s = o.style(u, v);
        if (!s || (s.kind ?? 'tile') !== 'tile' || s.lift || s.key === 'darkRed' || s.key === 'black') return false;
      }
    }
    return true;
  };
  for (let u = Math.floor(o.u0 / C) * C; u < o.u1; u += C) {
    for (let v = Math.floor(o.v0 / C) * C; v < o.v1; v += C) {
      if (h3(u * 7, v * 7, o.seed) > o.p(u + C / 2, v + C / 2)) continue;
      const kind = kinds[Math.floor(h3(u, v, o.seed + 1) * kinds.length)];
      const r = h3(u, v, o.seed + 2);
      const [w, d] = gSize(kind, r);
      if (w > C - 1 || d > C - 1) continue;
      const cu = u + 1 + w / 2 + Math.floor(h3(u, v, o.seed + 3) * Math.max(1, C - w - 1));
      const cv = v + 1 + d / 2 + Math.floor(h3(u, v, o.seed + 4) * Math.max(1, C - d - 1));
      if (!clear(cu, cv, w, d)) continue;
      b.at(cu, PLATE, cv, () => greeble(b, kind, w, d, h3(u, v, o.seed + 5)));
    }
  }
}

// ─── hull ───────────────────────────────────────────────────────────────────────────────────────

interface HullOut {
  turretMuzzles: V3[];
}

/** base colour of each section face (edge i of FULL_SECTION): the far LODs' core and cone */
function sectionFaceKey(i: number): ColorKey {
  const n = FULL_SECTION.length;
  const a = FULL_SECTION[i], c = FULL_SECTION[(i + 1) % n];
  const my = (a[1] + c[1]) / 2;
  const mx = Math.abs((a[0] + c[0]) / 2);
  const vertical = Math.abs(a[0] - c[0]) < 0.01;
  if (my >= 15.9) return 'darkRed'; // flight deck
  if (my > 2 && mx > 18) return 'white'; // dorsal wings
  if (vertical && mx > 95) return 'lbg'; // rim
  if (vertical && Math.abs(mx - L0[0]) < 0.01) return 'white'; // lower side band
  if (my < -10) return 'lbg'; // ventral wings, keel
  return 'dbg'; // trench
}

/** section-coned solid with one colour per face (apex, section at zs) */
function colouredCone(b: Builder, apex: V3, sec: P2[], zs: number): void {
  const acc = new Map<ColorKey, MeshAcc>();
  const n = sec.length;
  for (let i = 0; i < n; i++) {
    const a: V3 = [sec[i][0], sec[i][1], zs], c: V3 = [sec[(i + 1) % n][0], sec[(i + 1) % n][1], zs];
    const key = sectionFaceKey(i);
    let m = acc.get(key);
    if (!m) acc.set(key, (m = new MeshAcc()));
    const nrm = polyNormal([apex, a, c]);
    const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + 8];
    const s = nrm[0] * mid[0] + nrm[1] * mid[1] >= 0 ? 1 : -1;
    m.tri(apex, a, c, [nrm[0] * s, nrm[1] * s, nrm[2] * s]);
  }
  for (const [k, m] of acc) b.add(k, m.done());
}

/**
 * The solid under the tiles. Lod 0: dark, so every seam reads as a shadowed joint. Far LODs: each
 * face's core matches its tiles, so the hairline gaps between flat tiles can never flicker dark.
 */
function hullCore(b: Builder, D: boolean): void {
  const sec = offsetEdges(FULL_SECTION, FULL_SECTION.map(() => 0.45));
  const apex: V3 = [0, -0.05, ZT - 3.5];
  if (D) {
    b.add('dbg', coneSolidMD(apex, sec, ZS + 0.45));
    return;
  }
  colouredCone(b, apex, sec, ZS + 0.45);
  b.add('lbg', coneSolidMD([0, -0.05, ZT - 4], offsetEdges(FULL_SECTION, FULL_SECTION.map(() => 0.5)), ZS + 0.5));
}

function hull(b: Builder, cfg: Cfg, L: Styles, out: HullOut): void {
  hullCore(b, cfg.D);
  if (cfg.D) deckD(b, L, cfg.seed * 5 + 3);
  else deckCentre1(b, L, cfg.seed * 5 + 3);
  for (const side of [1, -1] as const) {
    b.push();
    if (side < 0) b.mirrorX();
    hullHalf(b, cfg, L, side, out);
    b.pop();
  }
  keel(b, cfg, L);
  noseCap(b);
}

// ── flight deck, far LOD: door tiles, ribs and rails (the pre-greeble layout) ──

function deckCentre1(b: Builder, L: Styles, seed: number): void {
  inFrame(b, DECK_FRAME, () => {
    const u0 = Math.ceil((1.5 * DECK_LEN) / DECK_HW);
    packPanel(
      b,
      [
        [u0, -0.5],
        [DECK_LEN, -0.5],
        [DECK_LEN, 0.5],
        [u0, 0.5],
      ],
      { seed, style: () => L.black, gridV: 0.5, module: 8 },
    );
  });
}

function deckHalf1(b: Builder, L: Styles, seed: number): void {
  inFrame(b, DECK_FRAME, () => {
    packPanel(
      b,
      [
        [0, 0],
        [DECK_LEN, 0],
        [DECK_LEN, DECK_HW],
      ],
      {
        seed: seed + 1,
        module: 12,
        period: 4,
        studs: false,
        gridV: 0.5,
        mask: (u, v) => v < 0.5 || underNose(deckZ(u)),
        style: (u, v) => {
          const d = deckEdgeV(u) - v;
          const m = mod(u, 12);
          if (d < 1) return L.rail;
          if (d < 2) return m < 2 ? L.grilleD : L.railTile;
          if (m < 1) return L.doorRib;
          return L.door;
        },
      },
    );
  });
}

// ── flight deck, lod 0: centre channel with runway lights, door leaves, edge tracks and rails ──

/** decoration of one door-leaf half: 0 plain, 1 stud plate, 2 twin hatches, 3 grille, 4 spine, 5 actuator housing, 6 vent pair */
const leafVariant = (u: number, seed: number) => {
  const k = Math.floor(u / 12), half = mod(u, 12) < 6.5 ? 0 : 1;
  const r = h3(k, half, seed + 77);
  return r < 0.2 ? 0 : r < 0.35 ? 1 : r < 0.5 ? 2 : r < 0.6 ? 3 : r < 0.74 ? 4 : r < 0.88 ? 5 : 6;
};

function deckD(b: Builder, L: Styles, seed: number): void {
  inFrame(b, DECK_FRAME, () => {
    const tri: P2[] = ccw([
      [0, 0],
      [DECK_LEN, -DECK_HW],
      [DECK_LEN, DECK_HW],
    ]);
    const u0 = 7.5;
    const ch = clipConvex(
      ccw([
        [u0, -0.5],
        [DECK_LEN, -0.5],
        [DECK_LEN, 0.5],
        [u0, 0.5],
      ]),
      tri,
    );
    packPanel(b, ch, { seed, style: () => L.black, gridV: 0.5, module: 12, minArea: 0.2, mask: (u) => underNose(deckZ(u)) });
    for (let u = 15; u < DECK_LEN - 2; u += 6) {
      b.cyl('dbg', u, PLATE + 0.08, 0, 0.4, 0.16, { radial: 12 });
      b.cyl('windowWarm', u, PLATE + 0.12, 0, 0.26, 0.24, { radial: 12 });
    }
  });
  for (const side of [1, -1] as const) {
    b.push();
    if (side < 0) b.mirrorX();
    inFrame(b, DECK_FRAME, () => deckHalfD(b, L, seed));
    b.pop();
  }
}

function deckHalfD(b: Builder, L: Styles, seed: number): void {
  const tri: P2[] = ccw([
    [0, 0],
    [DECK_LEN, 0],
    [DECK_LEN, DECK_HW],
  ]);
  /** the deck half between u0 and u1, from the channel out to dIn short of the deck edge */
  const region = (u0: number, u1: number, dIn: number): P2[] => {
    let q = clipConvex(
      ccw([
        [u0, 0.5],
        [u1, 0.5],
        [u1, DECK_HW + 1],
        [u0, DECK_HW + 1],
      ]),
      tri,
    );
    if (dIn > 0 && q.length >= 3) q = clipHalf(q, -DECK_TAN, 1, -dIn / DECK_COS);
    return q;
  };
  const leafStyle = (u: number, v: number): TStyle => {
    if (v < 1.5) return L.lip;
    const m = mod(u, 12);
    if (m < 1) return L.leafSeam;
    if (m >= 6 && m < 7) return L.leafFlush;
    return leafVariant(u, seed) === 3 ? L.leafGrille : L.leaf;
  };
  packPanel(b, region(6, 28, 0), { seed, module: 12, style: () => L.red, gridV: 0.5, minArea: 0.2, mask: (u) => underNose(deckZ(u)) });
  packPanel(b, region(28, 96, 0.8), { seed: seed + 1, module: 12, period: 5, gridV: 0.5, minArea: 0.25, style: leafStyle });
  packPanel(b, region(96, DECK_LEN, 2.3), { seed: seed + 2, module: 12, period: 5, gridV: 0.5, minArea: 0.25, style: leafStyle });
  leafDecor(b, seed);
  b.push();
  b.rotateY(-Math.atan(DECK_TAN));
  deckRail(b);
  b.pop();
}

/** cover plates, twin hatches and stepped spines on the raised door leaves (all above the leaf tops) */
function leafDecor(b: Builder, seed: number): void {
  const y = 2 * PLATE;
  for (let k = 3; k * 12 < DECK_LEN - 1; k++) {
    for (const half of [0, 1]) {
      const ua = k * 12 + (half ? 7 : 1), ub = ua + 5;
      if (ub > DECK_LEN - 0.3) continue;
      const dIn = ua >= 96 ? 2.3 : 0.8;
      const W = deckEdgeV(ua) - dIn / DECK_COS - 1.5;
      if (W < 1.9) continue;
      const uc = (ua + ub) / 2, vc = 1.5 + W / 2;
      const kind = leafVariant(uc, seed);
      if (kind === 1) {
        const dd = Math.min(2, Math.floor(W - 0.6));
        slab(b, 'darkRed', uc, y, vc, 3 - 2 * GAP, dd - 2 * GAP, PLATE);
        b.studs('darkRed', uc - 1.5, (y + PLATE) / PLATE, vc - dd / 2, 3, dd);
      } else if (kind === 2) {
        const dd = Math.min(1.8, W - 0.8);
        for (const du of [-1.15, 1.15]) {
          slab(b, 'dbg', uc + du, y, vc, 1.8, dd, 0.2);
          fine(b, () => slab(b, 'lbg', uc + du, y + 0.2, vc, 0.9, 0.14, 0.12, 0.02));
        }
      } else if (kind === 4) {
        slab(b, 'darkRed', uc, y, vc, 4.4, Math.min(1.2, W - 0.6), PLATE);
        slab(b, 'dbg', uc, y + PLATE, vc, 1.4, Math.min(0.9, W - 0.8), 0.3);
      } else if (kind === 5 && W >= 3.4) {
        // door actuator housing at the outer end, two pistons reaching inboard
        const vo = 1.5 + W - 1.0;
        slab(b, 'dbg', uc, y, vo, 3.6, 1.6, 0.5);
        slab(b, 'lbg', uc, y + 0.5, vo, 2.6, 1.0, 0.25);
        fine(b, () => {
          for (const du of [-1.1, 1.1]) b.cyl('flatSilver', uc + du, y + 0.15, vo - 1.35, 0.14, 1.3, { axis: 'z', radial: 8 });
        });
      } else if (kind === 6 && W >= 2.6) {
        const vo = 1.5 + W - 1.2;
        for (const du of [-1.1, 1.1]) grille(b, 'dbg', uc + du, y, vo, 1.8, 1.6, 0.3);
      }
    }
  }
}

/** edge frame (x along the deck edge, z outward, 0 at the edge): door track and edge rail */
function deckRail(b: Builder): void {
  const xEnd = DECK_LEN / DECK_COS + 0.3;
  for (let x = 28; x < xEnd - 0.5; x += 12) {
    const l = Math.min(12, xEnd - x);
    slab(b, 'dbg', x + l / 2, 0, -0.4, l - 0.12, 0.8 - 2 * GAP, 2 * PLATE);
    slab(b, 'lbg', x + 0.6, 2 * PLATE, -0.4, 1.0, 0.9, 0.3);
  }
  const x0 = 96;
  for (let x = x0; x < xEnd - 0.5; x += 6) {
    const l = Math.min(6, xEnd - x);
    slab(b, 'dbg', x + l / 2, 0, -1.54, l - 2 * GAP, 1.48 - 2 * GAP, PLATE);
  }
  for (let x = x0; x < xEnd - 1; x += 12) {
    const l = Math.min(12, xEnd - x) - 0.4;
    slab(b, 'gunmetal', x + 0.2 + l / 2, PLATE, -1.54, l, 0.36, 0.26, 0.04);
  }
  for (let x = x0 + 6.5; x < xEnd - 1.5; x += 12) {
    slab(b, 'dbg', x, PLATE, -1.54, 1.5, 1.3, 0.62);
    slab(b, 'lbg', x, PLATE + 0.62, -1.54, 1.0, 0.9, 0.2);
    fine(b, () => {
      for (const s of [-1, 1]) b.cyl('flatSilver', x + s * 1.6, PLATE + 0.38, -1.54, 0.13, 1.8, { axis: 'x', radial: 8 });
    });
  }
  fine(b, () => {
    for (let x = x0 + 3; x < xEnd - 1; x += 6) slab(b, 'glowWhite', x, PLATE, -2.02, 0.34, 0.3, 0.14, 0.02);
  });
}

// ── dorsal wing ──

function emblem(b: Builder, D: boolean): void {
  const m = T(EMB[0], 0, EMB[1]);
  const seg = D ? 48 : 24;
  // stacked discs, each top on its own height (no coplanar overlap with the tiles or each other)
  b.add('dbg', discMD(8.2, 0.6, seg), m);
  b.add('white', discMD(7.6, 0.8, seg), m);
  b.add('darkRed', discMD(6.3, 1.0, seg), m);
  for (const a0 of [0.35, Math.PI + 0.35]) b.add('yellow', arcMD(3.7, 5.3, 1.2, a0, a0 + Math.PI - 0.7, D ? 20 : 10), m);
  b.add('darkRed', discMD(2.2, 1.1, D ? 24 : 12), m);
}

/** service trench along the deck edge (deck-edge frame): coaming, sunk floor with bays and ribs, lip */
function wingBand(b: Builder, seed: number): void {
  const u0 = BAND_U0, u1 = BAND_U1, W = BAND_W;
  inFrame(b, FE, () => {
    slab(b, 'lbg', u0 - 0.75, 0, W / 2, 1.5, W, 0.95);
    for (let u = u0; u < u1 - 0.3; u += 6) {
      const l = Math.min(6, u1 - u);
      slab(b, 'lbg', u + l / 2, 0, 0.6, l - 2 * GAP, 1.2 - 2 * GAP, 2 * PLATE);
    }
    for (let u = u0; u < u1 - 0.3; u += 8) {
      const l = Math.min(8, u1 - u);
      slab(b, 'white', u + l / 2, 0, 6.1, l - 2 * GAP, 1.8 - 2 * GAP, 2 * PLATE);
    }
    let k = 0;
    for (let u = u0; u < u1 - 0.5; u += 8, k++) {
      const l = Math.min(8, u1 - u);
      for (const vc of [2.2, 4.2]) slab(b, 'dbg', u + l / 2, -PLATE, vc, l - 2 * GAP, 2 - 2 * GAP, PLATE);
      slab(b, 'dbg', u + 0.35, 0, 3.2, 0.7, 4 - 2 * GAP, 0.95);
      if (l > 3) bay(b, u + 0.8, u + l - 0.1, 1.2, 5.2, h3(k, 3, seed));
    }
  });
}

/** one bay of the service trench between two ribs (floor top at y = 0), long axis along u */
function bay(b: Builder, a: number, c: number, v0: number, v1: number, r: number): void {
  const L = c - a, W = v1 - v0, uc = (a + c) / 2, vc = (v0 + v1) / 2;
  const r2 = (r * 13.7) % 1;
  switch (Math.floor(r * 8)) {
    case 0: {
      // pipe run on clamps into a junction box
      for (const x of [a + 1.2, c - 2.9]) slab(b, 'dbg', x, 0, vc, 0.6, W - 0.4, 0.75);
      for (const [vv, rr] of [
        [v0 + 0.9, 0.32],
        [v0 + 2.0, 0.26],
        [v0 + 3.1, 0.32],
      ])
        b.cyl('gunmetal', (a + c - 1.8) / 2, 0.55, vv, rr, L - 1.9, { axis: 'x', radial: 10 });
      slab(b, 'lbg', c - 0.95, 0, vc, 1.5, W - 0.5, 1.25);
      fine(b, () => slab(b, 'dbg', c - 0.95, 1.25, vc, 0.9, 1.6, 0.25));
      break;
    }
    case 1: {
      // equipment boxes
      let x = a + 0.1;
      let i = 0;
      const keys: ColorKey[] = ['lbg', 'dbg', 'white', 'dbg'];
      while (x < c - 1) {
        const w = Math.min(c - x - 0.1, [1.8, 2.4, 1.4, 2.0][(i + Math.floor(r2 * 4)) % 4]);
        const hh = [0.55, 0.95, 0.75, 1.15, 1.35][(i * 3 + Math.floor(r * 50)) % 5];
        const dd = [3.6, 2.4, 3.0, 1.8][(i + Math.floor(r * 30)) % 4];
        slab(b, keys[(i + Math.floor(r2 * 9)) % 4], x + w / 2, 0, vc + (dd < 3 ? (i % 2 ? 0.6 : -0.6) : 0), w - 0.12, dd, hh);
        x += w + 0.1;
        i++;
      }
      break;
    }
    case 2:
      // pressure tank on cradles
      for (const x of [a + 1.4, c - 1.4]) slab(b, 'dbg', x, 0, vc, 0.6, W - 0.6, 0.85);
      b.cyl('lbg', uc, 1.1, vc, 1.05, L - 1.4, { axis: 'x', radial: 16 });
      fine(b, () => {
        for (const x of [a + 0.75, c - 0.75]) b.cyl('dbg', x, 1.1, vc, 1.12, 0.24, { axis: 'x', radial: 16 });
      });
      break;
    case 3:
      // exhaust vents
      slab(b, 'dbg', uc, 0, vc, L - 0.4, W - 0.4, 0.3);
      for (let x = a + 0.4; x + 2 <= c - 0.3; x += 2.2) for (const vv of [v0 + 1.1, v0 + 2.9]) grille(b, 'dbg', x + 1, 0.3, vv, 2, 1.5, 0.35);
      break;
    case 4:
      // point-defence mount
      slab(b, 'lbg', uc, 0, vc, 3.0, 3.0, 0.3);
      b.at(uc, 0.3, vc, () => {
        b.rotateY(-Math.PI / 2);
        pdTurret(b, true);
      });
      for (const x of [a + 0.8, c - 0.8]) slab(b, 'dbg', x, 0, vc, 1.1, 2.2, 0.65);
      break;
    case 5:
      // sensor dome beside an equipment block (every other one with a whip antenna)
      b.cyl('dbg', uc - 1, 0.18, vc, 1.15, 0.36, { radial: 18 });
      dome(b, 'white', uc - 1, 0.36, vc, 0.95, 0.7, 18);
      slab(b, 'lbg', c - 1.1, 0, vc, 1.6, 2.2, 0.75);
      slab(b, 'dbg', c - 1.1, 0.75, vc, 1.0, 1.4, 0.25);
      if (r2 < 0.5) {
        fine(b, () => b.cyl('flatSilver', c - 1.1, 1.0 + 0.9, vc, 0.09, 1.8, { radial: 6 }));
        micro(b, () => lamp(b, 'glowRed', c - 1.1, 2.8, vc, 0.12, 0.14));
      }
      break;
    case 6:
      // guide lights and junction boxes
      slab(b, 'lbg', uc, 0, v0 + 0.8, L - 0.6, 1.0, 0.35);
      fine(b, () => {
        for (let x = a + 0.8; x < c - 0.5; x += 1.2) b.cyl('glowWhite', x, 0.41, v0 + 0.8, 0.16, 0.12, { radial: 8 });
      });
      slab(b, 'dbg', c - 1.6, 0, v1 - 1.4, 2.4, 2.2, 0.9);
      slab(b, 'dbg', a + 1.6, 0, v1 - 1.2, 2.2, 1.8, 0.55);
      break;
    default:
      // maintenance hatch between two hinge blocks
      slab(b, 'dbg', uc, 0, vc, 3.2, 2.6, 0.45);
      slab(b, 'lbg', uc, 0.45, vc, 2.4, 1.8, 0.2);
      for (const x of [a + 0.7, c - 0.7]) slab(b, 'dbg', x, 0, vc, 0.8, 1.6, 0.7);
      fine(b, () => slab(b, 'gunmetal', uc, 0.65, vc, 1.0, 0.14, 0.14, 0.02));
      break;
  }
}

function hullHalf(b: Builder, cfg: Cfg, L: Styles, side: 1 | -1, out: HullOut): void {
  const D = cfg.D;
  const detailed = D && side > 0; // port side gets the hero greebles in the trench
  const seed = cfg.seed * 97 + 13; // same pattern both sides → symmetric build
  const minArea = D ? 0.3 : 0.08;
  if (!D) deckHalf1(b, L, seed);
  // ── dorsal wing ──
  const stripes = D ? STRIPES_LOD0 : STRIPES_LOD1;
  const WS = wingStrakes(L);
  const poly = DORSAL_PTS.map((p) => toLocal(FD, p));
  const wingStyle = (u: number, v: number): TStyle | null => {
    if (v < 1) return L.trim;
    if (v < 2 && u > 40) return L.trimD;
    if (nearStripe(stripes, u, v, 0)) return L.red;
    // flush margins: raised plates beside a stripe would shade it and hide it at grazing angles
    if (nearStripe(stripes, u, v, 2)) return L.trimW;
    // pads around the heavy turrets
    for (const [tu, tv] of TURRET_L) if (Math.abs(u - tu) < 5 && Math.abs(v - tv) < 5) return D ? L.plateD : L.panelD;
    if (mod(u, 32) < 1 && u > 24) return L.seam;
    if (D) return strakes(u, v - 2, seed + 3, 16, 6, WS) ?? L.field;
    return aztec(u, v - 2, seed + 3, 16, 6, (r) => (r < 0.52 ? L.panelL : r < 0.66 ? L.raisedL : r < 0.8 ? L.plateL : r < 0.9 ? L.raisedW : L.panelD)) ?? L.field;
  };
  const wingMask = (u: number, v: number): boolean => {
    const w = toWorld(FD, u, v);
    if (underNose(w.z) || inL1(w.x, w.y + 0.4, w.z, 0.2)) return true;
    if (Math.hypot(u - EMB[0], v - EMB[1]) < 7.49) return true;
    for (const [tu, tv] of TURRET_L) if (Math.hypot(u - tu, v - tv) < 3.6) return true;
    const [bu, bv] = toBand(u, v);
    if (D && bu > BAND_U0 - 0.7 && bu < BAND_U1 && bv < BAND_W - 0.8) return true;
    return bv < 0.45;
  };
  inFrame(b, FD, () => {
    packPanel(b, poly, { seed: seed + 2, module: 16, period: 5, studs: D, minArea, mask: wingMask, style: wingStyle });
    emblem(b, D);
    if (D) {
      scatter(b, {
        poly,
        u0: 40,
        u1: 398,
        v0: 0,
        v1: 80,
        cell: 7,
        p: (u, v) => {
          if (v < 4) return 0;
          const [bu, bv] = toBand(u, v);
          if (bu > BAND_U0 - 6 && bu < BAND_U1 + 30 && bv > BAND_W && bv < BAND_W + 16) return 0.55;
          return u > 150 ? 0.42 : 0.36;
        },
        style: wingStyle,
        mask: (u, v) => wingMask(u, v) || Math.hypot(u - EMB[0], v - EMB[1]) < 9.5 || nearStripe(stripes, u, v, 3),
        seed: seed + 40,
      });
    }
  });
  if (D) wingBand(b, seed);
  // heavy turbolaser turrets (DBY-827)
  for (let i = 0; i < TURRETS.length; i++) {
    const [x, z] = TURRETS[i];
    const y = dorsalY(x, z) + 0.4;
    if (side > 0) out.turretMuzzles.push([x + 1.1, y + 1.95, z + 10.4], [x - 1.1, y + 1.95, z + 10.4]);
    else out.turretMuzzles.push([-x + 1.1, y + 1.95, z + 10.4], [-x - 1.1, y + 1.95, z + 10.4]);
    b.at(x, y, z, () => heavyTurret(b, D, side));
  }
  // ── rim (upper hull side face) ──
  const rimPts: V3[] = [TIP, st(R0), st(R1)];
  const fR = faceFrame(rimPts, [1, 0, 0]);
  inFrame(b, fR, () => {
    const rp = rimPts.map((p) => toLocal(fR, p));
    const len = rp[1][0];
    const uWin = Math.ceil(len * 0.44);
    packPanel(b, rp, {
      seed: seed + 4,
      module: 16,
      period: 4,
      minArea,
      mask: (u, v) => underNose(toWorld(fR, u, v).z),
      style: (u, v) => {
        if (v < 1) return L.trimW;
        if (u < 30) return L.red;
        if (v < 2 && u > uWin) return L.black;
        return L.trim;
      },
    });
    if (D) litWindows(b, uWin + 2, len - 2, 1.5, 2, 0.8, h3(seed, 4, 1));
  });
  // ── trench ceiling (underside of the overhang) ──
  const ceilPts: V3[] = [TIP, st(R1), st(T0)];
  const fC = faceFrame(ceilPts, [0, -1, 0]);
  inFrame(b, fC, () =>
    packPanel(b, ceilPts.map((p) => toLocal(fC, p)), { seed: seed + 5, module: 16, minArea, mask: (u, v) => underNose(toWorld(fC, u, v).z), style: () => L.trench }),
  );
  // ── trench wall ──
  const wallPts: V3[] = [TIP, st(T0), st(T1)];
  const fW = faceFrame(wallPts, [1, 0, 0]);
  const wallLen = toLocal(fW, st(T0))[0];
  const hangarU: [number, number] = [wallLen - 70, wallLen - 42];
  inFrame(b, fW, () => {
    packPanel(b, wallPts.map((p) => toLocal(fW, p)), {
      seed: seed + 6,
      module: 8,
      period: 6,
      studs: D,
      minArea,
      mask: (u, v) => (u > hangarU[0] && u < hangarU[1]) || underNose(toWorld(fW, u, v).z),
      style: (u, v) => {
        const hgt = (7 * u) / wallLen;
        if (v < 1 && hgt > 2) return L.trimD;
        return (Math.floor(u / 8) + Math.floor(v / 2)) % 5 === 0 ? L.grilleD : L.trench;
      },
    });
    trenchGreebles(b, cfg, side, detailed, wallLen, hangarU, seed);
  });
  // ── trench floor ──
  const floorPts: V3[] = [TIP, st(T1), st(L0)];
  const fF = faceFrame(floorPts, [0, 1, 0]);
  inFrame(b, fF, () => {
    const fp = floorPts.map((p) => toLocal(fF, p));
    packPanel(b, fp, { seed: seed + 7, module: 12, minArea, mask: (u, v) => underNose(toWorld(fF, u, v).z), style: (u) => (Math.floor(u / 12) % 2 ? L.trenchL : L.trench) });
    // point-defence turrets along the trench floor
    const n = D ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const u = 110 + (i * (wallLen - 150)) / (n - 1);
      const vmax = u * (fp[2][1] / fp[2][0]);
      b.at(u, 0.4, vmax * 0.5, () => pdTurret(b, D));
    }
  });
  // ── lower side band ──
  const lowPts: V3[] = [TIP, st(L0), st(L1)];
  const fL = faceFrame(lowPts, [1, 0, 0]);
  inFrame(b, fL, () => {
    const lp = lowPts.map((p) => toLocal(fL, p));
    const len = lp[1][0];
    const uWin = Math.ceil(len * 0.56);
    packPanel(b, lp, {
      seed: seed + 8,
      module: 16,
      period: 4,
      minArea,
      mask: (u, v) => underNose(toWorld(fL, u, v).z),
      style: (u, v) => {
        if (v < 1) return L.trimD;
        if (u < 26) return L.red;
        if (v < 2 && u > uWin) return L.black;
        return L.trimW;
      },
    });
    if (D) litWindows(b, uWin + 2, len - 2, 1.5, 3, 0.6, h3(seed, 8, 1));
  });
  // ── ventral wing ──
  const venPts: V3[] = [TIP, st(L1), st(K1)];
  const fV = faceFrame(venPts, [0.3, -1, 0]);
  inFrame(b, fV, () => {
    packPanel(b, venPts.map((p) => toLocal(fV, p)), {
      seed: seed + 9,
      module: 24,
      period: 5,
      minArea,
      mask: (u, v) => underNose(toWorld(fV, u, v).z),
      style: (u, v) => {
        if (v < 1) return L.trim;
        if (u < 34) return L.red;
        if (mod(u, 48) < 1) return L.seamD;
        const a = aztec(u, v, seed + 10, 24, 8, (r) => (r < 0.55 ? L.ventralW : r < 0.8 ? L.ventralD : L.raisedL));
        return a ?? L.ventral;
      },
    });
  });
  // ── stern face (three convex pieces of the port half) ──
  const zf = ZS;
  const sternParts: V3[][] = [
    [
      [0, -3, zf],
      [96, -3, zf],
      [96, 2, zf],
      [18, 16, zf],
      [0, 16, zf],
    ],
    [
      [0, -10, zf],
      [90, -10, zf],
      [90, -3, zf],
      [0, -3, zf],
    ],
    [
      [0, -32, zf],
      [20, -32, zf],
      [93.5, -14, zf],
      [93.5, -10, zf],
      [0, -10, zf],
    ],
  ];
  // the superstructure's rear face stands on this plane from SUP_Y0 up: the stern grid is shifted so a
  // row boundary falls exactly there, and every cell behind the rear face is left out
  const behindL1 = (x: number, y: number) => y > SUP_Y0 && Math.abs(x) < SUP_REAR_HW - (offL1('side') * (y - SUP_Y0)) / (SUP_Y1 - SUP_Y0);
  sternParts.forEach((pts, i) => {
    tileFace(b, pts, {
      seed: seed + 20 + i,
      outward: [0, 0, -1],
      uDir: [1, 0, 0],
      module: 12,
      period: 3,
      studs: D,
      minArea,
      gridV: 0.6,
      worldMask: (p) => behindL1(p.x, p.y) || Math.abs(p.x) < 5,
      style: (u, v) => {
        const a = aztec(u, v, seed + 30, 12, 4, (r) => (r < 0.6 ? L.panelL : L.panelD));
        return a ?? (i === 1 ? L.trench : L.fieldL);
      },
    });
  });
}

function keel(b: Builder, cfg: Cfg, L: Styles): void {
  const D = cfg.D;
  const pts: V3[] = [TIP, st(K1), st(K1, -1)];
  const f = faceFrame(pts, [0, -1, 0], [0, K0[1] - TIP[1], ZS - ZT], [0, 0, 0]);
  const hangar: [number, number] = [150, 205];
  inFrame(b, f, () => {
    const poly = pts.map((p) => toLocal(f, p));
    packPanel(b, poly, {
      seed: cfg.seed * 31 + 5,
      module: 24,
      period: 4,
      studs: D,
      minArea: D ? 0.3 : 0.08,
      mask: (u, v) => underNose(toWorld(f, u, v).z),
      style: (u, v) => {
        const av = Math.abs(v);
        if (u < 34) return L.red;
        if (u > hangar[0] && u < hangar[1] && av < 7) {
          if (u < hangar[0] + 1 || u > hangar[1] - 1 || av > 6) return L.raisedD;
          return av < 0.5 ? L.black : L.panelD;
        }
        if (u > hangar[1] && u < hangar[1] + 12 && av < 6) return L.grilleDv;
        if (av < 3) return L.trimD;
        return L.ventral;
      },
    });
  });
}

/** red nose cap: stands 0.6 proud of the hull faces at its foot (the tiles under it are left out) */
function noseCap(b: Builder): void {
  const k = (ZT - NOSE_Z) / (ZT - ZS);
  const sec: P2[] = FULL_SECTION.map(([x, y]) => [x * k, y * k] as P2);
  const grown = offsetEdges(sec, sec.map(() => -0.6));
  b.add('darkRed', coneSolidMD([0, 0, ZT + 0.6], grown, NOSE_Z));
}

// ─── trench greebles ────────────────────────────────────────────────────────────────────────────

function trenchGreebles(b: Builder, cfg: Cfg, side: 1 | -1, detailed: boolean, wallLen: number, hangarU: [number, number], seed: number): void {
  const D = cfg.D;
  // trench height (v) and depth (y) at u
  const H = (u: number) => (7 * u) / wallLen;
  const Dp = (u: number) => (6 * u) / wallLen;
  const step = detailed ? 7 : D ? 14 : 28;
  for (let u0 = 70; u0 < wallLen - 4; u0 += step) {
    if (u0 + step > hangarU[0] - 1 && u0 < hangarU[1] + 1) continue;
    const h = H(u0), d = Dp(u0);
    if (h < 2.2) continue;
    const r = new Rng(Math.floor(h3(u0, 1, seed) * 1e9));
    // structural rib
    b.box('dbg', u0 + 0.5, Math.min(d * 0.5, 1.2) / 2 + 0.4, h / 2, 1, Math.min(d * 0.5, 1.2), h - 0.2, { hide: { ny: true } });
    if (!D) continue;
    const kind = Math.floor(h3(u0 % 49, 3, seed) * 5);
    const x0 = u0 + 1.2, x1 = u0 + step - 0.2;
    const dm = Math.min(d * 0.55, 2.2);
    if (kind === 0 || !detailed) {
      // pipe run
      const ny = h > 4.5 ? 2 : 1;
      for (let k = 0; k < ny; k++) b.cyl('gunmetal', (x0 + x1) / 2, 0.4 + 0.3, 1.2 + k * 1.6, 0.3, x1 - x0, { axis: 'x', radial: detailed ? 10 : 6 });
      if (detailed) for (let x = x0 + 1; x < x1; x += 2.5) b.box('lbg', x, 0.4 + 0.35, 1.2, 0.5, 0.7, 0.9);
    } else if (kind === 1) {
      // box stack
      let x = x0;
      while (x < x1 - 0.8) {
        const w = Math.min(x1 - x, r.pick([1, 2, 2, 3]));
        const hh = r.range(1, Math.max(1.2, h - 1.4));
        const dd = r.range(0.4, dm);
        b.box(r.pick<ColorKey>(['lbg', 'dbg', 'dbg', 'white', 'gunmetal']), x + w / 2, 0.4 + dd / 2, 0.8 + hh / 2, w - 0.08, dd, hh, { hide: { ny: true } });
        x += w;
      }
    } else if (kind === 2) {
      // lit window rows in a black band
      const rows = h > 5 ? 2 : 1;
      for (let k = 0; k < rows; k++) {
        const vy = 1.3 + k * 2;
        b.add('black', tileMD(x1 - x0, 1, 0.4, 0.03), T((x0 + x1) / 2, 0.4, vy));
        for (let x = x0 + 0.5; x < x1 - 0.4; x += 1.5) b.add('windowWarm', tileMD(0.8, 0.6, 0.45, 0.02), T(x, 0.4, vy));
      }
    } else if (kind === 3) {
      // grille panel + vents
      for (let x = x0; x < x1 - 1; x += 2) for (let vy = 0.8; vy < h - 1.2; vy += 1.1) grille(b, 'dbg', x + 1, 0.4, vy + 0.5, 1.9, 1, 0.4);
      b.cyl('lbg', (x0 + x1) / 2, 0.8 + dm * 0.3, h * 0.55, 0.9, dm * 0.6, { radial: 12 });
    } else {
      // tank + clamps
      const cy = Math.min(h * 0.5, 2.4);
      b.cyl('lbg', (x0 + x1) / 2, 0.4 + Math.min(1, dm / 2), cy, Math.min(1, dm / 2), x1 - x0 - 0.4, { axis: 'x', radial: 12 });
      for (let x = x0 + 1; x < x1; x += 2.2) b.box('dbg', x, 0.4 + Math.min(1, dm / 2), cy, 0.4, Math.min(2.2, dm + 0.2), 2.2);
    }
  }
  // side hangar bay (v runs down the wall from the ceiling; floor at v = hh)
  const [ha, hb] = hangarU;
  const hh = H(ha);
  const dF = (3.5 * ha) / wallLen;
  b.box('dbg', ha - 0.6, dF / 2, hh / 2, 1.2, dF, hh, { hide: { ny: true } });
  b.box('dbg', hb + 0.6, dF / 2, hh / 2, 1.2, dF, hh, { hide: { ny: true } });
  b.box('lbg', (ha + hb) / 2, dF / 2, 0.45, hb - ha + 2.4, dF, 0.9, { hide: { ny: true } });
  if (side > 0) {
    // open bay: lit back wall with ribs and control windows, ceiling lights, floor guide lines,
    // ray shield across the mouth
    const wallH = hh - 1.3;
    b.add('lbg', tileMD(hb - ha, wallH, 0.2, 0.02), T((ha + hb) / 2, 0, 0.9 + wallH / 2));
    for (let x = ha + 2; x < hb - 1; x += 3) b.box('dbg', x, 0.4, 0.9 + wallH / 2, 0.5, 0.4, wallH, { hide: { ny: true } });
    if (D) {
      for (let x = ha + 1; x < hb - 1.5; x += 1.5) b.add('windowWarm', tileMD(1.0, 0.45, 0.3, 0.02), T(x + 0.5, 0.05, 1.7));
      for (let x = ha + 1.5; x < hb - 1; x += 3) b.box('glowWhite', x, dF * 0.55, 0.95, 1.8, 0.35, 0.1, { c: 0 });
    } else b.add('windowWarm', tileMD(hb - ha - 2, 0.45, 0.3, 0.02), T((ha + hb) / 2, 0.05, 1.7));
    for (const y of [0.35, 0.75]) b.box('yellow', (ha + hb) / 2, dF * y, hh - 0.45, hb - ha - 1, 0.22, 0.08, { c: 0 });
    for (let x = ha + 3; x < hb - 2; x += 7) b.box('dbg', x, dF * 0.3, hh - 0.9, 1.2, 0.8, 0.9);
    b.add('trLightBlue', tileMD(hb - ha, hh - 1.3, 0.06, 0), T((ha + hb) / 2, dF - 0.1, 0.9 + (hh - 1.3) / 2));
  } else {
    for (let x = ha; x < hb - 0.1; x += 2) b.box('dbg', x + 1, dF * 0.45, 0.9 + (hh - 1.3) / 2, 1.94, 0.5, hh - 1.3, { hide: { ny: true } });
    b.box('yellow', (ha + hb) / 2, dF * 0.45 + 0.27, hh - 1.2, hb - ha - 0.4, 0.06, 0.3, { c: 0 });
  }
  // medium dual turbolaser in the forward trench, barrels toward the bow (−u)
  const um = 150;
  b.push();
  b.translate(um, 0.4, H(um) * 0.5);
  b.cyl('dbg', 0, 0.3, 0, 1.2, 0.6, { radial: 12 });
  b.box('lbg', 0, 1.0, 0, 2.0, 1.2, 1.6);
  b.box('dbg', -1.1, 1.0, 0, 0.4, 0.9, 1.4);
  for (const z of [-0.45, 0.45]) b.cyl('gunmetal', -2.6, 1.0, z, 0.16, 3.0, { axis: 'x', radial: 8 });
  b.pop();
}

interface WinOpts {
  y0?: number;
  h?: number;
  skip?: (u: number) => boolean;
}

/**
 * Row of small lit windows along u (on top of a black band tile row centred at v). Lod 0 only: at
 * fleet range a window is a fraction of a pixel, and a row of them sparkles as the ship moves.
 */
function litWindows(b: Builder, u0: number, u1: number, vc: number, step: number, w: number, s: number, key: ColorKey = 'windowWarm', o: WinOpts = {}): void {
  const md = tileMD(w, 0.42, o.h ?? 0.47, 0.02);
  const si = Math.floor(s * 1e6);
  for (let u = u0; u < u1; u += step) {
    if (h3(u * 4, vc * 10, si) < 0.2) continue;
    if (o.skip?.(u)) continue;
    b.add(key, md, T(u, o.y0 ?? 0, vc));
  }
}

// ─── turrets ────────────────────────────────────────────────────────────────────────────────────

function heavyTurret(b: Builder, D: boolean, side: 1 | -1): void {
  const rad = D ? 28 : 12;
  // pedestal: level column sunk into the sloped wing, turntable ring
  b.cyl('dbg', 0, -1.3, 0, 3.4, 2.6, { radial: rad, bottom: false });
  b.cyl('lbg', 0, 0.2, 0, 3.05, 0.4, { radial: rad });
  // housing: bevelled side profile (z, y) extruded across x, dark cheeks
  const prof: number[][] = [
    [-3.5, 0.4],
    [2.5, 0.4],
    [3.1, 1.3],
    [1.9, 2.9],
    [-2.7, 2.9],
    [-3.5, 2.1],
  ];
  b.push();
  b.rotateY(Math.PI / 2);
  b.prism('white', prof.map(([z, y]) => [-z, y]), 5.4);
  const cheek: number[][] = [
    [-3.2, 0.5],
    [2.3, 0.5],
    [2.8, 1.25],
    [1.8, 2.5],
    [-2.5, 2.5],
    [-3.2, 1.9],
  ];
  b.prism('dbg', cheek.map(([z, y]) => [-z, y]), 5.9);
  b.pop();
  // mantlet and twin barrels (muzzles at x = ±1.1, y = 1.95, z = 10.4: the battle's turret anchors)
  b.box('dbg', 0, 1.95, 2.7, 4.0, 1.6, 1.0);
  for (const x of [1.1, -1.1]) {
    b.cyl('dbg', x, 1.95, 3.9, 0.62, 2.0, { axis: 'z', radial: D ? 14 : 8 });
    b.cyl('gunmetal', x, 1.95, 7.0, 0.32, 6.6, { axis: 'z', radial: D ? 12 : 6 });
    b.cyl('flatSilver', x, 1.95, 10.1, 0.44, 0.6, { axis: 'z', radial: D ? 12 : 6 });
  }
  if (!D) return;
  // roof deck with a sensor block, a round hatch and an exhaust grille (footprints never overlap)
  const yr = 2.9 + PLATE;
  slab(b, 'lbg', 0, 2.9, -0.4, 3.4, 4.0, PLATE);
  slab(b, 'dbg', 1.0 * side, yr, 0.6, 1.0, 1.2, 0.6);
  b.cyl('lbg', -0.9 * side, yr + 0.11, -0.2, 0.55, 0.22, { radial: 14 });
  grille(b, 'dbg', 0, yr, -1.85, 2.4, 0.9, 0.35);
  // power unit behind the housing
  b.box('dbg', 0, 1.3, -3.9, 3.6, 1.8, 1.0);
  slab(b, 'lbg', 0, 2.2, -3.9, 2.8, 0.7, 0.3);
  fine(b, () => {
    for (const x of [1.1, -1.1]) for (const z of [5.4, 6.4, 7.4]) b.cyl('dbg', x, 1.95, z, 0.42, 0.3, { axis: 'z', radial: 12 });
    for (const s of [-1, 1]) b.cyl('gunmetal', s * 2.3, 1.0, -3.4, 0.16, 1.4, { axis: 'z', radial: 8 });
    b.cyl('flatSilver', 1.0 * side, yr + 1.2, 0.9, 0.07, 1.2, { radial: 6 });
  });
}

function pdTurret(b: Builder, D: boolean): void {
  b.cyl('dbg', 0, 0.2, 0, 0.9, 0.4, { radial: D ? 14 : 8 });
  b.box('lbg', 0, 0.85, 0, 1.4, 0.9, 1.4);
  if (D) dome(b, 'lbg', 0, 1.3, -0.1, 0.55, 0.4, 12);
  for (const x of [0.32, -0.32]) {
    b.cyl('gunmetal', x, 0.95, 1.4, 0.13, 2.0, { axis: 'z', radial: 6 });
    if (D) fine(b, () => b.cyl('dbg', x, 0.95, 2.3, 0.17, 0.25, { axis: 'z', radial: 8 }));
  }
}

// ─── round parts ────────────────────────────────────────────────────────────────────────────────

function discMD(r: number, h: number, seg: number): MeshData {
  const acc = new MeshAcc();
  const c = Math.min(0.06, h * 0.3);
  const rows = profile(
    [
      [0, h],
      [r - c, h],
      [r, h - c],
      [r, 0],
    ],
    35,
  );
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
    for (const s of rows) {
      const [r0, y0, nr0, ny0, r1, y1, nr1, ny1] = s;
      const p = (r_: number, y: number, a: number): V3 => [r_ * Math.sin(a), y, r_ * Math.cos(a)];
      const n = (nr: number, ny: number, a: number): V3 => [nr * Math.sin(a), ny, nr * Math.cos(a)];
      acc.quad(p(r0, y0, a0), p(r0, y0, a1), p(r1, y1, a1), p(r1, y1, a0), n(nr0, ny0, a0), n(nr0, ny0, a1), n(nr1, ny1, a1), n(nr1, ny1, a0));
    }
  }
  return acc.done();
}

/** Curved tile (annular sector) lying in XZ, bottom y = 0. */
function arcMD(r0: number, r1: number, h: number, a0: number, a1: number, seg: number): MeshData {
  const acc = new MeshAcc();
  const P = (r: number, a: number, y: number): V3 => [r * Math.sin(a), y, r * Math.cos(a)];
  for (let k = 0; k < seg; k++) {
    const t0 = a0 + ((a1 - a0) * k) / seg, t1 = a0 + ((a1 - a0) * (k + 1)) / seg;
    acc.quad(P(r0, t0, h), P(r1, t0, h), P(r1, t1, h), P(r0, t1, h), [0, 1, 0]);
    const no0: V3 = [Math.sin(t0), 0, Math.cos(t0)], no1: V3 = [Math.sin(t1), 0, Math.cos(t1)];
    acc.quad(P(r1, t0, 0), P(r1, t1, 0), P(r1, t1, h), P(r1, t0, h), no0, no1, no1, no0);
    const ni0: V3 = [-no0[0], 0, -no0[2]], ni1: V3 = [-no1[0], 0, -no1[2]];
    acc.quad(P(r0, t0, 0), P(r0, t1, 0), P(r0, t1, h), P(r0, t0, h), ni0, ni1, ni1, ni0);
  }
  for (const [t, s] of [
    [a0, -1],
    [a1, 1],
  ] as const) {
    const nn: V3 = [Math.cos(t) * s, 0, -Math.sin(t) * s];
    acc.quad(P(r0, t, 0), P(r1, t, 0), P(r1, t, h), P(r0, t, h), nn);
  }
  return acc.done();
}

// ─── superstructure ─────────────────────────────────────────────────────────────────────────────

const to3 = (p: P2, y: number): V3 => [p[0], y, p[1]];

interface FrustumOut {
  top: P2[];
  faces: V3[][];
}
function frustum(bottom: P2[], y0: number, off: number[], y1: number): FrustumOut {
  const B = ccw(bottom);
  const top = offsetEdges(B, off);
  const faces: V3[][] = [];
  for (let i = 0; i < B.length; i++) {
    const i1 = (i + 1) % B.length;
    faces.push([to3(B[i], y0), to3(B[i1], y0), to3(top[i1], y1), to3(top[i], y1)]);
  }
  return { top, faces };
}

function faceOut(face: V3[], center: V3): V3 {
  let x = 0, y = 0, z = 0;
  for (const p of face) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  return [x / face.length - center[0], y / face.length - center[1], z / face.length - center[2]];
}

type EdgeKind = 'front' | 'rear' | 'side' | 'bevel';
/** classify the edges of a CCW [x, z] footprint by their outward normals */
function edgeKinds(P: P2[]): EdgeKind[] {
  return P.map((p, i) => {
    const q = P[(i + 1) % P.length];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const l = Math.hypot(dx, dz) || 1;
    const nx = dz / l, nz = -dx / l;
    if (nz > 0.95) return 'front';
    if (nz < -0.95) return 'rear';
    if (Math.abs(nx) > 0.95) return 'side';
    return nz > 0 ? 'bevel' : 'side';
  });
}

/** solid inside a tiled frustum so every seam shows shadow (or, far away, the face colour), never a hole */
function hiddenCore(b: Builder, bottom: P2[], y0: number, top: P2[], y1: number, d = 0.45, key: ColorKey = 'dbg'): void {
  const B = ccw(bottom);
  const off = B.map(() => d);
  b.add(key, frustumMD(offsetEdges(B, off), y0, offsetEdges(top, off), y1 - d));
}

/** u-range of a convex local polygon along the line v = vc */
function spanAt(P: P2[], vc: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], c = P[(i + 1) % P.length];
    if ((a[1] - vc) * (c[1] - vc) > 0) continue;
    if (Math.abs(c[1] - a[1]) < 1e-9) {
      lo = Math.min(lo, a[0], c[0]);
      hi = Math.max(hi, a[0], c[0]);
      continue;
    }
    const u = a[0] + ((c[0] - a[0]) * (vc - a[1])) / (c[1] - a[1]);
    lo = Math.min(lo, u);
    hi = Math.max(hi, u);
  }
  return lo < hi ? [lo, hi] : null;
}

interface BandOpts {
  seed: number;
  outward: V3;
  module: number;
  period?: number;
  studs: boolean;
  minArea?: number;
  /** lift of every tile of the face (keeps a face off a coplanar neighbour) */
  lift?: number;
  /** rows (v, integer) that are black window bands */
  bands: number[];
  /** lit windows on the bands (lod 0; the far LODs keep plain bands) */
  lit: boolean;
  winKey?: ColorKey;
  step: number;
  w: number;
  win?: WinOpts;
  style: (u: number, v: number) => TStyle | null;
}
/** lit windows along each band row of a face polygon (face-frame coordinates) */
function bandWindows(b: Builder, poly: P2[], o: BandOpts): void {
  const lift = o.lift ?? 0;
  for (const v0 of o.bands) {
    const a = spanAt(poly, v0 + 0.05), c = spanAt(poly, v0 + 0.95);
    if (!a || !c) continue;
    litWindows(b, Math.max(a[0], c[0]) + 1.2, Math.min(a[1], c[1]) - 1.2, v0 + 0.5, o.step, o.w, h3(o.seed, v0, 3), o.winKey, { ...o.win, y0: (o.win?.y0 ?? 0) + lift });
  }
}
/** tile a planar face whose black band rows carry small lit windows */
function bandedFace(b: Builder, face: V3[], o: BandOpts): Frame {
  const f = tileFace(b, face, { seed: o.seed, outward: o.outward, module: o.module, period: o.period, studs: o.studs, minArea: o.minArea, lift: o.lift, style: o.style });
  if (!o.lit || !o.bands.length) return f;
  const poly = face.map((p) => toLocal(f, p));
  inFrame(b, f, () => bandWindows(b, poly, o));
  return f;
}

/** tile a planar face with a style / mask that see each cell's world point */
function tileFaceW(
  b: Builder,
  pts: V3[],
  o: { seed: number; outward: V3; uDir?: V3; module?: number; period?: number; studs?: boolean; minArea?: number; styleW: (w: Vector3) => TStyle | null; maskW?: (w: Vector3) => boolean },
): Frame {
  const f = faceFrame(pts, o.outward, o.uDir);
  const poly = pts.map((p) => toLocal(f, p));
  const maskW = o.maskW;
  inFrame(b, f, () =>
    packPanel(b, poly, {
      seed: o.seed,
      module: o.module,
      period: o.period,
      studs: o.studs,
      minArea: o.minArea,
      style: (u, v) => o.styleW(toWorld(f, u, v)),
      mask: maskW ? (u, v) => maskW(toWorld(f, u, v)) : undefined,
    }),
  );
  return f;
}

type Item = [number, number, number];
/** is (x, z) on the square pad (half size r, grown by g) of one of the items? */
const onItem = (items: Item[], x: number, z: number, g: number) => items.some(([ix, iz, r]) => Math.abs(x - ix) < r + g && Math.abs(z - iz) < r + g);

const PD_L1: [number, number][] = [
  [20, -100],
  [31, -150],
  [36, -176],
];
const DOMES_L1: [number, number][] = [[8, -84]];

function superstructure(b: Builder, cfg: Cfg, L: Styles, anchors: Record<string, V3>): void {
  const D = cfg.D;
  const seed = cfg.seed * 53 + 7;
  const core: ColorKey = D ? 'dbg' : 'lbg';
  const minArea = D ? 0.3 : 0.08;
  const FP = facePlates(L);
  // ── level 1: long wedge over the aft third, raked front, sloped flanks, vertical stern ──
  const k1 = edgeKinds(SUP_BOTTOM);
  const L1f = frustum(SUP_BOTTOM, SUP_Y0, k1.map(offL1), SUP_Y1);
  hiddenCore(b, SUP_BOTTOM, SUP_Y0, L1f.top, SUP_Y1, 0.45, core);
  const c1: V3 = [0, (SUP_Y0 + SUP_Y1) / 2, (SUP_FRONT_Z + ZS) / 2];
  L1f.faces.forEach((face, i) => {
    const k = k1[i];
    const bands = BANDS_L1(k);
    const top = k === 'front' ? 23 : 17;
    const pil = k === 'front' ? 8 : 12;
    const isPil = (u: number) => D && k !== 'rear' && u > 2 && mod(u, pil) < 1;
    bandedFace(b, face, {
      seed: seed + i,
      outward: faceOut(face, c1),
      module: 12,
      period: 4,
      studs: D,
      minArea,
      // the rear face stands on the stern plane: a hair proud of it, so the two can never z-fight
      lift: k === 'rear' ? 0.06 : 0,
      bands,
      lit: D,
      step: 2,
      w: 0.8,
      win: { h: 0.3, skip: (u) => mod(u + 0.45, pil) < 1.9 },
      style: (u, v) => {
        if (v < 1.5) return L.trimD;
        if (k === 'rear') return aztec(u, v, seed + 9, 12, 4, (r) => (r < 0.6 ? L.panelL : L.panelD)) ?? L.fieldL;
        const r = Math.floor(v);
        if (v < top && isPil(u)) return L.pilaster;
        if (bands.includes(r)) return D ? L.winBand : L.black;
        if (bands.includes(r - 1)) return D ? L.header : L.trimD;
        if (D && bands.includes(r + 1)) return L.sill;
        if (v >= top) return L.trim;
        if (D) return plating(u, v, seed + 10 + i, 12, 5, FP) ?? L.field;
        return aztec(u, v, seed + 10 + i, 12, 5, (q) => (q < 0.55 ? L.panelL : q < 0.75 ? L.raisedL : L.plateL)) ?? L.field;
      },
    });
  });
  const inL2 = (x: number, z: number, m = 0.4) => {
    if (z > L2_FRONT_Z - m) return false;
    const kk = (z - L2_FRONT_Z) / (ZS - L2_FRONT_Z);
    return Math.abs(x) < 18 + 16 * kk - m;
  };
  if (D) l1RoofD(b, L, L1f.top, seed, inL2);
  else {
    tileFace(b, L1f.top.map((p) => to3(p, SUP_Y1)), {
      seed: seed + 20,
      outward: [0, 1, 0],
      uDir: [0, 0, -1],
      module: 12,
      period: 3,
      studs: false,
      worldMask: (p) => inL2(p.x, p.z),
      style: (u, v) => {
        if (u < 1) return L.trimD;
        if (u < 3) return L.grilleD;
        return aztec(u, v + 40, seed + 21, 12, 6, (r) => (r < 0.4 ? L.plateL : r < 0.7 ? L.panelD : L.grilleD)) ?? L.fieldL;
      },
    });
    for (const [x, z] of PD_L1) for (const sx of [1, -1]) b.at(x * sx, SUP_Y1 + 0.4, z, () => pdTurret(b, false));
  }
  // ── level 2 ──
  const k2 = edgeKinds(L2_BOTTOM);
  const L2f = frustum(L2_BOTTOM, SUP_Y1, k2.map(offL2), SUP2_Y1);
  hiddenCore(b, L2_BOTTOM, SUP_Y1, L2f.top, SUP2_Y1, 0.45, core);
  const c2: V3 = [0, (SUP_Y1 + SUP2_Y1) / 2, -150];
  L2f.faces.forEach((face, i) => {
    const k = k2[i];
    const bands = k === 'rear' ? [] : [3];
    const isPil = (u: number) => D && k !== 'rear' && u > 1 && mod(u, 6) < 1;
    bandedFace(b, face, {
      seed: seed + 30 + i,
      outward: faceOut(face, c2),
      module: 8,
      period: 3,
      studs: D,
      minArea,
      lift: k === 'rear' ? 0.06 : 0,
      bands,
      lit: D,
      winKey: 'windowCool',
      step: 1.5,
      w: 0.6,
      win: { h: 0.3, skip: (u) => mod(u + 0.35, 6) < 1.7 },
      style: (u, v) => {
        if (v < 1) return L.trimD;
        if (isPil(u)) return L.pilaster;
        const r = Math.floor(v);
        if (bands.includes(r)) return D ? L.winBand : L.black;
        if (D && bands.includes(r - 1)) return L.header;
        if (D && bands.includes(r + 1)) return L.sill;
        return k === 'rear' ? L.fieldL : aztec(u, v, seed + 31 + i, 8, 3, (q) => (q < 0.6 ? L.panelL : L.raisedW)) ?? L.field;
      },
    });
  });
  const TF = ccw(TOWER_FOOT);
  const inTower = (x: number, z: number) => inConvex(TF, Math.abs(x), z, 0.3);
  const inNeck = (x: number, z: number) => inConvex(NECK, x, z, 0.3);
  if (D) l2RoofD(b, L, L2f.top, seed, inTower, inNeck);
  else {
    tileFace(b, L2f.top.map((p) => to3(p, SUP2_Y1)), {
      seed: seed + 40,
      outward: [0, 1, 0],
      uDir: [0, 0, -1],
      module: 8,
      studs: false,
      worldMask: (p) => inTower(p.x, p.z) || inNeck(p.x, p.z),
      style: (u, v) => {
        if (u < 1) return L.trimD;
        return aztec(u, v, seed + 41, 8, 4, (r) => (r < 0.45 ? L.plateL : r < 0.7 ? L.grilleL : L.panelD)) ?? L.fieldL;
      },
    });
  }
  // ── connecting block between the towers ──
  const neck = frustum(NECK, SUP2_Y1, edgeKinds(NECK).map(offNeck), NECK_Y);
  hiddenCore(b, NECK, SUP2_Y1, neck.top, NECK_Y, 0.45, core);
  const cn: V3 = [0, SUP2_Y1 + 2.5, -168];
  neck.faces.forEach((face, i) =>
    bandedFace(b, face, {
      seed: seed + 50 + i,
      outward: faceOut(face, cn),
      module: 6,
      studs: D,
      minArea,
      bands: [2],
      lit: D,
      winKey: 'windowCool',
      step: 1.5,
      w: 0.6,
      win: { h: 0.3 },
      style: (_u, v) => (v < 1 ? L.trimD : v >= 2 && v < 3 ? (D ? L.winBand : L.black) : D && v >= 3 && v < 4 ? L.header : L.fieldL),
    }),
  );
  if (D) neckTopD(b, L, neck.top, seed);
  else {
    tileFace(b, neck.top.map((p) => to3(p, NECK_Y)), {
      seed: seed + 55,
      outward: [0, 1, 0],
      uDir: [0, 0, 1],
      studs: false,
      style: (u, v) => (Math.abs(v - 5.3) < 1 ? L.grilleD : h3(Math.floor(u / 3), Math.floor(v / 3), seed + 56) < 0.3 ? L.plateL : L.fieldL),
    });
  }
  // ── towers ──
  for (const sx of [1, -1] as const) {
    b.push();
    if (sx < 0) b.mirrorX();
    tower(b, cfg, L, TOWER_FOOT, seed + 100, sx);
    b.pop();
    anchors[sx > 0 ? 'bridgeL' : 'bridgeR'] = [TOWER_X * sx, BRIDGE_Y[3] + 0.4, -164];
  }
}

/** level-1 roof, lod 0: front vents, centre spine, seams, two-tier plating, greebles, turrets and domes */
function l1RoofD(b: Builder, L: Styles, top: P2[], seed: number, inL2: (x: number, z: number) => boolean): void {
  const z0 = SUP_FRONT_Z - offL1('front');
  // u aft from the front edge, v = x
  const fr = makeFrame([0, SUP_Y1, z0], [0, 0, -1], [0, 1, 0], [0, 1, 0], [1, SUP_Y1, z0]);
  const poly = top.map((p) => toLocal(fr, to3(p, SUP_Y1)));
  const items: Item[] = [];
  for (const [x, z] of PD_L1) for (const sx of [1, -1]) items.push([x * sx, z, 1.7]);
  for (const [x, z] of DOMES_L1) for (const sx of [1, -1]) items.push([x * sx, z, 3.0]);
  const RP = roofPlates(L);
  const style = (u: number, v: number): TStyle | null => {
    if (u < 1) return L.trimD;
    if (u < 3) return L.grilleD;
    if (onItem(items, v, z0 - u, 0)) return L.pad;
    if (Math.abs(v) < 1.5) return L.raisedD;
    if (mod(u, 8) < 1) return L.seamD;
    return plating(u, v, seed + 21, 8, 6, RP) ?? L.fieldL;
  };
  const mask = (u: number, v: number) => inL2(v, z0 - u);
  inFrame(b, fr, () => {
    packPanel(b, poly, { seed: seed + 20, module: 8, period: 5, studs: true, minArea: 0.3, mask, style });
    scatter(b, {
      poly,
      u0: 3,
      u1: 125,
      v0: -42,
      v1: 42,
      cell: 6,
      p: (u) => (u < 46 ? 0.62 : 0.42),
      style,
      mask: (u, v) => mask(u, v) || onItem(items, v, z0 - u, 1.2) || Math.abs(v) < 2.5,
      seed: seed + 23,
    });
  });
  for (const [x, z] of PD_L1) for (const sx of [1, -1]) b.at(x * sx, SUP_Y1 + PLATE, z, () => pdTurret(b, true));
  for (const [x, z] of DOMES_L1) for (const sx of [1, -1]) sensorDome(b, x * sx, SUP_Y1 + PLATE, z, 2.0, 1.9);
}

/** level-2 roof, lod 0: front vents, seams, plating, greebles, the big sensor dome and two masts */
function l2RoofD(b: Builder, L: Styles, top: P2[], seed: number, inTower: (x: number, z: number) => boolean, inNeck: (x: number, z: number) => boolean): void {
  const z0 = L2_FRONT_Z - offL2('front');
  const fr = makeFrame([0, SUP2_Y1, z0], [0, 0, -1], [0, 1, 0], [0, 1, 0], [1, SUP2_Y1, z0]);
  const poly = top.map((p) => toLocal(fr, to3(p, SUP2_Y1)));
  const items: Item[] = [
    [0, -131, 3.0],
    [11, -123, 1.4],
    [-11, -123, 1.4],
  ];
  const RP = roofPlates(L);
  const style = (u: number, v: number): TStyle | null => {
    if (u < 1) return L.trimD;
    if (u < 3) return L.grilleD;
    if (onItem(items, v, z0 - u, 0)) return L.pad;
    if (mod(u, 6) < 1) return L.seamD;
    return plating(u, v, seed + 41, 6, 4, RP) ?? L.fieldL;
  };
  const mask = (u: number, v: number) => inTower(v, z0 - u) || inNeck(v, z0 - u);
  inFrame(b, fr, () => {
    packPanel(b, poly, { seed: seed + 40, module: 6, period: 5, studs: true, minArea: 0.3, mask, style });
    scatter(b, {
      poly,
      u0: 3,
      u1: 70,
      v0: -36,
      v1: 36,
      cell: 5,
      p: (u) => (u < 22 ? 0.65 : 0.45),
      style,
      mask: (u, v) => mask(u, v) || onItem(items, v, z0 - u, 1.0),
      seed: seed + 43,
    });
  });
  sensorDome(b, 0, SUP2_Y1 + PLATE, -131, 2.2, 2.0);
  for (const sx of [1, -1]) mast(b, 11 * sx, SUP2_Y1 + PLATE, -123, 3.0);
}

/** top of the block between the towers, lod 0: edge vents, plating, greebles, lattice mast, dome */
function neckTopD(b: Builder, L: Styles, top: P2[], seed: number): void {
  const z0 = -184;
  // u forward from the rear edge, v = x
  const fr = makeFrame([0, NECK_Y, z0], [0, 0, 1], [0, 1, 0], [0, 1, 0], [1, NECK_Y, z0]);
  const poly = top.map((p) => toLocal(fr, to3(p, NECK_Y)));
  const items: Item[] = [
    [0, -178, 1.6],
    [0, -161, 2.6],
  ];
  const RP = roofPlates(L);
  const style = (u: number, v: number): TStyle | null => {
    if (u < 1) return L.trimD;
    if (Math.abs(v) > 4.2) return L.grilleD;
    if (onItem(items, v, z0 + u, 0)) return L.pad;
    if (mod(u, 6) < 1) return L.seamD;
    return plating(u, v + 8, seed + 56, 6, 4, RP) ?? L.fieldL;
  };
  inFrame(b, fr, () => {
    packPanel(b, poly, { seed: seed + 55, module: 6, studs: true, minArea: 0.3, style });
    scatter(b, {
      poly,
      u0: 1,
      u1: 30,
      v0: -5,
      v1: 5,
      cell: 4,
      p: () => 0.7,
      style,
      mask: (u, v) => onItem(items, v, z0 + u, 0.8),
      seed: seed + 57,
      kinds: ['box', 'vent', 'hatch', 'stack', 'fins'],
    });
  });
  // the fighters thread the tower gap just above this: beacon top at 42.8
  mast(b, 0, NECK_Y + PLATE, -178, 4.6);
  sensorDome(b, 0, NECK_Y + PLATE, -161, 1.7, 1.6);
}

function tower(b: Builder, cfg: Cfg, L: Styles, foot: P2[], seed: number, sx: 1 | -1): void {
  const D = cfg.D;
  const minArea = D ? 0.3 : 0.08;
  const F = ccw(foot);
  const kinds = edgeKinds(F);
  // rear nearly vertical, flanks slightly battered, raked leading edge
  const tw = frustum(F, SUP2_Y1, kinds.map(offTower), TOWER_Y1);
  const ct: V3 = [TOWER_X, (SUP2_Y1 + TOWER_Y1) / 2, -164];
  hiddenCore(b, F, SUP2_Y1, tw.top, TOWER_Y1 + 0.4, 0.45, D ? 'dbg' : 'lbg');
  const FP = facePlates(L);
  tw.faces.forEach((face, i) => {
    const k = kinds[i];
    const o = faceOut(face, ct);
    if (k === 'front') {
      // leading edge: louvres up the nose
      tileFace(b, face, { seed: seed + i, outward: o, module: 4, studs: D, minArea, style: (_u, v) => (v < 1 ? L.trimD : !D ? L.grilleDv : Math.floor(v) % 2 ? L.louvreB : L.louvre) });
      return;
    }
    // window bands with sills, headers and pilasters between white panelling (the rear faces, which
    // the long take looks straight at through the tower gap, get four bands at lod 0)
    const rear = k === 'rear';
    const bands = D && rear ? [4, 9, 14, 18] : BANDS_TOWER(k);
    const pil = rear ? 4 : 6;
    const isPil = (u: number) => D && u > 1 && mod(u, pil) < 1;
    bandedFace(b, face, {
      seed: seed + i,
      outward: o,
      module: 6,
      period: 4,
      studs: D,
      minArea,
      bands,
      lit: D,
      step: rear ? 1.5 : 2,
      w: 0.6,
      win: { h: 0.3, skip: (u) => mod(u + 0.35, pil) < 1.7 },
      style: (u, v) => {
        if (v < 1) return L.trimD;
        const r = Math.floor(v);
        if (isPil(u)) return L.pilaster;
        if (bands.includes(r)) return D ? L.winBand : L.black;
        if (bands.includes(r - 1)) return D ? L.header : L.trim;
        if (bands.includes(r + 1)) return D ? L.sill : L.trim;
        if (k === 'rear') return aztec(u, v, seed + 5, 6, 3, (q) => (q < 0.5 ? L.panelL : L.panelD)) ?? L.fieldL;
        if (D) return plating(u, v, seed + 7 + i, 6, 3, FP) ?? L.field;
        return aztec(u, v, seed + 7 + i, 6, 2, (q) => (q < 0.6 ? L.panelL : L.raisedW)) ?? L.field;
      },
    });
  });
  // corner columns cover the cropped tile ends along every edge of the leaning tower
  if (D) for (let j = 0; j < F.length; j++) rod(b, 'lbg', to3(F[j], SUP2_Y1), to3(tw.top[j], TOWER_Y1), 0.34, 12);
  bridge(b, cfg, L, tw, seed, sx);
}

function bridge(b: Builder, cfg: Cfg, L: Styles, tw: FrustumOut, seed: number, sx: 1 | -1): void {
  const D = cfg.D;
  const minArea = D ? 0.3 : 0.08;
  const core: ColorKey = D ? 'dbg' : 'lbg';
  const [y0, y1, y2, y3] = BRIDGE_Y;
  const X = TOWER_X;
  const plan = BRIDGE_PLAN;
  const pk = edgeKinds(plan);
  // underside flare: from tower-top size to the plan
  const under = offsetEdges(plan, plan.map(() => 3.2));
  // tower top cap around the bridge's underside
  tileFace(b, tw.top.map((p) => to3(p, TOWER_Y1)), {
    seed: seed + 15,
    outward: [0, 1, 0],
    uDir: [0, 0, 1],
    studs: D,
    minArea,
    worldMask: (p) => inConvex(under, p.x, p.z),
    style: () => L.plateL,
  });
  const cb: V3 = [X, (y0 + y3) / 2, -165];
  const flare = frustum(under, y0, under.map(() => -3.2), y1);
  b.add(core, frustumMD(under, y0, plan, y1));
  flare.faces.forEach((face, i) => {
    const o = faceOut(face, [cb[0], y1 + 2, cb[2]]);
    tileFace(b, face, {
      seed: seed + 20 + i,
      outward: o,
      module: 6,
      minArea,
      style: (u, v) => (v < 1 ? L.trimD : D ? (mod(u, 3) < 1 ? L.raisedD : L.panelL) : Math.floor(u) % 6 === 0 ? L.panelD : L.panelL),
    });
  });
  if (D) bridgeUnderside(b, L, tw, under, seed);
  // body: panoramic windows on the three front faces, small windows around the rest
  const body = frustum(plan, y1, plan.map(() => 0), y2);
  b.add(core, frustumMD(offsetEdges(plan, plan.map(() => 0.45)), y1, offsetEdges(plan, plan.map(() => 0.45)), y2));
  body.faces.forEach((face, i) => {
    const o = faceOut(face, cb);
    const front = pk[i] === 'front' || pk[i] === 'bevel';
    bandedFace(b, face, {
      seed: seed + 30 + i,
      outward: o,
      module: 6,
      period: 3,
      studs: false,
      minArea,
      bands: front ? [] : [1],
      lit: D,
      winKey: 'windowCool',
      step: 1.25,
      w: 0.55,
      win: { h: 0.3 },
      style: (u, v) => {
        // lod 0: the rows around the windows alternate light-grey and white panels
        const alt = D && mod(u, 6) < 3;
        if (v < 1) return alt ? L.panelL : L.trimW;
        if (v < 2.4 && (front || v < 2)) return front || !D ? L.black : L.winBand;
        return alt && !front ? L.panelL : L.trimW;
      },
    });
    if (front) panoramic(b, face, o, D);
  });
  if (D) {
    // deck ledges: a dark one where the flare meets the body, a light one under the roof
    const ring = (key: ColorKey, out: number, ya: number, yb: number) => {
      const p = offsetEdges(plan, plan.map(() => -out));
      b.add(key, frustumMD(p, ya, p, yb));
    };
    ring('dbg', 0.65, y1 - 0.05, y1 + 0.35);
    ring('lbg', 0.55, y2 - 0.3, y2 + 0.05);
  }
  // roof: sloped rim with vents, flat deck on top
  const roof = frustum(plan, y2, plan.map(() => 1.3), y3);
  b.add(core, frustumMD(plan, y2, roof.top, y3 - 0.4));
  roof.faces.forEach((face, i) =>
    tileFace(b, face, {
      seed: seed + 40 + i,
      outward: faceOut(face, [cb[0], y2 - 3, cb[2]]),
      module: 6,
      minArea,
      style: D ? (u, v) => (v < 1 ? L.trim : mod(u, 6) < 1 ? L.grilleD : L.fieldL) : () => L.fieldL,
    }),
  );
  if (!D) {
    tileFaceW(b, roof.top.map((p) => to3(p, y3)), {
      seed: seed + 50,
      outward: [0, 1, 0],
      uDir: [0, 0, 1],
      module: 6,
      studs: false,
      minArea,
      styleW: (w) => (h3(Math.floor(w.x / 3), Math.floor(w.z / 3), seed + 51) < 0.25 ? L.plateL : L.fieldL),
    });
    return;
  }
  const items: Item[] = [
    [X - 4 * sx, -160, 1.9],
    [X + 3 * sx, -172, 1.0],
    [X + 1.2 * sx, -174.5, 0.9],
    [X - 2 * sx, -174, 0.9],
    [X, -167.5, 2.0],
  ];
  // u forward from the rear edge, v = x − X
  const fr = makeFrame([X, y3, -180], [0, 0, 1], [0, 1, 0], [0, 1, 0], [X + 1, y3, -180]);
  const poly = roof.top.map((p) => toLocal(fr, to3(p, y3)));
  const RP = roofPlates(L);
  const style = (u: number, v: number): TStyle | null => {
    if (onItem(items, X + v, u - 180, 0)) return L.pad;
    if (mod(u, 6) < 1) return L.seamD;
    return plating(u, v + 12, seed + 52, 6, 4, RP) ?? L.fieldL;
  };
  inFrame(b, fr, () => {
    packPanel(b, poly, { seed: seed + 50, module: 6, period: 5, studs: true, minArea, style });
    scatter(b, {
      poly,
      u0: 0,
      u1: 30,
      v0: -10,
      v1: 10,
      cell: 4,
      p: () => 0.6,
      style,
      mask: (u, v) => onItem(items, X + v, u - 180, 1.0),
      seed: seed + 53,
      kinds: ['box', 'vent', 'hatch', 'cap', 'panel', 'fins'],
    });
  });
  const yt = y3 + PLATE;
  // sensor globe on a short column
  b.cyl('lbg', X - 4 * sx, yt + 0.4, -160, 0.45, 0.8, { radial: 12 });
  b.add('white', sphere(1.25, 20, 12), T(X - 4 * sx, yt + 1.9, -160));
  // antenna array with a beacon on the tallest mast
  for (const [ax, az, h] of [
    [X + 3 * sx, -172, 4.4],
    [X + 1.2 * sx, -174.5, 3.2],
    [X - 2 * sx, -174, 2.8],
  ]) {
    slab(b, 'dbg', ax, yt, az, 1.2, 1.2, 0.45);
    fine(b, () => b.cyl('flatSilver', ax, yt + 0.45 + h / 2, az, 0.13, h, { radial: 8 }));
  }
  micro(b, () => lamp(b, 'glowRed', X + 3 * sx, yt + 0.45 + 4.4, -172, 0.14, 0.18));
  slab(b, 'dbg', X, yt, -167.5, 3.0, 2.0, 0.6);
  slab(b, 'lbg', X, yt + 0.6, -167.5, 2.0, 1.2, 0.3);
}

/** glowing panoramic bridge windows behind dark glass: lit backing, mullions, visor lip */
function panoramic(b: Builder, face: V3[], o: V3, D: boolean): void {
  const f = faceFrame(face, o);
  const lenU = toLocal(f, face[1])[0];
  inFrame(b, f, () => {
    b.add('windowCool', tileMD(lenU - 0.6, 1.1, 0.22, 0.02), T(lenU / 2, 0.36, 1.7));
    if (D) {
      fine(b, () => {
        for (let u = 1; u < lenU - 0.5; u += 1) slab(b, 'dbg', u, 0.2, 1.7, 0.14, 1.2, 0.62, 0.01);
      });
      slab(b, 'dbg', lenU / 2, PLATE, 2.45, lenU - 0.3, 0.32, 0.3);
    }
    b.add('trBlack', tileMD(lenU - 0.4, 1.4, 0.12, 0.01), T(lenU / 2, 0.62, 1.7));
  });
}

/** underside of the bridge overhang (lod 0): hanging tiles with ribs, service blocks and lamps over the tower gap */
function bridgeUnderside(b: Builder, L: Styles, tw: FrustumOut, under: P2[], seed: number): void {
  const TT = ccw(tw.top);
  const f = tileFaceW(b, under.map((p) => to3(p, BRIDGE_Y[0])), {
    seed: seed + 60,
    outward: [0, -1, 0],
    uDir: [0, 0, 1],
    module: 6,
    minArea: 0.3,
    maskW: (w) => inConvex(TT, w.x, w.z),
    styleW: (w) => (mod(w.z, 4) < 1 ? L.raisedD : L.panelL),
  });
  inFrame(b, f, () => {
    for (let z = -175; z < -154; z += 3.5) {
      const p = toLocal(f, [8.6, BRIDGE_Y[0], z]);
      slab(b, 'dbg', p[0], 2 * PLATE, p[1], 1.4, 1.0, 0.45);
      fine(b, () => slab(b, 'glowWhite', p[0], 2 * PLATE + 0.45, p[1], 0.8, 0.4, 0.1, 0.02));
    }
  });
}

// ─── engines ────────────────────────────────────────────────────────────────────────────────────

interface EngineSpec {
  x: number;
  y: number;
  r: number;
  len: number;
}
const ENGINES: EngineSpec[] = [
  { x: 15, y: -17, r: 10.5, len: 14 },
  { x: 37.5, y: -14.5, r: 10.5, len: 14 },
  { x: 57, y: -12, r: 7, len: 11 },
  { x: 70, y: -8, r: 4, len: 8 },
  { x: 70, y: -15.5, r: 4, len: 8 },
];

function engines(b: Builder, cfg: Cfg): void {
  const D = cfg.D;
  const rad = D ? 32 : 16;
  for (const sx of [1, -1]) {
    for (const e of ENGINES) {
      const x = e.x * sx, y = e.y, R = e.r, Lz = e.len;
      // mounting plate on the stern face
      b.cyl('dbg', x, y, ZS - 0.3, R * 0.98, 0.8, { axis: 'z', radial: rad });
      const pts: number[][] = [
        [R * 0.8, 0.2],
        [R * 0.8, -1.4],
        [R * 0.86, -1.8],
        [R * 0.9, -Lz * 0.4],
        [R * 0.96, -Lz * 0.75],
        [R, -Lz + 0.5],
        [R, -Lz],
        [R * 0.9, -Lz],
        [R * 0.84, -Lz + 1.4],
        [R * 0.78, -Lz + 3.2],
      ];
      b.lathe('pearlDarkGray', profile(pts, 30), { at: [x, y, ZS - 0.6], axis: 'z', radial: rad });
      const zExit = ZS - 0.6 - Lz;
      const ring = (key: ColorKey, z: number, rOut: number, rIn: number, h: number) => b.add(key, tube(rOut, rIn, h, 0.04, rad), T(x, y, z).multiply(ROT_Y_TO_Z));
      if (D) {
        // brackets between the bell and the stern plate, exit rim
        for (let k = 0; k < 4; k++) {
          const a = ((k + 0.5) / 4) * Math.PI * 2;
          b.box('dbg', x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.9, ZS - 1.9, R * 0.22, R * 0.22, 2.6, { rot: [0, 0, a] });
        }
        ring('lbg', zExit + 0.25, R + 0.12, R * 0.9, 0.5);
        fine(b, () => {
          for (const f of [0.28, 0.52, 0.76]) {
            const rb = R * (0.87 + 0.1 * f);
            ring('gunmetal', ZS - 0.6 - Lz * f, rb + 0.2, rb - 0.1, 0.6);
          }
        });
      }
      // glow: blue exhaust plate with a hot cyan core
      b.cyl('glowBlue', x, y, zExit + 3.0, R * 0.8, 0.3, { axis: 'z', radial: rad });
      b.cyl('glowCyan', x, y, zExit + 2.7, R * 0.5, 0.3, { axis: 'z', radial: rad });
      if (D) {
        // stator in front of the glow (a dark ring around the hot core, eight radial vanes): it is
        // what gives the exhaust its ringed look from far off, so it is base detail
        ring('gunmetal', zExit + 2.35, R * 0.56, R * 0.5, 0.3);
        for (let k = 0; k < 8; k++) {
          const a = ((k + 0.5) / 8) * Math.PI * 2;
          b.box('gunmetal', x + Math.cos(a) * R * 0.67, y + Math.sin(a) * R * 0.67, zExit + 2.35, R * 0.05, R * 0.24, 0.3, { rot: [0, 0, a - Math.PI / 2] });
        }
      }
    }
  }
  // hyperdrive housing between the inner primaries
  const hx = 4.2;
  b.box('lbg', 0, -16, ZS - 6, hx * 2, 26, 12, { c: 0.1 });
  b.box('dbg', 0, -16, ZS - 12.3, hx * 2 - 1.4, 22, 0.8, { c: 0.08 });
  if (D) {
    for (let y = -27; y < -5; y += 2.2) {
      b.push();
      b.apply(T(0, y, ZS - 12.6).multiply(new Matrix4().makeRotationX(-Math.PI / 2)).multiply(new Matrix4().makeRotationY(Math.PI / 2)));
      grille(b, 'dbg', 0, 0, 0, 1, 2, 0.4);
      b.pop();
    }
    for (const y of [-26, -6]) b.box('white', 0, y, ZS - 6, hx * 2 + 0.3, 1.2, 11);
  }
  b.box('dbg', 0, -2, ZS - 5, hx * 2 + 2, 2, 10);
}

// ─── lod 2 ──────────────────────────────────────────────────────────────────────────────────────

const FAR = 1e4;
/**
 * Far-LOD overlay heights: overlapping patches always sit on different heights (higher = drawn on
 * top), so aztec panels, seams, livery and trims never z-fight where they cross.
 */
const LIFT = { aztec: 0.3, seam: 0.35, livery: 0.4, trim: 0.45 };

/** far-LOD overlay: the rectangle [u0,u1]×[v0,v1] clipped to a CCW face polygon, as one flat top face */
function patch(b: Builder, poly: P2[], key: ColorKey, u0: number, u1: number, v0: number, v1: number, lift: number = LIFT.livery): void {
  const c = clipConvex(
    [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ],
    poly,
  );
  if (c.length >= 3) b.add(key, topMD(c, lift));
}

/** run fn in the tiling frame of a planar face (u along its first edge, v into the face) */
function overlay(b: Builder, pts: V3[], outward: V3, fn: (poly: P2[], len: number, f: Frame) => void, uDir?: V3, vToward?: V3): void {
  const f = faceFrame(pts, outward, uDir, vToward);
  const poly = ccw(pts.map((p) => toLocal(f, p)));
  inFrame(b, f, () => fn(poly, toLocal(f, pts[1])[0], f));
}

/** the rectangles aztec() carves (same hash, same layout) as flat far-LOD patches */
function aztecRects(uMax: number, vMax: number, seed: number, M: number, B: number, vOff: number, emit: (u0: number, u1: number, v0: number, v1: number, r: number) => void): void {
  for (let m = 0; m * M < uMax; m++) {
    const mm = m % 5;
    for (let q = 0; q * B < vMax; q++) {
      if (h3(mm, q, seed) > 0.5) continue;
      const w = 3 + Math.floor(h3(mm, q, seed + 1) * 3) * 3;
      const hh = 2 + Math.floor(h3(mm, q, seed + 2) * Math.max(1, B - 2));
      const ou = Math.floor(h3(mm, q, seed + 3) * Math.max(1, M - w + 1));
      const ov = Math.floor(h3(mm, q, seed + 4) * Math.max(1, B - hh + 1));
      const u0 = m * M + ou, v0 = q * B + ov + vOff;
      emit(u0, u0 + w, v0, v0 + hh, h3(mm, q, seed + 5));
    }
  }
}

/** does [u0,u1) touch one of the 1-stud seam lines laid every M studs? */
const onSeam = (u0: number, u1: number, M: number) => {
  const k = Math.floor((u1 - 1e-6) / M);
  return k >= 1 && u0 < k * M + 1;
};

/** far LOD, one hull half: the lod0/lod1 livery, trims, window bands and panel layout as flat patches */
function lod2Half(b: Builder, seed: number, side: 1 | -1): void {
  const hs = seed * 97 + 13;
  const covered = (u: number, v: number) => {
    const w = toWorld(FD, u, v);
    return inSuper(w.x, w.z, 0.6) || Math.hypot(u - EMB[0], v - EMB[1]) < 8.2;
  };
  overlay(b, DORSAL_PTS, [0, 1, 0], (poly, len) => {
    patch(b, poly, 'lbg', 0, FAR, 0, 1, LIFT.trim);
    patch(b, poly, 'dbg', 40, FAR, 1, 2, LIFT.trim);
    for (const [v0, v1, u0] of STRIPES_LOD2) patch(b, poly, 'darkRed', u0, FAR, v0, v1, LIFT.livery);
    for (const [tu, tv] of TURRET_L) patch(b, poly, 'dbg', tu - 5, tu + 5, tv - 5, tv + 5, LIFT.livery);
    for (let u = 32; u < len; u += 32) patch(b, poly, 'lbg', u, u + 1, 2, FAR, LIFT.seam);
    aztecRects(len, 90, hs + 3, 16, 6, 2, (u0, u1, v0, v1, r) => {
      if (r >= 0.8 && r < 0.9) return; // white raised panels: invisible on white at this range
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      if (v0 < 2 || covered(uc, vc) || nearStripe(STRIPES_LOD2, uc, vc, 1) || onSeam(u0, u1, 32)) return;
      for (const [tu, tv] of TURRET_L) if (Math.abs(uc - tu) < 7 && Math.abs(vc - tv) < 7) return;
      patch(b, poly, r < 0.8 ? 'lbg' : 'dbg', u0, u1, v0, v1, LIFT.aztec);
    });
    const m = T(EMB[0], 0, EMB[1]);
    b.add('dbg', discMD(8.2, 0.6, 20), m);
    b.add('white', discMD(7.6, 0.8, 20), m);
    b.add('darkRed', discMD(6.3, 1.0, 20), m);
    for (const a0 of [0.35, Math.PI + 0.35]) b.add('yellow', arcMD(3.7, 5.3, 1.2, a0, a0 + Math.PI - 0.7, 8), m);
    b.add('darkRed', discMD(2.2, 1.1, 10), m);
  });
  // rim: red bow, white top line, black window band
  overlay(b, [TIP, st(R0), st(R1)], [1, 0, 0], (poly, len) => {
    const uWin = Math.ceil(len * 0.44);
    patch(b, poly, 'darkRed', 0, 30, 0, FAR, LIFT.livery);
    patch(b, poly, 'white', 30, FAR, 0, 1, LIFT.trim);
    patch(b, poly, 'black', uWin, FAR, 1, 2, LIFT.livery);
  });
  // lower side band: dark top line, red bow, black window band
  overlay(b, [TIP, st(L0), st(L1)], [1, 0, 0], (poly, len) => {
    const uWin = Math.ceil(len * 0.56);
    patch(b, poly, 'darkRed', 0, 26, 0, FAR, LIFT.livery);
    patch(b, poly, 'dbg', 26, FAR, 0, 1, LIFT.trim);
    patch(b, poly, 'black', uWin, FAR, 1, 2, LIFT.livery);
  });
  // ventral wing: red bow, seams, patchwork
  overlay(b, [TIP, st(L1), st(K1)], [0.3, -1, 0], (poly, len) => {
    patch(b, poly, 'darkRed', 0, 34, 0, FAR, LIFT.livery);
    for (let u = 48; u < len; u += 48) patch(b, poly, 'dbg', u, u + 1, 1, FAR, LIFT.seam);
    aztecRects(len, 80, hs + 10, 24, 8, 0, (u0, u1, v0, v1, r) => {
      if (r >= 0.8 || v0 < 1 || u0 < 34 || onSeam(u0, u1, 48)) return;
      patch(b, poly, r < 0.55 ? 'white' : 'dbg', u0, u1, v0, v1, LIFT.aztec);
    });
  });
  // the open port hangar: lit back wall and floor lights in the trench
  if (side > 0) {
    overlay(b, [TIP, st(T0), st(T1)], [1, 0, 0], (poly, len) => {
      const ha = len - 70, hb = len - 42, hh = (7 * ha) / len;
      patch(b, poly, 'lbg', ha + 1, hb - 1, 0.8, hh - 0.5, LIFT.livery);
      patch(b, poly, 'windowWarm', ha + 1.5, hb - 1.5, hh - 1.2, hh - 0.8, 0.6);
    });
  }
}

/** far LOD keel: red bow, dark centre strip, ventral hangar */
function lod2Keel(b: Builder): void {
  overlay(
    b,
    [TIP, st(K1), st(K1, -1)],
    [0, -1, 0],
    (poly) => {
      patch(b, poly, 'darkRed', 0, 34, -FAR, FAR);
      patch(b, poly, 'dbg', 34, 150, -3, 3);
      patch(b, poly, 'dbg', 150, 205, -7, 7);
      patch(b, poly, 'black', 151, 204, -0.5, 0.5, 0.6);
      patch(b, poly, 'dbg', 205, 217, -6, 6);
      patch(b, poly, 'dbg', 217, FAR, -3, 3);
    },
    [0, K0[1] - TIP[1], ZS - ZT],
    [0, 0, 0],
  );
}

/** far LOD superstructure: the lod1 blocks as solids, their trims and window bands as patches */
function lod2Super(b: Builder, seed0: number, anchors: Record<string, V3>): void {
  const seed = seed0 * 53 + 7;
  const k1 = edgeKinds(SUP_BOTTOM);
  const L1f = frustum(SUP_BOTTOM, SUP_Y0, k1.map(offL1), SUP_Y1);
  b.add('white', frustumMD(SUP_BOTTOM, SUP_Y0, L1f.top, SUP_Y1));
  const c1: V3 = [0, (SUP_Y0 + SUP_Y1) / 2, (SUP_FRONT_Z + ZS) / 2];
  L1f.faces.forEach((face, i) => {
    const k = k1[i];
    if (k === 'rear') return;
    const bands = BANDS_L1(k);
    const top = k === 'front' ? 23 : 17;
    overlay(b, face, faceOut(face, c1), (poly) => {
      patch(b, poly, 'dbg', -FAR, FAR, 0, 1.5);
      for (const r of bands) {
        patch(b, poly, 'black', -FAR, FAR, r, r + 1);
        patch(b, poly, 'dbg', -FAR, FAR, r + 1, r + 2);
      }
      patch(b, poly, 'lbg', -FAR, FAR, top, FAR);
    });
  });
  // L1 roof: light grey with the front vent strip and a dark patchwork
  overlay(
    b,
    L1f.top.map((p) => to3(p, SUP_Y1)),
    [0, 1, 0],
    (poly, _len, f) => {
      patch(b, poly, 'lbg', -FAR, FAR, -FAR, FAR);
      patch(b, poly, 'dbg', -FAR, 3, -FAR, FAR, 0.5);
      aztecRects(140, 150, seed + 21, 12, 6, -40, (u0, u1, v0, v1, r) => {
        if (r < 0.4 || u0 < 3) return;
        const w = toWorld(f, (u0 + u1) / 2, (v0 + v1) / 2);
        if (w.z < L2_FRONT_Z + 1 && inConvex(L2_BOTTOM, w.x, w.z)) return;
        patch(b, poly, 'dbg', u0, u1, v0, v1, 0.5);
      });
    },
    [0, 0, -1],
  );
  // level 2
  const k2 = edgeKinds(L2_BOTTOM);
  const L2f = frustum(L2_BOTTOM, SUP_Y1, k2.map(offL2), SUP2_Y1);
  b.add('white', frustumMD(L2_BOTTOM, SUP_Y1, L2f.top, SUP2_Y1));
  b.add('lbg', topMD(L2f.top, SUP2_Y1 + 0.4));
  const c2: V3 = [0, (SUP_Y1 + SUP2_Y1) / 2, -150];
  L2f.faces.forEach((face, i) => {
    if (k2[i] === 'rear') return;
    overlay(b, face, faceOut(face, c2), (poly) => {
      patch(b, poly, 'dbg', -FAR, FAR, 0, 1);
      patch(b, poly, 'black', -FAR, FAR, 3, 4);
    });
  });
  // neck between the towers
  const neck = frustum(NECK, SUP2_Y1, edgeKinds(NECK).map(offNeck), NECK_Y);
  b.add('lbg', frustumMD(NECK, SUP2_Y1, neck.top, NECK_Y));
  const cn: V3 = [0, SUP2_Y1 + 2.5, -168];
  neck.faces.forEach((face) =>
    overlay(b, face, faceOut(face, cn), (poly) => {
      patch(b, poly, 'dbg', -FAR, FAR, 0, 1);
      patch(b, poly, 'black', -FAR, FAR, 2, 3);
    }),
  );
  for (const sx of [1, -1] as const) {
    b.push();
    if (sx < 0) b.mirrorX();
    lod2Tower(b);
    b.pop();
    anchors[sx > 0 ? 'bridgeL' : 'bridgeR'] = [TOWER_X * sx, BRIDGE_Y[3] + 0.4, -164];
  }
}

function lod2Tower(b: Builder): void {
  const F = ccw(TOWER_FOOT);
  const kinds = edgeKinds(F);
  const tw = frustum(F, SUP2_Y1, kinds.map(offTower), TOWER_Y1);
  b.add('white', frustumMD(F, SUP2_Y1, tw.top, TOWER_Y1));
  const ct: V3 = [TOWER_X, (SUP2_Y1 + TOWER_Y1) / 2, -164];
  tw.faces.forEach((face, i) => {
    const k = kinds[i];
    overlay(b, face, faceOut(face, ct), (poly) => {
      if (k === 'front') return patch(b, poly, 'dbg', -FAR, FAR, 0, FAR);
      const bands = BANDS_TOWER(k);
      patch(b, poly, 'dbg', -FAR, FAR, 0, 1);
      for (const r of bands) {
        patch(b, poly, 'lbg', -FAR, FAR, r - 1, r);
        patch(b, poly, 'black', -FAR, FAR, r, r + 1);
        patch(b, poly, 'lbg', -FAR, FAR, r + 1, r + 2);
      }
    });
  });
  // command bridge: flare, body with the panoramic windows, roof
  const [y0, y1, y2, y3] = BRIDGE_Y;
  const plan = BRIDGE_PLAN;
  const pk = edgeKinds(plan);
  const under = offsetEdges(plan, plan.map(() => 3.2));
  b.add('lbg', frustumMD(under, y0, plan, y1));
  b.add('white', frustumMD(plan, y1, plan, y2));
  b.add('lbg', frustumMD(plan, y2, offsetEdges(plan, plan.map(() => 1.3)), y3));
  const cb: V3 = [TOWER_X, (y0 + y3) / 2, -165];
  frustum(plan, y1, plan.map(() => 0), y2).faces.forEach((face, i) => {
    const front = pk[i] === 'front' || pk[i] === 'bevel';
    overlay(b, face, faceOut(face, cb), (poly, len) => {
      if (front) {
        patch(b, poly, 'black', -FAR, FAR, 1, 2.4);
        patch(b, poly, 'windowCool', 0.3, len - 0.3, 1.15, 2.25, 0.6);
        return;
      }
      patch(b, poly, 'black', -FAR, FAR, 1, 2);
    });
  });
}

function lod2(b: Builder, seed: number, anchors: Record<string, V3>): void {
  colouredCone(b, TIP, FULL_SECTION, ZS);
  b.add('lbg', coneSolidMD([0, 0, ZT - 1], offsetEdges(FULL_SECTION, FULL_SECTION.map(() => 0.05)), ZS));
  for (const sx of [1, -1] as const) {
    b.push();
    if (sx < 0) b.mirrorX();
    lod2Half(b, seed, sx);
    b.pop();
  }
  lod2Keel(b);
  lod2Super(b, seed, anchors);
  // turrets
  for (const sx of [1, -1]) {
    for (const [x0, z] of TURRETS) {
      const x = x0 * sx, y = dorsalY(x, z);
      b.box('lbg', x, y + 1.6, z, 5.4, 2.6, 6, { c: 0.2 });
      b.box('gunmetal', x, y + 1.9, z + 6, 3, 0.6, 7, { c: 0 });
    }
  }
  // engines: bells with the blue exhaust plate and hot core
  for (const sx of [1, -1]) {
    for (const e of ENGINES) {
      const rad = e.r > 6 ? 14 : 8;
      b.cyl('pearlDarkGray', e.x * sx, e.y, ZS - e.len / 2, e.r, e.len, { axis: 'z', radial: rad, c: 0 });
      b.cyl('glowBlue', e.x * sx, e.y, ZS - e.len - 0.1, e.r * 0.82, 0.3, { axis: 'z', radial: rad, c: 0 });
      b.cyl('glowCyan', e.x * sx, e.y, ZS - e.len - 0.3, e.r * 0.5, 0.3, { axis: 'z', radial: rad, c: 0 });
    }
  }
  b.box('lbg', 0, -16, ZS - 6, 8.4, 26, 12, { c: 0 });
}

// ─── lod-0 routing: spatial chunks × detail tiers ───────────────────────────────────────────────

/** z cuts (studs) of the base-tier hull chunks, bow to stern */
const BASE_CUTS = [120, 50, -20, -80, -130];
/** camera-to-chunk-box distance (units) inside which a tier is drawn */
const TIER_NEAR = [Infinity, 110 * S, 44 * S];

function routeKey(x: number, y: number, z: number, tier: number): string {
  const xs = x / S, ys = y / S, zs = z / S;
  const top = ys > SUP2_Y1 + 0.5;
  if (tier === TIER_BASE) {
    if (zs < ZS - 0.3) return 'stern';
    if (top) return 'top';
    let i = 0;
    while (i < BASE_CUTS.length && zs < BASE_CUTS[i]) i++;
    return `hull${i}`;
  }
  const ax = Math.abs(xs);
  const col = ax < 26 ? 'c' : `${xs > 0 ? 'p' : 's'}${ax < 60 ? 1 : 2}`;
  return `${tier === TIER_MICRO ? 'micro' : 'fine'}-${top ? 't' : 'h'}${col}${Math.floor(zs / 40)}`;
}

const _camL = new Vector3();
const _inv = new Matrix4();
/**
 * A chunk of near-only detail, shown while the camera is within `near` of the chunk's bounding box.
 * A pure function of the camera position (no hysteresis), evaluated by the renderer for every
 * render — shadow pass included — so stills and motion-blur subframes are deterministic.
 */
class NearLOD extends LOD {
  constructor(
    readonly box: Box3,
    readonly near: number,
  ) {
    super();
  }
  override update(camera: Camera): void {
    _camL.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(_inv.copy(this.matrixWorld).invert());
    const on = this.box.distanceToPoint(_camL) < this.near;
    for (const c of this.children) c.visible = on;
  }
}

// ─── assembly ───────────────────────────────────────────────────────────────────────────────────

/** Venator-class Star Destroyer, macro-brick scale, 3200 units long. Owner: asset agent B. */
export function venator(o: { lod: 0 | 1 | 2; seed?: number }): CapitalShip {
  const seed = o.seed ?? 1;
  const group = new Group();
  group.name = 'venator';
  const engineGlows: Mesh[] = [];
  const anchorsStud: Record<string, V3> = {};
  const muzzles: V3[] = [];
  const collectGlows = (g: Object3D) =>
    g.traverse((m) => {
      if (m instanceof Mesh && /:glow(Blue|Cyan)$/.test(m.name)) engineGlows.push(m);
    });
  if (o.lod === 2) {
    const b = new Builder({ seed, studSegments: 6 });
    b.scale(S);
    lod2(b, seed, anchorsStud);
    const built = b.build('venator-lod2');
    group.add(built.group);
    collectGlows(built.group);
    // same muzzle points as the tiled LODs, so a ship can switch LOD mid-volley
    for (const sx of [1, -1]) {
      for (const [x, z] of TURRETS) {
        const y = dorsalY(x, z) + 2.35;
        muzzles.push([x * sx + 1.1, y, z + 10.4], [x * sx - 1.1, y, z + 10.4]);
      }
    }
  } else if (o.lod === 1) {
    // one builder: ~one draw call per colour for the background fleet
    const cfg: Cfg = { D: false, seed };
    const L = styleSet(false);
    const b = new Builder({ seed: seed * 7, studSegments: 6 });
    b.scale(S);
    const out: HullOut = { turretMuzzles: [] };
    hull(b, cfg, L, out);
    superstructure(b, cfg, L, anchorsStud);
    engines(b, cfg);
    const built = b.build('venator-lod1');
    group.add(built.group);
    collectGlows(built.group);
    muzzles.push(...out.turretMuzzles);
  } else {
    // one construction pass, every part routed to a spatial chunk of its detail tier
    const cfg: Cfg = { D: true, seed };
    const L = styleSet(true);
    const targets = new Map<string, { b: Builder; tier: number }>();
    let n = 0;
    const rb = new RouteBuilder({ seed: seed * 7, studSegments: 10 }, (x, y, z, tier) => {
      const key = routeKey(x, y, z, tier);
      let t = targets.get(key);
      if (!t) targets.set(key, (t = { b: new Builder({ seed: seed * 7 + 11 * ++n }), tier }));
      return t.b;
    });
    rb.scale(S);
    const out: HullOut = { turretMuzzles: [] };
    hull(rb, cfg, L, out);
    superstructure(rb, cfg, L, anchorsStud);
    engines(rb, cfg);
    muzzles.push(...out.turretMuzzles);
    for (const [key, t] of targets) {
      const built = t.b.build(`venator-${key}`);
      if (t.tier === TIER_BASE) {
        group.add(built.group);
        collectGlows(built.group);
        continue;
      }
      const box = new Box3();
      for (const p of built.parts) box.union(p.geometry.boundingBox!);
      const lod = new NearLOD(box, TIER_NEAR[t.tier]);
      lod.name = `venator-${key}-near`;
      lod.add(built.group);
      group.add(lod);
    }
  }
  const anchors: Record<string, Object3D> = {};
  const A = (name: string, p: V3) => (anchors[name] = anchor(name, group, p[0] * S, p[1] * S, p[2] * S));
  A('bridgeL', anchorsStud.bridgeL ?? [TOWER_X, BRIDGE_Y[3], -164]);
  A('bridgeR', anchorsStud.bridgeR ?? [-TOWER_X, BRIDGE_Y[3], -164]);
  A('bow', [0, 0.6, ZT]);
  A('stern', [0, -10, ZS - 14]);
  A('dorsalDoor', [0, dorsalY(0, 60) + 0.8, 60]);
  const zm = 20;
  A('portEdgeMid', [R0[0] * tz(zm), R0[1] * tz(zm), zm]);
  A('hangarVentral', [0, K0[1] * tz(-0) - 0.5, 20]);
  const turrets = muzzles.map((p, i) => anchor(`turret${i}`, group, p[0] * S, p[1] * S, p[2] * S));
  return { group, length: (ZT - (ZS - 14.6)) * S, turrets, engineGlows, anchors };
}

export const VENATOR_DIMS = { scale: S, bowZ: ZT, sternZ: ZS, dorsalY, tz };
