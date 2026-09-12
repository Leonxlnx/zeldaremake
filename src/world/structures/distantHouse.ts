/**
 * Distant tree houses (round 16): the village behind the clearing.
 *
 * The owner's boards 01 (village lighting) and 08 (gameplay composition) show Kokiri Forest as
 * several lit tree houses stacked at different depths in the misty background — round doors and
 * windows glowing warm amber, pod lanterns, moss caps, rope walkways between the trunks — all
 * softened by the haze. Reference frames 1 s and 14 s keep a hazy lit background with a far
 * lantern light. Ours had one house (Saria's, 23 m in A) and the upper house; the far wall was
 * trunks and haze. These three huts sit 4–8 m up existing trunks 30–47 m from the hero cameras, in
 * 55–70 % haze, so what counts is silhouette plus warm emissive points, not bark texture:
 *
 *   - one merged geometry per material per house, in the SAME materials (and shadow flags /
 *     vertex layout) as Saria's house, so `consolidateStaticMeshes` folds them into the bark,
 *     plank and cap-moss draws that already exist (+0 draws);
 *   - every window, door glow and pod of every house in ONE emissive mesh (`distant-glow`, +1
 *     draw) on `mats.distantGlow`, whose peak (2.6 linear) clears the height fog's far-shade
 *     exemption (heightfog.ts: emissives above 2.0 keep their radiance) so the points still read
 *     through the veil the way the reference's far lantern does. No point lights.
 *
 * Hosts (read from layout.giantTrees and the trees system's authored COLUMN_SEATS, whose
 * coordinates are repeated here — structures never import trees' internals; the seeded 'swap'
 * columns are avoided because their positions are the trees system's draw). The hut is centred
 * near the trunk axis (a small authored offset shifts it clear of hero silhouettes) with a radius
 * that covers the bole's lean and wander at hut height, so the trunk rises through the platform
 * and the cap the way a tree house is built round its tree. Ground contact is not needed: the
 * floor height is measured from `ctx.terrain.height` at the host's seat, exactly where the trees
 * system seats the trunk.
 *
 *   hollow-column  COLUMN_SEATS (8.8, −26.9) v3, hut 4.2 m up   → A (0.37, 0.11) 33 m, B (0.46, 0.13) 28 m, D (0.64, 0.08) 23 m
 *   north-east     giant 'north-east' (15, −37),  hut 8.0 m up  → A (0.45, 0.13) 45 m, B (0.53, 0.17) 40 m, D (0.72, 0.14) 33 m
 *   west-column    COLUMN_SEATS (−5.7, −31.9) v1, hut 6.0 m up  → A (0.08, 0.13) 33 m, B (0.13, 0.16) 29 m, D (0.30, 0.17) 27 m
 *
 * (frame fractions of the window centre; gauntlet/tmp/proj.mjs with the layout viewpoints). In A
 * the first two stand above Saria's cap fringe at different depths (33 / 45 m) — the boards'
 * stacked village; in B the west column is the lit point far left beyond the emergent and the
 * other two sit right of the receding path, left of Saria's cap; in D the west column is the lit
 * point left of the log arch (27 m — no authored trunk stands 45–60 m out on that side) and the
 * others sit right of the arch, above it (the arch's top projects at y ≥ 0.35, every lit point at
 * y ≤ 0.20). None is in front of the stair, Saria's house or the arch opening.
 */
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { basisMatrix, gridSurface, merge, setColorAttribute, TAU } from './geometry';
import { MOSS_ALBEDO_PEAK, type StructureMaterials } from './materials';

export interface DistantHouseDef {
  id: string;
  /** host trunk seat (world x, z) and where it is authored */
  host: { x: number; z: number; source: string };
  /** hut centre offset from the seat (m, world x/z): shifts the silhouette clear of hero elements */
  offset: [number, number];
  /** platform height above the seat's terrain (m) */
  floor: number;
  /** hut wall radius (m); must cover the bole's radius + lean + wander at `floor` */
  radius: number;
  /** wall height floor → eave (m) */
  wall: number;
  /** cap rise above the eave (m) */
  capHeight: number;
  /** azimuth (deg, from +Z toward +X) the round window faces — the mean direction to cameras A/B/D */
  facingDeg: number;
  /** door azimuth relative to the window (deg, + toward +X side = screen right) */
  doorDeg: number;
  /** walkway stub: azimuth relative to the window (deg) and length (m) */
  walkway: { deg: number; length: number };
  /** 2–3 pods: end post, eave, mid post */
  pods: number;
}

/** authored hosts: layout giants + the trees system's COLUMN_SEATS (see the header) */
export const DISTANT_HOUSES: DistantHouseDef[] = [
  {
    id: 'hollow-column',
    host: { x: 8.8, z: -26.9, source: 'trees COLUMN_SEATS (8.8, -26.9) variant 3' },
    offset: [-0.6, 0.2],
    floor: 4.2,
    radius: 1.55,
    wall: 2.0,
    capHeight: 1.25,
    facingDeg: -15,
    doorDeg: 38,
    walkway: { deg: -78, length: 3.2 },
    pods: 3,
  },
  {
    id: 'north-east',
    host: { x: 15, z: -37, source: "layout giantTrees 'north-east'" },
    offset: [1.0, 0.3],
    floor: 8.0,
    radius: 2.4,
    wall: 2.4,
    capHeight: 1.8,
    facingDeg: -19,
    doorDeg: 40,
    walkway: { deg: -75, length: 3.6 },
    pods: 3,
  },
  {
    id: 'west-column',
    host: { x: -5.7, z: -31.9, source: 'trees COLUMN_SEATS (-5.7, -31.9) variant 1' },
    offset: [0, 0],
    floor: 6.0,
    radius: 1.7,
    wall: 2.1,
    capHeight: 1.3,
    facingDeg: 10,
    doorDeg: -36,
    walkway: { deg: 80, length: 2.6 },
    pods: 2,
  },
];

export interface DistantHouseBuild {
  group: Group;
  /** the one emissive mesh shared by all houses */
  glow: Mesh;
  triangles: number;
  audit: {
    id: string;
    host: string;
    centre: [number, number, number];
    floorY: number;
    radius: number;
    window: [number, number, number];
    door: [number, number, number];
    pods: [number, number, number][];
    /** every emissive element (window, door, pods): world centres */
    litPoints: [number, number, number][];
  }[];
}

type RGB = [number, number, number];
const DEG = Math.PI / 180;
/** cap moss tones: Saria's cap palette (house.ts domeVertex) */
const MOSS_DEEP: RGB = [0.266, 0.238, 0.052];
const MOSS_SUN: RGB = [0.8, 0.79, 0.17];
const PLANK: RGB = [0.42, 0.35, 0.27];
const PLANK_DARK: RGB = [0.26, 0.21, 0.16];
const WALL: RGB = [0.66, 0.62, 0.55];
const SOFFIT: RGB = [0.3, 0.27, 0.22];
const GLOW_AMBER: RGB = [1, 1, 1];
const GLOW_DOOR: RGB = [1, 0.92, 0.8];
const GLOW_LIME: RGB = [0.72, 1.0, 0.36];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number, m = 1): RGB => [lerp(a[0], b[0], t) * m, lerp(a[1], b[1], t) * m, lerp(a[2], b[2], t) * m];
const az = (deg: number) => new Vector3(Math.sin(deg * DEG), 0, Math.cos(deg * DEG));

/** a box between two points (posts, rails, ropes, stems, bars) */
function bar(a: Vector3, b: Vector3, t: number, color: RGB, t2 = t): BufferGeometry {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new BoxGeometry(t, t2, len);
  geo.applyMatrix4(basisMatrix(a.clone().lerp(b, 0.5), dir));
  return setColorAttribute(geo, color);
}

/** a horizontal annulus (disc when r0 ≈ 0) at height y; faces down unless `up` */
function ring(c: Vector3, r0: number, r1: number, y: number, up: boolean, color: (v: number) => RGB, cols = 24, rows = 2): BufferGeometry {
  return gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const r = lerp(r0, r1, v);
      out.position.set(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r);
      out.uv = [Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5];
      out.color = color(v);
    },
    { cols, rows, closedU: true, flip: up },
  );
}

/** a filled arch (rectangle with a semicircular top) as a fan, on the plane through `c` facing `n` */
function archFan(c: Vector3, n: Vector3, w: number, h: number, color: RGB): BufferGeometry {
  // right × up = n, so the fan's front face is the outside of the wall
  const right = new Vector3(n.z, 0, -n.x).normalize();
  const up = new Vector3(0, 1, 0);
  const pts: [number, number][] = [];
  const r = w / 2;
  pts.push([-r, 0], [r, 0]);
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push([Math.cos(a) * r, h - r + Math.sin(a) * r]);
  }
  const positions: number[] = [c.x, c.y + h / 2, c.z];
  const normals: number[] = [n.x, n.y, n.z];
  const uvs: number[] = [0.5, 0.5];
  for (const [x, y] of pts) {
    positions.push(c.x + right.x * x + up.x * y, c.y + right.y * x + up.y * y, c.z + right.z * x + up.z * y);
    normals.push(n.x, n.y, n.z);
    uvs.push(0.5 + x / w, y / h);
  }
  const index: number[] = [];
  for (let i = 1; i < pts.length; i++) index.push(0, i, i + 1);
  index.push(0, pts.length, 1);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  return setColorAttribute(geo, color);
}

/** a disc facing `n` (window glow) */
function facingDisc(c: Vector3, n: Vector3, r: number, color: RGB, segs = 20): BufferGeometry {
  const right = new Vector3(-n.z, 0, n.x).normalize();
  const up = new Vector3().crossVectors(n, right).normalize();
  if (up.y < 0) up.negate();
  return gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const rr = lerp(0.001, r, v);
      out.position.copy(c).addScaledVector(right, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * rr);
      out.uv = [0.5 + Math.cos(a) * v * 0.5, 0.5 + Math.sin(a) * v * 0.5];
      out.color = color;
    },
    { cols: segs, rows: 2, closedU: true, flip: right.clone().cross(up).dot(n) < 0 },
  );
}

/** an annulus facing `n` (window frame) */
function facingRing(c: Vector3, n: Vector3, r0: number, r1: number, color: RGB, segs = 20): BufferGeometry {
  const right = new Vector3(-n.z, 0, n.x).normalize();
  const up = new Vector3().crossVectors(n, right).normalize();
  if (up.y < 0) up.negate();
  return gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const rr = lerp(r0, r1, v);
      out.position.copy(c).addScaledVector(right, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * rr);
      out.uv = [Math.cos(a) * rr, Math.sin(a) * rr];
      out.color = color;
    },
    { cols: segs, rows: 2, closedU: true, flip: right.clone().cross(up).dot(n) < 0 },
  );
}

function triangles(g: BufferGeometry): number {
  return Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
}

/**
 * Build the distant houses. Returns one group holding, per house, a bark mesh (walls + soffit), a
 * plank mesh (platform, walkway, frames) and a cap-moss mesh — all on the shared house materials at
 * the identity transform so the system's consolidation pass folds them into the existing draws —
 * plus one emissive mesh for every house's windows, doors and pods.
 */
export function buildDistantHouses(ctx: WorldContext, mats: StructureMaterials, rng: Rng, defs: DistantHouseDef[] = DISTANT_HOUSES): DistantHouseBuild {
  const group = new Group();
  group.name = 'distant-houses';
  const glowParts: BufferGeometry[] = [];
  const audit: DistantHouseBuild['audit'] = [];
  let tris = 0;

  for (const def of defs) {
    const r = rng.fork(def.id);
    const baseY = ctx.terrain.height(def.host.x, def.host.z);
    const floorY = baseY + def.floor;
    const c = new Vector3(def.host.x + def.offset[0], floorY, def.host.z + def.offset[1]);
    const R = def.radius;
    const eaveY = floorY + def.wall;
    const facing = az(def.facingDeg);
    const wobble = r.range(0, TAU);
    const wallR = (a: number) => R * (1 + 0.045 * Math.sin(3 * a + wobble) + 0.02 * Math.sin(7 * a - wobble));

    // ---- bark: walls + eave soffit ----
    const walls = gridSurface(
      (u, v, out) => {
        const a = u * TAU;
        const rr = wallR(a) * lerp(1, 0.96, v);
        out.position.set(c.x + Math.cos(a) * rr, lerp(floorY, eaveY, v), c.z + Math.sin(a) * rr);
        out.uv = [(a * R) / 1.6, (v * def.wall) / 1.6];
        const shade = lerp(0.72, 1, v) * (1 - 0.22 * Math.max(0, Math.sin(2 * a + wobble)));
        out.color = [WALL[0] * shade, WALL[1] * shade, WALL[2] * shade];
      },
      { cols: 32, rows: 6, closedU: true },
    );
    const eaveR = R + 0.45;
    const soffit = ring(c, R * 0.95, eaveR, eaveY, false, () => SOFFIT, 28, 2);
    const barkGeo = merge([walls, soffit]);
    const barkMesh = new Mesh(barkGeo, mats.bark);
    barkMesh.name = `distant-house-bark:${def.id}`;
    barkMesh.castShadow = barkMesh.receiveShadow = true;
    group.add(barkMesh);
    tris += triangles(barkGeo);

    // ---- cap moss: a low dome curling down at the rim, the trunk rising through its crown ----
    const capPhase = r.range(0, TAU);
    const cap = gridSurface(
      (u, v, out) => {
        const a = u * TAU;
        const rim = 1 + 0.035 * Math.sin(5 * a + capPhase) + 0.02 * Math.sin(9 * a - capPhase);
        const rr = eaveR * rim * Math.pow(Math.cos((v * Math.PI) / 2), 0.9);
        const y = eaveY - 0.14 + (def.capHeight + 0.14) * Math.pow(Math.sin((v * Math.PI) / 2), 1.15);
        out.position.set(c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr);
        out.uv = [(Math.cos(a) * (rr + 0.3)) / 1.6, (Math.sin(a) * (rr + 0.3)) / 1.6];
        const mottle = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(11 * a + 6 * v + capPhase));
        const bright = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(7 * a - 4 * v + capPhase * 0.7));
        const under = v < 0.06 ? 0.45 : 1;
        const m = MOSS_ALBEDO_PEAK * lerp(0.9, 0.62, v) * mottle * under;
        out.color = mix(MOSS_DEEP, MOSS_SUN, bright, m);
      },
      { cols: 28, rows: 7, closedU: true },
    );
    const capMesh = new Mesh(cap, mats.capMoss);
    capMesh.name = `distant-house-cap:${def.id}`;
    capMesh.castShadow = capMesh.receiveShadow = true;
    group.add(capMesh);
    tris += triangles(cap);

    // ---- planks: platform, walkway stub, door frame, window frame + bars, pod stems ----
    const plankParts: BufferGeometry[] = [];
    const platR = R + 0.22;
    plankParts.push(ring(c, 0.02, platR, floorY + 0.01, true, () => PLANK, 24, 3));
    plankParts.push(ring(c, 0.02, platR, floorY - 0.22, false, () => PLANK, 24, 3));
    plankParts.push(
      gridSurface(
        (u, v, out) => {
          const a = u * TAU;
          out.position.set(c.x + Math.cos(a) * platR, lerp(floorY - 0.22, floorY + 0.01, v), c.z + Math.sin(a) * platR);
          out.uv = [(a * platR) / 1.6, v * 0.2];
          out.color = PLANK;
        },
        { cols: 24, rows: 2, closedU: true },
      ),
    );

    // walkway: a plank deck leaving the platform rim, dropping 4°, with posts and a sagging rope rail
    const wDir = az(def.facingDeg + def.walkway.deg);
    const wSide = new Vector3(-wDir.z, 0, wDir.x);
    const L = def.walkway.length;
    const deckStart = c.clone().addScaledVector(wDir, platR - 0.15).setY(floorY - 0.06);
    const deckEnd = c.clone().addScaledVector(wDir, platR + L).setY(floorY - 0.06 - L * Math.tan(4 * DEG));
    const deck = new BoxGeometry(0.95, 0.12, L + 0.15);
    deck.applyMatrix4(basisMatrix(deckStart.clone().lerp(deckEnd, 0.5), deckEnd.clone().sub(deckStart)));
    plankParts.push(setColorAttribute(deck, PLANK));
    const postTops: Vector3[][] = [[], []];
    for (const s of [0.5, 1]) {
      const foot = deckStart.clone().lerp(deckEnd, s);
      for (const side of [-1, 1]) {
        const base = foot.clone().addScaledVector(wSide, side * 0.42);
        const top = base.clone().setY(base.y + 1.05);
        plankParts.push(bar(base, top, 0.09, PLANK_DARK));
        postTops[side < 0 ? 0 : 1].push(top);
      }
    }
    for (const side of [0, 1]) {
      const wallAnchor = c
        .clone()
        .addScaledVector(wDir, R - 0.05)
        .addScaledVector(wSide, (side === 0 ? -1 : 1) * 0.42)
        .setY(floorY + 1.0);
      const pts = [wallAnchor, ...postTops[side]];
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.09;
        plankParts.push(bar(a, mid, 0.035, PLANK_DARK));
        plankParts.push(bar(mid, b, 0.035, PLANK_DARK));
      }
    }

    // round window on the wall facing the cameras, dark frame + cross bars, amber glow behind them
    const winY = floorY + 1.35;
    const winR = R * 0.24;
    const wallAt = (dir: Vector3, y: number, out: number) => {
      const a = Math.atan2(dir.z, dir.x);
      const rr = wallR(a) * lerp(1, 0.96, (y - floorY) / def.wall);
      return c.clone().addScaledVector(dir, rr + out).setY(y);
    };
    const winC = wallAt(facing, winY, 0.03);
    plankParts.push(facingRing(wallAt(facing, winY, 0.04), facing, winR, winR + 0.12, PLANK_DARK));
    const winRight = new Vector3(-facing.z, 0, facing.x);
    const winFront = wallAt(facing, winY, 0.06);
    plankParts.push(bar(winFront.clone().addScaledVector(winRight, -winR), winFront.clone().addScaledVector(winRight, winR), 0.06, PLANK_DARK));
    plankParts.push(bar(winFront.clone().setY(winY - winR), winFront.clone().setY(winY + winR), 0.06, PLANK_DARK));
    glowParts.push(facingDisc(winC, facing, winR, GLOW_AMBER));

    // small door arch with a dark frame, its glow set into the wall
    const doorDir = az(def.facingDeg + def.doorDeg);
    const doorW = 0.7;
    const doorH = 1.35;
    const doorBase = wallAt(doorDir, floorY + 0.02, 0.03);
    const doorRight = new Vector3(-doorDir.z, 0, doorDir.x);
    const frameOut = wallAt(doorDir, floorY + 0.02, 0.07);
    for (const side of [-1, 1]) {
      const a = frameOut.clone().addScaledVector(doorRight, side * (doorW / 2 + 0.06));
      plankParts.push(bar(a, a.clone().setY(a.y + doorH - doorW / 2), 0.1, PLANK_DARK));
    }
    const lintel = frameOut.clone().setY(floorY + doorH + 0.06);
    plankParts.push(bar(lintel.clone().addScaledVector(doorRight, -doorW / 2 - 0.1), lintel.clone().addScaledVector(doorRight, doorW / 2 + 0.1), 0.1, PLANK_DARK));
    glowParts.push(archFan(doorBase, doorDir, doorW, doorH, GLOW_DOOR));

    // pods: on the walkway's end post, under the eave between window and door, on the mid post
    const podR = R * 0.15;
    const pods: Vector3[] = [];
    const hang = (from: Vector3, drop: number, color: RGB) => {
      const centre = from.clone().setY(from.y - drop - podR);
      plankParts.push(bar(from, from.clone().setY(from.y - drop), 0.03, PLANK_DARK));
      const pod = new SphereGeometry(podR, 12, 8);
      pod.translate(centre.x, centre.y, centre.z);
      glowParts.push(setColorAttribute(pod, color));
      pods.push(centre);
    };
    const endPost = postTops[1][1].clone().addScaledVector(wDir, 0.12);
    hang(endPost.clone().setY(endPost.y + 0.02), 0.32, GLOW_AMBER);
    if (def.pods >= 2) {
      const eaveDir = az(def.facingDeg + def.doorDeg * 0.5);
      const hook = c.clone().addScaledVector(eaveDir, eaveR - 0.1).setY(eaveY - 0.02);
      hang(hook, 0.45, def.pods >= 3 ? GLOW_LIME : GLOW_AMBER);
    }
    if (def.pods >= 3) {
      const midPost = postTops[0][0].clone().addScaledVector(wSide, -0.12);
      hang(midPost.clone().setY(midPost.y + 0.02), 0.3, GLOW_AMBER);
    }

    const plankGeo = merge(plankParts);
    const plankMesh = new Mesh(plankGeo, mats.wood);
    plankMesh.name = `distant-house-planks:${def.id}`;
    plankMesh.castShadow = plankMesh.receiveShadow = true;
    group.add(plankMesh);
    tris += triangles(plankGeo);

    const doorC = doorBase.clone().setY(floorY + doorH / 2);
    audit.push({
      id: def.id,
      host: def.host.source,
      centre: [+c.x.toFixed(2), +floorY.toFixed(2), +c.z.toFixed(2)],
      floorY: +floorY.toFixed(2),
      radius: R,
      window: [+winC.x.toFixed(2), +winC.y.toFixed(2), +winC.z.toFixed(2)],
      door: [+doorC.x.toFixed(2), +doorC.y.toFixed(2), +doorC.z.toFixed(2)],
      pods: pods.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] as [number, number, number]),
      litPoints: [winC, doorC, ...pods].map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] as [number, number, number]),
    });
  }

  const glowGeo = merge(glowParts);
  const glow = new Mesh(glowGeo, mats.distantGlow);
  glow.name = 'distant-glow';
  glow.castShadow = glow.receiveShadow = false;
  group.add(glow);
  tris += triangles(glowGeo);

  return { group, glow, triangles: tris, audit };
}

/** peak channel of the shared emissive (audit: it must clear the height fog's 2.0 far-shade exemption) */
export function distantGlowPeak(mats: StructureMaterials): number {
  const c = mats.distantGlow.color;
  return Math.max(c.r, c.g, c.b);
}
