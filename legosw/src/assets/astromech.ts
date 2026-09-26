import { Group, Mesh, MeshBasicMaterial, Object3D, type Color } from 'three';
import { Builder } from '../core/builder';
import { cylinder, profile, sphere, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import type { Astromech } from './types';
import { anchor } from './placeholder';
import { cylPatch, place, rod, satin, spherePatch } from './a-kit';

/**
 * Minifig-scale astromechs in the style of the modern LEGO R2-D2 figure (2-stud dome, ~4.2 tall).
 *
 * Origins: full droid → ground centre between the feet (body top at y = BODY_TOP); socket droid
 * (`socket: true`) → body-top centre, which is exactly where `Eta2.astromechAnchor` sits. The
 * dome pivots about Y at the body top in both cases. Printed panels are thin curved patches that
 * follow the dome / body surface.
 */

export const BODY_TOP = 3.08;
const BODY_R = 0.95;
const DOME_R = 0.955;
const RING_H = 0.07;
const D = Math.PI / 180;

interface Scheme {
  body: ColorKey;
  accent: ColorKey;
  dome: ColorKey;
  domeAccent: ColorKey;
  trim: ColorKey;
  metal: ColorKey;
  eyeLight: ColorKey;
  holo: ColorKey;
  logicA: ColorKey;
  logicB: ColorKey;
}

const R2: Scheme = { body: 'white', accent: 'blue', dome: 'metalSilver', domeAccent: 'blue', trim: 'lbg', metal: 'flatSilver', eyeLight: 'glowRed', holo: 'glowBlue', logicA: 'glowBlue', logicB: 'glowRed' };
const R4: Scheme = { body: 'white', accent: 'red', dome: 'red', domeAccent: 'flatSilver', trim: 'lbg', metal: 'flatSilver', eyeLight: 'glowRed', holo: 'glowWhite', logicA: 'glowRed', logicB: 'glowYellow' };

export function astromech(o: { variant: 'r2d2' | 'r4p17'; socket?: boolean; lod?: 0 | 1 }): Astromech {
  const s = o.variant === 'r2d2' ? R2 : R4;
  const lo = o.lod === 1;
  const seg = lo ? 20 : 44;
  const seed = o.variant === 'r2d2' ? 22 : 417;
  const group = new Group();
  group.name = `astromech-${o.variant}${o.socket ? '-socket' : ''}`;
  // everything below is modelled with y = 0 at the body top
  const root = new Object3D();
  root.name = 'droid';
  root.position.y = o.socket ? 0 : BODY_TOP;
  group.add(root);

  const body = new Builder({ seed, studSegments: lo ? 8 : 14 });
  buildBody(body, s, !!o.socket, seg, lo);
  root.add(body.build(`${group.name}:body`).group);

  const head = new Object3D();
  head.name = 'head';
  root.add(head);
  const hb = new Builder({ seed: seed + 1, studSegments: lo ? 8 : 14 });
  if (o.variant === 'r2d2') buildR2Dome(hb, s, seg, lo);
  else buildR4Dome(hb, s, seg, lo);
  head.add(hb.build(`${group.name}:dome`).group);

  const lb = new Builder({ seed: seed + 2, tint: 0 });
  const lightBase: { m: MeshBasicMaterial; c: Color }[] = [];
  if (o.variant === 'r2d2') r2Lights(lb, s);
  else r4Lights(lb, s);
  const lights = lb.build(`${group.name}:lights`).group;
  lights.traverse((ch) => {
    const m = ch as Mesh;
    if (!m.isMesh) return;
    const mm = (m.material as MeshBasicMaterial).clone();
    m.material = mm;
    lightBase.push({ m: mm, c: mm.color.clone() });
  });
  head.add(lights);
  satin(root, ['metalSilver', 'flatSilver']);

  const zapAnchor = o.socket ? anchor('zap', root, 0, RING_H + 0.02, DOME_R + 0.03) : anchor('zap', root, 0, -0.78, BODY_R + 0.06);
  return {
    group,
    head,
    setHeadYaw: (a) => (head.rotation.y = a),
    setLights(v) {
      const k = 0.12 + 0.88 * Math.max(0, Math.min(1, v));
      for (const l of lightBase) l.m.color.copy(l.c).multiplyScalar(k);
    },
    zapAnchor,
  };
}

// ——— body ———

function buildBody(b: Builder, s: Scheme, socket: boolean, seg: number, lo: boolean): void {
  const r = BODY_R;
  // thin trim ring where the dome meets the body
  b.lathe(s.trim, profile([[r - 0.1, RING_H], [r + 0.03, RING_H], [r + 0.045, RING_H * 0.5], [r + 0.03, 0], [r - 0.1, 0]], 40), { radial: seg });
  const yBot = socket ? -0.55 : -1.86;
  // main drum (slightly crowned top edge under the ring)
  b.lathe(s.body, profile([[r - 0.2, 0.0], [r, -0.03], [r, yBot + (socket ? 0 : 0.04)], ...(socket ? [[0, yBot]] : [[r - 0.04, yBot]])], 40), { radial: seg });
  // neck deck under the dome (what shows if the dome is knocked off): bearing ring + hub + wiring stubs
  b.cyl('dbg', 0, -0.005, 0, r - 0.06, 0.05, { radial: seg, bottom: false });
  b.lathe(s.trim, profile([[0.3, 0.05], [0.62, 0.05], [0.64, 0.035], [0.64, 0.0]], 40), { radial: lo ? 16 : 32 });
  b.cyl(s.metal, 0, 0.03, 0, 0.22, 0.06, { radial: lo ? 12 : 20 });
  if (!lo) for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    b.cyl(i % 2 ? 'red' : 'blue', Math.sin(a) * 0.45, 0.04, Math.cos(a) * 0.45, 0.05, 0.08, { radial: 8 });
  }
  const P = (k: ColorKey, y0: number, y1: number, t0: number, t1: number, raise = 0.016) => {
    if (socket && y1 < yBot + 0.02) return;
    const yy0 = Math.max(y0, yBot + 0.01);
    b.add(k, cylPatch(r - 0.02, r + raise, yy0, y1, t0 * D, t1 * D, Math.max(2, Math.round((t1 - t0) / 7))));
  };
  // collar band just below the ring: alternating silver / accent blocks (the "shoulder" band)
  for (let i = 0; i < 12; i++) {
    const c = i * 30;
    P(i % 3 === 0 ? s.accent : s.metal, -0.2, -0.07, c - 11, c + 11, 0.012);
  }
  // front: twin accent pillars, centre data port, accent bar, coin-return vents
  P(s.accent, -1.0, -0.3, -40, -16);
  P(s.accent, -1.0, -0.3, 16, 40);
  P(s.metal, -0.68, -0.3, -11, 11, 0.02);
  P(s.accent, -1.24, -1.08, -34, 34);
  P(s.metal, -1.62, -1.34, -24, -6, 0.02);
  P(s.metal, -1.62, -1.34, 6, 24, 0.02);
  if (!lo && !socket) {
    // vent slits on the coin returns
    for (const c of [-19, -15, -11, 11, 15, 19]) P('dbg', -1.58, -1.38, c - 0.9, c + 0.9, 0.028);
    // data-port slots
    for (const y of [-0.62, -0.52, -0.42]) P('dbg', y, y + 0.05, -8, 8, 0.03);
  }
  // back and flanks
  P(s.accent, -1.3, -0.35, 146, 170);
  P(s.accent, -1.3, -0.35, 190, 214);
  P(s.metal, -1.62, -1.42, 160, 200, 0.02);
  P(s.accent, -1.5, -1.1, 58, 78);
  P(s.accent, -1.5, -1.1, 282, 302);
  if (socket) return;
  // lower skirt + retracted centre leg
  b.lathe(s.trim, profile([[r - 0.04, yBot], [r - 0.08, yBot - 0.05], [0.72, -2.06], [0, -2.06]], 40), { radial: seg });
  b.box(s.trim, 0, -2.3, 0.02, 0.44, 0.5, 0.5, { c: 0.05 });
  b.box(s.body, 0, -2.62, 0.08, 0.5, 0.2, 0.66, { c: 0.06 });
  b.box(s.accent, 0, -2.3, 0.28, 0.26, 0.28, 0.02, { c: 0.01 });
  // side legs
  for (const side of [1, -1]) {
    b.cyl(s.trim, side * (r + 0.07), -0.46, 0, 0.36, 0.16, { axis: 'x', radial: lo ? 12 : 24 });
    legStrut(b, s, side * (r + 0.3), side, lo);
  }
}

function legStrut(b: Builder, s: Scheme, xc: number, side: number, lo: boolean): void {
  // strut: profile in (z, y) extruded along X (rotateY(−90°) maps profile x → world z), 0.3 thick
  b.push();
  b.translate(xc, 0, 0);
  b.rotateY(-Math.PI / 2);
  b.prism(s.body, [[-0.33, -0.18], [0.33, -0.18], [0.37, -2.52], [-0.37, -2.52]], 0.3, { c: 0.045 });
  b.pop();
  const xo = xc + side * 0.155;
  // outer face print: accent panel, silver vent, hub cap
  b.box(s.accent, xo + side * 0.005, -1.35, 0, 0.02, 0.9, 0.36, { c: 0.008 });
  b.box(s.metal, xo + side * 0.008, -2.0, 0, 0.02, 0.26, 0.4, { c: 0.008 });
  b.cyl(s.trim, xo + side * 0.05, -0.46, 0, 0.33, 0.1, { axis: 'x', radial: lo ? 12 : 24 });
  b.cyl(s.accent, xo + side * 0.105, -0.46, 0, 0.18, 0.02, { axis: 'x', radial: lo ? 10 : 20 });
  if (!lo) {
    for (const zz of [-0.1, 0, 0.1]) b.box('dbg', xo + side * 0.012, -2.0, zz, 0.02, 0.18, 0.035, { c: 0.005 });
    b.box(s.metal, xo + side * 0.01, -0.95, 0, 0.02, 0.1, 0.3, { c: 0.005 });
  }
  // ankle joint
  b.cyl(s.trim, xc, -2.56, 0.02, 0.2, 0.46, { axis: 'x', radial: lo ? 10 : 18 });
  // foot: trapezoid block in (z, y), extruded along X
  b.push();
  b.translate(xc, 0, 0);
  b.rotateY(-Math.PI / 2);
  b.prism(s.body, [[-0.72, -3.08], [0.8, -3.08], [0.52, -2.62], [-0.46, -2.62]], 0.62, { c: 0.05 });
  b.pop();
  b.box(s.accent, xc + side * 0.315, -2.86, 0.05, 0.02, 0.18, 0.9, { c: 0.008 });
  b.box(s.trim, xc, -3.05, 0.04, 0.58, 0.06, 1.46, { c: 0.02 });
}

// ——— R2-D2 dome ———

function domePanel(b: Builder, k: ColorKey, ph0: number, ph1: number, t0: number, t1: number, raise = 0.016, y0 = RING_H): void {
  const nu = Math.max(2, Math.round((t1 - t0) / 6));
  const nv = Math.max(2, Math.round((ph1 - ph0) / 6));
  b.push();
  b.translate(0, y0, 0);
  b.add(k, spherePatch(DOME_R - 0.03, DOME_R + raise, ph0 * D, ph1 * D, t0 * D, t1 * D, nu, nv));
  b.pop();
}

/** Point + outward normal on the dome at polar φ, azimuth θ (degrees). */
function onDome(ph: number, th: number, lift = 0): { p: V3; n: V3 } {
  const n: V3 = [Math.sin(ph * D) * Math.sin(th * D), Math.cos(ph * D), Math.sin(ph * D) * Math.cos(th * D)];
  const r = DOME_R + lift;
  return { p: [n[0] * r, RING_H + n[1] * r, n[2] * r], n };
}

function buildR2Dome(b: Builder, s: Scheme, seg: number, lo: boolean): void {
  b.push();
  b.translate(0, RING_H, 0);
  b.add(s.dome, sphere(DOME_R, seg, lo ? 8 : 14, 0, Math.PI / 2));
  b.pop();
  domeUnderside(b, seg, lo);
  // lower band of rectangular panels (the classic blue band); the front one is split by the logic display
  for (let i = 0; i < 8; i++) {
    const c = 22.5 + i * 45;
    domePanel(b, s.domeAccent, 63, 84, c - 17.5, c + 17.5);
  }
  // upper pie panels
  for (const c of [60, 180, 300]) domePanel(b, s.domeAccent, 16, 43, c - 21, c + 21);
  for (const c of [120, 240]) domePanel(b, s.domeAccent, 30, 43, c - 9, c + 9);
  // radar-eye surround and front logic housing
  domePanel(b, s.domeAccent, 27, 50, -15, 15, 0.014);
  domePanel(b, s.domeAccent, 52, 61, -13, 13, 0.014);
  // top cap
  domePanel(b, s.metal, 0, 9, 0, 360, 0.02);
  if (!lo) {
    // panel seams on the band (dark hairlines)
    for (let i = 0; i < 8; i++) domePanel(b, 'dbg', 71.5, 72.5, 22.5 + i * 45 - 17.5, 22.5 + i * 45 + 17.5, 0.02);
  }
  // radar eye: black housing + glossy lens
  const eye = onDome(38, 0);
  place(b, 'black', cylinderMD(0.2, 0.14, lo ? 14 : 24), eye.p, eye.n);
  const lens = onDome(38, 0, 0.07);
  if (!lo) place(b, 'trBlack', cylinderMD(0.13, 0.03, 20), lens.p, lens.n);
  // holo-projectors (front-left and rear top)
  for (const [ph, th] of [[55, 30], [20, 180]]) {
    const h = onDome(ph, th, 0.02);
    place(b, s.metal, cylinderMD(0.105, 0.16, lo ? 10 : 18), h.p, h.n);
  }
  // PSI housing
  const psi = onDome(58, -27, 0.005);
  place(b, s.metal, cylinderMD(0.075, 0.06, 14), psi.p, psi.n);
}

function r2Lights(b: Builder, s: Scheme): void {
  const L = (k: ColorKey, ph: number, th: number, r: number, lift: number, h = 0.03) => {
    const q = onDome(ph, th, lift);
    place(b, k, cylinderMD(r, h, 12), q.p, q.n);
  };
  L(s.eyeLight, 38, 0, 0.035, 0.1);
  L(s.holo, 55, 30, 0.07, 0.11);
  L(s.holo, 20, 180, 0.07, 0.11);
  L(s.logicB, 58, -27, 0.055, 0.045);
  // front logic display: two rows of tiny lights
  for (let i = 0; i < 4; i++) L(i % 2 ? s.logicA : 'glowWhite', 55, -7 + i * 4.6, 0.028, 0.03, 0.02);
  for (let i = 0; i < 3; i++) L(s.logicB, 58.5, -5 + i * 5, 0.026, 0.03, 0.02);
}

// ——— R4-P17 dome (R4 "inverted flowerpot") ———

/** Closed dark underside so a detached / sliced dome never shows its hollow inside. */
function domeUnderside(b: Builder, seg: number, lo: boolean): void {
  b.cyl('dbg', 0, RING_H + 0.012, 0, DOME_R - 0.01, 0.024, { radial: seg, top: false });
  if (!lo) b.cyl('gunmetal', 0, RING_H - 0.01, 0, 0.3, 0.03, { radial: 16, top: false });
}

function buildR4Dome(b: Builder, s: Scheme, seg: number, lo: boolean): void {
  const y = RING_H;
  domeUnderside(b, seg, lo);
  // silver band, red cone, silver cap
  b.lathe(s.domeAccent, profile([[0.62, y + 0.44], [0.975, y + 0.4], [0.975, y + 0.02], [0.93, y], [0.7, y]], 30), { radial: seg });
  b.lathe(s.dome, profile([[0.63, y + 0.9], [0.66, y + 0.88], [0.955, y + 0.43], [0.975, y + 0.4]], 30), { radial: seg });
  b.lathe(s.domeAccent, profile([[0, y + 1.02], [0.3, y + 1.01], [0.5, y + 0.975], [0.6, y + 0.935], [0.645, y + 0.895], [0.62, y + 0.87]], 30), { radial: seg });
  // red panels on the silver band
  for (let i = 0; i < 6; i++) {
    const c = 30 + i * 60;
    b.push();
    b.add(s.dome, cylPatch(0.955, 0.99, y + 0.08, y + 0.32, (c - 16) * D, (c + 16) * D, 4));
    b.pop();
  }
  // silver ribs on the cone (4) — thin slabs following the cone line
  const cone = (th: number, t: number, lift: number): V3 => {
    const rr = 0.955 + (0.66 - 0.955) * t + lift * 0.86;
    const yy = y + 0.43 + (0.88 - 0.43) * t + lift * 0.51;
    return [rr * Math.sin(th * D), yy, rr * Math.cos(th * D)];
  };
  for (const th of [55, 125, 235, 305]) rod(b, s.domeAccent, cone(th, 0.05, 0.01), cone(th, 0.95, 0.01), 0.035, { radial: 8 });
  if (!lo) for (const th of [90, 270]) rod(b, 'dbg', cone(th, 0.2, 0.012), cone(th, 0.8, 0.012), 0.022, { radial: 6 });
  // radar eye on the cone front
  const n: V3 = [0, 0.51, 0.86];
  const eyeP = cone(0, 0.5, 0.03);
  place(b, 'black', cylinderMD(0.19, 0.12, lo ? 14 : 24), eyeP, n);
  if (!lo) place(b, 'trBlack', cylinderMD(0.12, 0.03, 20), cone(0, 0.5, 0.1), n);
  // holo-projector (upper front-left) and a small vent
  const hp = cone(38, 0.82, 0.02);
  place(b, s.domeAccent, cylinderMD(0.09, 0.14, 16), hp, [Math.sin(38 * D) * 0.86, 0.51, Math.cos(38 * D) * 0.86]);
  if (!lo) place(b, 'dbg', cylinderMD(0.07, 0.05, 12), cone(-40, 0.3, 0.01), [Math.sin(-40 * D) * 0.86, 0.51, Math.cos(-40 * D) * 0.86]);
}

function r4Lights(b: Builder, s: Scheme): void {
  const y = RING_H;
  const cone = (th: number, t: number, lift: number): V3 => {
    const rr = 0.955 + (0.66 - 0.955) * t + lift * 0.86;
    const yy = y + 0.43 + (0.88 - 0.43) * t + lift * 0.51;
    return [rr * Math.sin(th * D), yy, rr * Math.cos(th * D)];
  };
  const nrm = (th: number): V3 => [Math.sin(th * D) * 0.86, 0.51, Math.cos(th * D) * 0.86];
  place(b, s.eyeLight, cylinderMD(0.035, 0.03, 10), cone(0, 0.5, 0.125), nrm(0));
  place(b, s.holo, cylinderMD(0.06, 0.03, 12), cone(38, 0.82, 0.1), nrm(38));
  place(b, s.logicA, cylinderMD(0.05, 0.03, 12), cone(-28, 0.62, 0.02), nrm(-28));
  place(b, s.logicB, cylinderMD(0.035, 0.03, 10), cone(-18, 0.72, 0.02), nrm(-18));
}

function cylinderMD(r: number, h: number, radial: number) {
  return cylinder(r, h, Math.min(0.02, r * 0.2), radial);
}
