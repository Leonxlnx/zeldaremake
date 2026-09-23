/**
 * Round 56 (expansion-south): the built things of the village's way out, south of the plaza
 * (layout.ts `EXPANSION_SOUTH`, terrain/south.ts) — the rope-and-plank bridge over the misty
 * ravine and the hollow log burrowing into the far bank, lit from inside.
 *
 * The bridge: weathered planks laid on two floor ropes and tied to them (a few worn, broken
 * short or missing), on the deck line the heightfield notches the lip under (terrain/south.ts
 * `bridgeDeckY`); a half-buried sill log at each end; four raked bark posts carrying two laid
 * hand ropes, lashed round the posts and stayed back to stakes, joined to the floor ropes by a
 * zig-zag of cord; a pod lantern on an arm at every post's head.
 *
 * The log: a fallen giant's hollow trunk with its broken end as the mouth — ridged bark under a
 * moss cap, a splintered rim of end grain, the hollow's heartwood inside, a litter floor, and a
 * warm glow closing the tube at `deadEnd`. No light source joins the scene: the inside's own
 * materials emit per vertex (`aGlow`, falling off from the glow, times the surface's albedo — so
 * the fissures stay dark in it), the glow disc and haze cards are unlit colour peaking over the
 * height fog's 2.0 exemption (heightfog.ts), and the pods are the scene's emissive pods.
 *
 * The character walks the planks as built (`walkSpans`: the deck line sill to sill, the log's
 * floor to the glow). structures/index.ts consolidates the group on its own and hides it beyond
 * SOUTH_VISIBLE_M of the south boxes or when neither it nor its shadow footprint meets the
 * camera's frustum (util/expansionLocality.ts `southVisible`).
 *
 * Own rng fork, appended after every existing stream: nothing built before round 56 moves.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineCurve3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  Vector2,
  Vector3,
  type Camera,
  type Material,
  type Sphere,
} from 'three';
import { EXPANSION_SOUTH, southBridgeFrame, southRavineLine } from '../layout';
import type { WalkSpan, WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { applyShadeFloor, type ShadeFloor } from '../materials/shadeFloor';
import { SOUTH_FLOOR_Y, SOUTH_NORTH_SILL_Y } from '../terrain/heightfield';
import { bridgeDeckY, bridgeLocal, ravineHit, tunnelWorld } from '../terrain/south';
import { casterSpheres, southVisible, sunVector, type Caster } from '../util/expansionLocality';
import { ropeTube } from './fence';
import { FoliageBuilder } from './foliage';
import { TAU, faceTowards, gridSurface, merge, setFloatAttribute, sweepTube } from './geometry';
import { buildLantern, lanternHanger, type LanternRig } from './lantern';
import { HOUSE_BARK_TINT, Noise3D, type StructureMaterials } from './materials';
import { buildMossTufts, type MossTuftSpec } from './mossTufts';
import { checkedCap, endFrame, footMoss, woodGrain } from './woodGrain';

type RGB = [number, number, number];

const B = EXPANSION_SOUTH.bridge;
const T = EXPANSION_SOUTH.tunnel;
const BF = southBridgeFrame();
/** the deck's top at the two sills (the ground there + `bridge.sill`, the heightfield's own levels) */
const Y_N = SOUTH_NORTH_SILL_Y + B.sill;
const Y_S = SOUTH_FLOOR_Y + B.sill;
const deckY = (a: number) => bridgeDeckY(a, Y_N, Y_S);
const deckSlope = (a: number) => (deckY(a + 0.01) - deckY(a - 0.01)) / 0.02;
/** the floor ropes: `FLOOR_C` either side of the axis, radius FLOOR_R, their tops PLANK_MAX under the deck line */
const FLOOR_C = 0.53;
const FLOOR_R = 0.024;
const PLANK_MAX = 0.06;
/** the sill logs: radius, half length, their tops under the floor ropes */
const SILL_R = 0.2;
const SILL_HALF = 1.15;
const sillY = (a0: number) => deckY(a0) - PLANK_MAX - 2 * FLOOR_R - SILL_R;
/** the hand ropes' distance off the axis at the posts' side of the span and mid-span */
const RAIL_C_END = B.postOut;
const RAIL_C_MID = 0.72;
/** the backstays' stakes: along the axis past each post, across the axis */
const STAKE_BACK = 1.05;
const STAKE_C = 1.45;

/** world point at bridge frame (a along from the north sill, c across — west +) and height y */
function bw(a: number, c: number, y: number, out = new Vector3()): Vector3 {
  return out.set(B.north[0] + BF.ax * a + BF.cx * c, y, B.north[1] + BF.az * a + BF.cz * c);
}

/** the log's floor (the far route's level), its axis height, the glow's plane */
const FLOOR_Y = SOUTH_FLOOR_Y;
const AXIS_Y = FLOOR_Y + T.axisY;
const DISC_A = T.deadEnd + 0.3;
/** the shell, the rim and the hollow span this angle either side of the crown (the rest is under the floor / ground) */
const PHI_MAX = (150 * Math.PI) / 180;
function tw(a: number, c: number, y: number, out = new Vector3()): Vector3 {
  const [x, z] = tunnelWorld(a, c);
  return out.set(x, y, z);
}
/** the point `r` off the log's axis at `a`, φ from the crown (+ toward +c, west) */
function ring(a: number, phi: number, r: number, out = new Vector3()): Vector3 {
  return tw(a, r * Math.sin(phi), AXIS_Y + r * Math.cos(phi), out);
}

/** the glow's hue (linear) and the gain on a surface's albedo at `aGlow` 1 */
const GLOW_TINT: RGB = [1.0, 0.62, 0.3];
export const SOUTH_GLOW_GAIN = 30;
/** the glow's fall-off along the hollow: 1 at the glow, ½ at `GLOW_REACH` m from it */
const GLOW_REACH = 1.45;
const glowAt = (a: number) => 1 / (1 + ((Math.max(0, DISC_A - a)) / GLOW_REACH) ** 2);

/**
 * A lit material that also emits per vertex: `aGlow` (0 … 1) × `uGlowTint` × the surface's own
 * albedo (diffuse × map × vertex colour) — light off the glow at the hollow's end, reflected by
 * what it falls on, with no light in the scene. It rides the fog chunks like the lit part (an
 * additive overlay would brighten with distance instead), under `floor`'s shade floor.
 */
function glowMaterial(params: MeshStandardMaterialParameters, floor: ShadeFloor, gain: number, key: string): MeshStandardMaterial {
  const m = new MeshStandardMaterial(params);
  const tint = new Color(GLOW_TINT[0] * gain, GLOW_TINT[1] * gain, GLOW_TINT[2] * gain);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowTint = { value: tint };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlowTint;\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += uGlowTint * vGlow * diffuseColor.rgb;');
  };
  m.customProgramCacheKey = () => `south-glow/${key}`;
  return applyShadeFloor(m, floor, new Color(HOUSE_BARK_TINT));
}

/** the hollow's heartwood: lighter and warmer than the bark (punky old wood), mostly textured in the shade */
const HOLLOW_FLOOR: ShadeFloor = { lift: 3.2, texture: 0.7, canopy: 1, albedo: 0.06, chroma: 1 };
/** the litter floor: the same, a touch flatter */
const LITTER_FLOOR: ShadeFloor = { lift: 3.6, texture: 0.6, canopy: 1, albedo: 0.07, chroma: 1 };

const tri = (g: BufferGeometry) => Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);

export interface SouthBuild {
  group: Group;
  lanterns: LanternRig[];
  walkSpans: WalkSpan[];
  bases: [number, number, number][];
  /** materials this build created (structures/index.ts disposes them; the textures are the library's) */
  owned: { dispose(): void }[];
  /** the group's visibility for this camera (util/expansionLocality.ts `southVisible`) */
  visible(camera: Camera): boolean;
  audit: {
    planks: number;
    missingPlanks: number;
    brokenPlanks: number;
    deck: { yN: number; yS: number; minY: number; length: number };
    posts: [number, number, number][];
    pods: [number, number, number][];
    podClearance: number;
    triangles: { bridge: number; log: number; foliage: number; walls: number };
    /** the ravine walls' roots and vines near the bridge */
    walls: { roots: number; vines: number };
    log: { mouth: [number, number, number]; floorY: number; axisY: number; glowA: number; walkEnd: number; endRoots: number };
    pointLights: 0;
  };
}

interface PlankSpec {
  a: number;
  w: number;
  L: number;
  t: number;
  cOff: number;
  yaw: number;
  roll: number;
  twist: number;
  tone: number;
  /** 0 weathered silver-grey … 1 a newer, browner replacement */
  age: number;
  moss: number;
  /** metres broken off one end (0: whole) and which end */
  broken: number;
  brokenSide: number;
  board: number;
  seed: number;
}

/** planks map (weathered_planks): nine vertical boards per tile, seams at x = 62 + 113.9 k px of 1024 */
const BOARD_U0 = 62 / 1024;
const BOARD_W = 113.9 / 1024;
const BOARD_INSET = 7 / 1024;

/** one plank: a displaced box (cup, bow, twist, soft top edges, a jagged broken end), uv on one board of the map */
function plankGeometry(p: PlankSpec, noise: Noise2D): BufferGeometry {
  const segZ = p.broken > 0 ? 6 : 3;
  const g = new BoxGeometry(p.L, p.t, p.w, 10, 1, segZ);
  g.translate(0, -p.t / 2, 0);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const hl = p.L / 2;
  const hw = p.w / 2;
  const u0 = BOARD_U0 + p.board * BOARD_W + BOARD_INSET;
  const uW = BOARD_W - 2 * BOARD_INSET;
  // silver-grey weathered or a browner replacement
  const base: RGB = [lerp(1.0, 1.1, p.age), lerp(0.97, 0.9, p.age), lerp(0.93, 0.72, p.age)];
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = nrm.getX(i);
    const ny = nrm.getY(i);
    const nz = nrm.getZ(i);
    const zu = clamp(z / hw, -1, 1);
    // the broken end: that half of the board shortened, its end jagged across the width
    if (p.broken > 0 && x * p.brokenSide > 0) {
      const jag = 0.5 + 0.5 * Math.sin(zu * 4.1 + p.seed) * Math.cos(zu * 9.7 + p.seed * 1.7);
      const cut = p.broken * (0.35 + 0.65 * jag);
      x *= (hl - cut) / hl;
    }
    const xu = clamp(x / hl, -1, 1);
    const top = y > -p.t / 2 ? 1 : 0;
    let dy = 0.004 * (zu * zu - 0.33) + p.twist * xu * zu - 0.004 * (1 - xu * xu);
    if (top) {
      dy -= 0.005 * smoothstep(0.7, 1, Math.abs(zu)) + 0.004 * smoothstep(0.93, 1, Math.abs(xu));
      // the tread: worn a hair lower where the feet go
      dy -= 0.0025 * (1 - smoothstep(0.12, 0.42, Math.abs(x)));
    }
    y += dy;
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
    // colour: the plank's tone, the tread worn paler, damp darker ends with a little moss, dark underneath
    const grainN = noise.noise(x * 2.3 + p.seed, zu * 1.3 + p.seed * 0.7);
    const tread = 1 + 0.1 * (1 - smoothstep(0.1, 0.45, Math.abs(x))) * top;
    const damp = 1 - 0.28 * smoothstep(0.62, 1, Math.abs(xu));
    const under = ny < -0.5 ? 0.5 : Math.abs(nz) > 0.5 ? 0.78 : Math.abs(nx) > 0.5 ? 0.7 : 1;
    const shade = p.tone * tread * damp * under * (0.92 + 0.12 * grainN);
    const mossy = p.moss * smoothstep(0.7, 1, Math.abs(xu)) * clamp(0.5 + 0.8 * noise.noise(x * 9 + p.seed, z * 9), 0, 1) * (ny > 0.5 ? 1 : 0.6);
    col[i * 3] = lerp(base[0] * shade, 0.3, mossy);
    col[i * 3 + 1] = lerp(base[1] * shade, 0.42, mossy);
    col[i * 3 + 2] = lerp(base[2] * shade, 0.1, mossy);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.rotateY(p.yaw);
  g.rotateZ(p.roll);
  // onto the deck: local x → east (−c), z → along the deck's tangent, y → up
  const along = new Vector3(BF.ax, deckSlope(p.a), BF.az).normalize();
  const east = new Vector3(-BF.cx, 0, -BF.cz);
  const up = new Vector3().crossVectors(along, east);
  const topY = deckY(p.a) - PLANK_MAX + p.t;
  g.applyMatrix4(new Matrix4().makeBasis(east, up, along).setPosition(bw(p.a, p.cOff, topY)));
  return g;
}

/** a straight cord between two points (net cords, suspenders): a thin tube with a flat tint */
function cord(a: Vector3, b: Vector3, r: number, tint: RGB): BufferGeometry {
  return sweepTube(new LineCurve3(a, b), { radius: () => r, tubularSegments: 2, radialSegments: 5, uvMetres: 0.2, color: () => tint });
}

/** a lashing: `turns` turns of rope round a (nearly vertical) post at `centre`, on radius `r` */
function lashing(centre: (s: number) => Vector3, r: number, turns: number, rise: number, ropeR: number, tint: RGB, noise: Noise2D, seed: number, a0: number): BufferGeometry {
  const pts: Vector3[] = [];
  const n = Math.ceil(turns * 12);
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    const ang = a0 + s * turns * TAU;
    const c = centre((s - 0.5) * turns * rise);
    pts.push(new Vector3(c.x + Math.cos(ang) * r, c.y, c.z + Math.sin(ang) * r));
  }
  return ropeTube(new CatmullRomCurve3(pts), ropeR, seed, tint, noise, seed * 3.1);
}

export async function buildExpansionSouth(ctx: WorldContext, mats: StructureMaterials, rng: Rng, rope: Material): Promise<SouthBuild> {
  const group = new Group();
  group.name = 'structures-south';
  const terrain = ctx.terrain;
  const seed = `${ctx.config.seed}/structures/south`;
  const noise = new Noise2D(`${seed}/bridge`);
  const lanterns: LanternRig[] = [];
  const bases: [number, number, number][] = [];
  const owned: { dispose(): void }[] = [];
  const pods: Vector3[] = [];
  const casters: Caster[] = [];

  // ================= the bridge =================
  const bridgeRng = rng.fork('bridge');
  const plankRng = bridgeRng.fork('planks');
  const plankParts: BufferGeometry[] = [];
  const ropeParts: BufferGeometry[] = [];
  const postParts: BufferGeometry[] = [];
  const logParts: BufferGeometry[] = [];
  const endParts: BufferGeometry[] = [];
  const hangers: BufferGeometry[] = [];
  const tuftSpecs: MossTuftSpec[] = [];
  const plankSpecs: PlankSpec[] = [];
  let missing = 0;
  let broken = 0;
  {
    let a = -0.04;
    let lastMissing = false;
    while (a < BF.len + 0.02) {
      const w = 0.19 + plankRng() * 0.07;
      const gap = plankRng() < 0.08 ? 0.065 + plankRng() * 0.035 : 0.016 + plankRng() * 0.03;
      const mid = a + w / 2;
      if (mid + w / 2 > BF.len + 0.08) break;
      const inner = mid > 1.6 && mid < BF.len - 1.6;
      const skip: boolean = inner && !lastMissing && plankRng() < 0.045;
      const brk = inner && !skip && plankRng() < 0.07 ? 0.1 + plankRng() * 0.22 : 0;
      const spec: PlankSpec = {
        a: mid,
        w,
        L: 1.18 + plankRng() * 0.12,
        t: 0.045 + plankRng() * 0.015,
        cOff: (plankRng() - 0.5) * 0.06,
        yaw: (plankRng() - 0.5) * 0.07,
        roll: (plankRng() - 0.5) * 0.02,
        twist: (plankRng() - 0.5) * 0.012,
        tone: 0.7 + plankRng() * 0.34,
        age: plankRng() < 0.12 ? 0.6 + plankRng() * 0.4 : plankRng() * 0.25,
        moss: plankRng() < 0.5 ? plankRng() : 0,
        broken: brk,
        brokenSide: plankRng() < 0.5 ? -1 : 1,
        board: Math.floor(plankRng() * 9),
        seed: plankRng() * 100,
      };
      if (skip) missing++;
      else {
        plankSpecs.push(spec);
        plankParts.push(plankGeometry(spec, noise));
        if (brk > 0) broken++;
      }
      lastMissing = skip;
      a += w + gap;
    }
  }

  // the floor ropes: over the north sill, under every plank, over the south sill, tucked down behind each sill
  const ropeTint = (r: Rng): RGB => {
    const s = 0.78 + r() * 0.26;
    return [s, s * 0.95, s * 0.86];
  };
  for (const s of [-1, 1]) {
    const c = s * FLOOR_C;
    const pts: Vector3[] = [];
    const yN0 = sillY(0);
    const yS0 = sillY(BF.len);
    pts.push(bw(-0.1, c, yN0 - SILL_R - 0.05), bw(-0.24, c, yN0 - 0.02), bw(-0.16, c, yN0 + SILL_R * 0.85), bw(-0.02, c, yN0 + SILL_R + FLOOR_R * 0.9));
    for (let a = 0.25; a < BF.len - 0.2; a += 0.45) pts.push(bw(a, c, deckY(a) - PLANK_MAX - FLOOR_R));
    pts.push(bw(BF.len + 0.02, c, yS0 + SILL_R + FLOOR_R * 0.9), bw(BF.len + 0.16, c, yS0 + SILL_R * 0.85), bw(BF.len + 0.24, c, yS0 - 0.02), bw(BF.len + 0.1, c, yS0 - SILL_R - 0.05));
    ropeParts.push(ropeTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.4), FLOOR_R, bridgeRng() * 10, ropeTint(bridgeRng), noise, s * 5.3));
  }
  // each plank tied down to both floor ropes: a loop over its top, down its edges and under the rope
  const tieRng = bridgeRng.fork('ties');
  for (const p of plankSpecs) {
    for (const s of [-1, 1]) {
      const c = s * FLOOR_C + (tieRng() - 0.5) * 0.04;
      const top = deckY(p.a) - PLANK_MAX + p.t + 0.004;
      const bot = deckY(p.a) - PLANK_MAX - 2 * FLOOR_R - 0.006;
      const hw = p.w / 2 + 0.006;
      const loop = [
        [-hw * 0.6, top],
        [0, top + 0.002],
        [hw * 0.6, top],
        [hw, top - p.t * 0.5],
        [hw * 0.55, bot + 0.012],
        [0, bot],
        [-hw * 0.55, bot + 0.012],
        [-hw, top - p.t * 0.5],
      ].map(([da, y]) => bw(p.a + da, c, y));
      const tint = ropeTint(tieRng);
      ropeParts.push(sweepTube(new CatmullRomCurve3(loop, true, 'catmullrom', 0.5), { radius: () => 0.0065, tubularSegments: 16, radialSegments: 4, uvMetres: 0.2, color: () => [tint[0] * 0.8, tint[1] * 0.78, tint[2] * 0.72] }));
    }
  }

  // the sill logs, half buried across the axis at both ends, checked end grain at their ends
  const sillRng = bridgeRng.fork('sills');
  for (const a0 of [0, BF.len]) {
    const y0 = sillY(a0);
    const bow = (sillRng() - 0.5) * 0.05;
    const curve = new CatmullRomCurve3([bw(a0 + bow * 0.3, -SILL_HALF, y0 + (sillRng() - 0.5) * 0.03), bw(a0 + bow, 0, y0), bw(a0 - bow * 0.2, SILL_HALF, y0 + (sillRng() - 0.5) * 0.03)]);
    const phase = sillRng() * 10;
    const radius = (t: number) => SILL_R * (1 + 0.05 * Math.sin(t * 7 + phase));
    const ts = 24;
    const sill = sweepTube(curve, {
      radius,
      tubularSegments: ts,
      radialSegments: 16,
      uvMetres: 1.2,
      displace: (t, ang) => ((noise.ridged(ang * 1.6 + phase, t * 5, 2) - 0.45) * 0.03 + 0.006 * Math.sin(ang * 6 + t * 13)) * (1 - smoothstep(0.93, 1, t)) * (1 - smoothstep(0.07, 0, t)),
      color: (t, ang, up) => {
        const relief = noise.ridged(ang * 1.6 + phase, t * 5, 2);
        const ao = clamp(0.45 + 1.2 * relief, 0.25, 1.25) * (0.75 + 0.25 * Math.max(0, up));
        const m = smoothstep(0.35, 0.8, up + 0.25 * noise.noise(t * 9 + phase, ang));
        return [lerp(0.78 * ao, 1.3 + 0.6 * ao, m), lerp(0.74 * ao, 2.2 + 1.0 * ao, m), lerp(0.68 * ao, 0.45 + 0.25 * ao, m)];
      },
    });
    logParts.push(sill);
    for (const atStart of [true, false]) {
      endParts.push(checkedCap(endFrame(curve, ts, atStart), sillRng.fork(`cap/${a0}/${atStart}`), noise, { radius: radius(atStart ? 0 : 1), segments: 16, color: [0.62, 0.52, 0.42], checks: 3, depth: [0.012, 0.025], dome: -0.01, uvMetres: 0.9 }));
    }
    bases.push([bw(a0, 0, 0).x, terrain.height(bw(a0, 0, 0).x, bw(a0, 0, 0).z), bw(a0, 0, 0).z]);
  }

  // the posts: raked back against the ropes' pull, a pod on an arm at each head; the hand ropes
  // lashed at deck + rail, stayed back to a stake each
  const postRng = bridgeRng.fork('posts');
  const postTops: Vector3[] = [];
  const postAt: { north: boolean; s: number; axis: (h: number) => Vector3; ropeY: number }[] = [];
  const foliage = new FoliageBuilder(bridgeRng.fork('foliage'), `${seed}/bridge`);
  for (const north of [true, false]) {
    for (const s of [-1, 1]) {
      const ap = north ? -B.postBack : BF.len + B.postBack;
      const back = north ? -1 : 1;
      const gp = bw(ap, s * B.postOut, 0);
      const gy = terrain.height(gp.x, gp.z);
      const h = B.postHeight * (0.97 + postRng() * 0.06);
      const rake = 0.07 + postRng() * 0.03;
      const topP = bw(ap + back * rake, s * (B.postOut + 0.03), gy + h);
      const ground = new Vector3(gp.x, gy, gp.z);
      const bottom = ground.clone().lerp(topP, -0.35 / h);
      const curve = new CatmullRomCurve3([bottom, ground, ground.clone().lerp(topP, 0.5), topP]);
      const postLen = h + 0.35;
      const above = (t: number) => t * postLen - 0.35;
      const i = postTops.length;
      const radius = (t: number) => (0.125 - 0.032 * t) * (1 + 0.04 * Math.sin(t * 6 + i * 1.7));
      const ts = 20;
      postParts.push(
        sweepTube(curve, {
          radius,
          tubularSegments: ts,
          radialSegments: 16,
          uvMetres: 0.7,
          displace: (t, ang) => {
            const coarse = (noise.ridged(ang * 1.3 + i * 2.1, t * 3, 2) - 0.5) * 0.024;
            const fine = (woodGrain(noise, above(t), ang, 18, 1.2, i + 11) - 0.5) * 0.008;
            return (coarse + fine + Math.sin(ang * 5 + i) * 0.004) * (1 - smoothstep(0.96, 1, t));
          },
          color: (t, ang) => {
            const fine = woodGrain(noise, above(t), ang, 18, 1.2, i + 11);
            const coarse = noise.ridged(ang * 1.3 + i * 2.1, t * 3, 2);
            const furrow = lerp(0.6, 1.1, 0.5 * fine + 0.5 * coarse);
            const d = (0.5 + 0.35 * t) * (0.9 + 0.2 * Math.max(0, Math.sin(ang))) * furrow;
            const mossy = smoothstep(0.2, 0.0, above(t)) * (0.3 + 0.4 * (1 - fine));
            return [lerp(d, 0.22, mossy), lerp(d * 0.92, 0.27, mossy), lerp(d * 0.84, 0.07, mossy)];
          },
        }),
      );
      postParts.push(checkedCap(endFrame(curve, ts), postRng.fork(`cap/${i}`), noise, { radius: radius(1), segments: 16, color: [0.55, 0.5, 0.44], checks: 3, depth: [0.01, 0.022], dome: 0.008, uvMetres: 0.8, uvOffset: [0.2 + i * 0.13, 0.6] }));
      tuftSpecs.push(...footMoss(ctx, ground, postRng.fork(`foot/${i}`), { postRadius: radius(0.35 / postLen), count: 18, size: [0.018, 0.042], color: [0.32, 0.44, 0.09], favour: [0.62, 0.78] }));
      bases.push([ground.x, ground.y, ground.z]);
      postTops.push(topP);
      casters.push({ x: gp.x, z: gp.z, r: 0.75, y0: gy - 0.1, y1: gy + h + 0.1, shadow: true });
      const axis = (hh: number) => ground.clone().lerp(topP, hh / h);
      const ropeY = (north ? Y_N : Y_S) + B.rail;
      postAt.push({ north, s, axis, ropeY });

      // the lantern arm: a short bough out of the post's head, over the outside and a little toward the span
      const out = new Vector3(BF.cx * s, 0, BF.cz * s);
      const span = new Vector3(BF.ax, 0, BF.az).multiplyScalar(north ? 1 : -1);
      const armFrom = axis(h - 0.14);
      const dir = out.clone().multiplyScalar(0.86).addScaledVector(span, 0.3).add(new Vector3(0, 0.28, 0)).normalize();
      const armLen = 0.44 + postRng() * 0.06;
      const armTip = armFrom.clone().addScaledVector(dir, armLen).add(new Vector3(0, 0.02, 0));
      const armMid = armFrom.clone().addScaledVector(dir, armLen * 0.5).add(new Vector3(0, -0.012, 0));
      const armCurve = new CatmullRomCurve3([armFrom.clone().addScaledVector(dir, -0.06), armMid, armTip]);
      postParts.push(
        sweepTube(armCurve, {
          radius: (t) => 0.048 - 0.02 * t,
          tubularSegments: 8,
          radialSegments: 10,
          uvMetres: 0.5,
          capEnd: true,
          displace: (t, ang) => 0.004 * Math.sin(ang * 4 + t * 9 + i),
          color: (t) => [0.55 + 0.1 * t, 0.5 + 0.08 * t, 0.42 + 0.05 * t],
        }),
      );
      const hook = armTip.clone().addScaledVector(dir, -0.05).add(new Vector3(0, -0.045, 0));
      hangers.push(lanternHanger(hook, dir, 0.95));
      const rig = buildLantern(hook, 0.2 + postRng() * 0.08, mats, postRng.fork(`pod/${i}`), 0.95, 'orange');
      group.add(rig.pivot);
      lanterns.push(rig);
      pods.push(rig.pod);
      // a leafy tuft and a trailing vine at the head of the post
      foliage.addLeafCluster(topP.clone().add(new Vector3(0, 0.02, 0)), 0.12, 9, { size: 0.09, droop: 0.4, flatten: 0.5 });
      const vinePts: Vector3[] = [];
      const vineN: Vector3[] = [];
      const turns = 0.9 + postRng() * 0.6;
      const a0 = postRng() * TAU;
      for (let k = 0; k <= 10; k++) {
        const f = k / 10;
        const hh = lerp(h - 0.05, 0.25 + postRng() * 0.2, f);
        const c = axis(hh);
        const ang = a0 + f * turns * TAU;
        const rr = radius(clamp((hh + 0.35) / postLen, 0, 1)) + 0.012;
        vinePts.push(new Vector3(c.x + Math.cos(ang) * rr, c.y, c.z + Math.sin(ang) * rr));
        vineN.push(new Vector3(Math.cos(ang), 0, Math.sin(ang)));
      }
      if (postRng() < 0.75) foliage.addSurfaceVine(vinePts, vineN, { leafSize: 0.06, thickness: 0.009 });

      // the lashing that holds the hand rope, and the backstay to its stake
      const ropeHh = ropeY - gy;
      ropeParts.push(lashing((d) => axis(ropeHh + d), radius(clamp((ropeHh + 0.35) / postLen, 0, 1)) * 1.05 + 0.03, 2.5, 0.034, 0.014, ropeTint(postRng), noise, i * 2.3 + 1, postRng() * TAU));
      const stakeG = bw(north ? -STAKE_BACK : BF.len + STAKE_BACK, s * STAKE_C, 0);
      const sy = terrain.height(stakeG.x, stakeG.z);
      const stakeFoot = new Vector3(stakeG.x, sy, stakeG.z);
      const stakeTop = bw(north ? -STAKE_BACK - 0.06 : BF.len + STAKE_BACK + 0.06, s * (STAKE_C + 0.03), sy + 0.34);
      const stakeCurve = new CatmullRomCurve3([stakeFoot.clone().lerp(stakeTop, -0.8), stakeFoot, stakeTop]);
      postParts.push(
        sweepTube(stakeCurve, {
          radius: (t) => 0.058 - 0.012 * t,
          tubularSegments: 6,
          radialSegments: 10,
          uvMetres: 0.5,
          displace: (t, ang) => (noise.ridged(ang * 1.5 + i, t * 2, 2) - 0.5) * 0.012 * (1 - smoothstep(0.9, 1, t)),
          color: (t) => [0.5 + 0.12 * t, 0.46 + 0.1 * t, 0.4 + 0.08 * t],
        }),
      );
      postParts.push(checkedCap(endFrame(stakeCurve, 6), postRng.fork(`stake-cap/${i}`), noise, { radius: 0.046, segments: 10, color: [0.55, 0.5, 0.44], checks: 2, depth: [0.006, 0.012], dome: 0.004, uvMetres: 0.8 }));
      tuftSpecs.push(...footMoss(ctx, stakeFoot, postRng.fork(`stake-foot/${i}`), { postRadius: 0.06, count: 8, size: [0.014, 0.03], color: [0.32, 0.44, 0.09] }));
      const stayFrom = axis(ropeHh + 0.05);
      const stayTo = stakeTop.clone().lerp(stakeFoot, 0.3);
      const stayMid = stayFrom.clone().lerp(stayTo, 0.5).add(new Vector3(0, -0.05, 0));
      ropeParts.push(ropeTube(new CatmullRomCurve3([stayFrom, stayMid, stayTo]), 0.02, postRng() * 10, ropeTint(postRng), noise, i * 4.1));
      ropeParts.push(lashing((d) => stakeFoot.clone().lerp(stakeTop, clamp(0.7 + d / 0.34, 0, 1)), 0.074, 2, 0.03, 0.012, ropeTint(postRng), noise, i * 1.9 + 7, postRng() * TAU));
      casters.push({ x: stakeG.x, z: stakeG.z, r: 0.45, y0: sy - 0.1, y1: sy + 0.5, shadow: true });
    }
  }

  // the hand ropes: post to post at rail height over the deck, drawn in toward mid-span; a
  // zig-zag of cord from each down to its floor rope
  const netRng = bridgeRng.fork('net');
  for (const s of [-1, 1]) {
    const pn = postAt.find((p) => p.north && p.s === s)!;
    const ps = postAt.find((p) => !p.north && p.s === s)!;
    const nGround = pn.axis(0).y;
    const sGround = ps.axis(0).y;
    const railC = (a: number) => {
      const u = clamp(a / BF.len, 0, 1);
      return s * lerp(RAIL_C_END, RAIL_C_MID, 4 * u * (1 - u));
    };
    const railY = (a: number) => {
      const u = clamp(a / BF.len, 0, 1);
      return deckY(a) + B.rail + 0.035 * 4 * u * (1 - u);
    };
    const pts: Vector3[] = [pn.axis(pn.ropeY - nGround)];
    for (let a = 0.35; a < BF.len - 0.3; a += 0.55) pts.push(bw(a, railC(a), railY(a)));
    pts.push(ps.axis(ps.ropeY - sGround));
    ropeParts.push(ropeTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), 0.024, netRng() * 10, ropeTint(netRng), noise, s * 9.1));
    const netTint: RGB = [0.62, 0.56, 0.45];
    const step = 0.46;
    let prev: Vector3 | null = null;
    let k = 0;
    for (let a = 0.3; a <= BF.len - 0.3 + 1e-6; a += step, k++) {
      const up = k % 2 === 0;
      const p = up ? bw(a, railC(a) * 0.985, railY(a) - 0.01) : bw(a, s * (FLOOR_C + 0.02), deckY(a) - PLANK_MAX - FLOOR_R + 0.004);
      if (prev) ropeParts.push(cord(prev, p, 0.0075, [netTint[0] * (0.9 + netRng() * 0.2), netTint[1], netTint[2]]));
      prev = p;
    }
    // a few leafy vines hanging from the hand rope and under the deck into the ravine
    for (let v = 0; v < 5; v++) {
      const a = 1.2 + netRng() * (BF.len - 2.4);
      if (netRng() < 0.5) foliage.addHangingVine(bw(a, railC(a), railY(a) - 0.02), 0.25 + netRng() * 0.5, { leafSize: 0.055, thickness: 0.006, amount: 0.12 });
      foliage.addHangingVine(bw(a + 0.3, s * (FLOOR_C + 0.05), deckY(a + 0.3) - PLANK_MAX - 0.03), 0.5 + netRng() * 1.4, { leafSize: 0.06, thickness: 0.007, amount: 0.14 });
    }
  }
  // the deck's casters: its mass every ~1.6 m, from under the floor ropes to over the hand ropes
  for (let a = 0.8; a < BF.len; a += 1.6) {
    const p = bw(a, 0, deckY(a));
    casters.push({ x: p.x, z: p.z, r: 1.15, y0: deckY(a) - 0.35, y1: deckY(a) + B.rail + 0.15, shadow: true });
  }
  // moss cushions along the sills' tops
  const sillMossRng = bridgeRng.fork('sill-moss');
  for (const a0 of [0, BF.len]) {
    for (let k = 0; k < 36; k++) {
      const c = (sillMossRng() * 2 - 1) * (SILL_HALF - 0.1);
      if (Math.abs(c) < FLOOR_C + 0.72 && sillMossRng() < 0.8) continue;
      const ang = (sillMossRng() - 0.5) * 1.6;
      const n = new Vector3(BF.ax * Math.sin(ang), Math.cos(ang), BF.az * Math.sin(ang)).normalize();
      const p = bw(a0 + Math.sin(ang) * SILL_R, c, sillY(a0) + Math.cos(ang) * SILL_R);
      const rad = 0.025 + sillMossRng() * 0.05;
      const gain = 0.85 + sillMossRng() * 0.3;
      tuftSpecs.push({ position: p, normal: n, rx: rad, rz: rad * (0.7 + sillMossRng() * 0.5), h: rad * 0.7, yaw: sillMossRng() * TAU, color: [0.34 * gain, 0.46 * gain, 0.1 * gain], uv: [p.x / 1.6, p.z / 1.6], sink: rad * 0.4, seed: 1 + Math.floor(sillMossRng() * 1e6) });
    }
  }

  // ================= the hollow log =================
  const logRng = rng.fork('log');
  const barkN = new Noise2D(`${seed}/log/bark`);
  const rimN = new Noise2D(`${seed}/log/rim`);
  // the broken end: a torn rim with a few long splinters standing forward on the upper side
  const splinters: { phi: number; half: number; len: number }[] = [];
  for (let k = 0; k < 4; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    splinters.push({ phi: side * (0.15 + logRng() * 1.05), half: 0.07 + logRng() * 0.09, len: 0.22 + logRng() * 0.45 });
  }
  const aRim = (phi: number) => {
    let a = 0.07 * rimN.noise(phi * 2.2, 0.5) + 0.035 * rimN.noise(phi * 9, 3.3);
    for (const sp of splinters) {
      const d = Math.abs(phi - sp.phi) / sp.half;
      if (d < 1) a -= sp.len * Math.pow(1 - d, 1.5);
    }
    return a;
  };
  const shellR = (phi: number, a: number) => {
    const arc = phi * T.outerRadius;
    const ridge = barkN.ridged(arc * 1.9, a * 0.2 + 7.7, 3);
    const fine = barkN.noise(arc * 7 + 3.3, a * 1.3);
    const lumps = barkN.fbm(arc * 0.35 + 20, a * 0.3, 2);
    const oval = 1 - 0.03 * Math.cos(2 * phi);
    const peel = 1 - 0.035 * (1 - smoothstep(0, 0.45, a - aRim(phi)));
    return T.outerRadius * oval * peel + 0.06 * (ridge - 0.45) + 0.012 * fine + 0.05 * lumps;
  };
  const innerR = (phi: number, a: number) => {
    const arc = phi * T.innerRadius;
    const fissure = barkN.ridged(arc * 2.4 + 40, a * 0.3 + 2, 2);
    return T.innerRadius * (1 + 0.018 * barkN.noise(arc * 0.8 + 9, a * 0.5)) + 0.035 * (fissure - 0.4);
  };
  const upness = (phi: number) => Math.cos(phi);
  const cols = 112;
  const phiAt = (u: number) => lerp(-PHI_MAX, PHI_MAX, u);
  const logAxis = (a: number) => tw(a, 0, AXIS_Y);
  const moss = (phi: number, a: number) => {
    const arc = phi * T.outerRadius;
    const edge = 0.3 * barkN.fbm(arc * 0.6 + 3, a * 0.5, 2);
    return clamp(smoothstep(0.25, 0.7, upness(phi) + edge) * (0.8 + 0.4 * barkN.noise(arc * 1.3, a * 1.1 + 5)), 0, 1);
  };

  // the bark shell
  const shell = gridSurface(
    (u, v, out) => {
      const phi = phiAt(u);
      const r0 = aRim(phi);
      const a = r0 + (T.length - r0) * Math.pow(v, 1.3);
      const r = shellR(phi, a);
      ring(a, phi, r, out.position);
      const arc = phi * T.outerRadius;
      out.uv = [arc / 1.6, a / 1.6];
      const relief = barkN.ridged(arc * 1.9, a * 0.2 + 7.7, 3) - 0.45 + 0.4 * barkN.noise(arc * 7 + 3.3, a * 1.3) * 0.2;
      // floors: the flanks by the mouth sit in the bank's shade, and darker vertex tones there read as a black outline round the glow
      const ao = clamp(0.62 + 1.6 * relief, 0.4, 1.3);
      const vari = 0.85 + 0.3 * barkN.noise(arc * 0.9, a * 0.9 + 7);
      const up = upness(phi);
      const belly = lerp(0.62, 1, smoothstep(-0.9, 0.3, up));
      const shade = ao * vari * belly;
      const m = moss(phi, a);
      const rimDamp = 1 - 0.08 * (1 - smoothstep(0, 0.6, a - r0));
      const barkC: RGB = [0.78 * shade * rimDamp, 0.74 * shade * rimDamp, 0.68 * shade * rimDamp];
      const mossC: RGB = [1.3 + 0.8 * shade, 2.3 + 1.3 * shade, 0.5 + 0.3 * shade];
      out.color = [lerp(barkC[0], mossC[0], m), lerp(barkC[1], mossC[1], m), lerp(barkC[2], mossC[2], m)];
    },
    { cols, rows: 46 },
  );
  faceTowards(shell, (p, o) => o.copy(p).multiplyScalar(2).sub(logAxis(tunnelLocalA(p))));
  setFloatAttribute(shell, 'aGlow', 0);
  logParts.push(shell);

  // the rim: end grain across the wall from the hollow (map v 1) to the bark (v 0), torn in the middle rows
  const rim = gridSurface(
    (u, v, out) => {
      const phi = phiAt(u);
      const a0 = aRim(phi);
      const rIn = innerR(phi, a0);
      const rOut = shellR(phi, a0);
      const tear = 0.05 * rimN.noise(phi * 7, v * 2 + 1.5) * Math.sin(Math.PI * v);
      ring(a0 + tear, phi, lerp(rIn, rOut, v), out.position);
      out.uv = [(phi * 1.9) / 1.5, 1 - v];
      const d = lerp(0.36, 0.62, v) * (0.85 + 0.3 * rimN.noise(phi * 6, v * 3)) * (1 + 0.12 * rimN.noise(phi * 40, v * 2 + 1));
      out.color = [d, d * 0.8, d * 0.62];
    },
    { cols, rows: 5 },
  );
  faceTowards(rim, (p, o) => o.copy(p).add(new Vector3(-TF_AX * 5, 0, -TF_AZ * 5)));
  endParts.push(rim);

  // splinter shards standing out of the rim (end grain, fold into the rim's draw)
  const shardRng = logRng.fork('shards');
  for (let k = 0; k < 16; k++) {
    const phi = phiAt(0.12 + shardRng() * 0.76);
    const a0 = aRim(phi);
    const rr = lerp(innerR(phi, a0) + 0.05, shellR(phi, a0) - 0.06, shardRng());
    const base = ring(a0 + 0.12, phi, rr);
    const radial = ring(a0, phi, 1).sub(logAxis(a0)).normalize();
    const fwd = new Vector3(-TF_AX, 0, -TF_AZ);
    const dir = fwd.clone().addScaledVector(radial, (shardRng() - 0.4) * 0.6).normalize();
    const len = 0.18 + shardRng() * 0.5;
    const r0 = 0.02 + shardRng() * 0.035;
    const tip = base.clone().addScaledVector(dir, len);
    const mid = base.clone().lerp(tip, 0.5).addScaledVector(radial, (shardRng() - 0.5) * 0.05);
    const pale = 0.55 + shardRng() * 0.3;
    endParts.push(
      sweepTube(new CatmullRomCurve3([base, mid, tip]), {
        radius: (t) => r0 * (1 - 0.9 * t),
        tubularSegments: 4,
        radialSegments: 4,
        uvMetres: 0.5,
        color: (t) => [pale * (1 - 0.3 * t), pale * 0.8 * (1 - 0.3 * t), pale * 0.62 * (1 - 0.3 * t)],
      }),
    );
  }

  // the hollow: heartwood walls from the rim to past the glow, faces toward the axis, emitting the glow's light
  const HOLLOW_END = DISC_A + 0.35;
  const hollowGlow: number[] = [];
  const hollow = gridSurface(
    (u, v, out) => {
      const phi = phiAt(u);
      const r0 = aRim(phi);
      const a = r0 + (HOLLOW_END - r0) * Math.pow(v, 1.15);
      const r = innerR(phi, a);
      ring(a, phi, r, out.position);
      const arc = phi * T.innerRadius;
      out.uv = [arc / 1.4 + 0.37, a / 1.4];
      const fissure = barkN.ridged(arc * 2.4 + 40, a * 0.3 + 2, 2);
      const up = upness(phi);
      const ao = clamp(1.25 - 1.6 * (fissure - 0.4), 0.35, 1.3);
      // damp and mossy by the mouth on the upper wall, pale dry checks deeper in, dark near the floor
      const mouthM = (1 - smoothstep(0.1, 0.9, a - r0)) * smoothstep(-0.2, 0.5, up) * clamp(0.6 + 0.6 * barkN.noise(arc * 2, a * 2), 0, 1);
      const foot = lerp(0.62, 1, smoothstep(-0.8, -0.35, up));
      const d = ao * foot * (0.88 + 0.24 * barkN.noise(arc * 1.1 + 5, a * 0.9));
      const woodC: RGB = [0.95 * d, 0.72 * d, 0.52 * d];
      const mossC: RGB = [0.5, 0.7, 0.2];
      out.color = [lerp(woodC[0], mossC[0], mouthM), lerp(woodC[1], mossC[1], mouthM), lerp(woodC[2], mossC[2], mouthM)];
    },
    { cols, rows: 40 },
  );
  faceTowards(hollow, (p, o) => o.copy(tw(tunnelLocalA(p), 0, AXIS_Y)));
  {
    const pos = hollow.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const a = tunnelLocalA(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      hollowGlow.push(glowAt(a) * (0.9 + 0.2 * barkN.noise(i * 0.37, a)));
    }
    hollow.setAttribute('aGlow', new Float32BufferAttribute(hollowGlow, 1));
  }

  // the litter floor: level with the far route, dipping under the apron in front of the rim,
  // heaped a little against the walls; walked paler down the middle
  const floorGeo = gridSurface(
    (u, v, out) => {
      const a = lerp(-0.14, DISC_A + 0.12, v);
      const hwF = lerp(1.1, 1.22, smoothstep(-0.1, 0.35, a));
      const c = lerp(-hwF, hwF, u);
      const heap = 0.05 * smoothstep(0.75, 1.15, Math.abs(c));
      const lumps = 0.012 * barkN.noise(c * 3 + 50, a * 3) + 0.006 * barkN.noise(c * 11, a * 11 + 3);
      const dip = -0.05 * (1 - smoothstep(-0.14, 0.02, a));
      tw(a, c, FLOOR_Y + 0.02 + heap + lumps + dip, out.position);
      const [x, z] = tunnelWorld(a, c);
      out.uv = [x / 1.3, z / 1.3];
      const path = 1 + 0.12 * (1 - smoothstep(0.2, 0.6, Math.abs(c)));
      const edge = lerp(1, 0.7, smoothstep(0.7, 1.15, Math.abs(c)));
      const d = path * edge * (0.9 + 0.2 * barkN.noise(c * 2 + 9, a * 2));
      out.color = [d, d * 0.95, d * 0.88];
    },
    { cols: 14, rows: 36 },
  );
  faceTowards(floorGeo, (p, o) => o.copy(p).add(new Vector3(0, 5, 0)));
  {
    const pos = floorGeo.attributes.position;
    const g = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) g[i] = glowAt(tunnelLocalA(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)))) * 1.1;
    floorGeo.setAttribute('aGlow', new Float32BufferAttribute(g, 1));
  }

  // the glow closing the tube: a shallow bowl of warm light (its centre recessed), hottest at the middle
  const glowRng = logRng.fork('glow');
  const glowPhase = glowRng() * 10;
  const disc = gridSurface(
    (u, v, out) => {
      const phi = u * TAU;
      const rho = v;
      ring(DISC_A + 0.5 * (1 - rho * rho), phi, rho * (T.innerRadius + 0.14), out.position);
      out.uv = [u, v];
      // a hot pale core over an amber ring that deepens toward the bore (the whole disc used to tone-map to one flat cream)
      const wisp = 0.88 + 0.24 * barkN.noise(Math.cos(phi) * 2.4 * rho + glowPhase, Math.sin(phi) * 2.4 * rho);
      const k = Math.pow(1 - rho, 2.1) * wisp;
      const edge = smoothstep(0.55, 1, rho);
      out.color = [lerp(1.35, 3.2, k) * (1 - 0.45 * edge), lerp(0.66, 2.6, k) * (1 - 0.55 * edge), lerp(0.24, 1.75, k) * (1 - 0.65 * edge)];
    },
    { cols: 40, rows: 10, closedU: true },
  );
  faceTowards(disc, (p, o) => o.copy(p).add(new Vector3(-TF_AX * 5, 0, -TF_AZ * 5)));
  const glowMat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, toneMapped: true });
  owned.push(glowMat);
  const discMesh = new Mesh(disc, glowMat);
  discMesh.name = 'south-log-glow';
  group.add(discMesh);

  // haze in front of the glow: two soft warm veils (vertex alpha), inside the walk's end so the camera never crosses them
  const hazeParts: BufferGeometry[] = [];
  for (const [a, alpha] of [
    [T.deadEnd - 0.08, 0.12],
    [T.deadEnd + 0.12, 0.2],
  ] as const) {
    const card = gridSurface(
      (u, v, out) => {
        const phi = u * TAU;
        ring(a, phi, v * (T.innerRadius - 0.02), out.position);
        out.uv = [u, v];
      },
      { cols: 28, rows: 6, closedU: true },
    );
    const pos = card.attributes.position;
    const rgba = new Float32Array(pos.count * 4);
    const rows = 6;
    const nu = 29;
    for (let i = 0; i < pos.count; i++) {
      const v = Math.floor(i / nu) / (rows - 1);
      const k = Math.pow(1 - v, 1.6);
      rgba[i * 4] = 1.6;
      rgba[i * 4 + 1] = 1.05;
      rgba[i * 4 + 2] = 0.55;
      rgba[i * 4 + 3] = alpha * k;
    }
    card.setAttribute('color', new Float32BufferAttribute(rgba, 4));
    hazeParts.push(card);
  }
  const hazeMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, fog: false, toneMapped: true });
  owned.push(hazeMat);
  const hazeMesh = new Mesh(merge(hazeParts), hazeMat);
  hazeMesh.name = 'south-log-haze';
  hazeMesh.renderOrder = 2;
  group.add(hazeMesh);

  // two pods at the mouth on short branch stubs out of the bark, framing the opening
  const mouthRng = logRng.fork('mouth-pods');
  const logFoliage = new FoliageBuilder(logRng.fork('foliage'), `${seed}/log`);
  for (const side of [-1, 1]) {
    const phi = side * (0.74 + mouthRng() * 0.08);
    const a0 = Math.max(aRim(phi), -0.05) + 0.32;
    const from = ring(a0, phi, shellR(phi, a0) - 0.05);
    const radial = ring(a0, phi, 1).sub(logAxis(a0)).normalize();
    const fwd = new Vector3(-TF_AX, 0, -TF_AZ);
    const dir = fwd.clone().multiplyScalar(0.8).addScaledVector(radial, 0.45).add(new Vector3(0, 0.1, 0)).normalize();
    const len = 0.62 + mouthRng() * 0.1;
    const tip = from.clone().addScaledVector(dir, len);
    const mid = from.clone().lerp(tip, 0.5).add(new Vector3(0, 0.03, 0));
    const stubCurve = new CatmullRomCurve3([from.clone().addScaledVector(dir, -0.1), mid, tip]);
    postParts.push(
      sweepTube(stubCurve, {
        radius: (t) => 0.075 - 0.04 * t,
        tubularSegments: 8,
        radialSegments: 10,
        uvMetres: 0.5,
        displace: (t, ang) => 0.006 * Math.sin(ang * 5 + t * 7 + side),
        color: (t) => [0.5 + 0.12 * t, 0.46 + 0.1 * t, 0.4 + 0.08 * t],
      }),
    );
    endParts.push(checkedCap(endFrame(stubCurve, 8), mouthRng.fork(`stub-cap/${side}`), noise, { radius: 0.035, segments: 10, color: [0.6, 0.5, 0.4], checks: 2, depth: [0.004, 0.009], dome: 0.003, uvMetres: 0.8 }));
    const hook = tip.clone().addScaledVector(dir, -0.07).add(new Vector3(0, -0.035, 0));
    hangers.push(lanternHanger(hook, dir, 1));
    const rig = buildLantern(hook, 0.26 + mouthRng() * 0.1, mats, mouthRng.fork(`pod/${side}`), 1, 'orange');
    group.add(rig.pivot);
    lanterns.push(rig);
    pods.push(rig.pod);
    logFoliage.addLeafCluster(tip.clone().add(new Vector3(0, 0.05, 0)), 0.14, 10, { size: 0.1, droop: 0.5, flatten: 0.6 });
  }

  // foliage on the log: vines over the rim (short over the opening), strands draped down the
  // flanks, grass and ferns along the crown, moss cushions on the cap
  const vineRng = logRng.fork('vines');
  for (let k = 0; k < 14; k++) {
    const phi = phiAt(0.14 + vineRng() * 0.72);
    const a0 = aRim(phi) + 0.05;
    const hookP = ring(a0, phi, shellR(phi, a0) + 0.02);
    const overOpening = Math.abs(Math.sin(phi) * T.outerRadius) < 1.05;
    const length = overOpening ? 0.3 + vineRng() * 0.55 : 0.5 + vineRng() * 1.2;
    logFoliage.addHangingVine(hookP, length, { drift: new Vector3(-TF_AX * 0.12, 0, -TF_AZ * 0.12), leafSize: 0.07, thickness: 0.01, amount: 0.1 });
  }
  for (let k = 0; k < 5; k++) {
    const a0 = 0.6 + vineRng() * 5.5;
    const side = vineRng() < 0.5 ? -1 : 1;
    const pts: Vector3[] = [];
    const ns: Vector3[] = [];
    for (let j = 0; j <= 8; j++) {
      const f = j / 8;
      const phi = side * lerp(0.1 + vineRng() * 0.2, 1.75, f);
      const a = a0 + (vineRng() - 0.5) * 0.25 + f * 0.3;
      pts.push(ring(a, phi, shellR(phi, a) + 0.015));
      ns.push(ring(a, phi, 1).sub(logAxis(a)).normalize());
    }
    logFoliage.addSurfaceVine(pts, ns, { leafSize: 0.08, thickness: 0.014 });
  }
  const tuftRng = logRng.fork('tufts');
  for (let k = 0; k < 46; k++) {
    const phi = (tuftRng() - 0.5) * 1.5;
    const a = aRim(phi) + 0.15 + tuftRng() * (T.mound.face[0] - 0.4);
    const n = ring(a, phi, 1).sub(logAxis(a)).normalize();
    const p = ring(a, phi, shellR(phi, a) - 0.01);
    logFoliage.addTuft(p, n, 0.16 + tuftRng() * 0.2, tuftRng() < 0.35 ? 1 : 0, 0.06, [0.9, 1.0, 0.85]);
  }
  const mossRng = logRng.fork('moss');
  const logTufts: MossTuftSpec[] = [];
  for (let k = 0; k < 170; k++) {
    const phi = (mossRng() - 0.5) * 2.1;
    const a = aRim(phi) + 0.08 + mossRng() * (T.mound.face[0] - 0.2);
    if (moss(phi, a) < 0.45) continue;
    const n = ring(a, phi, 1).sub(logAxis(a)).normalize();
    const p = ring(a, phi, shellR(phi, a));
    const rad = 0.04 + mossRng() * 0.09;
    const gain = 0.8 + mossRng() * 0.4;
    logTufts.push({ position: p, normal: n, rx: rad, rz: rad * (0.7 + mossRng() * 0.5), h: rad * (0.5 + mossRng() * 0.4), yaw: mossRng() * TAU, color: [0.36 * gain, 0.5 * gain, 0.11 * gain], uv: [(phi * T.outerRadius) / 1.6, a / 1.6], sink: rad * 0.5, seed: 1 + Math.floor(mossRng() * 1e6) });
  }
  // the glow's foreground, past the walk's end: rootlets and a few leafy strands hanging from the
  // bore's roof, dark against the light — they give the far end a depth the bare disc lacked
  const endRng = logRng.fork('end-roots');
  let endRoots = 0;
  for (let k = 0; k < 8; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    const phi = side * (0.22 + endRng() * 0.8);
    const a0 = T.deadEnd + 0.04 + endRng() * (DISC_A - T.deadEnd - 0.16);
    const top = ring(a0, phi, innerR(phi, a0) - 0.02);
    const len = Math.min(top.y - (FLOOR_Y + 0.35), 0.3 + endRng() * 1.05);
    const sx = (endRng() - 0.5) * 0.14;
    const sz = (endRng() - 0.5) * 0.1;
    const r0 = 0.011 + endRng() * 0.016;
    if (len < 0.2) continue;
    logParts.push(
      sweepTube(new CatmullRomCurve3([top.clone().add(new Vector3(0, 0.05, 0)), top.clone().add(new Vector3(sx * 0.4, -len * 0.45, sz * 0.4)), top.clone().add(new Vector3(sx, -len, sz))]), {
        radius: (t) => r0 * (1 - 0.8 * t) + 0.002,
        tubularSegments: 6,
        radialSegments: 5,
        uvMetres: 0.5,
        color: (t) => [0.34 - 0.08 * t, 0.27 - 0.06 * t, 0.2 - 0.05 * t],
      }),
    );
    endRoots++;
  }
  for (let k = 0; k < 3; k++) {
    const phi = (k - 1) * 0.6 + (endRng() - 0.5) * 0.24;
    const a0 = T.deadEnd + 0.1 + endRng() * 0.18;
    logFoliage.addHangingVine(ring(a0, phi, innerR(phi, a0) - 0.03), 0.35 + endRng() * 0.6, { drift: new Vector3(0, 0, 0), leafSize: 0.075, thickness: 0.008, amount: 0.12 });
  }

  // ================= the ravine's walls =================
  // roots out from under the lips and leafy vines down the faces, within reach of what the deck
  // and its heads look along (the turf, ferns and moss are the vegetation's: expansionSouth.ts)
  const wallRng = rng.fork('ravine-walls');
  const wallNoise = new Noise2D(`${seed}/ravine-walls`);
  const wallFoliage = new FoliageBuilder(wallRng.fork('foliage'), `${seed}/ravine`);
  const rootParts: BufferGeometry[] = [];
  const RV = EXPANSION_SOUTH.ravine;
  const RL = southRavineLine();
  const RLs: number[] = [0];
  for (let i = 1; i < RL.length; i++) RLs.push(RLs[i - 1] + Math.hypot(RL[i][0] - RL[i - 1][0], RL[i][1] - RL[i - 1][1]));
  const sMid = (() => {
    const m = bw(BF.len / 2, 0, 0);
    return ravineHit(m.x, m.z)?.s ?? 0;
  })();
  /** the centreline point, its unit tangent (west → east) and the top half width at arc length `s` */
  const lineAt = (s: number) => {
    let i = 1;
    while (i < RL.length - 1 && RLs[i] < s) i++;
    const f = clamp((s - RLs[i - 1]) / Math.max(RLs[i] - RLs[i - 1], 1e-6), 0, 1);
    const tx = RL[i][0] - RL[i - 1][0];
    const tz = RL[i][1] - RL[i - 1][1];
    const tl = Math.hypot(tx, tz) || 1;
    return { x: lerp(RL[i - 1][0], RL[i][0], f), z: lerp(RL[i - 1][1], RL[i][1], f), tx: tx / tl, tz: tz / tl, W: lerp(RL[i - 1][2], RL[i][2], f) };
  };
  /**
   * The wall's face down the fall line from the lip at arc length `s` on `side` (+1 the south
   * wall): a point every `step` m of drop from where the cut starts to `drop` m down, `lift` m off
   * the face along its normal, meandering `wander(drop fraction)` m along the gorge. Marches in
   * from outside the lip on the live ground, so every point is on the face as rendered.
   */
  const wallPath = (s: number, side: number, drop: number, lift: number, wander: (f: number) => number, step = 0.2) => {
    const L = lineAt(s);
    const ox = L.tz * side;
    const oz = -L.tx * side;
    const at = (d: number, w: number): [number, number] => [L.x - ox * d + L.tx * w, L.z - oz * d + L.tz * w];
    let d = L.W + RV.lip + 1.0;
    const [x0, z0] = at(d, wander(0));
    const top = terrain.height(x0, z0);
    const pts: Vector3[] = [];
    const nrm: Vector3[] = [];
    let next = top - 0.03;
    let f = 0;
    for (; d > 0.3; d -= 0.02) {
      const [x, z] = at(d, wander(f));
      const h = terrain.height(x, z);
      if (h > next) continue;
      const n = terrain.normal(x, z, new Vector3());
      pts.push(new Vector3(x, h, z).addScaledVector(n, lift));
      nrm.push(n);
      f = (top - h) / drop;
      next = h - step;
      if (f >= 1) break;
    }
    // `out`: horizontal, away from the gorge (back under the lip's turf)
    return { pts, nrm, top, out: new Vector3(-ox, 0, -oz) };
  };
  /** off the bridge: the deck spans the gorge within ~1.3 m of its axis, the sills and stakes sit on the lips */
  const clearOfBridge = (p: Vector3) => Math.abs(bridgeLocal(p.x, p.z).c) > 2.1;
  let wallRoots = 0;
  let wallVines = 0;
  for (let k = 0; k < 18; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    const s = sMid + (wallRng() * 2 - 1) * 16;
    const strands = 2 + Math.floor(wallRng() * 3);
    for (let j = 0; j < strands; j++) {
      const ds = (wallRng() - 0.5) * 1.1;
      const drop = 0.9 + wallRng() * 2.4;
      const r0 = 0.02 + wallRng() * 0.032;
      const ph = wallRng() * 10;
      const path = wallPath(s + ds, side, drop, r0 + 0.012, (f) => 0.22 * wallNoise.noise(ph + f * 2.2, 3.1) * f);
      if (path.pts.length < 4 || !clearOfBridge(path.pts[0])) continue;
      // out from under the turf: the root's butt buried a hand back from the lip
      const head = path.pts[0];
      const pts = [head.clone().addScaledVector(path.out, 0.4).setY(head.y - 0.16), ...path.pts];
      // the tip lets go of the face and hangs
      const last = path.pts[path.pts.length - 1];
      const n = path.nrm[path.nrm.length - 1];
      const hang = 0.18 + wallRng() * 0.42;
      pts.push(last.clone().addScaledVector(n, 0.05).add(new Vector3(0, -hang * 0.55, 0)));
      pts.push(last.clone().addScaledVector(n, 0.07).add(new Vector3(0, -hang, 0)));
      const tone = 0.9 + wallRng() * 0.2;
      rootParts.push(
        sweepTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), {
          radius: (t) => r0 * (1 - 0.72 * t) + 0.003,
          tubularSegments: Math.min(56, pts.length * 3),
          radialSegments: 6,
          uvMetres: 0.35,
          capEnd: true,
          displace: (t, ang) => 0.18 * r0 * wallNoise.noise(ang * 1.3 + ph, t * 9),
          color: (t) => [(0.4 + 0.1 * t) * tone, (0.34 + 0.08 * t) * tone, (0.27 + 0.06 * t) * tone],
        }),
      );
      wallRoots++;
      // a rootlet or two off the main root
      if (wallRng() < 0.6 && pts.length > 5) {
        const i0 = 2 + Math.floor(wallRng() * (pts.length - 4));
        const a = pts[i0];
        const b = a.clone().addScaledVector(path.out, -0.02).add(new Vector3(0, -(0.25 + wallRng() * 0.35), 0));
        const m = a.clone().lerp(b, 0.5).addScaledVector(path.nrm[Math.min(path.nrm.length - 1, i0 - 1)], 0.04);
        rootParts.push(sweepTube(new CatmullRomCurve3([a, m, b]), { radius: (t) => r0 * 0.4 * (1 - 0.7 * t) + 0.002, tubularSegments: 6, radialSegments: 5, uvMetres: 0.35, capEnd: true, color: () => [0.44 * tone, 0.37 * tone, 0.29 * tone] }));
      }
    }
    // an ivy curtain beside the roots: vines down the face from under the lip turf
    const vines = 2 + Math.floor(wallRng() * 4);
    for (let j = 0; j < vines; j++) {
      const ds = 0.6 + (wallRng() - 0.5) * 1.6 + j * 0.28;
      const drop = 1.2 + wallRng() * 3.2;
      const ph = wallRng() * 10;
      const path = wallPath(s + ds, side, drop, 0.02, (f) => 0.12 * wallNoise.noise(ph + f * 3.1, 7.7) * f, 0.18);
      if (path.pts.length < 4 || !clearOfBridge(path.pts[0])) continue;
      wallFoliage.addSurfaceVine(path.pts, path.nrm, { leafSize: 0.075, leafEvery: 0.06, thickness: 0.008, amount: 0.02 });
      wallVines++;
      // the vine's head in a tuft of lip grass
      if (wallRng() < 0.5) wallFoliage.addTuft(path.pts[0].clone(), path.nrm[0].clone(), 0.14 + wallRng() * 0.12, wallRng() < 0.3 ? 1 : 0, 0.05, [0.95, 1.0, 0.85]);
    }
    const L = lineAt(s);
    const lx = L.x - L.tz * side * (L.W + RV.lip * 0.5);
    const lz = L.z + L.tx * side * (L.W + RV.lip * 0.5);
    const ly = terrain.height(L.x - L.tz * side * (L.W + RV.lip + 1), L.z + L.tx * side * (L.W + RV.lip + 1));
    casters.push({ x: lx, z: lz, r: 2.2, y0: ly - 4.2, y1: ly + 0.4, shadow: true });
  }

  // the log's casters: its mass every 1.5 m along the axis, from under the floor to over the crown
  for (let a = 0; a <= T.length + 0.01; a += 1.5) {
    const [x, z] = tunnelWorld(a, 0);
    casters.push({ x, z, r: T.outerRadius + 0.5, y0: FLOOR_Y - 0.4, y1: AXIS_Y + T.outerRadius + 0.5, shadow: true });
  }
  for (const p of pods) casters.push({ x: p.x, z: p.z, r: 0.4, y0: p.y - 0.4, y1: p.y + 0.6, shadow: true });

  // ================= meshes =================
  const meshes: Mesh[] = [];
  const add = (geo: BufferGeometry, mat: Material, name: string, cast = true, receive = true) => {
    const m = new Mesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
    meshes.push(m);
    return m;
  };
  const planksGeo = merge(plankParts);
  add(planksGeo, mats.fenceWood, 'south-bridge-planks');
  const ropeGeo = merge(ropeParts);
  add(ropeGeo, rope, 'fence-south-bridge-rope');
  const postGeo = merge(postParts);
  add(postGeo, mats.bark, 'fence-south-bridge');
  // the sills and the log's shell share the log bark (one draw); the hollow's own glow attribute is dropped by the merge for the sills — keep them apart
  for (const g of logParts) if (g.attributes.aGlow) g.deleteAttribute('aGlow');
  const barkGeo = merge(logParts);
  add(barkGeo, mats.logBark, 'log-bark');
  const endsGeo = merge(endParts);
  add(endsGeo, mats.endGrain, 'log-ends');
  if (hangers.length) add(merge(hangers), mats.woodDark, 'lantern-hanger');
  const barkMaps = mats.logInterior;
  const hollowMat = glowMaterial({ map: barkMaps.map, normalMap: barkMaps.normalMap, normalScale: new Vector2(1.4, 1.4), roughness: 1, color: new Color(0x8c6a4e), vertexColors: true, shadowSide: DoubleSide }, HOLLOW_FLOOR, SOUTH_GLOW_GAIN, 'hollow');
  owned.push(hollowMat);
  add(hollow, hollowMat, 'log-tunnel', false, true);
  const [litterC, litterN] = await Promise.all([ctx.textures.load('brown_mud_leaves_01', 'color'), ctx.textures.load('brown_mud_leaves_01', 'normal')]);
  const floorMat = glowMaterial({ map: litterC, normalMap: litterN, normalScale: new Vector2(1.1, 1.1), roughness: 1, color: new Color(0xc9b8a0), vertexColors: true }, LITTER_FLOOR, SOUTH_GLOW_GAIN, 'litter');
  owned.push(floorMat);
  add(floorGeo, floorMat, 'south-log-floor', false, true);
  const bridgeFoliage = foliage.build(mats, 'south-bridge');
  const logFoliageMeshes = logFoliage.build(mats, 'south-log');
  const wallFoliageMeshes = wallFoliage.build(mats, 'south-ravine');
  for (const m of [...bridgeFoliage, ...logFoliageMeshes, ...wallFoliageMeshes]) group.add(m);
  const rootsGeo = rootParts.length ? merge(rootParts) : null;
  if (rootsGeo) add(rootsGeo, mats.bark, 'south-ravine-roots');
  const tufts = buildMossTufts([...tuftSpecs, ...logTufts], new Noise3D(logRng.fork('moss-noise')), { topGain: 1.4, rimGain: 0.5, topTint: [1.0, 1.05, 0.8] });
  if (tufts.count > 0) add(tufts.geometry, mats.capMoss, 'south-foot-moss', false, true);

  // ================= walk spans =================
  const northGround = (() => {
    const p = bw(-0.5, 0, 0);
    return terrain.height(p.x, p.z);
  })();
  const southGround = (() => {
    const p = bw(BF.len + 0.5, 0, 0);
    return terrain.height(p.x, p.z);
  })();
  const deckPts: [number, number, number][] = [];
  const addPt = (a: number, y: number) => {
    const p = bw(a, 0, y);
    deckPts.push([+p.x.toFixed(4), +y.toFixed(4), +p.z.toFixed(4)]);
  };
  addPt(-0.5, northGround + 0.04);
  addPt(-0.28, northGround + 0.06);
  addPt(-0.02, Y_N - 0.006);
  for (let a = 0.5; a < BF.len - 0.25; a += 0.5) addPt(a, deckY(a) - 0.006);
  addPt(BF.len + 0.02, Y_S - 0.006);
  addPt(BF.len + 0.28, southGround + 0.06);
  addPt(BF.len + 0.5, southGround + 0.04);
  const floorPts: [number, number, number][] = [];
  for (const [a, y] of [
    [-0.8, FLOOR_Y + 0.03],
    [-0.3, FLOOR_Y + 0.02],
    [0.1, FLOOR_Y + 0.022],
    [T.deadEnd - 0.2, FLOOR_Y + 0.022],
  ] as const) {
    const p = tw(a, 0, y);
    floorPts.push([+p.x.toFixed(4), +y.toFixed(4), +p.z.toFixed(4)]);
  }
  const walkSpans: WalkSpan[] = [
    { id: 'south-bridge-deck', pts: deckPts, hw: B.walkHalfWidth },
    { id: 'south-log-floor', pts: floorPts, hw: 0.8 },
  ];

  // ================= locality =================
  const sunToward = ctx.sun ? ctx.sun.position.clone().sub(ctx.sun.target.position).normalize() : sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
  const spheres: Sphere[] = casters.flatMap((c) => casterSpheres(c, sunToward));
  const visible = (camera: Camera) => southVisible(camera, spheres);

  let podClearance = Infinity;
  for (const p of pods) podClearance = Math.min(podClearance, p.y - 0.2 - terrain.height(p.x, p.z));
  let minDeck = Infinity;
  for (let a = 0; a <= BF.len; a += 0.05) minDeck = Math.min(minDeck, deckY(a));
  const bridgeTris = tri(planksGeo) + tri(ropeGeo) + tri(postGeo);
  const logTris = tri(barkGeo) + tri(endsGeo) + tri(hollow) + tri(floorGeo) + tri(disc);
  const foliageTris = [...bridgeFoliage, ...logFoliageMeshes].reduce((n, m) => n + tri(m.geometry), 0) + tufts.triangles;
  const wallTris = wallFoliageMeshes.reduce((n, m) => n + tri(m.geometry), 0) + (rootsGeo ? tri(rootsGeo) : 0);
  const mouth = tw(0, 0, FLOOR_Y);
  return {
    group,
    lanterns,
    walkSpans,
    bases,
    owned,
    visible,
    audit: {
      planks: plankSpecs.length,
      missingPlanks: missing,
      brokenPlanks: broken,
      deck: { yN: +Y_N.toFixed(3), yS: +Y_S.toFixed(3), minY: +minDeck.toFixed(3), length: +BF.len.toFixed(3) },
      posts: postTops.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]),
      pods: pods.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]),
      podClearance: +podClearance.toFixed(3),
      triangles: { bridge: bridgeTris, log: logTris, foliage: foliageTris, walls: wallTris },
      walls: { roots: wallRoots, vines: wallVines },
      log: { mouth: [+mouth.x.toFixed(2), +mouth.y.toFixed(3), +mouth.z.toFixed(2)], floorY: +FLOOR_Y.toFixed(3), axisY: +AXIS_Y.toFixed(3), glowA: DISC_A, walkEnd: T.deadEnd - 0.2, endRoots },
      pointLights: 0,
    },
  };
}

const TF_AX = (() => {
  const [dx, dz] = EXPANSION_SOUTH.tunnel.dir;
  return dx / Math.hypot(dx, dz);
})();
const TF_AZ = (() => {
  const [dx, dz] = EXPANSION_SOUTH.tunnel.dir;
  return dz / Math.hypot(dx, dz);
})();
/** a world point's distance along the log's axis from the mouth */
function tunnelLocalA(p: Vector3): number {
  return (p.x - T.mouth[0]) * TF_AX + (p.z - T.mouth[1]) * TF_AZ;
}
