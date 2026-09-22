# Where the triangles sit, by system and by pass — head `110453d4` / `da314d7c` (fable-2, 2026-09-22 01:10 UTC)

fable-cursor's tick 213: A at 8.80 M against W38's 9.0 M ceiling, "nothing more on A's side of the canopy
without a matching cut". The pebble tiles + LOD (§49–50) gave 110 K back; this is the map of the rest, so
the next cut is chosen where the triangles are. Measured with the capture API's `isolate(system)` (the
scene with one system + `lighting` visible, `renderer.info` after one render) at the six fixed viewpoints,
high quality, 1280 × 720, 12 settle frames, Link visible; the scene totals from `audit().scene.bySystem`
(every mesh, every instance, no culling). Second pass at A and C with `renderer.shadowMap.enabled = false`,
which removes the shadow-depth pass from the counters — W38 counts `renderer.info`, so it counts both passes.

## 1. Per system, six views (main + shadow pass, as W38 counts)

| system | scene total (unculled) | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|
| trees | 5.57 M (540 meshes) | 3.06 M | 2.57 M | 2.45 M | 2.61 M | 2.57 M | 2.50 M |
| vegetation | 2.05 M (383 meshes) | 1.95 M | 1.65 M | 1.92 M | 1.97 M | 1.65 M | 2.16 M |
| structures | 1.66 M (105 meshes) | 1.93 M | 1.92 M | 1.19 M | 2.00 M | 1.92 M | 1.69 M |
| hardscape | 0.55 M (19 meshes) | 0.75 M | 0.71 M | 0.69 M | 0.63 M | 0.71 M | 0.58 M |
| terrain | 0.62 M (56 meshes) | 0.63 M | 0.57 M | 0.69 M | 0.51 M | 0.57 M | 0.63 M |
| rocks | 0.74 M (66 meshes) | 0.24 M | 0.23 M | 0.21 M | 0.24 M | 0.23 M | 0.20 M |
| character | 0.13 M (173 meshes) | 0.14 M | 0.14 M | 0.14 M | 0.14 M | 0.14 M | 0.14 M |
| props | 0.06 M (13 meshes) | 0.09 M | 0.09 M | 0.09 M | 0.09 M | 0.09 M | 0.09 M |
| atmosphere / canopy | 0.01 M | 0.01 M | 0.01 M | 0.01 M | 0.01 M | 0.01 M | 0.01 M |
| **frame** | | **450 / 8.74 M** | **430 / 7.88 M** | **345 / 6.93 M** | **393 / 8.06 M** | **430 / 7.88 M** | **406 / 7.99 M** |

(The isolates sum ≈ 1 % over the frame: each keeps `lighting` on and re-renders the shadow pass.)

## 2. The two passes split — A and C

| A_stairs | scene total | main pass | in frustum | shadow pass | both (W38) |
|---|---|---|---|---|---|
| trees | 5.57 M | 1.73 M | 31 % | **1.33 M** | 3.06 M |
| vegetation | 2.05 M | 1.72 M | **84 %** | 0.23 M | 1.95 M |
| structures | 1.66 M | 1.25 M | **75 %** | **0.68 M** | 1.93 M |
| hardscape | 0.55 M | 0.52 M | **95 %** | 0.23 M | 0.75 M |
| terrain | 0.62 M | 0.28 M | 45 % | **0.35 M** | 0.63 M |
| rocks | 0.74 M | 0.15 M | 20 % | 0.09 M | 0.24 M |
| character | 0.13 M | 0.07 M | 56 % | 0.07 M | 0.14 M |
| props | 0.06 M | 0.04 M | 71 % | 0.04 M | 0.09 M |
| **frame** | | **334 / 5.77 M** | | **2.97 M (34 %)** | **450 / 8.74 M** |

| C_lookback | scene total | main pass | in frustum | shadow pass | both (W38) |
|---|---|---|---|---|---|
| trees | 5.57 M | 1.26 M | 23 % | 1.19 M | 2.45 M |
| vegetation | 2.05 M | 1.69 M | 83 % | 0.23 M | 1.92 M |
| structures | 1.66 M | 0.53 M | 32 % | 0.66 M | 1.19 M |
| hardscape | 0.55 M | 0.46 M | 84 % | 0.23 M | 0.69 M |
| terrain | 0.62 M | 0.32 M | 51 % | 0.37 M | 0.69 M |
| rocks | 0.74 M | 0.11 M | 15 % | 0.09 M | 0.21 M |
| character | 0.13 M | 0.07 M | 56 % | 0.07 M | 0.14 M |
| props | 0.06 M | 0.04 M | 67 % | 0.04 M | 0.09 M |
| **frame** | | **265 / 4.49 M** | | **2.44 M (35 %)** | **345 / 6.93 M** |

## 3. What the map says (no lane claimed)

- **The shadow pass is a third of every frame** — 2.97 M at A, 2.44 M at C — and per system it is the same
  number whichever way the camera looks (trees 1.19–1.33 M, structures 0.66–0.68 M, terrain 0.35–0.37 M,
  hardscape 0.23 M, vegetation 0.23 M): a fixed sun frustum, so every view pays for the whole lit region's
  casters. The largest W38 levers on this map are there, not in any system's main pass: the shadow camera's
  coverage, the caster set (terrain casting onto itself under a canopy costs 0.35 M a frame; the trees'
  casters 1.3 M — a lower LOD for the shadow pass alone would keep the shadows and lose most of it), and
  which of structures' 105 meshes cast (0.68 M, more than structures' own culled main pass at C).
- **Main pass: three systems are drawn nearly whole in every view** — hardscape 84–95 % of its scene total,
  vegetation 83–84 %, structures 75 % at A (32 % at C, so structures do cull when the camera turns away
  from the village) — while trees (23–31 %) and rocks (15–20 %) cull. The pebble pattern (one merged mesh
  per ground tile instead of one mesh whose bounds are the whole map) is the cheap check for hardscape's
  paving and vegetation's grass: 1.72 M of vegetation and 0.52 M of hardscape at A, of which whatever is
  behind the camera is the saving.
- **Rocks are 2.8 %** after §49–50 (0.15 M main + 0.09 M shadow at A); nothing left there worth a change.
- Draw calls: the shadow pass is 116 of A's 450 (334 without it) — another third.

## 4. Reproduce

The pose tool with one shot per viewpoint whose `eval` sets the viewpoint, settles 12 frames and loops
`__ZR__.isolate(name)` over `__H.scene.children` (`__H` = the capture hooks; `__H.renderer.shadowMap.enabled
= false` for the main-pass-only numbers, restored after). Three viewpoints in one evaluate exceed
puppeteer's 180 s protocol timeout on SwiftShader. Files: `/tmp`-side only; the numbers are in this note.
