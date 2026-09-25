# Lane 5 — a bird behind the west house

Branch `agent/squad5-birdshadow`, stacked on `agent/squad5-occlusion` (PR #85, the study that chose
the target). Merge #85 first.

Rubric check 45 scored **0**: nothing in the world blocked anything. This builds it, for the source
the study said would be heard.

## What the study said to build, and what it said not to

An obstacle only shadows a source when it spans several wavelengths of it. Through the median 3.1 m
of wood a player can get between himself and something in this world, the Fresnel number is **2.4**
at the pod flame's husk and **5.8** at its body — it bends round — but **32** for a distant bird and
**126** for a near one. So: the birds, which are the highest-frequency positioned thing in the
world, already sit on world-anchored perches, and are what a player locates the wood by. Not the
flames, which were the obvious first choice and the wrong one. Not the wind or the leaves, which are
diffuse and have no position to shadow.

## The change

`occlusionAt(ax, az, bx, bz)` in `index.ts` sums the wood standing on the straight line between two
points, against the sixteen solid things the layout knows about — thirteen giant boles of 1.1–2.2 m
radius and three huts. `OCCLUSION_FULL_M` is 6 m, set at the top of the range the study measured
(2.2 to 6.8 m), so a bole's 3 m is a bit over half a shadow and the west house's 6.8 is all of one.

A perch is a bearing and a distance from where the birds were last seeded, so `PERCH_FAR_M` turns it
into a place — 28 m, just outside `PERCH_RESEED_M`, because the birds a listener has are the ones
inside the radius that walking re-seeds. The shadow is asked **when the call is scheduled**, not
when the bird was put there, so walking behind a bole changes what the bird on the far side sounds
like without moving it.

And a shadow is not a fader. `OCCLUSION_TOP` (0.18) multiplies the call's top; `OCCLUSION_DUCK`
(0.5) takes 6 dB off its level. The top falls by more than a factor of five and the level by six
decibels, because that is what an obstacle wide enough to matter does.

## What it sounds like

<img src="occlusion.jpg" alt="the average spectrum of a bird call, with and without the west house between" />

Three minutes standing still beside the west house, the ambience alone, the same seed, the only
difference being whether the world's solid things are in the way:

```
spot            whole take     the calls (p99 of 2-8 kHz)     between them (p95)
                                before    after    moved                  moved
plaza-south         -13.8 dB       -34.0    -34.4     -0.4                   -0.0
southwest           -10.6 dB       -34.0    -43.3     -9.3                   -0.4
lantern-tree        -23.0 dB       -34.0    -34.0     -0.0                   -0.0
open                -32.3 dB       -34.8    -34.8     +0.0                   +0.0
```

**The call's own band loses 9.3 dB and the wood between calls does not move.** That is the whole
claim: a shadow, not a level. On the sheet the two curves are the same line below 2 kHz — that much
of the bird comes round the house — and separate by 6 to 9 dB across 2–4 kHz, where the call lives.

**Three of the four spots show nothing, and that is the right answer at those spots.** Six perches
sit round the compass and only the ones that happen to fall behind something are shadowed; at the
lantern tree and on the lawn, none did. A change that shadowed every bird everywhere would be a
filter with a story attached.

## Two things I got wrong on the way

**The first design was the pod lanterns.** Flames at known world positions with big trunks beside
them, which seemed obvious. The flame chain is lowpassed at 320 Hz, where a bole is a Fresnel number
of 5.8 and its 132 Hz husk is 2.4. Building it would have produced an after that looked like its
before. The study in #85 exists because of that.

**The west house is built round a trunk.** `EXPANSION.westHouse` and the `southwest-giant` bole
stand at the same point to the centimetre, so the naive occluder list counted one obstacle twice and
handed the line 10.6 m of wood where the world has 6.8. Fixed by swallowing any circle whose centre
lies inside a larger one, with a test that reads the west house's own diameter.

Worth being plain: **fixing it changed none of the numbers above.** At 6.8 m the west house alone
already saturates a 6 m scale, so the clamp was absorbing the double count at this spot. It would
show on a grazing line, or the moment `OCCLUSION_FULL_M` moved, and a wrong occluder list is worth
fixing whether or not today's measurement can see it.

## The guards

`src/audio/occlusion.test.mjs`, five tests. `occlusionAt` is a pure function of the layout, so the
geometry is asserted directly:

* **a line through a bole is blocked in proportion to the wood on it** — dead through the most
  isolated bole reads exactly its diameter over `OCCLUSION_FULL_M`, a grazing line reads less and
  more than nothing, and a hand's breadth outside reads zero. (It uses the most *isolated* bole, not
  the widest: `plaza-south` has another trunk 7.7 m off, close enough to clip a grazing line and
  make the test lie.)
* **only what is between them counts** — a bole behind the listener or past the source blocks
  nothing, the line is the same either way round, and a source in the listener's own place is clear.
* **a hut built round a trunk is one obstacle, not two** — the west house reads its own diameter.
* **the open world is open**, and nothing ever reads over 1 however many boles line up.
* **a shadow takes the top off harder than it takes the level** — the constants cannot quietly
  become a fader, and the furthest perch must lie outside the re-seed radius or walking never
  changes the wood.

## Listen

`clips/southwest-{before,after}.mp3` — ninety seconds beside the west house, one common +13 dB. The
same birds at the same moments; the ones behind the house have lost their top.

## Reproduce

```bash
npm run build
node art/audio/2026-09-25-occlusion/shadowed.mjs --dist dist --out /tmp/shadow --seconds 180
python3 art/audio/2026-09-25-occlusion/calls.py --takes /tmp/shadow \
    --out art/audio/2026-09-25-occlusion/occlusion.jpg
node --test src/audio/occlusion.test.mjs
```

**196 / 196 tests**, typecheck clean, build green. Nothing outside `src/audio/` and `art/audio/`.

Rubric check 45 was 0 and is now, on this evidence, a 3: the birds are shadowed and the flames are
not, which is the right place to stop — but nothing occludes the fairy glints, and the flame behind
the west house (N = 12.7, five pods) is a real shadow this does not yet give.
