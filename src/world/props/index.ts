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
import { Box3, BufferGeometry, type Camera, Color, Group, Mesh, Quaternion, Sphere, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldContext, WorldSystem } from '../system';
import { expansionCull } from '../terrain/heightfield';
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
 * A cluster draws only while the camera is within this distance of its bounding sphere (m). A
 * 0.6 m pot is a dozen pixels lost in the haze at 45 m; the north clearing's dressing (60–75 m
 * from every fixed camera, occluded by the log's root mass) would otherwise ride into the shadow
 * and colour passes of frames it cannot appear in.
 */
export const CLUSTER_VISIBLE_M = 45;

export interface PlacementOptions {
  paving?: boolean;
  pad?: boolean;
}

type PlacementCtx = Pick<WorldContext, 'terrain' | 'layout'>;

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

/** grime and moss where a prop meets the ground; continuous in space so shared edges stay seamless */
function weather(geometry: BufferGeometry, material: MaterialKey, size: number): void {
  if (material === 'iron' || material === 'glow') return;
  const p = geometry.attributes.position;
  const colors = geometry.attributes.color;
  const [dr, dg, db] = COLOUR_DOMAIN[material];
  const soil = new Color(0x4f4436);
  const moss = new Color(0x55573a);
  soil.setRGB(soil.r / dr, soil.g / dg, soil.b / db);
  moss.setRGB(moss.r / dr, moss.g / dg, moss.b / db);
  const c = new Color();
  const falloff = (h: number, extent: number) => {
    const t = Math.min(1, Math.max(0, h / extent));
    return 1 - t * t * (3 - 2 * t);
  };
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i);
    const py = p.getY(i);
    const pz = p.getZ(i);
    const patch = 0.5 + 0.5 * Math.sin(px * 9 + pz * 13) * Math.cos(pz * 7 - px * 5);
    const damp = falloff(py, size * 0.3);
    const contact = falloff(py, size * (0.07 + patch * 0.06));
    c.fromBufferAttribute(colors, i);
    if (material === 'clay') c.lerp(soil, damp * 0.38);
    else c.multiplyScalar(1 - damp * 0.3);
    c.lerp(moss, contact * (0.1 + patch * 0.18));
    colors.setXYZ(i, c.r, c.g, c.b);
  }
}

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const root = new Group();
  root.name = 'props';
  const materials = await createPropMaterials(ctx);
  const terrain = ctx.terrain;
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
  const tmp = new Vector3();

  for (const def of PROP_LAYOUT) {
    const rng = createRng(`${ctx.config.seed}/props/${def.id}`);
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
    } else {
      const radius = footprintRadius(def);
      const spot = findSpot(ctx, def, radius, taken);
      if (!spot) {
        skipped.push(def.id);
        continue;
      }
      [x, z] = spot;
      // round 49: props build on the LEGACY heightfield view; a spot that the expansion's live-only
      // ground has since raised, paved or built on (the south bank, the far hut's knoll, the west
      // discs and flights) is dropped here — a filter after placement, so no stream re-rolls
      if (expansionCull(x, z)) {
        skipped.push(def.id);
        culledByExpansion.push(def.id);
        continue;
      }
      groundY = terrain.height(x, z);
      if (def.kind === 'platform') {
        const spec = def.platform ?? { deck: 1.2, width: 1.8, depth: 1.4, rail: true, ladder: true };
        const q = new Quaternion().setFromAxisAngle(UP, yaw);
        const groundAt = (lx: number, lz: number) => {
          tmp.set(lx, 0, lz).applyQuaternion(q);
          return terrain.height(x + tmp.x, z + tmp.z) - groundY;
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
        const n = terrain.normal(x, z, new Vector3());
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
    bases.push([x, terrain.height(x, z), z]);
    placed.push({ id: def.id, kind: def.kind, cluster: def.cluster, x: +x.toFixed(3), y: +groundY.toFixed(3), z: +z.toFixed(3), tiltDeg: +((tiltUsed * 180) / Math.PI).toFixed(2) });
    footprints.push({ x: +x.toFixed(3), z: +z.toFixed(3), r: +footR.toFixed(3) });
    if (localityOf(def.cluster) === 'backside') backsideCasters.push({ x, z, r: footR + 0.25, y0: groundY - 0.1, y1: groundY + (def.kind === 'marker' ? def.size + 0.15 : def.size * 1.1), shadow: true });
    clusterNames.add(def.cluster);
    const batches = batchesFor(localityOf(def.cluster));
    let bounds = clusterBounds.get(def.cluster);
    if (!bounds) {
      bounds = {};
      clusterBounds.set(def.cluster, bounds);
    }
    for (const part of parts) {
      const g = part.geometry;
      weather(g, part.material, def.kind === 'platform' || def.kind === 'ladder' ? 0.9 : def.size);
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
          const seated = terrain.height(v.x, v.z) - EMBED;
          v.y += (seated - v.y) * w;
          if (w >= 0.99999) contact.push(i);
        } else if (feet.has(i)) {
          // platform posts / ladder rails: the builder's foot vertices, re-seated on the world heightfield
          v.y = terrain.height(v.x, v.z) - EMBED;
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
      ownedGeometry.push(merged);
      const mesh = new Mesh(merged, materials[key]);
      mesh.name = `${locality}-${key}`;
      mesh.castShadow = ctx.quality.shadows;
      mesh.receiveShadow = true;
      group.add(mesh);
      meshes++;
    }
    root.add(group);
    if (!first) localityBounds.push({ group, sphere });
  }
  // the backside locality follows util/expansionLocality.ts: hidden beyond 60 m of the expansion
  // box, or when neither the props nor their sun-shadow footprints meet the camera's frustum —
  // so the six fixed frames, which look away from it, draw none of it in either pass
  const sunToward = ctx.sun ? ctx.sun.position.clone().sub(ctx.sun.target.position).normalize() : sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
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
      materials.dispose();
      root.clear();
    },
  };
}
