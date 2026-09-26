# `agent/fable-4-nearbox` `ad40ecda` — the batched tree parts cull by their own boxes in the colour pass — non-author read (fable-5, lane 10)

**Read 2026-09-26 04:27–05:25 UTC, against its base, the head `896c2d6d`** (the one 36-line commit in `trees/index.ts` is the difference).
three culls a `BatchedMesh` instance by its sphere; a near-canopy lobe's padded sphere (`CULL_PAD_M` on a 3–6 m lobe) reaches far past its
laminae, so lobes above or beside the frame were drawn for no pixel. Before each colour pass the near-canopy and far-foliage batches now
also test each part's own box — its vertices' bounds plus `BATCH_BOX_PAD_M` 0.5 m (the sway ≤ 3 cm, the twiglets' flex ≤ 10 cm, the flutter
a few cm) — with `boxMeetsFrustum`, the group cull's SAT test. The far-foliage batch's depth list is built by its own hook (#188), so the
shadow map is untouched; the near-canopy batch is colour-only. The claim: camera A 15 shown lobes pass the sphere, 3 the box — 115 K
triangles; the far bank 210 K; the green 136 K; no pixel changes.

## The six views — pixel-identical

`896c2d6d` → `ad40ecda`: A B C D E F **1.0000 / 0.00 %** (the reference column unchanged).

## The fixed views' budget (capture mode, 8 settle frames, the character visible, `__ZR__.stats()`)

| view | head `896c2d6d` | nearbox `ad40ecda` | Δ |
| --- | --- | --- | --- |
| A_stairs | 575 draws / 8.636 M | **575 / 8.510 M** | −126 K |
| B_house | 557 / 7.954 M | 557 / 7.782 M | −172 K |
| C_lookback | 494 / 7.725 M | 494 / 7.590 M | −135 K |
| D_log | 484 / 8.368 M | 484 / 8.185 M | −183 K |
| E_ground | 557 / 7.954 M | 557 / 7.782 M | −172 K |
| F_canopy | 516 / 7.840 M | 514 / 7.642 M | −198 K, −2 draws |

A's −126 K against the estimate's 115 K (the far-foliage batches' boxes add the rest). **Camera A at 8.510 M — 0.49 M under the cap with
Link in frame**; the three batch reads of the night (farfold, farshadow, nearbox) have taken it from 8.967 to 8.510 M without a pixel.

## In play — four poses, pixel-identical

| pose | head → nearbox | Δ |
| --- | --- | --- |
| the east green (43, 4) → W | 652 / 9.815 M → 652 / 9.747 M (SSIM 1.0000, 0.00 %) | −68 K |
| the far bank (4.06, 42.8) → N | 680 / 9.810 M → 680 / 9.659 M (1.0000, 0.00 %) | −151 K |
| the plaza (0.5, 3) → S, under the giants | 494 / 6.904 M → 493 / 6.714 M (1.0000, 0.00 %) | −190 K |
| the flight's foot (5.8, 0.5) → E | 490 / 8.833 M → 489 / 8.675 M (1.0000, 0.00 %) | −158 K |

The green's −68 K is half the estimate's 136 K (the estimate was the near-canopy batches alone on a build before #188; from the follow
camera fewer lobes sit beside the frame than from the hero cameras), the far bank's −151 K and the plaza's −190 K are where the crowd of
lobes is above and beside the frame.

## Verdict

**PASS for merge.** Pixel-identical at the six views and four play poses; −126…−198 K at every fixed view, −68…−190 K in play, the shadows
untouched by construction. The one thing to watch in motion, not measurable in stills: the 0.5 m pad is the margin between a lobe's box and
its swaying laminae at the frame's edge — generous against the stated 3–10 cm, so a pop-in at the edge would need a gust the wind model
does not have. Not exercised: a context without `WEBGL_multi_draw`, as with the family.
