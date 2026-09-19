# Ablation matrix — agent/fable-6-monitor-perf@941597c1

Generated 2026-09-19T21:04:27.996Z by `gauntlet/perf/ablate.mjs` from `.wt\w0116\dist` on headless Chrome + SwiftShader (software raster: the milliseconds are CPU-bound proxies; read the deltas).

### A_stairs (1280×720, settle 8, 20 finished frames, t=12.5s; deltas vs `baseline`)

| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 154 | — | 43.4 | 521 | — | 8,796,924 | — | 4/178 | 131.8 | (reference) |

#### A_stairs — each system alone (`baseline`; colour pass only, lighting kept)

| system | draws | triangles |
| --- | ---: | ---: |
| terrain | 37 | 743,474 |
| hardscape | 12 | 776,338 |
| rocks | 26 | 415,240 |
| trees | 66 | 2,853,083 |
| structures | 103 | 1,810,552 |
| vegetation | 108 | 2,112,359 |
| props | 28 | 28,724 |
| character | 129 | 165,436 |
| atmosphere | 4 | 6,816 |

### B_house (1280×720, settle 8, 20 finished frames, t=12.5s; deltas vs `baseline`)

| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 99.6 | — | 30.4 | 479 | — | 7,943,574 | — | 25/175 | 69.4 | (reference) |

#### B_house — each system alone (`baseline`; colour pass only, lighting kept)

| system | draws | triangles |
| --- | ---: | ---: |
| terrain | 36 | 714,674 |
| hardscape | 12 | 776,338 |
| rocks | 25 | 463,100 |
| trees | 56 | 2,460,621 |
| structures | 100 | 1,799,992 |
| vegetation | 104 | 1,730,737 |
| props | 25 | 25,668 |
| character | 129 | 165,392 |
| atmosphere | 4 | 6,816 |

### C_lookback (1280×720, settle 8, 20 finished frames, t=12.5s; deltas vs `baseline`)

| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 84.8 | — | 18.0 | 363 | — | 7,372,192 | — | 64/179 | 76.3 | (reference) |

#### C_lookback — each system alone (`baseline`; colour pass only, lighting kept)

| system | draws | triangles |
| --- | ---: | ---: |
| terrain | 39 | 776,882 |
| hardscape | 12 | 776,338 |
| rocks | 25 | 437,460 |
| trees | 57 | 2,458,313 |
| structures | 51 | 1,123,970 |
| vegetation | 106 | 2,151,380 |
| props | 15 | 16,508 |
| character | 101 | 159,298 |
| atmosphere | 4 | 6,816 |

### D_log (1280×720, settle 8, 20 finished frames, t=12.5s; deltas vs `baseline`)

| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 91.2 | — | 17.8 | 354 | — | 8,123,365 | — | 71/175 | 73.9 | (reference) |

#### D_log — each system alone (`baseline`; colour pass only, lighting kept)

| system | draws | triangles |
| --- | ---: | ---: |
| terrain | 33 | 652,466 |
| hardscape | 11 | 762,253 |
| rocks | 25 | 400,660 |
| trees | 60 | 2,580,902 |
| structures | 87 | 1,910,304 |
| vegetation | 106 | 1,876,316 |
| props | 15 | 16,508 |
| character | 72 | 153,104 |
| atmosphere | 4 | 6,816 |

### E_ground (1280×720, settle 8, 20 finished frames, t=12.5s; deltas vs `baseline`)

| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 98.0 | — | 30.8 | 479 | — | 7,943,574 | — | 25/175 | 73.2 | (reference) |

#### E_ground — each system alone (`baseline`; colour pass only, lighting kept)

| system | draws | triangles |
| --- | ---: | ---: |
| terrain | 36 | 714,674 |
| hardscape | 12 | 776,338 |
| rocks | 25 | 463,100 |
| trees | 56 | 2,460,621 |
| structures | 100 | 1,799,992 |
| vegetation | 104 | 1,730,737 |
| props | 25 | 25,668 |
| character | 129 | 165,392 |
| atmosphere | 4 | 6,816 |

### F_canopy (1280×720, settle 8, 20 finished frames, t=12.5s; deltas vs `baseline`)

| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 78.9 | — | 20.8 | 468 | — | 8,258,703 | — | 21/181 | 74.7 | (reference) |

#### F_canopy — each system alone (`baseline`; colour pass only, lighting kept)

| system | draws | triangles |
| --- | ---: | ---: |
| terrain | 38 | 748,082 |
| hardscape | 11 | 775,190 |
| rocks | 25 | 400,660 |
| trees | 65 | 2,455,661 |
| structures | 78 | 1,574,388 |
| vegetation | 104 | 2,229,406 |
| props | 23 | 22,024 |
| character | 129 | 165,436 |
| atmosphere | 4 | 6,816 |
