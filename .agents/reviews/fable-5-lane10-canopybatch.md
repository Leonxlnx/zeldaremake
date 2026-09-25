# fable-5 — non-author pre-merge check: `agent/fable-4-canopybatch` @ `80d60e72` (the giants' near-canopy lobes and limbs as one BatchedMesh) — 2026-09-25 06:24–06:53 UTC

Base `d367cfbf` (the head `7468bb38`'s frames are its visual twin). Same deterministic capture; `isolate.mjs` at the five look-backs.

## The draws — row 2 of the look-back bill, part paid

| pose | trees row, head → batch | isolate sum | the frame |
| --- | --- | --- | --- |
| the far bank | 256 / 3.63 M → **200 / 3.48 M** (−56) | 760 → 704 | 774 → **718** / 9.90 M |
| the east green | 249 / 3.71 M → 214 / 3.56 M (−35) | 723 → 688 | — |
| the east lookout | 243 / 3.81 M → 215 / 3.67 M (−28) | 692 → 664 | — |
| the ruins' trail | 240 / 4.47 M → 203 / 4.32 M (−37) | 724 → 687 | — |
| the grove's yard | 165 / 2.37 M → 162 / 2.30 M (−3) | 663 → 660 | — |

−28 to −56 draws wherever the giants' near canopy is in the frame, for ≈ −0.15 M triangles: a draw merge, as intended.

## The six views — not a pure regrouping

| view | SSIM head ↔ batch | pixels changed | vs reference | Δ |
| --- | --- | --- | --- | --- |
| **A_stairs** | 0.9920 | 1.06 % | 0.1732 → 0.1718 | −0.0014 |
| B_house | 0.9998 | 0.14 % | 0.1689 → 0.1689 | 0 |
| **C_lookback** | 0.9871 | 1.46 % | 0.1793 → 0.1769 | **−0.0024** |
| D_log | 1.0000 | 0.00 % | 0.2334 → 0.2334 | 0 |
| E_ground | 0.9998 | 0.14 % | 0.1899 → 0.1898 | 0 |
| **F_canopy** | 0.9836 | 1.79 % | 0.2029 → 0.2065 | +0.0036 |

A BatchedMesh that only regroups submission should move no pixel. These move 1–1.8 % at A, C and F, and the crops say what
(`fable-5-lane10/canopybatch-lobes-head-vs-batch.jpg`): **whole near-canopy lobes render 9–13 luma brighter** (73–82 % of the
changed pixels brighter; the |Δ| map lights the lobes' full silhouettes, not their edges) at A's top right, C's top left and F's
centre. A shading term the per-part meshes carried is not reaching the batch — a per-part vertex attribute normalised on the
mesh and not on the batch's Float32 copy, or a per-part uniform (the crowns' veil share, the wind phase, a tone) the batch
draws with one value. Inside the budget by the numbers (C at −0.0024 is the closest any branch has come), but a look change
the commit does not intend.

**Not merge-ready until the lobes render as before**; then it is −28 … −56 draws at every look-back for free. The check is
one lobe's colour attribute and uniforms, mesh vs batch, at A's pose.

## `e82cef73` (06:55 — a part's first build goes into the batch at creation) — 07:28–08:05 UTC

**Merge-ready.** Against the head `24dc489f` the six views are **pixel-identical at all six** (1.0000 / 0.00 %). The pair
`80d60e72` → `e82cef73` changes exactly the 1.06 % / 1.46 % / 1.79 % at A / C / F that the first read flagged — and the trees row's
triangles come back to the head's (the far bank 3.48 → 3.63 M, the ruins' trail 4.32 → 4.47 M) while the draws stay cut. So the
"brighter lobes" were **lobes missing**: a part's first build was never installed in the batch, the −0.15 M triangles were those
lobes, and the haze behind them was the brightness. The draws on the fixed batch: the far bank's trees **200** (−56), the green
**214** (−35), the ruins' trail **203** (−37); the frames **the far bank 718 / 10.06 M, the east green 701 / 9.80 M** (was 774 and 736).
Row 2 of the bill, its first payment, with the frames as they were.
