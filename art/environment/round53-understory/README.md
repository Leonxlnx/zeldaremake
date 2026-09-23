# Round 53 — fable-4, lane 2: understory trees ("the trees do not populate", owner 2026-09-23 06:50)

**Branch** `agent/fable-4-understory` — `src/world/trees/understory.ts` (new), `src/world/trees/index.ts`.

## The defect
The owner's marked screenshot: play camera at rest on the north path looking north from the plaza's north
end. Circle 2: the middle distance over the path is grey haze with pale bare trunks. His reference
(`reference/frames-dense/review46/r_020–r_028`, `reference-review46-r020-r028.jpg`): small and medium
trees with round leafy crowns at every depth beside the path, layered in soft mist. Our clearing had the
tall white-barks (crowns 15–26 m up, thinned at distance) and the giants, and nothing at 3–10 m height
between them: the band at eye level 15–40 m out was empty.

## What landed
- `createUnderstoryTree`: 4.5–9 m trees — a leaning brown stem and 4–6 limbs (the giant bark material,
  `tube` with crevice shade), a round ellipsoid crown of dense laminae (a golden-spiral shell with the
  lowest 30 % open for an underside, plus an inner fill), lit rim / shaded core through `leafShade`, three
  LODs through the white-barks' `addLeaf` retention. Five seeded variants spread 4.5 → 8.5 m.
- Placement from its own stream (`rng.fork('understory')` — no other placement re-rolls): zones = the
  north path's verges from the plaza's north end to the arch, the north clearing beyond the arch, the
  plaza's east and west lawn edges. Rules: 3.4–11 m off the path centreline (6.5 m minimum on the stretch
  nearest the arch, z < −28, so D's window onto the arch opening stays readable), off paths / stairs /
  structures / cliffs / slopes > 0.55, `expansionCull`, ≥ 7 m from every fixed camera, clear of column
  seats, giants (2.5 × trunk radius + 2.5 m) and white-barks (2.6 m), 3.2 m spacing, F's canopy gap
  (`VIEW_GAPS`) honoured. **34 trees.**
- Rendered through the family pipeline (`familyMeshes` / `bucketFamily` / `submitFamily`, so the
  colour-pass culling applies); `slimTrunks` for the camera's collision; audit `understoryInstances`,
  `understoryLodInstances`.

## Before / after at the owner's pose
`owner-northpath-rest-before-after.jpg` (the rest camera: Link at (1.5, −14), camera 4.3 m behind at
1.75 m) and `owner-northpath-far-before-after.jpg` (the same spot, camera level): the grey band is layered
leafy crowns on both verges, receding into the mist; the arch stays visible between them.

## Six views (head `f56c5740` vs branch, same box, `--settle 6`) — an owner-directed look change
| view | head SSIM | branch Δ | draws / tris head → branch |
|---|---|---|---|
| A | 0.2244 | **+0.0019** | 545 / 8.54 M → 563 / 8.57 M |
| B | 0.1963 | **+0.0027** | 533 / 7.70 M → 555 / 7.74 M |
| C | 0.2046 | **+0.0046** | 434 / 6.47 M → 441 / 6.49 M |
| D | 0.2665 | −0.0033 | 499 / 7.74 M → 524 / 7.81 M |
| E | 0.2189 | −0.0023 | 533 / 7.70 M → 555 / 7.74 M |
| F | 0.2250 | −0.0007 | 507 / 7.79 M → 518 / 7.82 M |

A 8.57 M, 430 K under W38; draws ≤ 563. Three views move toward the reference, D/E/F away by less than
the reference's own tree layering at D would suggest (`D-head-vs-understory.jpg`: the path is tree-lined
as in frame 56 s, the arch's log visible between the crowns).

Two variants measured on the way: 44 trees with a 3.4 m verge everywhere — D −0.0094, E −0.0051,
F −0.0050 (the arch hidden); a D screen window protecting the arch opening — 48 → 16 trees, the corridor
empty. The 6.5 m verge on the arch stretch keeps both.

## Verification
`npm run typecheck` green, build green, 19/19 tree tests, no system failures in the audit.

## Postscript — the west fork (fable-3, 11:20: "the new understory hides the fork marker from the plaza side")
`UNDERSTORY_CLEARINGS`: no understory within 8.5 m of (−10.5, 8.5), the fork's inner corner; 44 → 32
trees. At fable-3's pose ((−6.4, 1.9, 6.6) → (−9.6, 2.6, 9.4)) my tree on the fork's left is gone
(`fork-plaza-side_head_vs_clearing.jpg`), but the **dark dome on the inner corner itself stays: it is a
vegetation bush**, not a tree — hide-one-group over the fork region (`fork-attrib_base_no-vegetation_no-giants.jpg`):
`vegetation` 58.6 % of the region, `trees` 64.6 % of which giants 29.1 % (the limb above), distant 19.5 %,
**understory 12.4 %**, white-bark 5.2 %. So the fork reading as "the path splits off into the forest" is
lane 4's bush to open (or the marker's spot, fable-3's call); the understory now stays out of that corner.
