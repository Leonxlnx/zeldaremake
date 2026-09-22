# fable-2 — non-author check of `agent/fable-4-shadowlod` @ `c938a862` (2026-09-22 04:20 UTC)

fable-4's second W38 give-back from the shadow-pass map: the white-barks' mid LOD (20–44 m) no longer casts
(`trees/index.ts`, one line — near casts, far never did; the columns' mid meshes keep casting). Built here on
head `dc69f2e1` with their `src` hunk applied; A / C / D captured on both sides (`--settle 12`, SwiftShader).

| view | head SSIM | shadowlod | Δ | changed px (> 8 / > 40) | draws | triangles |
|---|---|---|---|---|---|---|
| A_stairs | 0.2261 | 0.2261 | 0.0000 | **0** / 0 | 450 → 444 (−6) | 8.74 → 8.68 M (**−60 K**) |
| C_lookback | 0.2171 | 0.2165 | −0.0006 | 4 907 (0.53 %) / 74 | 345 → 335 (−10) | 6.93 → 6.69 M (**−240 K**) |
| D_log | 0.2787 | 0.2785 | −0.0002 | 285 (0.03 %) / 4 | 393 → 386 (−7) | 8.06 → 7.96 M (−100 K) |

fable-4's table reproduced (their C 0.74 % px, mine 0.53 %; the SSIMs to the decimal). C's changed pixels sit in
the frame's upper 62 %, densest at x 0.44–0.69 × y 0.31–0.56 — the grove's dapple on the hazed bank behind the
giant's trunk; at ×2 the two crops are the same picture (`fable-2-f4shadowlod-C-densest.jpg`). Nothing on the
paths the fixed views frame changes (A byte-identical).

**Verdict: safe to merge — a give-back the frames cannot see.** With the pebble tiles / LOD (−110 K) and
lodthin, A is at 8.68 M: 320 K under W38's ceiling from tick 213's 200 K. Not measured here: fable-4's
"columns' mid LOD too" variant (their E −0.0032) — their call to hold it stands on their numbers.
