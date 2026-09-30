# The trees' own submission total was short by 27 draws and 196 K triangles, and the audit now says so itself

Lane 2, 2026-09-30. Branch `cursor/squad2-treephases-682b`.

`submission.drawCalls` and `submission.triangles` — the "trees N / M" row this lane has quoted in nearly
every piece of evidence it has written — are the **sum of `byFamily`**, and `byFamily` was eleven explicit
loops over whichever collections `trees/index.ts` happened to hold. Three things were never in those loops.

**The whole-frame numbers are unaffected and every W38 figure stands**: those come from the renderer's own
`info.render` through `__ZR__.stats()`, not from this audit. What was wrong is the trees system's own row.

## 1. What was missing

| family | at A_stairs | why nobody noticed |
| --- | --- | --- |
| **the understory**, all three LODs | **20 draws / 106 411 triangles** | it is the third `bucketFamily` family and the third the rung band covers, and it has its own subgroup under the trees group — but no line of `byFamily` ever mentioned it |
| **`whitebark-roots`** | part of 7 draws / 89 456 | `whiteGroup.add(createWhiteBarkRoots(…))` passed the mesh straight into the group without keeping it in a variable, so there was nothing for a family to tally |
| **five `whitebark-*-high-shadow`** | the rest of that 7 / 89 456 | round 53's per-variant depth proxies for the high bucket. They submit a real depth call each; `add` counts `colour + depth`, so they belong |

**A_stairs, trees' own row: 79 / 3 350 494 → 106 / 3 546 361.** Whole frame **561 / 8 724 803 either way.**
At D_log the understory alone was 23 draws / 155 085 triangles.

Every "trees" column in this lane's evidence is therefore low by roughly this much, and the ones worth
naming are `outlook/` §2's family table (which measured the understory separately with a hiding probe, so
its 63 638 at plateau-back was right — it simply never reached the audit) and the `trees N/M` figures in
`gatesweep/`, `bandwalk/` and `bandwidth/`. **None of them was load-bearing**: no rubric item reads the
trees' own submission, W38 reads the frame, and every before/after comparison in this lane used the same
(equally short) number on both sides, so no *difference* changes.

## 2. The fix that matters is not the three lines

Adding three families to a hand-written list invites the fourth omission. So the audit now publishes
**`unaccounted`**: the same tally taken by **walking the scene graph**, minus the `byFamily` sum. Walking
cannot forget a family.

```
unaccounted            0 meshes / 0 calls / 0 triangles
unclaimed names        []
```

It also names what no family claimed, so the next gap is a lookup rather than a hunt — which is exactly how
this round went. The first version reported `9 meshes / 93 728 triangles` and then:

```
["giant-detached-cards-southwest-giant","giant-detached-leaves-southwest-giant",
 "giant-detached-wood-southwest-giant","whitebark-roots",
 "whitebark-wb-2-462283019-high-shadow", … four more proxies]
```

Two genuine omissions and **one false positive of my own making**: `add` tests a mesh's **own** `visible`
flag, so a plain `traverse` counts meshes inside a hidden parent that the renderer never draws. The three
detached boughs live under a group the locality gate hides, and `byFamily` already guards them with
`if (detachedGroup.visible)`. The walk uses **`traverseVisible`** now, which skips an invisible subtree
whole, so both sides agree on what "visible" means.

The gauntlet's **B3** check is "audit claims cross-checked against the scene graph". This is that check's
own subject, in the system's own audit, and it now has a number to fail on rather than a silence.

## 3. Verified across states, not just at one pose

The check shipped proved at **one** pose, `A_stairs`, which is not a proof of a self-check — the branch
`byFamily` guards with `if (detachedGroup.visible)` is false there, so the walk and the family list had never
been compared in the state where those three meshes count. Ten reads now, one page load per group:

| where | the trees' own row | detached boughs | `unaccounted` |
| --- | --- | --- | --- |
| A_stairs · B_house · C_lookback | 106 / 3 546 361 · 94 / 3 258 160 · 83 / 3 274 981 | hidden | **zero** |
| D_log · E_ground · F_canopy | 102 / 3 364 044 · 94 / 3 258 160 · 91 / 3 157 377 | hidden | **zero** |
| `quality=low`: A_stairs · D_log · F_canopy | 81 / 2 799 418 · 87 / 2 692 521 · 72 / 2 404 047 | hidden | **zero** |
| three poses aimed at the southwest giant | 82 / 3 980 797 · 83 / **4 116 658** · 77 / 3 875 777 | **SHOWN** | **zero** |

The last row is the one that mattered. None of A–F looks at the southwest giant, and `detachedVisible` is a
frustum test, so the only way to exercise that branch was to aim a camera at it — hence the probe taking
`x,y,z:tx,ty,tz` poses as well as viewpoint ids. With the boughs shown the trees submit up to **4 116 658**
triangles, more than at any fixed view, and the two tallies still agree exactly at all three.

**How much each view was under-reporting**, against the same views' `frozen.mjs` rows from earlier rounds:
**+11 to +27 draws and +73 102 to +201 180 triangles**, smallest at `quality=low`'s F_canopy and largest at
D_log. Every one of those figures in this lane's earlier evidence is low by that much.

**And the probe itself had two bugs, both found by using it rather than by reading it.** A pose entry
contains commas, so a comma-separated list of poses split into nonsense (`-2`, `1.75`, `4:-23`, …); the list
separator is `;` now and a comma with a pose throws. Worse, `setViewpoint('-2')` returns **false** and leaves
the camera where it was, so the first attempt printed the **default camera's** numbers under the name `-2` —
identical to `A_stairs`, which is exactly the kind of coincidence that reads as a result. A false return
throws now. The measurement was wrong in a way that looked right, which is the failure mode this whole file
is about.

## 4. Cost

`unaccounted` is one `traverseVisible` per `audit()` call, and `audit()` is on demand — the capture tooling
calls it, never the frame loop. No behaviour change, no pixels: A_stairs is **561 / 8 724 803** before and
after, and the suite is 272 / 272.

## Files

- `ua-A.json`, `ua-D.json` — the first probe, with the understory added and `unaccounted` still 9 / 93 728.
- `ua2-A.json` — the run whose `unclaimed names` list identified the remaining nine.
- `ua3-A.json` — the first verification: `unaccounted` **0 / 0 / 0**, `names []`.
- `ck-hi.json`, `ck-lo.json` — §3's six views at high and three at low.
- `ck-sw.json` — §3's southwest pose, the run that exercises the detached-boughs branch.

## Reproducing

```bash
npm run build
# several viewpoints in one page load
node art/environment/squad2-2026-09-23/bandwidth/bucketprobe.mjs dist /tmp/ua.json \
     --views A_stairs,B_house,C_lookback,D_log,E_ground,F_canopy --quality high
# and a state no fixed viewpoint reaches: `;` between entries, because a pose contains commas
node art/environment/squad2-2026-09-23/bandwidth/bucketprobe.mjs dist /tmp/sw.json \
     --views '-2,1.75,4:-23,9,9' --quality high
```

Read `unaccounted` and `unclaimed names`. Anything non-zero is a family missing from `byFamily`, and the
names say which. The tail line says whether the detached-boughs branch was exercised at all, because a
self-check that only ran in one state has not been checked.
