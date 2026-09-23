/**
 * The east lane's built things (layout `EXPANSION_EAST`): three tree-trunk houses on the plateau
 * the main stairway climbs to — the SHOP (a counter window under a propped plank shutter, goods on
 * the counter, a carved sign hanging from a post by the lane, crates, baskets and a stick bundle by
 * the door), the bossy kid's TALL house (the tallest dome, a plank deck on log posts with a
 * railing, plank steps down toward its door and a short ladder at the far end) and a SMALL cosy
 * house (low dome, round window, two flower boxes) — two pod-lantern posts, and the lookout's rope
 * fence and split-log bench on the south lip.
 *
 * The houses are `buildHouse` builds: the trunk, cap, roots, pods and room of Saria's and the upper
 * house. Their point lights are dropped: a light joining or leaving the scene recompiles every lit
 * program, and the lane hides by distance — the pods, the room glow and the window sockets are
 * emissive and carry the warmth. The deck's strip and steps go to `ctx.shared.walkSurfaces`; its
 * railing, the posts and the bench are walls in the live structure mask (heightfield.ts).
 *
 * Tiers (structures/index.ts consolidates each group on its own and calls `update`):
 *  - `core`: the houses' trunks and caps — one bucket per material across the lane, drawn within
 *    EAST_VISIBLE_M of the lane's box when the frustum meets its casters or their shadows;
 *  - `base`: the houses' roots, porches, thresholds, door and window frames and rooms and the
 *    counter's niche (everything that closes an opening in a trunk), with `core` while the camera is
 *    within EAST_MID_M of the green or the terrain lets it see a house's foot (`eastFootSeen`:
 *    camera F on the plaza sees over the plateau's lip, its lee on the plain does not);
 *  - `mid`: the counter's woodwork, the sign, the deck, the posts' wood, the lookout's fence and
 *    bench, with `base` when the frustum meets them;
 *  - `near[i]`: house i's close detail (cap tufts and plants, trunk moss and lichen, the room's
 *    furniture, the pods, the goods, the crates, the flowers) within EAST_DETAIL_M of its trunk;
 *  - `lane`: the posts' pods and the lookout's moss and plants, within EAST_DETAIL_M of the green.
 *
 * Own rng forks (structures / 'east' / …), after every existing stream: nothing built before moves.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  LatheGeometry,
  type Material,
  Matrix4,
  Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  Raycaster,
  type Sphere,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Camera,
} from 'three';
import { EXPANSION_EAST, eastDeckPlan, eastShopSpots, eastSteppingStones, type EastHouse, type LanternPostDef } from '../layout';
import { applyShadeFloor } from '../materials/shadeFloor';
import type { WalkSurface, WorldContext } from '../system';
import { EAST_DETAIL_M, EAST_GREEN, EAST_MID_M, EAST_VISIBLE_M, eastBoxDistance, eastFootSeen, eastHouseCasters, eastLookoutCasters, eastPostCasters, eastSpheres } from '../util/eastLane';
import { frustumMeets, sunVector, type Caster } from '../util/expansionLocality';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { buildFence, type FenceBuild } from './fence';
import { FoliageBuilder } from './foliage';
import { consolidateStaticMeshes, merge, setColorAttribute, sweepTube, TAU } from './geometry';
import { glyphDistance, type GlyphStroke } from './glyphs';
import { buildHouse, type HouseBuild, type HouseSharedMaterials } from './house';
import type { LanternRig } from './lantern';
import { buildLanternPost } from './lanternPost';
import { Noise3D, type StructureMaterials } from './materials';
import { buildMossTufts, type MossTuftSpec } from './mossTufts';
import { grainPlank } from './signpost';
import { checkedCap, endFrame, footMoss } from './woodGrain';

type P3 = [number, number, number];
type RGB = [number, number, number];

const UP = new Vector3(0, 1, 0);

/** a house's parts that draw only near it (names from house.ts; foliage builders by prefix) */
const HOUSE_NEAR = /^(roof-tufts|trunk-moss-tufts|trunk-lichen|interior-props|interior-furnishing|interior-rug|door-lamp|door-lamp-cord|door-embers|door-ember-glow|lantern-peg|lantern-hanger)$|^house-.+-(tufts|flowers)$|^house(21|40|41)-.+$/;
/** a house's parts at the foot of its trunk, no higher than its window's head (names from house.ts) */
const HOUSE_BASE = /^(roots|roots-arch|porch|threshold|door-frame|window-frame|window-socket|interior)$/;

/** the shop's counter window: angle round the trunk from the door, clear width, sill and head over the floor */
const COUNTER = { a: 1.02, w: 1.25, y0: 0.92, y1: 1.72 };

/** An original carved emblem for the shop's board: a round jar with a sprouting leaf, a border line. */
function shopGlyph(aspect: number): GlyphStroke[] {
  const hw = 0.016;
  const out: GlyphStroke[] = [];
  const seg = (a: [number, number], b: [number, number], w = hw) => out.push({ a, b, hw: w });
  // the jar's body: an 11-sided ring (y scaled by the decal's aspect so it is round on the board)
  const cx = 0.5;
  const cy = 0.4;
  const rho = 0.135;
  const n = 11;
  const ring: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + ((i + 0.5) / n) * TAU;
    ring.push([cx + rho * Math.cos(t), cy + rho * aspect * Math.sin(t)]);
  }
  // open at the top for the neck
  for (let i = 0; i < n; i++) {
    const mid = (i + 1) / n;
    if (Math.abs(mid - 0.5) < 0.06) continue;
    seg(ring[i], ring[i + 1]);
  }
  const top = cy + rho * aspect;
  const neckY = top - 0.035 * aspect;
  seg([cx - 0.045, neckY], [cx - 0.045, top + 0.07 * aspect]);
  seg([cx + 0.045, neckY], [cx + 0.045, top + 0.07 * aspect]);
  seg([cx - 0.08, top + 0.075 * aspect], [cx + 0.08, top + 0.075 * aspect]);
  // a band round the belly and three seeds in it
  seg([cx - rho * 0.86, cy + 0.02 * aspect], [cx + rho * 0.86, cy + 0.02 * aspect], hw * 0.8);
  for (const k of [-1, 0, 1]) seg([cx + k * 0.05, cy - 0.05 * aspect], [cx + k * 0.05 + 0.004, cy - 0.07 * aspect], hw * 0.9);
  // the sprout: a stem curling up out of the neck and a pointed leaf
  const s0: [number, number] = [cx, top + 0.075 * aspect];
  const s1: [number, number] = [cx + 0.03, top + 0.13 * aspect];
  const s2: [number, number] = [cx + 0.085, top + 0.175 * aspect];
  seg(s0, s1, hw * 0.85);
  seg(s1, s2, hw * 0.85);
  const tip: [number, number] = [cx + 0.2, top + 0.2 * aspect];
  seg(s2, [cx + 0.14, top + 0.235 * aspect], hw * 0.8);
  seg([cx + 0.14, top + 0.235 * aspect], tip, hw * 0.8);
  seg(s2, [cx + 0.15, top + 0.15 * aspect], hw * 0.8);
  seg([cx + 0.15, top + 0.15 * aspect], tip, hw * 0.8);
  seg(s2, tip, hw * 0.45);
  // border, inset from the board's edge
  const bx0 = 0.05;
  const bx1 = 0.95;
  const by0 = 0.08;
  const by1 = 0.92;
  seg([bx0, by0], [bx1, by0], hw * 0.7);
  seg([bx1, by0], [bx1, by1], hw * 0.7);
  seg([bx1, by1], [bx0, by1], hw * 0.7);
  seg([bx0, by1], [bx0, by0], hw * 0.7);
  return out;
}

interface Site {
  h: EastHouse;
  /** the trunk's axis at the door's floor level (house.ts `yFloor`) */
  C: Vector3;
  F: Vector3;
  Rt: Vector3;
  floor: number;
}

function siteOf(h: EastHouse, ctx: WorldContext): Site {
  const f = (h.facingDeg * Math.PI) / 180;
  const F = new Vector3(Math.sin(f), 0, Math.cos(f));
  const Rt = new Vector3(F.z, 0, -F.x);
  const floor = ctx.terrain.height(h.x + F.x * h.radius * 1.15, h.z + F.z * h.radius * 1.15);
  return { h, C: new Vector3(h.x, floor, h.z), F, Rt, floor };
}

/** horizontal direction `a` rad round the trunk from the door (+ = the viewer's right facing it) */
const dirAt = (s: Site, a: number) => new Vector3().addScaledVector(s.F, Math.cos(a)).addScaledVector(s.Rt, Math.sin(a));
/** the tangent toward increasing angle */
const tanAt = (d: Vector3) => new Vector3(d.z, 0, -d.x);

/** the trunk frame at angle `a`: local x along the tangent, y up from the floor, z out from the axis */
function wallFrame(s: Site, a: number): { M: Matrix4; d: Vector3; T: Vector3 } {
  const d = dirAt(s, a);
  const T = tanAt(d);
  return { M: new Matrix4().makeBasis(T, UP, d).setPosition(s.C), d, T };
}

const _ray = new Raycaster();

/** how far out from the axis the bark stands along `d`, `lat` m along the tangent, `y` over the floor (null through a hole) */
function barkOut(s: Site, shell: Mesh[], d: Vector3, lat: number, y: number): number | null {
  const reach = s.h.radius * 2.6;
  const o = s.C.clone().addScaledVector(d, reach).addScaledVector(tanAt(d), lat);
  o.y = s.floor + y;
  _ray.set(o, d.clone().negate());
  _ray.near = 0;
  _ray.far = reach;
  const hit = _ray.intersectObjects(shell, false)[0];
  return hit ? reach - hit.distance : null;
}

/** drop the triangles whose centroid passes `inside` (indexed geometry); returns the count */
function cutTriangles(mesh: Mesh, inside: (c: Vector3) => boolean): number {
  const g = mesh.geometry;
  const idx = g.index;
  if (!idx) return 0;
  const pos = g.attributes.position;
  const keep: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let cut = 0;
  for (let i = 0; i < idx.count; i += 3) {
    const ia = idx.getX(i);
    const ib = idx.getX(i + 1);
    const ic = idx.getX(i + 2);
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    if (inside(a.add(b).add(c).multiplyScalar(1 / 3))) {
      cut++;
      continue;
    }
    keep.push(ia, ib, ic);
  }
  if (cut) g.setIndex(keep);
  return cut;
}

function meshOf(name: string, mat: Material, parts: BufferGeometry[], cast = true): Mesh | null {
  const list = parts.filter((g) => g && g.attributes.position && g.attributes.position.count > 0);
  if (!list.length) return null;
  const m = new Mesh(merge(list), mat);
  m.name = name;
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

const tri = (g: BufferGeometry) => Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);

/** a grained plank `len` along local x, `wid` along y, `thick` along z (grain relief on ± z) */
function plank(len: number, wid: number, thick: number, rng: Rng, noise: Noise2D, base: RGB, relief = 0.003): BufferGeometry {
  const g = new BoxGeometry(len, wid, thick, Math.max(2, Math.round(len / 0.035)), Math.max(1, Math.round(wid / 0.035)), 1);
  grainPlank(g, len, wid, thick, rng, noise, base, relief);
  return g;
}

/** a flat-lying board: `len` along x, `wid` along z, `thick` along y (the grained faces up / down) */
function board(len: number, wid: number, thick: number, rng: Rng, noise: Noise2D, base: RGB): BufferGeometry {
  const g = plank(len, wid, thick, rng, noise, base);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** an upright member: `len` along y, `wid` along x, `thick` along z (grain along its length) */
function upright(len: number, wid: number, thick: number, rng: Rng, noise: Noise2D, base: RGB): BufferGeometry {
  const g = plank(len, wid, thick, rng, noise, base);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** a barked pole along `pts` (the rope-fence posts' look): r0 at the start, r1 at the end */
function pole(pts: Vector3[], r0: number, r1: number, noise: Noise2D, seed: number, capEnd = true): BufferGeometry {
  const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const len = curve.getLength();
  return sweepTube(curve, {
    radius: (t) => lerp(r0, r1, t) * (1 + 0.05 * Math.sin(t * 9 + seed)),
    tubularSegments: Math.max(4, Math.round(len / 0.12)),
    radialSegments: 10,
    uvMetres: 0.7,
    displace: (t, ang) => (noise.ridged(ang * 1.3 + seed, t * len * 1.4, 2) - 0.5) * 0.012,
    color: (t, ang) => {
      const furrow = lerp(0.62, 1.08, noise.ridged(ang * 1.3 + seed, t * len * 1.4, 2));
      const k = (0.55 + 0.25 * Math.max(0, Math.sin(ang))) * furrow;
      return [k, k * 0.92, k * 0.82];
    },
    capEnd,
    capStart: capEnd,
  });
}

/** a clay pot or jar (lathe), open at the neck, standing on y = 0 */
function pot(h: number, r: number, rng: Rng, color: RGB): BufferGeometry {
  const neck = 0.55 + rng() * 0.15;
  const pts = [
    new Vector2(0, 0),
    new Vector2(r * 0.62, 0),
    new Vector2(r * 0.92, h * 0.18),
    new Vector2(r, h * 0.45),
    new Vector2(r * 0.86, h * 0.72),
    new Vector2(r * neck, h * 0.9),
    new Vector2(r * (neck + 0.1), h),
    new Vector2(r * (neck - 0.05), h),
    new Vector2(r * (neck - 0.12), h * 0.86),
  ];
  const g = new LatheGeometry(pts, 14);
  const pos = g.attributes.position;
  setColorAttribute(g, (i) => {
    const y = pos.getY(i) / h;
    const k = (0.82 + 0.18 * y) * (1 - 0.35 * smoothstep(0.88, 1, y) * (pos.getX(i) ** 2 + pos.getZ(i) ** 2 < (r * neck) ** 2 ? 1 : 0));
    return [color[0] * k, color[1] * k, color[2] * k];
  });
  return g;
}

/** a woven basket (lathe with a weave in the tint and a rim roll), standing on y = 0 */
function basket(h: number, r: number, rng: Rng): BufferGeometry[] {
  const pts = [
    new Vector2(0, 0),
    new Vector2(r * 0.7, 0),
    new Vector2(r * 0.9, h * 0.3),
    new Vector2(r, h * 0.8),
    new Vector2(r * 1.02, h),
    new Vector2(r * 0.95, h),
    new Vector2(r * 0.92, h * 0.8),
    new Vector2(r * 0.8, h * 0.3),
    new Vector2(0, h * 0.12),
  ];
  const body = new LatheGeometry(pts, 28);
  const pos = body.attributes.position;
  const hue = 0.9 + rng() * 0.2;
  setColorAttribute(body, (i) => {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const weave = Math.sin(ang * 14) * Math.sin((y / h) * Math.PI * 7);
    const k = 0.78 + 0.22 * Math.sign(weave) * Math.min(1, Math.abs(weave) * 3);
    return [0.74 * k * hue, 0.58 * k, 0.32 * k];
  });
  const rim = new TorusGeometry(r * 0.985, 0.014, 5, 28);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, h, 0);
  setColorAttribute(rim, [0.6, 0.46, 0.24]);
  return [body, rim];
}

/** fruit / roots heaped in a container top at height `y` inside radius `r` */
function heap(center: Vector3, y: number, r: number, count: number, rng: Rng, palette: RGB[]): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const rr = r * Math.sqrt(rng()) * 0.8;
    const fr = 0.04 + rng() * 0.018;
    const g = new SphereGeometry(fr, 9, 7);
    g.scale(1, 0.88 + rng() * 0.2, 1);
    const c = palette[Math.floor(rng() * palette.length) % palette.length];
    const k = 0.85 + rng() * 0.3;
    const gp = g.attributes.position;
    setColorAttribute(g, (j) => {
      const up = gp.getY(j) / fr;
      const s = k * (0.8 + 0.25 * up);
      return [c[0] * s, c[1] * s, c[2] * s];
    });
    g.translate(center.x + Math.cos(a) * rr, y + fr * (0.6 + 0.9 * (1 - rr / r)), center.z + Math.sin(a) * rr);
    out.push(g);
  }
  return out;
}

const FRUIT: RGB[] = [
  [0.62, 0.1, 0.06],
  [0.78, 0.36, 0.06],
  [0.5, 0.56, 0.12],
  [0.7, 0.16, 0.1],
];

export interface EastBuild {
  group: Group;
  core: Group;
  base: Group;
  mid: Group;
  near: Group[];
  lane: Group;
  lanterns: LanternRig[];
  walk: WalkSurface[];
  bases: P3[];
  /** materials this build created (house clones, goods, glow), disposed by the system */
  owned: { dispose(): void }[];
  /** consolidate each tier on its own (after the camera solids are voxelised) */
  consolidate(): { before: number; after: number; merged: number };
  /** tier visibility for this camera */
  update(camera: Camera): void;
  audit(): Record<string, unknown>;
}

export function buildEast(ctx: WorldContext, mats: StructureMaterials, rng: Rng, rope: Material, shared: HouseSharedMaterials): EastBuild {
  const group = new Group();
  group.name = 'structures-east';
  const core = new Group();
  core.name = 'structures-east-core';
  const base = new Group();
  base.name = 'structures-east-base';
  const mid = new Group();
  mid.name = 'structures-east-mid';
  const lane = new Group();
  lane.name = 'structures-east-lane';
  group.add(core, base, mid, lane);
  const lanterns: LanternRig[] = [];
  const walk: WalkSurface[] = [];
  const bases: P3[] = [];
  const owned: { dispose(): void }[] = [];
  const terrain = ctx.terrain;
  const noise = new Noise2D(`${ctx.config.seed}/structures/east`);
  const stones = eastSteppingStones();
  const plan = eastDeckPlan();
  const D = EXPANSION_EAST.tallDeck;

  // goods (pots, fruit, the basket weave): one plain vertex-coloured material with a clay-like shade floor
  const goods = applyShadeFloor(new MeshStandardMaterial({ vertexColors: true, roughness: 0.66 }), { lift: 4, texture: 1.0, canopy: 0.6, albedo: 0.12, chroma: 0.8 });
  goods.name = 'structures:east-goods';
  owned.push(goods);
  // the counter's lit back wall: the window sockets' glow, vertex-tinted
  const glow = mats.windowGlow.clone() as MeshBasicMaterial;
  glow.vertexColors = true;
  owned.push(glow);

  // ---- the three houses ----
  const sites = EXPANSION_EAST.houses.map((h) => siteOf(h, ctx));
  /** the roots keep off the paving, the deck's posts and steps, the ladder's foot and the white-barks' boles */
  const keepOut: { x: number; z: number; r: number }[] = [
    ...stones.map((st) => ({ x: st.x, z: st.z, r: st.r + 0.45 })),
    ...(ctx.shared.slimTrunks ?? []).filter((t) => t.x > 25).map((t) => ({ x: t.x, z: t.z, r: t.r + 0.35 })),
    ...eastShopSpots().map((g) => ({ x: g.x, z: g.z, r: g.foot + 0.3 })),
  ];
  for (const along of [-D.half + 0.06, 0, D.half - 0.06]) keepOut.push({ x: plan.at(D.outer - 0.1, along)[0], z: plan.at(D.outer - 0.1, along)[1], r: 0.55 });
  for (let u = 0; u <= 1.001; u += 0.25) {
    const p = plan.at((D.stepInner + D.stepOuter) / 2, -D.half - D.stepRun * u);
    keepOut.push({ x: p[0], z: p[1], r: 0.62 });
  }
  const ladderFoot = plan.at(3.95, D.half + 0.55);
  keepOut.push({ x: ladderFoot[0], z: ladderFoot[1], r: 0.5 });

  const houses: HouseBuild[] = [];
  const near: Group[] = [];
  let lightsDropped = 0;
  let movedNear = 0;
  EXPANSION_EAST.houses.forEach((h, i) => {
    const s = sites[i];
    const hb = buildHouse(
      { id: h.id, position: [h.x, terrain.height(h.x, h.z), h.z], trunkRadius: h.radius, facing: [s.F.x, s.F.z], roofHeight: h.roofHeight, lanterns: h.lanterns },
      ctx,
      mats,
      rng.fork(`house/${h.id}`),
      shared,
      { rootKeepOut: keepOut },
    );
    houses.push(hb);
    for (const l of hb.lights) {
      l.removeFromParent();
      l.dispose();
      lightsDropped++;
    }
    owned.push(...hb.materials);
    lanterns.push(...hb.lanterns);
    bases.push(...hb.bases);
    const g = new Group();
    g.name = `structures-east-near-${h.id}`;
    near.push(g);
    group.add(g);
  });

  // ---- the shop: counter window, shutter, goods; crates and baskets by the door; the sign ----
  const shopI = EXPANSION_EAST.houses.findIndex((h) => h.kind === 'shop');
  const shop = sites[shopI];
  const shopHb = houses[shopI];
  const shopNear = near[shopI];
  const counterAudit = (() => {
    const s = shop;
    const hb = shopHb;
    const { a, w: W, y0, y1 } = COUNTER;
    const { M, d, T } = wallFrame(s, a);
    const shell = ['trunk', 'trunk-eave-band'].map((n) => hb.group.getObjectByName(n) as Mesh | undefined).filter((m): m is Mesh => !!m);
    let outMax = -Infinity;
    let outMin = Infinity;
    for (const lat of [-W / 2 - 0.12, -W / 4, 0, W / 4, W / 2 + 0.12]) {
      for (const y of [y0 - 0.12, (y0 + y1) / 2, y1 + 0.12]) {
        const o = barkOut(s, shell, d, lat, y);
        if (o === null) continue;
        outMax = Math.max(outMax, o);
        outMin = Math.min(outMin, o);
      }
    }
    if (!Number.isFinite(outMax)) {
      outMax = s.h.radius + 0.12;
      outMin = s.h.radius - 0.12;
    }
    const local = (p: Vector3) => {
      const q = p.clone().sub(s.C);
      return { x: q.dot(T), y: p.y - s.floor, z: q.dot(d) };
    };
    let cut = 0;
    for (const m of shell) cut += cutTriangles(m, (c) => {
      const l = local(c);
      return l.z > 0 && Math.abs(l.x) < W / 2 && l.y > y0 && l.y < y1;
    });
    let cutDetail = 0;
    hb.group.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (m.name === 'trunk-moss-tufts' || m.name === 'trunk-lichen') {
        cutDetail += cutTriangles(m, (c) => {
          const l = local(c);
          return l.z > outMin - 0.3 && l.z < outMax + 0.3 && Math.abs(l.x) < W / 2 + 0.16 && l.y > y0 - 0.18 && l.y < y1 + 0.18;
        });
      } else if (m.material === mats.leaf || m.material === mats.vine || m.material === mats.tuft || m.material === mats.flower) {
        // nothing hangs through the shutter or in front of the counter
        cutDetail += cutTriangles(m, (c) => {
          const l = local(c);
          return l.z > outMin - 0.2 && l.z < outMax + 1.25 && Math.abs(l.x) < W / 2 + 0.42 && l.y > y0 - 0.4 && l.y < y1 + 1.1;
        });
      }
    });

    const rC = rng.fork('counter');
    const wood: BufferGeometry[] = [];
    const tiny: BufferGeometry[] = [];
    const place = (g: BufferGeometry, x: number, y: number, z: number) => {
      g.translate(x, y, z);
      g.applyMatrix4(M);
      return g;
    };
    const H = y1 - y0;
    const zF = outMax + 0.02;
    const zB = outMin - 0.56;
    // the niche behind the opening (the room material renders its inside faces)
    const niche = new BoxGeometry(W + 0.04, H + 0.04, zF - zB);
    place(niche, 0, (y0 + y1) / 2, (zF + zB) / 2);
    const nicheMesh = meshOf('east-counter-niche', mats.interior, [niche], false);
    if (nicheMesh) base.add(nicheMesh);
    // its back wall lit by an unseen lamp (dim, warm, brightest low left behind the goods)
    const back = new PlaneGeometry(W * 0.96, H * 0.94, 16, 10);
    const bp = back.attributes.position;
    setColorAttribute(back, (i) => {
      const x = bp.getX(i) / (W * 0.48) + 0.25;
      const y = bp.getY(i) / (H * 0.47) + 0.2;
      const g = 0.36 * (1 - 0.72 * clamp(x * x * 0.8 + y * y, 0, 1));
      return [g, g * 0.93, g * 0.85];
    });
    place(back, 0, (y0 + y1) / 2, zB + 0.014);
    const backMesh = meshOf('east-counter-glow', glow, [back], false);
    if (backMesh) base.add(backMesh);
    // a shelf across the niche with jars dark against the glow
    wood.push(place(board(W - 0.02, 0.24, 0.03, rC.fork('shelf'), noise, [0.55, 0.48, 0.38]), 0, y0 + 0.4, zB + 0.13));
    const shelfGoods: BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const jh = 0.13 + rC() * 0.1;
      const jr = 0.045 + rC() * 0.025;
      const col: RGB = k % 2 ? [0.42, 0.26, 0.16] : [0.3, 0.36, 0.3];
      shelfGoods.push(place(pot(jh, jr, rC, col), -W / 2 + 0.16 + k * ((W - 0.32) / 4) + (rC() - 0.5) * 0.05, y0 + 0.415, zB + 0.12 + (rC() - 0.5) * 0.04));
    }
    // the frame: jambs, head and sill proud of the bark
    const fw = 0.11;
    const zf0 = outMin - 0.12;
    const zf1 = outMax + 0.1;
    const fdep = zf1 - zf0;
    const frameTint: RGB = [0.74, 0.66, 0.54];
    for (const side of [-1, 1]) {
      const jamb = upright(H + 2 * fw, fdep, fw, rC.fork(`jamb/${side}`), noise, frameTint);
      jamb.rotateY(Math.PI / 2);
      wood.push(place(jamb, side * (W / 2 + fw / 2), (y0 + y1) / 2, (zf0 + zf1) / 2));
    }
    const head = plank(W + 2 * fw + 0.08, fw, fdep + 0.02, rC.fork('head'), noise, frameTint);
    wood.push(place(head, 0, y1 + fw / 2, (zf0 + zf1) / 2 + 0.01));
    const sill = plank(W + 2 * fw, fw, fdep, rC.fork('sill'), noise, frameTint);
    wood.push(place(sill, 0, y0 - fw / 2, (zf0 + zf1) / 2));
    // the counter: a thick board out over the lane on two braces
    const zc0 = outMin - 0.05;
    const zc1 = outMax + 0.44;
    wood.push(place(board(W + 0.52, zc1 - zc0, 0.06, rC.fork('counter'), noise, [0.86, 0.76, 0.6]), 0, y0 + 0.004 - 0.03, (zc0 + zc1) / 2));
    for (const side of [-1, 1]) {
      const x = side * (W / 2 - 0.08);
      const a0 = new Vector3(x, y0 - 0.52, outMin + 0.04).applyMatrix4(M);
      const a1 = new Vector3(x, y0 - 0.3, outMax + 0.14).applyMatrix4(M);
      const a2 = new Vector3(x, y0 - 0.07, outMax + 0.36).applyMatrix4(M);
      wood.push(pole([a0, a1, a2], 0.034, 0.028, noise, 3 + side));
    }
    // the shutter: five boards on two battens, hinged at the head and propped up and out on two sticks
    const fl = new Vector3().addScaledVector(UP, 0.42).addScaledVector(d, 0.906).normalize();
    const fz = new Vector3().crossVectors(T, fl);
    const hinge = s.C.clone().addScaledVector(d, outMax + 0.1);
    hinge.y = s.floor + y1 + fw;
    const Mf = new Matrix4().makeBasis(T, fl, fz).setPosition(hinge);
    const FW = W + 0.26;
    const L = 0.92;
    const nb = 5;
    for (let k = 0; k < nb; k++) {
      const bw = FW / nb - 0.012;
      const g = plank(L - rC() * 0.04, bw, 0.042, rC.fork(`shutter/${k}`), noise, [0.8, 0.7, 0.55]);
      g.rotateZ(Math.PI / 2);
      g.translate(-FW / 2 + (k + 0.5) * (FW / nb), L / 2, 0);
      g.applyMatrix4(Mf);
      wood.push(g);
    }
    for (const v of [0.16, L - 0.16]) {
      const bat = plank(FW - 0.08, 0.075, 0.034, rC.fork(`batten/${v}`), noise, [0.62, 0.54, 0.42]);
      bat.translate(0, v, 0.038);
      bat.applyMatrix4(Mf);
      wood.push(bat);
    }
    for (const side of [-1, 1]) {
      const x = side * (W / 2 - 0.05);
      const foot = new Vector3(x, y0 + 0.004, outMax + 0.38).applyMatrix4(M);
      const top = new Vector3(x, L - 0.1, 0.055).applyMatrix4(Mf);
      wood.push(pole([foot, foot.clone().lerp(top, 0.5), top], 0.02, 0.018, noise, 7 + side));
    }
    const woodMesh = meshOf('window-frame', mats.fenceWood, wood);
    if (woodMesh) mid.add(woodMesh);
    // goods on the counter: two pots, a basket of fruit, a bundle of roots
    const onTop = y0 + 0.004;
    const zg = outMax + 0.2;
    tiny.push(place(pot(0.2, 0.085, rC, [0.62, 0.3, 0.16]), -0.42, onTop, zg));
    tiny.push(place(pot(0.15, 0.07, rC, [0.28, 0.42, 0.38]), -0.24, onTop, zg + 0.07));
    const bk = basket(0.1, 0.16, rC);
    for (const g of bk) tiny.push(place(g, 0.12, onTop, zg - 0.02));
    const fruitAt = new Vector3(0.12, 0, zg - 0.02);
    for (const g of heap(fruitAt, onTop + 0.07, 0.15, 9, rC, FRUIT)) tiny.push(place(g, 0, 0, 0));
    tiny.push(place(pot(0.24, 0.075, rC, [0.55, 0.34, 0.2]), 0.47, onTop, zg + 0.04));
    const goodsMesh = meshOf('east-counter-goods', goods, [...tiny, ...shelfGoods]);
    if (goodsMesh) shopNear.add(goodsMesh);
    return { angle: a, width: W, sill: y0, head: y1, barkOut: [+outMin.toFixed(3), +outMax.toFixed(3)], trunkTrianglesCut: cut, detailTrianglesCut: cutDetail, shutterBoards: nb };
  })();

  // crates, baskets and a stick bundle by the shop door (layout `shopGoods`: outside the trunk's
  // foot flare, walls in the live mask, the roots kept off them); the audit reports what of the
  // house stands over each footprint (roots, flare, porch — expect none) and the nearest disc
  const blockers = ['roots', 'roots-arch', 'trunk', 'porch', 'threshold', 'door-frame', 'trunk-eave-band'];
  const overlap = (hb: HouseBuild, p: Vector3, fp: number): number => {
    const targets = blockers.map((n) => hb.group.getObjectByName(n) as Mesh | undefined).filter((m): m is Mesh => !!m);
    let hits = 0;
    for (let k = 0; k <= 8; k++) {
      const q = k === 0 ? p.clone() : p.clone().add(new Vector3(Math.cos((k / 8) * TAU) * fp, 0, Math.sin((k / 8) * TAU) * fp));
      const gy = terrain.height(q.x, q.z);
      _ray.set(new Vector3(q.x, gy + 3.2, q.z), new Vector3(0, -1, 0));
      _ray.near = 0;
      _ray.far = 3.3;
      const hit = _ray.intersectObjects(targets, false)[0];
      if (hit && hit.point.y > gy + 0.03) hits++;
    }
    return hits;
  };

  const crateAudit = (() => {
    const s = shop;
    const rK = rng.fork('crates');
    const wood: BufferGeometry[] = [];
    const tiny: BufferGeometry[] = [];
    const placed: Vector3[] = [];
    const out: { kind: string; at: P3; overlap: number; discGap: number }[] = [];
    const record = (kind: string, p: Vector3, y: number, fp: number) => {
      let gap = Infinity;
      for (const st of stones) gap = Math.min(gap, Math.hypot(p.x - st.x, p.z - st.z) - st.r - fp);
      out.push({ kind, at: [+p.x.toFixed(2), +y.toFixed(2), +p.z.toFixed(2)], overlap: overlap(shopHb, p, fp), discGap: +gap.toFixed(2) });
    };
    /** a slatted crate at `p` (yaw `yaw`), bottom at `y`; `open` shows produce */
    const crate = (p: Vector3, y: number, yaw: number, w: number, h: number, dp: number, open: boolean) => {
      const M = new Matrix4().makeRotationY(yaw).setPosition(p.x, y, p.z);
      const push = (g: BufferGeometry, x: number, yy: number, z: number) => {
        g.translate(x, yy, z);
        g.applyMatrix4(M);
        wood.push(g);
      };
      const shade = () => 0.62 + rK() * 0.22;
      const inner = new BoxGeometry(w - 0.05, h - 0.04, dp - 0.05);
      setColorAttribute(inner, [0.12, 0.1, 0.08]);
      push(inner, 0, h / 2 - 0.005, 0);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const post = new BoxGeometry(0.045, h, 0.045);
          const k = shade() * 0.85;
          setColorAttribute(post, [k, k * 0.9, k * 0.75]);
          push(post, sx * (w / 2 - 0.0225), h / 2, sz * (dp / 2 - 0.0225));
        }
      }
      const rows = 3;
      const sh = h / rows;
      for (let r = 0; r < rows; r++) {
        const yy = (r + 0.5) * sh;
        for (const sz of [-1, 1]) {
          const k = shade();
          const g = plank(w - 0.07, sh - 0.016, 0.018, rK.fork(`slat/${placed.length}/${r}/z${sz}`), noise, [k, k * 0.9, k * 0.74], 0.002);
          push(g, 0, yy, sz * (dp / 2 - 0.009));
        }
        for (const sx of [-1, 1]) {
          const k = shade();
          const g = plank(dp - 0.07, sh - 0.016, 0.018, rK.fork(`slat/${placed.length}/${r}/x${sx}`), noise, [k, k * 0.9, k * 0.74], 0.002);
          g.rotateY(Math.PI / 2);
          push(g, sx * (w / 2 - 0.009), yy, 0);
        }
      }
      if (!open) {
        for (let k = 0; k < 3; k++) {
          const kk = shade();
          const g = board(w + 0.01, dp / 3 - 0.01, 0.022, rK.fork(`lid/${placed.length}/${k}`), noise, [kk, kk * 0.9, kk * 0.74]);
          push(g, 0, h + 0.011, -dp / 3 + k * (dp / 3));
        }
      } else {
        const c = new Vector3(0, 0, 0).applyMatrix4(M);
        for (const g of heap(c, y + h - 0.07, Math.min(w, dp) * 0.5, 14, rK, [[0.66, 0.2, 0.3], [0.8, 0.72, 0.52], [0.72, 0.4, 0.08]])) tiny.push(g);
      }
    };
    const basketAt = (p: Vector3, y: number, h: number, r: number, fill: RGB[]) => {
      for (const g of basket(h, r, rK)) {
        g.translate(p.x, y, p.z);
        tiny.push(g);
      }
      for (const g of heap(p, y + h - 0.05, r * 0.95, 9, rK, fill)) tiny.push(g);
    };
    const fills: RGB[][] = [
      [
        [0.5, 0.56, 0.12],
        [0.42, 0.5, 0.1],
      ],
      FRUIT,
    ];
    let baskets = 0;
    for (const g of eastShopSpots()) {
      const p = new Vector3(g.x, 0, g.z);
      const out2 = new Vector3(g.out[0], 0, g.out[1]);
      const face = Math.atan2(out2.x, out2.z);
      if (g.kind === 'crate-stack') {
        // two crates stacked, turned a little off the wall, and a bundle of sticks leaning on the outer side
        const gy = terrain.height(p.x, p.z) - 0.03;
        crate(p, gy, face + 0.3, 0.58, 0.42, 0.46, false);
        crate(p, gy + 0.442, face + 0.08, 0.5, 0.36, 0.4, true);
        placed.push(p);
        record('crate-stack', p, gy, g.foot);
        const side = new Vector3(out2.z, 0, -out2.x);
        const base = p.clone().addScaledVector(out2, 0.36).addScaledVector(side, 0.12);
        const top = p.clone().addScaledVector(out2, 0.2).addScaledVector(side, 0.08);
        const by0 = terrain.height(base.x, base.z);
        for (let k = 0; k < 7; k++) {
          const off = new Vector3((rK() - 0.5) * 0.12, 0, (rK() - 0.5) * 0.12);
          const a0 = base.clone().add(off).setY(by0 - 0.02);
          const a1 = top.clone().add(off.multiplyScalar(0.5)).setY(by0 + 0.95 + rK() * 0.2);
          wood.push(pole([a0, a0.clone().lerp(a1, 0.5), a1], 0.022, 0.016, noise, 11 + k));
        }
        record('sticks', base, by0, 0.1);
      } else if (g.kind === 'crate') {
        const gy = terrain.height(p.x, p.z) - 0.03;
        crate(p, gy, face - 0.4, 0.52, 0.38, 0.42, true);
        placed.push(p);
        record('crate', p, gy, g.foot);
      } else {
        const by = terrain.height(p.x, p.z) - 0.02;
        const big = baskets === 0;
        basketAt(p, by, big ? 0.26 : 0.18, big ? 0.2 : 0.19, fills[baskets % fills.length]);
        baskets++;
        placed.push(p);
        record('basket', p, by, g.foot);
      }
    }
    const wm = meshOf('fence-east-crates', mats.fenceWood, wood);
    if (wm) shopNear.add(wm);
    const gm = meshOf('east-crate-goods', goods, tiny);
    if (gm) shopNear.add(gm);
    return out;
  })();

  // the shop's sign: a post by the lane, an arm, a board hanging on two cords with the carved jar and sprout
  const signAudit = (() => {
    const S = EXPANSION_EAST.shopSign;
    const rS = rng.fork('sign');
    const gy = terrain.height(S.x, S.z);
    const arm = new Vector3(Math.sin((S.armDeg * Math.PI) / 180), 0, Math.cos((S.armDeg * Math.PI) / 180));
    const side = new Vector3(arm.z, 0, -arm.x);
    const foot = new Vector3(S.x, gy - 0.35, S.z);
    const top = new Vector3(S.x + (rS() - 0.5) * 0.05, gy + S.height, S.z + (rS() - 0.5) * 0.05);
    const wood: BufferGeometry[] = [];
    const bark: BufferGeometry[] = [];
    bark.push(pole([foot, new Vector3(S.x, gy, S.z), new Vector3(S.x, gy + S.height * 0.5, S.z).lerp(top, 0.5), top], 0.085, 0.062, noise, 21));
    const armEnd = top.clone().addScaledVector(arm, 1.0);
    armEnd.y -= 0.12;
    const armRoot = top.clone().addScaledVector(arm, -0.08);
    armRoot.y -= 0.12;
    bark.push(pole([armRoot, armRoot.clone().lerp(armEnd, 0.5).setY(armRoot.y + 0.02), armEnd], 0.05, 0.04, noise, 23));
    // brace
    const b0 = top.clone().setY(gy + S.height - 0.62);
    const b1 = top.clone().addScaledVector(arm, 0.5).setY(gy + S.height - 0.14);
    bark.push(pole([b0, b0.clone().lerp(b1, 0.5), b1], 0.03, 0.026, noise, 25));
    const topCap = checkedCap(endFrame(new CatmullRomCurve3([top.clone().setY(top.y - 0.2), top]), 4), rS.fork('cap'), noise, { radius: 0.062, segments: 10, color: [0.55, 0.5, 0.44], checks: 2, depth: [0.006, 0.014], dome: 0.006, uvMetres: 0.7, uvOffset: [0.3, 0.6] });
    bark.push(topCap);
    // the board: grained, the emblem cut into both faces and filled with a leaf-green stain
    const BW = 0.64;
    const BH = 0.44;
    const BT = 0.05;
    const hang = 0.62;
    const boardGeo = new BoxGeometry(BW, BH, BT, 80, 56, 1);
    grainPlank(boardGeo, BW, BH, BT, rS.fork('board'), noise, [1.05, 0.9, 0.66]);
    const decalW = BW * 0.92;
    const decalH = BH * 0.9;
    const aspect = decalW / decalH;
    const strokes = shopGlyph(aspect);
    const carve = (g: BufferGeometry) => {
      const pos = g.attributes.position;
      const col = g.attributes.color;
      let moved = 0;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z < BT * 0.45) continue;
        const u = pos.getX(i) / decalW + 0.5;
        const v = pos.getY(i) / decalH + 0.5;
        if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) continue;
        const dd = glyphDistance(strokes, u, v, aspect) * decalW;
        if (dd >= 0.002) continue;
        const cutK = clamp((0.002 - dd) / (0.016 * decalW * 0.5 + 0.002), 0, 1);
        pos.setZ(i, z - 0.007 * cutK);
        col.setXYZ(i, lerp(col.getX(i), 0.16, cutK), lerp(col.getY(i), 0.34, cutK), lerp(col.getZ(i), 0.12, cutK));
        moved++;
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      return moved;
    };
    let carved = carve(boardGeo);
    boardGeo.rotateY(Math.PI);
    carved += carve(boardGeo);
    boardGeo.computeVertexNormals();
    // hang it in the vertical plane of the arm, faces across the arm
    const bc = top.clone().addScaledVector(arm, hang);
    bc.y = armEnd.y + (top.y - 0.12 - armEnd.y) * (1 - hang) - 0.24 - BH / 2;
    const Mb = new Matrix4().makeBasis(arm, UP, side).setPosition(bc);
    boardGeo.applyMatrix4(new Matrix4().makeRotationZ((rS() - 0.5) * 0.04));
    boardGeo.applyMatrix4(Mb);
    wood.push(boardGeo);
    const cords: BufferGeometry[] = [];
    for (const k of [-1, 1]) {
      const bottom = bc.clone().addScaledVector(arm, k * BW * 0.36);
      bottom.y += BH / 2 - 0.01;
      const up = bottom.clone();
      up.y = armRoot.y + (armEnd.y - armRoot.y) * ((hang + k * BW * 0.36 + 0.08) / 1.08) - 0.03;
      const midC = bottom.clone().lerp(up, 0.5).addScaledVector(side, 0.004);
      cords.push(
        sweepTube(new CatmullRomCurve3([bottom, midC, up]), {
          radius: () => 0.009,
          tubularSegments: 6,
          radialSegments: 5,
          uvMetres: 0.3,
          color: () => [0.78, 0.7, 0.55],
        }),
      );
      const ring = new TorusGeometry(0.045, 0.01, 5, 12);
      ring.rotateY(Math.atan2(arm.x, arm.z));
      ring.translate(up.x, up.y + 0.01, up.z);
      setColorAttribute(ring, [0.72, 0.64, 0.5]);
      cords.push(ring);
    }
    const bm = meshOf('signpost-wood', mats.fenceWood, wood);
    if (bm) mid.add(bm);
    const pm = meshOf('fence-east-sign', mats.bark, bark);
    if (pm) mid.add(pm);
    const cm = meshOf('fence-east-sign-rope', rope, cords);
    if (cm) mid.add(cm);
    bases.push([S.x, gy, S.z]);
    return { post: [S.x, +gy.toFixed(3), S.z] as P3, boardCentre: [+bc.x.toFixed(2), +bc.y.toFixed(2), +bc.z.toFixed(2)] as P3, strokes: strokes.length, carvedVertices: carved };
  })();

  // ---- the tall house: the side deck, its railing, plank steps and a ladder ----
  const tallI = EXPANSION_EAST.houses.findIndex((h) => h.kind === 'tall');
  const tall = sites[tallI];
  const deckAudit = (() => {
    const s = tall;
    const rD = rng.fork('deck');
    const { M } = wallFrame(s, D.a);
    // local frame: x along the tangent (plan `t`), y over the floor, z out from the axis (plan `d`)
    const L = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(M);
    const groundAt = (x: number, z: number) => {
      const p = L(x, 0, z);
      return terrain.height(p.x, p.z) - s.floor;
    };
    const top = D.rise;
    const wood: BufferGeometry[] = [];
    const bark: BufferGeometry[] = [];
    const rails: BufferGeometry[] = [];
    const put = (g: BufferGeometry, x: number, y: number, z: number, list: BufferGeometry[]) => {
      g.translate(x, y, z);
      g.applyMatrix4(M);
      list.push(g);
    };
    // boards along the tangent, a little ragged in length
    const nBoards = 8;
    const span = D.outer - D.inner;
    const bwid = span / nBoards;
    for (let k = 0; k < nBoards; k++) {
      const len = 2 * D.half + (rD() - 0.5) * 0.08 + (k === nBoards - 1 ? 0.06 : 0);
      const kk = 0.72 + rD() * 0.2;
      const g = board(len, bwid - 0.014, 0.045, rD.fork(`board/${k}`), noise, [kk, kk * 0.9, kk * 0.74]);
      put(g, (rD() - 0.5) * 0.05, top - 0.0225, D.inner + (k + 0.5) * bwid, wood);
    }
    // two beams under the boards, joists across, a rim board on the outer edge
    for (const z of [D.inner + 0.4, D.outer - 0.12]) put(plank(2 * D.half + 0.1, 0.14, 0.12, rD.fork(`beam/${z}`), noise, [0.58, 0.52, 0.42]), 0, top - 0.045 - 0.07, z, wood);
    for (const x of [-D.half + 0.1, -0.5, 0.5, D.half - 0.1]) {
      const j = plank(span, 0.1, 0.08, rD.fork(`joist/${x}`), noise, [0.55, 0.49, 0.4]);
      j.rotateY(Math.PI / 2);
      put(j, x, top - 0.045 - 0.19, D.inner + span / 2, wood);
    }
    put(plank(2 * D.half + 0.06, 0.16, 0.035, rD.fork('rim'), noise, [0.66, 0.58, 0.46]), 0, top - 0.1, D.outer + 0.018, wood);
    // log posts to the ground under the outer beam and the inner beam's ends; the outer ones run on up as railing posts
    const railTop = top + 0.84;
    const postsAt: { x: number; z: number; rail: boolean }[] = [
      { x: -D.half + 0.06, z: D.outer - 0.1, rail: true },
      { x: 0, z: D.outer - 0.1, rail: true },
      { x: D.half - 0.06, z: D.outer - 0.1, rail: true },
      { x: D.half - 0.06, z: D.inner + 0.42, rail: true },
      { x: -D.half + 0.06, z: D.inner + 0.42, rail: true },
      { x: -D.half + 0.06, z: D.stepInner - 0.08, rail: true },
    ];
    for (const [k, p] of postsAt.entries()) {
      const g0 = groundAt(p.x, p.z);
      const yTop = p.rail ? railTop + 0.04 : top - 0.1;
      bark.push(pole([L(p.x, g0 - 0.3, p.z), L(p.x + 0.01, g0 + 0.2, p.z), L(p.x, (g0 + yTop) / 2, p.z), L(p.x - 0.01, yTop, p.z)], 0.078, 0.062, noise, 31 + k));
      const gp = L(p.x, g0, p.z);
      bases.push([gp.x, gp.y, gp.z]);
    }
    // the railing: a top pole and a mid pole along the outer edge, short runs at the ends (the east run leaves the ladder's gap)
    const railRuns: [number, number, number, number][] = [
      [-D.half + 0.06, D.outer - 0.1, D.half - 0.06, D.outer - 0.1],
      [D.half - 0.06, D.inner + 0.42, D.half - 0.06, D.inner + 0.95],
      [-D.half + 0.06, D.inner + 0.42, -D.half + 0.06, D.stepInner - 0.08],
    ];
    for (const [k, [x0, z0, x1, z1]] of railRuns.entries()) {
      for (const [j, yy] of [railTop, top + 0.44].entries()) {
        const sag = 0.015 + rD() * 0.02;
        const a = L(x0, yy, z0);
        const b = L(x1, yy + (rD() - 0.5) * 0.03, z1);
        const m = a.clone().lerp(b, 0.5);
        m.y -= sag;
        rails.push(pole([a, m, b], j === 0 ? 0.042 : 0.034, j === 0 ? 0.038 : 0.03, noise, 41 + k * 3 + j));
      }
    }
    if (railRuns.length) {
      // the east run stops short of the outer corner: a top pole from its last post back to the corner keeps the corner tied
      const a = L(D.half - 0.06, railTop, D.inner + 0.95);
      const b = L(D.half - 0.06, railTop, D.outer - 0.1);
      rails.push(pole([a, a.clone().lerp(b, 0.5).setY(a.y + 0.01), b], 0.04, 0.038, noise, 57));
    }
    // plank steps down toward the door: two stringers, treads
    const sx0 = -D.half;
    const sx1 = -D.half - D.stepRun;
    const zi = D.stepInner;
    const zo = D.stepOuter;
    const gb = groundAt(sx1, (zi + zo) / 2);
    const total = top - gb;
    const nSteps = Math.max(4, Math.round(total / 0.23));
    for (const z of [zi + 0.03, zo - 0.03]) {
      const len = Math.hypot(D.stepRun + 0.12, total + 0.06);
      const g = plank(len, 0.2, 0.05, rD.fork(`stringer/${z}`), noise, [0.6, 0.53, 0.42]);
      g.rotateZ(Math.atan2(total, -D.stepRun));
      g.rotateZ(Math.PI);
      put(g, (sx0 + sx1) / 2 - 0.02, (top + gb) / 2 - 0.12, z, wood);
    }
    for (let k = 1; k < nSteps; k++) {
      const u = k / nSteps;
      const y = gb + total * u;
      const x = sx1 + D.stepRun * (u - 0.5 / nSteps);
      const kk = 0.7 + rD() * 0.2;
      const g = board(zo - zi + 0.04, D.stepRun / nSteps + 0.06, 0.04, rD.fork(`tread/${k}`), noise, [kk, kk * 0.9, kk * 0.74]);
      g.rotateY(Math.PI / 2);
      put(g, x, y - 0.02, (zi + zo) / 2, wood);
    }
    // the ladder at the far end: two poles, five rungs lashed on
    const lb = { x: D.half + 0.55, z: 3.95 };
    const lt = { x: D.half + 0.03, z: 3.95 };
    const lg = groundAt(lb.x, lb.z);
    const ly1 = top + 0.5;
    for (const side of [-1, 1]) {
      const a = L(lb.x, lg - 0.06, lb.z + side * 0.22);
      const b = L(lt.x, ly1, lt.z + side * 0.2);
      bark.push(pole([a, a.clone().lerp(b, 0.5), b], 0.036, 0.03, noise, 61 + side));
    }
    const ropeBits: BufferGeometry[] = [];
    for (let k = 1; k <= 5; k++) {
      const u = k / 6;
      const x = lerp(lb.x, lt.x, u);
      const y = lerp(lg - 0.06, ly1, u);
      const a = L(x, y, lb.z - 0.23);
      const b = L(x, y, lb.z + 0.23);
      rails.push(pole([a, a.clone().lerp(b, 0.5), b], 0.022, 0.022, noise, 71 + k));
      for (const side of [-1, 1]) {
        const c = L(x, y, lb.z + side * 0.21);
        const ring = new TorusGeometry(0.036, 0.009, 4, 10);
        ring.rotateY(Math.atan2(plan.d[0], plan.d[1]));
        ring.translate(c.x, c.y, c.z);
        setColorAttribute(ring, [0.8, 0.72, 0.56]);
        ropeBits.push(ring);
      }
    }
    const lf = L(lb.x, lg, lb.z);
    bases.push([lf.x, lf.y, lf.z]);
    const wm = meshOf('fence-east-deck', mats.fenceWood, wood);
    if (wm) mid.add(wm);
    const bm = meshOf('fence-east-deck-posts', mats.bark, [...bark, ...rails]);
    if (bm) mid.add(bm);
    const rm = meshOf('fence-east-deck-rope', rope, ropeBits);
    if (rm) mid.add(rm);
    // the character's ground: the strip along the deck and the flight
    const deckY = s.floor + top;
    const bottomY = terrain.height(plan.steps.bottom[0], plan.steps.bottom[1]) + 0.03;
    walk.push({
      id: 'east-tall-deck',
      disc: { x: s.h.x, z: s.h.z, r: -1, y: deckY },
      deck: { a: [plan.walk.a[0], deckY, plan.walk.a[1]], b: [plan.walk.b[0], deckY, plan.walk.b[1]], hw: plan.walk.hw },
      wall: { r: 0, half: -1, gap: [0, 0] },
    });
    walk.push({
      id: 'east-tall-steps',
      disc: { x: s.h.x, z: s.h.z, r: -1, y: deckY },
      deck: { a: [plan.steps.bottom[0], bottomY, plan.steps.bottom[1]], b: [plan.steps.top[0], deckY, plan.steps.top[1]], hw: plan.steps.hw },
      wall: { r: 0, half: -1, gap: [0, 0] },
    });
    return { top: +deckY.toFixed(3), rise: D.rise, steps: nSteps, stepFoot: [+plan.steps.bottom[0].toFixed(2), +bottomY.toFixed(3), +plan.steps.bottom[1].toFixed(2)] as P3, posts: postsAt.length, boards: nBoards, ladderRungs: 5 };
  })();

  // ---- the small house: two flower boxes (under the round window, and right of the door) ----
  const smallI = EXPANSION_EAST.houses.findIndex((h) => h.kind === 'small');
  const small = sites[smallI];
  const smallHb = houses[smallI];
  const flowerAudit = (() => {
    const s = small;
    const hb = smallHb;
    const rF = rng.fork('flower-boxes');
    const shell = ['trunk', 'trunk-eave-band'].map((n) => hb.group.getObjectByName(n) as Mesh | undefined).filter((m): m is Mesh => !!m);
    const foliage = new FoliageBuilder(rF.fork('foliage'), `${ctx.config.seed}/east/flower-boxes`);
    const wood: BufferGeometry[] = [];
    const soil: BufferGeometry[] = [];
    const boxes: { a: number; y: number; len: number }[] = [
      { a: -1.08, y: hb.window.height - hb.window.radius - 0.1, len: 0.82 },
      { a: 0.98, y: 0.78, len: 0.7 },
    ];
    const tints: RGB[] = [
      [1.0, 0.55, 0.68],
      [1.0, 0.86, 0.36],
      [0.8, 0.66, 1.0],
      [1.0, 0.98, 0.94],
      [1.0, 0.5, 0.36],
    ];
    const built: { a: number; y: number; out: number; flowers: number }[] = [];
    for (const [bi, bx] of boxes.entries()) {
      const { M, d } = wallFrame(s, bx.a);
      let out = -Infinity;
      for (const lat of [-bx.len / 2, 0, bx.len / 2]) for (const yy of [bx.y - 0.2, bx.y]) {
        const o = barkOut(s, shell, d, lat, yy);
        if (o !== null) out = Math.max(out, o);
      }
      if (!Number.isFinite(out)) out = s.h.radius + 0.08;
      const dep = 0.24;
      const hgt = 0.2;
      const z0 = out + 0.01;
      const put = (g: BufferGeometry, x: number, y: number, z: number, list: BufferGeometry[]) => {
        g.translate(x, y, z);
        g.applyMatrix4(M);
        list.push(g);
      };
      const tint: RGB = bi === 0 ? [0.72, 0.62, 0.48] : [0.66, 0.58, 0.46];
      // front and back boards, two ends, a bottom; soil a little under the rim
      put(plank(bx.len, hgt, 0.028, rF.fork(`front/${bi}`), noise, tint), 0, bx.y - hgt / 2, z0 + dep - 0.014, wood);
      put(plank(bx.len, hgt, 0.028, rF.fork(`back/${bi}`), noise, tint), 0, bx.y - hgt / 2, z0 + 0.014, wood);
      for (const side of [-1, 1]) {
        const e = plank(dep, hgt, 0.028, rF.fork(`end/${bi}/${side}`), noise, tint);
        e.rotateY(Math.PI / 2);
        put(e, side * (bx.len / 2 - 0.014), bx.y - hgt / 2, z0 + dep / 2, wood);
      }
      put(board(bx.len, dep, 0.024, rF.fork(`bottom/${bi}`), noise, tint), 0, bx.y - hgt + 0.012, z0 + dep / 2, wood);
      const dirt = new BoxGeometry(bx.len - 0.05, 0.03, dep - 0.05, 8, 1, 3);
      const dp = dirt.attributes.position;
      setColorAttribute(dirt, (i) => {
        const k = 0.8 + 0.4 * noise.noise(dp.getX(i) * 9 + bi * 5, dp.getZ(i) * 9);
        return [0.16 * k, 0.11 * k, 0.07 * k];
      });
      put(dirt, 0, bx.y - 0.045, z0 + dep / 2, soil);
      // two brackets under it into the bark
      for (const side of [-1, 1]) {
        const x = side * (bx.len / 2 - 0.1);
        const a0 = new Vector3(x, bx.y - hgt - 0.26, out - 0.03).applyMatrix4(M);
        const a1 = new Vector3(x, bx.y - hgt - 0.05, z0 + dep * 0.55).applyMatrix4(M);
        wood.push(pole([a0, a0.clone().lerp(a1, 0.5), a1], 0.022, 0.02, noise, 81 + bi * 2 + side));
      }
      // the planting: leafy cushions along the box, flower heads over them, a few strands over the front
      const n0 = foliage.flowerCount;
      for (let k = 0; k < 5; k++) {
        const x = -bx.len / 2 + 0.1 + k * ((bx.len - 0.2) / 4);
        const c = new Vector3(x, bx.y + 0.02, z0 + dep / 2 + (rF() - 0.5) * 0.06).applyMatrix4(M);
        foliage.addLeafCluster(c, 0.09, 9, { size: 0.065, amount: 0.03, droop: 0.15, tint: [0.72, 0.9, 0.5], tintSpread: 0.2, flatten: 0.55 });
      }
      for (let k = 0; k < 16; k++) {
        const x = -bx.len / 2 + 0.06 + rF() * (bx.len - 0.12);
        const p = new Vector3(x, bx.y + 0.05 + rF() * 0.07, z0 + 0.05 + rF() * (dep - 0.1)).applyMatrix4(M);
        const nrm = new Vector3(0, 1, 0).addScaledVector(d, 0.55 + rF() * 0.3).normalize();
        foliage.addFlower(p, nrm, 0.055 + rF() * 0.02, 0.02, 0.04, tints[Math.floor(rF() * tints.length) % tints.length]);
      }
      for (let k = 0; k < 3; k++) {
        const x = -bx.len / 2 + 0.12 + rF() * (bx.len - 0.24);
        const hook = new Vector3(x, bx.y + 0.01, z0 + dep - 0.01).applyMatrix4(M);
        foliage.addHangingVine(hook, 0.18 + rF() * 0.16, { drift: d.clone().multiplyScalar(0.05), leafSize: 0.05, amount: 0.05, thickness: 0.008 });
      }
      built.push({ a: bx.a, y: +bx.y.toFixed(3), out: +out.toFixed(3), flowers: foliage.flowerCount - n0 });
    }
    const near0 = near[smallI];
    const wm = meshOf('fence-east-flower-boxes', mats.fenceWood, wood);
    if (wm) near0.add(wm);
    const sm = meshOf('east-flower-box-soil', goods, soil, false);
    if (sm) near0.add(sm);
    for (const m of foliage.build(mats, 'east-flower-boxes')) near0.add(m);
    return built;
  })();

  // ---- pod-lantern posts on the green and at the lookout (emissive pods, no lights) ----
  const posts = EXPANSION_EAST.lanternPosts.map((p) => {
    const f = (p.facingDeg * Math.PI) / 180;
    const def: LanternPostDef = { id: p.id, position: [p.x, p.z], facing: [Math.sin(f), Math.cos(f)], height: p.height, tint: p.tint };
    const pb = buildLanternPost(def, ctx, mats, rng.fork(`lantern-post/${p.id}`), rope);
    for (const l of pb.lights) {
      l.removeFromParent();
      l.dispose();
      lightsDropped++;
    }
    for (const child of [...pb.group.children]) {
      if ((child as Mesh).isMesh && !/-(leaves|vines|tufts|flowers)$/.test(child.name)) mid.add(child);
      else lane.add(child);
    }
    lanterns.push(...pb.lanterns);
    bases.push(pb.base);
    return pb;
  });

  // ---- the lookout: the rope fence on the lip and a split-log bench facing back over the lane ----
  const lookout = EXPANSION_EAST.lookout;
  const fence: FenceBuild = buildFence({ id: 'east-lookout', style: 'rope', points: lookout.fence }, ctx, mats, rng.fork('lookout-fence'), rope);
  for (const m of fence.meshes) (/-foot-moss$/.test(m.name) ? lane : mid).add(m);
  bases.push(...fence.bases);
  const benchAudit = (() => {
    const B = lookout.bench;
    const rB = rng.fork('bench');
    const yaw = (B.yawDeg * Math.PI) / 180;
    const f = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const e = new Vector3(f.z, 0, -f.x);
    const gy = terrain.height(B.x, B.z);
    const M = new Matrix4().makeBasis(e, UP, f).setPosition(B.x, gy, B.z);
    const len = B.length;
    const rS = 0.2;
    const seatY = 0.47;
    const bark: BufferGeometry[] = [];
    const face: BufferGeometry[] = [];
    const ends: BufferGeometry[] = [];
    const bn = new Noise2D(`${ctx.config.seed}/structures/east/bench`);
    const sag = (x: number) => -0.012 * (1 - (2 * x) / len) * (1 + (2 * x) / len);
    // the half log's bark: the lower half-round, split face up
    const halfLog = new CylinderGeometry(rS, rS * 0.96, len, 20, 12, true, Math.PI / 2, Math.PI);
    halfLog.rotateZ(Math.PI / 2);
    {
      const pos = halfLog.attributes.position;
      const cols: RGB[] = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const ang = Math.atan2(z, y);
        const ridge = bn.ridged(ang * 2.2, x * 2.6, 2);
        const r = Math.hypot(y, z) * (1 + (ridge - 0.5) * 0.08);
        const k = r / Math.max(1e-6, Math.hypot(y, z));
        pos.setXYZ(i, x, y * k + sag(x), z * k);
        const moss = smoothstep(-0.1, -0.02, y) * smoothstep(0.45, 0.8, bn.noise(x * 3 + 7, ang * 2));
        const d = 0.5 * lerp(0.62, 1.08, ridge);
        cols.push([lerp(d, 0.24, moss), lerp(d * 0.9, 0.3, moss), lerp(d * 0.8, 0.09, moss)]);
      }
      setColorAttribute(halfLog, (i) => cols[i]);
      halfLog.computeVertexNormals();
    }
    halfLog.translate(0, seatY, 0);
    halfLog.applyMatrix4(M);
    bark.push(halfLog);
    // the split face: pale, checked wood along the grain
    const top = new PlaneGeometry(len, rS * 1.96, 48, 6);
    top.rotateX(-Math.PI / 2);
    {
      const pos = top.attributes.position;
      const cols: RGB[] = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const g = bn.ridged(x * 1.2 + 3, z * 30, 2);
        const check = smoothstep(0.82, 0.95, bn.ridged(x * 0.6, z * 14 + 5, 1)) * 0.004;
        pos.setY(i, sag(x) - check + (g - 0.5) * 0.003);
        const k = lerp(0.62, 1.05, g) * (1 - 0.35 * smoothstep(rS * 0.7, rS, Math.abs(z)));
        cols.push([0.86 * k, 0.74 * k, 0.56 * k]);
      }
      setColorAttribute(top, (i) => cols[i]);
      top.computeVertexNormals();
    }
    top.translate(0, seatY, 0);
    top.applyMatrix4(M);
    face.push(top);
    // the sawn ends: half discs
    for (const side of [-1, 1]) {
      const cap = new CylinderGeometry(rS * 0.98, rS * 0.98, 0.01, 20, 1, false, Math.PI / 2, Math.PI);
      cap.rotateZ(Math.PI / 2);
      cap.translate(side * (len / 2 - 0.004), seatY, 0);
      setColorAttribute(cap, [0.8, 0.7, 0.55]);
      cap.applyMatrix4(M);
      ends.push(cap);
    }
    // two log-round legs
    const tufts: MossTuftSpec[] = [];
    const legs: P3[] = [];
    for (const side of [-1, 1]) {
      const x = side * (len / 2 - 0.36);
      const p = new Vector3(x, 0, (rB() - 0.5) * 0.04).applyMatrix4(M);
      const g0 = terrain.height(p.x, p.z);
      const a0 = new Vector3(p.x, g0 - 0.12, p.z);
      const a1 = new Vector3(p.x, gy + seatY - rS + 0.02, p.z);
      bark.push(pole([a0, a0.clone().lerp(a1, 0.5), a1], 0.16, 0.15, bn, 91 + side, true));
      legs.push([+p.x.toFixed(2), +g0.toFixed(3), +p.z.toFixed(2)]);
      bases.push([p.x, g0, p.z]);
      tufts.push(...footMoss(ctx, new Vector3(p.x, g0, p.z), rB.fork(`moss/${side}`), { postRadius: 0.16, count: 18, size: [0.018, 0.04], color: [0.32, 0.44, 0.09], favour: [0.62, 0.78] }));
    }
    const bm = meshOf('fence-east-bench', mats.logBark, bark);
    if (bm) mid.add(bm);
    const fm = meshOf('fence-east-bench-seat', mats.fenceWood, face);
    if (fm) mid.add(fm);
    const em = meshOf('fence-east-bench-ends', mats.endGrain, ends, false);
    if (em) mid.add(em);
    const tb = buildMossTufts(tufts, new Noise3D(rB.fork('tuft-noise')), { topGain: 1.4, rimGain: 0.5, topTint: [1.0, 1.05, 0.8] });
    if (tb.count > 0) {
      const tm = new Mesh(tb.geometry, mats.capMoss);
      tm.name = 'fence-east-bench-foot-moss';
      tm.castShadow = false;
      tm.receiveShadow = true;
      lane.add(tm);
    }
    return { centre: [B.x, +gy.toFixed(3), B.z] as P3, seatY, length: len, legs };
  })();

  // ---- sort each house's parts into core, base and near ----
  let movedBase = 0;
  houses.forEach((hb, i) => {
    for (const child of [...hb.group.children]) {
      const m = child as Mesh;
      if (!m.isMesh || HOUSE_NEAR.test(m.name)) {
        near[i].add(child);
        movedNear++;
      } else if (HOUSE_BASE.test(m.name)) {
        base.add(child);
        movedBase++;
      }
    }
    for (const child of [...hb.group.children]) core.add(child);
  });

  // ---- visibility: casters (with their sun shadows) per tier ----
  const sunToward = ctx.sun ? ctx.sun.position.clone().sub(ctx.sun.target.position).normalize() : sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
  const houseCasters = sites.map((s) => eastHouseCasters(s.h, terrain.height(s.h.x, s.h.z)));
  const groundAt = (x: number, z: number) => terrain.height(x, z);
  const laneCasters: Caster[] = [...eastLookoutCasters(groundAt), ...eastPostCasters(groundAt)];
  const coreSpheres: Sphere[] = eastSpheres([...houseCasters.flat(), ...laneCasters], sunToward);
  const nearSpheres: Sphere[][] = houseCasters.map((c) => eastSpheres(c, sunToward));
  const laneSpheres: Sphere[] = eastSpheres(laneCasters, sunToward);
  const midSpheres: Sphere[] = eastSpheres([...laneCasters, ...houseCasters[tallI].slice(1), houseCasters[shopI][0]], sunToward);
  /**
   * The plateau's lip hides the lane's ground-level work from its lee on the plain south of the
   * plaza. Beyond EAST_MID_M of the green, `base` and `mid` draw only while the terrain lets the
   * camera see a house's foot (eastLane.ts `eastFootSeen`, up to the head of its door or window —
   * camera F sees over the lip, so they draw there); whatever the ground hides casts its shadow onto
   * ground the camera cannot see either. Re-tested when the camera has moved 0.3 m.
   */
  const baseTops = houses.map((hb) => Math.max(hb.door.height + 0.3, hb.window.height + hb.window.radius + 0.25));
  const heightAt = (x: number, z: number) => terrain.height(x, z);
  let seenFrom: Vector3 | null = null;
  let seen = true;
  let sightTests = 0;
  const _p = new Vector3();
  const update = (camera: Camera) => {
    camera.getWorldPosition(_p);
    const on = eastBoxDistance(camera) < EAST_VISIBLE_M && frustumMeets(camera, coreSpheres);
    const toGreen = Math.hypot(_p.x - EAST_GREEN.x, _p.z - EAST_GREEN.z);
    let low = on && toGreen < EAST_MID_M;
    if (on && !low) {
      if (!seenFrom || seenFrom.distanceToSquared(_p) > 0.09) {
        seen = eastFootSeen(_p, heightAt, baseTops);
        seenFrom = (seenFrom ?? new Vector3()).copy(_p);
        sightTests++;
      }
      low = seen;
    }
    core.visible = on;
    base.visible = low;
    mid.visible = low && frustumMeets(camera, midSpheres);
    for (let i = 0; i < near.length; i++) {
      const h = sites[i].h;
      near[i].visible = on && Math.hypot(_p.x - h.x, _p.z - h.z) < EAST_DETAIL_M && frustumMeets(camera, nearSpheres[i]);
    }
    lane.visible = on && toGreen < EAST_DETAIL_M && frustumMeets(camera, laneSpheres);
  };

  let draws = { before: 0, after: 0, merged: 0 };
  const consolidate = () => {
    const out = { before: 0, after: 0, merged: 0 };
    for (const g of [core, base, mid, lane, ...near]) {
      const r = consolidateStaticMeshes(g, (m) => m.name === 'pod-lantern');
      out.before += r.before;
      out.after += r.after;
      out.merged += r.merged;
    }
    draws = out;
    return out;
  };

  const countTris = (root: Object3D) => {
    let n = 0;
    root.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) n += tri(m.geometry);
    });
    return n;
  };
  const audit = () => ({
    houses: EXPANSION_EAST.houses.map((h, i) => ({
      id: h.id,
      kind: h.kind,
      centre: [h.x, +sites[i].floor.toFixed(3), h.z] as P3,
      radius: h.radius,
      roofHeight: h.roofHeight,
      facingDeg: h.facingDeg,
      pods: houses[i].lanterns.length,
      roots: houses[i].roots,
      window: houses[i].window,
      door: { width: houses[i].door.width, height: houses[i].door.height, sill: houses[i].door.sill },
      nearTriangles: countTris(near[i]),
      nearVisible: near[i].visible,
    })),
    pointLightsDropped: lightsDropped,
    partsMovedNear: movedNear,
    partsMovedBase: movedBase,
    baseTops: baseTops.map((t) => +t.toFixed(2)),
    counter: counterAudit,
    crates: crateAudit,
    sign: signAudit,
    deck: deckAudit,
    flowerBoxes: flowerAudit,
    lanternPosts: posts.map((p) => ({ base: p.base, pods: p.lanterns.length })),
    lookout: { fencePosts: fence.posts, bench: benchAudit },
    walkSurfaces: walk,
    pods: lanterns.length,
    coreTriangles: countTris(core),
    baseTriangles: countTris(base),
    midTriangles: countTris(mid),
    laneTriangles: countTris(lane),
    draws,
    visibleWithinM: EAST_VISIBLE_M,
    detailWithinM: EAST_DETAIL_M,
    midWithinM: EAST_MID_M,
    coreVisible: core.visible,
    baseVisible: base.visible,
    baseSeenByTerrain: seen,
    sightTests,
    midVisible: mid.visible,
    laneVisible: lane.visible,
  });

  return { group, core, base, mid, near, lane, lanterns, walk, bases, owned, consolidate, update, audit };
}
