/**
 * Small geometry kit for the bag's procedural item meshes: a cross-section sweep (tapered
 * blades, gnarled sticks, curved prongs), a lathe wrapper and a canvas-texture factory with a
 * seeded PRNG. Everything is original and deterministic (no Math.random, no loaded assets), so
 * the item cards render the same pixels in every capture.
 */
import { BufferAttribute, BufferGeometry, CanvasTexture, LatheGeometry, RepeatWrapping, SRGBColorSpace, Vector2, Vector3, type Texture } from 'three';
import { seeded } from '../svg';

export type Rng = () => number;

/** Cross-section of a sweep at parameter t (0..1): a closed ring of 2-D points (x right, y up in the section plane). */
export type SectionFn = (t: number) => [number, number][];

export interface SweepOptions {
  /** centre-line sampled at t (0..1) */
  path: (t: number) => Vector3;
  section: SectionFn;
  segments: number;
  /** close the tube at both ends with a fan */
  caps?: boolean;
  /** roll the section around the tangent (radians) */
  twist?: (t: number) => number;
}

const _t = new Vector3();
const _n = new Vector3();
const _b = new Vector3();
const _up = new Vector3(0, 1, 0);
const _alt = new Vector3(1, 0, 0);

/**
 * Sweep a (possibly varying) cross-section along a centre-line. The section points are laid in
 * the plane spanned by a parallel-transported normal / binormal so the ring never flips.
 */
export function sweep(o: SweepOptions): BufferGeometry {
  const segs = Math.max(2, o.segments);
  const ringN = o.section(0).length;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const prevN = new Vector3();
  const p = new Vector3();
  const q = new Vector3();
  const centres: Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    p.copy(o.path(t));
    centres.push(p.clone());
    q.copy(o.path(Math.min(1, t + 1e-3)));
    _t.subVectors(q, p);
    if (_t.lengthSq() < 1e-12) _t.subVectors(p, o.path(Math.max(0, t - 1e-3)));
    _t.normalize();
    if (i === 0) {
      const ref = Math.abs(_t.dot(_up)) > 0.9 ? _alt : _up;
      _n.crossVectors(_t, ref).normalize();
    } else {
      // parallel transport: project the previous normal onto the new section plane
      _n.copy(prevN).addScaledVector(_t, -prevN.dot(_t));
      if (_n.lengthSq() < 1e-8) _n.crossVectors(_t, _up).normalize();
      else _n.normalize();
    }
    prevN.copy(_n);
    _b.crossVectors(_t, _n).normalize();
    const roll = o.twist ? o.twist(t) : 0;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const ring = o.section(t);
    for (let j = 0; j < ringN; j++) {
      const [sx0, sy0] = ring[j];
      const sx = sx0 * cr - sy0 * sr;
      const sy = sx0 * sr + sy0 * cr;
      positions.push(p.x + _n.x * sx + _b.x * sy, p.y + _n.y * sx + _b.y * sy, p.z + _n.z * sx + _b.z * sy);
      uvs.push(j / ringN, t);
    }
    // duplicate the seam vertex so the uv wraps cleanly
    const [sx0, sy0] = ring[0];
    const sx = sx0 * cr - sy0 * sr;
    const sy = sx0 * sr + sy0 * cr;
    positions.push(p.x + _n.x * sx + _b.x * sy, p.y + _n.y * sx + _b.y * sy, p.z + _n.z * sx + _b.z * sy);
    uvs.push(1, t);
  }
  const stride = ringN + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < ringN; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  // per-vertex normals: from the ring centre outward, blended with the face normal by computeVertexNormals
  for (let i = 0; i <= segs; i++) {
    const c = centres[i];
    for (let j = 0; j <= ringN; j++) {
      const k = (i * stride + j) * 3;
      normals.push(positions[k] - c.x, positions[k + 1] - c.y, positions[k + 2] - c.z);
    }
  }
  if (o.caps) {
    for (const end of [0, segs]) {
      const c = centres[end];
      const ci = positions.length / 3;
      positions.push(c.x, c.y, c.z);
      // cap normal = ± tangent
      const nxt = o.path(end === 0 ? 1e-3 : 1);
      const prv = o.path(end === 0 ? 0 : 1 - 1e-3);
      _t.subVectors(nxt, prv).normalize();
      if (end === 0) _t.negate();
      normals.push(_t.x, _t.y, _t.z);
      uvs.push(0.5, end === 0 ? 0 : 1);
      for (let j = 0; j < ringN; j++) {
        const a = end * stride + j;
        const b = end * stride + j + 1;
        if (end === 0) indices.push(ci, b, a);
        else indices.push(ci, a, b);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Circle section of radius r(t) with n points; `squash` flattens y. */
export function circleSection(r: (t: number) => number, n = 12, squash = 1): SectionFn {
  return (t) => {
    const rad = r(t);
    const pts: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad * squash]);
    }
    return pts;
  };
}

/** Straight line from a to b. */
export function linePath(a: Vector3, b: Vector3): (t: number) => Vector3 {
  return (t) => new Vector3().lerpVectors(a, b, t);
}

/** Quadratic Bézier a → b with control c. */
export function bezierPath(a: Vector3, c: Vector3, b: Vector3): (t: number) => Vector3 {
  return (t) => {
    const u = 1 - t;
    return new Vector3(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
  };
}

/** Lathe of a profile given as [radius, y] pairs (y up), with `segments` around. */
export function lathe(profile: [number, number][], segments = 48): LatheGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(0, r), y)),
    segments,
  );
}

/** 2-D canvas painter → sRGB texture. */
export function paintTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D, rng: Rng) => void, seed: number, repeat = false): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  paint(ctx, seeded(seed));
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Same painter, but the result is data (roughness / bump): linear colour space. */
export function paintData(w: number, h: number, paint: (ctx: CanvasRenderingContext2D, rng: Rng) => void, seed: number, repeat = false): Texture {
  const tex = paintTexture(w, h, paint, seed, repeat);
  tex.colorSpace = '';
  return tex;
}

export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h.toFixed(1)},${(s * 100).toFixed(0)}%,${(l * 100).toFixed(0)}%,${a.toFixed(3)})`;

/** Wood-plank grain: long wavy fibres in a warm brown, a few darker knots. */
export function woodGrain(ctx: CanvasRenderingContext2D, rng: Rng, w: number, h: number, hue: number, light: number, vertical = true): void {
  ctx.fillStyle = hsl(hue, 0.45, light);
  ctx.fillRect(0, 0, w, h);
  const fibres = Math.round((vertical ? w : h) / 3);
  for (let i = 0; i < fibres; i++) {
    const x0 = rng() * (vertical ? w : h);
    const wob = 4 + rng() * 14;
    const dark = rng() < 0.5;
    ctx.strokeStyle = hsl(hue + (rng() - 0.5) * 6, 0.4 + rng() * 0.2, dark ? light - 0.12 - rng() * 0.1 : light + 0.06 + rng() * 0.08, 0.25 + rng() * 0.35);
    ctx.lineWidth = 0.6 + rng() * 1.6;
    ctx.beginPath();
    const len = vertical ? h : w;
    for (let s = 0; s <= 12; s++) {
      const t = s / 12;
      const off = Math.sin(t * Math.PI * (1 + rng() * 0.6) + i) * wob;
      if (vertical) (s ? ctx.lineTo : ctx.moveTo).call(ctx, x0 + off, t * len);
      else (s ? ctx.lineTo : ctx.moveTo).call(ctx, t * len, x0 + off);
    }
    ctx.stroke();
  }
  for (let k = 0; k < 4; k++) {
    const kx = rng() * w;
    const ky = rng() * h;
    const r = 5 + rng() * 9;
    const grad = ctx.createRadialGradient(kx, ky, 1, kx, ky, r);
    grad.addColorStop(0, hsl(hue - 4, 0.5, light - 0.32, 0.9));
    grad.addColorStop(0.5, hsl(hue - 2, 0.45, light - 0.18, 0.6));
    grad.addColorStop(1, hsl(hue, 0.45, light, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(kx, ky, r, r * (0.5 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Speckled leather / rough cloth. */
export function leather(ctx: CanvasRenderingContext2D, rng: Rng, w: number, h: number, hue: number, light: number): void {
  ctx.fillStyle = hsl(hue, 0.35, light);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 6; i++) {
    ctx.fillStyle = hsl(hue + (rng() - 0.5) * 8, 0.3, light + (rng() - 0.5) * 0.16, 0.35);
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
  }
  ctx.strokeStyle = hsl(hue, 0.35, light - 0.18, 0.5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.moveTo(rng() * w, rng() * h);
    ctx.lineTo(rng() * w, rng() * h);
    ctx.stroke();
  }
}

/** Bark: dark vertical fissures over a grey-brown ground. */
export function bark(ctx: CanvasRenderingContext2D, rng: Rng, w: number, h: number, hue: number, light: number): void {
  ctx.fillStyle = hsl(hue, 0.28, light);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < w / 2; i++) {
    const x0 = rng() * w;
    ctx.strokeStyle = hsl(hue + (rng() - 0.5) * 10, 0.3, rng() < 0.6 ? light - 0.15 - rng() * 0.15 : light + 0.1 + rng() * 0.1, 0.5 + rng() * 0.4);
    ctx.lineWidth = 0.8 + rng() * 2.4;
    ctx.beginPath();
    let x = x0;
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += h / 10) {
      x += (rng() - 0.5) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = hsl(hue, 0.3, light - 0.3, 0.6);
    ctx.beginPath();
    ctx.ellipse(rng() * w, rng() * h, 1.5 + rng() * 3, 3 + rng() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
