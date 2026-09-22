# September 21 — repaired run curves and physical stair support

Current September 22 delivery: **7f406e40** adds forward running posture and the mirrored right strap correction to 1873. [Five matched game comparisons and videos](../2026-09-22-run-posture-game/README.md) · [Runtime posture checks](../2026-09-22-body-posture/DELIVERY.md) · [Combined-asset verification](../2026-09-22-right-strap/COMPOSITION.md). The original 113-phase native contact total falls from 1289 to 1269, while the peak rises from 21 to 24; below-armpit contacts stay at 21. The earlier rear-only shoulder study and compensated-head posture remain held. [Integrated crown sharpness and haze preview](../../../../environment/astra-clarity-integrated/README.md) shows the separate world improvements.

Earlier September22: [integrated-world screenshot](../2026-09-22-world-preview/README.md). Commit `41de5a9d` corrects the final hip guard's stale foot-height budget after a root drop; [regression and unchanged actual-player result](../2026-09-22-hip-slack/README.md). That capture used 4dcf. [Five native calf/cuff before/after pairs](../2026-09-22-leg-contour/README.md) document a held study: shape preservation passes, but new calf/timber contacts prevent adoption. Fable has imported the earlier guard, warmth and bank work; a new review of lost dark coverage at the bank tops is being addressed separately.

Previous character source: `4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850` (51,111,284bytes). It preserves the repaired89df motion below and shortens the distal boot tips by at most11.39mm. [Native before/after, portable preservation check and actual-player evidence](../2026-09-21-boot-tip/README.md). The original captures below used integrated world `6c13f70c`. Blender4.5.13 is controlled through MCP; matched renders use four CPU threads. No new asset service or dependency.

**Current world integration, `ffa4ed9e`:** accepted canonical changes through `0963c09d` are synchronized, including Fable's northern tree stand, plateau canopy, furnished hearths, vessel mouths, log-arch rim, timber tint, leafy floor moss and atlas colour correction. The independently reviewed [crown warmth](https://github.com/Leonxlnx/zeldaremake/pull/28) and [three bank crowns with layered foliage](https://github.com/Leonxlnx/zeldaremake/pull/29) are integrated too. Their PRs contain the raw before/after images and measured costs. Typecheck/build and existing moss, timber and prop-route checks pass; [the world integration's CI passes](https://github.com/Leonxlnx/zeldaremake/actions/runs/35663750333). The later raised-heel guard has its own local checks described below; that is not a claim about its CI. A new local stair-cadence trial is rejected for higher-heel contact failures and poor descent posture; it is not this delivered GLB.

**Validation correction, later September21:** the historical327-point test below omitted210 low toe-dominant vertices. Expanding the check to537 measured real timber penetration (worst−309.19 mm uphill /−46.44 mm downhill). The shared footprint measurement now includes the ankle/toe hierarchy. A fresh actual-player capture checks all537 vertices in1,320frames, including stair transitions and endpoint terrain:708,840 hits, no negative samples or reach clamps, minimum+1.187mmup/+1.267mmdown. This repairs the contact omission; extreme knee folding remains. [Correction, runnable check and evidence](../2026-09-21-complete-foot/README.md).

## What changed

Follow-up: the final hip-turn clearance guard now includes the raised back of each boot. The measured29/38 ankle-rigid points retain their actual height; the sole rectangle stays unchanged. A portable regression fails the former guard, and the default1,320-frame stair replay plus600-frame flat-run check preserve recorded motion exactly. [Source rationale, test and evidence](../2026-09-22-foot-contour/README.md). The [current arm review](../2026-09-22-run-review/README.md) measures about26° rearward versus13° forward upper-arm travel relative to the torso; bent elbows explain why the wrists remain forward.

The historical Blender arm action retained **32 old fractional keys alongside 57 intended keys**. Its 120 Hz export hid those leftovers; later denser sampling carried them into the current shoulder curves. Read-only native inspection confirms the residual keys and shows that `f.update()` alone does not remove the defect. We reconstructed only the four shoulder/elbow run rotations from the hash-pinned, smooth CC0-derived `24591126` motion, reapplying the already-reviewed carriage adjustments. This repairs temporal jumps without introducing another artistic offset. [Reproduction, raw key checks and runtime comparison](../2026-09-21-run-carriage/README.md).

At 240 Hz, maximum adjacent shoulder changes fall **29.57°→1.34° / 31.68°→1.43°**. Original intended poses remain within 0.000083°. Independent native and 60 Hz play/capture checks preserve the hips, chest, head, hands' local channels, legs, root and foot/IK traces. Stride remains 1.82 m, cycle 28/60 s. Native arm/body triangle contacts over 113 phases fall **1452→1316**, worst phase **99→22**, below-armpit contacts **235→21**; this is not a collision-free claim.

Fable's exact body/orbital colour grade and brow factor are baked into the existing image allocations, and the loader's canvas grading pass is removed. The current production loader has exact decoded pixel/material parity and reports `colorGrade: null`. [Colour bake and provenance](../2026-09-21-color-bake/README.md).

## Five matched Blender comparisons

These are the same camera, lights, baked textures and clip phases on both sides. The selected fractional phases expose the defective keys; ordinary intended key poses remain essentially unchanged. No image retouching.

| Exact run phase | Before | Repaired |
| --- | --- | --- |
| 3/112, side | ![Before](delivery-baseline-run-0.03-side.png) | ![Repaired](rebuilt-run-0.03-side.png) |
| 53/112, front | ![Before](delivery-baseline-run-0.47-front.png) | ![Repaired](rebuilt-run-0.47-front.png) |
| 59/112, threequarter | ![Before](delivery-baseline-run-0.53-threequarter.png) | ![Repaired](rebuilt-run-0.53-threequarter.png) |
| 105/112, side | ![Before](delivery-baseline-run-0.94-side.png) | ![Repaired](rebuilt-run-0.94-side.png) |
| 109/112, front | ![Before](delivery-baseline-run-0.97-front.png) | ![Repaired](rebuilt-run-0.97-front.png) |

## Actual-game run video

[Walk → run → idle, final89df delivery](../2026-09-21T18-45-27-011Z-play-motion/walk-run-idle.mp4), [manifest](../2026-09-21T18-45-27-011Z-play-motion/manifest.json):300actual player frames, all three transitions, no page errors or reach clamps, exact10.310mm maximum root-height increment. The clip is encoded at30fps from every second60Hz simulated frame; it is not a performance benchmark.

## Stair contact: actual player, including transitions

Timber sides had inward triangle winding, so early downward-ray evidence missed the outer crowns. Commit `59cba21b` corrects that winding. The ground grid now includes timber, including its steep upper shoulders, while keeping stone-only sampling and analytic player heights unchanged. The existing foot planner, swing support and hip endpoint guard now check the oriented sole interior before IK. No new solver or layout change.

[Full actual-player capture](../2026-09-21T18-36-38-412Z-play-motion/manifest.json): **660 ascent + 660 descent frames**, 327 production sole vertices, **403,488 rendered-surface hits**, cross-checked against native Three.js rays. Minimum clearance **+1.182 mm ascent / +1.257 mm descent**, no negative sole samples, no reach clamps, no page errors. The capture used `305603e9`; the final `89df38f2` changes only four run rotation channels and preserves its stairs clip, rig and geometry exactly.

The [separate 940-pose CPU proof](../2026-09-21-curved-support/verification.json) preserves flat movement exactly. The corrected shoulders can lift the pelvis by one 270 mm riser over a span of steps; maximum per-frame root change remains 31.105/23.890 mm. At the former bad uphill frame331, the planted sole is 3.67 mm above real timber and the knee is 88.8°, but other phases still reach **168.26° uphill / 166.70° downhill**. Landing/posture work remains open.

Dense support costs roughly **61–63% more surface queries than the undersampled baseline** in the instrumented CPU fixture. That is an operation count, not an FPS result. The physical route passes; arbitrary terrain, sideways approaches and continuous swept collision are not proven. [Independent code review](INDEPENDENT_SUPPORT_REVIEW.md).

![Actual player at the former uphill knee peak](../2026-09-21T18-36-38-412Z-play-motion/stairs-up-331.png)

## Research and collaboration

Follow-up `e5f9365c` connects Fable-3's unchanged prop publisher (`e9a9fcdb`) to character collision. Solid props now block movement even on walkable decks. Ten raw-production CPU checks, the existing props tests, typecheck and build pass; all five stair flights and the authored walking routes stay open. This uses the existing wall policy at every height: jumping over props or standing on their tops is not implemented. [Prop contact and route evidence](../2026-09-21-prop-contact/README.md).

Additional local reviews retain the current flat-run legs: maximum sideways knee deviation is 0.435 mm, and no runtime outward-knee correction is active. Reproduced runtime stair peaks confirm that a pelvis-only rise cannot resolve both extreme folds within the other leg's reach. A fresh two-degree torso preview on the repaired arms increases native contacts from 1,316 to 1,389 and remains held. These reviews do not change the delivered GLB or declare the remaining posture problem solved.

[Johansen's locomotion thesis](https://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf) and [Holden's foot-locking implementation](https://www.theorangeduck.com/page/inverse-kinematics-foot-locking) informed separating foot trajectories, support and leg reach. [Pontzer et al.](https://scholar.harvard.edu/files/dlieberman/files/2009d.pdf) and [Arellano & Kram](https://journals.biologists.com/jeb/article/217/14/2456/12120/The-metabolic-cost-of-human-running-is-swinging) support preserving the arms' counterbalancing motion, not a universal artistic angle. Existing helpers and the already licensed Quaternius motion were reused.

Fable imported the low leafy floor moss and timber winding in `27c2e3c8`; [PR25](https://github.com/Leonxlnx/zeldaremake/pull/25) has green CI. Fable also imported the independently reviewed four-helper leaf-atlas colour recovery by `c11f0ff4`; its [PR27](https://github.com/Leonxlnx/zeldaremake/pull/27) carries source `181986ba`. All handoffs are posted to PR2. PR29 improves the three bank cores; dark patches, distant crossed cards, face/hand art and extreme stair poses remain open. No phase exit or final visual acceptance is claimed.

The optional torso and landing trials remain held: [earlier torso study](TORSO_STUDY.md). Their evidence is retained; they are not part of the delivery. Source/model provenance remains in `public/models/link/SOURCE.md`; this engineering work does not settle the fan-game's character/branding/reference-media release rights.
