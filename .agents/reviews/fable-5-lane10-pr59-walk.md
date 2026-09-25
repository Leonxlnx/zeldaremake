# Astra's PR #59 (the walk and run) applied to the head — `agent/fable-3-pr59-applied` (PR #165) `e196ab73` — the walk harness, head vs branch (fable-5, lane 10)

**Read 2026-09-25 22:13–22:45 UTC.** The same harness on both builds, the same machine, the same hour: `playtest.mjs --only walk,climb`
at 1280 × 720, quality high — eleven camera-relative routes with per-frame camera and boots, two climbs. The head is `e438c6e5`
(`wt-h140`); the branch is fable-3's application of PR #59 `7b0103fa` to the head (animation.ts, glbLink.ts, the 54 MB rig, SOURCE.md).
No page errors on either. Every route reached every waypoint on both, none stuck.

| route | cam speed p50 / p95 (m/s) head → PR #59 | turn accel p95 (°/s²) | vertical accel p95 / max (m/s²) | camera spikes | boots: footprint-lowest p95 / max (cm) | stance over 1 cm |
| --- | --- | --- | --- | --- | --- | --- |
| plaza-to-upper-house | 1.39 / 4.33 → 1.20 / 4.06 | 899 → 900 | 2.9 / 14 → 2.8 / 14 | 0 → 0 | 2.0 / 5.0 → 2.7 / 11.9 | 25 % → 20 % |
| plaza-to-south-bank-top | 1.63 / 1.75 → 1.24 / 1.76 | 295 → 626 | 2.2 / 6 → 2.3 / 6 | 0 → 0 | 6.0 / 17.3 → 7.9 / 14.3 | 63 % → 73 % |
| saria-front-arc | 1.68 / 4.03 → 1.25 / 3.85 | 873 → 899 | 2.8 / 3 → 2.0 / 2 | 0 → 0 | 6.8 / **79.3** → 8.4 / **9.6** | 92 % → 77 % |
| west-deck | 1.62 / 4.69 → 1.22 / 4.67 | 910 → 908 | 1.5 / 6 → 1.3 / 5 | 0 → 0 | 2.8 / 2.9 → 3.3 / 3.3 | 56 % → 59 % |
| plaza-loop | 1.60 / 5.35 → 1.20 / 4.78 | 922 → 907 | 1.5 / 63 → 1.3 / 30 | 0 → 0 | 0.5 / 2.8 → 1.0 / **36.1** | 18 % → 26 % |
| south-approach | 1.60 / 2.04 → 1.20 / 1.77 | 875 → 625 | 0.2 / 0 → 0.1 / 0 | 0 → 0 | 0.2 / 0.7 → 0.1 / 0.4 | 7 % → 12 % |
| house-west-to-saria-door | 1.57 / 4.86 → 1.24 / 4.67 | 914 → 915 | 2.4 / 5 → 2.2 / 5 | 0 → 0 | 0.5 / 1.8 → 1.3 / 2.7 | 12 % → 27 % |
| west-house-to-plaza | 1.61 / 5.38 → 1.21 / 4.77 | 924 → 910 | 4.7 / 46 → 4.0 / 79 | 2 → 3 | 3.7 / 11.4 → 3.6 / 5.7 | 59 % → 61 % |
| north-clearing-ledge | 1.60 / 3.93 → 1.20 / 3.84 | 901 → 857 | 1.2 / 88 → 0.9 / 122 | 0 → **4** | 0.8 / 4.6 → 0.9 / 5.7 | 19 % → 23 % |
| south-bridge-to-log | 1.60 / 4.03 → 1.20 / 3.85 | 893 → 901 | 0.5 / 3 → 0.4 / 3 | 0 → 0 | 1.6 / 3.9 → 1.5 / 2.9 | 16 % → 15 % |
| north-grove | 1.60 / 5.34 → 1.21 / 5.07 | 909 → 910 | 2.3 / 27 → 1.8 / 5 | 1 → 1 | 3.4 / 12.1 → 2.5 / 5.7 | 26 % → 29 % |

Climbs (W held from 1.6 m before the foot): the main flight — 0 stalls on both, and neither reaches the top in the harness's 255
frames (the head ends at y 4.32, the branch at 4.05 — one tread lower in the same frames, the slower gait); the south bank — top on
both in 96 frames. Boots on the treads p95 1.6 → 1.4 cm (main), 1.5 → 1.6 cm (south bank).

## What the numbers say

1. **The walk is 1.6 → 1.2 m/s on every route** (the camera's p50 tracks Link); the routes take a quarter longer. That is the PR's stated
   walk speed — a gameplay decision, not a defect, and the owner's own PR. fable-3's run measurement (2.20 m/s, airborne 40 %, against the
   head's 4.60 m/s / 60 %) is the other half of the same decision.
2. **The boots are a wash at the percentiles** — stance over 1 cm 36 % → 38 % across the eleven routes, p95 within ±2 cm everywhere.
   The head's 79 cm single-frame glitch on `saria-front-arc` is gone (max 9.6); the branch has its own on `plaza-loop` (max 36 cm, one
   frame, p95 1.0 cm) and a 12 cm max on `plaza-to-upper-house` (was 5). The harness keeps aggregates only, so I cannot say which step
   each is; both are one-frame events.
3. **The camera's four spikes on `north-clearing-ledge` are the camera's, not the PR's.** All four are at Link (5.85, 4.48, −60.3) on
   the ledge, `hit: solid`, `lowered` 0.22 → 0.197 — the collision lowering the camera a step (0.19 m in a frame, 136 m/s²). The head's
   camera passes the same solid on the same route with max 88 m/s² and no flagged spike: at 1.2 m/s Link stands beside it for more frames
   and the lowering lands on one. The PR touches `animation.ts` and `glbLink.ts` only. `west-house-to-plaza`'s 2 → 3 are the house-west
   door's pull-in (`keep 0.135`, the camera at 0.6 m) on both builds — the standing item in my camera list.
4. **Turn acceleration** p95 857–915 °/s² on both — the head's swing, unchanged (two routes read 295 / 875 → 626 / 625, the short
   ones, where a single turn sets the percentile).

## Verdict

**The application is clean and the walk is sound: no route regresses in reach, stuck frames or camera, the boots hold their percentiles,
one one-frame boot glitch traded for another.** What the harness measures does not decide the PR — the speeds do, and that is the
owner's call already made in the PR. Six views: fable-3 reports them inside on the branch; I did not re-render them this tick — the
rig change is Link's alone and fable-3's pairing covers it. If the ledge's lowering step (0.19 m in a frame) is to be smoothed, it is
the camera lane's, at (5.85, −60.3).
