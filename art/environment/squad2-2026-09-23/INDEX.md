# Lane 2's evidence, indexed

`README.md` in this directory is the mid-canopy round's write-up, not a map (it now opens with a pointer here). This is the map: 38
measurement directories and 23 tools, with the headline of each, so another lane can find a number
without opening all of them. Newest first within each group.

**Where the lane stands on 2026-09-28** (branch `cursor/squad2-treephases-682b`, PR #210). Three things.
Two are pixel-identical: the sun's depth pass no longer pays for shade the frame cannot see (79–193 K a
pose in play, up to 121 K at a fixed view), and the near-LOD builder is cheaper to run (**−14 % in time,
−20 % in garbage**, a whole build **−18 % / −21 %** at median and p95 — `chunks/`). The third is a
measured trade inside the lane's budget: the distant crowns were being **drawn twice** (three's two-pass
rule for `transparent` + `DoubleSide`), so **A_stairs is 575 → 559 draws and plateau-back 702 → 687** for
SSIM 0.9975–0.9994 (`outlook/` §5). The table below is the head **before** that last change:

| | draws / triangles |
| --- | --- |
| A_stairs (the binding view) | 575 / 8.63 M — 0.37 M under W38 |
| B_house / C_lookback / D_log | 557 / 7.91 M · 494 / 7.68 M · 482 / 8.25 M |
| E_ground / F_canopy | 557 / 7.91 M · 515 / 7.84 M |
| play: plaza / **flight's foot** | 539 / 7.64 M · 555 / **9.151 M** (0.151 M over) |
| play: saria-side / west-house | 519 / 8.51 M · 426 / 4.90 M |

All six fixed views are inside the envelope, no page errors, and the play-mode numbers reproduced to
the digit across two runs hours apart. On top of that the near-LOD **builder** is now 14 % cheaper with
a whole build's p95 down 26 % (`chunks/`), every frame still md5-identical. The lane's own levers are measured out: the crown-veil ask is
met (far-centre box s 0.06 / l 0.466 against the owner's 0.05 / 0.474), the LOD rungs are bracketed
from both sides, and the near-canopy tier is priced in both directions and left alone. What remains at
the foot is the vegetation row and an owner call.

## Cost and budget

| where | the headline |
| --- | --- |
| `sceneshade/` | **Every system's shade, priced (a handoff).** The same probe widened to the whole scene: the trees' shade is **55–59 % of the pixels** at camera A and the foot, while **structures spend 719 K for 0.49 % / 0.52 %**, terrain 317 K for 0.08 %, and vegetation 304 K for 0.02 % at A. At A those three are **1.34 M of an 8.63 M frame** for under 0.6 % of pixels, against 0.37 M of W38 headroom. No code changed — the mechanism (`shadowReachesGround`) is offered to whoever owns them. |
| `chunks/` | **Four rounds on the near-LOD builder, ending in a clear answer.** The frame-budget tail is the **collector** (a chunk a collection lands in reads a median 1.08 ms against 0.05), so the work went to allocation: `allocprof.mjs` names the allocators by function (with `includeObjectsCollectedBy{Major,Minor}GC`, or the profile reports 0.23 MB of an actual 4.3 GB) and `pathgarbage.mjs` settles each on its own path. **`growthPath` 86.6 → 5.0 KB a call (−94 %)** — three's `getSpacedPoints` re-derives a 201-sample table per call and its `CubicPoly` keeps coefficients in closure variables, which V8 boxes. Worth: the pool's builds **−20 % garbage**, tree creation **−15 %**, and on the walk **a whole build −18 % at the median, −21 % at the p95**. Not worth: the world build (8395 → 8367 ms against a 700 ms spread) and the frame budget — the worst chunk in a frame reads 6.9–16.1 ms across six runs of code that cannot make a 7 ms chunk, because that tail is a pause sized by the **whole page's** allocation. Everything bit-identical (`bitcheck.mjs`: 75 geometries, 741 103 triangles, one hash; seven poses md5-identical). Its four rounds are §§1–8 of `chunks/README.md`, in order, including the three experiments that were measured and reverted. |
| `outlook/` | **Which tree family the look-backs pay for — and the third draw call nobody had noticed.** §5: every distant and mid mesh cost **three draws for two material groups**, because three renders `transparent` + `DoubleSide` twice unless `forceSinglePass` is set (it appears nowhere else in the repo). One line on the crown material: **A_stairs 575 → 559 draws, plateau-back 702 → 687, F_canopy 515 → 500**, for 0.09–0.58 % of pixels at SSIM 0.9975–0.9994 — measured against itself in one page load with the flag toggled at runtime. The same line is available to `mist.ts`, `fairy.ts`, the expansions' haze and pool, `structures/materials.ts`, props' AO decals and `dekuStick.ts`. §§1–3: **which tree family the look-backs actually pay for, in the drawn frame.** `familycost.mjs` hides one family at a time with the clock frozen and reads the triangle delta and the pixels that moved (control 0.00 %). At plateau-back: giants 1.18 M / 44 draws for 35 % of the pixels, columns 0.50 M / 14, white-barks 0.17 M / 16, and **the near bases 0 / 0** — per-object culling already does that job. The finding is this lane's: **the mid layer and the distant ring spend 45–51 draws, a third of the trees' 135, to draw 1.3 % of their triangles** (400–1500 triangles a call against every other family's 15–40 K), because `distant.ts` splits each layer into sector meshes with two material groups each. `--shadow` found **zero casters** in either family, so it is all colour pass. At plateau-north the ring draws 21 calls for **0.00 % of the pixels** — occlusion, which no distance rule sees. Also: the white-barks' shade is free to drop at both poses (0.00 %, −40 224 / −3 draws), a note for fable-4. |
| `depthfoot/` | **The sun's depth pass, by caster.** At the flight's foot 331 K of depth triangles move **zero pixels** (giant near bases 96 K, family shadow proxies 90 K, the south sector 86 K, column near bases 59 K) while the lantern-tree sector's 87 K moves 20.93 %. The four culls that followed take 79–193 K a pose in play and up to 121 K at a fixed view with **byte-identical frames**; §6 has the foot's per-family tally, §7 the walk-pose validation, §8 the CPU answer (below the noise). |
| `slots/` | **The near-canopy tier, priced both ways.** It is saturated at 79 parts and **77–100 % of them are outside the frame**; at camera A 21 in-frame parts hold no slot. Aiming the slots at the frame gives 19 more near crowns for **+189 697 triangles and 0.46 % of the frame**; tightening the band 40 % moves **0.00 %** and saves only 4–37 K. A slot cap on this tier buys memory and CPU, not drawn cost. |
| `loadmap/` | **Where the world build goes.** The giants phase splits into `createGiantTree` 1.70 s, the far-crown atlas 1.83 s, `placeMidTrees` 0.49 s, sector foliage 0.33 s, pools 0.14 s, to-world 0.12 s, merge 0.08 s. Across the whole 42.5 s build, **canvas-to-pixels is 6.27 s (14.8 %)** — a SwiftShader cost, not a player's. |
| `settle/` | **What a pose takes to settle.** The trees' own submission is final on frame 1 (the pools' capture contract holds); the frame-16 change at the foot is the **clock**, not a warm-up — frozen it is one value for 20 frames. Compare within one harness, settle with time and read with the clock frozen. |
| `sweep2/` | The branch head's own check: six fixed views **all inside W38** (A binding at 575 / 8.63 M, 0.37 M spare), play mode plaza 7.64 M / foot **9.151 M** / saria-side 8.51 M / west-house 4.90 M, no page errors — and identical to a run hours earlier, so the play harness is reproducible on one build. |
| `sweep/` | "Check everything" on head `e438c6e5`: all six fixed views inside W38 (A the binding one at **614 draws / 8.97 M**, 30 K of headroom), 11 walk routes with 0 stuck, 10 look spots unflagged, no page errors; play mode still **9.59 M at the flight's foot**. |
| `shadowcost/` | The sun's depth pass is **32 % of hero A's triangles** (174 draws / 2.91 M). `DEPTH-SPLIT.md`: of it, trees 19 %, vegetation 10 %, **the solid world 71 %** — and the grass barely casts (thinning it removes 1.46 M of colour and 0.30 M of depth). The giants' wood contributes **zero**. |
| `giantwood/` | The giants' mesh family draws **1.36 M at hero A, flat with distance** (72 draws). `BY-TREE.md`: it is **18 % wood / 53 % leaves / 29 % foldable far foliage**, and every giant's relief bole is 0. `CORRECTION.md` withdraws the trunk-arc proposal — `heroDistance` already gates it twice. |
| `lookbacks/` | (Re-measured 09-28 against the depth culls in `depthfoot/` §9: **plateau-back 707 → 702 draws** (corrected 09-28: that is still **two over** W38's 700, not under it), −55 K triangles; plateau-north −47 K; ledge-look-south −3.6 K; all three frames md5-identical.) The two views a climbing player gets are 25 % over the triangle ceiling: plateau look-back **745 draws / 11.15 M**, ledge look-back 673 / 11.23 M. Vegetation is 59 % of the overage, trees 8 %. |
| `playcost/` | Play mode at the main flight's foot is **611 draws / 9.60 M** (now 585 / 9.59 M), over the 9.0 M line; vegetation +1.0 M against hero A, trees −0.2 M. |
| `lodcheck/` | The LOD rungs' pop measured against `?treelod=10`; `TREE_LOD_NEAR_M` 32 m and `DISTANT_NEAR_M` 45 m are what the budget pays for. |
| `play/` | The pool's behaviour on the owner's walks (residency, prefetch). |

## Look

| where | the headline |
| --- | --- |
| `roofsky/` | Backlog item 4: the dark flat mass overhead in the open north was the **canopy roof's underside** (98.5 % of its pixels under level 30). `ROOF_SKY_THROUGH` lights it with the sky the layer transmits; the roof's own render goes 12.8 → 23.1 mean with local detail 2.90 → 4.66, and **all five distinct fixed frames are byte-identical**. |
| `uplooks/` | Looking up under the log arch, at the bridge mid-span and on the grove shelf: local detail 5.71–6.39, no bald patch — the overhead complaint narrows to the one view already fixed. |
| `bearings/` | The middle distance populates east, west and south too (band sd 15–23, no haze wash), so the north was not a special case. |
| `clearing/` | Backlog item 2: after the steps there is a signposted, lit trail to the grove hamlet; the ledge top is 84.6 % crown and trunk in its top band. |
| `crowntone/`, `softedge/`, `lookup/`, `treepop/`, `upring/`, `roofhole/`, `roofcover/`, `headcheck/`, `northgrove/` | The crown veil's rounds: the ray-climb gate, the floor-card fade, the roof's hero-top keep and the stand bands that closed the north, south and grove voids. |
| `fake/`, `brownwood/` | "The trees show the brown": tree wood is 2.2–2.4 % of the frame; the brown is the columns' boles and the giants' trunks (fable-4's attribution agrees). |
| `backlog3/`, `farhut/` | Backlog item 3 measured: the west house's wall 0.199 and the far hut's 0.075 against 0.502–0.537 on the reference huts — structures' near-field bounce, not trees. |
| `tiers/` | **The weak-device tiers, checked for the first time.** At `quality=low` the north pose keeps its structure (across-column sd 29.63 against high's 28.93) and its crown tone lands on the owner's reference (l 0.478 vs his 0.474) — no haze wash, no hole, leaf coverage 20.9 → 15.4 % as designed. On `?pool=small` the capture contract holds (79 slots shown, `pinnedPending` 0) but the 64 MiB pool sits at 63 MiB and a re-pose costs **113 synchronous builds against 63 on the default tier** — ~50 frame hitches on the weakest device. A walk on that tier does **no** synchronous builds at all (63 before and after 600 frames, `pinnedPending` 0 throughout; the chunked builder runs 6.5–6.9 ms P95 with 4 % of frames over its 3 ms budget). Correction the next day: the teleport cost is **not** prefetch thrash — tightening the prefetch to 28 m changes `syncBuilds` not at all (113 → 113). The builds are the **reset path's** capture contract (`pin` builds inline), so they cost ~50 builds ≈ 0.5 s **at a teleport** and nothing while walking. (§2e's open question is answered in `chunks/`: the builder's overrun is not the estimator, not the progress guarantee and not the chunk size — chunks of 4–7 ms remain in the near-canopy geometry generators, and an inline build itself is 26 % cheaper now.) |
| `roofup/` | **The roof from the middle of the plaza, straight up** — the view the player stands in and the one the earlier roof rounds never took. Layered crowns with real gaps: leaf coverage 47–61 % per strip, mist through the gaps 6–25 %, no flat lid and no bald patch. The one jarring element, a cluster of oversized glossy leaves overhead, is **structures' climbing foliage** (it survives hiding the trees and the vegetation and vanishes with structures) — the third not-a-tree this week. |
| `bandcheck/` | **The lane's oldest review note, measured as met.** At the owner's 06:50 north pose the 14–58 m crowns read **s 0.06 / l 0.466** against his s 0.05 / l 0.474 (they were 0.15 / 0.29), and the top strips 0.346–0.384 against his 0.394; the band's remaining gap is its bottom third — ground cover, not the middle distance. Both levers left (lighten the understory, pull the medium rung in) move *away* from his numbers. |
| `arrival/` | "Trees load in ASAP" on screen: **0.02 % of pixels** arrive late with the clock frozen, and the 10 % that moves with the clock running is the wind, not geometry. |

## Reviews

| where | the headline |
| --- | --- |
| `reviews/pr30-persistent-fold-audit.md` | PR #30's claim is right but the head already carries the fix (`b6452e22`); close rather than merge. Also flags my own superseded #36 and #41. |

## Tools (all take `<dist>` and write JSON beside their output)

| tool | what it answers |
| --- | --- |
| `playcost.mjs` | Who owns the triangles at a pose — `__ZR__.isolate` per top-level system, for broll poses or `{"viewpoint": "A_stairs"}`. |
| `treeaudit.mjs` | The trees system's own audit at a pose, including `submission.byFamily` and `giantWoodByTree`. |
| `isolateshots.mjs` | One saved frame per system — **but see the method note below: `isolate()` cannot be screenshotted.** Use it for counts and attribute pixels by hiding meshes yourself. |
| `depthfoot/depthprobe.mjs` | Which casters the sun's depth pass pays for at a pose, and whether each one's shade is in the frame at all (frozen clock, one group switched off at a time). |
| `depthfoot/cullcost.mjs` | The trees system's own per-frame CPU while the camera turns, at a small viewport so the cull's cost is not buried in rasterisation. |
| `frozen.mjs` | **The harness behind every "byte-identical" claim here.** Renders a pose list (and/or fixed viewpoints) with the world clock frozen and writes draws, triangles, the trees' own submission, the casting counters and an md5 per frame. Settles *with* time so the pools swap in, then reads with `render(2, 0)`. Verified to reproduce this branch's numbers: A_stairs 575 / 8 631 286 at md5 `a280badd…`, the same bytes as the run behind the PR's table. |
| `tiers/walkpool.mjs` | The pools as a WALKING player meets them: drives play mode (masking `navigator.webdriver`, or the hook never installs), holds a key for 600 sim frames and reads the pool every 60. `--dist` / `--out` walk two builds in one session. |
| `chunkcost.mjs` | Every chunk of every pooled part's build, timed, **with no browser** — the unit tests' in-memory TS loader on the real generators. `--repeat 5` takes a median per chunk (one build times the JIT as if it were a chunk). Its limit: its synthetic trees' largest geometry chunk is 1.74 ms, so it cannot see the authored plaza giants' 4–7 ms lobe chunks. |
| `sceneshade/scenedepth.mjs` | Every system's shade at a pose: switch one system's casters off at a time and read the triangle delta and the pixel difference. |
| `sixcheck.mjs` | What a change did to the fixed frames: pixels moved, mean, local detail, and SSIM against `reference/frames`. |
| `walkpop.mjs` | What arrives late on screen (renders at `dt = 0`, so the wind cannot be mistaken for geometry). |
| `band.mjs` | Is the middle distance trees or haze (band mean and across-column sd). |
| `diffmap.mjs` | What changed and where, between two frames. |
| `compare.mjs` | Labelled side-by-side sheets. |
| `cutout.mjs` (in `lookup/`) | Boundary hardness and lace density — flat cards versus foliage. |
| `skyline.mjs` | Skyline statistics (is the tree line uniform). |
| `barkshare.mjs` | The brown share of a band by hue/saturation/lightness rule. |
| `canopy-walk.mjs` | The canopy's read along a walk. |

## Standing method notes

* Compare only runs with the **same shots order** (`frozen.mjs` prints the md5 so a mismatch is visible;
  the flight's foot differs by one draw and 168 triangles depending on whether A–F were visited first): pool residency carries over between poses inside one
  `broll` run (a fresh-run A against an A captured third showed a spurious 19.5 % of pixels moved).
* Render at `dt = 0` when the question is geometry: with the clock running, wind moves 10 % of a frame.
* `isolate()` bypasses the composer, so its frames carry no post pass — its numbers are the material's
  own output, not the finished image.
* `?shadow=0` prices the whole depth pass; `?veg=<lodScale>,<grassDensity>` prices the ground cover;
  `?treelod=<near>,<mid>,<distant>,<canopy band>` prices every tree LOD gate and the canopy swap band.
* **`__ZR__.isolate(system)` restores every child's visibility before it returns**, so a screenshot
  taken after it shows the FULL frame, not the isolated system (2026-09-27; it cost me an hour and a
  wrong attribution). Its counts are real — `playcost.mjs` is unaffected — but to attribute a *pixel*
  to a system you must hide the meshes yourself and shoot while they are hidden.
* A frame's counts depend on **how much sim time has elapsed**, not on pool residency: at the flight's
  foot a marginal caster leaves the depth pass 0.53 s in (frame 16 at `dt = 1/30`) because the sun
  creeps and its shadow target snaps a texel. Settle with time, then read with `render(2, 0)`.
