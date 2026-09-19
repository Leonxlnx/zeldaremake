/**
 * Hand-drawn vector glyphs for the HUD: hearts, the few letters/digits the item slot needs
 * (4, Z, R, L, A, B), and button-tag helpers. Drawing these as strokes instead of font text keeps
 * headless captures identical across machines (no font fallback differences).
 */
import { g, path, radialGradient, ellipse, svgEl, type Attrs } from './svg';

/** Heart outline in a 24 × 20 box (red body), origin top-left. */
export const HEART_PATH =
  'M12 19.2 C7.4 15.6 0.6 11.6 0.6 6.6 C0.6 3.2 3.1 0.8 6.1 0.8 C8.7 0.8 10.9 2.3 12 4.3 C13.1 2.3 15.3 0.8 17.9 0.8 C20.9 0.8 23.4 3.2 23.4 6.6 C23.4 11.6 16.6 15.6 12 19.2 Z';

/** Gradient defs shared by every heart in one svg; call once per svg root. */
export function heartDefs(id = 'zr-heart-grad'): SVGElement {
  return svgEl('defs', {}, [
    radialGradient(
      id,
      [
        { offset: 0, color: '#ff7a58' },
        { offset: 0.4, color: '#e85440' },
        { offset: 0.8, color: '#c84234' },
        { offset: 1, color: '#a83022' },
      ],
      { cx: '38%', cy: '32%', r: '78%' },
    ),
  ]);
}

/** One heart, 24 × 20 red body plus outline, translated to (x, y) = top-left of the body box. */
export function heart(x: number, y: number, scale = 1, gradId = 'zr-heart-grad'): SVGGElement {
  return g({ transform: `translate(${x} ${y}) scale(${scale})` }, [
    // outline first (wide dark stroke), then the body on top so the rim stays crisp
    path(HEART_PATH, { fill: 'none', stroke: '#3a0d0a', 'stroke-width': 2.6, 'stroke-linejoin': 'round', opacity: 0.85 }),
    path(HEART_PATH, { fill: `url(#${gradId})`, stroke: '#8a1e14', 'stroke-width': 0.7 }),
    ellipse(7.6, 5.4, 3.1, 1.9, { fill: '#ffffff', opacity: 0.4, transform: 'rotate(-25 7.6 5.4)' }),
  ]);
}

/**
 * Stroke-font glyphs in a 10 × 14 cell (x 0..10, y 0..14). Each entry is a list of polylines /
 * path fragments in cell units. Only the characters the HUD needs.
 */
const GLYPHS: Record<string, string> = {
  '4': 'M7.2 14 V0.6 L1 9.4 H9.6',
  Z: 'M1 0.8 H9 L1 13.2 H9',
  R: 'M1.6 14 V0.8 H6 A3.3 3.3 0 0 1 6 7.4 H1.6 M5 7.4 L9 14',
  L: 'M1.6 0.8 V13.2 H9',
  A: 'M0.8 14 L5 0.8 L9.2 14 M2.4 9.4 H7.6',
  B: 'M1.6 0.8 H6 A3 3 0 0 1 6 6.8 H1.6 M1.6 6.8 H6.6 A3.4 3.4 0 0 1 6.6 13.6 H1.6 Z',
  '1': 'M2.4 3 L5.4 0.8 V14 M2.4 14 H8.4',
  '6': 'M8 0.8 C3 2.4 1.6 6 1.6 9.6 A3.8 4.2 0 0 0 9.2 9.6 A3.8 4 0 0 0 1.6 9.2',
  '0': 'M5 0.8 A3.6 6.6 0 0 1 5 14 A3.6 6.6 0 0 1 5 0.8 Z',
  '2': 'M1.4 3.4 A3.6 3.2 0 1 1 7.4 6.2 L1.2 14 H9',
  '/': 'M8 0.6 L2.4 14',
};

export interface GlyphStyle {
  /** cap height in output px */
  size: number;
  color: string;
  /** stroke width in output px */
  weight?: number;
  /** optional dark outline drawn under the glyph */
  outline?: string;
  outlineWidth?: number;
  /** extra spacing between characters as fraction of the cell width */
  tracking?: number;
}

/**
 * Lays out `str` as stroked glyphs starting at (x, y) = top-left of the first cell.
 * Returns the group and its advance width.
 */
export function strokeText(x: number, y: number, str: string, style: GlyphStyle): { node: SVGGElement; width: number } {
  const s = style.size / 14;
  const cell = 10 * s;
  const adv = cell * (1 + (style.tracking ?? 0.12));
  const w = style.weight ?? Math.max(1.2, style.size * 0.16);
  const grp = g({});
  let cx = x;
  const layers: { color: string; width: number }[] = [];
  if (style.outline) layers.push({ color: style.outline, width: (style.outlineWidth ?? w * 2.2) });
  layers.push({ color: style.color, width: w });
  for (const layer of layers) {
    cx = x;
    for (const ch of str) {
      const d = GLYPHS[ch];
      if (d) {
        grp.appendChild(
          path(d, {
            transform: `translate(${cx} ${y}) scale(${s})`,
            fill: 'none',
            stroke: layer.color,
            'stroke-width': layer.width / s,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }),
        );
      }
      cx += adv;
    }
  }
  return { node: grp, width: cx - x - adv * (style.tracking ?? 0.12) };
}

/** Rounded button tag (e.g. "ZR") — light plate with dark glyphs, centred on (cx, cy). */
export function buttonTag(cx: number, cy: number, label: string, opts: { w: number; h: number; glyph: number; plate?: string; ink?: string; radius?: number } & Attrs): SVGGElement {
  const plate = opts.plate ?? '#efebe1';
  const ink = opts.ink ?? '#1c1814';
  const r = opts.radius ?? Math.min(opts.w, opts.h) * 0.22;
  const cellW = (opts.glyph / 14) * 10;
  const total = label.length * cellW * 1.12 - cellW * 0.12;
  const { node } = strokeText(cx - total / 2, cy - opts.glyph / 2, label, { size: opts.glyph, color: ink, weight: Math.max(1, opts.glyph * 0.19), tracking: 0.12 });
  return g({}, [
    svgEl('rect', { x: cx - opts.w / 2, y: cy - opts.h / 2, width: opts.w, height: opts.h, rx: r, fill: '#2a2420', opacity: 0.55, transform: 'translate(0.6 0.9)' }),
    svgEl('rect', { x: cx - opts.w / 2, y: cy - opts.h / 2, width: opts.w, height: opts.h, rx: r, fill: plate, stroke: '#8c8578', 'stroke-width': 0.6 }),
    node,
  ]);
}

/** Dark round/square button glyph with a light letter (Switch style "A", "B", "R"). */
export function darkButton(cx: number, cy: number, label: string, size: number, shape: 'round' | 'square' = 'round'): SVGGElement {
  const glyph = size * 0.58;
  const cellW = (glyph / 14) * 10;
  const total = label.length * cellW * 1.12 - cellW * 0.12;
  const { node } = strokeText(cx - total / 2, cy - glyph / 2, label, { size: glyph, color: '#f2eee4', weight: Math.max(1, glyph * 0.18) });
  const bg =
    shape === 'round'
      ? svgEl('circle', { cx, cy, r: size / 2, fill: '#1b140c', stroke: '#6a5638', 'stroke-width': 1 })
      : svgEl('rect', { x: cx - size / 2, y: cy - size * 0.38, width: size, height: size * 0.76, rx: size * 0.16, fill: '#1b140c', stroke: '#6a5638', 'stroke-width': 1 });
  return g({}, [bg, node]);
}
