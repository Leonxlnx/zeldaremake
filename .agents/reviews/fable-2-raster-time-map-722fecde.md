# Where a SwiftShader frame's time goes, by system — head `722fecde` (fable-2, 2026-09-22 11:05 UTC)

fable-cursor's tick 226: the stall recurs with 7 GB free, "the JS step is 15–21 ms and the JS heap 1.5 GB; the frame
time is all SwiftShader", hypothesis a late program compile. This is the steady-state half of that: how long the
rasteriser takes per frame and which system's pixels it spends it on. Method: from the page at the viewpoint, after
16 settle frames, `renderer.render()` followed by a 1-px `gl.readPixels` (the sync — without it `render()` returns in
4 ms, the GPU process still working), timed; then the same with one system + `lighting` visible at a time (as
`isolate()`), then with `shadowMap.enabled = false`. High quality, 1280 × 720, Link visible. One or two frames per
number, so ± 10 %.

| system | A_stairs ms / frame | share | C_lookback ms / frame | share |
|---|---|---|---|---|
| trees | **5 738** | **40 %** | **4 416** | **42 %** |
| vegetation | 2 168 | 15 % | 1 646 | 16 % |
| terrain | 1 560 | 11 % | 1 573 | 15 % |
| structures | 976 | 7 % | 217 | 2 % |
| hardscape | 829 | 6 % | 710 | 7 % |
| rocks | 197 | 1.4 % | 133 | 1.3 % |
| character | 140 | 1 % | 108 | 1 % |
| props / atmosphere / canopy / lighting | 84 | 0.6 % | 71 | 0.7 % |
| **full frame** | **14 279** | | **10 471** | |
| full frame, shadow pass off | 11 919 (−17 %) | | 8 629 (−18 %) | |

(The isolates sum to 11.7 s at A against the frame's 14.3 s: each isolate re-renders the lighting and the shadow pass
for its own casters only; the whole shadow pass is 2.4 s.) `renderer.info.programs.length` = **300** in both views.

## What it says (no lane claimed)

- **A frame is 10–14 s on this box at steady state.** A capture view's 60 settle frames are 10–14 minutes of raster
  before any stall; the "20-minute CDP call" is two normal frames plus whatever the stall adds. A compile of one of
  300 programs on SwiftShader is seconds each, so a late variant landing mid-view fits the shape.
- **Trees are 40 % of the frame's raster time and vegetation 15 %** — the leaf and grass shaders on alpha-tested
  overdraw: per pixel, not per triangle (trees are 3.1 M of A's 8.7 M triangles but 40 % of the time; rocks are 2.8 %
  of the triangles and 1.4 % of the time). Whatever the lobes' fragment shader does per sample is the largest cost on
  the machine — a cheaper discard path, or fewer laminae in the depth of a crown, pays more here than triangles do.
- **Terrain is ≈ 1.6 s in every view** for 0.63 M triangles: fill-rate on its shader — the ground covers a third of the
  frame and its fragment cost (splat layers, detail, the mist floor) is paid on every one of those pixels. The
  cheapest 10 % of a frame on this map is probably one fewer texture fetch per ground pixel.
- **The shadow pass is 17–18 % of the frame** — the same 2.4 s regardless of view (its casters are the fixed sun
  frustum's; see `fable-2-triangle-budget-110453d4.md`): a shadow-only LOD for the trees' casters (fable-5's proxy
  idea) is worth ≈ 1.3 s a frame, as fable-4's mid-LOD cut showed in triangles.
- Rocks are 1.4 % of the frame; nothing left there.

## Reproduce

The pose tool with one shot per viewpoint whose `eval` sets the viewpoint, settles, and times `renderer.render()` +
`gl.readPixels(0, 0, 1, 1, …)` per configuration (`__H` = the capture hooks). Without the `readPixels` sync every number
is 1–4 ms and meaningless. `/tmp`-side only; the numbers are in this note.
