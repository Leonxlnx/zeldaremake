# The canopy roof was seven draws for 8 210 triangles, and culling never dropped one

*squad lane 2 — 2026-09-30 16:30 UTC — **shipped**, −6 draws at every pose, byte-identical frames*

Lane 2's list was empty. Last round's write-up asked every lane to compare its `ctx.audit` submission row
against `__ZR__.isolate('<system>')`. **The canopy roof is also this lane's**, and it had never been done — so
this round did it, and the first thing it found is that the comparison was impossible:

```ts
ctx.audit('canopyRoof', () => ({ clumps, cards, triangles: built.triangles, meshes: meshes.length, … }));
```

`built.triangles` is the roof **as built**. There was no per-frame figure and no draw count at all, so the cost
of the canopy in a frame had never been measured while the trees' had been measured to death.

## What the renderer says

`isolate('canopy')`, three poses:

| | renderer | built |
| --- | --- | --- |
| **A_stairs** | **7 calls / 8 210 triangles** | 8 210 in 7 meshes |
| **`stairs1-top`** | **7 / 8 210** | same |
| **`stairs2-top`** | **7 / 8 210** | same |

Identical everywhere: **seven meshes, seven draws, every time.** `roof.ts` says twice what the split is for —

> `sectors?: number` — *number of sector meshes the cards are split into (**frustum culling**)*
> *geometry: crossed cards per clump, split into sectors around the plaza **for culling***

— and the test never fires. A sector spans a 60° wedge of a forest-wide roof, so its bounding sphere covers
most of the world; from a camera inside it, no sphere is ever wholly outside the frustum.

**Seven draws for 8 210 triangles is 1 173 a draw** — the thinnest ratio anywhere in the frame, where the trees
average ~19 000. And draws are the scarcer resource exactly where it is tight: `lookspots/` found
`stairs1-top` running at **661 of W38's 700**, 39 spare.

## One mesh

The same vertex data concatenated into one buffer — five attributes and an index offset per part, no new
dependency. The sector **build** is untouched: the stand still writes its own writer so the plaza sectors'
geometry never changes, and `roof.ts` and its tests are not edited. Only what is handed to the renderer merges.

Paired run, one pose list, both builds launched together — the only pixel comparison this branch trusts
(`colshadow/`):

| | before (7 sector meshes) | after (one mesh) |
| --- | --- | --- |
| **A_stairs** | **561** draws / 8 724 803 / md5 `e72a8dff4d0b31111684b8e31d586d79` | **555** / 8 724 803 / md5 **`e72a8dff4d0b31111684b8e31d586d79`** |
| **`stairs1-top`** | **661** / 9 799 283 / md5 `54a01171b5b6dbb40458bb513d8c03f0` | **655** / 9 799 283 / md5 **`54a01171b5b6dbb40458bb513d8c03f0`** |

**−6 draws at both poses, triangles identical, md5 byte-identical.** For a change that only merges buffers that
is the correct result and the whole safety proof: identical pixels mean nothing moved, and the draw count is
where the win is. `stairs1-top`, the tightest frame measured anywhere in this project, goes from **39 draws of
headroom to 45** — 15 % more.

The split's worst case if culling ever *did* fire somewhere is the whole roof's 8 210 triangles, **0.09 % of an
8.7 M frame**, against six draws saved at every pose. That trade is not close.

## And the roof now has a per-frame figure

`canopyRoof.submission` reports `{ drawCalls, triangles, meshes }` for the current camera. With one mesh, no
casting and a single material the rule is the whole rule — one draw when the sphere is in view, nothing when it
is not — so it can be checked, and it agrees:

| | audit | renderer | gap |
| --- | --- | --- | --- |
| **A_stairs** | 1 / 8 210 | 1 / 8 210 | **0 and 0** |
| **`stairs1-top`** | 1 / 8 210 | 1 / 8 210 | **0 and 0** |

`built.triangles` stays, now labelled as the roof as built rather than as a cost.

`vsrenderer.mjs` takes `--system` and `--audit-key` now (the canopy's group is `canopy` and its audit key is
`canopyRoof`, which is exactly the kind of mismatch that would stop another lane running the check), and it
says **`NO SUBMISSION TALLY`** rather than comparing against nothing when a system has no such row — which is
how this round started.

## Reproducing

```bash
node art/environment/squad2-2026-09-23/auditvsrenderer/vsrenderer.mjs dist /tmp/vs.json \
  --system canopy --audit-key canopyRoof --views 'A_stairs' --quality high --settle 8
```
