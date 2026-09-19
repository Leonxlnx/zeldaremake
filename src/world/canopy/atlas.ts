/**
 * Seeded leaf-mass atlas for the canopy roof (owner-fable, 2026-09-19): a 2 × 2 sheet of four
 * different tufts, each a clump of 120–170 overlapping ovate leaves. Unlike the giants' single
 * cluster tuft (trees/leaf-cluster-texture.ts) the roof's cards are only ever seen from below at
 * 20–40 m, so what the sheet carries is what a canopy UNDERSIDE shows at that range: a dark
 * interior where leaves overlap several deep, single leaves at the fringe that the sky shows
 * through, and a lit rim along the outer leaves where the sun comes over the edge. A second
 * canvas carries the overlap depth (R = 0 one leaf … 1 many) so the shader can let the sun
 * through the thin fringe and not through the core.
 *
 * Seeded (`rng.fork('roof-atlas')`), drawn with the 2-D canvas API, no image files: identical
 * on every run and every machine (anti-cheat C1 hashes it as a runtime raster like the cluster
 * map). Cards map onto one tile with a 2 % inset (ROOF_TILE_UV) so mip bleed between tiles is
 * transparent-into-transparent.
 */
import { CanvasTexture, ClampToEdgeWrapping, Color, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import type { Rng } from '../util/prng';

export interface RoofPalette {
  leafCanopy: number;
  leafSun: number;
}

export interface RoofAtlas {
  /** RGB = leaf colour (sRGB), A = coverage */
  color: CanvasTexture;
  /** R = overlap depth (0 one leaf … 1 many), A = the same coverage */
  depth: CanvasTexture;
  /** tiles per side */
  tiles: number;
}

/** tiles per side of the sheet */
export const ROOF_TILES = 2;
/** uv inset of a card inside its tile (share of the tile) */
export const ROOF_TILE_INSET = 0.02;

/** the uv rectangle [u0, v0, u1, v1] of tile `i` (0 … ROOF_TILES² − 1) */
export function roofTileUv(i: number): [number, number, number, number] {
  const tx = i % ROOF_TILES;
  const ty = Math.floor(i / ROOF_TILES) % ROOF_TILES;
  const s = 1 / ROOF_TILES;
  return [(tx + ROOF_TILE_INSET) * s, (ty + ROOF_TILE_INSET) * s, (tx + 1 - ROOF_TILE_INSET) * s, (ty + 1 - ROOF_TILE_INSET) * s];
}

export function createRoofAtlas(rng: Rng, palette: RoofPalette, size = 1024): RoofAtlas {
  const color = document.createElement('canvas');
  color.width = color.height = size;
  const depth = document.createElement('canvas');
  depth.width = depth.height = size;
  const cc = color.getContext('2d')!;
  // read back once at the end (the overlap depth); the attribute keeps Chrome from warning
  const dc = depth.getContext('2d', { willReadFrequently: true })!;
  cc.clearRect(0, 0, size, size);
  dc.clearRect(0, 0, size, size);
  const r = rng.fork('roof-atlas');
  const canopy = new Color(palette.leafCanopy);
  const sun = new Color(palette.leafSun);
  const cool = new Color(0x365f3d);
  const warm = new Color(0x7f9a3a);
  const css = (c: Color, a = 1) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
  const tile = size / ROOF_TILES;

  /** an ovate leaf outline, base at (0, 0), tip at (0, length), with a slightly wavy margin */
  const outline = (ctx: CanvasRenderingContext2D, length: number, width: number, wave: number, phase: number) => {
    ctx.beginPath();
    const n = 22;
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k <= n; k++) {
        const t = side < 0 ? k / n : 1 - k / n;
        const hw = width * 0.5 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 + wave * Math.sin(t * 17 + phase) * (0.3 + 0.7 * t));
        const x = side * hw + width * 0.08 * t * t;
        const y = length * t;
        if (side < 0 && k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  };

  for (let ti = 0; ti < ROOF_TILES * ROOF_TILES; ti++) {
    const tr = r.fork(`tile-${ti}`);
    const ox = (ti % ROOF_TILES) * tile;
    const oy = Math.floor(ti / ROOF_TILES) * tile;
    // the tuft: an elongated clump, its long axis at a per-tile angle, so the four tiles read as
    // four different masses when a clump mixes them
    const axis = tr.range(0, Math.PI);
    const ax = Math.cos(axis);
    const ay = Math.sin(axis);
    const spreadL = tile * tr.range(0.19, 0.24);
    const spreadS = tile * tr.range(0.12, 0.16);
    const leaves = tr.int(120, 171);
    const gauss = () => Math.max(-2.1, Math.min(2.1, tr.gauss()));
    // one leaf stream: position first so the interior / fringe read is a pure function of where
    // the leaf landed, back leaves first (dark), front leaves last (lit)
    const drawn: { x: number; y: number; d: number }[] = [];
    for (let i = 0; i < leaves; i++) {
      const gl = gauss();
      const gs = gauss();
      const cx = ox + tile * 0.5 + ax * gl * spreadL - ay * gs * spreadS;
      const cy = oy + tile * 0.5 + ay * gl * spreadL + ax * gs * spreadS;
      // radial position in the clump (0 centre … 1 fringe)
      const rad = Math.min(1, Math.hypot(gl / 2.1, gs / 2.1));
      drawn.push({ x: cx, y: cy, d: rad });
    }
    // interior leaves first: the fringe is drawn on top so its lit rims survive
    drawn.sort((a, b) => a.d - b.d);
    for (let i = 0; i < drawn.length; i++) {
      const { x: cx, y: cy, d: rad } = drawn[i];
      const front = i / drawn.length;
      const length = tile * tr.range(0.11, 0.17) * (1 - 0.25 * rad);
      const width = length * tr.range(0.55, 0.8);
      const angle = tr.range(0, Math.PI * 2);
      const wave = tr.range(0.02, 0.05);
      const phase = tr.range(0, Math.PI * 2);
      // colour: the underside of a canopy — interior leaves dark (several deep, no sky behind),
      // fringe leaves toward the leaf-sun tone with a lit rim on their outer edge
      const shade = 0.34 + 0.5 * rad + 0.16 * front + tr.range(-0.06, 0.06);
      const base = canopy
        .clone()
        .lerp(sun, tr.range(0, 0.45) * rad * rad)
        .lerp(tr.chance(0.5) ? cool : warm, tr.range(0, 0.28))
        .multiplyScalar(shade);
      cc.save();
      cc.translate(cx, cy);
      cc.rotate(angle);
      outline(cc, length, width, wave, phase);
      cc.lineJoin = 'round';
      cc.lineWidth = Math.max(1.2, length * 0.04);
      cc.strokeStyle = css(base.clone().multiplyScalar(0.55));
      cc.stroke();
      const blade = cc.createLinearGradient(0, 0, 0, length);
      blade.addColorStop(0, css(base.clone().multiplyScalar(0.8)));
      blade.addColorStop(0.55, css(base));
      blade.addColorStop(1, css(base.clone().lerp(sun, 0.1 + 0.2 * rad)));
      cc.fillStyle = blade;
      cc.fill();
      // midrib
      cc.strokeStyle = css(base.clone().multiplyScalar(0.68));
      cc.lineWidth = Math.max(0.8, length * 0.022);
      cc.beginPath();
      cc.moveTo(0, length * 0.04);
      cc.quadraticCurveTo(width * 0.02, length * 0.5, width * 0.07, length * 0.94);
      cc.stroke();
      // lit rim on the fringe leaves' outer half (the sun coming over the mass's edge)
      if (rad > 0.55) {
        cc.save();
        outline(cc, length, width, wave, phase);
        cc.clip();
        const lit = cc.createLinearGradient(-width * 0.5, 0, width * 0.5, 0);
        const a = 0.18 + 0.32 * (rad - 0.55);
        lit.addColorStop(0, 'rgba(255,255,225,0)');
        lit.addColorStop(0.55, 'rgba(255,255,225,0)');
        lit.addColorStop(1, `rgba(255,252,215,${a.toFixed(3)})`);
        cc.fillStyle = lit;
        cc.fillRect(-width, 0, width * 2, length);
        cc.restore();
      }
      cc.restore();
      // overlap depth: every leaf adds a share, so the interior (many deep) saturates toward 1
      // and a single fringe leaf stays thin
      dc.save();
      dc.translate(cx, cy);
      dc.rotate(angle);
      outline(dc, length, width, wave, phase);
      dc.fillStyle = `rgba(255, 255, 255, ${(0.16 + 0.14 * (1 - rad)).toFixed(3)})`;
      dc.fill();
      dc.restore();
    }
  }
  // the depth canvas: R carries the accumulated overlap (alpha of the white draws); make it an
  // opaque-where-covered map with the overlap in R so the sampler never reads the alpha ramp
  {
    const img = dc.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      // depth 0 … 1 over the accumulated alpha 0.16 … 1: one leaf ≈ 0, four deep ≈ 0.6, eight ≈ 1
      const depthV = a <= 0 ? 0 : Math.min(255, Math.round(((a / 255 - 0.16) / 0.7) * 255));
      d[i] = Math.max(0, depthV);
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = a > 0 ? 255 : 0;
    }
    dc.putImageData(img, 0, 0);
  }

  const make = (canvas: HTMLCanvasElement, name: string, srgb: boolean) => {
    const t = new CanvasTexture(canvas);
    t.name = name;
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.wrapS = ClampToEdgeWrapping;
    t.wrapT = ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { color: make(color, 'procedural:canopy-roof', true), depth: make(depth, 'procedural:canopy-roof-depth', false), tiles: ROOF_TILES };
}
