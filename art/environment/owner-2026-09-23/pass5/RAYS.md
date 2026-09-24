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

## Why the bough barely moved — decomposed, term by term

I guessed the smear. **I was wrong**, and then I measured every term instead. Same pose, same
bough band, one knob off at a time (`raySmearA`/`raySmearB` are exposed by this branch so a probe
can do this at all):

| what is switched off | bough band | it was worth |
| --- | --- | --- |
| nothing (base) | 106.5 | — |
| the screen fan | 106.8 | 0 |
| the shaft columns | 106.1 | 0.4 |
| **the smear** (both passes) | 104.7 | **1.8** — not the answer |
| the ray-march's mist term | 104.7 | 1.8 |
| **the ambient base air** | **94.2** | **12.3** |
| the rays entirely | 89.8 | 16.7 |

So the ambient base air *is* the cause — my original lever was right — and my distance ramp still
only took 1.2 of its 12.3. The reason is one line:

```glsl
float upperAir = max( smoothstep( uAirFade.x, uAirFade.y, pw.y ) * airNear,
                      clamp( column - 1.0, 0.0, 1.0 ) );
```

Inside a **gained shaft column** the second branch wins, and it bypasses the height gate *and* my
new distance ramp — by design: "inside a gained canopy-hole column the air stays lit down to the
ground — the reference's F shafts land on the stairs." The bough sits in such a column, so its air
is lit at full strength right up to the eye, and no amount of ramping the *other* branch can reach
it.

## The knob, and why I did not turn it

`rayColumnNearStart` / `rayColumnNearEnd` = **2 → 6 m** already fades a column's extra gain in with
marched distance. Extending the far end (6 → ~16 m) would hold the column's ground-lighting
exemption off the near field and should take most of the bough's remaining 12 levels.

It would also dim the shafts that land on the stairs at F, which is the exact thing the exemption
exists to protect and the reason the 09:15 `rayIntensity` attempt was backed out. **That is a look
trade between the bough and the shafts, and it belongs to the atmosphere lane and the owner, not to
me at 05:00 in someone else's file.** The decomposition above is what that decision needs; the probe
to run is one `probe-look` variant with `rayColumnNearEnd` at 12, 16 and 20 against F and the bough.

## Scope note

`src/world/postfx/` is the atmosphere lane's. I changed it because that lane has been idle for five
hours, the defect is the owner's loudest open complaint, and the integration branch has not moved
since 23:05 so nothing was going to land either way. The change is additive, defaults are the only
new numbers, and `rayAirNearStart >= rayAirNearEnd` turns it off — so lane 1 can take it, retune the
two distances, or drop it in one line.
