/**
 * Giant hollow log arch: a fallen trunk of radius ~3.6 m whose ends are sunk into the ground
 * while its belly arches over the north path. Open, obliquely broken and splintered ends show
 * the hollow interior; bark ridges run along the length; moss cushions and draped moss sheets,
 * grass tufts, ferns and heart-leaf vines grow on top and hang from the flanks and underside;
 * two pod lanterns hang under the arch and three more under the near (west) end (sheet 01).
 *
 * Round 21 (reference D at 2×: a huge fallen trunk with deep bark ridges, a thick lumpy moss
 * crown hanging unevenly down the flanks, roots and ferns at its feet): the bark relief is
 * deeper (ridges ±0.37 m, 0.6 m fissures, raised plates) with wider baked occlusion and grime in
 * the fissures, the body ×0.78 darker so it reads as a mass under the haze; the moss cap is
 * thicker and lumpier with a wandering edge, fringed with hanging moss beards and leaf clumps;
 * root flares run from the sunk ends out over the ground among fern beds. New detail on new rng
 * forks only — the stubs', vegetation's, sheets' and lanterns' streams keep their draws.
 */
import { BoxGeometry, type BufferGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Group, LOD, Matrix4, Mesh, PlaneGeometry, PointLight, Quaternion, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { TAU, angleDiff, basisMatrix, faceTowards, gridSurface, merge, setColorAttribute, sweepTube } from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternKind, type LanternRig } from './lantern';
import { FAR_HALO_EAST_SCALE, Noise3D, type StructureMaterials } from './materials';
import { buildMossTufts, type MossTuftSpec } from './mossTufts';

export interface LogArchBuild {
  group: Group;
  bases: [number, number, number][];
  lanterns: LanternRig[];
  /** world centres of the pods (audit: project into D — the frame's arch lanterns sit at (0.60–0.65, 0.33) and (0.46, 0.44)) */
  podPositions: [number, number, number][];
  /** round 44 (structures-28): each pod's lowest point over the ground under it, and whether that ground is the path */
  podClearance: { pod: [number, number, number]; bottom: number; ground: number; clearance: number; onPath: boolean; onStrip: boolean; spineDist: number }[];
  /** the least clearance (m) of any pod hanging over the walkable strip (± layout.pathHalfWidth of the spine; Infinity when none does) */
  minPathClearance: number;
  lights: PointLight[];
  leaves: number;
  tufts: number;
  /** round 41 (structures-26): the close-scale detail as built */
  detail41: {
    outerGrid: [number, number];
    mossTufts: number;
    mossTuftTriangles: number;
    rimSplinters: number;
    skirtTriangles: number;
    /** the cap-moss carpet patches inside the crown's cushion colonies (grid, triangles) */
    carpetGrid: [number, number];
    carpetTriangles: number;
    trefoils: number;
    beards: number;
    rootTufts: number;
    /** the tufts + skirt LOD: its centre and the camera distance beyond which they are dropped (m) */
    tuftLod: { centre: [number, number, number]; dropBeyondM: number };
    /** round 43 (structures-27): the hollow's interior grid and its fungus shelves */
    innerGrid: [number, number];
    fungusShelves: number;
  };
  /** round 44 (structures-28): the player-height bark shell and the root footing, under their own LOD */
  detail44: {
    /** bark plates standing off the body (west half + the crossing), their triangles */
    barkPlates: number;
    barkPlateTriangles: number;
    /** the along / around extent the plates cover (m along the axis from the west rim; arc fraction of the circumference) */
    plateCoverage: { sTo: number; arcShare: number };
    /** humus skirts where the sunk ends meet the ground (both ends), their triangles */
    footSkirts: number;
    footSkirtTriangles: number;
    /** broken bark chunks lying at the feet */
    barkChunks: number;
    /** the near-detail LOD: its centre and the camera distance beyond which it is dropped (m) */
    nearLod: { centre: [number, number, number]; dropBeyondM: number };
  };
}

interface Spike {
  psi: number;
  width: number;
  length: number;
}

export function buildLogArch(ctx: WorldContext, mats: StructureMaterials, rng: Rng): LogArchBuild {
  const def = ctx.layout.logArch;
  const terrain = ctx.terrain;
  const noise = new Noise2D(`${ctx.config.seed}/structures/log`);
  const group = new Group();
  group.name = 'log-arch';

  const R = def.radius;
  const L = def.length;
  const sink = 1.0;
  const rise = 4.1;
  const wall = 0.55;
  const yaw = (def.yawDeg * Math.PI) / 180;
  const A = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); // long axis (east, slightly north)
  const cx = def.position[0];
  const cz = def.position[2];
  const h0 = terrain.height(cx - A.x * (L / 2), cz - A.z * (L / 2));
  const h1 = terrain.height(cx + A.x * (L / 2), cz + A.z * (L / 2));

  // axis: ends sunk, parabolic arch in the middle; the west third bends gently south so the
  // broken hollow end faces the path (shot D) rather than pointing straight west
  const S = new Vector3(-A.z, 0, A.x); // horizontal normal of the axis, pointing south-ish
  const yc = (s: number) => lerp(h0, h1, (s + L / 2) / L) + R - sink + rise * Math.max(0, 1 - ((2 * s) / L) ** 2);
  // quadratic so the slope (and hence the end's facing) is largest at the tip: ~25° toward south
  const bend = (s: number) => 1.8 * clamp((-L * 0.15 - s) / (L * 0.35), 0, 1) ** 2;
  const axisAt = (s: number, out = new Vector3()) => out.set(cx + A.x * s + S.x * bend(s), yc(s), cz + A.z * s + S.z * bend(s));
  const tangentAt = (s: number, out = new Vector3()) => {
    const e = 0.05;
    const p0 = axisAt(s - e);
    const p1 = axisAt(s + e);
    return out.subVectors(p1, p0).normalize();
  };
  const UP = new Vector3(0, 1, 0);
  const _t = new Vector3();
  const _u = new Vector3();
  const _r = new Vector3();
  /** cross-section basis at s: right (horizontal) and up (perpendicular to the axis) */
  const frameAt = (s: number) => {
    tangentAt(s, _t);
    _u.copy(UP).addScaledVector(_t, -UP.dot(_t)).normalize();
    _r.crossVectors(_t, _u).normalize();
    return { t: _t, u: _u, r: _r };
  };
  /** ψ: 0 = +right (south side), π/2 = top, π = north side, -π/2 = bottom */
  const surfacePoint = (psi: number, s: number, r: number, out = new Vector3()) => {
    const f = frameAt(s);
    axisAt(s, out);
    out.addScaledVector(f.r, Math.cos(psi) * r).addScaledVector(f.u, Math.sin(psi) * r);
    return out;
  };
  const radialDir = (psi: number, s: number, out = new Vector3()) => {
    const f = frameAt(s);
    return out.copy(f.r).multiplyScalar(Math.cos(psi)).addScaledVector(f.u, Math.sin(psi)).normalize();
  };

  // ---- broken ends: oblique cut (west end faces south-west toward shot D) + splinter spikes ----
  const spikeRng = rng.fork('spikes');
  const makeSpikes = (n: number, maxLen: number): Spike[] => {
    const out: Spike[] = [];
    for (let i = 0; i < n; i++) out.push({ psi: (i / n) * TAU + spikeRng() * (TAU / n) * 0.8, width: 0.12 + spikeRng() * 0.26, length: 0.5 + spikeRng() * maxLen });
    return out;
  };
  // the west (shot D) end is the hero break: many long, narrow splinters make a jagged rim
  const spikesW = makeSpikes(11, 1.9);
  const spikesE = makeSpikes(6, 1.3);
  /**
   * Round 44 (structures-28): a BROKEN-WOOD rim, not a saw of triangles. Survey-1 crop 06: the
   * pow(1 − d, 1.4) spikes read as flat tan triangles from the path. A torn trunk breaks in
   * CHUNKS — fibre bundles that hold their full length across most of their width and fail
   * steeply at the sides (a plateau profile, `smoothstep(1, 0.5, d)`), their tips ragged with
   * finger-width FIBRES (a ridged term at ≈ 12 cm round the rim, ± 0.16 m) and a slow wobble.
   * The plateau carries ≈ 1.8× the pointed profile's area at the same width, so the widths are
   * held at 0.55× (the same rng draws) — the mass D sees at the west break is the round-21 one
   * within a few px, and the lengths are unchanged so its reach is too.
   */
  const spikeAmount = (psi: number, spikes: Spike[], end: number) => {
    let a = 0;
    for (const sp of spikes) {
      const d = Math.abs(angleDiff(psi, sp.psi)) / (sp.width * 0.55);
      if (d < 1) a += sp.length * smoothstep(1, 0.5, d) * (0.92 + 0.08 * Math.cos(d * 7));
    }
    const arc = psi * R;
    return a + 0.16 * (noise.ridged(arc * 3.2 + 13 + end * 7, 0.7 + end, 2) - 0.5) + 0.05 * noise.noise(arc * 7.5 + end * 3, 2.2);
  };
  // west end: strongly oblique (the south lip is ~3.4 m shorter than the north) so the hollow
  // opens toward the path and shot D
  const sEndW = (psi: number) => -L / 2 - 1.7 * (1 - Math.cos(psi)) - spikeAmount(psi, spikesW, 0) + 0.3 * noise.noise(psi * 3, 1.5);
  const sEndE = (psi: number) => L / 2 + 0.35 * (1 + Math.cos(psi + 1)) + spikeAmount(psi, spikesE, 1) + 0.25 * noise.noise(psi * 3, 8.5);

  // ---- radius model: bulges along the length, bark ridges along the axis, moss cushions on top ----
  const rBase = (psi: number, s: number) => {
    const taper = 1 + 0.07 * ((s + L / 2) / L) - 0.05 * (1 - (s + L / 2) / L);
    const bulge = 1 + 0.05 * noise.fbm(s * 0.18, Math.cos(psi) * 0.6, 2) + 0.03 * noise.noise(s * 0.4 + 3, Math.sin(psi) * 0.8);
    return R * taper * bulge;
  };
  const upness = (psi: number) => Math.sin(psi);
  /**
   * Round 21: the moss crown's edge wanders (±0.22 in upness, ≈ ±0.7 m of arc) so the cap's
   * boundary on the flanks is a ragged, shaggy line, not a level one — reference D's crown
   * hangs unevenly down the flanks. Shared by the relief and the colour mask so they agree.
   */
  const mossEdge = (psi: number, s: number) => 0.22 * noise.noise(s * 1.1 + 3, psi * R * 0.9);
  /** thickness of the moss cap (metres) — a real cushion on the upper third, feathering out on the flanks
   *  (round 21: thicker and lumpier — 0.22 + 0.42 cushions + 0.18 clumps, was 0.16 / 0.3 / 0.12) */
  const mossCap = (psi: number, s: number, up: number) => {
    const arc = psi * R;
    const cushions = 0.5 + 0.5 * noise.fbm(arc * 0.7 + 4, s * 0.7, 2);
    const clumps = noise.ridged(arc * 1.4 + 2, s * 1.1, 2);
    return smoothstep(0.08, 0.75, up + mossEdge(psi, s)) * (0.22 + 0.42 * cushions + 0.18 * clumps);
  };
  /**
   * bark relief only (no moss): broad longitudinal ridges, deep narrow fissures, lumps, grain.
   * Round 21: deeper — the ridges' swing ×1.5 (±0.37 m), the fissures 0.6 m (was 0.4), a second
   * finer ridge set at ×0.2, and raised bark PLATES (0.12 m) between the fissures, so the trunk
   * body reads as a corrugated mass in D rather than a hazed cylinder.
   */
  const barkCoarse = (psi: number, s: number) => {
    const arc = psi * R;
    const twist = noise.noise(s * 0.1, arc * 0.05) * 1.6 + s * 0.06;
    const ridge = noise.ridged(arc * 1.1 + twist, s * 0.16, 3);
    const ridge2 = noise.ridged(arc * 2.4 + twist * 1.5 + 5, s * 0.3, 2);
    const furrow = Math.pow(Math.max(0, noise.noise(arc * 0.55 + 17, s * 0.09)), 2);
    // fissures: sharp valleys where the slow noise crosses zero, running along the trunk
    const fissure = Math.pow(1 - Math.abs(noise.noise(arc * 0.8 + 31 + twist * 0.5, s * 0.07)), 9);
    const lumps = noise.fbm(arc * 0.32, s * 0.28, 3);
    const fine = noise.noise(arc * 2.6, s * 2.6);
    const plates = smoothstep(0.1, 0.5, noise.noise(arc * 0.9 + 51, s * 0.45));
    return (ridge - 0.5) * 0.75 + (ridge2 - 0.5) * 0.2 - furrow * 0.4 - fissure * 0.6 + lumps * 0.25 + fine * 0.03 + plates * 0.12;
  };
  /**
   * Round 41 (structures-26): the CLOSE-SCALE bark — what the player sees from the path 2–6 m
   * under and beside the arch, where round 21's ±0.37 m ridges at a 10 cm vertex pitch read as
   * smooth bulges. A third cord octave (≈ 30 cm bundles, ±4 cm) following the same twist, narrow
   * CRACKS (≈ 8 cm wide, 8–12 cm deep, every 40–60 cm along the cords) and chipped plate edges.
   * Metre-scale features average out at camera D's 6 cm / px; the grid is denser (`cols` / `rows`
   * below, weighted to the west half the path passes) so they resolve at 2 m.
   */
  const barkFine = (psi: number, s: number) => {
    const arc = psi * R;
    const twist = noise.noise(s * 0.1, arc * 0.05) * 1.6 + s * 0.06;
    const cords3 = noise.ridged(arc * 3.2 + twist * 2 + 9, s * 0.9, 2) - 0.5;
    const crack = Math.pow(1 - Math.abs(noise.noise(arc * 2.0 + 47 + twist, s * 0.5 + 3)), 10);
    const chip = smoothstep(0.55, 0.75, noise.noise(arc * 3.6 + 71, s * 2.1 - 5));
    return cords3 * 0.08 - crack * 0.11 - chip * 0.025;
  };
  const bark = (psi: number, s: number) => barkCoarse(psi, s) + barkFine(psi, s);
  const detail = (psi: number, s: number, up: number) => bark(psi, s) + mossCap(psi, s, up);
  /**
   * Round 41 (structures-26): the crown moss as CUSHION COLONIES, the recipe of Saria's cap
   * (round 40, accepted): a 3D field over the surface point picks 0.4–0.8 m colonies; the sheet is
   * a SHADED FLOOR between them (× `CROWN_FLOOR`, the damp shadow between cushions) with the
   * colony hearts lifted (× `CROWN_HEART`), and the cushion tufts stand only on the hearts, so at
   * 3 m the crown reads as clumped cushions on a dark bed and from D as a lumpy mass — a uniform
   * scatter of lumps on the plain sheet read as pebbles on bark. Shared by the sheet's colour
   * (`outerColor`) and the tuft placement so they agree.
   */
  const n3 = new Noise3D(rng.fork('tuft-noise41'));
  const colonyField = (p: Vector3) => 0.5 + 0.5 * n3.noise(p.x * 2.2 + 1.7, p.y * 2.2, p.z * 2.2 + 4.1);
  const colony = (p: Vector3) => smoothstep(0.41, 0.48, colonyField(p));
  const CROWN_FLOOR = 0.5;
  const CROWN_HEART = 1.1;
  const outerColor = (psi: number, s: number, disp: number, p: Vector3): [number, number, number] => {
    const up = upness(psi);
    const arc = psi * R;
    const patches = noise.fbm(arc * 0.5 + 9, s * 0.5, 2);
    // the occlusion swing follows the metre-scale relief; the fine cords and cracks add a
    // smaller share (×0.6) so D's hazed mass keeps its round-21 level and the close views get
    // grime in the cracks
    const relief = barkCoarse(psi, s) + 0.6 * barkFine(psi, s);
    // moss covers the cap and creeps down the flanks in patches (more on the shaded north side)
    const m = clamp(smoothstep(0.05, 0.6, up + mossEdge(psi, s)) * (0.8 + 0.5 * patches) + 0.25 * smoothstep(0.35, 0.75, noise.noise(arc * 1.1, s * 1.1 + 2)) * smoothstep(-0.5, 0.4, up), 0, 1);
    // strong occlusion in furrows and fissures, lit crests: this is what makes the ridges read
    // at 30 m through the haze where the normal map alone would be lost (round 21: the swing is
    // wider with the deeper relief — floor 0.12, crests 1.4 — and grime sits in the fissures)
    const ao = clamp(0.55 + 1.8 * relief, 0.12, 1.4);
    const vari = 0.85 + 0.3 * noise.noise(arc * 0.9, s * 0.9 + 7);
    // the underside and the shaded lower flanks get no sky: bake the occlusion so the belly of
    // the arch stays dark in the flat ambient light of the hollow (reference: the mass under
    // the crown reads ≈ 0.63 of the haze luminance)
    const belly = lerp(0.42, 1, smoothstep(-0.95, 0.35, up));
    const shade = ao * vari * belly;
    // damp, weathered grey-brown bark (the material tint + dark bark map carry the rest).
    // Round 21: ×0.78 — D's arch mass rendered p50 0.481 against the reference's 0.404 with the
    // surrounding haze at ≈ 0.5: the body has to be darker under the veil to read as a mass
    const grime = smoothstep(-0.15, -0.4, relief);
    const barkC = [0.78 * shade * (1 - 0.25 * grime), 0.75 * shade * (1 - 0.15 * grime), 0.7 * shade * (1 - 0.3 * grime)];
    // olive moss: yellow-green on the lit cushions, deep green in the hollows; the bark map
    // underneath is brown, so the green has to be pushed hard through the vertex tint
    // round 41: the shaded floor between the cushion colonies and the lifted hearts, only where
    // the moss is a real cushion (thick cap, m high) — the flanks' creeping patches keep their tone
    const bed = m * smoothstep(0.15, 0.4, mossCap(psi, s, up));
    const heart = lerp(1, lerp(CROWN_FLOOR, CROWN_HEART, colony(p)), bed);
    const mossC = [(1.3 + 0.8 * shade) * heart, (2.4 + 1.4 * shade) * heart, (0.5 + 0.3 * shade) * heart];
    return [lerp(barkC[0], mossC[0], m), lerp(barkC[1], mossC[1], m), lerp(barkC[2], mossC[2], m)];
  };

  const _n = new Vector3();
  // round 41: 224 × 160 → 272 × 208 (7.9 cm round, 8.3 cm along on the west half): the rows are
  // warped so 60 % of them cover the west 45 % of the length — the broken end and the path
  // crossing the player walks under — and the east body, 10–20 m from the path, keeps ≈ 14 cm
  const cols = 272;
  const rows = 208;
  const rowWarp = (f: number) => (f < 0.6 ? (f / 0.6) * 0.45 : 0.45 + ((f - 0.6) / 0.4) * 0.55);
  const outer = gridSurface(
    (u, f, out) => {
      const psi = u * TAU;
      const v = rowWarp(f);
      const s = lerp(sEndW(psi), sEndE(psi), v);
      const disp = detail(psi, s, upness(psi));
      const r = rBase(psi, s) + disp;
      surfacePoint(psi, s, r, out.position);
      out.uv = [(psi * R) / 2.6, s / 2.6];
      out.color = outerColor(psi, s, disp, out.position);
    },
    { cols, rows, closedU: true },
  );

  // hollow interior (BackSide material) — ends slightly inside the outer ends.
  // Round 43 (structures-27): the tunnel at player height. Round 21's hollow was a smooth 96 × 48
  // tube under the near-black interior tint; from the west mouth the player now sees a hollow
  // trunk's inside — LONGITUDINAL FISSURES (deep cracks running along the wood) and CRACKED
  // HEARTWOOD standing in plates between them, a fine long grain, DRIP STAINS running down the
  // upper walls from the rim, MOSS on the lower walls and floor within a few metres of the mouths,
  // a WORN FLOOR of packed debris with litter lumps along the bottom, and the walls darkening
  // toward the middle of the tunnel (vertex colours on `logInterior`, which now takes them).
  // The grid is denser and, like the outer shell, weighted to the west half the path passes.
  const innerCols = 144;
  const innerRows = 120;
  /** metres to the nearest mouth along the axis */
  const mouthDist = (psi: number, s: number) => Math.min(s - sEndW(psi), sEndE(psi) - s);
  const innerRelief = (psi: number, s: number) => {
    const arc = psi * R;
    const fissure = Math.pow(1 - Math.abs(noise.noise(arc * 0.9 + 7, s * 0.12)), 6);
    const crack2 = Math.pow(1 - Math.abs(noise.noise(arc * 2.1 + 23, s * 0.3 + 1)), 8);
    const plate = smoothstep(0.15, 0.6, noise.noise(arc * 1.4 + 3, s * 0.7));
    const grain = noise.ridged(arc * 6 + 1, s * 0.5, 2) - 0.5;
    return { fissure, crack2, plate, grain, r: 0.06 * noise.noise(psi * 2, s * 0.6) + 0.14 * fissure + 0.06 * crack2 - 0.05 * plate + 0.02 * grain };
  };
  /** the debris floor's height over the hollow's bottom at s (deeper fill toward the mouths, where it blows in) */
  const floorFill = (s: number) => 0.28 + 0.12 * smoothstep(6, 0, Math.min(s - sEndW(-Math.PI / 2), sEndE(-Math.PI / 2) - s)) + 0.04 * noise.noise(s * 0.7 + 5, 2.5);
  const _axis = new Vector3();
  const inner = gridSurface(
    (u, f, out) => {
      const psi = u * TAU;
      const v = rowWarp(f);
      const s = lerp(sEndW(psi) + 0.12, sEndE(psi) - 0.12, v);
      const rel = innerRelief(psi, s);
      const r = rBase(psi, s) - wall + rel.r;
      surfacePoint(psi, s, r, out.position);
      const up = upness(psi);
      const dMouth = mouthDist(psi, s);
      // the worn floor: the bottom of the hollow is filled level with packed debris, litter lumps on it
      axisAt(s, _axis);
      const bottomY = _axis.y - (rBase(-Math.PI / 2, s) - wall);
      const floorY = bottomY + floorFill(s);
      let onFloor = 0;
      if (out.position.y < floorY) {
        const litter = 0.035 * Math.max(0, noise.noise(out.position.x * 4.1, out.position.z * 4.1 + 3)) + 0.012 * noise.noise(out.position.x * 13, out.position.z * 13);
        onFloor = smoothstep(0, 0.15, floorY - out.position.y);
        out.position.y = floorY + litter * onFloor;
      }
      out.uv = [(psi * R) / 2.6, s / 2.6];
      // shade: darker into the tunnel, fissures dark, plate edges catching what light there is
      const deep = lerp(1, 0.35, smoothstep(2, 9, dMouth));
      let k = deep * (1 - 0.6 * rel.fissure - 0.3 * rel.crack2) * (1 + 0.25 * rel.plate + 0.15 * rel.grain);
      // drip stains: dark grey streaks down the upper walls from the rim
      const drip = Math.pow(Math.max(0, noise.noise(psi * R * 3 + 11, 0.5)), 3) * smoothstep(4.5, 0.5, dMouth) * smoothstep(-0.3, 0.6, up);
      k *= 1 - 0.55 * drip;
      let c: [number, number, number] = [k, k * (1 + 0.06 * drip), k * (1 + 0.16 * drip)];
      // moss on the lower walls and the floor near the mouths (the interior tint is near-black,
      // so the moss rides on a large multiplier)
      const moss = smoothstep(3.5, 0.6, dMouth) * smoothstep(0.35, -0.6, up) * (0.45 + 0.55 * Math.max(0, noise.noise(psi * R * 1.3 + 2, s * 1.1)));
      c = [lerp(c[0], 3.2 * deep, moss), lerp(c[1], 6.5 * deep, moss), lerp(c[2], 1.6 * deep, moss)];
      // the worn floor: paler, trodden packed earth with darker litter
      const worn = lerp(1, 2.2 - 0.9 * smoothstep(0.02, 0.05, out.position.y - floorY), onFloor);
      out.color = [c[0] * worn, c[1] * worn * (1 - 0.05 * onFloor), c[2] * worn * (1 - 0.15 * onFloor)];
    },
    { cols: innerCols, rows: innerRows, closedU: true },
  );
  const innerMesh = new Mesh(inner, mats.logInterior);
  innerMesh.name = 'log-interior';
  innerMesh.receiveShadow = true;
  group.add(innerMesh);

  // end grain annuli joining outer and inner shells at both broken ends
  const endParts = [];
  for (const end of [0, 1] as const) {
    const ring = gridSurface(
      (u, v, out) => {
        const psi = u * TAU;
        const sEnd = end === 0 ? sEndW(psi) : sEndE(psi);
        const sIn = end === 0 ? sEnd + 0.12 : sEnd - 0.12;
        const rOut = rBase(psi, sEnd) + detail(psi, sEnd, upness(psi));
        const rIn = rBase(psi, sIn) - wall;
        const s = lerp(sEnd, sIn, v);
        // round 43: the rim is torn, not a clean cut — the annulus steps in and out along the
        // wall (the outer rows more than the inner) so the end-grain rings break at the splinters
        const tear = 0.18 * noise.noise(psi * 7 + end * 3, 1.5) * (1 - 0.6 * v) + 0.05 * noise.noise(psi * 23, 4 + end);
        surfacePoint(psi, s + tear, lerp(rOut, rIn, v), out.position);
        // the end-grain map's rings run across v (materials.ts `endGrain`: v 0 the bark side)
        out.uv = [(psi * R) / 1.5, v];
        const d = lerp(0.62, 0.34, v) * (0.85 + 0.3 * noise.noise(psi * 6, v * 3 + end * 5));
        out.color = [d, d * 0.8, d * 0.62];
      },
      { cols: 168, rows: 5, closedU: true },
    );
    const outward = end === 0 ? A.clone().negate() : A.clone();
    faceTowards(ring, (p, o) => o.copy(p).addScaledVector(outward, 5));
    endParts.push(ring);
  }
  // ---- round 41 (structures-26): the hollow's rim is SPLINTERED — thin tapered shards of end
  // grain standing out of the west break (the one the path passes) between the big spikes, some
  // leaning into the hollow, some out over the bark, 0.3–1.2 m long; end-grain material, so they
  // fold into the ends' draw. Own fork. ----
  const splRng = rng.fork('splinters41');
  let rimSplinters = 0;
  for (let i = 0; i < 30; i++) {
    const psi = splRng() * TAU;
    const sRim = sEndW(psi);
    const rOut = rBase(psi, sRim) + barkCoarse(psi, sRim);
    const rIn = rBase(psi, sRim) - wall;
    const rr = lerp(rIn + 0.04, rOut - 0.06, splRng());
    const base = surfacePoint(psi, sRim + 0.3, rr);
    const radial = radialDir(psi, sRim);
    const f = frameAt(sRim);
    // mostly along the trunk's axis outward, with a lean out of / into the hollow and sideways
    const dir = A.clone().negate().addScaledVector(radial, (splRng() - 0.5) * 0.7).addScaledVector(f.r, (splRng() - 0.5) * 0.3).normalize();
    const len = 0.3 + splRng() * 0.9;
    const r0 = 0.025 + splRng() * 0.04;
    const mid = base.clone().addScaledVector(dir, len * 0.5).addScaledVector(radial, (splRng() - 0.5) * 0.08);
    const tip = base.clone().addScaledVector(dir, len);
    const pale = 0.6 + splRng() * 0.3;
    const shard = sweepTube(new CatmullRomCurve3([base, mid, tip], false, 'catmullrom', 0.5), {
      radius: (t) => r0 * (1 - 0.92 * t) * (1 + 0.25 * Math.sin(t * 9 + i)),
      tubularSegments: 4,
      radialSegments: 4,
      uvMetres: 0.5,
      // split faces pale, the weathered outer face dark
      color: (t, ang) => {
        const d = lerp(0.55, 0.35, t) * lerp(1, pale + 0.5, Math.max(0, Math.cos(ang * 2 + i)));
        return [d, d * 0.82, d * 0.64];
      },
      capEnd: true,
    });
    // round 43: the end-grain map's rings run across v, so the shard's length goes on u and its
    // girth across the middle rings — long grain along a splinter, not cross stripes
    {
      const uv = shard.attributes.uv as Float32BufferAttribute;
      for (let k = 0; k < uv.count; k++) {
        const around = uv.getX(k);
        const along = uv.getY(k);
        uv.setXY(k, along * 1.6 + i * 0.37, 0.25 + 0.5 * (around - Math.floor(around)));
      }
    }
    endParts.push(shard);
    rimSplinters++;
  }
  // ---- round 43 (structures-27): FUNGUS SHELVES inside the hollow — bracket fungi on the tunnel
  // walls within reach of the west mouth's light, 0.12–0.32 m across, a domed top zoned in
  // concentric bands (the end-grain map's rings, radial on the shelf) and a pale flat underside;
  // end-grain material, so they fold into the ends' draw. Own fork. ----
  const shelfRng = rng.fork('shelves43');
  let fungusShelves = 0;
  for (let i = 0; i < 14; i++) {
    // on the walls (not the floor, not the crown), the west 8 m of the tunnel
    const psi = (shelfRng() < 0.5 ? 0 : Math.PI) + (shelfRng() - 0.5) * 1.1;
    const s = sEndW(psi) + 0.6 + shelfRng() * 7.5;
    const rel = innerRelief(psi, s);
    const rWall = rBase(psi, s) - wall + rel.r;
    const c = surfacePoint(psi, s, rWall - 0.01);
    const inward = radialDir(psi, s).negate();
    const f = frameAt(s);
    const along = f.t.clone();
    const size = 0.12 + shelfRng() * 0.2;
    const thick = size * (0.18 + shelfRng() * 0.12);
    const droop = 0.15 + shelfRng() * 0.25;
    const pale = 0.75 + shelfRng() * 0.3;
    const tone: [number, number, number] = [0.95 * pale, 0.82 * pale, 0.62 * pale];
    for (const side of [1, -1] as const) {
      const shelf = gridSurface(
        (u, v, out) => {
          // a half-disc fan out of the wall: u round the rim (−90° … 90° about the inward normal), v from the wall to the rim
          const a = (u - 0.5) * Math.PI;
          const rr = size * lerp(0.05, 1, v) * (1 + 0.08 * noise.noise(a * 2 + i, v * 3));
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr * 0.8;
          // the top domes then droops at the rim; the underside is flat, the rim rounds them together
          const dome = side > 0 ? thick * (1 - v * v) - droop * size * Math.pow(v, 3) : -thick * 0.25 * (1 - Math.pow(v, 6)) - droop * size * Math.pow(v, 3);
          out.position.copy(c).addScaledVector(inward, px).addScaledVector(along, py).addScaledVector(UP, dome);
          // rings radial on the cap (v → the map's ring axis), plain under
          out.uv = side > 0 ? [u * 0.8 + i * 0.3, 0.15 + 0.75 * v] : [u * 0.4 + 0.5, 0.05 + 0.1 * v];
          const k = side > 0 ? (0.7 + 0.3 * (1 - v)) * (1 - 0.25 * smoothstep(0.85, 1, v)) : 1.15;
          out.color = [tone[0] * k, tone[1] * k * (side > 0 ? 1 : 1.05), tone[2] * k * (side > 0 ? 1 : 1.1)];
        },
        { cols: 12, rows: 5 },
      );
      faceTowards(shelf, (p, o) => o.copy(p).addScaledVector(UP, side));
      endParts.push(shelf);
    }
    fungusShelves++;
  }
  const endMesh = new Mesh(merge(endParts), mats.endGrain);
  endMesh.name = 'log-ends';
  endMesh.castShadow = endMesh.receiveShadow = true;
  group.add(endMesh);

  // broken branch stubs on top
  const stubRng = rng.fork('stubs');
  const stubParts = [];
  const stubDefs: { s: number; psi: number; len: number; r: number }[] = [
    { s: -6.5, psi: Math.PI / 2 - 0.35, len: 3.0, r: 0.62 },
    { s: -1.5, psi: Math.PI / 2 + 0.5, len: 1.9, r: 0.42 },
    { s: 3.8, psi: Math.PI / 2 - 0.1, len: 3.6, r: 0.72 },
    { s: 7.5, psi: Math.PI / 2 + 0.7, len: 1.5, r: 0.36 },
  ];
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${ctx.config.seed}/log`);
  for (let i = 0; i < stubDefs.length; i++) {
    const sd = stubDefs[i];
    const base = surfacePoint(sd.psi, sd.s, rBase(sd.psi, sd.s) - 0.4);
    const dir = radialDir(sd.psi, sd.s).add(new Vector3((stubRng() - 0.5) * 0.6, 0.35, (stubRng() - 0.5) * 0.6)).normalize();
    // gnarled: a knee part-way up, then the tip kicks sideways
    const knee = base.clone().addScaledVector(dir, sd.len * 0.4).add(new Vector3((stubRng() - 0.5) * 0.9, -0.1, (stubRng() - 0.5) * 0.9));
    const mid = base.clone().addScaledVector(dir, sd.len * 0.7).add(new Vector3((stubRng() - 0.5) * 0.7, 0.1, (stubRng() - 0.5) * 0.7));
    const tip = base.clone().addScaledVector(dir, sd.len).add(new Vector3((stubRng() - 0.5) * 1.2, stubRng() * 0.5, (stubRng() - 0.5) * 1.2));
    const stub = sweepTube(new CatmullRomCurve3([base, knee, mid, tip], false, 'catmullrom', 0.6), {
      radius: (t) => sd.r * (1 - 0.62 * t) * (1 + 0.1 * Math.sin(t * 11 + i)),
      tubularSegments: 18,
      radialSegments: 12,
      uvMetres: 1.6,
      displace: (t, ang) => (noise.ridged(ang * 1.5 + i, t * 5, 2) - 0.5) * 0.1 * (1 - 0.5 * t),
      color: (t, ang) => (t > 0.98 ? [0.3, 0.25, 0.2] : [0.85 + 0.25 * Math.max(0, Math.sin(ang)), 0.82 + 0.2 * Math.max(0, Math.sin(ang)), 0.78]),
      capEnd: true,
    });
    stubParts.push(stub);
    if (i !== 3) foliage.addLeafCluster(tip, 0.9, 64, { size: 0.15, amount: 0.06, droop: 0.5, tint: [0.62, 0.7, 0.36], tintSpread: 0.3 });
  }
  // ---- round 21: ROOT FLARES at the feet. Reference D's west mass stands on a spread of roots
  // running out over the ground among ferns; ours ended in a bare sunk cylinder. Each sunk end
  // throws three or four roots from its lower flanks (alternating sides) out 2.2–4.4 m along the
  // terrain and under it, knuckled and ridged, in the log's own bark (they fold into its draw).
  // Own fork — the stubs', the vegetation's and the lanterns' streams keep their draws. ----
  const rootRng = rng.fork('roots21');
  const rootParts = [];
  const rootFeet: [number, number, number][] = [];
  for (const end of [0, 1] as const) {
    const n = end === 0 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const south = i % 2 === 0;
      const psi0 = south ? -0.3 - rootRng() * 0.45 : Math.PI + 0.3 + rootRng() * 0.45;
      const s0 = end === 0 ? -L / 2 + 1.0 + rootRng() * 3.6 : L / 2 - 1.0 - rootRng() * 3.0;
      if (end === 0 && s0 < sEndW(psi0) + 0.6) continue;
      const r0 = rBase(psi0, s0);
      const start = surfacePoint(psi0, s0, r0 - 0.4);
      const mouth = surfacePoint(psi0, s0, r0 + 0.3);
      const out = radialDir(psi0, s0);
      out.y = 0;
      out.normalize();
      const reachDrawn = 2.2 + rootRng() * 2.2;
      const along = (rootRng() - 0.5) * 1.6;
      const knuckle = 4 + rootRng() * 3;
      const rr = 0.3 + rootRng() * 0.12;
      // layout round 6: the north path's west edge now passes ≈ 4 m from the west end's north
      // flank, so a root is shortened (never below 1.2 m) until neither its foot nor its buried
      // tip lies on the flagstones — roots over paving read as a modelling error. The test walks
      // the root's rim (its radius `rr`, ≈ 0.42 m at the mouth, plus the 0.08 m ridge displace)
      // around the foot and the buried tip, not just their centre lines: with centre-only tests
      // two west-end feet sat 0.2 m off the paving and their flanks lay on its feathered edge
      // (path mask 0.3–0.83). Every draw above happens first so the stream is the same whether
      // or not a root is shortened.
      const rim = rr + 0.1;
      const onPaving = (rch: number) => {
        const f = mouth.clone().addScaledVector(out, rch).addScaledVector(A, along);
        const b = f.clone().addScaledVector(out, 0.7).addScaledVector(A, along * 0.3);
        for (const c of [f, b]) {
          if (terrain.mask(c.x, c.z).path > 0.01) return true;
          for (const [ao, aa] of [[rim, 0], [-rim, 0], [0, rim], [0, -rim]] as const) {
            const p = c.clone().addScaledVector(out, ao).addScaledVector(A, aa);
            if (terrain.mask(p.x, p.z).path > 0.01) return true;
          }
        }
        return false;
      };
      let reach = reachDrawn;
      while (reach > 1.2 && onPaving(reach)) reach -= 0.3;
      // a root that still lands on the flagstones at its shortest (two south-flank roots of the
      // west end point straight at the path's west edge) is left out rather than laid over them
      if (onPaving(reach)) continue;
      const mid = mouth.clone().addScaledVector(out, reach * 0.45).addScaledVector(A, along * 0.5);
      mid.y = Math.max(mid.y - 0.6, terrain.height(mid.x, mid.z) + 0.28);
      const foot = mouth.clone().addScaledVector(out, reach).addScaledVector(A, along);
      foot.y = terrain.height(foot.x, foot.z);
      const buried = foot.clone().addScaledVector(out, 0.7).addScaledVector(A, along * 0.3);
      buried.y = terrain.height(buried.x, buried.z) - 0.4;
      const root = sweepTube(new CatmullRomCurve3([start, mouth, mid, foot, buried], false, 'catmullrom', 0.5), {
        radius: (t) => rr * (1 - 0.65 * t) * (0.9 + 0.2 * Math.abs(Math.sin(t * knuckle + i))),
        tubularSegments: 16,
        radialSegments: 9,
        uvMetres: 1.6,
        displace: (t, ang) => (noise.ridged(ang * 1.4 + i * 2.7 + end * 5, t * 6, 2) - 0.5) * 0.08 * (1 - 0.4 * t),
        color: (t, ang) => {
          const lit = 0.8 + 0.3 * Math.max(0, Math.sin(ang));
          const d = 0.72 * lit * (1 - 0.25 * t);
          // moss on top, thinning toward the buried tip
          const mossy = Math.max(0, Math.sin(ang)) * 0.45 * (1 - t);
          return [lerp(d, 0.9, mossy), lerp(d * 0.96, 1.6, mossy), lerp(d * 0.9, 0.4, mossy)];
        },
        capEnd: true,
      });
      rootParts.push(root);
      rootFeet.push([foot.x, foot.y, foot.z]);
    }
  }
  const outerMesh = new Mesh(merge([outer, ...stubParts, ...rootParts]), mats.logBark);
  outerMesh.name = 'log-bark';
  outerMesh.castShadow = outerMesh.receiveShadow = true;
  group.add(outerMesh);

  // ---- vegetation: tufts and ferns along the top, vines hanging from the underside and the west lip ----
  const vegRng = rng.fork('veg');
  // the moss cap is thick with ferns and coarse grass (shaded olive, not lawn-green): a dense
  // band along the crown, thinning down the flanks
  const topShade: [number, number, number] = [0.6, 0.66, 0.5];
  for (let i = 0; i < 130; i++) {
    const s = lerp(-L / 2 + 0.6, L / 2 - 0.8, vegRng());
    const spread = 0.5 + 1.2 * vegRng() * vegRng();
    const psi = Math.PI / 2 + (vegRng() - 0.5) * 2 * spread;
    if (s < sEndW(psi) + 0.4) continue;
    const r = rBase(psi, s) + detail(psi, s, upness(psi)) - 0.03;
    const p = surfacePoint(psi, s, r);
    const n = radialDir(psi, s);
    n.y += 0.4;
    n.normalize();
    const fern = vegRng() < 0.45;
    foliage.addTuft(p, n, (fern ? 0.85 : 0.55) * (0.75 + vegRng() * 0.6), fern ? 1 : 0, 0.05, topShade);
  }
  // hero ferns on the crown of the broken west mass: they break the silhouette against the haze
  for (let i = 0; i < 6; i++) {
    const psi = Math.PI / 2 + (vegRng() - 0.5) * 1.2;
    const s = sEndW(psi) + 0.9 + vegRng() * 2.6;
    const p = surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) - 0.05);
    const n = radialDir(psi, s);
    n.y += 0.8;
    n.normalize();
    foliage.addTuft(p, n, 1.15 + vegRng() * 0.45, 1, 0.06, topShade);
  }
  // bushy leaf clumps (saplings / ivy mounds) rooted in the moss along the top
  for (let i = 0; i < 9; i++) {
    const psi = Math.PI / 2 + (vegRng() - 0.5) * 1.1;
    const s = lerp(-L / 2 + 1.2, L / 2 - 1.5, (i + vegRng()) / 9);
    if (s < sEndW(psi) + 0.8) continue;
    const p = surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) + 0.25);
    foliage.addLeafCluster(p, 0.55 + vegRng() * 0.45, 70, { size: 0.15, amount: 0.05, droop: 0.45, tint: [0.55, 0.64, 0.32], tintSpread: 0.3, flatten: 0.55 });
  }
  // where the path spine crosses under the arch (along-axis s of the spine's crossing of the
  // axis line). Layout round 6: solved from `layout.pathSpine` instead of the stale "x ≈ 2"
  // guess, which put the lanterns 8 m west of the crossing once the log moved east; falls back
  // to the old formula if the spine does not cross the axis.
  const pathS = (() => {
    const spine = ctx.layout.pathSpine;
    for (let i = 0; i < spine.length - 1; i++) {
      const [ax, , az] = spine[i];
      const [bx, , bz] = spine[i + 1];
      // signed across-axis coordinate of both ends: a crossing changes sign
      const va = -(ax - cx) * A.z + (az - cz) * A.x;
      const vb = -(bx - cx) * A.z + (bz - cz) * A.x;
      if ((va > 0 && vb > 0) || (va < 0 && vb < 0) || va === vb) continue;
      const t = va / (va - vb);
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      const s = (px - cx) * A.x + (pz - cz) * A.z;
      if (Math.abs(s) < L / 2 - 1) return s;
    }
    return (2 - cx) / A.x;
  })();
  for (let i = 0; i < 7; i++) {
    const s = pathS + (vegRng() - 0.5) * 7;
    const psi = -Math.PI / 2 + (vegRng() - 0.5) * 1.4;
    const hook = surfacePoint(psi, s, rBase(psi, s) - 0.1);
    foliage.addHangingVine(hook, 0.7 + vegRng() * 1.3, { amount: 0.1, thickness: 0.018 });
  }
  for (let i = 0; i < 5; i++) {
    const psi = Math.PI / 2 + (vegRng() - 0.5) * 2.2;
    const s = sEndW(psi) + 0.3;
    const hook = surfacePoint(psi, s, rBase(psi, s) + 0.05);
    foliage.addHangingVine(hook, 0.8 + vegRng() * 1.4, { amount: 0.1, thickness: 0.018 });
  }
  // draped vines over the top near the west end
  for (let i = 0; i < 3; i++) {
    const s0 = -L / 2 + 1.5 + i * 3.2 + vegRng();
    const pts: Vector3[] = [];
    const nrms: Vector3[] = [];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6;
      const psi = Math.PI / 2 + lerp(-0.9, 1.3, t) * (i % 2 ? -1 : 1);
      const s = s0 + Math.sin(t * 3 + i) * 0.6;
      pts.push(surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) + 0.03));
      nrms.push(radialDir(psi, s));
    }
    foliage.addSurfaceVine(pts, nrms, { amount: 0.02, thickness: 0.025 });
  }
  // ---- concept sheet 01 "Branch bridge": the crown is hung with vines along its whole length
  // and moss drapes over the flanks in sheets ----
  // vine strands from the upper flanks on both sides (the crown's own hang from the belly above)
  for (let i = 0; i < 16; i++) {
    const s = lerp(-L / 2 + 1.0, L / 2 - 2.0, (i + vegRng()) / 16);
    const north = i % 2 === 1;
    const psi = north ? Math.PI - 0.15 - vegRng() * 0.4 : 0.15 + vegRng() * 0.4;
    if (s < sEndW(psi) + 0.6) continue;
    const hook = surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) - 0.05);
    foliage.addHangingVine(hook, 0.9 + vegRng() * 1.6, { amount: 0.1, thickness: 0.018 });
  }
  // moss sheets: ragged cushions of moss lying over the crown and hanging down one flank, thick
  // enough to stand off the bark (their lower edge frays into lobes); denser toward the west end
  // that faces shot D
  const sheetParts = [];
  const sheetRng = rng.fork('moss-sheets');
  for (let i = 0; i < 11; i++) {
    const s0 = i < 7 ? lerp(-L / 2 + 0.8, -1.5, (i + sheetRng()) / 7) : lerp(0.5, L / 2 - 2.5, (i - 7 + sheetRng()) / 4);
    const dirSign = sheetRng() < 0.5 ? 1 : -1;
    const width = 1.4 + sheetRng() * 1.6;
    const drop = 0.9 + sheetRng() * 1.1;
    const psiTop = Math.PI / 2 - dirSign * (0.1 + sheetRng() * 0.3);
    const sheet = gridSurface(
      (u, v, out) => {
        const s = s0 + (u - 0.5) * width * (1 + 0.15 * noise.noise(v * 3 + i, u * 2));
        // v: 0 at the crown, 1 at the frayed lower edge; the edge wanders in lobes
        const fray = 0.8 + 0.2 * noise.noise(u * 5 + i * 7, 3) - 0.15 * Math.pow(Math.abs(u - 0.5) * 2, 3);
        const psi = psiTop + dirSign * v * drop * fray;
        const r = rBase(psi, s) + detail(psi, s, upness(psi)) + 0.07 + 0.05 * noise.noise(s * 2 + i, psi * 3);
        surfacePoint(psi, s, r, out.position);
        out.uv = [s / 1.2, (psi * R) / 1.2];
        const up = upness(psi);
        const lit = 0.55 + 0.45 * smoothstep(-0.2, 0.9, up) * (0.7 + 0.3 * noise.noise(s * 1.6, psi * 2 + 5));
        const mossy = 0.85 + 0.3 * noise.noise(s * 3 + 2, psi * 4);
        out.color = [0.1 * lit * mossy, 0.13 * lit * mossy, 0.045 * lit * mossy];
      },
      { cols: 10, rows: 8 },
    );
    faceTowards(sheet, (p, o) => o.copy(p).addScaledVector(radialDir(psiTop + dirSign * 0.5 * drop, s0), 4));
    sheetParts.push(sheet);
  }
  const sheetMesh = new Mesh(merge(sheetParts), mats.moss);
  sheetMesh.name = 'log-moss-sheets';
  sheetMesh.castShadow = sheetMesh.receiveShadow = true;
  group.add(sheetMesh);
  for (const m of foliage.build(mats, 'log')) group.add(m);

  // ---- round 21: a SHAGGY crown edge and FERNS at the feet, on a second foliage builder (own
  // rng, own noise seed) built after the first, so every existing tuft, vine and cluster keeps
  // its draws; its meshes fold into the same leaf / tuft buckets (no new draw). ----
  const foliage21 = new FoliageBuilder(rng.fork('foliage21'), `${ctx.config.seed}/log21`);
  // hanging moss beards and small leaf clumps along the moss cap's lower edge on both flanks,
  // every ≈ 0.6 m along the length: grass cards growing DOWN from the edge in a dark damp tint,
  // so the crown's boundary in D is a broken fringe rather than a line
  const beardShade: [number, number, number] = [0.42, 0.48, 0.3];
  const beardLeaf: [number, number, number] = [0.5, 0.62, 0.3];
  const beardRng = rng.fork('beards21');
  for (let i = 0; i < 72; i++) {
    const s = lerp(-L / 2 + 0.8, L / 2 - 1.0, (i + beardRng()) / 72);
    const north = i % 2 === 1;
    // the edge of the moss mask (up + mossEdge ≈ 0.3): two fixed-point steps from the level line
    let psi = north ? Math.PI - 0.3 : 0.3;
    for (let it = 0; it < 3; it++) {
      const up = clamp(0.3 - mossEdge(psi, s), -0.3, 0.8);
      psi = north ? Math.PI - Math.asin(up) : Math.asin(up);
    }
    if (s < sEndW(psi) + 0.5) continue;
    const r = rBase(psi, s) + detail(psi, s, upness(psi)) + 0.02;
    const p = surfacePoint(psi, s, r);
    const dir = radialDir(psi, s).multiplyScalar(0.55);
    dir.y -= 1;
    dir.normalize();
    foliage21.addTuft(p, dir, 0.32 + beardRng() * 0.25, 0, 0.06, beardShade);
    if (i % 3 === 0) foliage21.addLeafCluster(p.clone().addScaledVector(dir, 0.12), 0.22 + beardRng() * 0.1, 8, { size: 0.14, amount: 0.06, droop: 0.9, tint: beardLeaf, tintSpread: 0.3, flatten: 0.6 });
  }
  // ferns and coarse grass round the feet: on the terrain about each sunk end and each root foot
  // (the west end, the broken mass shot D looks at, gets the denser bed)
  const fernRng = rng.fork('ferns21');
  const groundTuft = (x: number, z: number, big: boolean) => {
    const p = new Vector3(x, terrain.height(x, z), z);
    const n = new Vector3((fernRng() - 0.5) * 0.4, 1, (fernRng() - 0.5) * 0.4).normalize();
    const fern = fernRng() < (big ? 0.7 : 0.5);
    foliage21.addTuft(p, n, (fern ? 0.85 : 0.5) * (big ? 1.15 : 0.9) * (0.8 + fernRng() * 0.5), fern ? 1 : 0, 0.06, topShade);
  };
  for (const end of [0, 1] as const) {
    const sEnd = end === 0 ? -L / 2 + 1.5 : L / 2 - 1.5;
    const count = end === 0 ? 16 : 9;
    for (let i = 0; i < count; i++) {
      const side = fernRng() < 0.5 ? -1 : 1;
      const lateral = side * (R + 0.4 + fernRng() * 2.6);
      const along = sEnd + (fernRng() - 0.5) * 5;
      const c = axisAt(along);
      const f = frameAt(along);
      groundTuft(c.x + f.r.x * lateral, c.z + f.r.z * lateral, end === 0);
    }
  }
  for (const [fx, , fz] of rootFeet) {
    for (let i = 0; i < 2; i++) groundTuft(fx + (fernRng() - 0.5) * 1.2, fz + (fernRng() - 0.5) * 1.2, false);
  }
  for (const m of foliage21.build(mats, 'log21')) group.add(m);

  // ---- round 41 (structures-26): CLOSE-SCALE DETAIL for the player on the path under and beside
  // the arch (owner: "Verdant Forest quality at player height — real detail, not smooth surfaces";
  // references frame-03's heavy bough and board 05 "Branch Bridge" / "Moss on Branch"):
  //  - the moss crown as CUSHION TUFTS (mossTufts.ts, the cap moss material) gathered in colonies
  //    over the cap's own green, densest on the west half the path passes, a few on the rim;
  //  - a TORN MOSS SKIRT hanging over both flanks from the crown's edge, lobed and frayed, standing
  //    7 cm off the bark with a folded lip (thickness), in the cap moss;
  //  - moss caps on the root flares' crowns (tufts on the roots' own upper vertices);
  //  - trefoil / sorrel plants rooted in the crown and at the root flares, small ferns by the path;
  //  - moss BEARDS with tiny leaflets from the crown's edge, more vines under the belly by the path.
  // Every stream is a new fork; the meshes fold into the cap-moss / leaf / vine / tuft buckets. ----
  const tuftRng = rng.fork('moss-tufts41');
  const tuftSpecs: MossTuftSpec[] = [];
  /** the displaced outer surface's outward normal at (ψ, s) by finite differences */
  const _sa = new Vector3();
  const _sb = new Vector3();
  const _sc = new Vector3();
  const _sd = new Vector3();
  const surfaceNormal = (psi: number, s: number, out: Vector3) => {
    const e = 0.02;
    const at = (p: number, q: number, o: Vector3) => surfacePoint(p, q, rBase(p, q) + detail(p, q, upness(p)), o);
    at(psi + e, s, _sa);
    at(psi - e, s, _sb);
    at(psi, s + e, _sc);
    at(psi, s - e, _sd);
    _sa.sub(_sb);
    _sc.sub(_sd);
    out.crossVectors(_sc, _sa).normalize();
    if (out.dot(radialDir(psi, s, _sb)) < 0) out.negate();
    return out;
  };
  /**
   * the crown moss on the cap-moss material (albedo map ≈ 0.45 mean under the vertex tint, no
   * shade floor): an olive that sits on the sheet's veiled level in D and reads as damp moss
   * with lit crests at 3 m; darker down the flanks and on the north side. The cushions carry the
   * colony heart's lift so they rise from the bed they stand on rather than sit on it.
   */
  const crownMoss = (psi: number, s: number, heart = 1): [number, number, number] => {
    const up = upness(psi);
    const lit = lerp(0.5, 1, smoothstep(-0.2, 0.9, up)) * (0.85 + 0.3 * noise.noise(s * 1.3 + 2, psi * 2.5)) * heart;
    return [0.19 * lit, 0.27 * lit, 0.05 * lit];
  };
  /**
   * The MOSS CARPET the cushions stand on: a cap-moss sheet lying `CARPET_LIFT` over the bark
   * inside the colonies and buried `CARPET_BURY` under it between them, rising through the bark
   * across the colony field's 0.38–0.48 band (≈ 10 cm; buried well under the deepest crack, so no
   * sliver shows through the fissures between), so every colony is a ragged-lipped green
   * patch and the bark between is the dark bed. Saria's cap reads as moss because its tufts stand
   * on the cap-moss sheet; on the bark material (brown map, grain normals) the same cushions read
   * as pebbles. Shared by the patch grid and the tuft lift so the cushions sit on the carpet.
   */
  const CARPET_LIFT = 0.035;
  const CARPET_BURY = -0.18;
  const carpetOffset = (p: Vector3, thick: number) => {
    const f = colonyField(p);
    const rise = smoothstep(0.38, 0.48, f) * smoothstep(0.15, 0.4, thick);
    return lerp(CARPET_BURY, CARPET_LIFT, rise) + 0.008 * n3.noise(p.x * 9, p.y * 9, p.z * 9) * rise;
  };
  const _tp = new Vector3();
  const _tn = new Vector3();
  for (let i = 0; i < 6600; i++) {
    // 80 % of the attempts on the west half (the path crossing and the broken end — the only
    // part a player stands under; the east half is 8–15 m from any path point)
    const west = tuftRng() < 0.8;
    const s = west ? lerp(-L / 2 - 1.5, 1.5, tuftRng()) : lerp(1.5, L / 2 - 0.8, tuftRng());
    const psi = Math.PI / 2 + (tuftRng() - 0.5) * 2.4;
    // 10–30 cm cushions (mean ≈ 18 cm, frame-03's bough): the crown is seen from the path 9 m
    // below and from the elevated views, where a 6 cm lump is a dot; inside a colony they
    // overlap into one clumped mass (coverage ≈ 1 on the west half)
    const r = 0.05 + 0.1 * Math.pow(tuftRng(), 1.4);
    const aspect = 0.75 + tuftRng() * 0.5;
    const yaw = tuftRng() * TAU;
    const hK = 0.5 + tuftRng() * 0.35;
    const seed = 1 + Math.floor(tuftRng() * 1e6);
    const keep = tuftRng();
    const keep2 = tuftRng();
    if (s < sEndW(psi) + 0.25 || s > sEndE(psi) - 0.4) continue;
    const up = upness(psi);
    const thick = mossCap(psi, s, up);
    if (keep > smoothstep(0.15, 0.4, thick)) continue;
    surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, up), _tp);
    // on the colony hearts only (a 4 % straggle on the floor between), never on the near-vertical
    // bark faces the relief throws up — a cushion glued to a wall reads as a pebble
    const heart = colony(_tp);
    if (keep2 > lerp(0.04, 1, heart)) continue;
    surfaceNormal(psi, s, _tn);
    if (_tn.y < 0.2) continue;
    // stand on the carpet where there is one (its base ring sinks into the sheet, not the bark)
    _tp.addScaledVector(_tn, Math.max(0, carpetOffset(_tp, thick)));
    tuftSpecs.push({
      position: _tp.clone(),
      normal: _tn.clone(),
      rx: r * aspect,
      rz: r / aspect,
      h: r * hK,
      yaw,
      color: crownMoss(psi, s, lerp(CROWN_FLOOR, CROWN_HEART, heart)),
      uv: [(psi * R) / 1.6, s / 1.6],
      sink: r * 0.35,
      seed,
    });
  }
  // moss on the roots' crowns: on the roots' own upper vertices (exact contact), thinning to the tip
  let rootTufts = 0;
  for (let ri = 0; ri < rootParts.length; ri++) {
    const g = rootParts[ri];
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const uv = g.attributes.uv;
    for (let v = 0; v < pos.count; v++) {
      const ny = nrm.getY(v);
      if (ny < 0.45) continue;
      const along = uv.getY(v) * 1.6; // metres from the trunk
      if (tuftRng() > 0.55 * smoothstep(3.6, 1.0, along)) continue;
      _tp.set(pos.getX(v), pos.getY(v), pos.getZ(v));
      _tn.set(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
      const r = 0.025 + tuftRng() * 0.035;
      tuftSpecs.push({
        position: _tp.clone(),
        normal: _tn.clone(),
        rx: r * (0.8 + tuftRng() * 0.4),
        rz: r * (0.8 + tuftRng() * 0.4),
        h: r * (0.5 + tuftRng() * 0.4),
        yaw: tuftRng() * TAU,
        color: [0.17 * (0.8 + 0.3 * ny), 0.25 * (0.8 + 0.3 * ny), 0.045],
        uv: [uv.getX(v), uv.getY(v)],
        sink: r * 0.5,
        seed: 1 + Math.floor(tuftRng() * 1e6),
      });
      rootTufts++;
    }
  }
  // three rings on the cushions over 9 cm so they are round at 3 m, two on the smaller (D's
  // triangle budget: +0.5 M per view); the lit top held to ×1.25 (the trunk tufts' level) —
  // brighter tops on the dark bed read as lumps, not moss
  const crownTufts = buildMossTufts(tuftSpecs, n3, { segments: [8, 6], rings: [3, 2], fineRadius: 0.09, topGain: 1.25, rimGain: 0.45, topTint: [1.0, 1.04, 0.84] });

  // the torn skirt: one strip per flank along the crown's edge, hanging 0.3–0.8 m in lobes
  const skirtParts = [];
  const skirtNoise = new Noise2D(`${ctx.config.seed}/structures/log-skirt41`);
  for (const north of [false, true]) {
    const s0 = -L / 2 + 0.7;
    const s1 = L / 2 - 1.2;
    const edgePsi = (s: number) => {
      let psi = north ? Math.PI - 0.3 : 0.3;
      for (let it = 0; it < 3; it++) {
        const up = clamp(0.3 - mossEdge(psi, s), -0.3, 0.8);
        psi = north ? Math.PI - Math.asin(up) : Math.asin(up);
      }
      return psi;
    };
    const sign = north ? 1 : -1; // increasing ψ goes DOWN the north flank, up the south one
    const strip = gridSurface(
      (u, v, out) => {
        const s = lerp(s0, s1, u);
        const top = edgePsi(s) - sign * 0.06;
        // the frayed lower edge: a wandering drop with tongues hanging further
        const wander = 0.75 + 0.25 * skirtNoise.noise(s * 0.9 + (north ? 11 : 3), 2.5);
        const tongue = 0.6 * Math.pow(Math.max(0, skirtNoise.noise(s * 2.2 + (north ? 5 : 17), 4)), 2);
        const drop = ((0.3 + 0.4 * wander + tongue) / R) * (1 + 0.1 * Math.sin(s * 7));
        // rows: 0 tucked into the bark above the edge, 1–4 the hanging face, 5 the lip folded back
        const rowsN = 5;
        const t = Math.min(1, (v * rowsN) / (rowsN - 1));
        const folded = v * rowsN > rowsN - 1 + 1e-6;
        const psi = top + sign * drop * (folded ? 1.04 : t);
        const off = folded ? -0.02 : t === 0 ? -0.03 : 0.07 + 0.03 * skirtNoise.noise(s * 3 + 1, psi * 4);
        surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) + off, out.position);
        out.uv = [(psi * R) / 1.6, s / 1.6];
        const c = crownMoss(psi, s);
        // the face darkens toward the frayed edge, the folded lip is the damp underside
        const k = folded ? 0.35 : lerp(1.05, 0.6, t);
        out.color = [c[0] * k, c[1] * k, c[2] * k];
      },
      { cols: 150, rows: 6 },
    );
    faceTowards(strip, (p, o) => o.copy(p).addScaledVector(radialDir(edgePsi((s0 + s1) / 2) + sign * 0.15, (s0 + s1) / 2), 6));
    skirtParts.push(strip);
  }
  const skirtGeo = merge(skirtParts);

  // the carpet patches: one grid over the crown band (ψ within ±1.25 of the top), ≈ 11 cm cells on
  // the west half the path passes (65 % of the rows on the west 45 %), ≈ 19 cm on the east body;
  // buried under the bark between colonies, so only the patches show
  const carpetRows = 190;
  const carpetCols = 76;
  const carpetWarp = (f: number) => (f < 0.65 ? (f / 0.65) * 0.45 : 0.45 + ((f - 0.65) / 0.35) * 0.55);
  const _cn = new Vector3();
  const carpet = gridSurface(
    (u, f, out) => {
      const psi = Math.PI / 2 + (u - 0.5) * 2.5;
      const v = carpetWarp(f);
      const s = lerp(sEndW(psi) + 0.3, sEndE(psi) - 0.5, v);
      const up = upness(psi);
      const thick = mossCap(psi, s, up);
      surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, up), out.position);
      surfaceNormal(psi, s, _cn);
      const off = carpetOffset(out.position, thick);
      const fld = colonyField(out.position);
      out.position.addScaledVector(_cn, off);
      out.uv = [(psi * R) / 1.6, s / 1.6];
      // the heart's lift on the patch, a damp darker lip where it rises out of the bark
      const lip = lerp(0.6, 1, smoothstep(0.4, 0.53, fld));
      const mottle = 0.88 + 0.24 * n3.noise(out.position.x * 3.1 + 5, out.position.y * 3.1, out.position.z * 3.1);
      const c = crownMoss(psi, s, lerp(CROWN_FLOOR, CROWN_HEART, colony(out.position)) * lip * mottle);
      out.color = c;
    },
    { cols: carpetCols, rows: carpetRows },
  );
  faceTowards(carpet, (p, o) => o.copy(p).addScaledVector(radialDir(Math.PI / 2, 0), 8));
  /**
   * The tufts, the carpet and the skirt are one mesh under a camera-distance LOD: 4–12 cm cushions are a
   * pixel or two from the hero cameras (A 64 m, B/E 57 m, F 60 m from the arch's centre) yet a
   * merged static bucket would draw all 90 k triangles in every view. The LOD sits at the arch's
   * centre (its geometry is re-based there, so the consolidation pass — which merges only
   * identity-matrix meshes — leaves it alone) and drops the mesh beyond `TUFT_LOD_M`; camera D at
   * 50 m keeps it, so D's silhouette and its moss crown are unchanged.
   */
  const TUFT_LOD_M = 55;
  const tuftCentre = axisAt(-2);
  const tuftGeo = merge([crownTufts.geometry, carpet, skirtGeo]);
  tuftGeo.translate(-tuftCentre.x, -tuftCentre.y, -tuftCentre.z);
  const tuftMesh = new Mesh(tuftGeo, mats.capMoss);
  tuftMesh.name = 'log-moss-tufts';
  tuftMesh.castShadow = false;
  tuftMesh.receiveShadow = true;
  const tuftLod = new LOD();
  tuftLod.name = 'log-moss-tufts-lod';
  tuftLod.position.copy(tuftCentre);
  tuftLod.addLevel(tuftMesh, 0);
  tuftLod.addLevel(new Group(), TUFT_LOD_M);
  tuftLod.updateMatrixWorld(true);
  group.add(tuftLod);

  // ---- round 44 (structures-28): the PLAYER-HEIGHT BARK SHELL. Survey-1 (#3, 15 frames): from
  // the path the body reads as smooth clay at every distance — round 21's ±0.37 m ridges and
  // round 41's ±4 cm cords are metre- and 30 cm-scale undulations on an 8 cm grid, and the
  // 2.6 m bark tile mips to a flat mean beyond 4 m. Old bark is PLATES: 15–35 cm fibre bundles
  // standing 2–5 cm proud of a dark bed, brick-laid along the grain, broken by the fissure
  // channels. This shell lays such plates over the body the path passes (the west break to
  // 7 m east of the crossing; every flank and the belly the player looks up at; not the moss
  // cap): each plate is a 5 × 4 slab whose rim is sunk 1.5 cm INTO the displaced surface and
  // whose top stands off it along the surface normal, tilted a little (one end lifts), the rim
  // dark (the fissure's shade), the top the body's own tint on a finer 1.3 m bark tile so the
  // map's ridges resolve at 2 m. Plates skip the fissures and cracks (the same fields the relief
  // cuts), so those read as open channels between the plates.
  // With it, at the FEET: the sunk ends met the ground as a bare cylinder through the grass
  // (crop 06). A HUMUS SKIRT — a low mound of dark litter-flecked earth banked against each
  // flank where it enters the ground, mossy on the north side — and broken BARK CHUNKS lying
  // round the feet (never on the paving) seat the log in the ground.
  // All of it is one LOD at the arch's centre dropped beyond NEAR_LOD_M: the six hero cameras
  // stand 48–64 m from the centre, so their frames (and D's silhouette) do not change; the
  // path under and beside the arch is within 20 m of it. Own forks; +2 draws within range only.
  const NEAR_LOD_M = 40;
  const plateRng = rng.fork('plates44');
  const plateParts: BufferGeometry[] = [];
  let barkPlates = 0;
  const sPlateTo = pathS + 7;
  /** the fissure / crack channels of the relief (the fields barkCoarse and barkFine cut), 0..1 */
  const fissureAt = (psi: number, s: number) => {
    const arc = psi * R;
    const twist = noise.noise(s * 0.1, arc * 0.05) * 1.6 + s * 0.06;
    const fissure = Math.pow(1 - Math.abs(noise.noise(arc * 0.8 + 31 + twist * 0.5, s * 0.07)), 9);
    const crack = Math.pow(1 - Math.abs(noise.noise(arc * 2.0 + 47 + twist, s * 0.5 + 3)), 10);
    return Math.max(fissure, crack * 0.9);
  };
  const PLATE_ALONG = 0.26;
  const PLATE_AROUND = 0.105;
  const plateNoise = new Noise2D(`${ctx.config.seed}/structures/log-plates44`);
  /**
   * The body's relief AS THE MESH HAS IT. The outer shell samples `detail()` on a 272 × 208 grid
   * (8 × 11 cm cells) and the triangles between are flat, while the analytic field has ±8 cm
   * cords at 30 cm and 8 cm cracks; a plate set on the analytic surface therefore sits up to
   * several cm inside the mesh in every concave cell (the first pass: half the plate tops under
   * the bark, sn-arch-outside unchanged at 9 m). So the plates stand on the mesh's own surface:
   * the same displacement sampled at the shell's vertices and bilinearly interpolated in the
   * shell's (u, f) parameterisation, `rowWarp` inverted for the row.
   */
  const meshDisp = (() => {
    const grid = new Float32Array((cols + 1) * rows);
    for (let j = 0; j < rows; j++) {
      const f = j / (rows - 1);
      const v = rowWarp(f);
      for (let i = 0; i <= cols; i++) {
        const psi = (i / cols) * TAU;
        const s = lerp(sEndW(psi), sEndE(psi), v);
        grid[j * (cols + 1) + i] = detail(psi, s, upness(psi));
      }
    }
    const unwarp = (v: number) => (v < 0.45 ? (v / 0.45) * 0.6 : 0.6 + ((v - 0.45) / 0.55) * 0.4);
    const column = (i: number, s: number) => {
      const psi = (i / cols) * TAU;
      const W = sEndW(psi);
      const E = sEndE(psi);
      const y = clamp(unwarp((s - W) / (E - W)), 0, 1) * (rows - 1);
      const j0 = Math.min(rows - 2, Math.floor(y));
      const fv = y - j0;
      return lerp(grid[j0 * (cols + 1) + i], grid[(j0 + 1) * (cols + 1) + i], fv);
    };
    return (psi: number, s: number) => {
      const u = (((psi / TAU) % 1) + 1) % 1;
      const x = u * cols;
      const i0 = Math.min(cols - 1, Math.floor(x));
      const fu = x - i0;
      return lerp(column(i0, s), column(i0 + 1, s), fu);
    };
  })();
  const _pc = new Vector3();
  const _pn = new Vector3();
  const _pb = new Vector3();
  let plateArcCells = 0;
  let plateArcOpen = 0;
  {
    const circ = TAU * R;
    const nAround = Math.round(circ / PLATE_AROUND);
    const sFrom = sEndW(Math.PI) - 2.2;
    const nAlong = Math.ceil((sPlateTo - sFrom) / PLATE_ALONG);
    for (let j = 0; j < nAlong; j++) {
      const sRow = sFrom + (j + 0.5) * PLATE_ALONG;
      for (let i = 0; i < nAround; i++) {
        // brick-laid: odd rows shift half a column; every plate takes its draws before any test,
        // so the stream is the same whichever plates are kept
        const arc0 = ((i + (j % 2) * 0.5) / nAround) * circ + (plateRng() - 0.5) * 0.03;
        const s0 = sRow + (plateRng() - 0.5) * 0.06;
        const len = PLATE_ALONG * (0.72 + plateRng() * 0.4);
        const wid = PLATE_AROUND * (0.68 + plateRng() * 0.38);
        const h = 0.03 + plateRng() * 0.03;
        const tilt = (plateRng() - 0.5) * 0.9;
        // per-plate tone (± 15 %) under a metre-scale patch field (± 22 %): single plates are
        // texture at 3 m, the patches are what reads as mottled old bark at 10–16 m in the haze
        // (survey-1 crop 08 — the first pass's ± 12 % on a uniform bed vanished beyond 6 m)
        const tone = (0.96 + (plateRng() - 0.5) * 0.3) * (1 + 0.22 * plateNoise.noise(arc0 * 0.9 + 50, s0 * 0.9 + 20));
        const keep = plateRng();
        const drop = plateRng();
        const psi0 = arc0 / R - Math.PI;
        if (s0 < sEndW(psi0) + 0.25 || s0 > sPlateTo) continue;
        const up0 = upness(psi0);
        const thick0 = mossCap(psi0, s0, up0);
        if (thick0 > 0.13) continue;
        plateArcCells++;
        // the fissure channels stay open; a few plates straggle over their shallow edges
        if (keep < smoothstep(0.12, 0.42, fissureAt(psi0, s0))) continue;
        if (drop < 0.07) continue;
        plateArcOpen++;
        const disp0 = meshDisp(psi0, s0);
        surfacePoint(psi0, s0, rBase(psi0, s0) + disp0, _pc);
        surfaceNormal(psi0, s0, _pn);
        const base = outerColor(psi0, s0, disp0, _pc);
        const rPlate = rBase(psi0, s0);
        const uvOff = plateRng() * 0.7;
        const plate = gridSurface(
          (u, v, out) => {
            const rim = u < 1e-6 || u > 1 - 1e-6 || v < 1e-6 || v > 1 - 1e-6;
            // the outline wanders a little so no two plates are the same rectangle
            const wob = 1 + 0.14 * plateNoise.noise(u * 3 + s0 * 5, v * 3 + arc0 * 5);
            const du = (u - 0.5) * wid * wob;
            const dv = (v - 0.5) * len * wob;
            const psi = psi0 + du / rPlate;
            const s = s0 + dv;
            surfacePoint(psi, s, rBase(psi, s) + meshDisp(psi, s), out.position);
            // the rim sinks into the body, the top stands off along the centre's normal and lifts at one end
            const off = rim ? -0.015 : h * (1 + tilt * (v - 0.5)) * (0.9 + 0.2 * plateNoise.noise(u * 7 + arc0, v * 7 + s0));
            out.position.addScaledVector(_pn, off);
            out.uv = [(psi * R) / 1.3 + uvOff, s / 1.3];
            // the rim is the fissure's shade and the ring inside it shades toward it (a soft dark
            // border 3 cm wide, so the plate network reads as lines at 10 m and not as a 1-px
            // seam); the top carries the body's tint with a fine flaky mottle
            const mottle = 0.9 + 0.2 * plateNoise.noise(psi * R * 22 + 3, s * 22 + arc0);
            const inset = Math.min(u, 1 - u, v, 1 - v);
            const border = 1 - 0.4 * clamp(1 - inset / 0.3, 0, 1);
            const k = rim ? 0.3 : 1.12 * tone * mottle * border;
            out.color = [base[0] * k, base[1] * k, base[2] * k];
          },
          { cols: 5, rows: 4 },
        );
        faceTowards(plate, (p, o) => o.copy(p).addScaledVector(_pn, 2));
        plateParts.push(plate);
        barkPlates++;
      }
    }
  }
  // ---- the feet: humus skirts where the flanks enter the ground, bark chunks lying about ----
  const footRng = rng.fork('feet44');
  const skirtParts44: BufferGeometry[] = [];
  const chunkParts: BufferGeometry[] = [];
  let barkChunks = 0;
  const footNoise = new Noise2D(`${ctx.config.seed}/structures/log-feet44`);
  /** the flank's contact ψ with the terrain at s on one side (south: ψ < 0; north: ψ > π), or null when the flank is clear of the ground */
  const contactPsi = (s: number, north: boolean): number | null => {
    const at = (psi: number) => {
      surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)), _pb);
      return _pb.y - terrain.height(_pb.x, _pb.z);
    };
    // ψ from the flank's equator (above ground) down toward the bottom (below ground)
    let hi = north ? Math.PI + 0.05 : -0.05;
    let lo = north ? Math.PI + 1.35 : -1.35;
    if (at(hi) <= 0 || at(lo) >= 0) return null;
    for (let it = 0; it < 28; it++) {
      const mid = (lo + hi) / 2;
      if (at(mid) > 0) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  };
  const HUMUS: [number, number, number] = [0.17, 0.125, 0.08];
  const HUMUS_MOSS: [number, number, number] = [0.13, 0.22, 0.05];
  const LITTER: [number, number, number] = [0.36, 0.3, 0.18];
  for (const end of [0, 1] as const) {
    for (const north of [false, true]) {
      // the contact runs from the rim inward until the flank lifts off the ground
      const psiRim = north ? Math.PI + 0.75 : -0.75;
      const sRim = end === 0 ? sEndW(psiRim) + 0.15 : sEndE(psiRim) - 0.15;
      const dirIn = end === 0 ? 1 : -1;
      let sLift = sRim;
      for (let k = 0; k < 60; k++) {
        const s = sRim + dirIn * k * 0.1;
        if (contactPsi(s, north) === null) break;
        sLift = s;
      }
      const run = Math.abs(sLift - sRim);
      if (run < 0.4) continue;
      const seed = end * 10 + (north ? 5 : 0);
      const reach = 0.85 + footRng() * 0.5;
      const mound = 0.15 + footRng() * 0.07;
      const skirt = gridSurface(
        (u, v, out) => {
          // u along the contact (rim → lift-off), v from the flank (0) out over the ground (1)
          const s = sRim + dirIn * (u * run + 0.35 * v);
          const psiC = contactPsi(s, north) ?? psiRim;
          const sideSign = north ? 1 : -1;
          // the inner edge sits up the flank a hand's width, tucked 3 cm into the bark
          const psiIn = psiC - sideSign * (0.05 + 0.02 * footNoise.noise(u * 6 + seed, 1));
          surfacePoint(psiIn, s, rBase(psiIn, s) + detail(psiIn, s, upness(psiIn)) - 0.03, _pb);
          const inner = _pb.clone();
          // outward: horizontal, away from the axis, the reach shrinking toward the lift-off end
          const out2 = radialDir(psiC, s);
          out2.y = 0;
          out2.normalize();
          let r = reach * (0.55 + 0.45 * (1 - u)) * (1 + 0.22 * footNoise.noise(u * 5 + seed * 3, 7));
          // never over the paving: the skirt stops 0.1 m short of the path mask along this ray
          for (let k = 1; k <= 6; k++) {
            const rk = (k / 6) * r;
            if (terrain.mask(inner.x + out2.x * rk, inner.z + out2.z * rk).path > 0.01) {
              r = Math.max(0.15, rk - 0.1);
              break;
            }
          }
          const gx = inner.x + out2.x * r * v;
          const gz = inner.z + out2.z * r * v;
          const ground = terrain.height(gx, gz);
          // the mound: banked against the flank, feathering to the ground, lumpy
          const bank = Math.pow(1 - v, 1.7) * mound * (0.8 + 0.4 * footNoise.noise(gx * 3.1, gz * 3.1 + seed));
          out.position.set(gx, v < 1e-6 ? Math.max(inner.y, ground + 0.02) : ground + bank * (1 - u * 0.6) + 0.006, gz);
          out.uv = [gx / 0.9, gz / 0.9];
          // dark humus, litter flecks, a moss film on the north side and toward the flank
          const fleck = smoothstep(0.55, 0.75, footNoise.noise(gx * 17 + seed, gz * 17));
          const mossy = (north ? 0.55 : 0.2) * smoothstep(1, 0.25, v) * (0.5 + 0.5 * footNoise.noise(gx * 2.3, gz * 2.3 + 4));
          const shade = (0.8 + 0.4 * footNoise.noise(gx * 6 + 2, gz * 6)) * lerp(0.75, 1, v);
          const c: [number, number, number] = [lerp(HUMUS[0], HUMUS_MOSS[0], mossy), lerp(HUMUS[1], HUMUS_MOSS[1], mossy), lerp(HUMUS[2], HUMUS_MOSS[2], mossy)];
          out.color = [lerp(c[0], LITTER[0], fleck) * shade, lerp(c[1], LITTER[1], fleck) * shade, lerp(c[2], LITTER[2], fleck) * shade];
        },
        { cols: Math.max(8, Math.round(run / 0.12)), rows: 7 },
      );
      faceTowards(skirt, (p, o) => o.copy(p).setY(p.y + 5));
      skirtParts44.push(skirt);
      // bark chunks: flat slabs 12–36 cm long lying on the skirt and the ground round the foot,
      // tilted to the ground, never on the paving or inside the trunk's footprint
      const n = 7 + Math.floor(footRng() * 5);
      for (let i = 0; i < n; i++) {
        const s = sRim + dirIn * footRng() * (run + 1.2);
        const psiC = contactPsi(Math.min(Math.max(s, Math.min(sRim, sLift)), Math.max(sRim, sLift)), north) ?? psiRim;
        const out2 = radialDir(psiC, s);
        out2.y = 0;
        out2.normalize();
        const c = axisAt(s);
        const lateral = Math.hypot(surfacePoint(psiC, s, rBase(psiC, s), _pb).x - c.x, _pb.z - c.z);
        const d = lateral + 0.15 + footRng() * 1.6;
        const x = c.x + out2.x * d;
        const z = c.z + out2.z * d;
        const cl = 0.1 + footRng() * 0.26;
        const cw = cl * (0.35 + footRng() * 0.35);
        const yaw = footRng() * TAU;
        const tone = 0.75 + footRng() * 0.5;
        if (terrain.mask(x, z).path > 0.01) continue;
        const y = terrain.height(x, z) + 0.012;
        terrain.normal(x, z, _pn);
        const chunk = new BoxGeometry(cl, 0.028, cw, 2, 1, 1);
        {
          // a bark chunk is not a box: the top is domed and the ends chipped
          const pos = chunk.attributes.position;
          for (let k = 0; k < pos.count; k++) {
            const px = pos.getX(k);
            const py = pos.getY(k);
            if (py > 0) pos.setY(k, py + 0.012 * (1 - Math.pow((2 * px) / cl, 2)) + 0.004 * footNoise.noise(px * 30 + i, pos.getZ(k) * 30));
            pos.setX(k, px * (1 + 0.08 * footNoise.noise(px * 9 + i * 3, pos.getZ(k) * 9)));
          }
          chunk.computeVertexNormals();
        }
        setColorAttribute(chunk, (k) => {
          const ny = chunk.attributes.normal.getY(k);
          const t = (ny > 0.5 ? 0.6 : 0.34) * tone;
          return [t, t * 0.86, t * 0.7];
        });
        chunk.applyMatrix4(basisMatrix(new Vector3(x, y, z), new Vector3(Math.cos(yaw), 0, Math.sin(yaw))));
        // lay it flat on the slope: rotate the box's up onto the terrain normal about the placed centre
        {
          const q = new Quaternion().setFromUnitVectors(UP, _pn.clone().normalize());
          const rot = new Matrix4().makeRotationFromQuaternion(q);
          chunk.translate(-x, -y, -z);
          chunk.applyMatrix4(rot);
          chunk.translate(x, y, z);
        }
        chunkParts.push(chunk);
        barkChunks++;
      }
    }
  }
  const nearGroup = new Group();
  nearGroup.name = 'log-near-detail';
  const plateGeo = merge([...plateParts, ...chunkParts]);
  plateGeo.translate(-tuftCentre.x, -tuftCentre.y, -tuftCentre.z);
  const plateMesh = new Mesh(plateGeo, mats.logBark);
  plateMesh.name = 'log-bark-plates';
  plateMesh.castShadow = false;
  plateMesh.receiveShadow = true;
  nearGroup.add(plateMesh);
  let footSkirtTriangles = 0;
  if (skirtParts44.length) {
    const skirtGeo44 = merge(skirtParts44);
    footSkirtTriangles = Math.floor((skirtGeo44.index ? skirtGeo44.index.count : skirtGeo44.attributes.position.count) / 3);
    skirtGeo44.translate(-tuftCentre.x, -tuftCentre.y, -tuftCentre.z);
    const skirtMesh44 = new Mesh(skirtGeo44, mats.moss);
    skirtMesh44.name = 'log-foot-skirts';
    skirtMesh44.castShadow = false;
    skirtMesh44.receiveShadow = true;
    nearGroup.add(skirtMesh44);
  }
  const nearLod = new LOD();
  nearLod.name = 'log-near-detail-lod';
  nearLod.position.copy(tuftCentre);
  nearLod.addLevel(nearGroup, 0);
  nearLod.addLevel(new Group(), NEAR_LOD_M);
  nearLod.updateMatrixWorld(true);
  group.add(nearLod);
  const detail44 = {
    barkPlates,
    barkPlateTriangles: Math.floor(plateParts.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0)),
    plateCoverage: { sTo: +(sPlateTo - sEndW(Math.PI)).toFixed(2), arcShare: +(plateArcCells ? plateArcOpen / Math.max(1, plateArcCells) : 0).toFixed(2) },
    footSkirts: skirtParts44.length,
    footSkirtTriangles,
    barkChunks,
    nearLod: { centre: [+tuftCentre.x.toFixed(2), +tuftCentre.y.toFixed(2), +tuftCentre.z.toFixed(2)] as [number, number, number], dropBeyondM: NEAR_LOD_M },
  };

  // plants: trefoils in the crown moss and at the root flares, small ferns by the path, beards
  const foliage41 = new FoliageBuilder(rng.fork('foliage41'), `${ctx.config.seed}/log41`);
  const plantRng = rng.fork('plants41');
  const SORREL_TINT: [number, number, number] = [1.6, 1.55, 1.4];
  let trefoils = 0;
  const trefoil = (p: Vector3, n: Vector3, scale: number) => {
    const stem = (0.02 + plantRng() * 0.025) * scale;
    const size = (0.045 + plantRng() * 0.04) * scale;
    const yaw0 = plantRng() * TAU;
    const leaflets = plantRng() < 0.25 ? 4 : 3;
    const k = 0.85 + plantRng() * 0.35;
    const tint: [number, number, number] = [SORREL_TINT[0] * k, SORREL_TINT[1] * k, SORREL_TINT[2] * k];
    const base = p.clone().addScaledVector(n, stem);
    const T = new Vector3(-n.z, 0, n.x);
    if (T.lengthSq() < 1e-6) T.set(1, 0, 0);
    T.normalize();
    const B = new Vector3().crossVectors(n, T);
    for (let j = 0; j < leaflets; j++) {
      const yaw = yaw0 + (j / leaflets) * TAU + (plantRng() - 0.5) * 0.4;
      const dir = new Vector3().addScaledVector(T, Math.cos(yaw)).addScaledVector(B, Math.sin(yaw)).multiplyScalar(0.8).addScaledVector(n, 0.45 + plantRng() * 0.3).normalize();
      foliage41.addLeaf(base, dir, size * (0.85 + plantRng() * 0.3), plantRng() * TAU, 0.05, tint);
    }
    trefoils++;
  };
  // colonies on the crown (west-weighted, where the moss is thick)
  for (let c = 0; c < 26; c++) {
    const s0 = c < 18 ? lerp(-L / 2 - 1, 1.5, plantRng()) : lerp(1.5, L / 2 - 1.5, plantRng());
    const psi0 = Math.PI / 2 + (plantRng() - 0.5) * 1.6;
    const members = 2 + Math.floor(plantRng() * 3);
    for (let m = 0; m < members; m++) {
      const s = s0 + (plantRng() - 0.5) * 0.5;
      const psi = psi0 + (plantRng() - 0.5) * 0.15;
      if (s < sEndW(psi) + 0.4 || s > sEndE(psi) - 0.6) continue;
      const up = upness(psi);
      if (mossCap(psi, s, up) < 0.2) continue;
      surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, up) - 0.01, _tp);
      surfaceNormal(psi, s, _tn);
      trefoil(_tp, _tn, 1);
    }
  }
  // at the root flares' feet and along their crowns
  for (const [fx, fy, fz] of rootFeet) {
    for (let i = 0; i < 3; i++) {
      const x = fx + (plantRng() - 0.5) * 1.4;
      const z = fz + (plantRng() - 0.5) * 1.4;
      if (terrain.mask(x, z).path > 0.01) continue;
      _tp.set(x, terrain.height(x, z), z);
      terrain.normal(x, z, _tn);
      trefoil(_tp, _tn, 1.1);
    }
    void fy;
  }
  // small ferns on the crown over the path crossing (the belly's underside is bare)
  for (let i = 0; i < 8; i++) {
    const s = pathS + (plantRng() - 0.5) * 6;
    const psi = Math.PI / 2 + (plantRng() - 0.5) * 1.2;
    if (s < sEndW(psi) + 0.5) continue;
    surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) - 0.04, _tp);
    surfaceNormal(psi, s, _tn);
    _tn.y += 0.6;
    _tn.normalize();
    foliage41.addTuft(_tp.clone(), _tn.clone(), 0.32 + plantRng() * 0.14, 1, 0.06, [0.7, 0.8, 0.6]);
  }
  // moss beards: thin strands with tiny leaflets from the crown's edge on both flanks, densest
  // over the path; and six more vines under the belly by the crossing
  let beards = 0;
  const beardRng41 = rng.fork('beards41b');
  for (let i = 0; i < 34; i++) {
    const s = pathS + (beardRng41() - 0.5) * 12;
    const north = i % 2 === 1;
    let psi = north ? Math.PI - 0.3 : 0.3;
    for (let it = 0; it < 3; it++) {
      const up = clamp(0.28 - mossEdge(psi, s), -0.3, 0.8);
      psi = north ? Math.PI - Math.asin(up) : Math.asin(up);
    }
    if (s < sEndW(psi) + 0.5 || s > sEndE(psi) - 0.8) continue;
    surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) + 0.05, _tp);
    foliage41.addHangingVine(_tp.clone(), 0.25 + beardRng41() * 0.45, { amount: 0.12, thickness: 0.006, leafSize: 0.032, leafEvery: 0.028, drift: new Vector3((beardRng41() - 0.5) * 0.15, 0, (beardRng41() - 0.5) * 0.15) });
    beards++;
  }
  for (let i = 0; i < 6; i++) {
    const s = pathS + (beardRng41() - 0.5) * 6;
    const psi = -Math.PI / 2 + (beardRng41() - 0.5) * 1.6;
    const hook = surfacePoint(psi, s, rBase(psi, s) - 0.12);
    foliage41.addHangingVine(hook, 1.1 + beardRng41() * 1.4, { amount: 0.1, thickness: 0.016 });
  }
  for (const m of foliage41.build(mats, 'log41')) group.add(m);
  const detail41 = {
    outerGrid: [cols, rows] as [number, number],
    mossTufts: crownTufts.count,
    mossTuftTriangles: crownTufts.triangles,
    rimSplinters,
    skirtTriangles: Math.floor((skirtGeo.index ? skirtGeo.index.count : skirtGeo.attributes.position.count) / 3),
    carpetGrid: [carpetCols, carpetRows] as [number, number],
    carpetTriangles: Math.floor((carpet.index ? carpet.index.count : carpet.attributes.position.count) / 3),
    trefoils,
    beards,
    rootTufts,
    tuftLod: { centre: [tuftCentre.x, tuftCentre.y, tuftCentre.z] as [number, number, number], dropBeyondM: TUFT_LOD_M },
    innerGrid: [innerCols, innerRows] as [number, number],
    fungusShelves,
  };

  // ---- lanterns (round 32: placed and lit for frame 56 s). The frame's arch carries three warm
  // blobs: two on the thin east body's lower flank at the axis level, (0.602, 0.339) and (0.647,
  // 0.326), and one under the west root mass at (0.463, 0.442) — all peak 0.65–0.76, hue 36–38°,
  // 7–19 px soft discs at 1280. Ours registered none: the two crossing pods project at
  // (0.48, 0.45) / (0.52, 0.44) and the three "near-end" pods, on 1.15–1.5 m cords under the sunk
  // west third's belly (0.85–1.8 m over the ground there), at (0.44–0.48, 0.47–0.50) — on the far
  // ground line, under the arch box — and every pod at the near lanterns' 2.0 vanished into the
  // 86 % veil (materials.ts FAR_LANTERN_INTENSITY). Now every arch pod takes the far material and a
  // halo disc (one mesh, +1 draw; materials.ts lanternHalo — unfogged, 0.7 m, the frame's amber);
  // the crossing pods stay (frame 60 s has pods under the arch) and the three near-end pods are
  // replaced by three placed for the frame's blobs, each hung so its centre projects onto one:
  // one from the west mass's SOUTH FLANK (ψ −0.5, the camera side, a 1.6 m cord → the pod at
  // (3.0, 5.9, −53.0), D (0.466, 0.437) against the frame's (0.463, 0.442); round 45 raised it
  // ≈ 1 m for the verge's clearance — see `westFlank`), two on pegs driven
  // into the east body's south flank (ψ +0.25 / +0.27, a 0.85 m peg, 1.2 / 0.55 m cords →
  // (13.1, 9.5, −49.4) → D (0.602, 0.347) on the frame's (0.602, 0.339), and ≈ (0.62, 0.34)).
  // The frame's third blob (0.647, 0.326) is NOT reachable: D's depth image puts a 25 m trunk over
  // x ≥ 0.625 in that row (a pod hung there at (15.6, 10.6, −48.1) → (0.640, 0.317) sat behind
  // it), so the second peg pod stops at the last visible column. The pegs fold into the bark
  // draw. Streams: 'lanterns' keeps the crossing pods' draws in order; the flank and peg pods draw
  // after them on the same stream (the old near-end pods' draws are gone — their cord clamps
  // depended on the ground — so the peg pods' cord details differ from the round-31 build). ----
  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('lanterns');
  const podCentre = new Vector3();
  const hang = (hook: Vector3, cord: number, scale: number, kind: LanternKind) => {
    const rig = buildLantern(hook, cord, mats, lanternRng, scale, kind, true);
    group.add(rig.pivot);
    lanterns.push(rig);
    return rig;
  };
  for (let i = 0; i < def.lanterns; i++) {
    const s = pathS + (i - (def.lanterns - 1) / 2) * 2.6 + 0.4;
    // Round 44 (structures-28): the first crossing pod hung from the belly's north side at
    // ψ −π/2 − 0.22 — 3.3 m below the axis, its bottom 1.3 m over the path at the arch's north
    // exit, dead on the spine (survey-1 crop 29: the eye camera sat inside it). The hook now sits
    // higher up the north flank (ψ −π/2 − 0.85: 2.2 m below the axis, 2.6 m north of it) on a
    // shorter cord, so the pod's bottom clears ≥ 2.3 m over the walkable strip; the audit's
    // `podClearance` measures it. The other pods and the cord draws are unchanged.
    // Round 45 (details-1): the second crossing pod hung from the belly's south side at ψ −π/2
    // + 0.28 on a 0.55–0.8 m cord — its bottom 1.96 m over the strip 1.9 m off the spine (the
    // ground under the arch's south exit is 0.1 m higher than under the north one). Its hook
    // moves up the south flank (ψ −π/2 + 0.62: 0.46 m higher, 1 m further south, the mirror of
    // the first pod's move) on a 0.38–0.48 m cord, so its bottom clears ≥ 2.5 m; the two pods
    // now flank the passage. Any pod ψ ≥ 0.62 rad from the bottom hangs clear of the bark: a
    // plumb cord from the lower half of a cylinder never re-enters it, and the ±0.37 m relief
    // under the hook falls away at tan(0.62) ≈ 0.7 m per metre of the pod's 0.25 m reach.
    const psi = i === 0 ? -Math.PI / 2 - 0.85 : -Math.PI / 2 + (i % 2 ? 0.62 : -0.22);
    const hook = surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) - 0.08);
    const cordDraw = lanternRng();
    const rig = hang(hook, i === 0 ? 0.42 + cordDraw * 0.1 : i % 2 ? 0.38 + cordDraw * 0.1 : 0.55 + cordDraw * 0.25, 1.1, 'orange');
    podCentre.add(rig.pod);
  }
  // the west mass's flank pod: ψ −0.5 puts the hook 1.6 m below the axis on the camera side, 3 m
  // out; the pod (cord + 0.23 m) then hangs 3.4 m below the axis — at the belly's level but 3 m
  // south of it, where the bark has long curved in under the hook — clear of the ±0.37 m relief
  // without a peg, 1.7 m over the ground there.
  // Round 45 (details-1): 1.7 m over the ground was 1.43 m of clearance under the pod's bottom,
  // and that ground is the path's verge (the mask reaches it). The hook moves up the flank a
  // little (ψ −0.4: 1.33 m below the axis, 3.1 m out) and the cord shortens to 0.85 m, so the
  // pod hangs 2.4 m below the axis — 1.06 m higher than before, its bottom ≥ 2.4 m over the
  // verge — while staying 0.7 m clear of the flank's curve (the surface at that depth is 2.5 m
  // out). In D the blob moves ≈ 0.02 of the frame up from (0.466, 0.437); still the frame's
  // west root-mass lantern.
  const westFlank: [number, number, number][] = [[-7.3, -0.4, 0.85]];
  for (const [s, psi, cord] of westFlank) {
    if (s < sEndW(psi) + 0.5) continue;
    const hook = surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) - 0.08);
    // all amber: the frame's three arch blobs are 36–38° (no lime among them)
    hang(hook, cord, 1.15, 'orange');
  }
  // the east body's peg pods: at the axis level the flank is vertical, so a straight-down cord
  // from the surface would bury the pod in the bark — each hangs from a 0.85 m peg standing out
  // of the flank (a little upward), its foot sunk 0.25 m into the bark
  const pegParts = [];
  const eastStart = lanterns.length;
  const eastPegs: [number, number, number][] = [
    [4.25, 0.25, 1.2],
    [5.55, 0.27, 0.55],
  ];
  for (const [s, psi, cord] of eastPegs) {
    const r = rBase(psi, s) + detail(psi, s, upness(psi));
    const foot = surfacePoint(psi, s, r - 0.25);
    const out = radialDir(psi, s);
    out.y += 0.12;
    out.normalize();
    const tip = foot.clone().addScaledVector(out, 0.85);
    const peg = new CylinderGeometry(0.045, 0.07, 0.85, 7);
    peg.rotateX(Math.PI / 2);
    peg.applyMatrix4(basisMatrix(foot.clone().lerp(tip, 0.5), out));
    setColorAttribute(peg, [0.55, 0.5, 0.42]);
    pegParts.push(peg);
    const hook = tip.clone();
    hook.y -= 0.03;
    hang(hook, cord, 1.15, 'orange');
  }
  if (pegParts.length) {
    const pegMesh = new Mesh(merge(pegParts), mats.logBark);
    pegMesh.name = 'log-pegs';
    pegMesh.castShadow = pegMesh.receiveShadow = true;
    group.add(pegMesh);
  }
  // the halo discs: one quad per pod about its centre (the material billboards them; the corner
  // attribute's length scales the disc — the frame's east pair are the small blobs, 9–14 px
  // against the west one's 74, so the peg pods take FAR_HALO_EAST_SCALE of the radius); the
  // colour is the material's (materials.ts FAR_HALO_TINT), the vertex colour stays white
  const haloParts = [];
  for (let i = 0; i < lanterns.length; i++) {
    const p = lanterns[i].pod;
    const scale = i >= eastStart ? FAR_HALO_EAST_SCALE : 1;
    const quad = new PlaneGeometry(1, 1);
    const pos = quad.attributes.position as Float32BufferAttribute;
    const corner = new Float32Array(pos.count * 2);
    for (let v = 0; v < pos.count; v++) {
      corner[v * 2] = (Math.sign(pos.getX(v)) || 1) * scale;
      corner[v * 2 + 1] = (Math.sign(pos.getY(v)) || 1) * scale;
      pos.setXYZ(v, p.x, p.y, p.z);
    }
    quad.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
    setColorAttribute(quad, [1, 1, 1]);
    haloParts.push(quad);
  }
  const halos = new Mesh(merge(haloParts), mats.lanternHalo);
  halos.name = 'log-lantern-halos';
  halos.frustumCulled = true;
  halos.castShadow = halos.receiveShadow = false;
  group.add(halos);
  const lights: PointLight[] = [];
  if (def.lanterns > 0) {
    podCentre.divideScalar(def.lanterns);
    podCentre.y -= 0.3;
    const light = new PointLight(ctx.config.palette.lanternGlow, 8, 8, 2);
    light.position.copy(podCentre);
    light.name = 'log-lantern-light';
    group.add(light);
    lights.push(light);
  }

  // ---- terrain contact: where the sunk ends' undersides meet the ground (both sides, both ends) ----
  const bases: [number, number, number][] = [];
  for (const end of [0, 1] as const) {
    const s = end === 0 ? -L / 2 + 0.5 : L / 2 - 0.5;
    const f = frameAt(s);
    const right = f.r.clone();
    const centre = axisAt(s);
    for (const side of [-1, 1]) {
      // bisection on lateral offset: cylinder underside y(l) = yc - sqrt(R² - l²) equals terrain
      let lo = 0;
      let hi = R * 0.98;
      const fAt = (l: number) => {
        const x = centre.x + right.x * l * side;
        const z = centre.z + right.z * l * side;
        return terrain.height(x, z) - (centre.y - Math.sqrt(Math.max(0, R * R - l * l)));
      };
      if (fAt(lo) <= 0 || fAt(hi) >= 0) continue;
      for (let it = 0; it < 40; it++) {
        const mid = (lo + hi) / 2;
        if (fAt(mid) > 0) lo = mid;
        else hi = mid;
      }
      const l = (lo + hi) / 2;
      const x = centre.x + right.x * l * side;
      const z = centre.z + right.z * l * side;
      bases.push([x, terrain.height(x, z), z]);
    }
  }

  // round 21: the root flares' feet are terrain contacts too
  bases.push(...rootFeet);

  // round 44: every pod's lowest point (its merged geometry's bounding box under the hook) over
  // the ground beneath it, and whether that ground is the walkable path — a pod over the path
  // must clear POD_PATH_CLEARANCE_M
  /** horizontal distance (m) from a point to the path spine polyline (the walkable strip is ± layout.pathHalfWidth of it) */
  const spineDistance = (x: number, z: number) => {
    const spine = ctx.layout.pathSpine;
    let best = Infinity;
    for (let i = 0; i + 1 < spine.length; i++) {
      const [ax, , az] = spine[i];
      const [bx, , bz] = spine[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  };
  const podClearance = lanterns.map((l) => {
    const mesh = l.pivot.children[0] as Mesh;
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bottom = l.pivot.position.y + geo.boundingBox!.min.y;
    const ground = terrain.height(l.pod.x, l.pod.z);
    const spineDist = spineDistance(l.pod.x, l.pod.z);
    // `onPath`: the paving mask reaches the pod's footprint at all (its feathered verge included);
    // `onStrip`: inside the walkable strip proper, ± pathHalfWidth of the spine — the clearance
    // requirement applies to the strip
    const onPath = terrain.mask(l.pod.x, l.pod.z).path > 0.01;
    return {
      pod: [+l.pod.x.toFixed(2), +l.pod.y.toFixed(2), +l.pod.z.toFixed(2)] as [number, number, number],
      bottom: +bottom.toFixed(2),
      ground: +ground.toFixed(2),
      clearance: +(bottom - ground).toFixed(2),
      onPath,
      onStrip: spineDist <= ctx.layout.pathHalfWidth,
      spineDist: +spineDist.toFixed(2),
    };
  });

  return {
    group,
    bases,
    lanterns,
    podPositions: lanterns.map((l) => [+l.pod.x.toFixed(2), +l.pod.y.toFixed(2), +l.pod.z.toFixed(2)] as [number, number, number]),
    podClearance,
    minPathClearance: +Math.min(Infinity, ...podClearance.filter((p) => p.onStrip).map((p) => p.clearance)).toFixed(2),
    lights,
    leaves: foliage.leafCount + foliage21.leafCount + foliage41.leafCount,
    tufts: foliage.tuftCount + foliage21.tuftCount + foliage41.tuftCount,
    detail41,
    detail44,
  };
}
