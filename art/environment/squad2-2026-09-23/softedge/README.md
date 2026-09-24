# squad2 — answering the review that reverted the depth veil

Answering **fable-cursor's review note of 05:30** (`docs/SQUAD_2026-09-23.md` §Review notes): the
`squad2-lookup` merge was reverted because at the pinned `u-open-up` pose the depth veil "turns the
crowns into pale beige flat shapes whose polygon edges read harder than before … a paler card is still
a card", with the bar for what would pass: *the crowns' silhouettes soften or break up as they recede,
with the tone moving toward the air only as much as the reference's r_025 band*.

Branched from the current head with `git revert 7872ec0e` first, as the note asks.

**Half of that bar is met and half is not, and the half that is not is a measured failure with its
cause found.** Read the two sections in that order.

## 1. The tone: met, and the rejected artefact is gone

The review's pose, cropped to the region it rejected (`open-up-three.jpg` — head base | the reverted
05:20 build | now):

![the pinned pose, base, rejected and now](open-up-three.jpg)

| `u-open-up`, band y 0–0.7 | foliage L | foliage S | sky L | cut-out | outline hardness |
| --- | --- | --- | --- | --- | --- |
| head base | 0.287 | 0.128 | 0.672 | 0.384 | 15.5 % |
| the reverted 05:20 build | 0.315 | 0.138 | 0.672 | 0.357 | 15.3 % |
| **now** | **0.294** | 0.133 | 0.672 | 0.378 | 15.5 % |
| reference `r_025` | 0.277 | 0.099 | 0.518 | 0.242 | **3.4 %** |
| reference `r_026` | 0.293 | 0.081 | 0.521 | 0.228 | **3.4 %** |

Two things that table says, both new:

- **The veil's premise was wrong at this pose.** Our foliage was *already* at the reference's own
  lightness (0.287 against 0.277 and 0.293). What is 0.15 out is our **sky**: 0.672 against their
  0.518. That is what makes every leaf edge a maximum-contrast cut-out here, and it is not a tree
  material — it is the sky and the in-scatter over it (lane 1 / atmosphere, and it is worth stating
  next to squad4's `RAYS.md`, which found the same wash from the other side).
- The veil is now off the crown cards entirely and the tone sits at 0.294, inside the reference band
  and a third of the way back from the rejected 0.315.

The fix is a split by **material, not distance**: a probe with each crown material marked
(`probe-look.mjs`, four variants in one load, `probe-far-crown-marked.png`) puts the flat shapes on the
crown layer's near LOD at 21–33 m (`distant-5-near`, `distant-0-near`, `distant-1-near`), while the
plaza look-up's gain is the giants' dense canopy at the *same* distances. Dense overlapping foliage
with depth behind it can take the air's colour; an isolated card cannot, because paling it prints its
geometry. So the veil stays on the giants' leaf cards and leaves the crown cards alone, and it also
became a **floor** rather than a wash: it fades out with the fragment's luminance as a share of the
air's own, so foliage already as pale as the air gets nothing.

That relative form matters — an absolute threshold read nothing at all, because the god-ray in-scatter
is a post pass: a leaf at 0.31 on screen is about a third of that inside the material.

The gain the owner's job 6 was about is untouched (`plaza-up-pair.jpg`, his `u-plaza-up`): the outward
band's middle third 64.0 → 79.9 levels, the near canopy overhead 74.3 → 74.8.

![the plaza look-up, base and now](plaza-up-pair.jpg)

## 2. The silhouettes: not met — four non-results, and why none of them could work

The review is right that the outline is the defect: **15.5 % against the reference's 3.4 %**. Four
alpha-side treatments were built and rendered against that number, and every one is a non-result:

| attempt | result at `u-open-up` |
| --- | --- |
| remap the alpha to widen its blended fringe (erode 0.18, soft 0.7, 16–42 m) | outline hardness 15.5 % → **15.6 %** |
| sample the atlas 1.8 mip levels blurrier with distance | **0.05 %** of the frame changed; 0.00 % at the plaza look-up |
| fade the lobe cores with distance (0.85 over 16–42 m) | **byte-identical frames** |
| the same dissolve on a 26–64 m window (the first guess) | 15.5 % → 15.4 % |

The byte-identical frames are the useful clue: they prove that *none of those shapes is a lobe core*.
Following that, the cause is geometry, not shading — inside the crown layer those parts sample the
atlas's **opaque patch** (`solidUv`: every vertex tagged `w ≤ 0`, the lobe cores at 0 and the near
LOD's bark at −0.45). Solid alpha has no fringe to soften, no coverage to erode and no mip detail to
blur. **The outline is the polygon itself.**

So the next attempt should not be another shader term. What the bar needs is for the silhouette at
21–40 m to be drawn by leafy cards rather than solid volumes — the cores pulled inside the cards'
envelope, or given leafy UVs, in `createDistantVariants` / `solidUv`. That is a geometry change with a
triangle cost to weigh, which is why it is a hand-off with a measurement rather than something rushed
in this hour. The four dead terms are backed out rather than shipped, and the reason is recorded in
`CROWN_FAR_DISSOLVE`'s place in `distant.ts` so the next person starts here instead of repeating it.

## What is in the branch

- `src/world/trees/distant.ts` — the veil off the crown cards, `CANOPY_DEPTH_VEIL.lift` (the relative
  floor), `CROWN_SHADE_M` as before, and the recorded finding where the dissolve was.
- `src/world/trees/materials.ts` (lane 3, declared) — two lines: the veil on the `giant-canopy` leaf
  cards, and a `name` for that material so `probe-look.mjs` can mark it. It was anonymous, which is why
  the first probe of this had to guess.

Typecheck, build and the trees / canopy tests (22) are green. Cost is unchanged: no geometry, no new
draw, no new texture — the veil is a handful of fragment operations on one existing material.
