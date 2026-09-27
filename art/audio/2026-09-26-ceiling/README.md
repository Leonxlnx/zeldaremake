# the loudest moment in the game moved, and nothing was watching

`MASTER_TRIM_DB` raises everything the game makes by 9 dB. The argument for it being safe is one
constant — the loudest true peak the game has been measured to produce — and a rule that six
decibels must stay free above it. The docstring beside that trim explained why the constant was
trustworthy:

> It is stable because the sfx bus has a compressor on it, so **no amount of stacking gets past
> it**.

**There is no compressor.** It came out two iterations ago when four measurements could not show
it was worth its cost. Nothing in this graph limits anything: a peak here is a sum, and the only
thing holding the ceiling is a measurement — which had quietly gone stale.

**The loudest moment in the game is no longer where the constant was measured.** `buses.gorge`
gave the ravine its own convolver, so a boot mid-span returns through *two* spaces instead of one,
and the same deliberate worst case is **1.1 dB louder on the rope bridge than under the lantern
bough**. The recorded figure was 0.1 dB under the real one — right by accident.

    src/audio/graph.ts        the trim's docstring, which described a component that is gone
    src/audio/level.test.mjs  the figure, and a guard that fails when a fourth space is added
    art/audio/2026-09-24-level/worstcase.mjs   --legs and --tag

---

## The four places

Running *and* jumping continuously with the score playing, seventy seconds each, recorded off the
master through a `MediaStreamDestination` — the same construction the figure was first taken with,
pointed somewhere new.

| place | LUFS | true peak | clipped | before the +9 trim | |
| --- | ---: | ---: | ---: | ---: | --- |
| **the rope bridge, mid-span** | −24.1 | **−7.6 dBFS** | 0 | **−16.6 dBFS** | 73 steps, 42 landings, 33 shoves |
| the lantern bough | −24.9 | −8.7 | 0 | −17.7 | 152 steps, 49 landings, 31 shoves |
| inside the log arch's bore | −24.6 | −8.7 | 0 | −17.7 | 91 steps, 53 landings, 43 shoves |
| inside the west house | −24.9 | −9.7 | 0 | −18.7 | 65 steps, 58 landings, 46 shoves |

**The bridge wins on half the footsteps.** 73 against the bough's 152, and still a decibel louder
— the peak is not coming from how many boots land, it is coming from each one being answered
twice. The bough has the densest lantern cluster in the world and the hardest surface and the
fastest step rate, and none of that is worth as much as a second space.

The two enclosed places are the control for that reading: the bore and the west house both have a
room return on top of the hall, exactly like the bridge, and both come in *quieter* than the
bough. A second space is worth something only where the first one is already loud — over the
ravine a boot is in the open with a rock wall five metres off, and inside a hut it is neither.

## What it cost, and what it did not

Nothing clips anywhere. The headroom rule wants six decibels free above the worst case after the
trim and the bridge leaves **7.6**, so the guard passes and passed before. The constant was
optimistic by a tenth of a decibel, which is not a fault anyone would hear — the fault is that
**it stopped being a measurement of the graph that ships and nothing said so.**

It was also right for the wrong reason. −16.7 was the bough's figure *taken while the sfx bus was
still compressed*; with the pad the bough measures −17.7. So the old number survived a change that
should have moved it by a decibel, and then sat just under a new worst case it knew nothing about.
Two errors in opposite directions is not a safety margin, it is a coincidence.

## The guard

A peak measurement is a measurement of a particular graph, and the way this one went stale is that
the graph grew a return and the number did not know. So the number now knows:

```js
const returns = [...src.matchAll(/^\s*(\w*Return)\.connect\(master\);/gm)];
assert.equal(returns.length, RETURNS_MEASURED_AGAINST, `… Re-run worstcase.mjs in every enclosed place and take the loudest.`);
assert.doesNotMatch(src, /createDynamicsCompressor/, 'something limits the bus again — the worst case is no longer a sum');
```

Every space that returns into the master can add to a peak, so the count is the shape of the
thing that was measured. Add a fourth and the test fails with the command to run. Put a limiter
back and it fails too, because then a peak stops being a sum and the constant means something
else.

Both were put back and both are caught:

| the fault put back | caught by |
|---|---|
| a fourth return into the master | *the worst case is pinned to the graph it was measured on* |
| a `DynamicsCompressorNode` on the bus | that, and *the sfx bus carries a gain and nothing else* |

## Clips

    bridge.mp3 / bough.mp3   fourteen seconds of each worst case, the same construction in
                             both — the bridge is the one with two tails on every boot

## Gates

    npm run typecheck                                        clean
    npm run build                                            clean
    node --test src/audio/*.test.mjs                        106 / 106
    node gauntlet/scripts/playtest.mjs --only walk           11 / 11 routes, no page errors

## Named, not taken

- **Four places is not every place.** The grove's veranda is eleven metres up on timber, the far
  bank's hollow log is a room inside a room, and neither was recorded. The four here were chosen
  as the ones with a second return or the densest sources; a fifth that beats the bridge would
  have to find a third space, and there are only three.
- **The worst case is a construction, not a player.** Nobody runs and jumps continuously for
  seventy seconds. It is the right thing to size headroom against and the wrong thing to quote as
  what the game sounds like — ordinary play sits about 8 dB below it.
- **Seven decibels are still unspent.** The trim could go to +16 before the bridge reached the
  6 dB rule. That is a decision for the owner and not for this lane, and it is written down here
  so the room is visible rather than lost.
- **The count is a proxy.** Three returns is the shape today; a space could be made louder without
  being added, and the guard would not notice. What it catches is the failure that actually
  happened.

## Reproduce

```bash
npm run build
for p in "bridge:3.8,33,180;4.0,41,0;3.8,37,90;4.0,35,270" \
         "bough:1.5,-4,180;1.5,-12,0;-1.5,-6,90;3.5,-8,270" \
         "bore:4.84,-53,180;4.84,-57,0;4.6,-55,90;5.1,-55,270" \
         "westroom:-23,8,180;-23,10,0;-23.8,9,90;-22.2,9,270"; do
  node art/audio/2026-09-24-level/worstcase.mjs --dist dist --out /tmp/worst --seconds 70 \
      --tag "${p%%:*}" --legs "${p#*:}"
  ffmpeg -y -i /tmp/worst/${p%%:*}.webm -ar 44100 -ac 2 /tmp/worst/${p%%:*}.wav
  python3 art/audio/2026-09-25-headroom/verdict.py --take /tmp/worst/${p%%:*}.wav
done
node --test src/audio/level.test.mjs
```
