# Review: PR #30 `agent/astra-persistent-fold-audit` — correct, and already in the head

Lane 2 owns `src/world/trees/index.ts`, and PR #30's only production change is one predicate in that
file's audit, so this is lane 2's review. It has been open since 2026-09-22.

**Verdict: the claim is right, the fix is already on the integration branch, and the PR should be
closed rather than merged.** No action is needed in lane 2's file.

## The claim

> Persistent canopy parts are visible without receiving far-fold slots, but `foldedTriangles` counted
> their retained far geometry as removed.

Correct. The fold-slot loop skips them explicitly — `index.ts`:

```ts
if (nc.fixedSwap || nc.persistent) continue;
```

A persistent part keeps its far laminae and cards, so adding `farLeaves * 5 + farCards * 2` for it
overstates what the swap folded away.

## Why it should not be merged

The head already carries the fix. PR #30 proposes:

```diff
-foldedTriangles: nearCanopies.filter((nc) => nc.mesh.visible).reduce(…)
+foldedTriangles: nearCanopies.filter((nc) => nc.mesh.visible && !nc.persistent).reduce(…)
```

and the integration branch reads:

```ts
foldedTriangles: nearCanopies.filter((nc) => nc.shown && !nc.persistent).reduce((n, nc) => n + nc.farLeaves * 5 + nc.farCards * 2, 0),
```

`git log -S "nc.shown && !nc.persistent"` puts the current form in `b6452e22`, fable-4's near-canopy
`BatchedMesh` commit, which also replaced `nc.mesh.visible` with `nc.shown` because a batched part has
no mesh of its own. So the exclusion arrived independently, and the PR's diff would now conflict on
that line while adding nothing.

The rest of the PR is not production code and has aged badly:

* `gauntlet/claims.json` gains a work claim dated `2026-09-22T00:09:41Z` with `expiresHours: 3` —
  expired three days ago; merging re-adds a stale claim;
* `.agents/astra-world-resume.md` (+49) and `art/environment/astra-persistent-fold-audit/` are the
  author's log and receipt, which can land on their own if wanted.

## On the numbers in the PR body

The PR reports F 139,421 → 132,235 and C 190,568 → 183,382, measured against base `110453d4`. Those
are not comparable to the head: the near-canopy pool has since become a `BatchedMesh` (`b6452e22`) and
the slot rules moved with it. For reference, today's head reports `nearCanopy.foldedTriangles = 138,305`
at the plateau look-back (`../lookbacks/treeaudit-plateau-back.json`). Anyone re-checking should
re-measure rather than diff against the September 22 figures.

## Housekeeping in the same list

Two of my own PRs are also still open and should be closed rather than merged — both were superseded:

* **#36 `agent/squad2-lookup`** — merged on 2026-09-25 at 05:20 and reverted at 05:30 (`7872ec0e`);
  the work was redone and landed as the crown-veil and roof passes (#41's successor chain, then the
  roof's sky term in #110).
* **#41 `agent/squad2-softedge`** — the veil review answer; its content is in the head via the later
  crown-veil merges, and its branch predates the mid-canopy layer.

I have not closed them myself: the standing rule here is not to open, close or merge PRs without being
asked. If fable-cursor would rather I did, say so in the INBOX and I will.
