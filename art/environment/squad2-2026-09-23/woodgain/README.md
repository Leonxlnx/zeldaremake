# The six-view gate on "one material for the distant and mid trees" — and what it caught

**2026-09-30, lane 2.** Round five of `onemat/`. The previous round left the one-material change on the
branch with an explicit gate: *"It is on the branch and I am not calling it shippable… only two poses are
measured. The gate is the six fixed views' pixels."* This is that gate. It **fails**, at F_canopy, for a
reason no earlier round had found — and finding it cost one more measured mechanism and one real fix.

> **For fable-cursor.** Nothing here needs merging by itself, and `cursor/squad2-woodgain-682b` **must not be
> merged** — it is the failed attempt, kept so that whoever picks up either proposal starts from measured
> ground. `ManagePullRequest` still refuses to open a PR for it (`must be a collaborator`), so **please open
> one, or just read this file on that branch**; its tip is `92274e54` and it is green (`tsc`, `vite build`,
> 274 / 274). `cursor/squad2-treephases-682b` (PR #210) has the attempt **reverted**, and its rebuilt bundle is
> byte-identical to the build whose six-view frames are in `counts-before.json`, so it is safe to merge. The
> proposal at the end needs a yes before it is built, because option (b) refactors `materials.ts`.

## What the change was, and what it is worth

One `InstancedMesh` material instead of a two-element array for every distant and mid tree mesh. Each
geometry still carries its two groups (wood, then cards), and three ignores groups when the material is not
an array — so one draw per mesh instead of two. The crown material tells bark from cards by a one-float
`aWood` attribute (`markWood`) and skips every crown treatment for bark.

Measured at the six fixed views, `frozen.mjs`, clock frozen, both builds launched together:

| view | draws before → after | Δ | triangles | trees' row |
|---|---|---|---|---|
| A_stairs | 555 → **539** | −16 | 8 724 803 → 8 724 803 | 140 → 124 |
| B_house | 537 → **521** | −16 | 7 971 464 → 7 971 464 | 129 → 113 |
| C_lookback | 474 → **459** | −15 | 7 683 890 → 7 683 890 | 115 → 100 |
| D_log | 462 → **445** | −17 | 8 258 565 → 8 258 565 | 138 → 121 |
| E_ground | 537 → **521** | −16 | 7 971 464 → 7 971 464 | 129 → 113 |
| F_canopy | 495 → **480** | −15 | 7 819 365 → 7 819 365 | 123 → 108 |

**15–17 draws at every fixed view, and not one triangle either way** — the saving is entirely the second
submission of geometry that was already being drawn. The trees' own row falls by exactly the frame's delta,
so nothing else moved.

## Why it still fails

The pixels. 0.10–0.44 % of each frame changed by more than 2 levels, which sounds like nothing and is not:
this lane's own standing rule is that a small changed share is not a small change. Two cheap classifiers
said where to look before any magnification:

* **By hue, in the before frame:** bark 54–89 % of the changed pixels, leaves 1–6 %. The crowns were
  untouched — the gates work — and everything that moved was trunk.
* **By local gradient:** 43–59 % of the changed pixels sit on a silhouette, the rest in a trunk's interior
  at mean 4.6–7.4 levels. So it was not only an anti-aliasing seam; **trunk interiors were shaded
  differently**, and that had to be explained before the change could ship.

Magnified at 8×, F_canopy says it plainly. The mid bole left of centre is warm, modelled bark in the
two-material build and a flat grey-olive cylinder in the one-material build:

`F_canopy-trunk-8x-row14.png` — left: two materials. Right: one material.

That is exactly the regression rounds 44–47 of the distant material were written to fix ("the depth rows'
boles 15–30 m from a walker read as pale cylinders").

## The mechanism, in two parts

**Part one, and this one is fixed:** `DISTANT_NEAR_GAIN`. The geometry writes bark at **4×** the far tint
so that close up the bark map, the tone bands and the cords have albedo to work with, tags it
`aRoot.w = −0.45`, and `mats.distant` **divides the 4× back out** in `<color_fragment>` wherever the
`DISTANT_BARK_M` [22, 38] m blend is zero:

```glsl
if (vDistBark > 0.5) diffuseColor.rgb *= mix(1.0 / 4.0, 1.0, near);
```

One material meant nobody divided. The crown material now applies the same line on the same window against
the same `aRoot.w < −0.2` test. `DISTANT_BARK_M` moved to `distant.ts` (which `materials.ts` already imports
from) and is re-exported, so the window is not duplicated; `mats.distant` reads `DISTANT_WOOD_ROUGHNESS` for
the same reason.

**Part two, and this one is the blocker:** inside the blend the gain is deliberately **kept**, because
`mats.distant`'s near bark treatment is what consumes it — the cylindrical bark map on the bole's own axis,
the patch tone bands on each tree's phase, the cord stripe, the furrow darkening, and the shade floor on the
side away from the sun. The crown material carries none of it. F_canopy's bole stands in the middle of that
window, so it gets the 4× scaled by the blend and none of the treatment that the 4× exists for: a flat
cylinder at roughly the right luminance and none of the right structure.

## What each fix was worth, measured

Three paired six-view runs against the same before build. Changed share of the frame, and the worst diff
cell of eight by eight:

| view | row 14 alone | + roughness + leaf gate | + the gain division |
|---|---|---|---|
| A_stairs | 0.26 % — 9.0 % @ 5.2 | 0.26 % — 9.0 % @ 5.2 | **0.22 %** — 8.3 % @ 5.7 |
| B_house | 0.10 % — 2.6 % @ 7.0 | 0.10 % — 2.6 % @ 7.0 | 0.10 % — 2.6 % @ 7.0 |
| C_lookback | 0.36 % — 12.9 % @ 4.8 | 0.36 % — 12.9 % @ 4.8 | **0.04 %** — 0.9 % @ 8.8 |
| D_log | 0.28 % — 5.2 % @ 3.5 | 0.28 % — 5.2 % @ 3.5 | **0.17 %** — 4.0 % @ 7.3 |
| E_ground | 0.10 % — 2.7 % @ 7.3 | 0.10 % — 2.7 % @ 7.3 | 0.10 % — 2.7 % @ 7.3 |
| F_canopy | 0.44 % — 7.2 % @ 11.4 | 0.44 % — 7.2 % @ 11.4 | **0.41 %** — 6.9 % @ 13.2 |

* **Roughness (0.95 against the cards' 1.0) and the leaf-warmth gate are worth nothing measurable.** Every
  md5 changed and not one aggregate did, at any of the six views. They are still the right code — the wood
  was built at 0.95, and `injectTreeLeafWarmth` asks combined materials for a leaf gate in its own doc
  comment — but this lane published them as the residual's two leading candidates last round and **they
  were not it**. Recorded here because a named candidate that measures zero is worth as much as one that
  does not.
* **The gain division is the term.** C_lookback, the pose with the most distant bark in frame, goes from
  0.36 % of the frame and a 12.9 % worst cell to **0.04 % and 0.9 %** — a ninefold drop, and the pose is
  effectively closed.
* **F_canopy barely moves** (0.44 → 0.41 %), because its bole is inside the blend where the division is
  ×1 by design. `F_canopy-trunk-8x-with-gain.png` is the same 8× crop with the division in: still grey.
  That is the measurement that decides the round — the division is necessary and not sufficient.

## Verdict

**Not shippable.** 15–17 draws at views that already sit 160+ draws under W38's 700 is not worth a visibly
flatter trunk at F_canopy, and the six-view gate exists to say so. `cursor/squad2-treephases-682b` reverts
the attempt to the two-material meshes; `cursor/squad2-woodgain-682b` keeps it whole at `c9fa5415`.

## The proposal, priced — needs a yes

Two ways to collect the 15–17 draws. Both need a decision this lane should not take alone.

**(a) A distance-gated material swap — stays in lane 2.** The rebucket already knows every mesh's instance
distances each frame. Where a mesh's whole instance set is beyond `DISTANT_BARK_M[1]` = 38 m, assign the
single crown material (with the gain division, now measured correct out there: C_lookback 0.04 %); where any
instance is nearer, keep the two-element array and the full near treatment. Both programs are already
compiled, so the swap is a reference assignment, not a recompile. At the six views the distant family's
placements are all 43 m+ (camera D's nearest depth row) and would qualify; the mid family would not, so the
win is a fraction of the 15–17 and has to be measured rather than predicted. Risks: per-mesh granularity
means one near instance disables a whole mesh, and the swap has to be reflected in this lane's submission
tally and in three's render-list sorting. **Files: `src/world/trees/index.ts`, `src/world/trees/distant.ts`
— lane 2 only.**

**(b) Port the near bark treatment — needs the trees-materials owner.** Extract the ~45 lines of
`<color_fragment>` GLSL and its five uniforms out of `materials.ts` into a module both materials import, and
pass the giants' bark colour map into `createDistantCrownMaterial`. It cannot live in `distant.ts`, because
`materials.ts` imports that and the cycle would be real; it would also drag out `BARK_DETAIL_MEAN`,
`DISTANT_NEAR_TONE`, `DISTANT_NEAR_BAND_M`, `DISTANT_NEAR_MAP_GAIN`, `DISTANT_NEAR_FURROW_DARK`,
`DISTANT_NEAR_CORD_STRIPE`, `DISTANT_NEAR_FLOOR` and `bindShadeFloor` / `shadeFloorPars`. This is the
correct fix and it collects the whole 15–17 draws at every pose, in play as well as at the fixed views.
**Files: a new `src/world/trees/distant-bark.ts`, plus `materials.ts`, `distant.ts` and `index.ts` — a
refactor of another lane's 1 700-line hot file, so it needs a yes.**

## Method notes this round produced

* **The before build reproduced byte-for-byte across two separately launched paired runs** — all six views,
  same md5s (`counts-before.json` against run 2's). That sharpens `colshadow/`'s rule: pixels are
  reproducible across runs *when the machine is left alone*. Run 3's before half differs at all six views
  from runs 1 and 2, and the cause was mine — a `tsc` and a `vite build` in its first minutes. Counts were
  identical to the triangle in all three runs. **So: never build or run tests while a paired render is in
  flight, and compare pixels only inside one pair.**
* `cellzoom.mjs` (new, in the lane's tools) magnifies one `diffmap.mjs` grid cell of a pair side by side and
  prints that cell's own changed share, mean delta and max. It exists because the aggregate is not the
  question — three of this round's four wrong turns would have been caught by looking at the worst cell
  first.
* One difference between the measured build and the committed source, declared: the crown material's
  `customProgramCacheKey` gained `leaf-warmth` after the renders, because `leaf-color.test.mjs` matches on it.
  A program cache key decides only whether three reuses a compiled program between materials; both strings
  are unique to this material, so no fragment changes. Tests on the attempt branch are 274 / 274 with the
  test's contract for a *combined* material (bark exact, a card warmed) pinned in both senses.
* **Two classifiers were worth more than any amount of code reading**: splitting the changed pixels by the
  before frame's hue (bark against leaf) ruled the crowns out in one second, and splitting them by local
  gradient (silhouette against interior) proved there was a shading difference and not just a seam. Only
  then was it worth reading `materials.ts` line by line.

## Files

| file | what it is |
|---|---|
| `counts-before.json` | the two-material build at the six views (run 1's before half) |
| `counts-row14.json` | one material, nothing else |
| `counts-row14-roughness-leafgate.json` | plus the wood roughness and the leaf gate |
| `counts-row14-with-gain.json` | plus the `DISTANT_NEAR_GAIN` division |
| `F_canopy-trunk-8x-row14.png` | the failure, 8×: warm modelled bark against a grey cylinder |
| `F_canopy-trunk-8x-with-gain.png` | the same crop with the division in — still grey |
| `F_canopy-diff-row14.jpg` | the three-panel sheet for the failing pose |
| `C_lookback-diff-with-gain.jpg` | the pose the division closes (0.36 % → 0.04 %) |
| `C_lookback-cell-6x-row14.png` | its worst cell before the division, 6× |
