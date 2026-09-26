import { Group, Matrix4, Object3D, type Color, type Mesh, type MeshBasicMaterial } from 'three';
import { Builder } from '../core/builder';
import { cylinder, profile, tube, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import type { Eta2 } from './types';
import { anchor } from './placeholder';
import {
  SEAM, beam, cheese, clipBox, clipHalf, decal, decalArc, decalDisc, decalR, facetNormal, grilleRun, hose, inset, layer, lerp3, loft, mirX, onFace,
  pane, part, partR, pinHead, pinHole, place, rect, ringPieces, rod, roundPlate, roundTile, satin, slab3, split, squareRing, stripes, zAt, type P2,
} from './a-kit';

/**
 * Eta-2 Actis-class Jedi interceptor at minifig scale (26.5 studs long, 21 wide), after the ROTS
 * design and the LEGO interceptor sets (75038, 75135): a forked nose whose prongs carry the long
 * laser cannons, a big grey cockpit pod with a faceted canopy and a TIE-style spoked viewport set
 * into a raked front, an astromech socket in the port wing root, split S-foils that open into an X
 * over finned radiator panels, and twin round ion engines.
 *
 * Built the way the sets are: seamed plates and tiles, studded areas beside tiled ones, printed /
 * stickered tiles (vents, hazard stripes, roundels, kill marks), grille tiles, cheese slopes,
 * Technic holes and pins, hinge knuckles, hoses. Rules that keep it steady at chase distance: no two
 * same-facing faces share a plane (prints are sunk and stand proud, crossing parts differ in
 * height), seams close onto the part below and stay shut where a part meets a moving one, and
 * fine repeated features are either the colour of what they sit on or at least ~0.12 wide.
 *
 * Ship space (studs): +Z nose, +Y up, +X port. Wing top y = 0.8, wing bottom −0.8, deck y = 1.6;
 * origin on the centre line at the wing mid-plane, near the centre of mass.
 * `cockpitAnchor` is the seated pilot's hip joint (the minifig origin, which is how the film seats
 * figures): the cushion top is 0.45 below it, so a figure in its `seated()` pose sits on the seat
 * with its hands on the yokes.
 */

const D = Math.PI / 180;
/** S-foil opening per foil at setFoils(1) */
const OPEN = 21 * D;
/** foil hinge line (x); upper foils hinge at y = +0.8, lower at −0.8 */
const HX = 5.5;
const PILOT: V3 = [0, 0.6, 0.6];
const SOCKET: V3 = [4, 1.3, 1.5];
const HINGE: V3 = [0, 2.62, -3.62];
const NOSE_PIVOT: V3 = [0, 0, 7];
const ENGINE: V3 = [1.55, 0.1, -12.62];
const MUZZLE: V3 = [2.25, -0.1, 13.9];
/** the raked front: viewport, sill strip and prow face all lie in one plane, 22° back from vertical */
const RAKE = 22 * D;
const frontZ = (y: number) => 4.856 + (1.6 - y) * Math.tan(RAKE);

interface Scheme {
  /** hull colour */
  main: ColorKey;
  /** secondary hull panels (hatches) */
  alt: ColorKey;
  /** light structure (root strips, prongs' outer edges, spine) */
  struct: ColorKey;
  /** secondary structure (wing frames, radiator frames, consoles) */
  struct2: ColorKey;
  /** cockpit pod shell */
  pod: ColorKey;
  /** canopy struts */
  frame: ColorKey;
  /** viewport rim and spokes, cheek armour */
  rim: ColorKey;
  /** cannon housings */
  gun: ColorKey;
  grille: ColorKey;
  under: ColorKey;
  /** light panels on the underside */
  belly: ColorKey;
  dark: ColorKey;
  seat: ColorKey;
  metal: ColorKey;
  /** printed marks on light grey */
  ink: ColorKey;
  /** hazard stripes on the hull colour */
  stripe: ColorKey;
  /** printed vent panels and hatch plates on the hull colour */
  inlay: ColorKey;
  /** wing-root roundel ring, printed on a `struct` tile */
  badge: ColorKey;
  /** radiator fins on the S-foils' inner faces */
  fin: ColorKey;
}

const ANAKIN: Scheme = {
  main: 'yellow', alt: 'yellow', struct: 'lbg', struct2: 'dbg', pod: 'lbg', frame: 'lbg', rim: 'dbg', gun: 'dbg', grille: 'black', under: 'dbg',
  belly: 'lbg', dark: 'black', seat: 'black', metal: 'flatSilver', ink: 'black', stripe: 'black', inlay: 'dbg', badge: 'dbg', fin: 'yellow',
};
const OBIWAN: Scheme = {
  main: 'red', alt: 'darkRed', struct: 'white', struct2: 'lbg', pod: 'lbg', frame: 'lbg', rim: 'dbg', gun: 'dbg', grille: 'dbg', under: 'dbg',
  belly: 'lbg', dark: 'black', seat: 'black', metal: 'flatSilver', ink: 'darkRed', stripe: 'white', inlay: 'lbg', badge: 'darkRed', fin: 'red',
};

// plan outlines (x, z), port side where not symmetric
const HOLE: P2[] = [[1.95, -1.5], [1.95, 2.3], [1.3, 3.9], [-1.3, 3.9], [-1.95, 2.3], [-1.95, -1.5]];
const DECK: P2[] = [[2.5, -9], [2.5, 2.5], [1.6, 3.9], [-1.6, 3.9], [-2.5, 2.5], [-2.5, -9]];
const UPPER: P2[] = [[2.5, -9], [2.5, 2.8], [1.6, 3.9], [-1.6, 3.9], [-2.5, 2.8], [-2.5, -9]];
const LOWER: P2[] = [[2.5, -9], [2.5, 3.1], [1.6, 3.9], [-1.6, 3.9], [-2.5, 3.1], [-2.5, -9]];
/** prow (fuselage ahead of the cockpit tub): footprint at the deck and at the chin; the flanks are
 * flat vertical faces (x = 1.6 − 0.3·(z − 3.9)), so the raked face narrows toward the chin */
const prowX = (z: number) => 1.6 - 0.3 * (z - 3.9);
const PROW_TOP: V3[] = [[1.6, 1.6, 3.9], [prowX(frontZ(1.6)), 1.6, frontZ(1.6)], [-prowX(frontZ(1.6)), 1.6, frontZ(1.6)], [-1.6, 1.6, 3.9]];
const PROW_BOT: V3[] = [[1.6, -1.2, 3.9], [prowX(frontZ(-1.2)), -1.2, frontZ(-1.2)], [-prowX(frontZ(-1.2)), -1.2, frontZ(-1.2)], [-1.6, -1.2, 3.9]];
const TINE: P2[] = [[2.5, 3], [5.5, 3], [5.5, 7], [3.3, 12.4], [2.5, 12.4]];
const FOIL: P2[] = [[5.5, -12], [10.5, -7.5], [10.5, 0.5], [5.5, 6]];
/** the radiator panel inside the foil's 1-stud frame */
const PANEL = inset(FOIL, 1);
const trail = (x: number) => zAt(PANEL[0], PANEL[1], x);
const lead = (x: number) => zAt(PANEL[3], PANEL[2], x);
/** knuckle centres along the foil hinges: fixed side (stub) and foil side, alternating */
const KNUCKLE_FIXED = [-10.8, -6.4, -2.0, 2.4];
const KNUCKLE_FOIL = [-8.6, -4.2, 0.2, 4.4];

/** height of the canopy's lower edge along the pod sides (solid cheeks below, glass above) */
const WAIST = 2.75;

/** Cockpit pod stations (port side; mirrored with mirX). Viewport octagon W, inner ring Wi. */
const POD = (() => {
  const cu = Math.cos(RAKE), su = Math.sin(RAKE);
  const win = (x: number, u: number): V3 => [x, 3.1 + u * cu, 4.25 - u * su];
  const oct = (k: number): V3[] => [
    win(1.7 * k, 0.6 * k), win(0.7 * k, 1.45 * k), win(-0.7 * k, 1.45 * k), win(-1.7 * k, 0.6 * k),
    win(-1.7 * k, -0.6 * k), win(-0.7 * k, -1.45 * k), win(0.7 * k, -1.45 * k), win(1.7 * k, -0.6 * k),
  ];
  /** point on the side wall (Md → Ms line) at height y */
  const wall = (y: number, z: number): V3 => [2.5 - ((y - 1.6) / (4.05 - 1.6)) * 0.25, y, z];
  const Ts: V3 = [1.5, 1.6, -3.3], Tt: V3 = [0.7, 3.05, -3.75];
  return {
    W: oct(1),
    Wi: oct(0.3),
    N: [0, su, cu] as V3,
    Mt: [1.1, 4.95, 2.3] as V3, Md: [2.25, 4.05, 2.3] as V3, Mw: wall(WAIST, 2.3), Ms: [2.5, 1.6, 2.3] as V3,
    Rt: [1.1, 4.95, -0.9] as V3, Rd: [2.25, 4.05, -0.9] as V3, Rw: wall(WAIST, -0.9), Rs: [2.5, 1.6, -0.9] as V3,
    Tt, Ts, Tw: lerp3(Ts, Tt, (WAIST - 1.6) / (3.05 - 1.6)),
    Sf: [0.9, 1.6, frontZ(1.6)] as V3,
  };
})();

export function eta2(o: { variant: 'anakin' | 'obiwan'; lod?: 0 | 1 }): Eta2 {
  const s = o.variant === 'anakin' ? ANAKIN : OBIWAN;
  const hi = o.lod !== 1;
  const seed = o.variant === 'anakin' ? 7521 : 7513;
  const name = `eta2-${o.variant}${hi ? '' : '-lod1'}`;
  const group = new Group();
  group.name = name;
  const mk = (k: number) => new Builder({ seed: seed + k, studSegments: hi ? 18 : 8 });

  // fuselage, prow, stubs, engine block, pod shell, cockpit interior, socket (never comes off)
  const hb = mk(0);
  hull(hb, s, hi);
  prow(hb, s, hi);
  for (const side of [1, -1]) {
    hb.push();
    if (side < 0) hb.mirrorX();
    stub(hb, s, hi, side > 0);
    engineHousing(hb, s, hi);
    hb.pop();
  }
  podShell(hb, s, hi);
  cockpit(hb, s, hi);
  socket(hb, s, hi);
  group.add(hb.build(`${name}:hull`).group);

  // forked nose: prongs and cannons
  const nose = pivoted(group, 'nose', NOSE_PIVOT);
  const nb = mk(1);
  for (const side of [1, -1]) {
    nb.push();
    if (side < 0) nb.mirrorX();
    tine(nb, s, hi);
    nb.pop();
  }
  nose.inner.add(nb.build(`${name}:nose`).group);
  const muzzles = [1, -1].map((sx) => anchor(sx > 0 ? 'muzzlePort' : 'muzzleStarboard', nose.pivot, sx * MUZZLE[0] - NOSE_PIVOT[0], MUZZLE[1] - NOSE_PIVOT[1], MUZZLE[2] - NOSE_PIVOT[2]));

  // canopy: glass, frame and viewport above the pod's waist, hinged at the back
  const can = pivoted(group, 'canopy', HINGE);
  const cb = mk(2);
  canopy(cb, s, hi);
  can.inner.add(cb.build(`${name}:canopy`).group);

  // S-foils: hinge pivot → breakable body at the foil centroid → mesh in ship coordinates
  const cen = centroid(FOIL);
  const foils: { pivot: Object3D; sign: number }[] = [];
  const wings: Object3D[] = [];
  for (const side of [1, -1]) {
    for (const upper of [true, false]) {
      const hingeY = upper ? 0.8 : -0.8;
      const pivot = new Object3D();
      pivot.name = `foilHinge${side > 0 ? 'Port' : 'Starboard'}${upper ? 'Upper' : 'Lower'}`;
      pivot.position.set(side * HX, hingeY, 0);
      group.add(pivot);
      const c: V3 = [side * cen[0], upper ? 0.4 : -0.4, cen[1]];
      const body = new Object3D();
      body.name = `wing${side > 0 ? 'Port' : 'Starboard'}${upper ? 'Upper' : 'Lower'}`;
      body.position.set(c[0] - side * HX, c[1] - hingeY, c[2]);
      pivot.add(body);
      const fb = mk(10 + (side > 0 ? 0 : 2) + (upper ? 0 : 1));
      fb.push();
      if (side < 0) fb.mirrorX();
      if (!upper) fb.scale(1, -1, 1);
      foil(fb, s, hi, upper, side > 0);
      fb.pop();
      const g = fb.build(`${name}:${body.name}`).group;
      g.position.set(-c[0], -c[1], -c[2]);
      body.add(g);
      foils.push({ pivot, sign: side * (upper ? 1 : -1) });
      wings.push(body);
    }
  }

  // engine glow: a plasma bulb + ring per nozzle in one object (both throttle together), with its
  // own materials so each ship can throttle
  const gb = new Builder({ seed: seed + 30, tint: 0 });
  for (const sx of [1, -1]) {
    gb.push();
    gb.translate(sx * ENGINE[0], ENGINE[1], 0);
    engineGlow(gb, hi);
    gb.pop();
  }
  const glow = gb.build(`${name}:engineGlow`).group;
  glow.position.z = -12.15;
  const glowMats: { m: MeshBasicMaterial; c: Color }[] = [];
  glow.traverse((ch) => {
    const m = ch as Mesh;
    if (!m.isMesh) return;
    const mm = (m.material as MeshBasicMaterial).clone();
    m.material = mm;
    glowMats.push({ m: mm, c: mm.color.clone() });
  });
  group.add(glow);
  const engines = [1, -1].map((sx) => {
    const e = anchor(sx > 0 ? 'enginePort' : 'engineStarboard', group, sx * ENGINE[0], ENGINE[1], ENGINE[2]);
    e.rotation.y = Math.PI;
    return e;
  });

  const setFoils = (v: number) => {
    const a = Math.max(0, Math.min(1, v)) * OPEN;
    for (const f of foils) f.pivot.rotation.z = a * f.sign;
  };
  const setEngine = (p: number) => {
    const k = Math.max(0, Math.min(1, p));
    glow.scale.set(1, 1, 0.3 + 0.7 * k);
    for (const e of glowMats) e.m.color.copy(e.c).multiplyScalar(0.04 + 0.96 * k);
  };
  setFoils(0);
  setEngine(1);
  // flat silver as the pearl plastic it is: mirror-metal barrels and rims read black against space and sparkle
  satin(group, ['flatSilver']);

  return {
    group,
    setFoils,
    setEngine,
    cockpitAnchor: anchor('cockpit', group, ...PILOT),
    astromechAnchor: anchor('astromech', group, ...SOCKET),
    canopy: can.pivot,
    muzzles,
    engines,
    breakables: [...wings, nose.pivot],
    length: MUZZLE[2] - ENGINE[2],
  };
}

/** pivot Object3D at `at` whose `inner` child cancels the offset, so meshes stay in ship space */
function pivoted(parent: Object3D, name: string, at: V3): { pivot: Object3D; inner: Object3D } {
  const pivot = new Object3D();
  pivot.name = name;
  pivot.position.set(...at);
  parent.add(pivot);
  const inner = new Object3D();
  inner.position.set(-at[0], -at[1], -at[2]);
  pivot.add(inner);
  return { pivot, inner };
}

function centroid(p: P2[]): P2 {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % p.length];
    const k = x0 * z1 - x1 * z0;
    a += k;
    cx += (x0 + x1) * k;
    cz += (z0 + z1) * k;
  }
  return [cx / (3 * a), cz / (3 * a)];
}

const id = (p: V3): V3 => p;
const mid = (a: V3, c: V3): V3 => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
const avg = (p: P2[]): P2 => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

/** Structural layer (visible bottom): layers butt together and the chamfers carry the joint. */
function L(b: Builder, key: ColorKey, poly: P2[], y0: number, h: number): void {
  layer(b, key, poly, y0, h, { hideBottom: false });
}

/** Move the vertices on the line x = x0 by d, so a seamed part still meets its neighbour flush there. */
function flush(poly: P2[], x0: number, d: number): P2[] {
  return poly.map(([x, z]) => [Math.abs(x - x0) < 1e-6 ? x0 + d : x, z] as P2);
}

/** Run fn with local +Y = ship −Y: underside details are written as if printed on a top face. */
function below(b: Builder, fn: () => void): void {
  b.push();
  b.scale(1, -1, 1);
  fn();
  b.pop();
}

/** Face frame on a wall x = x0 facing +X: footprint (u, v) = (ship z, ship y), local y out of the wall. */
function onSide(b: Builder, x0: number, fn: () => void): void {
  onFace(b, [x0, 0, 0], [1, 0, 0], [0, 1, 0], fn);
}

/** Face frame on a rear wall z = z0 facing −Z: footprint (u, v) = (ship x, ship y). */
function onRear(b: Builder, z0: number, fn: () => void): void {
  onFace(b, [0, 0, z0], [0, 0, -1], [0, 1, 0], fn);
}

/** Profile in (z, y) extruded along X from x0 to x1. */
function side(b: Builder, key: ColorKey, pts: number[][], x0: number, x1: number, c?: number): void {
  b.push();
  b.translate((x0 + x1) / 2, 0, 0);
  b.rotateY(-Math.PI / 2);
  b.prism(key, pts, Math.abs(x1 - x0), { c });
  b.pop();
}

function zTube(b: Builder, key: ColorKey, x: number, y: number, z: number, rOut: number, rIn: number, h: number, radial: number): void {
  b.add(key, tube(rOut, rIn, h, 0.02, radial), new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
}

/** Round emblem printed on a tile: a ring open fore and aft (after the Open Circle fleet mark) round a dot. */
function roundel(b: Builder, key: ColorKey, x: number, y: number, z: number, r = 0.78): void {
  decalArc(b, key, x, y, z, r * 0.66, r, 0.42, Math.PI - 0.42);
  decalArc(b, key, x, y, z, r * 0.66, r, Math.PI + 0.42, 2 * Math.PI - 0.42);
  decalDisc(b, key, x, y, z, r * 0.3);
}

/** Hatch printed on a tile: hazard-striped ends and a plain plate between them. */
function hatch(b: Builder, s: Scheme, x0: number, z0: number, x1: number, z1: number, y: number): void {
  const e = Math.min(0.42, (z1 - z0) * 0.2);
  stripes(b, s.stripe, x0 + 0.08, z0 + 0.08, x1 - 0.08, z0 + 0.08 + e, y, 0.4);
  stripes(b, s.stripe, x0 + 0.08, z1 - 0.08 - e, x1 - 0.08, z1 - 0.08, y, 0.4);
  decalR(b, s.inlay, x0 + 0.22, z0 + e + 0.22, x1 - 0.22, z1 - e - 0.22, y);
}

// ——— fuselage ———

function hull(b: Builder, s: Scheme, hi: boolean): void {
  // keel under the cockpit and engines, with inverted slopes along both sides
  L(b, s.under, rect(-1.9, -11, 1.9, 3.6), -1.6, 0.8);
  for (const sx of [1, -1]) {
    b.push();
    if (sx < 0) b.mirrorX();
    b.prism(s.under, [[1.9, -1.6], [2.5, -0.8], [1.9, -0.8]], 14.6, { zc: -3.7 });
    b.pop();
  }
  side(b, s.under, [[3.6, -1.6], [4.6, -1.2], [3.6, -1.2]], -1.6, 1.6);
  side(b, s.under, [[-11.7, -1.4], [-11, -1.6], [-11, -0.8], [-11.7, -0.8]], -1.9, 1.9);
  belly(b, s, hi);

  // floor, walls and deck around the cockpit tub
  L(b, s.under, LOWER, -0.8, 0.4);
  for (const p of ringPieces(LOWER, HOLE)) for (const q of split(p, [-5])) L(b, s.struct, q, -0.4, 0.8);
  for (const p of ringPieces(UPPER, HOLE)) for (const q of split(p, [-5])) L(b, s.main, q, 0.4, 0.8);
  deck(b, s, hi);
  spine(b, s, hi);
  engineBlock(b, s, hi);
  if (hi) {
    for (const sx of [1, -1]) {
      b.push();
      if (sx < 0) b.mirrorX();
      flank(b, s);
      b.pop();
    }
  }
}

/** Light tiles either side of the keel line (the keel's grey shows down the middle), sensor blister. */
function belly(b: Builder, s: Scheme, hi: boolean): void {
  below(b, () => {
    const rows: [number, number][] = [[-10.8, -7.6], [-7.4, -5.1], [-3.7, -1.3], [-1.1, 3.4]];
    for (const [z0, z1] of rows) {
      for (const x0 of [0.18, -1.72]) decal(b, s.belly, inset(rect(x0, z0, x0 + 1.54, z1), SEAM), 1.6, hi ? 0.05 : 0.04);
    }
    if (!hi) return;
    // printed access panels on the rear tiles and the hull colour down the keel ahead of the sensor
    for (const sx of [1, -1]) decalR(b, s.under, sx > 0 ? 0.4 : -1.5, -10.3, sx > 0 ? 1.5 : -0.4, -8.1, 1.65);
    for (const sx of [1, -1]) decalR(b, s.main, sx > 0 ? 0.3 : -1.6, 2.5, sx > 0 ? 1.6 : -0.3, 3.1, 1.65);
  });
  if (!hi) return;
  b.cyl(s.struct2, 0, -1.64, -4.4, 0.62, 0.08, { radial: 24 });
  b.cyl(s.metal, 0, -1.72, -4.4, 0.4, 0.08, { radial: 20 });
  b.cyl(s.dark, 0, -1.78, -4.4, 0.18, 0.04, { radial: 14 });
}

/** Deck plates round the cockpit tub; behind the pod a studded plate, grille tile, studded plate beside the spine. */
function deck(b: Builder, s: Scheme, hi: boolean): void {
  for (const p of ringPieces(DECK, HOLE)) {
    for (const q of split(p, [-7, -5, -3.4], [-1.5, 1.5])) {
      const [cx, cz] = avg(q);
      const beside = Math.abs(cx) > 1.5 && cz < -3.4;
      if (hi && beside && cz > -7 && cz < -5) continue;
      part(b, s.main, q, 1.2, 0.4, { studs: hi && beside });
    }
  }
  if (hi) for (const sx of [1, -1]) grilleRun(b, s.grille, s.grille, sx > 0 ? 1.5 : -2.5, -7, 2, 1, 1.2, true);
}

/** Spine behind the canopy: light-grey base, hull-colour ridge, twin hoses in clips, antenna, canopy hinge. */
function spine(b: Builder, s: Scheme, hi: boolean): void {
  const base = rect(-1.5, -11.4, 1.5, -3.0);
  const ridge = rect(-0.5, -11, 0.5, -3.2);
  side(b, s.struct, [[-12.0, 1.6], [-11.4, 1.6], [-11.4, 2.0]], -1.5, 1.5);
  side(b, s.main, [[-11.4, 2.0], [-11.0, 2.0], [-11.0, 2.4]], -0.5, 0.5);
  if (!hi) {
    L(b, s.struct, base, 1.6, 0.4);
    L(b, s.main, ridge, 2.0, 0.4);
  } else {
    // base: studded plates and printed tiles by turns
    split(base, [-9, -7, -5]).forEach((p, i) => {
      part(b, s.struct, p, 1.6, 0.4, { studs: i % 2 === 0, skip: (x) => Math.abs(x) < 0.6 });
      if (i === 1) for (const sx of [1, -1]) decalR(b, s.main, sx > 0 ? 0.9 : -1.4, -8.7, sx > 0 ? 1.4 : -0.9, -7.3, 2.0);
      if (i === 3) for (const sx of [1, -1]) decalR(b, s.inlay, sx > 0 ? 0.9 : -1.4, -4.7, sx > 0 ? 1.4 : -0.9, -3.3, 2.0);
    });
    // ridge: plate, antenna tile, grille tile, plate, hinge tile
    split(ridge, [-9.6, -8, -6, -4.4]).forEach((p, i) => {
      if (i === 2) grilleRun(b, s.main, s.main, -0.5, -8, 2, 1, 2.0, true);
      else part(b, s.main, p, 2.0, 0.4, { studs: i === 0 || i === 3 });
    });
    // twin hoses along the ridge from the pod's tail, held by clips, into the engine cowling
    for (const sx of [1, -1]) {
      hose(b, s.dark, [[sx * 0.61, 2.14, -3.35], [sx * 0.61, 2.1, -4.5], [sx * 0.61, 2.1, -8.2], [sx * 0.64, 2.04, -8.8], [sx * 0.7, 1.9, -9.1]], 0.1, { radial: 10, steps: 22 });
      for (const zc of [-4.9, -6.9]) b.box(s.struct2, sx * 0.64, 2.12, zc, 0.3, 0.24, 0.16, { c: 0.02 });
    }
    // antenna mast on a round plate
    roundPlate(b, s.struct2, 0, 2.4, -8.8, { r: 0.32, h: 0.16 });
    rod(b, s.dark, [0, 2.5, -8.8], [0, 3.35, -9.15], 0.085, { radial: 10 });
    b.add(s.struct2, cylinder(0.13, 0.14, 0.04, 12), new Matrix4().makeTranslation(0, 3.38, -9.16));
  }
  // canopy hinge: a plate on the ridge, three knuckles either side of the canopy's two, a pin through
  partR(b, s.struct2, -0.95, -3.95, 0.95, -3.3, 2.4, 0.1);
  for (const x of [0, -0.72, 0.72]) b.cyl(s.struct2, x, HINGE[1], HINGE[2], 0.2, 0.3, { axis: 'x', radial: hi ? 16 : 8 });
  if (hi) b.cyl(s.dark, 0, HINGE[1], HINGE[2], 0.08, 1.9, { axis: 'x', radial: 10 });
}

/** Engine block between the wing roots: grille cowlings, cheese-slope lips, tail lights on the rear face. */
function engineBlock(b: Builder, s: Scheme, hi: boolean): void {
  const R = rect(-3, -12, 3, -9);
  L(b, s.under, R, -1.4, 0.6);
  L(b, s.struct2, R, -0.8, 1.6);
  L(b, s.struct, R, 0.8, 0.4);
  if (!hi) {
    L(b, s.main, R, 1.2, 0.4);
    b.box(s.belly, 0, -1.43, -10.5, 3.2, 0.06, 2.2, { c: 0 });
    return;
  }
  for (const p of split(R, [], [-1.5, 1.5])) part(b, s.main, p, 1.2, 0.4);
  for (const sx of [1, -1]) {
    b.push();
    if (sx < 0) b.mirrorX();
    grilleRun(b, s.grille, s.grille, 2, -11, 2, 1, 1.6, true);
    cheese(b, s.main, 2.5, 1.6, -11.5);
    b.pop();
  }
  onRear(b, -12, () => {
    for (const sx of [1, -1]) {
      // tail lights at the top corners, outboard of the nozzles
      b.add(s.struct2, tube(0.26, 0.16, 0.08, 0.015, 16), new Matrix4().makeTranslation(sx * 2.6, 0.03, 1.3));
      b.cyl('glowRed', sx * 2.6, 0.02, 1.3, 0.16, 0.06, { radial: 14 });
    }
    // vent between the nozzles, above the exhaust shelf
    partR(b, s.struct2, -0.5, 1.0, 0.5, 1.56, -0.004, 0.06);
    for (const v of [1.1, 1.32]) decalR(b, s.dark, -0.38, v, 0.38, v + 0.12, 0.056);
  });
  // exhaust shelf under the nozzles, belly tile and exhaust slots under the block
  b.box(s.under, 0, -1.31, -12.2, 5.6, 0.16, 0.44, { c: 0.05 });
  below(b, () => {
    decal(b, s.belly, inset(rect(-1.7, -11.7, 1.7, -9.3), SEAM), 1.4, 0.05);
    for (const x of [-1.1, -0.35, 0.4]) decalR(b, s.dark, x, -11.2, x + 0.5, -9.8, 1.45);
  });
}

/** Fuselage flank above the wing root (port): SNOT vent tile behind the pod, Technic brick with pins below it. */
function flank(b: Builder, s: Scheme): void {
  onSide(b, 2.5, () => {
    partR(b, s.struct2, -8.7, 0.88, -4.5, 1.52, -0.004, 0.064);
    for (const v of [1.02, 1.26]) decalR(b, s.dark, -8.4, v, -4.8, v + 0.14, 0.06);
    partR(b, s.struct2, -3.2, 0.88, 2.1, 1.52, -0.004, 0.05);
    for (const u of [-2.5, -1.6, 0.2, 1.4]) pinHole(b, s.struct2, u, 0.046, 1.2);
    pinHead(b, s.dark, 0.2, 0.046, 1.2);
  });
}

/** Prow ahead of the cockpit tub, its face in the raked front plane; slices match the layer colours. */
function prow(b: Builder, s: Scheme, hi: boolean): void {
  const at = (y: number): V3[] => {
    const t = (y + 1.2) / 2.8;
    return PROW_TOP.map((p, i) => {
      const q = PROW_BOT[i];
      return [q[0] + (p[0] - q[0]) * t, y, q[2] + (p[2] - q[2]) * t] as V3;
    });
  };
  const slices: [ColorKey, number, number][] = [[s.under, -1.2, -0.4], [s.struct, -0.4, 0.4], [s.main, 0.4, 1.6]];
  for (const [k, y0, y1] of slices) b.add(k, loft(at(y0), at(y1)));
  // raked face frame: local x = ship −X, y out of the face, z up the face (z = 0 at ship y = 0)
  onFace(b, [0, 0, frontZ(0)], [0, Math.sin(RAKE), Math.cos(RAKE)], [0, 1, 0], () => {
    if (!hi) {
      b.box(s.struct2, 0, 0.012, 0, 1.9, 0.03, 0.64, { c: 0 });
      return;
    }
    // Technic band across the grey layer: two pin holes either side of a printed vent
    partR(b, s.struct2, -1.0, -0.38, 1.0, 0.38, -0.004, 0.034);
    for (const u of [-0.62, 0.62]) pinHole(b, s.struct2, u, 0.03, 0);
    decalR(b, s.dark, -0.22, -0.2, 0.22, 0.2, 0.03);
    // hull-colour zone: a slotted centre tile between two landing lights
    partR(b, s.struct2, -0.24, 0.6, 0.24, 1.6, -0.004, 0.034);
    for (const v of [0.8, 1.08, 1.36]) decalR(b, s.dark, -0.15, v, 0.15, v + 0.12, 0.03);
    for (const u of [-0.72, 0.72]) {
      b.add(s.struct2, tube(0.2, 0.13, 0.06, 0.012, 16), new Matrix4().makeTranslation(u, 0.025, 1.1));
      b.cyl('glowYellow', u, 0.015, 1.1, 0.13, 0.05, { radial: 14 });
    }
    // chin: a dark intake slot
    decalR(b, s.dark, -0.5, -1.06, 0.5, -0.8, 0);
  });
  if (!hi) return;
  // chin sensor and a keel lip
  b.cyl(s.metal, 0, -1.25, 5.1, 0.34, 0.1, { radial: 20 });
  b.cyl(s.dark, 0, -1.32, 5.1, 0.2, 0.05, { radial: 16 });
  for (const sx of [1, -1]) b.box(s.belly, sx * 0.9, -1.22, 4.6, 0.5, 0.04, 1.0, { c: 0.01 });
}

/** Nozzle hardware (port side; mirrored for starboard). The glow is a separate object. */
function engineHousing(b: Builder, s: Scheme, hi: boolean): void {
  const [x, y] = ENGINE;
  const at: V3 = [x, y, 0];
  if (!hi) {
    b.cyl(s.struct2, x, y, -12.3, 1.12, 0.6, { axis: 'z', radial: 14, bottom: false });
    zTube(b, s.metal, x, y, -12.58, 1.16, 0.86, 0.1, 14);
    b.lathe(s.dark, profile([[0.87, -12.6], [0.74, -12.4], [0.6, -12.16]]), { axis: 'z', at, radial: 14 });
    return;
  }
  const n = 36;
  // housing: a collar, then two ribbed rings with a soft groove between (a stack of 4×4 round parts)
  b.lathe(s.struct2, profile([[1.04, -11.97], [1.04, -12.06], [1.15, -12.1], [1.15, -12.25], [1.13, -12.28], [1.1, -12.31], [1.13, -12.34], [1.15, -12.37], [1.15, -12.54]]), { axis: 'z', at, radial: n });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    b.box(s.struct2, x + Math.sin(a) * 1.17, y + Math.cos(a) * 1.17, -12.18, 0.26, 0.1, 0.2, { rot: [0, 0, -a], c: 0.015 });
  }
  // rounded rim (a sharp metal edge is a sub-pixel highlight that crawls at chase distance), bell, vanes
  const lip = [[1.16, -12.5], [1.2, -12.54], [1.21, -12.58], [1.19, -12.62], [1.14, -12.65], [1.06, -12.665], [0.98, -12.66], [0.92, -12.64], [0.89, -12.6], [0.89, -12.54]];
  b.lathe(s.metal, profile(lip, 50), { axis: 'z', at, radial: n });
  b.lathe(s.dark, profile([[0.9, -12.6], [0.8, -12.44], [0.68, -12.28], [0.6, -12.14]]), { axis: 'z', at, radial: n });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.box(s.struct2, x + Math.sin(a) * 0.77, y + Math.cos(a) * 0.77, -12.4, 0.07, 0.2, 0.34, { rot: [0, 0, -a], c: 0.01 });
  }
}

function engineGlow(b: Builder, hi: boolean): void {
  const n = hi ? 28 : 12;
  b.lathe('glowEngine', profile([[0.45, -0.01], [0.36, -0.08], [0.2, -0.14], [0, -0.16]]), { axis: 'z', radial: n });
  b.lathe('glowOrange', profile([[0.58, -0.005], [0.45, -0.005]]), { axis: 'z', radial: n });
}

// ——— wing roots (port; mirrored for starboard) ———

function stub(b: Builder, s: Scheme, hi: boolean, port: boolean): void {
  const A = rect(3, -12, 5.5, -9), B = rect(2.5, -9, 5.5, 3);
  L(b, s.under, A, -0.8, 0.4);
  L(b, s.under, B, -0.8, 0.4);
  // core, recessed on the outer face into a radiator slot between the foil hinges
  const xo = hi ? 5.25 : 5.5;
  L(b, s.struct2, rect(3, -12, xo, -9), -0.4, 0.8);
  L(b, s.struct2, rect(2.5, -9, xo, 3), -0.4, 0.8);
  const zEnd = port ? 0 : 3;
  if (!hi) {
    L(b, s.grille, A, 0.4, 0.4);
    L(b, s.struct2, rect(2.5, -9, 3.5, zEnd), 0.4, 0.4);
    L(b, s.main, rect(3.5, -9, 5.5, zEnd), 0.4, 0.4);
    b.box(s.belly, 4.0, -0.83, -4.2, 2.1, 0.06, 3.2, { c: 0 });
    return;
  }
  b.box(s.dark, 5.285, 0, -4.5, 0.07, 0.78, 14.9, { c: 0.01 });
  for (let z = -11.5; z < 2.8; z += 0.5) b.box(s.struct2, 5.4, 0, z, 0.18, 0.7, 0.12, { c: 0.02 });

  // engine intake: a frame of hull-colour plates round a recessed grille
  const hole = rect(3.3, -11.5, 5.2, -9.3);
  for (const p of ringPieces(A, hole)) part(b, s.main, flush(p, HX, SEAM), 0.4, 0.4);
  for (let i = 0; i < 5; i++) b.box(s.grille, 3.54 + i * 0.38, 0.54, -10.4, 0.16, 0.28, 2.1, { c: 0.02, hide: { ny: true } });
  // grey strip along the fuselage: studded plates, a tile with a sensor dish and a Technic hole
  part(b, s.struct2, rect(2.5, -9, 3.5, -5), 0.4, 0.4, { studs: true });
  part(b, s.struct2, rect(2.5, -5, 3.5, -1), 0.4, 0.4);
  roundPlate(b, s.metal, 3, 0.8, -4.1, { r: 0.34, h: 0.1 });
  b.cyl(s.dark, 3, 0.91, -4.1, 0.12, 0.04, { radial: 12 });
  pinHole(b, s.struct2, 3, 0.8, -2.1);
  part(b, s.struct2, rect(2.5, -1, 3.5, zEnd), 0.4, 0.4, { studs: true });
  // hull colour inboard of the hinge: studded plates, the roundel tile, a striped hatch
  part(b, s.main, flush(rect(3.5, -9, 5.5, -7), HX, SEAM), 0.4, 0.4, { studs: true });
  part(b, s.struct, flush(rect(3.5, -7, 5.5, -5), HX, SEAM), 0.4, 0.4);
  roundel(b, s.badge, 4.5, 0.8, -6);
  part(b, s.main, flush(rect(3.5, -5, 5.5, -3), HX, SEAM), 0.4, 0.4, { studs: true });
  part(b, s.alt, flush(rect(3.5, -3, 5.5, 0), HX, SEAM), 0.4, 0.4);
  hatch(b, s, 3.5, -3, 5.5, 0, 0.8);
  if (!port) {
    // starboard: where the port side has the socket, a studded plate and a grey access hatch
    part(b, s.main, flush(rect(3.5, 2, 5.5, 3), HX, SEAM), 0.4, 0.4, { studs: true });
    part(b, s.struct, flush(rect(3.5, 0, 5.5, 2), HX, SEAM), 0.4, 0.4);
    decalR(b, s.inlay, 3.75, 0.25, 5.25, 1.75, 0.8);
    for (const x of [3.95, 5.05]) b.cyl(s.struct, x, 0.83, 1.0, 0.1, 0.06, { radial: 10 });
  }

  // rear face: manoeuvring thruster in a round brick, printed vent tile
  onRear(b, -12, () => {
    b.cyl(s.struct2, 4.3, 0.14, 0, 0.36, 0.28, { radial: 16 });
    b.add(s.metal, tube(0.3, 0.19, 0.12, 0.02, 16), new Matrix4().makeTranslation(4.3, 0.32, 0));
    b.cyl(s.dark, 4.3, 0.285, 0, 0.2, 0.02, { radial: 14 });
    for (const v of [-0.2, 0.06]) decalR(b, s.dark, 3.2, v, 3.7, v + 0.14, 0);
  });
  // underside: landing-gear door, flick-fire missile pod
  below(b, () => {
    decal(b, s.belly, inset(rect(3.0, -5.3, 5.0, -2.1), SEAM), 0.8, 0.05);
    decalR(b, s.under, 3.15, -5.15, 4.85, -4.85, 0.85);
  });
  b.box(s.struct2, 4.2, -0.93, -7.0, 0.46, 0.28, 1.4, { c: 0.03 });
  b.cyl(s.dark, 4.2, -1.24, -6.9, 0.28, 3.0, { axis: 'z', radial: 16 });
  b.lathe(s.metal, profile([[0, -4.78], [0.1, -4.88], [0.2, -5.13], [0.22, -5.42]]), { axis: 'z', at: [4.2, -1.24, 0], radial: 14 });
  b.cyl(s.struct2, 4.2, -1.24, -8.45, 0.3, 0.12, { axis: 'z', radial: 16 });
  // hinge knuckles on the fixed side
  for (const y of [0.8, -0.8]) for (const z of KNUCKLE_FIXED) b.cyl(s.struct2, HX, y, z, 0.21, 0.8, { axis: 'z', radial: 14 });
}

function socket(b: Builder, s: Scheme, hi: boolean): void {
  const [x, , z] = SOCKET;
  const n = hi ? 44 : 20;
  b.add(s.struct, squareRing(3, 1.12, 0.4, n), new Matrix4().makeTranslation(x, 0.6, z));
  b.cyl(s.dark, x, 0.44, z, 1.13, 0.04, { radial: n, bottom: false });
  b.add(hi ? s.main : s.struct2, tube(1.36, 1.12, 0.2, 0.03, n), new Matrix4().makeTranslation(x, 0.9, z));
  if (!hi) return;
  // hazard ring printed on the collar, clamp blocks, corner caps, service hose into the cockpit
  for (let i = 0; i < 16; i += 2) decalArc(b, s.stripe, x, 1.0, z, 1.15, 1.33, (i / 16) * Math.PI * 2, ((i + 1) / 16) * Math.PI * 2, { steps: 2 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.box(s.struct2, x + Math.sin(a) * 1.26, 1.05, z + Math.cos(a) * 1.26, 0.34, 0.14, 0.26, { rot: [0, a, 0], c: 0.025 });
  }
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    roundTile(b, s.struct2, x + dx * 1.2, 0.8, z + dz * 1.2, 0.26, 0.08, 12);
    b.cyl(s.struct, x + dx * 1.2, 0.9, z + dz * 1.2, 0.09, 0.05, { radial: 8 });
  }
  b.add(s.dark, tube(1.12, 1.02, 0.06, 0.01, n), new Matrix4().makeTranslation(x, 0.98, z));
  hose(b, s.dark, [[2.92, 0.84, 0.7], [2.78, 1.05, 0.35], [2.64, 1.26, -0.1], [2.52, 1.3, -0.4]], 0.09, { radial: 10, steps: 14 });
}

// ——— forked nose (port prong; mirrored for starboard) ———

function tine(b: Builder, s: Scheme, hi: boolean): void {
  /** outer (swept) edge of the prong at z */
  const xo = (z: number) => (z <= 7 ? 5.5 : 5.5 - ((z - 7) * 2.2) / 5.4);
  L(b, s.under, TINE, -0.8, 0.4);
  if (hi) {
    // middle: notched on the outer edge for the ion cannon
    L(b, s.struct, clipBox(TINE, 2.5, 5.5, 3, 5.8), -0.4, 0.8);
    L(b, s.struct, clipBox(TINE, 2.5, 4.8, 5.8, 7.6), -0.4, 0.8);
    L(b, s.struct, clipHalf(TINE, 0, -1, -7.6), -0.4, 0.8);
    below(b, () => decal(b, s.belly, inset(clipBox(TINE, 2.9, 4.3, 4.6, 10.6), SEAM), 0.8, 0.05));
    // top: a hazard-striped tile beside studded plates at the root; printed tile, grille, grey studded edge
    partR(b, s.main, 2.5, 3, 3.5, 6, 0.4, 0.4);
    stripes(b, s.stripe, 2.58, 3.08, 3.42, 5.92, 0.8, 0.4);
    part(b, s.main, flush(rect(3.5, 3, 5.5, 5), HX, SEAM), 0.4, 0.4, { studs: true });
    part(b, s.main, flush(rect(3.5, 5, 5.5, 6), HX, SEAM), 0.4, 0.4, { studs: true });
    part(b, s.main, clipBox(TINE, 2.5, 3.5, 6, 11.4), 0.4, 0.4);
    decalR(b, s.inlay, 2.72, 6.5, 3.28, 9.4, 0.8);
    decalR(b, s.inlay, 2.72, 9.8, 3.28, 10.4, 0.8);
    grilleRun(b, s.grille, s.grille, 3.5, 6, 3, 1, 0.4, true, { tile: 1.5 });
    part(b, s.main, clipBox(TINE, 3.5, 4.5, 9, 11.4), 0.4, 0.4);
    part(b, s.struct, flush(clipBox(TINE, 4.5, 5.5, 6, 11.4), HX, SEAM), 0.4, 0.4, { studs: true });
    // swept outer face: Technic holes and a printed panel on the grey layer (u along the edge, v up)
    onFace(b, [xo(9.7), 0, 9.7], [0.926, 0, 0.377], [0, 1, 0], () => {
      for (const u of [0.1, 1.1]) pinHole(b, s.struct, u, 0, 0);
      decalR(b, s.inlay, 1.6, -0.26, 2.55, 0.26, 0);
    });
    // Technic holes on the root's outer face (seen when the foils open)
    onSide(b, HX, () => {
      for (const u of [3.8, 5.0]) pinHole(b, s.struct, u, 0, 0);
    });
  } else {
    L(b, s.struct, TINE, -0.4, 0.8);
    b.box(s.belly, 3.4, -0.83, 7.5, 0.8, 0.06, 5.0, { c: 0 });
    L(b, s.main, rect(2.5, 3, 5.5, 6), 0.4, 0.4);
    L(b, s.main, clipBox(TINE, 2.5, 3.5, 6, 11.4), 0.4, 0.4);
    L(b, s.grille, rect(3.5, 6, 4.5, 9), 0.4, 0.4);
    L(b, s.main, clipBox(TINE, 3.5, 4.5, 9, 11.4), 0.4, 0.4);
    L(b, s.struct, clipBox(TINE, 4.5, 5.5, 6, 11.4), 0.4, 0.4);
  }
  L(b, s.main, clipHalf(TINE, 0, -1, -11.4), 0.4, 0.2);
  side(b, s.main, [[11.4, 0.6], [12.35, 0.6], [11.4, 0.8]], 2.5, xo(12.4) - 0.02);

  // main laser cannon along the inner edge
  const [mx, my, mz] = MUZZLE;
  const at: V3 = [mx, my, 0];
  if (hi) {
    // housing: round bricks with grooves between, metal collars, clip brackets to the prong
    const pts: number[][] = [[0, 8.96], [0.2, 8.96], [0.33, 8.9], [0.42, 8.64]];
    for (const g of [7.44, 6.24, 5.04]) pts.push([0.42, g + 0.05], [0.385, g + 0.025], [0.385, g - 0.025], [0.42, g - 0.05]);
    pts.push([0.42, 3.44], [0.33, 3.18], [0.2, 3.1], [0, 3.1]);
    b.lathe(s.gun, profile(pts), { axis: 'z', at, radial: 20 });
    for (const zc of [3.8, 8.3]) b.cyl(s.metal, mx, my, zc, 0.47, 0.16, { axis: 'z', radial: 20 });
    for (const zc of [4.4, 7.9]) b.box(s.gun, mx + 0.33, my + 0.04, zc, 0.34, 0.36, 0.4, { c: 0.03 });
    // barrel with cooling sleeves, flared flash hider with a dark bore
    b.cyl(s.metal, mx, my, (8.9 + mz - 0.5) / 2, 0.17, mz - 0.5 - 8.9, { axis: 'z', radial: 16 });
    for (const zc of [9.7, 10.9, 12.1]) b.cyl(s.dark, mx, my, zc, 0.26, 0.18, { axis: 'z', radial: 16 });
    b.lathe(s.gun, profile([[0.12, mz], [0.27, mz], [0.27, mz - 0.1], [0.23, mz - 0.18], [0.23, mz - 0.52], [0.18, mz - 0.56]]), { axis: 'z', at, radial: 16 });
    b.cyl(s.dark, mx, my, mz - 0.02, 0.12, 0.03, { axis: 'z', radial: 12 });
  } else {
    b.cyl(s.gun, mx, my, 6.0, 0.42, 5.2, { axis: 'z', radial: 8, top: false, bottom: false });
    b.lathe(s.gun, profile([[0, 8.9], [0.2, 8.9], [0.32, 8.85], [0.42, 8.6]]), { axis: 'z', at, radial: 8 });
    b.lathe(s.gun, profile([[0.42, 3.4], [0.32, 3.15], [0.2, 3.1], [0, 3.1]]), { axis: 'z', at, radial: 8 });
    b.cyl(s.metal, mx, my, (8.85 + mz - 0.55) / 2, 0.14, mz - 0.55 - 8.85, { axis: 'z', radial: 6 });
    zTube(b, s.dark, mx, my, mz - 0.3, 0.21, 0.1, 0.6, 8);
  }

  // ion cannon in the outer notch: housing with a vented side plate, power cell, barrel
  b.box(s.gun, 5.05, -0.05, 6.7, 0.5, 0.62, 1.8, { c: 0.04 });
  if (hi) {
    b.box(s.metal, 5.31, -0.05, 6.6, 0.04, 0.34, 1.2, { c: 0.01 });
    for (const zc of [6.3, 6.85]) b.box(s.dark, 5.335, -0.05, zc, 0.03, 0.2, 0.3, { c: 0.005 });
    b.cyl(s.gun, 5.05, 0.3, 6.3, 0.2, 0.12, { radial: 14 });
    b.cyl(s.metal, 5.05, -0.05, 7.72, 0.2, 0.24, { axis: 'z', radial: 14 });
  }
  b.cyl(s.metal, 5.05, -0.05, 8.6, 0.12, 2.0, { axis: 'z', radial: hi ? 12 : 6 });
  b.cyl(s.dark, 5.05, -0.05, 9.75, 0.15, 0.3, { axis: 'z', radial: hi ? 12 : 6 });
}

// ——— cockpit ———

function cockpit(b: Builder, s: Scheme, hi: boolean): void {
  const [, py, pz] = PILOT;
  const cushion = py - 0.45;
  // seat: base, cushion, back, headrest
  b.box(s.struct2, 0, (-0.4 + cushion - 0.2) / 2, pz + 0.05, 1.9, cushion - 0.2 + 0.4, 1.2, { hide: { ny: true } });
  b.box(s.seat, 0, cushion - 0.1, pz + 0.05, 1.84, 0.2, 1.16, { c: 0.06 });
  b.box(s.seat, 0, cushion + 1.05, pz - 0.64, 1.8, 2.1, 0.3, { c: 0.06 });
  b.box(s.seat, 0, py + 2.2, pz - 0.95, 1.1, 1.0, 0.3, { c: 0.08 });
  b.box(s.struct2, 0, py + 1.6, pz - 0.95, 0.36, 0.3, 0.2);
  for (const sx of [1, -1]) b.box(s.struct2, sx * 1.06, 0.2, pz + 0.1, 0.12, 1.2, 1.3);
  // side consoles
  for (const sx of [1, -1]) {
    b.box(s.struct2, sx * 1.64, 0.35, 0.4, 0.6, 1.5, 3.8, { hide: { ny: true } });
    if (!hi) continue;
    grilleRun(b, s.grille, s.grille, sx > 0 ? 1.44 : -1.84, -1.3, 1.6, 0.4, 1.1, true, { bars: 3 });
    (['glowRed', 'glowGreen', 'glowYellow'] as ColorKey[]).forEach((k, i) => roundTile(b, k, sx * 1.64, 1.1, 0.9 + i * 0.4, 0.1, 0.06, 10));
    rod(b, s.dark, [sx * 1.64, 1.1, 0.35], [sx * 1.64, 1.55, 0.5], 0.04, { radial: 8 });
    b.cyl(s.metal, sx * 1.64, 1.58, 0.51, 0.08, 0.1, { radial: 10 });
    // screen on a bezel at the front of the console
    b.box(s.dark, sx * 1.64, 1.12, 2.05, 0.46, 0.04, 0.34, { c: 0.01 });
    b.box('windowCool', sx * 1.64, 1.14, 2.05, 0.36, 0.02, 0.24, { c: 0.004 });
    // yoke: grip bar along X through the C of a seated minifig's hand (arms at 0.95 rad, grip at
    // x ±1.1, y 2.07, z 1.78), on a stem down into the dash
    rod(b, s.dark, [sx * 0.85, 2.07, 1.78], [sx * 1.36, 2.07, 1.78], 0.09, { radial: 10 });
    rod(b, s.struct2, [sx * 1.27, 2.07, 1.8], [sx * 1.27, 1.1, 2.45], 0.07, { radial: 8 });
    b.cyl(s.metal, sx * 1.4, 2.07, 1.78, 0.1, 0.06, { axis: 'x', radial: 10 });
  }
  // dash with its sloped instrument face toward the pilot
  side(b, s.struct2, [[2.25, -0.4], [3.95, -0.4], [3.95, 1.72], [2.95, 1.72], [2.25, 1.1]], -1.3, 1.3);
  if (hi) {
    b.push();
    b.translate(0, (1.1 + 1.72) / 2, (2.25 + 2.95) / 2);
    b.rotateX(-Math.atan2(0.62, 0.7));
    b.box(s.dark, 0, 0.005, 0, 2.3, 0.03, 0.78, { c: 0.01 });
    b.box('windowCool', 0, 0.03, 0.05, 0.7, 0.02, 0.36, { c: 0.005 });
    for (const x of [-0.8, 0.8]) b.box('windowCool', x, 0.03, 0.0, 0.34, 0.02, 0.16, { c: 0.004 });
    const keys: ColorKey[] = ['glowRed', 'glowGreen', 'glowBlue', 'glowYellow', 'glowRed', 'glowGreen'];
    keys.forEach((k, i) => {
      const x = i < 3 ? -0.95 + i * 0.2 : 0.55 + (i - 3) * 0.2;
      roundTile(b, k, x, 0.02, 0.2, 0.07, 0.04, 10);
    });
    for (const x of [-0.8, 0.8]) b.box(s.metal, x, 0.03, -0.24, 0.44, 0.02, 0.12, { c: 0.005 });
    b.pop();
    b.box(s.struct2, 0, 1.76, 3.45, 1.6, 0.08, 0.9, { c: 0.02 });
    // the pilot's lightsaber in its holder on the dash top
    rod(b, s.metal, [-0.9, 1.87, 3.3], [-0.2, 1.87, 3.3], 0.07, { radial: 10 });
    for (const xc of [-0.72, -0.6, -0.48]) b.cyl(s.dark, xc, 1.87, 3.3, 0.085, 0.05, { axis: 'x', radial: 10 });
    for (const xc of [-0.8, -0.3]) b.box(s.dark, xc, 1.83, 3.3, 0.08, 0.06, 0.2, { c: 0.01 });
  }
  // bulkhead behind the seat
  b.box(s.struct2, 0, 0.5, -0.9, 3.6, 1.8, 1.1, { hide: { ny: true } });
  if (hi) {
    grilleRun(b, s.grille, s.grille, -1.0, -1.4, 2, 1, 1.4, false);
    roundTile(b, 'glowBlue', 1.35, 1.4, -0.9, 0.12, 0.06, 10);
    roundTile(b, s.metal, -1.35, 1.4, -0.9, 0.2, 0.1, 12);
  }
}

/** Pod walls up to the canopy's waist line: solid cheeks, the sill strip under the viewport, tail. */
function podShell(b: Builder, s: Scheme, hi: boolean): void {
  const P = POD, W = P.W, m = mirX;
  const t = 0.14;
  for (const q of [id, m]) {
    slab3(b, s.pod, [q(P.Mw), q(P.Ms), q(P.Rs), q(P.Rw)], t, { side: 0 });
    slab3(b, s.pod, [q(P.Mw), q(W[7]), q(P.Ms)], t, { side: 0 });
    slab3(b, s.pod, [q(P.Ms), q(W[7]), q(P.Sf)], t, { side: 0 });
    slab3(b, s.pod, [q(W[7]), q(W[6]), q(P.Sf)], t, { side: 0 });
    slab3(b, s.pod, [q(P.Rw), q(P.Rs), q(P.Ts)], t, { side: 0 });
    slab3(b, s.pod, [q(P.Rw), q(P.Ts), q(P.Tw)], t, { side: 0 });
  }
  slab3(b, s.pod, [W[6], W[5], m(P.Sf), P.Sf], t, { side: 0 });
  slab3(b, s.pod, [P.Ts, P.Tw, m(P.Tw), m(P.Ts)], t, { side: 0 });
  // base rail on the deck and the ribs of the front and rear frames
  const C0: V3 = [0, 2.6, 0.7];
  const rib = (a: V3, c: V3) => {
    const q = mid(a, c);
    beam(b, s.frame, a, c, 0.22, 0.2, [q[0] - C0[0], q[1] - C0[1], q[2] - C0[2]], { ext: 0.11 });
  };
  const sill = (a: V3, c: V3) => beam(b, s.frame, [a[0], 1.7, a[2]], [c[0], 1.7, c[2]], 0.32, 0.2, [0, 1, 0], { ext: 0.16 });
  for (const q of [id, m]) {
    rib(q(P.Ms), q(P.Mw));
    rib(q(P.Rs), q(P.Rw));
    sill(q(P.Sf), q(P.Ms));
    sill(q(P.Ms), q(P.Rs));
    sill(q(P.Rs), q(P.Ts));
  }
  sill(P.Sf, m(P.Sf));
  if (!hi) return;
  for (const sx of [1, -1]) {
    b.push();
    if (sx < 0) b.mirrorX();
    cheek(b, s);
    b.pop();
  }
  // front latch under the viewport
  b.box(s.rim, 0, 1.7, frontZ(1.7) + 0.05, 0.5, 0.12, 0.12, { c: 0.03 });
}

/** Cockpit cheek (port): armour tile with vents, kill marks, a latch pin in a Technic hole. */
function cheek(b: Builder, s: Scheme): void {
  const P = POD;
  const q = [P.Mw, P.Ms, P.Rs, P.Rw];
  const n = facetNormal(q);
  const c = q.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4] as V3, [0, 0, 0] as V3);
  // the slab is centred on the plane: its outer face is half the thickness out (u forward, v up)
  onFace(b, [c[0] + n[0] * 0.07, c[1] + n[1] * 0.07, c[2] + n[2] * 0.07], n, [0, 1, 0], () => {
    partR(b, s.rim, -1.32, -0.3, -0.12, 0.36, -0.004, 0.06);
    for (const v of [-0.12, 0.12]) decalR(b, s.dark, -1.14, v, -0.3, v + 0.13, 0.056);
    for (let i = 0; i < 3; i++) decalR(b, s.ink, 0.05 + i * 0.26, 0.12, 0.23 + i * 0.26, 0.3, 0);
    pinHole(b, s.pod, 1.15, 0, -0.02);
    pinHead(b, s.dark, 1.15, 0, -0.02);
  });
}

function canopy(b: Builder, s: Scheme, hi: boolean): void {
  const P = POD, W = P.W, Wi = P.Wi, m = mirX;
  // glass
  pane(b, 'trClear', W);
  pane(b, 'trClear', [P.Mt, m(P.Mt), W[2], W[1]]);
  pane(b, 'trClear', [P.Mt, m(P.Mt), m(P.Rt), P.Rt]);
  pane(b, 'trClear', [P.Rt, m(P.Rt), m(P.Tt), P.Tt]);
  for (const q of [id, m]) {
    pane(b, 'trClear', [q(P.Mt), q(W[1]), q(W[0]), q(P.Md)]);
    pane(b, 'trClear', [q(P.Md), q(W[0]), q(W[7]), q(P.Mw)]);
    pane(b, 'trClear', [q(P.Mt), q(P.Md), q(P.Rd), q(P.Rt)]);
    pane(b, 'trClear', [q(P.Md), q(P.Mw), q(P.Rw), q(P.Rd)]);
  }
  // solid rear: flanks above the waist and the top of the tail
  const t = 0.14;
  for (const q of [id, m]) {
    slab3(b, s.pod, [q(P.Rt), q(P.Rd), q(P.Tt)], t, { side: 0 });
    slab3(b, s.pod, [q(P.Rd), q(P.Rw), q(P.Tw)], t, { side: 0 });
    slab3(b, s.pod, [q(P.Rd), q(P.Tw), q(P.Tt)], t, { side: 0 });
  }
  slab3(b, s.pod, [P.Tw, P.Tt, m(P.Tt), m(P.Tw)], t, { side: 0 });

  // viewport: octagonal rim, inner ring, four diagonal spokes
  for (let i = 0; i < 8; i++) beam(b, s.rim, W[i], W[(i + 1) % 8], 0.26, 0.26, P.N, { ext: 0.13 });
  for (let i = 0; i < 8; i++) beam(b, s.rim, Wi[i], Wi[(i + 1) % 8], 0.11, 0.16, P.N, { ext: 0.055 });
  for (const i of [0, 2, 4, 6]) beam(b, s.rim, mid(Wi[i], Wi[i + 1]), mid(W[i], W[i + 1]), 0.11, 0.16, P.N);

  // struts, outward "up" so each bar lies on the surface
  const C0: V3 = [0, 2.6, 0.7];
  const out = (p: V3): V3 => {
    const d: V3 = [p[0] - C0[0], p[1] - C0[1], p[2] - C0[2]];
    const l = Math.hypot(...d);
    return [d[0] / l, d[1] / l, d[2] / l];
  };
  const bar = (a: V3, c: V3, w = 0.22, h = 0.2) => beam(b, s.frame, a, c, w, h, out(mid(a, c)), { ext: w / 2 });
  for (const q of [id, m]) {
    bar(q(P.Mw), q(P.Md));
    bar(q(P.Md), q(P.Mt));
    bar(q(P.Rw), q(P.Rd));
    bar(q(P.Rd), q(P.Rt));
    bar(q(P.Mt), q(P.Rt), 0.26, 0.22);
    bar(q(P.Md), q(P.Rd));
    bar(q(P.Mt), q(W[1]));
    bar(q(P.Md), q(W[0]));
    bar(q(W[7]), q(P.Mw), 0.26, 0.18);
    bar(q(P.Mw), q(P.Rw), 0.26, 0.18);
    bar(q(P.Rw), q(P.Tw), 0.26, 0.18);
    bar(q(P.Rt), q(P.Tt), 0.26, 0.22);
    bar(q(P.Tw), q(P.Tt));
  }
  bar(P.Mt, m(P.Mt));
  bar(P.Rt, m(P.Rt));
  bar(P.Tt, m(P.Tt));
  if (!hi) return;
  // hinge knuckles between the hull's three, arms up to the tail frame
  for (const sx of [1, -1]) {
    b.cyl(s.frame, sx * 0.36, HINGE[1], HINGE[2], 0.2, 0.34, { axis: 'x', radial: 14 });
    beam(b, s.frame, [sx * 0.36, HINGE[1] + 0.08, HINGE[2] - 0.04], [sx * 0.55, 3.0, -3.72], 0.3, 0.18, [0, 0, -1]);
  }
  // bolt heads on the frame joints and round the viewport rim, a sensor pip on the roof
  const bolt = cylinder(0.1, 0.1, 0.025, 10);
  for (const q of [id, m]) for (const p of [P.Mt, P.Rt, P.Tt, P.Md, P.Rd]) {
    const d = out(q(p));
    place(b, s.rim, bolt, [q(p)[0] + d[0] * 0.11, q(p)[1] + d[1] * 0.11, q(p)[2] + d[2] * 0.11], d);
  }
  const pip = cylinder(0.07, 0.08, 0.02, 10);
  for (const p of W) place(b, s.frame, pip, [p[0] + P.N[0] * 0.14, p[1] + P.N[1] * 0.14, p[2] + P.N[2] * 0.14], P.N);
  b.cyl(s.rim, 0, 5.02, 0.7, 0.14, 0.1, { radial: 12 });
  for (const sx of [1, -1]) {
    b.push();
    if (sx < 0) b.mirrorX();
    rearVent(b, s);
    b.pop();
  }
}

/** Vent tile on the canopy's solid rear flank (port), clear of the waist and front struts (u forward, v up). */
function rearVent(b: Builder, s: Scheme): void {
  const P = POD;
  const q = [P.Rd, P.Rw, P.Tw];
  const n = facetNormal(q);
  const c = q.reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3, a[2] + p[2] / 3] as V3, [0, 0, 0] as V3);
  onFace(b, [c[0] + n[0] * 0.07, c[1] + n[1] * 0.07, c[2] + n[2] * 0.07], n, [0, 1, 0], () => {
    partR(b, s.rim, -0.25, -0.18, 0.7, 0.2, -0.004, 0.05);
    for (const v of [-0.1, 0.06]) decalR(b, s.dark, -0.13, v, 0.58, v + 0.1, 0.046);
  });
}

// ——— S-foil (modelled as the PORT UPPER foil, y 0..0.8, radiator face at y = 0) ———

function foil(b: Builder, s: Scheme, hi: boolean, upper: boolean, port: boolean): void {
  const frame = ringPieces(FOIL, PANEL); // [trailing band, tip strip, leading band, root strip]
  const [trailB, tipS, leadB, rootS] = frame;
  // inner (radiator) face: grey frame, recessed dark panel, broad fins, two manifolds crossing them
  // (fins and manifolds stop short of y = 0, clear of the other foil's when the pair is closed)
  for (const p of frame) L(b, s.struct2, p, 0, 0.4);
  L(b, s.dark, PANEL, 0.15, 0.25);
  const pitch = hi ? 0.4 : 0.6;
  for (let x = 6.5 + pitch * 0.75; x < 9.5 - pitch * 0.4; x += pitch) {
    const z0 = trail(x) + 0.12, z1 = lead(x) - 0.12;
    b.box(s.fin, x, 0.085, (z0 + z1) / 2, hi ? 0.16 : 0.2, 0.13, z1 - z0, { c: 0 });
  }
  for (const z of [-5.0, -1.4]) b.box(s.struct2, 8, 0.065, z, 2.96, 0.11, 0.22, { c: hi ? 0.02 : 0 });

  // outer face, y 0.4..0.8: grey root strip, frame of wedge plates round the hull-colour panel
  const k = upper
    ? { root: s.struct, frame: s.struct2, panel: s.main, lead: s.struct2 }
    : { root: s.under, frame: s.under, panel: s.belly, lead: s.main };
  const rear = clipHalf(PANEL, 0, 1, -6.4);
  const front = clipHalf(PANEL, 0, -1, 2.2);
  const vent = clipBox(PANEL, 6.5, 9.5, -6.4, -3.2);
  const rib = clipBox(PANEL, 6.5, 9.5, -3.2, -2.2);
  if (!hi) {
    L(b, k.root, rootS, 0.4, 0.4);
    for (const p of [trailB, tipS, rib]) L(b, k.frame, p, 0.4, 0.4);
    L(b, k.lead, leadB, 0.4, 0.4);
    for (const p of [rear, front, vent]) L(b, k.panel, p, 0.4, 0.4);
    return;
  }
  const st = upper;
  // root strip: studded hinge plates and tiles by turns, flush along the hinge line
  split(rootS, [-8, -4, -1, 2]).forEach((p, i) => part(b, k.root, flush(p, HX, -SEAM), 0.4, 0.4, { studs: st && i % 2 === 0 }));
  for (const p of split(trailB, [], [7, 8.5])) part(b, k.frame, flush(p, HX, -SEAM), 0.4, 0.4);
  split(tipS, [-4, -1]).forEach((p, i) => part(b, k.frame, p, 0.4, 0.4, { studs: st && i !== 1 }));
  for (const p of split(leadB, [], [7.5, 8.5])) part(b, k.lead, flush(p, HX, -SEAM), 0.4, 0.4);
  // panel: studded rear plates, a grille block, a studded rib, the printed front tile, a studded outer strip
  for (const p of split(rear, [], [7.5])) part(b, k.panel, p, 0.4, 0.4, { studs: st });
  if (upper) {
    for (let c = 0; c < 2; c++) grilleRun(b, k.panel, k.panel, 6.5 + c, -6.4, 3.2, 1, 0.4, true, { tile: 1.6 });
    part(b, k.panel, clipBox(vent, 8.5, 9.5, -6.4, -3.2), 0.4, 0.4, { studs: true });
  } else part(b, k.panel, vent, 0.4, 0.4);
  part(b, k.frame, rib, 0.4, 0.4, { studs: st });
  part(b, k.panel, clipBox(front, 6.5, 8.5, -2.2, 4), 0.4, 0.4);
  part(b, k.panel, clipBox(front, 8.5, 9.5, -2.2, 4), 0.4, 0.4, { studs: st });
  if (upper) {
    // printed vent parallel to the leading edge, three slots in it
    decal(b, s.inlay, [[6.8, -1.7], [8.2, -1.7], [8.2, 1.2], [6.8, 2.74]], 0.8);
    for (const zc of [-1.3, -0.75, -0.2]) decalR(b, s.dark, 7.0, zc, 8.0, zc + 0.2, 0.814);
    // nav light on the tip: red to port, green to starboard
    b.box(k.frame, 10.52, 0.6, -2.5, 0.06, 0.3, 0.7, { c: 0.015 });
    b.cyl(port ? 'glowRed' : 'glowGreen', 10.6, 0.6, -2.5, 0.12, 0.12, { axis: 'x', radial: 12 });
  } else {
    // underside: a darker access panel on the front tile
    decal(b, s.under, [[6.9, -1.6], [8.1, -1.6], [8.1, 1.1], [6.9, 2.4]], 0.8);
  }
  // hinge knuckles on the foil side
  for (const z of KNUCKLE_FOIL) b.cyl(s.struct2, HX, 0.8, z, 0.21, 0.8, { axis: 'z', radial: 14 });
}
