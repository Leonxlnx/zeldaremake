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
 * Parametric positions along from→to and cord lengths. The bough itself already sits at the
 * reference pod height in shot A, so the pods hang on short cords right under it: 0.97/0.12
 * lands the nearest pod at screen ≈ (0.24, 0.44), 0.82/0.5 the second at ≈ (0.09, 0.45);
 * both stay in the upper quarter of shot B and above the top edge of shot D (whose camera
 * stands almost under the bough's tip).
 */
const LANTERN_T = [0.6, 0.82, 0.97];
const CORDS = [0.35, 0.5, 0.12];

export function buildLanternBranch(ctx: WorldContext, mats: StructureMaterials, rng: Rng): LanternBranchBuild {
  const def = ctx.layout.lanternBranch;
  const group = new Group();
  group.name = 'lantern-branch';
  const from = new Vector3(...def.from);
  const to = new Vector3(...def.to);
  const at = (t: number) => from.clone().lerp(to, t);
  /** limb radius along the span (the trees system builds the limb to the same numbers) */
  const r0 = def.radius ?? 0.42;
  const r1 = def.tipRadius ?? 0.16;
  const limbRadius = (t: number) => r0 + (r1 - r0) * t;

  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('branch-lanterns');
  const n = Math.max(def.lanterns, LANTERN_T.length);
  for (let i = 0; i < n; i++) {
    const t = LANTERN_T[i % LANTERN_T.length];
    const hook = at(t);
    hook.y -= limbRadius(t) * 0.9;
    // slight offset to the side of the limb so cords don't all hang from the centreline
    hook.x += (lanternRng() - 0.5) * 0.15;
    hook.z += (lanternRng() - 0.5) * 0.15;
    const rig = buildLantern(hook, CORDS[i % CORDS.length], mats, lanternRng, 1.0);
    group.add(rig.pivot);
    lanterns.push(rig);
  }

  // strands of small heart leaves along the middle of the span only: the tip end hangs almost
  // over camera D (and the near end is over camera B), where long strands would fill the frame
  // top with foreground leaves
  const foliage = new FoliageBuilder(rng.fork('branch-foliage'), `${ctx.config.seed}/lantern-branch`);
  const vineRng = rng.fork('branch-vines');
  for (let i = 0; i < 8; i++) {
    const t = 0.3 + (i / 7) * 0.36 + (vineRng() - 0.5) * 0.04;
    const hook = at(t);
    hook.y -= limbRadius(t) * 0.8;
    hook.x += (vineRng() - 0.5) * 0.3;
    hook.z += (vineRng() - 0.5) * 0.3;
    foliage.addHangingVine(hook, 0.35 + vineRng() * 0.55, { amount: 0.11, thickness: 0.012 });
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
