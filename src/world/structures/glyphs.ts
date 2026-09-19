/**
 * Carved sign lettering (round 47, structures-30 — owner review 2026-09-19 ref-01: the plaza
 * signpost carries two rows of angular glyphs that read as WRITING at 1–2 m — a consistent
 * baseline and cap height, one stroke weight, letterforms built from bars, diagonals and hooks
 * — cut into the board with a dark fill and a lit lower lip).
 *
 * The glyphs are stroke lists in the decal's normalised space (x, y ∈ 0..1, y up), generated
 * once from a seeded stream and shared by the canvas that paints the decal (materials.ts
 * `runeTextures`: fill, bevel lips, normal map) and the plank carving (signpost.ts: the board's
 * front face is sunk along the same strokes), so the relief and the paint agree to the texel.
 */
import { clamp } from '../util/noise';

export interface GlyphStroke {
  /** end points in decal space (x right, y up, both 0..1) */
  a: [number, number];
  b: [number, number];
  /** stroke half-width in decal-x units */
  hw: number;
}

/**
 * Letterform templates on a 4 × 6 unit cell (x 0..4, y 0..6, y up): segments between grid
 * points. Angular, built from bars and diagonals with an occasional hook — the family the
 * reference's board suggests without copying any real script.
 */
const FORMS: [number, number, number, number][][] = [
  // T
  [[0, 6, 4, 6], [2, 6, 2, 0]],
  // F
  [[0, 0, 0, 6], [0, 6, 4, 6], [0, 3, 3, 3]],
  // L
  [[0, 6, 0, 0], [0, 0, 4, 0]],
  // Z
  [[0, 6, 4, 6], [4, 6, 0, 0], [0, 0, 4, 0]],
  // N
  [[0, 0, 0, 6], [0, 6, 4, 0], [4, 0, 4, 6]],
  // 7 with a foot
  [[0, 6, 4, 6], [4, 6, 1, 0], [0, 0, 2, 0]],
  // Y
  [[0, 6, 2, 3], [4, 6, 2, 3], [2, 3, 2, 0]],
  // H
  [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  // A
  [[0, 0, 2, 6], [2, 6, 4, 0], [1, 2, 3, 2]],
  // cross with a base
  [[2, 0, 2, 6], [0, 4, 4, 4], [0, 0, 4, 0]],
  // U
  [[0, 6, 0, 0], [0, 0, 4, 0], [4, 0, 4, 6]],
  // K
  [[0, 0, 0, 6], [0, 3, 4, 6], [0, 3, 4, 0]],
  // bar over a hook (Π with a tail)
  [[0, 6, 4, 6], [0, 6, 0, 0], [4, 6, 4, 2], [4, 2, 2, 2]],
  // E without the middle
  [[0, 0, 0, 6], [0, 6, 4, 6], [0, 0, 4, 0]],
  // V with a bar
  [[0, 6, 2, 0], [2, 0, 4, 6], [1, 5, 3, 5]],
  // lambda
  [[0, 0, 2, 6], [2, 6, 4, 0], [2, 6, 2, 3]],
  // step (S angular)
  [[4, 6, 0, 6], [0, 6, 0, 3], [0, 3, 4, 3], [4, 3, 4, 0], [4, 0, 0, 0]],
  // gate
  [[0, 0, 0, 6], [4, 0, 4, 6], [0, 6, 4, 6], [2, 6, 2, 3]],
  // dot-bar (a bar with a dot under it)
  [[0, 6, 4, 6], [1.6, 2.2, 2.4, 2.2]],
  // arrow
  [[2, 0, 2, 6], [0, 4, 2, 6], [4, 4, 2, 6]],
];

export interface GlyphLayout {
  /** glyphs per row (row 1 is shorter, centred like a second word) */
  rows: [number, number];
  /** cap height as a share of the decal's height */
  capH: number;
  /** stroke half-width as a share of the decal's width */
  hw: number;
}

export const DEFAULT_GLYPH_LAYOUT: GlyphLayout = { rows: [9, 7], capH: 0.3, hw: 0.011 };

/** Two rows of glyphs. Deterministic: every draw comes from `rng`. */
export function makeGlyphs(rng: () => number, layout: GlyphLayout = DEFAULT_GLYPH_LAYOUT): GlyphStroke[] {
  const out: GlyphStroke[] = [];
  const total = layout.rows[0];
  // the cells: a fixed advance per glyph, a word gap after the fourth of the first row
  const cellW = 0.84 / (total + 0.6);
  const glyphW = cellW * 0.62;
  const rowY = [0.70, 0.28];
  for (let r = 0; r < 2; r++) {
    const n = layout.rows[r];
    const gap = r === 0 ? 0.6 : 0;
    const rowW = n * cellW + gap * cellW;
    let x = 0.5 - rowW / 2 + cellW * 0.19;
    for (let k = 0; k < n; k++) {
      if (r === 0 && k === 4) x += gap * cellW;
      const form = FORMS[Math.floor(rng() * FORMS.length) % FORMS.length];
      // per-glyph hand: a little scale, skew and baseline wobble
      const scale = 0.88 + rng() * 0.16;
      const skew = (rng() - 0.5) * 0.12;
      const dy = (rng() - 0.5) * 0.02;
      const hw = layout.hw * (0.9 + rng() * 0.2);
      const h = layout.capH * scale;
      const w = glyphW * scale;
      const x0 = x;
      const y0 = rowY[r] - h / 2 + dy;
      for (const [ax, ay, bx, by] of form) {
        const map = (gx: number, gy: number): [number, number] => [x0 + (gx / 4) * w + (gy / 6) * skew * w, y0 + (gy / 6) * h];
        out.push({ a: map(ax, ay), b: map(bx, by), hw });
      }
      x += cellW;
    }
  }
  return out;
}

/**
 * Signed distance (in decal-x units, the aspect handled by the caller) from (x, y) to the
 * nearest stroke's centre line, less its half-width: ≤ 0 inside a stroke.
 */
export function glyphDistance(strokes: GlyphStroke[], x: number, y: number, aspect: number): number {
  let best = Infinity;
  for (const s of strokes) {
    const ax = s.a[0];
    const ay = s.a[1] / aspect;
    const bx = s.b[0];
    const by = s.b[1] / aspect;
    const py = y / aspect;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 1e-12 ? clamp(((x - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    const ex = x - (ax + dx * t);
    const ey = py - (ay + dy * t);
    const d = Math.sqrt(ex * ex + ey * ey) - s.hw;
    if (d < best) best = d;
  }
  return best;
}
