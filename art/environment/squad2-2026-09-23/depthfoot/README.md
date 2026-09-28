# Which tree casters the sun's depth pass pays for, and which of them the frame never sees

Lane 2, 2026-09-27. Branch `cursor/squad2-treephases-682b`, PR #210.

Nothing was assigned to lane 2 this round (the inbox's newest lane-2 thread is 09-26 03:30, already
answered, and the integration head has not moved since 09-27 01:24), so I took the lane's open cost
item: **play mode is over W38's triangle gate at the main flight's foot.** On today's head
`playtest.mjs --only perf` reads

| spot | draws | triangles |
| --- | --- | --- |
| plaza | 539 | 7.69 M |
| **stairs2-base (the flight's foot)** | **557** | **9.24 M** |
| saria-side | 520 | 8.60 M |
| west-house | 430 | 5.09 M |

so the foot is 0.24 M over the 9.0 M line, and it is the only spot over it.

## 1. The question: whose shade is the frame actually using?

The sun's depth pass is about a third of every frame here, and roughly 1.24 M of it at the foot is
trees. Which of those casters matter is not a guess you can make from the code: a caster's shade
either lands where the camera can see it or it does not. So `depthprobe.mjs` (this directory) asks
the frame directly — pose, settle, then **freeze the clock** (`render(n, 0)`, so wind, pools and
time of day cannot drift), switch one caster group's `castShadow` off, re-render, and read both the
triangle delta and the pixel difference.

The control matters: the same frame rendered twice with nothing touched is **0.00 %** different.
(My first run advanced the clock 1/30 s per step and every group "changed" 13–31 % of the frame —
that was wind, not shade. The frozen numbers below are the real ones.)

At `stairs2-base-follow` (p 2.648, 1.85, 3.529 → t 6.038, 1.6, 0.884, fov 46), 547 draws / 9.223 M,
38 visible casters under the trees group:

| caster group | meshes | depth triangles | pixels moved when it stops casting |
| --- | --- | --- | --- |
| family LODs (white-barks, columns, understory) | 18 | 366 K | 8.86 % |
| far foliage batches | 3 | 355 K | 7.61 % |
| **giant near bases** | 4 | **96 K** | **0.00 %** |
| giants' sector: plateau-oak + far-plateau + east + stair-bank | 1 | 97 K | 0.16 % |
| **family shadow proxies** | 5 | **90 K** | **0.00 %** |
| giants' sector: lantern-tree + north-west ×2 + north-east | 1 | 87 K | 20.93 % |
| **giants' sector: south + plaza-south + south-centre + south-west** | 1 | **86 K** | **0.00 %** |
| **column near bases** | 2 | **59 K** | **0.00 %** |
| sector canopy cards | 3 | 12 K | 8.97 % |

**331 K of depth triangles at this pose buy nothing.** For contrast, the lantern-tree sector's 87 K
buys a fifth of the frame: these are not interchangeable rows, and the shadow pass is not fat by
default — it is fat in four specific places.

## 2. What changed

Two of the four are this lane's, and both reuse a mechanism already in the file.

**The sectors' per-giant groups now cull in the depth pass too.** Round 52 split each sector mesh
into one geometry group per giant so the colour pass could skip a giant standing behind the camera,
with a note that the shadow pass draws them all "because three never calls `onBeforeRender` from
it". This three does have `onBeforeShadow` / `onAfterShadow`, called per group exactly like the
colour hooks, so the same count-0 trick now runs in the depth pass, testing each group's padded
sphere with the existing `shadowReaches`. When no group in a sector casts, the mesh drops out
instead of issuing count-0 draws.

**The pooled near bases now have a shadow test at all.** The giants' and seated columns' near bases
were the last casters whose `castShadow` was armed at build and never narrowed. They now remember
what the build armed (`staticCasts`, so `quality.shadows` and a column's `casts` flag still bind)
and test their world sphere per frame like every other caster.

Why this cannot move a pixel: `shadowReaches` returns false only when the padded sphere **and**
that sphere swept along the sun to `SHADOW_FLOOR_Y` are both outside the same frustum plane. A
half-space is convex, so the whole swept capsule is outside that plane, and a shadow volume that
never enters the view frustum cannot darken a visible pixel.

## 3. What it is worth — same poses, before and after

`pose-counts.mjs`, 960×540, the six fixed views plus the foot pose, on the commit before and the
commit after. **Draw calls identical in every view.**

| pose | before | after | delta |
| --- | --- | --- | --- |
| A_stairs | 575 / 8 635 674 | 575 / 8 635 674 | 0 |
| B_house | 557 / 7 953 597 | 557 / 7 909 298 | **−44 299** |
| C_lookback | 494 / 7 725 150 | 494 / 7 685 827 | **−39 323** |
| D_log | 484 / 8 367 788 | 484 / 8 279 584 | **−88 204** |
| E_ground | 557 / 7 953 597 | 557 / 7 909 298 | **−44 299** |
| F_canopy | 516 / 7 840 487 | 516 / 7 840 487 | 0 |
| stairs2-base-follow | 547 / 9 222 633 | 547 / 9 178 334 | **−44 299** |

**And the frames are byte-identical.** The foot pose rendered from both builds with the clock frozen
has the same md5 (`401ba6e3f45ecc369a57b9bdbcb102ff`), so the 44 299 triangles it stopped drawing
were worth exactly nothing on screen — which is the whole claim, measured rather than argued. The
same md5 also belongs to the control frame from §1's experiment, rendered in a different process
from a different build, so the frozen-clock frame is reproducible and the identity is not one run's
luck.

`foot-casters.jpg` shows what the difference between an idle and a working caster looks like: the
baseline, the south sector not casting (−86 K, mean 80.1 / 74.9 / 76.8 — the same numbers as the
baseline to the decimal) and the lantern-tree sector not casting (−87 K, mean 84.9 / 76.9 / 82.3 —
the stairs and the bank visibly lose their shade).

Hero D — the biggest saving — is byte-identical as well: md5 `8aa95606b19b15db512ae17ad341fe14` on
both builds with 88 204 fewer triangles after.

What each frame actually culled (`submission.giantGroupsCasting` / `giantGroupsTotal` /
`nearBolesCasting`, read at the same poses):

| pose | sector groups casting | near bases casting | triangles saved |
| --- | --- | --- | --- |
| stairs2-base-follow | 12 of 14 | 5 of 6 shown | 44 299 |
| D_log | 10 of 14 | 4 | 88 204 |
| A_stairs | 14 of 14 | 4 | 0 |

So the per-giant group test does most of the work (two groups idle at the foot, four at D) and the
near bases add one at the foot. A keeps every group — the giants behind that camera really do throw
their shade into its frame, so round 52's colour-pass result does not carry over to the depth pass —
and F looks up into the canopy where these casters are out of the pool.

## 4. Round two: the sweep ends at the ground, and the capsule is walked

§1 said 331 K is idle at the foot and the per-group cull collected 44 K. Two things kept the rest
out of reach, and both are now fixed.

**The sweep ran 20 m under the world.** `SHADOW_FLOOR_Y = -20` is the lowest y a receiver may have,
and every capsule was swept to it. The world's floor is **-9.6 m** (measured on a 181 × 181 grid
over ±250 m: the gorge at (0, 39); highest ground +41.8 m), and a caster's own ground is usually
1–26 m, so the capsule ran tens of metres past anything its caster could shade — a near base on the
plaza was swept 43 m where 8 m reaches its own ground. `shadowReachesGround` now marches the swept
sphere down-sun and ends the sweep once the sphere is wholly at or below the ground it passes over,
because past that point *that ground* is what blocks the light. Six steps, `liveTerrain.height` per
step. Coarse sampling can only move where the sweep ends, never end it before the ground blocks it,
so the capsule stays a bound on the real shadow volume. `SHADOW_FLOOR_Y` stays -20 as the outer
bound: the grid could miss a narrow trench, and the march makes the constant nearly irrelevant.

**The plane test could only see capsules outside one plane.** A capsule that slips past a frustum
*corner* — the usual case for a caster beside the frame, since the sweep runs diagonally — is
outside none of the six planes. So the capsule is now walked as well: spheres of radius r + step/2
spaced `step` apart contain it, and when none of them meets the frustum neither can the shadow
volume. Two to four sphere tests per caster, cheaper than the plane loop that precedes it.

Seven poses, clock frozen, one load per build (`/opt/cursor/artifacts/squad2-shadow-sweep.log`):

| pose | per-group cull only | + ground sweep | + capsule cover | total | frame |
| --- | --- | --- | --- | --- | --- |
| A_stairs | 575 / 8 635 674 | 575 / 8 634 966 | 575 / 8 631 286 | −4 388 | identical |
| B_house | 557 / 7 909 298 | 557 / 7 907 882 | 557 / 7 907 882 | −1 416 | identical |
| C_lookback | 494 / 7 685 827 | 494 / 7 684 675 | 494 / 7 684 675 | −1 152 | identical |
| D_log | 484 / 8 279 584 | 482 / 8 248 580 | 482 / 8 246 740 | **−32 844** | identical |
| E_ground | 557 / 7 909 298 | 557 / 7 907 882 | 557 / 7 907 882 | −1 416 | identical |
| F_canopy | 516 / 7 840 487 | 515 / 7 836 917 | 515 / 7 836 917 | −3 570 | identical |
| foot | 546 / 9 178 166 | 544 / 9 129 709 | 544 / 9 129 709 | **−48 457** | identical |

All seven md5s are the same in all three builds. The ground sweep does the work (48 K at the foot,
31 K at D, and two draws at each); the capsule cover adds 3.7 K at A and 1.8 K at D.

In play mode, against the same `playtest.mjs --only perf` harness before this branch touched the
depth pass:

| spot | before | now | delta |
| --- | --- | --- | --- |
| plaza | 539 / 7 689 651 | 539 / 7 639 357 | −50 294 |
| **stairs2-base (the foot)** | 557 / 9 243 897 | 555 / **9 151 141** | **−92 756** |
| saria-side | 520 / 8 601 339 | 519 / 8 512 887 | −88 452 |
| west-house | 430 / 5 090 910 | 426 / 4 902 532 | −188 378 |

## 5. What is left is not geometry's to cull

The foot is still 0.15 M over W38's 9.0 M line, and the experiment in §1 still says more of its
shade is idle. That residue is a different kind of thing, and it is worth writing down so nobody
hunts it with geometry again: **those casters are inside the frame.** The four giant near bases that
moved 0.00 % of pixels stand in view at the top of the stairs; any capsule test passes trivially for
them, because the capsule starts at the caster and the caster is visible. Their shade moves nothing
because it lands on ground that is *already* in shade — under the canopy, behind other trunks. That
is a radiometric coincidence, not a geometric fact, and the only way to exploit it is to ask the
depth buffer at run time, which is a different (and fragile) kind of change.

So the geometric levers here are now spent: caster outside the frame with its shade outside the
frame is culled at the mesh, the group, the instance and the lobe. What remains at the foot is
visible casters and the vegetation row that the owner's `veg=0.96` decision would settle.

## Files

- `depthprobe.mjs` — the frozen-clock caster experiment; `<dist> <poses.json> <out.json>`.
- `foot-pose.json` — the flight's-foot follow pose used throughout.
- `counts-before.json` / `counts-after.json` — the seven-pose table in §3.
- `depthfoot.json` — the per-group table in §1 with each group's mesh names.
- `frames/` — the baseline, the control and one frame per caster group switched off.

## 6. What the foot's trees row is actually made of

With the geometric culls in (§4) the flight's foot reads 545 draws / 9.130 M, of which the trees are
3.18 M. The per-family submission tally there (`submission.byFamily`, colour + depth, frozen clock):

| row | calls | triangles |
| --- | --- | --- |
| giant far-foliage batches | 6 | 779 592 |
| **giant near-canopy batch** | **1** | **675 673** |
| columns, high rung (7 trees) | 14 | 550 078 |
| giants' wood (3 sectors) | 6 | 541 250 |
| giants' authored leaves | 3 | 286 692 |
| giant near bases (4) | 3 | 95 761 |
| column near bases (2) | 3 | 92 017 |
| columns, medium rung | 5 | 53 190 |
| white-barks, medium rung | 4 | 31 167 |
| giants' cards | 6 | 23 236 |
| mid layer, near rung (36 instances) | 5 | 18 945 |
| white-barks, low rung | 5 | 15 595 |
| mid layer, far rung (53) | 5 | 10 513 |
| distant ring, far rung (210) | 6 | 5 040 |
| column near-canopy batch | 1 | 4 864 |
| giants' authored cards | 2 | 1 972 |

Two things follow.

**fable-4's third look call is sized.** The near-canopy batch is 0.68 M in a single draw at the foot,
with the tier's window `inM 26 / outM 30`. That is the row a slot cap "beyond 20 m from the crowd"
would cut, and at the foot it is nearly five times the 0.25 M he estimated at the look-backs. It is
still a look call: a part 26–30 m away subtends a large angle, so dropping it is visible, and what
replaces it is its far-foliage form rather than a hole.

**There is no free colour-pass cull left here.** The near-canopy batch is a `BatchedMesh` with
`perObjectFrustumCulled = true`, so its parts are already culled individually; the distant and mid
layers are 34 K between them; the families' rungs are at the gates round 53/54 priced against W38.
The rows that remain are in-frame detail at the range the owner asked for it. Closing the foot's last
0.13 M is a look decision (the vegetation row, 3.3 M there, or this near-canopy tier), not another
geometric trim.

## 7. The same culls at the walk and look-up poses — where they pay most

The fixed views are the budget's gate, but the player is not standing in them, and a cull that keys
on the camera has to be checked where the camera actually goes. These are this lane's own walk poses
(`walk-poses.json`) plus the two look-up poses (`look-up-poses.json`) — six cameras that had never
been measured against the depth work — rendered with the clock frozen on `a9308730` (the branch
before any of it) and on the branch head:

| pose | before | after | triangles | draws | sector groups casting | near bases casting | frame |
| --- | --- | --- | --- | --- | --- | --- | --- |
| plaza-west | 485 / 6 224 678 | 484 / 6 049 665 | **−175 013** | −1 | 7 of 14 | 3 | identical |
| plaza-east | 440 / 9 635 502 | 434 / 9 556 777 | **−78 725** | −6 | 14 of 14 | 6 | identical |
| plaza-south | 397 / 6 227 228 | 397 / 6 114 234 | **−112 994** | 0 | 8 of 14 | 5 | identical |
| clearing-north | 468 / 5 765 970 | 462 / 5 572 935 | **−193 035** | −6 | 2 of 14 | 2 | identical |
| up-open-north | 246 / 3 683 298 | 241 / 3 519 960 | **−163 338** | −5 | 2 of 14 | 3 | identical |
| owner-0650-north | 457 / 8 624 308 | 457 / 8 504 699 | **−119 609** | 0 | 8 of 14 | 6 | identical |

**Every frame is byte-identical** (md5 per pose in `walk-before.json` / `walk-after.json`), and the
six poses shed 0.84 M triangles between them — 79–193 K each, two to four times what the fixed views
gave. The reason is in the "groups casting" column: from the plaza's middle every giant throws shade
into the frame (14 of 14 at plaza-east), but a few steps out most of them stop (2 of 14 at
clearing-north and at the north look-up), and that is exactly where the walkable build was over the
W38 envelope before fable-4's sweep. Play mode is where this work pays.

The two look-up poses are the ones I most wanted to see: the frustum points at sky, so a shadow test
that was too eager would drop shade that still lands on the ground in the lower frame. They are
identical, at 163 K and 2-of-14 groups — the test is tight without being wrong.

`clearing-north.jpg` is the after frame at the biggest saving, for the record: 462 draws, 5.57 M,
twelve of fourteen giant groups not casting, and not a pixel different from the 5.77 M version.

### And under a moving camera

A frozen frame cannot show a flicker, and these culls are recomputed every time the view-projection
changes, so the branch also went through `playtest.mjs --only look,walk` (`behaviour-look-walk.json`):

- **11 walk routes, every one reached, 0 stuck** — `plaza-to-upper-house` 6/6, `north-clearing-ledge`
  15/15, `south-bridge-to-log` 21/21, `north-grove` 28/28, and the other seven complete.
- **10 look spots, 0 flagged.**
- **No page errors.**

That is the behaviour side of the same claim: the shade decisions change as the camera moves, and
nothing in the walk or look scenarios notices.

## 8. What the culls cost in CPU — and why the answer is "below the noise"

The culls add per-frame work: up to six `liveTerrain.height` samples to end each sweep, and two to
four sphere tests to walk each capsule, for every caster whose shadow decision is a sphere. That work
runs whenever the view-projection changes, i.e. every frame the player moves, so it is worth knowing
before shipping.

`cullcost.mjs` samples `perf().systems.trees` — the trees system's own per-frame update time — at a
320×180 viewport (the cull's work is resolution-independent, the rasteriser's is not), first with the
camera still (where `cull()` early-returns on an unchanged view-projection) and then turning 0.4° a
frame for 70 frames. Two samples of each build, run as a pair so both share the same machine load:

| sample | still p50 / mean | moving p50 / mean / p95 |
| --- | --- | --- |
| before the culls (a9308730), run 1 | 4.5 / 4.21 | 5.5 / 5.45 / 8.7 |
| before the culls, run 2 | 0.9 / 1.13 | 1.1 / 2.82 / 8.2 |
| with the culls, run 1 | 4.7 / 4.66 | 2.0 / 3.10 / 7.9 |
| with the culls + the short-circuit, run 1 | 4.5 / 5.06 | 1.8 / 3.36 / 7.3 |

**The same build measured twice differs more than the builds differ** (before: moving p50 5.5 then
1.1), so this instrument cannot resolve the question on this VM. What it does show is that there is
no sign of a systematic increase: the two "with the culls" samples sit inside the range the two
"before" samples span, and every p95 is 7.3–8.7 ms. The honest statement is **no measurable CPU cost,
with a noise floor of a few milliseconds** — and my first reading of the pair (5.5 → 2.0, "the culls
made it faster") was that same noise, not a saving.

One free reduction went in while measuring it: `shadowReachesGround` now returns true immediately
when the caster's own padded sphere meets the frustum. The capsule starts at that sphere, so the
answer cannot be anything else, and the march and the walk are now only ever paid for casters that
are off screen. Provably equivalent, and the foot pose renders the same md5 as it did before the
culls and after them (`401ba6e3f45ecc369a57b9bdbcb102ff` in this harness).

**A harness note for anyone comparing frames:** the foot pose reads 545 draws / 9 129 877 when a run
goes straight to it, and 544 / 9 129 709 when the run visits A–F first — a pooled near part resident
or not, worth 168 triangles. The same code produces both, so compare before against after *within*
one harness, which every table here does.

## 9. The two look-backs — the game's worst views, and the one gate the culls close there

`lookbacks/` measured these long ago as the worst frames in the game (25 % over the triangle ceiling) and
they were never re-measured against this work. `frozen.mjs` on `lookbacks/poses.json`, `a9308730` against
the head, **all three md5-identical**:

| pose | before | after | triangles | draws | sector groups casting | near bases casting |
| --- | --- | --- | --- | --- | --- | --- |
| plateau-north | 456 / 6 293 690 | 456 / 6 246 699 | **−46 991** | 0 | 6 of 14 | 3 |
| **plateau-back** | **707** / 10 950 726 | **702** / 10 895 532 | **−55 194** | **−5** | 14 of 14 | 4 |
| ledge-look-south | 635 / 11 049 685 | 635 / 11 046 057 | −3 628 | 0 | 14 of 14 | 0 |

**The plateau look-back crosses back under W38's draw limit**: 707 → 702 against a ceiling of 700. That is
the one gate this work closes at that view; its triangles stay at 10.9 M, 21 % over the 9 M line, which is
the overage fable-4 and fable-5 both sized as needing a look call (vegetation is 59 % of it, trees 8 %).

The spread across the three is the same story the walk poses told. `plateau-north` looks out over the
forest with most giants behind the camera — 6 of 14 groups cast, and it gives 47 K. `plateau-back` looks
*into* the plaza, so every giant's shade lands in frame (14 of 14) and the saving is the near bases and the
batches. `ledge-look-south` stands 75 m north where the near-canopy tier shows only 3 parts and no near
base is active, so there is almost nothing of this lane's to cull: 3.6 K.

One number worth passing to whoever holds the near-canopy decision: at `plateau-back` **34 in-frame parts
are starved of a slot**, the nearest 14 m from the camera — the largest starvation measured anywhere, and
the same shape as `slots/`.
