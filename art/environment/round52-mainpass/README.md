# Round 52 — fable-4: the colour pass draws only the tree instances that are in view (W38 give-back, pixel-identical)

**Branch** `agent/fable-4-mainpass` (one file: `src/world/trees/index.ts`, the family submit path).

## Why
A triangle map of A on the head `f6793736` (hide one scene group at a time, read `stats().triangles`):
trees 3.03 M of 8.76 M — giants 2.07 M, **white-bark 0.52 M**, columns 0.35 M, distant 0.11 M; vegetation
1.96 M, structures 1.93 M, hardscape 0.75 M, terrain 0.60 M. Inside white-bark, **402 K was one mesh**:
`whitebark-wb-7-…-high`, two instances of the largest variant's high LOD (100.6 K triangles each) in the
colour pass and the shadow pass, plus `wb-4-…-high` at 106 K. All three stand **behind camera A** — 99°,
130° and 138° off the view axis at 8.9–17.3 m — and draw no pixel; they are submitted because their shadows
reach the frame (`casts && shadowReaches`), and the colour pass drew them along with the shadow pass.

## What
1. `submitFamily` now splits the kept instances into *in view* and *shadow-only*; `fillFamily` packs the
   in-view ones first and records their count. `onBeforeRender` shrinks the InstancedMesh `count` to the
   in-view instances for the colour pass and `onAfterRender` restores it. Three renders the shadow maps
   before the scene and never calls `onBeforeRender` from the shadow pass, so every kept instance still
   casts. (v1: A −100 K, pixel-identical.)
2. The in-view test was the geometry's one bounding sphere + 4 m pad — for a 20 m tree 9 m behind the
   camera that sphere swallows the camera. Each LOD now also carries a **hull of three spheres** (the crown
   from the leaf vertices, `aRoot.w > 0.5`; the wood split at its mid-height), computed at mesh creation
   while the CPU arrays exist. The hull is outside a frustum plane iff every sphere is — exact for the
   convex hull of spheres, and far tighter for a tall thin tree. Pad 1.5 m for wind sway. An instance the
   coarse sphere admits but the hull rejects goes to shadow-only if it casts and its shadow reaches, else
   it is dropped. Applies to both families on this path (white-barks and the seated columns).

## Measured — six views, head `f6793736` vs branch (same box, `--settle 6`)
| view | head draws / tris | branch draws / tris | Δ tris | SSIM Δ | pixels > 6 |
|---|---|---|---|---|---|
| A | 476 / 8.76 M | 474 / 8.61 M | **−150 K** | +0.0000 | 0 |
| B | 464 / 7.94 M | 462 / 7.89 M | −50 K | +0.0000 | 0 |
| C | 369 / 6.87 M | 368 / 6.82 M | −50 K | +0.0000 | 0 |
| D | 430 / 8.11 M | 428 / 8.05 M | −60 K | +0.0000 | 0 |
| E | 464 / 7.94 M | 462 / 7.89 M | −50 K | +0.0000 | 1 |
| F | 442 / 8.18 M | 438 / 8.05 M | −130 K | +0.0000 | 0 |

Pixel-identical at all six (the one E pixel is wind phase). The shadows of the culled instances are
unchanged by construction — the shadow pass sees the full count. A after this: 8.61 M, 390 K under W38
with Astra's admission in (fable-cursor's take box read A 8.78 M before the admission; her native 8.87 M).

## Free-camera safety
The hull is exact vertex bounds per LOD + 1.5 m; the wind shader's displacement at a white-bark's top is
well under 1 m. The test is per instance against the current camera's frustum, so it holds for the play /
free camera as for the fixed six. If a popping edge instance is ever seen, `HULL_PAD_M` is the dial.

## Verification
`npm run typecheck` green, build green, `lodPool.test.mjs` 16/16. Scratch tools (not committed): the
triangle map (`_f4trimap`), the per-mesh map inside a group (`_f4trimesh`), the instance locator (`_f4wb7`).
