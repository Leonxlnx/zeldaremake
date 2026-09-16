/**
 * Near-bole bark: the wood the hero cameras see from 4–15 m — the giants within 25 m of a hero
 * camera and the emergent column at the north path's verge. The reference frames show those boles
 * as deep, wide furrows between rounded cords (10–20 cm of relief, cords 30–50 cm apart that
 * wander, pinch and break into plates), moss packed in the furrows low on the bole, the cords' crests
 * a warm grey-tan that varies cord to cord, the furrows near-black green — where the plain `tube()`
 * sweep (30 rings × 30 sides, a metre-scale gnarl and a 1.6 m bark tile) reads as one repeated
 * texture on a pipe.
 *
 * `reliefBole` sweeps the same coarse centreline the seat publishes (`trunkPath` / `trunkRadii`,
 * see tubePath.ts) with the rings resampled linearly along it — the mesh's axis and nominal radius
 * between the published rings stay exactly what `trunkSeatFromRings` models — at a fine
 * tessellation, and displaces every vertex radially by the cord field: crests +0.35 A, furrows
 * −0.65 A. The cord field is built on the ring's own circle (a Noise2D sampled around a circle of
 * the reference radius, drifting with the distance along the bole, the way `gnarlBump` does) so it
 * is periodic around the bole and never shows a seam. Vertex colour carries the crest tint, the
 * furrow grime and the furrow moss; the furrow occlusion rides in `aWind.z` as a NEGATIVE flutter
 * (wood never flutters; the tree shader decodes it — see `packOcclusion` — to a bark AO applied
 * after the shade floor, which would otherwise lift a shaded furrow to the same flat grey as its
 * crest).
 *
 * `consumeTubeDraws` makes exactly the random draws `tube()` would (phase, wind phase, one grain
 * value per requested side), so a builder that swaps a `tube()` for a `reliefBole()` leaves every
 * later draw of its stream where it was: limbs, crown and their shadows do not move.
 *
 * `buttressRoot` is the near giants' root: a buttress fin (tall and thin at the collar, wide at
 * the base, its underside buried) that splits into 2–3 toes before it enters the ground, moss on
 * its top faces.
 */
import { Color, Vector3 } from 'three';
import type { Noise2D } from '../util/noise';
import { smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { GeometryWriter, TAU, frame, stiffnessFor, type RandomFn } from './writer';

/** the draws `tube()` makes up front, taken from the stream in the same order */
export interface TubeDraws {
  phase: number;
  windPhase: number;
  grain: number[];
}

export function consumeTubeDraws(rng: RandomFn, sides: number): TubeDraws {
  const phase = rng() * TAU;
  const windPhase = rng();
  const grain = Array.from({ length: sides }, () => 0.9 + rng() * 0.2);
  return { phase, windPhase, grain };
}

export interface BoleReliefOptions {
  /** ring colour before the relief tints (point, t along the coarse path) */
  color: (point: Vector3, t: number) => Color;
  /** the metre-scale gnarl (angle, distance, t) the plain sweep used — kept for the silhouette */
  bump?: (angle: number, distance: number, t: number) => number;
  /** darken the vertex colour inside the gnarl's crevices (multiplier on (bump − 1)) */
  creviceShade?: number;
  /** metres of bark texture per tile */
  barkTile: number;
  /** vertices around the bole */
  sides: number;
  /** ring spacing (m) below `denseUntilY`; the coarse rings are used above it */
  spacing: number;
  denseUntilY: number;
  /** relief amplitude (m): crests +0.35 A, furrows −0.65 A */
  amplitude: number;
  /** local heights between which the amplitude fades to `farShare` of itself */
  fadeY: [number, number];
  farShare: number;
  /** radius (m) at which the cord pitch is ≈ 0.42 m; the cord count around the bole follows it */
  refRadius: number;
  /** the relief's own noise field */
  noise: Noise2D;
  /** the draws consumed from the main stream */
  draws: TubeDraws;
  stiffness?: (radius: number, t: number) => number;
  /** keep the first ring horizontal at its own y (the skirt ring) */
  flatBase?: boolean;
  /** local heights over which the furrow moss fades out */
  mossBand: [number, number];
  /** 0–1 overall moss strength (1 = the giants' packed furrows) */
  mossStrength?: number;
  /** cord pitch (m) at `refRadius` */
  pitch?: number;
}

export interface BoleReliefResult {
  rows: number[][];
  rings: number;
  sides: number;
  /** share of the bole vertices inside `mossBand` whose furrow moss is > 0.5 */
  mossShare: number;
  amplitude: number;
  triangles: number;
}

/**
 * the crest / furrow tints the vertex colour carries (multipliers on the ring colour). In shade
 * the floor keeps only 0.25 of the albedo (GIANT_BARK_FLOOR.texture), so the furrow's darkness
 * there is the occlusion channel (see `packOcclusion`) and the grime stays moderate: at 0.36 × an
 * occlusion of 0.32 the furrows of the stair-bank giant read as black bands from F (its box's dark
 * share 15 → 32 %, the reference 7 %).
 */
const CREST_TINT = new Color(1.06, 1.01, 0.94);
const FURROW_GRIME = new Color(0.56, 0.58, 0.48);
const FURROW_MOSS = new Color(0.46, 0.66, 0.3);
/** occlusion at a furrow bottom of a NOMINAL_AMPLITUDE relief (the crests are 1) */
const FURROW_AO = 0.45;
/** relief amplitude (m) the occlusion, the crest lift and the grime are specified at */
const NOMINAL_AMPLITUDE = 0.1;
/**
 * The tree shader lights the relief's crests at this multiple of the plain bark (materials.ts
 * reads it): with the furrow bottoms at FURROW_AO × it, a nominal relief keeps the mean
 * luminance the plain sweep had (cord-weighted mean occlusion ≈ 0.7) while its furrows go dark.
 * An occlusion that only darkened measured the emergent's D box 0.294 → 0.247 against the
 * reference's 0.425 (round 17).
 */
export const BARK_AO_LIFT = 1.45;
/**
 * Furrow occlusion → `aWind.z`. Wood never flutters, so a negative flutter is free: plain sweeps
 * write 0; the relief writes −(0.25 + 0.75 (1 − ao)) ∈ [−1, −0.25]. The tree shader decodes it
 * back to `ao` (materials.ts) and lights the bark at ao × BARK_AO_LIFT, so the crests sit ABOVE
 * the shade floor and the furrow bottoms below it — the floor alone would lift a shaded furrow to
 * the same flat grey as its crest.
 */
export const packOcclusion = (ao: number) => -(0.25 + 0.75 * (1 - Math.min(1, Math.max(0, ao))));
const _c = new Color();
const _tint = new Color();

/**
 * The cord field at (angle, distance) on a bole of reference radius ρ: cord height 0 (furrow
 * bottom) … 1 (crest), plus the per-cord crest tint variation and the furrow-moss noise.
 * Sampled on the ring's circle (cos θ, sin θ) × ρ × f drifting along the bole with the distance,
 * so every field is periodic around the bole.
 */
function cordField(noise: Noise2D, angle: number, distance: number, rho: number, cords: number) {
  const cx = Math.cos(angle) * rho;
  const cz = Math.sin(angle) * rho;
  const on = (f: number, drift: number, ox: number, oz: number) => noise.noise(cx * f + distance * drift + ox, cz * f + distance * drift * 0.83 + oz);
  // cords wander and pinch: the phase of the cord cosine is perturbed by a slow and a mid field
  const wander = 2.4 * on(0.35, 0.2, 17.3, 5.1) + 1.1 * on(0.9, 0.45, 41.2, 9.7);
  const p = 0.5 + 0.5 * Math.cos(cords * angle + wander);
  // rounded cords with a gradual flank (a sharper profile, p^0.55, read as painted lines from
  // 8–14 m: the shading is the occlusion channel, which follows this height)
  let cord = Math.pow(p, 0.7);
  // breaks: stretches where the cord flattens into plates
  const br = smoothstep(0.15, 0.65, 0.5 + 0.5 * on(1.3, 0.55, 3.3, 27.9));
  cord *= 0.65 + 0.35 * br;
  // horizontal fissures across the cords
  const fis = smoothstep(0.58, 0.74, on(0.4, 1.6, 61.1, 13.4));
  cord *= 1 - 0.5 * fis;
  // mid-frequency plate bumps
  cord += 0.1 * on(2.4, 1.2, 8.8, 71.5);
  cord = Math.min(1, Math.max(0, cord));
  // per-cord crest tint: a field slow along the bole, one to two features per cord around it
  const tintVar = on(1.7, 0.1, 23.6, 47.2);
  const mossN = on(2.2, 0.9, 5.5, 33.3);
  return { cord, tintVar, mossN };
}

export function reliefBole(writer: GeometryWriter, points: Vector3[], radii: number[], o: BoleReliefOptions): BoleReliefResult {
  const sides = o.sides;
  const grainN = o.draws.grain.length;
  const pitch = o.pitch ?? 0.42;
  const cords = Math.max(6, Math.round((TAU * o.refRadius) / pitch));
  const mossStrength = o.mossStrength ?? 1;
  // the shading follows the relief: a 6 cm relief occludes, lifts and grimes 0.6 of what the
  // nominal 10 cm one does (the stair-bank giant, a hazed near-smooth column in F and C, is 0.6)
  const depth = Math.min(1.2, Math.max(0.4, o.amplitude / NOMINAL_AMPLITUDE));
  const aoFloor = 1 - (1 - FURROW_AO) * depth;
  const crest = (1 + (BARK_AO_LIFT - 1) * Math.min(1, depth)) / BARK_AO_LIFT;
  const grime = FURROW_GRIME.clone().lerp(new Color(1, 1, 1), 1 - Math.min(1, depth));
  // dense resampling of the coarse path: linear in the ring parameter, so the axis and nominal
  // radius between the published rings are exactly the seat's
  const dense: { p: Vector3; r: number; t: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = a.distanceTo(b);
    const n = a.y < o.denseUntilY ? Math.max(1, Math.ceil(len / o.spacing)) : 1;
    for (let k = 0; k < n; k++) {
      const f = k / n;
      dense.push({ p: a.clone().lerp(b, f), r: radii[i] + (radii[i + 1] - radii[i]) * f, t: (i + f) / (points.length - 1) });
    }
  }
  dense.push({ p: points[points.length - 1].clone(), r: radii[radii.length - 1], t: 1 });
  for (const d of dense) writer.logicalMaxY = Math.max(writer.logicalMaxY, d.p.y + d.r * 1.25);

  const circumference = TAU * radii[0];
  const uTiles = Math.max(1, Math.round(circumference / o.barkTile));
  const rows: number[][] = [];
  let u: Vector3 | undefined;
  const v = new Vector3();
  const p = new Vector3();
  let distance = 0;
  let previous: number[] | null = null;
  let mossHits = 0;
  let mossCount = 0;
  const trisBefore = writer.triangles;
  for (let k = 0; k < dense.length; k++) {
    const d = dense[k];
    if (k) distance += d.p.distanceTo(dense[k - 1].p);
    const axis = dense[Math.min(dense.length - 1, k + 1)].p.clone().sub(dense[Math.max(0, k - 1)].p).normalize();
    if (!u) u = frame(axis)[0];
    else {
      u.addScaledVector(axis, -u.dot(axis));
      if (u.lengthSq() < 0.01) u = frame(axis)[0];
      u.normalize();
    }
    v.crossVectors(axis, u).normalize();
    const ringColor = o.color(d.p, d.t);
    const stiffness = o.stiffness ? o.stiffness(d.r, d.t) : stiffnessFor(d.r);
    // relief amplitude: full over the hero band, `farShare` above the fade
    const amp = o.amplitude * (1 - (1 - o.farShare) * smoothstep(o.fadeY[0], o.fadeY[1], d.p.y));
    const mossBand = (1 - smoothstep(o.mossBand[0], o.mossBand[1], d.p.y)) * mossStrength;
    const inBand = d.p.y >= 0 && d.p.y < o.mossBand[1];
    const row: number[] = [];
    for (let j = 0; j <= sides; j++) {
      const angle = ((j % sides) / sides) * TAU;
      let ridge = 1;
      let crevice = 1;
      if (o.bump) {
        const b = o.bump(angle, distance, d.t);
        ridge *= b;
        if (o.creviceShade) crevice = Math.max(0.55, Math.min(1.15, 1 + o.creviceShade * (b - 1)));
      }
      const { cord, tintVar, mossN } = cordField(o.noise, angle, distance, o.refRadius, cords);
      const r = d.r * ridge + amp * (cord - 0.65);
      p.copy(d.p).addScaledVector(u, Math.cos(angle) * r).addScaledVector(v, Math.sin(angle) * r);
      if (k === 0 && o.flatBase) p.y = dense[0].p.y;
      // furrow occlusion (`crest` on the crests, aoFloor × it at the furrow bottoms, following the
      // cord's rounded flank) rides in aWind.z, negative
      const ao = crest * (aoFloor + (1 - aoFloor) * smoothstep(0, 1, cord));
      // colour: ring colour × the sweep's grain × the gnarl's crevice shade × cord tint × moss
      const grain = o.draws.grain[Math.floor(((j % sides) / sides) * grainN)];
      const shade = crevice * grain * (0.96 + 0.045 * Math.sin(distance * 2.1 + o.draws.phase));
      _tint.copy(grime).lerp(CREST_TINT, Math.pow(cord, 0.7));
      _tint.multiplyScalar(1 + 0.16 * tintVar * Math.pow(cord, 0.7));
      const moss = mossBand * smoothstep(0.42, 0.78, (1 - cord) * 0.72 + 0.28 * (0.5 + 0.5 * mossN));
      _tint.lerp(FURROW_MOSS, moss * 0.85);
      if (inBand) {
        mossCount++;
        if (moss > 0.5) mossHits++;
      }
      _c.copy(ringColor).multiplyScalar(shade).multiply(_tint);
      row.push(writer.vertex(p, _c, (j / sides) * uTiles, distance / o.barkTile, stiffness, o.draws.windPhase, packOcclusion(ao), 0));
    }
    writer.seams.push([row[0], row[sides]]);
    if (previous) {
      for (let j = 0; j < sides; j++) {
        writer.triangle(previous[j], previous[j + 1], row[j]);
        writer.triangle(previous[j + 1], row[j + 1], row[j]);
      }
    }
    rows.push(row);
    previous = row;
  }
  // the fork cap, inside the leaders as the plain sweep's was
  const end = rows[rows.length - 1];
  const last = dense[dense.length - 1];
  const cap = writer.vertex(last.p, o.color(last.p, 1), 0.5, distance / o.barkTile, o.stiffness ? o.stiffness(last.r, 1) : stiffnessFor(last.r), o.draws.windPhase, 0, 0);
  for (let j = 0; j < sides; j++) writer.triangle(cap, end[j], end[j + 1]);
  return { rows, rings: dense.length, sides, mossShare: mossCount ? mossHits / mossCount : 0, amplitude: o.amplitude, triangles: writer.triangles - trisBefore };
}

export interface ButtressRootOptions {
  /** local ground height under local (x, z) */
  groundAt: (x: number, z: number) => number;
  color: (point: Vector3, t: number) => Color;
  /** the draws consumed from the main stream for this root's plain sweep */
  draws: TubeDraws;
  /** the root's own stream for its toes (a fork: nothing else reads it) */
  rng: Rng;
  /** fin half-width at the collar as a multiple of the plain root's radius there */
  flare: number;
  /** the local ground slope is followed by the toes; toe tips stop at this reach from the trunk axis */
  maxReach: number;
  stiffness?: (radius: number, t: number) => number;
  noise: Noise2D;
}

export interface ButtressRootResult {
  toes: number;
  /** local-space toe tips (on the ground) */
  toeTips: Vector3[];
  triangles: number;
}

const ROOT_MOSS = new Color(0.5, 0.7, 0.32);
const ROOT_SOIL = new Color(0.55, 0.5, 0.42);

/**
 * A buttress root along `path` (collar → tip, the plain root's centreline, already riding the
 * terrain) with the radii of the plain root: a fin whose section is tall and thin at the collar
 * (height 1.5 × the radius, half-width `flare` × the radius) and round at the split, its
 * underside buried; at 0.58–0.72 of its length it splits into 2–3 toes that dive into the ground.
 */
export function buttressRoot(writer: GeometryWriter, path: Vector3[], radii: number[], o: ButtressRootOptions): ButtressRootResult {
  const trisBefore = writer.triangles;
  const rr = o.rng;
  const sides = 14;
  const split = 0.58 + rr() * 0.14;
  const toeCount = rr() < 0.45 ? 3 : 2;
  const toeSpread = 0.32 + rr() * 0.28;
  const toeLenScale = 0.8 + rr() * 0.4;
  const toePhase = rr() * TAU;
  const n = path.length - 1;
  const sampleAt = (t: number) => {
    const f = Math.max(0, Math.min(1, t)) * n;
    const i = Math.min(n - 1, Math.floor(f));
    return { p: path[i].clone().lerp(path[i + 1], f - i), r: radii[i] + (radii[i + 1] - radii[i]) * (f - i) };
  };
  const tangentAt = (t: number) => sampleAt(Math.min(1, t + 0.03)).p.sub(sampleAt(Math.max(0, t - 0.03)).p).normalize();
  // ---- the fin: collar → split + a short taper into the toes ----
  const finEnd = Math.min(0.97, split + 0.12);
  const finRings = 12;
  let previous: number[] | null = null;
  const q = new Vector3();
  for (let k = 0; k <= finRings; k++) {
    const t = (k / finRings) * finEnd;
    const { p, r } = sampleAt(t);
    const ax = tangentAt(t);
    const side = new Vector3(-ax.z, 0, ax.x).normalize();
    const up = new Vector3().crossVectors(side, ax).normalize();
    if (up.y < 0) up.negate();
    // the fin: tall at the collar, round by the split; taper into the toes after it
    const fin = 1 - smoothstep(0.2, split, t);
    const taperOut = 1 - 0.55 * smoothstep(split, finEnd, t);
    const halfWidth = r * (1 + (o.flare - 1) * fin) * taperOut;
    const height = r * (1 + 0.5 * fin) * taperOut;
    const ringColor = o.color(p, t);
    const stiffness = o.stiffness ? o.stiffness(r, t) : stiffnessFor(r);
    const row: number[] = [];
    for (let j = 0; j <= sides; j++) {
      const a = ((j % sides) / sides) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // ridged top: two or three cords run along the root's top
      const ridge = 1 + 0.08 * Math.cos(a * 3 + t * 4 + toePhase) * Math.max(0, sa);
      q.copy(p).addScaledVector(side, ca * halfWidth * ridge).addScaledVector(up, sa * height * ridge);
      const g = o.groundAt(q.x, q.z);
      // the underside is buried: everything below the ground is pushed 4 cm under it
      if (q.y < g + 0.02) q.y = Math.min(q.y, g - 0.04);
      const upness = Math.max(0, sa);
      const mossN = 0.5 + 0.5 * o.noise.noise(q.x * 1.8 + 3.1, q.z * 1.8 - 7.7);
      const moss = smoothstep(0.35, 0.75, upness * 0.75 + mossN * 0.35) * (1 - smoothstep(0.7, 1, t));
      const soil = smoothstep(-0.2, -0.75, sa);
      _c.copy(ringColor).multiplyScalar(0.9 + 0.1 * sa).lerp(ROOT_MOSS, moss * 0.8).lerp(ROOT_SOIL, soil * 0.5);
      // the fin's flanks are occluded toward the ground; its top stays under the crests' lift
      const ao = 0.55 + 0.35 * smoothstep(-0.6, 0.5, sa);
      row.push(writer.vertex(q, _c, j / sides, t * 3, stiffness, o.draws.windPhase, packOcclusion(ao), 0));
    }
    writer.seams.push([row[0], row[sides]]);
    if (previous) {
      for (let j = 0; j < sides; j++) {
        writer.triangle(previous[j], previous[j + 1], row[j]);
        writer.triangle(previous[j + 1], row[j + 1], row[j]);
      }
    }
    previous = row;
  }
  // ---- the toes ----
  const toeTips: Vector3[] = [];
  const origin = sampleAt(split);
  const ax = tangentAt(split);
  const heading = Math.atan2(ax.z, ax.x);
  const remaining = sampleAt(1).p.distanceTo(origin.p);
  const axisReach = (pt: Vector3) => Math.hypot(pt.x, pt.z);
  for (let k = 0; k < toeCount; k++) {
    const spreadIndex = toeCount === 2 ? (k === 0 ? -1 : 1) : k - 1;
    const a = heading + spreadIndex * toeSpread + (rr() - 0.5) * 0.15;
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    let len = remaining * toeLenScale * (0.75 + rr() * 0.4) * (spreadIndex === 0 ? 1.1 : 0.9);
    // a toe never reaches further from the trunk axis than the plain root did
    const tipReach = axisReach(origin.p.clone().addScaledVector(dir, len));
    if (tipReach > o.maxReach) len = Math.max(0.6, len - (tipReach - o.maxReach));
    const r0 = origin.r * (toeCount === 3 ? 0.6 : 0.68) * (spreadIndex === 0 ? 1.1 : 1);
    const segs = 8;
    const toeSides = 8;
    const g0 = o.groundAt(origin.p.x, origin.p.z);
    const startAbove = origin.p.y - g0;
    let prevRow: number[] | null = null;
    let tip = origin.p.clone();
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const pt = origin.p.clone().addScaledVector(dir, len * t);
      // a little side wander
      pt.addScaledVector(new Vector3(-dir.z, 0, dir.x), Math.sin(t * 5 + toePhase + k) * 0.08 * len * t * (1 - t));
      const rad = 0.05 + (r0 - 0.05) * Math.pow(1 - t, 0.85);
      const g = o.groundAt(pt.x, pt.z);
      // rides down from the fin's centre onto the ground and dives under it at the tip
      pt.y = g + Math.max(0, startAbove) * Math.pow(1 - t, 1.6) + rad * 0.35 * (1 - t) - 0.22 * t * t;
      if (s === segs) pt.y = g - 0.22;
      const axT = s === 0 ? dir.clone() : pt.clone().sub(tip).normalize();
      if (axT.lengthSq() < 0.5) axT.copy(dir);
      const [su, sv] = frame(axT);
      const ringColor = o.color(pt, t);
      const stiffness = o.stiffness ? o.stiffness(rad, t) : stiffnessFor(rad);
      const row: number[] = [];
      for (let j = 0; j <= toeSides; j++) {
        const th = ((j % toeSides) / toeSides) * TAU;
        q.copy(pt).addScaledVector(su, Math.cos(th) * rad).addScaledVector(sv, Math.sin(th) * rad);
        const upness = Math.max(0, (q.y - pt.y) / Math.max(1e-3, rad));
        const mossN = 0.5 + 0.5 * o.noise.noise(q.x * 2.3 - 5.5, q.z * 2.3 + 2.2);
        const moss = smoothstep(0.4, 0.8, upness * 0.7 + mossN * 0.4) * (1 - smoothstep(0.6, 1, t));
        _c.copy(ringColor).multiplyScalar(0.88 + 0.12 * upness).lerp(ROOT_MOSS, moss * 0.75);
        const ao = 0.6 + 0.3 * upness;
        row.push(writer.vertex(q, _c, j / toeSides, t * 2, stiffness, o.draws.windPhase, packOcclusion(ao), 0));
      }
      writer.seams.push([row[0], row[toeSides]]);
      if (prevRow) {
        for (let j = 0; j < toeSides; j++) {
          writer.triangle(prevRow[j], prevRow[j + 1], row[j]);
          writer.triangle(prevRow[j + 1], row[j + 1], row[j]);
        }
      }
      prevRow = row;
      tip = pt;
    }
    toeTips.push(new Vector3(tip.x, o.groundAt(tip.x, tip.z), tip.z));
  }
  return { toes: toeCount, toeTips, triangles: writer.triangles - trisBefore };
}
