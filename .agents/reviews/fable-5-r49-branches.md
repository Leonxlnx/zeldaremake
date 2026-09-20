# fable-5 — round-49 lane branches, measured before/after (non-author)

Continues `fable-5-r48-branches.md` (§A–§O) on a fresh branch after `714fcd98` merged iterations 9–11.
Method unchanged: the lane's commits cherry-picked onto the current head in a worktree, the same shot
list rendered on head and union at identical positions (`broll.mjs`, 1280×720, settle 8, `--test`),
SSIM at the gauntlet's 256×144 (`fable-5-tools/ssim-pair.mjs`), crops at the poses where the defect
was named. Sheets in `fable-5-r49/`.

## A. Iteration 12 (10:25–11:10 UTC) — fable-4 `5fe58488` (`agent/fable-4-r49b`), the round-48 vertex-colour bands and chevrons retire

Head `0990b2c7` (tick 192: fable-4's budget branch with the low boughs merged, my §M–§O merged) +
`5fe58488` cherry-picked; `whitebark.ts` only (−54/+5, vertex colours only, geometry identical);
tsc + build + `lodPool` test green. Nine views: the six fixed ones plus `wb-grove-10m`,
`sn-whitebark-base` (opus-07's pose) and `x-arch-tunnel-n` (the young white-barks through the arch).

| view | head → head + 5fe58488 | SSIM vs reference |
| --- | --- | --- |
| A_stairs, B_house, D_log, E_ground, F_canopy | pixel-identical | Δ 0 |
| C_lookback | 0.06 % (the survey stem's upper bark) | 0.2259 → 0.2259 (Δ 0) |
| `wb-grove-10m` | 0.51 % — four stems, 84 % of it on the main stem at x 0.49–0.53 | — |
| `sn-whitebark-base` | 0.09 % (543 px, upper bark only) | — |
| `x-arch-tunnel-n` | 0.12 % (the right young stem) | — |

**What changed, and it is the right thing.** On the grove's main stem the head carries a soft dark
gradient across the pale bark between the tile's crisp torn bands — the round-48 vertex-colour "broad
band" — and after `5fe58488` that smudge is gone: pale bark up to the crisp band, as a birch has it
(sheet `fable-5-r49/fable-5-r49-f4-marks-retire.jpg`, top row with the diff heat). The chevron scars
went with it. What stays is what reads: the texel-resolution torn bands (`cfcd4f4d`), the 6–14 cm
bands, the sooty foot — at `sn-whitebark-base` the 2 m read is unchanged to the eye (543 px).

**IMPROVED, small and clean — merge.** No budget cost anywhere; W08 at C unaffected (Δ 0); the "soft
zone above a crisp band" I noted is what retired. fable-4's next (lean/taper, measured first) is the
remaining half of W08 at C and #6 of the round-49 list.

## B. Iteration 13 (11:31–12:15 UTC) — fable-4 `ea86f8c1` (with `5fe58488`), lean 5–10° turned across camera C

Head `e54a74ed` (tick 193: fable-2's pebble looks + envelope merged, my §A merged) + `5fe58488` +
`ea86f8c1` cherry-picked (`whitebark.ts` only); tsc + build + `lodPool` test green. Same nine views.

First the head itself: `0990b2c7` → `e54a74ed` at the same positions is the two pebble commits —
A +0.0003, B +0.0004, C +0.0006, D −0.0003, E +0.0004, F +0.0001, the whitebark poses ≤ 0.3 % px —
the numbers of §O, as expected; nothing else moved.

| view | head → head + fable-4 | SSIM vs reference |
| --- | --- | --- |
| A_stairs | 0.01 % | Δ 0 |
| B_house | 0.04 % | +0.0002 |
| C_lookback | **3.27 %** — the survey tree at the right edge leans across the frame (foot at x ≈ 0.95, top at ≈ 0.89 of the frame) instead of standing plumb | 0.2265 → 0.2259 (**−0.0006**) |
| D_log | 0.05 % | −0.0004 |
| E_ground | 0.03 % | Δ 0 |
| F_canopy | pixel-identical | −0.0001 |
| `wb-grove-10m` | 22.5 % — every stem leans more and differently, the soft bands gone | — |
| `sn-whitebark-base` | 10.8 % — the 2 m stem tilts a few degrees; marks unchanged | — |
| `x-arch-tunnel-n` | 9.0 % — the young stems through the arch lean | — |

**IMPROVED — the second of W08's three halves.** At C the trunk now reads as a tree that grew, not a
post: the bough (`d914268f`, merged) gives it a limb, the lean gives it a direction; the grove at 10 m
loses the "poles under crowns" read that opus and I both named. Inside the budget (C −0.0006, worst
D −0.0004). Boughs stay attached (the offset was reduced with the lean); nothing floats at the base.
What W08 still lacks: **taper** — the C stem is the same width at the top of the frame as at the foot.
Sheet `fable-5-r49/fable-5-r49-f4-lean-C.jpg`. Merge.

**Correction (17:35 UTC, after fable-4's own audit):** `ea86f8c1` re-rolled 18 of 80 white-bark
placements (the outer ring — `TreeAsset.radius`/`height` feed the placement sampler, and turning the
lean azimuth moved the bounds). None of the 18 sits in the six frames, so this pair could not see it;
the grove's 22.5 % "every stem leans more" *included moved stems*, which I read as lean. fable-4
reverted the commit (`78a71f47`); the lean half of W08 is open again. Method note for my lane: a
six-view pair does not certify the seeded-PRNG rule for placement-sensitive commits — when a commit
touches anything a placement sampler reads (bounds, radius, height, variant count), the check is the
instance transforms (fable-4's replica of the placement stream), not pixels. I will ask for or run
that check before calling such a commit "placement-identical" again.

## C. Iteration 14 (12:36–13:25 UTC) — fable-2 `e5867d7e` (`agent/fable-2-w23-loaf`), the D loaf 0.2 m prouder (squash 0.72, no sink)

Head `ca562e76` (tick 194) + `e5867d7e` (`rocks/index.ts` only); build + `rockgen`/`pebbles` tests
green. Eight views: the six + `sn-boulder-shotd` (2 m) + `w28-plateau-d` (a control, unrelated).

| view | head → head + loaf | SSIM vs reference |
| --- | --- | --- |
| A_stairs / B_house | 0.04 % / 0.15 % | −0.0001 / −0.0001 |
| C_lookback, `w28-plateau-d` | pixel-identical | Δ 0 |
| D_log | **0.78 % (6 272 px) at (0.09–0.32, 0.53–0.88)** — a rock is in the frame where the head had fronds and a sliver (§M: 372 px) | 0.2615 → 0.2607 (**−0.0008**) |
| E_ground | 0.13 % | +0.0003 |
| F_canopy | pixel-identical | −0.0001 |
| `sn-boulder-shotd` | 18 % — the sunk lump is a boulder with its strata face and moss top above the fern line | — |

**Composition fixed, value inverted — IMPROVED, not closed; the D cost is the composition itself.**
The pixels the loaf now owns at D read **l 0.21, hue 63°, sat 0.15** (moss and shade) where the fronds
they replaced read l 0.28 and the reference's bare face reads **l 0.27, hue 52°, sat 0.36** (olive-tan,
lit). Camera D looks north, so the boulder's face toward it is its south side: shaded under a moss cap
in our light, lit and pale with the ferns ON TOP of it in the frame. So the next half is not geometry:
(1) the moss cap kept off the camera side of `shot-d-boulder` (the reference's rock is bare down to the
grass, the plants sit on its crown), (2) the shaded face lifted toward l 0.27 — a rock-material ambient
term or the D face's `cutDark`/tint from `a683a4c1` now that it is visible, (3) vegetation-26's disc so
the fronds stop clipping its foot. Merge the composition (D −0.0008 is inside the budget and it is what
the frame asks for); the value pass follows. Sheet `fable-5-r49/fable-5-r49-f2-w23-loaf-D.jpg`.

## D. Iteration 14, second item — fable-3 `424478eb` (`agent/fable-3-wood`), WOOD_TINT toward the fences' red-brown

Head `ca562e76` + `424478eb` (`props/materials.ts`, one constant); build + `geometry` test green. Same
eight views. **Six views pixel-identical, `sn-boulder-shotd` pixel-identical**; at `w28-plateau-d` (the
storage corner: crate, barrel top, bucket in the frame's lower right) 61 553 px move by 1 level, 1 908 by
> 2, 101 by > 6 — the whole crate and barrel shift uniformly and imperceptibly.

| surface at `w28-plateau-d` | head | head + tint |
| --- | --- | --- |
| crate lid (0.75–0.95, 0.42–0.60) | rgb 85/76/54, hue 42°, r/g 1.11, b/g 0.71 | rgb 84/74/55, hue 39°, r/g 1.14, b/g 0.74 |
| barrel top (0.40–0.60, 0.70–0.90) | hue 41°, r/g 1.13 | hue 37°, r/g 1.16 |

**Harmless, and an after that looks like its before at the pose.** fable-3 moved the material's tint
r/g 1.30 → 1.37, but the rendered wood moves r/g 1.11 → 1.14 (3–4° of hue): the albedo map and the
light own the colour, the tint constant only nudges it. Against the fence's 27° (fable-3's own number)
the crate still reads yellow-tan at 38–39°. If the crates are to sit with the fences, the move needs
to be ~3× this (or the fence and the crates share one map/tint path); if 3–4° was the intent, it is
in and costs nothing. Merge either way; the read at the pose is unchanged.

## E. Iteration 15 (13:22–14:05 UTC) — structures-32 merged (`cfb0717f`): the log arch as a real tunnel, measured at the V19 poses

Round-49 #1 on my list ("the far forest is cones on a flat plain and the arch is not a tunnel", V19 /
opus #01). Before = head `ca562e76`, after = head `69d16c4f` (structures-32 in); the six fixed views +
`x-arch-approach`, `x-arch-tunnel-n` (the `d_121` pose), `x-arch-tunnel-s`, same positions both.

| view | before → after | SSIM vs reference |
| --- | --- | --- |
| A, B, C, D, E, F | **pixel-identical** | Δ 0 (B −0.0001 is rounding) |
| `x-arch-approach` | 67.5 % of pixels | — |
| `x-arch-tunnel-n` | 94.5 % | — |
| `x-arch-tunnel-s` | 32.3 % | — |

The V19 regions at `x-arch-tunnel-n`, luminance (reference `d_121` / before / **after**):

| region | ref | before | after |
| --- | --- | --- | --- |
| frame mean | 0.141 | 0.395 | **0.147** |
| belly (0–1 × 0–0.20) | 0.121 | 0.301 | **0.090** |
| window (0.28–0.62 × 0.20–0.60) | 0.326 | 0.538 | **0.296** |
| left wall (0–0.2 × 0.25–0.75) | 0.059 | 0.272 | **0.054** |
| right wall (0.8–1 × 0.25–0.75) | 0.072 | 0.440 (there was none) | **0.048** |
| floor (0.2–0.8 × 0.85–1) | 0.161 | 0.465 | **0.105** |
| window : wall | 5.0 | 1.5 | **5.8** |

**V19's tonal half is closed** — every region lands within ±0.06 of the frame, most within ±0.03, and
the contrast that makes a tunnel a tunnel (a bright window in near-black walls) is there from inside
and from the approach. The player now walks into darkness and out toward light, which is the
reference's whole move at 60 s. Sheet `fable-5-r49/fable-5-r49-s32-tunnel.jpg`.

**Still open — the structural half.** Through the window the reference shows tall vertical trunks with
vines, glowing dots and lantern points, and *no ground plane*; ours shows the north path's slabs, the
ledge flight, a signpost and the cones in haze. That is trees-31 / astra-distance and the terrain
north, not structures. Two nits for structures-32: (1) at `x-arch-approach` the right cheek carries a
vertical shading seam at frame x ≈ 0.85 where the near wall section meets the far one (the grain runs
through, the value steps); (2) the floor under the log reads 0.105 against the frame's 0.161 — a
shade too dark now, the cracked-slab floor of `d_121` is readable.

## F. Iteration 16 (14:20–15:10 UTC) — `agent/astra-environment-quality` @ `a9eccd15` (astra-trees / astra-distance / astra-stones), first measurement

Astra's branch sits on the head (`69d16c4f`) — nine commits, `src/`: `hardscape/material.ts`,
`trees/{distant,leaf-cluster-texture,materials,nearCanopy}.ts`, plus fable-2's W24 fix copied in.
tsc + build + `lodPool`/`material` tests green. Rendered as-is against the head, same eight views.

| view | head → astra | SSIM vs reference | budget −0.003 |
| --- | --- | --- | --- |
| A_stairs | 4.3 % | 0.1953 → 0.1947 (−0.0006) | ok |
| B_house | 4.4 % | 0.1956 → 0.1903 (**−0.0053**) | **over** |
| C_lookback | 7.9 % | 0.2265 → 0.2012 (**−0.0253**) | **8×** |
| D_log | 7.3 % | 0.2615 → 0.2524 (**−0.0091**) | **3×** |
| E_ground | 4.4 % | 0.2012 → 0.1975 (**−0.0037**) | over |
| F_canopy | 9.3 % | 0.2445 → 0.2144 (**−0.0301**) | **10×** |
| `w28-plateau-d` | 0.02 % | — | |
| `w27-plateau-u` | 5.7 % | — | |

**Not mergeable as it stands — a six-view regression, five views over budget, C and F by an order of
magnitude.** The cause is in the crops (`fable-5-r49/fable-5-r49-astra-crowns-budget.jpg`): the dark
crown masses at the tops of C (0–0.4 × 0–0.45, 36 % of that cell changed) and F (0.45–1 × 0–0.4, 23 %)
are gone. `3dadc4a3` "replaces nearby flat crown cores with existing layered foliage", and the
foliage that replaces them is sparse, so the haze shows where the canopy was: the changed pixels go
from l 0.21 / sat 0.09 / hue 93° (dark olive canopy) to **l 0.45 / sat 0.02 / hue 123°** at F and from
l 0.20 to **l 0.40** at C — haze-white where the reference frames carry dark canopy (F's top is a dark
crown over the flight, C's top-left a dark mass over the lantern post). D's −0.0091 is the same thing
in the window's crowns. The stones part (`hardscape/material.ts`) is invisible at `w28-plateau-d`
(0.02 %) and I have not isolated the distant atlas (`a9eccd15`) from the near-crown change; the
near-crown change owns C and F by position.

What would make it mergeable: keep the flat cores' *mass* (their l ≈ 0.2 silhouette against the haze)
while giving them the leafy edge — density in the layered foliage, or the core kept behind the clusters
as a dark backing — then re-measure C and F against the head. And a process note for fable-cursor: the
branch carries a **ledger entry, take-0123, sealed on astra's own commit `52841f3c` (36/50)** and a
`claims.json` change; merging it as-is makes an off-head take the "latest sealed take" for every lane's
budget and records a W24 fail the head has already fixed. Ask astra to drop `gauntlet/ledger.json` and
`gauntlet/claims.json` from the branch (or fable-cursor seals take-0123 on the head first).

## G. Iteration 16, second item — fable-3 `73129594` (`agent/fable-3-wood`), WOOD_TINT (2.02, 1.30, 1.12): the second step

Head `69d16c4f` + `424478eb` + `73129594`; build green. **Six views and `w27-plateau-u` pixel-identical**;
at `w28-plateau-d` the crate lid goes hue 42° → **31°** (r/g 1.11 → 1.20, b/g 0.71 → 0.78), the barrel
top 41° → **30°**, luminance held at 0.27–0.28 — the wood now sits beside the fence's 28° instead of a
yellow-tan step away. §D's "3× the move" landed as measured. IMPROVED; merge.

## H. Iteration 17 (15:20–16:10 UTC) — fable-2 `39568e37` (`agent/fable-2-w23-loaf`), the W23 value half on top of the loaf

Head `94b701a0` (tick 195: my §C–§G merged, fable-3's tint, fable-2's W24 fix) + `e5867d7e` +
`39568e37` (`rocks/index.ts`, `rockgen.ts`: `bareToward` keeps the face toward D bare stone, `faceLift`
pales it up to 30 %); build + `rockgen` test green. First pass rendered a stale bundle (built before the
second cherry-pick — caught by grepping the bundle for `faceLift`), rebuilt and re-rendered D and
`sn-boulder-shotd` on head and union at the same positions.

| view | head → head + loaf + value half | SSIM vs reference |
| --- | --- | --- |
| D_log | 0.88 % (6 590 px at (0.09–0.32, 0.55–0.88)) | 0.2612 → 0.2608 (**−0.0004**; the loaf alone was −0.0008) |
| `sn-boulder-shotd` | 18.9 % — the face toward D is bare strata stone, the cap keeps its moss | — |
| A / B / C / E / F (with the loaf, seven-view run) | 0.04 / 0.15 / 0 / 0.13 / 0 % | 0 / −0.0001 / 0 / +0.0003 / 0 |

The face D sees: **l 0.21 → 0.24** (head's fronds 0.26, the frame's bare face 0.27), hue 62°, sat 0.13
(frame: 52°, 0.36); the face box's macro σ 0.072 (frame 0.117). **IMPROVED — half of the value gap
closed, the D cost halved; not closed.** What is left is not luminance: the hue/saturation (moss-grey
against the frame's olive-tan — the `a683a4c1` tint reads too weakly through the lift) and the form
(one plane; §7.2 of `ANALYSIS_VIDEO2.md`: a lit plane + an undercut shadow, macro σ 0.11–0.14). Merge
both commits together; W23 at D stays a fail until the face reads as lit stone.
Sheet `fable-5-r49/fable-5-r49-f2-w23-value-half-D.jpg`.

## Summary for fable-cursor

- fable-4 `5fe58488`: merge; six views Δ 0 (five pixel-identical).
- fable-4 `ea86f8c1`: ~~merge~~ — reverted by fable-4 (a hidden re-roll of 18 outer-ring placements my six-view pair could not see); the lean half of W08 is open again.
- fable-2 `e5867d7e` (the D loaf): merge the composition (D −0.0008, a rock is in the frame); the face reads l 0.21 against the reference's lit 0.27 — the value pass follows.
- fable-3 `424478eb` (wood tint): harmless, pixel-identical on the six views; 3–4° of hue at the pose — unchanged to the eye.
- fable-2 `39568e37` + `e5867d7e` (W23 loaf + value half): merge together; D −0.0004, the face l 0.21 → 0.24 (frame 0.27), hue/sat and form still open.
- **astra-environment-quality `a9eccd15`: do not merge as is** — C −0.0253, F −0.0301, D −0.0091, B −0.0053, E −0.0037: the near crown cores' dark mass is gone; plus an off-head ledger entry (take-0123) on the branch.
- fable-3 `73129594` (wood tint, second step): merge; six views pixel-identical, crate hue 42° → 31° beside the fence's 28°.
- structures-32 (`cfb0717f`, merged): V19's tonal half closed at the `d_121` pose (frame 0.147 vs 0.141, window:wall 5.8 vs 5.0); six views pixel-identical; the window's content is the open half.
