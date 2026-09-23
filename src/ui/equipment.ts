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

/**
 * The left panel's sockets, as in the reference (d_057–d_088 at 1280 px): the top pair are
 * pentagons with a flat top and a pointed bottom, the bottom pair the same turned over, and the
 * odd one under them a flat-top hexagon. The vertical sides run 72 % of the height.
 */
function shieldSocket(cx: number, y0: number, w: number, h: number, pointedTop: boolean, inset = 0): string {
  const hw = w / 2 - inset;
  const top = y0 + inset;
  const bot = y0 + h - inset;
  const side = (h - inset * 2) * 0.72;
  if (!pointedTop) return `M${fmt(cx - hw)} ${fmt(top)} H${fmt(cx + hw)} V${fmt(top + side)} L${fmt(cx)} ${fmt(bot)} L${fmt(cx - hw)} ${fmt(top + side)} Z`;
  return `M${fmt(cx)} ${fmt(top)} L${fmt(cx + hw)} ${fmt(bot - side)} V${fmt(bot)} H${fmt(cx - hw)} V${fmt(bot - side)} Z`;
}

function leftPanel(): SVGGElement {
  const grp = g({ class: 'zr-equip-left' });
  const cols = [116, 266];
  for (const cx of cols) {
    grp.appendChild(socket(shieldSocket(cx, 253, 112, 118, false), shieldSocket(cx, 253, 112, 118, false, 4)));
    grp.appendChild(socket(shieldSocket(cx, 436, 112, 120, true), shieldSocket(cx, 436, 112, 120, true, 4)));
  }
  grp.appendChild(socket(flatHexPath(190, 637, 100, 82), flatHexPath(190, 637, 92, 74)));
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

/**
 * Centre oval — the ref-02 card: a dark radial vignette with the 3-D item rendered over it by
 * `itemCard.ts` (a transparent canvas the stage lays over `CARD_BOX`) and the item's name and
 * two-line description underneath. The text nodes are returned so the screen can retarget them.
 */
export const CARD_BOX = { x: 615 - 240, y: 110, w: 480, h: 430 };

function centreOval(): { grp: SVGGElement; name: SVGTextElement; desc: [SVGTextElement, SVGTextElement] } {
  const grp = g({ class: 'zr-equip-centre' });
  grp.appendChild(ellipse(615, 396, 265, 325, { fill: '#0a0805', opacity: 0.7, filter: 'url(#zr-eq-blur6)' }));
  grp.appendChild(ellipse(615, 396, 262, 322, { fill: 'url(#zr-eq-oval)', stroke: '#3d3320', 'stroke-width': 2.2 }));
  grp.appendChild(ellipse(615, 396, 258, 318, { fill: 'none', stroke: '#0f0c07', 'stroke-width': 3, opacity: 0.8 }));
  // the card's own vignette: a soft pool of light behind the item
  grp.appendChild(ellipse(615, 330, 190, 200, { fill: 'url(#zr-eq-card-glow)' }));
  // floor shadow under the item
  grp.appendChild(ellipse(612, 520, 96, 14, { fill: '#000', opacity: 0.45, filter: 'url(#zr-eq-blur6)' }));
  // item name + divider + description
  const name = text(610, 583, 'Deku Stick', { 'text-anchor': 'middle', 'font-size': 36, 'font-weight': 600, 'letter-spacing': 0.6, fill: TEXT_BRIGHT, class: 'zr-equip-name' });
  grp.appendChild(name);
  grp.appendChild(line(412, 603, 808, 603, { stroke: '#c8b890', 'stroke-width': 1.2, opacity: 0.55 }));
  const curl = 'M412 603 C 404 603, 399 597, 404 595 C 409 593, 411 599, 406 600';
  grp.appendChild(path(curl, { fill: 'none', stroke: '#c8b890', 'stroke-width': 1.2, opacity: 0.7, 'stroke-linecap': 'round' }));
  grp.appendChild(path(curl, { fill: 'none', stroke: '#c8b890', 'stroke-width': 1.2, opacity: 0.7, 'stroke-linecap': 'round', transform: 'translate(1220 0) scale(-1 1)' }));
  const d1 = text(610, 635, '', { 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 400, fill: TEXT });
  const d2 = text(610, 665, '', { 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 400, fill: TEXT });
  grp.appendChild(d1);
  grp.appendChild(d2);
  // left / right cycle arrows inside the oval
  grp.appendChild(path('M392 396 L372 414 L392 432', { fill: 'none', stroke: '#c9b48a', 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.85 }));
  grp.appendChild(path('M838 396 L858 414 L838 432', { fill: 'none', stroke: '#c9b48a', 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.85 }));
  return { grp, name, desc: [d1, d2] };
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

/**
 * Equipment grid geometry (design px), measured on the 1280 px reference frame at 34.5 s: three
 * columns 120 px apart; row 0 tall rectangles (sword row), row 1 pointy hexagons with vertical
 * sides over 55 % of the height (shield row), row 2 rounded rectangles (tunic row).
 */
export const GRID_COLS = [947, 1067, 1187];
export const GRID_ROWS: { cy: number; w: number; h: number }[] = [
  { cy: 244, w: 86, h: 174 },
  { cy: 429, w: 100, h: 146 },
  { cy: 590, w: 98, h: 124 },
];

function rowShape(row: number, cx: number, inset = 0): string {
  const r = GRID_ROWS[row];
  if (row === 1) return hexPath(cx, r.cy, r.w - inset * 2, r.h - inset * 2.6, 0.55);
  const w = r.w - inset * 2;
  const h = r.h - inset * 2;
  return rectPath(cx - w / 2, r.cy - h / 2, w, h, row === 0 ? 4 : 5);
}

/**
 * The box a cell's thumbnail canvas occupies (design px): the cell inset by its bevel, so the
 * item's silhouette stays inside the plate. Hexagons get a little more side inset for their
 * corners.
 */
export function cellBox(row: number, col: number): { x: number; y: number; w: number; h: number } {
  const r = GRID_ROWS[row];
  const ix = row === 1 ? 10 : 6;
  const iy = row === 1 ? 8 : 6;
  return { x: GRID_COLS[col] - r.w / 2 + ix, y: r.cy - r.h / 2 + iy, w: r.w - ix * 2, h: r.h - iy * 2 };
}

/**
 * Right panel: the 3 × 3 grid. Rows 0–1 hold the six bag items (their 3-D thumbnails are laid
 * over the cells by the stage), row 2 is the tunic row (one tunic icon, two empty sockets). The
 * gold plate marks the equipped item's cell and the pale frame the browsed one; both move.
 */
function rightGrid(): { grp: SVGGElement; setEquipped(row: number, col: number): void; setBrowsed(row: number, col: number): void } {
  const grp = g({ class: 'zr-equip-right' });
  const plates: SVGGElement[][] = [];
  for (let row = 0; row < 3; row++) {
    plates.push([]);
    for (let c = 0; c < 3; c++) {
      const cx = GRID_COLS[c];
      const d = rowShape(row, cx);
      const filled = row < 2 || c === 0;
      const gold = g({ style: 'display:none' }, [
        path(d, { fill: 'url(#zr-eq-gold)', stroke: '#2e2008', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
        path(rowShape(row, cx, 2.5), { fill: 'none', stroke: '#4a3408', 'stroke-width': 1.6, opacity: 0.8, 'stroke-linejoin': 'round' }),
        path(rowShape(row, cx, 4.5), { fill: 'none', stroke: '#b8933a', 'stroke-width': 0.9, opacity: 0.35, 'stroke-linejoin': 'round' }),
      ]);
      const plain = filled
        ? g({}, [path(d, { fill: 'url(#zr-eq-plate)', stroke: '#3a2a0c', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }), path(rowShape(row, cx, 3), { fill: 'none', stroke: '#8a7448', 'stroke-width': 1, opacity: 0.35 })])
        : socket(d, rowShape(row, cx, 4));
      grp.appendChild(plain);
      grp.appendChild(gold);
      plates[row].push(gold);
    }
  }
  grp.appendChild(tunicIcon(947, 590));
  // browse frame — the reference's cool pale line with a soft blue-grey halo — follows the highlighted cell
  const glow = path(rowShape(0, 947, -3), { fill: 'none', stroke: '#c9d0e6', 'stroke-width': 8, opacity: 0.5, filter: 'url(#zr-eq-blur4)', 'stroke-linejoin': 'round' });
  const frame = path(rowShape(0, 947, -1), { fill: 'none', stroke: '#eef1f8', 'stroke-width': 3, 'stroke-linejoin': 'round' });
  const frameGold = path(rowShape(0, 947, -1), { fill: 'none', stroke: '#9aa3bf', 'stroke-width': 0.8, opacity: 0.6, 'stroke-linejoin': 'round' });
  grp.appendChild(glow);
  grp.appendChild(frame);
  grp.appendChild(frameGold);
  let equipped: [number, number] = [-1, -1];
  return {
    grp,
    setEquipped(row, col) {
      if (equipped[0] >= 0) plates[equipped[0]][equipped[1]].style.display = 'none';
      equipped = [row, col];
      plates[row][col].style.display = '';
    },
    setBrowsed(row, col) {
      const cx = GRID_COLS[col];
      glow.setAttribute('d', rowShape(row, cx, -3));
      frame.setAttribute('d', rowShape(row, cx, -1));
      frameGold.setAttribute('d', rowShape(row, cx, -1));
    },
  };
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
    // the reference plate: rgb(102,71,11) at the top lightening to rgb(125,96,20) at the bottom
    linearGradient(
      'zr-eq-gold',
      [
        { offset: 0, color: '#68480d' },
        { offset: 0.5, color: '#75541a' },
        { offset: 1, color: '#836318' },
      ],
      { x1: '0', y1: '0', x2: '0', y2: '1' },
    ),
    linearGradient(
      'zr-eq-plate',
      [
        { offset: 0, color: '#3a2d18' },
        { offset: 1, color: '#221a0e' },
      ],
      { x1: '0', y1: '0', x2: '0', y2: '1' },
    ),
    radialGradient(
      'zr-eq-card-glow',
      [
        { offset: 0, color: '#6b5a3a', opacity: 0.55 },
        { offset: 0.55, color: '#3a2f1c', opacity: 0.25 },
        { offset: 1, color: '#000', opacity: 0 },
      ],
      { cx: '50%', cy: '50%', r: '50%' },
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

export interface EquipmentScreen {
  svg: SVGSVGElement;
  /** name + description under the card */
  setText(name: string, description: [string, string]): void;
  /** gold plate = the item in the HUD slot */
  setEquipped(row: number, col: number): void;
  /** pale frame = the item being browsed */
  setBrowsed(row: number, col: number): void;
}

export function createEquipmentScreen(): EquipmentScreen {
  const root = svgRoot([0, 0, 1280, 720], {
    class: 'zr-equip-svg',
    preserveAspectRatio: 'xMidYMid slice',
    'aria-hidden': 'true',
    style: `font-family: ${SANS};`,
  });
  root.appendChild(defs());
  root.appendChild(woodBackground());
  root.appendChild(leftPanel());
  const centre = centreOval();
  root.appendChild(centre.grp);
  const grid = rightGrid();
  root.appendChild(grid.grp);
  root.appendChild(topBar());
  root.appendChild(hints());
  return {
    svg: root,
    setText(name, description) {
      centre.name.textContent = name;
      centre.desc[0].textContent = description[0];
      centre.desc[1].textContent = description[1];
    },
    setEquipped: grid.setEquipped,
    setBrowsed: grid.setBrowsed,
  };
}
