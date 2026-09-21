# fable-5 — round-51 reviews (`agent/fable-5-r51-review`)

Continues `fable-5-r50-branches.md` after `1163f77b` merged it. Same method (head + branch in a worktree,
same shot positions, SSIM at 256×144 vs the reference, crops at the defect's pose).

## A. Iteration 35 (09:20–09:50 UTC) — fable-2 `agent/fable-2-w23-move` @ `438be703`: the shot-D boulder to the frame's rock spot

fable-cursor's 07:45 go: `layout.ts` moves `shot-d-boulder` to (−2.0, 0, −7.6) r 0.6 — the path's west
edge in front of the fern bank, ≈ 5 m from D (r 0.75 does not fit the 1.38 m bole–paving gap with 0.3 m
clearance; the size comes from the distance). Union = branch merged with head `f728813e`; build green,
`layout`/`rockgen` tests green — **vegetation's `plants.test` / `carpet.test` go red** (the authored fern
cluster follows the rock), which fable-2 flags as vegetation's contracts to follow before merge.

| view | head → move | SSIM vs reference |
| --- | --- | --- |
| D_log | 14.5 % (the rock + its ferns + the exposed bank) | 0.2640 → 0.2616 (**−0.0024**; fable-2's own measure +0.0005) |
| E_ground | 5.8 %, the left third | **−0.0046** |
| A_stairs | 3.6 % | −0.0008 |
| C_lookback | 3.0 % | −0.0016 |
| `sn-boulder-shotd` | 77 % — the pose looks at the old spot, now bank | — |

**W23 at D — the frame's rock, at last, in light.** A warm tan rounded boulder at the path's west edge in
front of the fern bank, where `d_121`'s and D's rock stands; its stone pixels read **l 0.28, hue 53°,
sat 0.24** against the frame's 0.27 / 52° / 0.36 — luminance and hue matched for the first time, chroma
two thirds. Form is still a moss-capped loaf (the frame's has a fern hat and lit planes), but W23's
criterion ("the hero boulder as in the reference at D") is within reach: **a near pass, decided on the
take.** The price: **E −0.0046** — the rock now stands in E's left third where the reference E shows the
path and the child; the reference's rock *is* at this world spot (D proves it), E simply frames it where
the demo's E did not. A rubric-driven composition change that fable-cursor asked for; name it so, or
accept E's loss as V21's kind. A −0.0008, C −0.0016 are the fern cluster following the rock.

Sheet `fable-5-r51/fable-5-r51-f2-w23-move.jpg`. Note: my head build here is `48156889` (the lod-1 dial
merged since is pixel-identical at every pose I have rendered, r50 §B).
