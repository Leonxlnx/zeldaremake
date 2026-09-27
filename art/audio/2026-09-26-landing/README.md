# Lane 5 — a landing scales with the fall, over 1.58 dB, and the curve is not what is wrong

Branch `cursor/squad5-ravine-5535`, stacked on `cursor/squad5-pad-5535`
([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). **No `src/` change, and that is the
result.**

`2026-09-26-contact` ended by naming `landingStrength`'s floor as worth its own look: *"it means a
landing from 2 cm and a landing from 1.7 m span only 7 dB. Rubric check 24 is 'landing after a
drop sounds, and scales with the fall' and scores 4 on the existence of the scaling rather than
its range."* This is that look, and it changes a score without changing any code.

## First, what falls this game can make

Fewer than the function is written for. **There is no fall state in the character system at all.**
`loco.jump` is created only on a jump press (`src/world/character/index.ts`), `airHeight` is
non-zero only while its phase is `air`, and the root otherwise sits on the terrain — so **walking
off a ledge does not fall.** Every landing in this game is the end of a deliberate jump.

Its apex is `JUMP_APEX_WALK_M = 0.6` walking and `JUMP_APEX_RUN_M = 1.0` running, and jumping *off*
something adds the drop below it. So the reachable range is 0.6 m to about 9.4 m — a standing
jump, to a jump into the ravine.

## What the curve is worth across it

```
    fall  strength   over a walking jump   the physics asks
   0.6 m     0.642               0.00 dB             0.0 dB   a standing or walking jump
   1.0 m     0.770               1.58 dB             2.2 dB   a running jump
   1.7 m     1.000               3.85 dB             4.6 dB   where the clamp bites
   3.0 m     1.000               3.85 dB             7.0 dB   off a low ledge
   6.0 m     1.000               3.85 dB            10.0 dB   off the plateau
   9.4 m     1.000               3.85 dB            11.9 dB   into the ravine
```

**Every landing on flat ground spans 1.58 dB**, where the impact's own scaling asks 2.2. And
**everything from 1.72 m up is identical** — a jump into the eight-metre ravine lands exactly like
a jump off a low rock, where the physics asks for 11.9 dB between them.

So check 24's 4 is scored on the existence of the scaling. On its range it is a 3, and that is the
score it should carry.

## And the curve is not what is wrong

The obvious move is to widen it. The output is boxed at both ends, and both ends are load-bearing:

- **the floor, 0.45** — a landing is both boots at once, and `STEP_FORCE_WALK` is 0.42, so a
  landing much under it would be quieter than walking.
- **the ceiling, 1.0** — the level the master is staged against. The worst case
  (`2026-09-24-level`) is a run-and-jump take, so every landing in it sits at the top of this
  curve.

That is **6.9 dB of output for 11.9 dB of input**, and any curve between those two endpoints only
redistributes it. Priced, all three:

```
option                              walk vs run jump  walk vs the ravine   ordinary landings
   as it ships                               1.58 dB             3.85 dB             0.00 dB
   physics slope from the floor              2.22 dB             6.94 dB            -2.45 dB
   saturating at the deepest drop            1.01 dB             4.53 dB            -1.30 dB
   physics slope, run jump held              2.22 dB             4.49 dB             0.00 dB
```

The last row is the one worth looking at twice: take the impact's own scaling (amplitude goes as
the square root of the fall) and anchor it so the landing a player hears most is left exactly
where it is. The walk-versus-run cue becomes physically correct, 1.58 → 2.22 dB. And the ceiling
is then reached at 1.69 m against the shipped 1.72, so **the whole range grows by 0.64 dB** while
every walking-jump landing gets 0.6 dB quieter.

**Two thirds of a decibel is churn**, and shipping it dressed as physics would be worse than
leaving it. The curve is close to the best it can be between its ends.

## The one thing that would actually widen it, priced

Raise the ceiling. Measured on this branch, the worst case is **−17.9 dBFS before the trim**
(`2026-09-26-pad`), so 8.9 dB is free after it and `level.test.mjs` requires 6 — **2.9 dB of
slack**.

The worst case *is* a run-and-jump take, so a higher landing ceiling spends that slack one for
one: a ceiling of **1.40** instead of 1.0 uses all of it, and buys 2.9 dB more range at the top.

That slack is what `MASTER_TRIM_DB`'s docstring set aside *"for sources nobody has measured yet —
the ruins' waterfall close to, whatever the expansions add"*. Spending all of it so that a jump
into the ravine lands 6.8 dB over a walking jump instead of 3.9 is not a trade this lane should
make alone. It is written down here with its price so that whoever wants the headroom, or wants
the range, knows what the other costs.

## Check 24

**4 → 3.** The scaling exists, is tested, and is close to physics in slope. Over the falls the
game can actually produce it is worth 1.58 dB, and above 1.72 m it is worth nothing at all. That
is "good", not "nothing left to want here".

## Green

No `src/` change. `npm run typecheck`, `npm run build`, **259 / 259** tests, and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

No clip. There is nothing to listen to: nothing changed, and a pair of identical landings would be
a claim dressed as evidence. The measurement is the curve, evaluated over the falls the game makes
— and the curve is `src/audio/footsteps.ts`, so the arithmetic *is* the shipped behaviour rather
than a model of it.

## Named, not taken

- **A fall state would change this whole analysis.** If the character system ever lets him fall
  off a ledge rather than gluing him to the terrain, landings become common at heights the curve
  currently clamps, and the case for spending the headroom slack gets much stronger. Worth
  re-reading this page then.
- **`JUMP_APEX_WALK_M` and `JUMP_APEX_RUN_M` are 0.6 and 1.0**, which is what makes the common
  range only 2.2 dB wide in the first place. A larger difference between a standing and a running
  jump would widen the audible cue for nothing, and it belongs to the lane that owns the jump.

## Reproduce

```bash
python3 art/audio/2026-09-26-landing/landing.py
```

No render: `landingStrength` is the shipped function and the falls are the shipped constants, so
evaluating one over the other is the measurement.
