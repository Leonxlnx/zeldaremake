# fable-5 — round-54 reviews (`agent/fable-5-r54-review`)

Continues `fable-5-r53-branches.md` after `fdaeed8a` merged it. Same method.

## A. Iteration 46 (20:29–20:50 UTC) — the head `c11f0ff4` → `445fa453`: fable-2's stair-timber tint (my r53 §B numbers answered), the arch rim, Astra's character/collision imports

fable-2 reproduced the r53 §B flight-box measure and tinted the timbers to the frames' lit grey-tan now that
the faces wind outward (`6e28a1a6`). Same seven positions on both heads:

| view | change | SSIM vs reference |
| --- | --- | --- |
| **A_stairs** | 5.3 % (the flight) | 0.1953 → 0.2040 (**+0.0087** — the largest single A gain of the rounds) |
| **F_canopy** | 5.7 % (the flight) | **+0.0040** |
| B / C / D / E | 0.07 / 0.76 / 0 / 0.07 % | −0.0002 / +0.0002 / 0 / −0.0003 |
| `w05-spine-d` | pixel-identical | — |

Flight box at A (0.60–0.92 × 0.25–0.70): **reference 15.8 % dark / 14.0 % pale, mean l 0.344; before
61.5 / 7.3 / 0.248; now 40.7 / 13.1 / 0.300.** The pale share is the frame's; the dark share is still
2.6× — what remains dark is the treads between the timbers, in the giants' canopy shade (V17). The
flight now reads as the frame's: pale timber lips over dark troughs, the treads showing between. W02's
pass (take-0129) is reinforced in weight, not only kind. The rest of the head's delta (the arch mouth
rounding — round-50 #12, my tunnel nit — and Astra's character/collision) is outside the six frames.
Sheet `fable-5-r54/fable-5-r54-f2-logs-tint.jpg`.

## take-0130 (`8873d4e`, sealed ~20:05): frames vs take-0129 A 0, B +0.0001, C 0, D −0.0001, E +0.0002, F 0 —
pixel-identical to 0.03 %: the north stand, shelf mouths and pitch note are outside the six frames. All
verdicts carry (41/50 with W02). Nothing filed.

## B. Iteration 47 (21:30–21:55 UTC) — fable-3's arch rim (`4f164925` + the 4 cm tuck `0f78c848`, merged): round-50 #12, my tunnel nit

The log arch's mouth faces roll into the bore (a 0.32 m quarter-round, occlusion graded); the roll's end
tucked 4 cm behind the tube wall where it z-fought. Before = `c11f0ff4`, after = `445fa453`, the three
arch poses:

| pose | before → after | note |
| --- | --- | --- |
| `x-arch-approach` | 1.9 % of pixels | the right cheek's vertical value step — the seam I flagged in r49 §E — largest column step in l across x 0.75–0.95: **0.0084 → 0.0034 (−60 %)** |
| `x-arch-tunnel-n` (`d_121` pose) | **pixel-identical** | frame 0.144, belly 0.092, window 0.284, walls 0.054 / 0.048, floor 0.10 — the tonal numbers of r49 §E stand; the floor nit (0.10 vs the frame's 0.161) is untouched |
| `x-clearing-back` | 7 px | the roll is not visible from the north portal at 10 m |

**Nit #12 mostly closed.** The seam where the near cheek met the far wall is graded now rather than
stepped; from inside the tunnel nothing moves. Sheet `fable-5-r54/fable-5-r54-f3-arch-rim.jpg`.

## C. Iteration 48 (22:26–23:00 UTC) — Astra `agent/astra-leaf-warmth` @ `a3fe274f`: the warmth term as its own branch (§7.1's ask)

`leaf-color.ts` + `materials.ts` (the luminance-preserving warmth on the leaf materials, restored "without
changing tree geometry"); base = the head `0963c09d`; tsc + build green. Same seven positions:

| view | head → warmth | SSIM vs reference |
| --- | --- | --- |
| A, B, C, D, E, F | 0.00 % of pixels beyond 24 levels — a low-amplitude colour shift only | 0 / 0 / +0.0001 / −0.0001 / 0 / **+0.0006** |
| `w05-spine-d` | pixel-identical | — |

Canopy band (top 35 %), median foliage hue — reference / head / **warmth**:

| frame | reference | head | warmth |
| --- | --- | --- | --- |
| C_lookback | 68.6° | 84.5° | **72.9°** |
| D_log | 63.8° | 68.6° | **63.8°** (on the frame) |
| F_canopy | 60.0° | 77.5° | **73.8°** |
| A_stairs | 63.8° | 76.4° | 75.0° |
| B_house / E_ground (the house cap, near) | 61.4° / 64.8° | 69.0° / 69.1° | 68.9° / 69.0° (untouched) |

Saturation and luminance held to ±0.01 everywhere.

**Budget-free and aimed right — merge.** The far crowns move 4–12° toward the frames (C-top −11.6°,
D-top exactly onto the frame's 63.8°); the six views do not pay for it. What it does not reach, as in
r49 §K: the near canopy — B/E's house cap sits at 69° against 61–65°, and A/F's canopy band at 73–75°
against 60–64° is the mid layer. The remaining 8–13° of "trees too green" is that layer's; the term is
proven on the far one. Sheet not needed — the numbers are the evidence; the crops would show nothing at
this amplitude.

## D. Iteration 49 (23:25–23:50 UTC) — the head `0963c09d` → `110453d4`: Astra's warmth 0.5 and three-bank-core recession imported, pebble tiles/LOD, deck lane, arch roll 2

Same seven positions on both heads:

| view | change | SSIM vs reference |
| --- | --- | --- |
| A_stairs | 1.3 % (r0c3 4.6 % — the top-right crown) | **−0.0027** |
| B_house, D_log, E_ground, `w05-spine-d` | pixel-identical | 0 |
| C_lookback | 1.8 % (r0c0 2.8 % — the top-left crown) | **−0.0040** |
| F_canopy | 2.6 % (r0c2 3.8 % — the crown over the flight) | **−0.0104** |

**The warmth landed and is innocent; the bank-core recession is the regression.** Canopy-band hue:
C-top 84.5° → 72.0°, D-top 68.6° → 63.8° (on the frame), F-top 77.5° → 72.9°, A-top 76.4° → 73.6° — the
warmth measured alone in §C at ≤ +0.0006. The SSIM loss is elsewhere: the changed pixels at the frame
tops go from dark canopy (l 0.22–0.25) to haze-white (**0.40–0.56**) — the stair-bank giant's groups
24/25/26 cores at 60 % radius (Astra's PR #29, `88fd4d69`, source-only) let the haze through where the
frames have canopy mass. It is r49 §F's failure mode again, smaller: F −0.0104 is 3× the budget, C over,
A inside. **This is on the head now** — the next take pays it unless it is reverted or the cores keep a dark
backing behind the layered lobes (the fix I asked for in r49 §F). Sheet
`fable-5-r54/fable-5-r54-head-110453d4-F.jpg`.

## E. Iteration 50 (00:28–01:05 UTC) — the head `110453d4` → `da314d7c`: fable-4's white-bark LOD give-back (lodthin) + Astra's heel guard

fable-4's W38 give-back: the white-bark distance meshes keep one lamina in 8 / 16 at 2.53 / 3.67× (was
6 / 12 at 2.19 / 3.18×, the same covered area); medium/low leaf tris −22 %, the high mesh byte-identical.
Same eight positions:

| view | change | SSIM vs reference |
| --- | --- | --- |
| A, B, D, E, `w05-spine-d` | **pixel-identical** | 0 |
| C_lookback | 0.8 % (the far white-barks) | −0.0004 |
| F_canopy | 0.0 % | −0.0001 |
| `wb-grove-10m` | 3.5 % — the medium-LOD stems' leaves fewer and larger | — |

**Harmless, as claimed (fable-4's own table: C −0.0004, F −0.0001; A 8.76 → 8.74 M).** A W38 give-back
that the fixed frames cannot see. Nothing to add.

The PR #29 regression flagged in §D (A −0.0027, C −0.0040, F −0.0104) is still on the head at `da314d7c`;
the next take pays it unless it is pulled first.

## F. Iteration 51 (01:38–02:00 UTC) — the ranked list re-cut for round 52 (no take since 0131; take-0132 lost to a timeout, 0133 running)

Where the score stands with my verdicts: **41/50, Phase 1 36/42**. Visual fails left: W05, W09, W10, W30,
W31, C01, C02, U02 (+ W37, an auto item). Since the round-50 list: W02 (log risers), W08 (the hero
stem), W23 (the D rock), W06 (the verge band) turned; the tunnel, the backside, the plateau roof, the
north stand, the anchor at C, the shelf mouths, the hearth, the arch rim landed. Ordered by the owner's
priorities (stones, trees, distance) and then by what turns a verdict:

| # | item | what the frames still want | system | verdict it turns |
| --- | --- | --- | --- | --- |
| 1 | **PR #29's bank-core recession on the head** | pull it or back the receded lobes with a dark core — F −0.0104, C −0.0040 (§D) before the next seal books it | Astra / fable-cursor | protects W10/W11's reads |
| 2 | **the canopy's near/mid hue** | the house cap at 69° and A/F's canopy band at 73–75° against the frames' 60–65°; the warmth reached the far crowns only (C-top 72°, D-top on the frame) | Astra (near-canopy / cluster materials) | the owner's "trees too green" |
| 3 | **V16's seams** | joint-like dark area 2.5–3.4× the frame's at E/C/D (fable-2's re-measure agrees); slabs 0.03 dark | hardscape / fable-2 | W03's note |
| 4 | **the flight's treads** | the A flight box 40.7 % dark vs the frame's 15.8 % after the tint; thin logs did not help; the treads sit in canopy shade where the frame's climb into a haze gap (V17) | canopy gap / atmosphere over the flight | V17 |
| 5 | **W09 giants** | no flare, no limbs at frame scale; the bark is brown now (take-0127) and the emergent's cushions thinned — the form is the gap | trees / giants | W09 |
| 6 | **W10 canopy at F** | "dense, layered canopy with light breaking through": F's top still opens to haze/sky between lobes; the plateau roof closed the look-up, not F | canopy (owner-fable) | W10 |
| 7 | **V2's window** | trunks are there (the stand) but dark (0.284 vs 0.326); no lights; the ground plane shows | astra-distance / atmosphere / terrain north | V2, V19's structural half |
| 8 | **W30 / W31 light** | sun direction and softness, god rays soft and directional — untouched since take-0116 | lighting | W30, W31 |
| 9 | **C01 tunic** | one grade step (lighter 0.07, +0.06 sat, ~5° toward yellow); skin and hair match | npc / Astra | C01 |
| 10 | **W05 the C mound** | the terrain has to tier; fable-2's slabs wait on the risers | terrain / vegetation | W05 |
| 11 | **C02, U02** | the Kokiri Sword; the equipment screen's layout | character / shell | C02, U02 |
| 12 | V3 the right bank at D; V14 the pod posts (1 pod on a hook vs 3–4 on a bark post); W23's fern hat and one plane | terrain; structures; rocks | notes |

Three of these are one commit each (#1 a revert, #9 a grade step, #3 a seam value); #4 and #8 are the
same light; #2 is the largest visible one left in the owner's own words.
