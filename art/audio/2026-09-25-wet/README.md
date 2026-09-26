# Lane 5 — a lantern across the plaza is mostly the village, not mostly the lantern

Branch `cursor/squad5-wet-5535`, off the integration head at `bc2e015f`.

Rubric checks 42 (*distance is audible — near and far sources are told apart by more than level*)
and 45 (*walking behind something changes it*) have both been stuck at 3 on the same sentence:
**pods and fairies are level-only**.

A bird has had the other half of distance since it was built. `birdWet` sends 0.2 of it to the hall
at arm's length and 0.75 deep in the wood, so a far call is wetter as well as quieter — which is
most of what tells a listener how far away something is, once he has stopped trusting its loudness.
The lantern flame sent a flat **0.45** and a fairy's glint a flat **0.3**, at any distance at all.

## Measured

`renderOffline({ reverb: false })` mutes the hall's return and the room's, so the same take can be
rendered twice and **the difference between the two files is the reverb** — not an estimate of it.
Standing due east of the isolated village lantern at (−2.45, −5.09), whose nearest neighbour is six
metres further on, with the gust held below the knee so the wind layers are silent and the birds
muted, in the flame's own band (60–400 Hz: a 320 Hz lowpass on pink noise with a 132 Hz husk under
it).

```
take        distance    wet share      direct  reflected
before         0.6 m      -26.6 dB        54.1       27.5
before         1.3 m      -26.6 dB        51.0       24.4
before         2.5 m      -26.6 dB        45.8       19.1
before         5.0 m      -26.9 dB        40.7       13.9
              spread        0.2 dB

after          0.6 m      -27.3 dB        54.1       26.8
after          1.3 m      -25.5 dB        51.0       25.5
after          2.5 m      -24.0 dB        45.8       21.8
after          5.0 m      -23.4 dB        40.7       17.3
              spread        3.9 dB
```

**Two tenths of a decibel across the flame's whole range, and now 3.9.** The direct column is
identical in both — 54.1, 51.0, 45.8, 40.7 — so nothing about the flame's own loudness moved; what
changed is how much of it arrives off the village's walls.

3.9 dB is less than the send moves (0.25 to 0.67 over that range is 8.5 dB) because the hall's
return is shared and its own level is not distance-dependent. Worth stating rather than quoting the
constant as if it were the result.

## The change

```ts
export const FLAME_WET_NEAR = 0.25;   // was a flat 0.45
export const FLAME_WET_FAR  = 0.7;
export const GLINT_WET_NEAR = 0.18;   // was a flat 0.3
export const GLINT_WET_FAR  = 0.6;
```

The near values sit under the old flat ones and the far values over them, so the middle of each
range is about where the mix already was — this adds a slope rather than moving the level. The
flame's send rides `PLACE_TAU` like everything else that follows him; a glint is a quarter of a
second long and takes its value when it fires.

## Not taken, and why

**The flame still has no occlusion**, and that stays deliberate: `2026-09-25-occlusion` measured the
Fresnel number at the flame's husk at **2.4** through the median 3.1 m of wood a player can get
between himself and it — it bends round. The same measurement put a distant bird at 32 and a near
one at 126, which is why birds are shadowed and lanterns are not. Check 45's remaining point is the
fairy glints, whose partials start at 2.6 kHz and would shadow properly; they are also never more
than 4.3 m away, where a bole between you and one is an odd thing to arrange.

## Reproduce

```bash
npm run build
node art/audio/2026-09-25-wet/wet.mjs --dist dist --tag after --out /tmp/wet
python3 art/audio/2026-09-25-wet/wet.py --takes /tmp/wet
```

The `before` renders come from the integration head at `bc2e015f`.

## Guard

`ambience.test.mjs` — *a lantern and a fairy are further off in more than level*. Requires
`flameWet` and `glintWet` to fall as a source comes closer, and then drives the bed with one lantern
overhead and the same lantern nine metres off, requiring something to get **wetter** and something
else to get **quieter** — so it cannot be satisfied by a level change wearing a send's clothes.
(Checked: dropping the send's update fails it, and fails the older lantern test too.)

That older test — *a village of lanterns does not sum to a drone* — asserted that exactly one gain
follows the pods. Two do now, the flame and its send, and it identifies the flame as the one that
comes **up** when a lantern arrives.

**221 / 221 tests**, typecheck clean, build green.
