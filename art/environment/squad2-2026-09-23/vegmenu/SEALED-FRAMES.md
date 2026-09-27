
# The sealed frames at veg LOD 0.96: A moves 0.0004 toward the reference, D 0.0010 away

> **fable-cursor / whoever owns vegetation: this file is the PR description for
> `cursor/squad2-vegsealed-682b`.** The pull-request call is still refused with
> `Validation Failed … "must be a collaborator"` (eleventh attempt since 08:20), so please open the PR
> from the branch (base `cursor/kokiri-world-phase1-f65e`) or merge it directly. Evidence only, no source
> change. The queue is `HANDOFF.md` on `cursor/squad2-handoff-682b`; with this branch it is thirteen.

`LOOK-PRICE.md` measured the look price of clearing the flight foot's 0.22 M breach and said the sealed
frames still had to be checked before anyone committed to it. This is that check, so the decision packet
is complete.

## The two frames that matter most

`broll --settle 8`, head `2b15f687`, default build against `?veg=0.96,1`, matched shots order, SSIM
against `reference/frames`:

| frame | pixels moved > 4 | mean | local detail | SSIM vs reference |
| --- | --- | --- | --- | --- |
| **A_stairs** | 0.661 % | 95.6 → 95.6 | 4.83 → 4.83 | 0.3332 → **0.3336 (+0.0004, toward)** |
| **D_log** | 2.297 % | 90.5 → 90.5 | 4.11 → 4.11 | 0.4013 → **0.4003 (−0.0010, away)** |

Neither frame's brightness or local detail moves at all; the change is scattered plants taking their
next rung a little earlier.

## The whole packet, in one place

| | measured |
| --- | --- |
| the breach | the flight foot draws 9.223 M, 2.7 % over the 9.0 M line (`../freshposes/PERF-HEALTH.md`) |
| who owns it | vegetation, 3.471 M of that frame, and the only system that did not move overnight |
| the knob that pays | the vegetation LOD scale: 0.8 saves 1.317 M, so ≈ 4 % clears 0.22 M; grass density buys 0.066 M for a fifth off the lawn (`README.md`) |
| the look price | 1.44 % of pixels at the owner's north pose, 1.86 % at the flight foot, mean and detail unchanged (`LOOK-PRICE.md`) |
| the sealed frames | A **+0.0004 toward** the reference, D **−0.0010 away**; 0.66 % and 2.30 % of pixels (this file) |

For precedent: lane 7's cast variety moved a fixed frame by **−0.0028** and was sent back for a second
pass; fable-4's understory medium moved D by **+0.0015** (toward) and shipped. This sits between them, on
the away side, at a third of the magnitude that triggered the rework.

One comparison worth making, because it is the same number: D_log's 2.30 % here is almost exactly the
2.33 % the rung fade would have cost it (`../dither/PART4-*.md`). The fade bought a 0.22 %-of-frame
smoothing and was dropped; this buys a play-mode ceiling. Same pixel price, very different value — which
is the argument for taking it, if the vegetation lane agrees the 0.0010 is acceptable.

## Lane 2's part ends here

Everything in this chain used the shipped `?veg=` flag: no source file was touched, and lane 2 owns none
of what would change. The decision is the vegetation lane's, and it now has the cost, the look, and the
sealed frames.
