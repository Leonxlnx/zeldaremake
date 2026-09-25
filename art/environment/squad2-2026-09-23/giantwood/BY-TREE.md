# The family the audit calls `giant-wood` is wood AND leaves — the wood is a sixth of it

`README.md` here measured the mesh family at **1.36 M triangles drawn at hero A**, `CORRECTION.md`
withdrew the trunk-arc proposal, and both said the same thing was missing: a split inside the family.
This adds it to the trees audit (`giantWoodByTree`, lane 2's file) and reads it on the head — and it
corrects the framing of both earlier notes.

## The new audit row

`audit().systems.trees.giantWoodByTree`, heaviest first, one row per giant:

`[id, wood, of it the relief bole, of it the authored boughs' dressing, the rest, the tree's LEAF
triangles in the same mesh, the nearest hero camera holding it in its forward cone (m, null if none)]`

The near base is deliberately excluded: it is pooled and drawn only inside `NEAR_BASE_IN_M`, and
`nearBase.boles` already reports it per bole. `src/world/trees/giantWoodAudit.test.mjs` pins the row's
shape — the parts must add back to the total, the near base must stay out, and the hero distance must
travel with the row rather than be recomputed.

## What it says (head `d9112199`, plateau look-back)

| giant | wood | bark | boughs | rest | **leaves** | hero m |
| --- | --- | --- | --- | --- | --- | --- |
| plateau-oak | 30,960 | 0 | 2,662 | 28,298 | **312,356** | 26.0 |
| north-west-near | 25,200 | 0 | 0 | 25,200 | 75,052 | 11.6 |
| east-giant | 24,608 | 0 | 0 | 24,608 | 46,080 | 26.8 |
| lantern-tree | 23,977 | 0 | 0 | 23,977 | 104,628 | — |
| southwest-giant | 22,577 | 0 | 0 | 22,577 | 41,332 | — |
| south-centre | 22,577 | 0 | 0 | 22,577 | 40,812 | 35.3 |
| stair-bank-giant | 22,179 | 0 | 0 | 22,179 | 47,088 | 13.6 |
| south-giant | 21,722 | 0 | 0 | 21,722 | 41,048 | 31.2 |
| north-east | 19,918 | 0 | 0 | 19,918 | 20,812 | 37.1 |
| far-plateau | 19,405 | 0 | 0 | 19,405 | 19,664 | 41.0 |
| plaza-south | 19,297 | 0 | 0 | 19,297 | 34,736 | 28.2 |
| north-west | 18,001 | 0 | 0 | 18,001 | 16,044 | 32.8 |
| **total** | **270,421** | **0** | 2,662 | 267,759 | **799,652** | |

Against the family's static 1,508,970 triangles:

* **wood 270,421 — 18 %.** Twelve giants' trunks, wild limbs and buttress roots together are a sixth
  of the mesh. So "the giants' wood draws 1.36 M" in `README.md` is wood **and** foliage; the wood's
  own share of that draw is about a quarter of a million triangles.
* **leaves 799,652 — 53 %.** A giant's laminae live in the geometry its wood is in; the sector mesh is
  grouped 1 wood group + `GIANT_LEAF_BANDS` (2) leaf bands per giant, which is why the family reads as
  one line. `plateau-oak` alone carries 312 K of them, 39 % of all giant laminae.
* **the residual 438,897 — 29 %** is the lobes' far foliage in the same geometry — the laminae and
  cards the near-canopy swap folds away through the shader when a near part shows
  (`nearCanopy.foldedTriangles` is the folded subset at a given camera, 138,305 here).

**Every giant's relief bole is 0.** The `nearBole` gate plus the profiles leave no giant taking the
relief trunk in the shipped build; the relief geometry that does exist is the pooled near base. So the
arc constants the first proposal aimed at (`README.md`) are not even reached at runtime — a second,
firmer reason that thread was a dead end.

## Where a rung would have to go instead

The mass is leaves, and the giants' leaf population already fades with distance at build: the density a
giant is built with carries `farFade = 1 − 0.45 · clamp((plazaDist − 26) / 16)`, i.e. by distance from
the **plaza**, not from a camera. The row above now puts each giant's leaf count beside the nearest
hero camera that holds it, and the two do not line up — `lantern-tree` carries 104 K laminae with no
fixed camera on it at all, while `north-west-near` at 11.6 m carries 75 K. That mismatch, not the
trunk, is where a camera-aware rung would pay.

That decision is lane 2's (the density a giant is built with is passed from `index.ts`), so it is mine
to propose next; this note only establishes the numbers it would be argued from.
