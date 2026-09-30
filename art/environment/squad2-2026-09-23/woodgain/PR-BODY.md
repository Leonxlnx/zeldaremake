Lane 2 — trees in the distance, the LOD rungs and pools, the canopy roof.

**This is a summary, condensed twice.** Every round's full write-up lives in
`art/environment/squad2-2026-09-23/`, mapped by that directory's `INDEX.md`, whose rows are now fuller than
anything that fits here — including all the corrections and the reverted experiments.

## What ships

| | change | measured |
| --- | --- | --- |
| 0 | **The white-bark shadow proxies were drawing in the colour pass, writing nothing** — a family whose material is `colorWrite: false, depthWrite: false`, submitted in colour because its padded aggregate sphere clips the frustum edge | at `stairs1-top`, the frame nearest W38's 700-draw line, **665 → 661 draws and −76 426 triangles, byte-identical pixels**; `plaza` 535 → 533, −55 574, md5 unchanged. The identical md5 is the safety proof too — had any shade gone with the draw, the pixels would have moved (`proxydraw/`) |
| 1 | **The distant and mid crowns were drawn twice** — `transparent` + `DoubleSide` needs `forceSinglePass`, absent from the whole repo | A_stairs **575 → 559 draws**, plateau-back 702 → 687, the owner's north pose 457 → 440, SSIM 0.9975–0.9994 (`outlook/`) |
| 2 | **Four depth-pass culls** — the sun stops paying for shade the frame cannot see | −79…−193 K a walk pose, up to −121 K at a fixed view, **every frame byte-identical** (`depthfoot/`) |
| 3 | **The near-LOD builder** — its budget overruns were collector pauses, not work | −14 % time, −20 % garbage, a whole build −18 % / −21 % at median and p95, every frame md5-identical (`chunks/`) |
| 4 | **The far-crown atlas painted a 128² stamp and blitted it at 16–64 px**, ~3 000 times | the atlas **2 008 → 1 268 ms (−37 %)** off the serial build the first frame waits on, **SSIM 1.00000** at six poses across both tiers (`atlascost/`, `lowtier/`) |
| 5 | **The mid-grove sampler ran its most expensive test first** — 46 µs against 0.4–3.8 µs, on all 11 850 candidates | **`tail-mid-place` 630 → 119 ms (−81 %)**, frames **byte-identical**: none of the six predicates draws from the sampler's randomness (`midplace/`) |
| 6 | **The pool's report gains `syncMsP95` / `syncMsMax`** — what a pin-forced finish puts into one frame | report-only; it found those finishes are the world **build**, not the frame (`poolpredict/`, `syncpath/`) |
| 7 | **The LOD rung swap is a fade, not a cut** — `TREE_LOD_DITHER = true` | below |
| 8 | **A band wider than the gap between the rung gates silently skips the far fade** | `bandOverlaps` + a hard-cut fallback with a `console.error` that B6 turns into a failed take (`bandwidth/LOWTIER.md`) |
| 9 | **The trees' own submission total was short by 27 draws and 196 K triangles** — understory, white-bark roots and five depth proxies missing from `byFamily`, whose sum *is* that total | fixed, plus **`unaccounted`**: the same tally walked from the scene graph with the names of what no family claimed. **Zero at twelve states** (`auditgap/`) |
| 10 | **The band's weight key was the same arithmetic written out twice** | one `lodWeightKey(level, count, index)`, injectivity and write/read agreement pinned by tests. A drift would have silently defaulted every banded tree to weight 1 — fade off, frame plausible |
| 11 | **The trees' audit reported a colour draw the renderer had stopped making** — `add()` counts a colour call from a frustum test and never knew about `MAIN_COUNT`, so it read 114 tree draws at a 661-draw frame | a main-pass count of 0 now means no colour call and no colour triangles, which is also the honest answer for an ordinary bucket whose whole submission is shadow-only that frame. Audit and renderer now agree on both the 4 draws and the 76 426 triangles (`proxydraw/`) |
| 12 | **The trees' audit disagreed with the renderer's own count for the same system by 36 draws and 820 K triangles** — three draws one call per visible material group in **both** passes; a `BatchedMesh` draws only the lobes `perObjectFrustumCulled` leaves; and `FarFoliageBatch`'s own `onBeforeShadow` builds the depth list from a different rule against the **shadow** camera | hero A **104 / 3 476 935 → 140 / 2 656 692** against the renderer's 140 / 2 656 488. **Draws now agree exactly at all three poses and `stairs1-top` agrees on the triangle — 147 / 3 549 346 both sides**; hero A is 204 triangles off in 2.66 M (0.008 %, one borderline sphere) and `stairs2-top` keeps 2.6 %. Report-only throughout: `stairs1-top` still renders at 661 / 9 799 283 / md5 `c2d51f15…` and the renderer's own column is identical across every run (`auditvsrenderer/`) |
| 13 | **The canopy roof was seven draws for 8 210 triangles and frustum culling never dropped one** — `roof.ts` splits the cards into sectors *"for frustum culling"*, but a 60° wedge of a forest-wide roof has a sphere covering most of the world, so the test cannot fire from inside it | `isolate('canopy')` reads **7 calls / 8 210 triangles at hero A, `stairs1-top` and `stairs2-top` alike** — 1 173 triangles a draw, the thinnest ratio in the frame. Merged to one mesh from the same vertex data: **A_stairs 561 → 555 draws, `stairs1-top` 661 → 655, triangles identical, md5 byte-identical**. The tightest frame measured anywhere goes from 39 draws of headroom to **45**. The roof also gains its first per-frame figure, which agrees with the renderer exactly (`roofdraws/`) |
| 14 | *(**reverted** — the gate failed; preserved on `cursor/squad2-woodgain-682b`)* **one material for the distant and mid layers instead of two, −15…−17 draws** — and the reason it cannot ship is **`DISTANT_NEAR_GAIN`**: the geometry writes bark at **4×** the far tint so the bark map, tone bands and cords have albedo close up, and `mats.distant` divides the 4× back out where the `DISTANT_BARK_M` [22, 38] m blend is zero. One material meant nobody divided | the prize is confirmed at **all six** fixed views (A 555 → 539, B and E 537 → 521, C 474 → 459, D 462 → 445, F 495 → 480) with **not one triangle** either way. The pixels refuse it: 0.10–0.44 % of each frame moves, **54–89 % of it bark-hue, 1–6 % leaf**, and **43–59 % on a silhouette with the rest trunk interiors** at 4.6–7.4 levels. At 8× F_canopy's mid bole is warm modelled bark in the two-material build and **a flat grey-olive cylinder** in the one-material build — the regression rounds 44–47 of `mats.distant` were written to fix. Adding the division is **necessary** (C_lookback 0.36 % → **0.04 %** of the frame, its worst cell 12.9 % → 0.9 %) and **not sufficient** (F_canopy 0.44 % → 0.41 %), because inside the blend the gain is *kept* on purpose and the near bark treatment that consumes it lives in `materials.ts`. **Last round's two named candidates measure zero** — the wood's roughness and the ungated `injectTreeLeafWarmth` changed every md5 and not one aggregate at any of the six views. Reverted here, and the rebuilt bundle is **byte-identical** to the build whose frames this round measured (`woodgain/`) |
| — | *(measured, not shipped)* the giants' far foliage not casting, **−357 512 triangles at hero A** | the trees' **largest** single depth consumer, raised from 124 240 by row 12's fix, is 28 % of their shade and more than the whole 275 197 of W38 headroom on the binding view. Without it: hero A **8 724 803 → 8 367 291**, `stairs1-top` **9 799 283 → 9 347 687**, −3 draws each, the hero figure matching the corrected tally *to the triangle*. Headroom would have more than doubled to **632 709** — the largest triangle prize this lane has found. But **18.00 % / 12.46 % of those frames move**: it is the crowns' **interior** shading, and they flatten into one green mass without it (`farshade/`) |
| — | *(built and reverted)* the columns' and understory's out-of-view high rung casting from the medium twin, **−49 396 triangles** | round 53 gave the white-barks that twin and the condition was never widened; `column-lod0` submits **230 360 depth triangles against 160 934 in colour** at hero A, all of the difference out-of-view instances casting the full high rung. Widening it cost **7.65 % of the hero frame** — the dapple on the flagstones in front of Link is gone, because the medium rung is 11 875 triangles an instance against 26 822 and has too few leaf cards to lay it. **Reverted**; those 69 426 triangles are buying the dapple, not wasting it (`colshadow/`) |
| — | *(held, and the hold is now weaker)* batching the distant and mid layers, **~26 draws** | the third value this number has taken (26–30 → 12 → ~26). Row 12 found those layers are **32 colour draws over 16 meshes**, because each has a wood group and a foliage group and three draws one call per group — so last week's "12, the prize halved" was itself wrong. A `BatchedMesh` carries one material, so wood and foliage need separate batches: 32 → ~6. Still **not built**; 26 against 45 of headroom is a real prize and the call is the owner's (`batching/` §4) |

[before and after at stairs1-top, byte-identical](/opt/cursor/artifacts/proxy-draw-stairs1-top.png)

### The six-view gate on row 14, and the two ways forward it priced

<img alt="F_canopy's mid bole in three builds" src="/opt/cursor/artifacts/woodgain-F_canopy-three-way.jpg" />

Left, the shipped two-material build: warm modelled bark. Centre, one material: a flat grey-olive cylinder. Right, one material with `DISTANT_NEAR_GAIN`'s division restored: still flat, because that bole stands inside the 22–38 m blend where the gain is kept by design and the near bark treatment that consumes it — cylindrical bark map, patch tone bands, cord stripe, furrow darkening, shade floor — lives in `materials.ts` and not in the crown material.

The division is still the right code, and at the poses whose bark is beyond the blend it closes the change completely:

<img alt="C_lookback with the gain division" src="/opt/cursor/artifacts/woodgain-C_lookback-gain-closes.jpg" />

**Two ways to collect the 15–17 draws, both needing a decision this lane will not take alone.** (a) A distance-gated material swap, lane 2's files only: where a mesh's whole instance set is beyond 38 m use the single material with the division, otherwise keep the array and the full treatment. Both programs are already compiled, so the swap is a reference assignment; at the fixed views the distant family's placements are 43 m+ and qualify while the mid family does not, so the win is a fraction of the 15–17 and must be measured rather than predicted. (b) Extract the ~45 lines of `<color_fragment>` GLSL and its five uniforms out of `materials.ts` into a module both materials import, and pass the giants' bark colour map into `createDistantCrownMaterial` — the correct fix, the whole 15–17 draws at every pose including in play, and a refactor of another lane's 1 700-line hot file, so **it needs the trees-materials owner's yes**.

Method, for anyone repeating it: the same before build rendered in two separately launched pairs gave **byte-identical frames at all six views**, and in a third pair — during whose first minutes a `tsc` and a `vite build` of mine ran — every one of the six differed, while counts stayed identical to the triangle in all three. So **never build or run tests while a paired render is in flight**. New tool: `cellzoom.mjs` magnifies one `diffmap.mjs` cell of a pair side by side with that cell's own numbers.

## 7 — the one change that moves what a player sees

Built behind an inert flag and left for four named checks; all four pass (`gatesweep/`). The defect is real:
**one frame of a walked approach changes 44.70 % of a crown cell where every neighbouring frame changes
26 %** — a 1.71× spike the band takes to 1.32×, and 1.41× → 1.11× in the neighbouring cell, landing exactly
on the ongoing rate. Hard cut left, band right, at the real 30 fps:

[rung-swap-realtime.mp4](/opt/cursor/artifacts/rung-swap-realtime.mp4)

> the cut — *"a very obvious, abrupt one-frame change… the crown suddenly jumps from sparse foliage to a much
> denser, fuller canopy. It is a very clear and noticeable pop."* · the band — *"that sudden one-frame pop is
> absent. Instead, the additional foliage fades in gradually."*

**It does not crawl**, which is the one thing that could have made it worse than the cut. On a walked approach
the churn inside the pixels the mask covers is *lower* with the band at all eight steps; under a **turning**
camera — the only motion that can make a screen-space hash swim, since rotation changes no tree's distance —
it is lower at all 27 steps of a 13.5° pan, and an independent review found *"no crawling, fizzing, swimming,
or shimmering noise"* (`bandwalk/`, `ROTATION.md`). It does carry **a mild grain on the foliage while it
fades**, visible in motion and not in stills; that is the trade.

[rung-band-rotation.mp4](/opt/cursor/artifacts/rung-band-rotation.mp4)

**Cost:** +1 to +3 draws and +8 K to +98 K triangles at the hero views; two of the five distinct sealed frames
**byte-identical**, the other three moving 0.39–1.76 % of their pixels at >2/255. On the weak tier it is
*cheaper* (+4 draws / +33 766 triangles at `quality=low`) and moves the frame **toward** its reference.
**Reverting is one line** and `lodFade.test.mjs` passes either way.

## Three things a merger needs to know

**1. This lane published the opposite verdict on 09-26 and I did not find it.** PR #206 (*"so drop it"*) and
#198 (*"merge or close, but do not turn it on"*) live on `cursor/squad2-ditherverdict-682b`, so searching the
shared evidence directory found nothing — `gh pr list --state open` is two seconds and I skipped it. **#206 is
right about three things**, one about me: its correction of the proposal's 1.85 % came first, the
park-the-camera method I re-derived is prescribed in its `PART5`, and its cost figure is *not* superseded (its
2.33 % and my 0.600 % are the same change at different thresholds). **Its one error is a ratio**: *0.22 % of
the frame against 46 % from one walking step* divides a **concentrated** change by a **diffuse** one. A cell is
1.56 % of the frame, so 0.22 % packed into one crown is ≈ 14 % *of that cell*, against a measured 18.5-point
excess — the same event, ~60× apart purely by denominator. **#206, #198 and #204 are superseded and can be
closed; I have not closed them.** (`bandwalk/RECONCILING-206.md`)

**2. The band width's stated reason failed twice, and 2.5 m survives anyway.** `lodFade.ts` called it "the
ceiling the budget allows" against a 30 K headroom that is now 275 K, and #198 had measured a 12 m band as
*less* damaging. Five builds at 0 / 2.5 / 5 / 8 / 12 m say no to both: the cost **saturates** (5 → 8 m adds
only 16 K, and even 12 m leaves 94 K spare) and wider is **monotonically worse** against `reference/frames/`.
The comment now gives the right reason, and §8 gives the ceiling that does bind. (`bandwidth/`)

**3. This branch's CI reads `cancelled`, and that is a timeout.** `timeout-minutes: 45` with
`cancel-in-progress: false`, and the job ran **45 m 23 s** before GitHub killed `npm run capture`; runs that
fit have passed. The per-viewpoint reload is **not** an oversight — `capture.mjs` records that a single long
session was tried in takes 0132/0133 and abandoned, and I withdrew my proposal to remove it. The
recommendation is **raise `timeout-minutes`**, and separately ask whether the runner can have a real GPU.
`gauntlet/` and `.github/` are not this lane's files. (`lowtier/` §2–3)

## The head

| | draws / triangles | |
| --- | --- | --- |
| **A_stairs** | **555 / 8 724 803** | hero — **145 draws and 275 197 triangles under W38**; the triangle line binds |
| B_house · C_lookback · D_log | 543 / 7 971 464 · 480 / 7 721 403 · 468 / 8 258 565 | hero — pass |
| E_ground · F_canopy | 543 / 7 971 464 · 501 / 7 838 848 | not hero viewpoints |
| play: plaza · flight's foot · saria-side · west-house | 530 / 7 711 094 · 535 / 9 153 565 · 508 / 8 585 962 · 412 / 4 951 247 | not under W38 |
| `quality=low`: A_stairs · F_canopy | 499 / 6 474 944 · 449 / 5 493 128 | the weak tier, band on |
| southwest: plaza-edge · approach · under | 489 / 6 485 687 · 439 / 5 039 017 · 312 / 4 044 267 | not rubric views; `sw-under`'s trees row read 4 038 544 — an **audit** number from before row 12, so read it with that row |
| **the ten play look spots** | 387–**655** draws / 4.64–**11.84 M** | never rendered before this branch — see below (each 6 lower than first measured, by row 13) |

The draw rows above are from runs before row 13 except A_stairs and `stairs1-top`, which were re-measured;
every one is 6 lower now. Row 14's further 16 is **not** in them: its gate failed and it is reverted. `tsc --noEmit`, `vite build` and
**274 / 274** tests green; **`anti-cheat` green at 109 checks** with a capture in place, which had never run on
this branch before; **11 / 11 walk routes reached, 0 stuck, 0 page errors**; `bitcheck.mjs` still
`TOTAL 9fc119c64da990ab83caf7625ce98b6d`. (The "10 look spots unflagged" half of that line needs the caveat
below.)

**A scope correction that retires several earlier claims of mine.** W38's two checks resolve to **four
viewpoints, not six**, and W38 is the only rubric item that budgets draws or triangles at all. So E_ground,
F_canopy and every play pose are outside it: "the flight's foot is 0.151 M over W38" was out of scope, and
plateau-back's 702 → 687 draws were measured against a ceiling that never bound them.

## What this branch got wrong, and how each was caught

Sixteen experiments built and measured rather than shipped on a hunch, and **eleven** published claims withdrawn
after re-measurement. The four that matter most to a reader, because they are about the record rather than
about code:

- **The trees' own "N / M" row was wrong twice over, and the second was worse than the first.** It was
  *short* by 27 draws and 196 K triangles at hero A because `byFamily` was eleven hand-written loops and three
  things were never in them (`auditgap/`). It was also applying **the wrong rule** — one call per mesh where
  three makes one per visible material group, every visible lobe of a batch where three draws only the ones
  per-object culling leaves, and the colour set for a depth pass that this branch's own hook builds from a
  different rule — which read as 36 draws low and 820 K triangles high at the same pose (`auditvsrenderer/`).
  `unaccounted`, the fix I shipped for the first, **could not catch the second**: it walks the scene graph with
  the *same* `add()`, so it finds a forgotten family and never a wrong rule, and it read ZERO throughout. What
  catches a wrong rule is a total the code cannot assemble — the renderer's own `info.render`, which
  `isolate()` has exposed per system all along and nobody compared against.
  Whole-frame numbers and every W38 figure come from `stats()` and were never affected.
- **A defect I found in the southwest corner was my own camera lying 23 mm above the ground.** Its first
  candidate — a crown card drawn too close, a LOD-gate failure — was rejected by its own number (`mid-near`
  is under 1 % of the trees there), and then the reachability question I had written down as coming *before*
  any report to another lane turned out to be the whole answer. **No report was sent.** At ground + 1.75 the
  pose is one of the better views in the world. (`southwest/`)

[sw-approach with the camera on the ground and at a standing eye](/opt/cursor/artifacts/southwest-pose-fixed.jpg)

- **That demanded an audit, and the audit withdrew a published interpretation.** All 60 camera positions in
  this lane's twenty pose files, probed with no rendering: 57 land 1.29–2.33 m above their ground, three do
  not. `uplooks/`'s grove-shelf row is from **three metres underground**, and its reading — *"the darkest and
  the tightest, which is what a closed canopy over a shelf should be"* — explained the artefact away as a
  virtue. The replacement then nearly produced a *second* false defect at 3.37 local detail, until looking at
  the frame and two failed explanations established that **"local detail" largely measures how much sky is
  behind the leaves**, so a low reading at a closed canopy is not evidence of flatness. `uplooks/`'s
  conclusion stands, on a reachable pose. (`poseaudit/`)

[the grove shelf and the log arch, same metric, very different sky behind the leaves](/opt/cursor/artifacts/uplook-detail-confound.jpg)

- **The twelfth reverted experiment is the one whose numbers looked free.** The fixed tally's first finding
  about the *world* was that `column-lod0` submits 230 360 depth triangles against 160 934 in colour at hero A,
  all of the difference out-of-view instances casting the full high rung where the white-barks have had a
  medium-geometry twin since round 53. Widening that condition gave **−49 396 triangles at unchanged draws**,
  `unaccounted` zero, `stairs1-top` byte-identical — and moved **7.65 % of the hero frame**, one foreground cell
  99.6 % changed at a mean of 33 levels. The picture says what the numbers could not: the dapple on the
  flagstones in front of Link is gone, because the medium rung has too few leaf cards to lay it. Round 51's
  comment was right about more than it claimed. (`colshadow/`)

[the hero view before, after, and the dapple that the medium rung cannot lay](/opt/cursor/artifacts/column-shade-dapple-lost.png)

**One caveat on every "byte-identical" claim here, found by reverting the twelfth experiment.** The revert
restores hero A to the before counts *to the triangle* with a `src/` that `git diff` says is byte-identical to
the commit before the attempt — and yet its md5s differ from that commit's own earlier run at both poses. So
identical source at the same pose in the same list position can render different pixels while agreeing exactly
on draws and triangles; the pair had been launched together and the check ran alone, and the pool's wall-clock
budget is the leading explanation (`nearCanopy.starved` reads 16 in one probe and 21 in another). **Counts
reproduce across runs; pixels do not.** Which claims that touches, precisely: `proxydraw/`'s byte-identity used
a **one-pose** list and has now reproduced across four separate runs, so it stands; this branch's other md5
comparisons were made inside a single paired run on one list, which is the valid comparison; anything compared
across *separate* runs on a multi-pose list needs the caveat. This lane's rule was "same list, same order" —
necessary, and not sufficient.

`INDEX.md` lists all of them with the standing rules they produced: **read any pool number with zero renders
before calling it a play cost**; **read the comments in the file a proposal is aimed at**; **the lane's own
open pull requests are part of that**; **do not write the mechanism before running the measurement that would
rule it out**; **a total assembled by hand should publish its difference against a total that cannot forget** —
and, this week's addition, **against one it cannot assemble at all, because a self-check built from the same
code can only catch a forgotten input, never a wrong rule**; **a harness that cannot find what you asked for
must throw, not measure something else**; **check that a pose is somewhere a player can stand before you
believe anything it shows you**; **compare pixels only inside one paired run or on a one-pose list — counts
reproduce across runs and pixels do not**; **read the file the question is about before the library it calls**;
**a small changed-share is not a small change — magnify the worst diff cell before believing an
aggregate**; and, newest, **when a change does nothing visible make the branch visible — but put the probe at
the END of the pipeline, because one on `diffuseColor` is multiplied by the vertex colour and then lit,
tone-mapped and fogged, so a zero count proves nothing** (the same probe on `gl_FragColor` after the fog read
1 161 where the first read 0).

## Two findings for other lanes, from rendering the ten look spots for the first time

`lookspots/`. `playtest.mjs` checks ten "where a player stands and looks" spots every run, and this lane has
quoted **"10 look spots unflagged"** as evidence in nearly every write-up including mine. **Nobody had looked
at them.** Poses taken straight from a recorded play run, so they cannot repeat the buried-camera mistakes
above — all ten sit 1.579–4.35 m above their ground by the harness's own `cameraAboveGround`.

**1. `stairs1-base` renders almost black — and the harness does not flag it.** At the foot of the *first*
staircase, `band.mjs` reads **mean 19.1, across-columns sd 0.77** where the other nine read 58–111 and 13–32,
and the harness's **own recorded exposure** agrees independently: **mean 26.2, p95 39.1** against 57–88 and
124–165 elsewhere — its brightest 5 % is darker than most spots' median. Its `clearance.nearestM` is
**0.375 m**. Stepping the camera 2 m toward Link on the same aim gives **62.9 / sd 11.64** and local detail
**0.54 → 4.13**, so it is **an occluder against the lens**, not a dark place, and 0.54 is below the 2 that
this lane's own yardstick calls a flat slab. **The follow camera's push-out is not resolving at that spot** —
`src/camera/follow.ts`, **fable-cursor's**. The 2 m step is a measurement, not a proposed fix.

[stairs1-base as recorded and with the camera 2 m forward](/opt/cursor/artifacts/stairs1-base-occluder.jpg)

And `flags: None` at every spot, so **that "unflagged" line has been saying less than it appears** — in this
lane's evidence and in my own summaries all week. Two thresholds would catch it: an exposure mean a fraction
of the others', and a `nearestM` under half a metre. For whoever owns `gauntlet/scripts/playtest.mjs`.

**2. The staircase tops are the heaviest frames in the world.** **`stairs2-top` is 645 draws / 11 841 590
triangles** and `stairs1-top` is 655 / 9 799 283 (665 / 9 875 709 when first measured, before row 0); the
worst frame this lane had ever tracked was the flight's foot at 9.15 M, so stairs2-top is **29 % above it**,
and 645 and 655 draws are 92 % and 94 % of the 700 cap. Four of ten exceed 8.8 M. None is a rubric viewpoint
so nothing is failing — but the staircases are the reference clip's central feature. `isolate()` attributes
stairs2-top as **vegetation 4.602 M / 152 draws**, trees 3.004 / 129, structures 2.265 / 160 — these are
`isolate()`'s, the renderer's own, so row 12 leaves them standing: **vegetation-first, with the trees only
30 %** of it. stairs1-top reverses to trees 3.626 first. Three systems supply 8.2–9.9 M of each frame between
them, so it is nobody's fault alone. For **lane 4** and **lane 10**.

[five of the ten look spots](/opt/cursor/artifacts/lookspots-five.jpg)

Worth recording against the eye: `stairs2-top`'s middle distance *looks* hazy and measures **better structured
than hero A** — 22.58 / 28.22 against 21.87 / 26.19. It is simply the brightest of the ten.

## A hold I halved and have had to un-halve

`batching/`. The look spots broke the premise of `outlook/` §3's hold on batching the distant ring and the mid
layer: it declined the change because *"the binding view has 141 draws of headroom"*, but the tightest frame in
the world is not a hero view — **`stairs1-top` ran at 661 of 700 draws, 39 spare** (655 and 45 since row 13).
Against that, a 26–30 draw saving is transformative, so the hold looked wrong.

**The audit said the opposite, and the audit was broken.** It read the two layers at **exactly 1.00 call per
mesh — 15–16 draws, not 32** — so I published that the prize had halved to 12. Row 12 then found the tally
counted one call per mesh where three makes one per **visible material group**, and these layers are precisely
the families with two: `distant.ts` gives every near and far mesh a wood group and a foliage group. Re-read on
the fixed tally at hero A they are **32 colour draws over 16 meshes, 2.00 per mesh** — so §3's original 32 was
right all along, for the wrong reason (it read it as colour + depth, when depth here is 0 — §2's culls did
take that, which is why all 32 are colour).

**The prize is ~26 draws, not 12**, with a constraint §3 never stated: a `BatchedMesh` carries **one**
material, so wood and foliage cannot share one — three layers × two materials is six batches, 32 → ~6.

That is the **third** value this number has taken (26–30 → 12 → ~26) and the **second time a correction of
mine was itself wrong**. Both errors came from the same place: a tally nothing could check. It can be checked
now. The hold is therefore **weaker than I left it** — 26 draws against 45 of headroom at the tightest frame
is worth more than 12 was — and the call is the owner's, against a rewrite of both layers' drawing half, one
more attribute, a `WEBGL_multi_draw` dependence and the wrong-sway-amplitude risk §8 named.

**Four times this week a published table of mine went stale, and the fourth is the one that matters**: three
because a later change of mine improved what they measured (the trees' submission row, the batching row, and
the audit's own draw count an hour after row 0 stopped the renderer making the draw it still reported) — all
three too *conservative*, which is why none tripped anything. The fourth is different in kind: the tally
itself applied the wrong rule, for weeks, in both directions at once.

`auditgap/` shipped `unaccounted` for exactly this and it **could not have caught it** — it walks the scene
graph with the *same* `add()`, so it catches a forgotten family and never a wrong rule, and it read ZERO
through every hour of this. What catches a wrong rule is a total the code cannot assemble: the renderer's own
`info.render`, which `isolate()` has exposed per system all along.

**That gap is now closed, and the answer was a hook in this lane's own file.** Two steps got there. First,
`?shadow=0` makes the sun stop casting, which removes the depth pass from the audit (its shadow frustum goes
`null`) and from the renderer (no shadow map) at once — and the two then agree **byte-exactly** at `stairs1-top`,
98 calls and 2 045 012 triangles on both sides, and to 204 triangles in 1.38 M at hero A. So the colour model
was exact and the whole residual was the depth pass. Second, `?treelod` bracketing showed the gap identical to
the digit with the high rung empty, with everything on it, and as shipped — so it was in none of the
rung-laddered families, which left six authored ones.

**`FarFoliageBatch` installs its own `onBeforeShadow`**, written by this branch in round 54: it sets every
lobe's visibility from `reaches(shadowSpheres[id])` — the shade sweep, a different rule — and rebuilds the
multi-draw against the **shadow** camera, a different frustum. The tally assumed the depth pass reuses whatever
the colour pass left behind, which is true of three and false of this hook, so the far foliage's shade was
tallied at the colour set's size. The batch had been counting the right thing all along and publishing it per
batch (`castingTriangles`); it now records it for the tally, which cannot derive it. And one detail beyond that:
`reaches` *arms* a lobe, then `perObjectFrustumCulled` drops any armed lobe the sun cannot see, so counting the
armed set overstated the list — in `castingTriangles` as much as in the tally. The same test runs in the hook
now.

| | before | after per-group | after the batch's own list | **after the sun's-view test** |
| --- | --- | --- | --- | --- |
| A_stairs | +36 calls / −820 447 | +1 / +233 068 | 0 / −204 | **0 / −204** (0.008 %) |
| `stairs1-top` | +37 / −343 409 | 0 / +140 336 | 0 / −13 220 | **0 / 0 — exact** |
| `stairs2-top` | +37 / −479 073 | 0 / +120 931 | 0 / −76 729 | **0 / −76 729** (2.6 %) |

Both changes are **report-only** and the control is in the data: `setVisibleAt` is still called for every id
exactly as before, the renderer's own column is *identical* across every run in that table, and `stairs1-top`
re-renders at 661 draws / 9 799 283 triangles / md5 `c2d51f15…` — the fourth reproduction of the value
`proxydraw/` recorded — with its trees row now reading the renderer's own 3 549 346.

**I spent two rounds reading `node_modules/three` for this and none in the file the question was about**, which
carries a comment explaining exactly why the hook exists. The round before, `colshadow/` taught the same lesson
in a gentler form. And that round's own write-up named `giant-wood` as the leading suspect on a size argument —
wrong, because `giant-wood` is drawn in colour and so was already validated; the batch was the only one of the
six with an untested depth *rule* rather than an untested number.

**Nine hypotheses refused on the way, none of them the answer**, seven by reading `node_modules/three` — shadow
cascades, the `transparent` + `DoubleSide` two-pass rule, a constant `isolate()` overhead, non-`Mesh` drawables,
a reversed depth buffer (`Frustum.setFromProjectionMatrix` takes it and `postfx/shadowcull.ts` passes it, but
`main.ts` builds the renderer without it), VSM shadows (it is `BasicShadowMap`, so `receiveShadow` adds no
depth draws), and a second casting light (`house.ts`'s five `PointLight`s never set `castShadow`) — and two by
measurement: the shadow pass drawing a batch's full set (159 760 against a 233 272 shortfall) and non-indexed
batch lobes, where `indexCount` is **−1** and would have charged −1 triangle a lobe in exactly the residual's
direction, except `nonIndexedLobes` reads 0 and the totals came back byte-identical. That last one ships as
hardening, labelled inert. Nine correct refusals and not one of them found it, because every one was a question
about three and the answer was a question about this branch's own code.

## The trees' shade budget, now that it can be measured

Row 12 made the depth pass trustworthy, and the two rounds after it spent that on the two biggest rows.

**The largest is the giants' far foliage at 357 512 triangles at hero A** (`farshade/`) — 28 % of the trees'
shade, 4.1 % of the whole frame, and more than the entire W38 headroom on the binding view. It had been reading
124 240, so nobody could have known. Turning it off gives **8 724 803 → 8 367 291** and `stairs1-top`
**9 799 283 → 9 347 687**, −3 draws each, with the hero figure matching the corrected tally *to the triangle* —
headroom 275 197 → **632 709**, the largest triangle prize this lane has found. It is also **load-bearing**:
18.00 % of hero A moves and 12.46 % of `stairs1-top`, and what goes is the crowns' *interior* shading. They
brighten and flatten into one green mass, which is the defect the white-bark laminae exist to avoid.

[hero A with and without the far foliage casting](/opt/cursor/artifacts/farshade-hero-a.png)

[stairs1-top, the crown flattening without its self-shadowing](/opt/cursor/artifacts/farshade-stairs1-top.png)

**The second largest suspicious row was the columns' out-of-view high rung** at 69 426, and `colshadow/` found
it laying the dapple on the flagstones in front of Link. So **both of the trees' biggest shade costs have now
been measured against pixels and both earn their triangles.** The working conclusion for W38 planning: there is
**no cheap triangle left in the trees' depth pass** — 1.28 M at hero A, 48 % of the system, all of it visible.

The one avenue neither round closes is a caster **authored to keep a crown's interior dark** more cheaply than
the crown itself. `colshadow/` shows an existing rung cannot be it — a coarser rung has too few leaf cards to
lay the pattern. Priced at up to 357 512 triangles on the binding view, and not built: it is new geometry, and
the owner's call.

## The one thing a cost audit found that was free

Row 13 is the only change in this branch's cost work that cost nothing at all, and it came from turning the
cross-lane recommendation on this lane's *other* system. The canopy roof had **no submission tally** —
`canopyRoof.triangles` is the roof as built — so its per-frame cost had never been measured while the trees'
had been measured to death. `isolate('canopy')` answered in one run: **7 calls / 8 210 triangles, identical at
all three poses.** Seven meshes, seven draws, every time.

`roof.ts` states the split's purpose twice — *"number of sector meshes the cards are split into (frustum
culling)"* and *"split into sectors around the plaza for culling"* — and the test cannot fire, because a 60°
wedge of a forest-wide roof has a bounding sphere covering most of the world. At **1 173 triangles a draw** it
was the thinnest ratio in the frame, against trees averaging ~19 000.

One mesh, merged from the same vertex data, with the sector *build* untouched (`roof.ts` and its tests are not
edited; the stand still writes its own writer so the plaza sectors never change). Paired run:

| | before | after |
| --- | --- | --- |
| **A_stairs** | 561 draws / 8 724 803 / md5 `e72a8dff…` | **555** / 8 724 803 / md5 **`e72a8dff…`** |
| **`stairs1-top`** | 661 / 9 799 283 / md5 `54a01171…` | **655** / 9 799 283 / md5 **`54a01171…`** |

Byte-identical pixels are the whole safety proof for a change that only merges buffers, and the draw count is
where the win is. The split's worst case if culling ever *did* fire is the roof's 8 210 triangles — 0.09 % of
an 8.7 M frame — against six draws at every pose.

The roof now also carries `submission { drawCalls, triangles, meshes }`, which agrees with the renderer
**exactly at both poses checked** (1 / 8 210 both sides), and `vsrenderer.mjs` takes `--system` / `--audit-key`
and reports `NO SUBMISSION TALLY` rather than comparing against nothing — which is how this round started.

## A small changed-share is not a small change

`onemat/`. The canopy roof came free because merging buffers moves no pixels. The same question asked of the
thinnest row left in the trees — `distant-far` at **486 triangles a draw**, thinner than the roof was — took
four rounds, produced two wrong published mechanisms, and has now landed.

Each distant and mid geometry carries **two material groups**: the trunk on `mats.distant`, the crown cards on
the crown material. Row 12 established that three draws one call per visible group in every pass, so every one
of those meshes is two draws. One material instead of the array gives **A_stairs 555 → 539 draws with triangles
identical to the digit**, and at `stairs1-top` that is over a third of the 45 draws spare.

**0.52 % of the frame moves** — an order of magnitude below `colshadow/`'s 7.65 % and `farshade/`'s 18.00 %, and
the two frames are indistinguishable at 1×. The single cell that moves is 14.3 % changed at a mean of 37.9
levels, and magnified six times it is unmistakable: **two distant trunks are simply not there.**

[two distant trunks gone, magnified six times with the moved pixels in red](/opt/cursor/artifacts/distant-trunks-lost.png)

**And this lane's own metric missed it.** `band.mjs` exists for one question — *"the middle distance shows trees,
not haze"* — and in the window the trunks stood in its across-columns structure went **up**, 19.55 → 20.17, with
the mean up 1.9. Not wrong, insensitive at this scale: a trunk is ~4 px wide in a 250-px window and sits close to
the local mist mean, so column statistics have nothing to register. It was built to catch a whole middle distance
collapsing into a veil, and it does that.

So the rule, which is new and which nearly cost a regression: **magnify the worst diff cell before believing an
aggregate, and when a purpose-built metric disagrees with the picture, the picture wins until a focused diff
settles it.** The order here was eye, then metric (which said no), then the focused diff (which said yes).

**Round two's mechanism was wrong.** It concluded that bark's uv points at the opaque *white* patch both cluster
atlases reserve, that **`createFarCrownAtlas` has none** — true, it `clearRect`s the whole texture and its cells
tile it so the corner cannot be painted — and that bark therefore samples transparent and `CROWN_ALPHA_TEST`
discards it. The first two facts hold; the conclusion does not.

**Round three avoided the tag space and still failed, and its diagnosis was wrong.** A dedicated `aWood`
attribute (rather than a sixth code in an encoding three tree shaders decode) painted the wood branch magenta,
read **zero magenta pixels**, and concluded the branch never runs. **That inference was unsound.** The probe set
`diffuseColor` inside `<map_fragment>`, and three's pipeline then runs `<color_fragment>` — which multiplies by
`vColor`, dark bark — then the lights, `<tonemapping_fragment>`, `<colorspace_fragment>` and `<fog_fragment>`. A
dark bark vertex could never reach (255, 0, 255), so a detector looking for it could not have seen the branch
fire whether it did or not. Setting `gl_FragColor` **after the fog** instead gives **1 161 strict magenta
pixels**, including at x ≈ 726 where the trunks vanish. The flag is right, the branch fires, the trunk is
rasterised — so **it is never discarded.**

**It is repainted, and `CROWN_VEIL` does it.** The veil is the last thing that touches a crown fragment —
`share: 1.0`, `m: [16, 26]`, `ray: [0.45, 0.06]`, `lift: [0.55, 0.82]`, ending in
`mix(gl_FragColor.rgb, kfColor * tint, share * veilClimb * veilDepth * veilLift)`. For a trunk beyond 26 m
(`veilDepth` 1), darker than 0.55 of the air's level (`veilLift` 1) and seen roughly level (the falling ray
window puts `veilClimb` at 1), **every factor saturates and the mix reaches 1.0**: the fragment is replaced
outright by the mist colour. `mats.distant` had no veil bound, which is exactly why the trunk kept its colour
when a second material drew it. It is the one term I had deliberately left ungated, reasoning that it is "a
distance wash every material gets".

**With it gated, the trunks return and the prize holds**: A_stairs **555 → 539** and `stairs1-top`
**655 → 639**, triangles identical to the digit.

[the trunks are back at sixteen fewer draws](/opt/cursor/artifacts/veil-gated-trunks-back.png)

| | changed share | worst cell's mean Δ |
| --- | --- | --- |
| one material, no branch | 0.52 % | 37.9 levels |
| an `aRoot.w` test | 0.51 % | 36.3 |
| an `aWood` attribute | 0.49 % | 36.4 |
| **the veil gated too** | **0.26 %** | **5.2** |

**The gate then ran, and it failed** (`woodgain/`, and the section under the table above). Both named
candidates for the 5.2-level residual measured **zero** — the roughness and the ungated leaf warmth changed
every md5 and not one aggregate at any of the six views. The residual was a third term neither round had
looked at: **`DISTANT_NEAR_GAIN`**, the 4× the geometry writes bark at so the map, bands and cords have albedo
close up, which `mats.distant` divides back out beyond the 22–38 m blend and one material left in. Restoring
the division closes C_lookback (0.36 % of the frame → **0.04 %**) and not F_canopy (0.44 % → 0.41 %), whose
mid bole stands inside the blend and loses the whole near bark treatment: warm modelled bark becomes a flat
grey cylinder, the regression rounds 44–47 were written to fix. **Reverted**, preserved on
`cursor/squad2-woodgain-682b`, with two ways forward priced above.

**The lesson, corrected from round three's version.** Making a branch visible is right; putting the probe at the
*start* of the fragment pipeline is not. A probe on `diffuseColor` is multiplied by the vertex colour and then
lit, tone-mapped and fogged, so a dark surface can never show it and a zero count proves nothing. The same probe
on `gl_FragColor` after the fog read 1 161 where the first read 0 — and four rounds and one wrong published
conclusion turned on that distinction.

## What the other nine systems cost, and what they say they cost

Two rounds found the same class of problem in this lane's two systems — the trees' submission row 36 draws out
for weeks, the canopy's absent entirely — so rather than only recommending the check, `systemcost/` runs it on
all eleven systems in one page load. At hero A, frame 555 draws / 8 724 803 triangles:

| system | the renderer | the audit's own claim | |
| --- | --- | --- | --- |
| `lighting` | 0 / 0 | — | no meshes; nothing to report |
| `atmosphere` | 4 / 6 816 | — | **no per-frame figure** |
| `terrain` | 33 / 628 274 | — / 622 088 | a **built** total, not a submitted one |
| `hardscape` | 15 / 524 524 | — | **no per-frame figure** |
| `rocks` | 31 / 231 680 | — | **no per-frame figure** |
| `trees` | 140 / 2 656 488 | **140 / 2 656 692** | 0 draws, −204 triangles (row 12) |
| `canopy` | 1 / 8 210 | **1 / 8 210** | **agrees exactly** (row 13) |
| `structures` | 119 / 2 008 148 | — / 2 427 971 | a built total, **419 823 triangles above** what it draws |
| `props` | 15 / 97 752 | — / 72 356 | a built total, 25 396 below |
| `vegetation` | 127 / 2 455 038 | **126 / 2 454 630** | 1 draw, 408 triangles — near exact |
| `character` | 63 / 179 984 | — / 154 442 | a built total, 25 542 below |

The isolates sum to 548 draws / 8 796 914 triangles against the frame's 555 / 8 724 803 — about what the sky,
the composer's passes and anything outside a named system child should account for, which is the method's own
sanity check.

**`vegetation` is the standard**: 1 draw and 408 triangles from the renderer. **Four systems publish a built
total where a reader will take a frame cost** — not wrong of them, but `terrain`, `structures`, `props` and
`character` each publish `triangles` with no draw count beside it, and the largest gap is `structures` at 21 %
above what it draws. `canopyRoof.triangles` sat in exactly that position and happened to match, because nothing
was ever culled, which is the trap.

**One lead worth another lane's hour: `character` is 63 draws for 179 984 triangles** — 11.4 % of the frame's
draws for 2.1 % of its triangles, **2 856 a draw**, now the thinnest ratio in the frame and the position the
canopy roof held until row 13 merged it:

| | `atmosphere` | **`character`** | `props` | `rocks` | `canopy` | `structures` | `trees` | `terrain` | `vegetation` | `hardscape` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| triangles a draw | 1 704 | **2 856** | 6 516 | 7 473 | 8 210 | 16 875 | 18 974 | 19 038 | 19 331 | 34 968 |
| draws | 4 | **63** | 15 | 31 | 1 | 119 | 140 | 33 | 127 | 15 |

Draws are the scarce resource where this world is tight — `stairs1-top` at 655 of 700, 45 spare — so 63 of them
going to one character is worth its owner's attention. A rigged GLB with several material slots is a harder
merge than a static roof was, so this is a number and not a proposal. One pose, and `isolate` excludes the
composer: see `systemcost/` for the caveats stated in full.

## Open, and whose call each is

- **fable-cursor** — **the follow camera renders black at `stairs1-base`** (above), an occluder 0.375 m from
  the lens that its push-out does not resolve; `rec-r024-plaza-fork` in the owner's pose file matches
  **`r_020`**, not `r_024`; #206, #198 and #204 can be closed as superseded; and
  **`outlook/familycost.mjs` no longer runs** on the current `src/` (it needs a temporary trees-group handle
  that was removed).
- **lane 4** — **vegetation is 4.60 M of the 11.84 M frame at `stairs2-top`**, the heaviest frame measured
  anywhere in this project.
- **lane 10 / the gauntlet owner** — `playtest.mjs` records the exposure and the clearance that identify the
  black frame and flags neither; raise `timeout-minutes`; a one-line `setTime` re-apply after the settle loop
  would let CI pick its own warm-up at the price of moving every reference image once (`capturetime/`); and a
  `quality=low` capture at `pixelRatio` 1.5 would settle the one residual in `LOWTIER.md` §4.
- **the owner** — the atlas's leaflets are **514 ms** of load for leaf detail the mid layer shows at 12 m; the
  pool's budget doubled completes more parts for a doubled per-frame p95; the authored curtains' far LOD. All
  three priced, none built. Two more join them: **batching the distant and mid layers at ~26 draws** and **a
  caster authored to keep a crown's interior dark at up to 357 512 triangles on the binding view**. And **row
  14 ran its gate and failed it** — the six fixed views say 15–17 draws for nothing in triangles, but F_canopy's
  mid bole loses its bark modelling, because `DISTANT_NEAR_GAIN`'s 4× is divided out by `mats.distant` and not by
  the crown material, and inside the 22–38 m blend the whole near bark treatment goes with it. **Reverted**;
  preserved on `cursor/squad2-woodgain-682b`. Two ways to collect those draws are priced above, and **(b) needs
  the trees-materials owner's yes** because it refactors `materials.ts`.
- **fable-4** — `castShadow` on the white-barks moves **0.00 %** of the pixels at both look-backs while saving
  40 224 triangles / 3 draws at plateau-north (`whitebark.ts`, 21 meshes). Row 0 is the *other* half of that
  family's shadow cost and is already taken.
- **lanes 4 and 9** — `vegetation/clump-atlas.ts` and `structures/house.ts` read back after heavy canvas
  drawing, like the atlas did. Run the 1×1 test before adding `willReadFrequently`: it was noise here.
- **whoever owns the character** — **63 draws for 179 984 triangles at hero A**, 11.4 % of the frame's draws for
  2.1 % of its triangles and the thinnest ratio in it (above). Also `character.triangles` publishes 154 442,
  which is a **built** total 25 542 below what the frame draws.
- **whoever owns `structures`** — `structures.triangles` publishes **2 427 971 against 2 008 148 drawn at hero
  A**, 21 % above, and with no draw count beside it. 119 draws is the second largest in the frame after the
  trees' 140.
- **every lane** — **the table is already made**, in `systemcost/`: `isolate(group)` for all eleven systems at
  hero A beside every cost-shaped field their audits publish. Three publish a per-frame draw count, and two of
  those three are this lane's. `vegetation` is the one that already had it and is **near exact** — 1 draw and
  408 triangles from the renderer, the standard the rest can be held to. For one system in depth,
  `auditvsrenderer/vsrenderer.mjs --system <group> --audit-key <audit key>` splits the passes with
  `ZR_URL_EXTRA='shadow=0'`. The four rules a tally is most likely to miss: one draw **per visible material
  group** in both passes, `frustumCulled === false` meaning the object is submitted regardless, a
  `BatchedMesh` drawing only the lobes `perObjectFrustumCulled` leaves — and **any `onBeforeShadow` your own
  code installs**, which can make the depth pass a different set from the colour pass entirely.

