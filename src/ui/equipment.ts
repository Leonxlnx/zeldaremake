/**
 * Pause / Equipment screen (rubric U02, reference frame 34 s):
 * full-screen dark warm wood panel, top bar with the four tabs (Equipment active), L/R glyphs,
 * hearts, rupee counter, carved scroll frame; left: the sockets panel; centre: oval vignette
 * with a slot for the character render (placeholder silhouette for now), item name, divider and
 * two-line description; right: 3 × 3 equipment slots (sword / shield / tunic rows) with the
 * selected slot framed gold with a glow; bottom-right button hints.
 *
 * One svg with a 1280 × 720 viewBox, `slice`-fitted to the host, so it is vector-crisp at 1080p.
 */
import { svgRoot, svgEl, g, path, rect, circle, ellipse, line, text, polygon, linearGradient, radialGradient, blurFilter, hexPath, flatHexPath, fmt, seeded } from './svg';
import { heart, heartDefs, darkButton } from './glyphs';

export const SANS = "'Gill Sans', 'Gill Sans MT', Cantarell, 'Trebuchet MS', 'Noto Sans', Inter, 'Segoe UI', system-ui, sans-serif";

const TEXT = '#e8e1cc';
const TEXT_BRIGHT = '#f6f1e6';
const WOOD_BG = '#171108';
const WOOD_FRAME = '#755b33';
const GOLD = '#c9a24a';

function spiral(cx: number, cy: number, r0: number, r1: number, turns: number, dir = 1, phase = 0): string {
  const n = Math.max(14, Math.round(turns * 18));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = phase + dir * t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    d += `${i ? ' L' : 'M'}${fmt(cx + Math.cos(a) * r)} ${fmt(cy + Math.sin(a) * r)}`;
  }
  return d;
}

/** Ornate scrollwork strip along the bottom edge of the top bar (mirrored for the right side). */
function scrollwork(mirror: boolean): SVGGElement {
  const parts: string[] = [
    spiral(46, 88, 2.5, 15, 1.7, -1, Math.PI * 0.2),
    spiral(114, 84, 2.5, 12, 1.5, 1, Math.PI * 1.1),
    spiral(176, 90, 2.5, 10, 1.4, -1, Math.PI * 0.4),
    'M60 88 C 74 68, 96 68, 106 84 M126 84 C 140 100, 154 102, 168 90 M186 90 C 200 78, 218 74, 240 71',
    'M8 94 C 22 104, 34 102, 44 92',
    'M70 100 C 82 106, 92 104, 98 96 M136 100 C 146 106, 156 104, 160 98',
  ];
  const grp = g({ transform: mirror ? 'translate(1280 0) scale(-1 1)' : undefined });
  for (const d of parts) {
    grp.appendChild(path(d, { fill: 'none', stroke: '#120c05', 'stroke-width': 5.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.8 }));
  }
  for (const d of parts) {
    grp.appendChild(path(d, { fill: 'none', stroke: '#8a6b3c', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  for (const d of parts) {
    grp.appendChild(path(d, { fill: 'none', stroke: '#c9a45e', 'stroke-width': 0.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.5, transform: 'translate(0 -0.8)' }));
  }
  return grp;
}

function woodBackground(): SVGGElement {
  const rnd = seeded(0x5eed);
  const grp = g({ class: 'zr-equip-wood' });
  grp.appendChild(rect(0, 0, 1280, 720, { fill: WOOD_BG }));
  const plankW = 160;
  for (let i = 0; i < 8; i++) {
    const x = i * plankW;
    grp.appendChild(rect(x, 0, plankW, 720, { fill: i % 2 ? '#191309' : '#150f07', opacity: 0.9 }));
    grp.appendChild(line(x + 0.5, 0, x + 0.5, 720, { stroke: '#0c0804', 'stroke-width': 1.2, opacity: 0.8 }));
    grp.appendChild(line(x + 2, 0, x + 2, 720, { stroke: '#2b2012', 'stroke-width': 0.8, opacity: 0.35 }));
    const grains = 7;
    for (let k = 0; k < grains; k++) {
      const gx = x + 10 + rnd() * (plankW - 20);
      const wobble = 6 + rnd() * 10;
      const d = `M${fmt(gx)} 0 C${fmt(gx + wobble)} 180, ${fmt(gx - wobble)} 360, ${fmt(gx + wobble * 0.6)} 540 S${fmt(gx - wobble * 0.4)} 700, ${fmt(gx)} 720`;
      grp.appendChild(path(d, { fill: 'none', stroke: '#3a2a14', 'stroke-width': 0.8 + rnd() * 0.8, opacity: 0.08 + rnd() * 0.07 }));
    }
  }
  // faint carved reliefs behind the panels (large hexagons, rings and knot-work bands)
  const reliefs = [
    flatHexPath(120, 130, 120, 100),
    flatHexPath(1180, 700, 130, 110),
    flatHexPath(60, 640, 110, 92),
    flatHexPath(1230, 90, 120, 100),
    flatHexPath(340, 640, 100, 84),
    flatHexPath(900, 120, 100, 84),
  ];
  for (const d of reliefs) {
    grp.appendChild(path(d, { fill: 'none', stroke: '#0e0a04', 'stroke-width': 6, opacity: 0.6, transform: 'translate(-2 -2)' }));
    grp.appendChild(path(d, { fill: 'none', stroke: '#3a2a12', 'stroke-width': 5, opacity: 0.45 }));
  }
  for (const [cx, cy] of [[330, 40], [950, 40], [200, 560], [1090, 600]] as [number, number][]) {
    grp.appendChild(circle(cx, cy, 120, { fill: 'none', stroke: '#0e0a04', 'stroke-width': 5, opacity: 0.5, transform: 'translate(-2 -2)' }));
    grp.appendChild(circle(cx, cy, 120, { fill: 'none', stroke: '#33240f', 'stroke-width': 4, opacity: 0.4 }));
  }
  // horizontal knot-work bands near the top and bottom of the side panels
  const band = (y: number, x0: number, x1: number) => {
    let d = '';
    for (let x = x0; x < x1; x += 40) d += `M${x} ${y} q10 -9 20 0 q10 9 20 0 `;
    return d;
  };
  for (const [y, x0, x1] of [[150, 20, 340], [640, 900, 1260], [700, 20, 340], [96, 900, 1260]] as [number, number, number][]) {
    grp.appendChild(path(band(y, x0, x1), { fill: 'none', stroke: '#0e0a04', 'stroke-width': 3.5, opacity: 0.55, transform: 'translate(-1 -1)' }));
    grp.appendChild(path(band(y, x0, x1), { fill: 'none', stroke: '#3a2a12', 'stroke-width': 2.5, opacity: 0.4 }));
  }
  // vignette
  grp.appendChild(rect(0, 0, 1280, 720, { fill: 'url(#zr-eq-vignette)' }));
  return grp;
}

function topBar(): SVGGElement {
  const edge = 'M0 72 C 360 36, 920 36, 1280 72';
  const barPath = `M0 0 H1280 V72 C 920 36, 360 36, 0 72 Z`;
  const grp = g({ class: 'zr-equip-topbar' });
  grp.appendChild(path(barPath, { fill: '#000', opacity: 0.45, filter: 'url(#zr-eq-blur6)', transform: 'translate(0 8)' }));
  grp.appendChild(path(barPath, { fill: 'url(#zr-eq-bar)' }));
  grp.appendChild(path(edge, { fill: 'none', stroke: WOOD_FRAME, 'stroke-width': 5 }));
  grp.appendChild(path(edge, { fill: 'none', stroke: '#a8884c', 'stroke-width': 1.2, opacity: 0.7, transform: 'translate(0 -2)' }));
  grp.appendChild(path(edge, { fill: 'none', stroke: '#2a1c0c', 'stroke-width': 1.4, opacity: 0.9, transform: 'translate(0 3)' }));
  grp.appendChild(scrollwork(false));
  grp.appendChild(scrollwork(true));

  // active tab plate (Equipment)
  grp.appendChild(path('M486 0 H640 V50 Q640 56 634 56 H492 Q486 56 486 50 Z', { fill: '#2c1b0d' }));
  grp.appendChild(path('M487.5 0 V49.5 Q487.5 54.5 492.5 54.5 H633.5 Q638.5 54.5 638.5 49.5 V0', { fill: 'none', stroke: '#5c4830', 'stroke-width': 1, opacity: 0.7 }));
  grp.appendChild(rect(486, 0, 154, 10, { fill: 'url(#zr-eq-plate-shadow)' }));

  const tabs: [string, number, boolean][] = [
    ['Collection', 410, false],
    ['Equipment', 563, true],
    ['Items', 717, false],
    ['System', 870, false],
  ];
  for (const [label, x, active] of tabs) {
    grp.appendChild(
      text(x, 34, label, {
        'text-anchor': 'middle',
        'font-size': 22,
        'font-weight': active ? 700 : 600,
        'letter-spacing': 0.4,
        fill: active ? TEXT_BRIGHT : TEXT,
        opacity: active ? 1 : 0.88,
      }),
    );
  }
  grp.appendChild(darkButton(307, 25, 'L', 17, 'square'));
  grp.appendChild(darkButton(973, 25, 'R', 17, 'square'));

  // hearts (small)
  for (let i = 0; i < 3; i++) grp.appendChild(heart(44 - 9.4 + i * 20, 26 - 7.8, 0.78, 'zr-eq-heart'));

  // rupee counter
  const rupee = g({ transform: 'translate(1152 25)' }, [
    polygon([[0, -13], [8, -6], [8, 6], [0, 13], [-8, 6], [-8, -6]], { fill: 'url(#zr-eq-rupee)', stroke: '#0b3a16', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
    polygon([[0, -13], [8, -6], [0, -1], [-8, -6]], { fill: '#a6f4ac', opacity: 0.45 }),
    polygon([[0, -1], [8, -6], [8, 6], [0, 13]], { fill: '#0e5a22', opacity: 0.35 }),
    line(0, -13, 0, 13, { stroke: '#dfffe0', 'stroke-width': 0.8, opacity: 0.5 }),
  ]);
  grp.appendChild(rupee);
  grp.appendChild(text(1170, 34, '16', { 'font-size': 26, 'font-weight': 700, fill: TEXT_BRIGHT }));
  grp.appendChild(text(1204, 34, '/', { 'font-size': 20, 'font-weight': 400, fill: '#d2c8b0' }));
  grp.appendChild(text(1213, 34, '200', { 'font-size': 16, 'font-weight': 500, fill: '#d8cfb8' }));
  return grp;
}

/** Inset socket with bevel (the empty carved slots). */
function socket(d: string, inner: string): SVGGElement {
  return g({}, [
    path(d, { fill: '#3a2f1b', transform: 'translate(2 2.5)' }),
    path(d, { fill: '#0a0704', transform: 'translate(-1.5 -1.5)' }),
    path(d, { fill: '#1b170b', stroke: '#332a18', 'stroke-width': 1.6 }),
    path(inner, { fill: 'none', stroke: '#0c0905', 'stroke-width': 2.2, opacity: 0.9 }),
  ]);
}

function shieldSocket(cx: number, y0: number, w: number, h: number, pointedTop: boolean, inset = 0): string {
  const hw = w / 2 - inset;
  const top = y0 + inset;
  const bot = y0 + h - inset;
  const side = h * 0.57;
  if (!pointedTop) return `M${fmt(cx - hw)} ${fmt(top)} H${fmt(cx + hw)} V${fmt(top + side)} L${fmt(cx)} ${fmt(bot)} L${fmt(cx - hw)} ${fmt(top + side)} Z`;
  return `M${fmt(cx)} ${fmt(top)} L${fmt(cx + hw)} ${fmt(bot - side)} V${fmt(bot)} H${fmt(cx - hw)} V${fmt(bot - side)} Z`;
}

function leftPanel(): SVGGElement {
  const grp = g({ class: 'zr-equip-left' });
  const cols = [118, 264];
  for (const cx of cols) {
    grp.appendChild(socket(shieldSocket(cx, 249, 110, 122, false), shieldSocket(cx, 249, 110, 122, false, 4)));
    grp.appendChild(socket(shieldSocket(cx, 438, 110, 122, true), shieldSocket(cx, 438, 110, 122, true, 4)));
  }
  grp.appendChild(socket(flatHexPath(190, 641, 97, 79), flatHexPath(190, 641, 89, 71)));
  // carved ornament between the sockets
  const orn = g({ transform: 'translate(191 404)' }, [
    path('M-22 -14 C -10 -22, 10 -22, 22 -14 M-22 14 C -10 22, 10 22, 22 14', { fill: 'none', stroke: '#6a5230', 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
    path('M-30 -18 L -22 -14 L -26 -6 M30 -18 L 22 -14 L 26 -6 M-30 18 L -22 14 L -26 6 M30 18 L 22 14 L 26 6', { fill: 'none', stroke: '#6a5230', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    circle(0, -7, 5, { fill: 'none', stroke: '#7a5e34', 'stroke-width': 2.2 }),
    circle(0, 7, 5, { fill: 'none', stroke: '#7a5e34', 'stroke-width': 2.2 }),
  ]);
  grp.appendChild(orn);
  // page arrows
  grp.appendChild(path('M25 391 L13 404 L25 417', { fill: 'none', stroke: '#8a7448', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  grp.appendChild(path('M1255 391 L1267 404 L1255 417', { fill: 'none', stroke: '#8a7448', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return grp;
}

/** Placeholder character silhouette; the real render will be attached in `#zr-equip-render-slot`. */
function characterPlaceholder(): SVGGElement {
  const fill = '#3a4030';
  const grp = g({ id: 'zr-equip-render-slot', 'data-slot': 'character', transform: 'translate(612 0)' }, [
    // cap
    path('M-40 226 C -38 196, -14 178, 6 180 C 40 184, 70 196, 100 214 C 110 220, 108 232, 96 228 C 74 222, 52 216, 34 222 C 22 226, 10 224, 0 226 Z', { fill: '#33402b' }),
    // head
    circle(0, 236, 33, { fill }),
    // ears
    path('M-30 232 L -52 226 L -30 244 Z M30 232 L 52 226 L 30 244 Z', { fill }),
    // neck + tunic
    path('M-12 266 H12 V280 L 44 292 L 52 334 L 40 336 L 34 320 L 36 436 H-36 L -34 320 L -40 336 L -52 334 L -44 292 L -12 280 Z', { fill: '#38452f' }),
    // belt
    rect(-36, 378, 72, 10, { fill: '#2a2318' }),
    circle(0, 383, 5, { fill: '#5a4a2a' }),
    // legs + boots
    path('M-30 436 L -34 520 L -46 526 L -44 538 L -10 538 L -8 436 Z M30 436 L 34 520 L 46 526 L 44 538 L 10 538 L 8 436 Z', { fill }),
    // shield on the back and sword hilt
    path('M-70 300 C -70 280, -50 272, -40 278 L -38 360 C -50 372, -68 368, -74 350 Z', { fill: '#2f2a20' }),
    path('M-44 262 L -58 240 L -52 236 L -40 258 Z', { fill: '#5a4a2a' }),
  ]);
  return grp;
}

function centreOval(): SVGGElement {
  const grp = g({ class: 'zr-equip-centre' });
  grp.appendChild(ellipse(615, 396, 265, 325, { fill: '#0a0805', opacity: 0.7, filter: 'url(#zr-eq-blur6)' }));
  grp.appendChild(ellipse(615, 396, 262, 322, { fill: 'url(#zr-eq-oval)', stroke: '#3d3320', 'stroke-width': 2.2 }));
  grp.appendChild(ellipse(615, 396, 258, 318, { fill: 'none', stroke: '#0f0c07', 'stroke-width': 3, opacity: 0.8 }));
  // floor shadow under the character
  grp.appendChild(ellipse(612, 545, 70, 12, { fill: '#000', opacity: 0.4, filter: 'url(#zr-eq-blur6)' }));
  grp.appendChild(characterPlaceholder());
  // item name + divider + description
  grp.appendChild(text(610, 549, 'Kokiri Sword', { 'text-anchor': 'middle', 'font-size': 36, 'font-weight': 600, 'letter-spacing': 0.6, fill: TEXT_BRIGHT }));
  grp.appendChild(line(412, 569, 808, 569, { stroke: '#c8b890', 'stroke-width': 1.2, opacity: 0.55 }));
  const curl = 'M412 569 C 404 569, 399 563, 404 561 C 409 559, 411 565, 406 566';
  grp.appendChild(path(curl, { fill: 'none', stroke: '#c8b890', 'stroke-width': 1.2, opacity: 0.7, 'stroke-linecap': 'round' }));
  grp.appendChild(path(curl, { fill: 'none', stroke: '#c8b890', 'stroke-width': 1.2, opacity: 0.7, 'stroke-linecap': 'round', transform: 'translate(1220 0) scale(-1 1)' }));
  grp.appendChild(text(610, 601, 'This small, child-sized sword is', { 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 400, fill: TEXT }));
  grp.appendChild(text(610, 631, 'a treasure of Kokiri Forest.', { 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 400, fill: TEXT }));
  return grp;
}

function swordIcon(cx: number, cy: number): SVGGElement {
  return g({ transform: `translate(${cx} ${cy}) rotate(-36)` }, [
    circle(0, 44, 5.5, { fill: '#6a5030', stroke: '#2a1a0c', 'stroke-width': 1 }),
    rect(-4, 0, 8, 42, { fill: '#3a2416', stroke: '#1c1008', 'stroke-width': 1 }),
    path('M-4 6 L4 10 M-4 14 L4 18 M-4 22 L4 26 M-4 30 L4 34', { stroke: '#8a5a30', 'stroke-width': 1.2, opacity: 0.8 }),
    rect(-21, -10, 42, 9, { rx: 2.5, fill: '#8a5a28', stroke: '#3a2410', 'stroke-width': 1.2 }),
    rect(-4.5, -10, 9, 7, { fill: '#b03030', stroke: '#5a1010', 'stroke-width': 0.8 }),
    polygon([[0, -76], [9.5, -60], [8, -10], [-8, -10], [-9.5, -60]], { fill: 'url(#zr-eq-steel)', stroke: '#4a5058', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
    path('M0 -72 L0 -12', { stroke: '#f7f9fc', 'stroke-width': 1.2, opacity: 0.8 }),
    path('M-3 -58 C 3 -50, -3 -40, 3 -30', { fill: 'none', stroke: '#6e767e', 'stroke-width': 1, opacity: 0.7 }),
  ]);
}

function shieldIcon(cx: number, cy: number): SVGGElement {
  const outline = 'M0 -42 C 20 -42, 34 -34, 34 -20 L 31 8 C 28 28, 14 40, 0 46 C -14 40, -28 28, -31 8 L -34 -20 C -34 -34, -20 -42, 0 -42 Z';
  return g({ transform: `translate(${cx} ${cy})` }, [
    path(outline, { fill: '#000', opacity: 0.35, transform: 'translate(2 3)' }),
    path(outline, { fill: 'url(#zr-eq-wood)', stroke: '#4a3218', 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    path('M-24 -30 C -26 -10, -22 10, -14 30 M24 -30 C 26 -10, 22 10, 14 30 M-10 -38 C -12 -10, -10 20, -4 40 M10 -38 C 12 -10, 10 20, 4 40', { fill: 'none', stroke: '#6b4a24', 'stroke-width': 1.1, opacity: 0.7 }),
    path(outline, { fill: 'none', stroke: '#c9a468', 'stroke-width': 1, opacity: 0.45, transform: 'scale(0.9)' }),
    path(spiral(0, 2, 1, 15, 2.1, 1, -Math.PI / 2), { fill: 'none', stroke: '#c43a2a', 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
    path('M-14 -2 C -18 -8, -12 -14, -6 -14', { fill: 'none', stroke: '#c43a2a', 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
  ]);
}

function tunicIcon(cx: number, cy: number): SVGGElement {
  const body = 'M-28 -40 L -10 -46 L 0 -40 L 10 -46 L 28 -40 L 41 -22 L 31 -12 L 24 -18 L 25 38 L -25 38 L -24 -18 L -31 -12 L -41 -22 Z';
  return g({ transform: `translate(${cx} ${cy})` }, [
    path(body, { fill: '#000', opacity: 0.35, transform: 'translate(2 3)' }),
    path(body, { fill: 'url(#zr-eq-tunic)', stroke: '#1e4a1c', 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    path('M-10 -46 L 0 -28 L 10 -46', { fill: 'none', stroke: '#1e4a1c', 'stroke-width': 1.6 }),
    path('M-14 -20 C -16 0, -14 20, -12 36 M14 -20 C 16 0, 14 20, 12 36 M0 -24 L 0 4', { fill: 'none', stroke: '#2b6a2c', 'stroke-width': 1.2, opacity: 0.7 }),
    rect(-25, 8, 50, 10, { fill: '#5a3a1e', stroke: '#2a1a0c', 'stroke-width': 1 }),
    circle(0, 13, 4.5, { fill: '#c8a850', stroke: '#4a3010', 'stroke-width': 1 }),
  ]);
}

function rightGrid(): SVGGElement {
  const grp = g({ class: 'zr-equip-right' });
  const cols = [947, 1066, 1184];
  const rowShape = (row: number, cx: number, inset = 0): string => {
    if (row === 0) {
      const w = 86 - inset * 2;
      const h = 176 - inset * 2;
      return rectPath(cx - w / 2, 245 - h / 2, w, h, 4);
    }
    if (row === 1) return hexPath(cx, 430, 104 - inset * 2, 148 - inset * 2.6);
    const w = 92 - inset * 2;
    const h = 128 - inset * 2;
    return rectPath(cx - w / 2, 590 - h / 2, w, h, 5);
  };
  for (let row = 0; row < 3; row++) {
    for (let c = 0; c < 3; c++) {
      const cx = cols[c];
      const d = rowShape(row, cx);
      if (c === 0) {
        grp.appendChild(path(d, { fill: 'url(#zr-eq-gold)', stroke: '#3a2a0c', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
        grp.appendChild(path(rowShape(row, cx, 3), { fill: 'none', stroke: '#c9a24a', 'stroke-width': 1, opacity: 0.4 }));
      } else {
        grp.appendChild(socket(d, rowShape(row, cx, 4)));
      }
    }
  }
  // selection frame on the sword slot
  grp.appendChild(rect(947 - 48, 245 - 93, 96, 186, { rx: 6, fill: 'none', stroke: '#fff0c0', 'stroke-width': 7, opacity: 0.55, filter: 'url(#zr-eq-blur4)' }));
  grp.appendChild(rect(947 - 45, 245 - 90, 90, 180, { rx: 4, fill: 'none', stroke: '#f8f0d8', 'stroke-width': 2.6 }));
  grp.appendChild(rect(947 - 45, 245 - 90, 90, 180, { rx: 4, fill: 'none', stroke: GOLD, 'stroke-width': 1, opacity: 0.8, transform: 'translate(0 0)' }));
  grp.appendChild(swordIcon(947, 245));
  grp.appendChild(shieldIcon(947, 430));
  grp.appendChild(tunicIcon(947, 590));
  return grp;
}

function rectPath(x: number, y: number, w: number, h: number, r: number): string {
  return `M${fmt(x + r)} ${fmt(y)} H${fmt(x + w - r)} Q${fmt(x + w)} ${fmt(y)} ${fmt(x + w)} ${fmt(y + r)} V${fmt(y + h - r)} Q${fmt(x + w)} ${fmt(y + h)} ${fmt(x + w - r)} ${fmt(y + h)} H${fmt(x + r)} Q${fmt(x)} ${fmt(y + h)} ${fmt(x)} ${fmt(y + h - r)} V${fmt(y + r)} Q${fmt(x)} ${fmt(y)} ${fmt(x + r)} ${fmt(y)} Z`;
}

function hints(): SVGGElement {
  const grp = g({ class: 'zr-equip-hints' });
  const label = (x: number, s: string) => text(x, 710, s, { 'font-size': 18, 'font-weight': 500, fill: TEXT, 'letter-spacing': 0.2 });
  grp.appendChild(label(983, 'Rotate'));
  grp.appendChild(darkButton(1052, 703, 'R', 18));
  // right-stick hint: tiny nub with two arrows
  grp.appendChild(path('M1063 700 L1066 703 L1063 706 M1067 709 L1070 712 L1073 709', { fill: 'none', stroke: '#d8d0bc', 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  grp.appendChild(label(1095, 'Set'));
  grp.appendChild(darkButton(1141, 703, 'A', 18));
  grp.appendChild(label(1184, 'Back'));
  grp.appendChild(darkButton(1238, 703, 'B', 18));
  return grp;
}

function defs(): SVGDefsElement {
  return svgEl('defs', {}, [
    radialGradient(
      'zr-eq-vignette',
      [
        { offset: 0, color: '#000', opacity: 0 },
        { offset: 0.6, color: '#000', opacity: 0.1 },
        { offset: 1, color: '#000', opacity: 0.5 },
      ],
      { cx: '50%', cy: '50%', r: '75%' },
    ),
    linearGradient(
      'zr-eq-bar',
      [
        { offset: 0, color: '#2a1f11' },
        { offset: 0.7, color: '#3a2b18' },
        { offset: 1, color: '#4c3a26' },
      ],
      { x1: '0', y1: '0', x2: '0', y2: '1' },
    ),
    linearGradient(
      'zr-eq-plate-shadow',
      [
        { offset: 0, color: '#000', opacity: 0.5 },
        { offset: 1, color: '#000', opacity: 0 },
      ],
      { x1: '0', y1: '0', x2: '0', y2: '1' },
    ),
    radialGradient(
      'zr-eq-oval',
      [
        { offset: 0, color: '#302a1c' },
        { offset: 0.55, color: '#1e1b12' },
        { offset: 1, color: '#100e08' },
      ],
      { cx: '50%', cy: '42%', r: '68%' },
    ),
    linearGradient(
      'zr-eq-rupee',
      [
        { offset: 0, color: '#6fe27e' },
        { offset: 1, color: '#1a7a2e' },
      ],
      { x1: '0', y1: '0', x2: '1', y2: '1' },
    ),
    linearGradient(
      'zr-eq-gold',
      [
        { offset: 0, color: '#8d6d20' },
        { offset: 1, color: '#5a4010' },
      ],
      { x1: '0', y1: '0', x2: '0', y2: '1' },
    ),
    linearGradient(
      'zr-eq-steel',
      [
        { offset: 0, color: '#eef1f5' },
        { offset: 0.5, color: '#a9b1b9' },
        { offset: 1, color: '#767e86' },
      ],
      { x1: '0', y1: '0', x2: '1', y2: '0' },
    ),
    linearGradient(
      'zr-eq-wood',
      [
        { offset: 0, color: '#b48c58' },
        { offset: 1, color: '#7a5630' },
      ],
      { x1: '0', y1: '0', x2: '0', y2: '1' },
    ),
    linearGradient(
      'zr-eq-tunic',
      [
        { offset: 0, color: '#4d9a48' },
        { offset: 1, color: '#2d6a2c' },
      ],
      { x1: '0', y1: '0', x2: '0', y2: '1' },
    ),
    blurFilter('zr-eq-blur6', 6),
    blurFilter('zr-eq-blur4', 4),
    ...Array.from(heartDefs('zr-eq-heart').childNodes),
  ]);
}

export function createEquipmentScreen(): SVGSVGElement {
  const root = svgRoot([0, 0, 1280, 720], {
    class: 'zr-equip-svg',
    preserveAspectRatio: 'xMidYMid slice',
    'aria-hidden': 'true',
    style: `font-family: ${SANS};`,
  });
  root.appendChild(defs());
  root.appendChild(woodBackground());
  root.appendChild(leftPanel());
  root.appendChild(centreOval());
  root.appendChild(rightGrid());
  root.appendChild(topBar());
  root.appendChild(hints());
  return root;
}
