# `agent/fable-4-farshadow` `56fad662` — the far-foliage batches' depth pass per lobe — non-author read (fable-5, lane 10)

**Read 2026-09-26 02:33–03:20 UTC.** One commit, 41 lines in `trees/index.ts`, on farfold's tip `5392cb5d` (the pair for everything
below — the only difference between the two builds is this commit). `onBeforeShadow` now sets each of the three far-foliage batches'
instances visible for the depth pass from `shadowReaches(its padded sphere + CULL_PAD_M)` — the rule the sector meshes and
`cullShadowCasters` already use — and builds the depth list itself (three's own hook would route through the colour hook and apply the
fold); `onBeforeRender` sets every instance from the fold as before. The claim: a caster whose sweep along the sun misses the frustum
shadows no visible pixel, so the frame is unchanged; the depth pass 484 K → 362 K triangles at A.

## The six views — pixel-identical

`5392cb5d` → `56fad662`: A B C D E F **1.0000 / 0.00 %** (the reference column unchanged: 0.1732 / 0.1690 / 0.1791 / 0.2334 / 0.1899 / 0.2029).

## The fixed views' budget (capture mode, 8 settle frames, the character visible, `__ZR__.stats()`)

| view | farfold `5392cb5d` | farshadow `56fad662` | Δ |
| --- | --- | --- | --- |
| A_stairs | 575 draws / 8.756 M | **575 / 8.634 M** | −122 K |
| B_house | 557 / 8.131 M | 557 / 7.952 M | −179 K |
| C_lookback | 494 / 7.847 M | 494 / 7.724 M | −123 K |
| D_log | 484 / 8.563 M | 484 / 8.368 M | −195 K |
| E_ground | 557 / 8.131 M | 557 / 7.952 M | −179 K |
| F_canopy | 516 / 7.940 M | 516 / 7.839 M | −101 K |

The −122 K at A is the commit's estimate to the thousand. Draws identical everywhere — the batch is one draw whether 100 or 89 of its
instances cast. **Camera A at 8.634 M is 0.37 M under the cap with Link in frame** (the head `6bb60a08` reads 8.758 M with the same
character; this branch lacks the head's fingers and kit proxy, ± a few thousand).

## In play — four poses, pixel-identical, the depth pass lighter

| pose | farfold → farshadow frame | trees row |
| --- | --- | --- |
| the east green (43, 4) → W | 652 / 9.83 M → 652 / **9.81 M** (SSIM 1.0000, 0.00 %) | 164 / 3.74 → **3.61 M** |
| the far bank (4.06, 42.8) → N | 680 / 9.81 M → 680 / 9.81 M — the same triangle count: nothing to cull from there | 162 / 3.38 → 3.37 M |
| the plaza (0.5, 3) → S, under the giants | 494 / 7.08 M → 494 / **6.90 M** (1.0000, 0.00 %) | — |
| the flight's foot (5.8, 0.5) → E | 489 / 9.01 M → 489 / **8.88 M** (1.0000, 0.00 %) | 134 / 2.21 → **2.09 M** |

The plaza under the giants is the pose where the far laminae's shadows fall on the ground the player walks — pixel-identical with
178 K fewer depth-pass triangles. The audit (`nearCanopy.farBatches`, at the green): three batches of 100 / 100 / 105 instances,
casting 89 / 83 / 105 (181 K / 124 K / 158 K triangles) — the far bank's frame shows the rule culling nothing when every lobe's sweep
meets the view, which is the safe side.

## Verdict

**PASS for merge.** Frame-identical at the six views and at four play poses by measurement, the depth pass −0.1 to −0.2 M at every
fixed view and −0.02 to −0.18 M in play, draws unchanged. The one caveat is the rule's, not the commit's: `shadowReaches` on a padded
sphere is the trust the sectors already extend, so any miss would already be visible elsewhere. Not exercised: a WebGL context without
`WEBGL_multi_draw` (the batch's gate), as with farfold.
