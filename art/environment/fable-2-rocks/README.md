# fable-2 — rocks lane evidence (2026-09-19)

## Iteration 2 (goal mode, 2026-09-20) — the north-terrace ledge, opus-review #03

Branch `agent/fable-2-ledge` off the world head `3d50f6c8` (PR #12 merged). BEFORE = that head,
AFTER = `ccd9a22a`, both rendered on this VM at opus-review's walk poses (eye 1.45 m over the
terrain, `.agents/reviews/opus-review-walk/manifest.json`).

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `x-clearing-n`, `x-ledge-foot`, `x-northpath-n` | opus #03 "the raised ledge is a flat olive mound — no rock face, no root ridges, no strata, no damp band" | **PASS** (face, strata, damp band, roots; ferns at the foot are vegetation's) | the layout authors `rockLedges.north-terrace` at the terrace LIP (ground 5.5–5.7 m) while the builder read it as the foot: the head stood a 1.62 m wall on top of the lip, facing the bank (the dark sliver floating over the terrace in the BEFORE) and the clearing saw the terrain's mound. The builder now walks a lip point down the slope to the step's base (foot on the clearing rim at z ≈ −74.2, ground 4.14–4.46), climbs steeply to the lip (24° lean), rolls a mossy quarter-round shoulder back onto the terrace turf, extends the authored line by the taper so the authored span is at full height, drops columns on the `ledge` flight's stairs, and grows root ridges (rounded bark ridges from the lip down the face, thickening back over the shoulder). Face 1.67 m × 4.1 m, 1364 triangles, one draw. |

Six fixed views BEFORE → AFTER: **byte-identical** (sha256 equal on all six; Δ SSIM 0.0000);
draws A 569 (+1: the ledge mesh's bounds enter A's frustum, hidden behind the north rise) /
B 526 / C 393 / D 394 / E 526 / F 512; A 9.09 M tris on both (the head's number, not this
change's — flagged to fable-cursor). Files: `ledge2-x-clearing-n.jpg` (+ `-crop`),
`ledge2-x-ledge-foot.jpg`, `ledge2-x-northpath-n.jpg`.

## Iteration 4 (goal mode, 2026-09-20) — the north-terrace wall at 3 m, fable-5's review

`2f741068`. BEFORE = the merged head `0987e060` (iteration 2 in), AFTER = this build, at fable-5's
`x-ledge-wall` p (−1.2, 5.45, −73.6) → t (−1.2, 5.4, −76.7) and opus's `x-clearing-n`.

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `x-ledge-wall` (3 m), `x-clearing-n` | fable-5 (`.agents/reviews/fable-5-r48-branches.md` §fable-2): "one smooth boulder — no strata, no damp band, roots the rock's own tone; the terrace's pale cut shows above the crest at the west end" | **IMPROVED → for re-review** (strata, damp band, bark roots, slab crest, the cut hidden where the face runs; the pale patch further west at x < −4.5 is beyond the authored line) | the end columns sink into the bank instead of losing height (the lip stays on the terrace top); beds 0.3–0.45 m stepped ±0.2 m with dark partings; the damp band baked into the vertex colour and the ledge material's wet term raised to `LEDGE_DAMP` 1.6; roots as bark (0.22/0.15/0.09, ribbed tone) 1.1 per 3 m, slim over the shoulder; the shoulder broken into slabs by the joints under a moss sheet, the lip 0.2 m proud |

Files: `ledge3-x-ledge-wall.jpg`, `ledge3-x-clearing-n.jpg`.

Six fixed views, merged head `0987e060` → `2f741068` (iterations 3 + 4 together; this VM,
`capture.mjs --settle 12`): SSIM A 0.2195 → 0.2195, B 0.2042 → 0.2042, C 0.2393 → 0.2393,
D 0.2794 → 0.2794, E 0.2146 → 0.2146, F 0.2601 → 0.2601 (Δ 0.0000 ×6; all within −0.0014 of
take-0118, the head's own distance); C and F byte-identical, A/B/D/E differ in 0.02–0.11 % of
pixels (≤ 0.0094 % beyond 8/255) — the recompiled near shader on the hero rocks, as in PR #12.
Draws A 577 / B 535 / C 393 / D 402 / E 535 / F 516, identical to the head's.

## Iteration 3 (goal mode, 2026-09-20) — the shot-D boulder's value at 2 m, opus-review #10

Same branch, `20513c24`. BEFORE = the head `3d50f6c8`, AFTER = this build, survey-2 poses.

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `sn-boulder-shotd` | opus #10 "an unreadable dark mass with two black cavities at 2 m" | **PASS on the value (the cavities went with PR #12); the absolute level of the spot is the lighting's** | probes at the pose (`probe-shotd-value.jpg`: control / white lit rock / final albedo unlit / vertex colours unlit): a white rock renders sRGB 0.47 in this light, our face 0.166 against ferns at 0.21, while the reference's frame D has its boulder at parity with the ferns beside it (0.32 both); the normal map, roughness and the near colour terms each changed nothing measurable. Near path only: the stone tile lifted ×1.35 and warmed toward the reference's olive-tan, the wet band 0.7/0.72/0.78 (was 0.56/0.6/0.68), grime 0.55, the D skin's cleave darkening 0.4 → 0.12 (near build; the far mesh keeps 0.4), the blanket's shaded rim lifted a quarter. Face core 0.166 → 0.205 (ferns 0.213), rgb 41/44/34 → 51/54/40, luminance deciles 77/19/3 → 54/39/7. |
| `sn-boulder-stairfoot`, `sn-boulder-terrace` | regression check | no regression | the exposed stone a shade paler and warmer; moss rims a little lighter; nothing blown out (`stairfoot2.jpg`, `terrace2.jpg`) |

Files: `shotd2.jpg`, `shotd2-crop.jpg`, `probe-shotd-value.jpg`, `stairfoot2.jpg`, `terrace2.jpg`.

Six fixed views BEFORE `3d50f6c8` → AFTER `20513c24` (`capture.mjs --settle 12`, this VM): SSIM
A 0.2195 → 0.2195, B 0.2042 → 0.2042, C 0.2393 → 0.2392, D 0.2792 → 0.2792, E 0.2144 → 0.2144,
F 0.2601 → 0.2601 (Δ ≤ 0.0001); draws 569 / 526 / 393 / 394 / 526 / 512 unchanged. Pixels
differing 0.00–0.12 % per view, ≤ 0.0094 % by more than 8/255 (max Δ 43 at D) — the recompiled
near shader's numeric noise on the hero rocks, as in PR #12 (the near terms end at 6.3 m; camera
D is 7.22 m from the boulder's centre).

## Iteration 1 — PR #12

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
