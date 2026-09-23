# Ablation matrix — r38/perf@2d7d9a0

Generated 2026-09-16T03:07:15.955Z by `gauntlet/perf/ablate.mjs` from `dist-r2` on headless Chrome + SwiftShader (software raster: the milliseconds are CPU-bound proxies; read the deltas).

### A_stairs (640×360, settle 8, 3 finished frames, t=12.5s; deltas vs `cull=off`)

| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| cull=off | 13907 | — | 14.0 | 539 | — | 8,655,399 | — | 0/0 | 41.0 | (reference) |
| baseline | 16104 | +16% | 12.1 | 535 | -1% | 8,540,199 | -1% | 4/181 | 37.6 | identical |
| fx=off | 10036 | -28% | 11.4 | 517 | -4% | 8,540,163 | -1% | 4/181 | 37.7 | differs |
| fx=noao | 15351 | +10% | 21.4 | 533 | -1% | 8,540,195 | -1% | 4/181 | 35.5 | differs |
| fx=norays | 14471 | +4% | 17.5 | 532 | -1% | 8,540,193 | -1% | 4/181 | 36.1 | differs |
| fx=nobloom | 13798 | -1% | 16.2 | 532 | -1% | 8,540,193 | -1% | 4/181 | 40.3 | differs |
| fx=nosoft | 15108 | +9% | 19.0 | 525 | -3% | 8,540,179 | -1% | 4/181 | 38.9 | differs |
| shadow=1024 | 12937 | -7% | 19.0 | 535 | -1% | 8,540,199 | -1% | 4/181 | 33.9 | differs |
| shadow=0 | 11766 | -15% | 17.4 | 353 | -35% | 5,796,158 | -33% | 4/181 | 36.1 | differs |
| veg=0.5,0.5 | 13816 | -1% | 16.6 | 506 | -6% | 7,039,213 | -19% | 4/177 | 38.9 | differs |
| scale=0.5 | 9384 | -33% | 22.5 | 535 | -1% | 8,540,199 | -1% | 4/181 | 37.7 | differs |

#### A_stairs — each system alone (`cull=off`; colour pass only, lighting kept)

| system | draws | triangles |
| --- | ---: | ---: |
| terrain | 37 | 743,474 |
| hardscape | 12 | 640,996 |
| rocks | 26 | 407,716 |
| trees | 61 | 2,624,125 |
| structures | 100 | 832,260 |
| vegetation | 120 | 3,205,730 |
| props | 28 | 28,724 |
| character | 129 | 165,436 |
| atmosphere | 4 | 6,816 |
