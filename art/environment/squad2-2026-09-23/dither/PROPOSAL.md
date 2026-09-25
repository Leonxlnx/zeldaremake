# Proposal: dither the tree LOD swap, so a rung change is a fade instead of a cut

**This is a design note, not a change.** It is the last measured defect left in lane 2, it costs
triangles to fix, and the risk lands on the owner's frames, so it should be said yes or no to before
two iterations go into it. Everything below is measured; the numbers come from `../lodcheck/` and
today's budget work.

## The defect, measured

A white-bark or column crosses a rung gate as a **hard cut**: one frame it is the high crown, the next
it is the medium. Against every tree forced high (`?treelod=10`), the shipped rungs differ by

| pose | pixels that differ |
| --- | --- |
| `owner-0650-north` | 1.85 % |
| `owner-0650-west` | 1.92 % |

and `../lodcheck/` attributes essentially all of it to the high→medium rung. That share of the frame
changes in a single step while a player walks toward a tree. It is what the owner's standing sentence
("make all the trees load in ASAP so it doesn't look bad") is about at the rung, and it is the one
visible thing in this lane that measurement has not been able to argue away.

The rung distances themselves are already tuned as far as the budget allows: `TREE_LOD_NEAR_M` sits at
32 m and `DISTANT_NEAR_M` at 45 m because the pop falls with a later rung and hero A has **30 K of
triangle headroom** (`../sweep/`). Moving them further is not available.

## What a dither would do

Over a transition band around each gate (say 2.5 m), draw the tree in **both** rungs with complementary
screen-door masks: a hash of `gl_FragCoord` discarding a fraction of fragments, the fraction driven by a
per-instance blend factor. Across the band the outgoing rung thins out and the incoming one fills in, so
the step becomes a fade of a couple of walking paces. No alpha blending, so no sort order and no depth
trouble — foliage here is already alpha-**tested**, which is exactly the case screen-door suits.

## What it costs

* A tree inside the band is drawn **twice** (both rungs) while it is there. At the owner's poses, 3–6
  trees sit within 2.5 m of a gate, and a medium white-bark is ~11 K triangles, so the worst case is
  **+30…60 K triangles** in the transition. Hero A's headroom is 30 K, so the band cannot be wide and
  the gate band must be measured at the fixed cameras, not assumed.
* One extra instanced attribute on the white-bark and column rungs (a float per instance), written in
  `bucketWhite` where the buckets are already rebuilt on a 1.5 m camera move.
* A fragment `discard` in the tree card and wood programs — the programs already carry a cutout path,
  so the added cost is a hash and a compare.
* A flag (`TREE_LOD_DITHER = false`) to switch the whole thing off, as fable-4 did for the near-canopy
  batch, so it can ship dark.

## What could go wrong, and how it gets checked

1. **The fixed frames must not move outside a band.** A tree standing inside a band at a fixed camera
   would be half-dithered in that frame, which is a look change in a sealed shot. Check: `sixcheck.mjs`
   on all five distinct frames; if any moves, the band has to be nudged so no hero-visible tree sits in
   one, or the dither has to be suppressed under capture.
2. **The pattern can crawl.** A screen-space hash makes the thinning slide over the tree as the camera
   moves. Check: a frame strip along the walk at 10 fps, looking for a pattern that swims rather than a
   tree that fills in.
3. **The budget.** Check: `pose-counts.mjs` at the six views plus the two look-backs, with a walk pose
   parked deliberately mid-band.
4. **It may not read.** 1.85 % of pixels is a small number; if the fade is invisible in motion the
   change is cost for nothing and should be dropped. Check: the same walk strip before and after, and a
   frame-to-frame difference across the gate crossing — the hard cut shows as one large spike, a working
   dither as several small ones.

## Why it is being asked rather than done

It is the only remaining lane-2 item that needs new geometry cost, and the cost lands where the budget
is tightest (hero A, 30 K). The four checks above are ~40 minutes of rendering each pass, so getting the
band wrong twice is most of a night. If the answer is yes I will build it behind the flag and report the
four checks; if the answer is no, the rung pop stays at 1.85 % and this lane has nothing else pending.
