# The rung transition band turned on — `dither/PROPOSAL.md`'s four checks, answered

Lane 2, 2026-09-29. Branch `cursor/squad2-treephases-682b`. **`TREE_LOD_DITHER = true`.**

The lane's own docs had one item still open: `src/world/trees/lodFade.ts`'s band was built in three
parts (`dither/PART1`–`PART3`) and shipped **inert**, `TREE_LOD_DITHER = false`, waiting on the four
checks the proposal named. The blocker under it — the end-of-build memory sweep freeing the
per-instance array the buckets rewrite — was closed from the helper's side by fable-4's #193, and
`releaseAfterUpload` now skips an `isInstancedBufferAttribute`. So the only thing left was to run the
checks. **All four pass, and the flag is on.**

## 0. How the swap was measured: move the gate, not the camera

The proposal's checks 2 and 4 both ask what a player sees while **walking across a rung gate**. A
walked strip answers that, but every frame of one also changes parallax, the sky area behind the
crowns and the set of trees in shot — differences far larger than the one under test. The lane has
already burnt a round on exactly this kind of contamination (`settle/`: advancing the clock 1/30 s
per step made every group appear to change 13–31 % of the frame; it was the leaves moving).

So the camera stands still and the **gate** walks instead. `bucketFamily` assigns rungs from
`d < lodDist[0]`, and `lodDist` is the same array the trees audit publishes as `lodSwapM.tree`;
`setPose` always calls `notifyCameraMove`, which forces `rebucket(camera, true)`. So writing
`lodSwapM.tree[0] = 33` and re-applying the pose re-buckets the whole world at a different gate with
**nothing else in the frame changed**, and the clock frozen throughout. A tree at 34.5 m watching the
gate walk 29 → 35 m sees exactly what it would see if the camera walked 29 → 35 m toward it, minus the
parallax. `gatesweep.mjs` does it in one page load, which also puts the whole sweep inside one run —
the protocol `frozen.mjs` requires, since pool residency carries between poses.

The sweep is at the owner's `owner-0650-north` pose, the one `lodcheck/` measured the rung error at.

## 1. Check 4 — "it may not read": it reads, and the defect was mis-stated

The proposal's headline was *"the shipped rungs differ by 1.85 % of the frame … and that share changes
in one step as a walker approaches"*. The first half is right and the second half does not follow:
1.85 % is the total difference between the shipped rungs and **every tree forced high**, summed over
every tree at every distance. It is not the size of one step. The sweep measures the step:

| gate | dither OFF: step from the metre before | dither ON |
| --- | --- | --- |
| 29 m | — | — |
| 30 m | 0.298 % | 0.038 % |
| 31 m | 0.038 % | 0.005 % |
| 32 m | **0.000 %** | 0.194 % |
| 33 m | 0.252 % | 0.138 % |
| 34 m | **0.000 %** | 0.239 % |
| 35 m | **0.811 %** | 0.190 % |
| **worst step** | **0.811 %** | **0.239 %** |

That is the signature of a hard cut and of a fade, side by side. **Off:** two metres of walking change
*nothing at all*, and then one metre changes 0.811 % of the frame. **On:** six small, even steps and no
zeros. The worst single metre falls **3.4×**.

Globally 0.811 % sounds small, so `diffmap.mjs` was asked where it lands. It is one crown, not a wash:

| the cell the swap lands in (x 0.25–0.38, y 0.13–0.25) | changed | mean Δ |
| --- | --- | --- |
| dither OFF, its worst step (gate 34 → 35 m) | **28.0 %** | 22.3 levels |
| dither ON, its worst step (gate 33 → 34 m) | **6.8 %** | 17.1 levels |

**A quarter of that cell snapped in one pace; now a fifteenth of it moves per pace.** 4.1× locally,
and the magnitude of what does change drops from 22.3 to 17.1 levels. On the dithered side the worst
step's hot cell has also moved to a *different* part of the frame (x 0.63–0.75) — the changes are
spread across trees as well as across metres, because two trees are no longer forced to cross on the
same pace boundary.

`step-off-34-35.jpg` and `step-on-33-34.jpg` are the two diffmaps, same scale, same grid.

## 2. Check 2 — "the pattern can crawl": no stipple to crawl

The mask is a `gl_FragCoord` hash, which is fixed in screen space, and the project's only AA is FXAA
(`postfx/composer.ts` step 7) — there is no temporal pass to resolve a stipple. So this was the check
most likely to fail, and the honest way to ask it is not "can I see it" but "is there any
high-frequency energy to see". A per-pixel checker is the highest-frequency signal a raster can hold;
`crownenergy.mjs` takes the Laplacian variance of the crown box the diffmap ranked first, over every
gate of both sweeps:

| | Laplacian variance across the seven gates | range |
| --- | --- | --- |
| dither OFF | 0.00468 0.00471 0.00471 0.00471 0.00471 0.00471 0.00477 | 0.00468–0.00477 |
| dither ON | 0.00465 0.00465 0.00465 0.00471 **0.00493** 0.00479 0.00479 | 0.00465–0.00493 |

The dithered build's peak is **+3.4 % of local high-frequency energy** over the undithered build's own
spread, at the one gate where that crown is deepest in the band. There is no stipple: the leaves of
these crowns are already alpha-tested high-frequency foliage, so discarding a share of their fragments
reads as **slightly thinner foliage**, which is what a fade should look like. `crown-8x.jpg` is the
same crown at ~8× in three states (off, on, on one metre later) — ordinary foliage in all three.

What this check does **not** cover: a strip with the camera actually moving. Screen-space stipple is
what crawls, and there is +3.4 % of it, so there is little to swim — but the reading is static and it
should be said plainly rather than implied away.

## 3. Check 1 — the fixed frames: two do not move at all, three move 0.14–0.60 %

`frozen.mjs` on the two builds, five distinct fixed frames, clock frozen, same run each side:

| view | dither OFF | dither ON | Δ draws | Δ triangles | SSIM | changed |
| --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 559 / 8 626 622 | **561 / 8 724 803** | +2 | +98 181 | 0.99887 | 0.138 % |
| B_house | 541 / 7 903 532 | 543 / 7 971 464 | +2 | +67 932 | 0.99640 | 0.498 % |
| C_lookback | 479 / 7 679 745 | 480 / 7 721 403 | +1 | +41 658 | **1.00000** | **0.000 %** |
| D_log | 465 / 8 242 550 | 468 / 8 258 565 | +3 | +16 015 | 0.99632 | 0.600 % |
| F_canopy | 500 / 7 831 095 | 501 / 7 838 848 | +1 | +7 753 | **1.00000** | **0.000 %** |

C_lookback and F_canopy are **byte-identical md5s** — `bf2f8dfd…` and `835cd10b…` on both sides — while
still gaining a draw and 41 658 / 7 753 submitted triangles. A banded tree admitted by its padded cull
sphere and then hidden behind what is already in front of it costs the submission and paints nothing.

The three that do move move by 0.14–0.60 % of their pixels, at SSIM ≥ 0.9963, and the change is local:
at B_house 18.3 % of one cell (x 0.50–0.63, y 0.00–0.13) against 0.50 % of the frame — one crown in the
upper middle sitting mid-band. Looked at (`bhouse-2x.jpg`), that crown's middle distance reads slightly
*more* defined with the dither on, because a banded tree contributes some of its **high** rung's
fragments where before it contributed only its medium rung's. It is a small change in the direction
the owner keeps asking for, not a veil.

The proposal offered a fallback here — "the dither has to be suppressed under capture" — and it is
**not taken**. A sealed shot that disagrees with the running build is worse than a sealed shot that
moved 0.4 %, and this lane has argued that elsewhere; the movement is reported instead.

## 4. Check 3 — the budget: worst case 139 draws and 0.275 M triangles under W38

W38's two lines (≤ 700 draws, ≤ 9.0 M triangles) are scoped to the four hero viewpoints. Worst of the
four with the band on is **A_stairs at 561 / 8 724 803** — 139 draws and **275 197 triangles** spare.
The cost of the whole feature at a hero view is **+1 to +3 draws and +8 K to +98 K triangles**: a
banded tree is drawn twice, and `TREE_LOD_DITHER_BAND_M = 2.5` was chosen to be the narrowest band
that is still a couple of walking paces, exactly so that this number stays small.

At the owner's north pose, at the shipped gate, the same cost reads 440 / 8 501 347 → 444 / 8 546 381.
The gauntlet's own `pose-counts.mjs`, a different harness on the shipped build, reads all six fixed
views **to the triangle**: 561 / 8 724 803, 543 / 7 971 464, 480 / 7 721 403, 468 / 8 258 565,
E_ground 543 / 7 971 464 and 501 / 7 838 848 — the same numbers §3 read with `frozen.mjs`, and
E_ground still exactly B_house as it was without the band (`pose-counts-band-on.json`).

## 5. What the band does and does not cover

`lodSlots` is called from one place, `bucketFamily`, and `bucketFamily` is called for **three
families**: the white-barks, the seated columns and the understory. The distant and mid layers have
their own near gates (`distantNear`, `MID_FAR_LOD_M`), the giants swap by sector and by the near-bole
rule, and the near canopy swaps through the LOD pool — **none of those is banded**, and nothing here
claims they are. The audit now says so out loud: `trees.lodBand` publishes `{ on, bandM, families }`
alongside `lodSwapM`, so a reviewer reading the audit can tell which state a build is in and which
ladders the band applies to without reading the source.

The rung this fixes is the one that mattered: `lodcheck/` attributed essentially all of the measured
rung error to the white-barks' and columns' **high→medium** swap, which is the near gate of exactly
these three families.

**The shipped build reproduces the tested one.** §3's numbers were read from a build made only to test the
flag; the committed build also carries the audit's new `lodBand` key. Re-read on it, A_stairs comes back
at **561 / 8 724 803 and md5 `e72a8dff4d0b31111684b8e31d586d79`** — the same bytes as the tested build, so
the audit key costs nothing and changes nothing. D_log's md5 differs between those two runs
(`a2d2cb2d…` against `a1c05849…`) at identical draws and triangles, which is `frozen.mjs`'s documented
run-order effect rather than a build difference: pool residency carries between poses, and in one run
D_log was the fourth pose visited and in the other the second. It is why a comparison has to stay inside
one run of the script, which §1–§3 all do.

## 6. Behaviour, and what the band costs in play

`playtest.mjs --only look,walk,perf` on the shipped build against this morning's recorded run of the
same tool on the same branch without the band (`../headcheck3/playtest.json`):

| | band off | band on | Δ |
| --- | --- | --- | --- |
| plaza | 528 / 7 677 516 | 530 / 7 711 094 | +2 / +33 578 |
| the flight's foot | 535 / 9 151 000 | 535 / 9 153 565 | +0 / +2 565 |
| saria-side | 502 / 8 508 917 | **508 / 8 585 962** | **+6 / +77 045** |
| west-house | 411 / 4 908 289 | 412 / 4 951 247 | +1 / +42 958 |

**11 / 11 walk routes reached, 0 stuck, 10 look spots unflagged, 0 page errors** — the same as without
the band. None of these four poses is inside W38 (it is scoped to the four hero viewpoints), but the
flight's foot is the branch's worst tracked frame and the band adds **2 565 triangles** to it, so the
walking figure that PROJECT_STATE's 30 fps claim rests on is untouched. The most the band costs
anywhere measured is saria-side's +6 draws.

## Files

- `gatesweep.mjs` — the harness: one load, one pose, N gate values, the clock frozen, step-to-step SSIM
  and changed share. `--view` or `--pose`/`--poseName`, `--gates`.
- `crownenergy.mjs` — check 2 as a number: Laplacian variance of a box across a sweep, per build.
- `sweep-off.json`, `sweep-on.json` — the two sweeps, per gate: draws, triangles, md5, step SSIM.
- `step-off-34-35.jpg`, `step-on-33-34.jpg` — the worst step on each side, diffmapped on the same grid.
- `crown-8x.jpg` — the working crown at ~8×: off, on, on one metre later.
- `bhouse-2x.jpg` — the one fixed frame that moves most, at ~2×, at the crown that sits mid-band.
- `hero-off.json`, `hero-on.json` — the `frozen.mjs` reads behind §3.
- `playtest-band-on.json` — the walk / look / perf run behind §6.
- `pose-counts-band-on.json` — the gauntlet's own tool on the shipped build, all six fixed views.

## Reproducing

```bash
npm run build                                   # dither ON is the shipped state now
node art/environment/squad2-2026-09-23/gatesweep/gatesweep.mjs dist /tmp/sweep-on \
     --pose art/environment/owner-2026-09-23/pass3/owner-0650-poses.json \
     --poseName owner-0650-north --gates 29,30,31,32,33,34,35 --settle 8
node art/environment/squad2-2026-09-23/gatesweep/crownenergy.mjs --dir /tmp/sweep-on
node art/environment/squad2-2026-09-23/frozen.mjs dist /tmp/hero-on \
     --views A_stairs,B_house,C_lookback,D_log,F_canopy --settle 8
```

For the undithered side, set `TREE_LOD_DITHER = false` in `src/world/trees/lodFade.ts` and build to a
second directory (`npx vite build --outDir dist-nodither`). One flag is the whole difference; the two
builds' bundles differ by 0.98 kB. **Never run more than two of these jobs at once** — SwiftShader
takes 22–51 s a frame and a page load is 140 s, so this sheet is about 50 minutes of rendering.
