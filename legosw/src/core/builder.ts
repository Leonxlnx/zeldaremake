import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix3,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  Euler,
  type Material,
} from 'three';
import { box, cached, cylinder, lathe, prism, slopeProfile, type BoxFaces, type MeshData, type PrismOpts, type ProfileSeg, type V3 } from './geom';
import { isTransparent, mat, swatch, type ColorKey } from './palette';
import { Rng } from './rng';

/**
 * Brick-by-brick model builder. Coordinates are in stud units (1 = 8 mm stud pitch, so a brick
 * is 1.2 tall and a plate 0.4); macro-scale ships simply push a scale onto the transform stack.
 * Everything added is transformed, tinted per part (moulded plastic is never perfectly uniform)
 * and merged into one geometry per palette colour.
 */

export const PLATE = 0.4;
export const BRICK = 1.2;
export const STUD_R = 0.3;
export const STUD_H = 0.18;
export const GAP = 0.012;

interface Bucket {
  pos: number[];
  nrm: number[];
  uv: number[];
  col: number[];
}

export interface BuiltPart {
  key: ColorKey;
  geometry: BufferGeometry;
  material: Material;
}

export interface Built {
  group: Group;
  parts: BuiltPart[];
  triangles: number;
}

export interface BuilderOpts {
  seed?: number;
  /** per-part brightness variation (±) */
  tint?: number;
  /** box-projection scale of the plastic micro-texture */
  uvScale?: number;
  studSegments?: number;
  /** default chamfer for grid bricks */
  chamfer?: number;
}

type Axis = 'x' | 'y' | 'z';

const AXIS_ROT: Record<Axis, Matrix4> = {
  y: new Matrix4(),
  x: new Matrix4().makeRotationZ(-Math.PI / 2),
  z: new Matrix4().makeRotationX(Math.PI / 2),
};

export class Builder {
  private stack: Matrix4[] = [new Matrix4()];
  private buckets = new Map<ColorKey, Bucket>();
  readonly rng: Rng;
  tint: number;
  uvScale: number;
  studSegments: number;
  chamfer: number;

  constructor(o: BuilderOpts = {}) {
    this.rng = new Rng(o.seed ?? 7);
    this.tint = o.tint ?? 0.035;
    this.uvScale = o.uvScale ?? 0.11;
    this.studSegments = o.studSegments ?? 16;
    this.chamfer = o.chamfer ?? 0.035;
  }

  get m(): Matrix4 {
    return this.stack[this.stack.length - 1];
  }
  push(): this {
    this.stack.push(this.m.clone());
    return this;
  }
  pop(): this {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }
  apply(m: Matrix4): this {
    this.m.multiply(m);
    return this;
  }
  translate(x: number, y: number, z: number): this {
    return this.apply(new Matrix4().makeTranslation(x, y, z));
  }
  rotateX(a: number): this {
    return this.apply(new Matrix4().makeRotationX(a));
  }
  rotateY(a: number): this {
    return this.apply(new Matrix4().makeRotationY(a));
  }
  rotateZ(a: number): this {
    return this.apply(new Matrix4().makeRotationZ(a));
  }
  rotate(x: number, y: number, z: number, order: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY' = 'XYZ'): this {
    return this.apply(new Matrix4().makeRotationFromEuler(new Euler(x, y, z, order)));
  }
  scale(x: number, y = x, z = x): this {
    return this.apply(new Matrix4().makeScale(x, y, z));
  }
  mirrorX(): this {
    return this.apply(new Matrix4().makeScale(-1, 1, 1));
  }
  /** run fn inside a pushed transform */
  with(fn: (b: this) => void): this {
    this.push();
    fn(this);
    return this.pop();
  }
  at(x: number, y: number, z: number, fn: (b: this) => void): this {
    this.push();
    this.translate(x, y, z);
    fn(this);
    return this.pop();
  }

  private bucket(key: ColorKey): Bucket {
    let b = this.buckets.get(key);
    if (!b) {
      b = { pos: [], nrm: [], uv: [], col: [] };
      this.buckets.set(key, b);
    }
    return b;
  }

  /** Append a primitive in local space, transformed by the stack (and `local`). */
  add(key: ColorKey, md: MeshData, local?: Matrix4, o: { tint?: number; shade?: number } = {}): this {
    const m = local ? this.m.clone().multiply(local) : this.m;
    const e = m.elements;
    // normal matrix (inverse transpose of the upper 3×3); handles mirrors and non-uniform scale
    const ne = _n3.getNormalMatrix(m).elements;
    const inv = [ne[0], ne[3], ne[6], ne[1], ne[4], ne[7], ne[2], ne[5], ne[8]];
    const flip = m.determinant() < 0;
    const b = this.bucket(key);
    const t = o.tint ?? this.tint;
    const f = (o.shade ?? 1) * (1 + t * (this.rng.next() * 2 - 1));
    const ou = this.rng.next() * 7.3, ov = this.rng.next() * 5.1;
    const s = this.uvScale;
    const P = md.pos, N = md.nrm;
    const push = (i: number) => {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx0 = N[i], ny0 = N[i + 1], nz0 = N[i + 2];
      let nx = inv[0] * nx0 + inv[1] * ny0 + inv[2] * nz0;
      let ny = inv[3] * nx0 + inv[4] * ny0 + inv[5] * nz0;
      let nz = inv[6] * nx0 + inv[7] * ny0 + inv[8] * nz0;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      b.pos.push(wx, wy, wz);
      b.nrm.push(nx, ny, nz);
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      if (ax >= ay && ax >= az) b.uv.push(wz * s + ou, wy * s + ov);
      else if (ay >= az) b.uv.push(wx * s + ou, wz * s + ov);
      else b.uv.push(wx * s + ou, wy * s + ov);
      b.col.push(f, f, f);
    };
    for (let i = 0; i < P.length; i += 9) {
      if (flip) {
        push(i);
        push(i + 6);
        push(i + 3);
      } else {
        push(i);
        push(i + 3);
        push(i + 6);
      }
    }
    return this;
  }

  /** Chamfered box by centre and size (local units). */
  box(key: ColorKey, cx: number, cy: number, cz: number, w: number, h: number, d: number, o: { c?: number; hide?: BoxFaces; rot?: [number, number, number]; tint?: number } = {}): this {
    const md = box(w, h, d, o.c ?? this.chamfer, o.hide ?? {});
    const local = new Matrix4().makeTranslation(cx, cy, cz);
    if (o.rot) local.multiply(new Matrix4().makeRotationFromEuler(new Euler(o.rot[0], o.rot[1], o.rot[2])));
    return this.add(key, md, local, { tint: o.tint });
  }

  /**
   * Grid brick: min corner (x, z) in studs, bottom yP in plates, size sx × sz studs, hP plates tall.
   */
  brick(key: ColorKey, x: number, yP: number, z: number, sx: number, sz: number, hP = 3, o: { studs?: boolean; c?: number; hide?: BoxFaces; studKey?: ColorKey; tint?: number } = {}): this {
    const h = hP * PLATE;
    const y0 = yP * PLATE;
    const hide = o.hide ?? { ny: true };
    this.box(key, x + sx / 2, y0 + h / 2, z + sz / 2, sx - 2 * GAP, h - 0.004, sz - 2 * GAP, { c: o.c, hide, tint: o.tint });
    if (o.studs ?? true) this.studs(o.studKey ?? key, x, yP + hP, z, sx, sz);
    return this;
  }
  plate(key: ColorKey, x: number, yP: number, z: number, sx: number, sz: number, o: { studs?: boolean; c?: number; hide?: BoxFaces; tint?: number } = {}): this {
    return this.brick(key, x, yP, z, sx, sz, 1, o);
  }
  tile(key: ColorKey, x: number, yP: number, z: number, sx: number, sz: number, o: { c?: number; hide?: BoxFaces; tint?: number } = {}): this {
    return this.brick(key, x, yP, z, sx, sz, 1, { ...o, studs: false });
  }

  studMD(): MeshData {
    return cylinder(STUD_R, STUD_H + 0.02, 0.04, this.studSegments, { bottom: false });
  }
  /** Stud grid on a surface at height yP (plates), min corner (x, z). */
  studs(key: ColorKey, x: number, yP: number, z: number, sx: number, sz: number): this {
    const md = this.studMD();
    const y = yP * PLATE + (STUD_H + 0.02) / 2 - 0.02;
    for (let i = 0; i < sx; i++) for (let j = 0; j < sz; j++) this.add(key, md, new Matrix4().makeTranslation(x + 0.5 + i, y, z + 0.5 + j), { tint: 0.012 });
    return this;
  }
  /** Single stud whose base centre is at (x, y, z) local units, pointing +Y. */
  stud(key: ColorKey, x: number, y: number, z: number): this {
    return this.add(key, this.studMD(), new Matrix4().makeTranslation(x, y + (STUD_H + 0.02) / 2 - 0.02, z), { tint: 0.012 });
  }

  /** Cylinder centred at (cx, cy, cz) along an axis. */
  cyl(key: ColorKey, cx: number, cy: number, cz: number, r: number, h: number, o: { c?: number; radial?: number; top?: boolean; bottom?: boolean; axis?: Axis; tint?: number } = {}): this {
    const md = cylinder(r, h, o.c ?? Math.min(0.035, r * 0.2), o.radial ?? 24, { top: o.top, bottom: o.bottom });
    const local = new Matrix4().makeTranslation(cx, cy, cz).multiply(AXIS_ROT[o.axis ?? 'y']);
    return this.add(key, md, local, { tint: o.tint });
  }

  /** Revolved profile placed at `at`, around `axis`. */
  lathe(key: ColorKey, segs: ProfileSeg[], o: { radial?: number; at?: V3; axis?: Axis; theta0?: number; thetaLen?: number; cacheKey?: string; tint?: number } = {}): this {
    const make = () => lathe(segs, o.radial ?? 24, o.theta0 ?? 0, o.thetaLen ?? Math.PI * 2);
    const md = o.cacheKey ? cached(`lathe|${o.cacheKey}|${o.radial ?? 24}`, make) : make();
    const at = o.at ?? [0, 0, 0];
    const local = new Matrix4().makeTranslation(at[0], at[1], at[2]).multiply(AXIS_ROT[o.axis ?? 'y']);
    return this.add(key, md, local, { tint: o.tint });
  }

  /**
   * Convex polygon (in the local XY plane) extruded along local Z by depth, centred at z = zc.
   */
  prism(key: ColorKey, poly: number[][], depth: number, o: PrismOpts & { c?: number; zc?: number; tint?: number } = {}): this {
    const md = prism(poly, depth, o.c ?? this.chamfer, o);
    const local = o.zc ? new Matrix4().makeTranslation(0, 0, o.zc) : undefined;
    return this.add(key, md, local, { tint: o.tint });
  }

  /**
   * Plate / tile / brick with an arbitrary CONVEX footprint in the local XZ plane (wedge plates,
   * cropped tiles, angled panels): footprint points are [x, z] in local units, bottom at y0, height h
   * (both local units). Add studs separately with stud()/studs() where a real part would have them.
   */
  shape(key: ColorKey, footprint: number[][], y0: number, h: number, o: { c?: number; hideBottom?: boolean; tint?: number } = {}): this {
    const poly = footprint.map(([x, z]) => [x, -z]);
    const local = new Matrix4().makeTranslation(0, y0 + h / 2, 0).multiply(new Matrix4().makeRotationX(-Math.PI / 2));
    return this.add(key, prism(poly, h, o.c ?? this.chamfer, { noBack: o.hideBottom ?? true }), local, { tint: o.tint });
  }

  /**
   * Slope brick. Footprint min corner (x, z) studs, bottom yP plates, `w` studs wide (along X), `d`
   * studs deep (along Z, sloping down toward -Z), `hP` plates tall with `flat` studs of flat top at
   * the back. The textured slope face gets `faceKey` (defaults to the slope variant if one exists).
   */
  slope(key: ColorKey, x: number, yP: number, z: number, w: number, d: number, hP = 3, flat = 1, o: { faceKey?: ColorKey; studs?: boolean; lip?: number; c?: number } = {}): this {
    const h = hP * PLATE - 0.004;
    const prof = slopeProfile(d - 2 * GAP, h, Math.min(flat, d - 0.5), o.lip ?? Math.min(0.2, h * 0.3));
    // profile is (depth, height) → local (z, y); extrude along X.
    const local = new Matrix4()
      .makeTranslation(x + w / 2, yP * PLATE, z + GAP)
      .multiply(new Matrix4().makeRotationY(-Math.PI / 2))
      .multiply(new Matrix4().makeScale(1, 1, 1));
    // after rotY(-90°): local X (profile depth) → world +Z, local Z (extrusion) → world X
    const c = o.c ?? this.chamfer;
    const faceKey = o.faceKey ?? defaultSlopeFace(key);
    this.add(key, prism(prof, w - 2 * GAP, c, { skipWalls: [3], noBack: false }), local);
    this.add(faceKey, prism(prof, w - 2 * GAP, c, { onlyWalls: [3] }), local, { tint: 0.02 });
    if ((o.studs ?? true) && flat >= 1) this.studs(key, x, yP + hP, z + d - Math.floor(flat), w, Math.floor(flat));
    return this;
  }

  /** Merge buckets into meshes (one per colour). */
  build(name: string, o: { castShadow?: boolean; receiveShadow?: boolean } = {}): Built {
    const group = new Group();
    group.name = name;
    const parts: BuiltPart[] = [];
    let triangles = 0;
    for (const [key, b] of this.buckets) {
      if (!b.pos.length) continue;
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(b.pos), 3));
      g.setAttribute('normal', new BufferAttribute(new Float32Array(b.nrm), 3));
      g.setAttribute('uv', new BufferAttribute(new Float32Array(b.uv), 2));
      g.setAttribute('color', new BufferAttribute(new Float32Array(b.col), 3));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const material = mat(key);
      const mesh = new Mesh(g, material);
      mesh.name = `${name}:${key}`;
      const kind = swatch(key).kind;
      mesh.castShadow = (o.castShadow ?? true) && kind !== 'glow' && kind !== 'trans';
      mesh.receiveShadow = (o.receiveShadow ?? true) && kind !== 'glow';
      if (isTransparent(key)) mesh.renderOrder = 2;
      if (kind === 'glow') mesh.renderOrder = 1;
      group.add(mesh);
      parts.push({ key, geometry: g, material });
      triangles += b.pos.length / 9;
    }
    return { group, parts, triangles };
  }
}

function defaultSlopeFace(key: ColorKey): ColorKey {
  const map: Partial<Record<ColorKey, ColorKey>> = { lbg: 'slopeLbg', dbg: 'slopeDbg', white: 'slopeWhite', tan: 'slopeTan', black: 'slopeBlack' };
  return map[key] ?? key;
}

/** Instanced copies of a built model (one InstancedMesh per colour part). */
export function instanced(built: Built, count: number, name: string): { group: Group; meshes: InstancedMesh[]; setMatrix(i: number, m: Matrix4): void; commit(): void } {
  const group = new Group();
  group.name = name;
  const meshes: InstancedMesh[] = [];
  for (const p of built.parts) {
    const im = new InstancedMesh(p.geometry, p.material, count);
    im.name = `${name}:${p.key}`;
    const kind = swatch(p.key).kind;
    im.castShadow = kind !== 'glow' && kind !== 'trans';
    im.receiveShadow = kind !== 'glow';
    im.frustumCulled = false;
    if (isTransparent(p.key)) im.renderOrder = 2;
    group.add(im);
    meshes.push(im);
  }
  return {
    group,
    meshes,
    setMatrix(i, m) {
      for (const im of meshes) im.setMatrixAt(i, m);
    },
    commit() {
      for (const im of meshes) im.instanceMatrix.needsUpdate = true;
    },
  };
}

const _n3 = new Matrix3();
export const _v = new Vector3();
export const _q = new Quaternion();
