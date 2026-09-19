/**
 * Procedural white-bark (birch) texture set drawn on a canvas at startup: pale papery bark with
 * faint vertical streaks, dark horizontal lenticel scars, grey peel patches and a few black
 * branch scars. Colour, normal and roughness maps come from the same seeded height field so they
 * agree with each other. 1 tile ≈ 1 m around × 2 m along the trunk.
 */
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D } from '../util/noise';

export interface BarkTextures {
  color: Texture;
  normal: Texture;
  roughness: Texture;
}

export function createWhiteBarkTextures(rng: Rng, width = 512, height = 1024): BarkTextures {
  const noise = new Noise2D(`${rng()}/bark`);
  const detail = new Noise2D(`${rng()}/bark-detail`);
  const N = width * height;
  const heightMap = new Float32Array(N);
  const darkness = new Float32Array(N); // 0 = white bark, 1 = black scar
  const grey = new Float32Array(N); // grey peel patches
  const rough = new Float32Array(N);

  // Base: papery bark with soft vertical streaks (wrap-safe in u).
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const ang = (x / width) * Math.PI * 2;
      const cx = Math.cos(ang) * 1.5;
      const cz = Math.sin(ang) * 1.5;
      const streak = noise.fbm(cx * 2.2 + 3, y * 0.004 + cz * 0.3, 3) * 0.5 + 0.5;
      const fine = detail.noise(cx * 9 + cz * 9, y * 0.09) * 0.5 + 0.5;
      const grain = detail.noise(cx * 30, y * 0.6) * 0.5 + 0.5;
      heightMap[i] = 0.5 + (streak - 0.5) * 0.25 + (fine - 0.5) * 0.12 + (grain - 0.5) * 0.06;
      rough[i] = 0.62 + (fine - 0.5) * 0.18;
      darkness[i] = 0;
      grey[i] = Math.max(0, (noise.fbm(cx * 0.9, y * 0.0025 + cz * 0.4, 3) - 0.3) * 1.4); // sparse grey bands
    }
  }

  const paint = (px: number, py: number, w: number, h: number, curve: number, d: number, feather: number, kind: 'scar' | 'peel' | 'knot') => {
    const x0 = Math.floor(px - w / 2 - 2);
    const x1 = Math.ceil(px + w / 2 + 2);
    const y0 = Math.max(0, Math.floor(py - h / 2 - feather - 2));
    const y1 = Math.min(height - 1, Math.ceil(py + h / 2 + feather + 2));
    for (let y = y0; y <= y1; y++) {
      for (let xx = x0; xx <= x1; xx++) {
        const x = ((xx % width) + width) % width;
        const u = (xx - px) / (w / 2); // -1..1 across the mark
        const yc = py + curve * (u * u - 0.5) * h; // slight arc
        const v = (y - yc) / (h / 2);
        let m: number;
        if (kind === 'knot') {
          // diamond/eye shape
          m = 1 - (Math.abs(u) * 0.9 + Math.abs(v) * 1.1);
          m = Math.max(0, Math.min(1, m * 2.2));
        } else {
          const edge = Math.max(0, 1 - Math.abs(u) ** 6);
          const vertical = Math.max(0, 1 - Math.abs(v) ** (kind === 'peel' ? 2 : 1.4));
          m = edge * vertical;
        }
        if (m <= 0) continue;
        const i = y * width + x;
        const soft = Math.min(1, m * (1 + feather * 0.25));
        if (kind === 'scar') {
          const ragged = 0.75 + 0.25 * detail.noise(xx * 0.4, y * 0.6);
          darkness[i] = Math.max(darkness[i], d * soft * ragged);
          heightMap[i] -= 0.22 * soft * d; // lenticels are slightly recessed
          rough[i] = Math.min(1, rough[i] + 0.25 * soft);
        } else if (kind === 'peel') {
          grey[i] = Math.max(grey[i], d * soft);
          heightMap[i] += 0.08 * soft * d;
        } else {
          darkness[i] = Math.max(darkness[i], d * soft);
          heightMap[i] -= 0.3 * soft;
          rough[i] = Math.min(1, rough[i] + 0.3 * soft);
        }
      }
    }
  };

  // Lenticels in loose horizontal rows.
  const rows = 34;
  for (let r = 0; r < rows; r++) {
    const rowY = ((r + rng()) / rows) * height;
    const count = 3 + Math.floor(rng() * 6);
    for (let k = 0; k < count; k++) {
      const px = rng() * width;
      const w = width * (0.05 + rng() * rng() * 0.28);
      const h = 3 + rng() * 6 + w * 0.02;
      paint(px, rowY + (rng() - 0.5) * 12, w, h, (rng() - 0.5) * 0.6, 0.55 + rng() * 0.45, 1.5, 'scar');
    }
  }
  // A few thin faint marks
  for (let k = 0; k < 90; k++) {
    paint(rng() * width, rng() * height, width * (0.02 + rng() * 0.08), 1.5 + rng() * 2, (rng() - 0.5) * 0.3, 0.25 + rng() * 0.3, 1, 'scar');
  }
  // Grey peel patches
  for (let k = 0; k < 14; k++) {
    paint(rng() * width, rng() * height, width * (0.12 + rng() * 0.35), 18 + rng() * 60, (rng() - 0.5) * 0.4, 0.45 + rng() * 0.45, 4, 'peel');
  }
  // Black branch scars (knots)
  for (let k = 0; k < 7; k++) {
    paint(rng() * width, rng() * height, 28 + rng() * 60, 40 + rng() * 90, 0, 0.85, 3, 'knot');
  }

  // Colour
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cg = colorCanvas.getContext('2d')!;
  const cimg = cg.createImageData(width, height);
  for (let i = 0; i < N; i++) {
    const hgt = heightMap[i];
    // pale warm-grey paper; streak lightness from the height field
    let r = 228 + (hgt - 0.5) * 60;
    let g = 224 + (hgt - 0.5) * 58;
    let b = 214 + (hgt - 0.5) * 52;
    const gr = Math.min(1, grey[i]);
    r = r * (1 - gr * 0.42) + 118 * gr * 0.42;
    g = g * (1 - gr * 0.42) + 116 * gr * 0.42;
    b = b * (1 - gr * 0.42) + 108 * gr * 0.42;
    const d = Math.min(1, darkness[i]);
    r = r * (1 - d) + 44 * d;
    g = g * (1 - d) + 40 * d;
    b = b * (1 - d) + 36 * d;
    cimg.data[i * 4] = Math.max(0, Math.min(255, r));
    cimg.data[i * 4 + 1] = Math.max(0, Math.min(255, g));
    cimg.data[i * 4 + 2] = Math.max(0, Math.min(255, b));
    cimg.data[i * 4 + 3] = 255;
  }
  cg.putImageData(cimg, 0, 0);

  // Normal from the height field (Sobel, wrap in x)
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = width;
  normalCanvas.height = height;
  const ng = normalCanvas.getContext('2d')!;
  const nimg = ng.createImageData(width, height);
  const strength = 2.2;
  for (let y = 0; y < height; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xm = (x - 1 + width) % width;
      const xp = (x + 1) % width;
      const dx = (heightMap[y * width + xp] - heightMap[y * width + xm]) * strength;
      const dy = (heightMap[yp * width + x] - heightMap[ym * width + x]) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = y * width + x;
      nimg.data[i * 4] = ((-dx / len) * 0.5 + 0.5) * 255;
      nimg.data[i * 4 + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      nimg.data[i * 4 + 2] = (1 / len) * 0.5 * 255 + 127;
      nimg.data[i * 4 + 3] = 255;
    }
  }
  ng.putImageData(nimg, 0, 0);

  // Roughness
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rg = roughCanvas.getContext('2d')!;
  const rimg = rg.createImageData(width, height);
  for (let i = 0; i < N; i++) {
    const v = Math.max(0, Math.min(1, rough[i])) * 255;
    rimg.data[i * 4] = v;
    rimg.data[i * 4 + 1] = v;
    rimg.data[i * 4 + 2] = v;
    rimg.data[i * 4 + 3] = 255;
  }
  rg.putImageData(rimg, 0, 0);

  const make = (canvas: HTMLCanvasElement, name: string, srgb: boolean) => {
    const tex = new CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.name = name;
    return tex;
  };
  return {
    color: make(colorCanvas, 'procedural:whitebark/color', true),
    normal: make(normalCanvas, 'procedural:whitebark/normal', false),
    roughness: make(roughCanvas, 'procedural:whitebark/roughness', false),
  };
}
