# Looking out from the plateau: which tree family the frame is actually paying for

Lane 2, 2026-09-28. Branch `cursor/squad2-treephases-682b`.

The look-backs are the two views the triangle and draw lines are worst at, and until now the trees' share
of them was only ever split by the audit's **submitted** counters — what the systems hand to the
renderer, not what survives culling. `isolate()` stops at the top-level system, so "trees 3.3 M" was as
far as it went.

`familycost.mjs` splits the drawn frame by family the way `depthfoot/depthprobe.mjs` split the depth
pass: pose, settle with time, **freeze the clock**, then hide one family, re-render the same frame and
read both the triangle delta and the share of pixels that moved. A control frame with nothing touched
comes first and read **0.00 %** at both poses. `--shadow` drops `castShadow` instead of visibility, so
"what does this family cost to draw" and "what does it cost to cast" separate.

    node art/environment/squad2-2026-09-23/outlook/familycost.mjs dist outlook/poses.json outlook
    node … --shadow --only "distant ring,mid layer,white-barks"

It needs a handle on the trees group, which the shipped build does not expose — the same temporary line
`depthprobe.mjs` documents, added next to `phase('distant-mid-and-publish')` and **taken out again**.

## 1. plateau-north — 456 draws / 6 246 699 triangles

| family | meshes | submitted | drawn triangles | draws | pixels moved |
| --- | --- | --- | --- | --- | --- |
| giants: wood and leaves | 13 | 3 393 774 | 552 932 | 26 | 6.78 % |
| columns | 8 | 738 567 | 513 233 | 14 | 2.45 % |
| giants: far foliage batches | 3 | 483 860 | 227 652 | 3 | 1.38 % |
| white-barks | 12 | 117 519 | 157 743 | 15 | 0.34 % |
| understory | 14 | 75 350 | 143 818 | 23 | 0.31 % |
| **mid layer** | 10 | 22 869 | 25 181 | **30** | 0.38 % |
| **distant ring** | 7 | 7 346 | 9 338 | **21** | **0.00 %** |
| near bases | 6 | 195 792 | **0** | 0 | 0.00 % |

## 2. plateau-back — 702 draws / 10 895 532 triangles

| family | meshes | submitted | drawn triangles | draws | pixels moved |
| --- | --- | --- | --- | --- | --- |
| giants: wood and leaves | 16 | 3 400 474 | 1 175 651 | 44 | 35.21 % |
| giants: far foliage batches | 3 | 483 860 | 655 676 | 6 | 9.78 % |
| columns | 11 | 830 082 | 498 590 | 14 | 1.84 % |
| white-barks | 15 | 159 174 | 168 838 | 16 | 2.29 % |
| understory | 8 | 49 602 | 63 638 | 10 | 5.47 % |
| **mid layer** | 10 | 39 782 | 44 848 | **30** | 6.03 % |
| **distant ring** | 5 | 4 800 | 6 400 | **15** | 1.78 % |
| near bases | 6 | 200 335 | **0** | 0 | 0.00 % |

"Drawn" is the delta across **both passes**, which is why a family can draw more than it submits
(white-barks submit 117 519 and draw 157 743: most of that geometry is drawn twice, once for the sun).

## 3. What this says

**The near bases cost nothing at either pose.** Six meshes, 0.2 M submitted, 0 drawn: the batch's
per-object frustum culling already does the whole job there, which is the same reason the slot-cap
direction priced out at 4–37 K (`slots/`).

**The two layers this lane owns are a draw-call problem, not a triangle problem.** The mid layer and the
distant ring together spend **45–51 draws** — a third of the trees' 135 at plateau-back — to draw **32–51 K
triangles**, about **1.3 % of the trees' drawn triangles**. Every other family draws 15–40 K triangles per
draw call; these two draw 400–1500. The cause is structural: `distant.ts` splits each layer into sector
meshes for culling and gives each mesh two material groups (`addGroup`), so seven resident sectors are
twenty-one draws.

**And neither of them casts a shadow at all** — `--shadow` found **0 meshes** with `castShadow` in either
family at either pose, so all of those draws are colour-pass draws and there is no depth-side saving to
take.

**At plateau-north the distant ring draws 21 calls and 9 338 triangles for 0.00 % of the pixels.** It is
behind the nearer forest, so this is occlusion, not something a distance rule can see; at plateau-back
the same family is worth 1.78 % of the frame, so it cannot simply be dropped at range either. The
recoverable part is the **granularity**: fewer, larger sector meshes cut draws and raise triangles, and
with 400–1500 triangles a draw there is a lot of room before that trade turns bad. That is the next
piece of work in this lane, and it is `distant.ts`, which lane 2 owns outright.

**One finding for fable-4:** dropping `castShadow` on the white-barks moves **0.00 % of the pixels** at
both poses while saving 40 224 triangles and 3 draws at plateau-north and 9 664 / 1 at plateau-back. It
is the same free-shade case `depthfoot/` found in the giants, in `whitebark.ts` rather than here — 21
meshes, so the per-mesh test `util/shadowReach.ts` offers would likely take it.

## 4. A correction to `depthfoot/` §9

That section claimed the depth culls took the plateau look-back "back under W38's 700-draw ceiling"
(707 → 702). **702 is two over 700, not under it.** The −5 draws narrow the gap and the frame stays
byte-identical, but the gate is not closed; W38's checks are written for the six `*hero` viewpoints, so
the line does not formally bind at this pose either way. The arithmetic was mine and both that section
and `lookbacks.log` now carry the correction.

## Files

- `familycost.mjs` — the probe; `--shadow`, `--only`, and a control frame first.
- `familycost.json`, `shadowcost.json` — the tables above.
- `poses.json` — the two look-backs.
- `plateau-north.jpg`, `plateau-back.jpg` — the baselines, and a frame without any family whose removal
  moved under 0.05 % while saving more than 4 draws.
