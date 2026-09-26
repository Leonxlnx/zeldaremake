# Lane 5 — re-scoring the rubric after five iterations, and one row that described a node that is gone

Branch `cursor/squad5-ravine-5535`, stacked on `cursor/squad5-pad-5535`
([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). **No `src/` change.**

`art/audio/RUBRIC_50_SOUND.md` is how this lane finds work — *"two days finding work by hunting
rather than by scoring, which stops finding things once the obvious ones are gone"* — and it was
last scored on 2026-09-25. Five iterations have landed since, two of which found faults in things
the rubric cited as evidence. A scorecard whose rows describe a node that no longer exists is
worse than no scorecard, because the next agent reads it and believes it.

## The verdict

**184 → 187 / 200.** Three rows move up, five are amended without moving, and the one row that
blocks the rubric's own ship rule does not move because it cannot.

Its rule is *ships at ≥ 170 with no check below 2, and the ★ checks at ≥ 3*. The total and the ★
rule both clear. **Check 27 is still 0** and is still the only thing between this rubric and its
own bar.

## Rows that move

| # | check | was | now | why |
| --- | --- | ---: | ---: | --- |
| 12 | three spaces, not three labels | 3 | **4** | the ravine is a space now and not a level. It was `GORGE_HALL` and `GORGE_WIND` on the shared wood — more of the same hall — which is what "a label" means. It has its own convolver built from the cut's geometry, 5 m to each wall and 8.8 m deep, answering at 29 ms and silent before it, and a boot in it is measured 12.8 dB under itself against a physics prediction of 12.6 (`2026-09-26-ravine`). Open ground, a hut and a ravine are now three impulses, not one with three sends. |
| 20 | believable level | 3 | **4** | the check names two failure modes and both are measured absent. *A step does not out-punch the music*: at a run the step rate sits **2.9 dB under** the music's beat in the mix's envelope, where it stood 7.6 dB over it untouched and 4.4 over it through the compressor (`2026-09-26-release`, `-limiter`, `-pad`). *A run is not a machine gun*: it peaks **+3.83 dB over a walk**, against +1.55 while the compressor was flattening them (`2026-09-26-pad`). A step still stands 26 dB over the always-on level of the bed and the music. |
| 45 | walking behind something changes it | 3 | **4** | the row's own open sentence was *"still level-only for the fairy glints and the flames"*, and all of it is now answered. The flames are shadowed, **−4.4 dB behind the west house and 0.0 dB in the open** (`2026-09-26-shadow2`). The glints are a **measured null** — of the 196 places in this world where a glint sounds at all, the shadowed share is 0.000 at every one, and it stays 0.000 with the world's occluder list corrected. And the list itself was wrong: the two Kokiri tree-houses were not in it, which was 23 % of the shadowed bearings in the world (`2026-09-26-houses`), now fixed and guarded. |

## Rows amended, and not moved

These keep their scores. Their evidence lines described things that have since changed, which is
the part that needed fixing.

- **37** (the loudest transient controlled, **4**) said *"the compressor is on the sfx bus alone;
  the music is never ducked"*. **There is no compressor.** Four measurements retired it: every
  step was in full four-to-one, its release was worth 0.4 dB across a factor of sixteen, it cost
  2.4 dB of the difference between a walk and a run, and a plain gain does the same job
  (`2026-09-26-pad`). The score stands — the transient is still controlled and the music is still
  never touched — but by a 7 dB pad, not a node with a time constant.
- **21** (walk and run differ, **4**) ended *"the level cue is only +1.7 dB of a designed 4.31,
  because the sfx compressor squashes every step 4:1 — recorded there as the next thing"*. That
  next thing is done: **+3.83 dB**, and the compressor is what was removed to get it.
- **44** (reflection belongs to the space, **4**) said *"the wood's hall and the hut's room are
  separate convolvers"*. There are three now, and the bird calls use the third
  (`2026-09-26-calls`) at 7.9 dB under a call against a boot's 12.8 — the right order, because a
  distant source's reflection travels almost as far as its direct sound and a boot's travels six
  times as far.
- **8** (deterministic, **4**) said *"two identical renders differ only at −115 dB"*. Re-measured
  twice since at **−108** relative (`2026-09-26-release`, and again in `-ravine`). Same
  conclusion, and it is the floor every "did anything happen" measurement on this lane is read
  against, so the number matters.
- **9** and **15** (two places differ / the world spans a useful range, **3** each) are limited by
  the world and not by the sound, which is new and is the answer to the standing item *"the plaza
  opening up against the closed canopy"*. A term for how much of the horizon is solid was written
  and computed at all thirteen surveyed places: **the plaza's nearest solid neighbour is a bole
  10.1 m away, no closer than the lawn's 10.5 and further than the lookout's 6.1**
  (`2026-09-26-houses`). The open places are alike because nothing stands near any of them. These
  stay at 3, and they should not be worked as sound items until the village has something in it.

## Check 27, which is the only thing left below 2

*"Water, doors, ladders, pickups: anything a player touches that makes no sound is named here."*
Scored **0**, and it has been re-checked rather than assumed: the game has no interaction system,
and the one candidate inside this lane's reach — the Kokiri themselves — cannot be found, because
`npc.ts` names the fairies (`navi`, `kokiri-fairy-N`, which the audio does gather and sound) and
does not name the children. There is nothing for `gatherX` to match on.

**This is not a sound item and it should stop being scored as one.** It needs either an
interaction system or a named object in the scene graph, both of which belong to other lanes. Left
at 0 with the reason, rather than quietly excluded.

## What the scoring says to do next

The twelve rows at 3 are the work list, and after this pass they sort into three kinds.

**Blocked on other lanes** — 9, 15 (the world has nothing around its open places), 27, and 49
(`renderCapacity` is unsupported in this browser, so the audio thread's own load is unread).

**Bookkeeping, cheap, low value** — 50 (the first standing survey's numbers were produced by hand
and are not reproducible from a script), 38 (stems balance, which has not been re-measured since
the steps came down 4 dB and the compressor came out — its numbers are certainly stale even if
its score is not).

**Real, open, and this lane's** — 4 (the envelope's 26 s correlation is explained only as "what a
slow random walk does", which is an assertion and could be a calculation), 5 (sparse events), 10
(a roof is worth +2.9 dB, which is the smallest of the place terms), 28 (the double-fire half of
"no double-fire, no misses" rests on `MIN_STEP_GAP` and has never been driven at a frame rate that
would break it).

**38 is the one I would take next.** Every number in it predates two changes to the mix's own
staging, and "stems balance" is the row closest to the owner's standing complaint.

> **Taken, 2026-09-26 — `art/audio/2026-09-26-balance/`.** Re-measured against the integration
> head on the same box: the music is untouched to the decimal, the mix is unchanged at −24.3 LUFS
> with 0 clipped samples, and the steps are 2.8 LU quieter as intended. **Check 38 stays at 3**
> and its figures on `balance.py`'s own walk are 8.4 / 14.4 / 0.3 LU under the mix. The pass also
> turned up something none of the six iterations aimed at: **the bed's always-on level fell 2.7 to
> 4.7 dB across every band**, which is the metric the owner's complaint lives in.

## Green

No `src/` change. `npm run typecheck`, `npm run build`, **252 / 252** tests, and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

## Reproduce

The scores above cite the folder that measured each one. The one number re-measured for this pass
is the shadowed share with the world's occluder list corrected:

```bash
node art/audio/2026-09-26-shadow2/audible.mjs --dist dist --out /tmp/shadow3
```

```
source    places it sounds  the most shadowed   top 1%   top 10%   median  over a quarter
flame                12638              1.000    0.766     0.365    0.118     2362 places
glint                  196              0.000    0.000     0.000    0.000        0 places
```

Against the same survey before the houses were added — most shadowed 0.974, top 1 % 0.587, median
0.037, **893** places over a quarter. The houses **more than doubled the places in this world
where a lantern is materially behind something**, 893 to 2362, and tripled the median. The glint
is 0.000 either way, which is the null holding under a world with more in it than it had.
