/**
 * Moss cushion tufts (round 40, structures-25 — owner video review, 16 Sept: "Roof moss needs
 * distinct close-scale tufts and an irregular edge over the bark, not another broad smooth
 * green layer"). Real geometry standing on a moss sheet: squat domed lumps 4–12 cm across with
 * a vertex-noise outline (no two alike), a lit top and a dark rim baked into the vertex colour,
 * and UVs that continue the sheet's map, so the sheet's albedo grain runs over them. The lumps
 * are written straight into one set of typed arrays with the same attribute layout as the
 * sheet (position / normal / uv / color, all float32), so the mesh folds into the sheet's
 * material bucket in `consolidateStaticMeshes` — thousands of tufts, one draw.
 *
 * Every tuft is placed by its caller (the house's cap parameterisation, the huts' domes); this
 * module only turns the specs into geometry. Deterministic: the outline noise is the caller's
 * seeded `Noise3D`, the per-tuft seed comes from the caller's rng.
 */
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { Noise3D } from './materials';

export interface MossTuftSpec {
  /** the sheet point the tuft stands on (world) */
  position: Vector3;
  /** the sheet's outward normal there (unit) */
  normal: Vector3;
  /** footprint half-axes along the tuft's own tangents (m) */
  rx: number;
  rz: number;
  /** height of the crown over the sheet (m) */
  h: number;
  /** yaw of the footprint's x half-axis about the normal (rad) */
  yaw: number;
  /** the sheet's vertex colour at the base (linear, the caller's own scale) */
  color: [number, number, number];
  /** the sheet's uv at the base; the tuft's uvs continue it at `uvMetres` per tile */
  uv: [number, number];
  /** how far the base ring sinks under the sheet (m) — hides the seam on the sheet's relief */
  sink: number;
  /** per-tuft seed for the outline noise and the tone variation */
  seed: number;
}

export interface MossTuftOptions {
  /** radial segments / rings for tufts whose mean radius is at or over `fineRadius`, and below it */
  segments: [number, number];
  rings: [number, number];
  fineRadius: number;
  /** colour gain at the crown (lit top) and at the base ring (dark rim); the mid rings interpolate */
  topGain: number;
  rimGain: number;
  /** extra tint on the lit crown (linear multipliers: the sun-through-the-tips warmth) */
  topTint: [number, number, number];
  /** per-tuft tone variation (±, multiplicative) */
  toneSpread: number;
  /** outline noise amplitude as a fraction of the radius, and its spatial frequency (1/m) */
  ruffle: number;
  ruffleFreq: number;
  /** metres of surface per uv tile (the sheet's map scale) */
  uvMetres: number;
}

export const DEFAULT_TUFT_OPTIONS: MossTuftOptions = {
  segments: [8, 6],
  rings: [2, 2],
  fineRadius: 0.035,
  topGain: 1.5,
  rimGain: 0.48,
  topTint: [1.0, 1.04, 0.86],
  toneSpread: 0.12,
  ruffle: 0.2,
  ruffleFreq: 45,
  uvMetres: 1.6,
};

/** the tuft's meridian profile: a fuller-than-spherical cushion (t = 0 base ring … 1 crown) */
function profile(t: number): { r: number; y: number } {
  const s = Math.sin((t * Math.PI) / 2);
  return { r: Math.pow(Math.cos((t * Math.PI) / 2), 0.72), y: Math.pow(s, 0.85) };
}

export interface MossTuftBuild {
  geometry: BufferGeometry;
  count: number;
  triangles: number;
}

const _T = new Vector3();
const _B = new Vector3();
const _N = new Vector3();
const _p = new Vector3();
const _n = new Vector3();
const _ab = new Vector3();
const _ac = new Vector3();

export function buildMossTufts(specs: MossTuftSpec[], noise: Noise3D, options: Partial<MossTuftOptions> = {}): MossTuftBuild {
  const o = { ...DEFAULT_TUFT_OPTIONS, ...options };
  // size the arrays first
  let vertCount = 0;
  let idxCount = 0;
  const shapeOf = (s: MossTuftSpec) => {
    const fine = (s.rx + s.rz) * 0.5 < o.fineRadius;
    const seg = o.segments[fine ? 1 : 0];
    const rings = o.rings[fine ? 1 : 0];
    return { seg, rings };
  };
  for (const s of specs) {
    const { seg, rings } = shapeOf(s);
    // base ring + `rings` rings + crown
    vertCount += seg * (rings + 1) + 1;
    idxCount += seg * 6 * rings + seg * 3;
  }
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const colors = new Float32Array(vertCount * 3);
  const index = vertCount > 65535 ? new Uint32Array(idxCount) : new Uint16Array(idxCount);
  let vi = 0;
  let ii = 0;
  const hash = (seed: number, k: number) => {
    // a cheap deterministic hash of the seed → [0, 1)
    const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  for (const s of specs) {
    const { seg, rings } = shapeOf(s);
    _N.copy(s.normal).normalize();
    // tangent frame: x along the yaw, z = x × n so (T, N, B) is right-handed
    const ref = Math.abs(_N.y) > 0.9 ? _T.set(1, 0, 0) : _T.set(0, 1, 0);
    _T.crossVectors(ref, _N).normalize();
    _B.crossVectors(_T, _N).normalize();
    // spin the frame by the yaw
    const cy = Math.cos(s.yaw);
    const sy = Math.sin(s.yaw);
    const tx = _T.x * cy + _B.x * sy;
    const ty = _T.y * cy + _B.y * sy;
    const tz = _T.z * cy + _B.z * sy;
    _B.set(_B.x * cy - _T.x * sy, _B.y * cy - _T.y * sy, _B.z * cy - _T.z * sy);
    _T.set(tx, ty, tz);
    const tone = 1 + (hash(s.seed, 1) - 0.5) * 2 * o.toneSpread;
    const base = vi;
    const rMean = (s.rx + s.rz) * 0.5;
    const invUv = 1 / o.uvMetres;
    // rings: j = 0 is the base ring (sunk under the sheet, slightly tucked in), j = 1..rings climb
    // the profile, then the crown vertex
    for (let j = 0; j <= rings; j++) {
      const t = j === 0 ? 0 : j / (rings + 1);
      const prof = profile(t);
      const rr = j === 0 ? 0.92 : prof.r;
      const yy = j === 0 ? -s.sink : prof.y * s.h;
      for (let i = 0; i < seg; i++) {
        const th = (i / seg) * Math.PI * 2;
        const cx = Math.cos(th);
        const sz = Math.sin(th);
        // the outline noise: a per-tuft field at ~2 cm so the footprint is lobed, not round
        const px = s.position.x + cx * s.rx * 1.3;
        const pz = s.position.z + sz * s.rz * 1.3;
        const ruff = 1 + o.ruffle * noise.noise(px * o.ruffleFreq + s.seed * 0.37, s.position.y * o.ruffleFreq + t * 3.1, pz * o.ruffleFreq - s.seed * 0.61);
        const lx = cx * s.rx * rr * ruff;
        const lz = sz * s.rz * rr * ruff;
        _p.copy(s.position).addScaledVector(_T, lx).addScaledVector(_B, lz).addScaledVector(_N, yy);
        // normal: the ellipsoid-ish outward direction, horizontal at the base ring, up at the crown
        const wr = j === 0 ? 1 : Math.cos((t * Math.PI) / 2);
        const wy = j === 0 ? 0.12 : Math.sin((t * Math.PI) / 2) + 0.12;
        _n.set(0, 0, 0).addScaledVector(_T, (cx / s.rx) * wr * rMean).addScaledVector(_B, (sz / s.rz) * wr * rMean).addScaledVector(_N, wy).normalize();
        positions[vi * 3] = _p.x;
        positions[vi * 3 + 1] = _p.y;
        positions[vi * 3 + 2] = _p.z;
        normals[vi * 3] = _n.x;
        normals[vi * 3 + 1] = _n.y;
        normals[vi * 3 + 2] = _n.z;
        uvs[vi * 2] = s.uv[0] + lx * invUv;
        uvs[vi * 2 + 1] = s.uv[1] + lz * invUv;
        // lit top / dark rim: the base ring is the rim (shadowed, damp), the crown catches the light
        const lit = j === 0 ? 0 : Math.pow(t, 0.8);
        const gain = (o.rimGain + (o.topGain - o.rimGain) * lit) * tone;
        colors[vi * 3] = s.color[0] * gain * (1 + (o.topTint[0] - 1) * lit);
        colors[vi * 3 + 1] = s.color[1] * gain * (1 + (o.topTint[1] - 1) * lit);
        colors[vi * 3 + 2] = s.color[2] * gain * (1 + (o.topTint[2] - 1) * lit);
        vi++;
      }
    }
    // crown, nudged off-centre so the lump leans a little (the noise picks the lean)
    const leanA = hash(s.seed, 2) * Math.PI * 2;
    const lean = 0.18 * hash(s.seed, 3);
    _p.copy(s.position)
      .addScaledVector(_T, Math.cos(leanA) * lean * s.rx)
      .addScaledVector(_B, Math.sin(leanA) * lean * s.rz)
      .addScaledVector(_N, s.h * (1 + 0.08 * noise.noise(s.position.x * o.ruffleFreq + 9, s.position.y * o.ruffleFreq, s.position.z * o.ruffleFreq)));
    positions[vi * 3] = _p.x;
    positions[vi * 3 + 1] = _p.y;
    positions[vi * 3 + 2] = _p.z;
    normals[vi * 3] = _N.x;
    normals[vi * 3 + 1] = _N.y;
    normals[vi * 3 + 2] = _N.z;
    uvs[vi * 2] = s.uv[0];
    uvs[vi * 2 + 1] = s.uv[1];
    colors[vi * 3] = s.color[0] * o.topGain * tone * o.topTint[0];
    colors[vi * 3 + 1] = s.color[1] * o.topGain * tone * o.topTint[1];
    colors[vi * 3 + 2] = s.color[2] * o.topGain * tone * o.topTint[2];
    const crown = vi;
    vi++;

    // winding: test the first quad's geometric normal against the outward normal and flip if needed
    const at = (j: number, i: number) => base + j * seg + (i % seg);
    const a0 = at(0, 0);
    const b0 = at(0, 1);
    const c0 = at(1, 0);
    _ab.set(positions[b0 * 3] - positions[a0 * 3], positions[b0 * 3 + 1] - positions[a0 * 3 + 1], positions[b0 * 3 + 2] - positions[a0 * 3 + 2]);
    _ac.set(positions[c0 * 3] - positions[a0 * 3], positions[c0 * 3 + 1] - positions[a0 * 3 + 1], positions[c0 * 3 + 2] - positions[a0 * 3 + 2]);
    _ab.cross(_ac);
    _n.set(normals[a0 * 3], normals[a0 * 3 + 1], normals[a0 * 3 + 2]);
    const flip = _ab.dot(_n) < 0;
    const tri = (a: number, b: number, c: number) => {
      if (flip) {
        index[ii++] = a;
        index[ii++] = c;
        index[ii++] = b;
      } else {
        index[ii++] = a;
        index[ii++] = b;
        index[ii++] = c;
      }
    };
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const a = at(j, i);
        const b = at(j, i + 1);
        const c = at(j + 1, i);
        const d = at(j + 1, i + 1);
        tri(a, b, d);
        tri(a, d, c);
      }
    }
    for (let i = 0; i < seg; i++) tri(at(rings, i), at(rings, i + 1), crown);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(index.subarray(0, ii), 1));
  return { geometry, count: specs.length, triangles: ii / 3 };
}
