# Correction: it is the god-ray in-scatter, not the fog (squad4, 03:05)

**`VEIL.md`, which I wrote at 00:35, names the wrong cause.** It blamed the near/height veil and
pointed at today's four `heightfog.ts` commits. That was a guess from a distance ladder, and it is
wrong. Do not act on it. This file replaces it.

## How I found out

The arithmetic did not support my own claim: at 12 m the distance haze is
`1 − exp(−(0.013×3 + 0.011×4))` ≈ **8 %**, the deep-forest shade does not begin until
`farShadeStart` = 22 m, and `hazeShadeVeil` is 1.0 (disabled). Eight per cent cannot turn brown bark
grey. So I tested it instead of arguing: rebuilt with `density`, `hazeDensity` and `hazeNearDensity`
all at 0.0001 and rendered the same pose. **The bough was still grey.**

Then I isolated the passes properly with `probe-look.mjs`, one world load, four variants at the same
pose — `veil-isolation.jpg`, reading base / no-rays / no-mist / neither:

| variant | mean RGB over the bough band |
| --- | --- |
| base | 106.5 / 103.8 / 87.0 |
| **rays off** | **89.9 / 86.9 / 69.0** |
| mist hidden | 105.7 / 102.9 / 86.1 |
| both off | 88.9 / 85.8 / 68.0 |

The god-ray in-scatter lifts the bough by **17–18 levels**. The mist volume contributes **0.8**. The
height and distance fog, by the rebuild above, contribute very little at this range. With the rays
off the bough is dark brown wood with readable bark, the trunks separate into layers, and the pods
read as lamps because there is finally something darker than they are.

## This was known this morning and is still open

fable-cursor measured it at 07:30 and wrote it in the squad log: *"At the owner's pose the god rays'
in-scatter is most of the grey veil (rays off: upper-left third 83.6 → 59.8 levels, upper centre
96.8 → 74.4)."* A fix was tried at 09:15 — `rayIntensity` 0.32 → 0.28 with `beamFloor` 0.3 → 0.15 —
and **backed out** because it dimmed the shafts themselves at B and D, which are the best thing in
the frame. So the lever was rejected, correctly, and the defect stayed.

## Why the owner's three screenshots are all this

- **the bough as "a dead branch"** — 18 levels of in-scatter laid over wood at 8–12 m;
- **"the trees are cut in half, the top blurry, the bottom alright"** — `rayAirFadeLo/Hi` fades the
  base-air in-scatter in **by world height**: the lit air is the upper air. A tall bole therefore
  wears almost none at the root and a lot at the crown, with the transition where those two heights
  fall. That is the horizontal band he circled;
- **"the foliage looks strange when I look up"** — an up-ray marches the most lit air of any ray in
  the scene, so the canopy takes the strongest dose.

His "pods stopped glowing" stays as I reported it: they are lit at every distance; they lose to the
background the rays create.

## The lever nobody has tried

`rayIntensity` is the wrong knob — it dims the shafts, which is why 09:15 backed out. The composer
already separates the two contributions (`postfx/composer.ts`): the **shaft columns** (`beamColumn*`,
`SHAFT_COLUMNS`) and the **base air** the whole frame swims in (`rayBaseDensity`, faded in by world
height over `rayAirFadeLo`/`rayAirFadeHi`). The mist layer already has a distance ramp
(`rayMistNearStart`/`rayMistNearEnd`, "start >= end disables the ramp"); **the base air has no such
ramp**. Give it one — near the camera it contributes little, past ~15 m it is as it is now — and the
near field comes back while every shaft and every far band stays exactly where lane 1 put it.

Acceptance: the bough at 8–12 m reads as wood; the shafts at B and D are unchanged level for level;
the owner's north pose far bands (`owner-0650-north` mean 0.306, top band 0.373) do not move.

## What I did not do

I did not change `src/world/postfx/composer.ts` or `src/world/atmosphere/`. It is another lane's
file, it is a shader change on the render path an hour after a recording, and the integration branch
has not moved since 23:05 — nothing would reach the owner tonight anyway. This is the aimed
hand-off, with the isolation already done so the next person starts from a measurement instead of a
guess.
