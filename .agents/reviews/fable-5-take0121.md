# fable-5 — independent visual review of take-0121 (`cf8083b`, round 48, author fable-cursor)

Filed 2026-09-20 06:00–06:25 UTC through `node gauntlet/scripts/gauntlet.mjs --review <item> … --agent fable-5 --take take-0121`.
Records: `gauntlet/reviews/<item>.json` (the take-0116 verdicts stay in each item's `history`).
Evidence: `gauntlet/reviews/evidence/fable-5/take-0121-*.jpg` — REFERENCE (left) | OURS (right) at
the same normalised region, resampled to the same pixel size.

## Provenance

- Frames judged: the six 1280×720 captures the ledger hashes for take-0121 (`monitor` branch
  `data/takes/take-0121/`, captured 05:42 UTC, settle 8, sim 12.5 s).
- U02/U03: my own non-author render of `cf8083b` with `?screen=equipment` (detached worktree,
  `.agents/reviews/fable-5-tools/equip-screen.mjs`, full-page shot) against the demo's bag frame
  `frames-dense/demo61/d_069.jpg` (34 s).
- W22: my own motion pair on `cf8083b` (`broll.mjs --time 12.5` / `13.0` at A, character on).
- Rule: the criterion as written in `gauntlet/RUBRIC.md`, judged at the criterion's frame; "like the
  reference" fails when the side-by-side shows the difference at first glance; auto gates never
  rescue a visual fail; where a fail's cause is now known to be a reference misreading (W02, W30)
  the fail stands and the fix path is named.

## Verdicts (27)

**pass (15):** W01 W03 W11 W14 W15 W18 W20 W22 W25 W26 W29 W32 W36 U01 U03
**fail (12):** W02 W05 W06 W08 W09 W10 W23 W30 W31 C01 C02 U02

Re-scored (`score.mjs --in`, monitor capture + these verdicts): **36/50 (take-0120: 30), Phase 1
31/42, failed 14, pending 0.** Improved since take-0116 by the visual verdicts: W03, W11, W14, W15,
W20, W25, W29 (+ W26/U03 which opus-review had already passed). Regressed: W38 (A 9.11 M
triangles > 9.0 M — fable-cursor's D2 flag).

| item | verdict | one-line reason |
| --- | --- | --- |
| W01 | **pass** | the reference's regions hold; nits unchanged (flight tops out at 0.13 vs 0.25, the dome fills the centre) |
| W02 | fail | improved (per-tread tone, a few green nosings) but still parallel cut slabs with square nosings and box risers; and the reference's nosings are **logs** (§6.6b / V18′) — the item can only close as timber |
| W03 | **pass** | the orange grout is gone, joints are grass-green, thickness and bevels read at E; nits: slabs 2× the reference size, cooler and paler |
| W05 | fail | the C embankment is still a lawn mound + dome bush + boulder; no terracing, no erosion |
| W06 | fail | the orange band is gone but the edge is still grass/slab in two materials; no soil, no moss gradient |
| W08 | fail | the one white-bark at C is a straight pale pole with a sprig; the flares and marks are player-height wins, fable-4's texture bands not in this SHA |
| W09 | fail | the B giant is a moss-washed column with faint fissures; no flare, no limbs at frame scale; the hazed giants are cylinders |
| W10 | fail | coverage up (roof lobes, sky 0.011) but the lobes are flat single-tone silhouettes, a grey field remains, no light breaks through |
| W11 | **pass** | crown edges at B broken and leafy (the cap's laminae and vines); no balls; nit: F's near lobes are flat (W10's problem) |
| W14 | **pass** | the limb has bark cords, moss beards, leaf clusters and three pods at the reference's height; nits: thinner, busier sprigs |
| W15 | **pass** | the stair-foot bare patch is gone, grass in the joints and on the verges; nit: the left verge is lawn-short |
| W18 | **pass** | purple in D's left foreground; nit: sprinkled, not one clump (V10) |
| W20 | **pass** | the cap is a moss dome with leaves breaking the eave, moss on walls and boulders; nits: A nosings mostly bare |
| W22 | **pass** | grass 8.0 / branch leaves 4.4 / far crowns 0.9 / slabs 3.8–4.0 (Link + shadows); 16-region variance 4.3 |
| W23 | fail | the D boulder is invisible behind a trunk and ferns; fable-2's 2 m value fix is not in this SHA and D is decided by the exclusion disc |
| W25 | **pass** | lit interior, six clustered pods, moss-and-leaf dome; nits: the door is wide and unframed by bark columns (V6) |
| W26 | **pass** | six Deku-nut pods, restrained glow, warm light on the lintel; nit: lime-led vs the reference's orange-led door cluster |
| W29 | **pass** | a flat-topped horizontal log in haze with pinpoint lanterns; nits: a flat haze field through the opening, the right leg reads as a wall |
| W30 | fail | shadows lower-right vs the reference's lower-left — the rubric-text conflict; fix path `RUBRIC_PROPOSALS.md` |
| W31 | fail | no shafts read at A, B or F |
| W32 | **pass** | four planes with ground mist under the arch (new); nit: the far plane is flat |
| W36 | **pass** | nothing floats at E; the pebble scatter is gone |
| C01 | fail | Astra's model: the silhouette passes outright; skin (125, 107, 93) s 0.14 vs tan (117, 79, 37) s 0.52, hair dark brown vs golden — a colour-only fail |
| C02 | fail | the shield's spiral ≈ 50–55 % (ref ≈ 70 %); the Kokiri Sword is not visible on the back or in the oval |
| U01 | **pass** | hearts, item slot, minimap at the reference positions; nits: minimap larger, more saturated |
| U02 | fail | shell-2's slot art is legible and framed, tabs / rupees / hints / name + description all match — but the oval holds the item alone where the reference has Link's turntable holding it ("character in an oval vignette") |
| U03 | **pass** | dark wood, gold scrollwork, warm cream serif, crisp; nit: full-width carved band vs corner flourish |

## Ranked open defects after round 48 (for round 49 briefs)

Severity 3 = the frame's read changes; the pose is where it is decided.

| # | defect | frame / pose | system |
| --- | --- | --- | --- |
| 1 | the far forest through the arch: cones on a plane, the tunnel 3× too bright, no right wall (V19, opus #01) | `x-arch-tunnel-n`, D's window | trees-31 / distant / atmosphere / structures |
| 2 | the hero flight is cut stone where the reference's is log-risered with end stakes (V18′; W02) | A, `w23-stairs-f`, `d_105` | hardscape-31 + rubric W02 wording |
| 3 | the plaza has no closure W / S / N (V15) | the 9–13 s orbit poses | layout / structures / terrain |
| 4 | slabs 2× the reference size (V16; W03's nit, W06's edge) | E top-down, `demo-49s-topdown` | hardscape-31 |
| 5 | giants: no flare, no limbs at frame scale; hazed cylinders (W09) | B left, C | trees-30 / column |
| 6 | canopy roof: flat single-tone lobes, grey field, no light through (W10); no shafts (W31) | F, A, B | canopy (owner-fable) + atmosphere (Astra) |
| 7 | the D boulder invisible behind ferns (W23) — exclusion disc + 7 m value | D left | vegetation-26 + fable-2 |
| 8 | Link's skin and hair colour (C01); the Kokiri Sword absent (C02); the oval shows the item, not Link (U02) | B, A, equipment | Astra / shell-2 |
| 9 | the C embankment a lawn mound (W05); grass/slab edge without soil or moss (W06) | C, E | terrain / vegetation-26 / hardscape |
| 10 | the white-bark at C a straight pole (W08) — fable-4's `cfcd4f4d` bands and `c46081f6` crowns are verified and waiting for merge | C | fable-4 (merge) |

Not verdicts but worth the owner's eye: the mist veil across B's middle ground and the ground mist
under the arch in D are the two biggest reads round 48 added; both come from Astra's/owner-fable's
lanes and both pull the frames toward the reference without a rubric item to credit them.
