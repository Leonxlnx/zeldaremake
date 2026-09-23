# Round 42 review — the ground at player height, boulders, memory (take-0112, `cf3130e`)

Matched before/after captures of OUR world (SwiftShader, 1280×720, `quality=high`, simulation
time 12.5 s, HUD hidden, character hidden). Before = `7a90aa6` (take-0111), after = `cf3130e`
(take-0112). Comparison evidence only. Lighting identical in both.

## Orchestrator sheets (rendered from the two sealed builds)
| file | pose | what to look at |
| --- | --- | --- |
| `r42-plaza-stones.jpg` | 1.45 m, 30° down at the plaza slabs 1–4 m | 2.9 m near tile + doubled relief: pits, chipped edges, pebbled joints, moss creep |
| `r42-stair-third-tread.jpg` | on the third tread looking down the flight | nosing spalls, tread pitting, corner moss, riser fissures |
| `r42-stairfoot-boulder-2m.jpg` | 2 m from the stair-foot boulder | fractured near LOD: plate tone, chipped rim, moss cushions, lichen, fragments, crevice fern |
| `r42-d-boulder-2m.jpg` | 2 m from the D boulder on the path | partings, grime, cushions on the shaded face |
| `r42-housewest-apron.jpg` | the house-west flight from the north path | the two-kerb apron as a low first tread (flight base kept at 0.27 m) |
| `r42-plaza-up.jpg` | straight up from the plaza | identical by design — the near-canopy pool must not change a pixel |

## The agents' sheets
- `hardscape30-*.jpg` — r42/hard `f072a3f`: plaza, joint at 1.2 m, stair from the third tread, stair foot, apron from the north, `D-flight-ab` (reference / before / base 0.18 / base 0.27 — the A/B behind keeping 0.27), 1:1 closeups.
- `rocks2-*.jpg` — r42/rocks `541754d`: stair-foot crevice at 1 m, stair-foot at 2 m, terrace at 3 m, D boulder at 2 m.

## Numbers
Six fixed views: A 0.2324 → 0.2288 (the near-tile plaza slabs at 1–3 m), B 0.2050 → 0.2046,
C 0.2361 → 0.2348, D 0.2843 → 0.2860 (the apron), E 0.2158 → 0.2148, F 0.2621 → 0.2603; draws
508 / 8.21 M tris on A. Memory (trees-26): near-canopy resident 173 → 63.5 MiB, near-base 22 →
12 MiB, six views + seven walking poses byte-identical, 0 synchronous builds on the walk.
