# The Kokiri hands get fingers (lane 7, 2026-09-25 22:20 round)

The owner's "make the other characters look a bit better" at 2–6 m, and two of this evening's landings: Link has
curled fingers now (Astra's PR #59 via #165) and every Kokiri waves at him from 1.7–2.6 m (#144) — with a mitten.
`buildArms`' hand is a flattened ball (r 0.04, scaled 0.85 × 1.15 × 0.6) with a thumb; `kokiri.ts` `buildHands`
adds four fingers per hand: `CapsuleGeometry` r 7.2 mm, bodies 26–34 mm, roots inside the ball so the joint is
hidden, tips 1.7–2.5 cm below it, splayed ±0.07 rad, curled 0.22 rad toward the palm's front. Skin material,
shadows on — `skin.ts` bakes every mesh under a joint into one SkinnedMesh per material, so no draw is added.
480 triangles per kid (3.4 K for the seven).

`fingers-check.mjs` computed the geometry before any render: every root inside the ball's ellipsoid, tips 2.1 /
2.5 / 2.3 / 1.7 cm below the ball, 1 cm forward.

## At play distance

Both builds from the head `bed93a19` (`dist-head22`; the branch `8da5a612`), the harnesses of the greet and variety
rounds, 1280 × 720, crops at 3×. **Top / left = head, bottom / right = fingers.**

- `wave-raised-hand-head-vs-fingers-t2.8-3.4s.jpg` — the grove girl's greeting (`greet.mjs`, `GREET_KID=5
  GREET_FROM=behind`), Link 1.47 m from her, the follow camera 4.3 m behind him: at the wave's outward swing (t 3.0)
  the raised hand shows its fingers where the head's is a blob; the hanging hand reads longer with a finger line.
  Subtle at this range — the camera is ~5.8 m from her — which is the honest size of the change in play.
- `flight-girl-and-door-boy-link-1.2m-head-vs-fingers.jpg` — `people.mjs` at Link 1.2 m (camera 5.56 m): the girl
  on the flight's outstretched hand is four fingers instead of a paddle; the door boy's grip on his stick gains
  fingers around it. No clipping in either.

## Six fixed views

`capture.mjs --quality high --settle 12`, SSIM against `reference/frames` at 256 × 144, changed pixels at 1280 × 720:

| view | head `bed93a19` | fingers | Δ | SSIM head ↔ fingers | changed px | draws / triangles head → fingers |
| --- | --- | --- | --- | --- | --- | --- |
| A | 0.1951 | 0.1948 | −0.0002 | 0.9998 | 84 | 614 / 8.967 M → 614 / 8.969 M |
| B | 0.1768 | 0.1767 | −0.0001 | 0.9999 | 138 | 596 / 8.293 M → 596 / 8.295 M |
| C | 0.1853 | 0.1852 | −0.0000 | 1.0000 | 51 | 533 / 7.959 M → 533 / 7.960 M |
| D | 0.2503 | 0.2503 | −0.0000 | 1.0000 | 1 | 523 / 8.741 M → 523 / 8.741 M |
| E | 0.1997 | 0.1997 | −0.0001 | 0.9999 | 138 | 596 / 8.293 M → 596 / 8.295 M |
| F | 0.2191 | 0.2191 | −0.0000 | 1.0000 | 16 | 555 / 8.098 M → 555 / 8.100 M |

Draws identical at every view; the kids in frame add ≤ 2 K triangles. The changed pixels are their hands at 20 m+.

## Found on the way — and withdrawn

At 00:30 I reported the seated girl (slot 1) as standing in play. **She is seated.** Read live in the page with Link
1.5 m off (`sitter-live.mjs`, this folder's probe): thigh −1.02 rad, knee 1.403 rad (interior 99.6° / 104.1°), chest
curled 0.45, right shoulder −2.68 mid-wave; the skinned meshes' bone matrices match her joints' world matrices, and
the aimed 2.4× crop (`seated-girl-is-seated-link-1.2m-2.4x.jpg`) shows the sit — thighs toward the camera, knees
bent, shins down to the lower tread, hands on her knees. What misled me: the harness's head-on view foreshortens
the thighs to nothing at thumbnail scale, and capture.mjs's `audit.json` reads her `kneeInteriorDeg` as 177.1°
because that audit runs before her first pose (the bind pose's knee) — the live audit reads 99.6°. No lane-7 defect;
the one small thing is that a capture-time audit number should not be trusted as a pose reading.
