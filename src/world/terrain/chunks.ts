/**
 * Terrain chunk layout + geometry. Three concentric rings share one global grid per ring so
 * chunk edges line up; where a fine ring meets a coarser one, the fine edge vertices are snapped
 * onto the coarse neighbour's linear edge, which removes T-junction cracks without skirts.
 * Normals are analytic (central differences of the heightfield), so shading is seamless.
 */
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { Terrain, TerrainMask } from './heightfield';
import { terrainDetail, type TerrainDetail } from './heightfield';
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
  innerHalf: 48,
  innerChunk: 24,
  midHalf: 144,
  midChunk: 48,
  midSpacing: 1,
  outerSpacing: 4,
};

/** Build the chunk list. `innerSegsPerChunk` must be a multiple of 24 (→ spacing 1/k m). */
export function layoutChunks(half: number, innerSegsPerChunk: number): ChunkSpec[] {
  const R = RING;
  const out: ChunkSpec[] = [];
  const innerSpacing = R.innerChunk / innerSegsPerChunk;
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
  const e = spec.ring === 0 ? spacing * 2 : spacing; // normal probe step (grid-aligned → cached)
  const detailed = spec.ring < 2;

  const snapped = (i: number, j: number): number | null => {
    // returns the neighbour-coarse spacing if this edge vertex must be snapped, else null
    if (i === 0 && spec.coarse.left) return spec.coarse.left;
    if (i === nx && spec.coarse.right) return spec.coarse.right;
    if (j === 0 && spec.coarse.near) return spec.coarse.near;
    if (j === nz && spec.coarse.far) return spec.coarse.far;
    return null;
  };

  let v = 0;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++, v++) {
      const x = x0 + i * spacing;
      const z = z0 + j * spacing;
      let h = T.height(x, z);
      const S = snapped(i, j);
      if (S !== null) {
        const r = Math.round(S / spacing);
        if (r > 1) {
          if ((i === 0 || i === nx) && j % r !== 0) {
            const j0 = Math.floor(j / r) * r;
            const t = (j - j0) / r;
            h = T.height(x, z0 + j0 * spacing) * (1 - t) + T.height(x, z0 + (j0 + r) * spacing) * t;
          } else if ((j === 0 || j === nz) && i % r !== 0) {
            const i0 = Math.floor(i / r) * r;
            const t = (i - i0) / r;
            h = T.height(x0 + i0 * spacing, z) * (1 - t) + T.height(x0 + (i0 + r) * spacing, z) * t;
          }
        }
      }
      pos[v * 3] = x;
      pos[v * 3 + 1] = h;
      pos[v * 3 + 2] = z;
      // analytic normal from the heightfield (continuous across chunk seams)
      const hl = T.height(x - e, z);
      const hr = T.height(x + e, z);
      const hd = T.height(x, z - e);
      const hu = T.height(x, z + e);
      _n.set(hl - hr, 2 * e, hd - hu).normalize();
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
      // alternate the diagonal so the grid does not read as stripes on slopes
      if ((i + j) & 1) {
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
