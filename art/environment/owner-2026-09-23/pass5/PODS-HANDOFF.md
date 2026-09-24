# The unlit pods — what I ruled out before the deadline ran out (squad4, 23:40 → 00:15)

Nobody had touched `src/world/structures/lantern*.ts` or `podSkin.ts` in three hours, so I picked up
the owner's "the main tree branch that sticks out when I first go into the game — why did those stop
glowing?" while the stair fix was pushed. I did not land a fix. Here is what I did establish, so the
next agent starts twenty minutes ahead instead of at zero.

## The control: on the current integration head the bough's pods DO glow

`pods-at-5m-current-head.png` and the crop beside it — the lantern bough rendered from the plaza at
about 5 m, on `origin/cursor/kokiri-world-phase1-f65e` as of 23:45. The pods hang with a clear warm
orange core, the husk lit from inside, the bough's bark brown and in relief.

So **the emissive is not simply off**. Whatever he is seeing is a function of distance, of the build
he was playing, or of the pods on a different bough than the one I framed.

## Therefore, reproduce before you change anything

Three things to separate, in this order, because each is cheap and each kills a hypothesis:

1. **Distance.** My control is 5 m; his shot is nearer 10–15 m across the plaza. Render the bough at
   5, 10, 15 and 20 m and see where the core dies. If it dies at a threshold, the cause is in
   `materials.ts`: `FAR_LANTERN_INTENSITY` (4.5) relaxing to the near pods' 2.0 over
   `FAR_HALO_NEAR` = [14, 24] m through the `uFarNear` / `uFarNearScale` injection at line ~1493,
   and the halo disc that fades on the same range. Note which material the BOUGH's pods actually
   get — `lanternBranch.ts` calls `buildLantern(hook, cord, mats, rng, BRANCH_POD_SCALE)`, and
   whether `mats` hands it the near `lantern` or the `lanternFar` variant decides whether that
   falloff applies to them at all.
2. **The build he played.** `play-head` moved at 23:00 and again at 23:25. If his screenshot predates
   a merge, part of this may already be stale. Check what `play-head` pointed at when he shot it.
3. **The veil on top.** Four atmosphere commits landed today that raise the lit air (`bca84c5a`,
   `f040df27`, `b9c07ac6`, `15b59529`). The height fog's exemption only protects a bright emissive
   from the deep-forest **shade** term — `kfShade = mix(kfShade, 1.0, smoothstep(1.3, 2.0, kfPeak))`
   in heightfog.ts — and **not** from the haze mix itself, which is applied to every fragment
   including emissives. A pod's body is well under 2.0 linear over most of its area, so it is only
   partly exempt even from the shade. If the pods survive at every distance with the fog off, this
   is where it is, and it belongs to the atmosphere lane (squad1 is live in that file right now —
   coordinate before editing it).

## The second half of his complaint is separate and unexamined

"It just looks like a dead branch." In his shot the bough is a flat grey slab with almost no
foliage. My control at 5 m has leaves on it, so again this may be a range thing — the bough's
foliage (`structures/foliage.ts`, `lanternBranch.ts`) thinning or dropping out with distance. Worth
one distance ladder of its own.

## Time cost, for planning

Every render on this VM is a ~70 s world load plus ~60 s a frame under SwiftShader, so a
four-distance ladder is about six minutes. Budget the reproduction before you budget the fix.
