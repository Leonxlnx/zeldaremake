# The head re-verified after the two build-time changes, and the white-bark sampler closed out

Lane 2, 2026-09-29. Branch `cursor/squad2-treephases-682b`, head `98e00cba`.

Two changes landed after the branch's last end-to-end check (`headcheck2/`): the far-crown atlas's
64 px stamp (`atlascost/`, which **moves pixels**) and the mid-grove sampler's test order
(`midplace/`, which does not). The PR's §0 numbers were measured before both, so they needed
re-reading rather than restating — and `midplace/` §5 left one question open, which this closes.

## 1. Geometry: unchanged, bit for bit

`chunks/bitcheck.mjs` (no browser, builds the merged far trees and every pooled near part from the
checkout and md5s every buffer):

```
75 geometries, 741103 triangles
TOTAL 9fc119c64da990ab83caf7625ce98b6d
```

**The same total the branch has carried since §4**, which is what it should be: a texture change and a
placement-test reorder touch no geometry buffer.

## 2. The six fixed views: every number identical to the PR's table

`gauntlet/scripts/pose-counts.mjs --dist dist` on this head:

| view | draws | triangles | the PR's §0 |
| --- | --- | --- | --- |
| A_stairs | 559 | 8 626 622 | same |
| B_house | 541 | 7 903 532 | same |
| C_lookback | 479 | 7 679 745 | same |
| D_log | 465 | 8 242 550 | same |
| E_ground | 541 | 7 903 532 | same |
| F_canopy | 500 | 7 831 095 | same |

W38 binds on the first four (`rubric.json` `heroViewpoints`): worst case **559 draws and 8.627 M
triangles**, both at A_stairs, leaving 141 draws and 0.373 M spare.

## 3. Behaviour: identical too

`gauntlet/scripts/playtest.mjs --only look,walk,perf`:

- **11 walk routes, 11 reached, 0 stuck**; **10 look spots, 0 flagged**; **0 page errors**.
- The four play poses, to the triangle: plaza **528 / 7 677 516**, the flight's foot
  **535 / 9 151 000**, saria-side **502 / 8 508 917**, west-house **411 / 4 908 289**.

## 4. The atlas change at the two views that look into the canopy

`atlascost/` proved the 64 px stamp at a hero view and at the crown-heavy look-back. The two views
where the crown cards cover most of the frame were not in that pair, so they were rendered from both
builds here — same poses, clock frozen, the only difference being `STAMP`:

| view | draws | triangles | SSIM | pixels > 2/255 | mean Δ | max Δ |
| --- | --- | --- | --- | --- | --- | --- |
| F_canopy | 500 → 500 | 7 831 095 → same | **1.00000** | 0.090 % (467 px) | 5.2/255 | 35 |
| E_ground | 541 → 541 | 7 903 532 → same | **1.00000** | 0.025 % (129 px) | 4.9/255 | 17 |

And the crown band reads **identically** at both (`band.mjs`, y 0.10–0.45): F_canopy 70.6 / 15.47 /
21.17 and E_ground 92.9 / 36.38 / 20.13, before and after.

**So the atlas change is now measured at four poses** — hero-A 0.030 %, plateau-back 0.114 %,
F_canopy 0.090 %, E_ground 0.025 % — every one at SSIM 1.00000 with the band unmoved. F_canopy, the
view that should show it most, is the second smallest.

## 5. The white-bark sampler: nothing to win, so nothing shipped

`midplace/` §5 said `placeWhiteBark`'s `fill()` has the same shape as the mid grove's sampler — the
same 46 µs `blocked` ahead of three cheap pure tests — and that its share of the 1 050 ms white-barks
phase was unknown. Measured the same way, instrumented over one world build:

| test | ms | calls |
| --- | --- | --- |
| `blocked` | **15** | 165 |
| `shadesCorridor` | 0 | 121 |
| `closesGap` | 0 | 121 |
| the clash loop | 0 | 117 |
| **the whole sampler** | **20** | 211 attempts for 80 trees |

**20 ms**, because this sampler accepts 80 of 211 candidates where the mid grove accepted 400 of
28 818 — a small target in a large annulus barely rejects anything, so `blocked` runs 165 times
instead of 11 850. The reorder would be correct and would save about **10 ms of a 1 050 ms phase**.
**Not shipped**: the phase's cost is building the trees, not placing them, and a reorder that buys
1 % of a phase is not worth a diff in another lane's sampler. The question is closed.

## Files

- `bitcheck.txt` — the geometry total above.
- `six-head.json` — the six views from `pose-counts.mjs`.
- `playtest.json` — the look / walk / perf run.
- `counts-before.json`, `counts-after.json` — F_canopy and E_ground from both builds, with md5s.
- `whitebark-sampler.json` — §5's timings.
