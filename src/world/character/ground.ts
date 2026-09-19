/**
 * Walkable ground for the characters: the terrain heightfield everywhere, except
 *  - inside a stair footprint, where the feet stand on the tread slabs (the heightfield is trenched
 *    0.18 m under them; see hardscape/stairs.ts: tread i tops out at base.y + (i + 1) · rise);
 *  - on the flagstone path, where the feet stand on the RENDERED slab tops. The slabs are seated
 *    2–6 cm proud of the heightfield and tilt with it, so a heightfield-only ground sank the boots
 *    and hid the contact-shadow decals inside the stones. The slab tops are learnt once from the
 *    hardscape's merged `flagstones` mesh (up-facing triangles rasterised into a 10 cm max-height
 *    grid) — read-only use of the scene graph, no coupling to hardscape code.
 * `surface` is the same idea for the stair stones at 1 cm (the `stairs-*` meshes): the rendered
 * tread tops with their nosing overhangs, for the character's footprint planting (glbLink.ts).
 */
import { Box3, BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import type { Layout } from '../layout';
import { archTunnel, surfaceMask, type Terrain } from '../terrain/heightfield';

export interface Ground {
  height(x: number, z: number): number;
  /**
   * The RENDERED walking surface under (x, z): `height`, raised to the rendered stair stone under
   * the point where that is higher — the tread tops as built (dish, ±8 mm jitter) including the
   * 2–5.7 cm nosing overhang in front of the analytic riser plane, the proud landing slabs. A
   * downward ray onto the stairs mesh, learnt once from the hardscape's `stairs-*` meshes at 1 cm
   * (attachSurface). The character's footprint planting reads this so a boot corner never sits
   * under a nosing lip; the root placement and the player's step guard keep `height`.
   */
  surface(x: number, z: number): number;
  /** height for a ground decal of the given radius: just above the tallest slab under it */
  decalHeight(x: number, z: number, radius: number): number;
  /** true inside a stair run (for the stair-climb gait) */
  onStairs(x: number, z: number): boolean;
  /** true where walking is blocked (structure pads: trunks, the log's walls — not the tunnel under its belly) */
  blocked(x: number, z: number): boolean;
  /** learn the paving surface from the rendered hardscape meshes; true once a surface grid exists */
  attachSurface(scene: Object3D): boolean;
  /** audit numbers for the paving surface grid and the rendered stair-stone grids */
  surfaceInfo(): { cells: number; covered: number; cellSize: number; triangles: number; stairs: { flights: number; cells: number; covered: number; cellSize: number; triangles: number } };
}

interface StairFrame {
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  run: number;
  tread: number;
  rise: number;
  steps: number;
  halfWidth: number;
  baseY: number;
}

interface SurfaceGrid {
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  cell: number;
  top: Float32Array;
  covered: number;
  triangles: number;
}

const CELL = 0.1;
/** the stair stones are rasterised finer: a nosing overhang is 2–5.7 cm */
const STAIR_CELL = 0.01;

/** positions + index of two triangle geometries as one (the surface grid reads nothing else) */
function concatPositions(a: BufferGeometry, b: BufferGeometry): BufferGeometry {
  const tri = (g: BufferGeometry): Float32Array => {
    const pos = g.attributes.position;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = idx ? idx.getX(i) : i;
      out[i * 3] = pos.getX(v);
      out[i * 3 + 1] = pos.getY(v);
      out[i * 3 + 2] = pos.getZ(v);
    }
    return out;
  };
  const pa = tri(a);
  const pb = tri(b);
  const all = new Float32Array(pa.length + pb.length);
  all.set(pa, 0);
  all.set(pb, pa.length);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(all, 3));
  return g;
}

/** rasterise the up-facing triangles of a world-space mesh into a max-height grid of `CELL`-sized cells */
function buildSurfaceGrid(geometry: BufferGeometry, CELL: number): SurfaceGrid | null {
  const pos = geometry.attributes.position;
  if (!pos) return null;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox ?? new Box3();
  const x0 = Math.floor(bb.min.x / CELL) * CELL - CELL;
  const z0 = Math.floor(bb.min.z / CELL) * CELL - CELL;
  const nx = Math.ceil((bb.max.x - x0) / CELL) + 2;
  const nz = Math.ceil((bb.max.z - z0) / CELL) + 2;
  if (nx * nz > 4_000_000) return null;
  const top = new Float32Array(nx * nz).fill(-Infinity);
  const index = geometry.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  let triangles = 0;
  const vi = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const splat = (cx: number, cz: number, y: number) => {
    if (cx < 0 || cz < 0 || cx >= nx || cz >= nz) return;
    const i = cz * nx + cx;
    if (y > top[i]) top[i] = y;
  };
  for (let t = 0; t < triCount; t++) {
    const a = vi(t, 0);
    const b = vi(t, 1);
    const c = vi(t, 2);
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
    const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
    const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
    // horizontal-ish faces only (tops and rolled shoulders; undersides never win the max), skip
    // the side walls
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nX = uy * vz - uz * vy;
    const nY = uz * vx - ux * vz;
    const nZ = ux * vy - uy * vx;
    const nLen = Math.hypot(nX, nY, nZ);
    if (nLen < 1e-9 || Math.abs(nY) / nLen < 0.5) continue;
    triangles++;
    // vertices always land in their own cells so slab rims are covered
    splat(Math.floor((ax - x0) / CELL), Math.floor((az - z0) / CELL), ay);
    splat(Math.floor((bx - x0) / CELL), Math.floor((bz - z0) / CELL), by);
    splat(Math.floor((cx - x0) / CELL), Math.floor((cz - z0) / CELL), cy);
    // cell centres inside the triangle take the plane height there
    const minX = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / CELL));
    const maxX = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) / CELL));
    const minZ = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / CELL));
    const maxZ = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - z0) / CELL));
    const det = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    if (Math.abs(det) < 1e-9) continue;
    for (let gz = minZ; gz <= maxZ; gz++) {
      const pz = z0 + (gz + 0.5) * CELL;
      for (let gx = minX; gx <= maxX; gx++) {
        const px = x0 + (gx + 0.5) * CELL;
        const l1 = ((px - ax) * (cz - az) - (cx - ax) * (pz - az)) / det;
        const l2 = ((bx - ax) * (pz - az) - (px - ax) * (bz - az)) / det;
        const l0 = 1 - l1 - l2;
        if (l0 < -0.02 || l1 < -0.02 || l2 < -0.02) continue;
        splat(gx, gz, l0 * ay + l1 * by + l2 * cy);
      }
    }
  }
  let covered = 0;
  for (let i = 0; i < top.length; i++) if (top[i] > -Infinity) covered++;
  return { x0, z0, nx, nz, cell: CELL, top, covered, triangles };
}

export function createGround(terrain: Terrain, layout: Layout): Ground {
  const frames: StairFrame[] = layout.stairs.map((s) => {
    const l = Math.hypot(s.dir[0], s.dir[1]);
    return { ox: s.base[0], oz: s.base[2], dx: s.dir[0] / l, dz: s.dir[1] / l, run: s.steps * s.tread, tread: s.tread, rise: s.rise, steps: s.steps, halfWidth: s.width / 2, baseY: s.base[1] };
  });
  const stairAt = (x: number, z: number): number | null => {
    for (const f of frames) {
      const rx = x - f.ox;
      const rz = z - f.oz;
      const u = rx * f.dx + rz * f.dz;
      const v = -rx * f.dz + rz * f.dx;
      if (Math.abs(v) > f.halfWidth || u < -0.05 || u > f.run + 1.6) continue;
      if (u >= f.run) return f.baseY + f.steps * f.rise;
      const i = Math.max(0, Math.floor(u / f.tread));
      return f.baseY + (i + 1) * f.rise;
    }
    return null;
  };

  let grid: SurfaceGrid | null = null;
  /** the rendered stair stones (one grid per `stairs-*` mesh) */
  const stairGrids: SurfaceGrid[] = [];
  /** rendered stair stone top under (x, z), or null off the stairs meshes */
  const stairTop = (x: number, z: number): number | null => {
    for (const g of stairGrids) {
      const cx = Math.floor((x - g.x0) / g.cell);
      const cz = Math.floor((z - g.z0) / g.cell);
      if (cx < 0 || cz < 0 || cx >= g.nx || cz >= g.nz) continue;
      const v = g.top[cz * g.nx + cx];
      if (v > -Infinity) return v;
    }
    return null;
  };
  /** max slab top within `radius` of (x, z), or null where no slab was rasterised */
  const slabTop = (x: number, z: number, radius: number): number | null => {
    if (!grid) return null;
    const cx = Math.floor((x - grid.x0) / grid.cell);
    const cz = Math.floor((z - grid.z0) / grid.cell);
    const r = Math.max(0, Math.round(radius / grid.cell));
    let best = -Infinity;
    for (let gz = Math.max(0, cz - r); gz <= Math.min(grid.nz - 1, cz + r); gz++) {
      for (let gx = Math.max(0, cx - r); gx <= Math.min(grid.nx - 1, cx + r); gx++) {
        const v = grid.top[gz * grid.nx + gx];
        if (v > best) best = v;
      }
    }
    return best > -Infinity ? best : null;
  };

  // fallback where the rendered slabs are unknown: flagstone tops sit 2–5 cm above the heightfield
  const PATH_LIFT = 0.03;
  const DECAL_LIFT = 0.012;
  // `terrain.mask(x, z).path` / `.structure` ARE `surfaceMask(x, z).path` / `.structure` (heightfield.ts
  // builds the mask from it), but the full mask also evaluates the slope (four height samples, a
  // Vector3) and the landform for the fields nobody here reads: 2.1–2.9 µs a call against 0.9–1.1 —
  // and the foot planting (glbLink.ts envelopes and scans) samples this ground several hundred
  // times a frame off the paving, where neither the stairs nor the slab grid answer first
  const pathAt = (x: number, z: number) => surfaceMask(x, z).path;
  const walk = (x: number, z: number): number => {
    const h = terrain.height(x, z);
    const s = stairAt(x, z);
    if (s !== null) return Math.max(h, s);
    // the foot stands on the slab under it (one cell of slack for the sole's footprint)
    const slab = slabTop(x, z, 0.05);
    if (slab !== null) return Math.max(h, slab);
    return h + PATH_LIFT * pathAt(x, z);
  };
  const surface = (x: number, z: number): number => {
    const h = walk(x, z);
    const s = stairTop(x, z);
    return s !== null && s > h ? s : h;
  };
  return {
    height: walk,
    surface,
    decalHeight(x, z, radius) {
      const h = walk(x, z);
      const s = stairAt(x, z);
      if (s !== null) return h + DECAL_LIFT;
      const slab = slabTop(x, z, radius);
      if (slab !== null) return Math.max(h, slab) + DECAL_LIFT;
      return h + DECAL_LIFT + PATH_LIFT * pathAt(x, z);
    },
    onStairs(x, z) {
      return stairAt(x, z) !== null;
    },
    blocked(x, z) {
      // the log arch's structure band is walkable where the path runs under its raised belly
      // (heightfield `archTunnel`, round 47); its grounded walls and root masses stay blocked
      return surfaceMask(x, z).structure > 0.5 && archTunnel(x, z) < 0.5;
    },
    attachSurface(scene) {
      if (grid) return true;
      const hardscape = scene.getObjectByName('hardscape');
      // the merged meshes are authored in world space (identity transform); skip one otherwise
      const worldSpace = (m: Mesh | undefined): m is Mesh => {
        if (!m || !m.isMesh || !m.geometry) return false;
        m.updateWorldMatrix(true, false);
        const e = m.matrixWorld.elements;
        return Math.abs(e[0] - 1) <= 1e-6 && Math.abs(e[5] - 1) <= 1e-6 && Math.abs(e[10] - 1) <= 1e-6 && Math.abs(e[12]) + Math.abs(e[13]) + Math.abs(e[14]) <= 1e-6;
      };
      // the stair stones (rendered tread tops with their nosing overhangs) at 1 cm, one grid per flight
      if (!stairGrids.length && hardscape) {
        for (const s of layout.stairs) {
          const m = hardscape.getObjectByName(`stairs-${s.id}`) as Mesh | undefined;
          if (!worldSpace(m)) continue;
          const g = buildSurfaceGrid(m.geometry, STAIR_CELL);
          if (g) stairGrids.push(g);
        }
      }
      const slabs = hardscape?.getObjectByName('flagstones') as Mesh | undefined;
      if (!worldSpace(slabs)) return false;
      // the north paving + lookout dais are a second mesh (hidden by distance for rendering);
      // the feet stand on both, so the grid reads their geometries together
      const north = hardscape?.getObjectByName('flagstones-north') as Mesh | undefined;
      const merged = worldSpace(north) ? concatPositions(slabs.geometry, north.geometry) : null;
      grid = buildSurfaceGrid(merged ?? slabs.geometry, CELL);
      merged?.dispose();
      return grid !== null;
    },
    surfaceInfo() {
      const stairs = { flights: stairGrids.length, cells: stairGrids.reduce((n, g) => n + g.nx * g.nz, 0), covered: stairGrids.reduce((n, g) => n + g.covered, 0), cellSize: STAIR_CELL, triangles: stairGrids.reduce((n, g) => n + g.triangles, 0) };
      return grid ? { cells: grid.nx * grid.nz, covered: grid.covered, cellSize: grid.cell, triangles: grid.triangles, stairs } : { cells: 0, covered: 0, cellSize: CELL, triangles: 0, stairs };
    },
  };
}
