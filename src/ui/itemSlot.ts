/**
 * Equipped-item slot (top-right): dark rounded square with a diagonal Deku Stick, the count "4"
 * at the lower-right, a small "ZR" tag below and a tiny "R" indicator row above.
 * Reference: square 0.892–0.958 × 0.059–0.179 (design px 1142–1226 × 43–127); the stick pokes out
 * above (fork + leaf) and below (butt end) the square.
 */
import { svgRoot, svgEl, g, path, rect, ellipse, linearGradient, fmt } from './svg';
import { strokeText, buttonTag } from './glyphs';

/** Design-space box of the item svg (1280 × 720 basis). */
export const ITEM_BOX = { x: 1136, y: 8, w: 100, h: 148 };

/** Polygon around a centre-line with per-point half-widths (a tapered branch). */
function taperedPath(centre: [number, number][], halfWidths: number[]): string {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < centre.length; i++) {
    const [x, y] = centre[i];
    const [px, py] = centre[Math.max(0, i - 1)];
    const [nx, ny] = centre[Math.min(centre.length - 1, i + 1)];
    let tx = nx - px;
    let ty = ny - py;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const w = halfWidths[i];
    left.push([x - ty * w, y + tx * w]);
    right.push([x + ty * w, y - tx * w]);
  }
  const pts = [...left, ...right.reverse()];
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`).join(' ') + ' Z';
}

export function createItemSlot(count = 4): SVGSVGElement {
  const root = svgRoot([0, 0, ITEM_BOX.w, ITEM_BOX.h], { class: 'zr-hud-el zr-hud-item', 'aria-hidden': 'true' });
  root.appendChild(
    svgEl('defs', {}, [
      linearGradient(
        'zr-stick-grad',
        [
          { offset: 0, color: '#b48c5c' },
          { offset: 0.5, color: '#8a6640' },
          { offset: 1, color: '#5c3f24' },
        ],
        { x1: '0', y1: '0', x2: '1', y2: '0' },
      ),
      linearGradient(
        'zr-slot-grad',
        [
          { offset: 0, color: '#14110d' },
          { offset: 1, color: '#070605' },
        ],
        { x1: '0', y1: '0', x2: '0', y2: '1' },
      ),
    ]),
  );

  // --- the dark square -------------------------------------------------------------------------
  const sq = { x: 6, y: 35, s: 84 };
  root.appendChild(
    g({}, [
      rect(sq.x, sq.y, sq.s, sq.s, { rx: 5, fill: 'url(#zr-slot-grad)', opacity: 0.86 }),
      rect(sq.x + 0.8, sq.y + 0.8, sq.s - 1.6, sq.s - 1.6, { rx: 4.4, fill: 'none', stroke: '#3d352b', 'stroke-width': 1.6 }),
      rect(sq.x + 2.4, sq.y + 2.4, sq.s - 4.8, sq.s - 4.8, { rx: 3.4, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.8, opacity: 0.07 }),
    ]),
  );

  // --- indicator row above: two dim squares, the white R plate, one dim square ---------------
  const rowY = 22.5;
  const dim = (x: number, o: number) =>
    rect(x - 2.2, rowY - 2.2, 4.4, 4.4, { rx: 0.8, fill: '#8f897c', opacity: o, stroke: '#d9d5c9', 'stroke-width': 0.5 });
  root.appendChild(g({}, [dim(19, 0.7), dim(29.5, 0.7), buttonTag(45, rowY, 'R', { w: 15, h: 10.5, glyph: 6.8, radius: 2 }), dim(63.5, 0.42)]));

  // --- Deku Stick: tapered shaft with a fork at the top and one leaf ---------------------------
  // centre-line wobbles slightly and the girth varies (a gnarled branch, not a dowel)
  const shaft: [number, number][] = [
    [22, 138],
    [25.5, 126],
    [30.5, 112],
    [34, 100],
    [39.5, 88],
    [45.5, 74],
    [49, 64],
    [52.5, 54],
    [57, 44],
    [60, 35],
    [62, 27],
  ];
  const shaftW = [4.0, 3.7, 3.9, 3.3, 3.6, 4.1, 3.4, 3.1, 3.3, 2.8, 2.5];
  const prongA: [number, number][] = [
    [62, 28],
    [60, 20],
    [59, 13],
    [58.5, 6],
  ];
  const prongB: [number, number][] = [
    [62.5, 28],
    [66.5, 20],
    [71, 13],
    [76, 5],
  ];
  const twig: [number, number][] = [
    [56, 44],
    [64, 40],
    [73, 39],
    [81, 42],
  ];
  const nub: [number, number][] = [
    [44, 76],
    [39.5, 71],
    [36.5, 69.5],
  ];
  const stickStyle = { fill: 'url(#zr-stick-grad)', stroke: '#3a2412', 'stroke-width': 1.1, 'stroke-linejoin': 'round' };
  const stick = g({}, [
    path(taperedPath(twig, [1.9, 1.5, 1.2, 0.9]), stickStyle),
    path(taperedPath(nub, [2.2, 1.4, 0.8]), stickStyle),
    path(taperedPath(prongA, [2.1, 1.6, 1.2, 0.8]), stickStyle),
    path(taperedPath(prongB, [2.3, 1.7, 1.2, 0.8]), stickStyle),
    path(taperedPath(shaft, shaftW), stickStyle),
    // bark texture: dark fibres, a light edge, one knot
    path('M28 118 L31 106 M36 96 L39 86 M47 68 L50 58 M56 44 L59 35 M63 22 L66 17', { stroke: '#4a2f18', 'stroke-width': 0.7, opacity: 0.7, 'stroke-linecap': 'round' }),
    path('M24 128 L27.5 116 M42 82 L45.5 72 M53 52 L56 45', { stroke: '#e6c890', 'stroke-width': 0.7, opacity: 0.6, 'stroke-linecap': 'round' }),
    ellipse(45.5, 76, 1.6, 2.2, { fill: '#4a2f18', opacity: 0.85, transform: 'rotate(-30 45.5 76)' }),
    ellipse(33, 104, 1.1, 1.7, { fill: '#4a2f18', opacity: 0.7 }),
    // leaf at the tip of the twig
    g({ transform: 'rotate(34 85 47)' }, [
      ellipse(85, 47, 3.4, 6.6, { fill: '#6f9a3a', stroke: '#31501c', 'stroke-width': 0.9 }),
      path('M85 40.8 V53.2', { stroke: '#3d6423', 'stroke-width': 0.7 }),
      ellipse(84, 45, 1.2, 2.6, { fill: '#a4cc63', opacity: 0.55 }),
    ]),
  ]);
  root.appendChild(stick);

  // --- count at the lower-right ----------------------------------------------------------------
  root.appendChild(strokeText(69, 96, String(count), { size: 20, color: '#f3f0e8', weight: 2.7, outline: '#15120e', outlineWidth: 5.4 }).node);

  // --- ZR tag below the square -----------------------------------------------------------------
  root.appendChild(buttonTag(46, 133.5, 'ZR', { w: 24, h: 15, glyph: 8, radius: 3 }));

  return root;
}
