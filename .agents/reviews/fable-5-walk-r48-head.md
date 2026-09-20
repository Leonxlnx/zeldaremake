# fable-5 — player-height walk of the round-48 head `89473888` (GOAL_MODE fable-5 #3)

The head after take-0121's `cf8083b` plus the goal-mode merges of 06:06 UTC (fable-2 ledge + clearing
rocks + shot-D value, fable-3 lookout + clearing props + per-locality merge + light strings, fable-4
clearing trees + crowns + texel bands). Rendered by me, non-author: `broll.mjs --size 1280x720
--test --settle 8`, 20 poses (the six fixed views, `wb-grove-10m`, and the 13 opus / survey-2 /
fable-5 poses below). Before = my renders of `3d50f6c8` (before any goal-mode merge) at the same
poses where I have them. Sheets in `fable-5-walk-r48/`.

## What round 48 + the goal-mode merges changed at player height

| pose | before (`3d50f6c8`) → now | read |
| --- | --- | --- |
| `x-arch-tunnel-n` (the view through the arch) | grey cones on a plain → two banded young white-barks with darker crowns, the waymarker and pot pair at the path's entrance, a Hylian-glyph signpost, a lantern post at the ledge flight, the stone terrace wall at the far end | **the tunnel view has life in it for the first time**; the cone forest and the flat pale plain behind are unchanged (opus #01 / V19 — structures-32 and trees-31 are on it) |
| `x-clearing-n`, `x-ledge-wall`, `x-ledge-foot` | olive mound → a squared stone terrace wall with beds, a damp lower band, ferns at its foot, scree and strata slabs on the flight's flanks, a lantern post above | **opus #03 closed as far as the 1.7 m layout rise allows**; the wall's beds still read as chunky facets, and the raise of `ledgeTerrace` toward ref-04's 3–3.5 m is fable-cursor's |
| `x-northpath-n`, `x-clearing-stones` | seven grey cylinders → low dark stones with moss caps and chipped tops | **opus #02 IMPROVED** (irregular stones); they sit low in the grass and read as boulders more than standing stones |
| `x-house-door` | (black room in survey-2) → a lit, furnished hollow: plank walls, bed, table and stools, shelves with pots, a lamp | **opus #11 closed** (structures-31's lit textured hollow) |
| `x-lookout` | grass at the hook → the rope railing on the dais framing the plaza in the mist veil | fable-3's lookout, verified in §fable-3 |
| `w23-stairs-f` | even bands → moss on the nosings, per-tread tone | **improved, still cut slabs** — the reference's risers are logs (V18′) |
| `sn-boulder-shotd` | dark mass → pale warm stone with cleave lines and lichen under ferns | fable-2's value fix merged; D still hides it (W23) |
| `sn-lantern-limb` | — | bark cords, moss beards, pods: holds (round 47's win) |
| `wb-grove-10m` | uniform pale poles → near-black torn bands and chevron scars, olive crowns | fable-4's marks and crown tone merged; the sky between the crowns is still open blue |
| `w27-plateau-u` | — | **≈ 22 % of the frame is open blue sky** straight up from the plateau; the canopy roof does not reach this pose (opus #05) |
| the six fixed views | see `fable-5-take0121.md` | 36/50 with my verdicts; nothing in the merges after `cf8083b` moves A–F by more than 0.7 % of pixels |

## Ranked open defects for round 49 (walk + take-0121 verdicts, merged)

| # | defect | pose(s) | system | sev |
| --- | --- | --- | --- | --- |
| 1 | **the far forest is cones on a flat plain and the arch is not a tunnel** (V19, opus #01): frame l 0.43 vs 0.13 under the arch, no right wall, floor l 0.46 vs 0.15; beyond the new trees the plain runs flat to a haze wall | `x-arch-tunnel-n`, `x-clearing-n`, D's window | structures-32 (tunnel) + trees-31 + terrain north + atmosphere | 3 |
| 2 | **the hero flight is cut stone; the reference's is log-risered with end stakes** (V18′; W02 fails on every take) | A, `w23-stairs-f`, `d_105` | hardscape + rubric W02 wording | 3 |
| 3 | **no closure of the plaza W / S / N** (V15) — expansion-2 "the backside" is building | the 9–13 s orbit poses | expansion-2 | 3 |
| 4 | **open sky overhead** — 22 % blue at `w27-plateau-u`, the gaps between the grove crowns; F's lobes flat single-tone with a grey field (W10); no shafts anywhere (W31) | `w27-plateau-u`, `wb-grove-10m`, F, A, B | canopy (owner-fable) + atmosphere (Astra) | 3 |
| 5 | **slabs 2× the reference size** (V16): W03 passes on thickness/bevel/green joints; the scale and the cool pale tone remain | E, `demo-49s-topdown` | hardscape | 2 |
| 6 | **giants: no flare, no limbs at frame scale, hazed cylinders** (W09); column trunks smooth cones with base seams (opus #12) | B left, `x-arch-tunnel-n`, `x-clearing-n` | trees-30 / column | 3 |
| 7 | **the D boulder invisible behind ferns** (W23) — the exclusion disc and the 7 m value | D left | vegetation-26 + fable-2 | 2 |
| 8 | **Link's skin and hair colour** (C01), **the Kokiri Sword absent** (C02), **the oval shows the item, not Link** (U02) | B, A, equipment | Astra / shell-2 | 2 |
| 9 | the C embankment a lawn mound (W05); the grass/slab edge without soil or moss (W06) | C, E | terrain / vegetation-26 / hardscape | 2 |
| 10 | the terrace wall's beds read as chunky facets; the standing stones sit low; the strata slabs very pale | `x-ledge-wall`, `x-northpath-n` | fable-2 / hardscape | 1 |
| 11 | the far crowns nearly static (W22 nit); the right-edge crown at `x-arch-tunnel-n` with a light-blue rim (opus #07 family) | A, `x-arch-tunnel-n` | trees-31 / distant | 1 |

The one-line read: **round 48 and the goal-mode night filled the middle distance** — the terrace,
the clearing's entrance, the lit hollow, the marked white-barks, the light strings — while the two
things the owner sees first at the arch and overhead (the far forest, the open sky) are the round-49
lanes' to close; and the flight can only match the reference as timber.
