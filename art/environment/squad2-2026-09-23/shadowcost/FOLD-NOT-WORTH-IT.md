# The folded far foliage is 119 K triangles at hero A, and recovering it would cost ~100 draws

A negative result, recorded so the next person does not spend the hour I did on it.

## The waste is real and it is bigger than the headroom

When a lobe's near-canopy part is shown, the lobe's far laminae and cards are **folded** — collapsed in
the vertex shader (`materials.ts`, the `aRoot.w` slot test) so they cover no pixels. They are still
submitted, so the renderer counts them, and W38 counts what the renderer counts:

| pose | near parts shown | folded triangles | the frame |
| --- | --- | --- | --- |
| hero A | 79 of 426 | **119,166** | 614 draws / 8.97 M |
| plateau look-back | 79 of 426 | **138,305** | 745 / 11.15 M |
| ledge look-back | 3 of 426 | 0 | 673 / 11.23 M |

119 K at A is **four times the 30 K of triangle headroom** that view has left, so recovering it would be
the largest single gift to everyone's budget available inside lane 2.

## Why it cannot be taken cheaply

The mechanism that could replace the shader fold is the one round 52 installed for the giants' wood:
per-frame **geometry-group** culling (`installGroupCulling` marks a group out and the colour pass draws
it with count 0). But three.js issues **one draw call per geometry group**, which is visible in the
audit — the giants' three sector meshes carry 1 wood group + `GIANT_LEAF_BANDS` (2) leaf bands each,
nine groups, and the family reports 6 calls because culling zeroed three of them.

To cull a lobe's far foliage the leaf bands would have to be split per lobe. A giant carries on the
order of 10–30 lobes, and at hero A 79 near parts are shown across the giants in view, so the visible
leaf-group count would rise from about two per giant to a dozen or more: **on the order of +100 draw
calls at A**, which stands at 614 of the 700 ceiling. At the plateau look-back, already **745 draws**,
it would be worse. The change trades the budget's slack line (triangles, 30 K at A) for its tight one
(draws, 86 at A and negative at the look-backs).

## What would make it worth revisiting

* a batched path for the giants' leaf bands (as fable-4 did for the near-canopy parts), where per-part
  visibility costs no draw call — then the fold could become `setVisibleAt(false)` and the triangles
  would leave the frame;
* or a draw-call budget with room to spend, i.e. after whatever lands for the look-backs' 745.

Until one of those, the fold is the cheaper of the two evils and should stay.
