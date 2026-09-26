# The rung band's decision half, landed inert: which rungs a tree takes, and with what weight

`PROPOSAL.md` asked for a yes or no on fading the LOD rung swap (1.85 % of the owner's north frame
changes in one step today). No answer yet, so this lands the half that can be made **provably inert** —
the rule that decides which rungs a tree belongs to — with the flag off, unit tests, and a render pair
showing the shipped build does not move by a pixel. The drawing half (a per-instance weight and a
screen-door discard) stays unwritten until the answer comes.

## What landed

`src/world/trees/lodFade.ts` — one function and two constants:

* `TREE_LOD_DITHER = false`;
* `TREE_LOD_DITHER_BAND_M = 2.5` — a couple of walking paces, which is the ceiling hero A's 30 K of
  headroom allows (a tree in the band draws twice, ~11 K triangles for a medium white-bark);
* `lodSlots(d, gates, band, dither)` → the rungs a tree at `d` belongs to and the weight of each. With
  the flag off it returns exactly the old answer: one rung, weight 1. With it on, a tree within half a
  band of a gate takes both adjacent rungs, weighted so the pair crosses over **on** the gate.

`bucketFamily` in `trees/index.ts` now asks that function instead of inlining the comparison chain, and
carries a `lodWeights` map that is only written while the flag is on.

## Why it is safe to merge with the flag off

Six unit tests in `lodFade.test.mjs`, run with no browser:

* the flag ships off;
* with the flag off, **every** distance from −5 m to 80 m in quarter-metre steps returns one rung at
  weight 1, and the rung matches the old rule — so a build with the flag off cannot differ;
* with it on, the weights sum to 1 at every distance in tenth-metre steps (a sum under 1 would thin the
  tree into the background mid-swap; over 1 would draw it twice at full strength);
* the crossover is exactly 0.5/0.5 at each gate, favours the nearer rung inside it, and a tenth of a
  metre outside the band it is a single rung again;
* a tree the camera stands inside takes the nearest rung;
* a zero band is the hard cut even with the flag on.

And the shipped frames, rendered on the same head with and without this commit (`broll --settle 8`,
matched shots order):

| frame | pixels moved > 4 | mean | local detail | SSIM vs reference |
| --- | --- | --- | --- | --- |
| D_log | **0 %** | 90.6 → 90.6 | 4.14 → 4.14 | 0.4037 → 0.4037 |
| owner-0650-north | **0 %** | 80.6 → 80.6 | 4.29 → 4.29 | — |

Zero, not "small".

## What is left, and it still needs the yes

1. `fillFamily` writes the weight as an instanced attribute on the rung meshes it fills.
2. The tree card and wood programs discard fragments against a `gl_FragCoord` hash and that weight.
3. The four checks in `PROPOSAL.md`: the five fixed frames must not move, the pattern must not crawl
   along a walk, the budget must hold at the six views and the two look-backs with a pose parked
   mid-band, and the fade has to read in motion — if it does not, the right answer is to drop it and
   leave the rung pop at 1.85 %.

Merging this first means the risky half is one flag flip away from being testable, and until it is
flipped the world is byte-for-byte what it is today.
