# Final cinematic — 30-second cut

Prepared after the owner's final-recording authorization. The capture must use the frozen build supplied by the root agent; this preparation has not launched a browser or recorded footage.

| Edit time | Shot | Final camera choice |
| --- | --- | --- |
| 00–06 | Arrival | Original reviewed route; prominently establishes the house, stairs and warm path. |
| 06–11 | Canopy | Original route with end target lowered to `[9.7,8,1.31]`; retain FOV 46. |
| 11–16 | House | Original start; finish at the reviewed midpoint: P `[4.2,2.35,-4.35]`, T `[12,3.9,-11.25]`, FOV 42. |
| 16–21 | Link | Existing actual-input five-second walk/run/idle capture, native 1920×1080, high defaults. |
| 21–30 | Forest path | Original reviewed nine-second push toward the log arch. |

[shots.json](shots.json) is the actual B-roll input: four world shots, 25 seconds / 750 frames at 30 fps. Insert the 150-frame Link clip after world frame 479. Final output: **30 seconds / 900 frames, 1920×1080, 30 fps**. Use direct cuts and the existing smoothstep camera easing. No optical frame interpolation. The redundant stair close-up is omitted because its checked route exceeded 9M triangles and lost the right lantern; arrival retains the stair composition.

[preflight-poses.json](preflight-poses.json) contains 12 fixed start/middle/end poses for the existing B-roll `--test` mode. The lower canopy endpoint and new shortened-house midpoint require review on the final frozen build. Previous receipts and originals remain in [the initial preflight](../astra-cinematic-preflight-sept23/README.md); they are not evidence for the new freeze.

Use the existing serial GPU slot, `ZR_NATIVE_GPU=1`, `ZR_URL_EXTRA=hud=0`, native size, high quality, `--fps 30 --time 12.5 --settle 12`. Keep the world cast/UI hidden. The B-roll exporter accepts the supplied frozen `--dist` path. The unchanged Link helper needs `LINK_WORLD_ROOT` to point to the matching checkout-shaped root containing its Git metadata, `public`, `src`, `node_modules` and `dist`; it records source, model and bundle hashes. Use `--flat-video --size 1920x1080`, accepted `link-runtime.glb`, and high defaults.

Once the frozen path and GPU slot are supplied, review a bounded final preflight/moving sample, then proceed with the accepted routes. Keep exact source/build/asset hashes, renderer, viewport, camera/time and output receipts beside the final files. No real-time FPS claim follows from the chosen output frame rate. Picture tools currently produce a silent edit; soundtrack work is separate from this capture.
