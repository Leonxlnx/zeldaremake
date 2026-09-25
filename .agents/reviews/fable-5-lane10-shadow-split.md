# fable-5 — the sun's depth pass split by system (the head `67544e00`) — answering lane 2's `shadowcost` question — 2026-09-25 14:34–15:00 UTC

Lane 2's `shadowcost` (14:01) measured the depth pass as a third of every frame (hero A 174 draws / 2.91 M; the plateau's look-back 216 /
3.70 M; the ledge's 164 / 3.36 M), showed the giants' wood is not in it, and stopped at "splitting it per system needs per-system
caster toggles, which the capture API does not expose" — with ground cover as the leading guess. No toggle is needed:
`__ZR__.isolate(system)` renders one system alone through `renderer.render`, shadow map included, so **isolate with shadows on
minus isolate with `?shadow=0` is the depth pass per system** (`fable-5-lane10/shadowsplit.mjs`; the four json files beside it).
The frames match lane 2's to the draw (614 / 8.97 M, 745 / 11.15 M, 673 / 11.23 M).

| system | hero A: depth pass (of 2.91 M) | the plateau's look-back (of 3.70 M) | the ledge's look-back (of 3.36 M) |
| --- | --- | --- | --- |
| **trees** | **69 draws / 1.43 M (49 %)** | **67 / 1.42 M (38 %)** | **55 / 1.23 M (37 %)** |
| **structures** | **45 / 0.72 M (25 %)** | **72 / 0.96 M (26 %)** | **55 / 0.78 M (23 %)** |
| vegetation | 12 / 0.30 M (10 %) | 17 / 0.62 M (17 %) | 16 / 0.85 M (25 %) |
| terrain | 12 / 0.35 M (12 %) | 16 / 0.46 M (12 %) | 11 / 0.32 M (10 %) |
| rocks | 11 / 0.09 M | 13 / 0.24 M | 13 / 0.14 M |
| character | 17 / 0.09 M | 23 / 0.10 M | 6 / 0.01 M |
| props + hardscape | 9 / 0.05 M | 14 / 0.08 M | 9 / 0.04 M |

(1280 × 720, quality high; the per-system sums run 3–5 % over the frame's delta because each isolated system draws its own map.)

**The depth pass is trees and structures, not ground cover.** Trees cast 1.2–1.4 M at every pose — with the giants' wood already
out of the map (lane 2's test), that is the columns' LOD0 and near bases, the giants' authored leaves and the near-canopy
batch's parts. Structures cast 0.7–1.0 M — the village's houses, which is the row `exp-east`'s shadow-LOD proxies (`82a85ced`)
and `exp-south2`'s far-bank zone (`de967e3d`: the village's casters off south of the bridge, −51 draws / −0.63 M) already cut on
their branches. Vegetation is 10–25 % of the pass; terrain 10–12 % (the heightfield's own tiles as casters).

So the two cheapest triangle cuts on the head are shadow-side and known: **the houses' casters at range** (a far-tier caster
rule for structures beyond ≈ 30 m — `exp-south2` has one for its zone; the head has none) and **the trees' near-tier casters
beyond the fixed cameras' distances** (lane 2's own `82a85ced`-style proxy for the columns). Either takes 0.5–1.0 M off every
over-cap frame without a pixel the colour pass shows — the shadow's edge at 40 m is a few pixels.

## Reconciling with lane 2's `DEPTH-SPLIT` (merged 15:16 as #136) — 15:23–15:35 UTC

Lane 2 split the same pass an hour later by a different method — a temporary `?nocast=trees` flag clearing `castShadow` on the
tree meshes its match found at build, and `?veg=0.05,0` for the grass — and reached **trees 0.56 M (19 %), vegetation 0.30 M,
"everything else" 2.05 M (71 %)** at hero A (0.59 / 0.61 / 2.51 M at the plateau), concluding "lane 2: nothing left to cut here".

The two splits **agree exactly where they can be compared**: the whole pass (2.91 M and 3.70 M) and vegetation (mine 0.30 / 0.62 M,
theirs 0.30 / 0.61 M). They **disagree on trees against the solid world**: `isolate` gives trees 1.43 M / 1.42 M and the solid world
(structures + terrain + rocks + hardscape + props) 1.24 M / 1.74 M; `nocast` gives trees 0.56 M / 0.59 M and a remainder of 2.05 M /
2.51 M. The gap is 0.87 M at A and 0.83 M at the plateau — the same size at both poses.

Two explanations, and a test for each:
1. **`?nocast=trees` cleared fewer casters than "trees" holds.** The trees system draws the giants' bases, the columns' LOD0 and near
   bases, the authored leaves, the near-canopy batch (one BatchedMesh since #101 — a name pattern written for meshes may not match
   it) and the distant sets; a match that missed the batch and the columns would leave ≈ 0.8 M casting and count it as "else".
   The test is the list of mesh names the flag cleared, or `isolate('trees')` with shadows on and off on their build — the same
   two numbers as mine if the head is the same.
2. **`isolate` draws casters the composer would cull.** `renderer.render` bypasses `cullShadowCasters`, so each isolated system's
   map holds every caster in the light's frustum, not only those whose shadows land in frame. The per-system sums exceed the
   frame's delta by 0.14 M at A and 0.18 M at the plateau — so this accounts for at most a fifth of the gap, not the whole.

Until (1) is answered, the trees' share of the depth pass is between 0.56 and 1.43 M, and "nothing left to cut" is not yet
established; the structures' 0.7–1.0 M and the terrain's 0.3–0.5 M are agreed by both readings' arithmetic and are the safe
first cuts either way.
