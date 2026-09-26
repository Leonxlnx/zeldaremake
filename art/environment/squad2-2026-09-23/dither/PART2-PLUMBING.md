# The rung band's plumbing half, also inert — and the constraint it uncovered

#181 landed the decision half (`lodSlots`, flag off, byte-identical frames). This adds the plumbing:
`fillFamily` writes each instance's screen-door weight, still only while `TREE_LOD_DITHER` is on. The
shader discard that reads it is the one piece left, and reading the code for this step turned up a
constraint that has to shape it.

## The constraint: the white-barks' high rung shares its geometry with the shadow proxy

Round 53's shadow proxy is built as `new InstancedMesh(w.lods[1].geometry, shadowOnlyMaterial, n)` — the
**medium rung's** geometry, so the high bucket's out-of-view casters can throw a cheap shadow. An
instanced attribute lives on the geometry, and the proxy fills the same buffers in its own instance
order, so a weight written for the colour pass is meaningless there.

Consequence for the remaining step: **the discard must be colour-pass only.** The depth pass keeps the
outgoing rung's silhouette for the 2.5 m a tree spends in the band, which is the right trade anyway —
a shadow that dithers is far more noticeable than one that lags two paces — but it has to be a
deliberate choice rather than something discovered after the pattern starts flickering in a shadow map.

## What landed

* `fadeAttribute(mesh)` — lazily attaches `aLodFade` (one float per instance slot, `DynamicDrawUsage`,
  filled with 1) to a rung's geometry, reusing it if present.
* `fillFamily` writes `w.lodWeights` into it in the colour pass's instance order, defaulting to 1 for a
  tree with no recorded weight, all inside `if (TREE_LOD_DITHER)`.

Three more tests (nine in the file now) pin exactly that: the write is behind the flag, an unrecorded
tree draws whole, the buffer covers every instance slot, the attribute is marked dynamic, and the
shared-geometry note stays where the attribute is made.

## Still open, still needs the yes from `PROPOSAL.md`

The discard itself: a `gl_FragCoord` hash against `aLodFade`, injected where `injectWind` already
extends the white-bark and column programs, behind the same flag so the program is unchanged when off.
Then the four checks — the five fixed frames, a walk strip for pattern crawl, the budget at the six
views and both look-backs with a pose parked mid-band, and whether the fade reads in motion at all.

With the flag off, this commit and the last are byte-for-byte the shipped world; #181 measured that at
two poses (0 % of pixels), and nothing here runs when the flag is false.
