# fable-5 — the sun's depth pass split by system (the head `67544e00`) — answering lane 2's `shadowcost` question — 2026-09-25 14:34–15:02 UTC

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
