# The seated girl's skirt drapes on her thighs (lane 7, 2026-09-26 04:20 round)

The lane's oldest open item (INBOX 2026-09-24 20:10): seated on the main flight, the girl's front flaps hang from
the waist as an apron between the thighs (`SkinBlend` hips 0.85 / 0.5 since `83cffdcc`) and the thighs sit bare
from hip to knee. The two ways out were a narrower skirt front — visible on every standing girl, so a look change,
and the call never came — or a seated cloth solve. This is the second, and it needs no call: she is the only kid who
sits and she never stands.

`kokiri.ts` `buildGirlTunic(rig, tunic, seated)`: for `variant === 1` a shell of cloth round each thigh's top and
outer side — `skirtPanel` cut about the **thigh's own axis** (the standing flaps are cut about the body's and would
pass inside the thigh if drawn in), radius the thigh's 0.06 plus the cloth: 0.071 from 2 cm above the knee, 0.073 at
a quarter, 0.08 at the hip joint, 0.092 at its top 1.2 cm above — from behind the outer side over the top to a little
past the front (2.9 rad). Weighted to the thigh alone, so at the 58° sit it rides the pitch and lies on the leg; the
hanging flaps stay and close the gap between the knees. The shell's top swings up inside the belly under the belt
(y +0.08, z +0.04), so no seam shows. Same tunic material, skinned — no draws; ≈ 200 triangles. Standing kids
untouched.

## Before / after (head `33e92705` left, branch right)

`sitter-shot.mjs`: Link 1.2 m before her, 0.8 m off her axis, the follow camera 5.6 m from her — the harness view.

- `seated-girl-link-1.2m-2.4x-head-vs-shells.jpg` — bare thighs with the apron between them → the skirt on her lap to
  the knees, shins bare below.
- `the-lap-4.5x-head-vs-shells.jpg` — the shells and the apron read as one skirt; no shelf under the belt, no seam,
  the hems at the knees.

Profile views were tried from both sides (Link beside her facing her; Link beside her facing her way): the follow
camera lands in the east verge's foliage on one side and up the flight on the other, Link's body between the lens
and her — the harness view is the honest one.

## Six fixed views

SIX_VIEW_PLACEHOLDER
