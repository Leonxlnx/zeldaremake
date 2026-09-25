import { Euler, Group, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import { Builder } from '../core/builder';
import { tube, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import type { VultureDroid } from './types';
import { anchor } from './placeholder';
import { DEG, boxAt, clamp01, clean, cylAt, emit, lathePts, lerp, lerpTable, newTally, pivot, rod, smooth, studsIn, type Tally } from './c-kit';

/**
 * Vulture droid (Variable Geometry Self-Propelled Battle Droid, Mk I) in ROTS Separatist colours.
 *
 * Flight: a wide flat hull with the domed sensor head at its front. At each end of the hull an
 * upper and a lower crescent wing-leg run fore-aft — clawed feet forward, pointed tips trailing —
 * splayed apart so the front view is an X; a laser cannon rides on the inside of each wing.
 * Walk (setMode(1)): every wing-leg pitches down around its hinge so the claws stand on the
 * ground and the tips rise above the hull; front and rear legs cross in an X seen from the side.
 * setGait(phase) runs a four-beat walk that keeps planted claws fixed on the ground plane
 * `userData.walkFootY` (the body advances `userData.walkStride` studs per 2π of phase).
 */

const L = 22; // wing-leg length
const HU = 0.38; // hinge position along the wing, from the trailing tip
const zU = (u: number) => (u - HU) * L;

/** Crescent planform in the canonical wing frame: u (0 = trailing tip, 1 = claw), inner x, outer x. */
const PLAN = [
  [0.0, 0.5, 0.62],
  [0.04, 0.28, 1.1],
  [0.1, 0.08, 1.75],
  [0.18, -0.06, 2.35],
  [0.28, -0.13, 2.8],
  [0.38, -0.15, 3.0],
  [0.5, -0.12, 2.95],
  [0.62, -0.02, 2.7],
  [0.72, 0.12, 2.35],
  [0.8, 0.25, 1.95],
  [0.87, 0.36, 1.58],
];

// rig constants (model frame)
const HX = 5.3; // hinge rail centre |x|
const HY = -0.3;
const HZ = -1.2;
const PX = HX + 0.55; // wing pivot |x|
const PY = 1.15; // flight: upper / lower wing pivot offset from the rail centre
const SPLAY = 20 * DEG; // flight X-splay of each wing
const TILT = 22 * DEG; // walk: fore / aft lean of the legs from vertical
const ZOFF = 2.8; // walk: legs slide fore / aft along the hinge rail
const CANT_F = 2 * DEG, CANT_R = 14 * DEG;
const GROUND = HY - 12.8; // walk: claw contact plane
const CLAW: V3 = [0.9, 0, 13.85]; // canonical wing frame: tip of the middle talon (walk-mode contact)
const SWEEP = 10 * DEG; // walk: stance sweep ± (pitch)
const NECK_Y = 1.35, NECK_Z = 0.9;

type Lod = 0 | 1;

// ---------------------------------------------------------------------------------------------
// wing-leg (canonical frame: hinge at the origin, +z toward the claw, +x outboard, +y the outer
// (marked) face; the rig mirrors it for the lower wings and the starboard side)

/** Outer-face colour blocking per planform segment: the transverse Separatist marking bands. */
const OUTER_KEYS: ColorKey[] = ['tan', 'tan', 'darkRed', 'tan', 'tan', 'tan', 'tan', 'darkRed', 'tan', 'reddishBrown'];
const INNER_KEYS: ColorKey[] = ['tan', 'tan', 'tan', 'tan', 'tan', 'darkTan', 'tan', 'darkRed', 'tan', 'darkTan'];

function wing(b: Builder, lod: Lod): V3 {
  const st = PLAN;
  // stepped cross-section: core plate, outer-face plate (inset), inner-face plate (inset more)
  const inset = (a: number, c: number, io: number, oo: number): [number, number] => {
    const w = c - a;
    return [a + Math.min(io, w * 0.2), c - Math.min(oo, w * 0.34)];
  };
  const RIDGE = [0.07, 0.12, 0.2, 0.28, 0.38, 0.5, 0.62, 0.72, 0.8, 0.86].map((u) => {
    const [a, c] = lerpTable(st, u);
    const w = c - a;
    return [u, a + 0.12, Math.min(a + 0.12 + Math.max(1.05, w * 0.4), c - 0.5)];
  });
  const ridgeOuter = (z: number) => lerpTable(RIDGE, z / L + HU)[1];
  for (let i = 0; i < st.length - 1; i++) {
    const [u0, a0, c0] = st[i], [u1, a1, c1] = st[i + 1];
    const z0 = zU(u0), z1 = zU(u1);
    b.shape('darkTan', clean([[a0, z0], [c0, z0], [c1, z1], [a1, z1]]), -0.2, 0.4, { hideBottom: false });
    const [ai0, ci0] = inset(a0, c0, 0.05, 0.26), [ai1, ci1] = inset(a1, c1, 0.05, 0.26);
    const outer = clean([[ai0, z0], [ci0, z0], [ci1, z1], [ai1, z1]]);
    const ok: ColorKey = lod === 1 && OUTER_KEYS[i] === 'reddishBrown' ? 'darkRed' : OUTER_KEYS[i];
    b.shape(ok, outer, 0.2, 0.4);
    const [bi0, di0] = inset(a0, c0, 0.05, 0.55), [bi1, di1] = inset(a1, c1, 0.05, 0.55);
    b.shape(lod === 1 ? 'darkTan' : INNER_KEYS[i], clean([[bi0, z0], [di0, z0], [di1, z1], [bi1, z1]]), -0.6, 0.4, { hideBottom: false });
    if (lod === 0 && u0 >= 0.18 && u1 <= 0.62 && ok === 'tan') studsIn(b, ok, outer, 0.6, { keep: (x, z) => x > ridgeOuter(z) + 0.36 });
  }
  // raised ridge along the inner half of the outer face — studded toward the tip, tiles toward the claw
  for (let i = 0; i < RIDGE.length - 1; i++) {
    const [u0, p0, q0] = RIDGE[i], [u1, p1, q1] = RIDGE[i + 1];
    const z0 = zU(u0), z1 = zU(u1);
    const poly = clean([[p0, z0], [q0, z0], [q1, z1], [p1, z1]]);
    const key: ColorKey = i === 6 || i === 7 ? 'reddishBrown' : i === 5 ? 'darkTan' : 'tan';
    b.shape(lod === 1 && key === 'reddishBrown' ? 'darkTan' : key, poly, 0.6, 0.4);
    if (lod === 0 && u0 >= 0.12 && u1 <= 0.5) studsIn(b, key, poly, 1.0);
    if (lod === 0 && i === 7) b.shape('darkRed', clean([[p0 + 0.2, z0 + 0.2], [q0 - 0.2, z0 + 0.2], [q1 - 0.2, z1 - 0.2], [p1 + 0.2, z1 - 0.2]]), 1.0, 0.12);
  }
  // inner face: dark grey spine beam with technic holes along the inner edge
  const SP = [0.08, 0.3, 0.58, 0.86];
  for (let i = 0; i < SP.length - 1; i++) {
    const [a0] = lerpTable(st, SP[i]), [a1] = lerpTable(st, SP[i + 1]);
    const z0 = zU(SP[i]) + 0.03, z1 = zU(SP[i + 1]) - 0.03;
    b.shape('dbg', [[a0 + 0.04, z0], [a0 + 0.95, z0], [a1 + 0.95, z1], [a1 + 0.04, z1]], -1.0, 0.4, { hideBottom: false });
    if (lod === 0) {
      for (let z = z0 + 0.6; z < z1 - 0.4; z += 1.0) {
        const t = (z - z0) / (z1 - z0);
        cylAt(b, 'black', [lerp(a0, a1, t) + 0.02, -0.8, z], [1, 0, 0], 0.13, 0.06, { radial: 8 });
      }
    }
  }
  // hinge knuckle (rides on the hull's rail)
  cylAt(b, 'dbg', [-0.2, -0.3, 0], [0, 0, 1], 0.6, 2.2, { radial: lod ? 8 : 14 });
  if (lod === 0) {
    cylAt(b, 'flatSilver', [-0.2, -0.3, 0], [0, 0, 1], 0.32, 2.5, { radial: 10 });
    for (const z of [-0.75, 0.75]) cylAt(b, 'black', [-0.2, -0.3, z], [0, 0, 1], 0.64, 0.12, { radial: 14 });
    b.box('dbg', 0.4, -0.75, -1.6, 0.9, 0.5, 1.1);
    // hydraulic rams along the inner face
    rod(b, 'dbg', [0.45, -1.15, -2.3], [0.45, -1.15, -4.2], 0.17, { radial: 8 });
    rod(b, 'flatSilver', [0.45, -1.15, -4.2], [0.45, -1.15, -6.0], 0.09, { radial: 6 });
    rod(b, 'dbg', [0.55, -1.15, 6.6], [0.62, -1.15, 8.6], 0.17, { radial: 8 });
    rod(b, 'flatSilver', [0.62, -1.15, 8.6], [0.7, -1.15, 10.4], 0.09, { radial: 6 });
  }
  // flight assault laser on the inner face (fires along +z)
  const lx = 0.5, ly = -1.35;
  b.box('dbg', lx, ly + 0.05, 0.9, 0.95, 0.6, 2.4);
  rod(b, 'dbg', [lx, ly, 2.1], [lx, ly, 5.3], 0.2, { radial: lod ? 6 : 10 });
  if (lod === 0) {
    b.box('black', lx, ly - 0.3, 0.9, 0.5, 0.12, 1.6);
    for (const z of [2.6, 3.4, 4.2]) cylAt(b, 'dbg', [lx, ly, z], [0, 0, 1], 0.26, 0.2, { radial: 10 });
    rod(b, 'flatSilver', [lx, ly, 5.3], [lx, ly, 6.1], 0.28, { radial: 10 });
    rod(b, 'black', [lx, ly, 6.1], [lx, ly, 6.3], 0.13, { radial: 8 });
  }
  // clawed foot: knuckle block and three talons (the middle one longest)
  const f0 = zU(0.87), f1 = zU(1.0);
  b.shape('dbg', [[0.34, f0], [1.6, f0], [1.4, f0 + 1.5], [0.5, f0 + 1.5]], -0.36, 0.72, { hideBottom: false });
  b.shape('black', [[0.72, f0 + 1.2], [1.28, f0 + 1.2], [1.12, f0 + 2.3], [0.9, f1 + 0.25]], -0.2, 0.4, { hideBottom: false });
  b.shape('black', [[1.2, f0 + 1.1], [1.62, f0 + 1.05], [1.75, f0 + 1.9], [1.6, f1 - 0.35]], -0.16, 0.32, { hideBottom: false });
  b.shape('black', [[0.3, f0 + 1.0], [0.72, f0 + 1.15], [0.45, f1 - 0.6], [0.2, f0 + 1.9]], -0.16, 0.32, { hideBottom: false });
  if (lod === 0) {
    b.shape('dbg', [[0.5, f0 - 0.9], [1.45, f0 - 0.9], [1.5, f0 + 0.2], [0.45, f0 + 0.2]], 0.3, 0.3);
    b.shape('dbg', [[0.55, f0 - 0.7], [1.4, f0 - 0.7], [1.45, f0 + 0.4], [0.5, f0 + 0.4]], -0.6, 0.3, { hideBottom: false });
    cylAt(b, 'flatSilver', [1.0, 0, f0 + 1.25], [0, 1, 0], 0.22, 0.86, { radial: 10 });
    cylAt(b, 'flatSilver', [1.42, 0, f0 + 1.12], [0, 1, 0], 0.16, 0.7, { radial: 8 });
    cylAt(b, 'flatSilver', [0.5, 0, f0 + 1.1], [0, 1, 0], 0.16, 0.7, { radial: 8 });
    rod(b, 'dbg', [0.95, 0.72, zU(0.72)], [0.95, 0.72, zU(0.8)], 0.16, { radial: 8 });
    rod(b, 'flatSilver', [0.95, 0.72, zU(0.8)], [0.95, 0.72, f0 + 0.9], 0.08, { radial: 6 });
    rod(b, 'dbg', [0.95, -0.8, zU(0.74)], [0.95, -0.8, zU(0.82)], 0.16, { radial: 8 });
    rod(b, 'flatSilver', [0.95, -0.8, zU(0.82)], [0.95, -0.8, f0 + 0.9], 0.08, { radial: 6 });
    b.box('trRed', 1.0, 0.62, f0 + 0.45, 0.3, 0.1, 0.3);
  }
  return [lx, ly, lod ? 5.3 : 6.35];
}

// ---------------------------------------------------------------------------------------------
// hull (model frame)

const FRONT = [[0, 4.3], [1.0, 4.15], [2.0, 3.72], [2.9, 3.05], [3.7, 2.25], [4.4, 1.35], [4.9, 0.45]];
const REAR = [[0, -2.7], [1.0, -2.65], [2.0, -2.5], [2.9, -2.3], [3.7, -2.1], [4.4, -1.9], [4.9, -1.7]];

function hull(b: Builder, lod: Lod): void {
  const xs = FRONT.map((p) => p[0]);
  const slice = (i: number, inset: number, zTrimF = 0, zTrimR = 0): number[][] => {
    const x0 = xs[i] + (i === 0 ? 0 : 0.0), x1 = xs[i + 1];
    return [
      [x0, REAR[i][1] + inset + zTrimR],
      [x1 - (i === xs.length - 2 ? inset : 0), REAR[i + 1][1] + inset + zTrimR],
      [x1 - (i === xs.length - 2 ? inset : 0), FRONT[i + 1][1] - inset - zTrimF],
      [x0, FRONT[i][1] - inset - zTrimF],
    ];
  };
  for (const s of [1, -1]) {
    b.push();
    if (s < 0) b.mirrorX();
    for (let i = 0; i < xs.length - 1; i++) {
      // layers: belly, dark core, top deck, raised centre deck
      if (i <= 2) b.shape('darkTan', slice(i, 0.3), -1.1, 0.4);
      b.shape('darkTan', slice(i, 0.12), -0.7, 0.4, { hideBottom: i > 2 });
      b.shape(lod ? 'darkTan' : 'dbg', slice(i, 0.35), -0.3, 0.4);
      const deck: ColorKey = i === 4 ? 'darkRed' : 'tan';
      b.shape(deck, slice(i, 0), 0.1, 0.4);
      if (i <= 2) {
        const top = slice(i, 0.3, 0.25, 0.15);
        b.shape('tan', top, 0.5, 0.4);
        if (lod === 0 && i >= 1) studsIn(b, 'tan', top, 0.9, { ox: 0.5, oz: 0.5 });
      }
      if (lod === 0 && i === 3) studsIn(b, 'tan', slice(i, 0.25), 0.5, { ox: 0.5, oz: 0.5, max: 4 });
    }
    // hinge rail: technic beams top and bottom joined by a web, pistons
    b.box('dbg', HX, HY + 1.05, HZ, 0.7, 0.42, 6.6);
    b.box('dbg', HX, HY - 1.05, HZ, 0.7, 0.42, 6.6);
    b.box('dbg', HX - 0.12, HY, HZ, 0.42, 1.7, 5.2);
    if (lod === 0) {
      for (let z = HZ - 2.8; z <= HZ + 2.9; z += 1) {
        cylAt(b, 'black', [HX + 0.36, HY + 1.05, z], [1, 0, 0], 0.12, 0.04, { radial: 8 });
        cylAt(b, 'black', [HX + 0.36, HY - 1.05, z], [1, 0, 0], 0.12, 0.04, { radial: 8 });
      }
      rod(b, 'flatSilver', [HX + 0.1, HY + 0.45, HZ - 2.9], [HX + 0.1, HY + 0.45, HZ + 2.9], 0.1, { radial: 6 });
      rod(b, 'flatSilver', [HX + 0.1, HY - 0.45, HZ - 2.9], [HX + 0.1, HY - 0.45, HZ + 2.9], 0.1, { radial: 6 });
      cylAt(b, 'dbg', [HX, HY, HZ + 3.4], [0, 0, 1], 0.42, 0.5, { radial: 10 });
      cylAt(b, 'dbg', [HX, HY, HZ - 3.4], [0, 0, 1], 0.42, 0.5, { radial: 10 });
      // energy torpedo launchers under the leading edge
      b.box('dbg', 1.6, -1.05, 2.4, 0.9, 0.55, 2.0);
      rod(b, 'dbg', [1.6, -1.05, 3.3], [1.6, -1.05, 4.0], 0.26, { radial: 10 });
      rod(b, 'black', [1.6, -1.05, 4.0], [1.6, -1.05, 4.08], 0.16, { radial: 8 });
      // leading-edge sensor lights
      b.box('trRed', 3.3, 0.3, 2.62, 0.4, 0.14, 0.12);
    }
    b.pop();
  }
  // head mount / neck well
  b.box('dbg', 0, 1.1, 1.3, 1.6, 0.5, 2.2);
  // engine block at the tail
  b.box('dbg', 0, -0.2, -3.55, 2.7, 1.3, 1.9);
  b.shape('tan', [[-1.5, -2.6], [1.5, -2.6], [1.25, -4.1], [-1.25, -4.1]], 0.45, 0.4);
  b.shape('darkTan', [[-1.45, -2.6], [1.45, -2.6], [1.2, -4.0], [-1.2, -4.0]], -1.25, 0.4, { hideBottom: false });
  b.add('dbg', tube(0.98, 0.74, 0.6, 0.03, lod ? 10 : 18), new Matrix4().makeTranslation(0, -0.2, -4.6).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
  b.cyl('glowOrange', 0, -0.2, -4.62, 0.76, 0.3, { axis: 'z', radial: lod ? 10 : 18 });
  if (lod === 0) {
    b.cyl('glowYellow', 0, -0.2, -4.78, 0.42, 0.06, { axis: 'z', radial: 12 });
    // solid fuel slug chamber
    b.cyl('flatSilver', 0, 1.25, -3.3, 0.42, 2.2, { axis: 'z', radial: 12 });
    for (const z of [-2.6, -3.3, -4.0]) b.cyl('darkRed', 0, 1.25, z, 0.46, 0.18, { axis: 'z', radial: 12 });
    // cooling fins either side of the engine
    for (const s of [1, -1]) for (let k = 0; k < 5; k++) b.box('dbg', s * 1.45, -0.72 + k * 0.26, -3.55, 0.36, 0.08, 1.6, { c: 0.02 });
  }
}

// ---------------------------------------------------------------------------------------------
// sensor head (frame: neck pivot at the origin, face toward +z)

// blunt bullet: nearly flat face (ya 3.7 … 4.0), rounded brow, long rounded crown tapering aft
const HEAD_PTS = [[0, 4.0], [0.55, 3.97], [0.95, 3.88], [1.22, 3.68], [1.4, 3.36], [1.5, 2.9], [1.53, 2.2], [1.5, 1.5], [1.38, 0.8], [1.15, 0.2], [0.8, -0.2], [0.4, -0.38], [0, -0.42]];
const HEAD_FRONT = 7; // HEAD_PTS[0..HEAD_FRONT) is the visor shell
const HEAD_R = 1.53;
const HEAD_AY = 0.45; // lathe axis height above the neck pivot
const HEAD_SY = 1.22; // vertical stretch
const HEAD_CUT = 0.36; // the shell stops this far (rad) below the lathe's horizontal

function headRadius(ya: number): number {
  // profile r(ya) (ya = position along the lathe axis)
  const P = HEAD_PTS;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], c = P[i + 1];
    if (ya <= a[1] && ya >= c[1]) return a[0] + ((ya - a[1]) / (c[1] - a[1] || 1)) * (c[0] - a[0]);
  }
  return 0;
}

/** Point on the head shell at lathe angle th (π = crown, π/2 = port side) and axial position ya. */
function headPoint(th: number, ya: number): V3 {
  const r = headRadius(ya);
  return [r * Math.sin(th), HEAD_SY * (HEAD_AY - r * Math.cos(th)), ya];
}

function head(b: Builder, lod: Lod): void {
  const th0 = Math.PI / 2 - HEAD_CUT, thL = Math.PI + 2 * HEAD_CUT;
  const radial = lod ? 10 : 24;
  b.push();
  b.scale(1, HEAD_SY, 1);
  // front visor shell (tan) and rear cap (darkTan) with a moulding seam between them
  lathePts(b, 'tan', HEAD_PTS.slice(0, HEAD_FRONT), { at: [0, HEAD_AY, 0], axis: 'z', radial, theta0: th0, thetaLen: thL, crease: 60 });
  lathePts(b, 'darkTan', HEAD_PTS.slice(HEAD_FRONT - 1).map((p, i) => (i === 0 ? [p[0] - 0.03, p[1] - 0.05] : p)), { at: [0, HEAD_AY, 0], axis: 'z', radial, theta0: th0, thetaLen: thL, crease: 60 });
  b.pop();
  // flat underside plate
  const bottomY = HEAD_SY * (HEAD_AY - HEAD_R * Math.sin(HEAD_CUT)) + 0.03;
  const half: number[][] = [];
  for (let k = 0; k <= 8; k++) {
    const ya = 4.1 - (k / 8) * 4.25;
    half.push([Math.max(0.25, headRadius(ya) * Math.cos(HEAD_CUT) - 0.05), ya]);
  }
  const fore = half.filter((p) => p[1] >= 1.5), aft = half.filter((p) => p[1] <= 1.7);
  for (const part of [fore, aft]) b.shape('darkTan', convex(part.concat(part.map((p) => [-p[0], p[1]]))), bottomY - 0.36, 0.36, { hideBottom: false });
  // helmet brim: a flat lip standing proud of the shell's lower edge along the sides and back
  const brim: number[][] = [];
  for (let k = 0; k <= 10; k++) {
    const ya = 3.3 - (k / 10) * 3.55;
    const x = headRadius(ya) * Math.cos(HEAD_CUT) + 0.22;
    brim.push([x, ya], [-x, ya]);
  }
  b.shape('darkTan', convex(brim), bottomY - 0.1, 0.2, { hideBottom: lod === 1 });
  // neck
  b.cyl('dbg', 0, bottomY - 0.55, 0.6, 0.5, 0.7, { radial: 12 });
  if (lod === 1) {
    for (const s of [1, -1]) visor(b, s * 0.42, 1, 6);
    return;
  }
  // twin sensor slits running over the brow and down the face
  for (const s of [1, -1]) visor(b, s * 0.42, 0, 14);
  // chin: magnetic imaging sensor grille under the face
  for (let k = 0; k < 4; k++) b.box('dbg', 0, bottomY - 0.12 - k * 0.08, 3.3 + k * 0.12, 1.3 - k * 0.14, 0.06, 0.5, { c: 0.015 });
  b.box('black', 0, bottomY - 0.2, 2.9, 1.4, 0.3, 0.9);
  // side sensor ports, rear sensor pods, antenna
  for (const s of [1, -1]) {
    const th = Math.PI / 2 + 0.3;
    const p = headPoint(th, 2.7);
    const n: V3 = [s * Math.sin(th), -Math.cos(th) / HEAD_SY, 0];
    p[0] *= s;
    cylAt(b, 'black', p, n, 0.28, 0.12, { radial: 12 });
    cylAt(b, 'trRed', [p[0] + n[0] * 0.05, p[1] + n[1] * 0.05, p[2]], n, 0.16, 0.1, { radial: 10 });
    const q = headPoint(th, 1.0);
    q[0] *= s;
    cylAt(b, 'dbg', q, n, 0.22, 0.14, { radial: 8 });
    cylAt(b, 'dbg', [q[0], q[1], q[2] + 0.55], n, 0.22, 0.14, { radial: 8 });
  }
  cylAt(b, 'dbg', [0, HEAD_SY * HEAD_AY + 0.15, -0.38], [0, 0, 1], 0.42, 0.16, { radial: 12 });
  cylAt(b, 'black', [0, HEAD_SY * HEAD_AY + 0.15, -0.48], [0, 0, 1], 0.22, 0.08, { radial: 10 });
  const crown = headPoint(Math.PI, 0.6);
  b.box('dbg', 0.6, crown[1] - 0.2, 0.55, 0.32, 0.3, 0.5);
  rod(b, 'flatSilver', [0.6, crown[1] - 0.05, 0.5], [0.8, crown[1] + 1.5, -0.7], 0.05, { radial: 5 });
}

function convex(pts: number[][]): number[][] {
  // monotone chain hull (x, z)
  const P = pts.map((p) => [p[0], p[1]]).sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  const cross = (o: number[], a: number[], c: number[]) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
  const lo: number[][] = [], hi: number[][] = [];
  for (const p of P) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop();
    hi.push(p);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** Axial position of the visor shell at radius r (inverse of the front part of the profile). */
function headFrontYa(r: number): number {
  const P = HEAD_PTS;
  for (let i = 0; i < HEAD_FRONT - 1; i++) {
    const a = P[i], c = P[i + 1];
    if (r >= a[0] && r <= c[0]) return a[1] + ((r - a[0]) / (c[0] - a[0] || 1)) * (c[1] - a[1]);
  }
  return P[HEAD_FRONT - 1][1];
}

/** One sensor slit: glowing red tile segments running from the brow straight down the face at x = xs. */
function visor(b: Builder, xs: number, lod: Lod, n: number): void {
  const r0 = 1.5, r1 = Math.abs(xs) + 0.1;
  const pts: V3[] = [];
  const nrm: V3[] = [];
  for (let k = 0; k <= n; k++) {
    const r = lerp(r0, r1, Math.pow(k / n, 0.8));
    const ya = headFrontYa(r);
    const sx = Math.min(0.98, Math.abs(xs) / r);
    const c = Math.sqrt(1 - sx * sx);
    const y = HEAD_SY * (HEAD_AY + r * c);
    // surface normal (profile slope → axial component), corrected for the vertical stretch
    const dr = (headRadius(ya + 0.05) - headRadius(ya - 0.05)) / 0.1;
    const n0 = new Vector3(Math.sign(xs) * sx, c / HEAD_SY, -dr / HEAD_SY).normalize();
    pts.push([xs, y, ya]);
    nrm.push([n0.x, n0.y, n0.z]);
  }
  for (let k = 0; k < n; k++) {
    const a = pts[k], c = pts[k + 1];
    const nm: V3 = [(nrm[k][0] + nrm[k + 1][0]) / 2, (nrm[k][1] + nrm[k + 1][1]) / 2, (nrm[k][2] + nrm[k + 1][2]) / 2];
    const mid: V3 = [(a[0] + c[0]) / 2 + nm[0] * 0.02, (a[1] + c[1]) / 2 + nm[1] * 0.02, (a[2] + c[2]) / 2 + nm[2] * 0.02];
    const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    boxAt(b, 'black', [mid[0] - nm[0] * 0.03, mid[1] - nm[1] * 0.03, mid[2] - nm[2] * 0.03], [c[0] - a[0], c[1] - a[1], c[2] - a[2]], nm, 0.42, 0.1, len + 0.04, { c: 0.02 });
    boxAt(b, lod ? 'glowRed' : 'glowRed', mid, [c[0] - a[0], c[1] - a[1], c[2] - a[2]], nm, 0.24, 0.1, len * 0.86, { c: 0.02 });
  }
}

// ---------------------------------------------------------------------------------------------
// rig

interface Leg {
  pv: Object3D;
  side: 1 | -1;
  lvl: 1 | -1;
  off: number;
}

const _m = new Matrix4();
const _v = new Vector3();
const _e = new Euler(0, 0, 0, 'ZYX');

function legPose(leg: Leg, mode: number, phase: number, out: { pitch: number; roll: number; x: number; y: number; z: number }): void {
  const { side, lvl } = leg;
  const m = smooth(clamp01(mode));
  // flight
  const fPitch = 0, fRoll = side * lvl * SPLAY;
  const fx = side * PX, fy = HY + lvl * PY, fz = HZ;
  // walk rest
  let wPitch = lvl > 0 ? Math.PI / 2 - TILT : Math.PI / 2 + TILT;
  let wRoll = side * (lvl > 0 ? CANT_F : CANT_R);
  const wz = HZ + lvl * ZOFF;
  // gait: 75 % stance sweeping the claw back, 25 % swing forward with a lift
  const s = (((phase + leg.off) / (Math.PI * 2)) % 1 + 1) % 1;
  let d: number, lift: number;
  if (s < 0.75) {
    d = 1 - (2 * s) / 0.75;
    lift = 0;
  } else {
    const t = (s - 0.75) / 0.25;
    d = -1 + 2 * smooth(t);
    lift = Math.sin(Math.PI * t);
  }
  wPitch -= d * SWEEP;
  wRoll += side * lift * 9 * DEG;
  // plant: pivot height that puts the claw on the ground plane (plus the swing lift)
  _m.makeRotationFromEuler(_e.set(wPitch, 0, wRoll, 'ZYX'));
  _v.set(side * CLAW[0], lvl * CLAW[1], CLAW[2]).applyMatrix4(_m);
  const wy = GROUND - _v.y + lift * 1.1;
  out.pitch = lerp(fPitch, wPitch, m);
  out.roll = lerp(fRoll, wRoll, m);
  out.x = fx;
  out.y = lerp(fy, wy, m);
  out.z = lerp(fz, wz, m);
}

const LOD1_CACHE = new Map<string, Group>();

export function vultureDroid(o: { lod?: Lod; seed?: number } = {}): VultureDroid {
  const lod: Lod = o.lod ?? 0;
  const seed = o.seed ?? 1;
  const group = new Group();
  group.name = 'vulture';
  const tally = newTally();
  const muzzles: Object3D[] = [];
  const engines: Object3D[] = [];
  group.userData.walkFootY = GROUND;
  group.userData.walkStride = 5.9;
  group.userData.span = 2 * (PX + 3.2);

  if (lod === 1) return lod1(group, seed, muzzles, engines);

  const bodyB = new Builder({ seed, studSegments: 10 });
  hull(bodyB, 0);
  emit(bodyB, 'vulture-hull', group, tally);
  const eng = anchor('engine', group, 0, -0.2, -4.8);
  eng.rotation.y = Math.PI;
  engines.push(eng);

  const neck = pivot('vulture:head', group, 0, NECK_Y, NECK_Z);
  const headB = new Builder({ seed: seed + 3, studSegments: 10 });
  head(headB, 0);
  emit(headB, 'vulture-head', neck, tally);

  const wingB = new Builder({ seed: seed + 7, studSegments: 10 });
  const muzzleLocal = wing(wingB, 0);
  const wingBuilt = wingB.build('vulture-wing');
  const legs: Leg[] = [];
  for (const side of [1, -1] as const) {
    for (const lvl of [1, -1] as const) {
      const pv = pivot(`vulture:wing${side > 0 ? 'P' : 'S'}${lvl > 0 ? 'U' : 'L'}`, group);
      const g = legs.length === 0 ? wingBuilt.group : wingBuilt.group.clone();
      g.scale.set(side, lvl, 1);
      pv.add(g);
      tally.tris += wingBuilt.triangles;
      tally.calls += wingBuilt.parts.length;
      const mz = anchor('muzzle', pv, side * muzzleLocal[0], lvl * muzzleLocal[1], muzzleLocal[2]);
      muzzles.push(mz);
      legs.push({ pv, side, lvl, off: OFFSETS[`${side},${lvl}`] });
    }
  }
  group.userData.triangles = tally.tris;
  group.userData.drawCalls = tally.calls;

  let mode = 0;
  let phase = 0;
  let wob = 0;
  const pose = { pitch: 0, roll: 0, x: 0, y: 0, z: 0 };
  const update = () => {
    const m = smooth(clamp01(mode));
    for (const leg of legs) {
      legPose(leg, mode, phase, pose);
      leg.pv.position.set(pose.x, pose.y, pose.z);
      // flight: each wing flexes a little on its own phase
      const flex = (1 - m) * Math.sin(wob * 1.7 + leg.off * 1.3) * 1.2 * DEG;
      leg.pv.rotation.set(pose.pitch, 0, pose.roll + leg.side * leg.lvl * flex, 'ZYX');
    }
    neck.rotation.set(m * (20 * DEG + Math.sin(phase * 2) * 2 * DEG), (1 - m) * Math.sin(wob * 0.9) * 4 * DEG, 0);
    neck.position.set(0, NECK_Y - m * 0.35, NECK_Z + m * 0.7);
  };
  update();

  return {
    group,
    length: L,
    muzzles,
    engines,
    setMode(w: number) {
      mode = w;
      update();
    },
    setGait(p: number) {
      phase = p;
      update();
    },
    animate(t: number) {
      wob = t;
      update();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// LOD 1: one merged mesh per colour. Flight is a single pose; the walk is a flipbook of gait
// frames that share one set of meshes (setGait swaps their geometry, so no extra draw calls).

const OFFSETS: Record<string, number> = { '1,-1': 0, '1,1': Math.PI / 2, '-1,-1': Math.PI, '-1,1': (3 * Math.PI) / 2 };
const WALK_FRAMES = 8;

function lod1(group: Group, seed: number, muzzles: Object3D[], engines: Object3D[]): VultureDroid {
  const key = `${seed & 3}`;
  const muzzleAt: V3[] = [];
  /** Cached merged model: the flight pose (frame < 0) or walk gait frame `frame`. */
  const build = (frame: number): Group => {
    const walk = frame >= 0;
    const ck = walk ? `w${frame}` : `${key}|f`;
    const hit = LOD1_CACHE.get(ck);
    const b = hit ? null : new Builder({ seed: walk ? 0 : seed & 3, studSegments: 6, chamfer: 0 });
    if (b) {
      hull(b, 1);
      b.push();
      b.translate(0, NECK_Y - (walk ? 0.35 : 0), NECK_Z + (walk ? 0.7 : 0));
      if (walk) b.rotateX(20 * DEG);
      head(b, 1);
      b.pop();
    }
    const pose = { pitch: 0, roll: 0, x: 0, y: 0, z: 0 };
    const phase = walk ? (frame / WALK_FRAMES) * Math.PI * 2 : Math.PI * 0.4;
    for (const side of [1, -1] as const) {
      for (const lvl of [1, -1] as const) {
        legPose({ pv: group, side, lvl, off: OFFSETS[`${side},${lvl}`] }, walk ? 1 : 0, phase, pose);
        const m = new Matrix4().makeTranslation(pose.x, pose.y, pose.z).multiply(new Matrix4().makeRotationFromEuler(_e.set(pose.pitch, 0, pose.roll, 'ZYX'))).multiply(new Matrix4().makeScale(side, lvl, 1));
        let mz: V3 = [0.5, -1.12, 5.3];
        if (b) {
          b.push();
          b.apply(m);
          mz = wing(b, 1);
          b.pop();
        }
        if (!walk) {
          const p = new Vector3(...mz).applyMatrix4(m);
          muzzleAt.push([p.x, p.y, p.z]);
        }
      }
    }
    if (b) LOD1_CACHE.set(ck, b.build(`vulture-lod1-${walk ? `walk${frame}` : 'flight'}`).group);
    return LOD1_CACHE.get(ck)!;
  };
  const flight = build(-1).clone();
  group.add(flight);
  let walkG: Group | null = null;
  let frame = 0;
  let tris = 0;
  flight.traverse((c) => {
    const g = (c as Mesh).geometry;
    if ((c as Mesh).isMesh) tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  group.userData.triangles = tris;
  group.userData.drawCalls = flight.children.length;
  for (const p of muzzleAt) muzzles.push(anchor('muzzle', group, p[0], p[1], p[2]));
  const eng = anchor('engine', group, 0, -0.2, -4.8);
  eng.rotation.y = Math.PI;
  engines.push(eng);
  return {
    group,
    length: L,
    muzzles,
    engines,
    setMode(w: number) {
      const walk = w > 0.5;
      if (walk && !walkG) {
        for (let i = 0; i < WALK_FRAMES; i++) build(i);
        walkG = build(frame).clone();
        group.add(walkG);
      }
      flight.visible = !walk;
      if (walkG) walkG.visible = walk;
    },
    setGait(p: number) {
      const f = Math.floor(((((p / (Math.PI * 2)) % 1) + 1) % 1) * WALK_FRAMES) % WALK_FRAMES;
      if (f === frame) return;
      frame = f;
      if (!walkG) return;
      const src = build(f).children;
      if (src.length !== walkG.children.length) return;
      walkG.children.forEach((c, i) => {
        (c as Mesh).geometry = (src[i] as Mesh).geometry;
      });
    },
  };
}
