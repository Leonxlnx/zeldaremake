/**
 * Round 57 (expansion-ruins): the trail's pod lanterns (layout `EXPANSION_RUINS.lanterns`) — the
 * village's lantern-post design (concept sheets 02/04/05) leading into the valley: a bent, rough
 * wooden post whose top hooks over toward the path, wedged at its foot by a few stones, the hook
 * lashed with rope, a vine strand trailing off the crook; from the hook a pod hangs on a cord.
 *
 * The pod follows the village's crafted husk: six bulging segments with a groove on every seam,
 * bent-wood ribs over the seams, a hoop round the open bottom and a band under the calyx; through
 * the opening a flame stands on a wick cup slung from the hoop on three spokes. A scalloped calyx
 * with a sepal on every segment, a knuckled stem, a leaf collar, a two-turn hitch and a knot.
 *
 * Light: the husk glows on the palette's lantern gradient (bottom hottest, deeper toward the cap,
 * the seams passing less), the same recipe and intensity as the village's pods, so the bloom
 * carries it; every dark part rides a black row of the same map. No light source — a soft warm
 * pool is drawn on the ground under each pod instead. Three draws for all the lanterns: the posts
 * (bark), the pods with their dark parts, the pools; the foot stones join the ruins' boulders.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  ClampToEdgeWrapping,
  Color,
  type Curve,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineCurve3,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
} from 'three';
import { EXPANSION_RUINS } from '../layout';
import type { TextureLibrary } from '../materials/textures';
import type { Caster } from '../util/expansionLocality';
import { Noise2D, lerp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { MeshBuilder, block, lathe, type RGB } from './geom';
import type { Blocker } from './masonry';
import { outcropSkin } from './rock';

type Ground = (x: number, z: number) => number;

const TAU = Math.PI * 2;
/** the husk's segments */
const SEGS = 6;
/** uv v of every dark part (cap, sepals, frame, stem, cord, rope, leaves): the emissive map is black there */
const DARK_V = 0.95;
/** the husk's rows land on v BODY_V0 (the open bottom, hottest) … BODY_V1 (under the calyx) */
const BODY_V0 = 0.02;
const BODY_V1 = 0.78;
/** the gradient's rows are black from here up (the village's pod atlas: POD_BODY_V) */
const GLOW_TOP_V = 0.8;

/** the husk's profile (radius, height) at scale 1, bottom (the opening) to top — the village pod's */
const BODY_KEYS: [number, number][] = [
  [0.058, 0.032],
  [0.074, 0.046],
  [0.1, 0.075],
  [0.135, 0.14],
  [0.148, 0.2],
  [0.14, 0.255],
  [0.115, 0.295],
  [0.08, 0.315],
];
const BODY_ROWS = 16;
const BODY: [number, number][] = (() => {
  const c = new CatmullRomCurve3(
    BODY_KEYS.map(([r, y]) => new Vector3(r, y, 0)),
    false,
    'centripetal',
  );
  return Array.from({ length: BODY_ROWS + 1 }, (_, k) => {
    const p = c.getPointAt(k / BODY_ROWS);
    return [p.x, p.y] as [number, number];
  });
})();
const CAP: [number, number][] = [
  [0.126, 0.266],
  [0.152, 0.276],
  [0.164, 0.296],
  [0.156, 0.318],
  [0.13, 0.338],
  [0.092, 0.355],
  [0.045, 0.368],
  [0, 0.372],
];
const FLAME: [number, number][] = [
  [0, 0.04],
  [0.012, 0.052],
  [0.016, 0.068],
  [0.011, 0.09],
  [0.004, 0.106],
  [0, 0.113],
];
const CUP: [number, number][] = [
  [0, 0.028],
  [0.02, 0.03],
  [0.024, 0.042],
  [0.02, 0.045],
];
const STEM_TOP = 0.445;

/** the husk's radius at height y (scale 1) on its smooth profile */
function bodyRadius(y: number): number {
  if (y <= BODY[0][1]) return BODY[0][0];
  for (let k = 1; k < BODY.length; k++) {
    if (y <= BODY[k][1]) {
      const t = (y - BODY[k - 1][1]) / (BODY[k][1] - BODY[k - 1][1]);
      return lerp(BODY[k - 1][0], BODY[k][0], t);
    }
  }
  return BODY[BODY.length - 1][0];
}

/** 0 on a seam, 0.5 mid-segment */
function seamDistance(theta: number): number {
  const phi = ((((theta / TAU) * SEGS) % 1) + 1) % 1;
  return Math.min(phi, 1 - phi);
}

/** the segmented husk: a groove on every seam, the segments bulging between, both fading at the opening */
function huskRadius(theta: number, y: number, r: number): number {
  const d = seamDistance(theta);
  const fade = smoothstep(0.034, 0.08, y);
  return r * (1 - 0.1 * Math.exp(-((d / 0.07) ** 2)) * fade) * (1 + 0.045 * Math.sin(Math.PI * d) * fade);
}

/**
 * The pods' emissive map (64 × 64, v up): the village's gradient — the palette glow brighter and
 * yellower at the bottom, deeper toward the cap, heat (1 − v / 0.85)^1.4 — times a husk field (the
 * seams pass less, the thin skin mid-segment more, faint slanted side veins) normalised to mean 1
 * per row and the village's constant 0.95, so the pods integrate to the village's radiance. Rows
 * from GLOW_TOP_V up are black. Bytes are the colour's linear components under an sRGB tag, as
 * the village's canvas is.
 */
function podEmissiveMap(glow: number): DataTexture {
  const W = 64;
  const H = 64;
  const base = new Color(glow);
  const bottom = [Math.min(1, base.r * 1.02), Math.min(1, base.g * 1.12), Math.min(1, base.b * 1.3)];
  const top = [base.r * 0.86, base.g * 0.5, base.b * 0.35];
  const data = new Uint8Array(W * H * 4);
  const field = new Float32Array(W);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    const row = y * W * 4;
    for (let x = 0; x < W; x++) data[row + x * 4 + 3] = 255;
    if (v >= GLOW_TOP_V) continue;
    let mean = 0;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const phi = (u * SEGS) % 1;
      const d = Math.min(phi, 1 - phi);
      const seam = 1 - 0.6 * Math.exp(-((d / 0.055) ** 2));
      const vein = 1 - 0.14 * Math.pow(Math.max(0, Math.cos(TAU * (d * 2.2 + v * 6))), 8);
      field[x] = seam * vein * (1 + 0.12 * Math.sin(Math.PI * d * 2));
      mean += field[x] / W;
    }
    const heat = Math.pow(1 - v / 0.85, 1.4);
    for (let x = 0; x < W; x++) {
      const k = (0.95 * field[x]) / mean;
      for (let c = 0; c < 3; c++) data[row + x * 4 + c] = Math.min(255, Math.round((top[c] + (bottom[c] - top[c]) * heat) * k * 255));
    }
  }
  const tex = new DataTexture(data, W, H);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.name = 'ruins:pod-glow';
  tex.needsUpdate = true;
  return tex;
}

/** set uv of vertices [from, mb.vertexCount) */
function setUv(mb: MeshBuilder, from: number, fn: (k: number, u: number, v: number) => [number, number]): void {
  for (let k = from; k < mb.vertexCount; k++) {
    const [u, v] = fn(k, mb.uv[k * 2], mb.uv[k * 2 + 1]);
    mb.uv[k * 2] = u;
    mb.uv[k * 2 + 1] = v;
  }
}

/**
 * A tube along `curve` (arc-length parameter t, Frenet frames), `radial` around: radius(t) plus
 * displace(t, angle) (periodic in the angle), colour(t, angle), uv(t, angle). Smooth normals, the
 * seam's normals averaged; `capEnd` closes the t = 1 end.
 */
function tube(
  mb: MeshBuilder,
  curve: Curve<Vector3>,
  segs: number,
  radial: number,
  radius: (t: number) => number,
  color: (t: number, a: number) => RGB,
  uv: (t: number, a: number) => [number, number],
  displace?: (t: number, a: number) => number,
  capEnd = false,
): void {
  const frames = curve.computeFrenetFrames(segs, false);
  const start = mb.vertexCount;
  const tri0 = mb.idx.length;
  const ringAt = (j: number, i: number) => {
    const t = j / segs;
    const a = (i / radial) * TAU;
    const r = radius(t) + (displace ? displace(t, a) : 0);
    return curve
      .getPointAt(t)
      .addScaledVector(frames.normals[j], r * Math.cos(a))
      .addScaledVector(frames.binormals[j], r * Math.sin(a));
  };
  mb.grid(radial, segs, (u, v) => {
    const j = Math.round(v * segs);
    const i = Math.round(u * radial);
    return { p: ringAt(j, i), c: color(j / segs, (i / radial) * TAU) };
  });
  setUv(mb, start, (k) => {
    const j = Math.floor((k - start) / (radial + 1));
    const i = (k - start) % (radial + 1);
    return uv(j / segs, (i / radial) * TAU);
  });
  mb.smoothNormals(start, mb.vertexCount, tri0);
  const N = mb.nrm;
  for (let j = 0; j <= segs; j++) {
    const a = start + j * (radial + 1);
    const b = a + radial;
    const n = new Vector3(N[a * 3] + N[b * 3], N[a * 3 + 1] + N[b * 3 + 1], N[a * 3 + 2] + N[b * 3 + 2]).normalize();
    for (const v of [a, b]) {
      N[v * 3] = n.x;
      N[v * 3 + 1] = n.y;
      N[v * 3 + 2] = n.z;
    }
  }
  if (capEnd) {
    const pts = Array.from({ length: radial }, (_, i) => ringAt(segs, i));
    const from = mb.vertexCount;
    mb.poly(pts, frames.tangents[segs], color(1, 0));
    setUv(mb, from, () => uv(1, 0));
  }
}

/** a torus round `axis` through `centre`: ring radius R, tube radius r */
function ring(mb: MeshBuilder, centre: Vector3, axis: Vector3, R: number, r: number, segs: number, rsegs: number, c: RGB): void {
  const ax = axis.clone().normalize();
  const e1 = Math.abs(ax.y) < 0.9 ? new Vector3(0, 1, 0).cross(ax).normalize() : new Vector3(1, 0, 0).cross(ax).normalize();
  const e2 = ax.clone().cross(e1);
  const start = mb.vertexCount;
  const tri0 = mb.idx.length;
  mb.grid(segs, rsegs, (u, v) => {
    const th = u * TAU;
    const ph = v * TAU;
    const rho = new Vector3().addScaledVector(e1, Math.cos(th)).addScaledVector(e2, Math.sin(th));
    return { p: centre.clone().addScaledVector(rho, R + r * Math.cos(ph)).addScaledVector(ax, r * Math.sin(ph)), c };
  });
  mb.smoothNormals(start, mb.vertexCount, tri0);
  setUv(mb, start, () => [0.5, DARK_V]);
}

/** a heart leaf: stem notch at `at`, hanging toward `down`, its face toward `out`; `size` long */
function leaf(mb: MeshBuilder, at: Vector3, down: Vector3, out: Vector3, size: number, c: RGB): void {
  const d = down.clone().normalize();
  const w = out.clone().cross(d).normalize();
  const n = d.clone().cross(w).normalize();
  const P = (u: number, v: number) => at.clone().addScaledVector(w, u * size).addScaledVector(d, v * size);
  const from = mb.vertexCount;
  mb.poly([P(0, 1), P(0.42, 0.56), P(0.46, 0.18), P(0, 0.05), P(-0.46, 0.18), P(-0.42, 0.56)], n.dot(out) >= 0 ? n : n.negate(), c);
  setUv(mb, from, () => [0.5, DARK_V]);
}

/** copy `src` into `dst`, every position scaled by `s` about the origin and moved by `o` */
function append(dst: MeshBuilder, src: MeshBuilder, o: Vector3, s: number): void {
  const base = dst.vertexCount;
  for (let k = 0; k < src.vertexCount; k++) {
    dst.pos.push(o.x + src.pos[k * 3] * s, o.y + src.pos[k * 3 + 1] * s, o.z + src.pos[k * 3 + 2] * s);
    dst.nrm.push(src.nrm[k * 3], src.nrm[k * 3 + 1], src.nrm[k * 3 + 2]);
    dst.col.push(src.col[k * 3], src.col[k * 3 + 1], src.col[k * 3 + 2]);
    dst.moss.push(0);
    dst.wet.push(0);
    dst.uv.push(src.uv[k * 2], src.uv[k * 2 + 1]);
  }
  for (const i of src.idx) dst.idx.push(base + i);
}

const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/**
 * One pod in its own frame (scale 1, the opening's centre at the origin's axis, y up), hanging
 * from (0, STEM_TOP + cord, 0) — `cord` in the pod's units.
 */
function buildPod(rng: Rng, cord: number): MeshBuilder {
  const mb = new MeshBuilder();
  const capTint = 0.85 + rng() * 0.3;
  const up = new Vector3(0, 1, 0);
  const at = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const frame: RGB = [0.2, 0.13, 0.075];

  // the husk (its inside, seen through the opening, glows too: the material is double-sided)
  let from = mb.vertexCount;
  lathe(mb, BODY, SEGS * 6, at, [0.5, 0.34, 0.12], () => 0, huskRadius);
  setUv(mb, from, (_k, u, v) => [u, BODY_V0 + (BODY_V1 - BODY_V0) * v]);
  // the flame on its cup, the cup slung from the hoop on three spokes
  from = mb.vertexCount;
  lathe(mb, FLAME, 10, at, [1, 0.8, 0.45]);
  setUv(mb, from, () => [0.5 / SEGS, 0.004]);
  from = mb.vertexCount;
  lathe(mb, CUP, 10, at, frame);
  setUv(mb, from, () => [0.5, DARK_V]);
  const hoopR = BODY[0][0] + 0.005;
  for (let k = 0; k < 3; k++) {
    const a = ((k + 0.5) / 3) * TAU;
    const curve = new LineCurve3(at(Math.cos(a) * 0.022, 0.041, Math.sin(a) * 0.022), at(Math.cos(a) * hoopR, BODY[0][1], Math.sin(a) * hoopR));
    tube(mb, curve, 1, 4, () => 0.0028, () => frame, () => [0.5, DARK_V]);
  }
  // the frame: the hoop, the band under the calyx, a bent-wood rib over every seam
  ring(mb, at(0, BODY[0][1], 0), up, hoopR, 0.0055, 24, 4, frame);
  // (tied over the ribs, pressing into the segments' bulges)
  ring(mb, at(0, 0.262, 0), up, bodyRadius(0.262) + 0.004, 0.005, 30, 4, frame);
  for (let k = 0; k < SEGS; k++) {
    const th = (k / SEGS) * TAU;
    const pts: Vector3[] = [];
    for (let j = 1; j < BODY.length - 2; j++) {
      const [r, y] = BODY[j];
      const rr = huskRadius(th, y, r) + 0.0042;
      pts.push(at(rr * Math.cos(th), y, rr * Math.sin(th)));
    }
    tube(mb, new CatmullRomCurve3(pts), 12, 4, () => 0.0046, () => scale(frame, 0.9 + 0.2 * rng()), () => [0.5, DARK_V]);
  }
  // the calyx: scalloped, its brim dipping over every seam
  const capC = scale([0.28, 0.33, 0.16], capTint);
  from = mb.vertexCount;
  lathe(
    mb,
    CAP,
    SEGS * 6,
    at,
    capC,
    () => 0,
    (th, y, r) => (y < 0.33 ? r * (1 + 0.035 * Math.sin(Math.PI * seamDistance(th))) : r),
    (th, y) => (y < 0.3 ? y - 0.014 * Math.exp(-((seamDistance(th) / 0.13) ** 2)) : y),
  );
  setUv(mb, from, () => [0.5, DARK_V]);
  // a sepal on every segment, from under the brim down a third of the husk, flaring at its tip
  const sepalC = scale([0.12, 0.18, 0.06], capTint);
  for (let k = 0; k < SEGS; k++) {
    const th = ((k + 0.5) / SEGS) * TAU + (rng() - 0.5) * 0.12;
    const radial = at(Math.cos(th), 0, Math.sin(th));
    const around = at(-Math.sin(th), 0, Math.cos(th));
    const len = 0.085 + rng() * 0.025;
    const rows = 5;
    const edge = (t: number, s: number) => {
      const y = 0.278 - len * t;
      const rc = huskRadius(th, y, bodyRadius(y)) + 0.012 + 0.028 * t * t;
      const w = 0.034 * (1 - Math.pow(t, 1.5));
      return at(0, y, 0).addScaledVector(radial, rc).addScaledVector(around, s * w);
    };
    from = mb.vertexCount;
    for (let j = 0; j < rows; j++) {
      const t0 = j / rows;
      const t1 = (j + 1) / rows;
      const n = radial.clone().multiplyScalar(1).add(at(0, 0.35 + 0.4 * t0, 0)).normalize();
      if (j < rows - 1) mb.poly([edge(t0, -1), edge(t0, 1), edge(t1, 1), edge(t1, -1)], n, sepalC);
      else mb.poly([edge(t0, -1), edge(t0, 1), edge(t1, 0)], n, sepalC);
    }
    setUv(mb, from, () => [0.5, DARK_V]);
  }
  // the knuckled stem, the leaf collar where the cord ties on, the hitch, the cord and its knot
  const stemCurve = new CatmullRomCurve3([at(0, 0.36, 0), at(0.002, 0.39, 0.001), at(0.004, 0.42, -0.002), at(0.003, STEM_TOP, -0.003)]);
  tube(
    mb,
    stemCurve,
    10,
    6,
    (t) => lerp(0.012, 0.009, t) * (1 + 0.25 * Math.exp(-(((t - 0.3) / 0.07) ** 2)) + 0.2 * Math.exp(-(((t - 0.72) / 0.07) ** 2))),
    () => [0.22, 0.17, 0.1],
    () => [0.5, DARK_V],
  );
  const collarC = scale([0.3, 0.42, 0.12], capTint);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + rng() * 0.6;
    const dir = at(Math.cos(a), -0.55, Math.sin(a));
    leaf(mb, at(0.003, STEM_TOP - 0.01, -0.003), dir, at(Math.cos(a), 0.6, Math.sin(a)), 0.034 + rng() * 0.01, collarC);
  }
  ring(mb, at(0.003, STEM_TOP - 0.014, -0.003), up, 0.0145, 0.0048, 14, 4, [0.17, 0.12, 0.07]);
  ring(mb, at(0.003, STEM_TOP - 0.024, -0.003), up, 0.0155, 0.0048, 14, 4, [0.2, 0.14, 0.08]);
  const hook = at(0, STEM_TOP + cord, 0);
  tube(mb, new LineCurve3(at(0.003, STEM_TOP - 0.01, -0.003), hook), 6, 5, () => 0.0062, () => [0.2, 0.14, 0.08], () => [0.5, DARK_V]);
  ring(mb, hook.clone().setY(hook.y - 0.022), up, 0.011, 0.0085, 10, 5, [0.16, 0.11, 0.07]);
  return mb;
}

export interface RuinsLanterns {
  meshes: Mesh[];
  materials: Material[];
  textures: Texture[];
  blockers: Blocker[];
  casters: Caster[];
  /** the pods' centres (world) */
  pods: Vector3[];
  triangles: number;
}

/**
 * The lanterns of `EXPANSION_RUINS.lanterns`. `stones` is the ruins' boulder builder (the posts'
 * foot stones go in before it is built).
 */
export async function buildLanterns(rng: Rng, ground: Ground, textures: TextureLibrary, glow: number, stones: MeshBuilder): Promise<RuinsLanterns> {
  const [barkC, barkN, barkR] = await Promise.all([textures.load('bark_brown_02', 'color'), textures.load('bark_brown_02', 'normal'), textures.load('bark_brown_02', 'roughness')]);
  // the village's post bark (structures' `bark`: the same set, tint and relief)
  const bark = new MeshStandardMaterial({ map: barkC, normalMap: barkN, normalScale: new Vector2(1.5, 1.5), roughnessMap: barkR, roughness: 1, color: new Color(0xdcb086), vertexColors: true });
  bark.name = 'ruins:lantern-post';
  const glowMap = podEmissiveMap(glow);
  // dark diffuse so sunlight does not wash the gradient to cream; the village pods' 2.0
  const pod = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0xffffff, emissiveMap: glowMap, emissiveIntensity: 2.0, roughness: 0.6, metalness: 0, side: DoubleSide });
  pod.name = 'ruins:lantern-pod';
  // the pools: a warm veil over the ground, alpha-blended (the height fog treats it as any surface)
  const pool = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  pool.name = 'ruins:lantern-pool';

  const surface = (x: number, z: number) => {
    const g = ground(x, z);
    return Math.max(g, outcropSkin(x, z, g));
  };
  const posts = new MeshBuilder();
  const pods = new MeshBuilder();
  const poolPos: number[] = [];
  const poolCol: number[] = [];
  const poolIdx: number[] = [];
  const blockers: Blocker[] = [];
  const casters: Caster[] = [];
  const podCentres: Vector3[] = [];

  for (const [i, def] of EXPANSION_RUINS.lanterns.entries()) {
    const [x, z, fx, fz, H] = def;
    const r = rng.fork(`post-${i}`);
    const noise = new Noise2D(`ruins-lantern-${i}`);
    const gy = surface(x, z);
    const F = new Vector3(fx, 0, fz).normalize();
    const S = new Vector3(F.z, 0, -F.x);
    const lean = (r() - 0.5) * 0.1;
    const side = (r() - 0.5) * 0.12;
    const P = (f: number, s: number, y: number) => new Vector3(x, gy + y, z).addScaledVector(F, f).addScaledVector(S, s);
    // the post leans a little away from the path, bends toward it above two thirds of its height
    // and its top curls over into a hook ≈ 0.6 m out, drooping at the tip
    const curve = new CatmullRomCurve3([P(0, 0, -0.35), P(0, 0, 0), P(-0.08 + lean, side, H * 0.62), P(0.1 + lean, side * 0.6, H), P(0.42, side * 0.3, H + 0.16), P(0.62, 0, H + 0.1)], false, 'catmullrom', 0.5);
    const len = curve.getLength();
    const postR = (t: number) => lerp(0.1, 0.045, Math.pow(t, 0.8)) * (1 + 0.12 * Math.exp(-(((t - 0.72) / 0.06) ** 2)) + 0.04 * Math.sin(t * 13));
    tube(
      posts,
      curve,
      30,
      10,
      postR,
      (t, a) => {
        // a dark damp foot greening with moss, greyer weathered wood above
        const d = (0.38 + 0.2 * smoothstep(0, 0.5, t)) * (0.88 + 0.24 * Math.max(0, Math.sin(a)));
        const m = (1 - smoothstep(0.1, 0.28, t)) * 0.55;
        return [lerp(d, 0.22, m), lerp(d * 0.9, 0.28, m), lerp(d * 0.8, 0.1, m)];
      },
      (t, a) => [a / TAU, (t * len) / 0.6],
      // bark cords twisting up the post, worn smooth on the hook
      (t, a) => (noise.ridged(Math.cos(a) * 0.9 + t * 2.5, Math.sin(a) * 0.9 + t * 4, 2) - 0.5) * 0.02 * (1 - 0.6 * smoothstep(0.7, 1, t)) + Math.sin(a * 5 + t * 6) * 0.003,
      true,
    );
    // rope lashing round the bend
    for (let k = 0; k < 4; k++) {
      const t = 0.6 + k * 0.035;
      ring(pods, curve.getPointAt(t), curve.getTangentAt(t), postR(t) + 0.014, 0.014, 14, 5, scale([0.36, 0.3, 0.2], 0.9 + 0.2 * r()));
    }
    // a vine strand trails off the crook; a few heart leaves at the bend
    const crook = curve.getPointAt(0.84).add(new Vector3(0, -0.03, 0));
    const vineLen = 0.45 + r() * 0.3;
    const sway = S.clone().multiplyScalar(0.04 * (r() - 0.5));
    const vine = new CatmullRomCurve3([
      crook,
      crook.clone().add(new Vector3(0, -vineLen * 0.35, 0)).addScaledVector(F, 0.03).add(sway),
      crook.clone().add(new Vector3(0, -vineLen * 0.7, 0)).addScaledVector(F, 0.05).sub(sway),
      crook.clone().add(new Vector3(0, -vineLen, 0)).addScaledVector(F, 0.04),
    ]);
    tube(pods, vine, 10, 4, (t) => lerp(0.007, 0.004, t), () => [0.16, 0.2, 0.08], () => [0.5, DARK_V]);
    for (let k = 0; k < 6; k++) {
      const t = 0.12 + (k / 5) * 0.83;
      const p = vine.getPointAt(t);
      const sgn = k % 2 ? 1 : -1;
      const out = S.clone().multiplyScalar(sgn).addScaledVector(F, 0.4 * (r() - 0.5)).setY(0.25).normalize();
      const g = 0.75 + 0.35 * r();
      leaf(pods, p, out.clone().setY(-1.2), out, 0.06 + 0.035 * r() * (1 - t * 0.4), [0.14 * g, 0.22 * g, 0.07 * g]);
    }
    const bend = curve.getPointAt(0.78);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + r();
      const out = new Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize();
      const g = 0.75 + 0.35 * r();
      leaf(pods, bend.clone().addScaledVector(out, postR(0.78) * 0.9), out.clone().setY(-0.6), out, 0.07 + 0.03 * r(), [0.15 * g, 0.24 * g, 0.07 * g]);
    }

    // the pod: on its cord from just behind the hook's tip
    const hook = curve.getPointAt(0.965).add(new Vector3(0, -0.04, 0));
    const s = 1.02 + r() * 0.14;
    const cord = 0.22 + r() * 0.1;
    const origin = hook.clone().add(new Vector3(0, -(cord + STEM_TOP * s), 0));
    append(pods, buildPod(r.fork('pod'), cord / s), origin, s);
    podCentres.push(origin.clone().add(new Vector3(0, 0.19 * s, 0)));

    // stones wedging the foot, long side round the post
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + r() * 0.9;
      const d = 0.18 + r() * 0.05;
      const sx = x + Math.cos(a) * d;
      const sz = z + Math.sin(a) * d;
      const ha = 0.07 + r() * 0.05;
      const hy = 0.05 + r() * 0.035;
      const hb = 0.05 + r() * 0.03;
      const k2 = 0.85 + r() * 0.2;
      const sag: [number, number, number, number] = [(r() - 0.5) * 0.04, (r() - 0.5) * 0.04, (r() - 0.5) * 0.04, (r() - 0.5) * 0.04];
      block(stones, sx, surface(sx, sz) + hy * 0.2, sz, ha, hy, hb, a + Math.PI / 2 + (r() - 0.5) * 0.5, { bevel: 0.022, color: [k2, k2 * 0.985, k2 * 0.95], mossTop: 0.3 + r() * 0.5, mossSide: 0.4, sag });
    }

    // the pool under the pod: a draped disc, warm, fading out by 1.7 m
    const cx = hook.x;
    const cz = hook.z;
    const RINGS = 7;
    const SEG = 24;
    const RAD = 1.7;
    const base = poolPos.length / 3;
    for (let j = 0; j <= RINGS; j++) {
      const rho = (j / RINGS) * RAD;
      for (let k = 0; k < (j === 0 ? 1 : SEG); k++) {
        const a = (k / SEG) * TAU;
        const px = cx + Math.cos(a) * rho;
        const pz = cz + Math.sin(a) * rho;
        // (over the ground's 1 m lattice and the skin's 0.22 m one, whose facets stand off the
        // exact surface by a few centimetres on the verge's curves)
        const g = ground(px, pz);
        const sy = surface(px, pz);
        const y = sy + (sy > g + 0.005 ? 0.075 : 0.065);
        const alpha = (0.1 * Math.max(0, Math.exp(-((rho / (0.5 * RAD)) ** 2)) - Math.exp(-4))) / (1 - Math.exp(-4));
        poolPos.push(px, y, pz);
        poolCol.push(0.9, 0.55, 0.22, alpha);
      }
    }
    for (let k = 0; k < SEG; k++) poolIdx.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
    for (let j = 1; j < RINGS; j++) {
      const r0 = base + 1 + (j - 1) * SEG;
      const r1 = base + 1 + j * SEG;
      for (let k = 0; k < SEG; k++) {
        const k1 = (k + 1) % SEG;
        poolIdx.push(r0 + k, r0 + k1, r1 + k, r0 + k1, r1 + k1, r1 + k);
      }
    }

    blockers.push({ x, z, r: 0.12, top: gy + H });
    casters.push({ x, z, r: 1.0, y0: gy - 0.2, y1: gy + H + 0.35, shadow: true });
  }

  const postMesh = new Mesh(posts.build(), bark);
  postMesh.name = 'ruins-lantern-posts';
  const podMesh = new Mesh(pods.build(), pod);
  podMesh.name = 'ruins-lantern-pods';
  const poolGeo = new BufferGeometry();
  poolGeo.setAttribute('position', new Float32BufferAttribute(poolPos, 3));
  poolGeo.setAttribute('normal', new Float32BufferAttribute(new Array(poolPos.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  poolGeo.setAttribute('color', new Float32BufferAttribute(poolCol, 4));
  poolGeo.setIndex(new Uint32BufferAttribute(poolIdx, 1));
  poolGeo.computeBoundingSphere();
  const poolMesh = new Mesh(poolGeo, pool);
  poolMesh.name = 'ruins-lantern-pools';
  poolMesh.renderOrder = 1;
  return {
    meshes: [postMesh, podMesh, poolMesh],
    materials: [bark, pod, pool],
    textures: [glowMap],
    blockers,
    casters,
    pods: podCentres,
    triangles: posts.triangleCount + pods.triangleCount + poolIdx.length / 3,
  };
}
