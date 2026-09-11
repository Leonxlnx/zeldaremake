/**
 * Pod-lantern posts (concept sheets 02/04/05): a bent, rough wooden post 2.2–2.6 m tall whose top
 * hooks over toward the path; one pod lantern hangs from the hook on a short cord, the hook is
 * lashed with vine rope, and a strand of heart-leaf vine trails off it. Built from the same pod
 * builder as every other lantern (`buildLantern`), so the pod count / swing contract holds.
 */
import { CatmullRomCurve3, Group, type Material, Mesh, PointLight, TorusGeometry, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, lerp, smoothstep } from '../util/noise';
import { merge, setColorAttribute, sweepTube } from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternKind, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';

export interface LanternPostDef {
  id: string;
  /** foot of the post (y is sampled from the terrain) */
  position: [number, number];
  /** horizontal direction the hook reaches toward (the path) */
  facing: [number, number];
  /** post height to the bend (metres) */
  height: number;
  tint?: LanternKind;
}

/**
 * Placed against the fixed cameras (gauntlet/tmp/proj.mjs). The stair-foot post stands on the
 * right of the bottom risers: its pod projects to A (0.80, 0.38) — the reference's lit pod right
 * of the stairs at (0.83, 0.36) — and F (0.53, 0.35) (reference 0.52, 0.35); in C it is a thin
 * post at x ≈ 0.09, left of the stair foot. The fork post marks the junction of the spine and the
 * house path from the WEST verge: at the fork's inner corner (3, −4.2) a 2.6 m post would stand
 * 7 m from camera B at (0.57, 0.35) over the signpost and 5 m from camera C beside Link — neither
 * is in the footage — so it sits across the path on the west verge, off the paving, with its
 * hook reaching north along the path edge: outside B/C/D/E/F (B's left edge is at x ≈ −0.02)
 * and just inside A's left edge (pod ≈ (0.03, 0.4)), where the reference has a pod on a bent
 * stick.
 */
export const LANTERN_POSTS: LanternPostDef[] = [
  { id: 'stair-foot', position: [10.55, -0.45], facing: [-0.75, -0.66], height: 2.55, tint: 'orange' },
  { id: 'fork-west', position: [-2.6, -4.6], facing: [0.3, -1], height: 2.4, tint: 'orange' },
];

export interface LanternPostBuild {
  group: Group;
  base: [number, number, number];
  lanterns: LanternRig[];
  lights: PointLight[];
  leaves: number;
}

export function buildLanternPost(def: LanternPostDef, ctx: WorldContext, mats: StructureMaterials, rng: Rng, rope: Material): LanternPostBuild {
  const group = new Group();
  group.name = `lantern-post-${def.id}`;
  const noise = new Noise2D(`${ctx.config.seed}/structures/lantern-post/${def.id}`);
  const [x, z] = def.position;
  const gy = ctx.terrain.height(x, z);
  const F = new Vector3(def.facing[0], 0, def.facing[1]).normalize();
  const S = new Vector3(F.z, 0, -F.x);
  const H = def.height;

  // the post leans a little away from the path, bends toward it above two thirds height and its
  // top curls over into a hook that reaches ~0.55 m out over the path and droops at the tip
  const lean = (rng() - 0.5) * 0.1;
  const side = (rng() - 0.5) * 0.12;
  const foot = new Vector3(x, gy - 0.35, z);
  const ground = new Vector3(x, gy, z);
  const knee = ground.clone().addScaledVector(F, -0.08 + lean).addScaledVector(S, side).setY(gy + H * 0.62);
  const bend = ground.clone().addScaledVector(F, 0.1 + lean).addScaledVector(S, side * 0.6).setY(gy + H);
  const hookMid = ground.clone().addScaledVector(F, 0.42).addScaledVector(S, side * 0.3).setY(gy + H + 0.16);
  const hookTip = ground.clone().addScaledVector(F, 0.62).setY(gy + H + 0.1);
  const curve = new CatmullRomCurve3([foot, ground, knee, bend, hookMid, hookTip], false, 'catmullrom', 0.5);
  const r0 = 0.1;
  const post = sweepTube(curve, {
    // tapers from 0.1 m at the ground to 0.045 at the hook tip, with a knuckle at the bend
    radius: (t) => lerp(r0, 0.045, Math.pow(t, 0.8)) * (1 + 0.12 * Math.exp(-(((t - 0.72) / 0.06) ** 2)) + 0.04 * Math.sin(t * 13)),
    tubularSegments: 26,
    radialSegments: 10,
    uvMetres: 0.7,
    // bark cords twisting up the post, worn smooth on the hook
    displace: (t, ang) => (noise.ridged(ang * 1.4 + t * 2.5, t * 4, 2) - 0.5) * 0.02 * (1 - 0.6 * smoothstep(0.7, 1, t)) + Math.sin(ang * 5 + t * 6) * 0.003,
    // dark damp base, greyer weathered wood above, the trunk's bark map; the hook's underside dark
    color: (t, ang) => {
      // reference A: the post the pod hangs from is a dark silhouette against the bank
      const d = (0.38 + 0.2 * smoothstep(0, 0.5, t)) * (0.88 + 0.24 * Math.max(0, Math.sin(ang)));
      return [d, d * 0.9, d * 0.8];
    },
    capEnd: true,
  });
  const postMesh = new Mesh(post, mats.bark);
  postMesh.name = 'lantern-post';
  postMesh.castShadow = postMesh.receiveShadow = true;
  group.add(postMesh);

  // rope lashing round the bend (where a real hook branch would be bound to the post) and a
  // hanging loop the cord ties into under the hook tip
  const ropeParts = [];
  const tint: [number, number, number] = [0.95, 0.9, 0.82];
  for (let i = 0; i < 4; i++) {
    const t = 0.6 + i * 0.035;
    const c = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const ring = new TorusGeometry(lerp(r0, 0.045, Math.pow(t, 0.8)) + 0.014, 0.014, 5, 14);
    ring.lookAt(tangent);
    ring.translate(c.x, c.y, c.z);
    setColorAttribute(ring, tint);
    ropeParts.push(ring);
  }
  const ropeMesh = new Mesh(merge(ropeParts), rope);
  ropeMesh.name = 'lantern-post-rope';
  ropeMesh.castShadow = true;
  group.add(ropeMesh);

  // the pod hangs from just behind the hook tip on a short cord
  const hook = curve.getPointAt(0.965);
  hook.y -= 0.04;
  const cord = 0.22 + rng() * 0.1;
  const rig = buildLantern(hook, cord, mats, rng.fork('pod'), 1.0, def.tint ?? 'orange');
  group.add(rig.pivot);
  // soft warm pool under the pod: the emissive pod itself carries the glow (no bloom clipping)
  const light = new PointLight(ctx.config.palette.lanternGlow, 3.2, 5.0, 2);
  light.position.copy(rig.pod);
  light.position.y -= 0.15;
  light.name = 'lantern-post-light';
  group.add(light);

  // a vine strand trails from the hook's crook and a couple of heart leaves sprout at the bend
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${ctx.config.seed}/lantern-post/${def.id}`);
  const crook = curve.getPointAt(0.84);
  crook.y -= 0.03;
  foliage.addHangingVine(crook, 0.45 + rng() * 0.3, { amount: 0.1, thickness: 0.012 });
  foliage.addLeafCluster(bend.clone().addScaledVector(S, 0.06), 0.14, 8, { size: 0.09, amount: 0.05, droop: 0.6, tint: [0.62, 0.7, 0.36], tintSpread: 0.25 });
  for (const m of foliage.build(mats, `lantern-post-${def.id}`)) group.add(m);

  return { group, base: [ground.x, ground.y, ground.z], lanterns: [rig], lights: [light], leaves: foliage.leafCount };
}
