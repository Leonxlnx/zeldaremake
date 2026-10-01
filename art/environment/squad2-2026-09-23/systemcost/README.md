# Every system's frame cost from the renderer, beside what its own audit claims

*squad lane 2 — 2026-09-30 17:30 UTC — a handover table, read-only, nothing edited outside this lane*

Two rounds found the same class of problem in this lane's two systems. `auditvsrenderer/`: the trees' submission
row was **36 draws and 820 K triangles out** at hero A for weeks. `roofdraws/`: the canopy roof had **no
per-frame row at all**, and six draws a frame went unnoticed because of it. Both were found the same way —
`__ZR__.isolate('<system>')`, which has been in `src/capture/api.ts` all along and which nothing in the repo had
ever been compared against.

Recommending that to the other nine lanes is cheap. Running it is cheaper still: `systemcost.mjs` does all
eleven in **one page load**.

## hero A (`A_stairs`), frame 555 draws / 8 724 803 triangles

| system | the renderer | the audit's own claim | |
| --- | --- | --- | --- |
| `lighting` | 0 / 0 | — | no meshes; nothing to report |
| `atmosphere` | **4 / 6 816** | — | **no per-frame figure** |
| `terrain` | **33 / 628 274** | — / 622 088 | a **built** total, not a submitted one |
| `hardscape` | **15 / 524 524** | — | **no per-frame figure** |
| `rocks` | **31 / 231 680** | — | **no per-frame figure** |
| `trees` | 140 / 2 656 488 | **140 / 2 656 692** | 0 draws, −204 triangles (`auditvsrenderer/`) |
| `canopy` | 1 / 8 210 | **1 / 8 210** | **agrees exactly** (`roofdraws/`) |
| `structures` | **119 / 2 008 148** | — / 2 427 971 | a built total, **419 823 triangles above** what it draws |
| `props` | **15 / 97 752** | — / 72 356 | a built total, 25 396 below |
| `vegetation` | 127 / 2 455 038 | **126 / 2 454 630** | 1 draw, 408 triangles — near exact |
| `character` | **63 / 179 984** | — / 154 442 | a built total, 25 542 below |

The isolates sum to **548 draws / 8 796 914 triangles** against the frame's 555 / 8 724 803 — 7 draws under and
72 K over, which is about what the sky, the composer's passes and anything outside a named system child should
account for. That the sum lands there at all is the method's own sanity check.

## What the table says

**Three of eleven systems publish a per-frame draw count**, and two of those three are this lane's, added in the
last two rounds. `vegetation` is the one that already had it and it is **near exact** — 1 draw and 408 triangles
from the renderer, which is the standard the rest can be held to.

**Four publish a built total where a reader will take a frame cost.** That is not wrong of them — how big a
system is, is worth knowing — but `terrain`, `structures`, `props` and `character` each publish `triangles`
with no draw count beside it, and the number is not what a frame pays. The gap is largest at **`structures`:
2 427 971 claimed against 2 008 148 drawn, 21 % above.** `canopyRoof.triangles` was in exactly this position
and happened to match, because nothing was ever culled — which is the trap: a built total that agrees once
looks like a submitted one.

**Four publish nothing per-frame**: `atmosphere`, `hardscape`, `rocks`, and `lighting` (which draws nothing, so
it is right to). `hardscape` at **15 draws / 524 524 triangles** and `rocks` at **31 / 231 680** are 6 % of the
frame's triangles between them with no figure of their own.

## The one lead worth another lane's hour

**`character` is 63 draws for 179 984 triangles — 11.4 % of the frame's draws for 2.1 % of its triangles.**
At **2 856 triangles a draw** it is now the thinnest ratio in the frame, the position the canopy roof held until
`roofdraws/` merged it (1 173 a draw, seven draws to one, −6 at every pose). Triangles-per-draw across the
frame at hero A:

| | `atmosphere` | **`character`** | `props` | `rocks` | `canopy` | `structures` | `trees` | `terrain` | `vegetation` | `hardscape` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| triangles a draw | 1 704 | **2 856** | 6 516 | 7 473 | 8 210 | 16 875 | 18 974 | 19 038 | 19 331 | 34 968 |
| draws | 4 | **63** | 15 | 31 | 1 | 119 | 140 | 33 | 127 | 15 |

Draws are the scarce resource where this world is tight: `lookspots/` found `stairs1-top` at **655 of W38's
700**, 45 spare. 63 of them going to one character is worth its owner's attention — though a rigged GLB with
several material slots is a harder merge than a static roof was, and this is a number, not a proposal.
`atmosphere`'s 4 draws are thinner still and not worth anyone's time at 4.

## Caveats, so nobody reads more into this than it holds

- `isolate(group)` hides every other scene child and renders directly, so **no composer and no post passes**.
  It is the renderer's own colour + shadow count for that system's share, which is the right comparison for a
  submission row and not a complete account of the frame.
- One pose. A system's share moves with the camera — `lookspots/` has vegetation at 4.60 M and trees at 3.00 M
  at `stairs2-top`, a different ordering from hero A.
- **A built total is not an error.** The note only says the field is not what a frame pays, which matters when
  it is the only number a system publishes.
- This measures nothing about whether a system's cost is *earned*. `farshade/` and `colshadow/` took two rounds
  to establish that for two rows of one system.

## Reproducing

```bash
node art/environment/squad2-2026-09-23/auditvsrenderer/systemcost.mjs dist /tmp/systemcost.json \
  --view A_stairs --quality high --settle 8
```

For one system in depth, with the colour and depth passes split:

```bash
node art/environment/squad2-2026-09-23/auditvsrenderer/vsrenderer.mjs dist /tmp/vs.json \
  --system <group> --audit-key <audit key> --views 'A_stairs' --quality high --settle 8
ZR_URL_EXTRA='shadow=0' node …   # the colour pass alone, on both sides
```
