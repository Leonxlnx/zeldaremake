# A defect hunt at three unrendered player-height poses: two clean, one was my own bad pose

Integration has been quiet since 03:54, so rather than add evidence nobody can merge this hour went
looking for something still broken. Three places a player stands that no lane had rendered, at eye
height, head `2b15f687`. **No lane-2 defect at the two valid poses.**

## The two that read

| pose | band mean | across-column sd | what is in it |
| --- | --- | --- | --- |
| the bridge deck (3.9, 2.6, 37) looking north at the village | 77.9 | **30.12** | three giant boles with root flares and moss, a lit lantern pair, the paved path, the rope rail, mid-distance trees in haze, flower drifts |
| Saria's door (8.2, 1.75, −6.8) looking west | 112.1 | **27.33** | giant boles with ivy, the rope railing, the middle distance layered in haze, ferns, a bucket, a signpost |

Both middle distances are populated — across-column sd 27–30 against the sub-10 that a haze wash reads —
and neither shows a flat card, a hole in the canopy, or a tone break. Nothing here for this lane to fix.

## The third was mine, and the signature is worth knowing

`west-deck-east` came back **almost entirely black** with one lit patch in a corner: band mean 31.9,
within-column sd 4.95. That is not a world defect — it is the camera **inside geometry**. I placed it at
an absolute `y = 7.2` on the west-house deck, and the deck is a built platform: the walk surface sits at
its own height (`ctx.shared.walkSurfaces[0].disc.y`, which is what `playtest.mjs`'s `west-house` spot
uses), so a guessed absolute eye height put the camera inside the house.

Two things to carry from it:

* **pose a platform from its walk surface**, never from a guessed absolute height — `lookSpots()` in
  `playtest.mjs` gives `[x, z]` and lets the harness resolve the height for exactly this reason;
* **a black frame with a bright corner means "inside a mesh"**, not "the world is dark". Worth recognising
  before spending a measurement pass on it, which is what I nearly did — the band reading (mean 31.9,
  within-column sd 4.95, i.e. no structure at all) is the tell, because even a night-dark forest carries
  sd in the teens.
