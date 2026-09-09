/**
 * A set of plants of one kind: `variants` geometry variants × `lods` detail levels, drawn with
 * one InstancedMesh per (variant, lod). Every plant is always in exactly one LOD mesh, so the
 * sum of instance counts under the group never changes (the audit relies on that); `update()`
 * re-buckets plants by camera distance when the camera has moved.
 */
import { Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Sphere, Vector3, type BufferGeometry, type Material } from 'three';

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
}

interface Item {
  x: number;
  y: number;
  z: number;
  variant: number;
  matrix: Float32Array;
  color: [number, number, number];
}

export class LodInstancedSet {
  readonly group = new Group();
  readonly items: Item[] = [];
  private meshes: InstancedMesh[][] = [];
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

  add(matrix: Float32Array, variant: number, color: Color | [number, number, number]) {
    const c: [number, number, number] = Array.isArray(color) ? color : [color.r, color.g, color.b];
    this.items.push({ x: matrix[12], y: matrix[13], z: matrix[14], variant, matrix: Float32Array.from(matrix), color: c });
  }

  /** Allocate meshes (capacity = items per variant) once all items were added. */
  build(): Group {
    if (this.built) return this.group;
    this.built = true;
    const { variants, material, lodDistances } = this.opts;
    const lodCount = variants[0].length;
    for (let v = 0; v < variants.length; v++) {
      const mine = this.items.filter((it) => it.variant === v);
      const row: InstancedMesh[] = [];
      // bounds: all positions of this variant + geometry extent × largest scale
      const centre = new Vector3();
      let maxScale = 0;
      for (const it of mine) {
        centre.x += it.x;
        centre.y += it.y;
        centre.z += it.z;
        maxScale = Math.max(maxScale, Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]), Math.hypot(it.matrix[4], it.matrix[5], it.matrix[6]), Math.hypot(it.matrix[8], it.matrix[9], it.matrix[10]));
      }
      if (mine.length) centre.multiplyScalar(1 / mine.length);
      let radius = 0;
      for (const it of mine) radius = Math.max(radius, Math.hypot(it.x - centre.x, it.y - centre.y, it.z - centre.z));
      let geoRadius = 0;
      for (const g of variants[v]) {
        if (!g.boundingSphere) g.computeBoundingSphere();
        geoRadius = Math.max(geoRadius, g.boundingSphere!.radius + g.boundingSphere!.center.length());
      }
      radius += geoRadius * maxScale + 0.5;
      for (let l = 0; l < lodCount; l++) {
        const mesh = new InstancedMesh(variants[v][l], material, Math.max(1, mine.length));
        mesh.count = l === lodCount - 1 ? mine.length : 0;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        const colors = new InstancedBufferAttribute(new Float32Array(Math.max(1, mine.length) * 3), 3);
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
        mesh.name = `${this.opts.name}-v${v}-lod${l}`;
        mesh.visible = mine.length > 0;
        this.group.add(mesh);
        row.push(mesh);
      }
      this.meshes.push(row);
      // seed the last LOD with everything so the very first frame draws the plants
      const last = row[lodCount - 1];
      mine.forEach((it, i) => {
        last.instanceMatrix.array.set(it.matrix, i * 16);
        last.instanceColor!.array.set(it.color, i * 3);
      });
      last.instanceMatrix.needsUpdate = true;
      last.instanceColor!.needsUpdate = true;
    }
    this.lodCounts = this.meshes.map((row) => row.map(() => 0));
    return this.group;
  }

  /** Re-bucket instances by LOD for the current camera position. */
  update(camPos: Vector3, force = false) {
    if (!this.built) this.build();
    const hyst = this.opts.hysteresis ?? 0.6;
    if (!force && camPos.distanceToSquared(this.lastCam) < hyst * hyst) return;
    this.lastCam.copy(camPos);
    const { lodDistances } = this.opts;
    const lodCount = this.opts.variants[0].length;
    for (const row of this.lodCounts) row.fill(0);
    for (const it of this.items) {
      const d = Math.hypot(camPos.x - it.x, camPos.z - it.z);
      let lod = lodCount - 1;
      for (let l = 0; l < lodCount - 1; l++) {
        if (d < lodDistances[l]) {
          lod = l;
          break;
        }
      }
      const mesh = this.meshes[it.variant][lod];
      const slot = this.lodCounts[it.variant][lod]++;
      mesh.instanceMatrix.array.set(it.matrix, slot * 16);
      mesh.instanceColor!.array.set(it.color, slot * 3);
    }
    for (let v = 0; v < this.meshes.length; v++) {
      for (let l = 0; l < lodCount; l++) {
        const mesh = this.meshes[v][l];
        mesh.count = this.lodCounts[v][l];
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor!.needsUpdate = true;
        mesh.visible = mesh.count > 0;
      }
    }
  }

  /** Draw calls / triangles before frustum culling, including one sun-shadow pass. */
  stats(): { drawCalls: number; triangles: number } {
    let drawCalls = 0;
    let triangles = 0;
    for (const row of this.meshes) {
      for (const mesh of row) {
        if (!mesh.visible || mesh.count === 0) continue;
        const g = mesh.geometry;
        const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
        drawCalls += mesh.castShadow ? 2 : 1;
        triangles += tris * mesh.count * (mesh.castShadow ? 2 : 1);
      }
    }
    return { drawCalls, triangles };
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
