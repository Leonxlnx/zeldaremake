# Round 52 — fable-4: the giants' sectors draw per giant and per crown band, and the colour pass skips the bands that are out of view (pixel-identical)

**Branch** `agent/fable-4-sectorgroups` — `src/world/trees/index.ts` (sector build, `cull()`), `src/world/trees/writer.ts` (`mergeParts` gains an optional `useGroups`).

## Why
The triangle map of A: giants 1.85 M of 8.61 M, in three merged sector meshes (each 2–4 giants, a
50 × 30 × 55 m box) drawn in both passes. A sector "frustum-culled as a unit" always meets the
frustum, so at A the south sector's four giants — all behind the camera — drew 244 K triangles in the
colour pass for no pixel, and the same again in the shadow pass (needed: their shade is on the plaza).

## What
1. `mergeParts(…, true)` keeps one geometry group per giant; each giant's group is split at its first
   leaf triangle (`aRoot.w > 0.5`; wood then leaves) and the leaves are re-sorted by centroid height
   into **two bands of equal triangle count** (the index slice is rewritten in band order). Groups:
   1 wood + 2 leaf bands per giant; the canopy cards stay one group per sector. Material arrays repeat
   the sector's material so three issues one draw per group.
2. Every group carries its exact bounding box and sphere (+1.5 m for wind), computed at build while
   the CPU arrays exist. `cull()` marks each group against the camera: `Frustum.intersectsSphere` **and**
   an exact box test — separating axes over the box's three axes, the frustum's six normals and the 18
   edge cross products against the frustum's eight corners. Three's `intersectsBox` only asks whether
   the box is wholly behind one plane; a 26 m crown starting a metre from the camera straddles two
   planes without meeting the frustum's volume, and the exact test says so.
3. `onBeforeRender` (called per group) sets an out-of-view group's `count` to 0 for the colour pass;
   `onAfterRender` restores it. The shadow maps are rendered before the scene and never call the hook,
   so every group still casts — the culled giants' shade on the plaza is unchanged.

## Why bands
A giant behind the camera has its box and sphere around the camera (13 m limbs, leaves from y 2), so
per-giant culling alone left A untouched (+36 draws for nothing at A). Its crown mass is high: the
upper band (median height and above) clears the frustum's top plane; the lower band stays.

## Measured — six views, head (`f6793736` + mainpass = today's head) vs branch, same box, `--settle 6`
| view | head draws / tris | branch draws / tris | Δ tris | Δ draws | SSIM Δ | pixels > 6 |
|---|---|---|---|---|---|---|
| A | 474 / 8.61 M | 540 / 8.46 M | **−148 K** | +66 | +0.0000 | 0 |
| B | 462 / 7.89 M | 528 / 7.63 M | −266 K | +66 | +0.0000 | 1 (wind phase) |
| C | 368 / 6.82 M | 434 / 6.46 M | −351 K | +66 | +0.0000 | 0 |
| D | 428 / 8.05 M | 494 / 7.69 M | −360 K | +66 | +0.0000 | 0 |
| E | 462 / 7.89 M | 528 / 7.63 M | −266 K | +66 | +0.0000 | 1 (wind phase) |
| F | 438 / 8.05 M | 504 / 7.74 M | −309 K | +66 | +0.0000 | 0 |

Draws stay ≤ 700 everywhere (540 at A). The steps along the way, at A: per-giant groups + `intersectsBox`
0 K; + exact SAT −76 K; + spheres −76 K; + two leaf bands **−148 K** (and −266…−360 K at B–F).

## Free-camera safety
Bounds are exact vertex bounds per group + 1.5 m; the giants' wind displaces leaves well under that.
The test is against the current camera every time it moves, so it holds for the play camera. Dials:
`GIANT_LEAF_BANDS` (2; 3 would take ~+24 draws for the middle band), `GROUP_PAD_M`.

## Verification
`npm run typecheck` green, build green, `lodPool.test.mjs` + `leaf-color.test.mjs` 19/19.
