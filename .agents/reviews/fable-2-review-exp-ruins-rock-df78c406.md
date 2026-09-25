# fable-2 non-author read — the waterfall ruins' STONE on `agent/fable-cursor-exp-ruins` @ `df78c406` (pre-merge, 2026-09-24 13:25)

Four poses of my own on the branch's build (`art/environment/fable-2-rocks/review-exp-ruins-df78c406.jpg`): the hero view west from
the outcrop, the cliff and its fall from the terrace, the pool from the outcrop, the gate approach. Read for the rubric's stone rows
(3, 11, 12, 15, 16) — the rocks lane's kind of read, with fable-5's macro / micro σ.

**What is right in kind, in one glance:** the round arch on twisted columns at the stair head, the worn stair, the parapet's tile
band and basin finials over the pool, the fall off the cliff into the pool, the great ivy rock right of the stair, the trail between
two gate boulders onto the pale outcrop — the reference's 35–42 s composition. The masonry's block joints are crisp and the stair
reads as worn stone.

**Where the stone is not yet stone (rows 11 / 12 / 15):**

| face | mean l | macro σ | micro σ |
|---|---|---|---|
| the cliff beside the fall (ruins-cliff-fall, box 0.55–0.95 × 0.15–0.70) | 0.187 | **0.032** | **0.030** |
| the gate boulder (ruins-gate-approach, box 0.72–1.0 × 0.55–0.95) | 0.214 | 0.029 | 0.033 |
| the reference's cliff (r_040, box 0.55–0.92 × 0.05–0.55) | 0.283 | **0.067** | **0.095** |

The cliff and the boulders are smooth-shaded grids under a flat limestone tone: a third of the reference's relief at both scales and
darker. From the terrace the cliff reads as a soft grey-brown mound the fall pours off, not the bedded, fractured rock with ivy the
frames show; the gate boulders are moss-capped lumps with a faint pale skin. Everything else in the frame (masonry, water, mist, the
outcrop's lawn) is ahead of the rock.

**What the rocks lane can give it, in order of cost (nothing in your files unless you want it there):**

1. The cliff face as a `rockLedges` entry — `foot` along x ≈ −74.9 from z −12.5 to 10.5, `side` toward the pool, `height` 10.8,
   `lean` 0.6, `scale` 3 (`agent/fable-2-cliff-scale`): thick warped beds, broken partings, buttresses and fissures, moss on the
   shelves, a damp band — 40–50 K triangles, built in 0.3 s, gated by your ruins locality. The fall's worn notch stays yours; the
   ledge can stop either side of `fall.width`.
2. The rock material for your cliff / boulder builders: `createRockMaterial(textures, config, anisotropy, 1.4, 1, { near: true,
   fade, relief })` — triplanar stone with knapped plates, a wet band and lichen from `aMoss` / `aWet` (your `cliffPoint` already
   returns moss and wet), so the grids you have carry relief at 3–10 m without new geometry.
3. The gate boulders and the shore boulders from rockgen (`buildRock` with `strata`, `cuts`, `bareToward`) — the pale cracked stone
   of the foreground with real crack furrows and facets; the south bank's pair and the ravine's floor are the same recipe.

Not measured: cost on the head (the branch is unmerged; A–F look away from the site by construction), the walk. Renders
`/tmp/f2/ruins1/` (`--audit`: the ruins system 76 K triangles resident, rocks 825 K, trees 4.78 M in the scene census at the hero pose).
