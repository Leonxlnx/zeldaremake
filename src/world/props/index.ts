/**
 * Village props — Kokiri pots, crates, a barrel, buckets, a rope ladder and platforms. Leaf
 * module: no imports from other rendering systems; the terrain is sampled through
 * `ctx.terrain`, textures come through `ctx.textures`, randomness through the seeded PRNG.
 *
 * Every prop is seated on the sampled heightfield (its underside conformed to the ground, its
 * upright limited to a few degrees off the terrain normal — a pot is set level, not tipped down
 * a bank), weathered at the base, and merged per locality (`localityOf(cluster)`) and material
 * into one mesh each; each locality is distance-culled as one.
 */
import { Box3, type BufferAttribute, BufferGeometry, type Camera, Color, DataTexture, Float32BufferAttribute, Group, LinearFilter, Mesh, MeshBasicMaterial, Quaternion, RGBAFormat, Sphere, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldContext, WorldSystem } from '../system';
import { expansionCull, getTerrain, type TerrainMask } from '../terrain/heightfield';
import { type Caster, casterSpheres, expansionVisible, sunVector } from '../util/expansionLocality';
import { createRng } from '../util/prng';
import { barrelGeometry, bucketGeometry, crateGeometry, ladderGeometry, lightStringGeometry, markerGeometry, type Part, platformGeometry, potGeometry } from './geometry';
import { localityOf, PROP_LAYOUT, type PropDef } from './layout';
import { createPropMaterials, type MaterialKey, PLANK_MEAN } from './materials';

const UP = new Vector3(0, 1, 0);
const MATERIAL_KEYS: MaterialKey[] = ['wood', 'clay', 'iron', 'rope', 'glow'];
/** a small prop follows the terrain normal only this far (rad); beyond it, it is set level into the slope */
const MAX_TILT = (9 * Math.PI) / 180;
/** vertices below this local height are pulled onto the sampled ground (m) */
const CONTACT_BAND = 0.08;
export const EMBED = 0.008;

/**
 * Round 56 (the owner's rubric, #23 "contact shadow / AO where it meets the ground"): a soft dark
 * decal under every ground-seated prop — pots, crates, barrels, buckets, the markers' posts. One
 * unlit transparent mesh per locality (the village's is a single draw); it neither casts nor
 * receives shadow, sits `AO_LIFT` above the sampled ground with a polygon offset, and fades from
 * `AO_STRENGTH` at the foot's centre to nothing at `AO_REACH` × the footprint radius.
 */
export const AO_REACH = 1.45;
export const AO_LIFT = 0.012;
export const AO_STRENGTH = 0.62;
const AO_SEGMENTS = 18;

/** the decal's radial alpha: 64 × 64 — full under the foot, fading over the outer 40 %, gone at the rim */
function aoAlphaMap(): DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5;
      const v = (y + 0.5) / size - 0.5;
      const r = Math.min(1, Math.hypot(u, v) * 2);
      // full under the foot (r < 0.6), fading over the outer 40 % — the ring past the footprint's
      // edge (r ≈ 1 / AO_REACH) is what the eye sees; a plain (1 − r)^k spent itself under the prop
      const a = Math.round(255 * Math.pow(Math.min(1, (1 - r) / 0.4), 1.2));
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = a;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** a ground-hugging fan of `AO_SEGMENTS` triangles about (x, z), each vertex on the sampled ground */
function aoDecal(x: number, z: number, radius: number, height: (x: number, z: number) => number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const cy = height(x, z) + AO_LIFT;
  for (let i = 0; i < AO_SEGMENTS; i++) {
    const a0 = (i / AO_SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / AO_SEGMENTS) * Math.PI * 2;
    const x0 = x + Math.cos(a0) * radius;
    const z0 = z + Math.sin(a0) * radius;
    const x1 = x + Math.cos(a1) * radius;
    const z1 = z + Math.sin(a1) * radius;
    pos.push(x, cy, z, x1, height(x1, z1) + AO_LIFT, z1, x0, height(x0, z0) + AO_LIFT, z0);
    uv.push(0.5, 0.5, 0.5 + 0.5 * Math.cos(a1), 0.5 + 0.5 * Math.sin(a1), 0.5 + 0.5 * Math.cos(a0), 0.5 + 0.5 * Math.sin(a0));
    nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  // the same attribute set as every prop mesh (the merge and the tests expect a colour)
  g.setAttribute('color', new Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  return g;
}
/**
 * A cluster draws only while the camera is within this distance of its bounding sphere (m). A
 * 0.6 m pot is a dozen pixels lost in the haze at 45 m and a handful at 30; the north clearing's
 * dressing (60–75 m from every fixed camera, occluded by the log's root mass) would otherwise
 * ride into the shadow and colour passes of frames it cannot appear in. 45 → 30 in round 56
 * (the owner's "check everything", the south far-bank look-back at 818 draws): the village
 * sphere's near edge is 33 m from that camera and ≤ 25 m from every fixed view and owner pose,
 * so the change costs those nothing and drops the village's 11 draws from the look-back, and the
 * south exit's 9 from camera C (35 m, hidden behind the plaza-south trunk there anyway).
 */
export const CLUSTER_VISIBLE_M = 30;

export interface PlacementOptions {
  paving?: boolean;
  pad?: boolean;
}

type PlacementCtx = Pick<WorldContext, 'terrain' | 'layout'> & { shared?: Pick<NonNullable<WorldContext['shared']>, 'slimTrunks'> };

/**
 * Footprint probes (centre + 8 around at `radius`) keep the whole prop out of paths, stairs,
 * structures and cliff faces, and off the layout's obstacles: giant trunks, hero boulders, the
 * npc spots (≥ 0.8 m), lantern posts and signposts. `paving` admits the flagstone mask (pots
 * beside a stair foot); `pad` admits a house pad while the trunk keeps `1.05 R + radius`.
 */
export function placementAllowed(ctx: PlacementCtx, x: number, z: number, radius: number, opts: PlacementOptions = {}): boolean {
  const L = ctx.layout;
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI) / 4;
    const r = i === 8 ? 0 : radius;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    const m = ctx.terrain.mask(px, pz);
    if (!opts.paving && m.path > 0.18) return false;
    if (m.stairs > 0.01 || m.cliff > 0.1) return false;
    if (!opts.pad && m.structure > 0.12) return false;
    if (L.giantTrees.some((t) => Math.hypot(px - t.position[0], pz - t.position[2]) < t.trunkRadius + 0.45)) return false;
    for (const h of L.houses) {
      const dx = px - h.position[0];
      const dz = pz - h.position[2];
      const d = Math.hypot(dx, dz);
      // the porch is a recess cut into the front of the trunk (back wall at 0.75 R, ±40° around
      // the door): a pot may stand on its floor beside the doorway, clear of the back wall
      const fx = h.facing[0];
      const fz = h.facing[1];
      const fl = Math.hypot(fx, fz) || 1;
      const cosA = (dx * fx + dz * fz) / (fl * (d || 1));
      const inPorchSector = cosA > Math.cos(0.7);
      if (d < h.trunkRadius * (inPorchSector ? 0.82 : 1.05)) return false;
    }
  }
  if (L.heroBoulders.some((b) => Math.hypot(x - b.position[0], z - b.position[2]) < b.radius + radius + 0.05)) return false;
  if (L.npcSpots.some((s) => Math.hypot(x - s.position[0], z - s.position[2]) < 0.8 + radius)) return false;
  if (L.signposts.some((s) => Math.hypot(x - s.position[0], z - s.position[2]) < 0.45 + radius)) return false;
  // Round 53 (fable-4's understory, 2026-09-23): the trees build before props and scatter 44 small
  // trees by seed along the verges and the lawn edges without knowing the props, and publish every
  // white-bark and understory bole as `ctx.shared.slimTrunks` (the camera's list). A prop's footprint
  // keeps a hand off every bole, so no pot or crate ever stands in a trunk however the trees re-roll.
  const trunks = ctx.shared?.slimTrunks;
  if (trunks && trunks.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + radius + 0.05)) return false;
  return true;
}

/** the horizontal radius a prop's footprint probes with */
export function footprintRadius(def: PropDef): number {
  switch (def.kind) {
    case 'pot':
      return def.size * (def.variant === 2 ? 0.52 : 0.47);
    case 'crate':
      return def.size * 0.72;
    case 'barrel':
      return def.size * 0.4;
    case 'bucket':
      return def.size * 0.36;
    case 'marker':
      return 0.3;
    case 'platform':
      return Math.hypot(def.platform?.width ?? 1.8, def.platform?.depth ?? 1.4) / 2 + 0.1;
    default:
      return 0.3;
  }
}

/** nudge search around the authored point: the point itself, a 0.55 m ring, a 1.05 m ring */
function findSpot(ctx: PlacementCtx, def: PropDef, radius: number, taken: number[][]): [number, number] | null {
  for (let attempt = 0; attempt < 17; attempt++) {
    const a = ((attempt - 1) * Math.PI) / 4;
    const r = attempt === 0 ? 0 : attempt < 9 ? 0.55 : 1.05;
    const x = def.x + Math.cos(a) * r;
    const z = def.z + Math.sin(a) * r;
    if (!placementAllowed(ctx, x, z, radius, def)) continue;
    if (taken.some(([tx, , tz, tr]) => Math.hypot(tx - x, tz - z) < tr + radius)) continue;
    return [x, z];
  }
  return null;
}

/**
 * The vertex colour of each material lives in its own domain — wood rides a ×4 lift over a dark
 * map, rope over a tinted material — so a grime / moss target (linear albedo) is divided by what
 * the map and the material colour will multiply back in.
 */
const COLOUR_DOMAIN: Record<MaterialKey, [number, number, number]> = {
  wood: PLANK_MEAN,
  clay: [0.93, 0.92, 0.9],
  rope: [0.28 * 0.9, 0.2 * 0.9, 0.085 * 0.9],
  iron: [1, 1, 1],
  glow: [1, 1, 1],
};

/**
 * Round 52 (fable-cursor's OOM ask, 2026-09-22 07:15 — the tab at 3.6 GB; trees/index.ts does the same):
 * once the renderer has uploaded a merged locality mesh nothing reads its typed arrays again — the
 * cull reads the locality spheres taken at build, the audits and the census read counts, the
 * character's surface grid reads the hardscape's stairs, `contactIndices` are consumed before the
 * merge — so every attribute and the index drop their CPU copy on upload (≈ 7.9 MB across the 13
 * meshes). Bounds are computed before the arrays go. In Node (the tests) nothing uploads, so the
 * arrays stay and the geometry assertions still see them.
 */
const dropArray = function (this: { array: ArrayLike<number> | null }) {
  this.array = null;
};
function releaseAfterUpload(g: BufferGeometry): void {
  for (const a of Object.values(g.attributes)) (a as BufferAttribute).onUpload(dropArray as unknown as () => void);
  if (g.index) g.index.onUpload(dropArray as unknown as () => void);
}

/**
 * Grime and moss where a prop meets the ground; continuous in space so shared edges stay seamless.
 * Round 56 (the owner's rubric, ★16 "weathering follows exposure"): `sunLocal` is the direction
 * toward the sun in the prop's own frame — the moss band climbs on the side facing away from it
 * (3× the height in full shade, the round-52 band on the sun side) and the tops (normals within
 * ≈ 35° of up) take a sun-bleach: dry wood goes a little grey-silver, clay a dusty lighter tone.
 */
function weather(geometry: BufferGeometry, material: MaterialKey, size: number, sunLocal: { x: number; z: number }): void {
  if (material === 'iron' || material === 'glow') return;
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  const colors = geometry.attributes.color;
  const [dr, dg, db] = COLOUR_DOMAIN[material];
  const soil = new Color(0x4f4436);
  const moss = new Color(0x55573a);
  const bleach = new Color(material === 'clay' ? 0xd9c9a8 : 0xb8b0a0);
  soil.setRGB(soil.r / dr, soil.g / dg, soil.b / db);
  moss.setRGB(moss.r / dr, moss.g / dg, moss.b / db);
  bleach.setRGB(bleach.r / dr, bleach.g / dg, bleach.b / db);
  const c = new Color();
  const falloff = (h: number, extent: number) => {
    const t = Math.min(1, Math.max(0, h / extent));
    return 1 - t * t * (3 - 2 * t);
  };
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i);
    const py = p.getY(i);
    const pz = p.getZ(i);
    const nx = n ? n.getX(i) : 0;
    const ny = n ? n.getY(i) : 0;
    const nz = n ? n.getZ(i) : 0;
    // how much this face looks away from the sun (its horizontal normal against the sun's direction; the
    // radial direction from the prop's axis stands in where a normal is missing)
    const rad = Math.hypot(px, pz) || 1;
    const facing = n ? nx * sunLocal.x + nz * sunLocal.z : (px * sunLocal.x + pz * sunLocal.z) / rad;
    const shade = smooth(0.2, -0.6, facing);
    const up = n ? smooth(0.55, 0.85, ny) : 0;
    const patch = 0.5 + 0.5 * Math.sin(px * 9 + pz * 13) * Math.cos(pz * 7 - px * 5);
    const damp = falloff(py, size * 0.3);
    const contact = falloff(py, size * (0.07 + patch * 0.06) * (1 + 2 * shade));
    c.fromBufferAttribute(colors, i);
    if (material === 'clay') c.lerp(soil, damp * 0.38);
    else c.multiplyScalar(1 - damp * 0.3);
    c.lerp(moss, contact * (0.1 + patch * 0.18) + shade * 0.09 * (1 - damp));
    c.lerp(bleach, up * (material === 'clay' ? 0.12 : 0.18) * (1 - damp));
    colors.setXYZ(i, c.r, c.g, c.b);
  }
}

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const root = new Group();
  root.name = 'props';
  const materials = await createPropMaterials(ctx);
  const terrain = ctx.terrain;
  /**
   * Round 56: the live view for `live` props (the south exit's verges) — its height / normal for the
   * seating, and a mask that is the LIVE mask over the system's own (max per channel): the live one
   * knows the south paving and the bridge / log, the system's whatever ground it was told is closed
   */
  const liveTerrain = getTerrain();
  const liveCtx: PlacementCtx = {
    terrain: {
      ...liveTerrain,
      mask: (x: number, z: number): TerrainMask => {
        const a = terrain.mask(x, z);
        const b = liveTerrain.mask(x, z);
        return { path: Math.max(a.path, b.path), stairs: Math.max(a.stairs, b.stairs), cliff: Math.max(a.cliff, b.cliff), structure: Math.max(a.structure, b.structure), plateau: Math.max(a.plateau, b.plateau) };
      },
    },
    layout: ctx.layout,
    shared: ctx.shared,
  };
  const ownedGeometry: BufferGeometry[] = [];
  const bases: number[][] = [];
  const counts = { pots: 0, crates: 0, barrels: 0, buckets: 0, platforms: 0, ladders: 0, markers: 0, lightStrings: 0, lightPods: 0, ropeRailings: 0 };
  const skipped: string[] = [];
  /** authored props whose spot lies inside round 49's live-only expansion ground (`expansionCull`) */
  const culledByExpansion: string[] = [];
  const placed: { id: string; kind: string; cluster: string; x: number; y: number; z: number; tiltDeg: number }[] = [];
  /** world-space geometry per merge locality and material, merged at the end */
  const localities = new Map<string, Record<MaterialKey, BufferGeometry[]>>();
  const batchesFor = (locality: string) => {
    let b = localities.get(locality);
    if (!b) {
      b = { wood: [], clay: [], iron: [], rope: [], glow: [] };
      localities.set(locality, b);
    }
    return b;
  };
  /** the backside props as vertical casters (expansionLocality's frustum + shadow-footprint rule) */
  const backsideCasters: Caster[] = [];
  /** world-space extent of each cluster per material (audit + tests; the meshes merge past cluster level) */
  const clusterBounds = new Map<string, Partial<Record<MaterialKey, Box3>>>();
  const clusterNames = new Set<string>();
  /** props that reserve ground (x, y, z, radius) so later ones keep clear */
  const taken: number[][] = [];
  /**
   * every placed prop's ground footprint — published as `ctx.shared.propFootprints` (agreed in the
   * inbox 2026-09-19 09:10 UTC) for the vegetation scatter, which builds after props and keeps
   * its ferns out of these discs; `r` is the prop's own footprint, the plant adds its reach
   */
  const footprints: { x: number; z: number; r: number }[] = [];
  /**
   * Round 52: the solid props a walker should not pass through — published as
   * `ctx.shared.propBlockers` for the character's ground (`blocked()`), which knew structure pads
   * and the hut's wall ring but let Link walk through the pots at Saria's door. `r` is the piece's
   * own radius at the ground (`footprintRadius`, which is the body's extent, not the vegetation
   * margin); `top` its world height. Light strings (a cord on 3 cm pegs) are not in it; the
   * lookout's rope railing is, as discs every 0.25 m along its three courses.
   */
  const blockers: { x: number; z: number; r: number; top: number }[] = [];
  const aoBatches = new Map<string, BufferGeometry[]>();
  const aoMaterial = new MeshBasicMaterial({ color: 0x14100a, alphaMap: aoAlphaMap(), transparent: true, opacity: AO_STRENGTH, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  aoMaterial.name = 'prop-contact-ao';
  const tmp = new Vector3();
  /** toward the sun (world), for the exposure weathering and the backside's shadow footprints */
  const sunToward = ctx.sun ? ctx.sun.position.clone().sub(ctx.sun.target.position).normalize() : sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);

  for (const def of PROP_LAYOUT) {
    const rng = createRng(`${ctx.config.seed}/props/${def.id}`);
    /** the heightfield view this prop stands on: the legacy one, or the live one for the south exit's props */
    const T = def.live ? liveTerrain : terrain;
    let x = def.x;
    let z = def.z;
    let yaw = def.yaw;
    let parts: Part[];
    let groundY: number;
    let orientation: Quaternion;
    let contactBand = CONTACT_BAND;
    let tiltUsed = 0;
    /** ground footprint radius published for the vegetation scatter (m) */
    let footR = footprintRadius(def);
    /** the piece's height over its ground (m) for `propBlockers`; 0 = publishes no blocker of its own */
    let solidTop = 0;

    if (def.kind === 'ladder') {
      const house = ctx.layout.houses.find((h) => h.id === def.lean?.house);
      if (!house || !def.lean) {
        skipped.push(def.id);
        continue;
      }
      // frame of the house: F out of the door, Rt the viewer's right when facing the door
      const F = new Vector3(house.facing[0], 0, house.facing[1]).normalize();
      const Rt = new Vector3(F.z, 0, -F.x);
      const dir = F.clone().multiplyScalar(Math.cos(def.lean.angle)).addScaledVector(Rt, Math.sin(def.lean.angle));
      const lean = 0.95;
      const R = house.trunkRadius;
      // feet on the ground `lean` out from the bark; the crossbar rests on the trunk `top` up
      const foot = new Vector3(house.position[0], 0, house.position[2]).addScaledVector(dir, R + lean);
      x = foot.x;
      z = foot.z;
      const tangent = new Vector3(-dir.z, 0, dir.x);
      const hw = def.size / 2;
      const footY = [-1, 1].map((s) => terrain.height(x + tangent.x * s * hw, z + tangent.z * s * hw)) as [number, number];
      groundY = Math.min(footY[0], footY[1]);
      const contactY = terrain.height(house.position[0] + dir.x * R * 1.2, house.position[2] + dir.z * R * 1.2);
      const top = Math.max(2.2, contactY - groundY + def.lean.top);
      parts = ladderGeometry(rng, { width: def.size, height: top, lean, footY: [footY[0] - groundY, footY[1] - groundY], pegDepth: 0.35 });
      solidTop = top;
      // local +z points at the trunk
      yaw = Math.atan2(dir.x, dir.z);
      orientation = new Quaternion();
      contactBand = 0;
      counts.ladders++;
      footR = def.size / 2 + 0.2;
    } else if (def.kind === 'lightString') {
      // an authored line along a bank: every peg seated on the sampled ground, the string placed
      // as drawn (no footprint probe — it hugs paving edges and banks the probe would refuse)
      const line = def.string;
      if (!line || line.points.length < 2) {
        skipped.push(def.id);
        continue;
      }
      x = line.points[0][0];
      z = line.points[0][1];
      groundY = terrain.height(x, z);
      const pegs = line.points.map(([px, pz]) => new Vector3(px - x, terrain.height(px, pz) - groundY, pz - z));
      parts = lightStringGeometry(rng, { pegs, lift: line.lift, sag: line.sag, spacing: line.spacing, podRadius: 0.024 });
      yaw = 0;
      orientation = new Quaternion();
      contactBand = 0;
      counts.lightStrings++;
      counts.lightPods += parts.filter((p) => p.material === 'glow').length;
      footR = 0.12;
      // every peg reserves a little ground for the vegetation scatter (the first one through footR)
      for (let i = 1; i < line.points.length; i++) footprints.push({ x: line.points[i][0], z: line.points[i][1], r: 0.12 });
    } else if (def.onDeck) {
      // on a published walk deck (structures' walkway): the prop stands level on the deck's top
      // line, `along` from the platform end, inset from the edge — no ground probe, no conform
      const surface = ctx.shared.walkSurfaces?.[def.onDeck.surface];
      if (!surface) {
        skipped.push(def.id);
        continue;
      }
      const a = new Vector3().fromArray(surface.deck.a);
      const b = new Vector3().fromArray(surface.deck.b);
      const run = new Vector3(b.x - a.x, 0, b.z - a.z);
      const length = run.length();
      const dir = run.clone().normalize();
      const side = new Vector3(-dir.z, 0, dir.x);
      const t = Math.min(1, Math.max(0, def.onDeck.along / Math.max(length, 1e-6)));
      // inset so the piece's rim sits a hand (1 cm) inside the deck's edge, whatever its size
      const p = a.clone().lerp(b, t).addScaledVector(side, def.onDeck.side * Math.max(0, surface.deck.hw - (footprintRadius(def) + 0.01)));
      x = p.x;
      z = p.z;
      groundY = p.y;
      orientation = new Quaternion();
      contactBand = 0;
      const size = def.size * rng.range(0.96, 1.04);
      if (def.kind === 'pot') {
        parts = potGeometry(rng, size, def.variant ?? 0);
        counts.pots++;
      } else if (def.kind === 'crate') {
        parts = crateGeometry(rng, size);
        counts.crates++;
      } else if (def.kind === 'barrel') {
        parts = barrelGeometry(rng, size);
        counts.barrels++;
      } else {
        parts = bucketGeometry(rng, size);
        counts.buckets++;
      }
      taken.push([x, groundY, z, footR]);
    } else if (def.kind === 'platform' && def.platform?.dais) {
      // the lookout railing: bound to LAYOUT.plateauLookout, whose author verified the
      // clearances — no footprint probe, no nudge. The stone dais (hardscape) is the deck: its top
      // is the highest turf under its outline plus its proud height (hardscape's rule, sampled
      // here on the same rectangle), and the railing posts stand on it.
      const hook = ctx.layout.plateauLookout;
      const slab = ctx.layout.lookout;
      x = hook.x;
      z = hook.z;
      yaw = hook.yaw;
      const width = hook.width;
      const depth = slab.halfDepth * 2;
      const q = new Quaternion().setFromAxisAngle(UP, yaw);
      const worldAt = (lx: number, lz: number) => tmp.set(lx, 0, lz).applyQuaternion(q).add(new Vector3(x, 0, z));
      let turfMax = -Infinity;
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const t = -1 + (2 * i) / N;
        for (const [lx, lz] of [[t * (width / 2), -depth / 2], [t * (width / 2), depth / 2], [-width / 2, t * (depth / 2)], [width / 2, t * (depth / 2)]]) {
          const w = worldAt(lx, lz);
          turfMax = Math.max(turfMax, terrain.height(w.x, w.z));
        }
      }
      groundY = terrain.height(x, z);
      const deck = turfMax + slab.height - groundY;
      const groundAt = (lx: number, lz: number) => {
        const w = worldAt(lx, lz);
        return terrain.height(w.x, w.z) - groundY;
      };
      parts = platformGeometry(rng, { ...def.platform, width, depth, deck, slab: true, groundAt });
      orientation = new Quaternion();
      contactBand = 0;
      counts.platforms++;
      if (def.platform.rail) counts.ropeRailings += 3;
      footR = Math.hypot(width, depth) / 2 + 0.1;
      taken.push([x, groundY, z, footR]);
      if (def.platform.rail) {
        // the railing's three rope courses in the deck's frame (geometry.ts platformGeometry: the
        // −z lip and the two short sides, inset 0.2 / 0.18 from the slab's edge, open at +z)
        const hx = width / 2 - 0.2;
        const hz = depth / 2 - 0.18;
        const railTop = groundY + deck + 0.9;
        const course = (x0: number, z0: number, x1: number, z1: number) => {
          const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25));
          for (let i = 0; i <= n; i++) {
            const w = worldAt(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
            blockers.push({ x: +w.x.toFixed(3), z: +w.z.toFixed(3), r: 0.12, top: +railTop.toFixed(3) });
          }
        };
        course(-hx, -hz, hx, -hz);
        course(-hx, -hz, -hx, hz);
        course(hx, -hz, hx, hz);
      }
    } else {
      const radius = footprintRadius(def);
      const spot = findSpot(def.live ? liveCtx : ctx, def, radius, taken);
      if (!spot) {
        skipped.push(def.id);
        continue;
      }
      [x, z] = spot;
      // round 49: props build on the LEGACY heightfield view; a spot that the expansion's live-only
      // ground has since raised, paved or built on (the south bank, the far hut's knoll, the west
      // discs and flights) is dropped here — a filter after placement, so no stream re-rolls.
      // Round 56: a `live` prop was placed against the live masks (the route's paving and the
      // bridge / log are structure there) and takes its height from the live ground, so it is exempt
      if (!def.live && expansionCull(x, z)) {
        skipped.push(def.id);
        culledByExpansion.push(def.id);
        continue;
      }
      groundY = T.height(x, z);
      if (def.kind === 'platform') {
        const spec = def.platform ?? { deck: 1.2, width: 1.8, depth: 1.4, rail: true, ladder: true };
        const q = new Quaternion().setFromAxisAngle(UP, yaw);
        const groundAt = (lx: number, lz: number) => {
          tmp.set(lx, 0, lz).applyQuaternion(q);
          return T.height(x + tmp.x, z + tmp.z) - groundY;
        };
        parts = platformGeometry(rng, { ...spec, groundAt });
        orientation = new Quaternion();
        contactBand = 0;
        counts.platforms++;
        if (spec.ladder) counts.ladders++;
        if (spec.rail) counts.ropeRailings += 3;
      } else if (def.kind === 'marker') {
        // a post stands vertical whatever the bank; its foot (the lowest 10 cm) is conformed below
        orientation = new Quaternion();
        contactBand = 0.1;
        parts = markerGeometry(rng, def.size * rng.range(0.97, 1.03));
        counts.markers++;
      } else {
        // small prop: follow the terrain normal, but only so far — beyond MAX_TILT the prop is
        // set level into the slope and the underside conform below closes the gap
        const n = T.normal(x, z, new Vector3());
        const tilt = Math.acos(Math.min(1, n.y));
        tiltUsed = Math.min(tilt, MAX_TILT);
        if (tilt > MAX_TILT) {
          const axis = new Vector3().crossVectors(UP, n).normalize();
          orientation = new Quaternion().setFromAxisAngle(axis, MAX_TILT);
        } else orientation = new Quaternion().setFromUnitVectors(UP, n);
        const size = def.size * rng.range(0.96, 1.04);
        if (def.kind === 'pot') {
          parts = potGeometry(rng, size, def.variant ?? 0);
          counts.pots++;
        } else if (def.kind === 'crate') {
          parts = crateGeometry(rng, size);
          counts.crates++;
        } else if (def.kind === 'barrel') {
          parts = barrelGeometry(rng, size);
          counts.barrels++;
        } else {
          parts = bucketGeometry(rng, size);
          counts.buckets++;
        }
      }
      taken.push([x, groundY, z, radius]);
    }

    // prop frame → world
    const world = new Quaternion().setFromAxisAngle(UP, yaw).premultiply(orientation);
    const position = new Vector3(x, groundY, z);
    // (a prop on a published walk deck meets a built surface, not the ground — no terrain base for it)
    if (!def.onDeck) bases.push([x, T.height(x, z), z]);
    placed.push({ id: def.id, kind: def.kind, cluster: def.cluster, x: +x.toFixed(3), y: +groundY.toFixed(3), z: +z.toFixed(3), tiltDeg: +((tiltUsed * 180) / Math.PI).toFixed(2) });
    footprints.push({ x: +x.toFixed(3), z: +z.toFixed(3), r: +footR.toFixed(3) });
    if (def.kind === 'pot' || def.kind === 'barrel' || def.kind === 'marker') solidTop = def.size;
    else if (def.kind === 'crate') solidTop = def.size * 0.9;
    else if (def.kind === 'bucket') solidTop = def.size * 0.66;
    if (solidTop > 0) blockers.push({ x: +x.toFixed(3), z: +z.toFixed(3), r: +footprintRadius(def).toFixed(3), top: +(groundY + solidTop).toFixed(3) });
    if (solidTop > 0 && def.kind !== 'ladder') {
      // the contact AO: the pot's belly overhangs its foot, so the decal reaches a little past the
      // footprint; a marker's is its post's, not its boards'; a ladder's two feet get none (a disc
      // between its rails would darken bare ground)
      const aoR = def.kind === 'marker' ? 0.17 * def.size : footR * AO_REACH;
      const list = aoBatches.get(localityOf(def.cluster));
      const decal = aoDecal(x, z, aoR, (px, pz) => T.height(px, pz));
      if (list) list.push(decal);
      else aoBatches.set(localityOf(def.cluster), [decal]);
    }
    if (localityOf(def.cluster) === 'backside') backsideCasters.push({ x, z, r: footR + 0.25, y0: groundY - 0.1, y1: groundY + (def.kind === 'marker' ? def.size + 0.15 : def.size * 1.1), shadow: true });
    clusterNames.add(def.cluster);
    const batches = batchesFor(localityOf(def.cluster));
    let bounds = clusterBounds.get(def.cluster);
    if (!bounds) {
      bounds = {};
      clusterBounds.set(def.cluster, bounds);
    }
    // the sun's horizontal direction in the prop's frame (its yaw undone; the tilt is a few degrees and ignored)
    const sunLocal = { x: sunToward.x * Math.cos(yaw) - sunToward.z * Math.sin(yaw), z: sunToward.x * Math.sin(yaw) + sunToward.z * Math.cos(yaw) };
    for (const part of parts) {
      const g = part.geometry;
      weather(g, part.material, def.kind === 'platform' || def.kind === 'ladder' ? 0.9 : def.size, sunLocal);
      const p = g.attributes.position;
      const contact: number[] = [];
      const feet = new Set<number>((g.userData.contactIndices as number[] | undefined) ?? []);
      const v = new Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const localY = v.y;
        v.applyQuaternion(world).add(position);
        if (contactBand > 0 && localY < contactBand) {
          // conform the underside to the sampled heightfield: a rigid tangent-plane seat leaves
          // gaps on curved ground; above the band the silhouette stays rigid
          const w = Math.min(1, Math.max(0, (contactBand - localY) / (contactBand * 0.75)));
          const seated = T.height(v.x, v.z) - EMBED;
          v.y += (seated - v.y) * w;
          if (w >= 0.99999) contact.push(i);
        } else if (feet.has(i)) {
          // platform posts / ladder rails: the builder's foot vertices, re-seated on the world heightfield
          v.y = T.height(v.x, v.z) - EMBED;
          contact.push(i);
        }
        p.setXYZ(i, v.x, v.y, v.z);
      }
      // normals: rotate rigidly, then recompute the edited contact faces
      const nrm = g.attributes.normal;
      for (let i = 0; i < nrm.count; i++) {
        v.fromBufferAttribute(nrm, i).applyQuaternion(world);
        nrm.setXYZ(i, v.x, v.y, v.z);
      }
      if (contact.length) {
        const a = new Vector3();
        const b = new Vector3();
        const c = new Vector3();
        const faces = new Set(contact.map((i) => Math.floor(i / 3) * 3));
        for (const i of faces) {
          a.fromBufferAttribute(p, i);
          b.fromBufferAttribute(p, i + 1);
          c.fromBufferAttribute(p, i + 2);
          b.sub(a);
          c.sub(a);
          b.cross(c);
          if (b.lengthSq() > 1e-18) {
            b.normalize();
            for (let j = 0; j < 3; j++) nrm.setXYZ(i + j, b.x, b.y, b.z);
          }
        }
      }
      g.userData.contactIndices = contact;
      g.computeBoundingBox();
      if (g.boundingBox) {
        const box = bounds[part.material];
        if (box) box.union(g.boundingBox);
        else bounds[part.material] = g.boundingBox.clone();
      }
      batches[part.material].push(g);
    }
  }

  ctx.shared.propFootprints = footprints;
  ctx.shared.propBlockers = blockers;

  // merge per locality and material: one mesh per material for the whole village, one set for
  // the clearing (the seven village clusters were 16 meshes, up to 32 draws with the shadow pass)
  let meshes = 0;
  const localityBounds: { group: Group; sphere: Sphere }[] = [];
  for (const [locality, batches] of localities) {
    const group = new Group();
    group.name = locality;
    const sphere = new Sphere();
    let first = true;
    for (const key of MATERIAL_KEYS) {
      const list = batches[key];
      if (!list.length) continue;
      const contactIndices: number[] = [];
      let offset = 0;
      for (const g of list) {
        for (const i of g.userData.contactIndices ?? []) contactIndices.push(i + offset);
        offset += g.attributes.position.count;
      }
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) throw new Error(`props: cannot merge ${locality}/${key}`);
      merged.userData.contactIndices = contactIndices;
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      if (merged.boundingSphere) {
        if (first) sphere.copy(merged.boundingSphere);
        else sphere.union(merged.boundingSphere);
        first = false;
      }
      releaseAfterUpload(merged);
      ownedGeometry.push(merged);
      const mesh = new Mesh(merged, materials[key]);
      mesh.name = `${locality}-${key}`;
      mesh.castShadow = ctx.quality.shadows;
      mesh.receiveShadow = true;
      group.add(mesh);
      meshes++;
    }
    const decals = aoBatches.get(locality);
    if (decals && decals.length) {
      const merged = mergeGeometries(decals, false);
      decals.forEach((g) => g.dispose());
      if (!merged) throw new Error(`props: cannot merge ${locality}/ao`);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      if (merged.boundingSphere) {
        if (first) sphere.copy(merged.boundingSphere);
        else sphere.union(merged.boundingSphere);
        first = false;
      }
      releaseAfterUpload(merged);
      ownedGeometry.push(merged);
      const mesh = new Mesh(merged, aoMaterial);
      mesh.name = `${locality}-ao`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
      meshes++;
    }
    root.add(group);
    if (!first) localityBounds.push({ group, sphere });
  }
  // the backside locality follows util/expansionLocality.ts: hidden beyond 60 m of the expansion
  // box, or when neither the props nor their sun-shadow footprints meet the camera's frustum —
  // so the six fixed frames, which look away from it, draw none of it in either pass
  const backsideSpheres = backsideCasters.flatMap((c) => casterSpheres(c, sunToward));
  /** cull per locality: pose jumps come through onCameraMove, the walk through update */
  const cull = (camera: Camera) => {
    for (const b of localityBounds) {
      if (b.group.name === 'backside') b.group.visible = backsideSpheres.length > 0 && expansionVisible(camera, backsideSpheres);
      else b.group.visible = camera.position.distanceTo(b.sphere.center) - b.sphere.radius < CLUSTER_VISIBLE_M;
    }
  };
  const round3 = (v: number) => +v.toFixed(3);
  const boundsAudit: Record<string, Partial<Record<MaterialKey, { min: number[]; max: number[] }>>> = {};
  for (const [cluster, bounds] of clusterBounds) {
    const entry: Partial<Record<MaterialKey, { min: number[]; max: number[] }>> = {};
    for (const key of MATERIAL_KEYS) {
      const box = bounds[key];
      if (box) entry[key] = { min: box.min.toArray().map(round3), max: box.max.toArray().map(round3) };
    }
    boundsAudit[cluster] = entry;
  }

  let triangles = 0;
  for (const g of ownedGeometry) triangles += g.attributes.position.count / 3;
  ctx.audit('props', () => ({
    ...counts,
    geometry: 'original-lathed-pottery-chamfered-boards-coopered-staves-laid-rope',
    textured: { wood: materials.sets, clay: 'procedural-wheel-marks', rope: 'procedural-laid-strands' },
    clusters: clusterNames.size,
    localities: localities.size,
    meshes,
    triangles,
    placed,
    skipped,
    culledByExpansion,
    footprints,
    blockers,
    clusterBounds: boundsAudit,
    culling: { visibleWithinM: CLUSTER_VISIBLE_M, backside: 'expansionLocality (frustum + shadow footprints)', backsideCasters: backsideCasters.length, localities: localityBounds.map((b) => ({ locality: b.group.name, centre: b.sphere.center.toArray().map((v) => +v.toFixed(2)), radius: +b.sphere.radius.toFixed(2) })) },
    samplePositions: { bases },
  }));
  return {
    name: 'props',
    group: root,
    update(_dt, _t, c) {
      cull(c.camera);
    },
    onCameraMove(camera) {
      cull(camera);
    },
    dispose() {
      ownedGeometry.forEach((g) => g.dispose());
      aoMaterial.alphaMap?.dispose();
      aoMaterial.dispose();
      materials.dispose();
      root.clear();
    },
  };
}
