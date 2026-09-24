/**
 * Bedded relief for a cliff face given as a height-parametrised surface (the ruins' west cliff,
 * terrain/ruins.ts `cliffSurface`): a stack of beds of varying thickness, each set proud or
 * recessed of the face line, leaning back a little toward its parting, the partings dipping
 * slowly along the run and ragged at arm's length. Pure — the same (z, y) always gives the same
 * bed — so the mesh, the walker's reach and any later dressing agree.
 *
 * Why beds and not noise: a face whose relief is smooth noise at 20–40 cm averages to one grey
 * plane at 10 m (the ruins' fall pose, σ 0.03). Beds put steps in the profile, and steps put
 * lines of light and shadow across the face at every distance — the read a limestone cliff has.
 */
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';

const warpN = new Noise2D('cliff-beds-warp');
const ragN = new Noise2D('cliff-beds-rag');

export interface CliffBedOpts {
  /** the beds' thickness range (m); default 0.55–1.6 */
  thick?: [number, number];
  /** how far a bed can stand proud of (or recess from) the face line (m); default 0.22 */
  out?: number;
  /** the in-bed lean: the face steps back this much from a bed's foot to its top (m); default 0.08 */
  lean?: number;
  /** the partings' slow dip along z (m) and their raggedness (m); default 0.45 / 0.05 */
  warp?: number;
  rag?: number;
  /** the height the bed sequence is anchored at */
  y0?: number;
  seed?: number;
}

export interface CliffBed {
  /** the face's offset from its line here (m, + is out) */
  out: number;
  /** 0 → 1 within 12 cm of a parting */
  edge: number;
  /** the top of a bed that stands proud of the one above it (a shelf that holds moss), 0–1 */
  shelf: number;
  /** the foot of a bed recessed under a prouder one above (the dark under-edge), 0–1 */
  soffit: number;
  /** a per-bed tone draw in [−1, 1] (paler and darker beds) */
  tone: number;
  /** 0 at the bed's foot, 1 at its top */
  t: number;
  /** the bed's thickness (m) */
  thick: number;
  index: number;
}

/** a small integer hash to [0, 1) — the bed sequence needs no stream, only a stable draw per bed */
function draw(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function cliffBed(z: number, y: number, o: CliffBedOpts = {}): CliffBed {
  const [t0, t1] = o.thick ?? [0.55, 1.6];
  const out = o.out ?? 0.22;
  const lean = o.lean ?? 0.08;
  const warp = o.warp ?? 0.45;
  const rag = o.rag ?? 0.05;
  const seed = (o.seed ?? 0) * 7919;
  const thickOf = (i: number) => lerp(t0, t1, draw(i, seed + 1));
  // the partings: one slow dip along the run, a ragged edge at arm's length
  const yy = y - (o.y0 ?? 0) + warp * warpN.noise(z * 0.16, 0.7) + rag * ragN.noise(z * 1.4, y * 0.3);
  // walk the sequence from the anchor to the bed holding yy
  let base = 0;
  let i = 0;
  if (yy >= 0) {
    for (;;) {
      const th = thickOf(i);
      if (yy < base + th) break;
      base += th;
      i++;
    }
  } else {
    while (yy < base) {
      i--;
      base -= thickOf(i);
    }
  }
  const thick = thickOf(i);
  const t = clamp((yy - base) / thick, 0, 1);
  // thick beds are the hard ones and stand proud; thin ones weather back; a draw on top
  const proudOf = (k: number) => out * (1.1 * ((thickOf(k) - (t0 + t1) / 2) / (t1 - t0)) + 0.7 * (draw(k, seed + 2) - 0.5));
  const proud = proudOf(i);
  const above = proudOf(i + 1);
  const below = proudOf(i - 1);
  // in the bed: a lean back toward the top and a rounded top arris
  const face = proud + lean * (0.5 - t) - 0.5 * lean * smoothstep(0.82, 1, t);
  const edge = 1 - smoothstep(0, 0.12, Math.min(t, 1 - t) * thick);
  const shelf = clamp((proud - above) / out, 0, 1) * (1 - smoothstep(0, 0.16, (1 - t) * thick));
  // the dark under-edge: the top of a bed recessed under a prouder one (the parting's shade)
  const soffit = clamp((above - proud) / out, 0, 1) * (1 - smoothstep(0, 0.22, (1 - t) * thick));
  // the foot of a bed standing on a prouder one below is a shelf's back: a little shade too
  const foot = clamp((below - proud) / out, 0, 1) * (1 - smoothstep(0, 0.1, t * thick)) * 0.5;
  const tone = draw(i, seed + 3) * 2 - 1;
  return { out: face, edge, shelf, soffit: clamp(soffit + foot, 0, 1), tone, t, thick, index: i };
}
