# Round 47 — white-bark bases and crowns (fable-4, PR #15)

Survey-2 #31 (`sn-whitebark-base`: "identical painted birch tiling, no flare, ~1 m vertical
repeat") and the onboarding block's crown item (laminae must read as layered leaf silhouettes at
3–10 m). BEFORE = `d06e275` (world tree = take-0116's `973a21e`), AFTER = `80fab20`
(`agent/fable-4-whitebark`), both rendered with
`broll.mjs --size 1280x720 --fps 12 --test --settle 12` at the poses in `poses.json`
(the survey pose, seven poses on the survey's own tree and two others, `w18-spine-r`). Every
sheet is BEFORE | AFTER at an identical pose. Rule (round 46): an after that looks like its before
is a FAIL, not a claim.

## Verdicts

| pose | what it tests | verdict | what changed |
| --- | --- | --- | --- |
| `sn-whitebark-base` (survey #31) | the base at 2 m | **PASS** | a bell-shaped fluted foot with a near-black sooty band where there was a straight cylinder; lens lenticels, a cracked dark lenticel band, paper curls; no repeated knot pairs |
| `f4-base-4m`, `f4-base-low` | the flare from 4 m / from knee height | PASS | the flare reads as a flare; toes leave it through the ferns |
| `f4-trunk-2m` | the bark at 1.5–3 m | PASS | eye-shaped knots, a dark band with cracks, paper seams, curls in the ring's own tone; no visible repeat in the 2 m window |
| `f4-mature-relief` (−57.7, 11.7) | the toes on sloping ground, no undergrowth | **PASS** | the round-46 buttresses hang in the air on the downhill side; the seated toes lie on the terrain as fat root humps that go under while still thick |
| `f4-young-3m`, `f4-sapling-relief` | the young / sapling classes | PASS (young) / marginal (sapling) | the young stem shows its flare and bands; the sapling's flare is a hand tall and its toes are under the grass |
| `w18-spine-r` | the stems at 15–25 m | PASS (modest) | flared feet on the far pale stems; the bark's dark marks read |
| `f4-crown-up` | a lobe from 7 m below | **marginal** | more tone variation between neighbouring laminae, a slightly darker underside (lobe mean 107 → 103 sRGB); the region's spread is unchanged (sd 21.2 → 21.0). The flat pale level from below is set by the hemisphere indirect on the undersides and the leaf shade floor (materials.ts) — outside this lane; see the INBOX note to trees-30 |

## Six fixed views (settle 6, vs a baseline capture of `d06e275` that reproduces take-0116 within ± 0.001)

| view | before | after | Δ | draws | triangles |
| --- | --- | --- | --- | --- | --- |
| A | 0.2249 | 0.2249 | 0 | 521 → 523 | 8.797 → 8.918 M |
| B | 0.2029 | 0.2029 | 0 | 479 → 481 | 7.944 → 8.064 M |
| C | 0.2359 | 0.2362 | +0.0003 | 363 → 365 | 7.372 → 7.495 M |
| D | 0.2779 | 0.2780 | +0.0001 | 354 → 356 | 8.123 → 8.244 M |
| E | 0.2135 | 0.2135 | 0 | 479 → 481 | 7.944 → 8.064 M |
| F | 0.2634 | 0.2634 | 0 | 468 → 470 | 8.259 → 8.380 M |

White-barks stand in C's frame only (0.5 % of its pixels changed; A/B/E/F pixel-identical).
leafCount 288,607 (unchanged), W12 161/161 seated (maxGap 0), determinism diff 0, console clean.
The +2 draws are the merged root mesh and its shadow; +0.12 M triangles are the dense base rings,
the curls and the toes.

## Placement stability

Every new draw comes from `createRng('whitebark/<seed>').fork('base-47')…`; the five legacy
buttress draws a root are still consumed. LOD-0 `radius` identical on all 10 variants, `height`
identical except ± 4 µm on the two saplings; leaf vertex positions identical on 7 of 10 (the three
mature variants with epicormic shoots: the shoot shoulder reads the trunk radius, ~6 shoot
leaves each moved ≤ 1 cm). An exact `placeWhiteBark` replica in node (real terrain + layout + the
seed chain) gives the SAME 80 placements before and after — it also finds the survey's tree:
variant 7 at (−7.394, 0.302, 12.869).

Why the toes are a per-instance mesh: on those placements the terrain drops more than 0.15 m
within a 1.6 m toe reach under 39 of the 80 trees (p90 0.46 m, max 1.36 m) — local relief, not
trunk slope (≤ 0.23). Flat toes in the instanced variant float there (`f4-mature-relief`, before).
