/**
 * Prop geometry builders. Every builder returns parts in PROP-LOCAL space (y up, the base at
 * y = 0, non-indexed, with `position` / `normal` / `uv` / `color`), tagged with the material that
 * draws them; `index.ts` seats the parts on the terrain and merges them per locality.
 *
 * Original work throughout: lathed pottery, chamfered boards, coopered staves, laid rope. The
 * plank UVs put every board on its own column of the `weathered_planks` map at true scale
 * (`PLANK_METRES` per repeat, `PLANK_BOARDS` boards across), so no two boards share a grain.
 */
import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Float32BufferAttribute, LatheGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { CLAY_REPEAT_METRES, type MaterialKey, PLANK_BOARDS, PLANK_METRES, ROPE_REPEAT_METRES, WOOD_TINT } from './materials';

export interface Part {
  geometry: BufferGeometry;
  material: MaterialKey;
}

const UP = new Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// generic helpers

/** flat-shaded copy: every triangle owns its vertices (so per-face UVs / colours never bleed) */
export function flat(geometry: BufferGeometry): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  return g;
}

/** paint a `color` attribute from a per-vertex function (position and normal in local space) */
export function paint(geometry: BufferGeometry, fn: (p: Vector3, n: Vector3, i: number) => Color | [number, number, number]): BufferGeometry {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const data = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (nrm) n.fromBufferAttribute(nrm, i);
    const c = fn(p, n, i);
    if (Array.isArray(c)) {
      data[i * 3] = c[0];
      data[i * 3 + 1] = c[1];
      data[i * 3 + 2] = c[2];
    } else {
      data[i * 3] = c.r;
      data[i * 3 + 1] = c.g;
      data[i * 3 + 2] = c.b;
    }
  }
  geometry.setAttribute('color', new Float32BufferAttribute(data, 3));
  return geometry;
}

/** multiply the existing vertex colours */
export function tintBy(geometry: BufferGeometry, fn: (p: Vector3, n: Vector3, i: number) => number | [number, number, number]): void {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const col = geometry.attributes.color;
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (nrm) n.fromBufferAttribute(nrm, i);
    const k = fn(p, n, i);
    const [kr, kg, kb] = typeof k === 'number' ? [k, k, k] : k;
    col.setXYZ(i, col.getX(i) * kr, col.getY(i) * kg, col.getZ(i) * kb);
  }
}

/** apply a rigid transform (position, rotation) to a local-space part */
export function place(geometry: BufferGeometry, position: Vector3, rotation = new Quaternion()): BufferGeometry {
  geometry.applyMatrix4(new Matrix4().compose(position, rotation, new Vector3(1, 1, 1)));
  return geometry;
}

/** rotation taking +Y onto `dir` */
export function alignUp(dir: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
}

/**
 * A box with all twelve edges chamfered (the worn arris of a hand-sawn board): 6 faces, 12 edge
 * bevels, 8 corner triangles — 44 triangles. Centred at the origin, flat normals.
 */
export function chamferedBox(w: number, h: number, d: number, c: number): BufferGeometry {
  c = Math.min(c, w * 0.45, h * 0.45, d * 0.45);
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const verts: number[] = [];
  const tri = (a: number[], b: number[], cc: number[]) => {
    // outward winding for a convex solid centred at the origin
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + cc[0]) / 3, my = (a[1] + b[1] + cc[1]) / 3, mz = (a[2] + b[2] + cc[2]) / 3;
    if (nx * mx + ny * my + nz * mz < 0) verts.push(...a, ...cc, ...b);
    else verts.push(...a, ...b, ...cc);
  };
  const quad = (a: number[], b: number[], cc: number[], dd: number[]) => {
    tri(a, b, cc);
    tri(a, cc, dd);
  };
  // the three inset points of corner (sx, sy, sz): on the x-face, the y-face, the z-face
  const px = (sx: number, sy: number, sz: number) => [sx * hx, sy * (hy - c), sz * (hz - c)];
  const py = (sx: number, sy: number, sz: number) => [sx * (hx - c), sy * hy, sz * (hz - c)];
  const pz = (sx: number, sy: number, sz: number) => [sx * (hx - c), sy * (hy - c), sz * hz];
  for (const s of [-1, 1]) {
    quad(px(s, -1, -1), px(s, 1, -1), px(s, 1, 1), px(s, -1, 1));
    quad(py(-1, s, -1), py(1, s, -1), py(1, s, 1), py(-1, s, 1));
    quad(pz(-1, -1, s), pz(1, -1, s), pz(1, 1, s), pz(-1, 1, s));
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) quad(px(sx, sy, -1), px(sx, sy, 1), py(sx, sy, 1), py(sx, sy, -1)); // x–y edges
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) quad(px(sx, -1, sz), px(sx, 1, sz), pz(sx, 1, sz), pz(sx, -1, sz)); // x–z edges
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) quad(py(-1, sy, sz), py(1, sy, sz), pz(1, sy, sz), pz(-1, sy, sz)); // y–z edges
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) tri(px(sx, sy, sz), py(sx, sy, sz), pz(sx, sy, sz));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

export interface PlankUV {
  /** the axis the grain runs along (local space) */
  grain: 'x' | 'y' | 'z';
  /** which of the map's board columns this board sits on (0 … PLANK_BOARDS − 1, fractional ok) */
  column: number;
  /** offset along the grain (m) so neighbouring boards do not share knots */
  along: number;
}

/**
 * Planar UVs per face at true plank scale: the coordinate across the grain maps onto one board
 * column of the map (the board's own width), the coordinate along the grain runs down that
 * column. End-grain faces (normal along the grain) get a small, dense mapping.
 */
export function plankUV(geometry: BufferGeometry, opts: PlankUV): BufferGeometry {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
  const across = axes.filter((a) => a !== opts.grain);
  const colU = ((opts.column % PLANK_BOARDS) + 0.5) / PLANK_BOARDS;
  const p = new Vector3();
  const n = new Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    n.fromBufferAttribute(nrm, t);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const dominant: 'x' | 'y' | 'z' = ax >= ay && ax >= az ? 'x' : ay >= az ? 'y' : 'z';
    for (let i = t; i < t + 3; i++) {
      p.fromBufferAttribute(pos, i);
      const along = p[opts.grain];
      if (dominant === opts.grain) {
        // end grain: the two across axes, dense
        uv[i * 2] = colU + p[across[0]] / (PLANK_METRES * 0.35);
        uv[i * 2 + 1] = (p[across[1]] + opts.along) / (PLANK_METRES * 0.35);
      } else {
        const acrossAxis = across.find((a) => a !== dominant) ?? across[0];
        uv[i * 2] = colU + p[acrossAxis] / PLANK_METRES;
        uv[i * 2 + 1] = (along + opts.along) / PLANK_METRES;
      }
    }
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/** the edge-wear key: 1 on chamfer / bevel faces (normals off the axes), 0 on the flat faces */
export function bevelness(n: Vector3): number {
  const m = Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
  return smooth(0.72, 0.9, 1 - (m - 0.7071) / (1 - 0.7071));
}

/**
 * A finished board: chamfered box, plank UVs, and the wood pigment — a per-board stain, paler
 * worn arrises, darker end grain, a faint grain stripe.
 */
export function board(w: number, h: number, d: number, opts: { grain: 'x' | 'y' | 'z'; rng: Rng; chamfer?: number; shade?: number; tint?: Color; wobble?: number }): BufferGeometry {
  const g = chamferedBox(w, h, d, opts.chamfer ?? Math.min(w, h, d) * 0.18);
  if (opts.wobble) {
    // hand-hewn: each corner of the box moves by its own offset (all the vertices of the corner's
    // chamfer cluster together), so no two arrises stay parallel and the ends are not square
    const pos = g.attributes.position;
    const offsets: Vector3[] = [];
    for (let c = 0; c < 8; c++) offsets.push(new Vector3(opts.rng.range(-1, 1), opts.rng.range(-1, 1), opts.rng.range(-1, 1)).multiplyScalar(opts.wobble));
    for (let i = 0; i < pos.count; i++) {
      const c = (pos.getX(i) > 0 ? 1 : 0) + (pos.getY(i) > 0 ? 2 : 0) + (pos.getZ(i) > 0 ? 4 : 0);
      pos.setXYZ(i, pos.getX(i) + offsets[c].x, pos.getY(i) + offsets[c].y, pos.getZ(i) + offsets[c].z);
    }
    g.computeVertexNormals();
  }
  plankUV(g, { grain: opts.grain, column: opts.rng.int(0, PLANK_BOARDS), along: opts.rng.range(0, PLANK_METRES) });
  const stain = (opts.shade ?? 1) * opts.rng.range(0.88, 1.1);
  const tint = opts.tint ?? new Color(WOOD_TINT[0], WOOD_TINT[1], WOOD_TINT[2]);
  const warm = opts.rng.range(-0.03, 0.03);
  paint(g, (p, n) => {
    const bevel = bevelness(n);
    const endGrain = Math.abs(n[opts.grain]) > 0.9 ? 0.72 : 1;
    const stripe = 1 + 0.04 * Math.sin(p[opts.grain] * 90 + p.x * 7 + p.z * 5);
    const k = stain * endGrain * stripe * (1 + 0.22 * bevel);
    return [tint.r * k * (1 + warm), tint.g * k, tint.b * k * (1 - warm)];
  });
  return g;
}

/** a laid rope along `points`, the twist map running along its length */
export function rope(points: Vector3[], radius = 0.02, radial = 6, tubular?: number): BufferGeometry {
  const curve = new CatmullRomCurve3(points);
  const length = curve.getLength();
  const g = new TubeGeometry(curve, tubular ?? Math.max(4, Math.round(length / 0.045)), radius, radial, false);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (length / ROPE_REPEAT_METRES));
  const f = flat(g);
  paint(f, () => [1, 1, 1]);
  return f;
}

/** rope lashing: a few tight turns around an axis point */
export function lashing(centre: Vector3, axis: Vector3, radius: number, turns: number, tube = 0.011): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const q = alignUp(axis);
  for (let i = 0; i < turns; i++) {
    const g = flat(new TorusGeometry(radius, tube, 5, 12));
    // TorusGeometry lies in the xy plane around +z; alignUp maps +y, so pre-rotate the ring's axis onto +y
    g.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 6, uv.getY(k));
    paint(g, () => [0.96, 0.94, 0.9]);
    place(g, centre.clone().addScaledVector(axis, (i - (turns - 1) / 2) * tube * 2.1), q);
    out.push(g);
  }
  return out;
}

/** an iron nail head (a squat six-sided stud) on a face with outward normal `n` */
export function nail(at: Vector3, n: Vector3, r = 0.006): BufferGeometry {
  const g = flat(new CylinderGeometry(r * 0.8, r, 0.008, 6, 1));
  paint(g, () => [0.9, 0.86, 0.8]);
  place(g, at.clone().addScaledVector(n, 0.003), alignUp(n));
  return g;
}

// ---------------------------------------------------------------------------------------------
// pots

/**
 * Three thrown shapes, outer profile bottom → lip as (radius, height) at unit height. The rim
 * band is dark; the body is terracotta with a firing flash. The inner wall follows the outer at
 * the wall thickness down to a solid floor, so the mouth reads as a real cavity.
 */
const POT_PROFILES: { outer: [number, number][]; neck: number; wall: number; lipIn: number }[] = [
  // classic: full belly, short neck, rolled lip
  { outer: [[0.24, 0], [0.33, 0.035], [0.41, 0.13], [0.455, 0.29], [0.452, 0.45], [0.415, 0.59], [0.35, 0.71], [0.295, 0.79], [0.28, 0.85], [0.305, 0.915], [0.34, 0.965], [0.345, 1]], neck: 0.83, wall: 0.045, lipIn: 0.265 },
  // tall: narrower, a longer neck
  { outer: [[0.2, 0], [0.28, 0.03], [0.355, 0.12], [0.405, 0.28], [0.405, 0.42], [0.375, 0.56], [0.315, 0.68], [0.25, 0.78], [0.225, 0.85], [0.24, 0.92], [0.285, 0.97], [0.3, 1]], neck: 0.82, wall: 0.04, lipIn: 0.225 },
  // squat, wide mouth
  { outer: [[0.27, 0], [0.37, 0.04], [0.46, 0.15], [0.505, 0.32], [0.495, 0.48], [0.455, 0.62], [0.4, 0.74], [0.365, 0.82], [0.37, 0.9], [0.405, 0.96], [0.415, 1]], neck: 0.8, wall: 0.05, lipIn: 0.335 },
];

export interface PotStyle {
  body: Color;
  band: Color;
  /** second thin band at the shoulder (0 = none) */
  shoulder: number;
}

export const POT_BODY = 0xa96a3c;
export const POT_BAND = 0x4a332a;

export function potGeometry(rng: Rng, size: number, variant: number, style?: Partial<PotStyle>): Part[] {
  const prof = POT_PROFILES[((variant % POT_PROFILES.length) + POT_PROFILES.length) % POT_PROFILES.length];
  const body = style?.body ?? new Color(POT_BODY);
  const band = style?.band ?? new Color(POT_BAND);
  const shoulder = style?.shoulder ?? (variant === 1 ? 0 : 0.64);
  const pts: Vector2[] = [];
  // outer surface, bottom → lip
  pts.push(new Vector2(0, 0));
  for (const [r, y] of prof.outer) pts.push(new Vector2(r, y));
  // lip roll inward, then the inner wall back down to the floor
  const top = prof.outer[prof.outer.length - 1];
  pts.push(new Vector2(top[0] - 0.02, 1.012), new Vector2(prof.lipIn + 0.01, 1.008), new Vector2(prof.lipIn, 0.985));
  const inner = prof.outer.filter(([, y]) => y >= 0.16 && y <= 0.94).reverse();
  for (const [r, y] of inner) pts.push(new Vector2(Math.max(0.05, r - prof.wall), y));
  pts.push(new Vector2(0.14, 0.11), new Vector2(0, 0.11));
  // hand-thrown asymmetry: the radius wanders a little around the pot (and per pot)
  const wobble = rng.range(0.008, 0.02);
  const phase = rng.range(0, TAU);
  const segments = size > 0.6 ? 48 : 36;
  const lathe = new LatheGeometry(pts.map((p) => new Vector2(p.x * size, p.y * size)), segments);
  const pos = lathe.attributes.position;
  const uv = lathe.attributes.uv;
  const v = new Vector3();
  // each pot samples the clay map from its own offset, so the firing patches and slip drips
  // (periodic in the map) fall differently on every pot
  const uOff = rng.range(0, 1);
  const vOff = rng.range(0, 1);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 + wobble * Math.sin(a * 2 + phase) * Math.sin((v.y / size) * 3.1 + phase) + wobble * 0.5 * Math.sin(a * 3 - phase);
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
    // clay map: rings horizontal (v = height), the mottle twice around
    uv.setXY(i, uv.getX(i) * 2 + uOff, v.y / CLAY_REPEAT_METRES + vOff);
  }
  lathe.computeVertexNormals();
  const g = flat(lathe);
  const flash = rng.range(0.94, 1.08);
  const flashAngle = rng.range(0, TAU);
  const radial = new Vector3();
  paint(g, (p, n) => {
    const h = p.y / size;
    const a = Math.atan2(p.z, p.x);
    // firing flash: one side paler / warmer, the other a shade cooler (the kiln's draught side)
    const fl = flash * (1 + 0.11 * Math.cos(a - flashAngle));
    const c = new Color(body.r * fl, body.g * fl * (2 - fl) ** 0.3, body.b * fl * 0.97);
    const rim = smooth(prof.neck - 0.012, prof.neck + 0.012, h);
    let bandK = rim;
    if (shoulder > 0) bandK = Math.max(bandK, smooth(shoulder - 0.032, shoulder - 0.012, h) * (1 - smooth(shoulder + 0.012, shoulder + 0.032, h)));
    // inside the mouth (faces looking at the axis): the cavity stays dark
    radial.set(p.x, 0, p.z).normalize();
    const inside = n.dot(radial) < -0.2 && h > 0.1 ? 1 : 0;
    c.lerp(band, Math.max(bandK, inside * 0.7));
    // foot ring: unglazed, a shade lighter and rougher
    c.lerp(new Color(0.55, 0.42, 0.3), smooth(0.06, 0.0, h) * 0.35);
    return c;
  });
  return [{ geometry: g, material: 'clay' }];
}

// ---------------------------------------------------------------------------------------------
// crate

export function crateGeometry(rng: Rng, size: number): Part[] {
  const wood: BufferGeometry[] = [];
  const iron: BufferGeometry[] = [];
  const w = size;
  const d = size * rng.range(0.92, 1.0);
  const h = size * rng.range(0.78, 0.9);
  const t = size * 0.048; // board thickness
  const bat = size * 0.075; // batten
  const boards = h > 0.6 ? 5 : 4;
  const gap = 0.005;
  const bh = (h - (boards - 1) * gap) / boards;
  const shade = rng.range(0.9, 1.08);
  // corner battens, flush inside the boards
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const b = board(bat, h - 0.01, bat, { grain: 'y', rng, shade: shade * 0.95 });
      place(b, new Vector3(sx * (w / 2 - t - bat / 2), h / 2, sz * (d / 2 - t - bat / 2)));
      wood.push(b);
    }
  }
  // one board somewhere is a touch askew; one has slipped down a hair
  const askew = rng.int(0, boards * 4);
  let k = 0;
  for (let i = 0; i < boards; i++) {
    const y = bh / 2 + i * (bh + gap);
    for (const s of [-1, 1]) {
      // boards on the ±z faces span the full width; on the ±x faces they sit between them
      const bz = board(w, bh * rng.range(0.96, 1), t, { grain: 'x', rng, shade });
      const qz = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), k++ === askew ? rng.range(-0.05, 0.05) : 0);
      place(bz, new Vector3(0, y + rng.range(-0.002, 0.002), s * (d / 2 - t / 2)), qz);
      wood.push(bz);
      const bx = board(t, bh * rng.range(0.96, 1), d - 2 * t - 0.002, { grain: 'z', rng, shade });
      const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), k++ === askew ? rng.range(-0.05, 0.05) : 0);
      place(bx, new Vector3(s * (w / 2 - t / 2), y + rng.range(-0.002, 0.002), 0), qx);
      wood.push(bx);
      // nails through the boards into the battens
      for (const e of [-1, 1]) {
        iron.push(nail(new Vector3(e * (w / 2 - t - bat / 2), y + bh * 0.22, s * d / 2), new Vector3(0, 0, s)));
        iron.push(nail(new Vector3(s * w / 2, y - bh * 0.22, e * (d / 2 - t - bat / 2)), new Vector3(s, 0, 0)));
      }
    }
  }
  // lid: boards across, grain along x, one gap left a little wide. Round 56 (the owner's rubric,
  // #4 siblings with purpose / #19 sparse damage): about a third of the crates have lost one lid
  // board — never the two outermost, so the box still reads closed from 20 m — and the box shows
  // its floor through the gap; on another third one lid board has been knocked askew and lies
  // tilted on its neighbours.
  const lidBoards = 4;
  const lw = (d - (lidBoards - 1) * gap) / lidBoards;
  const wideGap = rng.int(0, lidBoards);
  const lost = rng.chance(0.35) ? rng.int(1, lidBoards - 1) : -1;
  const knocked = lost < 0 && rng.chance(0.5) ? rng.int(0, lidBoards) : -1;
  for (let i = 0; i < lidBoards; i++) {
    if (i === lost) continue;
    const b = board(w - 0.002, t, lw * (i === wideGap ? 0.9 : 0.985), { grain: 'x', rng, shade: shade * 1.04 });
    const tilt = i === knocked ? rng.pick([-1, 1]) * rng.range(0.1, 0.16) : 0;
    const q = tilt ? new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), tilt) : undefined;
    place(b, new Vector3(0, h + t / 2 + (tilt ? Math.abs(Math.sin(tilt)) * lw * 0.5 : 0), -d / 2 + lw / 2 + i * (lw + gap) + (tilt ? Math.sign(tilt) * lw * 0.12 : 0)), q);
    wood.push(b);
  }
  // floor boards (seen through no gap, but they close the box from any low angle)
  for (let i = 0; i < 3; i++) {
    const b = board(w - 2 * t - 0.004, t, (d - 2 * t) / 3 - gap, { grain: 'x', rng, shade: shade * 0.8 });
    place(b, new Vector3(0, t / 2, -(d - 2 * t) / 2 + (d - 2 * t) / 6 + i * ((d - 2 * t) / 3)));
    wood.push(b);
  }
  return [...wood.map((g) => ({ geometry: g, material: 'wood' as MaterialKey })), ...iron.map((g) => ({ geometry: g, material: 'iron' as MaterialKey }))];
}

// ---------------------------------------------------------------------------------------------
// barrel / bucket — coopered staves

function staveGeometry(rng: Rng, radiusAt: (y: number) => number, h: number, count: number, thickness: number, shade: number, column0: number): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const gapA = 0.006; // radians between staves
  const stepA = TAU / count;
  const steps = 7;
  for (let i = 0; i < count; i++) {
    const pts: Vector2[] = [];
    for (let s = 0; s <= steps; s++) pts.push(new Vector2(radiusAt((s / steps) * h), (s / steps) * h));
    for (let s = steps; s >= 0; s--) pts.push(new Vector2(radiusAt((s / steps) * h) - thickness, (s / steps) * h));
    const a0 = i * stepA + gapA / 2 + rng.range(-0.002, 0.002);
    const lathe = new LatheGeometry(pts, 2, a0, stepA - gapA);
    // uv: one board column per stave, the grain up the stave
    const uv = lathe.attributes.uv;
    const pos = lathe.attributes.position;
    const col = ((column0 + i) % PLANK_BOARDS) / PLANK_BOARDS;
    const arc = radiusAt(h / 2) * (stepA - gapA);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, col + (uv.getX(k) * arc) / PLANK_METRES, pos.getY(k) / PLANK_METRES + i * 0.37);
    lathe.computeVertexNormals();
    const g = flat(lathe);
    const stain = shade * rng.range(0.9, 1.08);
    paint(g, (p, n) => {
      const r = Math.hypot(p.x, p.z);
      const inner = r < radiusAt(p.y) - thickness * 0.5 ? 0.8 : 1;
      const edge = Math.abs(n.y) > 0.9 ? 0.75 : 1;
      const k = stain * inner * edge;
      return [WOOD_TINT[0] * k, WOOD_TINT[1] * k, WOOD_TINT[2] * k];
    });
    out.push(g);
  }
  return out;
}

function hoop(radius: number, y: number, height: number, thickness = 0.006): BufferGeometry {
  const g = flat(new CylinderGeometry(radius + thickness, radius + thickness, height, 28, 1, true));
  paint(g, (p) => {
    const k = 0.85 + 0.15 * Math.sin(Math.atan2(p.z, p.x) * 5);
    return [k, k, k];
  });
  place(g, new Vector3(0, y, 0));
  return g;
}

export function barrelGeometry(rng: Rng, size: number): Part[] {
  const h = size;
  const r0 = size * 0.34;
  const bulge = rng.range(0.1, 0.14);
  const radiusAt = (y: number) => r0 * (1 + bulge * Math.sin((y / h) * Math.PI));
  const shade = rng.range(0.92, 1.06);
  const wood = staveGeometry(rng, radiusAt, h, 18, size * 0.03, shade, rng.int(0, PLANK_BOARDS));
  // lid: a disc of boards (planar plank uvs, grain along x)
  const lidR = radiusAt(h) - size * 0.006;
  const lid = flat(new CylinderGeometry(lidR, lidR, size * 0.03, 32));
  plankUV(lid, { grain: 'x', column: rng.int(0, PLANK_BOARDS), along: rng.range(0, PLANK_METRES) });
  paint(lid, (p, n) => {
    const boardIdx = Math.floor((p.z + lidR) / (lidR * 2) * 4.999);
    const seam = Math.abs(((p.z + lidR) / (lidR * 2) * 5) % 1 - 0.5) > 0.47 ? 0.7 : 1;
    const k = shade * (0.9 + 0.05 * (boardIdx % 3)) * seam * (Math.abs(n.y) > 0.9 ? 1 : 0.85);
    return [WOOD_TINT[0] * k, WOOD_TINT[1] * k, WOOD_TINT[2] * k];
  });
  place(lid, new Vector3(0, h - size * 0.015, 0));
  wood.push(lid);
  const iron = [0.09, 0.3, 0.7, 0.91].map((f) => hoop(radiusAt(f * h), f * h, size * 0.035));
  return [...wood.map((g) => ({ geometry: g, material: 'wood' as MaterialKey })), ...iron.map((g) => ({ geometry: g, material: 'iron' as MaterialKey }))];
}

export function bucketGeometry(rng: Rng, size: number): Part[] {
  const h = 0.66 * size;
  const radiusAt = (y: number) => 0.26 * size + 0.08 * size * (y / h);
  const shade = rng.range(0.92, 1.06);
  const wood = staveGeometry(rng, radiusAt, h, 14, size * 0.035, shade, rng.int(0, PLANK_BOARDS));
  const floor = flat(new CylinderGeometry(radiusAt(0.03) - size * 0.03, radiusAt(0.03) - size * 0.03, 0.03, 20));
  plankUV(floor, { grain: 'x', column: rng.int(0, PLANK_BOARDS), along: rng.range(0, PLANK_METRES) });
  paint(floor, () => [WOOD_TINT[0] * 0.8 * shade, WOOD_TINT[1] * 0.8 * shade, WOOD_TINT[2] * 0.8 * shade]);
  place(floor, new Vector3(0, 0.035, 0));
  wood.push(floor);
  const iron = [0.16, 0.82].map((f) => hoop(radiusAt(f * h), f * h, size * 0.03));
  // rope handle over the top
  const handle = rope([new Vector3(-0.33 * size, 0.6 * size, 0), new Vector3(-0.31 * size, 0.92 * size, 0), new Vector3(0, 1.06 * size, 0), new Vector3(0.31 * size, 0.92 * size, 0), new Vector3(0.33 * size, 0.6 * size, 0)], 0.016);
  return [...wood.map((g) => ({ geometry: g, material: 'wood' as MaterialKey })), ...iron.map((g) => ({ geometry: g, material: 'iron' as MaterialKey })), { geometry: handle, material: 'rope' }];
}

// ---------------------------------------------------------------------------------------------
// wooden waymarker

/**
 * A Kokiri waymarker at a path's mouth, `size` tall: a squared post with a diamond cap, two
 * crossboards lashed to it at different heights and angles (the long one points along +z, the
 * way the path goes), nail studs, and a small wooden tag hanging on a rope from the long board's
 * end. Same wood, rope and iron as the fences, the ladder and the crates. Stands vertical; the
 * foot (lowest 10 cm) is conformed to the ground by index.ts.
 */
export function markerGeometry(rng: Rng, size: number): Part[] {
  const parts: Part[] = [];
  const push = (geometry: BufferGeometry, material: MaterialKey) => parts.push({ geometry, material });
  const w = 0.15 * (size / 1.7);
  const post = board(w, size, w, { grain: 'y', rng, chamfer: w * 0.12, shade: 0.94, wobble: w * 0.035 });
  place(post, new Vector3(0, size / 2, 0));
  push(post, 'wood');
  // the cap: a shallow block turned 45° on the post's head
  const cap = board(w * 1.55, w * 0.55, w * 1.55, { grain: 'x', rng, chamfer: w * 0.2, shade: 0.9 });
  place(cap, new Vector3(0, size + w * 0.27, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4));
  push(cap, 'wood');
  // crossboards: long one at 0.72 of the height pointing along +z, a short one above, turned away
  const boards: { y: number; len: number; yaw: number; dir: number }[] = [
    { y: size * 0.72, len: 0.66 * (size / 1.7), yaw: rng.range(-0.12, 0.12), dir: 1 },
    { y: size * 0.86, len: 0.44 * (size / 1.7), yaw: 0.9 + rng.range(-0.15, 0.15), dir: -1 },
  ];
  const up = new Vector3(0, 1, 0);
  for (const b of boards) {
    const q = new Quaternion().setFromAxisAngle(up, b.yaw);
    const thick = w * 0.3;
    // hewn, not milled: the arrises wander and the ends are not square (fable-5: "crossboards clean-edged")
    const g = board(w * 0.85, w * 0.9, b.len, { grain: 'z', rng, chamfer: thick * 0.45, shade: 1.04, wobble: w * 0.05 });
    // the board sits against the post's face and runs out along dir·z, tapering slightly upward at the tip
    const centre = new Vector3(0, b.y, b.dir * (w / 2 + b.len / 2 - w * 0.2)).applyQuaternion(q);
    const tip = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -b.dir * 0.04);
    place(g, centre, q.clone().multiply(tip));
    push(g, 'wood');
    // lashing around the post at the board's height, and a nail through the board's root
    for (const t of lashing(new Vector3(0, b.y, 0), up, w * 0.78, 3, 0.011)) push(t, 'rope');
    const nAt = new Vector3(w * 0.43, b.y + w * 0.1, b.dir * (w / 2 + w * 0.25)).applyQuaternion(q);
    push(nail(nAt, new Vector3(1, 0, 0).applyQuaternion(q), 0.007), 'iron');
  }
  // the tag: a small board hanging from the long crossboard's tip on a rope loop
  const long = boards[0];
  const q0 = new Quaternion().setFromAxisAngle(up, long.yaw);
  const tipZ = w / 2 + long.len - w * 0.3;
  const hang = 0.11 * (size / 1.7);
  const tagH = 0.17 * (size / 1.7);
  const tagSway = rng.range(-0.25, 0.25);
  const tag = board(w * 0.95, tagH, w * 0.16, { grain: 'y', rng, chamfer: w * 0.03, shade: 1.08, wobble: w * 0.02 });
  const tagCentre = new Vector3(0, long.y - w * 0.45 - hang - tagH / 2, tipZ).applyQuaternion(q0);
  place(tag, tagCentre, q0.clone().multiply(new Quaternion().setFromAxisAngle(up, tagSway)));
  push(tag, 'wood');
  const loopTop = new Vector3(0, long.y + w * 0.45 + 0.012, tipZ).applyQuaternion(q0);
  const loopBottom = new Vector3(0, long.y - w * 0.45 - hang + 0.01, tipZ).applyQuaternion(q0);
  const side = new Vector3(w * 0.5, 0, 0).applyQuaternion(q0);
  // one strand up each side of the board and over its top edge (an inverted U the tag hangs from)
  push(rope([loopBottom.clone().sub(side), loopTop.clone().sub(side), loopTop.clone().add(side), loopBottom.clone().add(side)], 0.008, 5), 'rope');
  return parts;
}

// ---------------------------------------------------------------------------------------------
// light string

export interface LightStringSpec {
  /** peg feet in the prop's frame (x, groundY, z), in order along the string */
  pegs: Vector3[];
  /** cord height above each peg's foot (m) */
  lift: number;
  /** mid-span droop of the cord (m) */
  sag: number;
  /** pod spacing along each span (m) */
  spacing: number;
  /** pod radius (m) */
  podRadius: number;
}

/**
 * The demo's string of small lights along a bank: short stakes, a thin cord drooping between
 * them, and glowing pods hung under the cord every `spacing`. Built in the prop's frame with
 * the pegs' feet already on the sampled ground (index.ts passes them); each peg's foot
 * vertices are recorded as `contactIndices` so the world pass re-seats them exactly.
 */
export function lightStringGeometry(rng: Rng, spec: LightStringSpec): Part[] {
  const parts: Part[] = [];
  const push = (geometry: BufferGeometry, material: MaterialKey) => parts.push({ geometry, material });
  const tops: Vector3[] = [];
  const last = spec.pegs.length - 1;
  spec.pegs.forEach((foot, k) => {
    const h = spec.lift + rng.range(-0.02, 0.02);
    // the demo's strings hover along the bank with no visible support: one slim stake at each end
    // carries the cord, the points between only shape it (a stake at every node read as a row
    // of dark sticks in the foreground of frames whose reference shows none)
    if (k === 0 || k === last) {
      const peg = board(0.028, h + 0.08, 0.028, { grain: 'y', rng, chamfer: 0.004, shade: 0.8 });
      const q = new Quaternion().setFromAxisAngle(new Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize(), rng.range(0, 0.07));
      place(peg, new Vector3(foot.x, foot.y + h / 2 - 0.03, foot.z), q);
      const pos = peg.attributes.position;
      const contact: number[] = [];
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) < foot.y + 0.04) contact.push(i);
      peg.userData.contactIndices = contact;
      push(peg, 'wood');
    }
    tops.push(new Vector3(foot.x, foot.y + h, foot.z));
  });
  const podColour: [number, number, number] = [1, 1, 1];
  for (let s = 0; s + 1 < tops.length; s++) {
    const a = tops[s];
    const b = tops[s + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= spec.sag * (0.85 + rng.range(0, 0.3));
    const curve = new CatmullRomCurve3([a, mid, b]);
    const cord = rope([a, mid, b], 0.005, 4);
    tintBy(cord, () => [0.42, 0.4, 0.3]);
    push(cord, 'rope');
    const len = curve.getLength();
    const n = Math.max(1, Math.round(len / spec.spacing));
    for (let i = 1; i <= n; i++) {
      const t = (i - 0.5) / n;
      const p = curve.getPointAt(t);
      const r = spec.podRadius * rng.range(0.9, 1.1);
      const pod = flat(new SphereGeometry(r, 7, 5));
      pod.scale(1, 1.25, 1);
      paint(pod, () => podColour);
      place(pod, new Vector3(p.x, p.y - r * 1.25 - 0.012, p.z));
      push(pod, 'glow');
      // the short stem from the cord to the pod
      const stem = rope([new Vector3(p.x, p.y + 0.002, p.z), new Vector3(p.x, p.y - 0.014, p.z)], 0.003, 3, 1);
      tintBy(stem, () => [0.42, 0.4, 0.3]);
      push(stem, 'rope');
    }
  }
  return parts;
}

// ---------------------------------------------------------------------------------------------
// rope-and-plank ladder

export interface LadderSpec {
  /** rail spacing (m) */
  width: number;
  /** height of the top peg above the foot (m) */
  height: number;
  /** horizontal run from the feet (z = 0) back to the trunk contact (+z) — the lean */
  lean: number;
  /** ground height under each rail foot relative to the ladder origin (left, right) */
  footY: [number, number];
  /** how far the peg is driven into the trunk beyond the rails' contact (m) */
  pegDepth: number;
}

/** local frame: origin at the foot midpoint, rails at x = ±width/2, the trunk toward +z */
export function ladderGeometry(rng: Rng, spec: LadderSpec): Part[] {
  const parts: Part[] = [];
  const hw = spec.width / 2;
  const top = new Vector3(0, spec.height, spec.lean);
  const rungs = Math.max(3, Math.floor(spec.height / 0.31));
  const railPts = (side: number) => {
    const foot = new Vector3(side * hw, spec.footY[side < 0 ? 0 : 1] - 0.03, 0);
    const pts: Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const p = foot.clone().lerp(new Vector3(side * hw, top.y, top.z), t);
      // the rope bows outward a little between the peg and the ground
      p.x += side * 0.02 * Math.sin(t * Math.PI);
      pts.push(p);
    }
    // over the peg
    pts.push(new Vector3(side * hw, top.y + 0.04, top.z + 0.06));
    return pts;
  };
  for (const side of [-1, 1]) parts.push({ geometry: rope(railPts(side), 0.013, 6), material: 'rope' });
  // crossbar the rails hang from, held against the bark by two pegs driven into the trunk
  const barY = top.y + 0.04;
  const barZ = top.z + 0.02;
  const woodPaint = (g: BufferGeometry) =>
    paint(g, (_p, n) => {
      const k = Math.abs(n.y) > 0.9 ? 0.68 : 0.95;
      return [WOOD_TINT[0] * 0.95 * k, WOOD_TINT[1] * 0.95 * k, WOOD_TINT[2] * 0.95 * k];
    });
  const bar = flat(new CylinderGeometry(0.03, 0.033, spec.width + 0.26, 10));
  plankUV(bar, { grain: 'y', column: rng.int(0, PLANK_BOARDS), along: rng.range(0, PLANK_METRES) });
  woodPaint(bar);
  place(bar, new Vector3(0, barY, barZ), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
  parts.push({ geometry: bar, material: 'wood' });
  for (const side of [-1, 1]) {
    const pegLen = spec.pegDepth + 0.08;
    const peg = flat(new CylinderGeometry(0.022, 0.026, pegLen, 8));
    plankUV(peg, { grain: 'y', column: rng.int(0, PLANK_BOARDS), along: rng.range(0, PLANK_METRES) });
    woodPaint(peg);
    place(peg, new Vector3(side * (hw + 0.05), barY, barZ + pegLen / 2 - 0.02), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
    parts.push({ geometry: peg, material: 'wood' });
    for (const g of lashing(new Vector3(side * hw, barY, barZ), new Vector3(1, 0, 0), 0.045, 3)) parts.push({ geometry: g, material: 'rope' });
  }
  // rungs: boards tied between the rails
  for (let i = 1; i <= rungs; i++) {
    const t = (i - 0.35) / (rungs + 0.4);
    const y = spec.footY[0] * 0.5 + spec.footY[1] * 0.5 + (top.y - 0.12) * t;
    const z = top.z * t - 0.02;
    const rung = board(spec.width + 0.09, 0.03, 0.075, { grain: 'x', rng, chamfer: 0.006 });
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.atan2(spec.lean, spec.height)).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rng.range(-0.03, 0.03)));
    place(rung, new Vector3(rng.range(-0.006, 0.006), y, z), q);
    parts.push({ geometry: rung, material: 'wood' });
    for (const side of [-1, 1]) for (const g of lashing(new Vector3(side * hw, y, z), new Vector3(1, 0, 0), 0.032, 2, 0.009)) parts.push({ geometry: g, material: 'rope' });
  }
  return parts;
}

// ---------------------------------------------------------------------------------------------
// platform with a rope railing

export interface PlatformSpec {
  /** deck size (m): x = along the railing, z = depth */
  width: number;
  depth: number;
  /** deck height above the origin (m) */
  deck: number;
  /** ground height (relative to the origin) at each post foot: fn(x, z) */
  groundAt: (x: number, z: number) => number;
  /** railing on the −z side (the lip) and the two short sides; open at +z (the step-on side) */
  rail: boolean;
  /** ladder from the +z side down to the ground (tall decks) */
  ladder: boolean;
  /** stacked block steps up the +z side (low decks) */
  steps?: number;
  /**
   * the deck is somebody else's stone slab whose top is at `deck`: no joists or boards, the
   * railing posts rise from the turf through the stone (inset from its bevelled edge), the
   * steps on the ground beside it
   */
  slab?: boolean;
}

/**
 * Pull a post's foot vertices (below `below`) onto the sampled ground and remember them as
 * `userData.contactIndices` — index.ts re-seats exactly those on the world heightfield.
 */
function groundFoot(geometry: BufferGeometry, below: number, groundAt: (x: number, z: number) => number): void {
  const pos = geometry.attributes.position;
  const contact: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) >= below) continue;
    pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)) - 0.01);
    contact.push(i);
  }
  geometry.computeVertexNormals();
  geometry.userData.contactIndices = contact;
}

export function platformGeometry(rng: Rng, spec: PlatformSpec): Part[] {
  const parts: Part[] = [];
  const hx = spec.width / 2;
  const hz = spec.depth / 2;
  const deckY = spec.deck;
  const postW = 0.11;
  const slab = spec.slab === true;
  // post insets from the deck edge; on a stone slab the posts stay clear of its bevel and chips
  const ix = slab ? 0.2 : 0.09;
  const iz = slab ? 0.18 : 0.08;
  const push = (geometry: BufferGeometry, material: MaterialKey) => parts.push({ geometry, material });
  const feet: [number, number][] = [[-hx + ix, -hz + iz], [hx - ix, -hz + iz], [-hx + ix, hz - iz], [hx - ix, hz - iz]];
  if (slab) {
    // the railing's four posts, all one height over the slab, run from the turf up THROUGH the
    // stone: set into the slab where it is drawn, standing on the ground where the slab is hidden
    // by distance (hardscape draws its north flagstones, dais included, only near the clearing)
    if (spec.rail) {
      for (const [px, pz] of feet) {
        const gy = spec.groundAt(px, pz) - 0.06;
        const top = deckY + 0.88 + rng.range(-0.02, 0.02);
        const post = board(0.1, top - gy, 0.1, { grain: 'y', rng, chamfer: 0.012 });
        place(post, new Vector3(px, (top + gy) / 2, pz));
        groundFoot(post, gy + 0.08, spec.groundAt);
        push(post, 'wood');
      }
    }
  } else {
    // posts, each to its own ground
    for (const [px, pz] of feet) {
      const gy = spec.groundAt(px, pz) - 0.06;
      const postTop = spec.rail && pz < 0 ? deckY + 0.86 : deckY + 0.05;
      const post = board(postW, postTop - gy, postW, { grain: 'y', rng, chamfer: 0.012 });
      place(post, new Vector3(px, (postTop + gy) / 2, pz));
      groundFoot(post, gy + 0.08, spec.groundAt);
      push(post, 'wood');
    }
    // joists (two, along x under the deck edges) and bearers (across, under the boards)
    for (const pz of [-hz + 0.08, hz - 0.08]) {
      const j = board(spec.width - 0.02, 0.1, 0.09, { grain: 'x', rng });
      place(j, new Vector3(0, deckY - 0.075, pz));
      push(j, 'wood');
    }
    // deck boards across (grain along z), irregular widths and gaps
    let x = -hx;
    let n = 0;
    while (x < hx - 0.02) {
      const bw = Math.min(hx - x, rng.range(0.15, 0.21));
      const b = board(bw - 0.006, 0.035, spec.depth + rng.range(-0.02, 0.05), { grain: 'z', rng, shade: 1 + 0.04 * (n % 3) });
      place(b, new Vector3(x + bw / 2, deckY + 0.0175, rng.range(-0.01, 0.01)));
      push(b, 'wood');
      x += bw;
      n++;
    }
  }
  if (spec.rail) {
    // rail posts at the front corners already rise; two rope courses between them and along the
    // short sides down to the posts at the back corners (short ones on a deck of our own)
    if (!slab) {
      const backTop = deckY + 0.05;
      for (const px of [-hx + ix, hx - ix]) {
        const p = board(0.085, 0.82, 0.085, { grain: 'y', rng, chamfer: 0.01 });
        place(p, new Vector3(px, backTop + 0.41 - 0.05, hz - iz));
        push(p, 'wood');
      }
    }
    for (const h of [0.42, 0.78]) {
      const y = deckY + h;
      const sag = 0.05 + 0.03 * h;
      // front course
      push(rope([new Vector3(-hx + ix, y, -hz + iz), new Vector3(0, y - sag, -hz + iz), new Vector3(hx - ix, y, -hz + iz)], 0.02), 'rope');
      // sides
      for (const sx of [-1, 1]) push(rope([new Vector3(sx * (hx - ix), y, -hz + iz), new Vector3(sx * (hx - ix), y - sag * 0.8, 0), new Vector3(sx * (hx - ix), y, hz - iz)], 0.02), 'rope');
      for (const [px, pz] of feet) for (const g of lashing(new Vector3(px, y, pz), new Vector3(0, 1, 0), 0.075, 3)) push(g, 'rope');
    }
  }
  if (spec.steps) {
    // stacked block steps against the back edge, each a short tread on its own grounded riser;
    // the rise is measured from the turf at the step, not at the origin (the lip falls away)
    const n = spec.steps;
    for (let i = 0; i < n; i++) {
      const z0 = hz + (slab ? 0.07 : 0.02) + i * 0.32;
      const gy = spec.groundAt(0, z0 + 0.15);
      const top = gy + ((deckY - gy) * (n - i)) / (n + 1);
      const riser = board(0.72, top - gy + 0.02, 0.3, { grain: 'x', rng, chamfer: 0.01, shade: 0.9 });
      place(riser, new Vector3(0, (top + gy - 0.02) / 2, z0 + 0.15));
      groundFoot(riser, gy + 0.06, spec.groundAt);
      push(riser, 'wood');
      const tread = board(0.78, 0.04, 0.34, { grain: 'x', rng, chamfer: 0.008, shade: 1.05 });
      place(tread, new Vector3(0, top + 0.02, z0 + 0.15));
      push(tread, 'wood');
    }
  }
  if (spec.ladder) {
    // ladder from the back edge down to the ground: two rails and rungs
    const zTop = hz - 0.02;
    const zBottom = hz + deckY * 0.55;
    for (const px of [-0.28, 0.28]) {
      const gy = spec.groundAt(px, zBottom);
      const a = new Vector3(px, gy - 0.02, zBottom);
      const b = new Vector3(px, deckY + 0.15, zTop);
      const len = a.distanceTo(b);
      const rail = board(0.07, len, 0.07, { grain: 'y', rng, chamfer: 0.008 });
      place(rail, a.clone().add(b).multiplyScalar(0.5), alignUp(b.clone().sub(a)));
      groundFoot(rail, gy + 0.06, spec.groundAt);
      push(rail, 'wood');
    }
    const rungs = Math.max(3, Math.round(deckY / 0.28));
    for (let i = 1; i <= rungs; i++) {
      const t = i / (rungs + 1);
      const gy = (spec.groundAt(-0.28, zBottom) + spec.groundAt(0.28, zBottom)) / 2;
      const y = gy + (deckY + 0.15 - gy) * t;
      const z = zBottom + (zTop - zBottom) * t;
      const r = board(0.62, 0.035, 0.06, { grain: 'x', rng, chamfer: 0.006 });
      place(r, new Vector3(0, y, z), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.atan2(zBottom - zTop, deckY)));
      push(r, 'wood');
    }
  }
  return parts;
}
