/**
 * Foliage that grows on structures: heart-leaf vines (hanging strands and strands draped over
 * a surface), leaf clusters on branch tips, grass tufts and fern fronds on roofs and the log.
 * Everything is merged into three meshes (leaves / stems / tufts) with per-vertex wind
 * attributes (aPhase, aAmount) consumed by the wind-patched materials.
 */
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D } from '../util/noise';
import { merge, quad, setColorAttribute, setFloatAttribute, sweepTube } from './geometry';
import type { StructureMaterials } from './materials';

/** heart-leaf size (metres, before ±25 % jitter) — real vine leaves, not scaled with distance */
export const LEAF_SIZE = 0.075;
/** spacing of leaves along a strand (metres) */
export const LEAF_EVERY = 0.05;

const DOWN = new Vector3(0, -1, 0);
const UP = new Vector3(0, 1, 0);
const _q = new Quaternion();
const _q2 = new Quaternion();
const _m = new Matrix4();
const _s = new Vector3();
const _dir = new Vector3();
const _side = new Vector3();

function tintOf(base: Color, rng: Rng, spread = 0.18): [number, number, number] {
  const k = 1 + (rng() - 0.5) * 2 * spread;
  const warm = (rng() - 0.5) * 0.12;
  return [Math.max(0, base.r * k + warm), Math.max(0, base.g * k), Math.max(0, base.b * k - warm * 0.5)];
}

export class FoliageBuilder {
  private leaves: BufferGeometry[] = [];
  private stems: BufferGeometry[] = [];
  private tufts: BufferGeometry[] = [];
  private noise: Noise2D;
  leafCount = 0;
  tuftCount = 0;
  vineCount = 0;
  /** linear-space tint around 1 so the leaf texture keeps its brightness */
  private leafBase = new Color().setRGB(1.0, 1.04, 0.86);

  constructor(private rng: Rng, seed: string) {
    this.noise = new Noise2D(`${seed}/foliage`);
  }

  /** One heart leaf. `dir` is the direction the leaf points away from its attachment point. */
  addLeaf(pos: Vector3, dir: Vector3, size: number, phase: number, amount: number, tint?: [number, number, number]): void {
    const w = size * (0.9 + this.rng() * 0.2);
    const h = size * (1.0 + this.rng() * 0.15);
    const g = quad(w, h, { bend: 0.18 + this.rng() * 0.2, segments: 2 });
    // attachment point (stem notch, v = 1) at the origin, leaf body along -y
    g.translate(0, -h, 0);
    _dir.copy(dir).normalize();
    _q.setFromUnitVectors(DOWN, _dir);
    _q2.setFromAxisAngle(_dir, this.rng() * Math.PI * 2);
    _q2.multiply(_q);
    _s.set(1, 1, 1);
    _m.compose(pos, _q2, _s);
    g.applyMatrix4(_m);
    setFloatAttribute(g, 'aPhase', phase);
    setFloatAttribute(g, 'aAmount', amount);
    setColorAttribute(g, tint ?? tintOf(this.leafBase, this.rng));
    this.leaves.push(g);
    this.leafCount++;
  }

  /** A strand hanging from `hook`, length `length`, with leaves alternating along it. */
  addHangingVine(hook: Vector3, length: number, opts: { drift?: Vector3; leafSize?: number; leafEvery?: number; phase?: number; amount?: number; thickness?: number } = {}): void {
    const n = 10;
    const drift = opts.drift ?? new Vector3((this.rng() - 0.5) * 0.5, 0, (this.rng() - 0.5) * 0.5);
    const phase = opts.phase ?? this.rng() * Math.PI * 2;
    const pts: Vector3[] = [];
    const nx = this.rng() * 100;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = hook.clone();
      p.y -= length * t;
      p.addScaledVector(drift, t * t);
      p.x += this.noise.noise(nx + t * 2.3, 0.3) * 0.08 * t;
      p.z += this.noise.noise(nx + 7.1, t * 2.3) * 0.08 * t;
      pts.push(p);
    }
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const thick = opts.thickness ?? 0.013;
    const stem = sweepTube(curve, { radius: (t) => thick * (1 - 0.55 * t), tubularSegments: n, radialSegments: 4 });
    setFloatAttribute(stem, 'aPhase', phase);
    // bend grows along the strand: amount from position index (vertices are laid out ring by ring)
    const ring = 5;
    const amount = opts.amount ?? 0.09;
    setFloatAttribute(stem, 'aAmount', (i) => amount * Math.min(1, Math.floor(i / ring) / n));
    setColorAttribute(stem, [0.35, 0.4, 0.2]);
    this.stems.push(stem);
    this.vineCount++;

    // real-world leaf spacing/size (≈ 6–9 cm leaves every ~5 cm, alternating sides) so strands
    // read as strands of small leaves at any distance
    const every = opts.leafEvery ?? LEAF_EVERY;
    const count = Math.max(2, Math.floor(length / every));
    const tangent = new Vector3();
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      const p = curve.getPointAt(t);
      curve.getTangentAt(t, tangent);
      // side vector alternates left/right of the strand
      _side.crossVectors(tangent, UP);
      if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
      _side.normalize().multiplyScalar(k % 2 === 0 ? 1 : -1);
      _dir.copy(_side).multiplyScalar(0.75 + this.rng() * 0.4).addScaledVector(DOWN, 0.55 + this.rng() * 0.5);
      _dir.x += (this.rng() - 0.5) * 0.4;
      _dir.z += (this.rng() - 0.5) * 0.4;
      const size = (opts.leafSize ?? LEAF_SIZE) * (0.8 + this.rng() * 0.45) * (0.8 + 0.2 * (1 - t));
      this.addLeaf(p, _dir.clone(), size, phase, amount * (0.4 + 0.6 * t));
    }
  }

  /** A strand lying on a surface (roof, log): points already on the surface; `normals` point outward. */
  addSurfaceVine(points: Vector3[], normals: Vector3[], opts: { leafSize?: number; leafEvery?: number; amount?: number; thickness?: number } = {}): void {
    if (points.length < 2) return;
    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const phase = this.rng() * Math.PI * 2;
    const segs = Math.max(6, points.length * 3);
    const thick = opts.thickness ?? 0.02;
    const stem = sweepTube(curve, { radius: (t) => thick * (1 - 0.5 * t), tubularSegments: segs, radialSegments: 5 });
    setFloatAttribute(stem, 'aPhase', phase);
    setFloatAttribute(stem, 'aAmount', opts.amount ?? 0.015);
    setColorAttribute(stem, [0.42, 0.45, 0.22]);
    this.stems.push(stem);
    this.vineCount++;
    const length = curve.getLength();
    const every = opts.leafEvery ?? LEAF_EVERY * 1.4;
    const count = Math.max(2, Math.floor(length / every));
    const tangent = new Vector3();
    const nrm = new Vector3();
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      const p = curve.getPointAt(t);
      curve.getTangentAt(t, tangent);
      // interpolate the nearest normal
      const ni = Math.min(normals.length - 1, Math.round(t * (normals.length - 1)));
      nrm.copy(normals[ni]);
      _side.crossVectors(tangent, nrm).normalize().multiplyScalar(k % 2 === 0 ? 1 : -1);
      _dir.copy(_side).multiplyScalar(0.8).addScaledVector(nrm, 0.5 + this.rng() * 0.4).addScaledVector(tangent, (this.rng() - 0.5) * 0.4);
      const size = (opts.leafSize ?? LEAF_SIZE) * (0.8 + this.rng() * 0.45);
      this.addLeaf(p.clone().addScaledVector(nrm, 0.02), _dir.clone(), size, phase, (opts.amount ?? 0.015) * 2.5);
    }
  }

  /**
   * Loose cluster of leaves around a branch tip. `tint` (linear rgb around 1) darkens or
   * yellows the whole clump; `flatten` squashes the sphere toward a cushion lying on a surface.
   */
  addLeafCluster(center: Vector3, radius: number, count: number, opts: { size?: number; amount?: number; droop?: number; tint?: [number, number, number]; tintSpread?: number; flatten?: number } = {}): void {
    const phase = this.rng() * Math.PI * 2;
    const base = opts.tint ? new Color().setRGB(opts.tint[0], opts.tint[1], opts.tint[2]) : null;
    const flat = opts.flatten ?? 0.7;
    for (let i = 0; i < count; i++) {
      const u = this.rng() * 2 - 1;
      const a = this.rng() * Math.PI * 2;
      const r = radius * Math.cbrt(this.rng());
      const off = new Vector3(Math.sqrt(1 - u * u) * Math.cos(a), u * flat, Math.sqrt(1 - u * u) * Math.sin(a)).multiplyScalar(r);
      const p = center.clone().add(off);
      _dir.copy(off).normalize().addScaledVector(DOWN, opts.droop ?? 0.7);
      if (_dir.lengthSq() < 1e-4) _dir.set(0, -1, 0);
      const tint = base ? tintOf(base, this.rng, opts.tintSpread ?? 0.22) : undefined;
      this.addLeaf(p, _dir.clone(), (opts.size ?? 0.13) * (0.8 + this.rng() * 0.45), phase + this.rng() * 0.6, opts.amount ?? 0.05, tint);
    }
  }

  /** Grass tuft (kind 0) or fern frond (kind 1) card cross at `pos`, growing along `normal`. `shade` multiplies the tint. */
  addTuft(pos: Vector3, normal: Vector3, size: number, kind: 0 | 1, amount = 0.05, shade: [number, number, number] = [1, 1, 1]): void {
    const phase = this.rng() * Math.PI * 2;
    const cards = kind === 0 ? 2 : 3;
    const raw: [number, number, number] = kind === 0 ? [0.95 + this.rng() * 0.3, 1.0 + this.rng() * 0.15, 0.85] : [0.8, 0.95 + this.rng() * 0.2, 0.8];
    const tint: [number, number, number] = [raw[0] * shade[0], raw[1] * shade[1], raw[2] * shade[2]];
    const yaw0 = this.rng() * Math.PI;
    for (let c = 0; c < cards; c++) {
      const w = size * (kind === 0 ? 1.1 : 0.7);
      const h = size * (kind === 0 ? 1.0 : 1.35);
      const g = quad(w, h, { bend: 0, segments: 1 });
      // atlas half
      const uv = g.attributes.uv as Float32BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + kind * 0.5);
      if (kind === 1) {
        // fern fronds lean outward
        g.rotateX(-0.6 - this.rng() * 0.4);
        g.translate(0, 0, 0.02);
      }
      _q.setFromUnitVectors(UP, normal.clone().normalize());
      _q2.setFromAxisAngle(UP, yaw0 + (c * Math.PI) / cards + (this.rng() - 0.5) * 0.3);
      _q.multiply(_q2);
      _s.set(1, 1, 1);
      _m.compose(pos, _q, _s);
      g.applyMatrix4(_m);
      setFloatAttribute(g, 'aPhase', phase);
      const uvAttr = g.attributes.uv as Float32BufferAttribute;
      setFloatAttribute(g, 'aAmount', (i) => amount * uvAttr.getY(i));
      setColorAttribute(g, tint);
      this.tufts.push(g);
    }
    this.tuftCount++;
  }

  /** Merge everything into up to three meshes. */
  build(mats: StructureMaterials, namePrefix: string): Mesh[] {
    const out: Mesh[] = [];
    if (this.leaves.length) {
      const m = new Mesh(merge(this.leaves), mats.leaf);
      m.name = `${namePrefix}-leaves`;
      m.castShadow = true;
      m.receiveShadow = true;
      m.customDepthMaterial = mats.leafDepth;
      m.customDistanceMaterial = mats.leafDistance;
      out.push(m);
    }
    if (this.stems.length) {
      const m = new Mesh(merge(this.stems), mats.vine);
      m.name = `${namePrefix}-vines`;
      m.castShadow = true;
      m.receiveShadow = true;
      m.customDepthMaterial = mats.vineDepth;
      m.customDistanceMaterial = mats.vineDistance;
      out.push(m);
    }
    if (this.tufts.length) {
      const m = new Mesh(merge(this.tufts), mats.tuft);
      m.name = `${namePrefix}-tufts`;
      m.castShadow = false;
      m.receiveShadow = true;
      out.push(m);
    }
    this.leaves = [];
    this.stems = [];
    this.tufts = [];
    return out;
  }
}
