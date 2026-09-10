/**
 * Giant hollow log arch: a fallen trunk of radius ~3.6 m whose ends are sunk into the ground
 * while its belly arches over the north path. Open, obliquely broken and splintered ends show
 * the hollow interior; bark ridges run along the length; moss, grass tufts, ferns and heart-leaf
 * vines grow on top and hang from the underside; two pod lanterns hang under the arch.
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
  /** thickness of the moss cap (metres) — a real cushion on the upper third, feathering out on the flanks */
  const mossCap = (psi: number, s: number, up: number) => {
    const arc = psi * R;
    const cushions = 0.5 + 0.5 * noise.fbm(arc * 0.7 + 4, s * 0.7, 2);
    const clumps = noise.ridged(arc * 1.4 + 2, s * 1.1, 2);
    return smoothstep(0.1, 0.8, up) * (0.16 + 0.3 * cushions + 0.12 * clumps);
  };
  /** bark relief only (no moss): broad longitudinal ridges, deep narrow fissures, lumps, grain */
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
    return (ridge - 0.5) * 0.5 + (ridge2 - 0.5) * 0.12 - furrow * 0.3 - fissure * 0.4 + lumps * 0.2 + fine * 0.03;
  };
  const detail = (psi: number, s: number, up: number) => bark(psi, s) + mossCap(psi, s, up);
  const outerColor = (psi: number, s: number, disp: number): [number, number, number] => {
    const up = upness(psi);
    const arc = psi * R;
    const patches = noise.fbm(arc * 0.5 + 9, s * 0.5, 2);
    const relief = bark(psi, s);
    // moss covers the cap and creeps down the flanks in patches (more on the shaded north side)
    const m = clamp(smoothstep(0.05, 0.6, up) * (0.8 + 0.5 * patches) + 0.25 * smoothstep(0.35, 0.75, noise.noise(arc * 1.1, s * 1.1 + 2)) * smoothstep(-0.5, 0.4, up), 0, 1);
    // strong occlusion in furrows and fissures, lit crests: this is what makes the ridges read
    // at 30 m through the haze where the normal map alone would be lost
    const ao = clamp(0.62 + 1.7 * relief, 0.18, 1.3);
    const vari = 0.85 + 0.3 * noise.noise(arc * 0.9, s * 0.9 + 7);
    // the underside and the shaded lower flanks get no sky: bake the occlusion so the belly of
    // the arch stays dark in the flat ambient light of the hollow (reference: the mass under
    // the crown reads ≈ 0.63 of the haze luminance)
    const belly = lerp(0.42, 1, smoothstep(-0.95, 0.35, up));
    const shade = ao * vari * belly;
    // damp, weathered grey-brown bark (the material tint + dark bark map carry the rest)
    const barkC = [1.0 * shade, 0.96 * shade, 0.9 * shade];
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
  const outerMesh = new Mesh(merge([outer, ...stubParts]), mats.logBark);
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
  const pathS = (2 - cx) / A.x; // where the path spine crosses under the arch (x ≈ 2)
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
  for (const m of foliage.build(mats, 'log')) group.add(m);

  // ---- lanterns under the arch opening ----
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
  const lights: PointLight[] = [];
  if (lanterns.length) {
    podCentre.divideScalar(lanterns.length);
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

  return { group, bases, lanterns, lights, leaves: foliage.leafCount, tufts: foliage.tuftCount };
}
