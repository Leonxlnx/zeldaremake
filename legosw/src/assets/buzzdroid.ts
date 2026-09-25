import { Group, Object3D, Quaternion, Vector3 } from 'three';
import { Builder } from '../core/builder';
import { MeshAcc, tube, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import { Rng } from '../core/rng';
import type { BuzzDroid } from './types';
import { DEG, ball, boxAt, clamp01, cylAt, emit, frame, lathePts, lerp, newTally, pivot, rod, smooth, type Tally } from './c-kit';

/**
 * Buzz droid (pistoeka sabotage droid). Closed (setDeploy(0)) it is a 2.6-stud ball: two
 * hemispherical shells banded lbg / flatSilver / dbg with crenellated dark stripes, the big red eye
 * glowing through the notch in their front seam. setDeploy(1) swings the shells up and out on struts
 * like a beetle's wing cases, raises the domed head (`head` rests at (0, y, 0) with zero rotation so
 * it can be knocked off), drops the three-pronged tail and unfolds six arms: gripper / drill on top,
 * circular saws in the middle, clawed feet below. animate(t) flexes the arms, works the grippers and
 * spins the blades, deterministically in t.
 * Origin = ball centre. Deployed, the feet, saw rims and tail claw reach y = −1.3 (the bottom of the
 * closed ball), so the droid perches on the same surface in either state.
 */

const R = 1.3; // shell outer radius
const RI = 1.2; // shell inner radius
const GROUND = -1.3;
const NOTCH_A = 0.38; // half-angle of the eye notch in each shell's front rim
const NOTCH_PSI = Math.PI / 2 - 0.35; // polar angle where the notch starts
const SHELL_C = new Vector3(1.72, 0.72, -0.12); // deployed shell centre (port)
const SHELL_BETA = 63 * DEG; // deployed shell roll (pole up and out)
const STRUT_H = new Vector3(0.44, 0.52, -0.12); // strut hinge on the body (port)
const STRUT_A = new Vector3(RI - 0.2, 0, 0); // strut end inside the shell (port shell frame)
const HEAD_Y0 = 0.5, HEAD_Y1 = 0.68;
const TAIL_Y0 = -0.52, TAIL_Y1 = -0.8;

// ---------------------------------------------------------------------------------------------
// shell (port half: pole on +X, rim in the x = 0 plane; lathe angle 0 = +Z, π/2 = −Y)

function shellP(r: number, th: number, psi: number): V3 {
  const rr = r * Math.sin(psi);
  return [r * Math.cos(psi), -rr * Math.sin(th), rr * Math.cos(th)];
}

/** Lathe profile points (radius, axial) along the sphere of radius r from polar angle a to b. */
function arc(r: number, a: number, b: number, n: number): number[][] {
  const out: number[][] = [];
  for (let k = 0; k <= n; k++) {
    const p = a + ((b - a) * k) / n;
    out.push([r * Math.sin(p), r * Math.cos(p)]);
  }
  return out;
}

function shell(b: Builder, rng: Rng, alt: boolean): void {
  const main = { axis: 'x' as const, theta0: NOTCH_A, thetaLen: Math.PI * 2 - 2 * NOTCH_A, radial: 20, crease: 80 };
  const notch = { axis: 'x' as const, theta0: -NOTCH_A, thetaLen: 2 * NOTCH_A, radial: 4, crease: 80 };
  // large areas stay solid lbg (a metallic dome mirrors the dark sky and reads as a crater);
  // flatSilver only on the accent ring and the rim
  const ring = alt ? 0.3 : 0.5;
  const bands: [number, number, ColorKey][] = [
    [0, ring, 'lbg'],
    [ring, ring + 0.13, 'flatSilver'],
    [ring + 0.13, 0.98, 'lbg'],
    [0.98, 1.2, 'dbg'],
    [1.2, 1.44, 'lbg'],
    [1.44, Math.PI / 2, 'flatSilver'],
  ];
  for (const [a, c, key] of bands) {
    const n = Math.max(1, Math.round((c - a) / 0.14));
    lathePts(b, key, arc(R, a, c, n), main);
    if (a < NOTCH_PSI) {
      const c2 = Math.min(c, NOTCH_PSI);
      lathePts(b, key, arc(R, a, c2, Math.max(1, Math.round((c2 - a) / 0.14))), notch);
    }
  }
  // rim and inner surface, honeycomb tiles inside
  lathePts(b, 'black', [[R, 0], ...arc(RI, Math.PI / 2, 0, 7)], { ...main, crease: 60 });
  lathePts(b, 'black', [[R * Math.sin(NOTCH_PSI), R * Math.cos(NOTCH_PSI)], ...arc(RI, NOTCH_PSI, 0, 6)], { ...notch, crease: 60 });
  const hex: number[][] = [];
  for (let k = 0; k < 6; k++) hex.push([Math.cos((k * Math.PI) / 3) * 0.15, Math.sin((k * Math.PI) / 3) * 0.15]);
  for (const [psi, n, off] of [[0.0, 1, 0], [0.34, 6, 0], [0.7, 11, 0.5]] as const) {
    for (let k = 0; k < n; k++) {
      const th = ((k + off) / n) * Math.PI * 2;
      if (psi > 0.9 && Math.cos(th) > Math.cos(NOTCH_A + 0.2)) continue;
      const nrm = shellP(1, th, psi);
      const tan: V3 = psi === 0 ? [0, 0, 1] : [-Math.sin(psi), -Math.cos(psi) * Math.sin(th), Math.cos(psi) * Math.cos(th)];
      b.push();
      b.apply(frame(shellP(RI - 0.012, th, psi), [-nrm[0], -nrm[1], -nrm[2]], tan));
      b.prism('dbg', hex, 0.03, { c: 0, noBack: true });
      b.pop();
    }
  }
  // notch side walls
  const acc = new MeshAcc();
  for (const s of [1, -1]) {
    const th = s * NOTCH_A;
    const nrm: V3 = [0, s * Math.cos(NOTCH_A), Math.sin(NOTCH_A)];
    for (let k = 0; k < 3; k++) {
      const p0 = NOTCH_PSI + ((Math.PI / 2 - NOTCH_PSI) * k) / 3, p1 = NOTCH_PSI + ((Math.PI / 2 - NOTCH_PSI) * (k + 1)) / 3;
      acc.quad(shellP(R, th, p0), shellP(R, th, p1), shellP(RI, th, p1), shellP(RI, th, p0), nrm);
    }
  }
  b.add('black', acc.done());
  // crenellated edges of the dark band (printed-tile teeth) and a few rivets
  const K = 13;
  for (let k = 0; k < K; k++) {
    const th = NOTCH_A + ((k + 0.5) * (Math.PI * 2 - 2 * NOTCH_A)) / K;
    for (const edge of [0, 1]) {
      const L = rng.pick([0.1, 0.17, 0.25]);
      const psi = edge === 0 ? 0.98 - (0.5 * L) / R : 1.2 + (0.5 * L) / R;
      const tan: V3 = [-Math.sin(psi), -Math.cos(psi) * Math.sin(th), Math.cos(psi) * Math.cos(th)];
      boxAt(b, 'dbg', shellP(R + 0.012, th, psi), tan, shellP(1, th, psi), 0.14, 0.03, L + 0.03, { c: 0, hide: { ny: true } });
    }
  }
  for (let k = 0; k < 6; k++) {
    const th = NOTCH_A + rng.range(0.2, Math.PI * 2 - 2 * NOTCH_A - 0.2), psi = rng.range(0.6, 0.88);
    const tan: V3 = [-Math.sin(psi), -Math.cos(psi) * Math.sin(th), Math.cos(psi) * Math.cos(th)];
    boxAt(b, 'dbg', shellP(R + 0.008, th, psi), tan, shellP(1, th, psi), 0.08, 0.025, 0.08, { c: 0, hide: { ny: true } });
  }
  // strut bracket at the inner pole
  b.cyl('dbg', RI - 0.06, 0, 0, 0.17, 0.12, { axis: 'x', radial: 12 });
  ball(b, 'flatSilver', [STRUT_A.x, 0, 0], 0.075, 8, 5);
}

// ---------------------------------------------------------------------------------------------
// body, head, tail

const BODY: number[][] = [[-0.24, -0.88], [0.24, -0.88], [0.36, -0.5], [0.5, 0], [0.52, 0.45], [0.42, 0.62], [-0.42, 0.62], [-0.52, 0.45], [-0.5, 0], [-0.36, -0.5]];
const EYES: [number, number][] = [[0.36, 0.12], [0.0, 0.2], [-0.37, 0.12]];

function body(b: Builder, arms: ArmDef[]): void {
  b.push();
  b.translate(0, 0, -0.05);
  b.prism('dbg', BODY, 0.8);
  b.pop();
  // faceted front plate with the three eyes
  b.push();
  b.translate(0, -0.03, 0.385);
  b.prism('lbg', BODY.map(([x, y]) => [x * 0.74, y * 0.9]), 0.09);
  b.pop();
  for (const [y, r] of EYES) {
    b.cyl('black', 0, y, 0.45, r + 0.055, 0.1, { axis: 'z', radial: 16, bottom: false });
    b.cyl('glowRed', 0, y, 0.5, r, 0.04, { axis: 'z', radial: 16, bottom: false });
    b.cyl('glowOrange', 0, y, 0.52, r * 0.38, 0.02, { axis: 'z', radial: 8, bottom: false });
  }
  b.push();
  b.translate(0, 0, 0.47);
  b.rotateX(Math.PI / 2);
  b.add('flatSilver', tube(0.29, 0.25, 0.07, 0.015, 20));
  b.pop();
  // brow chevron over the eye column, chin plate below it
  b.push();
  b.translate(0, 0, 0.445);
  b.prism('lbg', [[-0.3, 0.49], [0.3, 0.49], [0.2, 0.6], [-0.2, 0.6]], 0.06);
  b.prism('dbg', [[-0.12, -0.8], [0.12, -0.8], [0.16, -0.58], [-0.16, -0.58]], 0.06);
  b.pop();
  for (const s of [1, -1]) {
    // shoulder sockets
    for (const a of arms) cylAt(b, 'dbg', [s * (a.s[0] - 0.05), a.s[1], a.s[2]], [1, 0, 0], 0.1, 0.12, { radial: 8 });
    // strut hinge knuckles
    cylAt(b, 'dbg', [s * STRUT_H.x, STRUT_H.y, STRUT_H.z], [0, 0, 1], 0.09, 0.3, { radial: 8 });
    cylAt(b, 'flatSilver', [s * STRUT_H.x, STRUT_H.y, STRUT_H.z], [0, 0, 1], 0.05, 0.36, { radial: 6 });
    // side panels with technic holes, cooling slats on the lower flanks
    b.box('dbg', s * 0.47, 0.2, -0.16, 0.08, 0.34, 0.36);
    cylAt(b, 'black', [s * 0.515, 0.2, -0.16], [1, 0, 0], 0.075, 0.02, { radial: 8 });
    for (let k = 0; k < 3; k++) {
      const y = -0.2 - k * 0.11;
      b.box('lbg', s * (0.37 + (y + 0.5) * 0.28), y, -0.05, 0.05, 0.045, 0.5, { c: 0, rot: [0, 0, s * 0.27] });
    }
  }
  // back pack with vents, neck collar, tail socket
  b.box('dbg', 0, 0.05, -0.54, 0.62, 0.8, 0.2);
  for (let k = 0; k < 3; k++) b.box('lbg', 0, 0.28 - k * 0.16, -0.655, 0.46, 0.06, 0.04, { c: 0, hide: { nz: true } });
  b.cyl('lbg', 0, 0.66, 0, 0.34, 0.08, { radial: 18 });
  b.cyl('dbg', 0, -0.9, -0.02, 0.13, 0.1, { radial: 12 });
}

function headGeo(b: Builder): void {
  lathePts(b, 'dbg', [[0, 0.44], [0.18, 0.42], [0.3, 0.36], [0.38, 0.26], [0.42, 0.13], [0.43, 0.02], [0.43, -0.04], [0, -0.04]], { radial: 20, crease: 50 });
  b.add('lbg', tube(0.46, 0.38, 0.07, 0.015, 20));
  b.box('black', 0, 0.21, 0.36, 0.26, 0.07, 0.08, { rot: [-0.55, 0, 0], c: 0.015 });
  b.box('lbg', 0, 0.43, -0.06, 0.14, 0.05, 0.22, { c: 0.012 });
  for (const s of [1, -1]) cylAt(b, 'black', [s * 0.4, 0.12, 0.08], [s, 0.25, 0.2], 0.06, 0.05, { radial: 8 });
}

function antennaGeo(b: Builder): void {
  b.cyl('flatSilver', 0, 0.07, 0, 0.055, 0.14, { radial: 8 });
  rod(b, 'flatSilver', [0, 0.1, 0], [0, 1.45, 0], 0.022, { radial: 6 });
  b.cyl('flatSilver', 0, 0.75, 0, 0.04, 0.06, { radial: 6 });
  b.box('flatSilver', 0.08, 1.33, 0, 0.16, 0.1, 0.012, { c: 0.004 });
}

function tailGeo(b: Builder): void {
  rod(b, 'dbg', [0, 0, 0], [0, -0.32, 0], 0.065, { radial: 8 });
  b.cyl('dbg', 0, -0.31, 0, 0.11, 0.08, { radial: 10 });
  for (let k = 0; k < 3; k++) {
    b.push();
    b.rotateY((k * 2 * Math.PI) / 3 + Math.PI / 3);
    boxAt(b, 'black', [0, -0.37, 0.07], [0, -0.55, 1], [0, 1, 0.5], 0.05, 0.05, 0.17, { c: 0.012 });
    boxAt(b, 'black', [0, -0.45, 0.12], [0, -1, -0.2], [0, 0.2, 1], 0.04, 0.04, 0.12, { c: 0.01 });
    b.pop();
  }
}

// ---------------------------------------------------------------------------------------------
// arms (port side; the starboard set hangs under a mirrored parent)

type Tool = 'grip' | 'drill' | 'saw' | 'foot';
interface ArmDef {
  s: V3;
  l1: number;
  l2: number;
  /** working pose: yaw (out from +Z toward +X), pitch (down), elbow bend (down), degrees */
  work: V3;
  fold: V3;
  flex: V3;
  speed: number;
}
// feet and saw rims are solved to meet GROUND (feet: wrist 0.155 above the pad sole; saw: disc
// centre 0.14 past the wrist, rim dipping ~0.1 into the hull)
const ARMS: ArmDef[] = [
  { s: [0.5, 0.34, 0.12], l1: 0.9, l2: 0.9, work: [42, -32, 80], fold: [30, 75, 150], flex: [9, 10, 16], speed: 1.1 },
  { s: [0.5, -0.03, 0.14], l1: 0.9, l2: 0.95, work: [24, 20, 28], fold: [20, 80, 150], flex: [3, 5, 6], speed: 3.4 },
  { s: [0.36, -0.5, 0.02], l1: 0.9, l2: 1.0, work: [98, -15, 76], fold: [60, 80, 150], flex: [2, 2, 3], speed: 0.9 },
];

function upperGeo(b: Builder, l: number): void {
  ball(b, 'dbg', [0, 0, 0], 0.1, 8, 5);
  b.box('dbg', 0, 0, l / 2, 0.1, 0.1, l - 0.18);
  rod(b, 'dbg', [0, 0.085, 0.14], [0, 0.085, l - 0.14], 0.028, { radial: 6 });
  cylAt(b, 'dbg', [0, 0, l], [1, 0, 0], 0.075, 0.16, { radial: 8 });
}

function foreGeo(b: Builder, l: number): void {
  rod(b, 'flatSilver', [0, 0, 0.05], [0, 0, l - 0.05], 0.042, { radial: 8 });
  cylAt(b, 'flatSilver', [0, 0, 0.2], [0, 0, 1], 0.068, 0.26, { radial: 8 });
  cylAt(b, 'flatSilver', [0, 0, l - 0.04], [0, 0, 1], 0.062, 0.08, { radial: 8 });
}

interface ToolRig {
  /** spinning blade / bit and its spin axis */
  spin?: Object3D;
  spinAxis?: 'x' | 'z';
  fingers?: Object3D[];
  /** foot pad kept level with the ground */
  foot?: Object3D;
}

interface ArmRig extends ToolRig {
  def: ArmDef;
  shoulder: Object3D;
  elbow: Object3D;
  phase: number;
}

function toolGeo(kind: Tool, tally: Tally, parent: Object3D, seed: number): ToolRig {
  const b = new Builder({ seed, studSegments: 8 });
  const out: ToolRig = {};
  if (kind === 'saw') {
    b.box('dbg', 0.02, 0, 0.05, 0.14, 0.13, 0.12);
    cylAt(b, 'dbg', [0.08, 0, 0.14], [1, 0, 0], 0.06, 0.1, { radial: 8 });
    emit(b, 'buzz-saw-arm', parent, tally);
    const spin = pivot('buzz:saw', parent, 0.14, 0, 0.14);
    const d = new Builder({ seed: seed + 1, studSegments: 8, chamfer: 0.01 });
    d.cyl('flatSilver', 0, 0, 0, 0.29, 0.035, { axis: 'x', radial: 20, c: 0.01 });
    d.cyl('dbg', 0, 0, 0, 0.08, 0.07, { axis: 'x', radial: 10 });
    const N = 16;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = a0 + (0.7 * Math.PI * 2) / N;
      // raked tooth: base on the rim, tip leaning forward (in the disc's YZ plane)
      const p = (a: number, r: number) => [-(r * Math.cos(a)), r * Math.sin(a)];
      d.push();
      d.rotateY(Math.PI / 2);
      d.prism('flatSilver', [p(a0, 0.275), p(a1, 0.275), p(a1 - 0.05, 0.35)], 0.03, { c: 0 });
      d.pop();
    }
    emit(d, 'buzz-saw', spin, tally);
    out.spin = spin;
    out.spinAxis = 'x';
  } else if (kind === 'grip') {
    b.box('dbg', 0, 0, 0.05, 0.14, 0.12, 0.1);
    emit(b, 'buzz-grip', parent, tally);
    const fb = new Builder({ seed: seed + 2, studSegments: 8 });
    fb.box('flatSilver', 0, 0, 0.1, 0.035, 0.07, 0.2, { c: 0.01 });
    boxAt(fb, 'flatSilver', [-0.025, 0, 0.24], [-0.45, 0, 1], [0, 1, 0], 0.035, 0.06, 0.11, { c: 0.01 });
    const fg = fb.build('buzz-finger');
    out.fingers = [];
    for (const s of [1, -1]) {
      const f = pivot('buzz:finger', parent, s * 0.05, 0, 0.09);
      const g = s > 0 ? fg.group : fg.group.clone();
      g.scale.x = s;
      f.add(g);
      tally.tris += fg.triangles;
      tally.calls += fg.parts.length;
      out.fingers.push(f);
    }
  } else if (kind === 'drill') {
    cylAt(b, 'dbg', [0, 0, 0.07], [0, 0, 1], 0.085, 0.16, { radial: 10 });
    cylAt(b, 'dbg', [0, 0, 0.17], [0, 0, 1], 0.06, 0.05, { radial: 10 });
    emit(b, 'buzz-drill-arm', parent, tally);
    const spin = pivot('buzz:drill', parent, 0, 0, 0.19);
    const d = new Builder({ seed: seed + 3, studSegments: 8 });
    lathePts(d, 'flatSilver', [[0, 0.34], [0.02, 0.3], [0.045, 0.16], [0.05, 0.02], [0.05, 0], [0, 0]], { axis: 'z', radial: 8, crease: 40 });
    for (let k = 0; k < 3; k++) boxAt(d, 'flatSilver', [Math.cos(k * 2.1) * 0.045, Math.sin(k * 2.1) * 0.045, 0.1 + k * 0.07], [0, 0, 1], [Math.cos(k * 2.1), Math.sin(k * 2.1), 0], 0.1, 0.02, 0.025, { c: 0 });
    emit(d, 'buzz-drill', spin, tally);
    out.spin = spin;
    out.spinAxis = 'z';
  } else {
    const foot = pivot('buzz:foot', parent);
    ball(b, 'dbg', [0, 0, 0], 0.065, 8, 5);
    b.box('dbg', 0, -0.07, 0.01, 0.07, 0.1, 0.07, { c: 0.012 });
    b.box('dbg', 0, -0.13, 0.03, 0.22, 0.05, 0.3);
    for (const x of [-0.07, 0, 0.07]) boxAt(b, 'black', [x, -0.14, 0.2], [0, -0.35, 1], [0, 1, 0.35], 0.035, 0.035, 0.12, { c: 0.008 });
    emit(b, 'buzz-foot', foot, tally);
    out.foot = foot;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

const _q = new Quaternion();
const _q1 = new Quaternion();
const _v = new Vector3();
const _a = new Vector3();
const _d = new Vector3();
const UP = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export function buzzDroid(o: { seed?: number } = {}): BuzzDroid {
  const seed = o.seed ?? 1;
  const rng = new Rng(seed * 131 + 7);
  const group = new Group();
  group.name = 'buzzdroid';
  const tally = newTally();

  const bb = new Builder({ seed, studSegments: 10 });
  body(bb, ARMS);
  emit(bb, 'buzz-body', group, tally);

  // shells
  const sb = new Builder({ seed: seed + 1, studSegments: 10 });
  shell(sb, rng, rng.chance(0.5));
  const shellBuilt = sb.build('buzz-shell');
  const shells: Object3D[] = [];
  for (const s of [1, -1]) {
    const pv = pivot(s > 0 ? 'buzz:shellP' : 'buzz:shellS', group);
    const g = s > 0 ? shellBuilt.group : shellBuilt.group.clone();
    g.scale.x = s;
    pv.add(g);
    tally.tris += shellBuilt.triangles;
    tally.calls += shellBuilt.parts.length;
    shells.push(pv);
  }
  const strutB = new Builder({ seed: seed + 2, studSegments: 8 });
  rod(strutB, 'flatSilver', [0, 0, 0], [0, 1, 0], 0.035, { radial: 8, ch: 0 });
  const strutBuilt = strutB.build('buzz-strut');
  const struts: Object3D[] = [];
  for (const s of [1, -1]) {
    const pv = pivot('buzz:strut', group);
    pv.add(s > 0 ? strutBuilt.group : strutBuilt.group.clone());
    tally.tris += strutBuilt.triangles;
    tally.calls += strutBuilt.parts.length;
    struts.push(pv);
  }

  // head (knock-off-able) with an inner pivot for looking around, telescoping antenna
  const head = pivot('buzz:head', group, 0, HEAD_Y1, 0);
  const look = pivot('buzz:headLook', head);
  const hb = new Builder({ seed: seed + 3, studSegments: 10 });
  headGeo(hb);
  emit(hb, 'buzz-head', look, tally);
  const antenna = pivot('buzz:antenna', look, 0.14, 0.3, -0.2);
  antenna.rotation.set(-0.2, 0, -0.08);
  const ab = new Builder({ seed: seed + 4, studSegments: 8 });
  antennaGeo(ab);
  emit(ab, 'buzz-antenna', antenna, tally);

  const tail = pivot('buzz:tail', group, 0, TAIL_Y1, -0.02);
  const tb = new Builder({ seed: seed + 5, studSegments: 8 });
  tailGeo(tb);
  emit(tb, 'buzz-tail', tail, tally);

  // arms: segment meshes are built once and cloned (clones share geometry)
  const armsRoot = pivot('buzz:arms', group);
  const segCache = new Map<string, ReturnType<Builder['build']>>();
  const segment = (kind: 'upper' | 'fore', l: number, parent: Object3D) => {
    const key = `${kind}|${l}`;
    let built = segCache.get(key);
    let g: Group;
    if (!built) {
      const b = new Builder({ seed: seed + 6 + segCache.size, studSegments: 8 });
      if (kind === 'upper') upperGeo(b, l);
      else foreGeo(b, l);
      built = b.build(`buzz-${kind}`);
      segCache.set(key, built);
      g = built.group;
    } else {
      g = built.group.clone();
    }
    parent.add(g);
    tally.tris += built.triangles;
    tally.calls += built.parts.length;
  };
  const rigs: ArmRig[] = [];
  const upperTool: Tool = rng.chance(0.5) ? 'drill' : 'grip';
  for (const s of [1, -1]) {
    const side = pivot(s > 0 ? 'buzz:armsP' : 'buzz:armsS', armsRoot);
    side.scale.x = s;
    ARMS.forEach((def, i) => {
      const shoulder = pivot(`buzz:arm${i}`, side, def.s[0], def.s[1], def.s[2]);
      segment('upper', def.l1, shoulder);
      const elbow = pivot(`buzz:elbow${i}`, shoulder, 0, 0, def.l1);
      segment('fore', def.l2, elbow);
      const tool = pivot(`buzz:tool${i}`, elbow, 0, 0, def.l2);
      const kind: Tool = i === 0 ? (s > 0 ? 'grip' : upperTool) : i === 1 ? 'saw' : 'foot';
      const extra = toolGeo(kind, tally, tool, seed * 10 + i * 2 + (s > 0 ? 0 : 1));
      rigs.push({ def, shoulder, elbow, ...extra, phase: rng.range(0, Math.PI * 2) });
    });
  }

  group.userData.groundY = GROUND;
  group.userData.radius = R;
  group.userData.triangles = tally.tris;
  group.userData.drawCalls = tally.calls;

  let deploy = 0;
  let time = 0;
  const lookPhase = rng.range(0, 6);
  const update = () => {
    const es = smooth(clamp01(deploy / 0.55));
    const eb = smooth(clamp01((deploy - 0.2) / 0.5));
    const ea = smooth(clamp01((deploy - 0.35) / 0.65));
    // shells swing up and out; struts follow
    shells.forEach((pv, i) => {
      const s = i === 0 ? 1 : -1;
      pv.position.set(s * SHELL_C.x * es, SHELL_C.y * es, SHELL_C.z * es);
      _q1.setFromAxisAngle(Z, s * SHELL_BETA);
      pv.quaternion.identity().slerp(_q1, es);
      _a.set(s * STRUT_A.x, STRUT_A.y, STRUT_A.z).applyQuaternion(pv.quaternion).add(pv.position);
      _v.set(s * STRUT_H.x, STRUT_H.y, STRUT_H.z);
      _d.subVectors(_a, _v);
      const len = Math.max(0.01, _d.length());
      const st = struts[i];
      st.position.copy(_v);
      st.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
      st.scale.set(1, len, 1);
    });
    head.position.set(0, lerp(HEAD_Y0, HEAD_Y1, eb), 0);
    antenna.scale.set(1, lerp(0.12, 1, eb), 1);
    look.rotation.set(Math.sin(time * 0.7 + lookPhase) * 0.08 * eb, Math.sin(time * 0.9 + lookPhase) * 0.35 * eb, 0);
    tail.position.y = lerp(TAIL_Y0, TAIL_Y1, eb);
    armsRoot.visible = deploy > 0.3;
    for (const r of rigs) {
      const { work, fold, flex, speed } = r.def;
      const w = (k: number, f: number) => (lerp(fold[k], work[k], ea) + flex[k] * Math.sin(time * speed * f + r.phase + k) * ea) * DEG;
      const yaw = w(0, 1.3), pitch = w(1, 1.7), bend = w(2, 2.1);
      r.shoulder.rotation.set(pitch, yaw, 0, 'YXZ');
      r.elbow.rotation.set(bend, 0, 0);
      if (r.spin) r.spin.rotation.set(r.spinAxis === 'x' ? time * 26 : 0, 0, r.spinAxis === 'z' ? time * 30 : 0);
      if (r.fingers) {
        const open = (14 + 22 * (0.5 + 0.5 * Math.sin(time * 3.1 + r.phase))) * DEG * ea + 4 * DEG;
        r.fingers[0].rotation.y = open;
        r.fingers[1].rotation.y = -open;
      }
      if (r.foot) r.foot.rotation.set(-(pitch + bend), 0, 0);
    }
  };
  update();

  return {
    group,
    head,
    setDeploy(v: number) {
      deploy = clamp01(v);
      update();
    },
    animate(t: number) {
      time = t;
      update();
    },
  };
}
