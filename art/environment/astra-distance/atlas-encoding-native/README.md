# Native atlas encoding study

**Recommendation: accept source commit `101e3fcc`.** Only the four Color-to-CSS helpers change. Source base `64d5b7c9` has byte-identical `src/` to the baseline capture source `0645b7d3`. Root geometry candidate commits remain on the separate `agent/astra-distance-quality` branch and are excluded here.

One native D3D11 capture ran under the shared capslot, session16684, with infinite stale timeout and 900000ms readiness timeout. It completed seven views without reported shader/browser errors and released the slot. Baseline: parent `art/environment/astra-quality/leaf-warmth-final`; candidate: `art/environment/2026-09-20T18-01-32-889Z-daylight` in this worktree.

The copied daylight helper SHA256 matches the baseline exactly. Every view uses explicit `warm50 / uTreeLeafWarmth=.5`. Camera position/direction/FOV, lighting audit, simulation time12.6, dimensions and pixel ratio match exactly; both source PNG hashes are verified. Draw and triangle counts match for every view. A remains **8,741,626 triangles /571 draws**. The seven-view sequence caches95 textures versus the baseline's98 after its extra B/D/E views; A starts at95 in both. This is not a claimed memory optimization. Program counts match.

| View | Display luminance before → after | Changed pixels, any channel >3/255 | Reference SSIM before → after |
| --- | --- | --- | --- |
| A | .37932 → .37950 | .33% | .2010 → .2009 |
| C | .35503 → .35593 | 1.93% | .2169 → .2144 |
| F | .33669 → .33694 | .46% | .2353 → .2348 |
| sky-opening | .43465 → .44009 | 19.42% | — |
| f4-crown-up | .32549 → .33373 | 29.25% | — |
| actual119m view | .23341 → .30746 | 63.35% | — |
| actual121m view | .23552 → .30943 | 63.14% | — |

These are full-frame, encoded display luminance measurements; the separate CPU texture measurements are linear albedo. The high views contain real placed trees at varying depths, so the full-frame values are not a measurement of a single tree at119/121m.

All seven paired images were inspected directly. The distant views show olive-green leaf clumps and clearer internal foliage where the baseline had crushed dark masses. Dark interiors remain. Sky-opening and f4-crown-up gain modest green variation among their shaded layers; nearby physical leaves, bark and major dark C/F inner-crown masses retain their appearance. Existing crossed card planes are still conspicuous in the high views. The slight reference SSIM losses above remain disclosed. No walking sequence or broad performance benchmark was run; the overall grey look of fogged physical trunks/leaves is not solved by this atlas correction.

CPU check `node art/environment/astra-distance/atlas-encoding-check.mjs 64d5b7c9` passes all six production resolution cases: candidate texture bytes match the correct-encoding brush oracle, repeat deterministically, and preserve alpha, normal/thickness, overlap/depth and sampling settings exactly. Source outside the four helper declarations is byte-identical. `npm run typecheck` and `npm run build` passed before the immutable native capture. No new triangles, draws, material passes, texture bytes or per-frame work are introduced.

`comparison.json` contains all exact metadata assertions and metrics. The paired PNGs show baseline on the left, candidate on the right. Re-run the CPU image comparison with:

```
node art/environment/astra-distance/atlas-encoding-native-compare.mjs art/environment/2026-09-20T18-01-32-889Z-daylight
```
