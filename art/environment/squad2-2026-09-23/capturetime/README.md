# `--settle` is not a warm-up knob: it sets the world time the shot is taken at

Lane 2, 2026-09-29. For whoever owns `gauntlet/scripts/` — this is a finding about the capture tool, not a
change to it.

## How it came up

`anti-cheat` on this branch reported `B1 no capture found (gauntlet/out/last) — capture checks skipped`, so I
ran `npm run capture` to let those checks execute. On this box it logged

    A_stairs: 11.10 s/frame — 90 settle frames ≈ 999 s
    captured A_stairs (The Stairs) in 3591.0s — 559 draws, 8.63M tris
    captured B_house (Saria's House) in 3343.8s — 541 draws, 7.90M tris

**About an hour a viewpoint**, so eight-plus hours for the set. (AGENTS.md's "renders all viewpoints in
~20–60 s" is badly stale for SwiftShader.) I stopped it after two viewpoints and asked whether the 90 frames
are needed, because this lane's `settle/` round had already measured that the trees' own submission is final
on frame 1.

## What the 90 frames actually do

`renderAt` (capture.mjs) sets the clock **once** and then renders the settle frames with time advancing:

```js
await page.evaluate((t) => window.__ZR__.setTime(t), simTime);   // 12.5 s
…
await page.evaluate((k) => window.__ZR__.render(k, 1 / 60), n);  // dt = 1/60, `frames` of them
```

So the shot lands at `simTime + frames / 60`: **12.7 s at `--settle 12`, 14.0 s at `--settle 90`.** The
settle is also 1.3 s of wind, sun and drifting mist.

Measured, same build, same viewpoint, one changed flag:

| | draws | triangles | wall clock | image |
| --- | --- | --- | --- | --- |
| `--settle 90` (the default) | **559** | **8 626 622** | 3591.0 s | md5 `e8318d07085b` |
| `--settle 12` | **559** | **8 626 622** | **206.7 s** | md5 `9c74b0ac7dad` |

**Identical geometry state, 32.079 % of the pixels different** (max Δ 190/255, SSIM 0.83200). Draws and
triangles to the digit; a third of the frame repainted. That is not settling — the LOD and pool state is the
same at both — it is 1.3 s of world time, the same effect `settle/` documented when an early probe advanced
1/30 s a step and "every group appeared to change 13–31 % of the frame".

## Why it matters

1. **`--settle` cannot be lowered to speed anything up.** Every reference image in the ledger encodes
   `settle / 60` seconds of motion past `DEFAULT_SIM_TIME`, so a shorter settle is a 32 %-different picture,
   not a faster identical one. Two captures at different settles are not comparable at all.
2. **The cost is real:** 3591 s a viewpoint here against 206.7 s at `--settle 12` — a **17×** difference, and
   the gauntlet workflow runs a capture on every push.
3. **A one-line change would separate the two concerns:** re-apply `setTime(simTime)` after the settle loop
   (or settle with `dt` and then reset the clock) so the shot is always at `DEFAULT_SIM_TIME` whatever the
   settle. `--settle` would become the pure warm-up knob it reads as, and CI could pick the smallest value
   that warms the pools — which for this lane's near-LOD pools is 1 frame (`settle/`), and for the other
   systems is unmeasured and worth measuring before choosing.

That change would move every reference image once, so it is a decision for the gauntlet's owner and the
ledger, not for this lane. Nothing here touches `gauntlet/scripts/` or `src/capture/api.ts`.

## Files

- `settle12.log`, `settle90.log` — the two runs' own output.
- The frames themselves are not committed (1.4 MB each); the md5s above identify them, and the command is
  `node gauntlet/scripts/capture.mjs --viewpoints A_stairs --settle <n> --no-checks --out <dir>`.

## The other half: the capture-based checks, run at last

`--settle 12` made a full capture affordable, so the checks that had been skipped since this branch began
finally ran. **Six viewpoints, the determinism re-capture and the motion shot in 39.6 minutes** (2 374 596 ms)
against the eight-plus hours the default settle projected:

| | time | draws / triangles |
| --- | --- | --- |
| A_stairs | 202.2 s | 559 / 8.63 M |
| B_house | 204.0 s | 541 / 7.90 M |
| C_lookback | 189.6 s | 479 / 7.68 M |
| D_log | 224.2 s | 465 / 8.24 M |
| E_ground | 203.4 s | 541 / 7.90 M |
| F_canopy | 222.7 s | 500 / 7.83 M |
| A_stairs.det / .motion | 200.7 / 198.7 s | — |

Then `anti-cheat --take /tmp/cap-all`: **green, 109 checks** (102 without a capture), every capture-based one
passing:

```
✓ B1 6 screenshot(s) match the hashes recorded by capture.mjs
✓ B2 capture not yet in the ledger (attestation assigned by take.mjs; this run is local)
✓ B3 6 audit claim(s) cross-checked against the scene graph
✓ B4 5 placement sample set(s) spot-checked
✓ B5 A_stairs re-capture differs in 0.000 % of pixels
✓ B6 console clean during capture
✓ C2 runtime scene has no video/reference textures
✓ C3 4 hero viewpoint(s) have layered depth (max bucket beyond 20 m ≤ 35 %)
```

Three of those are worth calling out for this branch. **B3** cross-checks every system's audit claims against
the live scene graph — the check that would catch an audit number that stopped matching reality after the
depth culls, the builder rewrites and the single-pass change; it passes on all six viewpoints. **B5** says the
frame is reproducible to **0.000 % of pixels** at `--settle 12`, so the shorter settle is not "less settled",
which is the measurement the §-above recommendation rests on. And **C3** is this lane's own subject: four hero
viewpoints have layered depth with no bucket beyond 20 m over 35 %, which is the distance layers doing their
job.

The source-side checks passed too: **C1** found none of 138 rasters within Hamming 12 of a reference frame (no
reference frames used as scenery), **C4** 69 textures credited, **C5** no Nintendo-derived asset names, A1–A4
rubric integrity, D1 the ledger chain intact over 134 entries.

The 90 warnings are all D3 "targeted unclaimed item(s)" lines from other agents' historical takes — none of
them this branch's.
