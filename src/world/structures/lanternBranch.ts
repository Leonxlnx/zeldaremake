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
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PointLight, Vector2, Vector3 } from 'three';
import type { TubePath, WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { type ShadeFloor, applyShadeFloor } from '../materials/shadeFloor';
import { TAU, faceTowards, gridSurface, merge, sweepTube } from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternRig } from './lantern';
import { type StructureMaterials, windLeafMaterial } from './materials';
import { applySleeveBarkResponse } from './sleeveBark';

/**
 * The lantern laminae's lit face (round 41, task 3): the share of the face response (sun +
 * sky) a lamina keeps, and how far that colour is pulled toward an olive of the same luminance
 * (red and blue taken down, hue ≈ 90°). Frame-03's bough leaves are a deep olive (hue 88°,
 * sat 0.48, mean 0.10 in the roof's shade) where ours read as lime rosettes from 3 m (pods-3m
 * leaf mean 0.386, hue 75°, sat 0.33). The shade fill is untouched and the sun transmission is
 * re-weighted by each lamina's orientation (see the shader block below), so the backlit laminae
 * still glow — the ones the sun is actually behind. Measured in the round-41 report.
 */
const LANTERN_LEAF_LIT_FACE = 0.5;
const LANTERN_LEAF_LIT_OLIVE = 0.45;

/**
 * Verdant-style leaf laminae (verdant-forest trees.js `addLeaf`; the trees writer carries the
 * same port for the giants, which the structures system cannot import). One heart leaf is a
 * cupped, twisted surface — raised midrib, shoulders rolled up, tip curled — of 8 triangles near
 * or 4 further off, mapped onto the heart-leaf card texture so its alpha still cuts the outline
 * (petiole notch at the base, tip at the far end). Vertex colours tint; aPhase / aAmount drive
 * the structures' shared leaf wind, the amount growing from the petiole to the tip.
 */
class LaminaWriter {
  private pos: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private phase: number[] = [];
  private amount: number[] = [];
  private idx: number[] = [];
  private n = 0;
  count = 0;
  triangles = 0;
  private readonly f = new Vector3();
  private readonly sd = new Vector3();
  private readonly nm = new Vector3();
  private readonly pp = new Vector3();
  private readonly c0 = new Color();
  private readonly c1 = new Color();
  private readonly cm = new Color();
  private static readonly TIP = new Color().setRGB(0.5, 0.52, 0.22);

  private vertex(p: Vector3, u: number, v: number, c: Color, phase: number, amount: number): number {
    this.pos.push(p.x, p.y, p.z);
    this.uv.push(u, v);
    this.col.push(c.r, c.g, c.b);
    this.phase.push(phase);
    this.amount.push(amount);
    return this.n++;
  }
  private tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
    this.triangles++;
  }
  /** one lamina from `base` along `direction` (its length `size`, nearly as wide) */
  leaf(base: Vector3, direction: Vector3, size: number, color: Color, rng: Rng, phase: number, amount: number, fine: boolean): void {
    const forward = this.f.copy(direction).normalize();
    // most laminae face the sky; the roll about the petiole keeps some oblique
    const side = this.sd.crossVectors(UP, forward);
    if (side.lengthSq() < 0.015) side.set(1, 0, 0);
    side.normalize().applyAxisAngle(forward, (rng() - 0.5) * 1.8);
    const normal = this.nm.crossVectors(forward, side).normalize();
    const twist = (rng() - 0.5) * 0.42;
    const cup = size * (0.05 + rng() * 0.08);
    const curve = size * (rng() * 0.2 - 0.05);
    const width = size * 0.95;
    const P = (s: number, t: number) =>
      this.pp
        .copy(base)
        .addScaledVector(forward, size * t)
        .addScaledVector(side, s * width * 0.5)
        .addScaledVector(normal, curve * t * t + cup * (1 - Math.abs(s)) * Math.sin(t * Math.PI) + s * twist * size * t);
    const c0 = this.c0.copy(color).multiplyScalar(0.8 + rng() * 0.4);
    const c1 = this.c1.copy(c0).lerp(LaminaWriter.TIP, 0.1 + rng() * 0.15);
    // heart texture: petiole notch at v ≈ 0.84–1, tip at v ≈ 0.02 → t 0 ↦ v 0.92, t 1 ↦ v 0.02
    const V = (s: number, t: number, c: Color, amt: number) => this.vertex(P(s, t), 0.5 + s * 0.5, 0.92 - 0.9 * t, c, phase, amount * amt);
    this.count++;
    const b = V(0, 0, c0, 0.5);
    if (!fine) {
      const l = V(-1, 0.3, c0, 0.8);
      const m = V(0, 0.3, this.cm.copy(c0).multiplyScalar(1.04), 0.8);
      const r = V(1, 0.3, c0, 0.8);
      const tip = V(0, 1, c1, 1);
      this.tri(b, l, m);
      this.tri(b, m, r);
      this.tri(l, tip, m);
      this.tri(m, tip, r);
      return;
    }
    const l1 = V(-1, 0.3, c0, 0.8);
    const m1 = V(0, 0.3, this.cm.copy(c0).multiplyScalar(1.045), 0.8);
    const r1 = V(1, 0.3, c0, 0.8);
    const l2 = V(-0.6, 0.7, c1, 0.95);
    const m2 = V(0, 0.7, this.cm.copy(c1).multiplyScalar(1.025), 0.95);
    const r2 = V(0.6, 0.7, c1, 0.95);
    const tip = V(0, 1, c1, 1);
    this.tri(b, l1, m1);
    this.tri(b, m1, r1);
    this.tri(l1, l2, m1);
    this.tri(l2, m2, m1);
    this.tri(m1, m2, r1);
    this.tri(m2, r2, r1);
    this.tri(l2, tip, m2);
    this.tri(m2, tip, r2);
  }
  build(): BufferGeometry | null {
    if (!this.n) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPhase', new Float32BufferAttribute(this.phase, 1));
    g.setAttribute('aAmount', new Float32BufferAttribute(this.amount, 1));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

export interface LanternBranchBuild {
  group: Group;
  lanterns: LanternRig[];
  lights: PointLight[];
  leaves: number;
  /** round 40 dressing: twig forks (tubes) and their laminae, hanging vines, moss sheets */
  dressing: { twigs: number; twigTriangles: number; laminae: number; laminaTriangles: number; vines: number; sheets: number; runBeards: number; cushions: number; cords: number; sides: number; cordRelief: [number, number] };
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
/**
 * bark relief the sleeve stands off the limb's nominal surface (m); its ridges rise outward from
 * there. Round 47: 2.4 cm (1.5 through round 46) so the cords' furrows (SLEEVE_CORD_FURROW) can
 * cut 2.4 cm into the envelope and still end flush with the (ghosted) limb's nominal surface.
 */
const RELIEF = 0.024;
/** round 46: longitudinal cords around the sleeve (12 on the 0.15 m run ≈ 8 cm apart) … */
const SLEEVE_CORDS = 12;
/**
 * Round 47 (survey-2 / round-46 review, w04-spine-f: the underside at 2 m "still a smooth pale
 * tube", crop diff 8/255 — round 46's ± 8 % cords were 1.2 cm on a 56-gon under a floor that
 * erased their shading): the cord profile is asymmetric — broad crests standing
 * SLEEVE_CORD_CREST × the envelope radius proud, narrow furrows cut SLEEVE_CORD_FURROW × it
 * deep (≈ +1 / −2.4 cm on the run: 3.3 cm peak to peak, ≥ 3 cm at r 0.35 scaled) — and the
 * profile's mean cord height (≈ 0.77) is chosen so the mean displacement is ≈ +0.2 cm: the
 * silhouette camera A frames at 5.8 m moves under a pixel.
 */
const SLEEVE_CORD_CREST = 0.055;
const SLEEVE_CORD_FURROW = 0.14;
/** vertices around the sleeve: six across each cord (56 through round 46: 4–5, the furrow walls aliased) */
const SLEEVE_SIDES = 72;
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

/**
 * Touching-distance bark on the sleeve (round 44, survey #5: "the lantern bough at 2 m is a
 * smooth pale tube"): between SLEEVE_NEAR_M (full → none) the bark set's normal and colour are
 * sampled again at SLEEVE_NEAR_TILES × the frequency — a 1.4 m tile is a blur at 2 m — the fine
 * normal's slopes added to the tile's, the fine colour as a factor about its own mean so the
 * bough's level holds. Camera A stands ≥ 5.8 m from the sleeve, so at 5 m and past the factor is
 * exactly zero and the fixed frames are what they were (the trees' BARK_NEAR_DETAIL, on the
 * structures' bark program). Chained onto the sleeve's floor and hemisphere hooks.
 */
// (round 47: 1.0–4.5 m, was 1.2–5.0 — camera F frames the run's tip half at 3.5–3.9 m, where
// the stronger relief shading below would otherwise reach it at 0.2–0.35 of itself; here it is
// ≤ 0.2 and the survey poses at 1.6–2.1 m still get 0.8–0.9 of it)
const SLEEVE_NEAR_M: [number, number] = [1.0, 4.5];
const SLEEVE_NEAR_TILES = 3.7;
/**
 * Round 47: the relief's shading after the floor. The sleeve's floor (SLEEVE_FLOOR) is the only
 * light on the underside and it is flat by construction — a face below it is lifted TO it
 * whatever its normal — so the cords' geometry (and the fine normal map) reached the pixel only
 * through the 0.2 hemisphere share and round 46's ± 15 % occlusion. Within SLEEVE_NEAR_M the
 * floored light is scaled by a facing term: crests turned to the viewer keep it, the furrow
 * walls turning away lose up to SLEEVE_RELIEF_FLOOR of it (the cavity cue a flat-lit fissured
 * surface shows from any side), normalised so the visible mean is ≈ 1; the furrows' occlusion
 * (aSleeveAO, now 0.45 at a furrow bottom) multiplies on top. Zero at 4.5 m+ (mix(…, 0.0)).
 */
const SLEEVE_RELIEF_FLOOR = 0.35;
const SLEEVE_RELIEF_NORM = 1.3;
/** mean luminance of bark_brown_02/color.jpg (ffmpeg signalstats YAVG / 255) */
const SLEEVE_BARK_MEAN = 85.98 / 255;
function applySleeveNearBark(material: MeshStandardMaterial): void {
  const previousCompile = material.onBeforeCompile;
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
    shader.uniforms.uSleeveNear = { value: new Vector2(SLEEVE_NEAR_M[0], SLEEVE_NEAR_M[1]) };
    // round 46: the cords' occlusion rides a vertex attribute (aSleeveAO, 1 on the twigs)
    shader.vertexShader = 'attribute float aSleeveAO;\nvarying float vSleeveAO;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSleeveAO = aSleeveAO;\n');
    shader.fragmentShader = 'uniform vec2 uSleeveNear;\nvarying float vSleeveAO;\nfloat sleeveNear = 0.0;\nfloat sleeveFine = 1.0;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `#include <map_fragment>
      sleeveNear = 1.0 - smoothstep(uSleeveNear.x, uSleeveNear.y, length(vViewPosition));
      #ifdef USE_MAP
      if (sleeveNear > 0.0) {
        vec3 fine = texture2D(map, vMapUv * ${SLEEVE_NEAR_TILES.toFixed(2)} + vec2(0.37, 0.61)).rgb;
        float fineLum = dot(fine, vec3(0.2126, 0.7152, 0.0722));
        sleeveFine = clamp(fineLum / ${SLEEVE_BARK_MEAN.toFixed(3)}, 0.5, 1.8);
        diffuseColor.rgb *= mix(1.0, sleeveFine, 0.85 * sleeveNear);
      }
      #endif
      `,
    );
    // Round 46 (survey-2 check 11: the bough at 2 m was still a smooth tube after round 44's fine
    // bark): SLEEVE_FLOOR keeps 0.3 of the albedo and the floor is the only light on the
    // underside, so a pre-floor factor reaches the pixel at a third of itself and the fine
    // normal's Lambert not at all. After the floor (three's `aomap_fragment` follows
    // `lights_fragment_end`, where the floor lands) the cords' occlusion and half the fine
    // factor scale the shaded light itself — within SLEEVE_NEAR_M, so camera A at 5.8 m+ renders
    // exactly what it did. Mean-preserving over the cords (× 1.15 on an AO of mean ≈ 0.85).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <aomap_fragment>',
      /* glsl */ `
      if (sleeveNear > 0.0) {
        // round 47: the furrows' occlusion (0.45–1 → ≈ 0.5–1.12, mean-preserving over the cords)
        float sleeveMul = mix(1.0, clamp(vSleeveAO * 1.12, 0.4, 1.15) * mix(1.0, sleeveFine, 0.5), sleeveNear);
        // … and the relief's facing term on the floored (indirect) light only: the sun's own
        // Lambert on the lit top already carries the normal
        float sleeveFace = max(dot(normal, normalize(vViewPosition)), 0.0);
        float sleeveRelief = (${SLEEVE_RELIEF_FLOOR.toFixed(2)} + ${(1 - SLEEVE_RELIEF_FLOOR).toFixed(2)} * pow(sleeveFace, 1.4)) * ${SLEEVE_RELIEF_NORM.toFixed(2)};
        reflectedLight.indirectDiffuse *= sleeveMul * mix(1.0, sleeveRelief, sleeveNear);
        reflectedLight.directDiffuse *= mix(1.0, sleeveMul, 0.5);
      }
      #include <aomap_fragment>
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `#include <normal_fragment_maps>
      #ifdef USE_NORMALMAP_TANGENTSPACE
      if (sleeveNear > 0.0) {
        vec3 fineN = texture2D(normalMap, vNormalMapUv * ${SLEEVE_NEAR_TILES.toFixed(2)} + vec2(0.37, 0.61)).xyz * 2.0 - 1.0;
        fineN.xy *= normalScale * 1.5;
        normal = normalize(tbn * normalize(vec3(mapN.xy + fineN.xy * sleeveNear, mapN.z)));
      }
      #endif
      `,
    );
  };
  const previousKey = material.customProgramCacheKey;
  material.customProgramCacheKey = function () {
    return `${previousKey.call(this)}|sleeve-near-bark-v4`;
  };
}

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
  /**
   * Longitudinal bark cords (round 46, survey-2 check 11: the bough at 2 m "the same smooth
   * stucco tube" — the round-44 `ridged` field runs mostly ALONG the limb, 1.3 cycles around, so
   * the 24-sided sleeve had nothing a walker under it could read as bark). SLEEVE_CORDS cords
   * run the sleeve's length, wandering and pinching with a slow field, breaking into plates with
   * a second one: 0 at a furrow bottom, 1 on a crest. Their relief is about the envelope
   * (± SLEEVE_CORD_RELIEF × the radius, mean-preserving, so the silhouette camera A frames at
   * 5.8 m holds) and their occlusion goes to the shader as `aSleeveAO` (applied after the shade
   * floor within SLEEVE_NEAR_M — the floor's flat share swallowed every pre-floor term).
   */
  const cordAt = (s: number, psi: number) => {
    const wander = 1.6 * noise.noise(s * 3.1 + 11.3, psi * 0.6) + 0.7 * noise.noise(s * 7.7 + 4.1, psi * 1.3 + 9.2);
    // round 47: an asymmetric profile — the crest is a plateau over ≈ 53 % of the pitch, the
    // furrow a narrow trough with steep walls (0 at its bottom); the mean height is ≈ 0.77
    const c = 0.5 + 0.5 * Math.cos(SLEEVE_CORDS * psi + wander);
    let cord = smoothstep(0, 0.45, c);
    // breaks: stretches where the cord sinks toward a plate
    const plate = smoothstep(0.2, 0.7, 0.5 + 0.5 * noise.noise(s * 9.5 + 27.9, psi * 1.1 + 3.3));
    cord *= 0.75 + 0.25 * plate;
    // cross fissures: short cracks across the cords every 10–20 cm along the limb
    const fissure = smoothstep(0.6, 0.78, 0.5 + 0.5 * noise.noise(s * 16 + 5.7, psi * 0.45 + 41.2));
    cord *= 1 - 0.55 * fissure;
    return cord;
  };
  /** the cords' radial displacement as a share of the envelope radius (see SLEEVE_CORD_CREST / FURROW) */
  const cordShare = (s: number, psi: number) => {
    const h = cordAt(s, psi);
    return ((SLEEVE_CORD_CREST + SLEEVE_CORD_FURROW) * h - SLEEVE_CORD_FURROW) * emerge(s);
  };
  /** sleeve surface radius: bark ridges (fluting along the limb) and metre-scale gnarl, both
   *  raised OUTWARD from the envelope (0–16 %) so the texture never dips inside it, the cords
   *  about it, plus the knees' bellies hanging from the lower half */
  const sleeveR = (s: number, psi: number) => {
    const ridge = noise.ridged(psi * 1.3 + s * 2, s * 11 + 2, 2);
    const gnarl = noise.noise(s * 4 + 7, psi * 0.7) + 1;
    const belly = Math.pow(smoothstep(0.15, 1, 0.5 - 0.5 * Math.cos(psi)), 1.4);
    return envelope(s) * (1 + 0.09 * ridge + 0.035 * gnarl + cordShare(s, psi)) + knee(s) * belly * emerge(s);
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
    // round 46: the furrows between the cords carry grime (a darker, cooler bark), the crests a
    // little lighter than the bark's tone — the pre-floor share of the cord contrast (the rest
    // is aSleeveAO), about the field's mean furrow share (≈ 0.5) so the bough's mean tone from
    // camera A's 5.8 m is what it was
    const cordH = cordAt(s, psi);
    const furrow = (1 - cordH) * emerge(s);
    // round 47: the furrow bottoms carry real grime (× 0.65), the crest plateaus stand 1.1 —
    // about the profile's mean furrow share (≈ 0.23), so the mean tone holds; the grime leans
    // green (damp bark), the crests a little warmer
    const crevice = 1 + 0.1 * emerge(s) - 0.45 * furrow;
    // round 37: darker bark and a duller moss cap (the frame's bough is a dark band, 0.27–0.33,
    // with a lighter moss line only along its top edge)
    return [lerp(d * 0.24 * crevice, 0.22, moss), lerp(d * 0.23 * (crevice + 0.1 * furrow), 0.34, moss), lerp(d * 0.2 * (crevice + 0.04 * furrow), 0.15, moss)];
  };
  const sleeveRows = Math.round(60 * (sMax - sMin));
  const sleeve = gridSurface(
    (u, v, out) => {
      const psi = u * TAU;
      const s = lerp(sMin, sMax, v);
      surface(s, psi, 0, out.position);
      out.uv = [(psi * sleeveBase(s)) / 1.4, (s * len) / 1.4];
      out.color = barkColor(s, psi);
    },
    // ~60 rings per unit of s (a ring every 0.1 m of limb); round 46: SLEEVE_SIDES around so the
    // cords resolve (24 through round 45: two vertices per cord)
    { cols: SLEEVE_SIDES, rows: sleeveRows, closedU: true },
  );
  // the cords' occlusion per vertex (gridSurface's vertex order: rows of SLEEVE_SIDES + 1, the
  // seam vertex repeated), 0.45 at a furrow bottom (round 47; 0.7 through round 46), 1 on a
  // crest — mean ≈ 0.87 over the profile
  {
    const count = sleeve.getAttribute('position').count;
    const ao = new Float32Array(count);
    for (let j = 0; j < sleeveRows; j++) {
      const s = lerp(sMin, sMax, j / (sleeveRows - 1));
      for (let i = 0; i <= SLEEVE_SIDES; i++) {
        const psi = ((i % SLEEVE_SIDES) / SLEEVE_SIDES) * TAU;
        ao[j * (SLEEVE_SIDES + 1) + i] = 1 - 0.55 * (1 - cordAt(s, psi)) * emerge(s);
      }
    }
    sleeve.setAttribute('aSleeveAO', new Float32BufferAttribute(ao, 1));
  }
  faceTowards(sleeve, (p, o) => {
    const s = clamp(p.clone().sub(from).dot(dir) / len, sMin, sMax);
    return o.copy(p).addScaledVector(p.clone().sub(spine(s)), 4);
  });

  // ---- twig forks with layered laminae (round 40) ----
  // Owner markup 2 ("beam-like", isolated flat leaves) and frame 03's bough: connected twig
  // forks leave the sleeve along its whole length, each forking once or twice, thinning by 0.62
  // to its tip, curling up toward the light and drooping again under the leaves; every twiglet
  // carries a spray of OVERLAPPING cupped laminae along its outer part (one every 3.4 cm, a
  // 9–12 cm leaf each, golden-angle phyllotaxis — verdant-forest trees.js leafSpray) and a
  // rosette at its tip, so the leaves are layered clusters hanging off wood, never stems stuck
  // on the beam. The run's twigs are authored (s, ψ); the reach takes one per ≈ 0.75 m.
  const twigRng = rng.fork('branch-twigs');
  const foliage = new FoliageBuilder(rng.fork('branch-foliage'), `${ctx.config.seed}/lantern-branch`);
  const laminae = new LaminaWriter();
  const barkParts = [sleeve];
  let twigCount = 0;
  const fk = Math.min(1, r0 / 0.42);
  const jit = (a: number) => new Vector3((twigRng() - 0.5) * a, (twigRng() - 0.5) * a * 0.5, (twigRng() - 0.5) * a);
  const twigBark = (s: number, psi: number): [number, number, number] => {
    const c = barkColor(s, psi);
    return [c[0] * 0.9, c[1] * 0.85, c[2] * 0.8];
  };
  /** an orthonormal pair perpendicular to a unit axis */
  const perp = (axis: Vector3): [Vector3, Vector3] => {
    const u = new Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? UP : new Vector3(1, 0, 0)).normalize();
    return [u, new Vector3().crossVectors(axis, u).normalize()];
  };
  // (round 37: the bough is 6 m from camera A in the shade under the roof — its leaves read as
  // dark olive in frame 1 s; the laminae's base tint keeps that but the lit/backlit ones lift
  // through the material's transmission. Round 40: 0.36/0.42/0.21 still rendered the sun-side
  // clusters as lime rosettes from 3 m against frame-03's heavy dark bough — a darker olive base)
  // Round 41: the base tint pulled down again and the lit face of the material cut (see
  // LANTERN_LEAF_LIT_FACE): frame-03's bough leaves measure hue 82–88° at a luminance far under
  // ours (pods-3m leaf mean 0.385 → the round-41 target ≈ 0.2, a deep olive that still lets the
  // backlit laminae glow).
  const leafBase = new Color().setRGB(0.23, 0.28, 0.13);
  const tintFor = (): Color => {
    const k = 0.72 + twigRng() * 0.56;
    const warm = (twigRng() - 0.5) * 0.08;
    return new Color().setRGB(Math.max(0, leafBase.r * k + warm), leafBase.g * k, Math.max(0, leafBase.b * k - warm * 0.5));
  };
  const _tan = new Vector3();
  const _leafBase = new Vector3();
  const _out = new Vector3();
  const _ld = new Vector3();
  /** laminae along a twig: golden-angle phyllotaxis, each leaf's base on the twig's surface */
  const leafSpray = (curve: CatmullRomCurve3, radiusAt: (t: number) => number, count: number, t0: number, phase: number, size: number, fine: boolean, tint: Color) => {
    for (let j = 0; j < count; j++) {
      const t = t0 + (1 - t0) * ((j + 0.15 + 0.7 * twigRng()) / count);
      curve.getPointAt(t, _leafBase);
      curve.getTangentAt(t, _tan);
      const [u, v] = perp(_tan);
      const ang = phase + j * 2.399963229728653 + (twigRng() - 0.5) * 0.6;
      _out.copy(u).multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang));
      _leafBase.addScaledVector(_out, radiusAt(t) * 0.8);
      _ld.copy(_tan).multiplyScalar(0.28 + 0.4 * twigRng()).add(_out).addScaledVector(UP, -0.18 + 0.6 * twigRng()).normalize();
      laminae.leaf(_leafBase, _ld, size * (0.85 + 0.3 * twigRng()), tint, twigRng, phase, 0.05 + 0.04 * t, fine);
    }
  };
  /** a whorl of laminae around a twig's tip, splayed forward */
  const rosette = (tip: Vector3, heading: Vector3, phase: number, size: number, fine: boolean, tint: Color, n: number) => {
    const [u, v] = perp(heading);
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * TAU + twigRng() * 0.5;
      _out.copy(u).multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang));
      _ld.copy(heading).multiplyScalar(0.55 + 0.3 * twigRng()).addScaledVector(_out, 0.75).addScaledVector(UP, 0.1).normalize();
      _leafBase.copy(tip).addScaledVector(heading, -0.015 * (k % 2));
      laminae.leaf(_leafBase, _ld, size * (0.95 + 0.25 * twigRng()), tint, twigRng, phase, 0.09, fine);
    }
  };
  /**
   * A twig from `origin` along `heading`: a 3-step path curling up (`curl`) and drooping at the
   * end, a tapered tube in the sleeve's bark, 1–2 children at 45–80 % of its length (depth > 0),
   * a leaf spray over its outer part and a tip rosette. `fine`: 8-triangle laminae (the run and
   * the near reach) or 4-triangle ones.
   */
  const growTwig = (origin: Vector3, heading: Vector3, length: number, radius: number, depth: number, phase: number, size: number, fine: boolean, tint: Color, s: number, psi: number, curl: number) => {
    const h = heading.clone().normalize();
    const pts = [origin.clone().addScaledVector(h, -Math.max(0.04, radius * 2)), origin.clone()];
    let p = origin.clone();
    const N = 3;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      h.addScaledVector(UP, curl * (1.1 - t) - 0.5 * curl * t * t).add(jit(0.35)).normalize();
      p = p.clone().addScaledVector(h, length / N);
      pts.push(p);
    }
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const rad = (t: number) => radius * (1 - 0.62 * t) * (1 + 0.1 * Math.sin(t * 17 + phase));
    barkParts.push(
      sweepTube(curve, {
        radius: rad,
        tubularSegments: depth > 0 ? 10 : 7,
        radialSegments: depth > 0 ? 6 : 5,
        uvMetres: 0.6,
        displace: depth > 0 ? (t, ang) => (noise.ridged(ang * 1.5 + 3, t * 6 + phase, 2) - 0.5) * radius * 0.25 : undefined,
        color: (_t, ang) => twigBark(s, psi + ang * 0.3),
        capEnd: true,
      }),
    );
    twigCount++;
    if (depth > 0) {
      const forks = depth >= 2 || twigRng() < 0.6 ? 2 : 1;
      for (let k = 0; k < forks; k++) {
        const tk = 0.45 + 0.35 * (k / forks) + twigRng() * 0.12;
        const cb = curve.getPointAt(tk);
        const ct = curve.getTangentAt(tk);
        const [u, v] = perp(ct);
        const ang = phase * 3 + k * 2.4 + twigRng() * 1.2;
        const out = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang));
        if (out.y < -0.2) out.y = -0.2;
        const ch = ct.clone().multiplyScalar(0.7).addScaledVector(out, 0.8).normalize();
        growTwig(cb.addScaledVector(out, rad(tk) * 0.5), ch, length * (0.5 + twigRng() * 0.2), rad(tk) * 0.7, depth - 1, phase + 0.7, size, fine, tint, s, psi, curl * 0.8);
      }
    }
    const share = depth > 0 ? 0.55 : 0.7;
    leafSpray(curve, rad, Math.max(3, Math.round((length * share) / 0.034)), 1 - share, phase, size, fine, tint);
    rosette(pts[pts.length - 1], h, phase, size, fine, tint, 6 + Math.floor(twigRng() * 3));
  };
  /** a primary twig off the sleeve at (s, ψ): heading = radial × out + up + along the limb */
  const primaryTwig = (s: number, psi: number, out: number, up: number, along: number, length: number, radius: number, depth: number, fine: boolean, curl = 0.35) => {
    const base = surface(s, psi, -0.03);
    const heading = radial(s, psi).multiplyScalar(out).addScaledVector(UP, up).addScaledVector(dir, along).normalize();
    const size = fine ? 0.1 : 0.13;
    growTwig(base, heading, length, radius, depth, twigRng() * TAU, size, fine, tintFor(), s, psi, curl);
  };
  // the run (s 0–1, frame A's left quarter): eight twigs, most from the upper half heading up
  // and out so the bough's top breaks into layered leaves, one from the camera-side flank at
  // s 0.72 drooping toward the cameras (it stays ≥ 0.3 m above camera B's top edge; the pods hang
  // from the underside at s 0.7 / 0.89, which stays clear), the last near the tip along the limb
  // (round 37's fork at s 0.3 is now the biggest of these, leaning back along the limb)
  const RUN_TWIGS: [number, number, number, number, number, number, number, number][] = [
    // s, psi, out, up, along, length, radius, depth
    [0.08, -1.0, 0.7, 0.6, 0.2, 0.7, 0.03, 2],
    [0.22, 0.85, 0.8, 0.5, -0.1, 0.55, 0.025, 1],
    [0.3, -0.5, 0.5, 0.55, 0.6, 0.8, 0.035, 2],
    [0.42, 0.9, 0.7, 0.7, 0.2, 0.5, 0.024, 1],
    [0.55, -0.6, 0.6, 0.6, -0.3, 0.75, 0.03, 2],
    [0.72, 1.7, 0.9, -0.1, 0.2, 0.5, 0.022, 1],
    [0.84, 0.5, 0.6, 0.75, 0.3, 0.5, 0.022, 1],
    [0.96, -0.3, 0.4, 0.5, 0.8, 0.45, 0.02, 1],
  ];
  for (const [s, psi, out, up, along, length, radius, depth] of RUN_TWIGS) primaryTwig(s, psi, out, up, along, length * (0.6 + 0.4 * fk), radius * (0.6 + 0.4 * fk), depth, true);
  // the tail past `to` ends in leaves, not a blunt cap
  if (sMax > 1.1) primaryTwig(sMax - 0.04, 0.2, 0.3, 0.4, 1, 0.3, 0.016, 0, true, 0.2);
  // the trunk-side reach (s < 0): one twig per ≈ 0.75 m, none within 0.6 m of the bole, alternating
  // top and flank so the limb reads leafy from the plaza and from underneath; forks and 8-triangle
  // laminae on the near half, single twigs with 4-triangle laminae further off
  const reachTufts: [number, number][] = [];
  if (sMin < -0.4) {
    const n = Math.round(((0 - sMin) * len) / 0.75);
    for (let i = 0; i < n; i++) {
      const s = lerp(sMin + 0.6 / len, -0.05, (i + 0.5 + (twigRng() - 0.5) * 0.5) / n);
      const flank = i % 3 === 2;
      const sign = i % 2 ? 1 : -1;
      const psi = flank ? sign * (1.6 + twigRng() * 0.4) : sign * (0.3 + twigRng() * 0.9);
      const near = s > -1.6;
      primaryTwig(s, psi, flank ? 0.9 : 0.6, flank ? -0.15 : 0.6, (twigRng() - 0.5) * 0.6, (0.6 + twigRng() * 0.3) * (near ? 1 : 0.9), 0.024 + twigRng() * 0.01, near ? 2 : 1, s > -2.2, flank ? 0.15 : 0.35);
      if (i % 2 === 0) reachTufts.push([s + 0.04, (twigRng() - 0.5) * 2.4]);
    }
  }
  const twigTriangles = barkParts.slice(1).reduce((a, g) => a + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
  // the twigs carry no cord occlusion (`merge` keeps only the attributes every part has)
  for (const g of barkParts) if (!g.getAttribute('aSleeveAO')) g.setAttribute('aSleeveAO', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(1), 1));

  // the sleeve's own copy of the bark material under SLEEVE_FLOOR (a clone carries the maps but
  // no compile hooks, so it gets its floor and the sleeve's hemisphere response afresh)
  const sleeveMat = mats.sleeveBark.clone();
  sleeveMat.name = 'structures:sleeve-bark-r44';
  applyShadeFloor(sleeveMat, SLEEVE_FLOOR, ctx.config.palette.leafSun);
  applySleeveBarkResponse(sleeveMat);
  applySleeveNearBark(sleeveMat);
  const barkMesh = new Mesh(merge(barkParts), sleeveMat);
  barkMesh.name = 'lantern-branch-bark';
  // round 37: the whole bough casts nothing (see trees/index.ts LANTERN_LIMB — at 2.2 m over the
  // plaza's south-west its band would cross the lit slabs in front of Link, which frame 1 s lights)
  barkMesh.castShadow = false;
  barkMesh.receiveShadow = true;
  group.add(barkMesh);

  // ---- moss sheets: ragged cushions over the top, fraying down the camera-side flank ----
  const sheetRng = rng.fork('branch-moss');
  const sheetParts: BufferGeometry[] = [];
  // (round 37: five sheets, not seven, hanging 1.4–1.9 rad down the flank instead of 2.1–2.9, at
  // 0.45 × the tone — at 6 m the seven lime cushions were the brightest thing on the bough (the
  // top-edge box A (0.04–0.20, 0.31–0.34) read sat 0.34 against the frame's 0.16), where frame
  // 1 s has one thin lighter moss line along the top and dark tufts)
  const addSheet = (s0: number, width: number, i: number) => {
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
  };
  const SHEETS = 5;
  for (let i = 0; i < SHEETS; i++) {
    const place = (i + 0.5 + (sheetRng() - 0.5) * 0.5) / SHEETS;
    // the sheets (with their ±20 % s-wander) stay on the full sleeve, s 0.1–0.93: where it tapers
    // into the limb a sheet would sit inside the giant's bark (round 9c measurement, −0.10 m at
    // s 0.01); widths scaled by the same 0.85 so seven sheets cover that span as loosely as before
    // (round 37: sheet widths follow the limb's radius — 0.3–0.5 m on the 0.15 m limb, so seven
    // still spread along the 2.3 m run instead of stacking on its middle)
    const width = ((0.85 + sheetRng() * 0.6) * (0.4 + 0.6 * fk)) / len;
    addSheet(lerp(0.1 + width * 0.6, 0.93 - width * 0.6, place), width, i);
  }
  // round 40: the near reach (s −3 … −0.2, 2.2–3.4 m up over the plaza's west edge) carries its
  // own cushions — from the plaza and from under the limb it was bare bark beyond `from`
  if (sMin < -3) {
    const REACH_SHEETS = 6;
    for (let i = 0; i < REACH_SHEETS; i++) {
      const width = ((0.9 + sheetRng() * 0.7) * (0.4 + 0.6 * fk)) / len;
      addSheet(lerp(-3.0, -0.2, (i + 0.5 + (sheetRng() - 0.5) * 0.5) / REACH_SHEETS), width, SHEETS + i);
    }
  }
  // round 44 (survey #5, the owner's frame-03 "hanging moss"): beards of moss from the underside
  // of the trunk-side reach — ribbons 4–7 cm wide at the root, a centimetre at the tip, 0.15–0.4 m
  // long, swaying a little. The reach (s ≤ −0.7: off camera C's right edge, behind B and F, off
  // A's left edge, like the vines there) as before; round 46 (survey-2 check 11, w04-spine-f:
  // "hanging moss" under the bough at 2 m) adds short ones under the run (RUN_BEARDS), clear of
  // the pods' hang points — a 0.10–0.18 m strand 0.5 m ahead of camera B is 28°+ above its axis
  // (B's half-height is 23°), and from A it is a 1–2 px thread under a bough the frame has dark.
  /**
   * one beard at (s, ψ): draws the azimuth, the bend, the root width (× `widthScale`) and the
   * wobble, in round 44's order. Round 47 (`crossed`, the run's beards): two ribbons at right
   * angles, one facing the cameras' side of the limb (`side`), each wound to face outward — the
   * moss material is single-sided, and a lone ribbon at a random azimuth was invisible from half
   * the plaza — with a ragged, frayed edge (three columns, the strands' half-width wandering).
   */
  const addBeard = (beardRng: () => number, s: number, psi: number, length: number, widthScale = 1, crossed = false) => {
    const root = surface(s, psi, -0.01);
    const az = beardRng() * TAU;
    const sway = new Vector3(Math.cos(az), 0, Math.sin(az));
    const across = crossed ? dir.clone() : new Vector3(-sway.z, 0, sway.x);
    const bend = (0.1 + beardRng() * 0.15) * length;
    const w0 = (0.04 + beardRng() * 0.03) * widthScale;
    const wobble = beardRng() * TAU;
    const ribbon = (acrossDir: Vector3, facing: Vector3, phase: number) => {
      const beard = gridSurface(
        (u, v, out) => {
          const fray = crossed ? 1 + 0.3 * Math.sin(v * 21 + phase + u * 4) : 1;
          const half = 0.5 * (w0 * (1 - v) + 0.01 * v) * (1 + 0.25 * Math.sin(v * 13 + wobble)) * fray;
          out.position.copy(root).addScaledVector(UP, -length * v).addScaledVector(sway, bend * v * v + 0.015 * Math.sin(v * 9 + wobble) * v).addScaledVector(acrossDir, (u - 0.5) * 2 * half);
          out.uv = [u * 0.2, (v * length) / 0.3];
          const lit = 0.4 + 0.45 * v + 0.15 * Math.sin(v * 7 + wobble);
          out.color = [0.23 * lit * 0.5, 0.31 * lit * 0.5, 0.11 * lit * 0.5];
        },
        { cols: crossed ? 3 : 2, rows: crossed ? 7 : 5 },
      );
      if (crossed) faceTowards(beard, (p, o) => o.copy(p).addScaledVector(facing, 4));
      sheetParts.push(beard);
    };
    ribbon(across, crossed ? side : sway, 0);
    if (crossed) ribbon(side, dir, 2.1);
  };
  if (sMin < -1.2) {
    const beardRng = rng.fork('branch-beards');
    const beards = Math.min(14, Math.round(((-0.7 - Math.max(sMin + 0.3, -3.2)) * len) / 0.55));
    for (let i = 0; i < beards; i++) {
      const s = lerp(Math.max(sMin + 0.3, -3.2), -0.7, (i + 0.5 + (beardRng() - 0.5) * 0.6) / beards);
      const psi = Math.PI + (beardRng() - 0.5) * 1.6;
      addBeard(beardRng, s, psi, 0.15 + beardRng() * 0.25);
    }
  }
  let runBeards = 0;
  {
    // under the run: its own stream (the reach beards and everything after them draw what they did)
    // Round 47 (w04-spine-f / sn-lantern-limb: the underside is what a walker on the plaza sees,
    // and round 46's six 10–18 cm threads at 0.7 width did not register): eleven crossed,
    // frayed beards at full width, as long as camera B allows — B stands at (0, 1.5, 2.0), 0.5 m
    // south of the run and 0.7 m under it, so a strand's tip must stay above B's top edge
    // (23° half-height): under x ≤ −0.6 the run is off B's left edge (≥ 40° off axis) and a
    // beard may hang 0.3 m; at x ≈ 0 the limit is 0.35 m (0.24 kept), at x 0.5 0.28 (0.16), at
    // the tip 0.2 (0.1). From A they are 1–2 px threads under a bough the frame has dark.
    const runRng = rng.fork('run-beards');
    const RUN_BEARDS = 11;
    for (let i = 0; i < RUN_BEARDS; i++) {
      const s = lerp(0.06, 0.96, (i + 0.5 + (runRng() - 0.5) * 0.5) / RUN_BEARDS);
      const psi = Math.PI + (runRng() - 0.5) * 1.4;
      const x = from.x + span.x * s;
      const maxLength = x < -0.6 ? 0.3 : x < 0 ? 0.24 : x < 0.5 ? 0.16 : 0.1;
      const length = Math.min(maxLength, (0.12 + runRng() * 0.2) * (0.6 + 0.4 * fk) * 1.5);
      // never within 0.08 s (18 cm) of a pod's hang point
      if (LANTERN_T.some((t) => t > 0 && Math.abs(s - t) < 0.08)) continue;
      addBeard(runRng, s, psi, length, 1, true);
      runBeards++;
    }
  }
  // ---- round 47: moss cushions on the top third (survey-2 check 11 / round-46 review) ----
  // Lobed domes seated on the sleeve's upper faces (|ψ| ≤ 0.8), 4–8 cm across on the run, a
  // little larger on the reach, 16 around × 3 rings + apex; the rim tucked 8 mm into the bark.
  // Their outline breathes with a 3- and 5-lobe wobble plus the noise so none is a disc, the
  // crown lit and the rim dark in the sheets' own olive. Own stream.
  let cushions = 0;
  {
    const cushionRng = rng.fork('branch-cushions');
    const CUSHION_SIDES = 16;
    const addCushion = (s: number, psi: number, radius: number) => {
      const height = radius * (0.5 + cushionRng() * 0.25);
      const lobe3 = cushionRng() * TAU;
      const lobe5 = cushionRng() * TAU;
      const squash = 0.75 + cushionRng() * 0.5;
      const centre = surface(s, psi, -0.008);
      const n = radial(s, psi);
      // an orthonormal pair on the sleeve: along the limb and around it
      const u = frameAt(s).t.clone();
      const v = new Vector3().crossVectors(n, u).normalize();
      const dome = gridSurface(
        (uu, vv, out) => {
          // a squat dome: the radius share falls as cos, the lift rises as a rounded sin, so the
          // finite-difference normals are continuous; the last ring is a 2 % cap, not a point
          const a = uu * TAU;
          const wobble = 1 + 0.16 * Math.cos(3 * a + lobe3) + 0.1 * Math.cos(5 * a + lobe5) + 0.1 * noise.noise(Math.cos(a) * 2.1 + s * 9, Math.sin(a) * 2.1 + psi * 3);
          const t = Math.max(0.02, Math.cos(vv * Math.PI * 0.5));
          const lift = Math.pow(Math.sin(vv * Math.PI * 0.5), 1.25);
          const rr = radius * t * wobble;
          out.position.copy(centre).addScaledVector(u, Math.cos(a) * rr * squash).addScaledVector(v, Math.sin(a) * rr).addScaledVector(n, height * lift);
          out.uv = [(Math.cos(a) * rr) / 0.3, (Math.sin(a) * rr) / 0.3];
          const tone = (0.55 + 0.5 * lift) * (0.85 + 0.3 * noise.noise(out.position.x * 14, out.position.z * 14 + out.position.y * 7));
          out.color = [0.23 * tone * 0.5, 0.31 * tone * 0.5, 0.11 * tone * 0.5];
        },
        { cols: CUSHION_SIDES, rows: 4, closedU: true },
      );
      faceTowards(dome, (p, o) => o.copy(p).addScaledVector(n, 4));
      sheetParts.push(dome);
      cushions++;
    };
    const RUN_CUSHIONS = 7;
    for (let i = 0; i < RUN_CUSHIONS; i++) {
      const s = lerp(0.1, 0.92, (i + 0.5 + (cushionRng() - 0.5) * 0.6) / RUN_CUSHIONS);
      const psi = (cushionRng() - 0.5) * 1.6;
      addCushion(s, psi, (0.04 + cushionRng() * 0.04) * (0.6 + 0.4 * fk) * 1.35);
    }
    if (sMin < -1) {
      const n = Math.round(((-0.2 - Math.max(sMin + 0.3, -3.2)) * len) / 0.55);
      for (let i = 0; i < n; i++) {
        const s = lerp(Math.max(sMin + 0.3, -3.2), -0.2, (i + 0.5 + (cushionRng() - 0.5) * 0.6) / n);
        const psi = (cushionRng() - 0.5) * 1.6;
        addCushion(s, psi, 0.05 + cushionRng() * 0.05);
      }
    }
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
  const clumpRng = rng.fork('branch-clumps');
  for (let i = 0; i < 3; i++) {
    const s = lerp(0.15, 0.8, (i + clumpRng()) / 3);
    // fern sprigs lean out from the shoulders, alternating sides
    const psi = (i % 2 ? 1 : -1) * (0.9 + clumpRng() * 0.5);
    const pos = surface(s, psi, 0.02);
    const nrm = radial(s, psi).addScaledVector(UP, 0.9).normalize();
    foliage.addTuft(pos, nrm, (0.3 + clumpRng() * 0.14) * (0.6 + 0.4 * fk), 1, 0.07, topShade);
  }
  // (round 40: the run's isolated leaf clumps and its line of pale specks are gone — the twigs'
  // sprays are the leaves now, and their tips along the top catch the light instead)
  for (const [s, ps] of reachTufts) {
    const pos = surface(s, ps, 0.02);
    const nrm = radial(s, ps).addScaledVector(UP, 0.9).normalize();
    foliage.addTuft(pos, nrm, 0.28 + clumpRng() * 0.14, 1, 0.07, topShade);
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

  // ---- vines: strands from the underside (round 37: frame 1 s hangs nothing but the two pods
  // under the visible run, and the run is 0.7 m above camera B's eye — a strand longer than
  // ≈ 0.35 m there would hang into B's top edge; round 40: two short ones under the run, clear of
  // the pods, and six along the trunk-side reach where the limb is higher) ----
  const vineRng = rng.fork('branch-vines');
  // (the reach's at s ≤ −0.7: it is off camera C's right edge from s ≈ −0.65 back)
  const vineSpots: [number, number, number][] = [
    [0.16, 2.6, 0.3],
    [0.5, -2.5, 0.28],
    [-0.75, 2.5, 0.7],
    [-0.9, 2.4, 0.8],
    [-1.15, -2.5, 0.6],
    [-1.4, 2.7, 0.7],
    [-1.9, -2.6, 1.0],
    [-2.6, 2.4, 1.1],
  ];
  for (const [s, psi, l] of vineSpots) {
    if (s < sMin + 0.3) continue;
    const hook = surface(s, psi, -0.03);
    hook.x += (vineRng() - 0.5) * 0.2;
    hook.z += (vineRng() - 0.5) * 0.2;
    foliage.addHangingVine(hook, l * (0.85 + vineRng() * 0.3), { amount: 0.11, thickness: 0.012 });
  }
  for (const m of foliage.build(mats, 'lantern-branch')) {
    m.castShadow = false;
    group.add(m);
  }
  // the laminae: the structures' heart-leaf material (shared wind hook) plus a sun-transmission
  // term (verdant-forest materials.ts / trees materials.ts: back-lit and light-behind-the-lamina
  // leaves glow through), so the layered clusters read as thin translucent leaves against the
  // sky from the plaza and from under the limb
  const leafGeo = laminae.build();
  if (leafGeo) {
    const leafMat = windLeafMaterial(mats.leaf.clone(), ctx, 'lantern-branch-leaf');
    leafMat.name = 'structures:lantern-leaf-r40';
    const hook = leafMat.onBeforeCompile;
    leafMat.onBeforeCompile = (shader, renderer) => {
      hook.call(leafMat, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        // round 41: the sun-side laminae read as lime rosettes from 3 m (pods-3m: leaf mean 0.386,
        // hue 75°, sat 0.33) against frame-03's heavy bough, whose leaves are a deep olive (hue
        // 88°, sat 0.48, deep in the roof's shade). The limb hangs under the lantern tree's crown,
        // so what lights a lamina's FACE here is mostly the sky hemisphere, not the Lambert sun —
        // cutting the direct term alone moved the mean 0.003. The whole face response (direct +
        // indirect) is cut to LIT_FACE and part pulled toward an olive of the same luminance
        // (LIT_OLIVE: red down, blue down, hue → ≈ 90°); the shade fill and the transmission
        // below are untouched, so the backlit laminae still glow through.
        {
          vec3 lumW = vec3(0.2126, 0.7152, 0.0722);
          vec3 face = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * ${LANTERN_LEAF_LIT_FACE.toFixed(2)};
          float faceLum = dot(face, lumW);
          face = mix(face, faceLum * vec3(0.78, 1.116, 0.50), ${LANTERN_LEAF_LIT_OLIVE.toFixed(2)});
          reflectedLight.directDiffuse = face;
          reflectedLight.indirectDiffuse = vec3(0.0);
        }
        reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.06;
        #if NUM_DIR_LIGHTS > 0
        {
          // The sun stands at azimuth −128° / 38°: from the plaza (pods-3m looks north-west, INTO
          // it) every lamina had the same view-based backlight, so the whole limb glowed lime at
          // once. Weighted by the lamina's own orientation instead ('through': its shadow side
          // toward the camera, the sun behind its plane — the cupped / twisted laminae differ), so
          // some leaves glow and the rest hold the bough's olive, as frame-03's bough does; the
          // transmitted light leans green (the leaf passes green, not the sun's yellow).
          float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
          float through = max(-dot(normal, directLight.direction), 0.0);
          float transmission = through * 0.6 + backlight * through * 0.5 + backlight * 0.15;
          reflectedLight.directDiffuse += diffuseColor.rgb * directLight.color * transmission * 0.27 * vec3(0.7, 1.0, 0.55);
        }
        #endif`,
      );
    };
    const key = leafMat.customProgramCacheKey;
    leafMat.customProgramCacheKey = () => `${key.call(leafMat)}|lamina-r41`;
    const leafMesh = new Mesh(leafGeo, leafMat);
    leafMesh.name = 'lantern-branch-laminae';
    leafMesh.castShadow = false;
    leafMesh.receiveShadow = true;
    group.add(leafMesh);
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
    leaves: foliage.leafCount + laminae.count,
    dressing: { twigs: twigCount, twigTriangles: Math.round(twigTriangles), laminae: laminae.count, laminaTriangles: laminae.triangles, vines: foliage.vineCount, sheets: sheetParts.length, runBeards, cushions, cords: SLEEVE_CORDS, sides: SLEEVE_SIDES, cordRelief: [SLEEVE_CORD_CREST, SLEEVE_CORD_FURROW] },
    wrapSource,
    containment: checkContainment(),
    podPositions: lanterns.map((r) => r.pod.toArray() as [number, number, number]),
    silhouette,
  };
}
