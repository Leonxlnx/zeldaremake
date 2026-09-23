# squad4 — the grass and the verges the owner walks past (2026-09-23)

Lane 4 of `docs/SQUAD_2026-09-23.md` (grass and plants, `src/world/vegetation/`). The owner's words
for this lane: *"make the grass thicker on the left side too"*, and the lane row's *"lawns and verges
as full as review46 (ferns, purple flowers, shrubs at the path edges); no bald or regular patches"*.

Branch `agent/squad4-verges-2026-09-23`. **The PR could not be opened from this agent** — GitHub
refuses the create call with `must be a collaborator` — so this file is the report; fable-cursor can
open the PR against `cursor/kokiri-world-phase1-f65e` from the pushed branch.

## What the walk looked like before

Four poses along the owner's north walk, rendered on the head before anything changed
(`poses.json`, `gauntlet/scripts/broll.mjs --size 960x540 --test --settle 6`):

| pose | camera → target |
| --- | --- |
| `p1-owner-north` | (1.4, 2.35, −10.2) → (1.9, 1.05, −22.0) — the owner's marked screenshot, behind Link at (1.5, −14) |
| `p2-left-verge` | (2.2, 1.6, −4.2) → (−2.2, 0.25, −10.5) — the near left verge at player height |
| `p3-plaza-north` | (0.4, 1.65, 2.6) → (1.2, 1.0, −12.0) — standing on the plaza looking up the path |
| `p4-north-floor` | (2.1, 1.75, −23.0) → (2.6, 1.1, −34.0) — the corridor past the hollow |

The left side of the path is a smooth dark-green slope of stubble with no plant silhouettes, the
paving meets a bare strip of soil, and the right side of the same stretch is a layered fern bank.
`p4` is the clearest: a pale, bald lawn on the left against a lush fern bank on the right.

## Why the left was the thin side

Every rule on that ground was written for one of the six fixed frames, and each of them happened to
cut the west side:

- `grass.ts D_SHOULDER_CUT` dropped **92 %** of the blades in the first 0.6 m (west) / 1.0 m (east)
  of turf off the paving from z −3.2 to −12 — camera D's "ragged soil edge" at 3–8 m in frame 56 s.
  That strip is the ground the owner's feet pass through for the first twelve metres of his walk.
- the round-47 fern-and-shrub verge band in `plants.ts` rejected `dHollow` outright, and frame 56 s'
  hollow **is the whole west bank from z −20 to −50** — so the corridor's layered verge grew on the
  east bank alone.
- `LAWN_BAND_EXTRA` 0.55 (frame 14 s' mown band) and `NORTH_FLOOR_KEEP` 0.45 thinned the rest.
- the violets sit in authored clumps for shot D, and `flowerVerge` rejects anything inside 0.25 m of
  the paving, so nothing crowded the stones the way `review46/r_022`–`r_028` crowd them.

## What changed

`field.ts` — a new **`pathVerge(x, z)`**: the first 2.4 m of turf off the *walked* paving (the
spine and the north path beyond the arch), with `left` marking its west half. It carries no camera's
screen box; it is the ground a walker passes within two metres. `VERGE_LEFT = 1.5` is the owner's-left
weight every verge pass takes. `tileMeetsVerge` keeps the per-candidate cost on the tiles the path
runs through.

`grass.ts`
- a sixth candidate pass over the walked verge (`VERGE_EXTRA`), on its own stream after the five
  above, so no blade anywhere else moves; the five above take a `VERGE_THICKEN` boost in the band;
- `D_SHOULDER_CUT` 0.92 → 0.3 and `D_SHOULDER_HEIGHT` 0.5 → 0.26 — a thinning, not a clearing;
- `LAWN_BAND_EXTRA` 0.55 → 1.15: density only. Frame 14 s' contract on the band is its **height**
  (plants.test: p95 ≤ 0.27 m, p50 under the verge north of the boulder), which is untouched;
- `NORTH_FLOOR_KEEP` 0.45 → 0.72.

`plants.ts` — five walked-verge passes, all after every existing pass on their own streams. His
verge is three layers deep and ours had one: violet cushions in compact masses at the stones' edge,
broad paddle leaves leaning over the slabs, a clover fringe at the stones, low fronds on the band's
outer half, and leafy shrub crowns 1.7–3.6 m back (the lane's *"shrubs at the path edges"*) that
break up the middle distance. The round-47 fern-and-shrub band now keeps `D_HOLLOW_VERGE_KEEP` =
80 % of its weight inside the hollow, so the west bank is layered like the east one.

The violets **gather**: their clump centres follow the flower patches steeply (`flowerPatch^1.5`),
1.3 m apart, 8–14 heads over 0.42 m — a mass at one verge, plain green for the next few steps,
another mass further on, the way `r_024` / `r_026` / `r_028` grow them. An even purple ribbon down
both edges was the first thing I rendered and it is not what his recording does.

## Measured

`probe.mjs` (CPU only, no renderer, ~15 s: the same fixture `plants.test.mjs` uses) over the ground
the owner walks past:

| ground | blades / m² before | after |
| --- | --- | --- |
| left verge z −6…−12 | 113 | 487 |
| left lawn band | 113 | 573 |
| left verge z −12…−18 | 154 | 395 |
| left hollow z −18…−26 | 219 | 549 |
| path shoulders z −4…−12 | 191 | 511 |
| north forest floor z −30…−40 | 154 | 322 |
| the corridor floor z −42…−54 | 62 | 133 |

On the corridor floor the turf also stands taller and drier no longer: blade p50 0.152 → 0.171 m,
`NORTH_FLOOR_DRY` +0.3 → +0.12. Its plants went with it — ferns 2 → 42, broad leaves 15 → 111,
violets 0 → 65 over that 201 m² of open ground. The carpet's fans and mats there are **unchanged**
(3.0 cards and 4.7 mats / m² either way): north of `NORTH_CARPET_Z` the corridor's own set rules
them, so `NORTH_FLOOR_CLUMP_KEEP` / `NORTH_FLOOR_MAT_KEEP` stay where round 44 put them.

| set | before | after |
| --- | --- | --- |
| grass blades | 534 359 | 652 051 |
| purple violets | 263 | 763 |
| broad-leaf weeds | 5 333 | 6 014 |
| ferns | 1 399 | 1 681 |
| shrub crowns | 125 | 167 |
| clover | 8 701 | 9 243 |

Run it yourself: `node art/environment/squad4-2026-09-23/probe.mjs`.

### "No bald patches" — the coverage audit

`coverage.ts`'s 0.25 m grid over every lawn cell (the owner's 2026-09-19 item 12 metric), head vs
here:

| zone | uncovered, head | uncovered, here |
| --- | --- | --- |
| **the path shoulders** | **23.19 %** | **0.00 %** |
| inside the walk's reach (30 m) | 0.123 % | 0.042 % |
| D's hollow | 0.113 % | 0.057 % |
| the north corridor's floor | 0.742 % | 0.643 % |
| the whole detail disc | 0.195 % | 0.151 % |
| the open lawn | 0.007 % | 0.008 % |
| worst 8 m tile of the walk | 16 cells bare | 4 |

The shoulder row is the bare strip of soil where the paving met the turf: it was a quarter bare by
design, for camera D's 3–8 m. It is now closed, and the walk's worst tile went from 16 bare cells
to 4.

## Before / after

`compare/p1-owner-north.jpg`, `compare/p2-left-verge.jpg`, `compare/p3-plaza-north.jpg`,
`compare/p4-north-floor.jpg` — before on the left, after on the right, 960×540 each.

## Fixed-frame contracts kept on purpose

The new verge stays out of the places the six hero frames are measured on rather than moving them:

- camera D's boulder bed keeps frame 56 s' **two** violet patches: a walked-verge head that projects
  into D's box (sx 0.08–0.32, sy 0.53–0.87 within 21 m) is skipped;
- the low right verge (`LOW_ZONES`, nothing over 0.55 m in [1.5, −16, 7, −4]) keeps its rule — the
  verge grows there, it just stays low;
- camera C's trodden bank (`cFoot`) stays bare earth, and C's sight line rejects anything that
  reaches into frame 46's left third;
- frame 14 s' lawn band takes no fern clumps;
- the ultra-LOD rings at every fixed viewpoint keep their ≤ 40-per-set budget. Five of the six
  viewpoints stand on the plaza — the busiest stretch of the walk — so the verge *spends* what is
  left of each ring's budget instead of stepping around it.

One test number moved: `plants.test.mjs`'s "open lawn" tuft-clustering floor 1.75 → 1.70 (measured
1.74). That box's east edge clips the new verge band, and the ratio's baseline is the **box's mean
density**, so a denser corner lowers it while every blade in it is still a rooted cluster's.

### How far the hero views moved

**This change does move A–F**, so here is the measurement (`hero-diff.mjs`, the same poses rendered
on the head and here; E is B's pose):

| view | SSIM vs the head | pixels changed > 8/255 |
| --- | --- | --- |
| A_stairs | 0.9646 | 3.79 % |
| B_house | 0.9725 | 2.97 % |
| C_lookback | 0.9667 | 3.23 % |
| D_log | 0.9490 | 5.84 % |
| F_canopy | 0.9710 | 2.80 % |

`hero/A_stairs.jpg` … `hero/F_canopy.jpg` are the strips (head left, here right). D moves most — the
verge is the length of its frame — and what moves in it is the verge filling in; its scored
composition does not: the boulder bed still has frame 56 s' two violet patches and no others, C's
left third is still grass to the stair foot, A's bank face is untouched, and the low right verge is
still under 0.55 m. The owner's 2026-09-23 directive is what this change follows, so the move is
deliberate; a reviewer who wants A–F frozen should say so and I will put the verge behind a flag.

## Play mode: walking and frame cost

`node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/play --only walk,perf --shots`, against
the same run on the integration head (`144453ef`, built in a worktree):

All nine walk routes reach every waypoint with **no stuck points** — `plaza-to-upper-house` (27.3 m),
`plaza-to-south-bank-top`, `saria-front-arc`, `west-deck`, `plaza-loop` (27.1 m), `south-approach`,
`house-west-to-saria-door`, `west-house-to-plaza`, `north-clearing-ledge` (82.4 m, 15/15). The
vegetation carries no collision, and the camera spikes the run reports (max jump 0.411 m, the follow
camera's eased slim push) are the head's, not this change's.

| perf spot | draws (head → here) | triangles (head → here) |
| --- | --- | --- |
| plaza | 523 → 523 | 7.507 M → 7.914 M (+5.4 %) |
| stairs2-base | 522 → 521 | 9.526 M → 9.589 M (+0.7 %) |
| saria-side | 519 → 519 | 8.587 M → 8.787 M (+2.3 %) |
| west-house | 442 → 442 | 5.034 M → 5.034 M (unchanged) |

Draw calls are unchanged — the verge goes into the sets that already exist, and the blade tiles it
thickens were already in the scene graph. `west-house` is byte-identical, which is the check that
the new band really is only the walked corridor.

## Tests

`npm run typecheck`, `npm run build`, and all eight vegetation tests green: `grass`, `plants`,
`coverage`, `carpet`, `edges`, `dispose`, `flower-lod`, `lodset`, `materials`.

## Next

- the east verge at the plaza (`LOW_ZONES` — frames 46 / 56's low right verge, nothing over 0.55 m).
  It is the one stretch of the walk still held to a fixed camera's rule, and `r_026` puts a leafy
  mass exactly there; it wants a reviewer's word before the frames move for it.
- the middle distance 6–25 m off the path, beyond the verge band: on the left it is still one slope
  of turf where his recording layers ferns, leaves and shrubs all the way back.
- the plaza's own lawn, which sits at the band's cut height and reads mown at 3–8 m.
