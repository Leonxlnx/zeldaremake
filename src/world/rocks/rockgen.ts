/**
 * Procedural rock geometry: icosphere → ridged multi-noise displacement → bedding strata (tilted
 * layers: each bed is a ledge stepping in or out with a dark groove at the parting) → planar
 * "cleave" cuts (flat facets with sharp edges) → moss cushion (upward faces swell by the moss
 * thickness) → crease-angle normals (smooth on the weathered parts, hard on the fractures).
 * Vertex colours carry cracks, bedding partings, contact dirt and per-rock tint; `aMoss`
 * carries the moss coverage for upward-facing surfaces.
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
  /**
   * bedding strata: ledge depth as a fraction of the radius (0 = none). Beds are ~0.3–0.45 r
   * thick on a slightly tilted axis; each parting is a dark groove and the bed above it steps in
   * or out a little, so the silhouette reads as stacked layers.
   */
  strata?: number;
  /** moss cushion thickness on the upward faces (fraction of the radius) */
  mossThickness?: number;
  /**
   * range of the cleave-plane normals' y component (default [-0.15, 1]: facets face up and out —
   * angular scree). Rounded boulders use a sideways band so the crown stays a dome.
   */
  cutUp?: [number, number];
  /** cleave depth range as a fraction of the radius for the first two cuts (default [0.42, 0.62]) */
  cutDepth?: [number, number];
}

const _p = new Vector3();
const _n = new Vector3();
const _bed = new Vector3();

export function buildRock(rng: Rng, seed: string, o: RockOptions): BufferGeometry {
  const N = new Noise3(seed);
  const r = o.radius;
  const ridge = o.ridge ?? 0.16;
  const lump = o.lump ?? 0.18;
  const cuts = o.cuts ?? 3;
  const squashY = o.squashY ?? 0.8;
  const strata = o.strata ?? 0;
  const freq = (o.freq ?? 1) / Math.max(0.2, r);
  // PolyhedronGeometry subdivides linearly: 20·(detail+1)² triangles, already non-indexed
  const ico = new IcosahedronGeometry(r, o.detail);
  const base = ico.index ? ico.toNonIndexed() : ico;
  const pos = base.attributes.position as Float32BufferAttribute;
  const count = pos.count;

  // per-rock random rotation of the noise domain so instances differ
  const ox = rng.range(-50, 50);
  const oy = rng.range(-50, 50);
  const oz = rng.range(-50, 50);

  // bedding: near-vertical axis tilted 8–22°, bed thickness and per-bed in/out offsets
  const tilt = rng.range(0.14, 0.38);
  const tiltDir = rng.range(0, Math.PI * 2);
  _bed.set(Math.sin(tilt) * Math.cos(tiltDir), Math.cos(tilt), Math.sin(tilt) * Math.sin(tiltDir));
  const bedThick = r * squashY * rng.range(0.26, 0.4);
  const bedPhase = rng();
  const bedOffsets = [0, 1, 2, 3, 4, 5, 6, 7].map(() => rng.range(-1, 1));
  /** returns { groove: 0..1 at the parting, step: -1..1 per-bed radial offset } for a point */
  const bedding = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    const h = (x * _bed.x + y * _bed.y + z * _bed.z) / bedThick + bedPhase + 0.18 * N.fbm(nx * 0.9, ny * 0.9, nz * 0.9, 2);
    const k = Math.floor(h);
    const f = h - k;
    // parting groove: narrow band around f = 0 (both sides), softened by noise so it breaks up
    const g = 1 - smoothstep(0.0, 0.16, Math.min(f, 1 - f));
    const step = bedOffsets[((k % 8) + 8) % 8];
    return { groove: g, step, f };
  };

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
      if (strata > 0) {
        // beds step in/out (mostly on the sides — the flat cap stays whole) and sink at the
        // parting. Evaluated on the noise-displaced position so the colour pass (which sees the
        // final vertex) finds the groove where the geometry has it.
        const b = bedding(_p.x * d, _p.y * d * squashY, _p.z * d, x, y, z);
        const side = 1 - Math.abs(_p.y / r) * 0.6;
        d *= 1 + strata * side * (0.55 * b.step - 1.1 * b.groove);
      }
      disp.set(key, d);
    }
    _p.multiplyScalar(d);
    _p.y *= squashY;
    pos.setXYZ(i, _p.x, _p.y, _p.z);
  }

  // 2. cleave cuts: project everything beyond a plane onto it → flat fracture faces
  const cutUp = o.cutUp ?? [-0.15, 1.0];
  const cutDepth = o.cutDepth ?? [0.42, 0.62];
  for (let c = 0; c < cuts; c++) {
    // bias normals toward the upper hemisphere and sideways so facets are visible
    _n.set(rng.range(-1, 1), rng.range(cutUp[0], cutUp[1]), rng.range(-1, 1)).normalize();
    // deeper cuts on the first planes (big fracture faces), shallower chips afterwards
    const depth = c < 2 ? rng.range(cutDepth[0], cutDepth[1]) : rng.range(0.6, 0.82);
    const dist = r * depth * (0.6 + 0.4 * squashY);
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

  const crackAmt = o.cracks ?? 0.6;
  const mossAmt = o.moss ?? 0.6;
  const mossThick = o.mossThickness ?? 0;

  /** moss coverage 0..1 for a vertex at p with normal n (upward faces, patches, not the base) */
  const mossAt = (p: Vector3, n: Vector3, crack: number) => {
    const x = p.x * freq + ox;
    const y = p.y * freq + oy;
    const z = p.z * freq + oz;
    const h01 = clamp((p.y + r * squashY) / (2 * r * squashY), 0, 1);
    // a heavy cap: everything facing up within ~35° carries moss, thinning out over the
    // shoulders (gone by ~65°) so the sides stay bare grey rock (the reference boulders are
    // stone with a moss hat, not green mounds — C reads the stair-foot boulder from its shaded
    // north side and it must still look like rock there)
    const up = smoothstep(0.38, 0.82, n.y + 0.12 * N.fbm(x * 2.2, y * 2.2, z * 2.2, 2));
    const patch = smoothstep(0.15, 0.6, N.fbm(x * 1.4 + 3, y * 1.4 - 5, z * 1.4, 3) * 0.5 + 0.5);
    // a thin moss/lichen skin also creeps down the shaded sides in a few places
    const side = 0.12 * smoothstep(0.6, 0.9, patch) * smoothstep(-0.3, 0.2, n.y);
    return clamp(mossAmt * (up * (0.7 + 0.5 * patch) + side) * smoothstep(0.02, 0.2, h01) * (1 - crack * 0.5), 0, 1);
  };
  const crackAt = (p: Vector3) => {
    const x = p.x * freq + ox;
    const y = p.y * freq + oy;
    const z = p.z * freq + oz;
    // thin dark lines where ridged noise peaks, plus the bedding partings
    const cr = N.ridged(x * 4.2, y * 4.2, z * 4.2, 2);
    let crack = smoothstep(0.84 - 0.12 * crackAmt, 0.97, cr) * crackAmt;
    if (strata > 0) crack = Math.max(crack, 0.85 * bedding(p.x, p.y, p.z, x, y, z).groove * (1 - Math.abs(p.y / (r * squashY)) * 0.5));
    return clamp(crack, 0, 1);
  };

  // 3. moss cushion: upward faces swell by the moss thickness (welded per position), so the cap
  // reads as a thick pad sitting on the rock rather than a green tint
  computeCreaseNormals(base, o.creaseDeg ?? 38);
  if (mossThick > 0) {
    const nrm0 = base.attributes.normal as Float32BufferAttribute;
    const swell = new Map<string, [number, number, number]>();
    for (let i = 0; i < count; i++) {
      _p.fromBufferAttribute(pos, i);
      const key = `${_p.x.toFixed(4)},${_p.y.toFixed(4)},${_p.z.toFixed(4)}`;
      let s = swell.get(key);
      if (!s) {
        _n.fromBufferAttribute(nrm0, i);
        // vertex-averaged direction (independent of which face we came from) → welded offset
        const m = mossAt(_p, _n, crackAt(_p));
        const k = mossThick * r * smoothstep(0.15, 0.7, m);
        _n.set(_p.x, _p.y * 1.4, _p.z).normalize().lerp(_n, 0.5).normalize();
        s = [_n.x * k, _n.y * k, _n.z * k];
        swell.set(key, s);
      }
      pos.setXYZ(i, _p.x + s[0], _p.y + s[1], _p.z + s[2]);
    }
    pos.needsUpdate = true;
  }

  // 4. crease-angle normals on the final shape
  computeCreaseNormals(base, o.creaseDeg ?? 38);

  // 5. colours + moss
  const nrm = base.attributes.normal as Float32BufferAttribute;
  const col = new Float32Array(count * 3);
  const moss = new Float32Array(count);
  const tint = o.tint ?? new Color(0.72, 0.72, 0.7);
  const dirt = o.dirt ?? 0.5;
  const tmp = new Color();
  // cracks and partings read near-black in the reference (A rock p10 ≈ 0.14 in frame)
  const dark = new Color(0.15, 0.14, 0.12);
  const soil = new Color(0.24, 0.19, 0.13);
  for (let i = 0; i < count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nrm, i);
    const x = _p.x * freq + ox;
    const y = _p.y * freq + oy;
    const z = _p.z * freq + oz;
    // tonal variation, with the beds alternating slightly lighter / darker
    const v = N.fbm(x * 1.1 + 7, y * 1.1, z * 1.1, 2) * 0.5 + 0.5;
    let tone = 0.87 + 0.26 * v;
    if (strata > 0) tone *= 1 + 0.08 * bedding(_p.x, _p.y, _p.z, x, y, z).step;
    tmp.copy(tint).multiplyScalar(tone);
    // cracks + bedding partings: dark
    const crack = crackAt(_p);
    tmp.lerp(dark, crack * 0.92);
    // contact dirt at the base (darker, higher than before: the reference boulders sit in a
    // shadowed collar of soil and moss)
    const h01 = clamp((_p.y + r * squashY) / (2 * r * squashY), 0, 1);
    tmp.lerp(soil, dirt * (1 - smoothstep(0.05, 0.45, h01)));
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
    moss[i] = mossAt(_p, _n, crack);
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
