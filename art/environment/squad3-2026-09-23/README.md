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

`pass1/` holds the before/after sheets. What changed and why is in the PR description and in the
code comments (`column.ts` `boleKnees`, `bole.ts` `LICHEN_TINT` / `FURROW_MOSS`, `materials.ts`
`COLUMN_BARK_FLOOR` and the `GIANT_BARK_COLOR` lichen / moss blocks).

## pass2 — the white-barks stop being pipes

`materials.ts` `WHITE_BARK_COLOR`: lenticel bands and branch scars as a procedural world-space
field (no mip, no texel — 0.3–0.9 m marks that read at 40 m and at 4 m alike), the moss ring up to
2.6 m instead of 1.1 m, and a weathered foot that keeps some grey to 7 m. Plus a narrower moss
cover ramp on the near boles (0.5–0.9 → 0.52–0.8) so a cushion has a margin rather than a halo.

## The six hero views

`gauntlet/tmp/squad3-delta.mjs` against the integration head, same poses, 960 × 540:

| view | mean \|Δ\| (levels) | px > 2 | px > 8 | mean rgb |
| --- | --- | --- | --- | --- |
| A_stairs | 0.08 | 0.71 % | 0.28 % | 91.11/87.33/67.72 → 91.09/87.32/67.71 |
| B_house | 0.26 | 2.77 % | 0.84 % | 85.49/83.03/65.95 → 85.43/82.97/65.89 |
| C_lookback | 0.09 | 0.96 % | 0.36 % | 85.27/81.37/62.70 → 85.19/81.30/62.62 |
| D_log | 0.48 | 5.37 % | 1.42 % | 86.29/84.14/68.29 → 86.15/83.99/68.12 |
| F_canopy | 0.20 | 2.49 % | 0.59 % | 87.30/82.01/58.74 → 87.12/81.80/58.54 |

Measured after pass 2. The six views barely move: D is the largest (the emergent's bole and the
far wall's columns are most of that frame's left edge) and even there 98.6 % of pixels move by
8 levels or less, with the frame mean within 0.2 of a level. That headroom is what pass 3 spends.

## pass3 — the columns stop being a rank of posts

- `column.ts`: `leanDeg` 1–4° → 2–6.5° and a wider sweep wander (`boleWander` 0.22 against the
  emergent's and the hut host's 0.14).
- `whitebark.ts`: the pale stem was `barkWhite × 1.12` ≈ 0.62 linear — brighter than the haze it
  stands in from 20 m out, so it read as a lit stick. `× 0.94` drawn a tenth toward the grey.
- `materials.ts`: the moss albedos carry the hue (G/R 1.6 → 2.4) — the near bases' shade floor
  mixes a flat grey into whatever albedo it is given, so a desaturated moss rendered as pale sage.
