# The band works end to end. At the shipping width it moves D_log 2.33 % and −0.0034 from the reference

The blocker in `PART3` is fixed and the feature runs. It also fails the first of the four checks in
`PROPOSAL.md`, and the way it fails needs a decision rather than more code, so here are the numbers.

## The fix

`aLodDrop` is now attached in `familyMeshes`, with the mesh, and carries its own no-op `onUpload`. That
replaces the callback `releaseAfterUpload` would otherwise leave on it (every tree attribute is told to
free its CPU array once three uploads it), which is what nulled the array and threw
`Cannot set properties of null` last iteration. `fillFamily` writes into it only when it exists and still
has an array; a geometry without one simply has nothing to write.

With the flag on, the world boots and renders with no errors and nothing missing — the white-bark roots
that share `mats.whiteTree` draw whole, which is what the drop encoding was for.

## It really does mask

Same build, flag off vs flag on, `broll --settle 8`, matched shots order:

| band | pose | pixels moved > 4 | SSIM vs reference |
| --- | --- | --- | --- |
| 12 m (diagnostic) | owner-0650-north | 3.061 % | — |
| 12 m (diagnostic) | **D_log** | 5.650 % | 0.4013 → 0.3998 (**−0.0015**) |
| **2.5 m (shipping)** | owner-0650-north | 0.184 % | — |
| **2.5 m (shipping)** | **D_log** | **2.332 %** | 0.4013 → **0.3979** (**−0.0034**) |

So the plumbing, the attribute and the mask are all alive. Note the narrower band moves D_log *further*
from the reference than the wide one: a 2.5 m band puts a strong drop (up to 0.5) on the one or two trees
crossing it, where 12 m spreads a light drop over many.

## Why that is a decision and not a bug

`D_log` is one of the owner's sealed frames, and −0.0034 is bigger than the −0.0028 that sent lane 7's
cast-variety change back for a second pass. A tree stands inside a band at that camera, so it is drawn
half-stippled in a frame that is supposed to be fixed.

The obvious dodge — suppress the dither under capture — does not work cleanly here: `isHeadlessCapture()`
is `capture=1` **or** `navigator.webdriver`, so it is true for `playtest.mjs` as well as for `broll.mjs`.
Gating on it would leave the feature invisible to every harness in the repo except a webdriver-spoofed
page (the trick `pool-check.mjs` uses), i.e. a change nobody could regression-test.

Three ways forward, and the choice is not mine to make:

1. **Accept the drift.** The rung pop costs 1.85 % of a walking frame in one step; D_log gives up 0.0034
   of SSIM. If the owner's priority is the walk, this is the trade, and it wants his word because the six
   frames have been treated as a contract all week.
2. **Gate it to non-capture runs** and accept that only a spoofed page can see it — verifiable by hand,
   not by the gauntlet.
3. **Drop it.** The band's code stays inert behind the flag, the pop stays at 1.85 %, and the lane's
   remaining defect stays documented rather than fixed.

## State of the shipped build

`TREE_LOD_DITHER` is false and the band is 2.5 m. Flag off, nothing in this chain runs: the mask is not
compiled, the attribute is not attached, `lodSlots` returns the old single rung. #181 measured two poses
byte-identical for exactly this configuration.
