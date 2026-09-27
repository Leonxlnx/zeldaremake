# Lane 9's south props against exp-south2's tip (2026-09-25 18:20 round)

exp-south2 (`f2f6e793`, the head `d9112199` merged in) builds two dwellings where the path straightens for the
bridge — the bridge keeper's hut at (7.1, 31.9) and the waystation lean-to at (5.12, 25.95) — right around lane 9's
toll pile: the waymarker at (5.6, 27.7), the crate at (5.4, 29.3) and the squat pot at (5.95, 29.85), placed before
those structures existed (`props-fable-3/south-exit`). This is the check that they meet cleanly. Same cameras on
both builds, `broll.mjs --test --quality high --settle 3`, 1280 × 720; **left / top = the head `14fda29d`**,
**right / bottom = exp-south2 `f2f6e793`**.

| Sheet | Camera (`shots-*.json`) | What it shows |
| --- | --- | --- |
| `pile-before-the-hut-door.jpg` | from the path at (6.5, 1.6, 26.0) → (5.6, 0.6, 29.5) | The hut now stands behind the pile with its round door facing it; the crate and pot sit ≈ 1 m off the wall, the marker at the sill. Nothing intersects; the pile reads as the keeper's goods by his door. The trunk at the right edge is the waystation's corner — the camera stands in its opening. |
| `waystation-beside-the-marker.jpg` | (8.2, 1.6, 27.5) → (5.2, 0.9, 25.9) | The lean-to's plank floor ends short of the marker's post; its front lantern hangs clear of the marker's arms. |
| `pile-east-and-log-mouth.jpg` | top: (9.0, 1.7, 23.5) → (5.4, 0.8, 26.6); bottom: (6.0, 1.5, 41.5) → (7.3, 0.6, 46.0) | Top: the pile seen past the lean-to's side wall, clear. Bottom: the two log-mouth pots at (7.0, 46.05) / (7.7, 45.3) on the far bank — identical head ↔ branch apart from the branch's vines on the log's rim. |

By exp-south2's own numbers the pile is 0.5 m outside the hut's gallery's north-west end (the gallery runs
−14°…228° at 1.37–2.25 m from the axis; the pile is at 237°, 2.7 m out). From the bridge's north sill looking back
(`shots-bridge-log.json` `bridge-back`) the gallery hides the pile, which is why the first camera pair moved to the path.

Tests on exp-south2's tip with the head merged: `node --test src/world/props/*.test.mjs` 1/1, the whole suite 227/227.
No lane 9 change is needed for the ship; no code in this folder's PR.

## Re-check, 2026-09-26 04:10 — exp-south2 `ad49052c` (the keeper's entrance boards extended, the waystation's steps)

Same two cameras (`pile-from-the-path`, `waystation-from-the-path`) on the 18:20 tip `f2f6e793` (left) and `ad49052c`
(right): `recheck-04-10-f2f6e793-vs-ad49052c.jpg`. 2 492 / 2 463 changed px, SSIM 0.9957 / 0.9952 — the entrance's
four new chords reaching toward the pile and the head's lantern warmth. By their numbers the chords end at r 2.28
from the hut's axis, the last at 228°: (5.57, 30.21) — 0.6 m short of the crate's near edge, 0.29 m clear of the
squat pot's rim. Nothing intersects; props tests 1 / 1 on the tip. No lane 9 change.
