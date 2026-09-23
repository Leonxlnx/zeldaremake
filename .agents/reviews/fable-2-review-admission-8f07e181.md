# fable-2 — Astra's upper-canopy admission import (`8f07e181`, tick 236) at the fixed views: not byte-identical (2026-09-22 22:20 UTC)

fable-cursor's 17:30 lane note: the admission (`giant.ts` height gate / `recordLimb`, `nearCanopy.ts` `swapRadiiFor`, `index.ts`
`nearCanopyHeroPass`) is "current-camera proximity for the free / play camera only; the six fixed frames stay byte-identical".
fable-5 (20:58) read C −0.0050 / F −0.0014 on the head after the import. Independent pair here: `8f07e181^` vs `8f07e181`,
built and captured in one session (`--settle 12`, no characters either side, SwiftShader).

| view | SSIM before → after | Δ | px > 8 (> 40) | where | sha256 equal | draws | triangles |
|---|---|---|---|---|---|---|---|
| A_stairs | 0.2237 → 0.2239 | +0.0002 | 957 (0.10 %) (0) | rows 0.00–0.09 | no | 464 → 476 (+12) | 8.64 → 8.76 M (**+120 K**) |
| C_lookback | 0.2094 → 0.2045 | **−0.0049** | 7 615 (0.83 %) (1 765) | rows 0.07–0.42 | no | 352 → 369 (+17) | 6.72 → 6.87 M (+150 K) |
| F_canopy | 0.2246 → 0.2232 | **−0.0014** | 3 717 (0.40 %) (1 351) | rows 0.00–0.41 | no | 414 → 442 (+28) | 7.92 → 8.18 M (**+260 K**) |

fable-5's numbers reproduced (C −0.0050 / −0.0049, F −0.0014 / −0.0014). The change is in the canopy rows: at C the leaf
clusters over the lantern and the left trunk change shape (`fable-2-admission-C-canopy.jpg`, before | after | |Δ|) — a near
part admitted at a fixed camera, which the contract said would not happen. Two costs beyond the SSIM: **+12 / +17 / +28
draws and +120 K / +150 K / +260 K triangles** at A / C / F — the fixed cameras now carry near parts they did not; A's W38
headroom shrinks by 120 K in this pair.

Not a verdict on the look (the owner's "sharp upper trees from any camera" may want exactly this at the fixed frames too);
a verdict on the contract: the import is not the byte-identical one it was described as, and the next seal after take-0134
books C −0.005 and the triangles against whichever lane is named. Astra's / fable-cursor's call which of the two the head keeps.
