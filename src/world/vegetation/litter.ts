/**
 * Ground litter: instanced fallen leaves (curved laminae in autumn tints), twigs and small
 * surface roots. Heavier under the giant canopies and along the path verges, collecting in the
 * dirt seam at the flagstone rim, a light sprinkle on the flagstones themselves. Every piece is
 * seated on the exact terrain height.
 */
import { Color, Group, type BufferGeometry, type Material, type Vector3 } from 'three';
import type { WorldContext } from '../system';
import { smoothstep } from '../util/noise';
import { createRng, type Rng } from '../util/prng';
import { VegField, composeMatrix, newSample } from './field';
import { MeshBuilder, TAU, V, blend, foldedLeaf, lanceLeaf, lathe, rgb, sampleCurve, shapedLeaf, skeletonLeaf, tone, tube, type RGB } from './geometry';
import { LodInstancedSet } from './lodset';

type LeafDetail = 'ultra' | 'high' | 'far';

/**
 * Round 43 — the litter's near LOD: inside these camera distances (m, XZ) the leaves and twigs
 * draw their `ultra` geometry (leafGeometry / twigGeometry), built from the high LOD's own stream
 * so the swap keeps every leaf's heading, length, curl and twist and every twig's line. The
 * leaves are never trimmed to the frame (see `leaves` below), so every leaf inside the ring is
 * paid for at every fixed camera — 2.5 m holds 6–25 of them (99 at 4 m from camera A); a twig's
 * grain, knots and acorns are 2–8 mm features, so its ring is 2 m.
 */
export const LITTER_ULTRA_M = 2.5;
export const TWIG_ULTRA_M = 2;
/** share of the ultra leaves that have skeletonised (midrib and veins only) */
export const SKELETON_SHARE = 0.16;
/** the ultra lamina's baked root → tip gradient (× the instance's autumn tint): a browner, darker root, an ochre tip */
export const LEAF_ROOT_TINT: RGB = [0.74, 0.62, 0.5];
export const LEAF_TIP_TINT: RGB = [1.04, 0.98, 0.72];

/**
 * A fallen leaf: the near LOD is a three-section lance lamina on a petiole (14 triangles); the
 * far LOD (round 39) the same lamina — same length, heading, curl and twist, drawn from the same
 * stream — without the petiole, which is a 2.5 mm stalk no pixel resolves past a couple of
 * metres. At LEAF_FAR_M a 0.1 m leaf is ≈ 12 px long. Round 43: the far lamina is the
 * two-triangle `foldedLeaf` (the same diamond outline and fold as the four-triangle curved one,
 * without its centre-ridge vertex) — the 8 500 far leaves a fixed camera submits are 17 K
 * triangles cheaper, which pays for the near LOD inside LITTER_ULTRA_M.
 *
 * Round 43, `ultra` (inside LITTER_ULTRA_M): the same lance outline on the same petiole, as a
 * 7 × 5 lamina that curls up hard toward its tip (curlPow), cups at the margin, twists more and
 * ripples at the rim, under a baked brown → ochre root → tip gradient (LEAF_*_TINT) with a lighter
 * midrib column; SKELETON_SHARE of them are skeletons (skeletonLeaf). Everything past the layout
 * stream's draws is the forked `ultra` stream's. The material's litter block (materials.ts) adds
 * the dark veins. ≈ 72 triangles a leaf (a skeleton ≈ 30).
 */
function leafGeometry(seed: string, shape: 'oval' | 'lance' | 'broad', detail: LeafDetail = 'high'): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const far = detail === 'far';
  const len = 0.09 + rng() * 0.04;
  const width = shape === 'oval' ? 0.62 : shape === 'lance' ? 0.34 : 0.85;
  const base: RGB = [0.92, 0.92, 0.92];
  // petiole
  const a = rng() * TAU;
  const dir = V(Math.cos(a), 0.02, Math.sin(a)).normalize();
  const fine = detail === 'ultra' ? createRng(`${seed}/ultra`) : null;
  const petiole = [V(-dir.x * len * 0.18, 0.004, -dir.z * len * 0.18), V(0, 0.004, 0)];
  if (fine) tube(m, petiole, 0.0025, 0.0018, tone(base, 0.75), 4, false, (t, up) => tone(blend(LEAF_ROOT_TINT, base, 0.4 + 0.4 * t), 0.8 + 0.12 * up));
  else if (!far) tube(m, petiole, 0.0025, 0.0018, tone(base, 0.75), 3);
  const curl = 0.28 + rng() * 0.3;
  const twist = (rng() - 0.5) * 0.8;
  if (far) foldedLeaf(m, V(0, 0.004, 0), dir, len, len * width, base, { curl, twist, ridge: 0.22, tipColor: tone(base, 0.8) });
  else if (fine) {
    const serration = shape === 'broad' ? 0.08 : 0.03;
    if (fine() < SKELETON_SHARE) {
      skeletonLeaf(m, V(0, 0.004, 0), dir, len, len * width, tone(blend(LEAF_ROOT_TINT, base, 0.3), 0.85), { curl: curl * 1.1, twist, pairs: shape === 'lance' ? 5 : 6, tipColor: tone(base, 0.8) });
    } else {
      const ribLift = 1.05 + fine() * 0.05;
      const tipTint = blend(LEAF_TIP_TINT, [1, 1, 1], fine() * 0.3);
      shapedLeaf(m, V(0, 0.004, 0), dir, len, len * width, base, {
        shape: 'lance',
        sections: 7,
        across: 5,
        // the tip rolls up to where the high LOD's arch peaked (≈ curl × length), no higher
        curl: curl * (0.9 + fine() * 0.3),
        curlPow: 1.7 + fine() * 0.8,
        twist: twist * (1.4 + fine() * 0.8),
        cup: 0.22 + fine() * 0.35,
        ridge: 0.14,
        serration,
        wave: 0.04 + fine() * 0.06,
        tipColor: tone(base, 0.8),
        colorAt: (t, s) => {
          const g = blend(LEAF_ROOT_TINT, tipTint, Math.pow(t, 0.9));
          return tone(g, s === 0 ? ribLift : 1 - 0.08 * s * s);
        },
      });
    }
  } else
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

/** the twig ultra LOD's bark grain (round 43): facet ridge / groove contrast and the lengthwise banding gain */
export const TWIG_GRAIN = { ridge: 0.16, band: 0.1, sides: 6 };
/** the acorn and seed-pod tones (round 43): nut, cap, pod */
const ACORN_NUT = rgb(0x8a6a3c);
const ACORN_CAP = rgb(0x5a4a36);
const SEED_POD = rgb(0x7c6640);

/**
 * An acorn lying on its side (round 43): a lathe nut, its foot tucked under a scaly cap (a second
 * lathe whose facets alternate light and dark). ≈ 60 triangles.
 */
function acorn(m: MeshBuilder, at: Vector3, dir: Vector3, r: number, fine: Rng) {
  const nutLen = r * 3.2;
  lathe(m, at, dir, (u) => ({ r: r * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * u)), 0.55) * (1 - 0.35 * u * u), y: nutLen * u }), 4, 7, ACORN_NUT, (u) => tone(blend(ACORN_NUT, tone(ACORN_NUT, 1.25), Math.pow(1 - u, 2)), 0.9 + 0.2 * u * (1 - u)));
  const cap = at.clone().addScaledVector(dir, -r * 0.35);
  const capR = r * 1.1;
  lathe(m, cap, dir, (u) => ({ r: capR * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, u * 1.1))), y: nutLen * 0.42 * u }), 2, 7, ACORN_CAP, (u, facet) => tone(ACORN_CAP, (facet % 2 ? 0.86 : 1.1) * (0.9 + 0.2 * u) + 0.06 * fine()));
}

/**
 * A split seed pod (round 43): a four-lobed spindle, pointed both ends, lying beside the twig — the
 * sheet's "forest buds" gone dry. ≈ 30 triangles.
 */
function seedPod(m: MeshBuilder, at: Vector3, dir: Vector3, r: number) {
  lathe(m, at, dir, (u) => ({ r: r * Math.pow(Math.sin(Math.PI * u), 0.7), y: r * 4.2 * u }), 3, 4, SEED_POD, (u, facet) => tone(SEED_POD, (facet % 2 ? 0.88 : 1.08) * (0.85 + 0.3 * Math.sin(Math.PI * u))));
}

/**
 * A twig: a tapered, gently bowed tube (the long variant forks once). Round 43, `ultra` (inside
 * TWIG_ULTRA_M): the same line from the same stream, as a TWIG_GRAIN.sides-sided tube whose
 * facets alternate ridge and groove under a lengthwise banding (bark grain), a bud knot or two,
 * and — from the forked `ultra` stream — an acorn or a seed pod dropped beside it.
 */
function twigGeometry(seed: string, long: boolean, detail: 'ultra' | 'high' = 'high'): BufferGeometry {
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
  const forkSign = long ? (rng() > 0.5 ? 1 : -1) : 1;
  if (detail !== 'ultra') {
    tube(m, sampleCurve(curve, long ? 4 : 3), 0.007 * (long ? 1.2 : 1), 0.003, col, 3, true);
    if (long) {
      const f = curve(0.65);
      const bd = side.clone().multiplyScalar(forkSign).addScaledVector(dir, 0.6).normalize();
      tube(m, [f, f.clone().addScaledVector(bd, len * 0.28).add(V(0, 0.02, 0))], 0.004, 0.0015, col, 3, true);
    }
    return m.finish();
  }
  const fine = createRng(`${seed}/ultra`);
  const phase = fine() * TAU;
  const bandFreq = 18 + fine() * 14;
  const grain = (t: number, up: number, facet: number): RGB => {
    const ridge = 1 + TWIG_GRAIN.ridge * (facet % 2 ? -1 : 1);
    const band = 1 + TWIG_GRAIN.band * Math.sin(t * bandFreq + phase + facet * 0.7);
    // the underside sits in its own shadow
    return tone(col, ridge * band * (0.86 + 0.14 * up) * (0.92 + 0.12 * t));
  };
  tube(m, sampleCurve(curve, long ? 8 : 6), 0.007 * (long ? 1.2 : 1), 0.003, col, TWIG_GRAIN.sides, true, grain);
  if (long) {
    const f = curve(0.65);
    const bd = side.clone().multiplyScalar(forkSign).addScaledVector(dir, 0.6).normalize();
    tube(m, [f, f.clone().addScaledVector(bd, len * 0.14).add(V(0, 0.01, 0)), f.clone().addScaledVector(bd, len * 0.28).add(V(0, 0.02, 0))], 0.004, 0.0015, col, 5, true, grain);
  }
  // bud knots: short collars round the twig
  const knots = 1 + fine.int(0, 2);
  for (let k = 0; k < knots; k++) {
    const t = 0.15 + fine() * 0.7;
    const c = curve(t);
    const tangent = curve(Math.min(1, t + 0.02)).sub(curve(Math.max(0, t - 0.02))).normalize();
    const r = 0.007 * (long ? 1.2 : 1) * (1 - 0.55 * t) * 1.35;
    lathe(m, c.clone().addScaledVector(tangent, -r * 0.6), tangent, (u) => ({ r: r * Math.pow(Math.sin(Math.PI * u), 0.5), y: r * 1.2 * u }), 2, TWIG_GRAIN.sides, tone(col, 0.9), (u, facet) => tone(col, (facet % 2 ? 0.8 : 0.98) * (0.85 + 0.2 * Math.sin(Math.PI * u))));
  }
  // an acorn or a seed pod beside the twig (the long twig always has one of the two)
  const drop = fine();
  if (long || drop < 0.6) {
    const t = 0.25 + fine() * 0.5;
    const off = side.clone().multiplyScalar((fine() > 0.5 ? 1 : -1) * (0.012 + fine() * 0.012));
    const heading = V(Math.cos(a + fine() * TAU), 0.06, Math.sin(a + fine() * TAU)).normalize();
    if (drop < 0.55) {
      const r = 0.0034 + fine() * 0.0012;
      acorn(m, curve(t).add(off).setY(r), heading, r, fine);
    } else {
      const r = 0.0026 + fine() * 0.001;
      seedPod(m, curve(t).add(off).setY(r * 0.9), heading, r);
    }
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
/** round 40: the verge band beyond the seam where the litter thins into the lawn (m) */
const VERGE_BAND = 1.3;
const VERGE_LITTER_PER_M = 4.0;
const VERGE_BANK_PER_M2 = 3.0;
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
  const leafGeosFar = leafShapes.map((shape, i) => leafGeometry(`${seed}/leaf/${i}`, shape, 'far'));
  const leafGeosUltra = leafShapes.map((shape, i) => leafGeometry(`${seed}/leaf/${i}`, shape, 'ultra'));
  // Variant packs (lodset.ts): twigs share one draw. The 8 700 leaves keep one draw per variant
  // (packing them would submit +0.37 M collapsed triangles for 3 draws), and the roots must: they
  // cast shadows through three's own depth material, which does not know the pack collapse.
  // The leaves are never trimmed to the frame (cull: false): the anti-cheat's B3 cross-check needs
  // the audit's grassInstances (every blade + every weed) to stay ≤ the vegetation instances in
  // the scene graph, and once the weeds are trimmed only the plants left in the frame back that
  // claim — 30 of the 60 free-camera probe poses fell short (down to 532 358 of 536 585), shot D
  // by just 426. The 8 784 leaves (14 triangles each, no shadow) outnumber the 4 227 weeds, so
  // with them always submitted the claim holds at any pose. Round 39: the leaves past LEAF_FAR_M
  // take the far lamina (the LOD split leaves every instance submitted, so the claim still
  // holds), ≈ 123 K → ≈ 45 K triangles a frame; round 43 makes it the two-triangle fold, ≈ 28 K.
  // Round 43: the ultra LOD inside LITTER_ULTRA_M — every instance still submitted, so B3 holds —
  // packs all four variants into one draw: 6–25 leaves stand inside the ring at the fixed
  // cameras (≈ 290 collapsed triangles each), one draw against four per variant.
  const leaves = new LodInstancedSet({ name: 'litter-leaves', variants: leafGeos.map((g, i) => [leafGeosUltra[i], g, leafGeosFar[i]]), material, lodDistances: [LITTER_ULTRA_M * q.distance, LEAF_FAR_M * q.distance], nearLods: 1, receiveShadow: true, packs: [[[0, 1, 2, 3]], [[0], [1], [2], [3]], [[0], [1], [2], [3]]], cull: false });
  const twigKinds = [false, true, false];
  const twigs = new LodInstancedSet({ name: 'litter-twigs', variants: twigKinds.map((long, i) => [twigGeometry(`${seed}/twig/${i}`, long, 'ultra'), twigGeometry(`${seed}/twig/${i}`, long)]), material, lodDistances: [TWIG_ULTRA_M * q.distance], nearLods: 1, receiveShadow: true });
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

  // Round 40 — the verge band (the owner's video review: "fern/leaf-litter transitions at the
  // verge"): beyond the 0.3 m dirt seam the leaves keep collecting through the lawn's first
  // VERGE_BAND m, thinning with distance from the paving, so the turf-to-slab edge dissolves into
  // litter, ferns and broad leaves (plants.ts' verge pass) instead of stopping at a line. The same
  // drift gathers where the lawn meets the main flight's and the house flight's flank banks (the
  // feathered foot of each flank zone). Own streams after the scatters above; nothing on paving,
  // stepping stones or the trodden strip (frames 14 / 24: that strip has its own litter above).
  {
    const rng = ctx.rng.fork('litter/verge-r40');
    const bankRng = ctx.rng.fork('litter/verge-bank-r40');
    const drop = (x: number, z: number, w: number, r: Rng) => {
      field.sample(x, z, s);
      if (!field.allowed(x, z, s, true) || field.insideGiantTrunk(x, z) || s.cliff > 0.5) return;
      if (field.stoneDistance(x, z) < 0.3 || field.troddenZone(x, z, true) > 0.6) return;
      const p = w * (0.55 + 0.6 * field.cluster(x, z)) * field.falloff(x, z);
      if (r() > p) return;
      const y = T.height(x, z) + 0.004;
      if (r() < 0.9) {
        const scale = 0.65 + r() * 0.6;
        composeMatrix(M, 0, x, y, z, s.nx + r.gauss() * 0.08, s.ny, s.nz + r.gauss() * 0.08, 1, r() * TAU, scale, scale, scale);
        tint.copy(LEAF_TINTS[r.int(0, LEAF_TINTS.length)]).multiplyScalar(0.75 + r() * 0.4);
        leaves.add(M, r.int(0, leafGeos.length), tint);
      } else {
        const scale = 0.7 + r() * 0.5;
        composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 1, r() * TAU, scale, scale, scale);
        twigs.add(M, r.int(0, 3), tint.setRGB(0.85 + r() * 0.3, 0.85 + r() * 0.3, 0.85 + r() * 0.3));
      }
      count++;
      if (count % 31 === 0 && samples.length < 400) rec(samples, x, y, z);
    };
    field.rimCandidates(rng, VERGE_LITTER_PER_M * q.density, VERGE_BAND, (px, pz, edge) => {
      if (edge < RIM_BAND) return; // the seam above already holds this strip
      drop(mm(px), mm(pz), 0.5 * (1 - smoothstep(RIM_BAND, VERGE_BAND, edge)), rng);
    });
    const bankFoot = (box: readonly [number, number, number, number] | null, zone: (x: number, z: number) => number) => {
      if (!box) return;
      const n = Math.round((box[2] - box[0]) * (box[3] - box[1]) * VERGE_BANK_PER_M2 * q.density);
      for (let i = 0; i < n; i++) {
        const x = mm(box[0] + bankRng() * (box[2] - box[0]));
        const z = mm(box[1] + bankRng() * (box[3] - box[1]));
        const k = zone(x, z);
        const w = smoothstep(0.02, 0.2, k) * (1 - smoothstep(0.5, 0.85, k));
        if (w <= 0 || field.lawnEdgeDistance(x, z, true) < RIM_BAND) continue;
        drop(x, z, 0.45 * w, bankRng);
      }
    };
    bankFoot(field.flankBox(), (x, z) => field.flankZone(x, z));
    bankFoot(field.houseFlankBox(), (x, z) => field.houseFlankZone(x, z));
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
