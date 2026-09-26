# Lane 5 — a machine no test could reach, and the fault that was in it

Branch `cursor/squad5-ravine-5535`, stacked on `cursor/squad5-pad-5535`
([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). `src/` changes are `footsteps.ts`
(the machine extracted and one threshold removed), `index.ts` (eleven lines become four) and
`cadence.test.mjs`.

Check 28 of `art/audio/RUBRIC_50_SOUND.md` — *nothing fires twice for one event, and nothing is
missed at any frame rate* — has been at 3 with a note that says why: *"frame rates now tested and
a real fault fixed… The double-fire half still rests on `MIN_STEP_GAP` and the stance-edge test."*

Half of that check was measured properly. `2026-09-25-tickrate` drove the distance integrator at
eight frame rates and found that **one step in fifteen was being dropped at the tick the game
actually runs at**. The other half — the jump's two contacts — had never been driven at all, and
the reason is structural: it was eleven lines inside `mountAudio`'s tick.

```ts
const air = player.airHeight?.() ?? 0;
if (air > 0.02) {
  if (peakAir === 0) footsteps.pushOff(t, …);
  peakAir = Math.max(peakAir, air);
} else if (peakAir > 0.05) {
  footsteps.land(t, …, peakAir, …);
  peakAir = 0;
} else peakAir = 0;
```

A machine that cannot be reached by a test is a machine nobody has checked. This one had a fault
in it.

## The fault

**The shove opens at 0.02 and the landing needs 0.05.** An arc that peaks between them shoves and
never lands.

That is a contact with no answer — the exact thing `2026-09-24-jump` was written to remove
(*"leaving the ground sounds — a shove, not silence"*, rubric 25) — sitting inside the machine
that removed it, the other way round.

It came out of the test on its first run:

```
not ok 4 - every contact has both ends, at every size of arc
  a 2.1 cm arc fired 1 shoves and 0 landings — every contact must have both ends or neither
```

**It is not reachable in the shipped game.** `airHeight` is non-zero only while
`loco.jump.phase === 'air'` (`src/world/character/index.ts`), the phase is entered only on a
deliberate jump press, and that arc peaks near 0.8 m. Fixed anyway, and not merely documented,
because the character system belongs to another lane and its jump can change without anyone here
hearing about it — which is exactly how a latent fault becomes an audible one.

## The fix, and what it costs

One threshold for both edges. **It is the landing's, not the shove's**, and that is
`landingStrength`'s doing:

```ts
export function landingStrength(fallM: number): number {
  return Math.max(0.45, Math.min(1, 0.45 + fallM * 0.32));
}
```

It floors at 0.45, so a two-centimetre bob, if answered, would land **7 dB under a full drop from
a storey** rather than the nothing it deserves. Unifying downward would have made tiny hops thump;
unifying upward makes them silent at both ends, which is what a two-centimetre bob is.

The cost is the shove firing a little later — when the arc passes 5 cm rather than 2. On a jump
peaking at 0.8 m over 0.62 s that is **6.0 ms**, under a fifth of the 33 ms tick the game runs at,
and it is a test rather than a claim:

```js
assert.ok(late < 0.033 / 5, `the shove now fires ${(late*1000).toFixed(1)} ms into the arc rather than …`);
```

## What is now tested that was not

Four tests, all on the extracted `contactFor`.

- **One jump is one shove and one landing, at every frame rate.** A real parabola sampled at
  1/120 through 1/6 s. Exactly one of each, in the right order, at all seven — and the *fall* it
  reports, which is what `landingStrength` scales with, is within a tenth of the arc's true peak
  at every rate. A coarse tick can only ever under-read a sampled peak, and the test asserts that
  direction as well as the size.
- **Every contact has both ends, at every size of arc**: 1 cm through 80 cm. This is the one that
  failed.
- **A height that flickers on the threshold does not machine-gun.** The machine has no clock and
  cannot suppress a chattering `airHeight` itself, so the guard has to be downstream — the test
  drives 120 alternating samples through it and requires `MIN_STEP_GAP` to cap what is heard.
- **The threshold's cost**, above.

## Check 28

**Stays at 3 this pass**, and should move at the next re-score. Both halves are now driven at
frame rates rather than trusted, which is what the row's note asked for, and a fault came out of
the half that had never been driven — the same outcome the first half had. What holds it at 3 is
that the *stance* path (the gait's own boot plants, which is what drives steps whenever the
character system publishes `feetContact`) is still only tested through the distance integrator's
frame-rate sweep and its own edge test, not driven with pathological flags. That is the next piece
of this row and it is named rather than done.

## Green

`npm run typecheck`, `npm run build`, **256 / 256** tests (four new), and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

No listenable clip: the change is inaudible in the shipped game by construction — the arcs it
affects cannot occur — and a clip of two identical jumps would be a claim dressed as evidence.
The evidence is the test that fails when the asymmetry is put back.

## Named, not taken

- **The stance path at pathological frame rates.** Both feet rising in one tick, a stance array
  that appears and disappears between ticks, and `wasStance` going stale while the distance
  integrator runs. All three are reachable by a test now that the pattern exists; none is driven.
- **`landingStrength`'s 0.45 floor is why the thresholds had to be unified upward**, and it is
  worth its own look: it means a landing from 2 cm and a landing from 1.7 m span only 7 dB. Rubric
  check 24 is *"landing after a drop sounds, and scales with the fall"* and scores 4 on the
  existence of the scaling rather than its range.

## Reproduce

```bash
node --test src/audio/cadence.test.mjs
```

To see the fault, put the asymmetry back — `AIR_MIN` to 0.02 and the landing's comparison to a
literal 0.05 — and the second test names the 2.1 cm arc.
