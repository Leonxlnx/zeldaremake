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
import { CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Group, Mesh, PlaneGeometry, PointLight, Vector3 } from 'three';
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
    trefoils: number;
    beards: number;
    rootTufts: number;
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
  const spikeAmount = (psi: number, spikes: Spike[]) => {
    let a = 0;
    for (const sp of spikes) {
      const d = Math.abs(angleDiff(psi, sp.psi)) / sp.width;
      if (d < 1) a += sp.length * Math.pow(1 - d, 1.4);
    }
    return a;
  };
  // west end: strongly oblique (the south lip is ~3.4 m shorter than the north) so the hollow
  // opens toward the path and shot D
  const sEndW = (psi: number) => -L / 2 - 1.7 * (1 - Math.cos(psi)) - spikeAmount(psi, spikesW) + 0.3 * noise.noise(psi * 3, 1.5);
  const sEndE = (psi: number) => L / 2 + 0.35 * (1 + Math.cos(psi + 1)) + spikeAmount(psi, spikesE) + 0.25 * noise.noise(psi * 3, 8.5);

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
  const outerColor = (psi: number, s: number, disp: number): [number, number, number] => {
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
    const mossC = [1.3 + 0.8 * shade, 2.4 + 1.4 * shade, 0.5 + 0.3 * shade];
    return [lerp(barkC[0], mossC[0], m), lerp(barkC[1], mossC[1], m), lerp(barkC[2], mossC[2], m)];
  };

  const _n = new Vector3();
  // round 41: 224 × 160 → 288 × 220 (7.4 cm round, 7.8 cm along on the west half): the rows are
  // warped so 60 % of them cover the west 45 % of the length — the broken end and the path
  // crossing the player walks under — and the east body, 10–20 m from the path, keeps ≈ 14 cm
  const cols = 288;
  const rows = 220;
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
      out.color = outerColor(psi, s, disp);
    },
    { cols, rows, closedU: true },
  );

  // hollow interior (BackSide material) — smooth, ends slightly inside the outer ends
  const inner = gridSurface(
    (u, v, out) => {
      const psi = u * TAU;
      const s = lerp(sEndW(psi) + 0.12, sEndE(psi) - 0.12, v);
      const r = rBase(psi, s) - wall + 0.06 * noise.noise(psi * 2, s * 0.6);
      surfacePoint(psi, s, r, out.position);
      out.uv = [(psi * R) / 2.6, s / 2.6];
    },
    { cols: 96, rows: 48, closedU: true },
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
        surfacePoint(psi, s, lerp(rOut, rIn, v), out.position);
        out.uv = [(psi * R) / 1.5, v];
        const d = lerp(0.55, 0.28, v) * (0.85 + 0.3 * noise.noise(psi * 6, v * 3 + end * 5));
        out.color = [d, d * 0.8, d * 0.62];
      },
      { cols: 168, rows: 3, closedU: true },
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
    endParts.push(shard);
    rimSplinters++;
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
  const n3 = new Noise3D(rng.fork('tuft-noise41'));
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
  /** cushion colonies (as on Saria's cap): the tufts gather where the field is high */
  const colony = (p: Vector3) => smoothstep(0.42, 0.53, 0.5 + 0.5 * n3.noise(p.x * 1.6 + 1.7, p.y * 1.6, p.z * 1.6 + 4.1));
  /**
   * the crown moss on the cap-moss material (albedo map ≈ 0.45 mean under the vertex tint, no
   * shade floor): an olive that sits on the sheet's veiled level in D and reads as damp moss
   * with lit crests at 3 m; darker down the flanks and on the north side
   */
  const crownMoss = (psi: number, s: number): [number, number, number] => {
    const up = upness(psi);
    const lit = lerp(0.5, 1, smoothstep(-0.2, 0.9, up)) * (0.85 + 0.3 * noise.noise(s * 1.3 + 2, psi * 2.5));
    return [0.19 * lit, 0.27 * lit, 0.05 * lit];
  };
  const _tp = new Vector3();
  const _tn = new Vector3();
  for (let i = 0; i < 5200; i++) {
    // 78 % of the attempts on the west half (the path crossing and the broken end — the only
    // part a player stands under; the east half is 8–15 m from any path point)
    const west = tuftRng() < 0.78;
    const s = west ? lerp(-L / 2 - 1.5, 1.5, tuftRng()) : lerp(1.5, L / 2 - 0.8, tuftRng());
    const psi = Math.PI / 2 + (tuftRng() - 0.5) * 2.4;
    const r = 0.03 + 0.06 * Math.pow(tuftRng(), 1.4);
    const aspect = 0.75 + tuftRng() * 0.5;
    const yaw = tuftRng() * TAU;
    const hK = 0.55 + tuftRng() * 0.4;
    const seed = 1 + Math.floor(tuftRng() * 1e6);
    const keep = tuftRng();
    const keep2 = tuftRng();
    if (s < sEndW(psi) + 0.25 || s > sEndE(psi) - 0.4) continue;
    const up = upness(psi);
    const thick = mossCap(psi, s, up);
    if (keep > smoothstep(0.12, 0.45, thick)) continue;
    surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, up), _tp);
    if (keep2 > lerp(0.08, 1, colony(_tp))) continue;
    surfaceNormal(psi, s, _tn);
    tuftSpecs.push({
      position: _tp.clone(),
      normal: _tn.clone(),
      rx: r * aspect,
      rz: r / aspect,
      h: r * hK,
      yaw,
      color: crownMoss(psi, s),
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
  const crownTufts = buildMossTufts(tuftSpecs, n3, { segments: [7, 5], topGain: 1.45, rimGain: 0.5, topTint: [1.0, 1.05, 0.8] });
  const tuftMesh = new Mesh(crownTufts.geometry, mats.capMoss);
  tuftMesh.name = 'log-moss-tufts';
  tuftMesh.castShadow = false;
  tuftMesh.receiveShadow = true;
  // its own static bucket (renderOrder is part of the merge key) with a culling sphere round the
  // arch alone — the shared roof-tuft bucket spans the whole hero group and is drawn in every view
  tuftMesh.renderOrder = 1;
  group.add(tuftMesh);

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
  const skirtMesh = new Mesh(skirtGeo, mats.capMoss);
  skirtMesh.name = 'log-moss-skirt';
  // rides in the arch's own cap-moss bucket with the tufts (a caster would fold into the roof
  // bucket and stretch its culling sphere from the house to the arch)
  skirtMesh.castShadow = false;
  skirtMesh.receiveShadow = true;
  skirtMesh.renderOrder = 1;
  group.add(skirtMesh);

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
    foliage41.addTuft(_tp.clone(), _tn.clone(), 0.5 + plantRng() * 0.3, 1, 0.06, [0.7, 0.8, 0.6]);
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
    trefoils,
    beards,
    rootTufts,
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
  // (3.0, 5.9, −53.0), D (0.466, 0.437) against the frame's (0.463, 0.442)), two on pegs driven
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
    const psi = -Math.PI / 2 + (i % 2 ? 0.28 : -0.22);
    const hook = surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) - 0.08);
    const rig = hang(hook, 0.55 + lanternRng() * 0.25, 1.1, 'orange');
    podCentre.add(rig.pod);
  }
  // the west mass's flank pod: ψ −0.5 puts the hook 1.6 m below the axis on the camera side, 3 m
  // out; the pod (cord + 0.23 m) then hangs 3.4 m below the axis — at the belly's level but 3 m
  // south of it, where the bark has long curved in under the hook — clear of the ±0.37 m relief
  // without a peg, 1.7 m over the ground there
  const westFlank: [number, number, number][] = [[-7.3, -0.5, 1.6]];
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

  return {
    group,
    bases,
    lanterns,
    podPositions: lanterns.map((l) => [+l.pod.x.toFixed(2), +l.pod.y.toFixed(2), +l.pod.z.toFixed(2)] as [number, number, number]),
    lights,
    leaves: foliage.leafCount + foliage21.leafCount + foliage41.leafCount,
    tufts: foliage.tuftCount + foliage21.tuftCount + foliage41.tuftCount,
    detail41,
  };
}
