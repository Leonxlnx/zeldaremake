import { Group, Object3D } from 'three';
import { Builder } from '../core/builder';
import type { V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import type { SmallCraft } from './types';
import { DEG, ball, boxAt, cylAt, emit, frame, lathePts, lerpTable, newTally, pivot, rod } from './c-kit';

/**
 * Droid tri-fighter (~16 studs across the arm tips): a banded core ball with two red
 * photoreceptors and a nose cannon in the gaps between three sickle arms at 120° (one straight
 * up). Each arm leaves the back of the core, sweeps out and curls forward to a laser cannon; it is
 * built from chamfered segments with a light grey outer rim, reddish brown sawtooth panels,
 * radiator ribs on the inner edge and an engine at the root. +Z forward, origin at the core
 * centre. LOD 1 keeps the silhouette and colours with unchamfered, low-segment parts.
 */

const CORE_R = 2.0;
/** Arm panel and sawtooth colours (the film prop uses blue-grey panels with white teeth). */
const PANEL: ColorKey = 'reddishBrown';
const TEETH: ColorKey = 'lbg';
const ARM_ANGLES = [90, 210, 330].map((d) => d * DEG);
const EYE_ANGLES = [30, 150].map((d) => d * DEG);
const EYE_POLAR = 38 * DEG;
const NOSE: V3 = [0, -1.3, 1.6];
/** Arm plate thickness. */
const T = 0.8;
/** Arm centre line: a quarter ellipse in the arm plane [ρ, z] from behind the core to the tip. */
const ARC = { r: 1.5, z: 1.5, ar: 5.5, az: 3.1, t0: -95 * DEG, t1: 0 };
/** Tip cannon housing centre and engine axis, [ρ, z] on the canonical (upward) arm. */
const TIP: [number, number] = [7.4, 1.8];
const ENGINE: [number, number] = [1.45, -2.25];

type P2 = [number, number];

/** [arc length, ellipse parameter] rows so arm stations are spaced evenly along the arc. */
const ARC_ROWS: number[][] = (() => {
  const rows = [[0, ARC.t0]];
  for (let i = 1; i <= 96; i++) {
    const t = ARC.t0 + ((ARC.t1 - ARC.t0) * i) / 96, u = rows[i - 1][1];
    rows.push([rows[i - 1][0] + Math.hypot(ARC.ar * (Math.cos(t) - Math.cos(u)), ARC.az * (Math.sin(t) - Math.sin(u))), t]);
  }
  return rows;
})();
const ARC_LEN = ARC_ROWS[ARC_ROWS.length - 1][0];

/** Centre-line point, outward normal and half-width of the arm band at arc fraction s. */
function station(s: number): { p: P2; n: P2; w: number } {
  const t = lerpTable(ARC_ROWS, s * ARC_LEN)[0];
  const nx = ARC.az * Math.cos(t), nz = ARC.ar * Math.sin(t), l = Math.hypot(nx, nz);
  return { p: [ARC.r + ARC.ar * Math.cos(t), ARC.z + ARC.az * Math.sin(t)], n: [nx / l, nz / l], w: 0.75 + 0.25 * s * s };
}

/** Point at signed distance d from the centre line (+ outward). */
function at(s: number, d: number): P2 {
  const { p, n } = station(s);
  return [p[0] + n[0] * d, p[1] + n[1] * d];
}

/** Quads of the band between offsets lo(w) and hi(w), s0 → s1 in n segments. */
function strip(s0: number, s1: number, n: number, lo: (w: number) => number, hi: (w: number) => number): P2[][] {
  const out: P2[][] = [];
  for (let i = 0; i < n; i++) {
    const a = s0 + ((s1 - s0) * i) / n, c = s0 + ((s1 - s0) * (i + 1)) / n;
    const wa = station(a).w, wc = station(c).w;
    out.push([at(a, lo(wa)), at(a, hi(wa)), at(c, hi(wc)), at(c, lo(wc))]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// core

/** Sphere profile points (r, z) from polar angle a0 to a1 (degrees from the nose), radius r. */
function arc(a0: number, a1: number, r: number, step = 6): number[][] {
  const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step));
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    out.push([r * Math.sin(a), r * Math.cos(a)]);
  }
  return out;
}

/** A raised band on the sphere between two polar angles (steps up at both ends). */
function band(a0: number, a1: number, lift: number, step: number): number[][] {
  const lo = arc(a0, a1, CORE_R, step), hi = arc(a0, a1, CORE_R + lift, step);
  return [lo[0], ...hi, lo[lo.length - 1]];
}

function core(b: Builder, lod: 0 | 1): void {
  const st = lod ? 15 : 5, radial = lod ? 12 : 32;
  const sec: [ColorKey, number[][]][] = lod
    ? [
        ['gunmetal', arc(0, 50, CORE_R, st)],
        ['dbg', arc(50, 88, CORE_R, st)],
        ['gunmetal', band(88, 100, 0.05, 12)],
        ['dbg', arc(100, 180, CORE_R, st)],
      ]
    : [
        ['gunmetal', arc(0, 50, CORE_R, st)],
        ['dbg', band(50, 55, 0.06, 2.5)],
        ['dbg', arc(55, 88, CORE_R, st)],
        ['gunmetal', band(88, 100, 0.05, 4)],
        ['dbg', arc(100, 141, CORE_R, st)],
      ];
  for (const [key, pts] of sec) lathePts(b, key, pts, { axis: 'z', radial, crease: 40 });

  // photoreceptors in the two upper gaps: gunmetal socket, black well, glowing core under a red lens
  for (const phi of EYE_ANGLES) {
    const d: V3 = [Math.cos(phi) * Math.sin(EYE_POLAR), Math.sin(phi) * Math.sin(EYE_POLAR), Math.cos(EYE_POLAR)];
    b.push();
    b.apply(frame([d[0] * (CORE_R - 0.08), d[1] * (CORE_R - 0.08), d[2] * (CORE_R - 0.08)], d));
    if (lod) ball(b, 'glowRed', [0, 0, 0.1], 0.5, 8, 4);
    else {
      lathePts(b, 'gunmetal', [[0.5, 0.26], [0.64, 0.26], [0.72, 0.18], [0.72, -0.1]], { axis: 'z', radial: 20, crease: 40 });
      lathePts(b, 'black', [[0, 0.12], [0.5, 0.12], [0.5, 0.26]], { axis: 'z', radial: 20, crease: 40 });
      const cap = 0.22, base = 0.5, rc = (base * base + cap * cap) / (2 * cap), zc = 0.12 + cap - rc;
      const amax = Math.asin(base / rc), dome: number[][] = [];
      for (let i = 0; i <= 5; i++) dome.push([rc * Math.sin((amax * i) / 5), zc + rc * Math.cos((amax * i) / 5)]);
      lathePts(b, 'trRed', dome, { axis: 'z', radial: 20, crease: 60 });
      ball(b, 'glowRed', [0, 0, 0.14], 0.3, 12, 6);
    }
    b.pop();
  }

  // nose cannon in the lower gap
  const [, ny, nz] = NOSE;
  b.box('gunmetal', 0, ny, nz, 0.72, 0.6, 1.0, { c: lod ? 0 : 0.06 });
  rod(b, 'gunmetal', [0, ny, nz + 0.4], [0, ny, 3.55], 0.13, { radial: lod ? 6 : 10 });
  if (!lod) {
    rod(b, 'flatSilver', [0, ny, 3.45], [0, ny, 3.82], 0.18, { radial: 12 });
    rod(b, 'flatSilver', [0, ny, 2.35], [0, ny, 2.5], 0.17, { radial: 12 });
    rod(b, 'black', [0, ny - 0.22, 2.0], [0, ny - 0.22, 2.9], 0.06, { radial: 6 });
    b.box('lbg', 0, ny + 0.36, nz - 0.1, 0.5, 0.12, 0.6, { c: 0.03 });
    // vent grilles on the rear half, in the gaps between the arms
    for (const phi of [30, 150, 270].map((d) => d * DEG)) {
      const pol = 114 * DEG;
      const n: V3 = [Math.cos(phi) * Math.sin(pol), Math.sin(phi) * Math.sin(pol), Math.cos(pol)];
      b.push();
      b.apply(frame([n[0] * (CORE_R - 0.02), n[1] * (CORE_R - 0.02), n[2] * (CORE_R - 0.02)], n, [0, 0, 1]));
      b.box('gunmetal', 0, 0, 0.04, 0.95, 0.75, 0.14, { c: 0.03 });
      for (let k = 0; k < 4; k++) b.box('black', 0, -0.24 + k * 0.16, 0.12, 0.75, 0.07, 0.04, { c: 0 });
      b.pop();
    }
    // rear hub with a ring of studs
    lathePts(b, 'gunmetal', [[1.3, -1.52], [1.3, -2.2], [1.0, -2.42], [0, -2.42]], { axis: 'z', radial: 24, crease: 35 });
    b.push();
    b.rotateX(-Math.PI / 2);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.stud('dbg', Math.cos(a) * 0.62, 2.42, Math.sin(a) * 0.62);
    }
    b.pop();
  }
}

// ---------------------------------------------------------------------------------------------
// arm, canonical: reaching up (+Y = ρ), forward +Z, plate thickness along X

function arm(b: Builder, lod: 0 | 1): void {
  const segs = lod ? 4 : 8;
  b.push();
  // side outlines [ρ, z] become [−z, ρ] under the quarter turn and extrude across X
  b.rotateY(Math.PI / 2);
  const side = (key: ColorKey, pts: P2[], w: number, o: { c?: number; zc?: number } = {}) => b.prism(key, pts.map(([r, z]) => [-z, r]), w, o);
  for (const q of strip(0, 1, segs, (w) => -w, (w) => w)) side('dbg', q, T, { c: lod ? 0 : 0.1 });
  for (const q of strip(1 / segs, 1, segs - 1, (w) => w - 0.24, (w) => w + 0.03)) side('lbg', q, T + 0.12, { c: lod ? 0 : 0.04 });
  if (lod) {
    for (const q of strip(0.24, 0.95, 3, (w) => 0.3 - w, (w) => w - 0.3)) side(PANEL, q, T + 0.03, { c: 0 });
  } else {
    const panel = strip(0.24, 0.95, 6, (w) => 0.3 - w, (w) => w - 0.3);
    const K = 7;
    for (const sg of [1, -1]) {
      for (const q of panel) side(PANEL, q, 0.04, { c: 0, zc: sg * (T / 2 + 0.015) });
      // sawtooth: teeth standing on the outer edge of the panel
      for (let k = 0; k < K; k++) {
        const a = 0.26 + (0.67 * k) / K, e = 0.26 + (0.67 * (k + 1)) / K, m = (a + e) / 2;
        side(TEETH, [at(a, station(a).w - 0.36), at(e, station(e).w - 0.36), at(m, 0.36 - station(m).w)], 0.02, { c: 0, zc: sg * (T / 2 + 0.04) });
      }
    }
  }
  b.pop();

  if (!lod) {
    // radiator ribs along the inner edge and a clamp collar where the arm leaves the core
    for (let k = 0; k < 6; k++) {
      const s = 0.17 + k * 0.055;
      const { n, w } = station(s);
      const [r, z] = at(s, -w - 0.08);
      boxAt(b, 'black', [0, r, z], [0, -n[0], -n[1]], [1, 0, 0], 0.13, T - 0.14, 0.34, { c: 0.02 });
    }
    const c0 = station(0.14);
    boxAt(b, 'gunmetal', [0, c0.p[0], c0.p[1]], [0, -c0.n[1], c0.n[0]], [1, 0, 0], 2 * c0.w + 0.2, T + 0.18, 0.42, { c: 0.05 });
  }

  // tip cannon on the forward end cap
  const [tr, tz] = TIP;
  b.box('gunmetal', 0, tr, tz, 0.6, 0.66, 0.9, { c: lod ? 0 : 0.06 });
  rod(b, 'gunmetal', [0, tr, tz + 0.4], [0, tr, tz + 1.75], 0.11, { radial: lod ? 6 : 10 });
  if (!lod) {
    rod(b, 'flatSilver', [0, tr, tz + 1.62], [0, tr, tz + 1.95], 0.16, { radial: 12 });
    rod(b, 'flatSilver', [0, tr, tz + 0.75], [0, tr, tz + 0.88], 0.15, { radial: 12 });
    b.box('gunmetal', 0, 6.55, 1.53, T + 0.12, 1.0, 0.1, { c: 0.02 });
    for (const z of [tz - 0.2, tz + 0.2]) b.stud('gunmetal', 0, tr + 0.33, z);
  }

  // engine in the root, exhaust facing aft
  const [er, ez] = ENGINE;
  cylAt(b, 'gunmetal', [0, er, ez], [0, 0, 1], 0.46, 1.1, { radial: lod ? 8 : 16 });
  if (!lod) cylAt(b, 'gunmetal', [0, er, ez - 0.42], [0, 0, 1], 0.54, 0.2, { radial: 16 });
  cylAt(b, 'glowOrange', [0, er, ez - 0.57], [0, 0, 1], 0.36, 0.04, { radial: lod ? 8 : 16 });
}

// ---------------------------------------------------------------------------------------------

export function triFighter(o: { lod?: 0 | 1; seed?: number } = {}): SmallCraft {
  const lod = o.lod ?? 0;
  const seed = o.seed ?? 1;
  const group = new Group();
  group.name = lod ? 'trifighter-lod1' : 'trifighter';
  const tally = newTally();
  const b = new Builder({ seed, studSegments: lod ? 6 : 10, chamfer: lod ? 0 : 0.035 });
  core(b, lod);
  for (const a of ARM_ANGLES) {
    b.push();
    b.rotateZ(a - Math.PI / 2);
    arm(b, lod);
    b.pop();
  }
  emit(b, group.name, group, tally);

  const muzzles: Object3D[] = [pivot('muzzle', group, 0, NOSE[1], 3.9)];
  const engines: Object3D[] = [];
  for (const a of ARM_ANGLES) {
    const p = (r: number, z: number): V3 => [Math.cos(a) * r, Math.sin(a) * r, z];
    muzzles.push(pivot('muzzle', group, ...p(TIP[0], TIP[1] + 2.0)));
    const e = pivot('engine', group, ...p(ENGINE[0], ENGINE[1] - 0.6));
    e.rotation.y = Math.PI;
    engines.push(e);
  }
  group.userData.triangles = tally.tris;
  group.userData.drawCalls = tally.calls;
  group.userData.span = 2 * (ARC.r + ARC.ar + station(1).w);
  return { group, length: 6.8, muzzles, engines };
}
