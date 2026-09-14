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
import { CatmullRomCurve3, Group, Mesh, PointLight, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { TAU, angleDiff, faceTowards, gridSurface, merge, sweepTube } from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';

export interface LogArchBuild {
  group: Group;
  bases: [number, number, number][];
  lanterns: LanternRig[];
  lights: PointLight[];
  leaves: number;
  tufts: number;
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
  const bark = (psi: number, s: number) => {
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
  const detail = (psi: number, s: number, up: number) => bark(psi, s) + mossCap(psi, s, up);
  const outerColor = (psi: number, s: number, disp: number): [number, number, number] => {
    const up = upness(psi);
    const arc = psi * R;
    const patches = noise.fbm(arc * 0.5 + 9, s * 0.5, 2);
    const relief = bark(psi, s);
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
  const cols = 224;
  const rows = 160;
  const outer = gridSurface(
    (u, v, out) => {
      const psi = u * TAU;
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

  // ---- lanterns under the arch opening + a cluster under the near (west) end ----
  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('lanterns');
  const podCentre = new Vector3();
  for (let i = 0; i < def.lanterns; i++) {
    const s = pathS + (i - (def.lanterns - 1) / 2) * 2.6 + 0.4;
    const psi = -Math.PI / 2 + (i % 2 ? 0.28 : -0.22);
    const hook = surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) - 0.08);
    const rig = buildLantern(hook, 0.55 + lanternRng() * 0.25, mats, lanternRng, 1.1);
    group.add(rig.pivot);
    lanterns.push(rig);
    podCentre.add(rig.pod);
  }
  // near-end pods (concept sheet 01): three hang on longer cords from the belly of the west
  // third, where shot D sees the underside at (0.40–0.44, 0.42–0.45) — no extra light, the
  // shared glow above covers them and at 47 m they read as faint warm dots in the haze
  const nearEnd: [number, number, number][] = [
    [-8.6, -0.3, 1.5],
    [-7.0, 0.22, 1.15],
    [-5.6, -0.12, 1.35],
  ];
  for (const [s, dpsi, cord] of nearEnd) {
    const psi = -Math.PI / 2 + dpsi;
    if (s < sEndW(psi) + 0.5) continue;
    const hook = surfacePoint(psi, s, rBase(psi, s) + detail(psi, s, upness(psi)) - 0.08);
    // layout round 6: the belly of the sunk west third can be within 1.5 m of the ground (the
    // pad under the new footing) — the cord is shortened so the pod hangs ≥ 0.7 m clear of it
    const cordClamped = Math.max(0.4, Math.min(cord, hook.y - terrain.height(hook.x, hook.z) - 0.7));
    const rig = buildLantern(hook, cordClamped, mats, lanternRng, 1.15, lanternRng() < 0.4 ? 'lime' : 'orange');
    group.add(rig.pivot);
    lanterns.push(rig);
  }
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

  return { group, bases, lanterns, lights, leaves: foliage.leafCount + foliage21.leafCount, tufts: foliage.tuftCount + foliage21.tuftCount };
}
