/**
 * Pod lanterns and trailing vines hanging from the big limb over the path (left of shot A).
 * The limb itself is built by the trees system along `giantTrees['lantern-tree'].limb`; this
 * module only hangs cords + lanterns + a few heart-leaf strands from `layout.lanternBranch`.
 */
import { Group, PointLight, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';

export interface LanternBranchBuild {
  group: Group;
  lanterns: LanternRig[];
  lights: PointLight[];
  leaves: number;
}

/**
 * parametric positions along from→to and cord lengths: with the hook ~0.3 m under the limb and
 * the pod centre 0.2 m below the cord end, 0.92/0.32 lands the nearest pod at screen ≈ (0.23,
 * 0.39) in shot A and 0.8/1.15 the second at ≈ (0.09, 0.48), matching the reference
 */
const LANTERN_T = [0.58, 0.8, 0.92];
const CORDS = [0.8, 1.15, 0.32];
/** hooks sit under the limb: its radius tapers roughly 0.55 → 0.3 m along the span */
const limbRadius = (t: number) => 0.55 - 0.25 * t;

export function buildLanternBranch(ctx: WorldContext, mats: StructureMaterials, rng: Rng): LanternBranchBuild {
  const def = ctx.layout.lanternBranch;
  const group = new Group();
  group.name = 'lantern-branch';
  const from = new Vector3(...def.from);
  const to = new Vector3(...def.to);
  const at = (t: number) => from.clone().lerp(to, t);

  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('branch-lanterns');
  const n = Math.max(def.lanterns, LANTERN_T.length);
  for (let i = 0; i < n; i++) {
    const t = LANTERN_T[i % LANTERN_T.length];
    const hook = at(t);
    hook.y -= limbRadius(t) * 0.9;
    // slight offset to the side of the limb so cords don't all hang from the centreline
    hook.x += (lanternRng() - 0.5) * 0.25;
    hook.z += (lanternRng() - 0.5) * 0.25;
    const rig = buildLantern(hook, CORDS[i % CORDS.length], mats, lanternRng, 1.05);
    group.add(rig.pivot);
    lanterns.push(rig);
  }

  const foliage = new FoliageBuilder(rng.fork('branch-foliage'), `${ctx.config.seed}/lantern-branch`);
  const vineRng = rng.fork('branch-vines');
  for (let i = 0; i < 9; i++) {
    const t = 0.35 + vineRng() * 0.62;
    const hook = at(t);
    hook.y -= limbRadius(t) * 0.8;
    hook.x += (vineRng() - 0.5) * 0.5;
    hook.z += (vineRng() - 0.5) * 0.5;
    foliage.addHangingVine(hook, 0.5 + vineRng() * 1.3, { leafSize: 0.18, amount: 0.11, thickness: 0.016 });
  }
  for (const m of foliage.build(mats, 'lantern-branch')) group.add(m);

  const lights: PointLight[] = [];
  const c = new Vector3();
  for (const r of lanterns.slice(1)) c.add(r.pod);
  c.divideScalar(Math.max(1, lanterns.length - 1));
  c.y -= 0.2;
  const light = new PointLight(ctx.config.palette.lanternGlow, 7, 7, 2);
  light.position.copy(c);
  light.name = 'branch-lantern-light';
  group.add(light);
  lights.push(light);

  return { group, lanterns, lights, leaves: foliage.leafCount };
}
