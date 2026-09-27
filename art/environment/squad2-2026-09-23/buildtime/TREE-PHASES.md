# Inside the trees' 8.3 s: the giants are two thirds of it

> **fable-cursor: this file is the PR description for `cursor/squad2-treephases-682b`.** The pull-request
> call is refused with `must be a collaborator` (twenty-eight attempts since 08:20 on the 26th), so please
> open the PR from the branch (base `cursor/kokiri-world-phase1-f65e`) or merge it directly. This branch also
> carries `gates.test.mjs` from `cursor/squad2-gatetests-682b`, so it supersedes that branch.

The lane's `buildtime/README.md` (on `cursor/squad2-consolidate-682b`) put the trees at **19.6 % of a 42.7 s
build**, behind vegetation and level with structures. It could not say *where inside* the trees that fifth
goes, because `buildMs` is per system. This adds the split and measures it.

## The change (`src/world/trees/index.ts`, timing only)

A `buildPhases` map closed at the `ctx.progress('trees', ...)` checkpoints that already existed, reported in
the trees audit. Wall clock, `await yieldFrame()` included, because that is what a player waits.

Frames are untouched, as a timing-only change must be: the owner's north pose and the sealed `D_log` are
**0 % moved** against the same build without it, SSIM 0.4013 either way. `tsc`, build and `node --test`
(255, one new pin) are green.

## The split (head `1232f1d3`, three runs, first dropped)

| phase | mean | share of the trees |
| --- | --- | --- |
| **giants** | **4,798 ms** | **63 %** |
| columns | 1,254 ms | 16 % |
| white-barks | 954 ms | 13 % |
| the distant and mid layers, the pools, the publish | 528 ms | 7 % |
| understory | 72 ms | 1 % |
| *sum of phases* | *7,605 ms* | |
| *`buildMs.trees`* | *~8,190 ms* | |

The ~580 ms between the sum and `buildMs.trees` is the setup before the first checkpoint - the materials, the
leaf-cluster and bark atlases, and the placement passes - which the progress markers do not bracket.

## What it means for the load priority

* **Twelve authored giants are 4.8 s**, i.e. **11 % of the entire world build** and two thirds of this
  system. A load pass aimed at the trees is a load pass aimed at the giants; everything else here is small
  change by comparison.
* **The distance layers - this lane's own subject - are 528 ms including the pools and the publish**, 1.2 %
  of the world build. With `../farring/RADIUS.md` (cutting 38 % of the ring saves 6 ms) that closes the far
  layers as a load target too.
* The understory at 72 ms is noise.

Where the giants' 4.8 s goes (bark relief versus limbs versus the lobes' laminae) needs the same treatment
one level down, inside `giant.ts` - not this lane's file, and it needs the per-part triangle count that
`giantwood/CORRECTION.md` already asked for. Worth doing if load becomes the binding priority.
