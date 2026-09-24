# Lane 5 — the score rests, so the forest can be heard

Branch `agent/squad5-music-rests`, off `81430baf`. A draft PR cannot be opened from this agent (its
token is not a collaborator on the repository), so this file is the report.

## Why

Nothing new from the owner about sound since 20:08, so this is the next item on the lane's standing
list — and it is one my own last change created. Once the wind bed became a gust-gated swell
(`71e3b247`), the forest measured **15–16 dB under the music** and the music never stopped: the
placeholder loop ran back to back for ever at one level, playing **100 % of a 120 s render with a
longest gap of 0.1 s**. So between gusts, the wood the owner is walking around in could not be heard
at all under a 50 s tune on repeat. That is also the most tiring thing in a world you are asked to
walk around for a long time.

The demo's own forest does not work that way: the theme comes and goes over the wind and the birds.

## What changed

**The placeholder rests.** After each pass it stops for a seeded 16–30 s and lets the wood be heard;
the pad and the last note ring out into the rest, so the piece ends rather than being cut off. Over
a long session the tune plays about 69 % of the time.

**Passes vary.** The first is always the full arrangement; after that about 45 % drop the pad and
half the harp and take the lead down, so the loop does not return identical every time.

**−3.2 dB on the placeholder bus.** The forest sat 15–16 dB under it; now 13.6 dB, and during a rest
it is the only thing playing.

**The wood is never left with nothing in it for more than 2.2 s** (`QUIET_GAP_MAX`). With the bed
gated below the gust knee *and* the tune resting, the mix fell to −72 dBFS for five seconds at a
stretch — which reads as the audio having broken rather than as a quiet forest. The answer is a leaf
turning over, not a floor put back under everything: the leaf-flutter scheduler's gap is capped, so
in dead calm something still happens every couple of seconds. The mix's longest hole went 5.3 s →
4.2 s (cap 3.2) → **3.1 s** (cap 2.2), and the bed's own deepest lull from 3.8 s to 2.4 s.

## Result

120 s of the same walk, the merged head against this branch:

| | before | after |
| --- | ---: | ---: |
| the tune plays | 99 % of the time | **82 %** (≈ 69 % over a long session) |
| its longest rest | 0.8 s | **19.4 s** |
| the whole mix plays | 100 % | 96 % |
| the mix breathes | 6.4 dB | **17.5 dB** |
| mix RMS | −32.8 | −37.9 |
| the forest under the tune while it plays | 16.2 dB | 13.6 dB |
| the mix during a rest | — | −48 dBFS, and it is the forest |

`mix-rests.jpg` is the picture: before is a flat block for two solid minutes, after is a pass, a
rest with the wood alone in it, then the next pass voiced down. `music-rests.jpg` is the same for
the music stem alone. `clips/` has 40 s across the rest to listen to.

The bed's own lulls over 120 s: below −65 dBFS, 30 of them, longest 2.4 s, 11 s in total — the
forest goes still between gusts and then a leaf moves.

## The fairies make a sound

Lane 7 brought the Kokiri and their fairies back and they were silent. A fairy is now a **glint**:
two or three tiny bell partials climbing over about 120 ms, every 1.4–4 s, only while she is within
about four metres, panned toward her and attenuated by distance. Events, and small ones — the
owner's standing complaint is that there is too much sound, so this is a few grains of light beside
you, never a shimmer laid over the forest.

Play-mode probe (`walk-audio.json`): standing a step and a half from the girl by the signpost,
**4 glints in 10 s**; walking the plaza past her, 2; inside the log tunnel, 0. Offline, in the
2.2–5.2 kHz band, the closing stand beside her holds **6 events in 8 s against 1 in 3 s** of the
opening stand away from any fairy, and the band's 99th percentile rises −47.5 → −44.2 dBFS.

Getting there turned up two real bugs, both now fixed and worth knowing about for anyone else
reading positions out of the scene graph:

- `createFairy` names every child from the same prefix (`-body`, `-core`, `-halo`, `-sparkle`…), so
  a `startsWith('kokiri-fairy')` match collects **fifteen objects per fairy**. The matcher is an
  exact-root regex now.
- The fairy's root **never moves**. `npc.ts` reparents her point light onto the NPC group (a light
  joining or leaving the scene changes the light count every lit program is keyed on) and writes
  `anchor + offset(t)` to *that* every frame. Reading the root gave (0, 0, 0) for all five fairies —
  which is why the first pass glinted in the middle of the plaza. Position comes from the light now,
  visibility still from the root.
- `matrixWorld` is only refreshed when the world draws, so the audio's own animation frame could
  read a matrix from whenever the context started (with the bag open, or under a harness that steps
  the simulation without rendering). The fairy read brings its own matrix up to date.

## The sky closes as you walk north

Until now the only place the space changed was inside the log tunnel: the open plaza and the roofed
north corridor sounded identical. The bed now follows how much wood is overhead, taken from the
terrain's own `forestFloorZone(x, z)` — the litter is there *because* the crowns are, so the field
that decides what is underfoot also says how closed the sky is, and `surfaceAt` already computed it.
No other system's internals are read.

Under a closed canopy the same filter the tunnel uses shuts part of the way (`CANOPY_CLOSE` 0.5 —
about 4 kHz against 18 in the open), more of the bed goes to the hall (`CANOPY_HALL`), and the
leaves overhead move more often (`CANOPY_FLUTTER`). The level is untouched: only the tunnel's wood
ducks it, because only the tunnel puts something between him and the forest.

The same 40 s with the canopy forced open and forced closed (`--stems bed-open,bed-crowns`; forcing
it is the only way to A/B this — changing the flutter rate re-phases the whole seeded event stream,
so comparing one leg of two ordinary renders measures which events happened to land there):

| band | open sky | under the crowns | |
| --- | ---: | ---: | --- |
| 8–16 kHz | −86.5 | **−99.6** | −13.1 — the crowns take the top off |
| 4–8 kHz | −72.7 | −74.0 | −1.3 |
| 2–4 kHz | −51.1 | −53.4 | −2.3 |
| 1–2 kHz | −55.2 | **−49.6** | +5.6 — leaves close above you |
| 500–1000 Hz | −50.7 | −47.0 | +3.7 |
| RMS | −46.9 | −46.5 | +0.4 — as present, differently coloured |
| breathes | 22.1 dB | 24.8 dB | +2.7 |

`canopy-open-vs-crowns.jpg` shows it: the top of the spectrogram goes dark and the middle fills with
flutter streaks.

Walking it (`walk-audio.json`), the field behaves: the plaza, the lawn, the main flight and the spot
beside the girl all read 0; the north path rises to 0.51 as he goes up it; off the path on the
forest floor it is 0.84–0.97; the log tunnel is 1 with its own enclosure on top.

## The wind has a side now

The canopy roll leans toward upwind — the air arrives from where the wind comes *from*, projected
onto the listener's right (`windLeanFor`). It is a **lean, not a pan**: `WIND_LEAN` is 0.35, so the
bed never collapses to one side, and it moves on a 1.2 s time constant, because turning your head
should move the weather rather than flick it. Only the far roll leans; the leaf hush is in the trees
all around you.

Verified as arithmetic (`footsteps.test.mjs`): facing across an easterly wind leans left, the reverse
leans right, head-on and from behind are exactly zero, a full turn traces one cycle reaching ±0.35
and never exceeding it, and a zero-length wind vector does not produce NaN.

And in play it tracks the facing across the probe's routes, which is the check that matters:

| route (facing) | lean |
| --- | ---: |
| up the main flight (340°) | **+0.15** |
| the plaza and the north path (180°) | −0.25 |
| the lawn west of the spine (200°) | −0.32 |
| beside the girl at the signpost (225°) | **−0.35** |

The harness cannot turn Link *on the spot* to sweep it in one route — `__ZR_PLAY__.place()` sets a
rest facing that the next simulated frame overrides back to the held heading — so the route that
tried to was removed rather than left in reporting a constant.

**Which way the listener faces** changed with this. It was `__ZR__.cameraPose()`, which reads the
camera's world MATRIX — refreshed only when the world draws. With the bag open, or under a harness
that steps the simulation without rendering, it hands back whichever way the camera pointed at
start-up, and every pan in the system (lanterns, fairies, now the wind) silently froze with it. In
play mode the facing now comes from `player.heading()`, a plain number the character system keeps,
which is also consistent with the listener POSITION already being Link's rather than the camera's.

## The whole mix, measured as a mix

Every change so far was A/B'd on its own. `balance.py` is new and asks the questions that only make
sense about the finished thing: gated integrated loudness (ITU-R BS.1770 style, K-weighted with the
−70 LUFS absolute and −10 LU relative gates), each stem's loudness against the mix's, true peak and
clipping, and loudness range. The merged head against this branch, 60 s of the same walk:

| | head | this branch |
| --- | ---: | ---: |
| mix | −30.3 LUFS | **−33.3 LUFS** |
| loudness range | 5.3 LU | **10.5 LU** |
| true peak | −13.6 dBFS | −14.0 dBFS, 0 samples clipped |
| the forest under the mix | 12.1 LU | **9.1 LU** |
| the footsteps under the mix | 8.5 LU | **5.5 LU** |
| the music under the mix | 0.6 LU | 0.9 LU |
| always-on 60–250 Hz | −42.1 | **−53.8** |

Twice as dynamic, better balanced, the constant low end 11.7 dB down, nothing clipping.

**One finding for the owner, not acted on.** The whole mix sits at −33.3 LUFS with 14 dB of unused
headroom; a game master is normally around −20 to −23 LUFS. Everything in the build is therefore
roughly 10–13 dB quieter than a player's volume knob expects. Raising the master is one constant
(`createBuses`, `master.gain`) and would not disturb any of the balance above — but **level is the
one axis the owner has commented on twice, most recently "LOWER THE WHITE NOISE", so this lane is
not going to raise it unasked.** If he wants it, +6 dB puts the mix at −27.3 LUFS and still leaves
the always-on 60–250 Hz band 5.7 dB below the head he was last playing.

## Tests

`src/audio/music.test.mjs` is new: the rests fall inside `REST_SECONDS`, the duty cycle lands
between 55 and 78 %, the first pass is never the voiced-down one, the voicing share is what
`QUIET_PASS_SHARE` says, the schedule is a pure function of its seed, and — since this is the file
that most invites it — the melody table is asserted to stay inside G major pentatonic with the
provenance note intact. Nothing of Nintendo's ships.

## Reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/after --seconds 120 --stems mix,music,bed
python3 art/audio/2026-09-23-lane5/spectra.py levels --before /tmp/before --after /tmp/after --stem mix --out mix-rests.jpg
node --test src/audio/footsteps.test.mjs src/audio/music.test.mjs
```

`spectra.py` gained a `levels` command (level over time on one scale — the picture for a score that
rests) and two metrics used throughout this report: `duty_pct` and `longest_quiet_s`.
