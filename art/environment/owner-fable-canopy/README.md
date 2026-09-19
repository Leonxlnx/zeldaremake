# Canopy roof — owner-fable (PR #17)

Owner priority: a convincing playable forest — overhead canopy and detail visible at longer
distances. fable-cursor approved the lane on 2026-09-19 18:45 UTC (INBOX) with conditions; this
folder is the evidence for those conditions.

Every image here is a native D3D11 render on the owner's laptop (Radeon 780M, headless Chrome,
`ZR_NATIVE_GPU=1`), never SwiftShader: comparable to each other, not to the monitor's takes.
Six views: `gauntlet/scripts/capture.mjs --settle 90` (the gauntlet's own capture); poses:
`gauntlet/scripts/broll.mjs --size 1280x720 --fps 12 --test --settle 12` at survey-2's poses
(`art/environment/survey2/manifest.json`). BEFORE = the world head `15e7495` (take-0117's world)
built in a detached worktree; AFTER = the same head + `src/world/canopy/` + the one-line hook.
Rule (round 46): an after that looks like its before is a FAIL, not a claim.

## What the roof is

`src/world/canopy/` — a new system, nothing in `src/world/trees/**`: an upper canopy layer of
leaf-mass cards at the giants' upper-crown height, dense over each giant's crown and thinning to
hazy gaps between distant ones. Four seeded tufts on a 2 × 2 atlas (dark cores where leaves
overlap several deep, single fringe leaves the sky shows through, a lit rim on the outer leaves;
an overlap-depth channel lets the sun through the thin fringe and not the core). Undersides are
hemisphere-lit with a small ambient lift; a card fades out edge-on; slow sway through the shared
`windBranch`. 426 clumps / 1 673 cards / 3 346 triangles in six sector meshes, at 19.7–30.7 m
(every clump ≥ 20 m above the ground under it).

The three canopy layers hand off by distance:

| layer | owner | where it draws |
| --- | --- | --- |
| near-canopy laminae (`trees/nearCanopy.ts`) | trees-30 | the giants' lower lobes within 22 m of the walker (out again at 26 m) |
| the giants' far foliage (`trees/giant.ts`) | trees-30 | every distance; the hero frames are matched to it |
| **canopy roof** (`canopy/roof.ts`) | owner-fable | ≥ 20 m above the local ground, so ≥ 20 m from any walker's eye and only ever seen from below; bounds x −46…52 / z −70…40, inside the distant ring |
| far crowns (`trees/distant.ts`) | distant-1 | the 60–220 m ring |

## Conditions (fable-cursor, 18:45 UTC) and how each is met

| condition | how | proof |
| --- | --- | --- |
| no shadow casting | `castShadow = receiveShadow = false` on every roof mesh | `audit.systems.canopyRoof.castsShadow = false`; A's dapple / motion pair pixel-identical |
| every `SHAFT_COLUMNS` column and `CANOPY_OPENINGS` pool clear | a clump within the column's carve radius (or the pool's radius) of its sun line is not built | `roof.test.mjs` asserts it against the data; audit `dropped.shaft 30` / `dropped.opening 12` |
| roof above 20 m | `ROOF_MIN_ABOVE_GROUND_M = 20`; a clump below it is lifted | the test asserts every clump; audit `minAboveGroundM 20` |
| six hero frames within −0.003 (native and SwiftShader) | any clump whose cards project inside a hero frame within 120 m is not built (`dropped.heroFrame 81`) | six views pixel-identical natively (table below); the PR's CI gauntlet comment for SwiftShader |
| seeded PRNG | `ctx.rng.fork('canopy-roof')` in grid order; every cell draws whether or not it builds | the test: same seed → same clumps |
| wind through `WIND_GLSL` | `windBranch` on the clump root, `ctx.wind.bind` | — |

## Six views — BEFORE `15e7495` → AFTER (+ canopy roof)

`tools/pixdiff.mjs`: 0.000 % of pixels changed by more than 8/255 on every view, mean
|Δ| 0.000 — the roof never enters a hero frame. Console: 0 errors, 0 page errors.

| view | SSIM before | SSIM after | draws | triangles |
| --- | --- | --- | --- | --- |
| A | 0.2206 | 0.2206 | 521 → 527 | 8.797 → 8.800 M |
| B | 0.2068 | 0.2068 | 479 → 485 | 7.944 → 7.947 M |
| C | 0.2416 | 0.2416 | 363 → 366 | 7.372 → 7.375 M |
| D | 0.2785 | 0.2785 | 354 → 360 | 8.123 → 8.127 M |
| E | 0.2120 | 0.2120 | 479 → 485 | 7.944 → 7.947 M |
| F | 0.2701 | 0.2701 | 468 → 473 | 8.259 → 8.262 M |

(The +3…+6 draws are the sector meshes three's frustum test keeps; the roof casts nothing.)

## Poses — BEFORE | AFTER at survey-2's poses

| sheet | pose | verdict | what changed |
| --- | --- | --- | --- |
| `roof-w22-stairs-u.jpg` (+ `-full.jpg`) | looking up from the stair foot | **PASS** | open flat blue sky between the near lobes → a roof of dark leaf masses with lit fringe and hazy gaps; the near-canopy laminae underneath are unchanged |
| `roof-w07-spine-u.jpg` | looking up from the spine under the lantern tree | PASS | the gaps between the lantern tree's crown and its neighbours close with layered masses; the sun-through fringe reads at the gap edges |
| `roof-w27-plateau-u.jpg` | looking up from the plateau | PASS (partial) | the left and centre close; the right stays open where the F shaft columns' sun lines cross (carved by rule) and the plateau's field thins |
| `roof-w19-spine-u.jpg` | looking up in the north hollow | **unchanged** | the roof is there (26 clumps within 12 m at 23–24 m, `tools/roof-debug.mjs`) but the hollow's height fog veils it to the sky colour — the giants' own crowns 15 m up read as grey masses at this pose already. A roof over the hollow is a fog decision (Astra's `heightfog.ts`), not more cards |
| `roof-w22-stairs-r.jpg`, `roof-w02-spine-r.jpg` | player height on the stair and the plaza | unchanged by design | the roof is above these frames' top edge; the flat hero lobe at 5 m stays (decision card below) |
| `roof-F_canopy.jpg` | hero F | pixel-identical | as the table above |

## Decision cards for the owner (fable-cursor forwards)

Both dials are measured SSIM compensations against the reference frames' blur. They are not in
this PR; each card is the world head `15e7495` rendered natively with ONE constant released, so
the owner can see what the −0.003 budget is buying. Nothing of these is committed.

**Card 1 — the hero-framed flat lobes** (`trees/nearCanopy.ts` `NEAR_CANOPY_FLAT_SWAP_M`
`null` → `[14, 17]`: the four bank-canopy lobes the hero cameras frame swap to their layered
near version like every other lobe). Sheets `card-flatlobes-F.jpg`, `card-flatlobes-A.jpg`
(reference | ours | ours-with-detail), `card-flatlobes-w22-stairs-r.jpg` (the 5 m disc a walker
sees on the stair). Cost: F 0.2701 → 0.2568 (−0.0133), A 0.2206 → 0.2182 (−0.0024), C −0.0006,
B / D / E unchanged. Gain: the discs over the stair and the plaza become forking twigs with
layered laminae at every pose that sees them.

**Card 2 — the shade floors past 8 m** (`trees/materials.ts` `TREE_FLOOR_FADE_M` `[5, 10]` →
`[80, 120]` and `COLUMN_FLOOR_FADE_M` `[20, 32]` → `[80, 120]`: the NEAR presets — bark keeps
0.3 of its own texture in shade instead of 0.1, leaves 0.6 instead of 0.4 — at every distance).
Sheets `card-shadefloors-C.jpg` (reference | ours | ours-with-detail), `card-shadefloors-w17-spine-l.jpg`
(boles at 8–20 m). Cost: C 0.2416 → 0.2299 (−0.0117), F −0.0091, D −0.0047, A −0.0031,
B −0.0032, E −0.0030. Gain: bark cords and tone bands read on every trunk past 8 m; the frames
darken toward the reference's shaded trunks but lose the veil the SSIM rewards.

## Re-confirmation on the merged world head `38f430ea` (round 47: trees-30, distant-1, shell-1, …)

After merging the world head the same test was run again: a fresh BEFORE capture of `38f430ea`
in the worktree vs this branch (`23f9aba9` = `38f430ea` + the roof), `capture.mjs --settle 90`
natively (the machine was shared with several other agents' captures, so the six views were
captured in two runs: A–E, then F alone after Chrome's target closed under load).

| view | pixels changed | draws before → after | triangles before → after |
| --- | --- | --- | --- |
| A | 0.000 % | 562 → 568 | 9.025 → 9.03 M (the head's own W38 overrun — fable-cursor's `aa7857b` fixes it; merged since) |
| B | 0.000 % | 519 → 525 | 8.263 → 8.27 M |
| C | 0.000 % | 386 → 389 | 7.534 → 7.54 M |
| D | 0.000 % | 382 → 388 | 8.543 → 8.55 M |
| E | 0.000 % | 519 → 525 | 8.263 → 8.27 M |
| F | 0.000 % | 499 → 504 | 8.448 → 8.451 M |

Console 0 errors on every run. Up-poses on the merged head (`w22-stairs-u`, `w07-spine-u`): the
roof reads as on `15e7495`; `w25-stairs-f` (the stair top looking north) shows distant-1's new
soft far crowns in the haze with no roof card doubling them — the roof's bounds end at the
arch, where the depth rows begin.

## Provenance

- BEFORE: `E:/zeldaremake-wt-base` detached at `15e7495`, `npm run build`, captures above.
- AFTER: branch `agent/owner-fable-canopy-distance` (this PR), same commands.
- Cards: `E:/zeldaremake-wt-cards` detached at the PR head with the one constant patched
  (`tools/cards.sh` shows the exact `sed`), source restored after.
- Sheets: `tools/sheet.mjs` (side-by-side at 0.5 scale, unretouched renderer PNGs).
