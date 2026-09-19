/**
 * Standing stones for the clearing's stone circle (round 48, opus-review #02: "seven smooth
 * cylinders … bollards, not standing stones").
 *
 * Each stone is a lofted, tapered block: an irregular 7-sided base outline carried up through a
 * stack of rings whose radius tapers to 45–70 % at the top, bows a few centimetres to one side
 * and is roughened by a two-octave noise in the ring's own (x, y, z) — faceted like a cleaved
 * block, not a turned post. The rings are grouped into 3–5 strata bands: every band is its own
 * smoothing group with its own radius offset (±1–2 cm) and luminance (±6 %), so the bedding
 * planes read as small ledges and tone steps up the flank, tilted with the stone. The top is a
 * cleavage plane sloping 8–22°, with one or two chips (3–8 cm drops over a hand's width of rim)
 * and, on the split stones, a whole sector dropped 10–16 cm. The block continues 0.2–0.35 m
 * below the ground (half-buried); a soil / moss bedding skirt heaps against the foot over the
 * paving's plinth and the shader's stain / moss attributes carry a damp band up the lowest
 * 20 cm. One stone lies fallen on its side, sunk a third into the ground. Everything is drawn
 * from the caller's seeded stream; nothing here reads another system.
 */
import { Matrix4, Vector2, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { MeshBuilder, irregularPolygon, type P2, type Rgb } from './geometry';

export interface StandingStoneSpec {
  /** world xz of the stone's spot */
  x: number;
  z: number;
  /** ground height sampler (world xz) */
  ground: (x: number, z: number) => number;
  /** proud height over the ground under its centre (m); the fallen stone's is its length */
  height: number;
  /** base footprint across (m), the long axis */
  across: number;
  /** the stone lies on its side */
  fallen?: boolean;
  /** a whole sector of the top split off */
  split?: boolean;
  /** base tint (linear multiplier on the stone material's colour) */
  tint: number;
  /** lean off vertical (rad) and the direction it leans toward (rad, world xz) */
  tiltRad: number;
  tiltDir: number;
  /** yaw of the base outline (rad) */
  yaw: number;
  /** direction (world xz, rad) of the shaded flank — moss and damp weigh toward it */
  shadeDir: number;
  /** uv scale / offset for the stone texture */
  uvScale: number;
  uvOffset: [number, number];
  /** shared noise for the surface displacement and the moss / strata mottling */
  noise: Noise2D;
}

export interface StandingStoneResult {
  /** world y of the highest top vertex */
  topY: number;
  /** world y of the lowest vertex (buried foot) */
  footY: number;
  /** ground height under the centre */
  groundY: number;
  triangles: number;
  /** number of strata bands, chips and whether a sector split off (for the audit) */
  bands: number;
  chips: number;
  split: boolean;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _d = new Vector3();
const _ua = new Vector2();
const _ub = new Vector2();
const _uc = new Vector2();
const _ud = new Vector2();

/** how far the block continues under the ground, as a share of its proud height (plus a floor) */
const BURY_K = 0.28;
const BURY_MIN = 0.16;
/** the damp band up the foot (m over the ground) */
const DAMP_H = 0.22;
/** the bedding skirt's reach out from the flank (m) and its rise up the flank (m over the ground) */
const SKIRT_REACH: [number, number] = [0.13, 0.22];
const SKIRT_RISE: [number, number] = [0.08, 0.13];

interface Ring {
  y: number;
  pts: P2[];
  /** strata band index */
  band: number;
}

/**
 * Build one standing stone into `mb` (world coordinates). The stone is authored upright in a
 * local frame (origin at the ground under its centre, y up), then tilted and yawed; the fallen
 * stone is the same block laid over by ~80° and sunk.
 */
export function buildStandingStone(mb: MeshBuilder, rng: Rng, s: StandingStoneSpec): StandingStoneResult {
  const N = s.noise;
  const local = new MeshBuilder();
  const groundY = s.ground(s.x, s.z);
  const fallen = !!s.fallen;
  const H = s.height;
  const bury = fallen ? 0 : Math.max(BURY_MIN, H * BURY_K);
  const L = H + bury;
  const baseR = s.across / 2;
  // base outline: 7 sides, subdivided to 21 points, a little oblong
  const outline = irregularPolygon(rng, 7, { radiusJitter: 0.24, angleJitter: 0.3, subdivide: 3, edgeJitter: 0.035, aspect: rng.range(1.15, 1.5) });
  const n = outline.length;
  // taper: top at 45–70 % of the base; the belly bulges a few % a third of the way up
  const taperK = rng.range(0.3, 0.55);
  const bellyK = rng.range(0.02, 0.07);
  const bellyAt = rng.range(0.25, 0.45);
  // bow: the ring centres drift with height (m at the top)
  const bowX = rng.range(-0.045, 0.045);
  const bowZ = rng.range(-0.045, 0.045);
  // displacement amplitudes (share of the local radius)
  const dispA = rng.range(0.07, 0.12);
  const dispB = rng.range(0.025, 0.045);
  const nOff = rng.range(0, 100);
  // strata: 3–5 bands with jittered boundaries, each its own radius offset and tone
  const bands = rng.int(3, 6);
  const bounds: number[] = [0];
  for (let b = 1; b < bands; b++) bounds.push((b / bands) * L + rng.range(-0.07, 0.07) * (L / bands));
  bounds.push(L);
  const bandDr = Array.from({ length: bands }, () => rng.range(-0.02, 0.02));
  const bandLum = Array.from({ length: bands }, (_, b) => 1 + (b % 2 === 0 ? 1 : -1) * rng.range(0.03, 0.07));
  const bandWarm = Array.from({ length: bands }, () => rng.range(-0.02, 0.02));
  // top: a cleavage plane sloping 8–22° toward a random direction, plus chips / a split sector
  const topSlope = Math.tan(rng.range(0.14, 0.38));
  const topDir = rng.range(0, Math.PI * 2);
  const chips = rng.int(1, 3);
  const chipAt = Array.from({ length: chips }, () => ({ i: rng.int(0, n), drop: rng.range(0.03, 0.08), w: rng.int(1, 3) }));
  const split = !!s.split;
  const splitDir = rng.range(0, Math.PI * 2);
  const splitHalf = rng.range(0.9, 1.25);
  const splitDrop = rng.range(0.1, 0.16);

  /** ring radius scale at height fraction t (0 foot … 1 top) */
  const taper = (t: number) => (1 - taperK * Math.pow(smoothstep(0.2, 1, t), 1.25)) * (1 + bellyK * Math.exp(-((t - bellyAt) ** 2) / 0.05));
  /** the ring at local height y (over the ground; negative = buried) in band `band` */
  const ring = (y: number, band: number): Ring => {
    const t = (y + bury) / L;
    const sc = taper(t);
    const cx = bowX * t * t;
    const cz = bowZ * t * t;
    const pts: P2[] = outline.map((p) => {
      const px = p.x * baseR * sc;
      const pz = p.z * baseR * sc;
      const r0 = Math.hypot(px, pz) || 1e-6;
      const n1 = N.fbm(px * 3.1 + y * 2.3 + nOff, pz * 3.1 - y * 1.7 - nOff, 2);
      const n2 = N.noise(px * 9 - y * 6 + nOff * 0.7, pz * 9 + y * 5 + nOff * 1.3);
      // the buried part keeps its full radius (the foot is not eroded)
      const erode = 0.35 + 0.65 * smoothstep(-bury, 0.1, y);
      const r = r0 * (1 + (dispA * n1 + dispB * n2) * erode) + bandDr[band] * sc;
      return { x: cx + (px / r0) * r, z: cz + (pz / r0) * r };
    });
    return { y, pts, band };
  };
  // ring stack: every band gets its bottom and top ring plus one or two between; the top band's
  // last segment is tall enough for the chips / the split to drop into it
  const rings: Ring[] = [];
  for (let b = 0; b < bands; b++) {
    const y0 = bounds[b] - bury;
    const y1 = bounds[b + 1] - bury;
    const segs = b === bands - 1 ? 1 : Math.max(1, Math.round((y1 - y0) / 0.11));
    for (let k = 0; k <= segs; k++) rings.push(ring(y0 + ((y1 - y0) * k) / segs, b));
  }
  // top ring heights: the cleavage plane, the chips and the split sector
  const topRing = rings[rings.length - 1];
  const topDrop = topRing.pts.map((p, i) => {
    let drop = 0;
    for (const ch of chipAt) {
      const di = Math.min(Math.abs(i - ch.i), n - Math.abs(i - ch.i));
      if (di <= ch.w) drop = Math.max(drop, ch.drop * (1 - (di / (ch.w + 1)) ** 2));
    }
    if (split) {
      const ang = Math.atan2(p.z, p.x);
      let da = Math.abs(((ang - splitDir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      da = smoothstep(splitHalf, splitHalf - 0.35, da);
      drop = Math.max(drop, splitDrop * da);
    }
    return drop;
  });
  const prevRing = rings[rings.length - 2];
  const topGap = topRing.y - prevRing.y;
  const topYAt = (p: P2, i: number) => {
    const plane = topSlope * (p.x * Math.cos(topDir) + p.z * Math.sin(topDir));
    return topRing.y + plane - Math.min(topDrop[i], 0.85 * topGap + Math.min(0, plane));
  };
  const topYs = topRing.pts.map((p, i) => topYAt(p, i));

  // --- colours ---
  const tint = s.tint;
  const base: Rgb = [tint * 1.0, tint * 0.985, tint * 0.955];
  const shadeX = Math.cos(s.shadeDir - s.yaw);
  const shadeZ = Math.sin(s.shadeDir - s.yaw);
  /** how much a flank point faces the shaded side (0..1) */
  const shadeFace = (p: P2) => {
    const l = Math.hypot(p.x, p.z) || 1;
    return 0.5 + 0.5 * ((p.x / l) * shadeX + (p.z / l) * shadeZ);
  };
  const dampAt = (y: number) => 1 - smoothstep(0, DAMP_H, y);
  const sideCol = (y: number, band: number, p: P2, fresh = 0): Rgb => {
    const lum = bandLum[band] * (1 - 0.3 * dampAt(y)) * (1 + 0.14 * fresh);
    const warm = bandWarm[band];
    // the damp foot leans brown-green
    const d = dampAt(y);
    return [base[0] * lum * (1 + warm) * (1 - 0.06 * d), base[1] * lum * (1 - 0.02 * d), base[2] * lum * (1 - warm) * (1 - 0.1 * d)];
  };
  const mossAt = (y: number, p: P2) => {
    const d = 1 - smoothstep(0.02, 0.38, y);
    const f = shadeFace(p);
    const m = N.fbm(p.x * 6 + y * 4 + nOff, p.z * 6 - y * 3 + nOff, 2) * 0.5 + 0.5;
    return Math.min(1, d * (0.25 + 0.75 * f) * (0.45 + 0.9 * m) + 0.12 * f * m * (1 - d));
  };
  const stainAt = (y: number) => Math.max(0, 1.5 * (1 - smoothstep(-0.05, DAMP_H * 0.8, y)));
  const uvS = s.uvScale;
  const uvO = s.uvOffset;
  const wearSide = 0.7;
  /** the flank's lichen mottle: grey patches everywhere, moss cushions toward the shaded side and the foot */
  const mottleAt = (y: number, p: P2): [number, number, number] => [0.35 * shadeFace(p) + 0.4 * dampAt(y), 0.45, 0.35];

  // --- flank: ring to ring, each strata band its own smoothing group; the ledges between the
  // bands (two rings at one height, the bands' radii apart) are a group of their own so the
  // bedding planes keep a crisp crease (a ledge quad's winding faces down where the upper band
  // overhangs and up where it steps back: (p, q, q_out) has the normal −y, (p, q, q_in) +y) ---
  let triangles = 0;
  const emitPair = (k: number) => {
    const lo = rings[k];
    const hi = rings[k + 1];
    const b = hi.band;
    const isTop = k === rings.length - 2;
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      const p = lo.pts[i];
      const q = lo.pts[i1];
      const pi = hi.pts[i];
      const qi = hi.pts[i1];
      const yP = lo.y;
      const yPi = isTop ? topYs[i] : hi.y;
      const yQi = isTop ? topYs[i1] : hi.y;
      _a.set(p.x, yP, p.z);
      _b.set(q.x, yP, q.z);
      _c.set(qi.x, yQi, qi.z);
      _d.set(pi.x, yPi, pi.z);
      const u0 = (i / n) * 1.6;
      const u1 = ((i + 1) / n) * 1.6;
      _ua.set(u0 * uvS * 2 + uvO[0], yP * uvS + uvO[1]);
      _ub.set(u1 * uvS * 2 + uvO[0], yP * uvS + uvO[1]);
      _uc.set(u1 * uvS * 2 + uvO[0], yQi * uvS + uvO[1]);
      _ud.set(u0 * uvS * 2 + uvO[0], yPi * uvS + uvO[1]);
      const fresh = isTop ? Math.min(1, (topDrop[i] + topDrop[i1]) * 8) : 0;
      const c1 = sideCol((yP + yPi) / 2, b, p, fresh);
      const c2 = sideCol((yP + yQi) / 2, b, q, fresh);
      const cm: Rgb = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2, (c1[2] + c2[2]) / 2];
      const mA = mossAt(yP, p);
      const mB = mossAt(yP, q);
      const mC = mossAt(yQi, qi);
      const mD = mossAt(yPi, pi);
      const sA = stainAt(yP);
      const sC = stainAt(yQi);
      const sD = stainAt(yPi);
      const mo = mottleAt((yP + yPi) / 2, p);
      const mot = [mo[0], mo[1], mo[2], mo[0], mo[1], mo[2], mo[0], mo[1], mo[2]];
      local.tri(_a, _b, _c, _ua, _ub, _uc, cm, [mA, mB, mC], undefined, [sA, sA, sC], wearSide, undefined, mot);
      local.tri(_a, _c, _d, _ua, _uc, _ud, cm, [mA, mC, mD], undefined, [sA, sC, sD], wearSide, undefined, mot);
      triangles += 2;
    }
  };
  for (let b = 0; b < bands; b++) {
    local.beginGroup();
    for (let k = 0; k < rings.length - 1; k++) if (rings[k].band === b && rings[k + 1].band === b) emitPair(k);
    local.smoothGroup();
  }
  local.beginGroup();
  for (let k = 0; k < rings.length - 1; k++) if (rings[k].band !== rings[k + 1].band) emitPair(k);
  local.smoothGroup();

  // --- top cap: a fan to the centre of the plane (the chips and the split fall away from it) ---
  {
    local.beginGroup();
    const cx = topRing.pts.reduce((acc, p) => acc + p.x, 0) / n;
    const cz = topRing.pts.reduce((acc, p) => acc + p.z, 0) / n;
    // the centre sits on the cleavage plane, a hair under the mean of the unchipped rim
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < n; i++) if (topDrop[i] < 0.01) { sum += topYs[i]; cnt++; }
    const cy = (cnt ? sum / cnt : topRing.y) - 0.004;
    _c.set(cx, cy, cz);
    const topBase = sideCol(topRing.y, bands - 1, { x: 0, z: 0 });
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      const p = topRing.pts[i];
      const q = topRing.pts[i1];
      _a.set(p.x, topYs[i], p.z);
      _b.set(q.x, topYs[i1], q.z);
      _ua.set(p.x * uvS * 2 + uvO[0] + 0.5, p.z * uvS * 2 + uvO[1]);
      _ub.set(q.x * uvS * 2 + uvO[0] + 0.5, q.z * uvS * 2 + uvO[1]);
      _uc.set(cx * uvS * 2 + uvO[0] + 0.5, cz * uvS * 2 + uvO[1]);
      // the chipped faces are fresh, paler stone; the weathered plane a touch darker than the flank
      const fresh = Math.min(1, (topDrop[i] + topDrop[i1]) * 8);
      const k = 0.94 * (1 - fresh) + 1.1 * fresh;
      const col: Rgb = [topBase[0] * k, topBase[1] * k, topBase[2] * k * (1 + 0.03 * fresh)];
      const mTop = 0.08 * (1 - fresh) * (N.fbm(p.x * 8 + nOff, p.z * 8 - nOff, 2) * 0.5 + 0.5);
      const mot = [0.25, 0.6, 0.3, 0.25, 0.6, 0.3, 0.1, 0.6, 0.3];
      local.tri(_a, _b, _c, _ua, _ub, _uc, col, [mTop, mTop, mTop * 0.5], undefined, undefined, 0.75 * (1 - 0.6 * fresh), undefined, mot);
      triangles++;
    }
    local.smoothGroup();
  }

  // --- pose: yaw, then lean, then seat on the ground ---
  const m = new Matrix4().makeRotationY(s.yaw);
  if (fallen) {
    // laid over along the lean direction by 78–86°, a third of its thickness in the ground; the
    // block's own bottom (y = 0 locally) becomes one end, so the foot end is sunk a little deeper
    const over = rng.range(1.36, 1.5);
    const axis = new Vector3(-Math.sin(s.tiltDir), 0, Math.cos(s.tiltDir)).normalize();
    m.premultiply(new Matrix4().makeRotationAxis(axis, over));
    // seat: the lowest transformed vertex goes 0.34 of the base radius under the ground line
    const sink = baseR * 0.55;
    let minY = Infinity;
    const v = new Vector3();
    for (let i = 0; i < local.pos.length; i += 3) {
      v.set(local.pos[i], local.pos[i + 1], local.pos[i + 2]).applyMatrix4(m);
      minY = Math.min(minY, v.y);
    }
    m.premultiply(new Matrix4().makeTranslation(s.x, groundY - sink - minY, s.z));
  } else {
    const axis = new Vector3(-Math.sin(s.tiltDir), 0, Math.cos(s.tiltDir)).normalize();
    m.premultiply(new Matrix4().makeRotationAxis(axis, s.tiltRad));
    m.premultiply(new Matrix4().makeTranslation(s.x, groundY, s.z));
  }
  local.transform(m);

  // --- bedding skirt: soil / moss heaped against the foot, over the paving's plinth ---
  if (!fallen) {
    local.beginGroup();
    // the flank at ground level in world space: the ring nearest y = 0, transformed
    const footRing = rings.reduce((best, r) => (Math.abs(r.y) < Math.abs(best.y) ? r : best), rings[0]);
    const vv = new Vector3();
    const foot = footRing.pts.map((p) => {
      vv.set(p.x, footRing.y, p.z).applyMatrix4(m);
      return { x: vv.x, z: vv.z };
    });
    const fc = { x: foot.reduce((a, p) => a + p.x, 0) / n, z: foot.reduce((a, p) => a + p.z, 0) / n };
    const reach = rng.range(SKIRT_REACH[0], SKIRT_REACH[1]);
    const rise = rng.range(SKIRT_RISE[0], SKIRT_RISE[1]);
    const skirtOff = rng.range(0, 50);
    // three rings: inner (up the flank), mid (the mound's crown) and outer (into the plinth top)
    const skirt = (k: number) =>
      foot.map((p, i) => {
        const dx = p.x - fc.x;
        const dz = p.z - fc.z;
        const l = Math.hypot(dx, dz) || 1e-6;
        const wob = 1 + 0.35 * N.noise(dx * 7 + skirtOff, dz * 7 - skirtOff);
        const r = k === 0 ? -0.012 : k === 1 ? reach * 0.45 * wob : reach * wob;
        const wx = p.x + (dx / l) * r;
        const wz = p.z + (dz / l) * r;
        const g = s.ground(wx, wz);
        const y = k === 0 ? g + rise * (0.8 + 0.4 * (N.noise(dx * 11 - skirtOff, dz * 11) * 0.5 + 0.5)) : k === 1 ? g + rise * 0.42 : g + 0.018;
        return { x: wx, y, z: wz, i };
      });
    const r0 = skirt(0);
    const r1 = skirt(1);
    const r2 = skirt(2);
    // soil at the outer edge, moss over the crown, damp moss against the stone
    const soil: Rgb = [0.34 * tint, 0.3 * tint, 0.22 * tint];
    const mossy: Rgb = [0.36 * tint, 0.36 * tint, 0.26 * tint];
    const mossK = (k: number, i: number) => {
      const m2 = N.fbm(r1[i].x * 5 + skirtOff, r1[i].z * 5 - skirtOff, 2) * 0.5 + 0.5;
      return k === 0 ? 0.55 + 0.45 * m2 : k === 1 ? 0.35 + 0.65 * m2 : 0.12 + 0.3 * m2;
    };
    const emit = (A: typeof r0, B: typeof r1, kA: number, kB: number) => {
      for (let i = 0; i < n; i++) {
        const i1 = (i + 1) % n;
        _a.set(A[i].x, A[i].y, A[i].z);
        _b.set(A[i1].x, A[i1].y, A[i1].z);
        _c.set(B[i1].x, B[i1].y, B[i1].z);
        _d.set(B[i].x, B[i].y, B[i].z);
        const uv = (p: { x: number; z: number }) => new Vector2(p.x * uvS + uvO[0], p.z * uvS + uvO[1]);
        const col: Rgb = kB === 2 ? soil : mossy;
        const stain: [number, number, number] = [1.2, 1.2, 1.2];
        // (b → a → c and a → d → c: outward rings run the other way round the stone, so the
        // winding keeps the face up)
        local.tri(_b, _a, _c, uv(A[i1]), uv(A[i]), uv(B[i1]), col, [mossK(kA, i1), mossK(kA, i), mossK(kB, i1)], undefined, stain, 0.5);
        local.tri(_a, _d, _c, uv(A[i]), uv(B[i]), uv(B[i1]), col, [mossK(kA, i), mossK(kB, i), mossK(kB, i1)], undefined, stain, 0.5);
        triangles += 2;
      }
    };
    emit(r0, r1, 0, 1);
    emit(r1, r2, 1, 2);
    local.smoothGroup();
  }

  // --- result ---
  let topY = -Infinity;
  let footY = Infinity;
  for (let i = 0; i < local.pos.length; i += 3) {
    topY = Math.max(topY, local.pos[i + 1]);
    footY = Math.min(footY, local.pos[i + 1]);
  }
  mb.append(local);
  return { topY, footY, groundY, triangles, bands, chips, split };
}

/** the skirt's outer reach and rise, for the audit */
export const STANDING_STONE_SKIRT = { reachM: SKIRT_REACH, riseM: SKIRT_RISE, dampM: DAMP_H, buryK: BURY_K, buryMinM: BURY_MIN };

