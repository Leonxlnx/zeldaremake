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
 *   - a bark SLEEVE swept along the limb's BUILT centreline — the trees system publishes the
 *     sweep's own ring centres and nominal radii as `ctx.shared.lanternLimb` (a `TubePath`; s = 0
 *     at `from`, 1 at `to`, wiggle and sag included) — with a circular section of the limb's
 *     radius plus a 1.5 cm bark relief in the plane normal to the local tangent, sagging below
 *     it in three knees, with ridged bark raised outward. Round 11: the sleeve runs the whole
 *     published limb (`range`, trunk junction to tip — s ≈ −1.3 … 1.3), tapering into the limb
 *     only over its last 0.06 of s at each end; until then it stopped at `from` / `to` and, once
 *     its bark took the house's warm floor, the giant's grey-green bark beyond showed as a hard
 *     seam in A (x ≈ 0.26) and B (x ≈ 0.45). Until round 10 the sleeve was a straight tube
 *     around the layout axis whose section had to enclose the whole wiggle box (±0.12 m across,
 *     ±0.05 m vertically) plus a bump allowance, and it read in shot B as a heavy dark beam
 *     ~1.7 × the limb; the reference limb there is ~0.4 m thick under dense foliage. When the
 *     trees have not published the path (`lanternLimb` undefined) the sleeve falls back to the
 *     layout axis over s 0–1 with the giant builder's nominal sag and radius taper (audit
 *     `wrapSource`: 'shared' | 'layout');
 *   - textured moss sheets draped over the top, fraying down the flank that faces the cameras;
 *   - a fork stub and three side twigs tipped with shaded leaf sprigs;
 *   - ferns and grass tufts on the moss, vines hanging from the underside;
 *   - the pod lanterns on cords from the knees' actual undersides: two right under the visible
 *     run at the frame's A (0.208, 0.405) / (0.255, 0.39), a third on the trunk-side reach.
 * The endpoints and radii are the layout's, so the W01 projection is unchanged.
 *
 * Round 37: the limb moved from 11–12 m to 5.8–6.9 m from camera A (layout.ts lanternBranch,
 * trees/index.ts LANTERN_LIMB): the giant's own limb is ghosted and the sleeve is the whole bough,
 * casting no shadow (its band would cross the lit slabs in front of Link), under its own darker
 * shade floor (SLEEVE_FLOOR), with the fork, twigs, sheets and tufts scaled to the 0.15 m limb.
 */
import { CatmullRomCurve3, Group, Mesh, PointLight, Vector3 } from 'three';
import type { TubePath, WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { type ShadeFloor, applyShadeFloor } from '../materials/shadeFloor';
import { TAU, faceTowards, gridSurface, merge, sweepTube } from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';
import { applySleeveBarkResponse } from './sleeveBark';

export interface LanternBranchBuild {
  group: Group;
  lanterns: LanternRig[];
  lights: PointLight[];
  leaves: number;
  /** which centreline the sleeve was swept along */
  wrapSource: 'shared' | 'layout';
  /** containment of the giant's limb surface inside the sleeve (see `checkContainment`) */
  containment: ContainmentReport;
  /** world positions of the three pods' glowing centres (projected by the gauntlet to check the A heights) */
  podPositions: [number, number, number][];
  /** sleeve silhouette samples [s, top, bottom] (world, the ψ = 0 / ψ = π surface points) for thickness checks */
  silhouette: { s: number; top: [number, number, number]; bottom: [number, number, number]; radius: number }[];
}

export interface ContainmentReport {
  /** limb-surface samples taken over the sleeve's full span (s 0.1–0.93) */
  samples: number;
  /** max signed distance of a nominal-radius limb-surface point outside the sleeve surface (m); ≤ 0 = contained */
  maxProtrusion: number;
  /** the same for the limb's bark bumps (1.10 × the nominal radius, the measured relief of the giant's tube) */
  maxProtrusionBumps: number;
  /** mean clearance of the nominal limb surface inside the sleeve (m) */
  meanClearance: number;
  /** in the end tapers (the last 0.06 of s at the trunk junction and the tip) the sleeve dips inside the limb by design: max protrusion there */
  taperMaxProtrusion: number;
  /** limb-surface samples over the sleeve's round-11 extension (trunk side of `from`, past `to`) and their max protrusion */
  extensionSamples: number;
  extensionMaxProtrusion: number | null;
  /** the s span the sleeve covers */
  span: [number, number];
}

const UP = new Vector3(0, 1, 0);
/** bark relief the sleeve stands off the limb's nominal surface (m); its ridges rise outward from there */
const RELIEF = 0.015;
/** finite-difference half-step (in s) for the sleeve's local tangent: ~0.12 m, a third of a limb
 *  ring spacing, so the frame is a running average over the published polyline's kinks */
const TANGENT_H = 0.02;

// Reference frame 1 s (round 37, see layout.ts lanternBranch): two small pods right under the
// bough at A (0.208, 0.405) and (0.255, 0.39) — on the z = 1.5 run that is world x 0.39 and 0.82,
// s 0.70 and 0.89 of from (x −1.15) → to (x 1.06). W14 counts ≥ 3 branch lanterns and the frame
// shows two, so the third hangs on the trunk-side reach 2 m past `from` (x ≈ −3.1, 2.6 m up):
// off A's left edge (x −0.3), behind cameras B and F, off camera C's right edge (a first cut at
// s −0.55 hung at C (0.97, 0.39), 8.4 m out, where frame 46 s has no pod; the reach leaves C's
// frame at s ≈ −0.65), off D.
const LANTERN_T = [0.7, 0.89, -0.9];
/** pod scale: the frame's bough pods are ≈ 0.013 of the frame wide at 6.5 m ≈ 0.13 m; the
 *  scale-1 body is 0.30 m wide, 0.48 m tall with the stem, so 0.5 gives a 0.15 m body */
const BRANCH_POD_SCALE = 0.42;
/**
 * Cord lengths (m) per LANTERN_T entry. Frame 1 s hangs both pods within 0.02–0.03 of the frame
 * below the bough's underside (0.1–0.16 m at 6.5 m): the pod's stem and cap take 0.14 m at scale
 * 0.5, the cords the rest. The trunk-side pod hangs 0.45 m under the reach.
 */
const CORDS = [0.03, 0.03, 0.45];
/** knees: where the sleeve's underside sags below the giant's limb (s along from→to, sag as a
 *  multiple of the local sleeve radius so they scale with the limb's taper, and half-width in s);
 *  the two pods hang from the second and third */
const KNEES = [
  { s: 0.3, sag: 0.15, w: 0.1 },
  { s: 0.7, sag: 0.25, w: 0.07 },
  { s: 0.89, sag: 0.2, w: 0.06 },
];
/**
 * The sleeve's shade floor (round 37). Frame 1 s reads the bough at 0.27–0.33 luminance at ≈ 6 m
 * (hazed columns further off read 0.43–0.50, which the shared LIMB_BARK_FLOOR's lift 8.5 was
 * calibrated for when the limb stood 11–12 m from camera A); at 6 m the veil is thinner and the
 * bark has to be dark itself, so the sleeve carries its own copy of the bark material under a
 * lower floor (`lift` tuned by A captures: the sleeve's dark band p50 against the frame's).
 */
// (lift 4 read the underside band (A 0.06–0.20, 0.355–0.375) at p50 0.226, 6.5 at 0.273 — linear
// in linear light: 0.042 + 0.0076 / unit — so 10.5 for the frame's 0.338; chroma 0.45 read sat
// 0.27 against the frame's 0.17 at hue 53° = 52°)
const SLEEVE_FLOOR: ShadeFloor = { lift: 10.5, texture: 0.3, canopy: 1, albedo: 0.07, chroma: 0.25 };

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

  /** the giant builder's limb as published (its rings' centres and nominal radii), or the layout
   *  axis with the builder's nominal sag and taper when the trees have not published it */
  const limb: TubePath | undefined = ctx.shared.lanternLimb;
  const wrapSource: 'shared' | 'layout' = limb ? 'shared' : 'layout';
  /** the s span the sleeve covers: the whole published limb, or `from` → `to` on the fallback axis */
  const sMin = limb ? limb.range[0] : 0;
  const sMax = limb ? limb.range[1] : 1;
  const r0 = def.radius ?? 0.42;
  const r1 = def.tipRadius ?? 0.16;
  const nominalRadius = (s: number) => r0 + (r1 - r0) * Math.pow(clamp(s, 0, 1), 0.85);
  const limbAxis = (s: number, out = new Vector3()) => out.copy(from).addScaledVector(span, s).addScaledVector(UP, -0.16 * Math.sin(Math.PI * s));
  const limbRadius = (s: number) => (limb ? limb.radius(clamp(s, sMin, sMax)) : nominalRadius(s));
  /** the sleeve's axis IS the limb's centreline; the knees swell its underside only (egg sections) */
  const spine = (s: number, out = new Vector3()) => (limb ? limb.centre(clamp(s, sMin, sMax), out) : limbAxis(s, out));

  /**
   * Cross-section frame at s: e1 across (horizontal, +toward cameras A/B), e2 "up", both normal
   * to the local tangent — ψ = 0 is the top, +ψ turns toward the cameras. The published
   * centreline is a polyline through the rings, so the tangent is a central difference over
   * ±TANGENT_H, which keeps the frame continuous across the ring kinks; the residual tilt of the
   * section against the true local normal plane is ≤ 5°, a second-order (< 2 mm) containment
   * error that the 1.5 cm relief absorbs.
   */
  const _tA = new Vector3();
  const _tB = new Vector3();
  const _T = new Vector3();
  const _e1 = new Vector3();
  const _e2 = new Vector3();
  const frameAt = (s: number) => {
    const sc = clamp(s, sMin, sMax);
    spine(Math.min(sMax, sc + TANGENT_H), _tA);
    spine(Math.max(sMin, sc - TANGENT_H), _tB);
    _T.subVectors(_tA, _tB);
    if (_T.lengthSq() < 1e-12) _T.copy(dir);
    else _T.normalize();
    _e1.set(-_T.z, 0, _T.x);
    if (_e1.lengthSq() < 1e-12) _e1.copy(side);
    else _e1.normalize();
    _e2.crossVectors(_e1, _T).normalize();
    if (_e2.y < 0) _e2.negate();
    return { e1: _e1, e2: _e2, t: _T };
  };
  const radial = (s: number, psi: number, out = new Vector3()) => {
    const f = frameAt(s);
    return out.set(0, 0, 0).addScaledVector(f.e2, Math.cos(psi)).addScaledVector(f.e1, Math.sin(psi));
  };

  const noise = new Noise2D(`${ctx.config.seed}/lantern-branch/bark`);
  /** the sleeve is full along the limb and tapers back inside it over the last 0.06 of s at the
   *  trunk junction and the tip, so the giant's own bark takes over only where the limb leaves the
   *  trunk and at its very end (on the fallback axis: over the first and last tenth of from → to) */
  const taperS = limb ? 0.06 : 0.1;
  const emerge = (s: number) => smoothstep(sMin, sMin + taperS, s) * smoothstep(sMax, sMax - taperS, s);
  /** the sleeve's inner envelope: the limb's own radius plus the bark relief — no wiggle box, the
   *  axis already follows the built limb — tapering to 0.85 × the limb inside the end zones */
  const envelope = (s: number) => lerp(limbRadius(s) * 0.85, limbRadius(s) + RELIEF, emerge(s));
  /** mean sleeve radius (UV scale) */
  const sleeveBase = (s: number) => envelope(s);
  const knee = (s: number) => KNEES.reduce((a, k) => a + k.sag * envelope(k.s) * Math.exp(-(((s - k.s) / k.w) ** 2)), 0);
  /** sleeve surface radius: bark ridges (fluting along the limb) and metre-scale gnarl, both
   *  raised OUTWARD from the envelope (0–16 %) so the texture never dips inside it, plus the
   *  knees' bellies hanging from the lower half */
  const sleeveR = (s: number, psi: number) => {
    const ridge = noise.ridged(psi * 1.3 + s * 2, s * 11 + 2, 2);
    const gnarl = noise.noise(s * 4 + 7, psi * 0.7) + 1;
    const belly = Math.pow(smoothstep(0.15, 1, 0.5 - 0.5 * Math.cos(psi)), 1.4);
    return envelope(s) * (1 + 0.09 * ridge + 0.035 * gnarl) + knee(s) * belly * emerge(s);
  };
  const _rad = new Vector3();
  const surface = (s: number, psi: number, lift: number, out = new Vector3()) => {
    const r = sleeveR(s, psi) + lift;
    radial(s, psi, _rad);
    return spine(s, out).addScaledVector(_rad, r);
  };

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
    // wood as the limb it wraps; a dark olive moss tint over the top where the sheets do not
    // cover it (round 11: the lime (0.3, 0.72, 0.34) of round 10 read as a green tube under the
    // shade floor — the reference bough's moss line is hazed grey-olive, hue 53°, sat 0.16)
    const moss = 0.8 * smoothstep(0.15, 0.7, mossFringe(s, psi));
    // round 37: darker bark and a duller moss cap (the frame's bough is a dark band, 0.27–0.33,
    // with a lighter moss line only along its top edge)
    return [lerp(d * 0.24, 0.22, moss), lerp(d * 0.23, 0.34, moss), lerp(d * 0.2, 0.15, moss)];
  };
  const sleeve = gridSurface(
    (u, v, out) => {
      const psi = u * TAU;
      const s = lerp(sMin, sMax, v);
      surface(s, psi, 0, out.position);
      out.uv = [(psi * sleeveBase(s)) / 1.4, (s * len) / 1.4];
      out.color = barkColor(s, psi);
    },
    // ~60 rings per unit of s (a ring every 0.1 m of limb)
    { cols: 16, rows: Math.round(60 * (sMax - sMin)), closedU: true },
  );
  faceTowards(sleeve, (p, o) => {
    const s = clamp(p.clone().sub(from).dot(dir) / len, sMin, sMax);
    return o.copy(p).addScaledVector(p.clone().sub(spine(s)), 4);
  });

  // ---- fork stub and side twigs (bark), each tipped with a shaded leaf sprig ----
  const twigRng = rng.fork('branch-twigs');
  const foliage = new FoliageBuilder(rng.fork('branch-foliage'), `${ctx.config.seed}/lantern-branch`);
  // (round 37: the bough is 6 m from camera A, in the shade under the roof — its tufts read as
  // dark olive silhouettes in frame 1 s, not lit lime; the tints are pulled to half)
  const sprigTint: [number, number, number] = [0.3, 0.34, 0.18];
  const barkParts = [sleeve];
  const jit = (a: number) => new Vector3((twigRng() - 0.5) * a, (twigRng() - 0.5) * a * 0.5, (twigRng() - 0.5) * a);
  // the fork: a broken-off second limb leaving the thick end upward and away from the cameras,
  // so in A it stands above the bough's line near the left edge
  // (round 37: the limb is 0.15 m in radius, not 0.42 — the fork and twigs are scaled to it, and
  // the fork leans back along the limb rather than up, so nothing of it climbs above the bough's
  // line in shot A where the frame has only haze)
  const fk = Math.min(1, r0 / 0.42);
  {
    const s0 = 0.3;
    const base = surface(s0, -0.5, -0.05);
    const heading = dir.clone().multiplyScalar(0.7).addScaledVector(UP, 0.45).addScaledVector(side, -0.55).normalize();
    const pts = [
      spine(s0),
      base,
      base.clone().addScaledVector(heading, 0.7 * fk).add(jit(0.15 * fk)),
      base.clone().addScaledVector(heading, 1.3 * fk).addScaledVector(UP, 0.1 * fk).add(jit(0.15 * fk)),
      base.clone().addScaledVector(heading, 1.75 * fk).addScaledVector(UP, 0.2 * fk).addScaledVector(dir, 0.2 * fk),
    ];
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const fork = sweepTube(curve, {
      radius: (t) => (0.17 - 0.12 * t) * fk * (1 + 0.12 * Math.sin(t * 13 + 1)),
      tubularSegments: 16,
      radialSegments: 9,
      uvMetres: 1.4,
      displace: (t, ang) => (noise.ridged(ang * 1.5 + 3, t * 6, 2) - 0.5) * 0.03 * fk,
      color: (t, ang) => barkColor(s0 + t * 0.1, ang - 1),
      capEnd: true,
    });
    barkParts.push(fork);
    foliage.addLeafCluster(pts[pts.length - 1].clone().addScaledVector(heading, 0.2 * fk), 0.14, 14, { size: 0.08, amount: 0.06, droop: 0.55, tint: sprigTint, tintSpread: 0.28, flatten: 0.6 });
  }
  for (const [s0, psi0] of [
    [0.42, 0.9],
    [0.6, -0.7],
    [0.84, 0.5],
  ]) {
    const base = surface(s0, psi0, -0.03);
    const heading = radial(s0, psi0).multiplyScalar(0.6).addScaledVector(UP, 0.75).addScaledVector(dir, (twigRng() - 0.5) * 0.6).normalize();
    const l = (0.55 + twigRng() * 0.3) * (0.5 + 0.5 * fk);
    const pts = [base.clone().addScaledVector(heading, -0.1), base, base.clone().addScaledVector(heading, l * 0.55).add(jit(0.1)), base.clone().addScaledVector(heading, l).addScaledVector(UP, 0.08)];
    const twig = sweepTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), {
      radius: (t) => (0.048 - 0.032 * t) * (0.5 + 0.5 * fk),
      tubularSegments: 8,
      radialSegments: 6,
      uvMetres: 0.8,
      color: (t, ang) => barkColor(s0, psi0 + ang * 0.2),
      capEnd: true,
    });
    barkParts.push(twig);
    foliage.addLeafCluster(pts[pts.length - 1].clone().addScaledVector(heading, 0.12), 0.2, 12, { size: 0.11, amount: 0.06, droop: 0.6, tint: sprigTint, tintSpread: 0.28, flatten: 0.6 });
  }
  // the sleeve's own copy of the bark material under SLEEVE_FLOOR (a clone carries the maps but
  // no compile hooks, so it gets its floor and the sleeve's hemisphere response afresh)
  const sleeveMat = mats.sleeveBark.clone();
  sleeveMat.name = 'structures:sleeve-bark-r37';
  applyShadeFloor(sleeveMat, SLEEVE_FLOOR, ctx.config.palette.leafSun);
  applySleeveBarkResponse(sleeveMat);
  const barkMesh = new Mesh(merge(barkParts), sleeveMat);
  barkMesh.name = 'lantern-branch-bark';
  // round 37: the whole bough casts nothing (see trees/index.ts LANTERN_LIMB — at 2.2 m over the
  // plaza's south-west its band would cross the lit slabs in front of Link, which frame 1 s lights)
  barkMesh.castShadow = false;
  barkMesh.receiveShadow = true;
  group.add(barkMesh);

  // ---- moss sheets: ragged cushions over the top, fraying down the camera-side flank ----
  const sheetRng = rng.fork('branch-moss');
  const sheetParts = [];
  // (round 37: five sheets, not seven, hanging 1.4–1.9 rad down the flank instead of 2.1–2.9, at
  // 0.45 × the tone — at 6 m the seven lime cushions were the brightest thing on the bough (the
  // top-edge box A (0.04–0.20, 0.31–0.34) read sat 0.34 against the frame's 0.16), where frame
  // 1 s has one thin lighter moss line along the top and dark tufts)
  const SHEETS = 5;
  for (let i = 0; i < SHEETS; i++) {
    const place = (i + 0.5 + (sheetRng() - 0.5) * 0.5) / SHEETS;
    // the sheets (with their ±20 % s-wander) stay on the full sleeve, s 0.1–0.93: where it tapers
    // into the limb a sheet would sit inside the giant's bark (round 9c measurement, −0.10 m at
    // s 0.01); widths scaled by the same 0.85 so seven sheets cover that span as loosely as before
    // (round 37: sheet widths follow the limb's radius — 0.3–0.5 m on the 0.15 m limb, so seven
    // still spread along the 2.3 m run instead of stacking on its middle)
    const width = ((0.85 + sheetRng() * 0.6) * (0.4 + 0.6 * fk)) / len;
    const s0 = lerp(0.1 + width * 0.6, 0.93 - width * 0.6, place);
    const psiTop = -0.7 - sheetRng() * 0.4;
    const drop = 1.4 + sheetRng() * 0.5;
    const sheet = gridSurface(
      (u, v, out) => {
        const s = s0 + (u - 0.5) * width * (1 + 0.2 * noise.noise(v * 3 + i, u * 2 + 5));
        // v: 0 on the far shoulder, 1 at the frayed lower edge on the camera side; the edge
        // wanders in lobes and the sheet is thickest over the top, tucking into the bark at its
        // rim (8 mm — inside the sleeve's 1.5 cm margin, so it stays clear of the limb)
        const fray = 0.8 + 0.2 * noise.noise(u * 6 + i * 7, 3) - 0.2 * Math.pow(Math.abs(u - 0.5) * 2, 3);
        const psi = psiTop + v * drop * fray;
        const rim = smoothstep(0.86, 1, v) + smoothstep(0.08, 0, v) + smoothstep(0.9, 1, Math.abs(u - 0.5) * 2);
        const lift = lerp(0.05 + 0.03 * noise.noise(s * 9 + i, psi * 3), -0.008, clamp(rim, 0, 1));
        surface(s, psi, lift, out.position);
        out.uv = [(s * len) / 0.9, (psi * 0.4) / 0.9];
        const up = Math.cos(psi);
        // dull olive cushions in the giants' root-sheet tone (0.33, 0.47, 0.13 linear) scaled to
        // 0.7 — a first cut at (0.3, 0.42, 0.13) × up to 1.0 read as a lime cap against the limb's
        // shader moss; the drooping fringe gets a mild shade gain
        const lit = (0.55 + 0.3 * smoothstep(-0.3, 0.9, up) * (0.7 + 0.3 * noise.noise(s * 6, psi * 2 + 5))) * (1 + 0.6 * smoothstep(0.3, -0.5, up));
        const mossy = (0.85 + 0.3 * noise.noise(s * 8 + 2, psi * 4)) * 0.45;
        out.color = [0.23 * lit * mossy, 0.31 * lit * mossy, 0.11 * lit * mossy];
      },
      { cols: 12, rows: 9 },
    );
    faceTowards(sheet, (p, o) => o.copy(p).addScaledVector(radial(s0, psiTop + 0.5 * drop), 4));
    sheetParts.push(sheet);
  }
  const sheetMesh = new Mesh(merge(sheetParts), mats.moss);
  sheetMesh.name = 'lantern-branch-moss';
  sheetMesh.castShadow = false;
  sheetMesh.receiveShadow = true;
  group.add(sheetMesh);

  // ---- ferns and grass tufts on the moss (shaded olive, under the canopy) ----
  const vegRng = rng.fork('branch-veg');
  // (round 37: frame 1 s's tufts on the bough are dark olive silhouettes, 0.28–0.35 luminance, with
  // one lit speck line along the top edge — the first pass's (0.7, 0.75, 0.55) read as a lit lime
  // hedge riding the limb at 6 m; pulled to 0.6 ×)
  const topShade: [number, number, number] = [0.4, 0.42, 0.3];
  // (round 37: five tufts on the 2.2 m run, not nine — frame 1 s's tufts are sparse, most of them
  // over the left third of the bough)
  for (let i = 0; i < 5; i++) {
    const s = lerp(0.08, 0.85, (i + vegRng()) / 5);
    const psi = (vegRng() - 0.4) * 1.3;
    const pos = surface(s, psi, 0.03);
    const nrm = radial(s, psi).addScaledVector(UP, 0.4).normalize();
    foliage.addTuft(pos, nrm, (0.22 + vegRng() * 0.12) * (0.6 + 0.4 * fk), i % 3 === 2 ? 0 : 1, 0.06, topShade);
  }
  // ---- canopy-limb foliage (round 11): leaf clumps riding the top and shoulders of the sleeve
  // and fern sprigs standing off its flanks, so the limb reads as part of the roof (reference A
  // top-left: dark mossy bark with foliage breaking its upper silhouette) rather than a bare
  // tube. Clumps sit on the moss (psi within ±1.1 of the top), root 5 cm into the sheets, and are
  // shaded olive like the sprigs; the undersides where the pods hang stay clear. ----
  const clumpRng = rng.fork('branch-clumps');
  // (round 37: the run's clumps are the frame's dark tufts — 0.55 × the reach's tint, five of
  // them at 0.12–0.18 m over s 0.05–0.78 instead of eleven at 0.14–0.23 m along the whole run, so
  // the bough's dark band stays readable between them and its last third is bare as in the frame;
  // the reach beyond A's edge keeps the fuller canopy clumps)
  const clumpTint: [number, number, number] = [0.5, 0.58, 0.3];
  const runTint: [number, number, number] = [0.28, 0.31, 0.19];
  for (let i = 0; i < 5; i++) {
    const s = lerp(0.05, 0.78, (i + 0.2 + clumpRng() * 0.6) / 5);
    const psi = (clumpRng() - 0.5) * 2.2 + 0.2;
    const r = (0.2 + clumpRng() * 0.1) * (0.6 + 0.4 * fk);
    const centre = surface(s, psi, r * 0.45 - 0.05);
    foliage.addLeafCluster(centre, r, 12 + Math.floor(clumpRng() * 6), { size: 0.09, amount: 0.06, droop: 0.5, tint: runTint, tintSpread: 0.3, flatten: 0.55 });
  }
  for (let i = 0; i < 3; i++) {
    const s = lerp(0.15, 0.8, (i + clumpRng()) / 3);
    // fern sprigs lean out from the shoulders, alternating sides
    const psi = (i % 2 ? 1 : -1) * (0.9 + clumpRng() * 0.5);
    const pos = surface(s, psi, 0.02);
    const nrm = radial(s, psi).addScaledVector(UP, 0.9).normalize();
    foliage.addTuft(pos, nrm, (0.3 + clumpRng() * 0.14) * (0.6 + 0.4 * fk), 1, 0.07, topShade);
  }
  // frame 1 s: a line of small lit specks along the bough's top edge (y 0.32–0.33, x 0.02–0.22) —
  // leaf tips and moss catching the light from above. Small warm-pale cards standing on the moss
  // at the top (ψ within ±0.35), one every ≈ 0.16 m of the visible run.
  for (let i = 0; i < 18; i++) {
    const s = lerp(0.02, 0.98, (i + 0.3 + clumpRng() * 0.4) / 18);
    const psi = (clumpRng() - 0.5) * 0.7 + 0.1;
    // standing 5 cm off the bark so the moss sheets do not cover them
    const pos = surface(s, psi, 0.05);
    const nrm = radial(s, psi).addScaledVector(UP, 0.6).normalize();
    foliage.addFlower(pos, nrm, 0.06 + clumpRng() * 0.03, 0.03, 0.05, [0.95, 0.9, 0.5]);
  }
  // the trunk-side stretch of the limb (s < 0, the giant's own bark until round 11) gets the same
  // clumps and sprigs, thinning toward the trunk, so the whole limb reads as one canopy bough
  // (round 37: the reach is 13.5 m — one clump per ≈ 0.9 m of it, none within 0.4 m of the bole)
  if (sMin < -0.4) {
    const n = Math.round(((0 - sMin) * len) / 0.9);
    for (let i = 0; i < n; i++) {
      const s = lerp(sMin + 0.4 / len, 0.02, (i + 0.5 + (clumpRng() - 0.5) * 0.6) / n);
      const psi = (clumpRng() - 0.5) * 2.0 + 0.2;
      const r = 0.24 + clumpRng() * 0.16;
      const centre = surface(s, psi, r * 0.45 - 0.05);
      foliage.addLeafCluster(centre, r, 14 + Math.floor(clumpRng() * 8), { size: 0.11, amount: 0.06, droop: 0.5, tint: clumpTint, tintSpread: 0.3, flatten: 0.55 });
      if (i % 2 === 0) {
        const ps = (clumpRng() - 0.5) * 2.4;
        const pos = surface(s + 0.04, ps, 0.02);
        const nrm = radial(s + 0.04, ps).addScaledVector(UP, 0.9).normalize();
        foliage.addTuft(pos, nrm, 0.28 + clumpRng() * 0.14, 1, 0.07, topShade);
      }
    }
  }

  // ---- lanterns on short cords from the knees' undersides ----
  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('branch-lanterns');
  const n = Math.max(def.lanterns, LANTERN_T.length);
  for (let i = 0; i < n; i++) {
    const t = LANTERN_T[i % LANTERN_T.length];
    const hook = surface(t, Math.PI, -0.04);
    // slight offset to the side of the limb so cords don't all hang from the centreline
    hook.x += (lanternRng() - 0.5) * 0.1;
    hook.z += (lanternRng() - 0.5) * 0.1;
    const rig = buildLantern(hook, CORDS[i % CORDS.length], mats, lanternRng, BRANCH_POD_SCALE);
    // the pods cast nothing either: a 0.15 m pod 2 m over the lit slabs is a 20 px shadow spot
    // in shot A that frame 1 s has not
    rig.pivot.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = false;
    });
    group.add(rig.pivot);
    lanterns.push(rig);
  }

  // ---- vines: strands from the underside of the trunk-side reach only (round 37: frame 1 s hangs
  // nothing but the two pods under the visible run, and the run is 0.7 m above camera B's eye —
  // a strand longer than ≈ 0.35 m there would hang into B's top edge) ----
  const vineRng = rng.fork('branch-vines');
  // (all at s ≤ −0.9: the reach is off camera C's right edge from s ≈ −0.65 back)
  const vineSpots: [number, number, number][] = [
    [-0.9, 2.4, 0.8],
    [-1.15, -2.5, 0.6],
    [-1.4, 2.7, 0.7],
  ];
  for (const [s, psi, l] of vineSpots) {
    const hook = surface(s, psi, -0.03);
    hook.x += (vineRng() - 0.5) * 0.2;
    hook.z += (vineRng() - 0.5) * 0.2;
    foliage.addHangingVine(hook, l * (0.85 + vineRng() * 0.3), { amount: 0.11, thickness: 0.012 });
  }
  for (const m of foliage.build(mats, 'lantern-branch')) {
    m.castShadow = false;
    group.add(m);
  }

  const lights: PointLight[] = [];
  const c = new Vector3();
  for (const r of lanterns.slice(0, 2)) c.add(r.pod);
  c.divideScalar(Math.min(2, Math.max(1, lanterns.length)));
  // round 37: the pods are 0.15 m and 2 m up over the plaza's south-west, 0.8 m from camera B's
  // eye — a 4.25 / 6 m light there pooled warm light over B's whole foreground and the slabs
  // under the pods, which frame 1 s keeps in the plaza's cool shade; a small glow 0.3 m under
  // the pair lights the pods' husks and the bough's underside only
  c.y -= 0.3;
  // (1.2 / 2.5 m still turned the bark under the pods orange in shot A, which frame 1 s has not)
  const light = new PointLight(ctx.config.palette.lanternGlow, 0.5, 1.5, 2);
  light.position.copy(c);
  light.name = 'branch-lantern-light';
  group.add(light);
  lights.push(light);

  // ---- verification data for the audit ----
  /**
   * Signed distance of a world point outside the sleeve surface, measured in the sleeve's own
   * section: find the s whose section plane (normal = local tangent) holds the point, then compare
   * its radial distance with the sleeve radius in that direction. Positive = outside the sleeve.
   */
  const _q = new Vector3();
  const _c = new Vector3();
  const outsideSleeve = (p: Vector3, sGuess: number) => {
    let s = clamp(sGuess, sMin, sMax);
    for (let it = 0; it < 12; it++) {
      const f = frameAt(s);
      spine(s, _c);
      _q.subVectors(p, _c);
      const along = _q.dot(f.t);
      if (Math.abs(along) < 1e-5) break;
      // the polyline's speed |dspine/ds| ≈ len; step s to zero the along-tangent component
      s = clamp(s + along / len, sMin, sMax);
    }
    const f = frameAt(s);
    spine(s, _c);
    _q.subVectors(p, _c);
    const a = _q.dot(f.e2);
    const b = _q.dot(f.e1);
    const psi = Math.atan2(b, a);
    const radialDist = Math.hypot(a, b);
    return radialDist - sleeveR(s, psi);
  };
  /**
   * Sample the giant's limb surface — centre(s) + radius(s) in the plane normal to the limb's own
   * local tangent (the published polyline's segment direction) — and report how far outside the
   * sleeve it reaches. 200 samples over the full-sleeve span s ∈ [0.1, 0.93] (deterministic
   * stratified s, golden-angle ψ), 60 more in the taper zones where the sleeve dips inside the
   * limb by design.
   */
  const _lt = new Vector3();
  const _la = new Vector3();
  const _lb = new Vector3();
  const _n1 = new Vector3();
  const _n2 = new Vector3();
  const _p = new Vector3();
  const limbSurfacePoint = (s: number, phi: number, scale: number, out: Vector3) => {
    spine(Math.min(sMax, s + 1e-3), _la);
    spine(Math.max(sMin, s - 1e-3), _lb);
    _lt.subVectors(_la, _lb);
    if (_lt.lengthSq() < 1e-14) _lt.copy(dir);
    else _lt.normalize();
    _n1.set(-_lt.z, 0, _lt.x).normalize();
    _n2.crossVectors(_n1, _lt).normalize();
    spine(s, out);
    const r = limbRadius(s) * scale;
    return out.addScaledVector(_n1, Math.sin(phi) * r).addScaledVector(_n2, Math.cos(phi) * r);
  };
  const checkContainment = (): ContainmentReport => {
    const golden = Math.PI * (3 - Math.sqrt(5));
    let maxProtrusion = -Infinity;
    let maxProtrusionBumps = -Infinity;
    let clearance = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const s = lerp(0.1, 0.93, (i + 0.5) / N);
      const phi = i * golden;
      const d = outsideSleeve(limbSurfacePoint(s, phi, 1, _p), s);
      maxProtrusion = Math.max(maxProtrusion, d);
      clearance += -d;
      maxProtrusionBumps = Math.max(maxProtrusionBumps, outsideSleeve(limbSurfacePoint(s, phi, 1.1, _p), s));
    }
    // the extension over the rest of the published limb (round 11): trunk side and past the tip,
    // outside the end tapers
    let extensionMaxProtrusion = -Infinity;
    let extensionSamples = 0;
    if (sMin < 0.1 - taperS || sMax > 0.93 + taperS) {
      const M = 120;
      for (let i = 0; i < M; i++) {
        const s = i < M / 2 ? lerp(sMin + taperS, 0.1, (i + 0.5) / (M / 2)) : lerp(0.93, sMax - taperS, (i - M / 2 + 0.5) / (M / 2));
        if (s < sMin + taperS || s > sMax - taperS) continue;
        extensionSamples++;
        extensionMaxProtrusion = Math.max(extensionMaxProtrusion, outsideSleeve(limbSurfacePoint(s, i * golden, 1, _p), s));
      }
    }
    let taperMaxProtrusion = -Infinity;
    for (let i = 0; i < 60; i++) {
      const s = i < 30 ? lerp(sMin, sMin + taperS, (i + 0.5) / 30) : lerp(sMax - taperS, sMax, (i - 30 + 0.5) / 30);
      taperMaxProtrusion = Math.max(taperMaxProtrusion, outsideSleeve(limbSurfacePoint(s, i * golden, 1, _p), s));
    }
    const mm = (v: number) => Math.round(v * 1e4) / 1e4;
    return {
      samples: N,
      maxProtrusion: mm(maxProtrusion),
      maxProtrusionBumps: mm(maxProtrusionBumps),
      meanClearance: mm(clearance / N),
      taperMaxProtrusion: mm(taperMaxProtrusion),
      extensionSamples,
      extensionMaxProtrusion: extensionSamples ? mm(extensionMaxProtrusion) : null,
      span: [mm(sMin), mm(sMax)],
    };
  };
  const silhouette = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((s) => {
    const top = surface(s, 0, 0);
    const bottom = surface(s, Math.PI, 0);
    return { s, top: top.toArray() as [number, number, number], bottom: bottom.toArray() as [number, number, number], radius: Math.round(limbRadius(s) * 1e4) / 1e4 };
  });

  return {
    group,
    lanterns,
    lights,
    leaves: foliage.leafCount,
    wrapSource,
    containment: checkContainment(),
    podPositions: lanterns.map((r) => r.pod.toArray() as [number, number, number]),
    silhouette,
  };
}
