# "Check everything" on head `e438c6e5`: the frames hold the gate, behaviour is clean, play mode is still over

The owner's 10:24 note was "make it ready, keep working and CHECK EVERYTHING". Plenty has merged since
any lane last ran the whole budget and behaviour set, so this is that sweep, on the current head, with
the numbers put beside my own measurements from earlier today so the movement is visible.

## The six fixed views hold W38 (`pose-counts.mjs --settle 8`, 960 × 540)

| view | draws (≤ 700) | triangles (≤ 9.0 M) |
| --- | --- | --- |
| A_stairs | 614 | **8.97 M** |
| B_house | 596 | 8.29 M |
| C_lookback | 533 | 7.96 M |
| D_log | 523 | 8.74 M |
| E_ground | 596 | 8.29 M |
| F_canopy | 555 | 8.10 M |

Every view is inside both ceilings. The binding one is A at **30 K of triangle headroom (0.3 %)**, so
any lane planning to spend geometry at A has to find it first — the two places it is sitting are
measured: the sun's depth pass (2.91 M at A, two thirds of it the solid world,
`../shadowcost/DEPTH-SPLIT.md`) and vegetation's colour pass (2.46 M at A, 1.46 M of which thinning
removes, same file).

## Behaviour is clean (`playtest.mjs --only look,walk,perf`)

* **look:** 10 spots, none flagged. Every spot reports the same camera envelope — up 60.2°, down
  −35.5°, and 83.2° of world visible above the horizon — so the look-up range the owner asked for on
  2026-09-23 is uniform across the village, the stairs and the open north.
* **walk:** 11 routes, **0 stuck** anywhere: `plaza-to-upper-house` 627 frames, `plaza-to-south-bank-top`
  306, `saria-front-arc` 105, `west-deck` 132, `plaza-loop` 510, `south-approach` 264,
  `house-west-to-saria-door` 204, `west-house-to-plaza` 402, `north-clearing-ledge` 1,569,
  `south-bridge-to-log` 969, `north-grove` 1,248.
* **pageErrors: none.**

## Play mode: draws improved, the triangle breach is unchanged

| play spot | now | at 07:22 today | change |
| --- | --- | --- | --- |
| plaza | 578 draws / 7.99 M | 585 / 7.95 M | −7 draws |
| **stairs2-base** | **585 / 9.59 M** | 611 / 9.60 M | −26 draws, triangles flat |
| saria-side | 559 / 8.94 M | 577 / 8.94 M | −18 draws |
| west-house | 463 / 5.56 M | 478 / 5.55 M | −15 draws |

Draws came down at every spot — that is fable-4's near-canopy `BatchedMesh` landing, and it is visible
here as −7…−26 calls. Triangles did not move, so **the main flight's foot is still 6.5 % over the 9.0 M
line in play mode** (`../playcost/`), and the attribution there still stands: vegetation is +1.0 M of
that frame against hero A, trees −0.2 M.

## Lane 2's own state

Nothing in this sweep is a lane-2 defect. For the record, the lane's measured position on this head:

* the distance layers are cheap — `mid-far` 305 instances for 60 K triangles, `distant-far` 200 for
  4.8 K (`../lookbacks/`);
* the giants' mesh family is 18 % wood, 53 % leaves, 29 % foldable far foliage, and every giant's
  relief bole is 0 (`../giantwood/BY-TREE.md`);
* the trees' share of the depth pass is 0.56 M at A and survives both existing culls
  (`../shadowcost/DEPTH-SPLIT.md`);
* nothing arrives late on the north walk — 0.02 % of pixels with the clock frozen (`../arrival/`);
* overhead reads as leaves everywhere measured, 4.04–6.49 local detail (`../roofsky/`, `../uplooks/`).

## A negative result, so nobody re-treads it

Last iteration's plan was a camera-aware rung for the giants' leaf density (the mass the by-tree table
found). The table itself argues against it: the leaves are concentrated in trees the fixed cameras do
look at — `plateau-oak` 312 K at 26.0 m, `north-west-near` 75 K at 11.6 m — while the two giants no
camera holds carry 104 K (`lantern-tree`, which stands over the plaza where a player walks under it)
and 41 K (`southwest-giant`). A rule that thins only what no camera sees would save on the order of
8 K triangles and would risk the one tree a player stands beneath. The lever is not there.
