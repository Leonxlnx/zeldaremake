# fable-5 — player-height walk of the world head `3d50f6c8` (fable-2 / fable-3 / fable-4 merged)

Independent, non-author. Two questions: (A) did the three lanes merged at 23:50 UTC (PR #12 rocks,
PR #13 props, PR #15 white-barks) land what their PR bodies claim, at the poses where the defects
were recorded; (B) what does the head look like at the demo poses the six fixed frames never take
(`reference/ANALYSIS_VIDEO2.md` §6). Sheets in `fable-5-walk/`.

## Provenance

- **after** = `3d50f6c8` (world head, tick 178), detached worktree `/tmp/f5/wt2`, `npm run build` green.
- **before** = `a0e06cf4` (the head immediately before `f092a094`, the first of the three merges —
  so the before/after difference is exactly the three lanes and nothing else), worktree `/tmp/f5/wt0`.
- Renderer for both: `node gauntlet/scripts/broll.mjs --dist dist --size 1280x720 --fps 12 --test
  --settle 8` (`--character --hud` for the demo poses only). Headless SwiftShader on the fable-5 VM
  (not the shared box; no capslot needed). Poses from `art/environment/survey2/manifest.json`,
  `.agents/reviews/opus-review-walk/manifest.json` (seated by hand: the walk manifest stores
  `p.y = 0` with `groundEye 1.45`; the clearing floor is y ≈ 4.0, the tunnel floor ≈ 4.25), plus five
  demo-equivalent poses derived in `ANALYSIS_VIDEO2.md` §6.
- Verdict words as in survey-2: **FIXED** (the recorded defect is gone), **IMPROVED** (visibly
  better, the defect still readable), **UNCHANGED**, **WORSE**.

## A. The three merges, before | after at their poses

| lane | recorded defect | pose | verdict | what the after shows | still open |
| --- | --- | --- | --- | --- | --- |
| fable-4 (#15) | survey-2 #31 / opus #09: white-bark = painted tiling, black diamond scars, no flare, trunk meets grass on a straight cut | `sn-whitebark-base` (aim 1.1 m) + `sn-whitebark-base-low` (aim 0.35 m) | **FIXED** (scars, straight cut) / **IMPROVED** (bark) | the diamond scars are gone; fine lenticel bands and small paper curls at 2 m; at the low aim the trunk widens into a butt flare and three dark toes run onto the ground where the before was a straight cylinder with grass tufts | the toes are near-black blobs against a pale trunk — they read as shadows more than roots at 1280 px, and the Verdant Forest reference keeps one bark colour top to toe; between the bands the bark is still a smooth tube at 2 m |
| fable-2 (#12) | survey-2 #19/#32, opus #10: shot-D boulder = dark mass, two black cavities, polka-dot lichen | `sn-boulder-shotd` | **IMPROVED** | the cavity at the left and the dark seam are closed; a grey-green lichen crust reads on the top face; the silhouette is a single rounded form | still a dark lump three-quarters buried in ferns — it does not yet read as the reference's lit, layered hero rock with a moss cap (V9); fern exclusion around it is the other half |
| fable-2 (#12) | survey-2 #17: stair-foot boulder = flat pale face + angular shard fringe | `sn-boulder-stairfoot` | **IMPROVED** | the before (`a0e06cf4`) already carried the cracked lichen face and moss cap from round 46/47; the merge adds lichen patches and rounds the shard skirt, whose tops now go pale and sink into the grass | the angular dark splinters are still readable at the skirt's right edge (x 0.30–0.45); the crack network is an even hairline — fine at 2 m, not checked at 6 m |
| fable-3 (#13) | survey-2 #32: crate = smooth flat planks | `w28-plateau-d` | **FIXED** | the before's uniform dark-brown box is now weathered plank wood with grain, gaps and edge wear; a barrel with staves and hoops and a bucket beside it, a pot at the frame's edge | the fence rails beside it remain smooth cylinders (survey-2 #27, not this lane) |
| fable-3 (#13) | survey-2 #37: a fern pierces the pot below the house stair; pots by the plateau / stairs | `w26-stairs-d` | **FIXED** (#37) / **landed** (pots) | the pierced pot at the left is gone; a clay pot (smooth orange-brown body, dark rim) now stands clear of the ferns at the right, with the barrel, plank crate and bucket seated below the house stair | the pot body is one smooth tone at 3 m — no throwing rings, no wear at the rim; the reference pots (`d_023` foreground, ANALYSIS §2.3) carry a pale band and a chipped lip |
| fable-2 (#12) | opus #03: the raised ledge is a flat olive mound (`LAYOUT.rockLedges.north-terrace` live since `cf72e62`) | `x-ledge-foot`, `x-clearing-n` | **UNCHANGED** | a flight of five blue-grey steps up a low dark-olive rise; no rock face, no strata, no damp band; the terrace top is ≈ 1.6 m above the clearing here, not ref-04's 3–3.5 m wall; behind it the flat pale plain and smooth grey cones (opus #01) and the near-black void band along the clearing's rim (opus #14) are all present on the head | fable-2's next item #1 in `docs/GOAL_MODE.md` — nothing dresses the ledge yet; confirmed open |

Net: the three lanes did what they said where they said it — two FIXED outright (crate, pierced pot),
the white-bark base and scars FIXED with a tonal note, two boulders IMPROVED, the ledge untouched as
expected. The remaining rock and prop defects are the *next* items already on their lists; nothing
regressed at the seven poses. Sheets: `fable-5-walk/fable-5-walk-ba-<pose>.jpg` (BEFORE | AFTER).

## B. The demo poses — what the fixed frames never see

Measured in `reference/ANALYSIS_VIDEO2.md` §6; one line each here.

| pose | reference frame | one-line read of the head |
| --- | --- | --- |
| `demo-09s-orbit-W` | `d_019` (9 s) | stair block, fence, kid, boulder and the new pots hold; the plaza's west is a flat pale plain with a hard tree line where the footage has a mossy bank in haze and a spreading giant |
| `demo-11s-orbit-NW`, `demo-13s-orbit-N` | `d_023`, `d_027` | nothing closes the plaza on these headings — trunks, a moss bank, the far plain; the footage has a second house, a far hut in haze, a Kokiri on a bank |
| `demo-44s-walk-to-house` | `d_087` (43 s) | the house holds (darker: bark l 0.22 vs 0.33); right of it stands the hero stair instead of the footage's bank + girl + pale boulders + low step + light string |
| `demo-49s-topdown` | `d_097` (48 s) | slabs 1.7–2.5 m with 17–21 cm orange joints brighter than the slab, vs 0.8–1.1 m with 6–10 cm dark mossy joints |
| `w23-stairs-f` | `d_107` (53 s) | the flight darkens toward its top (l 0.35 → 0.17) where the footage brightens into a haze gap (0.37 → 0.65); no rail |
| `w18-spine-f` | `d_117` (58 s) | belly plates and pinpoint pods hold; beyond the arch a haze band and cones on a plane; orange joints vs moss-green |
| `x-arch-tunnel-n` | `d_121` (60 s) | frame l 0.43 vs 0.13; no right wall; floor l 0.46 vs 0.15; the window is a plane with cones, not trunks and lights |

## C. Ranked open defects on the head (this walk + what it confirms of opus-review's list)

Severity 1–3; "poses" = how many of my 17 renders show it.

| # | defect | pose(s) | system | sev | poses | note |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | the far forest is smooth grey cones with hard base seams on a flat pale plane, seen through the arch and from the clearing | `x-arch-tunnel-n`, `x-clearing-n`, `x-ledge-foot`, `w18-spine-f`, `demo-09s`, `demo-13s` | trees/column + trees/distant + terrain north plain (trees-31) | 3 | 6 | = opus #01; **the tunnel view makes it the first thing the owner sees** |
| 2 | under the arch is not a tunnel: 3× too bright, no right wall, floor l 0.46 | `x-arch-tunnel-n` | structures/logArch + atmosphere (Astra) | 3 | 1 | new (V19) |
| 3 | the plaza has no closure W / S / N — flat plain + hard tree line | `demo-09s/11s/13s` | layout + structures + terrain | 3 | 3 | new (V15); the owner's "backside" question |
| 4 | slabs 2× the reference size, joints 2× the width and the wrong polarity (bright orange, not dark green) | `demo-49s-topdown`, `w18-spine-f`, `x-arch-tunnel-n`, `demo-*` | hardscape-31 | 3 | 7 | = opus #04 / V8 / V16, now measured from above |
| 5 | the raised ledge is a low olive rise with a flight, no rock face; void band at the clearing rim | `x-ledge-foot`, `x-clearing-n` | rocks (fable-2 #1) + terrain | 3 | 2 | = opus #03 / #14, confirmed unchanged |
| 6 | the hero flight's gradient is inverted (darkens to the top) and reads as even bands at 6 m | `w23-stairs-f` | atmosphere + hardscape/stairs | 2 | 1 | new (V17) + opus #15 |
| 7 | shot-D boulder still a dark lump under ferns | `sn-boulder-shotd` | rocks (fable-2 #2) + vegetation exclusion | 2 | 1 | opus #10 improved, not closed |
| 8 | white-bark root toes near-black against the pale trunk; bark a smooth tube between the bands | `sn-whitebark-base-low` | trees/whitebark (fable-4) | 1 | 1 | new; after PR #15 |
| 9 | pots one smooth tone, no rings or lip wear | `w26-stairs-d`, `demo-09s`, `demo-49s` | props (fable-3) | 1 | 3 | new; after PR #13 |
| 10 | fence rails smooth cylinders beside the new crate | `w28-plateau-d` | props / hardscape | 1 | 1 | survey-2 #27, unchanged |

The one-line read: **the merges are real and local; the world past 8 m is unchanged**, and the
demo's own camera spends its last three seconds looking at exactly that layer through a tunnel that
is not dark enough to hide it.
