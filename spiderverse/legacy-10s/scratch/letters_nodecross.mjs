// Hand-lettered comic display faces. Every coordinate in this file was authored here; there are
// no font files, no traced outlines and no downloaded assets anywhere in the pipeline.
//
// The letterforms are built the way a letterer builds them: a skeleton (the path the pen takes)
// plus a broad-nib width model. Width at any point is a function of the direction the pen is
// travelling, so stems come out heavy, horizontals come out thin, the "\" diagonal is nearly as
// heavy as a stem and the "/" diagonal is light. That one rule produces the thick/thin contrast,
// the tapering joins and the wedge terminals that make display onomatopoeia read as *drawn*
// rather than *set*.
//
// On top of it sit the irregularities of a human hand, all deterministic (hash2/noise keyed on
// the glyph code, so a glyph is byte-identical on every render):
//   - every stroke is tilted a degree or two off true vertical/horizontal
//   - long strokes bow
//   - the two edges of a stem are modulated independently, so they are never parallel
//   - terminals are cut along the nib angle (or flat / vertical) and flare, often asymmetrically,
//     which reads as a spur
//
// Three faces:
//   heavy  - the big display face: 30%-of-cap stems, strong contrast, wide, tight fitting
//   medium - bold but narrower and calmer
//   light  - the caption-box face: condensed, upright, near-monoline, minimal wobble
//
// Winding contract (INTERFACES.md): outer contours counter-clockwise, counters clockwise.

import { hash2, noise1, noise2, rng, clamp, smoothstep } from '/workspace/spiderverse/app/core/prng.js';

/** Glyphs are authored in a 0..1 em box with the baseline at y = 0. */
export const GLYPH_EM = 1.0;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const EPS = 1e-9;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------
// polygon helpers
// ---------------------------------------------------------------------------------------------

/** Signed area, positive for counter-clockwise. */
function signedArea(c) {
  let a = 0;
  for (let i = 0, n = c.length; i < n; i++) {
    const p = c[i];
    const q = c[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a * 0.5;
}

/** Force a contour into the requested winding. */
function orient(c, ccw) {
  return signedArea(c) >= 0 === ccw ? c : c.slice().reverse();
}

function bboxOf(contours) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
  }
  if (!Number.isFinite(x0)) return [0, 0, 0, 0];
  return [x0, y0, x1, y1];
}

/** Drop consecutive duplicates, including the wrap-around one. */
function dedupe(c, tol = 2e-6) {
  const out = [];
  for (const p of c) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > tol || Math.abs(q[1] - p[1]) > tol) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol) out.pop();
    else break;
  }
  return out;
}

/** Proper intersection point of two segments, or null (shared endpoints do not count). */
function segCross(a, b, c, d) {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-14) return null;
  const qx = c[0] - a[0];
  const qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t <= 1e-5 || t >= 1 - 1e-5 || u <= 1e-5 || u >= 1 - 1e-5) return null;
  return [a[0] + rx * t, a[1] + ry * t];
}

/**
 * Remove short self-intersecting loops. Offsetting a polyline always folds on the inside of a
 * corner tighter than the stroke's half width, and an asymmetric terminal flare can spike; both
 * show up as a small loop spanning a handful of vertices. Snipping them leaves the crisp inner
 * corner the shape wants, and keeps every contour simple, which is what the triangulator and
 * strokeOutline need.
 *
 * The window bounds how much path a single snip can swallow and `maxLoop` bounds its area, so a
 * genuine feature can never be eaten - a fold is always local.
 */
function decross(pts, window = 20, closed = false, maxLoop = 0.02) { return pts;
  let cur = pts;
  let snips = 0;
  let i = 0;
  while (snips < 240) {
    const n = cur.length;
    if (n < 5) break;
    if (i >= (closed ? n : n - 2)) break;
    const a = cur[i];
    const b = cur[(i + 1) % n];
    const kMax = Math.min(window, n - 3);
    let cut = -1;
    let X = null;
    for (let k = 2; k <= kMax; k++) {
      const j = i + k;
      if (!closed && j > n - 2) break;
      const jj = j % n;
      const x = segCross(a, b, cur[jj], cur[(jj + 1) % n]);
      if (x) {
        cut = j;
        X = x;
        break;
      }
    }
    if (cut < 0) {
      i++;
      continue;
    }
    const jj = cut % n;
    let out = null;
    if (cut < n) {
      // the fold is the run between the two crossing segments
      const loop = [X].concat(cur.slice(i + 1, cut + 1));
      if (Math.abs(signedArea(loop)) <= maxLoop) out = cur.slice(0, i + 1).concat([X], cur.slice(cut + 1));
    } else if (jj + 1 <= i) {
      // the fold straddles the array end; it is the short run, so keep the long one
      const loop = cur.slice(i + 1).concat(cur.slice(0, jj + 1), [X]);
      if (Math.abs(signedArea(loop)) <= maxLoop) out = cur.slice(jj + 1, i + 1).concat([X]);
    }
    if (!out || out.length < 4) {
      i++;
      continue;
    }
    cur = out;
    snips++;
    if (cut >= n) i = 0;
    else i = Math.max(0, i - 1);
  }
  return cur;
}

/** Rotate a closed contour so a second decross pass can see folds that straddled index 0. */
function rotate(c, k) {
  const n = c.length;
  const s = ((k % n) + n) % n;
  return c.slice(s).concat(c.slice(0, s));
}

function pointInPoly(p, c) {
  let inside = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i];
    const b = c[j];
    if (a[1] > p[1] !== b[1] > p[1]) {
      const x = a[0] + ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1] || EPS);
      if (x > p[0]) inside = !inside;
    }
  }
  return inside;
}

/** x of the point at height y on segment a->b. */
const atY = (a, b, y) => a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || EPS);

// ---------------------------------------------------------------------------------------------
// the three faces
// ---------------------------------------------------------------------------------------------

function nibWidth(f, ang) {
  const s = Math.abs(Math.sin(ang - f.pen));
  return f.thin + (f.stem - f.thin) * Math.pow(s, f.penSharp);
}

function makeFace(o) {
  const f = {
    cap: 0.72,
    ov: 0.016,
    waist: 0.525,
    stem: 0.2,
    thinRatio: 0.37,
    pen: 0.3, // nib angle in radians, ~17 degrees off horizontal
    penSharp: 1.0, // above 1 pushes horizontals thinner still
    widthScale: 1.0, // horizontal condensation
    sb: 0.026, // side bearing added to the ink width to get the advance
    asym: 1.0, // how non-parallel the two edges of a stroke are
    bowK: 1.0, // how much long strokes bow
    jitter: 1.0, // global hand wobble
    flare: 1.0, // terminal flare
    step: 0.013, // arc-length resample step in em
    serifI: true, // slab-serifed I (display faces only)
    baseOne: true, // foot bar on the figure 1
    seedOff: 0,
    ...o,
  };
  f.thin = f.stem * f.thinRatio;
  f.wv = nibWidth(f, Math.PI / 2); // vertical stem
  f.wh = nibWidth(f, 0); // horizontal bar
  f.wd = nibWidth(f, -Math.PI / 4); // "\" diagonal
  f.wu = nibWidth(f, Math.PI / 4); // "/" diagonal
  return f;
}

const FACES = {
  heavy: makeFace({
    stem: 0.216,
    thinRatio: 0.365,
    pen: 0.3,
    penSharp: 1.0,
    widthScale: 1.0,
    sb: 0.024,
    ov: 0.018,
    seedOff: 0,
  }),
  medium: makeFace({
    stem: 0.162,
    thinRatio: 0.44,
    pen: 0.31,
    penSharp: 0.95,
    widthScale: 0.865,
    sb: 0.036,
    ov: 0.015,
    asym: 0.9,
    bowK: 0.85,
    jitter: 0.85,
    flare: 0.85,
    seedOff: 41,
  }),
  light: makeFace({
    stem: 0.1,
    thinRatio: 0.84,
    pen: 0.36,
    penSharp: 0.7,
    widthScale: 0.72,
    sb: 0.055,
    ov: 0.009,
    waist: 0.535,
    asym: 0.4,
    bowK: 0.3,
    jitter: 0.5,
    flare: 0.35,
    step: 0.011,
    serifI: false,
    baseOne: false,
    seedOff: 97,
  }),
};

export const STYLES = ['heavy', 'medium', 'light'];

const faceOf = (style) => FACES[style] || FACES.heavy;
const styleName = (f) => (f === FACES.medium ? 'medium' : f === FACES.light ? 'light' : 'heavy');

// ---------------------------------------------------------------------------------------------
// skeleton processing
// ---------------------------------------------------------------------------------------------

/** Chaikin corner cutting. The third channel is the per-node width multiplier. */
function chaikin(pts, iters, closed) {
  let cur = pts;
  for (let it = 0; it < iters; it++) {
    const n = cur.length;
    if (n < 3) break;
    const out = [];
    const mixp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    if (closed) {
      for (let i = 0; i < n; i++) {
        const a = cur[i];
        const b = cur[(i + 1) % n];
        out.push(mixp(a, b, 0.25), mixp(a, b, 0.75));
      }
    } else {
      out.push(cur[0]);
      for (let i = 0; i < n - 1; i++) {
        const a = cur[i];
        const b = cur[i + 1];
        out.push(mixp(a, b, 0.25), mixp(a, b, 0.75));
      }
      out.push(cur[n - 1]);
    }
    cur = out;
  }
  return cur;
}

/** Uniform arc-length resample, width channel carried along. */
function resample(pts, step, closed) {
  const src = closed ? pts.concat([pts[0]]) : pts;
  const seg = [];
  let total = 0;
  for (let i = 0; i < src.length - 1; i++) {
    const d = Math.hypot(src[i + 1][0] - src[i][0], src[i + 1][1] - src[i][1]);
    seg.push(d);
    total += d;
  }
  if (total < EPS) return pts.slice();
  const count = Math.max(closed ? 24 : 4, Math.round(total / step));
  const out = [];
  const limit = closed ? count : count + 1;
  let si = 0;
  let acc = 0;
  for (let k = 0; k < limit; k++) {
    const target = (k / count) * total;
    while (si < seg.length - 1 && acc + seg[si] < target) {
      acc += seg[si];
      si++;
    }
    const t = seg[si] > EPS ? clamp((target - acc) / seg[si], 0, 1) : 0;
    const a = src[si];
    const b = src[si + 1];
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  }
  return out;
}

/** Periodic 1D noise (sampled around a circle) so closed loops have no seam. */
const pnoise = (t, cycles, seed) => noise2(Math.cos(t * TAU) * cycles, Math.sin(t * TAU) * cycles, seed);

/**
 * Authored stroke -> sampled pen path with tangents, normals and the per-node width multiplier
 * resolved. This is where the hand goes in: node jitter, whole-stroke tilt, bow.
 */
function penPath(stroke, f, seed) {
  const closed = !!stroke.closed;
  const src = stroke.pts;
  const wmSrc = stroke.wm;
  const jit = f.jitter * (stroke.jitter ?? 1);

  let nodes = src.map((p, i) => {
    const wm = Array.isArray(wmSrc) ? wmSrc[Math.min(i, wmSrc.length - 1)] : (wmSrc ?? 1);
    const jx = (hash2(seed + i * 1.37, 3.1) * 2 - 1) * 0.0065 * jit;
    const jy = (hash2(seed + i * 1.37, 7.7) * 2 - 1) * 0.0055 * jit;
    return [p[0] + jx, p[1] + jy, wm];
  });

  // nothing in hand lettering is exactly vertical or exactly horizontal
  if (!closed && nodes.length >= 2) {
    const rot = (hash2(seed, 11.3) * 2 - 1) * 1.6 * DEG * jit * (stroke.tilt ?? 1);
    const bb = bboxOf([nodes]);
    const cx = (bb[0] + bb[2]) * 0.5;
    const cy = (bb[1] + bb[3]) * 0.5;
    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    nodes = nodes.map((p) => {
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca, p[2]];
    });
  }

  const smooth = stroke.smooth ?? (nodes.length > 2 ? 3 : 0);
  let pts = chaikin(nodes, smooth, closed);
  pts = resample(pts, stroke.step ?? f.step, closed);

  const n = pts.length;
  const cum = new Array(n).fill(0);
  let total = 0;
  for (let i = 1; i < n; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    cum[i] = total;
  }
  if (closed) total += Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]);
  const inv = total > EPS ? 1 / total : 0;

  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = { x: pts[i][0], y: pts[i][1], wm: pts[i][2], t: closed ? i / n : cum[i] * inv };
  }

  // bow: a long stroke is drawn as a slow arc, never as a straight line
  const bowAmp = closed
    ? 0
    : (hash2(seed, 5.9) * 2 - 1) * 0.019 * f.bowK * (stroke.bow ?? 1) * Math.min(1, total / 0.35);
  if (bowAmp !== 0) {
    // normals from the chord, so bowing cannot feed back on itself
    const dx = out[n - 1].x - out[0].x;
    const dy = out[n - 1].y - out[0].y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    for (let i = 0; i < n; i++) {
      const s = out[i];
      const d = bowAmp * Math.sin(Math.PI * s.t) + 0.004 * f.bowK * noise1(s.t * 2.1 + seed, 13);
      s.x += nx * d;
      s.y += ny * d;
    }
  }

  // per-vertex tangent (central difference: smooth, good for the width model)
  for (let i = 0; i < n; i++) {
    let tx;
    let ty;
    if (!closed && i === 0) {
      tx = out[1].x - out[0].x;
      ty = out[1].y - out[0].y;
    } else if (!closed && i === n - 1) {
      tx = out[n - 1].x - out[n - 2].x;
      ty = out[n - 1].y - out[n - 2].y;
    } else {
      const a = out[(i - 1 + n) % n];
      const b = out[(i + 1) % n];
      tx = b.x - a.x;
      ty = b.y - a.y;
    }
    const l = Math.hypot(tx, ty) || 1;
    out[i].tx = tx / l;
    out[i].ty = ty / l;
    out[i].nx = -out[i].ty;
    out[i].ny = out[i].tx;
  }

  return { pts: out, closed, total };
}

/** Half widths on each side of the pen path, with flare and edge asymmetry. */
function halfWidths(path, stroke, f, seed) {
  const { pts, closed } = path;
  const base = stroke.wMul ?? 1;
  const aL = hash2(seed, 17.1) * 2 - 1;
  const aR = hash2(seed, 23.7) * 2 - 1;
  const ph = hash2(seed, 29.3) * TAU;
  const f0 = stroke.flare0 ?? 0;
  const f1 = stroke.flare1 ?? 0;
  const b0 = clamp(stroke.flare0Bias ?? 0, -0.85, 0.85);
  const b1 = clamp(stroke.flare1Bias ?? 0, -0.85, 0.85);
  const ramp = (u) => (u >= 0.2 ? 0 : Math.pow(1 - u / 0.2, 1.7));
  // rings get less edge asymmetry: on a bowl the counter-side offset is close to collapsing
  // already, and a wobble there shows up as a lumpy counter rather than as a drawn edge
  const asym = f.asym * (stroke.asym ?? 1) * (closed ? 0.5 : 1);

  const wl = new Float64Array(pts.length);
  const wr = new Float64Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const s = pts[i];
    let w = nibWidth(f, Math.atan2(s.ty, s.tx)) * base * s.wm;
    const wob = closed ? pnoise(s.t, 2.3, seed) : noise1(s.t * 2.6 + seed * 0.7, 31);
    w *= 1 + 0.05 * f.jitter * wob;
    let ml = 1;
    let mr = 1;
    if (!closed) {
      const g0 = f.flare * f0 * ramp(s.t);
      const g1 = f.flare * f1 * ramp(1 - s.t);
      ml += g0 * (1 + b0) + g1 * (1 + b1);
      mr += g0 * (1 - b0) + g1 * (1 - b1);
    }
    const env = closed ? Math.sin(s.t * TAU) : Math.sin(Math.PI * s.t);
    const nl = closed ? pnoise(s.t, 1.7, seed + 3) : noise1(s.t * 2.2 + 3.1, seed | 0);
    const nr = closed ? pnoise(s.t, 1.9, seed + 9) : noise1(s.t * 1.9 + 8.4, (seed | 0) + 5);
    const sl = 1 + asym * (0.11 * aL * env + 0.07 * nl);
    const sr = 1 + asym * (0.11 * aR * Math.sin(ph + (closed ? s.t * TAU : Math.PI * s.t)) + 0.07 * nr);
    wl[i] = Math.max(0.005, w * 0.5 * sl * ml);
    wr[i] = Math.max(0.005, w * 0.5 * sr * mr);
  }
  return { wl, wr };
}

/**
 * Offset one side of the pen path with a mitred join, so a square corner in the skeleton stays a
 * square corner in the ink instead of being chamfered by the sampling step.
 */
function offsetSide(pts, w, sign, closed, miter = 2.0) {
  const n = pts.length;
  const edges = closed ? n : n - 1;
  const en = new Array(edges);
  for (let i = 0; i < edges; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    en[i] = [-dy, dx];
  }
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const e0 = closed ? en[(i - 1 + edges) % edges] : en[Math.max(0, i - 1)];
    const e1 = closed ? en[i % edges] : en[Math.min(edges - 1, i)];
    let mx = e0[0] + e1[0];
    let my = e0[1] + e1[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-7) {
      out[i] = [pts[i].x + e1[0] * w[i] * sign, pts[i].y + e1[1] * w[i] * sign];
      continue;
    }
    mx /= ml;
    my /= ml;
    const cosHalf = mx * e0[0] + my * e0[1];
    const d = Math.min(miter, cosHalf > 1e-3 ? 1 / cosHalf : miter);
    out[i] = [pts[i].x + mx * w[i] * d * sign, pts[i].y + my * w[i] * d * sign];
  }
  return out;
}

/**
 * Shear factor for a terminal cut. `sign` is -1 at the start, +1 at the end. The cut line comes
 * out horizontal ('flat'), vertical ('vflat'), parallel to the nib ('nib'), square to the stroke
 * ('perp') or at an explicit angle.
 */
function capShear(mode, angle, s, f, sign) {
  let k = 0;
  if (mode === 'flat') k = Math.abs(s.ty) > 0.12 ? (-sign * s.ny) / s.ty : 0;
  else if (mode === 'vflat') k = Math.abs(s.tx) > 0.12 ? (-sign * s.nx) / s.tx : 0;
  else if (mode === 'nib') {
    const ux = Math.cos(f.pen);
    const uy = Math.sin(f.pen);
    const cn = s.nx * uy - s.ny * ux;
    const ct = s.tx * uy - s.ty * ux;
    k = Math.abs(ct) > 0.12 ? (-sign * cn) / ct : 0;
  } else if (mode === 'angle') k = Math.tan(angle || 0);
  return clamp(k, -1.85, 1.85);
}

/** Open stroke -> one counter-clockwise contour. */
function expandOpen(stroke, f, seed) {
  const path = penPath(stroke, f, seed);
  const { pts } = path;
  const { wl, wr } = halfWidths(path, stroke, f, seed);
  const n = pts.length;
  let left = offsetSide(pts, wl, 1, false);
  let right = offsetSide(pts, wr, -1, false);

  const jw = (a, b) => hash2(seed + a, b) * 2 - 1;
  const capAt = (i, sign, mode, angDeg, ext0) => {
    const s = pts[i];
    const ang = angDeg * DEG + jw(i + 1.1, 2.2) * 4 * DEG;
    const k = capShear(mode, ang, s, f, sign) + (mode === 'perp' ? 0 : jw(i + 2.3, 4.4) * 0.05);
    const ext = ext0 + jw(i + 3.7, 6.1) * 0.0035 * f.jitter;
    left[i] = [
      s.x + s.nx * wl[i] + sign * s.tx * (ext + wl[i] * k),
      s.y + s.ny * wl[i] + sign * s.ty * (ext + wl[i] * k),
    ];
    right[i] = [
      s.x - s.nx * wr[i] + sign * s.tx * (ext - wr[i] * k),
      s.y - s.ny * wr[i] + sign * s.ty * (ext - wr[i] * k),
    ];
  };
  capAt(0, -1, stroke.cap0 ?? 'nib', stroke.cap0Angle ?? 0, stroke.ext0 ?? 0);
  capAt(n - 1, 1, stroke.cap1 ?? 'nib', stroke.cap1Angle ?? 0, stroke.ext1 ?? 0);

  left = decross(left, 24, false);
  right = decross(right, 24, false);
  right.reverse();
  let c = dedupe(left.concat(right));
  c = decross(c, 26, true);
  c = decross(rotate(c, Math.floor(c.length / 2)), 26, true);
  return orient(dedupe(c), true);
}

/** Closed stroke (a ring) -> [outer ccw, counter cw]. */
function expandClosed(stroke, f, seed) {
  const path = penPath(stroke, f, seed);
  const { pts } = path;
  const { wl, wr } = halfWidths(path, stroke, f, seed);
  let a = offsetSide(pts, wl, 1, true);
  let b = offsetSide(pts, wr, -1, true);
  a = decross(decross(a, 26, true), 26, true);
  b = decross(decross(b, 26, true), 26, true);
  const aa = Math.abs(signedArea(a));
  const ba = Math.abs(signedArea(b));
  const outer = aa >= ba ? a : b;
  const inner = aa >= ba ? b : a;
  const res = [orient(dedupe(outer), true)];
  if (Math.abs(signedArea(inner)) > 1.5e-4) res.push(orient(dedupe(inner), false));
  return res;
}

/** A literal filled shape: dots, tittles, small marks. */
function expandPoly(stroke, f, seed) {
  const jit = f.jitter * (stroke.jitter ?? 1);
  const nodes = stroke.poly.map((p, i) => [
    p[0] + (hash2(seed + i * 2.11, 12.7) * 2 - 1) * 0.006 * jit,
    p[1] + (hash2(seed + i * 2.11, 19.3) * 2 - 1) * 0.006 * jit,
    1,
  ]);
  const sm = chaikin(nodes, stroke.smooth ?? 2, true);
  return [orient(dedupe(sm.map((p) => [p[0], p[1]])), true)];
}

// ---------------------------------------------------------------------------------------------
// authoring shorthand
// ---------------------------------------------------------------------------------------------

const S = (pts, o) => ({ pts, ...o });

/**
 * The D-shaped bowl ring used by B D P R. The left wall of the ring *is* the stem, at full stem
 * weight, so the counter is bounded by real ink and comes out full size instead of being squeezed
 * shut by a hidden inner wall. The right corners are quarter-ellipses, the left corners are tight,
 * which leaves the counter as the rounded-rectangular hole inked lettering actually has.
 *
 * o: { inkTop, inkBot, inkRight, tb|tbTop|tbBot, rT, rB, stemX, wMul }
 */
function bowlRing(g, o) {
  const m = o.wMul ?? 1;
  const tb = o.tb ?? 0.82;
  const tT = (o.tbTop ?? tb) * m;
  const tB = (o.tbBot ?? tb) * m;
  // the pen thins as it comes round the shoulder; that also keeps the counter-side offset from
  // collapsing when the bowl is short
  const tc = (o.tc ?? 0.74) * m;
  const x0 = o.stemX ?? g.hv;
  const x1 = o.inkRight - g.hv * m;
  const yT = o.inkTop - g.hh * tT;
  const yB = o.inkBot + g.hh * tB;
  const W = Math.max(0.03, x1 - x0);
  const H = Math.max(0.03, yT - yB);
  const rT = Math.min((o.rT ?? 0.5) * Math.min(W, H), W * 0.86, H * 0.45);
  const rB = Math.min((o.rB ?? 0.5) * Math.min(W, H), W * 0.86, H * 0.45);
  const rL = Math.min(0.03, W * 0.3, H * 0.2); // tight corner where the bar meets the stem
  const pts = [];
  const wm = [];
  const push = (x, y, w) => {
    pts.push([x, y]);
    wm.push(w);
  };
  // quarter arc, endpoints excluded, width easing through the shoulder weight at the midpoint
  const arc = (cx, cy, r, a0, a1, w0, w1, wMid, steps) => {
    for (let i = 1; i <= steps; i++) {
      const u = i / (steps + 1);
      const a = lerp(a0, a1, u);
      const w = u < 0.5 ? lerp(w0, wMid, u * 2) : lerp(wMid, w1, (u - 0.5) * 2);
      push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, w);
    }
  };
  const straight = (xa, ya, xb, yb, wa, wb) => {
    const n = Math.max(1, Math.round(Math.hypot(xb - xa, yb - ya) / 0.022));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      push(lerp(xa, xb, u), lerp(ya, yb, u), lerp(wa, wb, u));
    }
  };
  straight(x0 + rL, yB, x1 - rB, yB, tB, tB); // bottom bar, left to right
  arc(x1 - rB, yB + rB, rB, -Math.PI / 2, 0, tB, 1, tc, 7);
  straight(x1, yB + rB, x1, yT - rT, 1, 1); // right wall
  arc(x1 - rT, yT - rT, rT, 0, Math.PI / 2, 1, tT, tc, 7);
  straight(x1 - rT, yT, x0 + rL, yT, tT, tT); // top bar, right to left
  arc(x0 + rL, yT - rL, rL, Math.PI / 2, Math.PI, tT, 1, (tT + 1) * 0.5, 2);
  straight(x0, yT - rL, x0, yB + rL, 1, 1); // left wall: this is the stem
  arc(x0 + rL, yB + rL, rL, Math.PI, Math.PI * 1.5, 1, tB, (tB + 1) * 0.5, 2);
  return { pts, wm, closed: true, smooth: o.smooth ?? 0, ...o };
}

/**
 * A full ring: O Q 0 6 8 9. rx/ry are outer ink radii. `sq` below 1 squares the shape off, which
 * is what turns the counter from a circle into the rounded-rectangular hole comic lettering has.
 * `tb` above 0 thickens the top and bottom (tighter counter), below 0 thins them.
 */
function ring(g, cx, cy, rx, ry, o = {}) {
  const m = o.wMul ?? 1;
  const tb = o.tb ?? 0.2;
  const n = o.n ?? 52;
  const sq = o.sq ?? 0.82;
  const tilt = (o.tilt ?? 0) * DEG;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const pts = [];
  const wm = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (o.phase ?? 0);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const boost = 1 + tb * s * s;
    const rrx = rx - g.hv * m * (o.rxInset ?? 1);
    const rry = ry - g.hh * m * boost;
    const px = Math.sign(c) * Math.pow(Math.abs(c), sq) * rrx;
    const py = Math.sign(s) * Math.pow(Math.abs(s), sq) * rry;
    pts.push([cx + px * ct - py * st, cy + px * st + py * ct]);
    wm.push(boost);
  }
  return { pts, wm, closed: true, smooth: o.smooth ?? 0, ...o };
}

/** A rounded blob for dots, commas and colons. */
function blob(cx, cy, r, o = {}) {
  const sq = o.sq ?? 0.76;
  const n = o.n ?? 9;
  const ry = r * (o.ay ?? 1);
  const rot = (o.rot ?? 0) * DEG;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.31;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const px = Math.sign(c) * Math.pow(Math.abs(c), sq) * r;
    const py = Math.sign(s) * Math.pow(Math.abs(s), sq) * ry;
    pts.push([cx + px * Math.cos(rot) - py * Math.sin(rot), cy + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  return { poly: pts, smooth: o.smooth ?? 2, ...o };
}

// ---------------------------------------------------------------------------------------------
// the glyphs
// ---------------------------------------------------------------------------------------------
//
// Inside draw(g):
//   cap  cap height          ov    overshoot for round shapes
//   w    target ink width    hv/hh/hd/hu  half widths for vertical / horizontal / "\" / "/"
//   TOP/BOT  outer ink extents in y       waist  crossbar height

const GLYPHS = {
  ' ': { w: 0.3, adv: 0.34, draw: () => [] },

  A: {
    w: 0.72,
    draw: (g) => {
      const { cap, ov, w, hu, hd } = g;
      const yb = -ov * 0.35;
      const yt = cap + ov * 0.5;
      const pl = [hu * 1.0, yb];
      const al = [w * 0.483, yt];
      const ar = [w * 0.517, yt];
      const pr = [w - hd * 1.0, yb];
      const by = cap * 0.225;
      return [
        S([pl, al], { wMul: 1.0, wm: [1.04, 0.9], cap0: 'flat', cap1: 'flat', flare0: 0.2, flare0Bias: 0.75, bow: 0.5 }),
        S([ar, pr], { wMul: 1.02, wm: [0.9, 1.04], cap0: 'flat', cap1: 'flat', flare1: 0.2, flare1Bias: 0.75, bow: 0.5 }),
        S([[atY(pl, al, by) - w * 0.035, by], [atY(ar, pr, by) + w * 0.035, by * 1.04]], {
          wMul: 0.88,
          cap0: 'vflat',
          cap1: 'vflat',
        }),
      ];
    },
  },

  B: {
    w: 0.63,
    draw: (g) => {
      const { cap, w, TOP, BOT } = g;
      return [
        bowlRing(g, { inkTop: TOP, inkBot: cap * 0.52, inkRight: w * 0.93, tbTop: 0.86, tbBot: 0.68, rT: 0.6, rB: 0.5 }),
        bowlRing(g, { inkTop: cap * 0.62, inkBot: BOT, inkRight: w, tbTop: 0.68, tbBot: 0.92, rT: 0.5, rB: 0.58 }),
      ];
    },
  },

  C: {
    w: 0.66,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT } = g;
      const cx = w * 0.5;
      const rx = w * 0.5 - hv;
      const yT = TOP - hh;
      const yB = BOT + hh;
      return [
        S(
          [
            [w * 0.94, cap * 0.755],
            [cx + rx * 0.6, yT],
            [cx - rx * 0.3, yT],
            [cx - rx * 0.98, cap * 0.585],
            [cx - rx * 1.0, cap * 0.415],
            [cx - rx * 0.3, yB],
            [cx + rx * 0.6, yB],
            [w * 0.96, cap * 0.235],
          ],
          {
            smooth: 3,
            cap0: 'angle',
            cap0Angle: 32,
            cap1: 'angle',
            cap1Angle: -28,
            flare0: 0.24,
            flare0Bias: -0.55,
            flare1: 0.26,
            flare1Bias: 0.55,
          }
        ),
      ];
    },
  },

  D: {
    w: 0.68,
    draw: (g) => {
      const { w, TOP, BOT } = g;
      return [bowlRing(g, { inkTop: TOP, inkBot: BOT, inkRight: w, tb: 0.84, rT: 0.62, rB: 0.62 })];
    },
  },

  E: {
    w: 0.58,
    draw: (g) => {
      const { w, hv, hh, waist, TOP, BOT } = g;
      const sx = hv * 1.02;
      return [
        S([[sx, BOT], [sx * 1.05, TOP]], { wMul: 1.04, cap0: 'flat', cap1: 'flat' }),
        S([[sx * 0.35, TOP - hh], [w - hh * 0.5, TOP - hh * 1.05]], {
          cap0: 'vflat',
          cap1: 'vflat',
          flare1: 0.18,
          flare1Bias: -0.5,
        }),
        S([[sx * 0.7, waist], [w * 0.8, waist * 1.01]], { wMul: 0.88, cap0: 'vflat', cap1: 'angle', cap1Angle: 16 }),
        S([[sx * 0.35, BOT + hh], [w - hh * 0.4, BOT + hh * 1.06]], {
          wMul: 1.06,
          cap0: 'vflat',
          cap1: 'vflat',
          flare1: 0.18,
          flare1Bias: 0.5,
        }),
      ];
    },
  },

  F: {
    w: 0.55,
    draw: (g) => {
      const { w, hv, hh, waist, TOP, BOT } = g;
      const sx = hv * 1.02;
      return [
        S([[sx, BOT], [sx * 1.05, TOP]], { wMul: 1.04, cap0: 'flat', cap1: 'flat' }),
        S([[sx * 0.35, TOP - hh], [w - hh * 0.4, TOP - hh * 1.05]], {
          cap0: 'vflat',
          cap1: 'vflat',
          flare1: 0.2,
          flare1Bias: -0.5,
        }),
        S([[sx * 0.7, waist], [w * 0.85, waist * 1.01]], { wMul: 0.88, cap0: 'vflat', cap1: 'angle', cap1Angle: 16 }),
      ];
    },
  },

  G: {
    w: 0.68,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT } = g;
      const cx = w * 0.5;
      const rx = w * 0.5 - hv;
      const yT = TOP - hh;
      const yB = BOT + hh;
      const barY = cap * 0.34;
      const stubX = w - hv * 1.02;
      return [
        S(
          [
            [w * 0.94, cap * 0.765],
            [cx + rx * 0.58, yT],
            [cx - rx * 0.3, yT],
            [cx - rx * 0.98, cap * 0.585],
            [cx - rx * 1.0, cap * 0.415],
            [cx - rx * 0.3, yB],
            [cx + rx * 0.42, yB * 1.05],
            [stubX, cap * 0.19],
            [stubX, barY],
          ],
          { smooth: 3, cap0: 'angle', cap0Angle: 32, cap1: 'perp', flare0: 0.24, flare0Bias: -0.55 }
        ),
        S([[w * 0.47, barY], [w - hh * 0.45, barY * 1.02]], { wMul: 0.9, cap0: 'vflat', cap1: 'vflat' }),
      ];
    },
  },

  H: {
    w: 0.66,
    draw: (g) => {
      const { w, hv, waist, TOP, BOT } = g;
      return [
        S([[hv * 1.02, BOT], [hv * 1.06, TOP]], { wMul: 1.02, cap0: 'flat', cap1: 'flat' }),
        S([[w - hv * 1.06, BOT], [w - hv * 1.0, TOP]], { wMul: 1.02, cap0: 'flat', cap1: 'flat' }),
        S([[hv * 0.7, waist], [w - hv * 0.7, waist * 1.02]], { wMul: 0.9, cap0: 'vflat', cap1: 'vflat' }),
      ];
    },
  },

  I: {
    w: 0.4,
    draw: (g) => {
      const { w, hh, TOP, BOT, F } = g;
      const sx = w * 0.5;
      const out = [S([[sx, BOT], [sx * 1.04, TOP]], { wMul: 1.05, cap0: 'flat', cap1: 'flat' })];
      if (F.serifI) {
        out.push(
          S([[sx - w * 0.47, TOP - hh * 0.9], [sx + w * 0.47, TOP - hh * 0.95]], {
            wMul: 0.8,
            cap0: 'vflat',
            cap1: 'vflat',
          }),
          S([[sx - w * 0.49, BOT + hh * 0.9], [sx + w * 0.49, BOT + hh * 0.95]], {
            wMul: 0.84,
            cap0: 'vflat',
            cap1: 'vflat',
          })
        );
      }
      return out;
    },
  },

  J: {
    w: 0.54,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT } = g;
      return [
        S(
          [
            [w - hv * 1.04, TOP],
            [w - hv * 1.0, cap * 0.3],
            [w * 0.68, BOT + hh],
            [w * 0.34, BOT + hh * 1.05],
            [hv * 1.02, cap * 0.245],
          ],
          { smooth: 3, cap0: 'flat', cap1: 'angle', cap1Angle: -26, flare1: 0.2, flare1Bias: -0.4 }
        ),
      ];
    },
  },

  K: {
    w: 0.66,
    draw: (g) => {
      const { cap, w, hv, hu, hd, TOP, BOT } = g;
      const sx = hv * 1.02;
      const j = cap * 0.46;
      return [
        S([[sx, BOT], [sx * 1.05, TOP]], { wMul: 1.04, cap0: 'flat', cap1: 'flat' }),
        S([[sx + hv * 0.35, j + cap * 0.035], [w - hu * 0.85, TOP - hu * 0.1]], {
          wMul: 1.24,
          wm: [1.0, 0.92],
          cap0: 'perp',
          cap1: 'vflat',
          flare1: 0.18,
          flare1Bias: 0.45,
          bow: 0.35,
        }),
        S([[sx + hv * 0.3, j * 0.96], [w - hd * 0.85, BOT + hd * 0.1]], {
          wMul: 1.0,
          wm: [0.88, 1.06],
          cap0: 'perp',
          cap1: 'flat',
          flare1: 0.14,
          flare1Bias: 0.45,
          bow: 0.35,
        }),
      ];
    },
  },

  L: {
    w: 0.55,
    draw: (g) => {
      const { w, hv, hh, TOP, BOT } = g;
      const sx = hv * 1.02;
      return [
        S([[sx, BOT], [sx * 1.05, TOP]], { wMul: 1.04, cap0: 'flat', cap1: 'flat' }),
        S([[sx * 0.35, BOT + hh], [w - hh * 0.4, BOT + hh * 1.06]], {
          wMul: 1.04,
          cap0: 'vflat',
          cap1: 'vflat',
          flare1: 0.2,
          flare1Bias: 0.5,
        }),
      ];
    },
  },

  M: {
    w: 0.9,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT } = g;
      const lx = hv * 1.02;
      const rx = w - hv * 1.02;
      const vy = cap * 0.14;
      return [
        S([[lx * 0.9, BOT], [lx * 1.14, TOP]], { wMul: 0.98, cap0: 'flat', cap1: 'flat' }),
        S([[rx * 1.008, BOT], [rx * 0.982, TOP]], { wMul: 0.98, cap0: 'flat', cap1: 'flat' }),
        S([[lx * 1.06, TOP - hh * 0.25], [w * 0.5 - w * 0.013, vy]], {
          wMul: 0.96,
          cap0: 'flat',
          cap1: 'perp',
          bow: 0.35,
        }),
        S([[w * 0.5 + w * 0.013, vy], [rx * 0.99, TOP - hh * 0.25]], {
          wMul: 1.2,
          cap0: 'perp',
          cap1: 'flat',
          bow: 0.35,
        }),
      ];
    },
  },

  N: {
    w: 0.7,
    draw: (g) => {
      const { w, hv, hh, TOP, BOT } = g;
      const lx = hv * 1.02;
      const rx = w - hv * 1.02;
      return [
        S([[lx, BOT], [lx * 1.05, TOP]], { wMul: 0.95, cap0: 'flat', cap1: 'flat' }),
        S([[rx, BOT], [rx * 1.002, TOP]], { wMul: 0.95, cap0: 'flat', cap1: 'flat' }),
        S([[lx * 0.97, TOP - hh * 0.15], [rx * 1.01, BOT + hh * 0.15]], {
          wMul: 1.02,
          cap0: 'flat',
          cap1: 'flat',
          bow: 0.3,
        }),
      ];
    },
  },

  O: {
    w: 0.75,
    draw: (g) => {
      const { cap, w, ov } = g;
      return [ring(g, w * 0.5, cap * 0.5, w * 0.5, cap * 0.5 + ov, { sq: 0.8, tilt: -2.5, tb: 0.2, phase: 0.14 })];
    },
  },

  P: {
    w: 0.62,
    draw: (g) => {
      const { cap, w, hv, TOP, BOT } = g;
      return [
        S([[hv, BOT], [hv * 1.03, cap * 0.5]], { wMul: 1.02, cap0: 'flat', cap1: 'perp' }),
        bowlRing(g, { inkTop: TOP, inkBot: cap * 0.4, inkRight: w, tbTop: 0.86, tbBot: 0.78, rT: 0.6, rB: 0.52 }),
      ];
    },
  },

  Q: {
    w: 0.75,
    draw: (g) => {
      const { cap, w, ov, hd } = g;
      return [
        ring(g, w * 0.5, cap * 0.5, w * 0.5, cap * 0.5 + ov, { sq: 0.8, tilt: -2.5, tb: 0.2, phase: 0.14 }),
        S([[w * 0.54, cap * 0.26], [w * 0.98, -ov - hd * 0.25]], {
          wMul: 1.05,
          wm: [0.72, 1.08],
          cap0: 'perp',
          cap1: 'nib',
          flare1: 0.2,
          flare1Bias: 0.4,
        }),
      ];
    },
  },

  R: {
    w: 0.66,
    draw: (g) => {
      const { cap, w, hv, hd, TOP, BOT } = g;
      const by = cap * 0.44;
      return [
        S([[hv, BOT], [hv * 1.03, cap * 0.54]], { wMul: 1.02, cap0: 'flat', cap1: 'perp' }),
        bowlRing(g, { inkTop: TOP, inkBot: by, inkRight: w * 0.96, tbTop: 0.86, tbBot: 0.76, rT: 0.6, rB: 0.5 }),
        S([[w * 0.44, by + cap * 0.055], [w - hd * 0.88, BOT + hd * 0.1]], {
          wMul: 1.04,
          wm: [0.86, 1.06],
          cap0: 'perp',
          cap1: 'flat',
          flare1: 0.16,
          flare1Bias: 0.45,
          bow: 0.4,
        }),
      ];
    },
  },

  S: {
    w: 0.62,
    draw: (g) => {
      const { cap, w, hh, TOP, BOT } = g;
      const yT = TOP - hh;
      const yB = BOT + hh;
      return [
        S(
          [
            [w * 0.93, cap * 0.775],
            [w * 0.7, yT],
            [w * 0.4, yT * 1.002],
            [w * 0.12, cap * 0.755],
            [w * 0.155, cap * 0.6],
            [w * 0.42, cap * 0.5],
            [w * 0.68, cap * 0.4],
            [w * 0.865, cap * 0.245],
            [w * 0.6, yB],
            [w * 0.3, yB * 1.05],
            [w * 0.07, cap * 0.225],
          ],
          {
            smooth: 3,
            cap0: 'angle',
            cap0Angle: 30,
            cap1: 'angle',
            cap1Angle: 30,
            flare0: 0.26,
            flare0Bias: -0.55,
            flare1: 0.26,
            flare1Bias: -0.55,
          }
        ),
      ];
    },
  },

  T: {
    w: 0.64,
    draw: (g) => {
      const { w, hh, TOP, BOT } = g;
      const sx = w * 0.5;
      return [
        S([[hh * 0.35, TOP - hh], [w - hh * 0.35, TOP - hh * 1.06]], {
          wMul: 0.96,
          cap0: 'vflat',
          cap1: 'vflat',
          flare0: 0.16,
          flare0Bias: -0.55,
          flare1: 0.16,
          flare1Bias: 0.55,
        }),
        S([[sx * 0.98, BOT], [sx * 1.02, TOP - hh * 0.35]], {
          wMul: 1.04,
          wm: [1.03, 0.93],
          cap0: 'flat',
          cap1: 'perp',
        }),
      ];
    },
  },

  U: {
    w: 0.68,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT } = g;
      const lx = hv * 1.02;
      const rx = w - hv * 1.02;
      return [
        S(
          [
            [lx * 0.98, TOP],
            [lx * 1.04, cap * 0.28],
            [w * 0.3, BOT + hh],
            [w * 0.7, BOT + hh * 1.02],
            [rx * 0.99, cap * 0.28],
            [rx, TOP],
          ],
          { smooth: 3, cap0: 'flat', cap1: 'flat', flare0: 0.14, flare1: 0.14 }
        ),
      ];
    },
  },

  V: {
    w: 0.68,
    draw: (g) => {
      const { w, ov, hd, hu, TOP } = g;
      const bx = w * 0.5;
      const by = -ov * 0.3;
      return [
        S([[hd * 1.0, TOP], [bx - w * 0.009, by]], {
          wMul: 1.02,
          cap0: 'flat',
          cap1: 'flat',
          flare0: 0.18,
          flare0Bias: -0.7,
          bow: 0.5,
        }),
        S([[bx + w * 0.009, by], [w - hu * 1.0, TOP]], {
          wMul: 1.2,
          cap0: 'flat',
          cap1: 'flat',
          flare1: 0.18,
          flare1Bias: 0.7,
          bow: 0.5,
        }),
      ];
    },
  },

  W: {
    w: 0.94,
    draw: (g) => {
      const { cap, w, ov, hd, hu, TOP } = g;
      const by = -ov * 0.3;
      const p1 = w * 0.285;
      const p2 = w * 0.715;
      const mid = cap * 0.88;
      return [
        S([[hd * 1.0, TOP], [p1, by]], {
          wMul: 1.0,
          cap0: 'flat',
          cap1: 'flat',
          flare0: 0.18,
          flare0Bias: -0.7,
          bow: 0.35,
        }),
        S([[p1 + w * 0.005, by * 0.9], [w * 0.5 - w * 0.007, mid]], { wMul: 1.16, cap0: 'flat', cap1: 'flat', bow: 0.35 }),
        S([[w * 0.5 + w * 0.007, mid], [p2 - w * 0.005, by * 0.9]], { wMul: 1.0, cap0: 'flat', cap1: 'flat', bow: 0.35 }),
        S([[p2, by], [w - hu * 1.0, TOP]], {
          wMul: 1.18,
          cap0: 'flat',
          cap1: 'flat',
          flare1: 0.18,
          flare1Bias: 0.7,
          bow: 0.35,
        }),
      ];
    },
  },

  X: {
    w: 0.68,
    draw: (g) => {
      const { hd, hu, TOP, BOT, w } = g;
      return [
        S([[hd * 1.0, TOP], [w - hd * 1.0, BOT]], {
          wMul: 1.0,
          cap0: 'flat',
          cap1: 'flat',
          flare0: 0.16,
          flare1: 0.16,
          bow: 0.35,
        }),
        S([[hu * 1.0, BOT], [w - hu * 1.0, TOP]], {
          wMul: 1.18,
          cap0: 'flat',
          cap1: 'flat',
          flare0: 0.18,
          flare1: 0.18,
          bow: 0.35,
        }),
      ];
    },
  },

  Y: {
    w: 0.67,
    draw: (g) => {
      const { cap, w, hd, hu, TOP, BOT } = g;
      const jy = cap * 0.41;
      const jx = w * 0.5;
      return [
        S([[hd * 1.0, TOP], [jx - w * 0.006, jy]], {
          wMul: 1.0,
          cap0: 'flat',
          cap1: 'perp',
          flare0: 0.18,
          flare0Bias: -0.7,
          bow: 0.35,
        }),
        S([[jx + w * 0.006, jy], [w - hu * 1.0, TOP]], {
          wMul: 1.16,
          cap0: 'perp',
          cap1: 'flat',
          flare1: 0.18,
          flare1Bias: 0.7,
          bow: 0.35,
        }),
        S([[jx * 0.99, BOT], [jx * 1.01, jy + cap * 0.05]], { wMul: 1.04, cap0: 'flat', cap1: 'perp' }),
      ];
    },
  },

  Z: {
    w: 0.63,
    draw: (g) => {
      const { w, hh, hu, TOP, BOT } = g;
      const yT = TOP - hh;
      const yB = BOT + hh;
      return [
        S([[hh * 0.35, yT], [w - hh * 0.4, yT * 1.01]], {
          wMul: 0.96,
          cap0: 'vflat',
          cap1: 'vflat',
          flare0: 0.16,
          flare0Bias: 0.5,
        }),
        S([[w - hu * 0.45, TOP - hu * 0.15], [hu * 0.45, BOT + hu * 0.15]], {
          wMul: 1.4,
          cap0: 'flat',
          cap1: 'flat',
          bow: 0.4,
        }),
        S([[hh * 0.35, yB], [w - hh * 0.4, yB * 1.05]], {
          wMul: 1.04,
          cap0: 'vflat',
          cap1: 'vflat',
          flare1: 0.16,
          flare1Bias: -0.5,
        }),
      ];
    },
  },

  0: {
    w: 0.64,
    draw: (g) => {
      const { cap, w, ov } = g;
      return [ring(g, w * 0.5, cap * 0.5, w * 0.5, cap * 0.5 + ov, { sq: 0.86, tilt: -2, tb: 0.1, phase: 0.2 })];
    },
  },

  1: {
    w: 0.46,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT, F } = g;
      const sx = w * 0.62;
      const out = [
        S([[sx, BOT], [sx * 1.02, TOP]], { wMul: 1.04, cap0: 'flat', cap1: 'flat' }),
        S([[hv * 0.6, cap * 0.75], [sx - hv * 0.25, TOP - hv * 0.1]], {
          wMul: 1.05,
          wm: [0.7, 1.0],
          cap0: 'angle',
          cap0Angle: -28,
          cap1: 'perp',
        }),
      ];
      if (F.baseOne) {
        out.push(
          S([[hh * 0.45, BOT + hh], [w - hh * 0.45, BOT + hh * 1.05]], { wMul: 0.9, cap0: 'vflat', cap1: 'vflat' })
        );
      }
      return out;
    },
  },

  2: {
    w: 0.62,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT } = g;
      const yT = TOP - hh;
      return [
        S(
          [
            [hv * 1.02, cap * 0.755],
            [w * 0.3, yT],
            [w * 0.66, yT * 0.99],
            [w * 0.9, cap * 0.675],
            [w * 0.74, cap * 0.46],
            [w * 0.36, cap * 0.265],
            [hh * 0.95, BOT + hh * 1.15],
          ],
          { smooth: 3, cap0: 'angle', cap0Angle: -32, cap1: 'vflat', flare0: 0.22, flare0Bias: 0.5 }
        ),
        S([[hh * 0.35, BOT + hh], [w - hh * 0.4, BOT + hh * 1.06]], {
          wMul: 1.02,
          cap0: 'vflat',
          cap1: 'vflat',
          flare1: 0.16,
          flare1Bias: -0.5,
        }),
      ];
    },
  },

  3: {
    w: 0.61,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT } = g;
      const yT = TOP - hh;
      const yB = BOT + hh;
      return [
        S(
          [
            [hv * 0.9, cap * 0.8],
            [w * 0.32, yT],
            [w * 0.66, yT * 0.995],
            [w * 0.87, cap * 0.655],
            [w * 0.48, cap * 0.53],
            [w * 0.9, cap * 0.345],
            [w * 0.68, yB],
            [w * 0.3, yB * 1.04],
            [hv * 0.85, cap * 0.2],
          ],
          {
            smooth: 3,
            cap0: 'angle',
            cap0Angle: -30,
            cap1: 'angle',
            cap1Angle: 28,
            flare0: 0.2,
            flare0Bias: 0.5,
            flare1: 0.2,
            flare1Bias: -0.5,
          }
        ),
      ];
    },
  },

  4: {
    w: 0.68,
    draw: (g) => {
      const { cap, w, hv, hh, hu, TOP, BOT } = g;
      const barY = cap * 0.22;
      const sx = w * 0.72;
      return [
        S([[sx, BOT], [sx * 0.995, TOP - hh * 0.3]], { wMul: 1.02, cap0: 'flat', cap1: 'perp' }),
        S([[sx - hv * 0.4, TOP - hu * 0.15], [hu * 0.75, barY - hh * 0.1]], {
          wMul: 1.1,
          cap0: 'flat',
          cap1: 'perp',
          bow: 0.3,
        }),
        S([[hh * 0.3, barY], [w - hh * 0.5, barY * 1.04]], { wMul: 0.9, cap0: 'vflat', cap1: 'vflat' }),
      ];
    },
  },

  5: {
    w: 0.61,
    draw: (g) => {
      const { cap, w, hv, hh, TOP, BOT } = g;
      const yT = TOP - hh;
      const yB = BOT + hh;
      return [
        S([[hv * 1.02, cap * 0.52], [hv * 1.06, TOP - hh * 0.5]], { wMul: 1.0, cap0: 'perp', cap1: 'perp' }),
        S([[hv * 0.45, yT], [w * 0.92, yT * 1.01]], {
          wMul: 0.92,
          cap0: 'vflat',
          cap1: 'vflat',
          flare1: 0.18,
          flare1Bias: -0.5,
        }),
        S(
          [
            [hv * 1.0, cap * 0.55],
            [w * 0.48, cap * 0.545],
            [w * 0.88, cap * 0.395],
            [w * 0.66, yB],
            [w * 0.28, yB * 1.05],
            [hv * 0.85, cap * 0.195],
          ],
          { smooth: 3, cap0: 'perp', cap1: 'angle', cap1Angle: 28, flare1: 0.2, flare1Bias: -0.5 }
        ),
      ];
    },
  },

  6: {
    w: 0.64,
    draw: (g) => {
      const { cap, w, hv, ov } = g;
      const ry = cap * 0.345;
      return [
        ring(g, w * 0.5, ry - ov * 0.5, w * 0.5, ry, { sq: 0.85, tilt: -2, tb: -0.1, phase: 0.2 }),
        S([[w * 0.9, cap * 0.85], [w * 0.5, cap + ov * 0.4], [hv * 1.0, cap * 0.62], [hv * 1.02, cap * 0.44]], {
          smooth: 3,
          cap0: 'angle',
          cap0Angle: 28,
          cap1: 'perp',
          flare0: 0.22,
          flare0Bias: -0.5,
        }),
      ];
    },
  },

  7: {
    w: 0.61,
    draw: (g) => {
      const { w, hh, hu, TOP, BOT } = g;
      const yT = TOP - hh;
      return [
        S([[hh * 0.35, yT], [w - hh * 0.45, yT * 1.01]], {
          wMul: 0.94,
          cap0: 'vflat',
          cap1: 'vflat',
          flare0: 0.16,
          flare0Bias: 0.5,
        }),
        S([[w - hu * 0.8, TOP - hu * 0.25], [w * 0.2, BOT + hu * 0.15]], {
          wMul: 1.28,
          wm: [1.0, 0.92],
          cap0: 'flat',
          cap1: 'flat',
          bow: 0.45,
        }),
      ];
    },
  },

  8: {
    w: 0.66,
    draw: (g) => {
      const { cap, w, ov, TOP, BOT } = g;
      const upTop = TOP;
      const upBot = cap * 0.52;
      const loTop = cap * 0.6;
      const loBot = BOT;
      return [
        ring(g, w * 0.5, (upTop + upBot) * 0.5, w * 0.44, (upTop - upBot) * 0.5, {
          sq: 0.84,
          tilt: -2,
          tb: -0.32,
          phase: 0.2,
        }),
        ring(g, w * 0.5, (loTop + loBot) * 0.5, w * 0.5, (loTop - loBot) * 0.5, {
          sq: 0.84,
          tilt: -2,
          tb: -0.3,
          phase: 0.2,
        }),
      ];
    },
  },

  9: {
    w: 0.64,
    draw: (g) => {
      const { cap, w, hv, ov } = g;
      const ry = cap * 0.345;
      const cy = cap - ry + ov * 0.5;
      return [
        ring(g, w * 0.5, cy, w * 0.5, ry, { sq: 0.85, tilt: -2, tb: -0.1, phase: 0.2 }),
        S([[hv * 1.1, cap * 0.145], [w * 0.5, -ov * 0.4], [w - hv * 1.0, cap * 0.38], [w - hv * 1.02, cap * 0.56]], {
          smooth: 3,
          cap0: 'angle',
          cap0Angle: 28,
          cap1: 'perp',
          flare0: 0.22,
          flare0Bias: 0.5,
        }),
      ];
    },
  },

  '.': {
    w: 0.22,
    adv: 0.3,
    draw: (g) => {
      const r = g.hv * 1.1;
      return [blob(g.w * 0.5, r * 0.96, r, { ay: 0.92, rot: 8 })];
    },
  },

  ',': {
    w: 0.26,
    adv: 0.32,
    draw: (g) => {
      const { cap, w, hv } = g;
      const r = hv * 1.04;
      return [
        blob(w * 0.56, r * 1.05, r, { ay: 0.96, rot: -6 }),
        S([[w * 0.56, r * 1.25], [w * 0.44, -cap * 0.04], [w * 0.16, -cap * 0.2]], {
          wMul: 1.0,
          wm: [1.0, 0.6, 0.12],
          smooth: 2,
          cap0: 'perp',
          cap1: 'nib',
          jitter: 0.5,
        }),
      ];
    },
  },

  '!': {
    w: 0.3,
    adv: 0.35,
    draw: (g) => {
      const { cap, w, hv, TOP } = g;
      const sx = w * 0.54;
      const r = hv * 1.02;
      return [
        S([[sx * 1.05, TOP], [sx * 0.97, cap * 0.28]], {
          wMul: 1.14,
          wm: [1.1, 0.48],
          cap0: 'flat',
          cap1: 'perp',
        }),
        blob(w * 0.46, r * 0.96, r, { ay: 0.92, rot: 10 }),
      ];
    },
  },

  '?': {
    w: 0.56,
    adv: 0.59,
    draw: (g) => {
      const { cap, w, hv, hh, TOP } = g;
      const r = hv * 1.02;
      return [
        S(
          [
            [hv * 0.85, cap * 0.775],
            [w * 0.3, TOP - hh],
            [w * 0.7, TOP - hh * 0.98],
            [w * 0.9, cap * 0.675],
            [w * 0.66, cap * 0.49],
            [w * 0.5, cap * 0.38],
            [w * 0.48, cap * 0.29],
          ],
          { smooth: 3, cap0: 'angle', cap0Angle: -30, cap1: 'flat', flare0: 0.22, flare0Bias: 0.5 }
        ),
        blob(w * 0.44, r * 0.96, r, { ay: 0.92, rot: -8 }),
      ];
    },
  },

  "'": {
    w: 0.26,
    adv: 0.29,
    draw: (g) => {
      const { cap, w, TOP } = g;
      const sx = w * 0.5;
      return [
        S([[sx * 1.06, TOP], [sx * 0.88, cap * 0.62]], {
          wMul: 1.06,
          wm: [1.08, 0.38],
          cap0: 'flat',
          cap1: 'nib',
          jitter: 0.6,
        }),
      ];
    },
  },

  '-': {
    w: 0.42,
    adv: 0.46,
    draw: (g) => {
      const { cap, w, hh } = g;
      const y = cap * 0.4;
      return [
        S([[hh * 0.3, y], [w - hh * 0.3, y * 1.07]], { wMul: 1.1, wm: [0.9, 0.9], cap0: 'vflat', cap1: 'vflat' }),
      ];
    },
  },

  ':': {
    w: 0.22,
    adv: 0.3,
    draw: (g) => {
      const { cap, w, hv } = g;
      const r = hv * 1.06;
      return [
        blob(w * 0.5, r * 0.96, r, { ay: 0.92, rot: 8 }),
        blob(w * 0.54, cap * 0.5 + r * 0.2, r, { ay: 0.92, rot: -10 }),
      ];
    },
  },
};

// ---------------------------------------------------------------------------------------------
// getGlyph
// ---------------------------------------------------------------------------------------------

const cache = new Map();

/**
 * Build one glyph. Contours are in em space, baseline y = 0, ink starting at x = 0; outer contours
 * counter-clockwise, counters clockwise. Returns null outside the authored set.
 *
 * The returned object is shared (cached); treat it as immutable. layoutWord, strokeOutline and
 * roughenContours all return fresh arrays.
 */
export function getGlyph(ch, style = 'heavy') {
  if (typeof ch !== 'string' || ch.length === 0) return null;
  const key = ch.toUpperCase();
  const f = faceOf(style);
  const ck = `${key}|${styleName(f)}`;
  const hit = cache.get(ck);
  if (hit !== undefined) return hit;

  const def = GLYPHS[key];
  if (!def) {
    cache.set(ck, null);
    return null;
  }

  const g = {
    F: f,
    cap: f.cap,
    ov: f.ov,
    w: def.w * f.widthScale,
    hv: f.wv * 0.5,
    hh: f.wh * 0.5,
    hd: f.wd * 0.5,
    hu: f.wu * 0.5,
    waist: f.cap * f.waist,
    TOP: f.cap + f.ov * 0.5,
    BOT: -f.ov * 0.5,
  };

  const code = key.charCodeAt(0);
  const strokes = def.draw(g) || [];
  const contours = [];
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    const seed = code * 3.117 + i * 7.311 + f.seedOff;
    if (s.poly) contours.push(...expandPoly(s, f, seed));
    else if (s.closed) contours.push(...expandClosed(s, f, seed));
    else contours.push(expandOpen(s, f, seed));
  }

  // ink starts at x = 0; the advance comes from the measured ink plus the side bearing
  const bb = bboxOf(contours);
  const shift = contours.length ? -bb[0] : 0;
  if (shift !== 0) for (const c of contours) for (const p of c) p[0] += shift;
  const inkW = contours.length ? bb[2] - bb[0] : def.w * f.widthScale;
  const advance = contours.length
    ? Math.max(def.adv !== undefined ? def.adv * f.widthScale : inkW + f.sb, inkW + f.sb * 0.45)
    : def.adv * f.widthScale;

  const out = {
    ch: key,
    contours,
    advance,
    cap: f.cap,
    inkWidth: inkW,
    bbox: contours.length ? [0, bb[1], inkW, bb[3]] : [0, 0, 0, 0],
  };
  cache.set(ck, out);
  return out;
}

/** The authored character set, in specimen order. */
export function characterSet() {
  return Object.keys(GLYPHS).filter((k) => k !== ' ');
}

// ---------------------------------------------------------------------------------------------
// layoutWord
// ---------------------------------------------------------------------------------------------

/**
 * Lay a word out the way a letterer does: every letter a slightly different size, rotated a few
 * degrees alternately, sitting above or below a baseline that itself wanders, with optional banner
 * curvature.
 *
 * opts: { seed, jitter, arc, tracking, style, origin, baselineWander }
 *   seed     instance seed; the same seed always gives the same layout
 *   jitter   0 disables all wobble, 1 is the house amount, above 1 exaggerates
 *   arc      total sweep in radians across the word (negative arcs the ends downward)
 *   tracking extra advance per letter, in em
 *   origin   'center' (default) centres the word on its bounding box, 'left' keeps the pen origin
 *
 * Returns { contours, width, height, bbox, cap, perLetter }. Each perLetter entry carries the
 * letter's local contours plus its transform, so the FX layer can animate letters individually
 * (the pop-in on 2s) without re-running layout.
 */
export function layoutWord(text, opts = {}) {
  const {
    seed = 1,
    jitter = 1,
    arc = 0,
    tracking = 0,
    style = 'heavy',
    origin = 'center',
    baselineWander = 1,
  } = opts;
  const f = faceOf(style);
  const src = String(text ?? '').toUpperCase();

  // pass one: advances
  const items = [];
  let pen = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const gl = getGlyph(ch, style);
    if (!gl) continue;
    const s = 1 + (hash2(seed * 1.7 + i * 5.31, 2.9) * 2 - 1) * 0.075 * jitter;
    items.push({ ch, gl, scale: s, x: pen, adv: gl.advance * s + tracking, ink: gl.contours.length > 0 });
    pen += gl.advance * s + tracking;
  }
  const runW = pen || 0.001;

  const perLetter = [];
  const contours = [];
  let li = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.ink) continue; // spaces advance the pen but are not animatable letters
    const gl = it.gl;
    const bb = gl.bbox;
    // pivot: the letter's ink centre, so rotation and the pop-in scale feel centred
    const px = bb[0] + (bb[2] - bb[0]) * 0.5;
    const py = f.cap * 0.44;

    // alternating rotation is the tell of hand lettering; a little noise on top of it
    const alt = li % 2 === 0 ? 1 : -1;
    const rotDeg =
      jitter * (alt * (2.4 + hash2(seed + i * 3.13, 41.7) * 3.6) + (hash2(seed + i * 3.13, 57.1) * 2 - 1) * 1.8);
    const mid = (it.x + it.adv * 0.5) / runW;
    const drift = noise1(mid * 2.3 + seed * 0.37, 71) * 0.028 * f.cap * baselineWander * jitter;
    const hop = (hash2(seed + i * 9.77, 13.9) * 2 - 1) * 0.02 * f.cap * baselineWander * jitter;
    const scale = it.scale;

    let tx = it.x + px * scale;
    let ty = drift + hop;
    let rot = rotDeg * DEG;

    if (arc) {
      // the letter centre rides a circular arc of total sweep `arc` across the run
      const u = mid - 0.5;
      const a = u * arc;
      const radius = runW / arc;
      tx = runW * 0.5 + radius * Math.sin(a);
      ty = -radius + radius * Math.cos(a) + drift + hop;
      rot += a;
    }

    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    const local = [];
    const placed = [];
    for (const c of gl.contours) {
      const lc = new Array(c.length);
      const pc = new Array(c.length);
      for (let k = 0; k < c.length; k++) {
        const dx = c[k][0] - px;
        const dy = c[k][1] - py;
        lc[k] = [dx, dy];
        const sx = dx * scale;
        const sy = dy * scale;
        pc[k] = [tx + sx * ca - sy * sa, ty + py * scale + sx * sa + sy * ca];
      }
      local.push(lc);
      placed.push(pc);
    }

    perLetter.push({
      ch: it.ch,
      index: li,
      textIndex: i,
      x: tx,
      y: ty + py * scale,
      rot,
      rotDeg,
      scale,
      advance: it.adv,
      cap: f.cap,
      pivot: [px, py],
      local,
      contours: placed,
      bbox: bboxOf(placed),
    });
    for (const c of placed) contours.push(c);
    li++;
  }

  // pop-in order: letters do not all appear left to right
  const order = perLetter.map((p) => p.index).sort((a, b) => hash2(seed + a, 3.7) - hash2(seed + b, 3.7));
  for (let i = 0; i < order.length; i++) perLetter[order[i]].popOrder = i;

  const bb = bboxOf(contours);
  let ox = 0;
  let oy = 0;
  if (origin === 'center' && contours.length) {
    ox = -(bb[0] + bb[2]) * 0.5;
    oy = -(bb[1] + bb[3]) * 0.5;
    for (const c of contours) {
      for (const p of c) {
        p[0] += ox;
        p[1] += oy;
      }
    }
    for (const pl of perLetter) {
      pl.x += ox;
      pl.y += oy;
      pl.bbox = [pl.bbox[0] + ox, pl.bbox[1] + oy, pl.bbox[2] + ox, pl.bbox[3] + oy];
    }
  }

  return {
    contours,
    width: bb[2] - bb[0],
    height: bb[3] - bb[1],
    bbox: [bb[0] + ox, bb[1] + oy, bb[2] + ox, bb[3] + oy],
    cap: f.cap,
    perLetter,
    text: src,
    style,
  };
}

// ---------------------------------------------------------------------------------------------
// strokeOutline
// ---------------------------------------------------------------------------------------------

/**
 * Offset contours outward by `width` em. The offset direction comes from the edge winding, so
 * counter-clockwise outers grow and clockwise counters shrink: exactly what a keyline needs, since
 * the black layer is a fatter letter with a tighter counter. Stack a few at decreasing widths for
 * the classic drop / keyline / coloured rim / face sandwich.
 */
export function strokeOutline(contours, width, opts = {}) {
  const miter = opts.miter ?? 2.4;
  const out = [];
  for (const src of contours) {
    const c = dedupe(src);
    const n = c.length;
    if (n < 3) continue;
    const ccw = signedArea(c) >= 0;
    const res = [];
    for (let i = 0; i < n; i++) {
      const p = c[i];
      const prev = c[(i - 1 + n) % n];
      const next = c[(i + 1) % n];
      // the outward normal of edge a->b is (dy, -dx) for ccw contours; the same expression
      // shrinks clockwise contours, which is what holes want
      let e0x = p[0] - prev[0];
      let e0y = p[1] - prev[1];
      let e1x = next[0] - p[0];
      let e1y = next[1] - p[1];
      const l0 = Math.hypot(e0x, e0y) || 1;
      const l1 = Math.hypot(e1x, e1y) || 1;
      e0x /= l0;
      e0y /= l0;
      e1x /= l1;
      e1y /= l1;
      const n0x = e0y;
      const n0y = -e0x;
      const n1x = e1y;
      const n1y = -e1x;
      let mx = n0x + n1x;
      let my = n0y + n1y;
      const ml = Math.hypot(mx, my);
      if (ml < 1e-6) {
        res.push([p[0] + n0x * width, p[1] + n0y * width]);
        res.push([p[0] + n1x * width, p[1] + n1y * width]);
        continue;
      }
      mx /= ml;
      my /= ml;
      const cosHalf = mx * n0x + my * n0y;
      const scale = cosHalf > 1e-4 ? 1 / cosHalf : miter;
      if (scale > miter) {
        res.push([p[0] + n0x * width, p[1] + n0y * width]);
        res.push([p[0] + n1x * width, p[1] + n1y * width]);
      } else {
        res.push([p[0] + mx * width * scale, p[1] + my * width * scale]);
      }
    }
    let cleaned = dedupe(res);
    if (cleaned.length < 3) continue;
    cleaned = decross(cleaned, 26, true);
    cleaned = decross(rotate(cleaned, Math.floor(cleaned.length / 2)), 26, true);
    cleaned = dedupe(cleaned);
    if (cleaned.length < 3) continue;
    const a = signedArea(cleaned);
    // a counter that has closed up (or inverted) under the offset is simply gone
    if (!ccw && (a >= 0 || Math.abs(a) < 2.5e-5)) continue;
    if (ccw && a <= 0) continue;
    out.push(cleaned);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// roughenContours
// ---------------------------------------------------------------------------------------------

/**
 * Resample every contour finely and push each sample along its normal by deterministic noise, so
 * the edge reads as inked rather than as vector. Two octaves: a slow drift the way a brush wanders,
 * a faster chatter for the nib.
 *
 * The noise is sampled in *glyph space* rather than along the arc length. That matters: both sides
 * of a thin stroke are spatially close, so they get nearly the same displacement and the stroke
 * shifts instead of pinching shut. It also makes the wobble seamless at the contour start and
 * consistent between the letter and the keyline offset drawn around it.
 */
export function roughenContours(contours, amount = 0.006, seed = 1) {
  if (!(amount > 0)) return contours.map((c) => c.map((p) => [p[0], p[1]]));
  const step = Math.max(0.005, Math.min(0.03, amount * 2.4));
  const s = seed * 1.913;
  const out = [];
  for (const raw of contours) {
    const src = dedupe(raw);
    if (src.length < 3) continue;
    const pts = src.concat([src[0]]);
    const seg = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      seg.push(d);
      total += d;
    }
    if (total < 1e-5) continue;
    const count = Math.max(12, Math.round(total / step));
    const rs = [];
    let si = 0;
    let acc = 0;
    for (let k = 0; k < count; k++) {
      const target = (k / count) * total;
      while (si < seg.length - 1 && acc + seg[si] < target) {
        acc += seg[si];
        si++;
      }
      const t = seg[si] > 1e-9 ? clamp((target - acc) / seg[si], 0, 1) : 0;
      rs.push([lerp(pts[si][0], pts[si + 1][0], t), lerp(pts[si][1], pts[si + 1][1], t)]);
    }
    const m = rs.length;
    const res = new Array(m);
    for (let k = 0; k < m; k++) {
      const a = rs[(k - 1 + m) % m];
      const b = rs[(k + 1) % m];
      let tx = b[0] - a[0];
      let ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const x = rs[k][0];
      const y = rs[k][1];
      const slow = noise2(x * 3.1, y * 3.1, s);
      const fast = noise2(x * 12.7, y * 12.7, s + 37.3);
      const d = amount * (0.66 * slow + 0.34 * fast);
      const tg = amount * 0.28 * noise2(x * 7.3 + 11.2, y * 7.3 - 4.1, s + 71.9);
      res[k] = [x + ty * d + tx * tg, y - tx * d + ty * tg];
    }
    let c = decross(res, 22, true);
    c = decross(rotate(c, Math.floor(c.length / 2)), 22, true);
    c = dedupe(c);
    if (c.length < 3) continue;
    out.push(orient(c, signedArea(src) >= 0));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// triangulate: ear clipping with hole bridging
// ---------------------------------------------------------------------------------------------

const cross3 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function inTriangle(a, b, c, p) {
  return cross3(a, b, p) > 0 && cross3(b, c, p) > 0 && cross3(c, a, p) > 0;
}

/** Splice one hole into a polygon with a two-way bridge. Outer ccw, hole cw. */
function bridgeHole(poly, hole) {
  let mi = 0;
  for (let i = 1; i < hole.length; i++) if (hole[i][0] > hole[mi][0]) mi = i;
  const M = hole[mi];

  // cast a ray from M along +x and take the nearest polygon edge it crosses
  let bestDx = Infinity;
  let bestEdge = -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (a[1] > M[1] === b[1] > M[1]) continue;
    const t = (M[1] - a[1]) / (b[1] - a[1] || EPS);
    const dx = a[0] + t * (b[0] - a[0]) - M[0];
    if (dx > -1e-9 && dx < bestDx) {
      bestDx = dx;
      bestEdge = i;
    }
  }

  let pi;
  if (bestEdge < 0) {
    let bd = Infinity;
    pi = 0;
    for (let i = 0; i < poly.length; i++) {
      const d = (poly[i][0] - M[0]) ** 2 + (poly[i][1] - M[1]) ** 2;
      if (d < bd) {
        bd = d;
        pi = i;
      }
    }
  } else {
    const a = poly[bestEdge];
    const b = poly[(bestEdge + 1) % poly.length];
    pi = a[0] > b[0] ? bestEdge : (bestEdge + 1) % poly.length;
    const I = [M[0] + bestDx, M[1]];
    // a reflex vertex inside the triangle M-I-P would block the bridge; prefer the one at the
    // smallest angle to +x
    let bestAng = Infinity;
    let bestLen = Infinity;
    const n = poly.length;
    const P = poly[pi];
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      if (p[0] < M[0]) continue;
      const prev = poly[(i - 1 + n) % n];
      const next = poly[(i + 1) % n];
      if (cross3(prev, p, next) > 0) continue; // convex, cannot block
      if (!inTriangle(M, I, P, p) && !inTriangle(M, P, I, p)) continue;
      const dx = p[0] - M[0];
      const dy = p[1] - M[1];
      const len = Math.hypot(dx, dy);
      const ang = len > 1e-9 ? Math.abs(Math.atan2(dy, dx)) : 0;
      if (ang < bestAng - 1e-6 || (Math.abs(ang - bestAng) <= 1e-6 && len < bestLen)) {
        bestAng = ang;
        bestLen = len;
        pi = i;
      }
    }
  }

  const merged = [];
  for (let i = 0; i <= pi; i++) merged.push(poly[i]);
  for (let k = 0; k < hole.length; k++) merged.push(hole[(mi + k) % hole.length]);
  merged.push(hole[mi]);
  merged.push(poly[pi]);
  for (let i = pi + 1; i < poly.length; i++) merged.push(poly[i]);
  return merged;
}

function earClip(poly, tris) {
  const n = poly.length;
  if (n < 3) return;
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  let guard = 0;
  const maxGuard = n * n + 128;
  while (idx.length > 3 && guard++ < maxGuard) {
    const m = idx.length;
    let cut = -1;
    for (let i = 0; i < m; i++) {
      const i0 = idx[(i - 1 + m) % m];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % m];
      const a = poly[i0];
      const b = poly[i1];
      const c = poly[i2];
      if (cross3(a, b, c) <= 1e-12) continue;
      let ok = true;
      for (let k = 0; k < m; k++) {
        const j = idx[k];
        if (j === i0 || j === i1 || j === i2) continue;
        if (inTriangle(a, b, c, poly[j])) {
          ok = false;
          break;
        }
      }
      if (ok) {
        cut = i;
        tris.push(i0, i1, i2);
        break;
      }
    }
    if (cut < 0) {
      // no valid ear (usually duplicate vertices from a bridge); clip the most convex corner
      let best = -1;
      let bestC = -Infinity;
      for (let i = 0; i < m; i++) {
        const cr = cross3(poly[idx[(i - 1 + m) % m]], poly[idx[i]], poly[idx[(i + 1) % m]]);
        if (cr > bestC) {
          bestC = cr;
          best = i;
        }
      }
      if (best < 0) break;
      if (bestC > 1e-12) {
        tris.push(idx[(best - 1 + m) % m], idx[best], idx[(best + 1) % m]);
      }
      cut = best;
    }
    idx.splice(cut, 1);
  }
  if (idx.length === 3 && cross3(poly[idx[0]], poly[idx[1]], poly[idx[2]]) > 1e-12) {
    tris.push(idx[0], idx[1], idx[2]);
  }
}

/**
 * Triangulate a glyph or a laid-out word, cutting counters out. Holes are matched to the tightest
 * outer contour that contains them, bridged in, and the merged simple polygon is ear-clipped.
 * Positions are xy pairs (components: 2); z is the caller's business.
 */
export function triangulate(contours) {
  const outers = [];
  const holes = [];
  for (const raw of contours) {
    const c = dedupe(raw);
    if (c.length < 3) continue;
    const a = signedArea(c);
    if (Math.abs(a) < 1e-7) continue;
    if (a > 0) outers.push({ pts: c, area: a, holes: null });
    else holes.push(c);
  }

  for (const h of holes) {
    let best = -1;
    let bestArea = Infinity;
    const probe = h[0];
    for (let i = 0; i < outers.length; i++) {
      if (outers[i].area >= bestArea) continue;
      if (pointInPoly(probe, outers[i].pts)) {
        best = i;
        bestArea = outers[i].area;
      }
    }
    if (best >= 0) (outers[best].holes || (outers[best].holes = [])).push(h);
  }

  const positions = [];
  const indices = [];
  for (const o of outers) {
    let poly = o.pts;
    if (o.holes && o.holes.length) {
      const maxX = (c) => {
        let x = -Infinity;
        for (const p of c) if (p[0] > x) x = p[0];
        return x;
      };
      for (const h of o.holes.slice().sort((a, b) => maxX(b) - maxX(a))) poly = bridgeHole(poly, h);
    }
    const tris = [];
    earClip(poly, tris);
    const base = positions.length / 2;
    for (const p of poly) positions.push(p[0], p[1]);
    for (const t of tris) indices.push(base + t);
  }

  const vertexCount = positions.length / 2;
  const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
  return {
    positions: new Float32Array(positions),
    indices: new IndexArray(indices),
    components: 2,
    vertexCount,
    triangleCount: indices.length / 3,
  };
}

// ---------------------------------------------------------------------------------------------
// odds and ends the FX layer finds useful
// ---------------------------------------------------------------------------------------------

/** Net signed area of a contour set: outers minus counters. Used by the self-tests. */
export function contourArea(contours) {
  let a = 0;
  for (const c of contours) a += signedArea(c);
  return a;
}

/** Re-place contours without re-running layout (pop-in, style-break offsets, and so on). */
export function transformContours(contours, { x = 0, y = 0, rot = 0, scale = 1 } = {}) {
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  return contours.map((c) =>
    c.map((p) => {
      const sx = p[0] * scale;
      const sy = p[1] * scale;
      return [x + sx * ca - sy * sa, y + sx * sa + sy * ca];
    })
  );
}

export { smoothstep };
