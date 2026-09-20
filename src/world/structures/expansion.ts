/**
 * Round 49 (expansion-2): the built things of the plaza's WEST and SOUTH-WEST dressing (layout.ts
 * `EXPANSION`) — the second tree-house round the southwest giant's bole, the far hut in the haze
 * on its bark column, and the rope fences on the south bank's lip. Everything here is behind or
 * outside every fixed camera's frustum (layout.ts `EXPANSION` header); `structures/index.ts`
 * consolidates the group apart from the hero buckets (no hero culling sphere stretches to it) and
 * hides the near group (`util/expansionLocality.ts`: beyond 60 m of the box, or when neither the
 * content nor its shadow footprint meets the camera's frustum — the shadow pass would otherwise
 * draw it in every fixed frame).
 *
 * Own rng forks, appended after every existing stream: nothing built before round 49 moves.
 */
import { Group, Mesh, Vector3, type Camera, type Material, type Sphere } from 'three';
import { EXPANSION, EXPANSION_ROPE_FENCES } from '../layout';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D } from '../util/noise';
import { EXPANSION_VISIBLE_M, casterSpheres, expansionCasters, expansionVisible, farHutCasters, frustumMeets, sunVector } from '../util/expansionLocality';
import { buildDistantHouses, type DistantHouseBuild, type DistantHouseDef } from './distantHouse';
import { buildFence, type FenceBuild } from './fence';
import { gridSurface, merge, TAU } from './geometry';
import type { StructureMaterials } from './materials';

export { EXPANSION_VISIBLE_M };

/** the two huts as `distantHouse` defs (the walkway `end` is the west-house flight's head) */
export const EXPANSION_HOUSES: DistantHouseDef[] = [
  {
    id: 'west-house',
    host: { x: EXPANSION.westHouse.host[0], z: EXPANSION.westHouse.host[1], source: "layout giantTrees 'southwest-giant'" },
    offset: [0, 0],
    floor: 1.5,
    floorAbsolute: EXPANSION.westHouse.floorY,
    radius: EXPANSION.westHouse.radius,
    wall: EXPANSION.westHouse.wall,
    capHeight: EXPANSION.westHouse.capHeight,
    capOverhang: 0.55,
    facingDeg: EXPANSION.westHouse.facingDeg,
    doorDeg: EXPANSION.westHouse.doorDeg,
    walkway: { deg: 0, length: 2, end: [...EXPANSION.westHouse.deckEnd] as [number, number, number] },
    pods: EXPANSION.westHouse.pods,
    // round 50 (structures-33): the main house's standard — the eave bough with the pod cluster
    // over the door, knotted buttresses framing it, the lit room glimpse, the cap's moss fringe
    dressing: { doorBough: { length: 2.2, pods: 3 }, buttresses: true, interior: true, fringe: true },
  },
  {
    id: 'far-hut',
    host: { x: EXPANSION.farHut.host[0], z: EXPANSION.farHut.host[1], source: 'layout EXPANSION.farHut (bark column, structures/expansion.ts)' },
    offset: [0, 0],
    floor: EXPANSION.farHut.floor,
    radius: EXPANSION.farHut.radius,
    wall: EXPANSION.farHut.wall,
    capHeight: EXPANSION.farHut.capHeight,
    facingDeg: EXPANSION.farHut.facingDeg,
    doorDeg: EXPANSION.farHut.doorDeg,
    walkway: { deg: EXPANSION.farHut.walkwayDeg, length: 2.4 },
    pods: EXPANSION.farHut.pods,
    // round 50: the far hut's lamps as pods on a short bough over its door, the lit room, the fringe
    dressing: { doorBough: { length: 1.4, pods: 2 }, interior: true, fringe: true },
  },
];

export interface ExpansionBuild {
  group: Group;
  /** the west house (with its glow + soffit) and the bank's fences: hidden by `visible()`, consolidated on its own */
  near: Group;
  /** the far hut, its column, its glow + soffit: hidden by `farVisible()` (frustum only — it is the haze's far lamp at any distance), consolidated on its own */
  far: Group;
  /** the west house's build (its walk surfaces feed the character ground) */
  houses: DistantHouseBuild;
  /** the far hut's build */
  farHouse: DistantHouseBuild;
  fences: FenceBuild[];
  bases: [number, number, number][];
  /** the far hut's column: foot (world) and top */
  column: { foot: [number, number, number]; top: [number, number, number]; triangles: number };
  /** `near`'s visibility for this camera (util/expansionLocality.ts: distance + frustum against the casters' shadow spheres) */
  visible(camera: Camera): boolean;
  /** `far`'s visibility: the hut + column (and their 27 m shadow footprint) against the frustum, no distance rule */
  farVisible(camera: Camera): boolean;
}

/**
 * The far hut's host: a plain tapered bark column (no published seat stands 45–60 m out to the
 * WNW) with three limb stubs at the crown height — a bare trunk in the haze the hut hangs on. The
 * trees lane replaces it with a real column (a COLUMN_SEATS entry within HOST_MATCH_M of the hut
 * is picked up by `resolveHost` automatically; this column then should go).
 */
function buildFarHutColumn(ctx: WorldContext, mats: StructureMaterials, rng: Rng): { mesh: Mesh; foot: Vector3; top: Vector3; triangles: number } {
  const T = EXPANSION.farHutTrunk;
  const [hx, hz] = EXPANSION.farHut.host;
  const y0 = ctx.terrain.height(hx, hz) - 0.3;
  const foot = new Vector3(hx, y0, hz);
  const top = new Vector3(hx + T.lean[0] * T.height, y0 + T.height, hz + T.lean[1] * T.height);
  const noise = new Noise2D(`${ctx.config.seed}/structures/far-hut-column`);
  const phase = rng.range(0, TAU);
  const parts = [];
  // the bole: a flared foot (× 1.35 over the first 1.2 m), bark ridges as a radial wobble, a slight lean
  parts.push(
    gridSurface(
      (u, v, out) => {
        const a = u * TAU;
        const h = v * T.height;
        const flare = 1 + 0.35 * Math.pow(Math.max(0, 1 - h / 1.2), 2);
        const r0 = (T.baseRadius + (T.topRadius - T.baseRadius) * v) * flare;
        const ridges = 1 + 0.06 * Math.sin(a * 9 + phase + h * 0.35) + 0.04 * noise.fbm(Math.cos(a) * 2 + h * 0.3, Math.sin(a) * 2 - h * 0.3, 2);
        const r = r0 * ridges;
        out.position.set(hx + T.lean[0] * h + Math.cos(a) * r, y0 + h, hz + T.lean[1] * h + Math.sin(a) * r);
        out.uv = [(a * r0) / 1.6, h / 1.6];
        const shade = 0.55 + 0.35 * (0.5 + 0.5 * Math.cos(a - 2.2)) - 0.1 * Math.max(0, 1 - h / 2.5);
        out.color = [shade, shade * 0.96, shade * 0.9];
      },
      { cols: 28, rows: 34, closedU: true },
    ),
  );
  // three limb stubs at the crown height, rising outward (the crown itself is the trees lane's)
  for (let i = 0; i < 3; i++) {
    const a = phase + (i / 3) * TAU + rng.range(-0.3, 0.3);
    const dir = new Vector3(Math.cos(a), 0.55 + rng.range(0, 0.25), Math.sin(a)).normalize();
    const len = 3.2 + rng.range(0, 1.4);
    const hy = T.crownY + rng.range(-0.8, 1.2);
    const from = new Vector3(hx + T.lean[0] * hy, y0 + hy, hz + T.lean[1] * hy);
    const rr = 0.28 - 0.03 * i;
    parts.push(
      gridSurface(
        (u, v, out) => {
          const ang = u * TAU;
          const p = from.clone().addScaledVector(dir, v * len);
          const r = rr * (1 - 0.6 * v);
          const side = new Vector3(-dir.z, 0, dir.x).normalize();
          const upv = new Vector3().crossVectors(dir, side).normalize();
          p.addScaledVector(side, Math.cos(ang) * r).addScaledVector(upv, Math.sin(ang) * r);
          out.position.copy(p);
          out.uv = [(ang * rr) / 1.6, (v * len) / 1.6];
          out.color = [0.62, 0.6, 0.55];
        },
        { cols: 10, rows: 6, closedU: true },
      ),
    );
  }
  const geo = merge(parts);
  const mesh = new Mesh(geo, mats.bark);
  mesh.name = 'far-hut-column';
  mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, foot, top, triangles: Math.floor((geo.index ? geo.index.count : geo.attributes.position.count) / 3) };
}

export function buildExpansion(ctx: WorldContext, mats: StructureMaterials, rng: Rng, rope: Material): ExpansionBuild {
  const group = new Group();
  group.name = 'structures-expansion';
  const near = new Group();
  near.name = 'structures-expansion-near';
  const far = new Group();
  far.name = 'structures-expansion-far';
  group.add(near, far);
  const bases: [number, number, number][] = [];

  // the far hut's column first: the hut's host resolves to the constants (no seat there), so the
  // column is built to the same foot the hut measures its floor from (ctx.terrain.height at the host)
  const column = buildFarHutColumn(ctx, mats, rng.fork('far-hut-column'));
  far.add(column.mesh);
  bases.push([column.foot.x, column.foot.y + 0.3, column.foot.z]);

  // the two huts, each its own pass of the distant-house builder (own streams): the builder makes
  // ONE glow mesh and one soffit mesh per pass, and the two groups are hidden independently, so
  // each hut must carry its own lamp glow
  const houses = buildDistantHouses(ctx, mats, rng.fork('houses/west'), [EXPANSION_HOUSES[0]]);
  for (const m of [...houses.group.children]) near.add(m);
  near.add(houses.glow);
  if (houses.soffit) near.add(houses.soffit);
  const farHouse = buildDistantHouses(ctx, mats, rng.fork('houses/far'), [EXPANSION_HOUSES[1]]);
  for (const m of [...farHouse.group.children]) far.add(m);
  far.add(farHouse.glow);
  if (farHouse.soffit) far.add(farHouse.soffit);

  // the bank's rope fences
  const fences = EXPANSION_ROPE_FENCES.map((f) => buildFence(f, ctx, mats, rng.fork(`fence/${f.id}`), rope));
  for (const fb of fences) {
    for (const m of fb.meshes) near.add(m);
    bases.push(...fb.bases);
  }

  // the casters' spheres plus their shadow footprints for this scene's sun (ctx.sun points at
  // its target from the sun's position: the direction toward the sun is position − target)
  // (no sun in the context — a bare harness — falls back to the config's azimuth / elevation)
  const sunToward = ctx.sun ? ctx.sun.position.clone().sub(ctx.sun.target.position).normalize() : sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
  const spheres: Sphere[] = expansionCasters().flatMap((c) => casterSpheres(c, sunToward));
  const visible = (camera: Camera) => expansionVisible(camera, spheres);
  // the far hut and its column as casters of their own (the sun's 46 m orthographic window
  // stretches 75 m along its azimuth on the ground, so the always-drawn far group rode into
  // camera A's shadow pass too: +4 draws / +10 k triangles for a hut 70 m behind it)
  const farSpheres: Sphere[] = farHutCasters(column.foot.y, column.top.y).flatMap((c) => casterSpheres(c, sunToward));
  const farVisible = (camera: Camera) => frustumMeets(camera, farSpheres);
  return {
    group,
    near,
    far,
    houses,
    farHouse,
    fences,
    bases,
    column: { foot: [column.foot.x, column.foot.y, column.foot.z], top: [column.top.x, column.top.y, column.top.z], triangles: column.triangles },
    visible,
    farVisible,
  };
}
