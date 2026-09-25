import { Group, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import { Builder, PLATE } from '../core/builder';
import { MeshAcc, profile, tube, type MeshData, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import { Rng } from '../core/rng';
import { anchor } from './placeholder';
import type { CapitalShip } from './types';
import {
  ZoneBuilder,
  ccw,
  clipConvex,
  coneSolidMD,
  frustumMD,
  grilleMD,
  h3,
  inConvex,
  makeFrame,
  offsetEdges,
  packPanel,
  polyNormal,
  tileFace,
  tileMD,
  toLocal,
  toWorld,
  topMD,
  wants,
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
 * tiles, cropped wedge pieces along the angled edges) on top of a dark core, so the seams read as
 * LEGO from any distance. Livery: dark red hangar-door stripe from bow to superstructure, four red
 * stripes on each aft wing, red nose, Open Circle emblems amidships.
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

// heavy turret placements (port side; starboard mirrored): four along each flank of the superstructure
const TURRETS: [number, number][] = [
  [-62, 0],
  [-90, 0],
  [-118, 0],
  [-146, 0],
].map(([z]) => [96 * tz(z) - 27, z]);

// ─── styles ─────────────────────────────────────────────────────────────────────────────────────

interface Cfg {
  lod: 0 | 1;
  fine: boolean;
  seed: number;
}

function styleSet(lod: 0 | 1) {
  const fine = lod === 0;
  const F: P2[] = fine
    ? [[4, 2], [6, 2], [3, 2], [8, 2], [2, 2], [4, 1], [6, 1], [4, 4], [2, 1], [3, 1], [1, 1]]
    : [[16, 8], [12, 8], [8, 8], [16, 4], [12, 4], [8, 4], [6, 4], [4, 4], [8, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]];
  const BIG: P2[] = fine
    ? [[6, 4], [8, 4], [4, 4], [6, 2], [8, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]]
    : [[16, 16], [16, 8], [12, 8], [8, 8], [16, 4], [8, 4], [4, 4], [8, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]];
  const LONG: P2[] = fine ? [[8, 1], [6, 1], [4, 1], [3, 1], [2, 1], [1, 1]] : [[16, 1], [12, 1], [8, 1], [4, 1], [2, 1], [1, 1]];
  const LONG2: P2[] = fine ? [[8, 2], [6, 2], [4, 2], [8, 1], [6, 1], [4, 1], [2, 2], [2, 1], [1, 1]] : [[16, 2], [12, 2], [8, 2], [16, 1], [8, 1], [4, 2], [4, 1], [2, 1], [1, 1]];
  const CROSS: P2[] = fine ? [[1, 8], [1, 6], [1, 4], [1, 3], [1, 2], [1, 1]] : [[1, 16], [1, 8], [1, 4], [1, 2], [1, 1]];
  const DOOR: P2[] = fine
    ? [[8, 2], [6, 2], [4, 2], [3, 2], [2, 2], [8, 1], [6, 1], [4, 1], [3, 1], [2, 1], [1, 1]]
    : [[11, 8], [11, 4], [8, 8], [8, 4], [4, 4], [8, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]];
  const PL: P2[] = fine ? [[4, 2], [2, 2], [6, 2], [3, 2], [2, 1], [1, 1]] : [[8, 4], [4, 4], [4, 2], [2, 2], [2, 1], [1, 1]];
  const s = (key: ColorKey, sizes: P2[], extra: Partial<TStyle> = {}): TStyle => ({ key, sizes, flat: !fine, ...extra });
  return {
    field: s('white', F, { mottle: 'lbg', mottleP: fine ? 0.07 : 0.05 }),
    fieldL: s('lbg', F, { mottle: 'white', mottleP: 0.05 }),
    fieldBig: s('lbg', BIG, { mottle: 'white', mottleP: 0.06 }),
    fieldBigW: s('white', BIG, { mottle: 'lbg', mottleP: 0.06 }),
    panelL: s('lbg', F),
    panelW: s('white', F),
    panelD: s('dbg', F),
    raisedL: s('lbg', F, { kind: 'raised' }),
    raisedW: s('white', F, { kind: 'raised' }),
    raisedD: s('dbg', F, { kind: 'raised' }),
    plateL: s('lbg', PL, { kind: fine ? 'plate' : 'tile' }),
    plateD: s('dbg', PL, { kind: fine ? 'plate' : 'tile' }),
    plateW: s('white', PL, { kind: fine ? 'plate' : 'tile' }),
    grilleD: s('dbg', [[2, 1], [1, 1]], { kind: fine ? 'grille' : 'tile' }),
    grilleL: s('lbg', [[2, 1], [1, 1]], { kind: fine ? 'grille' : 'tile' }),
    grilleDv: s('dbg', [[1, 2], [1, 1]], { kind: fine ? 'grille' : 'tile' }),
    trim: s('lbg', LONG),
    trimW: s('white', LONG),
    trimD: s('dbg', LONG),
    seam: s('lbg', CROSS),
    seamD: s('dbg', CROSS),
    red: s('darkRed', LONG2),
    redRaised: s('darkRed', LONG2, { kind: 'raised' }),
    rail: s('dbg', LONG, { kind: 'raised' }),
    railTile: s('dbg', LONG),
    door: s('darkRed', DOOR),
    doorRib: s('darkRed', CROSS, { kind: fine ? 'plate' : 'raised', hP: 2 }),
    black: s('black', LONG2),
    blackF: s('black', F),
    winLit: s('windowWarm', [[1, 1]]),
    winCool: s('windowCool', [[1, 1]]),
    winFrame: s('dbg', [[1, 1]]),
    winFrameW: s('white', [[1, 1]]),
    trench: s('dbg', BIG),
    trenchL: s('lbg', LONG2),
    ventral: s('lbg', BIG, { mottle: 'white', mottleP: 0.05 }),
    ventralW: s('white', BIG),
    ventralD: s('dbg', BIG),
  };
}
type Styles = ReturnType<typeof styleSet>;

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

// ─── hull ───────────────────────────────────────────────────────────────────────────────────────

interface HullOut {
  turretMuzzles: V3[];
  frames: Record<string, Frame>;
}

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
const deckEdgeV = (u: number) => (DECK_HW * u) / DECK_LEN;

function hull(b: Builder, cfg: Cfg, L: Styles, out: HullOut): void {
  const fine = cfg.fine;
  // dark core: every seam and panel joint shows a shadowed gap instead of a hole
  const full: P2[] = [...PORT_SECTION.map(([x, y]) => [-x, y] as P2), ...PORT_SECTION.slice().reverse()];
  b.add('dbg', coneSolidMD([0, -0.05, ZT - 3.5], offsetEdges(full, full.map(() => 0.45)), ZS + 0.45));
  // hangar-door centre seam (one strip on the centreline) with landing lights
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
      { seed: cfg.seed * 5 + 3, style: () => L.black, gridV: 0.5, module: 8 },
    );
    if (fine) {
      for (let u = u0 + 3; u < DECK_LEN - 2; u += 6) {
        if (!wants(b, u, 0.4, 0)) continue;
        b.add('windowWarm', discMD(0.24, 0.14, 12), new Matrix4().makeTranslation(u, 0.4, 0));
      }
    }
  });
  for (const side of [1, -1] as const) {
    b.push();
    if (side < 0) b.mirrorX();
    hullHalf(b, cfg, L, side, out);
    b.pop();
  }
  keel(b, cfg, L);
  noseCap(b);
}

function hullHalf(b: Builder, cfg: Cfg, L: Styles, side: 1 | -1, out: HullOut): void {
  const fine = cfg.fine;
  const detailed = fine && side > 0; // port side gets the hero greebles
  const seed = cfg.seed * 97 + 13; // same pattern both sides → symmetric build
  // ── flight deck (port half of the dorsal hangar doors; rows parallel to the centreline) ──
  out.frames[side > 0 ? 'deckP' : 'deckS'] = DECK_FRAME;
  inFrame(b, DECK_FRAME, () => {
    const poly: P2[] = [
      [0, 0],
      [DECK_LEN, 0],
      [DECK_LEN, DECK_HW],
    ];
    packPanel(b, poly, {
      seed: seed + 1,
      module: 12,
      period: 4,
      studs: fine,
      gridV: 0.5,
      mask: (_u, v) => v < 0.5,
      style: (u, v) => {
        const d = deckEdgeV(u) - v;
        const m = ((u % 12) + 12) % 12;
        if (d < 1) return L.rail;
        if (d < 2) return m < 2 ? L.grilleD : L.railTile;
        if (m < 1) return L.doorRib;
        return L.door;
      },
    });
    if (fine) {
      // hinge plates where every door rib meets the rail
      for (let u = 36; u < DECK_LEN - 3; u += 12) {
        const v = deckEdgeV(u) - 2.3;
        if (!wants(b, u, 0.8, v)) continue;
        b.box('dbg', u + 0.5, 0.4 + 0.2, v, 1.0, 0.4, 1.4);
        b.cyl('flatSilver', u + 0.5, 1.05, v + 0.25, 0.2, 0.9, { axis: 'x', radial: 8 });
        b.box('dbg', u + 0.5, 0.9, v - 0.45, 0.8, 0.5, 0.4);
      }
    }
  });
  // ── dorsal wing ──
  const dorsalPts: V3[] = [TIP, st(R0), st(D1)];
  const fD = faceFrame(dorsalPts, [0, 1, 0]);
  out.frames[side > 0 ? 'dorsalP' : 'dorsalS'] = fD;
  const emblemW = new Vector3(22, 0, 2);
  emblemW.y = dorsalY(emblemW.x, emblemW.z);
  const emblem = toLocal(fD, emblemW);
  const turretsLocal = TURRETS.map(([x, z]) => toLocal(fD, [x, dorsalY(x, z), z]));
  const stripeU0 = 236;
  inFrame(b, fD, () => {
    const poly = dorsalPts.map((p) => toLocal(fD, p));
    packPanel(b, poly, {
      seed: seed + 2,
      module: 16,
      period: 5,
      studs: fine,
      mask: (u, v) => {
        const w = toWorld(fD, u, v);
        if (inSuper(w.x, w.z, 0.6)) return true;
        const du = u - emblem[0], dv = v - emblem[1];
        if (du * du + dv * dv < 8.2 * 8.2) return true;
        return false;
      },
      style: (u, v) => {
        if (v < 1) return L.trim;
        if (v < 2 && u > 40) return L.trimD;
        for (let k = 0; k < 4; k++) {
          const a = 5 + k * 4;
          if (v >= a && v < a + 2 && u >= stripeU0 + k * 14) return L.red;
        }
        // pads around the heavy turrets
        for (const [tu, tv] of turretsLocal) if (Math.abs(u - tu) < 5 && Math.abs(v - tv) < 5) return fine ? L.plateD : L.panelD;
        if (((u % 32) + 32) % 32 < 1 && u > 24) return L.seam;
        // deck-edge band: a line of greebles along the flight deck
        const vEdge = u * (poly[2][1] / poly[2][0]);
        if (fine && v > vEdge - 3 && u > 30) return ((Math.floor(u / 6) % 3) === 0 ? L.grilleL : L.panelL);
        const a = aztec(u, v - 2, seed + 3, 16, 6, (r) => (r < 0.52 ? L.panelL : r < 0.66 ? L.raisedL : r < 0.8 ? L.plateL : r < 0.9 ? L.raisedW : L.panelD));
        return a ?? L.field;
      },
    });
    // Open Circle emblem (white ring plate, dark red disc, two yellow arcs)
    if (wants(b, emblem[0], 0.4, emblem[1])) {
      const e = emblem;
      b.add('white', discMD(7.6, 0.4, fine ? 40 : 20), new Matrix4().makeTranslation(e[0], 0, e[1]));
      b.add('darkRed', discMD(6.3, 0.8, fine ? 40 : 20), new Matrix4().makeTranslation(e[0], 0, e[1]));
      for (const a0 of [0.35, Math.PI + 0.35]) b.add('yellow', arcMD(3.7, 5.3, 1.05, a0, a0 + Math.PI - 0.7, fine ? 20 : 10), new Matrix4().makeTranslation(e[0], 0, e[1]));
      b.add('darkRed', discMD(2.2, 1.0, fine ? 20 : 12), new Matrix4().makeTranslation(e[0], 0, e[1]));
    }
  });
  // heavy turbolaser turrets (DBY-827)
  for (let i = 0; i < TURRETS.length; i++) {
    const [x, z] = TURRETS[i];
    const y = dorsalY(x, z) + 0.4;
    if (side > 0) out.turretMuzzles.push([x + 1.1, y + 1.95, z + 10.4], [x - 1.1, y + 1.95, z + 10.4]);
    else out.turretMuzzles.push([-x + 1.1, y + 1.95, z + 10.4], [-x - 1.1, y + 1.95, z + 10.4]);
    if (!wants(b, x, y, z)) continue;
    b.at(x, y, z, () => heavyTurret(b, fine, side));
  }
  // ── rim (upper hull side face) ──
  const rimPts: V3[] = [TIP, st(R0), st(R1)];
  const fR = faceFrame(rimPts, [1, 0, 0]);
  inFrame(b, fR, () => {
    const poly = rimPts.map((p) => toLocal(fR, p));
    const len = poly[1][0];
    const uWin = Math.ceil(len * 0.44);
    packPanel(b, poly, {
      seed: seed + 4,
      module: 16,
      period: 4,
      style: (u, v) => {
        if (v < 1) return L.trimW;
        if (u < 30) return L.red;
        if (v < 2 && u > uWin) return L.black;
        return L.trim;
      },
    });
    litWindows(b, uWin + 2, len - 2, 1.5, detailed ? 2 : 4, 0.8, h3(seed, 4, 1), 'windowWarm', !fine);
  });
  // ── trench ceiling (underside of the overhang) ──
  const ceilPts: V3[] = [TIP, st(R1), st(T0)];
  const fC = faceFrame(ceilPts, [0, -1, 0]);
  inFrame(b, fC, () => packPanel(b, ceilPts.map((p) => toLocal(fC, p)), { seed: seed + 5, module: 16, style: () => L.trench }));
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
      studs: fine,
      mask: (u) => u > hangarU[0] && u < hangarU[1],
      style: (u, v) => {
        const hgt = (7 * u) / wallLen;
        if (v < 1 && hgt > 2) return L.trimD;
        return ((Math.floor(u / 8) + Math.floor(v / 2)) % 5 === 0) ? L.grilleD : L.trench;
      },
    });
    trenchGreebles(b, cfg, L, side, detailed, wallLen, hangarU, seed);
  });
  // ── trench floor ──
  const floorPts: V3[] = [TIP, st(T1), st(L0)];
  const fF = faceFrame(floorPts, [0, 1, 0]);
  inFrame(b, fF, () => {
    const poly = floorPts.map((p) => toLocal(fF, p));
    packPanel(b, poly, { seed: seed + 7, module: 12, style: (u) => (((Math.floor(u / 12)) % 2) ? L.trenchL : L.trench) });
    // point-defence turrets along the trench floor
    const n = fine ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const u = 110 + (i * (wallLen - 150)) / (n - 1);
      const vmax = u * (poly[2][1] / poly[2][0]);
      if (!wants(b, u, 0.4, vmax * 0.5)) continue;
      b.at(u, 0.4, vmax * 0.5, () => pdTurret(b, fine));
    }
  });
  // ── lower side band ──
  const lowPts: V3[] = [TIP, st(L0), st(L1)];
  const fL = faceFrame(lowPts, [1, 0, 0]);
  inFrame(b, fL, () => {
    const poly = lowPts.map((p) => toLocal(fL, p));
    const len = poly[1][0];
    const uWin = Math.ceil(len * 0.56);
    packPanel(b, poly, {
      seed: seed + 8,
      module: 16,
      period: 4,
      style: (u, v) => {
        if (v < 1) return L.trimD;
        if (u < 26) return L.red;
        if (v < 2 && u > uWin) return L.black;
        return L.trimW;
      },
    });
    litWindows(b, uWin + 2, len - 2, 1.5, detailed ? 3 : 5, 0.6, h3(seed, 8, 1), 'windowWarm', !fine);
  });
  // ── ventral wing ──
  const venPts: V3[] = [TIP, st(L1), st(K1)];
  const fV = faceFrame(venPts, [0.3, -1, 0]);
  inFrame(b, fV, () => {
    packPanel(b, venPts.map((p) => toLocal(fV, p)), {
      seed: seed + 9,
      module: 24,
      period: 5,
      style: (u, v) => {
        if (v < 1) return L.trim;
        if (u < 34) return L.red;
        if (((u % 48) + 48) % 48 < 1) return L.seamD;
        const a = aztec(u, v, seed + 10, 24, 8, (r) => (r < 0.55 ? L.ventralW : r < 0.8 ? L.ventralD : L.raisedL));
        return a ?? L.ventral;
      },
    });
  });
  // ── stern face (three convex pieces of the port half) ──
  const zf = ZS;
  const sternParts: V3[][] = [
    [[0, -3, zf], [96, -3, zf], [96, 2, zf], [18, 16, zf], [0, 16, zf]],
    [[0, -10, zf], [90, -10, zf], [90, -3, zf], [0, -3, zf]],
    [[0, -32, zf], [20, -32, zf], [93.5, -14, zf], [93.5, -10, zf], [0, -10, zf]],
  ];
  sternParts.forEach((pts, i) => {
    tileFace(b, pts, {
      seed: seed + 20 + i,
      outward: [0, 0, -1],
      uDir: [1, 0, 0],
      module: 12,
      period: 3,
      studs: fine,
      worldMask: (p) => (Math.abs(p.x) < 49.5 && p.y > SUP_Y0 + 0.3) || Math.abs(p.x) < 5,
      style: (u, v) => {
        const a = aztec(u, v, seed + 30, 12, 4, (r) => (r < 0.6 ? L.panelL : L.panelD));
        return a ?? (i === 1 ? L.trench : L.fieldL);
      },
    });
  });
}

function keel(b: Builder, cfg: Cfg, L: Styles): void {
  const fine = cfg.fine;
  const pts: V3[] = [TIP, st(K1), st(K1, -1)];
  const f = faceFrame(pts, [0, -1, 0], [0, K0[1] - TIP[1], ZS - ZT], [0, 0, 0]);
  const hangar: [number, number] = [150, 205];
  inFrame(b, f, () => {
    const poly = pts.map((p) => toLocal(f, p));
    packPanel(b, poly, {
      seed: cfg.seed * 31 + 5,
      module: 24,
      period: 4,
      studs: fine,
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

function noseCap(b: Builder): void {
  const k = 7 / (ZT - ZS);
  const sec: P2[] = [...PORT_SECTION.map(([x, y]) => [-x * k, y * k] as P2), ...PORT_SECTION.slice().reverse().map(([x, y]) => [x * k, y * k] as P2)];
  const grown = offsetEdges(sec, sec.map(() => -0.42));
  b.add('darkRed', coneSolidMD([0, 0, ZT + 0.6], grown, ZT - 7));
}

// ─── trench greebles ────────────────────────────────────────────────────────────────────────────

function trenchGreebles(b: Builder, cfg: Cfg, L: Styles, side: 1 | -1, detailed: boolean, wallLen: number, hangarU: [number, number], seed: number): void {
  const fine = cfg.fine;
  // trench height (v) and depth (y) at u
  const H = (u: number) => (7 * u) / wallLen;
  const D = (u: number) => (6 * u) / wallLen;
  const step = detailed ? 7 : fine ? 14 : 28;
  for (let u0 = 70; u0 < wallLen - 4; u0 += step) {
    if (u0 + step > hangarU[0] - 1 && u0 < hangarU[1] + 1) continue;
    const h = H(u0), d = D(u0);
    if (h < 2.2) continue;
    if (!wants(b, u0 + step / 2, 0.5, h / 2)) continue;
    const r = new Rng(Math.floor(h3(u0, side > 0 ? 1 : 1, seed) * 1e9));
    // structural rib
    b.box('dbg', u0 + 0.5, Math.min(d * 0.5, 1.2) / 2 + 0.4, h / 2, 1, Math.min(d * 0.5, 1.2), h - 0.2, { hide: { ny: true } });
    if (!fine) continue;
    const kind = Math.floor(h3(u0 % 49, 3, seed) * 5);
    const x0 = u0 + 1.2, x1 = u0 + step - 0.2;
    const dm = Math.min(d * 0.55, 2.2);
    if (kind === 0 || !detailed) {
      // pipe run
      const ny = h > 4.5 ? 2 : 1;
      for (let k = 0; k < ny; k++) {
        const vy = 1.2 + k * 1.6;
        b.cyl('gunmetal', (x0 + x1) / 2, 0.4 + 0.3, vy, 0.3, x1 - x0, { axis: 'x', radial: detailed ? 10 : 6 });
      }
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
        b.add('black', tileMD(x1 - x0, 1, 0.4, 0.03), new Matrix4().makeTranslation((x0 + x1) / 2, 0.4, vy).multiply(new Matrix4().makeRotationX(0)));
        for (let x = x0 + 0.5; x < x1 - 0.4; x += 1.5) b.add('windowWarm', tileMD(0.8, 0.6, 0.45, 0.02), new Matrix4().makeTranslation(x, 0.4, vy));
      }
    } else if (kind === 3) {
      // grille panel + vents
      for (let x = x0; x < x1 - 1; x += 2) for (let vy = 0.8; vy < h - 1.2; vy += 1.1) b.add('dbg', grilleMD(1.9, 1, 0.4, 0.03), new Matrix4().makeTranslation(x + 1, 0.4, vy + 0.5));
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
  const T = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);
  if (wants(b, (ha + hb) / 2, 0.5, hh / 2)) {
    b.box('dbg', ha - 0.6, dF / 2, hh / 2, 1.2, dF, hh, { hide: { ny: true } });
    b.box('dbg', hb + 0.6, dF / 2, hh / 2, 1.2, dF, hh, { hide: { ny: true } });
    b.box('lbg', (ha + hb) / 2, dF / 2, 0.45, hb - ha + 2.4, dF, 0.9, { hide: { ny: true } });
    if (side > 0) {
      // open bay: lit back wall with ribs and control windows, ceiling lights, floor guide lines,
      // ray shield across the mouth
      const wallH = hh - 1.3;
      b.add('lbg', tileMD(hb - ha, wallH, 0.2, 0.02), T((ha + hb) / 2, 0, 0.9 + wallH / 2));
      for (let x = ha + 2; x < hb - 1; x += 3) b.box('dbg', x, 0.4, 0.9 + wallH / 2, 0.5, 0.4, wallH, { hide: { ny: true } });
      for (let x = ha + 1; x < hb - 1.5; x += 1.5) b.add('windowWarm', tileMD(1.0, 0.45, 0.3, 0.02), T(x + 0.5, 0.05, 1.7));
      for (let x = ha + 1.5; x < hb - 1; x += 3) b.box('glowWhite', x, dF * 0.55, 0.95, 1.8, 0.35, 0.1, { c: 0 });
      for (const y of [0.35, 0.75]) b.box('yellow', (ha + hb) / 2, dF * y, hh - 0.45, hb - ha - 1, 0.22, 0.08, { c: 0 });
      for (let x = ha + 3; x < hb - 2; x += 7) b.box('dbg', x, dF * 0.3, hh - 0.9, 1.2, 0.8, 0.9);
      b.add('trLightBlue', tileMD(hb - ha, hh - 1.3, 0.06, 0), T((ha + hb) / 2, dF - 0.1, 0.9 + (hh - 1.3) / 2));
    } else {
      for (let x = ha; x < hb - 0.1; x += 2) b.box('dbg', x + 1, dF * 0.45, 0.9 + (hh - 1.3) / 2, 1.94, 0.5, hh - 1.3, { hide: { ny: true } });
      b.box('yellow', (ha + hb) / 2, dF * 0.45 + 0.27, hh - 1.2, hb - ha - 0.4, 0.06, 0.3, { c: 0 });
    }
  }
  // medium dual turbolaser in the forward trench, barrels toward the bow (−u)
  const um = 150;
  if (wants(b, um, 1, H(um) / 2)) {
    b.push();
    b.translate(um, 0.4, H(um) * 0.5);
    b.cyl('dbg', 0, 0.3, 0, 1.2, 0.6, { radial: 12 });
    b.box('lbg', 0, 1.0, 0, 2.0, 1.2, 1.6);
    b.box('dbg', -1.1, 1.0, 0, 0.4, 0.9, 1.4);
    for (const z of [-0.45, 0.45]) b.cyl('gunmetal', -2.6, 1.0, z, 0.16, 3.0, { axis: 'x', radial: 8 });
    b.pop();
  }
}

/**
 * Row of small lit windows along u (on top of a black band tile row centred at v). Far LODs use
 * flat quads at twice the spacing and width (same lit fraction, half the count).
 */
function litWindows(b: Builder, u0: number, u1: number, vc: number, step: number, w: number, s: number, key: ColorKey = 'windowWarm', flat = false): void {
  if (flat) {
    step *= 2;
    w *= 2;
  }
  const md = flat
    ? topMD(
        [
          [-w / 2, -0.21],
          [w / 2, -0.21],
          [w / 2, 0.21],
          [-w / 2, 0.21],
        ],
        0.5,
      )
    : tileMD(w, 0.42, 0.47, 0.02);
  const si = Math.floor(s * 1e6);
  for (let u = u0; u < u1; u += step) {
    if (h3(u * 4, vc * 10, si) < 0.2) continue;
    if (!wants(b, u, 0.4, vc)) continue;
    b.add(key, md, new Matrix4().makeTranslation(u, 0, vc));
  }
}

// ─── turrets ────────────────────────────────────────────────────────────────────────────────────

function heavyTurret(b: Builder, fine: boolean, side: 1 | -1): void {
  const rad = fine ? 24 : 12;
  // pedestal: level column sunk into the sloped wing, turntable ring
  b.cyl('dbg', 0, -1.3, 0, 3.4, 2.6, { radial: rad, bottom: false });
  b.cyl('lbg', 0, 0.2, 0, 3.05, 0.4, { radial: rad });
  // housing: bevelled side profile (z, y) extruded across x
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
  // roof details
  if (fine) {
    b.add('lbg', tileMD(3.2, 3.6, 0.4, 0.035), new Matrix4().makeTranslation(0, 2.9, -0.6));
    b.add('dbg', grilleMD(2, 1, 0.4, 0.03), new Matrix4().makeTranslation(0, 2.9, -2.4));
    b.cyl('lbg', 1.6 * side, 3.3, 0.8, 0.45, 0.4, { radial: 10 });
    b.box('dbg', -1.8 * side, 3.1, -1.4, 0.8, 0.4, 1.6);
  }
  // mantlet and twin barrels
  b.box('dbg', 0, 1.95, 2.7, 4.0, 1.6, 1.0);
  for (const x of [1.1, -1.1]) {
    b.cyl('dbg', x, 1.95, 3.9, 0.62, 2.0, { axis: 'z', radial: fine ? 12 : 8 });
    b.cyl('gunmetal', x, 1.95, 7.0, 0.32, 6.6, { axis: 'z', radial: fine ? 10 : 6 });
    if (fine) b.cyl('dbg', x, 1.95, 6.6, 0.42, 0.5, { axis: 'z', radial: 10 });
    b.cyl('flatSilver', x, 1.95, 10.1, 0.44, 0.6, { axis: 'z', radial: fine ? 10 : 6 });
  }
}

function pdTurret(b: Builder, fine: boolean): void {
  b.cyl('dbg', 0, 0.2, 0, 0.9, 0.4, { radial: fine ? 12 : 8 });
  b.box('lbg', 0, 0.85, 0, 1.4, 0.9, 1.4);
  b.cyl('gunmetal', 0.32, 0.95, 1.4, 0.13, 2.0, { axis: 'z', radial: 6 });
  b.cyl('gunmetal', -0.32, 0.95, 1.4, 0.13, 2.0, { axis: 'z', radial: 6 });
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
  for (const [t, s] of [[a0, -1], [a1, 1]] as const) {
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

/** dark solid inside a tiled frustum so every seam shows shadow, never a hole */
function hiddenCore(b: Builder, bottom: P2[], y0: number, top: P2[], y1: number, d = 0.45): void {
  const B = ccw(bottom);
  const off = B.map(() => d);
  b.add('dbg', frustumMD(offsetEdges(B, off), y0, offsetEdges(top, off), y1 - d));
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
  /** rows (v, integer) that are black window bands */
  bands: number[];
  lit: boolean;
  /** far LOD: flat windows */
  flat?: boolean;
  winKey?: ColorKey;
  step: number;
  w: number;
  style: (u: number, v: number) => TStyle | null;
}
/** lit windows along each band row of a face polygon (face-frame coordinates) */
function bandWindows(b: Builder, poly: P2[], bands: number[], step: number, w: number, seed: number, key: ColorKey | undefined, flat: boolean): void {
  for (const v0 of bands) {
    const a = spanAt(poly, v0 + 0.05), c = spanAt(poly, v0 + 0.95);
    if (!a || !c) continue;
    litWindows(b, Math.max(a[0], c[0]) + 1.2, Math.min(a[1], c[1]) - 1.2, v0 + 0.5, step, w, h3(seed, v0, 3), key, flat);
  }
}
/** tile a planar face whose black band rows carry small lit windows */
function bandedFace(b: Builder, face: V3[], o: BandOpts): Frame {
  const f = tileFace(b, face, { seed: o.seed, outward: o.outward, module: o.module, period: o.period, studs: o.studs, style: o.style });
  if (!o.lit || !o.bands.length) return f;
  const poly = face.map((p) => toLocal(f, p));
  inFrame(b, f, () => bandWindows(b, poly, o.bands, o.step, o.w, o.seed, o.winKey, !!o.flat));
  return f;
}

function superstructure(b: Builder, cfg: Cfg, L: Styles, anchors: Record<string, V3>): void {
  const fine = cfg.fine;
  const seed = cfg.seed * 53 + 7;
  // ── level 1: long wedge over the aft third, raked front, sloped flanks, vertical stern ──
  const k1 = edgeKinds(SUP_BOTTOM);
  const L1f = frustum(SUP_BOTTOM, SUP_Y0, k1.map(offL1), SUP_Y1);
  hiddenCore(b, SUP_BOTTOM, SUP_Y0, L1f.top, SUP_Y1);
  const c1: V3 = [0, (SUP_Y0 + SUP_Y1) / 2, (SUP_FRONT_Z + ZS) / 2];
  L1f.faces.forEach((face, i) => {
    const k = k1[i];
    const bands = BANDS_L1(k);
    const top = k === 'front' ? 23 : 17;
    bandedFace(b, face, {
      seed: seed + i,
      outward: faceOut(face, c1),
      module: 12,
      period: 4,
      studs: fine,
      bands,
      lit: true,
      flat: !fine,
      step: 2,
      w: 0.8,
      style: (u, v) => {
        if (v < 1.5) return L.trimD;
        if (k === 'rear') return aztec(u, v, seed + 9, 12, 4, (r) => (r < 0.6 ? L.panelL : L.panelD)) ?? L.fieldL;
        const r = Math.floor(v);
        if (bands.includes(r)) return L.black;
        if (bands.includes(r - 1)) return L.trimD;
        if (v >= top) return L.trim;
        return aztec(u, v, seed + 10 + i, 12, 5, (q) => (q < 0.55 ? L.panelL : q < 0.75 ? L.raisedL : L.plateL)) ?? L.field;
      },
    });
  });
  // L1 roof: vents along the front edge, panel patchwork, point defence and sensor domes
  const inL2 = (x: number, z: number, m = 0.4) => {
    if (z > L2_FRONT_Z - m) return false;
    const k = (z - L2_FRONT_Z) / (ZS - L2_FRONT_Z);
    return Math.abs(x) < 18 + 16 * k - m;
  };
  tileFace(b, L1f.top.map((p) => to3(p, SUP_Y1)), {
    seed: seed + 20,
    outward: [0, 1, 0],
    uDir: [0, 0, -1],
    module: 12,
    period: 3,
    studs: fine,
    worldMask: (p) => inL2(p.x, p.z),
    style: (u, v) => {
      if (u < 1) return L.trimD;
      if (u < 3) return L.grilleD;
      return aztec(u, v + 40, seed + 21, 12, 6, (r) => (r < 0.4 ? L.plateL : r < 0.7 ? L.panelD : L.grilleD)) ?? L.fieldL;
    },
  });
  for (const [x, z] of [
    [20, -100],
    [31, -150],
    [36, -176],
  ] as [number, number][]) {
    for (const sx of [1, -1]) {
      if (!wants(b, x * sx, SUP_Y1, z)) continue;
      b.at(x * sx, SUP_Y1 + 0.4, z, () => pdTurret(b, fine));
    }
  }
  if (fine) {
    for (const sx of [1, -1]) {
      b.cyl('dbg', 8 * sx, SUP_Y1 + 0.6, -84, 2.2, 0.4, { radial: 20 });
      b.lathe('white', profile([[0, 1.9], [1.2, 1.55], [1.8, 0.8], [2, 0]]), { at: [8 * sx, SUP_Y1 + 0.8, -84], radial: 20 });
    }
  }
  // ── level 2 ──
  const k2 = edgeKinds(L2_BOTTOM);
  const L2f = frustum(L2_BOTTOM, SUP_Y1, k2.map(offL2), SUP2_Y1);
  hiddenCore(b, L2_BOTTOM, SUP_Y1, L2f.top, SUP2_Y1);
  const c2: V3 = [0, (SUP_Y1 + SUP2_Y1) / 2, -150];
  L2f.faces.forEach((face, i) => {
    const k = k2[i];
    const bands = k === 'rear' ? [] : [3];
    bandedFace(b, face, {
      seed: seed + 30 + i,
      outward: faceOut(face, c2),
      module: 8,
      period: 3,
      studs: fine,
      bands,
      lit: true,
      flat: !fine,
      winKey: 'windowCool',
      step: 1.5,
      w: 0.6,
      style: (u, v) => {
        if (v < 1) return L.trimD;
        if (bands.includes(Math.floor(v))) return L.black;
        return k === 'rear' ? L.fieldL : aztec(u, v, seed + 31 + i, 8, 3, (q) => (q < 0.6 ? L.panelL : L.raisedW)) ?? L.field;
      },
    });
  });
  const inTower = (x: number, z: number) => {
    const ax = Math.abs(x);
    return ax > TOWER_X - 4.3 && ax < TOWER_X + 4.3 && z < -140 && z > -184.5;
  };
  const inNeck = (x: number, z: number) => Math.abs(x) < 6.6 && z < -151.9 && z > -184.5;
  tileFace(b, L2f.top.map((p) => to3(p, SUP2_Y1)), {
    seed: seed + 40,
    outward: [0, 1, 0],
    uDir: [0, 0, -1],
    module: 8,
    studs: fine,
    worldMask: (p) => inTower(p.x, p.z) || inNeck(p.x, p.z),
    style: (u, v) => {
      if (u < 1) return L.trimD;
      return aztec(u, v, seed + 41, 8, 4, (r) => (r < 0.45 ? L.plateL : r < 0.7 ? L.grilleL : L.panelD)) ?? L.fieldL;
    },
  });
  // connecting block between the towers
  const NY = NECK_Y;
  const neck = frustum(NECK, SUP2_Y1, edgeKinds(NECK).map(offNeck), NY);
  hiddenCore(b, NECK, SUP2_Y1, neck.top, NY);
  const cn: V3 = [0, SUP2_Y1 + 2.5, -168];
  neck.faces.forEach((face, i) =>
    bandedFace(b, face, {
      seed: seed + 50 + i,
      outward: faceOut(face, cn),
      module: 6,
      studs: fine,
      bands: [2],
      lit: true,
      flat: !fine,
      winKey: 'windowCool',
      step: 1.5,
      w: 0.6,
      style: (u, v) => (v < 1 ? L.trimD : v >= 2 && v < 3 ? L.black : L.fieldL),
    }),
  );
  tileFace(b, neck.top.map((p) => to3(p, NY)), {
    seed: seed + 55,
    outward: [0, 1, 0],
    uDir: [0, 0, 1],
    studs: fine,
    style: (u, v) => (Math.abs(v - 5.3) < 1 ? L.grilleD : h3(Math.floor(u / 3), Math.floor(v / 3), seed + 56) < 0.3 ? L.plateL : L.fieldL),
  });
  if (fine) {
    const y = NY + 0.4;
    b.cyl('lbg', 0, y + 3.2, -178, 0.28, 6.4, { radial: 10 });
    b.cyl('flatSilver', 0, y + 6.9, -178, 0.14, 1.0, { radial: 8 });
    b.lathe('lbg', profile([[0.2, 0.9], [1.3, 0.35], [1.5, 0]]), { at: [0, y + 4.6, -178], radial: 14 });
    b.cyl('dbg', 0, y + 0.2, -160, 1.9, 0.4, { radial: 18 });
    b.lathe('white', profile([[0, 1.6], [1.0, 1.3], [1.5, 0.7], [1.7, 0]]), { at: [0, y + 0.4, -160], radial: 18 });
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

function tower(b: Builder, cfg: Cfg, L: Styles, foot: P2[], seed: number, sx: 1 | -1): void {
  const fine = cfg.fine;
  const F = ccw(foot);
  const kinds = edgeKinds(F);
  // rear nearly vertical, flanks slightly battered, raked leading edge
  const tw = frustum(F, SUP2_Y1, kinds.map(offTower), TOWER_Y1);
  const ct: V3 = [TOWER_X, (SUP2_Y1 + TOWER_Y1) / 2, -164];
  hiddenCore(b, F, SUP2_Y1, tw.top, TOWER_Y1 + 0.4);
  tw.faces.forEach((face, i) => {
    const k = kinds[i];
    const o = faceOut(face, ct);
    if (k === 'front') {
      // leading edge: a vent column up the nose
      tileFace(b, face, { seed: seed + i, outward: o, module: 4, studs: fine, style: (u, v) => (v < 1 ? L.trimD : L.grilleDv) });
      return;
    }
    // three window bands with light trim lines between white panelling
    const bands = BANDS_TOWER(k);
    bandedFace(b, face, {
      seed: seed + i,
      outward: o,
      module: 6,
      period: 4,
      studs: fine,
      bands,
      lit: true,
      flat: !fine,
      step: k === 'rear' ? 2.5 : 2,
      w: 0.6,
      style: (u, v) => {
        if (v < 1) return L.trimD;
        const r = Math.floor(v);
        if (bands.includes(r)) return L.black;
        if (bands.includes(r + 1) || bands.includes(r - 1)) return L.trim;
        if (k === 'rear') return aztec(u, v, seed + 5, 6, 3, (q) => (q < 0.5 ? L.panelL : L.panelD)) ?? L.fieldL;
        return aztec(u, v, seed + 7 + i, 6, 2, (q) => (q < 0.6 ? L.panelL : L.raisedW)) ?? L.field;
      },
    });
  });
  // ── command bridge ──
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
    studs: fine,
    worldMask: (p) => inConvex(under, p.x, p.z),
    style: () => L.plateL,
  });
  const cb: V3 = [X, (y0 + y3) / 2, -165];
  const flare = frustum(under, y0, under.map(() => -3.2), y1);
  b.add('dbg', frustumMD(under, y0, plan, y1));
  flare.faces.forEach((face, i) => {
    const o = faceOut(face, [cb[0], y1 + 2, cb[2]]);
    tileFace(b, face, { seed: seed + 20 + i, outward: o, module: 6, style: (u, v) => (v < 1 ? L.trimD : (Math.floor(u) % 6 === 0 ? L.panelD : L.panelL)) });
  });
  // body: panoramic windows on the three front faces, small windows around the rest
  const body = frustum(plan, y1, plan.map(() => 0), y2);
  b.add('dbg', frustumMD(offsetEdges(plan, plan.map(() => 0.45)), y1, offsetEdges(plan, plan.map(() => 0.45)), y2));
  body.faces.forEach((face, i) => {
    const o = faceOut(face, cb);
    const front = pk[i] === 'front' || pk[i] === 'bevel';
    bandedFace(b, face, {
      seed: seed + 30 + i,
      outward: o,
      module: 6,
      period: 3,
      studs: false,
      bands: front ? [] : [1],
      lit: true,
      flat: !fine,
      winKey: 'windowCool',
      step: 1.25,
      w: 0.55,
      style: (u, v) => {
        if (v < 1) return L.trimW;
        if (v < 2.4 && (front || v < 2)) return L.black;
        return L.trimW;
      },
    });
    if (front) {
      // glowing panoramic windows behind dark glass
      const f = faceFrame(face, o);
      const lenU = toLocal(f, face[1])[0];
      inFrame(b, f, () => {
        if (!wants(b, lenU / 2, 0.3, 1.7)) return;
        b.add('windowCool', tileMD(lenU - 0.6, 1.1, 0.22, 0.02), new Matrix4().makeTranslation(lenU / 2, 0.36, 1.7));
        for (let u = 1; u < lenU - 0.5; u += 1) b.add('white', tileMD(0.16, 1.2, 0.62, 0.02), new Matrix4().makeTranslation(u, 0.2, 1.7));
        b.add('trBlack', tileMD(lenU - 0.4, 1.4, 0.12, 0.01), new Matrix4().makeTranslation(lenU / 2, 0.62, 1.7));
      });
    }
  });
  // roof
  const roof = frustum(plan, y2, plan.map(() => 1.3), y3);
  b.add('dbg', frustumMD(plan, y2, roof.top, y3 - 0.4));
  roof.faces.forEach((face, i) => tileFace(b, face, { seed: seed + 40 + i, outward: faceOut(face, [cb[0], y2 - 3, cb[2]]), module: 6, style: () => L.fieldL }));
  tileFace(b, roof.top.map((p) => to3(p, y3)), {
    seed: seed + 50,
    outward: [0, 1, 0],
    uDir: [0, 0, 1],
    module: 6,
    studs: fine,
    style: (u, v) => (h3(Math.floor(u / 3), Math.floor(v / 3), seed + 51) < 0.25 ? L.plateL : L.fieldL),
  });
  if (fine) {
    b.cyl('lbg', X + 3 * sx, y3 + 0.4 + 2.2, -172, 0.22, 4.4, { radial: 8 });
    b.cyl('lbg', X - 2 * sx, y3 + 0.4 + 1.4, -174, 0.18, 2.8, { radial: 8 });
    b.box('dbg', X, y3 + 0.4 + 0.3, -168, 3, 0.6, 2);
    b.lathe('white', profile([[0, 0.9], [0.9, 0.5], [1.1, 0]]), { at: [X - 4 * sx, y3 + 0.4, -160], radial: 14 });
  }
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
  const fine = cfg.fine;
  const rad = fine ? 32 : 16;
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
      const ring = (key: ColorKey, z: number, rOut: number, rIn: number, h: number) =>
        b.add(key, tube(rOut, rIn, h, 0.04, rad), new Matrix4().makeTranslation(x, y, z).multiply(ROT_Y_TO_Z));
      if (fine) {
        for (const f of [0.28, 0.52, 0.76]) {
          const rb = R * (0.87 + 0.1 * f);
          ring('gunmetal', ZS - 0.6 - Lz * f, rb + 0.2, rb - 0.1, 0.6);
        }
        ring('lbg', zExit + 0.25, R + 0.12, R * 0.9, 0.5);
      }
      // glow: blue exhaust plate with a hot cyan core
      b.cyl('glowBlue', x, y, zExit + 3.0, R * 0.8, 0.3, { axis: 'z', radial: rad });
      b.cyl('glowCyan', x, y, zExit + 2.7, R * 0.5, 0.3, { axis: 'z', radial: rad });
      if (fine) {
        // stator in front of the glow: a ring around the hot core and eight radial vanes
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
  if (fine) {
    for (let y = -27; y < -5; y += 2.2) b.add('dbg', grilleMD(1, 2, 0.4, 0.03), new Matrix4().makeTranslation(0, y, ZS - 12.6).multiply(new Matrix4().makeRotationX(-Math.PI / 2)).multiply(new Matrix4().makeRotationY(Math.PI / 2)));
    for (const y of [-26, -6]) b.box('white', 0, y, ZS - 6, hx * 2 + 0.3, 1.2, 11);
  }
  b.box('dbg', 0, -2, ZS - 5, hx * 2 + 2, 2, 10);
}

// ─── lod 2 ──────────────────────────────────────────────────────────────────────────────────────

const FAR = 1e4;

/** far-LOD overlay: the rectangle [u0,u1]×[v0,v1] clipped to a CCW face polygon, as one flat top face */
function patch(b: Builder, poly: P2[], key: ColorKey, u0: number, u1: number, v0: number, v1: number, lift = 0.4): void {
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
  const dorsalPts: V3[] = [TIP, st(R0), st(D1)];
  const fD = faceFrame(dorsalPts, [0, 1, 0]);
  const emblemW = new Vector3(22, 0, 2);
  emblemW.y = dorsalY(emblemW.x, emblemW.z);
  const emblem = toLocal(fD, emblemW);
  const pads = TURRETS.map(([x, z]) => toLocal(fD, [x, dorsalY(x, z), z]));
  const covered = (u: number, v: number) => {
    const w = toWorld(fD, u, v);
    return inSuper(w.x, w.z, 0.6) || Math.hypot(u - emblem[0], v - emblem[1]) < 8.2;
  };
  const inStripe = (u: number, v: number) => {
    for (let k = 0; k < 4; k++) if (u >= 235 + k * 14 && v >= 4.5 + k * 4 && v < 7.5 + k * 4) return true;
    return false;
  };
  overlay(b, dorsalPts, [0, 1, 0], (poly, len) => {
    patch(b, poly, 'lbg', 0, FAR, 0, 1);
    patch(b, poly, 'dbg', 40, FAR, 1, 2);
    for (let k = 0; k < 4; k++) patch(b, poly, 'darkRed', 236 + k * 14, FAR, 5 + k * 4, 7 + k * 4);
    for (const [tu, tv] of pads) patch(b, poly, 'dbg', tu - 5, tu + 5, tv - 5, tv + 5);
    for (let u = 32; u < len; u += 32) patch(b, poly, 'lbg', u, u + 1, 2, FAR);
    aztecRects(len, 90, hs + 3, 16, 6, 2, (u0, u1, v0, v1, r) => {
      if (r >= 0.8 && r < 0.9) return; // white raised panels: invisible on white at this range
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      if (v0 < 2 || covered(uc, vc) || inStripe(uc, vc) || onSeam(u0, u1, 32)) return;
      for (const [tu, tv] of pads) if (Math.abs(uc - tu) < 7 && Math.abs(vc - tv) < 7) return;
      patch(b, poly, r < 0.8 ? 'lbg' : 'dbg', u0, u1, v0, v1);
    });
    const at = new Matrix4().makeTranslation(emblem[0], 0, emblem[1]);
    b.add('white', discMD(7.6, 0.4, 20), at);
    b.add('darkRed', discMD(6.3, 0.8, 20), at);
    for (const a0 of [0.35, Math.PI + 0.35]) b.add('yellow', arcMD(3.7, 5.3, 1.05, a0, a0 + Math.PI - 0.7, 8), at);
    b.add('darkRed', discMD(2.2, 1.0, 10), at);
  });
  // rim: red bow, white top line, black band with warm windows
  overlay(b, [TIP, st(R0), st(R1)], [1, 0, 0], (poly, len) => {
    const uWin = Math.ceil(len * 0.44);
    patch(b, poly, 'darkRed', 0, 30, 0, FAR);
    patch(b, poly, 'white', 30, FAR, 0, 1);
    patch(b, poly, 'black', uWin, FAR, 1, 2);
    litWindows(b, uWin + 2, len - 2, 1.5, 4, 0.8, h3(hs, 4, 1), 'windowWarm', true);
  });
  // lower side band: dark top line, red bow, black band with warm windows
  overlay(b, [TIP, st(L0), st(L1)], [1, 0, 0], (poly, len) => {
    const uWin = Math.ceil(len * 0.56);
    patch(b, poly, 'darkRed', 0, 26, 0, FAR);
    patch(b, poly, 'dbg', 26, FAR, 0, 1);
    patch(b, poly, 'black', uWin, FAR, 1, 2);
    litWindows(b, uWin + 2, len - 2, 1.5, 5, 0.6, h3(hs, 8, 1), 'windowWarm', true);
  });
  // ventral wing: red bow, seams, patchwork
  overlay(b, [TIP, st(L1), st(K1)], [0.3, -1, 0], (poly, len) => {
    patch(b, poly, 'darkRed', 0, 34, 0, FAR);
    for (let u = 48; u < len; u += 48) patch(b, poly, 'dbg', u, u + 1, 1, FAR);
    aztecRects(len, 80, hs + 10, 24, 8, 0, (u0, u1, v0, v1, r) => {
      if (r >= 0.8 || v0 < 1 || u0 < 34 || onSeam(u0, u1, 48)) return;
      patch(b, poly, r < 0.55 ? 'white' : 'dbg', u0, u1, v0, v1);
    });
  });
  // the open port hangar: lit back wall and floor lights in the trench
  if (side > 0) {
    overlay(b, [TIP, st(T0), st(T1)], [1, 0, 0], (poly, len) => {
      const ha = len - 70, hb = len - 42, hh = (7 * ha) / len;
      patch(b, poly, 'lbg', ha + 1, hb - 1, 0.8, hh - 0.5);
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
      bandWindows(b, poly, bands, 2, 0.8, seed + i, undefined, true);
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
      bandWindows(b, poly, [3], 1.5, 0.6, seed + 30 + i, 'windowCool', true);
    });
  });
  // neck between the towers
  const neck = frustum(NECK, SUP2_Y1, edgeKinds(NECK).map(offNeck), NECK_Y);
  b.add('lbg', frustumMD(NECK, SUP2_Y1, neck.top, NECK_Y));
  const cn: V3 = [0, SUP2_Y1 + 2.5, -168];
  neck.faces.forEach((face, i) =>
    overlay(b, face, faceOut(face, cn), (poly) => {
      patch(b, poly, 'dbg', -FAR, FAR, 0, 1);
      patch(b, poly, 'black', -FAR, FAR, 2, 3);
      bandWindows(b, poly, [2], 1.5, 0.6, seed + 50 + i, 'windowCool', true);
    }),
  );
  for (const sx of [1, -1] as const) {
    b.push();
    if (sx < 0) b.mirrorX();
    lod2Tower(b, seed + 100);
    b.pop();
    anchors[sx > 0 ? 'bridgeL' : 'bridgeR'] = [TOWER_X * sx, BRIDGE_Y[3] + 0.4, -164];
  }
}

function lod2Tower(b: Builder, seed: number): void {
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
      bandWindows(b, poly, bands, k === 'rear' ? 2.5 : 2, 0.6, seed + i, undefined, true);
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
      bandWindows(b, poly, [1], 1.25, 0.55, seed + 30 + i, 'windowCool', true);
    });
  });
}

function lod2(b: Builder, seed: number, anchors: Record<string, V3>): void {
  const full: P2[] = [...PORT_SECTION.map(([x, y]) => [-x, y] as P2), ...PORT_SECTION.slice().reverse()];
  // per-face colours of the cone (edge i of `full`)
  const acc: Record<string, MeshAcc> = {};
  const n = full.length;
  const face = (i: number): ColorKey => {
    const a = full[i], c = full[(i + 1) % n];
    const my = (a[1] + c[1]) / 2;
    const mx = Math.abs((a[0] + c[0]) / 2);
    const vertical = Math.abs(a[0] - c[0]) < 0.01;
    if (my >= 15.9) return 'darkRed'; // flight deck
    if (my > 2 && mx > 18) return 'white'; // dorsal wings
    if (vertical && mx > 95) return 'lbg'; // rim
    if (vertical && Math.abs(mx - L0[0]) < 0.01) return 'white'; // lower side band
    if (my < -10) return 'lbg'; // ventral wings, keel
    return 'dbg'; // trench
  };
  for (let i = 0; i < n; i++) {
    const key = face(i);
    const a: V3 = [full[i][0], full[i][1], ZS], c: V3 = [full[(i + 1) % n][0], full[(i + 1) % n][1], ZS];
    const m = (acc[key] ??= new MeshAcc());
    const cen = [0, -8];
    const nrm = polyNormal([TIP, a, c]);
    const mid = [(a[0] + c[0]) / 2 - cen[0], (a[1] + c[1]) / 2 - cen[1]];
    const s = nrm[0] * mid[0] + nrm[1] * mid[1] >= 0 ? 1 : -1;
    m.tri(TIP, a, c, [nrm[0] * s, nrm[1] * s, nrm[2] * s]);
  }
  for (const [k, m] of Object.entries(acc)) b.add(k as ColorKey, m.done());
  b.add('lbg', coneSolidMD([0, 0, ZT - 1], offsetEdges(full, full.map(() => 0.05)), ZS));
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

// ─── assembly ───────────────────────────────────────────────────────────────────────────────────

/** Venator-class Star Destroyer, macro-brick scale, 3200 units long. Owner: asset agent B. */
export function venator(o: { lod: 0 | 1 | 2; seed?: number }): CapitalShip {
  const seed = o.seed ?? 1;
  const group = new Group();
  group.name = 'venator';
  const engineGlows: Mesh[] = [];
  const anchorsStud: Record<string, V3> = {};
  const muzzles: V3[] = [];
  const collectGlows = (g: Group) => g.traverse((m) => {
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
    const cfg: Cfg = { lod: 1, fine: false, seed };
    const L = styleSet(1);
    const b = new Builder({ seed: seed * 7, studSegments: 6 });
    b.scale(S);
    const out: HullOut = { turretMuzzles: [], frames: {} };
    hull(b, cfg, L, out);
    superstructure(b, cfg, L, anchorsStud);
    engines(b, cfg);
    const built = b.build('venator-lod1');
    group.add(built.group);
    collectGlows(built.group);
    muzzles.push(...out.turretMuzzles);
  } else {
    const cfg: Cfg = { lod: 0, fine: true, seed };
    const L = styleSet(0);
    // hull split into zones along the ship (frustum culling, bounded arrays)
    const cuts = [110, 30, -50, -120];
    const pick = (_x: number, _y: number, z: number) => {
      const zs = z / S;
      let i = 0;
      while (i < cuts.length && zs < cuts[i]) i++;
      return i;
    };
    let hullOut: HullOut | null = null;
    for (let zone = 0; zone <= cuts.length; zone++) {
      const b = new ZoneBuilder({ seed: seed * 7 + zone, studSegments: 10 }, zone, pick);
      b.scale(S);
      const out: HullOut = { turretMuzzles: [], frames: {} };
      hull(b, cfg, L, out);
      hullOut ??= out;
      const built = b.build(`venator-hull-${zone}`);
      group.add(built.group);
    }
    muzzles.push(...hullOut!.turretMuzzles);
    {
      const b = new Builder({ seed: seed * 7 + 91, studSegments: 12 });
      b.scale(S);
      superstructure(b, cfg, L, anchorsStud);
      group.add(b.build('venator-superstructure').group);
    }
    {
      const b = new Builder({ seed: seed * 7 + 93, studSegments: 8 });
      b.scale(S);
      engines(b, cfg);
      const built = b.build('venator-engines');
      group.add(built.group);
      collectGlows(built.group);
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
