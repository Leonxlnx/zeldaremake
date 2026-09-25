# Lane 5 — is there anything in this world you could stand behind? Yes, and the payoff is the birds

Branch `agent/squad5-occlusion`, off the integration head at `7468bb38`. One four-line `src/`
change, and the study that decides what the next one should be.

Check 45 of `art/audio/RUBRIC_50_SOUND.md` scores **0**: nothing occludes anything, every source in
the bed is distance-only. Walk behind the west house from its lanterns and the flames are exactly as
loud as they were. This is the study that comes before building it, and it is here because the
design I started with was wrong twice and the arithmetic caught it both times.

## Why a study and not a build

An obstacle only casts an acoustic shadow when it spans several wavelengths of what is behind it.
For an obstacle `w` metres wide on the line and a source at `f` Hz, the Fresnel number

```
N = 2w / λ,    λ = 343 / f
```

decides it: below about 1 the sound bends round as if the obstacle were not there, and at 10 or more
there is a real shadow. So "is there a tree" is the wrong question. "Is there a tree wide enough for
what is behind it" is the right one, and it is cheap arithmetic against the world's real geometry.

**The first design was to occlude the pod lanterns**, which seemed obvious — flames at known world
positions with big trunks beside them. The flame chain is lowpassed at 320 Hz with a 132 Hz husk
under it. At 320 Hz the wavelength is 1.07 m, and a giant bole's chord is about 3 m. That is N ≈ 5.8:
partial, not a shadow. At the husk's 132 Hz it is N = 2.4, near enough to nothing. Building it and
measuring it would have produced an after that looked like its before.

**The second thought was to drop the whole idea**, on the grounds that the bed's loud content is
diffuse wind and leaves with no position to occlude, the flame is too low, and the birds sit up in
the crowns where a bole would not reach them. That was also wrong, and lazily so — the boles are 21
to 28 m tall. A bird eight metres up heard from twenty metres away puts the line at about five
metres where it crosses the bole, which is a quarter of the way up it. The boles reach.

## What the world actually offers

`shadow.mjs` takes the pod lanterns from the scene and the solid things from the layout — thirteen
giant boles of 1.1–2.2 m radius, and the three huts — and for each flame finds the widest obstacle a
player could put between himself and it, standing two metres past it.

```
62 pod lanterns in the world
35 of them (56 %) have something solid within 14 m a player could stand behind

   grove-stilt          10 pods        stair-bank-giant      3
   plateau-oak           8 pods        lantern-tree          2
   west-house            5 pods        north-east            2
   plaza-south           2 pods        grove-hut             2
   southwest-giant       1 pod

wood on the line:   min 2.20   median 3.10   max 6.80 m
```

Nine distinct occluders come up across the village, the plateau and the grove. This is not one
contrived spot; it is more than half the flames in the game.

## And what that width does, source by source

Through the **median 3.10 m** of wood:

| source | its top | N | |
| --- | ---: | ---: | --- |
| the flame's husk | 132 Hz | 2.4 | slight |
| the flame's body | 320 Hz | 5.8 | partial |
| a distant bird | 1800 Hz | **32.5** | a real shadow |
| a fairy glint | 4000 Hz | **72.3** | a real shadow |
| a near bird | 7000 Hz | **126.5** | a real shadow |

The flame is the worst candidate in the bed and the one I would have built first. The **birds are
the best by a factor of five to twenty** — they are the highest-frequency positioned thing in the
world, they already sit on world-anchored perches with a bearing and a distance, and they are what a
player locates the wood by. Fairy glints are as shadowable but only audible within about 4.3 m,
where you are rarely behind a bole from one.

The flame is still worth having behind the **west house** specifically: 6.80 m of wall and interior
gives N = 12.7, a real shadow, and five pods sit where that applies.

## So the build, when it comes

Occlude the birds first, the flame second, and leave the wind and the leaves alone — they are
diffuse and have no position to shadow. A bole between you and a bird should take the top off it
and drop its level; the Fresnel numbers above say by how much, and they say it will be heard.

Not done here because it is a real change to how a call is built and deserves its own before and
after, its own guards and its own clips, rather than being bolted onto a study.

## The one `src/` change

`stats()` gained `podSpots`, the flames' world positions, exactly as `fairySpots` already existed.
Four lines. A harness cannot ask "is there anything here you could stand behind" without knowing
where the sources are, and `pods` was only ever a count.

## Reproduce

```bash
npm run build
node art/audio/2026-09-25-occlusion/shadow.mjs --dist dist
```

(It uses the `?test=1` play path rather than `?capture=1`, because the capture harness mounts no
audio at all and `stats()` is null there. `podSpots` reads the scene and needs no gesture.)

**191 / 191 tests**, typecheck clean, build green. Nothing outside `src/audio/` and `art/audio/`.
