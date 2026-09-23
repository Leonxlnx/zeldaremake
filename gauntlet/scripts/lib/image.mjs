/**
 * Image metrics shared by compare / anti-cheat / score.
 * Pure JS on top of sharp (decode + resize only) so results are identical on every machine.
 */
import sharp from 'sharp';

/** Greyscale float array (0..1) at w×h. */
export async function toGray(input, w, h) {
  const { data } = await sharp(input).resize(w, h, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = data[i] / 255;
  return out;
}

/** RGB uint8 buffer at w×h. */
export async function toRgb(input, w, h) {
  const { data } = await sharp(input).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

/** 64-bit perceptual hash (DCT of 32×32 grey → top-left 8×8 vs median). Returns 16-char hex. */
export async function phash(input) {
  const N = 32;
  const g = await toGray(input, N, N);
  const cosT = new Float64Array(N * N);
  for (let u = 0; u < N; u++) for (let x = 0; x < N; x++) cosT[u * N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
  const rows = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let x = 0; x < N; x++) s += g[y * N + x] * cosT[u * N + x];
    rows[y * N + u] = s;
  }
  const dct = new Float64Array(64);
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let y = 0; y < N; y++) s += rows[y * N + u] * cosT[v * N + y];
    dct[v * 8 + u] = s;
  }
  const vals = Array.from(dct.slice(1)); // skip DC
  const sorted = [...vals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let bits = '';
  for (let i = 0; i < 64; i++) bits += dct[i] > median ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hamming(hexA, hexB) {
  let d = 0;
  for (let i = 0; i < Math.min(hexA.length, hexB.length); i++) {
    let x = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Global SSIM on two equal-size grey arrays (8×8 windows, stride 4). */
export function ssim(a, b, w, h) {
  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;
  const win = 8;
  const stride = 4;
  let total = 0;
  let count = 0;
  for (let y = 0; y + win <= h; y += stride) {
    for (let x = 0; x + win <= w; x += stride) {
      let ma = 0;
      let mb = 0;
      for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) {
        ma += a[(y + j) * w + x + i];
        mb += b[(y + j) * w + x + i];
      }
      const n = win * win;
      ma /= n;
      mb /= n;
      let va = 0;
      let vb = 0;
      let cov = 0;
      for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) {
        const da = a[(y + j) * w + x + i] - ma;
        const db = b[(y + j) * w + x + i] - mb;
        va += da * da;
        vb += db * db;
        cov += da * db;
      }
      va /= n - 1;
      vb /= n - 1;
      cov /= n - 1;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  }
  return count ? total / count : 0;
}

/** Variance of the Laplacian — a sharpness proxy. */
export function laplacianVariance(g, w, h) {
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const l = -4 * g[i] + g[i - 1] + g[i + 1] + g[i - w] + g[i + w];
    sum += l;
    sum2 += l * l;
    n++;
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, l];
}

/** Mean hue (circular), saturation, luminance; fraction of near-white, sky-blue and purple pixels. */
export function colorStats(rgb, w, h, { maskSky = true } = {}) {
  let sx = 0;
  let sy = 0;
  let sat = 0;
  let lum = 0;
  let n = 0;
  let over = 0;
  let sky = 0;
  let purple = 0;
  const total = w * h;
  for (let i = 0; i < total; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const [hh, s, l] = rgbToHsl(r, g, b);
    if (r > 250 && g > 250 && b > 250) over++;
    const isSky = l > 0.6 && s < 0.35 && b >= g && b >= r && hh > 170 && hh < 260;
    if (isSky) sky++;
    if (hh > 255 && hh < 320 && s > 0.2 && l > 0.15 && l < 0.8) purple++;
    if (maskSky && isSky) continue;
    const a = (hh * Math.PI) / 180;
    sx += Math.cos(a) * s;
    sy += Math.sin(a) * s;
    sat += s;
    lum += l;
    n++;
  }
  const meanHue = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
  return {
    meanHue,
    meanSat: n ? sat / n : 0,
    meanLum: n ? lum / n : 0,
    overexposedFraction: over / total,
    skyFraction: sky / total,
    purpleFraction: purple / total,
  };
}

export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Fraction of pixels that differ by more than `tol` (0..255) in any channel. */
export function pixelDiffFraction(rgbA, rgbB, tol = 8) {
  let diff = 0;
  const n = Math.min(rgbA.length, rgbB.length) / 3;
  for (let i = 0; i < n; i++) {
    if (Math.abs(rgbA[i * 3] - rgbB[i * 3]) > tol || Math.abs(rgbA[i * 3 + 1] - rgbB[i * 3 + 1]) > tol || Math.abs(rgbA[i * 3 + 2] - rgbB[i * 3 + 2]) > tol) diff++;
  }
  return diff / n;
}

/** Native-resolution decode → { width, height, gray (Float32Array 0..1), rgb (Uint8Array) }. */
export async function decodeNative(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const gray = new Float32Array(width * height);
  const rgb = channels === 3 ? data : new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    if (channels !== 3) {
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
    }
    gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return { width, height, gray, rgb };
}

/**
 * Split two equal-size grey frames into grid×grid regions; a region "moves" when its mean
 * absolute difference exceeds `threshold` (0..1). Returns { moving, means, variance }.
 */
export function regionMotion(grayA, grayB, w, h, grid = 4, threshold = 1.5 / 255) {
  const means = [];
  const cw = Math.floor(w / grid);
  const ch = Math.floor(h / grid);
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let s = 0;
      let n = 0;
      for (let y = gy * ch; y < (gy + 1) * ch; y++) {
        const row = y * w;
        for (let x = gx * cw; x < (gx + 1) * cw; x++) {
          s += Math.abs(grayA[row + x] - grayB[row + x]);
          n++;
        }
      }
      means.push(n ? s / n : 0);
    }
  }
  const moving = means.filter((m) => m > threshold).length;
  const mean = means.reduce((a, b) => a + b, 0) / means.length;
  const variance = means.reduce((a, b) => a + (b - mean) ** 2, 0) / means.length;
  return { moving, means, variance, threshold };
}

/** Escape text for an SVG text node. */
export function svgEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
