/**
 * Flagstone paving (W03). Seeds are dart-thrown over the paved mask (paths + plaza) with a
 * noise-driven radius so slab sizes vary 0.4–1.6 m. Each seed's Voronoi cell (clipped to the
 * paved boundary and shrunk by the joint width) is filled with the best-fitting of N distinct
 * hand-cut outlines (rotation + scale search on radial profiles), so neighbouring slabs never
 * overlap and the joints stay 4–10 cm. Slabs are seated on the terrain (several samples per
 * stone), tilted to the local normal, with ≤ 4 cm height jitter. Rendered as one InstancedMesh
 * per outline variant (instance colour = per-stone tint, aMossScale = per-stone moss).
 */
import { BufferGeometry, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from 'three';
import { surfaceMask, type Terrain } from '../terrain/heightfield';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { MeshBuilder, buildSlab, centroid, irregularPolygon, pointInPolygon, polygonArea, radialProfile, type P2 } from './geometry';
import type { StairFrame } from './stairs';
import { inStairFootprint } from './stairs';

const PROFILE_SAMPLES = 32;

export interface StoneVariant {
  outline: P2[];
  profile: Float32Array;
  area: number;
  geometry: BufferGeometry;
  thickness: number;
}

export interface PlacedStone {
  x: number;
  z: number;
  /** world-space outline (top face) */
  polygon: P2[];
  variant: number;
  scale: number;
  rot: number;
  bottomY: number;
  topY: number;
  matrix: Matrix4;
  tint: Color;
  moss: number;
}

export function createStoneVariants(rng: Rng, count: number): StoneVariant[] {
  const out: StoneVariant[] = [];
  for (let i = 0; i < count; i++) {
    const n = rng.int(5, 9);
    const outline = irregularPolygon(rng, n, {
      radiusJitter: rng.range(0.12, 0.3),
      angleJitter: 0.32,
      subdivide: rng.chance(0.5) ? 2 : 3,
      edgeJitter: rng.range(0.015, 0.035),
      aspect: rng.range(0.78, 1.0),
    });
    const thickness = rng.range(0.06, 0.088);
    const mb = new MeshBuilder();
    const wearN = new Noise2D(`flag-wear-${i}`);
    buildSlab(mb, outline, {
      thickness,
      bevel: rng.range(0.03, 0.05),
      dip: rng.range(0.008, 0.02),
      color: [1, 1, 1],
      sideColor: [0.74, 0.74, 0.76],
      mossEdge: 0.75,
      mossInner: 0.05,
      mossFn: (x, z) => 0.35 + 0.65 * (wearN.fbm(x * 2.2 + i, z * 2.2, 2) * 0.5 + 0.5),
      uvScale: 0.42,
      uvOffset: [rng() * 4, rng() * 4],
      topNoise: (x, z) => 0.003 * wearN.noise(x * 7 + 3, z * 7),
      rings: 2,
    });
    const geometry = mb.build();
    out.push({ outline, profile: radialProfile(outline, PROFILE_SAMPLES), area: Math.abs(polygonArea(outline)), geometry, thickness });
  }
  return out;
}

// --- geometry helpers ----------------------------------------------------------------------

/** clip polygon by half-plane dot(p - s, n) <= d  (keeps the side containing s) */
function clipHalfPlane(poly: P2[], sx: number, sz: number, nx: number, nz: number, d: number): P2[] {
  const out: P2[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const da = (a.x - sx) * nx + (a.z - sz) * nz - d;
    const db = (b.x - sx) * nx + (b.z - sz) * nz - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
}

class Grid {
  private cells = new Map<number, number[]>();
  constructor(private size: number) {}
  key(x: number, z: number) {
    return Math.floor(x / this.size) * 100000 + Math.floor(z / this.size);
  }
  add(x: number, z: number, id: number) {
    const k = this.key(x, z);
    const c = this.cells.get(k);
    if (c) c.push(id);
    else this.cells.set(k, [id]);
  }
  near(x: number, z: number, r: number, cb: (id: number) => void) {
    const n = Math.ceil(r / this.size);
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const c = this.cells.get((cx + i) * 100000 + (cz + j));
        if (c) for (const id of c) cb(id);
      }
    }
  }
}

export interface PavingContext {
  terrain: Terrain;
  frames: StairFrame[];
  rng: Rng;
  seed: string;
  /** bounding box of the paved region */
  bbox: { x0: number; x1: number; z0: number; z1: number };
  density: number;
}

export function isPaved(pc: PavingContext, x: number, z: number, threshold = 0.5): boolean {
  const m = surfaceMask(x, z);
  if (m.path < threshold || m.stairs >= 0.5 || m.structure >= 0.5) return false;
  for (const f of pc.frames) if (inStairFootprint(f, x, z)) return false;
  return true;
}

export interface PavingResult {
  stones: PlacedStone[];
  meshes: InstancedMesh[];
  grid: Grid;
  /** true if the world point is on a stone's top face */
  onStone(x: number, z: number): boolean;
  stats: { seeds: number; skippedNarrow: number; skippedSmall: number; skippedFit: number };
}

export function placeFlagstones(pc: PavingContext, variants: StoneVariant[], material: Material): PavingResult {
  const { terrain, rng, bbox } = pc;
  const sizeNoise = new Noise2D(`${pc.seed}/flag-size`);
  const tintNoise = new Noise2D(`${pc.seed}/flag-tint`);

  // 1. dart-throw seeds with a spatially varying radius
  const seeds: { x: number; z: number; r: number }[] = [];
  const grid = new Grid(1.0);
  const radiusAt = (x: number, z: number) => {
    const n = sizeNoise.fbm(x * 0.14 + 3, z * 0.14 - 1, 2) * 0.5 + 0.5;
    const plaza = 1 - smoothstep(4.5, 7.5, Math.hypot(x, z));
    return 0.27 + 0.24 * n + 0.1 * plaza;
  };
  const attempts = Math.round(90000 * clamp(pc.density, 0.5, 1.5));
  for (let a = 0; a < attempts; a++) {
    const x = rng.range(bbox.x0, bbox.x1);
    const z = rng.range(bbox.z0, bbox.z1);
    if (!isPaved(pc, x, z, 0.5)) continue;
    const r = radiusAt(x, z);
    let ok = true;
    grid.near(x, z, r + 0.8, (id) => {
      if (!ok) return;
      const s = seeds[id];
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < (r + s.r) * 0.93) ok = false;
    });
    if (!ok) continue;
    grid.add(x, z, seeds.length);
    seeds.push({ x, z, r });
  }

  // 2. Voronoi cell per seed, clipped to the paved boundary, shrunk by the joint
  const stones: PlacedStone[] = [];
  const up = new Vector3(0, 1, 0);
  const nrm = new Vector3();
  const q = new Quaternion();
  const scl = new Vector3();
  const pos = new Vector3();
  const stoneGrid = new Grid(1.0);
  const perVariant: PlacedStone[][] = variants.map(() => []);
  const stats = { seeds: seeds.length, skippedNarrow: 0, skippedSmall: 0, skippedFit: 0 };

  for (let si = 0; si < seeds.length; si++) {
    const s = seeds[si];
    let cell: P2[] = [
      { x: s.x - 1.7, z: s.z - 1.7 },
      { x: s.x + 1.7, z: s.z - 1.7 },
      { x: s.x + 1.7, z: s.z + 1.7 },
      { x: s.x - 1.7, z: s.z + 1.7 },
    ];
    grid.near(s.x, s.z, 3.2, (id) => {
      if (id === si || cell.length < 3) return;
      const o = seeds[id];
      const dx = o.x - s.x;
      const dz = o.z - s.z;
      const l = Math.hypot(dx, dz);
      if (l < 1e-6 || l > 3.4) return;
      // weighted bisector: bigger seeds get more room
      const t = 0.5 + 0.5 * ((s.r - o.r) / (s.r + o.r));
      cell = clipHalfPlane(cell, s.x, s.z, dx / l, dz / l, l * t);
    });
    if (cell.length < 3) continue;
    // pull vertices outside the paved region toward the seed
    cell = cell.map((p) => {
      if (isPaved(pc, p.x, p.z, 0.36)) return p;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) / 2;
        const x = s.x + (p.x - s.x) * mid;
        const z = s.z + (p.z - s.z) * mid;
        if (isPaved(pc, x, z, 0.36)) lo = mid;
        else hi = mid;
      }
      return { x: s.x + (p.x - s.x) * lo, z: s.z + (p.z - s.z) * lo };
    });
    const joint = rng.range(0.04, 0.1);
    // radial profile of the cell around the seed minus half the joint
    const profileAround = (cx: number, cz: number) => {
      const local = cell.map((p) => ({ x: p.x - cx, z: p.z - cz }));
      const pr = radialProfile(local, PROFILE_SAMPLES);
      let mn = Infinity;
      for (let k = 0; k < PROFILE_SAMPLES; k++) {
        pr[k] = Math.max(0, pr[k] - joint / 2);
        mn = Math.min(mn, pr[k]);
      }
      return { pr, mn };
    };
    let { pr: prof, mn: minR } = profileAround(s.x, s.z);
    if (minR < 0.085) {
      // boundary cell squeezed against the paved edge: re-centre the stone on the cell centroid
      const c = centroid(cell);
      if (pointInPolygon(cell, c.x, c.z)) {
        const again = profileAround(c.x, c.z);
        if (again.mn >= 0.085) {
          s.x = c.x;
          s.z = c.z;
          prof = again.pr;
          minR = again.mn;
        }
      }
    }
    if (minR < 0.085) {
      stats.skippedNarrow++;
      continue;
    }

    // 3. fit the best variant / rotation (maximise filled area), pick among the top few
    const cands: { v: number; k: number; scale: number; fill: number }[] = [];
    for (let v = 0; v < variants.length; v++) {
      const vp = variants[v].profile;
      for (let k = 0; k < PROFILE_SAMPLES; k += 2) {
        let sc = Infinity;
        for (let i = 0; i < PROFILE_SAMPLES; i++) {
          const vr = vp[(i - k + PROFILE_SAMPLES) % PROFILE_SAMPLES];
          if (vr > 1e-4) sc = Math.min(sc, prof[i] / vr);
        }
        if (sc === Infinity || sc <= 0) continue;
        cands.push({ v, k, scale: sc, fill: sc * sc * variants[v].area });
      }
    }
    if (!cands.length) {
      stats.skippedFit++;
      continue;
    }
    cands.sort((a, b) => b.fill - a.fill);
    const pick = cands[Math.min(cands.length - 1, rng.int(0, 4))];
    const scale = Math.min(pick.scale, 0.82); // cap: max radius 0.82 m → ≤ ~1.6 m slabs
    if (scale < 0.2) {
      stats.skippedSmall++;
      continue; // too small to read as a slab
    }
    const rot = (pick.k / PROFILE_SAMPLES) * Math.PI * 2;

    // 4. seat on the terrain: sample height under several points of the slab
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const poly: P2[] = variants[pick.v].outline.map((p) => {
      const rx = p.x * cr - p.z * sr;
      const rz = p.x * sr + p.z * cr;
      return { x: s.x + rx * scale, z: s.z + rz * scale };
    });
    let hSum = terrain.height(s.x, s.z);
    let hMin = hSum;
    let n = 1;
    terrain.normal(s.x, s.z, nrm);
    const nAcc = nrm.clone();
    for (let i = 0; i < poly.length; i += Math.max(1, Math.floor(poly.length / 6))) {
      const px = s.x + (poly[i].x - s.x) * 0.8;
      const pz = s.z + (poly[i].z - s.z) * 0.8;
      const h = terrain.height(px, pz);
      hSum += h;
      hMin = Math.min(hMin, h);
      n++;
      nAcc.add(terrain.normal(px, pz, nrm));
    }
    const hMean = hSum / n;
    nAcc.normalize();
    // gentle tilt only: blend the terrain normal toward up so slabs never look like ramps
    nAcc.lerp(up, 0.35).normalize();
    const thickness = variants[pick.v].thickness;
    const bottomY = hMean - 0.02 + rng.range(-0.01, 0.012);
    const topY = bottomY + thickness;

    q.setFromUnitVectors(up, nAcc);
    const yawQ = new Quaternion().setFromAxisAngle(up, -rot);
    q.multiply(yawQ);
    pos.set(s.x, bottomY, s.z);
    scl.set(scale, 1, scale);
    const m = new Matrix4().compose(pos, q, scl);

    const tn = tintNoise.fbm(s.x * 0.35, s.z * 0.35, 2) * 0.5 + 0.5;
    const tint = new Color(0.86 + 0.26 * tn + rng.range(-0.05, 0.05), 0.86 + 0.24 * tn + rng.range(-0.04, 0.04), 0.86 + 0.2 * tn + rng.range(-0.04, 0.04));
    const moss = clamp(0.35 + 0.9 * (tintNoise.fbm(s.x * 0.5 + 7, s.z * 0.5, 2) * 0.5 + 0.5) - 0.35 * smoothstep(3, 0, Math.hypot(s.x, s.z)), 0.1, 1.1);

    const stone: PlacedStone = { x: s.x, z: s.z, polygon: poly, variant: pick.v, scale, rot, bottomY, topY, matrix: m, tint, moss };
    stoneGrid.add(s.x, s.z, stones.length);
    stones.push(stone);
    perVariant[pick.v].push(stone);
  }

  // 5. instanced meshes, one per variant
  const meshes: InstancedMesh[] = [];
  perVariant.forEach((list, v) => {
    if (!list.length) return;
    const im = new InstancedMesh(variants[v].geometry, material, list.length);
    const mossAttr = new Float32Array(list.length);
    list.forEach((st, i) => {
      im.setMatrixAt(i, st.matrix);
      im.setColorAt(i, st.tint);
      mossAttr[i] = st.moss;
    });
    im.geometry = variants[v].geometry.clone();
    im.geometry.setAttribute('aMossScale', new InstancedBufferAttribute(mossAttr, 1));
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = `flagstones-v${v}`;
    im.frustumCulled = true;
    im.computeBoundingSphere();
    meshes.push(im);
  });

  const onStone = (x: number, z: number) => {
    let hit = false;
    stoneGrid.near(x, z, 1.2, (id) => {
      if (hit) return;
      const st = stones[id];
      if (Math.hypot(st.x - x, st.z - z) > st.scale * 1.05) return;
      if (pointInPolygon(st.polygon, x, z)) hit = true;
    });
    return hit;
  };

  return { stones, meshes, grid: stoneGrid, onStone, stats };
}
