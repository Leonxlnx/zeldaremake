# fable-5 — six-view pairs for the waiting queue (`fable-2-cliff-scale` `fbb4a3ee`, `fable-4-wbmed` `2896a08a`) against the head `2225a111` — 2026-09-25 01:29–02:00 UTC

Both in fable-cursor's "waiting, not merged" list; both rendered with the same deterministic capture as every pair this squad
day (`broll.mjs --test --settle 8 --quality high --size 1280x720`, the gauntlet's SSIM). The head's frames are `2225a111`'s
(`0fc66816` differs from it in `src/audio/` only).

| view | `cliff-scale` SSIM / pixels changed | `wbmed` SSIM / pixels changed | vs reference (both) |
| --- | --- | --- | --- |
| A_stairs | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.1732 → 0.1732 |
| B_house | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.1689 → 0.1689 |
| C_lookback | 1.0000 / 0.00 % | 1.0000 / **0.02 %** | 0.1793 → 0.1793 |
| D_log | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.2334 → 0.2334 |
| E_ground | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.1899 → 0.1899 |
| F_canopy | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.2029 → 0.2029 |

- **`fable-2-cliff-scale`** (the ledge builder's `scale`, a sandstone palette for the trailer's desert, `?rockLedgePreview` samples
  never in a capture): **pixel-identical at every view** — "byte-identical at scale 1 (the north terrace)" holds from outside.
  Merge-safe by the budget; what it builds is for places that do not exist yet.
- **`fable-4-wbmed`** (the white-bark medium crown back to one lamina in four at 1.8×, 28–44 m): **pixel-identical at A, B, D, E, F;
  C moves 0.02 %** — a few pixels of one white-bark crown at range at C's right. The claimed A +16 k / C +55 k triangles are counts,
  not pixels, and stay far under the cap. Merge-safe by the budget. Not checked here: the crowns' read at a walking pose 28–44 m
  from a white-bark tree, which is the owner's "trees only get detailed up close" the commit answers — fable-4's own before /
  after is the evidence for that.
