# Props lane (fable-3) — iteration 4: merge per locality (GOAL_MODE #3, second half)

BEFORE = the world head `0987e060` (fable-cursor's tick 181: my `f8b73662` merged, the dais fix,
fable-2/4/5's goal-mode branches), AFTER = `agent/fable-3-merge` @ `f37968ba`. Both built and
rendered on this VM: `capture.mjs --quality high --settle 12`, same commands both sides. The branch
also carries the two commits the 02:25 merge missed (`0b46deb7` the 45 m cull, `351739cc` the
clearing evidence) as cherry-picks.

## What

A `cluster` stays a place (placement, audit, and now `audit.clusterBounds` per material); clusters
belong to a merge **locality** (`localityOf` in `layout.ts`: the seven village clusters → `village`,
the north clearing → `clearing`), and each locality is one mesh per material. The village spans
~30 m and every fixed camera holds most of it, so per-cluster meshes bought no culling there — only
draw calls (16 village meshes, up to 32 draws with the shadow pass). Now: **8 meshes for the whole
system**, ≤ 8 draws per pass in any frame; the distance cull works per locality.

## Six fixed views (`six-views-after.jpg`)

| view | before SSIM | after SSIM | Δ | draws | triangles (M) | changed px |
| --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2195 | 0.2195 | 0 | 577 → 551 (−26) | 9.08 → 9.08 | 0 |
| B_house | 0.2042 | 0.2042 | 0 | 535 → 512 (−23) | 8.31 → 8.32 | 0 |
| C_lookback | 0.2393 | 0.2393 | 0 | 393 → 395 (+2) | 7.55 → 7.62 | 0 |
| D_log | 0.2794 | 0.2794 | 0 | 402 → 395 (−7) | 8.50 → 8.55 | 0 |
| E_ground | 0.2146 | 0.2146 | 0 | 535 → 512 (−23) | 8.31 → 8.32 | 0 |
| F_canopy | 0.2601 | 0.2601 | 0 | 516 → 492 (−24) | 8.50 → 8.51 | 0 |

Every frame pixel-identical (|Δ| > 8 on no pixel): the same vertices reach the same materials, only
grouped differently. Draws fall by 23–26 in A/B/E/F (the frames that held most clusters) and by 7 in
D (the −8 of the cull, +1 of the merge); C gains 2 (it held one cluster, now the village mesh set
draws whole) and +0.07 M triangles (the whole village through both passes) at 7.62 M. Camera A stays
9.08 M (the head's number; props add nothing to A). 0 console errors both sides. Audits: 20 meshes /
8 clusters before → 8 meshes / 8 clusters / 2 localities after, 51 822 triangles both.

## Tests

`node src/world/props/geometry.test.mjs`: two localities, one group each, ≤ 8 meshes; the lookout
railing's own extent from `audit.clusterBounds['plateau-lip']` (ropes above the slab top, posts
0.88 m over it, the step on the turf); the clearing locality ≤ 4 compact meshes; from every fixed
camera the clearing is culled and the village drawn; far north of the clearing both are culled;
on forbidden ground only the ladder and the hook-bound railing build (both village). Then
`npm run typecheck && npm run build`.
