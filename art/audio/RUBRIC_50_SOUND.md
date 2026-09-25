# The 50-point rubric for the game's sound (lane 5, 2026-09-25)

The owner, 06:07 on the 24th: *"make sure it's like 50 rubrics for each item"*. `docs/RUBRIC_50_STRUCTURES.md`
answers that for anything built. Nothing answered it for anything heard, and this lane has spent two days
finding work by hunting rather than by scoring — which stops finding things once the obvious ones are gone.

Scored **0–4 each (200 max), with evidence for every score**: a measurement, a test, or a listenable clip.
An opinion is not evidence, and neither is a line of code that looks right — three separate faults on this
lane (the canopy term, the jump's push-off, the boots indoors) were code that read correctly and did nothing
measurable. Ships at **≥ 170 / 200 with no check below 2**; the ★ checks must be ≥ 3.

    0 = absent or broken · 1 = present but not doing what it claims · 2 = acceptable
    3 = good · 4 = nothing left to want here

Judge at the player's ear, in play, on headphones and on laptop speakers — and for anything about *noise*,
judge the **always-on** level (the 10th percentile over time), never the mean. A level cut that leaves the
floor where it was does not fix "the background sound is too buzzy", and this lane has the sheets to prove
that the first attempt at it did exactly that.

Scores live in `art/audio/<date>-rubric/README.md`, one row per check, and are re-scored whenever the head
moves enough to matter.

## A. The background bed (the owner's standing complaint)

1. ★ No constant drone: every band breathes — p90 − p10 over a long take is ≥ 10 dB in all of them.
2. ★ No hiss floor: the always-on level in 1–8 kHz is not the loudest thing about a quiet moment.
3. The bed is a swell, not a floor — below the gust knee the wind layers are silent, not faint.
4. Nothing in it is periodic: no LFO an ear can lock onto after a minute.
5. Its events (birds, leaves) are sparse and irregular, with gaps long enough to notice.
6. Birds are individuals in places, not a call generator — a kind comes from its own tree.
7. The wood answers weather: gusts bring leaves, lulls bring calls.
8. It is deterministic from a seed, so two sessions and two renders agree.

## B. Place — does somewhere sound like somewhere

9. ★ Two places a player can name sound different, and the difference is the right way round.
10. A roof over him changes the sound (level, colour, or both) and the change is measurable.
11. Indoors is not outdoors: walls take the top off and the room answers.
12. Open ground, a ravine and a bore are three different spaces, not one with three labels.
13. Space changes fade across the threshold rather than switching at a line, and the fade arrives
    where he is rather than behind him. (Amended 2026-09-25: the wording asked only about the shape
    of the fade, and the sound scored 4 on it while the crowns closed over a runner 2.8 m after he
    was under them — `art/audio/2026-09-25-lag/`. A check that a moving listener cannot fail is not
    a check.)
14. No place is silent, and no place is the loudest thing in the world without a reason standing in it.
15. The world's places span a useful range — not all within a decibel of each other.

## C. Footsteps

16. ★ The surface underfoot is the surface he is standing on, everywhere in the world.
17. ★ A step is a sequence (heel, roll, grains, toe), not one burst.
18. Every surface the designer knows is reachable somewhere, and every built place is classified.
19. Cadence matches the animation's stride — a step is heard when a boot lands.
20. Level is believable: a step does not out-punch the music, and a run is not a machine gun.
21. Walking and running differ in more than rate.
22. Stairs, bridges and hollow wood each have their own body.
23. Steps vary step to step — no two identical, and no audible loop.

## D. Contact and events

24. Landing after a drop sounds, and scales with the fall.
25. Leaving the ground sounds — a shove, not silence.
26. The space a contact happens in is in the contact (a boot in a room, a boot in the open).
27. Water, doors, ladders, pickups: anything a player touches that makes no sound is named here.
28. Nothing fires twice for one event, and nothing is missed at any frame rate.

## E. Music

29. ★ The tune has a shape: phrases, dynamics, and an end.
30. ★ It stops. Rests are long enough for the forest to be heard in them.
31. Nothing in it is a held tone that never stops.
32. It does not fight the bed: the two occupy different places in the spectrum or in time.
33. A dropped-in music file is levelled to the mix, not to its own mastering.
34. It is stable under load — no shaking, no drift, no pitch wobble.

## F. Mix and level

35. ★ The finished mix sits in the normal loudness band (−26 to −18 LUFS), not ten under it.
36. ★ Nothing clips, and the true peak leaves headroom for the loudest thing the game can do.
37. The loudest transient in the game is controlled without ducking anything else.
38. Stems balance: each is audible when it should be and out of the way when it should not.
39. Levels hold over a long session — no creep, no build-up of voices.
40. The mix is the same on a second machine: no dependence on the device's sample rate.

## G. Space and direction

41. ★ The world turns under the listener: a bearing is a place, not a channel — **including while a
    sound is already playing.** (Amended 2026-09-25: the check was scored 4 on two guards that each
    hold the facing still for a whole run, and under them every bird in the wood was panned to the
    facing of up to four seconds earlier — `art/audio/2026-09-25-turning/`. Turning at sixty degrees
    a second moved a call exactly as much as standing still did, which is not at all.)
42. Distance is audible — near and far sources are told apart by more than level.
43. The stereo field is used but never collapses to one side.
44. Reflection belongs to the space, not to every sound equally.
45. Anything the player can walk behind or inside changes what he hears of what is beyond it.

## H. Runtime

46. ★ Sound starts when the game does and needs no second chance.
47. It survives a long session: no leak, no rising floor, no climbing voice count.
48. It behaves when the tab is hidden, the context is suspended, or the device changes.
49. It costs what it should: the audio thread is not near its deadline under the worst case.
50. Every claim in this lane's reports is reproducible from a script in `art/audio/`.
