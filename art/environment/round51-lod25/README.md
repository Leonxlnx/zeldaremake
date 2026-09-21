# Round 51 — the 25 m near-LOD dial (fable-4 for the paused lod-1 lane; fable-6 §7 step 4)

`docs/PERF_2026-09-19.md` §7 (4): "25 m is the follow-up … ship it only if the pool of (1) holds it without
churn" — and §5.4's "25 m with 256 MB". Taken with fable-cursor's 04:55 offer while lod-1 is blocked.

## What changed (`trees/index.ts` NEAR_LOD_TIERS.large, `giant.ts` NEAR_BASE_RADIUS_OVERRIDE_LARGE)

| dial | head (large tier) | this branch | small tier |
| --- | --- | --- | --- |
| near-base band (default) | 18 / 21 m | **25 / 28 m** | 10 / 13 (unchanged) |
| per-camera bands | round-44 table | re-derived for 25 m under the same rule (nearest fixed camera ≥ 2 m outside the out-radius, never narrower): north-east / far-plateau / swap-8 / seat-8 → 25 / 28; north-west 24.5 / 27.5; seat-2 23 / 26; east-giant 21.5 / 24.5; seat-1 20.5 / 23.5; seat-5 18.5 / 21.5; the 13 camera-bound boles keep theirs | unchanged |
| base pre-fetch | 30 m | **38 m** | 22 |
| base pool | 32 MB | **48 MB** (all 23 bases ≈ 33 MB resident) | 12 |
| canopy pool | 192 MB | **256 MB** | 64 |
| canopy swap | 26 / 30 | 26 / 30 (unchanged) | 22 / 26 |

Why the canopy pool and not the canopy swap: the head's own six-pose audit (large tier, deviceMemory 16 on
this box) shows the 26 / 30 swap already wanting 375 parts / 193 MB inside the 42 m pre-fetch at F against
192 MB — 80 evictions and 28 rebuilds across six still poses. 256 MB makes the whole part set resident.

## Measured

- **Six views** (head `c4d12f6c`-code → branch, settle 6, one Chrome, the large tier in both): **A–F
  pixel-identical** (0 pixels beyond 2 levels); draws 440/420/338/390/420/405 and triangles (A 8.61 M)
  identical. Pools at the end of the six poses: base 21/23 resident, 2 evicted → **23/23, 0**; canopy
  368/420, 80 evicted, 28 rebuilt → **420/420, 0, 0**; synchronous builds 0 → 0.
- **The walk** (`perftrace.mjs --norender`, 2 400 frames, plaza → north path; both JSONs here): head —
  canopy 268 builds / 315 evictions, base 4 / 6, trees.update p95 5.3 ms (max 7.1), 218 frames spiked by
  trees, step p95 8 ms; branch — **0 builds / 0 evictions in both pools, trees.update p95 0.2 ms (max
  4.4), 2 tree spikes, step p95 4.4 ms**; 0 synchronous builds in both; longest build chunk ≤ the 6 ms
  budget (nothing built). fable-6's acceptance holds on this box (SwiftShader; the native re-measure is
  lod-1's item 1 when it resumes).
- **The visible half**: `w11-spine-f` (north-west 21.7 m, north-east 23.6 m from the walker) — the bole at
  22 m goes from the plain sweep to its near base: cord relief, a buttress flare, moss with edges
  (`fable4-lod25-w11-spine-f-bole-2x.png`); 2.1 % of the frame. `w23-stairs-f` / `sn-bole-nw-near`
  unchanged — the widened boles sit off those frames.

Not done here: the 30 m canopy lobes (fable-6 measured C −0.0005 / D −0.0009 for them) — a second step with
its own measurement, and one that raises the resident set again.
