import { Group, Matrix4, Object3D, type Color, type Mesh, type MeshBasicMaterial } from 'three';
import { Builder } from '../core/builder';
import { profile, tube, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import type { Eta2 } from './types';
import { anchor } from './placeholder';
import { beam, clipBox, clipHalf, grilleRun, inset, layer, lerp3, loft, mirX, pane, rect, ringPieces, rod, roundTile, slab3, split, squareRing, studsIn, zAt, type P2 } from './a-kit';

/**
 * Eta-2 Actis-class Jedi interceptor at minifig scale (26.5 studs long, 21 wide), after the ROTS
 * design and the LEGO interceptor sets: a forked nose whose prongs carry the long laser cannons, a
 * big grey cockpit pod with a faceted canopy and a TIE-style spoked viewport set into a raked
 * front, an astromech socket in the port wing root, split S-foils that open into an X over finned
 * radiator panels, and twin round ion engines.
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
  /** secondary hull panels */
  alt: ColorKey;
  /** light structure (root strips, prongs' outer edges, ribs) */
  struct: ColorKey;
  /** secondary structure (radiator frames, trailing bands, consoles) */
  struct2: ColorKey;
  /** cockpit pod shell */
  pod: ColorKey;
  /** canopy struts */
  frame: ColorKey;
  /** viewport rim and spokes */
  rim: ColorKey;
  /** cannon housings */
  gun: ColorKey;
  grille: ColorKey;
  under: ColorKey;
  /** light accents on the underside */
  belly: ColorKey;
  dark: ColorKey;
  seat: ColorKey;
  metal: ColorKey;
}

const ANAKIN: Scheme = { main: 'yellow', alt: 'yellow', struct: 'lbg', struct2: 'dbg', pod: 'lbg', frame: 'lbg', rim: 'dbg', gun: 'dbg', grille: 'black', under: 'dbg', belly: 'lbg', dark: 'black', seat: 'black', metal: 'flatSilver' };
const OBIWAN: Scheme = { main: 'red', alt: 'darkRed', struct: 'white', struct2: 'lbg', pod: 'lbg', frame: 'lbg', rim: 'dbg', gun: 'dbg', grille: 'dbg', under: 'dbg', belly: 'lbg', dark: 'black', seat: 'black', metal: 'flatSilver' };

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
  const mk = (k: number) => new Builder({ seed: seed + k, studSegments: hi ? 14 : 8 });

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
      foil(fb, s, hi, upper);
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

/** Layer with a visible bottom (the ship is seen from every side). */
function L(b: Builder, key: ColorKey, poly: P2[], y0: number, h: number): void {
  layer(b, key, poly, y0, h, { hideBottom: false });
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

/** Horizontal louvre bars on a face (a grille tile seen side-on). */
function louvre(b: Builder, key: ColorKey, cx: number, cy: number, cz: number, w: number, h: number, n: number, axis: 'x' | 'z', depth = 0.05): void {
  const pitch = h / n;
  for (let i = 0; i < n; i++) {
    const y = cy - h / 2 + pitch * (i + 0.5);
    if (axis === 'x') b.box(key, cx, y, cz, w, pitch * 0.5, depth, { c: 0.01 });
    else b.box(key, cx, y, cz, depth, pitch * 0.5, w, { c: 0.01 });
  }
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
  // belly panels (all LODs: they set the underside's colour), dark centre seam, sensor blister
  for (const [z0, z1] of [[-10.4, -6.6], [-6.2, -2.4], [-2.0, 3.2]]) {
    for (const sx of [1, -1]) b.box(s.belly, sx * 0.78, -1.63, (z0 + z1) / 2, 1.3, 0.06, z1 - z0, { c: hi ? 0.02 : 0 });
  }
  if (hi) {
    for (let z = -9.6; z < 2.6; z += 0.5) b.box(s.dark, 0, -1.64, z, 0.14, 0.04, 0.3, { c: 0.01 });
    b.cyl(s.metal, 0, -1.7, -4.4, 0.34, 0.12, { radial: 20 });
    b.cyl(s.dark, 0, -1.78, -4.4, 0.2, 0.06, { radial: 16 });
  }
  // floor, walls, deck around the cockpit tub
  L(b, s.under, LOWER, -0.8, 0.4);
  for (const p of ringPieces(LOWER, HOLE)) for (const q of split(p, [-5])) L(b, s.struct, q, -0.4, 0.8);
  for (const p of ringPieces(UPPER, HOLE)) for (const q of split(p, [-5])) L(b, s.main, q, 0.4, 0.8);
  for (const p of ringPieces(DECK, HOLE)) for (const q of split(p, [-5.5])) L(b, s.main, q, 1.2, 0.4);
  if (hi) {
    for (const sx of [1, -1]) {
      // deck studs beside the spine
      for (let z = -8.5; z <= -3.5; z += 1) b.stud(s.main, sx * 2, 1.6, z);
      // SNOT grille and round tiles on the fuselage flanks, behind the pod
      louvre(b, s.grille, sx * 2.53, 1.2, -6.4, 3.2, 0.56, 4, 'z', 0.06);
      b.box(s.struct2, sx * 2.51, 1.2, -6.4, 0.04, 0.66, 3.4, { c: 0.01 });
      for (const z of [-3.9, -8.7]) b.cyl(s.struct2, sx * 2.55, 1.2, z, 0.2, 0.1, { axis: 'x', radial: 12 });
      // fuselage flank below the pod: a slim grey rail
      b.box(s.struct, sx * 2.52, 1.02, 0.7, 0.05, 0.12, 3.4, { c: 0.02 });
    }
  }

  // spine behind the pod
  L(b, s.struct, rect(-1.5, -11.4, 1.5, -3.0), 1.6, 0.4);
  L(b, s.main, rect(-0.5, -11.0, 0.5, -3.2), 2.0, 0.4);
  side(b, s.struct, [[-12.0, 1.6], [-11.4, 1.6], [-11.4, 2.0]], -1.5, 1.5);
  side(b, s.main, [[-11.4, 2.0], [-11.0, 2.0], [-11.0, 2.4]], -0.5, 0.5);
  if (hi) {
    for (const sx of [1, -1]) for (let z = -10.5; z <= -4.5; z += 1) b.stud(s.struct, sx * 1, 2.0, z);
    for (let z = -10.5; z <= -4.5; z += 1) b.stud(s.main, 0, 2.4, z);
    // antenna mast
    b.cyl(s.struct2, 0, 2.47, -9.5, 0.16, 0.14, { radial: 12 });
    rod(b, s.metal, [0, 2.5, -9.5], [0, 3.35, -9.8], 0.04, { radial: 8 });
  }
  // canopy hinge block
  b.box(s.struct2, 0, 2.43, HINGE[2], 1.0, 0.06, 0.5, { c: 0.02 });
  b.cyl(s.struct2, 0, HINGE[1], HINGE[2], 0.18, 1.3, { axis: 'x', radial: hi ? 16 : 8 });

  // engine block between the wing roots
  L(b, s.under, rect(-3, -12, 3, -9), -1.4, 0.6);
  L(b, s.struct2, rect(-3, -12, 3, -9), -0.8, 1.6);
  L(b, s.struct, rect(-3, -12, 3, -9), 0.8, 0.4);
  L(b, s.main, rect(-3, -12, 3, -9), 1.2, 0.4);
  if (hi) {
    for (const sx of [1, -1]) {
      for (const z of [-11.5, -10.5, -9.5]) b.stud(s.main, sx * 2, 1.6, z);
      // side vents above the wing roots
      louvre(b, s.grille, sx * 3.03, 1.2, -10.5, 2.4, 0.6, 3, 'z', 0.06);
    }
    // rear vent strip above the nozzles, exhaust vent slats under the block
    b.box(s.struct2, 0, 1.3, -12.03, 2.6, 0.5, 0.06, { c: 0.01 });
    louvre(b, s.grille, 0, 1.3, -12.07, 2.4, 0.42, 3, 'x', 0.06);
    for (let x = -1.2; x <= 1.21; x += 0.4) b.box(s.dark, x, -1.465, -10.5, 0.16, 0.03, 1.8, { c: 0.005 });
  }
  b.box(s.belly, 0, -1.43, -10.5, 3.2, 0.06, 2.2, { c: hi ? 0.02 : 0 });
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
  // grille band on the raked face (local x across, y up the face, z out of it)
  b.push();
  b.translate(0, 0, frontZ(0));
  b.rotateX(-RAKE);
  b.box(s.struct2, 0, 0, 0.012, 1.9, 0.64, 0.03, { c: hi ? 0.01 : 0 });
  for (const y of [-0.2, 0, 0.2]) b.box(s.grille, 0, y, 0.04, 1.7, 0.1, 0.05, { c: hi ? 0.01 : 0 });
  b.pop();
  if (!hi) return;
  // chin sensor and a keel lip
  b.cyl(s.metal, 0, -1.25, 5.1, 0.34, 0.1, { radial: 20 });
  b.cyl(s.dark, 0, -1.32, 5.1, 0.2, 0.05, { radial: 16 });
  for (const sx of [1, -1]) b.box(s.belly, sx * 0.9, -1.22, 4.6, 0.5, 0.04, 1.0, { c: 0.01 });
}

/** Nozzle hardware (port side; mirrored for starboard). The glow is a separate object. */
function engineHousing(b: Builder, s: Scheme, hi: boolean): void {
  const [x, y] = ENGINE;
  const n = hi ? 32 : 14;
  b.cyl(s.struct2, x, y, -12.3, 1.12, 0.6, { axis: 'z', radial: n, bottom: false });
  zTube(b, s.metal, x, y, -12.58, 1.16, 0.86, 0.1, n);
  if (hi) zTube(b, s.dark, x, y, -12.36, 1.15, 1.08, 0.08, n);
  // bell (inside surface) down to the throat
  b.lathe(s.dark, profile([[0.87, -12.6], [0.74, -12.4], [0.6, -12.16]]), { axis: 'z', at: [x, y, 0], radial: n });
  if (hi) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.box(s.struct2, x + Math.sin(a) * 0.72, y + Math.cos(a) * 0.72, -12.4, 0.06, 0.06, 0.4, { rot: [0, 0, -a], c: 0.01 });
  }
}

function engineGlow(b: Builder, hi: boolean): void {
  const n = hi ? 28 : 12;
  b.lathe('glowEngine', profile([[0.45, -0.01], [0.36, -0.08], [0.2, -0.14], [0, -0.16]]), { axis: 'z', radial: n });
  b.lathe('glowOrange', profile([[0.6, -0.005], [0.45, -0.005]]), { axis: 'z', radial: n });
}

// ——— wing roots (port; mirrored for starboard) ———

function stub(b: Builder, s: Scheme, hi: boolean, port: boolean): void {
  const A = rect(3, -12, 5.5, -9), B = rect(2.5, -9, 5.5, 3);
  L(b, s.under, A, -0.8, 0.4);
  L(b, s.under, B, -0.8, 0.4);
  // core, recessed on the outer face where radiator fins show between opened foils
  const xo = hi ? 5.3 : 5.5;
  L(b, s.struct2, rect(3, -12, xo, -9), -0.4, 0.8);
  L(b, s.struct2, rect(2.5, -9, xo, 3), -0.4, 0.8);
  if (hi) for (let z = -11.7; z < 2.8; z += 0.42) b.box(s.metal, 5.4, 0, z, 0.2, 0.72, 0.07, { c: 0.01 });
  // top: intake grille over the engine, studded plate, tiles, grille strip beside the foil root
  if (hi) grilleRun(b, s.grille, s.grille, 3, -12, 3, 2.5, 0.4, true, { bars: 7 });
  else L(b, s.grille, A, 0.4, 0.4);
  L(b, s.main, rect(2.5, -9, 5.5, -5), 0.4, 0.4);
  if (hi) for (const x of [3, 4, 5]) for (let z = -8.5; z <= -5.5; z += 1) b.stud(s.main, x, 0.8, z);
  L(b, s.main, rect(2.5, -5, 4.5, -2.5), 0.4, 0.4);
  L(b, s.alt, rect(2.5, -2.5, 4.5, 0), 0.4, 0.4);
  L(b, s.main, rect(4.5, -5, 5.5, -4), 0.4, 0.4);
  if (hi) {
    b.stud(s.main, 5, 0.8, -4.5);
    grilleRun(b, s.grille, s.grille, 4.5, -4, 4, 1, 0.4, true);
    roundTile(b, s.struct2, 3.5, 0.8, -3.75, 0.36, 0.08, 16);
    b.cyl(s.metal, 3.5, 0.9, -3.75, 0.16, 0.04, { radial: 12 });
  } else L(b, s.grille, rect(4.5, -4, 5.5, 0), 0.4, 0.4);
  if (!port) {
    // starboard: studded plate where the port side has the socket, with a hatch tile
    L(b, s.main, rect(2.5, 0, 5.5, 3), 0.4, 0.4);
    if (hi) {
      for (const x of [3, 5]) for (const z of [0.5, 1.5, 2.5]) b.stud(s.main, x, 0.8, z);
      L(b, s.struct, rect(3.55, 0.05, 4.45, 2.95), 0.8, 0.12);
      b.box(s.struct2, 4, 0.93, 1.5, 0.3, 0.02, 1.6, { c: 0.005 });
    }
  }
  if (hi) {
    // rear face: manoeuvring thruster and a vent
    b.cyl(s.struct2, 4.25, 0, -12.12, 0.34, 0.24, { axis: 'z', radial: 16 });
    b.cyl(s.dark, 4.25, 0, -12.25, 0.22, 0.03, { axis: 'z', radial: 14 });
    louvre(b, s.grille, 3.45, 0, -12.03, 0.7, 0.5, 3, 'x', 0.05);
    // underside: seams of the landing-gear door
    b.box(s.dark, 4.0, -0.865, -4.2, 0.06, 0.02, 3.0, { c: 0.005 });
    b.box(s.dark, 4.0, -0.865, -5.75, 2.0, 0.02, 0.06, { c: 0.005 });
  }
  b.box(s.belly, 4.0, -0.83, -4.2, 2.1, 0.06, 3.2, { c: hi ? 0.02 : 0 });
  // hinge knuckles on the fixed side
  if (hi) for (const y of [0.8, -0.8]) for (const z of KNUCKLE_FIXED) b.cyl(s.struct2, HX, y, z, 0.2, 0.8, { axis: 'z', radial: 14 });
}

function socket(b: Builder, s: Scheme, hi: boolean): void {
  const [x, , z] = SOCKET;
  const n = hi ? 44 : 20;
  b.add(s.struct, squareRing(3, 1.12, 0.4, n), new Matrix4().makeTranslation(x, 0.6, z));
  b.cyl(s.dark, x, 0.44, z, 1.13, 0.04, { radial: n, bottom: false });
  b.add(s.struct2, tube(1.36, 1.12, 0.2, 0.03, n), new Matrix4().makeTranslation(x, 0.9, z));
  if (!hi) return;
  // bolts round the rim, corner caps, service cable to the cockpit
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.cyl(s.metal, x + Math.sin(a) * 1.24, 1.03, z + Math.cos(a) * 1.24, 0.06, 0.06, { radial: 8 });
  }
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) roundTile(b, s.struct2, x + dx * 1.16, 0.8, z + dz * 1.16, 0.2, 0.08, 12);
  // inner collar lip where the droid body drops in
  b.add(s.dark, tube(1.12, 1.02, 0.06, 0.01, n), new Matrix4().makeTranslation(x, 0.98, z));
  rod(b, s.dark, [2.92, 0.86, 0.35], [2.56, 1.3, 0.0], 0.06, { radial: 8 });
}

// ——— forked nose (port prong; mirrored for starboard) ———

function tine(b: Builder, s: Scheme, hi: boolean): void {
  /** outer (swept) edge of the prong at z */
  const xo = (z: number) => (z <= 7 ? 5.5 : 5.5 - ((z - 7) * 2.2) / 5.4);
  L(b, s.under, TINE, -0.8, 0.4);
  // middle: notched on the outer edge for the ion cannon, recessed (with fins) at the root
  if (hi) {
    L(b, s.struct, clipBox(TINE, 2.5, 5.3, 3, 5.8), -0.4, 0.8);
    L(b, s.struct, clipBox(TINE, 2.5, 4.8, 5.8, 7.6), -0.4, 0.8);
    L(b, s.struct, clipHalf(TINE, 0, -1, -7.6), -0.4, 0.8);
    for (let z = 3.3; z < 5.6; z += 0.42) b.box(s.metal, 5.4, 0, z, 0.2, 0.72, 0.07, { c: 0.01 });
  } else L(b, s.struct, TINE, -0.4, 0.8);
  b.box(s.belly, 3.4, -0.83, 7.5, 0.8, 0.06, 5.0, { c: hi ? 0.02 : 0 });
  // top: studded root, grille, grey outer edge, smooth swept tip
  L(b, s.main, rect(2.5, 3, 5.5, 6), 0.4, 0.4);
  if (hi) for (const x of [3, 4, 5]) for (const z of [3.5, 4.5, 5.5]) b.stud(s.main, x, 0.8, z);
  L(b, s.main, clipBox(TINE, 2.5, 3.5, 6, 11.4), 0.4, 0.4);
  if (hi) grilleRun(b, s.grille, s.grille, 3.5, 6, 3, 1, 0.4, true);
  else L(b, s.grille, rect(3.5, 6, 4.5, 9), 0.4, 0.4);
  L(b, s.main, clipBox(TINE, 3.5, 4.5, 9, 11.4), 0.4, 0.4);
  L(b, s.struct, clipBox(TINE, 4.5, 5.5, 6, 11.4), 0.4, 0.4);
  if (hi) b.stud(s.struct, 5, 0.8, 6.5);
  L(b, s.main, clipHalf(TINE, 0, -1, -11.4), 0.4, 0.2);
  side(b, s.main, [[11.4, 0.6], [12.35, 0.6], [11.4, 0.8]], 2.5, xo(12.4) - 0.02);

  // main laser cannon along the inner edge
  const [mx, my, mz] = MUZZLE;
  const r = hi ? 20 : 8;
  b.cyl(s.gun, mx, my, 6.0, 0.42, 5.2, { axis: 'z', radial: r, top: false, bottom: false });
  b.lathe(s.gun, profile([[0, 8.9], [0.2, 8.9], [0.32, 8.85], [0.42, 8.6]]), { axis: 'z', at: [mx, my, 0], radial: r });
  b.lathe(s.gun, profile([[0.42, 3.4], [0.32, 3.15], [0.2, 3.1], [0, 3.1]]), { axis: 'z', at: [mx, my, 0], radial: r });
  if (hi) for (const zc of [4.2, 5.4, 6.6, 7.8]) b.cyl(s.metal, mx, my, zc, 0.45, 0.14, { axis: 'z', radial: r });
  b.cyl(s.metal, mx, my, (8.85 + mz - 0.55) / 2, 0.14, mz - 0.55 - 8.85, { axis: 'z', radial: hi ? 14 : 6 });
  if (hi) for (const zc of [9.6, 10.9, 12.2]) b.cyl('black', mx, my, zc, 0.2, 0.16, { axis: 'z', radial: 14 });
  zTube(b, 'black', mx, my, mz - 0.3, 0.21, 0.1, 0.6, hi ? 16 : 8);
  b.box(s.gun, mx + 0.25, my, 8.3, 0.3, 0.3, 0.5, { c: 0.03 });

  // ion cannon in the outer notch
  b.box(s.gun, 5.05, -0.05, 6.7, 0.5, 0.62, 1.8, { c: 0.04 });
  if (hi) {
    b.box(s.metal, 5.31, -0.05, 6.7, 0.04, 0.3, 1.2, { c: 0.01 });
    for (const zc of [6.2, 6.6, 7.0]) b.box(s.dark, 5.32, 0.14, zc, 0.03, 0.08, 0.2, { c: 0.005 });
  }
  b.cyl(s.metal, 5.05, -0.05, 8.6, 0.1, 2.0, { axis: 'z', radial: hi ? 12 : 6 });
  b.cyl('black', 5.05, -0.05, 9.75, 0.14, 0.3, { axis: 'z', radial: hi ? 12 : 6 });
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
    rod(b, 'black', [sx * 1.64, 1.1, 0.35], [sx * 1.64, 1.55, 0.5], 0.04, { radial: 8 });
    b.cyl(s.metal, sx * 1.64, 1.58, 0.51, 0.08, 0.1, { radial: 10 });
    // yoke: grip bar through the hand (X axis) on a stem to the dash
    rod(b, 'black', [sx * 0.8, 1.6, 1.8], [sx * 1.3, 1.6, 1.8], 0.09, { radial: 10 });
    rod(b, s.struct2, [sx * 1.22, 1.6, 1.8], [sx * 1.22, 1.05, 2.4], 0.07, { radial: 8 });
    b.cyl(s.metal, sx * 1.34, 1.6, 1.8, 0.1, 0.06, { axis: 'x', radial: 10 });
  }
  // dash with its sloped instrument face toward the pilot
  side(b, s.struct2, [[2.25, -0.4], [3.95, -0.4], [3.95, 1.72], [2.95, 1.72], [2.25, 1.1]], -1.3, 1.3);
  if (hi) {
    b.push();
    b.translate(0, (1.1 + 1.72) / 2, (2.25 + 2.95) / 2);
    b.rotateX(-Math.atan2(0.62, 0.7));
    b.box('black', 0, 0.005, 0, 2.3, 0.03, 0.78, { c: 0.01 });
    b.box('windowCool', 0, 0.03, 0.05, 0.7, 0.02, 0.36, { c: 0.005 });
    const keys: ColorKey[] = ['glowRed', 'glowGreen', 'glowBlue', 'glowYellow', 'glowRed', 'glowGreen'];
    keys.forEach((k, i) => {
      const x = i < 3 ? -0.95 + i * 0.2 : 0.55 + (i - 3) * 0.2;
      roundTile(b, k, x, 0.02, 0.18, 0.07, 0.04, 10);
    });
    for (const x of [-0.8, 0.8]) b.box(s.metal, x, 0.03, -0.2, 0.44, 0.02, 0.16, { c: 0.005 });
    b.pop();
    b.box(s.struct2, 0, 1.76, 3.45, 1.6, 0.08, 0.9, { c: 0.02 });
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
    // cheek details: vent grille on a backing plate, round access cap
    b.box(s.struct2, sx * 2.535, 2.16, -0.05, 0.03, 0.62, 1.3, { c: 0.01 });
    louvre(b, s.grille, sx * 2.56, 2.16, -0.05, 1.1, 0.5, 3, 'z', 0.05);
    b.cyl(s.struct2, sx * 2.55, 2.18, 1.45, 0.3, 0.08, { axis: 'x', radial: 16 });
    b.cyl(s.metal, sx * 2.6, 2.18, 1.45, 0.14, 0.04, { axis: 'x', radial: 12 });
  }
  // front latch under the viewport
  b.box(s.rim, 0, 1.7, frontZ(1.7) + 0.05, 0.5, 0.12, 0.12, { c: 0.03 });
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
  const bar = (a: V3, c: V3, w = 0.22, h = 0.2) => {
    const q = mid(a, c);
    beam(b, s.frame, a, c, w, h, [q[0] - C0[0], q[1] - C0[1], q[2] - C0[2]], { ext: w / 2 });
  };
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
  if (hi) {
    // hinge lugs, and a small sensor pip on the roof frame
    for (const sx of [1, -1]) b.box(s.frame, sx * 0.45, HINGE[1] + 0.12, HINGE[2] - 0.02, 0.2, 0.3, 0.36, { c: 0.03 });
    b.cyl(s.rim, 0, 5.02, 0.7, 0.14, 0.1, { radial: 12 });
  }
}

// ——— S-foil (modelled as the PORT UPPER foil, y 0..0.8, radiator face at y = 0) ———

function foil(b: Builder, s: Scheme, hi: boolean, upper: boolean): void {
  const frame = ringPieces(FOIL, PANEL); // [trailing band, tip strip, leading band, root strip]
  const [trailB, tipS, leadB, rootS] = frame;
  // inner (radiator) face: frame + recessed dark panel with main-colour fins
  for (const p of frame) L(b, s.struct2, p, 0, 0.4);
  L(b, s.dark, PANEL, 0.12, 0.28);
  // fins stay at lod1: without them the dark panel reads as a hole against space
  for (let x = 6.72; x < 9.45; x += 0.3) {
    const z0 = trail(x) + 0.1, z1 = lead(x) - 0.1;
    b.box(s.main, x, 0.075, (z0 + z1) / 2, 0.07, 0.09, z1 - z0, { c: hi ? 0.015 : 0 });
  }
  for (const z of [-4.8, -1.6]) b.box(s.struct2, 8, 0.08, z, 2.98, 0.08, 0.14, { c: hi ? 0.02 : 0 });

  // outer face, y 0.4..0.8: frame bands, then the field inside the panel outline —
  // trailing filler, a 3 × 4 grille block, a rib, and a plated front
  const face = upper ? s.main : s.under;
  for (const p of split(rootS, [-7, -3, 1])) L(b, upper ? s.struct : s.under, p, 0.4, 0.4);
  for (const p of split(trailB, [], [8])) L(b, upper ? s.struct2 : s.under, p, 0.4, 0.4);
  L(b, face, tipS, 0.4, 0.4);
  for (const p of split(leadB, [], [8])) L(b, s.main, p, 0.4, 0.4);
  const rear = clipHalf(PANEL, 0, 1, -7);
  const front = clipHalf(PANEL, 0, -1, 2);
  for (const p of split(rear, [], [7.5, 8.5])) L(b, upper ? s.struct2 : s.under, p, 0.4, 0.4);
  if (hi) for (let c = 0; c < 3; c++) grilleRun(b, s.grille, s.grille, 6.5 + c, -7, 4, 1, 0.4, true);
  else L(b, s.grille, rect(6.5, -7, 9.5, -3), 0.4, 0.4);
  L(b, upper ? s.struct : s.belly, rect(6.5, -3, 9.5, -2), 0.4, 0.4);
  for (const p of split(front, [], [7.5, 8.5])) L(b, face, p, 0.4, 0.4);
  if (upper && hi) {
    studsIn(b, s.struct, rootS, 0.8);
    studsIn(b, s.main, tipS, 0.8);
    for (const x of [7, 8, 9]) b.stud(s.struct, x, 0.8, -2.5);
    studsIn(b, s.main, front, 0.8);
  }
  // hinge knuckles on the foil side
  if (hi) for (const z of KNUCKLE_FOIL) b.cyl(s.struct2, HX, 0.8, z, 0.2, 0.8, { axis: 'z', radial: 14 });
}
