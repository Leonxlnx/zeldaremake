# 26 hours of merges took 0.23–0.37 M triangles out of every fixed view without moving one pixel

Several lanes claimed "pixel-identical" for their cost work overnight — fable-4's near-canopy batch and
`nearbox`, fable-2's kit cast proxy, the `keepinstanced` sweep exemption, and others. Each claim was made
for its own change. Nobody had checked the **cumulative** result, which is the only number that matters
for the sealed frames.

## The check

The same five distinct fixed viewpoints (E repeats B's camera), rendered with the same harness, size,
settle and shots order on two heads a day apart:

* **then**: `e438c6e5`, 19:30 on 2026-09-25;
* **now**: `2b15f687`, 21:40 on 2026-09-26.

| frame | pixels moved > 4 | mean | local detail | SSIM vs reference | triangles then → now |
| --- | --- | --- | --- | --- | --- |
| A_stairs | **0 %** | 95.6 → 95.6 | 4.83 → 4.83 | 0.3332 → 0.3332 | 8.97 → **8.64 M** |
| B_house | **0 %** | 92.6 → 92.6 | 4.64 → 4.64 | 0.2412 → 0.2412 | 8.29 → **7.95 M** |
| C_lookback | **0 %** | 90.9 → 90.9 | 4.44 → 4.44 | 0.1236 → 0.1236 | 7.96 → **7.73 M** |
| D_log | **0 %** | 90.6 → 90.6 | 4.15 → 4.15 | 0.4021 → 0.4021 | 8.74 → **8.37 M** |
| F_canopy | **0 %** | 85.5 → 85.5 | 4.78 → 4.78 | 0.4330 → 0.4330 | 8.10 → **7.84 M** |

Draws fell by 39 on every one of them (`../freshposes/PERF-HEALTH.md`).

**Zero pixels moved on any frame** while 0.23–0.37 M triangles and 39 draws left each one. The individual
"pixel-identical" claims hold not just one at a time but stacked, which is the thing a reviewer cannot take
on faith from five separate PRs.

## Why the comparison is sound

* same shots file, same `--size 960x540 --settle 8`, same pose order — pose order matters, because pool
  residency carries between poses inside one run (`../INDEX.md`, method notes);
* SwiftShader has been deterministic across builds all day in this lane's measurements (two independent
  builds of the same source produced byte-identical frames in `../dither/PART1-*`), so a zero here is a
  real zero rather than a tolerance.

## What it leaves

The frames are fixed and 0.23–0.37 M cheaper; the remaining cost work is all in play mode, where the
flight's foot is 2.7 % over at the high tier only (`../tiers/`) and its 0.22 M is priced to vegetation
(`../vegmenu/`).

## Re-checked after the sign feature went in unreviewed (head `97e9a7dc`, 05:15 on the 27th)

`5e448ef3` and `5af5d697` (Link holds a sign over his head, on T / gamepad Y) and `97e9a7dc` were
committed **straight to the integration branch**, so no PR carried a frame check for them. The same five
frames, same harness and pose order, against the set from before those commits:

| frame | pixels moved > 4 | SSIM vs reference |
| --- | --- | --- |
| A_stairs | **0 %** | 0.3332 → 0.3332 |
| B_house | **0 %** | 0.2412 → 0.2412 |
| C_lookback | **0 %** | 0.1236 → 0.1236 |
| D_log | **0 %** | 0.4021 → 0.4021 |
| F_canopy | **0 %** | 0.4330 → 0.4330 |

Byte-identical, as a play-mode-only character feature should be — the six frames capture with the
character hidden, and the pose is driven by input that a fixed capture never sends. Recorded because an
unreviewed commit to the head is exactly the case where nobody else was going to check.
