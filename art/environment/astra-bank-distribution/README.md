# Fixed-budget bank surface distribution — rejected CPU candidate

**Rejected for delivery before native capture, with independent root agreement.** Source-only `588d3681678c17b236203d8785b60ea2e6c2bba3` is frozen directly on canonical `68b3eb96dc19886154e54e8de584fadf91f5eda7`. Only `giant.ts` and `nearCanopy.ts` change. The exact two-file patch is `source-588d3681.patch`. The candidate source was not pushed or proposed as a PR; this branch publishes only its evidence and rejected patch. No GPU capture or geometry sweep follows. Current production retains the previously accepted 0.60 bank.

The original opaque cores are restored. Camera-independent farthest-point seeds on their actual triangle surfaces carry connected surface-following shoots and the existing alternating nearSpray laminae. The same leaf caps remain: 2,800 / 2,100 / 2,200. Nominal shoot support uses one quarter of the measured ~22 cm leaf length per leaf, with whole leaves filtered inside the original total core/leaf/card envelope. Inward growth directions reflect outward. Ordinary trees and the shared writer/packing/upload-disposal code are untouched.

## Measured result

Both core-depth masks are byte-identical to rejected `063772a4`; same frozen native camera poses, 1280×720 and time 12.6. The CPU comparison applies each ref's actual attribute storage: 063 Float32 wind, 588 the exact canonical normalized Uint16 packing helper. Both use independent world-space ray checks, including original floor triangles: 131 F + 99 C checks per source, all agreeing with the pixel-centre raster.

| Metric | F: 063 → 588 | C: 063 → 588 |
| --- | ---: | ---: |
| Frontmost fine leaf / original core mask | 16.50% → **31.30%** | 16.05% → **40.36%** |
| Average front-of-core leaf overlap | 3.56 → **1.79** | 3.51 → **1.67** |
| Largest contiguous bare-core component | 80,153 → **27,522 px** | 58,146 → **12,076 px** |
| Unoccluded fine area outside core mask | 12,777 → **14,128 px (+1,351)** | 9,236 → **7,312 px (−1,924)** |

The distribution improves, but large bare faces persist: F's largest region spans x795–1114/y95–294; another 17,536-pixel region spans x578–786/y0–132. C's largest spans x40–241/y107–270. Thus this is useful negative evidence, not a finished botanical surface. No capture follows this CPU result.

Group 26's original horizontal floor occupies 3,173 nearest-core-mask pixels in **each** view, with different correct sample coordinates. Zero receive its own fine leaves in front. Lower group 24 leaves cover 253 of those pixels in F and 270 in C. The local floor 4.730642565409653 + origin Y 0.019357434590347555 = world **4.75 m**. Keeping new geometry above that plane prevents its own leaves from covering the plane from below. The much larger remaining bare areas include movable flanks, so this floor limitation explains only part of the failure.

## Constraints and cost

- All **7,100** leaves retained; **64,474** near triangles = 56,800 leaves + 7,674 wood, **966 fewer** than the canonical 65,440. Shoots: **40 / 32 / 28**. No added meshes/materials/textures.
- Raw builder buffers: **4,866,396 B**. Actual packed selected mesh buffers: **3,933,156 B**, down 80,124 B from canonical. These are distinct measurements; CPU surface records needed for rebuilds are additional JS objects, not included in GPU buffer bytes.
- Actual core areas: **37.446 / 25.851 / 28.643 m²**. Group 26 horizontal bottom: **3.879 m²**. Minimum seed separations: **0.739 / 0.707 / 0.723 m**. Median supported shoot lengths: **3.648 / 3.568 / 2.928 m**. The compact receipt also reports total shoot length per accepted leaf; this aggregate is not a minimum petiole separation.
- All **1,479 original core vertices**, original far laminae/cards and wood records preserved/restored. **560 unrelated built geometries, 423 other near parts, 31 white-bark records**, and all unrelated rendered bindings/packed geometry remain exact against 68.
- **1,034 PRNG streams / 14,052,615 draws** exact; only six selected near streams change. Deterministic rebuild, authored tones, bounds, floors and shadow policy pass.
- New group 26 all-phase minimum: **4.818209 m** before an additional conservative Uint16 rounding guard (<3 micrometres vertically), still above 4.75. All envelope margins also exceed the packing-error guard.
- Observed initial selected-part builds: **194 / 109 / 108 ms**; rebuilds **106 / 96 / 74 ms**. These are single CPU runs, not a concurrent-load benchmark. The surface lookup runs before the first yield; its isolated blocking duration was not measured. Full-worker observations were 19.54 s baseline / 22.22 s candidate. No optimization or geometry change follows this measurement.

Typecheck and build passed. `surface-proof.json`, `streams-and-floor.json` and `distribution-receipt.json` bind the checks to source. No current whole-world triangle headroom is inferred from older captures or from these selected meshes.

## Reproduction

The commands below record the original local harness with locked dependencies. They require the two retained local source refs and native-manifest path; this is an archived check, not a one-command fresh-clone runner. To reconstruct the source independently, apply `source-588d3681.patch` on public canonical `68b3eb96`, and reconstruct the earlier comparison by applying `../astra-bank-backing/REJECTED-063772a4.patch` on `520537e6`. Use separate checkouts and substitute the resulting local refs in the harness. The exact original native manifest is also archived at `../astra-bank-backing/native-pair/after/manifest.json`; any relocated runner must use those same bytes. Frozen receipts retain their original source identities and paths.

Original local commands:

```powershell
node --expose-gc --max-old-space-size=4096 art/environment/astra-bank-distribution/geometry-worker.mjs 68b3eb96 0 > art/environment/astra-bank-distribution/baseline-geometry-local.json
node --expose-gc --max-old-space-size=4096 art/environment/astra-bank-distribution/geometry-worker.mjs 588d3681 1 > art/environment/astra-bank-distribution/candidate-geometry-local.json
node art/environment/astra-bank-distribution/check-surface.mjs
node art/environment/astra-bank-distribution/check-streams-and-floor.mjs 68b3eb96 588d3681
node art/environment/astra-bank-distribution/measure-screen.mjs 063772a4
node art/environment/astra-bank-distribution/measure-screen.mjs 588d3681
node art/environment/astra-bank-distribution/compare-coverage.mjs
```

The screen runner reads the existing absolute native-manifest path recorded in the reports. It does not render. Raw large worker JSON remains local and regenerable. The final compact receipt includes source/report hashes and the exact patch hash.

Limitations: geometric pixel estimates omit original alpha cards, unrelated world meshes and other original wood, so unoccluded fine area is an upper bound. Packing is evaluated, but GPU float arithmetic, lighting, antialiasing and postprocessing are not simulated. Connected components use four-neighbour pixel connectivity; a split does not by itself imply convincing visual detail. No native image exists for 588 and no visual acceptance is claimed.
