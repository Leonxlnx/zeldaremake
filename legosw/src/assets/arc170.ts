import { BufferAttribute, Group, Matrix3, Matrix4, Mesh, Vector3, type Object3D } from 'three';
import { Builder } from '../core/builder';
import { MeshAcc, profile, tube, type MeshData, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import { anchor } from './placeholder';
import type { SmallCraft } from './types';
import { ccw, faceNormal, insetConvex, tileFace, type P2, type TStyle } from './b-kit';

/**
 * ARC-170 starfighter (Republic clone livery: white hull, red markings, dark bluish grey
 * mechanics) as a brick build ~51 studs long, ~57 studs across the cannons. Long flat duck-bill
 * nose, framed two-seat canopy plus the rear-facing tail gunner, big wing-root engines with tyre
 * intakes, stationary wings carrying the medium laser cannons at their tips, split upper/lower
 * S-foils behind them (built open; setFoils folds them shut), twin vertical tail fins.
 */

export interface Arc170 extends SmallCraft {
  /** 0 = S-foils folded shut (cruise), 1 = open in attack position (the default) */
  setFoils(open: number): void;
}

const ROT_Y_TO_Z = new Matrix4().makeRotationX(Math.PI / 2);
const T = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);

/** Builder that counts the vertices in each colour bucket, so a sub-assembly's span is known. */
class SpanBuilder extends Builder {
  private counts = new Map<ColorKey, number>();
  override add(key: ColorKey, md: MeshData, local?: Matrix4, o?: { tint?: number; shade?: number }): this {
    this.counts.set(key, (this.counts.get(key) ?? 0) + md.pos.length / 3);
    return super.add(key, md, local, o);
  }
  mark(): Map<ColorKey, number> {
    return new Map(this.counts);
  }
}

/**
 * Vertices [from, to) of each colour bucket belong to one S-foil, built open at `ang` about the
 * hinge line (HINGE_X, WING_Y) of the frame `outer`.
 */
interface FoilSpan {
  from: Map<ColorKey, number>;
  to: Map<ColorKey, number>;
  outer: Matrix4;
  ang: number;
}

/**
 * S-foil opening that rewrites the foil vertex spans in place (rotation about each hinge). No morph
 * targets on purpose: an InstancedMesh with morph attributes but no morphTexture crashes the
 * WebGL renderer (r186), and Swarm/flatten copies geometry as is — so the meshes stay plain, one
 * per colour, and a bake simply captures the current pose.
 */
function foilRig(root: Group, foils: FoilSpan[]): (open: number) => void {
  interface Span {
    mesh: Mesh;
    P: BufferAttribute;
    N: BufferAttribute;
    i0: number;
    p: Float32Array;
    n: Float32Array;
    foil: number;
  }
  const spans: Span[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const key = o.name.slice(o.name.lastIndexOf(':') + 1) as ColorKey;
    const P = o.geometry.getAttribute('position') as BufferAttribute;
    const N = o.geometry.getAttribute('normal') as BufferAttribute;
    foils.forEach((f, foil) => {
      const i0 = f.from.get(key) ?? 0, i1 = f.to.get(key) ?? 0;
      if (i1 <= i0) return;
      const p = (P.array as Float32Array).slice(i0 * 3, i1 * 3), n = (N.array as Float32Array).slice(i0 * 3, i1 * 3);
      spans.push({ mesh: o, P, N, i0, p, n, foil });
    });
  });
  const inv = foils.map((f) => f.outer.clone().invert());
  const M = foils.map(() => new Matrix4());
  const R = new Matrix4(), nm = new Matrix3(), v = new Vector3();
  const pivot = T(HINGE_X, WING_Y, 0), unpivot = T(-HINGE_X, -WING_Y, 0);
  const matrices = (open: number) =>
    foils.forEach((f, k) => M[k].copy(f.outer).multiply(pivot).multiply(R.makeRotationZ((open - 1) * f.ang)).multiply(unpivot).multiply(inv[k]));
  // bounds cover both extremes (the arcs in between bulge < 0.01 stud)
  matrices(0);
  for (const s of spans) {
    const g = s.mesh.geometry;
    for (let j = 0; j < s.p.length; j += 3) {
      v.fromArray(s.p, j).applyMatrix4(M[s.foil]);
      g.boundingBox?.expandByPoint(v);
      g.boundingSphere?.expandByPoint(v);
    }
  }
  let cur = 1;
  return (open: number) => {
    const a = Math.min(1, Math.max(0, open || 0));
    if (a === cur) return;
    cur = a;
    matrices(a);
    const touched = new Set<BufferAttribute>();
    for (const s of spans) {
      const m = M[s.foil];
      nm.getNormalMatrix(m);
      const P = s.P.array as Float32Array, N = s.N.array as Float32Array, o = s.i0 * 3;
      for (let j = 0; j < s.p.length; j += 3) {
        v.fromArray(s.p, j).applyMatrix4(m).toArray(P, o + j);
        v.fromArray(s.n, j).applyMatrix3(nm).normalize().toArray(N, o + j);
      }
      // upload only the foil spans; ranges are reset per call so hidden ships don't pile them up
      for (const A of [s.P, s.N]) {
        if (!touched.has(A)) {
          A.clearUpdateRanges();
          touched.add(A);
        }
        A.addUpdateRange(o, s.p.length);
        A.needsUpdate = true;
      }
    }
  };
}

interface Solid {
  faces: V3[][];
  center: V3;
}

/**
 * Convex solid from a CCW planform (x, z) whose top and bottom are planes y = f(z) (linear in z):
 * returns its planar faces (top, bottom, sides) for tiling.
 */
function planSolid(plan: P2[], yTop: (z: number) => number, yBot: (z: number) => number): Solid {
  const P = ccw(plan);
  const top: V3[] = P.map(([x, z]) => [x, yTop(z), z]);
  const bot: V3[] = P.slice().reverse().map(([x, z]) => [x, yBot(z), z]);
  const faces: V3[][] = [top, bot];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], c = P[(i + 1) % P.length];
    faces.push([
      [a[0], yBot(a[1]), a[1]],
      [c[0], yBot(c[1]), c[1]],
      [c[0], yTop(c[1]), c[1]],
      [a[0], yTop(a[1]), a[1]],
    ]);
  }
  let cx = 0, cz = 0;
  for (const p of P) {
    cx += p[0];
    cz += p[1];
  }
  cx /= P.length;
  cz /= P.length;
  return { faces, center: [cx, (yTop(cz) + yBot(cz)) / 2, cz] };
}

/** Dark flat-shaded core of a planSolid, inset by d everywhere. */
function planCoreMD(plan: P2[], yTop: (z: number) => number, yBot: (z: number) => number, d: number): MeshData {
  const acc = new MeshAcc();
  const P = insetConvex(ccw(plan), d) ?? ccw(plan);
  const top: V3[] = P.map(([x, z]) => [x, yTop(z) - d, z]);
  const bot: V3[] = P.map(([x, z]) => [x, yBot(z) + d, z]);
  for (let j = 1; j < P.length - 1; j++) {
    acc.tri(top[0], top[j], top[j + 1], faceNormal(top[0], top[j], top[j + 1]));
    acc.tri(bot[0], bot[j + 1], bot[j], faceNormal(bot[0], bot[j + 1], bot[j]));
  }
  for (let i = 0; i < P.length; i++) {
    const i1 = (i + 1) % P.length;
    acc.quad(bot[i], bot[i1], top[i1], top[i], faceNormal(bot[i], bot[i1], top[i1]));
  }
  return acc.done();
}

function faceCenter(f: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (const p of f) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  return [x / f.length, y / f.length, z / f.length];
}
const outOf = (f: V3[], c: V3): V3 => {
  const m = faceCenter(f);
  return [m[0] - c[0], m[1] - c[1], m[2] - c[2]];
};

function styles(fine: boolean) {
  const s = (key: ColorKey, sizes: P2[], extra: Partial<TStyle> = {}): TStyle => ({ key, sizes, flat: !fine, ...extra });
  const F: P2[] = fine ? [[4, 2], [3, 2], [2, 2], [6, 1], [4, 1], [3, 1], [2, 1], [1, 1]] : [[8, 4], [6, 4], [4, 4], [8, 2], [4, 2], [2, 2], [4, 1], [2, 1], [1, 1]];
  const LONG: P2[] = fine ? [[6, 1], [4, 1], [3, 1], [2, 1], [1, 1]] : [[8, 1], [4, 1], [2, 1], [1, 1]];
  return {
    white: s('white', F),
    whiteL: s('white', LONG),
    whiteP: s('white', F, { kind: fine ? 'plate' : 'tile' }),
    red: s('red', LONG),
    redF: s('red', F),
    lbg: s('lbg', F),
    lbgL: s('lbg', LONG),
    dbg: s('dbg', F),
    dbgL: s('dbg', LONG),
    raisedD: s('dbg', F, { kind: 'raised' }),
    raisedL: s('lbg', F, { kind: 'raised' }),
    grille: s('dbg', [[2, 1], [1, 1]], { kind: fine ? 'grille' : 'tile' }),
    grilleV: s('dbg', [[1, 2], [1, 1]], { kind: fine ? 'grille' : 'tile' }),
    black: s('black', LONG),
  };
}
type St = ReturnType<typeof styles>;

// ─── fuselage ───────────────────────────────────────────────────────────────────────────────────

const NOSE_Z = 28;
const BODY_FRONT = 11;
const TAIL_Z = -23;
const DECK_Y = 1.2;
const KEEL_Y = -2.0;
// nose planform half-widths (z → hw), flat duck bill
const NOSE_HW: [number, number][] = [
  [NOSE_Z, 0.9],
  [27.2, 1.6],
  [25, 2.3],
  [20, 3.0],
  [BODY_FRONT, 3.6],
];
/** top of the deck tiles (tiles are one plate thick on the body faces) */
const DECK_TOP = DECK_Y + 0.4;
const DROID_Z = -6.5;
const noseTop = (z: number) => DECK_Y + ((z - BODY_FRONT) * (-0.25 - DECK_Y)) / (NOSE_Z - BODY_FRONT);
const noseBot = (z: number) => KEEL_Y + ((z - BODY_FRONT) * (-0.75 - KEEL_Y)) / (NOSE_Z - BODY_FRONT);
/** the nose's rear face and the body's front face coincide inside the hull */
const atJoint = (f: V3[]) => f.every((p) => Math.abs(p[2] - BODY_FRONT) < 1e-6);

function fuselage(b: Builder, fine: boolean, L: St): void {
  // nose: one convex solid, tiled per face
  const plan: P2[] = [...NOSE_HW.map(([z, w]) => [w, z] as P2), ...NOSE_HW.slice().reverse().map(([z, w]) => [-w, z] as P2)];
  b.add('dbg', planCoreMD(plan, noseTop, noseBot, 0.4));
  const nose = planSolid(plan, noseTop, noseBot);
  nose.faces.forEach((f, i) => {
    if (atJoint(f)) return;
    const o = outOf(f, nose.center);
    const isTop = i === 0, isBot = i === 1;
    tileFace(b, f, {
      seed: 11 + i,
      outward: o,
      uDir: isTop || isBot ? [0, 0, -1] : undefined,
      origin: isTop || isBot ? [0, isTop ? noseTop(NOSE_Z) : noseBot(NOSE_Z), NOSE_Z] : undefined,
      studs: fine,
      style: (u, v) => {
        if (isTop) {
          // u: distance back from the tip, v: across
          if (u < 3.2) return L.redF;
          if (Math.abs(v) < 0.5 && u > 6) return L.whiteL;
          if (Math.abs(Math.abs(v) - 2.2) < 0.5 && u > 9) return L.red;
          return L.white;
        }
        if (isBot) return u < 3 ? L.redF : Math.abs(v) < 1 ? L.dbgL : L.lbg;
        return L.whiteL;
      },
    });
  });
  // main body box from the nose back to the tail
  const bodyPlan: P2[] = [
    [3.6, BODY_FRONT],
    [-3.6, BODY_FRONT],
    [-3.6, TAIL_Z + 1.5],
    [-2.6, TAIL_Z],
    [2.6, TAIL_Z],
    [3.6, TAIL_Z + 1.5],
  ];
  const yT = () => DECK_Y, yB = () => KEEL_Y;
  b.add('dbg', planCoreMD(bodyPlan, yT, yB, 0.4));
  const body = planSolid(bodyPlan, yT, yB);
  body.faces.forEach((f, i) => {
    const o = outOf(f, body.center);
    const isTop = i === 0, isBot = i === 1;
    if (atJoint(f)) return;
    const fn = faceNormal(f[0], f[1], f[2]);
    const isSide = !isTop && !isBot && Math.abs(fn[2]) < 0.05;
    const isBevel = !isTop && !isBot && !isSide && Math.abs(fn[0]) > 0.3;
    tileFace(b, f, {
      seed: 31 + i,
      outward: o,
      uDir: isTop || isBot || isSide ? [0, 0, -1] : undefined,
      origin: isTop || isBot ? [0, isTop ? DECK_Y : KEEL_Y, BODY_FRONT] : isSide ? [f[0][0], KEEL_Y, BODY_FRONT] : undefined,
      studs: fine,
      style: (u, v) => {
        const av = Math.abs(v);
        if (isTop) {
          if (av > 2.6) return u > 15 ? L.grille : L.red;
          if (u > 21 && u < 29 && av < 1.5) return Math.floor(u) % 3 === 0 ? L.dbgL : L.lbg;
          if (u > 28 && av < 2.4) return L.whiteP;
          return L.white;
        }
        if (isBot) {
          if (av < 0.8) return L.dbgL;
          if (av > 2.8) return L.whiteL;
          return u > 12 && u < 22 ? L.dbg : L.lbg;
        }
        if (isBevel) return v < 0.8 ? L.lbgL : L.whiteL;
        if (!isSide) return L.dbg; // tail face
        if (u < 9 && v > 1 && v < 2.2) return L.red;
        return v < 0.8 ? L.lbgL : L.whiteL;
      },
    });
  });
  // underside chin: sensor pod and intakes
  if (fine) {
    b.box('dbg', 0, KEEL_Y - 0.3, 4, 3, 0.6, 6);
    for (const x of [-1, 0, 1]) b.cyl('lbg', x, KEEL_Y - 0.62, 6.5, 0.32, 0.1, { radial: 10 });
  }
  astromech(b, fine);
}

/** R4-P astromech in its socket behind the canopy: truncated-cone dome, red band, black eye. */
function astromech(b: Builder, fine: boolean): void {
  const y = DECK_TOP, z = DROID_Z;
  b.box('dbg', 0, y + 0.1, z, 2.6, 0.2, 2.6, { c: 0.04 });
  if (fine) for (const [x, zz] of [[1.05, 1.05], [-1.05, 1.05], [1.05, -1.05], [-1.05, -1.05]]) b.cyl('lbg', x, y + 0.24, z + zz, 0.18, 0.1, { radial: 8 });
  const rad = fine ? 20 : 10;
  b.lathe('white', profile([[0.92, 0.75], [0.92, 0.2], [0.92, 0]]), { at: [0, y + 0.2, z], radial: rad });
  b.lathe('red', profile([[0.95, 0.55], [0.95, 0.35]]), { at: [0, y + 0.2, z], radial: rad });
  b.lathe('flatSilver', profile([[0, 1.55], [0.5, 1.55], [0.6, 1.45], [0.92, 0.78], [0.92, 0.75]]), { at: [0, y + 0.2, z], radial: rad });
  b.box('black', 0, y + 1.25, z + 0.66, 0.34, 0.3, 0.2, { c: 0.03, rot: [-0.45, 0, 0] });
  if (fine) {
    b.box('lbg', 0.42, y + 1.05, z + 0.72, 0.18, 0.18, 0.12, { rot: [-0.45, 0, 0] });
    b.cyl('dbg', -0.3, y + 1.78, z - 0.1, 0.12, 0.1, { radial: 8 });
  }
}

// ─── canopy ─────────────────────────────────────────────────────────────────────────────────────

function canopy(b: Builder, fine: boolean): void {
  // long faceted canopy: pointed windscreen, flat roof, raked rear
  const zF = 16.5, zW = 11, zR = 1, zB = -2.5;
  const hw0 = 2.5, hw1 = 1.5, hTop = 2.7;
  const y0 = DECK_TOP, y1 = DECK_TOP + hTop;
  const P = (x: number, y: number, z: number): V3 => [x, y, z];
  // vertices
  const nose = P(0, noseTop(zF) + 0.35, zF);
  const wL0 = P(hw0, y0, zW), wR0 = P(-hw0, y0, zW);
  const wL1 = P(hw1, y1, zW - 1.5), wR1 = P(-hw1, y1, zW - 1.5);
  const rL1 = P(hw1, y1, zR), rR1 = P(-hw1, y1, zR);
  const bL0 = P(hw0, y0, zB), bR0 = P(-hw0, y0, zB);
  const bL1 = P(hw1 * 0.8, y0 + hTop * 0.55, zB), bR1 = P(-hw1 * 0.8, y0 + hTop * 0.55, zB);
  const panes: [V3[], ColorKey][] = [
    [[nose, wL0, wL1], 'trBlack'],
    [[nose, wL1, wR1], 'trBlack'],
    [[nose, wR1, wR0], 'trBlack'],
    [[wL0, bL0, bL1, rL1, wL1], 'trBlack'],
    [[wR0, wR1, rR1, bR1, bR0], 'trBlack'],
    [[wL1, rL1, rR1, wR1], 'trBlack'],
    [[rL1, bL1, bR1, rR1], 'trBlack'],
  ];
  for (const [pts, key] of panes) b.add(key, paneMD(pts, 0.12));
  // frame bars along every pane edge
  const bars: [V3, V3][] = [
    [nose, wL1],
    [nose, wR1],
    [wL1, wR1],
    [wL1, rL1],
    [wR1, rR1],
    [rL1, rR1],
    [rL1, bL1],
    [rR1, bR1],
    [bL1, bR1],
    [wL0, wL1],
    [wR0, wR1],
    [nose, wL0],
    [nose, wR0],
    [wL0, bL0],
    [wR0, bR0],
  ];
  // crew-station dividers across the roof and down the sides
  for (const z of [7, 3.5]) {
    bars.push([P(hw1, y1, z), P(-hw1, y1, z)], [P(hw1, y1, z), P(hw0, y0, z)], [P(-hw1, y1, z), P(-hw0, y0, z)]);
  }
  const barR = fine ? 0.13 : 0.16;
  for (const [a, c] of bars) bar(b, 'dbg', a, c, barR, fine ? 6 : 4);
  // sill
  b.box('dbg', 0, y0 + 0.1, (zW + zB) / 2, hw0 * 2 + 0.3, 0.2, zW - zB + 0.3);
  if (fine) {
    // pilot and co-pilot: seat backs and white clone helmets with T-visors
    for (const z of [8.3, 4.6]) {
      b.box('dbg', 0, y0 + 0.9, z - 1.0, 1.8, 1.8, 0.35);
      b.lathe('white', profile([[0, 1.05], [0.55, 0.95], [0.72, 0.5], [0.74, 0], [0.6, -0.25]]), { at: [0, y0 + 1.25, z], radial: 14 });
      b.box('black', 0, y0 + 1.55, z + 0.62, 0.9, 0.18, 0.12, { c: 0.02 });
      b.box('black', 0, y0 + 1.35, z + 0.62, 0.2, 0.45, 0.12, { c: 0.02 });
      b.box('dbg', 0, y0 + 0.5, z + 1.1, 1.4, 0.5, 0.6);
    }
  }
}

/** thin planar pane (convex, any orientation) of thickness t along its normal */
function paneMD(pts: V3[], t: number): MeshData {
  const acc = new MeshAcc();
  const n = faceNormal(pts[0], pts[1], pts[2]);
  const c = faceCenter(pts);
  // outward = away from the canopy's inside (below / toward the centreline)
  const s = n[1] * 1 + (n[0] * c[0]) * 0.2 >= 0 ? 1 : -1;
  const N: V3 = [n[0] * s, n[1] * s, n[2] * s];
  const top = pts.map((p): V3 => [p[0] + N[0] * t * 0.5, p[1] + N[1] * t * 0.5, p[2] + N[2] * t * 0.5]);
  const bot = pts.map((p): V3 => [p[0] - N[0] * t * 0.5, p[1] - N[1] * t * 0.5, p[2] - N[2] * t * 0.5]);
  for (let j = 1; j < pts.length - 1; j++) {
    acc.tri(top[0], top[j], top[j + 1], N);
    acc.tri(bot[0], bot[j + 1], bot[j], [-N[0], -N[1], -N[2]]);
  }
  return acc.done();
}

/** straight round bar between two points */
function bar(b: Builder, key: ColorKey, a: V3, c: V3, r: number, radial: number): void {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-3) return;
  const m = new Matrix4();
  const yAxis = [dx / len, dy / len, dz / len];
  // basis with Y along the bar
  const ref = Math.abs(yAxis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let xAxis = [yAxis[1] * ref[2] - yAxis[2] * ref[1], yAxis[2] * ref[0] - yAxis[0] * ref[2], yAxis[0] * ref[1] - yAxis[1] * ref[0]];
  const xl = Math.hypot(xAxis[0], xAxis[1], xAxis[2]);
  xAxis = xAxis.map((v) => v / xl);
  const zAxis = [xAxis[1] * yAxis[2] - xAxis[2] * yAxis[1], xAxis[2] * yAxis[0] - xAxis[0] * yAxis[2], xAxis[0] * yAxis[1] - xAxis[1] * yAxis[0]];
  m.set(xAxis[0], yAxis[0], zAxis[0], (a[0] + c[0]) / 2, xAxis[1], yAxis[1], zAxis[1], (a[1] + c[1]) / 2, xAxis[2], yAxis[2], zAxis[2], (a[2] + c[2]) / 2, 0, 0, 0, 1);
  b.push();
  b.apply(m);
  b.cyl(key, 0, 0, 0, r, len, { radial, c: 0.02 });
  b.pop();
}

// ─── engines, wings, cannons, fins (port side; starboard mirrored) ─────────────────────────────

const ENG_X = 6.3;
const ENG_Y = -0.45;
const ENG_R = 2.5;
const ENG_Z0 = 3.2;
const ENG_Z1 = -18.5;
const WING_Y = -0.45;
const ROOT_X = 8.4;
/** S-foil hinge line (along z, at WING_Y) */
const HINGE_X = ROOT_X - 0.6;
const TIP_X = 27.0;
const CANNON_X = 28.0;

function engine(b: Builder, fine: boolean): void {
  const rad = fine ? 28 : 12;
  const at: V3 = [ENG_X, ENG_Y, 0];
  // nacelle skin (white) from the rounded intake lip back to the exhaust, red band behind the lip
  const lip: number[][] = [[ENG_R - 0.6, ENG_Z0 - 0.7]];
  for (let k = 0; k <= 4; k++) {
    const a = Math.PI - (k * Math.PI) / 4;
    lip.push([ENG_R - 0.3 + Math.cos(a) * 0.3, ENG_Z0 - 0.05 + Math.sin(a) * 0.3]);
  }
  b.lathe('white', profile([...lip, [ENG_R, ENG_Z0 - 0.5], [ENG_R, ENG_Z1 + 2.2], [ENG_R - 0.35, ENG_Z1 + 0.6]], 50), { at, axis: 'z', radial: rad });
  const ring = (key: ColorKey, z: number, rOut: number, rIn: number, h: number) => b.add(key, tube(rOut, rIn, h, 0.04, rad), T(ENG_X, ENG_Y, z).multiply(ROT_Y_TO_Z));
  ring('red', ENG_Z0 - 2.4, ENG_R + 0.12, ENG_R - 0.2, 1.4);
  if (fine) {
    for (const z of [-4.5, -9.5, -14.5]) ring('dbg', z, ENG_R + 0.1, ENG_R - 0.2, 0.5);
    // side grille panels
    for (const z of [-6.5, -11.5]) b.box('dbg', ENG_X + ENG_R - 0.05, ENG_Y, z, 0.3, 1.6, 3.2);
  }
  // intake: grey stator ring inside the lip, dark fan face, light grey blades, silver spinner
  ring('dbg', ENG_Z0 - 0.5, ENG_R - 0.58, ENG_R - 0.95, 0.5);
  b.cyl('black', ENG_X, ENG_Y, ENG_Z0 - 0.95, ENG_R - 0.58, 0.2, { axis: 'z', radial: rad });
  if (fine) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      b.box('lbg', ENG_X + Math.cos(a) * 1.02, ENG_Y + Math.sin(a) * 1.02, ENG_Z0 - 0.78, 0.26, 0.95, 0.14, { rot: [0, 0, a + Math.PI / 2 + 0.45] });
    }
  }
  b.lathe('flatSilver', profile([[0, 0.8], [0.45, 0.35], [0.55, 0]]), { at: [ENG_X, ENG_Y, ENG_Z0 - 0.85], axis: 'z', radial: fine ? 14 : 8 });
  // exhaust: gunmetal bell, orange glow with a hot core
  b.lathe('gunmetal', profile([[ENG_R - 0.4, ENG_Z1 + 0.8], [ENG_R - 0.25, ENG_Z1 - 0.4], [ENG_R - 0.4, ENG_Z1 - 1.2], [ENG_R - 0.7, ENG_Z1 - 1.2], [ENG_R - 0.8, ENG_Z1 + 0.2]], 30), { at, axis: 'z', radial: rad });
  b.cyl('glowOrange', ENG_X, ENG_Y, ENG_Z1 - 0.3, ENG_R - 0.75, 0.2, { axis: 'z', radial: rad });
  b.cyl('glowEngine', ENG_X, ENG_Y, ENG_Z1 - 0.4, (ENG_R - 0.75) * 0.5, 0.2, { axis: 'z', radial: rad });
  // hot liner round the inside of the bell, so the exhaust reads deep rather than as a flat disc
  b.add('glowOrange', tube(ENG_R - 0.8, ENG_R - 0.98, 0.7, 0.02, rad), T(ENG_X, ENG_Y, ENG_Z1 - 0.8).multiply(ROT_Y_TO_Z));
  if (fine) {
    // nozzle petals round the bell
    for (let k = 0; k < 10; k++) {
      const a = ((k + 0.5) / 10) * Math.PI * 2;
      b.box('dbg', ENG_X + Math.cos(a) * (ENG_R - 0.19), ENG_Y + Math.sin(a) * (ENG_R - 0.19), ENG_Z1 - 0.45, 0.55, 0.16, 1.6, { rot: [0, 0, a + Math.PI / 2], c: 0.02 });
    }
  }
  // fairing between the nacelle and the flat body side
  b.box('white', 3.6 + 1.0, ENG_Y + 1.0, (ENG_Z0 - 1 + ENG_Z1 + 1.5) / 2, 2.0, 2.4, ENG_Z0 - ENG_Z1 - 2.5, { hide: { nx: true } });
  b.box('lbg', 3.6 + 1.0, ENG_Y - 1.1, (ENG_Z0 - 1 + ENG_Z1 + 1.5) / 2, 2.0, 1.4, ENG_Z0 - ENG_Z1 - 2.5, { hide: { nx: true } });
}

function wing(b: SpanBuilder, fine: boolean, L: St, foils: FoilSpan[]): void {
  // stationary wing: leading edge swept slightly back toward the tip
  const plan: P2[] = [
    [ROOT_X, 0.5],
    [TIP_X, -2.0],
    [TIP_X, -8.0],
    [ROOT_X, -8.0],
  ];
  const yT = () => WING_Y + 0.45, yB = () => WING_Y - 0.45;
  b.add('dbg', planCoreMD(plan, yT, yB, 0.3));
  const w = planSolid(plan, yT, yB);
  w.faces.forEach((f, i) => {
    const o = outOf(f, w.center);
    const isTop = i === 0, isBot = i === 1;
    tileFace(b, f, {
      seed: 51 + i,
      outward: o,
      uDir: isTop || isBot ? [1, 0, 0] : undefined,
      origin: isTop || isBot ? [ROOT_X, isTop ? yT() : yB(), -8] : undefined,
      studs: fine,
      style: (u, v) => {
        if (isTop || isBot) {
          // u: outward from the root, v: forward from the hinge line
          const lead = v > (8.5 - (u * 2.5) / (TIP_X - ROOT_X)) - 1.2;
          if (lead) return L.lbgL;
          if (isTop && u > 12.5 && u < 16.5 && v > 0.9) return u > 14 && u < 15 ? L.white : L.red;
          if (isTop && v < 1) return L.dbgL;
          return isTop ? (u > 3 && u < 6 ? L.whiteP : L.white) : L.lbg;
        }
        return L.dbgL;
      },
    });
  });
  // S-foils behind the stationary wing: upper and lower panels hinged at the root, built open
  for (const [k, ang] of [
    [1, 0.245],
    [-1, -0.245],
  ] as const) {
    const outer = b.m.clone();
    const from = b.mark();
    b.push();
    b.translate(HINGE_X, WING_Y, 0);
    b.rotateZ(ang);
    b.translate(-HINGE_X, -WING_Y, 0);
    const fp: P2[] = [
      [ROOT_X - 0.6, -8.0],
      [TIP_X - 2.0, -8.0],
      [TIP_X - 2.0, -13.2],
      [ROOT_X - 0.6, -15.4],
    ];
    const y0 = k > 0 ? WING_Y + 0.02 : WING_Y - 0.62;
    const fT = () => y0 + 0.6, fB = () => y0;
    b.add('dbg', planCoreMD(fp, fT, fB, 0.2));
    const s = planSolid(fp, fT, fB);
    s.faces.forEach((f, i) => {
      const o = outOf(f, s.center);
      const isTop = i === 0, isBot = i === 1;
      tileFace(b, f, {
        seed: 61 + i + (k > 0 ? 0 : 10),
        outward: o,
        uDir: isTop || isBot ? [1, 0, 0] : undefined,
        origin: isTop || isBot ? [ROOT_X - 0.6, isTop ? fT() : fB(), -8] : undefined,
        studs: false,
        style: (u, v) => {
          if (isTop || isBot) {
            const outer = (k > 0 && isTop) || (k < 0 && isBot);
            if (v < -4.2 + (u * 2.2) / (TIP_X - ROOT_X - 1.4) - 1) return L.dbgL; // trailing-edge flap
            if (outer && u > 12 && u < 16 && v > -4) return u > 13.5 && u < 14.5 ? L.white : L.red;
            if (u > TIP_X - ROOT_X - 3.2) return L.lbgL;
            return outer ? L.white : L.lbg;
          }
          return L.dbgL;
        },
      });
    });
    if (fine) {
      // hinge knuckles at the root
      for (const z of [-9.5, -13.5]) b.cyl('dbg', ROOT_X - 0.6, WING_Y + (k > 0 ? 0.3 : -0.3), z, 0.35, 1.2, { axis: 'z', radial: 10 });
    }
    b.pop();
    foils.push({ from, to: b.mark(), outer, ang });
  }
}

function cannon(b: Builder, fine: boolean): void {
  const x = CANNON_X, y = WING_Y - 0.1;
  const rad = fine ? 20 : 10, rs = fine ? 16 : 8;
  // housing along the wing tip, white collar, stepped sleeve
  b.lathe('dbg', profile([[0.5, 3.6], [1.1, 2.6], [1.2, 0], [1.2, -8.5], [0.75, -9.6]], 32), { at: [x, y, 0], axis: 'z', radial: rad });
  b.cyl('white', x, y, 4.3, 1.0, 1.4, { axis: 'z', radial: rad });
  b.cyl('lbg', x, y, 5.8, 0.78, 1.6, { axis: 'z', radial: rad });
  // long barrel: cooling rings near the sleeve, slotted flash suppressor, silver crown
  b.cyl('lbg', x, y, 12.4, 0.48, 12.0, { axis: 'z', radial: rs });
  if (fine) for (const z of [7.3, 8.0, 8.7, 9.4]) b.cyl('dbg', x, y, z, 0.62, 0.32, { axis: 'z', radial: rs });
  b.cyl('dbg', x, y, 19.4, 0.72, 2.6, { axis: 'z', radial: rs });
  if (fine) for (const z of [18.7, 19.4, 20.1]) b.add('black', tube(0.745, 0.55, 0.22, 0.02, rs), T(x, y, z).multiply(ROT_Y_TO_Z));
  b.cyl('flatSilver', x, y, 21.0, 0.6, 0.6, { axis: 'z', radial: rs });
  b.add('black', tube(0.46, 0.22, 0.2, 0.02, rs), T(x, y, 21.32).multiply(ROT_Y_TO_Z));
  // rangefinder pod on top
  b.cyl('lbg', x, y + 1.25, 1.5, 0.38, 7.0, { axis: 'z', radial: fine ? 12 : 6 });
  b.cyl('red', x, y + 1.25, 5.3, 0.4, 0.6, { axis: 'z', radial: fine ? 12 : 6 });
  b.box('dbg', x, y + 0.75, 1.0, 0.5, 0.6, 3.0);
  // tip fairing joining the wing
  b.box('white', x - 0.55, WING_Y, -5.0, 1.2, 0.9, 6.0);
}

function tailFin(b: Builder, fine: boolean): void {
  const yb = ENG_Y + ENG_R - 0.25;
  // swept fin profile in (z, y), extruded across x
  const prof: number[][] = [
    [-8.5, yb],
    [-17.8, yb],
    [-20.4, yb + 6.4],
    [-17.2, yb + 6.4],
  ];
  const redTop: number[][] = [
    [-15.9, yb + 5.2],
    [-19.9, yb + 5.2],
    [-20.4, yb + 6.4],
    [-17.2, yb + 6.4],
  ];
  b.push();
  b.translate(ENG_X, 0, 0);
  b.rotateY(Math.PI / 2);
  b.prism('white', prof.map(([z, y]) => [-z, y]), 0.5);
  b.prism('red', redTop.map(([z, y]) => [-z, y + 0.01]), 0.56);
  b.pop();
  b.box('dbg', ENG_X, yb + 0.15, -13.2, 1.1, 0.5, 9.0);
  if (fine) {
    b.cyl('lbg', ENG_X, yb + 6.4 + 0.6, -18.8, 0.1, 1.2, { radial: 6 });
  }
}

function tailGunner(b: Builder, fine: boolean): void {
  const z0 = TAIL_Z, y = DECK_TOP;
  // rear-facing glazed turret on the tail and the twin aft cannons
  b.add('trBlack', paneMD([[1.6, y, z0 + 4.6], [-1.6, y, z0 + 4.6], [-1.2, y + 1.6, z0 + 2.2], [1.2, y + 1.6, z0 + 2.2]], 0.12));
  b.add('trBlack', paneMD([[1.2, y + 1.6, z0 + 2.2], [-1.2, y + 1.6, z0 + 2.2], [-1.6, y, z0 + 0.2], [1.6, y, z0 + 0.2]], 0.12));
  b.box('dbg', 0, y + 0.1, z0 + 2.4, 3.4, 0.2, 4.6);
  bar(b, 'dbg', [1.2, y + 1.6, z0 + 2.2], [-1.2, y + 1.6, z0 + 2.2], 0.12, 6);
  for (const x of [1.4, -1.4]) {
    bar(b, 'dbg', [x * 0.857, y + 1.6, z0 + 2.2], [x * 1.143, y, z0 + 4.6], 0.1, 6);
    bar(b, 'dbg', [x * 0.857, y + 1.6, z0 + 2.2], [x * 1.143, y, z0 + 0.2], 0.1, 6);
  }
  if (fine) {
    // gunner's helmet under the glass
    b.lathe('white', profile([[0, 1.05], [0.55, 0.95], [0.72, 0.5], [0.74, 0], [0.6, -0.25]]), { at: [0, y + 0.35, z0 + 2.4], radial: 14 });
    b.box('black', 0, y + 0.65, z0 + 1.78, 0.9, 0.18, 0.12, { c: 0.02 });
  }
  for (const x of [0.7, -0.7]) {
    b.cyl('dbg', x, -0.3, z0 - 0.5, 0.42, 1.0, { axis: 'z', radial: fine ? 12 : 6 });
    b.cyl('gunmetal', x, -0.3, z0 - 2.2, 0.2, 3.0, { axis: 'z', radial: fine ? 10 : 6 });
    b.cyl('flatSilver', x, -0.3, z0 - 3.8, 0.28, 0.5, { axis: 'z', radial: fine ? 10 : 6 });
  }
}

/**
 * ARC-170 starfighter, ~55 studs long. `setFoils` (also on `group.userData.setFoils`) folds the
 * S-foils in place: no extra draw calls, and a Swarm/flatten bake captures the current pose.
 * Owner: asset agent B.
 */
export function arc170(o: { lod?: 0 | 1 } = {}): Arc170 {
  const lod = o.lod ?? 0;
  const fine = lod === 0;
  const L = styles(fine);
  const group = new Group();
  group.name = 'arc170';
  const b = new SpanBuilder({ seed: 170, studSegments: fine ? 10 : 6 });
  // origin at the centre of mass (between the wing roots)
  const OZ = 3.5;
  b.translate(0, 0, OZ);
  fuselage(b, fine, L);
  canopy(b, fine);
  tailGunner(b, fine);
  const foils: FoilSpan[] = [];
  for (const sx of [1, -1]) {
    b.push();
    if (sx < 0) b.mirrorX();
    engine(b, fine);
    wing(b, fine, L, foils);
    cannon(b, fine);
    tailFin(b, fine);
    b.pop();
  }
  const built = b.build(lod ? 'arc170-lod1' : 'arc170');
  group.add(built.group);
  const setFoils = foilRig(built.group, foils);
  group.userData.setFoils = setFoils;
  const muzzles: Object3D[] = [];
  const engines: Object3D[] = [];
  for (const sx of [1, -1]) {
    muzzles.push(anchor(`cannon${sx > 0 ? 'L' : 'R'}`, group, CANNON_X * sx, WING_Y - 0.1, 21.45 + OZ));
  }
  for (const sx of [1, -1]) {
    const m = anchor(`tailgun${sx > 0 ? 'L' : 'R'}`, group, 0.7 * sx, -0.3, TAIL_Z - 4.1 + OZ);
    m.rotation.y = Math.PI;
    muzzles.push(m);
  }
  for (const sx of [1, -1]) engines.push(anchor(`engine${sx > 0 ? 'L' : 'R'}`, group, ENG_X * sx, ENG_Y, ENG_Z1 - 1.3 + OZ));
  const glows: Mesh[] = [];
  group.traverse((m) => {
    if (m instanceof Mesh && /:glow(Orange|Engine)$/.test(m.name)) glows.push(m);
  });
  group.userData.engineGlows = glows;
  return { group, length: NOSE_Z - (TAIL_Z - 4.1), muzzles, engines, setFoils };
}
