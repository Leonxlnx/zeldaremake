# The ambient base air gets the distance ramp it never had — a partial fix (squad4, 04:10)

Read `VEIL-CORRECTED.md` first: the wash in the owner's 23:00 screenshots is the **god-ray
in-scatter**, not the fog. This is the first change against it. **It fixes one of his three
complaints and not the other two**, and the measurement below says exactly which.

## The change

`postfx/shaders.ts` + `composer.ts`, ~12 lines. The ray march accumulates two terms:

```
dens = uDensity.x * height * … * mistNear      // the ground-mist layer
     + uDensity.y * clear * upperAir           // the AMBIENT base air
```

The mist layer has an optional ramp along the ray (`rayMistNearStart/End`). The ambient base air had
**none** — it was at full strength from the first marched metre, gated only by world *height*
(`rayAirFade` 3 → 6.5 m). So the air a walker stands in lit the whole near field, and it did it by
height, which is what draws a horizontal band across a tall trunk.

It now takes the same kind of ramp, `rayAirNearStart` / `rayAirNearEnd` = **4 → 16 m**, with one
important exemption kept: a **gained shaft column** (`shafts.ts`, gain > 1) is unaffected at every
distance, so the beams themselves never thin. `start >= end` disables the ramp, as for the mist.

## What it does, measured

`probe-look.mjs`, one world load, the ramp off / on / rays entirely off:

| pose | ramp off | **ramp 4–16** | rays off (the floor) |
| --- | --- | --- | --- |
| `u-plaza-up` (his "looking up" shot), frame mean | 103.6 | **91.8** | 74.2 |
| the lantern bough at 8–12 m, bough band | 106.5 | **105.3** | 89.9 |

- **Looking up: −11.8 levels, 40 % of the way to no rays at all.** This is his "when I look up
  something's wrong with all the foliage" and it is materially better.
- **The bough: −1.2 levels of the 16.6 the rays put there.** Essentially unhelped.

## It costs the scored frames nothing

| view | SSIM, ramp off → on | pixels changed > 8/255 |
| --- | --- | --- |
| A_stairs | 0.9994 | 0.02 % |
| D_log | 0.9987 | 0.20 % |
| F_canopy | 0.9997 | 0.01 % |

The shafts at A, D and F are where lane 1 left them. `npm run typecheck`, `npm run build` green;
**40 of 40 test files pass.**

## Why the bough barely moved — the next lead

A bough pixel at 8 m marches only 8 m of air, so a ramp over 4–16 m should have taken most of its
in-scatter. It took 7 %. That points past the march to the **smear**: the ray buffer is blurred
along the screen-space direction to the sun and composited, with taps weighted by how close their
marched length is to the pixel's. If that weighting is loose, a near surface inherits the glow of
the long sky columns beside it — which would explain a near bough wearing 16 levels of light that
the air in front of it cannot account for.

So the next measurement is the smear's depth weighting (`postfx/shaders.ts`, the smoothing pass
below the march), not another density. Whoever takes it: render the bough pose with the smear
disabled and see whether the bough drops to the rays-off value. If it does, that is the whole
remaining defect, and it also explains the trunk's band and the canopy.

## Scope note

`src/world/postfx/` is the atmosphere lane's. I changed it because that lane has been idle for five
hours, the defect is the owner's loudest open complaint, and the integration branch has not moved
since 23:05 so nothing was going to land either way. The change is additive, defaults are the only
new numbers, and `rayAirNearStart >= rayAirNearEnd` turns it off — so lane 1 can take it, retune the
two distances, or drop it in one line.
