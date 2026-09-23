# Round 45 review — walkability and the survey's leftovers (take-0115, `2e00415`)

Before = `e2a3b72` (take-0114), after = `2e00415` (take-0115), survey-manifest poses rendered with
`broll.mjs --settle 12`. Comparison evidence only; lighting identical in both.

## Orchestrator sheets (`r45-<pose>.jpg`)
| pose | item | what to look at |
| --- | --- | --- |
| `w27-plateau-r` | plateau-lip canopy lobes hung at the walker's eye | leaves out of the lens; the lobes moved out along F's rays and floored 2.48 m over the walk |
| `w21-spine-f` | a distant-band pole on the path's north sight line | gone (distant instances keep 6 m off the spine, out of the log's footprint) |
| `w19-spine-r`, `w19-spine-u` | near boles / crown by the arch pale in haze | darker banded bark, cords, foot grime, basal flare; crown limbs end in the leaf mass (the remaining paleness is atmospheric, measured) |
| `sn-boulder-stairfoot` | rubble skirt | fractured lumps with moss caps at the near LOD |
| `sn-signpost`, `w13-spine-u` | black signpost board / hut underside | lit floored wood, runes legible; boarded soffit takes light |
| `sn-fence-post` | fence tone | greyed toward weathered wood |

## The agents' sheets
`trees28-*` (r45/trees `d517b62`), `details1-*` (r45/details `75be70e`) — incl. the arch belly with every pod now ≥ 2.41 m over the path/verge (`details1-arch-belly-s`) and F's hero view unchanged in composition (`trees28-hero-F_canopy-0v11`).

## Numbers
Six views: A 0.2258, B 0.2038, C 0.2353, D 0.2806, E 0.2145, F 0.2629 (A −0.0027 = the lobe move,
D −0.0033 = the raised pods: walkability over the old frames' fit). Draws 522 / 8.58 M tris on A.
`logMinPathClearance` 1.96 → 2.56 m; `distantClearance` {moved 2, dropped 1, minSpineDistance 6.5}.
Measured no-go: swapping the flat bank lobes' near version at 14 m instead of the hero cut costs F −0.013.
