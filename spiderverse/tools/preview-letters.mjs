#!/usr/bin/env node
// Specimen sheets and self-tests for the hand-lettered faces in app/scene/letters.js.
//
//   node spiderverse/tools/preview-letters.mjs
//
// Writes PNGs to spiderverse/out/letters/ and mirrors the headline sheets into
// /opt/cursor/artifacts/. Looking at the render is only half the check, so it also runs a geometry
// self-test:
//
//   * every glyph is rasterised twice, once by scanline-filling the contours with the nonzero
//     winding rule (what an SVG/canvas renderer does) and once from triangulate() output. The two
//     masks must agree, which is a direct test of the ear clipping and the hole bridging.
//   * the background of each raster is flood filled from the border, and whatever background is
//     left over is a counter. Count and area of those counters are checked against what the
//     letterform is supposed to have, which catches a counter that has filled in or shrunk to a
//     sliver - the exact failure that is easy to miss by eye at small sizes.
//   * contours are checked for self-intersection, non-finite coordinates and winding.
//   * layoutWord / strokeOutline / roughenContours are checked for determinism.

import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  GLYPH_EM,
  STYLES,
  getGlyph,
  layoutWord,
  strokeOutline,
  roughenContours,
  triangulate,
  characterSet,
  contourArea,
} from '../app/scene/letters.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out/letters');
const ARTIFACTS = '/opt/cursor/artifacts';
const CHARS = characterSet();

/** How many counters each letterform is supposed to enclose. Everything else must enclose none. */
const EXPECT_COUNTERS = { A: 1, B: 2, D: 1, O: 1, P: 1, Q: 1, R: 1, 0: 1, 4: 1, 6: 1, 8: 2, 9: 1 };
/** A counter smaller than this (in em^2) has effectively filled in. */
const MIN_COUNTER_AREA = 0.01;

// ---------------------------------------------------------------------------------------------
// svg plumbing
// ---------------------------------------------------------------------------------------------

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
  return Number.isFinite(x0) ? [x0, y0, x1, y1] : [0, 0, 0, 0];
}

/** contours (em space, y up) -> svg path data at a placement */
function pathData(contours, { x = 0, y = 0, s = 1 } = {}) {
  let d = '';
  for (const c of contours) {
    if (c.length < 3) continue;
    for (let i = 0; i < c.length; i++) {
      d += `${i === 0 ? 'M' : 'L'}${(x + c[i][0] * s).toFixed(3)} ${(y - c[i][1] * s).toFixed(3)}`;
      if (i < c.length - 1) d += ' ';
    }
    d += 'Z';
  }
  return d;
}

async function writeSvg(name, width, height, body, bg = '#0d0f14') {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${bg}"/>${body}</svg>`;
  await writeFile(resolve(OUT, name), await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer());
  return name;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const label = (text, x, y, size, fill = '#5d6677', anchor = 'start') =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="monospace" font-size="${size}" fill="${fill}" ` +
  `text-anchor="${anchor}">${esc(text)}</text>`;

// ---------------------------------------------------------------------------------------------
// (a) character set specimen, one sheet per style
// ---------------------------------------------------------------------------------------------

async function specimenSheet(style) {
  const cols = 8;
  const rows = Math.ceil(CHARS.length / cols);
  const cell = 200;
  const emPx = 132;
  const padX = 42;
  const padTop = 132;
  const width = padX * 2 + cols * cell;
  const height = padTop + rows * cell + 260;

  let body = label(`SPIDER-VERSE LETTERING  //  FACE: ${style.toUpperCase()}`, padX, 52, 30, '#e8ecf4');
  body += label(
    `authored vector letterforms, no font files  -  ${CHARS.length} glyphs  -  em ${GLYPH_EM}, cap 0.72, baseline y=0`,
    padX,
    84,
    19,
    '#6b7689'
  );

  for (let i = 0; i < CHARS.length; i++) {
    const ch = CHARS[i];
    const gl = getGlyph(ch, style);
    const cx = padX + (i % cols) * cell;
    const cy = padTop + Math.floor(i / cols) * cell;
    const baseY = cy + cell - 58;
    const capY = baseY - 0.72 * emPx;
    const originX = cx + (cell - (gl ? gl.advance * emPx : 0)) / 2;

    body += `<rect x="${cx + 4}" y="${cy + 4}" width="${cell - 8}" height="${cell - 8}" fill="none" stroke="#1b2030"/>`;
    body += `<line x1="${cx + 10}" y1="${baseY}" x2="${cx + cell - 10}" y2="${baseY}" stroke="#2a3245"/>`;
    body += `<line x1="${cx + 10}" y1="${capY}" x2="${cx + cell - 10}" y2="${capY}" stroke="#222a3a" stroke-dasharray="3 4"/>`;
    if (gl) {
      body += `<line x1="${originX}" y1="${baseY + 14}" x2="${originX}" y2="${capY - 8}" stroke="#243049"/>`;
      const ax = originX + gl.advance * emPx;
      body += `<line x1="${ax}" y1="${baseY + 14}" x2="${ax}" y2="${capY - 8}" stroke="#243049"/>`;
      body += `<path d="${pathData(gl.contours, { x: originX, y: baseY, s: emPx })}" fill="#f2f4f8" fill-rule="nonzero"/>`;
    }
    body += label(ch, cx + 12, cy + 28, 17, '#4a5468');
    if (gl) body += label(gl.advance.toFixed(3), cx + cell - 12, cy + 28, 15, '#39425a', 'end');
  }

  const runs = [
    { t: 'KRAKOOM SKRRT VWOOP', s: 94 },
    { t: 'SNATCH! SKITT? 0123456789', s: 72 },
    { t: "ONE CRUMB. JIGGLE-BOX: 'Q'", s: 62 },
  ];
  let ry = padTop + rows * cell + 52;
  for (const r of runs) {
    const laid = layoutWord(r.t, { style, seed: 7, jitter: 0.55, origin: 'left' });
    body += `<path d="${pathData(laid.contours, { x: padX, y: ry + r.s * 0.72, s: r.s })}" fill="#e6eaf2" fill-rule="nonzero"/>`;
    ry += r.s * 1.02;
  }

  return writeSvg(`letters_specimen_${style}.png`, width, height, body);
}

// ---------------------------------------------------------------------------------------------
// (b) the words, with the full multi-layer comic outline treatment
// ---------------------------------------------------------------------------------------------

const PALETTE = {
  magenta: { face: '#ff2d6f', rim: '#ffd23f' },
  yellow: { face: '#ffd23f', rim: '#ff2d6f' },
  cyan: { face: '#2ee6f6', rim: '#ffffff' },
  white: { face: '#ffffff', rim: '#2ee6f6' },
  cream: { face: '#f7f3e6', rim: '#1b1b1b' },
};

/** The classic sandwich, back to front: drop, black keyline, coloured rim, face. */
function comicLettering(contours, px, colors, opt = {}) {
  const key = strokeOutline(contours, opt.key ?? 0.05);
  const rim = strokeOutline(contours, opt.rim ?? 0.026);
  const drop = strokeOutline(contours, opt.drop ?? 0.055);
  const dx = (opt.dx ?? 0.04) * px;
  const dy = (opt.dy ?? 0.05) * px;
  return (place) =>
    `<path d="${pathData(drop, { ...place, x: place.x + dx, y: place.y + dy })}" fill="${
      colors.drop ?? '#120c18'
    }" fill-rule="nonzero" opacity="0.85"/>` +
    `<path d="${pathData(key, place)}" fill="#0a0a0e" fill-rule="nonzero"/>` +
    `<path d="${pathData(rim, place)}" fill="${colors.rim}" fill-rule="nonzero"/>` +
    `<path d="${pathData(contours, place)}" fill="${colors.face}" fill-rule="nonzero"/>`;
}

async function wordsSheet() {
  const width = 1920;
  const height = 1660;
  let body = '';
  body += '<g opacity="0.1">';
  for (let y = 0; y < height; y += 26) {
    for (let x = y % 52 === 0 ? 0 : 13; x < width; x += 26) body += `<circle cx="${x}" cy="${y}" r="4.5" fill="#4b6cff"/>`;
  }
  body += '</g>';
  body += label('ONOMATOPOEIA + CAPTIONS  //  layoutWord + roughenContours + strokeOutline', 46, 58, 28, '#e8ecf4');

  const specs = [
    { text: 'KRAKOOM', style: 'heavy', px: 196, color: 'magenta', seed: 3, arc: -0.2, cx: 660, cy: 250, rot: -6 },
    { text: 'SNATCH', style: 'heavy', px: 150, color: 'white', seed: 11, arc: 0.14, cx: 1560, cy: 250, rot: 5 },
    { text: 'SKRRT', style: 'medium', px: 170, color: 'yellow', seed: 5, arc: 0, cx: 300, cy: 600, rot: 12 },
    { text: 'VWOOP', style: 'medium', px: 160, color: 'cyan', seed: 9, arc: -0.28, cx: 1010, cy: 620, rot: -14 },
    { text: 'SKITT', style: 'light', px: 128, color: 'cyan', seed: 17, arc: 0, cx: 1640, cy: 600, rot: 7 },
    { text: 'ONE CRUMB.', style: 'light', px: 104, color: 'cream', seed: 23, arc: 0, cx: 430, cy: 900, rot: -1 },
    { text: 'CRUMB.', style: 'light', px: 104, color: 'cream', seed: 29, arc: 0, cx: 1310, cy: 900, rot: 1 },
  ];

  for (const sp of specs) {
    const laid = layoutWord(sp.text, { style: sp.style, seed: sp.seed, arc: sp.arc, jitter: 1 });
    const rough = roughenContours(laid.contours, sp.style === 'light' ? 0.0035 : 0.0055, sp.seed * 13 + 1);
    const draw = comicLettering(
      rough,
      sp.px,
      PALETTE[sp.color],
      sp.style === 'light' ? { key: 0.03, rim: 0.014, drop: 0.036 } : {}
    );
    body += `<g transform="translate(${sp.cx} ${sp.cy}) rotate(${sp.rot})">${draw({ x: 0, y: 0, s: sp.px })}</g>`;
    body += label(
      `${sp.text} [${sp.style}]  ${laid.perLetter.length} letters  pop order ${laid.perLetter
        .map((p) => p.popOrder)
        .join(',')}`,
      sp.cx - (laid.width * sp.px) / 2,
      sp.cy + (laid.height * sp.px) / 2 + 42,
      17,
      '#5d6677'
    );
  }

  // caption boxes, drawn the way the panel will draw them
  body += label('CAPTION BOXES  //  light face, condensed, near-monoline', 110, 1046, 22, '#8b95a8');
  for (const b of [
    { text: 'ONE CRUMB.', x: 110, y: 1070, px: 92 },
    { text: 'CRUMB.', x: 1150, y: 1070, px: 92 },
  ]) {
    const laid = layoutWord(b.text, { style: 'light', seed: 41, jitter: 0.8, tracking: 0.02 });
    const bw = laid.width * b.px + 92;
    const bh = laid.height * b.px + 80;
    body += `<rect x="${b.x}" y="${b.y}" width="${bw}" height="${bh}" fill="#f7f3e6" stroke="#121016" stroke-width="7"/>`;
    body += `<rect x="${b.x + 11}" y="${b.y + 11}" width="${bw - 22}" height="${bh - 22}" fill="none" stroke="#121016" stroke-width="2.5" opacity="0.55"/>`;
    const rough = roughenContours(laid.contours, 0.0035, 77);
    body += `<path d="${pathData(rough, { x: b.x + bw / 2, y: b.y + bh / 2, s: b.px })}" fill="#141118" fill-rule="nonzero"/>`;
  }

  // per-letter pop-in, the thing perLetter exists for
  body += label('perLetter POP-IN  //  each letter scaled and rotated about its own pivot, on 2s', 110, 1300, 22, '#8b95a8');
  const pop = layoutWord('KRAKOOM', { style: 'heavy', seed: 3, arc: -0.2 });
  const popPx = 74;
  for (let step = 0; step < 6; step++) {
    const gx = 260 + step * 290;
    const gy = 1480;
    body += `<g transform="translate(${gx} ${gy})">`;
    for (const pl of pop.perLetter) {
      const local = (step / 5) * 6.2 - pl.popOrder * 0.85;
      if (local <= 0) continue;
      const u = Math.min(1, local / 1.2);
      const s = 1 + 0.45 * Math.pow(1 - u, 2.1) * Math.sin(u * Math.PI * 1.9);
      const extraRot = (1 - u) * 0.26 * (pl.popOrder % 2 ? 1 : -1);
      const ca = Math.cos(extraRot);
      const sa = Math.sin(extraRot);
      const placed = pl.contours.map((c) =>
        c.map((p) => {
          const dx = (p[0] - pl.x) * s;
          const dy = (p[1] - pl.y) * s;
          return [pl.x + dx * ca - dy * sa, pl.y + dx * sa + dy * ca];
        })
      );
      body += `<path d="${pathData(strokeOutline(placed, 0.05), { x: 0, y: 0, s: popPx })}" fill="#0a0a0e" fill-rule="nonzero"/>`;
      body += `<path d="${pathData(placed, { x: 0, y: 0, s: popPx })}" fill="#ff2d6f" fill-rule="nonzero"/>`;
    }
    body += '</g>';
    body += label(`t=${(step / 5).toFixed(1)}`, gx - 30, gy + 46, 16, '#4a5468');
  }

  return writeSvg('letters_words.png', width, height, body, '#151a24');
}

// ---------------------------------------------------------------------------------------------
// rasterisers (shared by the triangulation sheet and the self-test)
// ---------------------------------------------------------------------------------------------

function makeRaster(width, height, bg = [16, 18, 26]) {
  const buf = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    buf[i * 3] = bg[0];
    buf[i * 3 + 1] = bg[1];
    buf[i * 3 + 2] = bg[2];
  }
  return { buf, width, height };
}

function fillTri(r, ax, ay, bx, by, cx, cy, col) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(r.width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(r.height - 1, Math.ceil(Math.max(ay, by, cy)));
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-12) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const l0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
      const l1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
      if (l0 < -1e-6 || l1 < -1e-6 || 1 - l0 - l1 < -1e-6) continue;
      const i = (y * r.width + x) * 3;
      r.buf[i] = col[0];
      r.buf[i + 1] = col[1];
      r.buf[i + 2] = col[2];
    }
  }
}

function drawLine(r, x0, y0, x1, y1, col) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue;
    const j = (y * r.width + x) * 3;
    r.buf[j] = col[0];
    r.buf[j + 1] = col[1];
    r.buf[j + 2] = col[2];
  }
}

function hsv(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const tbl = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return tbl.map((c) => Math.round(c * 255));
}

/** Scanline fill of the contours under the nonzero winding rule: the reference renderer. */
function maskFromContours(contours, px, w, h, ox, oy) {
  const mask = new Uint8Array(w * h);
  const xs = [];
  for (let y = 0; y < h; y++) {
    const sy = (oy - (y + 0.5)) / px; // back to em space
    xs.length = 0;
    for (const c of contours) {
      for (let i = 0, n = c.length; i < n; i++) {
        const a = c[i];
        const b = c[(i + 1) % n];
        if (a[1] > sy === b[1] > sy) continue;
        const t = (sy - a[1]) / (b[1] - a[1]);
        xs.push([a[0] + t * (b[0] - a[0]), b[1] > a[1] ? 1 : -1]);
      }
    }
    if (!xs.length) continue;
    xs.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind === 0) continue;
      const xa = Math.max(0, Math.ceil(ox + xs[i][0] * px - 0.5));
      const xb = Math.min(w - 1, Math.floor(ox + xs[i + 1][0] * px - 0.5));
      for (let x = xa; x <= xb; x++) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/** Same raster, but built from triangulate() output. */
function maskFromTriangles(contours, px, w, h, ox, oy) {
  const mask = new Uint8Array(w * h);
  const tri = triangulate(contours);
  const P = tri.positions;
  for (let i = 0; i < tri.indices.length; i += 3) {
    const a = tri.indices[i];
    const b = tri.indices[i + 1];
    const c = tri.indices[i + 2];
    const ax = ox + P[a * 2] * px;
    const ay = oy - P[a * 2 + 1] * px;
    const bx = ox + P[b * 2] * px;
    const by = oy - P[b * 2 + 1] * px;
    const cx = ox + P[c * 2] * px;
    const cy = oy - P[c * 2 + 1] * px;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-12) continue;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const l0 = ((by - cy) * (x + 0.5 - cx) + (cx - bx) * (y + 0.5 - cy)) / d;
        const l1 = ((cy - ay) * (x + 0.5 - cx) + (ax - cx) * (y + 0.5 - cy)) / d;
        if (l0 < 0 || l1 < 0 || 1 - l0 - l1 < 0) continue;
        mask[y * w + x] = 1;
      }
    }
  }
  return { mask, tri };
}

/** Flood fill the background inward from the border; whatever background is left is a counter. */
function findCounters(mask, w, h) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) {
    stack.push(x, x + (h - 1) * w);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || mask[i]) continue;
    seen[i] = 1;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  const areas = [];
  const comp = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (mask[i] || seen[i] || comp[i]) continue;
    let n = 0;
    const st = [i];
    while (st.length) {
      const j = st.pop();
      if (comp[j] || mask[j] || seen[j]) continue;
      comp[j] = 1;
      n++;
      const x = j % w;
      const y = (j - x) / w;
      if (x > 0) st.push(j - 1);
      if (x < w - 1) st.push(j + 1);
      if (y > 0) st.push(j - w);
      if (y < h - 1) st.push(j + w);
    }
    areas.push(n);
  }
  areas.sort((a, b) => b - a);
  return areas;
}

// ---------------------------------------------------------------------------------------------
// (c) triangulation sheet
// ---------------------------------------------------------------------------------------------

async function triangulationSheet() {
  const rows = [
    { style: 'heavy', chars: 'OQABDPR8'.split('') },
    { style: 'heavy', chars: '0469'.split('') },
    { style: 'medium', chars: 'OBDPRQ48'.split('') },
    { style: 'light', chars: 'OBDPRQ08'.split('') },
  ];
  const cell = 236;
  const emPx = 178;
  const cols = 8;
  const width = 60 + cols * cell + 60;
  const height = 150 + rows.length * cell + 460;
  const r = makeRaster(width, height);
  const report = [];

  let y = 150;
  for (const row of rows) {
    let x = 60;
    for (const ch of row.chars) {
      const gl = getGlyph(ch, row.style);
      if (!gl) continue;
      const tri = triangulate(gl.contours);
      const ox = x + (cell - gl.inkWidth * emPx) / 2;
      const oy = y + cell - 54;
      const P = tri.positions;
      // flat fill first: any gap in the fill, or a counter that is not background, is a bug
      for (let i = 0; i < tri.indices.length; i += 3) {
        const [a, b, c] = [tri.indices[i], tri.indices[i + 1], tri.indices[i + 2]];
        fillTri(
          r,
          ox + P[a * 2] * emPx, oy - P[a * 2 + 1] * emPx,
          ox + P[b * 2] * emPx, oy - P[b * 2 + 1] * emPx,
          ox + P[c * 2] * emPx, oy - P[c * 2 + 1] * emPx,
          [236, 240, 248]
        );
      }
      for (let i = 0; i < tri.indices.length; i += 3) {
        const idx = [tri.indices[i], tri.indices[i + 1], tri.indices[i + 2]];
        const col = hsv(((i / 3) * 0.137) % 1, 0.85, 0.72);
        for (let k = 0; k < 3; k++) {
          const a = idx[k];
          const b = idx[(k + 1) % 3];
          drawLine(r, ox + P[a * 2] * emPx, oy - P[a * 2 + 1] * emPx, ox + P[b * 2] * emPx, oy - P[b * 2 + 1] * emPx, col);
        }
      }
      report.push({ ch, style: row.style, tris: tri.triangleCount, verts: tri.vertexCount });
      x += cell;
    }
    y += cell;
  }

  let sy = y + 110;
  for (const st of [
    { text: 'KRAKOOM', style: 'heavy', px: 118 },
    { text: 'SKRRT VWOOP', style: 'medium', px: 104 },
    { text: 'ONE CRUMB.', style: 'light', px: 96 },
  ]) {
    const laid = layoutWord(st.text, { style: st.style, seed: 4, jitter: 0.9, origin: 'left' });
    const tri = triangulate(laid.contours);
    const P = tri.positions;
    const oy = sy + st.px * 0.72;
    for (let i = 0; i < tri.indices.length; i += 3) {
      const [a, b, c] = [tri.indices[i], tri.indices[i + 1], tri.indices[i + 2]];
      fillTri(
        r,
        70 + P[a * 2] * st.px, oy - P[a * 2 + 1] * st.px,
        70 + P[b * 2] * st.px, oy - P[b * 2 + 1] * st.px,
        70 + P[c * 2] * st.px, oy - P[c * 2 + 1] * st.px,
        hsv(((i / 3) * 0.0731) % 1, 0.4, 0.97)
      );
    }
    report.push({ ch: st.text, style: st.style, tris: tri.triangleCount, verts: tri.vertexCount });
    sy += st.px * 1.36;
  }

  const base = await sharp(r.buf, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const overlay =
    label('TRIANGULATION TEST  //  ear clipping with hole bridging, rasterised from triangulate()', 60, 58, 28, '#e8ecf4') +
    label('flat fill plus per-triangle wireframe; a gap in the fill, or a counter that is filled, is a bug', 60, 92, 18, '#6b7689') +
    label('SOLID FILL, TRIANGLES ONLY', 70, y + 74, 20, '#8b95a8');
  const out = await sharp(base)
    .composite([
      {
        input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${overlay}</svg>`),
        top: 0,
        left: 0,
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(OUT, 'letters_triangulation.png'), out);
  return { name: 'letters_triangulation.png', report };
}

// ---------------------------------------------------------------------------------------------
// geometry self-test
// ---------------------------------------------------------------------------------------------

function segIntersect(a, b, c, d) {
  const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]);
  const d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}

function selfIntersections(c) {
  const n = c.length;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segIntersect(c[i], c[(i + 1) % n], c[j], c[(j + 1) % n])) hits++;
    }
  }
  return hits;
}

function triArea(tri) {
  let a = 0;
  for (let i = 0; i < tri.indices.length; i += 3) {
    const x0 = tri.positions[tri.indices[i] * 2];
    const y0 = tri.positions[tri.indices[i] * 2 + 1];
    const x1 = tri.positions[tri.indices[i + 1] * 2];
    const y1 = tri.positions[tri.indices[i + 1] * 2 + 1];
    const x2 = tri.positions[tri.indices[i + 2] * 2];
    const y2 = tri.positions[tri.indices[i + 2] * 2 + 1];
    a += Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) * 0.5;
  }
  return a;
}

function selfTest() {
  const problems = [];
  const notes = [];
  const px = 240; // raster resolution for the counter test
  let worstMask = 0;
  let worstMaskWhat = '';

  for (const style of STYLES) {
    for (const ch of CHARS) {
      const gl = getGlyph(ch, style);
      const tag = `${style.padEnd(6)} ${ch}`;
      if (!gl) {
        problems.push(`${tag}: getGlyph returned null`);
        continue;
      }
      const issues = [];
      let nan = 0;
      let outers = 0;
      let si = 0;
      for (const c of gl.contours) {
        for (const p of c) if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) nan++;
        if (contourArea([c]) > 0) outers++;
        si += selfIntersections(c);
      }
      if (nan) issues.push(`${nan} non-finite coords`);
      if (!outers) issues.push('no outer contour');
      if (si) issues.push(`${si} self-intersections`);
      if (gl.inkWidth <= 0.04) issues.push(`ink width ${gl.inkWidth.toFixed(3)} too small`);
      if (!',.:-\''.includes(ch) && gl.bbox[3] < 0.7) issues.push(`ink top ${gl.bbox[3].toFixed(3)} short of cap`);
      // ' and - sit above the baseline by design; , dips below it
      if (!"'-".includes(ch) && gl.bbox[1] > 0.03) issues.push(`ink bottom ${gl.bbox[1].toFixed(3)} above the baseline`);

      // raster cross-check + counters
      const bb = bboxOf(gl.contours);
      const pad = 3;
      const w = Math.ceil((bb[2] - bb[0]) * px) + pad * 2;
      const h = Math.ceil((bb[3] - bb[1]) * px) + pad * 2;
      const ox = pad - bb[0] * px;
      const oy = h - pad + bb[1] * px;
      const ref = maskFromContours(gl.contours, px, w, h, ox, oy);
      const { mask, tri } = maskFromTriangles(gl.contours, px, w, h, ox, oy);
      let diff = 0;
      let ink = 0;
      for (let i = 0; i < ref.length; i++) {
        if (ref[i]) ink++;
        if (ref[i] !== mask[i]) diff++;
      }
      const rel = ink ? diff / ink : 0;
      if (rel > worstMask) {
        worstMask = rel;
        worstMaskWhat = tag;
      }
      // a 1px seam along every edge is expected from two different rasterisers
      if (rel > 0.025) issues.push(`triangulation differs from nonzero fill by ${(rel * 100).toFixed(1)}% of ink`);
      if (tri.triangleCount === 0) issues.push('triangulation produced no triangles');

      const want = EXPECT_COUNTERS[ch] ?? 0;
      const allCounters = findCounters(ref, w, h);
      const counters = allCounters.filter((a) => a / (px * px) >= MIN_COUNTER_AREA * 0.35);
      const big = counters.filter((a) => a / (px * px) >= MIN_COUNTER_AREA);
      if (big.length !== want) {
        issues.push(
          `counters: want ${want}, got ${big.length}` +
            (counters.length ? ` [${counters.map((a) => (a / (px * px)).toFixed(4)).join(', ')} em2]` : '')
        );
      }
      // the same counters must survive the triangulation
      const triCounters = findCounters(mask, w, h).filter((a) => a / (px * px) >= MIN_COUNTER_AREA);
      if (triCounters.length !== big.length) {
        issues.push(`triangulated counters ${triCounters.length} != filled counters ${big.length}`);
      }

      // A counter that another stroke's ink reaches into still reads as "one counter", it just has a
      // bite out of it. So compare the area the hole contours ask for against the area that actually
      // comes out background: an authored hole has to be delivered essentially whole.
      let holeArea = 0;
      let holeEdge = 0;
      for (const c of gl.contours) {
        const a = contourArea([c]);
        if (a >= 0) continue;
        holeArea += -a * px * px;
        for (let i = 0; i < c.length; i++) {
          const b = c[(i + 1) % c.length];
          holeEdge += Math.hypot(b[0] - c[i][0], b[1] - c[i][1]) * px;
        }
      }
      if (holeArea > 0) {
        const got = allCounters.reduce((s, a) => s + a, 0);
        // a pixel-centre fill loses up to half a pixel all the way round the hole
        const floor = Math.max(holeArea * 0.8, holeArea - holeEdge * 0.6);
        if (got < floor) {
          issues.push(
            `counter area ${(got / (px * px)).toFixed(4)} em2 vs ${(holeArea / (px * px)).toFixed(4)} authored ` +
              `(${((1 - got / holeArea) * 100).toFixed(0)}% bitten away)`
          );
        }
      }

      if (issues.length) problems.push(`${tag}  ${issues.join('; ')}`);
    }
  }

  // helper + layout behaviour
  const words = ['KRAKOOM', 'SKRRT', 'VWOOP', 'SNATCH', 'SKITT', 'ONE CRUMB.', 'CRUMB.'];
  for (const wd of words) {
    for (const style of STYLES) {
      const laid = layoutWord(wd, { style, seed: 5, arc: -0.2 });
      const letters = [...wd].filter((c) => c !== ' ').length;
      if (laid.perLetter.length !== letters) {
        problems.push(`layoutWord("${wd}", ${style}): perLetter ${laid.perLetter.length} != ${letters}`);
      }
      if (!(laid.width > 0) || !(laid.height > 0)) problems.push(`layoutWord("${wd}", ${style}): degenerate bbox`);
      const popped = new Set(laid.perLetter.map((p) => p.popOrder));
      if (popped.size !== letters) problems.push(`layoutWord("${wd}", ${style}): popOrder is not a permutation`);
      const again = layoutWord(wd, { style, seed: 5, arc: -0.2 });
      if (JSON.stringify(again.contours) !== JSON.stringify(laid.contours)) {
        problems.push(`layoutWord("${wd}", ${style}) is not deterministic`);
      }
      // jitter 0 must be perfectly regular
      const flat = layoutWord(wd, { style, jitter: 0 });
      for (const pl of flat.perLetter) if (Math.abs(pl.rotDeg) > 1e-9) problems.push(`jitter:0 left rotation on ${wd}`);

      const out = strokeOutline(laid.contours, 0.04);
      if (contourArea(out) <= contourArea(laid.contours)) problems.push(`strokeOutline("${wd}", ${style}) did not grow`);
      const rough = roughenContours(laid.contours, 0.006, 3);
      if (JSON.stringify(rough) !== JSON.stringify(roughenContours(laid.contours, 0.006, 3))) {
        problems.push(`roughenContours("${wd}", ${style}) is not deterministic`);
      }
      for (const c of rough) if (selfIntersections(c)) problems.push(`roughenContours("${wd}", ${style}) self-intersects`);
      const tri = triangulate(rough);
      const rel = Math.abs(triArea(tri) - contourArea(rough)) / Math.abs(contourArea(rough));
      if (rel > 0.02) problems.push(`triangulate(rough "${wd}", ${style}) area off by ${(rel * 100).toFixed(1)}%`);
    }
  }
  if (getGlyph('~', 'heavy') !== null) problems.push('getGlyph should return null for unauthored characters');
  if (!getGlyph('a', 'heavy')) problems.push('getGlyph should accept lowercase');

  notes.push(`characters authored: ${CHARS.length} x ${STYLES.length} styles = ${CHARS.length * STYLES.length} glyphs`);
  notes.push(`worst triangulation/nonzero-fill raster disagreement: ${(worstMask * 100).toFixed(2)}% of ink (${worstMaskWhat})`);
  notes.push(`problems: ${problems.length}`);
  return { notes, problems };
}

// ---------------------------------------------------------------------------------------------

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(ARTIFACTS, { recursive: true });

  const made = [];
  for (const style of STYLES) made.push(await specimenSheet(style));
  made.push(await wordsSheet());
  const tri = await triangulationSheet();
  made.push(tri.name);

  const test = selfTest();
  const stats = [];
  for (const style of STYLES) {
    let cont = 0;
    let verts = 0;
    for (const ch of CHARS) {
      const gl = getGlyph(ch, style);
      if (!gl) continue;
      cont += gl.contours.length;
      for (const c of gl.contours) verts += c.length;
    }
    stats.push(`  ${style.padEnd(7)} contours ${String(cont).padStart(4)}   vertices ${String(verts).padStart(6)}`);
  }

  const log = [
    'letters.js specimen + self-test',
    '',
    `character set (${CHARS.length}): ${CHARS.join(' ')}`,
    '',
    'per-style geometry:',
    ...stats,
    '',
    ...test.notes,
    ...test.problems.map((p) => `  ! ${p}`),
    '',
    'triangulation samples:',
    ...tri.report.map(
      (x) => `  ${String(x.ch).padEnd(12)} ${x.style.padEnd(7)} ${String(x.tris).padStart(5)} tris  ${String(x.verts).padStart(5)} verts`
    ),
    '',
    `sheets: ${made.join(', ')}`,
  ].join('\n');

  await writeFile(resolve(OUT, 'report.txt'), `${log}\n`);
  console.log(log);

  for (const n of [...STYLES.map((s) => `letters_specimen_${s}.png`), 'letters_words.png', 'letters_triangulation.png']) {
    await copyFile(resolve(OUT, n), resolve(ARTIFACTS, n));
  }
  await copyFile(resolve(OUT, 'report.txt'), resolve(ARTIFACTS, 'letters_report.txt'));

  if (test.problems.length) {
    console.error(`\nSELF-TEST FAILURES: ${test.problems.length}`);
    process.exitCode = 1;
  } else {
    console.log('\nself-test: OK');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
