/**
 * Procedural white-bark (birch) texture set drawn on a canvas at startup: pale papery bark with
 * faint vertical streaks, dark horizontal lenticel scars, grey peel patches and a few black
 * branch scars. Colour, normal and roughness maps come from the same seeded height field so they
 * agree with each other.
 *
 * One tile = one wrap unit around the trunk × WHITE_BARK_TILE_M along it (whitebark.ts rescales
 * the sweep's v so a tile spans that length): 512 × 2048 texels ≈ 1.9 mm × 1.2 mm on a mature
 * stem. Round 47 (survey-2 #31, `sn-whitebark-base`: "painted birch tiling, ~1 m vertical
 * repeat"): the tile grew from 1 m to 2.4 m along the stem and carries a second octave the 1 m
 * tile could not — 0.5–1.5 m tonal zones (chalk-white, pink-grey, ochre-grey), paper seams
 * where a sheet ends (a lifted edge, a shadow line under it, the warmer inner bark showing) and
 * dark lenticel bands where the scars run together into a rough fissured band. The painter is
 * pure (`paintWhiteBark`: typed arrays in, no DOM) so it can be inspected offline; the wrapper
 * turns the arrays into CanvasTextures.
 */
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D } from '../util/noise';

export interface BarkTextures {
  color: Texture;
  normal: Texture;
  roughness: Texture;
}

/** metres of trunk one tile spans along the stem (the sweep's v is divided by this) */
export const WHITE_BARK_TILE_M = 2.4;
export const WHITE_BARK_TEXTURE_SIZE: readonly [number, number] = [512, 2048];

export interface BarkPaint {
  width: number;
  height: number;
  /** RGBA sRGB */
  color: Uint8ClampedArray;
  /** RGBA tangent-space normal */
  normal: Uint8ClampedArray;
  /** RGBA (grey) roughness */
  roughness: Uint8ClampedArray;
}

/** the seeded height/colour fields of the bark tile as RGBA byte arrays (no DOM) */
export function paintWhiteBark(rng: Rng, width = WHITE_BARK_TEXTURE_SIZE[0], height = WHITE_BARK_TEXTURE_SIZE[1], tileM = WHITE_BARK_TILE_M): BarkPaint {
  const noise = new Noise2D(`${rng()}/bark`);
  const detail = new Noise2D(`${rng()}/bark-detail`);
  const zoneNoise = new Noise2D(`${rng()}/bark-zone`);
  const N = width * height;
  const heightMap = new Float32Array(N);
  const darkness = new Float32Array(N); // 0 = white bark, 1 = black scar
  const grey = new Float32Array(N); // grey peel patches
  const inner = new Float32Array(N); // exposed inner bark (warm) under a lifted paper edge
  const tint = new Float32Array(N); // −1 cool pink-grey … +1 warm ochre (the tonal zones)
  const rough = new Float32Array(N);
  /** texels per metre along the stem */
  const pxPerM = height / tileM;

  // Base: papery bark with soft vertical streaks (wrap-safe in u: sampled on a circle) and the
  // second octave — tonal zones 0.5–1.5 m tall that no 1 m tile could hold.
  for (let y = 0; y < height; y++) {
    const my = y / pxPerM;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const ang = (x / width) * Math.PI * 2;
      const cx = Math.cos(ang) * 1.5;
      const cz = Math.sin(ang) * 1.5;
      const streak = noise.fbm(cx * 2.2 + 3, my * 4.1 + cz * 0.3, 3) * 0.5 + 0.5;
      const fine = detail.noise(cx * 9 + cz * 9, my * 92) * 0.5 + 0.5;
      const grain = detail.noise(cx * 30, my * 614) * 0.5 + 0.5;
      heightMap[i] = 0.5 + (streak - 0.5) * 0.22 + (fine - 0.5) * 0.12 + (grain - 0.5) * 0.06;
      rough[i] = 0.62 + (fine - 0.5) * 0.18;
      darkness[i] = 0;
      inner[i] = 0;
      grey[i] = Math.max(0, (noise.fbm(cx * 0.9, my * 2.6 + cz * 0.4, 3) - 0.3) * 1.4); // sparse grey bands
      tint[i] = zoneNoise.fbm(cx * 0.45 + 7, my * 0.75, 2) * 1.6;
    }
  }

  /**
   * One mark. `edgePow` shapes the ends across the mark: 2–3 = a lens (tapered ends, a real
   * lenticel), 6 = blunt (the old dashes). A knot is a skewed, ragged-edged diamond with a raised
   * callus rim and a soft dark smear ("moustache") under it — the eye an old branch leaves.
   */
  const paint = (px: number, py: number, w: number, h: number, curve: number, d: number, feather: number, kind: 'scar' | 'peel' | 'knot', edgePow = 6, skew = 0) => {
    // a knot's callus rim and moustache reach past the scar itself
    const reachX = kind === 'knot' ? 1.9 : 1;
    const reachY = kind === 'knot' ? 1.6 : 1;
    const x0 = Math.floor(px - (w / 2) * reachX - 2);
    const x1 = Math.ceil(px + (w / 2) * reachX + 2);
    const y0 = Math.max(0, Math.floor(py - (h / 2) * reachY - feather - 2));
    const y1 = Math.min(height - 1, Math.ceil(py + (h / 2) * reachY + feather + 2));
    const knotSeed = px * 0.013 + py * 0.007;
    for (let y = y0; y <= y1; y++) {
      for (let xx = x0; xx <= x1; xx++) {
        const x = ((xx % width) + width) % width;
        const i = y * width + x;
        const v0 = (y - py) / (h / 2);
        // the skew slants the mark (a knot's eye leans with the branch that made it)
        const u = (xx - px) / (w / 2) - skew * v0; // -1..1 across the mark
        const yc = py + curve * (u * u - 0.5) * h; // slight arc
        const v = (y - yc) / (h / 2);
        let m: number;
        if (kind === 'knot') {
          // diamond/eye with a ragged, noisy margin; the lower half is broader than the upper
          const rag = 0.2 * detail.noise(xx * 0.09 + knotSeed, y * 0.09);
          const shape = Math.abs(u) * (v > 0 ? 0.8 : 1.05) + Math.abs(v) * 1.1;
          m = Math.max(0, Math.min(1, (1 - shape + rag) * 3));
          // callus rim: raised and a hair lighter, just outside the scar
          const rim = 1 - shape + rag;
          if (rim > -0.4 && rim <= 0.05) {
            const r = 1 - Math.abs(rim - 0.05) / 0.45;
            heightMap[i] += 0.13 * r;
            rough[i] = Math.min(1, rough[i] + 0.1 * r);
            grey[i] = Math.max(grey[i], 0.25 * r);
          }
          // moustache: a soft dark smear below and to the sides of the eye
          const mv = (y - (py + h * 0.42)) / (h * 0.22);
          const mu = (xx - px) / (w * 0.95);
          const smear = Math.max(0, 1 - mu * mu - mv * mv) * (0.55 + 0.45 * detail.noise(xx * 0.05, y * 0.05 + knotSeed));
          if (smear > 0) {
            darkness[i] = Math.max(darkness[i], 0.42 * smear * d);
            rough[i] = Math.min(1, rough[i] + 0.15 * smear);
          }
        } else {
          const edge = Math.max(0, 1 - Math.abs(u) ** edgePow);
          const vertical = Math.max(0, 1 - Math.abs(v) ** (kind === 'peel' ? 2 : 1.4));
          m = edge * vertical;
        }
        if (m <= 0) continue;
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
          darkness[i] = Math.max(darkness[i], d * soft * (0.85 + 0.15 * detail.noise(xx * 0.2, y * 0.2)));
          heightMap[i] -= 0.3 * soft;
          rough[i] = Math.min(1, rough[i] + 0.3 * soft);
        }
      }
    }
  };

  // Paper seams: where one papery sheet ends over the next. The ending sheet lifts toward its
  // free edge (a height ramp), the layer under it sits in a 2–3 texel shadow line, and the
  // freshly exposed inner bark under the edge is warmer — the strongest 3-D cue the survey's
  // painted tile lacked. Random spacing 3–20 cm, spans of a third to the whole wrap.
  const seams = Math.round(height / (pxPerM * 0.09));
  for (let s = 0; s < seams; s++) {
    const yEdge = rng() * height;
    const span = 0.3 + rng() * 0.7; // fraction of the wrap
    const xStart = rng() * width;
    const rag = 2 + rng() * 7; // texels of raggedness
    const ragFreq = 0.02 + rng() * 0.04;
    const slope = (rng() - 0.5) * 0.06;
    const lower = rng() < 0.6; // the free edge is the sheet's lower edge (the sheet is above)
    const lift = 0.05 + rng() * 0.05;
    const shadow = 0.28 + rng() * 0.22;
    const phase = rng() * 100;
    const spanPx = span * width;
    for (let k = 0; k < spanPx; k++) {
      const xx = Math.floor(xStart + k);
      const x = ((xx % width) + width) % width;
      // the span fades in and out at its ends so the seam does not start with a step
      const end = Math.min(1, Math.min(k, spanPx - k) / (0.12 * spanPx));
      const edgeY = yEdge + slope * k + detail.noise(x * ragFreq + phase, 0.37) * rag;
      for (let dy = -14; dy <= 14; dy++) {
        const y = Math.round(edgeY) + dy;
        if (y < 0 || y >= height) continue;
        const i = y * width + x;
        // signed distance from the edge, positive on the side the free edge peels away from
        const dist = lower ? edgeY - y : y - edgeY;
        if (dist >= 0) {
          // the sheet: lifted at its edge, decaying back to the bark 10 texels in
          heightMap[i] += lift * Math.exp(-dist / 5) * end;
          if (dist < 1.5) heightMap[i] += 0.03 * end; // the crisp edge itself
        } else {
          // under the edge: the shadow line and the warmer inner bark
          const under = -dist;
          darkness[i] = Math.max(darkness[i], shadow * Math.exp(-under / 2.2) * end);
          inner[i] = Math.max(inner[i], 0.7 * Math.exp(-under / 7) * end);
          heightMap[i] -= 0.04 * Math.exp(-under / 4) * end;
        }
      }
    }
  }

  // Lenticels in loose horizontal rows (every 3–7 cm; 3–8 scars a row, 4–28 % of the wrap long),
  // lens-shaped — tapered ends — with a few blunt older ones
  const rows = Math.round(height / (pxPerM * 0.045));
  for (let r = 0; r < rows; r++) {
    const rowY = ((r + rng()) / rows) * height;
    const count = 3 + Math.floor(rng() * 6);
    for (let k = 0; k < count; k++) {
      const px = rng() * width;
      const w = width * (0.04 + rng() * rng() * 0.24);
      const h = 3 + rng() * 6 + w * 0.02;
      paint(px, rowY + (rng() - 0.5) * 12, w, h, (rng() - 0.5) * 0.6, 0.55 + rng() * 0.45, 1.5, 'scar', 2.2 + rng() * 3);
    }
  }
  // A few thin faint marks
  for (let k = 0; k < 180; k++) {
    paint(rng() * width, rng() * height, width * (0.02 + rng() * 0.08), 1.5 + rng() * 2, (rng() - 0.5) * 0.3, 0.25 + rng() * 0.3, 1, 'scar', 2.5);
  }
  // Dark lenticel bands: 4–5 rows a tile where the scars run together into a rough, fissured,
  // near-black band 1.5–4 cm tall — a soft dark underlay with ragged margins (wrap-safe noise on
  // the circle) that thins out around part of the stem, with the scars themselves packed along
  // it and short cracks across — the classic dark rings of an older birch stem.
  const bands = 4 + Math.floor(rng() * 2);
  for (let b = 0; b < bands; b++) {
    const bandY = ((b + 0.2 + rng() * 0.6) / bands) * height;
    const bandH = pxPerM * (0.015 + rng() * 0.025);
    const bandD = 0.45 + rng() * 0.3;
    const phase = rng() * 50;
    const fill = 0.55 + rng() * 0.3;
    for (let x = 0; x < width; x++) {
      const ang = (x / width) * Math.PI * 2;
      const cx = Math.cos(ang) * 1.5;
      const cz = Math.sin(ang) * 1.5;
      const ragTop = detail.fbm(cx * 2.4 + phase, cz * 2.4, 2) * bandH * 0.5;
      const ragBot = detail.fbm(cx * 2.4 + phase + 9, cz * 2.4 + 9, 2) * bandH * 0.5;
      const yTop = bandY - bandH / 2 + ragTop;
      const yBot = bandY + bandH / 2 + ragBot;
      // the band thins out around part of the stem so it is not a machined ring
      const around = 0.5 + 0.5 * noise.noise(cx * 0.9 + phase, cz * 0.9);
      const strength = Math.max(0, Math.min(1, (around - (1 - fill)) / fill)) * bandD;
      if (strength <= 0.02) continue;
      for (let y = Math.floor(yTop); y <= Math.ceil(yBot); y++) {
        if (y < 0 || y >= height) continue;
        const i = y * width + x;
        const edge = Math.min(1, Math.min(y - yTop, yBot - y) / 3);
        if (edge <= 0) continue;
        // paper showing through the band, and cracks running across it
        const through = 0.6 + 0.4 * detail.noise(x * 0.11 + phase, y * 0.07);
        const crack = 1 - 0.55 * Math.max(0, Math.min(1, (0.62 - Math.abs(detail.noise(x * 0.35, y * 0.05 + phase))) * 8));
        const dd = strength * edge * through;
        darkness[i] = Math.max(darkness[i], dd);
        heightMap[i] -= 0.14 * dd + 0.12 * (1 - crack) * edge * strength;
        rough[i] = Math.min(1, rough[i] + 0.3 * dd);
      }
    }
    // the scars packed along the band
    const packed = 12 + Math.floor(rng() * 10);
    for (let k = 0; k < packed; k++) {
      const w = width * (0.05 + rng() * 0.13);
      paint(rng() * width, bandY + (rng() - 0.5) * bandH * 0.9, w, bandH * (0.35 + rng() * 0.5), (rng() - 0.5) * 0.4, 0.6 + rng() * 0.35, 1.5, 'scar', 2.2 + rng() * 2);
    }
  }
  // Grey peel patches (papery, a hair raised) — the large soft ones are the tile's tonal breakup
  for (let k = 0; k < 26; k++) {
    paint(rng() * width, rng() * height, width * (0.12 + rng() * 0.33), 18 + rng() * 60, (rng() - 0.5) * 0.4, 0.45 + rng() * 0.45, 4, 'peel');
  }
  for (let k = 0; k < 8; k++) {
    paint(rng() * width, rng() * height, width * (0.25 + rng() * 0.5), 120 + rng() * 260, (rng() - 0.5) * 0.3, 0.18 + rng() * 0.17, 12, 'peel');
  }
  // Black branch scars (knots): the eye-shaped callus under an old branch base — few, two sizes,
  // each leaning its own way
  for (let k = 0; k < 6; k++) {
    const big = k < 2;
    paint(rng() * width, rng() * height, big ? 36 + rng() * 30 : 18 + rng() * 22, big ? 70 + rng() * 70 : 34 + rng() * 40, 0, 0.7 + rng() * 0.2, 3, 'knot', 6, (rng() - 0.5) * 0.7);
  }

  // Colour
  const color = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const hgt = heightMap[i];
    // pale warm-grey paper; streak lightness from the height field
    let r = 228 + (hgt - 0.5) * 60;
    let g = 224 + (hgt - 0.5) * 58;
    let b = 214 + (hgt - 0.5) * 52;
    // the tonal zones: warm ochre-grey (+) against cool pink-grey (−), ± 6 % of the level —
    // the mid-frequency breakup that still reads at 5–10 m (round 48)
    const z = Math.max(-1, Math.min(1, tint[i]));
    const warm = Math.max(0, z);
    const cool = Math.max(0, -z);
    r *= 1 + 0.05 * warm - 0.035 * cool;
    g *= 1 + 0.015 * warm - 0.045 * cool;
    b *= 1 - 0.055 * warm - 0.02 * cool;
    // exposed inner bark under a lifted edge: warm tan
    const inn = Math.min(1, inner[i]) * 0.55;
    r = r * (1 - inn) + 196 * inn;
    g = g * (1 - inn) + 160 * inn;
    b = b * (1 - inn) + 124 * inn;
    const gr = Math.min(1, grey[i]);
    r = r * (1 - gr * 0.42) + 118 * gr * 0.42;
    g = g * (1 - gr * 0.42) + 116 * gr * 0.42;
    b = b * (1 - gr * 0.42) + 108 * gr * 0.42;
    const d = Math.min(1, darkness[i]);
    r = r * (1 - d) + 44 * d;
    g = g * (1 - d) + 40 * d;
    b = b * (1 - d) + 36 * d;
    color[i * 4] = Math.max(0, Math.min(255, r));
    color[i * 4 + 1] = Math.max(0, Math.min(255, g));
    color[i * 4 + 2] = Math.max(0, Math.min(255, b));
    color[i * 4 + 3] = 255;
  }

  // Normal from the height field (Sobel, wrap in x)
  const normal = new Uint8ClampedArray(N * 4);
  const strength = 2.4;
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
      normal[i * 4] = ((-dx / len) * 0.5 + 0.5) * 255;
      normal[i * 4 + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      normal[i * 4 + 2] = (1 / len) * 0.5 * 255 + 127;
      normal[i * 4 + 3] = 255;
    }
  }

  // Roughness: the paper matte, the exposed inner bark and the scars rougher, peels a hair smoother
  const roughness = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const v = Math.max(0, Math.min(1, rough[i] + 0.12 * Math.min(1, inner[i]) - 0.06 * Math.min(1, grey[i]))) * 255;
    roughness[i * 4] = v;
    roughness[i * 4 + 1] = v;
    roughness[i * 4 + 2] = v;
    roughness[i * 4 + 3] = 255;
  }
  return { width, height, color, normal, roughness };
}

export function createWhiteBarkTextures(rng: Rng, width = WHITE_BARK_TEXTURE_SIZE[0], height = WHITE_BARK_TEXTURE_SIZE[1]): BarkTextures {
  const painted = paintWhiteBark(rng, width, height);
  const make = (data: Uint8ClampedArray, name: string, srgb: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d')!;
    const img = g.createImageData(width, height);
    img.data.set(data);
    g.putImageData(img, 0, 0);
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
    color: make(painted.color, 'procedural:whitebark/color', true),
    normal: make(painted.normal, 'procedural:whitebark/normal', false),
    roughness: make(painted.roughness, 'procedural:whitebark/roughness', false),
  };
}
