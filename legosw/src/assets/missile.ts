import { Group, Matrix4, Object3D, Vector3 } from 'three';
import { Builder } from '../core/builder';
import { MeshAcc, cylinder, type MeshData, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import type { Missile } from './types';
import { DEG, clamp01, cone, cylAt, emit, lathePts, newTally, pivot, rod, smooth, type Tally } from './c-kit';

/**
 * Discord missile, the buzz droid carrier (~9 studs): a four-petal ogive nose over the payload
 * bay, a 2×2-round-brick forward body with dorsal, ventral and canard fins and dark red stripes,
 * a spiked boat-tail collar, a slim coupling, and a 1×1-round booster with four forward-swept fins
 * and a glowing nozzle. +Z forward, origin at the middle. `setOpen` swings the petals back ~115°
 * and pushes out four closed buzz droid balls (scaled dummies on `payloadAnchors`).
 */

const R = 1.0;
const ZB = 2.1;
const NOSE = 2.4;
const RN = 1.02;
const SHELL = 0.05;
const OPEN = 115 * DEG;
/** Dummy balls are the real buzz droid (radius 1.3) at this scale. */
const PAYLOAD_SCALE = 0.28;
const PAYLOAD_R = 0.52, PAYLOAD_Z = ZB + 0.42;

// ---------------------------------------------------------------------------------------------
// nose petals: quarters of a tangent ogive, hinged on the outer rim of the nose base

const RHO = (RN * RN + NOSE * NOSE) / (2 * RN);
/** Ogive radius at distance x in front of the nose base. */
const ogive = (x: number) => Math.max(0, Math.sqrt(Math.max(0, RHO * RHO - x * x)) + RN - RHO);
const at = (r: number, z: number, th: number): V3 => [r * Math.cos(th), r * Math.sin(th), z];

/** Outer skin and inner lining (with the rim and cut faces) of one petal, in missile space. */
function petalMeshes(th0: number, th1: number, seg: number): { skin: MeshData; lining: MeshData } {
  const N = 14;
  const O: number[][] = [], I: number[][] = [], NR: number[][] = [];
  for (let i = 0; i <= N; i++) {
    const x = (NOSE * i) / N;
    const r = ogive(x);
    // the ogive is a circular arc centred on the base plane at radius RN − RHO
    const nr = (r - (RN - RHO)) / RHO, nz = x / RHO;
    O.push([r, ZB + x]);
    NR.push([nr, nz]);
    I.push([Math.max(0, r - SHELL * nr), ZB + x - SHELL * nz]);
  }
  const skin = new MeshAcc(), lining = new MeshAcc();
  for (let k = 0; k < seg; k++) {
    const ta = th0 + ((th1 - th0) * k) / seg, tb = th0 + ((th1 - th0) * (k + 1)) / seg;
    for (let i = 0; i < N; i++) {
      const n = (j: number, t: number): V3 => [NR[j][0] * Math.cos(t), NR[j][0] * Math.sin(t), NR[j][1]];
      const m = (j: number, t: number): V3 => [-NR[j][0] * Math.cos(t), -NR[j][0] * Math.sin(t), -NR[j][1]];
      skin.quad(at(O[i][0], O[i][1], ta), at(O[i][0], O[i][1], tb), at(O[i + 1][0], O[i + 1][1], tb), at(O[i + 1][0], O[i + 1][1], ta), n(i, ta), n(i, tb), n(i + 1, tb), n(i + 1, ta));
      lining.quad(at(I[i][0], I[i][1], ta), at(I[i][0], I[i][1], tb), at(I[i + 1][0], I[i + 1][1], tb), at(I[i + 1][0], I[i + 1][1], ta), m(i, ta), m(i, tb), m(i + 1, tb), m(i + 1, ta));
    }
    lining.quad(at(O[0][0], O[0][1], ta), at(O[0][0], O[0][1], tb), at(I[0][0], I[0][1], tb), at(I[0][0], I[0][1], ta), [0, 0, -1]);
  }
  for (const [t, sg] of [[th0, -1], [th1, 1]]) {
    const n: V3 = [-sg * Math.sin(t), sg * Math.cos(t), 0];
    for (let i = 0; i < N; i++) lining.quad(at(O[i][0], O[i][1], t), at(O[i + 1][0], O[i + 1][1], t), at(I[i + 1][0], I[i + 1][1], t), at(I[i][0], I[i][1], t), n);
  }
  return { skin: skin.done(), lining: lining.done() };
}

// ---------------------------------------------------------------------------------------------
// body: one lathe profile in coloured sections (r, z) from the payload bay floor to the nozzle

const BODY: [ColorKey, number[][]][] = [
  ['dbg', [[0, ZB - 0.04], [RN - 0.08, ZB - 0.04]]],
  ['flatSilver', [[RN - 0.08, ZB - 0.04], [RN - 0.08, ZB], [RN + 0.04, ZB], [RN + 0.04, ZB - 0.16], [R, ZB - 0.16]]],
  ['dbg', [[R, ZB - 0.16], [R, 1.62]]],
  ['darkRed', [[R, 1.62], [R + 0.02, 1.61], [R + 0.02, 1.5], [R, 1.49]]],
  ['dbg', [[R, 1.49], [R, 1.44]]],
  ['darkRed', [[R, 1.44], [R + 0.02, 1.43], [R + 0.02, 1.36], [R, 1.35]]],
  ['dbg', [[R, 1.35], [R, 0.76], [R - 0.025, 0.74], [R, 0.72], [R, -0.44], [R - 0.025, -0.46], [R, -0.48], [R, -0.8]]],
  ['gunmetal', [[R, -0.8], [R - 0.03, -0.84], [0.58, -1.36], [0.52, -1.4]]],
  ['flatSilver', [[0.52, -1.4], [0.36, -1.42], [0.36, -1.52], [0.4, -1.55], [0.36, -1.58], [0.36, -1.68], [0.52, -1.7]]],
  ['dbg', [[0.52, -1.7], [0.55, -1.74], [0.55, -2.88], [0.53, -2.9], [0.55, -2.92], [0.55, -3.66]]],
  ['darkRed', [[0.55, -3.66], [0.57, -3.68], [0.57, -3.86], [0.55, -3.88]]],
  ['dbg', [[0.55, -3.88], [0.55, -4.06], [0.5, -4.12]]],
  ['gunmetal', [[0.5, -4.12], [0.43, -4.16], [0.49, -4.5], [0.44, -4.5], [0.34, -4.24]]],
  ['glowOrange', [[0.34, -4.24], [0, -4.24]]],
];

/** Frame whose X runs out along the radial direction at angle `phi`, Y along the missile axis. */
function radial(phi: number, z = 0): Matrix4 {
  const er = new Vector3(Math.cos(phi), Math.sin(phi), 0), ez = new Vector3(0, 0, 1);
  return new Matrix4().makeBasis(er, ez, er.clone().cross(ez)).setPosition(0, 0, z);
}

function body(b: Builder): void {
  for (const [key, pts] of BODY) lathePts(b, key, pts, { axis: 'z', radial: 24, crease: 40 });
  // dorsal and ventral fins (side outlines [z, y]), canards (plan outlines [x, z])
  b.push();
  b.rotateY(Math.PI / 2);
  b.prism('lbg', [[1.6, 0.95], [-0.3, 0.95], [-0.7, 1.62], [-0.45, 1.62]].map(([z, y]) => [-z, y]), 0.1, { c: 0.03 });
  b.prism('lbg', [[0.8, -0.95], [0.1, -0.95], [-0.45, -1.85], [-0.2, -1.85]].map(([z, y]) => [-z, y]), 0.1, { c: 0.03 });
  b.pop();
  for (const s of [1, -1]) {
    b.push();
    b.rotateX(Math.PI / 2);
    b.prism('lbg', [[0.95, 1.5], [0.95, 0.95], [1.55, 0.7], [1.55, 0.92]].map(([x, z]) => [s * x, z]), 0.09, { c: 0.03 });
    b.pop();
    // side grille panels under the canards
    b.box('lbg', s * 0.97, -0.32, 0.15, 0.1, 0.34, 0.7, { c: 0.03 });
    for (let k = 0; k < 4; k++) b.box('black', s * 1.02, -0.32, -0.12 + k * 0.18, 0.02, 0.24, 0.06, { c: 0 });
  }
  // conduit rails along the diagonals, vent blocks at their ends
  for (let k = 0; k < 4; k++) {
    const p = Math.PI / 4 + (k * Math.PI) / 2;
    rod(b, 'flatSilver', at(R + 0.02, -0.7, p), at(R + 0.02, 1.25, p), 0.035, { radial: 6 });
    b.push();
    b.apply(radial(p));
    b.box('gunmetal', R, -0.45, 0, 0.1, 0.4, 0.26, { c: 0.02 });
    b.box('gunmetal', R, 1.12, 0, 0.08, 0.2, 0.18, { c: 0.02 });
    b.pop();
  }
  // spiked collar round the boat-tail
  for (let k = 0; k < 12; k++) {
    const p = (k / 12) * Math.PI * 2 + Math.PI / 12;
    cone(b, 'lbg', at(0.78, -1.05, p), at(1.16, -1.5, p), 0.08, 6);
  }
  // booster fins, forward swept, in an X
  for (let k = 0; k < 4; k++) {
    b.push();
    b.apply(radial(Math.PI / 4 + (k * Math.PI) / 2));
    b.prism('lbg', [[0.5, -3.5], [0.5, -2.1], [2.05, -1.58], [2.1, -1.9]], 0.12, { c: 0.04 });
    b.box('gunmetal', 1.35, -2.72, 0, 0.9, 0.08, 0.16, { c: 0.02, rot: [0, 0, 0.62] });
    b.pop();
  }
}

// ---------------------------------------------------------------------------------------------
// payload: a closed buzz droid ball at full scale (radius 1.3), shrunk on each anchor

function dummyBall(b: Builder): void {
  lathePts(b, 'lbg', [[0, 1.3], [0.65, 1.13], [1.13, 0.65], [1.3, 0], [1.13, -0.65], [0.65, -1.13], [0, -1.3]], { axis: 'x', radial: 12, crease: 50 });
  b.add('lbg', cylBand(1.34, 0.22), undefined, { shade: 0.45 });
  b.add('lbg', cylinder(0.55, 0.36, 0.03, 10), new Matrix4().makeTranslation(0, 0.05, 1.12).multiply(new Matrix4().makeRotationX(Math.PI / 2)), { shade: 0.12 });
  cylAt(b, 'glowRed', [0, 0.12, 1.32], [0, 0, 1], 0.17, 0.06, { radial: 8 });
}

/** The raised seam band between the two shells of the dummy ball (a disc along X). */
function cylBand(r: number, w: number): MeshData {
  const acc = new MeshAcc();
  const n = 14;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, c = ((k + 1) / n) * Math.PI * 2;
    const p = (t: number, x: number): V3 => [x, r * Math.cos(t), r * Math.sin(t)];
    const nn = (t: number): V3 => [0, Math.cos(t), Math.sin(t)];
    acc.quad(p(a, -w / 2), p(c, -w / 2), p(c, w / 2), p(a, w / 2), nn(a), nn(c), nn(c), nn(a));
    for (const s of [1, -1]) acc.quad(p(a, (s * w) / 2), p(c, (s * w) / 2), [(s * w) / 2, 0, 0], [(s * w) / 2, 0, 0], [s, 0, 0]);
  }
  return acc.done();
}

// ---------------------------------------------------------------------------------------------

export function discordMissile(o: { seed?: number } = {}): Missile {
  const seed = o.seed ?? 1;
  const group = new Group();
  group.name = 'discord-missile';
  const tally: Tally = newTally();

  const bb = new Builder({ seed, studSegments: 10 });
  body(bb);
  emit(bb, 'missile-body', group, tally);

  // petals centred on the diagonals so the seams run top, bottom and sides
  const petals: { pv: Object3D; axis: Vector3 }[] = [];
  for (let k = 0; k < 4; k++) {
    const mid = Math.PI / 4 + (k * Math.PI) / 2, g = 0.03;
    const { skin, lining } = petalMeshes(mid - Math.PI / 4 + g, mid + Math.PI / 4 - g, 7);
    const hinge = at(RN, ZB, mid);
    const pv = pivot('missile:petal', group, hinge[0], hinge[1], hinge[2]);
    const pb = new Builder({ seed: seed + k + 1 });
    const off = new Matrix4().makeTranslation(-hinge[0], -hinge[1], -hinge[2]);
    pb.add('dbg', skin, off);
    pb.add('dbg', lining, off, { shade: 0.62 });
    cylAt(pb, 'dbg', [0, 0, 0], [-Math.sin(mid), Math.cos(mid), 0], 0.07, 0.5, { radial: 8 });
    emit(pb, 'missile-petal', pv, tally);
    petals.push({ pv, axis: new Vector3(-Math.sin(mid), Math.cos(mid), 0) });
  }

  // payload: four closed buzz droid balls in the nose, one per petal
  const db = new Builder({ seed: seed + 9, studSegments: 8 });
  dummyBall(db);
  const ball = db.build('payload-dummy');
  const payloadAnchors: Object3D[] = [];
  const payloadHome: Vector3[] = [];
  for (let k = 0; k < 4; k++) {
    const p = at(PAYLOAD_R, PAYLOAD_Z, Math.PI / 4 + (k * Math.PI) / 2);
    const an = pivot('payload', group, p[0], p[1], p[2]);
    const d = k === 0 ? ball.group : ball.group.clone();
    d.name = 'payload-dummy';
    d.scale.setScalar(PAYLOAD_SCALE);
    d.rotation.set(0, 0, (k * Math.PI) / 2);
    an.add(d);
    payloadAnchors.push(an);
    payloadHome.push(an.position.clone());
  }
  const dummyTris = ball.triangles, dummyCalls = ball.parts.length;

  const engine = pivot('engine', group, 0, 0, -4.5);
  engine.rotation.y = Math.PI;

  const setOpen = (v: number) => {
    const e = smooth(clamp01(v));
    for (const { pv, axis } of petals) pv.quaternion.setFromAxisAngle(axis, e * OPEN);
    const out = smooth(clamp01((v - 0.35) / 0.65));
    payloadAnchors.forEach((an, k) => {
      const ph = payloadHome[k];
      an.position.set(ph.x * (1 + out * 0.5), ph.y * (1 + out * 0.5), ph.z + out * 0.9);
      an.visible = v > 0.02;
    });
  };
  setOpen(0);

  group.userData.triangles = tally.tris + dummyTris * 4;
  group.userData.drawCalls = tally.calls + dummyCalls * 4;
  group.userData.payloadScale = PAYLOAD_SCALE;

  return { group, length: 9, muzzles: [], engines: [engine], setOpen, payloadAnchors };
}
