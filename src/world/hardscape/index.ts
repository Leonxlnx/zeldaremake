/**
 * Hardscape system — owner: terrain agent.
 * The hero stairway (and the two short stairs), flagstone paths + plaza, joint fill and the
 * grass sprouting from the joints. Everything is cut-stone geometry seated on the heightfield.
 */
import { Group, InstancedMesh, Matrix4, Mesh } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { STONE_NEAR, createStoneMaterial } from './material';
import { buildStairway, stairFrame, stairToWorld, type StairFrame } from './stairs';
import { isPaved, nearIsolatedDisc, pavedLevel, placeFlagstones, rimDistance, type PavingContext } from './flagstones';
import { MeshBuilder, buildSlab, irregularPolygon, jitteredRect } from './geometry';
import { buildJointMesh, jointFillLift, jointFillTones } from './joints';
import { HARDSCAPE_PACKS, JOINT_TUFT_DEEP, JOINT_TUFT_TIP, SPROUT_LOD_FAR, buildSproutMeshes, createSproutMaterial, type SproutSpot } from '../materials/sprouts';
import { seamGritTone } from '../materials/grit';
import { SPROUT_JITTER_SCHEME, createSproutJitterStreams } from './sprout-jitter';
import { JOINT_SOIL, JOINT_SOIL_DRY, JOINT_SOIL_MID } from './joints';
import { archSeam, discField, hollowPath, jointSoil, lawnPocket, lawnPocketEdgeX, lawnZone, southPlaza } from './zones';
import { buildFlowerHeads, type FlowerHead } from './flowers';
import { Noise2D, smoothstep } from '../util/noise';
import { houseSteppingStones } from '../layout';

/** joint-grass tint (materials/sprouts.ts `SproutSpot.jointTint`) per sprout scatter; scatters not listed keep their greens */
const JOINT_TUFT_TINT: Record<string, number> = {
  joints: 1.0,
  'disc-turf': 1.0,
  'lawn-paving': 0.9,
  'edge-turf': 0.7,
  stairs: 0.8,
  'stairs-flank': 0.8,
  'seam-cushions': 0.45,
  // round 47: the north paving's joints, the spine's mix
  'north-joints': 1.0,
  'north-cushions': 0.45,
};

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'hardscape';
  const T = ctx.terrain;
  const rng = ctx.rng.fork('hardscape');
  const anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
  const stoneMat = await createStoneMaterial(ctx.textures, ctx.config, anisotropy);

  // --- stairways ---------------------------------------------------------------------------
  const frames: StairFrame[] = ctx.layout.stairs.map((s) => stairFrame(s));
  const stairInfo: { id: string; steps: number; width: number; treadSlabs: number; triangles: number }[] = [];
  const shapeHashes = new Set<string>();
  let totalSteps = 0;
  let treadSlabs = 0;
  let stairTriangles = 0;
  const treadNose: [number, number, number][] = [];
  for (const def of ctx.layout.stairs) {
    const b = buildStairway(def, T, rng.fork(`stairs-${def.id}`), ctx.config.seed);
    const mesh = new Mesh(b.geometry, stoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `stairs-${def.id}`;
    group.add(mesh);
    totalSteps += b.steps;
    treadSlabs += b.treadSlabs;
    stairTriangles += b.triangles;
    b.shapeHashes.forEach((h) => shapeHashes.add(h));
    treadNose.push(...b.treadNose);
    stairInfo.push({ id: def.id, steps: def.steps, width: def.width, treadSlabs: b.treadSlabs, triangles: b.triangles });
  }
  ctx.progress('hardscape', 0.3);

  // --- flagstones --------------------------------------------------------------------------
  const pts = [...ctx.layout.pathSpine, ...ctx.layout.pathToStairs, ...ctx.layout.pathToHouse];
  const bbox = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of pts) {
    bbox.x0 = Math.min(bbox.x0, p[0] - 3.2);
    bbox.x1 = Math.max(bbox.x1, p[0] + 3.2);
    bbox.z0 = Math.min(bbox.z0, p[2] - 3.2);
    bbox.z1 = Math.max(bbox.z1, p[2] + 3.2);
  }
  bbox.x0 = Math.min(bbox.x0, -7.5);
  bbox.x1 = Math.max(bbox.x1, 7.5);
  bbox.z0 = Math.min(bbox.z0, -7.5);
  bbox.z1 = Math.max(bbox.z1, 7.5);
  // (round 47: this is the `legacy` pass — it reads the path mask as it was before the north
  // extension, so nothing it lays moves; the extension beyond the arch is the second pass below)
  const pc: PavingContext = { terrain: T, frames, rng: rng.fork('paving'), seed: ctx.config.seed, bbox, density: ctx.quality.density, steppingStones: houseSteppingStones(), region: 'legacy' };
  const paving = placeFlagstones(pc, stoneMat);
  group.add(paving.mesh);
  ctx.progress('hardscape', 0.6);

  // --- round 47 (expansion-1): the paving beyond the arch ------------------------------------
  // Owner review 2026-09-19 items 13–16: the path carries on north through the tunnel under the
  // log (`layout.northPath`) into the second clearing (`northClearing`), where a stone circle
  // stands (`stoneCircle`: a round centre slab and seven low standing stones, each on a round
  // plinth). A second `placeFlagstones` pass on its own stream and its own bounding box lays it:
  // its level is 0 wherever the legacy mask is paved, so its Voronoi cells stop at the legacy
  // cells' edges (a joint like any other across the seam at z ≈ −60) and every legacy stone is
  // untouched. The clearing's discs are the pass's `extraDiscs`. Nothing of it is inside any
  // fixed camera's view (layout.ts `northPath`).
  const NC = ctx.layout.northClearing;
  const SC = ctx.layout.stoneCircle;
  const nbbox = { x0: NC.x - NC.radius - 3.2, x1: NC.x + NC.radius + 3.2, z0: NC.z - NC.radius - 3.2, z1: -55 };
  for (const p of ctx.layout.northPath) {
    nbbox.x0 = Math.min(nbbox.x0, p[0] - 3.2);
    nbbox.x1 = Math.max(nbbox.x1, p[0] + 3.2);
    nbbox.z0 = Math.min(nbbox.z0, p[2] - 3.2);
  }
  const circleRng = rng.fork('stone-circle');
  /** the standing stones' places on the ring (world xz), evenly spaced with a little slip, the ring's gap facing the path's arrival from the east-south-east */
  const ringStones: { x: number; z: number; ang: number }[] = [];
  const gapAng = Math.atan2(ctx.layout.northPath[ctx.layout.northPath.length - 2][2] - NC.z, ctx.layout.northPath[ctx.layout.northPath.length - 2][0] - NC.x);
  for (let i = 0; i < SC.stones; i++) {
    // the ring leaves the arrival sector (± 1/(stones+1) of the circle around `gapAng`) open
    const t = (i + 1) / (SC.stones + 1);
    const ang = gapAng + Math.PI * 2 * t + circleRng.range(-0.06, 0.06);
    const r = SC.ringRadius + circleRng.range(-0.12, 0.12);
    ringStones.push({ x: NC.x + Math.cos(ang) * r, z: NC.z + Math.sin(ang) * r, ang });
  }
  const northDiscs = [{ x: NC.x, z: NC.z, r: SC.centreSlabRadius, atRim: true }, ...ringStones.map((s) => ({ x: s.x, z: s.z, r: 0.34, atRim: true }))];
  const pcN: PavingContext = { terrain: T, frames, rng: rng.fork('paving-north'), seed: ctx.config.seed, bbox: nbbox, density: ctx.quality.density, steppingStones: [], region: 'north', extraDiscs: northDiscs };
  const pavingN = placeFlagstones(pcN, stoneMat);
  pavingN.mesh.name = 'flagstones-north';
  group.add(pavingN.mesh);
  ctx.progress('hardscape', 0.7);

  // --- joint fill --------------------------------------------------------------------------
  // the stepping stones on Saria's grassy ramp are paved discs with no joints: grass and clover
  // run up to each stone's edge in the reference, so neither the soil fill nor the joint sprouts
  // treat them as paving (the disc that touches the plaza rim keeps the fill around it)
  const grassDiscs = paving.steppingStones.filter((d) => !d.atRim);
  const paved = (x: number, z: number, threshold?: number) => isPaved(pc, x, z, threshold) && !nearIsolatedDisc(grassDiscs, x, z, 1.4);
  // the fill is clipped to the mask's 0.5 iso (the slab level; joints.ts), so it takes the level itself
  const pavedLevelAt = (x: number, z: number) => (nearIsolatedDisc(grassDiscs, x, z, 1.4) ? 0 : pavedLevel(pc, x, z));
  const joints = await buildJointMesh(T, pavedLevelAt, bbox, ctx.textures, ctx.config, ctx.config.seed, { edgeGap: paving.edgeGap, onStone: paving.onStone });
  group.add(joints.mesh);
  // round 47: the north paving's own fill, on the north bounding box. Its level is the live mask
  // capped by (1 − legacy level), so its 0.5 iso is the legacy fill's 0.5 iso exactly (both are
  // marched on the same 0.2 m world lattice): the two fills meet edge to edge across the seam,
  // neither overlapping nor leaving a strip. Its gap field sees both passes' stones.
  const pavedLevelN = (x: number, z: number) => Math.min(pavedLevel(pc, x, z, false, 'live'), 1 - pavedLevel(pc, x, z));
  const edgeGapAll = (x: number, z: number) => Math.min(paving.edgeGap(x, z), pavingN.edgeGap(x, z));
  const onStoneAll = (x: number, z: number) => paving.onStone(x, z) || pavingN.onStone(x, z);
  const jointsN = await buildJointMesh(T, pavedLevelN, nbbox, ctx.textures, ctx.config, ctx.config.seed, { edgeGap: edgeGapAll, onStone: onStoneAll });
  jointsN.mesh.name = 'joint-fill-north';
  group.add(jointsN.mesh);

  // --- sprouts in the joints ---------------------------------------------------------------
  const spots: SproutSpot[] = [];
  const srng = rng.fork('sprouts');
  // The reference shows small grass tufts and clover in the joints across the whole plaza
  // (B/E/D foregrounds). The stair joints below add ≈ 120 more, W21 asks for ≥ 500 in total. The
  // scene-graph cross-check (score.mjs B3) needs the group's instance count to cover the flagstone
  // claim, and the slabs are one merged mesh, so the instanced sprouts must at least match their
  // number. Spots are biased toward the joints within SPROUT_LOD_FAR of cameras B/E and D (the
  // shots that read the joints); beyond that distance the shader collapses them anyway.
  const target = Math.max(Math.round(1500 * Math.max(0.7, ctx.quality.density)), paving.stones.length + 60);
  const cams = ctx.layout.viewpoints.filter((v) => v.id === 'B_house' || v.id === 'E_ground' || v.id === 'D_log').map((v) => v.position);
  const camWeight = (x: number, z: number) => {
    let d = Infinity;
    for (const c of cams) d = Math.min(d, Math.hypot(c[0] - x, c[2] - z));
    return 0.25 + 0.75 * (1 - smoothstep(SPROUT_LOD_FAR - 8, SPROUT_LOD_FAR + 2, d));
  };
  let tries = 0;
  while (spots.length < target && tries < target * 40) {
    tries++;
    const x = srng.range(bbox.x0, bbox.x1);
    const z = srng.range(bbox.z0, bbox.z1);
    if (!paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    // keep to real joints: must be within a slab's reach (not the bare fringe)
    let nearStone = false;
    paving.grid.near(x, z, 1.3, (id) => {
      const st = paving.stones[id];
      if (Math.hypot(st.x - x, st.z - z) < st.radius + 0.22) nearStone = true;
    });
    if (!nearStone) continue;
    if (srng() > camWeight(x, z)) continue;
    spots.push({ x, y: T.height(x, z) + 0.015, z, size: srng(), source: 'joints' });
  }
  const flagstoneSprouts = spots.length;
  // moss cushions (sheet 02 'Moss edges'): small pads where the seams widen into junctions —
  // a joint point at least 5.5 cm from every stone edge — biased to the joint-reading cameras
  const cushionTarget = Math.round(300 * Math.max(0.7, ctx.quality.density));
  let cushions = 0;
  tries = 0;
  while (cushions < cushionTarget && tries < cushionTarget * 60) {
    tries++;
    const x = srng.range(bbox.x0, bbox.x1);
    const z = srng.range(bbox.z0, bbox.z1);
    if (!paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    const gap = paving.edgeGap(x, z);
    if (gap < 0.055 || gap > 0.22) continue;
    if (srng() > camWeight(x, z)) continue;
    spots.push({ x, y: T.height(x, z) + 0.012, z, size: srng(), kind: 'cushion', source: 'seam-cushions' });
    cushions++;
  }
  // the lawn paving (zones.ts, reference B/E foreground): the 15–45 cm joints between the big
  // slabs carry short grass — cropped tufts (TUFT_C / TUFT_A, 6–8 cm), one to every 30 cm or
  // so of joint, one in seven a moss pad — mostly at the slab edges where feet miss; the joint
  // fill under them is the dark mossy earth, not lawn-green (the reference's joint pixels are a
  // dark olive, its greens are the sparse tufts; 300 of these read as a meadow, not a path)
  const lawnTarget = Math.round(150 * Math.max(0.7, ctx.quality.density));
  let lawnSprouts = 0;
  let lawnTufts = 0;
  tries = 0;
  while (lawnSprouts < lawnTarget && tries < lawnTarget * 80) {
    tries++;
    const x = srng.range(-2.5, 5.0);
    const z = srng.range(-8.0, 1.5);
    if (srng() > lawnZone(x, z)) continue;
    if (!paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    const gap = paving.edgeGap(x, z);
    if (gap > 0.5) continue;
    // toward the slab edges: accept mid-joint spots half as often
    if (gap > 0.12 && srng.chance(0.5)) continue;
    if (srng.chance(0.15)) {
      spots.push({ x, y: T.height(x, z) + 0.012, z, size: srng(), kind: 'cushion', source: 'lawn-paving' });
    } else {
      spots.push({ x, y: T.height(x, z) + 0.015, z, size: srng.range(0.15, 0.6), source: 'lawn-paving' });
      lawnTufts++;
    }
    lawnSprouts++;
  }
  // round 33 — the disc field (zones.ts `discField`, frames 14 s / 46 s / 56 s): grass and clover
  // in the 9–22 cm earth gaps between the rounded stones of the spine north of the plaza — short
  // and mid tufts (TUFT_C / TUFT_A), one in ten clover, one in twenty a moss pad, sown where a
  // gap is at least 3 cm from a stone and not further than 35 cm from one, weighted by the field
  // and the joint-reading cameras. Own stream (nothing sown before or after moves).
  const drng = rng.fork('disc-turf');
  // (300: the first cut's 420 with the seam grit's growth put +14 k triangles on every view; the
  // budget is the control's)
  const discTarget = Math.round(300 * Math.max(0.7, ctx.quality.density));
  let discTufts = 0;
  let discPads = 0;
  tries = 0;
  while (discTufts < discTarget && tries < discTarget * 80) {
    tries++;
    const x = drng.range(-2.5, 4.5);
    const z = drng.range(-14.5, -0.5);
    if (drng() > discField(x, z)) continue;
    if (!paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    const gap = paving.edgeGap(x, z);
    if (gap < 0.03 || gap > 0.35) continue;
    if (drng() > camWeight(x, z)) continue;
    const r = drng();
    if (r < 0.05) {
      spots.push({ x, y: T.height(x, z) + 0.012, z, size: drng(), kind: 'cushion', source: 'disc-turf' });
      discPads++;
    } else if (r < 0.15) {
      spots.push({ x, y: T.height(x, z) + 0.012, z, size: drng.range(0.05, 0.19), scale: drng.range(1.0, 1.3), source: 'disc-turf' });
    } else {
      spots.push({ x, y: T.height(x, z) + 0.015, z, size: r < 0.7 ? drng.range(0.22, 0.42) : drng.range(0.43, 0.69), scale: drng.range(1.0, 1.4), source: 'disc-turf' });
    }
    discTufts++;
  }
  // the lawn pocket west of the path (zones.ts `lawnPocket`, reference B/E's left third): the
  // round-10 scatter, 220 tufts on this stream, keeps its places (so every sprout sown after it
  // does too); the dense lawn proper is sown below on its own stream. Capped below TUFT_B: the
  // lawn is short turf, and these now stand among 1 400 short tufts
  const pocketTarget = Math.round(220 * Math.max(0.7, ctx.quality.density));
  let pocketTufts = 0;
  tries = 0;
  while (pocketTufts < pocketTarget && tries < pocketTarget * 80) {
    tries++;
    const x = srng.range(-2.4, 1.0);
    const z = srng.range(-7.8, -2.4);
    if (srng() > lawnPocket(x, z)) continue;
    if (!paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    const s0 = srng.chance(0.2) ? srng.range(0.05, 0.2) : srng.range(0.3, 0.95);
    // (the tufts the cap moved down from TUFT_B are their own source, so the others keep their draws)
    spots.push({ x, y: T.height(x, z) + 0.012, z, size: Math.min(0.69, s0), source: s0 > 0.7 ? 'pocket-scatter-capped' : 'pocket-scatter' });
    pocketTufts++;
  }
  // connected planted joints (boards 02 'Moss edges' / 07 'path texture'): along the paved edges
  // the seams carry runs of grass and moss that bridge from joint to joint. Tufts are sown in the
  // seams (≤ 9 cm from a stone edge) within ~1.3 m of the rim, gated by a slow noise so they come
  // in connected stretches with bare seams between, not a uniform sprinkle; the seam grit thins
  // where they take over (below). Sizes span TUFT_C/A (short–mid grass), one in six a moss pad,
  // one in ten clover.
  const turfN = new Noise2D(`${ctx.config.seed}/edge-turf`);
  const edgeTurf = (x: number, z: number) => {
    const rim = rimDistance(pc, x, z);
    if (rim > 1.4) return 0;
    return smoothstep(1.4, 0.35, rim) * smoothstep(0.38, 0.62, turfN.fbm(x * 0.9 + 3, z * 0.9 - 7, 2) * 0.5 + 0.5);
  };
  // (own stream, so the stair and joint sprouts sown before and after keep their places)
  const erng = rng.fork('edge-turf');
  const edgeTarget = Math.round(360 * Math.max(0.7, ctx.quality.density));
  let edgeTufts = 0;
  let edgeGrass = 0;
  tries = 0;
  while (edgeTufts < edgeTarget && tries < edgeTarget * 80) {
    tries++;
    const x = erng.range(bbox.x0, bbox.x1);
    const z = erng.range(bbox.z0, bbox.z1);
    if (!paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    const gap = paving.edgeGap(x, z);
    if (gap > 0.09) continue;
    if (erng() > edgeTurf(x, z)) continue;
    if (erng() > camWeight(x, z)) continue;
    const r = erng();
    if (r < 0.16) {
      spots.push({ x, y: T.height(x, z) + 0.012, z, size: erng(), kind: 'cushion', source: 'edge-turf' });
    } else {
      spots.push({ x, y: T.height(x, z) + 0.015, z, size: r < 0.26 ? erng.range(0.05, 0.2) : erng.range(0.22, 0.75), source: 'edge-turf' });
      edgeGrass++;
    }
    edgeTufts++;
  }
  // stair joints: foot of each riser + along the cheeks, with moss cushions in the tread/riser
  // corner (sheet 01 environment inset, sheet 04 path inset: mossy risers, pads in the corners).
  // Round 23 (frames 1 s / 8 s: moss and short grass sit in the corners at the flanks and creep
  // in from both sides, the centre third where feet go stays bare): the riser-foot tufts are
  // pushed toward the flanks (the same draw, remapped), the corner cushions favour the flank
  // band, and a forked stream adds flank tufts and corner pads so nothing sown before or after
  // moves. `feet` is 1 on the centre third of the run, 0 at the flanks.
  const xrng = srng.fork('stairs-r23');
  for (const f of frames) {
    const hw = f.def.width / 2;
    const feet = (a: number) => 1 - smoothstep(0.3 * hw, 0.85 * hw, Math.abs(a));
    for (let i = 0; i < f.def.steps; i++) {
      const n = srng.int(2, 5);
      for (let k = 0; k < n; k++) {
        // remap the uniform draw toward the flanks (sqrt), keeping a thin scatter in the centre
        const t = srng.range(-1, 1);
        const a = Math.sign(t) * (0.08 + (hw - 0.18) * Math.sqrt(Math.abs(t)));
        const [x, z] = stairToWorld(f, a, i * f.def.tread + 0.035);
        spots.push({ x, y: f.def.base[1] + i * f.def.rise + 0.005, z, size: srng() * 0.6 * (0.7 + 0.5 * (1 - feet(a))), source: 'stairs' });
      }
      const nc = srng.int(2, 6);
      for (let k = 0; k < nc; k++) {
        // heavier toward the flanks, where the moss field on the stones is strongest
        const a = (srng.chance(0.75) ? srng.range(0.4, 0.95) : srng.range(0.15, 0.4)) * hw * (srng.chance(0.5) ? -1 : 1);
        const [x, z] = stairToWorld(f, a, i * f.def.tread + 0.05);
        spots.push({ x, y: f.def.base[1] + i * f.def.rise + 0.006, z, size: 0.45 + srng() * 0.55, kind: 'cushion', scale: 1.15, source: 'stairs' });
      }
      for (const side of [-1, 1]) {
        if (!srng.chance(0.7)) continue;
        const [x, z] = stairToWorld(f, side * (hw - 0.03), i * f.def.tread + srng.range(0.05, f.def.tread - 0.05));
        spots.push({ x, y: f.def.base[1] + (i + 1) * f.def.rise - 0.02, z, size: 0.4 + srng() * 0.6, source: 'stairs' });
      }
      // flank corners (own stream): 1–3 short/mid tufts per side in the outer 40 % of the tread
      // against the riser, plus a larger moss pad at the very end two times in three
      for (const side of [-1, 1]) {
        const nt = xrng.int(1, 4);
        for (let k = 0; k < nt; k++) {
          const a = side * hw * xrng.range(0.58, 0.96);
          const [x, z] = stairToWorld(f, a, i * f.def.tread + xrng.range(0.03, 0.12));
          spots.push({ x, y: f.def.base[1] + i * f.def.rise + 0.005, z, size: xrng.range(0.22, 0.75), source: 'stairs-flank' });
        }
        if (xrng.chance(0.66)) {
          const [x, z] = stairToWorld(f, side * hw * xrng.range(0.8, 0.97), i * f.def.tread + xrng.range(0.06, 0.2));
          spots.push({ x, y: f.def.base[1] + i * f.def.rise + 0.006, z, size: 0.5 + xrng() * 0.5, kind: 'cushion', scale: 1.5, source: 'stairs-flank' });
        }
      }
    }
  }
  // --- the lawn pocket's dense lawn (round 13) -------------------------------------------------
  // Reference frame 14 s, left third: a low dense green turf with white dots, meeting the path at
  // a soft grass edge. The pocket is path mask 1.0, so the vegetation system may not plant it
  // (W15); the turf is joint sprouts. Short blade clumps (TUFT_A / TUFT_C, at 1.1–2× → 10–22 cm
  // footprints, 7–17 cm tall, most at the short end) with clover among them, on a jittered
  // 8 cm lattice (≈ 120 / m², the clumps overlap) so that from B/E (5–9 m, a 10–17° grazing
  // view) the blades hide the earth; a few moss pads; along the pocket's east edge a row of
  // larger clumps hugging the slab rims, their blades hanging 3–9 cm over the stone (the soft
  // edge); white flower heads (flowers.ts). Own streams, so nothing sown before moves.
  const lrng = rng.fork('pocket-lawn');
  let lawnPocketArea = 0;
  const lawnCell = 0.082 / Math.sqrt(Math.max(0.7, ctx.quality.density));
  let lawnPocketTufts = 0;
  let lawnPocketClover = 0;
  const lawnScales: number[] = [];
  for (let gz = -7.0; gz <= -2.5; gz += lawnCell) {
    for (let gx = -2.7; gx <= 1.0; gx += lawnCell) {
      const x = gx + lrng.range(-0.4, 0.4) * lawnCell;
      const z = gz + lrng.range(-0.4, 0.4) * lawnCell;
      if (lawnPocket(gx, gz) >= 0.5) lawnPocketArea += lawnCell * lawnCell;
      if (lrng() > lawnPocket(x, z)) continue;
      if (!paved(x, z, 0.42) || paving.onStone(x, z)) continue;
      const r = lrng();
      const u = lrng();
      const scale = 1.1 + 0.9 * u * u;
      if (r < 0.14) {
        spots.push({ x, y: T.height(x, z) + 0.012, z, size: lrng.range(0.05, 0.19), scale: scale * 1.2, source: 'pocket-lawn' });
        lawnPocketClover++;
      } else {
        spots.push({ x, y: T.height(x, z) + 0.012, z, size: r < 0.55 ? lrng.range(0.21, 0.41) : lrng.range(0.43, 0.69), scale, source: 'pocket-lawn' });
        lawnScales.push(scale);
      }
      lawnPocketTufts++;
    }
  }
  // moss pads in the lawn (the reference's darker clumps): a handful, 9–20 cm across
  let lawnPocketPads = 0;
  tries = 0;
  while (lawnPocketPads < 4 && tries < 400) {
    tries++;
    const x = lrng.range(-2.4, 0.8);
    const z = lrng.range(-6.8, -3.0);
    if (lawnPocket(x, z) < 0.8 || !paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    spots.push({ x, y: T.height(x, z) + 0.012, z, size: lrng.range(0.6, 1), kind: 'cushion', scale: lrng.range(1.8, 2.6), source: 'pocket-pads' });
    lawnPocketPads++;
  }
  // the soft edge: the pocket's fill fades out 5–35 cm west of the slab rims (the rims wander
  // east of `lawnPocketEdgeX`), so per 5 cm row the first slab east of the pocket is found by
  // marching, and (a) a clump is set 1–5 cm from its rim at 1.7–2.1× (footprint radius 8–10 cm)
  // so the outer blades reach 3–9 cm over the stone, and (b) one or two clumps fill the soil
  // band behind it, so the lawn runs up to the slabs instead of stopping at a bare strip
  let lawnEdgeTufts = 0;
  let lawnEdgeBand = 0;
  let lawnEdgeOverhang = 0;
  for (let z = -6.8; z <= -3.0; z += 0.05) {
    const zz = z + lrng.range(-0.02, 0.02);
    const ex = lawnPocketEdgeX(zz);
    let xs = NaN;
    for (let x = ex - 0.3; x <= ex + 0.7; x += 0.01) {
      if (paving.onStone(x, zz)) {
        xs = x;
        break;
      }
    }
    if (Number.isNaN(xs)) continue;
    const gap = lrng.range(0.01, 0.05);
    const x = xs - gap;
    if (paved(x, zz, 0.42) && !paving.onStone(x, zz)) {
      const scale = lrng.range(1.7, 2.1);
      spots.push({ x, y: T.height(x, zz) + 0.012, z: zz, size: lrng.range(0.43, 0.69), scale, source: 'pocket-rim' });
      lawnEdgeTufts++;
      lawnEdgeOverhang += 0.046 * scale - Math.min(gap, paving.edgeGap(x, zz));
    }
    const n = lrng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const bx = lrng.range(ex - 0.32, xs - 0.09);
      const bz = zz + lrng.range(-0.02, 0.02);
      if (bx > xs - 0.09 || !paved(bx, bz, 0.42) || paving.onStone(bx, bz)) continue;
      const scale = lrng.range(1.15, 1.7);
      spots.push({ x: bx, y: T.height(bx, bz) + 0.012, z: bz, size: lrng.range(0.3, 0.69), scale, source: 'pocket-band' });
      lawnEdgeBand++;
    }
  }
  // white flower heads: 14 dots over the lawn, ≥ 35 cm apart
  const flowerHeads: FlowerHead[] = [];
  const frng = rng.fork('pocket-flowers');
  tries = 0;
  while (flowerHeads.length < 14 && tries < 2000) {
    tries++;
    const x = frng.range(-2.4, 0.8);
    const z = frng.range(-6.8, -3.0);
    if (lawnPocket(x, z) < 0.6 || !paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    if (flowerHeads.some((h) => Math.hypot(h.x - x, h.z - z) < 0.35)) continue;
    flowerHeads.push({ x, y: T.height(x, z) + 0.008, z });
  }
  const flowers = buildFlowerHeads(flowerHeads, frng, ctx.config.palette);
  group.add(flowers.mesh);
  // --- seam grit -----------------------------------------------------------------------------
  // small stones packed into the dirt seams (sheet 02): 1.5–4 cm, in the joints only (not on a
  // stone, within a slab's reach), biased to the joint-reading cameras, plus a scatter at the
  // stair feet; ≤ 3000, in the fill's own tone. They are sprout instances (variant GRIT) so they
  // share the joint flora's instanced sets and draw calls, LOD-collapsed with the tufts.
  const gritSpots: SproutSpot[] = [];
  const grng = rng.fork('grit');
  const gritTarget = Math.min(3000, Math.round(2200 * Math.max(0.7, ctx.quality.density)));
  const gritCamWeight = (x: number, z: number) => {
    let d = Infinity;
    for (const c of cams) d = Math.min(d, Math.hypot(c[0] - x, c[2] - z));
    // a pebble is a few pixels by 12 m and nothing by 21 m, well inside the sprouts' LOD range
    return 0.2 + 0.8 * (1 - smoothstep(12, 21, d));
  };
  // the grit geometry is built in the soil's tone; where the fill is mossy earth the pebble's
  // tint carries the ratio of the two fills so it still sits within ± 15 % of what it lies on
  const tones = jointFillTones(ctx.config.palette);
  const turfOverSoil: [number, number, number] = [tones.turfMean.r / tones.soilMean.r, tones.turfMean.g / tones.soilMean.g, tones.turfMean.b / tones.soilMean.b];
  // round 33: capped at 880 — the count was set by the acceptance rate (1005 at the control's
  // 3–4 cm seams), and the wider plaza seams and the disc field's gaps let it run to 1313; the
  // frames' joints are moss and earth with a faint speckle at most, and a pebble is the dearest
  // sprout on the GPU (it rides the TUFT_C pack: 50 submitted triangles for 20 shown)
  const gritCap = Math.round(880 * Math.max(0.7, ctx.quality.density));
  tries = 0;
  while (gritSpots.length < Math.min(gritCap, gritTarget - 120) && tries < gritTarget * 40) {
    tries++;
    const x = grng.range(bbox.x0, bbox.x1);
    const z = grng.range(bbox.z0, bbox.z1);
    if (!paved(x, z, 0.4) || paving.onStone(x, z)) continue;
    const gap = paving.edgeGap(x, z);
    if (gap > 0.3) continue;
    if (grng() > gritCamWeight(x, z)) continue;
    // packed dirt is gritty; mossy earth carries a quarter as much, the lawn paving a tenth
    // (reference B/E: a faint speckle in the wide joints, not a gravel bed), and the planted
    // edge seams a third of what they would (turf, not grit, fills them — boards 02/07)
    const soilW = jointSoil(x, z);
    if (grng() > (0.25 + 0.75 * soilW) * (1 - 0.6 * lawnZone(x, z)) * (1 - lawnPocket(x, z)) * (1 - 0.65 * edgeTurf(x, z))) continue;
    // the odd bigger stone (3–4 cm) among a scatter of 1.5–2.5 cm ones
    const size = grng.chance(0.2) ? grng.range(0.03, 0.04) : grng.range(0.015, 0.026);
    // the fill sits 0.8 cm over the ground; keep the pebble out of the stones' bevel zone
    if (gap < size * 0.8) continue;
    // tinted to the fill it sits in: damp brown in a tight seam, pale khaki in an open soil
    // junction, dark olive on the mossy earth
    const lift = jointFillLift(gap, soilW);
    const tint: [number, number, number] = [lift[0] * (1 + (turfOverSoil[0] - 1) * (1 - soilW)), lift[1] * (1 + (turfOverSoil[1] - 1) * (1 - soilW)), lift[2] * (1 + (turfOverSoil[2] - 1) * (1 - soilW))];
    gritSpots.push({ x, y: T.height(x, z) + 0.01, z, size, kind: 'grit', tint, source: 'seam-grit' });
  }
  const seamGrit = gritSpots.length;
  // round 42 — the near-field grit (frame 03 of the owner's recording: the joints at the player's
  // feet are dark soil with pebbles and grit in it, a few of them pale). A second scatter on its
  // own stream, sown within `NEAR_GRIT_R` m of the player poses the paving is walked from (the
  // path cameras B / E / D and the plaza's spawn) — the LOD collapses a pebble by 25 m anyway —
  // at 1.2–3 cm, in the soil seams and the disc field's earth gaps only (the lawn paving and
  // the pocket keep their faint speckle), one in three a shade paler than its fill (× 1.28: the
  // pale pebble of frame 03, still under the slab tops' luminance) so they resolve at 1–2 m.
  const NEAR_GRIT_R = 9;
  const nrng = rng.fork('near-grit');
  const nearCams = [...cams, [0, 0, 0] as [number, number, number]];
  const nearGritTarget = Math.round(700 * Math.max(0.7, ctx.quality.density));
  let nearGrit = 0;
  let paleGrit = 0;
  tries = 0;
  while (nearGrit < nearGritTarget && tries < nearGritTarget * 60) {
    tries++;
    const cam = nearCams[nrng.int(0, nearCams.length)];
    const ang = nrng.range(0, Math.PI * 2);
    const rad = NEAR_GRIT_R * Math.sqrt(nrng());
    const x = cam[0] + Math.cos(ang) * rad;
    const z = cam[2] + Math.sin(ang) * rad;
    if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1) continue;
    if (!paved(x, z, 0.4) || paving.onStone(x, z)) continue;
    const gap = paving.edgeGap(x, z);
    if (gap > 0.22) continue;
    const soilW = jointSoil(x, z);
    if (nrng() > (0.3 + 0.7 * soilW) * (1 - 0.8 * lawnZone(x, z)) * (1 - lawnPocket(x, z)) * (1 - 0.65 * edgeTurf(x, z))) continue;
    const size = nrng.chance(0.15) ? nrng.range(0.026, 0.032) : nrng.range(0.012, 0.024);
    if (gap < size * 0.8) continue;
    const lift = jointFillLift(gap, soilW);
    const pale = nrng.chance(0.33) ? 1.28 : 1;
    if (pale > 1) paleGrit++;
    const tint: [number, number, number] = [pale * lift[0] * (1 + (turfOverSoil[0] - 1) * (1 - soilW)), pale * lift[1] * (1 + (turfOverSoil[1] - 1) * (1 - soilW)), pale * lift[2] * (1 + (turfOverSoil[2] - 1) * (1 - soilW))];
    gritSpots.push({ x, y: T.height(x, z) + 0.01, z, size, kind: 'grit', tint, source: 'near-grit' });
    nearGrit++;
  }
  // round 44 (survey-1 #8; zones.ts `hollowPath` / `archSeam`): grit between the hollow path's set
  // stones — the survey read that stretch as bare dirt with tiles on it — and along the arch
  // seam, where the gravel floor under the log thins into the paving's joints: pebbles at
  // 1.4–4 cm in the joints only, the seam's half of them a shade paler (the gravel's pale
  // stones). Own stream and source (its sprout jitter is a stream of its own, sprout-jitter.ts),
  // so the scatters above and below keep every place; both stretches are ≥ 12 m from the six
  // fixed cameras, so the pebbles are 1–2 px there and the LOD collapses them past 25 m.
  const hgRng = rng.fork('ground-grit');
  const groundGritTarget = Math.round(460 * Math.max(0.7, ctx.quality.density));
  let hollowGrit = 0;
  let seamGrit2 = 0;
  tries = 0;
  while (hollowGrit + seamGrit2 < groundGritTarget && tries < groundGritTarget * 80) {
    tries++;
    const onSeam = hgRng.chance(0.35);
    const x = onSeam ? hgRng.range(1.5, 9.5) : hgRng.range(-2.5, 7.0);
    const z = onSeam ? hgRng.range(-59.5, -48.5) : hgRng.range(-35.5, -13.5);
    const w = onSeam ? archSeam(x, z) : hollowPath(x, z);
    if (hgRng() > w) continue;
    if (!paved(x, z, 0.4) || paving.onStone(x, z)) continue;
    const gap = paving.edgeGap(x, z);
    if (gap > (onSeam ? 0.35 : 0.3)) continue;
    const size = hgRng.chance(0.25) ? hgRng.range(0.028, 0.04) : hgRng.range(0.014, 0.027);
    if (gap < size * 0.8) continue;
    const soilW = onSeam ? 1 : Math.max(0.5, jointSoil(x, z));
    const lift = jointFillLift(gap, soilW);
    const pale = hgRng.chance(onSeam ? 0.5 : 0.3) ? 1.3 : 1;
    const tint: [number, number, number] = [pale * lift[0] * (1 + (turfOverSoil[0] - 1) * (1 - soilW)), pale * lift[1] * (1 + (turfOverSoil[1] - 1) * (1 - soilW)), pale * lift[2] * (1 + (turfOverSoil[2] - 1) * (1 - soilW))];
    gritSpots.push({ x, y: T.height(x, z) + 0.01, z, size, kind: 'grit', tint, source: 'ground-grit' });
    if (onSeam) seamGrit2++;
    else hollowGrit++;
  }
  // the stair grit keeps round 10's soil tone (the grit geometry is built in the round-12 soil)
  const stairGritTint: [number, number, number] = [tones.soilMeanR10.r / tones.soilMean.r, tones.soilMeanR10.g / tones.soilMean.g, tones.soilMeanR10.b / tones.soilMean.b];
  for (const f of frames) {
    const hw = f.def.width / 2;
    for (let k = 0; k < 60; k++) {
      // denser against the first riser (round 23: the foot is a soil bank the step sinks into,
      // its debris collects at the stone), thinning out over the last metre of the approach
      const t = grng();
      const [x, z] = stairToWorld(f, grng.range(-hw - 0.3, hw + 0.3), -0.05 - 1.05 * t * t);
      if (paving.onStone(x, z)) continue;
      const size = grng.chance(0.3) ? grng.range(0.03, 0.045) : grng.range(0.015, 0.028);
      gritSpots.push({ x, y: T.height(x, z) + 0.008, z, size, kind: 'grit', tint: stairGritTint, source: 'stair-grit' });
    }
  }
  // --- round 47: the north paving's joints -----------------------------------------------------
  // Tufts, clover and moss pads in the extension's joints, and grit in its seams — the same
  // mixes as the spine's (`joints` / `seam-cushions` / `seam-grit`), on their own streams and
  // sources (their jitter streams are their own, sprout-jitter.ts), appended after every legacy
  // spot so the shared list order of everything sown above is unchanged. No camera weighting:
  // no fixed camera sees this ground, the player walks it. ~120 m² of paving → 380 tufts (the
  // spine's density), 70 pads, 220 pebbles.
  const nrngJ = rng.fork('north-joints');
  const pavedN = (x: number, z: number, threshold?: number) => isPaved(pcN, x, z, threshold);
  const northTarget = Math.round(380 * Math.max(0.7, ctx.quality.density));
  let northTufts = 0;
  tries = 0;
  while (northTufts < northTarget && tries < northTarget * 40) {
    tries++;
    const x = nrngJ.range(nbbox.x0, nbbox.x1);
    const z = nrngJ.range(nbbox.z0, nbbox.z1);
    if (!pavedN(x, z, 0.42) || onStoneAll(x, z)) continue;
    let nearStone = false;
    pavingN.grid.near(x, z, 1.3, (id) => {
      const st = pavingN.stones[id];
      if (Math.hypot(st.x - x, st.z - z) < st.radius + 0.22) nearStone = true;
    });
    if (!nearStone) continue;
    spots.push({ x, y: T.height(x, z) + 0.015, z, size: nrngJ(), source: 'north-joints' });
    northTufts++;
  }
  const northPadTarget = Math.round(70 * Math.max(0.7, ctx.quality.density));
  let northPads = 0;
  tries = 0;
  while (northPads < northPadTarget && tries < northPadTarget * 60) {
    tries++;
    const x = nrngJ.range(nbbox.x0, nbbox.x1);
    const z = nrngJ.range(nbbox.z0, nbbox.z1);
    if (!pavedN(x, z, 0.42) || onStoneAll(x, z)) continue;
    const gap = edgeGapAll(x, z);
    if (gap < 0.055 || gap > 0.22) continue;
    spots.push({ x, y: T.height(x, z) + 0.012, z, size: nrngJ(), kind: 'cushion', source: 'north-cushions' });
    northPads++;
  }
  const nrngG = rng.fork('north-grit');
  const northGritTarget = Math.round(220 * Math.max(0.7, ctx.quality.density));
  let northGrit = 0;
  tries = 0;
  while (northGrit < northGritTarget && tries < northGritTarget * 40) {
    tries++;
    const x = nrngG.range(nbbox.x0, nbbox.x1);
    const z = nrngG.range(nbbox.z0, nbbox.z1);
    if (!pavedN(x, z, 0.4) || onStoneAll(x, z)) continue;
    const gap = edgeGapAll(x, z);
    if (gap > 0.3) continue;
    const size = nrngG.chance(0.2) ? nrngG.range(0.03, 0.04) : nrngG.range(0.015, 0.026);
    if (gap < size * 0.8) continue;
    const soilW = 1;
    const lift = jointFillLift(gap, soilW);
    const pale = nrngG.chance(0.3) ? 1.28 : 1;
    const tint: [number, number, number] = [pale * lift[0], pale * lift[1], pale * lift[2]];
    gritSpots.push({ x, y: T.height(x, z) + 0.01, z, size, kind: 'grit', tint, source: 'north-grit' });
    northGrit++;
  }

  // --- round 47: the stone circle and the lookout dais ----------------------------------------
  // The clearing's destination (layout.ts `stoneCircle`): seven low standing stones on the ring,
  // each a rough six-sided block 0.55–0.85 m tall on the round plinth the north paving lays for
  // it, leaning a few degrees; and the plateau lookout (`lookout`): one 2.4 × 1.8 m slab standing
  // 0.35 m proud of the east plateau's turf past the end of the `plateau-west` fence. Every block
  // is seated on `ctx.terrain.height`: its bottom sits ≥ 4 cm into the ground at its lowest
  // corner (the gauntlet probes contact at `samplePositions`). Own stream.
  const monoliths = new MeshBuilder();
  const standingStones: { x: number; y: number; z: number; height: number }[] = [];
  const monoM = new Matrix4();
  const placeBlock = (outline: { x: number; z: number }[], cx: number, cz: number, top: number, yaw: number, tiltX: number, tiltZ: number, opts: Parameters<typeof buildSlab>[2]) => {
    const mb = new MeshBuilder();
    buildSlab(mb, outline, opts);
    monoM.makeRotationY(yaw);
    if (tiltX || tiltZ) monoM.multiply(new Matrix4().makeRotationX(tiltX).multiply(new Matrix4().makeRotationZ(tiltZ)));
    monoM.setPosition(cx, top - opts.thickness, cz);
    mb.transform(monoM);
    monoliths.append(mb);
  };
  const monoUv = 1 / 1.7;
  const blockN = new Noise2D(`${ctx.config.seed}/monolith-moss`);
  for (const s of ringStones) {
    const height = circleRng.range(SC.height[0], SC.height[1]);
    // footprint 0.30–0.42 m across, a little oblong; the ground under the whole footprint
    const across = circleRng.range(0.3, 0.42);
    const outline = irregularPolygon(circleRng, 6, { radiusJitter: 0.22, angleJitter: 0.25, aspect: circleRng.range(1.1, 1.5) }).map((p) => ({ x: p.x * across * 0.5, z: p.z * across * 0.5 }));
    let groundMin = Infinity;
    let groundMax = -Infinity;
    for (const p of outline) {
      const h = T.height(s.x + p.x, s.z + p.z);
      groundMin = Math.min(groundMin, h);
      groundMax = Math.max(groundMax, h);
    }
    // the plinth's top is ~4 cm over the ground; the block stands on the ground through it
    const top = groundMax + height;
    const thickness = top - groundMin + 0.06;
    const tint = 0.78 + circleRng.range(0, 0.14);
    placeBlock(outline, s.x, s.z, top, circleRng.range(0, Math.PI * 2), circleRng.range(-0.05, 0.05), circleRng.range(-0.05, 0.05), {
      thickness,
      bevel: 0.035,
      dip: 0,
      color: [tint, tint, tint * 0.96],
      sideColor: [tint * 0.86, tint * 0.86, tint * 0.84],
      // a block standing 0.6–0.85 m proud takes the shader's lichen and grime on its faces like its top
      wear: 0.6,
      sideWear: 0.7,
      mossEdge: 0.5,
      mossInner: 0.2,
      mossFn: (x, z) => 0.3 + 0.7 * (blockN.fbm((x + s.x) * 2.3 + 5, (z + s.z) * 2.3 - 3, 2) * 0.5 + 0.5),
      uvScale: monoUv,
      uvOffset: [circleRng() * 3, circleRng() * 3],
      rings: 2,
      sideStain: 1.4,
    });
    standingStones.push({ x: s.x, y: top, z: s.z, height });
  }
  const LK = ctx.layout.lookout;
  const lkRng = rng.fork('lookout');
  const lkYaw = (LK.yawDeg * Math.PI) / 180;
  const lkOutline = jitteredRect(lkRng, LK.halfLength * 2, LK.halfDepth * 2, { jitter: 0.03, segs: 5, chip: 0.12, chipChance: 0.5 });
  let lkGroundMin = Infinity;
  let lkGroundMax = -Infinity;
  for (const p of lkOutline) {
    const wx = LK.x + p.x * Math.cos(lkYaw) + p.z * Math.sin(lkYaw);
    const wz = LK.z - p.x * Math.sin(lkYaw) + p.z * Math.cos(lkYaw);
    const h = T.height(wx, wz);
    lkGroundMin = Math.min(lkGroundMin, h);
    lkGroundMax = Math.max(lkGroundMax, h);
  }
  const lkTop = lkGroundMax + LK.height;
  const lkThickness = lkTop - lkGroundMin + 0.05;
  placeBlock(lkOutline, LK.x, LK.z, lkTop, lkYaw, 0, 0, {
    thickness: lkThickness,
    bevel: 0.04,
    dip: 0.012,
    color: [0.86, 0.86, 0.83],
    sideColor: [0.72, 0.72, 0.7],
    mossEdge: 0.65,
    mossInner: 0.12,
    mossFn: (x, z) => 0.35 + 0.65 * (blockN.fbm((x + LK.x) * 1.7 - 11, (z + LK.z) * 1.7 + 7, 2) * 0.5 + 0.5),
    uvScale: monoUv,
    uvOffset: [lkRng() * 3, lkRng() * 3],
    rings: 3,
    wear: 0.5,
    sideWear: 0.5,
    sideStain: 1.2,
  });
  const monolithMesh = new Mesh(monoliths.build(), stoneMat);
  monolithMesh.castShadow = true;
  monolithMesh.receiveShadow = true;
  monolithMesh.name = 'hardscape-blocks';
  group.add(monolithMesh);
  // round 34 — the joint grass is khaki, not lawn green (materials/sprouts.ts `jointTint`): the
  // tufts in the paving's joints, the disc field's gaps, the lawn paving's turf joints and the
  // stair joints take the olive-brown → straw ramp; the edge seams (the turf side of the rim,
  // where the vegetation's green verge begins) 70 % of it; the moss pads take 70 % and keep a
  // little of their moss (the frames' seam moss is dark olive-brown, frame 14 s's foreground
  // joints show no lawn-green pads). The lawn pocket west of the path is frame 14 s's dark green
  // lawn (hue 59°) and keeps its greens.
  // The pocket's east fringe is the exception: frame 14 s shows 0.4–0.6 m of dark trodden earth
  // with sparse khaki blades between the lawn and the slab rims (x 0.2–0.3 of the frame at
  // y 0.7–0.78), where ours ran the lawn's green clumps to the stone — measured in camera B's
  // field window that fringe alone was 27 % of the paving's dark class in the 60–70° hue bins
  // against the frame's 6 %. The rim / band clumps take 60 % of the ramp and the lawn within
  // 0.2–0.6 m of the edge half of it (the geometry, the soft edge over the slabs, is unchanged) —
  // north of z −3.6 only (full by −4.6): the strip is frame 14 s's y 0.7–0.78; south of it, at the
  // frame's bottom-left, the lawn meets the slabs green. The same pixels are the right sixth of
  // camera B's left-verge box (vegetation-16's, x 0–0.3 × y 0.55–0.85): tinting the whole fringe
  // 0.85 m deep took that box from a matched 63.7 % green to 54.8 % against the frame's 62.3 %;
  // this scope holds it near 58 % with B's field window inside 8 points on every hue bin.
  // Camera A's plaza (zones.ts `southPlaza`) is the other way round: frame 1 s's joints are dark
  // green-brown moss (its dark class has 32 % in the 50–70° bins against our 15 % before this
  // round), so the plaza's tufts take a third of the ramp and its moss pads none.
  for (const s of spots) {
    const base = JOINT_TUFT_TINT[s.source ?? ''] ?? 0;
    s.jointTint = s.kind === 'cushion' ? Math.min(base, 0.7) : base;
    if (s.source?.startsWith('pocket-')) {
      // (round 35: the lawn's share of the tint scoped to the last 0.2 m before the rim clumps —
      // 0.6 m deep it reached onto the bank faces cameras F and B see as lawn: F's left-bank box
      // 64.9 → 60.9 % green under round 34 against the frame's 91.5, B's left verge 63.7 → 59.0
      // against 62.3. The rim / band clumps keep the full tint: the frame's strip is theirs.)
      const fringe = s.source === 'pocket-rim' || s.source === 'pocket-band' ? 1 : 0.85 * smoothstep(lawnPocketEdgeX(s.z) - 0.35, lawnPocketEdgeX(s.z) - 0.15, s.x);
      s.jointTint = 0.6 * fringe * smoothstep(-3.6, -4.6, s.z);
    }
    const plaza = southPlaza(s.z);
    if (plaza > 0) s.jointTint *= s.kind === 'cushion' ? 1 - plaza : 1 - 0.65 * plaza;
    // north of camera D's foreground (z −13 on, frame 56 s's y 0.58–0.72) the frame's joints go
    // back to moss: its dark class there is 48 % in the 50° bin and 1 % in the 30° against our
    // 26 / 18 with the full ramp, so the tufts keep half their green from there on
    s.jointTint *= 1 - 0.5 * smoothstep(-12.5, -14.5, s.z);
  }
  const sproutMat = createSproutMaterial(ctx.wind, ctx.config);
  // per-(source, variant) jitter streams (sprout-jitter.ts): a scatter can change without re-rolling any other
  const sprouts = buildSproutMeshes([...spots, ...gritSpots], srng, sproutMat, ctx.config, HARDSCAPE_PACKS, { gritTone: seamGritTone(JOINT_SOIL, JOINT_SOIL_MID), jitter: createSproutJitterStreams(rng) });
  for (const m of sprouts.meshes) group.add(m);
  ctx.progress('hardscape', 1);

  // --- audit -------------------------------------------------------------------------------
  const stoneShapes = new Set(paving.stones.map((s) => s.shape));
  const sampleStones = paving.stones.filter((_, i) => i % Math.max(1, Math.ceil(paving.stones.length / 200)) === 0).slice(0, 200);
  // across size (equivalent-area diameter) of the lattice stones, in and out of the lawn paving
  const across = (s: { polygon: { x: number; z: number }[] }) => {
    let a = 0;
    for (let i = 0; i < s.polygon.length; i++) {
      const j = (i + 1) % s.polygon.length;
      a += s.polygon[i].x * s.polygon[j].z - s.polygon[j].x * s.polygon[i].z;
    }
    return 2 * Math.sqrt(Math.abs(a) / 2 / Math.PI);
  };
  const quantiles = (v: number[]) => {
    const a = [...v].sort((p, q) => p - q);
    const q = (f: number) => (a.length ? round(a[Math.floor(f * (a.length - 1))]) : 0);
    return { n: a.length, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
  };
  const latticeStones = paving.stones.filter((s) => !paving.steppingStones.some((d) => Math.hypot(s.x - d.x, s.z - d.z) < d.r * 0.6));
  ctx.audit('hardscape', () => ({
    stairways: stairInfo.map((s) => ({ id: s.id, steps: s.steps, width: s.width, treadSlabs: s.treadSlabs })),
    totalSteps,
    treadSlabs,
    stairGeometry: 'procedural-v2',
    uniqueStepShapes: shapeHashes.size,
    mossJoints: true,
    stairTriangles,
    flagstones: paving.stones.length,
    flagstoneShapes: stoneShapes.size,
    flagstoneGeometry: 'voronoi-cells-v6-broken-slabs',
    flagstoneSplitCells: paving.stats.split,
    // cells cracked along straight chords into two or three stones (boards 02/06/07)
    flagstoneBrokenCells: paving.stats.broken,
    // across size (m, equivalent-area diameter) outside / inside the lawn paving; boards: 0.4–0.9 m
    flagstoneAcrossM: quantiles(latticeStones.filter((s) => lawnZone(s.x, s.z) < 0.5).map(across)),
    flagstoneAcrossLawnM: quantiles(latticeStones.filter((s) => lawnZone(s.x, s.z) >= 0.5).map(across)),
    // flat profile: crown rise of the top, shoulder roll, corner fillet radius (cm)
    flagstoneCrownCm: quantiles(latticeStones.map((s) => s.crown * 100)),
    flagstoneShoulderRollCm: quantiles(latticeStones.map((s) => s.bevel * 100)),
    flagstoneFilletCm: quantiles(latticeStones.map((s) => s.fillet * 100)),
    flagstoneJointCm: quantiles(latticeStones.map((s) => s.joint * 100)),
    // broken-edge features: V-notches in the edges, corners chamfered straight (chipped)
    flagstoneNotches: paving.stats.notches,
    flagstoneChippedCorners: paving.stats.chips,
    // round 23b surface: worn dishes on the big open slabs, dirt-filled settlement cracks (~1 in 8
    // slabs ≥ 0.45 m), two-octave edge wobble (all non-disc stones), D-foreground cells merged
    flagstoneDished: paving.stats.dished,
    flagstoneCracked: paving.stats.cracked,
    flagstoneWobbled: paving.stats.wobbled,
    flagstoneMergedD: paving.stats.mergedD,
    // round 42 player-height pass: stones with edge spalls (rim drops 0.6–1.8 cm), stones with a
    // moss creep on the shaded shoulder; the stone shader's near tile / normal / roughness blend
    flagstoneSpalled: paving.stats.spalled,
    flagstoneMossCreep: paving.stats.creep,
    stoneNearTile: { ...STONE_NEAR, perStoneRoughness: 0.05 },
    // round 33: cells left as trodden earth in camera C's plaza patch, stones styled as the disc field's rounded domed stones (zones.ts)
    flagstoneEarthCells: paving.stats.earth,
    flagstoneDiscField: paving.stats.field,
    flagstoneBigSlabs: paving.stats.big,
    flagstoneRimStones: paving.stats.rim,
    // seeds of the lawn paving (zones.ts): 1.0–1.6 m slabs in 15–45 cm turf joints (B/E foreground)
    flagstoneLawnSlabs: paving.stats.lawn,
    // camera B/E foreground slabs seeded at the reference frame's slab centres (zones.ts B_FOREGROUND_SLABS)
    flagstoneAuthoredSlabs: paving.stats.authored,
    lawnPaving: { x: [-1.5, 3.5], z: [-6.5, -0.5], northEast: { x: [0, 4.2], z: [-3, 0.2] }, fadeM: 1.5, pocketWestOfPathEdge: true },
    // rim stones carrying a moss film over their outer (grass-side) edge (sheet 02 'Moss edges')
    flagstoneEdgeMossStones: paving.stats.edgeMossStones,
    // round slabs on the house branch's stepping-stone discs (merged into the flagstone mesh and
    // counted in `flagstones` too)
    steppingStones: paving.stats.steppingStones,
    steppingStoneDiscs: paving.steppingStones.map((d) => [round(d.x), round(d.z), round(d.r)]),
    flagstoneMaxAspect: round(Math.max(...paving.stones.map((s) => s.aspect))),
    flagstoneTriangles: paving.triangles,
    flagstoneDrawCalls: 1,
    jointFillVertices: joints.vertices,
    jointSprouts: sprouts.count,
    jointSproutsOnFlagstones: flagstoneSprouts + lawnTufts + pocketTufts + lawnPocketTufts + lawnEdgeTufts + lawnEdgeBand + edgeGrass + discTufts - discPads,
    // round 33: grass, clover and pads in the disc field's earth gaps (zones.ts `discField`; part of jointSprouts)
    jointSproutsInDiscField: discTufts,
    // short tufts + moss pads sown thick in the lawn paving's turf joints (part of jointSprouts)
    jointSproutsInLawnPaving: lawnSprouts,
    // the lawn pocket west of the path (part of jointSprouts): round 10's scatter + round 13's
    // dense short lawn on a jittered lattice, its clover, moss pads and slab-rim edge clumps
    jointSproutsInLawnPocket: pocketTufts + lawnPocketTufts + lawnPocketPads + lawnEdgeTufts + lawnEdgeBand,
    lawnPocket: {
      areaM2: round(lawnPocketArea),
      latticeCm: round(lawnCell * 100),
      tufts: pocketTufts + lawnPocketTufts - lawnPocketClover,
      clover: lawnPocketClover,
      mossPads: lawnPocketPads,
      // clumps hugging the slab rims along the pocket's east edge, their mean blade overhang over
      // the stone (cm), and the clumps filling the soil band between the pocket's fade and the rims
      edgeTufts: lawnEdgeTufts,
      edgeOverhangCm: round((lawnEdgeOverhang / Math.max(1, lawnEdgeTufts)) * 100),
      edgeBandTufts: lawnEdgeBand,
      // clump footprint / height (cm) of the lattice tufts at their 1.1–2× scales
      footprintCm: quantiles(lawnScales.map((k) => k * 9.2)),
      heightCm: quantiles(lawnScales.map((k) => k * 7.2)),
      tuftsPerM2: round((pocketTufts + lawnPocketTufts + lawnEdgeTufts + lawnEdgeBand) / Math.max(1e-6, lawnPocketArea)),
      // white flower heads (flowers.ts): one merged mesh, one draw
      flowerHeads: flowerHeads.length,
      flowerTriangles: flowers.triangles,
      flowerDrawCalls: 1,
      groundFill: 'mossy-earth (JOINT_SOIL_MID lerp grassDeep 0.85, dimmed 0.6)',
    },
    // connected planted joints: tufts, clover and pads in runs along the seams near the paved edge (part of jointSprouts)
    jointSproutsInEdgeSeams: edgeTufts,
    jointSproutsOnStairs: sprouts.count - flagstoneSprouts - lawnTufts - pocketTufts - lawnPocketTufts - lawnEdgeTufts - lawnEdgeBand - edgeGrass - (discTufts - discPads) - sprouts.cushions - northTufts,
    // round 47 (expansion-1): the paving beyond the arch — its own pass (flagstones.ts `region:
    // 'north'`), joint fill, joint sprouts and seam grit; the stone circle's standing stones and
    // the plateau lookout dais (one merged mesh, `hardscape-blocks`)
    northPaving: {
      flagstones: pavingN.stones.length,
      seeds: pavingN.stats.seeds,
      rimStones: pavingN.stats.rim,
      roundSlabs: pavingN.stats.steppingStones,
      triangles: pavingN.triangles,
      jointFillVertices: jointsN.vertices,
      jointSprouts: northTufts,
      mossCushions: northPads,
      seamGrit: northGrit,
      bbox: [round(nbbox.x0), round(nbbox.z0), round(nbbox.x1), round(nbbox.z1)],
      // the seam with the legacy paving: the live mask capped by the legacy mask (heightfield legacyPathMask)
      seamZ: -60.3,
    },
    stoneCircle: {
      standingStones: standingStones.length,
      ringRadius: SC.ringRadius,
      heightM: quantiles(standingStones.map((s) => s.height)),
      centreSlabRadius: SC.centreSlabRadius,
    },
    lookout: { x: LK.x, z: LK.z, topY: round(lkTop), proudM: LK.height, yawDeg: LK.yawDeg },
    blockTriangles: monolithMesh.geometry.getAttribute('position').count / 3,
    jointSproutVariants: sprouts.variants,
    // tufts, clover, moss cushions and seam grit packed into these InstancedMeshes (one draw each)
    jointSproutDrawCalls: sprouts.meshes.length,
    jointSproutPacks: HARDSCAPE_PACKS,
    // instance jitter drawn per (source, variant) stream, not from the shared list order (sprout-jitter.ts)
    sproutJitter: SPROUT_JITTER_SCHEME,
    jointSproutHeightCm: [6, 12],
    // round 34: the joint grass on the khaki ramp (sRGB hex, blade base → straw tip) and the share of each scatter pulled onto it
    jointTuftRamp: [JOINT_TUFT_DEEP.toString(16), JOINT_TUFT_TIP.toString(16)],
    jointTuftTint: JOINT_TUFT_TINT,
    jointTuftsTinted: spots.filter((s) => (s.jointTint ?? 0) > 0.5).length,
    jointSproutLodFar: SPROUT_LOD_FAR,
    // triangles shown / submitted (a packed instance collapses its other variants to zero area)
    jointSproutTriangles: sprouts.triangles - sprouts.gritTriangles,
    jointSproutSubmittedTriangles: sprouts.submittedTriangles,
    // low moss pads in wide seam junctions and the stair tread/riser corners (part of jointSprouts)
    mossCushions: sprouts.cushions,
    mossCushionsInSeams: cushions,
    // small stones packed into the dirt seams + a scatter at the stair feet (sprout instances)
    seamGrit: sprouts.grit,
    seamGritInSeams: seamGrit,
    // round 42: the near-field pebbles within NEAR_GRIT_R m of the walked poses (and how many are the pale ones)
    seamGritNearField: nearGrit,
    seamGritPale: paleGrit,
    seamGritAtStairFeet: sprouts.grit - seamGrit - nearGrit - hollowGrit - seamGrit2 - northGrit,
    // round 44: the hollow path's joint grit and the arch seam's (zones.ts hollowPath / archSeam)
    seamGritHollowPath: hollowGrit,
    seamGritArchSeam: seamGrit2,
    // round 44: the hollow path's set stones (flagstones.ts: seated with the grade, sunk, domed)
    flagstonesHollowSeated: paving.stats.hollow,
    seamGritLodFar: SPROUT_LOD_FAR,
    seamGritTriangles: sprouts.gritTriangles,
    seamGritDrawCalls: 0,
    jointFillTriangles: joints.triangles,
    // the fill: dark mossy earth, packed soil only in the dry plaza core and the trodden strip;
    // clipped to the paving mask's 0.5 iso (was: whole 0.2 m quads with any corner paved at 0.38)
    jointFill: 'mossy-earth-v2-clipped-dark-soil',
    // the packed-soil fill (A plaza core, trodden strip) as sRGB hex: frame 1 s's seams sample at 78,66,45
    jointSoilAlbedo: [JOINT_SOIL.toString(16), JOINT_SOIL_MID.toString(16), JOINT_SOIL_DRY.toString(16)],
    jointFillIso: 0.5,
    jointFillClippedCells: joints.clippedCells,
    jointFillRimVertices: joints.rimVertices,
    jointFillRimLengthM: round(joints.rimLength),
    // joint-width field (5 cm texels) the fill shader reads: tight soil seams dark, wide soil junctions pale
    jointGapField: joints.gapField,
    hardscapeTriangles: stairTriangles + paving.triangles + pavingN.triangles + joints.triangles + jointsN.triangles + sprouts.triangles + flowers.triangles + monolithMesh.geometry.getAttribute('position').count / 3,
    plazaRadius: 6,
    samplePositions: {
      // top-centre of each slab: 2–5 cm above the ground by design (the slab is seated in it)
      flagstones: sampleStones.map((s) => [round(s.x), round(s.topY), round(s.z)]),
      treadNose: treadNose.slice(0, 40).map((p) => p.map(round)),
      // round 47: the north paving's slab tops, the standing stones' feet (ground under each) and the lookout's top
      northFlagstones: pavingN.stones.filter((_, i) => i % Math.max(1, Math.ceil(pavingN.stones.length / 60)) === 0).slice(0, 60).map((s) => [round(s.x), round(s.topY), round(s.z)]),
      standingStones: standingStones.map((s) => [round(s.x), round(T.height(s.x, s.z)), round(s.z)]),
      lookout: [[round(LK.x), round(lkTop), round(LK.z)]],
    },
    // stone tops relative to the ground under their centre (m)
    flagstoneTopOffset: {
      min: round(Math.min(...paving.stones.map((s) => s.topY - T.height(s.x, s.z)))),
      max: round(Math.max(...paving.stones.map((s) => s.topY - T.height(s.x, s.z)))),
    },
    maxBottomGap: round(Math.max(...paving.stones.map((s) => Math.abs(s.bottomY - T.height(s.x, s.z))))),
  }));

  let disposed = false;
  return {
    name: 'hardscape',
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      // owned: stair/paving geometries and the stone material (its maps are the TextureLibrary's),
      // the joint fill (geometry, material, generated gap field), the sprout instanced meshes and
      // their material, the flower heads
      group.traverse((object) => {
        if (object instanceof InstancedMesh) object.dispose();
        // the joint fills and the flower heads release their own geometry below
        if (object instanceof Mesh && object !== joints.mesh && object !== jointsN.mesh && object !== flowers.mesh) object.geometry.dispose();
      });
      stoneMat.dispose();
      joints.dispose();
      jointsN.dispose();
      sproutMat.dispose();
      flowers.dispose();
      group.removeFromParent();
    },
  };
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
