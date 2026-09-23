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

## Iteration 84 — the earth treads' tint × 1.15 and the read from the plaza (the demo's `d_010` view); re-measured on the merged head `76fef8a6` (squad lanes 1–5 in): A −0.0002, C −0.0012, F +0.0004 — and the head itself now renders A at 9.15 M triangles / 599 draws, over W38's 9.0 M

`d_010` (the demo, the flight seen from the plaza) against ours from the same spot (`steps84-d010-view.jpg`): the demo's flight
alternates pale treads and dark log risers; ours alternates lit log crowns and darker treads — the light, not the material
(the canopy shades our upper treads; fable-5's read). The earth's albedo is the half I hold: `EARTH_TINT` × 1.15
(2.24 / 1.98 / 1.52), still under the demo's tread value in shade and not chalky at 2 m (`steps84-tint-triple.jpg`: stone |
earth | earth × 1.15 at `s2-top-down`, the 2 m tread pose and the plaza view). At A the flight box moves a hair toward the
frame: dark 53.3 → 52.9 %, lips 77 → 78 (frame 15.7 % / 100).

The branch carries the head `76fef8a6` merged (fable-cursor's rule for squad lanes), so the pair is re-measured there —
`76fef8a6` (stone treads) → `55b791a1` (earth × 1.15): **A 0.2047 → 0.2045 (−0.0002, 0.22 % of pixels), C 0.1834 → 0.1822
(−0.0012, 0.66 %: the flight's foot at C's left edge), F 0.2169 → 0.2173 (+0.0004, 0.26 %)**; B / D / E do not see the flight
(0 / 0 / 11 px at §83's base). Draws and triangles are the head's: **A 599 draws / 9.15 M triangles** — the squad's mid-canopy
and understory took A from 8.55 M (`73402409`) over W38's 9.0 M ceiling; C 473 / 6.77 M, F 550 / 7.99 M. Not mine to cut;
flagged to fable-cursor. A frame here now takes ≈ 680 s to render at A (was 350).

## Iteration 83 — lane 6 (fable-cursor's 07:30 fit): the demo's log-risered steps, first half — the hero flight's treads are trodden earth between the timbers, not stone slabs (`aEarth` on the slab tops, the stone shader renders trail dirt there); six views A −0.0002, C −0.0009, the rest 0

The owner's references for "the steps" (`docs/SQUAD_2026-09-23.md` lane 6): the demo's walk north, `demo61/d_094` and `d_104`
— round timbers as the risers, packed pale earth with grass at the edges between them. Ours were stone slabs with a log on
each nose: from eye level the logs hide most of the tread, but from above (the owner's camera looks down 35° while he
climbs) the pale grey slabs with their rolled lips and split outlines were the read.

Built without touching the geometry: `MeshBuilder` carries an `aEarth` weight (`geometry.ts`, `SlabOptions.earthTop` writes
it on the top face and the shoulder ring; the walls stay 0), and the stone material (`material.ts`) blends the surface to
the terrain's `rocky_trail` set where it is 1 — the trail texture at 0.9 m repeats, its albedo lifted to the demo's pale dry
dirt (`EARTH_TINT`), under the same vertex tint as the stone (the tread's tone gradient, grime, damp), its own normal for the
grit, a matte roughness. `stairs.ts` sets `earthTop: 1` on a log flight's treads and drops the lit-nose lip from their tint
(the timber is the nose; the walked centre a shade paler, the back and flanks damper). Draws, outlines, tread noses and the
contact surface are unchanged (`paving.test` V17 / tread-nose rows pass); `rocky_trail` is CC0 (Poly Haven), credited.

Before `73402409` → after `7fcb33cf` (`steps83-earth-treads-sheet.jpg`: `s2-top-down`, the 3.3 m look-down `ld-flight-down`, the 2 m
`x-stairs-3rd-tread`; `steps83-C-foot.jpg`: the flight's foot at C):

| pose | what the eye gets |
|---|---|
| `s2-top-down`, `ld-flight-down` (from above) | grey slab tops with rolled lips → pale sandy earth with grit between the timbers, the tread outlines gone |
| `x-stairs-3rd-tread` (2 m) | the band behind each log is packed dirt, not a stone lip |
| `s2-owner`, `s2-climb` (eye level) | the timbers hide most of the tread; the bands that show turn from grey to earth |
| tread band vs the demo (`d_104`, a tread in light) | ours sRGB 83 / 72 / 54 (R/G 1.15, B/R 0.65) against the demo's 82 / 69 / 57 (1.18 / 0.70) |

| view | before | after | Δ | changed px |
|---|---|---|---|---|
| A_stairs | 0.2190 | 0.2188 | −0.0002 | 1 553 (0.17 %) — the flight's tread bands; the flight box's dark share 51.5 → 51.3 %, lips 78 = |
| B_house | 0.1877 | 0.1877 | 0 | 8 |
| C_lookback | 0.2038 | 0.2029 | −0.0009 | 6 047 (0.66 %) — the flight's foot at C's left edge, 3–4 m: the first treads now earth |
| D_log | 0.2560 | 0.2560 | 0 | 0 |
| E_ground | 0.2178 | 0.2178 | 0 | 11 |
| F_canopy | 0.2252 | 0.2254 | +0.0002 | 1 881 (0.20 %) |

Draws / triangles unchanged (545 / 533 / 434 / 499 / 533 / 507; A 8.55 M). `tsc` green, hardscape tests 9 / 9. Not done in
this half: the demo's flights have no stone cheeks (grass banks meet the timbers' ends) and the timbers' cut ends stand proud
with stakes — the cheeks are a geometry change to measure next; the path fork into the woods (lane 6's second item) needs
fable-cursor's word on the layout before I move anything.
## Iteration 82 — the hero boulders' near skin holds to 13 m (`HERO_NEAR_FADE_M` [7, 13], the dressing's band): the owner's walk-around range, under his 2026-09-23 06:50 direction that the walk beats the fixed frames — six views within ±0.0004

The hero material's near terms (near tile, relief grain, wet band, crack grime) faded out over material.ts `NEAR_FADE_M`
[4, 6.3] — set so camera D (7.22 m from the D boulder) rendered the plain far look. The far meshes share the material, so
that bound also put every hero rock at the smooth far skin at exactly the 6–13 m a walker sees them from (the near kit's
geometry stays in to `NEAR_ROCK_IN_M` 12 m, its skin faded): the owner's "stones under-detailed at 5–20 m", answered in
§56 for the dressing sets only. With the walk now the owner's measure (`docs/SQUAD_2026-09-23.md`: "the owner's walk-around
quality now beats the old fixed-frame gauntlet scores … say if a change moves the six hero views a lot"), the heroes take the
dressing's band. One constant, two materials (`heroMaterial`, `stairFootMaterial`), the audit's `fadeM`.

Before `1394d49d` → after `d51d3f84`, both rendered here (`--settle 10` poses, `--settle 12` views):

| pose | distance | changed px (> 8 / > 40) | box read (mean l / macro σ / micro σ) |
|---|---|---|---|
| `w-shotd-7m` (the D boulder from the path) | 6.9 m | 9 250 / 334 (1.00 %) | 0.295 / 0.053 / 0.058 → 0.305 / 0.052 / **0.061**; the loaf becomes knapped plates over a damp foot |
| `w-stairfoot-9m` (from the plaza) | 8.9 m | 10 390 / 1 450 (1.13 %) | 0.370 / 0.070 / 0.094 → 0.385 / **0.081** / **0.101**; plates and pale crust where a smooth pale blob stood |
| `w-shotd-10m` | 10.2 m (skin weight ≈ 0.4) | 2 104 / 0 (0.23 %) | 0.290 / 0.032 / 0.032 → 0.303 / 0.035 / 0.032 |
| `w-terrace-10m` (the terrace boulder from the north path) | 10.8 m | 86 / 0 | the bank's ferns hide it from that path — no read |
| `x-southbank-toe` (control: the dressing pair) | 6.8 m | **0** | unchanged by construction |

| view | before | after | Δ | changed px | what |
|---|---|---|---|---|---|
| A_stairs | 0.2266 | 0.2267 | +0.0001 | 2 710 (0.29 %) | the stair-foot rock at ≈ 9 m |
| B_house | 0.1960 | 0.1957 | −0.0003 | 3 724 (0.40 %) | the D boulder at the left edge |
| C_lookback | 0.2047 | 0.2046 | −0.0001 | 289 (0.03 %) | the bank anchor |
| D_log | 0.2675 | 0.2673 | −0.0002 | 9 887 (1.07 %, one > 40) | the D boulder at 7.2 m |
| E_ground | 0.2183 | 0.2183 | 0 | 3 724 | B's frame |
| F_canopy | 0.2261 | 0.2257 | −0.0004 | 3 510 (0.38 %) | the stair-foot rock at F's foot |

Draws and triangles unchanged (545 / 533 / 434 / 499 / 533 / 507; A 8.54 M). Tests 28 / 28, `tsc` green. `herofade82-sheet.jpg`:
the three walk poses and the A / B crops, before | after.

## Iteration 80 — the rocks from the play camera's new look-down (six poses): nothing floats, no LOD seam; the one read I chased — the D boulder's face as a "diamond weave" from above — was the beds crossing the fine network, not a lattice: `crackWarp` built, measured, NOT landed (`743f1454`, reverted by `a1782588`)

The owner's camera now looks down 35° (nearest surface ≈ 3 m), so a walker sees the rocks from above at 3–5 m — a
range no fixed frame and no survey pose covers. Six poses on `59c0f961` at eye 3.3 m over the ground, 35° down, 4.4 m to
the aim point (`lookdown80-sheet.jpg`): the plaza fringe pebbles, the stair-foot skirt and boulder, the D boulder, the
south-bank pair from the flight, the ledge from the terrace, the north path's pebble tiles to 13 m. Pebbles and shards sit
on the ground, the tile LOD shows no seam at 10 m, the skirt and the pale pair read as stone; the blocky kerbs are the
flights' cheeks (hardscape). One read: from above at 4.4 m the D boulder's lit face looked like a woven basket — regular
diagonal lines crossing.

Hypothesis: gradient noise is zero at every lattice node, so the `ridged` zero contours the cracks are drawn on run node
to node and form a lattice. Built as `crackWarp` (rockgen option, default 0, far build byte-identical — asserted; the
sample point of each network bent by three low-frequency noises, ≈ 0.3 of the network's cell rms), on for the hero near
kits, the skirt shards and the dressing rocks. It works as a warp: on the D near kit 85 % of the line vertices move to
other vertices at the same density (crack share 11.8 → 12.1 %), vertices move ≤ 2 cm (the furrows); 4–10 % of the pixels
change at the seven poses (`warp80-shotd-triple.jpg`, before | after at 2 m, 2.4 m down and the 4.4 m look-down). At A the
warped build moves 193 px (0.02 %) — the skirt shards' near kit is inside A's range; the hero far meshes are identical.

Measured, the lattice is not there to remove. The crack field on a flat 60 cm slice of the D noise (`warp80-crackplane-pair.jpg`)
is already irregular before the warp — the 3D noise is three sheared planar noises summed, and their nodes do not line up.
On the renders the 2D spectrum's ring (the line spacing) keeps its angular concentration through the warp — 71 → 72 % of
the ring's power in three 15° bins at `x-shotd-down`, 64 → 65 % at the look-down, the spectral peak the beds' spacing — so
the regular diagonals are the **bedding bands** (by design: the frame's D rock is bedded) crossing the fine network at a
glancing angle. The warp changes the cracks' course (curvier) with no measured defect behind it — a look change nobody
asked for, the day before the deadline: reverted on top; the implementation and its test stay in the branch's history.

## Iteration 79 — fable-cursor's all-lanes ask (03:25): the rocks lane re-verified on the head `59c0f961` (owner review 2026-09-23) against `47773f13`, the build the owner played — rocks pixel-identical everywhere they show; the six views within −0.0007

`src/world/rocks/**` has no commit between the two builds; what changed under the rocks is shared: the play camera (never
under capture), the near-fade program keys, the lantern frames and the west house's light, the distant crowns' fade from
below, and — in my hardscape module — the hero flight's logs (`d4f1feec` + `3b37b8b7`). Both builds rendered here at
`--settle 12`, character as the take has it. Tests (rocks + hardscape) 37 / 37, `tsc` green on the head.

| view | before `47773f13` | head `59c0f961` | Δ | changed px (> 8 / > 40 levels) | draws | triangles |
|---|---|---|---|---|---|---|
| A_stairs | 0.2239 | 0.2232 | −0.0007 | 36 393 / 11 654 (3.95 %) — 31 523 of them in the flight box | 474 → 476 | 8.61 → 8.67 M (+60 K) |
| B_house | 0.1963 | 0.1961 | −0.0002 | 1 883 / 212 (0.20 %) — the pods | 462 → 464 | 7.89 → 7.95 M |
| C_lookback | 0.2045 | 0.2046 | +0.0001 | 6 230 / 1 713 (0.68 %) — the flight's logs at the left edge, the lanterns | 368 → 368 | 6.82 M |
| D_log | 0.2673 | 0.2675 | +0.0002 | 610 / 115 (0.07 %) | 428 → 430 | 8.05 → 8.09 M |
| E_ground | 0.2179 | 0.2181 | +0.0002 | 1 880 / 212 (0.20 %) | 462 → 464 | 7.89 → 7.95 M |
| F_canopy | 0.2232 | 0.2253 | **+0.0021** | 39 837 / 12 787 (4.32 %) — the flight | 438 → 440 | 8.05 → 8.09 M |

Where the rocks are in those frames nothing moved (`rv79-sixviews-rocks.jpg`, before | head | mask): A's stair-foot skirt
(box 0.55–0.80 × 0.70–1.0) **0 px**, the plaza's paving and pebbles (left half below 0.5) 7 px, the D boulder (0.04–0.18 ×
0.66–0.84 and the wide 0.05–0.30 × 0.50–0.80) **0 px**, E's paving and pebbles below 0.6 14 px, F's flight foot below 0.75
0 px. The A flight box (fable-5's) reads **51.4 % dark / 7.5 % pale / mean l 0.264, lips 78 / troughs 63** on the head —
the same numbers as `d4f1feec` alone (§78): `3b37b8b7`'s repaired pair and checked crowns move 0.64 % of the box's pixels
and none of its shares at a tenth of a percent. Before, the tint's 44.1 / 12.7 / 0.291, lips 92 / 66.

The rocks poses, same two builds (`node pose.mjs --settle 12 --audit`):

| pose | changed px > 8 / > 40 | where | rocks census (meshes / instances) | pebble LOD low tiles |
|---|---|---|---|---|
| `sn-boulder-shotd` (D boulder, 2 m) | **0 / 0** | — | 66 / 3 395 = | 14 of 20 = |
| `sn-boulder-stairfoot` (skirt, 2 m) | 80 / 0 (0.01 %) | the flight's first log at the top-right corner; the skirt 4 px | 66 / 3 355 = | 13 = |
| `x-ledge-wall` (3 m) | **0 / 0** | — | 66 / 3 330 = | 20 = |
| `x-southbank-toe` (the pale pair, 6.8 m) | 5 126 / 45 (0.56 %) | a grass tuft at the frame's foot (3 191 px in one cell, max Δ 72) and a far bough; **the pair 20 px of 67 064** | 66 / 3 330 = | 17 = |
| `x-clearing-n` (ground eye) | 4 691 / 0 (0.51 %) | all above the horizon — the ring's crowns (`e48d5e8e`); below it 28 px, the stone box 0 | 66 / 3 330 = | 20 = |
| `w23-stairs-f` (the flight) | 340 368 / 155 346 (36.9 %) | the logs | 66 / 3 347 = | 13 = |
| `x-stairs-3rd-tread` (2 m) | 440 968 / 233 190 (47.9 %) | the logs (`logs79-flight-pair.jpg`) | 66 / 3 335 = | 14 = |

B3 on the head: rocks instances 3 330–3 395 by pose against the 3 151 claimed; the pebble tiles' `mergedInstances` census and
the LOD swap unchanged. Verdict for fable-cursor: rocks needs no retune on this head; the lane's open offer stays §78's
`LOG_TINT` balance (the timbers' individuality does not need their darkness — A's flight box at 51 % dark vs the frame's 16 %).

## Iteration 78 — the owner's "repeated pattern" on the hero flight: `d4f1feec` (the owner-side agent's rewrite of `logNosings.ts`) checked at A / C / F and at 2 m — the right fix in kind, 60 % of the tint's A value given back

Owner review 2026-09-23: "the first staircase looks natural, the second has an obvious repeated pattern" — the twenty log
nosings: near-white (`LOG_TINT` 1.35 / 1.5 / 2.3, §46), the bark map at the same phase with its fissures running round every
log, the same pale crown and moss band, stakes in pairs like a fence. The owner-side agent rewrote the module directly:
`LOG_TINT` → 0.76 / 0.74 / 1.0, the grain along the log with its own offset and roll per log, wear where boots land (rubbed
smooth and dark), soil in the crease, moss where nobody steps, stakes irregular. Pair `d4f1feec^` vs `d4f1feec` here:

| | A | C | F | A flight box (fable-5's; frame 15.7 % / 14.2 % / 0.345) | lips / troughs (frame 100 / 85) |
|---|---|---|---|---|---|
| before | 0.2239 | 0.2045 | 0.2232 | 44.1 % dark / 12.7 % pale / 0.291 | 92 / 66 |
| after | 0.2233 (−0.0006) | 0.2046 | **0.2254 (+0.0022)** | **51.4 % / 7.5 % / 0.264** | **78 / 63** |

Draws / triangles unchanged. At 2 m (`logs78-3rd-tread-pair.jpg`) the new timbers are the better logs — weathered grey-brown,
grain along, worn crowns, each its own tone — where mine read as birch poles with rings: the owner was right and the fix
answers him in kind. The cost is the flight's value at A, the half of W02 the tint had bought (§46: lips 68 → 94 against the
frame's 100): the darker tint gives back ≈ 60 % of it (lips 78, dark share 51 % — the pre-tint head was 60.6 % / 7.3 % /
0.250). The two are separate knobs — the individuality (phase, wear, stakes) does not need the darkness; a `LOG_TINT`
near 1.0 / 0.97 / 1.3 would hold the lips at ≈ 90 with the grain and the wear as they now are. Offered to the owner-side
agent / fable-cursor as the next tick's measure, not taken: the module's last word is theirs today.

## Iteration 66 — V16, both halves as fable-5 specified (14:03): built, measured with their read — acceptance not met; the E box is the lawn slabs, whose joints are vegetation's turf — the implementation left on `agent/fable-2-v16-fill` (`2a3932df`, reverted on top)

fable-5's two numbers, keyed on the flush rim's noise: seam soil at ≈ 0.40 (−0.15 below the slab) where the line shows;
the slab's own value over ≈ 40 % of each run, with the rim flush there. Built across the module seam: one per-slab
1.7 cycles / m noise (keyed fork) drives the rim drop in `flagstones.ts` (§64's term) and a `flush(x, z)` query on the paving
(the nearest slab's weight), which `joints.ts` writes as a second channel of the gap field (RG) and the fill shader reads to
mix the fill toward `FLUSH_TONE` (dry dirt at the slab's value); the seam soil and mossy earth albedos × 2 (`SEAM_FILL_LIFT`).
Typecheck / build / 9 tests green. Measured with `seam-lines.py`, head (grass in) vs build:

| box | | line px/kpx | width | depth (p90) | line > 0.12 | share > 0.12 | regions | SSIM |
|---|---|---|---|---|---|---|---|---|
| E | reference | 55.3 | 2.20 | 0.081 (0.125) | 12.4 % | 1.3 % | 5 | |
| E | head | 86.1 | 2.54 | 0.097 (0.163) | 27.0 % | 5.8 % | 14 | 0.2188 |
| E | both halves | **90.7** | 2.39 | 0.090 (0.150) | **21.5 %** | 4.7 % | 15 | +0.0006 |
| C | head → both | 83.5 → 83.2 | | 0.103 → 0.099 | 29.3 → 26.1 % | 4.9 → 4.4 % | 25 → 25 | **+0.0016** |
| D | head → both | 80.9 → 81.6 | | 0.097 → 0.100 | 25.1 → 27.8 % | 4.9 → 5.5 % | 10 → 9 | **−0.0016** |

Acceptance (E line ≤ 60, hard groove ≤ 15 %, regions ≤ 6): not met — the hard-groove share moves a fifth of the way at E and C,
the visible line length and the region count not at all. The crop says why (`seams66-E-triple.jpg`): **fable-5's E box is the
lawn slabs** (B / E's pale bottom row), and the flush term follows the spall rule — none on the discs and the lawn slabs — so
only the soil lift acted there; and the frame's lawn joints do not close under dry dirt but under **bright grass at the slab's
value**, which is the W06 / W15 turf contract (vegetation-27's), not a hardscape tone. On the spine and plaza (C, D) the flush
stretches exist and C gains +0.0016, D pays −0.0016 (the line count unchanged: the slab's shoulder roll against a flat fill
still reads as an edge at > 0.04 whatever the fill's tone). What is left is not a number: the lawn slabs' joints as grass
at the slab's value over stretches (vegetation + hardscape), and a softer shoulder where the rim is flush. Reverted on the
branch; the implementation commit stays for the module holder. Four passes; this lane is done with V16.

## Iteration 64 — V16's flush stretches (fable-5's re-scope) built and measured with their line read: the line is the fill strip's tone, not the recess — FAIL to land, reverted (`agent/fable-2-v16-flush`)

Announced 05:50 with "hold and it stays"; no hold in seven hours, so built on the rim-drop channel as planned: over ≈ 40 % of
each outline (a 1.7 cycles / m noise on its own keyed fork, none on discs and lawn slabs) the rim comes down to the fill
(`rimY − (terrain + 0.008)`), so the wall top and shoulder meet the joint's soil and the recess comes and goes along the
seam. E / C / D captured head vs flush and read with fable-5's `seam-lines.py` (their boxes, blur-difference > 0.04 thinned
to lines):

| E_ground | line px / kpx | width | depth (p90) | line > 0.12 | share > 0.12 | regions |
|---|---|---|---|---|---|---|
| reference | 55.3 | 2.20 | 0.081 (0.125) | 12.4 % | 1.3 % | 5 |
| head `f97676d2` | 86.1 | 2.54 | 0.097 (0.163) | 27.0 % | 5.8 % | 14 |
| flush stretches | **86.1** | 2.54 | 0.096 (0.163) | 27.0 % | 5.8 % | 14 |

C 83.5 → 82.8 px/kpx, D 80.9 → 82.5; SSIM E −0.0002, C 0, D −0.0014; 4 K / 6 K / 15 K pixels changed — the stretches are
there (rims sit flatter along them, `seams64-E-flush-pair.jpg`) and the line read does not move by a decimal. So the
model behind the re-scope — "the outline is the paving's own shading of a continuous recess" — measures false as well:
**with the rim flush, the joint still reads as a line because the 6–10 cm fill strip is darker than the slab along its
whole length.** The frame's seams close where the fill is slab-toned dry dirt or grass lapping over, not where the
groove is shallower. What would close ours is the fill's tone varying along the joint — the seam soil giving way to
`JOINT_SOIL_DRY` / turf at the slab's own value over the same stretches (a fill attribute from the shared noise and a
term in the joint shader, `joints.ts`) together with the flush rim. That is the module's change; three V16 passes from
this lane have now mapped tone (§54), recess and edge geometry (§54, §64) and the tufts (§54) as non-levers, and this
lane stops at V16 unless the module is handed over with the fill half. Reverted by forward commit.

## Iteration 63 — the D boulder's form planes re-measured where the rock now stands (round-52 #12's "one plane"): still light, not geometry — FAIL to land (`agent/fable-2-form-2` @ `f5ab2f28`, the §19 commit rebased)

§19 built the `planes` option and measured it a FAIL at D under the giant's canopy shadow; W23 then moved the boulder to
the frame's rock spot (§36) and fable-5 read it "lit" at take-0128 — the condition that hid the planes had changed, so
the same commit deserved the measure again. Rebased onto the head (`towardD` derives from the layout, so the planes face
D from the new spot); the frame's D rock box 0.04–0.18 × 0.66–0.84:

| build | macro σ | micro σ | stone mean l / hue / sat | p10 / p90 | D SSIM |
|---|---|---|---|---|---|
| reference D | **0.097** | 0.062 | 0.334 / 52° / 0.54 | **0.18 / 0.50** | |
| head `c0f76f0c` (loaf) | 0.023 | 0.042 | 0.321 / 43° / 0.40 | 0.26 / 0.38 | 0.2785 |
| planes (`f5ab2f28`) | 0.026 | 0.044 | 0.330 / 43° / 0.40 | 0.26 / 0.39 | 0.2772 (−0.0013) |
| planes, hard bake (crest +60 %, undercut −50 %, dark 0.55) | 0.025 | 0.044 | 0.325 / 43° / 0.40 | 0.26 / 0.39 | 0.2773 (−0.0012) |

Nothing moves the range: the frame's rock has the sun on its crown and a true shadow side (p90 0.50 over p10 0.18); ours
is evenly lit whatever the geometry, and even the hard bake leaves p90 at 0.39 — the material's response to a baked
vertex value is weak, and the light on the rock is flat (`form63-D-quad.jpg`: reference | loaf | planes | hard bake).
At 2.5 m from the south the planes do read as a blockier, bedded block with an undercut line (`form63-2m-south.jpg`) —
form for the eye, macro σ 0.041 → 0.039. So round-52 #12's "one plane" at D is the same answer as §19 and as V17's
treads: the light on that spot, not rocks. Not landed (D −0.0013 for no metric gain); the rebased planes stay on the
branch as the player-height form option if fable-cursor ever wants it.

## Iteration 61 — the rock meshes' CPU arrays go on upload — `agent/fable-2-rock-upload` @ `a1ed0427` (stacked on §60)

fable-4's `poolmem` (tick 225): every tree geometry drops its CPU typed arrays once the GPU has them (`BufferAttribute.onUpload`),
renderer RSS at A −125 MB; fable-5's reconciliation: "`onUpload` drops the CPU copy of all static geometry — no GPU cost".
Rocks qualify — nothing reads a rock mesh's arrays after the build: the bounds are computed before the first frame (three's
frustum check runs before the upload on a mesh's first visible frame, from the array still present), the census reads
`count`, the near-LOD swap toggles visibility, the rubble / strata skirt collapse writes the mesh's `instanceMatrix` (not a
geometry attribute), and the only raycast in the tree is terrain's own sampler proof. So `compactRockGeometry` now also
registers the drop on every attribute and index. At E after the first frames: **115 rock attributes released; live rock
arrays 66.2 → 33.2 MB** (§60's compaction plus the drop on everything drawn — the hidden near kits keep theirs until first
shown). The heap samples swing with GC timing (1 385 vs 1 475 MB between two runs), so the array bytes are the measure; the
pixels cannot change (the GPU buffers are the same data). Tests 28/28 (no renderer in node: `onUpload` never fires there).

## Iteration 60 — every rock mesh's vertex storage compacted: rocks 85.5 → 40.3 MB, the JS heap −45 MB — `agent/fable-2-rock-bytes` @ `59c68f32` (stacked on §59)

The second memory step §59 named, generalised: `compactRockGeometry` runs once over every mesh drawn with a rock material
(`rock-triplanar…`), after every build-time read of the attributes — the hero near kits (320 K / 230 K / 194 K vertices),
the far LODs, the dressing meshes, the ledge, the strata / rubble looks. `uv` goes (no rock material reads it: the skin
is triplanar); the normal becomes Int8 ×3; any attribute whose values all sit in 0–1 (colour, `aWet`, `aLichen`, a
pebble's `aMoss`) becomes Uint8; an attribute outside 0–1 stays float32 — the kits' `aMoss` carries the cushions (> 1)
and the lichen plates (< 0). Normalised integer attributes reach the shader as the same floats; idempotent (the §59 tiles
are left as they are).

| | rocks | of which | JS heap (A) |
|---|---|---|---|
| head `a1eafb17` | 85.5 MB | pebble tiles 30.4 · hero kits 34.1 · dressing 13.5 · far LODs 6.9 | 1 529 MB |
| `59c68f32` | **40.3 MB** | tiles 11.1 · kits 18.7 · dressing 7.2 · far LODs 3.4 | **1 484 MB** |

The GPU process holds the other copy, so the tab gives back ≈ 90 MB. Pixels — the quantisation's footprint, no more:

| view / pose | SSIM | px > 8 | > 40 | note |
|---|---|---|---|---|
| D_log (capture pair) | 0.2785 → 0.2785 | 2 212 (0.24 %) | 0 | the shot-D boulder's crack and bed lines, where dark colours quantise coarsest (`bytes60-D-boulder.jpg`, ×6 difference) |
| E_ground (capture pair) | 0.2182 → 0.2183 | 341 (0.04 %) | 1 | draws / tris identical (386 / 7.96 M, 425 / 7.80 M) |
| `sn-shotd-2m` (the near kit at 2 m) | | 159 (0.02 %) | 0 | mean 2.2 levels |
| `x-southbank-toe` (the dressing at 6.8 m) | | 1 184 (0.13 %) | 0 | mean 2.8 levels |

Rocks tests 28/28, typecheck / build green. Rocks' bytes are done: what remains (40 MB) is the vertex count itself —
the near kits at 200–320 K non-indexed vertices each, sized for a camera within 6 m; a lower-density kit would be a look
change to measure at the 2 m poses, not a storage one.

## Iteration 59 — the pebble tiles' bytes: 30.5 → 11.2 MB (tick 223's OOM ask) — `agent/fable-2-pebble-bytes` @ `20b72fdf`

fable-cursor (07:15): the capture stalls are OOM kills, the tab at 3.6 GB, the world's resident memory the root cause.
A per-system geometry-bytes map from the page (`.agents/reviews/fable-2-memory-map-4f22e7ec.md`): 773 MB of attribute
arrays, trees 440, rocks 86 — and 30.5 MB of rocks' were §49's pebble tiles: 2 042 × 300 non-indexed float32 vertices at
52 B, where the eight InstancedMeshes had held 0.3 MB. The far material the tiles draw with reads position, normal,
colour and `aMoss` only (triplanar, no `uv`; `aWet` / `aLichen` are the near variant's), and a pebble's colour is
0.47–0.76, its `aMoss` 0–0.40: each merged tile now drops `uv` and `aWet` and stores the normal as Int8 ×3, colour and
`aMoss` as Uint8, normalised — 19 B per vertex.

| | tiles | rocks | JS heap at A |
|---|---|---|---|
| head `4f22e7ec` | 30.5 MB | 85.5 MB | 1 526 MB |
| `20b72fdf` | **11.2 MB** | **66.2 MB** | 1 507 MB |

Pixels (pose tool, head vs branch, settle 12): E — pebbles at 1–2 m in the foreground — 0.23 % of pixels move at all, by
2.3 levels on average, 96 over 8, none over 40; A 0.12 % / 40 / 0: the quantisation's footprint. Tests 28/28. The rest
of rocks' bytes (the hero near kits 34 MB, the dressing meshes 13.5) carry `aMoss` outside 0–1 and the near attributes —
a scaled Int16 and a shader read, ≈ −25 MB more, if the memory ask stays open.

## Iteration 58 — the dressing fade's outer edge 13 → 20 m: FAIL as a visible change, reverted (`agent/fable-2-dressing-fade-20`)

fable-5's re-read of §56 (06:28: the pair IMPROVED +27 % at 6.8 m, six views unchanged) named one edge: the owner said
5–20 m and the band ends at 13 m — "the outer edge is the knob". Measured: `DRESSING_NEAR_FADE_M` [7, 13] → [10, 20],
four poses along V20's bearing to the pale pair (camera at 6.8 / 11 / 16 / 20 m, eye 1.5 m):

| distance | changed px | on the pair |
|---|---|---|
| 6.8 m | 9 | inside both fades — unchanged, as it should be |
| 11 m | 384 (0.04 %) | fine σ 0.0228 → 0.0233 (+2 %) — the pair behind fern and grass blades |
| 16 m | 29 | the far skin and the near skin the same picture |
| 20 m | 2 | — |

Two reasons, both structural: beyond 10 m these stones stand behind the bank's ferns and grass from every ground-level
bearing (§14's finding at the hero boulders again), and where they show, the near skin's terms are 5–12 cm features —
under two pixels at 11 m, one at 20 — so the far skin already looks like the near skin there. The owner's range past
10 m wants form at 20–40 cm (planes, beds), which is geometry, not the skin. Reverted by forward commit; the 7–13 m
band of §56 stays. `dress58-southbank-6.8-11-16-20m.jpg` (the four head frames).

## Iteration 56 — the clearing's and backside's stones keep their near skin to 13 m (the owner's "stones under-detailed at 5–20 m", where a walker sees stone) — `agent/fable-2-dressing-fade` @ `0d86abbb`

§14 looked for this at the hero boulders and found them hidden by ferns at every 8–20 m pose. The stones a walker does
see at 5–20 m are the dressing sets: the backside's pale pair (6.8 m from `x-southbank-toe`), the clearing's west-bank
pair and slabs. Both used `heroMaterial`, whose near skin fades out at 4.0–6.3 m — so at exactly those poses they were
the smooth far skin. They now take their own near-capable material with `DRESSING_NEAR_FADE_M` = [7, 13] (plates, wet
band, lichen crust, relief 1.5 — the hero skin, further out). Both sets are off every fixed view by construction (the
clearing under the north toggle, the backside's spheres outside all six frusta, `backside.test`), which the capture
confirms: **E / C / D SSIM identical to four decimals, 0–4 px > 8 levels** (the capture's own noise), draws / tris equal.

| pose | fine σ (2 px residual, stone box) | changed px | read |
|---|---|---|---|
| `x-southbank-toe` (6.8 m) | **0.0171 → 0.0202 (+18 %)** | 1.5 % | the pale pair is a knapped stone with lichen flecks and a damp foot, not a smooth loaf (`dress56-x-southbank-toe.jpg`) |
| `x-southbank-toe-4m` | 0.0157 → 0.0158 | 0.1 % | inside both fades — unchanged, as it should be |
| `x-clearing-n` | 0.0264 → 0.0264 | 0.3 % | the box is the ledge (its own 7–14 m material); the clearing pair sits farther out |

Rocks tests 28/28, typecheck / build green; one material more (the dressing meshes draw only where their toggles show them).

## Iteration 54 — round-52 #3, V16's seams: five levers measured, none is "a seam value" — the dark area is the joints' edge length — FAIL to land, mapped (`agent/fable-2-seam-value`, all reverted)

fable-5's round-52 list puts V16 at #3 as "hardscape / fable-2 — a seam value, one commit". Measured on head `073f5ff2`
with fable-5's own read (joint-like dark pixels = blur-difference > 0.12 at 640 px, their boxes E 0.3–0.7 × 0.75–1.0,
C 0.45–1.0 × 0.62–1.0, D 0.35–0.7 × 0.72–1.0), one knob per build, E / C / D captured for each:

| build | E dark % · slab l | C | D | SSIM E / C / D vs head |
|---|---|---|---|---|
| reference | 3.1 · 0.491 | 1.8 · 0.425 | 2.5 · 0.474 | |
| head `073f5ff2` | 8.1 · 0.448 | 6.2 · 0.440 | 6.3 · 0.426 | |
| fill albedo × 1.3 (`SEAM_FILL_LIFT`, soil + mossy earth) | 7.8 · 0.448 | 6.0 · 0.440 | 6.1 · 0.427 | +0.0003 / +0.0004 / +0.0002 |
| slabs half as proud (`SLAB_PROUD_K` 0.5, rim floor too) | **8.9** · 0.444 | **7.1** · 0.436 | **7.1** · 0.419 | **−0.0020** / +0.0006 / **−0.0021** |
| painted crevice off (`CREVICE_STRENGTH` 0) | 7.4 · 0.448 | 5.9 · 0.440 | 5.7 · 0.427 | +0.0003 / +0.0004 / +0.0002 |
| joint sprouts hidden (E, pose tool, diagnostic) | 8.1 (control 8.0) | | | |
| (§45) flank stain 0.7 → 0.4, flank × 0.86, shoulder as bright as the top | 8.3 (from 8.2) | 6.3 | 6.3 | −0.0001 / +0.0001 / +0.0002 |

What the mask shows (`seams54-E-darkmask.jpg`, the counted pixels in red): **in the frame they are Link's shadow edge and
two joints — the frame's joints stay under the 0.12 contrast; in ours every slab is outlined along its full length.**
So §45's ratio (dark px / slab, 0.52 vs 0.51) compared our joints with the frame's shadows, and the fill value is a
lever in principle — but not in practice: the contrast curve is shifted at every threshold (share > 0.04: E 27 vs 17 %,
> 0.12: 8.1 vs 3.1 %, > 0.20: 1.7 vs 0.4 %), and no knob moves the low end at all (crevice off: 27.6 %). The joints
are lit as grooves (the shadow map on the proud lips and the painted recess), and there is 1.6 × as much joint edge per
box as in the frame. Sinking the slabs made it worse (more fill and tuft base in view). The one-constant answers give
≤ 10 % of the way; halving it is the paving's edge length and the joint's definition as a line — a hardscape rebuild,
not a value — and not mine without the module. Everything reverted by forward commits; the branch keeps the measures.
Files: `seams54-E-triple.jpg` (reference | head | fill × 1.3), `seams54-E-darkmask.jpg`.

## Iteration 50 — the pebble tiles' distance LOD: A 8.80 → 8.69 M (−110 K with §49), six views unchanged — `agent/fable-2-pebble-lod` @ `15fd5128` (stacked on §49)

The lever §49 named for A itself. Beyond `PEBBLE_LOD_M` = 10 m (camera to the tile's nearest point, ± 1 m band so a
walking camera never flickers a tile) a tile shows its far looks: the same eight recipes at `PEBBLE_LOW_DETAIL` = 0 (20
triangles, keyed forks of their own — the near looks and their streams are the geometry they were), merged per tile
like the near set and swapped in `nearUpdate`. A 3 cm pebble at 10 m is ≈ 9 px. BEFORE = §49's capture (same head),
AFTER captured here:

| view | SSIM (head → tiles → LOD) | changed px vs tiles (> 8 / > 40) | draws | triangles head → tiles → LOD |
|---|---|---|---|---|
| A_stairs | 0.2291 → 0.2291 → 0.2291 | 104 / 3 | 447 | 8.80 → 8.77 → **8.69 M (−110 K)** |
| B_house | 0.1965 = = | 184 / 1 | 428 | 7.95 → 7.92 → 7.86 M (−90 K) |
| C_lookback | 0.2201 = = | 66 / 1 | 342 | 7.05 → 6.95 → 6.93 M (−120 K) |
| D_log | 0.2788 = = | 99 / 0 | 393 | 8.18 → 8.14 → 8.09 M (−90 K) |
| E_ground | 0.2182 → 0.2182 → 0.2181 | 184 / 1 | 428 | 7.95 → 7.92 → 7.86 M (−90 K) |
| F_canopy | 0.2420 = = | 1 / 0 | 403 | 8.09 → 7.96 → 7.96 M (−130 K) |

The changed pixels are the far pebbles' silhouettes (≤ 0.02 % of a frame, at most three strong); `pebbles56-A-lod-pair.jpg`
shows A's far plaza at ×3, before | after — specks either way. Draws as §49 (one mesh visible per tile). W24's count
untouched. Tests 28/28, typecheck / build green. Together the two commits give A 310 K of headroom under W38's ceiling
where tick 213 had 200 K.

## Iteration 49 — the path pebbles merged per 10 m tile: −30 … −130 K triangles per view, pixels identical — `agent/fable-2-pebble-tiles` @ `1e2777be`

fable-cursor (tick 213): A at 8.80 M against W38's 9.0 M ceiling — "nothing more on A's side of the canopy without a
matching cut". A cut from rocks: the path pebbles were eight `InstancedMesh`es (one per look), each with a bounding
sphere spanning the whole scatter (radius 84 m), so every fixed camera drew all 2 042 pebbles × 80 triangles whether
one was in its frustum or not. `PEBBLE_TILE_M` = 10: the same instances, looks baked in, merged into one static mesh
per 10 m ground tile; three.js culls tile by tile. Positions, looks and the W24 count (`systems.rocks.pebbles` 3 151,
main 2 042) untouched — 20 tiles replace the eight look-meshes; the north set stays under its toggle. BEFORE = head `0963c09d`, AFTER = `1e2777be`, both
captured here (`--settle 12`):

| view | SSIM (both) | changed px | draws | triangles |
|---|---|---|---|---|
| A_stairs | 0.2291 | **0** | 442 → 447 (+5) | 8.80 → 8.77 M (**−30 K**) |
| B_house | 0.1965 | 0 | 424 → 428 (+4) | 7.95 → 7.92 M (−30 K) |
| C_lookback | 0.2201 | 0 | 341 → 342 (+1) | 7.05 → 6.95 M (**−100 K**) |
| D_log | 0.2788 | 0 | 390 → 393 (+3) | 8.18 → 8.14 M (−40 K) |
| E_ground | 0.2182 | 0 | 424 → 428 (+4) | 7.95 → 7.92 M (−30 K) |
| F_canopy | 0.2420 | 2 | 407 → 403 (−4) | 8.09 → 7.96 M (**−130 K**) |

A keeps most of the plaza in view, so culling alone buys it 30 K; the lever for A itself is a per-tile distance LOD
(a 20-triangle look for tiles beyond ≈ 10 m, swapped in `nearUpdate` — a 3 cm pebble is ≈ 9 px there) — the next
iteration if fable-cursor wants A's triangles specifically. Tests 28/28 (`tiers.test` serves `BufferGeometryUtils`
to the module loader), typecheck / build green.

## Iteration 47 — the thinner timber (13–16 cm) measured on outward faces: worse on every number — FAIL, reverted (`agent/fable-2-logs-thin` @ `de1d607f`)

fable-5's r53 §B named three levers for the flight's weight at A: a paler drier crown (§46, landed), the 13–16 cm timber,
the treads' light (V17). The timber measured on the current head (`445fa453`, the grey-tan tint in): `LOG_RADIUS`
0.08–0.1 → 0.065–0.08 (`a45b935b`), BEFORE and AFTER captured on this VM.

| | fable-5's box (dark l < 0.25 / pale l > 0.45 / mean l) | lips / troughs | A | C | F |
|---|---|---|---|---|---|
| reference A | 15.7 % / 14.2 % / 0.345 | 100 / 85 | | | |
| head `445fa453` (16–20 cm) | 39.4 % / 13.0 % / 0.302 | 94 / 71 | 0.2291 | 0.2201 | 0.2420 |
| `a45b935b` (13–16 cm) | **41.6 % / 12.1 % / 0.296** | 93 / 70 | **−0.0016** | +0.0001 | −0.0007 |

Draws and triangles identical (442 / 8.80 M at A). Once the crown is the flight's pale element (§46), a thinner log exposes
more of the dark riser and tread behind it — the box gets darker, not paler; the −0.003 of §39's take 5 was the same
effect through inward faces. So the dark share that remains (39 vs 16 %) is the stone's — the treads' and risers' light,
V17 — and the timber's thickness is not a lever for it. Reverted by forward commit; the branch keeps the measurement.
Files: `logs54-3rd-tread-pair.jpg` (2 m: 16–20 cm | 13–16 cm).

## Iteration 46 — the stair timbers re-tinted on outward faces: A +0.0087, F's cost gone — `agent/fable-2-logs-tint` @ `c1e7d115`

Astra (fable-cursor 18:10, `27c2e3c8`): the tube's 20,160 side triangles in `logNosings.ts` were wound inward — with
FrontSide the render (and fable-5's rays) saw the far inner wall through each log, not its crown. Every tint take of §39
(dark timber, bleached crown, thinner logs) was tuned against that inner wall, and the timber's effective albedo was never
looked at: `bark_brown_02` has a linear mean of 0.113 / 0.091 / 0.047 and the arch's `0x6e6258` multiplies it by ≈ 0.15 —
**≈ 2 % albedo**, near-black wood. On the head with her fix, the A frame's flight box (0.62–0.88 × 0.25–0.70, row profile
at 200 × 120; lips = local row maxima, troughs = minima):

| A flight box | mean l | dark (< 40) | saturation | lips / troughs |
|---|---|---|---|---|
| reference A (§6.6b: bark `#746d5d` lit, `#453e32` shadow) | 90 | 1.2 % | 0.29 | **100 / 85** |
| head `c11f0ff4`, `LOG_FLIGHTS` emptied (no logs) | 74 | 5.9 % | 0.30 | 86 / 67 |
| take-2 logs, faces inward (what take-0129 measured) | 71 | 7.1 % | 0.30 | 81 / 64 |
| head `c11f0ff4`: faces outward, tint `0x6e6258` | 65 | **13.6 %** | 0.33 | **68 / 63** |
| `c1e7d115`: `LOG_TINT` 1.35 / 1.5 / 2.3, floor tint `#746d5d` | 81 | 5.7 % | 0.32 | **94 / 71** |

The reference's flight is a tan base with lit lips 15 points over the treads behind; ours with outward dark logs had the
dark timber exactly where the lit lips belong (68 over 63 — the alternation gone, the dark share doubled). Seven tints at
A + the 2 m head-on pose: lifting alone (×1.8 / 1.85 / 2.4) puts the lips at 100 but the flight's saturation at 0.36 whatever
the albedo — the shade floor's light tint was the arch's `HOUSE_BARK_TINT` (a saturated brown); with the reference's own
lit bark tone as the floor tint the saturation comes to 0.32. The landed pair is 0.8 × that lift (our whole flight runs
≈ 15 points darker than the frame's — troughs 71 vs 85 — so lips ≈ 94 keeps the frame's lip / trough relation instead of
its absolute), cooled so the texture's orange R/B 2.4 comes to ≈ 1.4. `LOG_TINT`, `LOG_FLOOR_TINT` in `logNosings.ts`;
the winding line is Astra's and untouched; tests 4/4 (hers included), typecheck / build green.

Six views, all captured on this VM on head `c11f0ff4` (its take-2 tint, and once more with `LOG_FLIGHTS` emptied) and on
`c1e7d115`:

| view | head, no logs | head `c11f0ff4` (take-2 tint, faces outward) | `c1e7d115` | Δ vs head | Δ vs no logs | draws / tris |
|---|---|---|---|---|---|---|
| A_stairs | 0.2217 | 0.2204 | **0.2291** | **+0.0087** | **+0.0074** | 442 / 8.80 M |
| B_house | — | — | 0.1965 | 0 (flight ≈ 54° off axis, outside the 37° half-FOV) | — | 424 / 7.95 M |
| C_lookback | 0.2216 | 0.2199 | 0.2201 | +0.0002 | −0.0015 | 341 / 7.05 M |
| D_log | — | — | 0.2786 | 0 (flight behind the camera) | — | 390 / 8.18 M |
| E_ground | — | — | 0.2182 | 0 (E's frame ≡ B's) | — | 424 / 7.95 M |
| F_canopy | 0.2415 | 0.2376 | **0.2420** | **+0.0044** | +0.0005 | 407 / 8.09 M |

So the logs now *pay* at A (+0.0074 over the flight without them) and are free at F (take-0129's −0.0104 was the inward
faces: Astra's fix alone brought it to −0.0039, the tint the rest). Files: `logs50-A.jpg` (reference | inward | outward
dark | tinted, A's flight), `logs50-3rd-tread.jpg` (the 2 m head-on pose, same three), `logs50-w23-stairs-f.jpg`.

In fable-5's measure (19:00 note; flight box 0.60–0.92 × 0.25–0.70, dark l < 0.25 / pale l > 0.45 — the thresholds that
give the frame their 15.8 / 14.0 %): reference **15.8 % dark / 14.0 % pale / mean l 0.344**; take-0129 51.8 / 8.2 / 0.268
(theirs 52 / 8 / 0.267); head `c11f0ff4` 60.6 / 7.3 / 0.250 (theirs 61.5 / 7.3 / 0.248); the same head without logs
46.9 / 9.9 / 0.280; **`c1e7d115` 39.4 / 12.8 / 0.302**. The timbers now sit below their own absence on the dark share;
the 39 → 16 % that remains is the treads' light (V17), hardscape's stone tint.

## Iteration 45 — V16's seams, taken and measured: the tone and the rim are the frame's already; the lever is the COUNT of dark features (FAIL to land, the finding reported)

Announced 17:40 and taken on `agent/fable-2-seams`. The hypothesis of §43 (the slab's stained flank + shaded shoulder widen
the seam into a dark rim) tested as three constants — flank stain 0.7 → 0.4, the flank ×0.86 instead of ×0.76, the shoulder
as bright as the top — and it moved **nothing**: joint-dark share E 8.2 → 8.3 %, C 6.2 → 6.3 %, D 6.3 → 6.3 %; SSIM E −0.0001,
C +0.0001, D +0.0002. Reverted (forward commit; the branch keeps the negative result).

What the pixels say instead (blur-difference > 0.12 at 640 px, per box, reference vs ours):

| | dark px mean l / slab mean l → ratio | dark runs: median width / p90 / **count** |
|---|---|---|
| reference E | 0.253 / 0.491 → 0.51 | 2 px / 5 px / **262** |
| ours E | 0.233 / 0.451 → 0.52 | 2 px / 8 px / **573** |
| reference D | 0.247 / 0.474 → 0.52 | 2 px / 4 px / **240** |
| ours D | 0.237 / 0.429 → 0.55 | 2 px / 6 px / **483** |

The seam's darkness ratio is the frame's (0.52 vs 0.51 — round 50's fill tone was right) and the median line is as thin
(2 px); what doubles the dark AREA is **twice as many dark runs** and a fatter tail: more dark features per stone — the
broken-slab splits, the notches and chipped corners, and the joint tufts (the E zoom, `seams43-E-pair.jpg`: every joint of
ours sprouts a dark tuft; the frame's joints are bare soft lines with a plant here and there). So V16's next pass is
fewer dark features per stone (split cells / notches / tuft density on the plaza and spine), not a tone or a rim — and
those touch the W06 / W15 turf contracts, so it is hardscape-32's or a lane with the go, not a two-constant evening.

## Iteration 42 — the stairs' pitch, projected before claiming it: steepening does not buy the frame's riser spacing at A

fable-cursor (14:50, tick 207): the log nosings merged (F −0.0104 named as the owner's look change), vegetation's W23 contracts
fixed on their side, and "open for anyone with capacity: the stairs' pitch (fable-5: the demo's 35–40°) — announce before
taking". fable-5's §9 inference was: riser spacing along the flight's centre in A ≈ 11 px (demo) vs ≈ 14 px (ours) → ours
1.3 × the tread depth, or a gentler pitch. Before announcing, the flight projected into camera A for the layout and for the
demo's pitch with either end held:

| flight | slope | run | riser spacing in A, median px (min–max) | foot in A | top in A |
|---|---|---|---|---|---|
| layout: 20 × 0.27 / 0.54 | 26.6° | 10.8 m | **14.0** (8.8–28.0) | (0.674, 0.628) | (0.764, 0.219) |
| tread 0.42, top fixed | 32.7° | 8.4 m | 13.2 (9.3–21.2) | (0.704, 0.596) | same |
| tread 0.42, foot fixed | 32.7° | 8.4 m | 15.1 (10.1–26.3) | same | (0.753, 0.194) |
| tread 0.36, top fixed | 36.9° | 7.2 m | 12.8 (9.6–18.9) | (0.715, 0.584) | same |
| tread 0.36, foot fixed | 36.9° | 7.2 m | 15.7 (11.0–25.4) | same | (0.746, 0.179) |

A looks along the flight nearly radially (the layout's own note: bearing ≈ 55°, 16° off the camera's), so the image spacing
of the risers is perspective distance, not pitch: the demo's 37° moves the median 14.0 → 12.8 px at best (top fixed) and
*widens* it foot-fixed, never reaching 11 px — and the top-fixed variants slide the foot 1.2–3.6 m up the run, off the
composition the layout fitted to frames 1 s / 8 s (rms ≤ 0.6 px) and off the pots, the V21 rock, the kokiri spot and the
fence that stand at the flight's ends. So the 11 vs 14 px is a camera-distance / framing difference, not a tread-depth one,
and the pitch is not the lever for A. Not claimed; the numbers go to fable-cursor and fable-5. (If the demo's steepness at
`d_105` is wanted for the head-on read, it is a heading-specific check: project into `d_105`'s camera, which we do not have.)

## Iteration 40 — take-0128: W23 passes; the log nosings back at the take fable-5 measured — `agent/fable-2-stairs-logs` @ `e3cc18f3`

take-0128 sealed on the W23 move: D hue error 6.44° → 4.82°, A +0.0003, C +0.0012, D +0.0007, E −0.0030 (the rock in E's left
third — named), F +0.0004; fable-5's re-verdict: **W23 → pass** (fail since take-0116; "the boulder stands at the frame's rock
spot, layered with a moss cap, lit — stone l 0.28 / 53° / 0.23 vs the frame's 0.29 / 50° / 0.32"), 40/50 with their verdicts.

fable-5 (12:50) measured the logs at `a91dfec2` (take 2 of §39: 16–20 cm timbers, crown 6 cm proud, the arch's shade floor):
**A −0.0009, C −0.0016, F −0.0104** — "at A the steps carry the frame's dark rounded timbers; head-on it is `d_105`'s read;
W02 turns to pass at the next take; F's −0.0104 is V16's kind of cost — name it and merge; if F must come back, the lever is
the treads' brightness (V17), not the logs." My later takes (dark timber, bleached crown, thinner logs) cost A −0.0030 …
−0.0033 for no F gain, so the branch is back at the measured take by a forward commit (`e3cc18f3` ≡ `a91dfec2` in the module).
fable-3 (12:35): no race on the stairs; their `board` / `lashing` builders offered — the stakes stay cylinders on the one bark
mesh. Open from §9 after this: the pitch (fable-cursor's call), the banks rising beside the flight (terrain), the haze gap (V17).

## Iteration 39 — hardscape (fable-cursor's offer): the hero flight's log nosings + end stakes — `agent/fable-2-stairs-logs` @ `f909c004`; reads log-risered at player height, F pays ≈ −0.011 in every variant

fable-cursor (10:45): hardscape unowned; "round bark-timber nosings on the main flight, the pitch per fable-5's measurement
— announce and take it". Taken (the nosings + stakes; the pitch stays fable-cursor's call: fable-5's 35–40° against the
layout's frame-fitted 26.6°, wired into the terrain carve, vegetation contracts and Link's fixture).

Built: `hardscape/logNosings.ts` — one bark mesh over the untouched stone flight (`STAIR_LOGS` flag): a round timber along
every riser's top edge riding the slab's front (crown 0.7 r proud, front tangent 10 cm past the nose line), bark ridges,
sawn ends, damp underside, moss and a weathered crown on top; a short stake at each log end every second step. Structures'
`logBark` recipe on `bark_brown_02`; 20 logs + 20 stakes, 21 K tris, +1 draw. Five takes:

| take | logs | A | C | F |
|---|---|---|---|---|
| 1 | 16–20 cm, crown 3.5 cm (rode under the slab nose: a stone stair with a bark band) | — | — | — |
| 2 | crown 0.7 r, arch's ×10 shade floor (lit half pale grey) | −0.0010 | −0.0016 | −0.0102 |
| 3 | dark timber (floor 3, tint 0x5a4e44) | −0.0033 | −0.0017 | −0.0129 |
| 4 | + bleached silver-grey crown | −0.0030 | | −0.0124 |
| **5 (branch)** | **13–16 cm, brighter crown** | **−0.0033** | | **−0.0107** |

(head `f728813e`: A 0.2212, C 0.2239, F 0.2420; draws A 443 / 8.63 M.) At player height the flight is log-edged — dark
timbers with pale treads behind them and stakes at the flanks (`logs42-w23-stairs-f.jpg`, before | after). In the six views
the cost is structural and no tint moves it: the stone flight's thin bright lips over dark risers are exactly what
reference A and F show (the demo's lips are lit from above through the gap — V17), and a timber in our canopy shade turns
each lip into a dark band (`logs42-A_stairs-triple.jpg`, `logs42-F-flight-triple.jpg`). So the logs are the demo's
material and not the demo's light: an owner-approved look change to name (the frame the rubric describes, V18′), or held
until the light over the flight exists. Not merged; fable-cursor's call.

## Iteration 38 — the W23 move's vegetation contracts, checked in a scratch tree: the anchor alone is not enough

fable-5 (09:50) measured the move — "at D the frame's rock is finally where the frame has it and lit … luminance and hue
matched for the first time; W23 is a near pass on the next take; E pays; vegetation's contracts have to move before this
merges." To hand vegetation a verified patch I tried the one I named in §36 in a scratch working tree (their file, not
committed): the cluster anchor pinned to the old constants (−3.2, −10.2) instead of the rock. **Both tests still fail**,
because the failures are not the cluster's:

- `carpet.test` "lawn band: 0.93 clumps / m²" measures the box **[−3.1, −8.4, −1.9, −6.6] — the very ground the rock now
  stands on** ((−2.0, −7.6), clearRadius 0.9): its exclusion disc empties most of that 1.2 × 1.8 m box. The frame's lawn
  band there IS part rock now; the contract's box has to shrink or exclude the disc.
- `plants.test` "Hero fern crowns west of the shot-D boulder" (≥ 3 within 1.6 m of (−3.7, −10.3)): the hero-fern tries
  reject `insideBoulder` — with the rock gone from the old spot the acceptance stream shifts and the count at the pinned
  point drops, whatever the anchor.

So the move needs vegetation to re-derive the two contracts (and decide the cluster's anchor — with the frame's clump left
of the rock, it may well follow the rock as it does today, which is also what E pays for). Reported; the scratch patch
reverted; nothing of vegetation's touched in any branch.

## Iteration 37 — the form planes re-measured on the moved rock (scratch, not landed): a fifth of the missing contrast, D −0.0013

With the rock 5.2 m from D and 4 × the pixels, the §19 form planes (flat top, chamfer crest, shoulder, 40° undercut) got one
more measurement, as a scratch merge of `agent/fable-2-form` onto the move. Stone pixels (greys + tans) in the rock's D box
0.01–0.20 × 0.68–0.92:

| | mean l | σ | p10 / p90 | D vs reference |
|---|---|---|---|---|
| move only (§36) | 0.306 | 0.063 | 0.220 / 0.382 | 0.2784 |
| move + planes | 0.307 | 0.075 | 0.198 / 0.389 | 0.2771 (−0.0013) |
| the frame's rock (0.04–0.40 × 0.62–0.90) | 0.431 | 0.130 | 0.234 / 0.595 | |

The planes add a fifth of the missing σ — all of it from the undercut's shade (p10 down), none from a lit plane (p90 flat at
0.39 against the frame's 0.60) — and cost D 0.0013. Not proposed. The frame's contrast is light on the rock; W23's
re-verdict after the move rests on the layout move and, for "one plane", on the canopy's light.

## Iteration 36 — W23's layout move, done and measured — `agent/fable-2-w23-move` @ `438be703` (one line in `layout.ts`, fable-cursor's 07:45 go)

fable-cursor: "move `shot-d-boulder` to (−2.0, 0, −7.9) r 0.75 yourself; keep ≥ 0.3 m from the emergent column's bole at
(−3.1, −7.9) or slide 0.3 m east; report D and the path clearance." The geometry does not allow all of it: at z −7.9 the
gap between the bole's edge (x −2.8) and the paving's west edge (x −1.42) is 1.38 m, so **r 0.75 cannot keep 0.3 m from
the bole without 0.17–0.47 m over the paving** (r ≤ 0.54 for both; sliding east puts it on the path). Landed instead:
**(−2.0, 0, −7.6) r 0.6** — 0.24 m nominal from the bole, 6 cm over the paving's west edge (the frame's rock sits ON the
path's edge), 5.2 m from D's camera; the size comes from the distance: 0.6 at 5.2 m is 38 % larger in D than at 7.2 m.

| view | head `f728813e` | move | note |
|---|---|---|---|
| D_log | 0.2779 | **0.2784 (+0.0005)**, frame hue error 6.53° → **4.91°** | the rock at the path's edge, bottom-left, in front of the ferns — the frame's composition (`w23move39-D_log-triple.jpg`) |
| A_stairs | 0.2208 | 0.2212 (+0.0004) | |
| E_ground | 0.2210 | **0.2173 (−0.0037)** | vegetation's authored fern + broadleaf cluster is anchored to the rock (`plants.ts` 461–466) and moved with it, leaving E's left bank sparse where the frame has it leafy (`w23move39-E_ground-triple.jpg`) |

Draws / tris: D 391 / 8.09 M (390 / 8.08), A 441 / 8.59 M, E 420 / 7.76 M. **Tests: 74 / 76** — `plants.test` ("Hero fern
crowns west of the shot-D boulder", pinned to (−3.7, −10.3)) and `carpet.test` ("lawn band: 0.93 clumps / m²", the moved
cluster now lies over the lawn band) — vegetation's contracts, not mine to edit. So the move is right at D and wrong at E
for one reason: the fern cluster should stay where E and the frame have it (the old anchor (−3.2, −10.2) as constants)
while the rock moves — vegetation-26 / 28's one change; then E comes back and both tests hold. Not merged; fable-cursor's
call with the E cost named.

## Iteration 35 — W23's "still greener": the D rock's moss cap measured against the frame — `agent/fable-2-dmoss` @ `5f37580e` (one commit, for fable-5's call)

The frame's D rock box (0.04–0.18 × 0.66–0.84) is **99.5 % stone, 0.3 % green** (l 0.334, 52°): the greenery the frame has
is the plants above and behind the rock, not moss on it. Ours carried a moss cap (moss 0.85, side 0.45) since the loaf
branch ("the cap keeps its moss" — fable-5, 13:25 yesterday); the pre-read now says "still greener". So the rock near-bare:
moss 0.25 (the collar only), side 0.15, the near lichen crust 0.6 → 0.3.

| | D: rock-top box 0.086–0.156 × 0.56–0.63 (stone l / p90) | D: rock box green share | D SSIM vs reference | 2 m (`sn-boulder-shotd`) box green share |
|---|---|---|---|---|
| head `48156889` | 0.315 / 0.466 | 12.8 % | 0.2796 | 30 % |
| moss cap off | **0.337 / 0.508** (frame 0.334 / 0.501) | 14.8 % | 0.2795 (−0.0001) | **14 %** |

The rock's own top goes to the frame's luminance; the green share inside D's box does NOT drop — it is the fern bank
behind the rock's top edge (vegetation-26's exclusion disc), not the cap. At 2 m the rock is a bare ochre boulder with
moss at the collar (`dmoss38-sn-boulder-shotd.jpg`; D 4 × in `dmoss38-D_log-tight.png`). Not landed: fable-5 asked for the
cap once and for less green now — their call on the sealed take; the six-view cost is nil (D −0.0001, A / E see the same
pixels as the hue step).

## Iteration 34 — W23's "still smaller": the D boulder at r 0.75, and where the frame's rock actually stands

fable-5's take-0126 pre-read: "W23's D face is a warm tan now, paler than take-0125's, still smaller and greener than the
frame's — a near fail." Size is the layout's radius (0.6). Scratch build (rock only, nothing landed): **r 0.75** at D on the
merged head:

| | D vs reference | stone share of the box 0.05–0.30 × 0.50–0.80 | stone l / hue / sat |
|---|---|---|---|
| r 0.6 (layout) | 0.2796 | 41.2 % | 0.305 / 60° / 0.35 |
| r 0.75 | 0.2802 (+0.0006) | 42.9 % | 0.290 / 56° / 0.34 |

Two points larger, still behind the fern bank (`dsize37-D_log-triple.jpg`). The frame's rock is not a bigger rock at our
spot: ray-casting the reference's rock (bottom-left, x 0.05–0.40, ground contact ≈ (0.22, 0.86)) onto our terrain lands
at **≈ (−2.0, −7.9), 5.5 m from D's camera, at the path's west edge** (ground 0.08, off the paving) — 1.9 m south-east of
the layout's (−2.6, −9.6), in front of the ferns, and lit. §33's SE / S probes stood within 0.6 m of that spot and read
l 0.27–0.28: **the position is reachable (layout), the light is not (trees / lighting)** — both outside rocks. The rock's
id-specific look (ochre tint, bare camera side, moss cap) follows whatever position and radius the layout gives it.

## Iteration 33 — round 51's "light on the D face (W23)": a position probe — no shift within 1.6 m leaves the shade

fable-5's round-51 turn order names "light on the D face (W23)" with §L's two options: light on the boulder's south face,
or the boulder out from under the giant's canopy. The second is a layout move (fable-cursor's), so here is what it would
buy, measured: four scratch builds (the rock alone moved, nothing landed) rendered at D on the merged head `48156889`,
the boulder's stone pixels in its projected box:

| shot-D boulder at | in D | stone mean l | p90 |
|---|---|---|---|
| (−2.6, −9.6) — the layout's | 7.2 m | **0.293** | 0.397 |
| +1.2 m east (−1.4, −9.6) | 6.9 m | 0.281 | 0.428 |
| south-east (−1.6, −8.4) | 5.8 m | 0.279 | 0.394 |
| +1.6 m south (−2.6, −8.0) | 5.8 m | 0.269 | 0.330 |
| −1.6 m north (−2.6, −11.2) | 8.7 m | 0.282 | 0.361 |

Every spot is as shaded as the layout's (`dlight36-D_log-shifts.jpg`): the giant's canopy shadow covers D's whole left
foreground, so **the position is not the lever — light on the face is** (a warmer fill or a canopy gap over the bank:
trees / lighting, not rocks; the frame's rock reads l 0.33 with lit planes). The stone's hue and chroma are on the frame
now (55° / 0.36 vs 52° / 0.36) after the hue branch merged.

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
