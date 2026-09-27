# the fairy was only ever measured against a lantern

*"A soft cue for the Kokiri fairies near them"* has been on this lane's standing list since the
first day, and it has been answered four times — by me, three of them — with **"the glint
exists"**. It does. Whether anyone hears it had never been measured, and it turned out it could
not be: the instrument for isolating one stream of the bed could not isolate this one.

**`mute` could take out three of the bed's five streams.** The two it could not were the pod
lantern's flame and the fairy's glint, which is exactly backwards — those are the two that need
isolating to be measured at all. A flame at a metre is the loudest never-stopping thing in the
world and a fairy is the quietest thing in the bed, so *"the fairy against the forest"* was
really the fairy against a lantern.

Fixed and tested. And with it fixed: **on the lane's own scripted walk the fairy sounds four
times in fifty seconds and clears the forest behind it by a median of 17 dB**, three of the four
above it. The cue works. It is now a measurement instead of an assertion.

    src/audio/ambience.ts        AmbienceLayer gains 'flames' and 'glints'
    src/audio/ambience.test.mjs  one test covering all five, two probes

---

## What the instrument could not do

```ts
export type AmbienceLayer = 'flutters' | 'birds' | 'wind';
```

Five streams reach the bed's bus — the wind's two continuous layers, the leaf flutters, the bird
calls, the lantern flames and the fairy glints — and three of them could be switched off. Every
*"what is this layer worth"* measurement on this lane rests on that switch, and `2026-09-26-shadow2`
already found it silently failing once (`mute` was not muting the wind at all, and re-running what
that invalidated moved a published number by 8.8 dB).

So the first take here, ninety seconds standing a metre from a Kokiri kid with the wind and the
birds and the leaves muted, measured **a lantern**. The glint is `FAIRY_LEVEL = 0.014`, the
smallest level in the bed by a long way; the flame beside it is the largest. Nothing about that
comparison could have come out meaning anything.

`flames` and `glints` are now on the list, muted the way the flutters and the birds already are —
by leaving the connection to the bus off, with every node still built and every seeded draw still
made, so a muted take is the same forest with one stream unplugged.

The wind stays different and the test says so: its two layers remain wired and are aimed at zero,
because what they carry is modulation as well as level. That mechanism has its own test, which is
the one that caught the failure.

## What the fairy is worth

Fifty seconds of the scripted walk — the lane's own route, which passes the kids — rendered three
ways: the glints alone, everything except the glints, and the whole bed.

| | rms | peak |
| --- | ---: | ---: |
| the glints alone | −60.8 dB | −26.9 dBFS |
| everything else | −38.8 dB | −18.1 dBFS |
| the whole bed | −38.8 dB | −18.1 dBFS |

Over a whole take the fairy is **22 dB under the forest**, which is the right way to be wrong
about it: a cue is not heard on its average, it is heard at the moment it happens, in its own
band. The glint is high-passed at 1200 Hz and is two or three bell partials climbing over about
120 ms, so each one is compared with the forest's level at that same instant between 1.2 and 9 kHz:

```
   1.0 s   +11.7 dB
   3.9 s    -1.9 dB
  45.3 s   +22.3 dB
  46.9 s   +26.9 dB
```

**Median +17.0 dB, three of four above the forest behind them.** One in four arrives under it by
2 dB, which is a leaf landing at the wrong moment rather than a fault — and it is worth saying
that one-in-four is a sample of four.

Four glints in fifty seconds is one every twelve, and the cue only runs while a fairy is inside
`FAIRY_AUDIBLE_M` (4.33 m). So it is rare, quiet and clearly above the forest when it happens,
which is what *"a few grains of light, never a shimmer laid over the forest"* was aiming at.

## A trap worth writing down

The first attempt stood at `LAYOUT.npcSpots['kokiri-a']` — (9.0, 3.6) — plus a metre, on the
reasoning that each kid carries a fairy. **No fairy was within earshot there**: ninety seconds
produced a glint stem at −117 dB rms, and the bed with the glints muted was identical to the bed
without.

`LAYOUT.npcSpots` is where the kids are *authored*, and the layout's own comment beside those
entries says the character system "marches" them elsewhere. A spot in the layout is not a spot in
the world, and anything in this lane that reaches for an NPC's position has to take it from the
scene. The scripted walk does, which is why it worked.

## Clips

    glints-alone.mp3        the fairy on its own, +18 dB so it can be heard at all
    bed-with-fairies.mp3    the whole bed over the same fifty seconds
    bed-without-fairies.mp3 the same, with the glints muted — the difference is the cue

## Gates

    npm run typecheck                                        clean
    npm run build                                            clean
    node --test src/audio/*.test.mjs                        107 / 107
    node gauntlet/scripts/playtest.mjs --only walk           11 / 11 routes, no page errors

Both new gates were put back the wrong way — connecting the flame and the glint to the bus
regardless of the mute — and both are caught by *every stream in the bed can be taken out on its
own*, which also asserts that muting a layer changes **no seeded draw**, so a muted take stays
comparable with a full one.

## Named, not taken

- **Four glints is a sample of four.** The one that arrived 1.9 dB under the forest might be
  typical or might be the only one; fifty seconds of one route cannot say. A long standing take
  beside a fairy would, and needs the fairy's real position, which needs the scene.
- **`stats()` is null in a capture page**, so the glint count had to be recovered from the audio
  instead of read off the counter. That is the second time this has cost a re-run; the counters
  exist only on the live mount and nothing says so at the call site.
- **The flame can now be isolated and has not been.** It is the loudest never-stopping thing in
  the world and the reason the first take here meant nothing. Standing a metre from a pod with
  everything else muted is now one flag away and nobody has looked.
- **`FAIRY_AUDIBLE_M` is 4.33 m** and is derived, not chosen — it is where the inverse-square law
  has taken three quarters of the level. Whether a player's path ever comes that close on the
  eleven walk routes is a different question from the one measured here.

## Reproduce

```bash
npm run build
node art/audio/2026-09-27-fairies/glint.mjs --dist dist --out /tmp/fairies --seconds 90
python3 art/audio/2026-09-27-fairies/glint.py /tmp/fairies
node --test src/audio/ambience.test.mjs
```
