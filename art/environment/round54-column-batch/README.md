# Round 54 — the seated columns' near-canopy lobes as one batch (fable-4)

PR #151 `agent/fable-4-columnbatch` `6e09bc1c` against the head `d9112199` (2026-09-25 17:27).
One file, `src/world/trees/index.ts`.

## What changed

#101 folded the giants' near-canopy lobes into one `BatchedMesh`. The seated columns' lobes stayed
meshes of their own: their geometry is the seat's local space — a yaw and a uniform scale
(0.95–1.05) the tree shader reads through `modelMatrix`, which a batch instance does not have.
This PR bakes each built copy through the seat's matrix instead (`bakePartToWorld`: positions,
normals, `aRoot`'s point — the fold root or a cushion's anchor — and the cull sphere the per-mesh
part was tested by, local sphere × matrix + `CULL_PAD_M`) and puts it into a second batch,
`column-near-canopy-batch`, in the columns' group, with an identity instance. `materials.ts` is
untouched — this is the alternative to the four `USE_BATCHING` lines asked of lane 3 (13:40).

Why the bake is exact for the fragment shader: the only model-space quantity the tree fragment
program reads is `vTreeLocalY = position.y − aRoot.y`, and every bark term of the near-canopy
program saturates by 7.0 m (`GIANT_BARK_COLOR` lowBand 4.5, sheet 2.2, foot 3.2). The 77 column
lobes' vertices stand **7.70–23.74 m** above their root (measured in the page over all 77 parts,
`poses-base.stats.json` → `local`); × 0.9595–1.0475 keeps every one past 7.0 m.

What the bake changes on purpose: on a plain mesh the shader adds its world-space wind
displacement in object space (`transformed += disp`; the instanced trees turn it back through
`transpose(instanceMatrix)`), so a seated column's lobes swayed in a direction turned by the
seat's yaw from its own trunk's. In the batch (identity) they sway with their tree. The
near-canopy program's sway is 2–3 cm at lobe height (`giantWind` stiffness 0.97): sub-pixel at
the fixed views and the look-backs, a pixel or two of edge shift under a seat's crown at 8–15 m
(the small-tier section below has the counts).

## Six fixed views, 1280 × 720, `capture.mjs --settle 12`

SSIM against `reference/frames` identical to four decimals at all six; draws and triangles equal
at all six; 0 px above 24/255 at all six (`six-views.pixel-diff.txt`, thresholds 24 and 0).

| view | draws / M tris (both) | SSIM (both) | px differing at all | of which 1/255 | max |
|---|---|---|---|---|---|
| A_stairs | 614 / 8.97 | 0.1953 | 0 | — | — |
| B_house | 596 / 8.29 | 0.1768 | 87 (0.009 %) | 82 | 4/255 |
| C_lookback | 533 / 7.96 | 0.1854 | 0 | — | — |
| D_log | 523 / 8.74 | 0.2512 | 0 | — | — |
| E_ground | 596 / 8.29 | 0.1997 | 0 | — | — |
| F_canopy | 555 / 8.10 | 0.2192 | 34 (0.004 %) | 30 | 2/255 |

`A_stairs.det` 0.00 % on both builds. B's 87 pixels are scattered over the hazed ground behind
the plaza's column trunk (`B_house.residual-zoom.jpg`, ×2: head | branch | the differing pixels
in red), F's 34 in one 24 × 19 px patch of a far crown (`F_canopy.residual-zoom.jpg`) — all at
the haze floor. They are not the batch's rendering: in the pose harness below, at the same sim
time (12.5), the two builds are **0 px at B and 0 px at F**, with the column lobes shown (F has
one in frame: 1 draw / 4 K triangles on the head, the batch's one draw on the branch) and with
them hidden; and E, which is B's pose captured four minutes later in the same six-view run, is
0 px. What differs at B and F is that run's pool state at the frame (which far parts were
resident and shown — the six views are captured in one page, A → F, and the two builds' pools
run a part apart), seen through the haze at 1–4/255.

## Look-backs and hero poses, 1280 × 720, t = 100, the column lobes hidden as a control

`_f4hidekind.mjs` (scratch): at each pose a frame as drawn and one with every object of
`userData.kind === 'column-near-canopy'` moved off the camera's layer (the meshes on the head,
the batch on the branch — `visible` is rewritten every frame by `nearCanopyUpdate`, layers are
not), with draws / triangles for both. `poses-base.stats.json` / `poses-branch.stats.json`.

| pose | head draws / M tris | column lobes in frame | branch draws / M tris | Δ draws | px > 0: lobes shown / hidden |
|---|---|---|---|---|---|
| A_stairs | 614 / 8.967 | 0 (1 shown, out of frame) | 614 / 8.967 | 0 | 40 / 40 |
| green-west (43, 4) → plaza | **704** / 9.923 | **18 draws / 94 K** | **687** / 9.923 | **−17** | **0 / 0** |
| lookout-fence-west (47.5, 8) → plaza | 695 / 9.966 | 12 draws / 64 K | 684 / 9.966 | −11 | 7 / 0 |
| plateau-lookback-south (17, −15) → S | 576 / 9.073 | 0 (6 shown, out of frame) | 576 / 9.073 | 0 | 383 / 383 |
| owner-0650-north (1.4, −10.2) → N | 497 / 9.013 | 1 draw / 5 K | 497 / 9.013 | 0 | 49 / 49 |
| B_house, t = 12.5 | 596 / 8.293 | 0 (1 shown, out of frame) | 596 / 8.293 | 0 | 0 / 0 |
| F_canopy, t = 12.5 | 555 / 8.098 | 1 draw / 4 K | 555 / 8.098 | 0 | 0 / 0 |

- The batch draws exactly the lobes' triangles in one call (green-west: the head's 18 draws / 94 K
  → 1 draw / 94 K; the frames without the lobes are 686 / 9.829 on both builds).
- **green-west is over the 700 cap on the head (704) and under it on the branch (687).**
- Pixels: at green-west, 18 lobes in frame at ~40 m, the two builds are **identical to the bit**
  (`green-west.base-branch-heat.jpg`: head | branch | differences, none); at the lookout the 7
  pixels at 1/255 are the lobes' (0 with them hidden). At A, the plateau and the north pose the
  counts are the same with the lobes shown or hidden — the harness's own 1/255 noise between two
  page sessions whose pools are a part apart (the giants' batch 321 vs 320 instances at the
  plateau), not the columns'; the six-view pipeline above, which runs each view fresh, has A, C, D
  and E at 0.

## The small pool tier: evictions, rebuilds, and the lobes up close

`?pool=small` (cap 64 MB, 161–164 of 426 parts resident), the same harness, four poses in one
page: under the east seats (14, 14 → the crowns at 21, 8, lobes 8–15 m off), the north clearing
looking away (0, −70 → −95), back under the east seats, then under the north seats (2, −18 →
−3.5, −28). `small-walk-base.stats.json` / `small-walk-branch.stats.json`.

| pose | head draws / M tris | lobes in frame | branch draws / M tris | Δ | columns' batch instances | px > 24/255 (> 0): lobes shown / hidden |
|---|---|---|---|---|---|---|
| east-seats | 318 / 5.879 | 8 draws / 41 K | 311 / 5.879 | −7 | 15 | 1,780 (43,956) / 0 |
| north-clearing-away | 356 / 4.325 | 0 | 356 / 4.325 | 0 | 7 | 0 (0) / 0 |
| east-seats-back | 318 / 5.879 | 8 draws / 41 K | 311 / 5.879 | −7 | 17 | 1,780 (43,956) / 0 |
| north-seats | 349 / 5.920 | 13 draws / 67 K | 337 / 5.920 | −12 | 17 | 7,623 (95,426) / 0 |

- **Evictions and rebuilds exercised:** the columns' batch went 15 → 7 → 17 instances (eight
  column lobes evicted at the north clearing, rebuilt — `part.build` → bounds → bake → install —
  on the way back). The branch's east-seats and east-seats-back frames are **identical to the
  bit** (so are the head's): a rebuilt, re-baked lobe lands where the first build did.
- **Up close the sway's direction shows.** 8–15 m from the seats every lobe's leaves and twigs
  shift by up to a pixel or two between the builds — 0.2 % of the frame above 24/255 under the
  east seats, 0.8 % under the north seats, 0 with the lobes hidden (`north-seats-small.pair.jpg`,
  `north-seats-small.zoom3x.jpg`: head | branch | the difference × 4 — outlines along leaf and twig
  edges, nothing moved wholesale). This is the wind correction above: the per-mesh lobes' 2–3 cm
  sway was turned by the seat's yaw; in the batch it is the sway their own trunk and far laminae
  have (the instanced path's `transpose(instanceMatrix)` gives exactly the world displacement).
  No fixed view stands that close to a seated column's crown (F has one lobe in frame at the
  haze floor: 0 px); at 40 m (green-west, 18 lobes) the two builds are identical.

## Heap

The columns' batch on the large tier holds all 77 parts (every seat is within the pool's
prefetch of the plaza): 377,845 vertices live, 476,842 reserved (1.25 ×), **34.1 MB** of typed
arrays, 0 wide parts. Against the head's per-mesh lobes, whose arrays are released after their
first upload, the trees' `cpuArrays` audit line rises by **+14.5 MB at A** (columns 46.6 → 61.1 MB;
trees 291.6 → 306.1) and **+19 MB** at the four other poses (columns 37.7 → 56.9 at green-west).
The giants' batch is unchanged (199.8 MB reserve at every pose on both builds).

## Checks

`npm run typecheck` green; `vite build` green; `node --test` over the 56 test files: 212 / 212.

## Scratch tools (not committed)

`/tmp/f4/clarity/scripts/_f4hidekind.mjs` (pose, frame, frame with a kind hidden, draws, audit),
`_f4diff.mjs` (pixel diff at a threshold, sheet). Dists `/tmp/f4/r206-dist-base` (d9112199) and
`/tmp/f4/r206-dist-colbatch` (6e09bc1c); captures `/tmp/f4/r206-cap-*`, poses `/tmp/f4/r206-aux-*`.
