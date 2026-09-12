# Column roots: terrain contact proposal for Fable

**Pinned proposal evidence; applied in Astra’s environment integration.** Astra prepared this
patch for Fable’s column-tree pass. The adjacent evidence retains its original proposed status;
current adoption and actual-render review are tracked in `.agents/astra-environment.md`.
It changes only `src/world/trees/column.ts` and the column construction/bucketing blocks in
`src/world/trees/index.ts`. It does not change production source merely by being present here.
No ownership transfer or visual acceptance is implied.

Base: `ddd24fd0a3a9f71eb9991e3f16311336a4316fd0` for the column/index/placement slice;
validation's other modules are pinned to Astra `a600f529d56bc3a63ee31deaf58012d6cb077647`.
The patch also typechecked in an isolated full checkout of `ddd24fd`.

Patch SHA-256: `e2a190525081ef503b93c10de105f3716f03f27ff71e4b68d1c873cb850c16a4`.
Evidence SHA-256: `7de7c08a6c3ea2225307daa62c6893ff3b3f752227683741bed3af575ace1871`.

## Problem and change

The column family calls `rootButtress` with its default flat local ground. Translating that
shared variant to one sampled origin does not seat roots on a slope. The existing ten seats
have 316 of 784 lateral root-edge samples more than 3 cm above the real terrain at each LOD;
the worst is 2.67449 m near the seat at (-3.5, -24.7).

The shared writer already accepts a local ground sampler. The patch supplies that sampler
through `createColumnTree`. In `index.ts`, the unchanged deterministic placements are finalized
first; each seat then builds its own three LOD assets using the original architecture seed.
The ground callback applies the seat's yaw and uniform scale before sampling the real world,
then converts world height back to local height. It affects the buttresses only.

- Root x/z, width, taper, bend, smooth rise, colors, topology and random draws are unchanged.
- Each root vertex retains its original rise over terrain; lateral edges keep their original
  3 cm local burial, scaled with the instance (about 2.9–3.1 cm in world space).
- Inner root rows still overlap the actual bole. The trunk, crown, leaves and their normals
  remain byte-identical; the whole tree is never draped onto the terrain.
- The current family LOD selection, shadow flags and audit counts are retained. Asset names
  append the seat coordinates to distinguish geometry that now depends on that seat.
- White-barks, giants, distant trees, lantern limb, placements and original audit are unchanged.

## Evidence

`evidence.json` records generated geometry, not estimated contacts or a rendered screenshot.
All ten seats were checked at all three LODs through their actual composed instance matrices.

| Check | Result |
| --- | --- |
| Lateral root-edge samples | 2,352; zero exposed samples after the patch |
| Full root-surface samples | 8,232; original rise retained within 0.00000183 m |
| Inner collar vertices | 1,176; each remains inside the real bole surface |
| New degenerate triangles | 0 at every seat and LOD |
| Non-root positions and normals | Exact before/after equality |
| UV, color, wind, root attributes and triangle indices | Exact before/after equality |
| White/giant/distant geometry and instance matrices | Exact hashes |
| Published lantern centreline/radii, audit and next RNG value | Exact equality |
| TypeScript | Pass on the isolated patched `ddd24fd` checkout |

There is a real cost: the five shared column variants become ten seat-specific render families.
Typed geometry buffers rise from 9,736,728 to 20,588,616 bytes (about 10.35 MiB extra).
The B camera's configured active column meshes rise from 7 to 10. Actual GPU draw calls,
frame time, shadow appearance and full-world screenshots have not been measured for this patch.
This deliberately small correction trades some sharing for correct contact; a later separate
root mesh implementation could regain sharing if the render budget requires it.

## Reproduce and integrate deliberately

Run from the repository root, with dependencies installed and both pinned commits fetched:

```sh
node docs/proposals/astra-column-contact/verify.mjs
```

The verifier uses Node, TypeScript, Three.js, Git and the standard `patch` command. It reads the
pinned sources, applies this exact patch only in a fresh temporary directory, runs the generated
geometry comparisons, and prints the temporary evidence path. It never edits production source,
Git refs, the gauntlet ledger, rubric or scores.

Fable should inspect/apply `candidate.patch` to the corresponding two files, typecheck/build,
and capture the actual world before adopting the change. Review the worst seat and the
near emergent root in gameplay as well as the saved views. This is a CPU-validated proposal,
not a claim that a visual rubric item or phase is complete.
