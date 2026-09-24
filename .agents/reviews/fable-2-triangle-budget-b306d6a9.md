# fable-2 — the six views and camera A's triangles by system on the head `b306d6a9` (2026-09-24 09:30)

The morning's merges — stairs-look + the stone value, near-veil, treepop, the music branches, south props, the ravine rock, the
east verge — measured together on the head, with the sealed take and yesterday's head for scale. Same harness as the ledger
(`capture.mjs --settle 12`, 1280 × 720, `--no-checks`; the character visible as the head shows it).

## The six views

| view | draws / triangles | SSIM vs the frames | sealed take-0134 | head `393fce60` (yesterday 19:20) |
|---|---|---|---|---|
| A_stairs | **638 / 8.87 M** | 0.2014 | 0.218 | 0.1813 (**+0.020**) |
| B_house | 627 / 8.29 M | 0.1862 | 0.198 | 0.1711 (+0.015) |
| C_lookback | 570 / 7.93 M | 0.1878 | 0.213 | 0.1875 (0) |
| D_log | 561 / 8.63 M | 0.2572 | 0.266 | 0.2544 (+0.003) |
| E_ground | 627 / 8.29 M | 0.2088 | 0.219 | 0.1928 (+0.016) |
| F_canopy | 598 / 8.01 M | 0.2105 | 0.225 | 0.2094 (+0.001) |

Every view under 700 / 9.0 M; A's determinism 0.00 %. The stone flight (stairs-look + the value) and lane 1's air are the +0.020
at A; C is flat against yesterday while the south grew under it (7.70 → 7.93 M since `92a4fd66` this morning: the east verge's ground
cover and the south props, not the ravine rock, which is gated off at C).

## Camera A by system (`__ZR__.isolate`, the whole frame then the shadow pass off)

| system | draws | triangles (main + shadow) | main pass only | shadow pass | my 2026-09-22 map (`110453d4`) |
|---|---|---|---|---|---|
| trees | 217 | **2.85 M** | 1.52 M | **1.34 M** | 3.06 M |
| vegetation | 126 | **2.45 M** | 2.15 M | 0.30 M | 1.95 M (+0.50) |
| structures | 119 | 2.01 M | 1.29 M | 0.72 M | 1.93 M |
| terrain | 33 | 0.63 M | 0.28 M | 0.35 M | 0.63 M |
| hardscape | 15 | 0.54 M | 0.52 M | 0.02 M | 0.75 M (−0.21: the flagstones no longer cast) |
| rocks | 35 | 0.24 M | 0.15 M | 0.09 M | 0.24 M |
| character | **63** | 0.18 M | 0.09 M | 0.09 M | 0.14 M |
| props | 14 | 0.10 M | 0.04 M | 0.05 M | 0.09 M |
| atmosphere + canopy | 11 | 0.01 M | 0.01 M | 0 | 0.01 M |
| **frame** | **638** | **8.87 M** | **6.06 M** | **2.82 M (32 %)** | 450 / 8.74 M |

Read for the budget's owners:

- **The shadow pass is a third of A** (2.82 M) and trees are half of it (1.34 M): the white-barks behind the camera cast from medium
  geometry since the perf pass; the giants still cast from what they draw. Structures cast 0.72 M — the houses' full shells.
  Terrain casts 0.35 M for a self-shadow the slopes hardly show at A.
- **Vegetation is the one system up since the 22nd** (+0.50 M): the understory layers and the finer leaves; squad4's verge tier
  (−54 K at A, merge-ready by two reads) is still outside the head.
- **Draws 450 → 638**: the characters are 63 of them (Link and the kids, skinned to their own joints) — the third-largest draw
  count after trees and vegetation for 2 % of the triangles; the structures 119. The 700 cap has 62 to spare at A; every new area
  that A can see spends from that.
- hardscape and rocks sit where they were (0.54 / 0.24 M); the stone flight cost nothing over the timbers it replaced.

Renders `/tmp/cap-head44/`, probe log `/tmp/f2/budget99.log` (`budget87-shots.json`).
