import { Group, Matrix4, Mesh, Object3D, Vector3, type Material } from 'three';
import { Builder, PLATE } from '../core/builder';
import { tube } from '../core/geom';
import type { ColorKey } from '../core/palette';
import { hash3, Rng } from '../core/rng';
import type { InvisibleHand } from './types';
import {
  anchorFrom,
  bar,
  cutSecs,
  flatQuad,
  frameFwd,
  greeblePatch,
  grille,
  insideSec,
  loft,
  podSecs,
  roundPlate,
  secAt,
  sideProfile,
  surf,
  thForY,
  thList,
  withFrame,
  type Sec,
  type TileCtx,
  type TileSpec,
} from './d-kit';
import { rayShield } from './d-shield';

/**
 * The Invisible Hand — Providence-class carrier/destroyer, General Grievous's flagship — as a
 * macro-scale LEGO display build: every hull panel is a separate plate over a dark frame, built in
 * studs with ×8 pushed (≈380 studs → ≈3040 units). Nose +Z, port +X. The main hangar is a recessed
 * slot in the port blister; its open centre bay (100 × 36 units) carries the blue ray shield.
 */

const S = 8;
const range = (a: number, b: number, step: number): number[] => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);

/* --- main hull ------------------------------------------------------------------------------ */
const HULL0: Sec[] = [
  { z: -186, a: 14, b: 12.5, bb: 11.5 },
  { z: -178, a: 16.6, b: 14.6, bb: 13 },
  { z: -165, a: 18.3, b: 15.7, bb: 14 },
  { z: -140, a: 19, b: 16.1, bb: 14.5 },
  { z: -100, a: 19.4, b: 16.2, bb: 14.5 },
  { z: -40, a: 19.4, b: 16, bb: 14 },
  { z: 0, a: 19, b: 15.6, bb: 13.2 },
  { z: 60, a: 18.4, b: 15.2, bb: 12.6 },
  { z: 105, a: 17.4, b: 14.6, bb: 12 },
  { z: 130, a: 16, b: 13.2, bb: 11.2 },
  { z: 146, a: 14.2, b: 10.8, bb: 9.8, y0: -0.2 },
  { z: 158, a: 12.4, b: 8, bb: 8, y0: -0.5 },
  { z: 168, a: 10.4, b: 5.3, bb: 6.2, y0: -0.9 },
  { z: 176, a: 8, b: 3.3, bb: 4.4, y0: -1.2 },
  { z: 182, a: 5.4, b: 2, bb: 2.9, y0: -1.4 },
  { z: 186.5, a: 2.2, b: 0.8, bb: 1.3, y0: -1.5 },
].map((s) => ({ n: 2.7, nb: 2.4, ...s }));
/** livery bands on the hull (z ranges) — stations are cut on their edges so they read as clean stripes */
const HULL_BLUE: [number, number][] = [[4, 8], [10, 14], [66, 70]];
const HULL_WHITE: [number, number][] = [[72, 74]];
const HULL_YELLOW: [number, number][] = [[84, 86], [128, 131]];
const HULL = cutSecs(HULL0, [...range(-174, 138, 12), 152, 163, 172, ...[...HULL_BLUE, ...HULL_WHITE, ...HULL_YELLOW].flat()]);
const inZ = (z: number, bands: [number, number][]): boolean => bands.some(([a, b]) => z > a && z < b);

/* --- side blisters and the hangar slot ------------------------------------------------------- */
const MZ = -75;
const MY = 0.6;
const MW = 12.5;
const MH = 4.5;
const SZ0 = -108;
const SZ1 = -42;
const SY0 = MY - 3.1;
const SY1 = MY + 3.1;
const PM = 3;
const XF = 32.2;
const XB = XF - 3;
const ROOM_X = XB - 10;
const BL_BASE = { a: 13, b: 19.5, bb: 19, y0: 0, n: 2.3, nb: 2.3 };
const BL_BLUE: [number, number][] = [[-35, -30], [-45, -40], [-55, -50], [-68, -62], [-124, -120], [-131, -127]];
const blister = (side: number): Sec[] =>
  podSecs(-150, -8, { ...BL_BASE, x0: 19 * side }, { m: 3, cuts: [SZ0 - PM, SZ0, SZ1, SZ1 + PM, MZ - MW / 2, MZ + MW / 2, ...range(-146, -12, 6), ...BL_BLUE.flat()] });
const BLP = blister(1);
const BLS = blister(-1);

const inPlaque = (x: number, y: number, z: number, m: number): boolean =>
  Math.abs(x) > 22 && y > SY0 - PM + m && y < SY1 + PM - m && z > SZ0 - PM + m && z < SZ1 + PM - m;
const underDeck = (c: Vector3): boolean => c.z > -152 && c.z < -15 && Math.abs(c.x) < 12.6 && c.y < 20 && c.y > 0;
const inBlister = (c: Vector3, m: number): boolean => c.z > -150 && c.z < -8 && insideSec(secAt(BLP, c.z), Math.abs(c.x), c.y, m);
const inHull = (c: Vector3, m: number): boolean => insideSec(secAt(HULL, c.z), c.x, c.y, m);

/* --- belly pod ------------------------------------------------------------------------------ */
const BELLY = podSecs(34, 138, { a: 11.5, b: 8, bb: 10.5, y0: -17.9, n: 2.3, nb: 2.2 }, { m: 2.4, cuts: range(40, 132, 8) });

/* --- window trenches (θ bands measured at midships) ---------------------------------------- */
const MID = secAt(HULL, 0);
const band = (y0: number, y1: number): [number, number] => [thForY(MID, y1, 1), thForY(MID, y0, 1)];
const LOW_TRENCH = band(-6.7, -4.8);
const HIGH_TRENCH = band(8.3, 9.3);
const TRENCHES = [LOW_TRENCH, HIGH_TRENCH];
const inBand = (th: number, bnd: [number, number]): boolean => {
  const t = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const m = t > Math.PI ? Math.PI * 2 - t : t;
  return m > bnd[0] && m < bnd[1];
};

interface Q {
  lod: 0 | 1;
  hullN: number;
  blN: number;
  wid: number;
  lens: number[];
  studs: boolean;
  greeble: boolean;
}

const h3 = (v: Vector3, s = 0): number => hash3(Math.round(v.x * 4) + s * 131, Math.round(v.y * 4), Math.round(v.z * 4));

function mk(q: Q, seed: number, fine = false): Builder {
  const b = new Builder({ seed, studSegments: q.lod ? 6 : fine ? 8 : 6, uvScale: 0.11 / S, tint: 0.05, chamfer: 0.06 });
  b.scale(S);
  return b;
}

/** Window lights along a trench tile (tile frame: X across, Z along). */
function trenchWindows(b: Builder, t: TileCtx, y: number, lit: number, big: boolean): void {
  const pitch = big ? 1.0 : 1.6;
  const cnt = Math.max(1, Math.floor(t.l / pitch));
  for (let i = 0; i < cnt; i++) {
    const z = -t.l / 2 + (i + 0.5) * (t.l / cnt);
    const hv = hash3(Math.round(t.c.x * 7), Math.round((t.c.z + z) * 3), 17);
    if (hv < lit) flatQuad(b, 'windowWarm', 0, y, z, Math.min(big ? 0.7 : 0.35, t.w * 0.5), big ? 0.5 : 0.7);
  }
}

function tileLen(q: Q) {
  return (c: Vector3): number => q.lens[Math.floor(h3(c, 5) * q.lens.length)];
}

/** Panel group id: plates are laid in rectangular sections (12 studs along, ~4 facets across). */
const zoneHash = (z: number, th: number, z0: number, s: number): number => {
  const t = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return hash3(Math.floor((z - z0) / 12), Math.floor(t * 2.3), s);
};

/** Is this tile close enough to the port hangar to deserve full chamfered parts at LOD0? */
const nearHangar = (c: Vector3): boolean => c.x > 5 && c.z > -152 && c.z < 2 && c.y > -19;

/** Hull plating: dark nose, light-grey midships in panel sections, sand-blue livery bands, dark belly. */
function hullSpec(q: Q) {
  return (t: TileCtx): TileSpec | null => {
    const { c, n } = t;
    if (inBlister(c, 0.5) || underDeck(c)) return null;
    if (inBand(t.th, LOW_TRENCH)) return { key: 'black', t: 0.14, fill: (b, tc) => trenchWindows(b, tc, 0.15, c.z > 128 ? 0.25 : 0.62, true) };
    if (inBand(t.th, HIGH_TRENCH)) return { key: 'dbg', t: 0.18, fill: (b, tc) => trenchWindows(b, tc, 0.19, 0.28, false) };
    const hx = h3(c);
    const hy = h3(c, 3);
    const zh = zoneHash(c.z, t.th, -174, 1);
    const up = n.y;
    const z = c.z;
    const dark = z > 126 ? 0.93 : z > 100 ? 0.6 : z < -150 ? 0.45 : up < -0.3 ? 0.75 : 0.2;
    let key: ColorKey = zh < dark ? 'dbg' : 'lbg';
    if (hx < 0.04) key = key === 'dbg' ? 'lbg' : 'dbg';
    if (z > 150 && hy > 0.9) key = 'black';
    if (z < 118 && z > -150 && up > -0.3 && zh > 0.965) key = 'darkTan';
    if (up > 0.2 && inZ(z, HULL_BLUE)) key = 'sandBlue';
    if (up > 0.3 && inZ(z, HULL_WHITE)) key = 'white';
    if (up > 0.35 && z > 128 && z < 131) key = 'yellow';
    if (up > 0.05 && up < 0.75 && z > 84 && z < 86) key = 'yellow';
    let th = PLATE;
    if (hy < 0.06) th = PLATE * 2;
    else if (hy < 0.075 && up > 0) th = PLATE * 3;
    const spec: TileSpec = { key, t: th };
    const near = nearHangar(c);
    if (q.studs && up > 0.82 && hy > 0.1 && hy < (near ? 0.3 : 0.17)) spec.studs = true;
    if (q.greeble && near && hx > 0.52 && hx < 0.56 && t.l > 1.8 && up > -0.2) {
      spec.fill = (b, tc) => {
        b.push();
        b.translate(0, th, 0);
        greeblePatch(b, new Rng(Math.floor(hx * 1e6)), tc.w, tc.l, ['dbg', 'gunmetal', 'lbg'], { density: 0.5 });
        b.pop();
      };
    }
    return spec;
  };
}

function blisterSpec(q: Q) {
  return (t: TileCtx): TileSpec | null => {
    const { c, n } = t;
    if (inHull(c, 0.5) || underDeck(c) || inPlaque(c.x, c.y, c.z, 1)) return null;
    const hx = h3(c, 7);
    const hy = h3(c, 9);
    const zh = zoneHash(c.z, t.th, -146, 2);
    const up = n.y;
    let key: ColorKey = zh < (up < -0.45 ? 0.72 : 0.16) ? 'dbg' : 'lbg';
    if (hx < 0.04) key = key === 'dbg' ? 'lbg' : 'dbg';
    const stripe = inZ(c.z, BL_BLUE);
    if (stripe && (c.y > SY1 + PM + 0.5 || (c.y < SY0 - PM - 0.5 && c.y > -16))) key = 'sandBlue';
    if (!stripe && up > -0.3 && zh > 0.97) key = 'darkTan';
    if (c.z < -140 && hx > 0.5) key = 'dbg';
    let th = PLATE;
    if (hy < 0.06) th = PLATE * 2;
    const spec: TileSpec = { key, t: th };
    if (q.studs && up > 0.8 && hy > 0.1 && hy < (c.x > 0 ? 0.3 : 0.15)) spec.studs = true;
    if (q.greeble && hx > 0.4 && hx < 0.43 && up > -0.3) {
      spec.fill = (b, tc) => {
        b.push();
        b.translate(0, th, 0);
        greeblePatch(b, new Rng(Math.floor(hx * 1e6)), tc.w, tc.l, ['dbg', 'gunmetal', 'lbg'], { density: 0.45 });
        b.pop();
      };
    }
    return spec;
  };
}

function bellySpec() {
  return (t: TileCtx): TileSpec | null => {
    const { c, n } = t;
    if (inHull(c, 0.4)) return null;
    const hx = h3(c, 11);
    const key: ColorKey = n.y < -0.6 ? (hx < 0.35 ? 'dbg' : 'lbg') : hx < 0.75 ? 'dbg' : 'lbg';
    if (Math.abs(n.y) < 0.35 && hx > 0.6 && hx < 0.66) return { key: 'black', t: 0.2, fill: (b, tc) => trenchWindows(b, tc, 0.21, 0.5, true) };
    return { key, t: h3(c, 12) < 0.08 ? PLATE * 2 : PLATE };
  };
}

/** Staggered course of tiles / plates over a rectangle at height y (Y up, stud units). */
function tileField(b: Builder, rng: Rng, x0: number, x1: number, z0: number, z1: number, y: number, keys: ColorKey[], o: { studs?: number; w?: number; lens?: number[]; t?: number; greeble?: number } = {}): void {
  const w = o.w ?? 2;
  const t = o.t ?? PLATE;
  const lens = o.lens ?? [2, 3, 4, 4, 6];
  const cols = Math.max(1, Math.round((x1 - x0) / w));
  const cw = (x1 - x0) / cols;
  for (let i = 0; i < cols; i++) {
    const cx = x0 + (i + 0.5) * cw;
    let z = z0;
    let first = true;
    while (z < z1 - 0.3) {
      let l = rng.pick(lens);
      if (first && i % 2) l = Math.max(1, Math.round(l / 2));
      first = false;
      l = Math.min(l, z1 - z);
      if (z1 - (z + l) < 0.6) l = z1 - z;
      const za = z;
      const zc = za + l / 2;
      const key = rng.pick(keys);
      const tt = rng.chance(0.08) ? t * 2 : t;
      b.box(key, cx, y + tt / 2, zc, cw - 0.07, tt, l - 0.07, { hide: { ny: true } });
      if (o.studs && rng.chance(o.studs)) {
        const nx = Math.max(1, Math.floor(cw + 0.05));
        const nz = Math.max(1, Math.floor(l + 0.05));
        for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) b.stud(key, cx + a - (nx - 1) / 2, y + tt, zc + c - (nz - 1) / 2);
      } else if (o.greeble && rng.chance(o.greeble)) {
        b.push();
        b.translate(cx, y + tt, zc);
        greeblePatch(b, rng, cw, l, ['dbg', 'gunmetal', 'lbg', 'dbg'], { density: 0.55 });
        b.pop();
      }
      z = za + l;
    }
  }
}

/** Window band on a vertical wall at x (facing ±X) from z0..z1 at height y. */
function windowRow(b: Builder, rng: Rng, x: number, side: number, z0: number, z1: number, y: number, h: number, lit = 0.7, pitch = 0.9): void {
  b.box('black', x - side * 0.05, y, (z0 + z1) / 2, 0.2, h, z1 - z0, { hide: { nx: side > 0, px: side < 0 } });
  const cnt = Math.floor((z1 - z0) / pitch);
  for (let i = 0; i < cnt; i++) {
    if (!rng.chance(lit)) continue;
    const z = z0 + (i + 0.5) * ((z1 - z0) / cnt);
    b.push();
    b.translate(x + side * 0.06, y, z);
    b.rotateZ(-side * Math.PI / 2);
    flatQuad(b, 'windowWarm', 0, 0, 0, h * 0.62, pitch * 0.55);
    b.pop();
  }
}

/** Twin turbolaser turret on a surface frame; returns the two muzzle anchors. */
function turret(b: Builder, parent: Object3D, name: string, frame: Matrix4, size = 1): Object3D[] {
  const out: Object3D[] = [];
  withFrame(b, frame, () => {
    b.scale(size);
    b.cyl('dbg', 0, 0.35, 0, 1.7, 0.7, { radial: 14 });
    b.cyl('lbg', 0, 0.85, 0, 1.35, 0.3, { radial: 14 });
    b.box('lbg', 0, 1.55, -0.2, 2.4, 1.1, 2.6);
    sideProfile(b, 'slopeLbg', [[1.1, 1.0], [1.8, 1.0], [1.1, 2.1]], 2.4);
    b.box('dbg', 0, 2.2, -0.6, 1.6, 0.35, 1.4);
    b.box('gunmetal', 0, 1.35, 1.3, 1.8, 0.6, 0.5);
    for (const sx of [-0.5, 0.5]) {
      bar(b, 'gunmetal', [sx, 1.5, 1.2], [sx, 1.5, 4.6], 0.17, { radial: 8 });
      bar(b, 'dbg', [sx, 1.5, 3.9], [sx, 1.5, 4.7], 0.24, { radial: 8 });
      out.push(anchorFrom(b, `${name}-${sx < 0 ? 'l' : 'r'}`, parent, [sx, 1.5, 4.75]));
    }
  });
  return out;
}

/** Antenna mast with optional crossbars / dish; red beacon on top. */
function mast(b: Builder, rng: Rng, x: number, y: number, z: number, h: number): void {
  b.cyl('dbg', x, y + 0.3, z, 0.55, 0.6, { radial: 8 });
  bar(b, 'lbg', [x, y, z], [x, y + h, z], 0.16, { radial: 6 });
  bar(b, 'dbg', [x, y + h * 0.5, z], [x, y + h * 0.8, z], 0.24, { radial: 6 });
  if (rng.chance(0.5)) bar(b, 'lbg', [x - 1, y + h * 0.7, z], [x + 1, y + h * 0.7, z], 0.1, { radial: 5 });
  if (rng.chance(0.25)) b.cyl('lbg', x, y + h * 0.62, z + 0.3, 0.9, 0.12, { axis: 'z', radial: 10 });
  b.cyl('glowRed', x, y + h + 0.1, z, 0.2, 0.2, { radial: 6 });
}

export function invisibleHand(o: { lod: 0 | 1 }): InvisibleHand {
  const lod = o.lod;
  const q: Q =
    lod === 0
      ? { lod, hullN: 60, blN: 66, wid: 2.1, lens: [2, 3, 3, 4, 4, 6], studs: true, greeble: true }
      : { lod, hullN: 32, blN: 34, wid: 4.2, lens: [8, 12, 12], studs: false, greeble: false };
  const flat = lod ? true : (c: Vector3) => !nearHangar(c);
  const group = new Group();
  group.name = 'invisible-hand';
  const anchors: Record<string, Object3D> = {};
  const turrets: Object3D[] = [];
  const engineGlows: Mesh[] = [];
  let tris = 0;
  const parts: Record<string, number> = {};
  const put = (b: Builder, name: string, opt: { castShadow?: boolean } = {}) => {
    const bt = b.build(name, opt);
    group.add(bt.group);
    tris += bt.triangles;
    parts[name] = bt.triangles;
    return bt;
  };
  group.userData.parts = parts;

  /* ---- hull, blisters and belly pod in z chunks (frustum culling at close range) ---- */
  const hullThs = thList(q.hullN, TRENCHES.flatMap(([a, c]) => [a, c, Math.PI * 2 - a, Math.PI * 2 - c]));
  const CH = [-200, -118, -60, -8, 60, 130, 200];
  for (let ci = 0; ci < CH.length - 1; ci++) {
    const b = mk(q, 10 + ci, ci === 1 || ci === 2);
    const zr = { zMin: CH[ci], zMax: CH[ci + 1] };
    loft(b, HULL, { ...zr, ths: hullThs, tileLen: tileLen(q), tileWid: q.wid, spec: hullSpec(q), core: 'dbg', coreSkip: (c) => inBlister(c, 0.8) || underDeck(c), capStart: 'dbg', flat });
    if (CH[ci] < -8) {
      for (const bl of [BLP, BLS]) {
        loft(b, bl, { ...zr, N: q.blN, tileLen: tileLen(q), tileWid: q.wid * 0.9, spec: blisterSpec(q), core: 'dbg', coreSkip: (c) => inHull(c, 0.8) || underDeck(c) || inPlaque(c.x, c.y, c.z, 1), flat });
      }
    }
    if (CH[ci + 1] > 34 && CH[ci] < 138) {
      loft(b, BELLY, { ...zr, N: lod ? 20 : 44, tileLen: tileLen(q), tileWid: q.wid * 1.1, spec: bellySpec(), core: 'dbg', coreSkip: (c) => inHull(c, 0.6), flat: true });
    }
    put(b, `ih-hull-${ci}`);
  }

  const gb = mk(q, 40);
  const rng = new Rng(4040);

  /* ---- nose blade, keel strakes ---- */
  gb.shape('dbg', [[-7.5, 148], [7.5, 148], [4.5, 186], [0, 190.5], [-4.5, 186]], -3.4, 0.8);
  gb.shape('black', [[-5, 160], [5, 160], [3.2, 184], [0, 187.5], [-3.2, 184]], -3.55, 0.2, { hideBottom: false });
  for (const sx of [-1, 1]) {
    gb.shape('gunmetal', [[sx * 3.2, 176], [sx * 3.8, 176], [sx * 2.2, 186], [sx * 1.9, 186]], -2.6, 0.6);
    gb.cyl('glowRed', sx * 3, -2.9, 183, 0.25, 0.3, { radial: 6 });
  }
  gb.cyl('glowRed', 0, -2.8, 190.2, 0.3, 0.4, { radial: 8, axis: 'z' });
  for (let z = -130; z < 30; z += lod ? 30 : 14) {
    const s = secAt(HULL, z);
    const yb = (s.y0 ?? 0) - (s.bb ?? s.b);
    gb.box('dbg', 0, yb + 0.1, z, 3, 1.6, lod ? 22 : 10, { hide: { py: true } });
    if (!lod) {
      gb.push();
      gb.translate(0, yb - 0.7, z);
      gb.rotateX(Math.PI);
      greeblePatch(gb, rng, 2.6, 9, ['dbg', 'gunmetal'], { density: 0.6 });
      gb.pop();
    }
  }

  /* ---- aft deck superstructure ---- */
  const deck = mk(q, 50);
  sideProfile(deck, 'dbg', [[-153, 13], [-14, 13], [-14, 17.2], [-21, 20.2], [-153, 20.2]], 26);
  sideProfile(deck, 'dbg', [[-147, 20.2], [-33, 20.2], [-37, 22.6], [-147, 22.6]], 21);
  sideProfile(deck, 'dbg', [[-151, 22.6], [-97, 22.6], [-100, 25.4], [-151, 25.4]], 16);
  const dr = new Rng(505);
  const dl = lod ? { lens: [10, 14], w: 4.2 } : { lens: [2, 3, 4, 4, 6] };
  tileField(deck, dr, -12.8, 12.8, -152.5, -21.5, 20.2, ['lbg', 'lbg', 'dbg', 'lbg', 'darkTan'], { ...dl, studs: lod ? 0 : 0.035, greeble: lod ? 0 : 0.05 });
  tileField(deck, dr, -10.3, 10.3, -146.5, -37.5, 22.6, ['lbg', 'dbg', 'lbg'], { ...dl, studs: lod ? 0 : 0.03, greeble: lod ? 0 : 0.06 });
  for (const [xa, xb] of [[-7.8, -4.9], [4.9, 7.8]] as const) tileField(deck, dr, xa, xb, -150.5, -100.5, 25.4, ['lbg', 'dbg', 'gunmetal'], { ...dl, w: 1.45, greeble: lod ? 0 : 0.15 });
  // sloped deck front with livery stripes
  deck.push();
  deck.translate(0, 17.2, -14);
  deck.rotateX(Math.atan2(3, 7));
  for (let x = -12; x < 12; x += 2) deck.box(x > -5 && x < 3 ? 'sandBlue' : 'lbg', x + 1, 0.2, -3.8, 1.92, 0.4, 7.4, { hide: { ny: true } });
  deck.pop();
  for (const side of [-1, 1]) {
    windowRow(deck, dr, side * 13.02, side, -150, -24, 18.9, 0.9, 0.62);
    windowRow(deck, dr, side * 10.52, side, -145, -40, 21.5, 0.9, 0.75);
    windowRow(deck, dr, side * 8.02, side, -149, -102, 24.1, 0.8, 0.7, 0.7);
    // deck rails and edge details
    for (let z = -150; z < -24; z += 4) deck.box('gunmetal', side * 12.9, 20.5, z + 2, 0.3, 0.6, 3.6, { hide: { ny: true } });
    for (let z = -144; z < -40; z += lod ? 40 : 18) mast(deck, dr, side * 11.6, 20.6, z, dr.range(5, 11));
  }
  // shield generator dome + radar
  deck.lathe('lbg', [[0, 2.6, 0, 1, 1.4, 2.3, 0.5, 0.85], [1.4, 2.3, 0.5, 0.85, 2.5, 1.2, 0.85, 0.5], [2.5, 1.2, 0.85, 0.5, 2.9, 0, 1, 0]], { radial: 16, at: [0, 22.6, -60] });
  deck.cyl('glowCyan', 0, 25.3, -60, 0.35, 0.3, { radial: 8 });
  deck.cyl('dbg', 0, 23.1, -60, 3.4, 0.8, { radial: 16 });
  deck.cyl('gunmetal', -6, 24.4, -85, 0.35, 3.6, { radial: 8 });
  deck.lathe('lbg', [[0, 0.5, 0, 1, 2.4, 0, 0.3, 0.95], [2.4, 0, 0.3, 0.95, 2.6, 0.2, 1, 0]], { radial: 14, at: [-6, 26.2, -85] });

  /* ---- spire and its command pod ---- */
  const sp = mk(q, 60);
  const SEG = lod ? 5 : 10;
  const Y0 = 25.4;
  const Y1 = 69;
  const fz = (y: number) => -108 + ((y - 25) / (Y1 - 25)) * (-138.5 + 108);
  const rz = (y: number) => -150 + ((y - 25) / (Y1 - 25)) * 2;
  const hw = (y: number) => 4 - ((y - Y0) / (Y1 - Y0)) * 1.4;
  for (let k = 0; k < SEG; k++) {
    const ya = Y0 + ((Y1 - Y0) * k) / SEG;
    const yb = Y0 + ((Y1 - Y0) * (k + 1)) / SEG;
    const w = hw((ya + yb) / 2);
    sideProfile(sp, 'dbg', [[rz(ya), ya], [fz(ya), ya], [fz(yb), yb], [rz(yb), yb]], 2 * w - 0.8);
    const g = 0.18;
    for (const side of [-1, 1]) {
      const cl = (u0: number, u1: number, key: ColorKey) => {
        const P = (u: number, y: number) => [rz(y) + (fz(y) - rz(y)) * u, y];
        sideProfile(sp, key, [P(u0, ya + g), P(u1, ya + g), P(u1, yb - g), P(u0, yb - g)], 0.5, side * (w - 0.25));
      };
      cl(0.62, 0.99, k === SEG - 2 ? 'sandBlue' : (k * 7 + (side > 0 ? 3 : 0)) % 5 === 1 ? 'dbg' : 'lbg');
      cl(0.02, 0.3, k % 4 === 2 ? 'dbg' : 'lbg');
      if (!lod) {
        const P = (u: number, y: number): [number, number, number] => [side * (w - 0.5), y, rz(y) + (fz(y) - rz(y)) * u];
        bar(sp, 'gunmetal', P(0.3, ya + 0.3), P(0.62, yb - 0.3), 0.22, { radial: 6 });
        bar(sp, 'gunmetal', P(0.3, yb - 0.3), P(0.62, ya + 0.3), 0.22, { radial: 6 });
      }
    }
    if (k % 2) sideProfile(sp, 'dbg', [[rz(yb) - 0.3, yb - 0.3], [fz(yb) + 0.3, yb - 0.3], [fz(yb) + 0.3, yb + 0.3], [rz(yb) - 0.3, yb + 0.3]], 2 * w + 0.2);
    if (!lod) {
      for (let i = 0; i < 3; i++) {
        const y = ya + (yb - ya) * (0.25 + i * 0.25);
        const zf = fz(y);
        sp.push();
        sp.translate(0, y, zf);
        sp.rotateX(Math.atan2(yb - ya, fz(ya) - fz(yb)));
        flatQuad(sp, i === 1 ? 'windowWarm' : 'black', 0, 0.06, 0, 2 * w - 1.4, 0.35);
        sp.pop();
      }
    }
  }
  // spire base fairing
  sideProfile(sp, 'lbg', [[-152, 25.4], [-104, 25.4], [-110, 30], [-151, 30]], 9.6);
  // command pod
  const POD = podSecs(-166, -126, { a: 7, b: 3.4, bb: 5.2, y0: 73.2, n: 2.2, nb: 2.6 }, { m: 2.2 });
  const podTh = thList(lod ? 24 : 40, [Math.PI / 2 - 0.25, Math.PI / 2 + 0.3, Math.PI * 1.5 - 0.3, Math.PI * 1.5 + 0.25]);
  loft(sp, POD, {
    ths: podTh,
    tileLen: 3,
    tileWid: 2,
    core: 'dbg',
    flat: true,
    spec: (t) => {
      const m = t.th > Math.PI ? Math.PI * 2 - t.th : t.th;
      if (m > Math.PI / 2 - 0.25 && m < Math.PI / 2 + 0.3) return { key: 'black', t: 0.15, fill: (b, tc) => trenchWindows(b, tc, 0.16, 0.8, true) };
      return h3(t.c, 21) < 0.25 ? 'dbg' : 'lbg';
    },
  });
  sp.cyl('lbg', 0, 76.9, -146, 4.2, 0.8, { radial: 16 });
  sp.cyl('dbg', 0, 77.7, -148, 2.6, 0.8, { radial: 14 });
  for (const [x, z, h] of [[0, -150, 7], [2, -140, 4], [-2.5, -156, 3.5]] as const) mast(sp, rng, x, 78.1, z, h);
  sp.cyl('glowRed', 0, 72.9, -126.2, 0.3, 0.4, { axis: 'z', radial: 8 });

  /* ---- forward command bridge ---- */
  const br = mk(q, 70);
  sideProfile(br, 'dbg', [[96, 12.5], [143, 11], [141, 15.2], [135, 17.4], [100, 17.4], [97, 15.5]], 16);
  sideProfile(br, 'lbg', [[104, 17.4], [133, 17.4], [131, 19.6], [106, 19.6]], 11);
  const brr = new Rng(707);
  tileField(br, brr, -7.8, 7.8, 100.5, 134.5, 17.4, ['lbg', 'dbg', 'lbg'], { greeble: lod ? 0 : 0.2 });
  tileField(br, brr, -5.3, 5.3, 106.5, 130.5, 19.6, ['lbg', 'dbg'], { studs: lod ? 0 : 0.1 });
  for (const side of [-1, 1]) {
    windowRow(br, brr, side * 8.02, side, 99, 139, 14.9, 1.1, 0.8, 0.8);
    windowRow(br, brr, side * 5.52, side, 106.5, 130.5, 18.5, 0.8, 0.9, 0.7);
    br.box('yellow', side * 7.3, 17.6, 137.5, 1.4, 0.4, 3, { hide: { ny: true } });
  }
  br.push();
  br.translate(0, 13.85, 141.78);
  br.rotateX(Math.atan2(4.2, 2));
  br.box('trBlack', 0, 0, 0, 13, 0.2, 2.4);
  for (let i = 0; i < 9; i++) flatQuad(br, 'windowWarm', -5.6 + i * 1.4, -0.12, 0, 0.9, 1.4);
  br.pop();
  for (const [x, z, h] of [[-3, 110, 6], [3.5, 118, 4], [0, 126, 8]] as const) mast(br, rng, x, 19.9, z, h);

  /* ---- masts along the midships spine ---- */
  for (const [z, x, h] of [[-4, 4, 6], [6, -4, 9], [17, 7, 4], [30, -7, 7], [44, 3, 10], [58, -5, 5], [70, 6, 8], [84, -3, 4]] as const) {
    if (lod && h < 7) continue;
    mast(gb, rng, x, topY(secAt(HULL, z), x) + 0.3, z, h);
  }

  /* ---- ventral fin + foot pod ---- */
  sideProfile(gb, 'dbg', [[-113, -12.5], [-82, -12.5], [-80, -37.5], [-100, -37.5]], 2.6);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const ya = -14.5 - k * 5.6;
      const yb = ya - 5.2;
      const P = (y: number, u: number) => {
        const zf = -82 + ((y + 12.5) / -25) * 2;
        const zr = -113 + ((y + 12.5) / -25) * 13;
        return [zr + (zf - zr) * u, y];
      };
      sideProfile(gb, k === 1 ? 'sandBlue' : 'lbg', [P(ya, 0.05), P(ya, 0.95), P(yb, 0.95), P(yb, 0.05)], 0.4, side * 1.45);
    }
  }
  loft(gb, podSecs(-104, -76, { a: 2.8, b: 3, bb: 3, y0: -40.4, n: 2.2 }, { m: 2.3 }), { N: lod ? 12 : 20, tileLen: 3, tileWid: 1.6, spec: (t) => (h3(t.c, 31) < 0.3 ? 'dbg' : 'lbg'), core: 'dbg', flat: lod === 1 });
  gb.cyl('glowRed', 0, -40.4, -75.9, 0.3, 0.4, { axis: 'z', radial: 8 });

  /* ---- stern: engine block, hood, nozzles ---- */
  const eb = mk(q, 80);
  const EB: Sec[] = [
    { z: -189, a: 23, b: 10.6, bb: 10.2, y0: -1, n: 4, nb: 4 },
    { z: -176, a: 22, b: 11.2, bb: 10.8, y0: -1, n: 4, nb: 4 },
    { z: -166, a: 17, b: 10.4, bb: 9.6, y0: -1, n: 3.4, nb: 3.4 },
  ];
  loft(eb, EB, { N: lod ? 28 : 48, tileLen: 3, tileWid: 2.4, spec: (t) => (inHull(t.c, 0.5) ? null : h3(t.c, 41) < 0.55 ? 'dbg' : 'lbg'), core: 'dbg', capStart: 'dbg', flat: true });
  sideProfile(eb, 'dbg', [[-195, 8.6], [-165, 8.6], [-165, 12.2], [-191, 12.2], [-195, 10.4]], 40);
  tileField(eb, new Rng(808), -19.8, 19.8, -191, -186.2, 12.2, ['lbg', 'dbg', 'lbg'], { w: 2.2, lens: [2, 3, 4.8], greeble: lod ? 0 : 0.15 });
  const ENG: [number, number, number][] = [
    [-17.2, -1.4, 4.4],
    [-6.4, -0.6, 4.9],
    [6.4, -0.6, 4.9],
    [17.2, -1.4, 4.4],
  ];
  const glowB = mk(q, 81);
  for (const [ex, ey, r] of ENG) {
    const along = (z: number) => new Matrix4().makeTranslation(ex, ey, z).multiply(new Matrix4().makeRotationX(Math.PI / 2));
    const rad = lod ? 16 : 28;
    eb.add('dbg', tube(r + 0.9, r, 3.2, 0.12, rad), along(-190.6));
    eb.add('gunmetal', tube(r + 1.25, r + 0.85, 0.6, 0.08, rad), along(-192));
    eb.add('gunmetal', tube(r, r - 0.5, 2.4, 0.1, rad), along(-190.3));
    glowB.cyl('glowCyan', ex, ey, -189.25, r - 0.45, 0.3, { axis: 'z', radial: rad });
    glowB.add('glowBlue', tube(r - 0.05, r - 0.5, 0.25, 0.05, rad), along(-191.45));
    // square bracket frame
    const f = r + 1.35;
    for (const [dx, dy, w, h] of [[0, f, 2 * f + 1, 0.8], [0, -f, 2 * f + 1, 0.8], [f, 0, 0.8, 2 * f - 0.6], [-f, 0, 0.8, 2 * f - 0.6]] as const) {
      eb.box('lbg', ex + dx, ey + dy, -189.6, w, h, 1.6);
    }
    if (!lod) for (let i = 0; i < 6; i++) eb.box('gunmetal', ex + (i - 2.5) * 1.3, ey + f + 0.6, -190.2, 0.7, 0.5, 0.7);
  }
  if (!lod) {
    for (const [y, h] of [[-9.4, 2.4], [7.3, 2.1]] as const) {
      eb.push();
      eb.translate(0, y, -189.05);
      eb.rotateX(-Math.PI / 2);
      greeblePatch(eb, new Rng(818 + y), 38, h, ['dbg', 'gunmetal', 'lbg'], { density: 0.5 });
      eb.pop();
    }
  }
  put(eb, 'ih-engines');
  const eg = put(glowB, 'ih-engine-glow');
  for (const m of eg.group.children) {
    const mesh = m as Mesh;
    mesh.material = (mesh.material as Material).clone();
    engineGlows.push(mesh);
  }

  /* ---- turrets ---- */
  const tb = mk(q, 90);
  const TUR: [number, number, number][] = [
    [120, 0.62, 1],
    [88, 0.72, 1.1],
    [48, 0.7, 1.1],
    [10, 0.66, 1.1],
    [-162, 0.55, 1.2],
  ];
  let ti = 0;
  for (const [z, th, sc] of TUR) {
    for (const side of [1, -1]) {
      const { p, n } = surf(HULL, z, th * side);
      p.addScaledVector(n, 0.3);
      turrets.push(...turret(tb, group, `turret${ti++}`, frameFwd(p, n), sc));
    }
  }
  for (const side of [1, -1]) {
    turrets.push(...turret(tb, group, `turret${ti++}`, frameFwd(new Vector3(side * 9.5, 20.6, -28), new Vector3(0, 1, 0)), 1));
    turrets.push(...turret(tb, group, `turret${ti++}`, frameFwd(new Vector3(side * 8.5, 23, -128), new Vector3(0, 1, 0)), 0.9));
  }
  put(tb, 'ih-turrets');

  /* ---- hangar plaques, slot bays, the open mouth and its interior glimpse ---- */
  const hb = mk(q, 100);
  const bays: [number, number][] = [
    [SZ0, -96.125],
    [-94.625, -82.75],
    [MZ - MW / 2, MZ + MW / 2],
    [-67.25, -55.375],
    [-53.875, SZ1],
  ];
  const pillars = [-95.375, -82, -68, -54.625];
  const hr = new Rng(1001);
  for (const side of [1, -1]) {
    hb.push();
    if (side < 0) hb.mirrorX();
    const xm = (XB + XF) / 2;
    const zc = (SZ0 + SZ1) / 2;
    const L = SZ1 - SZ0 + 2 * PM;
    hb.box('dbg', xm, SY1 + PM / 2, zc, 3, PM, L);
    hb.box('dbg', xm, SY0 - PM / 2, zc, 3, PM, L);
    hb.box('dbg', xm, MY, SZ0 - PM / 2, 3, SY1 - SY0, PM);
    hb.box('dbg', xm, MY, SZ1 + PM / 2, 3, SY1 - SY0, PM);
    // face plating
    for (const [y0, y1] of [[SY1, SY1 + PM], [SY0 - PM, SY0]] as const) {
      const rows = lod ? 1 : 2;
      for (let r = 0; r < rows; r++) {
        const ya = y0 + ((y1 - y0) * r) / rows;
        const yb = y0 + ((y1 - y0) * (r + 1)) / rows;
        let z = SZ0 - PM;
        while (z < SZ1 + PM - 0.2) {
          const l = Math.min(SZ1 + PM - z, hr.pick(lod ? [8, 12] : [2, 3, 4, 4, 6]));
          const key: ColorKey = hr.chance(0.14) ? 'dbg' : hr.chance(0.05) ? 'sandBlue' : 'lbg';
          hb.box(key, XF + 0.2, (ya + yb) / 2, z + l / 2, 0.4, yb - ya - 0.07, l - 0.07, { hide: { nx: true } });
          z += l;
        }
      }
    }
    for (const zz of [SZ0 - PM / 2, SZ1 + PM / 2]) hb.box('lbg', XF + 0.2, MY, zz, 0.4, SY1 - SY0 - 0.07, PM - 0.07, { hide: { nx: true } });
    // raised frame around the slot
    hb.box('lbg', XF + 0.6, SY1 + 0.45, zc, 0.8, 0.9, SZ1 - SZ0 + 1.8);
    hb.box('lbg', XF + 0.6, SY0 - 0.45, zc, 0.8, 0.9, SZ1 - SZ0 + 1.8);
    hb.box('lbg', XF + 0.6, MY, SZ0 - 0.45, 0.8, SY1 - SY0, 0.9);
    hb.box('lbg', XF + 0.6, MY, SZ1 + 0.45, 0.8, SY1 - SY0, 0.9);
    for (let z = SZ0 + 2; z < SZ1 - 1; z += 4) hb.box('glowYellow', XF + 1.02, SY0 - 0.45, z, 0.06, 0.25, 0.5);
    // recess ceiling lights and floor hazard band
    for (let z = SZ0 + 2; z < SZ1 - 1; z += 4) {
      hb.push();
      hb.translate(XF - 0.9, SY1 - 0.02, z);
      hb.scale(1, -1, 1);
      flatQuad(hb, 'glowWhite', 0, 0, 0, 0.5, 2.2);
      hb.pop();
    }
    for (let z = SZ0 + 0.5; z < SZ1; z += 1) hb.box(Math.floor(z - SZ0) % 2 ? 'yellow' : 'black', XF - 0.7, SY0 + 0.05, z + 0.5, 1.2, 0.1, 0.96, { hide: { ny: true } });
    // pillars
    for (const pz of pillars) {
      hb.box('gunmetal', XB + 1.1, MY, pz, 2.2, SY1 - SY0, 1.5, { hide: { nx: true } });
      if (!lod) for (let y = SY0 + 0.6; y < SY1 - 0.3; y += 1.1) hb.box('dbg', XB + 2.3, y, pz, 0.3, 0.5, 1.2);
      hb.box('glowRed', XB + 2.26, SY1 - 0.5, pz, 0.12, 0.3, 0.3);
    }
    // bays: blast doors, and on the port side the open mouth
    for (const [z0, z1] of bays) {
      const open = side > 0 && z0 === MZ - MW / 2;
      const zm = (z0 + z1) / 2;
      const w = z1 - z0;
      if (open) {
        for (const sz of [z0 + 0.3, z1 - 0.3]) {
          hb.box('gunmetal', XB + 0.3, MY, sz, 0.6, MH, 0.6);
          hb.box('glowBlue', XB + 0.62, MY, sz, 0.06, MH - 0.4, 0.22);
        }
        hb.box('gunmetal', XB + 0.25, MY + MH / 2 + 0.2, zm, 0.5, 0.4, w);
        hb.box('gunmetal', XB + 0.25, MY - MH / 2 - 0.2, zm, 0.5, 0.4, w);
        continue;
      }
      hb.box('dbg', XB - 0.3, MY, zm, 0.6, SY1 - SY0, w, { hide: { nx: true } });
      const ribs = lod ? 2 : 5;
      for (let i = 0; i < ribs; i++) {
        const y = SY0 + ((SY1 - SY0) * (i + 0.5)) / ribs;
        hb.box(i % 2 ? 'gunmetal' : 'lbg', XB + 0.1, y, zm, 0.3, ((SY1 - SY0) / ribs) * 0.62, w - 0.8);
      }
      hb.box('black', XB + 0.3, MY, zm, 0.1, SY1 - SY0 - 0.4, 0.14);
      if (!lod) {
        for (let z = z0 + 0.8; z < z1 - 0.6; z += 1.2) hb.box(Math.round((z - z0) / 1.2) % 2 ? 'yellow' : 'black', XB + 0.28, SY0 + 0.35, z, 0.08, 0.5, 1.1);
        for (let z = z0 + 1.2; z < z1 - 1; z += 2.4) flatQuadX(hb, 'windowWarm', XB + 0.3, SY1 - 0.45, z, 0.3, 1.1);
      }
    }
    hb.pop();
  }

  // interior glimpse behind the open bay
  const room = mk(q, 110);
  const FY = MY - MH / 2;
  const CY = FY + 6.3;
  const RZ0 = MZ - 11;
  const RZ1 = MZ + 11;
  const rx = (ROOM_X + XB) / 2;
  const RD = XB - ROOM_X;
  room.box('lbg', rx, FY - 0.4, MZ, RD, 0.8, RZ1 - RZ0, { hide: { ny: true } });
  room.box('dbg', rx, CY + 0.4, MZ, RD, 0.8, RZ1 - RZ0, { hide: { py: true } });
  room.box('dbg', ROOM_X - 0.4, (FY + CY) / 2, MZ, 0.8, CY - FY, RZ1 - RZ0);
  for (const zz of [RZ0 - 0.4, RZ1 + 0.4]) room.box('dbg', rx - 0.35, (FY + CY) / 2, zz, RD - 0.7, CY - FY, 0.8);
  room.box('dbg', XB - 0.4, (MY + MH / 2 + CY) / 2, MZ, 0.8, CY - (MY + MH / 2), MW + 0.2);
  for (const [za, zb] of [[RZ0, MZ - MW / 2], [MZ + MW / 2, RZ1]] as const) room.box('dbg', XB - 1.05, (FY + CY) / 2, (za + zb) / 2, 0.8, CY - FY, zb - za);
  if (!lod) {
    // floor: tile courses, guide lines, landing circle
    tileField(room, new Rng(1111), ROOM_X + 0.1, XB - 0.9, RZ0 + 0.1, RZ1 - 0.1, FY, ['lbg', 'lbg', 'dbg', 'lbg'], { w: 1.5, lens: [2, 3, 4] });
    for (const zz of [MZ - 4.5, MZ + 4.5]) room.box('yellow', rx - 0.4, FY + 0.42, zz, RD - 1.6, 0.06, 0.3);
    room.cyl('yellow', rx - 1, FY + 0.43, MZ, 2.2, 0.05, { radial: 24, top: true });
    room.cyl('lbg', rx - 1, FY + 0.45, MZ, 1.8, 0.05, { radial: 24 });
    // ceiling gantries + light panels
    for (let i = 0; i < 4; i++) {
      const x = ROOM_X + 1.4 + i * 2.4;
      room.box('gunmetal', x, CY - 0.35, MZ, 0.6, 0.7, RZ1 - RZ0);
      for (let z = RZ0 + 2; z < RZ1 - 1; z += 4) {
        room.push();
        room.translate(x + 1.1, CY - 0.05, z);
        room.scale(1, -1, 1);
        flatQuad(room, 'glowWhite', 0, 0, 0, 1.3, 2.6);
        room.pop();
      }
    }
    // back wall: bulkhead ribs, doors, lit control windows
    for (let z = RZ0 + 1; z < RZ1; z += 3) room.box('lbg', ROOM_X + 0.3, (FY + CY) / 2, z, 0.6, CY - FY, 0.8);
    room.box('gunmetal', ROOM_X + 0.1, FY + 1.4, MZ, 0.3, 2.8, 4);
    flatQuadX(room, 'windowWarm', ROOM_X + 0.02, FY + 4.4, MZ - 6, 1, 3.2);
    flatQuadX(room, 'windowWarm', ROOM_X + 0.02, FY + 4.4, MZ + 6, 1, 3.2);
    flatQuadX(room, 'glowWhite', ROOM_X + 0.03, CY - 0.9, MZ, 0.5, 18);
    // side walls: ribs + pipes, crates on the floor
    for (const zs of [RZ0 + 0.3, RZ1 - 0.3]) {
      for (let x = ROOM_X + 1; x < XB - 0.5; x += 2) room.box('lbg', x, (FY + CY) / 2, zs, 0.5, CY - FY, 0.6);
      bar(room, 'gunmetal', [ROOM_X, CY - 1.2, zs], [XB - 0.6, CY - 1.2, zs], 0.2, { radial: 6 });
    }
    const cr = new Rng(1212);
    for (let i = 0; i < 10; i++) {
      const z = cr.chance(0.5) ? cr.range(RZ0 + 1, MZ - 6) : cr.range(MZ + 6, RZ1 - 1);
      const x = cr.range(ROOM_X + 1, XB - 2);
      const s = cr.range(0.5, 0.9);
      room.box(cr.pick(['darkTan', 'dbg', 'lbg', 'reddishBrown'] as ColorKey[]), x, FY + 0.4 + s / 2, z, s, s, s * 1.3);
    }
  } else {
    flatQuadX(room, 'glowWhite', ROOM_X + 0.03, (FY + CY) / 2, MZ, CY - FY - 1, RZ1 - RZ0 - 2);
  }
  put(room, 'ih-hangar-room');
  put(hb, 'ih-hangar-slots');

  /* ---- anchors ---- */
  anchors.hangar = anchorFrom(gb, 'hangar', group, [XB, MY, MZ], [1, 0, 0], [0, 1, 0]);
  anchors.bridge = anchorFrom(gb, 'bridge', group, [0, 78.5, -146], [0, 0, 1]);
  anchors.commandBridge = anchorFrom(gb, 'commandBridge', group, [0, 19.8, 136], [0, 0, 1]);
  anchors.shieldGen = anchorFrom(gb, 'shieldGen', group, [0, 25.3, -60], [0, 0, 1]);
  anchors.bow = anchorFrom(gb, 'bow', group, [0, -1.5, 190.5], [0, 0, 1]);
  anchors.stern = anchorFrom(gb, 'stern', group, [0, -1, -192], [0, 0, -1]);
  const crawl: [Sec[], number, number][] = [
    [BLP, -30, 0.5],
    [BLP, -52, 0.35],
    [BLP, -96, 0.45],
    [BLP, -122, 0.3],
    [HULL, 2, 0.5],
    [HULL, 28, 0.35],
    [HULL, 60, 0.55],
    [HULL, 92, 0.4],
  ];
  crawl.forEach(([secs, z, th], i) => {
    const { p, n } = surf(secs, z, th);
    p.addScaledVector(n, 0.45);
    anchors[`crawl${i}`] = anchorFrom(gb, `crawl${i}`, group, [p.x, p.y, p.z], [0, 0, 1], [n.x, n.y, n.z]);
  });
  put(gb, 'ih-details');
  put(deck, 'ih-deck');
  put(sp, 'ih-spire');
  put(br, 'ih-bridge');

  /* ---- ray shield ---- */
  const shield = rayShield(MW * S, MH * S, { name: 'ih-ray-shield', scan: 26 });
  shield.mesh.position.set((XB + 0.05) * S, MY * S, MZ * S);
  shield.mesh.rotation.y = Math.PI / 2;
  group.add(shield.mesh);
  group.userData.animate = (t: number) => shield.update(t);
  group.userData.triangles = tris;

  return { group, length: 381 * S, turrets, engineGlows, anchors, setShield: (v: number) => shield.set(v) };
}

/** Height of a section's upper surface at x. */
function topY(s: Sec, x: number): number {
  const n = s.n ?? 2;
  return (s.y0 ?? 0) + s.b * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x - (s.x0 ?? 0)) / s.a), n)), 1 / n);
}

/** Flat quad on a wall facing +X (x = wall plane, h = height, l = length along z). */
function flatQuadX(b: Builder, key: ColorKey, x: number, y: number, z: number, h: number, l: number): void {
  b.push();
  b.translate(x, y, z);
  b.rotateZ(-Math.PI / 2);
  flatQuad(b, key, 0, 0, 0, h, l);
  b.pop();
}
