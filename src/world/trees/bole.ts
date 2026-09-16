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
import { GeometryWriter, TAU, frame, stiffnessFor, tubeRidge, type RandomFn, type TubeDraws } from './writer';

export type { TubeDraws } from './writer';

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
  /**
   * the plain sweep's cross-section roughness (writer.ts tube `roughness`): its fluting is kept
   * under the cords, and it is what makes the relief's end ring coincide with the plain ring the
   * far bole continues from (the ridge phase comes from `draws.phase`)
   */
  roughness?: number;
  /**
   * local heights over which the relief amplitude fades to ZERO toward the top of the sweep, so
   * the last ring is exactly the plain sweep's ring (a near-bole LOD that ends where the far bole
   * goes on). Applied after `fadeY`.
   */
  endFade?: [number, number];
  /** cap the last ring (default true; false when the far bole continues above it) */
  cap?: boolean;
  /**
   * local horizontal unit vector pointing away from the sun: the bole's shaded side wears moss
   * sheets low down (concept 05's mossy trunk), fading out over `sheetBand` local heights
   */
  shadeDir?: Vector3;
  sheetBand?: [number, number];
  /** a per-vertex moss addition (0–1, blended with the furrow moss): the caller's own sheet mask */
  mossExtra?: (p: Vector3, upness: number) => number;
  /**
   * rings whose centre this accepts are written collapsible (writer.ts woodCollapsible): a relief
   * bole that is itself the far sweep hands its lower rings to the tree's near base at close range
   */
  collapsible?: (p: Vector3) => boolean;
  /**
   * lichen crusts (round 40, the owner's bole brief): pale grey-green plates on the cords' crests
   * between the `band` local heights (fading in over 1 m below, out over 3 m above), `strength`
   * 0–1. Written into the vertex colour (a multiplier on the bark), never under the moss.
   */
  lichen?: { band: [number, number]; strength: number };
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
const _plain = new Color();

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
  // lichen plates: clusters 20–40 cm across, slow along the bole, with a finer edge field
  const lichenN = 0.6 * on(3.4, 0.35, 77.7, 12.1) + 0.4 * on(9.5, 1.1, 3.9, 91.2);
  return { cord, tintVar, mossN, lichenN };
}

/** lichen crust tint (multiplier on the crest's bark): pale, a little green, matte */
const LICHEN_TINT = new Color(1.55, 1.62, 1.42);

/**
 * The plain sweep's own frames at the coarse rings (writer.ts tube: the axis through the
 * neighbours, u parallel-transported ring to ring, the distance along the chords). `reliefBole`
 * replays and interpolates them so at every coarse ring its centre, frame and distance are
 * exactly the plain sweep's; `sweepAxisAt` gives the same frame to whatever else must sit on the
 * sweep (knee stubs, sleeves) at a distance along it.
 */
export function sweepFrames(points: Vector3[]): { axis: Vector3; u: Vector3; distance: number }[] {
  const coarse: { axis: Vector3; u: Vector3; distance: number }[] = [];
  let u: Vector3 | undefined;
  let distance = 0;
  for (let k = 0; k < points.length; k++) {
    if (k) distance += points[k].distanceTo(points[k - 1]);
    const axis = points[Math.min(points.length - 1, k + 1)].clone().sub(points[Math.max(0, k - 1)]).normalize();
    if (!u) u = frame(axis)[0];
    else {
      u = u.clone();
      u.addScaledVector(axis, -u.dot(axis));
      if (u.lengthSq() < 0.01) u = frame(axis)[0];
      u.normalize();
    }
    coarse.push({ axis, u: u.clone(), distance });
  }
  return coarse;
}

/** centre, ring frame (u, v), axis and nominal radius of a sweep at a distance along it */
export function sweepAxisAt(points: Vector3[], radii: number[]) {
  const coarse = sweepFrames(points);
  const total = coarse[coarse.length - 1].distance;
  return (distance: number) => {
    const d = Math.max(0, Math.min(total, distance));
    let i = 0;
    while (i < coarse.length - 2 && coarse[i + 1].distance <= d) i++;
    const a = coarse[i];
    const b = coarse[Math.min(coarse.length - 1, i + 1)];
    const f = b.distance > a.distance ? (d - a.distance) / (b.distance - a.distance) : 0;
    const axis = a.axis.clone().lerp(b.axis, f).normalize();
    const u = a.u.clone().lerp(b.u, f);
    u.addScaledVector(axis, -u.dot(axis));
    if (u.lengthSq() < 0.01) u.copy(frame(axis)[0]);
    u.normalize();
    const v = new Vector3().crossVectors(axis, u).normalize();
    const centre = points[i].clone().lerp(points[Math.min(points.length - 1, i + 1)], f);
    const radius = radii[i] + (radii[Math.min(radii.length - 1, i + 1)] - radii[i]) * f;
    return { centre, u, v, axis, radius, distance: d, total };
  };
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
  // the plain sweep's frames replayed (see sweepFrames): with the amplitude faded to zero at a
  // coarse ring the two surfaces coincide, and a near-bole LOD can end on the ring the far bole
  // continues from
  const coarse = sweepFrames(points);
  // dense resampling of the coarse path: linear in the ring parameter, so the axis and nominal
  // radius between the published rings are exactly the seat's
  const dense: { p: Vector3; r: number; t: number; k: number; axis: Vector3; u: Vector3; distance: number }[] = [];
  const at = (i: number, f: number) => {
    const a = coarse[i];
    const b = coarse[Math.min(coarse.length - 1, i + 1)];
    const axis = a.axis.clone().lerp(b.axis, f).normalize();
    const u = a.u.clone().lerp(b.u, f);
    u.addScaledVector(axis, -u.dot(axis));
    if (u.lengthSq() < 0.01) u.copy(frame(axis)[0]);
    u.normalize();
    return { axis, u, distance: a.distance + (b.distance - a.distance) * f };
  };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = a.distanceTo(b);
    const n = a.y < o.denseUntilY ? Math.max(1, Math.ceil(len / o.spacing)) : 1;
    for (let k = 0; k < n; k++) {
      const f = k / n;
      dense.push({ p: a.clone().lerp(b, f), r: radii[i] + (radii[i + 1] - radii[i]) * f, t: (i + f) / (points.length - 1), k: i + f, ...at(i, f) });
    }
  }
  dense.push({ p: points[points.length - 1].clone(), r: radii[radii.length - 1], t: 1, k: points.length - 1, ...at(points.length - 1, 0) });
  for (const d of dense) writer.logicalMaxY = Math.max(writer.logicalMaxY, d.p.y + d.r * 1.25);

  const circumference = TAU * radii[0];
  const uTiles = Math.max(1, Math.round(circumference / o.barkTile));
  const rows: number[][] = [];
  const v = new Vector3();
  const p = new Vector3();
  const nrm = new Vector3();
  let previous: number[] | null = null;
  let mossHits = 0;
  let mossCount = 0;
  const roughness = o.roughness ?? 0;
  const trisBefore = writer.triangles;
  for (let k = 0; k < dense.length; k++) {
    const d = dense[k];
    const { axis, u, distance } = d;
    v.crossVectors(axis, u).normalize();
    const ringColor = o.color(d.p, d.t);
    const stiffness = o.stiffness ? o.stiffness(d.r, d.t) : stiffnessFor(d.r);
    // relief amplitude: full over the hero band, `farShare` above the fade, zero at the end ring
    let amp = o.amplitude * (1 - (1 - o.farShare) * smoothstep(o.fadeY[0], o.fadeY[1], d.p.y));
    const endShare = o.endFade ? 1 - smoothstep(o.endFade[0], o.endFade[1], d.p.y) : 1;
    amp *= endShare;
    if (o.endFade && k === dense.length - 1) amp = 0;
    const mossBand = (1 - smoothstep(o.mossBand[0], o.mossBand[1], d.p.y)) * mossStrength;
    const sheetBand = o.shadeDir ? (1 - smoothstep(o.sheetBand?.[0] ?? 1.2, o.sheetBand?.[1] ?? 2.6, d.p.y)) * mossStrength : 0;
    const inBand = d.p.y >= 0 && d.p.y < o.mossBand[1];
    const lichenBand = o.lichen ? smoothstep(o.lichen.band[0] - 1, o.lichen.band[0], d.p.y) * (1 - smoothstep(o.lichen.band[1], o.lichen.band[1] + 3, d.p.y)) * o.lichen.strength : 0;
    const wasCollapsible = writer.woodCollapsible;
    if (o.collapsible) writer.woodCollapsible = o.collapsible(d.p);
    const row: number[] = [];
    for (let j = 0; j <= sides; j++) {
      const angle = ((j % sides) / sides) * TAU;
      let ridge = roughness ? tubeRidge(roughness, angle, o.draws.phase, d.k) : 1;
      let crevice = 1;
      if (o.bump) {
        const b = o.bump(angle, distance, d.t);
        ridge *= b;
        if (o.creviceShade) crevice = Math.max(0.55, Math.min(1.15, 1 + o.creviceShade * (b - 1)));
      }
      const { cord, tintVar, mossN, lichenN } = cordField(o.noise, angle, distance, o.refRadius, cords);
      const r = d.r * ridge + amp * (cord - 0.65);
      nrm.copy(u).multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle));
      p.copy(d.p).addScaledVector(nrm, r);
      if (k === 0 && o.flatBase) p.y = dense[0].p.y;
      // furrow occlusion (`crest` on the crests, aoFloor × it at the furrow bottoms, following the
      // cord's rounded flank) rides in aWind.z, negative; it follows the amplitude out at the end
      const ao = 1 + (crest * (aoFloor + (1 - aoFloor) * smoothstep(0, 1, cord)) - 1) * endShare;
      // colour: ring colour × the sweep's grain × the gnarl's crevice shade × cord tint × moss
      const grain = o.draws.grain[Math.floor(((j % sides) / sides) * grainN)];
      const shade = crevice * grain * (0.96 + 0.045 * Math.sin(distance * 2.1 + o.draws.phase));
      _tint.copy(grime).lerp(CREST_TINT, Math.pow(cord, 0.7));
      _tint.multiplyScalar(1 + 0.16 * tintVar * Math.pow(cord, 0.7));
      // furrow moss: packed at the bottom of the furrows where the moss noise favours it — the
      // crests and the flanks stay bare bark (a first cut at 0.42–0.78 with the cord weighted
      // 0.72 read as a green-felted bole from 1–3 m: concept 05 keeps 40–50 % bark showing)
      let moss = mossBand * smoothstep(0.58, 0.88, (1 - cord) * 0.6 + 0.4 * (0.5 + 0.5 * mossN));
      // moss sheets on the shaded side of the foot: ragged patches following the moss noise,
      // strongest where the surface faces away from the sun and lowest on the bole, with bare
      // bark between them
      if (o.shadeDir && sheetBand > 0) {
        const away = 0.5 + 0.5 * (nrm.x * o.shadeDir.x + nrm.z * o.shadeDir.z);
        const sheet = sheetBand * smoothstep(0.62, 0.9, away * 0.45 + 0.5 * (0.5 + 0.5 * mossN) + 0.12 * (1 - cord));
        moss = Math.max(moss, sheet);
      }
      if (o.mossExtra) moss = Math.max(moss, o.mossExtra(p, Math.max(0, nrm.y)));
      // lichen plates on the crests and upper flanks, never under the moss: a clustered field
      // with a soft edge, so the crusts read as patches 20–40 cm across, not as speckle
      if (lichenBand > 0) {
        const crust = smoothstep(0.32, 0.6, lichenN) * smoothstep(0.35, 0.75, cord) * lichenBand * (1 - Math.min(1, moss));
        _tint.lerp(LICHEN_TINT, Math.min(1, crust) * 0.75);
      }
      _tint.lerp(FURROW_MOSS, Math.min(1, moss) * 0.85 * (0.4 + 0.6 * endShare));
      if (inBand) {
        mossCount++;
        if (moss > 0.5) mossHits++;
      }
      _c.copy(ringColor).multiplyScalar(shade).multiply(_tint);
      // the end ring keeps the plain sweep's own colour so the seam does not show as a tint step
      if (o.endFade) _c.lerp(_plain.copy(ringColor).multiplyScalar(shade), 1 - endShare);
      // the moss cover itself goes to the shader (writer.ts woodMoss), out by the end ring
      writer.woodMoss = Math.min(1, moss) * endShare;
      row.push(writer.vertex(p, _c, (j / sides) * uTiles, distance / o.barkTile, stiffness, o.draws.windPhase, packOcclusion(ao), 0));
      writer.woodMoss = 0;
    }
    writer.woodCollapsible = wasCollapsible;
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
  if (o.cap !== false) {
    // the fork cap, inside the leaders as the plain sweep's was
    const end = rows[rows.length - 1];
    const last = dense[dense.length - 1];
    const cap = writer.vertex(last.p, o.color(last.p, 1), 0.5, last.distance / o.barkTile, o.stiffness ? o.stiffness(last.r, 1) : stiffnessFor(last.r), o.draws.windPhase, 0, 0);
    for (let j = 0; j < sides; j++) writer.triangle(cap, end[j], end[j + 1]);
  }
  return { rows, rings: dense.length, sides, mossShare: mossCount ? mossHits / mossCount : 0, amplitude: o.amplitude, triangles: writer.triangles - trisBefore };
}

/**
 * A knee on a bole (round 40, the owner's bole brief: "1–2 forks/knees on the visible run"): a
 * local swelling of the bole toward `azimuth` around the height `distance` along the sweep,
 * `reach` × the radius at its crest, `halfWidth` metres tall, and the broken-off stub limb that
 * leaves it (built by `kneeStub`). The swelling is the caller's `bump` term (`kneeBump`), so the
 * relief's cords ride over it and the silhouette bulges where the stub leaves.
 */
export interface BoleKnee {
  /** distance along the sweep (≈ local height on a near-vertical bole), m */
  distance: number;
  /** azimuth of the swelling and the stub in the ring frame (writer.ts `frame`), radians */
  azimuth: number;
  /** extra radius at the crest of the swelling, fraction of the bole radius */
  reach: number;
  /** vertical half-width of the swelling, m */
  halfWidth: number;
  /** stub limb length (m) and radius at its collar (fraction of the bole radius); 0 = a burl only */
  stubLength: number;
  stubRadius: number;
  /** stub elevation above horizontal, radians */
  stubPitch: number;
}

/** the knees' swelling as a radius multiplier at (angle, distance) — composes with any bump */
export function kneeBump(knees: BoleKnee[], angle: number, distance: number): number {
  let m = 1;
  for (const k of knees) {
    const d = (distance - k.distance) / k.halfWidth;
    if (Math.abs(d) > 2.5) continue;
    // one-sided: the swelling is a collar under the stub, fuller below it than above
    const along = Math.exp(-d * d * (d < 0 ? 0.6 : 1.4));
    const around = Math.pow(0.5 + 0.5 * Math.cos(angle - k.azimuth), 1.6);
    m += k.reach * along * around;
  }
  return m;
}

/**
 * The broken stub that leaves a knee: a short, tapering, slightly rising limb that ends in a
 * ragged snapped face (an irregular cap ring pushed inward), swept from its own draws so the
 * caller's stream is untouched. `axisAt` gives the bole's centre and ring frame at a distance.
 */
export function kneeStub(
  writer: GeometryWriter,
  knee: BoleKnee,
  boleRadius: number,
  axisAt: (distance: number) => { centre: Vector3; u: Vector3; v: Vector3; axis: Vector3 },
  color: (point: Vector3, t: number) => Color,
  rng: Rng,
  noise: Noise2D,
  mossStrength = 0.6,
): number {
  if (knee.stubLength <= 0) return 0;
  const trisBefore = writer.triangles;
  const { centre, u, v, axis } = axisAt(knee.distance);
  const out = u.clone().multiplyScalar(Math.cos(knee.azimuth)).addScaledVector(v, Math.sin(knee.azimuth)).normalize();
  const dir = out.clone().multiplyScalar(Math.cos(knee.stubPitch)).addScaledVector(axis, Math.sin(knee.stubPitch)).normalize();
  const r0 = boleRadius * knee.stubRadius;
  const segs = 7;
  const sides = 12;
  const bendPhase = rng() * TAU;
  const bend = 0.12 + rng() * 0.18;
  const [su, sv] = frame(dir);
  const snapPhase = rng() * TAU;
  const q = new Vector3();
  let previous: number[] | null = null;
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    // starts inside the collar, rises a little, droops at the broken end
    const p = centre.clone().addScaledVector(out, boleRadius * (1 + knee.reach) * 0.55).addScaledVector(dir, knee.stubLength * t);
    p.addScaledVector(sv, Math.sin(t * 2.6 + bendPhase) * bend * knee.stubLength * t);
    p.addScaledVector(axis, -0.25 * knee.stubLength * t * t * t);
    const taperR = r0 * (1 - 0.55 * Math.pow(t, 1.4));
    const ringColor = color(p, t);
    const stiffness = stiffnessFor(taperR);
    const row: number[] = [];
    for (let j = 0; j <= sides; j++) {
      const a = ((j % sides) / sides) * TAU;
      // the snapped face: the last ring is pushed unevenly toward the axis
      const snap = k === segs ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(a * 3 + snapPhase)) * (0.5 + 0.5 * noise.noise(a * 1.3 + snapPhase, 7.7)) : 1;
      const cord = 1 + 0.09 * (0.5 + 0.5 * Math.cos(a * 5 + t * 4 + bendPhase)) + 0.05 * noise.noise(a * 1.1 + bendPhase, t * 6);
      q.copy(p).addScaledVector(su, Math.cos(a) * taperR * cord * snap).addScaledVector(sv, Math.sin(a) * taperR * cord * snap);
      const upness = Math.max(0, (q.y - p.y) / Math.max(1e-3, taperR));
      const mossN = 0.5 + 0.5 * noise.noise(q.x * 2.1 + 3.3, q.z * 2.1 + q.y * 0.7);
      const moss = smoothstep(0.62, 0.95, upness * 0.6 + mossN * 0.55) * (1 - smoothstep(0.7, 1, t)) * mossStrength;
      _c.copy(ringColor).multiplyScalar(0.86 + 0.14 * upness).lerp(ROOT_MOSS, moss * 0.8);
      if (k === segs) _c.multiplyScalar(0.7 + 0.2 * snap);
      const ao = 0.62 + 0.3 * upness;
      writer.woodMoss = moss;
      row.push(writer.vertex(q, _c, j / sides, t * 2, stiffness, 0, packOcclusion(ao), 0));
      writer.woodMoss = 0;
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
  // the snapped face: a sunken heartwood cap
  if (previous) {
    const end = centre.clone().addScaledVector(out, boleRadius * (1 + knee.reach) * 0.55).addScaledVector(dir, knee.stubLength * (1 - 0.06)).addScaledVector(axis, -0.25 * knee.stubLength);
    const cap = writer.vertex(end, color(end, 1).multiplyScalar(0.55), 0.5, 2, 1, 0, packOcclusion(0.45), 0);
    for (let j = 0; j < sides; j++) writer.triangle(cap, previous[j], previous[j + 1]);
  }
  return writer.triangles - trisBefore;
}

/**
 * Moss sheets up the shaded side of a bole (round 40): a `mossExtra` mask for `reliefBole` —
 * strongest where the surface faces away from the sun (`shadeDir`, local horizontal unit vector
 * pointing away from it), fading out between `band` local heights with a ragged, noise-driven
 * edge so the sheets end in tongues and islands, not a level line. `strength` 0–1.
 */
export function shadedSheetMask(shadeDir: Vector3, noise: Noise2D, band: [number, number], strength: number, centreAt: (y: number) => { x: number; z: number } = () => ({ x: 0, z: 0 })) {
  return (p: Vector3, _upness: number) => {
    const c = centreAt(p.y);
    const nx = p.x - c.x;
    const nz = p.z - c.z;
    const len = Math.hypot(nx, nz) || 1;
    const away = 0.5 + 0.5 * ((nx / len) * shadeDir.x + (nz / len) * shadeDir.z);
    const edgeN = noise.fbm(nx * 1.4 + 9.3, p.y * 0.55 + nz * 1.4, 3);
    const top = band[1] + 2.2 * edgeN;
    const heightBand = (1 - smoothstep(top - 1.5, top, p.y)) * smoothstep(band[0] - 0.5, band[0] + 0.5, p.y);
    // ragged sheets, not a felt: on the fully shaded side the patch noise leaves ≈ 50 % of the
    // bark bare between the sheets (a first cut at smoothstep(0.55, 0.9, 0.7 away + 0.45 patch)
    // read as one green column from the plaza, 0.68–0.82 on 0.5/0.5 still ≈ 70 % covered), on the
    // flanks only the odd patch survives
    const patch = 0.5 + 0.5 * noise.noise(nx * 2.0 + p.y * 0.7 + 41.1, nz * 2.0 - p.y * 0.35 + 17.3);
    return smoothstep(0.74, 0.86, away * 0.5 + patch * 0.5) * heightBand * strength;
  };
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
  /** fin height at the collar as a multiple of the plain root's radius (default 1.5) */
  finHeight?: number;
  /**
   * path mask (0–1) under a local (x, z): where a ring's centre stands on paving the fin shrinks
   * to the plain root's section and is pressed under the surface, so no near root ever stands
   * proud of a walk corridor the far root only skimmed
   */
  pathAt?: (x: number, z: number) => number;
  /** 0–1 moss strength on the top faces (default 1) */
  mossStrength?: number;
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
  const sides = 22;
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
  const finRings = 14;
  const finH = o.finHeight ?? 1.5;
  const mossStrength = o.mossStrength ?? 1;
  let previous: number[] | null = null;
  const q = new Vector3();
  for (let k = 0; k <= finRings; k++) {
    const t = (k / finRings) * finEnd;
    const { p, r } = sampleAt(t);
    const ax = tangentAt(t);
    const side = new Vector3(-ax.z, 0, ax.x).normalize();
    const up = new Vector3().crossVectors(side, ax).normalize();
    if (up.y < 0) up.negate();
    // the fin: tall at the collar, round by the split; taper into the toes after it; on paving
    // it shrinks back to the plain root's section
    const paved = o.pathAt ? smoothstep(0.2, 0.6, o.pathAt(p.x, p.z)) : 0;
    const fin = (1 - smoothstep(0.2, split, t)) * (1 - paved);
    const taperOut = 1 - 0.55 * smoothstep(split, finEnd, t);
    const halfWidth = r * (1 + (o.flare - 1) * fin) * taperOut;
    const height = r * (1 + (finH - 1) * fin) * taperOut;
    const ringColor = o.color(p, t);
    const stiffness = o.stiffness ? o.stiffness(r, t) : stiffnessFor(r);
    const row: number[] = [];
    for (let j = 0; j <= sides; j++) {
      const a = ((j % sides) / sides) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // gnarled: five cords run the root's length around the whole section (deepest on top,
      // where they read against the sky), knuckles swell along it, and a finer grain rides both
      const cordP = 0.5 + 0.5 * Math.cos(a * 5 + t * 6 + toePhase + 1.2 * o.noise.noise(a * 0.8 + toePhase, t * 3.0));
      const cordH = Math.pow(cordP, 0.7);
      const knuckle = o.noise.noise(t * 7.5 + toePhase * 2.0, a * 0.5);
      const ridge = 1 + (0.13 * (0.55 + 0.45 * Math.max(0, sa))) * (cordH - 0.5) + 0.06 * knuckle + 0.03 * o.noise.noise(a * 1.9 + toePhase, t * 9.0);
      q.copy(p).addScaledVector(side, ca * halfWidth * ridge).addScaledVector(up, sa * height * ridge);
      const g = o.groundAt(q.x, q.z);
      // the underside is buried: everything below the ground is pushed 4 cm under it; on paving
      // the whole section is pressed down so nothing stands proud of the slabs
      if (q.y < g + 0.02) q.y = Math.min(q.y, g - 0.04);
      if (paved > 0) q.y = Math.min(q.y, g - 0.03 + (1 - paved) * (q.y - g + 0.03));
      const upness = Math.max(0, sa);
      const mossN = 0.5 + 0.5 * o.noise.noise(q.x * 1.8 + 3.1, q.z * 1.8 - 7.7);
      // moss on the top faces: cushions where the fin's back faces up AND the moss noise favours
      // it, ragged toward the toes — the flanks and the grooves between cushions stay bark
      const moss = smoothstep(0.68, 1.0, upness * 0.55 + mossN * 0.6 - 0.15 * t) * (1 - smoothstep(0.65, 1, t)) * mossStrength;
      const soil = smoothstep(-0.2, -0.75, sa);
      _c.copy(ringColor).multiplyScalar(0.9 + 0.1 * sa).lerp(ROOT_MOSS, moss * 0.85).lerp(ROOT_SOIL, soil * 0.5);
      // the fin's flanks are occluded toward the ground, its cord grooves a little more; its top
      // stays under the crests' lift
      const ao = (0.55 + 0.35 * smoothstep(-0.6, 0.5, sa)) * (0.82 + 0.18 * cordH);
      writer.woodMoss = moss;
      row.push(writer.vertex(q, _c, j / sides, t * 3, stiffness, o.draws.windPhase, packOcclusion(ao), 0));
      writer.woodMoss = 0;
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
      // rides down from the fin's centre onto the ground and dives under it at the tip; on paving
      // it is pressed under the slabs
      const paved = o.pathAt ? smoothstep(0.2, 0.6, o.pathAt(pt.x, pt.z)) : 0;
      pt.y = g + (Math.max(0, startAbove) * Math.pow(1 - t, 1.6) + rad * 0.35 * (1 - t)) * (1 - paved) - 0.22 * t * t - paved * rad * 1.1;
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
        const moss = smoothstep(0.58, 0.92, upness * 0.6 + mossN * 0.5) * (1 - smoothstep(0.6, 1, t)) * mossStrength;
        _c.copy(ringColor).multiplyScalar(0.88 + 0.12 * upness).lerp(ROOT_MOSS, moss * 0.75);
        const ao = 0.6 + 0.3 * upness;
        writer.woodMoss = moss * 0.85;
        row.push(writer.vertex(q, _c, j / toeSides, t * 2, stiffness, o.draws.windPhase, packOcclusion(ao), 0));
        writer.woodMoss = 0;
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
