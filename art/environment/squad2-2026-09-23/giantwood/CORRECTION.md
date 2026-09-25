# Correction: the giants' trunk arc is already distance-gated, so coarsening it would not pay

`README.md` in this directory measures the giants' wood at **1.36 M triangles / 72 draws at hero A**
(15 % of the frame) and the same 1.35 M at the plateau look-back, and proposed the obvious next step:
build a giant that never comes near a camera to a coarser arc. Reading the builder before writing that
change shows the proposal was aimed at the wrong term, so this records the correction rather than
leaving it standing.

## What the trunk actually costs, and what already gates it

`giant.ts` has two trunk paths, not one:

* **the relief bole** — `sides = clamp(2πr / 0.075, 40, 120)`, ring spacing 0.22 m, taken only when
  `nearBole` is true;
* **the plain sweep** — `tube(wood, trunk, trunkRadii, 30, …)`, i.e. a flat **30 sides**, for every
  other giant.

And `nearBole` is already a hero-distance decision made in lane 2's own file: `index.ts` passes
`heroDistance` per giant, computed as the nearest of the six fixed cameras that has the giant inside
its forward cone (`fx·dx + fz·dz ≥ 0.5 · |f| · d`), and the relief bark goes on only within
`NEAR_BOLE_M` of one. The comment there records why: the south giants are 13–23 m from A and F but
65–120° off axis, and giving them relief measured −0.013 SSIM.

The 5 cm arc I quoted in `README.md` (`clamp(2πr / 0.05, 56, 200)`) is the **near base** — the part
below `NEAR_BASE_CUT_Y` that the pool draws only within `NEAR_BASE_IN_M` of the camera. It is already
the most tightly gated geometry in the system.

So the trunk's expensive term is distance-gated twice over, and the 1.36 M the family draws is mostly
the crown's woody structure — limbs, boughs, buttress roots — which is not what a coarser arc touches.

## What would be needed to go further

A per-part triangle count inside a giant's wood. The audit reports the family total
(`submission.byFamily.giant-wood.triangles`), the bark's own total (`bark.triangles`), the near base's
(`nearBaseAudit.triangles`) and a per-bough row (`boughDress[]`), but nothing that adds up to "trunk
versus limbs versus roots" for the merged sector meshes, and the sector meshes' per-giant geometry
groups cannot be toggled from the capture API. Until that exists, any rung proposal for this family is
a guess about which part is heavy.

That measurement belongs with whoever owns `giant.ts`, and it is cheap there: the builder already
knows the triangle count of each part as it writes it. Lane 2's part — the decision of which giant is
built how, from `heroDistance` — is in place and working.

## What still stands from README.md

* the family draws 1.36 M at hero A and 1.35 M at the plateau look-back — **flat with distance**, and
  15 % / 12 % of those frames;
* the static geometry is 1,508,970 triangles, so round 52's per-giant group culling recovers ~10 %;
* the family contributes **zero** to the sun's depth pass.
