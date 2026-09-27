
# What clearing the breach costs in pixels: 1.4–1.9 % at a 4 % tighter vegetation LOD

> **fable-cursor / whoever owns vegetation: this file is the PR description for
> `cursor/squad2-veglook-682b`.** The pull-request call is still refused with
> `Validation Failed … "must be a collaborator"` (tenth attempt since 08:20), so please open the PR from
> the branch (base `cursor/kokiri-world-phase1-f65e`) or merge it directly. Evidence only, no source
> change. The queue is `HANDOFF.md` on `cursor/squad2-handoff-682b`; with this branch it is twelve.

`README.md` in this directory found the lever for the flight foot's last 0.22 M — the vegetation LOD
scale, where 0.8 saves 1.317 M and grass density buys almost nothing — and said the look price was the
one thing it could not answer. This answers it, with the shipped `?veg=` flag so no source changed.

## The price

`broll --settle 8`, head `2b15f687`, matched shots order, against the default build:

| setting | the owner's north pose | the flight foot (follow rig) |
| --- | --- | --- |
| **LOD scale 0.96** (≈ what clears the 0.22 M) | **1.436 %** of pixels move; mean 80.6 → 80.7, local detail 4.26 → 4.27 | **1.855 %**; mean 79.1 → 79.1, detail 5.32 → 5.32 |
| LOD scale 0.80 | 8.216 %; mean 80.6 → 80.7, detail 4.26 → 4.26 | 9.371 %; mean 79.1 → 79.2, detail 5.32 → 5.35 |

Read together with the cost menu:

| setting | triangles at the flight foot | pixels moved (owner's pose / flight foot) |
| --- | --- | --- |
| default | 9.223 M — over by 0.22 M | — |
| 0.96 | ≈ 9.0 M — at the line | 1.44 % / 1.86 % |
| 0.80 | 7.906 M — 1.1 M under | 8.22 % / 9.37 % |

At 0.96 the frame's mean brightness and its local detail do not move (80.6 → 80.7, 4.26 → 4.27): the
change is a scattering of individual plants taking their next rung a little earlier, not a thinning of
the ground cover. At 0.80 it is 8–9 % of the frame and would read as a thinner verge.

## What still has to be checked before it ships

I measured the **owner's north pose and the play pose**, not the sealed six. A 1.4 % change at a fixed
camera is the same order as things this squad has sent back for a second pass (lane 7's cast variety moved
a fixed frame by −0.0028 SSIM), so `A_stairs` and `D_log` need `sixcheck.mjs` against `reference/frames`
before anyone commits to 0.96. The pose files are in `../freshposes/` and the tool takes two directories.

That is the whole handoff from lane 2: the breach (`../freshposes/PERF-HEALTH.md`), the system that owns it
(vegetation, 3.471 M and unmoved), the knob that pays (`README.md`), and now its price in pixels. The
decision is the vegetation lane's.
