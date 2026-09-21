# fable-5 — round-53 reviews (`agent/fable-5-r53-review`)

Continues `fable-5-r52-branches.md` after `83b95317` merged it. Same method.

## A. Iteration 43 (17:32–18:00 UTC) — fable-4 `agent/fable-4-plateau-roof` @ `263d8f4d`: the plateau's open sky (opus #05 / round-50 #7)

Two east-giant canopy boughs over the plateau look-up — four non-casting lobes placed by un-projecting
the look-up's blue to 17 m. Head `24dc4cac` + branch; tsc + build green.

| pose | head → roof | note |
| --- | --- | --- |
| A_stairs, F_canopy | **pixel-identical** (F −0.0001 rounding) | the boughs sit outside both frustums |
| `w27-plateau-u` (straight up from the plateau) | 42.9 % of pixels — **blue sky 21.4 % → 9.0 %** | the round-48 walk read 20.5 %; the same measure |
| `w27-plateau-r` (eye level on the plateau) | pixel-identical | non-casting: no new shadow on the dais |
| `x-lookout` | 0.33 % | a bough tip at the top edge |

**Round-50 #7 closes — IMPROVED, merge.** The open blue over the plateau that survived every round since
the round-47 walk is roofed by boughs with layered foliage; at eye level nothing moves and the six views
do not see it. The 9 % that remains is the kind of gap the frames' own canopy has (F's top carries
sky through the lobes). Sheet `fable-5-r53/fable-5-r53-f4-plateau-roof.jpg`.

## B. Iteration 44 (18:23–19:00 UTC) — the head `24dc4cac` → `5f587c7f`: Astra's PR #25 (floor moss colonies) and #26 (log-nosing winding), measured

fable-cursor imported two of Astra's fixes source-only: **#25** — the floor moss domes become low leafy
colonies in `materials/sprouts.ts` (the owner-visible olive blobs at `w05`, 577 seats unchanged) — and
**#26** — the log nosings' tube sides wound outward (FrontSide had shown the underside instead of the
crown). Same positions, both heads:

| view | change | SSIM vs reference |
| --- | --- | --- |
| A_stairs | 3.2 % (the flight) | −0.0003 |
| B_house / C / D / E | 0.4 / 0.7 / 0.2 / 0.4 % | +0.0009 / −0.0002 / −0.0001 / +0.0004 |
| F_canopy | 3.6 % (the flight) | **+0.0066** |
| `w05-spine-d` | 1.1 % — the olive domes at the joints become low leafy tufts | — |

**#25 is right and small** at the pose the owner named: the olive blobs in the joints are leafy colonies
now, at 1.1 % of the frame. **#26 fixes the geometry and exposes the value problem**: with the crowns
facing the camera, the flight at A reads as a dark brown timber stair — the treads all but disappear
under the logs. Measured on the flight box (0.60–0.92 × 0.25–0.70) at A:

| | dark (l < 0.25) | pale (l > 0.45) | mean l |
| --- | --- | --- | --- |
| reference A | 15.8 % | 14.0 % | 0.344 |
| take-0129 (logs, undersides showing) | 52.3 % | 8.3 % | 0.267 |
| head `5f587c7f` (crowns showing) | **61.5 %** | **7.3 %** | **0.248** |

The frame's flight is pale packed treads between *thin* dark nosings; ours is four times the frame's dark
share and 0.1 darker, and the winding fix moved it the wrong way by exposing more timber. The logs are
right in kind (W02 passed on that) and wrong in weight: **fable-2 — a thinner timber (the 13–16 cm
variant), a paler, drier crown (the frame's logs are grey-brown bark with moss only in patches), and
the treads' own light (V17: the flight climbs into a haze gap)** would bring the box toward 16 % dark /
14 % pale. F's +0.0066 says the metric already likes the structure; the value is what the eye misses.
Sheet `fable-5-r53/fable-5-r53-astra25-26-head.jpg`.

## C. Iteration 45 (19:30–19:50 UTC) — the head `5f587c7f` → `c11f0ff4`: Astra's leaf-atlas sRGB recovery, the hearth, the plateau roof v4

Same seven positions on both heads.

| view | change | SSIM vs reference |
| --- | --- | --- |
| A, B, E, F | 0–0.03 % | −0.0001 / −0.0007 / −0.0004 / −0.0005 |
| C_lookback | 0.12 % | −0.0022 |
| D_log | 0.0 % | −0.0013 |
| `w05-spine-d` | pixel-identical | — |

Canopy band (top 35 %), median foliage hue / sat / l — **unchanged to the decimal**: A 76.6° / 0.18 /
0.27, B 69.0°, C 83.3° → 84.5°, D 68.2° → 68.6°, E 69.1°, F 77.8°; the reference's band sits at 60–69°.

**The atlas recovery is invisible at the six views and does not touch the "trees too green" number.**
Whatever the double transfer darkened, it was not the crown cards these frames show (the change may live
in leaf textures the fixed cameras do not resolve, or in the near canopy's clusters at 1–3 m). The hue
target from §7.1 — crowns at 62–65°, the far crowns first — is still open and still Astra's tree-shading
lane; the warmth term measured in r49 §K (C-top 84° → 66° on Astra's tip) is the thing that moved it,
and it has not landed on the head. SSIM's C −0.0022 with 0.12 % of pixels changed is a low-amplitude
shift I cannot place in a crop; noted, not attributed.
