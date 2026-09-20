# Props lane (fable-3) — iteration 3: the north clearing's entrance + a distance cull per cluster

BEFORE = the world head `eec1ce09`, AFTER = `agent/fable-3-lookout` @ `0b46deb7` (same branch as
iteration 2, which it includes), both built and rendered on this VM with the same commands: six
views `capture.mjs --quality high --settle 12`, poses `broll.mjs --size 1280x720 --fps 12 --test
--settle 12 --quality high` with `shots.json` here. Labels burned into each tile. Our own renders only.

## What

GOAL_MODE fable-3 #2: pots and a wooden marker at the stone circle's entrance. The entrance is
where the north path's paved band (half width 2.2 m from the arch) meets the clearing's disc
((−1.5, −69.8) r 4.6); the mask's skirt is wide, so the two flank corners off the paving are
(0.4, −64.4) — the walker's left entering from the arch — and (4.3, −67.7) toward the ledge flight.

- **waymarker** (`kind: 'marker'`, new): a 1.75 m squared post with a diamond cap, two crossboards
  lashed to it at different heights and angles (the long one points into the circle, the short one
  back along the path), nail studs, a small wooden tag hanging on a rope from the long board's tip.
  Same wood / rope / iron as the fences, ladder and crates. Stands vertical (a post is not tilted
  with the bank); its foot is conformed to the ground.
- **pots**: a tall-neck and a squat pot at the marker's foot; a belly pot and a squat pot on the
  flight-side corner. All off the `path` mask, outside the disc, set level (bank tilt ≤ 11°).
- **distance cull** (GOAL_MODE fable-3 #3, first half): each cluster draws only within 45 m of its
  bounding sphere (`CLUSTER_VISIBLE_M`, through `update` and `onCameraMove`, the way hardscape hides
  its north paving). Without it the clearing's four meshes rode into A/B/D/E's colour and shadow
  passes although the log's west root mass hides them there (+8 draws, +8 k triangles on camera A,
  measured below). Every village cluster is ≤ 27 m from every fixed camera, so nothing else changes.

## Six fixed views

Two after-captures. The first is the build WITHOUT the cull (`eaf4b930`): it proves the occlusion —
the clearing's meshes are drawn in A/B/D/E and change no pixel. The second is the final build.

| view | before SSIM | after SSIM | Δ | draws before → no cull → final | triangles (M) before → no cull → final | changed px (both) |
| --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2195 | 0.2195 | 0 | 568 → 576 → 568 | 9.09 → 9.10 → 9.09 | 0 |
| B_house | 0.2042 | 0.2042 | 0 | 526 → 534 → 526 | 8.31 → 8.33 → 8.31 | 0 |
| C_lookback | 0.2393 | 0.2393 | 0 | 393 → 393 → 393 | 7.59 → 7.59 → 7.59 | 0 |
| D_log | 0.2792 | 0.2792 | 0 | 394 → 402 → 394 | 8.51 → 8.52 → 8.51 | 0 |
| E_ground | 0.2144 | 0.2144 | 0 | 526 → 534 → 526 | 8.31 → 8.33 → 8.31 | 0 |
| F_canopy | 0.2601 | 0.2601 | 0 | 511 → 515 → 511 | 8.53 → 8.53 → 8.53 | 0 |

Pinhole, the clearing is inside A/B/D/E's frusta (D (0.43, 0.47) for the marker's top — inside the
log's west root mass band x 0.39–0.47, y 0.27–0.46, with the far ground line at 0.47; A/B/E's rays
to the marker pass the log's west end at z −54 inside the bark) and outside C/F. The captures
confirm it: **no pixel of any frame changes** with the clearing drawn or culled. 0 console errors.

## The change at its poses (before | after)

| pose | what | sheet |
| --- | --- | --- |
| `px-circle-entrance` (from the path below the arch, fov 66) | the paved band opening into the disc; the marker on the left corner with its pots, the low pair on the right corner by the flight | `px-circle-entrance.jpg` |
| `px-circle-marker` (2.9 m from the post) | the post, its lashings, both boards, the hanging tag, the two pots at its foot on the turf beside the paving; the standing stones and the flight beyond | `px-circle-marker.jpg` |
| `px-circle-back` (from the circle's centre toward the arch) | the entrance as a gate: marker and pots right, pots left, the log arch beyond | `px-circle-back.jpg` |

Verdict: **PASS** — the entrance reads as a place (a marker you walk past into the ring), nothing of
it in the six frames, and the system's cost in the six frames is unchanged.

## Tests

`node src/world/props/geometry.test.mjs`: 20 meshes, 51.8 k triangles, `skipped: []`; the marker
vertical; the clearing's props off the paving and outside the disc, outside C/F, the marker's top
inside D's root-mass band; the cull hides the clearing from all six cameras and draws every village
cluster, and draws the clearing from the clearing. `npm run typecheck && npm run build` green.
