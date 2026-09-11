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
 * Parametric positions along from→to and cord lengths. The bough rides ≈ 0.7 m above the
 * reference pod height in shot A (so it stays mostly above shot B's frame), and the first two
 * pods come down on long cords to ≈ 2.2 m — the reference's y ≈ 0.45 at x ≈ 0.1 / 0.26. The
 * last pod keeps a short cord so it clears the top edge of shot D, whose camera stands under
 * the bough's tip.
 */
// the two pods reference frame 1 shows hang at t 0.5 / 0.9 on long cords (≈ 2.2 m, the
// reference's y ≈ 0.45 at x ≈ 0.1 and 0.26 in shot A; camera D stands past the bough's tip so
// they hang behind it). The third sits at the trunk end of the bough: just outside shot A's
// left edge (x ≈ -0.05) and outside B, C and D.
// Reference frame 1 s: the three pods hang grouped over the plaza's west edge at screen x 0.08–0.26;
// at t 0.1 the outer pod fell off A's left edge (x −0.05) and the row read widely spaced (W14 review).
const LANTERN_T = [0.68, 0.9, 0.45];
const BRANCH_POD_SCALE = 0.62;
const CORDS = [1.2, 1.0, 1.0];

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
    // Reference frame 1 s: the bough pods span ~0.03 of the frame height at 10.7 m (≈ 0.27 m);
    // at scale 1.0 ours read ~0.45 m and dominate frame 14 s, where the footage shows them small.
    const rig = buildLantern(hook, CORDS[i % CORDS.length], mats, lanternRng, BRANCH_POD_SCALE);
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
