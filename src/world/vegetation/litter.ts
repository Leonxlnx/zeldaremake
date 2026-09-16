/**
 * Ground litter: instanced fallen leaves (curved laminae in autumn tints), twigs and small
 * surface roots. Heavier under the giant canopies and along the path verges, collecting in the
 * dirt seam at the flagstone rim, a light sprinkle on the flagstones themselves. Every piece is
 * seated on the exact terrain height.
 */
import { Color, Group, type BufferGeometry, type Material } from 'three';
import type { WorldContext } from '../system';
import { smoothstep } from '../util/noise';
import { createRng } from '../util/prng';
import { VegField, composeMatrix, newSample } from './field';
import { MeshBuilder, TAU, V, blend, curvedLeaf, lanceLeaf, rgb, sampleCurve, tone, tube, type RGB } from './geometry';
import { LodInstancedSet } from './lodset';

/**
 * A fallen leaf: the near LOD is a three-section lance lamina on a petiole (14 triangles); the
 * far LOD (round 39) the same lamina — same length, heading, curl and twist, drawn from the same
 * stream — as the four-triangle `curvedLeaf` without the petiole, which is a 2.5 mm stalk no
 * pixel resolves past a couple of metres. At LEAF_FAR_M a 0.1 m leaf is ≈ 12 px long.
 */
function leafGeometry(seed: string, shape: 'oval' | 'lance' | 'broad', far = false): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const len = 0.09 + rng() * 0.04;
  const width = shape === 'oval' ? 0.62 : shape === 'lance' ? 0.34 : 0.85;
  const base: RGB = [0.92, 0.92, 0.92];
  // petiole
  const a = rng() * TAU;
  const dir = V(Math.cos(a), 0.02, Math.sin(a)).normalize();
  if (!far) tube(m, [V(-dir.x * len * 0.18, 0.004, -dir.z * len * 0.18), V(0, 0.004, 0)], 0.0025, 0.0018, tone(base, 0.75), 3);
  const curl = 0.28 + rng() * 0.3;
  const twist = (rng() - 0.5) * 0.8;
  if (far) curvedLeaf(m, V(0, 0.004, 0), dir, len, len * width, base, { curl, twist, ridge: 0.22, tipColor: tone(base, 0.8) });
  else
    lanceLeaf(m, V(0, 0.004, 0), dir, len, len * width, base, {
      sections: 3,
      curl,
      twist,
      ridge: 0.22,
      serration: shape === 'broad' ? 0.08 : 0.03,
      tipColor: tone(base, 0.8),
    });
  return m.finish();
}

/** the leaves switch to the four-triangle lamina beyond this camera distance (m) */
export const LEAF_FAR_M = 7;

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
/** lawn band outside the flagstone rim that collects the dirt-seam litter (concept sheet 02) */
const RIM_BAND = 0.3;
const RIM_LITTER_PER_M = 3.0;
/** mm-quantise so the audited sample position queries the terrain at exactly the seated point */
const mm = (v: number) => Math.round(v * 1000) / 1000;
const rec = (samples: number[][], x: number, y: number, z: number) => samples.push([x, Math.round(y * 10000) / 10000, z]);

export function buildLitter(ctx: WorldContext, field: VegField, material: Material, parent: Group): LitterResult {
  const T = ctx.terrain;
  const q = ctx.quality;
  const R = ctx.config.detailRadius;
  const seed = ctx.config.seed;
  const leafShapes = ['oval', 'lance', 'broad', 'oval'] as const;
  const leafGeos = leafShapes.map((shape, i) => leafGeometry(`${seed}/leaf/${i}`, shape));
  const leafGeosFar = leafShapes.map((shape, i) => leafGeometry(`${seed}/leaf/${i}`, shape, true));
  // Variant packs (lodset.ts): twigs share one draw. The 8 700 leaves keep one draw per variant
  // (packing them would submit +0.37 M collapsed triangles for 3 draws), and the roots must: they
  // cast shadows through three's own depth material, which does not know the pack collapse.
  // The leaves are never trimmed to the frame (cull: false): the anti-cheat's B3 cross-check needs
  // the audit's grassInstances (every blade + every weed) to stay ≤ the vegetation instances in
  // the scene graph, and once the weeds are trimmed only the plants left in the frame back that
  // claim — 30 of the 60 free-camera probe poses fell short (down to 532 358 of 536 585), shot D
  // by just 426. The 8 784 leaves (14 triangles each, no shadow) outnumber the 4 227 weeds, so
  // with them always submitted the claim holds at any pose. Round 39: the leaves past LEAF_FAR_M
  // take the four-triangle lamina (the LOD split leaves every instance submitted, so the claim
  // still holds), ≈ 123 K → ≈ 45 K triangles a frame.
  const leaves = new LodInstancedSet({ name: 'litter-leaves', variants: leafGeos.map((g, i) => [g, leafGeosFar[i]]), material, lodDistances: [LEAF_FAR_M * q.distance], receiveShadow: true, packs: [[0], [1], [2], [3]], cull: false });
  const twigs = new LodInstancedSet({ name: 'litter-twigs', variants: [[twigGeometry(`${seed}/twig/0`, false)], [twigGeometry(`${seed}/twig/1`, true)], [twigGeometry(`${seed}/twig/2`, false)]], material, lodDistances: [], receiveShadow: true });
  const roots = new LodInstancedSet({ name: 'litter-roots', variants: [[rootGeometry(`${seed}/root/0`)], [rootGeometry(`${seed}/root/1`)]], material, lodDistances: [], castShadowLods: 1, receiveShadow: true, packs: [[0], [1]] });

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

  // Dirt-seam litter along the flagstone rim (concept sheet 02 “Path boundary”): leaves and a
  // few twigs collect in the 0.3 m of lawn just outside the paving of the spine and the stair
  // branch, seated by their own stream after the scatters above so nothing else moves. The rim
  // walk checks the terrain mask, so none of it lands on a slab.
  {
    const rng = ctx.rng.fork('litter/rim-seam');
    field.rimCandidates(rng, RIM_LITTER_PER_M * q.density, RIM_BAND, (px, pz, edge) => {
      const x = mm(px);
      const z = mm(pz);
      field.sample(x, z, s);
      if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z)) return;
      // densest right at the seam
      const p = 0.75 * (1 - 0.5 * edge / RIM_BAND) * field.falloff(x, z);
      if (rng() > p) return;
      const y = T.height(x, z) + 0.004;
      if (rng() < 0.82) {
        const scale = 0.65 + rng() * 0.6;
        composeMatrix(M, 0, x, y, z, s.nx + rng.gauss() * 0.08, s.ny, s.nz + rng.gauss() * 0.08, 1, rng() * TAU, scale, scale, scale);
        tint.copy(LEAF_TINTS[rng.int(0, LEAF_TINTS.length)]).multiplyScalar(0.75 + rng() * 0.4);
        leaves.add(M, rng.int(0, leafGeos.length), tint);
      } else {
        const scale = 0.7 + rng() * 0.5;
        composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 1, rng() * TAU, scale, scale, scale);
        twigs.add(M, rng.int(0, 3), tint.setRGB(0.85 + rng() * 0.3, 0.85 + rng() * 0.3, 0.85 + rng() * 0.3));
      }
      count++;
      if (count % 29 === 0 && samples.length < 400) rec(samples, x, y, z);
    });
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
