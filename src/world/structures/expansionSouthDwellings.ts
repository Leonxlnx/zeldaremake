/**
 * exp-south2 (the owner, 2026-09-24 06:07 UTC: "more structures along the path further down"): the
 * people who live on the village's way out (layout.ts `EXPANSION_SOUTH_DWELLINGS`).
 *
 * The bridge keeper's hut on the ravine's north lip: a round hut (the village huts' builder,
 * distantHouse.ts, without a walkway) on a mast — a dead snag trimmed to a pole whose broken top
 * carries a beacon pod over the gorge — with a plank gallery round its gorge side: tapered boards
 * on two ring beams on radial outriggers, braced back to the mast where the slope falls away and
 * propped where it does not, a railing of bark posts under a peeled top rail and a rope, a davit
 * with a bucket over the drop, a step at each end. Firewood against its north wall, a chopping
 * block, herbs by the door, flowers on the window ledge.
 *
 * The waystation by the path: a lean-to open to the path, a moss roof on five rafters over a
 * plank floor on two bearer logs, a palisade back wall with a round window and a propped shutter,
 * a palisade north end, a bench, a basket, a walking stick, firewood stacked outside, a pod under
 * the front plate, a split-log step up from the path.
 *
 * Every part is built at the identity transform on the shared materials and named for the play
 * camera's solids (cameraSolids.ts); structures/index.ts moves them into the south group before
 * it is consolidated, so they fold into buckets the bridge already draws (bark, planks, rope, end
 * grain, hangers, foot moss, leaves). The keeper's cap and the roof share one new moss bucket, the
 * pods one static bucket (they do not swing), the hut's openings its glow. No light joins the
 * scene. The walk surfaces are appended to ctx.shared.walkSurfaces. Own rng fork, appended after
 * every existing stream.
 */
import { BoxGeometry, type BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Group, LineCurve3, Matrix4, Mesh, Vector3, type Camera, type Material, type Sphere } from 'three';
import { EXPANSION_SOUTH_DWELLINGS } from '../layout';
import type { TrunkSeat, WalkSurface, WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { casterSpheres, southVisible, sunVector, type Caster } from '../util/expansionLocality';
import { buildDistantHouses, type DistantHouseDef } from './distantHouse';
import { ropeTube } from './fence';
import { FoliageBuilder } from './foliage';
import { TAU, faceTowards, gridSurface, merge, sweepTube } from './geometry';
import { buildLantern, lanternHanger, type LanternRig } from './lantern';
import { MOSS_ALBEDO_PEAK, Noise3D, WOOD_ON_FENCE_WOOD, type StructureMaterials } from './materials';
import { buildMossTufts, type MossTuftSpec } from './mossTufts';
import { checkedCap, endFrame, footMoss, woodGrain } from './woodGrain';

type RGB = [number, number, number];
const DEG = Math.PI / 180;
const K = EXPANSION_SOUTH_DWELLINGS.keeper;
const W = EXPANSION_SOUTH_DWELLINGS.waystation;
const tri = (g: BufferGeometry) => Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);

/** the planks map's board atlas (weathered_planks: nine vertical boards per tile) — as the bridge's planks */
const BOARD_U0 = 62 / 1024;
const BOARD_W = 113.9 / 1024;
const BOARD_INSET = 7 / 1024;

/** cap moss tones (the huts' cap palette, distantHouse.ts) */
const MOSS_DEEP: RGB = [0.266, 0.238, 0.052];
const MOSS_SUN: RGB = [0.8, 0.79, 0.17];
/** the foot moss on posts and roots (the bridge posts' tint) */
const FOOT_MOSS: RGB = [0.32, 0.44, 0.09];
/** the side of things the sun does not reach here (unit xz: the sun stands north-west, azimuth ≈ −128°) */
const SHADE_SIDE: [number, number] = [0.79, 0.62];

/** the keeper's gallery, railing and entrance as world angles (rad, atan2(dz, dx): 0 east, π/2 south) */
const GAL_FROM = K.gallery.from * DEG;
const GAL_TO = K.gallery.to * DEG;
const RAIL_TO = K.entrance[0] * DEG;
const GAL_OUT = K.gallery.outer;
const RAIL_R = GAL_OUT - 0.08;
/** the gallery's board tops (the hut platform's top, floorY + 0.01) and its framing levels */
const DECK_TOP = K.floorY + 0.01;
const BOARD_T = 0.045;
const RING_R = 0.04;
const RING_Y = DECK_TOP - BOARD_T - RING_R;
const JOIST_R = 0.05;
const JOIST_Y = RING_Y - RING_R - JOIST_R;
/** railing: post tops and the rope's height over the boards */
const RAIL_H = 0.9;
const ROPE_H = 0.42;
/** the railing's lamp post: right of the window as the bridge sees it (the window watches the bridge from 123°) */
const LAMP_TH = 150 * DEG;
/** the mast leans toward the gorge above the cap (m of lean at the top, direction) */
const MAST_LEAN = 0.22;
const MAST_LEAN_DIR: [number, number] = [Math.cos(100 * DEG), Math.sin(100 * DEG)];
const MAST_FOOT_Y = -3.0;
/** where the cap's dome meets the mast (the builder's crown: eave + capHeight − a little) */
const CAP_EXIT_Y = K.floorY + K.wall + K.capHeight - 0.02;

export interface SouthDwellingsBuild {
  /** every mesh, at the identity transform (structures/index.ts moves them into the south group) */
  group: Group;
  walkSurfaces: WalkSurface[];
  bases: [number, number, number][];
  /** the dwellings' own casters against the camera (util/expansionLocality.ts `southVisible`) */
  visible(camera: Camera): boolean;
  triangles: number;
  audit: {
    keeper: {
      centre: [number, number, number];
      radius: number;
      window: [number, number, number];
      door: [number, number, number];
      galleryBoards: number;
      railingPosts: number;
      braces: number;
      props: number;
      footings: number;
      mastTop: [number, number, number];
      pods: [number, number, number][];
      triangles: number;
    };
    waystation: {
      centre: [number, number, number];
      floorY: number;
      floorBoards: number;
      posts: number;
      rafters: number;
      pods: [number, number, number][];
      triangles: number;
    };
    pointLights: number;
    walkSurfaces: number;
  };
}

interface BoardSpec {
  /** the board's top centre (world) */
  centre: Vector3;
  /** unit, along the board (its length) */
  along: Vector3;
  /** unit, across the board (its width), horizontal */
  across: Vector3;
  L: number;
  /** width at the −along end and at the +along end */
  w0: number;
  w1: number;
  t: number;
  tone: number;
  /** 0 weathered silver-grey … 1 a newer, browner replacement */
  age: number;
  moss: number;
  board: number;
  seed: number;
  /** metres broken off the +along end (0: whole) */
  broken?: number;
}

/** one board: a displaced box (cup, bow, soft top edges, a worn tread), uv on one board of the planks map */
function board(p: BoardSpec, noise: Noise2D): BufferGeometry {
  const g = new BoxGeometry(1, 1, 1, 8, 1, 2);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const u0 = BOARD_U0 + p.board * BOARD_W + BOARD_INSET;
  const uW = BOARD_W - 2 * BOARD_INSET;
  const base: RGB = [lerp(1.0, 1.1, p.age), lerp(0.97, 0.9, p.age), lerp(0.93, 0.72, p.age)];
  for (let i = 0; i < pos.count; i++) {
    const bx = pos.getX(i);
    const by = pos.getY(i);
    const bz = pos.getZ(i);
    const nx = nrm.getX(i);
    const ny = nrm.getY(i);
    const nz = nrm.getZ(i);
    const xu = bx * 2;
    const zu = bz * 2;
    let x = bx * p.L;
    if (p.broken && x > 0) {
      const jag = 0.5 + 0.5 * Math.sin(zu * 4.1 + p.seed) * Math.cos(zu * 9.7 + p.seed * 1.7);
      x *= (p.L / 2 - p.broken * (0.4 + 0.6 * jag)) / (p.L / 2);
    }
    const w = lerp(p.w0, p.w1, bx + 0.5);
    const z = bz * w;
    const top = by > 0 ? 1 : 0;
    let y = (by - 0.5) * p.t;
    y += 0.003 * (zu * zu - 0.33) - 0.004 * (1 - xu * xu);
    if (top) y -= 0.004 * smoothstep(0.7, 1, Math.abs(zu)) + 0.003 * smoothstep(0.9, 1, Math.abs(xu));
    pos.setXYZ(i, x, y, z);
    let U: number;
    let V: number;
    if (Math.abs(ny) > 0.5) {
      U = u0 + (zu * 0.5 + 0.5) * uW;
      V = 0.5 + x * 0.41;
    } else if (Math.abs(nz) > 0.5) {
      U = u0 + (nz > 0 ? uW : 0) + (y / p.t) * 0.008;
      V = 0.5 + x * 0.41;
    } else {
      U = u0 + (zu * 0.5 + 0.5) * uW;
      V = 0.5 + x * 0.41 + y * 0.3;
    }
    uv.setXY(i, U, V);
    const grainN = noise.noise(x * 2.3 + p.seed, zu * 1.3 + p.seed * 0.7);
    const tread = 1 + 0.1 * (1 - smoothstep(0.1, 0.45, Math.abs(xu) * 0.5)) * top;
    const damp = 1 - 0.25 * smoothstep(0.62, 1, Math.abs(xu));
    const under = ny < -0.5 ? 0.5 : Math.abs(nz) > 0.5 ? 0.78 : Math.abs(nx) > 0.5 ? 0.7 : 1;
    const shade = p.tone * tread * damp * under * (0.92 + 0.12 * grainN);
    const mossy = p.moss * smoothstep(0.6, 1, Math.abs(xu)) * clamp(0.5 + 0.8 * noise.noise(x * 9 + p.seed, bz * 9), 0, 1) * (ny > 0.5 ? 1 : 0.6);
    col[i * 3] = lerp(base[0] * shade, 0.3, mossy);
    col[i * 3 + 1] = lerp(base[1] * shade, 0.42, mossy);
    col[i * 3 + 2] = lerp(base[2] * shade, 0.1, mossy);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const along = p.along.clone().normalize();
  const across = p.across.clone().normalize();
  const up = new Vector3().crossVectors(across, along).normalize();
  // re-orthogonalise `across` against a sloping `along`
  across.crossVectors(along, up).normalize();
  g.applyMatrix4(new Matrix4().makeBasis(along, up, across).setPosition(p.centre));
  return g;
}

/** a bark pole along `pts`: ridged relief, long grain, grime toward `groundY`, moss on the shaded side */
function barkPole(pts: Vector3[], r0: number, r1: number, noise: Noise2D, seed: number, opts: { tone?: number; moss?: number; groundY?: number; ts?: number; rs?: number; capStart?: boolean; capEnd?: boolean } = {}): BufferGeometry {
  const curve = pts.length === 2 ? new LineCurve3(pts[0], pts[1]) : new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const len = curve.getLength();
  const tone = opts.tone ?? 1;
  const moss = opts.moss ?? 0.35;
  const ts = opts.ts ?? Math.max(3, Math.ceil(len / 0.18));
  const rs = opts.rs ?? (r0 > 0.07 ? 12 : 8);
  const _p = new Vector3();
  return sweepTube(curve, {
    // (the wobble fades out at both ends so an end-grain cap meets the rim exactly)
    radius: (t) => lerp(r0, r1, t) * (1 + 0.035 * Math.sin(t * len * 5.3 + seed) * smoothstep(0, 0.12, t) * smoothstep(1, 0.88, t)),
    tubularSegments: ts,
    radialSegments: rs,
    uvMetres: 0.7,
    capStart: opts.capStart,
    capEnd: opts.capEnd,
    displace: (t, ang) => {
      const coarse = (noise.ridged(ang * 1.3 + seed * 2.1, t * len * 1.6, 2) - 0.5) * 0.28 * lerp(r0, r1, t);
      const fine = (woodGrain(noise, t * len, ang, 16, 1.2, seed + 11) - 0.5) * 0.06 * lerp(r0, r1, t);
      return (coarse + fine) * (1 - smoothstep(0.97, 1, t)) * (1 - smoothstep(0.03, 0, t));
    },
    color: (t, ang, up) => {
      curve.getPointAt(t, _p);
      const fine = woodGrain(noise, t * len, ang, 16, 1.2, seed + 11);
      const coarse = noise.ridged(ang * 1.3 + seed * 2.1, t * len * 1.6, 2);
      const furrow = lerp(0.62, 1.1, 0.5 * fine + 0.5 * coarse);
      const bleach = 1 + 0.12 * Math.max(0, up);
      const grime = opts.groundY === undefined ? 1 : lerp(0.72, 1, smoothstep(0, 0.5, _p.y - opts.groundY));
      const d = 0.62 * tone * furrow * bleach * grime;
      // the shaded side's moss (the relief's cracks first), more near the ground
      const side = Math.max(0, Math.cos(ang) * 0.5 + 0.5);
      const low = opts.groundY === undefined ? 0.5 : 1 - smoothstep(0.2, 1.4, _p.y - opts.groundY);
      const m = moss * smoothstep(0.35, 0.8, side * (0.6 + 0.6 * low) * (1.1 - fine * 0.5)) * (1 - Math.max(0, up) * 0.4);
      return [lerp(d, 0.22, m), lerp(d * 0.92, 0.29, m), lerp(d * 0.83, 0.07, m)];
    },
  });
}

/** a peeled pole (the top rail, the davit's crossbar): pale long grain, polished paler on its top */
function peeledPole(pts: Vector3[], r: number, noise: Noise2D, seed: number, polish = 0.25): BufferGeometry {
  const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const len = curve.getLength();
  return sweepTube(curve, {
    radius: (t) => r * (1 + 0.05 * Math.sin(t * len * 3.1 + seed) * smoothstep(0, 0.05, t) * smoothstep(1, 0.95, t)),
    tubularSegments: Math.max(4, Math.ceil(len / 0.12)),
    radialSegments: 8,
    uvMetres: 0.5,
    displace: (t, ang) => 0.003 * Math.sin(ang * 5 + t * len * 7 + seed) * smoothstep(0, 0.05, t) * smoothstep(1, 0.95, t),
    color: (t, ang, up) => {
      const g = woodGrain(noise, t * len, ang, 14, 1.4, seed);
      const k = (0.62 + 0.26 * g) * (1 + polish * smoothstep(0.2, 0.9, up));
      return [0.95 * k * WOOD_ON_FENCE_WOOD[0], 0.86 * k * WOOD_ON_FENCE_WOOD[1], 0.7 * k * WOOD_ON_FENCE_WOOD[2]];
    },
  });
}

/** a laid rope along `pts` (sagging where the caller put the points) */
function ropeAlong(pts: Vector3[], r: number, noise: Noise2D, seed: number, tint: RGB = [0.62, 0.52, 0.36]): BufferGeometry {
  return ropeTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), r, seed, tint, noise, seed * 3.1);
}

/** `turns` turns of rope round a (nearly vertical) post centred on `c`, radius `r` */
function lashRound(c: Vector3, r: number, turns: number, rise: number, ropeR: number, noise: Noise2D, seed: number): BufferGeometry {
  const pts: Vector3[] = [];
  const n = Math.ceil(turns * 12);
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    const ang = seed + s * turns * TAU;
    pts.push(new Vector3(c.x + Math.cos(ang) * r, c.y + (s - 0.5) * turns * rise, c.z + Math.sin(ang) * r));
  }
  return ropeAlong(pts, ropeR, noise, seed, [0.55, 0.45, 0.3]);
}

/** a sagging span between two points (`sag` m at the middle) */
function sagPts(a: Vector3, b: Vector3, sag: number, n = 6): Vector3[] {
  const out: Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    out.push(a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0)));
  }
  return out;
}

/** scale a geometry's vertex colours per channel */
function scaleColors(geo: BufferGeometry, k: RGB): void {
  const c = geo.attributes.color;
  if (!c) return;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * k[0], c.getY(i) * k[1], c.getZ(i) * k[2]);
  c.needsUpdate = true;
}

export function buildSouthDwellings(ctx: WorldContext, mats: StructureMaterials, rng: Rng, rope: Material): SouthDwellingsBuild {
  const group = new Group();
  group.name = 'south-dwellings';
  const terrain = ctx.terrain;
  const seed = `${ctx.config.seed}/structures/south-dwellings`;
  const noise = new Noise2D(`${seed}/wood`);
  const tuftNoise = new Noise3D(rng.fork('moss-noise'));
  const walkSurfaces: WalkSurface[] = [];
  const bases: [number, number, number][] = [];
  const casters: Caster[] = [];
  const noWall = { r: 0, half: -1, gap: [0, 0] as [number, number] };
  /** a closed disc the character cannot enter (centre, radius) */
  const solidDisc = (id: string, x: number, z: number, r: number, y: number): WalkSurface => ({
    id,
    disc: { x, z, r: 0, y },
    deck: { a: [x, y, z], b: [x, y, z], hw: 0 },
    wall: { r: r / 2, half: r / 2, gap: [0, -1e-6] },
  });
  /** a walkable deck from a to b (their tops), half width hw, no wall */
  const deckSurface = (id: string, a: Vector3, b: Vector3, hw: number): WalkSurface => ({
    id,
    disc: { x: a.x, z: a.z, r: 0, y: a.y },
    deck: { a: [+a.x.toFixed(4), +a.y.toFixed(4), +a.z.toFixed(4)], b: [+b.x.toFixed(4), +b.y.toFixed(4), +b.z.toFixed(4)], hw },
    wall: noWall,
  });

  // ---- per-material part lists, one mesh per (name, material) at the end ----
  const parts = new Map<string, { mat: Material; cast: boolean; geos: BufferGeometry[] }>();
  const put = (name: string, mat: Material, geo: BufferGeometry, cast = true) => {
    const key = `${name}|${mat.uuid}|${cast}`;
    let p = parts.get(key);
    if (!p) {
      p = { mat, cast, geos: [] };
      parts.set(key, p);
    }
    p.geos.push(geo);
  };
  const endCaps: { name: string; geo: BufferGeometry }[] = [];
  const podGeos: BufferGeometry[] = [];
  const hangerGeos: BufferGeometry[] = [];
  const tuftSpecs: MossTuftSpec[] = [];
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${seed}/foliage`);

  /** a static pod on a hook (a crafted lantern, baked where it hangs: one draw for all of them) */
  const staticPod = (hook: Vector3, drop: number, across: Vector3, r: Rng, scale = 1): Vector3 => {
    hangerGeos.push(lanternHanger(hook, across, scale));
    const rig: LanternRig = buildLantern(hook, drop, mats, r, scale, 'orange');
    const mesh = rig.pivot.children[0] as Mesh;
    const g = (mesh.geometry as BufferGeometry).clone();
    g.translate(hook.x, hook.y, hook.z);
    mesh.geometry.dispose();
    podGeos.push(g);
    return rig.pod.clone();
  };
  /** an end-grain cap on a pole's end (`pts` as the pole's, the same tubular segments) */
  const capPole = (name: string, pts: Vector3[], ts: number, r: number, atStart: boolean, rr: Rng, tint: RGB = [0.6, 0.5, 0.4]) => {
    const curve = pts.length === 2 ? new LineCurve3(pts[0], pts[1]) : new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    endCaps.push({ name, geo: checkedCap(endFrame(curve, ts, atStart), rr, noise, { radius: r, segments: r > 0.07 ? 12 : 8, color: tint, checks: 2 + Math.floor(rr() * 2), depth: [0.004, 0.012], dome: 0.004, uvMetres: 0.7 }) });
  };

  // =====================================================================================
  // the bridge keeper's hut
  // =====================================================================================
  const kRng = rng.fork('keeper');
  const cx = K.centre[0];
  const cz = K.centre[1];
  const gy0 = terrain.height(cx, cz);
  const leanAt = (y: number) => MAST_LEAN * Math.pow(smoothstep(CAP_EXIT_Y, K.mast.top, y), 1.5);
  const mastAxis = (y: number, out = new Vector3()) => out.set(cx + MAST_LEAN_DIR[0] * leanAt(y), y, cz + MAST_LEAN_DIR[1] * leanAt(y));
  const mastR = (y: number) => K.mast.radius * (1 - 0.25 * clamp((y - gy0) / 7, 0, 1));
  const seat: TrunkSeat = {
    id: 'keeper-mast',
    x: cx,
    y: gy0,
    z: cz,
    yaw: 0,
    scale: 1,
    radiusAt: (h) => mastR(gy0 + h),
    axisAt: (h, out = new Vector3()) => mastAxis(gy0 + h, out),
    bareHeight: K.mast.top - gy0,
  };
  const keeperDef: DistantHouseDef = {
    id: 'south-keeper',
    host: { x: cx, z: cz, source: 'layout EXPANSION_SOUTH_DWELLINGS.keeper (its own mast, expansionSouthDwellings.ts)' },
    offset: [0, 0],
    floor: 0,
    floorAbsolute: K.floorY,
    radius: K.radius,
    wall: K.wall,
    capHeight: K.capHeight,
    facingDeg: K.facingDeg,
    doorDeg: K.doorDeg,
    walkway: { deg: 0, length: 0, none: true },
    // no builder pod: its eave pod would hang at chest height over the gallery's walk; the gallery's
    // own pods hang from the gate post and the lamp post, clear of it
    pods: 1,
    dressing: { interior: true, fringe: true, interiorLight: 0.3 },
    // herbs drying by the door (compass −100°), flowers on the ledge of the window that watches the bridge, a brow over it
    character: { flowerBox: true, awning: true, herbs: { deg: -67 } },
  };
  const hutCtx: WorldContext = { ...ctx, shared: { ...ctx.shared, trunkSeats: [seat] } };
  const hut = buildDistantHouses(hutCtx, mats, kRng.fork('hut'), [keeperDef]);
  const hutAudit = hut.audit[0];
  const platR = hutAudit.radius + 0.22;
  const keeperPods: Vector3[] = [];
  // the builder's crafted lanterns baked where they hang (static, one draw with the rest)
  for (const rig of hut.lanterns) {
    const mesh = rig.pivot.children[0] as Mesh;
    const g = (mesh.geometry as BufferGeometry).clone();
    g.translate(rig.pivot.position.x, rig.pivot.position.y, rig.pivot.position.z);
    mesh.geometry.dispose();
    rig.pivot.removeFromParent();
    podGeos.push(g);
    keeperPods.push(rig.pod.clone());
  }
  for (const child of [...hut.group.children]) {
    const m = child as Mesh;
    if (!m.isMesh) continue;
    // the hut's planks onto the bridge planks' material (one bucket; the tints rescaled to land where they did)
    if (m.name.startsWith('distant-house-planks:')) {
      scaleColors(m.geometry, WOOD_ON_FENCE_WOOD);
      m.material = mats.fenceWood;
    }
    group.add(m);
  }
  if (hut.soffit) group.add(hut.soffit);
  walkSurfaces.push(...hut.walk);
  const hutTris = hut.triangles;

  // ---- the mast: a trimmed snag from under the slope to its broken top ----
  const mastPts: Vector3[] = [];
  for (let y = MAST_FOOT_Y; y < K.mast.top - 1e-6; y += 0.5) mastPts.push(mastAxis(y));
  mastPts.push(mastAxis(K.mast.top));
  const mastCurve = new CatmullRomCurve3(mastPts, false, 'catmullrom', 0.5);
  const mastLen = mastCurve.getLength();
  const mastTs = 40;
  const _mp = new Vector3();
  const mastGeo = sweepTube(mastCurve, {
    radius: (t) => {
      mastCurve.getPointAt(t, _mp);
      return mastR(_mp.y);
    },
    tubularSegments: mastTs,
    radialSegments: 18,
    uvMetres: 1.1,
    displace: (t, ang) => {
      const along = t * mastLen;
      const ridges = (noise.ridged(ang * 2.2 + 3.1, along * 0.9, 2) - 0.5) * 0.05;
      const fine = (woodGrain(noise, along, ang, 22, 0.8, 5) - 0.5) * 0.012;
      // a few trimmed branch scars (swellings) up the pole
      const scar = 0.025 * Math.exp(-(((along - 5.9) / 0.12) ** 2)) * Math.max(0, Math.cos(ang - 2.1)) + 0.02 * Math.exp(-(((along - 7.4) / 0.1) ** 2)) * Math.max(0, Math.cos(ang + 1.2));
      return (ridges + fine + scar) * (1 - smoothstep(0.985, 1, t));
    },
    color: (t, ang, up) => {
      mastCurve.getPointAt(t, _mp);
      const along = t * mastLen;
      const ridge = noise.ridged(ang * 2.2 + 3.1, along * 0.9, 2);
      const fine = woodGrain(noise, along, ang, 22, 0.8, 5);
      const furrow = lerp(0.55, 1.12, 0.55 * ridge + 0.45 * fine);
      // weathered silver-brown, bleached toward the top, grimy and damp at the foot
      const bleach = lerp(0.9, 1.18, smoothstep(0, K.mast.top, _mp.y));
      const ground = terrain.height(_mp.x, _mp.z);
      const grime = lerp(0.62, 1, smoothstep(0, 0.9, _mp.y - ground));
      const d = 0.6 * furrow * bleach * grime;
      // moss on the side the sun misses, below the cap and up out of it a little
      const nx = Math.cos(ang);
      const side = Math.max(0, nx * SHADE_SIDE[0] + Math.sin(ang) * SHADE_SIDE[1]);
      const m = smoothstep(0.35, 0.9, side * (1 - fine * 0.4)) * (1 - smoothstep(CAP_EXIT_Y + 0.6, CAP_EXIT_Y + 1.6, _mp.y)) * 0.7 * (1 - 0.3 * Math.max(0, up));
      return [lerp(d * 1.0, 0.24, m), lerp(d * 0.93, 0.31, m), lerp(d * 0.84, 0.07, m)];
    },
  });
  put('keeper-mast', mats.bark, mastGeo);
  const topFrame = endFrame(mastCurve, mastTs);
  endCaps.push({ name: 'keeper-mast', geo: checkedCap(topFrame, kRng.fork('mast-top'), noise, { radius: mastR(K.mast.top) * 0.97, segments: 18, color: [0.56, 0.48, 0.4], checks: 4, depth: [0.01, 0.03], dome: -0.02, uvMetres: 0.8 }) });
  // the broken top's splinters: tapered slivers standing out of the rim
  {
    const spl = kRng.fork('splinters');
    const top = mastAxis(K.mast.top);
    const rTop = mastR(K.mast.top);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + spl.range(-0.3, 0.3);
      const h = 0.1 + spl() * 0.32 * (i % 2 ? 0.5 : 1);
      const foot = new Vector3(top.x + Math.cos(a) * rTop * 0.82, top.y - 0.03, top.z + Math.sin(a) * rTop * 0.82);
      const tip = foot.clone().add(new Vector3(Math.cos(a) * 0.04 * spl(), h, Math.sin(a) * 0.04 * spl()));
      put(
        'keeper-mast',
        mats.bark,
        sweepTube(new LineCurve3(foot, tip), { radius: (t) => 0.045 * (1 - t) + 0.003, tubularSegments: 3, radialSegments: 5, uvMetres: 0.4, color: (t) => [0.62 + 0.1 * t, 0.53 + 0.08 * t, 0.43 + 0.06 * t] }),
      );
    }
  }
  bases.push([cx, gy0, cz]);

  // roots gripping the lip: down the slope on the gorge side, into the turf on the uphill side
  {
    const rr = kRng.fork('roots');
    for (const a of [35, 80, 128, 205, 300]) {
      const ang = (a + rr.range(-10, 10)) * DEG;
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      const pts: Vector3[] = [];
      const reach = a > 180 ? 0.9 : 1.2;
      for (let k = 0; k <= 5; k++) {
        const d = 0.18 + (k / 5) * reach;
        const x = cx + dx * d;
        const z = cz + dz * d;
        pts.push(new Vector3(x, terrain.height(x, z) + 0.05 - 0.07 * (k / 5), z));
      }
      pts[0].y += 0.12;
      put('keeper-mast', mats.bark, barkPole(pts, 0.11, 0.025, noise, 30 + a, { tone: 0.78, moss: 0.5, rs: 8 }));
      tuftSpecs.push(...footMoss(ctx, pts[1], rr.fork(`moss/${a}`), { postRadius: 0.1, count: 8, size: [0.025, 0.05], color: FOOT_MOSS, favour: SHADE_SIDE }));
    }
  }

  // the collar where the mast leaves the cap: a bark roll and moss cushions on it
  {
    const cr = kRng.fork('collar');
    const c0 = mastAxis(CAP_EXIT_Y + 0.03);
    const rC = mastR(CAP_EXIT_Y) + 0.035;
    const ring: Vector3[] = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      ring.push(new Vector3(c0.x + Math.cos(a) * rC, c0.y + 0.015 * Math.sin(3 * a), c0.z + Math.sin(a) * rC));
    }
    put('keeper-mast', mats.bark, sweepTube(new CatmullRomCurve3(ring, true), { radius: () => 0.055, tubularSegments: 32, radialSegments: 8, uvMetres: 0.5, color: (_t, _a, up) => [0.46 + 0.12 * up, 0.42 + 0.1 * up, 0.33 + 0.06 * up] }));
    for (let i = 0; i < 26; i++) {
      const a = cr() * TAU;
      const d = rC + 0.02 + cr() * 0.12;
      const p = new Vector3(c0.x + Math.cos(a) * d, c0.y + 0.03 - (d - rC) * 0.35, c0.z + Math.sin(a) * d);
      const n = new Vector3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize();
      const rad = 0.035 + cr() * 0.04;
      const bright = 0.35 + 0.4 * cr();
      tuftSpecs.push({ position: p, normal: n, rx: rad, rz: rad * (0.8 + cr() * 0.4), h: rad * (0.6 + cr() * 0.4), yaw: cr() * TAU, color: [lerp(MOSS_DEEP[0], MOSS_SUN[0], bright) * 1.5, lerp(MOSS_DEEP[1], MOSS_SUN[1], bright) * 1.5, lerp(MOSS_DEEP[2], MOSS_SUN[2], bright) * 1.5], uv: [p.x / 1.6, p.z / 1.6], sink: rad * 0.4, seed: 1 + Math.floor(cr() * 1e6) });
    }
    foliage.addLeafCluster(c0.clone().add(new Vector3(-0.2, 0.05, 0.18)), 0.1, 6, { size: 0.08, droop: 0.35, flatten: 0.5 });
  }

  // ---- the beacon: a stub arm out of the mast's head over the gorge, a pod on it, its hauling rope to a cleat ----
  {
    const br = kRng.fork('beacon');
    const armY = K.mast.top - 0.42;
    const from = mastAxis(armY);
    const dir = new Vector3(Math.cos(95 * DEG), 0.3, Math.sin(95 * DEG)).normalize();
    const tip = from.clone().addScaledVector(dir, 0.72);
    const armPts = [from.clone().addScaledVector(dir, -0.05), from.clone().addScaledVector(dir, 0.36).add(new Vector3(0, -0.02, 0)), tip];
    put('keeper-beacon', mats.bark, barkPole(armPts, 0.075, 0.04, noise, 71, { tone: 0.95, moss: 0.2, capEnd: false }));
    capPole('keeper-beacon', armPts, Math.max(3, Math.ceil(0.77 / 0.18)), 0.04, false, br.fork('cap'));
    const hook = tip.clone().addScaledVector(dir, -0.06).add(new Vector3(0, -0.045, 0));
    keeperPods.push(staticPod(hook, 0.3, new Vector3(-dir.z, 0, dir.x), br.fork('pod'), 1.1));
    // the hauling rope: from a ring on the arm down the mast's gorge side to a cleat over the cap
    const cleatY = CAP_EXIT_Y + 0.55;
    const cleatAt = mastAxis(cleatY);
    const cleatDir = new Vector3(Math.cos(80 * DEG), 0, Math.sin(80 * DEG));
    const cleatFoot = cleatAt.clone().addScaledVector(cleatDir, mastR(cleatY) - 0.02);
    const cleatTip = cleatFoot.clone().addScaledVector(cleatDir, 0.12).add(new Vector3(0, 0.03, 0));
    put('keeper-beacon', mats.bark, barkPole([cleatFoot, cleatTip], 0.022, 0.016, noise, 72, { moss: 0, ts: 2, rs: 6, capEnd: true }));
    const ringAt = from.clone().addScaledVector(dir, 0.42).add(new Vector3(0, -0.05, 0));
    const mid = ringAt.clone().lerp(cleatTip, 0.5).addScaledVector(cleatDir, 0.05);
    put('keeper-rope', rope, ropeAlong([ringAt, mid, cleatTip.clone().add(new Vector3(0, 0.01, 0))], 0.009, noise, 73));
    put('keeper-rope', rope, lashRound(cleatTip.clone().addScaledVector(cleatDir, -0.05), 0.03, 2, 0.012, 0.008, noise, 74));
    // the coil's tail hanging from the cleat
    put('keeper-rope', rope, ropeAlong([cleatTip.clone().add(new Vector3(0, -0.01, 0)), cleatTip.clone().add(new Vector3(0.02, -0.2, 0.01)), cleatTip.clone().add(new Vector3(0.0, -0.36, 0.03))], 0.009, noise, 75));
  }

  // ---- the gallery: boards over ring beams over outriggers, braced or propped ----
  const kBlockersEarly: WalkSurface[] = [];
  const galRng = kRng.fork('gallery');
  const galArc = GAL_TO - GAL_FROM;
  const midR = (platR + GAL_OUT) / 2;
  const boardCount = Math.round((galArc * midR) / 0.168);
  const step = galArc / boardCount;
  let boards = 0;
  for (let i = 0; i < boardCount; i++) {
    const th = GAL_FROM + (i + 0.5) * step + galRng.range(-0.08, 0.08) * step;
    const out = new Vector3(Math.cos(th), 0, Math.sin(th));
    const tan = new Vector3(-Math.sin(th), 0, Math.cos(th));
    const r0 = platR - 0.03 + galRng.range(-0.01, 0.02);
    const r1 = GAL_OUT + galRng.range(-0.04, 0.05);
    const L = r1 - r0;
    const centre = new Vector3(cx + out.x * (r0 + L / 2), DECK_TOP + galRng.range(-0.004, 0.004), cz + out.z * (r0 + L / 2));
    const replaced = i === Math.floor(boardCount * 0.37);
    const broken = i === Math.floor(boardCount * 0.62) ? 0.22 : 0;
    put(
      'keeper-gallery',
      mats.fenceWood,
      board(
        {
          centre,
          along: out,
          across: tan,
          L,
          w0: step * r0 - 0.012,
          w1: step * r1 - 0.014,
          t: BOARD_T,
          tone: 0.62 + galRng() * 0.3,
          age: replaced ? 0.85 : galRng() * 0.25,
          moss: galRng() < 0.3 ? 0.5 + galRng() * 0.4 : galRng() * 0.2,
          board: Math.floor(galRng() * 8),
          seed: galRng() * 100,
          broken,
        },
        noise,
      ),
    );
    boards++;
  }
  // ring beams (under the boards, on the outriggers) and the outriggers out of the platform's rim
  for (const rb of [platR + 0.15, GAL_OUT - 0.13]) {
    const pts: Vector3[] = [];
    const n = Math.ceil(galArc / (6 * DEG));
    for (let k = 0; k <= n; k++) {
      const th = GAL_FROM - 1.5 * DEG + ((galArc + 3 * DEG) * k) / n;
      pts.push(new Vector3(cx + Math.cos(th) * rb, RING_Y + 0.004 * Math.sin(k * 1.7), cz + Math.sin(th) * rb));
    }
    put('keeper-gallery', mats.bark, barkPole(pts, RING_R, RING_R * 0.95, noise, 80 + rb, { tone: 0.9, moss: 0.25, ts: n * 2, rs: 8 }));
    capPole('keeper-gallery', pts, n * 2, RING_R, true, galRng.fork(`ring-a/${rb}`));
    capPole('keeper-gallery', pts, n * 2, RING_R * 0.95, false, galRng.fork(`ring-b/${rb}`));
  }
  const joistCount = Math.max(6, Math.round(galArc / (24 * DEG)) + 1);
  let braces = 0;
  let footings = 0;
  const braceR = kRng.fork('braces');
  for (let k = 0; k < joistCount; k++) {
    const th = GAL_FROM + 1.2 * DEG + ((galArc - 2.4 * DEG) * k) / (joistCount - 1);
    const out = new Vector3(Math.cos(th), 0, Math.sin(th));
    const a = new Vector3(cx + out.x * (platR - 0.1), JOIST_Y, cz + out.z * (platR - 0.1));
    const b = new Vector3(cx + out.x * (GAL_OUT + 0.08), JOIST_Y - 0.01, cz + out.z * (GAL_OUT + 0.08));
    put('keeper-gallery', mats.bark, barkPole([a, b], JOIST_R, JOIST_R * 0.9, noise, 90 + k, { tone: 0.88, moss: 0.3, ts: 5, rs: 8 }));
    capPole('keeper-gallery', [a, b], 5, JOIST_R * 0.9, false, braceR.fork(`joist/${k}`));
    // a raking brace to the mast where the slope falls clear under it, else a prop to the ground
    const top = new Vector3(cx + out.x * 1.95, JOIST_Y - JOIST_R, cz + out.z * 1.95);
    const mastY = -1.3;
    const foot = mastAxis(mastY).addScaledVector(out, mastR(mastY) - 0.02);
    let clear = true;
    for (let s = 0.05; s <= 0.95; s += 0.1) {
      const p = top.clone().lerp(foot, s);
      if (terrain.height(p.x, p.z) > p.y - 0.1) clear = false;
    }
    if (clear) {
      put('keeper-braces', mats.bark, barkPole([top, foot], 0.045, 0.04, noise, 100 + k, { tone: 0.85, moss: 0.4, ts: 6, rs: 8 }));
      put('keeper-rope', rope, lashRound(top.clone().add(new Vector3(0, 0.03, 0)), 0.06, 1.5, 0.02, 0.009, noise, 110 + k));
      braces++;
      continue;
    }
    const gy = terrain.height(top.x, top.z);
    const drop = top.y - gy;
    if (drop > 2.4) continue;
    if (drop < 0.3) {
      // the outrigger rests on a sunk log round
      const r0 = new Vector3(top.x, gy - 0.12, top.z);
      const r1 = new Vector3(top.x, top.y - 0.005, top.z);
      put('keeper-gallery', mats.bark, barkPole([r0, r1], 0.1, 0.095, noise, 120 + k, { moss: 0.5, groundY: gy, ts: 2, rs: 10 }));
      capPole('keeper-gallery', [r0, r1], 2, 0.095, false, braceR.fork(`round/${k}`));
      bases.push([top.x, gy, top.z]);
      tuftSpecs.push(...footMoss(ctx, new Vector3(top.x, gy, top.z), braceR.fork(`round-moss/${k}`), { postRadius: 0.1, count: 8, color: FOOT_MOSS, favour: SHADE_SIDE }));
    } else {
      const p0 = new Vector3(top.x, gy - 0.25, top.z);
      const p1 = new Vector3(top.x, top.y + 0.02, top.z);
      put('keeper-braces', mats.bark, barkPole([p0, p1], 0.05, 0.045, noise, 130 + k, { moss: 0.45, groundY: gy, ts: 4, rs: 8 }));
      put('keeper-rope', rope, lashRound(top.clone().add(new Vector3(0, -0.04, 0)), 0.058, 1.5, 0.02, 0.009, noise, 140 + k));
      bases.push([top.x, gy, top.z]);
      tuftSpecs.push(...footMoss(ctx, new Vector3(top.x, gy, top.z), braceR.fork(`post-moss/${k}`), { postRadius: 0.05, count: 10, color: FOOT_MOSS, favour: SHADE_SIDE }));
    }
    footings++;
  }
  // the braces' collar round the mast
  if (braces > 0) {
    put('keeper-rope', rope, lashRound(mastAxis(-1.27), mastR(-1.27) + 0.03, 2.5, 0.025, 0.012, noise, 150));
  }

  // ---- the railing: bark posts under a peeled top rail, a rope midrail, a gate post with a pod ----
  const railRng = kRng.fork('railing');
  const railArc = RAIL_TO - GAL_FROM;
  const posts = Math.round((railArc * RAIL_R) / 0.7) + 1;
  const postTh = (k: number) => GAL_FROM + 0.6 * DEG + ((railArc - 1.2 * DEG) * k) / (posts - 1);
  // the lamp post: the railing post facing the bridge's middle
  let lampK = 0;
  for (let k = 1; k < posts - 1; k++) if (Math.abs(postTh(k) - LAMP_TH) < Math.abs(postTh(lampK) - LAMP_TH)) lampK = k;
  const postTops: Vector3[] = [];
  const ropePts: Vector3[] = [];
  for (let k = 0; k < posts; k++) {
    const th = postTh(k);
    const out = new Vector3(Math.cos(th), 0, Math.sin(th));
    const gate = k === posts - 1;
    const lamp = k === lampK;
    const tall = gate || lamp;
    const h = gate ? 2.25 : lamp ? 1.95 : RAIL_H + railRng.range(-0.02, 0.03);
    const p0 = new Vector3(cx + out.x * RAIL_R, JOIST_Y - 0.08, cz + out.z * RAIL_R);
    const p1 = new Vector3(cx + out.x * (RAIL_R + (tall ? 0.01 : 0.02)), DECK_TOP + h, cz + out.z * (RAIL_R + (tall ? 0.01 : 0.02)));
    const ts = tall ? 10 : 6;
    put('keeper-rail-posts', mats.bark, barkPole([p0, p1], tall ? 0.055 : 0.045, tall ? 0.042 : 0.037, noise, 160 + k, { tone: 0.9, moss: 0.3, ts, rs: 8 }));
    capPole('keeper-rail-posts', [p0, p1], ts, tall ? 0.042 : 0.037, false, railRng.fork(`cap/${k}`));
    const railY = DECK_TOP + RAIL_H - 0.03;
    postTops.push(p0.clone().lerp(p1, (railY - p0.y) / (p1.y - p0.y)));
    const rp = p0.clone().lerp(p1, (DECK_TOP + ROPE_H - p0.y) / (p1.y - p0.y));
    ropePts.push(rp.addScaledVector(out, 0.045));
    put('keeper-rope', rope, lashRound(new Vector3(cx + out.x * (RAIL_R + 0.012), DECK_TOP + ROPE_H, cz + out.z * (RAIL_R + 0.012)), 0.052, 1.5, 0.018, 0.009, noise, 170 + k));
    // lashed to the outer ring beam at its foot
    put('keeper-rope', rope, lashRound(new Vector3(cx + out.x * (RAIL_R - 0.02), RING_Y, cz + out.z * (RAIL_R - 0.02)), 0.075, 1.5, 0.02, 0.009, noise, 180 + k));
    if (gate) {
      // the gate post's pod: on a short bracket out over the entrance's edge, high enough to walk under
      const into = new Vector3(Math.cos(th + 12 * DEG), 0, Math.sin(th + 12 * DEG));
      const bFrom = p1.clone().add(new Vector3(0, -0.14, 0));
      const bTip = bFrom.clone().addScaledVector(into, 0.3).addScaledVector(out, 0.1).add(new Vector3(0, 0.05, 0));
      const bPts = [bFrom, bFrom.clone().lerp(bTip, 0.5).add(new Vector3(0, 0.02, 0)), bTip];
      put('keeper-rail-posts', mats.bark, barkPole(bPts, 0.032, 0.022, noise, 199, { moss: 0.1, ts: 4, rs: 6 }));
      capPole('keeper-rail-posts', bPts, 4, 0.022, false, railRng.fork('gate-cap'));
      const hook = bTip.clone().add(new Vector3(0, -0.035, 0)).addScaledVector(into, -0.04);
      keeperPods.push(staticPod(hook, 0.2, out, railRng.fork('gate-pod'), 0.95));
      foliage.addLeafCluster(p1.clone().add(new Vector3(0, 0.02, 0)), 0.11, 8, { size: 0.085, droop: 0.4, flatten: 0.5 });
    } else if (lamp) {
      // the lamp post's pod: on a bracket out over the drop, outside the railing, toward the bridge
      const tan = new Vector3(-out.z, 0, out.x);
      const bFrom = p1.clone().add(new Vector3(0, -0.12, 0));
      const bTip = bFrom.clone().addScaledVector(out, 0.34).addScaledVector(tan, 0.04).add(new Vector3(0, 0.05, 0));
      const bPts = [bFrom, bFrom.clone().lerp(bTip, 0.5).add(new Vector3(0, 0.02, 0)), bTip];
      put('keeper-rail-posts', mats.bark, barkPole(bPts, 0.03, 0.021, noise, 198, { moss: 0.1, ts: 4, rs: 6 }));
      capPole('keeper-rail-posts', bPts, 4, 0.021, false, railRng.fork('lamp-cap'));
      keeperPods.push(staticPod(bTip.clone().add(new Vector3(0, -0.033, 0)).addScaledVector(out, -0.035), 0.22, tan, railRng.fork('lamp-pod'), 1.0));
      foliage.addLeafCluster(p1.clone().add(new Vector3(0, 0.02, 0)), 0.1, 7, { size: 0.08, droop: 0.45, flatten: 0.5 });
    } else if (k === 0) {
      bases.push([p0.x, terrain.height(p0.x, p0.z), p0.z]);
    }
  }
  // the top rail, a peeled pole along the post tops; the rope midrail sagging between them
  const railPts = postTops.map((p, k) => p.clone().add(new Vector3(0, 0.004 * Math.sin(k * 2.3), 0)));
  put('keeper-rail', mats.fenceWood, peeledPole(railPts, 0.034, noise, 201, 0.35));
  {
    const railCurve = new CatmullRomCurve3(railPts, false, 'catmullrom', 0.5);
    const railTs = Math.max(4, Math.ceil(railCurve.getLength() / 0.12));
    capPole('keeper-rail', railPts, railTs, 0.034, true, railRng.fork('rail-a'), [0.66, 0.56, 0.44]);
    capPole('keeper-rail', railPts, railTs, 0.034, false, railRng.fork('rail-b'), [0.66, 0.56, 0.44]);
  }
  {
    const pts: Vector3[] = [];
    for (let k = 0; k + 1 < ropePts.length; k++) {
      const seg = sagPts(ropePts[k], ropePts[k + 1], 0.045, 4);
      pts.push(...(k === 0 ? seg : seg.slice(1)));
    }
    put('keeper-rope', rope, ropeAlong(pts, 0.013, noise, 205));
  }
  // leaves and a vine on the railing's gorge side
  for (const k of [2, 5, 8]) {
    if (k >= postTops.length - 1) continue;
    const p = postTops[k];
    foliage.addLeafCluster(p.clone().add(new Vector3(0, 0.03, 0)), 0.1, 7, { size: 0.08, droop: 0.45, flatten: 0.5 });
  }
  {
    const vk = Math.min(4, posts - 2);
    const th0 = Math.atan2(postTops[vk].z - cz, postTops[vk].x - cx);
    const vinePts: Vector3[] = [];
    const vineN: Vector3[] = [];
    for (let j = 0; j <= 10; j++) {
      const f = j / 10;
      const th = th0 + f * 0.35;
      const out = new Vector3(Math.cos(th), 0, Math.sin(th));
      vinePts.push(new Vector3(cx + out.x * (RAIL_R + 0.05), DECK_TOP + RAIL_H - 0.02 - 0.5 * Math.sin(f * Math.PI) * 0.4 - f * 0.25, cz + out.z * (RAIL_R + 0.05)));
      vineN.push(out);
    }
    foliage.addSurfaceVine(vinePts, vineN, { leafSize: 0.06, thickness: 0.008 });
  }

  // ---- the davit over the drop: a leaning pole lashed to the rail, a block, a bucket on the rope ----
  {
    const dr = kRng.fork('davit');
    const th = 96 * DEG;
    const out = new Vector3(Math.cos(th), 0, Math.sin(th));
    const tan = new Vector3(-Math.sin(th), 0, Math.cos(th));
    // a bent pole socketed through the boards inside the rail, lashed to the top rail, out over the drop
    const foot = new Vector3(cx + out.x * 1.93, DECK_TOP - 0.2, cz + out.z * 1.93).addScaledVector(tan, 0.2);
    const atRail = new Vector3(cx + out.x * (RAIL_R + 0.02), DECK_TOP + RAIL_H - 0.03, cz + out.z * (RAIL_R + 0.02)).addScaledVector(tan, 0.2);
    const tip = new Vector3(cx + out.x * (GAL_OUT + 0.62), DECK_TOP + 1.62, cz + out.z * (GAL_OUT + 0.62)).addScaledVector(tan, 0.2);
    const pts = [foot, atRail, tip];
    put('keeper-davit', mats.bark, barkPole(pts, 0.05, 0.036, noise, 220, { tone: 0.95, moss: 0.25, ts: 10, rs: 8 }));
    capPole('keeper-davit', pts, 10, 0.036, false, dr.fork('cap'));
    put('keeper-rope', rope, lashRound(atRail, 0.058, 2, 0.02, 0.009, noise, 221));
    kBlockersEarly.push(solidDisc('south-keeper-davit', foot.x, foot.z, 0.16, DECK_TOP));
    // the block: a short turned round with a groove, hung under the tip
    const blockTop = tip.clone().add(new Vector3(0, -0.05, 0)).addScaledVector(out, -0.02);
    const block0 = blockTop.clone().add(new Vector3(0, -0.02, 0));
    const block1 = blockTop.clone().add(new Vector3(0, -0.13, 0));
    put('keeper-davit', mats.bark, sweepTube(new LineCurve3(block0, block1), { radius: (t) => 0.045 - 0.012 * Math.sin(t * Math.PI), tubularSegments: 4, radialSegments: 10, uvMetres: 0.3, capStart: true, capEnd: true, color: () => [0.5, 0.42, 0.32] }));
    put('keeper-rope', rope, ropeAlong([tip.clone().add(new Vector3(0, 0.02, 0)), block0], 0.008, noise, 222));
    // the bucket rope and the bucket over the gorge
    const bucketTop = block1.clone().add(new Vector3(0.0, -1.55, 0));
    put('keeper-rope', rope, ropeAlong([block1.clone().addScaledVector(out, 0.03), bucketTop.clone().addScaledVector(out, 0.03).add(new Vector3(0, 0.12, 0))], 0.009, noise, 223));
    const bR0 = 0.12;
    const bR1 = 0.1;
    const bH = 0.24;
    const bc = bucketTop.clone().addScaledVector(out, 0.03);
    const staves = 12;
    for (let s = 0; s < staves; s++) {
      const a0 = (s / staves) * TAU + dr.range(-0.02, 0.02);
      const a1 = ((s + 1) / staves) * TAU;
      const am = (a0 + a1) / 2;
      const rad = new Vector3(Math.cos(am), 0, Math.sin(am));
      const tang = new Vector3(-Math.sin(am), 0, Math.cos(am));
      const top = bc.clone().addScaledVector(rad, bR0 - 0.008);
      const bot = bc.clone().addScaledVector(rad, bR1 - 0.008).add(new Vector3(0, -bH, 0));
      put(
        'keeper-davit',
        mats.fenceWood,
        board({ centre: top.clone().lerp(bot, 0.5).addScaledVector(rad, 0.008), along: bot.clone().sub(top), across: tang, L: bH, w0: (TAU / staves) * bR0 - 0.004, w1: (TAU / staves) * bR1 - 0.004, t: 0.016, tone: 0.7 + dr() * 0.25, age: 0.2 + dr() * 0.3, moss: 0.1, board: s % 8, seed: s * 3.7 }, noise),
      );
    }
    for (const [yOff, rr] of [
      [-0.04, bR0 - 0.001],
      [-bH + 0.04, bR1 + 0.001],
    ] as const) {
      const hoop: Vector3[] = [];
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU;
        hoop.push(new Vector3(bc.x + Math.cos(a) * rr, bc.y + yOff, bc.z + Math.sin(a) * rr));
      }
      put('keeper-rope', rope, ropeTube(new CatmullRomCurve3(hoop, true), 0.008, 3, [0.5, 0.4, 0.27], noise, 9));
    }
    // the bail and the water (dark) inside
    const bail = [bc.clone().addScaledVector(tan, -bR0), bc.clone().add(new Vector3(0, 0.12, 0)), bc.clone().addScaledVector(tan, bR0)];
    put('keeper-davit', mats.bark, sweepTube(new CatmullRomCurve3(bail), { radius: () => 0.008, tubularSegments: 8, radialSegments: 5, uvMetres: 0.2, color: () => [0.45, 0.37, 0.28] }));
    put(
      'keeper-davit',
      mats.fenceWood,
      gridSurface(
        (u, v, o) => {
          const a = u * TAU;
          const rr = (bR1 - 0.012) * v;
          o.position.set(bc.x + Math.cos(a) * rr, bc.y - bH + 0.02, bc.z + Math.sin(a) * rr);
          o.uv = [0.1 + v * 0.05, 0.5];
          o.color = [0.35, 0.3, 0.24];
        },
        { cols: 12, rows: 2, closedU: true },
      ),
    );
    // the hauling end: back from the block to a turn round the next rail post
    const tieAt = new Vector3(cx + out.x * (RAIL_R + 0.01), DECK_TOP + 0.62, cz + out.z * (RAIL_R + 0.01)).addScaledVector(tan, -0.25);
    put('keeper-rope', rope, ropeAlong(sagPts(block1.clone().addScaledVector(out, -0.03), tieAt, 0.06, 5), 0.008, noise, 224));
  }

  // ---- steps: a split log at the entrance, a log at the east end ----
  const kSteps: WalkSurface[] = [];
  {
    const sr = kRng.fork('steps');
    // west: a half log flat side up across the entrance, just off the boards
    const e0 = (K.entrance[0] + 5) * DEG;
    const e1 = (K.entrance[1] - 6) * DEG;
    const rS = GAL_OUT + 0.24;
    const a = new Vector3(cx + Math.cos(e0) * rS, 0, cz + Math.sin(e0) * rS);
    const b = new Vector3(cx + Math.cos(e1) * rS, 0, cz + Math.sin(e1) * rS);
    const top = Math.max(terrain.height(a.x, a.z), terrain.height(b.x, b.z), terrain.height((a.x + b.x) / 2, (a.z + b.z) / 2)) + 0.1;
    kSteps.push(deckSurface('south-keeper-step-west', a.clone().setY(top), b.clone().setY(top), 0.15));
    const halfLog = (p: Vector3, q: Vector3, topY: number, topQ: number, r: number, name: string, tag: string) => {
      const ax = q.clone().sub(p).setY(0);
      const len = ax.length();
      ax.normalize();
      const side = new Vector3(-ax.z, 0, ax.x);
      // the round underside (bark) and the flat split top (planks' material, worn)
      put(
        name,
        mats.bark,
        gridSurface(
          (u, v, o) => {
            const ang = Math.PI * (1 + u);
            const along = lerp(-0.04, len + 0.04, v);
            const y0 = lerp(topY, topQ, v) - 0.005;
            o.position.copy(p).addScaledVector(ax, along).addScaledVector(side, Math.cos(ang) * r);
            o.position.y = y0 + Math.sin(ang) * r * 0.85;
            o.uv = [(ang * r) / 0.7, along / 0.7];
            const ridge = noise.ridged(ang * 3 + 7, along * 2.5, 2);
            const d = 0.5 * lerp(0.7, 1.1, ridge);
            o.color = [d, d * 0.92, d * 0.82];
          },
          { cols: 8, rows: Math.max(3, Math.ceil(len / 0.2)) },
        ),
      );
      const mid = p.clone().lerp(q, 0.5);
      put(name === 'keeper-steps' ? 'keeper-gallery' : 'waystation-floor', mats.fenceWood, board({ centre: mid.setY((topY + topQ) / 2), along: q.clone().setY(topQ).sub(p.clone().setY(topY)), across: side, L: len + 0.08, w0: r * 1.9, w1: r * 1.9, t: 0.02, tone: 0.85, age: 0.35, moss: 0.35, board: Math.floor(sr() * 8), seed: sr() * 50 }, noise));
      tuftSpecs.push(...footMoss(ctx, p.clone().setY(terrain.height(p.x, p.z)), sr.fork(`m0/${tag}`), { postRadius: r, count: 7, color: FOOT_MOSS }));
      tuftSpecs.push(...footMoss(ctx, q.clone().setY(terrain.height(q.x, q.z)), sr.fork(`m1/${tag}`), { postRadius: r, count: 7, color: FOOT_MOSS }));
      bases.push([mid.x, terrain.height(mid.x, mid.z), mid.z]);
    };
    halfLog(a, b, top, top, 0.14, 'keeper-steps', 'west');
    // east: a log laid down the slope beside the gallery's open end, its top rising with the ground
    const th = (K.gallery.from - 6.5) * DEG;
    const out = new Vector3(Math.cos(th), 0, Math.sin(th));
    const p = new Vector3(cx + out.x * (platR + 0.12), 0, cz + out.z * (platR + 0.12));
    const q = new Vector3(cx + out.x * (GAL_OUT - 0.02), 0, cz + out.z * (GAL_OUT - 0.02));
    const tp = Math.max(terrain.height(p.x, p.z) + 0.2, DECK_TOP - 0.5);
    const tq = Math.max(terrain.height(q.x, q.z) + 0.2, tp);
    kSteps.push(deckSurface('south-keeper-step-east', p.clone().setY(tp), q.clone().setY(tq), 0.15));
    halfLog(p, q, tp, tq, 0.13, 'keeper-steps', 'east');
  }

  // ---- by the north wall: firewood stacked under the eave, a chopping block ----
  let keeperProps = 0;
  const kBlockers: WalkSurface[] = [];
  const firewood = (name: string, centre: Vector3, along: Vector3, count: number, rows: number, length: number, fr: Rng, into?: Vector3) => {
    // logs lie across `along` (their ends face out along `into` × up), stacked in rows
    const axis = into ?? new Vector3(-along.z, 0, along.x);
    for (let row = 0; row < rows; row++) {
      const n = count - row;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.155 + fr.range(-0.015, 0.015);
        const base = centre.clone().addScaledVector(along, off);
        const r = 0.055 + fr() * 0.028;
        const gy = Math.max(terrain.height(base.x - axis.x * length * 0.4, base.z - axis.z * length * 0.4), terrain.height(base.x + axis.x * length * 0.4, base.z + axis.z * length * 0.4));
        const y = gy + r + row * 0.13 - 0.01;
        const l = length * (0.88 + fr() * 0.2);
        const p0 = base.clone().addScaledVector(axis, -l / 2 + fr.range(-0.03, 0.03)).setY(y + fr.range(-0.01, 0.01));
        const p1 = base.clone().addScaledVector(axis, l / 2 + fr.range(-0.03, 0.03)).setY(y + fr.range(-0.01, 0.01));
        put(name, mats.bark, barkPole([p0, p1], r, r * 0.97, noise, 300 + row * 10 + i + fr() * 10, { tone: 0.8 + fr() * 0.3, moss: 0.25, ts: 2, rs: 8 }));
        capPole(name, [p0, p1], 2, r, true, fr.fork(`a/${row}/${i}`), [0.72, 0.58, 0.42]);
        capPole(name, [p0, p1], 2, r * 0.97, false, fr.fork(`b/${row}/${i}`), [0.72, 0.58, 0.42]);
        keeperProps++;
      }
    }
  };
  {
    const fr = kRng.fork('firewood');
    const th = 289 * DEG;
    const out = new Vector3(Math.cos(th), 0, Math.sin(th));
    const tan = new Vector3(-Math.sin(th), 0, Math.cos(th));
    const centre = new Vector3(cx + out.x * 1.66, 0, cz + out.z * 1.66);
    firewood('keeper-firewood', centre, tan, 6, 3, 0.46, fr, out);
    // two stakes holding the stack's ends
    for (const s of [-1, 1]) {
      const p = centre.clone().addScaledVector(tan, s * 0.52);
      const gy = terrain.height(p.x, p.z);
      put('keeper-firewood', mats.bark, barkPole([new Vector3(p.x, gy - 0.15, p.z), new Vector3(p.x + s * tan.x * 0.03, gy + 0.46, p.z + s * tan.z * 0.03)], 0.03, 0.024, noise, 330 + s, { moss: 0.3, groundY: gy, ts: 3, rs: 6, capEnd: true }));
      bases.push([p.x, gy, p.z]);
    }
    kBlockers.push(solidDisc('south-keeper-firewood', centre.x, centre.z, 0.55, DECK_TOP));
    // the chopping block: a log round, its top dished and chipped, a split billet against it
    const bth = 326 * DEG;
    const bc = new Vector3(cx + Math.cos(bth) * 2.1, 0, cz + Math.sin(bth) * 2.1);
    const gy = terrain.height(bc.x, bc.z);
    const b0 = new Vector3(bc.x, gy - 0.1, bc.z);
    const b1 = new Vector3(bc.x, gy + 0.36, bc.z);
    put('keeper-firewood', mats.bark, barkPole([b0, b1], 0.21, 0.2, noise, 340, { moss: 0.45, groundY: gy, ts: 3, rs: 14 }));
    endCaps.push({ name: 'keeper-firewood', geo: checkedCap(endFrame(new LineCurve3(b0, b1), 3), fr.fork('block-top'), noise, { radius: 0.2, segments: 14, color: [0.7, 0.58, 0.44], checks: 5, depth: [0.008, 0.02], dome: -0.012, uvMetres: 0.7 }) });
    const lean0 = bc.clone().add(new Vector3(0.24, gy + 0.0, 0.08));
    const lean1 = bc.clone().add(new Vector3(0.2, gy + 0.3, 0.04));
    put('keeper-firewood', mats.bark, barkPole([lean0, lean1], 0.06, 0.058, noise, 341, { moss: 0.1, ts: 2, rs: 7 }));
    capPole('keeper-firewood', [lean0, lean1], 2, 0.058, false, fr.fork('billet'), [0.74, 0.6, 0.44]);
    tuftSpecs.push(...footMoss(ctx, new Vector3(bc.x, gy, bc.z), fr.fork('block-moss'), { postRadius: 0.21, count: 14, color: FOOT_MOSS, favour: SHADE_SIDE }));
    bases.push([bc.x, gy, bc.z]);
    kBlockers.push(solidDisc('south-keeper-block', bc.x + 0.05, bc.z + 0.02, 0.36, gy + 0.36));
    keeperProps += 2;
  }

  // ---- the keeper's walk: the platform (the builder's), the closed hut, the gallery's boards as chords, the railing ----
  const kFloor = DECK_TOP;
  walkSurfaces.push(solidDisc('south-keeper-interior', cx, cz, 1.4, kFloor));
  {
    const chords = 14;
    const rm = (platR + RAIL_R - 0.1) / 2 + 0.02;
    for (let k = 0; k < chords; k++) {
      const t0 = GAL_FROM + (galArc * k) / chords;
      const t1 = GAL_FROM + (galArc * (k + 1)) / chords;
      walkSurfaces.push(deckSurface(`south-keeper-gallery-${k}`, new Vector3(cx + Math.cos(t0) * rm, kFloor, cz + Math.sin(t0) * rm), new Vector3(cx + Math.cos(t1) * rm, kFloor, cz + Math.sin(t1) * rm), 0.36));
    }
  }
  walkSurfaces.push({ id: 'south-keeper-railing', disc: { x: cx, z: cz, r: 0, y: kFloor }, deck: { a: [cx, kFloor, cz], b: [cx, kFloor, cz], hw: 0 }, wall: { r: RAIL_R, half: 0.18, gap: [RAIL_TO, GAL_FROM + TAU] } });
  walkSurfaces.push(...kSteps, ...kBlockers, ...kBlockersEarly);
  casters.push({ x: cx, z: cz, r: GAL_OUT + 0.7, y0: -3.2, y1: K.mast.top + 0.3, shadow: true });

  // =====================================================================================
  // the waystation
  // =====================================================================================
  const wRng = rng.fork('waystation');
  const wa = W.facingDeg * DEG;
  const F = new Vector3(Math.sin(wa), 0, Math.cos(wa));
  const S = new Vector3(F.z, 0, -F.x);
  const at = (a: number, s: number, y: number) => new Vector3(W.centre[0] + F.x * a + S.x * s, y, W.centre[1] + F.z * a + S.z * s);
  const HD = W.depth / 2;
  const HW = W.width / 2;
  const FT = W.floorY;
  const POST_A = HD - 0.055;
  const POST_S = HW - 0.08;
  const frontTop = FT + W.frontHeight;
  const backTop = FT + W.backHeight;
  const PLATE_R = 0.06;
  const RAFTER_R = 0.045;
  /** the roof's underside plane over (a): on the rafters, which sit on the plates */
  const roofU = (a: number) => lerp(backTop, frontTop, (a + POST_A) / (2 * POST_A)) + PLATE_R + 2 * RAFTER_R;
  const wPods: Vector3[] = [];

  // ---- floor: boards along a on two bearer logs along s, the bearers on sunk stumps ----
  const floorBoards = 12;
  const bw = (2 * HW) / floorBoards;
  for (let i = 0; i < floorBoards; i++) {
    const s = -HW + (i + 0.5) * bw;
    const L = 2 * HD + wRng.range(-0.03, 0.04);
    put(
      'waystation-floor',
      mats.fenceWood,
      board({ centre: at(wRng.range(-0.015, 0.015), s, FT + wRng.range(-0.003, 0.003)), along: F, across: S, L, w0: bw - 0.012, w1: bw - 0.012, t: 0.045, tone: 0.62 + wRng() * 0.3, age: i === 7 ? 0.8 : wRng() * 0.3, moss: i < 2 || i > 9 ? 0.4 : wRng() * 0.15, board: Math.floor(wRng() * 8), seed: wRng() * 100 }, noise),
    );
  }
  const BEARER_R = 0.075;
  const bearerY = FT - 0.045 - BEARER_R;
  let wPosts = 0;
  for (const a of [-0.48, 0.48]) {
    const p0 = at(a, -HW - 0.08, bearerY);
    const p1 = at(a, HW + 0.06, bearerY + 0.005);
    put('waystation-floor', mats.bark, barkPole([p0, p1], BEARER_R, BEARER_R * 0.93, noise, 400 + a * 10, { tone: 0.85, moss: 0.35, ts: 6, rs: 10 }));
    capPole('waystation-floor', [p0, p1], 6, BEARER_R, true, wRng.fork(`bearer-a/${a}`));
    capPole('waystation-floor', [p0, p1], 6, BEARER_R * 0.93, false, wRng.fork(`bearer-b/${a}`));
    for (const s of [-0.72, 0.1, 0.8]) {
      const c = at(a, s, 0);
      const gy = terrain.height(c.x, c.z);
      const topY = bearerY - BEARER_R + 0.01;
      if (gy > topY - 0.05) continue;
      put('waystation-floor', mats.bark, barkPole([new Vector3(c.x, gy - 0.2, c.z), new Vector3(c.x, topY, c.z)], 0.1, 0.095, noise, 410 + s * 10 + a, { moss: 0.5, groundY: gy, ts: 2, rs: 10 }));
      capPole('waystation-floor', [new Vector3(c.x, gy - 0.2, c.z), new Vector3(c.x, topY, c.z)], 2, 0.095, false, wRng.fork(`stump/${a}/${s}`));
      tuftSpecs.push(...footMoss(ctx, new Vector3(c.x, gy, c.z), wRng.fork(`stump-moss/${a}/${s}`), { postRadius: 0.1, count: 8, color: FOOT_MOSS, favour: SHADE_SIDE }));
      bases.push([c.x, gy, c.z]);
    }
  }

  // ---- frame: four corner posts, the plates, five rafters ----
  const postTop = (a: number) => (a > 0 ? frontTop : backTop);
  const postAt: Vector3[] = [];
  for (const a of [-POST_A, POST_A]) {
    for (const s of [-POST_S, POST_S]) {
      const c = at(a, s, 0);
      const gy = terrain.height(c.x, c.z);
      const p0 = new Vector3(c.x, gy - 0.3, c.z);
      const p1 = new Vector3(c.x + wRng.range(-0.01, 0.01), postTop(a) + PLATE_R * 0.4, c.z + wRng.range(-0.01, 0.01));
      put('waystation-posts', mats.bark, barkPole([p0, p1], 0.068, 0.056, noise, 420 + wPosts, { tone: 0.92, moss: 0.4, groundY: gy, ts: 8, rs: 10 }));
      capPole('waystation-posts', [p0, p1], 8, 0.056, false, wRng.fork(`post-cap/${wPosts}`));
      tuftSpecs.push(...footMoss(ctx, new Vector3(c.x, gy, c.z), wRng.fork(`post-moss/${wPosts}`), { postRadius: 0.068, count: 12, color: FOOT_MOSS, favour: SHADE_SIDE }));
      bases.push([c.x, gy, c.z]);
      postAt.push(p1);
      wPosts++;
    }
  }
  for (const a of [-POST_A, POST_A]) {
    const y = postTop(a);
    const p0 = at(a, -HW - 0.16, y + wRng.range(-0.01, 0.01));
    const p1 = at(a, HW + 0.18, y + wRng.range(-0.01, 0.01));
    put('waystation-posts', mats.bark, barkPole([p0, p1], PLATE_R, PLATE_R * 0.9, noise, 440 + a * 10, { tone: 0.9, moss: 0.2, ts: 8, rs: 10 }));
    capPole('waystation-posts', [p0, p1], 8, PLATE_R, true, wRng.fork(`plate-a/${a}`));
    capPole('waystation-posts', [p0, p1], 8, PLATE_R * 0.9, false, wRng.fork(`plate-b/${a}`));
    for (const s of [-POST_S, POST_S]) put('waystation-rope', rope, lashRound(at(a, s, y), 0.085, 2, 0.03, 0.01, noise, 450 + a * 10 + s));
  }
  const rafters = 5;
  for (let k = 0; k < rafters; k++) {
    const s = lerp(-HW + 0.02, HW - 0.02, k / (rafters - 1)) + wRng.range(-0.03, 0.03);
    const ya = (a: number) => roofU(a) - RAFTER_R;
    const p0 = at(-POST_A - 0.24, s, ya(-POST_A - 0.24));
    const p1 = at(POST_A + 0.28, s, ya(POST_A + 0.28));
    const mid = p0.clone().lerp(p1, 0.5).add(new Vector3(0, 0.012, 0));
    put('waystation-posts', mats.bark, barkPole([p0, mid, p1], RAFTER_R, RAFTER_R * 0.85, noise, 460 + k, { tone: 0.95, moss: 0.15, ts: 8, rs: 8 }));
    capPole('waystation-posts', [p0, mid, p1], 8, RAFTER_R * 0.85, false, wRng.fork(`rafter/${k}`));
  }

  // ---- the roof: a moss cushion on the rafters, lobed edges curling over a bark underside ----
  {
    const rr = wRng.fork('roof');
    const A0 = -POST_A - 0.3;
    const A1 = POST_A + 0.34;
    const S0 = -HW - 0.24;
    const S1 = HW + 0.26;
    const ph = rr() * TAU;
    const lobe = (x: number) => 0.045 * Math.sin(x * 5.3 + ph) + 0.025 * Math.sin(x * 11.7 - ph * 1.3);
    const edgeA0 = (s: number) => A0 - lobe(s);
    const edgeA1 = (s: number) => A1 + lobe(s + 3.1);
    const edgeS0 = (a: number) => S0 - lobe(a + 5.7);
    const edgeS1 = (a: number) => S1 + lobe(a + 8.3);
    const roofPoint = (u: number, v: number, lift: number, out: Vector3) => {
      const s0 = edgeS0(lerp(A0, A1, v));
      const s1 = edgeS1(lerp(A0, A1, v));
      const s = lerp(s0, s1, u);
      const a = lerp(edgeA0(s), edgeA1(s), v);
      // distance to the nearest edge (m)
      const e = Math.min((s - s0), (s1 - s), (a - edgeA0(s)), (edgeA1(s) - a));
      const k = clamp(e / 0.14, 0, 1);
      const cushion = 0.1 + 0.05 * noise.noise(s * 3.1 + 9, a * 3.1) + 0.03 * noise.noise(s * 8 + 2, a * 8);
      const h = lift * (cushion * Math.sqrt(k) - 0.06 * (1 - k));
      const p = at(a, s, roofU(a) + h);
      return out.copy(p);
    };
    const _q = new Vector3();
    const top = gridSurface(
      (u, v, o) => {
        roofPoint(u, v, 1, o.position);
        const s = lerp(S0, S1, u);
        const a = lerp(A0, A1, v);
        o.uv = [s / 1.6, a / 1.6];
        const e = Math.min(u * (S1 - S0), (1 - u) * (S1 - S0), v * (A1 - A0), (1 - v) * (A1 - A0));
        const bright = 0.35 + 0.35 * (0.5 + 0.5 * noise.noise(s * 2.3 + 4, a * 2.3)) + 0.15 * v;
        const m = MOSS_ALBEDO_PEAK * lerp(0.62, 0.85, smoothstep(0, 0.3, e)) * (0.85 + 0.3 * (0.5 + 0.5 * Math.sin(11 * s + 6 * a + ph)));
        const under = lerp(0.5, 1, smoothstep(0.0, 0.1, e));
        o.color = [lerp(MOSS_DEEP[0], MOSS_SUN[0], bright) * m * under, lerp(MOSS_DEEP[1], MOSS_SUN[1], bright) * m * under, lerp(MOSS_DEEP[2], MOSS_SUN[2], bright) * m * under];
      },
      { cols: 26, rows: 16 },
    );
    faceTowards(top, (p, o) => o.copy(p).add(_q.set(0, 1, 0)));
    // cushion tufts on the sheet (the hut caps' lumps)
    const specs: MossTuftSpec[] = [];
    const _tp = new Vector3();
    const _tq = new Vector3();
    for (let i = 0; i < 90; i++) {
      const u = 0.08 + rr() * 0.84;
      const v = 0.1 + rr() * 0.8;
      roofPoint(u, v, 1, _tp);
      roofPoint(Math.min(1, u + 0.01), v, 1, _tq);
      const du = _tq.clone().sub(_tp);
      roofPoint(u, Math.min(1, v + 0.01), 1, _tq);
      const dv = _tq.clone().sub(_tp);
      const n = new Vector3().crossVectors(dv, du).normalize();
      if (n.y < 0) n.negate();
      const rad = 0.05 + rr() * 0.05;
      const bright = 0.4 + 0.4 * rr();
      const m = MOSS_ALBEDO_PEAK * 0.8;
      specs.push({ position: _tp.clone(), normal: n, rx: rad * (0.8 + rr() * 0.4), rz: rad * (0.8 + rr() * 0.4), h: rad * (0.5 + rr() * 0.35), yaw: rr() * TAU, color: [lerp(MOSS_DEEP[0], MOSS_SUN[0], bright) * m, lerp(MOSS_DEEP[1], MOSS_SUN[1], bright) * m, lerp(MOSS_DEEP[2], MOSS_SUN[2], bright) * m], uv: [_tp.x / 1.6, _tp.z / 1.6], sink: rad * 0.35, seed: 1 + Math.floor(rr() * 1e6) });
    }
    const lumps = buildMossTufts(specs, tuftNoise, { segments: [6, 6], rings: [2, 2], topGain: 1.18, rimGain: 0.55 });
    put('waystation-roof', mats.capMoss, merge([top, lumps.geometry]));
    // the bark underside, a little inside the curl
    const under = gridSurface(
      (u, v, o) => {
        const s = lerp(S0 + 0.06, S1 - 0.06, u);
        const a = lerp(A0 + 0.06, A1 - 0.06, v);
        o.position.copy(at(a, s, roofU(a) - 0.012));
        o.uv = [s / 0.9, a / 0.9];
        const d = 0.34 * (0.8 + 0.3 * noise.ridged(s * 4 + 1, a * 9, 2));
        o.color = [d, d * 0.9, d * 0.78];
      },
      { cols: 10, rows: 6 },
    );
    faceTowards(under, (p, o) => o.copy(p).add(_q.set(0, -1, 0)));
    put('waystation-roof', mats.bark, under);
    // a fringe of moss beards and leaves along the front eave, a few along the back
    for (let i = 0; i < 9; i++) {
      const s = lerp(S0 + 0.12, S1 - 0.12, (i + rr()) / 9);
      const p = at(edgeA1(s) - 0.05, s, roofU(A1) - 0.06);
      foliage.addLeafCluster(p, 0.08 + rr() * 0.05, 5 + Math.floor(rr() * 4), { size: 0.075, droop: 0.7, flatten: 0.35 });
      if (rr() < 0.55) foliage.addHangingVine(p.clone().add(new Vector3(0, -0.02, 0)), 0.18 + rr() * 0.35, { leafSize: 0.05, leafEvery: 0.06, thickness: 0.006, amount: 0.03 });
    }
    for (let i = 0; i < 4; i++) {
      const s = lerp(S0 + 0.2, S1 - 0.2, (i + rr()) / 4);
      foliage.addLeafCluster(at(edgeA0(s) + 0.05, s, roofU(A0) - 0.05), 0.07, 5, { size: 0.07, droop: 0.6, flatten: 0.4 });
    }
  }

  // ---- walls: a palisade of split poles at the back (a round window, a propped shutter) and the north end ----
  {
    const pr = wRng.fork('palisade');
    const winS = 0.32;
    const winY = FT + 0.78;
    const winR = 0.2;
    const backA = -POST_A - 0.005;
    const n = 13;
    const backPoles: { s: number; r: number }[] = [];
    for (let i = 0; i < n; i++) {
      const s = lerp(-POST_S + 0.075, POST_S - 0.075, i / (n - 1)) + pr.range(-0.01, 0.01);
      const r = 0.058 + pr() * 0.012;
      backPoles.push({ s, r });
      const yTop = backTop - 0.02 + pr.range(-0.04, 0.02);
      const y0 = FT - 0.12;
      const ds = s - winS;
      // poles through the window are cut round it: a stub below, a stub above
      const spans: [number, number][] = [];
      if (Math.abs(ds) < winR + 0.02) {
        const hh = Math.sqrt(Math.max(0, (winR + 0.035) ** 2 - ds * ds));
        spans.push([y0, winY - hh], [winY + hh, yTop]);
      } else spans.push([y0, yTop]);
      for (const [ya, yb] of spans) {
        if (yb - ya < 0.05) continue;
        const p0 = at(backA - pr.range(0, 0.02), s, ya);
        const p1 = at(backA - pr.range(0, 0.02), s, yb);
        put('waystation-walls', mats.bark, barkPole([p0, p1], r, r * 0.96, noise, 500 + i + ya, { tone: 0.88 + pr() * 0.15, moss: 0.45, groundY: FT - 0.3, ts: 5, rs: 8 }));
        capPole('waystation-walls', [p0, p1], 5, r * 0.96, false, pr.fork(`pal-top/${i}/${ya}`));
      }
    }
    // the window's frame: a bent withy ring on the inside face, and outside the shutter, hinged
    // at its top and propped open 50° from the wall on a stick
    const ring: Vector3[] = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU;
      ring.push(at(backA + 0.07, winS + Math.cos(a) * (winR + 0.02), winY + Math.sin(a) * (winR + 0.02)));
    }
    put('waystation-walls', mats.bark, sweepTube(new CatmullRomCurve3(ring, true), { radius: () => 0.026, tubularSegments: 36, radialSegments: 6, uvMetres: 0.3, color: () => [0.5, 0.42, 0.31] }));
    const hinge = at(backA - 0.1, winS, winY + winR + 0.05);
    const shutterOut = F.clone().multiplyScalar(-Math.sin(50 * DEG)).add(new Vector3(0, -Math.cos(50 * DEG), 0)).normalize();
    for (let k = -2; k <= 2; k++) {
      const s = winS + k * 0.085;
      const top = hinge.clone().addScaledVector(S, k * 0.085);
      const bot = top.clone().addScaledVector(shutterOut, 0.44);
      put('waystation-walls', mats.fenceWood, board({ centre: top.clone().lerp(bot, 0.5), along: bot.clone().sub(top), across: S, L: 0.44, w0: 0.08, w1: 0.08, t: 0.02, tone: 0.7 + pr() * 0.2, age: 0.3, moss: 0.3, board: (k + 2) % 8, seed: s * 50 }, noise));
    }
    // the shutter's top board hangs on withy loops round the two poles nearest its ends
    const hingePoles = [...backPoles].sort((p, q) => Math.abs(Math.abs(p.s - winS) - 0.13) - Math.abs(Math.abs(q.s - winS) - 0.13)).slice(0, 2);
    for (const p of hingePoles) put('waystation-rope', rope, lashRound(at(backA - 0.03, p.s, hinge.y + 0.01), p.r + 0.06, 1.5, 0.012, 0.007, noise, 525 + p.s));
    const stickFoot = at(backA - 0.085, winS - 0.02, winY - winR - 0.04);
    const stickTop = hinge.clone().addScaledVector(shutterOut, 0.4).addScaledVector(S, -0.02).addScaledVector(F, 0.012);
    put('waystation-walls', mats.bark, barkPole([stickFoot, stickTop], 0.014, 0.012, noise, 530, { moss: 0, ts: 2, rs: 5 }));
    // the north end: a palisade under the roof's slope
    const northS = -POST_S - 0.005;
    const m = 9;
    for (let i = 0; i < m; i++) {
      const a = lerp(-POST_A + 0.07, POST_A - 0.07, i / (m - 1)) + pr.range(-0.01, 0.01);
      const r = 0.055 + pr() * 0.012;
      const yTop = lerp(backTop, frontTop, (a + POST_A) / (2 * POST_A)) - 0.03 + pr.range(-0.04, 0.02);
      const gyN = terrain.height(at(a, northS, 0).x, at(a, northS, 0).z);
      const y0 = Math.min(FT - 0.12, gyN - 0.05);
      const p0 = at(a, northS - pr.range(0, 0.02), y0);
      const p1 = at(a, northS - pr.range(0, 0.02), yTop);
      put('waystation-walls', mats.bark, barkPole([p0, p1], r, r * 0.95, noise, 540 + i, { tone: 0.88 + pr() * 0.15, moss: 0.5, groundY: gyN, ts: 6, rs: 8 }));
      capPole('waystation-walls', [p0, p1], 6, r * 0.95, false, pr.fork(`north-top/${i}`));
    }
    // two withy ties across each palisade
    for (const y of [FT + 0.35, backTop - 0.3]) put('waystation-rope', rope, ropeAlong([at(backA + 0.07, -POST_S, y), at(backA + 0.075, 0, y - 0.01), at(backA + 0.07, POST_S, y)], 0.011, noise, 560 + y));
    for (const y of [FT + 0.35, FT + 1.0]) put('waystation-rope', rope, ropeAlong([at(-POST_A, northS + 0.07, y), at(0, northS + 0.075, y - 0.01), at(POST_A, northS + 0.07, y)], 0.011, noise, 570 + y));
  }

  // ---- inside and round it: a bench, a basket, a walking stick, a rope coil, firewood, the pod ----
  {
    const ir = wRng.fork('props');
    // the bench: a split log on two stubs along the back wall
    const benchA = -POST_A + 0.24;
    const seatY = FT + 0.4;
    for (const s of [-0.55, 0.45]) {
      const c = at(benchA, s, 0);
      put('waystation-bench', mats.bark, barkPole([new Vector3(c.x, FT - 0.01, c.z), new Vector3(c.x, seatY - 0.06, c.z)], 0.07, 0.066, noise, 600 + s, { moss: 0.1, ts: 2, rs: 8 }));
    }
    const b0 = at(benchA, -0.78, seatY - 0.06);
    const b1 = at(benchA, 0.7, seatY - 0.06);
    put(
      'waystation-bench',
      mats.bark,
      gridSurface(
        (u, v, o) => {
          const ang = Math.PI * (1 + u);
          o.position.copy(b0.clone().lerp(b1, v)).addScaledVector(F, Math.cos(ang) * 0.12);
          o.position.y = seatY - 0.06 + Math.sin(ang) * 0.1 + 0.055;
          o.uv = [ang * 0.12, v * 1.5 / 0.7];
          const d = 0.5 * lerp(0.7, 1.1, noise.ridged(ang * 3 + 2, v * 4, 2));
          o.color = [d, d * 0.92, d * 0.82];
        },
        { cols: 8, rows: 8 },
      ),
    );
    put('waystation-bench', mats.fenceWood, board({ centre: b0.clone().lerp(b1, 0.5).setY(seatY), along: b1.clone().sub(b0), across: F, L: 1.52, w0: 0.23, w1: 0.23, t: 0.02, tone: 0.9, age: 0.4, moss: 0.05, board: 3, seed: 21 }, noise));
    // a basket on the floor by the bench: woven withies (bark tints in bands)
    const bc = at(benchA + 0.1, 0.72, FT);
    put(
      'waystation-bench',
      mats.bark,
      gridSurface(
        (u, v, o) => {
          const a = u * TAU;
          const rr = lerp(0.1, 0.14, v) * (1 + 0.03 * Math.sin(a * 7));
          o.position.set(bc.x + Math.cos(a) * rr, bc.y + v * 0.2, bc.z + Math.sin(a) * rr);
          o.uv = [u * 2, v];
          const weave = 0.5 + 0.5 * Math.sin(a * 16 + Math.floor(v * 8) * Math.PI);
          const d = lerp(0.46, 0.64, weave) * lerp(0.8, 1.05, v);
          o.color = [d * 1.05, d * 0.9, d * 0.62];
        },
        { cols: 24, rows: 6, closedU: true },
      ),
    );
    const rim: Vector3[] = [];
    for (let k = 0; k < 12; k++) rim.push(new Vector3(bc.x + Math.cos((k / 12) * TAU) * 0.142, bc.y + 0.2, bc.z + Math.sin((k / 12) * TAU) * 0.142));
    put('waystation-rope', rope, ropeTube(new CatmullRomCurve3(rim, true), 0.012, 5, [0.6, 0.48, 0.3], noise, 11));
    // (it holds a few apples — leaf-tinted lumps would read as moss; keep it empty)
    // a walking stick against the front-south post
    const fp = postAt[3];
    const stickFoot = at(POST_A + 0.02, POST_S - 0.2, FT + 0.005);
    const stickTop = new Vector3(fp.x, FT + 1.25, fp.z).addScaledVector(S, -0.06).addScaledVector(F, -0.02);
    put('waystation-posts', mats.bark, barkPole([stickFoot, stickFoot.clone().lerp(stickTop, 0.5).add(new Vector3(0.01, 0, 0.01)), stickTop], 0.018, 0.015, noise, 610, { moss: 0, ts: 5, rs: 6 }));
    // a rope coil hung on the front-north post
    const np = postAt[2];
    const coilC = new Vector3(np.x, FT + 1.35, np.z).addScaledVector(F, 0.1);
    for (let t = 0; t < 3; t++) {
      const loop: Vector3[] = [];
      const rr = 0.13 + t * 0.012;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        loop.push(coilC.clone().addScaledVector(S, Math.cos(a) * rr * 0.9).add(new Vector3(0, -rr + Math.sin(a) * rr, 0)).addScaledVector(F, t * 0.018));
      }
      put('waystation-rope', rope, ropeTube(new CatmullRomCurve3(loop, true), 0.011, t, [0.62, 0.52, 0.36], noise, 13 + t));
    }
    // firewood stacked against the north end, outside
    firewood('waystation-firewood', at(-0.05, -HW - 0.28, 0), F, 7, 3, 0.42, ir.fork('firewood'), S);
    [-0.4, -0.12, 0.16, 0.44].forEach((a, i) => {
      const c = at(a, -HW - 0.28, FT);
      walkSurfaces.push(solidDisc(`south-waystation-firewood-${i}`, c.x, c.z, 0.36, FT));
    });
    // the pod under the front plate, toward the south end (the path's side), on a short cord: its
    // foot 1.4 m over the floor, clear of Link's hat where he stands at the open front
    const hook = at(POST_A + 0.02, 0.55, frontTop - PLATE_R - 0.012);
    wPods.push(staticPod(hook, 0.08, S, ir.fork('pod'), 1.0));
  }

  // ---- the step up from the path: a split log along the front ----
  {
    const sr = wRng.fork('step');
    const p = at(HD + 0.24, -0.78, 0);
    const q = at(HD + 0.24, 0.58, 0);
    const tp = terrain.height(p.x, p.z) + 0.16;
    const tq = terrain.height(q.x, q.z) + 0.16;
    const ax = q.clone().sub(p).setY(0);
    const len = ax.length();
    ax.normalize();
    put(
      'waystation-floor',
      mats.bark,
      gridSurface(
        (u, v, o) => {
          const ang = Math.PI * (1 + u);
          const along = lerp(-0.04, len + 0.04, v);
          o.position.copy(p).addScaledVector(ax, along).addScaledVector(F, Math.cos(ang) * 0.15);
          o.position.y = lerp(tp, tq, clamp(along / len, 0, 1)) - 0.005 + Math.sin(ang) * 0.15 * 0.85;
          o.uv = [(ang * 0.15) / 0.7, along / 0.7];
          const d = 0.5 * lerp(0.7, 1.1, noise.ridged(ang * 3 + 11, along * 2.5, 2));
          o.color = [d, d * 0.92, d * 0.82];
        },
        { cols: 8, rows: 8 },
      ),
    );
    put('waystation-floor', mats.fenceWood, board({ centre: p.clone().lerp(q, 0.5).setY((tp + tq) / 2), along: q.clone().setY(tq).sub(p.clone().setY(tp)), across: F, L: len + 0.08, w0: 0.27, w1: 0.27, t: 0.02, tone: 0.85, age: 0.35, moss: 0.3, board: 5, seed: 33 }, noise));
    tuftSpecs.push(...footMoss(ctx, p.clone().setY(terrain.height(p.x, p.z)), sr.fork('m0'), { postRadius: 0.15, count: 8, color: FOOT_MOSS }));
    tuftSpecs.push(...footMoss(ctx, q.clone().setY(terrain.height(q.x, q.z)), sr.fork('m1'), { postRadius: 0.15, count: 8, color: FOOT_MOSS }));
    walkSurfaces.push(deckSurface('south-waystation-step', at(HD + 0.24, -0.72, tp), at(HD + 0.24, 0.52, tq), 0.13));
  }

  // ---- the waystation's walk: the floor; the back wall with the bench and basket along it, the
  // north wall and the front-south post blocked with a body's margin ----
  walkSurfaces.push(deckSurface('south-waystation-floor', at(0, -HW + 0.05, FT), at(0, HW - 0.05, FT), HD - 0.055));
  for (let i = 0; i < 6; i++) {
    const c = at(-HD + 0.12, lerp(-HW + 0.1, HW - 0.1, i / 5), FT);
    walkSurfaces.push(solidDisc(`south-waystation-back-${i}`, c.x, c.z, 0.48, FT));
  }
  for (let i = 0; i < 4; i++) {
    const c = at(lerp(-HD + 0.1, HD - 0.1, i / 3), -POST_S - 0.03, FT);
    walkSurfaces.push(solidDisc(`south-waystation-north-${i}`, c.x, c.z, 0.3, FT));
  }
  {
    const c = at(POST_A, POST_S, FT);
    walkSurfaces.push(solidDisc('south-waystation-post', c.x, c.z, 0.26, FT));
  }
  casters.push({ x: W.centre[0], z: W.centre[1], r: Math.hypot(HD + 0.4, HW + 0.4), y0: -0.6, y1: frontTop + 0.45, shadow: true });

  // =====================================================================================
  // meshes
  // =====================================================================================
  let tris = 0;
  const add = (geo: BufferGeometry, mat: Material, name: string, cast = true, receive = true) => {
    const m = new Mesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
    tris += tri(geo);
    return m;
  };
  for (const [key, p] of parts) add(merge(p.geos), p.mat, key.split('|')[0], p.cast);
  // the end grain per camera class (the caps ride with the part they close)
  const capsByName = new Map<string, BufferGeometry[]>();
  for (const c of endCaps) {
    const list = capsByName.get(c.name) ?? [];
    list.push(c.geo);
    capsByName.set(c.name, list);
  }
  for (const [name, list] of capsByName) add(merge(list), mats.endGrain, name === 'keeper-mast' ? 'log-ends' : `${name}-ends`);
  if (podGeos.length) add(merge(podGeos), mats.lantern, 'pod-lantern-static', false, false);
  if (hangerGeos.length) add(merge(hangerGeos), mats.woodDark, 'lantern-hanger');
  const tufts = buildMossTufts(tuftSpecs, tuftNoise, { topGain: 1.4, rimGain: 0.5, topTint: [1.0, 1.05, 0.8] });
  if (tufts.count > 0) add(tufts.geometry, mats.capMoss, 'south-dwellings-foot-moss', false, true);
  for (const m of foliage.build(mats, 'south-dwellings')) {
    group.add(m);
    tris += tri(m.geometry);
  }

  const sunToward = ctx.sun ? ctx.sun.position.clone().sub(ctx.sun.target.position).normalize() : sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
  const spheres: Sphere[] = casters.flatMap((c) => casterSpheres(c, sunToward));
  const p3 = (p: Vector3 | readonly number[]): [number, number, number] => (p instanceof Vector3 ? [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] : [+(+p[0]).toFixed(2), +(+p[1]).toFixed(2), +(+p[2]).toFixed(2)]);
  const mastTop = mastAxis(K.mast.top);
  const keeperTris = [...group.children].filter((o) => /^(keeper-|distant-house-[a-z-]+:south-keeper|distant-glow|distant-soffit|log-ends)/.test(o.name)).reduce((n, o) => n + tri((o as Mesh).geometry), 0);
  const wayTris = [...group.children].filter((o) => o.name.startsWith('waystation-')).reduce((n, o) => n + tri((o as Mesh).geometry), 0);
  return {
    group,
    walkSurfaces,
    bases,
    visible: (camera: Camera) => southVisible(camera, spheres),
    triangles: tris + hutTris,
    audit: {
      keeper: {
        centre: p3(hutAudit.centre),
        radius: hutAudit.radius,
        window: hutAudit.window,
        door: hutAudit.door,
        galleryBoards: boards,
        railingPosts: posts,
        braces,
        props: keeperProps,
        footings,
        mastTop: p3(mastTop),
        pods: keeperPods.map((p) => p3(p)),
        triangles: keeperTris,
      },
      waystation: {
        centre: [W.centre[0], FT, W.centre[1]],
        floorY: FT,
        floorBoards,
        posts: wPosts,
        rafters,
        pods: wPods.map((p) => p3(p)),
        triangles: wayTris,
      },
      pointLights: hut.lights.length,
      walkSurfaces: walkSurfaces.length,
    },
  };
}
