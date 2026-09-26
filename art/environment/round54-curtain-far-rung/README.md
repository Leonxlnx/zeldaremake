# Round 54 — a far rung for the giants' authored curtains: the decision card (fable-4)

Branch `agent/fable-4-curtainfar` `9baa882f` (stacked on #201 `ad40ecda`), `src/world/trees/index.ts`.
**Dark by default** — `AUTHORED_LEAVES_FAR.m = Infinity`: no twin is built and nothing changes;
`?curtainfar=<m>[,<every>,<scale>]` is the measuring knob. The owner's curtains: the distance is his
or fable-cursor's call, one constant.

## The mechanism

The authored lobes' eye-detail laminae (`giants-authored-leaves-*`, one mesh per giant: the plateau
oak 257 K triangles, the lantern tree 29 K, the east giant 16 K, the stair-bank giant 13 K) are
drawn whole from any range — 0.32 M at the green look-back, the plateau-oak's shot-D curtains 257 K of
it from 37 m. `thinLaminae` builds a thinned twin after the fact from the writer's own layout (one
wind phase per lamina, the base vertex at uv.y = 0): every n-th lamina kept and grown about its base
by a scale — 1 in 2 at √2 keeps the leaf area; 1 in 4 at 1.8 is the family trees' medium rule.
`authoredCurtainsUpdate` swaps a curtain to its twin when the camera is past `m` from the mesh's
sphere, back within `m − 3`; an explicit re-pose decides from the distance alone. The six fixed
views have every curtain within 21 m (A: the lantern tree's at 20.6 m; the rest 1–17 m), so any
`m ≥ 25` leaves them by construction.

## Measured — the same build, off vs on, pose harness 1280 × 720, t = 12.5

| pose | off M tris | 30 m, 1 in 2 @ √2 | px > 24/255 (> 0) | 30 m, 1 in 4 @ 1.8 | px > 24/255 (> 0) | curtains far at |
|---|---|---|---|---|---|---|
| A, B, C, D, F, the owner's north pose | — | **0 K** | **0 (0)** | **0 K** | **0 (0)** | none (all within 21 m) |
| green-west (43, 4) → plaza | 9.706 | **−143 K** | **0 (0)** | **−215 K** | **0 (0)** | lantern 47 m, plateau oak 37 m |
| lookout-fence-west (47.5, 8) → plaza | 9.863 | −149 K | 0 (3) | −224 K | 0 (4) | lantern 53 m, oak 42 m, stair-bank 31 m |
| far-bank-north (4, 43) → N | 9.617 | −158 K | 62 = 0.007 % (3,903 = 0.42 %) | −237 K | 103 = 0.011 % (4,175 = 0.45 %) | all four, 36–55 m |

- At the green the plateau oak's 257 K curtains change **no pixel at any level** when halved or
  quartered: from there they stand behind the oak's own crown. (They are also drawn for no pixel on
  the shipped build — a mesh's sphere meets the frustum; only occlusion would know.)
- The far bank's pixels are a hazed crown behind a trunk (the east giant's curtains at 38 m, the
  stair-bank's at 36 m): the leaf clumps' outlines a little coarser. `far-bank.off-far30-diffx4.zoom3x.jpg`
  and `far-bank.off-far30q-diffx4.zoom3x.jpg`: off | on | the difference × 4, 3× zoom.
- Off against #201's build at the nine poses: 0 px — the dark constant is inert.

## What it would buy

With #188 and #201 the green look-back stands at 9.71 M and the lookout at 9.86 M on the head's
trees (`exp-east`'s structures cut still to land, ≈ −0.5 M there). The rung at 30 m takes another
0.14–0.24 M off each look-back for 0–103 pixels above 24/255 across the three, and nothing at any
fixed view. `tsc` / build green, trees' tests 46 / 46.
