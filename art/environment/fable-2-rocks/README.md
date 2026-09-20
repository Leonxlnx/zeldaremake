# fable-2 — rocks lane evidence (2026-09-19)

## Iteration 2 (goal mode, 2026-09-20) — the north-terrace ledge, opus-review #03

Branch `agent/fable-2-ledge` off the world head `3d50f6c8` (PR #12 merged). BEFORE = that head,
AFTER = `ccd9a22a`, both rendered on this VM at opus-review's walk poses (eye 1.45 m over the
terrain, `.agents/reviews/opus-review-walk/manifest.json`).

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `x-clearing-n`, `x-ledge-foot`, `x-northpath-n` | opus #03 "the raised ledge is a flat olive mound — no rock face, no root ridges, no strata, no damp band" | **PASS** (face, strata, damp band, roots; ferns at the foot are vegetation's) | the layout authors `rockLedges.north-terrace` at the terrace LIP (ground 5.5–5.7 m) while the builder read it as the foot: the head stood a 1.62 m wall on top of the lip, facing the bank (the dark sliver floating over the terrace in the BEFORE) and the clearing saw the terrain's mound. The builder now walks a lip point down the slope to the step's base (foot on the clearing rim at z ≈ −74.2, ground 4.14–4.46), climbs steeply to the lip (24° lean), rolls a mossy quarter-round shoulder back onto the terrace turf, extends the authored line by the taper so the authored span is at full height, drops columns on the `ledge` flight's stairs, and grows root ridges (rounded bark ridges from the lip down the face, thickening back over the shoulder). Face 1.67 m × 4.1 m, 1364 triangles, one draw. |

Six fixed views BEFORE → AFTER: **byte-identical** (sha256 equal on all six; Δ SSIM 0.0000);
draws A 569 (+1: the ledge mesh's bounds enter A's frustum, hidden behind the north rise) /
B 526 / C 393 / D 394 / E 526 / F 512; A 9.09 M tris on both (the head's number, not this
change's — flagged to fable-cursor). Files: `ledge2-x-clearing-n.jpg` (+ `-crop`),
`ledge2-x-ledge-foot.jpg`, `ledge2-x-northpath-n.jpg`.

## Iteration 14 (goal mode, 2026-09-20) — a mid-range detail band for the boulders (owner's "stones under-detailed") — FAIL, reverted

`d4bfed58` → reverted by `f433b104`. The owner's 13:00 UTC re-priority (via fable-cursor's overlap map): "stones
under-detailed", judged at 5–20 m. For rocks that is the far look — the shared material pulls the texture 78 % to
grey and compresses its contrast to 70 %, so boulders past 6 m read as smooth domes. Tried: a 9–30 m band with 12 %
more contrast, the near path's ± 10 % plate patchwork and +40 % normal relief.

| where | result | verdict |
| --- | --- | --- |
| six views, branch `952eb035` → band | Δ SSIM 0.0000 ×5, E −0.0001; **≤ 0.02 % of pixels** per view | an after that looks like its before |
| `x-shotd-8m`, `x-stairfoot-9m`, `x-terrace-13m`, `x-terrace-20m` (new 8–20 m poses) | the hero boulders are behind ferns / bushes / trunks at every one; nothing to judge (`mid14-x-shotd-8m.jpg`) | — |
| `sn-boulder-terrace` (4 m) | the far side of the big rock a touch more mottled (`mid14-sn-boulder-terrace.jpg`) | too little to claim |

**FAIL, reverted.** At 1280 × 720 a ± 10 % plate value on 0.3 m plates at 9 m and 12 % of the texture's contrast are
below the frame's noise; a band strong enough to read would be the "crazed" look the compression exists to avoid.
The honest next step for "stones under-detailed" on rocks is a change in what the far mesh IS (plate geometry at
mid range), which is six-view-exposed and a look change — asked in the INBOX whether the owner's "stones" means the
boulders at all before spending it (the hardscape's stones are Astra's lane now).

## Iteration 13 (goal mode, 2026-09-20) — W24's count, a regression of mine caught and fixed

`51fb6b35`. BEFORE = the head `ca562e76` (the envelope in), AFTER = this build. W24's auto check is
`systems.rocks.pebbles ≥ 2000`; the envelope had left the plaza-side set at **1 822** in the browser (audited) —
the next take would have failed W24. Fix: the audit's `pebbles` is every instanced small stone near path edges /
stair feet / boulder bases (plaza-side + the north paving's set — real stones, distance-toggled like every north
mesh), with `pebblesMain` / `northPebbles` as the breakdown; and the fringe acceptance 0.36 → 0.42 so the plaza-side
set alone clears 2 000 with margin. Browser audit after: total **3 188**, main **2 079**, north 1 109. Per-cell: the
raise adds stones and moves none.

Six views, head `ca562e76` → `51fb6b35`: A +0.0002, B −0.0002, C +0.0006, D −0.0002, E +0.0002, F −0.0001; draws
identical (566 / 522 / 407 / 396 / 522 / 507), triangles +20 K per frame (A 8.60 → 8.62 M); ≤ 0.14 % of pixels per
view. All six within −0.0008 of take-0122.

## Iteration 12 (goal mode, 2026-09-20) — W23 at frame D: the loaf 0.2 m prouder (branch `agent/fable-2-w23-loaf` @ `e5867d7e`)

A D composition change on its OWN branch for fable-cursor's call (fable-5: "yes from the reviewer's side").
BEFORE = the head `e54a74ed`, AFTER = `e5867d7e`: the D boulder's squash 0.64 → 0.72 and no sink (was 15 %
of its height) — ≈ +0.19 m proud; the layout radius and the vegetation's clearRadius untouched.

| frame / pose | before → after | verdict |
| --- | --- | --- |
| `D_log` (7.2 m) | nothing but fronds and a dark sliver → the boulder's moss top and shaded face stand above the fern bank at frame x 0.12–0.3, y 0.55–0.7 (1.01 % of the frame; `loaf12-D_log-boulder.jpg`, with the reference beside it) | **IMPROVED** — a rock is there now; not closed: it reads dark (the face toward D is in the giant's shade; box l 0.316 → 0.300 as more shaded rock replaces lit fern) and the fronds still stand in front (vegetation-26's disc) |
| `sn-boulder-shotd` (2 m) | a sunk lump → a boulder with its moss top above the fern line (`loaf12-sn-boulder-shotd.jpg`) | IMPROVED |

Six views, head `e54a74ed` → `e5867d7e`: A −0.0001, B −0.0001, C 0.0000, **D −0.0007**, E +0.0003, F 0.0000;
draws and triangles identical (566 / 522 / 407 / 396 / 522 / 507; A 8.60 M). Inside the budget; the D cost is
the composition change itself.

## Iteration 11 (goal mode, 2026-09-20) — a path-proximity envelope on the pebble scatter (take-0122's C, W38)

`12dbc604` (+ test `847e91ab`). BEFORE = the branch at `1b394ceb` (head `0990b2c7` + the eight looks), AFTER = this
build. fable-5 bisected take-0122's C −0.0048: −0.0022 of it is my per-cell scatter (`b204778d`) — "the new
path-edge pebbles in C's bottom-left; the reference has bare slab edges and grass there". The old scatter only
sampled ±4.2 m squares around the path polylines' points; the uniform per-cell fringe reached every paved edge
(the plaza rim, the house apron). The scatter now weights acceptance by the distance to the nearest path point
(full to 3.5 m, gone by 5.5 m; the north set ignores it): 935 of 2 445 pebbles go, every other seat identical
(the per-cell property, tested).

| view | BEFORE | AFTER | Δ | tris BEFORE → AFTER |
| --- | --- | --- | --- | --- |
| A_stairs | 0.2179 | 0.2175 | −0.0004 | 8.67 → 8.60 M |
| B_house | 0.2018 | 0.2018 | 0.0000 | 7.83 → 7.75 M |
| C_lookback | 0.2366 | 0.2367 | +0.0001 | 7.01 → 6.94 M |
| D_log | 0.2775 | 0.2775 | 0.0000 | 8.07 → 7.99 M |
| E_ground | 0.2142 | 0.2142 | 0.0000 | 7.83 → 7.75 M |
| F_canopy | 0.2555 | 0.2560 | +0.0005 | 7.99 → 7.92 M |

Draws identical (566 / 522 / 407 / 396 / 522 / 507); ≤ 0.07 % of pixels per view. **Honest read:** the envelope
is a W38 give-back (≈ −70 K triangles in every frame) with neutral SSIM; it does NOT recover C's −0.0022 —
that cost is the re-rolled fringe near the path in C's bottom-left, i.e. the re-roll itself, and thinning that
corner would be tuning to a frame (`c-bottomleft-ours-vs-ref.jpg`: the reference carries grit at those slab
edges too). Left as measured for the reviewer to weigh.

## Iteration 10 (goal mode, 2026-09-20) — opus #16, the joint pebbles as eight looks

`a3c644b2` (`pebbles.ts` PEBBLE_LOOKS + `index.ts`). BEFORE = the head `5e525dea`, AFTER = this build. opus #16
(sev 2, plaza at 1–2 m): "the joint pebbles are identical smooth olive ellipsoids" — four detail-1 variants
with one cleave and one olive tint. Now eight looks at the same 80 triangles each: angular chunks (two to
four cleaves, 30° crease normals) and worn cobbles, flat to tall, grey / tan / dark / pale, moss on some;
one instanced draw per look, picked per cell by the scatter (so the seats do not move — only the stones change).

| pose | before → after | verdict |
| --- | --- | --- |
| `w05-spine-d` (1–2 m) | the same seats carry different stones: the olive ellipsoid at the joint fork is a dark faceted chunk, the tan one an angular piece (`peb9-w05-spine-d.jpg`, `-crop`) | **IMPROVED** — variety at the plaza's first steps; the joint soil / moss itself is hardscape-31's |

Six views, head `5e525dea` → `a3c644b2` (this VM): A 0.2174 → 0.2178 (+0.0004), B 0.2018 → 0.2020 (+0.0002),
C 0.2358 → 0.2363 (+0.0005), D 0.2779 → 0.2776 (−0.0003), E 0.2136 → 0.2140 (+0.0004), F 0.2558 → 0.2555
(−0.0003); draws +4 each (566 / 522 / 407 / 396 / 522 / 507), triangles identical (A 8.68 M); 0.9–2.1 % of
pixels per view (the stones' shapes at their unchanged seats).

## Iteration 8 (goal mode, 2026-09-20) — W23 at frame D, "the 7 m value" (fable-5's round-49 #7) — FAIL as a visible change

`a683a4c1`. BEFORE = the head `a329a7d1`, AFTER = this build. fable-5's #7: "the D boulder invisible behind
ferns (W23) — exclusion disc (vegetation-26) + 7 m value (fable-2)". The value half: the D boulder's far
look carried a 40 % cleave darkening on exactly the face camera D sees, a dark collar to 60 % of its
height and a grey-pulled tint, where frame D's boulder is one pale olive-tan loaf (rgb 91/83/45, l 0.32).
Now cleave 0.25, collar to 45 %, tint 0.9/0.85/0.64 (the near skin keeps its own values).

| frame / pose | before → after | verdict |
| --- | --- | --- |
| `D_log` (7.2 m) | the rock is behind the ferns; what shows is the shaded cap edge — visible patch l 0.238 → 0.246, rgb 60/62/50 → 62/64/49; D SSIM 0.2781 → 0.2779 (`dfar8-D_log-boulder.jpg`) | **FAIL as a visible change** — the ferns decide D; the value shift is measured, not seen |
| `sn-boulder-shotd` (2 m) | face core 0.205 → 0.216, a step yellower (`dfar8-sn-boulder-shotd.jpg`) | consistent with iteration 3 |

Six views, head `a329a7d1` → `a683a4c1`: A +0.0002, B 0.0000, C 0.0000, D −0.0002, E +0.0002, F 0.0000; draws
561 / 519 / 403 / 391 / 519 / 501 identical to the head's, A 9.13 M (the head's). Kept: harmless, toward the
reference; W23 at D needs vegetation-26's exclusion disc first (and, if fable-cursor wants the silhouette
over the ferns, the loaf 0.2 m prouder — a D composition change I have not made). Note for fable-cursor:
C reads 0.2328 on the head against take-0121's 0.2372 (−0.0044) before any of this.

## Iteration 7 (goal mode, 2026-09-20) — the wall at 3–7 m, fable-5's second pass

`71b64670`. BEFORE = the head `89473888` (round 48 + the goal-mode merges: ferns at the wall's foot,
the terrace rail, moss on the flight are other lanes'), AFTER = this build.

| pose | fable-5's note (`.agents/reviews/fable-5-r48-branches.md` §I) | what changed | verdict |
| --- | --- | --- | --- |
| `x-clearing-n` (7 m), `x-ledge-wall` (3 m) | "the beds read as chunky angular facets more than thin strata — a finer bedding frequency on the upper face" | the beds thin toward the top of the face (a full bed at the foot, 55 % under the lip) and the block offsets / ridged skin shrink with them | upper face layered, base heavy (`wall7-x-clearing-n.jpg`, `-crop`) |
| same | "the bark roots are still not readable as roots at 3 or 7 m" | bark a warm mid brown (0.36/0.25/0.14; the dark bark read as more stone against the near-black damp face), matte where the stone is wet, R 0.1–0.16, ridge ×1.2 | separates in value and hue now; whether it reads as a root is fable-5's call |
| `x-ledge-wall-foot`, `x-clearing-n` | "the new strata slabs are very pale (l ≈ 0.6 against the wall's 0.2) — clean limestone next to damp stone" | the foot slabs take the wall's damp dark tint (0.27/0.28/0.28) with a deep soil collar (dirt 0.9, band to 0.7), the east bank's slabs a shade darker (0.36), the scree a deeper collar | seated, not limestone (`wall7-x-ledge-wall-foot.jpg`) |

North locality only (under the north toggle). Check on this VM: fixed views A and D (the two that face
north) captured at the branch just before this commit (`45199d08`) and after (`71b64670`) — **byte-identical**
(A 561 draws / 9.13 M, D 391 / 8.52 M both). Against the head `89473888` the branch differs in A by 0.06 %
and D by 0.15 % of pixels — iteration 6's pebble re-roll on this head, not the wall.

## Iteration 6 (goal mode, 2026-09-20) — per-cell pebble scatter, GOAL_MODE fable-2 #4

`113f59b6` (`src/world/rocks/pebbles.ts`). BEFORE = the head `41d59706` (fable-cursor's north-locality
toggle in), AFTER = this build. An engineering item: the old scatter drew every candidate from one
sequential stream, so any paving edit re-rolled every pebble world-wide (round 47's whole camera-D
delta). Now every candidate is a lattice cell with stateless per-cell draws — a 0.1 m lattice on the
paving's centimetres-wide fringe inside the coarse 0.5 m cells that touch paving, the coarse lattice
for the sparse scatter within 4 m of paving. Calibrated to the old population (2 590 vs 2 600 at
density 1); the north paving's ≈ 1 000 pebbles are a separate `pebbles-north` set under the
north-locality toggle; stair-foot pebbles hash per (flight id, index).

| pose | what it shows | verdict |
| --- | --- | --- |
| `w05-spine-d`, `w16-spine-d` | the plaza's joint pebbles re-rolled once — same population, same character, different seats (`pebbles6-w05-spine-d.jpg`, `pebbles6-w16-spine-d.jpg`) | the one-time re-roll this scheme costs |
| `x-northpath-edge` p (2, 5.45, −64.5) → t (−0.5, 4.0, −67.5), `x-northpath-n` | the north paving's fringe carries pebbles for the first time (`pebbles6-x-northpath-edge.jpg`) | new |
| `pebbles.test.mjs` | a paved disc added at (3.5, 8) on a synthetic strip changes > 10 pebbles around it and **none** beyond 6 m; per-flight stair streams; the north split | **PASS** — the property the item asked for |

Six fixed views, head `41d59706` → `4d363760` (this VM, `capture.mjs --settle 12`): A 0.2195 → 0.2195,
B 0.2042 → 0.2061 (+0.0019), C 0.2393 → 0.2374 (−0.0019), D 0.2794 → 0.2793 (−0.0001), E 0.2146 → 0.2163
(+0.0017), F 0.2601 → 0.2607 (+0.0006) — the one-time re-roll, every view within the −0.003 budget (vs
take-0118 the worst is C −0.0021); 2–4.6 % of pixels per view (the joint pebbles), draws 567 / 525 / 393 /
392 / 525 / 511 identical to the head's, camera A 8.99 M (the head 9.00 M; the north set is toggled off).
From here on a paving edit by any lane moves only the pebbles within ~6 m of it.

## Iteration 5 (goal mode, 2026-09-20) — the north clearing's rock dressing, GOAL_MODE fable-2 #3

`e070771d` + `7bf69c21` (`src/world/rocks/clearing.ts`). BEFORE = the head `6c4415f8`, AFTER = this
build; poses: opus's `x-clearing-n`, plus `x-clearing-west` p (−1.5, 5.45, −69.8) → t (−7, 5.3, −69.4),
`x-ledge-flank-e` p (−0.3, 5.45, −71.2) → t (3, 4.9, −74.3), `x-ledge-wall-foot` p (1.6, 5.45, −72.2)
→ t (−1.6, 4.5, −74.5).

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `x-clearing-west` | round-47 handoff: a boulder pair on the clearing's west bank; V20's "pale boulder pairs at a bank's foot" | **PASS** | a pale weathered loaf (r 0.52, tint 0.76/0.75/0.68) with a companion (r 0.33) against its flank, half-buried in the bank 0.5–1.3 m outside the paved disc, moss-capped, on the west bearing (`clearing-x-clearing-west.jpg`, `-crop`) |
| `x-ledge-flank-e`, `x-clearing-n` | scree at the ledge flight's flanks; half-buried strata along the terrace face | **PASS** | 11–14 angular blocks per flank (fist to knee-sized, the biggest at the foot corners) in a band 0.6–1.4 m off the treads — the hardscape's edging cheeks hold the first 0.6 m, and the first build's shards inside them were invisible; 6–7 bedded slabs on the undressed east bank and three at the wall's foot west of the flight (`clearing-x-ledge-flank-e.jpg`, `clearing-x-clearing-n.jpg`, `clearing-x-ledge-wall-foot.jpg`) |

One merged mesh under the hero (near) material, ~49 k triangles, one draw, drawn only within
`CLEARING_DRAW_M` 45 m of the clearing (the fixed cameras are 60–70 m off behind the north rise;
the first build sat in their frusta and cost +2 draws / +0.14 M tris for nothing). Positions from
the layout's `northClearing` / `stairs.ledge` / `ledgeTerrace`; every piece seated on the
heightfield, off the paving, treads and pads; own fork — the ≤ 45 m scatters are untouched.
Tests: `clearing.test.mjs` (deterministic, attributes, counts, seats, the pair's bank, buried
bases, null without a clearing).

Six fixed views, head `0987e060` → `7bf69c21` (this VM, `capture.mjs --settle 12`): Δ SSIM 0.0000 ×6
(A 0.2195, B 0.2042, C 0.2393, D 0.2794, E 0.2146, F 0.2601), C and F byte-identical, A/B/D/E the
near-shader flips of iteration 3; draws 577 / 535 / 393 / 402 / 535 / 516 and A 9.08 M tris — the
head's numbers exactly (without the 45 m toggle the mesh cost +2 draws / +0.14 M tris at A / B / D / E).

## Iteration 4 (goal mode, 2026-09-20) — the north-terrace wall at 3 m, fable-5's review

`2f741068`. BEFORE = the merged head `0987e060` (iteration 2 in), AFTER = this build, at fable-5's
`x-ledge-wall` p (−1.2, 5.45, −73.6) → t (−1.2, 5.4, −76.7) and opus's `x-clearing-n`.

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `x-ledge-wall` (3 m), `x-clearing-n` | fable-5 (`.agents/reviews/fable-5-r48-branches.md` §fable-2): "one smooth boulder — no strata, no damp band, roots the rock's own tone; the terrace's pale cut shows above the crest at the west end" | **IMPROVED → for re-review** (strata, damp band, bark roots, slab crest, the cut hidden where the face runs; the pale patch further west at x < −4.5 is beyond the authored line) | the end columns sink into the bank instead of losing height (the lip stays on the terrace top); beds 0.3–0.45 m stepped ±0.2 m with dark partings; the damp band baked into the vertex colour and the ledge material's wet term raised to `LEDGE_DAMP` 1.6; roots as bark (0.22/0.15/0.09, ribbed tone) 1.1 per 3 m, slim over the shoulder; the shoulder broken into slabs by the joints under a moss sheet, the lip 0.2 m proud |

Files: `ledge3-x-ledge-wall.jpg`, `ledge3-x-clearing-n.jpg`.

Six fixed views, merged head `0987e060` → `2f741068` (iterations 3 + 4 together; this VM,
`capture.mjs --settle 12`): SSIM A 0.2195 → 0.2195, B 0.2042 → 0.2042, C 0.2393 → 0.2393,
D 0.2794 → 0.2794, E 0.2146 → 0.2146, F 0.2601 → 0.2601 (Δ 0.0000 ×6; all within −0.0014 of
take-0118, the head's own distance); C and F byte-identical, A/B/D/E differ in 0.02–0.11 % of
pixels (≤ 0.0094 % beyond 8/255) — the recompiled near shader on the hero rocks, as in PR #12.
Draws A 577 / B 535 / C 393 / D 402 / E 535 / F 516, identical to the head's.

## Iteration 3 (goal mode, 2026-09-20) — the shot-D boulder's value at 2 m, opus-review #10

Same branch, `20513c24`. BEFORE = the head `3d50f6c8`, AFTER = this build, survey-2 poses.

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `sn-boulder-shotd` | opus #10 "an unreadable dark mass with two black cavities at 2 m" | **PASS on the value (the cavities went with PR #12); the absolute level of the spot is the lighting's** | probes at the pose (`probe-shotd-value.jpg`: control / white lit rock / final albedo unlit / vertex colours unlit): a white rock renders sRGB 0.47 in this light, our face 0.166 against ferns at 0.21, while the reference's frame D has its boulder at parity with the ferns beside it (0.32 both); the normal map, roughness and the near colour terms each changed nothing measurable. Near path only: the stone tile lifted ×1.35 and warmed toward the reference's olive-tan, the wet band 0.7/0.72/0.78 (was 0.56/0.6/0.68), grime 0.55, the D skin's cleave darkening 0.4 → 0.12 (near build; the far mesh keeps 0.4), the blanket's shaded rim lifted a quarter. Face core 0.166 → 0.205 (ferns 0.213), rgb 41/44/34 → 51/54/40, luminance deciles 77/19/3 → 54/39/7. |
| `sn-boulder-stairfoot`, `sn-boulder-terrace` | regression check | no regression | the exposed stone a shade paler and warmer; moss rims a little lighter; nothing blown out (`stairfoot2.jpg`, `terrace2.jpg`) |

Files: `shotd2.jpg`, `shotd2-crop.jpg`, `probe-shotd-value.jpg`, `stairfoot2.jpg`, `terrace2.jpg`.

Six fixed views BEFORE `3d50f6c8` → AFTER `20513c24` (`capture.mjs --settle 12`, this VM): SSIM
A 0.2195 → 0.2195, B 0.2042 → 0.2042, C 0.2393 → 0.2392, D 0.2792 → 0.2792, E 0.2144 → 0.2144,
F 0.2601 → 0.2601 (Δ ≤ 0.0001); draws 569 / 526 / 393 / 394 / 526 / 512 unchanged. Pixels
differing 0.00–0.12 % per view, ≤ 0.0094 % by more than 8/255 (max Δ 43 at D) — the recompiled
near shader's numeric noise on the hero rocks, as in PR #12 (the near terms end at 6.3 m; camera
D is 7.22 m from the boulder's centre).

## Iteration 1 — PR #12

Lane `src/world/rocks/**` (PR #12, `agent/fable-2-rocks` → `cursor/kokiri-world-phase1-f65e`).
BEFORE = the world branch head `d06e2753` (take-0116's world), AFTER = this branch's final
build, both rendered on the same VM through the capture API at the survey-2 poses
(`art/environment/survey2/manifest.json`, `broll`-style, 1280×720, settle 8, character hidden)
and at the six fixed views (`capture.mjs --settle 12`). Sheets are BEFORE | AFTER at the exact
pose; crops are ×2 of the region the survey pointed at.

## Survey-2 items

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `sn-boulder-shotd` | #32 polka-dot lichen + black hole on top; #19 black holes / slate seams | **PASS** | the black "holes" were the moss cushions of the near kit rendering as black domes (their vertex colours were palette greens in linear ≈ 0.05, multiplied into the moss path) — pale neutral vertex colours now; the pale disc plates are gone and the flecks fade out at near range for a crust field baked per vertex (colonies inside the plates, stopped at the joints, torn edges, dark damp rim); the plate colour joints are 40 % of their old width; the crown's parting pit is damped; the crack furrows are kept |
| `sn-boulder-stairfoot` | #17 flat pale face + angular low-poly shard fringe; #25 shard skirt | **PASS** | the fringe was the rock's own 12 cm moss blanket switching on and off at every micro-relief ridge and crack line (a stack of hard-edged slabs); the near build's swell follows a low-frequency normal without the crack term (blanket cliff edges 1728 → 608 in the test), the near skin is smooth-shaded (40° crease, smaller chips / plate steps / micro), the skirt stones are weathered cobbles with 14 smaller half-buried shards on the heightfield, the face carries chalky crust patches instead of the blotches |
| `sn-boulder-terrace` | #19 black polygons | **PASS** | same cushion fix (the big rock carries 40 pads) |
| `ledge-path`, `ledge-face` (new poses, ref-04) | owner ref-04: tall rock ledge right of the north path | preview | `rocks/ledge.ts` — damp dark stone in undulating beds with staggered joints, overhanging mossy lip, moss sheets on the bed tops and under the lip, wet foot band + drip streaks; heightfield-seated foot and top. Rendered with `?rockLedgePreview=1` at the north path's east bank; the shipped position is expansion-1's `layout.rockLedges` |

## Six fixed views (A–F)

`capture.mjs --settle 12` + `compare.mjs` on this VM, BEFORE `d06e2753` → AFTER (budget: each
view within −0.003 SSIM of take-0116; draws ≤ 700). The far builds are byte-identical by
construction (every new rockgen option defaults to the old behaviour; asserted in the tests).

| view | take-0116 | BEFORE | AFTER | Δ | draws |
| --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2252 | 0.2251 | 0.2251 | 0.0000 | 521 |
| B_house | 0.2029 | 0.2025 | 0.2025 | 0.0000 | 479 |
| C_lookback | 0.2354 | 0.2356 | 0.2356 | 0.0000 | 363 |
| D_log | 0.2788 | 0.2791 | 0.2791 | 0.0000 | 354 |
| E_ground | 0.2138 | 0.2134 | 0.2134 | 0.0000 | 479 |
| F_canopy | 0.2636 | 0.2628 | 0.2628 | 0.0000 | 468 |

Pixel differences BEFORE → AFTER: 0.05–0.1 % of pixels per view, < 0.015 % by more than 8/255,
all isolated flips on the hero rocks' fleck edges under the recompiled near shader.

## Files

- `shotd.jpg`, `shotd-crop.jpg` — `sn-boulder-shotd` BEFORE | AFTER, full frame and ×2 crop
- `stairfoot.jpg`, `stairfoot-crop.jpg` — `sn-boulder-stairfoot`
- `terrace.jpg` — `sn-boulder-terrace`
- `ledge-path.jpg`, `ledge-face.jpg` — the ledge preview, path pose and face pose
- `probe-shotd-body-vs-dressing.jpg` — the probe that found the holes: near kit | rock body only | dressing only
- `probe-stairfoot-body-vs-kit.jpg` — the probe that found the fringe: control | rock body | kit | far geometry
