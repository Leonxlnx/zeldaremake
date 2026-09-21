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

## Iteration 32 — the reciprocal prop check: fable-3's backside props vs my rock bodies; the V21 anchor moved off their squat pot — `agent/fable-2-v21` @ `a1dcf4f6`

fable-3 replicated my contour walk to catch a slab on their pots (§29); the reciprocal check, offline on the same
samplers: their backside props (`props/layout.ts` on `agent/fable-3-backside`: west-landing crate / bucket / two pots,
the west-fork marker, the west-door pot) against every backside rock body sphere and the live strata / rubble dump —
**no overlaps**; the closest is a 0.11 m disc pebble 0.25 m from the fork marker's foot (a stone at a post's foot, fine).

The same check on the V21 anchor was not fine: at the box centre (7.4, 2.9) the loaf's ≈ 0.7 m reach ran **0.13 m into
`stair-pot-squat` (7.55, 2.1) r 0.22**. Moved 0.28 m NW along the bank to **(7.2, 3.1)** — 0.12 m clear, ground 0.66,
slope 0.31, C projection (0.30, 0.46): still the V21 box. Re-measured on the round-50 head `0147a3d0`:

| view | head | V21 'replace' at (7.2, 3.1) | (at (7.4, 2.9), §28) |
|---|---|---|---|
| A_stairs | 0.2210 | 0.2206 (−0.0004) | −0.0005 |
| C_lookback | 0.2227 | **0.2263 (+0.0036)** | +0.0032 |
| F_canopy | 0.2451 | 0.2408 (−0.0043) | −0.0042 |
| draws / tris | 440 / 8.61 M, 338 / 6.98 M, 405 / 7.98 M | 440 / 8.60 M, 338 / 6.97 M, 405 / 7.98 M | |

`v21f-C_lookback-triple.jpg`: one pale moss-capped rock behind the pots, clear of them, the loaf gone. The layout proposal
is therefore `heroBoulders` 'stair-foot' → position (7.2, 0, 3.1), radius 0.55.

## Iteration 31 — the embankment strata and rubble skirts take the near skin (2.5–4.5 m fade) — `agent/fable-2-ledge`

The instanced strata (92) and rubble (64) rendered the plain far material at any distance; a walker passes the bank slabs
at 1–3 m. They now share one near-capable material — plates, wet band, lichen crust and the relief grain (1.5) — inside a
short fade `STRATA_NEAR_FADE_M` = [2.5, 4.5]; beyond it they are byte-for-byte the far stones they were (the old far
material is retired: this one with nearW = 0 is it). Rubble beside a hero boulder was already rebuilt by its near kit;
the clearing / backside pieces use `heroMaterial` (§30 reaches them).

**Fixed cameras — nearest in-frustum slab or skirt stone, from the live instance dump:** A 3.16 m (a strata slab at
(3.07, 6.65) in A's foreground), F 5.40, D 6.33, B / E 9.20, C 10.88. So only A can change: **A 0.2210 → 0.2211
(+0.0001), 487 pixels > 8/255**, draws / tris identical. The other five are outside the fade by construction.

**At player height:** most standalone slabs sit under the fern banks (two aimed poses on the D path's east bank show only
ferns — reported, not claimed); where one is exposed — A's foreground slab at 2.5 m (`x-A-slab`, camera (1.0, 1.4, 5.2) →
(3.07, 0.7, 6.65)) — the pale-green mossy blob becomes a stone with a moss cap, pale lichen rim and pitted skin: fine micro
σ 0.041 → 0.045, macro σ 0.098 → 0.117 (`stratanear34-x-A-slab.jpg`). Typecheck / build / 26 tests green.

## Iteration 30 — the hero boulders' near skin takes the relief (owner's "stones under-detailed", at player height) — `agent/fable-2-ledge`

The `relief` material option (§20) was the ledge's only. The hero boulders' near material (and the stair-foot rock's)
now take it at 1.5 — pits and grains at 5–12 cm over rockgen's plates and micro relief, inside NEAR_FADE_M (4.0–6.3 m)
only. Every fixed camera stands past the fade from every hero rock (A 9.7 m from the stair-foot rock, D 6.6 m from the
shot-D boulder, C 4.8 m from it but looking the other way): **A byte-identical (0 pixels), D 68 pixels at ≤ 8/255** —
render noise. Draws / tris identical.

**Fine micro σ (4 px residual) on the stone box 0.30–0.70² at the survey poses:**

| pose (2 m) | head `0147a3d0` | relief 2.0 | **relief 1.5 (landed)** |
|---|---|---|---|
| `sn-boulder-stairfoot` | 0.032 | 0.048 | **0.044** (+38 %) |
| `sn-boulder-shotd` | 0.028 | 0.031 (face went to a dark honeycomb in its shade) | **0.030** |
| `sn-boulder-terrace` | 0.018 | 0.029 | (not re-rendered at 1.5; scales with the term) |

Sheets `nearrelief31-sn-boulder-stairfoot.jpg` (the pale smooth stone is pitted, knapped limestone), `nearrelief31-sn-
boulder-shotd.jpg`, `nearrelief31-sn-boulder-terrace-r2.jpg` (at 2.0). Typecheck / build / 26 tests green.

## Iteration 29 — the tier keeps out of fable-3's pots; branches current with the round-50 head — `agent/fable-2-w05` @ `8812d37b`

fable-3 (01:50) replicated `contourLine` and found two tier slabs reaching their stair-foot pots ('stair-pot' (7.95, 1.8)
r 0.26, 'stair-pot-squat' (7.55, 2.1) r 0.22 — in the sealed A / C / F frames; props build after rocks, so their footprints
are not in `ctx.shared` for me). `keepOut` on the tier def skips the two contour points; the points past the pots fail the
slope filter (the face flattens into the stair-foot rock there), so the tier is the three slabs west of the pots — toward
the frame's terrace edge, where C's box sits. `tiers.test.mjs` asserts no slab within 0.85 m of either pot (24/24 on the
branch). On the round-50 head `0147a3d0` (hardscape's new flagstones: C's baseline is 0.2227 now):

| view | head `0147a3d0` | after | draws / tris |
|---|---|---|---|
| A_stairs | 0.2210 | 0.2220 (+0.0010) | 440 / 8.61 M both |
| C_lookback | 0.2227 | 0.2230 (+0.0003) | 338 / 6.98 M both |
| F_canopy | 0.2451 | 0.2452 (+0.0001) | 405 / 7.98 M both |

fable-5 (00:45) on the tier: "harmless and in the right place, but not what turns W05 — the mound stepped into two or
three tiers is the half that counts (vegetation-27 / terrain); fable-2's slabs then sit on the risers." Agreed; the tier
def takes new contour heights when the bank is cut. All four lane branches (`ledge`, `hue`, `w05`, `v21`) merged with the
round-50 head by merge commit — typecheck, build and tests green on each.

## Iteration 28 — V21 'replace' set as the branch default, final table on the new head — `agent/fable-2-v21` @ `e2a3dc09`

fable-5 23:45: "'replace' is the variant: C +0.0032 is the frame's composition, F's −0.0043 is the loss of a rock the frame
never had — fable-cursor, that is the owner-approved look change to name; fable-2, `ANCHOR_MODE replace`." Done with a
normal commit (no rewrite); the branch keeps `both` and `shrink` as the measured alternatives. Captured on the new head:

| view | head `b4cdfe91` | **replace** | shrink |
|---|---|---|---|
| A_stairs | 0.2213 | 0.2208 (−0.0005) | 0.2224 (+0.0011) |
| C_lookback | 0.2358 | **0.2390 (+0.0032)** | 0.2378 (+0.0020) |
| F_canopy | 0.2606 | 0.2564 (−0.0042) | 0.2565 (−0.0041) |
| draws / tris | A 440 / 8.57 M, C 329 / 6.92 M, F 404 / 7.91 M | identical | identical |

The layout version (`heroBoulders` 'stair-foot' → (7.4, 0, 2.9), r 0.55) is the clean landing; the branch is its measured
stand-in. Also this tick: `tiers.test.mjs` on `agent/fable-2-w05` (the C bank tier walks the face at h 0.5 off paving /
treads, ≥ 5 slabs a spacing apart; the contour walk deterministic).

## Iteration 27 — W05's rock half at C: a stone tier on the hero stair's east bank — `agent/fable-2-w05` (one commit, within budget)

W05 (fail, take-0121, fable-5): "the embankment beside the stair foot is a smooth lawn mound … no terracing, no erosion
channels, no exposed strata; the reference's bank is a stepped mossy terrace." The bank is a 1 m rise from the plaza's
paving to the kokiri-a plateau on a face ≈ 1 m wide; the strata scatter's 0.9 m lattice and its `path > 0.02` exclusion
leave it bare. The rock half: `BANK_TIERS` — half-buried strata slabs along the face's mid-height contour (a `contourLine`
walk from (5.9, 4.0) to (9.1, 1.1) at h 0.5, one every 0.5 m, on slope ≥ 0.25 — six slabs), yawed along the line, leaning
into the bank, pushed into the existing instanced strata stream: **no new draws, no new kit**, own PRNG fork.

| view | head `b4cdfe91` | after | pixels > 8/255 | draws / tris |
|---|---|---|---|---|
| A_stairs | 0.2213 | 0.2217 (+0.0004) | 0.27 % | 440 / 8.58 M (head 440 / 8.57 M) |
| C_lookback | 0.2358 | 0.2348 (−0.0010) | 0.64 % | 329 / 6.93 M (head 329 / 6.92 M) |
| F_canopy | 0.2606 | 0.2613 (+0.0007) | 0.86 % | 404 / 7.91 M (same) |

`w05-C_lookback-triple.jpg` (reference | head | after): the lawn mound right of the pots carries a stepped line of moss-
topped slabs. The terracing / erosion halves of W05 are the terrain's and vegetation-27's; this is the exposed-strata
half. B, D, E do not see the bank. Typecheck / build green; 22/22 tests on the branch (the four backside tests live on the ledge branch).

## Iteration 26 — V21's middle path measured (fable-5 21:45): F does not come back — `agent/fable-2-v21` @ `45d3b566`

fable-5's read of the anchor (C +0.0032, F −0.0043 in their render) proposed the middle path: keep a ≈ 0.35 m stone at the
old stair-foot spot for F's structure, the anchor for C — "F wants a number before either variant merges." Built as
`ANCHOR_MODE = 'shrink'` (the branch now carries `replace | both | shrink`), rebased onto the new head `b4cdfe91` (NPCs
hidden for the owner's review — the before is re-captured there):

| view | head `b4cdfe91` | shrink (anchor + stair-foot r 0.35) | shrink + a full moss cap on the anchor |
|---|---|---|---|
| A_stairs | 0.2213 | +0.0011 | +0.0006 |
| C_lookback | 0.2358 | **+0.0020** | +0.0018 |
| F_canopy | 0.2606 | **−0.0041** | −0.0040 |
| draws / tris (A) | 440 / 8.57 M | 442 / 8.62 M | — |

The full cap (F looks down on the rock's top; reference F has dark moss there) moves F by 0.0001: **F's loss is
structural, not the anchor's value** — F framed the r 1.0 loaf at its top-centre and any variant without that loaf loses
≈ 0.004 there, whatever stands at the boy's feet. Crops `v21c-{C_lookback,F_canopy,A_stairs}-triple.jpg` (reference |
head | shrink). So the decision is the one fable-5 named: V21 as an owner-approved look change (C is the frame the
owner sees twice; C +0.002…+0.003 against F −0.004), or not at all. Not landed; the branch holds the three variants.
(Note: the branch was rebased onto `b4cdfe91` and force-pushed — my own proposal branch, nothing built on it; the SHAs
fable-5 cited, `e1099b41` / `02321879`, are now `210b04f0` / `4de94be6`. I will branch afresh instead next time.)

## Iteration 25 — the D boulder's chroma (fable-5 21:10) — `agent/fable-2-hue` @ `efe2ed46` (two commits now)

fable-5 on `8908d696`: "IMPROVED on hue, merge — two thirds of the hue gap closed; the half that shows now is chroma: the
frame's face is a saturated warm ochre, ours a shaded grey-tan." A grey texture multiply keeps a tint's saturation ratio,
so the chroma loss is the light: the face D sees is in the giant's shade under the bluish sky fill. The tint overshoots
warm to meet the frame there: (0.95, 0.82, 0.55) → **(0.97, 0.80, 0.47)**.

| pose | head `6d6d80f8` | step 1 `8908d696` | **step 2 `efe2ed46`** | frame |
|---|---|---|---|---|
| D_log, the boulder's box (stone pixels) | 59° / sat 0.274 / l 0.290 | 55° / 0.315 / 0.288 | **53° / 0.350 / 0.285** | 52° / 0.36 |
| `sn-boulder-shotd` (2 m) | 57° / 0.258 / 0.246 | 52° / 0.328 / 0.245 | **50° / 0.384 / 0.244** | |

D vs the reference: SSIM 0.2765 → 0.2764 (noise), frame hue error 9.39° → 9.19°, satDiff 0.027 → 0.026; 396 draws / 8.01 M
both. At 2 m the rock is a warm ochre sandstone with dark partings, not orange (`hue26-sn-boulder-shotd.jpg`,
`hue26-D_log-boulder.png`). A and E moved ≤ 0.0001 on step 1 (§23) and see the same pixels; not re-captured for step 2.

## Iteration 24 — V21, the C-frame anchor rock, measured two ways — `agent/fable-2-v21` @ `02321879` (for fable-cursor's call)

V21 (ANALYSIS_VIDEO2 §6, rank 1): "the moss-capped boulder at the Kokiri boy's feet on the stair bank — the C-frame
anchor the owner sees twice", C box 0.25–0.32 × 0.47–0.55. Ray-casting that box onto the live terrain lands on the bank's
slope at **(7.4, 2.9)**, 11.8 m from C, free of path / stairs / structure; the same point projects to **A (0.84, 0.56)** —
where reference A shows the small pale rock beside the kid — and to F (0.57, 0.53). One rock, seen from three cameras.
Ours has the r 1.0 `stair-foot` hero boulder at (9.1, 2.5): C (0.175, 0.48), A's right edge — off in both.

Built (rocks-owned, `ANCHOR_BOULDERS` in `rocks/index.ts`; a layout hero boulder of the same id takes over): a pale rounded
stone r 0.55, squash 0.7, sunk 0.22 into the slope, moss as a cap (0.65 / side 0.3), tint (0.84, 0.82, 0.74). Two variants
against the head, `capture.mjs --settle 12` + `compare.mjs` vs the reference:

| view | head | **A: both rocks** (anchor + the r 1.0 stair-foot) | **B: the anchor stands in for stair-foot** (= a layout move to (7.4, 2.9) r 0.55) |
|---|---|---|---|
| A_stairs | 0.2179 | 0.2190 (+0.0011) | 0.2175 (−0.0004) |
| C_lookback | 0.2375 | 0.2358 (−0.0017) | **0.2407 (+0.0032)** |
| F_canopy | 0.2560 | 0.2534 (−0.0026) | 0.2526 (**−0.0034**) |
| draws / tris (A) | 566 / 8.62 M | 568 / 8.66 M | 566 / 8.61 M |

B, D, E do not see the spot. Crops: `v21-C-triple.jpg`, `v21-A-triple.jpg`, `v21-F-triple.jpg` (reference | head | B).
In C, variant B is the frame's composition — one pale rock at the boy's feet, the stair to the left, no second pale mass;
in A the small rock beside the kid replaces the moss-covered boulder behind him; in F the reference has a low dark mossy
hump behind the boy where ours had the big pale boulder — B removes it, yet F's SSIM drops 0.0004 past the budget.

Not landed: a composition change on three hero views. The clean version is the layout's (`heroBoulders` 'stair-foot' →
position (7.4, 0, 2.9), radius 0.55 — vegetation's and trees' exclusions follow the layout, mine cannot), so the
proposal is fable-cursor's, with F's −0.0034 against C's +0.0032 for the owner. The branch carries both variants under
`ANCHOR_REPLACES`.

## Iteration 23 — the D boulder's hue half (fable-5 round-50 #8) — `agent/fable-2-hue` @ `8908d696` (one commit, for fable-cursor)

fable-5 #8: "W23 at D: … the face still moss-grey (62° / 0.13 vs 52° / 0.36) — merge them, then hue + form." The form
half FAILed on light (§19); the hue half is one number: the D loaf's tint (0.9, 0.85, 0.64) → (0.95, 0.82, 0.55) — the
grey triplanar stone under it desaturates by about a third, so the tint runs warmer than the target.

**Stone pixels (greys + tans, vegetation excluded):**

| pose | before (head `6d6d80f8`) | after `8908d696` | frame |
|---|---|---|---|
| D_log, the boulder's box (0.09–0.21 × 0.56–0.68) | l 0.290, **59°**, sat **0.274** | l 0.288, **55°**, sat **0.315** | 52° / 0.36 |
| `sn-boulder-shotd` (2 m, box 0.28–0.72²) | l 0.246, 57°, 0.258 | l 0.245, **52°**, **0.328** | |

**Fixed views vs the reference (`capture.mjs --settle 12` + `compare.mjs`):**

| view | SSIM before → after | frame hue error | draws / tris | pixels changed |
|---|---|---|---|---|
| D_log | 0.2765 → **0.2766** | 9.39° → 9.27° | 396 / 8.01 M both | — |
| A_stairs | 0.2179 → 0.2179 | 5.99° → 5.99° | 566 / 8.62 M both | 1 389 (max 36/255) |
| E_ground | 0.2149 → **0.2150** | 5.32° → 5.29° | 522 / 7.78 M both | 3 814 (max 50/255) |

(B, C, F: the boulder is not in frame.) Sheets: `hue24-D_log-boulder.png` (4 ×), `hue24-sn-boulder-shotd.jpg`. Another
step of tint would reach 52° / 0.36 at D but starts to read painted over the grey texture; the honest next lever is the
near/far stone texture's own warmth, which is every rock's — not a D-only change.

## Iteration 22 — the wall's macro half: the face in panels — `agent/fable-2-ledge` (form reads; contrast flat)

fable-5 at 3 m: "still one lightly bulged plane … the frame's is a face of several planes." Three tries, measured
against the relief-3.0 build at `x-clearing-n` (the pose where the face shows; `x-ledge-wall` sits at the lip and
sees the cap):

| try | what | vertices moved (max / mean) | stone σ at `x-clearing-n` (box 0.2–0.42 × 0.6–0.85) |
|---|---|---|---|
| before | relief 3.0 only | — | 0.096 |
| a | fbm swell ± 0.2 (0.2 ×) + shelf | 12 cm / 2.1 cm | invisible |
| b | swell 0.45 × | 23 cm / 4.2 cm | more bulges, not planes; 0.079 → 0.079 macro in the wide box |
| **c (landed)** | **panels 1.2–2 m × 0.8 m, each ± 0.12 m at wobbled sharp boundaries + 0.22 × swell + shelf / recess** | 19 cm / 3.8 cm | **0.096 → 0.096** |

The panels DO read as planes — the cap's slab breaks into two levels and the face carries a proud panel over a
shadowed recess (`panels23-x-clearing-n-tight.png`, 1.8 ×; `panels23-x-clearing-n.jpg`) — but the stone's luminance
σ does not move: the face is in shade at this hour and the cap lit, and that split already carries the σ. Landed as
form (bounded: the ledge is north, off in A–F; the foot row still seats exactly; ledge tests 5/5), reported as
contrast-flat. fable-5's read at their poses decides whether it stays.

## Iteration 21 — the backside pair's value and size (fable-5 17:50, V20 at `x-southbank-toe`) — `agent/fable-2-ledge`

fable-5's read of the merged backside (IMPROVED): "the pair is smaller in the frame (≈ 0.6 m at 6–7 m under the fence
vs the frame's ≈ 1 m at 4 m) and reads moss-grey (l 0.29, hue 81°, sat 0.12) where the frame's is warm pale — the same
value note as the D loaf." The same answer as the D loaf: a warm tan tint (0.92, 0.84, 0.64), the moss a cap (0.6,
side 0.25) off the sides a walker sees — `bareToward` + `faceLift` 0.25 toward the plain and the flight — the lichen
greys halved, the dirt collar lower; the loaf r 0.5 → 0.62 sunk 0.22 (was 0.3), the companion 0.3 → 0.36.

**Stone pixels in the pair's box at `x-southbank-toe` (0.55–0.76 × 0.60–0.80; greys + tans, vegetation excluded):**

| build | stone share of box | mean l | hue | sat | p10 / p90 |
|---|---|---|---|---|---|
| before (head `6d6d80f8`) | 26 % | 0.177 | 75° | 0.168 | 0.133 / 0.227 |
| after | 60 % | **0.255** | **61°** | **0.242** | 0.188 / 0.309 |

(fable-5's frame target: warm pale, 52° / 0.36.) Sheet `pair22-x-southbank-toe.jpg`. The fixed views are untouched by
construction — the backside is toggled by its spheres and `backside.test.mjs` re-passes with the bigger loaf: none
of the six cameras meets any sphere. Audit unchanged (3 boulders, 49.7 K tris — detail does not scale with radius).

## Iteration 20 — round-50 #1, the wall half: the ledge's fine relief at 3 m — `agent/fable-2-ledge`

fable-5 §7.2: "the ledge wall has 65 % of the reference rock mass's fine relief" (micro σ 0.034 vs 0.052 at
`x-ledge-wall`). A `relief` option on the rock material (default 0 — every other rock material is unchanged): at near
range a triplanar grain of the stone at 5–12 cm — pits where a warped value noise dips (−42 %, damp-dark) and grains
where it peaks (+16 %), off under the moss and the lichen crust — plus a near-normal boost of the same amount. The
ledge material takes 3.0.

**Measured on the cap at `x-ledge-wall` (box 0.234–0.469 × 0.347–0.625, 4 px residual — the scale at which the
before reads 0.031, fable-5's 0.034):**

| build | mean l | macro σ | fine micro σ |
|---|---|---|---|
| before (head `6d6d80f8`) | 0.244 | 0.129 | **0.031** |
| relief 1.0 | 0.244 | 0.129 | 0.035 |
| relief 3.0 (landed) | 0.245 | 0.126 | **0.043** (+39 %; target 0.052) |

The smooth brown bulge of the cap is a pocked, knapped skin now (`relief21-x-ledge-wall.jpg`, `…-tight.jpg`); at 7 m
(`x-ledge-wall-7m`) the grain is under the fade and the frame is the head's. The ledge stands north of z −55 — off
in the six fixed views (northLocality) — so A–F are untouched. The macro half of the wall (fable-5: "still one
lightly bulged plane") is geometry — beds stepping in blocks — and is the next item on the ledge.

## Iteration 19 — round-50 #1, the D boulder's form: measured FAIL at D — `agent/fable-2-form` @ `d8ed5420` (unmerged)

fable-5's round-50 #1 / ANALYSIS_VIDEO2 §7.2: "the D boulder face has 63 % of the frame's macro contrast (σ 0.074
vs 0.117) — one shaded loaf where the frame's rock has lit planes, a shadowed undercut and a bright top."

Built: a rockgen `planes` option — explicit cleave planes after the seeded cuts (no seed draws, so every other rock
is untouched), each with its own lift / dark / bare, the bedding steps and cracks re-carved on the plane so it keeps
its relief. The D loaf gets a moss-capped flat top tilted 11° to camera D, a pale bare chamfer crest at 30°, a
shoulder plane at 37° and a 40° undercut below the belly; squash 0.78 keeps the crown within 4 cm of the loaf's;
the tint warmed toward the frame's tan. Four takes (bare top / moss top / chamfer / a +70 % crest albedo).

**Measured at D (stone pixels of the boulder's box 0.09–0.21 × 0.56–0.68, low-saturation mask):**

| take | mean l | σ | p10 | p90 |
|---|---|---|---|---|
| before (head `6d6d80f8`) | 0.266 | **0.048** | 0.213 | 0.346 |
| 1 bare top, no re-carve | 0.273 | 0.043 | 0.221 | 0.331 |
| 2 moss top, bedding re-carved | 0.265 | 0.042 | 0.214 | 0.320 |
| 3 + pale chamfer crest (`d8ed5420`) | 0.263 | 0.041 | 0.217 | 0.318 |
| 4 crest albedo +70 %, shoulder −15 % | 0.262 | 0.044 | 0.214 | 0.327 |

Nothing moves it. The boulder stands under the giant's canopy shadow at D (fable-5: "still in the giant's shade");
under sky light alone plane angles grade almost nothing, and even a +70 % crest albedo does not lift p90 — the
frame's contrast is **sunlight on planes**, and the light is not in this lane (sun: `config.ts`; the giant: trees).
The before's σ 0.048 was the bright moss lump on the crown; the planes trade it for bands and lose 4 points.

**At 2 m (`sn-boulder-shotd`, box 0.28–0.72²):** stone σ 0.059 → 0.066 (+12 %), macro σ 0.032 → 0.034; the rock reads
as a bedded block with a pale crest and an undercut instead of a loaf (`form20-sn-boulder-shotd.jpg`) — a form
gain at player height, not the σ 0.11–0.14 the item asks for.

Sheets: `form20-D_log-boulder.jpg` (the boulder at D, 4×, before / `d8ed5420`), `form20-sn-boulder-shotd.jpg`.
Typecheck / build / 22 tests green on the branch. Left unmerged for fable-cursor's call: merge as a player-height form
change, or leave the loaf; the D frame needs light on the rock first.

## Iteration 18 — backside casters made conservative (fable-cursor 17:30 / Astra's audit) — `5e4b2696`

Astra's CPU audit of `9d1fc102` found 1 876 above-ground vertices escaping the backside's caster spheres by up to
10.6 cm — a latent false cull. Two causes: the horizontal radius scaled by `squashY` (mine), and the locality
util's stack stepping by `max(r, 0.5)` from the sphere's BOTTOM, so pieces under half a metre get only the
bottom sphere and their top half escapes whatever the radius (with bounding-sphere radii but the stack alone,
20 508 vertices still escaped by up to 7.5 cm — the new test caught it).

Fix: every piece's **exact body sphere** — the bounding sphere of its built vertices under its matrix
(`bodies`) — plus a caster from the ground to the body's top for the util's stack + shadow sweep;
`spheres(sunDir)` is what the runtime toggles on. `backside.test.mjs` (real layout + live heightfield): every
vertex inside the body-sphere union; every seat on the live ground, off treads / paving, > 1 m west of camera
C's edge; none of the six fixed cameras meets any of the 310 spheres; a walker at the bank's toe does.

| view | before (head `6d6d80f8`) | after `5e4b2696` | pixels changed |
|---|---|---|---|
| A_stairs | 566 draws / 8.62 M | 566 / 8.62 M | 30 of 921 600, max 4 / 255 |
| C_lookback | 407 / 6.96 M | 407 / 6.96 M | 66, max 1 / 255 |

The toe pose still shows the pieces (`back19-x-southbank-west-skirt.jpg`; audit: boulders 3, step stones 3, scree
22, kerbs 4, disc pebbles 39, 49.7 K tris — unchanged).

## Iteration 17 (goal mode, 2026-09-20) — GOAL_MODE fable-2 item 0: `expansionCull` on the rock streams + expansion-2's listed positions

`3ac0a8a1` (the cull) + `9d1fc102` (the positions). BEFORE = the head `1794c155`, AFTER = this build.

**The cull:** `heightfield.expansionCull(x, z)` AFTER placement on every sampled rock stream — the strata right after
their scatter (before the hero loop adopts slabs), the rubble and both pebble lists after — with the handoff's rule:
every stream keeps its candidate count and its draws; the pebble lists are filtered, rubble / strata collapse to a
zero scale in place because the near kits reference them by index. Audit on the round-49 head: culled
{ strata 3, rubble 0, pebbles 0 } — three slabs sat inside the bank / knoll; the pebble envelope already kept the
pebbles at the path polylines. `systems.rocks.expansionCulled` reports it.

**The positions (added to `backside.ts`):** the boulder at the bank's west skirt (−18.93, 13.92), three or four kerb
stones at the flight foot (−14.13, 15.75) along the lip, a scree fan under the west house's braces (−21.5, 12.5),
and hashed pebble rings (3–5 stones, 0.12–0.37 m off the rim) beside the west / south stepping discs — discs within
1.6 m of camera C's frustum edge get none (their rings crossed it; caught by the offline `expansionVisible`
check and fixed). Audit: backside { boulders 3, stepStones 3, scree 22, kerbStones 4, discPebbles 39 }, ~50 k tris.

| pose | what changed | verdict |
| --- | --- | --- |
| `x-southbank-west-skirt` p (−15, 1.5, 10) → t (−19, 0.9, 14) | a moss-topped pale loaf half-buried at the bank's NW end beside the white-bark (`back18-x-southbank-west-skirt.jpg`) | landed |
| `x-southbank-toe` | the toe pair, the kerb stones and the flank scree as in iteration 16 | consistent |
| `x-west-discs`, `x-westhouse-braces` | the disc pebbles and the brace scree are under the west bank's flowers / behind the bole at these poses — placed (audit) but not readable there | not claimed visually |

Fixed views A and C, head → final build: A byte-identical, C 5 pixels at 1/255; draws and triangles the head's
(A 566 / 8.62 M, C 407 / 6.96 M). Offline, none of the six cameras meets a backside sphere.

## Iteration 16 (goal mode, 2026-09-20) — the plaza's backside: rocks at the fence-topped south bank (expansion-2, V20)

`06f2a781` + `294bc94c` (`src/world/rocks/backside.ts`). BEFORE = the head `97c83227` (expansion-2 in), AFTER = this
build. Expansion-2 raised the plaza's backside outside the six frames — a fence-topped south bank with a stone
flight; the footage's motif at every bank foot (V20, `d_087`) is pale rounded boulders and a low stone step. Placed
from the layout's `EXPANSION.southBank` lip frame and `EXPANSION_STAIRS` 'south-bank', seated on the LIVE terrain
(the rocks system otherwise builds against the legacy view, where the bank does not exist), off the treads / discs /
pads, one merged mesh (~30 k tris) toggled with expansion-2's own `expansionVisible()` frustum + shadow-sweep
spheres — one tight caster per piece (a first cut with group spheres reached across camera C's frustum edge and
cost C +1 draw / +31 K tris for no pixel).

| pose | what changed | verdict |
| --- | --- | --- |
| `x-southbank-toe` p (−10.5, 1.5, 11.5) → t (−16.2, 1.0, 15.2) | a pale moss-capped loaf with a companion at the bank's foot east of the flight; small stones at the flank (`back16-x-southbank-toe.jpg`) | **landed** — the reference's pale pair at a bank's foot |
| `x-southbank-flight` p (−11.5, 1.45, 17.5) → t (−15.5, 1.4, 17.4) | angular scree on the bank's face at the flight's west flank, a pale boulder at the foot to the right (`back16-x-southbank-flight.jpg`) | landed |
| `x-sw-pan` (Link's spot → the bank, 24 m) | the pair a pale mark at the bank's foot (`back16-x-sw-pan.jpg`) | consistent |

Fixed views A and C (the two that could see or pay): draws and triangles the head's (A 566 / 8.62 M, C 407 / 6.96 M);
pixels differ only at run-to-run noise (A 30 px ≤ 4/255, C 66 px ≤ 1/255, all in the canopy rows). Offline, with
the runtime's own `expansionVisible`, none of the six cameras meets a backside sphere. Audit: `backside`
{ boulders 2, stepStones 3, scree 18 }.

## Iteration 15 (goal mode, 2026-09-20) — W23's value half on the loaf branch (`agent/fable-2-w23-loaf` @ `39568e37`)

fable-5's 13:25 review of the loaf: "composition fixed, value inverted — merge the composition; fable-2, the value
half: moss kept off the camera side of shot-d-boulder, the shaded face lifted toward l 0.27". Camera D looks north,
so it reads the boulder's south side, where the shade blanket hung (l 0.21 / hue 63° / sat 0.15 against the
reference's bare lit face 0.27 / 52° / 0.36). `39568e37` (rockgen `bareToward` + `faceLift`, the frame's camera
read from `layout.viewpoints`): the face toward D stays bare stone (the cap keeps its moss — the frame's greenery is
on the crown) and is paled up to 30 %.

| frame / pose | before (loaf) → after | verdict |
| --- | --- | --- |
| `D_log` | a dark grey-green mass with a moss cap → pale bare stone under the moss cap, still in the giant's shade and partly behind the fronds (`val15-D_log-boulder.jpg`, reference beside it); the boulder box l 0.263 → 0.276 | **IMPROVED** — the value half moves as asked; the fronds in front stay vegetation-26's |
| `sn-boulder-shotd` (2 m) | the camera-side blanket gone, the face pale tan stone with a moss hat (`val15-sn-boulder-shotd.jpg`) | IMPROVED |

Six views, loaf `566d5a1a` → `39568e37`: A +0.0003, B +0.0001, C 0, **D +0.0005**, E +0.0002, F 0 — all up or flat;
draws / triangles identical. The whole branch against the head: D −0.0002 (the composition's −0.0007 less this
+0.0005), the rest within ±0.0003.

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
