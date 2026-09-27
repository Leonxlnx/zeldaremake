# How many frames a pose needs before it stops changing — and whose pools they are

Lane 2, 2026-09-27. Branch `cursor/squad2-treephases-682b`, PR #210.

Last round I noticed that the flight's-foot pose reads **545 draws / 9 129 877** when a run goes
straight to it and **544 / 9 129 709** when the run visits the six fixed views first, and wrote it
down as a harness note. This round asks why, because the near LOD pools are lane 2's and the
documented contract for them is explicit: "With `reset` (an explicit re-pose) the state is recomputed
from the distances alone — so a capture's frame never depends on where the camera was before."

## 1. The frame is still moving at frame 12

`setPose` to the foot, then render and read after 1, 2, 4 … 48 frames (960×540, `--settle 6` is what
the take path and this loop's own instructions use):

| frames | draws / triangles | near bases shown | near canopy shown |
| --- | --- | --- | --- |
| 1 | 545 / 9 129 877 | 6 | 79 |
| 2 | 545 / 9 129 877 | 6 | 79 |
| 4 | 545 / 9 129 877 | 6 | 79 |
| **6** | **545 / 9 129 877** | 6 | 79 |
| 8 | 545 / 9 129 877 | 6 | 79 |
| 12 | 545 / 9 129 877 | 6 | 79 |
| **16** | **544 / 9 129 709** | 6 | 79 |
| 24 / 32 / 48 | 544 / 9 129 709 | 6 | 79 |

So a capture taken at `--settle 6` at this pose is **not** the frame the same pose settles to: one
draw and 168 triangles arrive around frame 13–16. At the owner's 06:50 north pose the frame is final
from frame 1, so it is pose-dependent. This is the whole of the discrepancy I saw between harnesses:
one of them had already spent frames elsewhere.

## 2. It is not the trees

Repeating it with the trees' own submission alongside the frame's totals:

| frames | frame | trees' submission | canopy pool `pinnedPending` / `pending` |
| --- | --- | --- | --- |
| 1 | 545 / 9 129 877 | 75 / 3 185 585 | 0 / 17 |
| 6 | 545 / 9 129 877 | 75 / 3 185 585 | 0 / 16 |
| 15 | 545 / 9 129 877 | 75 / 3 185 585 | 0 / 13 |
| 16 | **544 / 9 129 709** | **75 / 3 185 585** | 0 / 12 |
| 22 | 544 / 9 129 709 | 75 / 3 185 585 | 0 / 10 |

**The trees' row never moves** — 75 draws and 3 185 585 triangles from the first frame to the
twenty-second — so this lane's pools do honour their contract, measured rather than asserted. The
`reset` path pins every candidate before filtering by residency and a pin that is not resident is
built synchronously, which is exactly what that invariant requires. The late arrival at frame 16
belongs to another system's own warm-up.

For the squad, two things follow. A before/after comparison must be taken **within one harness** (the
tables in `depthfoot/` all are), and a pose whose frame is still moving at frame 6 will differ by a
draw or two between two runs of the same build at `--settle 6` — worth knowing before attributing
such a difference to a change.

## 3. `pending` is the wrong signal, and the right one is now reported

The obvious thing to wait on is the pool's `pending`, and it is the wrong number: it counts the
**pre-fetch radius** (wanted, not built), which stays busy long after the frame is final — 17 at the
first frame here, still 10 at frame 22, and 31 → 6 over 48 frames at the north pose. A harness that
waited for `pending === 0` would wait a minute for nothing.

What a harness actually needs is "is anything I am **drawing** not built yet", so `PoolReport` now
carries **`pinnedPending`**: of the items this frame pinned — the parts actually shown — how many are
not built. It reads **0 in every frame measured above, at both pools**, which is the invariant's
runtime check: a shown part is never drawn unbuilt, so there is no near-part warm-up to wait for. If
a future change ever lets a pinned part draw before its geometry lands, this is the number that says
so, and `lodPool.test.mjs` pins the distinction (a pinned part is built before the frame draws, while
the pre-fetch behind it is still busy).

## Files

- `settle-foot-north.json` — §1, the frame at 1 … 48 frames at both poses with the pool reports.
- `settle-trees.json` — §2, the per-frame run with the trees' own submission and `pinnedPending`.
- `settle.mjs`, `settle2.mjs` — the two probes.
