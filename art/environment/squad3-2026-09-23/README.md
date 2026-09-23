# squad3 — trees up close (`column.ts`, `bole.ts`, `giant.ts`, the white-barks)

Lane 3 of `docs/SQUAD_2026-09-23.md`. The owner's 09-23 items for this lane:

- red circle 1 — the column trunk left of the north path is "a smooth pale cylinder in grey haze":
  bark relief, moss, root flare, a colour that reads as wood;
- the giants' roots and limbs at player height;
- "the trees stay green — they need to render brown the second you step in" (09-21, still true on
  the 09-23 head).

`poses.json` is the lane's pose set for `gauntlet/scripts/broll.mjs`:

| pose | camera | what it judges |
| --- | --- | --- |
| `l3-owner-north` | (1.4, 1.75, −10.2) → (2.0, 1.45, −20.0), fov 46 | the owner's 06:50 north-path pose (fable-cursor's reconstruction) — the mid-distance trunks left of the path |
| `l3-column-6m` | (0.8, 1.75, −19.8) → (−3.5, 2.4, −24.7) | the column seat at (−3.5, −24.7) from 6.5 m — a walker beside a column |
| `l3-emergent-foot` | (0.2, 1.7, −6.3) → (−3.1, 2.0, −8.0) | the emergent's bole at 3.7 m — the bark a walker on the north path passes |
| `l3-giant-roots` | (−2.2, 1.7, −11.2) → (−6.0, 1.0, −12.8) | the north-west-near giant's roots at 4.1 m |
| `l3-whitebark-stand` | (3.6, 1.75, −19.5) → (13.5, 3.4, −25.5) | the white-barks east of the north path at 11–25 m |

Render:

```bash
node gauntlet/scripts/broll.mjs --dist dist --out /tmp/after --size 960x540 \
  --shots art/environment/squad3-2026-09-23/poses.json --test --settle 6
node gauntlet/tmp/squad3-compare.mjs --before /tmp/before --after /tmp/after \
  --out /tmp/cmp --names l3-owner-north,l3-column-6m,l3-emergent-foot,l3-giant-roots \
  [--crops /tmp/crops.json]
```

A frame takes 60–75 s on this VM's SwiftShader, so a four-pose pass is ≈ 5 min.

## Which trunk is red circle 1?

Two probes, because the answer decides whose lane it is.

`gauntlet/tmp/squad3-trunk-probe.mjs` renders the owner's pose, reads `depthImage` at the screen
columns of his pale cylinders and projects every white-bark placement, authored column seat and
giant. The pale poles read 39.2 / 42.6 / 49.1 / 55.0 m; the column seat at (−3.5, −24.7) is at
15.3 m and screen x 220.

Then a family-tag render (`columnTree` emissive red, `whiteTree` green, `distant` blue, built to
`dist-probe`, reverted immediately) names every trunk in that frame:

| screen x (of 960) | family | notes |
| --- | --- | --- |
| 85–145 | **distant** (`distant.ts`) | the thin pale poles at 39–55 m |
| 150–300 | **column** | the wide trunk left of the path at 15 m — the most prominent trunk on that side |
| 290–350 | **distant** | more pale poles |
| 660–830, 890–960 | **column** | the right bank's trunks |
| — | white-bark | none in this frame |

So the owner's red circle 1 is the **column at (−3.5, −24.7)** (this lane), and the thin pale
poles beside it are the **distant family** (lane 2's `distant.ts`).

### For lane 2 — why the distant poles are flat

`materials.ts` `DISTANT_BARK_M = [22, 38]`: the whole near-bark treatment of a distant bole (the
bark map on the cylindrical mapping, the tone bands, the cord stripe, the furrows, the foot grime
and `DISTANT_NEAR_FLOOR`) fades out at **38 m**, and the near LOD's `DISTANT_NEAR_GAIN` of 4 is
divided back out over the same blend. The poles the owner circled stand at 39–55 m — a metre past
the edge — so they render exactly the flat far tint with no cord, band or map: a smooth pale
cylinder. Widening that blend is not a one-constant change (the same `near` gates the gain
division, so the boles would come out 4× too bright), which is why this lane left it alone.

## pass1 — the bark stops reading as camouflage; the columns get a silhouette

At 2–6 m every bole — the emergent's, the north-west-near giant's, the column seat at
(−3.5, −24.7) — was covered in white speckle and 8 cm green blobs: mould-spotted camouflage, not
wood.

- The lichen crust fields ran at 22–95 cycles per metre (1–3 cm speckle) over an OPAQUE pale grey
  (`vec3(0.46, 0.5, 0.38)` linear) about 3× the bark's own ≈ 0.1, with a vertex tint of 1.55× on
  top of a crest tint already above 1. Now the crust is the bark's own colour lifted 1.35–1.6×
  and part-desaturated toward grey-green, at 5–15 cm plates; `LICHEN_TINT` 1.55 → 1.26 at a 0.55
  blend (was 0.75).
- The moss cover's SHAPE came from `mossField` alone (13 / 41 cycles per metre), so it was
  confetti of equal-sized blobs. A new 25–65 cm field decides where the moss sits and the fine
  one only breaks its edge; the mean cover is held (the factor's mean 0.98 → 0.93).
- `FURROW_MOSS` went from a yellow-green `(0.46, 0.66, 0.3)` tint to `(0.33, 0.47, 0.22)` at 0.78
  (was 0.85), so the soft margin around a cushion reads as damp bark instead of going bright green.
- Every column variant carries two knees with broken stub limbs on its bare run (3.6–4.7 m and
  7.0–8.2 m, azimuths a third of a turn apart): `column.ts` `ColumnParams.boleKnees`, drawn from
  their own PRNG fork so no seat, white-bark, giant or distant tree moves. The emergent keeps its
  authored pair; the far hut's host gets none (the hut hangs on it).
- `COLUMN_BARK_FLOOR` (the columns' floor **within 20 m** only) lift 6.2 → 4.8, texture
  0.45 → 0.62: the floor goes back under the relief, so the crests stand above it and the furrows
  below. `COLUMN_BARK_FLOOR_FAR`, what the hero frames' 22–40 m columns use, is untouched.

## pass2 — the white-barks stop being pipes

`materials.ts` `WHITE_BARK_COLOR`: lenticel bands and branch scars as a procedural world-space
field (no mip, no texel — 0.3–0.9 m marks that read at 40 m and at 4 m alike), the moss ring up to
2.6 m instead of 1.1 m, and a weathered foot that keeps some grey to 7 m. Plus a narrower moss
cover ramp on the near boles (0.5–0.9 → 0.52–0.8) so a cushion has a margin rather than a halo.

## The hero views

`gauntlet/tmp/squad3-delta.mjs` against the integration head at the same poses, 960 × 540 —
after pass 2, then after the whole branch:

| view | mean \|Δ\| pass 2 | mean \|Δ\| final | px > 8 (final) | mean rgb (head → final) |
| --- | --- | --- | --- | --- |
| A_stairs | 0.08 | 0.33 | 1.05 % | 91.11/87.33/67.72 → 90.98/87.22/67.62 |
| B_house | 0.26 | 0.74 | 2.76 % | 85.49/83.03/65.95 → 85.15/82.73/65.67 |
| C_lookback | 0.09 | 0.15 | 0.69 % | 85.27/81.37/62.70 → 85.11/81.24/62.57 |
| D_log | 0.48 | 0.88 | 3.47 % | 86.29/84.14/68.29 → 85.90/83.78/67.93 |
| F_canopy | 0.20 | 0.26 | 0.77 % | 87.30/82.01/58.74 → 87.12/81.80/58.54 |

The six views do not move much: even D — where the emergent's bole and the far wall's columns
fill the left edge — keeps 96.5 % of its pixels within 8 levels and its frame mean within 0.4 of
a level. At the lane's own poses the same measure reads 1.2–1.9 mean levels with 4.3–6.2 % of
pixels past 8, i.e. the change is concentrated where a walker stands, which is where it was
aimed.

## pass3 — the columns stop being a rank of posts, and a bole reads round

- `column.ts`: `leanDeg` 1–4° → 2–6.5° and a wider sweep wander (`boleWander` 0.22 against the
  emergent's and the hut host's 0.14).
- `whitebark.ts`: the pale stem was `barkWhite × 1.12` ≈ 0.62 linear — brighter than the haze it
  stands in from 20 m out, so it read as a lit stick. `× 0.94` drawn a tenth toward the grey.
- `materials.ts`: the moss albedos carry the hue (G/R 1.6 → 2.4) — the near bases' shade floor
  mixes a flat grey into whatever albedo it is given, so a desaturated moss rendered as pale sage.
- `materials.ts` `COLUMN_SHADE_SIDE` / `LeafVariant.barkShadeSide`: a shade floor is one level
  from a bole's lit rim to its far edge, which IS the "smooth cylinder" reading. The columns'
  floored bark now keeps 0.55 of it on faces turned from the sun and all of it at the
  terminator — the round-shading cue a cylinder under a closed roof still shows. The distant
  family has had exactly this term since round 48 (`DISTANT_SHADE_SIDE` 0.38); the giants and
  white-barks are untouched (each program has its own cache key).

## Play mode

`node gauntlet/scripts/playtest.mjs --dist dist --out … --only look,walk,perf --shots`, run on the
integration head and on this branch:

- all nine walk routes reach every waypoint on both, with zero stuck points and no page errors;
- draw calls are identical at every perf spot (plaza 521, stairs2-base 522, saria-side 519,
  west-house 442);
- triangles move by the knee stubs alone: plaza 7,440,719 → 7,442,995, stairs2-base
  9,525,649 → 9,528,105, saria-side 8,587,286 → 8,589,022, west-house 5,033,732 → 5,033,520
  (+0.03 % at worst). stairs2-base already sat over the 9 M note in `trees/index.ts` on the head;
  this branch does not change that either way.

## The sheets

`final/` holds, for each pose, the integration head on the left and this branch on the right:

- `l3-owner-north-before-after.jpg` — the owner's own pose, cropped on red circle 1. The trunk
  goes from a broad flat pale shape to a round bole with a dark flank, visible grain and moss in
  patches.
- `l3-column-10m-before-after.jpg`, `l3-column-6m-before-after.jpg` — the same column at 10 m and
  6.5 m.
- `l3-emergent-foot-before-after.jpg`, `l3-giant-roots-before-after.jpg` — the bark a walker
  passes at 3.7 m and 4.1 m: the white speckle gone, brown bark with green patches.
- `family-tag-owner-north.jpg` — the identification render (red = column, green = white-bark,
  blue = distant), built to `dist-probe` and reverted; it is not part of the branch's code.
