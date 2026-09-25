# Lane 5 — the sound scored against fifty checks: 173 / 200, and it does not ship

Branch `agent/squad5-rubric`, off the integration head at `5f8a6738`. **No `src/` change.**

The owner asked for "50 rubrics for each item" on the 24th. `docs/RUBRIC_50_STRUCTURES.md` answered
that for anything built; nothing answered it for anything heard. This lane has spent two days
finding work by hunting, and hunting stops working once the obvious faults are gone — the last three
iterations each went looking for a defect and found the thing already correct. A rubric turns that
into scoring, and scoring produces a ranked list instead of a guess.

The rubric is `art/audio/RUBRIC_50_SOUND.md` (kept in this lane's folder rather than `docs/` to stay
in lane; move it if the squad would rather it sat beside the structures one).

## The verdict

**173 / 200 when first scored on 2026-09-25. 181 / 200 by 08:50, 182 / 200 by 17:40 the same day** (check 48 moved to 4 once suspend and resume were tested at last: `2026-09-25-suspend`).

Its own rule is *ships at ≥ 170 with no check below 2, and the ★ checks at ≥ 3*. On the first pass
it cleared the total and failed the rest — three checks below 2 and one ★ at 2. Since then #88 built
occlusion (45: 0 → 3), #91 tested the hidden tab (48: 1 → 3), and checks 9 and 15 were **re-scored
because I had judged them on the wrong axis** — level rather than colour, see `2026-09-25-places`.

Since then check 49 has moved too (the renderer was accumulating nodes; the live graph was not), and
three checks scored 3 on *trust* have been measured at last — 4, 21 and 28. Two of those turned out
to be covering real faults and the third a fault in the shipped game, so they keep their 3s on
evidence rather than gaining a point: the bed repeated every nine seconds, a run was a louder walk,
and one step in fifteen was dropped at the tick the game runs at.

Two checks have since been **amended rather than re-scored**, and they failed the same way. Check 13
asked whether a space change fades rather than switching, which the sound passed at 4 while arriving
up to four metres behind a runner (`2026-09-25-lag`). Check 41 asked whether the world turns under
the listener, which the sound passed at 4 while every bird in it was panned to the facing of four
seconds earlier (`2026-09-25-turning`). Both now also ask about a listener who is *moving* — the
first that the fade lands where he is, the second that a bearing keeps up with him while a sound is
already playing.

Worth saying plainly, twice over: fifty checks written for a listener standing still in a place
missed the two largest positional errors in the bed, and both were found by measurements nobody had
asked for. Anything on this scorecard that rests on an `at` render or a fixed-facing test is scored
against a listener who does not exist.

It now fails on **one check**: 27, nothing a player touches makes a sound. That is a real hole and
not a mis-score, and it is the only thing between the sound and the rubric's own ship rule.

| | section | score | |
| --- | --- | ---: | --- |
| A | the background bed | **30 / 32** | the owner's complaint, answered |
| B | place | 24 / 28 | was 22; ★9 and 15 re-scored on colour rather than level |
| C | footsteps | **30 / 32** | |
| D | contact and events | 15 / 20 | **#27 scores 0 — the only check still under 2** |
| E | music | **24 / 24** | |
| F | mix and level | 23 / 24 | |
| G | space and direction | 18 / 20 | was 15; #88 built occlusion |
| H | runtime | 18 / 20 | was 14; #91 tested the hidden tab, the renderer stopped accumulating, and a stopped clock now starts itself again |

## The four holes, in the order I would take them

**#27 — nothing a player touches makes a sound except the ground (0).** Doors, ladders, the grove's
hoist, pots, crates, baskets, the signposts, vegetation he walks through, and the Kokiri themselves:
all silent. The village has people in it who make no sound. This is the largest single gap in the
game's audio and it is not a bug — nobody has built it. It also needs coordinating, because what
exists to be touched is other lanes' work.

**#45 — no occlusion at all (0).** `grep occlu src/audio` returns nothing. Walk behind the west
house from a lantern and the flame is exactly as loud as it was; put a nine-metre trunk between you
and a bird and nothing happens. Everything is distance-only. This is the cheapest of the four to
make a start on, because the audio already has the pod and fairy positions and the layout knows
where the big solid things are.

**#48 — hidden tab, suspended context, device change: untested (1).** Named as untested in two of
this lane's own reports and still untested. The live tick is a `setInterval`, which a background tab
throttles to about 1 Hz while the `AudioContext` keeps running and the schedulers keep filling four
seconds ahead. Nothing is known to be wrong; nothing is known to be right either.

**#9 / #15 — everywhere sounds nearly like everywhere (★2 and 2).** From the world floor survey:
the lawn, the plaza, the grove's trail, its veranda, the forest floor and the rope bridge — six
places a player would describe completely differently — sit inside **2.5 dB** of each other
A-weighted, and the whole world spans 11.7 dB from a lantern at arm's length to the inside of a log.
The contrast that does exist is spectral rather than in level (open places carry 11 dB more 60–250
Hz; roofed places 5 dB more at 1–2 kHz), and that is real, but it is subtle where it should be
obvious. Note this is *not* the height gap the re-survey proposed and then withdrew: three metres
under one canopy should sound alike. It is that the terms themselves are gentle.

## What scored well, and why that is worth writing down

**Music, 24 / 24**, and it earned it: the tune has phrases and dynamics, it rests twenty seconds in
every fifty, nothing in it is a held tone, it is levelled rather than mastered-in, and measured under
load its own beat stands 17× over the background of its envelope spectrum whether he is standing,
walking or running.

**The bed, 30 / 32**, which is the owner's actual complaint answered: over 200 s every band swings
between 13.4 and 33 dB — there is no drone anywhere — and the always-on level in 1–8 kHz sits 20 to
45 dB under the bands below it, so a quiet moment's loudest component is not hiss.

**Footsteps, 30 / 32.** Every built standing place in the layout is classified and guarded by name.

The two points lost in each of those are the same kind: check 4 (nothing periodic) and check 21
(walking and running differ in more than rate) are *believed* rather than measured. I have not run
an envelope-modulation spectrum on the bed the way I did on the music, and the walk/run difference
was measured for level and flatness but not for spectral character.

## Also measured this iteration, and nothing to do about it

**The sound does not depend on the device's sample rate** (check 40). Every number this lane has
published comes from a 44.1 kHz offline render, and a real machine's `AudioContext` usually runs at
48 kHz — so the published numbers could have been describing a rate nobody runs. Rendering the bed
and the footsteps stem at both, same seed, 52 s:

```
band        bed 44.1k   bed 48k   shift       steps 44.1k   steps 48k   shift
20-60           -53.2     -53.5    -0.3             -48.3       -48.2    +0.1
60-250          -46.8     -46.7    +0.0             -31.6       -31.5    +0.1
250-1k          -42.8     -42.9    -0.1             -45.5       -45.5    -0.1
1-2k            -51.8     -51.8    -0.0             -58.9       -59.1    -0.2
2-4k            -51.1     -51.1    -0.0             -59.6       -60.1    -0.5
4-8k            -68.0     -67.9    +0.1             -63.4       -63.7    -0.3
8-16k           -79.1     -78.8    +0.3             -74.1       -74.2    -0.1
always-on       -59.7     -60.1    -0.3
```

Half a decibel at worst. Everything in `graph.ts` sizes its buffers from `ctx.sampleRate` and the two
places that do not — the pink filter's coefficients, which are Paul Kellet's 44.1 kHz values, and
`impulseResponse`'s 400-sample onset ramp (9.1 ms at 44.1, 8.3 at 48) — are both small enough not to
show. Worth knowing rather than assuming; it was one of the two things check 40 asks.

(This VM's headless Chrome reports 44100 Hz for a live context, so the *live* path could not be
checked at 48 kHz here. The offline comparison is the portable half of the question.)

## The scorecard

One row per check. "Evidence" is the measurement or the test the score rests on; a blank means the
score is a judgement and is marked as such.

| # | check | | evidence |
| ---: | --- | ---: | --- |
| 1 | ★ no constant drone | **4** | 200 s, every band swings 13.4–33 dB (`resurvey`) |
| 2 | ★ no hiss floor | **4** | always-on 1–8 kHz sits 20–45 dB under the bands below it (`floor.py`) |
| 3 | a swell, not a floor | **4** | `ambience.test.mjs`: below the gust knee the wind layers are silent |
| 4 | nothing periodic | 3 | measured at last, and it was not safe: the bed repeated every nine seconds (r = +0.51 at 27 s) and now does not (+0.05, no period). The envelope's own 26 s correlation is measured but explained only as a slow random walk (`2026-09-25-loop`) |
| 5 | sparse, irregular events | 3 | flutter gap capped at 2.2 s, bird gaps measured (`birdvoice`, `wind`) |
| 6 | birds are individuals | **4** | perches; `ambience.test.mjs` "a kind comes from its own tree" |
| 7 | the wood answers weather | **4** | gusts bring leaves and lulls bring calls, both tested (#56) |
| 8 | deterministic | **4** | tested; two identical renders differ only at −115 dB (`room`) |
| 9 | ★ two places differ, right way round | **3** | re-scored 2026-09-25: 78 pairs, median **4.3 dB apart in colour** once loudness is divided out, and 16 pairs inside 2.5 dB of level still differ by over 3 dB in shape (`2026-09-25-places`). The 2 was scored on level, which is the wrong axis for the question |
| 10 | a roof is measurable | 3 | +2.9 dB between gusts, reproduced at a second spot (`facing`) |
| 11 | indoors is not outdoors | **4** | −4.7 dB and the top off, plus the room answering (#70, #73) |
| 12 | three spaces, not three labels | 3 | canopy, gorge and enclosure each measured in isolation (`term.mjs`) |
| 13 | fades, not switches, **and arrives where he is** | **4** | the doorway fade monotone, no step > 0.25; the clearing's roof cut across its rim. Check amended 2026-09-25 — the old wording asked only about the fade's shape, and on it the sound scored 4 while the crowns closed over a runner 2.8 m late. On the new wording it would have been a 2; the 4 is on this branch's evidence, every journey inside 0.31 m at a run (`2026-09-25-lag`) |
| 14 | nowhere silent, nowhere loud without cause | **4** | 13 places; the loudest is a flame at arm's length (`floor.py`) |
| 15 | the world spans a useful range | **3** | colour spans 0.2 to 10.2 dB across the pairs. The real weakness is narrower than the old score said: the enclosed places are each a place, and the open outdoors is one place (`2026-09-25-places`) |
| 16 | ★ the surface is the surface | **4** | `surfaces.test.mjs` covers every built standing place by name |
| 17 | ★ a step is a sequence | **4** | `footsteps.test.mjs`: ≥ 5 parts, heel / roll / grains / toe |
| 18 | every surface reachable and classified | **4** | `surfaces.test.mjs`, both directions |
| 19 | cadence matches the animation | **4** | derived from `CLIP_SPEC` with a guard that fails if the clip is re-authored |
| 20 | believable level | 3 | steps peak −14.3 against the music's −19.1; the sfx compressor holds a run without touching the music |
| 21 | walk and run differ in more than rate | 3 | measured, and it was not: a run's centroid was 1 Hz from a walk's. Now +36 Hz (`2026-09-25-gait`). Not a 4 — the per-step instrument does not work at a running cadence |
| 22 | stairs, bridges, hollow each own a body | **4** | separate designs, each guarded |
| 23 | steps vary | **4** | 5.3 s noise loop, per-step jitter, tested |
| 24 | landing scales with the fall | **4** | `landingStrength(fallM)`, tested |
| 25 | leaving the ground sounds | **4** | #53, measured against a bed that used to swallow it |
| 26 | the space is in the contact | **4** | #73: the room send scales with enclosure on every contact |
| 27 | anything touched that is silent | **0** | doors, ladders, the grove's hoist, pots, crates, baskets, signposts, vegetation, **and the Kokiri** |
| 28 | no double-fire, no misses | 3 | frame rates now tested and a real fault fixed — one step in fifteen was being dropped at the shipping tick (`2026-09-25-tickrate`). The double-fire half still rests on `MIN_STEP_GAP` and the stance-edge test |
| 29 | ★ the tune has a shape | **4** | #49: phrases, dynamics, an end |
| 30 | ★ it stops | **4** | 20–23 s rests, 26 % of 200 s (`resurvey`) |
| 31 | no held tone | **4** | the 73–110 Hz pad removed; a test forbids its return |
| 32 | it does not fight the bed | **4** | per band: it occupies 250 Hz–2 kHz and nothing else (`resurvey`) |
| 33 | a dropped-in file is levelled | **4** | #52: gated RMS, not the file's own mastering |
| 34 | stable under load | **4** | its beat stands 17× over its envelope spectrum standing, walking or running |
| 35 | ★ in the normal loudness band | **4** | −23.0 LUFS (`balance.py`) |
| 36 | ★ no clipping, headroom left | **4** | true peak −8.5 dBFS, 0 clipped samples, worst case measured at −7.7 |
| 37 | the loudest transient controlled | **4** | the compressor is on the sfx bus alone; the music is never ducked |
| 38 | stems balance | 3 | bed 10.6 LU under the mix, steps 6.4, music 0.9; audibility checked per band |
| 39 | levels hold over a session | **4** | 13 min soak, no creep |
| 40 | same on a second machine | **4** | 44.1 vs 48 kHz, largest shift anywhere 0.5 dB (below) |
| 41 | ★ the world turns under him, **including mid-sound** | **4** | #79, and two guards that fail on a sign flip or a frozen heading. Check amended 2026-09-25 — both of those guards hold the facing still for a whole run, and under them every bird was panned to the facing of up to four seconds earlier: turning at 60°/s moved a call exactly as much as standing still, which is not at all. On the new wording it was a 2; the 4 is on the evidence of `2026-09-25-turning` (a call leaning 0.635 pan/s against the 0.629 the geometry asks) and `2026-09-25-parallax` (a call heard 0.004 pan units from its own tree's bearing while he paces past it, against 0.153 before, and 0.007 for a listener who does not move at all) |
| 42 | distance is more than level | 3 | a far bird is dulled (7 kHz → 1.8 kHz) and wetter, and since 2026-09-25 that distance is the one its tree really is at — walking twenty metres toward a bird used to change nothing at all (`2026-09-25-parallax`: 4.8 m of median error, worth 890 Hz of cutoff, now 1.9 m). **Pods and fairies are still level-only**, which is what holds this at 3 |
| 43 | the field is used, never collapses | **4** | side 3–4.6 dB under mid; `PERCH_PAN` caps at 0.85 |
| 44 | reflection belongs to the space | **4** | the wood's hall and the hut's room are separate convolvers |
| 45 | walking behind something changes it | **3** | #88: a bird behind the west house loses 9.3 dB of its own band and the level between calls does not move. Still level-only for the fairy glints and the flames |
| 46 | ★ starts when the game does | **4** | fixed; it used to be silent for its first six seconds |
| 47 | survives a long session | **4** | 13 min, voices 5–13 and ending where they started, heap flat |
| 48 | hidden tab, suspend, device change | **4** | #91: six minutes hidden with rAF stopped and four with every timer clamped to 1 Hz — no leak, no errors, audio at full speed. Suspend / resume tested 2026-09-25 and the answer was that the game never came back: the clock ran 14.98 s of a 27 s session and the recorded master held 15 s of it. The tick now asks a stopped clock back within 210 ms, which is the same answer for a device change since the page cannot tell them apart (`2026-09-25-suspend`) |
| 49 | it costs what it should | **3** | the live graph holds at 4–15 voices through the worst case (169 steps, 47 landings, 25 shoves, 62 pods, the score playing), and the renderer's node accumulation is found and fixed (`2026-09-25-cost`). `renderCapacity` is still unsupported here, so the audio thread's own load is unread |
| 50 | every claim reproducible | 3 | twelve scripts now; the first standing survey's numbers were produced by hand and are not |

## Reproduce

```bash
npm run build
# the rate check
node art/audio/2026-09-25-rubric/rate.mjs --dist dist --out /tmp/rate
python3 art/audio/2026-09-25-rubric/rate.py --takes /tmp/rate
```

The scores cite work already on the branch: `art/audio/2026-09-25-resurvey/` (the floor, the bands,
the music/bed balance), `2026-09-25-facing/` (the panning), `2026-09-24-soak/` (the session),
`2026-09-24-indoors/` and `2026-09-24-room/` (indoors), `2026-09-24-headroom/` and `-level/` (the
mix), `2026-09-24-cadence/` and `-jump/` (the boots).

**189 / 189 tests**, typecheck clean, build green. Nothing in `src/` changes on this branch, so it is
independent of #79 (the panning guards) and the two can merge in either order — #79 is cited as
evidence for check 41 but is not a dependency.
