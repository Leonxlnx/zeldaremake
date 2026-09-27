# The standing kids hold their arms differently (lane 7, 2026-09-26 02:20 round)

Last round's lesson: at the follow camera a hand-sized change is a pixel-sized one, so lane 7's next work had to
be body-sized. Every standing kid idled with the same hanging arms. `npc.ts` now has `ArmStyle` (`hang | behind |
akimbo`) and `styleArms`, blending the hanging idle toward a held pose with a slow drift; `poseLedgeIdle` takes the
style and its weight. **The ledge girl and the veranda boy clasp their hands behind the back; the bank girl stands
akimbo.** The grove girl (the wave's evidence kid), the door boy (his stick), the wanderer (view A) and the sitter
(view B) are unchanged. No geometry, no draws.

The greeter passes `1 − g`: the arms come down as a kid turns to Link, so the wave (#144) starts from hanging arms
exactly as before — at Link 1.2 m (inside `GREET_NEAR_M`) the frames are identical head ↔ branch
(`ledge-and-bank-link-1.2m-greeting-identical.jpg`), as designed.

## Solved before rendering

`arm-solve.mjs`: a grid over shoulder (x, y, z) and elbow x on the rig's own chain (three's XYZ Euler, the Kokiri
proportions), the elbow kept out of the torso, a small cost on shoulder twist:

| style | left shoulder (x, y, z) | elbow x | hand | elbow |
| --- | --- | --- | --- | --- |
| behind | (0.65, −1.40, 0.20) | −1.05 | 0.6 cm apart at the lumbar (∓0.006, 0.579, −0.082) | 13 cm out, 7 cm behind (±0.13, 0.66, −0.07) |
| akimbo | (0.60, −0.65, 0.45) | −1.08 | 0.6 cm off the hip's side (±0.119, 0.532, 0.032) | out and a little back (±0.18, 0.66, −0.045) |

The right arm mirrors y and z. The grid ran on `KOKIRI_PROPORTIONS`; the kids are built on `KOKIRI_CHILD_PROPORTIONS`
(arms 1 cm shorter), so the chosen angles were re-evaluated on that chain (`arm-eval-child.mjs`): behind, the hands
1.0 cm apart at the lumbar (y 0.563, z −0.076 — at the back's surface), elbows 12 cm out; akimbo, each hand 0.3 cm off
its hip's side (x ±0.110 vs ±0.113). A crossed-arms style was tried and dropped: on this rig the second forearm cannot
pass under the first without the forearms intersecting or the arm laying straight across the chest.

## At play distance (head left, branch right)

`people.mjs` at Link 3.0 m (the follow camera 7.3 m from the kid) and the veranda boy from his stair (Link 2.4 m
before him, `veranda-shot.mjs`, camera ≈ 7 m):

- `ledge-and-bank-link-3.0m-head-vs-arms.jpg` — the ledge girl's arms go behind her, elbows visible past her sides;
  the bank girl's elbows come out through the fence rails, hands on her hips.
- `veranda-boy-from-the-stair-head-vs-arms.jpg` — his hands clasp behind his back.

## Six fixed views

`capture.mjs --quality high --settle 12` on the head `33e92705` (`dist-head02`) and the branch (`dist-arms`), SSIM
against `reference/frames` at 256 × 144, changed pixels at 1280 × 720:

| view | head | idle-arms | Δ | SSIM head ↔ branch | changed px |
| --- | --- | --- | --- | --- | --- |
| A | 0.1948 | 0.1948 | 0.0000 | 1.0000 | 0 |
| B | 0.1767 | 0.1767 | 0.0000 | 1.0000 | 0 |
| C | 0.1852 | 0.1852 | 0.0000 | 1.0000 | 0 |
| D | 0.2503 | 0.2503 | 0.0000 | 1.0000 | 0 |
| E | 0.1997 | 0.1997 | 0.0000 | 1.0000 | 0 |
| F | 0.2191 | 0.2191 | 0.0000 | 1.0000 | 0 |

**Pixel-identical at all six**: the three re-posed kids stand outside the fixed frames (the ledge girl is shown only
off them; the bank girl and the veranda boy are beyond their reach), and the wanderer and the sitter are untouched.
No geometry changed, so draws and triangles are the head's at every view.

