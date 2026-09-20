/**
 * Procedural leaf-cluster alpha texture for the giant canopies: a ragged tuft of ~70 overlapping
 * leaves (teardrop laminae with a midrib) on a transparent background. Cards carrying it sit
 * INSIDE the real leaf laminae of each crown lobe and give the canopy the dense, roof-like
 * coverage that individual laminae cannot reach within the triangle budget. Seeded, so identical
 * across runs.
 */
import { CanvasTexture, ClampToEdgeWrapping, Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';
import type { Rng } from '../util/prng';

export interface LeafClusterPalette {
  leafCanopy: number;
  leafSun: number;
}

/** fraction of the texture reserved for the opaque corner patch */
const SOLID_PATCH = 0.1;
/** uv for solid (non-card) vertices sharing a cluster-card material */
export const SOLID_UV = SOLID_PATCH * 0.5;
/** cards map their quad onto [CARD_UV0, 1]² so they never touch the patch */
export const CARD_UV0 = SOLID_PATCH + 0.03;

export function createLeafClusterTexture(rng: Rng, palette: LeafClusterPalette, size = 512): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const r = rng.fork('leaf-cluster');
  const canopy = new Color(palette.leafCanopy);
  const sun = new Color(palette.leafSun);
  const cool = new Color(0x3d7346);
  const warm = new Color(0x93ab3f);
  const css = (c: Color) => `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;

  // clamped so no leaf strays far from the clump: the outliers of an unclamped spread were what
  // made a card read as a star of loose leaves rather than a clump
  const gauss = () => Math.max(-2.2, Math.min(2.2, r.gauss()));
  // a dense tuft: many overlapping leaves so a 1–2 m card reads as one soft clump of 10–20 cm
  // leaves (sheet 01's foliage: dense soft clumps, the back leaves lost in shade), not as one big
  // lamina and not as a sparse spray. 110 leaves at a 0.13 spread cover ≈ 48 % of the card
  // (the 84-leaf 0.16 spread covered 36 %). Coverage loss in the mip chain is compensated by a
  // dark outline around each leaf and a lower alpha test / negative mip bias in the material.
  const leaves = 110;
  for (let i = 0; i < leaves; i++) {
    const depth = i / leaves; // back leaves first (darker), front leaves last (brighter)
    const cx = size * (0.56 + gauss() * 0.13);
    const cy = size * (0.44 + gauss() * 0.13);
    const length = size * r.range(0.13, 0.22);
    const width = length * r.range(0.5, 0.72);
    const angle = r.range(0, Math.PI * 2);
    const shade = 0.55 + 0.55 * depth + r.range(-0.08, 0.08);
    const base = canopy
      .clone()
      .lerp(sun, r.range(0, 0.55) * depth)
      .lerp(r.chance(0.5) ? cool : warm, r.range(0, 0.3))
      .multiplyScalar(shade);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // teardrop lamina: base at (0,0), tip at (0,length)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(width * 0.62, length * 0.28, width * 0.1, length);
    ctx.quadraticCurveTo(-width * 0.62, length * 0.28, 0, 0);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, length * 0.05);
    ctx.strokeStyle = css(base.clone().multiplyScalar(0.6));
    ctx.stroke();
    ctx.fillStyle = css(base);
    ctx.fill();
    // lit half + midrib
    const grad = ctx.createLinearGradient(-width * 0.5, 0, width * 0.5, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(255,255,230,${0.14 + 0.16 * depth})`);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = css(base.clone().multiplyScalar(0.72));
    ctx.lineWidth = Math.max(1, length * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, length * 0.05);
    ctx.lineTo(width * 0.05, length * 0.92);
    ctx.stroke();
    ctx.restore();
  }

  // opaque white patch in the uv (0,0) corner: solid vertices (trunks, lobe cores) that share this
  // material point their uv here (see SOLID_UV) so they survive the alpha test; cards use CARD_UV0..1
  const patch = Math.round(size * SOLID_PATCH);
  ctx.clearRect(0, size - patch, patch, patch);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, size - patch, patch, patch);

  const texture = new CanvasTexture(canvas);
  texture.name = 'procedural:leaf-cluster';
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The near-camera pair of the cluster map (round 39): the SAME 110 leaves (same stream, same
 * layout, so a card's silhouette is one clump at every distance) drawn at `size` with what a
 * leaf shows from 1–6 m — a wavy margin, a lit rim on the sun side and a shaded rim on the other,
 * the midrib and six pairs of secondary veins, a blade-to-margin tone gradient — plus a second
 * canvas carrying per-leaf surface normals (R, G: tangent-space xy, the blade cupped across its
 * width and tilted per leaf) and a thickness term (B: 1 = thin translucent blade, low on the
 * veins and margins) under the same coverage. The canopy shader blends both in by view distance
 * (materials.ts CARD_NEAR_M): past it the 512 map alone is sampled, so the far look — and the
 * six fixed captures — are what they were.
 */
export interface LeafClusterDetail {
  color: CanvasTexture;
  /** RG = tangent-space normal xy (0.5 = flat), B = thickness, A = coverage */
  normal: CanvasTexture;
}

export function createLeafClusterDetail(rng: Rng, palette: LeafClusterPalette, size = 1024): LeafClusterDetail {
  const color = document.createElement('canvas');
  color.width = color.height = size;
  const normal = document.createElement('canvas');
  normal.width = normal.height = size;
  const cc = color.getContext('2d')!;
  const nc = normal.getContext('2d')!;
  cc.clearRect(0, 0, size, size);
  nc.clearRect(0, 0, size, size);
  // the layout stream: the same fork, the same draws in the same order as the 512 map above
  const r = rng.fork('leaf-cluster');
  // the detail's own stream, so the layout above never re-rolls
  const rd = rng.fork('leaf-cluster-detail');
  const canopy = new Color(palette.leafCanopy);
  const sun = new Color(palette.leafSun);
  const cool = new Color(0x3d7346);
  const warm = new Color(0x93ab3f);
  const css = (c: Color, a = 1) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
  const gauss = () => Math.max(-2.2, Math.min(2.2, r.gauss()));
  const leaves = 110;
  /** the wavy teardrop outline of a leaf: base at (0, 0), tip at (0, length) */
  const outline = (ctx: CanvasRenderingContext2D, length: number, width: number, wave: number, phase: number) => {
    ctx.beginPath();
    const n = 26;
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k <= n; k++) {
        const t = side < 0 ? k / n : 1 - k / n;
        // the teardrop's half-width along its length, widest at 30 %
        const hw = width * 0.5 * Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 + wave * Math.sin(t * 19 + phase) * (0.3 + 0.7 * t));
        const x = side * hw + width * 0.1 * t * t;
        const y = length * t;
        if (side < 0 && k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  };
  for (let i = 0; i < leaves; i++) {
    const depth = i / leaves;
    const cx = size * (0.56 + gauss() * 0.13);
    const cy = size * (0.44 + gauss() * 0.13);
    const length = size * r.range(0.13, 0.22);
    const width = length * r.range(0.5, 0.72);
    const angle = r.range(0, Math.PI * 2);
    const shade = 0.55 + 0.55 * depth + r.range(-0.08, 0.08);
    const base = canopy
      .clone()
      .lerp(sun, r.range(0, 0.55) * depth)
      .lerp(r.chance(0.5) ? cool : warm, r.range(0, 0.3))
      .multiplyScalar(shade);
    // detail draws (own stream)
    const wave = rd.range(0.02, 0.06);
    const wavePhase = rd.range(0, Math.PI * 2);
    const tiltX = rd.range(-0.35, 0.35);
    const tiltY = rd.range(-0.25, 0.25);
    const cup = rd.range(0.3, 0.55);
    const litSide = rd.chance(0.5) ? 1 : -1;
    const veinPairs = 5 + rd.int(0, 3);
    const veinAngle = rd.range(0.55, 0.85);
    // ---- colour ----
    cc.save();
    cc.translate(cx, cy);
    cc.rotate(angle);
    outline(cc, length, width, wave, wavePhase);
    cc.lineJoin = 'round';
    cc.lineWidth = Math.max(1.5, length * 0.035);
    cc.strokeStyle = css(base.clone().multiplyScalar(0.55));
    cc.stroke();
    // blade: darker toward the base and the margins, lighter along the centre
    const blade = cc.createLinearGradient(0, 0, 0, length);
    blade.addColorStop(0, css(base.clone().multiplyScalar(0.86)));
    blade.addColorStop(0.5, css(base));
    blade.addColorStop(1, css(base.clone().lerp(sun, 0.12)));
    cc.fillStyle = blade;
    cc.fill();
    // lit half toward `litSide`, shaded half on the other
    const lit = cc.createLinearGradient(-width * 0.5 * litSide, 0, width * 0.5 * litSide, 0);
    lit.addColorStop(0, `rgba(20, 30, 10, ${0.22 - 0.1 * depth})`);
    lit.addColorStop(0.5, 'rgba(255,255,230,0)');
    lit.addColorStop(1, `rgba(255,255,225,${0.16 + 0.18 * depth})`);
    cc.fillStyle = lit;
    cc.fill();
    // the lit rim: a thin bright line along the lit margin (clipped to the blade)
    cc.save();
    cc.clip();
    cc.lineWidth = Math.max(1.5, length * 0.028);
    cc.strokeStyle = `rgba(255,255,220,${0.3 + 0.25 * depth})`;
    cc.beginPath();
    for (let k = 0; k <= 20; k++) {
      const t = 0.08 + (0.84 * k) / 20;
      const hw = width * 0.5 * Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 + wave * Math.sin(t * 19 + wavePhase) * (0.3 + 0.7 * t));
      const x = litSide * hw * 0.93 + width * 0.1 * t * t;
      if (k === 0) cc.moveTo(x, length * t);
      else cc.lineTo(x, length * t);
    }
    cc.stroke();
    cc.restore();
    // midrib and secondary veins
    const veinColor = css(base.clone().multiplyScalar(0.7));
    cc.strokeStyle = veinColor;
    cc.lineWidth = Math.max(1, length * 0.022);
    cc.beginPath();
    cc.moveTo(0, length * 0.03);
    cc.quadraticCurveTo(width * 0.02, length * 0.5, width * 0.08, length * 0.94);
    cc.stroke();
    cc.lineWidth = Math.max(0.8, length * 0.011);
    cc.strokeStyle = css(base.clone().multiplyScalar(0.78));
    for (let k = 0; k < veinPairs; k++) {
      const t = 0.14 + (0.72 * k) / veinPairs;
      const hw = width * 0.5 * Math.sin(Math.PI * Math.pow(t + 0.08, 0.62));
      const y0 = length * t;
      const mx = width * 0.05 * t * t;
      for (const s of [-1, 1]) {
        cc.beginPath();
        cc.moveTo(mx, y0);
        cc.quadraticCurveTo(mx + s * hw * 0.45, y0 + length * 0.09 * veinAngle, mx + s * hw * 0.92, y0 + length * 0.16 * veinAngle);
        cc.stroke();
      }
    }
    cc.restore();
    // ---- normal + thickness ----
    // the blade is cupped across its width: the normal tilts toward the margins by `cup`, and the
    // whole leaf is tilted (tiltX, tiltY) off the card plane. Painted as a linear gradient across
    // the leaf (in its own frame), rotated into the texture frame with the leaf: a normal at
    // across-offset s is normalize(across × s × cup + tilt, 1).
    const enc = (nx: number, ny: number, thick: number) => {
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = Math.hypot(nx, ny, nz) || 1;
      return `rgb(${Math.round(((nx / l) * 0.5 + 0.5) * 255)}, ${Math.round(((ny / l) * 0.5 + 0.5) * 255)}, ${Math.round(thick * 255)})`;
    };
    nc.save();
    nc.translate(cx, cy);
    nc.rotate(angle);
    outline(nc, length, width, wave, wavePhase);
    // the across vector in the texture's frame: the leaf's local +x rotated by `angle`
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    const grad = nc.createLinearGradient(-width * 0.5, 0, width * 0.5, 0);
    for (let k = 0; k <= 6; k++) {
      const s = (k / 6) * 2 - 1;
      const across = s * cup;
      // thickness: thin at the blade's centre and tip, thicker (less translucent) at the margins
      const thick = 0.9 - 0.45 * Math.abs(s) * Math.abs(s);
      grad.addColorStop(k / 6, enc(ax * across + tiltX, ay * across + tiltY, thick));
    }
    nc.fillStyle = grad;
    nc.fill();
    // veins are thicker (opaque): the midrib and the secondaries in a low-thickness colour with
    // the flat normal
    nc.strokeStyle = enc(tiltX * 0.5, tiltY * 0.5, 0.3);
    nc.lineWidth = Math.max(1.2, length * 0.024);
    nc.beginPath();
    nc.moveTo(0, length * 0.03);
    nc.quadraticCurveTo(width * 0.02, length * 0.5, width * 0.08, length * 0.94);
    nc.stroke();
    nc.lineWidth = Math.max(0.8, length * 0.011);
    nc.strokeStyle = enc(tiltX * 0.5, tiltY * 0.5, 0.45);
    for (let k = 0; k < veinPairs; k++) {
      const t = 0.14 + (0.72 * k) / veinPairs;
      const hw = width * 0.5 * Math.sin(Math.PI * Math.pow(t + 0.08, 0.62));
      const y0 = length * t;
      const mx = width * 0.05 * t * t;
      for (const s of [-1, 1]) {
        nc.beginPath();
        nc.moveTo(mx, y0);
        nc.quadraticCurveTo(mx + s * hw * 0.45, y0 + length * 0.09 * veinAngle, mx + s * hw * 0.92, y0 + length * 0.16 * veinAngle);
        nc.stroke();
      }
    }
    nc.restore();
  }
  // the opaque corner patch (see SOLID_UV): white in the colour map, flat / thick in the normal map
  const patch = Math.round(size * SOLID_PATCH);
  cc.clearRect(0, size - patch, patch, patch);
  cc.fillStyle = '#ffffff';
  cc.fillRect(0, size - patch, patch, patch);
  nc.clearRect(0, size - patch, patch, patch);
  nc.fillStyle = 'rgb(128, 128, 0)';
  nc.fillRect(0, size - patch, patch, patch);

  const make = (canvas: HTMLCanvasElement, name: string, srgb: boolean) => {
    const t = new CanvasTexture(canvas);
    t.name = name;
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { color: make(color, 'procedural:leaf-cluster-near', true), normal: make(normal, 'procedural:leaf-cluster-near-normal', false) };
}

/**
 * Far-crown atlas (round 47, survey-2 #10 / #27: the distant trees' crowns read as flat pale
 * cardboard — one-tone cut-outs with hard edges, a disc on a pole). A 2 × 2 atlas, one crown
 * SILHOUETTE a cell — round, tall, wide two-lobed, columnar — each painted as a few hundred
 * overlapping soft leaf clumps: dense and darker toward the core and the underside, lighter
 * toward the top, ragged at the outline where small sparse clumps carry the alpha down softly
 * (no hard cut-out at any mip). distant.ts draws 2–3 crossed cards of one cell per crown and its
 * material shades them with a spherical normal, so the lit rim follows the sun whatever the
 * card's yaw. The RGB under transparent texels is flooded with the cell's mean leaf colour so the
 * filtered fringe never darkens toward black. Its own stream (`far-crown`); the cluster maps
 * above draw exactly what they did.
 */
export const FAR_CROWN_CELLS = 4;
/** share of a cell the silhouettes keep clear of the cell edge (the cards' uv insets by half of it) */
export const FAR_CROWN_MARGIN = 0.05;
/** the crowns' extent inside a cell, as a share of the cell: [width, height] — the cards are sized from it */
export const FAR_CROWN_FILL: [number, number] = [0.76, 0.66];

export interface FarCrownCellUv {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** uv rectangle of atlas cell `i` (v up), inset by half the margin */
export function farCrownCellUv(i: number): FarCrownCellUv {
  const c = i % 2;
  const row = Math.floor(i / 2) % 2;
  const m = FAR_CROWN_MARGIN * 0.25;
  return { u0: c * 0.5 + m, u1: c * 0.5 + 0.5 - m, v0: (1 - row) * 0.5 + m, v1: (1 - row) * 0.5 + 0.5 - m };
}

interface CrownLobe {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** the four silhouettes (cell-normalised, y down): a union of ellipses */
const FAR_CROWN_SHAPES: CrownLobe[][] = [
  // 0 — round broad crown, lumpy top
  [
    { x: 0.5, y: 0.5, rx: 0.34, ry: 0.27 },
    { x: 0.33, y: 0.56, rx: 0.19, ry: 0.15 },
    { x: 0.69, y: 0.54, rx: 0.2, ry: 0.16 },
    { x: 0.53, y: 0.33, rx: 0.21, ry: 0.15 },
    { x: 0.39, y: 0.39, rx: 0.15, ry: 0.12 },
  ],
  // 1 — tall crown, an off-centre leader
  [
    { x: 0.5, y: 0.52, rx: 0.26, ry: 0.31 },
    { x: 0.45, y: 0.26, rx: 0.15, ry: 0.12 },
    { x: 0.67, y: 0.58, rx: 0.15, ry: 0.14 },
    { x: 0.35, y: 0.66, rx: 0.14, ry: 0.12 },
  ],
  // 2 — wide two-lobed crown with a dip between the lobes
  [
    { x: 0.35, y: 0.5, rx: 0.24, ry: 0.22 },
    { x: 0.66, y: 0.48, rx: 0.26, ry: 0.24 },
    { x: 0.5, y: 0.6, rx: 0.24, ry: 0.17 },
    { x: 0.49, y: 0.4, rx: 0.13, ry: 0.1 },
  ],
  // 3 — columnar slender crown
  [
    { x: 0.5, y: 0.52, rx: 0.17, ry: 0.32 },
    { x: 0.5, y: 0.24, rx: 0.11, ry: 0.09 },
    { x: 0.59, y: 0.42, rx: 0.11, ry: 0.13 },
    { x: 0.41, y: 0.64, rx: 0.11, ry: 0.13 },
  ],
];

/** normalised ellipse distance of the nearest lobe (< 1 inside), and the lobe */
function lobeDistance(shape: CrownLobe[], x: number, y: number): number {
  let best = Infinity;
  for (const l of shape) {
    const dx = (x - l.x) / l.rx;
    const dy = (y - l.y) / l.ry;
    best = Math.min(best, Math.sqrt(dx * dx + dy * dy));
  }
  return best;
}

export function createFarCrownAtlas(rng: Rng, palette: LeafClusterPalette, size = 1024): DataTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const canopy = new Color(palette.leafCanopy);
  const sun = new Color(palette.leafSun);
  const cool = new Color(0x3d7346);
  const warm = new Color(0x93ab3f);
  const css = (c: Color, a: number) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a.toFixed(3)})`;
  const cell = size / 2;
  const sm = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // Use the existing leaf painter's silhouette for each clump. The old radial blobs became
  // metre-wide blurred ovals when a walker stood under a depth-row crown. This small canvas
  // never reaches the GPU; it is only a reusable alpha stamp in the same four-cell atlas.
  // Its own fork leaves all established clump and leaflet draws below unchanged.
  const tuft = createLeafClusterTexture(rng.fork('far-crown-tuft'), palette, 128);
  const tuftCanvas = tuft.image as HTMLCanvasElement;
  const stamp = document.createElement('canvas');
  stamp.width = stamp.height = 128;
  const sc = stamp.getContext('2d')!;
  const paintTuft = (base: Color, alpha: number) => {
    sc.globalCompositeOperation = 'source-over';
    sc.clearRect(0, 0, 128, 128);
    const tone = sc.createLinearGradient(0, 0, 0, 128);
    tone.addColorStop(0, css(base.clone().multiplyScalar(1.1), alpha));
    tone.addColorStop(1, css(base, alpha));
    sc.fillStyle = tone;
    sc.fillRect(0, 0, 128, 128);
    sc.globalCompositeOperation = 'destination-in';
    // Same card UV crop as the giant cluster: exclude the solid wood patch in its corner.
    sc.drawImage(tuftCanvas, 128 * CARD_UV0, 0, 128 * (1 - CARD_UV0), 128 * (1 - CARD_UV0), 0, 0, 128, 128);
  };

  interface Clump {
    x: number;
    y: number;
    r: number;
    f: number;
    shade: number;
    alpha: number;
    layer: number;
    hue: number;
  }

  for (let i = 0; i < FAR_CROWN_CELLS; i++) {
    const r = rng.fork(`far-crown-${i}`);
    const shape = FAR_CROWN_SHAPES[i];
    const ox = (i % 2) * cell;
    const oy = Math.floor(i / 2) * cell;
    const columnar = i === 3;
    const clumps: Clump[] = [];
    // Body clumps keep the established centres/radii and are denser toward the core. Their
    // margins now resolve into overlapping leaf blades and small gaps at close range.
    const body = columnar ? 220 : 300;
    let guard = 0;
    while (clumps.length < body && guard++ < body * 60) {
      const x = FAR_CROWN_MARGIN + r() * (1 - 2 * FAR_CROWN_MARGIN);
      const y = FAR_CROWN_MARGIN + r() * (1 - 2 * FAR_CROWN_MARGIN);
      const e = lobeDistance(shape, x, y);
      if (e > 1) continue;
      if (r() > 0.3 + 0.7 * sm(1.0, 0.5, e)) continue;
      const depth = 1 - e;
      const rr = (0.03 + 0.032 * r()) * (0.72 + 0.28 * sm(0, 0.5, depth));
      // lit from above: the top of the crown toward the sun colour, the underside in its own shade
      const f = Math.min(1, Math.max(0, 0.12 + 0.62 * (1 - y) * (0.7 + 0.3 * r()) + 0.12 * r()));
      const shade = 0.72 + 0.33 * r() - 0.18 * sm(0.55, 0.9, y);
      clumps.push({ x, y, r: rr, f, shade, alpha: 0.92, layer: y * 0.65 + r() * 0.35, hue: r() });
    }
    // rim clumps: small, sparse, half-transparent, riding the outline (the soft ragged edge)
    const rim = columnar ? 70 : 110;
    for (let k = 0; k < rim; k++) {
      const l = shape[r.int(0, shape.length)];
      const th = r() * Math.PI * 2;
      const push = 0.92 + 0.2 * r();
      const x = l.x + Math.cos(th) * l.rx * push;
      const y = l.y + Math.sin(th) * l.ry * push;
      if (x < FAR_CROWN_MARGIN || x > 1 - FAR_CROWN_MARGIN || y < FAR_CROWN_MARGIN || y > 1 - FAR_CROWN_MARGIN) continue;
      // the underside's rim is sparser: the mass reads as one dark base
      if (y > 0.72 && r() < 0.5) continue;
      const rr = 0.016 + 0.02 * r();
      const f = Math.min(1, Math.max(0, 0.2 + 0.6 * (1 - y) + 0.15 * r()));
      clumps.push({ x, y, r: rr, f, shade: 0.85 + 0.25 * r(), alpha: 0.5 + 0.25 * r(), layer: 0.2 + y * 0.5 + r() * 0.5, hue: r() });
    }
    // back to front: the lower / darker clumps first, the lit top clumps last
    clumps.sort((a, b) => b.layer - a.layer);
    for (const c of clumps) {
      const base = canopy
        .clone()
        .lerp(sun, c.f * 0.72)
        .lerp(c.hue < 0.5 ? cool : warm, 0.22 * Math.abs(c.hue - 0.5) * 2)
        .multiplyScalar(c.shade);
      const px = ox + c.x * cell;
      const py = oy + c.y * cell;
      const pr = c.r * cell;
      const dark = base.clone().multiplyScalar(0.62);
      // The offset leaf mass below supplies self-shade without a circular blurred halo.
      paintTuft(dark, c.alpha * 0.55);
      ctx.drawImage(stamp, px - pr * 0.95, py - pr * 0.5, pr * 1.9, pr * 1.9);
      paintTuft(base, c.alpha);
      ctx.drawImage(stamp, px - pr, py - pr, pr * 2, pr * 2);
      // Small lit blades use the same teardrop outline as createLeafClusterTexture. Keep the
      // original leaflet stream and footprint, but let the margins end at a leaf edge.
      const leaflets = 4 + r.int(0, 5);
      const lit = base.clone().lerp(sun, 0.2).multiplyScalar(1.1);
      for (let k = 0; k < leaflets; k++) {
        const a = -Math.PI * (0.1 + 0.8 * r());
        const d = pr * (0.15 + 0.55 * r());
        const lx = px + Math.cos(a) * d;
        const ly = py + Math.sin(a) * d;
        const ll = pr * (0.28 + 0.22 * r());
        const lw = ll * (0.45 + 0.25 * r());
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(r() * Math.PI);
        ctx.translate(0, -ll * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(lw * 0.62, ll * 0.28, lw * 0.1, ll);
        ctx.quadraticCurveTo(-lw * 0.62, ll * 0.28, 0, 0);
        ctx.closePath();
        ctx.fillStyle = css(lit, c.alpha * 0.8);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  tuft.dispose();

  // alpha bleed: the RGB under transparent and near-transparent texels becomes the cell's mean
  // leaf colour, so bilinear / mip filtering across the fringe never pulls toward black; rows
  // flipped so row 0 is the bottom of the canvas (v = 0) — the DataTexture is not flipped on upload
  const img = ctx.getImageData(0, 0, size, size).data;
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < FAR_CROWN_CELLS; i++) {
    const ox = (i % 2) * cell;
    const oy = Math.floor(i / 2) * cell;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sa = 0;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const k = ((oy + y) * size + ox + x) * 4;
        const a = img[k + 3];
        sr += img[k] * a;
        sg += img[k + 1] * a;
        sb += img[k + 2] * a;
        sa += a;
      }
    }
    const mr = sa ? sr / sa : 0;
    const mg = sa ? sg / sa : 0;
    const mb = sa ? sb / sa : 0;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const k = ((oy + y) * size + ox + x) * 4;
        const a = img[k + 3];
        const w = Math.min(1, a / 72);
        const o = ((size - 1 - (oy + y)) * size + ox + x) * 4;
        out[o] = Math.round(img[k] * w + mr * (1 - w));
        out[o + 1] = Math.round(img[k + 1] * w + mg * (1 - w));
        out[o + 2] = Math.round(img[k + 2] * w + mb * (1 - w));
        out[o + 3] = a;
      }
    }
  }
  const texture = new DataTexture(out, size, size, RGBAFormat, UnsignedByteType);
  texture.name = 'procedural:far-crown';
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
