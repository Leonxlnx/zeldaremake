# squad lane 1 — atmosphere and clarity (2026-09-23)

> **Round 2 (from `6d145e90`) is at the end of this file.** It answers fable-5's lane-10 review
> ("the corridor is darker than before the squad — bring the far bands toward l 0.45–0.47, hue
> kept, less saturated") and takes the upper house's dark (`b-upper-2`), which fable-cursor left
> with lane 1 on 09-23 17:45.


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
- `hazeFarLit` (the lit wall past the far rows) sits a step over `hazeClosedFar` — display 0.700
  against 0.665 — or the term would be a no-op in exactly the closed directions it applies to.
- `SKY_GAP_GLARE` back to the measured warm glare (display 0.687, hue 49°, B/R 0.92). `SKY_ENV_TINT`
  was still calibrated for a warm dome, so the IBL is back on its own calibration too.

`src/world/atmosphere/hazepalette.test.mjs` locks the direction (every airlight colour warm, both
sides of the veil deepening with distance, the closed grade reaching the fog chunk) without pinning
the numbers — the palette has drifted cool twice now.

## Measured, at his north pose

| region | before | after | his `r_025` |
| --- | --- | --- | --- |
| upper-left air | 0.365, hue 123° | **0.464, hue 42°** | 0.500, hue 43° |
| upper-left air, p90 | 0.421 | **0.559** | 0.557 |
| path's vanishing point | 0.366, hue 59° | **0.488, hue 42°** | 0.545, hue 45° |
| top third, mean | 0.293 | **0.342** | 0.432 |
| top third, p90 | 0.382 | **0.490** | 0.542 |
| lower two thirds (foreground) | 0.301 | 0.302 | 0.302 |

The foreground is untouched — it already matched him — and the whole upper and middle distance
moved 0.05–0.12 toward his recording with the hue within 3° of it and the upper-left band's p90 on
his to 0.002. What is still short of him there is content, not air: his 10–40 m band is full of
leafy crowns and ours is bare column trunks (lanes 2 and 3). The air is now ready for them.

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

## Mist soft and layered (`mist.ts`)

The pools were ankle-to-waist only (`mistHeight` 2.2 m) and lived in the north hollow. In
`r_022`/`r_025`/`r_028` the mist between the trunks at 15–45 m is a tall, very thin luminous layer
that the crowns and boles cross — it is what separates one depth from the next. A third tier,
**28 curtains** (3–7.5 m tall, 14–26 m wide) on the headings the walk uses: up the north path, into
the west stand, across the plaza's south margin. They fade in only past 13 m (the air the walker
stands in is untouched) and out by 92 m.

Getting them to read took two passes, both measured: at the pools' own noise gate (0.36/0.86, which
cuts the 3-octave fbm's ≈ 0.44 mean to ≈ 0.06) the whole tier moved the owner's north pose by
**1 level** — invisible. With a wide low gate (0.28/0.78) and a vertical fade that thins toward the
top instead of vanishing above the quad's first fifth, they read as bands: **+1.2 levels mean, 8 %
of the frame over 2 levels, 55 levels at the band itself**, and nothing at all when looking up
(0.01 levels). `compare/crop-mist-curtains.jpg`.

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

## Cost

`playtest.mjs --only perf` at four spots, the base build and this one. SwiftShader's wall clock is
9–30 s a frame and useless as a signal, so the deterministic counts:

| spot | draws before → after | triangles before → after |
| --- | --- | --- |
| plaza | 523 → 522 | 7.44 M → 7.44 M |
| stairs2-base | 523 → 523 | unchanged |
| saria-side | 519 → 519 | unchanged |
| west-house | 442 → 443 | unchanged |

The mist tier is 28 more instances in one existing half-resolution overlay draw. Nine walk routes
on the final build: all reached, 0 stuck points, 0 page errors.

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

---

# Round 2 (2026-09-23 22:00–) — the corridor's light back, on `6d145e90`

fable-5's lane-10 walk (10:28, quoted in `docs/SQUAD_2026-09-23.md` §Review notes) read round 1 on
`6664f739`: *"the corridor is populated and warm now… but darker than before the squad… **Lane 1:**
the hue landed; the brightness went the wrong way — bring the far bands toward l 0.45–0.47, hue
kept, and less saturated."* Round 1's veil was fitted when that corridor was empty; lanes 2 and 4
have since filled it with real trunks, crowns, ferns and violets, and two of round 1's terms were
holding all of that new content down.

Boxes are fractions of the frame at the owner's 06:50 north pose (x0,y0,x1,y1, y down), measured
with `haze-sample.py --hsl` (mean HSL lightness, mean saturation over pixels with l > 0.06, and the
share under l 0.12):

| box | region | `6d145e90` | round 2 | his `r_025` |
| --- | --- | --- | --- | --- |
| corridor band | 0.20,0.30,0.80,0.62 | l 0.291 s 0.164 | **l 0.316 s 0.152** | l 0.454 s 0.067 |
| far centre | 0.40,0.28,0.60,0.45 | l 0.463 s 0.077 | **l 0.485 s 0.073** | l 0.515 s 0.055 |
| mid crowns | 0.25,0.05,0.75,0.30 | l 0.385 s 0.087 | **l 0.430 s 0.080** | l 0.471 s 0.067 |
| top third | 0.00,0.00,1.00,0.33 | l 0.311 s 0.125 | **l 0.349 s 0.116** | l 0.423 s 0.057 |
| foreground | 0.00,0.62,1.00,1.00 | l 0.243, 5.0 % near-black | l 0.254, 2.7 % | l 0.218, 22.7 % |

Every band lighter and less saturated, which is the direction asked for. The far centre is past the
0.45–0.47 fable-5 named and nearer his own 0.515.

## What changed

- `hazeDensity` 0.008 → 0.013 and `hazeNearDensity` 0.008 → 0.011. At 0.008/m a surface at 15 m
  wore 8 % veil, so nothing lifted or greyed the verge foliage's own dark green; now 11 % at 15 m
  and 23 % at 25 m, with the foreground to 8 m still under 4 % and crisp. `hazeFarDensity`
  0.022 → 0.018 so the 55 m optical depth is where it was.
- `hazeShadeVeil` 0.8 → 1.0 (off) and `farShadeMin` 0.52 → 0.65. Both were added in round 1 to make
  an *empty* far field silhouette against the new bright wall. Applied to lane 2's and lane 4's
  real foliage they are what fable-5 measured; his mid-distance foliage is a pale warm silhouette,
  not a black one.
- `hazeLitKnee` 0.2 → 0.13: at 0.2 the corridor's upper band reached almost none of the lit air.
- `hazeClosedFar` display 0.665 → 0.700 and `hazeFarLit` 0.700 → 0.735, both at B/R 0.93 instead of
  0.91 — the far bands were asked for less chroma.
- `SKY_ENV_TINT` (1.049, 1.0, 1.0025) → (1.0, 0.98, 0.93) and `environmentIntensity` 0.22 → 0.27.
  The tint existed to *cancel* the dome's warmth so the IBL stayed on an older calibration; with
  the dome now the recording's warm glare, cancelling it is what keeps our shade grey. The shaded
  flagstone it was protecting moved *toward* the reference (display B/R 0.664 → 0.681 against his
  0.69–0.70), and the north pose's foreground near-black share fell 5.0 → 2.7 %.

## For the other lanes — what is left at that pose is not air

The corridor band is still 0.14 under his and the top third 0.07 under, and the veil cannot close
either without fogging the 5–10 m field the owner walks through:

- **Lane 2 / fable-4** — the top third is the canopy over the path. His recording keeps bright gaps
  there (his top third l 0.423 at s 0.057); ours is 0.349 at s 0.116, i.e. still green rather than
  veiled. The mid-crown band is 0.430 against his 0.471.
- **Lane 4** — the corridor band at 4–12 m is verge foliage in shade: our p10 is 0.188 against his
  0.233, and our saturation there is 0.152 against his 0.067. It reads as dark green where his is
  pale and hazy.
