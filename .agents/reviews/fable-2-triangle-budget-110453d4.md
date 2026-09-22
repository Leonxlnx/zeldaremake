# Where A's triangles sit, by system — head `110453d4` (fable-2, 2026-09-22 00:15 UTC)

fable-cursor's tick 213: A at 8.80 M against W38's 9.0 M ceiling, "nothing more on A's side of the canopy
without a matching cut". The pebble tiles + LOD (§49–50) gave 110 K back; this is the map of the rest, so
the next cut is chosen where the triangles are. Measured with the capture API's `isolate(system)` (the
scene with one system + `lighting` visible, `renderer.info` after one render) at the fixed viewpoints,
high quality, 1280 × 720, 12 settle frames, Link visible — the head as merged at tick 215.

| system | A draws / tris | share of A | F draws / tris | C draws / tris |
|---|---|---|---|---|
| trees | 95 / 3.08 M | 35.1 % | 90 / 2.54 M | 83 / 2.52 M |
| vegetation | 106 / 1.95 M | 22.3 % | 102 / 2.16 M | 110 / 1.92 M |
| structures | 114 / 1.93 M | 22.1 % | 89 / 1.69 M | 55 / 1.19 M |
| hardscape | 17 / 0.75 M | 8.6 % | 15 / 0.58 M | 16 / 0.69 M |
| terrain | 33 / 0.63 M | 7.2 % | 34 / 0.63 M | 36 / 0.69 M |
| rocks | 35 / 0.24 M | 2.8 % | 25 / 0.20 M | 30 / 0.21 M |
| character | 20 / 0.14 M | 1.6 % | 20 / 0.14 M | 20 / 0.14 M |
| props | 10 / 0.09 M | 1.0 % | 10 / 0.09 M | 8 / 0.09 M |
| atmosphere | 4 / 0.01 M | 0.1 % | 4 / 0.01 M | 4 / 0.01 M |
| canopy | 6 / 0.00 M | 0.0 % | 5 / 0.00 M | 3 / 0.00 M |
| lighting | 0 / 0.00 M | 0.0 % | 0 / 0.00 M | 0 / 0.00 M |
| **frame** | **450 / 8.76 M** | | **406 / 8.03 M** | **345 / 7.00 M** |

The isolates sum to 8.82 M at A against the frame's 8.76 M: each isolate keeps `lighting` on and re-renders
the shadow pass, so the per-system numbers carry ≈ 1 % of overlap. Draw counts per system likewise include
the shadow pass's calls.

What the map says, without claiming anyone's lane:

- **Trees are a third of A** (3.08 M) and **structures a fifth** (1.93 M at A, 1.19 M at C) — the two
  places a 100 K cut is a few per cent, not a redesign. Structures at A is the largest *spread* between
  views (1.93 → 1.19 M), so part of it is whatever A alone sees whole (the house side, the fence run, the
  stair's cheeks are hardscape's).
- **Vegetation is 2 M in every view** (1.92–2.16 M) — a constant, so a per-instance saving there pays
  everywhere at once.
- **Rocks are 2.8 %** after §49–50 (0.24 M: three hero far-LODs ≈ 46 K, rubble + strata 150 × 320 ≈
  48 K, the pebble tiles in view, the ledge / clearing / backside where visible); nothing left there
  worth a change.
- The pebble pattern — one merged mesh per ground tile instead of one InstancedMesh per look spanning the
  world — is the cheap check for any instanced scatter whose bounding sphere is the whole map: every fixed
  camera pays for all of it. `vegetation`'s 100+ draws and `trees`' 90+ suggest they are already split;
  the numbers here cannot tell what part of each is out of frustum, only `isolate` on a branch can.

Reproduce: `/tmp`-side, the pose tool with a shot whose `eval` sets the viewpoint, settles 12 frames and
loops `__ZR__.isolate(name)` over `__H.scene.children` — one viewpoint per shot (three in one evaluate
exceeds puppeteer's 180 s protocol timeout on SwiftShader).
