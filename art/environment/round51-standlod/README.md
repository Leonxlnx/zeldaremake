# Round 51 — fable-4: the north stand's poles take the far LOD beyond 50 m (W38 give-back)

**Branch** `agent/fable-4-standlod` (one file: `src/world/trees/index.ts`, `bucketDistant`).

## Why
fable-2's grass blades to 26 m (14:10) left A at 8.83 M — 170 K under W38. The stand beyond the
north clearing (round 50, `agent/fable-4-r50-arch-far`: ~150 band-only 26 m poles at z −64…−90)
stands 60–100 m from A, B, D and E inside their frusta, behind the north rise, and drew its **near**
LOD (bent trunk, limbs, root buttresses ≈ 500–1 000 triangles a pole) up to the global 120 m
near/far switch. The poles' only viewers — the arch approach (z −48), the tunnel (z −54.5), the
north path — are within 36 m.

## What
`bucketDistant`: a placement that is a stand pole (`set.variant.bandOnly && p.z < −62`) switches to
the far LOD (crossed tapering strips, the same crown cards) at **50 m × quality.distance** instead
of 120 m. fable-cursor's far-trunk row at z −46 (D's 41 m depth histogram) is not north of the
clearing and keeps 120 m. Placements, seeds, the distant sets' contents: untouched — only the
per-camera near/far lists change.

## Measured (head `68b3eb96` vs branch, same box, `--settle 6`)
| view | head draws / tris | branch draws / tris | Δ tris | SSIM Δ | pixels > 6 |
|---|---|---|---|---|---|
| A | 452 / 8.83 M | 455 / 8.78 M | **−50 K** | +0.0000 | 4 (0.000 %) |
| B | 434 / 7.93 M | 437 / 7.88 M | −50 K | +0.0000 | 6 (0.001 %) |
| C | 342 / 6.83 M | 342 / 6.83 M | 0 | +0.0000 | 0 |
| D | 391 / 8.02 M | 394 / 7.97 M | −50 K | +0.0000 | 416 (0.045 %) |
| E | 434 / 7.93 M | 437 / 7.88 M | −50 K | −0.0001 | 6 (0.001 %) |
| F | 408 / 8.04 M | 408 / 8.04 M | 0 | +0.0000 | 0 |

The +3 draws at A/B/D/E are the far-LOD instance sets that now have members at those cameras
(455 ≤ 700). D's 416 pixels are the strips through the arch at 60–90 m in 60 % haze —
`D-arch-before-after.png` (head left, branch right, ×3).

**The three arch poses** (`x-arch-approach`, `x-arch-tunnel-n`, `x-northpath-n`, broll 1280×720
settle 12, head vs branch): **0 pixels differ** at all three — the poles there are 10–36 m away and
keep the near LOD.

A after this: 8.78 M — 220 K under W38 with the grass change in.

## Verification
`npm run typecheck` green, build green, `lodPool.test.mjs` 10/10.
