# Lane 5 — the plateau lookout sounded like lawn, and how that went eight rounds unnoticed

Branch `agent/squad5-surface-gaps`, off `4b882d71`.
Run it: `node art/audio/2026-09-24-surface-gaps/probe.mjs --dist dist` — `gaps.json` is its output.
Guard: `node --test src/audio/surfaces.test.mjs` — 3 tests.

## The fault

`LAYOUT.lookout` is a 2.2 × 1.6 m stone dais on the east plateau's south-west lip, standing 0.35 m
proud of the turf at the fence side and about 0.9 m proud on the plaza side. Hardscape merges it
into the `flagstones` mesh, `character/ground.ts` stands the player on its top, and the props lane
sets a rope railing into it. It is a viewpoint: the player climbs the plateau, steps up onto it and
looks west over the plaza and the stair.

`surfaceAt()` returned **`grass`** across its whole footprint, so his boots were on the lawn.

It is stone, not timber, and this is settled in the world rather than a judgement call —
`props/layout.ts` says so outright: the railing is "set into hardscape's stone dais … instead of a
deck of its own (the character ground learns the slab top, so wood over the stone would swallow the
player's feet)". So the dais is paving and the boots should say paving. Added to `surfaceAt()` as an
oriented rectangle in the slab's own frame with a 0.2 m margin for the step block on the fence side.

```
before  u=-2:grass  -1.5:grass  -1:grass   -0.5:grass  0:grass   0.5:grass   1:grass   1.5:grass  2:grass
after   u=-2:grass  -1.5:grass  -1:stone   -0.5:stone  0:stone   0.5:stone   1:stone   1.5:grass  2:grass
```

## Why it was not noticed, and what now notices

`surfaceAt()` re-derives every built surface from `layout.ts` by hand — the west house's platform,
the log arch's bore, the rope bridge's planks. That is correct each time it is written and it goes
stale in silence. A builder adds a thing, `character/ground.ts` learns to stand on it, and nothing
tells the audio. The failure is quiet and specific: the player walks out onto a new structure and
his boots keep saying lawn. There is no crash, no visual change, and no test.

Two things catch it now, in the two places the fault can come from.

**`src/audio/surfaces.test.mjs`** — the standing places `layout.ts` names, each with the surface it
must sound like, plus the mirror check that the ground beside each is still the ground (a footprint
that has swollen past its own outline is as wrong as one never added, and it is the easier mistake
to make once a margin is involved), plus a sweep asserting every surface the footstep designer can
make is reachable somewhere in the world. Pure Node, under a second, no browser. Reverting the fix
fails it by name:

```
not ok 1 - every built standing place in the layout sounds built
      the plateau lookout dais at (21.60, 2.20) sounds like grass, should be stone
      the dais at (0.8, 0.0) in its own frame at (21.17, 2.84) sounds like grass, should be stone
      …
```

**`probe.mjs`** — the same question asked of the running world, because the hand-written list only
knows what somebody thought to add. `__ZR__.audit().systems` publishes hardscape's paved tops (the
top-centre of every flagstone, the north paving, the stair nosings, the standing stones' feet, the
lookout's slab) and structures' walk surfaces — the same tops `character/ground.ts` stands the
player on. The probe reads them from the page and classifies them in Node against the transpiled
`surfaceAt`, so no lane's file has to expose the audio's internals for a harness to read them.

On the current head, 274 published tops:

| group | tops | the boots say |
| --- | ---: | --- |
| `hardscape.flagstones` | 177 | stone |
| `hardscape.northFlagstones` | 45 | stone |
| `hardscape.treadNose` | 40 | stone |
| `hardscape.standingStones` | 7 | stone |
| `hardscape.lookout` | 1 | **stone** (was grass) |
| `walkSurface.west-house.disc` | 1 | wood |
| `walkSurface.west-house.deck` | 3 | wood, wood, stone |

## The one overlap, left as it is

The west house's deck reads `stone` at 0.8 of its span. That is not a gap. The layout has the deck
"falling 6°, on its braces: 1.2 m clear of the turf at the rim, 0.2 m at its end … for `deckEnd` —
the landing row of the `west-house` flight". The deck **ends on the flight's landing**, so its last
metre lies over stone with 0.2 m of air under it, and both answers are true there. The stairs mask
is tested before the built platforms, so the stone wins: walking off the deck the player hears
wood, wood, then the landing about three-quarters of a metre before the timber actually runs out.
That is within a stride, at the exact point he is stepping onto stone, and reversing it would make
the landing itself sound like timber. Recorded rather than changed.

## What the probe also confirmed

Two places worth knowing are already right, since neither was ever deliberately handled:

- the **north clearing** is paved out to its 4.6 m rim and its stone circle's centre slab reads
  `stone`; a metre past the rim it is `leaf`, the forest floor. That falls out of the north paving's
  own mask, which is the correct reason.
- the **north ledge terrace** reads `leaf`. It is an earth-and-rock pad cut into the bank, not a
  built floor, so forest floor is right.

## Still open

Anything a builder publishes into `ctx.shared.walkSpans` (the rope bridge's planks, the log
tunnel's floor) is handled in `surfaceAt` but is not in the probe's list — the south system's audit
does not publish the spans' geometry the way hardscape publishes its tops. Both are covered by the
unit test today. If `expansion-south2` or `exp-north` publishes new spans, add them to the audit and
the probe picks them up for free.
