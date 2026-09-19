# fable-2 — rocks lane evidence (2026-09-19)

Lane `src/world/rocks/**` (PR #12, `agent/fable-2-rocks` → `cursor/kokiri-world-phase1-f65e`).
BEFORE = the world branch head `d06e2753` (take-0116's world), AFTER = this branch's final
build, both rendered on the same VM through the capture API at the survey-2 poses
(`art/environment/survey2/manifest.json`, `broll`-style, 1280×720, settle 8, character hidden)
and at the six fixed views (`capture.mjs --settle 12`). Sheets are BEFORE | AFTER at the exact
pose; crops are ×2 of the region the survey pointed at.

## Survey-2 items

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `sn-boulder-shotd` | #32 polka-dot lichen + black hole on top; #19 black holes / slate seams | **PASS** | the black "holes" were the moss cushions of the near kit rendering as black domes (their vertex colours were palette greens in linear ≈ 0.05, multiplied into the moss path) — pale neutral vertex colours now; the pale disc plates are gone and the flecks fade out at near range for a crust field baked per vertex (colonies inside the plates, stopped at the joints, torn edges, dark damp rim); the plate colour joints are 40 % of their old width; the crown's parting pit is damped; the crack furrows are kept |
| `sn-boulder-stairfoot` | #17 flat pale face + angular low-poly shard fringe; #25 shard skirt | **PASS** | the fringe was the rock's own 12 cm moss blanket switching on and off at every micro-relief ridge and crack line (a stack of hard-edged slabs); the near build's swell follows a low-frequency normal without the crack term (blanket cliff edges 1728 → 608 in the test), the near skin is smooth-shaded (40° crease, smaller chips / plate steps / micro), the skirt stones are weathered cobbles with 14 smaller half-buried shards on the heightfield, the face carries chalky crust patches instead of the blotches |
| `sn-boulder-terrace` | #19 black polygons | **PASS** | same cushion fix (the big rock carries 40 pads) |
| `ledge-path`, `ledge-face` (new poses, ref-04) | owner ref-04: tall rock ledge right of the north path | preview | `rocks/ledge.ts` — damp dark stone in undulating beds with staggered joints, overhanging mossy lip, moss sheets on the bed tops and under the lip, wet foot band + drip streaks; heightfield-seated foot and top. Rendered with `?rockLedgePreview=1` at the north path's east bank; the shipped position is expansion-1's `layout.rockLedges` |

## Six fixed views (A–F)

`capture.mjs --settle 12` + `compare.mjs` on this VM, BEFORE `d06e2753` → AFTER (budget: each
view within −0.003 SSIM of take-0116; draws ≤ 700). The far builds are byte-identical by
construction (every new rockgen option defaults to the old behaviour; asserted in the tests).

| view | take-0116 | BEFORE | AFTER | Δ | draws |
| --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2252 | 0.2251 | 0.2251 | 0.0000 | 521 |
| B_house | 0.2029 | 0.2025 | 0.2025 | 0.0000 | 479 |
| C_lookback | 0.2354 | 0.2356 | 0.2356 | 0.0000 | 363 |
| D_log | 0.2788 | 0.2791 | 0.2791 | 0.0000 | 354 |
| E_ground | 0.2138 | 0.2134 | 0.2134 | 0.0000 | 479 |
| F_canopy | 0.2636 | 0.2628 | 0.2628 | 0.0000 | 468 |

Pixel differences BEFORE → AFTER: 0.05–0.1 % of pixels per view, < 0.015 % by more than 8/255,
all isolated flips on the hero rocks' fleck edges under the recompiled near shader.

## Files

- `shotd.jpg`, `shotd-crop.jpg` — `sn-boulder-shotd` BEFORE | AFTER, full frame and ×2 crop
- `stairfoot.jpg`, `stairfoot-crop.jpg` — `sn-boulder-stairfoot`
- `terrace.jpg` — `sn-boulder-terrace`
- `ledge-path.jpg`, `ledge-face.jpg` — the ledge preview, path pose and face pose
- `probe-shotd-body-vs-dressing.jpg` — the probe that found the holes: near kit | rock body only | dressing only
- `probe-stairfoot-body-vs-kit.jpg` — the probe that found the fringe: control | rock body | kit | far geometry
