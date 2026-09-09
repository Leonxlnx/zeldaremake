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
    },
  };
}

/**
 * Layer weights for one vertex. Sequential "painting": each layer covers the previous ones with
 * alpha a, so the weights always sum to one and transitions stay crisp where they should be.
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
    0.9 * smoothstep(0.2, 0.48, slope) +
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
  const rockA = smoothstep(0.4, 0.72, slope) * (0.65 + 0.35 * rockN) + cliff * 0.85 + terrace * smoothstep(0.3, 0.5, slope) * 0.6;
  rock += cover(rockA);

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
  const detailed = spec.ring < 2;
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
        layerWeights(wc, x, z, slope, T.mask(x, z), terrainDetail(x, z), w0, w1, v * 4);
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
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return { geometry: g, vertices: count };
}
