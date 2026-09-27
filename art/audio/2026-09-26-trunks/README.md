# the rest of the forest, priced — and the price is not the one I quoted

Yesterday's report closed with a cross-lane item and a price:

> The sound can only occlude what `LAYOUT` publishes — thirteen giant boles and five buildings.
> `src/world/trees/index.ts` builds exactly the shape an occluder wants … and exports none of it.
> **The price is one exported array.**

**Both halves of that are wrong, and this is the correction.** The array is already exported —
`ctx.shared.slimTrunks`, 121 white-bark and understory boles with radii and height extents, built
for the play camera's collision and read by the props system. Nobody has to write it. And it
cannot be used as it stands, for a reason that has nothing to do with plumbing: **it is shorter
at a lower quality setting**, so wiring it in would let a video option change what the player
hears.

**No `src/` change.** What this produces is a number for something that was an assertion, a
correction to a price I published, and one calibration re-verified against the fuller world.

    art/audio/2026-09-26-trunks/worth.mjs   the instrument, and the two dumps it reads

---

## What the sound does not know about

`OCCLUDERS` resolves to **sixteen things** once its overlap filter has run: thirteen giant boles
and the buildings that are not standing on one. The trees system draws 121 more boles that a
player can walk behind — radii 0.08 to 0.45 m, and **every one of them over 2.5 m tall**, so
every one blocks at head height, which is the height the sound's occlusion model works at.

The list is dumped out of a live world, because it is computed at build from seeded placements
and there is no honest way to reproduce it offline.

## What they are worth

Stand a player at every metre he can stand on, look sixteen ways from each, and run the shipped
`occlusionAt` over both lists. 7,992 standing points, 127,872 bearings, each line `PERCH_FAR_M`
(28 m) long — the longest the sound ever asks about.

```
  bearings with any wood on them   14.6 %  →  22.3 %
  bearings that gain wood           8.7 %  (11,064 of 127,872)
  wood added, median                0.52 m   p90 0.75 m   most 1.70 m
  what that is worth in level       median −0.38 dB   p90 −0.56 dB   most −1.33 dB
  and to a call's top               7000 → 6040 Hz at the median, 4303 Hz at the most
```

**Half again as many bearings would have wood on them**, which is the headline and is a real
change in how often the forest matters. What arrives per bearing is small: a bole 0.28 m across
is 0.56 m of wood against a 6 m scale, so the level barely moves.

The **colour** moves more than the level, which is this lane's usual finding in its usual
direction: `OCCLUSION_TOP` is 0.18, a steep exponent, so 9 % of occlusion is already a fifth of
an octave off a bird's top. That is the part a listener would notice.

## A calibration that survives

`OCCLUSION_FULL_M = 6` was set *"at the top of"* the range of wood a player can get between
himself and a source — and that range was measured against the same sixteen things, so it is
worth re-reading against the fuller world even if the trunks never ship.

| the deepest wood from each standing point | median | p90 | most |
| --- | ---: | ---: | ---: |
| as the sound knows the world | 4.33 m | 7.03 | 13.61 |
| as the world actually is | 4.33 m | 7.21 | 13.61 |

It does not move. The giants and the houses already own every deep line in the world; the slim
boles add breadth, not depth. **`OCCLUSION_FULL_M = 6` is right for the real world and not only
for the world the sound could see** — which is the one result here that would have been worth
having even if everything else had come out zero.

(The first version of this table read 5.39 → 4.40 m and said the wood got *shallower*, which is
impossible. It counted only the standing points with any wood on them, and adding occluders adds
points with a little — so the population changed under the comparison. Fixed by keeping every
point, zeros included.)

## Why it cannot be plugged in

`slimTrunks` is built from the trees the world **draws**, not the trees it places. At `quality=low`
it is 104 boles; at `quality=high` it is 121, and the low list is a strict subset. The seventeen
that come and go sit 20.9 to 59.3 m out, median 45 — the far ring, which is what LOD culls first.

Far enough not to matter? Almost, and *almost* is the problem:

```
  bearings whose wood would depend on the setting: 1.50 %
  when it does: median −0.27 dB, most −0.65 dB
```

One bearing in sixty-seven would occlude differently depending on a graphics option. Nobody would
ever complain about it and it should still not exist: a video setting must not be audible, and
the whole reason this lane measures instead of arguing is that "too small to hear" is a claim, not
a fact.

## The price, corrected

Not one exported array — the array is there. What is actually needed is **one line in the trees
system building `slimTrunks` from the placements rather than from the drawn set**, so that the
list is a property of the world instead of a property of the renderer. The camera's collision and
the props' footprints read the same list and would both get more correct, not less, from that
change.

With that done, the audio side is two lines of plumbing (`world.ctx.shared` through `mountShell`
into `mountAudio`) and a one-line concatenation in `OCCLUDERS`. Without it, adding the trunks
trades 8.7 % of bearings gaining 0.4 dB against 1.5 % of bearings that change with a menu, and
this lane should not make that trade on its own.

Filed for whoever owns `src/world/trees/index.ts`. Nothing here is blocked on it — the sound is
not wrong today, it is only working from a smaller forest than the one on screen, and now by a
known amount.

## Gates

    npm run typecheck                                        clean
    node --test src/audio/*.test.mjs                        105 / 105

No `src/` change. The probe that dumped the list (one line in `src/main.ts` exposing
`world.ctx.shared.slimTrunks` on `window`) was **reverted before anything was committed** — `git
diff` on `src/main.ts` is empty — and the two dumps it produced are committed here instead, so
nothing needs rebuilding to re-read them.

## Named, not taken

- **A height term in `occlusionAt`.** Every source the sound occludes is treated as being at ear
  height: a bird is a bearing and a distance with no `y`, and the model is flat. That is why
  these 2.5 m boles can be counted at all. It is also why a giant bole shadows a bird sitting
  forty feet up in it, which it would not. Nobody has measured what that costs.
- **The far ring is 45 m out and the sound's reach is 28.** Everything past `PERCH_FAR_M` is
  invisible to occlusion by construction, which is correct for birds and may not be for the wind
  layers, which have no position at all.
- **`spectra.py`'s step-shape path still sums to mono**, carried.

## Reproduce

The dumps are committed, so only the last two lines need running:

```bash
# (the dump needed a one-line probe in src/main.ts, reverted; the output is committed here)
node art/audio/2026-09-26-trunks/worth.mjs --trunks art/audio/2026-09-26-trunks/slim.json \
    --against art/audio/2026-09-26-trunks/slim-low.json
```
