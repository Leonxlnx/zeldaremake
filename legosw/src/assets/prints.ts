import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';

/**
 * Pad-printed decoration for minifigures, drawn with Canvas2D in the flat, outlined style of
 * licensed LEGO prints: faces (with animatable expressions), torsos and leg prints.
 *
 * Head texture: 1792 × 512, wraps 360° around the head (u = 0.5 is the nose direction), covering
 * the head's height; 1 head unit = 475 px in both directions, so shapes are drawn undistorted.
 */
export const FACE_W = 1792;
export const FACE_H = 512;
export const FACE_PX = 475;
export const HEAD_H = 1.08;

export type Mouth = 'smile' | 'smirk' | 'grin' | 'open' | 'talk' | 'o' | 'grit' | 'frown' | 'shout' | 'flat';

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
}

const INK = '#15110e';

/** head-unit coordinates → canvas (x = arc distance from the nose, y = height above the neck) */
function P(x: number, y: number): [number, number] {
  return [FACE_W / 2 + x * FACE_PX, (HEAD_H - y) * FACE_PX];
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  const [cx, cy] = P(x, y);
  g.beginPath();
  g.ellipse(cx, cy, rx * FACE_PX, ry * FACE_PX, rot, 0, Math.PI * 2);
}

function path(g: CanvasRenderingContext2D, pts: [number, number][], close = false) {
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const [cx, cy] = P(x, y);
    if (i === 0) g.moveTo(cx, cy);
    else g.lineTo(cx, cy);
  });
  if (close) g.closePath();
}

/** Quadratic-curve helper in head units. */
function curve(g: CanvasRenderingContext2D, a: [number, number], c: [number, number], b: [number, number], move = true) {
  const [ax, ay] = P(...a), [cx, cy] = P(...c), [bx, by] = P(...b);
  if (move) g.moveTo(ax, ay);
  g.quadraticCurveTo(cx, cy, bx, by);
}

export function drawFace(g: CanvasRenderingContext2D, style: FaceStyle, s: FaceState): void {
  g.save();
  g.fillStyle = style.skin;
  g.fillRect(0, 0, FACE_W, FACE_H);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const eyeY = 0.6;
  const eyeX = 0.2;
  // beard first (under the mouth line work)
  if (style.beard) drawBeard(g, style, s);
  if (style.stubble) {
    g.fillStyle = 'rgba(120,80,60,0.10)';
    path(g, [[-0.44, 0.42], [-0.3, 0.12], [0, 0.05], [0.3, 0.12], [0.44, 0.42], [0.3, 0.3], [0, 0.26], [-0.3, 0.3]], true);
    g.fill();
  }
  // cheek / eye-bag lines
  if (style.cheekLines) {
    g.strokeStyle = style.line;
    g.lineWidth = 0.012 * FACE_PX;
    for (const sgn of [-1, 1]) {
      g.beginPath();
      curve(g, [sgn * 0.27, 0.5], [sgn * 0.3, 0.42], [sgn * 0.26, 0.36]);
      g.stroke();
      g.beginPath();
      curve(g, [sgn * 0.13, 0.52], [sgn * 0.2, 0.5], [sgn * 0.27, 0.53]);
      g.globalAlpha = 0.5;
      g.stroke();
      g.globalAlpha = 1;
    }
  }
  // eyes
  const blink = Math.min(1, s.blink);
  for (const sgn of [-1, 1]) {
    const x = sgn * eyeX + s.lookX * 0.4;
    const y = eyeY + s.lookY * 0.4;
    const h = 0.085 * (1 - blink * 0.92) * (1 - s.squint * 0.3);
    if (blink > 0.85) {
      g.strokeStyle = INK;
      g.lineWidth = 0.022 * FACE_PX;
      g.beginPath();
      curve(g, [x - 0.055, y], [x, y - 0.025], [x + 0.055, y]);
      g.stroke();
    } else {
      g.fillStyle = INK;
      ellipse(g, x, y, 0.058, h * 1.1);
      g.fill();
      // specular glints
      g.fillStyle = '#ffffff';
      ellipse(g, x - 0.017 + s.lookX * 0.2, y + h * 0.42, 0.016, Math.min(0.02, h * 0.3));
      g.fill();
      ellipse(g, x + 0.02 + s.lookX * 0.2, y - h * 0.38, 0.008, Math.min(0.01, h * 0.16));
      g.fill();
      // squint lower lid
      if (s.squint > 0.05) {
        g.fillStyle = style.skin;
        ellipse(g, x, y - h * (1.55 - s.squint * 0.55), 0.07, h * 0.9);
        g.fill();
      }
      // upper lid crease
      g.strokeStyle = style.line;
      g.lineWidth = 0.009 * FACE_PX;
      g.globalAlpha = 0.8;
      g.beginPath();
      curve(g, [x - sgn * 0.035 - 0.03 * sgn, y + h + 0.018], [x + sgn * 0.01, y + h + 0.045 + s.brows * 0.01], [x + sgn * 0.075, y + h + 0.005]);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
  // frown furrow between the brows
  if (s.brows < -0.4) {
    g.strokeStyle = style.line;
    g.lineWidth = 0.01 * FACE_PX;
    g.globalAlpha = Math.min(1, (-s.brows - 0.4) * 2);
    for (const sgn of [-1, 1]) {
      g.beginPath();
      curve(g, [sgn * 0.035, 0.82], [sgn * 0.045, 0.77], [sgn * 0.03, 0.72]);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  // worry lines on the forehead
  if (s.brows > 0.5) {
    g.strokeStyle = style.line;
    g.lineWidth = 0.008 * FACE_PX;
    g.globalAlpha = Math.min(0.8, (s.brows - 0.5) * 2);
    for (const yy of [0.9, 0.95]) {
      g.beginPath();
      curve(g, [-0.13, yy - 0.01], [0, yy + 0.012], [0.13, yy - 0.01]);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  // smile lines for open / grinning mouths
  if (s.mouth === 'grin' || s.mouth === 'grit' || s.mouth === 'shout' || s.mouth === 'open') {
    g.strokeStyle = style.line;
    g.lineWidth = 0.01 * FACE_PX;
    for (const sgn of [-1, 1]) {
      g.beginPath();
      curve(g, [sgn * 0.14, 0.45], [sgn * 0.2, 0.38], [sgn * 0.18, 0.3]);
      g.stroke();
    }
  }
  // eyebrows: thick tapered strokes, inner end raised by +brows
  g.fillStyle = style.brow;
  for (const sgn of [-1, 1]) {
    const inner = 0.08, outer = 0.31;
    const yIn = 0.765 + s.brows * 0.045 - Math.max(0, -s.brows) * 0.01;
    const yOut = 0.77 - s.brows * 0.012;
    const yMid = 0.8 + s.brows * 0.012;
    const ax = sgn * inner, bx = sgn * outer;
    const [p0x, p0y] = P(ax, yIn), [p1x, p1y] = P((ax + bx) / 2, yMid + 0.012), [p2x, p2y] = P(bx, yOut);
    const t = 0.036 * FACE_PX;
    g.beginPath();
    g.moveTo(p0x, p0y - t * 0.55);
    g.quadraticCurveTo(p1x, p1y - t * 0.8, p2x, p2y - t * 0.15);
    g.quadraticCurveTo(p1x, p1y + t * 0.35, p0x, p0y + t * 0.55);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.globalAlpha = 0.35;
    g.lineWidth = 2;
    g.stroke();
    g.globalAlpha = 1;
  }
  if (style.scar) {
    // Anakin: the scar through his right brow (viewer's left) onto the cheek
    g.strokeStyle = '#b27a64';
    g.lineWidth = 0.011 * FACE_PX;
    g.beginPath();
    curve(g, [-0.215, 0.86], [-0.2, 0.72], [-0.225, 0.52]);
    g.stroke();
  }
  // nose hint
  g.strokeStyle = style.line;
  g.lineWidth = 0.011 * FACE_PX;
  g.beginPath();
  curve(g, [-0.03, 0.47], [0, 0.445], [0.035, 0.465]);
  g.stroke();
  drawMouth(g, style, s.mouth);
  g.restore();
}

function drawMouth(g: CanvasRenderingContext2D, style: FaceStyle, m: Mouth): void {
  const y = 0.33;
  g.strokeStyle = INK;
  g.lineWidth = 0.02 * FACE_PX;
  const teeth = (pts: [number, number][], upper = true, lower = false) => {
    g.fillStyle = '#5a1512';
    path(g, pts, true);
    g.fill();
    g.save();
    path(g, pts, true);
    g.clip();
    g.fillStyle = '#ffffff';
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (upper) {
      const [a, b] = P(x0, y1), [c, d] = P(x1, y1 - (y1 - y0) * 0.42);
      g.fillRect(a, b, c - a, d - b);
    }
    if (lower) {
      const [a, b] = P(x0, y0 + (y1 - y0) * 0.3), [c, d] = P(x1, y0);
      g.fillRect(a, b, c - a, d - b);
    }
    g.restore();
    g.lineWidth = 0.016 * FACE_PX;
    path(g, pts, true);
    g.stroke();
  };
  switch (m) {
    case 'smile':
      g.beginPath();
      curve(g, [-0.13, y + 0.03], [0, y - 0.05], [0.13, y + 0.03]);
      g.stroke();
      break;
    case 'smirk':
      g.beginPath();
      curve(g, [-0.11, y + 0.005], [0.02, y - 0.03], [0.14, y + 0.05]);
      g.stroke();
      g.lineWidth = 0.012 * FACE_PX;
      g.beginPath();
      curve(g, [0.13, y + 0.07], [0.155, y + 0.05], [0.15, y + 0.025]);
      g.stroke();
      break;
    case 'flat':
      g.beginPath();
      curve(g, [-0.1, y], [0, y - 0.008], [0.1, y]);
      g.stroke();
      break;
    case 'frown':
      g.beginPath();
      curve(g, [-0.11, y - 0.03], [0, y + 0.03], [0.11, y - 0.03]);
      g.stroke();
      break;
    case 'grin':
      teeth([[-0.15, y + 0.04], [0.15, y + 0.04], [0.1, y - 0.06], [-0.1, y - 0.06]], true, false);
      break;
    case 'open':
      teeth([[-0.12, y + 0.035], [0.12, y + 0.035], [0.07, y - 0.08], [-0.07, y - 0.08]], true, true);
      break;
    case 'talk':
      teeth([[-0.1, y + 0.03], [0.1, y + 0.03], [0.06, y - 0.045], [-0.06, y - 0.045]], true, false);
      break;
    case 'o':
      g.fillStyle = '#5a1512';
      ellipse(g, 0, y - 0.01, 0.045, 0.055);
      g.fill();
      g.lineWidth = 0.016 * FACE_PX;
      g.stroke();
      break;
    case 'shout':
      teeth([[-0.14, y + 0.05], [0.14, y + 0.05], [0.09, y - 0.11], [-0.09, y - 0.11]], true, true);
      break;
    case 'grit': {
      teeth([[-0.15, y + 0.035], [0.15, y + 0.035], [0.14, y - 0.045], [-0.14, y - 0.045]], true, true);
      g.strokeStyle = INK;
      g.lineWidth = 0.008 * FACE_PX;
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        const [a, b] = P(i * 0.036, y + 0.035), [c, d] = P(i * 0.036, y - 0.045);
        g.moveTo(a, b);
        g.lineTo(c, d);
        g.stroke();
      }
      g.beginPath();
      const [a, b] = P(-0.15, y - 0.005), [c, d] = P(0.15, y - 0.005);
      g.moveTo(a, b);
      g.lineTo(c, d);
      g.stroke();
      break;
    }
  }
}

function drawBeard(g: CanvasRenderingContext2D, style: FaceStyle, s: FaceState): void {
  const b = style.beard!;
  // full beard: sideburns down the jaw, around the chin, moustache above the mouth
  g.fillStyle = b.color;
  g.beginPath();
  const pts: [number, number][] = [
    [-0.56, 0.62], [-0.5, 0.36], [-0.38, 0.16], [-0.2, 0.05], [0, 0.02], [0.2, 0.05], [0.38, 0.16], [0.5, 0.36], [0.56, 0.62],
    [0.47, 0.6], [0.4, 0.44], [0.26, 0.37], [0.18, 0.41], [0.07, 0.43], [0, 0.415], [-0.07, 0.43], [-0.18, 0.41], [-0.26, 0.37], [-0.4, 0.44], [-0.47, 0.6],
  ];
  pts.forEach(([x, y], i) => {
    const [cx, cy] = P(x, y);
    if (i === 0) g.moveTo(cx, cy);
    else g.lineTo(cx, cy);
  });
  g.closePath();
  g.fill();
  // strand hatching
  g.strokeStyle = b.dark;
  g.lineWidth = 0.009 * FACE_PX;
  for (let i = 0; i < 26; i++) {
    const u = -0.46 + (i / 25) * 0.92;
    const top = 0.33 - Math.abs(u) * 0.1;
    g.beginPath();
    curve(g, [u, top], [u * 1.05, (top + 0.12) / 2], [u * 0.92, 0.1 + Math.abs(u) * 0.25]);
    g.globalAlpha = 0.55;
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = b.light;
  g.lineWidth = 0.006 * FACE_PX;
  for (let i = 0; i < 9; i++) {
    const u = -0.36 + (i / 8) * 0.72;
    g.beginPath();
    curve(g, [u, 0.28], [u * 1.02, 0.2], [u * 0.95, 0.14]);
    g.globalAlpha = 0.5;
    g.stroke();
  }
  g.globalAlpha = 1;
  // clear the mouth area (lip skin) so the mouth reads
  g.fillStyle = style.skin;
  ellipse(g, 0, 0.325, 0.13, 0.05);
  g.fill();
  // moustache
  g.fillStyle = b.color;
  path(g, [[-0.19, 0.345], [-0.12, 0.415], [0, 0.4], [0.12, 0.415], [0.19, 0.345], [0.1, 0.37], [0, 0.36], [-0.1, 0.37]], true);
  g.fill();
  g.strokeStyle = b.dark;
  g.lineWidth = 0.008 * FACE_PX;
  g.stroke();
  // chin tuft under the lip
  path(g, [[-0.045, 0.27], [0.045, 0.27], [0.03, 0.22], [-0.03, 0.22]], true);
  g.fillStyle = b.color;
  g.fill();
  // outline
  g.strokeStyle = b.dark;
  g.lineWidth = 0.01 * FACE_PX;
  g.beginPath();
  pts.slice(0, 9).forEach(([x, y], i) => {
    const [cx, cy] = P(x, y);
    if (i === 0) g.moveTo(cx, cy);
    else g.lineTo(cx, cy);
  });
  g.globalAlpha = 0.6;
  g.stroke();
  g.globalAlpha = 1;
  void s;
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

export const TORSO_W = 640;
export const TORSO_H = 500;

export interface TorsoStyle {
  base: string;
  robe: string;
  robeDark: string;
  inner: string;
  belt: string;
  buckle: string;
  skin: string;
  line: string;
  /** optional darker tabard layer over the robe (Anakin) */
  tabard?: string;
}

/** Torso front print in a unit square (u right, v down); the mesh maps its trapezoid onto it. */
export function torsoTexture(s: TorsoStyle, back = false): Texture {
  const c = document.createElement('canvas');
  c.width = TORSO_W;
  c.height = TORSO_H;
  const g = c.getContext('2d')!;
  const W = TORSO_W, H = TORSO_H;
  g.fillStyle = s.base;
  g.fillRect(0, 0, W, H);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const X = (u: number) => u * W;
  const Y = (v: number) => v * H;
  const poly = (pts: [number, number][], fill: string, stroke?: string, lw = 3) => {
    g.beginPath();
    pts.forEach(([u, v], i) => (i ? g.lineTo(X(u), Y(v)) : g.moveTo(X(u), Y(v))));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = lw;
      g.stroke();
    }
  };
  if (back) {
    // back: robe folds and belt only
    g.strokeStyle = s.line;
    g.globalAlpha = 0.5;
    g.lineWidth = 3;
    for (const u of [0.33, 0.5, 0.67]) {
      g.beginPath();
      g.moveTo(X(u), Y(0.12));
      g.quadraticCurveTo(X(u + 0.02), Y(0.45), X(u - 0.01), Y(0.8));
      g.stroke();
    }
    g.globalAlpha = 1;
    poly([[0, 0.8], [1, 0.8], [1, 0.93], [0, 0.93]], s.belt, s.line, 3);
  } else {
    // inner tunic V
    poly([[0.36, 0], [0.64, 0], [0.5, 0.42]], s.inner, s.line, 3);
    // neck skin V
    poly([[0.42, 0], [0.58, 0], [0.5, 0.17]], s.skin, s.line, 2.5);
    // robe crossover layers (left over right)
    poly([[0.2, 0], [0.36, 0], [0.5, 0.42], [0.58, 0.8], [0.4, 0.8], [0.24, 0.35]], s.robe, s.line, 3);
    poly([[0.8, 0], [0.64, 0], [0.5, 0.42], [0.43, 0.8], [0.6, 0.8], [0.76, 0.35]], s.robe, s.line, 3);
    if (s.tabard) {
      poly([[0.26, 0], [0.34, 0], [0.47, 0.44], [0.5, 0.8], [0.42, 0.8], [0.3, 0.36]], s.tabard, s.line, 2.5);
      poly([[0.74, 0], [0.66, 0], [0.53, 0.44], [0.5, 0.8], [0.58, 0.8], [0.7, 0.36]], s.tabard, s.line, 2.5);
    }
    // fold shading
    g.strokeStyle = s.robeDark;
    g.lineWidth = 4;
    g.globalAlpha = 0.9;
    for (const [a, b, c2] of [
      [[0.18, 0.5], [0.22, 0.62], [0.2, 0.76]],
      [[0.82, 0.5], [0.78, 0.62], [0.8, 0.76]],
      [[0.1, 0.25], [0.14, 0.4], [0.12, 0.55]],
      [[0.9, 0.25], [0.86, 0.4], [0.88, 0.55]],
    ] as [number, number][][]) {
      g.beginPath();
      g.moveTo(X(a[0]), Y(a[1]));
      g.quadraticCurveTo(X(b[0]), Y(b[1]), X(c2[0]), Y(c2[1]));
      g.stroke();
    }
    g.globalAlpha = 1;
    // belt with buckle and pouches
    poly([[0, 0.79], [1, 0.79], [1, 0.93], [0, 0.93]], s.belt, s.line, 3);
    poly([[0.43, 0.775], [0.57, 0.775], [0.57, 0.945], [0.43, 0.945]], s.buckle, s.line, 3);
    poly([[0.465, 0.815], [0.535, 0.815], [0.535, 0.905], [0.465, 0.905]], s.belt, s.line, 2);
    for (const u of [0.14, 0.72]) poly([[u, 0.82], [u + 0.13, 0.82], [u + 0.12, 0.98], [u + 0.01, 0.98]], s.belt, s.line, 3);
    // tunic hem below belt
    g.strokeStyle = s.line;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(X(0.5), Y(0.945));
    g.lineTo(X(0.5), Y(1));
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Leg front print: boots from `bootTop` (0..1 from the hip down) in the given colour. */
export function legTexture(base: string, boot: string | null, line: string, bootTop = 0.55): Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 320);
  if (boot) {
    g.fillStyle = boot;
    g.beginPath();
    g.moveTo(0, 320 * bootTop + 12);
    g.quadraticCurveTo(128, 320 * bootTop - 14, 256, 320 * bootTop + 12);
    g.lineTo(256, 320);
    g.lineTo(0, 320);
    g.closePath();
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = 4;
    g.stroke();
  }
  g.strokeStyle = line;
  g.globalAlpha = 0.35;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(128, 20);
  g.quadraticCurveTo(140, 100, 128, 320 * (boot ? bootTop : 0.9));
  g.stroke();
  g.globalAlpha = 1;
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
