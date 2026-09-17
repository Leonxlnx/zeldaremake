/**
 * Round 41 (structures-26): close-scale WOOD DETAIL shared by the signpost and the fences — the
 * owner wants a post to hold at 2 m, not read as a smooth textured cylinder.
 *
 *  - `woodGrain`: long grain round a post — a ridged field that runs ALONG the wood and wanders
 *    slowly, sampled round a circle so it is periodic in the angle (no seam). Posts and rails
 *    displace ± a few mm on it and darken the grain lines in the vertex colour.
 *  - `checkedCap`: an end-grain disc for a sawn / split post top or a rail end — slightly domed,
 *    with 2–4 radial CHECKS (drying cracks) cut 6–14 mm deep from near the rim toward the pith,
 *    growth rings in the tint and the checks' shading carried out to the rim. Its rim coincides
 *    with the tube's last ring when the tube's displacement fades to zero at t = 1 and the cap is
 *    built on the same Frenet frame (`endFrame`).
 *  - `footMoss`: cushion tufts (mossTufts.ts) round a post's foot on the terrain — damp wood
 *    grows moss where it meets the ground.
 */
import { type Curve, Vector3, type BufferGeometry } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { faceTowards, gridSurface, TAU } from './geometry';
import type { MossTuftSpec } from './mossTufts';

type RGB = [number, number, number];

/**
 * Long grain, 0..1 (1 = a ridge). `along` in metres along the wood, `angle` round it (rad),
 * `lines` ≈ how many grain lines run round the circumference, `wander` how fast the lines drift
 * along the wood (1 = one noise period per metre).
 */
export function woodGrain(noise: Noise2D, along: number, angle: number, lines: number, wander: number, seed = 0): number {
  const s = lines / TAU;
  return noise.ridged(Math.cos(angle) * s + seed, Math.sin(angle) * s + along * wander + seed * 0.37, 2);
}

/** A fine second octave of grain — the fibre between the lines, for tints at 1–2 m. */
export function woodFibre(noise: Noise2D, along: number, angle: number, lines: number, seed = 0): number {
  const s = lines / TAU;
  return 0.5 + 0.5 * noise.noise(Math.cos(angle) * s + seed * 1.9, Math.sin(angle) * s + along * 4.5 + seed);
}

export interface EndFrame {
  point: Vector3;
  /** unit tangent (out of the end) */
  T: Vector3;
  N: Vector3;
  B: Vector3;
}

/** The Frenet frame at a sweep's end, as sweepTube computes it (`computeFrenetFrames(ts, false)`). */
export function endFrame(curve: Curve<Vector3>, tubularSegments: number, atStart = false): EndFrame {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const i = atStart ? 0 : tubularSegments;
  const point = curve.getPointAt(atStart ? 0 : 1);
  const T = frames.tangents[i].clone();
  if (atStart) T.negate();
  return { point, T, N: frames.normals[i].clone(), B: frames.binormals[i].clone() };
}

export interface CheckedCapOptions {
  /** the tube's radius at the end (m) — the cap's rim */
  radius: number;
  /** the tube's radial segments (the cap shares the ring's vertices) */
  segments: number;
  /** base tint (the wood's end grain is a little darker than its side) */
  color: RGB;
  /** number of checks */
  checks?: number;
  /** check depth range (m) */
  depth?: [number, number];
  /** dome height at the pith (m); negative for a dished end */
  dome?: number;
  /** uv scale: metres per tile */
  uvMetres?: number;
  /** uv offset for the cap so it lands on the material's tile away from the wall's */
  uvOffset?: [number, number];
}

/**
 * The checked end-grain disc. `frame` is the tube's end frame; the disc's rim is exactly
 * `frame.point + (N cos a + B sin a) · radius`.
 */
export function checkedCap(frame: EndFrame, rng: Rng, noise: Noise2D, opts: CheckedCapOptions): BufferGeometry {
  const { radius: r, segments: segs, color } = opts;
  const checkCount = opts.checks ?? 2 + Math.floor(rng() * 3);
  const [d0, d1] = opts.depth ?? [0.006, 0.014];
  const dome = opts.dome ?? r * 0.06;
  const uvMetres = opts.uvMetres ?? 0.8;
  const [u0, v0] = opts.uvOffset ?? [0.5, 0.5];
  const seed = rng() * 100;
  const pith = new Vector3((rng() - 0.5) * 0.3 * r, (rng() - 0.5) * 0.3 * r, 0);
  // checks: angle, half-width at the rim (rad), depth, how far in they run (fraction of r)
  const checks: { a: number; w: number; d: number; reach: number }[] = [];
  for (let i = 0; i < checkCount; i++) {
    checks.push({
      a: rng() * TAU,
      w: 0.1 + rng() * 0.16,
      d: lerp(d0, d1, rng()),
      reach: i === 0 ? 1.05 : 0.35 + rng() * 0.5,
    });
  }
  const { point: c, T, N, B } = frame;
  const rows = 5;
  const _p = new Vector3();
  const geo = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      // the innermost row is a tiny ring (no pole fan), the outer row the tube's ring
      const f = lerp(0.03, 1, v);
      const rr = r * f;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // radial position, drifting toward the off-centre pith on the inner rows
      const px = ca * rr + pith.x * (1 - f);
      const py = sa * rr + pith.y * (1 - f);
      // height: dome, coarse end-grain roughness, the checks
      let h = dome * (1 - f * f);
      h += 0.0015 * noise.noise(px * 60 + seed, py * 60 - seed);
      let cut = 0;
      for (const k of checks) {
        let da = Math.atan2(Math.sin(a - k.a), Math.cos(a - k.a));
        // a check is a wedge: wide at the rim, closing toward the pith; its far end tapers
        const w = k.w * lerp(0.35, 1, f);
        const along = clamp((k.reach - f) / 0.15, 0, 1) * (k.reach > 1 ? 1 : smoothstep(0, 0.25, f));
        // small waver so the crack is not a straight radius
        da += 0.06 * noise.noise(f * 6 + k.a * 3, seed);
        const prof = Math.exp(-(da * da) / (w * w * 0.35));
        cut = Math.max(cut, k.d * prof * along);
      }
      // the rim stays sealed (it must meet the tube's ring); the cut fades over the last 8 %
      const rimSeal = 1 - smoothstep(0.9, 1, f);
      h -= cut * rimSeal;
      if (f >= 1 - 1e-6) h = 0;
      out.position.copy(c).addScaledVector(N, px).addScaledVector(B, py).addScaledVector(T, h);
      _p.set(px, py, 0);
      out.uv = [u0 + px / uvMetres, v0 + py / uvMetres];
      // growth rings round the pith + end-grain grain + the checks' shade (to the rim)
      const rp = Math.hypot(px - pith.x, py - pith.y);
      const rings = 0.9 + 0.12 * Math.sin(rp * (140 + 30 * Math.sin(seed)) + seed) + 0.05 * noise.noise(px * 25, py * 25 + seed);
      const shade = 1 - 0.55 * clamp(cut / d1, 0, 1);
      const g = rings * shade;
      out.color = [color[0] * g, color[1] * g, color[2] * g];
    },
    { cols: segs, rows, closedU: true },
  );
  return faceTowards(geo, (p, out) => out.copy(p).addScaledVector(T, 1));
}

export interface FootMossOptions {
  /** the post's radius at the ground (m) */
  postRadius: number;
  /** how many tufts to try */
  count: number;
  /** tuft footprint radius range (m) */
  size?: [number, number];
  /** the moss tint (linear, the caller's material scale) */
  color: RGB;
  /** uv metres per tile of the moss map */
  uvMetres?: number;
  /** a direction the moss favours (the damp / shaded side), unit xz; omit for all round */
  favour?: [number, number];
}

/** Cushion tufts on the terrain round a post's foot; positions exact on `ctx.terrain.height`. */
export function footMoss(ctx: WorldContext, foot: Vector3, rng: Rng, opts: FootMossOptions): MossTuftSpec[] {
  const specs: MossTuftSpec[] = [];
  const [s0, s1] = opts.size ?? [0.02, 0.045];
  const uvMetres = opts.uvMetres ?? 1.6;
  const n = new Vector3();
  for (let i = 0; i < opts.count; i++) {
    const a = rng() * TAU;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    if (opts.favour) {
      const toward = dx * opts.favour[0] + dz * opts.favour[1];
      if (rng() > 0.35 + 0.65 * Math.max(0, toward)) continue;
    }
    const rad = lerp(s0, s1, rng());
    const d = opts.postRadius - rad * 0.3 + rng() * 0.09;
    const x = foot.x + dx * d;
    const z = foot.z + dz * d;
    const y = ctx.terrain.height(x, z);
    ctx.terrain.normal(x, z, n);
    const gain = 0.85 + rng() * 0.3;
    specs.push({
      position: new Vector3(x, y, z),
      normal: n.clone(),
      rx: rad * (0.8 + rng() * 0.4),
      rz: rad * (0.8 + rng() * 0.4),
      h: rad * (0.55 + rng() * 0.4),
      yaw: rng() * TAU,
      color: [opts.color[0] * gain, opts.color[1] * gain, opts.color[2] * gain],
      uv: [x / uvMetres, z / uvMetres],
      sink: rad * 0.45,
      seed: 1 + Math.floor(rng() * 1e6),
    });
  }
  return specs;
}
