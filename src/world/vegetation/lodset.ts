/**
 * A set of plants of one kind: `variants` geometry variants × `lods` detail levels. Variants that
 * share a *pack* are drawn by one InstancedMesh per LOD: their geometries are concatenated with a
 * per-vertex `aVariant` slot, every instance carries the slot it shows (`aPlantVariant`), and the
 * vegetation vertex shader collapses the other slots' vertices onto the instance root (zero-area
 * triangles, no fill) — the draw-call trick hardscape's joint sprouts use. Packs are chosen per
 * LOD (`packs`): the far LODs, where most instances live and geometries are tiny, pack every
 * variant into one draw; the near LOD keeps big geometries apart so the collapsed vertices stay
 * cheap. Every plant is bucketed into exactly one LOD mesh; `update()` re-buckets plants by camera
 * distance when the camera has moved.
 *
 * Submission culling (round 15, the trees system's round-16 pattern): a LOD bucket is a distance
 * ring all around the camera, so before this every plant of the ring — the two thirds behind the
 * camera included — was rasterised in the colour pass and, on the shadow-casting LODs, in the
 * sun's depth map. `cull()` trims each bucket to the instances that can reach the frame: an
 * instance is submitted when its bounding sphere (root + the plant's reach at any LOD, grown by
 * CULL_PAD_M for wind sway and the shadow filter's reach) meets the view frustum, or — on a
 * shadow-casting mesh — when the volume its shadow sweeps along the sun direction down to
 * SHADOW_FLOOR_Y (a capsule) meets it, since a caster behind the camera whose shadow falls into
 * the frame must stay in the depth map. Both tests are conservative (plane separation), so the
 * frame is pixel-identical to the untrimmed one; what changes is the triangle count and the draw
 * calls of buckets that trim to nothing (hidden). The bucket sizes (`submission().bucket`) still
 * sum to the plant count; the scene graph carries the submitted instances (a set built with
 * `cull: false` keeps submitting whole buckets — litter.ts explains why the leaves do).
 */
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Frustum, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Sphere, Vector3, type Camera, type Material, type TypedArray } from 'three';

/**
 * Culling pad (m) on every instance sphere: plants sway ≤ 0.2 m (windBranch at the seed heads'
 * sway 4.5 / stiffness 0.15), the shadow filter reaches 0.45 m of penumbra + 0.3 m of blocker
 * search (lighting/shadowfilter.ts), the rest is slack.
 */
export const CULL_PAD_M = 1.5;
/** lowest world height a shadow receiver can have (the terrain floor is −0.85 m); the capsule is swept down to it */
export const SHADOW_FLOOR_Y = -10;
const _p = new Vector3();
const _q = new Vector3();
const _kept: number[] = [];
const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** variant index groups sharing one InstancedMesh, either for every LOD or given per LOD */
export type PackLayout = number[][] | number[][][];

export interface LodSetOptions {
  name: string;
  /** variants[v][lod] */
  variants: BufferGeometry[][];
  material: Material;
  /** Matching deformation for directional/spot and point-light shadow passes. */
  shadowMaterials?: { depth: Material; distance: Material };
  /** distance thresholds: lod i is used while distance < lodDistances[i]; the last lod has no limit */
  lodDistances: number[];
  /** lods with index < castShadowLods cast shadows */
  castShadowLods?: number;
  receiveShadow?: boolean;
  /** re-bucket when the camera moved further than this */
  hysteresis?: number;
  /** which variants share a draw (default: all variants in one pack at every LOD) */
  packs?: PackLayout;
  /** submission-culling pad (m) on every instance sphere (default CULL_PAD_M) */
  cullPad?: number;
  /** false: `cull()` submits this set's buckets whole (default true) */
  cull?: boolean;
}

interface Item {
  x: number;
  y: number;
  z: number;
  variant: number;
  matrix: Float32Array;
  color: [number, number, number];
  /** radius (m) of the sphere about the root that holds the placed plant at every LOD (set by build) */
  reach: number;
}

interface PackMesh {
  mesh: InstancedMesh;
  slots: InstancedBufferAttribute;
  /** triangles one instance submits (every variant of the pack, the collapsed ones included) */
  triangles: number;
  /** item indices bucketed into this mesh by camera distance (before culling) */
  list: number[];
  /** item indices actually submitted: `list` minus the culled instances */
  submitted: number[];
}

/** one mesh's share of the submission, for the audit */
export interface MeshSubmission {
  name: string;
  lod: number;
  pack: number;
  /** plants bucketed into the mesh by distance */
  bucket: number;
  /** plants submitted after culling (the mesh's instance count) */
  submitted: number;
  /** triangles per submitted instance */
  triangles: number;
  castShadow: boolean;
  mesh: InstancedMesh;
}

/** per-vertex variant slot inside a packed geometry */
export const PACK_VERTEX_ATTRIBUTE = 'aVariant';
/** per-instance slot the instance shows */
export const PACK_INSTANCE_ATTRIBUTE = 'aPlantVariant';

/**
 * Concatenate the geometries of one pack (same attribute set, indexed or not) into one indexed
 * geometry, tagging every vertex with its slot. Attributes are copied verbatim (normals included),
 * so a kept variant renders exactly as its source geometry would.
 */
export function packGeometries(geos: BufferGeometry[]): BufferGeometry {
  const first = geos[0];
  const names = Object.keys(first.attributes);
  const totalVerts = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new BufferGeometry();
  for (const name of names) {
    const proto = first.attributes[name] as BufferAttribute;
    const Ctor = proto.array.constructor as new (n: number) => TypedArray;
    const arr = new Ctor(totalVerts * proto.itemSize);
    let offset = 0;
    for (const g of geos) {
      const a = g.attributes[name] as BufferAttribute | undefined;
      if (!a || a.itemSize !== proto.itemSize) throw new Error(`pack: variant geometries disagree on attribute ${name}`);
      arr.set(a.array as ArrayLike<number>, offset);
      offset += a.count * a.itemSize;
    }
    out.setAttribute(name, new BufferAttribute(arr, proto.itemSize, proto.normalized));
  }
  const slot = new Float32Array(totalVerts);
  const totalIndex = geos.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count), 0);
  const index = totalVerts > 65535 ? new Uint32Array(totalIndex) : new Uint16Array(totalIndex);
  let base = 0;
  let k = 0;
  geos.forEach((g, s) => {
    const count = g.attributes.position.count;
    slot.fill(s, base, base + count);
    if (g.index) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) index[k++] = src[i] + base;
    } else {
      for (let i = 0; i < count; i++) index[k++] = i + base;
    }
    base += count;
  });
  out.setAttribute(PACK_VERTEX_ATTRIBUTE, new BufferAttribute(slot, 1));
  out.setIndex(new BufferAttribute(index, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

export class LodInstancedSet {
  readonly group = new Group();
  readonly items: Item[] = [];
  /** meshes[lod][pack] */
  private meshes: PackMesh[][] = [];
  /** packs[lod] = variant index groups */
  private packs: number[][][] = [];
  /** packOf[lod][variant], slotOf[lod][variant] */
  private packOf: number[][] = [];
  private slotOf: number[][] = [];
  private built = false;
  private lastCam = new Vector3(Infinity, Infinity, Infinity);
  /** set once `cull()` has run: buckets are then trimmed instead of submitted whole */
  private culling = false;
  /** buckets changed since the last cull */
  private bucketsDirty = false;
  private readonly frustum = new Frustum();
  private readonly viewProj = new Matrix4();
  private readonly lastViewProj = new Matrix4().makeScale(0, 0, 0);
  private readonly sun = new Vector3(0, 1, 0);

  constructor(readonly opts: LodSetOptions) {
    this.group.name = opts.name;
  }

  get count() {
    return this.items.length;
  }

  get variantCount() {
    return this.opts.variants.length;
  }

  get lodCount() {
    return this.opts.variants[0].length;
  }

  /** the pack layout in use, per LOD (resolved defaults) */
  get packLayout(): number[][][] {
    return this.resolvePacks();
  }

  private resolvePacks(): number[][][] {
    const { variants, packs } = this.opts;
    const lodCount = this.lodCount;
    const all = variants.map((_, v) => v);
    let perLod: number[][][];
    if (!packs) perLod = Array.from({ length: lodCount }, () => [all]);
    else if (packs.length && Array.isArray((packs as number[][][])[0][0])) perLod = packs as number[][][];
    else perLod = Array.from({ length: lodCount }, () => packs as number[][]);
    if (perLod.length !== lodCount) throw new Error(`${this.opts.name}: pack layout has ${perLod.length} LOD entries, geometry has ${lodCount}`);
    for (const layout of perLod) {
      const seen = new Set<number>();
      for (const pack of layout) for (const v of pack) {
        if (v < 0 || v >= variants.length || seen.has(v)) throw new Error(`${this.opts.name}: variant ${v} missing or repeated in the pack layout`);
        seen.add(v);
      }
      if (seen.size !== variants.length) throw new Error(`${this.opts.name}: pack layout leaves a variant without a draw`);
    }
    return perLod;
  }

  add(matrix: Float32Array, variant: number, color: Color | [number, number, number]) {
    const c: [number, number, number] = Array.isArray(color) ? color : [color.r, color.g, color.b];
    this.items.push({ x: matrix[12], y: matrix[13], z: matrix[14], variant, matrix: Float32Array.from(matrix), color: c, reach: 0 });
  }

  /**
   * Drop the items `drop` selects (before `build`). Placement passes that walk this set's items
   * afterwards see the pruned list, so a caller that wants the earlier passes' streams untouched
   * prunes after they have run.
   */
  prune(drop: (item: Item) => boolean): number {
    if (this.built) throw new Error(`${this.opts.name}: prune before build`);
    const kept = this.items.filter((it) => !drop(it));
    const removed = this.items.length - kept.length;
    this.items.length = 0;
    this.items.push(...kept);
    return removed;
  }

  /** Allocate meshes (capacity = items per pack) once all items were added. */
  build(): Group {
    if (this.built) return this.group;
    this.built = true;
    const { variants, material } = this.opts;
    const lodCount = this.lodCount;
    this.packs = this.resolvePacks();
    this.packOf = this.packs.map((layout) => {
      const map = new Array<number>(variants.length).fill(-1);
      layout.forEach((pack, pi) => pack.forEach((v) => (map[v] = pi)));
      return map;
    });
    this.slotOf = this.packs.map((layout) => {
      const map = new Array<number>(variants.length).fill(0);
      layout.forEach((pack) => pack.forEach((v, slot) => (map[v] = slot)));
      return map;
    });
    // geometry extent per variant (all LODs): bounds = pack positions + extent × largest scale
    const geoRadius = variants.map((row) => {
      let r = 0;
      for (const g of row) {
        if (!g.boundingSphere) g.computeBoundingSphere();
        r = Math.max(r, g.boundingSphere!.radius + g.boundingSphere!.center.length());
      }
      return r;
    });
    // the placed plant's reach about its root: geometry extent × the largest axis scale
    for (const it of this.items) {
      const scale = Math.max(Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]), Math.hypot(it.matrix[4], it.matrix[5], it.matrix[6]), Math.hypot(it.matrix[8], it.matrix[9], it.matrix[10]));
      it.reach = scale * geoRadius[it.variant];
    }
    const centre = new Vector3();
    for (let l = 0; l < lodCount; l++) {
      const row: PackMesh[] = [];
      this.packs[l].forEach((pack, pi) => {
        const inPack = new Set(pack);
        const mine = this.items.filter((it) => inPack.has(it.variant));
        // The mesh sphere's centre is the pack's centroid, fixed for good: three sorts the opaque
        // meshes of one material by the depth of this centre, so a centre that followed the
        // submitted instances would reorder a set's draws between poses and flip the depth ties of
        // overlapping leaves (measured: 1–7 pixels in shots A / D). Only the radius follows the
        // submission (`fill`). Summed in item order and scaled like the pre-cull code, so the sort
        // key is bit-identical to it.
        centre.set(0, 0, 0);
        for (const it of mine) {
          centre.x += it.x;
          centre.y += it.y;
          centre.z += it.z;
        }
        if (mine.length) centre.multiplyScalar(1 / mine.length);
        const capacity = Math.max(1, mine.length);
        const geometry = packGeometries(pack.map((v) => variants[v][l]));
        const slots = new InstancedBufferAttribute(new Float32Array(capacity), 1);
        slots.setUsage(DynamicDrawUsage);
        geometry.setAttribute(PACK_INSTANCE_ATTRIBUTE, slots);
        const mesh = new InstancedMesh(geometry, material, capacity);
        mesh.count = 0;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        const colors = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        colors.setUsage(DynamicDrawUsage);
        mesh.instanceColor = colors;
        mesh.castShadow = l < (this.opts.castShadowLods ?? 0);
        if (mesh.castShadow && this.opts.shadowMaterials) {
          mesh.customDepthMaterial = this.opts.shadowMaterials.depth;
          mesh.customDistanceMaterial = this.opts.shadowMaterials.distance;
        }
        mesh.receiveShadow = this.opts.receiveShadow ?? true;
        mesh.matrixAutoUpdate = false;
        mesh.boundingSphere = new Sphere(centre.clone(), 0);
        mesh.name = `${this.opts.name}-lod${l}-p${pi}-v${pack.join('')}`;
        mesh.visible = false;
        this.group.add(mesh);
        row.push({ mesh, slots, triangles: geometry.index!.count / 3, list: [], submitted: [] });
      });
      this.meshes.push(row);
    }
    // seed the last LOD with everything so the very first frame draws the plants
    this.bucket(() => lodCount - 1);
    return this.group;
  }

  /** Bucket every plant into one mesh; the buckets are submitted whole until `cull()` has run. */
  private bucket(lodFor: (it: Item) => number) {
    for (const row of this.meshes) for (const pm of row) pm.list.length = 0;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const lod = lodFor(it);
      this.meshes[lod][this.packOf[lod][it.variant]].list.push(i);
    }
    if (this.culling) this.bucketsDirty = true;
    else this.meshes.forEach((row, l) => row.forEach((pm) => this.fill(pm, l, pm.list)));
  }

  /**
   * Hand `list` (item indices, in bucket order) to the mesh: matrices, colours, variant slots, the
   * count, and the radius of the aggregate bounding sphere (about the pack's fixed centre, see
   * `build`) over the submitted instances, carrying the same pad they were admitted with — three
   * culls the whole mesh against it, and an unpadded sphere would drop a sparse bucket admitted at
   * the frustum's edge for its sway / shadow reach.
   */
  private fill(pm: PackMesh, lod: number, list: number[]) {
    const { mesh, slots } = pm;
    const matrices = mesh.instanceMatrix.array as Float32Array;
    const colors = mesh.instanceColor!.array as Float32Array;
    const slotArr = slots.array as Float32Array;
    const slotOf = this.slotOf[lod];
    const centre = mesh.boundingSphere!.center;
    let radius = 0;
    for (let k = 0; k < list.length; k++) {
      const it = this.items[list[k]];
      matrices.set(it.matrix, k * 16);
      colors[k * 3] = it.color[0];
      colors[k * 3 + 1] = it.color[1];
      colors[k * 3 + 2] = it.color[2];
      slotArr[k] = slotOf[it.variant];
      radius = Math.max(radius, Math.hypot(it.x - centre.x, it.y - centre.y, it.z - centre.z) + it.reach);
    }
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    slots.needsUpdate = true;
    // an empty bucket is never submitted (visible=false; three also skips count 0)
    mesh.visible = list.length > 0;
    if (list.length) mesh.boundingSphere!.radius = radius + this.pad;
    if (pm.submitted !== list) {
      pm.submitted.length = 0;
      for (const i of list) pm.submitted.push(i);
    }
  }

  private get pad() {
    return this.opts.cullPad ?? CULL_PAD_M;
  }

  /**
   * Re-bucket instances by LOD for the current camera position (when it moved further than the
   * hysteresis, or when forced). Returns true when the buckets were rebuilt.
   */
  update(camPos: Vector3, force = false): boolean {
    if (!this.built) this.build();
    const hyst = this.opts.hysteresis ?? 0.6;
    if (!force && camPos.distanceToSquared(this.lastCam) < hyst * hyst) return false;
    this.lastCam.copy(camPos);
    const { lodDistances } = this.opts;
    const lodCount = this.lodCount;
    this.bucket((it) => {
      const d = Math.hypot(camPos.x - it.x, camPos.z - it.z);
      for (let l = 0; l < lodCount - 1; l++) if (d < lodDistances[l]) return l;
      return lodCount - 1;
    });
    return true;
  }

  /** the padded instance sphere (root, reach + pad) meets the frustum */
  private inView(it: Item): boolean {
    const r = it.reach + this.pad;
    _p.set(it.x, it.y, it.z);
    for (const plane of this.frustum.planes) if (plane.distanceToPoint(_p) < -r) return false;
    return true;
  }

  /**
   * The volume the instance's shadow sweeps along the sun direction (from the sphere down to
   * SHADOW_FLOOR_Y) meets the frustum: a capsule is outside a plane iff both end spheres are.
   */
  private shadowReaches(it: Item): boolean {
    const r = it.reach + this.pad;
    _p.set(it.x, it.y, it.z);
    const span = Math.max(0, (it.y + r - SHADOW_FLOOR_Y) / Math.max(0.05, this.sun.y));
    _q.copy(_p).addScaledVector(this.sun, -span);
    for (const plane of this.frustum.planes) {
      if (plane.distanceToPoint(_p) < -r && plane.distanceToPoint(_q) < -r) return false;
    }
    return true;
  }

  /**
   * Trim every bucket to the instances that can reach `camera`'s frame (see the header): the view
   * frustum test for every mesh, plus the shadow sweep along `sunDir` (unit vector toward the sun)
   * for the shadow-casting ones. Skipped while neither the view-projection nor the buckets changed
   * (unless forced). Once called, `update()` no longer submits whole buckets.
   */
  cull(camera: Camera, sunDir: Vector3, force = false) {
    if (!this.built) this.build();
    this.culling = true;
    camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!force && !this.bucketsDirty && this.viewProj.equals(this.lastViewProj)) return;
    this.lastViewProj.copy(this.viewProj);
    this.bucketsDirty = false;
    this.frustum.setFromProjectionMatrix(this.viewProj);
    if (sunDir.lengthSq() > 1e-6) this.sun.copy(sunDir).normalize();
    const trim = this.opts.cull !== false;
    for (let l = 0; l < this.meshes.length; l++) {
      for (const pm of this.meshes[l]) {
        let keep = pm.list;
        if (trim) {
          const casts = pm.mesh.castShadow;
          _kept.length = 0;
          for (const i of pm.list) {
            const it = this.items[i];
            if (this.inView(it) || (casts && this.shadowReaches(it))) _kept.push(i);
          }
          keep = _kept;
        }
        if (!sameList(keep, pm.submitted)) this.fill(pm, l, keep);
      }
    }
  }

  /** every mesh's bucket size, submitted count and per-instance cost (audit) */
  submission(): MeshSubmission[] {
    const out: MeshSubmission[] = [];
    this.meshes.forEach((row, lod) =>
      row.forEach((pm, pack) => out.push({ name: pm.mesh.name, lod, pack, bucket: pm.list.length, submitted: pm.mesh.count, triangles: pm.triangles, castShadow: pm.mesh.castShadow, mesh: pm.mesh })),
    );
    return out;
  }

  /**
   * Draw calls / triangles of the submitted instances (after `cull()`, before three's own per-mesh
   * frustum test), including one sun-shadow pass. Triangles are what the GPU is handed: a packed
   * instance submits every variant of its pack (the collapsed ones as zero-area triangles).
   */
  stats(): { drawCalls: number; triangles: number } {
    let drawCalls = 0;
    let triangles = 0;
    for (const row of this.meshes) {
      for (const { mesh, triangles: tris } of row) {
        if (!mesh.visible || mesh.count === 0) continue;
        drawCalls += mesh.castShadow ? 2 : 1;
        triangles += tris * mesh.count * (mesh.castShadow ? 2 : 1);
      }
    }
    return { drawCalls, triangles };
  }

  /** Release the meshes' instance buffers and the packed geometries (the source variants are the caller's). */
  dispose() {
    for (const row of this.meshes) {
      for (const { mesh } of row) {
        mesh.dispose();
        mesh.geometry.dispose();
      }
    }
  }

  samples(max = 400): number[][] {
    const step = Math.max(1, Math.ceil(this.items.length / max));
    const out: number[][] = [];
    for (let i = 0; i < this.items.length && out.length < max; i += step) {
      const it = this.items[i];
      out.push([Math.round(it.x * 1000) / 1000, Math.round(it.y * 1000) / 1000, Math.round(it.z * 1000) / 1000]);
    }
    return out;
  }
}
