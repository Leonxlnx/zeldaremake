# Ablation matrix — agent/fable-6-monitor-perf@27b132e8

Generated 2026-09-19T21:30:43.665Z by `gauntlet/perf/ablate.mjs` from `.wt\w0116\dist` on headless Chrome + SwiftShader (software raster: the milliseconds are CPU-bound proxies; read the deltas).

### A_stairs (1280×720, settle 8, 20 finished frames, t=12.5s; deltas vs `baseline`)

| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 285 | — | 58.2 | 521 | — | 8,796,924 | — | 4/178 | 175.2 | (reference) |
| shadow=2048,8 | 72.1 | -75% | 19.1 | 521 | +0% | 8,796,924 | +0% | 4/178 | 164.8 | differs |
| shadow=1024,4 | 68.4 | -76% | 17.0 | 521 | +0% | 8,796,924 | +0% | 4/178 | 112.8 | differs |
| shadow=0 | 59.2 | -79% | 8.7 | 342 | -34% | 5,826,596 | -34% | 4/178 | 109.9 | differs |
| scale=0.75 | 65.1 | -77% | 18.4 | 521 | +0% | 8,796,924 | +0% | 4/178 | 99.7 | differs |
| scale=0.5 | 58.0 | -80% | 23.9 | 521 | +0% | 8,796,924 | +0% | 4/178 | 69.4 | differs |
| fx=off | 82.3 | -71% | 25.6 | 513 | -2% | 8,796,908 | -0% | 4/178 | 67.7 | differs |
| veg=0.5,0.5 | 76.5 | -73% | 20.3 | 493 | -5% | 7,586,919 | -14% | 4/172 | 68.9 | differs |
