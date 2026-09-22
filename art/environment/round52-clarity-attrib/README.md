# Round 52 — fable-4: what the "large blurry crown forms at height" are (attribution for the owner's clarity direction)

The owner's marked screenshot (`art/environment/astra-owner-clarity-2026-09-22/owner-clarity.png`, Astra's
branch): a third-person view on open turf, a tall limbless bole ahead, big soft khaki crown shapes high in the
frame under heavy haze, slender lollipop trees to the right, blue sky. fable-cursor's split (15:45): Astra the
fog/haze and the distant crowns/cards, fable-4 the white-bark crowns **if the circle includes them**. This is
the measurement of whether it does.

## Where the view is
Open sky + turf + a limbless bole + haze do not exist inside the main clearing (from the north clearing the
log arch fills the frame; from the plaza lawn the giants' limbs do). They do exist on the **west meadow
around the far-hut knoll** (`COLUMN_SEATS` hut host at (−41, 35.7), the knoll white-barks at (−50, 39) and
(−34, 45)). Six seated third-person candidates (`candidates-grid.jpg`, head `68b3eb96`, high tier, 896×776):
the four around the knoll (k1–k4) all show the owner's symptom — large soft crown blobs at the upper left,
grey haze, open sky. The exact owner pose was not recovered (his frame has no hut on the bole); the
attribution below holds at two of the candidates and the mechanism is the same everywhere on the meadow.

## Attribution by hiding one scene group at a time (frozen sim clock, pixels changed in the upper-left
## 60 % × 50 % of the frame)
| pose | sky | `trees` | `trees/distant` (far crown cards) | `trees/white-bark` | `trees/columns` | `canopy` (roof lobes) |
|---|---|---|---|---|---|---|
| k3 — from the south, (−41, 14) → the hut bole | 49.7 % | 44.0 % | **29.1 %** | 12.1 % | 2.4 % | 12.6 % |
| k4 — from the east, (−24, 30) → the hut bole | 28.1 % | 82.5 % | **69.2 %** | 20.7 % | 3.2 % | 1.5 % |

The panels (`k3-…-panels.jpg`, `k4-…-panels.jpg`: base | `trees/distant` hidden | `trees/white-bark` hidden,
upper-left crop): hiding the **distant cards removes every soft khaki form** and leaves clear sky; hiding the
white-barks removes only the **crisp leaf clusters** at the frame edges (the knoll white-barks at 12–30 m,
near / mid LOD). The white-bark share of the region is real (12–21 %) but it is not the blur: those crowns
read as leaves. The columns' own crowns are 2–3 %.

**So: the large blurry crown forms at height are the distant trees' far-LOD crown cards (`distant.ts`,
Astra's lane) in haze. No white-bark crown pass is needed for the circle.** The seam with Astra: when the
cards sharpen or the haze thins, what stands beside them at 18–45 m is the white-barks' mid LOD (one lamina
in 8 at 2.53× since round 51's lodthin); I re-check those crowns at k3/k4 after her change lands and take
them back if they read soft next to sharper cards.

## Method notes
- A CPU raycast could not attribute this: 82 % "no hit" over the blobs at k3 — the cards are placed in the
  vertex shader from instance attributes, so `Mesh.raycast` sees geometry at the origin. Hide-and-diff is
  the reliable tool for shader-positioned meshes.
- With the sim clock running, wind and motes drift the diff (each terrain chunk "changed" 3–6 %); the
  numbers above use `__ZR__.setTime(100)` before every render, noise floor < 0.5 %.
- Scratch scripts (not committed): `_f4poses.mjs` (seat N third-person poses through `__ZR__.probe`),
  `_f4attrib.mjs` (hide-one-group tally), `_f4panels.mjs` (frames with a named group hidden).
