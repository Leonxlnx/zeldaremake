# The giants' wood costs the same 1.36 M triangles whether a giant is 8 m away or 60 m away

Three measurements close the loop that `../lookbacks/` opened and `../shadowcost/` narrowed. The
giants' trunk geometry is the largest single line in the trees system, and it has **no distance rung
at all** — every giant is built at one resolution and drawn at it from any range.

## What it draws (head `ecaf3df7`, 960 × 540, `pose-counts.mjs --only NONE --settle 8`)

A temporary probe (`?hide=giant`, reverted — it clears `visible` on the three giant wood sector
meshes) prices what the family really draws, which the audit's static `byFamily` total cannot:

| pose | head | giants' wood hidden | what the wood draws |
| --- | --- | --- | --- |
| hero A (giants 8–20 m) | 614 draws / 8.97 M | 542 / 7.61 M | **72 draws / 1.36 M — 15 % of the frame** |
| plateau look-back (giants 20–60 m) | 745 / 11.15 M | 673 / 9.80 M | **72 draws / 1.35 M** |

The cost does not move with distance. The same 72 draws and the same 1.35–1.36 M are paid at a pose
where the giants fill the screen and at a pose where they are a bank of trunks across the village.

Two more facts already measured, so the whole picture is here:

* the static geometry is **1,508,970** triangles (`../lookbacks/`, `audit().systems.trees.submission`),
  so the per-giant group culling that round 52 installed is saving about **10 %** of it at these poses;
* the family contributes **zero** to the sun's depth pass (`../shadowcost/README.md`) — this 1.36 M is
  all colour pass.

## Why: the trunks are built to a 5 cm arc, for every giant, at build time

`giant.ts` sizes a bole's sides from its radius against a fixed arc length:

* the near base / relief bole: `sides = clamp(2πr / 0.05, 56, 200)` — "≈ 5 cm around: 6 vertices
  across each 0.3 m cord";
* the plain sweep: `sides = clamp(2πr / 0.075, 40, 120)`.

At 8 m a 5 cm arc is what the owner asked for ("highly detailed"). At 40 m it is between a quarter and
a sixth of a pixel, and we are paying 200 sides for it.

## The change this asks for, and its arithmetic

The side count is chosen **at build**, so no runtime swap and no pop is needed: a giant that never
comes within *n* metres of any hero camera or walkable line can be built to a coarser arc once. Every
giant's own distance to the six fixed cameras and to the walk routes is already known where the giants
are placed. Halving the sides on a giant halves its wood triangles, so on the evidence above:

* at the plateau look-back, where every giant in frame is 20–60 m off, the reachable saving is most of
  1.35 M — which by itself puts that pose (11.15 M) under the 9.0 M ceiling together with the
  vegetation line in `../lookbacks/`;
* at hero A the near giants keep their arc and the far ones do not, so the saving is smaller and the
  frame that matters most is the least disturbed.

**Ownership note:** the arc constants live in `src/world/trees/giant.ts`, which is not lane 2's file —
lane 2 owns the LOD and pool decisions in `trees/index.ts`. The decision "which giant is built coarse"
belongs with the placement in `index.ts`; the constant it passes belongs to whoever owns `giant.ts`.
I will propose it as a bounded change with the five fixed frames measured before and after (they must
not move: the near giants are unchanged by construction, and the far ones' silhouettes are the thing to
prove), unless that lane would rather take it.

## Method note

`?hide=<kind>` and `?nocast=<family>` were both temporary probes in `trees/index.ts`, verified in the
built bundle and reverted in the same session. Neither is proposed for merge; they exist in this
report so the numbers can be reproduced by re-adding four lines.
