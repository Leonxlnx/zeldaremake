# Three poses nobody in this lane had ever looked at — and one of them is bad

Lane 2, 2026-09-30. Branch `cursor/squad2-treephases-682b`. **No code changed here.**

`auditgap/` §3 needed a camera aimed at the **southwest giant** at `(-23, 2.6, 9)`, because its detached
boughs are gated by a frustum test and none of the six fixed viewpoints looks that way. Three poses were
authored for that purpose and then, having them, they were rendered and **looked at** — which no round of
this lane had done for this part of the world.

| pose | camera → target | draws / triangles | the trees' own row |
| --- | --- | --- | --- |
| `sw-plaza-edge` | (−2, 1.75, 4) → (−23, 9, 9) | 489 / 6 485 687 | 82 / 3 980 797 |
| **`sw-approach`** | (−8, 1.75, 7) → (−23, 7, 9) | 458 / 5 320 061 | **83 / 4 116 658** |
| `sw-under` | (−14, 1.75, 9) → (−23, 6, 9) | 314 / 4 048 161 | 77 / 3 875 777 |

`sw-approach` carries **4.12 M tree triangles — more than any fixed viewpoint in the rubric**, hero A's
3.55 M included. So this is both an unexamined composition and the heaviest tree load in the world.

<img alt="the three southwest poses" src="three-poses.jpg" />

## Two of the three are good

`sw-plaza-edge` and `sw-under` show what this corner is for: the second tree-house wrapped around the
giant's bole, its pod lanterns lit, moss and climbing foliage on the trunk, god rays coming down through
layered crowns. Nothing in them reads as flat, and the middle distance has depth.

## `sw-approach` does not

<img alt="sw-approach: the frame is dominated by large hard-edged foliage at close range" src="sw-approach.png" />

The middle and lower two thirds of the frame are covered by **large, hard-edged, flat-looking foliage** —
spiky fronds a metre or two across with visible straight polygon edges, repeating across the frame at a
scale that reads as leaves an arm's length away rather than canopy at 10–20 m. It is the opposite of the
charter line this lane is measured on ("layered trees with readable crowns and trunks at 15–80 m … the far
ring never reads as flat cards from below") and it is the same *shape* of complaint as the owner's backlog
item 4, the dark flat mass overhead, which `roofsky/` fixed for the canopy roof.

**What is not established yet, and I am not going to guess it.** Twice this week a mechanism written before
the measurement turned out to be wrong (`bandwidth/LOWTIER.md` §4, and `poolpredict/`), so what follows is
the candidate list, not a diagnosis:

- a mid or distant **crown card** drawn at close range, where the rung should long since have swapped to
  real geometry — that would be a LOD-gate failure and squarely this lane's;
- the **giant's own canopy laminae** seen from inside its crown, which is `giant.ts` geometry reached through
  this lane's swap distances;
- the **understory** at close range, which is the third banded family;
- or a pose a player cannot actually stand in, in which case it is not a defect at all — `(-8, 1.75, 7)`
  was chosen to frame the boughs, not by walking there, and that has to be checked before anything else.

`outlook/familycost.mjs` is running at these three poses to attribute the pixels family by family, which is
the measurement that turns the list above into one answer. **Until that lands this file claims only what the
frame shows**, and the next round's first job is the reachability question, because if the camera is inside a
crown that a player can never enter then the right outcome is to say so and delete the pose.

## Files

- `southwest-poses.json` — the three poses, in broll/`frozen.mjs` format.
- `three-poses.jpg`, `sw-approach.png` — the frames above.
- `counts.json` — `frozen.mjs`'s reads, clock frozen.

## Reproducing

```bash
npm run build
node art/environment/squad2-2026-09-23/frozen.mjs dist /tmp/sw \
     --poses art/environment/squad2-2026-09-23/southwest/southwest-poses.json --settle 8
node art/environment/squad2-2026-09-23/outlook/familycost.mjs dist \
     art/environment/squad2-2026-09-23/southwest/southwest-poses.json /tmp/swfam
```
