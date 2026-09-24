# fable-5 — the look-backs' cost by system, on the head `3c6cc553` — 2026-09-24 17:59–18:04 UTC

Four of this squad day's reads ended at the same sentence: *the expansions make places to stand that look back at a village
drawn for six fixed cameras, and none of them can pay that bill alone* — the south's far bank (855 draws / 10.19 M), the
east plateau's green (833 / 9.94 M) and lookout (778 / 9.90 M), the ruins' trail (808 / 10.55 M), all on the head itself,
all over 700 / 9.0 M before any expansion adds a mesh. Nobody owns "the village from 40 m". This is the bill itemised, so
the owning lanes can see their share: `__ZR__.isolate(system)` renders the frame with one top-level system group alone
(the play camera, the shadow pass included, post-fx excluded) — `fable-5-lane10/isolate.mjs`, `lookback-isolate-3c6cc553.json`.
The per-system sums match the frames to within 10–15 draws (the post-fx passes).

| system | far bank (4.06, 42.8) → N | east green (43, 4) → W | east lookout (47.5, 7.5) → W | ruins trail (−33.4, 0.6) → E | *the plaza (0.5, 3) → S, for scale* |
| --- | --- | --- | --- | --- | --- |
| **trees** | **256 / 3.60 M** | **252 / 3.62 M** | **246 / 3.80 M** | **238 / 4.16 M** | 194 / 2.43 M |
| **structures** | **171 / 2.36 M** | **173 / 2.33 M** | **174 / 2.45 M** | **159 / 2.28 M** | 90 / 1.60 M |
| vegetation | 142 / 2.16 M | 123 / 1.82 M | 96 / 1.59 M | 148 / 1.96 M | 136 / 1.86 M |
| **character** | **123 / 0.24 M** | **107 / 0.22 M** | **107 / 0.22 M** | **107 / 0.22 M** | 26 / 0.15 M |
| terrain | 50 / 0.92 M | 49 / 0.89 M | 50 / 0.92 M | 48 / 0.91 M | 36 / 0.69 M |
| rocks | 46 / 0.52 M | 44 / 0.51 M | 44 / 0.51 M | 40 / 0.49 M | 28 / 0.36 M |
| props | 26 / 0.12 M | 26 / 0.12 M | 26 / 0.12 M | 18 / 0.11 M | 15 / 0.09 M |
| hardscape | 16 / 0.30 M | 16 / 0.30 M | 16 / 0.30 M | 14 / 0.29 M | 12 / 0.34 M |
| canopy + atmosphere | 11 / 0.02 M | 11 / 0.02 M | 11 / 0.02 M | 11 / 0.02 M | 7 / 0.01 M |
| **sum** | **841 / 10.22 M** | **801 / 9.84 M** | **770 / 9.93 M** | **783 / 10.44 M** | 544 / 7.52 M |

(draws / triangles; Link placed by the play API, the follow camera 4.3 m behind him at 1280 × 720, quality high.)

## What the table says

1. **The character system draws 107–123 calls from every look-back and 26 from inside the plaza.** The audit says how
   (`it114-char.mjs`, the head): **5 kids, 62 rig meshes between them (≈ 12 a kid), and at the far bank all five cast a sun
   shadow** (`kidShadowCasting` [true × 5]; in the plaza one does) — 12 meshes × 2 passes × 5 kids ≈ the 123 draws, for
   0.22 M triangles, 14 % of the frame's draws, at 20–30 px tall. Two levers, both lane 7 / fable-3's (`src/world/character/`):
   the per-joint merge reports **`rigMeshesBeforeMerge` 62 → `rigMeshes` 62, `rigMergedMeshes` 0** — it merges nothing
   on this build, so a kid is still 12 draws where `consolidate.ts` meant a few; and the kids' shadow casters beyond
   ≈ 25 m (a shadow a few pixels long) are 60 of the 123. Together **−80 to −100 draws** on every look-back for no
   visible change.
2. **Trees are the largest share, 238–256 draws / 3.6–4.2 M** — a third of the draws and 37 % of the triangles — against
   194 / 2.4 M from inside the plaza: the look-backs see every giant and every understory bole and crown cluster of the
   village at once. A far tier for crowns beyond ≈ 35 m from the eye (one draw per crown instead of one per cluster) is
   the trees lane's lever; the grove's `eeb94809` (one pack per LOD) is the pattern.
3. **Structures 159–174 draws / 2.3–2.5 M** — the village's houses at 40–60 m with every tier drawn: `exp-east`'s cost pass
   already shows the moves (rooms behind the fog planes only while a doorway faces the camera, −11 draws; shadow-LOD
   proxies for the caps, roof branches, ropes, vines and pods; moss tufts within 34 m) — applied to the village's own
   houses as seen from the south and east, not only from the east lane.
4. **Vegetation 96–148 draws** — the village splits its far-LOD buckets per plant variant ("because it holds thousands of
   each plant", `eeb94809`'s note); one pack per LOD beyond 30 m is −50 to −90.

Taken together — the kids merged at range (−90), the houses' far tiers (−40), the crowns' far tier (−60) — the four
look-backs land at ≈ 650–700 draws with the expansions' own +40 to +120 on top. The triangle cap (9.0 M) is the trees'
and the structures' to meet: 3.6–4.2 M and 2.3–2.5 M at 40–60 m are the fixed cameras' near-tier meshes drawn at range.

Every expansion author has been told "the look-back is over" this squad day; this is the first time the bill has names on
it. I re-measure the four poses with `isolate.mjs` after each lane's push.

## The head `31146062` (18:06 — 71 commits: fable-2's pebble far gate #57, the girls' belts, props wear / crates / contact AO, lane 5's audio, crowntone) — the same four poses, 18:10–18:19 UTC

| system | far bank | east green | east lookout | ruins trail |
| --- | --- | --- | --- | --- |
| trees | 256 / 3.60 M | 252 / 3.62 M | 246 / 3.80 M | 238 / 4.16 M |
| structures | 171 / 2.36 M | 173 / 2.33 M | 174 / 2.45 M | 159 / 2.28 M |
| vegetation | 142 / 2.16 M | 123 / 1.82 M | 96 / 1.59 M | 148 / 1.96 M |
| character | 127 / 0.23 M (+4) | 110 / 0.22 M (+3) | 110 / 0.22 M (+3) | 110 / 0.22 M (+3) |
| terrain | 50 / 0.92 M | 49 / 0.89 M | 50 / 0.92 M | 48 / 0.91 M |
| **rocks** | **30 / 0.48 M (−16)** | **26 / 0.48 M (−18)** | **26 / 0.48 M (−18)** | **28 / 0.46 M (−12)** |
| props | 29 / 0.13 M (+3) | 29 / 0.13 M (+3) | 29 / 0.13 M (+3) | 20 / 0.11 M (+2) |
| hardscape | 16 / 0.30 M | 16 / 0.30 M | 16 / 0.30 M | 14 / 0.29 M |
| canopy + atmosphere | 11 / 0.02 M | 11 / 0.02 M | 11 / 0.02 M | 11 / 0.02 M |
| **sum** | **832 / 10.18 M (−9)** | **789 / 9.80 M (−12)** | **758 / 9.89 M (−12)** | **776 / 10.41 M (−7)** |

The merges read exactly as their authors said: fable-2's pebble gate takes **12–18 draws** off the rocks row (his "~20"),
the girls' stitched belts put **+3 to +4** on the character row (one mesh per girl per pass — the merge that merges
nothing, item 1, would have absorbed it), fable-3's contact-AO decals and crates **+2 to +3** on props. Trees, structures,
vegetation, terrain: unchanged to the draw. `exp-south2` `de967e3d` (17:55, not yet on the head) starts on the structures
row from the far bank — the village's casters off and its tufts undrawn south of the bridge, −51 / −0.63 M and −2 /
−0.37 M by its own probe, "more follows" — the first lane to take its share of this table.
