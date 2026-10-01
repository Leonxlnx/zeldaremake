# One material where the bark is far enough away — 7 to 9 draws, and the gate that makes it safe

**2026-09-30, lane 2.** The follow-on to `woodgain/`, which measured one material per distant / mid tree mesh
at **15–17 draws** across the six fixed views and then failed its gate: inside `DISTANT_BARK_M` [22, 38] m a
mid bole lost `mats.distant`'s near bark treatment and read as a flat grey cylinder. That round priced two
ways forward and this is option (a), the one that stays in lane 2's files.

> **For fable-cursor:** this is **PR #213**, `cursor/squad2-matswap-682b`, based on
> `cursor/squad2-treephases-682b` (PR #210) — merge that one first. A cost change with the pixels measured at
> all six fixed views and the gate's safety property under test; `TREE_ONE_MATERIAL_FAR` in `distant.ts` is the
> one line back. (`ManagePullRequest` accepted a PR this round, after refusing with `must be a collaborator`
> every round since 09-27, so the earlier branches' missing PRs can now be opened — `woodgain/` is **PR #214**.)

## What it does

A distant / mid mesh's geometry carries two groups — wood, then crown cards — and three draws one call per
visible material group, so `[mats.distant, crown]` is two draws a mesh. The crown material can draw bark as
well as cards (`markWood`'s `aWood` flag, and `woodgain/`'s wood branch), and where it does, the mesh is one
draw instead of two.

It is only *correct* to do that where `mats.distant` is doing nothing to bark that the crown material cannot
reproduce. Every term of its near bark treatment — the cylindrical bark map, the patch tone bands, the cord
stripe, the furrow darkening, the shade floor — is scaled by
`1 - smoothstep(DISTANT_BARK_M[0], [1], length(vViewPosition))`, which is **exactly zero past 38 m**. So the
gate is per mesh, per frame: if its nearest bark fragment is past the window, one material; otherwise both.

## What it is worth, measured

Six fixed views, `frozen.mjs`, clock frozen, `TREE_ONE_MATERIAL_FAR` off against on, both builds launched
together:

| view | draws | Δ | triangles | changed share of the frame | worst cell of 64 |
|---|---|---|---|---|---|
| A_stairs | 555 → **547** | −8 | 8 724 803 → 8 724 803 | 0.05 % | 2.8 % @ 7.3 levels |
| B_house | 537 → **528** | −9 | 7 971 464 → 7 971 464 | 0.05 % | 2.6 % @ 7.0 |
| C_lookback | 474 → **467** | −7 | 7 683 890 → 7 683 890 | 0.01 % | 0.4 % @ 4.9 |
| D_log | 462 → **454** | −8 | 8 258 565 → 8 258 565 | 0.03 % | 1.1 % @ 6.2 |
| E_ground | 537 → **529** | −8 | 7 971 464 → 7 971 464 | 0.05 % | 2.7 % @ 7.3 |
| **F_canopy** | 495 → **488** | −7 | 7 819 365 → 7 819 365 | **0.00 %** | 0.0 % |

**Not one triangle moves at any view**, and the trees' own audit row falls by exactly the frame's delta.

**F_canopy is the result that decides the round.** It is the view `woodgain/` failed at — 0.44 % of the frame
with a visibly flat grey bole — and under the gate it is **0.00 %**, because the mesh that bole belongs to is
the mid family's near rung, which the gate never swaps (it stands 14.3–32.2 m from the six cameras).

The views that do move are moving by nothing visible. Their worst cell is the same one at A_stairs, B_house
and E_ground, and at 8× the two frames are indistinguishable — the hazy distant trunks are all present and
unchanged, max 18–19 levels on a handful of pixels:

`B_house-cell-8x.png`, `A_stairs-cell-8x.png`.

What remains at 0.01–0.05 % is the one difference the gate cannot remove: with one material the wood is
submitted in the **transparent** pass with the cards instead of the opaque pass on its own, which moves the
silhouette's anti-aliasing seam against the haze behind it. It is zero at three of six views under the
conservative gate below, so it is a seam and not a shading change.

## Cost and behaviour on the branch

`gauntlet/scripts/pose-counts.mjs`, the gauntlet's own tool, agrees with the paired run to the draw:

| | A_stairs | B_house | C_lookback | D_log | E_ground | F_canopy |
|---|---|---|---|---|---|---|
| draws | **547** | 528 | 467 | 454 | 529 | 488 |
| triangles | 8.72 M | 7.97 M | 7.68 M | 8.26 M | 7.97 M | 7.82 M |

W38 wants hero views under 700 draws and 9 M triangles; A_stairs now has **153 draws** of headroom, up from
145. The triangle line still binds and the swap does not move it.

`gauntlet/scripts/playtest.mjs --only look,walk,perf`: **11 / 11 walk routes reached, 0 stuck events, 0 page
errors**, ten look spots visited. Its four perf poses read plaza **513 / 7 655 520**, the flight's foot
**521 / 9 153 883**, saria-side **496 / 8 585 962**, west-house **400 / 4 888 821** — the first play figures
for this change, and worth 6–11 draws against the rows this lane last recorded, though those came from runs
before the canopy merge so it is not a paired comparison and the triangle columns are not comparable.

The walk is the part that matters for the gate: the swap happens under a moving camera, and a route is where a
mesh crosses 38–40 m. Nothing stuck, nothing threw.

`tsc --noEmit` green, `vite build` green, `node --test` **278 / 278** (274 before, plus this round's four
cases). The refactor that moved the rule into `lodFade.ts` was proved behaviour-identical rather than assumed:
a one-pose paired run of both builds gives A_stairs 547 / 8 724 803, trees 132 / 2 656 692, md5 `5b5db2f2` on
both sides.

## The gate was measured before it was built, and the first version of it was too timid

`barkwindow.mjs` reads a new report-only trees audit field, `barkWindow`: per distant / mid mesh, how far its
nearest bark fragment stands from the camera, and how many of the sixteen have every fragment past 38 m. That
is the ceiling on the safe share of the 15–17 draws, per pose, and it cost one Chrome run rather than a build
and a paired render.

**Round one asked the wrong sphere.** Using the geometry's own bounding sphere, the ceiling read A 7, B 5,
C 6, D 3, E 5, F 4, and the swap measured −5, −4, −5, −2, −4, −4 — with **three of the six views
byte-identical** (B_house, D_log, E_ground) and A_stairs at 0.05 %. Correct, and needlessly conservative: a
distant tree's crown cards reach `crownR` out in every direction, so the full sphere puts the tree's nearest
point some ten metres in front of a bole a few decimetres wide, and disqualified meshes whose bark was
comfortably past the window.

**Round two asks the wood's own sphere.** `markWood` now records the bounding sphere of the wood vertices
alone — it already knew where they end, because that is how it writes the `aWood` flag — and the gate asks how
far *that* is. The ceiling roughly doubles and the draws follow:

| | A_stairs | B_house | C_lookback | D_log | E_ground | F_canopy |
|---|---|---|---|---|---|---|
| meshes past the window, whole-tree sphere | 7 | 5 | 6 | 3 | 5 | 4 |
| meshes past the window, **wood sphere** | **10** | **10** | **7** | **8** | **10** | **7** |
| draws saved, whole-tree sphere | −5 | −4 | −5 | −2 | −4 | −4 |
| draws saved, **wood sphere** | **−8** | **−9** | **−7** | **−8** | **−8** | **−7** |

The saved draws come in 1–3 under the ceiling at each pose because the hysteresis band keeps a mesh between
38 and 40 m on both materials.

## The rule, and the property under test

`lodFade.ts oneMaterialWanted(isOne, nearestBarkM, leaveM, enterM)` — extracted there because that file has no
imports and its test transpiles it directly, the same reason `lodWeightKey` was extracted. Four test cases in `lodFade.test.mjs`, 43 executed assertions, and the first is the one that matters:

* **bark inside the window never draws on one material**, from either state. That is the property the
  unconditional version violated and the reason F_canopy went flat.
* below the far edge, never one; between the edge and the margin, keep state; at or past the margin, always
  one — hysteresis, not a threshold, so a mesh drifting across the edge does not change material every frame.
* a mesh with nothing submitted keeps its state rather than flipping on re-entry.
* the margin is at least four frames of walking at 4 m/s.

The margin costs 1–3 draws a pose and buys the absence of a per-frame discontinuity. This lane spent four
rounds removing the LOD rungs' one-frame pop; it is not going to introduce a new one to save a draw.

## What this corrects in the previous round's write-up

`woodgain/`'s code comment and README said, of the six fixed views, that `mats.distant`'s bark treatments *"all
sit inside the DISTANT_BARK_M [22, 38] m near blend, which is exactly zero at every fixed camera's range to a
depth row — so at those views there is nothing to reproduce."* **That is wrong, and it is why the round could
not explain its own failure without a second measurement.** The clause came from `materials.ts`, whose comment
reasons about the **depth rows** of the *distant* family (*"the nearest depth row stands 43 m from camera D, the
radial pool 51 m from A"*), and I applied it to the *mid* family as well. The mid family's near rung stands
**14.3–32.2 m** from the six cameras — squarely inside the window — which is exactly where F_canopy's bole is.

One thing this round deliberately does **not** claim. The whole-tree-sphere numbers put a distant tree's
nearest point inside the window at four of the six views, which looks like a contradiction of `materials.ts`'s
comment. It is not: that lower bound is over the whole tree, and the nearest point of the sphere is a crown
card, not bark. The wood sphere puts the same meshes' bark at 44.9–70.2 m, comfortably past the window and
consistent with the comment. **`materials.ts` is right; the conservative test was simply measuring something
else**, which is the correct direction for a safety gate to be wrong in.

## Files

| file | what it is |
|---|---|
| `barkwindow.mjs` | the probe: `barkWindow` at each pose, per mesh, with the ceiling it implies |
| `barkwindow-ceiling.log` | its output on the whole-tree sphere (the first, timid gate) |
| `counts-both-materials.json` | the six views with the flag off |
| `counts-gated-fullsphere.json` | the whole-tree-sphere gate: −2…−5 draws, three views byte-identical |
| `counts-gated-woodsphere.json` | the shipped gate: −7…−9 draws |
| `A_stairs-cell-8x.png`, `B_house-cell-8x.png` | the worst cell of the two worst views at 8× — indistinguishable |
| `A_stairs-diff.jpg` … | the three-panel diff sheets |
