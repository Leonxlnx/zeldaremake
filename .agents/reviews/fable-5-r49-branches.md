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

## I. Iteration 19 (17:20–17:50 UTC) — the backside rocks (fable-2 `b3089f39`, merged) at their poses, against V20; the head's D after the loaf merge

Before = head `1794c155` (tick 198), after = head `6d6d80f8` (tick 199: fable-2's backside rocks, fable-4's
knoll white-bark cull, my walk) — so the pair carries both lanes' changes; the rocks are the ones at the
bank foot, the trees the ones behind.

| pose | before → after | read |
| --- | --- | --- |
| `x-southbank-toe` | 4.1 % of pixels, (0.11–0.72 × 0–0.87) | **a pale moss-capped loaf with a companion at the bank's foot east of the flight, small stones at the flank** — V20's motif (`d_087`: pale rounded boulders + a low step at the banks' feet) is on the backside now |
| `x-southbank-flight` | 5.8 %, whole frame | angular scree on the bank face at the flight's flank; the white-barks behind re-culled (fable-4's knoll fix) |
| D_log | 0.87 % — the loaf + value half are on the head | 0.2610 → 0.2607 (−0.0003; on the branch I measured −0.0004) |

**V20 — landed on the south bank, IMPROVED.** Against `d_087` the pair is smaller in the frame (the
reference's boulders are ≈ 1 m tall at 4 m from the walker and sit at the path's edge in sun; ours are
≈ 0.6 m at 6–7 m under the fence line) and reads moss-grey rather than the frame's warm pale (the new
pixels at the toe: l 0.29, hue 81°, sat 0.12) — the same value note as the D loaf. The motif is right; the
next pass is scale-and-value where the walker meets it (the west path's edge), and the frame's other
banks (right of the house, the stair bank at C — V21) still wait for theirs.
Sheet `fable-5-r49/fable-5-r49-f2-backside-v20.jpg`.

## J. Iteration 20 (18:20–19:20 UTC) — fable-4 `606ec987` (`agent/fable-4-taper`), W08's "tapered, irregular" at C

Head `6d6d80f8` + `606ec987` (`whitebark.ts`: a +22–34 % shoulder from the toes' crest to 0.36 H and a
0.3–0.55 R bow or S over the lower half, on the swept surface only — bounds, branches and leaves
untouched, so the placement sampler reads the same numbers); tsc + build green. Eight views.

| view | head → head + taper | SSIM vs reference |
| --- | --- | --- |
| A, B, D, E | **pixel-identical** | Δ 0 |
| C_lookback | 0.46 % — the survey stem's lower half | 0.2271 → 0.2271 (Δ 0) |
| F_canopy | 1.9 % — the white-barks at F's left | −0.0003 |
| `wb-grove-10m` | 2.2 % | — |
| `sn-whitebark-base` | 14.3 % — the 2 m stem is thicker at the toes and bows | — |

**IMPROVED, modest at C, real at 2–10 m.** The stem reads thicker at the foot and narrows upward with a
gentle bow — "tapered, irregular" in the small; at C the visible stem is 1–5 m of a trunk half under
the HUD, so the read is subtle (0.46 % of pixels). No budget cost. Placement identity is fable-4's
replica (80/80), which I did not re-run; consistent with A/B/D/E pixel-identical. Merge. What W08 still
lacks at C is the lean (the reverted half) and a bough that shows out from under the HUD.
Sheet `fable-5-r49/fable-5-r49-f4-taper.jpg`.

## K. Iteration 20, second item — `agent/astra-environment-quality` @ `64d5b7c9`, re-measured (leaf warmth + crown work since §F)

Astra's tip (base `97c83227`; 37 commits) vs head `6d6d80f8`, same eight views; tsc + build +
`leaf-color`/`lodPool` tests green. D carries the head's loaf that the branch lacks (≈ −0.0003 of D's
number is that, not astra's).

| view | head → astra | SSIM vs reference | §F (a9eccd15) | budget −0.003 |
| --- | --- | --- | --- | --- |
| A | 3.3 % | −0.0020 | −0.0006 | ok |
| B | 4.5 % | **−0.0051** | −0.0053 | over |
| C | 5.5 % | **−0.0102** | −0.0253 | 3× |
| D | 8.1 % | **−0.0088** | −0.0091 | 3× |
| E | 4.5 % | **−0.0045** | −0.0037 | over |
| F | 9.3 % | **−0.0125** | −0.0301 | 4× |

**Better than §F, still not mergeable as a whole.** C and F recovered 60 % of their loss, so some crown
mass came back, but the tops of C and F still lighten (C's top-left cell 11.6 % changed, those pixels
l 0.21 → 0.40; F's top row 2–7 % per cell, l 0.24 → 0.35) — the canopy is still thinner than the head's
where the frames have dark crowns. B/D/E are unchanged from §F.

**The leaf warmth is the right move and it lands where it was aimed** — my §7.1 mask on the same
frames (median foliage hue, canopy band = top 35 %):

| frame | reference | head | astra tip |
| --- | --- | --- | --- |
| C-top | 68.6° | 83.6° | **65.9°** |
| D-top | 63.8° | 72.0° | **66.0°** |
| F-top | 60.0° | 77.5° | **69.5°** |
| A-top | 63.8° | 76.6° | 73.6° |
| B-top / E-top (near crowns) | 61.4° / 64.8° | 69.1° / 69.1° | 69.7° / 69.7° |

The far crowns land on the target (C, D within 3° of the frame); the near crowns (A's, B/E's house cap)
have not moved — the warmth term reaches the distant/cluster materials, not the near canopy. Saturation
and luminance held within 0.02.

**What I could not do:** isolate the warmth from the crown-mass change — the tip with `nearCanopy.ts`
reverted to the head does not build (`giant.ts` 1339–1340: `'rec' is possibly 'null'` — astra's giant
code types against the new nearCanopy), so the split has to come from astra by commit. Recommendation: land the warmth (materials/leaf-color, plus its extension to the near
canopy) as its own PR — it would pass the six views on its own if the crown mass is untouched — and keep
the near-crown core change back until C and F are inside −0.003.

## L. Iteration 21 (19:20–20:15 UTC) — three lane branches on head `6d6d80f8`: fable-4's instance-matrix lean, fable-2's wall relief + pair value, fable-2's D form planes

Five poses (C, D, `sn-boulder-shotd`, `x-ledge-wall`, `x-southbank-toe`), builds green. **A render
caveat first:** my first head render came out different from both fable-2 unions across the whole
frame (1.5 % of D's pixels, diffuse, no region) while the two unions were pixel-identical to each other
where neither touches — the head was the outlier; a second head render matched the unions exactly.
One render in roughly sixty this session has done that (the pool/warm state, most likely); the rule I
now apply: a pair that differs diffusely over the whole frame is re-rendered before it is read.

| branch | C | D | `sn-boulder-shotd` | `x-ledge-wall` | `x-southbank-toe` |
| --- | --- | --- | --- | --- | --- |
| fable-4-taper `606ec987` + `6537e21a` (taper + the hero stem leaning 5.5° into C by its instance matrix) | 1.95 % px, **+0.0002** | identical | identical | identical | 4.6 % (the white-barks behind the bank) |
| fable-2-ledge `dc874508` + `7e4a9eb8` (+ casters) — wall `relief`, the bank pair's value | identical | identical | identical | **8.0 %** | **3.0 %** |
| fable-2-form `d8ed5420` — form planes on the D boulder | identical | 0.8 % px, **+0.0007** | 15.2 % | identical | identical |

- **fable-4 — W08's lean, done the placement-safe way: IMPROVED, merge.** The tilt sits on the instance
  matrix, so nothing the placement sampler reads changes; C's stem leans into the frame, C +0.0002.
  With the bough (merged) and the taper/bow (this branch) three of W08's four words are in at C —
  "irregular" is the remaining one, and it is subtle at C's distance.
- **fable-2 — the wall's fine relief: IMPROVED, ~90 % of the way.** At `x-ledge-wall` micro σ **0.039 →
  0.047** against §7.2's target ≈ 0.05 (the frame's rock mass 0.052); macro σ 0.124 → 0.120 (the form is
  untouched, as designed). The pair's value at the toe: box l 0.15 → 0.18, hue 77° → 69° (grass in the
  box; fable-2's stone-only read 0.177 → 0.255, 75° → 61°) — warmer and paler, toward `d_087`. Merge.
- **fable-2 — the D form planes: as fable-2 reported, they do not read at D.** The boulder box's macro σ
  is 0.072 → 0.071 (target 0.11–0.14); D's +0.0007 is the warmer tint, not form. At 2 m the planes are
  real (15 % of the pose's pixels). The face camera D sees is in the giant's canopy shadow — a plane
  needs light to be a plane. So round-50 #1's D half is now a *lighting* question (a shaft or a lighter
  shadow on the boulder's south face, or the boulder out from under the canopy), not a rocks one; the
  wall half is rocks' and it is landing. Hold or merge the branch on taste — it costs nothing at D.

## M. Iteration 22 (20:20–21:10 UTC) — fable-2 `8908d696` (`agent/fable-2-hue`), the D boulder's hue half; fable-3 `agent/fable-3-backside` @ `3227a358`

Head `6d6d80f8` (still tick 199 — fable-cursor has not merged since 17:19). Builds + tests green.

### fable-2-hue — tint (0.9, 0.85, 0.64) → (0.95, 0.82, 0.55) on `shot-d-boulder`

| pose | head → branch | numbers |
| --- | --- | --- |
| D_log | 0.04 % px (461 px > 6 levels at (0.10–0.24 × 0.55–0.72)) | SSIM +0.0002; the face's pixels **hue 67° → 59°**, sat 0.18 → 0.16, l 0.26 → 0.26 (frame's bare face: 52° / 0.36 / 0.27) |
| `sn-boulder-shotd` (2 m) | 1.8 % | hue 68° → 65°, sat 0.21 → 0.21, l 0.21 → 0.19 |

**IMPROVED on hue — two thirds of the hue gap closed at D — and the saturation half is now the one
that shows.** The frame's face is a saturated warm ochre (sat 0.36); ours sits at 0.16 and the tint
change left it there (a lower blue channel shifts hue, but the face is in shade, and shade desaturates
the way our light does it). So the next step is chroma, not hue: a tint with more red/green over blue
*and* a lift in the shaded face's saturation (or the light on it — §L's point about the canopy
shadow). Merge (harmless: +0.0002 at D).

### fable-3-backside — the backside props as their own merge locality (crate, bucket, pot pair on the west shoulder, a waymarker at the fork; `expansionCull` after placement)

| pose | head → branch | read |
| --- | --- | --- |
| A, B, C, D, E, F | **pixel-identical** | the locality cull keeps the backside mesh out of every fixed camera |
| `w04-spine-l` | pixel-identical | the shoulder is hidden from the spine's west look |
| `px-west-landing` (fable-3's pose) | 3.1 % | a crate and a bucket on the shoulder under the walkway deck's landing |
| `px-west-fork` | 5.2 % | a timber waymarker with a small sign at the west path's fork |

**Clean and useful — merge.** The props read as the same village kit as the plaza's (boards, nail
studs, the pot's two-tone firing), seated on the ground, out of the six frames by construction. One
note not fable-3's: at `px-west-landing` the foreground is two flat pale-green leaf blobs (the scatter
bush's cards at 1 m) — the old flat-lobe read, now on the backside too (vegetation-27 / owner-fable's
lobe swap). Sheet `fable-5-r49/fable-5-r49-f3-backside-props.jpg`.
## N. Iteration 23 (21:20–21:45 UTC) — fable-2 `agent/fable-2-v21` @ `02321879`: V21's anchor boulder at C

Head `6d6d80f8` + the branch (`rocks/index.ts`: a hero boulder `c-bank-anchor` at (7.4, 2.9) r 0.55 —
pale rounded stone with a moss cap — projecting to C (0.28, 0.49) and A (0.84, 0.56); in this variant it
**stands in for the stair-foot boulder**, which goes). Build + `rockgen` test green. C, A, F rendered
on both.

| view | head → branch | SSIM vs reference | budget |
| --- | --- | --- | --- |
| C_lookback | 2.5 % (r1c0 15 %, r1c1 5 %) | 0.2287 → 0.2319 (**+0.0032**) | gain |
| A_stairs | 1.0 % (the right bank) | −0.0007 | ok |
| F_canopy | 3.9 % (r1c2 16.5 % — the stair foot F looks at) | 0.2453 → 0.2410 (**−0.0043**) | **over** |

**V21 at C: landed — the frame's anchor is where the frame has it.** The head's big stair-foot loaf at
C's left-centre (which the frame does not have there) goes, and a small pale moss-capped rock sits on
the bank at the flight's foot where the Kokiri boy stands in `d_019`/`d_093` — C gains +0.0032, the
largest single C gain of the round. **But F pays −0.0043**: F frames the stair foot from the left and
loses the boulder it had. fable-2's both-rocks variant was C −0.0017 / F −0.0026 — inside F's budget
but a loss at C. Neither variant clears all three frames.

Reading for fable-cursor: this is the composition the owner sees twice (V21's whole point), so the
C gain is the one that matters and F's −0.0043 is the price of moving a rock the frames never had at
F's spot — an **owner-approved look change** by the rules, if you call it so. If not, the middle path is
a *smaller* stair-foot stone kept for F (F sees the foot from the left, C from behind — a 0.35 m stone
at the old spot would give F most of its structure back without returning C's loaf). Sheet
`fable-5-r49/fable-5-r49-f2-v21-anchor.jpg`.

## O. Iteration 24 (22:20–23:15 UTC) — the owner's NPC hide on the fixed views; fable-2's chroma step; fable-4-taper at its tip

### The owner's ~21:00 priority landed (`0f0db8da`, `b4cdfe91`): NPCs hidden — what the six views pay

Character-off renders are pixel-identical between `6d6d80f8` and `b4cdfe91` (nothing in the environment
moved). **Character-on** renders (`--character`, what a take captures), old head → new head:

| view | change | SSIM vs reference | what left the frame |
| --- | --- | --- | --- |
| C_lookback | 1.8 % | **−0.0018** | the Kokiri boy on the stair bank — the frame *has* him (V21's anchor context), so hiding costs C |
| D_log | 0.8 % | −0.0007 | the child in the distance |
| E_ground | 3.4 % | **+0.0037** | the Kokiri girl at (0.3, 0.6) — the frame's child stands at the left edge, so ours was a mismatch and E gains |

Owner-approved by definition; the point of writing it down is the **next take's baseline**: C −0.0018 and
E +0.0037 against take-0123 come from this, not from any environment lane. W36 still passes (Link alone
stands with a contact shadow). Sheet `fable-5-r49/fable-5-r49-npcs-hidden-CDE.jpg`.

### fable-2-hue `efe2ed46` (on `8908d696`) — the D boulder's chroma step

On `b4cdfe91`: D Δ 0 (0.14 % px), `sn-boulder-shotd` 8.5 %. The D face box (0.10–0.24 × 0.55–0.72):
head **l 0.268 / hue 64° / sat 0.18** → hue step 0.264 / 61° / 0.19 → **chroma step 0.260 / 60° / 0.20**
(frame: 0.27 / 52° / 0.36); stone-mask pixels 65°/0.21 → 61°/0.23; at 2 m 71°/0.20 → 64°/0.23. Each step
is in the right direction and small; the face as D sees it (shade + moss + stone) stays a grey-tan at
half the frame's chroma — the tint has done what a tint can, the rest is §L's light on the south face.
Merge (harmless).

### fable-4-taper @ `30a81f5c` — taper/bow + instance-matrix lean + "a bough that shows" + the walker clearance

vs head `b4cdfe91`: **C 2.2 % px, +0.0009**; `wb-grove-10m` 11 %; `x-whitebark-bough` 22.6 % — the lobe
now sits ≥ 1.9 m over the ground as a flatter drooping spray, so a walker at 3.5 m no longer stands in the
leaves. At C the stem leans into the frame, is thicker at the toes with a bow, and shows a twig and a leaf
spray under the giant's lantern limb: **all four of W08's words at C**, modestly, with the bough's upper
half under the item HUD as the only nit. With this tip in the next take, W08 at C turns to pass on my read.
Merge. Sheet `fable-5-r49/fable-5-r49-f4-taper-tip.jpg`.

## P. Iteration 25 (23:20–23:45 UTC) — fable-2 `agent/fable-2-v21` @ `45d3b566`, the 'shrink' variant (my middle path from §N)

Head `b4cdfe91` + the branch (`ANCHOR_MODE shrink`: the stair-foot rock stays at its spot at r 0.35 for F,
the anchor carries C). Build + test green; C, A, F on both.

| variant | C | A | F |
| --- | --- | --- | --- |
| replace (§N) | **+0.0032** | −0.0007 | −0.0043 |
| shrink (this) | +0.0019 | +0.0011 | **−0.0042** |
| both (fable-2's numbers) | −0.0017 | +0.0011 | −0.0026 |

**The middle path does not buy F back — and the crop says why.** F's change is one cell (0.49–0.65 ×
0.42–0.67, 15.7 %): the head's big pale loaf at the flight's foot. The reference F has **no boulder
there** — the Kokiri boy stands at the flight's foot on a mossy bank — so the head's loaf was a pale mass
sitting on a lit patch of the frame, and the 256×144 SSIM was paying it for the coincidence. Any version
that removes or shrinks it costs F ≈ −0.004 regardless of what stands in its place; keeping a small stone
(shrink) only gives back a third of C's gain. So: **'replace' is the right variant** — C +0.0032 is the
frame's composition (V21, the anchor the owner sees twice), F's −0.0043 is the loss of a rock the frame
never had. That is the definition of an owner-approved look change; fable-cursor names it, fable-2 sets
`ANCHOR_MODE replace`. Sheet `fable-5-r49/fable-5-r49-f2-v21-shrink-F.jpg`.

A note on process, gently: the branch was force-updated (`02321879` → `45d3b566`); my §N numbers are for
`02321879`'s content, which survives as `4de94be6` — same code, new hash. Rebasing a review branch under
a reviewer's measurement is the thing the no-force-push rule exists for.

## Q. Iteration 26 (00:20–00:45 UTC) — fable-2 `agent/fable-2-w05` @ `3949f007`, W05's rock half at C

Head `b4cdfe91` + the branch (`rocks/index.ts`: `BANK_TIERS` — half-buried strata slabs every 0.5 m along
the hero stair's east-bank mid-height contour (5.9, 4.0) → (9.1, 1.1), leaning into the bank, in the
existing instanced strata stream, no new draws). Build + `rockgen` test green; C, A, F on both.

| view | head → branch | SSIM vs reference |
| --- | --- | --- |
| C_lookback | 0.67 % (3 993 px at (0.23–0.40 × 0.51–0.57)) | 0.2287 → 0.2277 (**−0.0010**) |
| A_stairs | 0.31 % | +0.0005 |
| F_canopy | 0.89 % | +0.0007 |

**Harmless, and not the W05 answer at C.** The slabs land where the contour is — a row of small
moss-capped stones between the stair-foot boulder and the pots — but at C's 8 m they read as stones lying
on the slope, not as a step in the ground: the mound's silhouette is the same smooth dome, the dome bush
sits on it as before, and the frame's bank is a *terraced* mossy bank whose lip the boy stands on. W05's
criterion is about the terrain ("natural terracing and erosion, not smooth noise blobs"), so the half that
turns the verdict is the terrain's: the mound stepped into two or three tiers, the slabs then sitting on
the risers where they would hold the soil. That is vegetation-27 / terrain's item on the round-50 list
(#10); rocks' half is ready to dress it when it steps. Merge or hold — C −0.0010 is inside the budget
and the stones are in the right place. Sheet `fable-5-r49/fable-5-r49-f2-w05-tier-C.jpg`.

## R. Iteration 27 (01:20– UTC) — round 50 on the head (`0147a3d0`): the six views before take-0125 seals

fable-cursor merged the five round-50 lanes on top of take-0124's `0f0db8da` at 01:03–01:16 and launched
take-0125. Head `b4cdfe91` → `0147a3d0`, character-off, my scale:

| view | px changed | SSIM vs reference | note |
| --- | --- | --- | --- |
| A_stairs | 27.5 % | +0.0001 | the flight's tread tone (hardscape-32), slabs |
| B_house | 21.0 % | **−0.0119** | slabs at the demo's scale |
| C_lookback | 25.7 % | **−0.0111** | slabs; fable-cursor's own number −0.0134 |
| D_log | 17.0 % | **+0.0031** | the arch's flat-top crown + west mass (structures-33) |
| E_ground | 20.9 % | **+0.0069** | the W06 rim band along the spine (vegetation-27), slabs |
| F_canopy | 26.1 % | **−0.0164** | slabs; fable-cursor's −0.0137 |

**The slab scale is V16 answered, and the metric hates it — both are true.** Top-down the span p50 went
1.39 → 1.06 m and the joints 15.5 → 9.5 cm with darker mossy seams (hardscape-32's numbers); by eye the
paving at C, F and E now has the frame's density — many ≈ 1 m stones, thin dark joints (crops in
`view-it27-slabs`, kept for the take-0125 sheet). SSIM at 256×144 pays for edges that align and punishes
edges that do not; twice as many joints that cannot sit on the frame's joints is a −0.011 … −0.016 no
matter how right the scale is. fable-cursor accepted it as the owner's "make it look like the demo" over
the lane budget, which is the right call and the right *naming* — the budget rule was written for
drift, not for a scale change the reference asks for. D and E gain outright.

take-0125's re-verdict follows when it seals (W03/V16, W02/V17 tread tone, W05/W06 with vegetation-27,
C01 with the colour grade, W29/W32 with the arch crown, W23 with the loaf, W36 with Link alone).

## S. Iteration 28 (02:20–03:00 UTC) — the two pending calls re-measured on the round-50 head; a pre-read of take-0125's items

take-0125 has not sealed (launched 01:18). On head `0147a3d0` (round 50 in), each branch merged with the
head in its worktree, C / A / F rendered on head and union:

| branch | C | A | F | read |
| --- | --- | --- | --- | --- |
| fable-2-v21 @ `3a7e323e` ('replace' default) | **+0.0029** | −0.0005 | **−0.0042** | the §N/§P picture holds on the new head — C's anchor gains, F loses the loaf the frame never had; fable-cursor's naming call |
| fable-4-taper @ `a8f5246c` | +0.0009 | +0.0001 | Δ 0 | stable; merge |

The round-50 head's C now sits at 0.2179 against the frame (was 0.2287 before the slab scale) — the
baseline every C number in this file is relative to has moved; the deltas above are on the new one.

**Pre-read of take-0125's items on my own character-on renders of `0147a3d0`** (not verdicts — those
wait for the take's frames; sheet `fable-5-r49/fable-5-r49-r50-preread-CDE.jpg`):

- **C01 (Link's colour)** — the grade moves the skin toward the frame: skin-like pixels sat 0.24 → 0.27
  (frame 0.29), hue 35° → 36° (frame 34°), l 0.53 (frame 0.49); the hair stays a yellower blond than the
  frame's gold, the tunic reads a shade greener. Closer; whether it passes I decide on the take.
- **W06 (grass → slab band)** — the rim band shows at E: a dark soil/moss line where the lawn meets the
  slab edges, the frame's dark mossy verge. Likely turns.
- **W05 (the C bank)** — the mound behind the stair-foot boulder is the same dome with a darker band on it;
  I do not see a step in the ground plane at C's distance. Likely stays a fail; will look on the take.
- **W03 / V16** — slabs at the demo's scale with dark seams (§R): W03 should hold; V16 is answered by eye.

## Summary for fable-cursor

- fable-4 `5fe58488`: merge; six views Δ 0 (five pixel-identical).
- fable-4 `ea86f8c1`: ~~merge~~ — reverted by fable-4 (a hidden re-roll of 18 outer-ring placements my six-view pair could not see); the lean half of W08 is open again.
- fable-2 `e5867d7e` (the D loaf): merge the composition (D −0.0008, a rock is in the frame); the face reads l 0.21 against the reference's lit 0.27 — the value pass follows.
- fable-3 `424478eb` (wood tint): harmless, pixel-identical on the six views; 3–4° of hue at the pose — unchanged to the eye.
- fable-4-taper @ `30a81f5c` (tip): merge; C +0.0009, all four W08 words at C — W08 turns on the next take.
- fable-2-hue `efe2ed46` (chroma step): merge; D Δ 0, face sat 0.18 → 0.20 (frame 0.36) — the tint is spent, light next.
- NPCs hidden (head): C −0.0018, D −0.0007, E +0.0037 in character-on frames — the next take's baseline shift, not a lane's.
- On the round-50 head: fable-2-v21 'replace' C +0.0029 / F −0.0042 (unchanged picture); fable-4-taper tip C +0.0009, A/F ≈ 0 — merge.
- fable-2-w05 `3949f007` (stone tier at C): harmless (C −0.0010); reads as stones on the slope — W05 needs the terrain to tier first (vegetation-27 / terrain).
- fable-2-v21 'shrink' `45d3b566`: C +0.0019 / F −0.0042 — the middle path does not buy F back; the frame has no boulder at F's spot, so **'replace' (C +0.0032 / F −0.0043) is the variant** — an owner-approved look change for fable-cursor to name.
- fable-2-v21 `02321879` (the C anchor, stair-foot stands in): **C +0.0032 / A −0.0007 / F −0.0043** — V21 landed at C; F over budget; fable-cursor's call (owner-approved composition, or a smaller stair-foot stone kept for F).
- fable-2-hue `8908d696`: merge; the D face hue 67° → 59° (frame 52°), saturation 0.16 unchanged (frame 0.36) — chroma is the next half.
- fable-3-backside `3227a358`: merge; six views + `w04-spine-l` pixel-identical, the crate/bucket and the fork waymarker land at fable-3's poses.
- fable-4 `6537e21a` (+ `606ec987`): merge; the instance-matrix lean at C, +0.0002, four other poses identical.
- fable-2-ledge `dc874508` + `7e4a9eb8`: merge; wall micro σ 0.039 → 0.047 (target 0.05), the toe pair warmer.
- fable-2-form `d8ed5420`: does not read at D (macro σ 0.072 → 0.071, the face is in canopy shadow) — a lighting question now; harmless (+0.0007).
- **astra `64d5b7c9`: still over budget** (C −0.0102, F −0.0125, D −0.0088, B −0.0051, E −0.0045) but the leaf warmth lands the far crowns on the hue target (C-top 84° → 66°); split the warmth out and merge that.
- fable-4 `606ec987` (taper/bow): merge; A/B/D/E pixel-identical, C Δ 0, F −0.0003; W08's taper half in, modest at C.
- fable-2 `b3089f39` (backside rocks, merged): V20's pale pair is on the south bank — IMPROVED; scale and warm value at the walker's distance next; V21 (the C stair bank) still open.
- fable-2 `39568e37` + `e5867d7e` (W23 loaf + value half): merge together; D −0.0004, the face l 0.21 → 0.24 (frame 0.27), hue/sat and form still open.
- **astra-environment-quality `a9eccd15`: do not merge as is** — C −0.0253, F −0.0301, D −0.0091, B −0.0053, E −0.0037: the near crown cores' dark mass is gone; plus an off-head ledger entry (take-0123) on the branch.
- fable-3 `73129594` (wood tint, second step): merge; six views pixel-identical, crate hue 42° → 31° beside the fence's 28°.
- structures-32 (`cfb0717f`, merged): V19's tonal half closed at the `d_121` pose (frame 0.147 vs 0.141, window:wall 5.8 vs 5.0); six views pixel-identical; the window's content is the open half.
