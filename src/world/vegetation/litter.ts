/**
 * Ground litter: instanced fallen leaves (curved laminae in autumn tints), twigs and small
 * surface roots. Heavier under the giant canopies and along the path verges, a light sprinkle
 * on the flagstones themselves. Every piece is seated on the exact terrain height.
 */
import { Color, Group, type BufferGeometry, type Material } from 'three';
import type { WorldContext } from '../system';
import { smoothstep } from '../util/noise';
import { createRng } from '../util/prng';
import { VegField, composeMatrix, newSample } from './field';
import { MeshBuilder, TAU, V, blend, lanceLeaf, rgb, sampleCurve, tone, tube, type RGB } from './geometry';
import { LodInstancedSet } from './lodset';

function leafGeometry(seed: string, shape: 'oval' | 'lance' | 'broad'): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const len = 0.09 + rng() * 0.04;
  const width = shape === 'oval' ? 0.62 : shape === 'lance' ? 0.34 : 0.85;
  const base: RGB = [0.92, 0.92, 0.92];
  // petiole
  const a = rng() * TAU;
  const dir = V(Math.cos(a), 0.02, Math.sin(a)).normalize();
  tube(m, [V(-dir.x * len * 0.18, 0.004, -dir.z * len * 0.18), V(0, 0.004, 0)], 0.0025, 0.0018, tone(base, 0.75), 3);
  lanceLeaf(m, V(0, 0.004, 0), dir, len, len * width, base, {
    sections: 3,
    curl: 0.28 + rng() * 0.3,
    twist: (rng() - 0.5) * 0.8,
    ridge: 0.22,
    serration: shape === 'broad' ? 0.08 : 0.03,
    tipColor: tone(base, 0.8),
  });
  return m.finish();
}

function twigGeometry(seed: string, long: boolean): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const len = long ? 0.3 + rng() * 0.3 : 0.14 + rng() * 0.14;
  const bend = (rng() - 0.5) * 0.3;
  const a = rng() * TAU;
  const dir = V(Math.cos(a), 0, Math.sin(a));
  const side = V(-dir.z, 0, dir.x);
  const curve = (t: number) =>
    dir
      .clone()
      .multiplyScalar((t - 0.5) * len)
      .addScaledVector(side, Math.sin(t * Math.PI) * bend * len)
      .add(V(0, 0.005 + Math.sin(t * Math.PI) * 0.01 * (long ? 1.6 : 1), 0));
  const col = blend(rgb(0x4d443a), rgb(0x8f8b80), rng() * 0.5);
  tube(m, sampleCurve(curve, long ? 4 : 3), 0.007 * (long ? 1.2 : 1), 0.003, col, 3, true);
  if (long) {
    const f = curve(0.65);
    const bd = side.clone().multiplyScalar(rng() > 0.5 ? 1 : -1).addScaledVector(dir, 0.6).normalize();
    tube(m, [f, f.clone().addScaledVector(bd, len * 0.28).add(V(0, 0.02, 0))], 0.004, 0.0015, col, 3, true);
  }
  return m.finish();
}

function rootGeometry(seed: string): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const len = 0.7 + rng() * 0.7;
  const rise = 0.05 + rng() * 0.08;
  const wob = (rng() - 0.5) * 0.25;
  // arc: starts below ground, rises, dives back in
  const curve = (t: number) => V((t - 0.5) * len, -0.05 + Math.sin(t * Math.PI) * (rise + 0.05), Math.sin(t * Math.PI * 2) * wob * len * 0.3);
  tube(m, sampleCurve(curve, 8), 0.018 + rng() * 0.02, 0.014, blend(rgb(0x4d443a), rgb(0x6b5a3e), rng() * 0.4), 5, true);
  return m.finish();
}

const LEAF_TINTS = [0xc9a94a, 0xd6b35a, 0xb8783a, 0x8a5a2b, 0x7d5530, 0x7f7d3c, 0x9a8a3e, 0x6f7a3a, 0xa8642e].map((h) => new Color(h));

export interface LitterResult {
  leaves: LodInstancedSet;
  twigs: LodInstancedSet;
  roots: LodInstancedSet;
  count: number;
  samples: number[][];
  all: LodInstancedSet[];
}

const M = new Float32Array(16);
/** mm-quantise so the audited sample position queries the terrain at exactly the seated point */
const mm = (v: number) => Math.round(v * 1000) / 1000;
const rec = (samples: number[][], x: number, y: number, z: number) => samples.push([x, Math.round(y * 10000) / 10000, z]);

export function buildLitter(ctx: WorldContext, field: VegField, material: Material, parent: Group): LitterResult {
  const T = ctx.terrain;
  const q = ctx.quality;
  const R = ctx.config.detailRadius;
  const seed = ctx.config.seed;
  const leafGeos = [leafGeometry(`${seed}/leaf/0`, 'oval'), leafGeometry(`${seed}/leaf/1`, 'lance'), leafGeometry(`${seed}/leaf/2`, 'broad'), leafGeometry(`${seed}/leaf/3`, 'oval')];
  const leaves = new LodInstancedSet({ name: 'litter-leaves', variants: leafGeos.map((g) => [g]), material, lodDistances: [], receiveShadow: true });
  const twigs = new LodInstancedSet({ name: 'litter-twigs', variants: [[twigGeometry(`${seed}/twig/0`, false)], [twigGeometry(`${seed}/twig/1`, true)], [twigGeometry(`${seed}/twig/2`, false)]], material, lodDistances: [], receiveShadow: true });
  const roots = new LodInstancedSet({ name: 'litter-roots', variants: [[rootGeometry(`${seed}/root/0`)], [rootGeometry(`${seed}/root/1`)]], material, lodDistances: [], castShadowLods: 1, receiveShadow: true });

  const s = newSample();
  const tint = new Color();
  const samples: number[][] = [];
  let count = 0;

  // leaves
  {
    const rng = ctx.rng.fork('litter/leaves');
    const candidates = Math.round(80000 * q.density);
    for (let i = 0; i < candidates; i++) {
      const x = mm((rng() * 2 - 1) * R);
      const z = mm((rng() * 2 - 1) * R);
      if (Math.hypot(x, z) > R) continue;
      field.sample(x, z, s);
      if (s.stairs > 0.05 || s.structure > 0.05 || s.cliff > 0.6) continue;
      const onPath = s.path > 0.5;
      const exact = ctx.terrain.mask(x, z);
      if (exact.stairs >= 0.5 || exact.structure >= 0.5) continue;
      if (field.insideGiantTrunk(x, z)) continue;
      const gd = field.giantDistance(x, z);
      const edge = field.edgeDistance(x, z);
      let p = 0.11 * field.falloff(x, z);
      p *= 1 + 2.8 * (1 - smoothstep(0, 11, gd));
      p *= 1 + 1.4 * (1 - smoothstep(-0.5, 3, edge));
      p *= 0.55 + 0.9 * field.cluster(x, z);
      // the trodden strip between Saria's stepping stones shows dirt and leaf litter through
      // its thin grass (frames 14 / 24; the branch already counts as a verge above)
      p *= 1 + 1.5 * field.troddenZone(x, z);
      if (onPath) p *= 0.12;
      if (rng() > p) continue;
      const lift = onPath ? 0.035 : 0.004;
      const y = T.height(x, z) + lift;
      const scale = 0.7 + rng() * 0.7;
      composeMatrix(M, 0, x, y, z, s.nx + rng.gauss() * 0.08, s.ny, s.nz + rng.gauss() * 0.08, 1, rng() * TAU, scale, scale, scale);
      const c = LEAF_TINTS[rng.int(0, LEAF_TINTS.length)];
      tint.copy(c).multiplyScalar(0.8 + rng() * 0.4);
      leaves.add(M, rng.int(0, leafGeos.length), tint);
      count++;
      if (count % 23 === 0 && samples.length < 380) rec(samples, x, y, z);
    }
  }

  // twigs
  {
    const rng = ctx.rng.fork('litter/twigs');
    const candidates = Math.round(30000 * q.density);
    for (let i = 0; i < candidates; i++) {
      const x = mm((rng() * 2 - 1) * R);
      const z = mm((rng() * 2 - 1) * R);
      if (Math.hypot(x, z) > R) continue;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s)) continue;
      if (field.insideGiantTrunk(x, z)) continue;
      const gd = field.giantDistance(x, z);
      let p = 0.05 * field.falloff(x, z);
      p *= 1 + 3 * (1 - smoothstep(0, 9, gd));
      p *= 1 + 1.2 * field.troddenZone(x, z);
      if (rng() > p) continue;
      const y = T.height(x, z) + 0.004;
      const scale = 0.8 + rng() * 0.6;
      composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 1, rng() * TAU, scale, scale, scale);
      twigs.add(M, rng.int(0, 3), tint.setRGB(0.85 + rng() * 0.3, 0.85 + rng() * 0.3, 0.85 + rng() * 0.3));
      count++;
      if (count % 37 === 0 && samples.length < 400) rec(samples, x, y, z);
    }
  }

  // surface roots radiating from giant trunks
  {
    const rng = ctx.rng.fork('litter/roots');
    for (const g of ctx.layout.giantTrees) {
      if (Math.hypot(g.position[0], g.position[2]) > R) continue;
      const n = Math.round((10 + rng.int(0, 6)) * q.density);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const d = g.trunkRadius + 0.9 + rng() * 3;
        const x = mm(g.position[0] + Math.cos(a) * d);
        const z = mm(g.position[2] + Math.sin(a) * d);
        field.sample(x, z, s);
        if (!field.allowed(x, z, s)) continue;
        if (field.edgeDistance(x, z) < 0.6) continue;
        const y = T.height(x, z);
        const scale = 0.7 + rng() * 0.6;
        // yaw so the root runs radially away from the trunk
        composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 1, -a + (rng() - 0.5) * 0.4, scale, scale, scale);
        roots.add(M, rng.int(0, 2), tint.setRGB(0.9 + rng() * 0.2, 0.9 + rng() * 0.2, 0.9 + rng() * 0.2));
        count++;
        if (samples.length < 400 && i % 3 === 0) rec(samples, x, y, z);
      }
    }
  }

  const all = [leaves, twigs, roots];
  for (const set of all) parent.add(set.build());
  return { leaves, twigs, roots, count, samples, all };
}
