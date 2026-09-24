# The north grove's first person — fable-3 (lane 7), 2026-09-24 23:00

`664c1bcf` on `agent/fable-3-south-props`. exp-north landed on the head at 22:10: three houses, a yard with a washing line
(four cloths), a chopping block, a woodpile and a bench — and nobody living there. A Kokiri girl now stands by the
washing line (`placement.ts NPC_GROVE_YARD` (2.6, −101.5), half a metre south of the line on the shelf's lawn, facing it
as if hanging the wash), the sixth kid (`GROVE_SLOT`), on the south-bank girl's stand pattern: `poseLedgeIdle` with her
own look-around (glances along the line both ways, once back over her shoulder toward the trail), `plantFeet`, the
notice-Link turn, a contact-shadow decal. Her rng is a fork drawn after the bank's, so no other kid's numbers move.

Kept constant on purpose: **no fairy** (a sixth point light would change the light count every lit program is keyed on
and recompile them all); she wears the kokiri-b look (variant 5 → look 1), so no new material or texture; she is drawn
only within 60 m, the grove's own cull distance, and beyond 25 m she loses her small parts and her sun shadow like every
kid. She stands 5.5 m off the trail's arrival and clear of the bench, block and pile; the yard is level (9.98–10.01) and
its mask clear where she stands.

- `before-after-yard-from-trail-6m.jpg` — the yard from the trail's arrival at 6 m.
- `grove-girl-2.5m.jpg` — at the line from behind, 2.5 m.
- `before-after-look-back-10m.jpg` — the look back over the hamlet from the bank behind the trunk house (my
  approximation of fable-cursor's `g-back`), the girl facing the camera at 10 m.

Cost (`pose-counts.mjs`, same head): D_log 561 → 561 (the grove is behind the ledge from every fixed view); the yard
from the trail 159 → 178; at 2.5 m 152 → 171; my look-back 613 → 632 — the +19 is her 12 colour + 6 shadow submissions
and the decal at full detail. fable-cursor's own `g-back` was 675 after the merge by their README; +19 keeps it under
700, but it is their pose to confirm — if it crosses, her sun shadow can go (−6) with the decal keeping her grounded.
Tests 167 / 167; typecheck and build green.
