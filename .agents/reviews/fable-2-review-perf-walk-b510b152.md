# fable-2 non-author check — the three perf merges at the owner's walk poses (`56b54e15` → `b510b152`)

fable-5 measured the three perf branches together at the six hero views (A 723 / 9.20 M → 698 / 8.87 M; "B 0.18 % of pixels > 8
levels"). The six views are what the ledger holds; the owner walks. Same five survey poses (`art/environment/survey2/manifest.json`
spine poses + the owner's `s2-owner`), both builds on my VM, sequential, settle 10, 1280 × 720:

| pose | what it sees | px > 8 levels | px > 40 | mean l |
|---|---|---|---|---|
| w06-spine-d `[0.24,1.46,−2.43] → [0.49,0.02,−4.91]` | the path underfoot, mid spine | 0.1 % | 0 | 0.329 → 0.329 |
| w08-spine-r `[0.96,1.45,−8.38] → [9,1.3,−14.33]` | toward the signpost and the girl | 0.0 % | 0 | 0.230 → 0.230 |
| w03-spine-f `[0,1.45,6.56] → [0,1.3,−3.44]` | up the spine | 0.1 % | 0 | 0.323 → 0.323 |
| w09-spine-d `[1.4,1.46,−11.35] → [1.77,−0.01,−13.82]` | the path underfoot, north | 0.1 % | 0 | 0.271 → 0.271 |
| s2-owner `[4.4,1.98,0.27] → [9.53,2,−3.77]` | the hero flight from the plaza | 0.0 % | 0 | 0.254 → 0.254 |

Read: the flagstones' shadows (mine), the white-barks' medium-geometry casters behind the camera (fable-4) and the kids' conditional
casting (fable-3) are invisible on the walk at these poses — the changed pixels are single-digit hairlines, none over 40 levels. The
claim "frames B 0.18 %" holds on the ground as well as at the six views. Sheet: `art/environment/fable-2-rocks/perf91-walk-sheet.jpg`.
Builds: `/tmp/head39/dist` (56b54e15), `/tmp/head40/dist` (b510b152); renders `/tmp/f2/perf91-{base,head}/`.
