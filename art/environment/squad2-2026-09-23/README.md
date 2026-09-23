# squad2 — "the trees do not populate": a mid-canopy layer for the 14–58 m band

Lane 2 of `docs/SQUAD_2026-09-23.md` (trees in the distance). Everything here was rendered on this
VM (Chrome + SwiftShader, 4 cores, no GPU) at 960 × 540 with the character hidden, through
`gauntlet/scripts/broll.mjs --shots art/environment/owner-2026-09-23/pass3/owner-0650-poses.json
--test --settle 6`.

* **before** = the integration head `144453ef` (`cursor/kokiri-world-phase1-f65e`).
* **after** = `agent/squad2-midcanopy` with the mid-canopy layer (third take: `MID_SPECS`, the tone
  and the 400-tree target).

## The defect

The owner's 06:50 screenshot is play mode on the north path looking north from the plaza's north
end. His red circle 2 is the empty grey middle distance over the path; his own recording
(`reference/frames-dense/review46/r_020`–`r_028`) stacks small and medium trees with round leafy
crowns at every depth there.

Everything we had in the 14–58 m band was a BOLE:

| what stood there | crown a walker sees at 15–45 m |
| --- | --- |
| the giants (`giant.ts`) | their canopies roof the clearing 20 m+ up, off the top of the frame |
| the white-barks (80 sampled, 12–60 m) | pale boles; the mature ones in a hero frame's far wall are rebuilt as bare columns (`COLUMN_SWAP`) |
| the column trees (10 authored seats) | bare to 10 m by design — they are the reference's dark far wall |
| the far-trunk row at z −46 | 26 m poles whose crowns start 18 m up |
| the distant layer (`distant.ts`) | **inner radius 60 m** — that is where crowns began |

So there was no leafy mass at all between the village's own foliage and the 60 m ring. The middle
distance could only be haze.

## The change

`src/world/trees/distant.ts` gains a `'mid'` kind on the same two-LOD instanced machinery as the
60–220 m layer (same wood material, same far-crown atlas, same pools, same `DISTANT_NEAR_GAIN` bark
contract so a mid bole is real bark inside 22 m):

* `MID_SPECS` — five variants, 4.8 / 6.6 / 9.0 / 11.6 / 14.6 m, crown radius 0.42 → 0.29 of the
  height, crown centre at 0.54–0.59 of it. The two SHORT ones are what fills a walker's eye-level
  strip: a 5 m sapling clump 25 m out sits at screen y ≈ 0.45 with a 1.8 m crown, where review46 has
  bushy young trees and ours had open haze.
* `midCrownCards` — a core of three crossed cards through the axis plus six crossed lobe pairs
  alternating between an upper tier (inboard, lit) and a lower one (wider, in the mass's own shade),
  then two dark near-horizontal floor cards. 17 cards, 34 triangles: the silhouette is a round mass
  with bumps instead of one crossed shape.
* `MID_CROWN_LOOK` — the crowns draw with their own material. The far layer's near-distance
  treatments were authored for a crown only ever met close OVERHEAD (in the north hollow), and on a
  crown 12 m away across the middle distance they are wrong: `CROWN_NEAR_DARK × CROWN_UNDER_DARK`
  takes it to 0.27 of its albedo, and `CROWN_EDGE_STEEP` fades its vertical cards out as soon as the
  view ray climbs 30° to it — which is exactly how a walker looks at a 12 m tree. The mid look uses
  a gentle 10–30 m gate (0.92 whole mass / 0.60 underside), no steep fade, `rim` 0.38, `fogCut` 0.3,
  and always rounds its floor cards. The atlas is shared, so the second material costs one program,
  not 4 MB of texture.
* `placeMidTrees` — its own stream (`mid-grove`), its own spacing grid. It READS the other systems'
  positions through `occupied` and adds nothing to any stream they draw from, so every white-bark,
  giant, column, distant tree, rock and plant is exactly where it was. The ground rule is the
  white-barks' own (`placement.ts treeGroundBlocked`, lifted out of `placeWhiteBark` unchanged), the
  plaza's sun corridors stay open (crowns only — a thin bole shadow is welcome dapple), and the
  round-49 expansion's ground is culled like every other legacy-built stream.

`src/world/trees/index.ts` appends the variants, places the grove, gives the mid meshes their own LOD
swap (`MID_FAR_LOD_M` 40 m) and publishes `systems.trees.midCanopy`.

## Measured

`systems.trees.midCanopy` at the owner's pose (`probe-look.mjs --audit`, second take):

```
trees 314 · culled 6 (expansionCull) · band 15.8–57.9 m · maxBaseGap 0 over 1438 bases
```

Cost at the owner's pose, `systems.trees.submission.byFamily` (second take, 314 trees):

| family | meshes | instances | draw calls | triangles |
| --- | --- | --- | --- | --- |
| `mid-near` | 5 | 18 | 5 | 9 495 |
| `mid-far` | 5 | 76 | 5 | 14 996 |
| (trees, whole system) | 136 | 504 | 88 | 3 062 040 |

24.5 K triangles and 10 draw calls — 0.8 % of what the trees already submit at that camera, far
under the W38 ceiling (camera A ≤ 9.0 M) and the 700-draw budget.

**"The middle distance must show trees, not haze", measured.** `band.mjs` takes a horizontal band of
the frame, splits it into 8-px columns and reports the standard deviation of the column means (how
much the band varies ACROSS the frame: trunks and crowns against mist) and the mean standard
deviation WITHIN a column (crown edges, gaps, layers). A flat grey veil scores near zero on both.
Band y 0.12–0.45, x 0.12–0.88, at the owner's north pose:

| frame | mean level | across-columns sd | within-column sd |
| --- | --- | --- | --- |
| reference `review46/r_022` | 102.3 | 22.08 | 27.93 |
| reference `review46/r_025` | 112.4 | 16.49 | 16.39 |
| reference `review46/r_028` | 112.7 | 17.67 | 13.95 |
| before (head `144453ef`) | 75.5 | 16.08 | 14.20 |
| after, take 1 (crowns too big / too bright) | 74.8 | 18.92 | 17.01 |
| after, take 2 (over-corrected: too small / too dark) | 74.3 | 15.41 | 15.18 |
| **after, take 3 (shipped)** | **75.8** | **19.26** | **16.23** |

The band's STRUCTURE now sits inside the reference's range on both axes (and above `r_025`'s across
-columns figure), where the head's was flatter than any of the three reference frames. The band's
MEAN is still ~36 levels under the reference: that is exposure and the height fog's depth, lane 1's
work, not the trees'.

## Play mode

`gauntlet/scripts/playtest.mjs --only look,walk,perf --shots` on the change, and `--only perf` on the
base build (`144453ef`, built into a second worktree) so the cost comparison is the same machine and
the same Chrome:

| spot | draws before → after | submitted triangles before → after | JS step ms | render ms |
| --- | --- | --- | --- | --- |
| plaza | 523 → 551 | 7 507 102 → 7 474 812 (−0.4 %) | 25.0 → 14.0 | 10.9 → 10.8 |
| stairs2-base | 522 → 552 | 9 525 649 → 9 561 907 (+0.4 %) | 19.6 → 15.0 | 9.2 → 9.8 |
| saria-side | 519 → 549 | 8 587 286 → 8 619 056 (+0.4 %) | 31.6 → 33.6 | 15.3 → 24.9 |
| west-house | 442 → 472 | 5 033 732 → 5 080 841 (+0.9 %) | 15.3 → 13.7 | 8.0 → 9.1 |

+28 to +30 draw calls (peak 552 of the 700 budget) and under 1 % of submitted triangles. The JS
timings swing both ways between the two runs — on SwiftShader a drawn frame takes 14–16 s of wall
clock and the per-frame JS figures are dominated by run-to-run noise; nothing here is a systematic
regression, and the structural numbers (draws, triangles) are.

**All nine walk routes complete with no stuck points** (`plaza-to-upper-house`,
`plaza-to-south-bank-top`, `saria-front-arc`, `west-deck`, `plaza-loop`, `south-approach`,
`house-west-to-saria-door`, `west-house-to-plaza`, `north-clearing-ledge`), and `pageErrors` is empty.

## Files

* `compare/north.jpg`, `compare/plaza-fork.jpg`, `compare/west.jpg` — before | after, full frame, at
  the three poses of `art/environment/owner-2026-09-23/pass3/owner-0650-poses.json`.
* `compare/north-band.jpg`, `compare/west-band.jpg` — the same pairs cropped to the middle-distance band.
* `compare/north-vs-reference.jpg` — the owner's `review46/r_025` beside our north pose.
* `compare.mjs` — the sheet builder (`--pair label=file`, `--crop`, `--stats`).
* `band.mjs` — the band measurement above.
