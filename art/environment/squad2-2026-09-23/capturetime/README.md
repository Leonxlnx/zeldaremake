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
