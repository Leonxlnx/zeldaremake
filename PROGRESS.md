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
