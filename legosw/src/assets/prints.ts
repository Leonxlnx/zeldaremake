import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { Rng } from '../core/rng';

/**
 * Pad-printed decoration for minifigures, drawn with Canvas2D in the flat, crisp style of licensed
 * LEGO prints: faces (with animatable expressions), torsos and leg prints. Line work is built from
 * tapered brush strokes, the way the print artwork is drawn.
 *
 * Head texture: 2048 × 1024 over the front of the head — u = 0.5 is the nose direction and the
 * texture spans ±FACE_ARC head units of arc to either side (the back of the head clamps to plain
 * skin) — and the head's full height; 1 head unit = FACE_PX px both ways, so nothing is distorted.
 */
export const FACE_W = 2048;
export const FACE_H = 1024;
export const HEAD_H = 1.08;
export const FACE_PX = FACE_H / HEAD_H;
/** half the printed arc around the head, head units */
export const FACE_ARC = FACE_W / FACE_PX / 2;

export type Mouth = 'smile' | 'smirk' | 'grin' | 'open' | 'talk' | 'o' | 'grit' | 'frown' | 'shout' | 'flat' | 'worry';

export interface FaceState {
  mouth: Mouth;
  /** −1 = angry/focused (inner ends down) … +1 = worried (inner ends up) */
  brows: number;
  /** pupil look offset, head units (±0.03 reasonable) */
  lookX: number;
  lookY: number;
  /** 0 open … 1 closed */
  blink: number;
  /** squint 0..1 (lower lids up) */
  squint: number;
}

export const NEUTRAL: FaceState = { mouth: 'smile', brows: 0, lookX: 0, lookY: 0, blink: 0, squint: 0 };

export interface FaceStyle {
  skin: string;
  brow: string;
  line: string;
  beard?: { color: string; dark: string; light: string };
  scar?: boolean;
  cheekLines?: boolean;
  stubble?: boolean;
  /** crow's feet and under-eye lines */
  age?: boolean;
  /** how far smiles and grins lift toward the figure's left (0 … 1) */
  lopsided?: number;
  /** eye half-width and half-height, head units (default 0.058 × 0.076) */
  eye?: [number, number];
}

const INK = '#15110e';
const MOUTH = '#4a0e10';
const TONGUE = '#b3403d';
const TEETH = '#ffffff';

type Pt = [number, number];

/** head-unit coordinates → canvas (x = arc distance from the nose, y = height above the neck) */
function P(x: number, y: number): Pt {
  return [FACE_W / 2 + x * FACE_PX, (HEAD_H - y) * FACE_PX];
}
const px = (v: number) => v * FACE_PX;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A print's coordinate frame: figure units → canvas px, and px per unit. */
interface Space {
  P(x: number, y: number): Pt;
  k: number;
}
const FACE: Space = { P, k: FACE_PX };

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  const [cx, cy] = P(x, y);
  g.beginPath();
  g.ellipse(cx, cy, px(rx), px(ry), rot, 0, Math.PI * 2);
}

function shapePath(g: CanvasRenderingContext2D, S: Space, pts: Pt[], close = false) {
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const [cx, cy] = S.P(x, y);
    if (i === 0) g.moveTo(cx, cy);
    else g.lineTo(cx, cy);
  });
  if (close) g.closePath();
}

function path(g: CanvasRenderingContext2D, pts: Pt[], close = false) {
  shapePath(g, FACE, pts, close);
}

const mv = (g: CanvasRenderingContext2D, p: Pt) => g.moveTo(...P(...p));
const quadTo = (g: CanvasRenderingContext2D, c: Pt, p: Pt) => g.quadraticCurveTo(...P(...c), ...P(...p));
const cubicTo = (g: CanvasRenderingContext2D, c1: Pt, c2: Pt, p: Pt) => g.bezierCurveTo(...P(...c1), ...P(...c2), ...P(...p));

/**
 * A tapered brush stroke along the quadratic a → (c) → b, filled in the current fillStyle; the width
 * runs w0 → w1 (middle) → w2 with round ends.
 */
function brush(g: CanvasRenderingContext2D, a: Pt, c: Pt, b: Pt, w0: number, w1: number, w2: number): void {
  taper(g, FACE, a, c, b, w0, w1, w2);
}

function taper(g: CanvasRenderingContext2D, S: Space, a: Pt, c: Pt, b: Pt, w0: number, w1: number, w2: number): void {
  const n = 22;
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    const x = s * s * a[0] + 2 * s * t * c[0] + t * t * b[0];
    const y = s * s * a[1] + 2 * s * t * c[1] + t * t * b[1];
    const dx = 2 * s * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const dy = 2 * s * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const l = Math.hypot(dx, dy) || 1;
    const w = Math.max(0, s * (1 - 2 * t) * w0 + 4 * t * s * w1 + t * (2 * t - 1) * w2) / 2;
    L.push([x - (dy / l) * w, y + (dx / l) * w]);
    R.push([x + (dy / l) * w, y - (dx / l) * w]);
  }
  shapePath(g, S, [...L, ...R.reverse()], true);
  g.fill();
  for (const [p, w] of [
    [a, w0],
    [b, w2],
  ] as const) {
    if (w > 0.003) {
      const [cx, cy] = S.P(p[0], p[1]);
      g.beginPath();
      g.arc(cx, cy, (w / 2) * S.k, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/* ------------------------------------------------------------------ faces */

/** Mouth placement: its line height and the extent of what it draws (for the beard's lip patch). */
interface MouthGeo {
  m: Mouth;
  y0: number;
  top: number;
  bottom: number;
  half: number;
  lop: number;
}

function mouthGeo(m: Mouth, style: FaceStyle): MouthGeo {
  const y0 = style.beard ? 0.312 : 0.33;
  const ext: Record<Mouth, [number, number, number]> = {
    smile: [0.065, -0.085, 0.14],
    smirk: [0.09, -0.07, 0.16],
    flat: [0.012, -0.03, 0.1],
    frown: [0.03, -0.04, 0.11],
    grin: [0.05, -0.064, 0.16],
    talk: [0.028, -0.055, 0.092],
    open: [0.034, -0.095, 0.116],
    o: [0.042, -0.066, 0.05],
    grit: [0.04, -0.052, 0.18],
    shout: [0.05, -0.13, 0.146],
    worry: [0.024, -0.082, 0.1],
  };
  const [t, b, h] = ext[m];
  return { m, y0, top: y0 + t, bottom: y0 + b, half: h, lop: style.lopsided ?? 0 };
}

export function drawFace(g: CanvasRenderingContext2D, style: FaceStyle, s: FaceState): void {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = style.skin;
  g.fillRect(0, 0, FACE_W, FACE_H);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const mg = mouthGeo(s.mouth, style);
  drawSkinLines(g, style, s, mg);
  if (style.beard) {
    g.drawImage(beardLayer(style), 0, 0);
    lipPatch(g, style, mg);
  }
  drawEyes(g, style, s);
  drawBrows(g, style, s);
  drawMouth(g, style, mg, false);
  if (style.beard) drawMoustache(g, style, mg);
  g.restore();
}

/** Nose, cheek and expression lines, the scar: everything printed in the skin-line colour. */
function drawSkinLines(g: CanvasRenderingContext2D, style: FaceStyle, s: FaceState, mg: MouthGeo): void {
  g.fillStyle = style.line;
  // nose
  brush(g, [-0.03, 0.478], [0.0, 0.448], [0.034, 0.472], 0.002, 0.0105, 0.002);
  if (style.cheekLines) {
    // cheekbones
    g.globalAlpha = 0.45;
    for (const sgn of [-1, 1]) brush(g, [sgn * 0.262, 0.486], [sgn * 0.286, 0.47], [sgn * 0.298, 0.446], 0, 0.0065, 0);
    g.globalAlpha = 1;
  }
  if (style.age) {
    // a curved line under each eye (the licensed Obi-Wan print has no crow's feet: they read as lashes)
    g.globalAlpha = 0.85;
    for (const sgn of [-1, 1]) brush(g, [sgn * 0.13, 0.51], [sgn * 0.2, 0.482], [sgn * 0.27, 0.512], 0, 0.009, 0);
    g.globalAlpha = 1;
  }
  // smile folds from the nose round the mouth corners
  const fold: Partial<Record<Mouth, number>> = { smile: 0.4, smirk: 0.55, grin: 0.85, open: 0.55, shout: 0.85, talk: 0.35, grit: 0.7 };
  const fa = fold[s.mouth] ?? 0;
  if (fa > 0 && !style.beard) {
    g.globalAlpha = fa;
    for (const sgn of [-1, 1]) {
      if (s.mouth === 'smirk' && sgn < 0) continue;
      const lift = sgn * mg.lop * 0.02;
      brush(g, [sgn * 0.112, 0.458], [sgn * 0.192, 0.418 + lift], [sgn * 0.176, mg.y0 - 0.005 + lift], 0.001, 0.009, 0);
    }
    g.globalAlpha = 1;
  }
  // frown furrows between the brows, worry lines on the forehead
  if (s.brows < -0.4) {
    g.globalAlpha = Math.min(1, (-s.brows - 0.4) * 2);
    for (const sgn of [-1, 1]) brush(g, [sgn * 0.034, 0.83], [sgn * 0.048, 0.775], [sgn * 0.03, 0.725], 0, 0.009, 0);
    g.globalAlpha = 1;
  }
  if (s.brows > 0.5) {
    g.globalAlpha = Math.min(0.85, (s.brows - 0.5) * 2);
    for (const yy of [0.9, 0.948]) brush(g, [-0.13, yy - 0.01], [0, yy + 0.014], [0.13, yy - 0.01], 0, 0.008, 0);
    g.globalAlpha = 1;
  }
  if (style.stubble) {
    g.fillStyle = 'rgba(120,80,60,0.10)';
    path(g, [[-0.44, 0.42], [-0.3, 0.12], [0, 0.05], [0.3, 0.12], [0.44, 0.42], [0.3, 0.3], [0, 0.26], [-0.3, 0.3]], true);
    g.fill();
  }
}

function drawEyes(g: CanvasRenderingContext2D, style: FaceStyle, s: FaceState): void {
  const blink = clamp(s.blink, 0, 1), sq = clamp(s.squint, 0, 1);
  const [rx, ry] = style.eye ?? [0.058, 0.076];
  for (const sgn of [-1, 1]) {
    const cx = sgn * 0.2 + s.lookX * 0.45, cy = 0.6 + s.lookY * 0.45;
    // the lids: the upper comes down to blink, the lower rises to squint
    const up = cy + ry * (1.12 - 2.35 * blink) - ry * 0.3 * sq;
    const lo = cy - ry * (1.12 - 2.0 * sq);
    // a faint crease over the lid
    g.fillStyle = style.line;
    g.globalAlpha = 0.4;
    brush(g, [cx - sgn * 0.034, cy + ry + 0.028 - blink * 0.01], [cx + sgn * 0.022, cy + ry + 0.05 + s.brows * 0.008], [cx + sgn * 0.078, cy + ry - 0.004], 0, 0.0085, 0.002);
    g.globalAlpha = 1;
    if (up - lo < 0.022) {
      // closed: the lid line, bowed down
      g.fillStyle = INK;
      const yl = cy - ry * 0.3;
      brush(g, [cx - 0.058, yl + 0.012], [cx, yl - 0.03], [cx + 0.058, yl + 0.012], 0.006, 0.019, 0.006);
      continue;
    }
    const ku = ry * 0.3, kl = ry * 0.26, ew = rx * 1.5;
    g.save();
    g.beginPath();
    mv(g, [cx - ew, up - ku]);
    quadTo(g, [cx, up + ku], [cx + ew, up - ku]);
    g.lineTo(...P(cx + ew, lo + kl));
    quadTo(g, [cx, lo - kl], [cx - ew, lo + kl]);
    g.closePath();
    g.clip();
    g.fillStyle = INK;
    ellipse(g, cx, cy, rx, ry);
    g.fill();
    // one printed catchlight, the same in both eyes
    g.fillStyle = TEETH;
    const gx = cx - s.lookX * 0.15, gy = cy - s.lookY * 0.15;
    ellipse(g, gx - rx * 0.26, gy + ry * 0.34, rx * 0.42, Math.min(rx, ry) * 0.5);
    g.fill();
    g.restore();
    // lid edges where they cut the eye
    const cut = (yy: number, k: number, sign: 1 | -1) => {
      const f = clamp((yy - cy) / ry, -1, 1);
      const wh = Math.min(ew, rx * Math.sqrt(1 - f * f) * 1.12 + 0.006);
      const d = k * (wh / ew) * (wh / ew);
      return { a: [cx - wh, yy - sign * d] as Pt, c: [cx, yy + sign * d] as Pt, b: [cx + wh, yy - sign * d] as Pt };
    };
    if (up < cy + ry * 0.97) {
      const { a, c, b } = cut(up, ku, 1);
      g.fillStyle = INK;
      brush(g, a, c, b, 0.006, 0.015, 0.009);
    }
    if (lo > cy - ry * 0.95) {
      const { a, c, b } = cut(lo, kl, -1);
      g.fillStyle = style.line;
      brush(g, a, c, b, 0.002, 0.008, 0.002);
    }
  }
}

function drawBrows(g: CanvasRenderingContext2D, style: FaceStyle, s: FaceState): void {
  const b = clamp(s.brows, -1, 1);
  const angry = Math.max(0, -b), worry = Math.max(0, b);
  const smirk = s.mouth === 'smirk';
  g.fillStyle = style.brow;
  for (const sgn of [-1, 1]) {
    // a smirk cocks the brow on the lifted side
    const raise = smirk ? (sgn > 0 ? 0.024 : -0.004) : 0;
    const inX = sgn * (0.072 - angry * 0.012);
    const outX = sgn * 0.31;
    const yIn = 0.768 + b * 0.052 + raise * 0.3;
    const yOut = 0.781 - b * 0.014 + raise;
    const peak = Math.max(yIn, yOut) + 0.014 - angry * 0.008 + worry * 0.004 + raise * 0.5;
    const ctrl: Pt = [(inX + outX) / 2 - sgn * 0.022, 2 * peak - (yIn + yOut) / 2];
    // licensed-print brows: a heavy, nearly flat bar, blunt at the inner end, holding its weight to the tip
    brush(g, [inX, yIn], ctrl, [outX, yOut], 0.068 + angry * 0.008, 0.062, 0.036);
  }
  if (style.scar) {
    // Anakin: the scar over his right eye (viewer's left) splits the brow and runs on under the eye
    const sx = -0.222;
    g.fillStyle = style.skin;
    brush(g, [sx - 0.004, 0.845], [sx, 0.78], [sx + 0.004, 0.72], 0.012, 0.014, 0.012);
    g.fillStyle = '#ad6a55';
    brush(g, [sx - 0.012, 0.905], [sx, 0.8], [sx + 0.009, 0.7], 0.002, 0.0115, 0.004);
    brush(g, [sx + 0.015, 0.515], [sx + 0.019, 0.47], [sx + 0.024, 0.418], 0.005, 0.0105, 0.001);
    g.fillStyle = '#fde8d4';
    g.globalAlpha = 0.6;
    brush(g, [sx - 0.005, 0.89], [sx + 0.007, 0.8], [sx + 0.015, 0.712], 0, 0.0032, 0);
    g.globalAlpha = 1;
  }
}

/**
 * The mouth. With `halo` it draws only a skin-coloured silhouette a little larger than the mouth:
 * the bare lip a beard is cut back around.
 */
function drawMouth(g: CanvasRenderingContext2D, style: FaceStyle, mg: MouthGeo, halo: boolean): void {
  const { m, y0 } = mg;
  const beard = !!style.beard;
  const grow = halo ? 0.016 : 0;
  // lopsided smiles lift toward the figure's left
  const L = (x: number, y: number): Pt => [x, y + mg.lop * 0.16 * x];
  const line = (a: Pt, c: Pt, b: Pt, w0: number, w1: number, w2: number) => brush(g, a, c, b, w0 + grow, w1 + grow, w2 + grow);
  const dimple = (sgn: number, x: number, y: number, w = 0.008) => {
    if (!halo && !beard) brush(g, [x - sgn * 0.01, y + 0.025], [x + sgn * 0.02, y + 0.012], [x + sgn * 0.012, y - 0.018], 0.001, w, 0.001);
  };
  /** faint lower-lip line (the beard's lip patch stands in for it) */
  const lip = (a: Pt, c: Pt, b: Pt, alpha: number) => {
    if (halo || beard) return;
    g.fillStyle = style.line;
    g.globalAlpha = alpha;
    brush(g, a, c, b, 0, 0.007, 0);
    g.globalAlpha = 1;
  };
  g.fillStyle = halo ? style.skin : INK;
  switch (m) {
    case 'smile': {
      const a = L(-0.12, y0 + 0.04), b = L(0.12, y0 + 0.04);
      line(a, L(0, y0 - 0.052), b, 0.009, 0.021, 0.009);
      dimple(-1, a[0], a[1]);
      dimple(1, b[0], b[1]);
      lip(L(-0.036, y0 - 0.076), L(0, y0 - 0.089), L(0.036, y0 - 0.076), 0.75);
      break;
    }
    case 'smirk': {
      line([-0.1, y0 + 0.012], [0.03, y0 - 0.04], [0.138, y0 + 0.062], 0.008, 0.02, 0.009);
      dimple(1, 0.138, y0 + 0.062, 0.009);
      if (!halo) brush(g, [-0.104, y0 + 0.03], [-0.118, y0 + 0.014], [-0.108, y0 - 0.003], 0.001, 0.005, 0.001);
      lip([0.0, y0 - 0.052], [0.035, y0 - 0.067], [0.07, y0 - 0.05], 0.75);
      break;
    }
    case 'flat':
      line([-0.095, y0 + 0.003], [0, y0 - 0.008], [0.095, y0 + 0.003], 0.008, 0.017, 0.008);
      lip([-0.03, y0 - 0.045], [0, y0 - 0.053], [0.03, y0 - 0.045], 0.6);
      break;
    case 'frown':
      line([-0.105, y0 - 0.028], [0, y0 + 0.05], [0.105, y0 - 0.028], 0.008, 0.018, 0.008);
      lip([-0.028, y0 - 0.036], [0, y0 - 0.043], [0.028, y0 - 0.036], 0.55);
      break;
    case 'grin': {
      const a = L(-0.15, y0 + 0.045), b = L(0.15, y0 + 0.045);
      openMouth(g, a, b, L(0, y0 - 0.012), y0 - 0.092, 0.55, 0.042, 0.024, 0.15, halo ? style.skin : null);
      g.fillStyle = INK;
      dimple(-1, a[0] - 0.006, a[1]);
      dimple(1, b[0] + 0.006, b[1]);
      break;
    }
    case 'talk':
      openMouth(g, L(-0.085, y0 + 0.02), L(0.085, y0 + 0.02), L(0, y0), y0 - 0.075, 0.7, 0.022, 0, 0.65, halo ? style.skin : null);
      break;
    case 'worry':
      // talking while worried: the corners pulled down, the upper lip arched up in the middle
      openMouth(g, [-0.09, y0 - 0.034], [0.09, y0 - 0.034], [0, y0 + 0.05], y0 - 0.092, 0.62, 0.02, 0, 0.55, halo ? style.skin : null);
      break;
    case 'open':
      openMouth(g, L(-0.11, y0 + 0.03), L(0.11, y0 + 0.03), L(0, y0 + 0.018), y0 - 0.13, 0.8, 0.026, 0.016, 0.7, halo ? style.skin : null);
      break;
    case 'shout':
      openMouth(g, L(-0.14, y0 + 0.045), L(0.14, y0 + 0.045), L(0, y0 + 0.04), y0 - 0.18, 0.92, 0.03, 0.02, 0.8, halo ? style.skin : null);
      break;
    case 'o': {
      ellipse(g, 0, y0 - 0.012, 0.04 + grow / 2, 0.05 + grow / 2);
      if (halo) {
        g.fill();
        break;
      }
      g.fillStyle = MOUTH;
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = TONGUE;
      ellipse(g, 0, y0 - 0.068, 0.036, 0.03);
      g.fill();
      g.restore();
      ellipse(g, 0, y0 - 0.012, 0.04, 0.05);
      g.strokeStyle = INK;
      g.lineWidth = px(0.012);
      g.stroke();
      break;
    }
    case 'grit': {
      const x0 = -0.17, x1 = 0.17, yb = y0 - 0.046, yt = y0 + 0.032, r = 0.03;
      const shape = () => {
        const [ax, ay] = P(x0, yt), [bx, by] = P(x1, yb);
        g.beginPath();
        g.roundRect(ax, ay, bx - ax, by - ay, px(r));
      };
      if (halo) {
        shape();
        g.fill();
        g.strokeStyle = style.skin;
        g.lineWidth = px(grow * 2);
        g.stroke();
        break;
      }
      shape();
      g.fillStyle = MOUTH;
      g.fill();
      g.save();
      shape();
      g.clip();
      g.fillStyle = TEETH;
      const [tx, ty] = P(x0 + 0.02, yt + 0.01), [ux, uy] = P(x1 - 0.02, yb - 0.01);
      g.beginPath();
      g.roundRect(tx, ty, ux - tx, uy - ty, px(0.012));
      g.fill();
      // a plain outlined tooth band split by one line, as printed; no per-tooth grid
      g.fillStyle = INK;
      path(g, [[x0, y0 - 0.009], [x1, y0 - 0.009], [x1, y0 - 0.003], [x0, y0 - 0.003]], true);
      g.fill();
      g.restore();
      shape();
      g.strokeStyle = INK;
      g.lineWidth = px(0.013);
      g.stroke();
      break;
    }
  }
}

/**
 * An open mouth: the upper lip a quadratic from corner a to b through c, the lower lip a rounded
 * U down to yb (`round` = how boxy); teeth bands under the top / over the bottom and a tongue.
 */
function openMouth(g: CanvasRenderingContext2D, a: Pt, b: Pt, c: Pt, yb: number, round: number, upper: number, lower: number, tongue: number, halo: string | null): void {
  const mx = (a[0] + b[0]) / 2;
  const bottom = (dy: number) => {
    cubicTo(g, [mx + (b[0] - mx) * round, yb + dy], [mx + (a[0] - mx) * round, yb + dy], [a[0], a[1] + dy]);
  };
  const shape = () => {
    g.beginPath();
    mv(g, a);
    quadTo(g, c, b);
    bottom(0);
    g.closePath();
  };
  if (halo) {
    shape();
    g.fillStyle = halo;
    g.fill();
    g.strokeStyle = halo;
    g.lineWidth = px(0.03);
    g.stroke();
    return;
  }
  shape();
  g.fillStyle = MOUTH;
  g.fill();
  g.save();
  shape();
  g.clip();
  if (tongue > 0) {
    const lowY = 0.25 * (a[1] + b[1]) / 2 + 0.75 * yb;
    const w = Math.abs(b[0] - a[0]) * 0.5 * round * tongue;
    g.fillStyle = TONGUE;
    ellipse(g, mx, lowY + w * 0.22, w, w * 0.62);
    g.fill();
  }
  g.fillStyle = TEETH;
  if (upper > 0) {
    g.beginPath();
    mv(g, [a[0], a[1] + 0.05]);
    quadTo(g, [c[0], c[1] + 0.05], [b[0], b[1] + 0.05]);
    g.lineTo(...P(b[0], b[1] - upper));
    quadTo(g, [c[0], c[1] - upper], [a[0], a[1] - upper]);
    g.closePath();
    g.fill();
  }
  if (lower > 0) {
    g.beginPath();
    mv(g, [b[0], b[1] + lower]);
    cubicTo(g, [mx + (b[0] - mx) * round, yb + lower], [mx + (a[0] - mx) * round, yb + lower], [a[0], a[1] + lower]);
    g.lineTo(...P(a[0], yb - 0.05));
    g.lineTo(...P(b[0], yb - 0.05));
    g.closePath();
    g.fill();
  }
  g.restore();
  shape();
  g.strokeStyle = INK;
  g.lineWidth = px(0.013);
  g.stroke();
}

/* ------------------------------------------------------------------ beards */

const beardCache = new Map<string, HTMLCanvasElement>();

/** Right half of the beard outline (x ≥ 0): chin → jaw → up the sideburn under the hair → down the cheek to the moustache. */
const BEARD_JAW: Pt[] = [[0, 0.028], [0.17, 0.046], [0.33, 0.098], [0.46, 0.188], [0.57, 0.31], [0.65, 0.44], [0.7, 0.56], [0.72, 0.8]];
const BEARD_TOP: Pt[] = [[0.6, 0.83], [0.566, 0.69]];
const BEARD_CHEEK: Pt[] = [[0.53, 0.585], [0.45, 0.505], [0.35, 0.452], [0.26, 0.42], [0.2, 0.395]];
const BEARD_LIP: Pt[] = [[0.1, 0.418], [0, 0.41]];

/** Resample a polyline and push every other point out along its right-hand normal: a hair-tip edge. */
function serrate(pts: Pt[], step: number, amp: [number, number], rng: Rng): Pt[] {
  const out: Pt[] = [];
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const l = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(l / step));
    const nx = (by - ay) / l, ny = -(bx - ax) / l;
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const o = k++ % 2 ? rng.range(amp[0], amp[1]) : -amp[0] * 0.3;
      out.push([ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]): Pt => [-x, y]);

function beardOutline(rng: Rng): { outline: Pt[]; jaw: Pt[] } {
  const jaw = serrate(BEARD_JAW, 0.02, [0.004, 0.011], rng);
  const right = [...jaw, ...BEARD_TOP, ...serrate([BEARD_TOP[1], ...BEARD_CHEEK], 0.017, [0.007, 0.017], rng).slice(1), ...BEARD_LIP];
  return { outline: [...right, ...mirror(right).reverse().slice(1, -1)], jaw };
}

/**
 * The beard (everything but the moustache), cached per beard colouring. Pad-printed like the licensed
 * Obi-Wan head: one flat colour inside a hair-tip silhouette, the skin left bare on the cheeks and round
 * the mouth; no strand texture.
 */
function beardLayer(style: FaceStyle): HTMLCanvasElement {
  const b = style.beard!;
  const key = `${b.color}|${b.dark}|${b.light}`;
  const hit = beardCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = FACE_W;
  c.height = FACE_H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const { outline } = beardOutline(new Rng(4242));
  path(g, outline, true);
  g.fillStyle = b.color;
  g.fill();
  beardCache.set(key, c);
  return c;
}

/** The bare lip the beard is trimmed back from: a skin halo round the mouth and a lower lip, with the soul patch under it. */
function lipPatch(g: CanvasRenderingContext2D, style: FaceStyle, mg: MouthGeo): void {
  const b = style.beard!;
  drawMouth(g, style, mg, true);
  const lipTop = mg.m === 'smile' || mg.m === 'smirk' ? mg.y0 - 0.02 : mg.bottom + 0.016;
  const lx = mg.m === 'smirk' ? 0.02 : 0;
  const ly = lipTop - 0.018, lrx = Math.min(0.064, mg.half * 0.5), lry = 0.026;
  g.fillStyle = style.skin;
  ellipse(g, lx, ly, lrx, lry);
  g.fill();
  // the beard creeps back over the lip's lower edge in little tufts
  const rng = new Rng(99);
  g.fillStyle = b.color;
  for (let i = 0; i <= 8; i++) {
    const x = lx + lrx * (-0.95 + (1.9 * i) / 8);
    const y = ly - lry * Math.sqrt(Math.max(0, 1 - Math.pow((x - lx) / lrx, 2))) - 0.003;
    brush(g, [x, y - 0.01], [x + rng.range(-0.003, 0.003), y], [x + rng.range(-0.005, 0.005), y + rng.range(0.01, 0.017)], 0.011, 0.008, 0);
  }
  // soul patch under the lower lip
  const yb = ly - 0.024;
  path(g, [[-0.026, yb + 0.01], [0.026, yb + 0.01], [0.014, yb - 0.056], [-0.014, yb - 0.056]], true);
  g.fill();
}

/** The moustache, printed over the top of the mouth. */
function drawMoustache(g: CanvasRenderingContext2D, style: FaceStyle, mg: MouthGeo): void {
  const b = style.beard!;
  const y0 = mg.y0;
  const top: Pt[] = [[-0.205, y0 + 0.004], [-0.16, y0 + 0.05], [-0.1, y0 + 0.083], [-0.04, y0 + 0.096], [0, y0 + 0.088], [0.04, y0 + 0.096], [0.1, y0 + 0.083], [0.16, y0 + 0.05], [0.205, y0 + 0.004]];
  // lower edge, centre → right tip, so the serrations hang down over the lip
  const lowR: Pt[] = [[0, y0 + 0.055], [0.08, y0 + 0.052], [0.15, y0 + 0.038], [0.205, y0 + 0.004]];
  const rng = new Rng(311);
  const low = serrate(lowR, 0.014, [0.004, 0.009], rng);
  const outline: Pt[] = [...top, ...[...low].reverse().slice(1), ...mirror(low).slice(1, -1)];
  path(g, outline, true);
  g.fillStyle = b.color;
  g.fill();
}

/** A face texture whose expression can be changed cheaply (redraws only when the state changes). */
export class FaceTexture {
  canvas: HTMLCanvasElement;
  texture: Texture;
  private key = '';
  constructor(public style: FaceStyle) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = FACE_W;
    this.canvas.height = FACE_H;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.set(NEUTRAL);
  }
  set(s: FaceState): void {
    const q = (v: number) => Math.round(v * 40) / 40;
    const key = `${s.mouth}|${q(s.brows)}|${q(s.lookX)}|${q(s.lookY)}|${q(s.blink)}|${q(s.squint)}`;
    if (key === this.key) return;
    this.key = key;
    drawFace(this.canvas.getContext('2d')!, this.style, s);
    this.texture.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ torso prints */

export const TORSO_W = 1024;
export const TORSO_H = 800;
/** px per figure unit: torso prints span the brick's 1.95 × 1.52 front face */
const TK = TORSO_W / 1.95;
/** torso print frame: x right of the centre line (as seen from the front), y down from the shoulders */
const TORSO: Space = { P: (x, y) => [TORSO_W / 2 + x * TK, y * TK], k: TK };

export interface TorsoStyle {
  /** the torso plastic: the print's ground, so its edges meet the brick's sides */
  base: string;
  /** tabards (when `tabard` is unset) */
  robe: string;
  /** folds and cast shadows */
  robeDark: string;
  /** the undershirt in the neck V */
  inner: string;
  belt: string;
  buckle: string;
  skin: string;
  line: string;
  /** optional darker tabard layer over the robe (Anakin) */
  tabard?: string;
  /** the wide sash under the belt (default: base, shaded) */
  sash?: string;
  /** belt pouches (default: belt, lifted) */
  pouch?: string;
}

function rgbOf(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** #rrggbb a → b by t */
function mix(a: string, b: string, t: number): string {
  const p = rgbOf(a), q = rgbOf(b);
  return `#${p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const lift = (c: string, t: number) => mix(c, '#ffffff', t);
const sink = (c: string, t: number) => mix(c, '#000000', t);

/** points along the quadratic a → (c) → b */
function qcurve(a: Pt, c: Pt, b: Pt, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** a polyline moved sideways by d (positive = to the left of its direction of travel, on screen) */
function offsetLine(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i): Pt => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] + (dy / l) * d, p[1] - (dx / l) * d];
  });
}

function fillShape(g: CanvasRenderingContext2D, S: Space, pts: Pt[], color: string, alpha = 1): void {
  shapePath(g, S, pts, true);
  g.fillStyle = color;
  g.globalAlpha = alpha;
  g.fill();
  g.globalAlpha = 1;
}

/** constant-width polyline; `dash` = [on, off] in figure units (stitching) */
function strokeLine(g: CanvasRenderingContext2D, S: Space, pts: Pt[], w: number, color: string, alpha = 1, dash?: [number, number]): void {
  shapePath(g, S, pts, false);
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = w * S.k;
  g.lineCap = dash ? 'butt' : 'round';
  g.lineJoin = 'round';
  g.setLineDash(dash ? [dash[0] * S.k, dash[1] * S.k] : []);
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
}

function roundRect(g: CanvasRenderingContext2D, S: Space, x0: number, y0: number, x1: number, y1: number, r: number): void {
  const [ax, ay] = S.P(x0, y0), [bx, by] = S.P(x1, y1);
  g.beginPath();
  g.roundRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay), r * S.k);
}

/** a cloth fold: a tapered crease with a thinner highlight beside it on the lit (upper-right) side */
function fold(g: CanvasRenderingContext2D, S: Space, a: Pt, c: Pt, b: Pt, w: number, dark: string, light: string, alpha = 1): void {
  let nx = -(b[1] - a[1]), ny = b[0] - a[0];
  const l = Math.hypot(nx, ny) || 1;
  nx /= l;
  ny /= l;
  if (nx - ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const o = w * 0.9;
  g.fillStyle = light;
  g.globalAlpha = 0.5 * alpha;
  taper(g, S, [a[0] + nx * o, a[1] + ny * o], [c[0] + nx * o, c[1] + ny * o], [b[0] + nx * o, b[1] + ny * o], 0, w * 0.7, 0);
  g.fillStyle = dark;
  g.globalAlpha = 0.85 * alpha;
  taper(g, S, a, c, b, 0, w, 0);
  g.globalAlpha = 1;
}

/** soft linear shade between two points: colour at alpha a0 → a1 */
function shadeBand(g: CanvasRenderingContext2D, S: Space, p0: Pt, p1: Pt, color: string, a0: number, a1: number, rect: [number, number, number, number]): void {
  const [x0, y0] = S.P(...p0), [x1, y1] = S.P(...p1);
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  const [r, gg, b] = rgbOf(color);
  gr.addColorStop(0, `rgba(${r},${gg},${b},${a0})`);
  gr.addColorStop(1, `rgba(${r},${gg},${b},${a1})`);
  g.fillStyle = gr;
  const [ax, ay] = S.P(rect[0], rect[1]), [bx, by] = S.P(rect[2], rect[3]);
  g.fillRect(ax, ay, bx - ax, by - ay);
}

/** Right tabard's edges (the left mirrors them): shoulder to hem, running on under the sash. */
const TABARD_OUT: [Pt, Pt, Pt] = [[0.6, -0.02], [0.575, 0.6], [0.5, 1.6]];
const TABARD_IN: [Pt, Pt, Pt] = [[0.37, -0.02], [0.35, 0.6], [0.27, 1.6]];
const STITCH: [number, number] = [0.02, 0.014];

function tabards(g: CanvasRenderingContext2D, s: TorsoStyle): void {
  const S = TORSO;
  const tab = s.tabard ?? s.robe;
  const out = qcurve(...TABARD_OUT, 24), inn = qcurve(...TABARD_IN, 24);
  for (const sgn of [1, -1]) {
    const o = sgn > 0 ? out : mirror(out), i = sgn > 0 ? inn : mirror(inn);
    const left = sgn > 0 ? i : o, right = sgn > 0 ? o : i;
    // cast shadow on the tunic beside the screen-left edge (both edges run downward: +d is screen right)
    strokeLine(g, S, offsetLine(left, -0.026), 0.05, s.robeDark, 0.16);
    strokeLine(g, S, offsetLine(left, -0.014), 0.026, s.robeDark, 0.2);
    fillShape(g, S, [...o, ...[...i].reverse()], tab);
    const mid = o.map((p, k): Pt => [(p[0] + i[k][0]) / 2, (p[1] + i[k][1]) / 2]);
    fold(g, S, mid[2], [mid[6][0] + 0.012, mid[6][1]], mid[11], 0.009, sink(tab, 0.3), lift(tab, 0.25), 0.55);
    strokeLine(g, S, offsetLine(right, -0.014), 0.009, lift(tab, 0.3), 0.55);
    strokeLine(g, S, offsetLine(left, 0.026), 0.0045, lift(tab, 0.38), 0.55, STITCH);
    strokeLine(g, S, offsetLine(right, -0.032), 0.0045, lift(tab, 0.38), 0.55, STITCH);
    strokeLine(g, S, o, 0.011, s.line);
    strokeLine(g, S, i, 0.011, s.line);
  }
}

function pouch(g: CanvasRenderingContext2D, s: TorsoStyle, cx: number, color: string): void {
  const S = TORSO;
  const w = 0.074;
  roundRect(g, S, cx - w, 1.2, cx + w, 1.445, 0.03);
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = s.line;
  g.lineWidth = 0.009 * S.k;
  g.stroke();
  strokeLine(g, S, [[cx + w - 0.02, 1.31], [cx + w - 0.02, 1.42]], 0.018, sink(color, 0.35), 0.45);
  strokeLine(g, S, [[cx - w + 0.017, 1.31], [cx - w + 0.017, 1.42]], 0.008, lift(color, 0.3), 0.5);
  roundRect(g, S, cx - w - 0.006, 1.185, cx + w + 0.006, 1.305, 0.026);
  g.fillStyle = lift(color, 0.08);
  g.fill();
  g.stroke();
  strokeLine(g, S, [[cx - w + 0.014, 1.199], [cx + w - 0.014, 1.199]], 0.007, lift(color, 0.35), 0.5);
  // press stud
  const [sx, sy] = S.P(cx, 1.284);
  g.beginPath();
  g.arc(sx, sy, 0.015 * S.k, 0, Math.PI * 2);
  g.fillStyle = s.buckle;
  g.fill();
  g.lineWidth = 0.005 * S.k;
  g.stroke();
  g.beginPath();
  g.arc(sx - 0.004 * S.k, sy - 0.004 * S.k, 0.005 * S.k, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.8;
  g.fill();
  g.globalAlpha = 1;
}

function buckle(g: CanvasRenderingContext2D, s: TorsoStyle): void {
  const S = TORSO;
  const metalDark = sink(s.buckle, 0.45);
  roundRect(g, S, -0.1, 1.14, 0.1, 1.35, 0.024);
  g.fillStyle = s.buckle;
  g.fill();
  strokeLine(g, S, [[-0.086, 1.332], [-0.086, 1.154], [0.086, 1.154]], 0.008, '#ffffff', 0.7);
  strokeLine(g, S, [[0.087, 1.158], [0.087, 1.336], [-0.082, 1.336]], 0.008, metalDark, 0.75);
  roundRect(g, S, -0.1, 1.14, 0.1, 1.35, 0.024);
  g.strokeStyle = s.line;
  g.lineWidth = 0.009 * S.k;
  g.stroke();
  // the belt through the frame, and the prong
  roundRect(g, S, -0.056, 1.186, 0.056, 1.304, 0.012);
  g.fillStyle = s.belt;
  g.fill();
  g.lineWidth = 0.007 * S.k;
  g.stroke();
  strokeLine(g, S, [[-0.048, 1.195], [0.048, 1.195]], 0.008, sink(s.belt, 0.5), 0.7);
  roundRect(g, S, -0.011, 1.19, 0.011, 1.3, 0.006);
  g.fillStyle = s.buckle;
  g.fill();
  g.lineWidth = 0.005 * S.k;
  g.stroke();
  strokeLine(g, S, [[-0.004, 1.2], [-0.004, 1.29]], 0.004, '#ffffff', 0.6);
}

/** Sash, stitched leather belt and pouches; the buckle in front, a D-ring behind. */
function beltBand(g: CanvasRenderingContext2D, s: TorsoStyle, back: boolean): void {
  const S = TORSO;
  const sash = s.sash ?? mix(s.base, s.robeDark, 0.3);
  // the tunic bunching into the sash, and the sash's shadow on the skirt
  shadeBand(g, S, [0, 0.9], [0, 1.1], s.robeDark, 0, 0.26, [-1, 0.9, 1, 1.1]);
  shadeBand(g, S, [0, 1.4], [0, 1.5], s.robeDark, 0.3, 0, [-1, 1.4, 1, 1.5]);
  fillShape(g, S, [[-1.1, 1.1], [1.1, 1.1], [1.1, 1.4], [-1.1, 1.4]], sash);
  const wrinkles: [Pt, Pt, Pt][] = back
    ? [[[-0.8, 1.146], [-0.55, 1.16], [-0.3, 1.148]], [[0.3, 1.362], [0.55, 1.374], [0.8, 1.36]], [[0.35, 1.143], [0.6, 1.156], [0.82, 1.146]]]
    : [[[-0.82, 1.145], [-0.62, 1.16], [-0.42, 1.148]], [[0.46, 1.36], [0.64, 1.372], [0.84, 1.358]], [[-0.78, 1.362], [-0.6, 1.375], [-0.44, 1.365]], [[0.5, 1.142], [0.66, 1.155], [0.8, 1.146]]];
  for (const [a, c, b] of wrinkles) fold(g, S, a, c, b, 0.012, sink(sash, 0.35), lift(sash, 0.25), 0.7);
  strokeLine(g, S, [[-1.1, 1.1], [1.1, 1.1]], 0.011, s.line);
  strokeLine(g, S, [[-1.1, 1.4], [1.1, 1.4]], 0.011, s.line);
  fillShape(g, S, [[-1.1, 1.17], [1.1, 1.17], [1.1, 1.32], [-1.1, 1.32]], s.belt);
  strokeLine(g, S, [[-1.1, 1.18], [1.1, 1.18]], 0.01, lift(s.belt, 0.18), 0.6);
  for (const y of [1.188, 1.304]) strokeLine(g, S, [[-1.1, y], [1.1, y]], 0.0045, lift(s.belt, 0.42), 0.6, [0.02, 0.013]);
  strokeLine(g, S, [[-1.1, 1.17], [1.1, 1.17]], 0.01, s.line);
  strokeLine(g, S, [[-1.1, 1.32], [1.1, 1.32]], 0.01, s.line);
  const pc = s.pouch ?? lift(s.belt, 0.1);
  for (const cx of back ? [-0.5, 0.5] : [-0.56, -0.32, 0.32, 0.56]) pouch(g, s, cx, pc);
  if (!back) {
    buckle(g, s);
    return;
  }
  const ring = qcurve([-0.042, 1.3], [0, 1.44], [0.042, 1.3], 12);
  strokeLine(g, S, ring, 0.018, s.line);
  strokeLine(g, S, ring, 0.009, s.buckle);
  strokeLine(g, S, offsetLine(ring, 0.003).slice(2, 8), 0.004, '#ffffff', 0.6);
}

/** Jedi tunic, front: undershirt and neck in the V, the crossover (wearer's left over right), tabards, belt. */
function jediFront(g: CanvasRenderingContext2D, s: TorsoStyle): void {
  const S = TORSO;
  const under = mix(s.base, s.robeDark, 0.12);
  const hi = lift(s.base, 0.35);
  // lapel edges run downward, so +d is screen-right: the over panel lies at +d of its edge, the undershirt at +d of the under edge
  const overEdge = qcurve([0.235, -0.02], [0.03, 0.52], [-0.33, 1.2], 28);
  const underEdge = qcurve([-0.235, -0.02], [-0.13, 0.42], [0.0, 0.76], 18);

  fillShape(g, S, [[-0.36, -0.05], [0.36, -0.05], [0.03, 0.9]], s.inner);
  strokeLine(g, S, qcurve([0.012, 0.19], [-0.03, 0.36], [-0.09, 0.56], 10), 0.009, s.line, 0.7);
  strokeLine(g, S, qcurve([0.03, 0.2], [-0.01, 0.37], [-0.07, 0.56], 10), 0.006, lift(s.inner, 0.3), 0.5);
  const skinSide = qcurve([-0.125, -0.02], [-0.05, 0.1], [0, 0.205], 10);
  const skinV = [...skinSide, ...mirror(skinSide).reverse().slice(1)];
  fillShape(g, S, skinV, s.skin);
  g.save();
  shapePath(g, S, skinV, true);
  g.clip();
  shadeBand(g, S, [0, -0.02], [0, 0.07], s.robeDark, 0.3, 0, [-0.14, -0.02, 0.14, 0.07]);
  g.restore();
  strokeLine(g, S, skinV, 0.01, s.line);

  strokeLine(g, S, offsetLine(underEdge, 0.02), 0.035, s.robeDark, 0.28);
  fillShape(g, S, [[-1.1, -0.05], [-0.235, -0.05], ...underEdge, [0.25, 1.6], [-1.1, 1.6]], under);
  strokeLine(g, S, offsetLine(underEdge, -0.016), 0.009, lift(under, 0.3), 0.55);
  strokeLine(g, S, offsetLine(underEdge, -0.036), 0.0045, lift(under, 0.42), 0.5, STITCH);
  strokeLine(g, S, underEdge, 0.011, s.line);

  strokeLine(g, S, offsetLine(overEdge, -0.026), 0.05, s.robeDark, 0.2);
  strokeLine(g, S, offsetLine(overEdge, -0.014), 0.026, s.robeDark, 0.22);
  fillShape(g, S, [[1.1, -0.05], [0.235, -0.05], ...overEdge, [-0.4, 1.6], [1.1, 1.6]], s.base);
  strokeLine(g, S, offsetLine(overEdge, 0.016), 0.009, hi, 0.55);
  strokeLine(g, S, offsetLine(overEdge, 0.036), 0.0045, lift(s.base, 0.45), 0.55, STITCH);
  strokeLine(g, S, [...overEdge, [-0.4, 1.6]], 0.011, s.line);

  const [hx, hy] = S.P(0.15, 0.32);
  const glow = g.createRadialGradient(hx, hy, 0, hx, hy, 0.62 * S.k);
  glow.addColorStop(0, 'rgba(255,255,255,0.1)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, TORSO_W, TORSO_H);

  const dk = s.robeDark;
  for (const sgn of [1, -1]) {
    fold(g, S, [sgn * 0.71, 0.3], [sgn * 0.62, 0.38], [sgn * 0.62, 0.58], 0.014, dk, hi);
    fold(g, S, [sgn * 0.74, 0.46], [sgn * 0.66, 0.6], [sgn * 0.69, 0.82], 0.012, dk, hi);
  }
  fold(g, S, [0.1, 1.08], [0.14, 0.93], [0.21, 0.78], 0.013, dk, hi);
  fold(g, S, [-0.04, 1.08], [0.0, 0.98], [0.07, 0.88], 0.011, dk, hi);
  fold(g, S, [0.235, 1.07], [0.245, 0.99], [0.27, 0.93], 0.009, dk, hi, 0.8);

  tabards(g, s);
  beltBand(g, s, false);
}

/** Jedi tunic, back: collar, seam and folds, tabards over the shoulders, belt with pouches and a D-ring. */
function jediBack(g: CanvasRenderingContext2D, s: TorsoStyle): void {
  const S = TORSO;
  const hi = lift(s.base, 0.35);
  const dk = s.robeDark;
  const collar = qcurve([-0.34, -0.02], [0, 0.13], [0.34, -0.02], 18);
  fillShape(g, S, [[-0.36, -0.05], ...collar, [0.36, -0.05]], s.inner);
  strokeLine(g, S, offsetLine(collar, -0.02), 0.03, dk, 0.3);
  strokeLine(g, S, offsetLine(collar, -0.012), 0.007, hi, 0.5);
  strokeLine(g, S, collar, 0.011, s.line);

  const [hx, hy] = S.P(0.2, 0.34);
  const glow = g.createRadialGradient(hx, hy, 0, hx, hy, 0.62 * S.k);
  glow.addColorStop(0, 'rgba(255,255,255,0.08)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, TORSO_W, TORSO_H);

  const seam = qcurve([0, 0.09], [0.012, 0.6], [0, 1.1], 16);
  strokeLine(g, S, seam, 0.008, s.line, 0.5);
  for (const d of [-0.018, 0.018]) strokeLine(g, S, offsetLine(seam, d), 0.004, hi, 0.45, STITCH);
  fold(g, S, [0.2, 0.18], [0.25, 0.55], [0.18, 1.05], 0.012, dk, hi);
  fold(g, S, [-0.18, 0.2], [-0.23, 0.6], [-0.16, 1.06], 0.012, dk, hi);
  for (const sgn of [1, -1]) fold(g, S, [sgn * 0.72, 0.3], [sgn * 0.63, 0.4], [sgn * 0.64, 0.6], 0.013, dk, hi);
  fold(g, S, [-0.1, 1.09], [-0.06, 1.02], [0.01, 0.99], 0.01, dk, hi);
  fold(g, S, [0.08, 1.09], [0.12, 1.03], [0.18, 1.0], 0.01, dk, hi);

  tabards(g, s);
  beltBand(g, s, true);
  strokeLine(g, S, [[0, 1.4], [0, 1.6]], 0.01, s.line, 0.8);
}

const torsoCache = new Map<string, Texture>();

/** Torso print (front, or `back`) over the brick's face, u right and v down; the mesh maps its trapezoid onto it. */
export function torsoTexture(s: TorsoStyle, back = false): Texture {
  const key = `${JSON.stringify(s)}|${back}`;
  const hit = torsoCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = TORSO_W;
  c.height = TORSO_H;
  const g = c.getContext('2d')!;
  g.fillStyle = s.base;
  g.fillRect(0, 0, TORSO_W, TORSO_H);
  if (back) jediBack(g, s);
  else jediFront(g, s);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  torsoCache.set(key, t);
  return t;
}

const LEG_W = 512;
const LEG_H = 800;
/** px per figure unit: a leg print spans one leg's 0.94 width and its 1.47 height (hip top to sole) */
const LK = LEG_W / 0.94;
/** leg print frame: x from the leg's inner edge outward, y down from the top of the leg */
const LEG: Space = { P: (x, y) => [x * LK, y * LK], k: LK };

export interface LegStyle {
  /** tunic skirt over the thigh, hemmed `hem` figure units below the top of the leg */
  tunic?: string;
  hem?: number;
  /** creases and shadows (default: base, shaded) */
  dark?: string;
}

const legCache = new Map<string, Texture>();

/**
 * Leg print, shared by both legs (the right leg mirrors its UVs, so x runs from the inner edge out):
 * boots from `bootTop` (0..1 from the hip down) in the given colour, with a folded cuff.
 */
export function legTexture(base: string, boot: string | null, line: string, bootTop = 0.55, o: LegStyle = {}): Texture {
  const key = JSON.stringify([base, boot, line, bootTop, o]);
  const hit = legCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = LEG_W;
  c.height = LEG_H;
  const g = c.getContext('2d')!;
  const S = LEG;
  const W = 0.94, H = 1.47;
  const dark = o.dark ?? sink(base, 0.35);
  const hi = lift(base, 0.35);
  g.fillStyle = base;
  g.fillRect(0, 0, LEG_W, LEG_H);
  const bt = (boot ? bootTop : 0.9) * H;
  const knee = Math.min(bt - 0.1, 0.62);
  fold(g, S, [0.3, knee - 0.04], [0.44, knee + 0.01], [0.6, knee - 0.045], 0.012, dark, hi, 0.7);
  fold(g, S, [0.37, knee + 0.02], [0.46, knee + 0.05], [0.56, knee + 0.02], 0.009, dark, hi, 0.55);
  if (o.tunic) {
    const hem = o.hem ?? 0.42;
    // the hem runs left → right, so −d is below it
    const hemLine = qcurve([0, hem - 0.035], [0.45, hem + 0.035], [W, hem + 0.005], 16);
    strokeLine(g, S, offsetLine(hemLine, -0.022), 0.04, dark, 0.25);
    fillShape(g, S, [[-0.05, -0.05], [W + 0.05, -0.05], [W + 0.05, hem + 0.005], ...[...hemLine].reverse(), [-0.05, hem - 0.035]], o.tunic);
    fold(g, S, [0.3, 0.22], [0.27, 0.32], [0.31, hem + 0.005], 0.012, dark, hi, 0.8);
    fold(g, S, [0.7, 0.2], [0.73, 0.3], [0.68, hem + 0.02], 0.011, dark, hi, 0.8);
    strokeLine(g, S, [[0.035, 0.18], [0.035, hem - 0.03]], 0.009, line, 0.8);
    strokeLine(g, S, [[0.052, 0.19], [0.052, hem - 0.035]], 0.006, hi, 0.5);
    strokeLine(g, S, offsetLine(hemLine, 0.012), 0.006, hi, 0.5);
    strokeLine(g, S, hemLine, 0.01, line);
  }
  if (boot) {
    const top = qcurve([0, bt + 0.03], [0.47, bt - 0.06], [W, bt + 0.03], 16);
    const cuff = top.map(([x, y]): Pt => [x, y + 0.08]);
    fillShape(g, S, [...top, [W + 0.05, bt + 0.03], [W + 0.05, H + 0.05], [-0.05, H + 0.05], [-0.05, bt + 0.03]], boot);
    fillShape(g, S, [...top, ...[...cuff].reverse()], lift(boot, 0.1));
    strokeLine(g, S, offsetLine(top, -0.012), 0.008, lift(boot, 0.3), 0.6);
    strokeLine(g, S, cuff, 0.009, sink(boot, 0.5), 0.9);
    strokeLine(g, S, offsetLine(cuff, -0.012), 0.006, lift(boot, 0.25), 0.4);
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.09;
    taper(g, S, [0.4, bt + 0.14], [0.42, (bt + 1.2) / 2], [0.4, 1.2], 0.02, 0.06, 0.02);
    g.globalAlpha = 1;
    const bdk = sink(boot, 0.45), bhi = lift(boot, 0.28);
    fold(g, S, [0.16, 1.1], [0.3, 1.14], [0.44, 1.1], 0.012, bdk, bhi, 0.8);
    fold(g, S, [0.5, 1.15], [0.64, 1.18], [0.78, 1.14], 0.011, bdk, bhi, 0.7);
    fold(g, S, [0.26, 1.2], [0.36, 1.225], [0.48, 1.205], 0.009, bdk, bhi, 0.6);
    fillShape(g, S, [[-0.05, H - 0.035], [W + 0.05, H - 0.035], [W + 0.05, H + 0.05], [-0.05, H + 0.05]], sink(boot, 0.5));
    strokeLine(g, S, top, 0.011, line);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  legCache.set(key, t);
  return t;
}
