# Lane 5 — the village's houses were not in the world the sound knows about

Branch `cursor/squad5-ravine-5535`, stacked on `cursor/squad5-pad-5535`
([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). `src/` changes are `index.ts` (the
occluder list and its docstring) and `occlusion.test.mjs`.

This started as an attempt at the standing item *"the plaza opening up against the closed
canopy"*, went looking for a term that could tell the plaza from the lawn, and found something
else on the way.

## The null that led here

`2026-09-25-places` left one specific weakness open: **the open outdoors is one place.** A paved
stone circle in a clearing, an open plateau dais and mid-span over a ravine are within 1.7 dB of
one another in shape. The obvious missing term is *how much is standing around me* — the plaza is
the village centre, the lawn is a field — so `surround.mjs` computes one from the occluder list
(each obstacle's arc of the horizon, weighted inverse-square) and prints it at the thirteen
surveyed places.

```
place             surround  nearest solid
grove-deck           0.279      hut 2.2 m
forest-floor         0.155     bole 3.2 m
lookout              0.074     bole 6.1 m
lawn                 0.057    bole 10.5 m
plaza                0.048    bole 10.1 m
north-clearing       0.007     hut 23.9 m
```

**The plaza has nothing around it.** Its nearest solid neighbour is a bole 10.1 m away — no closer
than the lawn's 10.5, and further than the lookout's 6.1. The term separates nothing because in
this world the open places genuinely are alike in this respect, and no amount of sound design
fixes a plaza that has nothing standing near it.

Except the list it was computed from was wrong.

## What was missing

`OCCLUDERS` describes itself as *"the solid things a player can put between himself and a sound:
the thirteen giant boles and the three huts."* `LAYOUT.houses` is not in it.

```
   what is missing:
      saria    (12.5, -11.5)  r = 3.2 m — 6.4 m of wood across, 1 listed obstacle as wide
               nearest listed obstacle: plateau-oak at 11.5 m, so it is not a hut on a trunk already counted
      upper    (13.5, -17.5)  r = 2.7 m — 5.4 m of wood across, 1 listed obstacle as wide
               nearest listed obstacle: plateau-oak at 6.5 m, so it is not a hut on a trunk already counted
```

Saria's house is the **widest solid thing in the world after the west house** — wider than every
giant bole, whose largest is 2.2 m — and it stood in the middle of the village casting no shadow
at all. `trunkRadius` is the hollow trunk the house is carved into (`house.ts` scales the whole
build from it, `k = R / 3.2`, Saria's being the hero), and it is solid at head height.

What that cost, over the same 12,638 standing points and sixteen bearings from each:

```
   shadowed today      16832 of 202208 bearings  (8.3 %)
   with the houses     20663 of 202208 bearings  (10.2 %)
   the houses add      3831 bearings, 23 % more of the world
   deepest new shadow  11.63 m of wood standing at [13,-35], against 0.00 m today
                       that is 1.94 of OCCLUSION_FULL_M, where today it is 0.00
```

**Twenty-three per cent of the shadowed bearings in this world were missing**, and there are lines
through the pair carrying 11.63 m of solid wood that the sound passed straight through.

## After

Three spots, the bed rendered at each on a build whose occluder list has the houses and one whose
does not, with the wind muted because it is diffuse and has no position to shadow. The difference
between the two takes **is** the houses' shadow.

```
where                          320-1000 Hz 1000-2000 Hz 2000-4000 Hz 4000-8000 Hz   whole take
   west-of-saria          before     -32.4 dB     -40.1 dB     -34.6 dB     -68.5 dB    -42.4 dB
   west-of-saria           after     -32.4 dB     -40.1 dB     -48.1 dB     -68.6 dB    -43.2 dB
                           moved      +0.0 dB      -0.0 dB     -13.5 dB      -0.0 dB
                        the two takes differ by -8.6 dB against the take   the houses, and audibly

   below-the-houses        moved      +0.0 dB      -3.5 dB      -0.0 dB      -0.0 dB
                        the two takes differ by -21.9 dB against the take   only 0.67 dB of level

   lawn                    moved      +0.0 dB      +0.0 dB      +0.0 dB      -0.0 dB
                        the two takes differ by -50.3 dB against the take   only 0.03 dB of level
```

**Standing 2.3 m clear of Saria's trunk, the calls lose 13.5 dB out of 2–4 kHz** and nothing else
moves — which is exactly what a bole is supposed to do to a bird. `OCCLUSION_TOP` is 0.18 against
`OCCLUSION_DUCK`'s 0.5: an obstacle a few wavelengths across takes the top off three times harder
than it takes the level, so a shadow shows in the top band and only there. Measuring this as a
broadband level would have read 0.8 dB and looked like nothing.

Nineteen metres away on the lawn the houses are worth **0.03 dB**. That is not zero and it should
not be: the houses can still stand between a listener there and a far pod, barely. It is 42 dB
less than behind Saria's, which is the shape a distance-dependent thing should have.

## The guard, which is the part that matters most

A fault like this is not fixed by fixing it. `OCCLUDERS` is a hand-written list of what the world
contains, and the world is written by four other lanes.

So the guard walks `LAYOUT` itself: every array whose elements have a `position` and a radius
field is a category of solid thing, and each one must either be covered by `OCCLUDERS` or named in
`NOT_OCCLUDERS` with the reason it is not. Reverted, it says:

```
houses.saria is 3.2 m of solid world at (12.5, -11.5) and the sound walks straight
through it. Add it to OCCLUDERS, or add "houses" to NOT_OCCLUDERS with the reason.
```

It found a third category on the way: **`heroBoulders`**, three of them, the widest 2.2 m — as
wide as the largest giant bole. Those are excluded, on purpose and in writing: a boulder is
rounded and short, and the line from an ear at 1.6 m to a bird in a crown eight metres up has
cleared it within a few metres. That is a decision now, rather than an omission.

## Listen

`clips/` — sixteen seconds at each spot, a common +16 dB because the bed with the wind muted is
quiet. Nothing else normalised.

```
west-of-saria-before.mp3   west-of-saria-after.mp3
lawn-before.mp3            lawn-after.mp3
```

## Green

`npm run typecheck`, `npm run build`, **252 / 252** tests (one new), and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

## Named, not taken

- **The plaza still has nothing around it**, which is the answer to the item this started as. The
  `surround` term is real and computes sensibly — a veranda two metres from its hut reads 0.279,
  the north clearing reads 0.007 — but the plaza reads 0.048 against the lawn's 0.057 and there is
  nothing for the sound to do about that. If the village ever gains structures around its centre
  the term is written and the numbers are here; until then, checks 9 and 15 are limited by the
  world's geometry rather than by the audio, and that is worth saying in the rubric rather than
  leaving them as an open sound item.
- **The houses' shadow reaches the flames too**, since `2026-09-26-shadow2` put the pods on the
  same occlusion lookup. Not separately measured here — the 0.03 dB on the lawn is mostly that —
  and the shadowed-share survey in that folder would now read higher if re-run.
- `surround.mjs` is kept even though nothing was built on it. It is the measurement that says the
  standing item is a world problem and not a sound one, and it is cheap to re-run when the world
  changes.

## Reproduce

```bash
node art/audio/2026-09-26-houses/missing.mjs --out /tmp/houses
node art/audio/2026-09-26-houses/surround.mjs --out /tmp/surround
npm run build
node art/audio/2026-09-26-houses/behind.mjs --dist dist --out /tmp/houses --tag after
python3 art/audio/2026-09-26-houses/shadow.py --takes /tmp/houses
node --test src/audio/occlusion.test.mjs
```

The `before` pair needs a build with the `LAYOUT.houses` line removed from `OCCLUDERS`; the guard
fails the moment it is.
