# The south exit had no sound

Branch `agent/squad5-south-exit`, off `92a4fd66`.

Everything the lane had was merged and there was nothing new from the owner about sound, so this is
the next thing a player meets: the world grew south while the audio did not follow it. The rope
bridge over the ravine and the hollow log burrowing into the far bank are both **walked**, and the
surface map (`surfaceAt`) knew about neither — the bridge reported `grass` and the far log reported
whatever the terrain guessed. Two new pieces of the world he asked for, sounding like a lawn.

## The bridge is its own surface, not `wood`

A deck on the ground and a deck over eight metres of ravine are not the same sound, so `bridge` is
its own design rather than a reuse of the west house's planks:

- the board is thinner and unsupported, so its body sits at ~142 Hz against the deck's ~198 and
  rings 0.17 s against 0.10;
- a sub an octave under it (0.5×, 0.26 s) — nothing is holding the plank up;
- a brighter tick, because a thin board cracks rather than thuds;
- and on about three steps in five, the **rope lashings** answer: a narrow `Q 7` band drifting
  430 → 330 Hz over 0.22 s as the span takes the weight.

`footsteps.test.mjs` asserts the relationship rather than the numbers: the bridge's lowest body is
under 80 % of the deck's, it rings longer, and the rope creaks on most steps but not all.

## The far log closes over you like the plaza arch

`EXPANSION_SOUTH.tunnel` gets the same treatment the log arch already had: the `hollow` step, and a
smooth `enclosure` that shuts the whole bed from 18 kHz toward 900 Hz and ducks it to 45 % as the
wood comes over the listener, ramping over the first 1.6 m of the bore.

## Walked, in play mode

`walk-audio.mjs` gained two routes down the south exit (`walk-audio.json`):

| route | steps | heard as |
| --- | --- | --- |
| across the rope bridge | 44 | 10 stone on the approach paving, **32 bridge** across the span, then the far bank |
| into the far hollow log | 16 | 3 stone on the far path, **13 hollow** |

and the far log's enclosure ramps and holds with no step in it:

```
0 0 0 0 0 0 0 0 0 0 0 0 0.06 0.16 0.26 0.36 0.46 0.56 0.66 0.76 0.86 0.96 1 1 1 1 1 …
```

Both headings had to be corrected first: south is **+z**, and `__ZR_PLAY__.place(x, z, yaw)` takes
forward = (sin yaw, cos yaw), so the first attempt at yaw 180° walked him away from the bridge and
reported 39 `grass` steps — which is exactly what the old surface map would have said on the bridge
itself, and a good reminder to read the end position before believing a route.

## Offline

`OFFLINE_WALK` gains a `bridge` leg **after** the closing stand, so every earlier leg keeps its
times and older before/after renders stay comparable. `clips/bridge.mp3` is that leg beside
`clips/deck.mp3`, the west house's planks from the same render — the two woods, a few seconds apart,
so the difference is audible rather than asserted. The three woods measured off that render:

| | peak dBFS | centroid Hz | low/high |
| --- | ---: | ---: | ---: |
| the west house's deck | −31.1 | 443 | 52.3 |
| the hollow log | −33.0 | 787 | 50.7 |
| **the rope bridge** | **−37.2** | **1394** | **27.7** |

The bridge reads as the quietest of the three unweighted, and its level was lifted 3 dB once for
that before being left alone: almost all of its energy sits at 142 Hz and below, where a 2 ms RMS
window under-reads, and A-weighted it is inside the 6 dB the balance test holds all eight surfaces
to. Pushing it further to satisfy an unweighted peak would make it louder than it should be — a
plank over a gorge is a thinner, lighter sound than a deck on the ground, which is the point.

## Reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/after --seconds 50 --stems steps
python3 art/audio/2026-09-23-lane5/spectra.py steps --before /tmp/before --after /tmp/after --out steps.jpg
node art/audio/2026-09-23-lane5/walk-audio.mjs --dist dist
node --test src/audio/ambience.test.mjs src/audio/footsteps.test.mjs src/audio/music.test.mjs
```
