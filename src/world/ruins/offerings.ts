/**
 * Round 57 (expansion-ruins): an offering at the arch — somebody still climbs up here. On the paving
 * between the stair head, the arch's north column and the ivy rock (layout `EXPANSION_RUINS.offering`):
 * a clay jar of wild flowers, a bowl of fruit and a little cairn of flat stones, set together.
 *
 * The clay, the fruit and the flowers are one builder (one draw, vertex colours); the cairn's stones
 * go into the boulders' builder (textured rock). One blocker: Link walks round it.
 */
import { Vector3 } from 'three';
import { EXPANSION_RUINS } from '../layout';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { MeshBuilder, block, lathe, type RGB } from './geom';
import type { Blocker } from './masonry';

const R = EXPANSION_RUINS;
const O = R.offering;
const FLOOR = R.terrace.y - 0.004;

/** a jar (outer wall, rolled lip, inner wall; [r, y] from the foot's centre) */
const JAR: [number, number][] = [
  [0, 0],
  [0.07, 0],
  [0.095, 0.015],
  [0.125, 0.08],
  [0.132, 0.15],
  [0.112, 0.22],
  [0.076, 0.26],
  [0.07, 0.28],
  [0.08, 0.298],
  [0.076, 0.308],
  [0.064, 0.3],
  [0.058, 0.27],
  [0.098, 0.2],
  [0.114, 0.12],
  [0.072, 0.032],
  [0, 0.024],
];
/** a low bowl */
const BOWL: [number, number][] = [
  [0, 0],
  [0.075, 0],
  [0.115, 0.018],
  [0.15, 0.062],
  [0.163, 0.108],
  [0.168, 0.128],
  [0.16, 0.136],
  [0.151, 0.124],
  [0.14, 0.08],
  [0.102, 0.036],
  [0, 0.026],
];
const CLAY: RGB = [0.33, 0.15, 0.075];
const CLAY_B: RGB = [0.285, 0.155, 0.085];
const STEM: RGB = [0.07, 0.14, 0.03];
const PETALS: RGB[] = [
  [0.6, 0.38, 0.06],
  [0.52, 0.16, 0.24],
  [0.6, 0.38, 0.06],
  [0.36, 0.26, 0.52],
  [0.52, 0.16, 0.24],
  [0.6, 0.38, 0.06],
];
const EYE: RGB = [0.22, 0.13, 0.03];
const FRUIT: RGB[] = [
  [0.45, 0.075, 0.03],
  [0.5, 0.12, 0.03],
  [0.3, 0.3, 0.05],
  [0.45, 0.075, 0.03],
];

const mottle = new Noise2D('ruins-offering');

export interface Offerings {
  builder: MeshBuilder;
  blockers: Blocker[];
  count: number;
}

/**
 * A pot at (x, z) from `profile` (its rows from `inner` on are the inside): wheel bands a shade
 * lighter / darker up the wall, mottled firing, grime at the foot, the inside in shade.
 */
function pot(mb: MeshBuilder, profile: [number, number][], inner: number, x: number, z: number, c: RGB, tilt: number): void {
  const segs = 28;
  const v0 = mb.vertexCount;
  const lean = new Vector3(Math.cos(tilt), 0, Math.sin(tilt));
  lathe(mb, profile, segs, (px, py, pz) => new Vector3(x + px + lean.x * py * 0.03, FLOOR + py, z + pz + lean.z * py * 0.03), c);
  for (let k = v0; k < mb.vertexCount; k++) {
    const inside = Math.floor((k - v0) / (segs + 1)) >= inner;
    const px = mb.pos[k * 3] - x;
    const py = mb.pos[k * 3 + 1] - FLOOR;
    const pz = mb.pos[k * 3 + 2] - z;
    const band = inside ? 1 : 1 + 0.045 * Math.sin(py * 140 + 1.3);
    const fire = 1 + 0.08 * mottle.fbm(Math.atan2(pz, px) * 1.6 + x * 7, py * 9 + z * 7, 2);
    const grime = lerp(0.72, 1, smoothstep(0.004, 0.06, py));
    const k1 = clamp(band * fire * grime * (inside ? 0.5 : 1), 0, 1.3);
    for (let j = 0; j < 3; j++) mb.col[k * 3 + j] *= k1;
  }
}

/** a flat ribbon along `pts`, half width `w`, facing `n` (double-sided material) */
function ribbon(mb: MeshBuilder, pts: Vector3[], n: Vector3, w: number, c: RGB): void {
  const start = mb.vertexCount;
  for (let i = 0; i < pts.length; i++) {
    const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
    const b = t.clone().cross(n).normalize().multiplyScalar(w * (1 - 0.4 * (i / (pts.length - 1))));
    mb.vertex(pts[i].clone().sub(b), n, c);
    mb.vertex(pts[i].clone().add(b), n, c);
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = start + i * 2;
    mb.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
}

/** a five-petalled head at `at` facing `f`, radius `r`, cupped a little */
function flower(mb: MeshBuilder, at: Vector3, f: Vector3, r: number, c: RGB): void {
  const n = f.clone().normalize();
  const u = Math.abs(n.y) < 0.9 ? new Vector3(0, 1, 0).cross(n).normalize() : new Vector3(1, 0, 0);
  const w = n.clone().cross(u);
  const centre = mb.vertex(at.clone().addScaledVector(n, 0.004), n, EYE);
  const rim: number[] = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = r * (0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.cos(5 * a), 0.6));
    const p = at.clone().addScaledVector(u, Math.cos(a) * rr).addScaledVector(w, Math.sin(a) * rr).addScaledVector(n, 0.22 * rr);
    rim.push(mb.vertex(p, n, c));
  }
  for (let i = 0; i < N; i++) mb.idx.push(centre, rim[i], rim[(i + 1) % N]);
}

export function buildOfferings(rng: Rng, stones: MeshBuilder): Offerings {
  const mb = new MeshBuilder();
  let count = 0;
  // the jar of flowers, the bowl of fruit beside it toward the stair
  const jar: [number, number] = [O.x - 0.1, O.z - 0.12];
  const bowl: [number, number] = [O.x + 0.24, O.z + 0.08];
  pot(mb, JAR, 10, jar[0], jar[1], CLAY, rng.range(0, Math.PI * 2));
  pot(mb, BOWL, 7, bowl[0], bowl[1], CLAY_B, rng.range(0, Math.PI * 2));
  count += 2;
  // wild flowers fanned out of the jar's mouth, each stem with a leaf or two
  for (let i = 0; i < PETALS.length; i++) {
    const a = (i / PETALS.length) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const lean = rng.range(0.18, 0.5);
    const h = rng.range(0.4, 0.56);
    const foot = new Vector3(jar[0] + Math.cos(a) * 0.02, FLOOR + 0.2, jar[1] + Math.sin(a) * 0.02);
    const pts: Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const out = lean * (h - 0.2) * t * t * 1.3;
      pts.push(new Vector3(foot.x + Math.cos(a) * out, foot.y + (h - 0.2) * t, foot.z + Math.sin(a) * out));
    }
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a));
    ribbon(mb, pts, side, 0.0028, STEM);
    for (const t of [rng.range(0.45, 0.6), rng.range(0.68, 0.8)]) {
      const k = Math.round(t * 8);
      const base = pts[k];
      const dir = new Vector3(Math.cos(a + rng.range(-1, 1)), rng.range(0.3, 0.8), Math.sin(a + rng.range(-1, 1))).normalize();
      ribbon(mb, [base, base.clone().addScaledVector(dir, 0.03), base.clone().addScaledVector(dir, 0.06)], dir.clone().cross(new Vector3(0, 1, 0)).normalize(), 0.009, STEM);
    }
    const tip = pts[8];
    const face = tip.clone().sub(pts[6]).normalize().add(new Vector3(Math.cos(a), 0.6, Math.sin(a)).multiplyScalar(0.6));
    flower(mb, tip, face, rng.range(0.028, 0.04), PETALS[i]);
    count++;
  }
  // fruit heaped in the bowl
  const heap: [number, number, number][] = [
    [-0.045, 0.04, 0.036],
    [0.04, 0.03, 0.034],
    [0.0, -0.05, 0.035],
    [0.005, 0.005, 0.032],
  ];
  heap.forEach(([dx, dz, r], i) => {
    const y0 = FLOOR + 0.026 + r + (i === 3 ? 0.045 : 0);
    const prof: [number, number][] = [];
    for (let k = 0; k <= 8; k++) {
      const p = -Math.PI / 2 + (Math.PI * k) / 8;
      prof.push([r * Math.cos(p), r * Math.sin(p)]);
    }
    lathe(mb, prof, 12, (px, py, pz) => new Vector3(bowl[0] + dx + px, y0 + py, bowl[1] + dz + pz), FRUIT[i]);
    count++;
  });
  // the cairn: four flat stones, each a little smaller and turned, the lowest one bedded and mossed
  let y = R.terrace.y - 0.012;
  const cairn: [number, number] = [O.x - 0.34, O.z + 0.2];
  for (let k = 0; k < 4; k++) {
    const s = 1 - k * 0.2;
    const hy = 0.034 - k * 0.003;
    const kk = rng.range(0.92, 1.06);
    block(stones, cairn[0] + rng.range(-0.015, 0.015), y + hy, cairn[1] + rng.range(-0.015, 0.015), 0.13 * s, hy, 0.1 * s, rng.range(0, Math.PI), {
      bevel: 0.02,
      color: [kk, kk * 0.985, kk * 0.95],
      skip: k === 0 ? ['-y'] : [],
      mossFn: (_p, n) => (k === 0 ? 0.35 : 0.05) * (n.y > 0.7 ? 1 : 0.6),
    });
    y += hy * 2 - 0.004;
    count++;
  }
  return { builder: mb, blockers: [{ x: O.x - 0.05, z: O.z + 0.02, r: 0.5, top: R.terrace.y + 0.55 }], count };
}
