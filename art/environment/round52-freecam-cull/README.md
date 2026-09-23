# Round 52 — fable-4: the two colour-pass culls under the free camera (owner rubric rows 28 / 46)

`mainpass` (in-view family instances only) and `sectorgroups` (giants per giant and crown band, exact
box + sphere) are pixel-identical at the six fixed views by measurement. The play camera looks up and
sideways where the bounds are exercised, so: head `f56c5740` vs the same head with **every colour-pass
cull disabled** (hull test true, main count = full, every group marked in view), eight seated / owner
poses, frozen clock, 896×776.

| pose | head draws / tris | no-cull draws / tris | saved | pixels > 6 |
|---|---|---|---|---|
| `u-open-up` (owner, 60° up over the arch) | 185 / 2.80 M | 188 / 3.35 M | **−16 %** | 0 |
| `u-plaza-up` (owner) | 268 / 4.69 M | 273 / 5.09 M | −8 % | 6 (one 2×3 leaf edge) |
| `u-stairs-up` (owner) | 346 / 6.50 M | 347 / 6.86 M | −5 % | 4 |
| `up-wb7-hero` (55° up under the hero white-bark) | 230 / 3.32 M | 232 / 3.70 M | −10 % | 10 (a 3×3 leaf edge + 5 scattered) |
| `up-knoll-large` | 60 / 0.66 M | 62 / 0.75 M | −12 % | 0 |
| `edge-beside-hero` (the hero just past the left edge) | 428 / 6.10 M | 429 / 6.66 M | −8 % | 5 |
| `edge-plaza-south-look-N` (four giants behind) | 561 / 9.02 M | 563 / 9.26 M | −3 % | 2 |
| `edge-under-plateau-oak-look-E` | 335 / 4.54 M | 338 / 4.96 M | −8 % | 0 |

The differing pixels are 2–3 px clusters at leaf edges with 7–49 level changes — rasterization order on
coincident thin edges when fewer triangles are drawn — never a missing leaf, band or shadow. So the culls
hold under the free camera as under the fixed one (row 28), and they take 3–16 % off the play poses'
triangle counts, most where the camera looks up (row 46's pacing on a real GPU).

The no-cull build is a three-line scratch patch (not committed): `hullInView` → true, `mainCount` =
full, `markGroups` → all true.
