# Progress

Palette: warm off-white hull `#d5cbbd`, orange accents `#e07a2a`, teal practicals `#7dfff0`, dark metal gaps `#2c333a`, warm bunk light `#ffb15a`.

## Iteration 1

Built the playable loop: pointer-lock walk, capsule collision, cockpit / corridor / quarters / galley / bath, procedural PBR maps, PMREM room, GTAO + bloom + ACES + vignette/grain, drifting planet and streak shells. Shots in `shots/iter_1/`.

Pixel read of the PNGs (not a vibe check):

- Corridor median luminance 251. The frame is effectively white. Nearest practical sits ~20cm under the ceiling at intensity 48, so the ceiling is thousands of lux and bloom floods the hall.
- Cockpit has real structure (darker floor band, cooler window) but the upper half clips near 250.
- Quarters shows the bunk browns along the bottom and a warm pool, with the upper walls clipped.
- Window keeps teal space, a brighter planetary body, and dark corners. Best frame of the set.

| # | Rubric | Result |
| --- | --- | --- |
| 1 | Lighting intentional | fail |
| 2 | Materials physical | fail |
| 3 | Detail density | fail |
| 4 | Post stack balanced | fail |
| 5 | Space view sells motion | fail |
| 6 | Cohesive palette | fail |
| 7 | Tech clean, 60fps | fail |
| 8 | Cold-look test | fail |
| 9 | Interactions | fail |

Fails are from the shots. Corridor has no readable key, metal, or panel read because it is clipped. Window content exists but the set does not pass as a whole. Interaction harness awaited the full sleep promise, so the fade was gone before the screenshot; not counted as a pass.

Fix list for iteration 2:

- Drop practical intensity and move fixtures off the ceiling. Raise bloom threshold so only emissives and the planet rim glow.
- Tame the PMREM (it was built from 500-intensity lights).
- Reframe corridor and quarters so the hall and the bunk fill the shot after exposure is sane.
- Fix the shot script so fades, prompts, and fps are actually recorded.

## Iteration 2

Exposure is in range. Corridor median luminance 164, 4% near-white (the fixtures), 1.4% near-black. Cockpit median 108. Quarters median 98 with 8% near-black. Window median 43, which is space.

Pointer lock engaged. Prompts `E: SLEEP` and `E: EAT` are on screen. Galley status reads `You eat. Energy restored.` Bath fade reads `REFRESHED.` Bed fade and the rest-cycle frame were shot during the opacity transition, so one is still the lit room and the other is black. Renderer is llvmpipe at about 30fps. `PCFSoftShadowMap` is removed in this Three.js version.

| # | Rubric | Result |
| --- | --- | --- |
| 1 | Lighting intentional | fail |
| 2 | Materials physical | fail |
| 3 | Detail density | fail |
| 4 | Post stack balanced | pass |
| 5 | Space view sells motion | fail |
| 6 | Cohesive palette | pass |
| 7 | Tech clean, 60fps | fail |
| 8 | Cold-look test | pass |
| 9 | Interactions | fail |

Corridor lighting, palette, and the cold-look read are in good shape: teal pools, orange guide line, grate, AO in the panel gaps, vignette. Quarters still has a large dark flat wall over the bunk. Cockpit floor is a dark band with little read. The window shows the planet and a blue rim, and the stars read as static points, not flight. 30fps is llvmpipe; that is not a 60fps pass.

Fix list for iteration 3:

- Dress the bunk wall and window frame so no shot has a bare plane. Add a quarters fill so the shadow side stays above crushed black.
- Replace the near star layer with large screen-space streaks so a still frame reads as motion.
- Lift the cockpit floor with a practical, without washing the corridor.
- Wait on real fade opacity before interaction shots. Use `PCFShadowMap`.
- Measure frame time again after the cheaper shadow map.

## Iteration 3

Quarters now has the bunk, shelf, mug, warm strip, and a lit screen. Cockpit floor reads as plated metal instead of a black band. Corridor histogram is unchanged in a good way (median 168, 4% fixture white, 1.3% near-black). Rest cycle is visibly dimmer and warmer than the day bunk shot (median 109 vs 137).

Frame budget: 109k triangles, 90 calls, 42fps on llvmpipe. No shader errors. Pointer lock still engages.

The window shot got brighter (median 130 vs 43) and still does not read as flight. Stars are points. The viewport surround is a flat off-white band. Fade screenshots missed the overlay even though the rest-cycle lighting change fired.

| # | Rubric | Result |
| --- | --- | --- |
| 1 | Lighting intentional | pass |
| 2 | Materials physical | pass |
| 3 | Detail density | fail |
| 4 | Post stack balanced | pass |
| 5 | Space view sells motion | fail |
| 6 | Cohesive palette | pass |
| 7 | Tech clean, 60fps | fail |
| 8 | Cold-look test | pass |
| 9 | Interactions | fail |

Items 1, 2, 4, 6, and 8 held from iteration 2. Detail fails on the window frame. Motion fails because the streak sprites did not read in the still. 42fps on llvmpipe is not 60. Interaction overlay shots are not proof.

Fix list for iteration 4:

- Put a few dozen long streaks in the forward view, not a full shell of huge points. Pull the window camera back so the sill and bolts are in frame with the planet.
- Half-resolution AO to buy frame time without removing the effect.
- Capture fade text with the overlay held still, and log opacity while the real fade runs.

## Iteration 4

Window camera sits back at the sill. Flight streaks are instanced quads in the forward view, and the mid star shell is long dashes instead of point sprites. Fade text is held by a render-loop tween because headless Chrome freezes CSS transitions. `fade_bed` reads `8 HOURS PASS`, `fade_bath` reads `REFRESHED.`, galley shows `E: EAT` and `YOU EAT. ENERGY RESTORED.`, and the rest-cycle bunk is dimmer and warmer than the day shot.

Histograms stayed in range: corridor median 167 (4% fixture white, 1.3% near-black), cockpit 134, quarters 137, window 102. Pointer lock engaged.

Frame time is not 60. Wall-clock over 12 frames on llvmpipe is 1.8fps (corridor) with 106k triangles and 90 calls. The earlier 42fps figure only averaged the short command-submit gaps and ignored the stall. A rect-area light plus ten point lights is the cost.

| # | Rubric | Result |
| --- | --- | --- |
| 1 | Lighting intentional | pass |
| 2 | Materials physical | pass |
| 3 | Detail density | pass |
| 4 | Post stack balanced | pass |
| 5 | Space view sells motion | pass |
| 6 | Cohesive palette | pass |
| 7 | Tech clean, 60fps | fail |
| 8 | Cold-look test | pass |
| 9 | Interactions | pass |

Items 1, 2, 4, 6, and 8 have now passed twice in a row. Detail, motion, and interactions pass for the first time. Tech fails: sustained frame rate on this software GL is about 2fps, and there is no z-fighting or missing-face read in the shots.

Fix list for iteration 5:

- Spend the iteration on frame time. Remove the rect-area light (it puts an LTC path on every surface) and replace it with a cool point. Drop redundant practical points, keeping one pool per room and the emissive strips. Shrink the shadow map to 1024.
- Reshoot all four views. If the corridor or cockpit goes flat, put a light back. Record wall-clock fps, not the submit-gap average.

## Iteration 5

Frame budget moved, the frame rate barely did. Rect-area light is gone, two corridor practicals are emissive-only, the shadow map is 1024 and frozen after the first frame, and the 900 instanced far-star quads are a texture on the sky sphere. Sustained corridor rate is 2.6fps (73k triangles, 60 calls) versus 1.8fps last iteration. Direct rendering of the ship alone, with space hidden, is about 8fps, so the lit surfaces are the floor on this software GL. The far-star instances were a real tax (they cut the direct rate in half) and they are gone. GTAO on top of the ship is the other large slice.

The corridor is dimmer (median 117, was 167; p10 29, was 51) because two practicals no longer throw light. It still has separate pools, a warm fill down the hall, and glowing strips. Cockpit median 127, quarters 138, window 110. None are clipped. Fade text is still on the black frames. Pointer lock engaged.

| # | Rubric | Result |
| --- | --- | --- |
| 1 | Lighting intentional | pass |
| 2 | Materials physical | pass |
| 3 | Detail density | pass |
| 4 | Post stack balanced | pass |
| 5 | Space view sells motion | pass |
| 6 | Cohesive palette | pass |
| 7 | Tech clean, 60fps | fail |
| 8 | Cold-look test | pass |
| 9 | Interactions | pass |

Items 1 through 6, 8, and 9 have now passed two iterations in a row. Tech has not. 2.6fps is not 60, and a laptop-GPU inference is not a measurement.

Fix list for iteration 6:

- The remaining cost is the lit ship in the beauty pass plus GTAO's extra scene pass. Cut the wear noise from five octaves to two so fragment cost drops without removing the grime.
- If that does not move sustained fps by a clear margin, put the octaves back. Do not strip lights or AO to chase a software-GL number.
