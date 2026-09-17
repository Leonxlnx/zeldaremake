/**
 * Round 43 (structures-27): END GRAIN for the hollow log's broken rims — annual rings across the
 * wall (v = 0 the bark side, v = 1 the heartwood side), each an earlywood band and a thin dark
 * latewood line, wobbling along the rim (u), with faint rays, radial drying checks and the
 * coarse tear of a broken end. The old rim wore the willow bark map stretched over the annulus.
 * Pure fields (no canvas / three): materials.ts rasterises the arrays into the `endGrain`
 * material's albedo / normal maps, podSkin.test.mjs checks them. The albedo integrates to
 * END_GRAIN_MEAN, the willow map's own linear mean, so the rim's level in shot D holds.
 */
import { Noise2D, clamp, smoothstep } from '../util/noise';

/** the albedo's linear mean (= the bark_willow_02 colour map it replaces: sRGB (131, 118, 104)) */
export const END_GRAIN_MEAN = 0.18;
/** annual rings across the wall */
export const END_GRAIN_RINGS = 14;
const NORMAL_GAIN = 2.2;

export interface EndGrainRaster {
  width: number;
  height: number;
  albedo: Float32Array;
  normal: Float32Array;
}

export function rasteriseEndGrain(seed: string | number, width = 512, height = 256): EndGrainRaster {
  const W = width;
  const H = height;
  const noise = new Noise2D(`${seed}/end-grain`);
  // ring boundaries: uneven widths (0.55–1.45 of the mean), from the noise so the layout is seeded
  const bounds: number[] = [0];
  for (let i = 0; i < END_GRAIN_RINGS; i++) bounds.push(bounds[i] + 1 + 0.45 * noise.noise(i * 1.7 + 0.3, 2.5));
  const total = bounds[END_GRAIN_RINGS];
  for (let i = 0; i <= END_GRAIN_RINGS; i++) bounds[i] /= total;
  // checks: radial cracks across the wall, 5 per tile, tapering toward the heartwood
  const checks: { u: number; w: number; reach: number; wander: number }[] = [];
  for (let i = 0; i < 5; i++) checks.push({ u: (i + 0.5 + 0.6 * noise.noise(i * 3.1, 7.7)) / 5, w: 0.006 + 0.005 * Math.abs(noise.noise(i * 2.2, 9.1)), reach: 0.45 + 0.5 * Math.abs(noise.noise(i * 1.3, 4.4)), wander: noise.noise(i * 5.1, 1.1) });
  const relief = new Float32Array(W * H);
  const albedo = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const i = y * W + x;
      // the rings wobble along the rim and carry a fine waver
      const vw = v + 0.018 * noise.noise(u * 4 + 1, v * 2) + 0.004 * noise.noise(u * 30, v * 30 + 5);
      // find the ring: position within it, 0 at its bark side, 1 at its heartwood side
      let k = 0;
      while (k < END_GRAIN_RINGS - 1 && vw > bounds[k + 1]) k++;
      const f = clamp((vw - bounds[k]) / Math.max(1e-4, bounds[k + 1] - bounds[k]), 0, 1);
      // earlywood pale, darkening into the thin latewood line at the ring's heartwood side
      const late = smoothstep(0.7, 0.96, f) * (1 - smoothstep(0.985, 1, f));
      const early = 1 - 0.25 * smoothstep(0.3, 0.75, f);
      // rays: faint radial streaks (along v) and the grain's mottle
      const rays = 0.5 + 0.5 * noise.noise(u * 90, v * 3 + 13);
      const mottle = noise.noise(u * 18 + 3, v * 24 + 1);
      // checks
      let cut = 0;
      for (const c of checks) {
        let du = u - c.u - 0.02 * c.wander * v;
        du -= Math.round(du);
        const w = c.w * (0.5 + 0.5 * (1 - v));
        const along = smoothstep(c.reach, c.reach - 0.12, v);
        cut = Math.max(cut, Math.exp(-(du * du) / (w * w)) * along);
      }
      // a broken end's coarse tear: low-frequency shade
      const tear = 0.5 + 0.5 * noise.fbm(u * 6, v * 5 + 2, 2);
      let shade = early * (1 - 0.5 * late) * (0.9 + 0.1 * rays) * (1 + 0.08 * mottle) * (0.85 + 0.3 * tear);
      shade *= 1 - 0.7 * cut;
      // heartwood side a shade darker and redder than the sapwood at the bark
      const heart = smoothstep(0.55, 1, v);
      relief[i] = -0.4 * late - 1.0 * cut + 0.12 * mottle + 0.1 * (tear - 0.5) - 0.06 * rays;
      albedo[i * 3] = shade * (1 + 0.05 * heart);
      albedo[i * 3 + 1] = shade * (0.86 - 0.04 * heart);
      albedo[i * 3 + 2] = shade * (0.7 - 0.08 * heart);
    }
  }
  let sum = 0;
  for (let i = 0; i < albedo.length; i++) sum += albedo[i];
  const scale = END_GRAIN_MEAN / (sum / albedo.length);
  for (let i = 0; i < albedo.length; i++) albedo[i] = Math.min(1, albedo[i] * scale);
  const normal = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 1) * W;
    const y1 = Math.min(H - 1, y + 1) * W;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = (relief[y * W + ((x + 1) % W)] - relief[y * W + ((x + W - 1) % W)]) * NORMAL_GAIN;
      const dy = (relief[y1 + x] - relief[y0 + x]) * NORMAL_GAIN;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      normal[i * 3] = -dx * inv;
      normal[i * 3 + 1] = dy * inv;
      normal[i * 3 + 2] = inv;
    }
  }
  return { width: W, height: H, albedo, normal };
}
