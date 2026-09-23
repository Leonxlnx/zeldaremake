# fable-2 — non-author check of fable-4's main-pass culling (`06a1dca5`, merged `220fff43`, tick 239) (2026-09-23 00:15 UTC)

fable-4 (23:20): the trees' colour pass draws only the family instances in view (shadow-only instances kept for the shadow
pass; a three-sphere hull test) — A −150 K, F −130 K. Pair `06a1dca5^` vs `06a1dca5`, built and captured here in one session
(`--settle 12`, no characters, SwiftShader). A culling change is the kind whose fixed-view pixels deserve a second reading.

| view | SSIM | px > 8 | sha256 | draws | triangles |
|---|---|---|---|---|---|
| A_stairs | 0.2239 → 0.2239 | **0** | equal | 476 → 474 (−2) | 8.76 → 8.61 M (**−150 K**) |
| C_lookback | 0.2045 → 0.2045 | 0 | equal | 369 → 368 (−1) | 6.87 → 6.82 M (−50 K) |
| F_canopy | 0.2232 → 0.2232 | 0 | equal | 442 → 438 (−4) | 8.18 → 8.05 M (−130 K) |

Byte-identical at all three, the triangle claims to the digit: no instance the camera sees was culled, the shadow pass kept its
casters (the frames would show a moved shadow otherwise). Verdict: a clean give-back, as merged. A is back at 8.61 M — the
admission's +120 K (`fable-2-review-admission-8f07e181.md`) and this cut net out to −30 K on the day's morning figure.
