# I went to reverse the hold on batching the two layers. The measurement halved the prize instead.

Lane 2, 2026-09-30. Branch `cursor/squad2-treephases-682b`. **No code changed.**

`outlook/` §3 and §8 priced batching the distant ring and the mid layer at **26–30 draws a hero view** and
recommended **holding** it, because the binding view had *"141 draws of headroom"* and the change carries real
risk: a rewrite of both layers' drawing half, one more float attribute for the sway amplitude, and a
dependence on `WEBGL_multi_draw`.

**`lookspots/` broke the premise of that recommendation.** The tightest frame in the world is not a hero view:
`stairs1-top` runs at **665 of 700 draws — 35 spare**, and `stairs2-top` at 651. Against 35 draws of headroom,
26–30 is transformative rather than marginal, so the hold looked wrong and I set out to reverse it.

## The measurement says the opposite

The audit's per-family tally at the two heavy spots and, for comparison, at hero A:

| | meshes | calls | **calls per mesh** |
| --- | --- | --- | --- |
| `distant-far` | 5–6 | 5–6 | **1.00** |
| `distant-near` | 0 | 0 | — |
| `mid-far` | 5 | 5 | **1.00** |
| `mid-near` | 5 | 5 | **1.00** |
| **the two layers** | **15–16** | **15–16** | **1.00** |

**One call per mesh, everywhere.** `outlook/` §3's table counted the same layers at **32 draws** — "distant
ring 12 (6 meshes), mid layer 20 (10)" — which is **two** calls per mesh: colour *and* depth. Today the depth
call is not submitted at all, so the two layers cost **16 draws, not 32**:

| | `outlook/` §3 (stale) | today |
| --- | --- | --- |
| A_stairs, the two layers | 32 draws | **16** |
| batched to 4, the saving | **28 draws** | **12** |
| A_stairs after batching | 559 → 531 | 561 → **549** |
| `stairs1-top` after batching | — | 665 → **653** |

**And the reason is my own work.** §2's depth-pass culls (`shadowReachesGround`) removed the depth submission
for these layers, because their shade never reaches the frame. The batching prize was halved by a change that
shipped in the same branch, and `outlook/` §3's "batched (4 draws)" column has been out of date ever since
without anyone noticing — including me, who quoted "26–30 draws" in the PR description for days.

## So the hold stands, on better ground than before

12 draws against 35 of headroom at the tightest frame measured anywhere, in exchange for rewriting both
layers' drawing half, adding an attribute, and depending on `WEBGL_multi_draw`. The risk `outlook/` §8 named is
unchanged — *"a wrong sway amplitude on the distant crowns, the exact thing the owner's 'the trees do not
populate' note was about"* — and the payoff is now less than half what it was when the lane first declined it.

**Hold, and this time the recommendation and its reason agree.** If the draw line ever becomes the binding
constraint at a play spot, the right order is: this at 12 draws, after whatever the 8.2–9.9 M of vegetation,
trees and structures at those same spots can give up more cheaply (`lookspots/` §2).

## What this says about the lane's own record

Two of this week's rounds have now found a published table stale because a *later change of mine improved the
thing it measured*: the trees' submission row (`auditgap/`) and this. Both were quietly wrong in the safe
direction, which is precisely why neither got caught — a number that is too *pessimistic* never trips an
alarm. The habit that would have caught both is the one `auditgap/` shipped as code: **publish a total that
cannot go stale beside any total assembled by hand.** For a cost table the equivalent is cheap — re-read it
from the audit whenever the branch changes anything it measures, which is two minutes of `bucketprobe.mjs`.

## Files

- `layers.json` — the per-family tallies behind §1, at both heavy spots and hero A.

## Reproducing

```bash
npm run build
node art/environment/squad2-2026-09-23/bandwidth/bucketprobe.mjs dist /tmp/layers.json \
     --views '19.837,7.15,-9.879:16.447,6.9,-7.234;-20.368,3.7,20.588:-17.327,3.45,17.547;A_stairs'
```

Read `byFamily`'s `distant-*` and `mid-*` rows and divide `calls` by `meshes`.
