/**
 * The east lane (layout `EXPANSION_EAST`): the rules the legacy-built streams apply to keep its
 * houses, stepping discs and lookout clear, and the casters that decide when its meshes draw.
 *
 * The trees system post-filters its mid grove and understory with `eastTreeCrowds` /
 * `eastUnderstoryCull` (after sampling, so no other tree moves); vegetation, rocks and props go
 * through heightfield `expansionCull`, which already knows the lane's discs and trunk pads.
 *
 * Every tree these rules clear stands where none of the fixed cameras A–E sees it (the layout's
 * `EXPANSION_EAST` note); F sees the plateau's upper storey over the lip and loses a few crowns.
 */
import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three';
import { EAST_BOX, EXPANSION_EAST, eastDeckPlan, eastSteppingStones, type EastHouse } from '../layout';
import { casterSpheres, frustumMeets, type Caster } from './expansionLocality';

/** beyond this distance from the lane's box nothing of it draws (haze) */
export const EAST_VISIBLE_M = 70;
/**
 * Nor while the camera is farther than EAST_SEEN_M from every trunk with its eye under EAST_OVER_Y:
 * from below the plateau's ground (5.1–5.9 m) the lip hides the lane's ground-level work, and past
 * 35 m the houses' upper storeys show at most in glimpses through the village's canopy. Every fixed
 * camera and owner pose stands 36.9–49.6 m off under 2.7 m (the north's rise, 55 m off, puts an eye
 * at 6.05 m); the lane's own views are within 23 m; a camera high over the village keeps the lane.
 */
export const EAST_SEEN_M = 35;
export const EAST_OVER_Y = 6.5;
/** a house's detail (cap tufts and plants, trunk moss, lichen, the room) draws within this distance of its trunk */
export const EAST_DETAIL_M = 34;
/** the green between the three houses, the centre the lane's distance rules measure from */
export const EAST_GREEN = { x: 44.5, z: 3.5 };

const STONES = eastSteppingStones();
const LANE_LINES: [number, number][][] = [EXPANSION_EAST.lane, ...EXPANSION_EAST.spurs].map((l) => l.map((p) => [p[0], p[2]] as [number, number]));

/** plan distance (m) from (x, z) to the nearest centreline of the lane or its spurs */
export function eastLaneDistance(x: number, z: number): number {
  let best = Infinity;
  for (const line of LANE_LINES) {
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1];
      const dx = line[i][0] - ax;
      const dz = line[i][1] - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
  }
  return best;
}

/** the outer reach of a house's moss cap (house.ts `capR0` × rim scale + lobes, rounded up) */
export const eastCapRadius = (h: EastHouse) => h.radius * 1.5;
/** the eave height over the house's floor (house.ts `eaveY`) */
const eaveOf = (h: EastHouse) => h.roofHeight * 0.46;

/**
 * True when a tree at (x, z) of `height` m with a crown sphere of `crownR` × height centred at
 * `crownY` × height (trees/distant.ts MID_SPECS) and a bole of `trunkR` × height would crowd the
 * lane: its bole under a house's cap, its crown into a house's wall or dome (the dome modelled
 * as a quarter-ellipse from the eave to the crown, the plateau flat), or its bole on a disc.
 */
export function eastTreeCrowds(x: number, z: number, height: number, crownR: number, crownY: number, trunkR: number): boolean {
  if (x < EAST_BOX.x0 - 12 || x > EAST_BOX.x1 + 12 || z < EAST_BOX.z0 - 12 || z > EAST_BOX.z1 + 12) return false;
  const cr = crownR * height;
  const cy = crownY * height;
  const crownAt = (y: number) => Math.sqrt(Math.max(0, cr * cr - (y - cy) * (y - cy)));
  for (const h of EXPANSION_EAST.houses) {
    const d = Math.hypot(x - h.x, z - h.z);
    const capR = eastCapRadius(h);
    if (d > capR + cr + 1) continue;
    if (d < capR + trunkR * height + 0.4) return true;
    const eave = eaveOf(h);
    const top = h.roofHeight + 0.6;
    for (let y = 0; y <= eave; y += 0.25) {
      const c = crownAt(y);
      if (c > 0 && d < h.radius * 1.15 + c + 0.2) return true;
    }
    for (let y = eave; y <= top; y += 0.25) {
      const t = (y - eave) / (top - eave);
      const c = crownAt(y);
      if (c > 0 && d < capR * Math.sqrt(Math.max(0, 1 - t * t)) + c + 0.3) return true;
    }
  }
  for (const s of STONES) if (Math.hypot(x - s.x, z - s.z) < s.r + 0.8) return true;
  return lookoutNear(x, z, 1.4);
}

/**
 * True when a mid-grove tree at (x, z) (`height`, crown sphere `crownR` × height centred at
 * `crownY` × height over `groundY`) stands within `walkMin` m of the lane's or a spur's centreline
 * and none of `cameras` frames it or its shadow. The plaza's walk lines keep the grove's card
 * crowns MID_WALK_MIN_M off (trees/index.ts: nearer, they read as card piles from the path and
 * hang over it at head height); the lane gets the same rule, except for the crowns the fixed
 * cameras A–E show, which keep the frames they are scored on as built.
 */
export function eastCardCrowds(x: number, z: number, height: number, crownR: number, crownY: number, groundY: number, walkMin: number, sunDir: Vector3, cameras: Camera[]): boolean {
  if (x < EAST_BOX.x0 - walkMin || x > EAST_BOX.x1 + walkMin || z < EAST_BOX.z0 - walkMin || z > EAST_BOX.z1 + walkMin) return false;
  if (eastLaneDistance(x, z) >= walkMin) return false;
  const r = crownR * height;
  const spheres = casterSpheres({ x, z, r, y0: groundY, y1: groundY + (crownY + crownR) * height, shadow: true }, sunDir);
  return !cameras.some((c) => frustumMeets(c, spheres));
}

/** True where an understory stem at (x, z) would stand under a house's cap, on a disc or at the lookout */
export function eastUnderstoryCull(x: number, z: number): boolean {
  if (x < EAST_BOX.x0 || x > EAST_BOX.x1 || z < EAST_BOX.z0 || z > EAST_BOX.z1) return false;
  for (const h of EXPANSION_EAST.houses) if (Math.hypot(x - h.x, z - h.z) < eastCapRadius(h) + 0.8) return true;
  for (const s of STONES) if (Math.hypot(x - s.x, z - s.z) < s.r + 1.0) return true;
  return lookoutNear(x, z, 1.4);
}

function lookoutNear(x: number, z: number, m: number): boolean {
  const L = EXPANSION_EAST.lookout;
  for (const p of L.fence) if (Math.hypot(x - p[0], z - p[2]) < m) return true;
  return Math.hypot(x - L.bench.x, z - L.bench.z) < L.bench.length * 0.5 + m;
}

/**
 * One house's casters (util/expansionLocality.ts `Caster`): the trunk and cap from under the
 * floor to over the crown's plants, the tall house's deck; `groundY` = the terrain at its trunk.
 */
export function eastHouseCasters(h: EastHouse, groundY: number): Caster[] {
  const out: Caster[] = [{ x: h.x, z: h.z, r: eastCapRadius(h) + 0.3, y0: groundY - 0.6, y1: groundY + h.roofHeight + 0.9, shadow: true }];
  if (h.kind === 'tall') {
    // round the deck's outer corners, its steps' foot and the ladder's foot (structures/east.ts)
    const plan = eastDeckPlan();
    const D = EXPANSION_EAST.tallDeck;
    const pts = [plan.at(D.outer, -D.half), plan.at(D.outer, D.half), plan.steps.bottom, plan.at(3.95, D.half + 0.55)];
    const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const z = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const r = Math.max(...pts.map((p) => Math.hypot(p[0] - x, p[1] - z))) + 0.5;
    out.push({ x, z, r, y0: groundY - 0.3, y1: groundY + 2.4, shadow: true });
  }
  return out;
}

/** The lookout's casters: its fence posts (all three runs), bench and stumps (`groundAt` samples the terrain) */
export function eastLookoutCasters(groundAt: (x: number, z: number) => number): Caster[] {
  const L = EXPANSION_EAST.lookout;
  const out: Caster[] = [...L.fence, ...L.westRun, ...L.eastRun].map((p) => ({ x: p[0], z: p[2], r: 0.5, y0: groundAt(p[0], p[2]) - 0.15, y1: groundAt(p[0], p[2]) + 1.25, shadow: true }));
  out.push({ x: L.bench.x, z: L.bench.z, r: L.bench.length * 0.5 + 0.3, y0: groundAt(L.bench.x, L.bench.z) - 0.2, y1: groundAt(L.bench.x, L.bench.z) + 0.7, shadow: true });
  for (const a of L.anchors) out.push({ x: a.x, z: a.z, r: a.r + 0.3, y0: groundAt(a.x, a.z) - 0.45, y1: groundAt(a.x, a.z) + a.height + 0.1, shadow: true });
  return out;
}

/** The shop's sign post (with its arm and hanging board) and the pod-lantern posts */
export function eastPostCasters(groundAt: (x: number, z: number) => number): Caster[] {
  const S = EXPANSION_EAST.shopSign;
  return [
    { x: S.x, z: S.z, r: 1.3, y0: groundAt(S.x, S.z) - 0.4, y1: groundAt(S.x, S.z) + S.height + 0.3, shadow: true },
    ...EXPANSION_EAST.lanternPosts.map((p) => ({ x: p.x, z: p.z, r: 0.9, y0: groundAt(p.x, p.z) - 0.4, y1: groundAt(p.x, p.z) + p.height + 0.4, shadow: true })),
  ];
}

export function eastSpheres(casters: Caster[], sunDir: Vector3): Sphere[] {
  return casters.flatMap((c) => casterSpheres(c, sunDir));
}

/**
 * The index range (start, count) that draws the runs flagged in `on` out of a bucket whose runs
 * lie one after another (`ends[k]` = where run k's indices end): from the first flagged run's
 * start to the last one's end, the runs between included. Nothing flagged draws nothing.
 */
export function eastRunRange(on: readonly boolean[], ends: readonly number[]): [number, number] {
  const first = on.indexOf(true);
  if (first < 0) return [0, 0];
  const last = on.lastIndexOf(true);
  const start = first === 0 ? 0 : ends[first - 1];
  return [start, ends[last] - start];
}

const _m = new Matrix4();
const _f = new Frustum();
const _p = new Vector3();

/** distance (m) from (x, z) to the lane's box in plan */
export function eastBoxDistanceAt(x: number, z: number): number {
  const dx = Math.max(EAST_BOX.x0 - x, 0, x - EAST_BOX.x1);
  const dz = Math.max(EAST_BOX.z0 - z, 0, z - EAST_BOX.z1);
  return Math.hypot(dx, dz);
}

/** distance (m) from the camera to the lane's box in plan */
export function eastBoxDistance(camera: Camera): number {
  camera.getWorldPosition(_p);
  return eastBoxDistanceAt(_p.x, _p.z);
}

/** plan distance (m) from (x, z) to the nearest house's trunk axis */
export function eastTrunkDistance(x: number, z: number): number {
  return Math.min(...EXPANSION_EAST.houses.map((h) => Math.hypot(x - h.x, z - h.z)));
}

/** whether the lane may draw at all for an eye at `p` (EAST_VISIBLE_M, EAST_SEEN_M, EAST_OVER_Y); the frustum and sight tests come after */
export function eastInReach(p: { x: number; y: number; z: number }): boolean {
  return eastBoxDistanceAt(p.x, p.z) < EAST_VISIBLE_M && (p.y > EAST_OVER_Y || eastTrunkDistance(p.x, p.z) < EAST_SEEN_M);
}

/** true when the camera is within `within` m (plan) of (x, z) and its frustum meets one of `spheres` (world matrix refreshed first) */
export function eastVisible(camera: Camera, spheres: Sphere[], x: number, z: number, within: number): boolean {
  camera.updateMatrixWorld();
  camera.getWorldPosition(_p);
  if (Math.hypot(_p.x - x, _p.z - z) > within) return false;
  _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _f.setFromProjectionMatrix(_m);
  for (const s of spheres) if (_f.intersectsSphere(s)) return true;
  return false;
}
