# Final cinematic — 30-second cut

Five shots from the frozen game build: arrival, canopy, house, Link and the forest path. The world and actual-input Link captures are complete. Frozen source: `e599075ff78aa39954375c3ecdb7a74ab46aca3c`, bundle `index-DJ-pEmhG.js`, published in main checkpoint `c5d4aec9` and tagged `cinematic-2026-09-23`.

| Edit time | Shot | Final camera choice |
| --- | --- | --- |
| 00–06 | Arrival | Original reviewed route; prominently establishes the house, stairs and warm path. |
| 06–11 | Canopy | Original route with end target lowered to `[9.7,8,1.31]`; retain FOV 46. |
| 11–16 | House | Original start; finish at the reviewed midpoint: P `[4.2,2.35,-4.35]`, T `[12,3.9,-11.25]`, FOV 42. |
| 16–21 | Link | Existing actual-input five-second walk/run/idle capture, native 1920×1080, high defaults. |
| 21–30 | Forest path | Original reviewed nine-second push toward the log arch. |

[shots.json](shots.json) defines the four world shots: 25 seconds / 750 frames. The 150-frame Link clip goes after world frame 479. Delivery specification: **30 seconds / 900 frames, 1920×1080, 30 fps**, with direct cuts, existing smoothstep camera easing and no optical frame interpolation. Arrival supplies the stair composition; the separate stair close-up is omitted.

[preflight-poses.json](preflight-poses.json) contains the 12 checked start/middle/end poses. The [final preflight receipt](preflight/verified.json) records their accepted framing and capture checks. The [world recording receipt](world/verified.json) records all 750 PNG hashes, source/build identity, camera/time checks and measured costs. Native capture used high quality, DPR 1 and the AMD Radeon 780M through ANGLE D3D11; world UI and cast were hidden. Link uses the accepted runtime model and actual walk/run/idle input.

World capture checks passed with zero errors, retries or duplicate PNGs. Four house frames slightly exceeded 9M triangles, peaking at 9,001,408; this is moving-camera capture evidence, not a real-time FPS claim. The frozen source and build remained unchanged.

Original game audio accompanies the picture edit. The final MP4 passed full CPU decode and format validation; fifteen encoded images across the cuts and movement transitions were visually reviewed. See the [delivered movie and verification](README.md).
