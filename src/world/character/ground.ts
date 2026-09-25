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
import { EXPANSION_EAST, EXPANSION_STAIRS, southBridgeFrame, type Layout } from '../layout';
import { NORTH_STAIRS } from '../layout';
import type { SharedGeometry, WalkSpan, WalkSurface } from '../system';
import type { WalkEdge } from '../system';
import { archTunnel, surfaceMask, type Terrain } from '../terrain/heightfield';
import { bridgeLocal, inFarCorridor, ravineCut, southOfRavine } from '../terrain/south';

const BRIDGE_LEN = southBridgeFrame().len;

/**
 * The east lookout's rope fence (layout `EXPANSION_EAST.lookout`), where the plateau's south lip
 * falls 5 m in 6 m: the character stops FENCE_STOP_M short of the rope. It is no structure pad, so
 * the grass under the rope stays. The stumps its ends wrap round stop him FENCE_STOP_M off their
 * feet, and each end post stands inside that ring: a push along the rope ends in the corner.
 */
const LOOKOUT_FENCE = EXPANSION_EAST.lookout.fence.slice(1).map((b, i) => {
  const a = EXPANSION_EAST.lookout.fence[i];
  return { ax: a[0], az: a[2], ex: b[0] - a[0], ez: b[2] - a[2] };
});
const FENCE_STOP_M = 0.25;
const LOOKOUT_ANCHORS = EXPANSION_EAST.lookout.anchors.map((a) => ({ x: a.x, z: a.z, r: a.r + FENCE_STOP_M }));
const LOOKOUT_FENCE_BOX = (() => {
  const xs = [...EXPANSION_EAST.lookout.fence.map((p) => p[0] - FENCE_STOP_M), ...EXPANSION_EAST.lookout.fence.map((p) => p[0] + FENCE_STOP_M), ...LOOKOUT_ANCHORS.flatMap((a) => [a.x - a.r, a.x + a.r])];
  const zs = [...EXPANSION_EAST.lookout.fence.map((p) => p[2] - FENCE_STOP_M), ...EXPANSION_EAST.lookout.fence.map((p) => p[2] + FENCE_STOP_M), ...LOOKOUT_ANCHORS.flatMap((a) => [a.z - a.r, a.z + a.r])];
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
})();
const lookoutFenceBlocked = (x: number, z: number): boolean => {
  const B = LOOKOUT_FENCE_BOX;
  if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return false;
  for (const s of LOOKOUT_FENCE) {
    const t = Math.min(1, Math.max(0, ((x - s.ax) * s.ex + (z - s.az) * s.ez) / (s.ex * s.ex + s.ez * s.ez)));
    if (Math.hypot(x - (s.ax + s.ex * t), z - (s.az + s.ez * t)) < FENCE_STOP_M) return true;
  }
  for (const a of LOOKOUT_ANCHORS) if ((x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r) return true;
  return false;
};

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
  /** true where solid props or structure pads/walls block walking and airborne movement */
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
export const STAIR_CELL = 0.01;

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
function buildSurfaceGrid(geometry: BufferGeometry, CELL: number, timberTriangleStart = Infinity): SurfaceGrid | null {
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
    // Preserve the stone/paving slope filter. Appended outward timber also needs its
    // steeper upper shoulders; downward faces and vertical walls do not support a sole.
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nX = uy * vz - uz * vy;
    const nY = uz * vx - ux * vz;
    const nZ = ux * vy - uy * vx;
    const nLen = Math.hypot(nX, nY, nZ);
    if (nLen < 1e-9 || (t < timberTriangleStart ? Math.abs(nY) / nLen < 0.5 : nY <= 0)) continue;
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

/**
 * `shared` (round 49): the structures' published walk surfaces (`ctx.shared.walkSurfaces` — the
 * west house's platform disc, walkway deck and wall ring) become walkable / blocking here.
 */
export function createGround(terrain: Terrain, layout: Layout, shared?: SharedGeometry): Ground {
  // round 49: the expansion's flights (layout EXPANSION_STAIRS) climb like the layout's
  // (2026-09-24: and the grove's, layout NORTH_STAIRS)
  const allStairs = [...layout.stairs, ...EXPANSION_STAIRS, ...NORTH_STAIRS];
  const frames: StairFrame[] = allStairs.map((s) => {
    const l = Math.hypot(s.dir[0], s.dir[1]);
    return { ox: s.base[0], oz: s.base[2], dx: s.dir[0] / l, dz: s.dir[1] / l, run: s.steps * s.tread, tread: s.tread, rise: s.rise, steps: s.steps, halfWidth: s.width / 2, baseY: s.base[1] };
  });
  const walkSurfaces: WalkSurface[] = shared?.walkSurfaces ?? [];
  const propBlockers = shared?.propBlockers ?? [];
  // round 56: the rope bridge's deck and the log tunnel's floor (polylines of built tops), each with its XZ box
  const walkSpans = (shared?.walkSpans ?? []).map((s: WalkSpan) => {
    const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const p of s.pts) {
      b.x0 = Math.min(b.x0, p[0] - s.hw);
      b.x1 = Math.max(b.x1, p[0] + s.hw);
      b.z0 = Math.min(b.z0, p[2] - s.hw);
      b.z1 = Math.max(b.z1, p[2] + s.hw);
    }
    return { ...s, box: b };
  });
  /** the span's top under (x, z) — within `hw` of its centre line, between its end points — or null */
  const spanTop = (x: number, z: number): number | null => {
    let best: number | null = null;
    for (const s of walkSpans) {
      if (x < s.box.x0 || x > s.box.x1 || z < s.box.z0 || z > s.box.z1) continue;
      let bd = Infinity;
      let by = 0;
      for (let i = 0; i + 1 < s.pts.length; i++) {
        const a = s.pts[i];
        const b = s.pts[i + 1];
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const len2 = dx * dx + dz * dz;
        if (len2 < 1e-12) continue;
        const t = ((x - a[0]) * dx + (z - a[2]) * dz) / len2;
        if ((t < 0 && i > 0) || (t > 1 && i + 2 < s.pts.length) || t < -0.02 || t > 1.02) continue;
        const tc = Math.min(Math.max(t, 0), 1);
        const d = Math.hypot(x - a[0] - dx * tc, z - a[2] - dz * tc);
        if (d < bd) {
          bd = d;
          by = a[1] + (b[1] - a[1]) * tc;
        }
      }
      if (bd <= s.hw) best = Math.max(best ?? -Infinity, by);
    }
    return best;
  };
  // 2026-09-24: the grove's railings and deck edges (polylines with a half width), each with its XZ box
  const walkEdges = (shared?.walkEdges ?? []).map((e: WalkEdge) => {
    const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const p of e.pts) {
      b.x0 = Math.min(b.x0, p[0] - e.hw);
      b.x1 = Math.max(b.x1, p[0] + e.hw);
      b.z0 = Math.min(b.z0, p[2] - e.hw);
      b.z1 = Math.max(b.z1, p[2] + e.hw);
    }
    return { ...e, box: b };
  });
  /** true within an edge's half width of its line */
  const edgeBlocked = (x: number, z: number): boolean => {
    for (const e of walkEdges) {
      if (x < e.box.x0 || x > e.box.x1 || z < e.box.z0 || z > e.box.z1) continue;
      for (let i = 0; i + 1 < e.pts.length; i++) {
        const a = e.pts[i];
        const b = e.pts[i + 1];
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const len2 = dx * dx + dz * dz;
        const t = len2 < 1e-12 ? 0 : Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[2]) * dz) / len2));
        if (Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t) < e.hw) return true;
      }
    }
    return false;
  };
  /**
   * the built surface (platform / deck top) under (x, z), or null off every walk surface;
   * `skirted` also reads a deck's `skirt` round its strip (heights; `blocked()` closes it)
   */
  const builtTop = (x: number, z: number, skirted = false): number | null => {
    let best: number | null = spanTop(x, z);
    for (const w of walkSurfaces) {
      const d = Math.hypot(x - w.disc.x, z - w.disc.z);
      if (d <= w.disc.r) best = Math.max(best ?? -Infinity, w.disc.y);
      const { a, b, hw } = w.deck;
      const skirt = skirted ? w.deck.skirt : undefined;
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const len2 = dx * dx + dz * dz;
      if (len2 > 1e-9) {
        const t = ((x - a[0]) * dx + (z - a[2]) * dz) / len2;
        if (t >= -0.02 && t <= 1.02 + (skirt ? skirt.end / Math.sqrt(len2) : 0)) {
          const px = a[0] + dx * t;
          const pz = a[2] + dz * t;
          if (Math.hypot(x - px, z - pz) <= hw + (skirt ? skirt.side : 0)) best = Math.max(best ?? -Infinity, a[1] + (b[1] - a[1]) * Math.min(Math.max(t, 0), 1));
        }
      }
    }
    return best;
  };
  /** true inside a hut's wall ring (not in its doorway) */
  const wallBlocked = (x: number, z: number): boolean => {
    for (const w of walkSurfaces) {
      const dx = x - w.disc.x;
      const dz = z - w.disc.z;
      const d = Math.hypot(dx, dz);
      if (Math.abs(d - w.wall.r) > w.wall.half) continue;
      const ang = Math.atan2(dz, dx);
      const rel = Math.atan2(Math.sin(ang - w.wall.gap[0]), Math.cos(ang - w.wall.gap[0]));
      const span = Math.atan2(Math.sin(w.wall.gap[1] - w.wall.gap[0]), Math.cos(w.wall.gap[1] - w.wall.gap[0]));
      if (rel >= 0 && rel <= span) continue;
      return true;
    }
    return false;
  };
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
  /** 2026-09-24: the grove trail's discs, 90 m north of the plaza grid's box, in a grid of their own */
  let groveGrid: SurfaceGrid | null = null;
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
    let best = -Infinity;
    for (const g of [grid, groveGrid]) {
      if (!g) continue;
      const cx = Math.floor((x - g.x0) / g.cell);
      const cz = Math.floor((z - g.z0) / g.cell);
      const r = Math.max(0, Math.round(radius / g.cell));
      for (let gz = Math.max(0, cz - r); gz <= Math.min(g.nz - 1, cz + r); gz++) {
        for (let gx = Math.max(0, cx - r); gx <= Math.min(g.nx - 1, cx + r); gx++) {
          const v = g.top[gz * g.nx + gx];
          if (v > best) best = v;
        }
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
  // (round 49: the LIVE view — with the expansion's flights, discs and structure pads)
  const pathAt = (x: number, z: number) => surfaceMask(x, z, 'live').path;
  const walk = (x: number, z: number): number => {
    const h = terrain.height(x, z);
    const s = stairAt(x, z);
    if (s !== null) return Math.max(h, s);
    // round 49: a built surface (the west house's platform / deck) over the ground
    const built = builtTop(x, z, true);
    if (built !== null) return Math.max(h, built);
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
      // ponytail: solid discs use the wall policy at every height until prop-top landing is implemented.
      for (const b of propBlockers) {
        if ((x - b.x) ** 2 + (z - b.z) ** 2 < (b.r + 0.12) ** 2) return true;
      }
      if (edgeBlocked(x, z)) return true;
      // round 49: the hut's wall ring blocks (its doorway is the gap); on its platform / deck the
      // ground's structure pad (the bole under the floor) does not
      if (wallBlocked(x, z)) return true;
      if (builtTop(x, z) !== null) return false;
      // round 56: off the bridge's deck the ravine is a drop (its cut deeper than a kerb; beside the
      // deck between the sills whatever the cut), and the far bank is walkable only along the far
      // path to the log's mouth (terrain/south.ts)
      const bl = bridgeLocal(x, z);
      if (bl.a > 0.3 && bl.a < BRIDGE_LEN - 0.3 && Math.abs(bl.c) < 2.0) return true;
      if (ravineCut(x, z) > 0.3) return true;
      if (southOfRavine(x, z) && !inFarCorridor(x, z)) return true;
      // a deck's skirt is the air round its strip at the planks' height: nobody walks or lands there
      if (builtTop(x, z, true) !== null) return true;
      if (lookoutFenceBlocked(x, z)) return true;
      // the log arch's structure band is walkable where the path runs under its raised belly
      // (heightfield `archTunnel`, round 47); its grounded walls and root masses stay blocked
      return surfaceMask(x, z, 'live').structure > 0.5 && archTunnel(x, z) < 0.5;
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
      // Stone treads and optional timber nosings share one rendered support grid per flight.
      if (!stairGrids.length && hardscape) {
        for (const s of allStairs) {
          const m = hardscape.getObjectByName(`stairs-${s.id}`) as Mesh | undefined;
          if (!worldSpace(m)) continue;
          const logs = hardscape.getObjectByName(`stairs-${s.id}-logs`) as Mesh | undefined;
          const merged = worldSpace(logs) ? concatPositions(m.geometry, logs.geometry) : null;
          // concatPositions appends all timber triangles after the stone triangles.
          const timberTriangleStart = merged ? (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3 : Infinity;
          const g = buildSurfaceGrid(merged ?? m.geometry, STAIR_CELL, timberTriangleStart);
          merged?.dispose();
          if (g) stairGrids.push(g);
        }
      }
      const grove = hardscape?.getObjectByName('flagstones-grove') as Mesh | undefined;
      if (!groveGrid && worldSpace(grove)) groveGrid = buildSurfaceGrid(grove.geometry, CELL);
      const slabs = hardscape?.getObjectByName('flagstones') as Mesh | undefined;
      if (!worldSpace(slabs)) return false;
      // the north paving + lookout dais are a second mesh (hidden by distance for rendering);
      // the feet stand on both, so the grid reads their geometries together
      const north = hardscape?.getObjectByName('flagstones-north') as Mesh | undefined;
      // round 49: the expansion's stepping discs are a third mesh (hidden by distance for rendering too)
      const expansion = hardscape?.getObjectByName('flagstones-expansion') as Mesh | undefined;
      // round 56: the south route's paving (the path to the bridge and the far path to the log)
      const south = hardscape?.getObjectByName('flagstones-south') as Mesh | undefined;
      // the east lane's discs on the plateau (a fifth mesh, drawn only from over the plateau)
      const east = hardscape?.getObjectByName('flagstones-east') as Mesh | undefined;
      let merged: BufferGeometry | null = null;
      for (const extra of [north, expansion, south, east]) {
        if (!worldSpace(extra)) continue;
        const next = concatPositions(merged ?? slabs.geometry, extra.geometry);
        merged?.dispose();
        merged = next;
      }
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
