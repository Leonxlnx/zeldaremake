/**
 * Procedural rock geometry: icosphere → ridged multi-noise displacement → planar "cleave" cuts
 * (flat facets with sharp edges) → crease-angle normals (smooth on the weathered parts, hard on
 * the fractures). Vertex colours carry cracks, contact dirt and per-rock tint; `aMoss` carries
 * the moss coverage for upward-facing surfaces.
 */
import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';

/** cheap isotropic-ish 3D noise from three 2D planes */
export class Noise3 {
  private a: Noise2D;
  private b: Noise2D;
  private c: Noise2D;
  constructor(seed: string) {
    this.a = new Noise2D(`${seed}/xy`);
    this.b = new Noise2D(`${seed}/yz`);
    this.c = new Noise2D(`${seed}/zx`);
  }
  noise(x: number, y: number, z: number) {
    return (this.a.noise(x, y + 0.37 * z) + this.b.noise(y, z + 0.37 * x) + this.c.noise(z, x + 0.37 * y)) / 3;
  }
  fbm(x: number, y: number, z: number, oct = 3) {
    let amp = 1;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * this.noise(x * f, y * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }
  ridged(x: number, y: number, z: number, oct = 3) {
    let amp = 0.55;
    let f = 1;
    let sum = 0;
    for (let o = 0; o < oct; o++) {
      const n = 1 - Math.abs(this.noise(x * f, y * f, z * f));
      sum += n * n * amp;
      amp *= 0.5;
      f *= 2.1;
    }
    return Math.min(1, sum);
  }
}

export interface RockOptions {
  radius: number;
  detail: number;
  /** ridged displacement amplitude (fraction of radius) */
  ridge?: number;
  /** low-frequency lump amplitude (fraction of radius) */
  lump?: number;
  /** number of planar cleave cuts */
  cuts?: number;
  /** vertical squash (1 = sphere) */
  squashY?: number;
  /** crease angle in degrees below which normals are smoothed */
  creaseDeg?: number;
  /** crack density 0..1 */
  cracks?: number;
  /** moss coverage 0..1 (on upward faces) */
  moss?: number;
  /** base tint */
  tint?: Color;
  /** contact dirt darkening near the base 0..1 */
  dirt?: number;
  /** noise frequency multiplier (per metre) */
  freq?: number;
}

const _p = new Vector3();
const _n = new Vector3();

export function buildRock(rng: Rng, seed: string, o: RockOptions): BufferGeometry {
  const N = new Noise3(seed);
  const r = o.radius;
  const ridge = o.ridge ?? 0.16;
  const lump = o.lump ?? 0.18;
  const cuts = o.cuts ?? 3;
  const squashY = o.squashY ?? 0.8;
  const freq = (o.freq ?? 1) / Math.max(0.2, r);
  const base = new IcosahedronGeometry(r, o.detail).toNonIndexed();
  const pos = base.attributes.position as Float32BufferAttribute;
  const count = pos.count;

  // per-rock random rotation of the noise domain so instances differ
  const ox = rng.range(-50, 50);
  const oy = rng.range(-50, 50);
  const oz = rng.range(-50, 50);

  // 1. displacement (do it per unique direction so shared vertices stay welded)
  const disp = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    _p.fromBufferAttribute(pos, i);
    const key = `${_p.x.toFixed(4)},${_p.y.toFixed(4)},${_p.z.toFixed(4)}`;
    let d = disp.get(key);
    if (d === undefined) {
      const x = _p.x * freq + ox;
      const y = _p.y * freq + oy;
      const z = _p.z * freq + oz;
      const rd = N.ridged(x * 1.6, y * 1.6, z * 1.6, 3); // 0..1
      const lp = N.fbm(x * 0.55, y * 0.55, z * 0.55, 2); // -1..1
      d = 1 + lump * lp + ridge * (rd - 0.5) * 2 * 0.5 + ridge * 0.35 * N.fbm(x * 3.1, y * 3.1, z * 3.1, 2);
      disp.set(key, d);
    }
    _p.multiplyScalar(d);
    _p.y *= squashY;
    pos.setXYZ(i, _p.x, _p.y, _p.z);
  }

  // 2. cleave cuts: project everything beyond a plane onto it → flat fracture faces
  for (let c = 0; c < cuts; c++) {
    // bias normals toward the upper hemisphere and sideways so facets are visible
    _n.set(rng.range(-1, 1), rng.range(-0.2, 1.0), rng.range(-1, 1)).normalize();
    const dist = r * rng.range(0.5, 0.82) * (0.6 + 0.4 * squashY);
    for (let i = 0; i < count; i++) {
      _p.fromBufferAttribute(pos, i);
      const d = _p.dot(_n);
      if (d > dist) {
        _p.addScaledVector(_n, dist - d);
        pos.setXYZ(i, _p.x, _p.y, _p.z);
      }
    }
  }
  // flat-ish bottom (buried anyway) so the rock never balances on a spike
  const floor = -r * squashY * 0.62;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (y < floor) pos.setY(i, floor + (y - floor) * 0.25);
  }
  pos.needsUpdate = true;

  // 3. crease-angle normals
  computeCreaseNormals(base, o.creaseDeg ?? 38);

  // 4. colours + moss
  const nrm = base.attributes.normal as Float32BufferAttribute;
  const col = new Float32Array(count * 3);
  const moss = new Float32Array(count);
  const tint = o.tint ?? new Color(0.72, 0.72, 0.7);
  const crackAmt = o.cracks ?? 0.6;
  const mossAmt = o.moss ?? 0.6;
  const dirt = o.dirt ?? 0.5;
  const tmp = new Color();
  const dark = new Color(0.3, 0.29, 0.27);
  const soil = new Color(0.32, 0.26, 0.18);
  for (let i = 0; i < count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nrm, i);
    const x = _p.x * freq + ox;
    const y = _p.y * freq + oy;
    const z = _p.z * freq + oz;
    // tonal variation
    const v = N.fbm(x * 1.1 + 7, y * 1.1, z * 1.1, 2) * 0.5 + 0.5;
    tmp.copy(tint).multiplyScalar(0.82 + 0.36 * v);
    // cracks: thin dark lines where ridged noise peaks
    const cr = N.ridged(x * 4.2, y * 4.2, z * 4.2, 2);
    const crack = smoothstep(0.86 - 0.12 * crackAmt, 0.97, cr) * crackAmt;
    tmp.lerp(dark, crack * 0.8);
    // contact dirt at the base
    const h01 = clamp((_p.y + r * squashY) / (2 * r * squashY), 0, 1);
    tmp.lerp(soil, dirt * (1 - smoothstep(0.05, 0.4, h01)));
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
    // moss: upward faces, noise patches, more in crevices (low ridged value), none right at the base
    const up = smoothstep(0.15, 0.75, _n.y + 0.25 * N.fbm(x * 2.2, y * 2.2, z * 2.2, 2));
    const patch = smoothstep(0.35, 0.7, N.fbm(x * 1.4 + 3, y * 1.4 - 5, z * 1.4, 3) * 0.5 + 0.5);
    moss[i] = clamp(mossAmt * up * (0.35 + 0.85 * patch) * smoothstep(0.02, 0.2, h01) * (1 - crack * 0.6), 0, 1);
  }
  base.setAttribute('color', new Float32BufferAttribute(col, 3));
  base.setAttribute('aMoss', new Float32BufferAttribute(moss, 1));
  base.computeBoundingSphere();
  base.computeBoundingBox();
  return base;
}

/** normals for a non-indexed geometry: average adjacent face normals within the crease angle */
export function computeCreaseNormals(g: BufferGeometry, creaseDeg: number) {
  const pos = g.attributes.position as Float32BufferAttribute;
  const count = pos.count;
  const faceN = new Float32Array(count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const cb = new Vector3();
  const ab = new Vector3();
  const byPos = new Map<string, number[]>();
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    cb.subVectors(c, b);
    ab.subVectors(a, b);
    cb.cross(ab).normalize();
    for (let k = 0; k < 3; k++) {
      faceN[(i + k) * 3] = cb.x;
      faceN[(i + k) * 3 + 1] = cb.y;
      faceN[(i + k) * 3 + 2] = cb.z;
      const key = `${pos.getX(i + k).toFixed(4)},${pos.getY(i + k).toFixed(4)},${pos.getZ(i + k).toFixed(4)}`;
      const l = byPos.get(key);
      if (l) l.push(i + k);
      else byPos.set(key, [i + k]);
    }
  }
  const cosT = Math.cos((creaseDeg * Math.PI) / 180);
  const out = new Float32Array(count * 3);
  for (const list of byPos.values()) {
    for (const i of list) {
      let nx = 0;
      let ny = 0;
      let nz = 0;
      const fx = faceN[i * 3];
      const fy = faceN[i * 3 + 1];
      const fz = faceN[i * 3 + 2];
      for (const j of list) {
        const gx = faceN[j * 3];
        const gy = faceN[j * 3 + 1];
        const gz = faceN[j * 3 + 2];
        if (fx * gx + fy * gy + fz * gz >= cosT) {
          nx += gx;
          ny += gy;
          nz += gz;
        }
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      out[i * 3] = nx / l;
      out[i * 3 + 1] = ny / l;
      out[i * 3 + 2] = nz / l;
    }
  }
  g.setAttribute('normal', new Float32BufferAttribute(out, 3));
}
