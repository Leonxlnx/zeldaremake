# squad lane 1 — atmosphere and clarity (2026-09-23)

The owner's 06:50 message and marked screenshot: *the trees do not populate* — the middle distance
is grey haze where his recording shows layered trees — plus "a jagged bright-blue streak (sky
through a gap)" over the north path. Lane 1's row in `docs/SQUAD_2026-09-23.md`: substantially less
grey washout, mist soft and layered like `review46/r_020–r_028`, god rays subtle, the blue streak
gone, exposure comfortable from ground to sky.

Everything here was rendered on this VM (Chrome + SwiftShader, no GPU), 960 × 540, character
hidden, `broll.mjs --test --settle 6`. Before = `144453ef` (the integration head when this lane
started), built in a worktree so both builds are rendered with the same harness.

## What was actually wrong

`gauntlet/scripts/haze-sample.py` (added here) prints the mean display colour, hue, B/R and the
p10 / p90 of image regions, so his recording and our renders can be read on the same numbers.

**1. The veil was cool.** The 2026-09-16 daylight pass left every airlight colour blue:

| colour | display before | hue | B/R |
| --- | --- | --- | --- |
| `hazeNear` | 0.545 | 205° | 1.12 |
| `hazeFar` | 0.654 | 204° | 1.16 |
| `hazeClosed` | 0.536 | 202° | 1.14 |
| `hazeLit` | 0.704 | 208° | 1.08 |
| `hazeFarLit` | 0.680 | 204° | 1.11 |
| `SKY_GAP_GLARE` | 0.659 | 203° | 1.71 |

His recording's mist, sampled over `r_020`, `r_022`, `r_024`, `r_025`, `r_028`: **hue 25–50°, B/R
0.85–0.94**, and where the veil dominated one of our frames it went cyan (the west pose's far
right: hue 179°, B/R 1.05). There is no blue sky in any frame of his recording — every opening is a
warm off-white glare.

**2. The far air was dark.** At his north pose the path's vanishing point read **0.366** display
against his **0.545**, and the upper-left band 0.365 against 0.500. The veil only reached ~27 % at
45 m (`hazeDensity` 0.008, `hazeFarStart` 49), so the 30–80 m band rendered as its own dim surfaces:
a grey soup with nothing bright behind the trees for them to read against.

**3. The north corridor had no depth grade at all.** Looking north is a *closed* direction
(`openDir` is ENE), and `kfHazeColor` pinned every closed ray to one flat `hazeClosed` at every
distance. Brightening `hazeFar` moved his pose by 0.003 display — the whole corridor he walks was
one colour. His recording's corridor does deepen (r_025: 0.39 over the near banks, 0.50 at 25–40 m,
0.55 at the vanishing point), just less than the open side.

## What changed

`src/world/atmosphere/heightfog.ts` and `sky.ts` only.

- Every veil colour refitted to his frames: hue 45–50°, display B/R 0.91, luminance from the
  frames' own bands (`hazeNear` 0.505, `hazeClosed` 0.575, `hazeFar` 0.645, `hazeFarLit` 0.665,
  `hazeLit` 0.705, `mistColor` 0.545).
- **`hazeClosedFar` (new)**: the closed roof grades `hazeClosed` → `hazeClosedFar` over the same
  `hazeGradeNear..hazeGradeFar` metres the open side uses. The sky dome's closed colour is the far
  one (the dome is the far end of every ray).
- The wall arrives where his recording puts it: `hazeFarStart` 49 → 34 m, `hazeFarDensity`
  0.008 → 0.022, the colour grade 44/60 → 30/55 m, `hollowDim` 0.65 over 42–52 m → 0.85 over
  52–66 m (it was cutting a third off the radiance exactly up the north path).
- Trees read against it: `farShadeMin` 0.65 → 0.52, `hazeShadeVeil` on at 0.8 (a shaded 15–35 m
  trunk wears less veil than the sunlit gap beside it).
- `SKY_GAP_GLARE` back to the measured warm glare (display 0.687, hue 49°, B/R 0.92). `SKY_ENV_TINT`
  was still calibrated for a warm dome, so the IBL is back on its own calibration too.

## Measured, at his north pose

| region | before | after | his `r_025` |
| --- | --- | --- | --- |
| upper-left air | 0.365, hue 123° | **0.453, hue 42°** | 0.500, hue 43° |
| path's vanishing point | 0.366, hue 59° | **0.430, hue 40°** | 0.545, hue 45° |
| top third, mean | 0.293 | **0.332** | 0.432 |
| top third, p90 | 0.382 | **0.478** | 0.542 |
| lower two thirds (foreground) | 0.301 | 0.300 | 0.302 |

The foreground is untouched — it already matched him — and the whole upper and middle distance
moved 0.04–0.09 toward his recording with the hue within 3° of it. What is still short of him
there is content, not air: his 10–40 m band is full of leafy crowns and ours is bare column trunks
(lanes 2 and 3).

## The six hero views (A–F)

Rendered from both builds at `layout.ts`'s own poses (`hero-poses.json`, sheets in `hero/`):

| view | top third before → after | Δ levels | frame mean Δ levels |
| --- | --- | --- | --- |
| A_stairs | 0.320 → 0.353 | +8.6 | +2.8 |
| B_house | 0.317 → 0.346 | +7.3 | +3.3 |
| C_lookback | 0.284 → 0.310 | +6.4 | +3.7 |
| D_log | 0.310 → 0.341 | +8.0 | +3.7 |
| F_canopy | 0.288 → 0.293 | +1.3 | +0.5 |

This is close to the mirror of pass 3's haze change (A / B / D top thirds −6.2 / −8.5 / −8.9), so
the fixed frames' upper bands land near where they were before that pass — but warm instead of
blue, and with the far surfaces shaded so the arch and the 30–40 m trunks are silhouettes in it.

## The blue streak (his red circle 2)

Looking up at the same spot, before: the canopy gaps are **hue 184°, B/R 1.13** — the jagged bright
blue he circled. After: **hue 52°, B/R 0.855** at the same luminance (0.602 → 0.607). His `r_028`'s
gaps read hue 43°, B/R 0.915. `compare/crop-blue-sky-streak.jpg`.

## Exposure from ground to sky (play mode, the final build)

`playtest.mjs --only look,walk --shots`, ten spots × rest / drag up / drag down, measured on the
canvas after tone mapping (`play/playtest.json`):

- most clipped share **0.24 %** (the west house's lantern glow at rest) — the same as pass 3's
  measurement on the old veil;
- **0 %** crushed to black anywhere;
- looking up: **0 % clipped at every spot**, including the open north with 36 % of the frame sky
  (`play/look-open-north-drag-up.jpg`: the overhead reads 0.679 display, hue 44°, B/R 0.91 — a
  luminous warm sky, not a blue ceiling and not a blown one);
- nine walk routes, all reached, **0 stuck points, 0 page errors**.

## The god rays: measured, then left alone

Pass 3 concluded "the god rays' in-scatter is the veil" (rays off: upper-left third 83.6 → 59.8
levels) and a clearing attempt was backed out for dimming the shafts. Re-measured on the warm veil
(`probe-look.mjs --variants '[{"name":"base"},{"name":"noray","settings":{"rayIntensity":0}}]'`):
the rays now add **+16** levels to the upper-left third, not +24, and his recording's air there is
**brighter** than ours even with the rays on (0.500 against 0.330). Dimming them would move us away
from him, so `rayIntensity`, `beamFloor` and the screen fan are untouched.

## Files here

- `poses.json` — his 06:50 poses plus a look-up pose at the same spot (the blue streak).
- `hero-poses.json`, `up-pose.json` — the six fixed views and the look-up pose on their own.
- `compare/` — before | after | his recording for each pose, and zoomed middle-distance crops.
- `hero/` — before | after for A–F.
- `play/` — play-mode walk and look measurements on the final build.
