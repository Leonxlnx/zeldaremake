# Render-cost ablations (round 38, perf-2)

Astra's native trace (Radeon 780M, 1280×720, quality high, `astra-pr10:art/characters/link/progress/2026-09-15-native-performance/summary.json`) puts the frame at **69.5 ms median: 13.5 ms of JS update and 56.4 ms of render submission** with 453 draw calls and 7.9 M triangles (p95 11 M). The JS side was fixed in character-7 (update p95 2.4 ms); the render side is what this round instruments. Every knob below is a URL parameter parsed in one place (`src/perfFlags.ts`), defaults to the shipped behaviour (no parameter = the byte-identical W41 frame), is echoed in `__ZR__.perf().flags` / `perfState`, and is carried by every `perftrace.mjs` JSON under `config`.

## The flags

| flag | what it switches | where it lands |
| --- | --- | --- |
| `fx=off` / `fx=noao,norays,nobloom,nosoft` | composer stages: SSAO (half res), the god-ray march + smear (quarter res), bloom (quarter res), the video-softness final pass; `off` = all four. The tone/grade composite is never touched. | `postfx/composer.ts` skips the passes; the composite reads a neutral term |
| `shadow=<mapSize>[,<pcssTaps>]` | the sun's shadow map size (texels; `0` = shadow maps off, every receiver compiles without them) and the PCSS filter tap count (12 as shipped; the blocker search takes ⅔ of it, ≥ 4) | `lighting/index.ts` bakes the size / taps into the filter (`shadowfilter.ts`) |
| `veg=<lodScale>[,<grassDensity>]` | multipliers on the vegetation LOD distances (grass tiles and the plant sets) and on the share of each grass tile's blades that is drawn (0..1; blades are shuffled deterministically before the cut so the thinning is uniform) | `vegetation/lodset.ts`, `vegetation/grass.ts` read `perfRuntime()` |
| `scale=<renderScale>` | multiplier on the renderer's pixel ratio (0.25..1); every composer target follows the drawing buffer | `main.ts` |
| `quality=auto` | the frame-time governor (below) | `main.ts`, `perfFlags.ts` |
| `gov=<window>[,<slowMs>[,<fastMs>[,<fastForS>[,<minIntervalS>]]]]` | the governor's tuning (defaults 60, 20, 11, 3, 2) | `perfFlags.ts` |
| `governor=1` | lets the governor run under a headless page (`?capture=1`); captures otherwise pin `auto` to the fixed high tier | `perfFlags.ts` |

## Method

`gauntlet/perf/ablate.mjs` opens one headless Chrome and, per flag set, a fresh page of the production build at the capture's viewpoint and simulation time (`?capture=1&dev=0&quality=high&<flags>`, `setViewpoint`, `setTime(12.5)`, 8 settle frames — exactly what `capture.mjs` shoots), records the renderer's draw calls and triangles for that frame, writes the PNG (so a flag's image can be diffed against the reference config's byte for byte), then times K more frames each closed by a GPU sync. **Chromium's WebGL `finish()` is a flush, not a finish** — it never waits for the GPU process — so the sync is a one-pixel `readPixels` of the canvas, the only synchronous round-trip WebGL offers; `perftrace.mjs --finish` and the governor's headless path use the same. On this box the GPU is SwiftShader (software rasteriser on 4 shared cores), so the milliseconds are a CPU-bound proxy for raster work and vary with the box's load: **read the deltas, not the values**, and read Astra's native run for the real ones.

The reference config is `cull=off`, the harness's own pseudo-flag: it switches the round-38 shadow-caster cull off (`globalThis.__ATMO_SETTINGS__ = { shadowCasterCull: false }` before the page loads), i.e. the shipped path before this round; `baseline` is the new default (cull on, nothing else).

## Results — view A (`A_stairs`), 640×360, SwiftShader

RESULTS_TABLE

## What the matrix says

FINDINGS

## The optimisation: shadow-caster culling (`src/world/postfx/shadowcull.ts`)

three draws every `castShadow` object inside the sun's orthographic window into the depth map — a 92 m box fitted 18 m ahead of the camera (`lighting/index.ts`) — so in a 46° view most of what the shadow pass rasterises stands beside or behind the camera and shades ground nobody sees. A caster can only change a visible pixel if its bounding sphere, swept from the caster along the light's travel direction, reaches the camera frustum: for a frustum plane with inward normal n, a sphere entirely outside the plane (signed distance < −r) that travels along L with n·L ≤ 0 stays outside for ever, so one such plane proves the caster irrelevant. Before the opaque pass the composer hooks `scene.onBeforeRender` (three runs it after the world matrices are updated and before the shadow pass), switches `castShadow` off on every caster that fails the test, and restores the flags when the render returns. The test is conservative — every sphere is inflated by 1 m (twice the shadow filter's widest tap: 0.45 m penumbra + 0.3 m blocker search), the near plane is not used (the god-ray march samples the air in front of it), and objects without a sphere or with `frustumCulled` off keep casting — so the image is unchanged by construction; the six fixed captures are byte-identical (below). `__ZR__.audit().systems.atmosphere.postfx.shadowCastersCulled / shadowCastersTested` report the frame's numbers.

CULL_RESULT

### Six-view verification (`evidence/cap-a.*`)

`capture.mjs --dist dist --out cap-a --settle 8` on 2d7d9a0 (cull on, nothing else) against take 106 (`/workspace/gauntlet/out/take106-cap`, af5ede8 — the shipped world): every PNG is **byte-identical** (`cmp`; the sha256 in `stats.json` agree), so the SSIM against the reference is unchanged to the last digit (A 0.3056, B 0.2841, C 0.3267, D 0.3611, E 0.2967, F 0.2956), while the frame draws fewer casters:

| view | draw calls | triangles |
| --- | --- | --- |
| A_stairs | 539 → 535 (−0.7 %) | 8,655,399 → 8,540,199 (−1.3 %) |
| B_house | 520 → 496 (−4.6 %) | 7,580,570 → 7,445,896 (−1.8 %) |
| C_lookback | 442 → 381 (−13.8 %) | 8,072,774 → 7,680,613 (−4.9 %) |
| D_log | 426 → 354 (−16.9 %) | 7,194,081 → 6,979,533 (−3.0 %) |
| E_ground | 520 → 496 (−4.6 %) | 7,580,570 → 7,445,896 (−1.8 %) |
| F_canopy | 501 → 480 (−4.2 %) | 8,236,234 → 8,117,172 (−1.4 %) |

The triangle saving is modest because the heavy casters (the giant trees, the hero ferns) stand in view and the vegetation sets already trim their out-of-view, out-of-shadow cells (`lodset.ts` CELL_OUT_SHADOW); what goes are the rocks, props and small sets beside and behind the camera — 4–17 % of the frame's draw calls, and every one of them a state change and a depth-pass draw the GPU no longer waits for. The same capture confirms the `antialias: false` canvas (main.ts): the composer blits a fullscreen quad to the canvas, so a multisampled default framebuffer only ever added a 4× colour buffer and a resolve per frame for the identical image.

## Auto quality (`?quality=auto`)

`QualityGovernor` (`src/perfFlags.ts`) keeps the median of the last 60 frames' wall time — the rAF interval in play (what the GPU actually lets through), the synced step under the trace harness — and steps a ladder: one rung down when the median sits above 20 ms, one rung up when every frame of the last 3 s sat below 11 ms and the median agrees. Changes are ≥ 2 s apart, the window is refilled after each change before it can speak again, and a step up that is punished within two intervals doubles the fast run the next step up must earn (up to 32×), so a borderline machine settles on a rung instead of oscillating. Under a headless capture the governor never runs (the capture is the fixed high frame); `governor=1` enables it for the trace harness. The current rung is `__ZR__.perf().tier` (`high` or `auto:<rung>`), `__ZR__.perf().governor` lists the changes with frame indices, and the dev HUD shows `auto → <rung name>`.

| rung | name | shadow map / taps | fx | render scale | veg LOD × / grass share |
| ---: | --- | --- | --- | ---: | --- |
| 0 | high | 4096 / 12 | ao rays bloom soft | 1 | 1 / 1 |
| 1 | shadow-2k | 2048 / 8 | ao rays bloom soft | 1 | 1 / 1 |
| 2 | no-ao scale-0.85 | 2048 / 8 | rays bloom soft | 0.85 | 1 / 1 |
| 3 | no-rays scale-0.75 veg-0.75 | 2048 / 8 | bloom soft | 0.75 | 0.75 / 0.8 |
| 4 | shadow-1k no-soft scale-0.6 veg-0.5 | 1024 / 6 | bloom | 0.6 | 0.5 / 0.6 |
| 5 | floor | 1024 / 4 | — | 0.5 | 0.5 / 0.5 |

Shadows stay on at every rung: a light losing its shadow recompiles every material (a multi-second hitch mid-play). The map size and the tap count change at run time without a recompile — under `auto` the filter is compiled in its dynamic variant (`shadowfilter.ts`: the texel size follows the live `shadowMapSize` uniform and the tap count rides in the thousands of `shadow.radius`); the fixed tiers keep the shipped shader byte for byte.

AUTO_TRACE

## Commands for Astra (native, Windows; from the repo root after `npx vite build`)

The trace harness (`gauntlet/scripts/perftrace.mjs`) walks Link along the fixed path and records every frame; `--params` appends the flags, `--finish` closes each timed step with the GPU sync so `ms` is the frame's GPU time on real hardware, `--auto` opens `quality=auto&governor=1` and lists the rung changes. Run them one at a time.

```
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --out trace-baseline.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "fx=off"        --out trace-fx-off.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "fx=noao"       --out trace-fx-noao.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "fx=norays"     --out trace-fx-norays.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "fx=nobloom"    --out trace-fx-nobloom.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "fx=nosoft"     --out trace-fx-nosoft.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "shadow=2048,8" --out trace-shadow-2048.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "shadow=1024,4" --out trace-shadow-1024.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "shadow=0"      --out trace-shadow-0.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "veg=0.5,0.5"   --out trace-veg-0.5.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 600 --width 1280 --height 720 --finish --params "scale=0.5"     --out trace-scale-0.5.json
node gauntlet/scripts/perftrace.mjs --dist dist --frames 1200 --width 1280 --height 720 --auto --out trace-auto.json
```

The same matrix on the fixed view A (draws / triangles / PNG identity / finished-frame ms, one browser):

```
node gauntlet/perf/ablate.mjs --dist dist --out ablations-A --views A_stairs --width 1280 --height 720 --timed 20 --ref "cull=off" --configs "cull=off;baseline;fx=off;fx=noao;fx=norays;fx=nobloom;fx=nosoft;shadow=2048,8;shadow=1024,4;shadow=0;veg=0.5,0.5;scale=0.5"
```

`ablations-A/TABLE.md` is the table; `results.json` has every field. The cull's own saving is `baseline` vs `cull=off` (the two PNGs must be identical). In the browser, `?quality=auto` with the dev HUD shows the rung live; `?quality=auto&gov=60,16,9` tries tighter thresholds.
