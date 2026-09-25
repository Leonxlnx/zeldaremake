
# Two views a climbing player gets are 25 % over the triangle ceiling

W38's gate (≤ 700 draws, ≤ 9.0 M triangles) is measured at the six fixed cameras and, since
`../playcost/`, at the play camera's standing spots. Nobody had counted the views a player gets
**after climbing** — the plateau and the ledge, looking back along the world's long axis. Both are
over, and one is over on draws as well.

## The counts (`pose-counts.mjs`, head `905d55ea`, 960 × 540)

| pose | draws | triangles |
| --- | --- | --- |
| plateau, looking north over the village (17.2, 7.1, −12) | 484 | 6.62 M |
| **plateau, looking back south (17.0, 7.1, −15)** | **745** | **11.15 M** |
| **the ledge top, looking back south (1.42, 7.3, −75.5)** | 673 | **11.23 M** |
| *hero A, for scale* | 614 | 8.97 M |

The plateau look-back is over both ceilings (+6 % draws, +24 % triangles); the ledge look-back is
over the triangle ceiling by 25 % with draws in hand. Looking the other way from the same plateau
spot is comfortable at 484 / 6.62 M — it is the long axis that costs.

## Who owns it (`playcost.mjs` at the plateau look-back)

| system | plateau look-back | hero A | difference |
| --- | --- | --- | --- |
| **vegetation** | **3.749 M** (164 draws) | 2.455 M | **+1.294 M** |
| trees | 3.146 M (186 draws) | 2.972 M | +0.174 M |
| structures | 2.291 M (169 draws) | 2.008 M | +0.283 M |
| terrain | 0.777 M (39) | 0.628 M | +0.149 M |
| rocks | 0.503 M (36) | 0.232 M | +0.271 M |
| hardscape | 0.529 M (21) | 0.525 M | +0.004 M |
| character | 0.211 M (**95 draws**) | 0.178 M | +0.033 M |
| props | 0.110 M (20) | 0.098 M | +0.012 M |

Same story as the play spots: of the 2.19 M the frame gains over hero A, **vegetation is 1.29 M
(59 %)** and trees are 0.17 M (8 %). For the draw ceiling the biggest lines are trees 186,
structures 169, vegetation 164 and character 95 — the character's 95 draws for 2 % of the triangles
is the most lopsided line in the frame.

## Inside the trees, from the system's own audit (`treeaudit.mjs`, new tool)

`isolate()` stops at the top-level system, so this reads `audit().systems.trees.submission.byFamily`
— the geometry each family submits (a static accounting, not the frustum-culled subset):

| family | triangles | calls | instances |
| --- | --- | --- | --- |
| **giant-wood** | **1,508,970** | 6 | 3 |
| column-lod0 | 650,873 | 17 | 10 |
| giant-authored-leaves | 286,692 | 3 | 4 |
| column-near-base | 158,246 | 5 | 4 |
| giant-near-base | 113,843 | 3 | 2 |
| whitebark-lod1 / lod2 | 76,043 / 73,467 | 4 / 10 | 5 / 28 |
| mid-far, mid-near, distant-far | 23,157 / 16,625 / 4,800 | 5 / 5 / 5 | 117 / 32 / 200 |

Two things worth the squad's attention:

* **`giant-wood` is the largest single geometry in the trees system by a factor of two**, and its
  1,508,970 triangles read identically at hero A, at the plateau look-back and at the ledge look-back
  — it is a static total, and the three sector meshes already carry per-giant group culling for the
  colour pass (round 52, `installGroupCulling`). What that culling does **not** cover is the shadow
  pass: the comment at `giants-sector-*` states every group is drawn to the sun's depth map from
  every camera. So the colour pass is already frugal here while the depth pass pays for all of it.
  Whether that is worth a coarse far rung for a giant's wood is the next measurement — it needs the
  shadow pass counted separately, which `stats()` does not split today.
* The **mid and distant layers are cheap**: 305 instances of `mid-far` cost 60 K triangles at the
  ledge look and 200 `distant-far` instances cost 4.8 K. The distance layers are not where the
  triangles are; the near families are.

## What this asks of whom

* **Vegetation (lane 3):** the 1.29 M it gains at an elevated long view is the same line that puts
  the play spots over the ceiling (`../playcost/`). An elevated camera sees the ground cover it would
  otherwise look over.
* **Whoever owns the draw ceiling:** 745 draws at the plateau look-back, with the character system
  spending 95 of them for 0.2 M triangles.
* **Lane 2 (mine):** the giant-wood depth-pass question above, and nothing in the distance layers,
  which measure cheap.
