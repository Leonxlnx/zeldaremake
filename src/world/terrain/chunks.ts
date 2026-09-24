/**
 * Terrain chunk layout + geometry. Three concentric rings, each on the global lattice of the
 * matching heightfield zone (0.2 m / 1 m / 4 m), so chunk edges line up and every vertex height is
 * the sampler's own lattice sample: the rendered surface IS `terrain.height()`. Where a fine ring
 * meets a coarser one, the lattice already snaps the fine edge samples onto the coarse edge
 * (no T-junction cracks, no skirts). Normals come from the sampler, so shading is seamless.
 */
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { Terrain, TerrainMask } from './heightfield';
import { LATTICE, isLatticeTerrain, terrainDetail, type TerrainDetail } from './heightfield';
import { ravineWallMoss } from './south';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import type { Layout } from '../layout';

export interface ChunkSpec {
  x0: number;
  z0: number;
  sx: number;
  sz: number;
  spacing: number;
  ring: 0 | 1 | 2;
  /** spacing of a coarser neighbour touching this edge (undefined = same or finer) */
  coarse: { left?: number; right?: number; near?: number; far?: number };
}

export const RING = {
  innerHalf: LATTICE.detail.half * LATTICE.detail.spacing,
  innerChunk: 24,
  innerSpacing: LATTICE.detail.spacing,
  midHalf: LATTICE.mid.half * LATTICE.mid.spacing,
  midChunk: 48,
  midSpacing: LATTICE.mid.spacing,
  outerSpacing: LATTICE.outer.spacing,
};

/**
 * Build the chunk list. The inner ring is always on the 0.2 m detail lattice (the sampler
 * contract), the mid ring on 1 m and the outer ring on 4 m — `RING` mirrors `LATTICE`.
 */
export function layoutChunks(half: number): ChunkSpec[] {
  const R = RING;
  const out: ChunkSpec[] = [];
  const innerSpacing = R.innerSpacing;
  const n0 = (R.innerHalf * 2) / R.innerChunk;
  for (let cz = 0; cz < n0; cz++) {
    for (let cx = 0; cx < n0; cx++) {
      const x0 = -R.innerHalf + cx * R.innerChunk;
      const z0 = -R.innerHalf + cz * R.innerChunk;
      out.push({
        x0,
        z0,
        sx: R.innerChunk,
        sz: R.innerChunk,
        spacing: innerSpacing,
        ring: 0,
        coarse: {
          left: cx === 0 ? R.midSpacing : undefined,
          right: cx === n0 - 1 ? R.midSpacing : undefined,
          near: cz === 0 ? R.midSpacing : undefined,
          far: cz === n0 - 1 ? R.midSpacing : undefined,
        },
      });
    }
  }
  const n1 = (R.midHalf * 2) / R.midChunk;
  for (let cz = 0; cz < n1; cz++) {
    for (let cx = 0; cx < n1; cx++) {
      const x0 = -R.midHalf + cx * R.midChunk;
      const z0 = -R.midHalf + cz * R.midChunk;
      if (x0 >= -R.innerHalf && x0 + R.midChunk <= R.innerHalf && z0 >= -R.innerHalf && z0 + R.midChunk <= R.innerHalf) continue;
      out.push({
        x0,
        z0,
        sx: R.midChunk,
        sz: R.midChunk,
        spacing: R.midSpacing,
        ring: 1,
        coarse: {
          left: cx === 0 ? R.outerSpacing : undefined,
          right: cx === n1 - 1 ? R.outerSpacing : undefined,
          near: cz === 0 ? R.outerSpacing : undefined,
          far: cz === n1 - 1 ? R.outerSpacing : undefined,
        },
      });
    }
  }
  const edges = [-half, -R.midHalf, R.midHalf, half];
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      if (i === 1 && j === 1) continue;
      out.push({ x0: edges[i], z0: edges[j], sx: edges[i + 1] - edges[i], sz: edges[j + 1] - edges[j], spacing: R.outerSpacing, ring: 2, coarse: {} });
    }
  }
  return out;
}

export interface WeightContext {
  terrain: Terrain;
  layout: Layout;
  noise: {
    litter: Noise2D;
    moss: Noise2D;
    soil: Noise2D;
    rock: Noise2D;
    macro: Noise2D;
    wet: Noise2D;
  };
}

export function createWeightContext(terrain: Terrain, layout: Layout, seed: string): WeightContext {
  return {
    terrain,
    layout,
    noise: {
      litter: new Noise2D(`${seed}/terrain-litter`),
      moss: new Noise2D(`${seed}/terrain-moss`),
      soil: new Noise2D(`${seed}/terrain-soil`),
      rock: new Noise2D(`${seed}/terrain-rock`),
      macro: new Noise2D(`${seed}/terrain-macro`),
      wet: new Noise2D(`${seed}/terrain-wet`),
    },
  };
}

/**
 * Round 43 — the near-field ground (terrain-4). `CURV_STEP` is the finite-difference step (m) of
 * the concavity the wet band reads (`curv` = h(x±e) + h(z±e) − 4h, positive in a dish); the
 * quantiles of that sum over the open ground at 0.6 m are p50 0.00, p90 0.22, p95 0.32, so
 * `WET_CURV` picks the top eighth or so of the dishes. `DISP_PATH_FADE` is the path-mask level
 * above which the vertex relief is off (the slabs are seated on `height()`; the relief must not
 * lift the joint fill against their rims).
 */
export const NEAR_GROUND = { CURV_STEP: 0.6, WET_CURV: [0.2, 0.5] as [number, number], DISP_PATH_FADE: [0.02, 0.4] as [number, number] };

/**
 * Layer weights for one vertex. Sequential "painting": each layer covers the previous ones with
 * alpha a, so the weights always sum to one and transitions stay crisp where they should be.
 * `curv` (see `NEAR_GROUND`) and `w2` are the round-43 near-ground channels: `w2` = (wet band,
 * vertex-relief allowance, giant-root proximity) — see material.ts for what each drives.
 */
export function layerWeights(
  wc: WeightContext,
  x: number,
  z: number,
  slope: number,
  m: TerrainMask | null,
  d: TerrainDetail | null,
  w0: Float32Array,
  w1: Float32Array,
  o: number,
  curv = 0,
  w2: Float32Array | null = null,
) {
  const N = wc.noise;
  let grass = 1;
  let soil = 0;
  let moss = 0;
  let litter = 0;
  let gravel = 0;
  let rock = 0;
  const cover = (a: number) => {
    a = clamp(a, 0, 1);
    grass *= 1 - a;
    soil *= 1 - a;
    moss *= 1 - a;
    litter *= 1 - a;
    gravel *= 1 - a;
    rock *= 1 - a;
    return a;
  };
  const path = m?.path ?? 0;
  const stairs = m?.stairs ?? 0;
  const cliff = m?.cliff ?? 0;
  const plateau = m?.plateau ?? 0;
  const structure = m?.structure ?? 0;
  const erosion = d?.erosion ?? 0;
  const terrace = d?.terrace ?? 0;
  const roots = d?.roots ?? 0;
  const damp = d?.damp ?? 0;
  const hollow = d?.hollow ?? 0;
  // the stair's south bank is turf: its steep face keeps grass ~12° longer before soil/rock show
  const bank = d?.bank ?? 0;
  const bankSlope = 0.22 * bank;

  // 1. leaf litter: patches + under the giant trees + in hollows
  let litterA = 0.8 * smoothstep(0.5, 0.82, N.litter.fbm(x * 0.13 + 9.1, z * 0.13 - 2.3, 3) * 0.5 + 0.5) + hollow * 0.45;
  for (const g of wc.layout.giantTrees) {
    const dd = Math.hypot(x - g.position[0], z - g.position[2]);
    if (dd < 5 * g.trunkRadius) litterA += 0.7 * smoothstep(5 * g.trunkRadius, 1.3 * g.trunkRadius, dd);
  }
  litter += cover(litterA * (1 - smoothstep(0.3, 0.55, slope)));

  // 2. moss: shaded damp ground, root zones, plateau tops (patchy)
  const mossN = N.moss.fbm(x * 0.17 - 4.2, z * 0.17 + 6.8, 3) * 0.5 + 0.5;
  const mossA = 0.85 * smoothstep(0.52, 0.78, mossN) + damp * 0.8 + roots * 0.5 + plateau * 0.3 * smoothstep(0.4, 0.7, mossN);
  moss += cover(mossA * (1 - smoothstep(0.35, 0.6, slope)));

  // 3. soil: slopes, erosion gullies, terrace risers, worn path verges, under structures/stairs
  const soilN = N.soil.fbm(x * 0.23 + 1.7, z * 0.23 - 8.4, 2) * 0.5 + 0.5;
  const soilA =
    0.9 * smoothstep(0.2 + bankSlope, 0.48 + bankSlope, slope) +
    erosion * 0.95 +
    terrace * 0.55 +
    roots * 0.35 +
    0.85 * smoothstep(0.02, 0.45, path) +
    stairs * 0.9 +
    structure * 0.75 +
    0.35 * smoothstep(0.62, 0.85, soilN);
  soil += cover(soilA);

  // 4. cliff rock: steep faces + terrace edges on steep ground
  const rockN = N.rock.fbm(x * 0.31, z * 0.31 + 3.3, 2) * 0.5 + 0.5;
  const rockA = smoothstep(0.4 + bankSlope, 0.72 + bankSlope, slope) * (0.65 + 0.35 * rockN) + cliff * 0.85 + terrace * smoothstep(0.3 + bankSlope, 0.5 + bankSlope, slope) * 0.6;
  rock += cover(rockA);
  // round 56: the south ravine's walls — moss hanging from the lip over the rock (south.ts)
  moss += cover(ravineWallMoss(x, z, slope));

  // 5. path gravel under/around the flagstones
  gravel += cover(smoothstep(0.3, 0.85, path));

  const macro = clamp(N.macro.fbm(x * 0.045 + 2.2, z * 0.045 - 1.1, 3) * 0.6 + 0.5 + 0.15 * N.macro.noise(x * 0.4, z * 0.4), 0, 1);

  w0[o] = grass;
  w0[o + 1] = soil;
  w0[o + 2] = moss;
  w0[o + 3] = litter;
  w1[o] = gravel;
  w1[o + 1] = rock;
  w1[o + 2] = damp;
  w1[o + 3] = macro;

  if (w2) {
    const open = (1 - path) * (1 - stairs) * (1 - structure);
    // wet band (frame 03's dark damp patches): the floor of the dishes — concave, near-flat
    // ground — plus the depressions and the embankment feet the detail passes already flag damp,
    // and a ring at the giants' feet where the roots channel the drip; a 2 m noise breaks the
    // bands into patches so no hollow is uniformly dark
    const conc = smoothstep(NEAR_GROUND.WET_CURV[0], NEAR_GROUND.WET_CURV[1], curv) * (1 - smoothstep(0.1, 0.3, slope));
    let drip = 0;
    for (const g of wc.layout.giantTrees) {
      const dd = Math.hypot(x - g.position[0], z - g.position[2]);
      if (dd < 3.2 * g.trunkRadius) drip = Math.max(drip, smoothstep(1.0 * g.trunkRadius, 1.5 * g.trunkRadius, dd) * (1 - smoothstep(2.2 * g.trunkRadius, 3.0 * g.trunkRadius, dd)));
    }
    const wetN = N.wet.fbm(x * 0.5 + 3.3, z * 0.5 - 7.1, 2) * 0.5 + 0.5;
    // round 44 (survey-1 #11): the damp dark band at the foot of a steep face — concave ground
    // (the slope flattening out) with a face over 0.32 of slope within 0.7 m of it; the wet
    // band's slope gate (< 0.3) is relaxed to 0.4 there. Four extra slope samples, taken only
    // where the concavity and slope make a foot possible (a few per cent of the fine vertices).
    let foot = 0;
    if (curv > 0.08 && slope < 0.42 && open > 0.05) {
      const T = wc.terrain;
      const e = 0.7;
      const steepNear = Math.max(T.slope(x + e, z), T.slope(x - e, z), T.slope(x, z + e), T.slope(x, z - e));
      foot = smoothstep(0.08, 0.28, curv) * smoothstep(0.32, 0.5, steepNear) * (1 - smoothstep(0.28, 0.42, slope));
    }
    const wet = clamp(Math.max(conc * 0.9, foot * 0.85, hollow * 0.6, damp * 0.5, drip * 0.5) * (0.4 + 1.0 * wetN), 0, 1) * open * (1 - rock) * (1 - gravel);
    // vertex-relief allowance: off on the paving, stairs and pads (the slabs sit on `height()`),
    // full on bare soil / litter / moss, a third on turf (the grass carpet is planted on
    // `height()` and must not float), none on the triplanar rock
    const relief = open * (1 - smoothstep(NEAR_GROUND.DISP_PATH_FADE[0], NEAR_GROUND.DISP_PATH_FADE[1], path)) * (1 - gravel) * (1 - rock) * (0.35 + 0.65 * clamp(soil + litter + moss, 0, 1));
    // round 44 (survey-1 #11): the steep-face weight — bare soil, rock and litter on slopes over
    // 0.2 (37°), moss from 0.1 (its pads sit on the lip where the face rolls over), off the
    // paving / stairs / pads and the turf (the grass carpet sits on `height()`). material.ts
    // gives these faces root-ridge (soil) and rock-plate (rock) relief — normal + albedo, and
    // ≤ 1.5 cm of GPU displacement on the fine lattice near the camera — and breaks the moss
    // into cushions (the sampler is untouched: the survey's earth face behind the house lawn
    // read as smooth clay with flat moss pads, the hollow's east cliff as rock texture on a plane).
    const face =
      open *
      (1 - smoothstep(NEAR_GROUND.DISP_PATH_FADE[0], NEAR_GROUND.DISP_PATH_FADE[1], path)) *
      (1 - gravel) *
      clamp(smoothstep(0.2, 0.4, slope) * (soil + rock + 0.5 * litter) + smoothstep(0.1, 0.3, slope) * moss, 0, 1);
    w2[o] = wet;
    w2[o + 1] = clamp(relief, 0, 1);
    w2[o + 2] = roots;
    w2[o + 3] = clamp(face, 0, 1);
  }
}

const _n = new Vector3();

export function buildChunkGeometry(spec: ChunkSpec, wc: WeightContext): { geometry: BufferGeometry; vertices: number } {
  const T = wc.terrain;
  const { x0, z0, sx, sz, spacing } = spec;
  const nx = Math.round(sx / spacing);
  const nz = Math.round(sz / spacing);
  const count = (nx + 1) * (nz + 1);
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const w0 = new Float32Array(count * 4);
  const w1 = new Float32Array(count * 4);
  const w2 = new Float32Array(count * 4);
  const detailed = spec.ring < 2;
  const ce = NEAR_GROUND.CURV_STEP;
  // global lattice indices of this chunk's origin: the ring spacing IS the lattice spacing of the
  // matching heightfield zone, so every vertex is a lattice point and takes its height straight
  // from the sampler's lattice (float32, seam-snapped) — the rendered surface equals `height()`.
  const gi0 = Math.round(x0 / spacing);
  const gj0 = Math.round(z0 / spacing);
  const lattice = isLatticeTerrain(T) ? T : null;
  const zone = spec.ring;

  let v = 0;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++, v++) {
      const gi = gi0 + i;
      const gj = gj0 + j;
      const x = gi * spacing;
      const z = gj * spacing;
      const h = lattice ? lattice.latticeHeight(zone, gi, gj) : T.height(x, z);
      pos[v * 3] = x;
      pos[v * 3 + 1] = h;
      pos[v * 3 + 2] = z;
      // the sampler's normal (central difference of the rendered surface): seamless across chunks
      T.normal(x, z, _n);
      nrm[v * 3] = _n.x;
      nrm[v * 3 + 1] = _n.y;
      nrm[v * 3 + 2] = _n.z;
      uv[v * 2] = x;
      uv[v * 2 + 1] = z;
      const slope = 1 - _n.y;
      if (detailed) {
        // concavity of the rendered surface (sampler heights, so it is the same on both sides of
        // a chunk seam): the wet band's dish detector, see NEAR_GROUND
        const curv = T.height(x + ce, z) + T.height(x - ce, z) + T.height(x, z + ce) + T.height(x, z - ce) - 4 * h;
        layerWeights(wc, x, z, slope, T.mask(x, z), terrainDetail(x, z), w0, w1, v * 4, curv, w2);
      } else {
        layerWeights(wc, x, z, slope, null, null, w0, w1, v * 4);
      }
    }
  }

  const idx = new (count > 65535 ? Uint32Array : Uint16Array)(nx * nz * 6);
  let k = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      // alternate the diagonal so the grid does not read as stripes on slopes; parity is taken
      // from the GLOBAL lattice indices so the sampler can reproduce the same triangulation
      if ((gi0 + i + gj0 + j) & 1) {
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      } else {
        idx[k++] = a; idx[k++] = c; idx[k++] = d;
        idx[k++] = a; idx[k++] = d; idx[k++] = b;
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aW0', new Float32BufferAttribute(w0, 4));
  g.setAttribute('aW1', new Float32BufferAttribute(w1, 4));
  g.setAttribute('aW2', new Float32BufferAttribute(w2, 4));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return { geometry: g, vertices: count };
}
