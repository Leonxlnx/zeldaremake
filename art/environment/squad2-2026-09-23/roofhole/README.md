# squad2 — the canopy closes over the open north

Taking the item lane 2 diagnosed at `art/environment/squad2-2026-09-23/upring` and then left twice because
it moves the fixed frames: **looking up from the plaza's northern approach showed haze where the canopy
should close.** Branched from the head; `agent/squad2-crowntone` (PR #48) is independent of this and
touches different files.

## The pose the owner would see

`u-open-up`, the pinned look-up in fable-cursor's re-read protocol, before and after
(`open-north-pair.jpg`):

![the open north look-up, before and after](open-north-pair.jpg)

| `u-open-up` | mean | top third | middle third |
| --- | --- | --- | --- |
| before | 107.4 | 137.7 | 114.8 |
| after | **71.9** | **74.4** | **72.1** |

39.3 % of that frame changes. What was a flat pale-grey void over two thirds of the image is now layered
leaf masses with bright gaps of sky punched through them and the god rays coming down between — which is
what the reference's look-ups have (`review46/r_020–r_028`, `demo61/d_101–d_116`).

## Why the hole was there

The roof's hero-frame exclusion dropped **every** clump projecting anywhere inside one of the six fixed
frames within 120 m (`HERO_DROP_M`). A roof hangs 20–37 m up, so "anywhere inside a frame" is in practice
the frames' **top band** — and the consequence was that the airspace over the northern approach
(z ≈ −20…−52) carried no roof at all, while the stand pass that would have covered it starts at z ≤ −52
(`ROOF_STAND_BOUNDS`). The hole was not a bug in the field or the supports; it was the exclusion doing
exactly what it said.

`HERO_TOP_KEEP = 0.18`: a clump whose projected disc stays within 0.18 of a frame's height from its top
edge is kept. That band is the only part of a hero frame a 20–37 m roof can reach; our frames already carry
foliage along it (hero A's top third is foliage) and so does the reference (`r_025`, `r_026`, `d_108` all
close over the top of the image). **Below the band the exclusion is exactly as it was.**

## What it costs

`measure-roof.mjs` (new, in this directory) builds the roof headlessly through the canopy test's loader and
prints the change exactly, instead of inferring it from a rounded pose count:

```
HERO_TOP_KEEP = 0      clumps   672  cards  2944  triangles  5888  dropped by the frames   76  over the approach  121
as shipped             clumps   753  cards  3278  triangles  6556  dropped by the frames    3  over the approach  176

delta: 81 clumps, 334 cards, 668 triangles (0.0074 % of the 9 M cap), and 55 more clumps over the northern approach
```

And the hero views measured with `pose-counts.mjs` on this build (`pose-counts-after.json`) are the same
figures fable-cursor's 11:20 full check reported on the merged head — A 639 draws / 8,875,355 triangles,
B 628 / 8.29 M, C 572 / 7.93 M, D 562 / 8.63 M, E 628 / 8.29 M, F 599 / 8.01 M. Nothing approaches the
700-draw / 9 M cap.

## What it moves in the fixed frames

| frame | pixels changed > 8 levels | mean before → after |
| --- | --- | --- |
| A (`A_stairs`) | 10.58 % | 94.8 → 94.8 |
| D (`D_log`) | 9.58 % | 90.1 → 90.0 |
| F (`F_canopy`) | **0.00 %** | 84.0 → 84.0 |

The means do not move, and `hero-A-diff.jpg` shows why: the changed pixels are scattered over lit
vegetation — the treehouse's moss, the left canopy, the right-hand shrubs and grass — not a new band across
the top of the frame. That is the added roof's **shadow** re-dappling the plaza, light moved around rather
than taken away. It is a real change to the scored frames and it needs a pinned-pose re-read before any
checkpoint leans on A or D; F, the canopy view, does not move at all.

## The test

`roof.test.mjs` pinned the old rule exactly (it failed with 111 offenders the moment this changed), so it
now pins the new one with the same independent pinhole projection: **no clump centre below the kept top
band inside a hero frame within the drop distance**, and it reports how far down a frame an offender sits.
The rest of that test — determinism, the stand pass, the shaft columns, the minimum height above ground —
is untouched and still passes.

Typecheck, build and the canopy / trees tests are green.
