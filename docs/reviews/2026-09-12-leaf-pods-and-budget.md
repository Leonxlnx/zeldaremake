# Leaf-wrapped post lanterns and hedge packing

The actual d7/ccc7 captures put B/E at 9,069,946 submitted triangles, above the 9M performance target. The known packing inefficiency is now removed on Astra's own branch before adding the two detailed pods. PR2 comment5646399040 documents the narrow overlap with Fable's active foreground work: his branch and sequencing are untouched, and all other vegetation remains frozen until his published changes can be reconciled.

## Packing

One line adds `hedge: [SINGLE(3), ALL(3), ALL(3)]` to the existing table. Each near instance submits only its chosen variant; medium/far packs retain their old layout. The applied file hash matches the reviewed candidate exactly. The pinned standalone proposal verifies all plant geometry, placements, RNG, active LOD/variant transforms and colours, material keys and shadow bindings. At the six saved viewpoints it estimates 202,648 fewer submitted triangles at four additional draw calls. Current LOD and plant placement suites also pass (65,408 vertices and 9,779 base checks). These are CPU contracts; actual rasterisation and budget still need CI.

## Reused original pods

`leafPod.ts` deliberately reuses Astra's original implementation from `45ed76dce4a2551d60074c25bf7d21f10e2124b8`, lantern blob `77a3f3f712326fdaed425aa2e92a333d2c054cfa`. Six cupped sepals, a small calyx, plant ribs, fine veins and tied fibre cords replace the broad acorn cap on the two `LANTERN_POSTS` rigs. The old builder was actually rendered in [this historical image](https://github.com/Leonxlnx/zeldaremake/blob/e2561df65cc0b185e76c87a6c29d73d229854496/progress/2026-09-11_091711-45ed76d/07-leaf-lantern.jpg); that image does not represent current lighting or placement.

An optional callback in `buildLanternPost` defaults to the current shared builder. Only the two explicit post call sites select `buildLeafLantern`; house, hanging branch and log-arch pods retain the shared implementation. Existing rope and sign work is preserved.

The replay against exact f630 source verifies unchanged post wood/rope/vines/leaves, light positions/colours/intensities, hook and pod center, swing state, four RNG values/order and parent RNG continuation. The default callback reproduces the previous basic post exactly; the selected helper reproduces all prior45ed leaf geometry attributes/indices under current dependencies. The amber body's position, colour, UV and index bytes are unchanged.

Every non-body vertex keeps both UV coordinates pinned to `(0.5, 0.95)`, retaining the earlier mip-bleed correction. Leaves and bindings use the dark part of the existing gradient and add no material or texture. Each rig still has one animated mesh; it now receives ordinary shadows, an intentional local change. No new degenerate triangles were introduced; the existing 28 lathe-pole triangles per pod remain. Sampled leaf roots cross the actual calyx surface by at least 0.320 mm; sampled leaf/body clearance is at least 8.09/9.89 mm. These are CPU samples, not exhaustive collision or GPU appearance claims.

Pod geometry rises from 816 to 10,546/10,418 triangles: +19,332 scene triangles, without new draw calls. With one colour and one sun-shadow submission, the conditional full-frame estimate becomes 8,905,962 triangles, about 94,038 below 9M, with a maximum around 654 calls. Future Fable foreground changes may alter this. The next actual L01/L02 frames must confirm leaf shape, non-glowing dark surfaces, hook contact, occlusion and full-frame performance. The original leaf cap is useful groundwork; its smooth shell and regular ribs are not claimed as reference quality.
