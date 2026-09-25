import { Group, Matrix4, Object3D } from 'three';
import { Builder } from '../core/builder';
import { tube } from '../core/geom';
import type { ColorKey } from '../core/palette';
import { Rng } from '../core/rng';
import type { Hangar } from './types';
import { anchorFrom, bar, flatQuad, grille, roundPlate, sideProfile } from './d-kit';
import { rayShield } from './d-shield';

/**
 * The Invisible Hand's main hangar bay at minifig scale (studs; y = 0 is the deck surface, the
 * mouth with its ray shield is the +Z wall). Separatist buttress ribs that flare into the deck and
 * curve into the ceiling, a catwalk with lit offices along both side walls, a lift in the back
 * wall between a raised control booth and a battle-droid storage rack, gantries of light panels
 * overhead, a dark tiled deck with two landing pads, and a lit throat beyond the shield line.
 */

const HX = 90;
const HZ = 60;
const HY = 42;
const MW = 100;
const MH = 36;
const MY0 = 1;
const CELL = 7;
const CATY = 20;
const THROAT = 8;

type B = Builder;
type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

function mk(seed: number): B {
  return new Builder({ seed, studSegments: 10, tint: 0.04 });
}

/**
 * Flat light / decal quad in the current frame. x-faces: w along z, h along y; z-faces: w along x,
 * h along y; y-faces: w along x, h along z.
 */
function quad(b: B, key: ColorKey, face: Face, x: number, y: number, z: number, w: number, h: number): void {
  b.push();
  b.translate(x, y, z);
  if (face === 'px') b.rotateZ(-Math.PI / 2);
  else if (face === 'nx') b.rotateZ(Math.PI / 2);
  else if (face === 'pz') b.rotateX(Math.PI / 2);
  else if (face === 'nz') b.rotateX(-Math.PI / 2);
  else if (face === 'ny') b.scale(1, -1, 1);
  if (face === 'px' || face === 'nx') flatQuad(b, key, 0, 0, 0, h, w);
  else flatQuad(b, key, 0, 0, 0, w, h);
  b.pop();
}

/* --- wall kit: every wall is built in a local frame (x along the wall, y up, z into the room) --- */

const FOOT = [[7.4, 0], [6.2, 0.9], [5.1, 2.2], [4.2, 3.9], [3.6, 5.9], [3.2, 8.1], [3.0, 10.6]];
const HAUNCH = [[3.0, 30.6], [3.3, 33.2], [3.9, 35.6], [4.9, 37.6], [6.3, 39.4], [8.2, 40.9], [10.4, HY]];

/** Separatist buttress rib: stacked curved slices flaring into the deck and the ceiling. */
function rib(b: B, x: number): void {
  const w = 2.4;
  b.box('lbg', x, HY / 2, 1.4, w, HY, 2.8, { hide: { nz: true } });
  b.push();
  b.translate(x, 0, 0);
  b.rotateY(-Math.PI / 2);
  for (const pr of [FOOT, HAUNCH]) {
    for (let i = 0; i + 1 < pr.length; i++) {
      const [d0, y0] = pr[i];
      const [d1, y1] = pr[i + 1];
      b.prism('lbg', [[2.7, y0], [d0, y0], [d1, y1], [2.7, y1]], w - 0.12);
    }
  }
  b.pop();
  b.box('dbg', x, 20.8, 2.95, 0.9, 20.4, 0.3);
  b.box('gunmetal', x, 12.2, 3.05, 1.7, 2.4, 0.5);
  b.box('darkTan', x, 29.2, 2.95, 2.5, 0.8, 0.4);
  b.cyl('glowRed', x, 32.4, 3.3, 0.3, 0.3, { axis: 'z', radial: 8 });
}

interface BayOpts {
  lower?: boolean;
  accent?: boolean;
  windows?: boolean;
  sill?: boolean;
}

/** Wall bay between two ribs: skirting, three panel courses, lit office window, top slats. */
function bay(b: B, rng: Rng, xa: number, xb: number, i: number, o: BayOpts): void {
  const w = xb - xa;
  const xc = (xa + xb) / 2;
  if (o.lower ?? true) {
    b.box('dbg', xc, 1.5, 0.35, w, 3, 0.7, { hide: { nz: true } });
    if (i % 2 === 0 && w > 4) {
      b.push();
      b.translate(xc, 1.5, 0.7);
      b.rotateX(Math.PI / 2);
      grille(b, 'gunmetal', 0, 0, 0, 1.6, Math.min(5, w * 0.6));
      b.pop();
    }
    const cw = (w - 0.3) / 2;
    const rows: [number, number, ColorKey][] = [
      [3.1, 8.3, o.accent ? 'darkTan' : 'lbg'],
      [8.4, 13.6, 'dbg'],
      [13.7, CATY - 0.8, 'lbg'],
    ];
    for (const [y0, y1, k] of rows) for (const c of [-1, 1]) b.box(k, xc + c * (cw / 2 + 0.075), (y0 + y1) / 2, 0.25, cw - 0.02, y1 - y0, 0.5, { hide: { nz: true } });
    if (w > 4) {
      quad(b, rng.chance(0.3) ? 'glowGreen' : 'windowWarm', 'pz', xc - cw / 2, 11.6, 0.52, 1.4, 0.5);
      b.box('gunmetal', xc - cw / 2, 10.2, 0.6, 1.8, 1.2, 0.2);
      if (rng.chance(0.5)) b.box('gunmetal', xc + cw / 2, 5.6, 0.6, 1.8, 1.3, 0.2);
      if (rng.chance(0.4)) b.box('lbg', xc + cw / 2, 16.2, 0.6, 2.4, 0.6, 0.2);
    }
  }
  if (o.sill) b.box('lbg', xc, CATY - 0.4, 0.5, w, 0.8, 1.0);
  if ((o.windows ?? true) && w > 4) {
    const y0 = CATY + 1.3;
    const y1 = CATY + 6.9;
    b.box('lbg', xc, y1 + 0.5, 0.4, w, 1.0, 0.8);
    b.box('lbg', xc, y0 - 0.5, 0.3, w, 1.0, 0.6);
    for (const s of [-1, 1]) b.box('lbg', xc + s * (w / 2 - 0.5), (y0 + y1) / 2, 0.3, 1.0, y1 - y0, 0.6);
    b.box('trBlack', xc, (y0 + y1) / 2, 0.3, w - 2.0, y1 - y0, 0.16);
    quad(b, 'windowWarm', 'pz', xc, (y0 + y1) / 2, 0.1, w - 2.2, y1 - y0 - 0.2);
    b.box('dbg', xc, (y0 + y1) / 2, 0.42, 0.3, y1 - y0, 0.2);
    b.box('dbg', xc - w / 4, y0 + 0.6, 0.16, w / 3, 1.0, 0.08);
  } else if (w > 3) {
    b.box('lbg', xc, CATY + 4, 0.25, w - 0.2, 6, 0.5);
  }
  for (let y = 30; y < HY - 1; y += 2.6) b.box('lbg', xc, y, 0.25, w - 0.2, 0.8, 0.5);
  b.box('dbg', xc, CATY + 9.1, 0.35, w, 1.6, 0.7);
}

/** Blast door in a rounded arch alcove, centred in a bay. */
function doorBay(b: B, xc: number): void {
  const w = 6.4;
  const h = 12;
  const dep = 4.2;
  const ri = w / 2;
  const ro = w / 2 + 1.4;
  for (const s of [-1, 1]) b.box('lbg', xc + s * (ri + 0.7), h / 2, dep / 2, 1.4, h, dep);
  b.lathe('lbg', [[ri, 0, 0, -1, ro, 0, 0, -1], [ro, 0, 1, 0, ro, dep, 1, 0], [ro, dep, 0, 1, ri, dep, 0, 1], [ri, dep, -1, 0, ri, 0, -1, 0]], {
    radial: 16,
    theta0: Math.PI / 2,
    thetaLen: Math.PI,
    at: [xc, h, 0],
    axis: 'z',
  });
  b.box('dbg', xc, h / 2, 0.3, w, h, 0.6);
  for (let y = 1.0; y < h - 0.4; y += 1.6) b.box(y < 2.5 ? 'yellow' : 'gunmetal', xc, y, 0.72, w - 0.8, 0.8, 0.24);
  b.box('black', xc, h / 2, 0.9, 0.16, h - 0.4, 0.1);
  quad(b, 'glowWhite', 'pz', xc, h + 1.7, 0.12, w - 2.4, 0.7);
  b.cyl('glowRed', xc, h + ro + 0.7, 0.5, 0.35, 1.0, { axis: 'z', radial: 8 });
  for (const s of [-1, 1]) b.box('yellow', xc + s * (ri + 0.7), 1.2, dep + 0.03, 1.2, 1.6, 0.06);
}

/** Catwalk along a side wall with railing, rib brackets, underside lights and two ladders. */
function catwalk(b: B, x0: number, x1: number, ribs: number[]): void {
  const d = 4.8;
  const xc = (x0 + x1) / 2;
  b.box('dbg', xc, CATY - 0.3, d / 2, x1 - x0, 0.6, d);
  b.box('yellow', xc, CATY - 0.3, d + 0.06, x1 - x0, 0.46, 0.12);
  for (let x = x0 + 1.5; x < x1 - 1; x += 3) b.box('gunmetal', x, CATY + 1.6, d - 0.3, 0.3, 3.2, 0.3);
  for (const y of [CATY + 3.1, CATY + 1.7]) bar(b, 'gunmetal', [x0, y, d - 0.3], [x1, y, d - 0.3], 0.14, { radial: 6 });
  for (const x of ribs) {
    b.push();
    b.translate(x, 0, 0);
    b.rotateY(-Math.PI / 2);
    b.prism('dbg', [[2.9, CATY - 3.4], [d, CATY - 0.6], [2.9, CATY - 0.6]], 0.8);
    b.pop();
  }
  for (let x = x0 + 6; x < x1 - 2; x += 12) quad(b, 'glowWhite', 'ny', x, CATY - 0.62, d / 2 + 0.4, 3, 1.4);
  for (const lx of [x0 + 10, x1 - 10]) {
    for (const s of [-1, 1]) b.box('gunmetal', lx + s * 0.9, (CATY + 3.2) / 2, d + 0.35, 0.25, CATY + 3.2, 0.25);
    for (let y = 1; y < CATY; y += 1.2) b.box('gunmetal', lx, y, d + 0.35, 1.8, 0.16, 0.16);
  }
}

/** Bays between consecutive edges (ribs get 1.2 clearance; the outer ends pad0 / pad1). */
function bays(b: B, rng: Rng, edges: number[], o: (xc: number, i: number) => BayOpts | null, pad0 = 0, pad1 = 0): void {
  for (let i = 0; i + 1 < edges.length; i++) {
    const xa = edges[i] + (i === 0 ? pad0 : 1.2);
    const xb = edges[i + 1] - (i + 1 === edges.length - 1 ? pad1 : 1.2);
    const bo = o((xa + xb) / 2, i);
    if (bo) bay(b, rng, xa, xb, i, bo);
  }
}

/** Side wall (local x = world z on the +X wall). */
function sideWall(b: B, rng: Rng): void {
  b.box('dbg', 0, HY / 2, -1, HZ * 2, HY, 2, { hide: { nz: true } });
  const ribs: number[] = [];
  for (let x = -54; x <= 54; x += 12) ribs.push(x);
  for (const x of ribs) rib(b, x);
  const doors = [-24, 24];
  bays(b, rng, [-HZ, ...ribs, HZ], (xc, i) => {
    const door = doors.some((d) => Math.abs(d - xc) < 3);
    if (door) doorBay(b, xc);
    return { lower: !door, accent: i % 4 === 1 };
  });
  catwalk(b, -HZ, HZ, ribs);
  bar(b, 'gunmetal', [-HZ, CATY - 1.5, 1.2], [HZ, CATY - 1.5, 1.2], 0.45, { radial: 10 });
  bar(b, 'dbg', [-HZ, CATY - 2.5, 1.0], [HZ, CATY - 2.5, 1.0], 0.3, { radial: 8 });
  bar(b, 'gunmetal', [-HZ, 27.9, 1.1], [HZ, 27.9, 1.1], 0.35, { radial: 8 });
}

/** Back wall (local frame = world shifted to z = -HZ): lift in the middle. */
function backWall(b: B, rng: Rng): void {
  b.box('dbg', 0, HY / 2, -1, HX * 2, HY, 2, { hide: { nz: true } });
  const ribs = [-86, -74, -62, -50, -38, -26, -14, 14, 26, 38, 50, 62, 74, 86];
  for (const x of ribs) rib(b, x);
  bays(b, rng, [-HX, ...ribs.filter((x) => x < 0)], (xc, i) => ({ lower: Math.abs(xc + 56) > 11, accent: i % 4 === 2, sill: true }), 0, 1.2);
  bays(b, rng, [...ribs.filter((x) => x > 0), HX], (xc, i) => ({ accent: i % 4 === 1, sill: true }), 1.2, 0);
  // lift: frame, doors with a light seam, call lights, indicator panel
  b.box('dbg', 0, HY / 2, 0.3, 25.6, HY, 0.6);
  for (const s of [-1, 1]) {
    b.box('lbg', s * 9, 13, 1.5, 3, 26, 3);
    b.box('gunmetal', s * 9, 13, 3.05, 1.2, 24, 0.2);
    b.box('yellow', s * 9, 1.2, 3.02, 3.02, 2.4, 0.1);
    b.cyl('glowGreen', s * 11.3, 6.5, 0.9, 0.35, 0.4, { axis: 'z', radial: 8 });
    b.box('dbg', s * 11.3, 6.5, 0.7, 1.2, 2.2, 0.2);
  }
  b.box('lbg', 0, 27.5, 1.5, 21, 3, 3);
  sideProfile(b, 'dbg', [[0, 29], [3.2, 29], [1.2, 31.4], [0, 31.4]], 21);
  for (const s of [-1, 1]) b.box('dbg', s * 3.75, 12, 0.9, 7.4, 24, 1.2);
  quad(b, 'glowWhite', 'pz', 0, 12, 1.52, 0.3, 23);
  for (let y = 1; y < 24; y += 2.4) for (const s of [-1, 1]) b.box(y < 3 ? 'yellow' : 'lbg', s * 3.75, y, 1.6, 6.4, 0.5, 0.2);
  b.box('black', 0, 33.5, 0.9, 10, 2.6, 0.6);
  for (let i = 0; i < 5; i++) b.box(i === 2 ? 'glowGreen' : 'glowYellow', -4 + i * 2, 33.5, 1.25, 1.2, 1, 0.1);
  for (let y = 35; y < HY - 1; y += 2.6) b.box('lbg', 0, y, 0.7, 24, 0.8, 0.5);
  // conduits either side of the lift
  for (const s of [-1, 1]) {
    const xa = s * 16;
    const xb = s * HX;
    bar(b, 'gunmetal', [xa, CATY - 1.5, 1.2], [xb, CATY - 1.5, 1.2], 0.45, { radial: 10 });
    bar(b, 'gunmetal', [xa, 27.9, 1.1], [xb, 27.9, 1.1], 0.35, { radial: 8 });
    bar(b, 'dbg', [xa, CATY - 1.5, 1.2], [xa, 0, 1.2], 0.45, { radial: 10 });
  }
}

/** Front wall around the mouth (local x = -world x), emitter frame and the lit throat beyond. */
function frontWall(b: B, rng: Rng): void {
  const xm = MW / 2;
  for (const s of [-1, 1]) {
    b.box('dbg', s * (xm + 3 + (HX - xm - 3) / 2), HY / 2, -1, HX - xm - 3, HY, 2, { hide: { nz: true } });
    const ribs = [59, 71, 83].map((x) => x * s);
    for (const x of ribs) rib(b, x);
    const edges = s > 0 ? [xm + 3, ...ribs, HX] : [-HX, ...ribs.reverse(), -xm - 3];
    bays(b, rng, edges, (_xc, i) => ({ accent: i % 3 === 1, sill: true }), s > 0 ? 0.8 : 0, s > 0 ? 0 : 0.8);
    bar(b, 'gunmetal', [s * (xm + 3), CATY - 1.5, 1.2], [s * HX, CATY - 1.5, 1.2], 0.45, { radial: 10 });
  }
  b.box('dbg', 0, (MY0 + MH + HY) / 2 + 0.5, -1, MW + 6, HY - MY0 - MH + 1, 2, { hide: { nz: true } });
  // emitter frame
  const fy = MY0 + MH / 2;
  for (const s of [-1, 1]) {
    b.box('lbg', s * (xm + 1.5), fy, 2.5, 3, MH + 2, 5);
    b.box('dbg', s * (xm + 3.4), fy, 1.6, 0.8, MH + 2, 3.2);
    b.box('gunmetal', s * (xm + 0.2), fy, 1.5, 0.6, MH - 1, 1.8);
    quad(b, 'glowBlue', s > 0 ? 'nx' : 'px', s * (xm - 0.12), fy, 1.5, 1.2, MH - 2);
    for (let y = 2; y < MH; y += 3) b.box('yellow', s * (xm + 1.5), y, 5.03, 2.6, 1.4, 0.06);
    b.cyl('glowRed', s * (xm + 1.5), MY0 + MH + 2.4, 5.1, 0.45, 0.4, { axis: 'z', radial: 10 });
  }
  b.box('lbg', 0, MY0 + MH + 1, 2.5, MW + 6, 2, 5);
  b.box('gunmetal', 0, MY0 + MH + 0.1, 1.5, MW - 1, 0.6, 1.8);
  quad(b, 'glowBlue', 'ny', 0, MY0 + MH - 0.22, 1.5, MW - 2, 1.2);
  sideProfile(b, 'dbg', [[0, MY0 + MH + 2], [5, MY0 + MH + 2], [2.4, HY - 0.2], [0, HY - 0.2]], MW + 6);
  for (let x = -xm + 4; x < xm; x += 8) b.box('lbg', x, MY0 + MH + 2.6, 4.2, 5, 0.5, 1.2);
  // throat beyond the shield line (local z < 0)
  const tz = -THROAT / 2;
  for (const s of [-1, 1]) {
    b.box('dbg', s * (xm + 0.6), fy, tz, 1.2, MH, THROAT);
    for (let z = -1.6; z > -THROAT; z -= 2.6) b.box('lbg', s * (xm - 0.1), fy, z, 0.6, MH, 0.9);
    quad(b, 'glowWhite', s > 0 ? 'nx' : 'px', s * (xm - 0.02), fy, -5.5, 0.6, MH - 4);
  }
  b.box('dbg', 0, MY0 + MH + 0.5, tz, MW + 2.4, 1, THROAT);
  for (let z = -1.6; z > -THROAT; z -= 2.6) b.box('lbg', 0, MY0 + MH - 0.2, z, MW, 0.6, 0.9);
  quad(b, 'glowWhite', 'ny', 0, MY0 + MH - 0.02, -5.5, MW - 4, 0.6);
  // deck lip in the throat with hazard stripes and edge lights
  b.box('dbg', 0, -0.6, tz, MW + 2.4, 1.2, THROAT);
  for (let x = -xm; x < xm; x += 2) b.box(Math.round((x + xm) / 2) % 2 ? 'yellow' : 'black', x + 1, 0.06, -1.4, 1.96, 0.12, 2);
  for (let x = -xm + 3; x < xm; x += 6) b.cyl('glowYellow', x, 0.05, -THROAT + 0.8, 0.3, 0.1, { radial: 8 });
  b.box('lbg', 0, -0.6, -THROAT - 0.6, MW + 2.4, 1.6, 1.2);
}

/* --- deck ------------------------------------------------------------------------------------ */

function deck(b: B, rng: Rng, pads: [number, number][]): void {
  b.box('black', 0, -1.3, 0, HX * 2, 2, HZ * 2, { hide: { ny: true } });
  const nx = Math.floor((HX * 2) / CELL);
  const nz = Math.floor((HZ * 2) / CELL);
  const x0 = -(nx * CELL) / 2;
  const z0 = -(nz * CELL) / 2;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const cx = x0 + (i + 0.5) * CELL;
      const cz = z0 + (j + 0.5) * CELL;
      const edge = i === 0 || i === nx - 1 || j === 0;
      const h = rng.next();
      const key: ColorKey = edge ? 'lbg' : h < 0.05 ? 'lbg' : h < 0.09 ? 'sandBlue' : 'dbg';
      b.box(key, cx, -0.2, cz, CELL - 0.6, 0.4, CELL - 0.6, { hide: { ny: true } });
      if (!edge && !pads.some(([px, pz]) => Math.hypot(cx - px, cz - pz) < 13)) {
        const r = rng.next();
        if (r < 0.06) roundPlate(b, 'lbg', cx + 1.6, 0, cz + 1.6, 1.0, 0.2, 14);
        else if (r < 0.1) grille(b, 'black', cx, 0, cz, 4, 2);
        else if (r < 0.16) b.box('lbg', cx, 0.05, cz - 2.4, 4, 0.1, 0.6);
      }
    }
  }
  // skirting gutters along the wall bases
  for (const s of [-1, 1]) b.box('gunmetal', s * (HX - 0.4), 0.1, 0, 0.8, 0.2, HZ * 2);
  b.box('gunmetal', 0, 0.1, -HZ + 0.4, HX * 2, 0.2, 0.8);
  // hazard band along the mouth
  for (let x = -MW / 2; x < MW / 2; x += 2) {
    for (let r = 0; r < 2; r++) {
      const k = (Math.round((x + MW / 2) / 2) + r) % 2 ? 'yellow' : 'black';
      b.box(k, x + 1, 0.06, HZ - 3.5 + r * 2, 1.96, 0.12, 1.96, { hide: { ny: true } });
    }
  }
  // keep-clear zone in front of the lift
  for (const [x, z, w, l] of [[0, -HZ + 13, 24, 0.8], [-12, -HZ + 7.5, 0.8, 11.8], [12, -HZ + 7.5, 0.8, 11.8]] as const) b.box('yellow', x, 0.05, z, w, 0.1, l);
  for (let x = -10; x <= 10; x += 4) {
    b.push();
    b.translate(x, 0.07, -HZ + 7.6);
    b.rotateY(Math.PI / 4);
    flatQuad(b, 'yellow', 0, 0, 0, 0.8, 7);
    b.pop();
  }
  // white centre line from the mouth to the lift, dashed
  for (let z = -HZ + 16; z < HZ - 6; z += 6) b.box('white', 0, 0.04, z, 0.6, 0.08, 3.2);
  // landing pads: plate disc, rings, cross, edge lights, guide line to the mouth, scorch marks
  for (const [px, pz] of pads) {
    b.lathe('lbg', [[0, 0.06, 0, 1, 9.2, 0.06, 0, 1]], { radial: 40, at: [px, 0, pz] });
    b.lathe('yellow', [[9.2, 0.12, 0, 1, 10.4, 0.12, 0, 1], [10.4, 0.12, 1, 0, 10.4, 0, 1, 0]], { radial: 40, at: [px, 0, pz] });
    b.lathe('white', [[6.3, 0.1, 0, 1, 6.9, 0.1, 0, 1]], { radial: 32, at: [px, 0, pz] });
    b.box('yellow', px, 0.1, pz, 7, 0.08, 1.1);
    b.box('yellow', px, 0.1, pz, 1.1, 0.08, 7);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      b.cyl('glowYellow', px + Math.sin(a) * 11.1, 0.1, pz + Math.cos(a) * 11.1, 0.32, 0.2, { radial: 8 });
    }
    for (let z = pz + 12; z < HZ - 6; z += 4) b.box('yellow', px, 0.04, z, 0.8, 0.08, 2.4);
    for (let k = 0; k < 3; k++) {
      b.push();
      b.translate(px + rng.range(-4, 4), 0.16 + k * 0.006, pz + rng.range(-4, 4));
      b.rotateY(rng.range(0, Math.PI));
      b.scale(1, 1, rng.range(0.45, 0.7));
      b.cyl('trSmoke', 0, 0, 0, rng.range(2.4, 3.6), 0.02, { radial: 16, bottom: false, c: 0 });
      b.cyl('trSmoke', 0, 0.003, 0.3, rng.range(1.2, 1.8), 0.02, { radial: 12, bottom: false, c: 0 });
      b.pop();
    }
  }
}

/* --- props ----------------------------------------------------------------------------------- */

/** Raised control booth against the back wall (x centre bx), sloped glass looking at the deck. */
function booth(b: B, rng: Rng, bx: number): void {
  const zb = -HZ;
  const zf = -HZ + 11;
  const zc = (zb + zf) / 2;
  const y0 = 10;
  for (const s of [-1, 1]) {
    for (const z of [zf - 1.2, zb + 3.5]) b.box('gunmetal', bx + s * 9.5, y0 / 2, z, 1.2, y0, 1.2);
    bar(b, 'dbg', [bx + s * 9.5, 1, zf - 1.2], [bx + s * 9.5, y0 - 0.6, zb + 3.5], 0.25, { radial: 6 });
  }
  b.box('dbg', bx, y0 + 0.4, zc, 23, 0.8, 11);
  b.box('yellow', bx, y0 + 0.4, zf + 0.04, 23, 0.4, 0.1);
  for (const dx of [-6, 0, 6]) quad(b, 'glowWhite', 'ny', bx + dx, y0 - 0.02, zc + 1, 3, 1.2);
  // front console fascia, sloped glass, sides, roof visor
  b.box('lbg', bx, y0 + 1.6, zf - 0.4, 23, 1.6, 0.8);
  const gl = Math.hypot(1.8, 5.6);
  b.box('trBlack', bx, y0 + 5.2, zf - 1.3, 21.4, gl, 0.24, { rot: [-Math.atan2(1.8, 5.6), 0, 0] });
  for (let dx = -7; dx <= 7; dx += 7) b.box('dbg', bx + dx, y0 + 5.2, zf - 1.15, 0.4, gl, 0.3, { rot: [-Math.atan2(1.8, 5.6), 0, 0] });
  for (const s of [-1, 1]) sideProfile(b, 'lbg', [[zb, y0 + 0.8], [zf, y0 + 0.8], [zf, y0 + 2.4], [zf - 1.8, y0 + 8], [zb, y0 + 8]], 0.8, bx + s * 11.1);
  b.box('lbg', bx, y0 + 8.6, zc - 0.6, 23.4, 1.2, 11.2);
  sideProfile(b, 'dbg', [[zb, y0 + 9.2], [zf - 0.6, y0 + 9.2], [zf - 1.8, y0 + 10.2], [zb, y0 + 10.2]], 22.4, bx);
  bar(b, 'gunmetal', [bx + 8, y0 + 10.2, zb + 3], [bx + 8, y0 + 14, zb + 3], 0.12, { radial: 6 });
  b.cyl('glowRed', bx + 8, y0 + 14.2, zb + 3, 0.3, 0.4, { radial: 8 });
  b.cyl('glowRed', bx - 10.6, y0 + 9.6, zf - 2, 0.35, 0.5, { radial: 8 });
  // inside: lit back wall and consoles seen through the glass
  quad(b, 'windowWarm', 'pz', bx, y0 + 4.6, zb + 0.5, 21, 6);
  for (let i = 0; i < 5; i++) {
    const cx = bx - 8 + i * 4;
    b.box('dbg', cx, y0 + 1.8, zf - 2.6, 3, 1.8, 1.6);
    quad(b, rng.chance(0.3) ? 'glowGreen' : 'windowCool', 'py', cx, y0 + 2.72, zf - 2.6, 2.4, 1.0);
  }
  // stairs up the right side
  for (let k = 0; k < 9; k++) b.box('dbg', bx + 12.6 + (8 - k) * 1.1, (k + 0.5) * (y0 / 9), zf - 2, 1.2, y0 / 9, 3.6, { hide: { ny: true } });
  bar(b, 'gunmetal', [bx + 12.6, y0 + 3.2, zf - 0.3], [bx + 22.4, 4.2, zf - 0.3], 0.14, { radial: 6 });
  bar(b, 'gunmetal', [bx + 22.4, 0, zf - 0.3], [bx + 22.4, 4.2, zf - 0.3], 0.14, { radial: 6 });
}

/** Battle-droid storage rack: folded droids on three shelves. */
function droidRack(b: B, rng: Rng, x: number, z: number): void {
  const w = 24;
  for (const s of [-1, 0, 1]) b.box('gunmetal', x + s * (w / 2), 9, z, 0.8, 18, 3);
  for (let r = 0; r < 3; r++) {
    const y = 1 + r * 6;
    b.box('dbg', x, y, z, w + 0.8, 0.6, 3.2);
    b.box('yellow', x, y, z + 1.62, w + 0.8, 0.3, 0.06);
    for (let i = 0; i < 7; i++) {
      const dx = x - w / 2 + 1.8 + i * 3.4;
      b.box('tan', dx, y + 1.8, z + 0.2, 1.2, 2.4, 1.6);
      b.cyl('tan', dx, y + 3.3, z + 0.6, 0.35, 1.6, { axis: 'z', radial: 8 });
      b.box('tan', dx, y + 3.5, z - 0.3, 0.6, 0.5, 1.2);
      b.cyl('tan', dx - 0.5, y + 1.2, z + 1.0, 0.18, 1.6, { radial: 6 });
      b.cyl('tan', dx + 0.5, y + 1.2, z + 1.0, 0.18, 1.6, { radial: 6 });
      if (rng.chance(0.3)) b.box('reddishBrown', dx, y + 2.2, z + 1.05, 0.9, 0.9, 0.1);
    }
  }
  b.box('dbg', x, 18.6, z, w + 1.6, 1.2, 3.6);
  b.cyl('glowRed', x - w / 2, 19.6, z, 0.3, 0.6, { radial: 8 });
  b.cyl('glowRed', x + w / 2, 19.6, z, 0.3, 0.6, { radial: 8 });
}

/** Crates, containers, fuel canisters, cable spools, a fuel depot with an orange beacon, a tug. */
function props(b: B, rng: Rng): void {
  const crate = (x: number, y: number, z: number, s: number, key: ColorKey, rot: number) => {
    b.push();
    b.translate(x, y, z);
    b.rotateY(rot);
    b.box(key, 0, s / 2, 0, s, s, s);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) b.box('dbg', (dx * s) / 2, s / 2, (dz * s) / 2, 0.5, s + 0.1, 0.5);
    b.box('dbg', 0, s + 0.05, 0, s + 0.1, 0.3, 0.6);
    b.box(key === 'dbg' ? 'lbg' : 'dbg', 0, s * 0.55, s / 2 + 0.03, s * 0.5, s * 0.35, 0.1);
    b.pop();
  };
  const stack = (x: number, z: number, n: number) => {
    let y = 0;
    for (let i = 0; i < n; i++) {
      const s = rng.pick([3, 4, 4, 5]);
      crate(x + rng.range(-0.5, 0.5), y, z + rng.range(-0.5, 0.5), s, rng.pick(['darkTan', 'dbg', 'lbg', 'reddishBrown', 'darkTan'] as ColorKey[]), rng.range(-0.25, 0.25));
      y += s + 0.3;
    }
  };
  for (const [x, z, n] of [[-72, -44, 3], [-66, -45, 2], [-71, -37, 1], [72, 30, 2], [67, 35, 1], [-76, 28, 2], [-71, 33, 1], [70, -30, 3], [64, -34, 1], [40, 50, 1], [-40, 51, 1], [-36, 50, 2]] as const) stack(x, z, n);
  const container = (x: number, z: number, rot: number, key: ColorKey) => {
    b.push();
    b.translate(x, 0, z);
    b.rotateY(rot);
    b.box(key, 0, 3.6, 0, 12, 7, 6);
    for (let i = -5; i <= 5; i += 2) b.box(key, i, 3.6, 0, 0.5, 7.1, 6.14);
    b.box('dbg', 0, 7.2, 0, 12.2, 0.4, 6.2);
    b.box('dbg', 0, 0.2, 0, 12.2, 0.4, 6.2);
    for (const s of [-1, 1]) b.box('gunmetal', s * 6.05, 3.6, 0, 0.2, 6.6, 5.6);
    b.box('yellow', 0, 5.8, 3.08, 4, 0.8, 0.06);
    b.pop();
  };
  container(-77, 12, Math.PI / 2, 'darkTan');
  container(78, 46, Math.PI / 2, 'dbg');
  crate(78, 7.4, 46, 3, 'lbg', 0.2);
  const canisters = (x: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const cx = x + (i % 3) * 3.4;
      const cz = z + Math.floor(i / 3) * 3.4;
      b.cyl('lbg', cx, 2.6, cz, 1.5, 5.2, { radial: 16 });
      b.cyl('dbg', cx, 1.2, cz, 1.55, 0.6, { radial: 16 });
      b.cyl(i % 2 ? 'red' : 'dbg', cx, 4.1, cz, 1.55, 0.6, { radial: 16 });
      b.cyl('gunmetal', cx, 5.4, cz, 0.7, 0.5, { radial: 10 });
    }
  };
  canisters(-62, 44, 6);
  canisters(70, -48, 5);
  canisters(22, -50, 3);
  for (const [x, z] of [[-30, -49], [46, -40]] as const) {
    b.cyl('dbg', x, 2.2, z, 2.2, 0.5, { axis: 'z', radial: 16 });
    b.cyl('dbg', x, 2.2, z + 3, 2.2, 0.5, { axis: 'z', radial: 16 });
    b.cyl('black', x, 2.2, z + 1.5, 1.6, 2.6, { axis: 'z', radial: 16 });
  }
  // fuel depot with the orange warning beacon (motivates the film's orange fill light)
  const dx = -78;
  const dz = -40;
  for (const off of [-4, 4]) {
    b.cyl('lbg', dx, 7, dz + off, 3, 14, { radial: 20 });
    b.cyl('dbg', dx, 14.3, dz + off, 3.1, 0.6, { radial: 20 });
    b.cyl('darkTan', dx, 4, dz + off, 3.05, 1.2, { radial: 20 });
    b.cyl('red', dx, 10.5, dz + off, 3.05, 0.6, { radial: 20 });
  }
  bar(b, 'gunmetal', [dx + 3, 10, dz - 4], [dx + 3, 10, dz + 4], 0.4, { radial: 8 });
  bar(b, 'gunmetal', [dx, 14.6, dz - 4], [dx, 16, dz - 4], 0.3, { radial: 8 });
  bar(b, 'gunmetal', [dx, 16, dz - 4], [dx - 6, 16, dz - 4], 0.3, { radial: 8 });
  b.box('dbg', dx + 3.2, 9.5, dz, 1, 3, 3);
  quad(b, 'glowOrange', 'px', dx + 3.72, 9.5, dz, 2, 2);
  b.cyl('glowOrange', dx, 15, dz, 0.7, 0.8, { radial: 10 });
  // tow tug parked by the droid rack
  const tx = 34;
  const tz = -36;
  b.box('yellow', tx, 1.6, tz, 4, 2, 7);
  b.box('dbg', tx, 3.1, tz - 1.6, 3.6, 1.2, 2.4);
  b.box('black', tx, 1.2, tz + 3.6, 3.4, 0.8, 0.4);
  for (const [wx, wz] of [[-2, -2.5], [2, -2.5], [-2, 2.5], [2, 2.5]] as const) b.add('rubberBlack', tube(0.9, 0.35, 0.8, 0.1, 14), new Matrix4().makeTranslation(tx + wx, 0.9, tz + wz).multiply(new Matrix4().makeRotationZ(Math.PI / 2)));
}

/** Ceiling slab, beams continuing the wall ribs, light gantries (never casts shadows). */
function ceiling(b: B, rng: Rng): void {
  b.box('dbg', 0, HY + 1, 0, HX * 2 + 4, 2, HZ * 2 + 4, { hide: { py: true } });
  for (let z = -54; z <= 54; z += 12) b.box('lbg', 0, HY - 0.8, z, HX * 2, 1.6, 2.4, { hide: { py: true } });
  for (const x of [-86, -62, -38, -14, 14, 38, 62, 86]) b.box('lbg', x, HY - 0.7, 0, 2.4, 1.4, HZ * 2, { hide: { py: true } });
  for (const z of [-40, -20, 0, 20, 40]) {
    b.box('gunmetal', 0, 37.5, z, HX * 2 - 6, 1.6, 2);
    b.box('dbg', 0, 36.4, z, HX * 2 - 8, 0.6, 3);
    for (let x = -80; x <= 80; x += 20) bar(b, 'gunmetal', [x, 38.3, z], [x, HY - 1.6, z], 0.3, { radial: 6 });
    for (let x = -75; x <= 75; x += 10) {
      if (rng.chance(0.08)) continue;
      quad(b, 'glowWhite', 'ny', x, 36.05, z, 6.5, 2.4);
    }
    for (const s of [-1, 1]) b.cyl('glowRed', s * (HX - 12), 36.6, z, 0.4, 0.6, { radial: 8 });
  }
  for (let x = -75; x <= 75; x += 12) {
    for (let z = -48; z <= 48; z += 12) {
      if (rng.chance(0.4)) quad(b, 'windowWarm', 'ny', x, HY - 0.05, z, 3, 3);
    }
  }
}

export function hangarInterior(): Hangar {
  const group = new Group();
  group.name = 'hangar';
  const anchors: Record<string, Object3D> = {};
  const parts: Record<string, number> = {};
  let tris = 0;
  const put = (b: B, name: string, o: { castShadow?: boolean } = {}) => {
    const bt = b.build(name, o);
    group.add(bt.group);
    tris += bt.triangles;
    parts[name] = bt.triangles;
  };
  const rng = new Rng(2024);
  const A: [number, number] = [-17.5, 8];
  const Bp: [number, number] = [17.5, 8];

  const fl = mk(1);
  deck(fl, rng, [A, Bp]);
  put(fl, 'hangar-deck');

  const wl = mk(2);
  for (const mirror of [false, true]) {
    wl.push();
    if (mirror) wl.mirrorX();
    wl.translate(HX, 0, 0);
    wl.rotateY(-Math.PI / 2);
    sideWall(wl, rng);
    wl.pop();
  }
  wl.push();
  wl.translate(0, 0, -HZ);
  backWall(wl, rng);
  wl.pop();
  wl.push();
  wl.translate(0, 0, HZ);
  wl.rotateY(Math.PI);
  frontWall(wl, rng);
  wl.pop();
  put(wl, 'hangar-walls');

  const fx = mk(3);
  booth(fx, rng, -56);
  droidRack(fx, rng, 52, -HZ + 9);
  props(fx, rng);
  put(fx, 'hangar-props');

  const cl = mk(4);
  ceiling(cl, rng);
  put(cl, 'hangar-ceiling', { castShadow: false });

  const shield = rayShield(MW, MH, { name: 'hangar-ray-shield', scan: 40 });
  shield.mesh.position.set(0, MY0 + MH / 2, HZ + 0.2);
  group.add(shield.mesh);

  anchors.landingA = anchorFrom(fl, 'landingA', group, [A[0], 0, A[1]], [0, 0, -1]);
  anchors.landingB = anchorFrom(fl, 'landingB', group, [Bp[0], 0, Bp[1]], [0, 0, -1]);
  anchors.mouth = anchorFrom(fl, 'mouth', group, [0, MY0 + MH / 2, HZ], [0, 0, 1]);
  anchors.droidLine = anchorFrom(fl, 'droidLine', group, [0, 0, -32], [0, 0, 1]);
  anchors.elevator = anchorFrom(fl, 'elevator', group, [0, 0, -HZ + 2], [0, 0, 1]);
  anchors.booth = anchorFrom(fl, 'booth', group, [-56, 10.8, -HZ + 5], [0, 0, 1]);

  group.userData.animate = (t: number) => shield.update(t);
  group.userData.triangles = tris;
  group.userData.parts = parts;
  return { group, setShield: (v: number) => shield.set(v), anchors, size: [HX, HY, HZ] };
}
