/**
 * A set of plants of one kind: `variants` geometry variants × `lods` detail levels. Variants that
 * share a *pack* are drawn by one InstancedMesh per LOD: their geometries are concatenated with a
 * per-vertex `aVariant` slot, every instance carries the slot it shows (`aPlantVariant`), and the
 * vegetation vertex shader collapses the other slots' vertices onto the instance root (zero-area
 * triangles, no fill) — the draw-call trick hardscape's joint sprouts use. Packs are chosen per
 * LOD (`packs`): the far LODs, where most instances live and geometries are tiny, pack every
 * variant into one draw; the near LOD keeps big geometries apart so the collapsed vertices stay
 * cheap. Every plant is always in exactly one LOD mesh, so the sum of instance counts under the
 * group never changes (the audit relies on that); `update()` re-buckets plants by camera distance
 * when the camera has moved.
 */
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Sphere, Vector3, type Material, type TypedArray } from 'three';

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
}

interface Item {
  x: number;
  y: number;
  z: number;
  variant: number;
  matrix: Float32Array;
  color: [number, number, number];
}

interface PackMesh {
  mesh: InstancedMesh;
  slots: InstancedBufferAttribute;
  triangles: number;
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
  private lodCounts: number[][] = [];

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
    this.items.push({ x: matrix[12], y: matrix[13], z: matrix[14], variant, matrix: Float32Array.from(matrix), color: c });
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
    const centre = new Vector3();
    for (let l = 0; l < lodCount; l++) {
      const row: PackMesh[] = [];
      this.packs[l].forEach((pack, pi) => {
        const inPack = new Set(pack);
        const mine = this.items.filter((it) => inPack.has(it.variant));
        centre.set(0, 0, 0);
        let maxReach = 0;
        for (const it of mine) {
          centre.x += it.x;
          centre.y += it.y;
          centre.z += it.z;
          const scale = Math.max(Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]), Math.hypot(it.matrix[4], it.matrix[5], it.matrix[6]), Math.hypot(it.matrix[8], it.matrix[9], it.matrix[10]));
          maxReach = Math.max(maxReach, scale * geoRadius[it.variant]);
        }
        if (mine.length) centre.multiplyScalar(1 / mine.length);
        let radius = 0;
        for (const it of mine) radius = Math.max(radius, Math.hypot(it.x - centre.x, it.y - centre.y, it.z - centre.z));
        radius += maxReach + 0.5;
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
        mesh.boundingSphere = new Sphere(centre.clone(), radius);
        mesh.name = `${this.opts.name}-lod${l}-p${pi}-v${pack.join('')}`;
        mesh.visible = false;
        this.group.add(mesh);
        row.push({ mesh, slots, triangles: geometry.index!.count / 3 });
      });
      this.meshes.push(row);
    }
    this.lodCounts = this.meshes.map((row) => row.map(() => 0));
    // seed the last LOD with everything so the very first frame draws the plants
    this.bucket(() => lodCount - 1);
    return this.group;
  }

  private bucket(lodFor: (it: Item) => number) {
    for (const row of this.lodCounts) row.fill(0);
    for (const it of this.items) {
      const lod = lodFor(it);
      const pi = this.packOf[lod][it.variant];
      const pm = this.meshes[lod][pi];
      const slot = this.lodCounts[lod][pi]++;
      pm.mesh.instanceMatrix.array.set(it.matrix, slot * 16);
      pm.mesh.instanceColor!.array.set(it.color, slot * 3);
      pm.slots.array[slot] = this.slotOf[lod][it.variant];
    }
    this.meshes.forEach((row, l) =>
      row.forEach((pm, pi) => {
        pm.mesh.count = this.lodCounts[l][pi];
        pm.mesh.instanceMatrix.needsUpdate = true;
        pm.mesh.instanceColor!.needsUpdate = true;
        pm.slots.needsUpdate = true;
        // an empty LOD is never submitted (visible=false; three also skips count 0)
        pm.mesh.visible = pm.mesh.count > 0;
      }),
    );
  }

  /** Re-bucket instances by LOD for the current camera position. */
  update(camPos: Vector3, force = false) {
    if (!this.built) this.build();
    const hyst = this.opts.hysteresis ?? 0.6;
    if (!force && camPos.distanceToSquared(this.lastCam) < hyst * hyst) return;
    this.lastCam.copy(camPos);
    const { lodDistances } = this.opts;
    const lodCount = this.lodCount;
    this.bucket((it) => {
      const d = Math.hypot(camPos.x - it.x, camPos.z - it.z);
      for (let l = 0; l < lodCount - 1; l++) if (d < lodDistances[l]) return l;
      return lodCount - 1;
    });
  }

  /**
   * Draw calls / triangles before frustum culling, including one sun-shadow pass. Triangles are
   * what the GPU is handed: a packed instance submits every variant of its pack (the collapsed
   * ones as zero-area triangles).
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
