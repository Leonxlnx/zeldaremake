/**
 * Procedural grass-clump atlas for the turf carpet (round 39): one 2048² canvas, seeded, holding
 * six clump tiles (1024 × 512, a fan of 200-odd fine blades rising from a dense root mass) and
 * four turf-mat tiles (512², a flat blob of short blade dabs with a ragged rim). The cards that
 * carry it (carpet.ts) are alpha-tested, so the atlas stores coverage in alpha and *data* in the
 * colour channels rather than a colour: R is the blade lightness (per-blade brightness × root→tip
 * gradient, back blades darker), G the translucency (thin lit tips → 1, the root mass → 0), and
 * the vertex shader supplies the hue from the grass palette exactly as the blade tiles do
 * (materials.ts CARD_COLOR_VERTEX), so a card clump and the blades beside it share one colour
 * pipeline. Linear (NoColorSpace) data; mipmapped, anisotropic (the mats are seen at grazing angles).
 *
 * Tile layout (canvas rows from the top; three flips the canvas on upload so canvas-bottom = v 0):
 *   rows 0–2: clump tiles 0–5, two per row, each 0.5 × 0.25 of uv, block top at v = 1
 *   row 3:    mat tiles 0–3, four across, each 0.25 × 0.25, block top at v = 0.25
 * `CLUMP_GRID` / `MAT_GRID` describe the blocks for the shader as (tile w, tile h, columns, top v).
 */
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, type Texture } from 'three';
import type { Rng } from '../util/prng';

export const ATLAS_SIZE = 2048;
export const CLUMP_TILES = 6;
export const MAT_TILES = 4;
/** (tile width, tile height, columns, top v of the block) in uv space */
export const CLUMP_GRID: readonly [number, number, number, number] = [0.5, 0.25, 2, 1];
export const MAT_GRID: readonly [number, number, number, number] = [0.25, 0.25, 4, 0.25];

export interface ClumpAtlas {
  /** null where there is no DOM canvas (node tests) — the cards then render untextured, which no capture does */
  texture: Texture | null;
  size: number;
  clumpTiles: number;
  matTiles: number;
  /** measured coverage (alpha ≥ 0.5) of the clump tiles' lower half and of the mat tiles' inner disc, 0..1 */
  coverage: { clumpLowerHalf: number; matInner: number };
}

type Ctx2D = CanvasRenderingContext2D;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** rgba() css for the data channels (R lightness, G translucency, B unused) */
const data = (light: number, trans: number, alpha = 1) => `rgba(${Math.round(clamp01(light) * 255)}, ${Math.round(clamp01(trans) * 255)}, 255, ${alpha})`;

/**
 * One tapered blade as a filled path along a quadratic curve from `root` to `tip` bowing toward
 * `ctrl`; `w0` is the base half-width in px, the tip is a point. The lightness runs root → tip.
 */
function blade(c: Ctx2D, rx: number, ry: number, cx: number, cy: number, tx: number, ty: number, w0: number, lightRoot: number, lightTip: number, transRoot: number, transTip: number) {
  // side offsets: perpendicular to the root → tip chord
  const dx = tx - rx;
  const dy = ty - ry;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  c.beginPath();
  c.moveTo(rx + nx * w0, ry + ny * w0);
  c.quadraticCurveTo(cx + nx * w0 * 0.55, cy + ny * w0 * 0.55, tx, ty);
  c.quadraticCurveTo(cx - nx * w0 * 0.55, cy - ny * w0 * 0.55, rx - nx * w0, ry - ny * w0);
  c.closePath();
  const grad = c.createLinearGradient(rx, ry, tx, ty);
  grad.addColorStop(0, data(lightRoot, transRoot));
  grad.addColorStop(0.55, data((lightRoot + lightTip) * 0.5, (transRoot + transTip) * 0.5));
  grad.addColorStop(1, data(lightTip, transTip));
  c.fillStyle = grad;
  c.fill();
}

/** a clump tile: `w × h` px at canvas (x0, y0); the root mass sits on the tile's bottom edge, centred */
function drawClump(c: Ctx2D, rng: Rng, x0: number, y0: number, w: number, h: number) {
  const bottom = y0 + h;
  const cx = x0 + w * 0.5;
  const gauss = () => Math.max(-2.4, Math.min(2.4, rng.gauss()));
  // the fan: back blades first (darker, more translucent tips lit through), front blades last
  const blades = 190 + rng.int(0, 50);
  for (let i = 0; i < blades; i++) {
    const depth = i / blades;
    const rootX = cx + gauss() * w * 0.045;
    const rootY = bottom + 4 - rng() * h * 0.06;
    const length = h * (0.32 + 0.66 * Math.pow(rng(), 0.8));
    // lean: the fan opens with height; a few blades fall right over
    const lean = gauss() * 0.42 + (rng() < 0.08 ? (rng() < 0.5 ? -1 : 1) * 0.9 : 0);
    const bendSide = (rng() - 0.5) * 0.7;
    const tx = rootX + Math.sin(lean) * length;
    const ty = rootY - Math.cos(lean) * length;
    const mx = (rootX + tx) * 0.5 + Math.cos(lean) * bendSide * length * 0.35;
    const my = (rootY + ty) * 0.5 + Math.sin(lean) * bendSide * length * 0.35;
    const w0 = (2.6 + rng() * 4.2) * (0.75 + 0.25 * (length / h));
    const bright = (0.5 + 0.5 * depth) * (0.72 + rng() * 0.36);
    const lightRoot = 0.22 + 0.2 * depth;
    const lightTip = clamp01(0.55 + 0.5 * bright);
    blade(c, rootX, rootY, mx, my, tx, ty, w0, lightRoot, lightTip, 0.05, 0.55 + 0.45 * depth);
  }
  // the root mass: short broad blades packed at the base so the card's foot is closed
  const roots = 110 + rng.int(0, 30);
  for (let i = 0; i < roots; i++) {
    const rootX = cx + gauss() * w * 0.11;
    const rootY = bottom + 3;
    const length = h * (0.08 + 0.2 * rng());
    const lean = gauss() * 0.75;
    const tx = rootX + Math.sin(lean) * length;
    const ty = rootY - Math.cos(lean) * length;
    const w0 = 3.5 + rng() * 5;
    blade(c, rootX, rootY, (rootX + tx) * 0.5, (rootY + ty) * 0.5, tx, ty, w0, 0.18 + 0.1 * rng(), 0.42 + 0.25 * rng(), 0.02, 0.2);
  }
}

/** a turf-mat tile: a ragged blob of short blade dabs over a closed base, `size` px square at (x0, y0) */
function drawMat(c: Ctx2D, rng: Rng, x0: number, y0: number, size: number) {
  const cx = x0 + size * 0.5;
  const cy = y0 + size * 0.5;
  const R = size * 0.47;
  // the base blob: a few harmonics on the radius, closed inside (the alpha test never opens it)
  const k1 = 2 + rng.int(0, 2);
  const k2 = 5 + rng.int(0, 3);
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const rim = (a: number) => R * (0.8 + 0.09 * Math.sin(a * k1 + p1) + 0.06 * Math.sin(a * k2 + p2));
  c.beginPath();
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const r = rim(a);
    if (i === 0) c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
  c.fillStyle = data(0.34, 0.08);
  c.fill();
  // dabs: dense inside, thinning across the last 20 % so the rim is a fringe of blade ends
  const dabs = 780 + rng.int(0, 160);
  for (let i = 0; i < dabs; i++) {
    const a = rng() * Math.PI * 2;
    const rr = Math.pow(rng(), 0.55) * R;
    const edgeK = clamp01((rr - rim(a) * 0.82) / (R - rim(a) * 0.82));
    if (edgeK > 0 && rng() < edgeK * 0.85) continue;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    const dir = rng() * Math.PI * 2;
    const length = size * (0.035 + 0.075 * rng());
    const tx = px + Math.cos(dir) * length;
    const ty = py + Math.sin(dir) * length;
    const bend = (rng() - 0.5) * length * 0.5;
    const mx = (px + tx) * 0.5 - Math.sin(dir) * bend;
    const my = (py + ty) * 0.5 + Math.cos(dir) * bend;
    const w0 = 2 + rng() * 3.5;
    const light = 0.42 + 0.58 * rng();
    blade(c, px, py, mx, my, tx, ty, w0, light * 0.8, Math.min(1, light * 1.1), 0.1, 0.3);
  }
}

/** share of pixels with alpha ≥ 0.5 in a canvas rectangle */
function coverage(c: Ctx2D, x: number, y: number, w: number, h: number): number {
  const img = c.getImageData(x, y, w, h).data;
  let n = 0;
  for (let i = 3; i < img.length; i += 4) if (img[i] >= 128) n++;
  return n / (img.length / 4);
}

export function createClumpAtlas(rng: Rng, size = ATLAS_SIZE): ClumpAtlas {
  const r = rng.fork('carpet/atlas');
  if (typeof document === 'undefined') {
    // node: the placement tests run without a canvas; draw nothing, keep the stream untouched
    return { texture: null, size, clumpTiles: CLUMP_TILES, matTiles: MAT_TILES, coverage: { clumpLowerHalf: 0, matInner: 0 } };
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, size, size);
  const tileW = size * CLUMP_GRID[0];
  const tileH = size * CLUMP_GRID[1];
  for (let i = 0; i < CLUMP_TILES; i++) {
    const col = i % CLUMP_GRID[2];
    const row = Math.floor(i / CLUMP_GRID[2]);
    const x0 = col * tileW;
    const y0 = row * tileH;
    c.save();
    c.beginPath();
    c.rect(x0, y0, tileW, tileH);
    c.clip();
    drawClump(c, r.fork(`clump/${i}`), x0, y0, tileW, tileH);
    c.restore();
  }
  const matSize = size * MAT_GRID[0];
  const matY = size * (1 - MAT_GRID[3]);
  for (let j = 0; j < MAT_TILES; j++) {
    const x0 = j * matSize;
    c.save();
    c.beginPath();
    c.rect(x0, matY, matSize, matSize);
    c.clip();
    drawMat(c, r.fork(`mat/${j}`), x0, matY, matSize);
    c.restore();
  }
  const cov = {
    clumpLowerHalf: coverage(c, tileW * 0.25, tileH * 0.5, tileW * 0.5, tileH * 0.5),
    matInner: coverage(c, matSize * 0.25, matY + matSize * 0.25, matSize * 0.5, matSize * 0.5),
  };
  const texture = new CanvasTexture(canvas);
  texture.name = 'procedural:grass-clump-atlas';
  texture.colorSpace = NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return { texture, size, clumpTiles: CLUMP_TILES, matTiles: MAT_TILES, coverage: cov };
}
