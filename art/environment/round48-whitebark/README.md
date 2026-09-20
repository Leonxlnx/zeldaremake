# Round 48 — fable-4 goal-mode iterations (white-bark trees)

Branch `agent/fable-4-r48` off the world head `3d50f6c` (take-0118's world + round 47). Every sheet
is BEFORE (`3d50f6c`) | AFTER at an identical pose, rendered with
`broll.mjs --size 1280x720 --fps 12 --test --settle 12`; the walk poses (`x-*`) are opus-review's
(`.agents/reviews/opus-review-walk/manifest.json`, eye 1.45 / aim 1.3 m over the terrain, resolved
in node from the same heightfield). Rule (round 46): an after that looks like its before is a
FAIL, not a claim.

## Iteration 1 — young white-barks on the north clearing's banks (`a0f55cd` + hook `f9b6c32`)

GOAL_MODE fable-4 #1 / round-47 handoff "trees: young white-barks on the clearing's banks".
`CLEARING_WHITE_BARKS` at (−7.6, −66.0), (6.2, −71.5), (−6.0, −75.5) west of the ledge, and
(8.0, −64.8) (expansion-1's (7.5, −64.5) moved 0.6 m off the paving so no toe crosses the slabs);
seated on `terrain.height`, young variants cycled, toes from the seated-root mesh.

| pose | verdict | what changed |
| --- | --- | --- |
| `x-arch-approach` (ref-03's view through the arch) | PASS (modest) | two young stems with small crowns stand in the far clearing between the grey far-forest cones — the first real trees in the "deep world"; 2.5 % of the frame |
| `x-northpath-n` | PASS | the west-bank stem with its crown and shadow beyond the stone circle; 11 % of the frame |
| `x-clearing-stones`, `x-clearing-back` | PASS | the east-bank stem rises behind the stones and throws its shadow across the paving; the west stem at the frame's left |
| `f4-clearing-ledge-tree` (3 m) | PASS | a slender young birch on the bank west of the ledge flight, flared foot into the slope, lenticels, shadow across the ground |
| `f4-clearing-east-tree` | PASS | the east stem from the path, 1.6 m off the flagstone edge |
| `x-clearing-n`, `x-ledge-foot` | unchanged (0.3 % / 0.0 %) | both look north past the west stem; nothing of this iteration is in frame — noted, not claimed |

Probed against the terrain before placing: all four on vegetation-allowed bank ground, no
path/structure mask, tilt 2–14°; the nearest authored column seat is 30 m away; the distant
placement does not read white-bark positions; `seatBlocked` keeps any new column seat 2.5 m clear
of them (they are appended to `whitePlacements` before the columns are seated). The eye-level
sight line from the clearing toward (−8, −88) passes 2.3 m from the west trunk and under its crown.

Six fixed views (settle 6, `3d50f6c` → `f9b6c32`): A 0.2199 → 0.2199, B 0.2045 → 0.2044,
C 0.2397 → 0.2397, D 0.2783 → 0.2784, E 0.2145 → 0.2147, F 0.2606 → 0.2606; draws 568/526/393/394/
526/511 → +0/+1/0/0/+1/0; triangles +0.017 M on A/B/D/E, +0.006 M on C/F (the four low-LOD
instances and their toes; the clearing lies inside A's frustum behind the arch). W12 163/163
seated (maxGap 0), whiteBarkInstances 78 → 82, leafCount 288,607 → 291,551, columns 10 and
distant 729 unchanged, determinism 0, console clean.

**Camera A budget, reported:** the head `3d50f6c` already submits 9.086 M triangles at A (over the
loop's 9.0 M line before this branch); this iteration adds 0.017 M. Commit `e3f50cd` gives it
back inside the lane — the seated-root mesh skips saplings (their 2–5 cm toes lie under the grass)
and builds young stems' toes with 8 sections — see iteration 2's capture for the net.

## Iteration 2 — the trunk read at 5–20 m (`e3f50cd`, `9ee2c7c`, `1812a6f`)

GOAL_MODE fable-4 #3 (the owner's "detail at longer range"). Vertex colours and the tile only —
geometry identical on 10/10 variants (fingerprint), placements unchanged. Per variant, from their
own fork (`base-47/range-48`, so nothing of round 47 moves): one or two broad near-black bands
(0.25–0.45 m tall, flat-topped, wandering ± 4–9 cm) and one to three chevron branch scars
(0.25–0.45 m, widest at the top, tapering to a point below) at 1.2–4.5 m; the tile's tonal zones
± 6 % (was ± 4 %). Sheets `fable4-r48b-*.jpg`.

**What the first attempt taught (reported, not hidden):** `e3f50cd` alone rendered as a faint tone
shift — 0.1–0.6 % of pixels changed at every pose, none strongly — although the vertex colours
were 42 % darker (profile of variant 7: luminance 0.52 → 0.30 at 2.2 m, 0.57 → 0.28 at 2.9 m).
The shaded face of a pale trunk is dark in linear terms, so gamma compresses a 42 % linear drop
into ~20 sRGB levels; the round-47 foot reads darker only because it compounds with the grey
lower bark. `1812a6f` takes the marks to a quarter of the base level (scars to 0.05) — a birch's
bands are near-black.

| pose | distance | verdict | what changed |
| --- | --- | --- | --- |
| `f4-trunk-2m` (the survey tree, 1.5–3 m of stem) | 2 m | PASS | a broad near-black band across the stem at 2.2 m and the chevron scar under it; 13.8 % of the frame changed, 2.5 % strongly |
| `f4-trunk-8m` | 8 m | PASS | both bands and the scar read across the upper stem through the haze (centre crop); the neighbouring stems' marks too |
| `f4-pair-12-20m` | 12 / 20 m | PASS at 12 m, soft at 20 m | the near stem's band is a dark ring at mid-height; on the 20 m stem the band is a darker zone, not a line |
| `f4-trunk-16m` | 16 m | PASS (soft) | the band survives as a dark zone in a 55 %-hazed stem |
| `w18-spine-r` (the stems beyond the arch) | 15–25 m | PASS (soft) | the pale poles at the arch's north side carry a dark middle third where before they were uniform |
| `sn-whitebark-base` | 2 m, 0.3–1.9 m of stem | unchanged by design (6.7 % from the tile's zones) | the marks sit at 1.2–4.5 m; the foot is round 47's |

Six fixed views (settle 6, `3d50f6c` → `1812a6f`, the whole branch): A 0.2199 → 0.2199,
B 0.2045 → 0.2044, C 0.2397 → 0.2398, D 0.2783 → 0.2784, E 0.2145 → 0.2147, F 0.2606 → 0.2606 —
all within ± 0.0002; draws 568/526/393/394/526/511 → 568/527/393/394/527/511; triangles
A 9.086 → 9.064 M, B 8.314 → 8.293, C 7.587 → 7.554, D 8.506 → 8.485, E 8.314 → 8.293,
F 8.528 → 8.496 (−0.021…−0.032 M on every view: the four clearing trees cost +0.017 M, the
saplings' toes and the 8-section young toes give back 0.038–0.049 M). W12 163/163 seated,
determinism 0, console 0 errors, anti-cheat green (87 checks), `roof.test.mjs` ok, typecheck +
build green. **Camera A stays over the loop's 9.0 M line by 0.064 M — the head's excess, not this
branch's; the branch lowers it.**

## Iteration 3 — crowns at 3–10 m: the leaf mass layered by occlusion (`c46081f`, branch `agent/fable-4-crowns`)

GOAL_MODE fable-4 #2 (fable-5 #6, opus #05; fable-5 on the clearing stems: "crowns are lime cards
brighter than the haze"). BEFORE = the head `0987e06`. Colours and per-leaf fill shares only —
geometry identical on 10/10 variants, placements unchanged. Sheets `fable4-r48c-*.jpg` and the
enlarged lobe `fable4-r48c-f4-crown-up-lobe-crop.png`.

What was tried, in order, each measured at `f4-crown-up` (the survey tree's lobe from 7 m below,
green-pixel luminance of the near lobe, x 0.39–0.59 / y 0.06–0.44):
1. Structured albedo (core 0.55 of the rim, undersides darker, sunlit palette reserved for the
   rim/top, the round-47 × 1.12 boost removed): mean 101 → 91, **sd 19.5 → unchanged** — a FAIL
   for "layered". From below one sees each lobe's bottom shell, whose leaves all share the same
   shell/top terms (round 47 found the same); only the level moved.
2. A per-leaf **bimodal occlusion draw** on top: 35 % of laminae shadowed (0.45 albedo, 0.4 fill
   share), 20 % backlit (full fill): sd 19.5 → 22.2, histogram broadened (58 % → 37 % of pixels in
   one bin), 3.9 % of the frame changed strongly.
3. Raised to 45 % shadowed at 0.4 / 0.35 after reading ref-04 (dark foliage against a pale haze,
   few lit rims): **sd 19.5 → 22.3, mean 101 → 90**, 6.3 % of the frame changed strongly. Kept.

| pose | verdict | what changed |
| --- | --- | --- |
| `f4-crown-up` (7 m below the lobe) | IMPROVED, not closed | a mottled leaf mass — dark occluded laminae between lit ones — where before it was one flat pale field; the silhouette (clusters with sky between) is unchanged |
| `f4-crown-side-8m` | IMPROVED | the crown's level under the giant's canopy drops 95 → 84 and the laminae differ from their neighbours; 14.6 % of the frame changed, 3.9 % strongly |
| `f4-clearing-crown-7m` (young stem, side) | IMPROVED (soft) | sd 14.4 → 15.9, 8 % changed |
| `x-arch-tunnel-n` (fable-5's pose, 10–17 m) | PASS for "brighter than the haze" | the clearing crowns' level 104 → 93, no longer above the haze; small in frame (1.2 % changed) |
| `w18-spine-r` (15–25 m) | IMPROVED | foliage sd 23 → 27, level 111 → 103 |

Six fixed views (settle 6, `0987e06` → `c46081f`): A 0.2199 → 0.2199, B 0.2044 → 0.2045,
C 0.2398 → 0.2400, D 0.2784 → 0.2785, E 0.2147 → 0.2148, F 0.2606 → 0.2606 — every moved view
moves toward the reference; draws 577/535/393/402/535/516 and triangles identical; W12 163/163,
determinism 0, console 0, anti-cheat 87 green, typecheck + build green.

**What closes it (not in this lane):** the leaf's hemisphere irradiance in `materials.ts` is not
scaled by `vLeafShade` — only the ambient fill, sky transmission, sun-through and the floor are
— so an occluded lamina cannot go below the hemisphere level however dark its albedo. One line
gated on the white-bark material, `if (vIsLeaf > 0.5) reflectedLight.indirectDiffuse *= mix(0.5,
1.0, vLeafShade);` before the fills, would let the 45 % read as shadow; asked of trees-30/31 in
the INBOX. In-lane next: clumpier lobes (leaves on the outer twig thirds, gaps between sprigs) for
the silhouette itself.

## Known limits / handoffs
- The bands are soft at 16–25 m: the vertex colour is interpolated over 18 sides × 0.18–0.35 m
  rings, so a band's edge is a gradient, not a cut. Crisp edges at that range need a texture
  octave (a second, larger-scale band layer in the tile) — a candidate for the next iteration.
- Crowns from below (GOAL_MODE #2 / opus #05 at F) still need the material's fill terms scaled by
  `vLeafShade` (INBOX 11:35, `materials.ts`, trees-30).
- Seen while rendering, not mine: at `x-clearing-n` a pale arc hovers in mid-air in the haze
  (x 0.40–0.53, y 0.37–0.42; in BEFORE and AFTER alike) — it looks like a far-forest trunk's root
  arc whose trunk the haze has taken; for distant-1 / trees-31 to look at.
