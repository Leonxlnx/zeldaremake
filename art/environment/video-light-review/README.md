# Lighting from the new owner video

The full reference and marked geometry tasks are in ../owner-video-review. This pass uses the existing lighting and fog controls: sun 3.7 to4.4, hemisphere .82 to.55, environment .3 to.22; distance haze starts at5m instead of2.5m, and density over8–15m falls from.012 to.008. Direction, exposure, geometry, materials, shadow filter and post-processing are unchanged.

The stronger key/fill separation makes sunlit stones distinct from cool shade and keeps the foreground clearer. It does not solve the smooth trunk/branch shapes or coarse vegetation. Fable has those tasks. The substantial existing material shade floors remain a future coordination point, not an unreviewed material rewrite.

| Before | After |
| --- | --- |
| ![](before.png) | ![](after.png) |

Both clean images: A_stairs,1280x720,time12.6,HUD off, identical saved camera, actual defaults without overrides. Before production2132882a; after0d76e902 plus the six-line source adjustment in this delivery. Manifests record actual camera/light values and source diff hashes. The entire seven-view after capture remains in the local timestamped folder2026-09-16T14-42-27-246Z-daylight.

Validation: build/typecheck pass,11520 real Three.js shadow projections pass, shadow-caster test passes. Standard default local take0113:24/50,phase1 20/42, no status regressions, zero console errors/determinism difference,84 anti-cheat checks pass. Purple share D .00382; overexposed fraction0 in all six views. Reference SSIM A .2334/B .2173/C .2436/D .2908/E .2279/F .2757; this is not a claim of reference parity or phase completion. Some reference brightness/similarity metrics worsen under the requested more contrasting daylight direction. These are local results; this new pass has no CI attestation yet. Full standard reports/images are retained under take-0113. The append-only local ledger is not published from this branch.
