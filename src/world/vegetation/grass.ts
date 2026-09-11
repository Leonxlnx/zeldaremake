/**
 * Tiled, GPU-instanced grass. One InstancedMesh per 8 m tile; each tile owns three LOD
 * geometries (4-segment curved blade / 2-segment blade / single triangle) that share the
 * per-instance attribute buffers, so `update()` swaps geometry by camera distance without
 * touching instance counts (the audit cross-checks counts against the scene graph).
 *
 * Three blade types live in the same instance stream and are shaped in the vertex shader
 * from a per-instance type id: short turf (bent, tapering), tall meadow grass (slender,
 * drooping tip) and broad sedge blades (blunt). Height, width, yaw, tilt, tint, dryness,
 * wind phase and stiffness are all per instance.
 */
import { BufferGeometry, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Sphere, Uint16BufferAttribute, Vector3, type Material } from 'three';
import type { WorldContext } from '../system';
import { smoothstep, clamp } from '../util/noise';
import { VegField, composeMatrix, newSample } from './field';

export const GRASS_TYPE_NAMES = ['turf', 'meadow', 'sedge'] as const;

export interface GrassTile {
  mesh: InstancedMesh;
  cx: number;
  cz: number;
  count: number;
  lods: BufferGeometry[];
  lod: number;
}

export interface GrassResult {
  tiles: GrassTile[];
  count: number;
  typeCounts: number[];
  heightMean: number;
  heightCV: number;
  samples: number[][];
  tileSize: number;
  lodDistances: number[];
  /** upper-bound estimate (no frustum culling) of what the last update() left drawable */
  visible: { drawCalls: number; triangles: number; lodCounts: number[] };
  update(camPos: Vector3): void;
}

/** Unit blade: width 1 (x ∈ ±0.5·widthMul), height 1, `segments` rows + tip. */
function bladeGeometry(segments: number, widthMul: number): { position: Float32BufferAttribute; uv: Float32BufferAttribute; normal: Float32BufferAttribute; index: Uint16BufferAttribute } {
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j < segments; j++) {
    const t = j / segments;
    pos.push(-0.5 * widthMul, t, 0, 0.5 * widthMul, t, 0);
    uv.push(0, t, 1, t);
    nrm.push(0, 0, 1, 0, 0, 1);
  }
  pos.push(0, 1, 0);
  uv.push(0.5, 1);
  nrm.push(0, 0, 1);
  const tip = segments * 2;
  for (let j = 0; j < segments - 1; j++) {
    const a = j * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  idx.push((segments - 1) * 2, (segments - 1) * 2 + 1, tip);
  return { position: new Float32BufferAttribute(pos, 3), uv: new Float32BufferAttribute(uv, 2), normal: new Float32BufferAttribute(nrm, 3), index: new Uint16BufferAttribute(idx, 1) };
}

const TILE = 8;
/** candidate blades per m² at full density before mask/cluster rejection */
const CANDIDATES_PER_M2 = 340;
const DNORM = 1.5;

export async function buildGrass(ctx: WorldContext, field: VegField, material: Material, parent: Group, onProgress: (f: number) => void): Promise<GrassResult> {
  const T = ctx.terrain;
  const R = ctx.config.detailRadius;
  const q = ctx.quality;
  const bases = [bladeGeometry(4, 1), bladeGeometry(2, 1.3), bladeGeometry(1, 1.9)];
  const s = newSample();
  const tiles: GrassTile[] = [];
  const typeCounts = [0, 0, 0];
  let total = 0;
  let hSum = 0;
  let hSq = 0;
  const sampleEvery = 997;
  const samples: number[][] = [];

  const half = Math.ceil((R + TILE) / TILE);
  const tileCoords: [number, number][] = [];
  for (let cz = -half; cz < half; cz++) {
    for (let cx = -half; cx < half; cx++) {
      const mx = cx * TILE + TILE / 2;
      const mz = cz * TILE + TILE / 2;
      if (Math.hypot(mx, mz) > R + TILE * 0.71) continue;
      tileCoords.push([cx, cz]);
    }
  }

  const maxPerTile = Math.ceil(TILE * TILE * CANDIDATES_PER_M2 * Math.max(q.density, 0.1));
  const matrices = new Float32Array(maxPerTile * 16);
  const data = new Float32Array(maxPerTile * 4);

  for (let ti = 0; ti < tileCoords.length; ti++) {
    const [cx, cz] = tileCoords[ti];
    const x0 = cx * TILE;
    const z0 = cz * TILE;
    const mx = x0 + TILE / 2;
    const mz = z0 + TILE / 2;
    const rng = ctx.rng.fork(`grass/${cx}/${cz}`);
    const candidates = Math.round(TILE * TILE * CANDIDATES_PER_M2 * field.falloff(mx, mz) * q.density);
    let count = 0;
    let ySum = 0;
    let yMin = Infinity;
    let yMax = -Infinity;
    let maxH = 0;
    for (let c = 0; c < candidates && count < maxPerTile; c++) {
      // mm-quantised so the audited sample position queries the terrain at exactly this point
      const x = Math.round((x0 + rng() * TILE) * 1000) / 1000;
      const z = Math.round((z0 + rng() * TILE) * 1000) / 1000;
      if (Math.hypot(x, z) > R + 1.5) continue;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s)) continue;
      if (field.insideGiantTrunk(x, z)) continue;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder) continue;

      const edge = field.lawnEdgeDistance(x, z);
      const verge = edge < 2.5 ? 1 + 0.9 * (1 - edge / 2.5) : 1;
      const low = field.lowZone(x, z);
      const trim = field.trimZone(x, z);
      const shade = field.shadeZone(x, z);
      // the trodden strip between Saria's stepping stones (frames 14 / 24): half the blades, a
      // few bare dirt patches (the dry noise picks them), nothing above ≈ 40 % of the lawn's height
      const trod = field.troddenZone(x, z);
      const bare = trod * smoothstep(0.25, 0.7, field.dry(x, z));
      // camera C's left third (frame 46): the stair foot shows over short turf, no tall blades
      const sight = field.sightlineC(x, z, 0.5);
      // the reference's slopes are not thicker than its flats; the boost stays for banks outside
      // the low verges so the embankments still read dense
      const slopeBoost = 1 + 0.6 * smoothstep(0.15, 0.5, s.slope) * (1 - s.cliff) * (1 - low);
      const cliffCut = 1 - s.cliff * 0.4;
      const giant = field.giantProximity(x, z);
      const cluster = field.cluster(x, z);
      // the shaded bank of frame 8 is a closed turf mass in the reference: cluster gaps close there
      const density = cluster * verge * slopeBoost * cliffCut * (1 - 0.75 * giant) * (1 - 0.5 * clr.npc) * (1 - 0.35 * low) * (1 + 0.6 * shade) * (1 - 0.35 * trod - 0.5 * bare);
      if (rng() * DNORM > density) continue;

      // type: tall meadow blades are rare in the low verges and the tidy foreground
      const meadow = field.meadow(x, z);
      const sedge = field.sedge(x, z);
      const meadowP = 0.78 * meadow * (edge < 3 ? 1.15 : 1) * (1 - clr.npc) * (1 - clr.boulder) * (1 - 0.85 * low) * (1 - 0.9 * sight) * (1 - 0.7 * trim) * (1 - 0.9 * trod);
      const sedgeP = 0.42 * sedge * (0.6 + 0.6 * s.plateau) * (1 - clr.npc);
      const tr = rng();
      const type = tr < meadowP ? 1 : tr < meadowP + sedgeP ? 2 : 0;

      // size (reference: 0.15–0.35 m tufts, ≈ 0.5 m in the verges — see ANALYSIS §5)
      const clusterVar = 0.82 + 0.32 * cluster;
      let h: number;
      let w: number;
      if (type === 1) {
        h = (0.28 + 0.32 * rng()) * clusterVar;
        w = 0.008 + 0.008 * rng();
      } else if (type === 2) {
        h = (0.2 + 0.3 * rng()) * clusterVar;
        w = 0.024 + 0.016 * rng();
      } else {
        h = (0.11 + 0.2 * Math.pow(rng(), 1.4)) * clusterVar * (edge < 2.5 ? 1.15 : 1);
        w = 0.012 + 0.012 * rng();
      }
      if (edge < 0.3) h *= 0.72;
      h *= 1 - 0.35 * clr.npc;
      h *= 1 - 0.3 * giant;
      h *= (1 - 0.4 * low) * (1 - 0.2 * sight) * (1 - 0.35 * trim) * (1 - 0.62 * trod);
      maxH = Math.max(maxH, h);

      // colour. The shade zone (frame 8's right embankment) measures ≈ 0.30 luminance in the
      // reference with a 0.24–0.375 p10–p90 spread; under our fill light the deep tint rendered it
      // ≈ 0.21 and flat. The bank is biased toward the light olives instead (the canopy shadow
      // already supplies the "shaded"), its blades get the flatter fill-lit gradient (shade lift,
      // see materials.ts) and keep a few straw tips for the blade-to-blade texture.
      // trodden blades are dusty: lighter olive with more straw tips
      let tn = field.tint(x, z) + rng.gauss() * 0.22 - 0.45 * giant + (edge < 1.5 ? 0.12 : 0) + 0.35 * shade - 0.25 * trim + 0.2 * trod;
      if (s.slope > 0.35) tn -= 0.15 * (1 - shade);
      const tintIndex = tn < -0.28 ? 0 : tn < 0.12 ? 1 : tn < 0.48 ? 2 : 3;
      const dryP = (field.dry(x, z) * (0.35 + 0.65 * s.plateau) + 0.35 * trod) * (type === 2 ? 0.4 : 1) * (1 - 0.5 * shade);
      const dry = clamp(dryP * (0.3 + 0.7 * rng()), 0, 0.95);

      // wind
      const phase = rng();
      const stiffness = clamp(1 - h * (0.75 + 0.35 * rng()), 0.05, 0.95);

      const y = T.height(x, z) - 0.012;
      const yaw = rng() * Math.PI * 2;
      const nx = s.nx + rng.gauss() * 0.07;
      const nz = s.nz + rng.gauss() * 0.07;
      composeMatrix(matrices, count * 16, x, y, z, nx, s.ny, nz, 0.5, yaw, w, h, h);
      const o = count * 4;
      data[o] = phase;
      data[o + 1] = stiffness;
      // tint slot: integer part = palette index, fraction 0.25..0.75 = shade lift (materials.ts)
      data[o + 2] = (tintIndex + 0.25 + 0.5 * shade) / 4;
      data[o + 3] = type + dry;
      count++;
      typeCounts[type]++;
      hSum += h;
      hSq += h * h;
      ySum += y;
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
      if ((total + count) % sampleEvery === 0) samples.push([x, Math.round(y * 10000) / 10000, z]);
    }
    if (count === 0) continue;

    const aData = new InstancedBufferAttribute(data.slice(0, count * 4), 4);
    const lods = bases.map((b) => {
      const g = new BufferGeometry();
      g.setAttribute('position', b.position);
      g.setAttribute('uv', b.uv);
      g.setAttribute('normal', b.normal);
      g.setAttribute('aData', aData);
      g.setIndex(b.index);
      // instance-independent bounds; the mesh carries the real bounding sphere
      g.boundingSphere = new Sphere(new Vector3(0, 0.5, 0), 1.5);
      return g;
    });
    const mesh = new InstancedMesh(lods[2], material, count);
    mesh.instanceMatrix.array.set(matrices.subarray(0, count * 16));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.name = `grass-tile-${cx}-${cz}`;
    const yc = ySum / count;
    mesh.boundingSphere = new Sphere(new Vector3(mx, yc + maxH * 0.5, mz), Math.hypot(TILE * 0.71, (yMax - yMin) * 0.5 + maxH) + 0.35);
    parent.add(mesh);
    tiles.push({ mesh, cx, cz, count, lods, lod: 2 });
    total += count;
    onProgress((ti + 1) / tileCoords.length);
    if (ti % 6 === 5) await new Promise<void>((r) => setTimeout(r, 0));
  }

  // keep ≤ 400 evenly spread samples
  while (samples.length > 400) samples.splice(Math.floor(samples.length / 2) % samples.length, 1);

  const mean = total ? hSum / total : 0;
  const variance = total ? hSq / total - mean * mean : 0;
  const cv = mean > 0 ? Math.sqrt(Math.max(0, variance)) / mean : 0;

  // Distances are measured from each tile's near edge, so the four-segment blades still
  // extend beyond 10 m. Preserve foreground detail/counts while budgeting for leafy shrubs.
  const lodDistances = [10 * q.distance, 24 * q.distance, 78 * q.distance];
  const trisPerLod = bases.map((b) => b.index.count / 3);
  const halfDiag = TILE * 0.71;
  const visible = { drawCalls: 0, triangles: 0, lodCounts: [0, 0, 0] };
  const update = (camPos: Vector3) => {
    visible.drawCalls = 0;
    visible.triangles = 0;
    visible.lodCounts = [0, 0, 0];
    for (const t of tiles) {
      const d = Math.hypot(camPos.x - (t.cx * TILE + TILE / 2), camPos.z - (t.cz * TILE + TILE / 2)) - halfDiag;
      const lod = d < lodDistances[0] ? 0 : d < lodDistances[1] ? 1 : 2;
      if (lod !== t.lod) {
        t.lod = lod;
        t.mesh.geometry = t.lods[lod];
      }
      t.mesh.visible = d < lodDistances[2];
      if (t.mesh.visible) {
        visible.drawCalls++;
        visible.triangles += t.count * trisPerLod[lod];
        visible.lodCounts[lod]++;
      }
    }
  };

  return { tiles, count: total, typeCounts, heightMean: mean, heightCV: cv, samples, tileSize: TILE, lodDistances, visible, update };
}
