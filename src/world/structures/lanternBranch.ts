/**
 * The lantern bough over the plaza's west edge: the left quarter of shot A, the thick dark limb
 * across the top of shot B.
 *
 * The giant builder (trees system) grows the bare limb from the lantern tree's trunk along
 * `layout.lanternBranch` — from → to, radius → tipRadius, a shallow sag and a small random side
 * wiggle — and continues it 1.8 m past `to`. Reference frame 1 s shows that stretch as an OLD,
 * IRREGULAR, MOSS-COVERED branch: bends and a fork, bark ridges, moss sheets and small ferns on
 * its upper side, side twigs with leaf sprigs, vines hanging, and the lamps grouped on short
 * cords right under it (the owner's sheet 01 "Branch bridge" is the finish reference). This
 * module dresses the giant's limb between `from` and `to` without moving it:
 *   - a bark SLEEVE swept around the limb's own axis, a little wider than the limb (its random
 *     wiggle stays inside) and sagging below it in three knees, with ±20 % radius wobble and
 *     ridged bark; the sleeve tapers into the limb at both ends, so the giant's own bark carries
 *     on toward the trunk and past the tip;
 *   - textured moss sheets draped over the top, fraying down the flank that faces the cameras;
 *   - a fork stub and three side twigs tipped with shaded leaf sprigs;
 *   - ferns and grass tufts on the moss, vines hanging from the underside;
 *   - the three pod lanterns on 0.5–0.7 m cords from the knees' undersides.
 * The endpoints and radii are the layout's, so the W01 projection is unchanged.
 */
import { CatmullRomCurve3, Group, Mesh, PointLight, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { TAU, faceTowards, gridSurface, merge, sweepTube } from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';

export interface LanternBranchBuild {
  group: Group;
  lanterns: LanternRig[];
  lights: PointLight[];
  leaves: number;
}

const UP = new Vector3(0, 1, 0);

// Reference frame 1 s: the pods hang grouped over the plaza's west edge at screen x 0.08–0.26;
// at t 0.1 the outer pod fell off A's left edge (x −0.05) and the row read widely spaced (W14
// review). The third sits toward the trunk end, outside B, C and D.
const LANTERN_T = [0.68, 0.9, 0.45];
const BRANCH_POD_SCALE = 0.62;
/** short cords (W14): frame 1 s hangs the lamps grouped close under the bough; 0.5–0.7 m, where
 *  the 1–1.2 m cords read as a widely spaced row far below a smooth limb */
const CORDS = [0.7, 0.7, 0.68];
/** knees: where the sleeve's underside sags below the giant's limb (s along from→to, metres,
 *  half-width in s); the two outer pods hang from the second and third */
const KNEES = [
  { s: 0.22, sag: 0.17, w: 0.11 },
  { s: 0.46, sag: 0.14, w: 0.09 },
  { s: 0.69, sag: 0.11, w: 0.08 },
];

export function buildLanternBranch(ctx: WorldContext, mats: StructureMaterials, rng: Rng): LanternBranchBuild {
  const def = ctx.layout.lanternBranch;
  const group = new Group();
  group.name = 'lantern-branch';
  const from = new Vector3(...def.from);
  const to = new Vector3(...def.to);
  const span = to.clone().sub(from);
  const dir = span.clone().normalize();
  const len = span.length();
  /** horizontal unit vector across the limb; +side faces cameras A and B */
  const side = new Vector3(-dir.z, 0, dir.x).normalize();
  /** cross-section basis: e1 across, e2 "up" (⟂ dir) — ψ = 0 is the top, +ψ turns toward the cameras */
  const e1 = side;
  const e2 = new Vector3().crossVectors(side, dir).normalize();
  if (e2.y < 0) e2.negate();
  const radial = (psi: number, out = new Vector3()) => out.set(0, 0, 0).addScaledVector(e2, Math.cos(psi)).addScaledVector(e1, Math.sin(psi));

  /** the giant builder's limb: radius taper and shallow sag along from→to (its ±0.12 m side
   *  wiggle has a random phase and is absorbed by the sleeve's margin) */
  const r0 = def.radius ?? 0.42;
  const r1 = def.tipRadius ?? 0.16;
  const limbRadius = (s: number) => r0 + (r1 - r0) * Math.pow(clamp(s, 0, 1), 0.85);
  const limbAxis = (s: number, out = new Vector3()) => out.copy(from).addScaledVector(span, s).addScaledVector(UP, -0.16 * Math.sin(Math.PI * s));

  const noise = new Noise2D(`${ctx.config.seed}/lantern-branch/bark`);
  const knee = (s: number) => KNEES.reduce((a, k) => a + k.sag * Math.exp(-(((s - k.s) / k.w) ** 2)), 0);
  /** the sleeve's axis is the limb's own; the knees swell its underside only (egg sections) */
  const spine = (s: number, out = new Vector3()) => limbAxis(s, out);
  // the sleeve: the limb's radius plus a 1.5 cm margin and a slow 0–8 % wobble (with the ridges
  // and gnarl below, ±20 % locally), tapering back inside the limb over the first and last tenth
  const wobble = (s: number) => 0.5 + 0.5 * Math.sin(s * 21 + 1.3) * Math.cos(s * 7.7 + 0.4);
  const emerge = (s: number) => smoothstep(0, 0.1, s) * smoothstep(1, 0.93, s);
  const sleeveBase = (s: number) => lerp(limbRadius(s) * 0.85, (limbRadius(s) + 0.015) * (1 + 0.08 * wobble(s)), emerge(s));
  /** sleeve surface radius: bark ridges (fluting along the limb), metre-scale gnarl, and the
   *  knees' bellies hanging from the lower half */
  const sleeveR = (s: number, psi: number) => {
    const ridge = noise.ridged(psi * 1.3 + s * 2, s * 11 + 2, 2) - 0.5;
    const gnarl = noise.noise(s * 4 + 7, psi * 0.7);
    const belly = Math.pow(smoothstep(0.15, 1, 0.5 - 0.5 * Math.cos(psi)), 1.4);
    return sleeveBase(s) * (1 + 0.09 * ridge + 0.07 * gnarl) + knee(s) * belly * emerge(s);
  };
  const _rad = new Vector3();
  const surface = (s: number, psi: number, lift: number, out = new Vector3()) => spine(s, out).addScaledVector(radial(psi, _rad), sleeveR(s, psi) + lift);

  // ---- bark sleeve ----
  const mossFringe = (s: number, psi: number) => {
    // moss covers the top and hangs down the camera-side flank in a ragged fringe
    const frayed = 0.55 + 0.5 * noise.fbm(s * 5 + 1, psi * 1.1, 2);
    return smoothstep(1.2 + frayed * 0.9, 0.5 + frayed * 0.4, Math.abs(psi - 0.45));
  };
  const barkColor = (s: number, psi: number): [number, number, number] => {
    // the lower half sees only the hemisphere fill and the pods' warm glow; a mild gain lets the
    // ridges catch that glow without the whole underside turning orange (a ×2.8 gain did)
    const fill = 1 + 0.6 * smoothstep(0.3, -0.5, Math.cos(psi));
    const ridge = noise.ridged(psi * 1.3 + s * 2, s * 11 + 2, 2);
    const d = fill * (0.75 + 0.3 * ridge);
    // the bark set's pale tan (0xdcb086) pulled down to the giants' albedo — 0x9b7e62 × their
    // (0.7, 0.64, 0.56) bark base ≈ (0.17, 0.1, 0.05) linear — so the sleeve reads as the same
    // wood as the limb it wraps; moss tint (the giants' shader moss, ≈ (0.2, 0.3, 0.08) linear)
    // over the top where the sheets do not cover it
    const moss = 0.85 * smoothstep(0.15, 0.7, mossFringe(s, psi));
    return [lerp(d * 0.3, 0.3, moss), lerp(d * 0.28, 0.72, moss), lerp(d * 0.26, 0.34, moss)];
  };
  const sleeve = gridSurface(
    (u, v, out) => {
      const psi = u * TAU;
      surface(v, psi, 0, out.position);
      out.uv = [(psi * sleeveBase(v)) / 1.4, (v * len) / 1.4];
      out.color = barkColor(v, psi);
    },
    { cols: 16, rows: 60, closedU: true },
  );
  faceTowards(sleeve, (p, o) => {
    const s = clamp(p.clone().sub(from).dot(dir) / len, 0, 1);
    return o.copy(p).addScaledVector(p.clone().sub(spine(s)), 4);
  });

  // ---- fork stub and side twigs (bark), each tipped with a shaded leaf sprig ----
  const twigRng = rng.fork('branch-twigs');
  const foliage = new FoliageBuilder(rng.fork('branch-foliage'), `${ctx.config.seed}/lantern-branch`);
  const sprigTint: [number, number, number] = [0.6, 0.66, 0.36];
  const barkParts = [sleeve];
  const jit = (a: number) => new Vector3((twigRng() - 0.5) * a, (twigRng() - 0.5) * a * 0.5, (twigRng() - 0.5) * a);
  // the fork: a broken-off second limb leaving the thick end upward and away from the cameras,
  // so in A it stands above the bough's line near the left edge
  {
    const s0 = 0.3;
    const base = surface(s0, -0.5, -0.12);
    const heading = dir.clone().multiplyScalar(0.45).addScaledVector(UP, 0.8).addScaledVector(side, -0.5).normalize();
    const pts = [
      spine(s0),
      base,
      base.clone().addScaledVector(heading, 0.7).add(jit(0.15)),
      base.clone().addScaledVector(heading, 1.3).addScaledVector(UP, 0.15).add(jit(0.15)),
      base.clone().addScaledVector(heading, 1.75).addScaledVector(UP, 0.35).addScaledVector(dir, 0.2),
    ];
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const fork = sweepTube(curve, {
      radius: (t) => (0.17 - 0.12 * t) * (1 + 0.12 * Math.sin(t * 13 + 1)),
      tubularSegments: 16,
      radialSegments: 9,
      uvMetres: 1.4,
      displace: (t, ang) => (noise.ridged(ang * 1.5 + 3, t * 6, 2) - 0.5) * 0.03,
      color: (t, ang) => barkColor(s0 + t * 0.1, ang - 1),
      capEnd: true,
    });
    barkParts.push(fork);
    foliage.addLeafCluster(pts[pts.length - 1].clone().addScaledVector(heading, 0.2), 0.34, 22, { size: 0.12, amount: 0.06, droop: 0.55, tint: sprigTint, tintSpread: 0.28, flatten: 0.6 });
  }
  for (const [s0, psi0] of [
    [0.42, 0.9],
    [0.6, -0.7],
    [0.84, 0.5],
  ]) {
    const base = surface(s0, psi0, -0.05);
    const heading = radial(psi0).multiplyScalar(0.6).addScaledVector(UP, 0.75).addScaledVector(dir, (twigRng() - 0.5) * 0.6).normalize();
    const l = 0.55 + twigRng() * 0.3;
    const pts = [base.clone().addScaledVector(heading, -0.1), base, base.clone().addScaledVector(heading, l * 0.55).add(jit(0.1)), base.clone().addScaledVector(heading, l).addScaledVector(UP, 0.08)];
    const twig = sweepTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), {
      radius: (t) => 0.048 - 0.032 * t,
      tubularSegments: 8,
      radialSegments: 6,
      uvMetres: 0.8,
      color: (t, ang) => barkColor(s0, psi0 + ang * 0.2),
      capEnd: true,
    });
    barkParts.push(twig);
    foliage.addLeafCluster(pts[pts.length - 1].clone().addScaledVector(heading, 0.12), 0.2, 12, { size: 0.11, amount: 0.06, droop: 0.6, tint: sprigTint, tintSpread: 0.28, flatten: 0.6 });
  }
  const barkMesh = new Mesh(merge(barkParts), mats.bark);
  barkMesh.name = 'lantern-branch-bark';
  barkMesh.castShadow = barkMesh.receiveShadow = true;
  group.add(barkMesh);

  // ---- moss sheets: ragged cushions over the top, fraying down the camera-side flank ----
  const sheetRng = rng.fork('branch-moss');
  const sheetParts = [];
  for (let i = 0; i < 7; i++) {
    const s0 = lerp(0.08, 0.92, (i + 0.5 + (sheetRng() - 0.5) * 0.5) / 7);
    const width = (1.0 + sheetRng() * 0.7) / len;
    const psiTop = -0.7 - sheetRng() * 0.4;
    const drop = 2.1 + sheetRng() * 0.8;
    const sheet = gridSurface(
      (u, v, out) => {
        const s = s0 + (u - 0.5) * width * (1 + 0.2 * noise.noise(v * 3 + i, u * 2 + 5));
        // v: 0 on the far shoulder, 1 at the frayed lower edge on the camera side; the edge
        // wanders in lobes and the sheet is thickest over the top, tucking into the bark at its rim
        const fray = 0.8 + 0.2 * noise.noise(u * 6 + i * 7, 3) - 0.2 * Math.pow(Math.abs(u - 0.5) * 2, 3);
        const psi = psiTop + v * drop * fray;
        const rim = smoothstep(0.86, 1, v) + smoothstep(0.08, 0, v) + smoothstep(0.9, 1, Math.abs(u - 0.5) * 2);
        const lift = lerp(0.05 + 0.03 * noise.noise(s * 9 + i, psi * 3), -0.015, clamp(rim, 0, 1));
        surface(s, psi, lift, out.position);
        out.uv = [(s * len) / 0.9, (psi * 0.4) / 0.9];
        const up = Math.cos(psi);
        // dull olive cushions in the giants' root-sheet tone (0.33, 0.47, 0.13 linear) scaled to
        // 0.7 — a first cut at (0.3, 0.42, 0.13) × up to 1.0 read as a lime cap against the limb's
        // shader moss; the drooping fringe gets a mild shade gain
        const lit = (0.55 + 0.3 * smoothstep(-0.3, 0.9, up) * (0.7 + 0.3 * noise.noise(s * 6, psi * 2 + 5))) * (1 + 0.6 * smoothstep(0.3, -0.5, up));
        const mossy = 0.85 + 0.3 * noise.noise(s * 8 + 2, psi * 4);
        out.color = [0.23 * lit * mossy, 0.33 * lit * mossy, 0.09 * lit * mossy];
      },
      { cols: 12, rows: 9 },
    );
    faceTowards(sheet, (p, o) => o.copy(p).addScaledVector(radial(psiTop + 0.5 * drop), 4));
    sheetParts.push(sheet);
  }
  const sheetMesh = new Mesh(merge(sheetParts), mats.moss);
  sheetMesh.name = 'lantern-branch-moss';
  sheetMesh.castShadow = sheetMesh.receiveShadow = true;
  group.add(sheetMesh);

  // ---- ferns and grass tufts on the moss (shaded olive, under the canopy) ----
  const vegRng = rng.fork('branch-veg');
  const topShade: [number, number, number] = [0.7, 0.75, 0.55];
  for (let i = 0; i < 9; i++) {
    const s = lerp(0.12, 0.92, (i + vegRng()) / 9);
    const psi = (vegRng() - 0.4) * 1.3;
    const pos = surface(s, psi, 0.03);
    const nrm = radial(psi).addScaledVector(UP, 0.4).normalize();
    foliage.addTuft(pos, nrm, 0.22 + vegRng() * 0.12, i % 3 === 2 ? 0 : 1, 0.06, topShade);
  }

  // ---- lanterns on short cords from the knees' undersides ----
  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('branch-lanterns');
  const n = Math.max(def.lanterns, LANTERN_T.length);
  for (let i = 0; i < n; i++) {
    const t = LANTERN_T[i % LANTERN_T.length];
    const hook = surface(t, Math.PI, -0.04);
    // slight offset to the side of the limb so cords don't all hang from the centreline
    hook.x += (lanternRng() - 0.5) * 0.15;
    hook.z += (lanternRng() - 0.5) * 0.15;
    // Reference frame 1 s: the bough pods span ~0.03 of the frame height at 10.7 m (≈ 0.27 m);
    // at scale 1.0 ours read ~0.45 m and dominate frame 14 s, where the footage shows them small.
    const rig = buildLantern(hook, CORDS[i % CORDS.length], mats, lanternRng, BRANCH_POD_SCALE);
    group.add(rig.pivot);
    lanterns.push(rig);
  }

  // ---- vines: from the underside and the lower flanks, the longest mid-span; short toward the
  // tip, which hangs almost over camera D, and none past it ----
  const vineRng = rng.fork('branch-vines');
  const vineSpots: [number, number, number][] = [
    [0.15, 2.4, 0.8],
    [0.33, -2.5, 1.1],
    [0.52, 2.6, 1.2],
    [0.62, 2.9, 0.9],
    [0.76, -2.4, 0.5],
  ];
  for (const [s, psi, l] of vineSpots) {
    const hook = surface(s, psi, -0.03);
    hook.x += (vineRng() - 0.5) * 0.2;
    hook.z += (vineRng() - 0.5) * 0.2;
    foliage.addHangingVine(hook, l * (0.85 + vineRng() * 0.3), { amount: 0.11, thickness: 0.014 });
  }
  for (const m of foliage.build(mats, 'lantern-branch')) group.add(m);

  const lights: PointLight[] = [];
  const c = new Vector3();
  for (const r of lanterns.slice(1)) c.add(r.pod);
  c.divideScalar(Math.max(1, lanterns.length - 1));
  // 0.9 m below the pod mean: at −0.2 the point sat against the middle pod's leaf shell and
  // painted a gold streak on it (Astra's matched renders, 2026-09-11); light falls from the pods.
  c.y -= 0.9;
  const light = new PointLight(ctx.config.palette.lanternGlow, 4.25, 6, 2);
  light.position.copy(c);
  light.name = 'branch-lantern-light';
  group.add(light);
  lights.push(light);

  return { group, lanterns, lights, leaves: foliage.leafCount };
}
