# Round 50 — white-bark trees (fable-4)

## W08's "tapered, irregular" at C (`agent/fable-4-taper`)

fable-5 on take-0123: "lean and the low bough are in at C; the stem is still a straight-sided cylinder
with no taper and no irregularity." Measured on the sealed C frame: the survey stem's visible band
(1–5 m — the foot is under the flower line) ran 27 → 21 px, a 1.3 : 1 cone the eye reads as a pole; the
round-47 flare (+88 % at the ground) is spent by 2 m, where C starts seeing the stem.

Two terms in `whitebark.ts`, both from `baseRng` (no stream moves), the same at every LOD:
- **Shoulder** — a radius bump of +22–34 % per stem rising from the toes' crest (0.35–1.1 m) and gone by
  0.36 H (4.6 m on the survey stem, 2.9 m on a young one). The ground line, the flare, the toes and the
  seated-root mesh keep their radius.
- **Bow / S** — 0.3–0.55 R of lateral offset over the lower half of the stem (0.8–1.3 waves, per-stem
  direction), zero at the foot and from half height. Applied to the **swept surface only**: every branch,
  limb and shoot samples the unbent path, so the crown, the low boughs, their leaves and the asset's
  bounds are byte-identical — `TreeAsset.radius` / `height` feed the placement sampler, and a first cut
  that let the limbs follow the bend re-rolled placements 62–79.

Verified: placement replica head vs branch — **80 / 80 identical**, infos identical; leaf hashes identical
for every variant at every LOD; wood triangle counts +16…+80 per variant at high LOD (the bent sweep),
medium / low unchanged.

| pose | changed | read |
| --- | --- | --- |
| C's stem (crop `fable4-r50-taper-C-stem-pair.png`, 2×) | 3.4 % of C | the stem is wide at the flower line and narrows to the HUD, with a bow at mid-height — tapered, irregular, leaning |
| `f4-trunk-8m` | 29 % | a birch with a belly and a bend, not a pole; crown identical |
| `f4-pair-12-20m` | 24 % | both stems taper and bow at 12 and 20 m |
| `sn-whitebark-base` (1.5 m) | 22 % | the stem fuller through 1–2 m; flare, toes, bands intact; one epicormic stub sits deeper in the fattened stem |
| `w18-spine-r` | 4.3 % | the grove's stems at 10–25 m |

Six views (head `97c8322` = take-0123 → branch, settle 6, one Chrome): A 0.2177 =, B 0.2016 → 0.2014
(−0.0002), **C 0.2359 → 0.2380 (+0.0021)**, D 0.2757 → 0.2762 (+0.0005), E 0.2141 → 0.2142, F 0.2565 =.
Draws 566/522/407/**396** (D +1: a bent sweep's bounding sphere enters the window)/522/507; triangles
A 8.61 → 8.62 M, D 7.95 → 8.01 M, the rest ±0.01 M; determinism 0; console 0. The taper moves C toward
the reference.

## The lean commit's hidden re-roll (found, reverted on `agent/fable-4-r49b`)

The same replica showed `ea86f8c1` (lean 5–10°, azimuth turned) re-rolling placements 62–79: `growthPath`'s
frame for a near-vertical stem is world-anchored, so turning the azimuth reshapes each crown against its
bends (bounds ± 0.3 m). Reverted (`78a71f47`); fable-5's take-0123 read shows the survey stem already
leaning across C on the head code.

## W08's "leaning" at C — the hero stem's instance tilt (same branch, second commit)

fable-5's correction on take-0123: "the C stem is plumb" — the survey stem's own 2–8° lean points at
camera C and foreshortens away. A lean in the geometry moves every crown's bounds and re-rolls seats
(the r49b lesson), so the one stem the rubric frames leans by its **instance matrix**: `HERO_WHITE_BARK_TILTS`
in `whitebark.ts` — the mature variant 7 at (−7.39, 12.87), 5.5° about its ground point, top moving
toward (0.9, 0.43) (camera-left at that spot: into the frame). `seatFamily` in `trees/index.ts` takes an
optional world-space tilt, premultiplied after the yaw; matched by position (0.6 m), so an upstream re-roll
leaves the table inert. Position, yaw, scale, the asset, the sampler and every other tree are untouched.

| pose | read |
| --- | --- |
| C's stem, 3× (`fable4-r50-tilt-C-stem-3x.png`: taper → taper + tilt) | the top sits ≈ 22 px left of the foot over the visible 1–5 m — a birch leaning into the frame at ≈ 7° apparent (tilt + bow), where the taper-only stem is plumb |
| seal → taper → taper + tilt (`fable4-r50-C-stem-seal-taper-tilt.png`) | pole → shouldered, bowed → shouldered, bowed, leaning |
| `f4-trunk-8m` (`fable4-r50-tilt-f4-trunk-8m.png`) | the whole tree leans a little further along its own lean; the foot in the grass shows no seam |

Six views vs the taper state: **C 0.2380 → 0.2373** (−0.0007; still **+0.0014 over the seal's 0.2359**),
A/B/D/E/F pixel-identical (0.00 % of pixels); draws and triangles identical. Whole branch vs the seal:
A =, B −0.0002, C +0.0014, D +0.0005, E +0.0001, F =.

## W08's "a bough that shows" at C (same branch, third commit)

fable-5 on take-0123: the low bough "sits half under the item HUD". Two causes at frame C, both measured:
the mature main bough left the stem at 22–34 % (its lobe at 3.5–6 m — the HUD hides the stem above ≈ 5 m,
and the giant's lantern limb crosses it at 4–4.5 m); and at 22.7 m the survey stem is the MEDIUM mesh, which
kept one leaf in 6 at 2.2 × — a 150-lamina lobe thinned to 25 read as a few flat cards floating beside the
stem (`fable4-r50-bough-C-lobe-sparse-medium-lod.png`, right panel, at 15–25 %).

- Mature main bough at **12–17 %** of the stem (1.55–2.2 m; lobe centre 2.3–3.6 m, underside ≥ 1.8 m): below
  the limb, against the haze. Young stems keep 22–34 % (a walker's head by the clearing's paths). Same draw.
- The low boughs' lobes keep **one leaf in 2 / 4 at 1.3 / 2.0 ×** on the medium / low meshes (crown roof
  unchanged at 1 in 6 / 12): the same covered area, four times the laminae. `boughSpray` flag around
  `foliateLobe` in `lowerLimb`; retention is by leaf ordinal, so no stream moves and the high mesh is
  byte-identical in triangle count (the mature hashes differ only by the bough's new height).

Verified: placement replica 80/80 identical, infos identical (the lobe's horizontal reach is unchanged).

| pose | read |
| --- | --- |
| C's lobe, 2× (`fable4-r50-bough-C-lobe-2x.png`: tilt state → bough) | a foliage lobe with its twig below the lantern limb, left of the stem — a bough that shows |
| `f4-trunk-8m` (`fable4-r50-bough-f4-trunk-8m.png`) | the main bough at eye level plus a little, in front of the house |

Six views vs the tilt state: C 0.2373 =, E −0.0001, A/B/D/F identical; triangles C 6.96 → 7.00 M, D 8.01 →
8.02, B/E 7.78 → 7.79, F 7.94 → 7.96, **A 8.62 M =**; draws identical. Whole branch vs the seal (take-0123):
**A =, B −0.0002, C +0.0014, D +0.0005, E 0, F =**; draws 566/522/407/396/522/507.
