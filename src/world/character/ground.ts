/**
 * Walkable ground for the characters: the terrain heightfield everywhere, except
 *  - inside a stair footprint, where the feet stand on the tread slabs (the heightfield is trenched
 *    0.18 m under them; see hardscape/stairs.ts: tread i tops out at base.y + (i + 1) · rise);
 *  - on the flagstone path, where the feet stand on the RENDERED slab tops. The slabs are seated
 *    2–6 cm proud of the heightfield and tilt with it, so a heightfield-only ground sank the boots
 *    and hid the contact-shadow decals inside the stones. The slab tops are learnt once from the
 *    hardscape's merged `flagstones` mesh (up-facing triangles rasterised into a 10 cm max-height
 *    grid) — read-only use of the scene graph, no coupling to hardscape code.
 */
import { Box3, BufferGeometry, Mesh, type Object3D } from 'three';
import type { Layout } from '../layout';
import type { Terrain } from '../terrain/heightfield';

export interface Ground {
  height(x: number, z: number): number;
  /** height for a ground decal of the given radius: just above the tallest slab under it */
  decalHeight(x: number, z: number, radius: number): number;
  /** true inside a stair run (for the stair-climb gait) */
  onStairs(x: number, z: number): boolean;
  /** true where walking is blocked (structure pads: trunks, the log) */
  blocked(x: number, z: number): boolean;
  /** learn the paving surface from the rendered hardscape meshes; true once a surface grid exists */
  attachSurface(scene: Object3D): boolean;
  /** audit numbers for the paving surface grid */
  surfaceInfo(): { cells: number; covered: number; cellSize: number; triangles: number };
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

/** rasterise the up-facing triangles of a world-space mesh into a max-height grid */
function buildSurfaceGrid(geometry: BufferGeometry): SurfaceGrid | null {
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
  const walk = (x: number, z: number): number => {
    const h = terrain.height(x, z);
    const s = stairAt(x, z);
    if (s !== null) return Math.max(h, s);
    // the foot stands on the slab under it (one cell of slack for the sole's footprint)
    const slab = slabTop(x, z, 0.05);
    if (slab !== null) return Math.max(h, slab);
    return h + PATH_LIFT * terrain.mask(x, z).path;
  };
  return {
    height: walk,
    decalHeight(x, z, radius) {
      const h = walk(x, z);
      const s = stairAt(x, z);
      if (s !== null) return h + DECAL_LIFT;
      const slab = slabTop(x, z, radius);
      if (slab !== null) return Math.max(h, slab) + DECAL_LIFT;
      return h + DECAL_LIFT + PATH_LIFT * terrain.mask(x, z).path;
    },
    onStairs(x, z) {
      return stairAt(x, z) !== null;
    },
    blocked(x, z) {
      return terrain.mask(x, z).structure > 0.5;
    },
    attachSurface(scene) {
      if (grid) return true;
      const hardscape = scene.getObjectByName('hardscape');
      const slabs = hardscape?.getObjectByName('flagstones') as Mesh | undefined;
      if (!slabs || !(slabs as Mesh).isMesh || !slabs.geometry) return false;
      // the merged mesh is authored in world space (identity transform); bail out otherwise
      slabs.updateWorldMatrix(true, false);
      const e = slabs.matrixWorld.elements;
      if (Math.abs(e[0] - 1) > 1e-6 || Math.abs(e[5] - 1) > 1e-6 || Math.abs(e[10] - 1) > 1e-6 || Math.abs(e[12]) + Math.abs(e[13]) + Math.abs(e[14]) > 1e-6) return false;
      grid = buildSurfaceGrid(slabs.geometry);
      return grid !== null;
    },
    surfaceInfo() {
      return grid ? { cells: grid.nx * grid.nz, covered: grid.covered, cellSize: grid.cell, triangles: grid.triangles } : { cells: 0, covered: 0, cellSize: CELL, triangles: 0 };
    },
  };
}
