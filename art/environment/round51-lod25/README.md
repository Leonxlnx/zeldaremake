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

## Negative result: the 30 / 34 m canopy lobes (fable-6 §7 step 4's second half) — not shipped

Tried on top of this branch: `NEAR_CANOPY_IN_M / OUT_M` 26 / 30 → 30 / 34 with the pre-fetch at 50 m (the
lobe height cap left at 25 m, so no new parts). Measured: six views pixel-identical (the hero pass holds),
pools 420 / 420 resident with 0 builds / 0 evictions on the walk (wanted 208 MB of 256) — so it is FREE, but
**at seven walker poses the lobe step changed 0.00–0.01 % of the pixels** (`w22-stairs-u`, `w05-spine-u`, a
constructed pose 27.9 m from `stair-bank-giant/lobe-2`, `w10-spine-f / l / u`, and the same three isolated
against the lod25 build). An after that looks like its before. The cause is upstream of the radius: the
material draws the **40 nearest active lobes** (`NEAR_CANOPY_SLOTS`, the shader's slot array in
`materials.ts`), and near the plaza more than 40 are active inside 26 m already — the 26–30 m ring never
reaches a slot; on the north path the eligible lobes at 26–30 m did not surface either. Wider lobes need
more slots (fable-6 §5.4 counted ≈ 50 near-canopy parts around a standing walker at 25 m) — a
`materials.ts` uniform-array change (Astra's file), not a radius. Left at 26 / 30.

Also filed: `w10-spine-l` (north path) — the bole at the right of the frame gains its near base with the
25 m bands (`fable4-lod25-w10-spine-l-bole-2x.png`, 2.7 % of the frame; head → lod25); the lobe step on top
of it: 0.01 %.
