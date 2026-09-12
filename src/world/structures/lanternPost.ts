/**
 * Pod-lantern posts (concept sheets 02/04/05): a bent, rough wooden post 2.2–2.6 m tall whose top
 * hooks over toward the path; one pod lantern hangs from the hook on a short cord, the hook is
 * lashed with vine rope, and a strand of heart-leaf vine trails off it. The optional pod builder
 * defaults to the shared lantern and preserves its rig contract.
 */
import { CatmullRomCurve3, Group, CircleGeometry, type BufferGeometry, type Material, Mesh, PointLight, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { LanternPostDef } from '../layout';
import type { Rng } from '../util/prng';
import { Noise2D, lerp, smoothstep } from '../util/noise';
import { merge, setColorAttribute, sweepTube } from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';

export interface LanternPostBuild {
  group: Group;
  base: [number, number, number];
  lanterns: LanternRig[];
  lights: PointLight[];
  leaves: number;
}

export function buildLanternPost(def: LanternPostDef, ctx: WorldContext, mats: StructureMaterials, rng: Rng, rope: Material, podBuilder: typeof buildLantern = buildLantern): LanternPostBuild {
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
  const postRadius = (t: number) => lerp(r0, 0.045, Math.pow(t, 0.8))
    * (1 + 0.12 * Math.exp(-(((t - 0.72) / 0.06) ** 2)) + 0.04 * Math.sin(t * 13));
  const barkRelief = (t: number, ang: number) =>
    (noise.ridged(ang * 1.4 + t * 2.5, t * 4, 2) - 0.5) * 0.02
    * (1 - 0.6 * smoothstep(0.7, 1, t)) + Math.sin(ang * 5 + t * 6) * 0.003;
  const post = sweepTube(curve, {
    // tapers from 0.1 m at the ground to 0.045 at the hook tip, with a knuckle at the bend
    radius: postRadius,
    tubularSegments: 26,
    radialSegments: 10,
    uvMetres: 0.7,
    // bark cords twisting up the post, worn smooth on the hook
    displace: barkRelief,
    // dark damp base, greyer weathered wood above, the trunk's bark map; the hook's underside dark
    color: (t, ang) => {
      // reference A: the post the pod hangs from is a dark silhouette against the bank
      const d = (0.38 + 0.2 * smoothstep(0, 0.5, t)) * (0.88 + 0.24 * Math.max(0, Math.sin(ang)));
      return [d, d * 0.9, d * 0.8];
    },
    capEnd: true,
  });
  // Two pruned branch scars break the manufactured pole silhouette. Their grain ends use the
  // existing wood material; all added detail is deterministic and consumes no placement RNG.
  const barkParts = [post];
  const cutParts = [];
  for (const [t, sign, reach] of [[0.43, -1, 0.15], [0.78, 1, 0.115]]) {
    const base = curve.getPointAt(t);
    const direction = S.clone().multiplyScalar(sign).addScaledVector(F, -0.2).setY(0.48).normalize();
    const end = base.clone().addScaledVector(direction, reach);
    const scarCurve = new CatmullRomCurve3([
      base, base.clone().addScaledVector(direction, reach * 0.55).addScaledVector(F, -0.018), end,
    ]);
    barkParts.push(sweepTube(scarCurve, {
      radius: (u) => lerp(0.048, 0.024, u), tubularSegments: 5, radialSegments: 9,
      uvMetres: 0.7, displace: (u, angle) => Math.sin(angle * 4 + u * 3) * 0.003,
      color: (u) => [0.5 + u * 0.08, 0.44 + u * 0.07, 0.36 + u * 0.06],
    }));
    const cut = new CircleGeometry(0.024, 12, 0, Math.PI * 2);
    cut.lookAt(scarCurve.getTangentAt(1));
    cut.translate(end.x, end.y, end.z);
    setColorAttribute(cut, [1.05, 0.86, 0.56]);
    cutParts.push(cut);
  }
  const postMesh = new Mesh(merge(barkParts), mats.bark);
  postMesh.name = 'lantern-post';
  postMesh.castShadow = postMesh.receiveShadow = true;
  group.add(postMesh);
  const cuts = new Mesh(merge(cutParts), mats.wood);
  cuts.name = 'lantern-post-pruned-wood';
  cuts.castShadow = cuts.receiveShadow = true;
  group.add(cuts);

  // Board06: a continuous coarse rope follows the real bend, with a tied return and loose end.
  // Derive its frame from the same curve as the bark, rather than stacking disconnected tori.
  const frames = curve.computeFrenetFrames(26, false);
  const frameAt = (t: number) => {
    const u = t * 26;
    const i = Math.min(25, Math.floor(u));
    return {
      n: frames.normals[i].clone().lerp(frames.normals[i + 1], u - i).normalize(),
      b: frames.binormals[i].clone().lerp(frames.binormals[i + 1], u - i).normalize(),
    };
  };
  const around = (t: number, angle: number, clearance = 0.013) => {
    const { n, b } = frameAt(t);
    const radius = postRadius(t) + barkRelief(t, angle) + clearance;
    return curve.getPointAt(t).addScaledVector(n, Math.cos(angle) * radius)
      .addScaledVector(b, Math.sin(angle) * radius);
  };
  const ropeParts: BufferGeometry[] = [];
  const addRope = (points: Vector3[], segments: number, radius = 0.013) => {
    const path = new CatmullRomCurve3(points, false, 'centripetal');
    const length = path.getLength();
    const pitch = 0.085;
    const strand = (t: number, a: number) => Math.cos(3 * (a - t * length / pitch * Math.PI * 2));
    const geometry = sweepTube(path, {
      // Resolve the three laid strands at a consistent physical pitch along every coil and knot.
      // Deeper valleys stay inside the previous 1.09R outside envelope, so bindings stay fitted.
      radius: () => radius * 0.86,
      tubularSegments: Math.max(segments, Math.ceil(length / pitch * 18)),
      radialSegments: 12, uvMetres: 0.15,
      displace: (t, a) => strand(t, a) * radius * 0.23
        * smoothstep(0, radius * 0.75, Math.min(t, 1 - t) * length),
      color: (t, a) => {
        const v = 0.8 + 0.17 * strand(t, a) + 0.025 * Math.sin(t * length * 97 + a);
        return [v * 0.96, v * 0.98, v * 1.02];
      },
      capStart: true, capEnd: true,
    });
    ropeParts.push(geometry);
  };
  const turns = 4;
  const t0 = 0.66;
  const t1 = t0 + (turns * 0.033) / curve.getLength();
  const winding: Vector3[] = [];
  for (let i = 0; i <= 80; i++) winding.push(around(lerp(t0, t1, i / 80), i / 80 * turns * Math.PI * 2));
  addRope(winding, 112);
  const first = winding[0];
  const last = winding[winding.length - 1];
  const knotOut = frameAt((t0 + t1) / 2).n;
  const knot = first.clone().lerp(last, 0.5).addScaledVector(knotOut, 0.028);
  addRope([last, knot.clone().addScaledVector(S, 0.026), first,
    knot.clone().addScaledVector(S, -0.025), last.clone().addScaledVector(knotOut, 0.022),
    knot.clone().add(new Vector3(0, -0.14, 0)).addScaledVector(S, 0.032)], 32, 0.012);

  // Binding at the hanging point wraps the wood and converges on the existing swing pivot.
  // Keep that pivot, cord length, pod/light position and all old random streams exactly intact.
  const hook = curve.getPointAt(0.965);
  hook.y -= 0.04;
  const tipFrame = frameAt(0.965);
  const downAngle = Math.atan2(-tipFrame.b.y, -tipFrame.n.y);
  const suspension: Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    suspension.push(around(lerp(0.941, 0.965, i / 40), downAngle + i / 40 * Math.PI * 4));
  }
  suspension.push(hook.clone().add(new Vector3(0, -0.019, 0)));
  addRope(suspension, 64, 0.011);
  const ropeMesh = new Mesh(merge(ropeParts), rope);
  ropeMesh.name = 'lantern-post-rope';
  ropeMesh.castShadow = ropeMesh.receiveShadow = true;
  group.add(ropeMesh);

  const cord = 0.22 + rng() * 0.1;
  const rig = podBuilder(hook, cord, mats, rng.fork('pod'), 1.0, def.tint ?? 'orange');
  group.add(rig.pivot);
  // Keep the unshadowed local pool restrained: the body's separate emission carries its glow.
  // A stronger internal point overlights opaque ties and thin rims through the enclosing pod.
  const light = new PointLight(ctx.config.palette.lanternGlow, 1.2, 5.0, 2);
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
