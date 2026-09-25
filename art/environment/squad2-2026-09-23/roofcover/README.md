# squad2 — the roof's per-area coverage, tested

Three times on 2026-09-24 this lane found the canopy simply stopping — over the open north, over the south
exit, over the north grove's shelf — and closed each with a band and a grid rectangle. `roof.test.mjs`
asserted `stand.clumps > 40`, one aggregate that the north stand satisfies on its own, so **deleting the
south or the grove grid would not have failed a test**. This adds the per-area assertions, no production
code.

## What the bands actually build (the flat test world)

| band (x, z) | grid | nearest fixed camera | clumps over its own rectangle |
| --- | --- | --- | --- |
| north flank west (−34…−12, −82…−64) | north | 70 m | 28 |
| north flank east (12…34, −82…−64) | north | 69 m | 31 |
| back stand (−12…12, −90…−81) | north | 78 m | 16 |
| rows (−34…48, −61…−55) | north | 51 m | 32 |
| south bank (−16…26, 41…54) | south | 39 m | 29 |
| south mouth (−6…16, 54…62) | south | 50 m | 11 |
| grove shelf (−16…14, −112…−94) | grove | 95 m | 43 |
| **the ravine (−16…26, 28…41)** | south | **26 m** | **2** |

So the assertions are two:

- **every band lies inside one of the grids**, its own rectangle and not with the feather as slack. The
  slack version passed for the grove band by matching the *north* grid 40 m away, which would have held
  with the grove grid deleted — the exact mistake the test is for.
- **every band carries clumps over itself**, with the floor at 8 for a band beyond the stand pass's hero
  drop and 1 for one inside it. A band nearer than `HERO_DROP_STAND_M` keeps only the clumps that land in a
  frame's top band (`HERO_TOP_KEEP`), and the ravine band over the gorge is that case: 26 m from the
  nearest fixed camera, 2 clumps here. In the real terrain it moved the log-mouth look-up's top third by
  5 levels; in this flat world it is nearly all dropped. Zero, either way, means its grid or its support
  has gone.

## It catches what it is for

Deleting a grid and running the test:

```
grove grid removed -> FAILS: band (-16…14, -112…-94) lies inside one of the stand pass's grids
south grid removed -> FAILS: band (-16…26, 41…54) lies inside one of the stand pass's grids
restored           -> passes
```

The rest of the file — determinism, the plaza sectors being byte-identical with the stand pass on, the
minimum height above ground, the hero-frame projection with its kept top band, the shaft columns — is
untouched and still passes.
