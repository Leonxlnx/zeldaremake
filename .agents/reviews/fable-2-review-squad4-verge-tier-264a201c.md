# fable-2 non-author check — squad4's walked-verge near tier (`agent/squad4-verge-budget-2026-09-23` @ `264a201c`)

The claim (`art/environment/squad4-2026-09-23/BUDGET.md`, from their CPU tool `veg-budget.mjs`, no renderer): the verge pass's extra
blades drop from tiles whose near edge is past `VERGE_NEAR_M` = 14 m — grass-tiles A −54 K, B −65 K, D −30 K, F none; draws unchanged;
"nothing inside the band changes".

Measured with the renderer, the branch's tip against its own merge-base `6d145e90` (both built and captured here, sequential, settle 12,
`--no-checks`; the reference SSIM is against the sealed take, so read the deltas):

| view | draws base → tip | triangles base → tip | SSIM base → tip | px > 8 levels | px > 40 |
|---|---|---|---|---|---|
| A_stairs | 695 → 695 | 8.95 → 8.90 M (−50 K) | 0.1820 → 0.1820 (0) | 0.11 % | 0 |
| B_house | 685 → 685 | 8.19 → 8.13 M (−60 K) | 0.1765 → 0.1763 (−0.0002) | 0.16 % | 0 |
| D_log | 561 → 561 | 8.49 → 8.46 M (−30 K) | 0.2476 → 0.2476 (0) | 0.07 % | 0 |
| F_canopy | 648 → 648 | 7.89 → 7.89 M (0) | 0.2032 → 0.2032 (0) | 0.00 % | 0 |

Read: the claims hold on the renderer — the tool's numbers land within 5–10 K of the drawn count (three's own per-mesh cull takes the
rest), draws are the same at every view, and the frames move by a tenth of a percent of pixels, none over 40 levels: the tier is
invisible at the six-view distances, as argued. Not checked here: a walk pose standing inside the band at its 14 m edge (the tier's
hysteresis, if any, would show there as blades appearing at the boundary while moving) — that is the one thing the fixed views cannot
see. Renders `/tmp/cap-sq4base`, `/tmp/cap-sq4tip`; the branch's own base `6d145e90` is 8.95 M at A, so the head's 8.87 M (after
fable-2's flagstones and fable-4's white-barks) would sit at ≈ 8.82 M with this merged.

**Addendum (00:58) — the walk.** Three ground poses with verge tiles at and beyond the 14 m tier in frame (`w06-spine-f`,
`w03-spine-f` looking along the spine, `w08-spine-l` across the north path), same two builds: pixels > 8 levels 0.06 / 0.04 / 0.20 %,
none > 40; the densest 72-row band (the mid-distance ground where the tier edge sits) 0.4 / 0.3 / 1.2 % of its pixels, all
single-digit levels. Whatever a blade does at the boundary while moving, it is below the eye's threshold here too — the check I left
open above is closed.
