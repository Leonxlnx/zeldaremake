/**
 * Tiny SVG DOM helpers for the hand-drawn HUD (no external assets, no data URIs).
 */
export const SVG_NS = 'http://www.w3.org/2000/svg';

export type Attrs = Record<string, string | number | undefined>;

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, children: (Node | null | undefined)[] = []): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  for (const c of children) if (c) el.appendChild(c);
  return el;
}

export function setAttrs(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    el.setAttribute(k, typeof v === 'number' ? fmt(v) : v);
  }
}

/** Root svg element with a design-space viewBox. */
export function svgRoot(viewBox: [number, number, number, number], attrs: Attrs = {}, children: (Node | null | undefined)[] = []): SVGSVGElement {
  return svgEl('svg', { xmlns: SVG_NS, viewBox: viewBox.map(fmt).join(' '), ...attrs }, children);
}

export function g(attrs: Attrs = {}, children: (Node | null | undefined)[] = []): SVGGElement {
  return svgEl('g', attrs, children);
}

export function path(d: string, attrs: Attrs = {}): SVGPathElement {
  return svgEl('path', { d, ...attrs });
}

export function circle(cx: number, cy: number, r: number, attrs: Attrs = {}): SVGCircleElement {
  return svgEl('circle', { cx, cy, r, ...attrs });
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, attrs: Attrs = {}): SVGEllipseElement {
  return svgEl('ellipse', { cx, cy, rx, ry, ...attrs });
}

export function rect(x: number, y: number, w: number, h: number, attrs: Attrs = {}): SVGRectElement {
  return svgEl('rect', { x, y, width: w, height: h, ...attrs });
}

export function line(x1: number, y1: number, x2: number, y2: number, attrs: Attrs = {}): SVGLineElement {
  return svgEl('line', { x1, y1, x2, y2, ...attrs });
}

export function text(x: number, y: number, content: string, attrs: Attrs = {}): SVGTextElement {
  const t = svgEl('text', { x, y, ...attrs });
  t.textContent = content;
  return t;
}

export function polygon(points: [number, number][], attrs: Attrs = {}): SVGPolygonElement {
  return svgEl('polygon', { points: points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' '), ...attrs });
}

export interface Stop {
  offset: number;
  color: string;
  opacity?: number;
}

export function linearGradient(id: string, stops: Stop[], attrs: Attrs = {}): SVGLinearGradientElement {
  return svgEl(
    'linearGradient',
    { id, ...attrs },
    stops.map((s) => svgEl('stop', { offset: `${fmt(s.offset * 100)}%`, 'stop-color': s.color, 'stop-opacity': s.opacity })),
  );
}

export function radialGradient(id: string, stops: Stop[], attrs: Attrs = {}): SVGRadialGradientElement {
  return svgEl(
    'radialGradient',
    { id, ...attrs },
    stops.map((s) => svgEl('stop', { offset: `${fmt(s.offset * 100)}%`, 'stop-color': s.color, 'stop-opacity': s.opacity })),
  );
}

/** Gaussian-blur filter (used for glows; deterministic in Chromium). */
export function blurFilter(id: string, stdDeviation: number, pad = 0.6): SVGFilterElement {
  return svgEl('filter', { id, x: -pad, y: -pad, width: 1 + pad * 2, height: 1 + pad * 2 }, [svgEl('feGaussianBlur', { stdDeviation })]);
}

/** Regular hexagon path (pointy top/bottom) centred on (cx, cy), stretched to w × h. */
export function hexPath(cx: number, cy: number, w: number, h: number, sideFrac = 0.5): string {
  const hw = w / 2;
  const hh = h / 2;
  const s = hh * sideFrac; // half-length of the vertical sides
  return `M${fmt(cx)} ${fmt(cy - hh)} L${fmt(cx + hw)} ${fmt(cy - s)} L${fmt(cx + hw)} ${fmt(cy + s)} L${fmt(cx)} ${fmt(cy + hh)} L${fmt(cx - hw)} ${fmt(cy + s)} L${fmt(cx - hw)} ${fmt(cy - s)} Z`;
}

/** Flat-top hexagon (pointy left/right). */
export function flatHexPath(cx: number, cy: number, w: number, h: number, topFrac = 0.5): string {
  const hw = w / 2;
  const hh = h / 2;
  const t = hw * topFrac;
  return `M${fmt(cx - t)} ${fmt(cy - hh)} L${fmt(cx + t)} ${fmt(cy - hh)} L${fmt(cx + hw)} ${fmt(cy)} L${fmt(cx + t)} ${fmt(cy + hh)} L${fmt(cx - t)} ${fmt(cy + hh)} L${fmt(cx - hw)} ${fmt(cy)} Z`;
}

/**
 * Closed smooth path through `pts` (Catmull-Rom → cubic Béziers). Used for the hand-drawn
 * minimap blobs so they read as ink outlines rather than polygons.
 */
export function smoothClosedPath(pts: [number, number][], tension = 0.5): string {
  const n = pts.length;
  if (n < 3) return '';
  const k = tension / 3;
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = p2[1] - (p3[1] - p1[1]) * k;
    d += ` C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d + ' Z';
}

/** Open smooth polyline (same construction, clamped ends). */
export function smoothOpenPath(pts: [number, number][], tension = 0.5): string {
  const n = pts.length;
  if (n < 2) return '';
  const k = tension / 3;
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = p2[1] - (p3[1] - p1[1]) * k;
    d += ` C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

export function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
}

/** Small deterministic PRNG for decorative jitter (never Math.random — captures must be reproducible). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
